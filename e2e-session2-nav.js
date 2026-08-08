// Session 2 of Salman's backlog — navigation architecture.
// Salman: "no back button anywhere to go back to previous pages", and the
// sidebar silently changing context after a hop into a Job Card. Decision
// (his): implement BOTH a universal back control and a breadcrumb trail.
// Two layers, both covered here:
//   • within a module — EXEC_MODULE_NAV knows each module's home view, so
//     back works on any drill-down without touching module code;
//   • across modules — hops push a return ticket onto execNavStack.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== SESSION 2 — NAVIGATION ===');
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

  // ── a module's home view shows no back control and no breadcrumb ──
  currentStep = 'home-clean';
  await page.evaluate(() => launchJobsModule());
  await page.waitForTimeout(500);
  const home = await page.evaluate(() => ({
    back: document.querySelector('#jobs-module-wrap .xs-back').classList.contains('on'),
    crumbs: document.querySelector('#jobs-module-wrap .xs-crumbs').classList.contains('on')
  }));
  record('A module home view shows no back control and no breadcrumb (nothing to go back to)',
    !home.back && !home.crumbs ? 'PASS' : 'FAIL', JSON.stringify(home));

  // ── drill-down inside a module: back appears + record breadcrumb ──
  currentStep = 'drilldown';
  const drilled = await page.evaluate(async () => {
    const id = jobCards[0].id;
    openJobHub(id);
    await new Promise(r => setTimeout(r, 450));
    return {
      id, view: jobsView,
      back: document.querySelector('#jobs-module-wrap .xs-back').classList.contains('on'),
      crumb: document.querySelector('#jobs-module-wrap .xs-crumbs').innerText.replace(/\n/g, ' ').trim()
    };
  });
  record('Drilling into a Job Card shows the back control and a "Job Cards › <Job No>" trail',
    drilled.back && drilled.crumb.includes('Job Cards') && drilled.crumb.includes(drilled.id) ? 'PASS' : 'FAIL', JSON.stringify(drilled));

  await page.click('#jobs-module-wrap .xs-back');
  await page.waitForTimeout(450);
  const backed = await page.evaluate(() => ({
    view: jobsView, back: document.querySelector('#jobs-module-wrap .xs-back').classList.contains('on')
  }));
  record('Back returns to the module home view and the control hides again',
    backed.view === 'list' && !backed.back ? 'PASS' : 'FAIL', JSON.stringify(backed));

  // ── cross-module hop: return ticket + trail naming where you came from ──
  currentStep = 'cross-module';
  const cross = await page.evaluate(async () => {
    launchOwnerModule();
    await new Promise(r => setTimeout(r, 450));
    execGoOps('alerts');                                   // a reminder-style hop
    await new Promise(r => setTimeout(r, 650));
    const crumb = document.querySelector('#ops-module-wrap .xs-crumbs').innerText.replace(/\n/g, ' ').trim();
    const backOn = document.querySelector('#ops-module-wrap .xs-back').classList.contains('on');
    const stack = execNavStack.length;
    execBack();
    await new Promise(r => setTimeout(r, 650));
    return { crumb, backOn, stack, ownerRestored: getComputedStyle(document.getElementById('owner-module-wrap')).display !== 'none', stackAfter: execNavStack.length };
  });
  record('A cross-module hop leaves a return ticket and names the origin in the trail',
    cross.backOn && cross.stack === 1 && /Owner/.test(cross.crumb) && /Operations/.test(cross.crumb) ? 'PASS' : 'FAIL', JSON.stringify(cross));
  record('Back from a hopped-to module returns to where you came from', cross.ownerRestored && cross.stackAfter === 0 ? 'PASS' : 'FAIL', JSON.stringify(cross));

  // ── the Job-Card-from-Sales case Salman actually hit ──
  currentStep = 'sales-to-job';
  const salesCase = await page.evaluate(async () => {
    openSalesModule();
    await new Promise(r => setTimeout(r, 450));
    execPushCurrent();                                     // what a hop helper does
    launchJobsModule(jobCards[0].id);
    await new Promise(r => setTimeout(r, 600));
    const crumb = document.querySelector('#jobs-module-wrap .xs-crumbs').innerText.replace(/\n/g, ' ').trim();
    execBack();                                            // first back: out of the record
    await new Promise(r => setTimeout(r, 500));
    const midView = jobsView;
    execBack();                                            // second back: to Sales
    await new Promise(r => setTimeout(r, 600));
    return { crumb, midView, salesRestored: getComputedStyle(document.getElementById('sales-module-wrap')).display !== 'none' };
  });
  record('Sales → Job Card → back → back lands you in Sales again (the reported dead end)',
    /Sales/.test(salesCase.crumb) && salesCase.midView === 'list' && salesCase.salesRestored ? 'PASS' : 'FAIL', JSON.stringify(salesCase));

  // ── a sidebar jump is a fresh context, not a growing stack ──
  currentStep = 'sidebar-resets-crumb';
  const sidebar = await page.evaluate(async () => {
    launchJobsModule(jobCards[0].id);
    await new Promise(r => setTimeout(r, 500));
    document.getElementById('xsnav-job-list').click();      // pick a sidebar destination
    await new Promise(r => setTimeout(r, 450));
    return {
      crumbsOn: document.querySelector('#jobs-module-wrap .xs-crumbs').classList.contains('on'),
      back: document.querySelector('#jobs-module-wrap .xs-back').classList.contains('on')
    };
  });
  record('Choosing a sidebar destination clears the record trail (fresh context)',
    !sidebar.crumbsOn && !sidebar.back ? 'PASS' : 'FAIL', JSON.stringify(sidebar));

  // ── 8 Aug 2026, from Salman moving Owner → Estimation: no back button,
  //    a stale "Logged in as" switcher, and a sidebar tasks panel that had
  //    become a third view of the same list. ──
  currentStep = 'owner-hop-back';
  const hop = await page.evaluate(async () => {
    launchOwnerModule();
    await new Promise(r => setTimeout(r, 600));
    document.querySelector('#owner-module-wrap #xsnav-m-sales').click();
    await new Promise(r => setTimeout(r, 700));
    const back = document.querySelector('#sales-module-wrap .xs-back');
    const visible = getComputedStyle(back).display !== 'none';
    back.click();
    await new Promise(r => setTimeout(r, 700));
    return { visible, returned: getComputedStyle(document.getElementById('owner-module-wrap')).display !== 'none' };
  });
  record('Hopping from Owner to another dashboard leaves a back arrow that returns to Owner',
    hop.visible && hop.returned ? 'PASS' : 'FAIL', JSON.stringify(hop));

  currentStep = 'stale-chrome';
  const chrome = await page.evaluate(async () => {
    const out = {};
    for (const [fn, id] of [['launchEstimatorModule','estimator-module-wrap'],['launchApproverModule','approver-module-wrap']]) {
      window[fn]();
      await new Promise(r => setTimeout(r, 500));
      const w = document.getElementById(id);
      out[id] = { loggedInAs: /Logged in as/.test(w.textContent), panel: (w.querySelector('.xs-sidepanels') || {}).innerHTML };
    }
    return out;
  });
  record('The dev-era "Logged in as" switcher is gone from Estimation and Approvals',
    Object.values(chrome).every(c => !c.loggedInAs) ? 'PASS' : 'FAIL', JSON.stringify(chrome));
  record('The sidebar no longer carries its own tasks panel',
    Object.values(chrome).every(c => c.panel === '') ? 'PASS' : 'FAIL', JSON.stringify(chrome));
  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
