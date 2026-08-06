// Verification for the new Admin Dashboard (admin.js), Nav overhaul
// Phase 2 (5 Aug 2026) — split out of the Owner Dashboard: Approvals
// (shared with Owner/HR), Developer Preview (jump into any built
// dashboard for QA), User & Role Management (new). The offline e2e
// bypass (auth.js, isRealSession=false) means Approvals/Users tabs
// can't exercise their real Supabase reads/writes here — this suite
// confirms those two degrade gracefully (no crash, a clear message)
// and confirms Developer Preview's real click-through launch path
// end to end, since that tab needs no cloud session at all.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-admin-dashboard');
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
  console.log('\n=== ADMIN DASHBOARD VERIFICATION ===');
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

  currentStep = 'open-admin';
  await openNode(page, 'admin', 'admin-module-wrap');
  record('Admin Dashboard opens via a real node tap', 'PASS');

  const mutexState = await page.evaluate(() => ({
    salesHidden: !document.getElementById('sales-module-wrap') || document.getElementById('sales-module-wrap').style.display === 'none',
    ownerHidden: !document.getElementById('owner-module-wrap') || document.getElementById('owner-module-wrap').style.display === 'none'
  }));
  record('Opening Admin hides other module wraps (mutual exclusivity)', mutexState.salesHidden && mutexState.ownerHidden ? 'PASS' : 'FAIL', JSON.stringify(mutexState));

  currentStep = 'default-tab';
  // Exec-shell pilot (6 Aug 2026): the three pill tabs became sidebar nav
  // items (#xsnav-admin-*) inside the new template shell.
  const defaultTab = await page.evaluate(() => ({
    hasThreeNavItems: !!(document.getElementById('xsnav-admin-approvals') && document.getElementById('xsnav-admin-users') && document.getElementById('xsnav-admin-devpreview')),
    approvalsActive: document.getElementById('xsnav-admin-approvals')?.classList.contains('active'),
    hasApprovalContainer: !!document.getElementById('admin-approval-queue')
  }));
  record('Admin opens on Approvals with all 3 sidebar sections present', defaultTab.hasThreeNavItems && defaultTab.approvalsActive && defaultTab.hasApprovalContainer ? 'PASS' : 'FAIL', JSON.stringify(defaultTab));

  currentStep = 'approvals-offline-degrade';
  await page.waitForTimeout(300);
  const approvalsMsg = await page.evaluate(() => document.getElementById('admin-approval-queue')?.textContent || '');
  record('Approvals tab degrades gracefully without a real cloud session (no crash)', approvalsMsg.toLowerCase().includes('real cloud login') ? 'PASS' : 'FAIL', approvalsMsg.slice(0, 80));

  currentStep = 'devpreview-tab';
  await page.evaluate(() => { document.getElementById('xsnav-admin-devpreview')?.click(); });
  await page.waitForTimeout(150);
  const devPreview = await page.evaluate(() => {
    const rows = document.querySelectorAll('#admin-module-wrap .admin-row');
    const builtCount = (window.__eco3d?.NODES || []).filter(n => n.built).length;
    return { rowCount: rows.length, builtCount, hasSalesRow: [...rows].some(r => r.textContent.includes('Sales')) };
  });
  record('Developer Preview lists every built dashboard', devPreview.rowCount === devPreview.builtCount && devPreview.rowCount > 0 ? 'PASS' : 'FAIL', JSON.stringify(devPreview));
  record('Developer Preview includes the Sales row', devPreview.hasSalesRow ? 'PASS' : 'FAIL');

  currentStep = 'devpreview-launch';
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#admin-module-wrap .admin-row')];
    rows.find(r => r.textContent.includes('Sales'))?.click();
  });
  await page.waitForSelector('#sales-module-wrap', { state: 'visible', timeout: 5000 });
  const afterLaunch = await page.evaluate(() => ({
    salesVisible: document.getElementById('sales-module-wrap').style.display !== 'none',
    adminHidden: document.getElementById('admin-module-wrap').style.display === 'none'
  }));
  record('Tapping a Developer Preview row opens that real dashboard and closes Admin', afterLaunch.salesVisible && afterLaunch.adminHidden ? 'PASS' : 'FAIL', JSON.stringify(afterLaunch));
  await page.evaluate(() => closeSalesModule());
  await page.waitForTimeout(200);

  currentStep = 'users-tab-offline-degrade';
  await openNode(page, 'admin', 'admin-module-wrap');
  await page.evaluate(() => { document.getElementById('xsnav-admin-users')?.click(); });
  await page.waitForTimeout(300);
  const usersMsg = await page.evaluate(() => document.getElementById('admin-users-body')?.textContent || '');
  record('User & Role Management tab degrades gracefully without a real cloud session (no crash)', usersMsg.toLowerCase().includes('real cloud login') ? 'PASS' : 'FAIL', usersMsg.slice(0, 80));

  currentStep = 'close-button';
  await page.evaluate(() => document.querySelector('#admin-module-wrap button[onclick="closeAdminModule()"]').click());
  await page.waitForTimeout(200);
  const closedState = await page.evaluate(() => ({
    adminHidden: document.getElementById('admin-module-wrap').style.display === 'none',
    ecoActive: document.getElementById('p-eco')?.classList.contains('active')
  }));
  record('Admin\'s close button returns to the hub (window.__dashboardHome not yet set — Phase 3)', closedState.adminHidden && closedState.ecoActive ? 'PASS' : 'FAIL', JSON.stringify(closedState));
  await shot(page, 'after-close');

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
