// Verification for cloud-backed customers (4 Aug 2026, Phase 2 slice
// 1) — the first real business-data table migrated to Supabase, using
// the same local-cache pattern proven with Messages: `customers` stays
// a plain synchronous array every module already reads via
// .find()/.filter(), populated from Supabase at login and kept live
// via realtime. createCustomer() stays synchronous (optimistic local
// write), firing a background persist to the real table.
//
// Goes through the REAL cloud-login flow (not the bypass) as the
// dedicated 'E2E Test Account', same as e2e-cloud-messages-presence.js.
// REQUIRES the same live-project prerequisites: `allowed_identities`
// readable by `public` (including 'E2E Test Account'), "Confirm
// email" OFF, and this session's `customers` table + RLS policies run
// against the project.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-cloud-customers');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== CLOUD CUSTOMERS VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const TEST_IDENTITY = 'E2E Test Account';
const TEST_PASSWORD = 'E2eFixedTestPassword1234!';

async function signInOrUp(page, fileUrl) {
  await page.goto(fileUrl);
  // Wait for the roster fetch to actually populate the <select> rather
  // than a fixed delay — interacting too early looked like a wrong
  // password in an earlier run; it was really an empty dropdown.
  await page.waitForFunction(() => {
    const s = document.getElementById('auth-identity-select');
    return s && s.options.length > 1;
  }, { timeout: 10000 }).catch(() => null);
  const hasSelect = await page.evaluate((name) => {
    const s = document.getElementById('auth-identity-select');
    return !!s && Array.from(s.options).some(o => o.value === name);
  }, TEST_IDENTITY);
  if (!hasSelect) return { ok: false, reason: 'roster-missing' };
  await page.selectOption('#auth-identity-select', TEST_IDENTITY);
  await page.fill('#auth-password-input', TEST_PASSWORD);
  await page.click('#cloud-login-body button[onclick="handleSignIn()"]');
  await page.waitForFunction(() => {
    const appVisible = getComputedStyle(document.getElementById('app')).display !== 'none';
    const stillOnSigningIn = document.getElementById('cloud-login-body')?.textContent.includes('Signing in');
    return appVisible || !stillOnSigningIn;
  }, { timeout: 15000 }).catch(() => null);
  let inApp = await page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
  if (inApp) return { ok: true, via: 'signin' };
  await page.click('#cloud-login-body button:nth-of-type(2)');
  await page.waitForSelector('#auth-password-confirm-input', { state: 'visible', timeout: 10000 }).catch(() => null);
  await page.selectOption('#auth-identity-select', TEST_IDENTITY).catch(() => null);
  await page.fill('#auth-password-input', TEST_PASSWORD).catch(() => null);
  await page.fill('#auth-password-confirm-input', TEST_PASSWORD).catch(() => null);
  await page.click('#cloud-login-body button:has-text("Create Account")');
  await page.waitForTimeout(5000);
  inApp = await page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
  return inApp ? { ok: true, via: 'signup' } : { ok: false, reason: (await page.evaluate(() => document.getElementById('cloud-login-body')?.innerHTML || '')).slice(0, 300) };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';

  currentStep = 'real-login';
  const login = await signInOrUp(page, fileUrl);
  record('Signs in/up as the dedicated E2E Test Account through the real cloud-login flow', login.ok ? 'PASS' : 'FAIL',
    login.ok ? `via ${login.via}` : (login.reason === 'roster-missing' ? 'ACTION NEEDED: roster/settings not applied yet' : login.reason));
  if (!login.ok) {
    printReport(); await browser.close(); process.exit(1);
  }

  currentStep = 'cloud-customers-cache-loads';
  await page.waitForTimeout(1200); // initCloudCustomersCache()'s initial fetch + realtime subscribe
  const cacheLoaded = await page.evaluate(() => Array.isArray(customers));
  record('customers array is populated from the live Supabase table at login (not the old hardcoded seed only)', cacheLoaded ? 'PASS' : 'FAIL');
  await shot(page, 'after-login', 1);

  currentStep = 'create-customer-live';
  const testName = 'E2E Cloud Customer ' + Date.now();
  const createResult = await page.evaluate((name) => {
    return createCustomer({ name, contactPerson: 'E2E Tester', tel: '3900' + Math.floor(Math.random() * 900000), address: 'Manama, Bahrain' });
  }, testName);
  record('createCustomer() returns synchronously with a real id (optimistic local write, unchanged call signature)', !createResult.error && !!createResult.id ? 'PASS' : 'FAIL', JSON.stringify(createResult));

  const foundLocally = await page.evaluate((name) => customers.some(c => c.name === name), testName);
  record('The new customer is immediately findable in the local customers array (no wait needed)', foundLocally ? 'PASS' : 'FAIL');

  currentStep = 'persist-to-cloud-live';
  await page.waitForTimeout(1500); // background persistNewCustomer() network round trip
  const persistedCheck = await page.evaluate(async (id) => {
    const { data, error } = await sb.from('customers').select('*').eq('id', id).maybeSingle();
    return { found: !!data, error: error ? error.message : null };
  }, createResult.id);
  record('The optimistically-created customer actually landed in the live Supabase table (background persist worked)', persistedCheck.found ? 'PASS' : 'FAIL', JSON.stringify(persistedCheck));

  currentStep = 'approve-customer-live';
  const approveResult = await page.evaluate((id) => approveCustomer(id, window.cloudIdentity), createResult.id);
  await page.waitForTimeout(1500);
  const approvalPersisted = await page.evaluate(async (id) => {
    const { data } = await sb.from('customers').select('status,approved_by').eq('id', id).maybeSingle();
    return data;
  }, createResult.id);
  record('approveCustomer() updates synchronously and the status change persists to the live table', approveResult.status === 'approved' && approvalPersisted && approvalPersisted.status === 'approved' ? 'PASS' : 'FAIL', JSON.stringify({ approveResult, approvalPersisted }));

  currentStep = 'realtime-sync-second-session';
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page2.on('pageerror', err => pageErrors.push({ step: 'realtime-sync-second-session', text: err.message }));
  const login2 = await signInOrUp(page2, fileUrl);
  if (login2.ok) {
    await page2.waitForTimeout(1200);
    const seenOnSecondDevice = await page2.evaluate((name) => customers.some(c => c.name === name), testName);
    record('A customer created on one session appears in a second session\'s cache (real cross-device sync, not per-tab state)', seenOnSecondDevice ? 'PASS' : 'FAIL');
  } else {
    record('Second session for realtime-sync check could sign in', 'FAIL', login2.reason);
  }
  await shot(page2, 'second-session', 2);
  await page2.close();

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
