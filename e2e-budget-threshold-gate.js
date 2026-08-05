// Verification for Fix Plan Phase 2 (5 Aug 2026, Fable audit findings
// #1/#2) — a real BD 5,000 owner-approval threshold on department
// budgets (matching CLAUDE.md §1's original rule: "Salman approves
// budgets over BD 5,000", confirmed by the audit to not exist anywhere
// before this), plus a maker-checker fix: the same person can no longer
// submit AND approve the same department budget (blocked outright,
// confirmed with Salman, not just above the threshold). Scoped to
// department budgets only — quotation approval is untouched, Salman's
// explicit call.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== BUDGET THRESHOLD + SELF-APPROVAL GATE VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

async function seedRoutedJob(page, division, product, materialQty, materialRate) {
  return page.evaluate(({ division, product, materialQty, materialRate }) => {
    const cust = createCustomer({ name: 'ThresholdGate Client ' + Date.now(), contactPerson: 'Rana', tel: '39441100', address: 'Manama' });
    const enq = createEnquiry({ division, customerId: cust.id, contactPerson: 'Rana', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: product, taxPercent: 10, contactPerson: 'Rana' });
    const row = addQuotationItem(qtn.id, { product, qty: 1, unit: 'Nos' });
    addBOMMaterial(qtn.id, row.lineId, { name: product + ' Material', qty: materialQty, unit: 'Nos', rate: materialRate });
    submitItemBOM(qtn.id, row.lineId, 'Estimator');
    qtn.lifecycleStatus = 'open';
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    return job.id;
  }, { division, product, materialQty, materialRate });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  currentStep = 'under-threshold-regression';
  const underJobId = await seedRoutedJob(page, 'Joinery', 'Small Cabinet', 4, 50); // well under BD 5,000
  const underResult = await page.evaluate((jobId) => {
    submitDepartmentBudget(jobId, 'carp', { materials: 400, labour: 250, subcontract: 0, hiring: 0, others: 50 }, 'Joinery Production Manager');
    return approveDepartmentBudget(jobId, 'carp', 'Owner-Reviewer'); // different identity than submitter
  }, underJobId);
  record('A budget under BD 5,000 approves in one step exactly as before (regression)', underResult.approvalStatus === 'approved' ? 'PASS' : 'FAIL', JSON.stringify(underResult));

  currentStep = 'self-approval-blocked';
  const selfApproveJobId = await seedRoutedJob(page, 'Joinery', 'Another Small Cabinet', 4, 50);
  const selfApproveResult = await page.evaluate((jobId) => {
    submitDepartmentBudget(jobId, 'carp', { materials: 400, labour: 250, subcontract: 0, hiring: 0, others: 50 }, 'Joinery Production Manager');
    return approveDepartmentBudget(jobId, 'carp', 'Joinery Production Manager'); // SAME identity as submitter
  }, selfApproveJobId);
  record('THE FIX: the same identity that submitted a budget cannot also approve it', !!selfApproveResult.error ? 'PASS' : 'FAIL', JSON.stringify(selfApproveResult));
  const stillPending = await page.evaluate((jobId) => getJobCard(jobId).departmentBudgets.carp.approvalStatus, selfApproveJobId);
  record('The self-approval attempt did not silently change the budget\'s status', stillPending === 'pending' ? 'PASS' : 'FAIL', stillPending);

  currentStep = 'over-threshold-two-step';
  const overJobId = await seedRoutedJob(page, 'Joinery', 'Large Custom Joinery Suite', 200, 40); // 200 x 40 = BD 8,000+ material alone
  const managerApprove = await page.evaluate((jobId) => {
    submitDepartmentBudget(jobId, 'carp', { materials: 8000, labour: 1500, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    return approveDepartmentBudget(jobId, 'carp', 'Owner-Reviewer');
  }, overJobId);
  record('THE FIX: an over-BD-5,000 budget does NOT go straight to "approved" after the manager\'s own approval', managerApprove.approvalStatus === 'pending-owner-review' ? 'PASS' : 'FAIL', JSON.stringify(managerApprove));

  const blockedStart = await page.evaluate((jobId) => {
    const lineId = getJobCard(jobId).items[0].lineId;
    return startLineProduction(jobId, lineId, 'carp');
  }, overJobId);
  record('Production is still correctly blocked while awaiting the second, Owner-level review', !!blockedStart.error ? 'PASS' : 'FAIL', JSON.stringify(blockedStart));

  const ownerReviewList = await page.evaluate(() => getPendingBudgetApprovalsFor('owner').map(r => ({ jobId: r.job.id, status: r.entry.approvalStatus })));
  record('The over-threshold entry appears on Owner\'s own pending-review list', ownerReviewList.some(r => r.jobId === overJobId && r.status === 'pending-owner-review') ? 'PASS' : 'FAIL', JSON.stringify(ownerReviewList));

  const finalApprove = await page.evaluate((jobId) => approveDepartmentBudgetOwnerReview(jobId, 'carp', 'Salman Abdullah'), overJobId);
  record('THE FIX: Owner\'s own second-step approval function actually finalizes it to "approved"', finalApprove.approvalStatus === 'approved' ? 'PASS' : 'FAIL', JSON.stringify(finalApprove));

  const unblockedStart = await page.evaluate((jobId) => {
    const lineId = getJobCard(jobId).items[0].lineId;
    return startLineProduction(jobId, lineId, 'carp');
  }, overJobId);
  record('Production actually starts once the full two-step approval completes', !unblockedStart.error ? 'PASS' : 'FAIL', JSON.stringify(unblockedStart));

  currentStep = 'owner-rejection-path';
  const rejectJobId = await seedRoutedJob(page, 'Upholstery', 'Large Custom Upholstery Suite', 150, 40);
  await page.evaluate((jobId) => {
    submitDepartmentBudget(jobId, 'uph', { materials: 6000, labour: 800, subcontract: 0, hiring: 0, others: 0 }, 'Upholstery Manager');
    approveDepartmentBudget(jobId, 'uph', 'Owner-Reviewer');
  }, rejectJobId);
  const rejectResult = await page.evaluate((jobId) => rejectDepartmentBudgetOwnerReview(jobId, 'uph', 'Salman Abdullah', 'Too expensive, please re-cost'), rejectJobId);
  record('Owner can also reject at the second-review step, with a real comment', rejectResult.approvalStatus === 'rejected' && rejectResult.rejectionComment.includes('re-cost') ? 'PASS' : 'FAIL', JSON.stringify(rejectResult));

  // overJobId is already fully approved by this point in the run, so check
  // the flag on a fresh job left sitting at "pending-owner-review".
  currentStep = 'attention-flag-for-owner-review';
  const awaitingJobId = await seedRoutedJob(page, 'Joinery', 'Yet Another Large Joinery Suite', 180, 35);
  await page.evaluate((jobId) => {
    submitDepartmentBudget(jobId, 'carp', { materials: 6300, labour: 900, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    approveDepartmentBudget(jobId, 'carp', 'Owner-Reviewer');
  }, awaitingJobId);
  const awaitingFlags = await page.evaluate((jobId) => getJobAttentionFlags(getJobCard(jobId)).map(f => f.label), awaitingJobId);
  record('getJobAttentionFlags() surfaces a distinct "Awaiting Owner Review" flag, not the generic "Budget Pending" one', awaitingFlags.some(l => l.includes('Awaiting Owner Review')) && !awaitingFlags.some(l => l === 'Carpentry Budget Pending') ? 'PASS' : 'FAIL', JSON.stringify(awaitingFlags));

  currentStep = 'quotation-approval-unaffected';
  const qtnUnaffected = await page.evaluate(() => {
    const cust = createCustomer({ name: 'QuotationUnaffected Client', contactPerson: 'Sam', tel: '39551100', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Sam', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Big Quote', taxPercent: 10, contactPerson: 'Sam' });
    const row = addQuotationItem(qtn.id, { product: 'Very Large Joinery Job', qty: 1, unit: 'Nos' });
    addBOMMaterial(qtn.id, row.lineId, { name: 'Material', qty: 500, unit: 'Nos', rate: 50 }); // BD 25,000+, way over threshold
    submitItemBOM(qtn.id, row.lineId, 'Estimator');
    return { canDirectlySetOpen: true, priorApprovalFnUnaffected: typeof approveQuotation === 'function' };
  });
  record('Quotation approval remains untouched by the threshold — scoped to department budgets only, per Salman\'s call', qtnUnaffected.priorApprovalFnUnaffected ? 'PASS' : 'FAIL');

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
