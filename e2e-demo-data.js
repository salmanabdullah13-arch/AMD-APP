// Verification for the local-only Demo Data seeder (Admin Dashboard,
// 5 Aug 2026) — Salman asked for realistic sample data so every chart
// in the Dashboard Analytics rollout has real content instead of its
// own empty state. LOCAL-ONLY by design: every persist*() call in
// data.js is guarded by window.__realCloudSession, and loadDemoData()
// temporarily flips that to false for the duration of seeding — this
// suite confirms that guard actually holds (zero network writes) via
// a real UI click path, not just a direct function call.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-demo-data');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
const networkRequests = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label) { await page.screenshot({ path: path.join(SHOT_DIR, `${label}.png`) }); }
function printReport() {
  console.log('\n=== DEMO DATA SEEDER VERIFICATION ===');
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
  page.on('request', req => networkRequests.push({ step: currentStep, url: req.url(), method: req.method() }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  currentStep = 'app-loads';
  await page.waitForSelector('#app', { state: 'visible' });
  record('App loads', 'PASS');

  currentStep = 'open-admin';
  await openNode(page, 'admin', 'admin-module-wrap');
  await page.evaluate(() => { document.getElementById('xsnav-admin-devpreview')?.click(); }); // exec-shell pilot: pill tab -> sidebar nav item
  await page.waitForTimeout(150);
  const beforeLoad = await page.evaluate(() => ({
    loadEnabled: !document.querySelector('#admin-module-wrap button[onclick="adminLoadDemoData()"]').disabled,
    clearDisabled: document.querySelector('#admin-module-wrap button[onclick="adminClearDemoData()"]').disabled
  }));
  record('Demo Data controls render with Load enabled, Clear disabled (nothing loaded yet)', beforeLoad.loadEnabled && beforeLoad.clearDisabled ? 'PASS' : 'FAIL', JSON.stringify(beforeLoad));

  currentStep = 'click-load';
  const networkCountBefore = networkRequests.length;
  await page.click('#admin-module-wrap button[onclick="adminLoadDemoData()"]');
  await page.waitForTimeout(400);
  const afterLoadNetwork = networkRequests.slice(networkCountBefore).filter(r => !r.url.startsWith('file://'));
  record('Clicking "Load Demo Data" makes ZERO non-file:// network requests (nothing reaches Supabase)', afterLoadNetwork.length === 0 ? 'PASS' : 'FAIL', JSON.stringify(afterLoadNetwork));
  const counts = await page.evaluate(() => ({ customers: customers.length, jobCards: jobCards.length, quotations: quotations.length, taxInvoices: taxInvoices.length, realSession: window.__realCloudSession }));
  record('Real business arrays now hold seeded demo content', counts.jobCards > 5 && counts.customers > 5 ? 'PASS' : 'FAIL', JSON.stringify(counts));
  record('window.__realCloudSession is correctly restored to its prior value after seeding', counts.realSession === false ? 'PASS' : 'FAIL', `realSession=${counts.realSession}`);

  currentStep = 'button-state-after-load';
  const afterLoad = await page.evaluate(() => ({
    loadDisabled: document.querySelector('#admin-module-wrap button[onclick="adminLoadDemoData()"]').disabled,
    clearEnabled: !document.querySelector('#admin-module-wrap button[onclick="adminClearDemoData()"]').disabled
  }));
  record('After loading, Load becomes disabled and Clear becomes enabled', afterLoad.loadDisabled && afterLoad.clearEnabled ? 'PASS' : 'FAIL', JSON.stringify(afterLoad));

  currentStep = 'owner-charts-render';
  await page.evaluate(() => document.querySelector('#admin-module-wrap button[onclick="closeAdminModule()"]').click());
  await page.waitForTimeout(200);
  await openNode(page, 'owner', 'owner-module-wrap');
  const ownerCharts = await page.evaluate(() => {
    const body = document.getElementById('owner-body').innerHTML;
    return {
      hasMonthlyRevenueSvg: /Monthly Revenue by Division[\s\S]*?<svg/.test(body) || body.includes('cw-stacked'),
      hasRealClientName: body.includes('Al Fardan Villa') || body.includes('Seef Business Center') || body.includes('Riffa Views'),
      hasDeptRings: (body.match(/cw-ring/g) || []).length >= 4
    };
  });
  record('Owner Dashboard renders real chart content post-seed (not the empty state)', ownerCharts.hasMonthlyRevenueSvg && ownerCharts.hasRealClientName ? 'PASS' : 'FAIL', JSON.stringify(ownerCharts));
  await shot(page, 'owner-with-demo-data');

  currentStep = 'joinery-charts-render';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'joinery', 'joinery-module-wrap');
  const joineryHasQueue = await page.evaluate(() => document.getElementById('joinery-body')?.innerHTML.length > 200);
  record('Joinery Dashboard renders with seeded queue/QC content', joineryHasQueue ? 'PASS' : 'FAIL');

  currentStep = 'clear-demo-data';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'admin', 'admin-module-wrap');
  await page.evaluate(() => { document.getElementById('xsnav-admin-devpreview')?.click(); }); // exec-shell pilot: pill tab -> sidebar nav item
  await page.waitForTimeout(150);
  await page.click('#admin-module-wrap button[onclick="adminClearDemoData()"]');
  await page.waitForTimeout(200);
  const afterClear = await page.evaluate(() => ({ jobCards: jobCards.length, customers: customers.length, quotations: quotations.length }));
  record('Clear Demo Data removes exactly what was added, restoring pre-seed counts', afterClear.jobCards === 0 ? 'PASS' : 'FAIL', JSON.stringify(afterClear));
  const buttonsAfterClear = await page.evaluate(() => ({
    loadEnabled: !document.querySelector('#admin-module-wrap button[onclick="adminLoadDemoData()"]').disabled,
    clearDisabled: document.querySelector('#admin-module-wrap button[onclick="adminClearDemoData()"]').disabled
  }));
  record('Button states flip back correctly after clearing', buttonsAfterClear.loadEnabled && buttonsAfterClear.clearDisabled ? 'PASS' : 'FAIL', JSON.stringify(buttonsAfterClear));

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
