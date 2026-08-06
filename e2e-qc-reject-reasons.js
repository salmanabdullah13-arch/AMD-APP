// Verification for the 6 Aug 2026 audit fix, Phase C (loophole #6): the
// shared Joinery/Upholstery pipeline and Painting now capture an optional QC
// reject reason on a fail (the way Curtain's QC already did), store it on the
// line's department entry, thread it into the activity log, and aggregate it
// via getQCRejectReasonsForDept(). Covers the data layer, backward-compat
// (a reasonless fail still works), and the real Fail-button UI path with a
// reason typed into the prompt.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== QC REJECT-REASON CAPTURE VERIFICATION ===');
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
  // Default: accept dialogs (empty prompt). Overridden per-step below when a
  // reason string needs to be typed into the prompt.
  let dialogReason = '';
  page.on('dialog', async d => { await d.accept(dialogReason); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  await page.evaluate(() => {
    window.__seedToQC = function (deptKey, product) {
      const c = createCustomer({ name: 'QC ' + Math.random().toString(36).slice(2, 7), contactPerson: 'X', tel: '39' + Math.floor(100000 + Math.random() * 899999), address: 'Manama' });
      const e = createEnquiry({ division: deptKey === 'uph' ? 'Upholstery' : 'Joinery', customerId: c.id, contactPerson: 'X', tel: c.tel, source: 'walk inn', salesPerson: 'S' });
      const q = convertEnquiryToQuotation(e.id, { projectName: product, taxPercent: 10, contactPerson: 'X' });
      const row = addQuotationItem(q.id, { product, qty: 1, unit: 'Nos', vatPercent: 10 });
      setItemDepartmentSequence(q.id, row.lineId, [deptKey]);
      addBOMMaterial(q.id, row.lineId, { name: 'm', qty: 1, unit: 'Nos', rate: 200 });
      submitItemBOM(q.id, row.lineId, 'E');
      transferQuotationStage(q.id, 'estimator', 'S'); transferQuotationStage(q.id, 'approver', 'E');
      approveQuotation(q.id, 'A');
      const job = confirmQuotationToJobCard(q.id, 'S');
      confirmJobRouting(job.id, {}, 'Operations Manager');
      submitDepartmentBudget(job.id, deptKey, { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'E');
      approveDepartmentBudget(job.id, deptKey, 'Operations Manager');
      startLineProduction(job.id, row.lineId, deptKey);
      const entry = job.items[0].departmentStatuses.find(d => d.department === deptKey);
      if (deptKey === 'carp' && entry.joinerySubStage) ['cutting', 'veneer-pressing', 'assembly'].forEach(s => advanceJoinerySubStage(job.id, row.lineId, s));
      submitLineForQC(job.id, row.lineId, deptKey);
      return { jobId: job.id, lineId: row.lineId };
    };
  });

  // ── Data layer: fail WITH a reason ──
  currentStep = 'data-with-reason';
  const wr = await page.evaluate(() => {
    const { jobId, lineId } = window.__seedToQC('uph', 'Sofa Cover');
    recordLineQCResult(jobId, lineId, 'uph', false, 'Uph QC', '  Loose stitching  ');
    const entry = getJobCard(jobId).items[0].departmentStatuses.find(d => d.department === 'uph');
    const reasons = getQCRejectReasonsForDept('uph');
    return { rejectReason: entry.rejectReason, reasons };
  });
  record('QC fail stores a trimmed rejectReason on the line entry', wr.rejectReason === 'Loose stitching' ? 'PASS' : 'FAIL', JSON.stringify(wr.rejectReason));
  record('getQCRejectReasonsForDept() aggregates the reason', JSON.stringify(wr.reasons).includes('Loose stitching') ? 'PASS' : 'FAIL', JSON.stringify(wr.reasons));

  // ── Data layer: backward-compat, fail WITHOUT a reason ──
  currentStep = 'data-no-reason';
  const nr = await page.evaluate(() => {
    const { jobId, lineId } = window.__seedToQC('uph', 'Plain Chair');
    const r = recordLineQCResult(jobId, lineId, 'uph', false, 'Uph QC'); // 5-arg legacy call
    const entry = getJobCard(jobId).items[0].departmentStatuses.find(d => d.department === 'uph');
    return { ok: !r.error, status: entry.status, rejectReason: entry.rejectReason };
  });
  record('Legacy 5-arg fail still works and stores rejectReason=null', nr.ok && nr.status === 'rework' && nr.rejectReason === null ? 'PASS' : 'FAIL', JSON.stringify(nr));

  // ── Data layer: reason clears on a subsequent pass ──
  currentStep = 'reason-clears-on-pass';
  const cp = await page.evaluate(() => {
    const { jobId, lineId } = window.__seedToQC('uph', 'Recover Chair');
    recordLineQCResult(jobId, lineId, 'uph', false, 'Uph QC', 'Wrong fabric');
    reworkLineBackToProduction(jobId, lineId, 'uph');
    submitLineForQC(jobId, lineId, 'uph');
    recordLineQCResult(jobId, lineId, 'uph', true, DEPT_QC_AUTHORITY.uph);
    const entry = getJobCard(jobId).items[0].departmentStatuses.find(d => d.department === 'uph');
    return { status: entry.status, rejectReason: entry.rejectReason };
  });
  record('A subsequent QC pass clears the stale rejectReason', cp.status === 'ready-for-handoff' && cp.rejectReason === null ? 'PASS' : 'FAIL', JSON.stringify(cp));

  // ── Painting equivalent ──
  currentStep = 'painting-reason';
  const pr = await page.evaluate(() => {
    const c = createCustomer({ name: 'PQC', contactPerson: 'X', tel: '39445566', address: 'Manama' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'X', tel: c.tel, source: 'walk inn', salesPerson: 'S' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Painted Panel', taxPercent: 10, contactPerson: 'X' });
    const row = addQuotationItem(q.id, { product: 'Lacquered Panel', qty: 1, unit: 'Nos', vatPercent: 10 });
    setItemDepartmentSequence(q.id, row.lineId, ['paint']);
    addBOMMaterial(q.id, row.lineId, { name: 'm', qty: 1, unit: 'Nos', rate: 100 });
    submitItemBOM(q.id, row.lineId, 'E');
    transferQuotationStage(q.id, 'estimator', 'S'); transferQuotationStage(q.id, 'approver', 'E');
    approveQuotation(q.id, 'A');
    const job = confirmQuotationToJobCard(q.id, 'S');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    submitDepartmentBudget(job.id, 'paint', { materials: 50, labour: 30, subcontract: 0, hiring: 0, others: 0 }, 'E');
    approveDepartmentBudget(job.id, 'paint', 'Operations Manager');
    startPaintingWork(job.id, row.lineId);
    submitPaintingForQC(job.id, row.lineId);
    recordPaintingQCResult(job.id, row.lineId, false, 'Painting Lead', 'Orange peel finish');
    const entry = getJobCard(job.id).items[0].departmentStatuses.find(d => d.department === 'paint');
    return { rejectReason: entry.rejectReason, reasons: getQCRejectReasonsForDept('paint') };
  });
  record('Painting QC fail stores + aggregates its reject reason', pr.rejectReason === 'Orange peel finish' && JSON.stringify(pr.reasons).includes('Orange peel finish') ? 'PASS' : 'FAIL', JSON.stringify(pr));

  // ── Real UI: Joinery Fail button prompts and captures the typed reason ──
  currentStep = 'ui-fail-with-reason';
  const seed = await page.evaluate(() => window.__seedToQC('carp', 'Veneer Cabinet'));
  dialogReason = 'Veneer bubble on left door';
  await page.evaluate(() => { openJoineryModule(); });
  await page.waitForSelector('#joinery-module-wrap', { state: 'visible', timeout: 5000 });
  await page.evaluate(() => joinerySetView('queue'));
  await page.waitForTimeout(200);
  await page.click('#joinery-body button:has-text("Fail")');
  await page.waitForTimeout(200);
  dialogReason = '';
  const uiRes = await page.evaluate((s) => {
    const entry = getJobCard(s.jobId).items[0].departmentStatuses.find(d => d.department === 'carp');
    return { status: entry.status, rejectReason: entry.rejectReason };
  }, seed);
  record('Real Fail button captures the typed reason via the prompt', uiRes.status === 'rework' && uiRes.rejectReason === 'Veneer bubble on left door' ? 'PASS' : 'FAIL', JSON.stringify(uiRes));
  const uiShows = await page.evaluate(() => document.getElementById('joinery-body').innerHTML.includes('Veneer bubble on left door'));
  record('The captured reason shows in the Production Queue row', uiShows ? 'PASS' : 'FAIL', '');

  await browser.close();
  printReport();
  process.exit(results.filter(r => r.status === 'FAIL').length > 0 || pageErrors.length > 0 ? 1 : 0);
})();
