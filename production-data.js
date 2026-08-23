// ═══════════════════════════════════════════════════════════════════════
// Production Manager data layer — design handoff 19a.
//
// The joinery production manager sits between the estimator, the
// operations manager, the store, the purchaser and five crews on the
// factory floor. His day is two things: people ask him for things with
// deadlines, and five crews wait to be told what to do.
//
// 19a names five design commitments and says they are the point of the
// module. All five are enforced HERE, not in the UI:
//
//   1. NO LANE SLOT WITHOUT MATERIAL AND A LIVE BOM. A crew that starts
//      and stops because half the boards are missing costs more than the
//      day it waited. allotLaneSlot() refuses; refused jobs surface in
//      getWaitingForLane() with the reason on them.
//   2. PAINT AND INSTALL PULL THEIR DATES FROM JOINERY. A derived slot
//      stores its base slot and an offset — its date is COMPUTED, so when
//      the upstream slot moves, it moves with it. A date given to a
//      client before the booth is booked is a date that will be broken.
//   3. HE RETURNS HOURS AND QUANTITIES, NEVER A PRICE. answerInputRequest()
//      accepts a whitelisted shape and refuses any money-looking field.
//      The estimator turns hours into money; this module never does.
//   4. A BOM CHANGE KILLS THE CUTTING LIST. Sheets cut from an older
//      revision are dead paper. The gate does NOT clear on issuing the
//      new revision — it clears on confirming the old sheet is off the saw.
//   5. OVERTIME BUYS HOURS, NOT MATERIAL. Every shift is booked against
//      the target it recovers AND the cause of the slip, cause from a
//      closed enum, so the pattern stays visible. A shift with nothing to
//      work on is refused — it is a paid idle day.
//
// Corollary: pricing input (the estimator's question — what will THIS job
// take) and budgeting input (operations' question — what should A UNIT
// consume) are different things. The type is bound to the asker's role so
// the client is not the thing keeping them apart.
//
// Reuses rather than duplicates: material truth is 18a's stockFree()/
// reservations; supplier quotes are 17a's rfqs; jobs are jobCards[].
// ═══════════════════════════════════════════════════════════════════════

// The five real crews, from the module's own definition — a lane on the
// week board is a crew, never a named man. Men counts are set by the
// manager, not invented here.
// Names, stations and head counts are the handoff's own (its lane table), and
// the "·" in the joinery names is part of the frozen label. `men` is the
// establishment — how many the crew is meant to be — while the actual bodies
// come from crewMembers[] below, so the two can honestly disagree and the
// board can say so.
const crews = [
  { id: "CREW-A", name: "Joinery · Crew A", dept: "carp", station: "saw 2", men: 6, unit: "fitters" },
  { id: "CREW-B", name: "Joinery · Crew B", dept: "carp", station: "bench 1–3", men: 5, unit: "fitters" },
  { id: "CREW-U", name: "Sofa & upholstery", dept: "uph", station: "upholstery bay", men: 4, unit: "" },
  { id: "CREW-P", name: "Paint & polish", dept: "paint", station: "spray booth", men: 3, unit: "" },
  { id: "CREW-I", name: "Site installation", dept: "carp", station: "two vans", men: 4, unit: "" }
];
// The spec's capacity line: "6 fitters · saw 2", "4 · upholstery bay".
function crewCapacityLine(c) {
  return (c.men ? c.men + (c.unit ? " " + c.unit : "") + " · " : "") + (c.station || "");
}

const laneSlots = [];        // week-board allotments, work + derived
const bomRevisions = [];     // one stream per job card
const cuttingSheets = [];    // live paper on the saws
const pressingBatches = [];  // veneer pressing, batched by veneer
const overtimeShifts = [];   // hours bought back, with target and cause
const inputRequests = [];    // typed asks: pricing_input / bom_budget_input

// The spec's own cause list (the ot side card: BOM revision late 24h,
// material late 13h, client change 8h). Closed and required — a free-text
// cause is how the same slip hides under four spellings.
const OVERTIME_CAUSES = ["BOM revision late", "Material late", "Client change"];

