// ═══════════════════════════════════════════════════════════════════════
// Purchase module data layer — design handoff 17a.
//
// The handoff describes the whole cycle in one sentence, and this file is
// that sentence made real: "a department raises a request off a verified
// BOM, Purchase sources it (rate contract or RFQ), raises the PO,
// Operations releases it, the store books the goods in, and mismatches
// stay open until claimed."
//
// Four entities in here did not exist anywhere in the app before 17a:
// rfqs[], goodsReceipts[], rateContracts[], purchaseDocuments[]. The rest
// is derivation over records that already existed — purchaseOrders[],
// suppliers[], itemMaster[], purchaseRequests[].
//
// ── Two rules that are NOT the handoff's ───────────────────────────────
// 17a's PO form says "under BD 1,000 the PO auto-releases". CLAUDE.md's
// standing domain rule is that EVERY PO requires approval regardless of
// origin, enforced by approvalStatus and by convertPOtoInvoice() refusing
// an unapproved PO. The handoff's own tiebreak (its README, last line of
// Files) says CLAUDE.md wins, so auto-release is deliberately not built:
// PO_SOURCING_THRESHOLD below governs how many QUOTES are needed, not
// whether approval is skipped. Its other new rule — the Owner counter-
// signs above BD 5,000 — does not conflict and is built.
//
// ── Persistence ────────────────────────────────────────────────────────
// These four arrays are LOCAL-ONLY for now, the same starting point
// vehicles[]/deliverySchedule[]/customerFeedback[] had before their own
// cloud slice. Registering them in CLOUD_JSON_COLLECTIONS needs the
// matching tables, which needs a Management API token. Flagged at the
// bottom of this file rather than half-wired.
// ═══════════════════════════════════════════════════════════════════════

// Above this, the request must be sourced with three quotes rather than
// ordered direct. This is a SOURCING rule — it never bypasses approval.
const PO_SOURCING_THRESHOLD = 1000;
// Above this a PO additionally needs the Owner's counter-signature, the
// same two-step shape department budgets and quotes already use.
const PO_OWNER_THRESHOLD = 5000;
// The handoff's rule, stated in the RFQ form: three or more suppliers and
// the rule is met; fewer and Operations sends it back.
const RFQ_MIN_SUPPLIERS = 3;

// Ids are max-based, never length-based — the lesson from nextTaskId(),
// nextItemStockCode() and logActivity(), all of which handed two devices
// the same id once their arrays went cloud-backed.
function nextSeqId(prefix, arr) {
  const n = arr.reduce((mx, r) => {
    const m = String(r.id || "").match(/(\d+)/);
    return m ? Math.max(mx, parseInt(m[1], 10)) : mx;
  }, 0);
  return prefix + "-" + String(n + 1).padStart(4, "0") + "-AMD";
}

const rfqs = [];
const goodsReceipts = [];
const rateContracts = [];
const purchaseDocuments = [];

// ── helpers over records that already existed ──────────────────────────
function poLineValue(l) {
  return Number(l.netAmountBD) || Number(l.amountBD) || ((Number(l.fxRateBD) || 0) * (Number(l.qty) || 0));
}
function poValue(po) {
  return (po.items || []).reduce((s, l) => s + poLineValue(l), 0);
}
function purSupplierName(supplierId) {
  const s = suppliers.find(x => x.id === supplierId);
  return s ? s.name : "—";
}

// ═══ 1. RFQs ═══════════════════════════════════════════════════════════
// An RFQ sources ONE request across several suppliers. Quotes arrive one
// at a time, so `quotes` grows after creation rather than being supplied
// up front.
function createRFQ({ linkedPRId = null, items = [], supplierIds = [], raisedBy = "Purchase", note = "" } = {}) {
  if (!items.length) return { error: "An RFQ needs at least one line." };
  if (!supplierIds.length) return { error: "Select at least one supplier." };
  const rfq = {
    id: nextSeqId("RFQ", rfqs),
    linkedPRId,
    date: todayISO(),
    raisedBy, note,
    items: items.map(it => ({ name: it.name, qty: Number(it.qty) || 0, unit: it.unit || "", itemId: it.itemId || null })),
    supplierIds: supplierIds.slice(),
    quotes: [],
    awardedTo: null,
    status: "open"   // open | quotes-in | awarded | cancelled
  };
  rfqs.push(rfq);
  logActivity({
    type: "rfq-raised", linkedType: "rfq", linkedId: rfq.id, user: raisedBy,
    message: `${rfq.id} sent to ${supplierIds.length} supplier${supplierIds.length === 1 ? "" : "s"}`
  });
  return rfq;
}

