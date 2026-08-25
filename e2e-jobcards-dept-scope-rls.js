// Verification for Phase 3, third slice (5 Aug 2026) — department-
// scoped job_cards access. Today any approved user can read/write ANY
// job card via the API regardless of role — a Curtain Tracks Team
// login could read or tamper with a pure-Joinery job that has zero
// curtain lines. New RLS (supabase/schema.sql,
// caller_job_department_key() + rebuilt select/update policies)
// restricts department-scoped production roles (Joinery/Painting/
// Curtain/Upholstery) to job_cards rows with at least one item routed
// to their own department; commercial/operations/owner roles keep
// full, unrestricted access.
//
// KNOWN RESIDUAL GAP (documented, accepted): this is ROW-level scoping
// only — a mixed job (one row, multiple departments in its items[]
// array) can still have its OTHER department's line data touched by a
// raw API call once the caller's own department has any line in that
// same row. Not tested here as a "should reject" case since it's a
// known, accepted limitation, not a bug.
//
// Uses three real, live E2E fixture accounts: 'E2E Test Account'
// (user_type=sales, commercial — unrestricted), 'E2E Approver Account'
// (user_type=owner — unrestricted), and the new 'E2E Joinery Account'
// (user_type=joinery_production_manager — department-scoped to 'carp').
//
// KNOWN PRE-EXISTING FLAKE SOURCE (found while writing this test, NOT
// introduced by it): every cloud-synced array in this app (customers,
// quotations, job_cards, enquiries) has a realtime `postgres_changes`
// handler that unconditionally does `array[idx] = mapped` for ANY
// event, with no ordering/version check. Supabase Realtime echoes a
// write back to the SAME session that made it, not just other
// devices — if an earlier step's echo (e.g. the quotation's own
// insert confirmation) is delayed by network jitter and arrives AFTER
// a later step already mutated the same in-memory object, it can
// silently overwrite the newer state with a stale snapshot. This test
// creates several closely-spaced records/mutations quickly, which
// occasionally triggers it (observed directly via `jobCards` ending up
// with `items: []` after `confirmJobRouting()`, confirmed by
// inspecting the live row with a direct SQL query outside the app).
// waitForJobRouted() below polls and reports honestly rather than
// racing past it — if this test intermittently reports the setup step
// failed (not the actual RLS checks), re-run once; it is not evidence
// the department-scoping restriction itself is wrong. Not a regression
// from this slice — a pre-existing architectural characteristic of the
// whole cloud-sync layer, out of scope for a job_cards RLS change.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-jobcards-dept-scope-rls');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== JOB_CARDS DEPARTMENT-SCOPING RLS VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const SALES_IDENTITY = 'E2E Test Account';
const OWNER_IDENTITY = 'E2E Approver Account';
const JOINERY_IDENTITY = 'E2E Joinery Account';
const FIXED_PASSWORD = 'E2eFixedTestPassword1234!';

// Polls (as whichever session is currently signed in — Sales here,
// which has full read access) until the job's background persist has
// actually landed with a routed 'carp'/'curt' item, instead of a fixed
// sleep — job_cards' local-array-length id generation is a documented,
// pre-existing collision risk under concurrent test load (same
// tradeoff as customers' nextCustomerCode()), so a fixed wait alone
// isn't reliable inside a big sequential test sweep.
async function waitForJobRouted(page, jobId, deptKey, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const routed = await page.evaluate(async ({ jobId, deptKey }) => {
      const { data } = await sb.from('job_cards').select('items').eq('id', jobId).maybeSingle();
      return !!(data && data.items && data.items.some(it => (it.departmentSequence || []).includes(deptKey)));
    }, { jobId, deptKey });
    if (routed) return true;
    await page.waitForTimeout(400);
  }
  return false;
}