function nextPrdId(prefix, arr) {
  const n = arr.reduce((mx, r) => {
    const m = String(r.id || "").match(/(\d+)$/);
    return m ? Math.max(mx, parseInt(m[1], 10)) : mx;
  }, 0);
  return prefix + "-" + String(n + 1).padStart(4, "0");
}
function prdToday() { return todayISO(); }

// ═══ Material + BOM truth for one job ═══════════════════════════════════
// The lane gate's two questions, answered from the systems that own them.
// A Job Card item does NOT carry its BOM. confirmQuotationToJobCard() copies
// lineId/product/qty/rate and deliberately leaves the build-up behind — the
// BOM lives on the QUOTATION item, and the rest of data.js reaches it through
// quotations.find(q => q.id === job.quotationId) in six places.
//
// This layer originally read job.items[].bom directly, which is always
// undefined — so jobHasLiveBOM() was false for every job that could ever
// exist, allotLaneSlot() and createCuttingSheet() could never succeed, and
// every routed job sat permanently in "Waiting for a lane · No BOM". Found
// 19 Aug 2026 the first time the board was seeded with real records.
function jobBOMItems(jobId) {
  const job = typeof getJobCard === "function" ? getJobCard(jobId) : null;
  if (!job) return [];
  const qtn = (typeof quotations !== "undefined")
    ? quotations.find(q => q.id === job.quotationId) : null;
  const qItems = (qtn && qtn.items) || [];
  // Resolved per LINE, not per source: a job item that carries its own BOM
  // keeps it, and only one that doesn't reaches back to the quotation line of
  // the same lineId (confirmQuotationToJobCard copies lineId across, so they
  // line up). Preferring one whole source over the other would silently throw
  // away a BOM attached directly to a job item.
  return (job.items || []).map(it => {
    if (it.bom) return it;
    const src = qItems.find(x => x.lineId === it.lineId);
    return (src && src.bom) ? Object.assign({}, it, { bom: src.bom }) : it;
  });
}

function jobMaterialShortLines(jobId) {
  const job = typeof getJobCard === "function" ? getJobCard(jobId) : null;
  if (!job) return [];
  const shorts = [];
  jobBOMItems(jobId).forEach(it => {
    ((it.bom && it.bom.materials) || []).forEach(m => {
      if (!m.itemId) return;
      const need = Number(m.qty) || 0;
      const free = typeof stockFree === "function" ? stockFree(m.itemId, null) : 0;
      const heldForThis = typeof reservedToThisJob === "function"
        ? reservedToThisJob(m.itemId, null, jobId) : 0;
      if (need > free + heldForThis) shorts.push({ itemId: m.itemId, need, available: free + heldForThis });
    });
  });
  return shorts;
}
function jobHasLiveBOM(jobId) {
  const job = typeof getJobCard === "function" ? getJobCard(jobId) : null;
  if (!job) return false;
  return jobBOMItems(jobId).some(it => it.bom && (it.bom.materials || []).length);
}
function jobBOMRevisionPending(jobId) {
  const rev = bomRevisions.find(r => r.jobCardId === jobId && r.status === "pending");
  return !!rev;
}
// Commitment 4's tail: dead paper still on a saw blocks the lane too.
function jobDeadSheetsOutstanding(jobId) {
  return cuttingSheets.filter(s => s.jobCardId === jobId && s.status === "dead" && !s.confirmedOffSaw);
}
// The one answer the week board asks: why can this job not take a slot?
// null means it is clear.
function jobLaneBlockReason(jobId) {
  const job = typeof getJobCard === "function" ? getJobCard(jobId) : null;
  if (!job) return "No such job card";
  if (job.status === "cancelled") return "Job cancelled";
  if (!jobHasLiveBOM(jobId)) return "No BOM — the estimator hasn't costed the lines";
  if (jobBOMRevisionPending(jobId)) return "BOM revision pending";
  const dead = jobDeadSheetsOutstanding(jobId);
  if (dead.length) return "Old cutting list still on the saw — confirm it off before recutting";
  const shorts = jobMaterialShortLines(jobId);
  if (shorts.length) return "Material short — " + shorts.length + " line" + (shorts.length === 1 ? "" : "s");
  return null;
}