// The handoff's rule line on the RFQ form. Returned rather than rendered
// so the form and any check read the same answer.
function rfqMeetsQuoteRule(supplierCount) {
  return Number(supplierCount) >= RFQ_MIN_SUPPLIERS;
}

function recordRFQQuote(rfqId, { supplierId, price, leadDays, terms = "", note = "" } = {}) {
  const rfq = rfqs.find(r => r.id === rfqId);
  if (!rfq) return { error: "RFQ not found." };
  if (rfq.status === "awarded") return { error: "This RFQ is already awarded." };
  if (!supplierId) return { error: "Which supplier is this quote from?" };
  if (!rfq.supplierIds.includes(supplierId)) return { error: "That supplier wasn't asked to quote." };
  if (!(Number(price) > 0)) return { error: "A quoted price is required." };
  const existing = rfq.quotes.find(q => q.supplierId === supplierId);
  const quote = {
    supplierId, price: Number(price), leadDays: Number(leadDays) || 0,
    terms, note, receivedDate: todayISO()
  };
  if (existing) Object.assign(existing, quote); else rfq.quotes.push(quote);
  if (rfq.status === "open") rfq.status = "quotes-in";
  return rfq;
}

function rfqBestPrice(rfq) {
  if (!rfq.quotes.length) return null;
  return rfq.quotes.reduce((b, q) => (b === null || q.price < b.price ? q : b), null);
}
function rfqBestLead(rfq) {
  if (!rfq.quotes.length) return null;
  return rfq.quotes.reduce((b, q) => (b === null || q.leadDays < b.leadDays ? q : b), null);
}
// The recommendation the widget marks with a tick.
//
// This rule is ours, not the handoff's — 17a shows a tick but doesn't say
// how it is chosen. Cheapest wins, EXCEPT that among quotes within 10% of
// the cheapest price we take the fastest: a quote that saves BD 60 and
// costs seventeen days is not actually the cheaper option when the floor
// is waiting on it. Deliberately the fastest WITHIN the price band, not
// the fastest overall — otherwise a wildly expensive next-day quote would
// win every time.
function rfqRecommended(rfq) {
  const cheap = rfqBestPrice(rfq);
  if (!cheap) return null;
  const band = rfq.quotes.filter(q => q.price <= cheap.price * 1.10);
  return band.reduce((best, q) => {
    if (!best) return q;
    if (q.leadDays !== best.leadDays) return q.leadDays < best.leadDays ? q : best;
    return q.price < best.price ? q : best;   // tie on lead — cheaper wins
  }, null);
}

// Awarding is what turns a quote into a real PO — it does NOT skip
// approval; the PO lands pending like every other.
function awardRFQ(rfqId, supplierId, awardedBy = "Purchase") {
  const rfq = rfqs.find(r => r.id === rfqId);
  if (!rfq) return { error: "RFQ not found." };
  if (rfq.status === "awarded") return { error: "This RFQ is already awarded." };
  const quote = rfq.quotes.find(q => q.supplierId === supplierId);
  if (!quote) return { error: "No quote from that supplier to award." };

  const sup = suppliers.find(s => s.id === supplierId);
  const unitRate = rfq.items.length ? quote.price / rfq.items.reduce((s, i) => s + (i.qty || 1), 0) : quote.price;
  const po = createPurchaseOrderDirect({
    department: "purchase",
    linkedJobId: rfq.linkedPRId ? (purchaseRequests.find(p => p.id === rfq.linkedPRId) || {}).linkedJobId || null : null,
    destinationType: "inventory",
    supplierDetails: {
      supplierId,
      supplierNameTel: sup ? sup.name : "",
      preparedBy: awardedBy,
      cashLedger: "Purchase"
    },
    items: rfq.items.map(it => ({
      name: it.name, qty: it.qty, unit: it.unit, itemId: it.itemId,
      fxRateBD: unitRate, vatPercent: 10
    }))
  });
  if (po && po.error) return po;

  rfq.status = "awarded";
  rfq.awardedTo = supplierId;
  rfq.awardedPOId = po.id;
  // The promised date is what every late-delivery check reads later.
  po.promisedDate = addDaysISO(todayISO(), quote.leadDays);
  po.sourceRFQ = rfq.id;
  logActivity({
    type: "rfq-awarded", linkedType: "rfq", linkedId: rfq.id, user: awardedBy,
    message: `${rfq.id} awarded to ${purSupplierName(supplierId)} — ${po.id} raised`
  });
  return po;
}

