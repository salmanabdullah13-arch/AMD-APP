// ═══════════════════════════════════════════════════════════════════════
// Store Keeper data layer — design handoff 18a.
//
// The store sits between Purchase and Production: goods arrive against a
// purchase order, get counted, put away, held for a job, and issued to the
// team that needs them.
//
// 18a names three design commitments and says outright they are the point
// of the module. All three live here rather than in the UI, so nothing can
// render one story while the data tells another:
//
//   1. LOCATION LEADS. Stock is held per item PER BIN, never as a single
//      global number. A bin belongs to a store, and bin "A1" in Riffa is a
//      different place from bin "A1" in Tubli — so bins are keyed by store,
//      not by code alone.
//   2. THREE NUMBERS: on hand, held, free. Only `onHand` is stored. `held`
//      is the sum of live reservations and `free` is the remainder, both
//      DERIVED — a stored "free" is a number that drifts the first time a
//      hold expires while nobody is looking.
//   3. COVER MODE is a per-user display flag, but the knowledge it reveals
//      (what the item looks like, which wall it leans against) is real data
//      on the bin, not UI copy.
//
// ── The one absolute rule ──────────────────────────────────────────────
// Material leaves the store against a job card and nothing else. 18a: "it
// must block, not warn... There is no override." issueMaterialToJob()
// refuses without a real job card, and refuses "general use" by name.
// This is the same rule releaseStockEntry() has enforced since the original
// Storekeeper build (CLAUDE.md §1) — now stated the same way in both.
//
// ── Multi-location, and why it exists now ──────────────────────────────
// CLAUDE.md §5 recorded multi-location as deliberately NOT built, matching
// Q-Pro's single "Location 1". Salman confirmed on 19 Aug 2026 that Al
// Maraya really does run separate stores — the original call matched the
// old system rather than the business, and is corrected there.
// ═══════════════════════════════════════════════════════════════════════

// A hold nobody collected is a shortage the store made itself, so two
// separate thresholds: STALE is when it starts costing (dashboard step 3),
// EXPIRY is when the stock goes back to free on its own.
const HOLD_STALE_DAYS = 3;
const HOLD_EXPIRY_DAYS = 7;

const storeLocations = [];   // the real stores
const storeBins = [];        // bins, each belonging to one store
const stockLots = [];        // item x bin, on-hand only
const reservations = [];     // holds against a job card
const storeIssues = [];      // material actually issued out
const storeTransfers = [];   // stock moving between stores
const storeReturns = [];     // material coming back in
const toolLoans = [];        // tools out with a person, on a site
const stockCounts = [];      // counts, blind or open, with variances

function nextStoreId(prefix, arr) {
  const n = arr.reduce((mx, r) => {
    const m = String(r.id || "").match(/(\d+)/);
    return m ? Math.max(mx, parseInt(m[1], 10)) : mx;
  }, 0);
  return prefix + "-" + String(n + 1).padStart(4, "0");
}
function storeToday() { return todayISO(); }
function storeDaysBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}

// ═══ 1. Stores and bins ════════════════════════════════════════════════
function createStoreLocation({ name, address = "", note = "" } = {}) {
  if (!name || !name.trim()) return { error: "A store needs a name." };
  if (storeLocations.some(s => s.name.toLowerCase() === name.trim().toLowerCase())) {
    return { error: "There is already a store called " + name.trim() + "." };
  }
  const loc = { id: nextStoreId("LOC", storeLocations), name: name.trim(), address, note };
  storeLocations.push(loc);
  return loc;
}
// `hint` is cover mode's payload — the thing the store keeper knows and
// nobody standing in for him does. Stored on the bin because that is what
// it describes.
function createStoreBin({ storeId, code, whatLivesHere = "", hint = "" } = {}) {
  if (!storeId || !storeLocations.some(s => s.id === storeId)) return { error: "Which store is this bin in?" };
  if (!code || !code.trim()) return { error: "A bin needs a code." };
  // Unique per STORE, not globally: A1 in Riffa is not A1 in Tubli.
  if (storeBins.some(b => b.storeId === storeId && b.code.toLowerCase() === code.trim().toLowerCase())) {
    return { error: "Bin " + code.trim() + " already exists in that store." };
  }
  const bin = {
    id: nextStoreId("BIN", storeBins), storeId, code: code.trim().toUpperCase(),
    whatLivesHere, hint, lastCheckedDate: null
  };
  storeBins.push(bin);
  return bin;
}
function binLabel(binId) {
  const b = storeBins.find(x => x.id === binId);
  if (!b) return "—";
  const s = storeLocations.find(l => l.id === b.storeId);
  // Always qualified by its store — an unqualified bin code is the exact
  // ambiguity cover mode exists to kill.
  return b.code + " · " + (s ? s.name : "?");
}
function binHint(binId) {
  const b = storeBins.find(x => x.id === binId);
  return b ? (b.hint || "") : "";
}

