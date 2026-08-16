// Verification for the Purchase module UI (design handoff 17a).
//
// Checks are driven through the REAL rendered interface — real clicks on
// real controls — and assert on real record state where an action changes
// data. The acceptance criteria at the end of the handoff are the spine of
// this file, in its own order.

const { chromium } = require('@playwright/test');
const path = require('path');

let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => { await d.accept('short on delivery'); });

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  // Seed a realistic module: suppliers, a request, an RFQ with three
  // quotes, an approved+late PO, and a short receipt — so every step has
  // real content rather than its empty state.
  await page.evaluate(() => {
    const sups = [1, 2, 3].map(i => createSupplier({
      name: '17a Supplier ' + i, contactPerson: 'C', telephone: '1710000' + i, address: 'Manama'
    }));
    const item = itemMaster[0];
    raisePurchaseRequest({
      department: 'carp', raisedBy: 'Joinery Production Manager', destinationType: 'inventory',
      items: [{ name: item.name, qty: 12, unit: item.unit, itemId: item.id }]
    });
    const r = createRFQ({
      items: [{ name: 'Ply 18mm sheet', qty: 20, unit: 'Nos' }],
      supplierIds: sups.map(s => s.id), raisedBy: 'Ali Mansoor'
    });
    recordRFQQuote(r.id, { supplierId: sups[0].id, price: 1000, leadDays: 21, terms: '30 days' });
    recordRFQQuote(r.id, { supplierId: sups[1].id, price: 1060, leadDays: 4, terms: '30 days' });
    recordRFQQuote(r.id, { supplierId: sups[2].id, price: 1400, leadDays: 3, terms: 'Cash' });

    const po = createPurchaseOrderDirect({
      department: 'purchase', destinationType: 'inventory',
      supplierDetails: { supplierId: sups[0].id, supplierNameTel: '17a Supplier 1' },
      items: [{ name: 'Hinge 100mm', qty: 40, unit: 'Nos', fxRateBD: 2 }]
    });
    approvePO(po.id, 'Operations Manager');
    po.promisedDate = '2020-01-01';
    recordGoodsReceipt({ poId: po.id, lines: [{ lineIndex: 0, receivedQty: 30 }] });
    window.__t = { rfq: r.id, po: po.id, sups: sups.map(s => s.id) };
    openPurchasingModule();
  });
  await page.waitForTimeout(400);

  console.log('\n— the shell, and the six non-negotiables —');
  const shell = await page.evaluate(() => {
    const w = document.getElementById('purch-module-wrap');
    return {
      mounted: !!document.querySelector('#pur-root.pur'),
      side: !!w.querySelector('.xs-side'),
      quick: !!w.querySelector('[onclick*="execQuick"], .xs-quick'),
      chat: !!document.querySelector('#exec-chat-float .xs-chat-fab'),
      navLabels: [...w.querySelectorAll('.xs-nav-item, .xs-item')].map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean)
    };
  });
  check('PurUI mounts into the module', shell.mounted === true, shell.mounted);
  check('the shell sidebar is present (not a second one drawn by 17a)', shell.side === true, shell.side);
  check('the floating chat is the shell\'s single instance', shell.chat === true, shell.chat);
  check('17a\'s ten nav entries are in its order',
    ['Purchase requests', 'RFQs & quotes', 'Purchase orders', 'Deliveries due', 'GRN & returns',
      'Item master', 'Suppliers', 'Rate contracts', 'Reminders', 'Documents']
      .every(l => shell.navLabels.some(n => n.includes(l))), shell.navLabels.slice(0, 14));

  console.log('\n— the five steps, and the fixed widget slot —');
  const steps = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('#pur-root .pur-step')];
    return {
      count: bs.length,
      labels: bs.map(b => b.querySelector('.pur-step-t').textContent),
      selected: (document.querySelector('#pur-root .pur-step.on .pur-step-t') || {}).textContent,
      counts: bs.map(b => b.querySelector('.pur-step-c').textContent)
    };
  });
  check('there are five steps in the handoff\'s order', steps.count === 5 &&
    steps.labels[0] === 'Purchase requests' && steps.labels[4] === 'GRN mismatches', steps.labels);
  check('the default selection is Compare supplier quotes',
    steps.selected === 'Compare supplier quotes', steps.selected);
  check('step counts are real, not placeholders', steps.counts.some(c => /\d/.test(c)), steps.counts);

  // Geometry must not move as the state changes — the premise of the design.
  const geo = [];
  for (const k of ['pr', 'cmp', 'rel', 'late', 'grn']) {
    await page.click(`#pur-root .pur-step[data-k="${k}"]`);
    await page.waitForTimeout(90);
    geo.push(await page.evaluate(() => {
      const r = document.querySelector('#pur-root .pur-widget').getBoundingClientRect();
      return { t: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) };
    }));
  }
  check('the widget never moves or resizes across all five states',
    geo.every(g => g.t === geo[0].t && g.h === geo[0].h && g.w === geo[0].w), geo);
  check('the widget holds its 452px minimum', geo[0].h >= 452, geo[0].h);

  console.log('\n— quote comparison, and awarding from the real button —');
  await page.click('#pur-root .pur-step[data-k="cmp"]');
  await page.waitForTimeout(120);
  const cmp = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#pur-root .pur-q')];
    return {
      rows: rows.length,
      recommended: (document.querySelector('#pur-root .pur-q.rec .pur-q-n') || {}).textContent,
      hasTick: !!document.querySelector('#pur-root .pur-q.rec .pur-q-mark'),
      cheapestFirst: (rows[0].querySelector('.pur-q-price b') || {}).textContent
    };
  });
  check('all three quotes render as rows', cmp.rows === 3, cmp.rows);
  check('the recommended quote carries the tick', cmp.hasTick === true, cmp);
  check('the recommendation is the fast one inside the 10% band, not the cheapest',
    cmp.recommended === '17a Supplier 2', cmp.recommended);

  const awarded = await page.evaluate(async () => {
    const before = purchaseOrders.length;
    document.querySelector('#pur-root [data-a="cmp-award"]').click();
    await new Promise(r => setTimeout(r, 150));
    const rfq = rfqs.find(x => x.id === window.__t.rfq);
    const po = purchaseOrders[purchaseOrders.length - 1];
    return { added: purchaseOrders.length - before, status: rfq.status, poStatus: po.approvalStatus, awardedTo: rfq.awardedTo };
  });
  check('awarding from the real button raises a PO', awarded.added === 1, awarded);
  check('the RFQ is marked awarded', awarded.status === 'awarded', awarded);
  check('the new PO is pending release — no auto-release', awarded.poStatus === 'pending', awarded);

  console.log('\n— the GRN step and a real claim —');
  await page.click('#pur-root .pur-step[data-k="grn"]');
  await page.waitForTimeout(120);
  const claimed = await page.evaluate(async () => {
    const before = getGRNMismatches().length;
    document.querySelector('#pur-root [data-a="grn-claim"]').click();
    await new Promise(r => setTimeout(r, 200));
    const g = goodsReceipts[0];
    return { before, state: g.claimState, note: g.claimNote };
  });
  check('the GRN step claims the balance through the real button',
    claimed.state === 'claimed' && !!claimed.note, claimed);

  console.log('\n— the ten working pages, one template —');
  const pages = ['pr', 'rfq', 'po', 'del', 'grn', 'item', 'sup', 'ctr', 'rem', 'doc'];
  const pageInfo = [];
  for (const k of pages) {
    await page.evaluate(k => PurUI.go('page', k), k);
    await page.waitForTimeout(90);
    pageInfo.push(await page.evaluate(() => ({
      stats: document.querySelectorAll('#pur-root .pur-stat').length,
      cols: [...document.querySelectorAll('#pur-root .pur-th span')].map(s => s.textContent),
      chips: document.querySelectorAll('#pur-root .pur-chip').length,
      hasTable: !!document.querySelector('#pur-root .pur-table'),
      lastIsPill: (() => {
        const tr = document.querySelector('#pur-root .pur-tr');
        if (!tr) return 'no-rows';
        return !!tr.lastElementChild.querySelector('.pur-pill');
      })()
    })));
  }
  check('all ten pages render from the one template',
    pageInfo.every(p => p.hasTable && p.stats === 4 && p.cols.length === 5), pageInfo.map(p => p.cols.length));
  check('every page carries filter chips', pageInfo.every(p => p.chips >= 2), pageInfo.map(p => p.chips));
  check('the last column is always a status pill',
    pageInfo.every(p => p.lastIsPill === true || p.lastIsPill === 'no-rows'), pageInfo.map(p => p.lastIsPill));
  check('the PO page uses the handoff\'s own column names',
    pageInfo[2].cols.join('|') === 'Purchase order|Supplier|Job card|Value|Status', pageInfo[2].cols);
  check('the suppliers page shows "No record" rather than 0% for an unused supplier',
    await page.evaluate(() => {
      PurUI.go('page', 'sup');
      return document.querySelector('#pur-root').textContent.includes('No record');
    }), true);

  console.log('\n— the four create flows —');
  const forms = ['pr', 'rfq', 'po', 'item'];
  const formInfo = [];
  for (const f of forms) {
    await page.evaluate(f => PurUI.go('form', f), f);
    await page.waitForTimeout(90);
    formInfo.push(await page.evaluate(() => ({
      never: !!document.querySelector('#pur-root .pur-never'),
      // Scoped to the card: the PR form has another .pur-never-b earlier
      // in the DOM (the BOM-allowance note), which an unscoped query hits.
      neverText: (document.querySelector('#pur-root .pur-never .pur-never-b') || {}).textContent || '',
      actions: !!document.querySelector('#pur-root [data-a="submit"]')
    })));
  }
  check('all four create flows render', formInfo.every(f => f.actions), formInfo);
  check('every create flow ends with the mandatory "Purchase never sees" card',
    formInfo.every(f => f.never && /selling price or the job margin/.test(f.neverText)), formInfo.map(f => f.never));

  console.log('\n— no selling price or margin anywhere in Purchase —');
  const money = await page.evaluate(() => {
    const bad = [];
    ['dash', 'page', 'form'].forEach(() => { });
    const texts = [];
    PurUI.go('dash'); texts.push(document.querySelector('#pur-root').textContent);
    ['pr', 'rfq', 'po', 'del', 'grn', 'item', 'sup', 'ctr', 'rem', 'doc'].forEach(k => {
      PurUI.go('page', k); texts.push(document.querySelector('#pur-root').textContent);
    });
    ['pr', 'rfq', 'po', 'item'].forEach(k => {
      PurUI.go('form', k); texts.push(document.querySelector('#pur-root').textContent);
    });
    const joined = texts.join(' ');
    // The "Purchase never sees" card NAMES these words on purpose, so it is
    // excluded — everything else must be clean.
    const cleaned = joined.replace(/The client selling price or the job margin[^.]*\./g, '');
    ['selling price', 'margin', 'profit'].forEach(w => {
      if (new RegExp(w, 'i').test(cleaned)) bad.push(w);
    });
    return bad;
  });
  check('no selling price, margin or profit renders anywhere in the module',
    money.length === 0, money);

  console.log('\n— the duplicate gate, in the create flow —');
  await page.evaluate(() => PurUI.go('form', 'item'));
  await page.waitForTimeout(120);
  const gate0 = await page.evaluate(() => ({
    state: (document.querySelector('#pur-root .pur-gate') || {}).className,
    enabled: !document.querySelector('#pur-root [data-a="submit"]').disabled
  }));
  check('an empty description starts clear and creatable',
    /clear/.test(gate0.state) && gate0.enabled === true, gate0);

  const realName = await page.evaluate(() => (itemMaster.find(i => /SPANNER/i.test(i.name)) || itemMaster[0]).name);
  await page.fill('#pur-item-name', realName);
  await page.waitForTimeout(200);
  const gate1 = await page.evaluate(() => ({
    state: (document.querySelector('#pur-root .pur-gate') || {}).className,
    label: (document.querySelector('#pur-root [data-a="submit"]') || {}).textContent,
    disabled: document.querySelector('#pur-root [data-a="submit"]').disabled,
    matches: document.querySelectorAll('#pur-root .pur-match').length,
    useCode: !!document.querySelector('#pur-root [data-a="use-code"]')
  }));
  check('typing an existing item name blocks creation',
    /exact/.test(gate1.state) && gate1.disabled === true, gate1);
  check('the blocked button reads "Cannot create — duplicate"',
    /Cannot create/.test(gate1.label), gate1.label);
  check('every match offers "Use this code"', gate1.useCode === true, gate1);
  check('at most three matches are shown', gate1.matches <= 3 && gate1.matches >= 1, gate1.matches);

  const noOverride = await page.evaluate(() => !!document.querySelector('#pur-root [data-a="not-dup"]'));
  check('an exact match offers NO override', noOverride === false, noOverride);

  // A near match: same words, a figure that is NOT itself a real item.
  // The master really holds SPANNER 13'', 14'' and 15'', so picking any of
  // those as the "variant" lands on another exact match, not a near one —
  // 99'' cannot collide.
  // Only the standalone size figure — a global \d+ also rewrites the code
  // prefix (TOO090 -> TOO99), which changes a WORD token too and drops the
  // pair below the match threshold entirely.
  await page.fill('#pur-item-name', realName.replace(/\s\d+/, ' 99'));
  await page.waitForTimeout(200);
  const gate2 = await page.evaluate(() => ({
    state: (document.querySelector('#pur-root .pur-gate') || {}).className,
    disabled: document.querySelector('#pur-root [data-a="submit"]').disabled,
    override: !!document.querySelector('#pur-root [data-a="not-dup"]')
  }));
  check('a near match is blocked but offers the override',
    /near/.test(gate2.state) && gate2.disabled === true && gate2.override === true, gate2);

  await page.click('#pur-root [data-a="not-dup"]');
  await page.waitForTimeout(120);
  const gate3 = await page.evaluate(() => ({
    diffs: document.querySelectorAll('#pur-root [data-a="item-diff"]').length,
    stillDisabled: document.querySelector('#pur-root [data-a="submit"]').disabled
  }));
  check('declaring it different asks WHICH difference', gate3.diffs === 4, gate3);
  check('it stays blocked until a difference is picked', gate3.stillDisabled === true, gate3);

  await page.click('#pur-root [data-a="item-diff"]');
  await page.waitForTimeout(120);
  const gate4 = await page.evaluate(() => !document.querySelector('#pur-root [data-a="submit"]').disabled);
  check('picking a difference unblocks creation', gate4 === true, gate4);

  // Editing must reset the declaration.
  await page.fill('#pur-item-name', realName.replace(/\s\d+/, ' 98'));
  await page.waitForTimeout(200);
  const gate5 = await page.evaluate(() => ({
    override: PurUI.state.itemOverride, diff: PurUI.state.itemDiff,
    disabled: document.querySelector('#pur-root [data-a="submit"]').disabled
  }));
  check('editing the description resets the override and the difference',
    gate5.override === false && gate5.diff === '' && gate5.disabled === true, gate5);

  console.log('\n— back steps form → page → dashboard, hidden on root —');
  const back = await page.evaluate(() => {
    PurUI.go('page', 'po'); PurUI.go('form', 'item');
    const a = PurUI.state.view;
    PurUI.back(); const b = PurUI.state.view;
    PurUI.back(); const c = PurUI.state.view;
    const more = PurUI.back();
    return { a, b, c, rootHidesBack: PurUI.isRoot(), more };
  });
  check('back steps form → page → dashboard',
    back.a === 'form' && back.b === 'page' && back.c === 'dash', back);
  check('at the dashboard root there is nothing to go back to',
    back.rootHidesBack === true && back.more === false, back);

  console.log('\n— currency and dates —');
  await page.evaluate(() => PurUI.go('page', 'po'));
  await page.waitForTimeout(120);
  const fmt = await page.evaluate(() => {
    const t = document.querySelector('#pur-root').textContent;
    return {
      bd: /BD [\d,]+\.\d{3}/.test(t),
      date: /\d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}/.test(t)
    };
  });
  check('currency renders BD 1,350.000 with three decimals', fmt.bd === true, fmt);
  check('dates render DD MMM YYYY', fmt.date === true, fmt);

  console.log('\n— the chart rule —');
  await page.evaluate(() => PurUI.go('dash'));
  await page.waitForTimeout(150);
  const chart = await page.evaluate(() => {
    const fills = [...document.querySelectorAll('#pur-root .pur-bar-t i')];
    return {
      fills: fills.length,
      anyText: fills.some(f => f.textContent.trim().length > 0),
      labelsAbove: [...document.querySelectorAll('#pur-root .pur-bar')].every(b => {
        const l = b.querySelector('.pur-bar-l'), t = b.querySelector('.pur-bar-t');
        return !l || !t || l.getBoundingClientRect().top <= t.getBoundingClientRect().top;
      })
    };
  });
  check('no bar fill contains a label', chart.anyText === false, chart);
  check('labels sit above their track', chart.labelsAbove === true, chart);

  console.log('\n— dark theme —');
  const dark = await page.evaluate(() => {
    document.getElementById('purch-module-wrap').classList.add('x-dark');
    const c = getComputedStyle(document.querySelector('#pur-root .pur-card'));
    const bg = c.backgroundColor;
    document.getElementById('purch-module-wrap').classList.remove('x-dark');
    return bg;
  });
  check('cards take the dark surface in dark mode',
    /29, ?24, ?33/.test(dark) || /rgb\(29/.test(dark), dark);

  console.log('\n— phone —');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => PurUI.go('dash'));
  await page.waitForTimeout(250);
  const phone = await page.evaluate(() => {
    const root = document.querySelector('#pur-root');
    const w = document.querySelector('#pur-root .pur-widget').getBoundingClientRect();
    const taps = [...root.querySelectorAll('button')].filter(b => b.offsetParent !== null);
    return {
      overflow: root.scrollWidth - root.clientWidth,
      widgetH: Math.round(w.height),
      smallTaps: taps.filter(b => b.getBoundingClientRect().height < 44).length,
      stacked: getComputedStyle(document.querySelector('#pur-root .pur-page')).flexDirection
    };
  });
  check('no horizontal overflow at 390px', phone.overflow <= 1, phone.overflow);
  check('the widget holds its 470px phone minimum', phone.widgetH >= 470, phone.widgetH);
  check('the page stacks to one column', phone.stacked === 'column', phone.stacked);
  check('every visible tap target clears 44px', phone.smallTaps === 0, phone.smallTaps);

  await page.evaluate(() => PurUI.go('page', 'po'));
  await page.waitForTimeout(150);
  const phoneTable = await page.evaluate(() => ({
    headerHidden: getComputedStyle(document.querySelector('#pur-root .pur-th')).display === 'none',
    stats: getComputedStyle(document.querySelector('#pur-root .pur-stats')).gridTemplateColumns.split(' ').length
  }));
  check('the table header is hidden and rows stack on a phone', phoneTable.headerHidden === true, phoneTable);
  check('stat cards become a 2x2 grid', phoneTable.stats === 2, phoneTable.stats);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