// ═══ Taking a lane slot CLAIMS the boards ══════════════════════════════
// Found 23 Aug 2026 by walking the story: the gate asked "is there enough
// unreserved stock anywhere" and nothing ever reserved, so TWO jobs could
// both clear it on the same boards. Whoever issued first took them and the
// second crew started and stopped — precisely the day commitment 1 exists to
// prevent ("a crew that starts and stops because half the boards are missing
// costs more than the day it waited").
//
// The design's own allot gate says the clear answer is "Material reserved ·
// BOM current", so booking the lane is what reserves. After this, the second
// job is honestly short and the board says so.
function reserveJobMaterial(jobId, byWhom) {
  if (typeof reserveStockForJob !== "function") return [];
  const held = [];
  jobBOMItems(jobId).forEach(it => {
    ((it.bom && it.bom.materials) || []).forEach(m => {
      if (!m.itemId) return;
      const need = Number(m.qty) || 0;
      const already = typeof reservedToThisJob === "function" ? reservedToThisJob(m.itemId, null, jobId) : 0;
      let outstanding = need - already;
      if (outstanding <= 0) return;
      // Greedy across bins — the boards may be split between stores, and a
      // reservation is per bin because that is where someone walks to.
      (typeof storeBins !== "undefined" ? storeBins : []).forEach(b => {
        if (outstanding <= 0) return;
        const free = stockFree(m.itemId, b.id);
        if (free <= 0) return;
        const take = Math.min(free, outstanding);
        const r = reserveStockForJob({ itemId: m.itemId, binId: b.id, qty: take, jobCardId: jobId,
          heldBy: byWhom || "Production Manager", note: "Held by the week board" });
        if (r && !r.error) { held.push(r); outstanding -= take; }
      });
    });
  });
  return held;
}

// ═══ 1. The week board — lane slots ═════════════════════════════════════
function allotLaneSlot({ crewId, jobCardId, date, portion = "full", byWhom = "Production Manager" } = {}) {
  if (!crews.some(c => c.id === crewId)) return { error: "Which crew?" };
  if (!date) return { error: "Which day?" };
  if (!["full", "half"].includes(portion)) return { error: "Full day or half day." };
  // Commitment 1 — this refusal is the module's point.
  const reason = jobLaneBlockReason(jobCardId);
  if (reason) return { error: "No lane slot: " + reason + ". It stays in the waiting strip until that clears." };

  const slot = {
    id: nextPrdId("SLOT", laneSlots),
    crewId, jobCardId, date, portion, kind: "work", byWhom,
    bookedOn: prdToday()
  };
  // Two jobs on one crew is allowed but never silent — the board renders
  // it "over" and the caller gets the warning to show.
  const clash = laneSlots.filter(s => s.kind === "work" && s.crewId === crewId && slotDate(s) === date);
  laneSlots.push(slot);
  // Claim the boards for this job — see reserveJobMaterial() above.
  if (slot.kind === "work") reserveJobMaterial(jobCardId, byWhom);
  return clash.length ? { slot, warning: "Crew overloaded — " + (clash.length + 1) + " jobs on one lane that day." } : { slot };
}
// Commitment 2 — a derived slot has no date of its own, only an upstream
// slot and an offset (joinery finish + cure, paint finish + travel). Its
// date is computed at read time, so moving the base moves it.
function allotDerivedSlot({ crewId, baseSlotId, offsetDays, jobCardId, byWhom = "Production Manager" } = {}) {
  const base = laneSlots.find(s => s.id === baseSlotId);
  if (!base) return { error: "Derived from which slot?" };
  if (!crews.some(c => c.id === crewId)) return { error: "Which crew?" };
  if (!(Number(offsetDays) >= 0)) return { error: "How many days after the upstream slot?" };
  const slot = {
    id: nextPrdId("SLOT", laneSlots),
    crewId, jobCardId: jobCardId || base.jobCardId,
    kind: "pull", baseSlotId, offsetDays: Number(offsetDays),
    portion: "full", byWhom, bookedOn: prdToday()
  };
  laneSlots.push(slot);
  return { slot };
}
function slotDate(slot) {
  if (slot.kind !== "pull") return slot.date;
  const base = laneSlots.find(s => s.id === slot.baseSlotId);
  if (!base) return slot.date || null;
  return addDaysISO(slotDate(base), slot.offsetDays);
}
function moveLaneSlot(slotId, newDate, byWhom = "Production Manager") {
  const slot = laneSlots.find(s => s.id === slotId);
  if (!slot) return { error: "Slot not found." };
  if (slot.kind === "pull") return { error: "A derived slot has no date of its own — move the slot it pulls from." };
  slot.date = newDate;
  slot.movedBy = byWhom;
  // Nothing to cascade by hand: every follower's date is computed off
  // this one, which is the whole reason it is stored as an offset.
  return slot;
}
function getWaitingForLane() {
  const allotted = {};
  laneSlots.forEach(s => { allotted[s.jobCardId] = true; });
  return (typeof jobCards !== "undefined" ? jobCards : [])
    .filter(j => j.status !== "cancelled" && j.routingConfirmed && !allotted[j.id])
    .filter(j => (j.items || []).some(it => (it.departmentSequence || []).some(d => ["carp", "uph", "paint"].includes(d))))
    .map(j => ({ job: j, reason: jobLaneBlockReason(j.id) || "No lane yet — clear to allot" }));
}
function getCrewWeek(crewId, weekDates) {
  return (weekDates || []).map(d => ({
    date: d,
    slots: laneSlots.filter(s => s.crewId === crewId && slotDate(s) === d),
    overtime: overtimeShifts.filter(o => o.crewId === crewId && o.date === d)
  }));
}

