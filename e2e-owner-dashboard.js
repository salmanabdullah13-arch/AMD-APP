// Owner Dashboard — redesign 4a (7 Aug 2026).
//
// Salman supplied a high-fidelity design handoff and asked for it exactly:
// "I want this exact design layout ... do not change anything." So these
// checks are about FIDELITY as much as function — the five themed rows in
// order, the card set, the four-column grid and its two responsive steps,
// every KPI being a real button with a drill-down, and the collapsible
// behaviours the handoff calls out as load-bearing.
//
// The data is live (the handoff's DATA block was replaced with the app's own
// getters), so the numbers move with the seeded state; assertions are about
// structure and behaviour, not specific figures.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== OWNER DASHBOARD — REDESIGN 4a ===');
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
  page.on('dialog', async d => { await d.accept('E2E task'); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => loadDemoData());
  await page.evaluate(() => launchOwnerModule());
  await page.waitForTimeout(700);

  // ── the five themed rows, in the handoff's order ──
  currentStep = 'layout';
  const layout = await page.evaluate(() => {
    const body = document.getElementById('owner-body');
    const grid = body.querySelector('.od-grid');
    return {
      mounted: body.classList.contains('od'),
      kpis: grid ? grid.querySelectorAll('.od-kpi').length : 0,
      cards: grid ? [...grid.querySelectorAll('.od-card')].map(c => (c.querySelector('.od-title') || {}).textContent || '') : [],
      spans: grid ? [...grid.querySelectorAll('.od-card')].filter(c => c.classList.contains('od-span2')).map(c => (c.querySelector('.od-title') || {}).textContent) : [],
      cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0
    };
  });
  // 'This week' and 'My tasks' left this list on 8 Aug 2026: they are the
  // SHARED planner/tasks widget now (planner-tasks.js), not .od-card children.
  // Their presence is asserted separately, just below.
  const expected = ['Recent activity', 'Company health',
    'By department', 'Revenue by division', 'Cash in hand', 'Recent expenses',
    // PATCH20260808 §2 put Profit & loss directly above Department quality
    'Top purchases', 'Pipeline funnel', 'Top clients', 'Profit & loss', 'Department quality'];
  record('Four KPI tiles lead, then the twelve cards in the handoff\'s row order',
    layout.kpis === 4 && JSON.stringify(layout.cards) === JSON.stringify(expected) ? 'PASS' : 'FAIL', JSON.stringify(layout.cards));
  const sharedWidgets = await page.evaluate(() => ({
    planner: document.querySelectorAll('#owner-body [onclick="plTogglePlanner()"]').length,
    tasks: document.querySelectorAll('#owner-body [onclick="plToggleTasks()"]').length
  }));
  record('This week and My tasks render as the ONE shared widget pair',
    sharedWidgets.planner === 1 && sharedWidgets.tasks === 1 ? 'PASS' : 'FAIL', JSON.stringify(sharedWidgets));
  record('The span-2 cards are By department, Revenue by division, Top purchases, Profit & loss and Department quality',
    JSON.stringify(layout.spans) === JSON.stringify(['By department', 'Revenue by division', 'Top purchases', 'Profit & loss', 'Department quality']) ? 'PASS' : 'FAIL', JSON.stringify(layout.spans));
  record('Desktop renders the four-column grid', layout.cols === 4 ? 'PASS' : 'FAIL', 'columns=' + layout.cols);
  record('Company health sits next to Recent activity (an explicit request)',
    layout.cards.indexOf('Company health') === layout.cards.indexOf('Recent activity') + 1 ? 'PASS' : 'FAIL');

  // ── every KPI is a button with a drill-down. A number with no drill-down is a bug. ──
  currentStep = 'kpi-drill';
  const kpiShape = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#owner-body .od-kpi')];
    return {
      allButtons: tiles.every(t => t.tagName === 'BUTTON'),
      allHaveAct: tiles.every(t => t.getAttribute('data-act') === 'drill'),
      keys: tiles.map(t => t.getAttribute('data-k')),
      labels: tiles.map(t => t.querySelector('.od-kpi-l').textContent.replace('›', '').trim())
    };
  });
  record('Every KPI renders as a <button> wired to a drill-down, never a <div>',
    kpiShape.allButtons && kpiShape.allHaveAct && JSON.stringify(kpiShape.keys) === JSON.stringify(['revenue', 'quotes', 'jobs', 'recv']) ? 'PASS' : 'FAIL', JSON.stringify(kpiShape));
  record('The band reads Invoiced MTD · Open quotes · Active jobs · Receivables',
    JSON.stringify(kpiShape.labels) === JSON.stringify(['Invoiced MTD', 'Open quotes', 'Active jobs', 'Receivables']) ? 'PASS' : 'FAIL', JSON.stringify(kpiShape.labels));

  await page.click('#owner-body .od-kpi[data-k="recv"]');
  await page.waitForTimeout(250);
  const drilled = await page.evaluate(() => {
    const body = document.getElementById('owner-body');
    return { title: (body.querySelector('.od-title') || {}).textContent, back: !!body.querySelector('[data-act="backfromdrill"]') };
  });
  record('Clicking a KPI opens its drill-down with a way back', drilled.title === 'Receivables' && drilled.back ? 'PASS' : 'FAIL', JSON.stringify(drilled));
  await page.click('#owner-body [data-act="backfromdrill"]');
  await page.waitForTimeout(250);
  const returned = await page.evaluate(() => !!document.querySelector('#owner-body .od-grid .od-kpi'));
  record('Back from a drill-down restores the dashboard', returned ? 'PASS' : 'FAIL');

  // ── collapsibles: the count is open tasks, not total ──
  currentStep = 'collapsibles';
  // My tasks is the SHARED widget now (planner-tasks.js) — its collapse rule
  // is the package's own: collapsed shows a count only, nothing else.
  const collapse = await page.evaluate(async () => {
    const card = () => document.querySelector('#owner-body [onclick="plToggleTasks()"]').parentElement;
    const before = /Urgent|Completed/.test(card().textContent);
    plToggleTasks();
    await new Promise(r => setTimeout(r, 150));
    const after = /Urgent|Completed/.test(card().textContent);
    const countOnly = /^\d+$/.test(card().querySelector('span:nth-child(2)').textContent.trim());
    plToggleTasks();
    await new Promise(r => setTimeout(r, 150));
    return { before, after, countOnly, restored: /Urgent|Completed/.test(card().textContent) };
  });
  record('My tasks collapses to a count-only header and reopens',
    collapse.before && !collapse.after && collapse.countOnly && collapse.restored ? 'PASS' : 'FAIL', JSON.stringify(collapse));

  const countIsOpen = await page.evaluate(async () => {
    const pill = () => Number(document.querySelector('#owner-body [onclick="plToggleTasks()"]')
      .parentElement.querySelector('span:nth-child(2)').textContent.trim());
    const t = createTask({ title: 'E2E count check', assignee: execIdentity(), dueDate: new Date().toISOString().slice(0, 10) });
    rerenderDashboard();
    await new Promise(r => setTimeout(r, 200));
    const openCount = pill();
    completeTask(t.id);
    rerenderDashboard();
    await new Promise(r => setTimeout(r, 200));
    return { openCount, afterDone: pill() };
  });
  record('The My tasks count is OPEN tasks — completing one lowers it',
    countIsOpen.afterDone === countIsOpen.openCount - 1 ? 'PASS' : 'FAIL', JSON.stringify(countIsOpen));

  // ── the week planner: stepping the period moves the selection with it ──
  currentStep = 'planner-selection';
  const stepping = await page.evaluate(async () => {
    // Shared widget: stepping MUST carry the selection with it, or the agenda
    // shows a day outside the visible period (the package calls this a real bug).
    plannerState.scope = 'Week'; plannerState.offset = 0; plannerState.selDate = null;
    const start = plIso(plSelectedDay());
    plStepPeriod(1);
    const after = plIso(plSelectedDay());
    const visible = plWeekCells().some(c => c.iso === after);
    plResetPeriod();
    return { start, after, visible,
      sameWeekday: new Date(start + 'T00:00:00Z').getUTCDay() === new Date(after + 'T00:00:00Z').getUTCDay() };
  });
  record('Stepping the week moves the day selection with it, so the agenda stays inside the visible period',
    stepping.visible && stepping.sameWeekday && stepping.start !== stepping.after ? 'PASS' : 'FAIL', JSON.stringify(stepping));

  const monthScope = await page.evaluate(async () => {
    // Shared widget (planner-tasks.js): Month is a 42-cell six-week grid with a
    // weekday header, out-of-month days dimmed but still tappable so the edges
    // of the month don't look broken.
    plSetScope('Month');
    await new Promise(r => setTimeout(r, 200));
    const cells = plMonthCells();
    const out = {
      cells: cells.length,
      header: /M\s*T\s*W\s*T\s*F\s*S\s*S/.test(document.getElementById('owner-body').textContent.replace(/\s+/g, ' ')),
      outside: cells.filter(c => !c.inMonth).length
    };
    plSetScope('Week');
    await new Promise(r => setTimeout(r, 200));
    out.backToWeek = plWeekCells().length;
    return out;
  });
  record('Month scope renders a 42-cell six-week grid with a weekday header, and Week scope returns seven days',
    monthScope.cells === 42 && monthScope.header && monthScope.backToWeek === 7 ? 'PASS' : 'FAIL', JSON.stringify(monthScope));

  // ── by department: workflow order, six tiles, production carries a split ──
  currentStep = 'departments';
  const dept = await page.evaluate(async () => {
    const tabs = [...document.querySelectorAll('#owner-body .od-tabs button')].map(b => b.textContent);
    const tileCount = document.querySelectorAll('#owner-body .od-dept .od-dtile').length;
    const link = document.querySelector('#owner-body [data-act="opendept"]').textContent;
    document.querySelector('#owner-body .od-tabs button[data-v="production"]').click();
    await new Promise(r => setTimeout(r, 200));
    return {
      tabs, tileCount, link,
      prodTiles: document.querySelectorAll('#owner-body .od-dept .od-dtile').length,
      splits: document.querySelectorAll('#owner-body .od-splitk').length,
      prodLink: document.querySelector('#owner-body [data-act="opendept"]').textContent
    };
  });
  record('Department tabs follow the real workflow order, not alphabetical',
    JSON.stringify(dept.tabs) === JSON.stringify(['Sales', 'Estimator', 'Operations', 'Jobs', 'Purchase', 'Production', 'Accounts', 'HR']) ? 'PASS' : 'FAIL', JSON.stringify(dept.tabs));
  record('Each tab shows six tiles and the header link follows the active tab',
    dept.tileCount === 6 && dept.prodTiles === 6 && /Sales/.test(dept.link) && /Production/.test(dept.prodLink) ? 'PASS' : 'FAIL', JSON.stringify(dept));
  record('Production tiles carry a department split (J · U · C · P)', dept.splits === 6 ? 'PASS' : 'FAIL', 'splits=' + dept.splits);

  // ── the numbers are live, not the handoff's invented data ──
  currentStep = 'live-data';
  const live = await page.evaluate(() => {
    const body = document.getElementById('owner-body').textContent;
    const invented = ['148,320.500', 'Seef Tower Lobby', 'Diyar Al Muharraq', 'BBK current account', 'JC-2026-0341'];
    const jobs = jobCards.filter(j => j.status === 'open').length;
    return {
      leakedMockData: invented.filter(v => body.includes(v)),
      activeJobsTile: document.querySelectorAll('#owner-body .od-kpi-v')[2].textContent,
      realJobCount: String(jobs)
    };
  });
  record('None of the handoff\'s invented sample data shipped', live.leakedMockData.length === 0 ? 'PASS' : 'FAIL', live.leakedMockData.join(', '));
  record('Active jobs shows the real job count', live.activeJobsTile === live.realJobCount ? 'PASS' : 'FAIL', JSON.stringify(live));

  // ── PATCH20260808 §1: a bar fill must never share a flex line with text ──
  currentStep = 'patch-bars';
  const bars = await page.evaluate(() => {
    const body = document.getElementById('owner-body');
    // every fill in the dashboard, wherever it lives
    const fills = [...body.querySelectorAll('.od-track i, .od-bar i, .od-fstep')];
    const withText = fills.filter(f => f.textContent.trim().length).map(f => f.textContent.trim().slice(0, 30));
    const rows = [...body.querySelectorAll('.od-funnel > div')];
    const trackW = [...new Set(rows.map(r => Math.round(r.querySelector('.od-track').getBoundingClientRect().width)))];
    return {
      withText,
      // all four stage tracks must be the same length, or the rows are on
      // different scales and the chart misrepresents the data
      trackWidths: trackW.length,
      values: rows.map(r => r.querySelector('.od-fstep-v').textContent),
      labels: rows.map(r => r.querySelector('.od-fstep-l').textContent)
    };
  });
  record('No bar fill anywhere on the dashboard contains text',
    bars.withText.length === 0 ? 'PASS' : 'FAIL', bars.withText.join(' | '));
  record('Every funnel stage is drawn on the same track, so the rows share one scale',
    bars.trackWidths === 1 ? 'PASS' : 'FAIL', 'distinct track widths=' + bars.trackWidths);
  record('Funnel values render in full BD format, not a shortened k figure',
    bars.values.every(v => /^BD [\d,]+\.\d{3}$/.test(v)) ? 'PASS' : 'FAIL', bars.values.join(', '));

  // ── PATCH20260808 §2: profit & loss ──
  currentStep = 'patch-pnl';
  const pnl = await page.evaluate(async () => {
    const card = [...document.querySelectorAll('#owner-body .od-card')].filter(c => /Profit & loss/.test(c.textContent))[0];
    const quarterly = card.querySelectorAll('.od-pnl-q').length;
    const barsPer = card.querySelectorAll('.od-pnl-q')[0].querySelectorAll('.od-track').length;
    document.querySelector('#owner-body [data-act="pnlmode"][data-v="Running"]').click();
    await new Promise(r => setTimeout(r, 250));
    const c2 = [...document.querySelectorAll('#owner-body .od-card')].filter(c => /Profit & loss/.test(c.textContent))[0];
    const running = c2.textContent.includes('cumulative year to date');
    document.querySelector('#owner-body [data-act="pnlmode"][data-v="Quarterly"]').click();
    await new Promise(r => setTimeout(r, 250));
    return { quarterly, barsPer, running, partial: /part-quarter to date/.test(card.textContent) };
  });
  record('Profit & loss shows three bars per period and flags the part-quarter',
    pnl.barsPer === 3 && pnl.partial ? 'PASS' : 'FAIL', JSON.stringify(pnl));
  record('The Quarterly / Running switch flips the same data to cumulative',
    pnl.running ? 'PASS' : 'FAIL', JSON.stringify(pnl));

  const pnlSales = await page.evaluate(() => {
    // The patch: "Owner and Accounts only. This card must never render for Sales."
    const was = window.cloudUserType;
    window.cloudUserType = 'sales';
    const html = OwnerDashboard.render();
    window.cloudUserType = was;
    return { rendersForSales: /Profit &amp; loss|Profit & loss/.test(html) };
  });
  record('Profit & loss never renders for a Sales role',
    !pnlSales.rendersForSales ? 'PASS' : 'FAIL', JSON.stringify(pnlSales));

  // ── PATCH20260808 §3: back arrow grouped with Quick actions ──
  currentStep = 'patch-back';
  const back = await page.evaluate(() => {
    const group = document.querySelector('#owner-module-wrap .xs-toprow');
    if (!group) return { grouped: false };
    const b = group.querySelector('.xs-back'), q = group.querySelector('.xs-qa');
    return {
      grouped: !!b && !!q,
      backLeftOfQa: !!b && !!q && (b.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      hiddenOnRoot: !!b && getComputedStyle(b).display === 'none',
      secondary: !!b && getComputedStyle(b).backgroundColor === 'rgba(0, 0, 0, 0)'
    };
  });
  record('Back sits immediately left of Quick actions, grouped with it, and is secondary chrome',
    back.grouped && back.backLeftOfQa && back.secondary ? 'PASS' : 'FAIL', JSON.stringify(back));
  record('It hides on the dashboard root, where there is nothing to go back to',
    back.hiddenOnRoot ? 'PASS' : 'FAIL', JSON.stringify(back));

  // ── shell changes the handoff depends on ──
  currentStep = 'shell';
  const shell = await page.evaluate(() => ({
    collapseChevInBrand: !!document.querySelector('#owner-module-wrap .xs-brand .xs-collapse-chev'),
    noFooterCollapse: !document.querySelector('#owner-module-wrap .xs-collapse-btn'),
    quickBtnAboveTitle: (function () {
      const qa = document.querySelector('#owner-module-wrap .xs-qa');
      const title = document.querySelector('#owner-module-wrap .xs-title');
      return !!qa && !!title && (qa.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    })(),
    noSidebarQuickGroup: [...document.querySelectorAll('#owner-module-wrap .xs-navlabel')].every(l => l.textContent !== 'Quick actions'),
    navGroups: [...document.querySelectorAll('#owner-module-wrap .xs-navlabel')].map(l => l.textContent)
  }));
  record('Collapse is a single chevron next to the brand mark, not a labelled footer button',
    shell.collapseChevInBrand && shell.noFooterCollapse ? 'PASS' : 'FAIL', JSON.stringify(shell));
  record('Quick actions is a wine button at the top-left of the content, above the page title, and gone from the sidebar',
    shell.quickBtnAboveTitle && shell.noSidebarQuickGroup ? 'PASS' : 'FAIL', JSON.stringify(shell));
  // The controls are ONE row — burger, back, Quick actions, then the icon
  // cluster — with the page title on its own line underneath. Nesting them in
  // the title block put Quick actions above the heading but indented to the
  // title's left edge, out of line with the burger (Salman's screenshot).
  currentStep = 'topbar-one-row';
  const rowGeom = await page.evaluate(() => {
    const w = '#owner-module-wrap ';
    const rc = s => { const e = document.querySelector(w + s); if (!e) return null;
      const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), b: Math.round(r.bottom) }; };
    const qa = rc('.xs-qa'), bell = rc('.xs-rem-badge'), title = rc('.xs-title');
    return {
      qaAndBellSameRow: !!qa && !!bell && Math.abs(qa.t - bell.t) < 14,
      titleBelowControls: !!qa && !!title && title.t >= qa.b,
      inToprow: !!document.querySelector(w + '.xs-toprow .xs-qa') &&
                !!document.querySelector(w + '.xs-toprow .xs-burger')
    };
  });
  record('Topbar is one control row (burger · back · Quick actions · icons) with the title beneath',
    rowGeom.qaAndBellSameRow && rowGeom.titleBelowControls && rowGeom.inToprow ? 'PASS' : 'FAIL',
    JSON.stringify(rowGeom));

  record('Nav groups are Workspace · Business · Money · Company · Administration',
    JSON.stringify(shell.navGroups) === JSON.stringify(['Workspace', 'Business', 'Money', 'Company', 'Administration']) ? 'PASS' : 'FAIL', JSON.stringify(shell.navGroups));

  await page.click('#owner-module-wrap .xs-qa');
  await page.waitForTimeout(200);
  const popover = await page.evaluate(() => ({
    open: !!document.querySelector('#owner-module-wrap .xs-qa-pop.open'),
    items: [...document.querySelectorAll('#owner-module-wrap .xs-qa-pop .xs-qa-item')].map(b => b.textContent.replace(/[^\w &]/g, '').trim())
  }));
  record('The Quick actions button opens a popover with the shortcuts', popover.open && popover.items.length >= 3 ? 'PASS' : 'FAIL', JSON.stringify(popover));
  await page.evaluate(() => execToggleQuick(false));

  // ── a sidebar destination actually goes somewhere ──
  currentStep = 'nav-hop';
  await page.click('#owner-module-wrap #xsnav-m-revenue');
  await page.waitForSelector('#accounts-module-wrap', { state: 'visible', timeout: 5000 });
  record('A Money destination opens the module that owns it via a genuine click', 'PASS');
  await page.evaluate(() => { hideModuleWrap(document.getElementById('accounts-module-wrap')); launchOwnerModule(); });
  await page.waitForTimeout(400);

  // ── responsive: two steps down to one column, with no horizontal overflow ──
  currentStep = 'responsive';
  const resp = [];
  // 8 Aug 2026, Salman with his phone next to the prototype: the KPI band
  // pairs up on mobile rather than stacking one tile per row, so 390px is two
  // columns with the full cards spanning both.
  for (const [w, want] of [[1280, 4], [1000, 2], [390, 2]]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const g = document.querySelector('#owner-body .od-grid');
      const kpiTops = [...g.querySelectorAll('.od-kpi')].map(k => Math.round(k.getBoundingClientRect().top));
      const cardW = [...new Set([...g.querySelectorAll('.od-card')].map(c => Math.round(c.getBoundingClientRect().width)))];
      return { cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, overflow: g.scrollWidth - Math.round(g.getBoundingClientRect().width), kpiRows: [...new Set(kpiTops)].length, cardWidths: cardW.length };
    });
    resp.push({ w, cols: r.cols, want, overflow: r.overflow, kpiRows: r.kpiRows, cardWidths: r.cardWidths });
  }
  record('The grid steps 4 → 2 → 2 columns and never overflows horizontally',
    resp.every(r => r.cols === r.want && r.overflow <= 1) ? 'PASS' : 'FAIL', JSON.stringify(resp));
  const phone = resp[resp.length - 1];
  record('On a phone the four KPI tiles pair up 2×2 and the full cards still span the width',
    phone.kpiRows === 2 && phone.cardWidths === 1 ? 'PASS' : 'FAIL', JSON.stringify(phone));

  // ── mutual exclusivity and a clean close, as for every module ──
  currentStep = 'module-hygiene';
  await page.setViewportSize({ width: 1280, height: 900 });
  const hygiene = await page.evaluate(() => {
    const others = ['sales-module-wrap', 'accounts-module-wrap', 'jobs-module-wrap', 'purch-module-wrap', 'admin-module-wrap']
      .filter(id => { const el = document.getElementById(id); return el && getComputedStyle(el).display !== 'none'; });
    return { othersVisible: others };
  });
  record('Opening Owner hides every other module wrap', hygiene.othersVisible.length === 0 ? 'PASS' : 'FAIL', hygiene.othersVisible.join(', '));

  const critical = consoleErrors.filter(e => !e.text.includes('favicon'));
  record('No unexpected console errors', critical.length === 0 ? 'PASS' : 'FAIL', critical.map(e => e.text).join(' | '));
  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
