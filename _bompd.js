const fs = require('fs');
const f = 'production-data.js';
const raw = fs.readFileSync(f, 'utf8');
const crlf = raw.includes('\r\n');
let s = raw.replace(/\r\n/g, '\n');
const missed = [];
const rep = (from, to) => {
  if (s.indexOf(from) === -1) { missed.push(from.slice(0, 70)); return; }
  s = s.split(from).join(to);
};

// ── what the two request types actually mean ──────────────────────────────
rep(
`// pricing_input: the estimator asking what THIS job will take.
// bom_budget_input: operations asking what A UNIT should consume.
const INPUT_REQUEST_TYPES = {
  pricing_input:    { raiserRole: "estimator",          label: "Pricing input" },
  bom_budget_input: { raiserRole: "operations_manager", label: "BOM input for budgeting" }
};`,
`// Two different questions from two different askers, and they are answered
// in two different ways.
//
//  pricing_input     — the ESTIMATOR, on a quote that is not sold yet. Asks
//                      how long the work takes. Answered with hours and
//                      quantities through answerInputRequest(); never a price.
//  bom_budget_input  — OPERATIONS, on a job that is already approved. Asks
//                      the production manager to build the job's BOM so the
//                      project budget can be set before work starts.
//                      Answered by the department budget existing, through
//                      closeInputRequestWithBudget() — see the note there for
//                      why a BOM must not travel as an "answer payload".
const INPUT_REQUEST_TYPES = {
  pricing_input:    { raiserRole: "estimator",          label: "Pricing input" },
  bom_budget_input: { raiserRole: "operations_manager", label: "Job BOM for budgeting" }
};`);

// ── a BOM is not an answer payload ────────────────────────────────────────
rep(
`  if (!payload || !Object.keys(payload).length) return { error: "An empty answer helps nobody." };`,
`  if (!payload || !Object.keys(payload).length) return { error: "An empty answer helps nobody." };
  // A budgeting request is answered by the budget existing, not by a payload.
  // Routing a BOM through here would carry rates and amounts, which this
  // whitelist refuses and a Postgres trigger refuses again — both correctly.
  if (r.type === "bom_budget_input") {
    return { error: "A budgeting request is answered by submitting the department's BOM, not by returning figures." };
  }`);

// ── the two new functions, after answerInputRequest ───────────────────────
rep(
`  r.answer = Object.assign({}, payload);
  r.answeredBy = byWhom;
  r.answeredOn = prdToday();
  r.status = "answered";
  return r;
}`,
`  r.answer = Object.assign({}, payload);
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
function safe0(fn) { try { return fn(); } catch (e) { return null; } }`);

fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
if (missed.length) { console.error('  MISSED:\n    ' + missed.join('\n    ')); process.exitCode = 1; }
else console.log('  production-data.js: request types, budget close, estimate seed');
