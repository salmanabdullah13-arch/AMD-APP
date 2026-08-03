// Batch 6 (Reports) verification pass — opens each of the 5 touched
// modules via a real ecosystem-hub tap, seeds a little real data through
// the actual data-layer functions (not hand-typed forms, to keep this
// script fast), then clicks into every new report tab and screenshots it.
// Ad hoc investigative script, same pattern as e2e-lifecycle.js.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.join(__dirname, 'e2e-shots-batch6');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
let shotN = 0;
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label) {
  shotN++;
  await page.screenshot({ path: path.join(SHOT_DIR, `${String(shotN).padStart(2, '0')}-${label}.png`) });
}
function printReport() {
  console.log('\n=== BATCH 6 REPORTS VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`);
  consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`);
  pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

async function openNode(page, nodeId, wrapId, label) {
  await page.evaluate((id) => {
    const mesh = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === id);
    if (mesh && typeof mesh.userData.node.launch === 'function') mesh.userData.node.launch();
  }, nodeId);
  await page.waitForSelector(`#${wrapId}`, { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(300);
  await shot(page, `${label}-opened`);
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
  try {
    for (const digit of ['1', '9', '9', '4']) {
      await page.click(`.num-btn[onclick="pt('${digit}')"]`);
      await page.waitForTimeout(150);
    }
    await page.waitForSelector('#app', { state: 'visible', timeout: 3000 });
    record('PIN unlock', 'PASS');
  } catch (e) { record('PIN unlock', 'FAIL', e.message); await shot(page, 'FAILED'); await browser.close(); printReport(); return; }

  // ── Seed real data through the actual data-layer functions ──
  currentStep = 'seed-data';
  try {
    const seeded = await page.evaluate(() => {
      const cust = createCustomer({ name: 'Batch6 Test Client', contactPerson: 'Ali', tel: '39001122', address: 'Manama', creditDays: 30 });
      const enq = createEnquiry({ division: 'Furniture', customerId: cust.id, contactPerson: 'Ali', tel: '39001122', source: 'walk inn', salesPerson: 'Salman Abdullah' });
      const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Batch6 Test Project', taxPercent: 10, contactPerson: 'Ali' });
      addQuotationItem(qtn.id, { product: 'Curtain Set', qty: 2, unit: 'Nos', rate: 100, vatPercent: 10, discPercent: 0 });
      approveQuotation(qtn.id, 'Salman Abdullah');
      const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
      const inv = generateInvoiceFromJob(job.id);
      createSalesReceipt({ customerId: cust.id, methods: { cash: { enabled: true, amount: 50 } }, amount: 50, allocations: [{ invoiceId: inv.id, payingAmount: 50 }] });
      const ledgerSales = ledgers.find(l => l.name === 'Sales');
      createGeneralReceipt({ methods: { cash: { enabled: true, amount: 20 } }, lines: [{ ledgerId: ledgerSales.id, amount: 20, narration: 'Misc' }] });
      return { customerId: cust.id, jobId: job.id, invId: inv.id };
    });
    record('Seed customer/enquiry/quotation/job/invoice/receipt/GL', 'PASS', JSON.stringify(seeded));
  } catch (e) { record('Seed data', 'FAIL', e.message); }

  // ── Accounts: Day Book, Ledger Report, Trial Balance, P&L, Balance Sheet ──
  currentStep = 'accounts-reports';
  try {
    await openNode(page, 'accounts', 'accounts-module-wrap', 'accounts');
    for (const tab of ['Day Book', 'Ledger Report', 'Trial Balance', 'Profit & Loss', 'Balance Sheet']) {
      await page.click(`#accounts-body button:has-text("${tab}")`);
      await page.waitForTimeout(200);
      await shot(page, `accounts-${tab.replace(/[^a-z0-9]/gi, '')}`);
    }
    // Select a Ledger on Ledger Report to confirm postings render
    await page.click(`#accounts-body button:has-text("Ledger Report")`);
    await page.waitForTimeout(150);
    await page.selectOption('#accounts-body select', { label: 'Cash (LED0001)' }).catch(() => {});
    await page.waitForTimeout(150);
    await shot(page, 'accounts-LedgerReport-Cash-selected');
    record('Accounts Batch 6 tabs render', 'PASS');
  } catch (e) { record('Accounts Batch 6 tabs render', 'FAIL', e.message); await shot(page, 'accounts-FAILED'); }

  // ── Sales: Reports > Quotation Register (Batch 7 moved Sales Bill
  // Outstanding to Accounts — Sales Reports is Quotation Register only now) ──
  currentStep = 'sales-reports';
  try {
    await openNode(page, 'sales', 'sales-module-wrap', 'sales');
    await page.click(`#sales-body .sales-toptab:has-text("Reports")`);
    await page.waitForTimeout(200);
    await shot(page, 'sales-quotation-register');
    record('Sales Reports (Quotation Register) renders', 'PASS');
  } catch (e) { record('Sales Reports (Quotation Register) renders', 'FAIL', e.message); await shot(page, 'sales-FAILED'); }

  // ── Accounts: Sales Bill Outstanding (moved here in Batch 7) ──
  currentStep = 'accounts-sales-bill-os';
  try {
    await openNode(page, 'accounts', 'accounts-module-wrap', 'accounts');
    await page.click(`#accounts-body button:has-text("Sales Bill Outstanding")`);
    await page.waitForTimeout(200);
    await shot(page, 'accounts-sales-bill-outstanding-byparty');
    await page.click(`#accounts-body button:has-text("All")`);
    await page.waitForTimeout(200);
    await shot(page, 'accounts-sales-bill-outstanding-all');
    await page.click(`#accounts-body input[type=checkbox]`);
    await page.waitForTimeout(200);
    await shot(page, 'accounts-sales-bill-outstanding-all-agewise');
    record('Accounts Sales Bill Outstanding renders', 'PASS');
  } catch (e) { record('Accounts Sales Bill Outstanding renders', 'FAIL', e.message); await shot(page, 'accounts-billos-FAILED'); }

  // ── Purchasing: Bill O/s ──
  currentStep = 'purchasing-reports';
  try {
    await openNode(page, 'purchasing', 'purch-module-wrap', 'purchasing');
    await page.click(`#purch-nav button:has-text("Bill O/s")`);
    await page.waitForTimeout(300);
    await shot(page, 'purchasing-bill-os');
    record('Purchasing Bill O/s renders', 'PASS');
  } catch (e) { record('Purchasing Bill O/s renders', 'FAIL', e.message); await shot(page, 'purchasing-FAILED'); }

  // ── Jobs: Reports (Job Report / Project Outstanding / Project wise Invoice & Receipt) ──
  currentStep = 'jobs-reports';
  try {
    await openNode(page, 'delivery', 'jobs-module-wrap', 'jobs');
    await page.click(`#jobs-body button:has-text("📊 Reports")`);
    await page.waitForTimeout(200);
    await shot(page, 'jobs-reports-jobreport-empty');
    const jobId = await page.evaluate(() => jobCards[jobCards.length - 1].id);
    await page.fill('#jobs-body input[type=text]', jobId);
    await page.waitForTimeout(200);
    await shot(page, 'jobs-jobreport-filled');
    await page.click(`#jobs-body button:has-text("Project Outstanding")`);
    await page.waitForTimeout(200);
    await shot(page, 'jobs-project-outstanding');
    await page.click(`#jobs-body button:has-text("Project wise Invoice")`);
    await page.waitForTimeout(200);
    await page.fill('#jobs-body input[type=text]', jobId);
    await page.waitForTimeout(200);
    await shot(page, 'jobs-project-wise-invoice-receipt');
    record('Jobs Reports tabs render', 'PASS', `jobId=${jobId}`);
  } catch (e) { record('Jobs Reports tabs render', 'FAIL', e.message); await shot(page, 'jobs-FAILED'); }

  // ── HR: Payroll Report ──
  currentStep = 'hr-reports';
  try {
    await openNode(page, 'hr', 'hr-module-wrap', 'hr');
    await page.click(`#hr-body button:has-text("Payroll Report")`);
    await page.waitForTimeout(200);
    await shot(page, 'hr-payroll-report');
    record('HR Payroll Report renders', 'PASS');
  } catch (e) { record('HR Payroll Report renders', 'FAIL', e.message); await shot(page, 'hr-FAILED'); }

  await browser.close();
  printReport();
})();
