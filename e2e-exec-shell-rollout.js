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
    out.operations = !!document.getElementById('ops-module-wrap').querySelector('.xs-side');
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
    document.querySelector('.xs-collapse-btn').click();
    const collapsed1 = document.getElementById('sales-module-wrap').classList.contains('xs-collapsed');
    // reopen another module — state must persist
    window.__eco3d.NODES.find(n => n.id === 'accounts').launch();
    await new Promise(r => setTimeout(r, 300));
    const collapsed2 = document.getElementById('accounts-module-wrap').classList.contains('xs-collapsed');
    document.querySelector('#accounts-module-wrap .xs-collapse-btn').click(); // restore
    return { collapsed1, collapsed2, stored: localStorage.getItem('amd-exec-side-collapsed') };
  });
  record('Sidebar collapse toggles and persists across modules', col.collapsed1 && col.collapsed2 ? 'PASS' : 'FAIL', JSON.stringify(col));

  currentStep = 'tasks-panel';
  const tasks = await page.evaluate(async () => {
    window.__eco3d.NODES.find(n => n.id === 'estimation').launch();
    await new Promise(r => setTimeout(r, 300));
    const input = document.querySelector('#estimator-module-wrap input.xs-task-input');
    if (!input) return { error: 'no input' };
    input.value = 'Rollout test task';
    execAddTask();
    await new Promise(r => setTimeout(r, 150));
    const t = tasks_find();
    function tasks_find() { return tasks.find(x => x.title === 'Rollout test task'); }
    const shown = document.querySelector('#estimator-module-wrap .xs-sidepanels').innerHTML.includes('Rollout test task');
    execCompleteTask(t.id);
    await new Promise(r => setTimeout(r, 150));
    return { created: !!t, assignee: t.assignee, shown, done: tasks.find(x => x.id === t.id).status === 'done' };
  });
  record('My Tasks panel works from inside a non-owner module (add + complete)', tasks.created && tasks.shown && tasks.done ? 'PASS' : 'FAIL', JSON.stringify(tasks));

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
  const calUI = await page.evaluate(async () => {
    window.__eco3d.NODES.find(n => n.id === 'owner').launch();
    await new Promise(r => setTimeout(r, 400));
    const html = document.querySelector('#owner-module-wrap .xs-sidepanels').innerHTML;
    return { hasGrid: html.includes('xs-cal-grid'), hasAgenda: html.includes('Calendar task probe') || html.includes('promised') || html.includes('Delivery') };
  });
  record('Calendar panel renders the month grid + today\'s agenda in the sidebar', calUI.hasGrid && calUI.hasAgenda ? 'PASS' : 'FAIL', JSON.stringify(calUI));

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
