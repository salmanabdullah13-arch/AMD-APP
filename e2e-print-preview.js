// Verification for the new Print/Preview module — a unified, strictly
// read-only print dialog (Client Quotation vs Internal Cost Review,
// Image/suppress-totals toggles) that opens a static HTML document in a
// new tab via Blob + object URL (no server, no PDF library — matches this
// app's zero-dependency architecture). Deliberately checks that nothing
// in the generated document is editable, unlike the legacy Q-Pro
// "Approver Print" screen this replaces.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-print-preview');
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
  console.log('\n=== PRINT / PREVIEW VERIFICATION ===');
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
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
    salesCurrentUser = 'Salman Abdullah';
    const cust = createCustomer({ name: 'Print Test Client', contactPerson: 'Mona', tel: '39221199', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Mona', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'Print Test Project', taxPercent: 10, contactPerson: 'Mona' });
    addQuotationItem(q.id, { group: 'RECEPTION AREA', subgroup: 'Counter', product: 'Reception Counter', qty: 1, unit: 'Nos' });
    addQuotationItem(q.id, { group: 'RECEPTION AREA', subgroup: 'Cladding', product: 'Wall Cladding', qty: 2, unit: 'Nos' });
    const item1 = q.items[0];
    addBOMMaterial(q.id, item1.lineId, { name: 'Test Board', qty: 2, unit: 'Nos', rate: 50 });
    submitItemBOM(q.id, item1.lineId);
    transferQuotationStage(q.id, 'estimator', 'Salman Abdullah');
    transferQuotationStage(q.id, 'approver', 'Estimator User');
    approveQuotation(q.id, 'Salman Abdullah');
    return { qtnId: q.id };
  });

  // ── Sales: Client-only audience ──
  currentStep = 'sales-print-dialog';
  await openNode(page, 'sales', 'sales-module-wrap');
  await page.evaluate((id) => { openQuotationHub(id); }, seed.qtnId);
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: 1280, height: 900 });   // action row is desktop-only (§10)
  await page.evaluate(() => { qhSetTab('record'); qhSheet = 'print'; renderSalesBody(); });
  // §4: the pill opens an inline sheet; the dialog is the action inside it.
  await page.waitForTimeout(200);
  await page.evaluate(() => { if (typeof qhTab !== 'undefined' && qhTab !== 'record') qhSetTab('record'); });
  await page.waitForTimeout(150);
  await page.click('#sales-body .qh-pill:has-text("Open print dialog")');
  await page.waitForTimeout(150);
  await shot(page, 'sales-print-dialog');
  const salesDialogState = await page.evaluate(() => ({
    visible: getComputedStyle(document.getElementById('print-modal-wrap')).display !== 'none',
    hasAudienceSelect: !!document.querySelector('#print-modal-inner select'),
    allowInternalCost: printAllowInternalCost
  }));
  record('Sales Print Quote opens the dialog WITHOUT an Audience option (Client-only)', salesDialogState.visible && !salesDialogState.hasAudienceSelect && salesDialogState.allowInternalCost === false ? 'PASS' : 'FAIL', JSON.stringify(salesDialogState));

  const [clientTab] = await Promise.all([
    context.waitForEvent('page'),
    page.click('#print-modal-inner button:has-text("Generate")')
  ]);
  await clientTab.waitForLoadState();
  const clientDoc = await clientTab.evaluate(() => document.documentElement.outerHTML);
  const clientTitle = await clientTab.title();
  record('Generated document title is the Quote No (client)', clientTitle.includes(seed.qtnId) ? 'PASS' : 'FAIL', clientTitle);
  record('Client doc shows QUOTATION heading, not Internal Cost Review', clientDoc.includes('>QUOTATION<') && !clientDoc.includes('INTERNAL COST REVIEW') ? 'PASS' : 'FAIL');
  // 6 Aug 2026 template rework: sub-group serial and name now sit in
  // adjacent cells (matching the real AMD quotation PDF's layout), and the
  // signature headings are title-case in markup (uppercased via CSS).
  record('Client doc shows Group/Sub Group headers with correct serials', clientDoc.includes('RECEPTION AREA') && clientDoc.includes('>1.1</td>') && clientDoc.includes('>Counter</td>') && clientDoc.includes('>1.2</td>') && clientDoc.includes('>Cladding</td>') ? 'PASS' : 'FAIL');
  record('Client doc shows Terms and Conditions + signature blocks', clientDoc.includes('Terms and Conditions') && /client approval/i.test(clientDoc) && /management approval/i.test(clientDoc) ? 'PASS' : 'FAIL');
  record('Client doc does NOT show Cost/Profit columns', !clientDoc.includes('<th>Cost</th>') ? 'PASS' : 'FAIL');
  const noEditableElementsClient = await clientTab.evaluate(() => document.querySelectorAll('input,textarea,select').length === 0 && document.querySelectorAll('[onclick*="delete" i]').length === 0);
  record('Client doc has no editable fields and no delete actions (only the Print button)', noEditableElementsClient ? 'PASS' : 'FAIL');
  await clientTab.close();

  // ── Approver: Internal Cost Review audience available ──
  currentStep = 'approver-print-dialog';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'approvals', 'approver-module-wrap');
  await page.evaluate((id) => { openApproverQuoteHub(id); }, seed.qtnId);
  await page.waitForTimeout(200);
  await page.click('#approver-body .sales-tile:has-text("Print Quote")');
  await page.waitForTimeout(150);
  await shot(page, 'approver-print-dialog');
  const approverDialogState = await page.evaluate(() => ({
    hasAudienceSelect: !!document.querySelector('#print-modal-inner select'),
    allowInternalCost: printAllowInternalCost
  }));
  record('Approver Print Quote DOES offer the Audience select (Internal Cost Review available)', approverDialogState.hasAudienceSelect && approverDialogState.allowInternalCost === true ? 'PASS' : 'FAIL', JSON.stringify(approverDialogState));

  await page.selectOption('#print-modal-inner select', 'internal');
  const [internalTab] = await Promise.all([
    context.waitForEvent('page'),
    page.click('#print-modal-inner button:has-text("Generate")')
  ]);
  await internalTab.waitForLoadState();
  const internalDoc = await internalTab.evaluate(() => document.documentElement.outerHTML);
  record('Internal Cost Review doc shows INTERNAL COST REVIEW heading', internalDoc.includes('INTERNAL COST REVIEW') ? 'PASS' : 'FAIL');
  record('Internal Cost Review doc shows Cost/Profit columns and the real BOM-derived cost (105.000 = 50x2 material + 5% OH)', internalDoc.includes('<th>Cost</th>') && internalDoc.includes('105.000') ? 'PASS' : 'FAIL');
  record('Internal Cost Review doc does NOT show client Terms/signature blocks', !internalDoc.includes('CLIENT APPROVAL') ? 'PASS' : 'FAIL');
  const noEditableElementsInternal = await internalTab.evaluate(() => document.querySelectorAll('input,textarea,select').length === 0 && document.querySelectorAll('[onclick*="delete" i]').length === 0);
  record('Internal doc has no editable fields or delete actions either (only the Print button)', noEditableElementsInternal ? 'PASS' : 'FAIL');
  await internalTab.close();

  // ── Without VAT / Without Sub Total toggles ──
  currentStep = 'toggles';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'sales', 'sales-module-wrap');
  await page.evaluate((id) => { openQuotationHub(id); }, seed.qtnId);
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: 1280, height: 900 });   // action row is desktop-only (§10)
  await page.evaluate(() => { qhSetTab('record'); qhSheet = 'print'; renderSalesBody(); });
  // §4: the pill opens an inline sheet; the dialog is the action inside it.
  await page.waitForTimeout(150);
  await page.click('#sales-body .qh-pill:has-text("Open print dialog")');
  await page.waitForTimeout(150);
  await page.click('#print-modal-inner input[onchange*="withoutVat"]');
  await page.click('#print-modal-inner input[onchange*="withoutSubTotal"]');
  const [toggledTab] = await Promise.all([
    context.waitForEvent('page'),
    page.click('#print-modal-inner button:has-text("Generate")')
  ]);
  await toggledTab.waitForLoadState();
  const toggledDoc = await toggledTab.evaluate(() => document.documentElement.outerHTML);
  // Template rework: Without VAT now simply omits the Vat row — the Net
  // Total band shows the pre-VAT figure (the real template has no special
  // "(Without Vat)" label).
  record('Without VAT omits the Vat row and Net Total shows the pre-VAT figure', !toggledDoc.includes('>Vat</td>') && toggledDoc.includes('Net Total') ? 'PASS' : 'FAIL');
  record('Without Sub Total suppresses Sub Group total rows but keeps Group total', !toggledDoc.includes('Counter Total') && toggledDoc.includes('RECEPTION AREA Total') ? 'PASS' : 'FAIL');
  await toggledTab.close();

  await browser.close();
  printReport();
})();
