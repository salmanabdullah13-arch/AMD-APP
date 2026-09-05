/**
 * e2e-cloud-bridge-race.js — LIVE. Finding F6 of the end-to-end run.
 *
 * Two sessions open at once: Sales confirms a curtain job, and the curtain
 * manager — already signed in — authors windows on it the moment it
 * arrives. Before the fix, the curtain manager's session built its own
 * fresh copy from the realtime job-card INSERT, both scanners upserted the
 * same row, and the edit was lost in two of three runs. This drives the
 * exact race and reads the live row back.
 *
 *   SUPABASE_PAT is NOT needed — the checks read through a third session.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const PASSWORD = 'E2eFixedTestPassword1234!';
const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';
let pass = 0, fail = 0; const errors = [];
function check(name, ok, detail) { if (ok) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); } }
async function login(browser, name, role) {
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(role + ': ' + e.message));
  await p.goto(fileUrl); await p.waitForFunction(() => { const s = document.getElementById('auth-identity-select'); return s && s.options.length > 1; }, { timeout: 20000 });
  await p.selectOption('#auth-identity-select', name); await p.fill('#auth-password-input', PASSWORD); await p.click('#cloud-login-body button[onclick="handleSignIn()"]');
  await p.waitForFunction((r) => window.__realCloudSession === true && window.cloudUserType === r, role, { timeout: 25000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => { if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; });
  return p;
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const curt = await login(browser, 'E2E Curtain Account', 'curtain_manager');
  const sales = await login(browser, 'E2E Test Account', 'sales');
  const owner = await login(browser, 'E2E Approver Account', 'owner');
  const stamp = Date.now();

  // Sales: the front half, in the sales session, with the gaps a person takes.
  const job = await sales.evaluate(async (stamp) => {
    const gap = (ms) => new Promise(r => setTimeout(r, ms));
    const c = createCustomer({ name: 'RUN1 F6 ' + stamp, contactPerson: 'A', tel: '38' + String(stamp).slice(-6), address: 'Juffair' }); await gap(1500);
    const e = createEnquiry({ division: 'Curtain & Blinds', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'E2E Test Account' }); await gap(1500);
    const q = convertEnquiryToQuotation(e.id, { projectName: 'F6 race ' + stamp, taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Wave curtains — race', qty: 1, unit: 'Nos' });
    const it = quotations.find(x => x.id === q.id).items[0];
    addBOMMaterial(q.id, it.lineId, { name: itemMaster[0].name, qty: 2, rate: 20, unit: itemMaster[0].unit }); submitItemBOM(q.id, it.lineId, 'E2E Test Account');
    setItemDepartmentSequence(q.id, it.lineId, ['curt']);
    transferQuotationStage(q.id, 'approver', 'Estimator'); approveQuotation(q.id, 'E2E Test Account', 'owner'); await gap(2000);
    const j = confirmQuotationToJobCard(q.id, 'E2E Test Account');
    return { id: j.id, customer: c.id };
  }, stamp);
  check('Sales confirmed a curtain job', !!job.id, job);

  // Curtain manager: author windows the instant the job arrives.
  const authored = await curt.evaluate(async (jid) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 20000 && !curtainJobs.some(c => c.id === jid)) await new Promise(r => setTimeout(r, 100));
    const cj = curtainJobs.find(c => c.id === jid);
    if (!cj) return { arrived: false };
    const copies = curtainJobs.filter(c => c.id === jid).length;
    cj.windowGroups = [{ id: 'f6g1', room: 'Race room', width: 300, height: 260, qty: 1, layers: [{ id: 'f6w1', role: 'main', label: 'Race', treatment: 'curtain', fabricType: 'main', designType: 'Wave', fullness: 2.5, rollWidth: 140, calcDone: true, calc: null }] }];
    cj.windows = flattenWindowGroups(cj); cj.status = 'execution';
    return { arrived: true, waitedMs: Date.now() - t0, copies };
  }, job.id);
  check('the job reached the curtain manager\'s session through realtime, as ONE copy', authored.arrived && authored.copies === 1, authored);

  await curt.waitForTimeout(9000);
  const local = await curt.evaluate((jid) => { const cj = curtainJobs.find(c => c.id === jid); return { groups: cj ? cj.windowGroups.length : -1, status: cj && cj.status, copies: curtainJobs.filter(c => c.id === jid).length }; }, job.id);
  check('nine seconds on, the curtain manager\'s own session still holds the windows', local.groups === 1 && local.status === 'execution' && local.copies === 1, local);
  const remote = await owner.evaluate((jid) => { const cj = curtainJobs.find(c => c.id === jid); return { groups: cj ? cj.windowGroups.length : -1, status: cj && cj.status }; }, job.id);
  check('… and the Owner\'s session received them through realtime', remote.groups === 1 && remote.status === 'execution', remote);
  const fresh = await login(browser, 'E2E Estimator Account', 'estimator');
  const hydrated = await fresh.evaluate((jid) => { const cj = curtainJobs.find(c => c.id === jid); return { groups: cj ? cj.windowGroups.length : -1, status: cj && cj.status }; }, job.id);
  check('… and a session logging in afterwards hydrates the windows from the table', hydrated.groups === 1 && hydrated.status === 'execution', hydrated);

  // The login re-upsert: a fresh session must not rewrite rows it did not touch.
  const before = await owner.evaluate((jid) => JSON.stringify(curtainJobs.find(c => c.id === jid).windowGroups), job.id);
  await curt.evaluate((jid) => { const cj = curtainJobs.find(c => c.id === jid); cj.windowGroups[0].room = 'Race room, renamed'; }, job.id);
  const late = await login(browser, 'E2E Operations Account', 'operations_manager');
  await curt.waitForTimeout(8000);
  const after = await owner.evaluate((jid) => curtainJobs.find(c => c.id === jid).windowGroups[0].room, job.id);
  check('an edit made while another session logs in survives that login', after === 'Race room, renamed', { before: before.slice(0, 60), after });

  // Tidy: the job and its chain, through the sales session (cancel keeps the row; leave it for the manifest purge).
  await sales.evaluate((jid) => { try { setJobStatus(jid, 'cancelled', 'E2E Test Account'); } catch (e) {} }, job.id);
  check('zero page errors across the sessions', errors.length === 0, errors.slice(0, 3));
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
