/* ==========================================================================
   upholstery-data.js — 20a Upholstery supervisor: the DATA layer
   ==========================================================================
   Traced from docs/design-handoffs/20a-upholstery.md (2 Sep 2026). The
   five design commitments live HERE, in the data, so no screen can tell a
   different story from the records:

     1. Nothing overtakes. Five stages in one fixed order — frames &
        carcase → foam & cutting → sewing room → upholstery bays →
        finishing & QC. A stage cannot be booked until the stage before it
        has an end date. Stages that inherit a start render `pull`.
     2. One suite, one dye lot, one lay. A fabric plan does not release
        unless every metre comes off a single roll.
     3. COM shortfall is the client's risk, in writing, the same day. Until
        the note is signed the cutting table refuses the job — nothing in
        this module can override it.
     4. He returns metres, grades and hours, never a price.
     5. Overtime buys hours, not material. A shift on a stage with nothing
        to work on is a paid idle day and is refused.

   Reuses rather than duplicates: jobs are jobCards[]; foam and fibre are
   18a's stock (stockFree()); supplier quotes are 17a's rfqs; pricing
   requests are 19a's inputRequests, tagged dept:'uph'. Fabric is NOT
   18a stock — the handoff is explicit that fabric is a batch, not a
   quantity: one roll, one dye lot, so the roll is modelled here.

   Loads after production-data.js and store-data.js (index.html order).
   ========================================================================== */

// ═══ The five stages ═══════════════════════════════════════════════════
// Names, capacity lines and monograms are the handoff's own. `men` is the
// establishment; the bodies come from uphStageMembers[] so the two can
// honestly disagree.
const UPH_STAGES = [
  { id: "F", key: "frames",    name: "1 · Frames & carcase",    mono: "FR", men: 3, capacity: "3 · frame shop",
    trades: ["Carpenter", "Carpenter / Driver", "Technician", "Helper"] },
  { id: "C", key: "cutting",   name: "2 · Foam & cutting",      mono: "FC", men: 2, capacity: "2 · cutting table",
    trades: ["Technician", "Upholsterer", "Tailor", "Helper"] },
  { id: "S", key: "sewing",    name: "3 · Sewing room",         mono: "SR", men: 4, capacity: "4 machinists · 3 machines",
    trades: ["Tailor", "Technician", "Helper"] },
  { id: "B", key: "bays",      name: "4 · Upholstery bays 1–2", mono: "UB", men: 6, capacity: "6 · bays 1 and 2",
    trades: ["Upholsterer", "Technician", "Helper"] },
  { id: "Q", key: "finishing", name: "5 · Finishing & QC",      mono: "FQ", men: 2, capacity: "2 · finishing bench",
    trades: ["Helper", "Technician", "Upholsterer"] }
];
const UPH_STAGE_IDS = UPH_STAGES.map(s => s.id);
function uphStage(id) { return UPH_STAGES.find(s => s.id === id) || null; }
function uphStageIndex(id) { return UPH_STAGE_IDS.indexOf(id); }
function uphPrevStage(id) { const i = uphStageIndex(id); return i > 0 ? UPH_STAGES[i - 1] : null; }

// The handoff's closed cause list for overtime. Same rule as 19a's:
// free text cannot be counted.
const UPH_OVERTIME_CAUSES = ["Fabric late", "Fabric changed", "COM shortfall", "Foam late", "Client change", "Frames late"];
const UPH_ROLL_USABLE_MM = 1400;   // 140cm roll
const UPH_REPEAT_MM = 320;         // one repeat per nap-matched line
const UPH_WASTAGE = 1.06;          // 6%

const uphStageSlots = [];   // stage allotments, work + pull
const uphOvertime = [];     // shifts, booked or refused
const uphSpecs = [];        // the standing recipes by piece type, with revisions
const fabricRolls = [];     // the roll IS the record: id, dye lot, metres, COM
const fabricHolds = [];     // metres held against a job card on a roll
const fabricPlans = [];     // cutting & sewing tickets, per job, per spec rev
const foamSchedules = [];   // density by part, with stock/quote state
const comNotes = [];        // signed shortfall notes — the flag with teeth
const uphStageMembers = []; // who stands at which stage

function nextUphId(prefix, arr) {
  const n = arr.reduce((mx, r) => {
    const m = String(r.id || "").match(/(\d+)$/);
    return m ? Math.max(mx, parseInt(m[1], 10)) : mx;
  }, 0);
  return prefix + "-" + String(n + 1).padStart(4, "0");
}
function uphToday() { return todayISO(); }

// ═══ Jobs on the floor ═════════════════════════════════════════════════
function uphJobLines(jobId) {
  const job = typeof getJobCard === "function" ? getJobCard(jobId) : null;
  if (!job) return [];
  return (job.items || []).filter(it => (it.departmentSequence || []).indexOf("uph") !== -1);
}
function uphLineEntry(it) {
  return (it.departmentStatuses || []).find(e => e.department === "uph") || null;
}
// Every routed, live job with upholstery work that is not finished.
function getUphSuites() {
  return (typeof jobCards === "undefined" ? [] : jobCards).filter(j =>
    j.status !== "cancelled" && j.routingConfirmed &&
    uphJobLines(j.id).some(it => { const e = uphLineEntry(it); return !e || e.status !== "done"; }));
}
// A piece type for a line, from its product name — the spec is keyed on it.
function uphPieceTypeFor(name) {
  const n = String(name || "").toLowerCase();
  // A suite is named by its biggest piece: "3-seater sofa + 2 armchairs"
  // is cut to the sofa spec, so the sofa test comes before the armchair one.
  if (/majlis/.test(n)) return "Majlis seating";
  if (/sofa|settee|couch|seater/.test(n)) return "3-seater sofa";
  if (/headboard|bed/.test(n)) return "Headboard";
  if (/armchair|arm chair/.test(n)) return "Armchair";
  if (/dining|chair/.test(n)) return "Dining chair";
  if (/bench|banquette|booth/.test(n)) return "Bench seat";
  if (/ottoman|pouf|stool/.test(n)) return "Ottoman";
  if (/cushion|bolster/.test(n)) return "Loose cushions";
  return null;
}

// ═══ The upholstery spec — a standard, not a job ═══════════════════════
// He owns the spec and edits it directly; operations is notified on save,
// not asked. A job-specific change must never edit the standard — that is
// the `spec` gate's warning — so a job change goes on the plan, never here.
function createUphSpec({ pieceType, panels = [], foam = [], metresPerPiece = 0, sewingHours = 0, bayHours = 0, byWhom = "Upholstery Supervisor", note = "" } = {}) {
  if (!pieceType) return { error: "A spec is for a type of piece — which?" };
  if (uphSpecs.some(s => s.pieceType === pieceType)) return { error: "A spec for " + pieceType + " exists. Revise it rather than starting a second standard." };
  const spec = {
    id: nextUphId("SPEC", uphSpecs), pieceType,
    rev: "A", status: "released",
    panels: panels.map(uphNormPanel), foam: foam.slice(),
    metresPerPiece: Number(metresPerPiece) || 0,
    sewingHours: Number(sewingHours) || 0, bayHours: Number(bayHours) || 0,
    revisions: [{ rev: "A", on: uphToday(), by: byWhom, note: note || "First release" }],
    updatedBy: byWhom, updatedOn: uphToday()
  };
  uphSpecs.push(spec);
  return spec;
}
function uphNormPanel(p) {
  return {
    panel: String(p.panel || "").trim(), fabric: p.fabric || "main",
    qty: Math.max(1, Number(p.qty) || 1), length: Number(p.length) || 0, width: Number(p.width) || 0,
    nap: !!p.nap, note: p.note || ""
  };
}
function nextRevLetter(rev) { return String.fromCharCode((rev || "A").charCodeAt(0) + 1); }
// Revising the standard reprices every future quote of that piece — the
// `spec` gate's `warn`. Operations hears about it; nobody is asked first.
function reviseUphSpec(specId, patch = {}, byWhom = "Upholstery Supervisor", note = "") {
  const spec = uphSpecs.find(s => s.id === specId);
  if (!spec) return { error: "Which spec?" };
  if (!note || !note.trim()) return { error: "Why is the standard changing? The reason travels with the revision." };
  if (patch.panels) spec.panels = patch.panels.map(uphNormPanel);
  if (patch.foam) spec.foam = patch.foam.slice();
  ["metresPerPiece", "sewingHours", "bayHours"].forEach(k => { if (patch[k] !== undefined) spec[k] = Number(patch[k]) || 0; });
  spec.rev = nextRevLetter(spec.rev);
  spec.revisions.push({ rev: spec.rev, on: uphToday(), by: byWhom, note: note.trim() });
  spec.updatedBy = byWhom; spec.updatedOn = uphToday();
  if (typeof logActivity === "function") {
    logActivity({ type: "uph-spec-revised", linkedType: "spec", linkedId: spec.id, user: byWhom,
      message: spec.pieceType + " spec revised to rev " + spec.rev + " — every future quote inherits it", reason: note.trim() });
  }
  if (typeof sendMessage === "function") {
    try { sendMessage(byWhom, "Operations Manager", "Upholstery spec " + spec.pieceType + " is now rev " + spec.rev + ": " + note.trim(), "spec", spec.id); } catch (e) { /* fire and forget */ }
  }
  return spec;
}
function uphSpecForJob(jobId) {
  const job = typeof getJobCard === "function" ? getJobCard(jobId) : null;
  if (!job) return null;
  if (job.uphSpecId) return uphSpecs.find(s => s.id === job.uphSpecId) || null;
  const line = uphJobLines(jobId)[0];
  const type = line ? uphPieceTypeFor(line.product || line.name) : null;
  return type ? (uphSpecs.find(s => s.pieceType === type && s.status === "released") || null) : null;
}
function uphJobPieceCount(jobId) {
  return uphJobLines(jobId).reduce((a, it) => a + (Number(it.qty) || 1), 0);
}

