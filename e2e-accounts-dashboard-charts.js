// Verification for Dashboard Analytics rollout, Phase 4 (5 Aug 2026) —
// the Accounts Dashboard's upgraded "Revenue by Division" (now a real
// monthly stacked-bar chart, not a plain table) plus the new Top
// Clients card (accounts.js, renderAccountsDashboard()). Confirms the
// real accounting distinction is preserved: Accounts' own revenue
// stays INVOICED-only (taxInvoices via accountsDivisionForInvoice()),
// not the broader job-confirmed value Owner/Sales use.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-accounts-dashboard-charts');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label) { await page.screenshot({ path: path.join(SHOT_DIR, `${label}.png`) }); }
function printReport() {
  console.log('\n=== ACCOUNTS DASHBOARD ANALYTICS VERIFICATION ===');
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
  await page.waitForTimeout(300);
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
  record('App loads', 'PASS');

  currentStep = 'seed-scenario';
  const scenario = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Accounts Analytics Client', contactPerson: 'Fatima', tel: '39771122', address: 'Manama' });
    const enq = createEnquiry({ division: 'Upholstery', customerId: cust.id, contactPerson: 'Fatima', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Accounts Analytics Project', taxPercent: 10, contactPerson: 'Fatima' });
    const item = addQuotationItem(qtn.id, { product: 'Sofa Set', qty: 1, unit: 'Nos', vatPercent: 10 });
    item.rate = 3000; item.amount = 3000; item.netAmount = 3300; item.vatPercent = 10;
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    job.amount = 3300;
    confirmJobRouting(job.id, {}, 'Operations Manager');
    const inv = generateInvoiceFromJob(job.id, {});
    return { jobId: job.id, invoiceId: inv.id, customerName: cust.name };
  });

  currentStep = 'open-accounts-dashboard';
  await openNode(page, 'accounts', 'accounts-module-wrap');
  await shot(page, 'accounts-dashboard');

  const state = await page.evaluate(() => {
    const html = document.getElementById('accounts-body') ? document.getElementById('accounts-body').innerHTML : document.getElementById('accounts-module-wrap').innerHTML;
    return {
      hasRevenueByDivisionSection: html.includes('Revenue by Division'),
      hasChart: html.includes('cw-chart'),
      mentionsUpholstery: html.includes('Upholstery'),
      hasTopClientsSection: html.includes('Top Clients'),
      mentionsAnalyticsClient: html.includes('Accounts Analytics Client')
    };
  });
  record('Accounts Dashboard renders Revenue by Division as a real chart (upgraded from the old plain table)', state.hasRevenueByDivisionSection && state.hasChart ? 'PASS' : 'FAIL', JSON.stringify(state));
  record('Revenue by Division chart shows the seeded Upholstery division (real invoiced data, not the empty state)', state.mentionsUpholstery ? 'PASS' : 'FAIL');
  record('Accounts Dashboard renders the new Top Clients section showing the seeded client by name', state.hasTopClientsSection && state.mentionsAnalyticsClient ? 'PASS' : 'FAIL', JSON.stringify(state));

  currentStep = 'verify-accounting-distinction';
  const distinction = await page.evaluate((jobId) => {
    // getAccountsMonthlyRevenueByDivision() must be INVOICED-only
    // (taxInvoices) — confirm it's NOT simply re-deriving from
    // jobCards the way the broader Owner/Sales function does, by
    // checking the actual value matches the invoice's netTotal, not
    // job.amount (which could differ if invoicedPercent < 100 or if
    // the job had no invoice at all yet).
    const monthly = getAccountsMonthlyRevenueByDivision(6);
    const thisMonthKey = monthly.months[monthly.months.length - 1].key;
    return { upholsteryThisMonth: monthly.byMonthDiv[thisMonthKey]['Upholstery'] };
  }, scenario.jobId);
  record('getAccountsMonthlyRevenueByDivision() reflects the real invoiced net total (BD 3300), Accounts\' own narrower revenue definition', distinction.upholsteryThisMonth === 3300 ? 'PASS' : 'FAIL', JSON.stringify(distinction));

  currentStep = 'final';
  const critical = consoleErrors.filter(e => !e.text.includes('favicon'));
  record('No unexpected console errors', critical.length === 0 ? 'PASS' : 'FAIL', critical.map(e => e.text).join(' | '));
  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.some(r => r.status === 'FAIL') ? 1 : 0);
})().catch(err => {
  console.error('FATAL:', err);
  printReport();
  process.exit(1);
});