async function signIn(page, fileUrl, identity) {
  await page.goto(fileUrl);
  await page.waitForFunction(() => {
    const s = document.getElementById('auth-identity-select');
    return s && s.options.length > 1;
  }, { timeout: 10000 }).catch(() => null);
  await page.selectOption('#auth-identity-select', identity).catch(() => null);
  await page.fill('#auth-password-input', FIXED_PASSWORD).catch(() => null);
  await page.click('#cloud-login-body button[onclick="handleSignIn()"]').catch(() => null);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 15000 }).catch(() => null);
  return page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';

  // ── Set up two jobs as Sales/Owner: one pure-Joinery, one pure-Curtain ──
  currentStep = 'sign-in-sales-setup';
  const salesIn = await signIn(page, fileUrl, SALES_IDENTITY);
  record('Signs in as the real, live Sales E2E account to set up test jobs', salesIn ? 'PASS' : 'FAIL');
  if (!salesIn) { printReport(); await browser.close(); process.exit(1); }
  await page.waitForTimeout(1500);

  currentStep = 'create-joinery-job';
  const stamp = Date.now();
  const joineryJob = await page.evaluate(async (stamp) => {
    const cust = createCustomer({ name: 'Dept Scope Joinery Client ' + stamp, contactPerson: 'Nadia', tel: '39' + String(stamp).slice(-6), address: 'Manama' });
    await new Promise(r => setTimeout(r, 500));
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Nadia', tel: cust.tel, source: 'walk inn', salesPerson: 'E2E Test Account' });
    await new Promise(r => setTimeout(r, 500));
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Dept Scope Joinery Project', taxPercent: 10, contactPerson: 'Nadia' });
    await new Promise(r => setTimeout(r, 500));
    addQuotationItem(qtn.id, { product: 'Wardrobe Cabinet', qty: 1, unit: 'Nos' });
    await new Promise(r => setTimeout(r, 800));
    transferQuotationStage(qtn.id, 'approver', 'Estimator'); approveQuotation(qtn.id, 'Salman Abdullah', 'owner');
    await new Promise(r => setTimeout(r, 800));
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    await new Promise(r => setTimeout(r, 800));
    confirmJobRouting(job.id, {}, 'Operations Manager');
    return { jobId: job.id };
  }, stamp);
  const joineryPersisted = await waitForJobRouted(page, joineryJob.jobId, 'carp');
  record('The Joinery job\'s routing actually landed in the live table before proceeding', joineryPersisted ? 'PASS' : 'FAIL', JSON.stringify({ joineryJob }));

  currentStep = 'create-curtain-job';
  const curtainJob = await page.evaluate(async (stamp) => {
    const cust = createCustomer({ name: 'Dept Scope Curtain Client ' + stamp, contactPerson: 'Ola', tel: '39' + String(stamp + 1).slice(-6), address: 'Manama' });
    await new Promise(r => setTimeout(r, 500));
    const enq = createEnquiry({ division: 'Curtain & Blinds', customerId: cust.id, contactPerson: 'Ola', tel: cust.tel, source: 'walk inn', salesPerson: 'E2E Test Account' });
    await new Promise(r => setTimeout(r, 500));
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Dept Scope Curtain Project', taxPercent: 10, contactPerson: 'Ola' });
    await new Promise(r => setTimeout(r, 500));
    addQuotationItem(qtn.id, { product: 'Living Room Curtains', qty: 2, unit: 'Nos' });
    await new Promise(r => setTimeout(r, 800));
    transferQuotationStage(qtn.id, 'approver', 'Estimator'); approveQuotation(qtn.id, 'Salman Abdullah', 'owner');
    await new Promise(r => setTimeout(r, 800));
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    await new Promise(r => setTimeout(r, 800));
    confirmJobRouting(job.id, {}, 'Operations Manager');
    return { jobId: job.id };
  }, stamp);
  const curtainPersisted = await waitForJobRouted(page, curtainJob.jobId, 'curt');
  record('Two real jobs set up (one Joinery-routed, one Curtain-routed) as Sales, unaffected by department-scoping, and confirmed actually persisted live', joineryJob.jobId && curtainJob.jobId && curtainPersisted ? 'PASS' : 'FAIL', JSON.stringify({ joineryJob, curtainJob }));

  currentStep = 'sign-out-sales';
  await page.evaluate(() => sb.auth.signOut());
  await page.waitForTimeout(500);

  // ── Joinery-typed account: should see the Joinery job, NOT the Curtain job ──
  currentStep = 'sign-in-joinery';
  const joineryIn = await signIn(page, fileUrl, JOINERY_IDENTITY);
  record('Signs in as the real, live, user_type=joinery_production_manager E2E account', joineryIn ? 'PASS' : 'FAIL');
  await page.waitForTimeout(1500);

  currentStep = 'joinery-raw-read';
  const joineryRead = await page.evaluate(async ({ joineryJobId, curtainJobId }) => {
    const joineryRes = await sb.from('job_cards').select('id').eq('id', joineryJobId).maybeSingle();
    const curtainRes = await sb.from('job_cards').select('id').eq('id', curtainJobId).maybeSingle();
    return { canSeeJoineryJob: !!joineryRes.data, joineryError: joineryRes.error ? joineryRes.error.message : null, canSeeCurtainJob: !!curtainRes.data, curtainError: curtainRes.error ? curtainRes.error.message : null };
  }, { joineryJobId: joineryJob.jobId, curtainJobId: curtainJob.jobId });
  record(
    'Joinery-typed account CAN read the Joinery-routed job via raw API',
    joineryRead.canSeeJoineryJob ? 'PASS' : 'FAIL',
    JSON.stringify(joineryRead)
  );
  record(
    'Joinery-typed account CANNOT read the Curtain-only job via raw API (RLS-filtered — 0 rows, not an error)',
    !joineryRead.canSeeCurtainJob && joineryRead.curtainError === null ? 'PASS' : 'FAIL',
    JSON.stringify(joineryRead)
  );
  await shot(page, 'joinery-scoped-read', 1);

  currentStep = 'joinery-raw-write-attempt-on-curtain-job';
  const joineryWriteAttempt = await page.evaluate(async (curtainJobId) => {
    const { error, data } = await sb.from('job_cards').update({ po_no: 'TAMPERED-BY-JOINERY' }).eq('id', curtainJobId).select();
    return { errorMessage: error ? error.message : null, rowsAffected: data ? data.length : null };
  }, curtainJob.jobId);
  record(
    'A raw update attempt on the Curtain-only job by the Joinery-typed account affects ZERO rows (silently filtered by RLS, not a thrown error — standard Postgres RLS update behavior)',
    !joineryWriteAttempt.errorMessage && joineryWriteAttempt.rowsAffected === 0 ? 'PASS' : 'FAIL',
    JSON.stringify(joineryWriteAttempt)
  );

  currentStep = 'joinery-real-function-still-works';
  const joineryQueueCheck = await page.evaluate((joineryJobId) => {
    const rows = getDepartmentQueue('carp');
    return { seesOwnJob: rows.some(r => r.job.id === joineryJobId) };
  }, joineryJob.jobId);
  record('getDepartmentQueue(\'carp\') (the real Joinery dashboard function) still shows the Joinery job normally', joineryQueueCheck.seesOwnJob ? 'PASS' : 'FAIL', JSON.stringify(joineryQueueCheck));

  currentStep = 'sign-out-joinery';
  await page.evaluate(() => sb.auth.signOut());
  await page.waitForTimeout(500);

  // ── Owner-typed account: should see BOTH jobs, unaffected ──
  currentStep = 'sign-in-owner';
  const ownerIn = await signIn(page, fileUrl, OWNER_IDENTITY);
  record('Signs in as the real, live, user_type=owner E2E account', ownerIn ? 'PASS' : 'FAIL');
  await page.waitForTimeout(1500);

  currentStep = 'owner-raw-read-both';
  const ownerRead = await page.evaluate(async ({ joineryJobId, curtainJobId }) => {
    const joineryRes = await sb.from('job_cards').select('id').eq('id', joineryJobId).maybeSingle();
    const curtainRes = await sb.from('job_cards').select('id').eq('id', curtainJobId).maybeSingle();
    return { canSeeJoineryJob: !!joineryRes.data, canSeeCurtainJob: !!curtainRes.data };
  }, { joineryJobId: joineryJob.jobId, curtainJobId: curtainJob.jobId });
  record('Owner (unrestricted) can read BOTH the Joinery and Curtain jobs — role scoping only applies to department-scoped production roles', ownerRead.canSeeJoineryJob && ownerRead.canSeeCurtainJob ? 'PASS' : 'FAIL', JSON.stringify(ownerRead));
  await shot(page, 'owner-unrestricted', 2);

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
