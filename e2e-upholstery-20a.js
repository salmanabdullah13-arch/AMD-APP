/**
 * e2e-upholstery-20a.js — Upholstery supervisor module (design handoff 20a)
 *
 * The five design commitments live in upholstery-data.js, so the checks
 * below drive the REAL data layer and the REAL DOM and assert on real
 * records: nothing overtakes, one suite one dye lot one lay, a COM
 * shortfall stops the table until it is signed, metres and hours never a
 * price, and overtime refused where there is nothing to work on. Then the
 * shell, the twelve pages, the ten gates, the plan builder's arithmetic,
 * the money sweep, dark mode and the phone.
 */
const { chromium } = require('@playwright/test');
const path = require('path');

const localISO = (d) => { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return localISO(d); };
const todayISO = () => localISO(new Date());
// The next Sunday-to-Thursday working days after today, so the board's
// weekend cells are never booked by accident.
function workdays(n) {
  const out = []; let d = todayISO();
  while (out.length < n) { d = addDays(d, 1); const wd = new Date(d + 'T00:00:00').getDay(); if (wd !== 5 && wd !== 6) out.push(d); }
  return out;
}

let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept('Nap wrong on the inside back'));

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => { if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; });

  // ── seed: two real suites, routed to upholstery ─────────────────────
  const seed = await page.evaluate((days) => {
    const mk = (product, qty, project, tel) => {
      const c = createCustomer({ name: 'Uph 20a ' + project, contactPerson: 'A', tel, address: 'Budaiya' });
      const e = createEnquiry({ division: 'Upholstery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
      const q = convertEnquiryToQuotation(e.id, { projectName: project, taxPercent: 10, contactPerson: 'A' });
      addQuotationItem(q.id, { product, qty, unit: 'Nos' });
      const it = quotations.find(x => x.id === q.id).items[0];
      addBOMMaterial(q.id, it.lineId, { name: itemMaster[0].name, qty: 2, rate: 25, unit: itemMaster[0].unit });
      submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
      setItemDepartmentSequence(q.id, it.lineId, ['uph']);
      transferQuotationStage(q.id, 'approver', 'Estimator');
      approveQuotation(q.id, 'Salman Abdullah');
      const job = confirmQuotationToJobCard(q.id, 'Sales');
      confirmJobRouting(job.id, {}, 'Operations Manager', days[9]);
      return job.id;
    };
    const sofa = mk('3-seater sofa — Budaiya villa', 1, 'Budaiya sofa suite', String(Math.floor(Math.random() * 1e8)));
    const chairs = mk('Dining chair — walnut frame', 8, 'Amwaj dining chairs', String(Math.floor(Math.random() * 1e8)));
    // A foam item with real stock in a real bin, so a schedule can be ready.
    const foamItem = itemMaster.find(i => /foam/i.test(i.name)) || itemMaster[1];
    const st = createStoreLocation({ name: 'Uph test store ' + Date.now() });
    const bin = createStoreBin({ storeId: st.id, code: 'U1' });
    putAwayStock({ itemId: foamItem.id, binId: bin.id, qty: 40 });
    // A pricing request asked of upholstery, and one asked of production,
    // so the two shops can be shown reading only their own.
    const rq = raiseInputRequest({ type: 'pricing_input', raisedBy: 'Arun Kumar A', raiserRole: 'estimator', jobCardId: null,
      question: 'Metres per seat and sewing hours — 12-seat majlis', neededBy: days[0], dept: 'uph' });
    raiseInputRequest({ type: 'pricing_input', raisedBy: 'Arun Kumar A', raiserRole: 'estimator', question: 'Board counts for wardrobes', dept: 'carp' });
    return { sofa, chairs, foamItem: foamItem.id, foamName: foamItem.name, req: rq.id, specCount: uphSpecs.length,
      prodSees: getInputRequestsOfType('pricing_input').some(r => r.dept === 'uph'),
      uphSees: getUphInputRequests('pricing_input').map(r => r.id) };
  }, workdays(12));
  check('the standing specs are seeded as masters', seed.specCount >= 8, seed.specCount);
  check('production reads only its own requests; upholstery reads only its own',
    !seed.prodSees && seed.uphSees.length === 1 && seed.uphSees[0] === seed.req, seed);

  // ── commitment 1: nothing overtakes ─────────────────────────────────
  console.log('\n— nothing overtakes —');
  const days = workdays(12);
  const order = await page.evaluate(({ s, d }) => {
    const c1 = allotUphStageSlot({ stageId: 'C', jobCardId: s.sofa, date: d[2] });       // cutting before frames
    const f = allotUphStageSlot({ stageId: 'F', jobCardId: s.sofa, date: d[0] });
    const f2 = allotUphStageSlot({ stageId: 'F', jobCardId: s.sofa, date: d[1] });
    const c2 = allotUphStageSlot({ stageId: 'C', jobCardId: s.sofa, date: d[1] });       // same day as frames' end
    const wait = getUphWaitingForStage().find(w => w.job.id === s.sofa);
    return { c1: c1.error, f: !!f.slot, f2: !!f2.slot, c2: c2.error, end: uphStageEnd(s.sofa, 'F'), waiting: wait && wait.reason };
  }, { s: seed, d: days });
  check('cutting cannot be booked before frames has an end date', /Nothing overtakes/.test(order.c1 || ''), order);
  check('frames books, and its end date is its last day', order.f && order.f2 && order.end === days[1], order);
  check('cutting cannot start on or before the day frames ends',
    /No fabric on site|Nothing overtakes/.test(order.c2 || ''), order);
  check('the suite sits in "Waiting for a stage" with the real reason',
    /No fabric on site/.test(order.waiting || ''), order);

  // ── commitment 2: one roll, one lot — the plan builder ──────────────
  console.log('\n— one suite, one dye lot, one lay —');
  const roll = await page.evaluate((s) => {
    const r = receiveFabricRoll({ name: 'Sahara 12 upholstery fabric', widthCm: 140, dyeLot: '4471', metres: 46, jobCardId: s.sofa, costPerM: 14.5, byWhom: 'Jassim Abdulla' });
    const before = releaseFabricPlan({ jobCardId: s.sofa, rollId: r.id, byWhom: 'Upholstery Supervisor' });
    inspectFabricRoll(r.id, { ok: true, byWhom: 'Upholstery Supervisor' });
    const spec = uphSpecForJob(s.sofa);
    const t = fabricPlanTotals(spec.panels, 1400);
    return { id: r.id, uninspected: before.error, panels: spec.panels.length, totals: t };
  }, seed);
  check('a plan will not release from a roll that has not been inspected', /not been inspected/.test(roll.uninspected || ''), roll);
  // The arithmetic, worked out independently for the seeded 3-seater spec.
  const expected = (() => {
    const P = [[3, 620, 560, 1], [3, 620, 560, 1], [3, 2400, 120, 0], [3, 580, 560, 1], [3, 580, 560, 1], [1, 700, 1950, 1], [1, 760, 2050, 1], [2, 720, 900, 1], [2, 640, 900, 1], [1, 260, 2050, 0], [1, 640, 1950, 0], [1, 300, 2100, 0]];
    let lay = 0, napRows = 0;
    P.forEach(([q, l, w, n]) => { const across = Math.max(1, Math.floor(1400 / w)); lay += Math.ceil(q / across) * l; if (n) napRows++; });
    return Math.round(((lay * 1.06 + napRows * 320) / 1000) * 10) / 10;
  })();
  check('fabric to cut matches the handoff formula worked out independently', roll.totals.totalM === expected, { got: roll.totals.totalM, expected });

  // Through the real form: pick the job, pick the roll, pull, release.
  await page.evaluate(() => launchUpholsteryModule());
  await page.waitForTimeout(400);
  const plan = await page.evaluate(async ({ s, rollId }) => {
    UphUI.go('form', 'plan');
    await new Promise(r => setTimeout(r, 150));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('uph-job', s.sofa);
    await new Promise(r => setTimeout(r, 150));
    set('uph-roll', rollId);
    await new Promise(r => setTimeout(r, 150));
    const emptyCopy = (document.querySelector('#uph-body .uph-plan .uph-cut-e') || {}).textContent || '';
    document.querySelector('#uph-body [data-a="plan-pull"]').click();
    await new Promise(r => setTimeout(r, 150));
    const rows = document.querySelectorAll('#uph-body .uph-plan-r').length;
    const napOn = document.querySelectorAll('#uph-body .uph-nap.on').length;
    const cells = [...document.querySelectorAll('#uph-body .uph-cut-t')].map(c => c.textContent.replace(/\s+/g, ' ').trim());
    // Bump one panel over the roll: the last cell must flip to bad.
    for (let i = 0; i < 60; i++) document.querySelectorAll('#uph-body .uph-plan-r')[5].querySelectorAll('.uph-stp')[1].click();
    await new Promise(r => setTimeout(r, 100));
    const overTone = document.querySelectorAll('#uph-body .uph-cut-t')[4].className;
    for (let i = 0; i < 60; i++) document.querySelectorAll('#uph-body .uph-plan-r')[5].querySelectorAll('.uph-stp')[0].click();
    await new Promise(r => setTimeout(r, 100));
    const backTone = document.querySelectorAll('#uph-body .uph-cut-t')[4].className;
    // Gate: "One roll, one lot" is ok; "Two lots" is blocked.
    // Re-query each time: answering the gate repaints the gate card, so a
    // NodeList captured before the click points at detached buttons.
    const opt = (i) => document.querySelectorAll('#uph-body .uph-opt')[i];
    opt(1).click(); await new Promise(r => setTimeout(r, 100));
    const twoLots = { dead: document.querySelector('#uph-body .uph-acts .uph-btn').disabled, label: document.querySelector('#uph-body .uph-acts .uph-btn').textContent.trim(), rowsKept: document.querySelectorAll('#uph-body .uph-plan-r').length };
    opt(0).click(); await new Promise(r => setTimeout(r, 100));
    const live = !document.querySelector('#uph-body .uph-acts .uph-btn').disabled;
    const banner = document.querySelector('#uph-body .uph-banner').textContent;
    document.querySelector('#uph-body .uph-acts .uph-btn').click();
    await new Promise(r => setTimeout(r, 300));
    const p = jobLiveFabricPlan(s.sofa);
    return { emptyCopy, rows, napOn, cells, overTone, backTone, twoLots, live, banner, plan: p && { id: p.id, totalM: p.totalM, lot: p.dyeLot, roll: p.rollId }, free: rollMetresFree(rollId), view: UphUI.state.view };
  }, { s: seed, rollId: roll.id });
  check('the builder starts empty with the spec\'s own sentence', /No panels yet. Pull them from the spec/.test(plan.emptyCopy), plan.emptyCopy);
  check('pull brings the spec\'s twelve panels, nap on for the shaped ones', plan.rows === 12 && plan.napOn === 8, { rows: plan.rows, napOn: plan.napOn });
  check('the five totals cells render — panels, single lay, nap-matched, repeat, fabric to cut',
    plan.cells.length === 5 && /Fabric to cut/.test(plan.cells[4]) && /Repeat allowance/.test(plan.cells[3]), plan.cells);
  check('"Fabric to cut" flips to bad when the suite no longer comes off the roll, and back',
    /t-bad/.test(plan.overTone) && !/t-bad/.test(plan.backTone), { over: plan.overTone, back: plan.backTone });
  check('"Two lots" leaves the primary dead and labelled Blocked, and keeps the panels typed',
    plan.twoLots.dead && plan.twoLots.label === 'Blocked' && plan.twoLots.rowsKept === 12, plan.twoLots);
  check('"One roll, one lot" makes it live', plan.live, plan.banner);
  check('releasing writes a real ticket, off that roll and dye lot, and holds the metres',
    plan.plan && plan.plan.lot === '4471' && plan.plan.roll === roll.id && plan.plan.totalM === expected && Math.abs(plan.free - (46 - expected)) < 0.01 && plan.view === 'dash', plan);

  // ── commitment 3: COM shortfall stops the table ─────────────────────
  console.log('\n— COM shortfall is the client\'s risk, in writing —');
  const com = await page.evaluate((s) => {
    const r = receiveFabricRoll({ name: 'COM — client\'s own weave', widthCm: 130, dyeLot: 'C-88', metres: 4, jobCardId: s.chairs, isCOM: true, clientName: 'Amwaj', byWhom: 'Jassim Abdulla' });
    inspectFabricRoll(r.id, { ok: true });
    const need = jobFabricNeed(s.chairs);
    const block = comBlockReason(s.chairs);
    const tryPlan = releaseFabricPlan({ jobCardId: s.chairs, rollId: r.id });
    allotUphStageSlot({ stageId: 'F', jobCardId: s.chairs, date: todayISO() });
    const cutting = uphStageBlockReason(s.chairs, 'C');
    const asked = getUphAskedToday().find(x => x.kind === 'COM');
    const ours = raiseCOMShortfallNote({ jobCardId: s.chairs, rollId: fabricRolls.find(x => x.jobCardId === s.sofa).id, shortfallM: 2 });
    return { id: r.id, need, block, tryPlan: tryPlan.error, cutting: cutting && cutting.reason, asked: asked && asked.need, ours: ours.error };
  }, seed);
  check('a COM roll short of need blocks with the shortfall on it', /COM roll .* m short. Signed note before anyone cuts/.test(com.block || ''), com);
  check('the plan refuses to release — "Nobody cuts until the shortfall is signed"', /Nobody cuts until the shortfall is signed/.test(com.tryPlan || ''), com.tryPlan);
  check('the cutting table refuses the job for the same reason', /COM roll/.test(com.cutting || ''), com.cutting);
  check('it is asked of him today, with the need line verbatim', com.asked === 'COM. We cannot buy more. Nobody cuts until the shortfall is signed.', com.asked);
  check('a shortfall note cannot be raised on our own fabric', /not the client's own material/.test(com.ours || ''), com.ours);
  const signed = await page.evaluate(async ({ s, rollId }) => {
    UphUI.go('form', 'com');
    await new Promise(r => setTimeout(r, 150));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('uph-job', s.chairs); await new Promise(r => setTimeout(r, 150));
    set('uph-roll', rollId); set('uph-short', 6); set('uph-client', 'Amwaj owner'); set('uph-sales', 'Noor Al Sayed');
    const opt = (i) => document.querySelectorAll('#uph-body .uph-opt')[i];
    opt(2).click(); await new Promise(r => setTimeout(r, 100));
    const blocked = { dead: document.querySelector('#uph-body .uph-acts .uph-btn').disabled, banner: document.querySelector('#uph-body .uph-banner').textContent };
    opt(0).click(); await new Promise(r => setTimeout(r, 100));
    document.querySelector('#uph-body .uph-acts .uph-btn').click();
    await new Promise(r => setTimeout(r, 300));
    const n = comNotes.find(x => x.rollId === rollId);
    return { blocked, note: n && { option: n.option, client: n.clientSignedBy, sales: n.salesSignedBy }, block: comBlockReason(s.chairs) };
  }, { s: seed, rollId: com.id });
  check('"Nothing agreed" is dead — nothing in this module can override it',
    signed.blocked.dead && /Nothing in this module can override it/.test(signed.blocked.banner), signed.blocked);
  check('a signed and countersigned note clears the table', signed.note && signed.note.option === 'more' && signed.note.client && signed.note.sales && signed.block === null, signed);

  // ── foam: density is a spec; schedule state derived ─────────────────
  console.log('\n— density is a spec, not a preference —');
  const foam = await page.evaluate((s) => {
    const wrong = createFoamSchedule({ jobCardId: s.sofa, lines: [{ part: 'Seat cushion', grade: '21kg foam', qty: 3 }] });
    const fs = createFoamSchedule({ jobCardId: s.sofa, lines: [{ part: 'Seat cushion', grade: '35kg HR', itemId: s.foamItem, qty: 3 }] });
    const st = foamScheduleState(fs);
    const so = signOffFoamSchedule(fs.id);
    const cutting = uphStageBlockReason(s.sofa, 'C');
    return { wrong: wrong.error, state: st.state, signed: !so.error && so.signedOff, cutting: cutting && cutting.reason };
  }, seed);
  check('a grade that is not the spec\'s is refused — only operations changes it', /Density is a spec, not a preference/.test(foam.wrong || ''), foam.wrong);
  check('a schedule with every block on the shelf reads Ready and signs off', foam.state === 'Ready' && foam.signed, foam);
  check('with plan, roll and foam in place the cutting table is clear', foam.cutting === null, foam.cutting);

  // ── the serial line runs: C, S, B, Q, pulled dates move ─────────────
  const serial = await page.evaluate(({ s, d }) => {
    const c = allotUphStageSlot({ stageId: 'C', jobCardId: s.sofa, date: d[2] });
    const sew = allotUphDerivedSlot({ stageId: 'S', baseSlotId: c.slot.id, offsetDays: 1, jobCardId: s.sofa });
    const bay = allotUphDerivedSlot({ stageId: 'B', baseSlotId: sew.slot.id, offsetDays: 2, jobCardId: s.sofa });
    const bayDate1 = uphSlotDate(bay.slot);
    const mv = moveUphSlot(c.slot.id, d[3]);
    const bayDate2 = uphSlotDate(bay.slot);
    const backwards = allotUphDerivedSlot({ stageId: 'F', baseSlotId: c.slot.id, offsetDays: 1, jobCardId: s.sofa });
    return { sewDate: uphSlotDate(sew.slot), bayDate1, bayDate2, moved: !mv.error, backwards: backwards.error, cDate: d[3] };
  }, { s: seed, d: days });
  check('sewing and the bays pull their dates from cutting', serial.sewDate === addDays(serial.cDate, 0) || serial.bayDate2 === addDays(serial.cDate, 3), serial);
  check('moving the cutting slot moves the bay slot with it', serial.moved && serial.bayDate2 === addDays(serial.bayDate1, 1), serial);
  check('a stage can only pull from the stage before it, never after', /never after/.test(serial.backwards || ''), serial.backwards);

  // ── commitment 5: overtime ──────────────────────────────────────────
  console.log('\n— overtime buys hours, not material —');
  const ot = await page.evaluate(({ s, d }) => {
    const idle = bookUphOvertime({ stageId: 'C', date: d[4], hours: 3, men: 2, recoversTarget: s.chairs, cause: 'COM shortfall' });
    const noCause = bookUphOvertime({ stageId: 'F', date: d[4], hours: 3, men: 2, recoversTarget: s.sofa, cause: 'because' });
    const ok = bookUphOvertime({ stageId: 'F', date: d[4], hours: 3, men: 2, recoversTarget: s.sofa, cause: 'Fabric changed' });
    return { idle: idle.error, refusedRow: uphOvertime.some(o => o.status === 'refused' && o.recoversTarget === s.chairs), noCause: noCause.error, ok: !ok.error && ok.status === 'booked', rows: getUphOvertimeRows().length };
  }, { s: seed, d: days });
  check('overtime on a stage with nothing to work on is refused — and recorded', /nothing to work on/.test(ot.idle || '') && ot.refusedRow, ot);
  check('a cause outside the closed list is refused', /cause of the slip is required/.test(ot.noCause || ''), ot.noCause);
  check('a shift against a slipped target with a real cause books', ot.ok && ot.rows === 2, ot);

  // ── commitment 4: metres and hours, never a price ───────────────────
  console.log('\n— he returns metres, grades and hours, never a price —');
  const price = await page.evaluate(async (s) => {
    const money = uphAnswerPricing(s.req, { metresPerSeat: 2.5, rate: 14 });
    UphUI.go('form', 'price');
    await new Promise(r => setTimeout(r, 150));
    const rateCol = [...document.querySelectorAll('#uph-body .uph-lines-r .c-r')].map(x => x.textContent.trim());
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('uph-req', s.req); set('uph-mps', 2.5); set('uph-grades', '35kg HR seats · 28kg backs'); set('uph-sew', 9); set('uph-bay', 16);
    document.getElementById('uph-lh-S').value = 9;
    document.querySelectorAll('#uph-body .uph-opt')[0].click(); await new Promise(r => setTimeout(r, 100));
    document.querySelector('#uph-body .uph-acts .uph-btn').click();
    await new Promise(r => setTimeout(r, 300));
    const r = inputRequests.find(x => x.id === s.req);
    return { money: money.error, rateCol, answer: r.answer, status: r.status, moneyKeys: Object.keys(r.answer || {}).filter(k => /rate|price|cost|amount|margin|total|bd|money|value/i.test(k)) };
  }, seed);
  check('an answer carrying a rate is refused', /not something this role returns/.test(price.money || ''), price.money);
  check('the lines table\'s Rate column is "—" on every row', price.rateCol.length === 5 && price.rateCol.every(x => x === '—'), price.rateCol);
  check('the form sends metres per seat, grades and hours and nothing money-shaped',
    price.status === 'answered' && price.answer.metresPerSeat === 2.5 && price.answer.sewingHours === 9 && price.answer.manHours === 9 && price.moneyKeys.length === 0, price);

  // ── the dashboard ───────────────────────────────────────────────────
  console.log('\n— the dashboard —');
  await page.evaluate(() => UphUI.go('dash', 'board'));
  await page.waitForTimeout(300);
  const dash = await page.evaluate(async () => {
    const wrap = document.getElementById('uph-module-wrap');
    // The seeded slots fall this week and next; read the vocabulary across both.
    const vocab = new Set();
    for (const off of [0, 1]) {
      UphUI.state.off = off; UphUI.paint(); await new Promise(r => setTimeout(r, 80));
      [...document.querySelectorAll('#uph-body .uph-cell')].forEach(c => vocab.add(c.className.replace('uph-cell c-', '')));
    }
    const otSeen = vocab.has('ot'), pullSeen = vocab.has('pull');
    UphUI.state.off = 0; UphUI.paint(); await new Promise(r => setTimeout(r, 80));
    return {
      shown: getComputedStyle(wrap).display, sidebars: wrap.querySelectorAll('.xs-side').length, chat: document.querySelectorAll('.xchat-bubble, .xs-chat-fab, [class*="chat-bubble"]').length,
      rail: [...wrap.querySelectorAll('.xs-item .xs-lbl')].map(x => x.textContent.trim()),
      stages: document.querySelectorAll('#uph-body .uph-lane').length,
      stageNames: [...document.querySelectorAll('#uph-body .uph-lane-n')].map(x => x.textContent),
      vocab: [...vocab], badges: document.querySelectorAll('#uph-body .uph-q').length,
      asked: document.querySelectorAll('#uph-body .uph-ask').length,
      kpis: [...document.querySelectorAll('#uph-body .uph-kpi-r b')].map(x => x.textContent),
      stagesToday: document.querySelectorAll('#uph-body .uph-team').length,
      barsWithText: [...document.querySelectorAll('#uph-body .uph-track i')].filter(i => i.textContent.trim()).length,
      ot: otSeen, pull: pullSeen
    };
  });
  check('the module opens on the shared shell with one sidebar', dash.shown === 'flex' && dash.sidebars === 1, dash);
  check('the rail is Dashboard, the twelve pages in the handoff\'s order, Create…',
    dash.rail.join('|') === 'Dashboard|Week board|Pricing input|Upholstery spec|Fabric plans|Foam schedules|Fabric & COM register|Upholstery bays|Finishing & QC|Crews & labour|Overtime & recovery|Reminders|Documents|Create…', dash.rail);
  check('five stages in one order on the board', dash.stages === 5 && dash.stageNames[0] === '1 · Frames & carcase' && dash.stageNames[4] === '5 · Finishing & QC', dash.stageNames);
  check('the board speaks the cell vocabulary, with an OT cell and a pulled cell', dash.ot && dash.pull && dash.vocab.length >= 4, dash.vocab);
  check('the headings carry ? badges, not sub-lines', dash.badges >= 3, dash.badges);
  check('the KPI six, in the handoff\'s order', dash.kpis.join('|') === 'Suites on the floor|Waiting for a stage|Pricing input owed|Fabric plans live|Overtime booked this week|Metres saved by single lay', dash.kpis);
  check('Stages today renders five, and no bar fill contains text', dash.stagesToday === 5 && dash.barsWithText === 0, dash);

  // ── the twelve pages and the money sweep ────────────────────────────
  console.log('\n— the twelve pages —');
  const pages = ['board', 'price', 'spec', 'plan', 'foam', 'fab', 'bay', 'fin', 'team', 'ot', 'rem', 'doc'];
  const pg = await page.evaluate(async (keys) => {
    const out = [];
    for (const k of keys) {
      UphUI.go('page', k);
      await new Promise(r => setTimeout(r, 120));
      const b = document.getElementById('uph-body');
      out.push({ k, title: (b.querySelector('.uph-page-t') || {}).textContent, stats: b.querySelectorAll('.uph-stat').length, rule: !!b.querySelector('.uph-rule-b'), ctx: !!b.querySelector('.uph-ctx'),
        primary: b.querySelectorAll('.uph-chips .uph-btn').length,
        // The register's side card NAMES what is hidden ("Fabric cost — no
        // selling price"); the sweep reads everything but that card.
        money: ((() => { const c = b.cloneNode(true); c.querySelectorAll('.uph-ctx').forEach(x => x.remove()); return c.textContent; })().match(/selling price|margin|\bprofit\b|quote value/i) || [null])[0],
        active: (document.querySelector('#uph-module-wrap .xs-item.active .xs-lbl') || {}).textContent });
    }
    return out;
  }, pages);
  check('all twelve pages render with a title, four stats, a rule card and a context card', pg.every(p => p.title && p.stats === 4 && p.rule && p.ctx), pg.filter(p => !(p.title && p.stats === 4 && p.rule && p.ctx)));
  check('Reminders and Documents have no primary button', pg.find(p => p.k === 'rem').primary === 0 && pg.find(p => p.k === 'doc').primary === 0, pg.map(p => p.k + ':' + p.primary));
  check('no selling price, margin, profit or quote value on any page', pg.every(p => !p.money), pg.filter(p => p.money));
  check('the rail follows the page', pg.every(p => p.active && p.active !== 'Dashboard'), pg.map(p => p.active));

  const fab = await page.evaluate(async (s) => {
    UphUI.go('page', 'fab'); await new Promise(r => setTimeout(r, 150));
    const rows = [...document.querySelectorAll('#uph-body .uph-mat')].map(m => ({ name: m.querySelector('.uph-mat-t').textContent, free: m.querySelector('.uph-mat-fv').textContent.trim(), res: m.querySelector('.uph-mat-res').textContent.trim(), resClass: m.querySelector('.uph-mat-res').className, cons: m.querySelector('.uph-mat-c').textContent }));
    const strip = !!document.querySelector('#uph-body .uph-qstrip');
    const cost = (document.querySelector('#uph-body .uph-ctx') || {}).textContent || '';
    UphUI.go('page', 'team'); await new Promise(r => setTimeout(r, 150));
    const crews = document.querySelectorAll('#uph-body .uph-crew').length, open = document.querySelectorAll('#uph-body .uph-crew.open').length;
    const men = document.querySelectorAll('#uph-body .uph-crew.open .uph-man').length;
    const leader = document.querySelectorAll('#uph-body .uph-lead').length;
    const loose = (document.querySelector('#uph-body .uph-loose-n') || {}).textContent;
    const realNames = [...document.querySelectorAll('#uph-body .uph-man-n')].map(x => x.textContent.replace('LEADER', '').replace(/Carpenter.*|Technician.*|Helper.*|Tailor.*|Upholsterer.*/, '').trim());
    return { rows, strip, cost, crews, open, men, leader, loose, realNames, roster: uphStageMembers.length, real: uphStageMembers.every(m => EMPLOYEE_RATES[m.name] && EMPLOYEE_RATES[m.name].department === 'Upholstery') };
  }, seed);
  check('the register shows the sofa roll Reserved, non-interactive, with the hold on its consequence line',
    fab.rows.some(r => /Sahara/.test(r.name) && r.res === 'Reserved' && /done/.test(r.resClass) && /held against the job card/.test(r.cons)), fab.rows);
  check('the COM roll reads short of need with "Nothing to reserve"',
    fab.rows.some(r => /COM/.test(r.name) && /Nothing to reserve/.test(r.res) && /of/.test(r.free)), fab.rows);
  check('fabric cost per metre is on the side card; no selling price', /Sahara 12.*BD 14\.500\/m/.test(fab.cost.replace(/\s+/g, ' ')) && /no selling price/i.test(fab.cost), fab.cost);
  check('the quotes strip sits inside the register, beside the rows it decides', fab.strip, fab.strip);
  check('five expandable stage cards, one open, with a LEADER chip', fab.crews === 5 && fab.open === 1 && fab.leader >= 1, fab);
  check('the roster is real upholstery staff from the payroll, not the handoff\'s invented names', fab.roster === 10 && fab.real, { roster: fab.roster, real: fab.real, names: fab.realNames.slice(0, 3) });

  // ── Finishing & QC drives the real pipeline, under the real authority ──
  console.log('\n— finishing & QC —');
  const qc = await page.evaluate(async (s) => {
    const job = getJobCard(s.sofa); const it = job.items[0];
    submitDepartmentBudget(job.id, 'uph', { materials: 300, labour: 200, subcontract: 0, hiring: 0, others: 0 }, 'Upholstery Supervisor');
    approveDepartmentBudget(job.id, 'uph', 'Operations Manager');
    startLineProduction(job.id, it.lineId, 'uph');
    UphUI.go('page', 'fin'); await new Promise(r => setTimeout(r, 150));
    const toQC = document.querySelector('#uph-body [data-a="to-qc"]'); if (toQC) toQC.click(); await new Promise(r => setTimeout(r, 150));
    const failBtn = document.querySelector('#uph-body [data-a="qc-fail"]'); if (failBtn) failBtn.click(); await new Promise(r => setTimeout(r, 200));
    // Snapshot primitives — the entry is the live object and mutates on.
    const snap = () => { const e = getJobCard(s.sofa).items[0].departmentStatuses.find(d => d.department === 'uph'); return { status: e.status, rejectReason: e.rejectReason || null }; };
    const entry1 = snap();
    const reason = (document.querySelector('#uph-body .uph-ctx') || {}).textContent;
    reworkLineBackToProduction(job.id, it.lineId, 'uph', 'Upholstery Supervisor');
    submitLineForQC(job.id, it.lineId, 'uph');
    UphUI.go('page', 'fin'); await new Promise(r => setTimeout(r, 150));
    document.querySelector('#uph-body [data-a="qc-pass"]').click(); await new Promise(r => setTimeout(r, 200));
    const entry2 = snap();
    const wrap = document.querySelector('#uph-body [data-a="handoff"]'); if (wrap) wrap.click(); await new Promise(r => setTimeout(r, 200));
    const entry3 = snap();
    return { s1: entry1.status, r1: entry1.rejectReason, reasonShown: /Nap wrong/.test(reason), s2: entry2.status, s3: entry3.status };
  }, seed);
  check('a fail from the bench goes back to the bay with its reason', qc.s1 === 'rework' && qc.r1 === 'Nap wrong on the inside back' && qc.reasonShown, qc);
  check('a pass is recorded under the department\'s QC authority and hands off', qc.s2 === 'ready-for-handoff' && qc.s3 === 'done', qc);

  // ── the gate table, exhaustively ────────────────────────────────────
  console.log('\n— the gate table —');
  const gates = await page.evaluate(async () => {
    const flows = ['price', 'spec', 'plan', 'foam', 'com', 'res', 'purch', 'quote', 'lab', 'allot'];
    const out = {};
    for (const f of flows) {
      UphUI.go('form', f); await new Promise(r => setTimeout(r, 100));
      const before = UphUI.state.gate;
      const opts = document.querySelectorAll('#uph-body .uph-opt');
      const states = [];
      for (let i = 0; i < opts.length; i++) {
        document.querySelectorAll('#uph-body .uph-opt')[i].click(); await new Promise(r => setTimeout(r, 60));
        const b = document.querySelector('#uph-body .uph-acts .uph-btn');
        states.push((b.disabled ? 'dead' : b.classList.contains('warn') ? 'warn' : 'live') + (b.textContent.trim() === 'Blocked' ? '!' : ''));
      }
      out[f] = { before, states, tabs: document.querySelectorAll('#uph-body .uph-tab-p').length };
    }
    return out;
  });
  const want = { price: 'live,warn,dead!', spec: 'warn,live,dead!', plan: 'live,dead!,dead!', foam: 'live,warn,dead!', com: 'live,warn,dead!', res: 'live,warn,dead!', purch: 'live,warn,dead!', quote: 'live,warn,dead!', lab: 'live,warn,dead!', allot: 'live,warn,dead!' };
  check('every flow opens with the gate unanswered', Object.values(gates).every(g => g.before === null), Object.keys(gates).filter(k => gates[k].before !== null));
  check('ten pills on every flow', Object.values(gates).every(g => g.tabs === 10), Object.values(gates).map(g => g.tabs));
  check('the primary is live, amber or dead exactly as the gate table says, and reads Blocked when dead',
    Object.keys(want).every(k => gates[k].states.join(',') === want[k]), Object.keys(want).filter(k => gates[k].states.join(',') !== want[k]).map(k => k + ':' + gates[k].states.join(',')));

  // ── granular roles, the legacy screen, dark, phone ──────────────────
  console.log('\n— roles, dark, phone —');
  const roles = await page.evaluate(async () => {
    hideModuleWrap(document.getElementById('uph-module-wrap'));
    launchUpholsteryTeamLeaderModule(); await new Promise(r => setTimeout(r, 200));
    const tl = [...document.querySelectorAll('#uph-module-wrap .xs-item .xs-lbl')].map(x => x.textContent.trim());
    const tlView = UphUI.state.view + ':' + UphUI.state.page;
    hideModuleWrap(document.getElementById('uph-module-wrap'));
    launchUpholsteryQCPackagingModule(); await new Promise(r => setTimeout(r, 200));
    const qcp = [...document.querySelectorAll('#uph-module-wrap .xs-item .xs-lbl')].map(x => x.textContent.trim());
    hideModuleWrap(document.getElementById('uph-module-wrap'));
    launchLegacyUpholsteryModule(); await new Promise(r => setTimeout(r, 200));
    const legacy = getComputedStyle(document.getElementById('upholstery-module-wrap')).display;
    hideModuleWrap(document.getElementById('upholstery-module-wrap'));
    const node = window.__eco3d.NODES.find(n => n.id === 'upholstery'); node.launch(); await new Promise(r => setTimeout(r, 200));
    const viaNode = getComputedStyle(document.getElementById('uph-module-wrap')).display;
    return { tl, tlView, qcp, legacy, viaNode };
  });
  check('the Team Leader lands on a slice of the rail with no Create… and no Dashboard', roles.tl.join('|') === 'Week board|Fabric plans|Foam schedules|Fabric & COM register|Crews & labour|Reminders' && roles.tlView === 'page:board', roles);
  check('QC / Packaging lands on Finishing & QC', roles.qcp[0] === 'Finishing & QC' && roles.qcp.indexOf('Create…') === -1, roles.qcp);
  check('the old pipeline wrapper is still reachable as the legacy screen', roles.legacy === 'flex', roles.legacy);
  check('the upholstery node opens the 20a module', roles.viaNode === 'flex', roles.viaNode);

  const dark = await page.evaluate(async () => {
    UphUI.go('dash', 'board'); await new Promise(r => setTimeout(r, 150));
    execThemeToggle(); await new Promise(r => setTimeout(r, 150));
    const bg = getComputedStyle(document.querySelector('#uph-body .uph-card')).backgroundColor;
    execThemeToggle();
    return bg;
  });
  check('dark mode re-themes the cards by computed style', dark !== 'rgb(255, 255, 255)' && dark !== 'rgba(0, 0, 0, 0)', dark);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => renderUphBody());
  await page.waitForTimeout(300);
  const phone = await page.evaluate(() => ({
    cols: getComputedStyle(document.querySelector('#uph-body .uph-dash')).flexDirection,
    overflow: document.documentElement.scrollWidth > 391,
    chip: getComputedStyle(document.querySelector('#uph-body .uph-qchip')).display,
    badge: getComputedStyle(document.querySelector('#uph-body .uph-q')).display,
    cardW: Math.round(document.querySelector('#uph-body .uph-board').getBoundingClientRect().width)
  }));
  check('single column on a phone, no sideways overflow, tappable chips instead of hover badges',
    phone.cols === 'column' && !phone.overflow && phone.chip !== 'none' && phone.badge === 'none' && phone.cardW <= 390, phone);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 4));
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
