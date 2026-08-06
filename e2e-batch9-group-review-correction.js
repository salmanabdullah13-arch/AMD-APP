// Verification for Salman's "findings" batch: (1) Enquiry pulls+locks Tel
// from an existing customer, (2) Quote items get Group/Sub Group headers +
// stable serials, (3) Copy Group/Sub Group duplicates a whole section,
// (4) the pre-existing "Copy BOM" label collision is fixed (now "Review
// BOM"), (5) Estimator gets a Review screen with a direct Transfer-to-
// Approver action, (6) Approver can correct Product/Description/Price with
// a mandatory reason + audit trail, (7)/(8) Sales' "My Jobs" tab shows
// read-only status for the salesperson's own jobs with an Add Variation
// shortcut.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-batch9');
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
  console.log('\n=== BATCH 9 VERIFICATION (Group/Copy/Review/Correction/MyJobs) ===');
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
  page.on('dialog', async d => { await d.accept(d.type() === 'prompt' ? 'test reason' : undefined); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  currentStep = 'app-loads';
  await page.waitForSelector('#app', { state: 'visible' });
  record('App loads (real Supabase login replaced the old PIN, 4 Aug 2026)', 'PASS');

  currentStep = 'seed-customer';
  const cust = await page.evaluate(() => createCustomer({ name: 'Batch9 Client', contactPerson: 'Huda', tel: '39887766', address: 'Manama' }));

  // ── 1. Enquiry Tel pull + lock ──
  currentStep = 'enquiry-tel-lock';
  await openNode(page, 'sales', 'sales-module-wrap');
  await page.evaluate(() => { salesSetTopView('enquiries'); openEnquiryCreate(); });
  await page.waitForTimeout(150);
  await page.locator('#sales-body select').nth(1).selectOption(cust.id);
  await page.waitForTimeout(150);
  await shot(page, 'enquiry-tel-locked');
  const telLocked = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('#sales-body label')).find(l => l.textContent.trim() === 'Tel');
    const input = label ? label.parentElement.querySelector('input') : null;
    return input ? { value: input.value, disabled: input.disabled } : null;
  });
  record('Selecting an existing customer pulls Tel and disables the field', telLocked && telLocked.value === '39887766' && telLocked.disabled === true ? 'PASS' : 'FAIL', JSON.stringify(telLocked));

  // ── 2 & 3. Group/Sub Group headers + Copy Group/Sub Group ──
  currentStep = 'group-subgroup-quote';
  const qtnId = await page.evaluate(() => {
    salesCurrentUser = 'Salman Abdullah';
    const cust = customers.find(c => c.name === 'Batch9 Client');
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Huda', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'Batch9 Project', taxPercent: 10, contactPerson: 'Huda' });
    addQuotationItem(q.id, { group: 'RECEPTION AREA', subgroup: 'Reception Counter', product: 'Counter', qty: 1, unit: 'Nos' });
    addQuotationItem(q.id, { group: 'RECEPTION AREA', subgroup: 'Wall Cladding', product: 'Cladding A', qty: 1, unit: 'Nos' });
    addQuotationItem(q.id, { group: 'PANTRY AREA', subgroup: 'Pantry Cabinet', product: 'Cabinet', qty: 1, unit: 'Nos' });
    return q.id;
  });
  await page.evaluate((id) => { openQuotationWizard(id, 2); }, qtnId);
  await page.waitForTimeout(200);
  await shot(page, 'quote-items-with-groups');
  const hierarchyCheck = await page.evaluate((id) => {
    const q = quotations.find(x => x.id === id);
    return computeQuoteHierarchy(q.items).map(h => ({ serial: h.serial, isNewGroup: h.isNewGroup, isNewSubgroup: h.isNewSubgroup }));
  }, qtnId);
  record('computeQuoteHierarchy assigns Group.SubGroup.Item serials correctly', JSON.stringify(hierarchyCheck) === JSON.stringify([
    { serial: '1.1.0', isNewGroup: true, isNewSubgroup: true },
    { serial: '1.2.0', isNewGroup: false, isNewSubgroup: true },
    { serial: '2.1.0', isNewGroup: true, isNewSubgroup: true }
  ]) ? 'PASS' : 'FAIL', JSON.stringify(hierarchyCheck));
  const groupHeaderShown = await page.evaluate(() => document.getElementById('sales-body').innerHTML.includes('RECEPTION AREA') && document.getElementById('sales-body').innerHTML.includes('PANTRY AREA'));
  record('Group header rows render in the Sales item table', groupHeaderShown ? 'PASS' : 'FAIL');
  const copyGroupBtn = await page.evaluate(() => !!document.querySelector('#sales-body span[onclick*="Copy Group"]') || document.getElementById('sales-body').innerHTML.includes('Copy Group'));
  record('"Copy Group" action is offered on the Group header', copyGroupBtn ? 'PASS' : 'FAIL');

  await page.click('#sales-body span:has-text("Copy Group")');
  await page.waitForTimeout(150);
  await shot(page, 'after-copy-group');
  const afterCopyGroup = await page.evaluate((id) => quotations.find(q => q.id === id).items.length, qtnId);
  record('Copy Group duplicates every item in that group (3 -> 5)', afterCopyGroup === 5 ? 'PASS' : 'FAIL', `itemCount=${afterCopyGroup}`);

  // ── 4. "Copy BOM" label collision fixed ──
  currentStep = 'label-collision-fix';
  const bomLabelInfo = await page.evaluate((id) => {
    const q = quotations.find(x => x.id === id);
    const item = q.items[0];
    addBOMMaterial(id, item.lineId, { name: 'Test Mat', qty: 1, unit: 'Nos', rate: 10 });
    submitItemBOM(id, item.lineId);
    item.qty = 5; // force qtyDrifted
    return true;
  }, qtnId);
  await page.evaluate((id) => { openEstimatorModule(); openEstimationIndex(id); }, qtnId);
  await page.waitForTimeout(200);
  await shot(page, 'estimation-index-review-bom-label');
  const noCopyBomLabel = await page.evaluate(() => !document.getElementById('estimator-body').innerHTML.includes('>Copy BOM<'));
  const hasReviewBomLabel = await page.evaluate(() => document.getElementById('estimator-body').innerHTML.includes('Review BOM'));
  record('Old misleading "Copy BOM" label is gone from the Estimation Index', noCopyBomLabel ? 'PASS' : 'FAIL');
  record('Renamed to "Review BOM" for the qty-drifted case', hasReviewBomLabel ? 'PASS' : 'FAIL');

  // ── 5. Estimator Review screen ──
  currentStep = 'estimator-review-screen';
  await page.click('#estimator-body button:has-text("Review & Send to Approver")');
  await page.waitForTimeout(200);
  await shot(page, 'estimator-review-screen');
  const reviewScreenShown = await page.evaluate(() => document.getElementById('estimator-body').innerHTML.includes('Quote Summary') && document.getElementById('estimator-body').innerHTML.includes('Grand Total'));
  record('Estimator Review screen shows the Quote Summary', reviewScreenShown ? 'PASS' : 'FAIL');
  await page.click('#estimator-body button:has-text("Transfer to Approver")');
  await page.waitForTimeout(150);
  const stageAfterDirectTransfer = await page.evaluate((id) => quotations.find(q => q.id === id).stage, qtnId);
  record('Transfer to Approver works directly from the Review screen (no need to visit Manage Quote hub)', stageAfterDirectTransfer === 'approver' ? 'PASS' : 'FAIL', `stage=${stageAfterDirectTransfer}`);

  // ── 6. Approver correction with mandatory reason + audit trail ──
  currentStep = 'approver-correction';
  await openNode(page, 'approvals', 'approver-module-wrap');
  await page.evaluate((id) => { openApproverReview(id); }, qtnId);
  await page.waitForTimeout(200);
  await page.click('#approver-body table.sales-items tr:nth-child(2)');
  await page.waitForTimeout(150);
  await page.click('#apr-detail-modal button:has-text("Correct Product")');
  await page.waitForTimeout(150);
  await shot(page, 'approver-correction-panel-open');
  await page.fill('#apr-corr-product', 'Corrected Counter Name');
  await page.fill('#apr-corr-rate', '250');
  await page.fill('#apr-corr-reason', 'Typo in product name and price was wrong per client discussion.');
  await page.click('#apr-detail-modal button:has-text("Save Correction")');
  await page.waitForTimeout(150);
  await shot(page, 'approver-correction-saved');
  const correctedItem = await page.evaluate((args) => {
    const q = quotations.find(x => x.id === args.id);
    return q.items.find(it => it.lineId === args.line1);
  }, { id: qtnId, line1: 1 });
  record('Correction applied: product renamed + rate updated + priceManuallyOverridden flagged', correctedItem.product === 'Corrected Counter Name' && correctedItem.rate === 250 && correctedItem.priceManuallyOverridden === true ? 'PASS' : 'FAIL', JSON.stringify(correctedItem));
  record('Correction is recorded on item.corrections with reason + before/after', correctedItem.corrections.length === 1 && correctedItem.corrections[0].reason.includes('Typo') && correctedItem.corrections[0].changes.rate.from === 13.65 && correctedItem.corrections[0].changes.rate.to === 250 ? 'PASS' : 'FAIL', JSON.stringify(correctedItem.corrections));
  const auditShowsCorrection = await page.evaluate((id) => quotations.find(q => q.id === id).auditLog.some(a => a.action === 'Correct Item'), qtnId);
  record('Correction is logged in the quotation audit trail (visible in every module\'s Audit Trail table)', auditShowsCorrection ? 'PASS' : 'FAIL');

  currentStep = 'mandatory-reason-enforced';
  const rejectedNoReason = await page.evaluate((args) => approverCorrectItem(args.id, args.line1, { product: 'Should Not Save' }, '', 'Salman Abdullah'), { id: qtnId, line1: 1 });
  record('A correction with no reason is rejected', rejectedNoReason && rejectedNoReason.error ? 'PASS' : 'FAIL', JSON.stringify(rejectedNoReason));

  // ── 7/8. Sales "My Jobs" + Add Variation ──
  currentStep = 'sales-my-jobs';
  const jobId = await page.evaluate((id) => {
    const qtn = quotations.find(q => q.id === id);
    transferQuotationStage(id, 'approver', 'Estimator'); approveQuotation(id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(id, 'Salman Abdullah');
    return job.id;
  }, qtnId);
  await openNode(page, 'sales', 'sales-module-wrap');
  await page.evaluate(() => { salesSetTopView('myjobs'); });
  await page.waitForTimeout(200);
  await shot(page, 'sales-my-jobs-tab');
  const myJobsShown = await page.evaluate((args) => document.getElementById('sales-body').innerHTML.includes(args.jobId) && document.getElementById('sales-body').innerHTML.includes('Batch9 Project'), { jobId });
  record('My Jobs tab shows the salesperson\'s own confirmed job', myJobsShown ? 'PASS' : 'FAIL');
  const addVariationBtnShown = await page.evaluate(() => document.getElementById('sales-body').innerHTML.includes('Add Variation'));
  record('Add Variation shortcut is present on the job row', addVariationBtnShown ? 'PASS' : 'FAIL');

  await page.click('#sales-body button:has-text("Add Variation")');
  await page.waitForTimeout(250);
  const variationOpened = await page.evaluate(() => salesView === 'qtn-wizard');
  record('Add Variation from My Jobs opens the Sales wizard for the new variation', variationOpened ? 'PASS' : 'FAIL');

  await browser.close();
  printReport();
})();
