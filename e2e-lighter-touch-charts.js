// Verification for Dashboard Analytics rollout, Phase 7 (5 Aug 2026) —
// small chart additions to the lighter-touch dashboards: Sales/
// Estimator/Approver's "Category Breakdown" (previously plain text)
// is now a cwMiniBars() chart; Purchaser gets an "Open Requests by
// Division" mini-bar chart; Storekeeper gets a "Stock Movement" chart;
// HR gets a "Compliance Risk by Category" chart; Fleet gets a "Fleet
// Health" chart; Delivery/Scheduling gets a "Delivery Status" chart.
// All reuse each dashboard's own already-computed KPI data — no new
// aggregation functions were needed for this phase.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-lighter-touch-charts');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label) { await page.screenshot({ path: path.join(SHOT_DIR, `${label}.png`) }); }
function printReport() {
  console.log('\n=== LIGHTER-TOUCH DASHBOARD CHARTS VERIFICATION ===');
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
  await page.evaluate(() => {
    const cust = createCustomer({ name: 'Lighter Touch Client', contactPerson: 'Sami', tel: '39661122', address: 'Manama' });
    const enq = createEnquiry({ division: 'Curtain & Blinds', customerId: cust.id, contactPerson: 'Sami', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
  });

  currentStep = 'sales-chart';
  await openNode(page, 'sales', 'sales-module-wrap');
  // Redesign 5a (7 Aug 2026): the Category Breakdown mini-bars were replaced
  // by "My pipeline", which is counts rather than value — the whole Sales
  // dashboard is money-free by policy now.
  const salesState = await page.evaluate(() => {
    const body = document.getElementById('sales-body');
    return {
      pipeline: body.textContent.includes('My pipeline'),
      counts: /Counts, not value/.test(body.textContent),
      noMoney: !/BD\s?[\d,]/.test(body.textContent)
    };
  });
  record('Sales Dashboard shows a count-based pipeline instead of the old value charts',
    salesState.pipeline && salesState.counts && salesState.noMoney ? 'PASS' : 'FAIL', JSON.stringify(salesState));
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  currentStep = 'estimator-chart';
  await openNode(page, 'estimation', 'estimator-module-wrap');
  // Design package 6a (8 Aug 2026) replaced the Estimator dashboard outright.
  // The Category Breakdown mini-bar is deliberately gone — a count of curtain/
  // upholstery/joinery quotes told the estimator nothing about their own day.
  // Repointed (not deleted) at the screen that replaced it, same treatment the
  // Sales check above got in the 5a redesign.
  const estimatorState = await page.evaluate(() => {
    const b = document.getElementById('estimator-body');
    return !!b && b.classList.contains('ed') && b.querySelectorAll('.ed-q').length > 0
      && /Needs you today/.test(b.textContent);
  });
  record('Estimator Dashboard leads with the "Needs you today" action queue', estimatorState ? 'PASS' : 'FAIL');
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  currentStep = 'approver-chart';
  await openNode(page, 'approvals', 'approver-module-wrap');
  const approverState = await page.evaluate(() => document.getElementById('approver-body') ? document.getElementById('approver-body').innerHTML.includes('mini-bar-col') : document.getElementById('approver-module-wrap').innerHTML.includes('mini-bar-col'));
  record('Approver Dashboard\'s Category Breakdown now renders as a mini-bar chart', approverState ? 'PASS' : 'FAIL');
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  currentStep = 'purchasing-chart';
  await openNode(page, 'purchasing', 'purch-module-wrap');
  const purchState = await page.evaluate(() => document.getElementById('purch-module-wrap').innerHTML.includes('Open Requests by Division') && document.getElementById('purch-module-wrap').innerHTML.includes('mini-bar-col'));
  record('Purchaser Dashboard renders the new "Open Requests by Division" mini-bar chart', purchState ? 'PASS' : 'FAIL');
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  currentStep = 'storekeeper-chart';
  await openNode(page, 'storekeeper', 'sk-module-wrap');
  const skState = await page.evaluate(() => document.getElementById('sk-module-wrap').innerHTML.includes('Stock Movement') && document.getElementById('sk-module-wrap').innerHTML.includes('mini-bar-col'));
  record('Storekeeper Dashboard renders the new "Stock Movement" mini-bar chart', skState ? 'PASS' : 'FAIL');
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  currentStep = 'hr-chart';
  await openNode(page, 'hr', 'hr-module-wrap');
  const hrState = await page.evaluate(() => document.getElementById('hr-module-wrap').innerHTML.includes('Compliance Risk by Category') && document.getElementById('hr-module-wrap').innerHTML.includes('mini-bar-col'));
  record('HR Dashboard renders the new "Compliance Risk by Category" mini-bar chart', hrState ? 'PASS' : 'FAIL');
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  currentStep = 'fleet-chart';
  await openNode(page, 'fleet', 'fleet-module-wrap');
  const fleetState = await page.evaluate(() => document.getElementById('fleet-module-wrap').innerHTML.includes('Fleet Health') && document.getElementById('fleet-module-wrap').innerHTML.includes('mini-bar-col'));
  record('Vehicle Fleet Inspector Dashboard renders the new "Fleet Health" mini-bar chart', fleetState ? 'PASS' : 'FAIL');
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  currentStep = 'delivery-chart';
  await openNode(page, 'delivery-scheduling', 'delivery-sched-module-wrap');
  const deliveryState = await page.evaluate(() => document.getElementById('delivery-sched-module-wrap').innerHTML.includes('Delivery Status') && document.getElementById('delivery-sched-module-wrap').innerHTML.includes('mini-bar-col'));
  record('Delivery/Scheduling Dashboard renders the new "Delivery Status" mini-bar chart', deliveryState ? 'PASS' : 'FAIL');
  await shot(page, 'delivery-dashboard');

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
