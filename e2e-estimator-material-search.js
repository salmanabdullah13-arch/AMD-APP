// Verification: Estimator's BOM "Add Material" Item Name field must be a
// strict search-and-select against the real Item Master — Salman's call:
// free-typed names were silently accepted before with itemId:null, invisible
// to real inventory. Now ADD is disabled until a real item is selected.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-material-search');
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
  console.log('\n=== ESTIMATOR MATERIAL SEARCH VERIFICATION ===');
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
  const qtnId = await page.evaluate(() => {
    const cust = createCustomer({ name: 'MatSearch Client', contactPerson: 'Reem', tel: '39221100', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Reem', tel: '39221100', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'MatSearch Project', taxPercent: 10, contactPerson: 'Reem' });
    addQuotationItem(q.id, { product: 'Test Cabinet', qty: 1, unit: 'Nos' });
    return q.id;
  });
  const lineId = await page.evaluate((id) => quotations.find(q => q.id === id).items[0].lineId, qtnId);

  currentStep = 'open-bom-materials-tab';
  await openNode(page, 'estimation', 'estimator-module-wrap');
  await page.evaluate((args) => { openJobEstimationBOM(args.qtnId, args.lineId); }, { qtnId, lineId });
  await page.waitForTimeout(200);
  await shot(page, 'materials-tab-empty-search');

  const addDisabledInitially = await page.evaluate(() => document.querySelector('#estimator-body button.primary').disabled);
  record('ADD button is disabled with no item selected', addDisabledInitially ? 'PASS' : 'FAIL');

  const hasFreeTextNameInput = await page.evaluate(() => !!document.getElementById('mat-name'));
  record('Old free-text #mat-name input is gone', !hasFreeTextNameInput ? 'PASS' : 'FAIL');

  currentStep = 'search-and-see-results';
  await page.fill('#mat-search', 'Cord');
  await page.waitForTimeout(150);
  await shot(page, 'search-results-list');
  const resultCount = await page.evaluate(() => document.querySelectorAll('#estimator-body .sales-card div[onclick^="estimatorSelectMaterialItem"]').length);
  record('Typing "Cord" shows matching inventory items in a results list', resultCount >= 1 ? 'PASS' : 'FAIL', `resultCount=${resultCount}`);

  currentStep = 'search-no-match';
  await page.fill('#mat-search', 'zzz-nonexistent-item-zzz');
  await page.waitForTimeout(150);
  await shot(page, 'search-no-match');
  const noMatchMsgShown = await page.evaluate(() => document.getElementById('estimator-body').innerHTML.includes('No matching inventory item'));
  record('Typing a non-existent name shows "No matching inventory item" (no accept path)', noMatchMsgShown ? 'PASS' : 'FAIL');
  const stillNoNameInput = await page.evaluate(() => !document.getElementById('mat-name'));
  record('Still no way to free-type and submit an arbitrary name', stillNoNameInput ? 'PASS' : 'FAIL');

  currentStep = 'select-real-item';
  await page.fill('#mat-search', 'Cord Rail');
  await page.waitForTimeout(150);
  await page.click('#estimator-body .sales-card div[onclick^="estimatorSelectMaterialItem"]');
  await page.waitForTimeout(150);
  await shot(page, 'item-selected');
  const selectedInfo = await page.evaluate(() => ({
    rate: document.getElementById('mat-rate').value,
    unit: document.getElementById('mat-unit').value,
    unitReadonly: document.getElementById('mat-unit').readOnly,
    addEnabled: !document.querySelector('#estimator-body button.primary').disabled,
    showsSelectedName: document.getElementById('estimator-body').innerHTML.includes('Cord Rail')
  }));
  record('Selecting an item auto-fills Rate/Unit and enables ADD', (selectedInfo.addEnabled && Number(selectedInfo.rate) === 3.6 && selectedInfo.unit === 'Meters') ? 'PASS' : 'FAIL', JSON.stringify(selectedInfo));
  record('Unit is locked (readonly) once a real item is selected', selectedInfo.unitReadonly ? 'PASS' : 'FAIL');

  currentStep = 'add-material';
  await page.fill('#mat-qty', '5');
  await page.click('#estimator-body button.primary:has-text("ADD")');
  await page.waitForTimeout(150);
  await shot(page, 'material-added');
  const addedMaterial = await page.evaluate((args) => {
    const item = quotations.find(q => q.id === args.qtnId).items.find(it => it.lineId === args.lineId);
    return item.bom.materials[0];
  }, { qtnId, lineId });
  record('Material added with a real itemId linked (not null)', !!addedMaterial && addedMaterial.itemId !== null ? 'PASS' : 'FAIL', JSON.stringify(addedMaterial));
  record('Added material name matches the real inventory item exactly', addedMaterial && addedMaterial.name === 'Cord Rail — Heavy Duty White (COR001)' ? 'PASS' : 'FAIL');

  const formResetAfterAdd = await page.evaluate(() => !!document.getElementById('mat-search') && document.querySelector('#estimator-body button.primary').disabled);
  record('Form resets to empty search + disabled ADD after adding', formResetAfterAdd ? 'PASS' : 'FAIL');

  currentStep = 'change-selection';
  await page.fill('#mat-search', 'Somfy');
  await page.waitForTimeout(150);
  await page.click('#estimator-body .sales-card div[onclick^="estimatorSelectMaterialItem"]');
  await page.waitForTimeout(150);
  await page.click('#estimator-body span:has-text("Change")');
  await page.waitForTimeout(150);
  await shot(page, 'selection-changed-back-to-search');
  const backToSearch = await page.evaluate(() => !!document.getElementById('mat-search'));
  record('"Change" link clears selection and returns to search input', backToSearch ? 'PASS' : 'FAIL');

  await browser.close();
  printReport();
})();
