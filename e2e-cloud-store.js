/**
 * e2e-cloud-store.js — the 18a Store tables, live.
 *
 * store-data.js has been on the project since 19 Aug, but until the 18a
 * interface landed nothing wrote to those tables from a screen, and no
 * live suite covered them. This one checks the nine collections are live,
 * that a store built through the real functions actually reaches the
 * tables, that a second session picks the same shelf up, and that the
 * hard gate — no material without a job card — holds through the client
 * AND at the database, where a trigger enforces it independently.
 *
 * Runs against the REAL project as 'E2E Approver Account' (user_type =
 * owner, inside is_store_side()). The Sales fixture is deliberately
 * outside it, which is itself one of the checks.
 */
const { chromium } = require('@playwright/test');
const path = require('path');

const STORE_IDENTITY = 'E2E Approver Account';   // owner-typed, inside is_store_side()
const SALES_IDENTITY = 'E2E Test Account';       // sales-typed, outside it
const FIXED_PASSWORD = 'E2eFixedTestPassword1234!';

const TABLES = ['store_locations', 'store_bins', 'stock_lots', 'stock_reservations',
  'store_issues', 'store_transfers', 'store_returns', 'tool_loans', 'stock_counts'];

let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}

async function signIn(page, fileUrl, identity) {
  await page.goto(fileUrl);
  await page.waitForFunction(() => {
    const s = document.getElementById('auth-identity-select');
    return s && s.options.length > 1;
  }, { timeout: 15000 }).catch(() => null);
  await page.selectOption('#auth-identity-select', identity).catch(() => null);
  await page.fill('#auth-password-input', FIXED_PASSWORD).catch(() => null);
  await page.click('#cloud-login-body button[onclick="handleSignIn()"]').catch(() => null);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 20000 }).catch(() => null);
  return page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';

  const inApp = await signIn(page, fileUrl, STORE_IDENTITY);
  check('signs in as a store-side fixture', inApp);
  if (!inApp) { console.log('\n' + pass + '/' + (pass + fail) + ' checks passed'); await browser.close(); process.exit(1); }
  await page.waitForTimeout(4500);

  console.log('\n- the nine collections are live -');
  const live = await page.evaluate((TABLES) => {
    const map = {};
    CLOUD_JSON_COLLECTIONS.forEach(c => { map[c.table] = !!c.live; });
    return { missing: TABLES.filter(t => !(t in map)), notLive: TABLES.filter(t => map[t] === false),
      pending: (typeof CLOUD_TABLES_PENDING_DEPLOY !== 'undefined' ? [...CLOUD_TABLES_PENDING_DEPLOY] : []).filter(t => TABLES.indexOf(t) >= 0) };
  }, TABLES);
  check('all nine store tables are registered', live.missing.length === 0, live.missing);
  check('and every one of them is live on the project', live.notLive.length === 0, live.notLive);
  check('none is left sitting in the pending-deploy list', live.pending.length === 0, live.pending);

  console.log('\n- a real store, built through the real functions -');
  const built = await page.evaluate(() => {
    const stamp = Date.now();
    const loc = createStoreLocation({ name: 'E2E Store ' + stamp });
    const bin = createStoreBin({ storeId: loc.id, code: 'Z9', hint: 'e2e shelf' });
    const item = itemMaster[0];
    putAwayStock({ itemId: item.id, binId: bin.id, qty: 25 });
    return { stamp, loc: loc.id, locName: loc.name, bin: bin.id, item: item.id,
      onHand: stockOnHand(item.id, bin.id), label: binLabel(bin.id) };
  });
  check('a location, a bin and 25 on the shelf', built.onHand === 25, built);
  check('the bin reads as its own store', /E2E Store/.test(built.label), built.label);

  // The scanner writes on its own, 3s after the change — nothing here calls persist.
  await page.waitForTimeout(6000);
  const landed = await page.evaluate(async ({ loc, bin }) => {
    const l = await sb.from('store_locations').select('id,payload').eq('id', loc).maybeSingle();
    const b = await sb.from('store_bins').select('id,payload').eq('id', bin).maybeSingle();
    const lots = await sb.from('stock_lots').select('id,payload');
    return { loc: l.data ? l.data.payload.name : null, bin: b.data ? b.data.payload.code : null,
      lotForBin: (lots.data || []).filter(r => r.payload && r.payload.binId === bin).length };
  }, built);
  check('the location reached the live table under its own name', landed.loc === built.locName, landed);
  check('so did the bin', landed.bin === 'Z9', landed);
  check('and the stock behind it', landed.lotForBin > 0, landed);

  console.log('\n- the hard gate, through the client and at the database -');
  const gate = await page.evaluate(async ({ item, bin }) => {
    const line = () => [{ itemId: item, binId: bin, qty: 1 }];
    const noJob = issueMaterialToJob({ jobCardId: '', lines: line(), issuedTo: 'E2E', byWhom: 'Storekeeper' });
    const general = issueMaterialToJob({ jobCardId: 'general use', lines: line(), issuedTo: 'E2E', byWhom: 'Storekeeper' });
    const still = stockOnHand(item, bin);
    // Straight at the database, bypassing every client check.
    const raw = await sb.from('store_issues').insert({
      id: 'ISS-E2E-' + Date.now(),
      payload: { jobCardId: '', lines: line(), issuedTo: 'E2E', date: todayISO() }
    });
    const rawHeld = await sb.from('stock_reservations').insert({
      id: 'RES-E2E-' + Date.now(),
      payload: { jobCardId: '', itemId: item, binId: bin, qty: 1, status: 'held' }
    });
    return { noJob: !!(noJob || {}).error, general: !!(general || {}).error, still,
      rawRefused: !!(raw.error), rawMsg: (raw.error || {}).message || '',
      rawHeldRefused: !!(rawHeld.error) };
  }, built);
  check('no job card, no material — in the client', gate.noJob && gate.general, gate);
  check('and not one unit moved', gate.still === 25, gate);
  check('the database refuses a jobless issue on its own, with no client involved', gate.rawRefused, gate.rawMsg.slice(0, 90));
  check('and a jobless hold', gate.rawHeldRefused, gate);

  console.log('\n- a second session picks up the same shelf -');
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page2.on('pageerror', e => errors.push('session2: ' + e.message));
  page2.on('dialog', d => d.accept());
  const in2 = await signIn(page2, fileUrl, STORE_IDENTITY);
  check('a second session signs in', in2);
  await page2.waitForTimeout(5000);
  const seen = await page2.evaluate(({ loc, bin, item }) => ({
    loc: !!storeLocations.find(l => l.id === loc),
    bin: !!storeBins.find(b => b.id === bin),
    onHand: stockOnHand(item, bin)
  }), built);
  check('the other device sees the store, the bin and the stock on it',
    seen.loc && seen.bin && seen.onHand === 25, seen);
  await page2.close();

  console.log('\n- and Sales cannot write to any of it -');
  const page3 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page3.on('pageerror', e => errors.push('sales: ' + e.message));
  page3.on('dialog', d => d.accept());
  const in3 = await signIn(page3, fileUrl, SALES_IDENTITY);
  check('the Sales fixture signs in', in3);
  await page3.waitForTimeout(3500);
  const sales = await page3.evaluate(async () => {
    const w = await sb.from('store_locations').insert({ id: 'LOC-E2E-SALES-' + Date.now(), payload: { name: 'should not exist' } });
    const r = await sb.from('store_locations').select('id').limit(1);
    return { writeRefused: !!w.error, canRead: !r.error };
  });
  check('a Sales session is refused a write to the store', sales.writeRefused, sales);
  check('but can still read what is on the shelf — production needs to see it', sales.canRead, sales);
  await page3.close();

  console.log('\n- cleaning up after the run -');
  const cleaned = await page.evaluate(async ({ loc, bin }) => {
    const lots = await sb.from('stock_lots').select('id,payload');
    const mine = (lots.data || []).filter(r => r.payload && r.payload.binId === bin).map(r => r.id);
    for (const id of mine) await sb.from('stock_lots').delete().eq('id', id);
    await sb.from('store_bins').delete().eq('id', bin);
    await sb.from('store_locations').delete().eq('id', loc);
    const left = await sb.from('store_locations').select('id').eq('id', loc);
    return { lots: mine.length, gone: (left.data || []).length === 0 };
  }, built);
  check('the run leaves nothing of its own behind', cleaned.gone, cleaned);

  check('no page errors anywhere in the run', errors.length === 0, errors.slice(0, 3));

  await browser.close();
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  process.exit(fail ? 1 : 0);
})();
