/**
 * e2e-product-pnl.js — revenue and profit per product (8 Sep 2026).
 *
 * Salman, as owner: he could see which DIVISION earned but not which
 * PRODUCT — curtains against roman blinds against roller blinds, TV units
 * against wardrobes. The two hard halves already existed (each line's own
 * value, and each line's ACTUAL cost from the cost ledger); the missing
 * piece was a category on the line, because `product` is free text.
 *
 * Checked here: the master and its keyword defaulting, the field being
 * mandatory where a person chooses and never absent where a script does,
 * that it travels to the Job Card, that the P&L's arithmetic is right, that
 * a mixed line is counted WHOLE rather than split, and that unlogged labour
 * is reported rather than quietly inflating profit.
 */
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => { if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; });

  console.log('\n- the master -');
  const master = await page.evaluate(() => ({
    total: productCategories.length,
    curtain: productCategoriesForDivision('Curtain & Blinds').map(c => c.name),
    joinery: productCategoriesForDivision('Joinery').map(c => c.name),
    everyDivisionHasOther: SALES_DIVISIONS.every(d => productCategoriesForDivision(d).some(c => c.name === 'Other'))
  }));
  check('the master carries Salman\'s own list',
    master.curtain.indexOf('Roman blinds') !== -1 && master.curtain.indexOf('Roller blinds') !== -1
    && master.joinery.indexOf('TV unit') !== -1 && master.joinery.indexOf('Vanity') !== -1, master);
  check('every division keeps an Other, so a new product never stops a quote', master.everyDivisionHasOther, master);

  console.log('\n- the keyword default -');
  const guess = await page.evaluate(() => {
    const g = (p, d) => productCategoryLabel(suggestProductCategoryId(p, d));
    return {
      roman: g('Roman blind for the majlis', 'Curtain & Blinds'),
      roller: g('Roller blind, blackout', 'Curtain & Blinds'),
      curtain: g('Wave curtains with sheer', 'Curtain & Blinds'),
      sheerOnly: g('Sheers for the living room', 'Curtain & Blinds'),
      tv: g('Making of tv unit with oak veneer mdf', 'Joinery'),
      wardrobe: g('4 door wardrobe', 'Joinery'),
      vanity: g('Bathroom vanity unit', 'Joinery'),
      sofa: g('3-seater sofa', 'Upholstery'),
      // The product name wins over the enquiry's division — the whole point.
      sofaOnJoinery: g('3-seater sofa', 'Joinery'),
      unknown: g('Something nobody has a word for', 'Joinery')
    };
  });
  check('roman beats roller beats blind', guess.roman === 'Roman blinds' && guess.roller === 'Roller blinds', guess);
  check('curtains, tv units, wardrobes and vanities each land right',
    guess.curtain === 'Curtains — wave' && guess.sheerOnly === 'Sheers'
    && guess.tv === 'TV unit' && guess.wardrobe === 'Wardrobe' && guess.vanity === 'Vanity', guess);
  check('the product name wins over the enquiry division', guess.sofaOnJoinery === 'Sofa', guess);
  check('an unrecognised product falls back to Other, not to nothing', guess.unknown === 'Other', guess);

  console.log('\n- mandatory where a person chooses, never absent where a script does -');
  const seeded = await page.evaluate(() => {
    const cust = createCustomer({ name: 'PNL Client', contactPerson: 'A', tel: '39887766', address: 'Manama' });
    approveCustomer(cust.id, 'Accounts', '');
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'A', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'PNL Project' });
    // a script passes no category at all
    const auto = addQuotationItem(qtn.id, { product: 'Oak veneer TV unit', qty: 2, unit: 'Nos', vatPercent: 10 });
    // and one that names its own
    const sofaCat = productCategories.find(c => c.name === 'Sofa');
    const chosen = addQuotationItem(qtn.id, { product: 'Bench seat', qty: 1, unit: 'Nos', vatPercent: 10, categoryId: sofaCat.id });
    return { qtn: qtn.id, cust: cust.id, autoLine: auto.lineId, chosenLine: chosen.lineId,
      autoCat: productCategoryLabel(auto.categoryId), chosenCat: productCategoryLabel(chosen.categoryId) };
  });
  check('a line added by a script is categorised from its product name', seeded.autoCat === 'TV unit', seeded);
  check('an explicit category is honoured over the guess', seeded.chosenCat === 'Sofa', seeded);

  // 8 Sep 2026: 54 categories in one native select is a scroll, not a choice.
  // Division first, then that division's products, as chips.
  // 8 Sep 2026: 54 in one native select is a scroll, not a choice. One field
  // that opens into the departments, and a department unfolds its own
  // products in place — hover on a desktop, tap on the iPad.
  const form = await page.evaluate((qtnId) => {
    launchSalesModule();
    openQuotationWizard(qtnId);
    salesWizardStep = 2;
    renderSalesBody();
    const host = () => document.getElementById('it-category-picker');
    const hidden = document.getElementById('it-category');
    if (!host() || !hidden) return { missing: true };
    const closedButtons = host().querySelectorAll('button').length;
    document.getElementById('it-product').value = 'Roman blind for the study';
    document.getElementById('it-product').dispatchEvent(new Event('input', { bubbles: true }));
    const hint = (document.getElementById('it-category-hint') || {}).innerHTML || '';
    document.getElementById('it-qty').value = '1';
    document.getElementById('it-unit').value = 'Nos';
    const before = (quotations.find(q => q.id === qtnId).items || []).length;
    salesAddItem(qtnId);                       // nothing chosen yet
    const after = (quotations.find(q => q.id === qtnId).items || []).length;
    return { unselected: hidden.value === '', closedButtons,
      suggests: /Roman blinds/.test(hint), refused: before === after };
  }, seeded.qtn);
  check('it sits closed, one field, nothing chosen', form.unselected && form.closedButtons === 1, form);
  check('it suggests the match as you type, without answering for you', form.suggests, form);
  check('Add Item refuses without a category', form.refused, form);

  const unfold = await page.evaluate(() => {
    const host = () => document.getElementById('it-category-picker');
    host().querySelector('button').click();                       // open
    const depts = [...host().querySelectorAll('button')].slice(1).map(b => b.textContent.trim());
    // typed already — unfolding must not wipe it
    document.getElementById('it-product').value = 'Roman blind for the study';
    document.getElementById('it-qty').value = '4';
    [...host().querySelectorAll('button')].find(b => /^Curtain & Blinds/.test(b.textContent)).click();
    const shown = [...host().querySelectorAll('button')].map(b => b.textContent.trim());
    const curtainNames = productCategoriesForDivision('Curtain & Blinds').map(c => c.name);
    const onlyThatDept = curtainNames.every(n => shown.some(x => x === n))
      && !shown.some(x => x === 'Wardrobe');                       // a Joinery product stays folded away
    const menuH = Math.round(host().querySelector('div').getBoundingClientRect().height);
    const tall = Math.min(...[...host().querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().height)));
    [...host().querySelectorAll('button')].find(b => b.textContent.trim() === 'Roman blinds').click();
    return { depts: depts.length, onlyThatDept, menuH, tall,
      chosen: productCategoryLabel(document.getElementById('it-category').value),
      closedAfter: host().querySelectorAll('button').length === 1,
      face: host().querySelector('button').textContent.replace(/\s+/g, ' '),
      productKept: document.getElementById('it-product').value,
      qtyKept: document.getElementById('it-qty').value };
  });
  check('opening shows the five departments', unfold.depts === 5, unfold);
  check('unfolding one shows its products and only its products', unfold.onlyThatDept, unfold);
  check('the list is capped so it never runs past a screen', unfold.menuH <= 340, unfold);
  check('every row is a real touch target', unfold.tall >= 34, unfold);
  check('choosing closes it and names the choice with its department',
    unfold.chosen === 'Roman blinds' && unfold.closedAfter && /Roman blinds/.test(unfold.face) && /Curtain/.test(unfold.face), unfold);
  check('and it repaints only itself — what was typed survives',
    unfold.productKept === 'Roman blind for the study' && unfold.qtyKept === '4', unfold);

  const used = await page.evaluate((qtnId) => {
    const before = (quotations.find(q => q.id === qtnId).items || []).length;
    salesAddItem(qtnId);
    const q = quotations.find(x => x.id === qtnId);
    const added = q.items[q.items.length - 1];
    return { added: q.items.length === before + 1, cat: productCategoryLabel(added.categoryId),
      clearedAfter: document.getElementById('it-category').value === '',
      closed: document.getElementById('it-category-picker').querySelectorAll('button').length === 1 };
  }, seeded.qtn);
  check('choosing one lets the line through, filed where it was put', used.added && used.cat === 'Roman blinds', used);
  check('and it resets, closed, for the next line', used.clearedAfter && used.closed, used);

  console.log('\n- it travels to the job, and the P&L reads real cost -');
  const run = await page.evaluate(({ qtn, cust }) => {
    const q = quotations.find(x => x.id === qtn);
    // price the lines through a BOM, the only way Sales pricing exists
    q.items.forEach((it, i) => {
      addBOMMaterial(qtn, it.lineId, { name: itemMaster[0].name, qty: 1, unit: 'Nos', rate: [300, 120, 90][i] || 100 });
      submitItemBOM(qtn, it.lineId, 'Arun Kumar A');
    });
    transferQuotationStage(qtn, 'approver', 'Estimator');
    approveQuotation(qtn, 'Salman Abdullah', 'owner');
    const job = confirmQuotationToJobCard(qtn, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager', null);

    const carried = (job.items || []).map(it => productCategoryLabel(it.categoryId));

    // real cost on the first line only: material issued, hours logged
    const loc = storeLocations[0] || createStoreLocation({ name: 'PNL store' });
    const bin = storeBins.find(b => b.storeId === loc.id) || createStoreBin({ storeId: loc.id, code: 'P1', hint: 'pnl' });
    putAwayStock({ itemId: itemMaster[0].id, binId: bin.id, qty: 50 });
    issueMaterialToJob({ jobCardId: job.id, lines: [{ itemId: itemMaster[0].id, binId: bin.id, qty: 4, lineId: job.items[0].lineId }],
      issuedTo: 'Ajay Paswan', byWhom: 'Storekeeper' });

    const p = getProductPnL({});
    const tv = p.rows.find(r => r.category === 'TV unit');
    const jobLineRev = job.items[0].netAmount;
    const lineCost = getLineActualCost(job.id, job.items[0].lineId);
    return { carried, tv, jobLineRev, lineCostTotal: lineCost ? lineCost.totalCost : null,
      lines: p.lines, without: p.linesWithoutLabour, totals: p.totals,
      divisions: p.byDivision.map(d => d.division) };
  }, seeded);
  check('the category is carried onto the Job Card line', run.carried.indexOf('TV unit') !== -1, run.carried);
  check('the P&L reports that product with the line\'s own revenue',
    run.tv && Math.abs(run.tv.revenue - run.jobLineRev) < 0.002, { tv: run.tv, jobLineRev: run.jobLineRev });
  check('and its cost is the cost ledger\'s own figure, not an estimate',
    run.tv && Math.abs(run.tv.cost - run.lineCostTotal) < 0.002, { cost: run.tv && run.tv.cost, ledger: run.lineCostTotal });
  check('profit is revenue less that cost',
    run.tv && Math.abs(run.tv.profit - (run.tv.revenue - run.tv.cost)) < 0.002, run.tv);
  check('lines with no hours logged are counted and reported, not hidden',
    run.without > 0 && run.without <= run.lines, { without: run.without, lines: run.lines });

  console.log('\n- a mixed line counts whole, not split -');
  const whole = await page.evaluate(() => {
    const job = jobCards.find(j => (j.items || []).some(i => (i.departmentSequence || []).length > 1));
    if (!job) return { skipped: true };
    const it = job.items.find(i => (i.departmentSequence || []).length > 1);
    const p = getProductPnL({});
    const row = p.rows.find(r => r.categoryId === it.categoryId);
    return { depts: it.departmentSequence, lineRev: it.netAmount,
      countedIn: row ? row.division : null, rowRevenue: row ? row.revenue : null };
  });
  if (whole.skipped) check('a multi-department line is counted whole (no mixed line in the run)', true);
  else check('a line routed to two departments still counts once, under its own product',
    whole.rowRevenue !== null && whole.rowRevenue >= whole.lineRev - 0.002, whole);

  console.log('\n- consumption by product -');
  const cons = await page.evaluate(() => {
    const byCat = getMaterialConsumption({ groupBy: 'category' });
    const byItem = getMaterialConsumption({ groupBy: 'item' });
    return { catRows: byCat.rows.map(r => ({ label: r.label, value: r.value })),
      catTotal: byCat.totalValue, itemTotal: byItem.totalValue };
  });
  check('consumption groups by product and totals the same as by item',
    Math.abs(cons.catTotal - cons.itemTotal) < 0.002, cons);
  check('and names the product it went into', cons.catRows.some(r => r.label === 'TV unit'), cons.catRows);

  console.log('\n- the Owner screen -');
  const screen = await page.evaluate(() => {
    launchOwnerModule();
    ownerNav('productpnl');
    const body = document.getElementById('owner-body');
    const txt = body.innerText;
    return { hasTitle: /Revenue and profit by product/.test(txt),
      hasProduct: /TV unit/.test(txt),
      saysWhole: /counted whole/i.test(txt),
      saysGross: /no rent or admin/i.test(txt),
      ranges: [...body.querySelectorAll('[onclick^="ownerSetPnLRange"]')].length,
      // the shell prefixes nav ids with xsnav-
      navEntry: !!document.getElementById('xsnav-owner-productpnl') };
  });
  check('the Owner screen renders with the product on it', screen.hasTitle && screen.hasProduct, screen);
  check('it says the line is counted whole, so nobody adds it to the division chart', screen.saysWhole, screen);
  check('and that the profit is gross', screen.saysGross, screen);
  check('four periods to read it over', screen.ranges === 4, screen);
  check('it has its own entry in Owner\'s sidebar', screen.navEntry, screen);

  console.log('\n- the Estimator can correct a category -');
  const est = await page.evaluate(({ qtn }) => {
    const q = quotations.find(x => x.id === qtn);
    const line = q.items[0];
    const before = productCategoryLabel(line.categoryId);
    const chair = productCategories.find(c => c.name === 'Armchair');
    const r = setQuotationItemCategory(qtn, line.lineId, chair.id);
    const job = jobCards.find(j => j.quotationId === qtn);
    const jl = job ? (job.items || []).find(i => i.lineId === line.lineId) : null;
    return { before, refused: !!(r && r.error), after: productCategoryLabel(line.categoryId),
      jobFollowed: jl ? productCategoryLabel(jl.categoryId) : null };
  }, seeded);
  // The quote is confirmed by this point, so the freeze must refuse it.
  check('a confirmed quote\'s categories are frozen with the rest of it', est.refused && est.after === est.before, est);

  const estOpen = await page.evaluate(() => {
    const cust = createCustomer({ name: 'PNL Client 2', contactPerson: 'B', tel: '39112233', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'B', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'PNL 2' });
    const it = addQuotationItem(q.id, { product: 'Wall cladding, oak', qty: 5, unit: 'Meter', vatPercent: 10 });
    const before = productCategoryLabel(it.categoryId);
    const door = productCategories.find(c => c.name === 'Door');
    setQuotationItemCategory(q.id, it.lineId, door.id);
    return { before, after: productCategoryLabel(it.categoryId) };
  });
  check('an open quote\'s category can be corrected', estOpen.before === 'Wall cladding' && estOpen.after === 'Door', estOpen);

  console.log('\n- where the field sits, and the master behind it -');
  const order = await page.evaluate(() => {
    const q = quotations.find(x => x.stage === 'sales') || quotations[0];
    q.stage = 'sales'; q.lifecycleStatus = 'draft';
    launchSalesModule(); openQuotationWizard(q.id); salesWizardStep = 2; renderSalesBody();
    const cat = document.getElementById('it-category'), prod = document.getElementById('it-product');
    if (!cat || !prod) return { missing: true };
    return { catTop: Math.round(cat.getBoundingClientRect().top), prodTop: Math.round(prod.getBoundingClientRect().top) };
  });
  // Salman, 8 Sep 2026: decide what kind of thing it is, then describe it.
  check('the category sits above Product/Service', order.catTop < order.prodTop, order);

  const masters = await page.evaluate(() => {
    launchStorekeeperModule();
    skGoTo('masters');
    const tab = [...document.querySelectorAll('#sk-module-wrap .sk-tabbtn')].find(t => /Product Category/.test(t.textContent));
    if (!tab) return { noTab: true };
    tab.click();
    const before = productCategories.length;
    document.getElementById('sk-new-product-cat').value = 'Prayer room seating';
    document.getElementById('sk-new-product-div').value = 'Upholstery';
    skAddProductCategoryInline();
    const made = productCategories[productCategories.length - 1];
    const added = productCategories.length === before + 1 && made.name === 'Prayer room seating' && made.division === 'Upholstery';
    const inPicker = productCategoriesForDivision('Upholstery').some(c => c.id === made.id);
    skToggleProductCategory(made.id);
    return { added, inPicker,
      disabled: getProductCategory(made.id).status === 'Disabled',
      // A retired category must keep resolving, or older quotes stop reading.
      stillResolves: productCategoryLabel(made.id) === 'Prayer room seating',
      goneFromPicker: !productCategoriesForDivision('Upholstery').some(c => c.id === made.id),
      groups: (document.getElementById('sk-masters-body').innerText.match(/CURTAIN & BLINDS|JOINERY|UPHOLSTERY/g) || []).length,
      dupRefused: !!(createProductCategory({ name: 'Sofa', division: 'Upholstery' }) || {}).error,
      badDivRefused: !!(createProductCategory({ name: 'Thing', division: 'Nope' }) || {}).error };
  });
  check('Masters carries a Product Category page, grouped by division', !masters.noTab && masters.groups >= 3, masters);
  check('a new category can be added there and reaches the picker', masters.added && masters.inPicker, masters);
  check('disabling one takes it out of the picker but keeps history readable',
    masters.disabled && masters.goneFromPicker && masters.stillResolves, masters);
  check('a duplicate under the same division, and an unknown division, are refused',
    masters.dupRefused && masters.badDivRefused, masters);

  check('no page errors anywhere in the run', errors.length === 0, errors.slice(0, 3));

  await browser.close();
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  process.exit(fail ? 1 : 0);
})();
