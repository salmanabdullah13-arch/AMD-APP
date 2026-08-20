// Verification for the DOB/age-gate work (5 Aug 2026) — sign-up must
// reject anyone under 18, and even if a bad DOB somehow reaches the
// database (e.g. via the manual identity-claim fallback, which doesn't
// collect DOB at all, or direct API access), the approval queue must
// refuse to approve them — that's the real, authoritative gate, not
// the sign-up form's friendly rejection.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// Local calendar dates, matching the app (data.js localISO/todayISO). A test
// that computes an expected date through toISOString() disagrees with the app
// between local midnight and 03:00 in UTC+3 — a flake that only appears at
// night. Node-side copy: inside page.evaluate() the app's own global resolves.
const localISO = (d) => { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const todayISO = () => localISO(new Date());
const SHOT_DIR = path.join(__dirname, 'e2e-shots-age-gate');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== AGE GATE VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const APPROVER_IDENTITY = 'E2E Approver Account';
const FIXED_PASSWORD = 'E2eFixedTestPassword1234!';
const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';

async function signInAs(page, displayName) {
  await page.goto(fileUrl);
  await page.waitForFunction(() => {
    const s = document.getElementById('auth-identity-select');
    return s && s.options.length > 1;
  }, { timeout: 10000 }).catch(() => null);
  await page.selectOption('#auth-identity-select', displayName);
  await page.fill('#auth-password-input', FIXED_PASSWORD);
  await page.click('#cloud-login-body button[onclick="handleSignIn()"]');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 15000 }).catch(() => null);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });

  currentStep = 'dob-field-has-label-and-max';
  await page.goto(fileUrl);
  await page.waitForFunction(() => { const s = document.getElementById('auth-usertype-select'); return s && s.options.length > 1; }, { timeout: 10000 }).catch(() => null);
  await page.click('#cloud-login-body button:nth-of-type(2)');
  await page.waitForSelector('#auth-dob-input', { state: 'visible', timeout: 10000 });
  const fieldState = await page.evaluate(() => {
    const input = document.getElementById('auth-dob-input');
    const eighteenYearsAgo = new Date(); eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    const expectedMax = localISO(eighteenYearsAgo);
    const labelText = document.querySelector('#cloud-login-body label')?.textContent || '';
    return { max: input.max, expectedMax, hasLabelMentioningDob: labelText.includes('Date of Birth'), hasLabelMentioning18: labelText.includes('18') };
  });
  record(
    'DOB field has a visible label mentioning "Date of Birth"/"18" and max capped to 18 years ago',
    fieldState.hasLabelMentioningDob && fieldState.hasLabelMentioning18 && fieldState.max === fieldState.expectedMax ? 'PASS' : 'FAIL',
    JSON.stringify(fieldState)
  );
  await shot(page, 'signup-dob-field', 1);

  currentStep = 'dob-blocks-typing';
  const typingBlocked = await page.evaluate(() => {
    const input = document.getElementById('auth-dob-input');
    return input.getAttribute('onkeydown') === 'return false' && input.getAttribute('onpaste') === 'return false';
  });
  record('DOB field blocks manual keyboard entry and paste', typingBlocked ? 'PASS' : 'FAIL', JSON.stringify({ typingBlocked }));

  currentStep = 'under-18-signup-rejected';
  const stamp = Date.now();
  const tooYoung = new Date(); tooYoung.setFullYear(tooYoung.getFullYear() - 5); // 5 years old
  await page.fill('#auth-fullname-input', `E2E Age Gate Throwaway ${stamp}`);
  await page.fill('#auth-dob-input', localISO(tooYoung));
  await page.fill('#auth-phone-input', '3992' + String(stamp).slice(-6));
  await page.fill('#auth-designation-input', 'Test Designation');
  await page.selectOption('#auth-usertype-select', 'storekeeper');
  await page.fill('#auth-password-input', FIXED_PASSWORD);
  await page.fill('#auth-password-confirm-input', FIXED_PASSWORD);
  await page.click('#cloud-login-body button[onclick="handleSignUp()"]');
  await page.waitForTimeout(500);
  const rejection = await page.evaluate(() => ({
    stillOnSignupForm: !!document.getElementById('auth-fullname-input'),
    message: document.getElementById('cloud-login-body')?.textContent || ''
  }));
  record(
    'Sign-up with a 5-year-old DOB is rejected client-side with a clear message, no account created',
    rejection.stillOnSignupForm && rejection.message.includes('at least 18') ? 'PASS' : 'FAIL',
    JSON.stringify(rejection)
  );
  await shot(page, 'under-18-rejected', 2);

  currentStep = 'approval-queue-blocks-bad-dob';
  // Tests the approval-side gate directly — this is what actually runs
  // against a real pending row regardless of how a bad DOB got there
  // (a fresh sign-up that somehow bypassed the client-side check, or
  // the manual identity-claim fallback, which collects no DOB at all).
  await signInAs(page, APPROVER_IDENTITY);
  const tooYoung2 = new Date(); tooYoung2.setFullYear(tooYoung2.getFullYear() - 10);
  const guardResult = await page.evaluate((dob) => {
    if (typeof aqAgeBlockReason !== 'function') return { error: 'aqAgeBlockReason not found' };
    return { blockReason: aqAgeBlockReason(dob) };
  }, localISO(tooYoung2));
  record(
    'aqAgeBlockReason() correctly flags an under-18 DOB as unapprovable',
    guardResult.blockReason && guardResult.blockReason.includes('Under 18') ? 'PASS' : 'FAIL',
    JSON.stringify(guardResult)
  );

  currentStep = 'approval-queue-blocks-missing-dob';
  const missingDobResult = await page.evaluate(() => {
    if (typeof aqAgeBlockReason !== 'function') return { error: 'aqAgeBlockReason not found' };
    return { blockReason: aqAgeBlockReason(null) };
  });
  record(
    'aqAgeBlockReason() treats a missing DOB as unverifiable, not approvable',
    missingDobResult.blockReason && missingDobResult.blockReason.includes('cannot verify') ? 'PASS' : 'FAIL',
    JSON.stringify(missingDobResult)
  );

  currentStep = 'approval-queue-allows-adult';
  const adultDob = new Date(); adultDob.setFullYear(adultDob.getFullYear() - 30);
  const adultResult = await page.evaluate((dob) => {
    if (typeof aqAgeBlockReason !== 'function') return { error: 'aqAgeBlockReason not found' };
    return { blockReason: aqAgeBlockReason(dob) };
  }, localISO(adultDob));
  record('aqAgeBlockReason() does not block a real adult DOB (30 years old)', adultResult.blockReason === null ? 'PASS' : 'FAIL', JSON.stringify(adultResult));

  currentStep = 'approve-button-hidden-for-blocked-row';
  // Wire a synthetic blocked row directly into the in-memory queue
  // (approvalQueueRows) and render it, to prove the actual UI — not
  // just the underlying function — hides the Approve button and shows
  // the warning.
  await page.evaluate((dob) => {
    approvalQueueRows = [{ id: 'synthetic-under-18', display_name: 'Synthetic Minor', dob, phone: '000', designation: 'Test', user_type: 'storekeeper', approval_status: 'pending' }];
    approvalQueueUserTypes = [{ key: 'storekeeper', label: 'Storekeeper' }];
    const container = document.createElement('div');
    container.id = 'age-gate-test-container';
    document.body.appendChild(container);
    renderApprovalQueueInto('age-gate-test-container');
  }, localISO(tooYoung2));
  await page.waitForTimeout(200);
  const uiState = await page.evaluate(() => {
    const container = document.getElementById('age-gate-test-container');
    const approveBtn = container.querySelector('button[onclick*="approvalQueueApprove"]');
    const disabledBtn = container.querySelector('button[disabled]');
    return { hasEnabledApproveButton: !!approveBtn, hasDisabledApproveButton: !!disabledBtn, showsWarning: container.textContent.includes('Under 18') };
  });
  record('The approval queue UI itself hides the Approve action for a blocked row and shows the warning', !uiState.hasEnabledApproveButton && uiState.hasDisabledApproveButton && uiState.showsWarning ? 'PASS' : 'FAIL', JSON.stringify(uiState));
  await shot(page, 'approval-queue-blocked-row', 3);

  currentStep = 'approve-function-refuses-directly';
  // Calls approvalQueueApprove() directly — bypassing the hidden button
  // entirely, as someone could via the browser console — to prove the
  // hard guard inside the function itself is the real gate, not just
  // the UI not offering the button.
  const directCallResult = await page.evaluate(async () => {
    await approvalQueueApprove('synthetic-under-18', 'age-gate-test-container');
    // Still present + still pending means the function refused before
    // ever reaching the database.
    const stillPresent = approvalQueueRows.some(r => r.id === 'synthetic-under-18');
    return { stillPresent };
  });
  record('approvalQueueApprove() refuses an under-18 row even when called directly (not just hiding the button)', directCallResult.stillPresent ? 'PASS' : 'FAIL', JSON.stringify(directCallResult));

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
