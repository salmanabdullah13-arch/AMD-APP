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
// A refused shift is recorded so the pattern is countable, but it was never
// worked — nothing that sums hours may include one.
const otWorked = (o) => (o.status || "booked") !== "refused";

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
/* ── Which items a lane slot covers ──────────────────────────────────────
   A slot used to mean "this crew, this day, this WHOLE job". It can now
   carry `lineIds`, so a crew can be booked on three of a job's seven items.

   `[]` or absent still means the whole job. That one rule is what keeps
   this cheap: every slot written before this change, and every caller that
   does not care about items, keeps its exact meaning with no edit.

   Derived (`kind:"pull"`) slots never store their own lines — they inherit
   the base slot's, the same way they inherit its date. */
const LANE_DEPTS = ["carp", "uph", "paint"];

/** Every line with a production stop at all — what a job must cover to leave the waiting strip. */
function jobRoutedLineIds(jobId) {
  const job = typeof getJobCard === "function" ? getJobCard(jobId) : null;
  if (!job) return [];
  return (job.items || [])
    .filter(it => (it.departmentSequence || []).some(d => LANE_DEPTS.includes(d)))
    .map(it => it.lineId);
}

/** One department's lines on a job, with the live stage entry the picker greys on. */
function jobLinesForDept(jobId, deptKey) {
  const job = typeof getJobCard === "function" ? getJobCard(jobId) : null;
  if (!job) return [];
  return (job.items || [])
    .filter(it => (it.departmentSequence || []).indexOf(deptKey) !== -1)
    .map(it => ({
      lineId: it.lineId, product: it.product, qty: it.qty, unit: it.unit,
      entry: (it.departmentStatuses || []).find(d => d.department === deptKey) || null
    }))
    .sort((a, b) => Number(a.lineId) - Number(b.lineId));
}

/** What a slot actually covers. The "[] means everything" rule is resolved
    HERE and nowhere else, so no caller has to remember it. */
function slotLineIds(slot) {
  if (!slot) return [];
  if (slot.kind === "pull") {
    const base = laneSlots.find(s => s.id === slot.baseSlotId);
    return base ? slotLineIds(base) : [];
  }
  const own = slot.lineIds || [];
  return own.length ? own.slice() : jobRoutedLineIds(slot.jobCardId);
}

/**
 * Lines already on a work slot.
 *
 * Department-blind by default, and that matters: a line routed carp → paint
 * takes its paint day from a DERIVED slot, never a work slot. Asking "one
 * work slot per department" would park every job with a paint stop in the
 * waiting strip forever. Pass a deptKey only where the question really is
 * per-department — the picker, so a line booked on the paint crew is not
 * greyed out while you are booking joinery.
 */
function laneAllottedLineIds(jobId, deptKey = null) {
  const out = {};
  laneSlots
    .filter(s => s.kind === "work" && s.jobCardId === jobId)
    .filter(s => {
      if (!deptKey) return true;
      const crew = crews.find(c => c.id === s.crewId);
      return crew && crew.dept === deptKey;
    })
    .forEach(s => slotLineIds(s).forEach(id => { out[id] = true; }));
  return Object.keys(out).map(Number);
}

/** routed / allotted / missing, for a job. */
function jobLaneCoverage(jobId) {
  const routed = jobRoutedLineIds(jobId);
  const allotted = laneAllottedLineIds(jobId);
  return { routed, allotted, missing: routed.filter(id => allotted.indexOf(id) === -1) };
}

