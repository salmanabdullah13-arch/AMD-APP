// Verification for 3 real bugs Salman found using the app: (1) module
// close/back buttons bleeding under the iPhone notch/status bar (no
// safe-area padding), (2) no way to duplicate a quotation line item,
// (3) finishing the quotation wizard silently auto-transferred to
// Estimator instead of requiring the explicit "Transfer to Estimator"
// action.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-bugfixes');
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
  console.log('\n=== BUG FIX VERIFICATION (iPhone safe-area / duplicate item / auto-transfer) ===');
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  currentStep = 'app-loads';
  await page.waitForSelector('#app', { state: 'visible' });
  record('App loads (real Supabase login replaced the old PIN, 4 Aug 2026)', 'PASS');

  // Simulate a real notch/Dynamic Island safe-area-inset-top (env() can't
  // be forced directly in Chromium, so override the --safe-top custom
  // property the app's own CSS already reads from — this is exactly what
  // env(safe-area-inset-top) would resolve to on a real notched iPhone).
  currentStep = 'safe-area-header-padding';
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-top', '47px'));

  const modules = [
    { id: 'sales', wrap: 'sales-module-wrap' }, { id: 'accounts', wrap: 'accounts-module-wrap' },
    { id: 'purchasing', wrap: 'purch-module-wrap' }, { id: 'storekeeper', wrap: 'sk-module-wrap' },
    { id: 'estimation', wrap: 'estimator-module-wrap' }, { id: 'approvals', wrap: 'approver-module-wrap' },
    { id: 'delivery', wrap: 'jobs-module-wrap' }, { id: 'hr', wrap: 'hr-module-wrap' },
    { id: 'curtain', wrap: 'curt-module-wrap' }, { id: 'joinery', wrap: 'joinery-module-wrap' },
    { id: 'upholstery-legacy', wrap: 'upholstery-module-wrap' }, { id: 'painting', wrap: 'painting-module-wrap' }
  ];
  let allPad47 = true; const padResults = {};
  for (const m of modules) {
    await openNode(page, m.id, m.wrap);
    const padTop = await page.evaluate((wrap) => getComputedStyle(document.querySelector(`#${wrap} .ops-header`)).paddingTop, m.wrap);
    padResults[m.id] = padTop;
    if (padTop !== '58px') allPad47 = false;
    await page.evaluate(() => goTo('eco'));
    await page.waitForTimeout(150);
  }
  await shot(page, 'last-module-closed');
  record('Every module header pads for a 47px safe-area-inset-top (11+47=58px)', allPad47 ? 'PASS' : 'FAIL', JSON.stringify(padResults));
  await page.evaluate(() => document.documentElement.style.removeProperty('--safe-top'));

  // ── Bug 2: Duplicate line item ──
  currentStep = 'duplicate-line-item';
  const seed = await page.evaluate(() => {
    const cust = createCustomer({ name: 'BugFix Client', contactPerson: 'Yara', tel: '39778899', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Yara', tel: '39778899', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    return { enqId: enq.id };
  });
  await openNode(page, 'sales', 'sales-module-wrap');
  const qtnId = await page.evaluate((enqId) => {
    const q = convertEnquiryToQuotation(enqId, { projectName: 'BugFix Project', taxPercent: 10, contactPerson: 'Yara' });
    salesActiveQtnId = q.id; salesWizardStep = 2; salesView = 'qtn-wizard'; renderSalesBody();
    return q.id;
  }, seed.enqId);
  await page.waitForTimeout(200);
  await page.fill('#sales-body #it-product', 'Wardrobe Panel A');
  await page.fill('#sales-body #it-qty', '3');
  await page.selectOption('#sales-body #it-unit', 'Nos');   // 5 Sep 2026: the Unit has no default — a person chooses it
  await page.click('#sales-body button:has-text("Add Item")');
  await page.waitForTimeout(150);
  await shot(page, 'item-added-before-duplicate');
  const countBefore = await page.evaluate((id) => quotations.find(q => q.id === id).items.length, qtnId);
  await page.click('#sales-body span[title^="Duplicate"]');
  await page.waitForTimeout(150);
  await shot(page, 'item-duplicated');
  const afterDup = await page.evaluate((id) => quotations.find(q => q.id === id).items, qtnId);
  record('Duplicate creates a second item with the same product/qty', (afterDup.length === countBefore + 1 && afterDup[1].product === 'Wardrobe Panel A' && afterDup[1].qty === 3) ? 'PASS' : 'FAIL', JSON.stringify(afterDup.map(i => ({ product: i.product, qty: i.qty }))));

  // ── Bug 3: finishing the wizard must NOT auto-transfer to Estimator ──
  currentStep = 'no-auto-transfer';
  await page.click('#sales-body button:has-text("Save & Proceed")');
  await page.waitForTimeout(150);
  await shot(page, 'wizard-step3');
  await page.click('#sales-body button:has-text("Update Quotation")');
  await page.waitForTimeout(200);
  await shot(page, 'after-update-quotation');
  const stageAfterFinalise = await page.evaluate((id) => quotations.find(q => q.id === id).stage, qtnId);
  record('Finishing the wizard leaves stage as "sales", does NOT auto-jump to estimator', stageAfterFinalise === 'sales' ? 'PASS' : 'FAIL', `stage=${stageAfterFinalise}`);

  const hubHasTransferButton = await page.evaluate(() => document.getElementById('sales-body').innerHTML.includes('Transfer to Estimator'));
  record('Quotation Hub shows the explicit "Transfer to Estimator" button', hubHasTransferButton ? 'PASS' : 'FAIL');
  await page.click('#sales-body button:has-text("Transfer to Estimator")');
  await page.waitForTimeout(200);
  const stageAfterExplicitTransfer = await page.evaluate((id) => quotations.find(q => q.id === id).stage, qtnId);
  record('Explicit Transfer to Estimator button still works', stageAfterExplicitTransfer === 'estimator' ? 'PASS' : 'FAIL', `stage=${stageAfterExplicitTransfer}`);

  await browser.close();
  printReport();
})();
