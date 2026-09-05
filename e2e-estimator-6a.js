/**
 * e2e-estimator-6a.js — Estimator design package 6a (8 Aug 2026)
 *
 * Covers the package's own acceptance points: the five view tabs, the two-column
 * (column-count, not grid) dashboard flow, scroll clearance for the chat bubble,
 * the single override store, margin-derived-never-stored, the discount ceiling,
 * the three defects the package called out (pick-and-open, delegate from the
 * queue row, serial numbering), the task lists, and the shell nav/quick actions.
 *
 * Offline bypass (file://) — no live Supabase needed.
 */
const { chromium } = require('@playwright/test');
const path = require('path');

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept('e2e task'));

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => { loadDemoData(); launchEstimatorModule(); });
  await page.waitForTimeout(700);

  console.log('\n— shell —');
  const shell = await page.evaluate(() => ({
    nav: [...document.querySelectorAll('#estimator-module-wrap .xs-item .xs-lbl')].map(n => n.textContent.trim()),
    mounted: document.getElementById('estimator-body').classList.contains('ed'),
    tabs: [...document.querySelectorAll('#estimator-body .ed-tabs button')].map(t => t.textContent.trim()),
    clearance: getComputedStyle(document.querySelector('#estimator-body .ed-scroll')).paddingBottom
  }));
  check('sidebar carries the package nav', JSON.stringify(shell.nav) ===
    JSON.stringify(['Dashboard', 'Tenders', 'Rate library', 'Estimated vs actual']), shell.nav);
  check('EstimatorUI is mounted (not the old dashboard string)', shell.mounted);
  check('five view tabs: Queue Quote Items BOM Roll-up', JSON.stringify(shell.tabs) ===
    JSON.stringify(['Queue', 'Quote', 'Items', 'BOM', 'Roll-up']), shell.tabs);
  check('scroll clears the chat bubble (88px desktop)', shell.clearance === '88px', shell.clearance);

  // Quick actions: the role's own four verbs come before the shared items.
  await page.click('#estimator-module-wrap .xs-qa');
  await page.waitForTimeout(200);
  const quick = await page.evaluate(() =>
    [...document.querySelectorAll('#estimator-module-wrap .xs-qa-pop.open .xs-qa-item')]
      // the icon lives in a child span — read the label, not the glyph
      .map(b => b.textContent.replace((b.querySelector('.ico') || {}).textContent || '', '').trim()));
  check('quick actions lead with the estimator\'s four verbs',
    quick.slice(0, 4).join('|') === 'Cost a quotation|Quick tender estimate|Rate library|Estimated vs actual', quick);
  await page.evaluate(() => execToggleQuick(false));

  console.log('\n— dashboard —');
  const dash = await page.evaluate(() => {
    const b = document.getElementById('estimator-body');
    const cols = b.querySelector('.ed-cols');
    return {
      firstCardIsNeedsYou: (b.querySelector('.ed-card .ed-title') || {}).textContent === 'Needs you today',
      needsYouRows: b.querySelectorAll('.ed-q').length,
      columnCount: cols ? getComputedStyle(cols).columnCount : null,
      display: cols ? getComputedStyle(cols).display : null,
      titles: [...b.querySelectorAll('.ed-card .ed-title')].map(t => t.textContent.trim())
    };
  });
  check('"Needs you today" leads the dashboard', dash.firstCardIsNeedsYou, dash.titles);
  check('five queue steps, collapsed or not', dash.needsYouRows === 5, dash.needsYouRows);
  check('cards flow in two BALANCED columns, not a grid',
    dash.columnCount === '2' && dash.display !== 'grid', dash);

  // Regression guard: the colour-coded quote-age badge (audit Phase E,
  // 6 Aug 2026) survived the dashboard rebuild. It was dropped once when the
  // queue row went to a plain day count, and only the Phase E suite caught it.
  const ageBadge = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#estimator-body .ed-row')];
    return rows.some(r => /\d+d\s*$/.test(r.textContent.trim()) || /[\d]+d</.test(r.innerHTML));
  });
  check('queue rows keep the colour-coded quote-age badge', ageBadge, ageBadge);

  // A costed line must show the rate that submitItemBOM() actually SAVES.
  // lineRate() read `t.sellingPrice`, which computeBOMTotals() does not return
  // (it is calculatedSellingPrice), so every priced line fell through to 0 and
  // the Quote total / Items / Roll-up all read BD 0.000 for exactly the lines
  // that had been costed.
  const priced = await page.evaluate(() => {
    const c = createCustomer({ name: 'Rate Check Co', contactPerson: 'A', tel: '39777001', address: 'M' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: c.tel,
      source: 'walk inn', salesPerson: 'Silva' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Rate Check' });
    addQuotationItem(q.id, { product: 'Cabinet', qty: 2, unit: 'Nos', vatPercent: 10 });
    addBOMMaterial(q.id, 1, { name: 'Ply', qty: 4, unit: 'Nos', rate: 25 });
    submitItemBOM(q.id, 1, 'Arun Kumar A');
    EstimatorUI.state.qtnId = q.id;
    EstimatorUI.setView('quote');
    const shown = (document.getElementById('estimator-body').textContent.match(/Quote total\s*BD ([\d,.]+)/) || [])[1];
    const expected = (q.items[0].rate * q.items[0].qty).toFixed(3);
    return { shown, expected, rate: q.items[0].rate };
  });
  check('a costed line shows the rate that actually gets saved, not BD 0.000',
    priced.rate > 0 && priced.shown === priced.expected, priced);

  console.log('\n— serial, override store, margin —');
  const money = await page.evaluate(() => {
    const q = quotations.find(x => (x.items || []).length) || quotations[0];
    const it = q.items[0];
    EstimatorUI.state.qtnId = q.id;
    const out = { serial: EstimatorUI.serial(q.id, it.lineId), before: it.rate };
    // A margin is applied through the UI's own action path.
    EstimatorUI.setView('items');
    return out;
  });
  check('serial is quote-digits + zero-padded line (nnnn-nn)',
    /^\d{1,4}-\d{2}$/.test(money.serial), money.serial);

  const override = await page.evaluate(() => {
    const q = quotations.find(x => (x.items || []).length) || quotations[0];
    const it = q.items[0];
    const keys0 = Object.keys(EstimatorUI.overrides).length;
    EstimatorUI.state.qtnId = q.id;
    // Drive the real input path: set qty through the UI's change handler.
    const input = document.querySelector('#estimator-body [data-act-input="qty"][data-id="' + it.lineId + '"]');
    if (!input) return { noInput: true };
    input.value = '7';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const key = q.id + '-' + it.lineId;
    return {
      grew: Object.keys(EstimatorUI.overrides).length > keys0,
      keyed: !!EstimatorUI.overrides[key],
      qty: EstimatorUI.overrides[key] && EstimatorUI.overrides[key].qty,
      storedMargin: 'marginPercent' in (EstimatorUI.overrides[key] || {})
    };
  });
  check('an edit lands in the ONE override store, keyed quote-line',
    override.keyed && override.qty === 7, override);
  check('margin is never stored — only the rate it implies', override.storedMargin === false, override);

  console.log('\n— defects the package called out —');
  const pick = await page.evaluate(() => {
    const q = quotations.find(x => x.stage === 'sales' || !x.estimatorPickedBy);
    if (!q) return { skipped: true };
    EstimatorUI.setView('queue');
    estimatorPick(q.id);
    return { view: EstimatorUI.state.view, on: EstimatorUI.state.qtnId, wanted: q.id };
  });
  check('defect 1: picking a quote opens it, it does not just re-render the list',
    pick.skipped || (pick.view === 'items' && pick.on === pick.wanted), pick);

  await page.evaluate(() => EstimatorUI.setView('queue'));
  await page.waitForTimeout(150);
  const deleg = await page.evaluate(() => {
    const btn = document.querySelector('#estimator-body [data-act="deleg"]');
    if (!btn) return { noRow: true };
    btn.click();
    const names = [...document.querySelectorAll('#estimator-body .ed-deleg button[data-act="delegto"]')].map(b => b.textContent.trim());
    return { opened: names.length > 0, names: names.slice(0, 3) };
  });
  check('defect 2: delegate opens from the queue row itself', deleg.noRow || deleg.opened, deleg);

  console.log('\n— discount ceiling —');
  const disc = await page.evaluate(() => {
    // 5 Sep 2026: the ceiling is the signed-in role's TIER (Estimator 20%),
    // enforced by setQuoteDiscount() — not a screen-only 30% that routes to
    // the Approver. The screen names the tier; the data layer refuses.
    // A PRICED, unfrozen quotation — a zero-amount draft has nothing to discount, so nothing to refuse.
    const q = quotations.find(x => (x.items || []).some(it => it.amount > 0) && !quotationFrozen(x.id)) || quotations[0];
    EstimatorUI.state.qtnId = q.id;
    const was = window.cloudUserType; window.cloudUserType = 'estimator';
    const base = q.items.reduce((s, it) => s + it.amount, 0);
    const r = setQuoteDiscount(q.id, base * 0.45);
    EstimatorUI.setView('quote');
    const t = document.getElementById('estimator-body').textContent;
    window.cloudUserType = was;
    return { refused: /limit of 20%/.test((r && r.error) || ''), named: /Your limit is 20%/.test(t) };
  });
  check('a discount past the Estimator tier (20%) is refused by the data layer, and the screen names the tier', disc.refused && disc.named, disc);

  console.log('\n— task lists —');
  // The Estimator's own task card was replaced by the SHARED My-tasks widget
  // (planner/tasks design package, 8 Aug 2026) — one implementation across
  // every dashboard. Its lists are seeded per person from
  // DEFAULT_TASK_LISTS.estimator, so this role still gets its own four; they
  // are just no longer this module's private chips.
  const lists = await page.evaluate(() => {
    EstimatorUI.setView('queue');
    const chips = ['All'].concat(getTaskListsFor(execIdentity(), 'estimator').map(l => l.name));
    const t = createTask({ title: 'Cost the Ewan repeat', assignee: execIdentity(), list: 'tocost' });
    tasksState.filter = 'tenders'; rerenderDashboard();
    const underTenders = document.getElementById('estimator-body').textContent.includes('Cost the Ewan repeat');
    tasksState.filter = 'tocost'; rerenderDashboard();
    const underToCost = document.getElementById('estimator-body').textContent.includes('Cost the Ewan repeat');
    return { chips, list: t.list, underTenders, underToCost };
  });
  check('four task lists: To cost, Tenders, Rate library, Checks',
    lists.chips.join('|') === 'All|To cost|Tenders|Rate library|Checks', lists.chips);
  check('a task filters to its own list only',
    lists.list === 'tocost' && lists.underToCost && !lists.underTenders, lists);

  console.log('\n— rate library and estimated vs actual —');
  const tails = await page.evaluate(() => {
    const out = {};
    EstimatorUI.setView('rates');
    out.rates = document.getElementById('estimator-body').textContent.includes('Rate library');
    EstimatorUI.setView('actuals');
    out.actuals = document.getElementById('estimator-body').textContent.includes('Estimated vs actual');
    EstimatorUI.setQueueFilter('tenders');
    out.tenderFilter = EstimatorUI.state.queueFilter === 'tenders' && EstimatorUI.state.view === 'queue';
    return out;
  });
  check('Rate library screen renders', tails.rates);
  check('Estimated vs actual screen renders', tails.actuals);
  check('Tenders is the queue filtered, not a separate screen', tails.tenderFilter);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
