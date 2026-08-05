// Verification for Fix Plan Phase 1 (5 Aug 2026, Fable audit finding #3 /
// Section 1.1) — a Variation Order that introduces a department the
// parent job was never routed to used to never get a departmentBudgets
// slot created for it: confirmVariationToJobCard() never called
// ensureDepartmentBudgets(), so the new department's manager could never
// see the job on their own Budgets tab (getJobsForDepartmentBudget only
// lists jobs that already have an entry), even though the line correctly
// showed up in that department's real production queue — a permanently
// stuck line with no discoverable way to unstick it. Reruns the audit's
// own scenario: a Joinery-only job, then a Variation adding an
// Upholstery-routed line.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== VARIATION NEW-DEPARTMENT BUDGET FIX VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  currentStep = 'seed-joinery-only-job';
  const setup = await page.evaluate(() => {
    const cust = createCustomer({ name: 'VariationDept Client', contactPerson: 'Nora', tel: '39221100', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Nora', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'VariationDept Cabinet', taxPercent: 10, contactPerson: 'Nora' });
    const row = addQuotationItem(qtn.id, { product: 'Plain Cabinet', qty: 1, unit: 'Nos' });
    addBOMMaterial(qtn.id, row.lineId, { name: 'Plywood', qty: 4, unit: 'Sheets', rate: 20 });
    submitItemBOM(qtn.id, row.lineId, 'Estimator');
    qtn.lifecycleStatus = 'open';
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    return { jobId: job.id, hasCarpBudget: !!job.departmentBudgets.carp, hasUphBudget: !!job.departmentBudgets.uph };
  });
  record('Original job is Joinery-only, routed, with a carp budget slot and no uph slot yet', setup.hasCarpBudget && !setup.hasUphBudget ? 'PASS' : 'FAIL', JSON.stringify(setup));

  currentStep = 'create-variation-new-dept';
  const afterVariation = await page.evaluate((jobId) => {
    const variation = createVariationForJob(jobId, { notes: 'Add an upholstered bench seat' });
    const row = addQuotationItem(variation.id, { product: 'Upholstered Bench Seat', qty: 1, unit: 'Nos' });
    addBOMMaterial(variation.id, row.lineId, { name: 'Foam + Fabric', qty: 1, unit: 'Nos', rate: 90 });
    submitItemBOM(variation.id, row.lineId, 'Estimator');
    variation.lifecycleStatus = 'open';
    const mergedJob = confirmVariationToJobCard(variation.id, 'Salman Abdullah');
    return {
      hasUphBudgetSlot: !!(mergedJob.departmentBudgets && mergedJob.departmentBudgets.uph),
      uphBudgetStatus: mergedJob.departmentBudgets && mergedJob.departmentBudgets.uph ? mergedJob.departmentBudgets.uph.approvalStatus : null,
      visibleInUphQueue: getDepartmentQueue('uph').some(r => r.job.id === jobId),
      visibleInUphBudgetTab: getJobsForDepartmentBudget('uph').some(j => j.id === jobId)
    };
  }, setup.jobId);
  record('THE FIX: the new Upholstery department gets a real departmentBudgets slot the instant the Variation merges', afterVariation.hasUphBudgetSlot && afterVariation.uphBudgetStatus === 'not-submitted' ? 'PASS' : 'FAIL', JSON.stringify(afterVariation));
  record('The new line is visible in Upholstery\'s production queue (this part always worked)', afterVariation.visibleInUphQueue ? 'PASS' : 'FAIL');
  record('THE FIX: the job is now visible on Upholstery\'s own Budgets tab (getJobsForDepartmentBudget) — previously invisible forever', afterVariation.visibleInUphBudgetTab ? 'PASS' : 'FAIL');

  // getJobAttentionFlags()'s new check is defense-in-depth for the SAME
  // class of bug via some future, still-unwritten code path — fix #1
  // above (ensureDepartmentBudgets() inside confirmVariationToJobCard())
  // already prevents the slot from ever being missing through THIS route,
  // so there's no real window left to observe the flag via the normal
  // flow. Simulate the hypothetical directly (delete the slot a future
  // bug might skip creating) to prove the flag's own logic actually
  // fires, independent of whether fix #1 already covers this exact path.
  currentStep = 'attention-flag-defense-in-depth';
  const flagsSimulated = await page.evaluate((jobId) => {
    const job = getJobCard(jobId);
    delete job.departmentBudgets.uph;
    return getJobAttentionFlags(job).map(f => f.label);
  }, setup.jobId);
  record('THE FIX: getJobAttentionFlags() flags a routed department with no budget slot at all, independent of how it went missing', flagsSimulated.some(l => l.includes('Not Yet Submitted') && l.includes('Upholstery')) ? 'PASS' : 'FAIL', JSON.stringify(flagsSimulated));
  // Restore the slot fix #1 actually created, so the rest of the test
  // (submit/approve/start production) exercises the real, unmodified state.
  await page.evaluate((jobId) => { ensureDepartmentBudgets(getJobCard(jobId)); }, setup.jobId);

  currentStep = 'submit-and-approve-new-budget';
  const afterSubmit = await page.evaluate((jobId) => {
    submitDepartmentBudget(jobId, 'uph', { materials: 90, labour: 40, subcontract: 0, hiring: 0, others: 0 }, 'Upholstery Manager');
    const flagsAfterSubmit = getJobAttentionFlags(getJobCard(jobId)).map(f => f.label);
    // Fix Plan Phase 2 (5 Aug 2026) — Operations Manager approves, not the
    // submitting department manager (real maker-checker, see DEPARTMENT_APPROVERS).
    approveDepartmentBudget(jobId, 'uph', 'Operations Manager');
    const startResult = startLineProduction(jobId, getJobCard(jobId).items.find(it => (it.departmentSequence || []).includes('uph')).lineId, 'uph');
    return { flagsAfterSubmit, startResult };
  }, setup.jobId);
  record('Once submitted, the "Not Yet Submitted" flag clears and the normal "Budget Pending" flag takes over', !afterSubmit.flagsAfterSubmit.some(l => l.includes('Not Yet Submitted')) && afterSubmit.flagsAfterSubmit.some(l => l.includes('Budget Pending')) ? 'PASS' : 'FAIL', JSON.stringify(afterSubmit.flagsAfterSubmit));
  record('Once approved through the now-visible Budgets tab, production actually starts (the real unblock)', !afterSubmit.startResult.error ? 'PASS' : 'FAIL', JSON.stringify(afterSubmit.startResult));

  currentStep = 'regression-normal-job-unaffected';
  const regressionCheck = await page.evaluate(() => {
    const cust = createCustomer({ name: 'RegressionCheck Client', contactPerson: 'Ali', tel: '39331100', address: 'Manama' });
    const enq = createEnquiry({ division: 'Curtain & Blinds', customerId: cust.id, contactPerson: 'Ali', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'RegressionCheck Curtains', taxPercent: 10, contactPerson: 'Ali' });
    const row = addQuotationItem(qtn.id, { product: 'Blackout Curtain', qty: 4, unit: 'Meters' });
    addBOMMaterial(qtn.id, row.lineId, { name: 'Fabric', qty: 4, unit: 'Meters', rate: 15 });
    submitItemBOM(qtn.id, row.lineId, 'Estimator');
    qtn.lifecycleStatus = 'open';
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    return getJobAttentionFlags(job).map(f => f.label);
  });
  record('A normal, single-department job with its budget already created shows no spurious "Not Yet Submitted" flag', !regressionCheck.some(l => l.includes('Not Yet Submitted')) ? 'PASS' : 'FAIL', JSON.stringify(regressionCheck));

  currentStep = 'final';
  const critical = consoleErrors.filter(e => !e.text.includes('favicon'));
  record('No unexpected console errors', critical.length === 0 ? 'PASS' : 'FAIL', critical.map(e => e.text).join(' | '));
  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.some(r => r.status === 'FAIL') ? 1 : 0);
})().catch(err => {
  console.error('FATAL:', err);
  printReport();
  process.exit(1);
});
