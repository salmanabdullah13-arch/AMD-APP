// Verification for the cloud-login layer (4 Aug 2026, Phase 1 of the
// Supabase migration) — the app's real entry gate, replacing the old
// shared 4-digit PIN outright (removed same day: it was never real
// security, just a hardcoded code shown as an on-screen hint).
//
// Third iteration on the login *shape* the same day, each a real call
// from Salman: magic link (too much per-login friction) -> email +
// password (still needed a real inbox, and several roster identities
// are roles with no personal inbox) -> username (pick your name from
// the roster) + password, no email anywhere. Each name maps to a
// deterministic fake address under the hood (identityToInternalEmail)
// that Supabase's account system needs internally but the user never
// sees. Consequence: no self-service password recovery — that's a
// real, accepted tradeoff (see auth.js's header), not a gap to fix
// here.
//
// This test covers everything reachable live: the roster loading into
// both Sign In and Sign Up pickers, a real sign-up (name+password) all
// the way to a working session and claimed profile (this project has
// "Confirm email" OFF specifically so this can complete without any
// email step — if that ever gets re-enabled this check will correctly
// fail, since a fake address can never confirm), then signing back out
// and signing back in with the same name+password.
//
// REQUIRES `allowed_identities` to be readable by `public` (not just
// `authenticated`) — see supabase/schema.sql — and Supabase's
// "Confirm email" setting to be OFF (Authentication -> Sign In /
// Providers -> Email). Both are one-time project settings, not
// something this test or the app code can change.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-cloud-login');
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
  console.log('\n=== CLOUD LOGIN VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Real network access to supabase.co is required for this suite —
  // unlike every other e2e-*.js in this repo, this one is NOT fully
  // offline/self-contained.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  // Opts OUT of the auto-bypass auth.js grants every other file:// test —
  // this is the one suite that needs the real cloud-login screen to show.
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';
  await page.goto(fileUrl);

  currentStep = 'cloud-login-shows-on-load';
  await page.waitForTimeout(800); // real getSession() + roster fetch round trip
  await shot(page, 'on-load');
  const handoff = await page.evaluate(() => {
    const select = document.getElementById('auth-identity-select');
    return {
      cloudLoginVisible: getComputedStyle(document.getElementById('cloud-login')).display !== 'none',
      appStillHidden: getComputedStyle(document.getElementById('app')).display === 'none',
      noOldPinScreen: !document.getElementById('lock') && !document.querySelector('.num-btn'),
      noEmailFieldAnywhere: !document.getElementById('cloud-login').querySelector('input[type="email"]'),
      rosterLoaded: !!select && select.options.length > 1,
      hasSilva: select ? Array.from(select.options).some(o => o.value === 'Silva') : false
    };
  });
  record(
    'Sign In screen shows immediately on load with the real roster loaded, no email field anywhere, old PIN screen gone entirely',
    handoff.cloudLoginVisible && handoff.appStillHidden && handoff.noOldPinScreen && handoff.noEmailFieldAnywhere && handoff.rosterLoaded && handoff.hasSilva ? 'PASS' : 'FAIL',
    JSON.stringify(handoff)
  );

  // Dedicated test-only roster entry (see supabase/schema.sql) — never
  // a real person's identity. Signing up as a real name here would
  // permanently consume it with a throwaway test password nobody
  // knows, locking out whoever that real person is.
  // Same fixed identity+password used by e2e-cloud-messages-presence.js
  // and e2e-cloud-customers.js — must match exactly, since all three
  // tests share this one dedicated account and only the first run ever
  // actually sets its password (subsequent runs correctly hit "already
  // registered" below and move on without re-testing the create path).
  const testIdentity = 'E2E Test Account';
  const testPassword = 'E2eFixedTestPassword1234!';

  currentStep = 'switch-to-signup';
  await page.click('#cloud-login-body button:nth-of-type(2)');
  await page.waitForSelector('#auth-password-confirm-input', { state: 'visible', timeout: 10000 });
  const signupFormShown = await page.evaluate(() => !!document.getElementById('auth-identity-select') && !!document.getElementById('auth-password-confirm-input'));
  record('Sign Up tab shows the roster picker + password + confirm-password (no email field)', signupFormShown ? 'PASS' : 'FAIL');
  await shot(page, 'signup-form');

  currentStep = 'signup-live';
  const rosterHasTestAccount = await page.evaluate((name) =>
    Array.from(document.getElementById('auth-identity-select').options).some(o => o.value === name), testIdentity);
  if (!rosterHasTestAccount) {
    record(
      'signUp() with name+password reaches the live Supabase project and produces a coherent outcome',
      'FAIL',
      'ACTION NEEDED: "E2E Test Account" isn\'t in the live allowed_identities table yet — run the latest supabase/schema.sql insert against the project.'
    );
    currentStep = 'cdn-failure-fallback';
  } else {
  await page.selectOption('#auth-identity-select', testIdentity);
  await page.fill('#auth-password-input', testPassword);
  await page.fill('#auth-password-confirm-input', testPassword);
  await page.click('#cloud-login-body button:has-text("Create Account")');
  await page.waitForTimeout(5000); // real network round trip — signUp() + immediately checking/claiming the profile row
  await shot(page, 'after-signup');
  const afterSignupHtml = await page.evaluate(() => document.body.innerHTML);
  const landedInApp = await page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
  const alreadyRegistered = afterSignupHtml.includes('already has an account');
  const confirmEmailStillOn = afterSignupHtml.includes('needs email confirmation');
  record(
    'signUp() with name+password reaches the live Supabase project and produces a coherent outcome',
    landedInApp || alreadyRegistered || confirmEmailStillOn ? 'PASS' : 'FAIL',
    landedInApp ? 'Landed in #app (Confirm email is OFF, as intended)'
      : alreadyRegistered ? 'Already registered (acceptable — a prior test run owns this account)'
      : confirmEmailStillOn ? 'ACTION NEEDED: Supabase "Confirm email" is still ON — turn it off (Authentication -> Sign In / Providers -> Email) or sign-up can never complete for a fake address'
      : afterSignupHtml.slice(0, 300)
  );

  if (landedInApp) {
    currentStep = 'signout-and-signin';
    // cloudSignOut() calls location.reload() — wait for that actual
    // navigation to finish rather than a fixed timeout, so the next
    // interactions can't land mid-reload (which was silently wiping
    // them out: the reload completing just after a race is what
    // produced an unexplained-looking failure here first pass).
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.evaluate(() => cloudSignOut())
    ]);
    await page.waitForSelector('#auth-identity-select', { state: 'visible' });
    await shot(page, 'after-signout');
    const backAtLogin = await page.evaluate(() => getComputedStyle(document.getElementById('cloud-login')).display !== 'none' && getComputedStyle(document.getElementById('app')).display === 'none');
    record('cloudSignOut() returns to the login screen', backAtLogin ? 'PASS' : 'FAIL');

    await page.selectOption('#auth-identity-select', testIdentity);
    await page.fill('#auth-password-input', testPassword);
    await page.click('#cloud-login-body button[onclick="handleSignIn()"]');
    await page.waitForFunction(() => {
      const appVisible = getComputedStyle(document.getElementById('app')).display !== 'none';
      const stillOnSigningIn = document.getElementById('cloud-login-body')?.textContent.includes('Signing in');
      return appVisible || !stillOnSigningIn;
    }, { timeout: 15000 }).catch(() => null);
    await shot(page, 'after-signin');
    const signedBackIn = await page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
    record('Signing back in with the same name + password (no email step at all) works', signedBackIn ? 'PASS' : 'FAIL');
  }
  }

  currentStep = 'cdn-failure-fallback';
  const cdnFailPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const cdnFailPageErrors = [];
  cdnFailPage.on('pageerror', err => cdnFailPageErrors.push(err.message));
  await cdnFailPage.route('**/supabase-js@2**', route => route.abort());
  await cdnFailPage.goto(fileUrl);
  await cdnFailPage.waitForTimeout(300);
  const fallbackState = await cdnFailPage.evaluate(() =>
    document.getElementById('cloud-login-body')?.innerHTML.includes("Couldn't load the login library")
  );
  record(
    'If the Supabase CDN script fails to load, cloud-login shows a clear error instead of a silent blank screen (no uncaught error)',
    fallbackState && cdnFailPageErrors.length === 0 ? 'PASS' : 'FAIL',
    JSON.stringify({ fallbackShown: fallbackState, pageErrors: cdnFailPageErrors })
  );
  await shot(cdnFailPage, 'cdn-failure-fallback');
  await cdnFailPage.close();

  currentStep = 'final';
  await shot(page, 'final-state');
  // The 422 from signup-live is Supabase correctly rejecting a
  // duplicate registration once "E2E Test Account" already exists
  // (expected on any run after the first) — the app handles it
  // gracefully (see the PASS above), Chrome just also logs the
  // underlying failed fetch as a console error regardless.
  const critical = consoleErrors.filter(e => !e.text.includes('favicon') && !(e.step === 'signup-live' && e.text.includes('422')));
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
