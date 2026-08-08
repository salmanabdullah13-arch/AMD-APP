// Exec-shell app-wide rollout (6 Aug 2026) — one coherent layout for every
// user (Salman's ask, screenshot-driven): the Owner/Admin pilot shell now
// wraps EVERY module via execEnsureShell()'s adopt-once mechanism, with a
// collapsible sidebar, shared My Tasks + Calendar sidebar panels, per-role
// nav configs (EXEC_NAV_CONFIGS), and ONE floating chat bubble available
// app-wide. Access-control regression coverage included: granular
// shop-floor views must never gain the manager sidebar tabs.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== EXEC-SHELL ROLLOUT ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text().slice(0, 150) }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message.slice(0, 150) }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  currentStep = 'all-modules-shelled';
  const mods = ['sales', 'estimation', 'approvals', 'delivery', 'accounts', 'hr', 'purchasing', 'storekeeper', 'curtain', 'joinery', 'upholstery', 'painting', 'fleet', 'delivery-scheduling', 'owner', 'admin'];
  const shellMap = await page.evaluate(async (mods) => {
    const out = {};
    for (const id of mods) {
      const n = window.__eco3d.NODES.find(n => n.id === id);
      n.launch();
      await new Promise(r => setTimeout(r, 300));
      const wraps = [...document.querySelectorAll('[id$="module-wrap"]')].filter(w => getComputedStyle(w).display !== 'none' && w.id !== 'exec-chat-float');
      const w = wraps[wraps.length - 1];
      const oldHdr = w && [...w.querySelectorAll('.ops-header')].some(h => getComputedStyle(h).display !== 'none');
      out[id] = !!(w && w.querySelector('.xs-side') && w.querySelector('.xs-sidepanels')) && !oldHdr;
    }
    goTo('operations');
    await new Promise(r => setTimeout(r, 300));
    const ow = document.getElementById('ops-module-wrap');
    // 6 Aug 2026 fix: the wrap-scoped hide selectors must actually kill the
    // old wine banner + tab strip (the first version's .xs-content > .nav
    // selector never matched — Salman's iPhone screenshot caught it).
    // 7 Aug 2026 redesign: Operations is a real full-screen overlay now, the
    // dev-era app chrome is gone app-wide, and the dashboard leads with the
    // action queue (no "Your day" card, no comms/Messages strip).
    const opsBody = document.getElementById('ops-dashboard-body').innerHTML;
    out.operations = !!ow.querySelector('.xs-side')
      && getComputedStyle(ow).position === 'fixed'
      && !document.querySelector('.app > .topbar')      // old topbar retired
      && !document.querySelector('.bnav')               // bottom bar retired
      && [...ow.querySelectorAll('.topbar')].every(t => getComputedStyle(t).display === 'none')
      && [...ow.querySelectorAll('.nav')].every(t => getComputedStyle(t).display === 'none')
      && opsBody.includes('Route new jobs')             // action queue leads
      && !opsBody.includes('Notify Storekeeper');       // comms strip gone
    return out;
  }, mods);
  const unshelled = Object.entries(shellMap).filter(([, v]) => !v).map(([k]) => k);
  record('All 17 dashboards carry the sidebar shell (old headers hidden)', unshelled.length === 0 ? 'PASS' : 'FAIL', unshelled.join(',') || 'all');

  currentStep = 'sidebar-nav-drives-views';
  const nav = await page.evaluate(async () => {
    window.__eco3d.NODES.find(n => n.id === 'sales').launch();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('xsnav-sal-qtn').click();
    await new Promise(r => setTimeout(r, 250));
    const onQtn = salesView === 'qtn-list';
    const active = document.getElementById('xsnav-sal-qtn').classList.contains('active');
    return { onQtn, active };
  });
  record('Sidebar item drives the existing view dispatcher + active highlight', nav.onQtn && nav.active ? 'PASS' : 'FAIL', JSON.stringify(nav));

  currentStep = 'collapse-persists';
  const col = await page.evaluate(async () => {
    document.querySelector('.xs-collapse-chev').click();
    const collapsed1 = document.getElementById('sales-module-wrap').classList.contains('xs-collapsed');
    // reopen another module — state must persist
    window.__eco3d.NODES.find(n => n.id === 'accounts').launch();
    await new Promise(r => setTimeout(r, 300));
    const collapsed2 = document.getElementById('accounts-module-wrap').classList.contains('xs-collapsed');
    document.querySelector('#accounts-module-wrap .xs-collapse-chev').click(); // restore
    return { collapsed1, collapsed2, stored: localStorage.getItem('amd-exec-side-collapsed') };
  });
  record('Sidebar collapse toggles and persists across modules', col.collapsed1 && col.collapsed2 ? 'PASS' : 'FAIL', JSON.stringify(col));

  currentStep = 'tasks-reachable';
  // The sidebar tasks panel was removed on 8 Aug 2026 — Salman: "my tasks on
  // taskbar serves no useful purpose now". Tasks are still reachable from any
  // module: Quick actions opens the planner, which shows dated tasks on their
  // day and undated ones in its "needs a slot" rail.
  const tasks = await page.evaluate(async () => {
    window.__eco3d.NODES.find(n => n.id === 'estimation').launch();
    await new Promise(r => setTimeout(r, 400));
    const panel = document.querySelector('#estimator-module-wrap .xs-sidepanels');
    const t = createTask({ title: 'Rollout test task', assignee: execIdentity() });
    execOpenPlanner();
    await new Promise(r => setTimeout(r, 400));
    const planner = document.getElementById('exec-planner');
    const shown = planner.textContent.includes('Rollout test task');
    completeTask(t.id);
    execClosePlanner();
    return {
      panelGone: !panel || panel.innerHTML === '',
      created: !!t, shown,
      done: tasks.find(x => x.id === t.id).status === 'done'
    };
  });
  record('The sidebar tasks panel is gone, and an undated task is still reachable — it lands in the planner\'s unscheduled rail',
    tasks.panelGone && tasks.created && tasks.shown && tasks.done ? 'PASS' : 'FAIL', JSON.stringify(tasks));

  currentStep = 'calendar';
  const cal = await page.evaluate(async () => {
    const today = new Date().toISOString().slice(0, 10);
    salesCurrentUser = 'Salman Abdullah';
    // seed: a due task, a promised job (via real flow), a planned delivery
    const t = createTask({ title: 'Calendar task probe', assignee: (window.cloudIdentity || 'Salman Abdullah'), dueDate: today });
    const cust = createCustomer({ name: 'Calendar Probe Client', contactPerson: 'C', tel: '39990777', address: 'M' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'C', tel: cust.tel, source: 'walk inn', salesPerson: 'Someone Else' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'Calendar Probe TV Unit', taxPercent: 10, contactPerson: 'C' });
    addQuotationItem(q.id, { product: 'Painted TV Unit', qty: 1, unit: 'Nos', rate: 0 });
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(q.id, 'Salman Abdullah');
    setJobPromisedDate(job.id, today, 'Operations Manager');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    scheduleDelivery(job.id, { plannedDate: today, driver: 'D', vehicleId: null, notes: '' });
    // owner sees all three
    const ownerEv = getCalendarEvents(window.cloudIdentity || 'Salman Abdullah', 'owner').filter(e => e.date === today);
    // sales identity that owns NO jobs sees the task but not this job promise
    const salesEv = getCalendarEvents('Nobody Person', 'sales').filter(e => e.date === today);
    return {
      ownerTypes: [...new Set(ownerEv.map(e => e.type))].sort(),
      salesHasPromise: salesEv.some(e => e.type === 'promised'),
      taskId: t.id, jobId: job.id
    };
  });
  record('Calendar events: owner sees task+promised+delivery today; sales role-filter hides other people\'s jobs',
    JSON.stringify(cal.ownerTypes) === '["delivery","promised","task"]' && !cal.salesHasPromise ? 'PASS' : 'FAIL', JSON.stringify(cal));
  // Owner-redesign handoff (7 Aug 2026): the sidebar is "navigation + My
  // tasks + user chip only" — the calendar moved into the dashboard's own
  // This-week card and the full Week planner. Same feed, two new homes.
  const calUI = await page.evaluate(async () => {
    window.__eco3d.NODES.find(n => n.id === 'owner').launch();
    await new Promise(r => setTimeout(r, 500));
    const sidebar = document.querySelector('#owner-module-wrap .xs-sidepanels').innerHTML;
    const dash = document.getElementById('owner-body').innerHTML;
    execOpenPlanner();
    await new Promise(r => setTimeout(r, 250));
    const planner = document.getElementById('exec-planner').innerHTML;
    execClosePlanner();
    return {
      goneFromSidebar: !sidebar.includes('xs-cal-grid'),
      inDashboard: dash.includes('od-days') || dash.includes('od-month'),
      inPlanner: planner.includes('xs-pl-col')
    };
  });
  record('The calendar left the sidebar for the dashboard\'s This-week card and the Week planner',
    calUI.goneFromSidebar && calUI.inDashboard && calUI.inPlanner ? 'PASS' : 'FAIL', JSON.stringify(calUI));

  currentStep = 'floating-chat';
  const chat = await page.evaluate(async () => {
    goTo('eco'); // home page
    await new Promise(r => setTimeout(r, 200));
    const fab = document.querySelector('#exec-chat-float .xs-chat-fab');
    const fabVisible = fab && getComputedStyle(document.getElementById('exec-chat-float')).display !== 'none';
    fab.click();
    await new Promise(r => setTimeout(r, 200));
    const panelOpen = document.querySelector('#exec-chat-float .xs-chat').classList.contains('open');
    // open a thread and send for real
    execOpenThread('Storekeeper');
    await new Promise(r => setTimeout(r, 150));
    const input = document.querySelector('#exec-chat-float .xs-chat-compose input');
    input.value = 'Floating chat probe';
    await execChatSend();
    await new Promise(r => setTimeout(r, 200));
    const landed = (typeof messages !== 'undefined' ? messages : []).some(m => m.body === 'Floating chat probe' && m.to === 'Storekeeper');
    execToggleChat(false);
    return { fabVisible, panelOpen, landed };
  });
  record('Floating chat: bubble on the home page, opens, real send lands in messages[]', chat.fabVisible && chat.panelOpen && chat.landed ? 'PASS' : 'FAIL', JSON.stringify(chat));

  currentStep = 'dark-mode';
  const dark = await page.evaluate(async () => {
    window.__eco3d.NODES.find(n => n.id === 'hr').launch();
    await new Promise(r => setTimeout(r, 300));
    execThemeToggle();
    await new Promise(r => setTimeout(r, 250));
    const wrap = document.getElementById('hr-module-wrap');
    const isDark = wrap.classList.contains('x-dark');
    const card = wrap.querySelector('.sales-card');
    const bg = card ? getComputedStyle(card).backgroundColor : null;
    execThemeToggle(); // restore light
    return { isDark, bg };
  });
  record('Dark toggle inside a converted module re-themes its cards', dark.isDark && dark.bg === 'rgb(29, 23, 33)' ? 'PASS' : 'FAIL', JSON.stringify(dark));

  currentStep = 'granular-access-control';
  const gran = await page.evaluate(async () => {
    openJoineryModule('drafting');
    await new Promise(r => setTimeout(r, 300));
    const wrap = document.getElementById('joinery-module-wrap');
    const navItems = [...wrap.querySelectorAll('.xs-item')].map(b => b.textContent.trim());
    const hasManagerTabs = navItems.some(t => /Budget|Dashboard|Queue/i.test(t));
    const bodyHasDrafting = wrap.querySelector('.xs-content').innerHTML.toLowerCase().includes('drafting');
    // manager open restores the tabs
    openJoineryModule();
    await new Promise(r => setTimeout(r, 300));
    const managerItems = [...wrap.querySelectorAll('.xs-item')].length;
    return { hasManagerTabs, bodyHasDrafting, managerItems };
  });
  record('Granular joinery view gets NO manager sidebar tabs (access control); manager open restores them',
    !gran.hasManagerTabs && gran.managerItems >= 3 ? 'PASS' : 'FAIL', JSON.stringify(gran));

  currentStep = 'mobile-drawer-close';
  // Salman on his iPhone: "the task bar once opened doesn't collapse back" —
  // the drawer had NO exit on mobile (Collapse is desktop-only, no scrim, and
  // nav taps left it open). All three ways out must work.
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobilePage.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message.slice(0, 150) }));
  mobilePage.on('dialog', async d => { await d.accept(); });
  await mobilePage.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await mobilePage.waitForSelector('#app', { state: 'visible' });
  await mobilePage.evaluate(() => { window.__eco3d.NODES.find(n => n.id === 'sales').launch(); });
  await mobilePage.waitForTimeout(400);
  const openState = () => mobilePage.evaluate(() => !!document.querySelector('#sales-module-wrap .xs-side.open'));
  await mobilePage.click('#sales-module-wrap .xs-burger'); await mobilePage.waitForTimeout(250);
  const drawerOpened = await openState();
  await mobilePage.click('#sales-module-wrap .xs-side-close'); await mobilePage.waitForTimeout(250);
  const closedByX = !(await openState());
  await mobilePage.click('#sales-module-wrap .xs-burger'); await mobilePage.waitForTimeout(250);
  await mobilePage.evaluate(() => document.querySelector('#sales-module-wrap .xs-side-scrim').click());
  await mobilePage.waitForTimeout(250);
  const closedByScrim = !(await openState());
  await mobilePage.click('#sales-module-wrap .xs-burger'); await mobilePage.waitForTimeout(250);
  await mobilePage.click('#xsnav-sal-qtn'); await mobilePage.waitForTimeout(300);
  const closedByNav = !(await openState());
  const navWorked = await mobilePage.evaluate(() => salesView === 'qtn-list');
  // Operations specifically — its drawer used to clip (it was a page
  // inside #scroll, not an overlay). Assert full-height from the top.
  await mobilePage.evaluate(() => goTo('operations'));
  await mobilePage.waitForTimeout(500);
  await mobilePage.click('#ops-module-wrap .xs-burger'); await mobilePage.waitForTimeout(300);
  const opsDrawer = await mobilePage.evaluate(() => {
    const s = document.querySelector('#ops-module-wrap .xs-side');
    const r = s.getBoundingClientRect();
    return { open: s.classList.contains('open'), top: Math.round(r.top), coversViewport: r.height >= window.innerHeight - 2 };
  });
  await mobilePage.evaluate(() => execToggleSide(false));
  record('Operations drawer opens full-height from the top on mobile (was clipped)',
    opsDrawer.open && opsDrawer.top === 0 && opsDrawer.coversViewport ? 'PASS' : 'FAIL', JSON.stringify(opsDrawer));

  // Collapse is persisted per device, so a sidebar collapsed on desktop arrived
  // on the phone as the 64px icon rail: rows centred with no left padding, no
  // brand text, no user name — and a chevron that could put it back there.
  // The drawer is always a full drawer.
  currentStep = 'mobile-drawer-never-a-rail';
  await mobilePage.evaluate(() => {
    localStorage.setItem('amd-exec-side-collapsed', '1');
    launchSalesModule();
  });
  await mobilePage.waitForTimeout(500);
  await mobilePage.click('#sales-module-wrap .xs-burger'); await mobilePage.waitForTimeout(300);
  const rail = await mobilePage.evaluate(() => {
    const side = document.querySelector('#sales-module-wrap .xs-side.open');
    const items = [...side.querySelectorAll('.xs-item')];
    const chev = document.querySelector('#sales-module-wrap .xs-collapse-chev');
    const iconX = items.map(i => Math.round((i.firstElementChild || i).getBoundingClientRect().left));
    return {
      justify: getComputedStyle(items[0]).justifyContent,
      oneIconColumn: new Set(iconX).size === 1,
      chevHidden: !chev || getComputedStyle(chev).display === 'none',
      brandText: !!side.querySelector('.xs-brand > div:not(.xs-brand-mark)') &&
        getComputedStyle(side.querySelector('.xs-brand > div:not(.xs-brand-mark)')).display !== 'none',
      userName: !!side.querySelector('.xs-user > div:not(.xs-avatar)') &&
        getComputedStyle(side.querySelector('.xs-user > div:not(.xs-avatar)')).display !== 'none'
    };
  });
  await mobilePage.evaluate(() => { localStorage.removeItem('amd-exec-side-collapsed'); execToggleSide(false); });
  record('mobile drawer never renders as the collapsed rail, even when collapse was persisted',
    rail.justify === 'flex-start' && rail.oneIconColumn && rail.chevHidden &&
    rail.brandText && rail.userName ? 'PASS' : 'FAIL', JSON.stringify(rail));
  await mobilePage.close();

  record('Mobile drawer closes via ×, tap-outside scrim, and picking a nav item (which still navigates)',
    drawerOpened && closedByX && closedByScrim && closedByNav && navWorked ? 'PASS' : 'FAIL',
    JSON.stringify({ drawerOpened, closedByX, closedByScrim, closedByNav, navWorked }));

  currentStep = 'dept-pipeline-roundtrip';
  const pipe = await page.evaluate(async () => {
    // dept-pipeline-ui callbacks must still work inside the shell
    openUpholsteryModule();
    await new Promise(r => setTimeout(r, 250));
    upholsterySetView('queue');
    await new Promise(r => setTimeout(r, 200));
    return { rendered: document.getElementById('upholstery-body') ? document.getElementById('upholstery-body').innerHTML.length > 50 : false, view: upholsteryView };
  });
  record('dept-pipeline-ui still renders inside the shell (queue view)', pipe.rendered && pipe.view === 'queue' ? 'PASS' : 'FAIL', JSON.stringify(pipe));

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
