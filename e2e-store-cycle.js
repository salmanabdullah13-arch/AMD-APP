// Verification for the Store Keeper data layer (design handoff 18a).
//
// 18a names three design commitments and says they are the point of the
// module — location leads, every quantity is three numbers, and cover mode
// — plus one absolute rule: material leaves the store against a job card
// and nothing else, blocking rather than warning, with no override.
//
// Those four things are the spine of this file. Every check drives the real
// data layer and asserts on real record state, never on rendered text.

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

  console.log('\n— location leads: a bin belongs to a store —');
  const loc = await page.evaluate(() => {
    const riffa = createStoreLocation({ name: 'Riffa' });
    const tubli = createStoreLocation({ name: 'Tubli' });
    const dupStore = createStoreLocation({ name: 'riffa' });
    const a1r = createStoreBin({ storeId: riffa.id, code: 'A1', whatLivesHere: 'Ply sheets', hint: 'Leaning against the far wall, behind the door' });
    const a1t = createStoreBin({ storeId: tubli.id, code: 'A1', whatLivesHere: 'Hinges', hint: 'Top shelf, blue crate' });
    const dupBin = createStoreBin({ storeId: riffa.id, code: 'a1' });
    const orphan = createStoreBin({ storeId: 'nope', code: 'Z9' });
    window.__s = { riffa: riffa.id, tubli: tubli.id, a1r: a1r.id, a1t: a1t.id };
    return {
      dupStoreErr: dupStore.error, dupBinErr: dupBin.error, orphanErr: orphan.error,
      bothExist: a1r.id !== a1t.id,
      labelR: binLabel(a1r.id), labelT: binLabel(a1t.id),
      hintR: binHint(a1r.id)
    };
  });
  check('a second store with the same name is refused', !!loc.dupStoreErr, loc.dupStoreErr);
  check('a bin needs a real store', !!loc.orphanErr, loc.orphanErr);
  check('A1 in Riffa and A1 in Tubli are different bins', loc.bothExist === true, loc);
  check('a bin label is always qualified by its store',
    loc.labelR.includes('Riffa') && loc.labelT.includes('Tubli') && loc.labelR !== loc.labelT, loc);
  check('the same code twice in ONE store is refused', !!loc.dupBinErr, loc.dupBinErr);
  check('the bin carries cover mode\'s hint as real data',
    /far wall/.test(loc.hintR), loc.hintR);

  console.log('\n— three numbers: on hand, held, free —');
  const nums = await page.evaluate(() => {
    const item = itemMaster[0].id;
    window.__s.item = item;
    putAwayStock({ itemId: item, binId: window.__s.a1r, qty: 100 });
    putAwayStock({ itemId: item, binId: window.__s.a1t, qty: 40 });
    const noBin = putAwayStock({ itemId: item, binId: 'BIN-9999', qty: 5 });
    const noQty = putAwayStock({ itemId: item, binId: window.__s.a1r, qty: 0 });
    return {
      noBinErr: noBin.error, noQtyErr: noQty.error,
      perBinR: stockOnHand(item, window.__s.a1r),
      perBinT: stockOnHand(item, window.__s.a1t),
      total: stockOnHand(item, null),
      freeBefore: stockFree(item, window.__s.a1r),
      rows: getStockRows().filter(r => r.itemId === item).length
    };
  });
  check('stock cannot be put into a bin that does not exist', !!nums.noBinErr, nums.noBinErr);
  check('a put-away needs a quantity', !!nums.noQtyErr, nums.noQtyErr);
  check('stock is held per bin, not as one global number',
    nums.perBinR === 100 && nums.perBinT === 40 && nums.total === 140, nums);
  check('the same item in two stores is two rows', nums.rows === 2, nums.rows);
  check('with no holds, free equals on hand', nums.freeBefore === 100, nums.freeBefore);

  console.log('\n— a hold belongs to a job card, and free is derived —');
  const hold = await page.evaluate(() => {
    // A real job to hold against.
    const c = createCustomer({ name: 'Store Co', contactPerson: 'A', tel: '17999001', address: 'Manama' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Store test', taxPercent: 0, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Cabinet', qty: 1, unit: 'Nos' });
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah', 'owner');
    const job = confirmQuotationToJobCard(q.id, 'Sales');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    window.__s.job = job.id;

    const noJob = reserveStockForJob({ itemId: window.__s.item, binId: window.__s.a1r, qty: 10 });
    const fake = reserveStockForJob({ itemId: window.__s.item, binId: window.__s.a1r, qty: 10, jobCardId: 'JB-NOPE' });
    const r = reserveStockForJob({ itemId: window.__s.item, binId: window.__s.a1r, qty: 30, jobCardId: job.id });
    const tooMuch = reserveStockForJob({ itemId: window.__s.item, binId: window.__s.a1r, qty: 999, jobCardId: job.id });
    window.__s.res = r.id;
    return {
      noJobErr: noJob.error, fakeErr: fake.error, tooMuchErr: tooMuch.error,
      onHand: stockOnHand(window.__s.item, window.__s.a1r),
      held: stockHeld(window.__s.item, window.__s.a1r),
      free: stockFree(window.__s.item, window.__s.a1r),
      expires: r.expiresOn, heldSince: r.heldSince
    };
  });
  check('a hold with no job card is refused', !!hold.noJobErr, hold.noJobErr);
  check('a hold against a job that does not exist is refused', !!hold.fakeErr, hold.fakeErr);
  check('holding more than is free is refused', !!hold.tooMuchErr, hold.tooMuchErr);
  check('a hold does not change on hand — it changes free',
    hold.onHand === 100 && hold.held === 30 && hold.free === 70, hold);
  check('the hold carries a real seven-day expiry', !!hold.expires && hold.expires > hold.heldSince, hold);

  console.log('\n— stale at three days, expired at seven, and free recovers on its own —');
  const ageing = await page.evaluate(() => {
    const r = reservations.find(x => x.id === window.__s.res);
    const fresh = reservationState(r);
    r.heldSince = addDaysISO(storeToday(), -4);            // four days old
    const stale = reservationState(r);
    const staleInQueue = getStaleReservations().some(x => x.id === r.id);
    r.expiresOn = addDaysISO(storeToday(), -1);            // lapsed yesterday
    const expired = reservationState(r);
    const freeAfter = stockFree(window.__s.item, window.__s.a1r);
    const heldAfter = stockHeld(window.__s.item, window.__s.a1r);
    const swept = expireLapsedReservations();
    return { fresh, stale, staleInQueue, expired, freeAfter, heldAfter, swept, status: r.status };
  });
  check('a hold made today is simply held', ageing.fresh === 'held', ageing.fresh);
  check('past three days it reads stale and joins the dashboard queue',
    ageing.stale === 'stale' && ageing.staleInQueue === true, ageing);
  check('past its expiry it reads expired', ageing.expired === 'expired', ageing.expired);
  check('an expired hold returns the stock to free with nothing having to run',
    ageing.freeAfter === 100 && ageing.heldAfter === 0, ageing);
  check('the sweep only tidies the record afterwards',
    ageing.swept === 1 && ageing.status === 'expired', ageing);

  console.log('\n— THE HARD GATE: no job card, no material —');
  const gate = await page.evaluate(() => {
    const line = [{ itemId: window.__s.item, binId: window.__s.a1r, qty: 5 }];
    const before = stockOnHand(window.__s.item, window.__s.a1r);
    const none = issueMaterialToJob({ lines: line });
    const general = issueMaterialToJob({ jobCardId: 'general use', lines: line });
    const general2 = issueMaterialToJob({ jobCardId: 'General', lines: line });
    const fake = issueMaterialToJob({ jobCardId: 'JB-NOPE', lines: line });
    const empty = issueMaterialToJob({ jobCardId: window.__s.job, lines: [] });
    return {
      noneErr: none.error, generalErr: general.error, general2Err: general2.error,
      fakeErr: fake.error, emptyErr: empty.error,
      moved: before - stockOnHand(window.__s.item, window.__s.a1r),
      issues: storeIssues.length
    };
  });
  check('issuing with no job card is refused', !!gate.noneErr, gate.noneErr);
  check('"general use" is refused by name, with no override',
    !!gate.generalErr && /not a job card/i.test(gate.generalErr), gate.generalErr);
  check('so is "General", however it is typed', !!gate.general2Err, gate.general2Err);
  check('a job card that does not exist is refused', !!gate.fakeErr, gate.fakeErr);
  check('an issue with no lines is refused', !!gate.emptyErr, gate.emptyErr);
  check('not one unit of stock moved through any of those', gate.moved === 0 && gate.issues === 0, gate);

  console.log('\n— cleared to issue against a real job card —');
  const issued = await page.evaluate(() => {
    const r = reserveStockForJob({ itemId: window.__s.item, binId: window.__s.a1r, qty: 20, jobCardId: window.__s.job });
    const freeWhileHeld = stockFree(window.__s.item, window.__s.a1r);
    // Its own hold is available to this job even though it is not "free".
    const iss = issueMaterialToJob({
      jobCardId: window.__s.job,
      lines: [{ itemId: window.__s.item, binId: window.__s.a1r, qty: 20 }],
      issuedTo: 'Joinery'
    });
    const res = reservations.find(x => x.id === r.id);
    return {
      freeWhileHeld, ok: !iss.error, id: iss.id,
      onHand: stockOnHand(window.__s.item, window.__s.a1r),
      resStatus: res.status,
      logged: activityLog.some(a => a.type === 'stock-issued')
    };
  });
  check('a job can draw on its own hold even though it is not free to others',
    issued.freeWhileHeld === 80 && issued.ok === true, issued);
  check('issuing takes the stock off the shelf', issued.onHand === 80, issued.onHand);
  check('a collected hold is marked spent, not left dangling',
    issued.resStatus === 'collected', issued.resStatus);
  check('the issue reaches the activity log', issued.logged === true, issued.logged);

  console.log('\n— an over-issue is refused before anything moves —');
  const over = await page.evaluate(() => {
    const before = stockOnHand(window.__s.item, window.__s.a1r);
    const r = issueMaterialToJob({
      jobCardId: window.__s.job,
      lines: [
        { itemId: window.__s.item, binId: window.__s.a1r, qty: 5 },
        { itemId: window.__s.item, binId: window.__s.a1r, qty: 99999 }
      ]
    });
    return { err: r.error, moved: before - stockOnHand(window.__s.item, window.__s.a1r) };
  });
  check('one bad line refuses the whole issue', !!over.err, over.err);
  check('and the good line on the same request did NOT move either',
    over.moved === 0, over.moved);

  console.log('\n— put-away from a real goods receipt —');
  const put = await page.evaluate(() => {
    const sup = createSupplier({ name: 'Store Supplier', contactPerson: 'C', telephone: '17999002', address: 'Manama' });
    const po = createPurchaseOrderDirect({
      department: 'purchase', destinationType: 'inventory',
      supplierDetails: { supplierId: sup.id, supplierNameTel: 'Store Supplier' },
      items: [{ name: 'Ply 18mm', qty: 50, unit: 'Nos', fxRateBD: 4, itemId: window.__s.item }]
    });
    approvePO(po.id, 'Operations Manager');
    const g = recordGoodsReceipt({ poId: po.id, lines: [{ lineIndex: 0, receivedQty: 50 }] });
    const waitingBefore = getAwaitingPutAway().length;
    const done = putAwayReceiptLine(g.id, 0, window.__s.a1t);
    const twice = putAwayReceiptLine(g.id, 0, window.__s.a1t);
    return {
      waitingBefore, twiceErr: twice.error,
      bin: done.putAwayBinId, waitingAfter: getAwaitingPutAway().length,
      tubliNow: stockOnHand(window.__s.item, window.__s.a1t)
    };
  });
  check('a received line waits to be put away', put.waitingBefore >= 1, put.waitingBefore);
  check('putting it away lands the stock in a real bin',
    put.bin && put.tubliNow === 90, put);
  check('it leaves the put-away queue', put.waitingAfter === put.waitingBefore - 1, put);
  check('the same line cannot be put away twice', !!put.twiceErr, put.twiceErr);

  console.log('\n— transfers between stores —');
  const trf = await page.evaluate(() => {
    const same = createStoreTransfer({ fromStoreId: window.__s.riffa, toStoreId: window.__s.riffa, lines: [{ itemId: window.__s.item, binId: window.__s.a1r, qty: 1 }] });
    reserveStockForJob({ itemId: window.__s.item, binId: window.__s.a1r, qty: 75, jobCardId: window.__s.job });
    const heldBlocked = createStoreTransfer({
      fromStoreId: window.__s.riffa, toStoreId: window.__s.tubli,
      lines: [{ itemId: window.__s.item, binId: window.__s.a1r, qty: 70 }]
    });
    const t = createStoreTransfer({
      fromStoreId: window.__s.riffa, toStoreId: window.__s.tubli,
      lines: [{ itemId: window.__s.item, binId: window.__s.a1r, qty: 5 }]
    });
    const leftSource = stockOnHand(window.__s.item, window.__s.a1r);
    const noBin = receiveStoreTransfer(t.id);
    t.lines[0].toBinId = window.__s.a1t;
    const recv = receiveStoreTransfer(t.id);
    return {
      sameErr: same.error, heldBlockedErr: heldBlocked.error, noBinErr: noBin.error,
      leftSource, arrived: stockOnHand(window.__s.item, window.__s.a1t),
      status: recv.status
    };
  });
  check('a transfer to the same store is refused', !!trf.sameErr, trf.sameErr);
  check('stock held for a job cannot be transferred away', !!trf.heldBlockedErr, trf.heldBlockedErr);
  check('stock leaves the source bin immediately, so it cannot be issued twice',
    trf.leftSource === 75, trf.leftSource);
  check('it cannot be booked in without a destination bin', !!trf.noBinErr, trf.noBinErr);
  check('receiving it lands the stock in the other store',
    trf.arrived === 95 && trf.status === 'received', trf);

  console.log('\n— returns, and scrap never going back on the shelf —');
  const ret = await page.evaluate(() => {
    const before = stockOnHand(window.__s.item, window.__s.a1t);
    const noCondition = bookStoreReturn({ itemId: window.__s.item, qty: 3, binId: window.__s.a1t });
    const good = bookStoreReturn({ itemId: window.__s.item, qty: 3, binId: window.__s.a1t, condition: 'Good — back to stock' });
    const afterGood = stockOnHand(window.__s.item, window.__s.a1t);
    const scrap = bookStoreReturn({ itemId: window.__s.item, qty: 10, condition: 'Damaged — scrap' });
    const afterScrap = stockOnHand(window.__s.item, window.__s.a1t);
    return {
      noConditionErr: noCondition.error, goodStatus: good.status,
      wentBack: afterGood - before, scrapStatus: scrap.status,
      scrapMoved: afterScrap - afterGood
    };
  });
  check('a return needs a condition', !!ret.noConditionErr, ret.noConditionErr);
  check('good material goes back on the shelf',
    ret.goodStatus === 'booked-in' && ret.wentBack === 3, ret);
  check('scrap is recorded but NOT added to stock',
    ret.scrapStatus === 'scrapped' && ret.scrapMoved === 0, ret);

  console.log('\n— shorts are computed against real jobs, never typed —');
  const shorts = await page.evaluate(() => {
    const q = quotations.find(x => x.lifecycleStatus === 'confirmed');
    const job = getJobCard(window.__s.job);
    // Give the job a BOM line for far more than the store holds.
    job.items[0].bom = { materials: [{ itemId: window.__s.item, qty: 99999, name: 'Ply' }] };
    const rows = getStoreShorts();
    const mine = rows.find(r => r.forJob === window.__s.job);
    return { any: rows.length > 0, needed: mine && mine.needed, short: mine && mine.short, why: mine && mine.why };
  });
  check('a job needing more than the store has free shows as short',
    shorts.any === true && shorts.needed === 99999, shorts);
  check('the shortfall says why in plain words', /free|None in the store/.test(shorts.why || ''), shorts.why);

  console.log('\n— tools on loan —');
  const tools = await page.evaluate(() => {
    const noWho = bookToolOut({ toolName: 'Mitre saw' });
    const l = bookToolOut({ toolName: 'Mitre saw', withWhom: 'Shibu', site: 'Villa 5' });
    const overdueBefore = getOverdueTools().length;
    l.dueBack = addDaysISO(storeToday(), -2);
    const overdueAfter = getOverdueTools().length;
    const back = returnTool(l.id);
    const twice = returnTool(l.id);
    return { noWhoErr: noWho.error, overdueBefore, overdueAfter, status: back.status, twiceErr: twice.error };
  });
  check('a tool loan needs a person', !!tools.noWhoErr, tools.noWhoErr);
  check('a loan past its due-back date is overdue',
    tools.overdueBefore === 0 && tools.overdueAfter === 1, tools);
  check('returning it closes the loan once', tools.status === 'returned' && !!tools.twiceErr, tools);

  console.log('\n— a stock count is only worth doing if it becomes the truth —');
  const count = await page.evaluate(() => {
    const c = startStockCount({ area: 'Riffa A row', binIds: [window.__s.a1r], blind: true });
    const systemQty = c.lines[0].systemQty;
    const closeEarly = closeStockCount(c.id);
    recordCountLine(c.id, window.__s.item, window.__s.a1r, systemQty - 6);
    const variances = countVariances(c);
    const closed = closeStockCount(c.id, 'Storekeeper');
    const bin = storeBins.find(b => b.id === window.__s.a1r);
    return {
      blind: c.blind, systemQty, closeEarlyErr: closeEarly.error, variances,
      status: closed.status, nowOnHand: stockOnHand(window.__s.item, window.__s.a1r),
      binChecked: bin.lastCheckedDate
    };
  });
  check('a count starts blind by default', count.blind === true, count.blind);
  check('it cannot be closed with lines uncounted', !!count.closeEarlyErr, count.closeEarlyErr);
  check('a difference is recorded as a variance', count.variances === 1, count.variances);
  check('closing applies the variance to real stock',
    count.status === 'closed' && count.nowOnHand === count.systemQty - 6, count);
  check('and marks the bin as checked', !!count.binChecked, count.binChecked);

  console.log('\n— the dashboard queues, stores card and cover mode —');
  const dash = await page.evaluate(() => {
    const k = getStoreKPIs();
    const stores = getStoreSummaries();
    const before = coverModeOn();
    setCoverMode(true);
    const on = coverModeOn();
    setCoverMode(false);
    return {
      k, stores: stores.length,
      riffa: stores.find(s => s.store.name === 'Riffa'),
      movements: getStoreMovements().length,
      queues: { rec: stkQueueREC().length, iss: stkQueueISS().length, res: stkQueueRES().length, short: stkQueueSHORT().length, put: stkQueuePUT().length },
      coverDefault: before, coverOn: on, coverOff: coverModeOn()
    };
  });
  check('every dashboard step has a real queue function',
    Object.values(dash.queues).every(v => typeof v === 'number'), dash.queues);
  check('the stores card reports each store separately',
    dash.stores === 2 && dash.riffa.bins === 1, dash);
  check('each store reports its own three numbers',
    typeof dash.riffa.onHand === 'number' && typeof dash.riffa.held === 'number' && typeof dash.riffa.free === 'number', dash.riffa);
  check('movements show real activity', dash.movements > 0, dash.movements);
  check('cover mode defaults off and persists when toggled',
    dash.coverDefault === false && dash.coverOn === true && dash.coverOff === false, dash);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