// ═══ Fabric — the roll is the record ═══════════════════════════════════
function receiveFabricRoll({ name, widthCm = 140, dyeLot, metres, jobCardId = null, isCOM = false, clientName = "", costPerM = 0, itemId = null, byWhom = "Storekeeper" } = {}) {
  if (!name) return { error: "Which fabric?" };
  if (!dyeLot) return { error: "A roll with no dye lot is not a usable answer to \"can we cut this suite\" — record the lot." };
  if (!(Number(metres) > 0)) return { error: "How many metres landed?" };
  const roll = {
    id: nextUphId("R", fabricRolls), name, widthCm: Number(widthCm) || 140, dyeLot: String(dyeLot),
    metresLanded: Number(metres), jobCardId: jobCardId || null,
    isCOM: !!isCOM, clientName: clientName || "",
    costPerM: isCOM ? 0 : (Number(costPerM) || 0),   // COM has no cost to us
    itemId, receivedOn: uphToday(), receivedBy: byWhom,
    inspected: false, inspection: null
  };
  fabricRolls.push(roll);
  return roll;
}
function inspectFabricRoll(rollId, { ok = true, note = "", byWhom = "Upholstery Supervisor" } = {}) {
  const roll = fabricRolls.find(r => r.id === rollId);
  if (!roll) return { error: "Which roll?" };
  roll.inspected = !!ok;
  roll.inspection = { ok: !!ok, note, by: byWhom, on: uphToday() };
  return roll;
}
function rollMetresHeld(rollId) {
  return fabricHolds.filter(h => h.rollId === rollId && h.status === "held").reduce((a, h) => a + h.metres, 0);
}
function rollMetresFree(rollId) {
  const roll = fabricRolls.find(r => r.id === rollId);
  return roll ? Math.max(0, roll.metresLanded - rollMetresHeld(rollId)) : 0;
}
function holdFabricForJob({ rollId, jobCardId, metres, byWhom = "Upholstery Supervisor" } = {}) {
  const roll = fabricRolls.find(r => r.id === rollId);
  if (!roll) return { error: "Which roll?" };
  if (!jobCardId) return { error: "Held against which job card?" };
  if (!(Number(metres) > 0)) return { error: "How many metres?" };
  if (Number(metres) > rollMetresFree(rollId)) {
    return { error: "Only " + rollMetresFree(rollId) + " m free on " + rollId + ". Stock on the shelf is not stock you have." };
  }
  const hold = { id: nextUphId("HOLD", fabricHolds), rollId, jobCardId, metres: Number(metres), heldOn: uphToday(), heldBy: byWhom, status: "held" };
  fabricHolds.push(hold);
  return hold;
}
function releaseFabricHold(holdId, byWhom = "Upholstery Supervisor", reason = "") {
  const h = fabricHolds.find(x => x.id === holdId);
  if (!h) return { error: "Which hold?" };
  h.status = "released"; h.releasedOn = uphToday(); h.releasedBy = byWhom; h.releaseReason = reason;
  return h;
}
function jobFabricRolls(jobId) { return fabricRolls.filter(r => r.jobCardId === jobId); }
// What the job needs in metres: the live plan if there is one, else the
// spec's metres per piece × pieces. Never a guess when neither exists.
function jobFabricNeed(jobId) {
  const plan = jobLiveFabricPlan(jobId);
  if (plan) return plan.totalM;
  const spec = uphSpecForJob(jobId);
  return spec && spec.metresPerPiece ? Math.round(spec.metresPerPiece * uphJobPieceCount(jobId) * 10) / 10 : null;
}

// ═══ COM — the flag with teeth ═════════════════════════════════════════
function raiseCOMShortfallNote({ jobCardId, rollId, shortfallM, byWhom = "Upholstery Supervisor" } = {}) {
  const roll = fabricRolls.find(r => r.id === rollId);
  if (!roll) return { error: "Which roll?" };
  if (!roll.isCOM) return { error: roll.id + " is not the client's own material. A shortfall on our fabric is a purchase, not a note." };
  if (!(Number(shortfallM) > 0)) return { error: "How many metres short?" };
  const note = {
    id: nextUphId("COM", comNotes), jobCardId: jobCardId || roll.jobCardId, rollId,
    shortfallM: Number(shortfallM), raisedOn: uphToday(), raisedBy: byWhom,
    option: null, clientSignedBy: null, clientSignedOn: null,
    salesSignedBy: null, salesSignedOn: null
  };
  comNotes.push(note);
  return note;
}
const COM_OPTIONS = { more: "Client sends more material", join: "Client accepts a join", fewer: "Client accepts fewer pieces" };
function signCOMNote(noteId, { option, clientSignedBy } = {}) {
  const n = comNotes.find(x => x.id === noteId);
  if (!n) return { error: "Which note?" };
  if (!COM_OPTIONS[option]) return { error: "The client chooses one of: more material, a join, or fewer pieces." };
  if (!clientSignedBy) return { error: "Signed by whom, for the client?" };
  n.option = option; n.clientSignedBy = clientSignedBy; n.clientSignedOn = uphToday();
  return n;
}
function countersignCOMNote(noteId, salesBy) {
  const n = comNotes.find(x => x.id === noteId);
  if (!n) return { error: "Which note?" };
  if (!n.clientSignedBy) return { error: "The client signs first." };
  if (!salesBy) return { error: "Sales countersigns — who?" };
  n.salesSignedBy = salesBy; n.salesSignedOn = uphToday();
  return n;
}
function comNoteSigned(n) { return !!(n && n.clientSignedBy && n.salesSignedBy); }
// The cutting-table gate. Any COM roll on the job that is short of need
// with no fully signed note blocks — and nothing overrides it.
function comBlockReason(jobId) {
  const need = jobFabricNeed(jobId);
  for (const roll of jobFabricRolls(jobId)) {
    if (!roll.isCOM) continue;
    const short = need !== null ? Math.max(0, need - roll.metresLanded) : 0;
    if (short <= 0) continue;
    const signed = comNotes.some(n => n.rollId === roll.id && comNoteSigned(n));
    if (!signed) return "COM roll " + Math.round(short * 10) / 10 + " m short. Signed note before anyone cuts.";
  }
  return null;
}

