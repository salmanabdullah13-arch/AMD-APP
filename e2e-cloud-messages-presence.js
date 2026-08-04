// Verification for cloud-backed Messages + presence (4 Aug 2026, Phase
// 1 completion) — the real Supabase path, as opposed to
// e2e-team-comms-dashboard.js which deliberately exercises the
// in-memory fallback (bypass mode has no real authenticated session).
// This test goes through the REAL cloud-login flow (opts out of the
// bypass, same as e2e-cloud-login.js) as the dedicated 'E2E Test
// Account' roster identity, then exercises sendMessage()/
// getInboxFor()/markMessageRead() against the live `messages` table
// and confirms Supabase Realtime Presence actually tracks the session.
//
// REQUIRES the same two live-project prerequisites as
// e2e-cloud-login.js: `allowed_identities` readable by `public`
// (including the 'E2E Test Account' row) and "Confirm email" OFF.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-cloud-messages-presence');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== CLOUD MESSAGES + PRESENCE VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

// Fixed, not time-based — reused across runs so this test can either
// sign up (first run) or sign in (subsequent runs) as the same
// dedicated test account, never touching a real person's identity.
const TEST_IDENTITY = 'E2E Test Account';
const TEST_PASSWORD = 'E2eFixedTestPassword1234!';

async function signInOrUp(page, fileUrl) {
  await page.goto(fileUrl);
  // Wait for the roster fetch (renderAuthForms('signin')) to actually
  // populate the <select>, not just a fixed delay — interacting before
  // it's ready silently no-ops under .catch() below, which was the
  // real cause of an earlier confusing failure here (looked like a
  // wrong password; was actually an empty, never-selected dropdown).
  await page.waitForFunction(() => {
    const s = document.getElementById('auth-identity-select');
    return s && s.options.length > 1;
  }, { timeout: 10000 }).catch(() => null);
  // Try Sign In first (covers the common case: this account already
  // exists from a prior run).
  const hasSelect = await page.evaluate((name) => {
    const s = document.getElementById('auth-identity-select');
    return !!s && Array.from(s.options).some(o => o.value === name);
  }, TEST_IDENTITY);
  if (!hasSelect) return { ok: false, reason: 'roster-missing' };
  await page.selectOption('#auth-identity-select', TEST_IDENTITY);
  await page.fill('#auth-password-input', TEST_PASSWORD);
  await page.click('#cloud-login-body button[onclick="handleSignIn()"]');
  // Wait for the actual outcome (either #app appears, or an error
  // renders back into the login form) rather than guessing a fixed
  // delay — signInWithPassword() + the profile check afterward is a
  // real multi-step network round trip that has taken anywhere from
  // under a second to several seconds elsewhere in this session.
  await page.waitForFunction(() => {
    const appVisible = getComputedStyle(document.getElementById('app')).display !== 'none';
    const stillOnSigningIn = document.getElementById('cloud-login-body')?.textContent.includes('Signing in');
    return appVisible || !stillOnSigningIn;
  }, { timeout: 15000 }).catch(() => null);
  let inApp = await page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
  if (inApp) return { ok: true, via: 'signin' };
  // Doesn't exist yet — sign up instead.
  await page.click('#cloud-login-body button:nth-of-type(2)'); // Sign Up tab
  await page.waitForSelector('#auth-password-confirm-input', { state: 'visible', timeout: 10000 }).catch(() => null);
  await page.selectOption('#auth-identity-select', TEST_IDENTITY).catch(() => null);
  await page.fill('#auth-password-input', TEST_PASSWORD).catch(() => null);
  await page.fill('#auth-password-confirm-input', TEST_PASSWORD).catch(() => null);
  await page.click('#cloud-login-body button:has-text("Create Account")');
  await page.waitForTimeout(5000);
  inApp = await page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
  if (inApp) return { ok: true, via: 'signup' };
  const bodyHtml = await page.evaluate(() => document.getElementById('cloud-login-body')?.innerHTML || '');
  return { ok: false, reason: bodyHtml.slice(0, 300) };
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
  await shot(page, 'after-login', 1);
  record(
    'Signs in or up as the dedicated E2E Test Account through the REAL cloud-login flow (not the bypass)',
    login.ok ? 'PASS' : 'FAIL',
    login.ok ? `via ${login.via}` : (login.reason === 'roster-missing'
      ? 'ACTION NEEDED: "E2E Test Account" isn\'t in the live allowed_identities table yet — run supabase/schema.sql against the project.'
      : `Body: ${login.reason}`)
  );
  if (!login.ok) {
    currentStep = 'final';
    record('No unexpected console errors', consoleErrors.filter(e => !e.text.includes('favicon')).length === 0 ? 'PASS' : 'FAIL');
    record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL');
    printReport();
    await browser.close();
    process.exit(1);
  }

  currentStep = 'real-session-flags';
  const flags = await page.evaluate(() => ({ real: window.__realCloudSession === true, identity: window.cloudIdentity }));
  record('window.__realCloudSession is true and window.cloudIdentity is the real claimed name (not "E2E Test User" from the bypass)', flags.real && flags.identity === TEST_IDENTITY ? 'PASS' : 'FAIL', JSON.stringify(flags));

  currentStep = 'cloud-messages-live';
  await page.waitForTimeout(1200); // initCloudMessagesCache()'s initial fetch + realtime subscribe
  const testBody = 'e2e self-message ' + Date.now();
  const sendResult = await page.evaluate(async (body) => {
    return await sendMessage({ from: window.cloudIdentity, to: window.cloudIdentity, body });
  }, testBody);
  record('sendMessage() writes a real row to the live Supabase messages table', !sendResult.error && !!sendResult.id ? 'PASS' : 'FAIL', JSON.stringify(sendResult));

  await page.waitForTimeout(1500); // realtime INSERT event round trip
  const inboxCheck = await page.evaluate((body) => {
    const inbox = getInboxFor(window.cloudIdentity);
    return { found: inbox.some(m => m.body === body), count: inbox.length };
  }, testBody);
  record('The sent message appears in getInboxFor() via the live realtime cache (synchronous read, no await)', inboxCheck.found ? 'PASS' : 'FAIL', JSON.stringify(inboxCheck));

  currentStep = 'mark-read-live';
  const markReadResult = await page.evaluate(async (body) => {
    const before = getInboxFor(window.cloudIdentity).find(m => m.body === body);
    if (!before) return { error: 'not found before mark-read' };
    await markMessageRead(before.id);
    const after = getInboxFor(window.cloudIdentity).find(m => m.id === before.id);
    return { wasUnread: !before.read, isNowRead: after && after.read === true };
  }, testBody);
  record('markMessageRead() updates the live row and the local cache reflects it immediately', markReadResult.wasUnread && markReadResult.isNowRead ? 'PASS' : 'FAIL', JSON.stringify(markReadResult));

  currentStep = 'presence-live';
  await page.waitForTimeout(1000); // presence channel subscribe + track() round trip
  const presenceCheck = await page.evaluate(() => ({
    onlineSetHasSelf: typeof isOnline === 'function' && isOnline(window.cloudIdentity)
  }));
  record('Supabase Realtime Presence tracks this session — isOnline() sees itself after initPresence()', presenceCheck.onlineSetHasSelf ? 'PASS' : 'FAIL', JSON.stringify(presenceCheck));

  currentStep = 'final';
  await shot(page, 'final-state', 2);
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