// ═══ 2. BOM revisions and the cutting list they kill ═══════════════════
function currentBOMRevision(jobId) {
  const revs = bomRevisions.filter(r => r.jobCardId === jobId && r.status === "current");
  return revs.length ? revs[revs.length - 1] : null;
}
function ensureBOMRevision(jobId) {
  let rev = currentBOMRevision(jobId);
  if (!rev) {
    rev = { id: nextPrdId("REV", bomRevisions), jobCardId: jobId, letter: "A", status: "current", date: prdToday() };
    bomRevisions.push(rev);
  }
  return rev;
}
// Two steps on purpose. Starting a revision blocks the lane at once (the
// numbers are moving — nothing should be cut). Issuing it kills the old
// paper, and the job stays blocked until that paper is confirmed off the
// saw — the gate does not clear on the new revision existing.
function startBOMRevision(jobId, byWhom, note = "") {
  if (jobBOMRevisionPending(jobId)) return { error: "A revision is already pending on this job." };
  ensureBOMRevision(jobId);
  const rev = {
    id: nextPrdId("REV", bomRevisions), jobCardId: jobId,
    letter: null, status: "pending", byWhom, note, date: prdToday()
  };
  bomRevisions.push(rev);
  return rev;
}
function issueBOMRevision(jobId, byWhom) {
  const pending = bomRevisions.find(r => r.jobCardId === jobId && r.status === "pending");
  if (!pending) return { error: "No pending revision on this job." };
  const old = currentBOMRevision(jobId);
  if (old) old.status = "superseded";
  pending.status = "current";
  pending.letter = old ? String.fromCharCode(old.letter.charCodeAt(0) + 1) : "A";
  pending.issuedBy = byWhom;
  pending.issuedOn = prdToday();
  // Commitment 4: every live sheet cut from the old revision is dead paper
  // the moment the new revision exists.
  const killed = [];
  cuttingSheets
    .filter(s => s.jobCardId === jobId && s.revisionId !== pending.id && ["released", "on-saw"].includes(s.status))
    .forEach(s => { s.status = "dead"; s.killedByRevision = pending.id; killed.push(s.id); });
  logActivity({
    type: "bom-revised", linkedType: "job", linkedId: jobId, user: byWhom,
    message: `BOM REV ${pending.letter} issued on ${jobId}` + (killed.length ? ` — ${killed.length} cutting sheet${killed.length === 1 ? "" : "s"} now dead paper` : "")
  });
  return pending;
}
function createCuttingSheet({ jobCardId, saw = "", lines = [], byWhom = "Production Manager" } = {}) {
  const job = typeof getJobCard === "function" ? getJobCard(jobCardId) : null;
  if (!job) return { error: "Which job card?" };
  if (!jobHasLiveBOM(jobCardId)) return { error: "No BOM — there is nothing to cut from." };
  if (jobBOMRevisionPending(jobCardId)) return { error: "A BOM revision is pending — cutting from the old numbers is dead paper by lunchtime." };
  const dead = jobDeadSheetsOutstanding(jobCardId);
  if (dead.length) return { error: "The old cutting list is still on the saw. Confirm it off before releasing a new one." };
  const rev = ensureBOMRevision(jobCardId);
  const sheet = {
    id: nextPrdId("CUT", cuttingSheets),
    jobCardId, saw, lines, byWhom,
    revisionId: rev.id, revisionLetter: rev.letter,
    status: "released",   // released | on-saw | off-saw | dead
    confirmedOffSaw: false,
    date: prdToday()
  };
  cuttingSheets.push(sheet);
  return sheet;
}
function markSheetOnSaw(sheetId, saw) {
  const s = cuttingSheets.find(x => x.id === sheetId);
  if (!s) return { error: "Sheet not found." };
  if (s.status === "dead") return { error: "That sheet is dead paper — it was cut from a superseded revision." };
  s.status = "on-saw";
  if (saw) s.saw = saw;
  return s;
}
// Works for live AND dead sheets — confirming dead paper off the saw is
// exactly the act that clears the revision gate.
function confirmSheetOffSaw(sheetId, byWhom = "Production Manager") {
  const s = cuttingSheets.find(x => x.id === sheetId);
  if (!s) return { error: "Sheet not found." };
  if (s.confirmedOffSaw) return { error: "Already confirmed off the saw." };
  s.confirmedOffSaw = true;
  s.offSawBy = byWhom;
  s.offSawOn = prdToday();
  if (s.status !== "dead") s.status = "off-saw";
  return s;
}

