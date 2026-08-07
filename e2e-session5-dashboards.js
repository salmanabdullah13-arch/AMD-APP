// Session 5 of Salman's backlog — dashboard cleanup.
//
// His complaints, in order: messaging had several entry points competing
// (a per-dashboard strip, a per-dashboard Messages card, the shell's chat
// bubble and its bell); quick actions were buried under each dashboard's
// own content; Estimation showed "Logged in as" twice; Admin's user list
// was a full card per person; and KPI cards were numbers you couldn't
// click through to see what was behind them.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== SESSION 5 — DASHBOARD CLEANUP ===');
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
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => loadDemoData());

  // ── one messaging entry point: no dashboard carries its own strip/inbox ──
  currentStep = 'one-entry-point';
  const strips = await page.evaluate(async () => {
    const checks = [
      ['sales', 'openSalesModule', 'sales-body'],
      ['estimator', 'openEstimatorModule', 'estimator-body'],
      ['approver', 'openApproverModule', 'approver-body'],
      ['accounts', 'openAccountsModule', 'accounts-body'],
      ['joinery', 'launchJoineryModule', 'joinery-body'],
      ['storekeeper', 'launchStorekeeperModule', 'sk-body']
    ];
    const found = [];
    for (const [name, fn, bodyId] of checks) {
      window[fn]();
      await new Promise(r => setTimeout(r, 350));
      const body = document.getElementById(bodyId);
      const html = body ? body.innerHTML : '';
      if (/Notify Storekeeper|Request Purchase|renderInboxWidget/.test(html)) found.push(name + ':strip');
      // the Messages inbox card carried this exact heading
      if (/>Messages</.test(html)) found.push(name + ':inbox');
    }
    return found;
  });
  record('No dashboard carries its own Notify/Request strip or Messages card any more',
    strips.length === 0 ? 'PASS' : 'FAIL', strips.join(', '));

  const chat = await page.evaluate(() => {
    const el = document.getElementById('exec-chat-float');
    return { exists: !!el, visible: el && getComputedStyle(el).display !== 'none' };
  });
  record('The floating chat bubble is the single messaging entry point and is present',
    chat.exists && chat.visible ? 'PASS' : 'FAIL', JSON.stringify(chat));

  // ── quick actions sit at the top of every sidebar ──
  currentStep = 'quick-actions-top';
  const qa = await page.evaluate(async () => {
    openSalesModule();
    await new Promise(r => setTimeout(r, 400));
    const labels = [...document.querySelectorAll('#sales-module-wrap .xs-navlabel')].map(e => e.textContent.trim());
    // Adopted shells all stay in the DOM, so nav ids repeat — scope every
    // lookup to the wrap under test, never getElementById.
    const salesWrap = document.getElementById('sales-module-wrap');
    const items = ['xsnav-xs-planner', 'xsnav-xs-tasks', 'xsnav-xs-cal', 'xsnav-xs-notify', 'xsnav-xs-buy']
      .map(id => !!salesWrap.querySelector('#' + id));
    launchStorekeeperModule();
    await new Promise(r => setTimeout(r, 400));
    // Storekeeper is the recipient — no shortcut aimed at itself
    const skWrap = document.getElementById('sk-module-wrap');
    const skNotify = !!skWrap.querySelector('#xsnav-xs-notify');
    const skBuy = !!skWrap.querySelector('#xsnav-xs-buy');
    return { firstLabel: labels[0], items, skNotify, skBuy };
  });
  record('Quick actions are the FIRST sidebar group and carry all five shortcuts',
    qa.firstLabel === 'Quick actions' && qa.items.every(Boolean) ? 'PASS' : 'FAIL', JSON.stringify(qa));
  record('Storekeeper gets Request Purchase but not a Notify-Storekeeper shortcut aimed at itself',
    qa.skBuy && !qa.skNotify ? 'PASS' : 'FAIL', JSON.stringify(qa));

  // ── Request Purchase must not ask a single-dashboard role to sign out ──
  currentStep = 'hop-no-signout';
  const hop = await page.evaluate(async () => {
    window.__dashboardHome = null;             // what a single-dashboard role has
    let signOutAsked = false;
    const realConfirm = window.confirm;
    window.confirm = (m) => { if (/sign out/i.test(m)) signOutAsked = true; return false; };
    openEstimatorModule();
    await new Promise(r => setTimeout(r, 350));
    execRequestPurchase();
    await new Promise(r => setTimeout(r, 500));
    const landed = getComputedStyle(document.getElementById('purch-module-wrap')).display !== 'none';
    window.confirm = realConfirm;
    window.__dashboardHome = undefined;
    return { signOutAsked, landed };
  });
  record('Request Purchase hops to Purchasing without asking a single-dashboard role to sign out',
    !hop.signOutAsked && hop.landed ? 'PASS' : 'FAIL', JSON.stringify(hop));

  // ── Estimation no longer says "Logged in as" twice ──
  currentStep = 'no-duplicate-identity';
  const dupes = await page.evaluate(async () => {
    openEstimatorModule();
    await new Promise(r => setTimeout(r, 400));
    const wrap = document.getElementById('estimator-module-wrap');
    const count = (wrap.textContent.match(/Logged in as/g) || []).length;
    // the role switcher itself must survive — it's functional, not decoration
    const switcher = !!document.getElementById('estimator-user-select');
    return { count, switcher };
  });
  record('Estimation shows the identity once, and keeps its role switcher',
    dupes.count <= 1 && dupes.switcher ? 'PASS' : 'FAIL', JSON.stringify(dupes));

  // ── every KPI tile leads somewhere ──
  currentStep = 'kpis-clickable';
  const tiles = await page.evaluate(async () => {
    const out = {};
    for (const [name, fn, wrapId] of [['sales', 'openSalesModule', 'sales-module-wrap'],
                                      ['estimator', 'openEstimatorModule', 'estimator-module-wrap'],
                                      ['approver', 'openApproverModule', 'approver-module-wrap'],
                                      ['accounts', 'openAccountsModule', 'accounts-module-wrap']]) {
      window[fn]();
      await new Promise(r => setTimeout(r, 350));
      const body = document.querySelector('#' + wrapId + ' [id$="-body"]') || document.getElementById(wrapId);
      const all = [...body.querySelectorAll('.sales-kpi-tile')];
      out[name] = { total: all.length, dead: all.filter(t => !t.getAttribute('onclick')).length };
    }
    return out;
  });
  const dead = Object.entries(tiles).filter(([, v]) => v.dead > 0);
  record('Every dashboard KPI tile is clickable (no dead numbers)',
    dead.length === 0 ? 'PASS' : 'FAIL', JSON.stringify(tiles));

  // ── and a tile actually lands on the rows it counted ──
  currentStep = 'kpi-lands-filtered';
  const landing = await page.evaluate(async () => {
    openSalesModule();
    await new Promise(r => setTimeout(r, 350));
    salesShowQuotations('all', 'estimator');
    await new Promise(r => setTimeout(r, 350));
    const expected = quotations.filter(q => q.stage === 'estimator').length;
    const shown = document.querySelectorAll('#sales-body .sales-qtn-row, #sales-body .sales-card').length;
    return { view: salesTopView, stage: salesQtnFilters.stage, expected, shown };
  });
  record('A "With Estimator" tile lands on the quotation list filtered to that stage',
    landing.view === 'quotations' && landing.stage === 'estimator' ? 'PASS' : 'FAIL', JSON.stringify(landing));

  // ── Admin's roster is a compact list that expands one row at a time ──
  currentStep = 'admin-compact';
  const admin = await page.evaluate(async () => {
    launchAdminModule();
    await new Promise(r => setTimeout(r, 400));
    adminSetView('users');
    await new Promise(r => setTimeout(r, 250));
    // no cloud session offline, so drive the renderer with a stub roster
    window.__realCloudSession = true;
    adminUserRoster = [
      { id: 'u1', display_name: 'Person One', designation: 'Estimator', user_type: 'estimator', approval_status: 'approved' },
      { id: 'u2', display_name: 'Person Two', designation: 'Sales', user_type: 'sales', approval_status: 'deactivated' }
    ];
    adminUserTypesList = [{ key: 'estimator', label: 'Estimator' }, { key: 'sales', label: 'Sales' }];
    adminUserExpandedId = null;
    renderAdminUsersInto();
    const collapsed = document.querySelectorAll('#admin-users-body select').length;
    adminToggleUserRow('u1');
    const oneOpen = document.querySelectorAll('#admin-users-body select').length;
    adminToggleUserRow('u2');
    const stillOne = document.querySelectorAll('#admin-users-body select').length;
    const namesVisible = document.getElementById('admin-users-body').textContent.includes('Person Two');
    window.__realCloudSession = false;
    return { collapsed, oneOpen, stillOne, namesVisible };
  });
  record('Admin roster lists everyone compactly and opens one row of controls at a time',
    admin.collapsed === 0 && admin.oneOpen === 1 && admin.stillOne === 1 && admin.namesVisible ? 'PASS' : 'FAIL', JSON.stringify(admin));

  const critical = consoleErrors.filter(e => !e.text.includes('favicon'));
  record('No unexpected console errors', critical.length === 0 ? 'PASS' : 'FAIL', critical.map(e => e.text).join(' | '));
  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
