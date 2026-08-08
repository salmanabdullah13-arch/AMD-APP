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
    const ago = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    const inv = (date, rate, status) => purchaseInvoices.push({
      id: 'TESTINV' + purchaseInvoices.length, dateReceived: date,
      status: status || 'received', approvalStatus: 'approved',
      items: [{ itemId: item.id, itemName: item.name, qty: 1, rateBD: rate }]
    });
    inv(ago(200), 10);      // long ago
    inv(ago(120), 10);      // repeat buy at the same price — not a movement
    inv(ago(5), 12.5);      // the real move, inside the window: +25%
    return { itemId: item.id, name: item.name };
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
    const ago = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    purchaseInvoices.push({ id: 'TESTD1', dateReceived: ago(40), status: 'received', approvalStatus: 'approved',
      items: [{ itemId: item.id, itemName: item.name, qty: 1, rateBD: 5 }] });
    purchaseInvoices.push({ id: 'TESTD2', dateReceived: ago(2), status: 'draft', approvalStatus: 'pending',
      items: [{ itemId: item.id, itemName: item.name, qty: 1, rateBD: 9 }] });
    return getItemRateMovement(itemMaster[1], 30);
  });
  check('a draft invoice is not a price anyone paid — no movement', draftOnly === null, draftOnly);

  const rejected = await page.evaluate(() => {
    const item = itemMaster[2];
    const ago = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    purchaseInvoices.push({ id: 'TESTR1', dateReceived: ago(40), status: 'received', approvalStatus: 'approved',
      items: [{ itemId: item.id, itemName: item.name, qty: 1, rateBD: 5 }] });
    purchaseInvoices.push({ id: 'TESTR2', dateReceived: ago(2), status: 'received', approvalStatus: 'rejected',
      items: [{ itemId: item.id, itemName: item.name, qty: 1, rateBD: 9 }] });
    return getItemRateMovement(itemMaster[2], 30);
  });
  check('a rejected invoice is excluded too', rejected === null, rejected);

  const single = await page.evaluate(() => {
    const item = itemMaster[3];
    purchaseInvoices.push({ id: 'TESTS1', dateReceived: new Date().toISOString().slice(0, 10),
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
    const moveCells = rows.map(r => r.cells[3].textContent.trim());
    return {
      header: b.textContent.replace(/\s+/g, ' ').slice(0, 200),
      dashes: moveCells.filter(t => t === '—').length,
      moved: moveCells.filter(t => /%/.test(t)).length,
      zeros: moveCells.filter(t => /(^|[^\d])0%/.test(t)).length
    };
  });
  check('Rate library: an unmoved item shows an em-dash, never a 0%',
    lib.dashes > 0 && lib.zeros === 0, lib);
  check('Rate library header names the window, not "against their standard cost"',
    /in the last 30 days/.test(lib.header) && !/against their standard cost/.test(lib.header), lib.header);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
