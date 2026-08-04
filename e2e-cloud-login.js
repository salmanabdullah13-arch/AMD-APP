// Verification for the new cloud-login layer (4 Aug 2026, Phase 1 of
// the Supabase migration): PIN still gates first, then a real
// Supabase-backed login screen takes over instead of unlocking #app
// directly. This test covers everything reachable without a real
// email inbox: the PIN->cloud-login handoff, the email form, and the
// real (live) network call to Supabase's Auth API through to "check
// your email." Clicking the actual magic link can only be verified by
// a human with a real inbox — that boundary is intentional, not a gap
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
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  currentStep = 'pin-unlock';
  for (const d of ['1', '9', '9', '4']) { await page.click(`.num-btn[onclick="pt('${d}')"]`); await page.waitForTimeout(120); }
  await shot(page, 'after-pin');

  const handoff = await page.evaluate(() => ({
    lockHidden: document.getElementById('lock').style.display === 'none',
    cloudLoginVisible: getComputedStyle(document.getElementById('cloud-login')).display !== 'none',
    appStillHidden: getComputedStyle(document.getElementById('app')).display === 'none'
  }));
  record('Correct PIN hides the PIN screen and shows cloud-login (not #app directly)', handoff.lockHidden && handoff.cloudLoginVisible && handoff.appStillHidden ? 'PASS' : 'FAIL', JSON.stringify(handoff));

  currentStep = 'email-form-render';
  await page.waitForTimeout(500); // real getSession() round trip
  const emailFormShown = await page.evaluate(() => !!document.getElementById('cloud-email-input'));
  record('Email form renders (no persisted session found, as expected for a fresh browser)', emailFormShown ? 'PASS' : 'FAIL');
  await shot(page, 'email-form');

  currentStep = 'send-magic-link-live';
  const testEmail = `e2e-cloud-login-${Date.now()}@example.org`;
  await page.fill('#cloud-email-input', testEmail);
  await page.click('#cloud-login-body button');
  await page.waitForTimeout(2500); // real network call to Supabase Auth API
  await shot(page, 'after-send');
  const sentState = await page.evaluate(() => document.getElementById('cloud-login-body').innerHTML);
  const checkEmailShown = sentState.includes('Check your email');
  const genericErrorShown = sentState.includes('invalid') || sentState.includes('Invalid');
  record(
    'Real signInWithOtp() call to live Supabase project succeeds (shows "Check your email"), not an error',
    checkEmailShown ? 'PASS' : 'FAIL',
    checkEmailShown ? '' : `Body was: ${sentState.slice(0, 300)}`
  );
  if (!checkEmailShown) record('(diagnostic) does the panel show a rejection reason', genericErrorShown ? 'INFO' : 'INFO', sentState.slice(0, 300));

  currentStep = 'use-different-email';
  if (checkEmailShown) {
    await page.click('#cloud-login-body >> text=Use a different email');
    await page.waitForTimeout(200);
    const backToForm = await page.evaluate(() => !!document.getElementById('cloud-email-input'));
    record('"Use a different email" returns to the email form', backToForm ? 'PASS' : 'FAIL');
  }

  currentStep = 'final';
  await shot(page, 'final-state');
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
