// Material Requests — the tracked replacement for "Notify Storekeeper".
//
// Salman, asked what actually happens today when someone needs material
// that's already in stock: "It's been asked by worker walking straight to
// storekeeper and also requested by departments." Neither leaves a record.
// Purchase Requests cover material we DON'T have; Material Issue records
// the hand-over but is raised from the Job Card by someone else. This is
// the missing middle, and these checks are about it staying honest:
// a job is always attached, declining always says why, and fulfilling
// hands over to the real stock-moving flow rather than moving stock itself.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== MATERIAL REQUESTS ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text().slice(0, 150) }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message.slice(0, 150) }));
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => loadDemoData());

  // ── the rules that keep it traceable ──
  currentStep = 'data-layer';
  const rules = await page.evaluate(() => {
    const job = jobCards.find(j => j.status !== 'cancelled');
    return {
      jobId: job.id,
      noJob: createMaterialRequest({ itemName: 'Ply', qty: 2, requestedBy: 'Joinery Production Manager' }).error,
      noItem: createMaterialRequest({ jobId: job.id, itemName: '  ', qty: 2, requestedBy: 'Joinery Production Manager' }).error,
      noQty: createMaterialRequest({ jobId: job.id, itemName: 'Ply', qty: 0, requestedBy: 'Joinery Production Manager' }).error,
      noWho: createMaterialRequest({ jobId: job.id, itemName: 'Ply', qty: 2 }).error
    };
  });
  record('A request without a job, material, quantity or asker is refused',
    rules.noJob && rules.noItem && rules.noQty && rules.noWho ? 'PASS' : 'FAIL', JSON.stringify(rules));

  currentStep = 'create';
  const made = await page.evaluate((jobId) => {
    const item = itemMaster[0];
    const req = createMaterialRequest({
      jobId, itemId: item.id, itemName: item.name, qty: 3, unit: item.unit || 'Nos',
      neededBy: '2026-08-20', note: 'For the carcass', requestedBy: 'Joinery Production Manager', department: 'carp'
    });
    return {
      id: req.id, status: req.status, itemId: req.itemId,
      inOpenQueue: getOpenMaterialRequests().some(r => r.id === req.id),
      onJob: getMaterialRequestsForJob(jobId).some(r => r.id === req.id),
      byMe: getMaterialRequestsBy('Joinery Production Manager').some(r => r.id === req.id),
      storekeeperTold: getInboxFor('Storekeeper').some(m => m.body.includes(req.id)),
      logged: activityLog.some(a => a.type === 'material-requested' && a.linkedId === jobId)
    };
  }, rules.jobId);
  record('A real request lands in the Storekeeper queue, on the job, and in the asker\'s own list',
    /^MRQ-/.test(made.id) && made.status === 'open' && made.inOpenQueue && made.onJob && made.byMe ? 'PASS' : 'FAIL', JSON.stringify(made));
  record('The Storekeeper is pinged and the ask is recorded in the activity log',
    made.storekeeperTold && made.logged ? 'PASS' : 'FAIL', JSON.stringify(made));

  // ── declining has to say why ──
  currentStep = 'decline';
  const declined = await page.evaluate((jobId) => {
    const req = createMaterialRequest({ jobId, itemName: 'Something we do not stock', qty: 1, requestedBy: 'Upholstery Manager' });
    const noReason = closeMaterialRequest(req.id, 'declined', 'Storekeeper', '   ');
    const ok = closeMaterialRequest(req.id, 'declined', 'Storekeeper', 'Out of stock — raise a purchase request');
    const again = closeMaterialRequest(req.id, 'declined', 'Storekeeper', 'again');
    return {
      refusedWithoutReason: !!(noReason && noReason.error),
      closed: ok.status, note: ok.closeNote,
      refusedTwice: !!(again && again.error),
      askerTold: getInboxFor('Upholstery Manager').some(m => m.body.includes(req.id)),
      goneFromQueue: !getOpenMaterialRequests().some(r => r.id === req.id)
    };
  }, rules.jobId);
  record('Declining without a reason is refused, and a closed request can\'t be closed twice',
    declined.refusedWithoutReason && declined.refusedTwice ? 'PASS' : 'FAIL', JSON.stringify(declined));
  record('A declined request tells the asker why and leaves the queue',
    declined.closed === 'declined' && declined.askerTold && declined.goneFromQueue ? 'PASS' : 'FAIL', JSON.stringify(declined));

  // ── the Storekeeper's queue, through the real UI ──
  currentStep = 'storekeeper-queue';
  await page.evaluate(() => { launchStorekeeperModule(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => skGoTo('requests'));
  await page.waitForTimeout(300);
  const queueUI = await page.evaluate(() => {
    const body = document.getElementById('sk-requests-body');
    return {
      showsItem: body.textContent.includes(itemMaster[0].name),
      showsAsker: body.textContent.includes('Joinery Production Manager'),
      hasIssueButton: !!body.querySelector('button[onclick^="skFulfilRequest"]'),
      showsClosed: body.textContent.includes('Recently closed')
    };
  });
  record('The Storekeeper queue shows the open request with who asked and an Issue action',
    queueUI.showsItem && queueUI.showsAsker && queueUI.hasIssueButton && queueUI.showsClosed ? 'PASS' : 'FAIL', JSON.stringify(queueUI));

  // fulfilling must hand over to the existing Material Issue flow, not move stock here
  currentStep = 'fulfil';
  await page.click('#sk-requests-body button[onclick^="skFulfilRequest"]');
  await page.waitForTimeout(400);
  const fulfilled = await page.evaluate(() => ({
    status: materialRequests.find(r => r.id.startsWith('MRQ-')).status,
    queueEmpty: getOpenMaterialRequests().length === 0,
    // openMaterialsMove() is the app's real stock-issuing screen
    onIssueScreen: jobsView === 'issue',
    // no stock moved by the request itself
    noPhantomMove: !jobCards.some(j => (j.materialsIssues || []).some(mi => mi.viaRequest))
  }));
  record('Issuing marks the request fulfilled and hands over to the real Material Issue screen',
    fulfilled.status === 'fulfilled' && fulfilled.queueEmpty && fulfilled.onIssueScreen && fulfilled.noPhantomMove ? 'PASS' : 'FAIL', JSON.stringify(fulfilled));

  // ── the quick action is scoped to roles that actually need it ──
  currentStep = 'quick-action-scope';
  const scope = await page.evaluate(async () => {
    // Now in the Quick actions popover above the page title, not the
    // sidebar (Owner-redesign handoff, 7 Aug 2026).
    const check = async (fn, wrapId) => {
      window[fn]();
      await new Promise(r => setTimeout(r, 400));
      execToggleQuick(true);
      await new Promise(r => setTimeout(r, 150));
      const found = [...document.querySelectorAll('#' + wrapId + ' .xs-qa-pop .xs-qa-item')]
        .some(b => b.textContent.indexOf('Request Material') !== -1);
      execToggleQuick(false);
      return found;
    };
    return {
      joinery: await check('launchJoineryModule', 'joinery-module-wrap'),
      curtain: await check('launchCurtainModule', 'curt-module-wrap'),
      sales: await check('openSalesModule', 'sales-module-wrap'),
      hr: await check('launchHRModule', 'hr-module-wrap'),
      storekeeper: await check('launchStorekeeperModule', 'sk-module-wrap')
    };
  });
  record('Request Material appears for production roles and not for Sales, HR or the Storekeeper themselves',
    scope.joinery && scope.curtain && !scope.sales && !scope.hr && !scope.storekeeper ? 'PASS' : 'FAIL', JSON.stringify(scope));

  // ── the form itself ──
  currentStep = 'form';
  const form = await page.evaluate(async () => {
    launchJoineryModule();
    await new Promise(r => setTimeout(r, 400));
    execOpenMaterialRequest();
    await new Promise(r => setTimeout(r, 200));
    const open = getComputedStyle(document.getElementById('comms-modal-wrap')).display !== 'none';
    mrqSearch(itemMaster[0].name.slice(0, 6));
    await new Promise(r => setTimeout(r, 150));
    const suggested = !!document.querySelector('#comms-modal-inner [onclick^="mrqPickItem"]');
    document.querySelector('#comms-modal-inner [onclick^="mrqPickItem"]').click();
    await new Promise(r => setTimeout(r, 150));
    const matched = mrqDraft.itemId === itemMaster[0].id && mrqDraft.unit === (itemMaster[0].unit || '');
    // submitting with no job must be refused, not silently dropped
    mrqSet('qty', 2);
    const before = materialRequests.length;
    mrqSubmit();
    const refusedNoJob = materialRequests.length === before;
    mrqSet('jobId', jobCards.find(j => j.status !== 'cancelled').id);
    mrqSubmit();
    return { open, suggested, matched, refusedNoJob, created: materialRequests.length === before + 1, closed: getComputedStyle(document.getElementById('comms-modal-wrap')).display === 'none' };
  });
  record('The form suggests real stock items, auto-fills the unit, refuses without a job, then saves',
    form.open && form.suggested && form.matched && form.refusedNoJob && form.created && form.closed ? 'PASS' : 'FAIL', JSON.stringify(form));

  const critical = consoleErrors.filter(e => !e.text.includes('favicon'));
  record('No unexpected console errors', critical.length === 0 ? 'PASS' : 'FAIL', critical.map(e => e.text).join(' | '));
  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
