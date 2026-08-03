// Verification: Edit Quote must be locked out while a quotation is with
// the Estimator or Approver, and reopen only once it's sent back to Sales.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-edit-lock');
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
  console.log('\n=== EDIT QUOTE LOCK VERIFICATION ===');
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

  currentStep = 'pin-unlock';
  for (const d of ['1', '9', '9', '4']) { await page.click(`.num-btn[onclick="pt('${d}')"]`); await page.waitForTimeout(120); }
  await page.waitForSelector('#app', { state: 'visible' });
  record('PIN unlock', 'PASS');

  currentStep = 'seed';
  const qtnId = await page.evaluate(() => {
    const cust = createCustomer({ name: 'EditLock Client', contactPerson: 'Sami', tel: '39990011', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Sami', tel: '39990011', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'EditLock Project', taxPercent: 10, contactPerson: 'Sami' });
    addQuotationItem(q.id, { product: 'Test Item', qty: 1, unit: 'Nos' });
    return q.id;
  });

  const openHub = async () => {
    await page.evaluate((id) => { openSalesModule(); openQuotationHub(id); }, qtnId);
    await page.waitForTimeout(200);
  };

  currentStep = 'edit-visible-at-sales-stage';
  await openHub();
  await shot(page, 'hub-stage-sales');
  const editVisibleAtSales = await page.evaluate(() => Array.from(document.querySelectorAll('#sales-body .sales-tile')).some(t => t.textContent.includes('Edit Quote')));
  record('Edit Quote tile IS visible while stage=sales', editVisibleAtSales ? 'PASS' : 'FAIL');

  currentStep = 'edit-locked-at-estimator-stage';
  await page.evaluate((id) => { transferQuotationStage(id, 'estimator', 'Salman Abdullah'); }, qtnId);
  await openHub();
  await shot(page, 'hub-stage-estimator');
  const editHiddenAtEstimator = await page.evaluate(() => !Array.from(document.querySelectorAll('#sales-body .sales-tile')).some(t => t.textContent.includes('Edit Quote')));
  record('Edit Quote tile is GONE while stage=estimator', editHiddenAtEstimator ? 'PASS' : 'FAIL');
  const lockNoteShown = await page.evaluate(() => document.getElementById('sales-body').innerHTML.includes('Edit Quote is locked'));
  record('Lock explanation note shown while stage=estimator', lockNoteShown ? 'PASS' : 'FAIL');

  currentStep = 'edit-locked-at-approver-stage';
  await page.evaluate((id) => { transferQuotationStage(id, 'approver', 'Estimator User'); }, qtnId);
  await openHub();
  await shot(page, 'hub-stage-approver');
  const editHiddenAtApprover = await page.evaluate(() => !Array.from(document.querySelectorAll('#sales-body .sales-tile')).some(t => t.textContent.includes('Edit Quote')));
  record('Edit Quote tile is GONE while stage=approver', editHiddenAtApprover ? 'PASS' : 'FAIL');

  currentStep = 'edit-reopens-after-back-to-sales';
  await page.evaluate((id) => { transferQuotationStage(id, 'sales', 'Approver User'); }, qtnId);
  await openHub();
  await shot(page, 'hub-back-to-sales');
  const editReopened = await page.evaluate(() => Array.from(document.querySelectorAll('#sales-body .sales-tile')).some(t => t.textContent.includes('Edit Quote')));
  record('Edit Quote tile REOPENS once sent back to Sales', editReopened ? 'PASS' : 'FAIL');

  // And confirm it's actually clickable/functional again, not just visible
  await page.click('#sales-body .sales-tile:has-text("Edit Quote")');
  await page.waitForTimeout(150);
  const wizardOpened = await page.evaluate(() => salesView === 'qtn-wizard');
  record('Edit Quote is actually clickable and opens the wizard once reopened', wizardOpened ? 'PASS' : 'FAIL');

  await browser.close();
  printReport();
})();