// ═══ 3. Veneer pressing ═════════════════════════════════════════════════
function createPressingBatch({ veneer, byWhom = "Production Manager" } = {}) {
  if (!veneer || !veneer.trim()) return { error: "Which veneer is this batch pressing?" };
  const b = {
    id: nextPrdId("VP", pressingBatches),
    veneer: veneer.trim(), byWhom, date: prdToday(),
    jobs: [], status: "open"   // open | pressed
  };
  pressingBatches.push(b);
  return b;
}
function addJobToPressingBatch(batchId, jobCardId, sheets) {
  const b = pressingBatches.find(x => x.id === batchId);
  if (!b) return { error: "Batch not found." };
  if (b.status !== "open") return { error: "That batch is already pressed." };
  if (!(Number(sheets) > 0)) return { error: "How many sheets?" };
  b.jobs.push({ jobCardId, sheets: Number(sheets) });
  return b;
}
function pressBatch(batchId, byWhom = "Production Manager") {
  const b = pressingBatches.find(x => x.id === batchId);
  if (!b) return { error: "Batch not found." };
  if (!b.jobs.length) return { error: "An empty press run saves nobody anything." };
  b.status = "pressed";
  b.pressedOn = prdToday();
  b.pressedBy = byWhom;
  return b;
}

// ═══ 4. Overtime — hours bought against a target, with a cause ══════════
function bookOvertimeShift({ crewId, date, hours, men, recoversTarget, cause, byWhom = "Production Manager" } = {}) {
  if (!crews.some(c => c.id === crewId)) return { error: "Which crew?" };
  if (!date) return { error: "Which day?" };
  if (!(Number(hours) > 0)) return { error: "How many hours?" };
  if (!(Number(men) > 0)) return { error: "How many men?" };
  if (!recoversTarget) return { error: "Overtime is booked against the target it recovers — which job?" };
  // The cause is required and closed. The same cause three weeks running
  // is a planning problem, not a labour cost — that only shows if the
  // spelling cannot drift.
  if (!OVERTIME_CAUSES.includes(cause)) {
    return { error: "The cause of the slip is required — one of: " + OVERTIME_CAUSES.join(" · ") + "." };
  }
  // Commitment 5: overtime buys hours, not material. A shift on a job
  // whose material is short and which holds no lane slot is a paid idle
  // day, and it is refused.
  const hasWork = laneSlots.some(s => s.jobCardId === recoversTarget);
  const shorts = jobMaterialShortLines(recoversTarget);
  if (!hasWork && shorts.length) {
    return { error: "Refused — nothing to work on. The material is short and no lane is booked; overtime cannot cut boards that are not there." };
  }
  const shift = {
    id: nextPrdId("OT", overtimeShifts),
    crewId, date, hours: Number(hours), men: Number(men),
    recoversTarget, cause, byWhom, bookedOn: prdToday()
  };
  overtimeShifts.push(shift);
  logActivity({
    type: "overtime-booked", linkedType: "job", linkedId: recoversTarget, user: byWhom,
    message: `${shift.hours}h × ${shift.men} men on ${crewName(crewId)} ${date} — recovers ${recoversTarget}`, reason: cause
  });
  return shift;
}
function crewName(crewId) {
  const c = crews.find(x => x.id === crewId);
  return c ? c.name : crewId;
}
// The ot page's side card: four weeks of hours by cause, so the pattern
// is visible.
function getOvertimeByCause(daysBack) {
  const since = addDaysISO(prdToday(), -(daysBack || 28));
  const by = {};
  overtimeShifts.filter(o => o.date >= since).forEach(o => {
    by[o.cause] = (by[o.cause] || 0) + o.hours;
  });
  return Object.keys(by).map(k => ({ cause: k, hours: by[k] })).sort((a, b) => b.hours - a.hours);
}

