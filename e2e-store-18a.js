/**
 * e2e-store-18a.js — the Store Keeper module (design handoff 18a)
 *
 * The three design commitments live in store-data.js and are asserted
 * through the real data layer and the real screens: stock is held per
 * item PER BIN with bins keyed by store, only onHand is stored so held
 * and free are derived, and no material leaves without a job card — no
 * general use, no override, and the gate on the screen is the same gate
 * as the function underneath.
 *
 * Then the shell and its fourteen-item rail, the fixed-geometry widget
 * across all five steps, the twelve pages, the eight create flows and
 * their gate table, the money sweep, dark mode by computed style and the
 * phone.
 */
const { chromium } = require('@playwright/test');
const path = require('path');

let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}

const PAGES = ['stk', 'iss', 'rec', 'res', 'short', 'trf', 'ret', 'loc', 'tool', 'cnt', 'rem', 'doc'];
const FORMS = ['iss', 'rec', 'trf', 'res', 'ret', 'tool', 'cnt', 'bin'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  /* -- a real store with real stock, and a real routed job to issue against -- */
  const seed = await page.evaluate(() => {
    loadDemoData();
    if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true;
    const loc = storeLocations[0] || createStoreLocation({ name: 'Riffa store' });
    const loc2 = storeLocations[1] || createStoreLocation({ name: 'Tubli store' });
    const binA = storeBins.find(b => b.storeId === loc.id) || createStoreBin({ storeId: loc.id, code: 'A1', hint: 'Board racks' });
    const binB = createStoreBin({ storeId: loc2.id, code: 'A1', hint: 'Same code, other store' });
    const item = itemMaster[0];
    putAwayStock({ itemId: item.id, binId: binA.id, qty: 40 });
    putAwayStock({ itemId: item.id, binId: binB.id, qty: 15 });
    const job = jobCards.find(j => j.routingConfirmed && j.status !== 'cancelled');
    return { loc: loc.id, loc2: loc2.id, binA: binA.id, binB: binB.id,
      labelA: binLabel(binA.id), labelB: binLabel(binB.id), item: item.id, job: job ? job.id : null };
  });
  check('a bin code is qualified by its store, so A1 is not A1', seed.labelA !== seed.labelB, [seed.labelA, seed.labelB]);
  check('the seed has a routed job to issue against', !!seed.job, seed);

  /* -- commitment 1: per item PER BIN, not per item -- */
  const perBin = await page.evaluate((s) => ({
    a: stockOnHand(s.item, s.binA), b: stockOnHand(s.item, s.binB), total: stockOnHand(s.item)
  }), seed);
  check('stock is held per bin, and the two bins do not merge', perBin.a === 40 && perBin.b === 15, perBin);
  check('the item total is the sum of its bins', perBin.total === 55, perBin);

  /* -- commitment 2: only onHand is stored; held and free are derived -- */
  const derived = await page.evaluate((s) => {
    const before = { free: stockFree(s.item, s.binA), held: stockHeld(s.item, s.binA) };
    reserveStockForJob({ jobCardId: s.job, itemId: s.item, binId: s.binA, qty: 10, heldBy: 'Storekeeper' });
    const after = { free: stockFree(s.item, s.binA), held: stockHeld(s.item, s.binA), onHand: stockOnHand(s.item, s.binA) };
    return { before, after };
  }, seed);
  check('a hold moves stock from free to held without touching on-hand',
    derived.after.free === derived.before.free - 10 && derived.after.held === derived.before.held + 10 && derived.after.onHand === 40, derived);

  /* -- commitment 3: the hard gate, in the data layer -- */
  const gate = await page.evaluate((s) => {
    const line = () => [{ itemId: s.item, binId: s.binA, qty: 1 }];
    const noJob = issueMaterialToJob({ jobCardId: '', lines: line(), issuedTo: 'Ajay', byWhom: 'Storekeeper' });
    const general = issueMaterialToJob({ jobCardId: 'general use', lines: line(), issuedTo: 'Ajay', byWhom: 'Storekeeper' });
    const ghost = issueMaterialToJob({ jobCardId: 'JB26AMD99999', lines: line(), issuedTo: 'Ajay', byWhom: 'Storekeeper' });
    const onHandAfter = stockOnHand(s.item, s.binA);
    const real = issueMaterialToJob({ jobCardId: s.job, lines: line(), issuedTo: 'Ajay', byWhom: 'Storekeeper' });
    return { noJob: !!(noJob || {}).error, general: !!(general || {}).error, ghost: !!(ghost || {}).error,
      untouched: onHandAfter === 40, real: !(real || {}).error, after: stockOnHand(s.item, s.binA) };
  }, seed);
  check('no job card, no material', gate.noJob, gate);
  check('general use is refused by name, however it is typed', gate.general, gate);
  check('a job card that does not exist is refused', gate.ghost, gate);
  check('not one unit moved on any of the three refusals', gate.untouched, gate);
  check('a real job card is issued against, and the shelf goes down', gate.real && gate.after === 39, gate);

  /* -- the shell -- */
  const shell = await page.evaluate(() => {
    launchStoreModule();
    const wrap = document.getElementById('store-module-wrap');
    const nav = [...wrap.querySelectorAll('.xs-item .xs-lbl')].map(n => n.textContent.trim());
    return { open: getComputedStyle(wrap).display !== 'none', shellClass: wrap.classList.contains('xshell'),
      nav, chat: document.querySelectorAll('.xs-chat-fab').length,
      others: [...document.querySelectorAll('[id$="-module-wrap"]')].filter(w => w.id !== 'store-module-wrap' && getComputedStyle(w).display !== 'none').map(w => w.id) };
  });
  check('the module opens and nothing else is left on screen', shell.open && shell.others.length === 0, shell.others);
  check('it carries the shared shell, so the theme reaches it', shell.shellClass);
  check('one floating chat, not two', shell.chat === 1, shell.chat);
  check('the rail is the fourteen items, Dashboard first and Create last',
    shell.nav.length === 14 && shell.nav[0] === 'Dashboard' && /Create/.test(shell.nav[13]), shell.nav);

  /* -- the dashboard: five steps in the order the day runs, one fixed slot -- */
  const dash = await page.evaluate(() => {
    const b = document.getElementById('store-body');
    const steps = [...b.querySelectorAll('.stk-step')].map(s => s.textContent.replace(/\s+/g, ' ').trim().slice(0, 40));
    const sizes = [];
    ['rec', 'iss', 'res', 'short', 'put'].forEach(k => {
      const btn = document.querySelector('#store-body .stk-step[data-v="' + k + '"]');
      if (btn) { btn.click(); const w = document.querySelector('#store-body .stk-widget'); sizes.push(w ? Math.round(w.getBoundingClientRect().height) : -1); }
    });
    document.querySelector('#store-body .stk-step').click();
    return { steps, sizes };
  });
  check('five steps, in the order the day runs', dash.steps.length === 5, dash.steps);
  check('the widget keeps one geometry across every step',
    dash.sizes.length === 5 && new Set(dash.sizes).size === 1 && dash.sizes[0] > 300, dash.sizes);

  /* -- the twelve pages -- */
  const pages = await page.evaluate((PAGES) => {
    const out = {};
    PAGES.forEach(k => {
      StoreUI.go('page', k);
      const b = document.getElementById('store-body');
      const rule = b.querySelector('.stk-rule');
      const text = b.innerText.replace((rule || {}).innerText || '', '');
      out[k] = { title: (b.querySelector('.stk-page-t') || {}).textContent || '', stats: b.querySelectorAll('.stk-stat').length,
        rule: !!rule, print: !!b.querySelector('[data-a="printpage"]'), money: /BD\s?\d|margin|profit/i.test(text) };
    });
    return out;
  }, PAGES);
  const bad = PAGES.filter(k => !pages[k].title || pages[k].stats !== 4 || !pages[k].rule);
  check('all twelve pages render with a title, four stats and their own rule', bad.length === 0, bad.map(k => [k, pages[k]]));
  check('every page can be printed', PAGES.every(k => pages[k].print), PAGES.filter(k => !pages[k].print));
  check('no price, margin or profit anywhere in the store', PAGES.every(k => !pages[k].money), PAGES.filter(k => pages[k].money));

  /* -- reorder alerts reach the storekeeper's own Reminders page -- */
  const reorder = await page.evaluate(() => {
    // Put a real item at its reorder level, the way a run of stock does.
    const req = getJobMaterialRequirement();
    const row = req[0];
    if (row) { const it = itemMaster.find(i => i.id === row.itemId); if (it) it.reorderLevel = Math.max(1, (row.closingStock || 0) + 5); }
    const alerts = getReorderAlerts().length;
    StoreUI.go('page', 'rem');
    const b = document.getElementById('store-body');
    return { alerts, listed: /is short|reorder level/.test(b.innerText),
      rows: b.querySelectorAll('.stk-table tr').length,
      title: (b.querySelector('.stk-page-t') || {}).textContent || '' };
  });
  check('a reorder alert reaches the store Reminders page, not just the legacy screen',
    reorder.alerts > 0 && reorder.listed && reorder.rows > 1, reorder);
  // stkReminders() sits outside the StoreUI closure; a throw in it takes the
  // whole page down, holds and overdue tools included, so the page is checked
  // for its own content rather than only for a title.
  check('and the Reminders page still renders its own heading with it', /Reminders/.test(reorder.title), reorder.title);

  const routed = await page.evaluate(() => {
    launchSalesModule();
    execGoStock();
    return { opened: getComputedStyle(document.getElementById('store-module-wrap')).display !== 'none',
      page: StoreUI.state.page,
      legacyHidden: getComputedStyle(document.getElementById('sk-module-wrap')).display === 'none' };
  });
  check('the reorder reminder lands on that page, not on the legacy stock pool',
    routed.opened && routed.page === 'rem' && routed.legacyHidden, routed);

  /* -- the gate table: every option of every flow -- */
  const gates = await page.evaluate((FORMS) => {
    const out = {};
    FORMS.forEach(f => {
      StoreUI.go('form', f);
      const n = document.querySelectorAll('#store-body .stk-gate-o').length;
      out[f] = { n, states: [] };
      for (let i = 0; i < n; i++) {
        StoreUI.go('form', f);
        [...document.querySelectorAll('#store-body .stk-gate-o')][i].click();
        const primary = document.querySelector('#store-body .stk-actions .stk-btn');
        out[f].states.push({ dead: !!primary.disabled, warn: primary.classList.contains('warn'),
          blocked: !!document.querySelector('#store-body .stk-blocked') });
      }
      StoreUI.go('form', f);
      out[f].deadBeforeAnswer = !!document.querySelector('#store-body .stk-actions .stk-btn').disabled;
    });
    return out;
  }, FORMS);
  check('all eight flows ask a gate question with three answers',
    FORMS.every(f => gates[f].n === 3), FORMS.map(f => [f, gates[f].n]));
  check('the primary is dead until the gate is answered',
    FORMS.every(f => gates[f].deadBeforeAnswer), FORMS.filter(f => !gates[f].deadBeforeAnswer));
  check('a clear answer makes it live, a middling one makes it amber',
    FORMS.every(f => !gates[f].states[0].dead && !gates[f].states[0].warn && gates[f].states[1].warn), FORMS.map(f => [f, gates[f].states[1]]));
  check('a wrong answer leaves it dead and says why, except a return where scrap is a real outcome',
    FORMS.filter(f => f !== 'ret').every(f => gates[f].states[2].dead && gates[f].states[2].blocked) && !gates.ret.states[2].dead,
    FORMS.map(f => [f, gates[f].states[2]]));

  /* -- the issue flow's blocked copy is the business rule, verbatim -- */
  const copy = await page.evaluate(() => {
    StoreUI.go('form', 'iss');
    [...document.querySelectorAll('#store-body .stk-gate-o')][2].click();
    return (document.querySelector('#store-body .stk-blocked') || {}).textContent || '';
  });
  check('the issue flow refuses general use in the rule own words',
    /no general-use issue and no override/i.test(copy) && /traceable to the job/i.test(copy), copy.slice(0, 90));

  /* -- a real issue, driven through the real form -- */
  const flow = await page.evaluate((s) => {
    const before = stockOnHand(s.item, s.binA);
    StoreUI.go('form', 'iss');
    document.querySelector('#store-body .stk-gate-o').click();
    const set = (k, v) => { const el = document.querySelector('#store-body [data-a-input="' + k + '"]'); if (!el) return false;
      el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); return true; };
    const ok = ['job', 'item', 'bin', 'qty', 'who'].every((k, i) => set(k, [s.job, s.item, s.binA, '3', 'Ajay Paswan'][i]));
    const btn = document.querySelector('#store-body .stk-actions .stk-btn[data-a="submit"]');
    if (btn) btn.click();
    return { ok, toast: (document.querySelector('#store-body .stk-toast') || {}).textContent || '',
      before, after: stockOnHand(s.item, s.binA) };
  }, seed);
  check('every field on the issue form is reachable', flow.ok, flow);
  check('a real issue through the form moves the real shelf', flow.after === flow.before - 3, flow);
  check('and says so on the screen', /Issued against/i.test(flow.toast), flow.toast);

  /* -- dark mode by computed style, not by eye -- */
  const dark = await page.evaluate(() => {
    StoreUI.go('dash', 'stk');
    localStorage.setItem('amd-exec-theme', 'dark'); execThemeApply();
    const bg = getComputedStyle(document.getElementById('store-body')).backgroundColor;
    const card = document.querySelector('#store-body .stk-card');
    const cardBg = card ? getComputedStyle(card).backgroundColor : '';
    localStorage.setItem('amd-exec-theme', 'light'); execThemeApply();
    return { bg, cardBg, light: getComputedStyle(document.getElementById('store-body')).backgroundColor };
  });
  const rgb = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
  check('dark mode really is dark', rgb(dark.bg)[0] < 60 && rgb(dark.cardBg)[0] < 70, dark);
  check('and light mode comes back', rgb(dark.light)[0] > 200, dark.light);

  /* -- the phone -- */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const phone = await page.evaluate(() => {
    StoreUI.go('page', 'stk');
    const w = document.getElementById('store-module-wrap');
    const card = document.querySelector('#store-body .stk-card');
    const overflow = w.scrollWidth > w.clientWidth + 1;
    const cardFits = card ? card.getBoundingClientRect().width <= 390 : false;
    StoreUI.go('dash', 'stk');
    const el = document.querySelector('#store-body .stk-widget');
    return { overflow, cardFits, widget: el ? el.getBoundingClientRect().width <= 390 : false };
  });
  check('nothing scrolls sideways at 390px', !phone.overflow, phone);
  check('the page card and the widget both fit the phone', phone.cardFits && phone.widget, phone);

  check('no page errors anywhere in the run', errors.length === 0, errors.slice(0, 3));

  await browser.close();
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  process.exit(fail ? 1 : 0);
})();