// ═══ 2. Stock: on hand, held, free ═════════════════════════════════════
function putAwayStock({ itemId, binId, qty, source = "receipt", ref = null } = {}) {
  if (!itemId) return { error: "Which item?" };
  if (!binId || !storeBins.some(b => b.id === binId)) return { error: "Which bin is it going into?" };
  if (!(Number(qty) > 0)) return { error: "A quantity is required." };
  let lot = stockLots.find(l => l.itemId === itemId && l.binId === binId);
  if (!lot) {
    lot = { id: nextStoreId("LOT", stockLots), itemId, binId, onHand: 0 };
    stockLots.push(lot);
  }
  lot.onHand += Number(qty);
  lot.lastMovedDate = storeToday();
  lot.lastSource = source;
  lot.lastRef = ref;
  return lot;
}
// Live holds only: an expired hold has already released its stock, and a
// collected or released one never held it any more.
function liveReservationsFor(itemId, binId) {
  const t = storeToday();
  return reservations.filter(r =>
    r.itemId === itemId &&
    (binId == null || r.binId === binId) &&
    r.status === "held" &&
    r.expiresOn >= t);
}
function stockHeld(itemId, binId) {
  return liveReservationsFor(itemId, binId).reduce((s, r) => s + r.qty, 0);
}
function stockOnHand(itemId, binId) {
  return stockLots
    .filter(l => l.itemId === itemId && (binId == null || l.binId === binId))
    .reduce((s, l) => s + l.onHand, 0);
}
// The only number that means anything, and the reason the other two are
// never stored side by side.
function stockFree(itemId, binId) {
  return Math.max(0, stockOnHand(itemId, binId) - stockHeld(itemId, binId));
}
// One row per item per bin — the shape every stock screen renders.
function getStockRows(filterFn) {
  return stockLots
    .filter(l => l.onHand !== 0)
    .map(l => {
      const item = itemMaster.find(i => i.id === l.itemId);
      return {
        lot: l, itemId: l.itemId, binId: l.binId,
        name: item ? item.name : l.itemId,
        unit: item ? item.unit : "",
        where: binLabel(l.binId),
        hint: binHint(l.binId),
        onHand: l.onHand,
        held: stockHeld(l.itemId, l.binId),
        free: stockFree(l.itemId, l.binId)
      };
    })
    .filter(r => (typeof filterFn === "function" ? filterFn(r) : true))
    .sort((a, b) => a.where.localeCompare(b.where) || a.name.localeCompare(b.name));
}