// addDaysISO() is data.js's — used here for promised dates and contract
// expiry windows. Defining a second copy would have silently replaced the
// one quotation validity dates depend on, since this file loads later.
// Caught by the duplicate-declaration scan, not by testing.

// ═══ 2. Deliveries ═════════════════════════════════════════════════════
// Not its own entity: a delivery is an approved PO with a promised date
// that the store has not fully booked in yet. Deriving it means it can
// never disagree with the PO or the GRN.
function poReceivedQty(poId, lineIndex) {
  return goodsReceipts
    .filter(g => g.poId === poId && g.status !== "cancelled")
    .reduce((s, g) => s + ((g.lines[lineIndex] || {}).receivedQty || 0), 0);
}
function poFullyReceived(po) {
  if (!(po.items || []).length) return false;
  return po.items.every((l, i) => poReceivedQty(po.id, i) >= (Number(l.qty) || 0));
}
function setPOPromisedDate(poId, date) {
  const po = purchaseOrders.find(p => p.id === poId);
  if (!po) return { error: "Purchase order not found." };
  po.promisedDate = date || null;
  return po;
}
function getDeliveriesDue() {
  return purchaseOrders
    .filter(po => po.approvalStatus === "approved" && po.promisedDate && !poFullyReceived(po))
    .sort((a, b) => String(a.promisedDate).localeCompare(String(b.promisedDate)));
}
function getLateDeliveries(today) {
  const t = today || todayISO();
  return getDeliveriesDue().filter(po => String(po.promisedDate) < t);
}

// ═══ 3. GRN and returns ════════════════════════════════════════════════
// The store books goods in against a PO line by line. Result is DERIVED
// from the quantities, never typed — a receipt that says "full" while the
// numbers say short is exactly the disagreement this replaces.
function grnResult(lines) {
  let short = false, over = false;
  lines.forEach(l => {
    const o = Number(l.orderedQty) || 0, r = Number(l.receivedQty) || 0;
    if (r < o) short = true;
    if (r > o) over = true;
  });
  if (short && over) return "wrong";
  if (short) return "short";
  if (over) return "over";
  return "full";
}
function recordGoodsReceipt({ poId, lines = [], receivedBy = "Storekeeper", note = "" } = {}) {
  const po = purchaseOrders.find(p => p.id === poId);
  if (!po) return { error: "Purchase order not found." };
  // Same rule the rest of the app enforces: nothing moves on an
  // unapproved PO. convertPOtoInvoice() already refuses one.
  if (po.approvalStatus !== "approved") return { error: "This purchase order isn't approved yet — nothing can be booked in against it." };
  if (!lines.length) return { error: "A goods receipt needs at least one line." };

  const mapped = (po.items || []).map((l, i) => {
    const given = lines.find(x => x.lineIndex === i) || lines[i] || {};
    return {
      lineIndex: i,
      name: l.productService,
      itemId: l.itemId || null,
      unit: l.unit || "",
      orderedQty: Number(l.qty) || 0,
      receivedQty: Number(given.receivedQty) || 0,
      rate: poLineValue(l) / ((Number(l.qty) || 1)),
      note: given.note || ""
    };
  });
  const result = grnResult(mapped);
  const grn = {
    id: nextSeqId("GRN", goodsReceipts),
    poId, date: todayISO(),
    receivedBy, note, lines: mapped, result,
    // A mismatch stays open until somebody claims it — the handoff's own
    // words. A clean receipt has nothing to claim.
    claimState: result === "full" ? "none" : "open",
    claimNote: "", status: "posted"
  };
  goodsReceipts.push(grn);
  logActivity({
    type: "grn-recorded", linkedType: "po", linkedId: poId, user: receivedBy,
    message: `${grn.id} booked against ${poId} — ${result}${result === "full" ? "" : ", claim open"}`
  });
  return grn;
}
function grnValue(grn) {
  return grn.lines.reduce((s, l) => s + (l.receivedQty * l.rate), 0);
}
function grnShortfallValue(grn) {
  return grn.lines.reduce((s, l) => s + Math.max(0, l.orderedQty - l.receivedQty) * l.rate, 0);
}
function getGRNMismatches() {
  return goodsReceipts.filter(g => g.result !== "full" && g.claimState === "open");
}
function claimGRNBalance(grnId, claimedBy, note) {
  const g = goodsReceipts.find(x => x.id === grnId);
  if (!g) return { error: "Goods receipt not found." };
  if (g.claimState !== "open") return { error: "There's no open claim on this receipt." };
  if (!note || !note.trim()) return { error: "A note is required — the supplier needs to know what's being claimed." };
  g.claimState = "claimed";
  g.claimNote = note.trim();
  g.claimedBy = claimedBy;
  g.claimedDate = todayISO();
  logActivity({
    type: "grn-claimed", linkedType: "po", linkedId: g.poId, user: claimedBy,
    message: `${g.id} — balance claimed from ${purSupplierName((purchaseOrders.find(p => p.id === g.poId) || {}).supplierId)}`,
    reason: note.trim()
  });
  return g;
}
function settleGRNClaim(grnId, settledBy) {
  const g = goodsReceipts.find(x => x.id === grnId);
  if (!g) return { error: "Goods receipt not found." };
  if (g.claimState !== "claimed") return { error: "That claim hasn't been raised yet." };
  g.claimState = "settled";
  g.settledBy = settledBy;
  return g;
}

