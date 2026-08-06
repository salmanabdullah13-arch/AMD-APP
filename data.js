// ═══════════════════════════════════════
// AL MARAYA — data.js
// Edit this file to update jobs, staff,
// BOM data, capacity & reminders.
// ═══════════════════════════════════════

// DEPARTMENTS & STAFF
const DEPTS=[{k:"carp",n:"Carpentry",c:"#0f9d58"},{k:"paint",n:"Painting",c:"#c47d00"},{k:"uph",n:"Upholstery",c:"#d6336c"},{k:"curt",n:"Curtain",c:"#7c3aed"},{k:"metal",n:"Metal Works",c:"#475569"}];
function dc(k){return DEPTS.find(d=>d.k===k)||{n:k,c:"#888"};}
// Departments a job line can actually be ROUTED to — i.e. that have a real
// production pathway (module, budget approver, queue). Metal Works has none
// (no module, no DEPARTMENT_APPROVERS entry, no budget screen), so a
// metal-routed line was a permanent dead end — routed, un-startable, and
// invisible to every queue/flag (6 Aug 2026 audit, Critical). Track-making
// lives under Curtain (the Tracks team), so track/rail products route to
// "curt" now, and metal is dropped from both auto-suggestion and the
// Estimator's assignable-department list. DEPTS itself keeps "metal" so any
// historical badge/colour lookup still resolves — this only governs routing.
const ROUTABLE_DEPTS = DEPTS.filter(d => d.k !== "metal");
const STAFF=["Arun Kumar","Karthik Silva","Silva","Salman Abdullah","Operations"];

// ═══════════════════════════════════════
// JOB ROUTING — department auto-suggestion (Batch 8, Phase 0)
// Rule-based lookup, per Salman's own call ("simplest starting point,
// can layer in learning from past overrides later" — that later layer is
// NOT built here on purpose). Keyword-matches the item's product name
// first; falls back to the linked Enquiry's own `division` field (already
// captured today, values overlap DEPTS closely) when no keyword hits.
// Returns an ordered array of DEPTS keys — most items are a single stop;
// a product whose name mentions paint gets a second "paint" stop appended
// (e.g. a painted cabinet: ["carp","paint"]), matching the confirmed
// design's own painted-cabinet example.
// ═══════════════════════════════════════
const DEPARTMENT_KEYWORD_MAP = [
  { keywords: ["curtain", "blind", "drape", "sheer"], dept: "curt" },
  { keywords: ["sofa", "chair", "cushion", "upholst", "ottoman", "settee"], dept: "uph" },
  { keywords: ["cabinet", "wardrobe", "shelf", "counter", "vanity", "joinery"], dept: "carp" },
  // Track-making is a Curtain (Tracks team) function, not a separate Metal
  // Works department — a "Motorized Track" routes to Curtain, not a dead end
  // (6 Aug 2026 audit, Critical). "steel" was dropped: it named the old
  // metal dead end and has no real production home, so it now falls through
  // to the division fallback rather than auto-routing anywhere un-actionable.
  { keywords: ["rail", "track", "bracket"], dept: "curt" }
];
const DIVISION_TO_DEPT = {
  "Curtain & Blinds": "curt", "Upholstery": "uph", "Joinery": "carp",
  "Furniture": "carp"
  // "Metal Works" intentionally omitted — it has no production module, so a
  // fallback to it would recreate the dead end. A Metal Works-division
  // enquiry falls through to an empty sequence and the Estimator assigns a
  // real department manually (visible), rather than silently stuck.
};
function suggestDepartmentSequence(product, enquiryDivision) {
  const seq = [];
  const p = (product || "").toLowerCase();
  const primaryMatch = DEPARTMENT_KEYWORD_MAP.find(m => m.keywords.some(k => p.includes(k)));
  if (primaryMatch) seq.push(primaryMatch.dept);
  else if (enquiryDivision && DIVISION_TO_DEPT[enquiryDivision]) seq.push(DIVISION_TO_DEPT[enquiryDivision]);
  if (p.includes("paint") && !seq.includes("paint")) seq.push("paint");
  return seq;
}


// ═══════════════════════════════════════
// CURTAIN MODULE DATA
// ═══════════════════════════════════════

// CURTAIN JOBS — jobs that have a curtain scope
//
// SCHEMA NOTE (windowGroups / layers — migrated from the old flat windowGroup/
// groupRole pattern):
//   Each job.windowGroups[] entry is ONE PHYSICAL WINDOW OPENING. Shared physical
//   properties (room, width, height, qty) live once on the group.
//   Each group has a `layers[]` array — one layer per independent production item
//   at that opening (e.g. main curtain + sheer, or curtain + Roman blind). Every
//   layer keeps its own treatment, fabric, calc, rail/track spec, and — critically —
//   its own `overhang`, since mounting depth differs by treatment even at the same
//   opening (e.g. a curtain track needs overhang, a recess-mounted Roman blind
//   doesn't). A group with one layer = a single-layer window; `role: 'single'`.
//   `qty` = number of identical physical openings this group represents (e.g.
//   qty:2 = two matching windows, tracked and produced as one batch).
//   `quoteEstimateMetres` = reference-only fabric estimate from the original quote,
//   per layer — Silva's calc sheet produces the real (actual) figure; the two are
//   compared to flag material overage, never to override her calc.
//
//   IMPORTANT — this is an AUTHORING format only. Every dashboard (Tracks, QC, BOM,
//   Windows page, Purchase Inquiries) still reads a FLAT `job.windows[]` array in
//   the old shape, produced by `flattenWindowGroups(job)` below. Layer ids are
//   preserved exactly as the old flat window ids were, so purchaseInquiries[].
//   windowIds[] and every other id reference elsewhere continue to work unchanged.
//   Migrating individual dashboards to read windowGroups/layers natively (and
//   retiring the flatten step) is next-session scope.
// Fixture data CLEARED (6 Aug 2026, Salman's call: "clear out the data and
// we can repopulate it"). The 3 hand-seeded demo jobs (AMD-15002/AMD-13374/
// AMD-13898) are gone; every entry from here on is either bridged in live
// from a real confirmed Job Card (bridgeJobToOperationsAndCurtain) or
// hydrated from the cloud (initCloudCurtainJobsCache — Curtain data now
// PERSISTS to Supabase via the snapshot-diff autosave, see CURTAIN CLOUD
// SYNC further down). The windowGroups authoring format and every screen/
// function are unchanged — only the seed data and its persistence moved.
const curtainJobs = [];

// ═══════════════════════════════════════
// FLATTEN windowGroups → job.windows
// Translator so every existing dashboard (Tracks, QC, BOM, Windows page,
// Purchase Inquiries) keeps reading the old flat window shape unchanged.
// Layer ids are preserved exactly as the old flat window ids were.
// Migrating each dashboard to read windowGroups/layers directly (and
// retiring this step) is next-session scope — see SCHEMA NOTE above.
// ═══════════════════════════════════════
function flattenWindowGroups(job) {
  const windows = [];
  job.windowGroups.forEach(g => {
    const isMulti = g.layers.length > 1;
    g.layers.forEach(layer => {
      const w = {
        id: layer.id,
        windowGroup: isMulti ? g.id : null,
        groupRole: isMulti ? layer.role : null,
        room: g.room,
        label: layer.label,
        width: g.width, height: g.height, overhang: layer.overhang, qty: g.qty,
        treatment: layer.treatment,
        fabricType: layer.fabricType, fabricCode: layer.fabricCode, designType: layer.designType,
        fullness: layer.fullness, rollWidth: layer.rollWidth,
        patternRepeatV: layer.patternRepeatV, patternRepeatH: layer.patternRepeatH,
        topHem: layer.topHem, bottomHem: layer.bottomHem, sideHem: layer.sideHem,
        motorized: layer.motorized, motorBrand: layer.motorBrand, motorModel: layer.motorModel, remoteType: layer.remoteType,
        railType: layer.railType, railItemCode: layer.railItemCode !== undefined ? layer.railItemCode : null,
        openingDirection: layer.openingDirection, bracketType: layer.bracketType,
        quoteEstimateMetres: layer.quoteEstimateMetres,
        calcDone: layer.calcDone, calc: layer.calc,
      };
      if ('cordType' in layer)   w.cordType   = layer.cordType;
      if ('cordLength' in layer) w.cordLength = layer.cordLength;
      if ('cordSide' in layer)   w.cordSide   = layer.cordSide;
      windows.push(w);
    });
  });
  return windows;
}

// Hydrate job.windows immediately — before any other code (including
// curtain.js, which loads after this file) reads it.
curtainJobs.forEach(job => { job.windows = flattenWindowGroups(job); });

// ═══════════════════════════════════════
// PURCHASE INQUIRIES — global entity, NOT nested under curtainJobs
// Named "Purchase Inquiry" (not "Inquiry") to avoid colliding with a future
// client-facing Sales Inquiry once Phase 4 (Sales/Estimation) gets built.
// This is where material moves from any division (curtain today; upholstery,
// joinery later) through to the workshop — one inquiry commonly covers
// several windows/items at once, so ETA is set here and read per-window.
//
// VENDOR path (imported):
//   inquiry_raised -> po_raised -> po_approved -> sent_to_supplier
//   -> logistics_arranged -> arrived_bahrain -> received_by_curtain
// STOCK path (from Al Maraya's own limited inventory, code "AMD"):
//   reserved -> received_by_curtain
//
// "arrived_bahrain" vs "received_by_curtain" are deliberately separate
// stages — the fabric can be in the country for days before someone
// physically hands it to the department. Making that its own visible
// stage is the actual fix for the old "no one knows until it's handed
// over" problem.
// ═══════════════════════════════════════
const VENDORS = [
  { name: "Al Guthmi",  region: "Saudi Arabia / Dubai" },
  { name: "Janoub",     region: "Saudi Arabia" },
  { name: "Nassaj",     region: "Saudi Arabia" },
  { name: "York",       region: "Dubai" },
  { name: "D3",         region: "Bahrain / Dubai / KSA" },
  { name: "Silk Weave", region: "Dubai" },
  { name: "Al Kilani",  region: "Bahrain / Dubai / KSA" },
  { name: "Kalima",     region: "Bahrain / Dubai" },
  { name: "AMD",        region: "Own inventory — stock fabric" },
];

const PI_STAGE_LABELS = {
  inquiry_raised:      "Inquiry raised",
  po_raised:           "PO raised",
  po_approved:         "PO approved",
  sent_to_supplier:    "Sent to supplier",
  logistics_arranged:  "Logistics arranged",
  arrived_bahrain:     "Arrived in Bahrain",
  received_by_curtain: "Received by Curtain",
  reserved:            "Reserved from stock",
};
const PI_VENDOR_STAGES = ["inquiry_raised","po_raised","po_approved","sent_to_supplier","logistics_arranged","arrived_bahrain","received_by_curtain"];
const PI_STOCK_STAGES  = ["reserved","received_by_curtain"];

// Fixture inquiries cleared with the curtain-jobs fixtures (6 Aug 2026) —
// real inquiries persist to Supabase via the same autosave scanner.
const purchaseInquiries = [];

function nextPIId() {
  // Max-based, not length-based — with inquiries now hydrated from the
  // cloud, length no longer tracks the highest id (same fix as
  // nextItemStockCode). Collision on a same-instant two-device raise is the
  // same accepted narrow window as every other client-generated id here.
  const max = purchaseInquiries.reduce((m, pi) => {
    const n = parseInt(String(pi.id).replace(/^PI-/, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return "PI-" + String(max + 1).padStart(4, "0");
}
// Raises a new fabric/rail purchase inquiry from the Curtain module (Silva).
// Additive only — same shape as every existing purchaseInquiries[] entry.
// Does not touch the new purchaseRequests/purchaseOrders chain; Curtain's
// tracker stays its own system per the earlier architecture decision.
function raiseInquiry({ jobId, windowIds, vendor, vendorRegion, source, fabricCode = null, quantityOrdered = null, notes = "" }) {
  const pi = {
    id: nextPIId(),
    division: "curtain",
    jobId,
    windowIds,
    vendor,
    vendorRegion,
    source,              // "vendor" | "stock"
    fabricCode,
    quantityOrdered,
    stage: "inquiry_raised",
    eta: null,
    stageDates: { inquiry_raised: todayStrGlobal() },
    notes
  };
  purchaseInquiries.push(pi);
  return pi;
}
// Local date helper — data.js has no existing todayStr(); curtain.js has its
// own todayStr() already, kept separate so this file has no cross-file
// dependency on load order.
function todayStrGlobal() {
  return new Date().toISOString().slice(0, 10);
}

// Quote aging (6 Aug 2026 audit, Phase E) — how long a quotation has been
// alive, so the Estimator/Approver queues can show what's going stale (they
// previously showed only category counts, no time-in-queue signal). Uses the
// quote's own `date`; returns 0 if missing/future.
function quoteAgeDays(q) {
  if (!q || !q.date) return 0;
  const ms = Date.now() - new Date(q.date + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}
// A small coloured age badge (HTML) for a queue row — green ≤3 days, amber
// 4–7, red >7. Returns "" for a same-day quote so fresh rows stay clean.
function quoteAgeBadge(q) {
  const d = quoteAgeDays(q);
  if (d <= 0) return "";
  const color = d > 7 ? "var(--bad,#d9342b)" : d > 3 ? "var(--warn,#c47d00)" : "var(--ok,#0f9d58)";
  return `<span style="font-size:10.5px;font-weight:700;color:${color};white-space:nowrap;">${d}d</span>`;
}

function getInquiryForWindow(windowId) {
  return purchaseInquiries.find(pi => pi.windowIds.includes(windowId)) || null;
}
function getInquiriesForJob(jobId) {
  return purchaseInquiries.filter(pi => pi.jobId === jobId);
}
function piStages(inquiry) {
  return inquiry.source === "stock" ? PI_STOCK_STAGES : PI_VENDOR_STAGES;
}
function piIsDone(inquiry) {
  return inquiry.stage === "received_by_curtain";
}

// ═══════════════════════════════════════
// DAILY TIME LOG — global entity, NOT nested under curtainJobs.
// Same pattern as purchaseInquiries above: a flat, top-level list so it
// doesn't collide with anything job-shaped.
//
// One row = one (worker, date, job, window, role) entry with hours. A
// worker can have multiple rows on the same date to split a day across
// jobs — there's no single "day record" object, just flat rows filtered
// by worker+date.
//
// This is a SEPARATE ledger from job.bom.labour (Operations' existing
// task-based budget/actual view, in the curtainJobs seed data above) —
// it does not overwrite or reconcile with those numbers automatically.
// Per-person rates live in WORKER_RATES (curtain.js) and are only ever
// used to compute cost for Operations' future reference — Curtain UI
// shows hours only, never BD figures, per the cost-free rule.
//
// Starts empty — real entries are added from the Time Log grid as
// workshop days are logged going forward.
// ═══════════════════════════════════════
const timeLogs = [];

// ═══════════════════════════════════════
// TRACK STOCK — raw rail/track profile inventory
// Sourced from the Q-Pro stock export (StockItemExcelExport, imported 3 Jul 2026).
// This is now the SINGLE SOURCE OF TRUTH for rail/track types — curtain.js's
// calc sheet dropdown reads directly from this list (no separate hardcoded
// RAIL_TYPES constant anymore). Real stock is organized by supplier/product
// line, not by generic category, so entries are real item codes/names.
//
// TWO STOCK MODES:
//   'cut'   — raw material tracked in metres, cut to each window's exact
//             length (e.g. Somfy Glydea, Unisoiel tracks, Cord Rail).
//   'piece' — sold/stocked as fixed-length finished pieces used AS-IS, no
//             cutting (e.g. DEERA/CURACC/Taqani Grabber Rail in 1–5m
//             lengths) — confirmed with Salman 3 Jul 2026.
//
// DATA QUALITY: 4 items show negative Closing Stock in Q-Pro (unreconciled
// adjustments) — usable quantity is floored at 0 here; `rawStock` keeps the
// original Q-Pro figure for reference. Flagged `dataIssue:true`.
//
// JUDGMENT CALL: the old app data used two inconsistent labels for the same
// Somfy motor ("Motorised Rail (Somfy)" and "Somfy Glydea Track" both paired
// with "Somfy 35 RTS with DCT" motors in the seed data) — both were mapped
// to the real Glydea rail (IT450) since that's what's actually in stock
// (Movelite raw rail IT461 has only 5.62m). Not confirmed with Silva —
// flag if any of these jobs actually used Movelite rail.
// ═══════════════════════════════════════
const trackStock = [
  // ── Cut-to-length (raw material, tracked in metres) ──
  { itemCode:"IT002395", label:"Cord Rail — Heavy Duty White (COR001)",              mode:"cut", metresInStock:1922.7, reorderAt:200, lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT001886", label:"Aluminium U-Shape Head Rail — Ningbo CH016",          mode:"cut", metresInStock:5811.7, reorderAt:300, lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT000330",    label:"Unisoiel Cord Track — DC01 Heavy",                    mode:"cut", metresInStock:239.4,  reorderAt:50,  lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT378",    label:"Unisoiel Baton Track — M581",                         mode:"cut", metresInStock:0, rawStock:-352.4, reorderAt:50, lastUpdated:"2026-07-03", dataIssue:true, railCategory:"curtain_track_manual" },
  { itemCode:"IT000450",    label:"Somfy Glydea Track — raw rail",                       mode:"cut", metresInStock:2204.4, reorderAt:100, lastUpdated:"2026-07-03", railCategory:"curtain_track_motorized" },
  { itemCode:"IT461",    label:"Somfy Movelite Track — raw rail",                     mode:"cut", metresInStock:5.62,   reorderAt:30,  lastUpdated:"2026-07-03", railCategory:"curtain_track_motorized" },
  { itemCode:"IT358",    label:"Unisoiel Curved/Flexible Track — IBM01",              mode:"cut", metresInStock:440.2,  reorderAt:50,  lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT000362",    label:"Roman Blind Headrail — Unisoiel RAE01",               mode:"cut", metresInStock:3311.6, reorderAt:100, lastUpdated:"2026-07-03", railCategory:"roman_headrail" },
  { itemCode:"IT001918", label:"134 Heavy Duty China Rail",                           mode:"cut", metresInStock:70,     reorderAt:30,  lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT344",    label:"Foshan Heavy Duty Aluminium Curtain Track",           mode:"cut", metresInStock:71,     reorderAt:30,  lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },
  { itemCode:"IT381",    label:"Unisoiel Japanese Track Head Rail — PT19-3E (3-way)", mode:"cut", metresInStock:1190,  reorderAt:100, lastUpdated:"2026-07-03", railCategory:"japanese_track" },
  { itemCode:"IT382",    label:"Unisoiel Japanese Track Head Rail — PT19-5E (5-way)", mode:"cut", metresInStock:696,   reorderAt:100, lastUpdated:"2026-07-03", railCategory:"japanese_track" },
  { itemCode:"IT351",    label:"Salsabeel China Rail",                                mode:"cut", metresInStock:0,     reorderAt:30,  lastUpdated:"2026-07-03", railCategory:"curtain_track_manual" },

  // ── Fixed-piece (used whole, not cut — Grabber Rail style) ──
  { itemCode:"IT339",    label:"DEERA Grabber Rail — American 1m",                    mode:"piece", pieceLengthM:1, piecesInStock:14, reorderAt:5,  lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT340",    label:"DEERA Grabber Rail — American 2m",                    mode:"piece", pieceLengthM:2, piecesInStock:8,  reorderAt:5,  lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT001537", label:"DEERA Grabber Rail — American 2m (Double bracket)",   mode:"piece", pieceLengthM:2, piecesInStock:54, reorderAt:10, lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT341",    label:"DEERA Grabber Rail — American 3m",                    mode:"piece", pieceLengthM:3, piecesInStock:0, rawStock:-36, reorderAt:10, lastUpdated:"2026-07-03", dataIssue:true, railCategory:"grabber_piece" },
  { itemCode:"IT001523", label:"DEERA Grabber Rail — American 3m (Double)",           mode:"piece", pieceLengthM:3, piecesInStock:26, reorderAt:10, lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT342",    label:"DEERA Grabber Rail — American 4m",                    mode:"piece", pieceLengthM:4, piecesInStock:0, rawStock:-69, reorderAt:10, lastUpdated:"2026-07-03", dataIssue:true, railCategory:"grabber_piece" },
  { itemCode:"IT002222", label:"DEERA Grabber Rail — American 4m (Double bracket)",   mode:"piece", pieceLengthM:4, piecesInStock:48, reorderAt:10, lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT343",    label:"DEERA Grabber Rail — American 5m",                    mode:"piece", pieceLengthM:5, piecesInStock:0, rawStock:-3.5, reorderAt:5, lastUpdated:"2026-07-03", dataIssue:true, railCategory:"grabber_piece" },
  { itemCode:"IT003167", label:"CURACC006 American Grabber Rail — 3m",                mode:"piece", pieceLengthM:3, piecesInStock:62, reorderAt:10, lastUpdated:"2026-07-03", railCategory:"grabber_piece" },
  { itemCode:"IT003168", label:"Taqani Curtain Rail — 3m Double R3",                  mode:"piece", pieceLengthM:3, piecesInStock:48, reorderAt:10, lastUpdated:"2026-07-03", railCategory:"grabber_piece" },

  // ── No metre/piece stock tracking (hardware-based or not yet in this sheet) ──
  { itemCode:null, label:"Wooden Pole",           mode:null, note:"No matching item in current stock export — wooden blinds tracked separately.", railCategory:"wooden_pole" },
  { itemCode:null, label:"Roller Blind Bracket",  mode:null, note:"Hardware-based (bracket + end cap components) — see Hardware Pick List instead.", railCategory:"roller_bracket" },
];
function getTrackStock(itemCode) {
  return trackStock.find(t => t.itemCode === itemCode) || null;
}
function getTrackStockByLabel(label) {
  return trackStock.find(t => t.label === label) || null;
}

// ═══════════════════════════════════════
// HARDWARE RECIPES — small assembly components per rail type
// (runners, end caps, master carrier, belt, driver pulley, brackets, etc.)
//
// PROBLEM THIS SOLVES: Silva was going to have to manually count and enter
// every small component per window (runners, end caps, brackets...) at BOM
// stage — tedious and error-prone across 50+ windows. Instead, each rail's
// hardware is DERIVED from track length + motorized flag via a formula, so
// Silva's inputs stay exactly what they already are (track length via
// window width/overhang, rail type, motorized on/off). Nothing new for her
// to fill in.
//
// FORMULA TYPES (component.formula):
//   'fixed'             — flat qty per track, regardless of length (e.g. 2 end caps)
//   'perLength_count'   — density-based: qty = ceil(trackLengthM * perMetre)
//   'perLength_spacing' — spacing-based: qty = ceil(trackLengthCm / spacingCm) [+1 if plusOne]
//   'lengthMatch'       — qty in metres = track length (e.g. drive belt)
//   'unknown'           — not yet quantified; shows as "TBD" in the UI rather
//                          than guessing a number that would silently corrupt
//                          real inventory/BOM figures
//
// CONFIRMED vs UNCONFIRMED: `confirmed:true` components use real figures
// Salman gave directly (runner density, bracket spacing — both confirmed
// 3 Jul 2026 as general shop practice, not Somfy-specific). Everything else
// is a reasonable placeholder flagged `confirmed:false` — the UI must show
// these visibly as needing Silva's sign-off before anyone treats them as
// real purchasing/inventory numbers.
//
// CATEGORY DEFAULTS apply by trackStock.railCategory. TRACK_HARDWARE_RECIPES
// below can override per exact itemCode once Silva confirms a specific rail
// differs from its category's default (e.g. if Movelite ever needs a
// different belt spec than Glydea).
// ═══════════════════════════════════════
const HARDWARE_RECIPE_DEFAULTS = {
  curtain_track_manual: {
    label: "Manual curtain/rail track",
    components: [
      { key:"runner",  label:"Runner / Glider", unit:"pcs", formula:"perLength_count", perMetre:12, confirmed:true,
        note:"Shop average — 12 runners per metre, confirmed by Salman 3 Jul 2026" },
      { key:"bracket", label:"Ceiling Bracket", unit:"pcs", formula:"perLength_spacing", spacingCm:100, plusOne:true, confirmed:true,
        note:"Shop practice — one bracket per metre, confirmed by Salman 3 Jul 2026" },
      { key:"endCap",  label:"End Cap", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Placeholder (2 per track, one each end) — confirm with Silva" },
    ]
  },
  curtain_track_motorized: {
    label: "Motorized track (wave/glide, e.g. Somfy Glydea/Movelite)",
    components: [
      { key:"runner",       label:"Wave Glider / Runner", unit:"pcs", formula:"perLength_count", perMetre:12, confirmed:true,
        note:"Shop average — 12 runners per metre, confirmed by Salman 3 Jul 2026" },
      { key:"bracket",      label:"Motorised Ceiling Bracket", unit:"pcs", formula:"perLength_spacing", spacingCm:100, plusOne:true, confirmed:true,
        note:"Shop practice — one bracket per metre, confirmed by Salman 3 Jul 2026" },
      { key:"endCap",       label:"End Cap", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Placeholder (2 per track, one each end) — confirm with Silva" },
      { key:"masterCarrier",label:"Master Carrier", unit:"pcs", formula:"fixed", qty:1, confirmed:false,
        note:"Placeholder (1 per track) — confirm with Silva" },
      { key:"belt",         label:"Drive Belt", unit:"m", formula:"lengthMatch", onlyIf:"motorized", confirmed:false,
        note:"Assumed 1 belt run = track length — confirm with Silva" },
      { key:"driverPulley", label:"Driver Pulley", unit:"pcs", formula:"fixed", qty:1, onlyIf:"motorized", confirmed:false,
        note:"Placeholder (1 per motorized track) — confirm with Silva" },
    ]
  },
  roman_headrail: {
    label: "Roman blind headrail",
    components: [
      { key:"ring",    label:"Ring", unit:"pcs", formula:"unknown", confirmed:false,
        note:"Rings needed per width not yet quantified — flag for Silva" },
      { key:"bracket", label:"Recess Bracket", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Placeholder (2 per blind) — confirm with Silva" },
    ]
  },
  japanese_track: {
    label: "Japanese panel track",
    components: [
      { key:"panelCarrier", label:"Panel Carrier", unit:"pcs", formula:"unknown", confirmed:false,
        note:"Depends on number of panels ordered — not modeled yet, flag for Silva" },
      { key:"bracket",      label:"Ceiling Bracket", unit:"pcs", formula:"perLength_spacing", spacingCm:100, plusOne:true, confirmed:false,
        note:"Assumed same 1m spacing as curtain track — confirm with Silva" },
    ]
  },
  grabber_piece: {
    label: "Grabber Rail (finished piece)",
    components: [
      { key:"endBracket", label:"End Bracket", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Grabber rail may ship with brackets included — confirm whether these need separate stock" },
    ]
  },
  wooden_pole: {
    label: "Wooden pole",
    components: [
      { key:"ring",    label:"Wooden Ring", unit:"pcs", formula:"unknown", confirmed:false,
        note:"Rings needed per width not yet quantified — flag for Silva" },
      { key:"bracket", label:"Pole Bracket", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Placeholder (2 per pole) — confirm with Silva" },
      { key:"finial",  label:"Finial (pair)", unit:"pcs", formula:"fixed", qty:2, confirmed:false,
        note:"Placeholder (1 pair per pole) — confirm with Silva" },
    ]
  },
  roller_bracket: {
    label: "Roller/blind bracket (no rail)",
    components: [
      { key:"bracket", label:"Roller Bracket", unit:"pcs", formula:"fixed", qty:2, confirmed:true,
        note:"Standard pair per blind" },
    ]
  },
};

// Per-exact-itemCode overrides — empty for now. Add entries here once Silva
// confirms a specific rail's hardware differs from its category default,
// e.g. TRACK_HARDWARE_RECIPES["IT461"] = { components:[...] } if Movelite
// ever turns out to need a different belt/runner spec than Glydea.
const TRACK_HARDWARE_RECIPES = {};

// Returns the recipe (component list) that applies to a given flat window/layer.
function getHardwareRecipeForWindow(w) {
  if (!w || !w.railType) return null;
  const stock = w.railItemCode ? getTrackStock(w.railItemCode) : getTrackStockByLabel(w.railType);
  if (!stock || !stock.railCategory) return null;
  if (w.railItemCode && TRACK_HARDWARE_RECIPES[w.railItemCode]) return TRACK_HARDWARE_RECIPES[w.railItemCode];
  return HARDWARE_RECIPE_DEFAULTS[stock.railCategory] || null;
}

// Explodes one window/layer into its hardware component list.
// Returns [] if the rail has no recipe (e.g. no railType set yet).
// Each result: { key, label, unit, qty (number or null if 'unknown'), confirmed, note }
function explodeWindowHardware(w) {
  const recipe = getHardwareRecipeForWindow(w);
  if (!recipe) return [];
  const trackLengthCm = (w.calc && w.calc.trackLength) ? w.calc.trackLength : (w.width + ((w.overhang || 0) * 2));
  const trackLengthM  = trackLengthCm / 100;
  const results = [];
  recipe.components.forEach(c => {
    if (c.onlyIf === 'motorized' && !w.motorized) return;
    let qty = null;
    if (c.formula === 'fixed')                  qty = c.qty;
    else if (c.formula === 'perLength_count')   qty = Math.ceil(trackLengthM * c.perMetre);
    else if (c.formula === 'perLength_spacing') qty = Math.ceil(trackLengthCm / c.spacingCm) + (c.plusOne ? 1 : 0);
    else if (c.formula === 'lengthMatch')       qty = parseFloat(trackLengthM.toFixed(2));
    else if (c.formula === 'unknown')           qty = null;
    results.push({ key:c.key, label:c.label, unit:c.unit, qty, confirmed:!!c.confirmed, note:c.note || null });
  });
  return results;
}

// ═══════════════════════════════════════
// FABRIC CALCULATION ENGINE
// Lives in curtain.js as calcFabricWithHems() — the real calc sheet formula,
// wired to Silva's Save button. data.js no longer runs its own calc engine;
// windows here only carry calcDone + input fields. curtain.js hydrates
// w.calc on load for any window already marked calcDone (seed/historical
// data), and recomputes live whenever a window schedule renders.
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// CURTAIN DASHBOARD KPIs
// Quantity-only — no cost figures. Cost/budget data lives in job.bom for
// the Operations module to use elsewhere; the Curtain module never renders it.
// ═══════════════════════════════════════
function getCurtainKPIs() {
  const kpis = {
    totalRunningJobs: 0,
    totalItemsToProduce: 0,
    awaitingBOM: 0,
    awaitingBudget: 0,
    materialOverage: 0,       // jobs with fabric or track actual exceeding the quote estimate
    fabricOrdersPending: 0,   // purchase inquiries not yet received by Curtain
    fabricArrivedAwaitingReceipt: 0, // arrived in Bahrain but not yet handed to Curtain
    productionInProgress: 0,
    installationPending: 0,
    windowsBehindSchedule: 0  // planned labour.endDate passed, item not yet Ready/Installed
  };

  curtainJobs.forEach(job => {
    // Running jobs = any job not marked complete
    if (job.status !== 'complete') {
      kpis.totalRunningJobs++;
      // Total items = physical windows (qty-weighted) in non-complete jobs
      kpis.totalItemsToProduce += (job.windows ? job.windows.reduce((s, w) => s + (w.qty || 1), 0) : 0);

      // Stage-vs-Plan — only meaningful for jobs actively running
      kpis.windowsBehindSchedule += getBehindScheduleWindows(job).length;
    }

    if (job.bomStatus === "bom_pending")   kpis.awaitingBOM++;
    if (job.budgetStatus === "pending")    kpis.awaitingBudget++;

    // Material overage — actual (Silva's calc) exceeding the quote's estimate
    const materialAlerts = getCurtainMaterialAlerts(job);
    if (materialAlerts.length > 0) kpis.materialOverage++;

    if (job.status === "execution") kpis.productionInProgress++;
    if (job.installation && job.installation.status === "pending" && job.status === "execution") kpis.installationPending++;
  });

  // Purchase inquiries — global entity, not per-job
  purchaseInquiries.forEach(pi => {
    if (pi.stage !== "received_by_curtain") kpis.fabricOrdersPending++;
    if (pi.stage === "arrived_bahrain") kpis.fabricArrivedAwaitingReceipt++;
  });

  return kpis;
}

// ═══════════════════════════════════════
// STAGE-VS-PLAN — behind schedule detection
// Zero new data entry: compares each window's planned labour.endDate
// (already entered in the WIP tab) against its actual current stage
// (already recorded every time Mark Complete is tapped). A window is
// "behind" if its planned end date has passed and it hasn't reached
// Ready/Installed yet. Deliberately simple — no interim checkpoint
// tracking, just planned-done-by vs actually-done.
// ═══════════════════════════════════════
function getBehindScheduleWindows(job) {
  if (!job.windows) return [];
  ensureItemCards(job);
  const today = todayStr();
  return job.windows
    .filter(w => {
      const card = job.itemCards[w.id];
      if (!card || !card.labour || !card.labour.endDate) return false;
      if (card.stage === 'Ready' || card.stage === 'Installed') return false;
      return daysBetween(card.labour.endDate, today) > 0;
    })
    .map(w => ({ w, card: job.itemCards[w.id] }));
}

// ═══════════════════════════════════════
// CURTAIN MATERIAL OVERAGE ALERTS
// Flags windows where Silva's actual calc sheet exceeds the quote's
// estimate — needs Operations Manager sign-off before production proceeds.
// Fabric: quote's quoteEstimateMetres (reference) vs calc.totalMetres (actual).
// Track: window width + overhang*2 (the estimate, same formula the calc
// sheet itself defaults to) vs calc.trackLength (actual — may differ if
// Silva has overridden the track length on the calc sheet).
// ═══════════════════════════════════════
function getCurtainMaterialAlerts(job) {
  const alerts = [];
  if (!job.windows) return alerts;

  job.windows.forEach(w => {
    if (!w.calcDone || !w.calc) return;

    // Fabric overage
    if (w.quoteEstimateMetres != null && w.calc.totalMetres > w.quoteEstimateMetres) {
      alerts.push({
        cat: "Fabric",
        windowLabel: w.label, room: w.room,
        estimated: w.quoteEstimateMetres, actual: w.calc.totalMetres,
        overBy: parseFloat((w.calc.totalMetres - w.quoteEstimateMetres).toFixed(2)),
        unit: "m"
      });
    }

    // Track overage — only for windows that actually carry a track/rail
    if (w.calc.trackLength) {
      const estimatedTrackCm = w.width + ((w.overhang || 0) * 2);
      if (w.calc.trackLength > estimatedTrackCm) {
        alerts.push({
          cat: "Track",
          windowLabel: w.label, room: w.room,
          estimated: parseFloat((estimatedTrackCm / 100).toFixed(2)), actual: parseFloat((w.calc.trackLength / 100).toFixed(2)),
          overBy: parseFloat(((w.calc.trackLength - estimatedTrackCm) / 100).toFixed(2)),
          unit: "m"
        });
      }
    }
  });

  return alerts;
}

// ═══════════════════════════════════════
// CURTAIN ROOM SUMMARY
// Groups windows by room for collapsed view
// ═══════════════════════════════════════
function getWindowsByRoom(job) {
  const rooms = {};
  job.windows.forEach(w => {
    if (!rooms[w.room]) rooms[w.room] = [];
    rooms[w.room].push(w);
  });
  return rooms;
}

// ═══════════════════════════════════════
// WINDOW COPY HELPER
// Returns a new window object copied from source
// ═══════════════════════════════════════
function copyWindow(sourceWindow, newId, newLabel) {
  return {
    ...JSON.parse(JSON.stringify(sourceWindow)),
    id: newId,
    windowGroup: null, groupRole: null, // copies are independent physical windows, not linked layers
    label: newLabel || sourceWindow.label + " (copy)",
    calc: null // will be recalculated
  };
}



// ═══════════════════════════════════════
// PROJECTS (live jobs — Operations module)
// ═══════════════════════════════════════
// Fixture projects cleared (6 Aug 2026, same pass as the curtain-jobs
// fixtures — these were the SAME demo jobs viewed from Operations' side).
// projects[] is a DERIVED rollup now: entries are (re)created for every
// real Job Card by bridgeAllJobCards()/bridgeJobToOperationsAndCurtain()
// on load and at confirm time, so this array intentionally has no seed
// and no cloud table of its own.
const projects=[];

let currentJob = null;
let currentCurtainJob = null;

// ═══════════════════════════════════════
// BOM JOBS (Operations module)
// ═══════════════════════════════════════
const bomJobs=[
  {id:"AMD-15010",name:"Majlis Refurbishment",client:"Ahmed Omar",val:4200,
   depts:[
     {k:"carp",pm:"Arun Kumar",bom:{mat:840,lab:900,oth:220},status:"overdue",owner:"pm",delegate:null},
     {k:"uph",pm:"Karthik Silva",bom:{mat:320,lab:260,oth:80},status:"pending",owner:"pm",delegate:null}
   ]},
  {id:"AMD-14933",name:"Showroom Door Unit",client:"Al Maraya Decor",val:6800,
   depts:[
     {k:"carp",pm:"Arun Kumar",bom:{mat:1800,lab:1400,oth:300},status:"submitted",owner:"pm",delegate:null},
     {k:"metal",pm:"Silva",bom:{mat:600,lab:400,oth:160},status:"delegated",owner:"delegated",delegate:{to:"Karthik Silva",deadline:"Today 5pm"}},
     {k:"paint",pm:"Karthik Silva",bom:{mat:200,lab:150,oth:100},status:"pending",owner:"pm",delegate:null}
   ]},
  {id:"AMD-15002",name:"Villa 5 Fit-out",client:"Discovery Dev",val:8450,
   depts:[
     {k:"carp",pm:"Arun Kumar",bom:{mat:1200,lab:1100,oth:300},status:"submitted",owner:"ops",delegate:null},
     {k:"curt",pm:"Silva",bom:{mat:600,lab:400,oth:100},status:"submitted",owner:"pm",delegate:null},
     {k:"uph",pm:"Karthik Silva",bom:{mat:500,lab:380,oth:120},status:"submitted",owner:"pm",delegate:null}
   ]}
];

// ═══════════════════════════════════════
// DELIVERY CHECKLIST
// ═══════════════════════════════════════
const checks=[
  {l:"All items QC signed off by PM",n:"Production manager confirms finished to spec",done:true},
  {l:"Items packed and protected",n:"Foam, blankets, strapping — no bare edges",done:true},
  {l:"Delivery note prepared",n:"Itemised list matching job card",done:true},
  {l:"Client notified of delivery time",n:"Confirmed appointment with site contact",done:true},
  {l:"Vehicle and team assigned",n:"Team A, 3-ton truck",done:true},
  {l:"Site access confirmed",n:"Keys / access code / security",done:true},
  {l:"Installation tools loaded",n:"Drills, fixings, level, touch-up paint",done:false},
  {l:"Client sign-off form printed",n:"Physical form for signature on delivery",done:false},
];

// ═══════════════════════════════════════
// CAPACITY HEATMAP
// ═══════════════════════════════════════
const weeks=["2–6 Jun","9–13 Jun","16–20 Jun","23–27 Jun","30J–4Jul","7–11 Jul"];
const cap=[{n:"Carpentry",l:[4,4,3,2,1,1]},{n:"Painting",l:[3,2,2,1,2,1]},{n:"Upholstery",l:[1,1,2,1,0,0]},{n:"Curtain",l:[2,1,0,1,2,1]},{n:"Metal",l:[3,2,1,0,0,1]}];
const hstyles=["background:#e8f5e9;color:#2e7d32","background:#c8e6c9;color:#1b5e20","background:#fff3e0;color:#e65100","background:#ffe0b2;color:#bf360c","background:#ffcdd2;color:#b71c1c","background:#d9342b;color:#fff"];
const hl=["Free","Light","Mod","Heavy","~Full","FULL"];

// ═══════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════
const reminders=[
  {icon:"🔔",type:"BOM reminder",to:"Arun Kumar",msg:"Joinery BOM for Majlis Refurbishment overdue — please submit urgently",sent:"Today 9:00am",channel:"In-app + WhatsApp",acted:false},
  {icon:"📧",type:"Invoice reminder",to:"Accounts",msg:"Progress invoice for Villa 5 Fit-out not yet raised — job is 60% complete",sent:"Today 8:45am",channel:"In-app",acted:false},
  {icon:"🔔",type:"Supplier chase",to:"Gulf Glass Trading",msg:"PO for glass panels overdue — please confirm delivery date",sent:"Yesterday 4pm",channel:"WhatsApp",acted:false},
  {icon:"✅",type:"Budget approval",to:"Salman Abdullah",msg:"Showroom Door Unit budget BD 4,760 submitted for approval",sent:"Yesterday 2pm",channel:"In-app + WhatsApp",acted:true},
  {icon:"🔔",type:"Delegation alert",to:"Karthik Silva",msg:"Please fill Metal Works BOM for Showroom Door Unit — deadline today 5pm",sent:"Today 8:00am",channel:"In-app + WhatsApp",acted:false},
];
function renderReminders(){
  document.getElementById("rem-list").innerHTML=reminders.map((r,i)=>`
    <div class="rem-item" style="${r.acted?"opacity:.5":""}">
      <div class="rem-icon" style="background:${r.acted?"var(--ok-bg)":"var(--info-bg)"};">${r.icon}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${r.type} → ${r.to}</div>
        <div style="font-size:12px;color:var(--ink2);margin:2px 0;">${r.msg}</div>
        <div style="font-size:11px;color:var(--ink3);margin:3px 0;">${r.sent} · ${r.channel} · ${r.acted?'<span style="color:var(--ok);font-weight:600;">Acted on</span>':'<span style="color:var(--warn);">No response yet</span>'}</div>
      </div>
      ${!r.acted?`<button class="sm warn" onclick="resendReminder(${i})">Resend</button>`:""}
    </div>`).join("");
}
function resendReminder(i){
  showAlert("Reminder resent to "+reminders[i].to);
  reminders[i].sent="Just now";
  renderReminders();
}
renderReminders();

// ═══════════════════════════════════════
// PURCHASER MODULE — Purchase Request → Purchase Order → Purchase Invoice
// Built session: 5 Jul 2026
//
// SCOPE: covers all departments EXCEPT Curtain fabric ordering — Curtain's
// fabric/track requests are tracked separately via purchaseInquiries[]
// above (Silva's tracker, unchanged, do not touch). This system is for
// Upholstery, Joinery (incl. Painting), Metal Works, and general/stock
// purchasing — anything that isn't a curtain fabric/rail order.
//
// WORKFLOW: a department can only RAISE A REQUEST (purchaseRequests[]).
// Only the Purchaser converts a request into an actual Purchase Order.
// Every PO must be approved by Operations Manager or Owner before it can
// be converted into a Purchase Invoice on goods receipt. Conversion
// functions carry line items/supplier/job forward so nothing gets
// retyped between stages.
//
// FIELD NAMES on purchaseOrders[]/purchaseInvoices[] match the existing
// Q-Pro Purchase Order / Purchase Invoice print formats word-for-word
// (Supplier Name/Tel, Supplier Ref, Product/Service, FxRate (BD), etc.)
// so these feel identical to what Salman/the Purchaser already know.
//
// ID NOTE: Q-Pro's own Purchase Invoice also uses prefix "PI-" — but that
// collides with purchaseInquiries[] IDs (PI-0001 etc.) already in this
// file. Purchase Invoices here use prefix "INV-" instead. PR- and PO-
// were free, so those match Q-Pro as-is.
//
// JOB LINKING: linkedJobId always uses this system's own AMD-XXXXX job ID
// (matches projects[].id / curtainJobs[].id — the real link for all
// lookups/joins). qproJobRef is a display-only text field for the old
// Q-Pro job number (e.g. "JB26AMD02242"), kept only for cross-checking
// during the Q-Pro transition — never used in lookups or joins, safe to
// leave blank or drop later.
//
// DEPARTMENTS reuse the existing DEPTS keys (carp/paint/uph/curt/metal)
// rather than inventing a new enum. Painting rolls up into the Joinery
// KPI bucket on the dashboard (Salman's call, 5 Jul 2026) — "paint"
// stays its own DEPTS key underneath so nothing else that reads DEPTS
// breaks; the rollup only happens inside getPurchasingKPIs() below.
// ═══════════════════════════════════════

const purchaseRequests = [];

function nextPRId() {
  return "PR-" + String(purchaseRequests.length + 1).padStart(4, "0") + "-AMD";
}

// Matches Q-Pro's own three-way split (Inventory / Job / Others) across
// Purchase Request, Purchase Order, and Purchase Invoice alike — kept as one
// generic form with a Destination selector rather than 9 separate menu
// entries (Q-Pro's literal structure), since the fields are identical either
// way; a deliberate simplification, not a missed detail.
// destinationType: "inventory" (shared stock pool) | "job-direct" (issued
// straight to a job) | "others" (misc, non-stock non-job — e.g. office
// supplies). Internal `type` values stay "Stock"/"Job"/"Others" — only
// "Stock" ever triggers the stockEntries pool logic below.
function destinationTypeToType(destinationType) {
  if (destinationType === "job-direct") return "Job";
  if (destinationType === "others") return "Others";
  return "Stock";
}

function raisePurchaseRequest({ department, raisedBy, linkedJobId = null, destinationType, items, division = null }) {
  const pr = {
    id: nextPRId(),
    division,              // Q-Pro's own "Division" field on Purchase Request (Job) — optional, display-only here
    department,            // one of DEPTS keys: carp, paint, uph, curt, metal
    raisedBy,
    dateRaised: new Date().toISOString().slice(0, 10),
    linkedJobId,           // AMD-XXXXX or null
    destinationType,       // "inventory" | "job-direct"
    items,                 // [{ name, qty, unit, itemRef, remarks }] — itemRef is optional: { id, label } for a
                            // Curtain window/opening, or a free-text string for other divisions
    status: "open"         // open | converted | cancelled — PRs never require approval
  };
  purchaseRequests.push(pr);
  logActivity({ type: "pr-raised", linkedType: pr.linkedJobId ? "job" : "pr", linkedId: pr.linkedJobId || pr.id, user: raisedBy, message: `Purchase Request ${pr.id} raised (${dc(department).n})${pr.linkedJobId ? ` for job ${pr.linkedJobId}` : ""}` });
  return pr;
}

// ═══════════════════════════════════════
// SUPPLIER MASTER (Masters → Accounts → Vendor / Supplier_master)
// The ONE canonical supplier list — every PO / Purchase Invoice / Payment /
// Debit Note lookup reads from here. The real Q-Pro system also has a
// second, vestigial "Inventory → Vendor" list (internally "Stock Group",
// just Name+Status) that no transaction actually reads from — that
// duplication is deliberately NOT replicated; this is the only master.
// ═══════════════════════════════════════
const suppliers = [];
const SUPPLIER_COUNTRIES = ["Bahrain", "Saudi Arabia", "UAE", "Kuwait", "Qatar", "Oman", "Other"];
const SUPPLIER_TAX_PERCENTS = [0, 5, 10];
const CASH_LEDGERS = ["Cash", "Bank - BBK Current", "Bank - NBB Current", "Petty Cash"];

function nextSupplierId() {
  return "SUP-" + String(suppliers.length + 1).padStart(4, "0");
}

function createSupplier({
  name, contactPerson, telephone, telephone2 = "", email = "", fax = "",
  vatName = "", vatNo = "", taxPercent = 10, isCredit = false, creditLimit = 0,
  creditDays = 0, bankAccountNumber = "", bankAccountHolderName = "", ibanNumber = "",
  bankSwift = "", bankName = "", bankBranch = "", address, crNo = "",
  country = "Bahrain", openingBalance = 0
} = {}) {
  if (!name || !name.trim()) return { error: "Name is required." };
  if (!contactPerson || !contactPerson.trim()) return { error: "Contact Person is required." };
  if (!telephone || !telephone.trim()) return { error: "Telephone is required." };
  if (!address || !address.trim()) return { error: "Address is required." };
  const supplier = {
    id: nextSupplierId(),
    name: name.trim(), contactPerson: contactPerson.trim(), telephone: telephone.trim(),
    telephone2, email, fax, vatName, vatNo, taxPercent: Number(taxPercent) || 0,
    isCredit: !!isCredit, creditLimit: Number(creditLimit) || 0, creditDays: Number(creditDays) || 0,
    bankAccountNumber, bankAccountHolderName, ibanNumber, bankSwift, bankName, bankBranch,
    address: address.trim(), crNo, country, openingBalance: Number(openingBalance) || 0,
    dateCreated: new Date().toISOString().slice(0, 10)
  };
  suppliers.push(supplier);
  return supplier;
}

function updateSupplier(supplierId, patch) {
  const s = suppliers.find(x => x.id === supplierId);
  if (!s) return null;
  Object.assign(s, patch);
  return s;
}

const purchaseOrders = [];

function nextPOId() {
  return "PO-" + String(purchaseOrders.length + 1).padStart(4, "0") + "-AMD";
}

// Converts a Purchase Request into a Purchase Order. Carries the items and
// job link forward automatically — the Purchaser only fills in supplier
// and pricing details, matching the Q-Pro PO creation form field-for-field.
function convertPRtoPO(prId, supplierDetails = {}) {
  const pr = purchaseRequests.find(p => p.id === prId);
  if (!pr) return null;
  const po = {
    id: nextPOId(),
    sourcePR: pr.id,
    department: pr.department,   // stamped directly so approvals/KPIs never need a sourcePR lookup
    date: new Date().toISOString().slice(0, 10),
    company: "Al Maraya Decor",
    paymentMode: supplierDetails.paymentMode || "Cash",
    supplierId: supplierDetails.supplierId || null,
    supplierNameTel: supplierDetails.supplierNameTel || "",
    supplierRef: supplierDetails.supplierRef || "",
    cashLedger: supplierDetails.cashLedger || null,
    purchaseRequest: pr.id,
    type: destinationTypeToType(pr.destinationType),
    linkedJobId: pr.linkedJobId,
    qproJobRef: null,
    currency: "Bahraini Dinar",
    exRate: 1,
    deliveryTerms: "",
    supplyAddress: "",
    items: pr.items.map(it => ({
      productService: it.name,
      qty: it.qty,
      unit: it.unit,
      itemRef: it.itemRef || null,   // optional { id, label } window/item allocation tag, or free text
      itemId: it.itemId || null,     // real Item Master reference (Inventory-type only) — feeds Stock Report/Job Material Requirement
      fxRateBD: 0,
      amountBD: 0,
      discountBD: 0,
      vatPercent: 10,
      vatBD: 0,
      netAmountBD: 0,
      ledger: "Purchase"
    })),
    approvalStatus: "pending",   // pending | approved | rejected
    approvedBy: null,
    approvalDate: null,
    rejectionComment: null,
    preparedBy: supplierDetails.preparedBy || null,
    status: "draft"              // draft | issued | invoiced
  };
  purchaseOrders.push(po);
  pr.status = "converted";
  return po;
}

// Creates a Purchase Order directly, with no Purchase Request behind it.
// Same shape/approval gate as a converted PO (sourcePR stays null) — per
// Salman's call (5 Jul 2026): PRs never require approval, but every PO
// does, regardless of whether it came from a PR or was raised directly.
function createPurchaseOrderDirect({ department, linkedJobId = null, destinationType = "inventory", supplierDetails = {}, items }) {
  const po = {
    id: nextPOId(),
    sourcePR: null,
    department,
    date: new Date().toISOString().slice(0, 10),
    company: "Al Maraya Decor",
    paymentMode: supplierDetails.paymentMode || "Cash",
    supplierId: supplierDetails.supplierId || null,
    supplierNameTel: supplierDetails.supplierNameTel || "",
    supplierRef: supplierDetails.supplierRef || "",
    cashLedger: supplierDetails.cashLedger || null,
    purchaseRequest: null,
    type: destinationTypeToType(destinationType),
    linkedJobId,
    qproJobRef: null,
    currency: "Bahraini Dinar",
    exRate: supplierDetails.exRate || 1,
    deliveryTerms: supplierDetails.deliveryTerms || "",
    supplyAddress: supplierDetails.supplyAddress || "",
    items: items.map(it => ({
      productService: it.name,
      qty: it.qty,
      unit: it.unit,
      itemRef: it.itemRef || null,
      itemId: it.itemId || null,
      fxRateBD: it.fxRateBD || 0,
      amountBD: 0,
      discountBD: it.discountBD || 0,
      vatPercent: it.vatPercent || 10,
      vatBD: 0,
      netAmountBD: 0,
      ledger: "Purchase"
    })),
    approvalStatus: "pending",
    approvedBy: null,
    approvalDate: null,
    rejectionComment: null,
    preparedBy: supplierDetails.preparedBy || null,
    status: "draft"
  };
  purchaseOrders.push(po);
  logActivity({ type: "po-created", linkedType: po.linkedJobId ? "job" : "po", linkedId: po.linkedJobId || po.id, user: po.preparedBy || "Purchasing", message: `PO ${po.id} created (${dc(po.department).n})${po.linkedJobId ? ` for job ${po.linkedJobId}` : ""}` });
  return po;
}

// Approval gate — nothing downstream (convertPOtoInvoice) will accept a PO
// that hasn't been through this. Restrict calling this in the UI to
// Operations Manager / Owner logins.
function approvePO(poId, approvedBy) {
  const po = purchaseOrders.find(p => p.id === poId);
  if (!po) return null;
  po.approvalStatus = "approved";
  po.approvedBy = approvedBy;
  po.approvalDate = new Date().toISOString().slice(0, 10);
  po.status = "issued";
  logActivity({ type: "po-approved", linkedType: po.linkedJobId ? "job" : "po", linkedId: po.linkedJobId || po.id, user: approvedBy, message: `PO ${po.id} approved and issued` });
  return po;
}
function rejectPO(poId, rejectedBy, comment) {
  const po = purchaseOrders.find(p => p.id === poId);
  if (!po) return null;
  po.approvalStatus = "rejected";
  po.approvedBy = rejectedBy;
  po.approvalDate = new Date().toISOString().slice(0, 10);
  po.rejectionComment = comment;
  logActivity({ type: "po-rejected", linkedType: po.linkedJobId ? "job" : "po", linkedId: po.linkedJobId || po.id, user: rejectedBy, message: `PO ${po.id} rejected — ${comment || "no comment"}` });
  return po;
}
function getPendingPOApprovals() {
  return purchaseOrders.filter(po => po.approvalStatus === "pending");
}

const purchaseInvoices = [];

function nextInvoiceId() {
  return "INV-" + String(purchaseInvoices.length + 1).padStart(4, "0") + "-AMD";
}

// Converts an APPROVED Purchase Order into a Purchase Invoice on goods
// receipt. Refuses to convert an unapproved PO — the approval gate is
// enforced here in code, not just hidden in the UI.
function convertPOtoInvoice(poId, receiptDetails = {}) {
  const po = purchaseOrders.find(p => p.id === poId);
  if (!po) return null;
  if (po.approvalStatus !== "approved") {
    return { error: "PO must be approved before it can be invoiced." };
  }
  const inv = {
    id: nextInvoiceId(),
    sourcePO: po.id,
    department: po.department,
    type: po.type,
    dateReceived: new Date().toISOString().slice(0, 10),
    supplierId: po.supplierId || null,
    supplierNameTel: po.supplierNameTel,
    supplierRef: receiptDetails.supplierRef || "",   // vendor's own invoice number
    linkedJobId: po.linkedJobId,
    qproJobRef: null,
    items: (receiptDetails.items || po.items).map(it => ({
      itemName: it.productService || it.itemName,
      qty: it.qty,
      itemRef: it.itemRef || null,
      itemId: it.itemId || null,
      rateBD: it.rateBD || 0,
      discBD: it.discBD || 0,
      vatPercent: it.vatPercent || 10,
      amtBD: it.amtBD || 0
    })),
    totals: receiptDetails.totals || { total: 0, vat: 0, roundOff: 0, netAmount: 0 },
    otherExpenseAmount: 0,
    paidAmount: 0,
    preparedBy: receiptDetails.preparedBy || null,
    // A PO-converted invoice is already gated — its PO went through approval
    // before it could reach "issued". Auto-approved here so it never shows
    // up in the Approvals tab a second time.
    approvalStatus: "approved",
    approvedBy: po.approvedBy,
    approvalDate: new Date().toISOString().slice(0, 10),
    rejectionComment: null,
    status: "received"
  };
  purchaseInvoices.push(inv);
  po.status = "invoiced";
  logActivity({ type: "purchase-invoice-received", linkedType: inv.linkedJobId ? "job" : "purchase-invoice", linkedId: inv.linkedJobId || inv.id, user: "Purchasing", message: `Purchase Invoice ${inv.id} received against PO ${po.id}` });

  // If this order was Stock-type (not job-direct), the received items land
  // in the shared inventory pool, awaiting the (future) Storekeeper screen.
  if (po.type === "Stock") {
    inv.items.forEach(it => {
      stockEntries.push({
        id: "STK-" + String(stockEntries.length + 1).padStart(4, "0"),
        sourceInvoice: inv.id,
        itemName: it.itemName,
        qty: it.qty,
        unit: "",
        status: "in-pool",     // in-pool | released
        releasedTo: null,
        dateReceived: inv.dateReceived
      });
      // Item Master items (as opposed to free-text stock names) also move
      // the real Item Master ledger — matches the Batch 2 note that only
      // "Inventory type" transactions referencing a real item affect the
      // Stock Report/Job Material Requirement.
      if (it.itemId) {
        const master = itemMaster.find(i => i.id === it.itemId);
        if (master) {
          master.closingStock = (master.closingStock || 0) + it.qty;
          master.lastPurchaseRate = it.rateBD || master.lastPurchaseRate;
        }
      }
    });
  }
  return inv;
}

// Creates a Purchase Invoice directly, with no Purchase Order behind it.
// Unlike a PO-converted invoice (auto-approved because its PO already went
// through approval), a direct invoice has never been gated by anything —
// so per Salman's call (5 Jul 2026) it needs its own approval before the
// items are treated as received / released to the stock pool.
//
// Two-stage flow (matches the real Q-Pro Purchase Invoice screen, minus its
// bugs): Submit lands here in "draft" — an edit view with an Other Expenses
// field. Confirm (confirmPurchaseInvoiceDraft below) moves it to
// "pending_approval" so it actually enters the Owner/Ops approval queue.
function createPurchaseInvoiceDirect({ department, linkedJobId = null, destinationType = "inventory", supplierDetails = {}, items, preparedBy, sourcePOSearch = null }) {
  const inv = {
    id: nextInvoiceId(),
    sourcePO: null,
    sourcePOSearch,               // PO id entered via "Search PO Number" + Locate, informational only
    department,
    type: destinationTypeToType(destinationType),
    dateReceived: new Date().toISOString().slice(0, 10),
    supplierId: supplierDetails.supplierId || null,
    supplierNameTel: supplierDetails.supplierNameTel || "",
    supplierRef: supplierDetails.supplierRef || "",
    linkedJobId,
    qproJobRef: null,
    items: items.map(it => ({
      itemName: it.name,
      qty: it.qty,
      itemRef: it.itemRef || null,
      itemId: it.itemId || null,
      rateBD: it.rateBD || 0,
      discBD: it.discBD || 0,
      vatPercent: it.vatPercent || 10,
      amtBD: it.amtBD || 0
    })),
    totals: supplierDetails.totals || { total: 0, vat: 0, roundOff: 0, netAmount: 0 },
    otherExpenseAmount: 0,
    paidAmount: 0,
    preparedBy: preparedBy || null,
    approvalStatus: "pending",   // pending | approved | rejected
    approvedBy: null,
    approvalDate: null,
    rejectionComment: null,
    status: "draft"   // draft (post-Submit, pre-Confirm) | pending_approval | received
  };
  purchaseInvoices.push(inv);
  return inv;
}

// Stage 2 of the Purchase Invoice flow — clicking "Confirm" on the draft
// view. Adds Other Expenses into the total and pushes the invoice into the
// real approval queue. Before this, the invoice sits in "draft" and does
// NOT show up in Approvals — matching the real form's draft/edit step.
function confirmPurchaseInvoiceDraft(invId, { otherExpenseAmount = 0 } = {}) {
  const inv = purchaseInvoices.find(i => i.id === invId);
  if (!inv) return null;
  if (inv.status !== "draft") return { error: "Only a draft invoice can be confirmed." };
  inv.otherExpenseAmount = Number(otherExpenseAmount) || 0;
  const base = inv.totals.netAmount || inv.totals.total || 0;
  inv.totals.netAmount = base + inv.otherExpenseAmount;
  inv.status = "pending_approval";
  return inv;
}

// Approval gate for direct invoices (mirrors approvePO/rejectPO). Only on
// approval do Stock-type items get released into the shared inventory pool
// — matches the same rule convertPOtoInvoice already follows.
function approveInvoice(invId, approvedBy) {
  const inv = purchaseInvoices.find(i => i.id === invId);
  if (!inv) return null;
  inv.approvalStatus = "approved";
  inv.approvedBy = approvedBy;
  inv.approvalDate = new Date().toISOString().slice(0, 10);
  inv.status = "received";
  if (inv.type === "Stock") {
    inv.items.forEach(it => {
      stockEntries.push({
        id: "STK-" + String(stockEntries.length + 1).padStart(4, "0"),
        sourceInvoice: inv.id,
        itemName: it.itemName,
        qty: it.qty,
        unit: "",
        status: "in-pool",
        releasedTo: null,
        dateReceived: inv.dateReceived
      });
      if (it.itemId) {
        const master = itemMaster.find(i => i.id === it.itemId);
        if (master) {
          master.closingStock = (master.closingStock || 0) + it.qty;
          master.lastPurchaseRate = it.rateBD || master.lastPurchaseRate;
        }
      }
    });
  }
  return inv;
}
function rejectInvoice(invId, rejectedBy, comment) {
  const inv = purchaseInvoices.find(i => i.id === invId);
  if (!inv) return null;
  inv.approvalStatus = "rejected";
  inv.approvedBy = rejectedBy;
  inv.approvalDate = new Date().toISOString().slice(0, 10);
  inv.rejectionComment = comment;
  return inv;
}
function getPendingInvoiceApprovals() {
  // A "draft" invoice hasn't been Confirmed yet — it doesn't enter the
  // approval queue until confirmPurchaseInvoiceDraft() flips it to
  // "pending_approval".
  return purchaseInvoices.filter(inv => inv.approvalStatus === "pending" && inv.status === "pending_approval");
}
function getDraftInvoices() {
  return purchaseInvoices.filter(inv => inv.status === "draft");
}

// ═══════════════════════════════════════
// SUPPLIER PAYMENT
// The real Q-Pro Payment screen has three confirmed, reproducible bugs:
// (1) the invoice-allocation table always shows "No Invoice List
//     Available..!" even for a vendor with a confirmed open invoice,
// (2) the Cash method's "Select" checkbox freezes the tab 30+ seconds,
// (3) "Create Payment" freezes the tab and the payment is never actually
//     created (never appears in the list afterwards).
// Per Salman's instruction these are genuine client-side defects to be
// FIXED here, not reproduced — getVendorOpenInvoices() below actually looks
// the invoices up, and createPayment() actually persists the record.
// ═══════════════════════════════════════
const payments = [];

function nextPaymentId() {
  return "PAY-" + String(payments.length + 1).padStart(4, "0") + "-AMD";
}

// Returns { invoiceId, invoiceDate, invoiceAmount, paidAmount, balanceAmount }
// rows for every received invoice of this vendor that still has a balance —
// this is the exact table the real system fails to populate.
function getVendorOpenInvoices(supplierId) {
  return purchaseInvoices
    .filter(inv => inv.supplierId === supplierId && inv.status === "received")
    .map(inv => {
      const invoiceAmount = (inv.totals && inv.totals.netAmount) || 0;
      const paidAmount = inv.paidAmount || 0;
      const balanceAmount = Math.round((invoiceAmount - paidAmount) * 1000) / 1000;
      return { invoiceId: inv.id, invoiceDate: inv.dateReceived, invoiceAmount, paidAmount, balanceAmount };
    })
    .filter(row => row.balanceAmount > 0.0001);
}

function createPayment({
  supplierId, division = null, paymentDate = null, methods = {}, amount,
  referenceNumber = "", allocations = [], advanceAmount = 0, ledgerSplits = [], remarks = ""
}) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) return { error: "Please select a vendor." };
  if (!amount || Number(amount) <= 0) return { error: "Amount is required." };
  const payment = {
    id: nextPaymentId(),
    supplierId,
    division,
    paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
    methods,        // { cash:{enabled,amount}, cCard:{enabled,amount,type,authorized}, wallet:{enabled,amount,type,authorized}, cheque:{enabled,amount,number,bank} }
    amount: Number(amount),
    referenceNumber,
    allocations,    // [{ invoiceId, payingAmount, discountAmount }]
    advanceAmount: Number(advanceAmount) || 0,
    ledgerSplits,   // [{ ledger, amount, remarks }]
    remarks,
    status: "confirmed"
  };
  payments.push(payment);
  allocations.forEach(a => {
    const inv = purchaseInvoices.find(i => i.id === a.invoiceId);
    if (inv) inv.paidAmount = (inv.paidAmount || 0) + (Number(a.payingAmount) || 0);
  });
  return payment;
}

// ═══════════════════════════════════════
// DEBIT NOTE
// Real system reproduces the same freeze/non-persistence bug as Payment on
// submit (list stayed "No data available in table" afterward). Fixed here.
// ═══════════════════════════════════════
const debitNotes = [];
const DEBIT_NOTE_TAXABLE_TYPES = ["Taxable", "Non-Taxable", "Zero-Rated"];

function nextDebitNoteId() {
  return "DN-" + String(debitNotes.length + 1).padStart(4, "0") + "-AMD";
}

function createDebitNote({
  supplierId, division = null, ledger, debitNoteDate = null,
  taxableType = "Taxable", amount, reason = ""
}) {
  const supplier = suppliers.find(s => s.id === supplierId);
  if (!supplier) return { error: "Please select a vendor." };
  if (!ledger || !ledger.trim()) return { error: "Select Ledger is required." };
  if (!amount || Number(amount) <= 0) return { error: "Amount is required." };
  const dn = {
    id: nextDebitNoteId(),
    supplierId,
    division,
    ledger: ledger.trim(),
    debitNoteDate: debitNoteDate || new Date().toISOString().slice(0, 10),
    taxableType,
    amount: Number(amount),
    reason,
    status: "confirmed"
  };
  debitNotes.push(dn);
  return dn;
}

// ── INVENTORY STOCK POOL ──
// Populated automatically by convertPOtoInvoice() above for Stock-type
// orders. Release-to-department is the Storekeeper's screen — deferred to
// a later session. Entries just sit at "in-pool" until that screen exists.
const stockEntries = [];

// ── ITEM CARDS ──
// Flat, top-level — NOT nested inside job records, since jobs currently
// live in different arrays per module (projects[], curtainJobs[]) with no
// single unified job object yet. Same flat-list pattern as
// purchaseInquiries[]/timeLogs[] above. code format: "<jobId>-IT01",
// sequential per job (e.g. AMD-15002-IT01, AMD-15002-IT02).
const itemCards = [];

function nextItemCardCode(jobId) {
  const existing = itemCards.filter(ic => ic.jobId === jobId);
  return jobId + "-IT" + String(existing.length + 1).padStart(2, "0");
}
function issueItemCard(jobId, { description, qty, department, sourcePO = null, sourceStockEntry = null, itemRef = null }) {
  const card = {
    code: nextItemCardCode(jobId),
    jobId,
    description,
    qty,
    department,
    sourcePO,
    sourceStockEntry,
    itemRef,   // optional { id, label } window/item allocation tag, or free text — same shape as PR/PO/Invoice itemRef
    dateIssued: new Date().toISOString().slice(0, 10)
  };
  itemCards.push(card);
  return card;
}

// ── STOREKEEPER — release stock pool entries to departments ──
// Built session: 6 Jul 2026. Every release requires a job (Salman's call)
// so it always produces a traceable itemCard via issueItemCard() above.
// Supports partial release: if the released qty is less than the entry's
// full qty, the original entry keeps the remainder "in-pool" under its own
// id, and a NEW stock entry is created to carry the released portion — so
// "released" status always describes a fully-consumed record, never a
// part-consumed one.
function releaseStockEntry(entryId, { department, jobId, qty, issuedBy, itemRef = null }) {
  const entry = stockEntries.find(s => s.id === entryId);
  if (!entry) return { error: "Stock entry not found." };
  if (entry.status !== "in-pool") return { error: "This entry has already been released." };
  if (!jobId) return { error: "A job is required to release stock." };
  if (!issuedBy) return { error: "Issued-by name is required." };
  const releaseQty = Number(qty);
  if (!releaseQty || releaseQty <= 0) return { error: "Enter a quantity to release." };
  if (releaseQty > entry.qty) return { error: `Only ${entry.qty} ${entry.unit || ""} available in this entry.` };

  let releasedEntry;
  const today = new Date().toISOString().slice(0, 10);
  if (releaseQty === entry.qty) {
    entry.status = "released";
    entry.releasedTo = department;
    entry.releasedJobId = jobId;
    entry.dateReleased = today;
    entry.issuedBy = issuedBy;
    releasedEntry = entry;
  } else {
    entry.qty -= releaseQty; // remainder stays in-pool under the original id
    releasedEntry = {
      id: "STK-" + String(stockEntries.length + 1).padStart(4, "0"),
      sourceInvoice: entry.sourceInvoice,
      itemName: entry.itemName,
      qty: releaseQty,
      unit: entry.unit,
      status: "released",
      releasedTo: department,
      releasedJobId: jobId,
      dateReceived: entry.dateReceived,
      dateReleased: today,
      issuedBy
    };
    stockEntries.push(releasedEntry);
  }

  // Trace sourcePO through the invoice for the itemCard, since stock
  // entries only carry sourceInvoice, not sourcePO directly.
  const invoice = purchaseInvoices.find(i => i.id === releasedEntry.sourceInvoice);
  const sourcePO = invoice ? invoice.sourcePO : null;

  const card = issueItemCard(jobId, {
    description: releasedEntry.itemName,
    qty: releaseQty,
    department,
    sourcePO,
    sourceStockEntry: releasedEntry.id,
    itemRef
  });

  logActivity({ type: "stock-released", linkedType: "job", linkedId: jobId, user: issuedBy, message: `${releaseQty} ${releasedEntry.unit || ""} ${releasedEntry.itemName} released to ${dc(department).n} for job ${jobId}` });
  return { stockEntry: releasedEntry, itemCard: card };
}

// ── STOREKEEPER DASHBOARD SUMMARY ──
function getStockPoolSummary() {
  const inPool = stockEntries.filter(s => s.status === "in-pool");
  const today = new Date().toISOString().slice(0, 10);
  const releasedToday = stockEntries.filter(s => s.status === "released" && s.dateReleased === today);
  const releasedTotal = stockEntries.filter(s => s.status === "released");
  return {
    inPoolCount: inPool.length,
    inPoolQty: inPool.reduce((sum, s) => sum + s.qty, 0),
    distinctItemsInPool: new Set(inPool.map(s => s.itemName)).size,
    releasedTodayCount: releasedToday.length,
    releasedTotalCount: releasedTotal.length
  };
}

// ═══════════════════════════════════════
// STOCK ADJUSTMENT (Transactions → Inventory → Stock Adjustment)
// Only one Type ("Stock Adjustment") and one Location ("Location 1") exist
// in the real system — it is single-location/single-warehouse throughout,
// captured here as-is rather than building unused multi-location plumbing.
// Adjustment Reason is informational only (Q-Pro's own dropdown offers
// "Not Applicable"/"Issue"); qty is a signed delta the user enters directly
// (negative to reduce stock) rather than the Reason forcing a sign — kept
// simple and honest rather than guessing an unconfirmed business rule.
// ═══════════════════════════════════════
const stockAdjustments = [];
const STOCK_ADJUSTMENT_REASONS = ["Not Applicable", "Issue"];

function nextSANumber() {
  return "SA-" + String(stockAdjustments.length + 1).padStart(4, "0") + "-AMD";
}

function createStockAdjustment({ date = null, reason = "Not Applicable", items = [] } = {}) {
  if (!items.length) return { error: "Add at least one item." };
  const sa = {
    id: nextSANumber(),
    date: date || new Date().toISOString().slice(0, 10),
    type: "Stock Adjustment",
    location: "Location 1",
    reason,
    items: items.map(it => ({ itemId: it.itemId, itemName: it.itemName, unit: it.unit, qty: Number(it.qty) || 0 })),
    status: "confirmed"
  };
  stockAdjustments.push(sa);
  sa.items.forEach(it => {
    const item = itemMaster.find(i => i.id === it.itemId);
    if (item) item.closingStock = (item.closingStock || 0) + it.qty;
  });
  return sa;
}

// ═══════════════════════════════════════
// STOCK REPORTS (Reports → Stock Ledger)
// Only "Inventory type" transactions that reference a real Item Master
// entry (itemId set) ever appear here — a PO/Invoice line entered as free
// text under the "Others" type never touches these reports, matching the
// real system's behavior exactly (Batch 2 spec, section 6).
// ═══════════════════════════════════════

// The true item-level transaction ledger. Replays every voucher affecting
// this item in chronological order from its opening balance so each row's
// "closing stock" is an honest running total, not just today's snapshot.
function getStockReport({ itemId, voucherType = "All", from = "", to = "" } = {}) {
  const item = itemMaster.find(i => i.id === itemId);
  if (!item) return [];
  const vouchers = [];

  purchaseInvoices.forEach(inv => {
    if (inv.status !== "received") return;
    inv.items.forEach(it => {
      if (it.itemId !== itemId) return;
      const supplier = suppliers.find(s => s.id === inv.supplierId);
      vouchers.push({
        voucherType: "Purchase Invoice", voucherNo: inv.id, date: inv.dateReceived,
        vendor: supplier ? supplier.name : (inv.supplierNameTel || "—"),
        qty: it.qty, rate: it.rateBD || 0, amount: it.amtBD || 0, delta: it.qty
      });
    });
  });
  stockAdjustments.forEach(sa => {
    sa.items.forEach(it => {
      if (it.itemId !== itemId) return;
      vouchers.push({
        voucherType: "Stock Adjustment", voucherNo: sa.id, date: sa.date,
        vendor: "—", qty: Math.abs(it.qty), rate: 0, amount: 0, delta: it.qty
      });
    });
  });
  jobCards.forEach(job => {
    (job.materialsIssues || []).forEach(move => {
      if (move.status === "cancelled") return;
      move.items.forEach(it => {
        if (it.itemId !== itemId) return;
        vouchers.push({
          voucherType: "Material Issue", voucherNo: move.id, date: move.date,
          vendor: job.id, qty: it.qty, rate: 0, amount: 0, delta: -(Number(it.qty) || 0)
        });
      });
    });
    (job.materialsReturns || []).forEach(move => {
      if (move.status === "cancelled") return;
      move.items.forEach(it => {
        if (it.itemId !== itemId) return;
        vouchers.push({
          voucherType: "Material Return", voucherNo: move.id, date: move.date,
          vendor: job.id, qty: it.qty, rate: 0, amount: 0, delta: Number(it.qty) || 0
        });
      });
    });
  });

  vouchers.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  let running = item.openingStock || 0;
  const withRunning = vouchers.map(v => { running += v.delta; return { ...v, closingStock: running }; });

  return withRunning.filter(v =>
    (voucherType === "All" || v.voucherType === voucherType) &&
    (!from || v.date >= from) && (!to || v.date <= to)
  );
}

// Flatter current-snapshot view vs. the transactional Stock Report above.
function getItemSummaryReport({ category = "", itemName = "", includeZero = true } = {}) {
  return itemMaster
    .filter(it => !category || it.stockCategory === category)
    .filter(it => !itemName || it.name.toLowerCase().includes(itemName.trim().toLowerCase()))
    .filter(it => includeZero || (it.closingStock || 0) !== 0)
    .map(it => ({ itemId: it.id, itemName: it.name, closingStock: it.closingStock || 0, purchaseRate: it.lastPurchaseRate || 0 }));
}

// The MRP-style reorder report. ORDERS is demand traced from Estimator BOM
// materials (only lines picked from the real Item Master via the Materials
// typeahead carry an itemId — see addBOMMaterial) on quotations behind
// still-open Job Cards; a job item whose material was typed as free text
// won't show demand here, same real-world distinction the spec calls out.
function getJobMaterialRequirement() {
  return itemMaster.map(item => {
    let orders = 0;
    jobCards.filter(j => j.status === "open").forEach(job => {
      const qtn = quotations.find(q => q.id === job.quotationId);
      if (!qtn) return;
      qtn.items.forEach(it => {
        if (!it.bom) return;
        it.bom.materials.forEach(m => { if (m.itemId === item.id) orders += m.qty; });
      });
    });

    let matIssued = 0;
    jobCards.forEach(job => {
      (job.materialsIssues || []).forEach(move => {
        if (move.status === "cancelled") return;
        move.items.forEach(it => { if (it.itemId === item.id) matIssued += Number(it.qty) || 0; });
      });
      (job.materialsReturns || []).forEach(move => {
        if (move.status === "cancelled") return;
        move.items.forEach(it => { if (it.itemId === item.id) matIssued -= Number(it.qty) || 0; });
      });
    });

    let poQty = 0;
    purchaseOrders.filter(po => po.type === "Stock" && po.status === "issued").forEach(po => {
      po.items.forEach(it => { if (it.itemId === item.id) poQty += Number(it.qty) || 0; });
    });

    // closingStock clamps at 0 here: the real Item Master seed carries
    // genuinely negative book stock (uncorrected drift in the live system),
    // and a raw subtraction would turn "-100 in stock, zero demand" into a
    // phantom shortfall of 100. Negative stock is a data-quality signal,
    // not open demand — an item only shows required qty when real orders
    // exist beyond whatever non-negative stock can cover.
    const reqQty = Math.max(0, orders - matIssued - poQty - Math.max(0, item.closingStock || 0));
    return { itemId: item.id, itemName: item.name, unit: item.unit, closingStock: item.closingStock || 0, orders, matIssued, poQty, reqQty };
  });
}

// Reorder alerts (6 Aug 2026 audit, Phase E dashboard win) — the report
// (getJobMaterialRequirement / renderJobMaterialRequirementTab) already
// existed but the Storekeeper dashboard never surfaced the signal. An item
// is flagged when it has real open-order demand it can't cover (reqQty > 0)
// OR its current stock has fallen at/below its own reorderLevel. Most-urgent
// (biggest shortfall) first.
function getReorderAlerts() {
  return getJobMaterialRequirement()
    .map(r => {
      const item = itemMaster.find(i => i.id === r.itemId);
      const reorderLevel = (item && item.reorderLevel) || 0;
      const belowReorder = reorderLevel > 0 && r.closingStock <= reorderLevel;
      return { ...r, reorderLevel, belowReorder };
    })
    .filter(r => r.reqQty > 0 || r.belowReorder)
    .sort((a, b) => b.reqQty - a.reqQty);
}

// The "Create Purchase Request" button on Job Material Requirement — takes
// the checked shortfall rows and raises one Inventory-type PR covering all
// of them, same chain as any other PR (Purchases module Requests tab).
function createPurchaseRequestFromShortfall(itemIds, raisedBy, department = "carp", division = null) {
  const rows = getJobMaterialRequirement().filter(r => itemIds.includes(r.itemId) && r.reqQty > 0);
  if (!rows.length) return { error: "No shortfall items selected." };
  const items = rows.map(r => ({ name: r.itemName, qty: r.reqQty, unit: r.unit, itemId: r.itemId }));
  return raisePurchaseRequest({ department, raisedBy, destinationType: "inventory", items, division });
}

// ── PURCHASER DASHBOARD KPIs ──
// Segregated by division: Curtain reads from purchaseInquiries[] (its own
// unchanged tracker); Upholstery, Joinery (carp+paint combined), and Metal
// Works read from the new purchaseRequests/purchaseOrders chain above.
function getPurchasingKPIs() {
  const openPRs = purchaseRequests.filter(pr => pr.status === "open");
  const pendingApprovals = getPendingPOApprovals();
  const awaitingDelivery = purchaseOrders.filter(po => po.status === "issued");
  const openCurtainInquiries = purchaseInquiries.filter(pi => !piIsDone(pi));

  // Reads po.department directly (stamped on every PO whether converted
  // from a PR or created directly) rather than looking up sourcePR — a
  // direct PO has no PR to look up, so the old sourcePR-lookup version
  // silently dropped direct POs from every division bucket.
  function bucket(deptKeys) {
    return {
      openRequests: purchaseRequests.filter(pr => deptKeys.includes(pr.department) && pr.status === "open").length,
      pendingApprovals: purchaseOrders.filter(po => deptKeys.includes(po.department) && po.approvalStatus === "pending").length,
      awaitingDelivery: purchaseOrders.filter(po => deptKeys.includes(po.department) && po.status === "issued").length
    };
  }

  return {
    totals: {
      openRequests: openPRs.length,
      pendingPOApprovals: pendingApprovals.length,
      pendingInvoiceApprovals: getPendingInvoiceApprovals().length,
      awaitingDelivery: awaitingDelivery.length,
      curtainOpenInquiries: openCurtainInquiries.length
    },
    byDivision: {
      curtain: {
        openInquiries: openCurtainInquiries.length,
        awaitingVendor: purchaseInquiries.filter(pi => pi.source === "vendor" && !piIsDone(pi)).length
      },
      upholstery: bucket(["uph"]),
      joinery: bucket(["carp", "paint"]),
      metal: bucket(["metal"])
    }
  };
}


// ═══════════════════════════════════════
// EMPLOYEE RATES — fully-loaded labour cost per hour (BD), by full name.
// Built 6 Jul 2026 from real May/June 2026 payroll files (Admin +
// Production), covering basic salary + allowances + employer-side extras:
// GOSI (3% expat employer), EOSB/indemnity (4.2% employer monthly SIO
// contribution, ≤3yr tenure tier — no per-person hire dates available yet,
// so every entry defaults to the lower tier; bump individually to 8.4%
// once tenure is confirmed), LMRA work permit + health card (amortized
// over a 2-year permit), a flat BD 150 2-way home ticket (amortized over
// 2 years), and a 30-day/year paid annual leave accrual. Standard hours
// assumed at 240/month (30 days x 8h), matching AMD's own timesheet
// convention. Full source workbook: AMD_Labour_Cost_Per_Hour.xlsx.
//
// Full-name keyed (not first-name) to avoid collisions — several people
// share a first name / role name across departments. curtain.js's
// existing first-name rosters (STITCH_TEAM/TRACK_TEAM/INSTALL_CREW) and
// timeLogs[] stay on first names for the UI; CURTAIN_NAME_MAP in
// curtain.js bridges the 7 Curtain-side first names to their full-name
// key here for the cost lookup only.
//
// 'Shameer Shah' appeared in both payroll files with two different
// basic figures (admin batch vs production batch) — Salman confirmed
// it is one person and to use the admin-file figure; department is
// still tagged Carpentry (their real production role) below.
//
// TODO: replace the default EOSB tier with per-person actual tenure once
// hire dates are confirmed — several entries (Owner, Directors) likely
// already exceed 3 years and should be on the 8.4% tier.
// ═══════════════════════════════════════
const EMPLOYEE_RATES = {
  'Abdul Raheem Mohammed': { rate: 1.352, department: 'Admin/Office', category: 'Admin' },
  'Abdul Rehman Aslam Qureshi': { rate: 3.366, department: 'Admin/Office', category: 'Admin' },
  'Abdullah Abdul Haq': { rate: 10.957, department: 'Admin/Office', category: 'Admin' },
  'Altaf Hasan Ali Ghare': { rate: 2.26, department: 'Admin/Office', category: 'Admin' },
  'Arbaz Iqbal Malim': { rate: 0.787, department: 'Admin/Office', category: 'Admin' },
  'Arun Kumar A': { rate: 1.538, department: 'Admin/Office', category: 'Admin' },
  'Aslam Abdul Rehman Qureshi': { rate: 10.957, department: 'Admin/Office', category: 'Admin' },
  'Aysha Aslam Qureshi': { rate: 2.292, department: 'Admin/Office', category: 'Admin' },
  'Jinesh Valiyavalappil Jayarajan': { rate: 2.26, department: 'Admin/Office', category: 'Admin' },
  'Karthikeyan Selvaraj': { rate: 1.331, department: 'Admin/Office', category: 'Admin' },
  'Latif Ullah': { rate: 1.57, department: 'Admin/Office', category: 'Admin' },
  'Rajneesh Vailezhath': { rate: 1.954, department: 'Admin/Office', category: 'Admin' },
  'Salman Abdullah': { rate: 7.023, department: 'Admin/Office', category: 'Admin' },
  'Sampath Suresh Kumar': { rate: 1.811, department: 'Admin/Office', category: 'Admin' },
  'Sharad Kumar Viswakarma': { rate: 4.153, department: 'Admin/Office', category: 'Admin' },
  'Shuhaib Mundel Kattil': { rate: 0.896, department: 'Admin/Office', category: 'Admin' },
  'Sidharth Sathyan': { rate: 0.992, department: 'Admin/Office', category: 'Admin' },
  'Sujith Kumar Angadipurath': { rate: 2.452, department: 'Admin/Office', category: 'Admin' },
  'Venkateswara Rao Neredimilli': { rate: 0.655, department: 'Admin/Office', category: 'Admin' },
  'Zahra Abdullah': { rate: 3.783, department: 'Admin/Office', category: 'Admin' },
  'Ajay Paswan': { rate: 1.209, department: 'Carpentry', category: 'Production' },
  'Amith Sharma': { rate: 0.848, department: 'Carpentry', category: 'Production' },
  'Balwinder Signh': { rate: 0.89, department: 'Carpentry', category: 'Production' },
  'Brijanandan': { rate: 0.841, department: 'Carpentry', category: 'Production' },
  'Elakkiyaselvan Maharajan': { rate: 0.704, department: 'Carpentry', category: 'Production' },
  'Govind Kharwar': { rate: 0.704, department: 'Carpentry', category: 'Production' },
  'Gufran Ahmed': { rate: 1.538, department: 'Carpentry', category: 'Production' },
  'Jai Prakash': { rate: 0.89, department: 'Carpentry', category: 'Production' },
  'Jithendra': { rate: 0.752, department: 'Carpentry', category: 'Production' },
  'Mahendra Sahani': { rate: 0.896, department: 'Carpentry', category: 'Production' },
  'Manoj Sharma': { rate: 0.793, department: 'Carpentry', category: 'Production' },
  'Mohammed Khalid': { rate: 0.704, department: 'Carpentry', category: 'Production' },
  'Mohammed Raza': { rate: 0.704, department: 'Carpentry', category: 'Production' },
  'Raheed Mohammed': { rate: 1.137, department: 'Carpentry', category: 'Production' },
  'Raj Kumar': { rate: 0.992, department: 'Carpentry', category: 'Production' },
  'Ravindar Gadde': { rate: 0.931, department: 'Carpentry', category: 'Production' },
  'Sainath Vangala': { rate: 0.852, department: 'Carpentry', category: 'Production' },
  'Sameer Pasha': { rate: 0.835, department: 'Carpentry', category: 'Production' },
  'Shameer Shah': { rate: 0.896, department: 'Carpentry', category: 'Production' },
  'Subhan': { rate: 0.992, department: 'Carpentry', category: 'Production' },
  'Suneel Kumar': { rate: 0.896, department: 'Carpentry', category: 'Production' },
  'Upendra Paswan': { rate: 0.655, department: 'Carpentry', category: 'Production' },
  'Vijay Kumar': { rate: 0.697, department: 'Carpentry', category: 'Production' },
  'Vinod Sharma': { rate: 0.938, department: 'Carpentry', category: 'Production' },
  'Ibrahim Khurshid': { rate: 0.704, department: 'Curtain & Blinds', category: 'Production' },
  'Md Alenabi': { rate: 0.607, department: 'Curtain & Blinds', category: 'Production' },
  'Mhd Sahil': { rate: 0.607, department: 'Curtain & Blinds', category: 'Production' },
  'Mohammad Abdullah': { rate: 0.655, department: 'Curtain & Blinds', category: 'Production' },
  'Mohammed Waseem Rahmani': { rate: 0.776, department: 'Curtain & Blinds', category: 'Production' },
  'Mohd. Javed': { rate: 0.992, department: 'Curtain & Blinds', category: 'Production' },
  'Muhammad Aslam': { rate: 0.655, department: 'Curtain & Blinds', category: 'Production' },
  'Muhammad Furqan': { rate: 0.829, department: 'Curtain & Blinds', category: 'Production' },
  'Murugaiya Pillai Selvaraj': { rate: 1.329, department: 'Curtain & Blinds', category: 'Production' },
  'Mushraf Hussain': { rate: 0.824, department: 'Curtain & Blinds', category: 'Production' },
  'Rijwan Alam': { rate: 0.655, department: 'Curtain & Blinds', category: 'Production' },
  'Saeed Ahmad': { rate: 1.028, department: 'Curtain & Blinds', category: 'Production' },
  'Shahzad Farooq': { rate: 0.655, department: 'Curtain & Blinds', category: 'Production' },
  'Sohail Qureshi': { rate: 0.92, department: 'Curtain & Blinds', category: 'Production' },
  'Subutktgin (SHIBU)': { rate: 1.028, department: 'Curtain & Blinds', category: 'Production' },
  'Amran Mia Md Rahis Mia': { rate: 0.992, department: 'Upholstery', category: 'Production' },
  'Ifran Hussain': { rate: 0.704, department: 'Upholstery', category: 'Production' },
  'Jamaluddin': { rate: 0.8, department: 'Upholstery', category: 'Production' },
  'Mohammad Naeem': { rate: 0.8, department: 'Upholstery', category: 'Production' },
  'Mohammed Rubel Miah': { rate: 0.704, department: 'Upholstery', category: 'Production' },
  'Muhammad Jamshed': { rate: 0.8, department: 'Upholstery', category: 'Production' },
  'Prince Kaler': { rate: 0.704, department: 'Upholstery', category: 'Production' },
  'Rajendra Kumar': { rate: 0.655, department: 'Upholstery', category: 'Production' },
  'Shamim Ansari': { rate: 0.704, department: 'Upholstery', category: 'Production' },
  'Soheb Ahmed': { rate: 0.704, department: 'Upholstery', category: 'Production' },
  'Ammar Bahadur': { rate: 0.704, department: 'Watchman', category: 'Production' },
};

// ── REAL MONTHLY SALARIES — July 2026 payroll (production + admin files,
// uploaded 6 Aug 2026). basic/ot/allow/hra/other are the real BD payslip
// figures; net is that month's actual net salary; cpr is the real CPR
// (9-digit, leading zeros restored — Excel strips them). designation comes
// from the production file's per-person timesheet sheets where present.
// Employees showing 0 across the board had a zero July payslip in the real
// file (leave/vacation) — their pay heads are left empty rather than
// invented. NOTE (real data-quality issue in the source file, not a bug
// here): Ammar Bahadur / Suneel Kumar / Mohammad Abdullah share one CPR
// (871287684) in the payroll sheet itself — flag to correct in HR.
const EMPLOYEE_SALARIES = {
  "Sohail Qureshi": { basic: 165, ot: 55, allow: 0, hra: 0, other: 0, net: 220, cpr: "911023640", designation: "Sales Executive" },
  "Vinod Sharma": { basic: 160, ot: 38.75, allow: 0, hra: 0, other: 10, net: 208.75, cpr: "870715496" },
  "Manoj Sharma": { basic: 130, ot: 37.714, allow: 0, hra: 0, other: 10, net: 177.714, cpr: "990449254" },
  "Upendra Paswan": { basic: 110, ot: 30.938, allow: 0, hra: 0, other: 0, net: 140.938, cpr: "000120472" },
  "Gufran Ahmed": { basic: 250, ot: 82.292, allow: 0, hra: 0, other: 50, net: 382.292, cpr: "740320653", designation: "Carpenter / Driver" },
  "Subhan": { basic: 180, ot: 80.531, allow: 0, hra: 0, other: 0, net: 260.531, cpr: "940128454", designation: "Carpenter" },
  "Sainath Vangala": { basic: 0, ot: 0, allow: 0, hra: 0, other: 0, net: 0, cpr: "851473970" },
  "Elakkiyaselvan Maharajan": { basic: 120, ot: 30.625, allow: 0, hra: 0, other: 0, net: 147.625, cpr: "010634843", designation: "Carpenter" },
  "Raj Kumar": { basic: 162, ot: 27.844, allow: 0, hra: 0, other: 0, net: 189.844, cpr: "930175620", designation: "Carpenter" },
  "Jai Prakash": { basic: 155, ot: 24.375, allow: 0, hra: 0, other: 10, net: 189.375, cpr: "088140746", designation: "Painter" },
  "Ajay Paswan": { basic: 225, ot: 121.875, allow: 0, hra: 0, other: 0, net: 346.875, cpr: "901317810", designation: "Carpenter" },
  "Amith Sharma": { basic: 150, ot: 47.266, allow: 0, hra: 0, other: 0, net: 197.266, cpr: "881370274", designation: "Carpenter" },
  "Vijay Kumar": { basic: 110, ot: 34.661, allow: 0, hra: 0, other: 10, net: 154.661, cpr: "040127249", designation: "Carpenter" },
  "Jithendra": { basic: 130, ot: 47.193, allow: 0, hra: 0, other: 0, net: 177.193, cpr: "940193027", designation: "Helper" },
  "Govind Kharwar": { basic: 120, ot: 48.25, allow: 0, hra: 0, other: 0, net: 168.25, cpr: "020142960", designation: "Helper" },
  "Shameer Shah": { basic: 180, ot: 51.563, allow: 0, hra: 0, other: 0, net: 231.563, cpr: "901376370", designation: "Store Keeper" },
  "Mohammed Khalid": { basic: 120, ot: 26.125, allow: 0, hra: 0, other: 0, net: 146.125, cpr: "040431924", designation: "Helper" },
  "Mohammed Raza": { basic: 48, ot: 2.188, allow: 0, hra: 0, other: 0, net: 50.188, cpr: "020634641", designation: "Helper" },
  "Ravindar Gadde": { basic: 0, ot: 0, allow: 0, hra: 0, other: 0, net: 0, cpr: "790772701", designation: "Carpenter" },
  "Balwinder Signh": { basic: 140, ot: 43.359, allow: 0, hra: 0, other: 10, net: 193.359, cpr: "810772531", designation: "Carpenter" },
  "Brijanandan": { basic: 0, ot: 0, allow: 0, hra: 0, other: 0, net: 0, cpr: "970248970", designation: "Carpenter" },
  "Mahendra Sahani": { basic: 160, ot: 35.25, allow: 0, hra: 0, other: 0, net: 195.25, cpr: "801519950", designation: "Painter" },
  "Raheed Mohammed": { basic: 119, ot: 43.313, allow: 0, hra: 0, other: 0, net: 162.313, cpr: "850152801", designation: "Carpenter" },
  "Subutktgin (SHIBU)": { basic: 170, ot: 46.042, allow: 0, hra: 0, other: 20, net: 236.042, cpr: "800727509", designation: "Technician" },
  "Mohammad Naeem": { basic: 0, ot: 0, allow: 0, hra: 0, other: 0, net: 0, cpr: "771051549", designation: "Tailor" },
  "Ibrahim Khurshid": { basic: 120, ot: 0, allow: 0, hra: 0, other: 0, net: 120, cpr: "950851841", designation: "Tailor" },
  "Mohd. Javed": { basic: 180, ot: 0, allow: 0, hra: 0, other: 0, net: 180, cpr: "880744642", designation: "Technician" },
  "Amran Mia Md Rahis Mia": { basic: 180, ot: 8.438, allow: 0, hra: 0, other: 0, net: 188.438, cpr: "870193929", designation: "Technician" },
  "Murugaiya Pillai Selvaraj": { basic: 250, ot: 0, allow: 0, hra: 0, other: 0, net: 250, cpr: "600083004", designation: "Technician" },
  "Muhammad Jamshed": { basic: 140, ot: 6.563, allow: 0, hra: 0, other: 0, net: 146.563, cpr: "800147286", designation: "Carpenter" },
  "Mohammed Waseem Rahmani": { basic: 135, ot: 0, allow: 0, hra: 0, other: 0, net: 110, cpr: "990133656", designation: "Technician" },
  "Jamaluddin": { basic: 140, ot: 0, allow: 0, hra: 0, other: 0, net: 140, cpr: "631112715", designation: "Technician" },
  "Mohammed Rubel Miah": { basic: 120, ot: 38.25, allow: 0, hra: 0, other: 0, net: 158.25, cpr: "880182695", designation: "Technician" },
  "Prince Kaler": { basic: 120, ot: 14.813, allow: 0, hra: 0, other: 0, net: 134.813, cpr: "010164375", designation: "Technician" },
  "Muhammad Aslam": { basic: 110, ot: 18.792, allow: 0, hra: 0, other: 0, net: 128.792, cpr: "851285635", designation: "Tailor" },
  "Ifran Hussain": { basic: 120, ot: 18.75, allow: 0, hra: 0, other: 0, net: 138.75, cpr: "020728387", designation: "Upholsterer" },
  "Mushraf Hussain": { basic: 145, ot: 33.984, allow: 0, hra: 0, other: 0, net: 178.984, cpr: "860269760", designation: "Technician" },
  "Shahzad Farooq": { basic: 110, ot: 18.161, allow: 0, hra: 0, other: 0, net: 128.161, cpr: "990550893", designation: "Technician" },
  "Saeed Ahmad": { basic: 170, ot: 59.943, allow: 0, hra: 0, other: 20, net: 249.943, cpr: "721306292", designation: "Technician" },
  "Muhammad Furqan": { basic: 120, ot: 48.938, allow: 0, hra: 0, other: 30, net: 198.938, cpr: "980739284" },
  "Sameer Pasha": { basic: 0, ot: 0, allow: 0, hra: 0, other: 0, net: 0, cpr: "010327320", designation: "Driver" },
  "Rajendra Kumar": { basic: 110, ot: 14.036, allow: 0, hra: 0, other: 0, net: 124.036, cpr: "751435503", designation: "Carpenter" },
  "Md Alenabi": { basic: 100, ot: 10.417, allow: 0, hra: 0, other: 0, net: 110.417, cpr: "851468209", designation: "Helper" },
  "Rijwan Alam": { basic: 110, ot: 0, allow: 0, hra: 0, other: 0, net: 110, cpr: "930136888", designation: "Tailor" },
  "Mhd Sahil": { basic: 100, ot: 20, allow: 0, hra: 0, other: 0, net: 120, cpr: "990163288", designation: "Helper" },
  "Soheb Ahmed": { basic: 120, ot: 28.125, allow: 0, hra: 0, other: 0, net: 148.125, cpr: "040233286", designation: "Helper" },
  "Shamim Ansari": { basic: 120, ot: 17.25, allow: 0, hra: 0, other: 0, net: 137.25, cpr: "881494771", designation: "Helper" },
  "Ammar Bahadur": { basic: 120, ot: 0, allow: 0, hra: 0, other: 0, net: 120, cpr: "871287684", designation: "Helper" },
  "Suneel Kumar": { basic: 160, ot: 42.333, allow: 0, hra: 0, other: 0, net: 202.333, cpr: "871287684", designation: "Carpenter" },
  "Mohammad Abdullah": { basic: 110, ot: 14.781, allow: 0, hra: 0, other: 0, net: 124.781, cpr: "871287684", designation: "Helper" },
  "Abdul Raheem Mohammed": { basic: 220, ot: 10, allow: 0, hra: 0, other: 30, net: 260, cpr: "730724387" },
  "Karthikeyan Selvaraj": { basic: 220, ot: 10, allow: 0, hra: 0, other: 30, net: 260, cpr: "010724150" },
  "Altaf Hasan Ali Ghare": { basic: 400, ot: 0, allow: 0, hra: 0, other: 50, net: 450, cpr: "760524637" },
  "Jinesh Valiyavalappil Jayarajan": { basic: 400, ot: 0, allow: 0, hra: 0, other: 50, net: 450, cpr: "850317720" },
  "Arbaz Iqbal Malim": { basic: 120, ot: 0, allow: 0, hra: 0, other: 20, net: 140, cpr: "970454481" },
  "Rajneesh Vailezhath": { basic: 250, ot: 0, allow: 0, hra: 100, other: 50, net: 400, cpr: "860555666" },
  "Shuhaib Mundel Kattil": { basic: 160, ot: 0, allow: 0, hra: 0, other: 0, net: 117.333, cpr: "881470350" },
  "Venkateswara Rao Neredimilli": { basic: 110, ot: 0, allow: 0, hra: 0, other: 0, net: 110, cpr: "890593043" },
  "Arun Kumar A": { basic: 250, ot: 0, allow: 0, hra: 0, other: 50, net: 300, cpr: "001133870" },
  "Sujith Kumar Angadipurath": { basic: 375, ot: 0, allow: 0, hra: 0, other: 125, net: 500, cpr: "771061412" },
  "Sidharth Sathyan": { basic: 90, ot: 10, allow: 0, hra: 0, other: 0, net: 100, cpr: "980447844" },
  "Sharad Kumar Viswakarma": { basic: 750, ot: 0, allow: 0, hra: 0, other: 100, net: 850, cpr: "851031471" },
  "Sampath Suresh Kumar": { basic: 350, ot: 0, allow: 0, hra: 0, other: 0, net: 338.333, cpr: "950722685" },
  "Latif Ullah": { basic: 300, ot: 0, allow: 0, hra: 0, other: 0, net: 300, cpr: "" },
  "Zahra Abdullah": { basic: 500, ot: 0, allow: 0, hra: 150, other: 150, net: 800, cpr: "911210679" },
  "Aysha Aslam Qureshi": { basic: 450, ot: 0, allow: 0, hra: 0, other: 0, net: 375, cpr: "020812302" },
  "Abdul Rehman Aslam Qureshi": { basic: 500, ot: 0, allow: 0, hra: 150, other: 50, net: 650, cpr: "990510565" },
  "Aslam Abdul Rehman Qureshi": { basic: 2250, ot: 0, allow: 0, hra: 0, other: 0, net: 2250, cpr: "670604658" },
  "Abdullah Abdul Haq": { basic: 2250, ot: 0, allow: 0, hra: 0, other: 0, net: 2250, cpr: "560091060" },
  "Salman Abdullah": { basic: 1000, ot: 0, allow: 0, hra: 250, other: 250, net: 1500, cpr: "940210444" },
};

// Builds the HR Employee record's Salary-tab rows from a real
// EMPLOYEE_SALARIES entry. Zero heads are skipped, not stored as 0-rows.
function buildPayHeadsFromSalary(s) {
  if (!s) return [];
  const heads = [];
  if (s.basic) heads.push({ head: "Basic Salary", amount: s.basic });
  if (s.ot) heads.push({ head: "Overtime", amount: s.ot });
  if (s.allow) heads.push({ head: "Allowance", amount: s.allow });
  if (s.hra) heads.push({ head: "HRA", amount: s.hra });
  if (s.other) heads.push({ head: "Other Allowances", amount: s.other });
  return heads;
}

// ═══════════════════════════════════════
// HR & PAYROLL MODULE DATA — Masters → Payroll → Employee, Dashboards → HR
// Built session: 3 Aug 2026, traced from
// docs/qpro-mapping/batch5administrationpayrollhr.txt (Q-Pro Batch 5).
//
// SCOPE CUT, DELIBERATE: the live spec's Masters -> Administration section
// (Users / User Group / Default Controller / role flags / Quick Menu) models
// Q-Pro's own multi-user login+permission system. This app has no such
// login system — it's real per-person Supabase login (auth.js, added
// 4 Aug 2026) plus per-module "simulated identity" pickers for
// everything not yet migrated onto it (Estimator/Approver work this
// way today). Building a parallel
// real user/permission system here would be substantial effort for
// something this app's actual architecture doesn't need — not built, same
// spirit as skipping Q-Pro's vestigial Inventory->Vendor list in Batch 1/2.
// Employee Category (spec 1.4) also skipped — the spec itself flags it as
// vestigial ("the per-employee rate seems to be what's actually used").
//
// Employee record fields follow the spec's 8-tab shape, simplified in a
// few places (noted inline) — this is the richest single record type in
// the app. Seeded from EMPLOYEE_RATES above (real payroll data, ~70 staff)
// rather than invented names. EMPLOYEE_RATES' informal department strings
// ("Admin/Office", "Carpentry", "Watchman", ...) are mapped to the real
// Q-Pro Administration Department master's 6 values below — this is a
// DIFFERENT list from DEPTS (the categorical color registry used elsewhere
// for production-department tagging) and deliberately doesn't touch it.
const EMPLOYEE_DEPARTMENTS = ["Curtain", "Upholstery", "Painting", "Joinery", "Administration", "Sales"];
const EMP_RATE_DEPT_TO_REAL_DEPT = {
  "Admin/Office": "Administration", "Carpentry": "Joinery",
  "Curtain & Blinds": "Curtain", "Upholstery": "Upholstery", "Watchman": "Administration"
};
const DEPENDENT_RELATIONS = ["Wife", "Husband", "Son", "Daughter", "Father", "Mother", "Grandfather", "Grandmother", "Brother", "Sister", "Cousin", "Nephew", "Niece", "Uncle", "Aunt", "Other"];
// Simplified Pay Head list — spec has 17 fixed items; kept the ones that
// actually appear on a real payslip rather than replicating every Q-Pro
// pay-code verbatim (Gosi Payable/Indemnity Payable/etc. are GL-posting
// artifacts, not something an employee record needs to carry directly).
const PAY_HEADS = ["Basic Salary", "Allowance", "Overtime", "HRA", "Air Ticket", "Other Allowances"];

let employees = Object.entries(EMPLOYEE_RATES).map(([name, r], i) => ({
  id: "E" + String(10001 + i),
  name, nickName: "",
  designation: (EMPLOYEE_SALARIES[name] && EMPLOYEE_SALARIES[name].designation) || (r.category === "Admin" ? "Office Staff" : "Production Staff"),
  department: EMP_RATE_DEPT_TO_REAL_DEPT[r.department] || "Administration",
  function: "", location: "Main Workshop", doj: "", group: "Emp Group 1",
  status: "Active", terminationDate: "", terminationReason: "",
  machineId: "", workingHours: 8,
  nationality: "", dob: "", gender: "", bloodGroup: "",
  email: "", mobile: "", localContact: "", officeTel: "", landline: "",
  contactPersonNo: "", homeContact: "", homeContactNo: "", localAddress: "", homeAddress: "", spouseName: "",
  bankName: "", bankBranch: "", bankAccountNo: "", iban: "",
  cpr: (EMPLOYEE_SALARIES[name] || {}).cpr || "", cprExpiry: "", licenceNo: "", licenceExpiry: "",
  passportNo: "", passportCountry: "", passportIssue: "", passportExpiry: "", visaNo: "", visaExpiry: "",
  contractStart: "", contractExpiry: "",
  normalRate: r.rate, otRate: +(r.rate * 1.5).toFixed(3),
  payHeads: buildPayHeadsFromSalary(EMPLOYEE_SALARIES[name]), dependents: [], assets: [],
  notes1: "", notes2: "", notes3: ""
}));

// Seed a handful with realistic compliance dates (expired / expiring soon /
// valid) so the HR Dashboard below has real data to show, without having
// to hand-populate all ~70 staff. Dates are relative to a 3 Aug 2026
// "today" — deliberately spanning all three states.
(function seedEmployeeCompliance() {
  const find = n => employees.find(e => e.name === n);
  const set = (name, patch) => { const e = find(name); if (e) Object.assign(e, patch); };
  set("Abdullah Abdul Haq", { // Director — expired CPR, expiring passport (demo compliance dates)
    designation: "Director", doj: "2019-03-12", nationality: "Bahrain", gender: "Male",
    cprExpiry: "2026-06-15", licenceNo: "BH-44120", licenceExpiry: "2027-01-10",
    passportNo: "P1122334", passportCountry: "Bangladesh", passportIssue: "2020-02-01", passportExpiry: "2026-08-20",
    visaNo: "V9988", visaExpiry: "2027-04-01", contractStart: "2025-01-01", contractExpiry: "2027-01-01",
    dependents: [{ name: "Sohela Begum", relation: "Wife", dob: "1990-05-14", cpr: "", cprExpiry: "", passport: "P2233445", passportExpiry: "2026-09-05", visa: "", visaExpiry: "" }],
    assets: [{ name: "Company Phone", code: "AST-014", issueDate: "2023-01-15", returnDate: "", remarks: "iPhone SE" }],
  });
  set("Subutktgin (SHIBU)", { // Install crew — valid across the board
    designation: "Install Crew Lead", doj: "2018-07-01", nationality: "India", gender: "Male",
    cprExpiry: "2027-11-01", licenceNo: "BH-30219", licenceExpiry: "2028-02-14",
    passportNo: "K4455667", passportCountry: "India", passportIssue: "2021-06-01", passportExpiry: "2031-06-01",
    visaNo: "V5566", visaExpiry: "2027-09-01", contractStart: "2025-07-01", contractExpiry: "2027-07-01",
  });
  set("Muhammad Furqan", { // expiring driving licence + expired visa
    designation: "Install Crew", doj: "2021-02-20", nationality: "Pakistan", gender: "Male",
    cprExpiry: "2027-02-01", licenceNo: "BH-51002", licenceExpiry: "2026-08-25",
    passportNo: "AB123456", passportCountry: "Pakistan", passportIssue: "2019-03-01", passportExpiry: "2029-03-01",
    visaNo: "V7712", visaExpiry: "2026-07-10", contractStart: "2024-03-01", contractExpiry: "2026-09-01",
  });
  set("Salman Abdullah", { // owner — valid, seeded for realism
    designation: "Owner", doj: "2015-01-01", nationality: "Bahrain", gender: "Male",
    cprExpiry: "2029-01-01", contractStart: "2015-01-01", contractExpiry: "2030-01-01",
  });
  set("Sharad Kumar Viswakarma", { // expired contract
    designation: "Account Clerk", doj: "2020-05-10", nationality: "India", gender: "Male",
    cprExpiry: "2027-05-10", passportNo: "L9988776", passportCountry: "India",
    passportIssue: "2020-01-01", passportExpiry: "2030-01-01", visaNo: "V3344", visaExpiry: "2027-01-01",
    contractStart: "2024-05-10", contractExpiry: "2026-07-20",
  });
})();

function nextEmployeeId() { return "E" + String(10001 + employees.length); }
function getEmployee(id) { return employees.find(e => e.id === id); }
function createEmployee({ name, designation = "", department = "Administration", doj = "", machineId = "", workingHours = 8, notes1 = "" } = {}) {
  if (!name || !name.trim()) return { error: "Employee Name is required." };
  if (!notes1 || !notes1.trim()) return { error: "Notes 1 is required." };
  const e = {
    id: nextEmployeeId(), name: name.trim(), nickName: "", designation, department,
    function: "", location: "Main Workshop", doj, group: "Emp Group 1",
    status: "Active", terminationDate: "", terminationReason: "",
    machineId, workingHours: Number(workingHours) || 8,
    nationality: "", dob: "", gender: "", bloodGroup: "",
    email: "", mobile: "", localContact: "", officeTel: "", landline: "",
    contactPersonNo: "", homeContact: "", homeContactNo: "", localAddress: "", homeAddress: "", spouseName: "",
    bankName: "", bankBranch: "", bankAccountNo: "", iban: "",
    cpr: "", cprExpiry: "", licenceNo: "", licenceExpiry: "",
    passportNo: "", passportCountry: "", passportIssue: "", passportExpiry: "", visaNo: "", visaExpiry: "",
    contractStart: "", contractExpiry: "",
    normalRate: 0, otRate: 0,
    payHeads: [], dependents: [], assets: [],
    notes1: notes1.trim(), notes2: "", notes3: ""
  };
  employees.push(e);
  return e;
}
function updateEmployee(id, patch) {
  const e = getEmployee(id);
  if (!e) return { error: "Employee not found." };
  Object.assign(e, patch);
  return e;
}
function addEmployeeDependent(id, dep) {
  const e = getEmployee(id);
  if (!e) return { error: "Employee not found." };
  e.dependents.push({ name: dep.name || "", relation: dep.relation || "", dob: dep.dob || "", cpr: dep.cpr || "", cprExpiry: dep.cprExpiry || "", passport: dep.passport || "", passportExpiry: dep.passportExpiry || "", visa: dep.visa || "", visaExpiry: dep.visaExpiry || "" });
  return e;
}
function addEmployeeAsset(id, asset) {
  const e = getEmployee(id);
  if (!e) return { error: "Employee not found." };
  e.assets.push({ name: asset.name || "", code: asset.code || "", issueDate: asset.issueDate || "", returnDate: asset.returnDate || "", remarks: asset.remarks || "" });
  return e;
}

// HR Dashboard — 6 expiry tiles (CPR/Passport/Driving Licence/Visa/Contract/
// Dependent), each split Expiring/Expired. Pure read-side view over
// employees[] — no separate "compliance tracking" entity, matching the
// spec's own finding (section 4). "Expiring" window is 30 days; anything
// past today is "Expired". Both counts skip blank dates (not every seeded
// employee has every field filled).
const HR_EXPIRY_WINDOW_DAYS = 30;
function expiryStatus(dateStr, todayStr) {
  if (!dateStr) return null;
  const days = (new Date(dateStr) - new Date(todayStr)) / 86400000;
  if (days < 0) return "expired";
  if (days <= HR_EXPIRY_WINDOW_DAYS) return "expiring";
  return null;
}
function getHRKPIs(todayStr = new Date().toISOString().slice(0, 10)) {
  const tiles = {
    cpr: { expiring: [], expired: [] },
    passport: { expiring: [], expired: [] },
    licence: { expiring: [], expired: [] },
    visa: { expiring: [], expired: [] },
    contract: { expiring: [], expired: [] },
    dependent: { expiring: [], expired: [] },
  };
  const bucket = (group, empName, dateStr, label) => {
    const s = expiryStatus(dateStr, todayStr);
    if (s) tiles[group][s].push({ name: empName, date: dateStr, label });
  };
  employees.forEach(e => {
    if (e.status !== "Active") return; // Resigned/Terminated/Retired staff drop off compliance tracking
    bucket("cpr", e.name, e.cprExpiry, "CPR");
    bucket("passport", e.name, e.passportExpiry, "Passport");
    bucket("licence", e.name, e.licenceExpiry, "Driving Licence");
    bucket("visa", e.name, e.visaExpiry, "Visa");
    bucket("contract", e.name, e.contractExpiry, "Contract");
    e.dependents.forEach(d => {
      bucket("dependent", e.name, d.cprExpiry, `${d.name} (CPR)`);
      bucket("dependent", e.name, d.passportExpiry, `${d.name} (Passport)`);
      bucket("dependent", e.name, d.visaExpiry, `${d.name} (Visa)`);
    });
  });
  return tiles;
}

// Payroll Report (Batch 6) — Year/Month are decorative filters matching
// the live spec's own finding: payroll has no separate "run" transaction
// entity, it's purely a rollup of the static payHeads configuration on
// each Employee record (Salary tab). GOSI 1% and the other Q-Pro pay-codes
// this app deliberately didn't model (see EMP_RATE_DEPT_TO_REAL_DEPT/
// PAY_HEADS comment above employees[]) simply don't appear here — the 6
// Pay Heads this app actually has are the columns.
function getPayrollReport() {
  return employees.filter(e => e.status === "Active").map(e => {
    const byHead = {};
    PAY_HEADS.forEach(h => byHead[h] = 0);
    e.payHeads.forEach(p => { if (byHead[p.head] !== undefined) byHead[p.head] += (p.amount || 0); });
    const total = Math.round(Object.values(byHead).reduce((s, v) => s + v, 0) * 1000) / 1000;
    return { id: e.id, name: e.name, byHead, total };
  });
}

// ═══════════════════════════════════════
// SALES MODULE DATA — Enquiry → Quotation
// Rebuilt 25 Jul 2026 from a live reverse-engineered Q-Pro reference
// (qpro.almarayadecor.com) supplied by Salman, replacing an earlier
// version of this module that was designed from a handoff brief but never
// actually landed in this repo (lost between sessions).
//
// GLOBAL WORKFLOW RULE (confirmed against live Q-Pro, not guessed):
// Quotations can ONLY be created by converting an existing Enquiry, and
// only once that Enquiry is linked to a real Customer record — never
// standalone, never from a bare prospect. Q-Pro's own error for the
// prospect-only case is "Please Select Customer To Proceed!!!" — reused
// verbatim in canConvertToQuotation()/convertEnquiryToQuotation() below.
//
// Estimator and Approver (the next two stages after Quotation) have not
// been mapped yet — do not build UI for them. quotation.stage tracks
// which of the three roles currently owns a quotation (sales/estimator/
// approver) so that hand-off is modeled even though only the Sales side
// has a real screen right now.
// ═══════════════════════════════════════

const ENQUIRY_SOURCES = ["Architect/Interior Designer", "Email", "Existing client", "Q-pro/Old quotes", "Referrals", "Social Media", "walk inn"];
const MEETING_TYPES = ["Telephone Call", "Whatsapp Chat", "Meeting at Client Office", "Meeting at Al Maraya Showroom", "Site Visit"];
const FOLLOWUP_OUTCOMES = ["On call/whatsapp", "Required design/proposal", "Client not attended", "On site measurements"];
// Divisions this Enquiry form offers — only "furniture" has been seen in the live
// Q-Pro URL path (furniture/Enquiry/createenquiry); the rest mirror AMD's own
// production divisions (DEPTS above) until Q-Pro's full division list is captured.
const SALES_DIVISIONS = ["Curtain & Blinds", "Furniture", "Joinery", "Upholstery", "Metal Works"];
// Common subset, NOT the full ISO-3166 list Q-Pro's Add Customer dropdown actually has —
// good enough until that full list is captured.
const COUNTRIES = ["Bahrain", "Saudi Arabia", "United Arab Emirates", "Kuwait", "Qatar", "Oman", "India", "Pakistan", "Bangladesh", "Philippines", "Sri Lanka", "Nepal", "Egypt", "Jordan", "Lebanon", "United Kingdom", "United States", "Other"];
const COVERING_LETTER_TEMPLATES = { "Al Maraya decor.": (project) => `Sub: ${project}\n\nDear Sir/Madam,\n\nThank you for the opportunity to quote for the above-mentioned project. Please find our detailed quotation enclosed.\n\nWe look forward to being of service.\n\nRegards,\nAl Maraya Decor` };
// The REAL 11-clause T&C list from Al Maraya's live quotation documents
// (verified against the Ewan/Qreative/Cubique PDFs, 6 Aug 2026) — replaces
// the invented 5-liner that stood in before.
const TERMS_TEMPLATES = { "Al Maraya Decor Standard.": `1- For Orders Less than BD 500, 100% Advance payment
2- For orders more than BD 500, 70% Advance payment and 30% upon completion/delivery of work.
3- Payment must be in cash or cheque in favor of "M/s Al Maraya Décor - Material co w.l.l.
4- The offer is valid for 5 days.
5- Warranty and grantee on Fabric, if mentioned, does not cover damage from wear & tear, natural calamities of user damage.
6- Guarantee on heavy duty rails is subjected only to rails and not to accessories such as runner, master runners, brackets and baton rods.
7- Any change in measurement /size will change the price quoted.
8- Changes in color/texture disparity maybe expected against the sample submitted.
9- Any onsite complaints following the installation should be registered within 2 days of installation.
10- Any change after confirming the order will be on your account.
11- Kindly return a copy of this order duly signed in acceptance.` };

// ── CUSTOMERS ──
// Customer Code format matches the live reference (C1508) — sequential from
// an arbitrary Q-Pro-observed starting point, not a business-meaningful number.
const customers = [
  {
    id: "C1508", name: "ZZTEST", contactPerson: "Test Contact", tel: "00099911", tel2: "", email: "", fax: "",
    vatName: "", vatNo: "", taxPercent: 10, isCredit: false, creditLimit: 0, creditDays: 0,
    address: "Test Address, Manama", crNo: "", country: "Bahrain", openingBalance: 0, salesMan: "Salman Abdullah",
    status: "approved", approvedBy: "Salman Abdullah", approvalDate: "2026-07-24", rejectionComment: null, possibleDuplicateOf: null
  }
];
function nextCustomerCode() { return "C" + (1508 + customers.length); }
function customerTelExists(tel, excludeId = null) {
  return customers.some(c => c.id !== excludeId && c.tel === tel);
}

// ── Cloud-backed customers (4 Aug 2026, Phase 2 slice 1) ─────────────
// Same local-cache pattern as Messages (data.js, earlier same day):
// `customers` stays a plain array every existing .find()/.filter() call
// site across every module already uses — nothing else in the app
// changes. In real-cloud mode it's populated from Supabase at login and
// kept live via realtime; createCustomer()/approveCustomer()/
// rejectCustomer() stay synchronous (optimistic local write first, so
// every existing caller — sales.js, accounts.js, ~20 e2e tests — keeps
// working unchanged) and fire a background async write to persist it
// for real, for other devices to see.
function customerRowToObj(row) {
  return {
    id: row.id, name: row.name, contactPerson: row.contact_person, tel: row.tel, tel2: row.tel2,
    email: row.email, fax: row.fax, vatName: row.vat_name, vatNo: row.vat_no, taxPercent: row.tax_percent,
    isCredit: row.is_credit, creditLimit: row.credit_limit, creditDays: row.credit_days,
    address: row.address, crNo: row.cr_no, country: row.country, openingBalance: row.opening_balance,
    salesMan: row.sales_man, status: row.status, approvedBy: row.approved_by, approvalDate: row.approval_date,
    rejectionComment: row.rejection_comment, possibleDuplicateOf: row.possible_duplicate_of
  };
}
function customerObjToRow(c) {
  return {
    id: c.id, name: c.name, contact_person: c.contactPerson, tel: c.tel, tel2: c.tel2 || "",
    email: c.email || "", fax: c.fax || "", vat_name: c.vatName || "", vat_no: c.vatNo || "", tax_percent: c.taxPercent || 0,
    is_credit: !!c.isCredit, credit_limit: c.creditLimit || 0, credit_days: c.creditDays || 0,
    address: c.address, cr_no: c.crNo || "", country: c.country || "Bahrain", opening_balance: c.openingBalance || 0,
    sales_man: c.salesMan || null, status: c.status, approved_by: c.approvedBy || null, approval_date: c.approvalDate || null,
    rejection_comment: c.rejectionComment || null, possible_duplicate_of: c.possibleDuplicateOf || null
  };
}
// Idempotency guard — finishCloudLogin() can genuinely fire twice for
// one real login (the direct call chain AND Supabase's own
// onAuthStateChange listener both independently reach it for the same
// SIGNED_IN event, a real race, not a hypothetical). Without this,
// the second call tries to attach realtime listeners to a channel
// that's already subscribed, which supabase-js rejects outright.
let cloudCustomersCacheInitialized = false;
async function initCloudCustomersCache() {
  if (!window.__realCloudSession || !sb || cloudCustomersCacheInitialized) return;
  cloudCustomersCacheInitialized = true;
  const { data, error } = await sb.from("customers").select("*").order("created_at", { ascending: true });
  if (!error && data) { customers.length = 0; data.forEach(row => customers.push(customerRowToObj(row))); }
  sb.channel("customers-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;
      if (payload.eventType === "INSERT") { if (!customers.some(c => c.id === row.id)) customers.push(customerRowToObj(row)); }
      else if (payload.eventType === "UPDATE") { const i = customers.findIndex(c => c.id === row.id); if (i >= 0) customers[i] = customerRowToObj(row); }
      notifyLiveUpdateListeners();
    })
    .subscribe();
}
// Serializes background persist calls per record (table+id) — found live
// while testing quotations: addQuotationItem() and addBOMMaterial() each
// fire their own independent fire-and-forget save in quick succession,
// and network requests can complete out of order, so the earlier save
// (item without BOM) could overwrite the later one (item with BOM) if it
// happened to arrive second. Chaining each new persist onto the previous
// one for the same record guarantees they both start AND finish in the
// order they were triggered, closing that race for good. Used by every
// persist* function below, not just quotations' — the same risk exists
// anywhere two mutations land on the same record in quick succession.
const persistChains = {};
function serializedPersist(key, fn) {
  const prev = persistChains[key] || Promise.resolve();
  const next = prev.then(fn, fn);
  persistChains[key] = next.catch(() => {});
  return next;
}
// Background persist for a locally-created customer. Deliberately does
// NOT auto-retry a 23505 id collision with a regenerated id — the
// caller already captured and may have used the original id
// synchronously (e.g. linking it to an enquiry in the same call chain),
// so silently changing it after the fact would orphan that reference.
// Surfaced as a toast instead — a real but extremely rare edge case
// (two devices creating a customer in the same instant off a stale
// local count) that needs a person to notice and recreate the record,
// not a silent auto-fix that could break a different reference.
function persistNewCustomer(c) {
  if (!window.__realCloudSession || !sb) return;
  serializedPersist("customers:" + c.id, () => sb.from("customers").insert(customerObjToRow(c)).then(({ error }) => {
    if (!error) return;
    const reason = error.code === "23505" ? "id conflict with another device — please recreate this customer" : error.message;
    if (typeof commsToast === "function") commsToast(`Couldn't save customer ${c.name} (${c.id}) to the cloud: ${reason}`);
  }));
}
function persistCustomerUpdate(c) {
  if (!window.__realCloudSession || !sb) return;
  serializedPersist("customers:" + c.id, () => sb.from("customers").update(customerObjToRow(c)).eq("id", c.id).then(({ error }) => {
    if (error && typeof commsToast === "function") commsToast(`Couldn't sync customer ${c.name} to the cloud: ${error.message}`);
  }));
}

// ── Customer banking details (Phase 3, 5 Aug 2026) — split out of
// customers into its own table with RLS restricted to Accounts/Owner
// (see supabase/schema.sql's customer_banking_details for why: Sales
// used to enter these on the intake form, but every approved user could
// read them via customers' unrestricted SELECT policy). Same local-
// cache pattern as customers itself, kept in a SEPARATE array so a
// non-Accounts/Owner session's cache simply stays empty (RLS returns
// zero rows to them — real server-side enforcement, not a client-side
// hide) rather than mixing sensitive and non-sensitive fields on one
// object.
const customerBankingDetails = [];
function customerBankingRowToObj(row) {
  return {
    customerId: row.customer_id, bankAccountNumber: row.bank_account_number, bankAccountHolderName: row.bank_account_holder_name,
    ibanNumber: row.iban_number, bankSwift: row.bank_swift, bankName: row.bank_name, bankBranch: row.bank_branch,
    updatedBy: row.updated_by, updatedDate: row.updated_date
  };
}
let cloudCustomerBankingCacheInitialized = false;
async function initCloudCustomerBankingCache() {
  if (!window.__realCloudSession || !sb || cloudCustomerBankingCacheInitialized) return;
  cloudCustomerBankingCacheInitialized = true;
  const { data, error } = await sb.from("customer_banking_details").select("*");
  // A non-Accounts/Owner session gets zero rows back (RLS), not an
  // error — that's expected, not a failure to surface.
  if (!error && data) { customerBankingDetails.length = 0; data.forEach(row => customerBankingDetails.push(customerBankingRowToObj(row))); }
  sb.channel("customer-banking-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "customer_banking_details" }, (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;
      if (payload.eventType === "DELETE") { const i = customerBankingDetails.findIndex(b => b.customerId === row.customer_id); if (i >= 0) customerBankingDetails.splice(i, 1); return; }
      const obj = customerBankingRowToObj(row);
      const i = customerBankingDetails.findIndex(b => b.customerId === obj.customerId);
      if (i >= 0) customerBankingDetails[i] = obj; else customerBankingDetails.push(obj);
      notifyLiveUpdateListeners();
    })
    .subscribe();
}
function getBankingDetailsForCustomer(customerId) {
  return customerBankingDetails.find(b => b.customerId === customerId) || null;
}
// Upsert — a customer may not have a banking_details row yet (most
// don't, today). updatedBy/updatedDate are set here, not trusted from
// the caller, same as every other audit-style field in this app.
function saveBankingDetailsForCustomer(customerId, { bankAccountNumber = "", bankAccountHolderName = "", ibanNumber = "", bankSwift = "", bankName = "", bankBranch = "" }, updatedBy) {
  if (!customers.find(c => c.id === customerId)) return { error: "Customer not found." };
  const obj = { customerId, bankAccountNumber, bankAccountHolderName, ibanNumber, bankSwift, bankName, bankBranch, updatedBy, updatedDate: new Date().toISOString().slice(0, 10) };
  const i = customerBankingDetails.findIndex(b => b.customerId === customerId);
  if (i >= 0) customerBankingDetails[i] = obj; else customerBankingDetails.push(obj);
  if (window.__realCloudSession && sb) {
    const row = { customer_id: obj.customerId, bank_account_number: obj.bankAccountNumber, bank_account_holder_name: obj.bankAccountHolderName, iban_number: obj.ibanNumber, bank_swift: obj.bankSwift, bank_name: obj.bankName, bank_branch: obj.bankBranch, updated_by: obj.updatedBy, updated_date: obj.updatedDate };
    serializedPersist("customer_banking:" + customerId, () => sb.from("customer_banking_details").upsert(row).then(({ error }) => {
      if (error && typeof commsToast === "function") commsToast(`Couldn't save banking details: ${error.message}`);
    }));
  }
  return obj;
}

// Soft duplicate detection for Accounts' approval queue — Salman's call,
// from a real past incident: duplicate client records slipped through and
// caused problems downstream in Accounts. Flags a likely match on phone OR
// email against an existing customer rather than hard-blocking creation —
// Sales keeps moving (see the non-blocking note below), Accounts catches
// and resolves the duplicate before it becomes a receivables mess.
function findPossibleDuplicateCustomer(tel, email, excludeId = null) {
  const normEmail = (email || "").trim().toLowerCase();
  return customers.find(c => c.id !== excludeId && (
    c.tel === tel || (normEmail && c.email && c.email.trim().toLowerCase() === normEmail)
  )) || null;
}
// Mirrors the live Add Customer form field-for-field.
//
// New customers start "pending" and show up on Accounts' own "Pending
// Customers" approval queue (moved there from the Approver module 3 Aug
// 2026 — customer verification is an Accounts responsibility, confirmed by
// Salman), but are NOT blocked from use in the meantime — Sales can still
// pick a pending customer on an Enquiry right away, confirmed by Salman.
// Approval here is after-the-fact governance (catching duplicates/bad
// data), not a hard gate that would slow Sales down.
function createCustomer({ name, contactPerson, tel, tel2 = "", email = "", fax = "", vatName = "", vatNo = "", taxPercent = 0, isCredit = false, creditLimit = 0, creditDays = 0, address, crNo = "", country = "Bahrain", openingBalance = 0, salesMan }) {
  if (!name || !contactPerson || !tel || !address) return { error: "Name, Contact Person, Telephone and Address are required." };
  const dup = findPossibleDuplicateCustomer(tel, email);
  const c = { id: nextCustomerCode(), name, contactPerson, tel, tel2, email, fax, vatName, vatNo, taxPercent, isCredit, creditLimit, creditDays, address, crNo, country, openingBalance, salesMan, status: "pending", approvedBy: null, approvalDate: null, rejectionComment: null, possibleDuplicateOf: dup ? dup.id : null };
  customers.push(c);
  persistNewCustomer(c);
  return c;
}
function approveCustomer(customerId, approvedBy) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return { error: "Customer not found." };
  c.status = "approved";
  c.approvedBy = approvedBy;
  c.approvalDate = new Date().toISOString().slice(0, 10);
  c.rejectionComment = null;
  logActivity({ type: "customer-approved", linkedType: "customer", linkedId: c.id, user: approvedBy, message: `Customer ${c.name} (${c.id}) approved` });
  persistCustomerUpdate(c);
  return c;
}
function rejectCustomer(customerId, rejectedBy, comment) {
  const c = customers.find(x => x.id === customerId);
  if (!c) return { error: "Customer not found." };
  if (!comment || !comment.trim()) return { error: "A rejection comment is required." };
  c.status = "rejected";
  c.approvedBy = rejectedBy;
  c.approvalDate = new Date().toISOString().slice(0, 10);
  c.rejectionComment = comment.trim();
  logActivity({ type: "customer-rejected", linkedType: "customer", linkedId: c.id, user: rejectedBy, message: `Customer ${c.name} (${c.id}) rejected — ${comment.trim()}` });
  persistCustomerUpdate(c);
  return c;
}

// ── Cloud-backed enquiries (4 Aug 2026, Phase 2 slice 2) ─────────────
// Same local-cache + optimistic-write pattern as customers.
function enquiryRowToObj(row) {
  return {
    id: row.id, division: row.division, customerId: row.customer_id, prospectName: row.prospect_name,
    contactPerson: row.contact_person, tel: row.tel, email: row.email, requirements: row.requirements,
    source: row.source, salesPerson: row.sales_person, dateCreated: row.date_created,
    followUps: row.follow_ups || [], linkedQuotationId: row.linked_quotation_id
  };
}
function enquiryObjToRow(e) {
  return {
    id: e.id, division: e.division, customer_id: e.customerId, prospect_name: e.prospectName || "",
    contact_person: e.contactPerson, tel: e.tel, email: e.email || "", requirements: e.requirements || "",
    source: e.source, sales_person: e.salesPerson, date_created: e.dateCreated,
    follow_ups: e.followUps || [], linked_quotation_id: e.linkedQuotationId
  };
}
let cloudEnquiriesCacheInitialized = false;
async function initCloudEnquiriesCache() {
  if (!window.__realCloudSession || !sb || cloudEnquiriesCacheInitialized) return;
  cloudEnquiriesCacheInitialized = true;
  const { data, error } = await sb.from("enquiries").select("*").order("created_at", { ascending: true });
  if (!error && data) { enquiries.length = 0; data.forEach(row => enquiries.push(enquiryRowToObj(row))); }
  sb.channel("enquiries-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "enquiries" }, (payload) => {
      if (payload.eventType === "DELETE") {
        const oldRow = payload.old; if (!oldRow) return;
        const i = enquiries.findIndex(e => String(e.id) === String(oldRow.id));
        if (i >= 0) enquiries.splice(i, 1);
        notifyLiveUpdateListeners();
        return;
      }
      const row = payload.new; if (!row) return;
      const mapped = enquiryRowToObj(row);
      const idx = enquiries.findIndex(e => String(e.id) === String(row.id));
      if (payload.eventType === "INSERT") { if (idx < 0) enquiries.push(mapped); else enquiries[idx] = mapped; }
      else if (payload.eventType === "UPDATE") { if (idx >= 0) enquiries[idx] = mapped; }
      notifyLiveUpdateListeners();
    })
    .subscribe();
}
function persistNewEnquiry(e) {
  if (!window.__realCloudSession || !sb) return;
  serializedPersist("enquiries:" + e.id, () => sb.from("enquiries").insert(enquiryObjToRow(e)).then(({ error }) => {
    if (error && typeof commsToast === "function") commsToast(`Couldn't save enquiry ${e.id} to the cloud: ${error.message}`);
  }));
}
function persistEnquiryUpdate(e) {
  if (!window.__realCloudSession || !sb) return;
  serializedPersist("enquiries:" + e.id, () => sb.from("enquiries").update(enquiryObjToRow(e)).eq("id", e.id).then(({ error }) => {
    if (error && typeof commsToast === "function") commsToast(`Couldn't sync enquiry ${e.id} to the cloud: ${error.message}`);
  }));
}
function persistEnquiryDelete(id) {
  if (!window.__realCloudSession || !sb) return;
  serializedPersist("enquiries:" + id, () => sb.from("enquiries").delete().eq("id", id).then(({ error }) => {
    if (error && typeof commsToast === "function") commsToast(`Couldn't delete enquiry ${id} from the cloud: ${error.message}`);
  }));
}

// Enq No format matches the live reference (ENQ04061AMD).
function nextEnquiryNo() { return "ENQ" + String(4061 + enquiries.length).padStart(5, "0") + "AMD"; }
// "Basic" tab (all fields below except followUps) is editable only by the
// assigned salesPerson in the live system — other roles see it locked with a
// banner. Enforced in the UI layer (sales.js), not here.
function createEnquiry({ division, customerId = null, prospectName = "", contactPerson, tel, email = "", requirements = "", source, salesPerson, dateCreated }) {
  if (!customerId && !prospectName) return { error: "Select a Customer or enter a New Prospect Name." };
  const e = {
    id: nextEnquiryNo(), division, customerId, prospectName: customerId ? "" : prospectName,
    contactPerson, tel, email, requirements, source, salesPerson,
    dateCreated: dateCreated || new Date().toISOString().slice(0, 10),
    followUps: [], linkedQuotationId: null
  };
  enquiries.push(e);
  logActivity({ type: "enquiry-created", linkedType: "enquiry", linkedId: e.id, user: salesPerson, message: `Enquiry ${e.id} created for ${customerId ? (customers.find(c => c.id === customerId) || {}).name || customerId : prospectName}` });
  persistNewEnquiry(e);
  return e;
}
// Notes must be at least 10 characters (live Q-Pro form validation).
function addFollowUp(enquiryId, { date, meetingType, outcome, notes }) {
  const e = enquiries.find(x => x.id === enquiryId);
  if (!e) return { error: "Enquiry not found." };
  if (!notes || notes.trim().length < 10) return { error: "Notes must be at least 10 characters." };
  e.followUps.push({ date: date || new Date().toISOString().slice(0, 10), meetingType, outcome, notes: notes.trim() });
  persistEnquiryUpdate(e);
  return e;
}
// "Cancel" on the live Enquiry List is a real permanent delete, not a status
// change — reproduced faithfully here rather than softened into a status flag.
function cancelEnquiry(enquiryId) {
  const idx = enquiries.findIndex(e => e.id === enquiryId);
  if (idx === -1) return { error: "Enquiry not found." };
  enquiries.splice(idx, 1);
  persistEnquiryDelete(enquiryId);
  return { ok: true };
}
// Only available once the Enquiry is linked to a real Customer — reproduces
// the live "Please Select Customer To Proceed!!!" error for prospect-only enquiries.
function canConvertToQuotation(enquiry) { return !!(enquiry && enquiry.customerId); }

// ── Cloud-backed quotations (4 Aug 2026, Phase 2 slice 2) ────────────
// `items`/`auditLog` travel as plain jsonb — see the design note in
// supabase/schema.sql. Every one of quotations' ~10 mutation functions
// below (addQuotationItem, the addBOM* family, submitItemBOM,
// transferQuotationStage, approveQuotation, approverCorrectItem) ends
// with the same one-line persistQuotationUpdate(qtn) call — since the
// whole nested structure is one jsonb column, there's no per-field
// patching needed, just "save the whole row as it stands now."
function quotationRowToObj(row) {
  return {
    id: row.id, rev: row.rev, enquiryId: row.enquiry_id, parentJobId: row.parent_job_id, customerId: row.customer_id,
    projectName: row.project_name, taxPercent: row.tax_percent, contactPerson: row.contact_person,
    withEstimation: row.with_estimation, notes: row.notes, items: row.items || [],
    coveringLetterTemplate: row.covering_letter_template, coveringLetterBody: row.covering_letter_body,
    termsTemplate: row.terms_template, termsBody: row.terms_body,
    lifecycleStatus: row.lifecycle_status, stage: row.stage,
    estimatorPickedBy: row.estimator_picked_by, approverPickedBy: row.approver_picked_by,
    headerComment: row.header_comment, date: row.date, confirmDate: row.confirm_date,
    auditLog: row.audit_log || []
  };
}
function quotationObjToRow(q) {
  return {
    id: q.id, rev: q.rev, enquiry_id: q.enquiryId || null, parent_job_id: q.parentJobId || null, customer_id: q.customerId,
    project_name: q.projectName, tax_percent: q.taxPercent, contact_person: q.contactPerson,
    with_estimation: !!q.withEstimation, notes: q.notes || "", items: q.items || [],
    covering_letter_template: q.coveringLetterTemplate, covering_letter_body: q.coveringLetterBody || "",
    terms_template: q.termsTemplate, terms_body: q.termsBody || "",
    lifecycle_status: q.lifecycleStatus, stage: q.stage,
    estimator_picked_by: q.estimatorPickedBy, approver_picked_by: q.approverPickedBy,
    header_comment: q.headerComment || "", date: q.date, confirm_date: q.confirmDate,
    audit_log: q.auditLog || []
  };
}
let cloudQuotationsCacheInitialized = false;
async function initCloudQuotationsCache() {
  if (!window.__realCloudSession || !sb || cloudQuotationsCacheInitialized) return;
  cloudQuotationsCacheInitialized = true;
  const { data, error } = await sb.from("quotations").select("*").order("created_at", { ascending: true });
  if (!error && data) { quotations.length = 0; data.forEach(row => quotations.push(quotationRowToObj(row))); }
  sb.channel("quotations-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "quotations" }, (payload) => {
      const row = payload.new; if (!row) return;
      const mapped = quotationRowToObj(row);
      const idx = quotations.findIndex(q => String(q.id) === String(row.id));
      if (payload.eventType === "INSERT") { if (idx < 0) quotations.push(mapped); else quotations[idx] = mapped; }
      else if (payload.eventType === "UPDATE") { if (idx >= 0) quotations[idx] = mapped; }
      notifyLiveUpdateListeners();
    })
    .subscribe();
}
function persistNewQuotation(q) {
  if (!window.__realCloudSession || !sb) return;
  serializedPersist("quotations:" + q.id, () => sb.from("quotations").insert(quotationObjToRow(q)).then(({ error }) => {
    if (error && typeof commsToast === "function") commsToast(`Couldn't save quotation ${q.id} to the cloud: ${error.message}`);
  }));
}
function persistQuotationUpdate(q) {
  if (!window.__realCloudSession || !sb) return;
  serializedPersist("quotations:" + q.id, () => sb.from("quotations").update(quotationObjToRow(q)).eq("id", q.id).then(({ error }) => {
    if (error && typeof commsToast === "function") commsToast(`Couldn't sync quotation ${q.id} to the cloud: ${error.message}`);
  }));
}

// ── QUOTATIONS ──
// Qtn No format matches the live reference (AMD-15350-0) — "-0" is revision 0.
const quotations = [];
function nextQtnNo() { return "AMD-" + (15350 + quotations.length) + "-0"; }
function computeQuotationTotals(qtn) {
  let itemTotal = 0, discTotal = 0, vatTotal = 0, netTotal = 0;
  qtn.items.forEach(it => {
    itemTotal += it.amount || 0;
    discTotal += it.discAmt || 0;
    vatTotal += ((it.amount || 0) - (it.discAmt || 0)) * (it.vatPercent || 0) / 100;
    netTotal += it.netAmount || 0;
  });
  return { itemTotal, discTotal, vatTotal, netTotal };
}
// Step 1 of the 3-step wizard. Refuses conversion from a prospect-only
// Enquiry — see canConvertToQuotation() above.
//
// withEstimation is ALWAYS true, unconditionally — Salman's direct
// instruction (3 Aug 2026): sales staff have previously used an
// editable-price path to defraud the company, so pricing must always
// route through the Estimator's BOM, with no opt-out. Do not reintroduce
// a caller-supplied withEstimation param here without Salman explicitly
// asking for it again.
function convertEnquiryToQuotation(enquiryId, { projectName, taxPercent, contactPerson, notes = "" }) {
  const enq = enquiries.find(e => e.id === enquiryId);
  if (!enq) return { error: "Enquiry not found." };
  if (!canConvertToQuotation(enq)) return { error: "Please Select Customer To Proceed!!!" };
  const qtn = {
    id: nextQtnNo(), rev: 0, enquiryId, customerId: enq.customerId,
    projectName, taxPercent, contactPerson, withEstimation: true, notes,
    items: [], coveringLetterTemplate: null, coveringLetterBody: "", termsTemplate: null, termsBody: "",
    lifecycleStatus: "draft", stage: "sales",
    estimatorPickedBy: null, approverPickedBy: null,
    headerComment: "", auditLog: [],
    date: new Date().toISOString().slice(0, 10), confirmDate: null
  };
  quotations.push(qtn);
  enq.linkedQuotationId = qtn.id;
  logQuotationAudit(qtn, { action: "Create", user: enq.salesPerson, userType: "SALES", status: "Draft" });
  persistNewQuotation(qtn);
  persistEnquiryUpdate(enq);
  return qtn;
}
function nextQuotationItemId(qtn) { return qtn.items.length + 1; }
function addQuotationItem(qtnId, item) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  const amount = (item.qty || 0) * (item.rate || 0);
  const discAmt = item.discAmt || (amount * (item.discPercent || 0) / 100);
  const netAmount = qtn.withEstimation ? 0 : (amount - discAmt) * (1 + (item.vatPercent || 0) / 100);
  const enq = enquiries.find(e => e.id === qtn.enquiryId);
  const row = {
    lineId: nextQuotationItemId(qtn), group: item.group || "", subgroup: item.subgroup || "",
    product: item.product, qty: item.qty || 0, unit: item.unit || "Nos",
    rate: qtn.withEstimation ? 0 : (item.rate || 0), amount: qtn.withEstimation ? 0 : amount,
    vatPercent: item.vatPercent || 0, discPercent: item.discPercent || 0, discAmt: qtn.withEstimation ? 0 : discAmt,
    netAmount: qtn.withEstimation ? 0 : netAmount,
    description: item.description || "", internalComments: item.internalComments || "", optional: !!item.optional,
    approverComment: "", // Approver's per-line comment — see setLineApproverComment() below
    bom: null, // set by ensureItemBOM() once the Estimator adds a BOM — see ESTIMATOR section below
    // Job Routing (Batch 8) — auto-suggested now, editable by the Estimator
    // during BOM entry, carried through to the Job Card at confirm time,
    // and only actually finalized into departmentStatuses by the
    // Operations Manager's routing queue (see confirmJobRouting()).
    departmentSequence: suggestDepartmentSequence(item.product, enq ? enq.division : null),
    // Approver corrections (product/description/price) — see
    // approverCorrectItem() below. priceManuallyOverridden flags that this
    // line's rate no longer purely reflects the BOM's own calculated figure.
    corrections: [], priceManuallyOverridden: false
  };
  qtn.items.push(row);
  persistQuotationUpdate(qtn);
  return row;
}
// Copies every item under a Group (or a specific Sub Group within one) as
// new items appended to the end of the quote — same "duplicate then
// tweak" pattern as salesDuplicateItem, just at section granularity so a
// whole area doesn't need retyping line by line. Rate/BOM always reset
// like any new item; group/subgroup labels carry over so the copy lands
// in the same visual section, ready to rename if it's actually a new one.
function copyQuoteSection(qtnId, group, subgroup) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  const matches = qtn.items.filter(it => it.group === group && (subgroup === undefined || subgroup === null || it.subgroup === subgroup));
  if (!matches.length) return { error: "Nothing to copy." };
  return matches.map(it => addQuotationItem(qtnId, {
    group: it.group, subgroup: it.subgroup, product: it.product, qty: it.qty, unit: it.unit,
    vatPercent: it.vatPercent, discPercent: it.discPercent, description: it.description, internalComments: it.internalComments
  }));
}
// Computes the printed/display hierarchy (Group -> Sub Group -> Item) from
// the flat items[] array's own stored group/subgroup strings — a new
// header is introduced wherever the value differs from the previous item,
// no separate group/subgroup entity or ordering field needed. Group# and
// Sub Group# are freshly auto-incremented here (Sub Group resets to 1 for
// each new Group) — this is this app's own numbering rule for quotes
// created going forward, not an attempt to reproduce exact numbers from
// any historical/imported document.
function computeQuoteHierarchy(items) {
  let groupNo = 0, subgroupNo = 0, itemNo = 0;
  let lastGroup = null, lastSubgroup = null, first = true;
  return items.map(it => {
    const isNewGroup = first || it.group !== lastGroup;
    const isNewSubgroup = isNewGroup || it.subgroup !== lastSubgroup;
    if (isNewGroup) { groupNo++; subgroupNo = 0; }
    if (isNewSubgroup) { subgroupNo++; itemNo = 0; }
    itemNo++;
    lastGroup = it.group; lastSubgroup = it.subgroup; first = false;
    return { item: it, isNewGroup, isNewSubgroup, groupNo, subgroupNo, serial: `${groupNo}.${subgroupNo}.${itemNo - 1}` };
  });
}
// Estimator override — the auto-suggestion above is a starting point, not
// a final answer. `sequence` is an ordered array of DEPTS keys.
function setItemDepartmentSequence(qtnId, lineId, sequence) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  item.departmentSequence = sequence || [];
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return item;
}
function removeQuotationItem(qtnId, lineId) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  qtn.items = qtn.items.filter(it => it.lineId !== lineId);
  persistQuotationUpdate(qtn);
  return { ok: true };
}

// Customer Update (Q-Pro Batch 5, Masters -> Administration -> Customer
// Update) — despite the name, a single-quotation correction utility, not a
// customer master editor. Pick one quotation, apply any of three
// independent corrections: reassign Customer/Contact Person, reassign
// salesman, or change VAT%. Distinct from full quotation editing — a
// narrow, guarded "fix a mistake after the fact" tool. Salesman lives on
// the linked Enquiry (quotations don't carry their own salesPerson field),
// so that correction traces qtn -> enquiryId -> salesPerson, same trace
// pattern accountsDivisionForInvoice() already uses elsewhere.
function applyCustomerUpdate(qtnId, { customerId, contactPerson, salesPerson, taxPercent } = {}) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  if (customerId !== undefined) {
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return { error: "Please select a Customer." };
    qtn.customerId = customerId;
  }
  if (contactPerson !== undefined) {
    if (!contactPerson.trim()) return { error: "Contact Person is required." };
    qtn.contactPerson = contactPerson.trim();
  }
  if (salesPerson !== undefined) {
    const enq = enquiries.find(e => e.id === qtn.enquiryId);
    if (enq) { enq.salesPerson = salesPerson; persistEnquiryUpdate(enq); }
  }
  if (taxPercent !== undefined) {
    qtn.taxPercent = Number(taxPercent);
  }
  logQuotationAudit(qtn, { action: "Customer Update", user: "Admin", userType: "SALES", status: qtn.lifecycleStatus });
  persistQuotationUpdate(qtn);
  return qtn;
}
// Step 3 of the wizard — "Update Quotation" on the live system. Stays
// lifecycleStatus "draft" — the live reference trace shows Draft persists
// through the ENTIRE Sales/Estimator/Approver loop, only flipping to "Open"
// when Approver clicks Approve Quote (see approveQuotation() below).
function finaliseQuotation(qtnId, { coveringLetterTemplate, termsTemplate }) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  if (coveringLetterTemplate && COVERING_LETTER_TEMPLATES[coveringLetterTemplate]) {
    qtn.coveringLetterTemplate = coveringLetterTemplate;
    qtn.coveringLetterBody = COVERING_LETTER_TEMPLATES[coveringLetterTemplate](qtn.projectName);
  }
  if (termsTemplate && TERMS_TEMPLATES[termsTemplate]) {
    qtn.termsTemplate = termsTemplate;
    qtn.termsBody = TERMS_TEMPLATES[termsTemplate];
  }
  persistQuotationUpdate(qtn);
  // Deliberately does NOT touch qtn.stage. Before Batch 7 locked pricing
  // unconditionally, this used to auto-set stage to "estimator" when
  // withEstimation was checked — a real bug once withEstimation became
  // always-true (Batch 7): finishing the wizard started silently
  // transferring every quotation to the Estimator with no explicit action,
  // bypassing the Quotation Hub's own "Transfer to Estimator" button
  // (salesTransferToEstimator() in sales.js). Finalizing the wizard should
  // only ever save the covering letter/terms — moving to Estimator is
  // always that separate, deliberate click.
  return qtn;
}
// A hand-off never clears estimatorPickedBy/approverPickedBy — those persist
// for the life of the quotation once set, so returning to a role someone
// already picked (e.g. "Back to Estimator") lands straight in their queue
// instead of back in "Pending to Pick". Logged as "Transfer" regardless of
// which UI action triggered it (Back to Sales, Back to Estimator, Transfer
// to Estimator/Approver) — matches the live audit trail, which uses one
// generic action name for every stage move.
function transferQuotationStage(qtnId, newStage, actorName) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  qtn.stage = newStage;
  logQuotationAudit(qtn, { action: "Transfer", user: actorName, userType: newStage.toUpperCase() });
  logActivity({ type: "quotation-transferred", linkedType: "quotation", linkedId: qtn.id, user: actorName, message: `${qtn.id} moved to ${newStage === "sales" ? "Sales" : newStage === "estimator" ? "Estimator" : "Approver"}` });
  persistQuotationUpdate(qtn);
  return qtn;
}

// ═══════════════════════════════════════
// MODULE 3 — ESTIMATOR
// Rebuilt 25 Jul 2026 from the same live Q-Pro reverse-engineering pass as
// Enquiry/Quotation above. Covers: the Estimator dashboard (Pending to Pick /
// My Actions / With Approver / Confirmed / PR), picking a quotation, and the
// per-item Job Estimation BOM entry (Materials / Labour / Sub Contract /
// Hiring / Others / Summary) with the cost-plus pricing waterfall that
// writes the calculated Selling Price back onto the quotation item.
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// INVENTORY MASTERS (Masters → Inventory → ..., Batch 2 reverse-engineering)
// Unit / Stock Category / Catelog are simple flat lists. Masters → Inventory
// → Vendor (internal route "Group"/"Stock Group") is the vestigial
// duplicate already confirmed in Batch 1 (Purchases) as unused by any real
// transaction — not replicated here, same call as before.
// ═══════════════════════════════════════
const units = ["Box", "Btl", "CBM", "CFT", "Ctn", "Drm", "Gal", "Kg", "LM", "Ltr", "Meters", "Nos", "Pairs", "Pkt", "Roll", "Sets", "Sheet", "Sqmtr", "Yard"]
  .map(name => ({ name, status: "Enabled" }));

const stockCategories = [
  "Balance Fabrics (Curtain/Upholstery)", "Chemical Items", "Disposable Items", "Workshop Tools & Accessories",
  "Others", "Joinery Consumables", "Packaging Materials", "Printing & Stationary", "Non Stock Fabrics",
  "Carpets & Floorings", "Roller Blind & Accessories", "Curtain Tracks & Accessories", "Sample Books",
  "Stock Furniture", "Upholstery Consumables"
].map(name => ({ name }));

function addUnit(name) {
  if (!name || !name.trim()) return { error: "Name is required." };
  const u = { name: name.trim(), status: "Enabled" };
  units.push(u);
  return u;
}
function addStockCategory(name) {
  if (!name || !name.trim()) return { error: "Name is required." };
  const c = { name: name.trim() };
  stockCategories.push(c);
  return c;
}

// Catelog ("Brand") — a product line/collection tagged to a specific
// supplier, e.g. a manufacturer's fabric collection. Empty seed; grows as
// items get catalogued through the Inventory module.
const catelogs = [];
function nextCatelogId() { return "CAT-" + String(catelogs.length + 1).padStart(3, "0"); }
function createCatelog({ name, vendorId = null } = {}) {
  if (!name || !name.trim()) return { error: "Name is required." };
  const cat = { id: nextCatelogId(), name: name.trim(), vendorId };
  catelogs.push(cat);
  return cat;
}

// ── ITEM MASTER (Masters → Inventory → Item) ──
// The real item catalogue, superseding the small placeholder seed that used
// to stand in for it (Estimator's BOM Materials-tab typeahead now reads
// from this real master via searchItemMaster()/ITEM_MASTER below).
const itemMaster = [];
function nextItemStockCode() {
  // Continues after the highest real Q-Pro code in the seeded master
  // (the real export runs IT003318-IT003517), not a length-based counter —
  // seeded items carry their real ids, so length no longer tracks the max.
  const max = itemMaster.reduce((m, it) => {
    const n = parseInt(String(it.id).replace(/^IT/, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 3499);
  return "IT" + String(max + 1).padStart(6, "0");
}
function createItemMasterEntry({
  id = null, stockCategory, vendorId = null, catelogId = null, vatPercent = 10, name,
  rollWidth = null, packing = "", unit, cost = 0, sellingPrice = 0, reorderLevel = 0,
  description = "", purchaseAllowed = true, salesAllowed = true, rawMaterial = false,
  openingStock = 0, lastPurchaseRate = 0
} = {}) {
  if (!stockCategory) return { error: "Stock Category is required." };
  if (!name || !name.trim()) return { error: "Stock Name is required." };
  if (!unit) return { error: "Units is required." };
  const item = {
    id: id || nextItemStockCode(), stockCategory, vendorId, catelogId, vatPercent: Number(vatPercent) || 0,
    name: name.trim(), rollWidth: rollWidth ? Number(rollWidth) : null, packing, unit,
    cost: Number(cost) || 0, avgCost: Number(cost) || 0, sellingPrice: Number(sellingPrice) || 0,
    reorderLevel: Number(reorderLevel) || 0, description,
    purchaseAllowed: !!purchaseAllowed, salesAllowed: !!salesAllowed, rawMaterial: !!rawMaterial,
    openingStock: Number(openingStock) || 0, closingStock: Number(openingStock) || 0, lastPurchaseRate: Number(lastPurchaseRate) || 0
  };
  itemMaster.push(item);
  return item;
}
function updateItemMasterEntry(itemId, patch) {
  const it = itemMaster.find(i => i.id === itemId);
  if (!it) return null;
  Object.assign(it, patch);
  return it;
}

// Curtain rail/track items — now carrying their REAL legacy Q-Pro item
// codes, matching the Storekeeper stock-pool's itemCode references above
// (IT002395/IT001886/IT330/IT450/IT362 — the short legacy codes are padded
// to the IT000NNN shape here so one parser handles all ids).
// "Test Curtain Fabric" is the hand-authored trace record the seed
// quotation references — kept, parked on an out-of-range id.
[
  { id: "IT001886", name: "Aluminium U-Shape Head Rail — Ningbo CH016", stockCategory: "Curtain Tracks & Accessories", unit: "Meters", cost: 4.2, openingStock: 120 },
  { id: "IT002395", name: "Cord Rail — Heavy Duty White (COR001)", stockCategory: "Curtain Tracks & Accessories", unit: "Meters", cost: 3.6, openingStock: 85 },
  { id: "IT000450", name: "Somfy Glydea Track — raw rail", stockCategory: "Curtain Tracks & Accessories", unit: "Meters", cost: 28.5, openingStock: 14 },
  { id: "IT000330", name: "Unisoiel Cord Track — DC01 Heavy", stockCategory: "Curtain Tracks & Accessories", unit: "Meters", cost: 5.1, openingStock: 60 },
  { id: "IT000362", name: "Roman Blind Headrail — Unisoiel RAE01", stockCategory: "Roller Blind & Accessories", unit: "Nos", cost: 6.8, openingStock: 22 },
  { id: "IT000001", name: "Test Curtain Fabric - Mapping Exercise", stockCategory: "Non Stock Fabrics", unit: "Meters", cost: 2.0, openingStock: 500 }
].forEach(seed => createItemMasterEntry(seed));

// ── REAL ITEM MASTER — StockItemExcelExport, uploaded 6 Aug 2026 ──
// The full live stock item export: 200 items, real Q-Pro codes
// (IT003318-IT003517), real cost / selling price / closing stock / last
// purchase rate. Negative closing stock is real source data (uncorrected
// stock drift in the live system), kept honestly rather than zeroed.
// stockCategory/unit are INFERRED from the item-code prefix conventions
// (ACC/CHA/HIN->Joinery Consumables, UPHACC/FOA->Upholstery, CURACC->Curtain
// Tracks, PAI/PRI/HAR/PUT->Chemical, TOO/BIT->Tools, unprefixed names are
// fabric collections->Balance Fabrics, ...) — correct any wrong guesses in
// Storekeeper -> Item Master, they're plain editable fields.
[
  { id: "IT003517", name: "ACC046 CHALK LINE POWDER SET", stockCategory: "Joinery Consumables", unit: "Nos", cost: 1.2, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 1.2 },
  { id: "IT003516", name: "ACC045 THREAD BUSH FOR WOOD", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.02, sellingPrice: 0, openingStock: -100, lastPurchaseRate: 0 },
  { id: "IT003515", name: "MDF039 MFC PVC EDGE/BNDG 22X1MM BRIGHT WHITE-S 511 (AG)", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.2, sellingPrice: 0, openingStock: 50, lastPurchaseRate: 0.2 },
  { id: "IT003514", name: "UPHACC021 SOFA CLIP-26MM -4 HOLE", stockCategory: "Upholstery Consumables", unit: "Nos", cost: 0.01, sellingPrice: 0, openingStock: -96, lastPurchaseRate: 0 },
  { id: "IT003513", name: "ACC044 EVA Hot Melt Edgetherm Unfilled Clear 20Kg", stockCategory: "Joinery Consumables", unit: "Nos", cost: 2.25, sellingPrice: 0, openingStock: 20, lastPurchaseRate: 2.25 },
  { id: "IT003512", name: "KALIMA 4545/20", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.2, sellingPrice: 0, openingStock: 65, lastPurchaseRate: 0 },
  { id: "IT003511", name: "CURACC020 PLAIN PIPE (SILVER)", stockCategory: "Curtain Tracks & Accessories", unit: "Nos", cost: 0.825, sellingPrice: 0, openingStock: 60, lastPurchaseRate: 0.863 },
  { id: "IT003510", name: "ELE035 ELECTRICAL DIMMER", stockCategory: "Others", unit: "Nos", cost: 4.5, sellingPrice: 0, openingStock: -3, lastPurchaseRate: 0 },
  { id: "IT003509", name: "ELE034 LED DRIVER 400 WATT-24V", stockCategory: "Others", unit: "Nos", cost: 0, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003508", name: "ELE033 LED DRIVER 200 WATT-24V", stockCategory: "Others", unit: "Nos", cost: 0, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003507", name: "ELE032 LED DRIVER 100 WATT-24", stockCategory: "Others", unit: "Nos", cost: 0, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003506", name: "ACC043 KLEIBERIT 773.3 EVA HOT MELT BEIGE TRANSPARENT-20 KG", stockCategory: "Joinery Consumables", unit: "Nos", cost: 3.5, sellingPrice: 0, openingStock: 20, lastPurchaseRate: 3.5 },
  { id: "IT003505", name: "ACC042 KLEIBERIT HOT PRESS ADHESIVE-25 KG", stockCategory: "Joinery Consumables", unit: "Nos", cost: 1.8, sellingPrice: 0, openingStock: 10, lastPurchaseRate: 1.8 },
  { id: "IT003504", name: "UPHACC012 VELCRO HOOK & LOOP-50MM-WHITE-NORMAL M/F", stockCategory: "Upholstery Consumables", unit: "Nos", cost: 0.067, sellingPrice: 0, openingStock: 259.5, lastPurchaseRate: 0 },
  { id: "IT003503", name: "Nassaj 5027 / 03", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.5, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 0 },
  { id: "IT003502", name: "NASSAJ N11024-002", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 17.992, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003501", name: "NASSAJ N9091-024C", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 21.992, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003500", name: "NASSAJ N8051-015", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 12.99, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003499", name: "NASSAJ N9049-002", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 12.99, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003498", name: "NASSAJ N9049-006", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 12.99, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003497", name: "NASSAJ N9033-007", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.8, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 1.837 },
  { id: "IT003496", name: "TOO099 CORDLESS DRILL(TIGHTER) 18V", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 65, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 65 },
  { id: "IT003495", name: "Nassaj N9039-003", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.6, sellingPrice: 0, openingStock: 2.5, lastPurchaseRate: 2.652 },
  { id: "IT003494", name: "Nassaj A11010-021", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2, sellingPrice: 0, openingStock: 3, lastPurchaseRate: 2.04 },
  { id: "IT003493", name: "Nassaj N7003-006", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.9, sellingPrice: 0, openingStock: 2.01, lastPurchaseRate: 1.836 },
  { id: "IT003492", name: "CURACC013 CURTAIN TAPE(50 MTR)", stockCategory: "Curtain Tracks & Accessories", unit: "Nos", cost: 0.07, sellingPrice: 0, openingStock: -43, lastPurchaseRate: 0 },
  { id: "IT003491", name: "Nassaj N11011-002", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.5, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 1.4 },
  { id: "IT003490", name: "Nassaj N9067-002", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.7, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 1.587 },
  { id: "IT003489", name: "Nassaj N9033-009", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.8, sellingPrice: 0, openingStock: 2.5, lastPurchaseRate: 1.68 },
  { id: "IT003488", name: "CURFAB010 FABRIC 100 (1 MTR @ 1.5 BD)", stockCategory: "Non Stock Fabrics", unit: "Meters", cost: 1.5, sellingPrice: 0, openingStock: -10.5, lastPurchaseRate: 0 },
  { id: "IT003487", name: "PAI072 WB COLOR SYSTEM BASE EXTERIOR WHITE + COLORANT(JAZZ WHITE)", stockCategory: "Chemical Items", unit: "Nos", cost: 6, sellingPrice: 0, openingStock: -6, lastPurchaseRate: 0 },
  { id: "IT003486", name: "BOL033 LN BOLT 8MM X 40MM", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.5, sellingPrice: 0, openingStock: 100, lastPurchaseRate: 0.09 },
  { id: "IT003485", name: "PIN012 STAPLES 14/08", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.03, sellingPrice: 0, openingStock: -75, lastPurchaseRate: 0 },
  { id: "IT003484", name: "CURFAB007 ROLLER BLIND FABRIC-216566RFR-1-300", stockCategory: "Roller Blind & Accessories", unit: "Nos", cost: 6.79, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003483", name: "CURFAB006 ROLLER BLIND FABRIC-263112-1-290", stockCategory: "Roller Blind & Accessories", unit: "Nos", cost: 3.63, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003482", name: "CURFAB005 LINING PLAIN 53117-4331011016", stockCategory: "Non Stock Fabrics", unit: "Meters", cost: 3.082, sellingPrice: 0, openingStock: 3, lastPurchaseRate: 3.082 },
  { id: "IT003481", name: "BOL032 BOLT 8MM X 3.5 CM", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.03, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003480", name: "CURACC010 SEWING NEEDLE-NORMAL", stockCategory: "Curtain Tracks & Accessories", unit: "Nos", cost: 0.364, sellingPrice: 0, openingStock: 6, lastPurchaseRate: 0.364 },
  { id: "IT003479", name: "UPHACC006 ZIPPER-20''(1 PKT-50 NOS) MIXED COLOURS", stockCategory: "Upholstery Consumables", unit: "Nos", cost: 0.018, sellingPrice: 0, openingStock: 1388, lastPurchaseRate: 0.021 },
  { id: "IT003478", name: "GUTHMI - 4848011048", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.2, sellingPrice: 0, openingStock: 6, lastPurchaseRate: 0 },
  { id: "IT003477", name: "5125 010051", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.5, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 0 },
  { id: "IT003476", name: "Deera 20235-8", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 0.909, sellingPrice: 0, openingStock: 3, lastPurchaseRate: 0 },
  { id: "IT003475", name: "Nassaj M 9010/11A", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.836, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 0 },
  { id: "IT003474", name: "Dazzle - DF 380 / 17", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 3.937, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 0 },
  { id: "IT003473", name: "Dazzle - DF 380 / 14", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.901, sellingPrice: 0, openingStock: 18, lastPurchaseRate: 0 },
  { id: "IT003472", name: "5033 010 052", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.455, sellingPrice: 0, openingStock: 20, lastPurchaseRate: 0 },
  { id: "IT003471", name: "Warwick Chambray Feather with FR", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 7.128, sellingPrice: 0, openingStock: 7, lastPurchaseRate: 0 },
  { id: "IT003470", name: "Varenna AC InFR Col. 300 Width: +/-140cm", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 13.545, sellingPrice: 0, openingStock: 21, lastPurchaseRate: 0 },
  { id: "IT003469", name: "Nassaj 5002-21", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.326, sellingPrice: 0, openingStock: 0.5, lastPurchaseRate: 0 },
  { id: "IT003468", name: "Nassaj N 9024 - 019 B", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.856, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 0 },
  { id: "IT003467", name: "KL Himalayas -14", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 3.9, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003466", name: "Nassaj 9016/01", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.53, sellingPrice: 0, openingStock: 1.5, lastPurchaseRate: 0 },
  { id: "IT003465", name: "Nassaj 9016/06", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.53, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003464", name: "Nassaj :N 9095/002D", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.222, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003463", name: "Sahim Cesar 1068/11", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.04, sellingPrice: 0, openingStock: 2.5, lastPurchaseRate: 0 },
  { id: "IT003462", name: "Guthmi 13125 / 01", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 4.6, sellingPrice: 0, openingStock: 25.5, lastPurchaseRate: 0 },
  { id: "IT003461", name: "Nassaj 9016/07", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.53, sellingPrice: 0, openingStock: 0.2, lastPurchaseRate: 0 },
  { id: "IT003460", name: "Guthmi 13199/ 4", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.3, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003459", name: "Kilani Fabric 2465 / 22", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.9, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 0 },
  { id: "IT003458", name: "Janoub 4170 - 9", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.465, sellingPrice: 0, openingStock: 1.5, lastPurchaseRate: 0 },
  { id: "IT003457", name: "Fibre Guard - Evoke, Design: MOOD, Colour: 30 - Canyon", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 9.55, sellingPrice: 0, openingStock: 1.5, lastPurchaseRate: 0 },
  { id: "IT003456", name: "5051/32", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.2, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003455", name: "MANTILLA-19-RUSTIC-MANTILLA", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 14.42, sellingPrice: 0, openingStock: 10, lastPurchaseRate: 0 },
  { id: "IT003454", name: "Nassaj - 9061 B - 32", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.836, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 0 },
  { id: "IT003453", name: "N7047-10 CHENILLE SMART 1C 4040", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.04, sellingPrice: 0, openingStock: 1.5, lastPurchaseRate: 0 },
  { id: "IT003452", name: "Nassaj 9016/03", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.53, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 0 },
  { id: "IT003451", name: "Hamasat 501 / 30", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.36, sellingPrice: 0, openingStock: 8, lastPurchaseRate: 0 },
  { id: "IT003450", name: "ALCANTA - 152/01", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 9.246, sellingPrice: 0, openingStock: 0.5, lastPurchaseRate: 0 },
  { id: "IT003449", name: "Home Ideas 1011 / 7", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.1, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 0 },
  { id: "IT003448", name: "D3 515 /19", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 5.6, sellingPrice: 0, openingStock: 5, lastPurchaseRate: 0 },
  { id: "IT003447", name: "Guthmi - 13090 / 44", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 4.3, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 0 },
  { id: "IT003446", name: "DF 420-01", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 3.937, sellingPrice: 0, openingStock: 2.5, lastPurchaseRate: 0 },
  { id: "IT003445", name: "Nassaj 9024/02", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.856, sellingPrice: 0, openingStock: 0.5, lastPurchaseRate: 0 },
  { id: "IT003444", name: "Gadeer 792/31", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.1, sellingPrice: 0, openingStock: 12, lastPurchaseRate: 0 },
  { id: "IT003443", name: "Guthmi 13147 / 17", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2, sellingPrice: 0, openingStock: 1.5, lastPurchaseRate: 0 },
  { id: "IT003442", name: "Ghadeer 5051/03", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003441", name: "Janoub 4170/04", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.58, sellingPrice: 0, openingStock: 8, lastPurchaseRate: 0 },
  { id: "IT003440", name: "Signature Leather - 12 - Black", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 3.937, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003439", name: "Fibre guard Sitout 09 Aluminum", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 11.55, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003438", name: "Riyami - Micro Suede SEN-3053", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.761, sellingPrice: 0, openingStock: 2.5, lastPurchaseRate: 0 },
  { id: "IT003437", name: "Nomenclatura combinata/Hs Customs code : 41071291 Pelli bovine fiore - Tanned bovine leathers", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 13.696, sellingPrice: 0, openingStock: 4.5, lastPurchaseRate: 0 },
  { id: "IT003436", name: "York - Beverly M1316", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 10.774, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003435", name: "YORK - CHELSEA M1223", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 10.774, sellingPrice: 0, openingStock: 1.5, lastPurchaseRate: 0 },
  { id: "IT003434", name: "5033 010 041", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.364, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003433", name: "Guthmi 13305 / 15", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 7.6, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003432", name: "York - 152 / 07", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 9.246, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003431", name: "Fabric: HF Beige", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 12.95, sellingPrice: 0, openingStock: 5, lastPurchaseRate: 0 },
  { id: "IT003430", name: "Kilani - 2330 / 24", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 5, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 0 },
  { id: "IT003429", name: "Guthmi-4928010037", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 6.5, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 0 },
  { id: "IT003428", name: "Guthmi - 4314013014", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 14.2, sellingPrice: 0, openingStock: 0.5, lastPurchaseRate: 0 },
  { id: "IT003427", name: "Guthmi 4881011014", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 4, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003426", name: "D3 201 -18", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.8, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003425", name: "Nassaj N9027-17A", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.8, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 0 },
  { id: "IT003424", name: "Nassaj M 889 - 05", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 3.978, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 0 },
  { id: "IT003423", name: "Guthmi 4881014014", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 4, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 0 },
  { id: "IT003422", name: "5125 010 032", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.5, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 0 },
  { id: "IT003421", name: "Guthmi 4738 010 038", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 4, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 0 },
  { id: "IT003420", name: "D3 231/16", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 3.8, sellingPrice: 0, openingStock: 3.5, lastPurchaseRate: 0 },
  { id: "IT003419", name: "Guthmi - Arqana Chenille - 13125 / 7", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 4.6, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 0 },
  { id: "IT003418", name: "Nassaj - 9067 - 07", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.734, sellingPrice: 0, openingStock: 8, lastPurchaseRate: 0 },
  { id: "IT003417", name: "Guthmi 13147 / 4", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2, sellingPrice: 0, openingStock: 3, lastPurchaseRate: 0 },
  { id: "IT003416", name: "5110010101", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2, sellingPrice: 0, openingStock: 5, lastPurchaseRate: 0 },
  { id: "IT003415", name: "D3 503/33 - Leather", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 5.4, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 0 },
  { id: "IT003414", name: "CURACC009 NORMAL THREAD-MIXED COLOURS", stockCategory: "Curtain Tracks & Accessories", unit: "Nos", cost: 1, sellingPrice: 0, openingStock: -1.65, lastPurchaseRate: 0 },
  { id: "IT003413", name: "CAB017 ELECTRICAL WIRE 1 CORE 4.0MM (1X91MTR)", stockCategory: "Others", unit: "Nos", cost: 0.2, sellingPrice: 0, openingStock: 180, lastPurchaseRate: 0 },
  { id: "IT003412", name: "ELE031 ELECTRICAL ISOLATOR SWITCH", stockCategory: "Others", unit: "Nos", cost: 2, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003411", name: "ELE030 ELECTRICAL FLOOR SOCKET DOUBLE(STEEL) 13A", stockCategory: "Others", unit: "Nos", cost: 1.5, sellingPrice: 0, openingStock: 5, lastPurchaseRate: 0 },
  { id: "IT003410", name: "UPHACC005 PIPING 5MM (ROLL 50MTR)", stockCategory: "Upholstery Consumables", unit: "Roll", cost: 0.04, sellingPrice: 0, openingStock: 490, lastPurchaseRate: 0.04 },
  { id: "IT003409", name: "SUN MAR NATURAL SUNB 5020 152 - SUNBRELLA", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 6.539, sellingPrice: 0, openingStock: 12, lastPurchaseRate: 0 },
  { id: "IT003408", name: "SUN MAR MARINE BLUSUNB 5031 152 - SUNBRELLA", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 6.539, sellingPrice: 0, openingStock: 70, lastPurchaseRate: 0 },
  { id: "IT003407", name: "TOO098 NUT SOCKET SET(3 IN 1 SET)-13 MM", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 2, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003406", name: "CURACC008 WAXED LEATHER THREAD-MIXED COLOURS", stockCategory: "Curtain Tracks & Accessories", unit: "Nos", cost: 2.548, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003405", name: "UPHACC004 PIPING 6MM (ROLL 50MTR)", stockCategory: "Upholstery Consumables", unit: "Roll", cost: 0.027, sellingPrice: 0, openingStock: 240, lastPurchaseRate: 0.027 },
  { id: "IT003404", name: "Sheer - Nassaj - C 811 / 03", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.2, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003403", name: "Kilani - 1710 / 18", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 1.5, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 0 },
  { id: "IT003402", name: "4629013024", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 11.05, sellingPrice: 0, openingStock: 0.75, lastPurchaseRate: 0 },
  { id: "IT003401", name: "4430010022", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 6.1, sellingPrice: 0, openingStock: 0.3, lastPurchaseRate: 0 },
  { id: "IT003400", name: "4031010014", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.5, sellingPrice: 0, openingStock: 0.8, lastPurchaseRate: 0 },
  { id: "IT003399", name: "Nassaaj 9091/ 25", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.5, sellingPrice: 0, openingStock: 5, lastPurchaseRate: 0 },
  { id: "IT003398", name: "Nassaj 9055 - Z 15", stockCategory: "Balance Fabrics (Curtain/Upholstery)", unit: "Meters", cost: 2.3, sellingPrice: 0, openingStock: 0.5, lastPurchaseRate: 0 },
  { id: "IT003397", name: "FOA124 FOAM-200X180X2.5CM-100D", stockCategory: "Upholstery Consumables", unit: "Nos", cost: 6.4, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 6.4 },
  { id: "IT003396", name: "ELE029 DP SWITCH WHITE NEON", stockCategory: "Others", unit: "Nos", cost: 2.375, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 2.375 },
  { id: "IT003395", name: "HAR005 WB HARDNER BASECOAT", stockCategory: "Chemical Items", unit: "Nos", cost: 13, sellingPrice: 0, openingStock: 1.6, lastPurchaseRate: 13 },
  { id: "IT003394", name: "PRI010 THIXOTROPIC EXTERIOR WHITE PRIMER-25 KG", stockCategory: "Chemical Items", unit: "Nos", cost: 4.2, sellingPrice: 0, openingStock: 14, lastPurchaseRate: 4.2 },
  { id: "IT003393", name: "LOC011 DRAWER LOCK 20 & 30 MM", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.5, sellingPrice: 0, openingStock: 10, lastPurchaseRate: 0.5 },
  { id: "IT003392", name: "TOO097 SPRAY PAINT GUN W-77G 2MM NOZLE", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 18, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 18 },
  { id: "IT003391", name: "ACC041 CAM BOLT STEEL - KD", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.04, sellingPrice: 0, openingStock: 1000, lastPurchaseRate: 0 },
  { id: "IT003390", name: "ACC040 PLASTIC BUSH", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.001, sellingPrice: 0, openingStock: 500, lastPurchaseRate: 0 },
  { id: "IT003389", name: "ACC039 CAM LOCK NUT - KD", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.001, sellingPrice: 0, openingStock: 1000, lastPurchaseRate: 0 },
  { id: "IT003388", name: "CHA051 SIDE CHANEL SOF CLOSE 250 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003387", name: "CHA050 SIDE CHANEL PUSH OPEN 250 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003386", name: "CHA049 SIDE CHANEL PUSH OPEN 550 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003385", name: "CHA048 SIDE CHANEL SOFT CLOSE 600 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003384", name: "CHA047 SIDE CHANEL PUSH OPEN 600 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003383", name: "NUT004 NUT 10MM", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.008, sellingPrice: 0, openingStock: -5, lastPurchaseRate: 0 },
  { id: "IT003382", name: "NUT003 NUT 8MM", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.006, sellingPrice: 0, openingStock: -16, lastPurchaseRate: 0 },
  { id: "IT003381", name: "CHA046 SIDE CHANEL SOFT CLOSE 500 MM LENGTH - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 2.2, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 2.4 },
  { id: "IT003380", name: "HIN035 HINGES MOUNTING PLATE - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.15, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 0.2 },
  { id: "IT003379", name: "HIN034 HNGES THREE QUARTER SOFT CLOSE - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.55, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 0.6 },
  { id: "IT003378", name: "CHA045 BOTTOM CHANEL PUSH OPEN 500 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 4.714 },
  { id: "IT003377", name: "CHA044 BOTTOM CHANEL PUSH OPEN 450 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 4.4, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 4.609 },
  { id: "IT003376", name: "CHA043 BOTTOM CHANEL PUSH OPEN 400 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 4.2, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 4.399 },
  { id: "IT003375", name: "CHA042 BOTTOM CHANEL PUSH OPEN 300 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 4, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 4.19 },
  { id: "IT003374", name: "CHA041 BOTTOM CHANEL SOFT CLOSE 550 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 4.8, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 5.028 },
  { id: "IT003373", name: "CHA040 BOTTOM CHANEL NORMAL 400 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 4.3, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 4.504 },
  { id: "IT003372", name: "CHA039 BOTTOM CHANEL NORMAL 350 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 4.1, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 4.295 },
  { id: "IT003371", name: "CHA038 BOTTOM CHANEL SOFT CLOSE 300 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 4, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 4.19 },
  { id: "IT003370", name: "CURACC005 PVC ROD (1Lenght x 6 Mtr)", stockCategory: "Curtain Tracks & Accessories", unit: "Nos", cost: 0.1, sellingPrice: 0, openingStock: -12, lastPurchaseRate: 0 },
  { id: "IT003369", name: "HIN033 CONCEALED HINGES 2.5 INCH (PAIR)", stockCategory: "Joinery Consumables", unit: "Nos", cost: 3.5, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 3.5 },
  { id: "IT003368", name: "NAI022 HEAD NAIL 2 INCH (1PktX100Nos)", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.002, sellingPrice: 0, openingStock: 16, lastPurchaseRate: 0.25 },
  { id: "IT003367", name: "NAI021 HEAD NAIL 1.5 INCH (1PktX100Nos)", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.002, sellingPrice: 0, openingStock: 16, lastPurchaseRate: 0.25 },
  { id: "IT003366", name: "NAI020 HEAD NAIL 3'' INCH", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.003, sellingPrice: 0, openingStock: 16, lastPurchaseRate: 0.25 },
  { id: "IT003365", name: "ACC037 SHELF BUTTON WHITE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.016, sellingPrice: 0, openingStock: 382, lastPurchaseRate: 0.016 },
  { id: "IT003364", name: "ACC036 SHELF BUTTON BROWN", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.016, sellingPrice: 0, openingStock: 360, lastPurchaseRate: 0.016 },
  { id: "IT003363", name: "ACC035 SHELF BUTTON CLEAR", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.016, sellingPrice: 0, openingStock: 494, lastPurchaseRate: 0.016 },
  { id: "IT003362", name: "MDF038 MFC PVC EDGE/BNDG 22X1MM LIGHT GREY", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.2, sellingPrice: 0, openingStock: 50, lastPurchaseRate: 0.2 },
  { id: "IT003361", name: "MDF037 MFC (INNOVUS) 2800X2070X18mm BS LIGHT GREY", stockCategory: "Joinery Consumables", unit: "Nos", cost: 29, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 29 },
  { id: "IT003360", name: "MDF036 MDF BEECH VENEER 2 SIDE 4X8X18MM (CROWN)", stockCategory: "Joinery Consumables", unit: "Nos", cost: 12.5, sellingPrice: 0, openingStock: 10, lastPurchaseRate: 12.5 },
  { id: "IT003359", name: "PAI071 NC NATIONAL MATT S8500-N 3.6 Ltr", stockCategory: "Chemical Items", unit: "Nos", cost: 3.194, sellingPrice: 0, openingStock: 25.2, lastPurchaseRate: 3.194 },
  { id: "IT003358", name: "ELE026 SOLDERING WIRE (for Soldering)", stockCategory: "Others", unit: "Nos", cost: 3, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003357", name: "ACC034 HANGING CLIP PLASTIC", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.15, sellingPrice: 0, openingStock: -60, lastPurchaseRate: 0 },
  { id: "IT003356", name: "VEN018 RECON VENEER - Oak 633S 0.5mm", stockCategory: "Joinery Consumables", unit: "Nos", cost: 1.6, sellingPrice: 0, openingStock: 21.25, lastPurchaseRate: 1.6 },
  { id: "IT003355", name: "TOO096 PAINT ROLLER HANDLE (LONG) 4 INCH", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 0.5, sellingPrice: 0, openingStock: -2, lastPurchaseRate: 0 },
  { id: "IT003354", name: "ACC033 NAIL BUSH BROWN & WHITE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.04, sellingPrice: 0, openingStock: -54, lastPurchaseRate: 0 },
  { id: "IT003353", name: "ACC032 PLASTIC / MAGNETIC PUSHOPEN WHITE 5 CM", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.25, sellingPrice: 0, openingStock: -8, lastPurchaseRate: 0 },
  { id: "IT003352", name: "PUT021 PUTTY MAHOGANY NO 10 (200Grm Bottle)", stockCategory: "Chemical Items", unit: "Nos", cost: 0.6, sellingPrice: 0, openingStock: 16, lastPurchaseRate: 0 },
  { id: "IT003351", name: "PAI070 RICH GOLD 4000 (PAINT POWDER) 500ML", stockCategory: "Chemical Items", unit: "Nos", cost: 2.5, sellingPrice: 0, openingStock: 2, lastPurchaseRate: 0 },
  { id: "IT003350", name: "PAI069 NC TOP COAT COMFORT WHITE PAINT (1X3.6LTR)", stockCategory: "Chemical Items", unit: "Nos", cost: 1.83, sellingPrice: 0, openingStock: 14.4, lastPurchaseRate: 2.638 },
  { id: "IT003349", name: "PAI068 NC WOOD STAIN - 38 (1X3.6LTR)", stockCategory: "Chemical Items", unit: "Nos", cost: 1.638, sellingPrice: 0, openingStock: 3.6, lastPurchaseRate: 0 },
  { id: "IT003348", name: "VEN017 VENEER WALNUT (A.GR) QTR PANEL lgth", stockCategory: "Joinery Consumables", unit: "Nos", cost: 3.6, sellingPrice: 0, openingStock: 39.33, lastPurchaseRate: 3.6 },
  { id: "IT003347", name: "WAS007 GI Washer 30MM", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.004, sellingPrice: 0, openingStock: -39, lastPurchaseRate: 0 },
  { id: "IT003346", name: "WAS006 GI Washer 20MM-Large O", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.002, sellingPrice: 0, openingStock: -20, lastPurchaseRate: 0 },
  { id: "IT003345", name: "WAS005 GI Washer 20MM-Small O", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.002, sellingPrice: 0, openingStock: -127, lastPurchaseRate: 0 },
  { id: "IT003344", name: "WAS004 GI Washer 30MM", stockCategory: "Joinery Consumables", unit: "Nos", cost: 0.003, sellingPrice: 0, openingStock: -35, lastPurchaseRate: 0 },
  { id: "IT003343", name: "LOC010 DOOR STOPER MAGNATIC", stockCategory: "Joinery Consumables", unit: "Nos", cost: 1, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003342", name: "CURACC007 BATON ROD 150 CMS", stockCategory: "Curtain Tracks & Accessories", unit: "Nos", cost: 2.25, sellingPrice: 0, openingStock: 40, lastPurchaseRate: 1.865 },
  { id: "IT003341", name: "WOO028 IROKO WOOD KD2", stockCategory: "Joinery Consumables", unit: "Nos", cost: 45, sellingPrice: 0, openingStock: 3.564, lastPurchaseRate: 45 },
  { id: "IT003340", name: "BIT076 HSS COBALT TWIST DRILL BIT-5MM", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 0.9, sellingPrice: 0, openingStock: 3, lastPurchaseRate: 0.9 },
  { id: "IT003339", name: "BIT075 POWERBIT/TIGHTER 100MM(GOLDEN COLOUR)", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 0.37, sellingPrice: 0, openingStock: 10, lastPurchaseRate: 0.37 },
  { id: "IT003338", name: "TOO095 STRAIGHT FILES 200MM-08''", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 1.25, sellingPrice: 0, openingStock: 10, lastPurchaseRate: 1.25 },
  { id: "IT003337", name: "TOO094 HALF ROUND FILES 200MM-08''", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 1.25, sellingPrice: 0, openingStock: 10, lastPurchaseRate: 1.25 },
  { id: "IT003336", name: "ROP001 CURTAIN ROPE WEIGHT 2KG/ROLL(50G/M", stockCategory: "Curtain Tracks & Accessories", unit: "Roll", cost: 6.091, sellingPrice: 0, openingStock: 10, lastPurchaseRate: 6.091 },
  { id: "IT003335", name: "MET012 METAL TUBE 80X40X3MM", stockCategory: "Joinery Consumables", unit: "Nos", cost: 9, sellingPrice: 0, openingStock: -6, lastPurchaseRate: 0 },
  { id: "IT003334", name: "CHA037 BOTTOM CHANEL PUSH OPEN 350 MM - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 4.1, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 4.295 },
  { id: "IT003333", name: "CHA036 BOTTOM CHANEL SOFT CLOSE 350 MM 30 KG - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 4.1, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003332", name: "CHA035 BOTTOM CHANEL SOFT CLOSE 450 MM 30 KG - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 4.5, sellingPrice: 0, openingStock: 8, lastPurchaseRate: 4.725 },
  { id: "IT003331", name: "CHA034 BOTTOM CHANEL SOFT CLOSE 500 MM 30 KG - HAFELE", stockCategory: "Joinery Consumables", unit: "Nos", cost: 4.6, sellingPrice: 0, openingStock: 4, lastPurchaseRate: 4.818 },
  { id: "IT003330", name: "HIN032 AHDC96292 / DC962 Ultimate DC962 Concealed Cam Action Door Closer", stockCategory: "Joinery Consumables", unit: "Nos", cost: 36, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 36 },
  { id: "IT003329", name: "CHA033 ZHACS1130 MBL CONCEALED HINGE FR 134X24MM", stockCategory: "Joinery Consumables", unit: "Nos", cost: 9, sellingPrice: 0, openingStock: 10, lastPurchaseRate: 9 },
  { id: "IT003328", name: "TOO093 WOOD WORKING VENEER INDUSTRIAL IRON BOX(MD#GW1211)", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 24.08, sellingPrice: 0, openingStock: 0, lastPurchaseRate: 0 },
  { id: "IT003327", name: "SWI007 ROCKER SWITCH (LED) KCD1 BLACK", stockCategory: "Others", unit: "Nos", cost: 0.5, sellingPrice: 0, openingStock: 30, lastPurchaseRate: 0.5 },
  { id: "IT003326", name: "VEN016 LIPPING VENEER WALNUT-21 X50-ROLL", stockCategory: "Joinery Consumables", unit: "Roll", cost: 0, sellingPrice: 0, openingStock: -25, lastPurchaseRate: 0 },
  { id: "IT003325", name: "VEN015 NATURAL WOOD VENEER EUROPEAN", stockCategory: "Joinery Consumables", unit: "Nos", cost: 3.83, sellingPrice: 0, openingStock: -51, lastPurchaseRate: 0 },
  { id: "IT003324", name: "PAI065 SILKALASTIC 505-BH WATER PROOF PAINT- 20KG", stockCategory: "Chemical Items", unit: "Nos", cost: 0.55, sellingPrice: 0, openingStock: 20, lastPurchaseRate: 0.55 },
  { id: "IT003323", name: "BIT074 STEEL DRILL BIT 10 MM", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 1.2, sellingPrice: 0, openingStock: 5, lastPurchaseRate: 1.2 },
  { id: "IT003322", name: "BIT073 STEEL DRILL BIT 4.5 MM", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 0.25, sellingPrice: 0, openingStock: 10, lastPurchaseRate: 0.25 },
  { id: "IT003321", name: "TOO092 SPANNER 15''", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 1.3, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 1.3 },
  { id: "IT003320", name: "TOO091 SPANNER 13''", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 1, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 1 },
  { id: "IT003319", name: "TOO090 SPANNER 14''", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 1.2, sellingPrice: 0, openingStock: 1, lastPurchaseRate: 1.2 },
  { id: "IT003318", name: "BIT072 HILTI BIT 6MM X 210 L", stockCategory: "Workshop Tools & Accessories", unit: "Nos", cost: 0.7, sellingPrice: 0, openingStock: 5, lastPurchaseRate: 0.7 },
].forEach(seed => createItemMasterEntry(seed));

// Estimator's Materials tab was built against a flat `ITEM_MASTER` array
// with `.name`/`.cost`/`.unit` fields — kept as a live alias (not a copy) so
// it automatically reflects every item created through the real Inventory
// module from here on.
const ITEM_MASTER = itemMaster;

function searchItemMaster(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return itemMaster;
  return itemMaster.filter(it => it.name.toLowerCase().includes(q) || it.id.toLowerCase().includes(q));
}
// Emp Category list — not captured from Q-Pro's own dropdown yet, seeded from
// common production role tiers used elsewhere in this app (EMPLOYEE_RATES 'category').
const EMP_CATEGORIES = ["Skilled", "Semi-Skilled", "Helper", "Supervisor"];

// Generalized so both Estimator and Approver can pick off their own stage's
// queue — a quotation is only "pending to pick" while sitting in the stage
// the picker owns. estimatorPickedBy/approverPickedBy are separate fields
// (not one shared pickedBy) because the live audit trail shows each role's
// pick is independent and persists even after the quote moves to another
// stage and comes back.
function pickQuotation(qtnId, personName, expectedStage) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  if (qtn.stage !== expectedStage) return { error: `This quotation is not in the ${expectedStage[0].toUpperCase()}${expectedStage.slice(1)} stage.` };
  const field = expectedStage === "approver" ? "approverPickedBy" : "estimatorPickedBy";
  if (qtn[field]) return { error: "This quotation has already been picked." };
  qtn[field] = personName;
  logQuotationAudit(qtn, { action: "Pick", user: personName, userType: expectedStage.toUpperCase() });
  persistQuotationUpdate(qtn);
  return qtn;
}

function findQuotationItem(qtnId, lineId) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return null;
  return qtn.items.find(it => it.lineId === lineId) || null;
}

// Creates the BOM container the first time "+ Add BOM" is used on an item.
// Overhead defaults match the live-observed percentages (Material/Labour/
// Subcontract 5%, Hiring/Others 0%, Profit 30%).
function ensureItemBOM(item) {
  if (!item.bom) {
    item.bom = {
      materials: [], labour: [], subcontract: [], hiring: [], others: [],
      ohPercents: { material: 5, labour: 5, subcontract: 5, hiring: 0, others: 0 },
      profitPercent: 30, sellingPriceOverride: null, submitted: false
    };
  }
  return item.bom;
}
function addBOMMaterial(qtnId, lineId, { name, description = "", qty, unit, rate }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  const bom = ensureItemBOM(item);
  const amount = (qty || 0) * (rate || 0);
  // If the name exactly matches a real Item Master entry (as it will when
  // picked from the Materials-tab typeahead, which is sourced from
  // itemMaster), tag the BOM line with itemId — this is what lets Job
  // Material Requirement (Inventory report) see real demand for the item.
  const master = itemMaster.find(it => it.name === name);
  bom.materials.push({ id: bom.materials.length + 1, itemId: master ? master.id : null, name, description, qty: qty || 0, unit, rate: rate || 0, amount });
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return bom;
}
// calcMode 'hours' (PPL x Hrs x hourly Rate) or 'days' (PPL x Days x daily
// Rate) — Salman's call: joinery/painting crews plan in days-per-task,
// small installs plan in hours, forcing one unit onto both just makes
// someone fake numbers to fit the field. qty holds hrs OR days depending
// on calcMode; manQty is the resulting man-hours/man-days total.
function addBOMLabour(qtnId, lineId, { department, empCategory, calcMode = "hours", noOfPpl, qty, rate }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  if (!rate) return { error: "Rate is required." };
  const bom = ensureItemBOM(item);
  const manQty = (noOfPpl || 0) * (qty || 0);
  const amount = manQty * rate;
  bom.labour.push({ id: bom.labour.length + 1, department, empCategory, calcMode, noOfPpl: noOfPpl || 0, qty: qty || 0, manQty, rate, amount });
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return bom;
}
// Department production-floor averages from real payroll (EMPLOYEE_RATES)
// — an aggregate default suggestion for the Estimator's Labour tab, NOT
// individual salaries. Salman's call: quoting shouldn't expose or assume a
// specific worker's pay before a job is even sold, but the estimate should
// still start from a real number instead of a guessed one. Painting and
// Metal Works have no dedicated payroll bucket yet (see DEPARTMENT_APPROVERS
// — Painting shares Joinery's floor), so they fall back to Carpentry's
// average; returns 0 (no autofill, Estimator just types their own) if
// nothing matches at all.
const LABOUR_DEPT_PAYROLL_MAP = { carp: "Carpentry", paint: "Carpentry", uph: "Upholstery", curt: "Curtain & Blinds", metal: "Carpentry" };
function getDeptAvgLabourRate(deptKey) {
  const deptName = LABOUR_DEPT_PAYROLL_MAP[deptKey];
  if (!deptName) return 0;
  const rates = Object.values(EMPLOYEE_RATES).filter(e => e.department === deptName && e.category === "Production").map(e => e.rate);
  if (!rates.length) return 0;
  return Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 1000) / 1000;
}
function addBOMSubcontract(qtnId, lineId, { vendor, workType, amount }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  const bom = ensureItemBOM(item);
  bom.subcontract.push({ id: bom.subcontract.length + 1, vendor, workType, amount: amount || 0 });
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return bom;
}
function addBOMHiring(qtnId, lineId, { vendor, workType, amount }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  const bom = ensureItemBOM(item);
  bom.hiring.push({ id: bom.hiring.length + 1, vendor, workType, amount: amount || 0 });
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return bom;
}
function addBOMOther(qtnId, lineId, { party, details, amount }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  const bom = ensureItemBOM(item);
  bom.others.push({ id: bom.others.length + 1, party, details, amount: amount || 0 });
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return bom;
}
function removeBOMEntry(qtnId, lineId, category, entryId) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item || !item.bom) return { error: "BOM not found." };
  item.bom[category] = item.bom[category].filter(r => r.id !== entryId);
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return item.bom;
}
function setBOMOHPercent(qtnId, lineId, category, val) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item || !item.bom) return { error: "BOM not found." };
  item.bom.ohPercents[category] = val;
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return item.bom;
}
function setBOMProfitPercent(qtnId, lineId, val) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item || !item.bom) return { error: "BOM not found." };
  item.bom.profitPercent = val;
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return item.bom;
}
function setBOMSellingOverride(qtnId, lineId, val) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item || !item.bom) return { error: "BOM not found." };
  item.bom.sellingPriceOverride = (val === null || val === "") ? null : Number(val);
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return item.bom;
}

// Cost-plus waterfall — Total Cost -> per-category overhead -> Total Cost
// Incl. Overhead -> Profit % -> Selling Price. Verified against the live
// reference calc: 5 Meters x 2.000 material = 10.000 -> +5% Material OH =
// 10.500 -> +30% profit (3.150) = Selling Price 13.650.
function computeBOMTotals(bom) {
  const sum = arr => arr.reduce((s, r) => s + (r.amount || 0), 0);
  const materialCost = sum(bom.materials), labourCost = sum(bom.labour),
        subcontractCost = sum(bom.subcontract), hiringCost = sum(bom.hiring), othersCost = sum(bom.others);
  const totalCost = materialCost + labourCost + subcontractCost + hiringCost + othersCost;
  const oh = bom.ohPercents;
  const ohAmounts = {
    material: materialCost * oh.material / 100,
    labour: labourCost * oh.labour / 100,
    subcontract: subcontractCost * oh.subcontract / 100,
    hiring: hiringCost * oh.hiring / 100,
    others: othersCost * oh.others / 100
  };
  const totalCostInclOH = totalCost + ohAmounts.material + ohAmounts.labour + ohAmounts.subcontract + ohAmounts.hiring + ohAmounts.others;
  const profitAmount = totalCostInclOH * bom.profitPercent / 100;
  const calculatedSellingPrice = totalCostInclOH + profitAmount;
  return { materialCost, labourCost, subcontractCost, hiringCost, othersCost, totalCost, ohAmounts, totalCostInclOH, profitAmount, calculatedSellingPrice };
}

// "Submit" on the Summary tab — saves the BOM and writes the Selling Price
// (override if set, else the calculated figure) back onto the quotation
// item's Rate, recomputing Amount/Net Amount with VAT applied on top, same
// as the live-verified example (13.650 x 1.10 VAT = 15.015).
function submitItemBOM(qtnId, lineId, submittedBy = "Estimator") {
  const item = findQuotationItem(qtnId, lineId);
  if (!item || !item.bom) return { error: "BOM not found." };
  const totals = computeBOMTotals(item.bom);
  const sellingPrice = item.bom.sellingPriceOverride !== null ? item.bom.sellingPriceOverride : totals.calculatedSellingPrice;
  item.rate = sellingPrice;
  item.amount = item.qty * item.rate;
  item.discAmt = item.amount * (item.discPercent || 0) / 100;
  item.netAmount = (item.amount - item.discAmt) * (1 + (item.vatPercent || 0) / 100);
  item.bom.submitted = true;
  item.bom.qtyAtSubmit = item.qty; // lets the Estimation index flag "Copy BOM" if Sales changes Qty after this
  logActivity({ type: "bom-submitted", linkedType: "quotation", linkedId: qtnId, user: submittedBy, message: `BOM submitted for ${item.product} — Selling Price BD ${sellingPrice.toFixed(3)}` });
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return { item, totals };
}
function clearItemBOM(qtnId, lineId) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  item.bom = null;
  item.rate = 0; item.amount = 0; item.discAmt = 0; item.netAmount = 0;
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return { ok: true };
}
// Clone another line item's full BOM (materials/labour/subcontract/hiring/
// others + overhead%/profit%) into this one as a starting point — Salman's
// ask, for near-identical items in the same quote. lineId is already the
// stable per-quote serial (assigned once at addQuotationItem() time), so it
// doubles as the "Item #N" reference with no separate SL field needed.
// Replaces the target's current BOM entirely; marked unsubmitted since the
// copied figures haven't been reviewed against THIS item's own qty/spec yet.
function cloneBOMToItem(qtnId, sourceLineId, targetLineId) {
  const source = findQuotationItem(qtnId, sourceLineId);
  const target = findQuotationItem(qtnId, targetLineId);
  if (!source || !target) return { error: "Item not found." };
  if (!source.bom) return { error: "Source item has no BOM to copy." };
  target.bom = JSON.parse(JSON.stringify(source.bom));
  target.bom.submitted = false;
  target.bom.qtyAtSubmit = null;
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return target.bom;
}

// Estimator dashboard KPIs. PR Pending/Not Received is an approximation off
// the existing Purchasing chain (open PRs / issued-but-not-yet-invoiced POs)
// — Estimator's own PR view in Q-Pro hasn't been mapped in detail yet.
function getEstimatorKPIs(estimatorName) {
  const estQuotes = quotations.filter(q => q.stage === "estimator");
  const pendingToPickList = estQuotes.filter(q => !q.estimatorPickedBy);
  const myActionsList = estQuotes.filter(q => q.estimatorPickedBy === estimatorName);
  const withApprover = quotations.filter(q => q.stage === "approver").length;
  const confirmed = quotations.filter(q => q.lifecycleStatus === "confirmed").length;
  const prPending = purchaseRequests.filter(pr => pr.status === "open").length;
  const prNotReceived = purchaseOrders.filter(po => po.status === "issued").length;

  // Furniture/Joinery/Metal Works roll up into "Joinery", mirroring the same
  // rollup Purchasing already uses for its own category breakdown.
  function divisionCategory(div) {
    if (div === "Curtain & Blinds") return "curtain";
    if (div === "Upholstery") return "upholstery";
    return "joinery";
  }
  const categoryBreakdown = { curtain: 0, upholstery: 0, joinery: 0 };
  estQuotes.forEach(q => {
    const enq = enquiries.find(e => e.id === q.enquiryId);
    categoryBreakdown[divisionCategory(enq ? enq.division : "")]++;
  });

  return {
    pendingToPick: pendingToPickList.length, pendingToPickList,
    myActions: myActionsList.length, myActionsList,
    withApprover, confirmed, prPending, prNotReceived, categoryBreakdown
  };
}

// ═══════════════════════════════════════
// MODULE 4 — APPROVER
// Rebuilt 25 Jul 2026 from Salman's full live trace of the Sales ⇄
// Estimator ⇄ Approver loop, including the audit trail and the two
// independent comment channels. Key corrections this made to the Quotation
// module built earlier:
//   - lifecycleStatus stays "draft" through the WHOLE Estimator/Approver
//     loop — it only flips to "open" when Approver clicks Approve Quote.
//     (finaliseQuotation() below was wrongly setting "open" immediately.)
//   - pickedBy is per-role, not a single shared field — an Estimator's pick
//     and an Approver's pick are independent and both persist forever once
//     set (so "Back to Estimator" / re-transferring to the same role never
//     needs a re-pick — it lands straight in that person's queue).
//   - Comments are NOT a reject-time gate. They're two independent,
//     always-editable channels: one header/common comment (Approver ->
//     visible to Sales & Estimator), and one per-line comment (Approver ->
//     visible to Estimator). Sales' existing per-line internalComments is
//     the third channel, surfaced back to Approver on review.
// ═══════════════════════════════════════

// Every status transition gets one row here — Sales/Estimator/Approver hub
// pages all render this same log at the bottom of the page.
function logQuotationAudit(qtn, { action, user, userType, status }) {
  if (!qtn.auditLog) qtn.auditLog = [];
  const displayStatus = status || (qtn.lifecycleStatus.charAt(0).toUpperCase() + qtn.lifecycleStatus.slice(1));
  qtn.auditLog.push({
    seq: qtn.auditLog.length + 1,
    action, user, date: new Date().toISOString().slice(0, 10),
    userType, status: displayStatus
  });
}

// Approve Quote — the only action that flips Draft -> Open. Sends the
// quotation back to Sales' queue; "Confirm Quote" (Open -> Confirmed, the
// bridge into Jobs/Invoicing) is explicitly out of scope for this rebuild.
function approveQuotation(qtnId, approvedBy) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  // Lifecycle gate (6 Aug 2026 audit, Critical #1). This is the ONLY action
  // that flips Draft -> Open, and it must only ever run on a Draft: re-
  // approving a CONFIRMED quote used to silently revert it to Open, after
  // which confirmQuotationToJobCard() would happily mint a SECOND Job Card
  // for the same quotation (double production + double billing). Re-approving
  // an already-Open quote is a no-op-shaped mistake worth refusing too.
  // (Backed by the confirm-side existing-job guard below.)
  // Stage gate (audit Critical #2, closed in its own pass after the
  // double-billing fix): approval must happen where approval lives — a
  // quotation still sitting at Sales (or Estimator) can't be approved
  // directly, which used to make the entire Estimator/Approver cycle
  // skippable in one call. Every e2e seed was updated to transfer through
  // the real stages the same day.
  if (qtn.stage !== "approver") return { error: `Quotation must be with the Approver before it can be approved (currently at ${qtn.stage === "sales" ? "Sales" : "Estimator"}).` };
  if (qtn.lifecycleStatus === "confirmed") return { error: "This quotation is already confirmed into a Job Card — it can't be approved again." };
  if (qtn.lifecycleStatus === "open") return { error: "This quotation is already approved (Open)." };
  qtn.stage = "sales";
  qtn.lifecycleStatus = "open";
  logQuotationAudit(qtn, { action: "Transfer", user: approvedBy, userType: "SALES", status: "Open" });
  logActivity({ type: "quotation-approved", linkedType: "quotation", linkedId: qtn.id, user: approvedBy, message: `${qtn.id} approved — Open` });
  persistQuotationUpdate(qtn);
  return qtn;
}

// Header/common comment — Approver-authored, one per quote, read-only to
// Sales/Estimator via their own "View Approver Comments" link.
function setQuotationHeaderComment(qtnId, text) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  qtn.headerComment = text;
  persistQuotationUpdate(qtn);
  return qtn;
}
// Per-line comment — Approver-authored, surfaced to the Estimator via the
// eye icon on the Estimation index / Job Estimation header.
function setLineApproverComment(qtnId, lineId, text) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  item.approverComment = text;
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return item;
}

// Approver direct correction — Product Name/Description/Price, with a
// mandatory reason (same pattern as rejectCustomer()) and a full audit
// trail (item.corrections[] + the quotation's own auditLog, already
// rendered by renderQuotationAuditTable() everywhere it's used). Salman's
// explicit call, contrasted against the legacy Q-Pro "Approver Print"
// screen that let Cost be edited invisibly with zero trace — every
// correction here is logged with who/when/why/before/after. A rate change
// is tracked as an explicit override (priceManuallyOverridden flag) rather
// than silently detaching from the BOM's own calculated figure — the BOM
// stays intact underneath, this is a recorded correction on top of it, not
// a rewrite of the Estimator's work.
function approverCorrectItem(qtnId, lineId, patch, reason, approverName) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  if (!reason || !reason.trim()) return { error: "A reason is required for this correction." };
  const changes = {};
  ["product", "description"].forEach(f => {
    if (patch[f] !== undefined && patch[f] !== item[f]) { changes[f] = { from: item[f], to: patch[f] }; item[f] = patch[f]; }
  });
  if (patch.rate !== undefined && Number(patch.rate) !== item.rate) {
    changes.rate = { from: item.rate, to: Number(patch.rate) };
    item.rate = Number(patch.rate);
    item.amount = item.qty * item.rate;
    item.discAmt = item.amount * (item.discPercent || 0) / 100;
    item.netAmount = (item.amount - item.discAmt) * (1 + (item.vatPercent || 0) / 100);
    item.priceManuallyOverridden = true;
  }
  if (Object.keys(changes).length === 0) return { error: "No changes to save." };
  if (!item.corrections) item.corrections = [];
  item.corrections.push({ by: approverName, date: new Date().toISOString().slice(0, 10), reason: reason.trim(), changes });
  const qtn = quotations.find(q => q.id === qtnId);
  const fieldList = Object.keys(changes).join(", ");
  logQuotationAudit(qtn, { action: "Correct Item", user: approverName, userType: "APPROVER", status: `${item.product} — ${fieldList} corrected (${reason.trim()})` });
  logActivity({ type: "item-corrected", linkedType: "quotation", linkedId: qtnId, user: approverName, message: `${item.product} — ${fieldList} corrected: ${reason.trim()}` });
  persistQuotationUpdate(qtn);
  return item;
}

// Sales-side post-return editing — Qty/Description/Internal Comments only.
// Rate stays Estimator-controlled even here; Amount/Net Amount recompute
// live off the current Rate (0 if not yet estimated).
function updateQuotationItemFields(qtnId, lineId, { qty, description, internalComments }) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return { error: "Item not found." };
  if (qty !== undefined) item.qty = qty;
  if (description !== undefined) item.description = description;
  if (internalComments !== undefined) item.internalComments = internalComments;
  item.amount = item.qty * item.rate;
  item.discAmt = item.amount * (item.discPercent || 0) / 100;
  item.netAmount = (item.amount - item.discAmt) * (1 + (item.vatPercent || 0) / 100);
  persistQuotationUpdate(quotations.find(q => q.id === qtnId));
  return item;
}

// Approver dashboard KPIs. "PO Approval" deliberately reuses the existing
// Purchasing approval queue (getPendingPOApprovals()) rather than
// duplicating that data model — Approver's tile is a rollup + shortcut into
// Purchasing, not a second PO approval flow.
function getApproverKPIs(approverName) {
  const apprQuotes = quotations.filter(q => q.stage === "approver");
  const pendingToPickList = apprQuotes.filter(q => !q.approverPickedBy);
  const forApprovalList = apprQuotes.filter(q => q.approverPickedBy === approverName);
  const poApproval = getPendingPOApprovals().length;
  const prPending = purchaseRequests.filter(pr => pr.status === "open").length;
  const prNotReceived = purchaseOrders.filter(po => po.status === "issued").length;

  function divisionCategory(div) {
    if (div === "Curtain & Blinds") return "curtain";
    if (div === "Upholstery") return "upholstery";
    return "joinery";
  }
  const categoryBreakdown = { curtain: 0, upholstery: 0, joinery: 0 };
  apprQuotes.forEach(q => {
    const enq = enquiries.find(e => e.id === q.enquiryId);
    categoryBreakdown[divisionCategory(enq ? enq.division : "")]++;
  });

  return {
    pendingToPick: pendingToPickList.length, pendingToPickList,
    forApproval: forApprovalList.length, forApprovalList,
    quotationsTotal: quotations.length,
    prPending, prNotReceived, poApproval,
    categoryBreakdown
  };
}

// ── LIVE REFERENCE FIXTURE ──
// Built for testing against the real Q-Pro flow (Salman, 25 Jul 2026) — safe
// to reuse as a Claude Code test fixture. ENQ04061AMD -> AMD-15350-0, sitting
// in the Estimator stage exactly as it does live (With Estimation checked,
// so the one line item's rate is locked at 0 pending the Estimator role).
const enquiries = [
  {
    id: "ENQ04061AMD", division: "Furniture", customerId: "C1508", prospectName: "",
    contactPerson: "Test Contact", tel: "00099911", email: "", requirements: "Reference enquiry for Claude Code mapping exercise.",
    source: "walk inn", salesPerson: "Salman Abdullah", dateCreated: "2026-07-24",
    followUps: [
      { date: "2026-07-24", meetingType: "Telephone Call", outcome: "Required design/proposal", notes: "Client requested a quotation for one reference curtain item to validate the Sales module mapping." }
    ],
    linkedQuotationId: "AMD-15350-0"
  }
];
quotations.push({
  id: "AMD-15350-0", rev: 0, enquiryId: "ENQ04061AMD", customerId: "C1508",
  projectName: "ZZTEST Reference Project - Claude Mapping", taxPercent: 10, contactPerson: "Test Contact",
  withEstimation: true, notes: "",
  items: [
    { lineId: 1, group: "", subgroup: "", product: "Test Curtain Fabric - Mapping Exercise", qty: 1, unit: "Meters", rate: 0, amount: 0, vatPercent: 10, discPercent: 0, discAmt: 0, netAmount: 0, description: "", internalComments: "", optional: false, approverComment: "", bom: null }
  ],
  coveringLetterTemplate: "Al Maraya decor.", coveringLetterBody: COVERING_LETTER_TEMPLATES["Al Maraya decor."]("ZZTEST Reference Project - Claude Mapping"),
  termsTemplate: "Al Maraya Decor Standard.", termsBody: TERMS_TEMPLATES["Al Maraya Decor Standard."],
  // Draft the whole way through the loop — only Approve Quote flips this to Open (see approveQuotation()).
  lifecycleStatus: "draft", stage: "estimator",
  estimatorPickedBy: null, approverPickedBy: null, headerComment: "",
  date: "2026-07-24", confirmDate: null,
  auditLog: [
    { seq: 1, action: "Create", user: "Salman Abdullah", date: "2026-07-24", userType: "SALES", status: "Draft" }
  ]
});

// ═══════════════════════════════════════
// MODULE 5 — JOB CARD (post-Approval production/commercial tracking)
// Rebuilt 25 Jul 2026 from Salman's live Q-Pro trace (read-only exploration,
// no real production data touched). A Job Card is created from a Quotation
// once Sales clicks "Confirm Quote" (Open -> Confirmed) — the bridge this
// app's Approver module deliberately left unbuilt until now.
//
// DELIBERATELY KEPT SEPARATE from curtainJobs[]/projects[] — the pre-
// existing Curtain workshop production tracker (window groups, fabric BOM,
// installation crew scheduling) built in an earlier session on its own id
// scheme. Unifying the two is a real architectural question (which "job" is
// the source of truth?) that deserves its own dedicated session, not a side
// effect of this build. jobCards[] here is Q-Pro's own commercial wrapper —
// Job No, linked Quotation, delivery/materials/labour tracking — modeled
// generically across all divisions, not just Curtain.
// ═══════════════════════════════════════

// Not confirmed against Q-Pro's actual per-division department list — a
// placeholder subset good enough to exercise per-line-per-department status.
const JOB_DEPARTMENTS = ["Cutting", "Stitching", "Installation"];
// Only "Pending" and "Delivered" were directly observed; "In Progress" is a
// reasonable middle state added so the per-department status isn't a binary flag.
const JOB_LINE_STATUSES = ["Pending", "In Progress", "Delivered"];

const jobCards = [];
// Shape roughly matches the real qproJobCardNo values already seeded on
// curtainJobs[] (e.g. "JB26AMD01863") — not the real sequence, just the format.
// Client-generated from jobCards.length, unchanged since before Phase 2
// slice 3 (4 Aug 2026) — same accepted tradeoff as nextCustomerCode()
// (customers, above): two Confirm Quote clicks landing in the same narrow
// window right after login (before initCloudJobCardsCache() finishes
// populating jobCards[] — deliberately fired in parallel with, not after,
// customers/enquiries/quotations, to keep that window as small as
// possible) could compute the same id. The job_cards primary key makes
// that fail loudly (persistNewJobCard() surfaces a toast) rather than
// silently overwrite another job — not worth a server-side reservation
// scheme for an 11-person team; revisit if it ever actually fires in
// practice.
function nextJobCardNo() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "JB" + yy + "AMD" + String(1000 + jobCards.length).padStart(5, "0");
}

function getJobCard(jobId) { return jobCards.find(j => j.id === jobId); }

// ── Cloud-backed job cards (4 Aug 2026, Phase 2 slice 3) ─────────────
// Same local-cache pattern as customers/enquiries/quotations. Scoped to
// jobCards[] only — curtainJobs[]/projects[] deliberately stay local-only
// for now, see the design note in supabase/schema.sql. `items`,
// `departmentBudgets`, `deliveryNotes`, `materialsIssues`,
// `materialsReturns`, and `labourCostEntries` travel as plain jsonb, same
// reasoning as quotations.items — each is already one mutable object
// graph the app's JS reads/writes directly. Every mutation function below
// this point (confirmJobRouting, the Joinery/Upholstery/Painting pipeline,
// the budget-gate functions, addDeliveryNote/addMaterialsIssue/
// addMaterialsReturn/cancelMaterialsMove, updateJobLineStatus,
// addLabourCostEntry, setJobStatus, confirmVariationToJobCard,
// refreshJobFromQuotation, generateInvoiceFromJob) ends with the same
// one-line persistJobCardUpdate(job) call.
function jobCardRowToObj(row) {
  return {
    id: row.id, quotationId: row.quotation_id, customerId: row.customer_id, projectName: row.project_name,
    date: row.date, amount: row.amount, status: row.status, confirmDate: row.confirm_date,
    items: row.items || [], poNo: row.po_no, poDate: row.po_date, vendor: row.vendor,
    deliveryNotes: row.delivery_notes || [], materialsIssues: row.materials_issues || [],
    materialsReturns: row.materials_returns || [], labourCostEntries: row.labour_cost_entries || [],
    linkedInvoiceIds: row.linked_invoice_ids || [], variationIds: row.variation_ids || [],
    routingConfirmed: row.routing_confirmed, routingConfirmedBy: row.routing_confirmed_by,
    routingConfirmedDate: row.routing_confirmed_date, departmentBudgets: row.department_budgets || {}
  };
}
function jobCardObjToRow(job) {
  return {
    id: job.id, quotation_id: job.quotationId || null, customer_id: job.customerId || null, project_name: job.projectName,
    date: job.date, amount: job.amount || 0, status: job.status, confirm_date: job.confirmDate,
    items: job.items || [], po_no: job.poNo || null, po_date: job.poDate || null, vendor: job.vendor || null,
    delivery_notes: job.deliveryNotes || [], materials_issues: job.materialsIssues || [],
    materials_returns: job.materialsReturns || [], labour_cost_entries: job.labourCostEntries || [],
    linked_invoice_ids: job.linkedInvoiceIds || [], variation_ids: job.variationIds || [],
    routing_confirmed: !!job.routingConfirmed, routing_confirmed_by: job.routingConfirmedBy || null,
    routing_confirmed_date: job.routingConfirmedDate || null, department_budgets: job.departmentBudgets || {}
  };
}
let cloudJobCardsCacheInitialized = false;
// Loads jobCards[] as soon as possible after login, in PARALLEL with
// customers/enquiries/quotations (not sequenced after them) — deliberately
// NOT blocked on those, because nextJobCardNo() (below) reads jobCards.length
// synchronously the moment "Confirm Quote" is clicked, and the longer this
// cache takes to populate, the wider the window for that id scheme to
// collide with an already-persisted job (see nextJobCardNo()'s own note).
// The BRIDGE step (re-creating projects[]/curtainJobs[] entries for each
// hydrated job) genuinely does need customers/enquiries/quotations already
// loaded to resolve the right client name/division, so it's split out into
// bridgeAllJobCards() below and called separately, once those are ready —
// see finishCloudLogin() in auth.js.
async function initCloudJobCardsCache() {
  if (!window.__realCloudSession || !sb || cloudJobCardsCacheInitialized) return;
  cloudJobCardsCacheInitialized = true;
  const { data, error } = await sb.from("job_cards").select("*").order("created_at", { ascending: true });
  if (!error && data) { jobCards.length = 0; data.forEach(row => jobCards.push(jobCardRowToObj(row))); }
  sb.channel("job-cards-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "job_cards" }, (payload) => {
      const row = payload.new; if (!row) return;
      const mapped = jobCardRowToObj(row);
      const idx = jobCards.findIndex(j => String(j.id) === String(row.id));
      // Same reasoning as the initial hydration above, but for a job
      // created on ANOTHER device after this one is already logged in —
      // without this, that job would sync into jobCards[] here but never
      // get a projects[]/curtainJobs[] entry on this device at all.
      if (payload.eventType === "INSERT") { if (idx < 0) { jobCards.push(mapped); bridgeJobToOperationsAndCurtain(mapped); } else jobCards[idx] = mapped; }
      else if (payload.eventType === "UPDATE") { if (idx >= 0) jobCards[idx] = mapped; }
      notifyLiveUpdateListeners();
    })
    .subscribe();
}
// Called once from finishCloudLogin() (auth.js) after customers/enquiries/
// quotations AND jobCards have all finished their initial load — see the
// note on initCloudJobCardsCache() above for why this is split out rather
// than run inline as part of that cache's own load. Before this slice,
// jobCards[] was purely in-memory — a Job Card only ever existed for the
// lifetime of one browser session, so bridgeJobToOperationsAndCurtain()
// only ever had to run once, at the moment confirmQuotationToJobCard()/
// confirmVariationToJobCard() created it. Now that jobs persist and reload
// from Supabase, every job hydrated here needs the SAME bridge call, or
// Operations' projects[] rollup and Curtain's curtainJobs[] list would
// silently stop showing any job that existed before the current page load.
// bridgeJobToOperationsAndCurtain() is idempotent (checks for an existing
// proj/cj first), so calling it again for an already-bridged job is a safe
// no-op.
function bridgeAllJobCards() {
  jobCards.forEach(job => bridgeJobToOperationsAndCurtain(job));
}
function persistNewJobCard(job) {
  if (!window.__realCloudSession || !sb) return;
  serializedPersist("jobcards:" + job.id, () => sb.from("job_cards").insert(jobCardObjToRow(job)).then(({ error }) => {
    if (error && typeof commsToast === "function") commsToast(`Couldn't save Job Card ${job.id} to the cloud: ${error.message}`);
  }));
}
function persistJobCardUpdate(job) {
  if (!window.__realCloudSession || !sb) return;
  serializedPersist("jobcards:" + job.id, () => sb.from("job_cards").update(jobCardObjToRow(job)).eq("id", job.id).then(({ error }) => {
    if (error && typeof commsToast === "function") commsToast(`Couldn't sync Job Card ${job.id} to the cloud: ${error.message}`);
  }));
}

// ═══════════════════════════════════════
// CURTAIN CLOUD SYNC — Phase 2, final slice (6 Aug 2026)
// curtainJobs[] and purchaseInquiries[] persist to Supabase as whole-object
// jsonb payloads via a SNAPSHOT-DIFF AUTOSAVE rather than per-mutation
// persist calls: curtain.js (~5,900 lines) mutates these objects inline all
// over its render/handler code, so instrumenting every mutation site was
// never going to be reliable (the reason this slice was deferred when
// jobCards migrated). A 3s scanner JSON-serializes each record, compares it
// to the last-persisted snapshot, and upserts only what changed; pagehide
// fires one final best-effort flush. Accepted trade-off: a hard crash can
// lose up to ~3s of the newest edits; a normal tab close/navigation
// flushes. The derived flat job.windows[] array is stripped before save
// and rebuilt from windowGroups on hydrate; the val/deptVal getters
// (live windows onto jobCards[].amount, see the bridge above) serialize
// as plain values and are re-defined as getters on hydrate so the
// no-drift guarantee survives the round trip.
// ═══════════════════════════════════════
let cloudCurtainCacheInitialized = false;
const cloudCurtainSnapshots = {};   // "cj:<id>" / "pi:<id>" -> last-persisted payload JSON

function curtainJobToPayload(cj) {
  const { windows, ...rest } = cj;   // windows is derived — rebuilt on hydrate
  return JSON.parse(JSON.stringify(rest));
}
function hydrateCurtainJob(payload) {
  const cj = payload;
  if (cj.linkedJobCardId) {
    // Re-define the live-value getters the bridge gives a freshly-created
    // entry (configurable so a later realtime re-hydration can redefine).
    Object.defineProperty(cj, "val", { enumerable: true, configurable: true, get() { const j = getJobCard(cj.id); return j ? j.amount : 0; } });
    Object.defineProperty(cj, "deptVal", { enumerable: true, configurable: true, get() { const j = getJobCard(cj.id); return j ? j.amount : 0; } });
  }
  cj.windows = flattenWindowGroups(cj);
  return cj;
}

async function initCloudCurtainCache() {
  if (!window.__realCloudSession || !sb || cloudCurtainCacheInitialized) return;
  cloudCurtainCacheInitialized = true;
  const [cjRes, piRes] = await Promise.all([
    sb.from("curtain_jobs").select("*").order("updated_at", { ascending: true }),
    sb.from("curtain_purchase_inquiries").select("*").order("updated_at", { ascending: true })
  ]);
  if (!cjRes.error && cjRes.data) {
    curtainJobs.length = 0;
    cjRes.data.forEach(row => { curtainJobs.push(hydrateCurtainJob(row.payload)); cloudCurtainSnapshots["cj:" + row.id] = JSON.stringify(row.payload); });
  }
  if (!piRes.error && piRes.data) {
    purchaseInquiries.length = 0;
    piRes.data.forEach(row => { purchaseInquiries.push(row.payload); cloudCurtainSnapshots["pi:" + row.id] = JSON.stringify(row.payload); });
  }
  const applyRemote = (payload, array, prefix, hydrate) => {
    if (payload.eventType === "DELETE") {
      const oldId = payload.old && payload.old.id;
      if (!oldId) return;
      const i = array.findIndex(r => String(r.id) === String(oldId));
      if (i >= 0) array.splice(i, 1);
      delete cloudCurtainSnapshots[prefix + oldId];
    } else {
      const row = payload.new;
      if (!row) return;
      const json = JSON.stringify(row.payload);
      if (cloudCurtainSnapshots[prefix + row.id] === json) return; // our own echo
      const idx = array.findIndex(r => String(r.id) === String(row.id));
      const mapped = hydrate ? hydrate(row.payload) : row.payload;
      if (idx >= 0) array[idx] = mapped; else array.push(mapped);
      cloudCurtainSnapshots[prefix + row.id] = json;
    }
    notifyLiveUpdateListeners();
  };
  sb.channel("curtain-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "curtain_jobs" }, p => applyRemote(p, curtainJobs, "cj:", hydrateCurtainJob))
    .on("postgres_changes", { event: "*", schema: "public", table: "curtain_purchase_inquiries" }, p => applyRemote(p, purchaseInquiries, "pi:", null))
    .subscribe();
  startCurtainAutosave();
}

function scanAndPersistCurtainData() {
  if (!window.__realCloudSession || !sb) return;
  const persistChanged = (record, payload, prefix, table) => {
    const json = JSON.stringify(payload);
    const key = prefix + record.id;
    if (cloudCurtainSnapshots[key] === json) return;
    cloudCurtainSnapshots[key] = json;   // set BEFORE the write so the realtime echo is recognized
    serializedPersist("curtain:" + key, () => sb.from(table).upsert({ id: record.id, payload, updated_at: new Date().toISOString() }).then(({ error }) => {
      if (error) {
        delete cloudCurtainSnapshots[key];   // retry on the next scan
        if (typeof commsToast === "function") commsToast(`Couldn't sync Curtain data (${record.id}): ${error.message}`);
      }
    }));
  };
  curtainJobs.forEach(cj => persistChanged(cj, curtainJobToPayload(cj), "cj:", "curtain_jobs"));
  purchaseInquiries.forEach(pi => persistChanged(pi, JSON.parse(JSON.stringify(pi)), "pi:", "curtain_purchase_inquiries"));
}

let curtainAutosaveTimer = null;
function startCurtainAutosave() {
  if (curtainAutosaveTimer) return;
  curtainAutosaveTimer = setInterval(scanAndPersistCurtainData, 3000);
  window.addEventListener("pagehide", scanAndPersistCurtainData);
}

// "Confirm Quote" — the action that actually creates the Job Card. Only
// available once Approver has moved a quotation to "Open" (see
// approveQuotation() in the APPROVER section above).
// ── JOB-AS-PARENT BRIDGE to curtainJobs[]/projects[] ──
// Bridge/link approach, not a data-model merge — Salman's explicit call,
// 3 Aug 2026 (curtain.js is the largest, most production-critical file in
// the repo; a full merge would mean rewriting its entire UI, its own
// multi-session project). jobCards[] stays the single source of truth for
// creation. curtainJobs[] (Curtain's Tracks/QC/Install/BOM tracker) and
// projects[] (Operations' dashboard) were BOTH pure hand-seeded fixture
// arrays before this — confirmed by grep, zero `.push()` into either
// anywhere in the app — so every real Job Card confirmed from now on also
// gets a minimal linked entry, cross-referenced by job.id via
// linkedJobCardId, so Curtain's and Operations' EXISTING screens
// (unmodified) render real live jobs (the old frozen fixture jobs are
// gone as of 6 Aug 2026 — cleared with the Curtain cloud migration). Fields are seeded with safe,
// empty/neutral defaults rather than invented percentages or costs no one
// has actually entered — those get filled in by whoever actually works
// the job, same as a fresh Q-Pro entry would start empty too.
// jobCards[]/curtainJobs[]/projects[] unification (4 Aug 2026): rather
// than a full data-model merge — curtain.js is ~5,900 lines, the largest
// and most production-critical file, rewriting its internals to read a
// different shape was judged too risky to do in one pass — the shared
// VALUE fields (projects[].val/.budget.sell, curtainJobs[].val/.deptVal)
// are now LIVE getters reading straight off the real jobCards[] entry's
// .amount, not copied numbers. This closes the actual risk that was
// flagged here before ("any other future path that mutates a Job Card's
// amount should call this bridge too, or these will drift out of sync")
// permanently — there's now exactly one stored value (jobCards[].amount)
// and these are just windows onto it, so they literally cannot drift no
// matter what code touches job.amount in the future. Confirmed via grep
// that nothing anywhere ever assigns to .val/.budget.sell/.deptVal
// directly outside this function, so defining them as getter-only is safe.
function bridgeJobToOperationsAndCurtain(job) {
  const customer = customers.find(c => c.id === job.customerId);
  const clientName = customer ? customer.name : "—";

  let proj = projects.find(p => p.id === job.id);
  if (!proj) {
    proj = {
      id: job.id, name: job.projectName, client: clientName, health: "ok",
      depts: [], budget: { cost: 0, mat: 0, lab: 0, sub: 0, hir: 0, oth: 0 },
      actuals: { mat: 0, lab: 0, sub: 0, hir: 0, oth: 0 }, alerts: [], linkedJobCardId: job.id
    };
    Object.defineProperty(proj, "val", { enumerable: true, get() { const j = getJobCard(proj.id); return j ? j.amount : 0; } });
    Object.defineProperty(proj.budget, "sell", { enumerable: true, get() { const j = getJobCard(proj.id); return j ? j.amount : 0; } });
    projects.push(proj);
  }

  // Real bug fix (5 Aug 2026, Phase 2 business-cycle audit finding #1):
  // this used to check the ENQUIRY's single `division` field
  // (division === "Curtain & Blinds") — but an enquiry can only ever
  // have one division, so a mixed-division quote (e.g. Curtains + a
  // Joinery TV Unit + a Sofa needing Upholstery, all in one quotation —
  // exactly the audit's worked example) forces Sales to pick some OTHER
  // division for the enquiry, silently leaving the curtain line with
  // ZERO real production pathway: not bridged into Curtain's own
  // system (this check failed) AND not consumed by the shared Joinery/
  // Upholstery/Painting pipeline either (nothing there ever reads
  // deptKey "curt"). Confirmed live in the audit — the job correctly
  // routed a line to departmentSequence: ["curt"], but
  // curtainJobsEntryExists was false. Fixed to check the JOB's own
  // items directly instead of the enquiry's division —
  // suggestDepartmentSequence() (above) already tags each ITEM with
  // the right department regardless of what the enquiry's division
  // says, so item-level data is the correct source of truth here, not
  // a new one grafted on.
  const hasCurtainLine = job.items.some(it => (it.departmentSequence || []).includes("curt"));
  if (hasCurtainLine) {
    let cj = curtainJobs.find(j => j.id === job.id);
    if (!cj) {
      cj = {
        id: job.id, name: job.projectName, client: clientName,
        status: "bom_pending", bomStatus: "bom_pending", budgetStatus: "pending", bomRejectionComment: null,
        wastageBuffer: 10, windowGroups: [], linkedJobCardId: job.id
      };
      Object.defineProperty(cj, "val", { enumerable: true, get() { const j = getJobCard(cj.id); return j ? j.amount : 0; } });
      Object.defineProperty(cj, "deptVal", { enumerable: true, get() { const j = getJobCard(cj.id); return j ? j.amount : 0; } });
      // curtain.js reads a flat job.windows[] (produced by flattenWindowGroups()
      // above) rather than windowGroups directly — the initial seed jobs get
      // this hydrated once at data.js load time (see the .forEach right below
      // flattenWindowGroups's definition); a job bridged in later at runtime
      // needs the same hydration or every Curtain screen that reads
      // job.windows crashes (found via this exact bridge's own Playwright test).
      cj.windows = flattenWindowGroups(cj);
      curtainJobs.push(cj);
    }
  }
}

function confirmQuotationToJobCard(qtnId, confirmedBy) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  if (qtn.lifecycleStatus !== "open") return { error: "Quotation must be Open before it can be confirmed." };
  // Double-confirm guard (6 Aug 2026 audit, Critical #1). Even if some path
  // reopens an already-confirmed quote, never mint a second Job Card for a
  // quotation that still has a live (non-cancelled) one.
  if (jobCards.some(j => j.quotationId === qtn.id && j.status !== "cancelled")) {
    return { error: "A Job Card already exists for this quotation." };
  }
  const totals = computeQuotationTotals(qtn);
  const job = {
    id: nextJobCardNo(), quotationId: qtn.id, customerId: qtn.customerId, projectName: qtn.projectName,
    date: new Date().toISOString().slice(0, 10), amount: totals.netTotal,
    status: "open", // open | completed | cancelled — the whole-job status shown on the Job Card List legend
    confirmDate: new Date().toISOString().slice(0, 10),
    items: qtn.items.map(it => ({
      lineId: it.lineId, product: it.product, qty: it.qty, unit: it.unit, rate: it.rate,
      discPercent: it.discPercent, amount: it.amount, vatPercent: it.vatPercent, netAmount: it.netAmount,
      deliveredQty: 0, departmentStatuses: [], // [{department, status}] — per-line-per-department, see updateJobLineStatus()
      departmentSequence: it.departmentSequence || [] // carried from the quotation item — see confirmJobRouting()
    })),
    poNo: null, poDate: null, vendor: null,
    deliveryNotes: [], materialsIssues: [], materialsReturns: [], labourCostEntries: [],
    linkedInvoiceIds: [], variationIds: [],
    routingConfirmed: false, routingConfirmedBy: null, routingConfirmedDate: null,
    // 6 Aug 2026 audit, loophole #8 — no urgency/deadline concept existed
    // anywhere. Set via setJobUrgent()/setJobPromisedDate() (Operations).
    urgent: false, promisedDate: null
  };
  jobCards.push(job);
  qtn.lifecycleStatus = "confirmed";
  qtn.confirmDate = job.confirmDate;
  logQuotationAudit(qtn, { action: "Transfer", user: confirmedBy, userType: "SALES", status: "Confirmed" });
  persistQuotationUpdate(qtn);
  persistNewJobCard(job);
  bridgeJobToOperationsAndCurtain(job);
  logActivity({ type: "job-created", linkedType: "job", linkedId: job.id, user: confirmedBy, message: `Job Card ${job.id} created from Quotation ${qtn.id}` });
  return job;
}

// ═══════════════════════════════════════
// JOB ROUTING — Operations Manager queue (Batch 8, Phase 1)
// A freshly-confirmed Job Card (or one that just gained a Variation
// before its first routing pass) sits in this queue until the Operations
// Manager reviews the auto-suggested department sequence per line and
// confirms it. This is the ONE human checkpoint in the whole routing
// design — every hand-off AFTER this point (Joinery -> Painting, etc.)
// auto-advances without coming back through the manager (see the design
// note in project_amd_app_routing_and_budgeting.md — that's Phase 2+,
// not built yet).
// ═══════════════════════════════════════
function getJobsPendingRouting() {
  return jobCards.filter(j => !j.routingConfirmed && j.status !== "cancelled");
}

// lineOverrides: optional { [lineId]: [deptKey,...] } — the manager's
// per-line override of the auto-suggested sequence, applied before
// finalizing. Writes each line's confirmed sequence into
// departmentStatuses (first stop "queued" and ready to start, any later
// stops "pending" until hand-off) and flips routingConfirmed so the job
// drops off this queue for good.
function confirmJobRouting(jobId, lineOverrides = {}, confirmedBy) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  if (job.routingConfirmed) return { error: "Routing already confirmed for this job." };
  job.items.forEach(item => {
    const seq = lineOverrides[item.lineId] || item.departmentSequence || [];
    item.departmentSequence = seq;
    item.departmentStatuses = seq.map((dept, i) => ({ department: dept, status: i === 0 ? "queued" : "pending" }));
  });
  job.routingConfirmed = true;
  job.routingConfirmedBy = confirmedBy;
  job.routingConfirmedDate = new Date().toISOString().slice(0, 10);
  ensureDepartmentBudgets(job); // Phase 4 — a budget slot per routed department, ready for that department to submit against
  const deptNames = [...new Set(job.items.flatMap(it => it.departmentSequence))].map(k => dc(k).n);
  logActivity({
    type: "job-routed", linkedType: "job", linkedId: job.id, user: confirmedBy,
    message: `Routing confirmed — ${job.items.length} line(s) dispatched to ${deptNames.length ? deptNames.join(', ') : 'no department'}`
  });
  // Routing is the pipeline's FIRST hand-off — ping each department that
  // just received queued work, one message per department per job
  // (6 Aug 2026 audit, loophole #8; same mechanism as notifyDeptHandoff).
  const firstStops = [...new Set(job.items.map(it => (it.departmentSequence || [])[0]).filter(Boolean))];
  firstStops.forEach(deptKey => {
    const to = DEPT_HANDOFF_RECIPIENT[deptKey];
    if (!to) return;
    try {
      Promise.resolve(sendMessage({
        from: confirmedBy || "Operations Manager", to,
        body: `New job routed to ${dc(deptKey).n}: ${job.id} (${job.items.length} line${job.items.length === 1 ? '' : 's'}) is now in your queue.`,
        linkedType: "job", linkedId: job.id
      })).catch(() => {});
    } catch (e) { /* notification must never break routing */ }
  });
  persistJobCardUpdate(job);
  return job;
}

// ═══════════════════════════════════════
// SHARED PRODUCTION PIPELINE — Joinery + Upholstery (Batch 8, Phase 2)
// One shared stage-pipeline primitive both departments consume — per
// Salman's own reasoning, Joinery (timber/hardware-driven) and Upholstery
// (fabric-driven, closer to Curtain's reality) aren't identical, but
// neither warrants its own bespoke ~5,900-line file the way Curtain has.
// Painting deliberately does NOT use any of this — it's fully standalone
// per Salman's explicit instruction (see the PAINTING section further
// below) — own materials/lead-time, zero shared plumbing.
//
// Stage vocabulary per line/department entry (departmentStatuses[]):
//   pending (waiting on an earlier department in this line's sequence)
//   -> queued (ready, not yet started — set by confirmJobRouting() or a
//      hand-off from the previous department)
//   -> in-production
//   -> qc
//   -> ready-for-handoff (QC passed — a real, visible stop, not
//      instantaneous, so a department can't push work along before its
//      own quality check clears) | rework (QC failed, loops back to
//      in-production, reworkCount increments for visibility)
//   -> done (only once hand-off is actually clicked)
// Generalizes Curtain's own already-proven Production -> Hoist QC ->
// Ready -> Installed + isRework shape rather than inventing new
// vocabulary from scratch.
//
// The hand-off itself is still the CURRENT department confirming "this is
// actually ready to move," not a return trip through the Operations
// Manager — Phase 1's routing queue is the only manager checkpoint in the
// whole design; every hand-off after that is between departments only.
// ═══════════════════════════════════════

// What both Joinery's and Upholstery's own dashboards read, parameterized
// by department key — every job line currently active (not pending on an
// earlier stop, not finished) in that department's queue.
function getDepartmentQueue(deptKey) {
  const rows = [];
  jobCards.forEach(job => {
    if (!job.routingConfirmed || job.status === "cancelled") return;
    job.items.forEach(item => {
      const entry = (item.departmentStatuses || []).find(d => d.department === deptKey);
      if (entry && entry.status !== "pending" && entry.status !== "done") {
        rows.push({ job, item, entry });
      }
    });
  });
  return rows;
}

function startLineProduction(jobId, lineId, deptKey) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === deptKey);
  if (!entry) return { error: "This line isn't routed to that department." };
  if (entry.status !== "queued") return { error: "Line must be Queued before starting production." };
  if (!isDepartmentBudgetApproved(job, deptKey)) return { error: "Department budget must be approved before production can start." };
  entry.status = "in-production";
  // Joinery-only internal granularity (Milestone D, 5 Aug 2026, role-
  // based access rollout) — see the JOINERY_SUB_STAGES note below.
  // entry.joinerySubStage is left undefined for every other department
  // (Upholstery/Painting never read or write it), so this is purely
  // additive to the shared pipeline, not a change to it.
  if (deptKey === "carp") entry.joinerySubStage = JOINERY_SUB_STAGES[0];
  persistJobCardUpdate(job);
  return item;
}

function submitLineForQC(jobId, lineId, deptKey) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === deptKey);
  if (!entry) return { error: "Line not found for that department." };
  if (entry.status !== "in-production") return { error: "Line must be In Production before it can go to QC." };
  // Phase 2 business-cycle audit finding #2 (5 Aug 2026): Joinery's
  // internal sub-stages (drafting -> cutting -> veneer-pressing ->
  // assembly, see JOINERY_SUB_STAGES below) used to be tracking-only —
  // a carp line could jump straight to QC while still sitting at
  // "drafting". This gate makes the sequence real. Only ever fires for
  // deptKey === "carp" with a joinerySubStage actually set, so
  // Upholstery/Painting (which never set this field) are unaffected.
  if (deptKey === "carp" && entry.joinerySubStage && entry.joinerySubStage !== JOINERY_SUB_STAGES[JOINERY_SUB_STAGES.length - 1]) {
    return { error: `This line hasn't finished Joinery's internal stages yet (currently at "${entry.joinerySubStage}" — must reach "${JOINERY_SUB_STAGES[JOINERY_SUB_STAGES.length - 1]}" first).` };
  }
  entry.status = "qc";
  persistJobCardUpdate(job);
  return item;
}

// pass=true -> "ready-for-handoff" (a real stop, waits for an explicit
// handOffLine() call below — see the stage-vocabulary note above for
// why); pass=false -> "rework" (loops back to in-production).
// QC-pass authority (6 Aug 2026 audit, loophole #6 — Salman's call: "the
// production manager should do QC"). A PASS may only be recorded by the
// department's own designated QC authority — the floor can't pass its own
// work. A FAIL stays open to anyone on purpose: flagging a problem should
// never be permission-gated. Painting's authority is its Lead (no manager
// role exists there by design).
const DEPT_QC_AUTHORITY = {
  carp: "Joinery Production Manager",
  uph: "Upholstery Manager",
  paint: "Painting Lead / Work Supervisor"
};

// reason (6 Aug 2026 audit, loophole #6): an optional QC reject reason,
// captured on a fail the same way Curtain's own QC already records one. Kept
// optional so existing callers (incl. e2e seeds) keep working — a fail with
// no reason just stores null. The reason is stamped on the entry AND threaded
// into the activity-log entry so getQCRejectReasonsForDept() can trend it.
function recordLineQCResult(jobId, lineId, deptKey, pass, user, reason) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === deptKey);
  if (!entry) return { error: "Line not found for that department." };
  if (entry.status !== "qc") return { error: "Line must be submitted for QC first." };
  if (!pass) {
    entry.status = "rework";
    entry.reworkCount = (entry.reworkCount || 0) + 1;
    entry.rejectReason = (reason || "").trim() || null;
    logActivity({ type: "qc-fail", linkedType: "job", linkedId: job.id, user, dept: deptKey, reason: entry.rejectReason, message: `${item.product} failed QC at ${dc(deptKey).n} (rework #${entry.reworkCount})${entry.rejectReason ? ` — ${entry.rejectReason}` : ""}` });
    persistJobCardUpdate(job);
    return item;
  }
  if (DEPT_QC_AUTHORITY[deptKey] && user !== DEPT_QC_AUTHORITY[deptKey]) {
    return { error: `A QC pass at ${dc(deptKey).n} must be recorded by the ${DEPT_QC_AUTHORITY[deptKey]}.` };
  }
  entry.rejectReason = null;
  entry.status = "ready-for-handoff";
  logActivity({ type: "qc-pass", linkedType: "job", linkedId: job.id, user, dept: deptKey, message: `${item.product} passed QC at ${dc(deptKey).n}` });
  persistJobCardUpdate(job);
  return item;
}

function reworkLineBackToProduction(jobId, lineId, deptKey) {
  const job = getJobCard(jobId);
  const item = job && job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === deptKey);
  if (!entry) return { error: "Line not found for that department." };
  if (entry.status !== "rework") return { error: "Line isn't in rework." };
  entry.status = "in-production";
  persistJobCardUpdate(job);
  return item;
}

// The actual hand-off — auto-advances to the next queued department (or
// marks the line fully done if this was the last stop). No manager
// re-approval, just the current department confirming it's actually ready
// to move — matches the design's "every hand-off after the first routing
// assignment auto-advances" rule.
function handOffLine(jobId, lineId, deptKey, user) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === deptKey);
  if (!entry) return { error: "Line not found for that department." };
  if (entry.status !== "ready-for-handoff") return { error: "Line must pass QC before hand-off." };
  const seq = item.departmentSequence || [];
  const idx = seq.indexOf(deptKey);
  entry.status = "done";
  if (idx > -1 && idx + 1 < seq.length) {
    const nextDept = seq[idx + 1];
    const nextEntry = item.departmentStatuses.find(d => d.department === nextDept);
    if (nextEntry) {
      nextEntry.status = "queued";
      logActivity({ type: "handoff", linkedType: "job", linkedId: job.id, user, message: `${item.product} handed off from ${dc(deptKey).n} to ${dc(nextDept).n}` });
      notifyDeptHandoff(nextDept, job, item, deptKey, user);
    }
  } else {
    logActivity({ type: "line-complete", linkedType: "job", linkedId: job.id, user, message: `${item.product} completed all routed departments` });
  }
  persistJobCardUpdate(job);
  return item;
}

// Hand-off notification (6 Aug 2026 audit, loophole #8) — the Messages
// system existed but the pipeline never called it, so a receiving
// department only found out about new work by opening its own queue. On
// every hand-off the NEXT department's lead identity now gets a real
// message (their dashboards already render the shared inbox widget with an
// unread badge). Fire-and-forget: sendMessage() is async, but its failure
// must never break the hand-off itself. Curtain is skipped — its work is
// tracked in curtainJobs[], not this pipeline's queues.
const DEPT_HANDOFF_RECIPIENT = {
  carp: "Joinery Production Manager",
  uph: "Upholstery Manager",
  paint: "Painting Lead / Work Supervisor"
};
function notifyDeptHandoff(nextDept, job, item, fromDeptKey, user) {
  const to = DEPT_HANDOFF_RECIPIENT[nextDept];
  if (!to) return;
  try {
    Promise.resolve(sendMessage({
      from: user || dc(fromDeptKey).n,
      to,
      body: `Incoming from ${dc(fromDeptKey).n}: ${item.product} (${job.id}) is now queued for ${dc(nextDept).n}.`,
      linkedType: "job", linkedId: job.id
    })).catch(() => {});
  } catch (e) { /* never let a notification failure break the hand-off */ }
}

// ═══════════════════════════════════════
// JOINERY INTERNAL SUB-STAGES (Milestone D, 5 Aug 2026, role-based
// access rollout)
// Joinery is the one department with no internal granularity — "carp"
// is a single flat queued -> in-production -> qc -> done pipeline, same
// as Upholstery's. That was fine when the only Joinery role was one
// Production Manager seeing everything; it isn't enough for Draftsman/
// Cutting List Team/Veneer Pressing Team to each have a real, distinct
// queue of their own actual work.
//
// This is an ADDITIVE layer, not a change to the shared pipeline above:
// entry.joinerySubStage is a new optional field on a "carp"-department
// departmentStatuses[] entry, only ever set while status === "in-
// production" (set to the first sub-stage by startLineProduction()
// above, advanced here). Upholstery/Painting entries never have this
// field at all — startLineProduction() only sets it when deptKey ===
// "carp" — so getDepartmentQueue()/renderDeptQueue()/the shared
// pipeline functions are completely unaware of it and unaffected.
//
// Sequence is INVENTED, not traced from a real Q-Pro reference (same
// caveat as JOB_DEPARTMENTS/JOB_LINE_STATUSES) — a reasonable
// placeholder good enough to give Draftsman/Cutting List Team/Veneer
// Pressing Team each a real, distinct queue: drafting (technical
// drawing/cutting spec) -> cutting (Cutting List Team) -> veneer-
// pressing (Veneer Pressing Team) -> assembly (the final internal step
// before the line is ready for submitLineForQC(), same as before this
// milestone).
//
// Site Supervisor/Floor Supervisor/Team Leader are collapsed onto ONE
// shared cross-sub-stage overview (getJoineryFloorOverview() below)
// rather than three separately-scoped views — Salman's own list gives
// no real basis to differentiate these three day-to-day (unlike
// Draftsman/Cutting List/Veneer Pressing, which are genuinely distinct
// jobs), so inventing three different slices of the same data would be
// guessing, not modeling something real. Documented here as a
// deliberate simplification, not an oversight — cheap to split later
// if a real difference surfaces. Assistant Production Manager (flagged
// by Salman as "maybe in the future") shares the Production Manager's
// own full dashboard rather than getting a redundant near-duplicate —
// it's a management-tier role by definition, not a shop-floor one.
// ═══════════════════════════════════════
const JOINERY_SUB_STAGES = ["drafting", "cutting", "veneer-pressing", "assembly"];

// Advances (or moves back to, for a correction) a carp line's internal
// sub-stage — validates the line is actually in-production for carp
// and the target is a real sub-stage, same defensive shape as
// updateJobLineStatus() above.
function advanceJoinerySubStage(jobId, lineId, toSubStage) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === "carp");
  if (!entry) return { error: "This line isn't routed to Joinery." };
  if (entry.status !== "in-production") return { error: "Line must be In Production to update its sub-stage." };
  if (!JOINERY_SUB_STAGES.includes(toSubStage)) return { error: "Not a real Joinery sub-stage." };
  entry.joinerySubStage = toSubStage;
  persistJobCardUpdate(job);
  return item;
}

// One sub-stage's own queue — what Draftsman/Cutting List Team/Veneer
// Pressing Team each see: every in-production carp line currently
// sitting at exactly their stage, across every job.
function getJoinerySubStageQueue(subStage) {
  const rows = [];
  jobCards.forEach(job => {
    if (!job.routingConfirmed || job.status === "cancelled") return;
    job.items.forEach(item => {
      const entry = (item.departmentStatuses || []).find(d => d.department === "carp");
      if (entry && entry.status === "in-production" && entry.joinerySubStage === subStage) rows.push({ job, item, entry });
    });
  });
  return rows;
}

// Cross-sub-stage overview — Site Supervisor/Floor Supervisor/Team
// Leader's shared view (see the design note above): every in-
// production carp line, grouped by its current sub-stage, for
// day-to-day floor coordination rather than one narrow queue.
function getJoineryFloorOverview() {
  const overview = {};
  JOINERY_SUB_STAGES.forEach(s => { overview[s] = []; });
  jobCards.forEach(job => {
    if (!job.routingConfirmed || job.status === "cancelled") return;
    job.items.forEach(item => {
      const entry = (item.departmentStatuses || []).find(d => d.department === "carp");
      if (entry && entry.status === "in-production" && entry.joinerySubStage) overview[entry.joinerySubStage].push({ job, item, entry });
    });
  });
  return overview;
}

// ═══════════════════════════════════════
// PAINTING — standalone (Batch 8, Phase 3)
// Deliberately NOT built on the shared Joinery/Upholstery pipeline above
// — Salman's explicit instruction: Painting has its own materials and
// process lead times, "I don't want it to share anything." So this is a
// separate set of functions, not a third consumer of getDepartmentQueue()/
// startLineProduction()/etc., even though the stage shape looks similar —
// a future change to the Joinery/Upholstery pipeline should never ripple
// into Painting, or vice versa. It DOES still read/write the same
// job.items[].departmentStatuses array everyone shares (that's core Job
// Card data, populated by Phase 1's routing regardless of department) —
// only the workflow/functions around it are separate.
// ═══════════════════════════════════════
const PAINT_DEPT_KEY = "paint";

function getPaintingQueue() {
  const rows = [];
  jobCards.forEach(job => {
    if (!job.routingConfirmed || job.status === "cancelled") return;
    job.items.forEach(item => {
      const entry = (item.departmentStatuses || []).find(d => d.department === PAINT_DEPT_KEY);
      if (entry && entry.status !== "pending" && entry.status !== "done") rows.push({ job, item, entry });
    });
  });
  return rows;
}

// Painting's own material lead-time tracking — its actual point of
// difference from Joinery/Upholstery. materialStatus: "awaiting" |
// "ordered" | "arrived". Purely informational (doesn't gate production —
// Painting Lead uses it to know what's realistic to start).
function setPaintingMaterialStatus(jobId, lineId, materialStatus, eta = null) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === PAINT_DEPT_KEY);
  if (!entry) return { error: "Line not routed to Painting." };
  entry.materialStatus = materialStatus;
  entry.materialETA = eta;
  persistJobCardUpdate(job);
  return item;
}

function startPaintingWork(jobId, lineId) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === PAINT_DEPT_KEY);
  if (!entry) return { error: "Line not routed to Painting." };
  if (entry.status !== "queued") return { error: "Line must be Queued before starting." };
  if (!isDepartmentBudgetApproved(job, PAINT_DEPT_KEY)) return { error: "Department budget must be approved before production can start." };
  entry.status = "in-production";
  persistJobCardUpdate(job);
  return item;
}

function submitPaintingForQC(jobId, lineId) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === PAINT_DEPT_KEY);
  if (!entry) return { error: "Line not routed to Painting." };
  if (entry.status !== "in-production") return { error: "Line must be In Production before it can go to QC." };
  entry.status = "qc";
  persistJobCardUpdate(job);
  return item;
}

function recordPaintingQCResult(jobId, lineId, pass, user, reason) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === PAINT_DEPT_KEY);
  if (!entry) return { error: "Line not routed to Painting." };
  if (entry.status !== "qc") return { error: "Line must be submitted for QC first." };
  if (!pass) {
    entry.status = "rework";
    entry.reworkCount = (entry.reworkCount || 0) + 1;
    entry.rejectReason = (reason || "").trim() || null; // 6 Aug 2026 audit loophole #6 — see recordLineQCResult()
    logActivity({ type: "qc-fail", linkedType: "job", linkedId: job.id, user, dept: PAINT_DEPT_KEY, reason: entry.rejectReason, message: `${item.product} failed QC at Painting (rework #${entry.reworkCount})${entry.rejectReason ? ` — ${entry.rejectReason}` : ""}` });
    persistJobCardUpdate(job);
    return item;
  }
  if (user !== DEPT_QC_AUTHORITY[PAINT_DEPT_KEY]) {
    return { error: `A QC pass at Painting must be recorded by the ${DEPT_QC_AUTHORITY[PAINT_DEPT_KEY]}.` };
  }
  entry.rejectReason = null;
  entry.status = "ready-for-handoff";
  logActivity({ type: "qc-pass", linkedType: "job", linkedId: job.id, user, dept: PAINT_DEPT_KEY, message: `${item.product} passed QC at Painting` });
  persistJobCardUpdate(job);
  return item;
}

function reworkPaintingBackToProduction(jobId, lineId) {
  const job = getJobCard(jobId);
  const item = job && job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === PAINT_DEPT_KEY);
  if (!entry) return { error: "Line not routed to Painting." };
  if (entry.status !== "rework") return { error: "Line isn't in rework." };
  entry.status = "in-production";
  persistJobCardUpdate(job);
  return item;
}

function handOffPaintingLine(jobId, lineId, user) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  const entry = item && (item.departmentStatuses || []).find(d => d.department === PAINT_DEPT_KEY);
  if (!entry) return { error: "Line not routed to Painting." };
  if (entry.status !== "ready-for-handoff") return { error: "Line must pass QC before hand-off." };
  const seq = item.departmentSequence || [];
  const idx = seq.indexOf(PAINT_DEPT_KEY);
  entry.status = "done";
  if (idx > -1 && idx + 1 < seq.length) {
    const nextDept = seq[idx + 1];
    const nextEntry = item.departmentStatuses.find(d => d.department === nextDept);
    if (nextEntry) {
      nextEntry.status = "queued";
      logActivity({ type: "handoff", linkedType: "job", linkedId: job.id, user, message: `${item.product} handed off from Painting to ${dc(nextDept).n}` });
      notifyDeptHandoff(nextDept, job, item, PAINT_DEPT_KEY, user);
    }
  } else {
    logActivity({ type: "line-complete", linkedType: "job", linkedId: job.id, user, message: `${item.product} completed all routed departments` });
  }
  persistJobCardUpdate(job);
  return item;
}

// ═══════════════════════════════════════
// THREE-TIER COSTING + BUDGET APPROVAL GATE (Batch 8, Phase 4)
// Estimated (the Estimator's rough BOM at quotation stage, already
// exists via computeBOMTotals()) -> Budgeted (each routed department's
// own more detailed cost entry, THIS section — reuses computeBOMTotals()
// itself rather than a second calculation method) -> Actual (recorded
// once a department's work is done). Writes into projects[].budget/
// .actuals — the exact fields the Batch 7 bridge seeded as empty
// placeholders; this is what actually fills them.
//
// Department budget entry here is deliberately a single aggregate figure
// per cost category (Material/Labour/Subcontract/Hiring/Others), not a
// full repeating multi-line BOM editor like the Estimator's — a
// reasonable scope simplification for this pass, still driving real
// budget-vs-actual variance. Wrapped as a one-line array per category so
// computeBOMTotals() (which expects arrays) still does the real
// calculation, unchanged.
//
// Department -> approver is a configurable ASSIGNMENT, not a hardcoded
// merge of departments — the key correction from the design conversation.
// Today: Joinery AND Painting both route to the Joinery Production
// Manager (a real staffing fact — no dedicated Painting Manager exists
// yet, Al Maraya doesn't want to hire one right now), each as its own
// separate submission landing in the same person's queue. Upholstery has
// its own manager. Curtain is deliberately NOT in this map — it already
// has its own pre-existing budget/approval mechanism
// (curtainJobs[].budgetStatus, built long before this session,
// approved by Silva via Operations' own "Curtain Approvals" tab) and is
// out of scope here; retrofitting it onto this new mechanism risks
// breaking an already-working, previously-verified flow for no real
// benefit.
// ═══════════════════════════════════════
// Keyed by user_type (supabase/schema.sql), not a display name — a
// legacy leftover from before real per-person login existed, when a
// module's "current user" was a hardcoded string literally equal to the
// role name (see joineryCurrentUser/upholsteryCurrentUser in
// joinery.js/upholstery.js). Fixed as part of the role-based access
// rollout (5 Aug 2026): getPendingBudgetApprovalsFor() now compares
// against the ACTING user's real user_type (window.cloudUserType),
// since a real person's display name is no longer the same string as
// their role.
// Fix Plan Phase 2 (5 Aug 2026, Fable audit finding #2) — changed from
// the submitting department's own manager to Operations Manager,
// confirmed with Salman. The department manager submits their own
// budget and was ALSO the only configured approver — with exactly one
// real person in each of these roles today, blocking self-approval
// outright (the maker-checker fix built alongside this) would otherwise
// mean carp/uph budgets could never be approved by anyone at all.
// Operations Manager never submits any of these budgets themselves and
// is already the one human checkpoint earlier in the same pipeline
// (job routing) — a real, distinct second person, not Owner having to
// personally review every submission regardless of size.
const DEPARTMENT_APPROVERS = {
  carp: "operations_manager",
  paint: "operations_manager",
  uph: "operations_manager"
};
const EMPTY_BOM_CATEGORIES = ["materials", "labour", "subcontract", "hiring", "others"];

function blankDepartmentBudget() {
  return {
    bom: { materials: [], labour: [], subcontract: [], hiring: [], others: [], ohPercents: { material: 0, labour: 0, subcontract: 0, hiring: 0, others: 0 }, profitPercent: 0 },
    approvalStatus: "not-submitted", // not-submitted | pending | approved | rejected
    submittedBy: null, submittedDate: null, approvedBy: null, approvedDate: null, rejectionComment: null,
    actual: { material: 0, labour: 0, subcontract: 0, hiring: 0, others: 0, recordedBy: null, recordedDate: null }
  };
}

// Lazily creates a budget slot for every department a job is actually
// routed to (once routing is confirmed) — called wherever a department
// module needs to read/write a job's budget entry for its own key.
function ensureDepartmentBudgets(job) {
  if (!job.departmentBudgets) job.departmentBudgets = {};
  const depts = new Set(job.items.flatMap(it => it.departmentSequence || []));
  depts.forEach(k => { if (!job.departmentBudgets[k]) job.departmentBudgets[k] = blankDepartmentBudget(); });
  return job.departmentBudgets;
}

// Recomputes the whole-job projects[] rollup by summing every
// department's CURRENT budget (or actual) figures — overwrites rather
// than accumulates, so resubmitting a department's budget doesn't
// double-count.
function recomputeJobBudgetRollup(job) {
  const proj = projects.find(p => p.id === job.id);
  if (!proj || !job.departmentBudgets) return;
  const budgetTotals = { mat: 0, lab: 0, sub: 0, hir: 0, oth: 0 };
  const actualTotals = { mat: 0, lab: 0, sub: 0, hir: 0, oth: 0 };
  Object.values(job.departmentBudgets).forEach(entry => {
    if (entry.approvalStatus !== "not-submitted") {
      const t = computeBOMTotals(entry.bom);
      budgetTotals.mat += t.materialCost; budgetTotals.lab += t.labourCost; budgetTotals.sub += t.subcontractCost;
      budgetTotals.hir += t.hiringCost; budgetTotals.oth += t.othersCost;
    }
    const a = entry.actual || {};
    actualTotals.mat += a.material || 0; actualTotals.lab += a.labour || 0; actualTotals.sub += a.subcontract || 0;
    actualTotals.hir += a.hiring || 0; actualTotals.oth += a.others || 0;
  });
  const round = n => Math.round(n * 1000) / 1000;
  proj.budget.mat = round(budgetTotals.mat); proj.budget.lab = round(budgetTotals.lab); proj.budget.sub = round(budgetTotals.sub);
  proj.budget.hir = round(budgetTotals.hir); proj.budget.oth = round(budgetTotals.oth);
  proj.budget.cost = round(budgetTotals.mat + budgetTotals.lab + budgetTotals.sub + budgetTotals.hir + budgetTotals.oth);
  proj.actuals.mat = round(actualTotals.mat); proj.actuals.lab = round(actualTotals.lab); proj.actuals.sub = round(actualTotals.sub);
  proj.actuals.hir = round(actualTotals.hir); proj.actuals.oth = round(actualTotals.oth);
}

function submitDepartmentBudget(jobId, deptKey, categoryAmounts, submittedBy) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  ensureDepartmentBudgets(job);
  const entry = job.departmentBudgets[deptKey];
  if (!entry) return { error: "This job isn't routed to that department." };
  EMPTY_BOM_CATEGORIES.forEach(cat => {
    const amt = Number(categoryAmounts[cat]) || 0;
    entry.bom[cat] = amt > 0 ? [{ amount: amt }] : [];
  });
  entry.approvalStatus = "pending";
  entry.submittedBy = submittedBy;
  entry.submittedDate = new Date().toISOString().slice(0, 10);
  entry.rejectionComment = null;
  recomputeJobBudgetRollup(job);
  logActivity({ type: "budget-submitted", linkedType: "job", linkedId: job.id, user: submittedBy, message: `${dc(deptKey).n} budget submitted for approval` });
  persistJobCardUpdate(job);
  return entry;
}

// Fix Plan Phase 2 (5 Aug 2026, Fable audit findings #1/#2) — a real
// owner-approval threshold, matching Salman's own original project
// instructions (CLAUDE.md §1: "Salman (owner, approves budgets over
// BD 5,000)") — confirmed live by the audit that no such check existed
// anywhere in the app before this. Configurable, not hardcoded in
// several places. Scoped to department budgets only (Salman's explicit
// call) — quotation approval is untouched.
const BUDGET_APPROVAL_THRESHOLD = 5000;
function requiresOwnerApproval(totalCostInclOH) {
  return totalCostInclOH > BUDGET_APPROVAL_THRESHOLD;
}

function approveDepartmentBudget(jobId, deptKey, approvedBy) {
  const job = getJobCard(jobId);
  if (!job || !job.departmentBudgets || !job.departmentBudgets[deptKey]) return { error: "Budget submission not found." };
  const entry = job.departmentBudgets[deptKey];
  if (entry.approvalStatus !== "pending") return { error: "Budget must be submitted before it can be approved." };
  // Maker-checker (5 Aug 2026, Fable audit finding #2) — the same person
  // who submitted this budget can never also approve it, confirmed with
  // Salman as blocked outright rather than only above the threshold.
  // Same shape of gap already closed once for quotation pricing (see
  // the pricing-lock trigger, supabase/schema.sql).
  if (approvedBy === entry.submittedBy) return { error: "The same person who submitted this budget can't also approve it." };
  const totals = computeBOMTotals(entry.bom);
  if (requiresOwnerApproval(totals.totalCostInclOH)) {
    // Over threshold — the department manager's own approval is real and
    // recorded, but production still can't start (isDepartmentBudgetApproved()
    // only returns true for "approved") until Owner/Admin clears the
    // second step below.
    entry.approvalStatus = "pending-owner-review";
    entry.managerApprovedBy = approvedBy;
    entry.managerApprovedDate = new Date().toISOString().slice(0, 10);
    logActivity({ type: "budget-approved", linkedType: "job", linkedId: job.id, user: approvedBy, message: `${dc(deptKey).n} budget (BD ${totals.totalCostInclOH.toFixed(3)}, over BD ${BUDGET_APPROVAL_THRESHOLD}) approved by manager — awaiting Owner review before production can start` });
    persistJobCardUpdate(job);
    return entry;
  }
  entry.approvalStatus = "approved";
  entry.approvedBy = approvedBy;
  entry.approvedDate = new Date().toISOString().slice(0, 10);
  logActivity({ type: "budget-approved", linkedType: "job", linkedId: job.id, user: approvedBy, message: `${dc(deptKey).n} budget approved — production can start` });
  persistJobCardUpdate(job);
  return entry;
}

// The second, Owner/Admin-only step for a budget that crossed the
// threshold above. Deliberately a separate function (not a parameter on
// approveDepartmentBudget()) so every existing call site for a normal,
// under-threshold budget is completely unaffected.
function approveDepartmentBudgetOwnerReview(jobId, deptKey, approvedBy) {
  const job = getJobCard(jobId);
  if (!job || !job.departmentBudgets || !job.departmentBudgets[deptKey]) return { error: "Budget submission not found." };
  const entry = job.departmentBudgets[deptKey];
  if (entry.approvalStatus !== "pending-owner-review") return { error: "This budget isn't awaiting Owner review." };
  entry.approvalStatus = "approved";
  entry.approvedBy = approvedBy;
  entry.approvedDate = new Date().toISOString().slice(0, 10);
  logActivity({ type: "budget-approved", linkedType: "job", linkedId: job.id, user: approvedBy, message: `${dc(deptKey).n} budget received final Owner approval (over BD ${BUDGET_APPROVAL_THRESHOLD}) — production can start` });
  persistJobCardUpdate(job);
  return entry;
}
function rejectDepartmentBudgetOwnerReview(jobId, deptKey, rejectedBy, comment) {
  const job = getJobCard(jobId);
  if (!job || !job.departmentBudgets || !job.departmentBudgets[deptKey]) return { error: "Budget submission not found." };
  const entry = job.departmentBudgets[deptKey];
  if (entry.approvalStatus !== "pending-owner-review") return { error: "This budget isn't awaiting Owner review." };
  entry.approvalStatus = "rejected";
  entry.approvedBy = rejectedBy;
  entry.approvedDate = new Date().toISOString().slice(0, 10);
  entry.rejectionComment = comment;
  logActivity({ type: "budget-rejected", linkedType: "job", linkedId: job.id, user: rejectedBy, message: `${dc(deptKey).n} budget rejected at Owner review — ${comment || "no comment"}` });
  persistJobCardUpdate(job);
  return entry;
}
function rejectDepartmentBudget(jobId, deptKey, rejectedBy, comment) {
  const job = getJobCard(jobId);
  if (!job || !job.departmentBudgets || !job.departmentBudgets[deptKey]) return { error: "Budget submission not found." };
  const entry = job.departmentBudgets[deptKey];
  if (entry.approvalStatus !== "pending") return { error: "Budget must be submitted before it can be rejected." };
  entry.approvalStatus = "rejected";
  entry.approvedBy = rejectedBy;
  entry.approvedDate = new Date().toISOString().slice(0, 10);
  entry.rejectionComment = comment;
  logActivity({ type: "budget-rejected", linkedType: "job", linkedId: job.id, user: rejectedBy, message: `${dc(deptKey).n} budget rejected — ${comment || "no comment"}` });
  persistJobCardUpdate(job);
  return entry;
}
// approverUserType: a user_type key (e.g. "joinery_production_manager"),
// not a display name — see the note on DEPARTMENT_APPROVERS above.
// "owner" is a wildcard match (Salman/the offline e2e test bypass, which
// sets window.cloudUserType to "owner" since there's no real per-person
// profile in that path — see finishCloudLogin() in auth.js) — matches
// the real requirement that the Owner should see every pending approval,
// not just one department's.
function getPendingBudgetApprovalsFor(approverUserType) {
  const rows = [];
  jobCards.forEach(job => {
    if (!job.departmentBudgets) return;
    Object.entries(job.departmentBudgets).forEach(([deptKey, entry]) => {
      if (entry.approvalStatus === "pending" && (approverUserType === "owner" || DEPARTMENT_APPROVERS[deptKey] === approverUserType)) rows.push({ job, deptKey, entry });
      // Fix Plan Phase 2 (5 Aug 2026) — the second, over-threshold review
      // step is Owner-only, regardless of which department it's for.
      if (entry.approvalStatus === "pending-owner-review" && approverUserType === "owner") rows.push({ job, deptKey, entry });
    });
  });
  return rows;
}
// Company-wide version (4 Aug 2026, built for the Operations/Owner
// dashboards) — same shape as getPendingBudgetApprovalsFor() above but not
// filtered to one approver's own inbox.
function getAllPendingBudgetApprovals() {
  const rows = [];
  jobCards.forEach(job => {
    if (!job.departmentBudgets) return;
    Object.entries(job.departmentBudgets).forEach(([deptKey, entry]) => {
      if (entry.approvalStatus === "pending" || entry.approvalStatus === "pending-owner-review") rows.push({ job, deptKey, entry });
    });
  });
  return rows;
}
// One real, honest "what needs attention" rollup per job — built for the
// Operations Dashboard (4 Aug 2026), which used to be static hand-authored
// demo markup with fake numbers, never wired to any real data at all.
// Deliberately doesn't invent flags this app has no real data for (no
// "subs overdue"/"snags open" tracking exists anywhere in the data model —
// left out rather than faked).
function getJobAttentionFlags(job) {
  const flags = [];
  // Urgency/deadline signals (6 Aug 2026 audit, loophole #8).
  if (job.urgent && job.status === "open") flags.push({ label: "URGENT", tone: "bad" });
  if (job.promisedDate && job.status === "open" && job.promisedDate < todayStrGlobal() && !jobProductionComplete(job)) {
    flags.push({ label: `Promised ${job.promisedDate} — overdue`, tone: "bad" });
  }
  if (!job.routingConfirmed && job.status !== "cancelled") flags.push({ label: "Awaiting Routing", tone: "warn" });
  // Fix Plan Phase 1 (5 Aug 2026, Fable audit finding #3) — defense in
  // depth alongside the confirmVariationToJobCard() fix above: flags ANY
  // routed department that's missing its departmentBudgets slot entirely,
  // not just the one call site (Variations) that caused this the first
  // time. ensureDepartmentBudgets() guarantees every department in any
  // item's departmentSequence gets a slot — a routed job missing one
  // means some future code path skipped that call, exactly the class of
  // silent gap this is meant to surface instead of leaving invisible.
  if (job.routingConfirmed) {
    const routedDepts = new Set(job.items.flatMap(it => it.departmentSequence || []));
    routedDepts.forEach(deptKey => {
      if (!job.departmentBudgets || !job.departmentBudgets[deptKey]) {
        flags.push({ label: `${dc(deptKey).n} Budget Not Yet Submitted`, tone: "warn" });
      }
    });
  }
  if (job.departmentBudgets) {
    Object.entries(job.departmentBudgets).forEach(([deptKey, entry]) => {
      if (entry.approvalStatus === "pending") flags.push({ label: `${dc(deptKey).n} Budget Pending`, tone: "warn" });
      // Fix Plan Phase 2 (5 Aug 2026) — distinct from plain "pending" so
      // it's clear this one is stuck on Owner specifically, not the
      // department manager.
      if (entry.approvalStatus === "pending-owner-review") flags.push({ label: `${dc(deptKey).n} Budget Awaiting Owner Review`, tone: "warn" });
      if (isDepartmentOverBudget(job.id, deptKey)) flags.push({ label: `${dc(deptKey).n} Over Budget`, tone: "bad" });
    });
  }
  return flags;
}

// Over-budget check is reactive/informational only, per Salman's explicit
// instruction — flag it, never hold production. Mirrors Curtain's own
// existing "Material Overage" tile pattern rather than a new gate.
function isDepartmentOverBudget(jobId, deptKey) {
  const job = getJobCard(jobId);
  const entry = job && job.departmentBudgets && job.departmentBudgets[deptKey];
  if (!entry || entry.approvalStatus !== "approved") return false;
  const budgeted = computeBOMTotals(entry.bom).totalCostInclOH;
  const actual = Object.values(entry.actual || {}).filter(v => typeof v === "number").reduce((s, v) => s + v, 0);
  return budgeted > 0 && actual > budgeted;
}
// Department-wide over-budget count — built for the Joinery/Upholstery/
// Painting dashboards (4 Aug 2026 audit follow-up), which showed
// production-queue counts only and nothing about budget health, even
// though every dept already has a real Budgets/Approvals tab tracking
// exactly this.
function getOverBudgetCountForDept(deptKey) {
  return jobCards.filter(j => j.departmentBudgets && j.departmentBudgets[deptKey] && isDepartmentOverBudget(j.id, deptKey)).length;
}

// Fix Plan Phase 2 (5 Aug 2026) — with DEPARTMENT_APPROVERS moved to
// Operations Manager, a department's own dashboard no longer has an
// approver inbox; its "Budgets Pending" tile now means "MY submissions
// still awaiting someone else's approval" (pending with the Operations
// Manager, or pending-owner-review with Salman for over-BD-5,000 ones).
function getOwnPendingBudgetCountForDept(deptKey) {
  return jobCards.filter(j => j.departmentBudgets && j.departmentBudgets[deptKey] &&
    (j.departmentBudgets[deptKey].approvalStatus === "pending" || j.departmentBudgets[deptKey].approvalStatus === "pending-owner-review")).length;
}

function recordDepartmentActual(jobId, deptKey, categoryAmounts, recordedBy) {
  const job = getJobCard(jobId);
  if (!job || !job.departmentBudgets || !job.departmentBudgets[deptKey]) return { error: "Budget submission not found." };
  const entry = job.departmentBudgets[deptKey];
  if (entry.approvalStatus !== "approved") return { error: "Budget must be approved before recording actuals." };
  ["material", "labour", "subcontract", "hiring", "others"].forEach(cat => { entry.actual[cat] = Number(categoryAmounts[cat]) || 0; });
  entry.actual.recordedBy = recordedBy;
  entry.actual.recordedDate = new Date().toISOString().slice(0, 10);
  recomputeJobBudgetRollup(job);
  const overBudget = isDepartmentOverBudget(jobId, deptKey);
  logActivity({ type: "actual-recorded", linkedType: "job", linkedId: job.id, user: recordedBy, message: `${dc(deptKey).n} actual cost recorded${overBudget ? " — OVER BUDGET" : ""}` });
  persistJobCardUpdate(job);
  return entry;
}

// The production-start gate — a department's line can't move past
// "queued" until ITS OWN budget is approved. Applied inside
// startLineProduction() (Joinery/Upholstery) and startPaintingWork()
// (Painting) above; kept as one small shared check both call, so the
// rule lives in exactly one place.
function isDepartmentBudgetApproved(job, deptKey) {
  return !!(job.departmentBudgets && job.departmentBudgets[deptKey] && job.departmentBudgets[deptKey].approvalStatus === "approved");
}

// ═══════════════════════════════════════
// VARIATION ORDERS (Batch 7, 3 Aug 2026)
// Real problem Salman raised: a variation/change order on an existing job
// (e.g. a 50K joinery job gets an addition or a sales return) used to need
// a whole new Enquiry -> Quotation -> Estimator -> Approver cycle with no
// link back to the original job — budgeting/consumption/labour couldn't
// roll up across variations. Direction agreed: keep full Estimator ->
// Approver discipline (no shortcut — Salman explicitly wants that rigor
// kept), but a Variation attaches directly to the existing Job's
// customer/project instead of starting from a bare Enquiry, and on
// approval it MERGES into the existing Job Card rather than spawning a
// new one.
//
// Reuses quotations[].rev rather than inventing a new field — that field
// already existed (format "AMD-15350-0", "-0" is revision 0) but was
// never incremented anywhere before this, a strong sign the real Q-Pro
// system already modeled quotation revisions and this app just never
// built the "create a new revision" flow.
//
// A Variation is a real quotations[] entry (parentJobId set, enquiryId
// null) so it automatically flows through the EXACT SAME Estimator/
// Approver stage machinery every other quotation uses — no parallel
// pipeline to maintain.
// ═══════════════════════════════════════

function nextVariationRev(jobId) { return quotations.filter(q => q.parentJobId === jobId).length + 1; }

function createVariationForJob(jobId, { notes = "" } = {}) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  if (job.status === "cancelled") return { error: "This job is cancelled — a Variation can't be added to it." };
  const origQtn = quotations.find(q => q.id === job.quotationId);
  const rev = nextVariationRev(jobId);
  const baseId = job.quotationId.replace(/-\d+$/, "");
  const qtn = {
    id: baseId + "-" + rev, rev, enquiryId: null, parentJobId: jobId,
    customerId: job.customerId, projectName: job.projectName,
    taxPercent: origQtn ? origQtn.taxPercent : 10, contactPerson: "",
    withEstimation: true, notes,
    items: [], coveringLetterTemplate: null, coveringLetterBody: "", termsTemplate: null, termsBody: "",
    lifecycleStatus: "draft", stage: "sales",
    estimatorPickedBy: null, approverPickedBy: null,
    headerComment: "", auditLog: [],
    date: new Date().toISOString().slice(0, 10), confirmDate: null
  };
  quotations.push(qtn);
  logActivity({ type: "variation-created", linkedType: "job", linkedId: jobId, user: "Sales", message: `Variation ${qtn.id} created` });
  persistNewQuotation(qtn);
  return qtn;
}

// Approval gate mirrors confirmQuotationToJobCard() exactly — refuses
// until Approver has flipped lifecycleStatus to "open". Merges items into
// the EXISTING Job Card (new lineIds continuing on from the job's current
// max, so departmentStatuses/deliveredQty tracking stays per-line-correct)
// instead of creating a new jobCards[] entry.
function confirmVariationToJobCard(qtnId, confirmedBy) {
  const qtn = quotations.find(q => q.id === qtnId);
  if (!qtn) return { error: "Quotation not found." };
  if (!qtn.parentJobId) return { error: "Not a Variation." };
  if (qtn.lifecycleStatus !== "open") return { error: "Variation must be Open (Approver-approved) before it can be confirmed." };
  const job = getJobCard(qtn.parentJobId);
  if (!job) return { error: "Parent Job Card not found." };
  const totals = computeQuotationTotals(qtn);
  let nextLineId = job.items.reduce((m, it) => Math.max(m, it.lineId), 0);
  qtn.items.forEach(it => {
    nextLineId++;
    const seq = it.departmentSequence || [];
    job.items.push({
      lineId: nextLineId, product: it.product, qty: it.qty, unit: it.unit, rate: it.rate,
      discPercent: it.discPercent, amount: it.amount, vatPercent: it.vatPercent, netAmount: it.netAmount,
      deliveredQty: 0, variationId: qtn.id, departmentSequence: seq,
      // The job's own initial routing already went through the Operations
      // Manager's queue (see confirmJobRouting()) — a variation merging in
      // AFTER that point doesn't need a second manager pass, its line just
      // joins the already-approved routing directly. If the parent job
      // somehow hasn't been routed yet, leave this empty — it'll be picked
      // up by the normal routing queue alongside the original lines.
      departmentStatuses: job.routingConfirmed ? seq.map((dept, i) => ({ department: dept, status: i === 0 ? "queued" : "pending" })) : []
    });
  });
  // Fix Plan Phase 1 (5 Aug 2026, Fable audit finding #3/Section 1.1) — a
  // Variation merging in a department the job wasn't originally routed to
  // (e.g. an upholstered-bench-seat line added to a joinery job) used to
  // never get a departmentBudgets slot created for it, since only
  // confirmJobRouting() called ensureDepartmentBudgets() before this fix.
  // The new line would show up in that department's real production
  // queue (getDepartmentQueue) but never on its Budgets tab
  // (getJobsForDepartmentBudget only lists jobs that already have an
  // entry) — a permanently stuck line with no discoverable way for the
  // correct manager to submit the missing budget. Same call
  // confirmJobRouting() already makes, just re-run here since a
  // Variation can introduce departments after that point.
  ensureDepartmentBudgets(job);
  job.amount = Math.round((job.amount + totals.netTotal) * 1000) / 1000;
  if (!job.variationIds) job.variationIds = [];
  job.variationIds.push(qtn.id);
  qtn.lifecycleStatus = "confirmed";
  qtn.confirmDate = new Date().toISOString().slice(0, 10);
  persistQuotationUpdate(qtn);
  persistJobCardUpdate(job);
  bridgeJobToOperationsAndCurtain(job);
  logActivity({ type: "variation-merged", linkedType: "job", linkedId: job.id, user: confirmedBy, message: `Variation ${qtn.id} approved and merged — +BD ${totals.netTotal.toFixed(3)}` });
  return job;
}

function getVariationsForJob(jobId) {
  return quotations.filter(q => q.parentJobId === jobId).sort((a, b) => a.rev - b.rev);
}

// "Update BOM" on Edit Job — re-syncs Qty/Rate/Amount from the linked
// Quotation's current items (Estimation may have re-run since confirm),
// matched by lineId. Preserves deliveredQty/departmentStatuses on each job
// item since those belong to the Job, not the Quotation.
function refreshJobFromQuotation(jobId) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const qtn = quotations.find(q => q.id === job.quotationId);
  if (!qtn) return { error: "Linked Quotation not found." };
  job.items.forEach(item => {
    const src = qtn.items.find(it => it.lineId === item.lineId);
    if (src) {
      item.qty = src.qty; item.rate = src.rate; item.discPercent = src.discPercent;
      item.amount = src.amount; item.vatPercent = src.vatPercent; item.netAmount = src.netAmount;
    }
  });
  // Recompute the job's headline amount from the (now refreshed) lines
  // (6 Aug 2026 audit, Medium). Previously this synced each line but left
  // job.amount frozen at its confirm-time value, so an Approver correction
  // to the quote left the job's revenue figure stale everywhere it's read.
  // Sums netAmount (VAT-inclusive) — job.amount has always been the
  // quotation's netTotal, which computeQuotationTotals() defines as the sum
  // of item netAmounts (an earlier draft of this fix summed pre-VAT
  // it.amount, silently shrinking job.amount by the VAT share on refresh —
  // corrected same day).
  job.amount = Math.round(job.items.reduce((s, it) => s + (it.netAmount || it.amount || 0), 0) * 1000) / 1000;
  persistJobCardUpdate(job);
  return job;
}

// A line is production-complete when every one of its routed department
// stops has reached "done" — EXCEPT "curt" stops, which Curtain tracks in
// its own curtainJobs[] system and never advances inside departmentStatuses
// here (so a curtain job would otherwise never be deliverable). A line with
// no routed stops (or only curt stops) has nothing to build here and is
// treated as complete. (6 Aug 2026 audit, High — deliver-before-production.)
function jobLineProductionComplete(item) {
  return (item.departmentStatuses || [])
    .filter(d => d.department !== "curt")
    .every(d => d.status === "done");
}
function jobProductionComplete(job) {
  return (job.items || []).every(jobLineProductionComplete);
}
function nextDeliveryNoteId(job) { return "DN-" + job.id + "-" + (job.deliveryNotes.length + 1); }
// entries: [{ lineId, requiredQty }] — increments deliveredQty on each line,
// capped at the line's own Qty (can't over-deliver).
// routingConfirmed guard (4 Aug 2026 audit finding): this and the 3
// functions below were only gated at the UI level (jobs.js disabled the
// tiles/button) — a real loophole, since nothing stopped these from being
// called directly, bypassing the "Awaiting Operations Routing" lock
// entirely. Enforced here now too, matching how every other real gate in
// this app validates at the data layer, not just the UI. Also blocks a
// cancelled job regardless of its routing status — a job routed before
// being cancelled previously stayed fully invoiceable/issuable forever,
// since nothing here ever checked job.status (the department production
// queues already excluded cancelled jobs — getJobsPendingRouting()/
// getDepartmentQueue() — this was the one place that didn't).
function addDeliveryNote(jobId, entries) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  if (!job.routingConfirmed) return { error: "This job hasn't been routed by Operations yet." };
  if (job.status === "cancelled") return { error: "This job is cancelled." };
  // Don't deliver a line whose production isn't finished (6 Aug 2026 audit,
  // High). Previously a full-qty delivery note could be raised while every
  // department still sat at "queued", and getPipelineFunnel() would then
  // report the job "Delivered" — a job marked delivered that was never built.
  const incomplete = entries
    .map(e => job.items.find(it => it.lineId === e.lineId))
    .filter(it => it && (it.qty - it.deliveredQty) > 0 && !jobLineProductionComplete(it));
  if (incomplete.length) {
    return { error: `Can't deliver — production isn't finished for: ${incomplete.map(it => it.product).join(', ')}.` };
  }
  const lines = entries.map(e => {
    const item = job.items.find(it => it.lineId === e.lineId);
    if (!item) return null;
    const requiredQty = Math.min(e.requiredQty || 0, item.qty - item.deliveredQty);
    item.deliveredQty += requiredQty;
    return { lineId: e.lineId, requiredQty };
  }).filter(Boolean);
  const note = { id: nextDeliveryNoteId(job), date: new Date().toISOString().slice(0, 10), lines };
  job.deliveryNotes.push(note);
  persistJobCardUpdate(job);
  return note;
}

function nextMaterialsMoveId(job, kind) { return kind + "-" + job.id + "-" + (job[kind === "MI" ? "materialsIssues" : "materialsReturns"].length + 1); }
// items: [{ jobItemLineId, itemId, stockItemName, unit, qty }] — Location is
// required (Q-Pro supports multi-warehouse stock; this app has one implicit
// location today, so it's captured but not yet validated against a location
// master). itemId is optional — only lines actually picked from the real
// Item Master (as opposed to free-text stock item names) move the needle on
// itemMaster[].closingStock, matching the real system's own distinction
// between Inventory-tracked items and free-text/job-direct material names.
function addMaterialsIssue(jobId, { location, items }) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  if (!job.routingConfirmed) return { error: "This job hasn't been routed by Operations yet." };
  if (job.status === "cancelled") return { error: "This job is cancelled." };
  if (!location) return { error: "Location is required." };
  const move = { id: nextMaterialsMoveId(job, "MI"), date: new Date().toISOString().slice(0, 10), location, items, status: "confirmed" };
  job.materialsIssues.push(move);
  items.forEach(it => {
    if (!it.itemId) return;
    const item = itemMaster.find(i => i.id === it.itemId);
    if (item) item.closingStock = (item.closingStock || 0) - (Number(it.qty) || 0);
  });
  persistJobCardUpdate(job);
  return move;
}
// Mirrors addMaterialsIssue() exactly — a reversal of stock issued to a job.
function addMaterialsReturn(jobId, { location, items }) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  if (!job.routingConfirmed) return { error: "This job hasn't been routed by Operations yet." };
  if (job.status === "cancelled") return { error: "This job is cancelled." };
  if (!location) return { error: "Location is required." };
  const move = { id: nextMaterialsMoveId(job, "MR"), date: new Date().toISOString().slice(0, 10), location, items, status: "confirmed" };
  job.materialsReturns.push(move);
  items.forEach(it => {
    if (!it.itemId) return;
    const item = itemMaster.find(i => i.id === it.itemId);
    if (item) item.closingStock = (item.closingStock || 0) + (Number(it.qty) || 0);
  });
  persistJobCardUpdate(job);
  return move;
}

// Cross-job flattened list for the Inventory module's Material Issue /
// Material Return screens (Transactions → Inventory → ...) — Q-Pro shows
// these as their own top-level document lists (MI/MR NUMBER, CLIENT, DATE,
// JOB NUMBER, ACTION) rather than nested under each Job Card, so this reads
// across every jobCards[] entry instead of duplicating the storage.
function getAllMaterialsMoves(kind) {
  const field = kind === "MI" ? "materialsIssues" : "materialsReturns";
  const rows = [];
  jobCards.forEach(job => {
    const c = customers.find(x => x.id === job.customerId);
    (job[field] || []).forEach(move => {
      rows.push({ move, jobId: job.id, client: c ? c.name : "—" });
    });
  });
  return rows.sort((a, b) => (b.move.date || "").localeCompare(a.move.date || ""));
}

// Cancelling reverses the stock effect (mirror-image of the original move)
// and flags the move itself — matches the "cancelled" red/pink visual state
// observed in the real Material Return list.
function cancelMaterialsMove(jobId, kind, moveId) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const field = kind === "MI" ? "materialsIssues" : "materialsReturns";
  const move = job[field].find(m => m.id === moveId);
  if (!move) return { error: "Move not found." };
  if (move.status === "cancelled") return { error: "Already cancelled." };
  const sign = kind === "MI" ? 1 : -1; // reverse: MI cancel gives stock back, MR cancel takes it back out
  move.items.forEach(it => {
    if (!it.itemId) return;
    const item = itemMaster.find(i => i.id === it.itemId);
    if (item) item.closingStock = (item.closingStock || 0) + sign * (Number(it.qty) || 0);
  });
  move.status = "cancelled";
  persistJobCardUpdate(job);
  return move;
}

// Per-line-per-department status — upserts (replaces the existing entry for
// that department on that line, or adds a new one).
function updateJobLineStatus(jobId, lineId, department, status) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const item = job.items.find(it => it.lineId === lineId);
  if (!item) return { error: "Line item not found." };
  const existing = item.departmentStatuses.find(d => d.department === department);
  if (existing) existing.status = status;
  else item.departmentStatuses.push({ department, status });
  persistJobCardUpdate(job);
  return item;
}

// Actual labour cost entry — pairs with the Estimator's earlier Labour Cost
// TAB estimate (estimate-vs-actual). OT multiplier of 1.5x is a standard
// assumption, not confirmed against Q-Pro's own calculation.
function addLabourCostEntry(jobId, { employee, jobItemLineId, normalHrs = 0, otHrs = 0, normalRate = 0, otRate = 0 }) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const amount = normalHrs * normalRate + otHrs * otRate * 1.5;
  const entry = { id: job.labourCostEntries.length + 1, employee, jobItemLineId, normalHrs, otHrs, normalRate, otRate, amount, date: new Date().toISOString().slice(0, 10) };
  job.labourCostEntries.push(entry);
  persistJobCardUpdate(job);
  return entry;
}

function setJobStatus(jobId, status) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  // A job can't be marked COMPLETED while routed departments are still
  // mid-flight (6 Aug 2026 audit, loophole #8 — this was completely
  // ungated). Same production-complete rule as delivery, so "completed"
  // can never be less finished than "deliverable". Cancelling stays
  // ungated — cancelling mid-production is a legitimate real-world action,
  // and re-opening a cancelled job was already supported.
  if (status === "completed" && !jobProductionComplete(job)) {
    return { error: "Can't mark completed — production isn't finished for every line on this job yet." };
  }
  job.status = status;
  persistJobCardUpdate(job);
  return job;
}

// Urgency + promised delivery date (6 Aug 2026 audit, loophole #8 — no
// urgent/priority/deadline field existed anywhere on a job). Set by
// Operations; surfaced via getJobAttentionFlags() and a 🔥 marker on the
// department queues, so shop-floor prioritisation has a real signal.
function setJobUrgent(jobId, urgent, user) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  job.urgent = !!urgent;
  logActivity({ type: "job-priority", linkedType: "job", linkedId: job.id, user, message: `${job.id} marked ${job.urgent ? "URGENT" : "normal priority"}` });
  persistJobCardUpdate(job);
  return job;
}
function setJobPromisedDate(jobId, promisedDate, user) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  job.promisedDate = promisedDate || null;
  logActivity({ type: "job-promised-date", linkedType: "job", linkedId: job.id, user, message: `${job.id} promised date ${job.promisedDate ? "set to " + job.promisedDate : "cleared"}` });
  persistJobCardUpdate(job);
  return job;
}

function getJobCardKPIs() {
  return {
    open: jobCards.filter(j => j.status === "open").length,
    completed: jobCards.filter(j => j.status === "completed").length,
    cancelled: jobCards.filter(j => j.status === "cancelled").length
  };
}

// ═══════════════════════════════════════
// VEHICLE FLEET + DELIVERY SCHEDULING (Milestone E, 5 Aug 2026,
// role-based access rollout)
// Both entirely new — no live Q-Pro trace exists for either (unlike
// most of this app), and no existing code to build on the way
// Curtain/Upholstery/Joinery had. Scoped deliberately minimal per the
// plan: a vehicle list + inspection checklist/log for Vehicle Fleet
// Inspector; a lightweight PLANNING layer for Delivery/Scheduling that
// sits entirely alongside — not inside — the existing job.deliveryNotes[]
// system (addDeliveryNote() already records an ACTUAL, already-happened
// delivery the moment it's created, incrementing deliveredQty
// immediately; there's no "planned but not yet delivered" concept in
// that model, and retrofitting one would mean changing semantics Sales/
// Jobs already depend on). deliverySchedule[] below is a separate,
// non-invasive plan/track layer: real delivery still happens through
// the unchanged addDeliveryNote() flow when it actually occurs.
//
// Deliberately kept LOCAL-ONLY (in-memory, like every other array in
// this file before its own cloud-migration slice) — persisting these
// to Supabase is real future work if these two roles need cross-device
// sync, same as jobCards[] was local-only before Phase 2 slice 3.
// ═══════════════════════════════════════

const vehicles = [];
function nextVehicleId() { return "VEH" + String(1000 + vehicles.length); }
function addVehicle({ plateNumber, make, model, type }) {
  if (!plateNumber || !plateNumber.trim()) return { error: "Plate number is required." };
  const v = { id: nextVehicleId(), plateNumber: plateNumber.trim(), make: make || "", model: model || "", type: type || "Van", status: "active" };
  vehicles.push(v);
  return v;
}
function setVehicleStatus(vehicleId, status) {
  const v = vehicles.find(x => x.id === vehicleId);
  if (!v) return { error: "Vehicle not found." };
  v.status = status;
  return v;
}

// A reasonable generic checklist — not confirmed against any real
// company policy, good enough to exercise a real pass/fail inspection
// record per vehicle.
const VEHICLE_INSPECTION_CHECKLIST_ITEMS = ["Tyres", "Brakes", "Lights", "Engine Oil", "Coolant/Fluids", "Body Condition", "Registration & Insurance Valid"];

const vehicleInspections = [];
function nextInspectionId() { return "INSP" + String(1000 + vehicleInspections.length); }
// checklist: [{ item, pass: boolean, notes }] — one entry per
// VEHICLE_INSPECTION_CHECKLIST_ITEMS item. overallStatus is derived,
// not separately entered — a single failed item fails the inspection.
function recordVehicleInspection(vehicleId, checklist, inspectedBy) {
  const v = vehicles.find(x => x.id === vehicleId);
  if (!v) return { error: "Vehicle not found." };
  if (!Array.isArray(checklist) || checklist.length === 0) return { error: "Checklist is required." };
  const overallStatus = checklist.every(c => c.pass) ? "pass" : "fail";
  const inspection = { id: nextInspectionId(), vehicleId, date: new Date().toISOString().slice(0, 10), inspectedBy, checklist, overallStatus };
  vehicleInspections.push(inspection);
  return inspection;
}
// Real bug found live-testing (5 Aug 2026): sorting by the `date`
// string alone can't break a tie between two inspections recorded the
// SAME day (a real, plausible case — re-inspecting after a same-day
// fail), so "latest" wasn't reliable — a stable sort with a 0-comparator
// tie just preserves input order, silently keeping the EARLIER same-day
// inspection as "latest". Fixed by reversing creation order directly
// (vehicleInspections.push() already guarantees chronological order)
// instead of re-deriving it from a date string with no time component.
function getInspectionsForVehicle(vehicleId) {
  return vehicleInspections.filter(i => i.vehicleId === vehicleId).reverse();
}
function getLatestInspection(vehicleId) {
  const list = getInspectionsForVehicle(vehicleId);
  return list.length ? list[0] : null;
}
// Overdue = no inspection in the last 30 days — an arbitrary, reasonable
// default, not confirmed against a real company policy.
function isInspectionOverdue(vehicleId) {
  const latest = getLatestInspection(vehicleId);
  if (!latest) return true;
  return daysBetween ? daysBetween(latest.date, todayStr()) > 30 : (new Date() - new Date(latest.date)) / 86400000 > 30;
}
function getVehicleFleetKPIs() {
  const active = vehicles.filter(v => v.status === "active");
  return {
    total: vehicles.length,
    active: active.length,
    overdue: active.filter(v => isInspectionOverdue(v.id)).length,
    failedLast: active.filter(v => { const l = getLatestInspection(v.id); return l && l.overallStatus === "fail"; }).length
  };
}

// ── Delivery Scheduling — plan layer, see the design note above ──
const deliverySchedule = [];
function nextDeliveryScheduleId() { return "DS" + String(1000 + deliverySchedule.length); }
// Jobs worth scheduling: routed, not cancelled, with at least one line
// still short of its full qty (mirrors the same "undelivered" check
// addDeliveryNote() itself already does per-line).
function getJobsNeedingDeliveryScheduling() {
  return jobCards.filter(j => j.routingConfirmed && j.status !== "cancelled" && j.items.some(it => (it.deliveredQty || 0) < it.qty));
}
function scheduleDelivery(jobId, { plannedDate, driver, vehicleId, notes }) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  if (!plannedDate) return { error: "Planned date is required." };
  const entry = { id: nextDeliveryScheduleId(), jobId, plannedDate, driver: driver || "", vehicleId: vehicleId || null, notes: notes || "", status: "planned" };
  deliverySchedule.push(entry);
  return entry;
}
function markDeliveryScheduleStatus(id, status) {
  const entry = deliverySchedule.find(e => e.id === id);
  if (!entry) return { error: "Schedule entry not found." };
  // Can't mark a planned delivery "delivered" before the job is actually
  // built (6 Aug 2026 audit, High) — same production-complete rule as
  // addDeliveryNote(), so the two delivery paths can't disagree.
  if (status === "delivered") {
    const job = getJobCard(entry.jobId);
    if (job && !jobProductionComplete(job)) {
      return { error: "Can't mark delivered — production isn't finished for every line on this job yet." };
    }
  }
  entry.status = status;
  return entry;
}
function getDeliverySchedule() {
  return deliverySchedule.slice().sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
}

// ═══════════════════════════════════════
// CUSTOMER FEEDBACK (Phase 2 business-cycle audit finding #3, 5 Aug
// 2026) — confirmed there was no function/form/array/dashboard tile
// anywhere capturing how a job actually landed with the customer.
// Deliberately minimal: one 1-5 rating + optional comments per job,
// captured by Delivery/Scheduling right when a delivery is marked
// complete (see fleet-delivery.js) — the single most natural moment to
// ask, not a full satisfaction-survey system. LOCAL-ONLY for now, same
// as the rest of Milestone E's vehicles[]/deliverySchedule[] (not yet
// on Supabase) — resets on reload, consistent with that precedent.
// ═══════════════════════════════════════
const customerFeedback = [];
function nextFeedbackId() { return customerFeedback.length ? Math.max(...customerFeedback.map(f => f.id)) + 1 : 1; }
function recordCustomerFeedback(jobId, { rating, comments }, recordedBy) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) return { error: "Rating must be a whole number from 1 to 5." };
  const entry = { id: nextFeedbackId(), jobId, rating: r, comments: (comments || "").trim(), recordedBy, recordedDate: new Date().toISOString().slice(0, 10) };
  customerFeedback.push(entry);
  logActivity({ type: "customer-feedback", linkedType: "job", linkedId: job.id, user: recordedBy, message: `Customer feedback recorded for ${job.id}: ${r}/5${entry.comments ? " — " + entry.comments : ""}` });
  return entry;
}
function getFeedbackForJob(jobId) {
  return customerFeedback.filter(f => f.jobId === jobId).sort((a, b) => b.id - a.id);
}
function getRecentFeedback(limit = 10) {
  return customerFeedback.slice().sort((a, b) => b.id - a.id).slice(0, limit);
}
function getAverageRating() {
  if (customerFeedback.length === 0) return null;
  return Math.round((customerFeedback.reduce((s, f) => s + f.rating, 0) / customerFeedback.length) * 10) / 10;
}

// ═══════════════════════════════════════
// MODULE 6 — TAX INVOICE
// From Salman's live Q-Pro trace: a Tax Invoice is a system-generated PDF
// tied 1:1 to a Job Card — there's no standalone "Create Invoice" form for
// a Sales-role user. Generation is modeled here as a manual action from the
// Job Card hub (rather than auto-firing on Confirm Quote) since the live
// trace only says "likely" for that second trigger — safer to make it an
// explicit action than to silently double-generate invoices later if that
// assumption turns out wrong.
//
// No real customer/bank/IBAN details were captured (Salman deliberately
// didn't reproduce them) — this app has none to seed with, so payment
// details on the rendered document are placeholders, not real data.
// ═══════════════════════════════════════

const taxInvoices = [];
// Shape mirrors qproJobCardNo's "JB26AMD01863" convention: IN + YY + division
// code + sequence. Division code defaults to "AMD" (the company code seen
// elsewhere) since the real per-division code list hasn't been captured.
function nextInvoiceNo() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "IN" + yy + "AMD" + String(1000 + taxInvoices.length).padStart(5, "0");
}

function getInvoicesForJob(jobId) { return taxInvoices.filter(inv => inv.jobId === jobId); }

// invoicedPercent defaults to 100 (full invoice) — Q-Pro's own partial-
// invoicing rules (e.g. milestone billing) weren't captured in this trace.
function generateInvoiceFromJob(jobId, { lpoNo = null, invoicedPercent = 100 } = {}) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  if (!job.routingConfirmed) return { error: "This job hasn't been routed by Operations yet." };
  if (job.status === "cancelled") return { error: "This job is cancelled." };
  // Cumulative invoice cap (6 Aug 2026 audit, High). Nothing stopped two
  // full 100% invoices on one job. Sum the invoicedPercent already billed
  // against this job and refuse anything that would push the total past 100%.
  const alreadyInvoicedPct = taxInvoices
    .filter(iv => iv.jobId === jobId)
    .reduce((s, iv) => s + ((iv.totals && iv.totals.invoicedPercent) || 0), 0);
  if (alreadyInvoicedPct >= 100) return { error: "This job is already fully invoiced (100%)." };
  if (alreadyInvoicedPct + invoicedPercent > 100 + 1e-6) {
    return { error: `Only ${(100 - alreadyInvoicedPct).toFixed(1)}% of this job remains uninvoiced.` };
  }
  // Line value bills NET OF DISCOUNT (6 Aug 2026, found by the Ewan
  // real-quote replication run): it.amount is the pre-discount figure, and
  // billing from it silently overcharged any discounted quote — the Ewan
  // replica invoiced BD 1765.500 against a contracted BD 1350.000. The
  // Job Card line carries discPercent (not discAmt), so discount is
  // re-derived from it here; netAmount can't be used directly because a
  // partial (invoicedPercent < 100) invoice needs the pre-VAT base.
  const lineNet = it => it.amount * (1 - (it.discPercent || 0) / 100);
  const total = job.items.reduce((s, it) => s + lineNet(it), 0);
  const vat = job.items.reduce((s, it) => s + (lineNet(it) * (it.vatPercent || 0) / 100), 0) * (invoicedPercent / 100);
  const invoicedTotal = total * (invoicedPercent / 100);
  const netTotal = invoicedTotal + vat;
  const inv = {
    id: nextInvoiceNo(), jobId, quotationId: job.quotationId, customerId: job.customerId,
    date: new Date().toISOString().slice(0, 10), lpoNo,
    items: job.items.map(it => ({ description: it.product, qty: it.qty, unit: it.unit, rate: it.rate, amount: it.amount })),
    totals: { total, invoicedPercent, vat, netTotal },
    paidAmount: 0, creditedAmount: 0
  };
  taxInvoices.push(inv);
  job.linkedInvoiceIds.push(inv.id);
  logActivity({ type: "invoice-generated", linkedType: "job", linkedId: jobId, user: "Accounts", message: `Tax Invoice ${inv.id} generated — BD ${netTotal.toFixed(3)}` });
  persistJobCardUpdate(job);
  return inv;
}

// ═══════════════════════════════════════
// BATCH 4 — PROFORMA, SALES RECEIPT, SALES CREDIT NOTE
// Traced from docs/qpro-mapping/batch4salesandoperations.txt. Proforma has
// no manual create form in the live system — it's generated from the
// Manage Quote / Job Card Management hub, same "generate from hub" pattern
// as Tax Invoice above. Receipt and Credit Note mirror Batch 1's Supplier
// Payment/Debit Note structurally (two-stage: pick client, then a payment-
// method grid + invoice-allocation table) but on the customer side against
// taxInvoices[] instead of purchaseInvoices[]. The live trace reports the
// same "No Invoice List Available..!" bug here as Payment/Debit Note — per
// the established pattern (Batch 1), fixed here, not reproduced:
// getCustomerOpenInvoices() actually looks the invoices up.
// ═══════════════════════════════════════

const proformas = [];
function nextProformaId() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "P" + yy + "AMD" + String(1000 + proformas.length).padStart(5, "0");
}
function getProformasForJob(jobId) { return proformas.filter(p => p.jobId === jobId); }
function createProformaFromJob(jobId) {
  const job = getJobCard(jobId);
  if (!job) return { error: "Job Card not found." };
  const total = job.items.reduce((s, it) => s + it.amount, 0);
  const vat = job.items.reduce((s, it) => s + (it.amount * (it.vatPercent || 0) / 100), 0);
  const p = {
    id: nextProformaId(), jobId, quotationId: job.quotationId, customerId: job.customerId,
    date: new Date().toISOString().slice(0, 10),
    items: job.items.map(it => ({ description: it.product, qty: it.qty, unit: it.unit, rate: it.rate, amount: it.amount })),
    totals: { total, vat, netTotal: total + vat }
  };
  proformas.push(p);
  return p;
}

// Balance nets off both a Receipt's paidAmount and a Credit Note's
// creditedAmount — an invoice can be partly settled by either.
function invoiceBalance(inv) {
  return Math.round((inv.totals.netTotal - (inv.paidAmount || 0) - (inv.creditedAmount || 0)) * 1000) / 1000;
}

const salesReceipts = [];
function nextReceiptId() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "RC" + yy + "AMD" + String(1000 + salesReceipts.length).padStart(5, "0");
}

// Returns { invoiceId, invoiceDate, invoiceAmount, paidAmount, balanceAmount }
// rows for every Tax Invoice of this customer that still has a balance.
function getCustomerOpenInvoices(customerId) {
  return taxInvoices
    .filter(inv => inv.customerId === customerId)
    .map(inv => ({
      invoiceId: inv.id, invoiceDate: inv.date, invoiceAmount: inv.totals.netTotal,
      paidAmount: inv.paidAmount || 0, balanceAmount: invoiceBalance(inv)
    }))
    .filter(row => row.balanceAmount > 0.0001);
}

function createSalesReceipt({
  customerId, division = null, receiptDate = null, methods = {}, amount,
  referenceNumber = "", allocations = [], advanceAmount = 0, remarks = ""
}) {
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return { error: "Please select a client." };
  if (!amount || Number(amount) <= 0) return { error: "Amount is required." };
  const receipt = {
    id: nextReceiptId(), customerId, division,
    receiptDate: receiptDate || new Date().toISOString().slice(0, 10),
    methods,       // same shape as Payment: { cash:{enabled,amount}, bank:{enabled,amount,bank}, cCard:{...}, wallet:{...}, cheque:{...} }
    amount: Number(amount), referenceNumber,
    allocations,   // [{ invoiceId, payingAmount, discountAmount }]
    advanceAmount: Number(advanceAmount) || 0,
    remarks, status: "confirmed"
  };
  salesReceipts.push(receipt);
  allocations.forEach(a => {
    const inv = taxInvoices.find(i => i.id === a.invoiceId);
    if (inv) inv.paidAmount = (inv.paidAmount || 0) + (Number(a.payingAmount) || 0);
  });
  return receipt;
}
function getReceiptsForJob(jobId) {
  const invIds = getInvoicesForJob(jobId).map(i => i.id);
  return salesReceipts.filter(r => r.allocations.some(a => invIds.includes(a.invoiceId)));
}

const salesCreditNotes = [];
function nextCreditNoteId() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "CN" + yy + "AMD" + String(1000 + salesCreditNotes.length).padStart(5, "0");
}

function createSalesCreditNote({ customerId, division = null, creditNoteDate = null, amount, allocations = [], reason = "" }) {
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return { error: "Please select a client." };
  if (!amount || Number(amount) <= 0) return { error: "Amount is required." };
  const cn = {
    id: nextCreditNoteId(), customerId, division,
    creditNoteDate: creditNoteDate || new Date().toISOString().slice(0, 10),
    amount: Number(amount), allocations, reason, status: "confirmed"
  };
  salesCreditNotes.push(cn);
  allocations.forEach(a => {
    const inv = taxInvoices.find(i => i.id === a.invoiceId);
    if (inv) inv.creditedAmount = (inv.creditedAmount || 0) + (Number(a.creditingAmount) || 0);
  });
  return cn;
}
// Matches the red/pink cancelled-row convention used elsewhere (Debit Note,
// Materials Issue/Return) — reverses the credited amount off the invoice.
function cancelSalesCreditNote(id) {
  const cn = salesCreditNotes.find(x => x.id === id);
  if (!cn || cn.status === "cancelled") return;
  cn.allocations.forEach(a => {
    const inv = taxInvoices.find(i => i.id === a.invoiceId);
    if (inv) inv.creditedAmount = Math.max(0, (inv.creditedAmount || 0) - (Number(a.creditingAmount) || 0));
  });
  cn.status = "cancelled";
}
function getCreditNotesForJob(jobId) {
  const invIds = getInvoicesForJob(jobId).map(i => i.id);
  return salesCreditNotes.filter(cn => cn.allocations.some(a => invIds.includes(a.invoiceId)));
}

// ═══════════════════════════════════════
// ACCOUNTS — GENERAL LEDGER (Batch 3: Chart of Accounts, Ledger, General
// Receipt, General Payment, Journal)
// Traced from a live Q-Pro spec (docs/qpro-mapping/batch-3-accounts.txt).
// This is the real bookkeeping layer underneath Sales/Purchases — separate
// from accounts.js's pre-existing read-only KPI dashboard (revenue/
// receivables/payables), which stays untouched. Every payment-method field
// on Receipt/Credit Note/Payment (Batch 1/4) is supposed to resolve to one
// of these ledgers via a Voucher Ledger Mapping (Batch 5) — that mapping
// step itself is out of scope for this pass; ledgers are picked directly.
//
// 15 system Primary groups are locked/non-editable in the live system (no
// parent, can't be renamed) — modeled the same way here. The 11 custom
// sub-groups and their Primary Group classification (Asset/Liability/
// Income/Expense) are the real values from the live trace.
// ═══════════════════════════════════════

const ACCOUNTS_PRIMARY_GROUPS = [
  { name: "Branch/Divisions", classification: "Asset" },
  { name: "Capital Account", classification: "Liability" },
  { name: "Current Assets", classification: "Asset" },
  { name: "Current Liabilities", classification: "Liability" },
  { name: "Direct Expenses", classification: "Expense" },
  { name: "Direct Incomes", classification: "Income" },
  { name: "Fixed Assets", classification: "Asset" },
  { name: "Indirect Expenses", classification: "Expense" },
  { name: "Indirect Incomes", classification: "Income" },
  { name: "Investments", classification: "Asset" },
  { name: "Loans (Liability)", classification: "Liability" },
  { name: "Misc. Expenses (Asset)", classification: "Asset" },
  { name: "Purchase Accounts", classification: "Expense" },
  { name: "Sales Accounts", classification: "Income" },
  { name: "Suspense A/c", classification: "Asset" }
];
const ACCOUNTS_CLASSIFICATIONS = ["Asset", "Liability", "Income", "Expense"];

// The 11 real custom sub-groups from the live trace, each Under one Primary.
const ACCOUNTS_CUSTOM_GROUPS = [
  { name: "Customers", under: "Current Assets" },
  { name: "Suppliers", under: "Current Liabilities" },
  { name: "Sales", under: "Current Assets" },
  { name: "Duties & Taxes", under: "Current Liabilities" },
  { name: "Purchases", under: "Direct Expenses" },
  { name: "Cash Accounts", under: "Current Assets" },
  { name: "Bank Accounts", under: "Current Assets" },
  { name: "Salary & Staff Costs", under: "Indirect Expenses" },
  { name: "Staff Salaries", under: "Indirect Expenses" },
  { name: "Machinery Repair & Maintenance", under: "Indirect Expenses" },
  { name: "Tools & Equipment", under: "Indirect Expenses" }
];

const accountsGroups = [
  ...ACCOUNTS_PRIMARY_GROUPS.map((g, i) => ({
    id: "AG-" + String(i + 1).padStart(3, "0"),
    name: g.name, under: "Primary", isPrimary: true, editable: false,
    classification: g.classification, sortOption: i + 1
  })),
  ...ACCOUNTS_CUSTOM_GROUPS.map((g, i) => ({
    id: "AG-" + String(ACCOUNTS_PRIMARY_GROUPS.length + i + 1).padStart(3, "0"),
    name: g.name, under: g.under, isPrimary: false, editable: true,
    classification: ACCOUNTS_PRIMARY_GROUPS.find(p => p.name === g.under).classification,
    sortOption: ACCOUNTS_PRIMARY_GROUPS.length + i + 1
  }))
];

function nextAccountsGroupId() {
  return "AG-" + String(accountsGroups.length + 1).padStart(3, "0");
}

// Only custom sub-groups can be created/edited — the 15 Primary groups are
// locked, matching the live system exactly (Edit action only shows on the
// 11 custom rows there).
function createAccountsGroup({ name, under, sortOption = accountsGroups.length + 1 } = {}) {
  if (!name || !name.trim()) return { error: "Group Name is required." };
  const parent = accountsGroups.find(g => g.name === under && g.isPrimary);
  if (!parent) return { error: "Under (a Primary group) is required." };
  const group = {
    id: nextAccountsGroupId(), name: name.trim(), under: parent.name,
    isPrimary: false, editable: true, classification: parent.classification,
    sortOption: Number(sortOption) || accountsGroups.length + 1
  };
  accountsGroups.push(group);
  return group;
}

const ACCOUNTS_TAXABILITY_OPTIONS = ["Taxable (10%)", "Taxable (5%)", "Taxable (0%)", "Exempt (0%)", "Out of scope (0%)"];

// Ledger master — the actual Chart-of-Accounts list every "Ledger"
// autocomplete across Receipt/Payment/Journal reads from. Seeded with the
// real ledger names already referenced elsewhere in this app (Purchase —
// the default PO/PI line ledger; the CASH_LEDGERS list) plus the GL
// accounts named in the live trace (Sales, Sales Return, VAT, etc.), since
// those are confirmed real values rather than invented ones. There is
// deliberately no separate "Bank" master — a bank account is just a Ledger
// under "Bank Accounts" with the banking fields filled in, matching the
// live system exactly.
const ledgers = [
  { code: "LED0001", name: "Cash", group: "Cash Accounts" },
  { code: "LED0002", name: "Bank - BBK Current", group: "Bank Accounts" },
  { code: "LED0003", name: "Bank - NBB Current", group: "Bank Accounts" },
  { code: "LED0004", name: "Petty Cash", group: "Cash Accounts" },
  { code: "LED0005", name: "Purchase", group: "Purchases" },
  { code: "LED0006", name: "Sales", group: "Sales" },
  { code: "LED0007", name: "Sales Return", group: "Sales" },
  { code: "LED0008", name: "Discount (Sales/Purchase)", group: "Purchases" },
  { code: "LED0009", name: "VAT", group: "Duties & Taxes" },
  { code: "LED0010", name: "Printing & Stationery", group: "Indirect Expenses" },
  { code: "LED0011", name: "Freight & Courier Charges", group: "Indirect Expenses" },
  { code: "LED0012", name: "Salary", group: "Staff Salaries" },
  { code: "LED0013", name: "Air Ticket", group: "Indirect Expenses" },
  { code: "LED0014", name: "Air Ticket Payable", group: "Current Liabilities" },
  { code: "LED0015", name: "Round OFF", group: "Suspense A/c" },
  { code: "LED0016", name: "Project Cost - Commission", group: "Direct Expenses" },
  { code: "LED0017", name: "Food Expenses", group: "Indirect Expenses" },
  { code: "LED0018", name: "Repair and Maintenance", group: "Machinery Repair & Maintenance" },
  { code: "LED0019", name: "Tools and equipments", group: "Tools & Equipment" }
].map((l, i) => ({
  id: "LG-" + String(i + 1).padStart(4, "0"),
  code: l.code, name: l.name, groupName: l.group,
  taxability: "Out of scope (0%)",
  bankAccountNumber: "", bankAccountHolderName: "", ibanNumber: "", bankSwift: "", bankName: "", bankBranch: "",
  openingBalance: 0, isPayroll: false
}));

function nextLedgerCode() {
  return "LED" + String(ledgers.length + 1).padStart(4, "0");
}

function createLedger({
  name, groupName, taxability = "Out of scope (0%)",
  bankAccountNumber = "", bankAccountHolderName = "", ibanNumber = "", bankSwift = "", bankName = "", bankBranch = "",
  openingBalance = 0, isPayroll = false
} = {}) {
  if (!name || !name.trim()) return { error: "Ledger Name is required." };
  const group = accountsGroups.find(g => g.name === groupName);
  if (!group) return { error: "Under (Group) is required." };
  const ledger = {
    id: "LG-" + String(ledgers.length + 1).padStart(4, "0"),
    code: nextLedgerCode(), name: name.trim(), groupName: group.name, taxability,
    bankAccountNumber, bankAccountHolderName, ibanNumber, bankSwift, bankName, bankBranch,
    openingBalance: Number(openingBalance) || 0, isPayroll: !!isPayroll
  };
  ledgers.push(ledger);
  return ledger;
}

// Voucher Ledger Mapping (Q-Pro Batch 5) — the missing accounting glue
// flagged as an open item since Batch 3: resolves each payment instrument
// used on Receipt/Payment/Credit-Note/Debit-Note forms to a real Ledger,
// rather than those forms picking a ledger directly. Keys match the exact
// payment-method keys already used by sumPaymentMethods() above (cash/
// bank/cCard/wallet/cheque) plus "discount" for the sixth instrument the
// live trace documents. Seeded with sensible defaults from the real
// ledgers[] list above — editable, not locked.
const VOUCHER_PAYMENT_METHODS = [
  { key: "cash", label: "Cash" }, { key: "bank", label: "Bank" },
  { key: "cCard", label: "Credit/Debit Card" }, { key: "wallet", label: "Wallet" },
  { key: "cheque", label: "Cheque" }, { key: "discount", label: "Discount" }
];
let voucherLedgerMap = {
  cash: "Cash", bank: "Bank - BBK Current", cCard: "Bank - BBK Current",
  wallet: "Bank - BBK Current", cheque: "Bank - BBK Current", discount: "Discount (Sales/Purchase)"
};
function setVoucherLedgerMapping(key, ledgerName) {
  if (!VOUCHER_PAYMENT_METHODS.some(m => m.key === key)) return { error: "Unknown payment method." };
  if (!ledgers.some(l => l.name === ledgerName)) return { error: "Please select a Ledger." };
  voucherLedgerMap[key] = ledgerName;
  return voucherLedgerMap;
}
// Resolve a payment-method key to its mapped Ledger record — forms that
// want to actually consume the mapping (rather than pick a ledger
// directly) call this. Not yet wired into every existing Receipt/Payment/
// Credit Note/Debit Note form — see CLAUDE.md session log for which do and
// don't, and why (kept as a documented follow-up rather than touching
// several already-working flows in one pass).
function resolveVoucherLedger(methodKey) {
  const name = voucherLedgerMap[methodKey];
  return ledgers.find(l => l.name === name) || null;
}

// Shared by General Receipt/Payment/Journal — the five payment-mode blocks
// (Cash/Bank/C Card/Wallet/Cheque) sum to the header Amount, confirmed live
// ("entering 50 in Cash auto-populated Amount as 50.000").
function sumPaymentMethods(methods = {}) {
  return ["cash", "bank", "cCard", "wallet", "cheque"]
    .reduce((s, k) => s + (methods[k] && methods[k].enabled ? (Number(methods[k].amount) || 0) : 0), 0);
}

const generalReceipts = [];
function nextGeneralReceiptId() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "GR" + yy + String(generalReceipts.length + 1).padStart(5, "0");
}

// General Receipt — pure GL-coded receipt, no Customer/Invoice linkage
// (confirmed live: the Ledger autocomplete only matches Chart-of-Accounts
// entries, returns "No Results Found" for a customer name).
function createGeneralReceipt({ date = null, methods = {}, amount, lines = [], remarks = "" } = {}) {
  const computedAmount = sumPaymentMethods(methods);
  const finalAmount = amount !== undefined && amount !== null && amount !== "" ? Number(amount) : computedAmount;
  const lineTotal = Math.round(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 1000) / 1000;
  if (!finalAmount || finalAmount <= 0 || Math.round(finalAmount * 1000) / 1000 !== lineTotal) {
    return { error: "Please check entered Amount." };
  }
  const receipt = {
    id: nextGeneralReceiptId(), date: date || new Date().toISOString().slice(0, 10),
    methods, amount: finalAmount,
    lines: lines.map(l => ({ ledgerId: l.ledgerId, amount: Number(l.amount) || 0, narration: l.narration || "" })),
    remarks, status: "confirmed"
  };
  generalReceipts.push(receipt);
  return receipt;
}

const generalPayments = [];
function nextGeneralPaymentId() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "GP" + yy + String(generalPayments.length + 1).padStart(5, "0");
}

// General Payment — structurally identical header to General Receipt, but
// each line can optionally tie to a Job (+ Job Item) — its real-world use
// confirmed live as refunding customer advances / job-related outgoing
// payments, distinct from Journal (pure GL) and the Purchasing module's
// supplier-invoice Payment screen (Batch 1).
function createGeneralPayment({ date = null, methods = {}, amount, lines = [], remarks = "" } = {}) {
  const computedAmount = sumPaymentMethods(methods);
  const finalAmount = amount !== undefined && amount !== null && amount !== "" ? Number(amount) : computedAmount;
  const lineTotal = Math.round(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) * 1000) / 1000;
  if (!finalAmount || finalAmount <= 0 || Math.round(finalAmount * 1000) / 1000 !== lineTotal) {
    return { error: "Please check entered Amount." };
  }
  const payment = {
    id: nextGeneralPaymentId(), date: date || new Date().toISOString().slice(0, 10),
    methods, amount: finalAmount,
    lines: lines.map(l => ({
      ledgerId: l.ledgerId, amount: Number(l.amount) || 0, narration: l.narration || "",
      jobId: l.jobId || null, jobItemRef: l.jobItemRef || null
    })),
    remarks, status: "confirmed"
  };
  generalPayments.push(payment);
  return payment;
}
function cancelGeneralPayment(paymentId) {
  const p = generalPayments.find(x => x.id === paymentId);
  if (!p) return null;
  p.status = "cancelled";
  return p;
}

const journals = [];
function nextJournalId() {
  const yy = new Date().getFullYear().toString().slice(-2);
  return "JL" + yy + String(journals.length + 1).padStart(5, "0");
}

// Journal — free-form multi-line double entry. Confirmed live across ~100
// real entries: every entry's Debit total must equal its Credit total. That
// balance is enforced here, not just assumed, so a rebuild can't silently
// post an unbalanced entry the way a UI-only validation might miss.
function createJournal({ date = null, lines = [], remarks = "" } = {}) {
  if (!lines || lines.length < 2) return { error: "A Journal needs at least two lines (one Debit, one Credit)." };
  const drTotal = Math.round(lines.reduce((s, l) => s + (Number(l.dr) || 0), 0) * 1000) / 1000;
  const crTotal = Math.round(lines.reduce((s, l) => s + (Number(l.cr) || 0), 0) * 1000) / 1000;
  if (drTotal !== crTotal || drTotal === 0) {
    return { error: "Debit total must equal Credit total." };
  }
  const journal = {
    id: nextJournalId(), date: date || new Date().toISOString().slice(0, 10),
    lines: lines.map(l => ({
      ledgerId: l.ledgerId, dr: Number(l.dr) || 0, cr: Number(l.cr) || 0,
      revLedgerId: l.revLedgerId || null, narration: l.narration || "",
      jobId: l.jobId || null, jobItemRef: l.jobItemRef || null
    })),
    drTotal, crTotal, remarks, status: "confirmed"
  };
  journals.push(journal);
  return journal;
}
function cancelJournal(journalId) {
  const j = journals.find(x => x.id === journalId);
  if (!j) return null;
  j.status = "cancelled";
  return j;
}

// ═══════════════════════════════════════
// BATCH 6 — REPORTS
// Traced from docs/qpro-mapping/batch6reports.txt. The spec's own
// cross-cutting finding: reports are thin, read-only views over data
// already mapped in Batches 1–5 — no new business entities. PO Register
// (Batch 1) and Stock Ledger/Job Material Requirement/Item Summary
// (Batch 2) were already built and aren't repeated here.
//
// Day Book is a pure metadata log across every voucher array — no ledger
// posting involved.
//
// Ledger Report / Trial Balance / P&L / Balance Sheet all need a real
// per-ledger Dr/Cr history. Only Journal, General Receipt, and General
// Payment actually carry a ledgerId on their lines — Supplier Payment,
// Debit Note, Sales Receipt, Sales Credit Note, Tax Invoice and Purchase
// Invoice don't post to the GL at all (Voucher Ledger Mapping was built in
// Batch 5 but deliberately never wired into those forms — see CLAUDE.md
// §5). So getGLPostings() below is honestly partial: it reflects exactly
// what's actually posted today, not an invented full double-entry system
// retrofitted onto forms that don't call resolveVoucherLedger(). General
// Receipt/Payment's payment-mode side (Cash/Bank/etc.) IS resolved through
// resolveVoucherLedger() — the one place in the app that mapping is
// actually consumed.
// ═══════════════════════════════════════

function getDayBookRows({ voucherType = "All", from = "", to = "" } = {}) {
  const rows = [];
  const custName = id => { const c = customers.find(x => x.id === id); return c ? c.name : "—"; };
  const supName = id => { const s = suppliers.find(x => x.id === id); return s ? s.name : "—"; };
  taxInvoices.forEach(inv => rows.push({ type: "Invoice", no: inv.id, date: inv.date, client: custName(inv.customerId), amount: inv.totals.netTotal, status: invoiceBalance(inv) <= 0.0005 ? "Settled" : "Open" }));
  salesReceipts.forEach(r => rows.push({ type: "Receipt", no: r.id, date: r.receiptDate, client: custName(r.customerId), amount: r.amount, status: r.status }));
  purchaseInvoices.forEach(inv => rows.push({ type: "Purchase Invoice", no: inv.id, date: inv.dateReceived, client: inv.supplierNameTel || (inv.supplierId ? supName(inv.supplierId) : "—"), amount: (inv.totals && inv.totals.netAmount) || 0, status: inv.status }));
  payments.forEach(p => rows.push({ type: "Supplier Payment", no: p.id, date: p.paymentDate, client: supName(p.supplierId), amount: p.amount, status: p.status }));
  salesCreditNotes.forEach(cn => rows.push({ type: "Credit Note", no: cn.id, date: cn.creditNoteDate, client: custName(cn.customerId), amount: cn.amount, status: cn.status }));
  debitNotes.forEach(dn => rows.push({ type: "Debit Note", no: dn.id, date: dn.debitNoteDate, client: supName(dn.supplierId), amount: dn.amount, status: dn.status }));
  generalReceipts.forEach(r => rows.push({ type: "General Receipt", no: r.id, date: r.date, client: "—", amount: r.amount, status: r.status }));
  generalPayments.forEach(p => rows.push({ type: "General Payment", no: p.id, date: p.date, client: "—", amount: p.amount, status: p.status }));
  journals.forEach(j => rows.push({ type: "Journal", no: j.id, date: j.date, client: "—", amount: j.drTotal, status: j.status }));

  return rows
    .filter(r => voucherType === "All" || r.type === voucherType)
    .filter(r => !from || r.date >= from)
    .filter(r => !to || r.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date));
}
const DAY_BOOK_VOUCHER_TYPES = ["All", "Invoice", "Receipt", "Purchase Invoice", "Supplier Payment", "Credit Note", "Debit Note", "General Receipt", "General Payment", "Journal"];

function getGLPostings() {
  const rows = [];
  journals.forEach(j => {
    if (j.status === "cancelled") return;
    j.lines.forEach(l => {
      const ledger = ledgers.find(lg => lg.id === l.ledgerId);
      if (!ledger) return;
      rows.push({ date: j.date, voucherType: "Journal", voucherNo: j.id, voucherRef: j.id, ledgerName: ledger.name, dr: l.dr || 0, cr: l.cr || 0, narration: l.narration || "" });
    });
  });
  generalReceipts.forEach(r => {
    if (r.status === "cancelled") return;
    ["cash", "bank", "cCard", "wallet", "cheque"].forEach(k => {
      const m = r.methods[k];
      if (m && m.enabled && Number(m.amount) > 0) {
        const ledger = resolveVoucherLedger(k);
        if (ledger) rows.push({ date: r.date, voucherType: "General Receipt", voucherNo: r.id, voucherRef: r.id, ledgerName: ledger.name, dr: Number(m.amount), cr: 0, narration: r.remarks || "" });
      }
    });
    r.lines.forEach(l => {
      const ledger = ledgers.find(lg => lg.id === l.ledgerId);
      if (!ledger) return;
      rows.push({ date: r.date, voucherType: "General Receipt", voucherNo: r.id, voucherRef: r.id, ledgerName: ledger.name, dr: 0, cr: l.amount || 0, narration: l.narration || "" });
    });
  });
  generalPayments.forEach(p => {
    if (p.status === "cancelled") return;
    p.lines.forEach(l => {
      const ledger = ledgers.find(lg => lg.id === l.ledgerId);
      if (!ledger) return;
      rows.push({ date: p.date, voucherType: "General Payment", voucherNo: p.id, voucherRef: l.jobId || p.id, ledgerName: ledger.name, dr: l.amount || 0, cr: 0, narration: l.narration || "" });
    });
    ["cash", "bank", "cCard", "wallet", "cheque"].forEach(k => {
      const m = p.methods[k];
      if (m && m.enabled && Number(m.amount) > 0) {
        const ledger = resolveVoucherLedger(k);
        if (ledger) rows.push({ date: p.date, voucherType: "General Payment", voucherNo: p.id, voucherRef: p.id, ledgerName: ledger.name, dr: 0, cr: Number(m.amount), narration: p.remarks || "" });
      }
    });
  });
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// Asset/Expense ledgers read Dr-positive, Liability/Income ledgers read
// Cr-positive — standard accounting convention, needed so Trial Balance/
// P&L/Balance Sheet totals net correctly rather than just summing raw Dr-Cr.
function ledgerClassification(ledgerName) {
  const ledger = ledgers.find(l => l.name === ledgerName);
  if (!ledger) return null;
  const group = accountsGroups.find(g => g.name === ledger.groupName);
  return group ? group.classification : null;
}

function getLedgerBalance(ledgerName, { from = "", to = "" } = {}) {
  const ledger = ledgers.find(l => l.name === ledgerName);
  const baseOpening = ledger ? (ledger.openingBalance || 0) : 0;
  const all = getGLPostings().filter(p => p.ledgerName === ledgerName);
  const before = from ? all.filter(p => p.date < from) : [];
  const inRange = all.filter(p => (!from || p.date >= from) && (!to || p.date <= to));
  const opening = baseOpening + before.reduce((s, p) => s + p.dr - p.cr, 0);
  const debit = inRange.reduce((s, p) => s + p.dr, 0);
  const credit = inRange.reduce((s, p) => s + p.cr, 0);
  const closing = Math.round((opening + debit - credit) * 1000) / 1000;
  return { opening: Math.round(opening * 1000) / 1000, debit: Math.round(debit * 1000) / 1000, credit: Math.round(credit * 1000) / 1000, closing };
}

function getTrialBalance({ from = "", to = "", ledgerWise = true } = {}) {
  if (ledgerWise) {
    return ledgers.map(l => ({ name: l.name, ...getLedgerBalance(l.name, { from, to }) }))
      .filter(r => r.opening !== 0 || r.debit !== 0 || r.credit !== 0);
  }
  const byGroup = {};
  ledgers.forEach(l => {
    const bal = getLedgerBalance(l.name, { from, to });
    if (!byGroup[l.groupName]) byGroup[l.groupName] = { opening: 0, debit: 0, credit: 0, closing: 0 };
    byGroup[l.groupName].opening += bal.opening;
    byGroup[l.groupName].debit += bal.debit;
    byGroup[l.groupName].credit += bal.credit;
    byGroup[l.groupName].closing += bal.closing;
  });
  return Object.entries(byGroup).map(([name, v]) => ({
    name, opening: Math.round(v.opening * 1000) / 1000, debit: Math.round(v.debit * 1000) / 1000,
    credit: Math.round(v.credit * 1000) / 1000, closing: Math.round(v.closing * 1000) / 1000
  })).filter(r => r.opening !== 0 || r.debit !== 0 || r.credit !== 0);
}

// Two-tier statement matching the live layout: Trading Account (Direct
// Incomes/Expenses -> Gross Profit) then Income Statement (+/- Indirect
// Incomes/Expenses -> Net Profit).
//
// Direct Income/Expense deliberately do NOT come from getGLPostings() —
// a real finding while building this report: the seed Chart of Accounts
// (Batch 3, from the live trace) files the "Sales" ledger group under
// "Current Assets", not under "Direct Incomes"/"Sales Accounts", and no
// custom group at all sits under "Direct Incomes" — so a pure ledger-
// classification P&L would show zero Direct Income even with real
// invoices posted. Reading "Sales" as a Current-Assets group is actually
// standard (a Sales Ledger/Debtors-control account, distinct from a P&L
// income account) — not a data bug to silently rewrite. The practical fix:
// Direct Income/Expense read straight from the real transactional
// documents (taxInvoices/purchaseInvoices), same source getAccountsKPIs()
// already uses for Revenue/Payables. Indirect Income/Expense still come
// from the GL layer (Journal/General Receipt/Payment) — genuinely correct
// there, since Indirect Expenses' real custom groups (Printing &
// Stationery, Air Ticket, Repair & Maintenance, Tools & Equipment...) are
// exactly what that layer is for.
function getProfitAndLoss({ from = "", to = "" } = {}) {
  const inRange = d => (!from || d >= from) && (!to || d <= to);
  const directIncome = Math.round(taxInvoices.filter(inv => inRange(inv.date)).reduce((s, inv) => s + (inv.totals.total || 0), 0) * 1000) / 1000;
  const directExpense = Math.round(purchaseInvoices.filter(inv => inv.status === "received" && inRange(inv.dateReceived)).reduce((s, inv) => s + (inv.totals ? (inv.totals.total || 0) : 0), 0) * 1000) / 1000;
  const grossProfit = Math.round((directIncome - directExpense) * 1000) / 1000;

  const sumByPrimary = (primaryName, sign) => ledgers
    .filter(l => {
      const g = accountsGroups.find(x => x.name === l.groupName);
      if (!g) return false;
      return (g.isPrimary ? g.name : g.under) === primaryName;
    })
    .reduce((s, l) => s + sign * getLedgerBalance(l.name, { from, to }).closing, 0);
  // Income ledgers post Credit-heavy (closing comes out negative under the
  // Dr-positive convention above) — sign=-1 flips them to a positive revenue figure.
  const indirectIncome = Math.round(sumByPrimary("Indirect Incomes", -1) * 1000) / 1000;
  const indirectExpense = Math.round(sumByPrimary("Indirect Expenses", 1) * 1000) / 1000;
  const netProfit = Math.round((grossProfit + indirectIncome - indirectExpense) * 1000) / 1000;
  return { directIncome, directExpense, grossProfit, indirectIncome, indirectExpense, netProfit };
}

// No date filter, matching the live report (loads directly against
// today's position). Same reasoning as getProfitAndLoss() above:
// Receivables/Payables are computed straight from taxInvoices/
// purchaseInvoices (real outstanding balances, netting Sales Receipt/
// Credit Note and Supplier Payment activity via invoiceBalance()/
// paidAmount) rather than relied on GL ledger postings that don't exist
// for those transaction types yet. Cash/Bank/other real GL-ledger balances
// from Journal/General Receipt/Payment are layered in underneath.
// Capital/retained-earnings roll-up from P&L is NOT folded in — a known,
// flagged simplification, not an oversight.
function getBalanceSheet() {
  const assets = [], liabilities = [];
  const receivables = Math.round(taxInvoices.reduce((s, inv) => s + invoiceBalance(inv), 0) * 1000) / 1000;
  if (Math.abs(receivables) > 0.0005) assets.push({ name: "Accounts Receivable (Sales Invoices)", amount: receivables });
  const payables = Math.round(purchaseInvoices.filter(inv => inv.status === "received")
    .reduce((s, inv) => s + Math.max(0, (inv.totals ? inv.totals.netAmount : 0) - (inv.paidAmount || 0)), 0) * 1000) / 1000;
  if (Math.abs(payables) > 0.0005) liabilities.push({ name: "Accounts Payable (Purchase Invoices)", amount: payables });

  ledgers.forEach(l => {
    const bal = getLedgerBalance(l.name, {});
    if (Math.abs(bal.closing) < 0.0005) return;
    const cls = ledgerClassification(l.name);
    if (cls === "Asset") assets.push({ name: l.name, amount: bal.closing });
    else if (cls === "Liability") liabilities.push({ name: l.name, amount: -bal.closing });
  });
  const totalAssets = Math.round(assets.reduce((s, a) => s + a.amount, 0) * 1000) / 1000;
  const totalLiabilities = Math.round(liabilities.reduce((s, a) => s + a.amount, 0) * 1000) / 1000;
  return { assets, liabilities, totalAssets, totalLiabilities };
}

// ── QUOTATION REGISTER, PROJECT OUTSTANDING, JOB REPORT helpers ──
// Salesperson for a Tax Invoice, traced Invoice -> Job -> Quotation ->
// Enquiry — same trace pattern accountsDivisionForInvoice() (accounts.js)
// and applyCustomerUpdate()'s Customer Update tool already use.
function salesPersonForInvoice(inv) {
  const job = getJobCard(inv.jobId);
  if (!job) return null;
  const qtn = quotations.find(q => q.id === job.quotationId);
  const enq = qtn ? enquiries.find(e => e.id === qtn.enquiryId) : null;
  return enq ? enq.salesPerson : null;
}

// ── SALES / PURCHASE BILL OUTSTANDING (Batch 6) ──
// Age basis "due" derives a due date from the customer/supplier's own
// creditDays (Customer/Supplier master) — no separate per-invoice due-date
// field exists, so this reuses the real credit-terms field already
// captured on those masters, same spirit as accountsDivisionForInvoice()
// reusing an existing trace rather than inventing a new field.
function ageInDays(dateStr, asOf) { return Math.max(0, Math.round((new Date(asOf) - new Date(dateStr)) / 86400000)); }
function billAgeBucket(age) { return age <= 30 ? "b30" : age <= 60 ? "b60" : age <= 90 ? "b90" : "b90p"; }
const BILL_AGE_BUCKETS = [
  { key: "b30", label: "<= 30 Days" }, { key: "b60", label: "31 to 60 Days" },
  { key: "b90", label: "61 to 90 Days" }, { key: "b90p", label: "> 90 Days" }
];
// billAmt >= paidAmt (Fully Paid) / 0 < paidAmt < billAmt (Partially Paid) /
// paidAmt === 0 (Unpaid). "Advance" (a receipt/payment with no invoice) and
// "Cancelled" are real states in the live 5-state legend but have no
// corresponding data path for a per-bill/per-party row in this app yet —
// kept in the legend below for fidelity, simply unreachable today.
function billOutstandingStatus(billAmt, paidAmt) {
  if (paidAmt >= billAmt - 0.0005) return "Fully Paid";
  if (paidAmt > 0.0005) return "Partially Paid";
  return "Unpaid";
}

function salesInvoiceDueDate(inv) {
  const c = customers.find(x => x.id === inv.customerId);
  const days = c ? (c.creditDays || 0) : 0;
  const d = new Date(inv.date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
// "By party" — one row per Tax Invoice still carrying a balance.
function getSalesBillOutstandingByParty({ ageBasis = "bill", asOf = new Date().toISOString().slice(0, 10) } = {}) {
  return taxInvoices.map(inv => {
    const paidAmt = (inv.paidAmount || 0) + (inv.creditedAmount || 0);
    const balAmt = invoiceBalance(inv);
    const ageDate = ageBasis === "due" ? salesInvoiceDueDate(inv) : inv.date;
    return {
      invoiceId: inv.id, date: inv.date, dueDate: salesInvoiceDueDate(inv), lpoNo: inv.lpoNo || "",
      customerId: inv.customerId, salesPerson: salesPersonForInvoice(inv),
      billAmt: inv.totals.netTotal, paidAmt, balAmt, age: ageInDays(ageDate, asOf)
    };
  }).filter(r => r.balAmt > 0.0005);
}
// "All" — client-summarized, no per-bill breakdown.
function getSalesBillOutstandingAllCustomers() {
  const byCustomer = {};
  taxInvoices.forEach(inv => {
    if (!byCustomer[inv.customerId]) byCustomer[inv.customerId] = { customerId: inv.customerId, billAmt: 0, paidAmt: 0 };
    byCustomer[inv.customerId].billAmt += inv.totals.netTotal;
    byCustomer[inv.customerId].paidAmt += (inv.paidAmount || 0) + (inv.creditedAmount || 0);
  });
  return Object.values(byCustomer).map(r => ({ ...r, balAmt: Math.round((r.billAmt - r.paidAmt) * 1000) / 1000 }));
}
// Age-wise variants replace the single AGE column with 4 aging buckets.
function getSalesBillOutstandingByPartyAgeWise(opts = {}) {
  return getSalesBillOutstandingByParty(opts).map(r => {
    const buckets = { b30: 0, b60: 0, b90: 0, b90p: 0 };
    buckets[billAgeBucket(r.age)] = r.balAmt;
    return { ...r, buckets };
  });
}
function getSalesBillOutstandingAllCustomersAgeWise(opts = {}) {
  const rows = getSalesBillOutstandingByParty(opts);
  const byCustomer = {};
  rows.forEach(r => {
    if (!byCustomer[r.customerId]) byCustomer[r.customerId] = { customerId: r.customerId, balAmt: 0, buckets: { b30: 0, b60: 0, b90: 0, b90p: 0 } };
    byCustomer[r.customerId].balAmt += r.balAmt;
    byCustomer[r.customerId].buckets[billAgeBucket(r.age)] += r.balAmt;
  });
  return Object.values(byCustomer);
}

// ── PURCHASE BILL OUTSTANDING — vendor-side mirror ──
// Structurally identical to Sales Bill Outstanding above, but the live
// system reuses the Sales report's template without relabeling — "Client
// Name"/"CLIENT" leftovers even on the vendor-side variants (a confirmed
// spec bug). Fixed here, not reproduced: every label below correctly says
// Supplier/Vendor.
function purchInvoiceDueDate(inv) {
  const s = suppliers.find(x => x.id === inv.supplierId);
  const days = s ? (s.creditDays || 0) : 0;
  const d = new Date(inv.dateReceived);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function getPurchaseBillOutstandingByParty({ ageBasis = "bill", asOf = new Date().toISOString().slice(0, 10) } = {}) {
  return purchaseInvoices.filter(inv => inv.status === "received").map(inv => {
    const billAmt = (inv.totals && inv.totals.netAmount) || 0;
    const paidAmt = inv.paidAmount || 0;
    const balAmt = Math.round((billAmt - paidAmt) * 1000) / 1000;
    const ageDate = ageBasis === "due" ? purchInvoiceDueDate(inv) : inv.dateReceived;
    return {
      invoiceId: inv.id, date: inv.dateReceived, dueDate: purchInvoiceDueDate(inv), poNo: inv.sourcePO || "",
      supplierId: inv.supplierId, supplierName: inv.supplierNameTel || "",
      billAmt, paidAmt, balAmt, age: ageInDays(ageDate, asOf)
    };
  }).filter(r => r.balAmt > 0.0005);
}
function getPurchaseBillOutstandingAllSuppliers() {
  const bySupplier = {};
  purchaseInvoices.filter(inv => inv.status === "received").forEach(inv => {
    const key = inv.supplierId || inv.supplierNameTel || "—";
    if (!bySupplier[key]) bySupplier[key] = { supplierId: inv.supplierId, supplierName: inv.supplierNameTel || "", billAmt: 0, paidAmt: 0 };
    bySupplier[key].billAmt += (inv.totals && inv.totals.netAmount) || 0;
    bySupplier[key].paidAmt += inv.paidAmount || 0;
  });
  return Object.values(bySupplier).map(r => ({ ...r, balAmt: Math.round((r.billAmt - r.paidAmt) * 1000) / 1000 }));
}
function getPurchaseBillOutstandingByPartyAgeWise(opts = {}) {
  return getPurchaseBillOutstandingByParty(opts).map(r => {
    const buckets = { b30: 0, b60: 0, b90: 0, b90p: 0 };
    buckets[billAgeBucket(r.age)] = r.balAmt;
    return { ...r, buckets };
  });
}
function getPurchaseBillOutstandingAllSuppliersAgeWise(opts = {}) {
  const rows = getPurchaseBillOutstandingByParty(opts);
  const bySupplier = {};
  rows.forEach(r => {
    const key = r.supplierId || r.supplierName || "—";
    if (!bySupplier[key]) bySupplier[key] = { supplierId: r.supplierId, supplierName: r.supplierName, balAmt: 0, buckets: { b30: 0, b60: 0, b90: 0, b90p: 0 } };
    bySupplier[key].balAmt += r.balAmt;
    bySupplier[key].buckets[billAgeBucket(r.age)] += r.balAmt;
  });
  return Object.values(bySupplier);
}

// ── JOB REPORT, PROJECT OUTSTANDING, PROJECT WISE INVOICE & RECEIPT ──
// Job report is a per-job mini profit-and-loss, verified against the live
// spec's own example (JB26AMD02319: Job Amount 322.080, Budget Dry Cost/
// with Overhead both 170.800, Total Cost 0.000, Running Profit 322.080,
// Proforma/Invoiced/Received all 322.080) — Budget comes from the
// Estimator's BOM cost-plus waterfall (computeBOMTotals(), traced job item
// -> its matching Quotation line -> that line's own .bom, same lineId
// join refreshJobFromQuotation() already uses), Total Cost is REAL
// incurred spend (received Purchase Invoices linked to the job + logged
// Labour Cost), distinct from the planned Budget figure — the live
// example's Total Cost of 0.000 alongside a real non-zero Budget confirms
// these are two separate concepts, not a rounding coincidence.
//
// Materials Issued/Returned are reported as move COUNTS, not a currency
// value — this app's Material Issue/Return moves don't carry a rate/cost
// (confirmed existing precedent: getStockReport() above deliberately sets
// rate:0/amount:0 for these voucher types), so inventing a valuation here
// would be a new, unverified methodology used nowhere else in the app.
function getJobReport(jobId) {
  const job = getJobCard(jobId);
  if (!job) return null;
  const customer = customers.find(c => c.id === job.customerId);
  const qtn = quotations.find(q => q.id === job.quotationId);

  let dryCost = 0, withOH = 0;
  job.items.forEach(item => {
    const qItem = qtn ? qtn.items.find(it => it.lineId === item.lineId) : null;
    if (qItem && qItem.bom) {
      const t = computeBOMTotals(qItem.bom);
      dryCost += t.totalCost;
      withOH += t.totalCostInclOH;
    }
  });

  const totalPurchases = purchaseInvoices.filter(inv => inv.linkedJobId === job.id && inv.status === "received")
    .reduce((s, inv) => s + (inv.totals ? inv.totals.netAmount : 0), 0);
  const totalLabour = job.labourCostEntries.reduce((s, e) => s + e.amount, 0);
  const totalCost = Math.round((totalPurchases + totalLabour) * 1000) / 1000;
  const poPending = purchaseOrders.filter(po => po.linkedJobId === job.id && po.status !== "invoiced")
    .reduce((s, po) => s + po.items.reduce((s2, it) => s2 + (it.netAmountBD || 0), 0), 0);

  const invoices = getInvoicesForJob(job.id);
  const invoicedTotal = invoices.reduce((s, inv) => s + inv.totals.netTotal, 0);
  const receivedTotal = invoices.reduce((s, inv) => s + (inv.paidAmount || 0), 0);
  const proformaTotal = getProformasForJob(job.id).reduce((s, p) => s + p.totals.netTotal, 0);

  return {
    job, customer, date: job.date, projectName: job.projectName, jobAmount: job.amount,
    totalPurchases: Math.round(totalPurchases * 1000) / 1000,
    materialsIssuedCount: job.materialsIssues.filter(m => m.status !== "cancelled").length,
    materialsReturnedCount: job.materialsReturns.filter(m => m.status !== "cancelled").length,
    poPending: Math.round(poPending * 1000) / 1000,
    budgetDryCost: Math.round(dryCost * 1000) / 1000,
    budgetWithOH: Math.round(withOH * 1000) / 1000,
    totalCost,
    runningProfit: Math.round((job.amount - totalCost) * 1000) / 1000,
    proforma: Math.round(proformaTotal * 1000) / 1000,
    invoiced: Math.round(invoicedTotal * 1000) / 1000,
    received: Math.round(receivedTotal * 1000) / 1000
  };
}

// Job-level receivables reconciliation across every Job Card.
function getProjectOutstanding() {
  return jobCards.map(job => {
    const invoices = getInvoicesForJob(job.id);
    const invAmt = invoices.reduce((s, inv) => s + inv.totals.netTotal, 0);
    const paidAmt = invoices.reduce((s, inv) => s + (inv.paidAmount || 0), 0);
    const crAmt = invoices.reduce((s, inv) => s + (inv.creditedAmount || 0), 0);
    return {
      job, jobId: job.id, qtnId: job.quotationId, date: job.date,
      jobAmt: job.amount, invAmt: Math.round(invAmt * 1000) / 1000, paidAmt: Math.round(paidAmt * 1000) / 1000,
      crAmt: Math.round(crAmt * 1000) / 1000,
      uninvAmt: Math.round((job.amount - invAmt) * 1000) / 1000,
      balance: Math.round((invAmt - paidAmt - crAmt) * 1000) / 1000
    };
  });
}

// Single-job Invoice(Debit)/Receipt+CreditNote(Credit) ledger. The live
// spec reports the same "No Invoice List Exist" bug here as Receipt/Credit
// Note (Batch 4) and this report itself — per the established pattern,
// fixed here, not reproduced.
function getProjectWiseInvoiceReceipt(jobId) {
  const invoices = getInvoicesForJob(jobId);
  const rows = [];
  invoices.forEach(inv => rows.push({ docNo: inv.id, date: inv.date, debit: inv.totals.netTotal, credit: 0 }));
  getReceiptsForJob(jobId).forEach(r => {
    const amt = r.allocations.filter(a => invoices.some(inv => inv.id === a.invoiceId)).reduce((s, a) => s + (Number(a.payingAmount) || 0), 0);
    if (amt > 0.0005) rows.push({ docNo: r.id, date: r.receiptDate, debit: 0, credit: amt });
  });
  getCreditNotesForJob(jobId).forEach(cn => {
    const amt = cn.allocations.filter(a => invoices.some(inv => inv.id === a.invoiceId)).reduce((s, a) => s + (Number(a.creditingAmount) || 0), 0);
    if (amt > 0.0005) rows.push({ docNo: cn.id, date: cn.creditNoteDate, debit: 0, credit: amt });
  });
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// ═══════════════════════════════════════
// BATCH 7 — SHARED TASKS + ACTIVITY LOG PRIMITIVE
// Built 3 Aug 2026. Prompted by asking Salman to role-play Sales/Estimator/
// Approver/Purchaser/Accounts/Storekeeper/Operations Manager and describe
// what each role is missing — every single one independently asked for
// the same two things: task tracking and a communication/activity log.
// Rather than building 8 bespoke per-module implementations, this is ONE
// shared primitive any record (Enquiry/Quotation/Job/PO/Invoice/etc.) can
// attach to via linkedType/linkedId. Deliberately NOT retrofitted into
// every existing action across all 12 modules in this pass — that's real
// scope beyond what's buildable in one session. It IS wired into the new
// Variation Order flow below (a Job accumulating variations needs a
// timeline — that timeline IS this activity log) and surfaced on the Job
// Card hub (jobs.js). A fuller cross-module task inbox is a natural
// follow-up, not built here.
// ═══════════════════════════════════════

const tasks = [];
function nextTaskId() { return "TSK-" + String(tasks.length + 1).padStart(5, "0"); }
function createTask({ title, assignee, dueDate = null, linkedType = null, linkedId = null, notes = "" } = {}) {
  if (!title || !title.trim()) return { error: "Task title is required." };
  if (!assignee) return { error: "Assignee is required." };
  const task = {
    id: nextTaskId(), title: title.trim(), assignee, dueDate, notes,
    linkedType, linkedId, // e.g. linkedType:"job", linkedId:"JB26AMD01000"
    status: "open", // open | done
    createdDate: new Date().toISOString().slice(0, 10), completedDate: null
  };
  tasks.push(task);
  return task;
}
function completeTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return { error: "Task not found." };
  t.status = "done";
  t.completedDate = new Date().toISOString().slice(0, 10);
  return t;
}
function getTasksFor(linkedType, linkedId) {
  return tasks.filter(t => t.linkedType === linkedType && t.linkedId === linkedId).sort((a, b) => b.createdDate.localeCompare(a.createdDate));
}
function getOpenTasksForAssignee(assignee) {
  return tasks.filter(t => t.assignee === assignee && t.status === "open").sort((a, b) => (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
}

const activityLog = [];
// dept is optional — added 4 Aug 2026 so QC pass/fail entries can be
// reliably filtered by department for the Joinery/Upholstery/Painting
// dashboards' new quality-trend view, instead of parsing the department
// name back out of the free-text message string.
function logActivity({ type, linkedType = null, linkedId = null, user, message, dept = null, reason = null }) {
  const entry = {
    id: activityLog.length + 1, date: new Date().toISOString().slice(0, 10), time: new Date().toISOString(),
    type, linkedType, linkedId, user, message, dept, reason
  };
  activityLog.push(entry);
  return entry;
}
function getActivityFor(linkedType, linkedId) {
  return activityLog.filter(a => a.linkedType === linkedType && a.linkedId === linkedId).sort((a, b) => b.time.localeCompare(a.time));
}
function getRecentActivity(limit = 20) {
  return activityLog.slice().sort((a, b) => b.time.localeCompare(a.time)).slice(0, limit);
}
// Quality/rework trend for a single department — built for the Joinery/
// Upholstery/Painting dashboards (4 Aug 2026), which showed a raw "In
// Rework" count and nothing else about quality, even though every QC
// pass/fail already gets logged to activityLog via the shared pipeline
// (dept-pipeline-ui.js) and Painting's own separate functions. Matches
// Curtain's own pre-existing "Reject Reasons" dashboard tile in spirit.
function getQCTrendForDept(deptKey, limit = 8) {
  const entries = activityLog.filter(a => a.dept === deptKey && (a.type === "qc-pass" || a.type === "qc-fail"));
  const passCount = entries.filter(a => a.type === "qc-pass").length;
  const failCount = entries.filter(a => a.type === "qc-fail").length;
  const total = passCount + failCount;
  return {
    passCount, failCount, total,
    passRate: total > 0 ? Math.round((passCount / total) * 100) : null,
    recent: entries.slice().sort((a, b) => b.time.localeCompare(a.time)).slice(0, limit)
  };
}

// QC reject-reason trend for a department (6 Aug 2026 audit, loophole #6) —
// counts each captured reason across this department's qc-fail activity
// entries, most-common first, so a QC dashboard can show WHY work fails, not
// just how often. Fails logged before reason capture (or with no reason
// entered) fall under "Unspecified".
function getQCRejectReasonsForDept(deptKey, limit = 6) {
  const counts = {};
  activityLog
    .filter(a => a.dept === deptKey && a.type === "qc-fail")
    .forEach(a => {
      const key = (a.reason && a.reason.trim()) || "Unspecified";
      counts[key] = (counts[key] || 0) + 1;
    });
  return Object.entries(counts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ══════════════════════════════════════════
// DASHBOARD ANALYTICS AGGREGATIONS (5 Aug 2026) — feed the new
// chart-widgets.js primitives. Pure functions, no new stored state,
// same convention as getQCTrendForDept()/getSalesKPIs()/etc. above —
// every value here is computed fresh from the existing arrays, nothing
// is cached or persisted.
// ══════════════════════════════════════════

// Confirmed order value by month x division, from jobCards (job.amount,
// job.date), joined back to the division via quotationId -> enquiryId.
// Deliberately NOT limited to invoiced revenue (that's Accounts' own,
// narrower getAccountsKPIs().byDivision, which only counts taxInvoices
// — a real recognized-revenue figure, kept as-is) — this reflects
// business actually confirmed/booked, the figure Sales/Owner care
// about day to day. scope.salesPerson optionally restricts to one
// salesperson's own enquiries.
// Multi-department revenue split (6 Aug 2026 audit, Phase D — Salman's
// call: split by approved department budgets). Which SALES_DIVISION each
// production department's work counts under: paint maps to Joinery (no
// Painting division exists, and Painting rides on Joinery work in
// practice); metal is deliberately absent (dropped from routing earlier
// today).
const DEPT_REVENUE_DIVISION = { carp: "Joinery", uph: "Upholstery", curt: "Curtain & Blinds", paint: "Joinery" };

// How one item's value splits across divisions: a single-department item
// stays wholly on its enquiry's own division (status quo — the audit's
// complaint was only multi-department ambiguity). A multi-department item
// splits proportional to each department's APPROVED budget cost (real,
// already-captured numbers reflecting actual work share); if no approved
// budgets exist yet, it splits equally as the honest fallback. Weights are
// per job+department (budgets aren't per-line), aggregated up to divisions
// (carp+paint both land in Joinery).
function itemDivisionShares(job, item, enqDivision) {
  const depts = (item.departmentSequence || []).filter(k => DEPT_REVENUE_DIVISION[k]);
  if (depts.length <= 1) return [{ division: enqDivision, share: 1 }];
  const weights = depts.map(k => {
    const entry = job.departmentBudgets && job.departmentBudgets[k];
    if (!entry || entry.approvalStatus !== "approved") return 0;
    return computeBOMTotals(entry.bom).totalCost || 0;
  });
  const totalW = weights.reduce((s, w) => s + w, 0);
  const byDivision = {};
  depts.forEach((k, i) => {
    const share = totalW > 0 ? weights[i] / totalW : 1 / depts.length;
    const div = DEPT_REVENUE_DIVISION[k];
    byDivision[div] = (byDivision[div] || 0) + share;
  });
  return Object.entries(byDivision).map(([division, share]) => ({ division, share }));
}

function getMonthlyRevenueByDivision(monthsBack, scope) {
  monthsBack = monthsBack || 8;
  scope = scope || {};
  const months = [];
  const now = new Date();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    months.push({ key, label: d.toLocaleString("en-US", { month: "short" }) });
  }
  const byMonthDiv = {};
  months.forEach(m => { byMonthDiv[m.key] = {}; SALES_DIVISIONS.forEach(d => { byMonthDiv[m.key][d] = 0; }); });

  jobCards.forEach(job => {
    if (job.status === "cancelled") return;
    const jobMk = (job.date || "").slice(0, 7);
    const qtn = quotations.find(q => q.id === job.quotationId);
    const enq = qtn ? enquiries.find(e => e.id === qtn.enquiryId) : null;
    if (scope.salesPerson && (!enq || enq.salesPerson !== scope.salesPerson)) return;
    const div = enq ? enq.division : null;
    if (!div) return;
    // Bucket per ITEM, not per job (6 Aug 2026 audit, Phase D): a Variation
    // merged months after confirmation used to have its whole value counted
    // in the job's ORIGINAL month — a variation item now lands in the month
    // its own variation was actually confirmed. Base items keep the job's
    // confirm month. Values are netAmount (VAT-inclusive) — the same
    // definition job.amount has always had (the quotation's netTotal is the
    // sum of item netAmounts, see computeQuotationTotals()).
    job.items.forEach(it => {
      let mk = jobMk;
      if (it.variationId) {
        const v = quotations.find(q => q.id === it.variationId);
        if (v && (v.confirmDate || v.date)) mk = (v.confirmDate || v.date).slice(0, 7);
      }
      if (!byMonthDiv[mk]) return;
      const val = it.netAmount || it.amount || 0;
      // Multi-department items split across divisions by approved budget
      // share (see itemDivisionShares above); single-department items stay
      // wholly on the enquiry's division, as before.
      itemDivisionShares(job, it, div).forEach(({ division, share }) => {
        if (division in byMonthDiv[mk]) byMonthDiv[mk][division] += val * share;
      });
    });
  });

  return { months, byMonthDiv, divisions: SALES_DIVISIONS.slice() };
}

// Pipeline funnel — count + value at each real stage a quote/job
// actually passes through. Buckets deliberately mirror the app's own
// lifecycle, not an invented generic funnel: an open (not-yet-
// confirmed) quotation; a job card that exists but Operations hasn't
// routed yet; a routed job with at least one undelivered line; a fully
// delivered job (every line's deliveredQty >= qty). scope.salesPerson/
// scope.department optionally narrow to one salesperson's quotes or
// one production department's jobs.
function getPipelineFunnel(scope) {
  scope = scope || {};
  const stages = ["Quotation", "Job Confirmed", "In Production", "Delivered"];
  const byStage = {};
  stages.forEach(s => { byStage[s] = { count: 0, value: 0 }; });

  quotations.forEach(qtn => {
    if (qtn.lifecycleStatus === "confirmed") return; // counted via its job card instead
    const enq = enquiries.find(e => e.id === qtn.enquiryId);
    if (scope.salesPerson && (!enq || enq.salesPerson !== scope.salesPerson)) return;
    const totals = computeQuotationTotals(qtn);
    byStage["Quotation"].count++;
    byStage["Quotation"].value += totals.netTotal;
  });

  jobCards.forEach(job => {
    if (job.status === "cancelled") return;
    if (scope.salesPerson) {
      const qtn = quotations.find(q => q.id === job.quotationId);
      const enq = qtn ? enquiries.find(e => e.id === qtn.enquiryId) : null;
      if (!enq || enq.salesPerson !== scope.salesPerson) return;
    }
    if (scope.department && !job.items.some(it => (it.departmentSequence || []).includes(scope.department))) return;
    const fullyDelivered = job.items.length > 0 && job.items.every(it => (it.deliveredQty || 0) >= it.qty);
    const bucket = fullyDelivered ? "Delivered" : !job.routingConfirmed ? "Job Confirmed" : "In Production";
    byStage[bucket].count++;
    byStage[bucket].value += job.amount || 0;
  });

  return { stages, byStage };
}

// Top clients by confirmed order value — jobCards rollup grouped by
// customerId, joined to customers[].name. No existing helper does
// this (getCustomerOpenInvoices()/getSalesBillOutstandingByParty() both
// compute outstanding BALANCE, not total sold value). scope.salesPerson
// optionally restricts to one salesperson's own jobs.
function getTopClientsByValue(limit, scope) {
  limit = limit || 8;
  scope = scope || {};
  const byCustomer = {};
  jobCards.forEach(job => {
    if (job.status === "cancelled" || !job.customerId) return;
    if (scope.salesPerson) {
      const qtn = quotations.find(q => q.id === job.quotationId);
      const enq = qtn ? enquiries.find(e => e.id === qtn.enquiryId) : null;
      if (!enq || enq.salesPerson !== scope.salesPerson) return;
    }
    byCustomer[job.customerId] = (byCustomer[job.customerId] || 0) + (job.amount || 0);
  });
  const rows = Object.keys(byCustomer).map(cid => {
    const c = customers.find(x => x.id === cid);
    return { customerId: cid, name: c ? c.name : cid, value: byCustomer[cid] };
  });
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, limit);
}

// ══════════════════════════════════════════
// TEAM MESSAGES (4 Aug 2026) — a lightweight note between teammates,
// deliberately separate from tasks[] above. Tasks are open/done action
// items with a due date; a message is just "reach a teammate" — no
// status beyond read/unread, no due date, no assignee workflow. Built
// per Salman's explicit ask: "want everyone to have system to reach
// their teammates."
// REACHABLE_PEOPLE combines the real simulated STAFF roster with the
// fixed role identities several modules already use as their own
// "logged in as" name (Joinery/Upholstery/Painting have no dedicated
// STAFF entry — see those modules' own currentUser comments) so every
// module's "current user" is reachable by name, not just the 4 real
// STAFF entries.
// ══════════════════════════════════════════
const REACHABLE_PEOPLE = [
  ...STAFF.filter(s => s !== "Operations"),
  "Operations Manager", "Joinery Production Manager", "Upholstery Manager",
  "Painting Lead / Work Supervisor", "Storekeeper", "Accounts", "HR"
];
const messages = [];
function nextMessageId() { return "MSG-" + String(messages.length + 1).padStart(5, "0"); }

// ── Cloud-backed messages (4 Aug 2026, Phase 1 continued) ────────────
// window.__realCloudSession is set true by auth.js only on a genuine
// Supabase login — never in the e2e test bypass (file:///localhost),
// which has no real authenticated session for RLS to accept writes
// under. Every function below branches on that flag: real login ->
// read/write the live `messages` table in Supabase; anything else
// (tests, or Supabase/network genuinely unreachable) -> the original
// in-memory array above, unchanged. This is deliberate graceful
// degradation, the same offline-first spirit as the rest of this app,
// not a half-finished migration.
//
// getInboxFor()/getUnreadCountFor() MUST stay synchronous — they're
// called inline inside dozens of other modules' own synchronous
// render functions (e.g. renderJoineryDashboard() returning a template
// string with ${renderInboxWidget(...)} embedded). Making them truly
// async would cascade through every one of those call chains. Instead
// they read from cloudMessagesCache, a local mirror kept fresh by
// initCloudMessagesCache()'s realtime subscription — the standard
// pattern for pairing a realtime backend with synchronous UI code.
let cloudMessagesCache = [];

function cloudRowToMessage(row) {
  return {
    id: row.id, from: row.sender_name, to: row.recipient_name, body: row.body,
    linkedType: row.linked_type, linkedId: row.linked_id, read: row.read,
    date: row.created_at.slice(0, 10), time: row.created_at
  };
}

// Called once from auth.js's finishCloudLogin() on a real login (never
// in test-bypass mode). Fetches the current identity's inbox+sent once,
// then keeps cloudMessagesCache live via realtime.
// Idempotency guard — see the identical note on
// cloudCustomersCacheInitialized above; finishCloudLogin() can
// genuinely fire twice for one real login.
let cloudMessagesCacheInitialized = false;
async function initCloudMessagesCache() {
  if (!window.__realCloudSession || !window.cloudIdentity || !sb || cloudMessagesCacheInitialized) return;
  cloudMessagesCacheInitialized = true;
  const me = window.cloudIdentity;
  const { data, error } = await sb.from("messages").select("*")
    .or(`sender_name.eq.${me},recipient_name.eq.${me}`)
    .order("created_at", { ascending: false });
  if (!error) cloudMessagesCache = (data || []).map(cloudRowToMessage);
  sb.channel("messages-" + me)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
      const row = payload.new || payload.old;
      if (!row || (row.sender_name !== me && row.recipient_name !== me)) return; // RLS already prevents seeing others' anyway
      const mapped = cloudRowToMessage(row);
      // Compare ids as strings — Postgres bigint often serializes as a
      // string over the wire, while a freshly-inserted row's id (from
      // sendMessage()'s own .select().single() response) is a JS
      // number; a strict === here would silently never match.
      const existingIdx = cloudMessagesCache.findIndex((m) => String(m.id) === String(row.id));
      if (payload.eventType === "INSERT") { if (existingIdx < 0) cloudMessagesCache.unshift(mapped); else cloudMessagesCache[existingIdx] = mapped; }
      else if (payload.eventType === "UPDATE") { if (existingIdx >= 0) cloudMessagesCache[existingIdx] = mapped; }
      notifyLiveUpdateListeners();
    })
    .subscribe();
}

// sendMessage()/markMessageRead() ARE genuinely async in cloud mode —
// their only real call sites are button clicks / onclick handlers
// (teamcomms.js), already fine to await, unlike the render functions
// above.
async function sendMessage({ from, to, body, linkedType = null, linkedId = null }) {
  if (!to) return { error: "Choose who to send this to." };
  if (!body || !body.trim()) return { error: "Message can't be empty." };
  if (window.__realCloudSession && sb) {
    const { data, error } = await sb.from("messages")
      .insert({ sender_name: window.cloudIdentity, recipient_name: to, body: body.trim(), linked_type: linkedType, linked_id: linkedId })
      .select().single();
    if (error) return { error: error.message };
    return cloudRowToMessage(data);
  }
  const msg = {
    id: nextMessageId(), from, to, body: body.trim(),
    linkedType, linkedId, date: new Date().toISOString().slice(0, 10),
    time: new Date().toISOString(), read: false
  };
  messages.push(msg);
  return msg;
}
function getInboxFor(person) {
  if (window.__realCloudSession) return cloudMessagesCache.filter((m) => m.to === window.cloudIdentity).sort((a, b) => b.time.localeCompare(a.time));
  return messages.filter(m => m.to === person).sort((a, b) => b.time.localeCompare(a.time));
}
function getUnreadCountFor(person) {
  if (window.__realCloudSession) return cloudMessagesCache.filter((m) => m.to === window.cloudIdentity && !m.read).length;
  return messages.filter(m => m.to === person && !m.read).length;
}
async function markMessageRead(id) {
  if (window.__realCloudSession && sb) {
    const { error } = await sb.from("messages").update({ read: true }).eq("id", id);
    if (!error) { const m = cloudMessagesCache.find((x) => String(x.id) === String(id)); if (m) m.read = true; }
    return;
  }
  const m = messages.find(x => x.id === id);
  if (m) m.read = true;
  return m;
}
function markAllMessagesReadFor(person) {
  if (window.__realCloudSession) { cloudMessagesCache.forEach((m) => { if (m.to === window.cloudIdentity) m.read = true; }); return; }
  messages.forEach(m => { if (m.to === person) m.read = true; });
}

// ── Presence ("who's online") — Supabase Realtime Presence ──────────
let onlineIdentities = new Set();
function isOnline(person) { return onlineIdentities.has(person); }
// Idempotency guard — see the identical note on
// cloudCustomersCacheInitialized above; finishCloudLogin() can
// genuinely fire twice for one real login.
let presenceInitialized = false;
function initPresence() {
  if (!window.__realCloudSession || !window.cloudIdentity || !sb || presenceInitialized) return;
  presenceInitialized = true;
  const channel = sb.channel("online-users", { config: { presence: { key: window.cloudIdentity } } });
  channel.on("presence", { event: "sync" }, () => {
    onlineIdentities = new Set(Object.keys(channel.presenceState()));
    notifyLiveUpdateListeners();
  });
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
  });
}

// ── Live-update hook ──────────────────────────────────────────────
// Realtime message/presence events arrive async and need to re-render
// whatever's currently on screen — but each module has its own
// renderXBody(), no single global "re-render everything." Pragmatic
// fix: renderInboxWidget() (teamcomms.js) records the caller's own
// rerender function name every time it's drawn; live events just
// replay whichever one was drawn most recently.
window.__lastInboxRerenderFn = null;
function notifyLiveUpdateListeners() {
  if (window.__lastInboxRerenderFn && typeof window[window.__lastInboxRerenderFn] === "function") window[window.__lastInboxRerenderFn]();
}