// ═══ 3. Reservations — a hold belongs to a job card ════════════════════
function reserveStockForJob({ itemId, binId, qty, jobCardId, heldBy = "Storekeeper", note = "" } = {}) {
  if (!jobCardId) return { error: "A hold belongs to a job card." };
  const job = typeof getJobCard === "function" ? getJobCard(jobCardId) : null;
  if (!job) return { error: "That job card doesn't exist." };
  if (!(Number(qty) > 0)) return { error: "A quantity is required." };
  const free = stockFree(itemId, binId);
  if (Number(qty) > free) {
    return { error: "Only " + free + " free in " + binLabel(binId) + " — the rest is already held." };
  }
  const today = storeToday();
  const r = {
    id: nextStoreId("RES", reservations),
    itemId, binId, qty: Number(qty), jobCardId, heldBy, note,
    heldSince: today,
    expiresOn: addDaysISO(today, HOLD_EXPIRY_DAYS),
    status: "held"    // held | collected | released | expired
  };
  reservations.push(r);
  logActivity({
    type: "stock-reserved", linkedType: "job", linkedId: jobCardId, user: heldBy,
    message: `${r.qty} held in ${binLabel(binId)} for ${jobCardId} until ${r.expiresOn}`
  });
  return r;
}
// Derived, so a hold cannot read "held" the day after it lapsed.
function reservationState(r, today) {
  const t = today || storeToday();
  if (r.status !== "held") return r.status;
  if (r.expiresOn < t) return "expired";
  if (storeDaysBetween(r.heldSince, t) >= HOLD_STALE_DAYS) return "stale";
  return "held";
}
// "A hold nobody came for is a shortage the store made itself" — its own
// dashboard card, per the handoff.
function getStaleReservations(today) {
  return reservations
    .filter(r => r.status === "held")
    .filter(r => ["stale", "expired"].includes(reservationState(r, today)))
    .sort((a, b) => a.heldSince.localeCompare(b.heldSince));
}
function releaseReservation(resId, releasedBy, reason) {
  const r = reservations.find(x => x.id === resId);
  if (!r) return { error: "Hold not found." };
  if (r.status !== "held") return { error: "That hold is already " + r.status + "." };
  r.status = "released";
  r.releasedBy = releasedBy;
  r.releaseReason = reason || "";
  r.releasedOn = storeToday();
  return r;
}
// Sweeps lapsed holds. Nothing depends on it running — stockHeld() already
// ignores an expired hold — so this only tidies the record.
function expireLapsedReservations(today) {
  const t = today || storeToday();
  let n = 0;
  reservations.forEach(r => {
    if (r.status === "held" && r.expiresOn < t) { r.status = "expired"; n++; }
  });
  return n;
}

// ═══ 4. Issue — the hard gate ══════════════════════════════════════════
// 18a: "Material leaves the store against a job card and nothing else...
// it must block, not warn... There is no override."
function issueMaterialToJob({ jobCardId, lines = [], issuedBy = "Storekeeper", issuedTo = "" } = {}) {
  if (!jobCardId) {
    return { error: "No job card — nothing can be issued. Material only leaves this store against a job card." };
  }
  // "General use is not a job card." Named explicitly because it is the
  // request the store actually gets, and the one the gate exists to refuse.
  const jc = String(jobCardId).trim().toLowerCase();
  if (jc === "general" || jc === "general use" || jc === "none") {
    return { error: "General use is not a job card. Consumables still belong to a job — ask which job card it is going against." };
  }
  const job = typeof getJobCard === "function" ? getJobCard(jobCardId) : null;
  if (!job) return { error: "That job card doesn't exist." };
  if (job.status === "cancelled") return { error: "That job is cancelled — nothing can be issued against it." };
  if (!lines.length) return { error: "Nothing to issue." };

  // Check every line before moving any stock: a half-issued request leaves
  // the store in a state nobody can reconcile.
  for (const l of lines) {
    if (!(Number(l.qty) > 0)) return { error: "Every line needs a quantity." };
    const available = stockFree(l.itemId, l.binId) + reservedToThisJob(l.itemId, l.binId, jobCardId);
    if (Number(l.qty) > available) {
      const item = itemMaster.find(i => i.id === l.itemId);
      return { error: (item ? item.name : l.itemId) + ": only " + available + " available in " + binLabel(l.binId) + "." };
    }
  }

  const issue = {
    id: nextStoreId("ISS", storeIssues),
    jobCardId, issuedBy, issuedTo, date: storeToday(),
    lines: lines.map(l => ({ itemId: l.itemId, binId: l.binId, qty: Number(l.qty) }))
  };
  issue.lines.forEach(l => {
    const lot = stockLots.find(x => x.itemId === l.itemId && x.binId === l.binId);
    if (lot) { lot.onHand -= l.qty; lot.lastMovedDate = issue.date; }
    // A hold that gets collected is spent, not left dangling.
    liveReservationsFor(l.itemId, l.binId)
      .filter(r => r.jobCardId === jobCardId)
      .forEach(r => { r.status = "collected"; r.collectedOn = issue.date; });
  });
  storeIssues.push(issue);
  logActivity({
    type: "stock-issued", linkedType: "job", linkedId: jobCardId, user: issuedBy,
    message: `${issue.lines.length} line${issue.lines.length === 1 ? "" : "s"} issued to ${issuedTo || jobCardId} (${issue.id})`
  });
  return issue;
}
// Stock this job already holds is available to that job, even though it is
// not "free" to anyone else.
function reservedToThisJob(itemId, binId, jobCardId) {
  return liveReservationsFor(itemId, binId)
    .filter(r => r.jobCardId === jobCardId)
    .reduce((s, r) => s + r.qty, 0);
}

