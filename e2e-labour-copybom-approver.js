// Verification for a batch of real-usage findings from Salman:
// (1) Estimator Labour tab's department dropdown locked to the item's own
//     chosen department(s), not every department in the company.
// (2) Labour supports both Per Hour and Per Day calc modes.
// (3) Labour Rate is mandatory — ADD is rejected at 0/blank.
// (4) Sales' quotation item Unit field reads the real shared Unit Master
//     (units[]) instead of a separate hardcoded list.
// (5) "Copy BOM from another item" duplicates a full BOM across lines in
//     the same quote, referenced by the item's stable per-quote lineId.
// (6) Approver can click a line item for its full estimation breakdown,
//     and the review page shows a page-level Quote Value/Cost/Profit/VAT
//     summary.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-labour-copybom-approver');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
let shotN = 0;
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label) { shotN++; await page.screenshot({ path: path.join(SHOT_DIR, `${String(shotN).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== LABOUR / COPY-BOM / APPROVER VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}
async function openNode(page, nodeId, wrapId) {
  await page.evaluate((id) => {
    const mesh = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === id);
    if (mesh) mesh.userData.node.launch();
  }, nodeId);
  await page.waitForSelector(`#${wrapId}`, { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  currentStep = 'app-loads';
  await page.waitForSelector('#app', { state: 'visible' });
  record('App loads (real Supabase login replaced the old PIN, 4 Aug 2026)', 'PASS');

  currentStep = 'seed';
  const seed = await page.evaluate(() => {
    const cust = createCustomer({ name: 'LabourTest Client', contactPerson: 'Nasser', tel: '39776655', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Nasser', tel: '39776655', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'LabourTest Project', taxPercent: 10, contactPerson: 'Nasser' });
    addQuotationItem(q.id, { product: 'Cabinet A', qty: 1, unit: 'Nos' });
    addQuotationItem(q.id, { product: 'Cabinet B', qty: 1, unit: 'Nos' });
    const item1 = q.items[0], item2 = q.items[1];
    setItemDepartmentSequence(q.id, item1.lineId, ['carp']);
    // Department auto-suggestion already assigns 'carp' to every item in a
    // Joinery-division quote by division fallback — explicitly clear item2's
    // so the "no department set" gate can actually be tested.
    setItemDepartmentSequence(q.id, item2.lineId, []);
    return { qtnId: q.id, line1: item1.lineId, line2: item2.lineId };
  });

  currentStep = 'open-bom-labour-tab-line1';
  await openNode(page, 'estimation', 'estimator-module-wrap');
  await page.evaluate((args) => { openJobEstimationBOM(args.qtnId, args.line1); }, seed);
  await page.evaluate(() => { estimatorSetBomTab('labour'); });
  await page.waitForTimeout(200);
  await shot(page, 'labour-tab-line1-carp-only');

  const deptOptions1 = await page.evaluate(() => Array.from(document.querySelectorAll('#lab-dept option')).map(o => o.value));
  record('Labour dept dropdown restricted to the item\'s own department(s) (carp only)', (deptOptions1.length === 1 && deptOptions1[0] === 'carp') ? 'PASS' : 'FAIL', JSON.stringify(deptOptions1));

  currentStep = 'suggested-rate-prefill';
  const rateInfo = await page.evaluate(() => ({
    rateVal: document.getElementById('lab-rate').value,
    suggestionShown: document.getElementById('estimator-body').innerHTML.includes('floor average')
  }));
  record('Suggested dept-average rate pre-fills Rate (real payroll aggregate, not a named salary)', Number(rateInfo.rateVal) > 0 && rateInfo.suggestionShown ? 'PASS' : 'FAIL', JSON.stringify(rateInfo));

  currentStep = 'rate-mandatory';
  await page.fill('#lab-rate', '0');
  await page.click('#estimator-body button.primary:has-text("ADD")');
  await page.waitForTimeout(150);
  await shot(page, 'rate-mandatory-blocked');
  const blockedAtZeroRate = await page.evaluate((args) => {
    const item = quotations.find(q => q.id === args.qtnId).items.find(it => it.lineId === args.line1);
    return item.bom.labour.length;
  }, seed);
  record('ADD is rejected with Rate = 0 (mandatory rate enforced)', blockedAtZeroRate === 0 ? 'PASS' : 'FAIL', `labourRows=${blockedAtZeroRate}`);

  currentStep = 'per-day-mode';
  await page.click('#estimator-body button:has-text("Per Day")');
  await page.waitForTimeout(150);
  const dayLabelShown = await page.evaluate(() => document.getElementById('estimator-body').innerHTML.includes('Rate (per day)'));
  record('Per Day mode switches labels to day-based', dayLabelShown ? 'PASS' : 'FAIL');
  await page.fill('#lab-ppl', '2');
  await page.fill('#lab-qty', '3');
  await page.fill('#lab-rate', '5');
  await page.click('#estimator-body button.primary:has-text("ADD")');
  await page.waitForTimeout(150);
  await shot(page, 'labour-added-per-day');
  const labourRow = await page.evaluate((args) => {
    const item = quotations.find(q => q.id === args.qtnId).items.find(it => it.lineId === args.line1);
    return item.bom.labour[0];
  }, seed);
  record('Per-day labour row computed correctly (2 ppl x 3 days x BD5 = BD30)', labourRow && labourRow.calcMode === 'days' && labourRow.manQty === 6 && labourRow.amount === 30 ? 'PASS' : 'FAIL', JSON.stringify(labourRow));

  currentStep = 'dept-not-set-gate';
  await page.evaluate((args) => { openJobEstimationBOM(args.qtnId, args.line2); estimatorSetBomTab('labour'); }, seed);
  await page.waitForTimeout(200);
  await shot(page, 'labour-tab-no-dept-set');
  const gatedNoDept = await page.evaluate(() => document.getElementById('estimator-body').innerHTML.includes('Set this item\'s Department(s)'));
  record('Labour tab blocks entry entirely when no Department is set on the item yet', gatedNoDept ? 'PASS' : 'FAIL');

  currentStep = 'sl-number-and-copy-bom';
  await page.evaluate((args) => { openJobEstimationBOM(args.qtnId, args.line1); estimatorSetBomTab('materials'); }, seed);
  await page.waitForTimeout(150);
  await page.evaluate(() => { estimatorMatSelectedId = 'IT003500'; renderEstimatorBody(); });
  await page.fill('#mat-qty', '2');
  await page.click('#estimator-body button.primary:has-text("ADD")');
  await page.waitForTimeout(150);
  await page.evaluate((args) => { openEstimationIndex(args.qtnId); }, seed);
  await page.waitForTimeout(150);
  await shot(page, 'estimation-index-sl-numbers');
  const slNumbers = await page.evaluate(() => Array.from(document.querySelectorAll('#estimator-body table.sales-items tr td:first-child')).map(td => td.textContent.trim()));
  record('Estimation Index SL column shows stable lineId (1, 2)', JSON.stringify(slNumbers) === JSON.stringify(['1', '2']) ? 'PASS' : 'FAIL', JSON.stringify(slNumbers));

  await page.evaluate((args) => { openJobEstimationBOM(args.qtnId, args.line2); }, seed);
  await page.waitForTimeout(150);
  await shot(page, 'copy-bom-offer-on-line2');
  const copyBlockShown = await page.evaluate(() => document.getElementById('estimator-body').innerHTML.includes('Copy BOM from another item'));
  record('"Copy BOM from another item" offered on line 2 (line 1 has a BOM)', copyBlockShown ? 'PASS' : 'FAIL');
  const copyOptionLabel = await page.evaluate(() => { const o = document.querySelector('#bom-copy-source option'); return o ? o.textContent : null; });
  record('Copy source option is labeled by stable lineId ("#1 — Cabinet A")', copyOptionLabel && copyOptionLabel.includes('#1') ? 'PASS' : 'FAIL', copyOptionLabel);

  await page.click('#estimator-body button:has-text("Copy")');
  await page.waitForTimeout(150);
  await shot(page, 'bom-copied-to-line2');
  const line2BomAfterCopy = await page.evaluate((args) => {
    const item = quotations.find(q => q.id === args.qtnId).items.find(it => it.lineId === args.line2);
    return { materialCount: item.bom.materials.length, submitted: item.bom.submitted };
  }, seed);
  record('BOM copied onto line 2 (materials present, marked unsubmitted for review)', line2BomAfterCopy.materialCount === 1 && line2BomAfterCopy.submitted === false ? 'PASS' : 'FAIL', JSON.stringify(line2BomAfterCopy));

  currentStep = 'sales-unit-master';
  await openNode(page, 'sales', 'sales-module-wrap');
  await page.evaluate((args) => { openQuotationWizard(args.qtnId, 2); }, seed);
  await page.waitForTimeout(200);
  const unitOptionsFromRealMaster = await page.evaluate(() => {
    const domOptions = Array.from(document.querySelectorAll('#it-unit option')).map(o => o.value).filter(Boolean);   // minus the 'Choose…' placeholder (5 Sep 2026)
    const realMasterNames = units.map(u => u.name);
    return JSON.stringify(domOptions) === JSON.stringify(realMasterNames);
  });
  record('Sales quotation item Unit select reads the real shared Unit Master (units[])', unitOptionsFromRealMaster ? 'PASS' : 'FAIL');

  currentStep = 'approver-detail-and-summary';
  await page.evaluate((args) => {
    transferQuotationStage(args.qtnId, 'estimator', 'Salman Abdullah');
    transferQuotationStage(args.qtnId, 'approver', 'Estimator User');
  }, seed);
  await openNode(page, 'approvals', 'approver-module-wrap');
  await page.evaluate((args) => { openApproverReview(args.qtnId); }, seed);
  await page.waitForTimeout(200);
  await shot(page, 'approver-review-with-summary');
  const summaryShown = await page.evaluate(() => document.getElementById('approver-body').innerHTML.includes('Quote Summary') && document.getElementById('approver-body').innerHTML.includes('Grand Total'));
  record('Approver review page shows the Quote Summary (value/cost/profit/VAT/grand total)', summaryShown ? 'PASS' : 'FAIL');

  await page.click('#approver-body table.sales-items tr:nth-child(2)');
  await page.waitForTimeout(150);
  await shot(page, 'approver-item-detail-modal');
  const detailModalShown = await page.evaluate(() => {
    const modal = document.getElementById('apr-detail-modal');
    return getComputedStyle(modal).display !== 'none' && modal.innerHTML.includes('Materials');
  });
  record('Clicking a line item opens its full estimation breakdown (read-only)', detailModalShown ? 'PASS' : 'FAIL');

  await browser.close();
  printReport();
})();
