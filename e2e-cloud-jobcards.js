// Verification for cloud-backed job cards (4 Aug 2026, Phase 2 slice 3) —
// same local-cache + optimistic-write pattern as customers/enquiries/
// quotations, extended to jobCards[]. Scoped to jobCards[] only —
// curtainJobs[]/projects[] deliberately stay local-only (see the design
// note in supabase/schema.sql). Goes through the REAL cloud-login flow
// as the dedicated 'E2E Test Account', same as the other cloud tests.
//
// Minimal path to a confirmed Job Card mirrors e2e-batch8-routing.js's
// own offline sequence: createCustomer -> createEnquiry ->
// convertEnquiryToQuotation -> addQuotationItem -> approveQuotation
// (no gating checks — it unconditionally flips stage/lifecycleStatus) ->
// confirmQuotationToJobCard.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-cloud-jobcards');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== CLOUD JOB CARDS VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const TEST_IDENTITY = 'E2E Test Account';
const TEST_PASSWORD = 'E2eFixedTestPassword1234!';

async function signInOrUp(page, fileUrl) {
  await page.goto(fileUrl);
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
  record('Signs in/up as the dedicated E2E Test Account through the real cloud-login flow', login.ok ? 'PASS' : 'FAIL', login.ok ? `via ${login.via}` : JSON.stringify(login));
  if (!login.ok) { printReport(); await browser.close(); process.exit(1); }
  await page.waitForTimeout(1500); // customers/enquiries/quotations/job-cards cache init round trips

  currentStep = 'confirm-job-card-live';
  const stamp = Date.now();
  // Minimal path to a confirmed Job Card — same sequence as
  // e2e-batch8-routing.js's own offline test. job_cards.customer_id and
  // .quotation_id are both real foreign keys, so — same narrow, accepted
  // cross-record race documented in e2e-cloud-enquiries-quotations.js —
  // each step here gets a realistic gap before the next one references it
  // by id, rather than firing the whole chain in one synchronous instant.
  const custResult = await page.evaluate((stamp) => createCustomer({ name: `E2E Job Customer ${stamp}`, contactPerson: 'Tester', tel: '3901' + String(stamp).slice(-6), address: 'Manama' }), stamp);
  await page.waitForTimeout(1000);
  const enqResult = await page.evaluate((custId) => createEnquiry({ division: 'Joinery', customerId: custId, contactPerson: 'Tester', tel: '3901000000', source: 'walk inn', salesPerson: 'E2E Test Account' }), custResult.id);
  await page.waitForTimeout(1000);
  const qtnResult = await page.evaluate((enqId) => {
    const qtn = convertEnquiryToQuotation(enqId, { projectName: 'E2E Job Card Project', taxPercent: 10, contactPerson: 'Tester' });
    addQuotationItem(qtn.id, { product: 'E2E Test Joinery Cabinet', qty: 1, unit: 'Nos' });
    approveQuotation(qtn.id, 'E2E Test Account');
    return qtn.id;
  }, enqResult.id);
  await page.waitForTimeout(1000);
  const jobResult = await page.evaluate((qtnId) => ({ qtnId, job: confirmQuotationToJobCard(qtnId, 'E2E Test Account') }), qtnResult);
  record('confirmQuotationToJobCard() returns synchronously with a real Job Card', !jobResult.job.error && !!jobResult.job.id ? 'PASS' : 'FAIL', JSON.stringify(jobResult.job));

  currentStep = 'job-card-persisted-live';
  await page.waitForTimeout(1500);
  const jobPersisted = await page.evaluate(async (id) => {
    const { data, error } = await sb.from('job_cards').select('*').eq('id', id).maybeSingle();
    return { found: !!data, amount: data ? data.amount : null, itemsCount: data ? data.items.length : null, error: error ? error.message : null };
  }, jobResult.job.id);
  record('The new Job Card actually landed in the live Supabase job_cards table', jobPersisted.found && jobPersisted.itemsCount === 1 ? 'PASS' : 'FAIL', JSON.stringify(jobPersisted));

  currentStep = 'routing-budget-live';
  const routingResult = await page.evaluate((id) => confirmJobRouting(id, {}, 'Operations Manager'), jobResult.job.id);
  await page.waitForTimeout(1500);
  const routingPersisted = await page.evaluate(async (id) => {
    const { data } = await sb.from('job_cards').select('routing_confirmed, department_budgets, items').eq('id', id).maybeSingle();
    return data;
  }, jobResult.job.id);
  record(
    'confirmJobRouting() persists routing_confirmed + the nested department_budgets jsonb live',
    !routingResult.error && routingPersisted && routingPersisted.routing_confirmed === true && Object.keys(routingPersisted.department_budgets || {}).length > 0 ? 'PASS' : 'FAIL',
    JSON.stringify({ routingResult: routingResult.error || 'ok', routingPersisted })
  );

  currentStep = 'delivery-note-live';
  const lineId = jobResult.job.items[0].lineId;
  const deliveryResult = await page.evaluate((args) => addDeliveryNote(args.id, [{ lineId: args.lineId, requiredQty: 1 }]), { id: jobResult.job.id, lineId });
  await page.waitForTimeout(1500);
  const deliveryPersisted = await page.evaluate(async (id) => {
    const { data } = await sb.from('job_cards').select('delivery_notes, items').eq('id', id).maybeSingle();
    return data;
  }, jobResult.job.id);
  record(
    'addDeliveryNote() persists the jsonb delivery_notes array AND the line\'s deliveredQty live',
    !deliveryResult.error && deliveryPersisted && deliveryPersisted.delivery_notes.length === 1 && deliveryPersisted.items[0].deliveredQty === 1 ? 'PASS' : 'FAIL',
    JSON.stringify({ deliveryResult: deliveryResult.error || 'ok', deliveryPersisted })
  );

  currentStep = 'realtime-sync-second-session';
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page2.on('pageerror', err => pageErrors.push({ step: 'realtime-sync-second-session', text: err.message }));
  const login2 = await signInOrUp(page2, fileUrl);
  if (login2.ok) {
    await page2.waitForTimeout(1500);
    const seenOnSecondDevice = await page2.evaluate((id) => {
      const job = jobCards.find(j => j.id === id);
      const proj = projects.find(p => p.id === id);
      return { seenJob: !!job, jobRouted: job ? job.routingConfirmed : null, seenBridgedProject: !!proj, projVal: proj ? proj.val : null };
    }, jobResult.job.id);
    record(
      'A Job Card created on one session appears in a second session\'s cache, INCLUDING the re-bridged projects[] entry (cache-hydration bridge)',
      seenOnSecondDevice.seenJob && seenOnSecondDevice.jobRouted && seenOnSecondDevice.seenBridgedProject ? 'PASS' : 'FAIL',
      JSON.stringify(seenOnSecondDevice)
    );
  } else {
    record('Second session for realtime-sync check could sign in', 'FAIL', JSON.stringify(login2));
  }
  await shot(page2, 'second-session', 1);
  await page2.close();

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
