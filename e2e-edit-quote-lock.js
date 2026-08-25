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

  currentStep = 'app-loads';
  await page.waitForSelector('#app', { state: 'visible' });
  record('App loads (real Supabase login replaced the old PIN, 4 Aug 2026)', 'PASS');

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
  const editVisibleAtSales = await page.evaluate(() => Array.from(document.querySelectorAll('#sales-body .qh-pill')).some(t => t.textContent.includes('Edit quote')));
  record('Edit Quote tile IS visible while stage=sales', editVisibleAtSales ? 'PASS' : 'FAIL');

  currentStep = 'edit-locked-at-estimator-stage';
  await page.evaluate((id) => { transferQuotationStage(id, 'estimator', 'Salman Abdullah'); }, qtnId);
  await openHub();
  await shot(page, 'hub-stage-estimator');
  const editHiddenAtEstimator = await page.evaluate(() => !Array.from(document.querySelectorAll('#sales-body .qh-pill')).some(t => t.textContent.includes('Edit quote')));
  record('Edit Quote tile is GONE while stage=estimator', editHiddenAtEstimator ? 'PASS' : 'FAIL');
  const lockNoteShown = await page.evaluate(() => /edit quote is locked/i.test(document.getElementById('sales-body').innerHTML));
  record('Lock explanation note shown while stage=estimator', lockNoteShown ? 'PASS' : 'FAIL');

  currentStep = 'edit-locked-at-approver-stage';
  await page.evaluate((id) => { transferQuotationStage(id, 'approver', 'Estimator User'); }, qtnId);
  await openHub();
  await shot(page, 'hub-stage-approver');
  const editHiddenAtApprover = await page.evaluate(() => !Array.from(document.querySelectorAll('#sales-body .qh-pill')).some(t => t.textContent.includes('Edit quote')));
  record('Edit Quote tile is GONE while stage=approver', editHiddenAtApprover ? 'PASS' : 'FAIL');

  currentStep = 'edit-reopens-after-back-to-sales';
  await page.evaluate((id) => { transferQuotationStage(id, 'sales', 'Approver User'); }, qtnId);
  await openHub();
  await shot(page, 'hub-back-to-sales');
  const editReopened = await page.evaluate(() => Array.from(document.querySelectorAll('#sales-body .qh-pill')).some(t => t.textContent.includes('Edit quote')));
  record('Edit Quote tile REOPENS once sent back to Sales', editReopened ? 'PASS' : 'FAIL');

  // And confirm it's actually clickable/functional again, not just visible
  await page.setViewportSize({ width: 1280, height: 900 });   // action row is desktop-only (§10)
  await page.click('#sales-body .qh-pill:has-text("Edit quote")');
  await page.waitForTimeout(150);
  // The pill opens an inline sheet (record package §4); the item editor is the
  // action inside it.
  await page.click('#sales-body .qh-pill:has-text("Open the item editor")');
  await page.waitForTimeout(150);
  const wizardOpened = await page.evaluate(() => salesView === 'qtn-wizard');
  record('Edit Quote is actually clickable and opens the wizard once reopened', wizardOpened ? 'PASS' : 'FAIL');

  // 9 Aug 2026: this suite never exercised lifecycleStatus === 'confirmed',
  // which is exactly how an editable confirmed quote shipped. The stage-based
  // lock above passes on a confirmed quote — approveQuotation() sets stage back
  // to 'sales' so Sales can confirm, so the tile is visible at that point and
  // always was. The freeze is a separate rule (quotationLock, data.js), and
  // e2e-quote-confirmed-lock.js covers it in full; this is the regression guard
  // that stops the two locks being confused for each other again.
  currentStep = 'confirmed-is-a-different-lock';
  const confirmedState = await page.evaluate((id) => {
    const q = quotations.find(x => x.id === id);
    q.lifecycleStatus = 'open';
    q.stage = 'sales';
    const job = confirmQuotationToJobCard(id, 'Sales User');
    return { jobId: job && job.id, stage: q.stage, lifecycle: q.lifecycleStatus };
  }, qtnId);
  await openHub();
  await shot(page, 'hub-confirmed');
  const confirmedLock = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('#sales-body .qh-pill'));
    const edit = tiles.find(t => t.textContent.includes('Edit quote'));
    return { present: !!edit, greyed: !!edit && edit.classList.contains('is-off') };
  });
  record('A confirmed quote sits at stage "sales", so the stage lock alone does NOT hide Edit Quote',
    confirmedState.stage === 'sales' && confirmedLock.present ? 'PASS' : 'FAIL', JSON.stringify(confirmedState));
  record('The confirmed-quote freeze greys it instead',
    confirmedLock.greyed ? 'PASS' : 'FAIL', JSON.stringify(confirmedLock));

  await browser.close();
  printReport();
})();
