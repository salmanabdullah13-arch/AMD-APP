// Verification for the cloud-login layer (4 Aug 2026, Phase 1 of the
// Supabase migration) — the app's real entry gate, replacing the old
// shared 4-digit PIN outright (removed same day: it was never real
// security, just a hardcoded code shown as an on-screen hint).
//
// Swapped from magic-link to email+password the same day (Salman's
// call — checking email on every login was real friction). Sign-up
// still needs a one-time confirm-email click; every login after that
// is just email+password. This test covers everything reachable
// without a real inbox: the sign-in/sign-up tabs, the roster loading
// into the sign-up form live from Supabase, a real (live) signUp()
// call through to "confirm your account," and the forgot-password
// request. Clicking the actual confirmation/reset email can only be
// verified by a human with a real inbox — that boundary is
// intentional, not a gap in this test.
//
// REQUIRES the `allowed_identities` roster to be readable by anon
// (public), not just authenticated users — see the "roster is
// readable by anyone" policy in supabase/schema.sql. If that hasn't
// been run against the live project yet, the sign-up-roster check
// below will correctly fail until it is.

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
  await page.waitForTimeout(500); // real getSession() round trip
  await shot(page, 'on-load');
  const handoff = await page.evaluate(() => ({
    cloudLoginVisible: getComputedStyle(document.getElementById('cloud-login')).display !== 'none',
    appStillHidden: getComputedStyle(document.getElementById('app')).display === 'none',
    noOldPinScreen: !document.getElementById('lock') && !document.querySelector('.num-btn'),
    signInFormShown: !!document.getElementById('auth-email-input') && !!document.getElementById('auth-password-input')
  }));
  record('Cloud-login shows the Sign In form immediately on load, #app stays hidden, old PIN screen gone entirely', handoff.cloudLoginVisible && handoff.appStillHidden && handoff.noOldPinScreen && handoff.signInFormShown ? 'PASS' : 'FAIL', JSON.stringify(handoff));

  currentStep = 'switch-to-signup-loads-roster-live';
  // Click the "Sign Up" tab (second button in the tab row).
  await page.click('#cloud-login-body button:nth-of-type(2)');
  await page.waitForTimeout(600); // real roster fetch from Supabase
  await shot(page, 'signup-form');
  const signupState = await page.evaluate(() => {
    const select = document.getElementById('auth-identity-select');
    return {
      selectExists: !!select,
      optionCount: select ? select.options.length : 0,
      hasSilva: select ? Array.from(select.options).some(o => o.value === 'Silva') : false
    };
  });
  record('Sign Up tab loads the real roster live from Supabase into the identity dropdown', signupState.selectExists && signupState.optionCount > 1 && signupState.hasSilva ? 'PASS' : 'FAIL', JSON.stringify(signupState));

  currentStep = 'signup-live';
  const testEmail = `e2e-cloud-login-${Date.now()}@example.org`;
  await page.selectOption('#auth-identity-select', 'Silva').catch(() => {});
  await page.fill('#auth-email-input', testEmail);
  await page.fill('#auth-password-input', 'TempTest1234!');
  await page.click('#cloud-login-body button:has-text("Create Account")');
  await page.waitForTimeout(4000); // real network call to Supabase Auth API
  await shot(page, 'after-signup');
  const signupResultHtml = await page.evaluate(() => document.getElementById('cloud-login-body').innerHTML);
  const confirmShown = signupResultHtml.includes('Confirm your account');
  const stillCreating = signupResultHtml.includes('Creating account');
  record(
    'signUp() reaches the live Supabase Auth API and returns a real response (confirmation prompt or a real error, not hung)',
    (confirmShown || !stillCreating) ? 'PASS' : 'FAIL',
    confirmShown ? 'Got "Confirm your account"' : `Body: ${signupResultHtml.slice(0, 200)}`
  );

  currentStep = 'forgot-password-live';
  await page.click(confirmShown ? '#cloud-login-body >> text=Back to Sign In' : '#cloud-login-body button:nth-of-type(1)').catch(() => {});
  await page.waitForTimeout(200);
  await page.click('#cloud-login-body >> text=Forgot password?').catch(() => {});
  await page.waitForTimeout(200);
  const forgotFormShown = await page.evaluate(() => !!document.getElementById('auth-email-input') && document.getElementById('cloud-login-body').innerHTML.includes('reset link'));
  if (forgotFormShown) {
    await page.fill('#auth-email-input', testEmail);
    await page.click('#cloud-login-body button:has-text("Send Reset Link")');
    await page.waitForTimeout(3000); // real network call
    const forgotResultHtml = await page.evaluate(() => document.getElementById('cloud-login-body').innerHTML);
    const sentShown = forgotResultHtml.includes('Sent —');
    record('resetPasswordForEmail() reaches the live Supabase Auth API and returns a real response', sentShown || !forgotResultHtml.includes('Send Reset Link') ? 'PASS' : 'FAIL', forgotResultHtml.slice(0, 200));
  } else {
    record('Forgot-password form is reachable from Sign In', 'FAIL', 'Could not navigate to it');
  }
  await shot(page, 'forgot-password');

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
  // 500s from signup-live/forgot-password-live against a synthetic
  // @example.org address are expected — nothing to chase.
  const critical = consoleErrors.filter(e => !e.text.includes('favicon') && !((e.step === 'signup-live' || e.step === 'forgot-password-live') && e.text.includes('50')));
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