function allotLaneSlot({ crewId, jobCardId, date, portion = "full", lineIds = [], byWhom = "Production Manager" } = {}) {
  if (!crews.some(c => c.id === crewId)) return { error: "Which crew?" };
  if (!date) return { error: "Which day?" };
  if (!["full", "half"].includes(portion)) return { error: "Full day or half day." };
  // Commitment 1 — this refusal is the module's point.
  const reason = jobLaneBlockReason(jobCardId);
  if (reason) return { error: "No lane slot: " + reason + ". It stays in the waiting strip until that clears." };

  // Item selection is checked AFTER the gate, deliberately: no caller that
  // passes no lineIds can reach it, so every existing one keeps its exact
  // behaviour and its exact refusal strings.
  const crew = crews.find(c => c.id === crewId);
  const picked = [...new Set((lineIds || []).map(Number))];
  if (picked.length) {
    const mine = jobLinesForDept(jobCardId, crew.dept).map(l => Number(l.lineId));
    const stray = picked.filter(id => mine.indexOf(id) === -1);
    if (stray.length) return { error: "Item " + stray[0] + " isn't routed to " + crew.name + "." };
  }

  const slot = {
    id: nextPrdId("SLOT", laneSlots),
    crewId, jobCardId, date, portion, kind: "work", byWhom,
    lineIds: picked,        // [] still means every routed line — see slotLineIds()
    bookedOn: prdToday()
  };
  // Two jobs on one crew is allowed but never silent — the board renders
  // it "over" and the caller gets the warning to show.
  // A SECOND booking of the same job on the same crew and day is not a
  // clash — it is the rest of that job's items, which is the whole point of
  // picking them. Only a different job is an overload.
  const clash = laneSlots.filter(s => s.kind === "work" && s.crewId === crewId
    && slotDate(s) === date && s.jobCardId !== jobCardId);
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
/**
 * Jobs with routed work that has no lane yet.
 *
 * Keyed by job AND line: one slot used to drop a whole job out of here, so
 * booking three of seven items looked finished. A job now stays until every
 * routed line has a slot — without that, picking items means nothing.
 */
function getWaitingForLane() {
  return (typeof jobCards !== "undefined" ? jobCards : [])
    .filter(j => j.status !== "cancelled" && j.routingConfirmed)
    .map(j => ({ job: j, cov: jobLaneCoverage(j.id) }))
    .filter(x => x.cov.routed.length && x.cov.missing.length)
    .map(x => ({
      job: x.job,
      missing: x.cov.missing,
      routedCount: x.cov.routed.length,
      allottedCount: x.cov.allotted.length,
      partial: x.cov.allotted.length > 0,
      reason: jobLaneBlockReason(x.job.id)
        || (x.cov.allotted.length
          ? x.cov.missing.length + " item" + (x.cov.missing.length === 1 ? "" : "s") + " still without a lane"
          : "No lane yet — clear to allot")
    }));
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
    const reason = "nothing to work on. The material is short and no lane is booked; overtime cannot cut boards that are not there.";
    // Persisted as a refusal rather than thrown away: "nothing recoverable"
    // is a real pattern, and it only shows if the refusals are countable.
    overtimeShifts.push({
      id: nextPrdId("OT", overtimeShifts),
      crewId, date, hours: Number(hours), men: Number(men),
      recoversTarget, cause, byWhom, bookedOn: prdToday(),
      status: "refused", refusedReason: reason
    });
    return { error: "Refused — " + reason };
  }
  const shift = {
    id: nextPrdId("OT", overtimeShifts),
    crewId, date, hours: Number(hours), men: Number(men),
    recoversTarget, cause, byWhom, bookedOn: prdToday(), status: "booked"
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
  // A refused shift was never worked, so it is not hours by cause.
  overtimeShifts.filter(o => o.date >= since && otWorked(o)).forEach(o => {
    by[o.cause] = (by[o.cause] || 0) + o.hours;
  });
  return Object.keys(by).map(k => ({ cause: k, hours: by[k] })).sort((a, b) => b.hours - a.hours);
}

// ═══ 5. Typed input requests ════════════════════════════════════════════
// Two different questions from two different askers, answered two different
// ways. The type is bound to the asker’s role so the client is not the thing
// keeping them apart.
//
//  pricing_input     — the ESTIMATOR, on a quote that is not sold yet. How
//                      long does the work take? Answered with hours and
//                      quantities through answerInputRequest(); never a price.
//  bom_budget_input  — OPERATIONS, on a job that is already approved. Build
//                      the job’s BOM so the project budget can be set before
//                      work starts. Answered by the department budget
//                      EXISTING, through closeInputRequestWithBudget() — see
//                      the note there for why a BOM must never travel as an
//                      answer payload.
const INPUT_REQUEST_TYPES = {
  pricing_input: { raiserRole: "estimator", label: "Pricing input" },
  bom_budget_input: { raiserRole: "operations_manager", label: "Job BOM for budgeting" }
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
// Quantities, hours and flags — never money. Keep it that way: this list is
// the client-side half of commitment 3, and a Postgres trigger enforces the
// other half. That trigger matches key names by SUBSTRING against
// (rate|price|cost|amount|margin|total|bd|money|value), so a name like
// "bdCount" would be refused by the database and by nothing else here.
const INPUT_ANSWER_FIELDS = ["manHours", "men", "days", "quantity", "machineHours",
  "boards", "veneerSheets", "processDays", "wastagePct", "isEstimate", "note"];
function answerInputRequest(reqId, payload, byWhom = "Production Manager") {
  const r = inputRequests.find(x => x.id === reqId);
  if (!r) return { error: "Request not found." };
  if (r.status !== "open") return { error: "Already answered." };
  if (!payload || !Object.keys(payload).length) return { error: "An empty answer helps nobody." };
  // A budgeting request is answered by the budget existing, not by a payload.
  // Routing a BOM through here would carry rates and amounts, which this
  // whitelist refuses and a Postgres trigger refuses again — both correctly.
  if (r.type === "bom_budget_input") {
    return { error: "A budgeting request is answered by submitting the department's BOM, not by returning figures." };
  }
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

/**
 * Close a budgeting request by pointing at the budget that answers it.
 *
 * What is stored is a POINTER, never a number from the BOM. That is why this
 * is a separate function rather than a wider whitelist: the money belongs on
 * the department budget, where Operations approves it, and never in an answer
 * payload — which the client whitelist and the database trigger both refuse.
 *
 * Key names matter here: that trigger matches by SUBSTRING against
 * (rate|price|cost|amount|margin|total|bd|money|value), so a name like
 * "bdRef" would be refused live and nowhere else. These two are clean.
 */
function closeInputRequestWithBudget(reqId, { jobCardId, deptKey } = {}, byWhom = "Production Manager") {
  const r = inputRequests.find(x => x.id === reqId);
  if (!r) return { error: "Request not found." };
  if (r.type !== "bom_budget_input") {
    return { error: "Only a budgeting request is answered with a budget. A pricing request is answered with hours and quantities." };
  }
  if (r.status !== "open") return { error: "Already answered." };
  const job = typeof getJobCard === "function" ? getJobCard(jobCardId) : null;
  const entry = job && job.departmentBudgets && job.departmentBudgets[deptKey];
  if (!entry || entry.approvalStatus === "not-submitted") {
    return { error: "Nothing to point at — submit the department's BOM first." };
  }
  r.answer = { jobCardRef: jobCardId, departmentRef: deptKey };
  r.answeredBy = byWhom;
  r.answeredOn = prdToday();
  r.status = "answered";
  return r;
}

/**
 * A starting point for the budget BOM, from the estimator's own costing.
 *
 * Rates are re-read from the Item Master rather than copied off the
 * quotation: a job costed three months ago must not silently become today's
 * budget. Where the two differ, it says so rather than quietly using one.
 * Labour comes back as days x men with NO rate — that is the whole point.
 */
function seedDepartmentBudgetLinesFromEstimate(jobId, deptKey) {
  const out = { materials: [], labour: [], notes: [] };
  const byItem = {};
  safe0(function () {
    jobBOMItems(jobId).forEach(function (it) {
      if ((it.departmentSequence || []).indexOf(deptKey) === -1) return;
      ((it.bom && it.bom.materials) || []).forEach(function (m) {
        if (!m.itemId) return;
        byItem[m.itemId] = (byItem[m.itemId] || 0) + (Number(m.qty) || 0);
        const master = (typeof itemMaster !== "undefined" ? itemMaster : []).find(function (x) { return x.id === m.itemId; });
        const now = master ? (Number(master.cost) || Number(master.lastPurchaseRate) || 0) : 0;
        if (master && Number(m.rate) && Math.abs(Number(m.rate) - now) > 0.0005
          && out.notes.indexOf(master.name) === -1) {
          out.notes.push(master.name + " was quoted at " + Number(m.rate).toFixed(3) +
            ", the Item Master says " + now.toFixed(3) + ".");
        }
      });
      ((it.bom && it.bom.labour) || []).forEach(function (l) {
        if (l.department && l.department !== deptKey) return;
        const men = Number(l.noOfPpl) || 1;
        let days = Number(l.qty) || 0;
        if (l.calcMode === "hours") {
          days = Math.round((days / 8) * 10) / 10;
          if (out.notes.indexOf("hours") === -1) {
            out.notes.push("Estimated hours converted at 8 hours to the day.");
          }
        }
        out.labour.push({ task: (l.empCategory || "Work") + " — " + (it.product || ""), men, days });
      });
    });
  });
  Object.keys(byItem).forEach(function (id) {
    const master = (typeof itemMaster !== "undefined" ? itemMaster : []).find(function (x) { return x.id === id; });
    if (!master) return;
    out.materials.push({
      itemId: id, name: master.name, unit: master.unit, qty: byItem[id],
      rate: Number(master.cost) || Number(master.lastPurchaseRate) || 0
    });
  });
  return out;
}
function safe0(fn) { try { return fn(); } catch (e) { return null; } }

/**
 * What the estimator allowed, as the production manager is permitted to see it.
 *
 * THE MONEY BOUNDARY LIVES HERE, not in the screen that draws it. Material
 * money is in scope for this role — Item Master cost is already on his own
 * form, and what the estimator allowed for material is the same class of
 * number. Labour money is NOT: he knows the man-days, so a labour cost beside
 * them is the floor rate one division away. So labour comes back as man-days
 * and never as an amount, and nothing here reads sellingPrice, profit or
 * margin at all. A screen cannot leak what it is never handed.
 *
 * SALMAN, 26 Aug 2026 — the fact this is built around: "the estimator doesn't
 * put all the items for the quote, he roughly calculates and puts the material
 * cost and labour cost as two line items lumpsum." So a line-by-line material
 * comparison is often impossible, and a comparison that only worked line by
 * line would read as empty on most real jobs. Three levels come back instead,
 * and the screen uses whichever the estimate actually supports:
 *
 *   per ITEM   — always real. The estimator's BOM hangs off the quotation
 *                ITEM, so even a two-line lump sum gives a material figure
 *                and man-days for that item.
 *   per CODE   — real only where he itemised. Matched on itemId, so it is a
 *                fact rather than a guess; absent where he did not.
 *   TOTALS     — always real, and what a lump-sum estimate is compared on.
 *
 * `itemisedLines` vs `itemCount` is reported rather than guessed at with a
 * heuristic, so the screen can say plainly how thin the estimate is instead of
 * showing an empty column that reads like the estimator forgot.
 *
 * Subcontract / hiring / others come back as ONE figure, `otherCost`. The
 * production form deliberately does not offer those categories (money somebody
 * else commits), so a budget that ignores them would otherwise look bigger
 * than the estimate for no reason a reader could see.
 */
function getEstimateComparisonForDepartment(jobId, deptKey) {
  const out = {
    items: [], byCode: {},
    totals: { materialCost: 0, manDays: 0, otherCost: 0, itemisedLines: 0, itemCount: 0 },
    hasEstimate: false
  };
  const job = typeof getJobCard === "function" ? getJobCard(jobId) : null;
  if (!job) return out;

  // The photo and the description live on the QUOTATION item — the job card
  // deliberately does not copy them (see confirmQuotationToJobCard). Resolved
  // at read time by lineId, the same way jobBOMItems() resolves the BOM,
  // rather than widening what a job card stores.
  const qtn = (typeof quotations !== "undefined")
    ? quotations.find(q => q.id === job.quotationId) : null;
  const qItems = (qtn && qtn.items) || [];

  safe0(function () {
    jobBOMItems(jobId).forEach(function (it) {
      if ((it.departmentSequence || []).indexOf(deptKey) === -1) return;
      const src = qItems.find(x => x.lineId === it.lineId) || {};
      const bom = it.bom || null;
      const row = {
        lineId: it.lineId, product: it.product, qty: Number(it.qty) || 0,
        unit: it.unit || "Nos",
        imageUrl: src.imageUrl || null,
        description: src.description || "",
        hasBOM: !!bom, materialCost: 0, manDays: 0, otherCost: 0, materialLines: 0
      };
      out.totals.itemCount++;

      ((bom && bom.materials) || []).forEach(function (m) {
        const amt = Number(m.amount) || (Number(m.qty) || 0) * (Number(m.rate) || 0);
        row.materialCost += amt;
        row.materialLines++;
        out.totals.itemisedLines++;
        if (!m.itemId) return;   // free text or an older import — no code to match on
        const c = out.byCode[m.itemId] || (out.byCode[m.itemId] = { qty: 0, cost: 0, name: m.name, unit: m.unit || "" });
        c.qty += Number(m.qty) || 0;
        c.cost += amt;
      });

      ((bom && bom.labour) || []).forEach(function (l) {
        if (l.department && l.department !== deptKey) return;
        const men = Number(l.noOfPpl) || 1;
        let days = Number(l.qty) || 0;
        // Same 8-hours-to-the-day conversion seedDepartmentBudgetLinesFromEstimate
        // uses, so the pulled lines and the comparison can never disagree.
        if (l.calcMode === "hours") days = Math.round((days / 8) * 10) / 10;
        row.manDays += men * days;
        // l.rate and l.amount are deliberately NOT read.
      });

      ["subcontract", "hiring", "others"].forEach(function (k) {
        ((bom && bom[k]) || []).forEach(function (r) { row.otherCost += Number(r.amount) || 0; });
      });

      row.materialCost = Math.round(row.materialCost * 1000) / 1000;
      row.manDays = Math.round(row.manDays * 10) / 10;
      row.otherCost = Math.round(row.otherCost * 1000) / 1000;
      if (bom) out.hasEstimate = true;
      out.items.push(row);
    });
  });

  out.items.forEach(function (r) {
    out.totals.materialCost += r.materialCost;
    out.totals.manDays += r.manDays;
    out.totals.otherCost += r.otherCost;
  });
  out.totals.materialCost = Math.round(out.totals.materialCost * 1000) / 1000;
  out.totals.manDays = Math.round(out.totals.manDays * 10) / 10;
  out.totals.otherCost = Math.round(out.totals.otherCost * 1000) / 1000;
  return out;
}

/**
 * How much of the estimate is actually itemised, reported as a fact rather
 * than judged by a heuristic: an item with no material line of its own was
 * covered by somebody else's line, so the EST column can have nothing to show
 * for it. `bare` counts those items.
 *
 * The distinction matters on screen. An earlier version compared line COUNT
 * against item count and told the reader to "compare on the totals, not row by
 * row" — which is wrong whenever one item carries a real parts list and
 * another carries none: the EST column is populated and the note says to
 * ignore it. What is true in that case is narrower, and that is what the
 * screen now says.
 */
function estimateCoverage(cmp) {
  if (!cmp || !cmp.hasEstimate) return { bare: 0, total: 0, thin: false };
  const bare = cmp.items.filter(function (r) { return !r.materialLines; }).length;
  return { bare: bare, total: cmp.totals.itemCount, thin: bare > 0 };
}

/** The plain question the screen asks: is any item left uncovered? */
function estimateIsLumpSum(cmp) {
  return estimateCoverage(cmp).thin;
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

// ═══ Dashboard readers the handoff's cards need ════════════════════════
// A crew's target out date: the earliest promised/target date across the jobs
// it is actually working. Derived, never typed — a target the board invented
// would be a date somebody promises a client.
function crewTarget(crewId) {
  const ids = [...new Set(laneSlots.filter(s => s.crewId === crewId).map(s => s.jobCardId))];
  const dates = ids.map(id => {
    const j = typeof getJobCard === "function" ? getJobCard(id) : null;
    return j ? (j.promisedDate || j.targetDate) : null;
  }).filter(Boolean).sort();
  if (!dates.length) return { date: null, tone: "wine", label: "No target date yet" };
  const soonest = dates[0];
  const today = todayISO();
  // Late is bad; inside a week with the lane already over its five days is
  // also bad, because the days left cannot hold the work.
  const booked = laneSlots.filter(s => s.crewId === crewId && s.kind === "work").length;
  if (soonest < today) return { date: soonest, tone: "bad", label: "past its date" };
  if (booked > 5) return { date: soonest, tone: "bad", label: "misses on day work" };
  return { date: soonest, tone: "ok", label: "on track" };
}

// Is a crew standing there with nothing it can start? That is the board's
// `blocked` cell — "crew there, nothing to work on" — and it is true when work
// routed to that crew's department is sitting in the waiting strip.
function crewBlockedReason(crewId) {
  const crew = crews.find(c => c.id === crewId);
  if (!crew) return null;
  const waiting = getWaitingForLane().filter(w =>
    (w.missing || []).some(id => {
      const it = (w.job.items || []).find(x => Number(x.lineId) === Number(id));
      return it && (it.departmentSequence || []).indexOf(crew.dept) !== -1;
    }));
  if (!waiting.length) return null;
  return waiting[0].reason;
}

// Sheets saved by batching. Pressed alone, each job rounds up to whole sheets;
// batched, the run shares them. A real saving only shows once part-sheets are
// recorded — with whole numbers this is honestly 0 rather than a flattering
// guess, which is the same call getStockReport() makes about move costs.
function veneerSheetsSaved() {
  return pressingBatches.reduce((total, b) => {
    const jobs = b.jobs || [];
    if (jobs.length < 2) return total;
    const alone = jobs.reduce((s, j) => s + Math.ceil(Number(j.sheets) || 0), 0);
    const together = Math.ceil(jobs.reduce((s, j) => s + (Number(j.sheets) || 0), 0));
    return total + Math.max(0, alone - together);
  }, 0);
}

// Overtime hours inside the displayed week, not a rolling month — the card
// the handoff scopes to the week.
function overtimeHoursInWeek(weekDates) {
  return overtimeShifts
    // Refusals are recorded but never worked — counting them would report
    // paid hours that nobody was paid for.
    .filter(o => (weekDates || []).indexOf(o.date) !== -1 && otWorked(o))
    .reduce((s, o) => s + (Number(o.hours) || 0), 0);
}

// Cloud-backed since 19 Aug 2026 — all six arrays are registered in
// CLOUD_JSON_COLLECTIONS (data.js) and ride the same snapshot-diff autosave
// every other collection uses. Two of the five commitments are enforced
/**
 * Confirming a site fit. It stays provisional until paint is actually
 * finished — confirming it early only moves the disappointment to the
 * client, so the refusal is the point of the function rather than a
 * validation on top of it.
 */
function confirmInstallationSlot(slotId, byWhom = "Production Manager", override = false) {
  const s = laneSlots.find(x => x.id === slotId);
  if (!s) return { error: "Which site fit?" };
  const crew = crews.find(c => c.id === s.crewId) || {};
  if (crew.dept === "paint") return { error: "That is a booth day, not a site fit." };
  if (s.confirmed) return { error: "Already confirmed." };
  // Paint is whatever paint slot the same job holds. No paint slot at all
  // means paint is not scheduled, which is the gate's own blocked option.
  const paint = laneSlots.filter(x => x.jobCardId === s.jobCardId)
    .filter(x => (crews.find(c => c.id === x.crewId) || {}).dept === "paint");
  if (!paint.length && !override) {
    return { error: "Paint is not scheduled. A site fit confirmed before paint has a date is a promise nobody made." };
  }
  const last = paint.map(p => slotDate(p)).sort().pop();
  if (last && last >= slotDate(s) && !override) {
    return { error: "Paint runs to " + last + " and the fit is booked " + slotDate(s) +
      ". Installation pulls its date from paint — move the fit, or move paint." };
  }
  s.confirmed = true;
  s.confirmedBy = byWhom;
  s.confirmedOn = prdToday();
  if (typeof logActivity === "function") {
    logActivity({
      type: "install-confirmed", linkedType: "job", linkedId: s.jobCardId, user: byWhom,
      message: "Site fit confirmed for " + slotDate(s)
    });
  }
  return s;
}

/* ═══════════════════════════════════════════════════════════════════════
   Page readers (19a Phase 2). Every one derives from records that already
   exist — no page introduces state of its own.
   ═══════════════════════════════════════════════════════════════════════ */


/** Week board page: one row per lane, then one per job refused a lane. */
function getBoardPageRows(weekDates) {
  const rows = [];
  crews.forEach(c => {
    const week = getCrewWeek(c.id, weekDates) || [];
    const booked = week.filter(d => d.slots && d.slots.length).length;
    rows.push({
      kind: "lane", id: c.id, name: c.name, sub: crewCapacityLine(c),
      booked, of: 5, targetOut: crewTarget(c.id),
      st: booked === 0 ? "bad" : booked >= 4 ? "ok" : "warn",
      state: booked + " of 5 days"
    });
  });
  getWaitingForLane().forEach(w => rows.push({
    kind: "refused", id: w.job.id, name: w.job.id + " — refused a lane",
    sub: w.reason, targetOut: w.job.targetDate || null, st: "bad", state: "No lane"
  }));
  return rows;
}

/** Requests, split by who may raise them. The page never mixes the two. */
function getInputRequestsOfType(type) {
  return inputRequests.filter(r => r.type === type)
    .sort((a, b) => String(a.neededBy || "9999").localeCompare(String(b.neededBy || "9999")));
}

/** BOM changes: each revision and the cutting lists it killed. */
function getBOMChangeRows() {
  return bomRevisions.slice().reverse().map(r => {
    // A sheet is killed BY a revision, which stamps killedByRevision on it.
    // Comparing revision letters breaks while one is still pending.
    const killed = cuttingSheets.filter(sh => sh.killedByRevision === r.id);
    const outstanding = killed.filter(sh => !sh.confirmedOffSaw);
    return {
      id: r.id, jobCardId: r.jobCardId, rev: r.letter || "pending", status: r.status,
      killed: killed.length, outstanding: outstanding.length,
      sheets: killed.map(sh => sh.id),
      st: outstanding.length ? "bad" : r.status === "draft" ? "warn" : "ok",
      state: outstanding.length ? outstanding.length + " still on a saw"
        : r.status === "draft" ? "Draft" : "Issued"
    };
  });
}

function prdDayName(iso) {
  if (!iso) return "on the day booked";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" });
}

/**
 * Material and reservations. One row per material across every routed,
 * unfinished job, with free-of-need read live off 18a stock. The
 * consequence line is the point of the row: a number nobody can act on is
 * not a reason to walk to the store.
 */
function getMaterialRows() {
  const rows = [];
  const jobs = (typeof jobCards !== "undefined" ? jobCards : [])
    .filter(j => j.routingConfirmed && j.status !== "cancelled");
  jobs.forEach(job => {
    jobBOMItems(job.id).forEach(it => {
      ((it.bom && it.bom.materials) || []).forEach(m => {
        if (!m.itemId) return;
        const need = Number(m.qty) || 0;
        if (!need) return;
        const held = typeof reservedToThisJob === "function" ? reservedToThisJob(m.itemId, null, job.id) : 0;
        const free = typeof stockFree === "function" ? stockFree(m.itemId, null) : 0;
        const have = Math.min(need, held + free);
        const item = (typeof itemMaster !== "undefined" ? itemMaster : []).find(x => x.id === m.itemId) || {};
        const slot = laneSlots.find(s => s.kind === "work" && s.jobCardId === job.id
          && slotLineIds(s).indexOf(Number(it.lineId)) !== -1);
        const crew = slot ? crews.find(c => c.id === slot.crewId) : null;
        const unit = item.unit || m.unit || "";
        rows.push({
          itemId: m.itemId, name: item.name || m.name || m.itemId, unit,
          jobCardId: job.id, need, held, free, have,
          st: held >= need ? "ok" : have >= need ? "warn" : "bad",
          // Reserve is tri-state: nothing left to hold is not the same as
          // already held, and the button must not pretend otherwise.
          reserve: held >= need ? "done" : free > 0 ? "can" : "none",
          consequence: held >= need
            ? "Held for this job. Nobody else can take it."
            : have >= need
              ? "On the shelf but not held — another job can take it first."
              : crew
                ? crew.name + " idles " + prdDayName(slot ? slotDate(slot) : null) + " without the other " + (need - have) + " " + unit + "."
                : "Short " + (need - have) + " " + unit + " — this job cannot take a lane."
        });
      });
    });
  });
  return rows;
}

/** Cutting lists: live sheets and what is on which saw. */
function getCuttingListRows() {
  return cuttingSheets.slice().reverse().map(sh => ({
    id: sh.id, jobCardId: sh.jobCardId, rev: sh.revisionLetter || "—", saw: sh.saw || "",
    lines: (sh.lines || []).length, status: sh.status,
    st: sh.status === "dead" && !sh.confirmedOffSaw ? "bad"
      : sh.status === "on-saw" ? "plain" : sh.status === "off-saw" ? "ok" : "wine",
    state: sh.status === "dead" ? (sh.confirmedOffSaw ? "Dead, off the saw" : "Dead, still on a saw")
      : sh.status === "on-saw" ? "On " + (sh.saw || "a saw") : sh.status === "off-saw" ? "Off the saw" : "Released"
  }));
}

/** Veneer pressing: batches by veneer, and the sheets each run saves. */
function getPressRows() {
  return pressingBatches.slice().reverse().map(b => {
    const jobs = b.jobs || [];
    const sheets = jobs.reduce((a, j) => a + (Number(j.sheets) || 0), 0);
    return {
      id: b.id, veneer: b.veneer || "", jobs: jobs.length, sheets,
      saved: Math.max(0, jobs.length - 1), status: b.status,
      st: b.status === "open" ? "warn" : "ok",
      state: b.status === "open" ? "Open — still collecting" : "Pressed"
    };
  });
}

/** Paint and installation both read pulled slots; they differ by crew. */
function getPulledSlotRows(dept) {
  return laneSlots.filter(s => s.kind === "pull").map(s => {
    const crew = crews.find(c => c.id === s.crewId) || {};
    if (crew.dept !== dept) return null;
    const base = laneSlots.find(x => x.id === s.baseSlotId);
    return {
      id: s.id, jobCardId: s.jobCardId, crewId: s.crewId, crew: crew.name,
      date: slotDate(s), pulledFrom: base ? slotDate(base) : null,
      booked: !!s.confirmed, st: s.confirmed ? "ok" : "warn",
      state: s.confirmed ? "Booked" : "Provisional"
    };
  }).filter(Boolean);
}

/** Overtime, refusals included — a refusal is a fact about the week too. */
function getOvertimeRows() {
  return overtimeShifts.slice().reverse().map(o => ({
    id: o.id, crewId: o.crewId, crew: crewName(o.crewId), date: o.date,
    hours: o.hours, men: o.men, recoversTarget: o.recoversTarget, cause: o.cause,
    refused: !otWorked(o), refusedReason: o.refusedReason || "",
    st: !otWorked(o) ? "bad" : o.cause === "BOM revision late" ? "bad" : "warn",
    state: !otWorked(o) ? "Refused" : o.hours + " h × " + o.men
  }));
}

/** Four weeks by cause, plus the refusals, for the overtime side card. */
function getOvertimeCauseSummary(weeks = 4) {
  const from = addDaysISO(prdToday(), -7 * weeks);
  const rows = OVERTIME_CAUSES.map(c => ({ cause: c, hours: 0 }));
  let refused = 0;
  overtimeShifts.forEach(o => {
    if (o.date < from) return;
    if (!otWorked(o)) { refused++; return; }
    const r = rows.find(x => x.cause === o.cause);
    if (r) r.hours += (Number(o.hours) || 0) * (Number(o.men) || 1);
  });
  rows.sort((a, b) => b.hours - a.hours);
  return { rows, refused, weeks };
}

/**
 * Reminders, production-scoped. Derived rather than stored, and every row
 * points at a crew waiting — a reminder nobody is waiting on is a to-do,
 * and those already live in the shared tasks widget.
 */
function getProductionReminders() {
  const out = [];
  getWaitingForLane().forEach(w => {
    const first = (w.job.items || []).find(x => Number(x.lineId) === Number((w.missing || [])[0]))
      || (w.job.items || [])[0] || {};
    const dept = first.departmentSequence || [];
    const crew = crews.find(c => dept.indexOf(c.dept) !== -1);
    out.push({ ref: w.job.id, what: w.reason, waiting: crew ? crew.name : "the shop", st: "bad" });
  });
  cuttingSheets.forEach(sh => {
    if (sh.status === "dead" && !sh.confirmedOffSaw) {
      out.push({ ref: sh.id, what: "Cut from a superseded revision — confirm it off the saw",
        waiting: sh.saw || "the saw", st: "bad" });
    }
  });
  laneSlots.filter(s => s.kind === "pull" && !s.confirmed).forEach(s => {
    const crew = crews.find(c => c.id === s.crewId) || {};
    out.push({ ref: s.jobCardId, what: "Provisional " + (crew.dept === "paint" ? "booth day" : "site fit") + " on " + slotDate(s),
      waiting: crew.name || "", st: "warn" });
  });
  return out;
}

/**
 * Documents filed against a job card. Derived from the paperwork that
 * actually exists rather than a new register — a register kept in step by
 * hand goes stale, and then it lies.
 */
function getProductionDocuments() {
  const out = [];
  bomRevisions.forEach(r => out.push({ jobCardId: r.jobCardId, kind: "BOM revision",
    ref: r.id + " · rev " + (r.letter || "pending"), when: r.issuedOn || r.date || "",
    st: r.status === "draft" ? "warn" : "ok", state: r.status === "draft" ? "Draft" : "Issued" }));
  cuttingSheets.forEach(sh => out.push({ jobCardId: sh.jobCardId, kind: "Cutting list",
    ref: sh.id + (sh.saw ? " · " + sh.saw : ""), when: sh.date || "",
    st: sh.status === "dead" && !sh.confirmedOffSaw ? "bad" : "ok",
    state: sh.status === "dead" ? "Superseded" : "Live" }));
  pressingBatches.forEach(b => (b.jobs || []).forEach(j => out.push({ jobCardId: j.jobCardId,
    kind: "Press batch", ref: b.id + " · " + (b.veneer || ""), when: b.date || "",
    st: "ok", state: b.status === "open" ? "Open" : "Pressed" })));
  return out.sort((a, b) => String(b.when).localeCompare(String(a.when)));
}

// server-side as well (overtime needs a cause from the closed enum; an
// answer carrying anything money-shaped is refused). The other two need to
// read across job cards, quotations and stock, which live as jsonb here —
// see supabase/19a-production.sql for why they stay client-side.