// ═══ Foam — density is a spec, not a preference ════════════════════════
function uphItemFree(itemId) {
  if (typeof stockLots === "undefined" || typeof stockFree !== "function") return 0;
  const bins = [...new Set(stockLots.filter(l => l.itemId === itemId).map(l => l.binId))];
  return bins.reduce((a, b) => a + stockFree(itemId, b), 0);
}
function uphItemQuotes(itemId) {
  if (typeof rfqs === "undefined") return [];
  const out = [];
  rfqs.forEach(r => {
    if (!(r.lines || []).some(l => l.itemId === itemId)) return;
    (r.quotes || []).forEach(q => {
      const ln = (q.lines || []).find(l => l.itemId === itemId);
      out.push({ rfqId: r.id, supplierId: q.supplierId, supplierName: q.supplierName || q.supplierId,
        leadDays: q.leadDays, unitCost: ln ? ln.rate : null, awarded: r.status === "awarded" && r.awardedSupplierId === q.supplierId });
    });
  });
  return out;
}
function createFoamSchedule({ jobCardId, lines = [], byWhom = "Upholstery Supervisor" } = {}) {
  if (!jobCardId) return { error: "Which job card?" };
  if (!lines.length) return { error: "A foam schedule with no parts is not a schedule." };
  const spec = uphSpecForJob(jobCardId);
  for (const ln of lines) {
    if (!ln.part || !ln.grade) return { error: "Every line is a part and a grade." };
    // The grade comes from the spec. Nobody at the bench substitutes a
    // softer block because the right one is late.
    if (spec && spec.foam.length) {
      const sp = spec.foam.find(f => f.part.toLowerCase() === String(ln.part).toLowerCase());
      if (sp && sp.grade !== ln.grade) {
        return { error: "Density is a spec, not a preference. " + ln.part + " is " + sp.grade + " on the " + spec.pieceType + " spec; only operations changes it." };
      }
    }
  }
  const fs = {
    id: nextUphId("FS", foamSchedules), jobCardId,
    lines: lines.map(l => ({ part: l.part, grade: l.grade, itemId: l.itemId || null, qty: Math.max(1, Number(l.qty) || 1) })),
    raisedOn: uphToday(), raisedBy: byWhom, signedOff: false, signedOffBy: null
  };
  foamSchedules.push(fs);
  return fs;
}
// Derived, never typed: a schedule reads "blocked" when a grade is short
// with no quote back, "quoted" when short but a quote exists, "ready" when
// every block is on the shelf.
function foamScheduleState(fs) {
  let short = 0, quoted = 0;
  fs.lines.forEach(l => {
    if (!l.itemId) { short++; return; }
    const free = uphItemFree(l.itemId);
    if (free >= l.qty) return;
    if (uphItemQuotes(l.itemId).length) quoted++; else short++;
  });
  if (short) return { st: "bad", state: "Blocked", short, quoted };
  if (quoted) return { st: "warn", state: "Quoted", short, quoted };
  return { st: "ok", state: fs.signedOff ? "Signed off" : "Ready", short, quoted };
}
function signOffFoamSchedule(fsId, byWhom = "Upholstery Supervisor") {
  const fs = foamSchedules.find(x => x.id === fsId);
  if (!fs) return { error: "Which schedule?" };
  const st = foamScheduleState(fs);
  if (st.st === "bad") return { error: "Cannot sign off — " + st.short + " grade" + (st.short > 1 ? "s are" : " is") + " short with nothing quoted. Reserve, or take quotes." };
  fs.signedOff = true; fs.signedOffBy = byWhom; fs.signedOffOn = uphToday();
  return fs;
}
function jobFoamSchedule(jobId) {
  return foamSchedules.filter(f => f.jobCardId === jobId).slice(-1)[0] || null;
}

// ═══ The fabric plan — one suite, one dye lot, one lay ═════════════════
// The handoff's arithmetic, verbatim. The ticket's "Fabric to cut" is THIS
// figure — the print and the editor must never disagree.
function fabricPlanTotals(panels, rollMM = UPH_ROLL_USABLE_MM) {
  let layMM = 0, napRows = 0, napCount = 0, panelCount = 0, naive = 0;
  (panels || []).forEach(p => {
    const qty = Math.max(1, Number(p.qty) || 1), len = Number(p.length) || 0, wid = Number(p.width) || 0;
    const across = Math.max(1, Math.floor(rollMM / Math.max(1, wid)));
    layMM += Math.ceil(qty / across) * len;
    naive += qty * len;
    panelCount += qty;
    if (p.nap) { napRows++; napCount += qty; }
  });
  const repeatMM = napRows * UPH_REPEAT_MM;
  const totalM = Math.round(((layMM * UPH_WASTAGE + repeatMM) / 1000) * 10) / 10;
  return {
    panelCount, lines: (panels || []).length,
    layM: Math.round(layMM / 1000 * 10) / 10, napRows, napCount,
    repeatM: Math.round(repeatMM / 1000 * 10) / 10, totalM,
    savedM: Math.round((naive - layMM) / 1000 * 10) / 10   // what the single lay saves over cutting each panel on its own length
  };
}
function jobLiveFabricPlan(jobId) {
  return fabricPlans.filter(p => p.jobCardId === jobId && p.status === "live")[0] || null;
}
function jobPlanLetter(jobId) {
  const n = fabricPlans.filter(p => p.jobCardId === jobId).length;
  return String.fromCharCode(65 + n);
}
function planIdFor(jobId) {
  const digits = (String(jobId).match(/(\d+)$/) || ["", "0000"])[1].slice(-4);
  return "UT-" + digits + "-" + jobPlanLetter(jobId);
}
/**
 * Commitment 2 — the gate on the `plan` flow. Refuses unless the metres
 * come off ONE roll that is on site and inspected. Commitment 3 — refuses
 * a COM job with an unsigned shortfall, and nothing here overrides that.
 * Releasing supersedes the job's previous live plan; the old ticket stays
 * on the table (and blocks the saw) until somebody confirms it off.
 */
function releaseFabricPlan({ jobCardId, rollId, panels = [], byWhom = "Upholstery Supervisor", override = false } = {}) {
  if (!jobCardId) return { error: "Which job card?" };
  if (!uphJobLines(jobCardId).length) return { error: "Nothing on that job card is routed to upholstery." };
  const roll = fabricRolls.find(r => r.id === rollId);
  if (!roll) return { error: "Cannot release — which roll? A plan with no roll id and no dye lot is not a plan." };
  if (!roll.inspected) return { error: "Cannot release — " + roll.id + " has not been inspected. Receive and inspect it first." };
  if (roll.jobCardId && roll.jobCardId !== jobCardId) return { error: roll.id + " is held for " + roll.jobCardId + "." };
  const spec = uphSpecForJob(jobCardId);
  if (!spec) return { error: "Cannot release — no spec released for this piece. Operations still has it." };
  const rows = (panels && panels.length ? panels : spec.panels).map(uphNormPanel);
  if (!rows.length) return { error: "Nobody cuts to an empty ticket." };
  const t = fabricPlanTotals(rows, roll.widthCm * 10);
  const com = comBlockReason(jobCardId);
  if (com) return { error: "COM. We cannot buy more. Nobody cuts until the shortfall is signed. (" + com + ")" };
  // One roll, one lot: the whole suite must come off this roll's free metres.
  // The previous plan's own hold is released first — it is being replaced.
  const oldHeld = fabricHolds.filter(h => h.rollId === rollId && h.jobCardId === jobCardId && h.status === "held")
    .reduce((a, h) => a + h.metres, 0);
  const free = rollMetresFree(rollId) + oldHeld;
  if (t.totalM > free) {
    return { error: "Cannot release — " + t.totalM + " m needed, " + Math.round(free * 10) / 10 + " m on " + roll.id +
      ". The suite does not come off one roll, and a second lot on one suite is scrap." };
  }
  // Supersede, and hold the metres.
  const prev = fabricPlans.filter(p => p.jobCardId === jobCardId && p.status === "live");
  const plan = {
    id: planIdFor(jobCardId), jobCardId, specId: spec.id, specRev: spec.rev,
    rollId: roll.id, dyeLot: roll.dyeLot, fabricName: roll.name, isCOM: roll.isCOM,
    panels: rows, totals: t, totalM: t.totalM,
    status: "live", onTable: false, supersedes: prev.map(p => p.id),
    issuedOn: uphToday(), issuedBy: byWhom, bay: null
  };
  prev.forEach(p => { p.status = "superseded"; p.supersededBy = plan.id; p.supersededOn = uphToday(); });
  fabricHolds.filter(h => h.rollId === rollId && h.jobCardId === jobCardId && h.status === "held")
    .forEach(h => { h.status = "released"; h.releasedOn = uphToday(); h.releaseReason = "replaced by " + plan.id; });
  holdFabricForJob({ rollId, jobCardId, metres: t.totalM, byWhom });
  if (!roll.jobCardId) roll.jobCardId = jobCardId;
  fabricPlans.push(plan);
  if (typeof logActivity === "function") {
    logActivity({ type: "uph-plan-released", linkedType: "job", linkedId: jobCardId, user: byWhom,
      message: plan.id + " released — " + t.totalM + " m off " + roll.id + " lot " + roll.dyeLot + (prev.length ? ", kills " + prev.map(p => p.id).join(", ") : ""), dept: "uph" });
  }
  return plan;
}
function putPlanOnTable(planId) {
  const p = fabricPlans.find(x => x.id === planId);
  if (!p) return { error: "Which ticket?" };
  p.onTable = true; p.onTableSince = uphToday();
  return p;
}
// A dead ticket clears when the sheet is confirmed off the table — not
// when the new one is issued.
function confirmPlanOffTable(planId, byWhom = "Upholstery Supervisor") {
  const p = fabricPlans.find(x => x.id === planId);
  if (!p) return { error: "Which ticket?" };
  p.onTable = false; p.offTableBy = byWhom; p.offTableOn = uphToday();
  return p;
}
function jobDeadPlansOnTable(jobId) {
  return fabricPlans.filter(p => p.jobCardId === jobId && p.status === "superseded" && p.onTable);
}
function metresSavedBySingleLay() {
  return Math.round(fabricPlans.filter(p => p.status !== "superseded").reduce((a, p) => a + ((p.totals && p.totals.savedM) || 0), 0) * 10) / 10;
}