// ═══ 5. Put-away, transfers, returns ═══════════════════════════════════
// Receiving reuses 17a's goodsReceipts rather than a second receipt entity;
// this records where each received line physically went.
function putAwayReceiptLine(grnId, lineIndex, binId, byWhom = "Storekeeper") {
  const g = goodsReceipts.find(x => x.id === grnId);
  if (!g) return { error: "Goods receipt not found." };
  const line = g.lines[lineIndex];
  if (!line) return { error: "No such line on that receipt." };
  if (line.putAwayBinId) return { error: "That line is already put away in " + binLabel(line.putAwayBinId) + "." };
  const res = putAwayStock({ itemId: line.itemId, binId, qty: line.receivedQty, source: "receipt", ref: grnId });
  if (res && res.error) return res;
  line.putAwayBinId = binId;
  line.putAwayBy = byWhom;
  line.putAwayDate = storeToday();
  return line;
}
function getAwaitingPutAway() {
  const out = [];
  (typeof goodsReceipts !== "undefined" ? goodsReceipts : []).forEach(g => {
    (g.lines || []).forEach((l, i) => {
      if (!l.putAwayBinId && l.receivedQty > 0) out.push({ grn: g, line: l, lineIndex: i });
    });
  });
  return out;
}
function createStoreTransfer({ fromStoreId, toStoreId, lines = [], raisedBy = "Storekeeper" } = {}) {
  if (!fromStoreId || !toStoreId) return { error: "A transfer needs a store at both ends." };
  if (fromStoreId === toStoreId) return { error: "That is the same store at both ends." };
  if (!lines.length) return { error: "Nothing to transfer." };
  for (const l of lines) {
    if (stockFree(l.itemId, l.binId) < Number(l.qty)) {
      return { error: "Not enough free stock in " + binLabel(l.binId) + " — some of it is held for a job." };
    }
  }
  const t = {
    id: nextStoreId("TRF", storeTransfers),
    fromStoreId, toStoreId, raisedBy, date: storeToday(),
    lines: lines.map(l => ({ itemId: l.itemId, binId: l.binId, qty: Number(l.qty), toBinId: l.toBinId || null })),
    status: "in-transit"
  };
  // Stock leaves the source bin immediately — it is genuinely not there
  // any more, and leaving it visible would let it be issued twice.
  t.lines.forEach(l => {
    const lot = stockLots.find(x => x.itemId === l.itemId && x.binId === l.binId);
    if (lot) lot.onHand -= l.qty;
  });
  storeTransfers.push(t);
  return t;
}
function receiveStoreTransfer(trfId, receivedBy = "Storekeeper") {
  const t = storeTransfers.find(x => x.id === trfId);
  if (!t) return { error: "Transfer not found." };
  if (t.status !== "in-transit") return { error: "That transfer is already " + t.status + "." };
  for (const l of t.lines) {
    if (!l.toBinId) return { error: "Every line needs a destination bin before it can be booked in." };
  }
  t.lines.forEach(l => putAwayStock({ itemId: l.itemId, binId: l.toBinId, qty: l.qty, source: "transfer", ref: t.id }));
  t.status = "received";
  t.receivedBy = receivedBy;
  t.receivedOn = storeToday();
  return t;
}
const RETURN_CONDITIONS = ["Good — back to stock", "Offcut — usable", "Damaged — scrap"];
function bookStoreReturn({ itemId, qty, binId, condition, fromJobCardId = null, fromWhom = "", byWhom = "Storekeeper" } = {}) {
  if (!itemId) return { error: "Which item is coming back?" };
  if (!(Number(qty) > 0)) return { error: "A quantity is required." };
  if (!RETURN_CONDITIONS.includes(condition)) return { error: "What condition is it in?" };
  // Scrap never goes back on the shelf — booking it in as stock would
  // overstate what the store can actually issue.
  const scrap = condition === "Damaged — scrap";
  if (!scrap && !binId) return { error: "Which bin is it going back into?" };
  const r = {
    id: nextStoreId("RET", storeReturns),
    itemId, qty: Number(qty), binId: scrap ? null : binId, condition,
    fromJobCardId, fromWhom, byWhom, date: storeToday(),
    status: scrap ? "scrapped" : "booked-in"
  };
  if (!scrap) {
    const put = putAwayStock({ itemId, binId, qty: Number(qty), source: "return", ref: r.id });
    if (put && put.error) return put;
  }
  storeReturns.push(r);
  return r;
}

