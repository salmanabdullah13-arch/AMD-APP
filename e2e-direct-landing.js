// Verification for direct-landing login (Nav overhaul Phase 3, 5 Aug
// 2026) — finishCloudLogin() (auth.js) now looks up the signed-in
// role's window.__dashboardMap entry and launches that dashboard
// directly, with zero taps through the ecosystem hub. Scoped to a
// REAL session only (isRealSession=true) — the offline e2e bypass
// every other suite in this repo uses must keep landing on the
// ecosystem hub exactly as before.
//
// This suite calls the real finishCloudLogin() function directly with
// different userType values (rather than a full live Supabase sign-up/
// sign-in per role) — it needs live network access to Supabase's
// public user_types table (already exercised by other suites in this
// repo from a file:// origin), but not a dedicated auth account per
// role, since finishCloudLogin() itself is exactly the function a real
// login already calls once a profile is fetched. This exercises the
// real production code path deterministically without needing a
// separate live account for every role tested.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== DIRECT-LANDING LOGIN VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}
async function simulateRealLogin(page, userType) {
  await page.evaluate((ut) => { finishCloudLogin('Direct Landing Test', true, ut); }, userType);
  // launchDashboardNode() polls for window.__eco3d up to ~2s; the
  // sb.from('user_types') round trip itself also varies under real
  // network load (observed ~600ms on a 3rd+ concurrent call in one
  // test run) — wait generously rather than on a tight fixed delay.
  await page.waitForFunction(() => window.__dashboardHome !== undefined, { timeout: 5000 });
  await page.waitForTimeout(1000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  let dialogMessages = [];
  page.on('dialog', async d => { dialogMessages.push(d.message()); await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  currentStep = 'baseline-bypass';
  await page.waitForSelector('#app', { state: 'visible' });
  const baseline = await page.evaluate(() => ({
    ecoActive: document.getElementById('p-eco')?.classList.contains('active'),
    dashboardHome: window.__dashboardHome
  }));
  record('Offline e2e bypass still lands on the ecosystem hub, unaffected (existing ~40 suites depend on this)', baseline.ecoActive && baseline.dashboardHome === undefined ? 'PASS' : 'FAIL', JSON.stringify(baseline));

  currentStep = 'sales-direct-landing';
  await simulateRealLogin(page, 'sales');
  const salesLanding = await page.evaluate(() => ({
    salesVisible: document.getElementById('sales-module-wrap')?.style.display !== 'none',
    dashboardHome: window.__dashboardHome
  }));
  record('Signing in as sales lands directly on the Sales dashboard with zero taps', salesLanding.salesVisible ? 'PASS' : 'FAIL', JSON.stringify(salesLanding));
  record('window.__dashboardHome is null for a single-dashboard role', salesLanding.dashboardHome === null ? 'PASS' : 'FAIL', JSON.stringify(salesLanding));

  currentStep = 'sales-signout';
  dialogMessages = [];
  await page.evaluate(() => document.querySelector('#sales-module-wrap button[onclick="closeSalesModule()"]').click());
  await page.waitForTimeout(300);
  record('Closing a single-dashboard role\'s own dashboard prompts Sign Out', dialogMessages.some(m => /sign out/i.test(m)) ? 'PASS' : 'FAIL', JSON.stringify(dialogMessages));
  await page.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#app', { state: 'visible', timeout: 5000 });
  const afterSignOut = await page.evaluate(() => document.getElementById('p-eco')?.classList.contains('active'));
  record('After Sign Out + reload, back on the ecosystem hub (offline bypass takes back over)', afterSignOut ? 'PASS' : 'FAIL');

  currentStep = 'owner-direct-landing';
  await simulateRealLogin(page, 'owner');
  const ownerLanding = await page.evaluate(() => ({
    ownerVisible: document.getElementById('owner-module-wrap')?.style.display !== 'none',
    dashboardHome: window.__dashboardHome
  }));
  record('Signing in as owner lands directly on the Owner Dashboard with zero taps', ownerLanding.ownerVisible ? 'PASS' : 'FAIL', JSON.stringify(ownerLanding));
  record('window.__dashboardHome is launchOwnerModule for Owner', ownerLanding.dashboardHome === 'launchOwnerModule' ? 'PASS' : 'FAIL', JSON.stringify(ownerLanding));

  currentStep = 'owner-drill-and-return';
  // Redesign 4a: the Company-Snapshot quick links became the sidebar's own
  // Money group — Revenue opens Accounts.
  await page.evaluate(() => document.querySelector('#owner-module-wrap #xsnav-m-revenue').click());
  await page.waitForSelector('#accounts-module-wrap', { state: 'visible', timeout: 5000 });
  record('Owner\'s quick-link opens a real module via a genuine click', 'PASS');

  dialogMessages = [];
  await page.evaluate(() => document.querySelector('#accounts-module-wrap button[onclick="closeAccountsModule()"]').click());
  await page.waitForTimeout(300);
  const backToOwner = await page.evaluate(() => ({
    ownerVisible: document.getElementById('owner-module-wrap')?.style.display !== 'none',
    accountsHidden: document.getElementById('accounts-module-wrap')?.style.display === 'none'
  }));
  record('Closing a module Owner drilled into returns to Owner\'s own hub — no Sign Out prompt', dialogMessages.length === 0 && backToOwner.ownerVisible && backToOwner.accountsHidden ? 'PASS' : 'FAIL', JSON.stringify({ dialogMessages, ...backToOwner }));

  currentStep = 'curtain-granular-direct-landing';
  await page.evaluate(() => document.querySelector('#owner-module-wrap button[onclick="closeOwnerModule()"]')?.click());
  await page.waitForTimeout(200);
  await simulateRealLogin(page, 'curtain_tracks_team');
  const tracksLanding = await page.evaluate(() => document.getElementById('tracks-dash-wrap')?.style.display !== 'none');
  record('Signing in as Curtain Tracks Team lands directly on the Tracks dashboard (shared-node role)', tracksLanding ? 'PASS' : 'FAIL');

  currentStep = 'joinery-granular-direct-landing';
  await page.evaluate(() => { if (typeof closeTracksDashboard === 'function') closeTracksDashboard(); });
  await page.waitForTimeout(200);
  await simulateRealLogin(page, 'joinery_draftsman');
  const draftingLanding = await page.evaluate(() => ({
    joineryVisible: document.getElementById('joinery-module-wrap')?.style.display !== 'none',
    hasTabBar: document.querySelectorAll('#joinery-module-wrap .sales-tabbtn').length > 0
  }));
  record('Signing in as Joinery Draftsman lands directly on the restricted drafting view (no tab bar)', draftingLanding.joineryVisible && !draftingLanding.hasTabBar ? 'PASS' : 'FAIL', JSON.stringify(draftingLanding));

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