// ═══ Stage slots — nothing overtakes ═══════════════════════════════════
function uphSlotDate(slot) {
  if (slot.kind !== "pull") return slot.date;
  const base = uphStageSlots.find(s => s.id === slot.baseSlotId);
  if (!base) return slot.date || null;
  return addDaysISO(uphSlotDate(base), slot.offsetDays);
}
function uphJobStageSlots(jobId, stageId) {
  return uphStageSlots.filter(s => s.jobCardId === jobId && s.stageId === stageId);
}
// The end date of a stage for a job: its last booked day. Null = not booked.
function uphStageEnd(jobId, stageId) {
  const dates = uphJobStageSlots(jobId, stageId).map(uphSlotDate).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : null;
}
function uphStageStart(jobId, stageId) {
  const dates = uphJobStageSlots(jobId, stageId).map(uphSlotDate).filter(Boolean).sort();
  return dates.length ? dates[0] : null;
}
// The next stage a job needs booked: the first stage with no end date.
function uphNextStage(jobId) {
  for (const st of UPH_STAGES) if (!uphStageEnd(jobId, st.id)) return st;
  return null;
}
/**
 * Why a stage will not take this job. Commitment 1 (order) and, on the
 * cutting table, commitments 2 and 3 (fabric and COM) plus the foam
 * sign-off. Returns {reason, tone, form} or null when clear.
 */
function uphStageBlockReason(jobId, stageId) {
  const st = uphStage(stageId);
  if (!st) return { reason: "Which stage?", tone: "bad", form: "allot" };
  if (!uphJobLines(jobId).length) return { reason: "Nothing on this job card is routed to upholstery.", tone: "bad", form: "allot" };
  const spec = uphSpecForJob(jobId);
  if (!spec) return { reason: "No spec released yet — operations still has it", tone: "bad", form: "spec" };
  const prev = uphPrevStage(stageId);
  if (prev && !uphStageEnd(jobId, prev.id)) {
    return { reason: "Nothing overtakes — " + prev.name.replace(/^\d · /, "") + " has no end date yet", tone: "warn", form: "allot" };
  }
  if (stageId === "C") {
    const com = comBlockReason(jobId);
    if (com) return { reason: com, tone: "bad", form: "com" };
    const rolls = jobFabricRolls(jobId);
    if (!rolls.length) return { reason: "No fabric on site for this job", tone: "bad", form: "res" };
    if (!rolls.some(r => r.inspected)) return { reason: "Fabric landed, not inspected", tone: "warn", form: "res" };
    const plan = jobLiveFabricPlan(jobId);
    if (!plan) return { reason: "No fabric plan released — nothing for the table to follow", tone: "bad", form: "plan" };
    const dead = jobDeadPlansOnTable(jobId);
    if (dead.length) return { reason: dead[0].id + " is still on the table — take it off before the new lay goes on", tone: "bad", form: "plan" };
    const fs = jobFoamSchedule(jobId);
    if (!fs || !fs.signedOff) return { reason: "Foam grade not signed off", tone: "warn", form: "foam" };
  }
  return null;
}
function allotUphStageSlot({ stageId, jobCardId, date, portion = "full", lineIds = [], byWhom = "Upholstery Supervisor", provisional = false } = {}) {
  if (!uphStage(stageId)) return { error: "Which stage?" };
  if (!date) return { error: "Which day?" };
  if (!["full", "half"].includes(portion)) return { error: "Full day or half day." };
  const block = uphStageBlockReason(jobCardId, stageId);
  if (block) return { error: "Cannot book — " + block.reason + "." };
  const prev = uphPrevStage(stageId);
  if (prev) {
    const end = uphStageEnd(jobCardId, prev.id);
    if (end && date <= end) {
      return { error: "Nothing overtakes — " + prev.name.replace(/^\d · /, "") + " ends " + end + "; " + uphStage(stageId).name.replace(/^\d · /, "") + " cannot start before it." };
    }
  }
  const picked = [...new Set((lineIds || []).map(Number))];
  const slot = {
    id: nextUphId("USLOT", uphStageSlots), stageId, jobCardId, date, portion, kind: "work",
    lineIds: picked, byWhom, bookedOn: uphToday(), provisional: !!provisional
  };
  const clash = uphStageSlots.filter(s => s.kind === "work" && s.stageId === stageId && uphSlotDate(s) === date && s.jobCardId !== jobCardId);
  uphStageSlots.push(slot);
  return clash.length ? { slot, warning: "Two jobs on one stage that day — the board shows it as over." } : { slot };
}
// A pulled start: no date of its own, only the upstream slot and an offset.
function allotUphDerivedSlot({ stageId, baseSlotId, offsetDays, jobCardId, byWhom = "Upholstery Supervisor" } = {}) {
  const base = uphStageSlots.find(s => s.id === baseSlotId);
  if (!base) return { error: "Pulled from which slot?" };
  if (!uphStage(stageId)) return { error: "Which stage?" };
  if (uphStageIndex(stageId) <= uphStageIndex(base.stageId)) return { error: "A stage pulls its date from the stage BEFORE it, never after." };
  if (!(Number(offsetDays) >= 0)) return { error: "How many days after the upstream slot?" };
  const slot = {
    id: nextUphId("USLOT", uphStageSlots), stageId, jobCardId: jobCardId || base.jobCardId,
    kind: "pull", baseSlotId, offsetDays: Number(offsetDays), portion: "full", byWhom, bookedOn: uphToday(), provisional: true
  };
  uphStageSlots.push(slot);
  return { slot };
}
function moveUphSlot(slotId, newDate, byWhom = "Upholstery Supervisor") {
  const s = uphStageSlots.find(x => x.id === slotId);
  if (!s) return { error: "Which slot?" };
  if (s.kind === "pull") return { error: "A pulled slot has no date of its own — move the stage it pulls from." };
  const prev = uphPrevStage(s.stageId);
  if (prev) { const end = uphStageEnd(s.jobCardId, prev.id); if (end && newDate <= end) return { error: "Nothing overtakes — " + prev.name + " ends " + end + "." }; }
  s.date = newDate; s.movedBy = byWhom; s.movedOn = uphToday();
  return s;
}
function confirmUphSlot(slotId, byWhom = "Upholstery Supervisor") {
  const s = uphStageSlots.find(x => x.id === slotId);
  if (!s) return { error: "Which slot?" };
  const prev = uphPrevStage(s.stageId);
  if (prev && !uphStageEnd(s.jobCardId, prev.id)) return { error: "Cannot confirm — " + prev.name + " has no end date. The slot stays provisional." };
  s.provisional = false; s.confirmedBy = byWhom; s.confirmedOn = uphToday();
  return s;
}
// Suites a stage has refused, with the reason on them.
function getUphWaitingForStage() {
  const out = [];
  getUphSuites().forEach(job => {
    const next = uphNextStage(job.id);
    if (!next) return;
    const block = uphStageBlockReason(job.id, next.id);
    // uphNextStage() is the first stage with no end date, so the stage before
    // it always has one — an ordering wait can never be the reason here.
    if (block) out.push({ job, stage: next, reason: block.reason, tone: block.tone, form: block.form });
  });
  return out;
}
function uphStageLoad(stageId, weekDates) {
  const seen = {};
  uphStageSlots.forEach(s => {
    if (s.stageId !== stageId) return;
    const d = uphSlotDate(s);
    if (weekDates.indexOf(d) === -1) return;
    seen[d] = Math.max(seen[d] || 0, s.portion === "half" ? 0.5 : 1);
  });
  return Object.keys(seen).reduce((a, d) => a + seen[d], 0);
}

