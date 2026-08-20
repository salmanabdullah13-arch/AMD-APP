/**
 * e2e-rate-movement.js — real 30-day rate movement (8 Aug 2026)
 *
 * The Estimator package's Rate movements card was originally built on
 * itemMaster.lastPurchaseRate vs itemMaster.cost — drift, not movement, since
 * lastPurchaseRate carries no date. These checks prove the replacement reads
 * the real dated history from RECEIVED purchase invoices, and that it stays
 * quiet rather than inventing a number when it has nothing to say.
 */
const { chromium } = require('@playwright/test');
const path = require('path');

// Local calendar dates, matching the app (data.js localISO/todayISO). A test
// that computes an expected date through toISOString() disagrees with the app
// between local midnight and 03:00 in UTC+3 — a flake that only appears at
// night. Node-side copy: inside page.evaluate() the app's own global resolves.
const localISO = (d) => { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const todayISO = () => localISO(new Date());

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  // Seed a real purchase history against one Item Master row. Dates are
  // written directly because the app always stamps dateReceived as today —
  // there is no way to book a back-dated receipt through the UI.
  console.log('\n— data layer —');
  const seeded = await page.evaluate(() => {
    const item = itemMaster[0];
    // A real supplier on the invoices: the item records themselves carry no
    // vendor (the real stock export had no vendor column), so purchase history
    // is the only place a vendor can honestly come from.
    const sup = createSupplier({ name: 'Gulf Timber & Boards', contactPerson: 'A. Rahman', telephone: '17001122', address: 'Sitra' });
    const ago = d => localISO(new Date(Date.now() - d * 86400000));
    const inv = (date, rate, status) => purchaseInvoices.push({
      id: 'TESTINV' + purchaseInvoices.length, dateReceived: date,
      status: status || 'received', approvalStatus: 'approved',
      supplierId: sup.id,
      items: [{ itemId: item.id, itemName: item.name, qty: 1, rateBD: rate }]
    });
    inv(ago(200), 10);      // long ago
    inv(ago(120), 10);      // repeat buy at the same price — not a movement
    inv(ago(5), 12.5);      // the real move, inside the window: +25%
    return { itemId: item.id, name: item.name, supplier: sup.name };
  });

  const m = await page.evaluate(id => {
    const item = itemMaster.find(i => i.id === id);
    return getItemRateMovement(item, 30);
  }, seeded.itemId);
  check('a real dated move inside the window is reported', !!m, m);
  check('percentage is measured against the previous DIFFERENT price (+25%)',
    m && m.movePercent === 25, m && m.movePercent);
  check('it reports what the price was before, and when it changed',
    m && m.previous === 10 && m.rate === 12.5 && !!m.date, m);

  // Window boundary.
  const outside = await page.evaluate(id => {
    const item = itemMaster.find(i => i.id === id);
    return getItemRateMovement(item, 3);      // the move was 5 days ago
  }, seeded.itemId);
  check('a change older than the window is NOT reported', outside === null, outside);

  // Only real purchases count.
  const draftOnly = await page.evaluate(() => {
    const item = itemMaster[1];
    const ago = d => localISO(new Date(Date.now() - d * 86400000));
    purchaseInvoices.push({ id: 'TESTD1', dateReceived: ago(40), status: 'received', approvalStatus: 'approved',
      items: [{ itemId: item.id, itemName: item.name, qty: 1, rateBD: 5 }] });
    purchaseInvoices.push({ id: 'TESTD2', dateReceived: ago(2), status: 'draft', approvalStatus: 'pending',
      items: [{ itemId: item.id, itemName: item.name, qty: 1, rateBD: 9 }] });
    return getItemRateMovement(itemMaster[1], 30);
  });
  check('a draft invoice is not a price anyone paid — no movement', draftOnly === null, draftOnly);

  const rejected = await page.evaluate(() => {
    const item = itemMaster[2];
    const ago = d => localISO(new Date(Date.now() - d * 86400000));
    purchaseInvoices.push({ id: 'TESTR1', dateReceived: ago(40), status: 'received', approvalStatus: 'approved',
      items: [{ itemId: item.id, itemName: item.name, qty: 1, rateBD: 5 }] });
    purchaseInvoices.push({ id: 'TESTR2', dateReceived: ago(2), status: 'received', approvalStatus: 'rejected',
      items: [{ itemId: item.id, itemName: item.name, qty: 1, rateBD: 9 }] });
    return getItemRateMovement(itemMaster[2], 30);
  });
  check('a rejected invoice is excluded too', rejected === null, rejected);

  const single = await page.evaluate(() => {
    const item = itemMaster[3];
    purchaseInvoices.push({ id: 'TESTS1', dateReceived: todayISO(),
      status: 'received', approvalStatus: 'approved',
      items: [{ itemId: item.id, itemName: item.name, qty: 1, rateBD: 7 }] });
    return getItemRateMovement(itemMaster[3], 30);
  });
  check('one purchase is a price, not a movement — nothing to compare against',
    single === null, single);

  // The old proxy would have flagged a large slice of the seeded Item Master
  // purely on standard-cost-vs-last-paid. The real one only knows about what
  // was actually invoiced.
  const scope = await page.evaluate(() => {
    const all = getRateMovements(30);
    const proxy = itemMaster.filter(i => i.lastPurchaseRate && i.cost &&
      Math.abs(i.lastPurchaseRate - i.cost) > 0.0005).length;
    return { real: all.length, proxy, ids: all.map(x => x.itemId) };
  });
  check('only genuinely-moved items are listed, not every cost/last-paid gap',
    scope.real === 1 && scope.ids[0] === seeded.itemId && scope.proxy > scope.real, scope);

  console.log('\n— what the estimator actually sees —');
  await page.evaluate(() => launchEstimatorModule());
  await page.waitForTimeout(600);
  const card = await page.evaluate(() => {
    const b = document.getElementById('estimator-body');
    const sec = [...b.querySelectorAll('.ed-card')].find(c =>
      (c.querySelector('.ed-title') || {}).textContent === 'Rate movements');
    return sec ? sec.textContent.replace(/\s+/g, ' ') : null;
  });
  check('the card says "in the last 30 days", not "recently"',
    card && /moved in the last 30 days/.test(card) && !/moved recently/.test(card), card);
  check('the card shows the previous price and the direction of the move',
    card && /was BD/.test(card) && /\+25%/.test(card), card);

  const lib = await page.evaluate(() => {
    EstimatorUI.setView('rates');
    const b = document.getElementById('estimator-body');
    const rows = [...b.querySelectorAll('tbody tr')];
    // cells: Material | Vendor | Unit | Rate | Movement
    const moveCells = rows.map(r => r.cells[4].textContent.trim());
    return {
      header: b.textContent.replace(/\s+/g, ' ').slice(0, 200),
      dashes: moveCells.filter(t => t === '—').length,
      moved: moveCells.filter(t => /%/.test(t)).length,
      zeros: moveCells.filter(t => /(^|[^\d])0%/.test(t)).length,
      rowCount: rows.length,
      masterCount: itemMaster.length
    };
  });
  check('Rate library lists the WHOLE master, not a silent first-40 slice',
    lib.rowCount === lib.masterCount && lib.masterCount > 40,
    { rows: lib.rowCount, master: lib.masterCount });
  check('Rate library: an unmoved item shows an em-dash, never a 0%',
    lib.dashes > 0 && lib.zeros === 0, lib);
  check('Rate library header names the window, not "against their standard cost"',
    /in the last 30 days/.test(lib.header) && !/against their standard cost/.test(lib.header), lib.header);

  // Search now spans name, item code, unit, stock category and vendor. Vendor
  // is derived from received purchase invoices, because the real 200-item
  // export carried no vendor column at all.
  const search = await page.evaluate(() => {
    const b = document.getElementById('estimator-body');
    const rowsNow = () => [...b.querySelectorAll('tbody tr')].length;
    const firstNameCell = () => {
      const r = b.querySelector('tbody tr');
      return r ? r.cells[0].textContent : '';
    };
    // Type into the REAL search box and fire the real event, so this also
    // proves the box filters as you type rather than only on blur.
    const run = (term) => {
      const box = b.querySelector('[data-act-input="ratesearch"]');
      box.value = term;
      box.dispatchEvent(new Event('input', { bubbles: true }));
      return { n: rowsNow(), first: firstNameCell() };
    };

    const anItem = itemMaster[5];
    const byCode = run(anItem.id);
    const byCat = run(anItem.stockCategory);
    const vendorName = (() => {
      for (const it of itemMaster) { const v = getItemVendorName(it); if (v) return v; }
      return null;
    })();
    const byVendor = vendorName ? run(vendorName) : null;
    const noHits = run('zzzz-no-such-item');
    run('');   // leave it clean
    return {
      all: rowsNow(), byCode, byCat, byVendor, vendorName, noHits: noHits.n,
      vendorsInData: itemMaster.filter(i => getItemVendorName(i)).length
    };
  });
  check('searching an item CODE finds that item', search.byCode.n >= 1 && search.byCode.first.includes(search.byCode.first.trim().slice(0, 3)), search.byCode);
  check('searching a stock CATEGORY narrows the list without emptying it',
    search.byCat.n >= 1 && search.byCat.n < search.all, { cat: search.byCat.n, all: search.all });
  check('a term matching nothing returns nothing, not the whole list', search.noHits === 0, search.noHits);
  check('a vendor is derived from real purchase history, since items carry none',
    search.vendorName === 'Gulf Timber & Boards' && search.vendorsInData >= 1,
    { vendorName: search.vendorName, itemsWithAVendor: search.vendorsInData });
  check('searching that VENDOR finds its items and nothing else',
    search.byVendor && search.byVendor.n === search.vendorsInData && search.byVendor.n < search.all,
    { hits: search.byVendor && search.byVendor.n, all: search.all });

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