// ═══ 5. Typed input requests ════════════════════════════════════════════
// pricing_input: the estimator asking what THIS job will take.
// bom_budget_input: operations asking what A UNIT should consume.
// The type is bound to the asker's role so the client is not the thing
// keeping them apart.
const INPUT_REQUEST_TYPES = {
  pricing_input: { raiserRole: "estimator", label: "Pricing input" },
  bom_budget_input: { raiserRole: "operations_manager", label: "BOM input for budgeting" }
};
function raiseInputRequest({ type, raisedBy, raiserRole, jobCardId = null, question, neededBy = null } = {}) {
  const def = INPUT_REQUEST_TYPES[type];
  if (!def) return { error: "Unknown request type." };
  if (!question || !question.trim()) return { error: "What is being asked?" };
  if (raiserRole !== def.raiserRole) {
    return { error: def.label + " can only be raised by the " + def.raiserRole.replace(/_/g, " ") + " — pricing input and budgeting input are different questions from different askers." };
  }
  const r = {
    id: nextPrdId("REQ", inputRequests),
    type, raisedBy, jobCardId, question: question.trim(),
    neededBy, date: prdToday(),
    status: "open",   // open | answered
    answer: null
  };
  inputRequests.push(r);
  return r;
}
// Commitment 3: hours and quantities, never a price. A whitelist rather
// than a blacklist — a shape that has to be named to get through.
const INPUT_ANSWER_FIELDS = ["manHours", "men", "days", "boards", "veneerSheets", "processDays", "wastagePct", "note"];
function answerInputRequest(reqId, payload, byWhom = "Production Manager") {
  const r = inputRequests.find(x => x.id === reqId);
  if (!r) return { error: "Request not found." };
  if (r.status !== "open") return { error: "Already answered." };
  if (!payload || !Object.keys(payload).length) return { error: "An empty answer helps nobody." };
  for (const k of Object.keys(payload)) {
    if (!INPUT_ANSWER_FIELDS.includes(k)) {
      return { error: '"' + k + '" is not something this role returns. Hours and quantities only — the ' + (r.type === "pricing_input" ? "estimator" : "operations manager") + " turns them into money." };
    }
  }
  r.answer = Object.assign({}, payload);
  r.answeredBy = byWhom;
  r.answeredOn = prdToday();
  r.status = "answered";
  return r;
}