// ═══ Overtime — buys hours, not material ═══════════════════════════════
function bookUphOvertime({ stageId, date, hours, men, recoversTarget, cause, byWhom = "Upholstery Supervisor" } = {}) {
  if (!uphStage(stageId)) return { error: "Which stage?" };
  if (!date) return { error: "Which day?" };
  if (!(Number(hours) > 0)) return { error: "How many hours?" };
  if (!(Number(men) > 0)) return { error: "How many men?" };
  if (!recoversTarget) return { error: "Overtime is booked against the target it recovers — which job?" };
  if (!UPH_OVERTIME_CAUSES.includes(cause)) {
    return { error: "The cause of the slip is required — one of: " + UPH_OVERTIME_CAUSES.join(" · ") + "." };
  }
  const hasWork = uphJobStageSlots(recoversTarget, stageId).length > 0;
  const block = uphStageBlockReason(recoversTarget, stageId);
  if (!hasWork && block) {
    const reason = "nothing to work on. " + block.reason + " — overtime cannot fix that.";
    uphOvertime.push({ id: nextUphId("UOT", uphOvertime), stageId, date, hours: Number(hours), men: Number(men),
      recoversTarget, cause, byWhom, bookedOn: uphToday(), status: "refused", refusedReason: reason });
    return { error: "Refused — " + reason };
  }
  const shift = { id: nextUphId("UOT", uphOvertime), stageId, date, hours: Number(hours), men: Number(men),
    recoversTarget, cause, byWhom, bookedOn: uphToday(), status: "booked" };
  uphOvertime.push(shift);
  if (typeof logActivity === "function") {
    logActivity({ type: "overtime-booked", linkedType: "job", linkedId: recoversTarget, user: byWhom,
      message: shift.hours + "h × " + shift.men + " on " + uphStage(stageId).name + " " + date + " — recovers " + recoversTarget, reason: cause, dept: "uph" });
  }
  return shift;
}
function uphOvertimeHoursInWeek(weekDates) {
  return uphOvertime.filter(o => o.status === "booked" && weekDates.indexOf(o.date) !== -1).reduce((a, o) => a + o.hours, 0);
}
function getUphOvertimeByCause(daysBack = 28) {
  const since = addDaysISO(uphToday(), -daysBack);
  const by = {}; let refused = 0;
  uphOvertime.forEach(o => {
    if (o.date < since) return;
    if (o.status === "refused") { refused++; return; }
    by[o.cause] = (by[o.cause] || 0) + o.hours * o.men;
  });
  return { rows: Object.keys(by).map(c => ({ cause: c, hours: by[c] })).sort((a, b) => b.hours - a.hours), refused, weeks: Math.round(daysBack / 7) };
}

// ═══ Crews & labour — hours, never rates ═══════════════════════════════
// Seeded from the real upholstery staff on the payroll, once. Trades come
// from the real designation. No pay figure is read: designation is, rate
// is not. Fewer bodies than the establishment is reported, not invented.
function uphTradeFits(trade, stageId) {
  const st = uphStage(stageId);
  return !st || !trade ? true : st.trades.indexOf(trade) !== -1;
}
function buildUphRoster() {
  if (uphStageMembers.length) return uphStageMembers;
  if (typeof EMPLOYEE_RATES === "undefined") return uphStageMembers;
  const pool = Object.keys(EMPLOYEE_RATES)
    .filter(n => EMPLOYEE_RATES[n].category === "Production" && EMPLOYEE_RATES[n].department === "Upholstery")
    .map(n => ({ name: n, trade: typeof personTrade === "function" ? personTrade(n) : "" }));
  const want = { F: ["Carpenter", "Carpenter / Driver"], C: ["Technician"], S: ["Tailor", "Technician"], B: ["Upholsterer", "Technician", "Helper"], Q: ["Helper"] };
  const counts = { F: 2, C: 2, S: 2, B: 3, Q: 1 };   // 10 real men, spread to keep every stage manned
  UPH_STAGES.forEach(st => {
    const prefer = want[st.id] || st.trades;
    const fits = pool.filter(p => !p.taken && prefer.indexOf(p.trade) !== -1);
    const rest = pool.filter(p => !p.taken && uphTradeFits(p.trade, st.id));
    const picked = fits.concat(rest.filter(p => fits.indexOf(p) === -1)).slice(0, counts[st.id]);
    picked.forEach((p, i) => {
      p.taken = true;
      uphStageMembers.push({ id: "UMAN-" + String(uphStageMembers.length + 1).padStart(3, "0"), name: p.name, stageId: st.id, trade: p.trade, leader: i === 0 });
    });
  });
  pool.filter(p => !p.taken).forEach(p => uphStageMembers.push({
    id: "UMAN-" + String(uphStageMembers.length + 1).padStart(3, "0"), name: p.name, stageId: null, trade: p.trade, leader: false
  }));
  return uphStageMembers;
}
function getUphStageMembers(stageId) { return uphStageMembers.filter(m => m.stageId === stageId); }
function getUphCrewless() { return uphStageMembers.filter(m => !m.stageId); }
function uphStageLeader(stageId) { return uphStageMembers.filter(m => m.stageId === stageId && m.leader)[0] || null; }
function moveUphMan(personId, stageId, byWhom = "Upholstery Supervisor", override = false) {
  const man = uphStageMembers.find(m => m.id === personId);
  if (!man) return { error: "Who?" };
  if (stageId && !uphStage(stageId)) return { error: "Which stage?" };
  if (stageId && !uphTradeFits(man.trade, stageId) && !override) {
    return { error: "Trade does not match the stage. " + (man.trade || "No trade recorded") + " does not belong at " + uphStage(stageId).name + "." };
  }
  const from = man.stageId;
  man.stageId = stageId || null;
  if (!stageId) man.leader = false;
  if (typeof logActivity === "function") {
    logActivity({ type: "crew-assigned", linkedType: "stage", linkedId: stageId || from || "none", user: byWhom,
      message: man.name + (stageId ? " moved to " + uphStage(stageId).name : " taken out of a stage"), dept: "uph" });
  }
  return man;
}
// A man's state is DERIVED from what his stage is doing: wine = on a job
// today · plain = works this week, not today · bad = stage blocked with
// nothing to do (idle) · warn = waiting on the stage before · ok = free.
function uphManState(man, weekDates) {
  if (!man.stageId) return { tone: "bad", label: "No stage" };
  const today = uphToday();
  const mine = uphStageSlots.filter(s => s.stageId === man.stageId);
  if (mine.some(s => uphSlotDate(s) === today)) return { tone: "wine", label: "On a job" };
  if (mine.some(s => (weekDates || []).indexOf(uphSlotDate(s)) !== -1)) return { tone: "plain", label: "Other work" };
  const waiting = getUphWaitingForStage().find(w => w.stage.id === man.stageId);
  if (waiting) return { tone: waiting.tone === "bad" ? "bad" : "warn", label: waiting.tone === "bad" ? "Idle" : "Waiting" };
  return { tone: "ok", label: "Free" };
}

// ═══ Input requests — his half of commitment 4 ═════════════════════════
function getUphInputRequests(type) {
  if (typeof inputRequests === "undefined") return [];
  return inputRequests.filter(r => r.dept === "uph" && (!type || r.type === type));
}
function uphAnswerPricing(reqId, payload, byWhom = "Upholstery Supervisor") {
  const r = (typeof inputRequests === "undefined" ? [] : inputRequests).find(x => x.id === reqId);
  if (!r) return { error: "Request not found." };
  if (r.dept !== "uph") return { error: "That request was not asked of upholstery." };
  return answerInputRequest(reqId, payload, byWhom);
}

