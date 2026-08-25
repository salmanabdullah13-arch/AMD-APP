// Verification for the Curtain cloud sync (6 Aug 2026, Phase 2 FINAL slice) —
// curtainJobs[] + purchaseInquiries[] now persist to Supabase via the
// snapshot-diff autosave in data.js (initCloudCurtainCache /
// scanAndPersistCurtainData) instead of staying in-memory. The hand-seeded
// fixture jobs are gone; everything here is created live through the real
// business flow (quote -> confirm -> bridge) and verified against the real
// curtain_jobs / curtain_purchase_inquiries tables.
//
// EXPECTED TO FAIL with relation-does-not-exist (404) until the latest
// supabase/schema.sql has been run against the live project — that's an
// action-needed signal, not a code defect (same as every prior new table).
//
// LIVE-NETWORK CAVEAT: same realtime-echo/timing flake class documented in
// e2e-cloud-jobcards.js applies — mutations are spaced out and autosave
// waits are generous (the scanner runs every 3s).

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== CLOUD CURTAIN SYNC VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const TEST_IDENTITY = 'E2E Test Account';
const TEST_PASSWORD = 'E2eFixedTestPassword1234!';

async function signIn(page, fileUrl) {
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
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 15000 }).catch(() => null);
  const inApp = await page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
  return inApp ? { ok: true } : { ok: false, reason: 'sign-in did not reach the app' };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';

  currentStep = 'real-login';
  const login = await signIn(page, fileUrl);
  record('Signs in as the dedicated E2E Test Account through the real cloud-login flow', login.ok ? 'PASS' : 'FAIL', login.ok ? '' : JSON.stringify(login));
  if (!login.ok) { printReport(); await browser.close(); process.exit(1); }
  await page.waitForTimeout(3000); // let the parallel caches finish their initial load

  currentStep = 'cache-init';
  const cacheState = await page.evaluate(() => ({
    real: !!window.__realCloudSession,
    curtainInit: typeof cloudJsonCollectionsInitialized !== 'undefined' && cloudJsonCollectionsInitialized
  }));
  record('Real cloud session + initCloudJsonCollections ran', cacheState.real && cacheState.curtainInit ? 'PASS' : 'FAIL', JSON.stringify(cacheState));

  currentStep = 'seed-curtain-job';
  // Real flow with FK-gap pauses (same accepted cross-record race as the
  // other live suites): customer -> enquiry -> quotation -> curtain item ->
  // approve -> confirm. The "Wave Curtain" product keyword-routes to curt,
  // so the bridge creates the curtainJobs entry.
  const seeded = await page.evaluate(async () => {
    const pause = ms => new Promise(r => setTimeout(r, ms));
    salesCurrentUser = 'Salman Abdullah';
    const cust = createCustomer({ name: 'Cloud Curtain Test ' + Date.now(), contactPerson: 'Test', tel: String(Date.now()).slice(-8), address: 'Manama' });
    await pause(1200);
    const enq = createEnquiry({ division: 'Curtain & Blinds', customerId: cust.id, contactPerson: 'Test', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    await pause(1200);
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'Cloud Curtain Sync Test', taxPercent: 10, contactPerson: 'Test' });
    await pause(800);
    addQuotationItem(q.id, { product: 'Wave Curtain with Sheer', qty: 2, unit: 'Nos', rate: 0 });
    await pause(800);
    transferQuotationStage(q.id, 'approver', 'Estimator');
    const appr = approveQuotation(q.id, 'Salman Abdullah', 'owner');
    if (appr && appr.error) return { error: 'approve: ' + appr.error };
    await pause(800);
    const job = confirmQuotationToJobCard(q.id, 'Salman Abdullah');
    if (job.error) return { error: job.error };
    const cj = curtainJobs.find(j => j.id === job.id);
    return { jobId: job.id, bridged: !!cj, hasWindows: !!(cj && Array.isArray(cj.windows)) };
  });
  record('Curtain-routed quote confirms and bridges into curtainJobs[]', seeded.bridged && seeded.hasWindows ? 'PASS' : 'FAIL', JSON.stringify(seeded));
  // Everything below needs that job. Without this the suite crashed on an
  // undefined record fifteen lines later and reported no tally at all, which
  // the sweep then could not grade — the same blind spot _sweep.sh fixed.
  if (!seeded.jobId || !seeded.bridged) { printReport(); await browser.close(); process.exit(1); }

  currentStep = 'autosave-insert';
  await page.waitForTimeout(7000); // > 2 scanner ticks
  const cloudRow = await page.evaluate(async (jobId) => {
    const { data, error } = await sb.from('curtain_jobs').select('*').eq('id', jobId).maybeSingle();
    if (error) return { error: error.message };
    return data ? { found: true, hasWindowGroups: Array.isArray(data.payload.windowGroups), storedWindows: 'windows' in data.payload } : { found: false };
  }, seeded.jobId);
  record('Autosave upserted the bridged job into the live curtain_jobs table', cloudRow.found ? 'PASS' : 'FAIL', JSON.stringify(cloudRow));
  record('Stored payload keeps windowGroups but strips the derived windows[] array', cloudRow.found && cloudRow.hasWindowGroups && !cloudRow.storedWindows ? 'PASS' : 'FAIL', JSON.stringify(cloudRow));

  currentStep = 'autosave-window-edit';
  // Author a window group the way Curtain's own screens mutate the object
  // in place — no persist call anywhere; only the scanner should pick it up.
  await page.evaluate((jobId) => {
    const cj = curtainJobs.find(j => j.id === jobId);
    cj.windowGroups.push({
      id: 'wg1', name: 'Majlis Window 1', width: 320, height: 280,
      layers: [{ id: 'w-cloudtest-1', treatment: 'wave', fabricCode: 'NSJ 5105 / 08', widthM: 3.2, dropM: 2.8, status: 'production' }]
    });
    cj.windows = flattenWindowGroups(cj);
    cj.status = 'in_production';
  }, seeded.jobId);
  await page.waitForTimeout(7000);
  const updated = await page.evaluate(async (jobId) => {
    const { data, error } = await sb.from('curtain_jobs').select('*').eq('id', jobId).maybeSingle();
    if (error || !data) return { error: error && error.message };
    return { groups: (data.payload.windowGroups || []).length, status: data.payload.status };
  }, seeded.jobId);
  record('In-place window authoring persisted by the scanner alone (no persist call)', updated.groups === 1 && updated.status === 'in_production' ? 'PASS' : 'FAIL', JSON.stringify(updated));

  currentStep = 'inquiry-sync';
  const inq = await page.evaluate(async (jobId) => {
    const pi = raiseInquiry({ jobId, windowIds: ['w-cloudtest-1'], vendor: 'Gulf Textiles', vendorRegion: 'Bahrain / Dubai', source: 'vendor', fabricCode: 'NSJ 5105 / 08', quantityOrdered: 9 });
    await new Promise(r => setTimeout(r, 7000));
    const { data, error } = await sb.from('curtain_purchase_inquiries').select('*').eq('id', pi.id).maybeSingle();
    return { id: pi.id, found: !!data, error: error && error.message };
  }, seeded.jobId);
  record('raiseInquiry() lands in the live curtain_purchase_inquiries table via the same scanner', inq.found ? 'PASS' : 'FAIL', JSON.stringify(inq));

  currentStep = 'second-session';
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page2.on('pageerror', err => pageErrors.push({ step: 'second-session', text: err.message }));
  page2.on('dialog', async d => { await d.accept(); });
  const login2 = await signIn(page2, fileUrl);
  record('Second session signs in', login2.ok ? 'PASS' : 'FAIL');
  if (login2.ok) {
    await page2.waitForTimeout(4000);
    const synced = await page2.evaluate((ids) => {
      const cj = curtainJobs.find(j => j.id === ids.jobId);
      if (!cj) return { found: false };
      const desc = Object.getOwnPropertyDescriptor(cj, 'val');
      return {
        found: true,
        windowsHydrated: Array.isArray(cj.windows) && cj.windows.length === 1,
        groups: cj.windowGroups.length,
        valIsGetter: !!(desc && desc.get),
        valMatchesJob: (() => { const j = getJobCard(ids.jobId); return j ? cj.val === j.amount : false; })(),
        inquiry: purchaseInquiries.some(pi => pi.id === ids.piId)
      };
    }, { jobId: seeded.jobId, piId: inq.id });
    record('Second device hydrates the curtain job (windows rebuilt from windowGroups)', synced.found && synced.windowsHydrated && synced.groups === 1 ? 'PASS' : 'FAIL', JSON.stringify(synced));
    record('val re-defined as a live getter onto the real Job Card amount after hydration', synced.valIsGetter && synced.valMatchesJob ? 'PASS' : 'FAIL', JSON.stringify({ valIsGetter: synced.valIsGetter, valMatchesJob: synced.valMatchesJob }));
    record('Second device sees the purchase inquiry', synced.inquiry ? 'PASS' : 'FAIL');
  }

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