// ═══ 6. Asked of you today — the first card ═════════════════════════════
// Other people's deadlines, before the board. Typed rows from the systems
// that own each ask: input requests here, shorts from the store (18a),
// supplier quotes back from purchase (17a).
function getAskedOfYouToday() {
  const rows = [];
  inputRequests.filter(r => r.status === "open").forEach(r => rows.push({
    kind: INPUT_REQUEST_TYPES[r.type].label, from: r.raisedBy,
    detail: r.question, ref: r.id, due: r.neededBy
  }));
  (typeof getStoreShorts === "function" ? getStoreShorts() : []).forEach(s => rows.push({
    kind: "Store short", from: "Storekeeper",
    detail: s.name + " — short " + s.short + " for " + s.forJob, ref: s.forJob, due: s.promisedDate
  }));
  (typeof rfqs !== "undefined" ? rfqs : []).filter(r => r.status === "quotes-in").forEach(r => rows.push({
    kind: "Supplier quotes back", from: "Purchase",
    detail: r.id + " — " + r.quotes.length + " quotes to compare", ref: r.id, due: null
  }));
  return rows.sort((a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999")));
}

function getProductionKPIs() {
  const waiting = getWaitingForLane();
  return {
    askedOfYou: getAskedOfYouToday().length,
    waitingForLane: waiting.length,
    blockedForMaterial: waiting.filter(w => /Material short/.test(w.reason)).length,
    liveSheets: cuttingSheets.filter(s => ["released", "on-saw"].includes(s.status)).length,
    deadPaperOut: cuttingSheets.filter(s => s.status === "dead" && !s.confirmedOffSaw).length,
    otHoursThisMonth: getOvertimeByCause(28).reduce((s, c) => s + c.hours, 0),
    openBatches: pressingBatches.filter(b => b.status === "open").length
  };
}

// ═══ THE ROSTER — real Al Maraya staff, standing in real crews ═════════
// The handoff wants 22 named men across the five crews, each with a trade, a
// leader flag and a state, plus a "not in a crew" pool and the rule that a
// crewless man cannot be given work (everything on the board is allotted to a
// crew, never to a person).
//
// Rather than invent 22 names, this draws on the REAL production staff already
// in the app — EMPLOYEE_RATES carries 70 real people with real departments
// (24 Carpentry, 10 Upholstery, 15 Curtain & Blinds), and EMPLOYEE_SALARIES
// carries their real trade in `designation` (Carpenter, Painter, Upholsterer,
// Tailor, Technician, Helper).
//
// NO PAY FIGURE ENTERS THIS MODULE. `designation` is read; basic/ot/net/rate
// are not, and must not be. The handoff bars this role from money and the
// server-side trigger already refuses it inside an answer — reading a rate
// here would be the same leak through a different door. Attendance, leave and
// overtime PAY stay with the labour dashboard; this module hands it hours.
const crewMembers = [];   // { id, name, crewId, trade, leader }

// Which trades belong in which crew. This is what gives the `lab` create
// flow's gate a real basis for "Paint & polish — not his trade" rather than a
// hardcoded answer.
const CREW_TRADES = {
  "CREW-A": ["Carpenter", "Carpenter / Driver", "Technician", "Helper"],
  "CREW-B": ["Carpenter", "Carpenter / Driver", "Technician", "Helper"],
  "CREW-U": ["Upholsterer", "Tailor", "Helper"],
  "CREW-P": ["Painter", "Helper"],
  "CREW-I": ["Carpenter", "Carpenter / Driver", "Technician", "Driver", "Helper"]
};
function crewTradeFits(trade, crewId) {
  const allowed = CREW_TRADES[crewId];
  return !allowed || !trade ? true : allowed.indexOf(trade) !== -1;
}

// A person's trade, from the real payroll designation. Falls back to the
// department when nobody recorded one — honest "unknown", never a guess.
function personTrade(name) {
  const sal = (typeof EMPLOYEE_SALARIES !== "undefined") ? EMPLOYEE_SALARIES[name] : null;
  if (sal && sal.designation) return sal.designation;
  const emp = (typeof EMPLOYEE_RATES !== "undefined") ? EMPLOYEE_RATES[name] : null;
  return emp ? emp.department : "";
}

// Seeds the five crews from real staff, once. Idempotent: if anyone is
// already assigned it leaves the roster alone.
// Paint draws from Carpentry on purpose — there is no separate paint payroll
// bucket and LEDGER_DEPT_ROSTER already maps paint -> Carpentry.
function buildCrewRoster() {
  if (crewMembers.length) return crewMembers;
  if (typeof EMPLOYEE_RATES === "undefined") return crewMembers;
  const pool = Object.keys(EMPLOYEE_RATES)
    .filter(n => EMPLOYEE_RATES[n].category === "Production")
    .map(n => ({ name: n, dept: EMPLOYEE_RATES[n].department, trade: personTrade(n) }));

  const take = (crewId, dept, n) => {
    // Prefer someone whose real trade fits the crew, then anyone from the
    // right department — so a Painter lands in paint if one exists.
    const fits = pool.filter(p => !p.taken && p.dept === dept && crewTradeFits(p.trade, crewId));
    const rest = pool.filter(p => !p.taken && p.dept === dept);
    const picked = fits.concat(rest.filter(p => fits.indexOf(p) === -1)).slice(0, n);
    picked.forEach((p, i) => {
      p.taken = true;
      crewMembers.push({
        id: "MAN-" + String(crewMembers.length + 1).padStart(3, "0"),
        name: p.name, crewId, trade: p.trade, leader: i === 0
      });
    });
  };
  take("CREW-A", "Carpentry", 6);
  take("CREW-B", "Carpentry", 5);
  take("CREW-U", "Upholstery", 4);
  take("CREW-P", "Carpentry", 3);
  take("CREW-I", "Carpentry", 4);

  // Everyone else is real staff genuinely not in a crew — a paid day
  // producing nothing, which is the point of the spec's warning card.
  pool.filter(p => !p.taken).forEach(p => crewMembers.push({
    id: "MAN-" + String(crewMembers.length + 1).padStart(3, "0"),
    name: p.name, crewId: null, trade: p.trade, leader: false
  }));
  return crewMembers;
}

function getCrewMembers(crewId) { return crewMembers.filter(m => m.crewId === crewId); }
function getCrewlessMen() { return crewMembers.filter(m => !m.crewId); }
function crewLeader(crewId) { return crewMembers.filter(m => m.crewId === crewId && m.leader)[0] || null; }

// Moving a man between crews. Refuses on trade, which is the `lab` gate's
// blocked option — "Trade does not match the crew."
function assignToCrew(personId, crewId, byWhom = "Production Manager", override = false) {
  const man = crewMembers.find(m => m.id === personId);
  if (!man) return { error: "Who?" };
  if (crewId && !crews.some(c => c.id === crewId)) return { error: "Which crew?" };
  if (crewId && !crewTradeFits(man.trade, crewId) && !override) {
    return { error: "Trade does not match the crew. " + (man.trade || "No trade recorded") + " does not belong in " + (crews.find(c => c.id === crewId) || {}).name + "." };
  }
  const from = man.crewId;
  man.crewId = crewId || null;
  if (!crewId) man.leader = false;
  if (typeof logActivity === "function") {
    logActivity({
      type: "crew-assigned", linkedType: "crew", linkedId: crewId || from || "none", user: byWhom,
      message: man.name + (crewId ? " assigned to " + (crews.find(c => c.id === crewId) || {}).name : " taken out of a crew")
    });
  }
  return man;
}
const moveToCrew = assignToCrew;

// A man's state, DERIVED from what his crew is actually doing this week —
// there is no attendance field in this module and inventing one would put it
// in two places. wine = on a job today · plain = his crew works this week but
// not today · bad = his crew is blocked with nothing to work on · ok = free.
function manState(man, weekDates) {
  if (!man.crewId) return { tone: "bad", label: "No crew" };
  const days = weekDates || [];
  const today = todayISO();
  const mine = laneSlots.filter(s => s.crewId === man.crewId);
  if (mine.some(s => slotDate(s) === today)) return { tone: "wine", label: "On a job" };
  const thisWeek = mine.filter(s => days.indexOf(slotDate(s)) !== -1);
  if (thisWeek.length) return { tone: "plain", label: "Other work" };
  const blocked = getWaitingForLane().some(w =>
    (w.job.items || []).some(it => (it.departmentSequence || []).indexOf((crews.find(c => c.id === man.crewId) || {}).dept) !== -1));
  if (blocked) return { tone: "bad", label: "Idle" };
  return { tone: "ok", label: "Free" };
}

// Cloud-backed since 19 Aug 2026 — all six arrays are registered in
// CLOUD_JSON_COLLECTIONS (data.js) and ride the same snapshot-diff autosave
// every other collection uses. Two of the five commitments are enforced
// server-side as well (overtime needs a cause from the closed enum; an
// answer carrying anything money-shaped is refused). The other two need to
// read across job cards, quotations and stock, which live as jsonb here —
// see supabase/19a-production.sql for why they stay client-side.
