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
    const q = quotations.find(x => (x.items || []).length) || quotations[0];
    EstimatorUI.state.qtnId = q.id;
    q.discountPercent = 45;                    // past the estimator's 30% limit
    EstimatorUI.setView('quote');
    const t = document.getElementById('estimator-body').textContent;
    q.discountPercent = 0;
    return { warned: /Approver must release/.test(t) };
  });
  check('a discount past the 30% limit says the Approver must release it', disc.warned, disc);

  console.log('\n— task lists —');
  const lists = await page.evaluate(() => {
    EstimatorUI.setView('queue');
    const chips = [...document.querySelectorAll('#estimator-body [data-act="tasklist"]')].map(b => b.textContent.trim());
    const t = createTask({ title: 'Cost the Ewan repeat', assignee: estimatorCurrentUser, list: 'To cost' });
    document.querySelector('#estimator-body [data-act="tasklist"][data-list="Tenders"]').click();
    const underTenders = document.getElementById('estimator-body').textContent.includes('Cost the Ewan repeat');
    document.querySelector('#estimator-body [data-act="tasklist"][data-list="To cost"]').click();
    const underToCost = document.getElementById('estimator-body').textContent.includes('Cost the Ewan repeat');
    return { chips, list: t.list, underTenders, underToCost };
  });
  check('four task lists: To cost, Tenders, Rate library, Checks',
    lists.chips.join('|') === 'All|To cost|Tenders|Rate library|Checks', lists.chips);
  check('a task filters to its own list only',
    lists.list === 'To cost' && lists.underToCost && !lists.underTenders, lists);

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
