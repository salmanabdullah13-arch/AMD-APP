// Verification for the role-based access rollout's approval workflow
// (5 Aug 2026) — a self-registered account (auth.js's new sign-up form:
// Full Name/DOB/Telephone/Designation/User Type) starts approval_status
// = 'pending' with ZERO app access, enforced for real in RLS
// (public.is_approved(), supabase/schema.sql) — not just hidden behind
// a client-side screen. An Owner/HR account (approval-queue.js) then
// approves or rejects it.
//
// Uses two fixture identities against the live project: 'E2E Approver
// Account' (pre-approved user_type='owner', bootstrapped once directly
// via SQL — see the 5 Aug 2026 CLAUDE.md entry — since a fresh sign-up
// can't approve itself) performs the approve/reject actions, and a
// fresh THROWAWAY pending account (unique name per run) is what
// actually gets approved/rejected. Kept separate from 'E2E Test
// Account' (a plain user_type='sales' account four other live-cloud
// tests already depend on) so nothing here risks disturbing those.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-signup-approval');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== SIGN-UP APPROVAL WORKFLOW VERIFICATION ===');
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
  await page.waitForTimeout(2500);
}

async function signUpFresh(page, stamp) {
  await page.goto(fileUrl);
  await page.waitForFunction(() => {
    const s = document.getElementById('auth-usertype-select');
    return s && s.options.length > 1;
  }, { timeout: 10000 }).catch(() => null);
  await page.click('#cloud-login-body button:nth-of-type(2)'); // Sign Up tab
  await page.waitForSelector('#auth-fullname-input', { state: 'visible', timeout: 10000 });
  await page.fill('#auth-fullname-input', `E2E Signup Throwaway ${stamp}`);
  await page.fill('#auth-dob-input', '1995-06-15');
  await page.fill('#auth-phone-input', '3990' + String(stamp).slice(-6));
  await page.fill('#auth-designation-input', 'Test Designation');
  await page.selectOption('#auth-usertype-select', 'storekeeper');
  await page.fill('#auth-password-input', FIXED_PASSWORD);
  await page.fill('#auth-password-confirm-input', FIXED_PASSWORD);
  await page.click('#cloud-login-body button[onclick="handleSignUp()"]');
  // Polls for the actual pending-approval screen rather than a fixed
  // sleep — the real chain here (auth signUp -> afterSignedIn ->
  // allowed_identities insert -> profiles insert -> renderPendingApproval)
  // is several sequential network round trips, and a fixed short wait
  // was flaky over the live connection (found live-testing: the row
  // always eventually landed correctly, just not within 2.5s every time).
  await page.waitForFunction(() => {
    const t = document.getElementById('cloud-login-body')?.textContent || '';
    return t.includes('waiting for approval') || t.includes('already registered') || t.includes('claimed by someone else');
  }, { timeout: 20000 }).catch(() => null);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });

  currentStep = 'fresh-signup';
  const stamp = Date.now();
  await signUpFresh(page, stamp);
  const afterSignup = await page.evaluate(() => ({
    appHidden: getComputedStyle(document.getElementById('app')).display === 'none',
    pendingText: document.getElementById('cloud-login-body')?.textContent || ''
  }));
  record(
    'Fresh sign-up with the new registration form lands on the pending-approval screen with no app access',
    afterSignup.appHidden && afterSignup.pendingText.includes('waiting for approval') ? 'PASS' : 'FAIL',
    JSON.stringify(afterSignup)
  );
  await shot(page, 'pending-screen', 1);

  currentStep = 'rls-blocks-pending';
  const rlsCheck = await page.evaluate(async () => {
    const { data, error } = await sb.from('customers').select('id').limit(1);
    return { rowCount: (data || []).length, errorCode: error ? error.code : null };
  });
  record(
    'A pending account is blocked from reading OTHER tables directly via the API (real RLS enforcement, not just a hidden UI screen)',
    rlsCheck.rowCount === 0 ? 'PASS' : 'FAIL',
    JSON.stringify(rlsCheck)
  );

  currentStep = 'approver-signs-in';
  await page.evaluate(() => sb.auth.signOut());
  await signInAs(page, APPROVER_IDENTITY);
  const approverIn = await page.evaluate(() => ({
    appVisible: getComputedStyle(document.getElementById('app')).display !== 'none',
    userType: window.cloudUserType
  }));
  record('The pre-approved owner fixture account signs in with real app access', approverIn.appVisible && approverIn.userType === 'owner' ? 'PASS' : 'FAIL', JSON.stringify(approverIn));

  currentStep = 'approval-queue-shows-pending';
  const queueState = await page.evaluate(async () => {
    if (typeof loadApprovalQueue !== 'function') return { error: 'loadApprovalQueue missing' };
    await loadApprovalQueue();
    return { rows: approvalQueueRows.map(r => r.display_name) };
  });
  const throwawayName = `E2E Signup Throwaway ${stamp}`;
  record(
    "The approval queue shows the fresh throwaway sign-up as pending",
    (queueState.rows || []).includes(throwawayName) ? 'PASS' : 'FAIL',
    JSON.stringify(queueState)
  );
  await shot(page, 'approval-queue', 2);

  currentStep = 'approve-throwaway';
  const approveResult = await page.evaluate(async (name) => {
    const row = approvalQueueRows.find(r => r.display_name === name);
    if (!row) return { error: 'row not found' };
    const { error } = await sb.from('profiles').update({
      approval_status: 'approved', user_type: 'storekeeper',
      approved_by: window.cloudIdentity, approved_date: new Date().toISOString().slice(0, 10)
    }).eq('id', row.id);
    return { error: error ? error.message : null, id: row.id };
  }, throwawayName);
  const approvedPersisted = await page.evaluate(async (id) => {
    const { data } = await sb.from('profiles').select('approval_status, user_type').eq('id', id).maybeSingle();
    return data;
  }, approveResult.id);
  record(
    'Approving the throwaway account (via the same update the approval queue UI uses) persists live',
    !approveResult.error && approvedPersisted && approvedPersisted.approval_status === 'approved' && approvedPersisted.user_type === 'storekeeper' ? 'PASS' : 'FAIL',
    JSON.stringify({ approveResult, approvedPersisted })
  );

  currentStep = 'approved-account-signs-in';
  await page.evaluate(() => sb.auth.signOut());
  await signInAs(page, throwawayName);
  const afterApprovalLogin = await page.evaluate(() => ({
    appVisible: getComputedStyle(document.getElementById('app')).display !== 'none',
    userType: window.cloudUserType
  }));
  record(
    'The now-approved account signs in with real app access and the correct user_type',
    afterApprovalLogin.appVisible && afterApprovalLogin.userType === 'storekeeper' ? 'PASS' : 'FAIL',
    JSON.stringify(afterApprovalLogin)
  );

  currentStep = 'rls-unblocked-after-approval';
  const rlsAfter = await page.evaluate(async () => {
    const { data, error } = await sb.from('customers').select('id').limit(1);
    return { rowCount: (data || []).length, errorCode: error ? error.code : null };
  });
  record(
    'The approval-gated table read now succeeds for the same account once approved',
    rlsAfter.rowCount > 0 ? 'PASS' : 'FAIL',
    JSON.stringify(rlsAfter)
  );

  currentStep = 'reject-path';
  const stamp2 = Date.now();
  await page.evaluate(() => sb.auth.signOut());
  await signUpFresh(page, stamp2);
  await page.evaluate(() => sb.auth.signOut());
  await signInAs(page, APPROVER_IDENTITY);
  const rejectName = `E2E Signup Throwaway ${stamp2}`;
  const rejectResult = await page.evaluate(async (name) => {
    await loadApprovalQueue();
    const row = approvalQueueRows.find(r => r.display_name === name);
    if (!row) return { error: 'row not found' };
    const { error } = await sb.from('profiles').update({
      approval_status: 'rejected', approved_by: window.cloudIdentity, approved_date: new Date().toISOString().slice(0, 10)
    }).eq('id', row.id);
    return { error: error ? error.message : null };
  }, rejectName);
  await page.evaluate(() => sb.auth.signOut());
  await signInAs(page, rejectName);
  const rejectedScreen = await page.evaluate(() => ({
    appHidden: getComputedStyle(document.getElementById('app')).display === 'none',
    rejectedText: document.getElementById('cloud-login-body')?.textContent || ''
  }));
  record(
    'A rejected account sees the "not approved" screen on sign-in, still no app access',
    !rejectResult.error && rejectedScreen.appHidden && rejectedScreen.rejectedText.includes('not approved') ? 'PASS' : 'FAIL',
    JSON.stringify({ rejectResult, rejectedScreen })
  );
  await shot(page, 'rejected-screen', 3);

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
