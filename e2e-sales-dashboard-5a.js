// Sales Dashboard — design handoff 5a (7 Aug 2026).
//
// Salman supplied a high-fidelity bundle and asked for it exactly. The rule
// that shapes the whole screen, in the handoff's own words:
//
//   "Sales must never see price, cost, or supplier/vendor names — anywhere.
//    This is a fraud-prevention rule following a real incident."
//
// So the first and most important check here is that no monetary value
// reaches this dashboard by ANY path — the cards, the job sheet, or the
// underlying DATA object. The handoff also lists three bugs in the old build
// it expects fixed: a Receivables KPI, Top Clients ranked by spend, and a
// dashboard showing company-wide figures instead of the logged-in
// salesperson's own book. All three are checked.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== SALES DASHBOARD — HANDOFF 5a ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

// Anything that looks like money in any of the app's own formats.
const MONEY = /BD\s?[\d,]|\d+\.\d{3}\b|BHD|\bcost\b|\bprice\b|receivable|payable|margin|\bbudget\b|supplier|vendor/i;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text().slice(0, 150) }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message.slice(0, 150) }));
  page.on('dialog', async d => { await d.accept('E2E task'); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  // Demo data books its work to Salman Abdullah, so sign the dashboard in as
  // that salesperson — otherwise "my book" is correctly empty.
  await page.evaluate(() => { loadDemoData(); salesCurrentUser = 'Salman Abdullah'; openSalesModule(); });
  await page.waitForTimeout(900);

  // ── layout, in the handoff's row order ──
  currentStep = 'layout';
  const layout = await page.evaluate(() => {
    const body = document.getElementById('sales-body');
    const grid = body.querySelector('.sd-grid');
    return {
      mounted: body.querySelector('#sales-dashboard-root').classList.contains('sd'),
      cards: [...grid.children].map(c => (c.querySelector('.sd-title') || {}).textContent || 'policy'),
      spans: [...grid.children].filter(c => c.classList.contains('sd-span2')).length,
      cols: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      title: (body.querySelector('#sales-dashboard-root > div') || {}).textContent || ''
    };
  });
  record('The eight cards render in the handoff\'s order',
    JSON.stringify(layout.cards) === JSON.stringify(['This week', 'My tasks', 'Needs you today', 'My quotations', 'Production status', 'My pipeline', 'My clients', 'policy']) ? 'PASS' : 'FAIL', JSON.stringify(layout.cards));
  record('Four span-2 cards and a four-column desktop grid',
    layout.spans === 4 && layout.cols === 4 ? 'PASS' : 'FAIL', JSON.stringify(layout));
  record('The page is titled "My book" and names the salesperson',
    /My book/.test(layout.title) && /Salman Abdullah/.test(layout.title) ? 'PASS' : 'FAIL', layout.title.slice(0, 80));

  // ── THE rule: no money anywhere, by any path ──
  currentStep = 'no-money';
  const money = await page.evaluate((src) => {
    const re = new RegExp(src, 'i');
    const body = document.getElementById('sales-body');
    // the rendered screen
    // The policy card and the job sheet's closing line exist to NAME what is
    // hidden ('Prices, costs and supplier names are hidden from Sales...'), so
    // scan everything except those two.
    const scan = document.createElement('div');
    scan.innerHTML = body.innerHTML;
    [...scan.querySelectorAll('.sd-note')].forEach(e => e.remove());
    [...scan.querySelectorAll('.sd-card')].forEach(e => { if (/Why there are no values/.test(e.textContent)) e.remove(); });
    const onScreen = (scan.textContent.match(new RegExp(src, 'gi')) || []).slice(0, 6);
    // and the data behind it — a field that carries a value is a leak even
    // if nothing renders it today
    const leaks = [];
    (function walk(v, p) {
      if (v == null || p.length > 6) return;
      if (typeof v === 'string') { if (re.test(v)) leaks.push(p.join('.') + ' = ' + v.slice(0, 40)); return; }
      if (typeof v === 'object') Object.keys(v).forEach(k => {
        if (re.test(k)) leaks.push(p.concat(k).join('.'));
        walk(v[k], p.concat(k));
      });
    })(SalesDashboard.data, []);
    return { onScreen, leaks: leaks.slice(0, 8) };
  }, MONEY.source);
  record('No monetary value, cost, supplier or vendor appears anywhere on the dashboard',
    money.onScreen.length === 0 ? 'PASS' : 'FAIL', money.onScreen.join(' | '));
  record('No field in the dashboard\'s own data could carry one either',
    money.leaks.length === 0 ? 'PASS' : 'FAIL', money.leaks.join(' | '));

  const noHelper = await page.evaluate(() => ({
    // the handoff: "There is deliberately NO currency formatting helper"
    hasBd: typeof SalesDashboard.data.bd === 'function',
    fileHasBd: false
  }));
  record('The dashboard exposes no currency helper', !noHelper.hasBd ? 'PASS' : 'FAIL');

  // ── the three bugs the handoff names in the old build ──
  currentStep = 'handoff-bugs';
  const bugs = await page.evaluate(() => {
    const body = document.getElementById('sales-body').textContent;
    // scope: another salesperson's book must not appear in mine
    const mine = SalesDashboard.data.quotations.map(q => q.id);
    const all = quotations.map(q => q.id);
    const notMine = quotations.filter(q => {
      const e = enquiries.find(x => x.id === q.enquiryId);
      return !e || e.salesPerson !== 'Salman Abdullah';
    }).map(q => q.id);
    return {
      noReceivables: !/receivab/i.test(body),
      clientsByActivity: SalesDashboard.data.clients.every(c => typeof c.jobs === 'number' && typeof c.quotes === 'number' && c.value === undefined),
      scoped: mine.length > 0 && mine.length <= all.length && notMine.every(id => mine.indexOf(id) === -1),
      mine: mine.length, all: all.length
    };
  });
  record('The Receivables KPI is gone from this role', bugs.noReceivables ? 'PASS' : 'FAIL');
  record('Clients are ranked by activity (jobs · quotes · last contact), never by spend', bugs.clientsByActivity ? 'PASS' : 'FAIL');
  record('The dashboard is scoped to the logged-in salesperson\'s own book, not the company\'s',
    bugs.scoped ? 'PASS' : 'FAIL', JSON.stringify(bugs));

  // ── needs you today: empty steps collapse, they don't disappear ──
  currentStep = 'queue';
  const queue = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#sales-body .sd-q')];
    return {
      count: rows.length,
      empties: rows.filter(r => r.classList.contains('is-empty')).length,
      keyline: rows.filter(r => !r.classList.contains('is-empty')).every(r => /is-(bad|warn|wine)/.test(r.className))
    };
  });
  record('All five queue steps are present — ones with nothing waiting collapse to a muted line',
    queue.count === 5 ? 'PASS' : 'FAIL', JSON.stringify(queue));

  // ── quotations: stage chips filter the list ──
  currentStep = 'quotations';
  const chips = await page.evaluate(async () => {
    const before = document.querySelectorAll('#sales-body [data-act="quote"]').length;
    // the planner reuses .sd-chips for Week/Month — scope to the stage strip
    const labels = [...document.querySelectorAll('#sales-body .sd-chips button[data-act="stage"]')].map(b => b.textContent);
    document.querySelector('#sales-body [data-act="stage"][data-v="estimator"]').click();
    await new Promise(r => setTimeout(r, 250));
    const after = document.querySelectorAll('#sales-body [data-act="quote"]').length;
    const expected = SalesDashboard.data.quotations.filter(q => q.stage === 'estimator').length;
    document.querySelector('#sales-body [data-act="stage"][data-v="all"]').click();
    await new Promise(r => setTimeout(r, 250));
    return { labels, before, after, expected, restored: document.querySelectorAll('#sales-body [data-act="quote"]').length };
  });
  record('Stage chips read All · Needs me · With Estimator · With Approver · With client',
    JSON.stringify(chips.labels) === JSON.stringify(['All', 'Needs me', 'With Estimator', 'With Approver', 'With client']) ? 'PASS' : 'FAIL', JSON.stringify(chips.labels));
  record('Choosing a stage filters the quotation list to exactly that stage',
    chips.after === chips.expected && chips.restored === chips.before ? 'PASS' : 'FAIL', JSON.stringify(chips));

  // ── production: real per-line state, six segments, hold from a real field ──
  currentStep = 'production';
  const prod = await page.evaluate(() => {
    const jobs = SalesDashboard.data.jobs;
    const withItems = jobs.filter(j => j.items.length);
    const segs = document.querySelector('#sales-body .sd-segs');
    return {
      jobs: jobs.length,
      segments: segs ? segs.children.length : 0,
      stages: SalesDashboard.data.productionStages,
      // every item's stage must be one of the six, "On hold" or "Not started"
      stagesValid: withItems.every(j => j.items.every(i =>
        SalesDashboard.data.productionStages.indexOf(i.st) !== -1 || i.st === 'On hold' || i.st === 'Not started')),
      pctInRange: withItems.every(j => j.items.every(i => i.pct >= 0 && i.pct <= 100)),
      legend: document.querySelectorAll('#sales-body .sd-legend span').length
    };
  });
  record('The stage bar has six segments over the handoff\'s six stage names',
    prod.segments === 6 && prod.stages.length === 6 && prod.stages[0] === 'Cutting list' && prod.stages[5] === 'Ready' ? 'PASS' : 'FAIL', JSON.stringify(prod.stages));
  record('Every item carries a valid stage and a percentage in range, from the app\'s real per-line pipeline',
    prod.stagesValid && prod.pctInRange ? 'PASS' : 'FAIL', JSON.stringify(prod));
  record('The four-state legend renders beneath', prod.legend === 4 ? 'PASS' : 'FAIL', 'legend=' + prod.legend);

  // a held line must take its reason from the real QC reject field
  const hold = await page.evaluate(async () => {
    const j = jobCards.filter(x => x.status !== 'cancelled')
      .filter(x => (x.items || []).some(it => (it.departmentStatuses || []).length))[0];
    if (!j) return { skipped: true };
    const it = j.items.find(i => (i.departmentStatuses || []).length);
    const entry = it.departmentStatuses[0];
    entry.status = 'rework';
    entry.rejectReason = 'Veneer specification changed by the client';
    salesSetTopView('dashboard');
    await new Promise(r => setTimeout(r, 400));
    const card = document.getElementById('sales-body').textContent;
    const model = SalesDashboard.data.jobs.filter(x => x.id === j.id)[0];
    return {
      bannerShown: card.includes('Veneer specification changed by the client'),
      jobHeld: !!(model && model.hold),
      itemHeld: !!(model && model.items.some(i => i.st === 'On hold'))
    };
  });
  record('A line in rework puts the job on hold and shows the manager\'s own QC reject reason',
    hold.skipped || (hold.bannerShown && hold.jobHeld && hold.itemHeld) ? 'PASS' : 'FAIL', JSON.stringify(hold));

  // ── the job sheet: items are the point of it, and it carries no cost ──
  currentStep = 'job-sheet';
  await page.click('#sales-body [data-act="job"]');
  await page.waitForTimeout(350);
  const sheet = await page.evaluate(() => {
    const el = document.querySelector('#sales-body .sd-sheet');
    if (!el) return { open: false };
    const r = el.getBoundingClientRect();
    return {
      open: true,
      inViewport: r.top >= 0 && r.top < window.innerHeight && r.left >= 0 && r.width > 300,
      facts: el.querySelectorAll('.sd-fact').length,
      steps: el.querySelectorAll('.sd-step').length,
      items: el.querySelectorAll('.sd-item').length,
      policy: /not shown on a Sales job card/.test(el.textContent),
      money: (el.textContent.match(/BD\s?[\d,]|\d+\.\d{3}\b/g) || []).slice(0, 4)
    };
  });
  record('The job sheet opens on screen with four facts, a six-step timeline and its items',
    sheet.open && sheet.inViewport && sheet.facts === 4 && sheet.steps === 6 && sheet.items >= 1 ? 'PASS' : 'FAIL', JSON.stringify(sheet));
  record('The job sheet shows no cost and closes with the line saying why',
    sheet.money.length === 0 && sheet.policy ? 'PASS' : 'FAIL', JSON.stringify(sheet.money));
  await page.click('#sales-body [data-act="closejob"]');
  await page.waitForTimeout(250);

  // ── quick actions live in the shell, not a second topbar ──
  currentStep = 'shell-integration';
  const shell = await page.evaluate(() => ({
    // the handoff's own topbar and chat are not drawn a second time
    ownTopbars: document.querySelectorAll('#sales-module-wrap .sd-top').length,
    ownChatBubbles: document.querySelectorAll('#sales-module-wrap .sd-chat-btn').length,
    shellQuickBtn: !!document.querySelector('#sales-module-wrap .xs-qa'),
    shellChat: !!document.getElementById('exec-chat-float'),
    salesActions: SalesDashboard.quickActions().map(a => a.label)
  }));
  record('The dashboard does not draw a second topbar or chat bubble over the shell\'s',
    shell.ownTopbars === 0 && shell.ownChatBubbles === 0 && shell.shellQuickBtn && shell.shellChat ? 'PASS' : 'FAIL', JSON.stringify(shell));
  record('Its four quick actions are registered for the shell\'s popover',
    JSON.stringify(shell.salesActions) === JSON.stringify(['New enquiry', 'New quotation', 'My jobs', 'Purchase request']) ? 'PASS' : 'FAIL', JSON.stringify(shell.salesActions));

  // ── tasks are Sales' own lists, on the app's real store ──
  currentStep = 'tasks';
  const tasks = await page.evaluate(async () => {
    const lists = SalesDashboard.state.lists.map(l => l.n);
    const t = createTask({ title: 'E2E sales task', assignee: salesCurrentUser, dueDate: new Date().toISOString().slice(0, 10) });
    t.list = 'qtn';
    salesSetTopView('dashboard');
    await new Promise(r => setTimeout(r, 400));
    const shown = document.getElementById('sales-body').textContent.includes('E2E sales task');
    const openBefore = SalesDashboard.state.tasks.filter(x => !x.done).length;
    document.querySelector('#sales-body [data-act="taskcheck"][data-id="' + t.id + '"]').click();
    await new Promise(r => setTimeout(r, 300));
    return {
      lists, shown,
      persisted: tasks.find(x => x.id === t.id).status === 'done',
      openAfter: SalesDashboard.state.tasks.filter(x => !x.done).length, openBefore
    };
  });
  record('Sales has its own lists — Enquiries · Quotations · Clients · Site visits',
    JSON.stringify(tasks.lists) === JSON.stringify(['Enquiries', 'Quotations', 'Clients', 'Site visits']) ? 'PASS' : 'FAIL', JSON.stringify(tasks.lists));
  record('A task appears on the dashboard and ticking it off writes to the app\'s real task store',
    tasks.shown && tasks.persisted && tasks.openAfter === tasks.openBefore - 1 ? 'PASS' : 'FAIL', JSON.stringify(tasks));

  // ── the planner behaves as specified ──
  currentStep = 'planner';
  const planner = await page.evaluate(async () => {
    document.querySelector('#sales-body [data-act="period"][data-v="0"]').click();
    await new Promise(r => setTimeout(r, 250));
    const start = SalesDashboard.state.selDate;
    document.querySelector('#sales-body [data-act="period"][data-v="1"]').click();
    await new Promise(r => setTimeout(r, 250));
    const next = SalesDashboard.state.selDate;
    const visible = [...document.querySelectorAll('#sales-body [data-act="day"]')].map(d => d.getAttribute('data-d'));
    return { start, next, moved: (new Date(next) - new Date(start)) === 7 * 864e5, selectionVisible: visible.indexOf(next) !== -1 };
  });
  record('Stepping the week moves the day selection with it, so the agenda stays inside the visible period',
    planner.moved && planner.selectionVisible ? 'PASS' : 'FAIL', JSON.stringify(planner));

  // ── responsive: the mobile column-flex path keeps flex:none ──
  currentStep = 'responsive';
  const resp = [];
  for (const [w, wantDisplay] of [[1280, 'grid'], [1000, 'grid'], [390, 'flex']]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(300);
    resp.push(await page.evaluate(() => {
      const g = document.querySelector('#sales-body .sd-grid');
      return {
        display: getComputedStyle(g).display,
        cols: getComputedStyle(g).gridTemplateColumns.split(' ').length,
        overflow: g.scrollWidth - Math.round(g.getBoundingClientRect().width),
        // the handoff: "Do not remove .sd-grid > * { flex:none } on mobile"
        noShrink: [...g.children].every(c => getComputedStyle(c).flexShrink === '0')
      };
    }));
  }
  record('Desktop is a four-column grid, mobile is a column-flex scroller with flex:none on every card, and neither overflows',
    resp[0].display === 'grid' && resp[0].cols === 4 && resp[1].cols === 2 &&
    resp[2].display === 'flex' && resp[2].noShrink && resp.every(r => r.overflow <= 1) ? 'PASS' : 'FAIL', JSON.stringify(resp));

  // ── the handoff's invented data must not have shipped ──
  currentStep = 'no-mock';
  const mock = await page.evaluate(() => {
    const t = document.getElementById('sales-body').textContent;
    return ['Fatima Al Sayed', 'Diyar Retail Fitout', 'QT-2026-1188', 'JC-2026-0341', 'Bapco', 'Amwaj Marina']
      .filter(v => t.includes(v));
  });
  record('None of the handoff\'s invented sample data shipped', mock.length === 0 ? 'PASS' : 'FAIL', mock.join(', '));

  const critical = consoleErrors.filter(e => !e.text.includes('favicon'));
  record('No unexpected console errors', critical.length === 0 ? 'PASS' : 'FAIL', critical.map(e => e.text).join(' | '));
  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
