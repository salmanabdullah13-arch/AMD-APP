// Verification for the Production Manager data layer (design handoff 19a).
//
// 19a names five design commitments and says they are the point of the
// module. They are the spine of this file, in its own order. Every check
// drives the real data layer and asserts on real record state.

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

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  // One real routed job with a BOM, plus store stock to gate against.
  await page.evaluate(() => {
    const c = createCustomer({ name: 'Prd Co', contactPerson: 'A', tel: '17888001', address: 'Manama' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Prd test', taxPercent: 0, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Wardrobe run', qty: 1, unit: 'Nos' });
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah', 'owner');
    const job = confirmQuotationToJobCard(q.id, 'Sales');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    const item = itemMaster[0];
    // The job needs 10 of an item the store holds 0 of, until we put some away.
    job.items[0].bom = { materials: [{ itemId: item.id, qty: 10, name: item.name }] };
    const loc = createStoreLocation({ name: 'Prd Store' });
    const bin = createStoreBin({ storeId: loc.id, code: 'P1' });
    window.__p = { job: job.id, item: item.id, bin: bin.id };
  });

  console.log('\n— commitment 1: no lane slot without material and a live BOM —');
  const gate1 = await page.evaluate(() => {
    const shortReason = jobLaneBlockReason(window.__p.job);
    const refused = allotLaneSlot({ crewId: 'CREW-A', jobCardId: window.__p.job, date: '2026-08-24' });
    const waiting = getWaitingForLane().find(w => w.job.id === window.__p.job);
    // Material arrives and is put away — the gate clears on its own.
    putAwayStock({ itemId: window.__p.item, binId: window.__p.bin, qty: 50 });
    const clearReason = jobLaneBlockReason(window.__p.job);
    const ok = allotLaneSlot({ crewId: 'CREW-A', jobCardId: window.__p.job, date: '2026-08-24' });
    window.__p.slot = ok.slot && ok.slot.id;
    return {
      shortReason, refusedErr: refused.error,
      waitingReason: waiting && waiting.reason,
      clearReason, allotted: !!(ok.slot), slots: laneSlots.length
    };
  });
  check('a material-short job is refused a lane, with the reason',
    !!gate1.refusedErr && /Material short/.test(gate1.shortReason), gate1);
  check('the refused job sits in the waiting strip carrying that reason',
    /Material short/.test(gate1.waitingReason || ''), gate1.waitingReason);
  check('when the material lands, the gate clears with nothing having to run',
    gate1.clearReason === null && gate1.allotted === true, gate1);

  const noBom = await page.evaluate(() => {
    const j = getJobCard(window.__p.job);
    const saved = j.items[0].bom;
    j.items[0].bom = null;
    const reason = jobLaneBlockReason(window.__p.job);
    j.items[0].bom = saved;
    return reason;
  });
  check('a job with no BOM is refused too — material alone is not enough',
    /No BOM/.test(noBom), noBom);

  const overload = await page.evaluate(() => {
    const c2 = createCustomer({ name: 'Prd Co 2', contactPerson: 'A', tel: '17888002', address: 'Manama' });
    const e2 = createEnquiry({ division: 'Joinery', customerId: c2.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q2 = convertEnquiryToQuotation(e2.id, { projectName: 'Prd test 2', taxPercent: 0, contactPerson: 'A' });
    addQuotationItem(q2.id, { product: 'Side unit', qty: 1, unit: 'Nos' });
    transferQuotationStage(q2.id, 'approver', 'Estimator');
    approveQuotation(q2.id, 'Salman Abdullah', 'owner');
    const j2 = confirmQuotationToJobCard(q2.id, 'Sales');
    confirmJobRouting(j2.id, {}, 'Operations Manager');
    j2.items[0].bom = { materials: [{ itemId: window.__p.item, qty: 1, name: 'x' }] };
    window.__p.job2 = j2.id;
    const r = allotLaneSlot({ crewId: 'CREW-A', jobCardId: j2.id, date: '2026-08-24' });
    return { warned: r.warning, stillBooked: !!r.slot };
  });
  check('two jobs on one crew is allowed but never silent',
    overload.stillBooked === true && /overloaded/i.test(overload.warned || ''), overload);

  console.log('\n— commitment 2: paint and install pull their dates from joinery —');
  const pull = await page.evaluate(() => {
    const paint = allotDerivedSlot({ crewId: 'CREW-P', baseSlotId: window.__p.slot, offsetDays: 3 });
    const install = allotDerivedSlot({ crewId: 'CREW-I', baseSlotId: paint.slot.id, offsetDays: 2 });
    const before = { paint: slotDate(paint.slot), install: slotDate(install.slot) };
    const moveDerived = moveLaneSlot(paint.slot.id, '2026-09-01');
    moveLaneSlot(window.__p.slot, '2026-08-31');   // joinery slips a week
    const after = { paint: slotDate(paint.slot), install: slotDate(install.slot) };
    return { before, after, moveDerivedErr: moveDerived.error };
  });
  check('a derived slot is upstream date + offset',
    pull.before.paint === '2026-08-27' && pull.before.install === '2026-08-29', pull.before);
  check('moving joinery moves paint AND install with it — no hand cascade',
    pull.after.paint === '2026-09-03' && pull.after.install === '2026-09-05', pull.after);
  check('a derived slot cannot be moved directly — it has no date of its own',
    !!pull.moveDerivedErr, pull.moveDerivedErr);

  console.log('\n— commitment 3: hours and quantities, never a price —');
  const inp = await page.evaluate(() => {
    const wrongRole = raiseInputRequest({ type: 'pricing_input', raisedBy: 'Ops', raiserRole: 'operations_manager', question: 'Hours for the lobby counter?' });
    const r = raiseInputRequest({ type: 'pricing_input', raisedBy: 'Arun Kumar A', raiserRole: 'estimator', question: 'Hours for the lobby counter?', neededBy: '2026-08-21' });
    const priced = answerInputRequest(r.id, { manHours: 46, price: 320 });
    const rate = answerInputRequest(r.id, { manHours: 46, hourlyRateBD: 2.5 });
    const ok = answerInputRequest(r.id, { manHours: 46, boards: 12, wastagePct: 8, note: 'incl. corian bonding' });
    const twice = answerInputRequest(r.id, { manHours: 1 });
    return { wrongRoleErr: wrongRole.error, pricedErr: priced.error, rateErr: rate.error, answered: ok.status, answer: ok.answer, twiceErr: twice.error };
  });
  check('pricing input can only be raised by the estimator', !!inp.wrongRoleErr, inp.wrongRoleErr);
  check('an answer carrying a price is refused', !!inp.pricedErr, inp.pricedErr);
  check('so is one carrying a rate — whitelist, not blacklist', !!inp.rateErr, inp.rateErr);
  check('hours and quantities go through',
    inp.answered === 'answered' && inp.answer.manHours === 46 && inp.answer.wastagePct === 8, inp.answer);
  check('a request is answered once', !!inp.twiceErr, inp.twiceErr);

  const budg = await page.evaluate(() => {
    const wrongRole = raiseInputRequest({ type: 'bom_budget_input', raisedBy: 'Arun Kumar A', raiserRole: 'estimator', question: 'Standard lacquer consumption per sqm?' });
    const r = raiseInputRequest({ type: 'bom_budget_input', raisedBy: 'Operations Manager', raiserRole: 'operations_manager', question: 'Standard lacquer consumption per sqm?' });
    return { wrongRoleErr: wrongRole.error, ok: !r.error };
  });
  check('budget input can only be raised by operations — different asker, different question',
    !!budg.wrongRoleErr && budg.ok === true, budg);

  console.log('\n— commitment 4: a BOM change kills the cutting list —');
  const cut = await page.evaluate(() => {
    const sheet = createCuttingSheet({ jobCardId: window.__p.job, saw: 'saw 2' });
    markSheetOnSaw(sheet.id);
    window.__p.sheet = sheet.id;
    const pendingStart = startBOMRevision(window.__p.job, 'Production Manager', 'client widened the run');
    const laneWhilePending = jobLaneBlockReason(window.__p.job);
    const cutWhilePending = createCuttingSheet({ jobCardId: window.__p.job });
    const issued = issueBOMRevision(window.__p.job, 'Production Manager');
    const s = cuttingSheets.find(x => x.id === sheet.id);
    const laneAfterIssue = jobLaneBlockReason(window.__p.job);
    const recutTooSoon = createCuttingSheet({ jobCardId: window.__p.job });
    return {
      rev0: sheet.revisionLetter, pendingOk: !pendingStart.error,
      laneWhilePending, cutWhilePendingErr: cutWhilePending.error,
      newLetter: issued.letter, sheetStatus: s.status,
      laneAfterIssue, recutErr: recutTooSoon.error
    };
  });
  check('the first sheet cuts from REV A', cut.rev0 === 'A', cut.rev0);
  check('a pending revision blocks the lane at once — the numbers are moving',
    /revision pending/i.test(cut.laneWhilePending || ''), cut.laneWhilePending);
  check('and blocks cutting a new sheet', !!cut.cutWhilePendingErr, cut.cutWhilePendingErr);
  check('issuing REV B kills the sheet on the saw', cut.newLetter === 'B' && cut.sheetStatus === 'dead', cut);
  check('the gate does NOT clear on issuing the revision',
    /still on the saw/i.test(cut.laneAfterIssue || ''), cut.laneAfterIssue);
  check('recutting is refused while the dead paper is out', !!cut.recutErr, cut.recutErr);

  const clear4 = await page.evaluate(() => {
    confirmSheetOffSaw(window.__p.sheet, 'Production Manager');
    const lane = jobLaneBlockReason(window.__p.job);
    const recut = createCuttingSheet({ jobCardId: window.__p.job, saw: 'saw 1' });
    return { lane, recutLetter: recut.revisionLetter, recutOk: !recut.error };
  });
  check('it clears on confirming the old sheet OFF the saw',
    clear4.lane === null && clear4.recutOk === true, clear4);
  check('the new sheet cuts from REV B', clear4.recutLetter === 'B', clear4.recutLetter);

  console.log('\n— commitment 5: overtime buys hours, not material —');
  const ot = await page.evaluate(() => {
    const noCause = bookOvertimeShift({ crewId: 'CREW-A', date: '2026-08-25', hours: 3, men: 4, recoversTarget: window.__p.job });
    const freeText = bookOvertimeShift({ crewId: 'CREW-A', date: '2026-08-25', hours: 3, men: 4, recoversTarget: window.__p.job, cause: 'ran late' });
    const noTarget = bookOvertimeShift({ crewId: 'CREW-A', date: '2026-08-25', hours: 3, men: 4, cause: 'Material late' });
    const ok = bookOvertimeShift({ crewId: 'CREW-A', date: '2026-08-25', hours: 3, men: 4, recoversTarget: window.__p.job, cause: 'BOM revision late' });
    return { noCauseErr: noCause.error, freeTextErr: freeText.error, noTargetErr: noTarget.error, booked: !ok.error, byCause: getOvertimeByCause(28) };
  });
  check('a shift with no cause is refused', !!ot.noCauseErr, ot.noCauseErr);
  check('a free-text cause is refused — the enum is closed so the pattern shows',
    !!ot.freeTextErr, ot.freeTextErr);
  check('a shift with no recovery target is refused', !!ot.noTargetErr, ot.noTargetErr);
  check('a proper shift books, and rolls up by cause',
    ot.booked === true && ot.byCause.some(c => c.cause === 'BOM revision late' && c.hours === 3), ot.byCause);

  const idle = await page.evaluate(() => {
    // A job that is material-short with no lane booked: a paid idle day.
    const j = getJobCard(window.__p.job2);
    j.items[0].bom = { materials: [{ itemId: window.__p.item, qty: 99999, name: 'x' }] };
    laneSlots.splice(0, laneSlots.length,
      ...laneSlots.filter(s => s.jobCardId !== window.__p.job2));
    const r = bookOvertimeShift({ crewId: 'CREW-B', date: '2026-08-25', hours: 8, men: 5, recoversTarget: window.__p.job2, cause: 'Material late' });
    return { err: r.error };
  });
  check('overtime on a short job with nothing to work on is refused — a paid idle day',
    !!idle.err && /nothing to work on/i.test(idle.err), idle.err);

  console.log('\n— pressing, the asked-of-you card, and the KPIs —');
  const rest = await page.evaluate(() => {
    const b = createPressingBatch({ veneer: 'Oak crown' });
    addJobToPressingBatch(b.id, window.__p.job, 6);
    const empty = createPressingBatch({ veneer: 'Walnut' });
    const emptyPress = pressBatch(empty.id);
    const pressed = pressBatch(b.id);
    const asked = getAskedOfYouToday();
    const k = getProductionKPIs();
    return {
      pressed: pressed.status, emptyErr: emptyPress.error,
      askedKinds: asked.map(a => a.kind),
      hasBudgetAsk: asked.some(a => a.kind === 'BOM input for budgeting'),
      k
    };
  });
  check('a batch presses; an empty press run is refused',
    rest.pressed === 'pressed' && !!rest.emptyErr, rest);
  check('"Asked of you today" pulls typed rows from the systems that own them',
    rest.hasBudgetAsk === true, rest.askedKinds);
  check('the KPIs are real numbers off the same queues',
    typeof rest.k.waitingForLane === 'number' && rest.k.otHoursThisMonth === 3, rest.k);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
