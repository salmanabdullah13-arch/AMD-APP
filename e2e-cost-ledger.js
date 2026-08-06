// Stages 2+3 of the merged roadmap (6 Aug 2026) — the production cost
// ledger, modeled on the real Q-Pro MATERIAL COST document (JB26AMD02232):
// line-scoped priced material issues, per-employee labour day-logs at the
// REAL payroll rates, derived (never typed) per-line actual cost, the
// MATERIAL COST print document, team-leader progress milestones
// (25/50/75, 100% only via QC pass), and the derived actuals feeding
// projects[].actuals / the over-budget flag.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== PRODUCTION COST LEDGER (Stages 2+3) ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 480, height: 950 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  currentStep = 'seed';
  const seed = await page.evaluate(() => {
    salesCurrentUser = 'Salman Abdullah';
    const cust = createCustomer({ name: 'Ledger Test Client', contactPerson: 'T', tel: '39990001', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'T', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'Ledger Test — TV Unit', taxPercent: 10, contactPerson: 'T' });
    const it = addQuotationItem(q.id, { product: 'Painted TV Unit Cabinet', qty: 1, unit: 'Nos', rate: 0 });
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(q.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    submitDepartmentBudget(job.id, 'carp', { materials: 40, labour: 20, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    approveDepartmentBudget(job.id, 'carp', 'Operations Manager');
    submitDepartmentBudget(job.id, 'paint', { materials: 10, labour: 8, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    approveDepartmentBudget(job.id, 'paint', 'Operations Manager');
    startLineProduction(job.id, it.lineId, 'carp');
    return { jobId: job.id, lineId: it.lineId };
  });
  record('Job seeded, routed carp+paint, budgets approved, production started', !!seed.jobId ? 'PASS' : 'FAIL', seed.jobId);

  currentStep = 'material-issue-ledger';
  const mi = await page.evaluate(({ jobId, lineId }) => {
    // Through the Jobs form's own row shape (jobItemLineId + free-text
    // stockItemName) — normalizeMoveItem must resolve the real item, carry
    // the line link, and auto-price from the real Item Master.
    const res = addMaterialsIssue(jobId, {
      location: 'Main Warehouse',
      items: [
        { jobItemLineId: String(lineId), stockItemName: 'MDF036 MDF BEECH VENEER 2 SIDE 4X8X18MM (CROWN)', unit: 'Sheet', qty: 2 },
        { jobItemLineId: '', stockItemName: 'ACC046 CHALK LINE POWDER SET', unit: 'Nos', qty: 1 }  // job-general row
      ]
    });
    if (res.error) return { error: res.error };
    const row = res.items[0];
    const master = itemMaster.find(i => i.name === 'MDF036 MDF BEECH VENEER 2 SIDE 4X8X18MM (CROWN)');
    return { itemId: row.itemId, lineId: row.lineId, rate: row.rate, masterCost: master && (master.avgCost || master.cost), generalLineId: res.items[1].lineId };
  }, seed);
  record('Material issue auto-links the real Item Master row and auto-prices it', mi.itemId && mi.rate === mi.masterCost && mi.rate > 0 ? 'PASS' : 'FAIL', JSON.stringify(mi));
  record('Line link carried from the Jobs form select; blank = job-general (null)', mi.lineId === seed.lineId && mi.generalLineId === null ? 'PASS' : 'FAIL');

  currentStep = 'labour-day-log';
  const lab = await page.evaluate(({ jobId, lineId }) => {
    const l1 = logLabourDay({ jobId, lineId, employeeName: 'Vinod Sharma', hours: 8, loggedBy: 'Joinery Production Manager' });
    const l2 = logLabourDay({ jobId, lineId, employeeName: 'Ajay Paswan', hours: 4, loggedBy: 'Joinery Production Manager' });
    const bad = logLabourDay({ jobId, lineId, employeeName: 'Not A Real Person', hours: 8 });
    const badHours = logLabourDay({ jobId, lineId, employeeName: 'Vinod Sharma', hours: 20 });
    return {
      c1: l1.cost, expect1: Math.round(8 * EMPLOYEE_RATES['Vinod Sharma'].rate * 1000) / 1000,
      c2: l2.cost, expect2: Math.round(4 * EMPLOYEE_RATES['Ajay Paswan'].rate * 1000) / 1000,
      badRejected: !!bad.error, badHoursRejected: !!badHours.error
    };
  }, seed);
  record('Labour day-log costs at the REAL per-person payroll rate', lab.c1 === lab.expect1 && lab.c2 === lab.expect2 ? 'PASS' : 'FAIL', JSON.stringify(lab));
  record('Unknown employee and out-of-range hours are rejected', lab.badRejected && lab.badHoursRejected ? 'PASS' : 'FAIL');

  currentStep = 'derived-actuals';
  const act = await page.evaluate(({ jobId, lineId }) => {
    const line = getLineActualCost(jobId, lineId);
    const jobAct = getJobActualCost(jobId);
    const job = getJobCard(jobId);
    recomputeJobBudgetRollup(job);
    const proj = projects.find(p => p.id === jobId);
    return {
      matTotal: line.materialTotal, labTotal: line.labourTotal, total: line.totalCost,
      handSum: Math.round((line.materials.reduce((s, m) => s + m.amount, 0) + line.labour.reduce((s, l) => s + l.cost, 0)) * 1000) / 1000,
      unallocatedMat: jobAct.unallocated.materialTotal,
      projActualMat: proj && proj.actuals.mat, projActualLab: proj && proj.actuals.lab,
      jobMatTotal: jobAct.materialTotal
    };
  }, seed);
  record('Derived line actual = hand-summed issues + labour (never typed)', act.total === act.handSum && act.total > 0 ? 'PASS' : 'FAIL', JSON.stringify(act));
  record('Job-general rows land in the unallocated bucket', act.unallocatedMat > 0 ? 'PASS' : 'FAIL', String(act.unallocatedMat));
  record('projects[].actuals now FED from the ledger (mat = line+unallocated, lab = day-logs)', act.projActualMat === act.jobMatTotal && act.projActualLab === act.labTotal ? 'PASS' : 'FAIL', JSON.stringify({ projMat: act.projActualMat, jobMat: act.jobMatTotal, projLab: act.projActualLab }));

  currentStep = 'progress-ui';
  // Through the real Joinery module queue: progress buttons + work log form.
  await page.evaluate(() => { const n = window.__eco3d.NODES.find(n => n.id === 'joinery'); n.userData ? n.userData.node.launch() : n.launch(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { joineryView = 'queue'; renderJoineryBody(); });
  await page.waitForTimeout(400);
  const hasProgressBtn = await page.evaluate(() => document.querySelector('#joinery-module-wrap [onclick*="deptSetProgress"]') !== null);
  record('Joinery queue rows show the 25/50/75 progress buttons', hasProgressBtn ? 'PASS' : 'FAIL');
  await page.click('#joinery-module-wrap [onclick*="deptSetProgress"][onclick*=",50)"]');
  await page.waitForTimeout(400);
  const pct = await page.evaluate(({ jobId, lineId }) => {
    const job = getJobCard(jobId);
    return job.items.find(i => i.lineId === lineId).departmentStatuses.find(d => d.department === 'carp').progressPct;
  }, seed);
  record('Tapping 50% sets the milestone through the real UI', pct === 50 ? 'PASS' : 'FAIL', String(pct));
  const direct100 = await page.evaluate(({ jobId, lineId }) => setLineProgress(jobId, lineId, 'carp', 100, null), seed);
  record('100% cannot be set manually — only a QC pass grants it', direct100 && direct100.error ? 'PASS' : 'FAIL', JSON.stringify(direct100));

  currentStep = 'worklog-ui';
  await page.click('#joinery-module-wrap [onclick*="deptToggleWorkLog"]');
  await page.waitForTimeout(400);
  const logged = await page.evaluate(({ lineId }) => {
    const sel = document.getElementById('wl-emps-' + lineId);
    if (!sel) return { error: 'no form' };
    sel.options[0].selected = true;
    sel.options[1].selected = true;
    document.getElementById('wl-hours-' + lineId).value = '6';
    return { ok: true, first: sel.options[0].value };
  }, seed);
  await page.click('#joinery-module-wrap [onclick*="deptSaveWorkLog"]');
  await page.waitForTimeout(400);
  const logCount = await page.evaluate(({ jobId, lineId }) => getLabourLogsForLine(jobId, lineId).length, seed);
  record('Team-leader work-log form logs a day-entry per selected employee', !logged.error && logCount === 4 ? 'PASS' : 'FAIL', `entries: ${logCount}`);

  currentStep = 'qc-pass-100';
  const qc = await page.evaluate(({ jobId, lineId }) => {
    ['cutting', 'veneer-pressing', 'assembly'].forEach(s => advanceJoinerySubStage(jobId, lineId, s));
    submitLineForQC(jobId, lineId, 'carp');
    recordLineQCResult(jobId, lineId, 'carp', true, DEPT_QC_AUTHORITY.carp);
    const job = getJobCard(jobId);
    return job.items.find(i => i.lineId === lineId).departmentStatuses.find(d => d.department === 'carp').progressPct;
  }, seed);
  record('QC pass automatically sets 100%', qc === 100 ? 'PASS' : 'FAIL', String(qc));

  currentStep = 'material-cost-doc';
  const doc = await page.evaluate(({ jobId, lineId }) => buildMaterialCostPrintHTML(getJobCard(jobId), lineId), seed);
  record('MATERIAL COST document: header block, priced issue rows, labour rows, TOTAL COST band',
    doc.includes('MATERIAL COST') && doc.includes('Material Issue') && doc.includes('MDF036') &&
    doc.includes('Vinod Sharma') && doc.includes('TOTAL COST') && doc.includes('Labour Total') ? 'PASS' : 'FAIL');

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
