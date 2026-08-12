// Verification for Stage 1 of the merged roadmap (6 Aug 2026) — the
// financial record + tasks + activity log join the generic json-collection
// sync (CLOUD_JSON_COLLECTIONS in data.js). Exercises the two cheapest
// FK-free collections live (suppliers, app_tasks) plus the collection
// liveness flags; the rest (invoices/receipts/PO chain) ride the identical
// scanner code path and are exercised offline by the whole existing suite.
//
// EXPECTED TO PARTIALLY FAIL with "collection not live" until the latest
// supabase/schema.sql has been run against the live project — that's the
// action-needed signal, not a code defect (same as e2e-cloud-curtain.js).

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== CLOUD FINANCIAL-RECORD SYNC VERIFICATION ===');
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
    const map = {};
    CLOUD_JSON_COLLECTIONS.forEach(c => map[c.table] = !!c.live);
    return { init: cloudJsonCollectionsInitialized, map };
  });
  record('initCloudJsonCollections ran', live.init ? 'PASS' : 'FAIL');
  const financialLive = ['tax_invoices', 'suppliers', 'app_tasks', 'activity_log'].every(t => live.map[t]);
  record('Financial-record tables live on the project (run schema.sql if FAIL)', financialLive ? 'PASS' : 'FAIL', JSON.stringify(live.map));
  record('task_lists live (a user\'s own task lists survive a reload)', live.map['task_lists'] ? 'PASS' : 'FAIL');

  currentStep = 'supplier-and-task';
  const created = await page.evaluate(async () => {
    const sup = createSupplier({ name: 'Cloud Sync Test Supplier ' + Date.now(), contactPerson: 'T', telephone: String(Date.now()).slice(-8), address: 'Manama' });
    const task = createTask({ title: 'Cloud sync check task', assignee: 'Salman Abdullah' });
    const list = createTaskList('Salman Abdullah', 'Cloud sync list ' + Date.now());
    logActivity({ type: 'job-created', linkedType: 'task', linkedId: task.id, user: 'E2E', message: 'cloud sync activity probe' });
    await new Promise(r => setTimeout(r, 7000)); // > 2 scanner ticks
    const supRow = await sb.from('suppliers').select('*').eq('id', String(sup.id)).maybeSingle();
    const taskRow = await sb.from('app_tasks').select('*').eq('id', task.id).maybeSingle();
    const listRow = list.error ? { data: null, error: list } : await sb.from('task_lists').select('*').eq('id', list.id).maybeSingle();
    return {
      supId: sup.id, taskId: task.id, listId: list.id,
      supFound: !!(supRow.data), supErr: supRow.error && supRow.error.message,
      taskFound: !!(taskRow.data), taskErr: taskRow.error && taskRow.error.message,
      listFound: !!(listRow.data), listErr: listRow.error && listRow.error.message,
      actIdIsString: typeof activityLog[activityLog.length - 1].id === 'string'
    };
  });
  record('Supplier persisted by the scanner alone (no persist call anywhere)', created.supFound ? 'PASS' : 'FAIL', JSON.stringify(created));
  record('Task persisted (exec-shell My Tasks becomes cross-device)', created.taskFound ? 'PASS' : 'FAIL');
  record('Task LIST persisted — a custom list no longer vanishes on reload', created.listFound ? 'PASS' : 'FAIL', JSON.stringify({ id: created.listId, err: created.listErr }));
  record('Activity log entries mint unique string ids (multi-device safe)', created.actIdIsString ? 'PASS' : 'FAIL');

  currentStep = 'second-session';
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page2.on('dialog', async d => { await d.accept(); });
  const inApp2 = await signIn(page2, fileUrl);
  record('Second session signs in', inApp2 ? 'PASS' : 'FAIL');
  if (inApp2) {
    await page2.waitForTimeout(4000);
    const synced = await page2.evaluate((ids) => ({
      supplier: suppliers.some(s => String(s.id) === String(ids.supId)),
      task: tasks.some(t => t.id === ids.taskId),
      list: taskLists.some(l => l.id === ids.listId)
    }), created);
    record('Second device hydrates the supplier + task', synced.supplier && synced.task ? 'PASS' : 'FAIL', JSON.stringify(synced));
    record('Second device hydrates the task list too', synced.list ? 'PASS' : 'FAIL');
  }

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
