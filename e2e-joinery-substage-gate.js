// Verification for Phase 2 business-cycle audit finding #2 (5 Aug
// 2026) — submitLineForQC() used to only check status === "in-
// production", never joinerySubStage, so a carp line could jump
// straight to QC while stuck at "drafting" (confirmed live in the
// audit). Fixed with a hard gate in data.js + a "Waiting on <stage>"
// message replacing the button in the shared Production Queue UI
// (dept-pipeline-ui.js) when blocked.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-joinery-substage-gate');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== JOINERY SUB-STAGE GATE VERIFICATION ===');
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
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForTimeout(500);

  // ── Case 1: a carp line stuck at "drafting" cannot go to QC ──
  currentStep = 'blocked-at-drafting';
  const blocked = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Substage Gate Client', contactPerson: 'Yusuf', tel: '39113344', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Yusuf', tel: '39113344', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Substage Gate Project', taxPercent: 10, contactPerson: 'Yusuf' });
    const item = addQuotationItem(qtn.id, { product: 'Wardrobe Cabinet', qty: 1, unit: 'Nos' });
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    const entryBudget = job.departmentBudgets.carp;
    submitDepartmentBudget(job.id, 'carp', { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    approveDepartmentBudget(job.id, 'carp', 'Owner');
    const started = startLineProduction(job.id, item.lineId, 'carp');
    const subStageAfterStart = started.departmentStatuses.find(d => d.department === 'carp').joinerySubStage;
    const qcAttempt = submitLineForQC(job.id, item.lineId, 'carp');
    const entryAfterAttempt = job.items.find(it => it.lineId === item.lineId).departmentStatuses.find(d => d.department === 'carp');
    return {
      jobId: job.id, lineId: item.lineId,
      subStageAfterStart,
      qcAttemptError: qcAttempt && qcAttempt.error,
      statusStillInProduction: entryAfterAttempt.status === 'in-production'
    };
  });
  record(
    'submitLineForQC() refuses a carp line still at "drafting" (first sub-stage)',
    blocked.subStageAfterStart === 'drafting' && !!blocked.qcAttemptError && blocked.statusStillInProduction ? 'PASS' : 'FAIL',
    JSON.stringify(blocked)
  );

  // ── Case 2: advancing through all sub-stages to "assembly" then allows QC ──
  currentStep = 'unblocked-at-assembly';
  const unblocked = await page.evaluate((prev) => {
    advanceJoinerySubStage(prev.jobId, prev.lineId, 'cutting');
    advanceJoinerySubStage(prev.jobId, prev.lineId, 'veneer-pressing');
    advanceJoinerySubStage(prev.jobId, prev.lineId, 'assembly');
    const qcAttempt = submitLineForQC(prev.jobId, prev.lineId, 'carp');
    const statusNowQC = qcAttempt && !qcAttempt.error && qcAttempt.departmentStatuses.find(d => d.department === 'carp').status === 'qc';
    return { qcAttemptError: qcAttempt && qcAttempt.error, statusNowQC };
  }, blocked);
  record('submitLineForQC() succeeds once the line reaches "assembly"', !unblocked.qcAttemptError && unblocked.statusNowQC ? 'PASS' : 'FAIL', JSON.stringify(unblocked));

  // ── Case 3: regression — Upholstery (deptKey 'uph', no joinerySubStage) is unaffected ──
  currentStep = 'upholstery-unaffected';
  const uph = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Upholstery Regression Client', contactPerson: 'Huda', tel: '39115566', address: 'Manama' });
    const enq = createEnquiry({ division: 'Upholstery', customerId: cust.id, contactPerson: 'Huda', tel: '39115566', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Upholstery Regression Project', taxPercent: 10, contactPerson: 'Huda' });
    const item = addQuotationItem(qtn.id, { product: 'Sofa Set', qty: 1, unit: 'Nos' });
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    submitDepartmentBudget(job.id, 'uph', { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'Upholstery Manager');
    approveDepartmentBudget(job.id, 'uph', 'Owner');
    startLineProduction(job.id, item.lineId, 'uph');
    const qcAttempt = submitLineForQC(job.id, item.lineId, 'uph');
    const statusNowQC = qcAttempt && !qcAttempt.error && qcAttempt.departmentStatuses.find(d => d.department === 'uph').status === 'qc';
    return { qcAttemptError: qcAttempt && qcAttempt.error, statusNowQC };
  });
  record('Upholstery (no joinerySubStage) can still submit for QC right after production — unaffected by the gate', !uph.qcAttemptError && uph.statusNowQC ? 'PASS' : 'FAIL', JSON.stringify(uph));

  // ── Case 4: the shared Production Queue UI shows a waiting message, not a clickable button, when blocked ──
  currentStep = 'ui-waiting-message';
  const uiCheck = await page.evaluate(() => {
    const cust = createCustomer({ name: 'UI Gate Client', contactPerson: 'Ali', tel: '39117788', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Ali', tel: '39117788', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'UI Gate Project', taxPercent: 10, contactPerson: 'Ali' });
    const item = addQuotationItem(qtn.id, { product: 'Wardrobe Cabinet', qty: 1, unit: 'Nos' });
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    submitDepartmentBudget(job.id, 'carp', { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    approveDepartmentBudget(job.id, 'carp', 'Owner');
    startLineProduction(job.id, item.lineId, 'carp');
    const html = renderDeptQueue('carp', 'Joinery Production Manager', 'joinery');
    return { hasWaitingMessage: html.includes('Waiting on Drafting'), hasSubmitButton: html.includes(`'submitLineForQC','${job.id}'`) };
  });
  record('renderDeptQueue() shows "Waiting on Drafting" instead of a Submit for QC button for a blocked line', uiCheck.hasWaitingMessage && !uiCheck.hasSubmitButton ? 'PASS' : 'FAIL', JSON.stringify(uiCheck));
  await shot(page, 'final-state', 1);

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
