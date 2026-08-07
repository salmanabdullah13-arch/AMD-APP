// Session 1 of Salman's 7 Aug 2026 UX/bug backlog — critical bugs (P0):
//  1. Sign-out "Cancel" still signed the user out (the module was hidden
//     BEFORE the confirm, dumping them on the empty Home screen).
//  2. Header/content overlap on Operations + Curtain — measured here rather
//     than assumed; the shell is a flex column so overlap must be 0.
//  3. Reminders panel items were dead text — each type now routes to the
//     screen that owns the work.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== SESSION 1 — CRITICAL BUGS ===');
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

  // ── BUG 1: Cancel on the sign-out confirm must change nothing ──
  currentStep = 'signout-cancel';
  // simulate a single-dashboard role (the sign-out path): home === null
  await page.evaluate(() => { window.__dashboardHome = null; window.__eco3d.NODES.find(n => n.id === 'sales').launch(); });
  await page.waitForTimeout(400);
  let signedOut = false;
  await page.evaluate(() => { window.__signOutCalled = false; window.cloudSignOut = () => { window.__signOutCalled = true; }; });
  page.once('dialog', async d => { await d.dismiss(); });          // tap CANCEL
  await page.click('#sales-module-wrap .xs-iconbtn[title="Close"]');
  await page.waitForTimeout(400);
  const afterCancel = await page.evaluate(() => ({
    stillOpen: getComputedStyle(document.getElementById('sales-module-wrap')).display !== 'none',
    signOutCalled: window.__signOutCalled
  }));
  record('Cancel on "Sign out?" leaves the user exactly where they were', afterCancel.stillOpen && !afterCancel.signOutCalled ? 'PASS' : 'FAIL', JSON.stringify(afterCancel));

  page.once('dialog', async d => { await d.accept(); });           // tap OK
  await page.click('#sales-module-wrap .xs-iconbtn[title="Close"]');
  await page.waitForTimeout(400);
  const afterOk = await page.evaluate(() => ({
    hidden: getComputedStyle(document.getElementById('sales-module-wrap')).display === 'none',
    signOutCalled: window.__signOutCalled
  }));
  record('OK on "Sign out?" does sign out (the fix did not break the real path)', afterOk.hidden && afterOk.signOutCalled ? 'PASS' : 'FAIL', JSON.stringify(afterOk));

  // ── BUG 2: header must never overlap content (measured, notch simulated) ──
  currentStep = 'header-overlap';
  await page.evaluate(() => {
    delete window.__dashboardHome;
    document.documentElement.style.setProperty('--safe-top', '47px');
    document.documentElement.style.setProperty('--safe-bot', '34px');
  });
  page.on('dialog', async d => { await d.accept(); });
  const overlaps = await page.evaluate(async () => {
    const out = {};
    for (const [key, id, open] of [['operations', 'ops-module-wrap', () => goTo('operations')],
                                   ['curtain', 'curt-module-wrap', () => window.__eco3d.NODES.find(n => n.id === 'curtain').launch()],
                                   ['sales', 'sales-module-wrap', () => window.__eco3d.NODES.find(n => n.id === 'sales').launch()]]) {
      open();
      await new Promise(r => setTimeout(r, 400));
      const w = document.getElementById(id);
      const t = w.querySelector('.xs-top').getBoundingClientRect();
      const c = w.querySelector('.xs-content').getBoundingClientRect();
      out[key] = Math.round(t.bottom - c.top);   // >0 means the header covers content
    }
    return out;
  });
  record('Header never overlaps content on Operations / Curtain / Sales (0px, notch simulated)',
    Object.values(overlaps).every(v => v <= 0) ? 'PASS' : 'FAIL', JSON.stringify(overlaps));

  // ── BUG 3: reminders route to the screen that owns the work ──
  currentStep = 'reminder-routes';
  const seeded = await page.evaluate(async () => {
    salesCurrentUser = 'Salman Abdullah';
    const cust = createCustomer({ name: 'Reminder Route Client', contactPerson: 'R', tel: '39990888', address: 'M' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'R', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'Reminder Route Job', taxPercent: 10, contactPerson: 'R' });
    addQuotationItem(q.id, { product: 'Painted TV Unit', qty: 1, unit: 'Nos', rate: 0 });
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(q.id, 'Salman Abdullah');   // unrouted → "awaiting routing" reminder
    setJobUrgent(job.id, true, 'Operations Manager');                  // → urgent reminder
    return { jobId: job.id };
  });
  const rem = await page.evaluate(() => {
    const R = getExecReminders();
    return {
      total: R.length,
      withRoutes: R.filter(r => r.go).length,
      routing: (R.find(r => /awaiting routing/.test(r.title)) || {}).go,
      urgent: (R.find(r => /^URGENT/.test(r.title)) || {}).go
    };
  });
  record('Reminders carry routes (routing → Operations New Jobs, urgent → that job)',
    rem.withRoutes > 0 && /execGoOps\('alerts'\)/.test(rem.routing || '') && /execGoJob/.test(rem.urgent || '') ? 'PASS' : 'FAIL', JSON.stringify(rem));

  // real click-through: open the bell, tap the routing reminder, land on Operations → New Jobs
  await page.evaluate(() => { window.__eco3d.NODES.find(n => n.id === 'owner').launch(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => execToggleReminders(true));
  await page.waitForTimeout(300);
  const clicked = await page.evaluate(async () => {
    const row = [...document.querySelectorAll('.xs-panel.open .xs-rem-go')].find(el => /awaiting routing/.test(el.textContent));
    if (!row) return { error: 'no routing row' };
    row.click();
    await new Promise(r => setTimeout(r, 600));
    const ops = document.getElementById('ops-module-wrap');
    return {
      opsOpen: getComputedStyle(ops).display !== 'none',
      onNewJobs: document.getElementById('p-alerts')?.classList.contains('active'),
      panelClosed: !document.querySelector('.xs-panel.open')
    };
  });
  record('Tapping the "awaiting routing" reminder opens Operations → New Jobs and closes the panel',
    clicked.opsOpen && clicked.onNewJobs && clicked.panelClosed ? 'PASS' : 'FAIL', JSON.stringify(clicked));

  const jobRoute = await page.evaluate(async (jobId) => {
    execToggleReminders(true);
    await new Promise(r => setTimeout(r, 250));
    const row = [...document.querySelectorAll('.xs-panel.open .xs-rem-go')].find(el => /URGENT/.test(el.textContent));
    if (!row) return { error: 'no urgent row' };
    row.click();
    await new Promise(r => setTimeout(r, 600));
    return { jobsOpen: getComputedStyle(document.getElementById('jobs-module-wrap')).display !== 'none', view: typeof jobsView !== 'undefined' ? jobsView : null };
  }, seeded.jobId);
  record('Tapping an urgent-job reminder opens that Job Card directly', jobRoute.jobsOpen && jobRoute.view === 'hub' ? 'PASS' : 'FAIL', JSON.stringify(jobRoute));

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