// ═══ Dashboard readers ═════════════════════════════════════════════════
function uphDueTone(due) {
  if (!due) return "plain";
  const t = uphToday();
  return due < t ? "bad" : due === t ? "bad" : "warn";
}
// The inbox: other people's deadlines, from real records only.
function getUphAskedToday() {
  const rows = [];
  getUphInputRequests().filter(r => r.status === "open").forEach(r => {
    if (r.type === "pricing_input") {
      rows.push({ kind: "PRICING", tone: "wine", title: r.question, from: "Estimator — " + (r.raisedBy || "") , ref: r.id,
        need: "Metres per seat, foam grades and sewing hours. Not a price.", needTone: "wine",
        due: r.neededBy, form: "price", action: "Return input", key: r.id });
    } else if (r.type === "fabric_change" || r.type === "spec_revision") {
      const plan = r.jobCardId ? jobLiveFabricPlan(r.jobCardId) : null;
      rows.push({ kind: "FABRIC", tone: "bad", title: r.question, from: (r.type === "fabric_change" ? "Sales — " : "Operations — ") + (r.raisedBy || ""), ref: r.id,
        need: plan ? plan.id + " is on the cutting table right now, laid from " + plan.fabricName + "." : "A change to a released spec reprices every future quote.", needTone: "bad",
        due: r.neededBy || uphToday(), form: "spec", action: "Accept and reissue", key: r.id });
    }
  });
  // COM shortfalls with no signed note.
  getUphSuites().forEach(job => {
    const need = jobFabricNeed(job.id);
    jobFabricRolls(job.id).forEach(roll => {
      if (!roll.isCOM || need === null) return;
      const short = Math.round((need - roll.metresLanded) * 10) / 10;
      if (short <= 0) return;
      if (comNotes.some(n => n.rollId === roll.id && comNoteSigned(n))) return;
      rows.push({ kind: "COM", tone: "bad", title: "Client's own roll landed " + short + " m short — " + (job.projectName || job.id),
        from: "Store — " + (roll.receivedBy || "Storekeeper"), ref: roll.id,
        need: "COM. We cannot buy more. Nobody cuts until the shortfall is signed.", needTone: "bad",
        due: uphToday(), form: "com", action: "Raise the note", key: job.id });
    });
  });
  // Foam short: reserve or quote; quotes back: compare.
  foamSchedules.forEach(fs => {
    if (fs.signedOff) return;
    const st = foamScheduleState(fs);
    const job = typeof getJobCard === "function" ? getJobCard(fs.jobCardId) : null;
    if (st.st === "bad") {
      const ln = fs.lines.find(l => !l.itemId || uphItemFree(l.itemId) < l.qty) || fs.lines[0];
      rows.push({ kind: "MATERIAL", tone: "warn", title: ln.grade + " short — " + ln.qty + " " + ln.part + " for " + ((job && job.projectName) || fs.jobCardId),
        from: "Store — Storekeeper", ref: fs.id, need: "Reserve from the store or take supplier quotes before the stage is booked.", needTone: "warn",
        due: uphToday(), form: "res", action: "Reserve or quote", key: fs.jobCardId });
    } else if (st.st === "warn") {
      const ln = fs.lines.find(l => l.itemId && uphItemFree(l.itemId) < l.qty) || fs.lines[0];
      const q = uphItemQuotes(ln.itemId);
      rows.push({ kind: "MATERIAL", tone: "warn", title: q.length + " supplier quote" + (q.length === 1 ? "" : "s") + " back for " + ln.grade,
        from: "Purchase — Purchaser", ref: fs.id, need: "Pick one on lead time or the " + ((job && job.projectName) || "job") + " cannot be filled.", needTone: "warn",
        due: null, form: "quote", action: "Compare quotes", key: fs.jobCardId });
    }
  });
  return rows.sort((a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999")));
}
// Paperwork the floor is waiting on: plans, foam, sewing queue, bays, COM.
function getUphPaperwork() {
  const rows = [];
  fabricPlans.forEach(p => {
    if (p.status === "superseded" && p.onTable) {
      const live = fabricPlans.find(x => x.id === p.supersededBy);
      rows.push({ k: "Fabric plan", t: (live ? live.id : p.id) + " — " + p.jobCardId, s: (live ? live.fabricName + ", dye lot " + live.dyeLot + " · supersedes " : "") + p.id + ", still on the table",
        st: "bad", state: "Reissue now", action: "Release", form: "plan", key: p.jobCardId });
    } else if (p.status === "live" && !p.onTable) {
      rows.push({ k: "Fabric plan", t: p.id + " — " + p.jobCardId, s: p.fabricName + ", dye lot " + p.dyeLot + " · " + p.totalM + " m off " + p.rollId,
        st: "ok", state: "Released", action: "Open", form: "plan", key: p.jobCardId });
    }
  });
  foamSchedules.forEach(fs => {
    const st = foamScheduleState(fs);
    if (fs.signedOff) return;
    rows.push({ k: "Foam schedule", t: fs.id + " — " + fs.jobCardId + ", " + fs.lines.reduce((a, l) => a + l.qty, 0) + " blocks",
      s: st.st === "ok" ? "Every grade on the shelf — sign it off" : st.short + " short · " + (st.quoted ? "quotes back, pick one" : "reserve or take quotes"),
      st: st.st === "ok" ? "ok" : "warn", state: st.st === "ok" ? "Ready" : "Blocked", action: "Open", form: "foam", key: fs.jobCardId });
  });
  getUphSuites().forEach(job => {
    const cutEnd = uphStageEnd(job.id, "C"), sewStart = uphStageStart(job.id, "S");
    if (cutEnd && !sewStart) {
      rows.push({ k: "Sewing queue", t: job.id + " covers — " + (job.projectName || ""), s: "Cutting finishes " + cutEnd + ". Book the sewing room after it.",
        st: "ok", state: "Queued", action: "Schedule", form: "allot", key: job.id });
    }
    uphJobStageSlots(job.id, "B").filter(s => s.provisional).slice(0, 1).forEach(s => {
      rows.push({ k: "Bay booking", t: job.id + " — bays, " + uphSlotDate(s), s: "Provisional until sewing has an end date.",
        st: "warn", state: "Provisional", action: "Confirm", form: "allot", key: job.id });
    });
    const com = comBlockReason(job.id);
    if (com && !jobLiveFabricPlan(job.id)) {
      rows.push({ k: "Fabric plan", t: "UT-" + (String(job.id).match(/(\d+)$/) || ["", "0000"])[1].slice(-4) + " — " + (job.projectName || job.id),
        s: "Cannot release — client's own roll is short", st: "bad", state: "Blocked", action: "Open", form: "com", key: job.id });
    }
  });
  return rows;
}
function getUphKPIs() {
  const suites = getUphSuites();
  const waiting = getUphWaitingForStage();
  const owed = getUphInputRequests("pricing_input").filter(r => r.status === "open");
  const live = fabricPlans.filter(p => p.status === "live").length;
  return {
    suitesOnFloor: suites.length, waitingForStage: waiting.length,
    pricingInputOwed: owed.length, pricingDueToday: owed.filter(r => r.neededBy && r.neededBy <= uphToday()).length,
    fabricPlansLive: live, metresSaved: metresSavedBySingleLay(),
    deadOnTable: fabricPlans.filter(p => p.status === "superseded" && p.onTable).length,
    comOpen: comNotes.filter(n => !comNoteSigned(n)).length
  };
}
// One row per suite on the floor, for the Week board page.
function getUphBoardRows() {
  return getUphSuites().map(job => {
    const next = uphNextStage(job.id);
    const block = next ? uphStageBlockReason(job.id, next.id) : null;
    const stageNow = UPH_STAGES.slice().reverse().find(st => uphStageEnd(job.id, st.id)) || null;
    const com = !!comBlockReason(job.id);
    const reissued = fabricPlans.some(p => p.jobCardId === job.id && p.status === "superseded" && p.onTable);
    const st = block && block.tone === "bad" ? "bad" : block ? "warn" : next ? "ok" : "ok";
    return {
      id: job.id, name: job.id + " — " + (job.projectName || job.customerName || ""),
      sub: uphJobLines(job.id).map(it => (it.qty || 1) + " " + (it.product || it.name || "")).join(", "),
      stageNow: stageNow ? stageNow.name : "Not started", next: next ? next.name : "Complete",
      target: job.targetDate || job.promisedDate || null,
      st, state: block ? (block.tone === "bad" ? "Blocked" : "Waiting") : next ? "On track" : "Finished",
      tags: (reissued ? ["REISSUED"] : []).concat(com ? ["COM"] : []),
      reason: block ? block.reason : ""
    };
  });
}
// Fabric & COM register — every roll, with the only three numbers that matter.
function getFabricRegisterRows() {
  return fabricRolls.map(roll => {
    const held = rollMetresHeld(roll.id), free = rollMetresFree(roll.id);
    const job = roll.jobCardId;
    const need = job ? jobFabricNeed(job) : null;
    const plan = job ? jobLiveFabricPlan(job) : null;
    const hold = fabricHolds.find(h => h.rollId === roll.id && h.status === "held");
    let st, consequence, reserve, reserveLabel, freeLabel;
    if (roll.isCOM && need !== null && roll.metresLanded < need) {
      st = "bad"; consequence = "Client's material. We cannot buy more — this needs a signed note.";
      reserve = "none"; reserveLabel = "Nothing to reserve"; freeLabel = roll.metresLanded + " of " + need + " m";
    } else if (plan && plan.rollId === roll.id) {
      st = "ok"; consequence = "Roll " + roll.id + " held against the job card since " + (hold ? hold.heldOn : plan.issuedOn) + ".";
      reserve = "done"; reserveLabel = "Reserved"; freeLabel = (roll.metresLanded) + " of " + need + " m";
    } else if (held && !plan) {
      st = "warn"; consequence = "Release the hold and return it, or release a plan against it.";
      reserve = "release"; reserveLabel = "Release the hold"; freeLabel = held + " m held";
    } else if (need !== null && free < need) {
      st = "bad"; consequence = "Short of need by " + Math.round((need - free) * 10) / 10 + " m. Request purchase, or take supplier quotes.";
      reserve = free > 0 ? "some" : "none"; reserveLabel = free > 0 ? "Reserve the " + free + " m" : "Nothing to reserve"; freeLabel = free + " of " + need + " m";
    } else if (!roll.inspected) {
      st = "warn"; consequence = "Landed, not inspected. Nobody cuts from a roll that has not been checked.";
      reserve = "some"; reserveLabel = "Inspect and reserve"; freeLabel = free + (need !== null ? " of " + need : "") + " m";
    } else {
      st = need === null ? "warn" : "ok"; consequence = need === null ? "Not assigned to a job yet." : "Enough on the shelf — hold it before another job takes it.";
      reserve = "some"; reserveLabel = need !== null ? "Reserve the " + Math.min(free, need) + " m" : "Reserve"; freeLabel = free + (need !== null ? " of " + need : "") + " m";
    }
    return { roll, jobCardId: job, name: roll.name + " · " + roll.widthCm + "cm", detail: "Roll " + roll.id + " · dye lot " + roll.dyeLot + (roll.isCOM ? " · COM" : "") + (roll.inspected ? " · inspected" : " · not inspected"),
      st, consequence, reserve, reserveLabel, freeLabel, freeM: free, need, held, isCOM: roll.isCOM };
  });
}
// The quotes strip on the register: quotes back on the short foam rows.
function getUphQuotesOnShortRows() {
  const out = [];
  foamSchedules.forEach(fs => {
    if (fs.signedOff) return;
    fs.lines.forEach(l => {
      if (!l.itemId || uphItemFree(l.itemId) >= l.qty) return;
      const quotes = uphItemQuotes(l.itemId);
      if (!quotes.length) return;
      const fastest = quotes.slice().sort((a, b) => (a.leadDays || 99) - (b.leadDays || 99))[0];
      const cheapest = quotes.slice().sort((a, b) => (a.unitCost || 9e9) - (b.unitCost || 9e9))[0];
      quotes.forEach(q => {
        let tone = "plain", why;
        if (q === fastest) { tone = "ok"; why = "Holds the target." + (q.awarded ? " Picked." : ""); }
        else if (q === cheapest && q.unitCost !== null && fastest.unitCost !== null) {
          tone = "warn"; why = "Cheaper by BD " + ((fastest.unitCost - q.unitCost) * l.qty).toFixed(3) + ", and it costs " + ((q.leadDays || 0) - (fastest.leadDays || 0)) + " days and a bay slot.";
        } else why = "Neither the fastest nor the cheapest.";
        out.push({ supplier: q.supplierName, item: l.grade + " · " + l.qty + " " + l.part, lead: q.leadDays, cost: q.unitCost, tone, why, jobCardId: fs.jobCardId, itemId: l.itemId });
      });
    });
  });
  return out;
}
function getUphStagesToday(weekDates) {
  const today = uphToday();
  return UPH_STAGES.map(st => {
    const load = uphStageLoad(st.id, weekDates);
    const pct = Math.round(Math.min(100, load / 5 * 100));
    const todaySlots = uphStageSlots.filter(s => s.stageId === st.id && uphSlotDate(s) === today);
    const waiting = getUphWaitingForStage().filter(w => w.stage.id === st.id);
    const jobs = [...new Set(todaySlots.map(s => s.jobCardId))];
    let tone, state, on;
    if (jobs.length > 1) { tone = "bad"; state = "Stopped"; on = jobs.join(" + ") + " — two jobs on one stage"; }
    else if (waiting.length && !load) { tone = waiting[0].tone === "bad" ? "bad" : "warn"; state = waiting[0].tone === "bad" ? "Stopped" : "Idle"; on = waiting[0].reason; }
    else if (jobs.length) { tone = load >= 3 ? "ok" : "warn"; state = load >= 3 ? "On track" : "Light"; on = jobs[0] + (todaySlots[0].kind === "pull" ? " — pulled from " + (uphPrevStage(st.id) || {}).name : " — full day"); }
    else { tone = load >= 3 ? "ok" : "warn"; state = load >= 3 ? "On track" : "Light"; on = "Nothing allotted today"; }
    const target = uphStageTarget(st.id);
    return { stage: st, load, pct, tone, state, on, target, men: getUphStageMembers(st.id).length };
  });
}
// A stage's target: the earliest promised date across the jobs it works,
// and whether the stage's end is inside it. Derived, never typed.
function uphStageTarget(stageId) {
  const ids = [...new Set(uphStageSlots.filter(s => s.stageId === stageId).map(s => s.jobCardId))];
  let best = null;
  ids.forEach(id => {
    const j = typeof getJobCard === "function" ? getJobCard(id) : null;
    const d = j && (j.targetDate || j.promisedDate);
    if (d && (!best || d < best.date)) best = { date: d, jobId: id };
  });
  if (!best) return { date: null, tone: "wine", label: "No target date yet" };
  const end = uphStageEnd(best.jobId, stageId);
  const prev = uphPrevStage(stageId);
  const pulled = uphJobStageSlots(best.jobId, stageId).some(s => s.kind === "pull");
  if (end && end > best.date) return { date: best.date, tone: "bad", label: "misses" };
  if (pulled) return { date: best.date, tone: "warn", label: "pulls from " + (prev ? prev.name.replace(/^\d · /, "") : "upstream") };
  if (uphJobStageSlots(best.jobId, stageId).some(s => s.provisional)) return { date: best.date, tone: "warn", label: "provisional" };
  return { date: best.date, tone: "ok", label: "on track" };
}
function getUphReminders() {
  const rows = [];
  getUphWaitingForStage().forEach(w => rows.push({ what: w.reason, ref: w.job.id + " · " + (w.job.projectName || ""), waiting: w.stage.name, st: w.tone === "bad" ? "bad" : "warn", form: w.form, key: w.job.id }));
  fabricPlans.filter(p => p.status === "superseded" && p.onTable).forEach(p =>
    rows.push({ what: p.id + " is dead and still on the table", ref: p.jobCardId, waiting: "2 · Foam & cutting", st: "bad", form: "plan", key: p.jobCardId }));
  getUphInputRequests("pricing_input").filter(r => r.status === "open" && r.neededBy && r.neededBy <= uphToday()).forEach(r =>
    rows.push({ what: "Pricing input due — " + r.question, ref: r.id, waiting: "Estimator", st: "bad", form: "price", key: r.id }));
  return rows;
}
function getUphDocuments() {
  const rows = [];
  fabricPlans.forEach(p => rows.push({ ref: p.id, kind: "Fabric plan", jobCardId: p.jobCardId, st: p.status === "superseded" ? "bad" : "ok", state: p.status === "superseded" ? "Superseded" : "Live", on: p.issuedOn }));
  foamSchedules.forEach(f => rows.push({ ref: f.id, kind: "Foam schedule", jobCardId: f.jobCardId, st: f.signedOff ? "ok" : "warn", state: f.signedOff ? "Signed off" : "Open", on: f.raisedOn }));
  comNotes.forEach(n => rows.push({ ref: n.id, kind: "COM note", jobCardId: n.jobCardId, st: comNoteSigned(n) ? "ok" : "bad", state: comNoteSigned(n) ? "Signed" : "Unsigned", on: n.raisedOn }));
  uphSpecs.forEach(s => s.revisions.forEach(r => rows.push({ ref: s.id + " rev " + r.rev, kind: "Spec revision", jobCardId: s.pieceType, st: r.rev === s.rev ? "ok" : "plain", state: r.rev === s.rev ? "Current" : "Earlier", on: r.on })));
  return rows.sort((a, b) => String(b.on).localeCompare(String(a.on)));
}
function getUphOvertimeRows() {
  return uphOvertime.slice().reverse().map(o => ({
    id: o.id, stage: uphStage(o.stageId) ? uphStage(o.stageId).name : o.stageId, date: o.date, hours: o.hours, men: o.men,
    recoversTarget: o.recoversTarget, cause: o.cause, refused: o.status === "refused", refusedReason: o.refusedReason,
    st: o.status === "refused" ? "bad" : "ok", state: o.status === "refused" ? "Refused" : "Booked"
  }));
}
function getUphPlanRows() {
  return fabricPlans.slice().reverse().map(p => ({
    id: p.id, jobCardId: p.jobCardId, fabric: p.fabricName, dyeLot: p.dyeLot, roll: p.rollId, totalM: p.totalM, panels: p.totals.panelCount,
    specRev: p.specRev, onTable: p.onTable, status: p.status,
    st: p.status === "superseded" ? (p.onTable ? "bad" : "plain") : "ok",
    state: p.status === "superseded" ? (p.onTable ? "Dead — take it off" : "Superseded") : p.onTable ? "On the table" : "Live"
  }));
}
function getUphFoamRows() {
  return foamSchedules.slice().reverse().map(fs => {
    const st = foamScheduleState(fs);
    return { id: fs.id, jobCardId: fs.jobCardId, lines: fs.lines, blocks: fs.lines.reduce((a, l) => a + l.qty, 0), st: st.st, state: fs.signedOff ? "Signed off" : st.state, short: st.short, quoted: st.quoted, signedOff: fs.signedOff };
  });
}
function getUphSpecRows() {
  return uphSpecs.map(s => ({ id: s.id, pieceType: s.pieceType, rev: s.rev, panels: s.panels.length, foam: s.foam.length, metresPerPiece: s.metresPerPiece, sewingHours: s.sewingHours, bayHours: s.bayHours, revisions: s.revisions.length, updatedOn: s.updatedOn, st: "ok", state: "Rev " + s.rev }));
}

// ═══ The standing specs — standards, not jobs ══════════════════════════
// Seeded once as this module's own masters (the same way DEPTS or UNITS
// are), so a job's piece resolves to a recipe. He edits them in place.
// Panel dimensions are a workshop's typical cut sizes in mm; nap is on for
// every shaped panel and off for boxings, borders and the calico skirt,
// per the handoff.
const UPH_SPEC_SEEDS = [
  { pieceType: "3-seater sofa", metresPerPiece: 14, sewingHours: 9, bayHours: 16,
    panels: [
      { panel: "Seat cushion top", qty: 3, length: 620, width: 560, nap: true, note: "Nap ↓ · one piece, no join" },
      { panel: "Seat cushion bottom", qty: 3, length: 620, width: 560, nap: true, note: "Nap ↓ · one piece, no join" },
      { panel: "Seat cushion boxing", qty: 3, length: 2400, width: 120, nap: false, note: "Straight · railroad allowed" },
      { panel: "Back cushion front", qty: 3, length: 580, width: 560, nap: true, note: "Nap ↓ · repeat matched to seat" },
      { panel: "Back cushion back", qty: 3, length: 580, width: 560, nap: true, note: "Nap ↓" },
      { panel: "Inside back", qty: 1, length: 700, width: 1950, nap: true, note: "Nap ↓ · cut oversize 20mm" },
      { panel: "Outside back", qty: 1, length: 760, width: 2050, nap: true, note: "Nap ↓ · cut oversize 20mm" },
      { panel: "Inside arm", qty: 2, length: 720, width: 900, nap: true, note: "Nap ↓ · pair, mirror" },
      { panel: "Outside arm", qty: 2, length: 640, width: 900, nap: true, note: "Nap ↓ · pair, mirror" },
      { panel: "Front border", qty: 1, length: 260, width: 2050, nap: false, note: "Straight · railroad allowed" },
      { panel: "Seat platform", qty: 1, length: 640, width: 1950, nap: false, note: "Straight · under the cushions" },
      { panel: "Calico skirt", qty: 1, length: 300, width: 2100, nap: false, fabric: "lining", note: "Lining · not visible" }
    ],
    foam: [{ part: "Seat cushion", grade: "35kg HR" }, { part: "Back cushion", grade: "21kg foam + fibre wrap" }, { part: "Arm pad", grade: "28kg foam" }] },
  { pieceType: "Armchair", metresPerPiece: 5.5, sewingHours: 4, bayHours: 7,
    panels: [
      { panel: "Seat cushion top", qty: 1, length: 620, width: 620, nap: true, note: "Nap ↓ · one piece" },
      { panel: "Seat cushion bottom", qty: 1, length: 620, width: 620, nap: true, note: "Nap ↓" },
      { panel: "Seat cushion boxing", qty: 1, length: 2600, width: 120, nap: false, note: "Straight · railroad allowed" },
      { panel: "Inside back", qty: 1, length: 700, width: 760, nap: true, note: "Nap ↓ · cut oversize 20mm" },
      { panel: "Outside back", qty: 1, length: 760, width: 820, nap: true, note: "Nap ↓" },
      { panel: "Inside arm", qty: 2, length: 720, width: 900, nap: true, note: "Nap ↓ · pair, mirror" },
      { panel: "Outside arm", qty: 2, length: 640, width: 900, nap: true, note: "Nap ↓ · pair, mirror" },
      { panel: "Front border", qty: 1, length: 260, width: 820, nap: false, note: "Straight" },
      { panel: "Calico skirt", qty: 1, length: 300, width: 900, nap: false, fabric: "lining", note: "Lining · not visible" }
    ],
    foam: [{ part: "Seat cushion", grade: "35kg HR" }, { part: "Arm pad", grade: "28kg foam" }] },
  { pieceType: "Dining chair", metresPerPiece: 1.2, sewingHours: 0.6, bayHours: 1.5,
    panels: [
      { panel: "Seat pad top", qty: 1, length: 560, width: 560, nap: true, note: "Nap ↓ · one piece" },
      { panel: "Seat pad boxing", qty: 1, length: 2000, width: 80, nap: false, note: "Straight" },
      { panel: "Inside back", qty: 1, length: 520, width: 480, nap: true, note: "Nap ↓" },
      { panel: "Outside back", qty: 1, length: 560, width: 500, nap: true, note: "Nap ↓" }
    ],
    foam: [{ part: "Seat pad", grade: "35kg HR" }, { part: "Back pad", grade: "28kg foam" }] },
  { pieceType: "Headboard", metresPerPiece: 3.2, sewingHours: 2, bayHours: 4,
    panels: [
      { panel: "Face", qty: 1, length: 1400, width: 1900, nap: true, note: "Nap ↓ · one piece, no join" },
      { panel: "Border", qty: 1, length: 4800, width: 120, nap: false, note: "Straight · railroad allowed" },
      { panel: "Back", qty: 1, length: 1400, width: 1900, nap: false, fabric: "lining", note: "Lining · not visible" }
    ],
    foam: [{ part: "Face", grade: "28kg foam" }] },
  { pieceType: "Bench seat", metresPerPiece: 2.4, sewingHours: 1.5, bayHours: 3,
    panels: [
      { panel: "Seat top", qty: 1, length: 520, width: 1400, nap: true, note: "Nap ↓ · one piece" },
      { panel: "Seat boxing", qty: 1, length: 3900, width: 110, nap: false, note: "Straight · railroad allowed" },
      { panel: "Back pad", qty: 1, length: 460, width: 1400, nap: true, note: "Nap ↓" },
      { panel: "Base", qty: 1, length: 560, width: 1420, nap: false, fabric: "lining", note: "Lining · not visible" }
    ],
    foam: [{ part: "Seat", grade: "35kg HR" }, { part: "Back pad", grade: "28kg foam" }] },
  { pieceType: "Majlis seating", metresPerPiece: 2.8, sewingHours: 1.8, bayHours: 3.5,
    panels: [
      { panel: "Seat top", qty: 1, length: 700, width: 1000, nap: true, note: "Nap ↓ · one piece" },
      { panel: "Seat boxing", qty: 1, length: 3400, width: 140, nap: false, note: "Straight · railroad allowed" },
      { panel: "Back cushion front", qty: 1, length: 640, width: 1000, nap: true, note: "Nap ↓ · repeat matched to seat" },
      { panel: "Back cushion back", qty: 1, length: 640, width: 1000, nap: true, note: "Nap ↓" },
      { panel: "Base", qty: 1, length: 740, width: 1040, nap: false, fabric: "lining", note: "Lining · not visible" }
    ],
    foam: [{ part: "Seat", grade: "35kg HR" }, { part: "Back cushion", grade: "21kg foam + fibre wrap" }] },
  { pieceType: "Ottoman", metresPerPiece: 1.8, sewingHours: 1, bayHours: 2,
    panels: [
      { panel: "Top", qty: 1, length: 620, width: 620, nap: true, note: "Nap ↓ · one piece" },
      { panel: "Boxing", qty: 1, length: 2600, width: 380, nap: false, note: "Straight · railroad allowed" },
      { panel: "Base", qty: 1, length: 640, width: 640, nap: false, fabric: "lining", note: "Lining · not visible" }
    ],
    foam: [{ part: "Top", grade: "35kg HR" }] },
  { pieceType: "Loose cushions", metresPerPiece: 0.8, sewingHours: 0.5, bayHours: 0.3,
    panels: [
      { panel: "Front", qty: 1, length: 520, width: 520, nap: true, note: "Nap ↓" },
      { panel: "Back", qty: 1, length: 520, width: 520, nap: true, note: "Nap ↓ · zip in the back" }
    ],
    foam: [{ part: "Fill", grade: "Fibre wrap 400g" }] }
];
function seedUphSpecs() {
  if (uphSpecs.length) return;
  UPH_SPEC_SEEDS.forEach(s => createUphSpec(Object.assign({}, s, { byWhom: "Upholstery Supervisor", note: "Standing spec" })));
}
seedUphSpecs();
// Hydration REPLACES the array with the table's rows (a clean replace, like
// every json collection). Found by the end-to-end run: in a live session
// the eight standing specs vanished, because the table was empty. The rows
// are seeded on the project now; this re-seeds if a fresh project ever
// comes back empty, so a piece always resolves to a recipe.
if (typeof registerLiveUpdate === "function") registerLiveUpdate(function () { if (!uphSpecs.length) seedUphSpecs(); });