// ═══ 4. Rate contracts ═════════════════════════════════════════════════
// A held rate for named items until a date. This is what lets the `pr`
// step's primary action read "Order against the rate contract" instead of
// going out to quotes at all.
function createRateContract({ supplierId, itemIds = [], rates = {}, rateHeldTo, note = "", raisedBy = "Purchase" } = {}) {
  if (!supplierId) return { error: "A rate contract needs a supplier." };
  if (!itemIds.length) return { error: "Which items does this contract cover?" };
  if (!rateHeldTo) return { error: "A rate contract needs an expiry date." };
  const rc = {
    id: nextSeqId("RC", rateContracts),
    supplierId, itemIds: itemIds.slice(), rates: Object.assign({}, rates),
    rateHeldTo, note, raisedBy,
    date: todayISO(),
    status: "active"   // active | expired | cancelled
  };
  rateContracts.push(rc);
  return rc;
}
// Derived, not stored, so a contract cannot read "active" the day after it
// lapsed. 30 days is the "expiring" window, matching the HR compliance
// tiles' own convention.
function rateContractState(rc, today) {
  const t = today || todayISO();
  if (rc.status === "cancelled") return "cancelled";
  if (String(rc.rateHeldTo) < t) return "expired";
  if (String(rc.rateHeldTo) <= addDaysISO(t, 30)) return "expiring";
  return "active";
}
function getRateContractFor(itemId, today) {
  const t = today || todayISO();
  return rateContracts.find(rc => rc.itemIds.includes(itemId) && rateContractState(rc, t) !== "expired" && rc.status !== "cancelled") || null;
}
function getExpiringRateContracts(today) {
  return rateContracts.filter(rc => ["expiring", "expired"].includes(rateContractState(rc, today)));
}

// ═══ 5. Documents ══════════════════════════════════════════════════════
// Files a paper against the order it belongs to.
const PURCHASE_DOC_TYPES = ["Supplier invoice", "Delivery note", "Trade licence", "CR certificate", "Rate contract", "Quotation"];
function filePurchaseDocument({ type, againstType, againstId, date = null, expiryDate = null, filedBy = "Purchase", note = "" } = {}) {
  if (!type) return { error: "What kind of document is this?" };
  if (!againstType || !againstId) return { error: "A document has to be filed against something." };
  const doc = {
    id: nextSeqId("DOC", purchaseDocuments),
    type, againstType, againstId, note, filedBy,
    date: date || todayISO(),
    expiryDate
  };
  purchaseDocuments.push(doc);
  return doc;
}
function getDocumentsFor(againstType, againstId) {
  return purchaseDocuments.filter(d => d.againstType === againstType && String(d.againstId) === String(againstId));
}
// The handoff is explicit that the status which matters here is an
// ABSENCE: a PO received in full with no supplier invoice is a payment
// Accounts cannot make. So this is derived from what is missing, not from
// a field on a record.
function getMissingSupplierInvoices() {
  return purchaseOrders
    .filter(po => po.approvalStatus === "approved" && poFullyReceived(po))
    .filter(po => !getDocumentsFor("po", po.id).some(d => d.type === "Supplier invoice"))
    .map(po => ({ po, value: poValue(po), supplier: purSupplierName(po.supplierId) }));
}
function getExpiringDocuments(today) {
  const t = today || todayISO();
  const soon = addDaysISO(t, 30);
  return purchaseDocuments
    .filter(d => d.expiryDate && String(d.expiryDate) <= soon)
    .map(d => ({
      doc: d,
      expired: String(d.expiryDate) < t,
      daysLeft: Math.round((new Date(d.expiryDate + "T00:00:00") - new Date(t + "T00:00:00")) / 86400000)
    }));
}

