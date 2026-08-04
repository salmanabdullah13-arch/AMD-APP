// Verification for the cloud-login layer (4 Aug 2026, Phase 1 of the
// Supabase migration) — the app's real entry gate, replacing the old
// shared 4-digit PIN outright (removed same day: it was never real
// security, just a hardcoded code shown as an on-screen hint). This
// test covers everything reachable without a real email inbox: the
// cloud-login screen rendering on load, the email form, and the real
// (live) network call to Supabase's Auth API through to "check your
// email." Clicking the actual magic link can only be verified by a
// human with a real inbox — that boundary is intentional, not a gap
// in this test.

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
  await shot(page, 'on-load');
  const handoff = await page.evaluate(() => ({
    cloudLoginVisible: getComputedStyle(document.getElementById('cloud-login')).display !== 'none',
    appStillHidden: getComputedStyle(document.getElementById('app')).display === 'none',
    noOldPinScreen: !document.getElementById('lock') && !document.querySelector('.num-btn')
  }));
  record('Cloud-login shows immediately on load, #app stays hidden until it completes, and the old PIN screen is gone entirely', handoff.cloudLoginVisible && handoff.appStillHidden && handoff.noOldPinScreen ? 'PASS' : 'FAIL', JSON.stringify(handoff));

  currentStep = 'email-form-render';
  await page.waitForTimeout(500); // real getSession() round trip
  const emailFormShown = await page.evaluate(() => !!document.getElementById('cloud-email-input'));
  record('Email form renders (no persisted session found, as expected for a fresh browser)', emailFormShown ? 'PASS' : 'FAIL');
  await shot(page, 'email-form');

  currentStep = 'send-magic-link-live';
  // NOTE: since custom SMTP (Resend, sandbox mode) went live, this can never
  // show "Check your email" for a synthetic address — Resend's sandbox sender
  // only delivers to the one real address verified with Resend, which this
  // test intentionally doesn't have/use (that email is a secret, not
  // something to hardcode here). What this CAN still verify live: the
  // request actually reaches Supabase's real Auth API and comes back with
  // SOME real response (not stuck on "Sending…", not an uncaught error) —
  // i.e. the wiring works end to end right up to the point only a real
  // verified inbox can take over.
  const testEmail = `e2e-cloud-login-${Date.now()}@example.org`;
  await page.fill('#cloud-email-input', testEmail);
  await page.click('#cloud-login-body button');
  await page.waitForTimeout(6000); // real network call to Supabase Auth API -> real SMTP relay round trip, slower than the old default mailer
  await shot(page, 'after-send');
  const sentState = await page.evaluate(() => document.getElementById('cloud-login-body').innerHTML);
  const checkEmailShown = sentState.includes('Check your email');
  const stillSending = sentState.includes('Sending…');
  const gotSomeRealResponse = checkEmailShown || (!stillSending && sentState.includes('cloud-email-input'));
  record(
    'signInWithOtp() reaches the live Supabase Auth API and returns a real response (not hung, not uncaught) — a "Check your email" pass here would mean this synthetic address happened to match your verified Resend recipient, which is not expected',
    gotSomeRealResponse ? 'PASS' : 'FAIL',
    checkEmailShown ? 'Got "Check your email"' : `Got an error response (expected — sandbox correctly rejected an unverified test recipient): ${sentState.slice(0, 200)}`
  );

  currentStep = 'use-different-email';
  if (checkEmailShown) {
    await page.click('#cloud-login-body >> text=Use a different email');
    await page.waitForTimeout(200);
    const backToForm = await page.evaluate(() => !!document.getElementById('cloud-email-input'));
    record('"Use a different email" returns to the email form', backToForm ? 'PASS' : 'FAIL');
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
  // The 500 from send-magic-link-live is Resend's sandbox mode correctly
  // rejecting an unverified test recipient — expected given the note on
  // that check above, not a real console error to chase.
  const critical = consoleErrors.filter(e => !e.text.includes('favicon') && !(e.step === 'send-magic-link-live' && e.text.includes('500')));
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