// ═══ 6. Shorts — computed, never typed ═════════════════════════════════
// "Short before the job starts": what routed jobs need that the store
// cannot cover from free stock.
function getStoreShorts() {
  const rows = [];
  (typeof jobCards !== "undefined" ? jobCards : [])
    .filter(j => j.status !== "cancelled" && j.routingConfirmed)
    .forEach(job => {
      (job.items || []).forEach(it => {
        const mats = (it.bom && it.bom.materials) || [];
        mats.forEach(m => {
          if (!m.itemId) return;
          const need = Number(m.qty) || 0;
          const free = stockFree(m.itemId, null);
          if (need > free) {
            const item = itemMaster.find(i => i.id === m.itemId);
            rows.push({
              itemId: m.itemId, name: item ? item.name : m.itemId,
              forJob: job.id, promisedDate: job.promisedDate || null,
              needed: need, free: free, short: need - free,
              why: free === 0 ? "None in the store" : "Only " + free + " free — the rest is held"
            });
          }
        });
      });
    });
  return rows.sort((a, b) => String(a.promisedDate || "9999").localeCompare(String(b.promisedDate || "9999")));
}

// ═══ 7. Tools on loan ══════════════════════════════════════════════════
function bookToolOut({ toolName, itemId = null, withWhom, site = "", dueBack = null, byWhom = "Storekeeper" } = {}) {
  if (!toolName || !toolName.trim()) return { error: "Which tool?" };
  if (!withWhom) return { error: "Who is taking it?" };
  const l = {
    id: nextStoreId("TL", toolLoans),
    toolName: toolName.trim(), itemId, withWhom, site, byWhom,
    outSince: storeToday(),
    dueBack: dueBack || addDaysISO(storeToday(), 7),
    status: "out"
  };
  toolLoans.push(l);
  return l;
}
function returnTool(loanId, condition = "Good — back to stock") {
  const l = toolLoans.find(x => x.id === loanId);
  if (!l) return { error: "Loan not found." };
  if (l.status !== "out") return { error: "That tool is already back." };
  l.status = "returned";
  l.returnedOn = storeToday();
  l.returnCondition = condition;
  return l;
}
function getOverdueTools(today) {
  const t = today || storeToday();
  return toolLoans.filter(l => l.status === "out" && l.dueBack < t);
}

// ═══ 8. Stock count ════════════════════════════════════════════════════
// A blind count hides the system figure so the counter writes what they
// actually see — the whole reason a count is worth doing.
function startStockCount({ area, binIds = [], blind = true, byWhom = "Storekeeper" } = {}) {
  if (!area || !area.trim()) return { error: "Which area is being counted?" };
  const bins = binIds.length ? binIds : storeBins.map(b => b.id);
  const lines = [];
  bins.forEach(binId => {
    stockLots.filter(l => l.binId === binId && l.onHand !== 0).forEach(l => {
      const item = itemMaster.find(i => i.id === l.itemId);
      lines.push({
        itemId: l.itemId, binId, name: item ? item.name : l.itemId,
        systemQty: l.onHand, countedQty: null, variance: null
      });
    });
  });
  if (!lines.length) return { error: "There is no stock in that area to count." };
  const c = {
    id: nextStoreId("CNT", stockCounts),
    area: area.trim(), blind: !!blind, byWhom, date: storeToday(),
    lines, status: "open"
  };
  stockCounts.push(c);
  return c;
}
function recordCountLine(countId, itemId, binId, countedQty) {
  const c = stockCounts.find(x => x.id === countId);
  if (!c) return { error: "Count not found." };
  if (c.status !== "open") return { error: "That count is already closed." };
  const line = c.lines.find(l => l.itemId === itemId && l.binId === binId);
  if (!line) return { error: "That line isn't in this count." };
  if (countedQty == null || countedQty === "") return { error: "A counted quantity is required." };
  line.countedQty = Number(countedQty);
  line.variance = line.countedQty - line.systemQty;
  return line;
}
// Closing applies the variances: a count is only worth doing if what it
// found becomes the truth.
function closeStockCount(countId, byWhom = "Storekeeper") {
  const c = stockCounts.find(x => x.id === countId);
  if (!c) return { error: "Count not found." };
  if (c.status !== "open") return { error: "That count is already closed." };
  const uncounted = c.lines.filter(l => l.countedQty == null);
  if (uncounted.length) {
    return { error: uncounted.length + " line" + (uncounted.length === 1 ? " has" : "s have") + " not been counted yet." };
  }
  c.lines.forEach(l => {
    if (l.variance) {
      const lot = stockLots.find(x => x.itemId === l.itemId && x.binId === l.binId);
      if (lot) lot.onHand = l.countedQty;
    }
  });
  c.status = "closed";
  c.closedBy = byWhom;
  c.closedOn = storeToday();
  c.lines.forEach(l => {
    const b = storeBins.find(x => x.id === l.binId);
    if (b) b.lastCheckedDate = c.closedOn;
  });
  return c;
}
function countVariances(c) { return c.lines.filter(l => l.variance).length; }