// ═══ 6. Supplier performance ═══════════════════════════════════════════
// Both derived. On-time is measured at the FIRST receipt against a PO —
// that is when the goods actually turned up; later top-ups of a short
// delivery are a different problem, tracked as the claim.
function getSupplierOnTimePercent(supplierId) {
  const pos = purchaseOrders.filter(po => po.supplierId === supplierId && po.promisedDate);
  const judged = pos.map(po => {
    const first = goodsReceipts.filter(g => g.poId === po.id).sort((a, b) => a.date.localeCompare(b.date))[0];
    return first ? (first.date <= po.promisedDate) : null;
  }).filter(v => v !== null);
  if (!judged.length) return null;   // null, never 0 — "no record" is not "always late"
  return Math.round((judged.filter(Boolean).length / judged.length) * 100);
}
function getSupplierSpendThisYear(supplierId, year) {
  const y = String(year || new Date().getFullYear());
  return purchaseOrders
    .filter(po => po.supplierId === supplierId && po.approvalStatus === "approved" && String(po.date).slice(0, 4) === y)
    .reduce((s, po) => s + poValue(po), 0);
}
function getSupplierOpenPOs(supplierId) {
  return purchaseOrders.filter(po => po.supplierId === supplierId && po.approvalStatus === "approved" && !poFullyReceived(po));
}

// ═══ 7. The signing route ══════════════════════════════════════════════
// Rendered on the `po` create flow's right rail. Every PO needs approval —
// there is no auto-release tier, deliberately (see the header note).
function poSigningRoute(value) {
  const v = Number(value) || 0;
  const route = [
    { who: "Purchase raises", done: true },
    { who: "Operations releases", note: "every PO, regardless of value" }
  ];
  if (v > PO_OWNER_THRESHOLD) route.push({ who: "Owner counter-signs", note: `over ${PO_OWNER_THRESHOLD.toLocaleString()}` });
  route.push({ who: "Supplier" });
  return route;
}
function poNeedsOwnerCounterSign(po) {
  return poValue(po) > PO_OWNER_THRESHOLD;
}

// ═══ 8. The five dashboard steps ═══════════════════════════════════════
// One function per step so the widget, the KPI stack and the nav badges
// all read the same queue.
function purQueuePR()   { return purchaseRequests.filter(pr => pr.status === "open"); }
function purQueueCMP()  { return rfqs.filter(r => r.status === "quotes-in"); }
function purQueueREL()  { return typeof getPendingPOApprovals === "function" ? getPendingPOApprovals() : []; }
function purQueueLATE() { return getLateDeliveries(); }
function purQueueGRN()  { return getGRNMismatches(); }

function getPurchaseKPIs() {
  const open = purchaseOrders.filter(po => po.approvalStatus === "approved" && !poFullyReceived(po));
  return {
    openPOs: open.length,
    committed: open.reduce((s, po) => s + poValue(po), 0),
    lateDeliveries: purQueueLATE().length,
    grnMismatches: purQueueGRN().length,
    unclaimedValue: purQueueGRN().reduce((s, g) => s + grnShortfallValue(g), 0),
    missingInvoices: getMissingSupplierInvoices().length,
    expiringContracts: getExpiringRateContracts().length
  };
}
// "Committed this month", broken down by the category the items sit in —
// the right column's bar chart. Label above the track, never inside the
// fill, per the handoff's chart rule.
function getPurchaseSpendByCategory(monthISO) {
  const m = monthISO || new Date().toISOString().slice(0, 7);
  const by = {};
  purchaseOrders
    .filter(po => po.approvalStatus === "approved" && String(po.date).slice(0, 7) === m)
    .forEach(po => {
      (po.items || []).forEach(l => {
        const it = l.itemId ? itemMaster.find(i => i.id === l.itemId) : null;
        const cat = (it && it.stockCategory) || "Uncategorised";
        by[cat] = (by[cat] || 0) + poLineValue(l);
      });
    });
  return Object.keys(by).map(k => ({ label: k, value: by[k] })).sort((a, b) => b.value - a.value).slice(0, 5);
}

// ── Not yet cloud-backed ───────────────────────────────────────────────
// rfqs / goodsReceipts / rateContracts / purchaseDocuments run in memory
// per session. Registering them in CLOUD_JSON_COLLECTIONS needs their
// four tables created, which needs a Management API token. Same starting
// point vehicles[]/deliverySchedule[] had before their own slice.

