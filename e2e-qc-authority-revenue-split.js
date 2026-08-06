// Verification for the 6 Aug 2026 audit — Phase C (part 2) + Phase D (part 2),
// both Salman's explicit calls:
//   - QC-pass authority: a QC PASS may only be recorded by the department's
//     own QC authority (DEPT_QC_AUTHORITY — "the production manager should do
//     QC"); a FAIL stays open to anyone.
//   - Revenue split: a multi-department item's value splits across divisions
//     proportional to each department's APPROVED budget cost; equal split
//     when no budgets are approved; single-department items unchanged.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== QC AUTHORITY + REVENUE SPLIT VERIFICATION ===');
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

  await page.evaluate(() => {
    window.__seedToQC = function (deptSeq, product) {
      const c = createCustomer({ name: 'QA ' + Math.random().toString(36).slice(2, 7), contactPerson: 'X', tel: '39' + Math.floor(100000 + Math.random() * 899999), address: 'Manama' });
      const e = createEnquiry({ division: 'Furniture', customerId: c.id, contactPerson: 'X', tel: c.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
      const q = convertEnquiryToQuotation(e.id, { projectName: product, taxPercent: 10, contactPerson: 'X' });
      const row = addQuotationItem(q.id, { product, qty: 1, unit: 'Nos', vatPercent: 10 });
      setItemDepartmentSequence(q.id, row.lineId, deptSeq);
      addBOMMaterial(q.id, row.lineId, { name: 'm', qty: 1, unit: 'Nos', rate: 500 });
      submitItemBOM(q.id, row.lineId, 'E');
      transferQuotationStage(q.id, 'estimator', 'S'); transferQuotationStage(q.id, 'approver', 'E');
      approveQuotation(q.id, 'A');
      const job = confirmQuotationToJobCard(q.id, 'S');
      confirmJobRouting(job.id, {}, 'Operations Manager');
      return { job, lineId: row.lineId };
    };
    window.__toQCStage = function (job, lineId, deptKey) {
      submitDepartmentBudget(job.id, deptKey, { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'E');
      approveDepartmentBudget(job.id, deptKey, 'Operations Manager');
      startLineProduction(job.id, lineId, deptKey);
      const entry = job.items.find(i => i.lineId === lineId).departmentStatuses.find(d => d.department === deptKey);
      if (deptKey === 'carp' && entry.joinerySubStage) ['cutting', 'veneer-pressing', 'assembly'].forEach(s => advanceJoinerySubStage(job.id, lineId, s));
      submitLineForQC(job.id, lineId, deptKey);
    };
  });

  // ── QC-pass authority ──
  currentStep = 'qc-authority';
  const qa = await page.evaluate(() => {
    const { job, lineId } = window.__seedToQC(['carp'], 'Authority Cabinet');
    window.__toQCStage(job, lineId, 'carp');
    const rogue = recordLineQCResult(job.id, lineId, 'carp', true, 'Random Floor Guy');
    const rightPass = recordLineQCResult(job.id, lineId, 'carp', true, DEPT_QC_AUTHORITY.carp);
    // fail by anyone on a second job — flagging a problem is never gated
    const s2 = window.__seedToQC(['carp'], 'Authority Cabinet 2');
    window.__toQCStage(s2.job, s2.lineId, 'carp');
    const anyFail = recordLineQCResult(s2.job.id, s2.lineId, 'carp', false, 'Random Floor Guy', 'chip on edge');
    return {
      roguePass: rogue.error || 'ALLOWED',
      rightPass: rightPass.error || 'ok',
      anyFail: anyFail.error || 'ok'
    };
  });
  record('QC pass by a non-authority identity is blocked', qa.roguePass !== 'ALLOWED' ? 'PASS' : 'FAIL', qa.roguePass);
  record('QC pass by the department QC authority succeeds', qa.rightPass === 'ok' ? 'PASS' : 'FAIL', qa.rightPass);
  record('QC fail stays open to anyone (flagging is never gated)', qa.anyFail === 'ok' ? 'PASS' : 'FAIL', qa.anyFail);

  currentStep = 'qc-authority-painting';
  const qp = await page.evaluate(() => {
    const { job, lineId } = window.__seedToQC(['paint'], 'Authority Panel');
    submitDepartmentBudget(job.id, 'paint', { materials: 50, labour: 30, subcontract: 0, hiring: 0, others: 0 }, 'E');
    approveDepartmentBudget(job.id, 'paint', 'Operations Manager');
    startPaintingWork(job.id, lineId);
    submitPaintingForQC(job.id, lineId);
    const rogue = recordPaintingQCResult(job.id, lineId, true, 'Random Painter');
    const right = recordPaintingQCResult(job.id, lineId, true, DEPT_QC_AUTHORITY.paint);
    return { rogue: rogue.error || 'ALLOWED', right: right.error || 'ok' };
  });
  record('Painting QC pass gated to its Lead the same way', qp.rogue !== 'ALLOWED' && qp.right === 'ok' ? 'PASS' : 'FAIL', JSON.stringify(qp));

  // ── Real UI still works (module identity IS the authority) ──
  currentStep = 'qc-authority-ui';
  const uiSeed = await page.evaluate(() => {
    const { job, lineId } = window.__seedToQC(['uph'], 'Authority Sofa');
    window.__toQCStage(job, lineId, 'uph');
    return { jobId: job.id, lineId };
  });
  await page.evaluate(() => { openUpholsteryModule(); });
  await page.waitForSelector('#upholstery-module-wrap', { state: 'visible', timeout: 5000 });
  await page.evaluate(() => upholsterySetView('queue'));
  await page.waitForTimeout(200);
  await page.click('#upholstery-body button:has-text("Pass")');
  await page.waitForTimeout(200);
  const uiPass = await page.evaluate((s) => {
    const entry = getJobCard(s.jobId).items[0].departmentStatuses.find(d => d.department === 'uph');
    return entry.status;
  }, uiSeed);
  record('Real Upholstery Pass button still works (module identity is the authority)', uiPass === 'ready-for-handoff' ? 'PASS' : 'FAIL', uiPass);

  // ── Revenue split by approved budget share ──
  currentStep = 'revenue-split-budgets';
  const rs = await page.evaluate(() => {
    const rev0 = getMonthlyRevenueByDivision(2);
    const key = rev0.months[rev0.months.length - 1].key;
    const jBefore = rev0.byMonthDiv[key]['Joinery'];
    const uBefore = rev0.byMonthDiv[key]['Upholstery'];
    const fBefore = rev0.byMonthDiv[key]['Furniture'];
    // sofa: carp+uph, budgets approved 600 carp / 300 uph -> 2:1 split
    const { job } = window.__seedToQC(['carp', 'uph'], 'Split Sofa');
    submitDepartmentBudget(job.id, 'carp', { materials: 400, labour: 200, subcontract: 0, hiring: 0, others: 0 }, 'E');
    approveDepartmentBudget(job.id, 'carp', 'Operations Manager');
    submitDepartmentBudget(job.id, 'uph', { materials: 200, labour: 100, subcontract: 0, hiring: 0, others: 0 }, 'E');
    approveDepartmentBudget(job.id, 'uph', 'Operations Manager');
    const rev1 = getMonthlyRevenueByDivision(2);
    return {
      jobAmount: job.amount,
      joineryDelta: rev1.byMonthDiv[key]['Joinery'] - jBefore,
      upholsteryDelta: rev1.byMonthDiv[key]['Upholstery'] - uBefore,
      furnitureDelta: rev1.byMonthDiv[key]['Furniture'] - fBefore
    };
  });
  const rsOk = Math.abs(rs.joineryDelta - rs.jobAmount * (2 / 3)) < 0.01
    && Math.abs(rs.upholsteryDelta - rs.jobAmount * (1 / 3)) < 0.01
    && Math.abs(rs.furnitureDelta) < 0.01;
  record('Multi-dept item splits 2:1 across Joinery/Upholstery by approved budget cost', rsOk ? 'PASS' : 'FAIL', JSON.stringify(rs));

  currentStep = 'revenue-split-fallbacks';
  const rf = await page.evaluate(() => {
    const rev0 = getMonthlyRevenueByDivision(2);
    const key = rev0.months[rev0.months.length - 1].key;
    const jBefore = rev0.byMonthDiv[key]['Joinery'];
    const uBefore = rev0.byMonthDiv[key]['Upholstery'];
    // no budgets approved yet -> equal split
    const { job } = window.__seedToQC(['carp', 'uph'], 'Split Sofa NoBudget');
    const rev1 = getMonthlyRevenueByDivision(2);
    const equalOk = Math.abs((rev1.byMonthDiv[key]['Joinery'] - jBefore) - job.amount / 2) < 0.01
      && Math.abs((rev1.byMonthDiv[key]['Upholstery'] - uBefore) - job.amount / 2) < 0.01;
    // single-dept item stays wholly on the enquiry division (Furniture here)
    const fBefore = rev1.byMonthDiv[key]['Furniture'];
    const single = window.__seedToQC(['uph'], 'Single Armchair');
    const rev2 = getMonthlyRevenueByDivision(2);
    const singleOk = Math.abs((rev2.byMonthDiv[key]['Furniture'] - fBefore) - single.job.amount) < 0.01;
    // carp+paint both map to Joinery -> whole value lands in Joinery
    const j2Before = rev2.byMonthDiv[key]['Joinery'];
    const painted = window.__seedToQC(['carp', 'paint'], 'Split Painted Unit');
    const rev3 = getMonthlyRevenueByDivision(2);
    const paintFoldOk = Math.abs((rev3.byMonthDiv[key]['Joinery'] - j2Before) - painted.job.amount) < 0.01;
    return { equalOk, singleOk, paintFoldOk };
  });
  record('No approved budgets -> honest equal split', rf.equalOk ? 'PASS' : 'FAIL', '');
  record('Single-department item unchanged (stays on enquiry division)', rf.singleOk ? 'PASS' : 'FAIL', '');
  record('carp+paint item folds wholly into Joinery (paint maps to Joinery)', rf.paintFoldOk ? 'PASS' : 'FAIL', '');

  await browser.close();
  printReport();
  process.exit(results.filter(r => r.status === 'FAIL').length > 0 || pageErrors.length > 0 ? 1 : 0);
})();