// ═══ 9. The five dashboard steps ═══════════════════════════════════════
function stkQueueREC() { return typeof getDeliveriesDue === "function" ? getDeliveriesDue() : []; }
function stkQueueISS() { return typeof getOpenMaterialRequests === "function" ? getOpenMaterialRequests() : []; }
function stkQueueRES() { return getStaleReservations(); }
function stkQueueSHORT() { return getStoreShorts(); }
function stkQueuePUT() { return getAwaitingPutAway(); }

function getStoreKPIs() {
  const rows = getStockRows();
  return {
    atTheGate: stkQueueREC().length,
    teamsWaiting: stkQueueISS().length,
    staleHolds: stkQueueRES().length,
    shorts: stkQueueSHORT().length,
    awaitingPutAway: stkQueuePUT().length,
    binsChecked: storeBins.filter(b => b.lastCheckedDate).length,
    binsTotal: storeBins.length,
    toolsOut: toolLoans.filter(l => l.status === "out").length,
    toolsOverdue: getOverdueTools().length,
    heldValue: rows.reduce((s, r) => {
      const item = itemMaster.find(i => i.id === r.itemId);
      return s + (r.held * ((item && (item.lastPurchaseRate || item.cost)) || 0));
    }, 0)
  };
}
// One row per store, for the dashboard's stores card.
function getStoreSummaries() {
  return storeLocations.map(loc => {
    const binIds = storeBins.filter(b => b.storeId === loc.id).map(b => b.id);
    const rows = getStockRows(r => binIds.includes(r.binId));
    return {
      store: loc,
      bins: binIds.length,
      lines: rows.length,
      onHand: rows.reduce((s, r) => s + r.onHand, 0),
      held: rows.reduce((s, r) => s + r.held, 0),
      free: rows.reduce((s, r) => s + r.free, 0),
      lastChecked: storeBins.filter(b => b.storeId === loc.id)
        .map(b => b.lastCheckedDate).filter(Boolean).sort().pop() || null
    };
  });
}
// Recent movements, newest first — the dashboard's movements card.
function getStoreMovements(limit) {
  const out = [];
  storeIssues.forEach(i => out.push({ date: i.date, kind: "Issued", ref: i.id, detail: i.lines.length + " line" + (i.lines.length === 1 ? "" : "s") + " to " + i.jobCardId }));
  storeReturns.forEach(r => out.push({ date: r.date, kind: "Returned", ref: r.id, detail: r.qty + " back — " + r.condition }));
  storeTransfers.forEach(t => out.push({ date: t.date, kind: "Transfer", ref: t.id, detail: t.lines.length + " line" + (t.lines.length === 1 ? "" : "s") + " moving" }));
  (typeof goodsReceipts !== "undefined" ? goodsReceipts : []).forEach(g => out.push({ date: g.date, kind: "Received", ref: g.id, detail: g.result }));
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, limit || 8);
}

// Cover mode: a per-user display flag, persisted per device like the theme
// toggle. Default off, per the handoff.
function coverModeOn() {
  try { return localStorage.getItem("amd-store-cover") === "1"; } catch (e) { return false; }
}
function setCoverMode(on) {
  try { localStorage.setItem("amd-store-cover", on ? "1" : "0"); } catch (e) { /* private mode */ }
  return !!on;
}

// Cloud-backed as of 19 Aug 2026 — all nine tables exist and are
// registered in CLOUD_JSON_COLLECTIONS (data.js), so the snapshot-diff
// scanner persists them with no per-mutation calls. The issue and hold
// gates additionally run as database triggers: 18a is explicit that "a
// client-side gate is a courtesy, not a guarantee".
