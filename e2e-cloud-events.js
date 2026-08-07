// Live verification that Session 4's planner entries actually reach the
// cloud, now that app_events exists on the project and has been taken out
// of CLOUD_TABLES_PENDING_DEPLOY (data.js).
//
// This is the check that closes the loop: before the table existed, a
// logged meeting lived only in the browser session. It should now survive
// a reload and be visible to another signed-in session.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== CLOUD PLANNER-EVENT SYNC ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
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
  await page.selectOption('#auth-identity-select', TEST_IDENTITY).catch(() => null);
  await page.fill('#auth-password-input', TEST_PASSWORD).catch(() => null);
  await page.click('#cloud-login-body button[onclick="handleSignIn()"]').catch(() => null);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 15000 }).catch(() => null);
  return page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';

  currentStep = 'login';
  const inApp = await signIn(page, fileUrl);
  record('Signs in as the E2E Test Account', inApp ? 'PASS' : 'FAIL');
  if (!inApp) { printReport(); await browser.close(); process.exit(1); }
  await page.waitForTimeout(3500);

  currentStep = 'liveness';
  const live = await page.evaluate(() => {
    const col = CLOUD_JSON_COLLECTIONS.find(c => c.table === 'app_events');
    return { registered: !!col, live: !!(col && col.live), pendingSize: CLOUD_TABLES_PENDING_DEPLOY.size };
  });
  record('app_events is registered, live, and no longer listed as pending deploy',
    live.registered && live.live && live.pendingSize === 0 ? 'PASS' : 'FAIL', JSON.stringify(live));

  currentStep = 'create';
  const created = await page.evaluate(() => {
    const ev = createEvent({
      title: 'E2E planner sync ' + Date.now(),
      date: execTodayISO(), time: '11:15', kind: 'meeting',
      owner: window.cloudIdentity || execIdentity(), withWhom: 'Storekeeper'
    });
    return { id: ev.id, title: ev.title, error: ev.error || null };
  });
  record('Logging an entry through the real createEvent() succeeds',
    created.id && !created.error ? 'PASS' : 'FAIL', JSON.stringify(created));

  // the snapshot-diff autosave scans every 3s
  await page.waitForTimeout(5000);

  currentStep = 'persisted';
  const persisted = await page.evaluate(async (title) => {
    const { data, error } = await sb.from('app_events').select('*');
    if (error) return { error: error.message };
    const row = (data || []).find(r => r.payload && r.payload.title === title);
    return { count: (data || []).length, found: !!row, time: row && row.payload.time, with: row && row.payload.withWhom };
  }, created.title);
  record('The entry actually reached the live app_events table with its own fields intact',
    persisted.found && persisted.time === '11:15' && persisted.with === 'Storekeeper' ? 'PASS' : 'FAIL', JSON.stringify(persisted));

  currentStep = 'second-session';
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page2.on('dialog', async d => { await d.accept(); });
  const inApp2 = await signIn(page2, fileUrl);
  await page2.waitForTimeout(4000);
  const seenElsewhere = await page2.evaluate((title) => ({
    inMemory: events.some(e => e.title === title),
    onCalendar: getCalendarEvents(execIdentity(), 'owner').some(e => e.label.includes('E2E planner sync'))
  }), created.title);
  record('A second signed-in session sees the same entry (the reload/second-device case)',
    seenElsewhere.inMemory && seenElsewhere.onCalendar ? 'PASS' : 'FAIL', JSON.stringify(seenElsewhere));
  await page2.close();

  currentStep = 'cleanup';
  // Removal has to reach the table too, or a deleted entry reappears on the
  // next reload — the scanner used to only ever upsert (fixed 7 Aug 2026).
  const cleaned = await page.evaluate(async (title) => {
    const ev = events.find(e => e.title === title);
    if (!ev) return { error: 'entry missing locally' };
    const id = ev.id;
    deleteEvent(id, ev.owner);
    await new Promise(r => setTimeout(r, 6000));
    const { data } = await sb.from('app_events').select('id');
    return { id, stillThere: (data || []).some(r => String(r.id) === String(id)), remaining: (data || []).length };
  }, created.title);
  record('Removing the entry deletes its row from the live table (not just locally)',
    cleaned.stillThere === false ? 'PASS' : 'FAIL', JSON.stringify(cleaned));

  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
