/**
 * e2e-cloud-production.js — the 19a Production tables, live.
 *
 * Six collections (lane_slots, bom_revisions, cutting_sheets,
 * pressing_batches, overtime_shifts, production_input_requests) joining the
 * snapshot-diff autosave, their RLS scope, and the two commitments that are
 * enforced server-side rather than only in the client.
 *
 * Runs against the REAL Supabase project as 'E2E Joinery Account'
 * (user_type = joinery_production_manager) — the Sales fixture the other
 * cloud suites use is deliberately outside is_production_side(), which is
 * itself one of the things checked here.
 */
const { chromium } = require('@playwright/test');
const path = require('path');

// Local calendar dates, matching the app (data.js localISO/todayISO).
const localISO = (d) => { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const todayISO = () => localISO(new Date());

const JOINERY_IDENTITY = 'E2E Joinery Account';
const SALES_IDENTITY = 'E2E Test Account';
const FIXED_PASSWORD = 'E2eFixedTestPassword1234!';

let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
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

  const inApp = await signIn(page, fileUrl, JOINERY_IDENTITY);
  check('signs in as the Joinery Production Manager fixture', inApp);
  if (!inApp) { console.log('\n' + pass + '/' + (pass + fail) + ' checks passed'); await browser.close(); process.exit(1); }
  await page.waitForTimeout(4000);

  console.log('\n— the six collections are live —');
  const live = await page.evaluate(() => {
    const map = {};
    CLOUD_JSON_COLLECTIONS.forEach(c => { map[c.table] = !!c.live; });
    return { map, role: window.cloudUserType, real: !!window.__realCloudSession };
  });
  const six = ['lane_slots', 'bom_revisions', 'cutting_sheets', 'pressing_batches', 'overtime_shifts', 'production_input_requests'];
  check('signed in as a real cloud session, not the offline bypass', live.real === true, live.role);
  check('all six 19a tables are live on the project', six.every(t => live.map[t]),
    six.filter(t => !live.map[t]));

  console.log('\n— no two collections share a snapshot prefix —');
  // Keys are prefix + id. Two collections sharing a prefix makes each scan
  // treat the other's keys as orphans, delete them, and the other re-upsert
  // — needless writes every three seconds, forever. task_lists and
  // tool_loans both used "tl:" until 19 Aug 2026.
  const prefixes = await page.evaluate(() => {
    const seen = {}, dups = [];
    CLOUD_JSON_COLLECTIONS.forEach(c => {
      if (seen[c.prefix]) dups.push(c.prefix + ' — ' + seen[c.prefix] + ' vs ' + c.table);
      else seen[c.prefix] = c.table;
    });
    return { count: CLOUD_JSON_COLLECTIONS.length, dups };
  });
  check('every collection has its own prefix', prefixes.dups.length === 0, prefixes);

  console.log('\n— real records reach the real tables —');
  const made = await page.evaluate(async () => {
    // A job that genuinely clears the lane gate, built through the real chain.
    const c = createCustomer({ name: 'Cloud Prd Co ' + Date.now(), contactPerson: 'A', tel: String(Date.now()).slice(-8), address: 'Tubli' });
    await new Promise(r => setTimeout(r, 1200));
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    await new Promise(r => setTimeout(r, 1200));
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Cloud Prd project', taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Wardrobe carcass', qty: 2, unit: 'Nos' });
    const it = quotations.find(x => x.id === q.id).items[0];
    addBOMMaterial(q.id, it.lineId, { name: itemMaster[0].name, qty: 3, rate: 25, unit: itemMaster[0].unit });
    submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
    setItemDepartmentSequence(q.id, it.lineId, ['carp']);
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah', 'owner');
    await new Promise(r => setTimeout(r, 1500));
    const job = confirmQuotationToJobCard(q.id, 'Sales');
    confirmJobRouting(job.id, {}, 'Operations Manager', null);

    const store = storeLocations[0] || createStoreLocation({ name: 'Cloud Prd Store' });
    const bin = storeBins[0] || createStoreBin({ storeId: store.id, code: 'C1' });
    putAwayStock({ itemId: itemMaster[0].id, binId: bin.id, qty: 40, source: 'test' });

    const slot = (allotLaneSlot({ crewId: 'CREW-A', jobCardId: job.id, date: todayISO(), portion: 'full', byWhom: 'E2E' }) || {}).slot;
    const ot = bookOvertimeShift({ crewId: 'CREW-A', date: todayISO(), hours: 4, men: 3,
      recoversTarget: job.id, cause: OVERTIME_CAUSES[0], byWhom: 'E2E' });
    const rev = ensureBOMRevision(job.id);

    await new Promise(r => setTimeout(r, 7000));   // > 2 scanner ticks
    const slotRow = slot ? await sb.from('lane_slots').select('*').eq('id', slot.id).maybeSingle() : { data: null };
    const otRow = ot && ot.id ? await sb.from('overtime_shifts').select('*').eq('id', ot.id).maybeSingle() : { data: null };
    const revRow = rev && rev.id ? await sb.from('bom_revisions').select('*').eq('id', rev.id).maybeSingle() : { data: null };
    return {
      jobId: job.id, slotId: slot && slot.id, otId: ot && ot.id, revId: rev && rev.id,
      slotFound: !!slotRow.data, slotErr: slotRow.error && slotRow.error.message,
      otFound: !!otRow.data, otErr: otRow.error && otRow.error.message,
      revFound: !!revRow.data, revErr: revRow.error && revRow.error.message
    };
  });
  check('a lane slot persists by the scanner alone', made.slotFound, made);
  check('an overtime shift persists', made.otFound, made);
  check('a BOM revision persists', made.revFound, made);

  console.log('\n— the server-side gates hold against a raw client write —');
  // The handoff's own line: a client-side gate is a courtesy, not a
  // guarantee. These go straight through supabase-js, bypassing
  // production-data.js entirely.
  const raw = await page.evaluate(async () => {
    const noCause = await sb.from('overtime_shifts').insert({ id: 'OT-RAW-' + Date.now(), payload: { crewId: 'CREW-A', hours: 4, recoversTarget: 'JB1' } });
    const freeText = await sb.from('overtime_shifts').insert({ id: 'OT-RAW2-' + Date.now(), payload: { cause: 'we were busy', recoversTarget: 'JB1' } });
    const money = await sb.from('production_input_requests').insert({ id: 'REQ-RAW-' + Date.now(), payload: { answer: { manHours: 40, rate: 12 } } });
    return {
      noCause: noCause.error && noCause.error.message,
      freeText: freeText.error && freeText.error.message,
      money: money.error && money.error.message
    };
  });
  check('overtime with no cause is refused at the database', /cause/i.test(raw.noCause || ''), raw.noCause);
  check('a free-text cause is refused — the enum is closed', /recorded causes|free text/i.test(raw.freeText || ''), raw.freeText);
  check('an answer carrying a rate is refused at the database',
    /hours and quantities|not money/i.test(raw.money || ''), raw.money);

  console.log('\n— a second device sees the same board —');
  const page2 = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page2.on('dialog', d => d.accept());
  const inApp2 = await signIn(page2, fileUrl, JOINERY_IDENTITY);
  check('second session signs in', inApp2);
  if (inApp2) {
    await page2.waitForTimeout(5000);
    const synced = await page2.evaluate((m) => ({
      slot: laneSlots.some(s => s.id === m.slotId),
      ot: overtimeShifts.some(o => o.id === m.otId)
    }), made);
    check('it hydrates the lane slot and the overtime shift', synced.slot && synced.ot, synced);
  }

  console.log('\n— RLS scope: production writes, everyone reads —');
  const page3 = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page3.on('dialog', d => d.accept());
  const inApp3 = await signIn(page3, fileUrl, SALES_IDENTITY);
  check('a Sales session signs in', inApp3);
  if (inApp3) {
    await page3.waitForTimeout(4000);
    const salesSide = await page3.evaluate(async (m) => {
      const read = await sb.from('lane_slots').select('id').eq('id', m.slotId).maybeSingle();
      const write = await sb.from('lane_slots').insert({ id: 'LS-SALES-' + Date.now(), payload: { crewId: 'CREW-A' } });
      return { role: window.cloudUserType, canRead: !!read.data, writeErr: write.error && write.error.message };
    }, made);
    check('Sales can READ the board — it is not the sensitive class', salesSide.canRead, salesSide);
    check('Sales CANNOT write to it — is_production_side() excludes them',
      !!salesSide.writeErr, salesSide);
  }

  console.log('\n— the landing screen catches up when the caches hydrate —');
  // This module is the production manager's LANDING screen: it is drawn at
  // login, BEFORE the cloud caches have loaded. Nothing used to tell it to
  // try again, so a real manager saw an empty week board on every login
  // while the real slots sat in memory a second later.
  const hydrate = await page.evaluate(async () => {
    const board = () => {
      const body = document.getElementById('prd-body');
      if (!body) return null;
      return [...body.querySelectorAll('.prd-cell')]
        .filter(c => c.classList.contains('c-full') || c.classList.contains('c-half') ||
          c.classList.contains('c-over') || c.classList.contains('c-pull')).length;
    };
    const before = board();
    // Drain the arrays and redraw, then hydrate again — the same sequence a
    // real login goes through, with the render landing first.
    const keep = laneSlots.slice();
    laneSlots.length = 0;
    renderProductionBody();
    const emptied = board();
    keep.forEach(s => laneSlots.push(s));
    // No render call here on purpose: the notify has to be what redraws it.
    notifyLiveUpdateListeners();
    await new Promise(r => setTimeout(r, 200));
    return { before, emptied, after: board(), listener: typeof registerLiveUpdate === 'function' };
  });
  check('a general live-update hook exists to register against', hydrate.listener, hydrate);
  check('the board really was empty before the caches landed', hydrate.emptied === 0, hydrate);
  check('and it redraws itself when told, with no click',
    hydrate.after > 0 && hydrate.after === hydrate.before, hydrate);

  const notOverForm = await page.evaluate(async () => {
    PrdUI.go('form', 'allot');
    await new Promise(r => setTimeout(r, 150));
    const el = document.getElementById('prd-crew');
    el.value = 'CREW-A';
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    notifyLiveUpdateListeners();
    await new Promise(r => setTimeout(r, 200));
    const still = document.getElementById('prd-crew');
    return { view: PrdUI.state.view, crew: still ? still.value : null };
  });
  // A repaint over an open form would throw away what is being typed — the
  // trap this module hit three times in Phases 3 and 4.
  check('but it never repaints over an open form', notOverForm.crew === 'CREW-A', notOverForm);

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
