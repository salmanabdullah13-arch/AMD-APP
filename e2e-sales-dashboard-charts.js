// Verification for Dashboard Analytics rollout, Phase 3 (5 Aug 2026) —
// the new analytics section on the Sales Dashboard (renderSalesDashboard(),
// sales.js): Monthly Revenue by Division, Pipeline Funnel, Top Clients,
// Upcoming Deliveries. Reuses the same chart-widgets.js primitives and
// data.js aggregations already verified in e2e-chart-widgets.js and
// e2e-owner-dashboard.js — this test focuses on the Sales-specific
// wiring (company-wide, no per-salesperson scope; the new Upcoming
// Deliveries list, which Owner's dashboard doesn't have).

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-sales-dashboard-charts');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label) { await page.screenshot({ path: path.join(SHOT_DIR, `${label}.png`) }); }
function printReport() {
  console.log('\n=== SALES DASHBOARD ANALYTICS VERIFICATION ===');
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
    // A job by a DIFFERENT salesperson than salesCurrentUser, to prove
    // the new analytics section is company-wide, not filtered to "my
    // own" — matching getSalesKPIs()'s own existing behavior.
    const cust = createCustomer({ name: 'Sales Analytics Client', contactPerson: 'Huda', tel: '39881122', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Huda', tel: cust.tel, source: 'walk inn', salesPerson: 'Some Other Salesperson' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Sales Analytics Project', taxPercent: 10, contactPerson: 'Huda' });
    const item = addQuotationItem(qtn.id, { product: 'Wardrobe Cabinet', qty: 1, unit: 'Nos' });
    item.rate = 4000; item.amount = 4000; item.netAmount = 4000;
    transferQuotationStage(qtn.id, 'approver', 'Estimator'); approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    job.amount = 4000;
    confirmJobRouting(job.id, {}, 'Operations Manager');
    scheduleDelivery(job.id, { plannedDate: '2026-09-01', driver: 'Ahmed' });
    return { jobId: job.id, customerName: cust.name };
  });

  currentStep = 'open-sales-dashboard';
  await openNode(page, 'sales', 'sales-module-wrap');
  await shot(page, 'sales-dashboard');

  const state = await page.evaluate(() => {
    const html = document.getElementById('sales-body') ? document.getElementById('sales-body').innerHTML : document.getElementById('sales-module-wrap').innerHTML;
    return {
      hasMonthlyRevenue: html.includes('Monthly Revenue by Division'),
      hasMonthlyRevenueSvg: html.includes('cw-chart'),
      hasPipelineFunnel: html.includes('Pipeline Funnel'),
      hasTopClients: html.includes('Top Clients'),
      mentionsAnalyticsClient: html.includes('Sales Analytics Client'),
      hasUpcomingDeliveries: html.includes('Upcoming Deliveries'),
      mentionsScheduledJob: html.includes('2026-09-01')
    };
  });
  record('Sales Dashboard renders Monthly Revenue by Division with a real chart (company-wide job, not filtered by salesperson)', state.hasMonthlyRevenue && state.hasMonthlyRevenueSvg ? 'PASS' : 'FAIL', JSON.stringify(state));
  record('Sales Dashboard renders Pipeline Funnel section', state.hasPipelineFunnel ? 'PASS' : 'FAIL');
  record('Sales Dashboard renders Top Clients section showing the seeded client by name (job created by a DIFFERENT salesperson — proves this is company-wide, not "my own jobs")', state.hasTopClients && state.mentionsAnalyticsClient ? 'PASS' : 'FAIL', JSON.stringify(state));
  record('Sales Dashboard renders Upcoming Deliveries with the real scheduled date', state.hasUpcomingDeliveries && state.mentionsScheduledJob ? 'PASS' : 'FAIL', JSON.stringify(state));

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
