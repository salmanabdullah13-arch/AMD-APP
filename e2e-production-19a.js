/**
 * e2e-production-19a.js — Production manager module (design handoff 19a)
 *
 * The dashboard half: the shell, "Asked of you today", the week board and its
 * seven-state cell vocabulary, the waiting-for-a-lane strip, the paperwork
 * queue and the right column.
 *
 * The five design commitments are enforced in production-data.js, not here, so
 * the checks below drive the REAL data layer and assert on real records —
 * a screen that renders a lane the gate would have refused is the failure
 * this file exists to catch.
 */
const { chromium } = require('@playwright/test');
const path = require('path');

// Local calendar dates, matching the app (data.js localISO/todayISO).
const localISO = (d) => { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const todayISO = () => localISO(new Date());

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
  page.on('dialog', d => d.accept());

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  console.log('\n— the BOM lives on the quotation, not the job card —');
  // The bug this module shipped with on day one: production-data.js read
  // job.items[].bom, which confirmQuotationToJobCard() never copies, so
  // jobHasLiveBOM() was false for every job that could ever exist and the
  // lane gate could never open. Guard it directly.
  const bomTrace = await page.evaluate(() => {
    const c = createCustomer({ name: 'Prd BOM Co', contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'Tubli' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Prd BOM project', taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Wardrobe carcass', qty: 4, unit: 'Nos' });
    const it = quotations.find(x => x.id === q.id).items[0];
    addBOMMaterial(q.id, it.lineId, { name: itemMaster[0].name, qty: 6, rate: 25, unit: itemMaster[0].unit });
    submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
    setItemDepartmentSequence(q.id, it.lineId, ['carp']);
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(q.id, 'Sales');
    confirmJobRouting(job.id, {}, 'Operations Manager', null);
    return {
      jobItemHasBom: !!(job.items[0] && job.items[0].bom),
      resolvedViaQuotation: jobBOMItems(job.id).some(x => x.bom && x.bom.materials.length),
      hasLiveBOM: jobHasLiveBOM(job.id),
      jobId: job.id, itemId: itemMaster[0].id
    };
  });
  check('a Job Card item genuinely carries no BOM (this is why the trace exists)',
    bomTrace.jobItemHasBom === false, bomTrace);
  check('jobBOMItems() resolves it through the job\'s quotation',
    bomTrace.resolvedViaQuotation === true, bomTrace);
  check('so jobHasLiveBOM() is true for a real costed job', bomTrace.hasLiveBOM === true, bomTrace);

  console.log('\n— commitment 1: no lane slot without material and a live BOM —');
  const gate = await page.evaluate((t) => {
    const before = allotLaneSlot({ crewId: 'CREW-A', jobCardId: t.jobId, date: todayISO(), portion: 'full', byWhom: 'Test' });
    const reason = jobLaneBlockReason(t.jobId);
    // give it the material it is short of, through 18a's own functions
    const store = storeLocations[0] || createStoreLocation({ name: 'Test Store', address: 'Tubli' });
    const bin = storeBins[0] || createStoreBin({ storeId: store.id, code: 'A1', whatLivesHere: 'Boards' });
    putAwayStock({ itemId: t.itemId, binId: bin.id, qty: 50, source: 'test' });
    const after = allotLaneSlot({ crewId: 'CREW-A', jobCardId: t.jobId, date: todayISO(), portion: 'full', byWhom: 'Test' });
    return {
      refusedReason: before && before.error, blockReason: reason,
      acceptedId: after && after.slot && after.slot.id, nowClear: jobLaneBlockReason(t.jobId)
    };
  }, bomTrace);
  check('the lane refuses a job whose material is short', /short/i.test(gate.refusedReason || ''), gate);
  check('and says so, with the reason on the job', /short/i.test(gate.blockReason || ''), gate);
  check('once the material is really there, the lane takes it',
    !!gate.acceptedId && gate.nowClear === null, gate);

  // Taking a lane slot CLAIMS the boards (23 Aug 2026). Before this the gate
  // asked only whether enough unreserved stock existed anywhere, and nothing
  // ever reserved — so two jobs could both clear it on the same boards and
  // the second crew would start and stop. The design's own gate says the
  // clear answer is "Material reserved · BOM current".
  const claim = await page.evaluate(() => {
    const mk = (name) => {
      const c = createCustomer({ name, contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'M' });
      const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'S' });
      const q = convertEnquiryToQuotation(e.id, { projectName: name, taxPercent: 10, contactPerson: 'A' });
      addQuotationItem(q.id, { product: 'Carcass', qty: 1, unit: 'Nos' });
      const it = quotations.find(x => x.id === q.id).items[0];
      addBOMMaterial(q.id, it.lineId, { name: itemMaster[1].name, qty: 10, rate: 5, unit: itemMaster[1].unit });
      submitItemBOM(q.id, it.lineId, 'Est');
      setItemDepartmentSequence(q.id, it.lineId, ['carp']);
      transferQuotationStage(q.id, 'approver', 'E'); approveQuotation(q.id, 'S', 'owner');
      const j = confirmQuotationToJobCard(q.id, 'S'); confirmJobRouting(j.id, {}, 'Ops', null); return j;
    };
    const st = createStoreLocation({ name: 'Claim Store' });
    const bn = createStoreBin({ storeId: st.id, code: 'CL1' });
    putAwayStock({ itemId: itemMaster[1].id, binId: bn.id, qty: 10, source: 'test' });   // enough for ONE
    const jA = mk('Claim A'), jB = mk('Claim B');
    const a = allotLaneSlot({ crewId: 'CREW-A', jobCardId: jA.id, date: todayISO(), portion: 'full', byWhom: 'PM' });
    const held = stockHeld(itemMaster[1].id, bn.id), free = stockFree(itemMaster[1].id, bn.id);
    const b2 = allotLaneSlot({ crewId: 'CREW-B', jobCardId: jB.id, date: todayISO(), portion: 'full', byWhom: 'PM' });
    return { firstOk: !a.error, held, free, second: b2.error || 'ACCEPTED' };
  });
  check('taking a lane slot reserves the boards for that job', claim.firstOk && claim.held === 10 && claim.free === 0, claim);
  check('so a second job on the same boards is honestly short',
    /short/i.test(claim.second), claim.second);

  console.log('\n— commitment 2: paint and install pull their dates from joinery —');
  const derived = await page.evaluate(() => {
    const base = laneSlots[laneSlots.length - 1];
    const d = (allotDerivedSlot({ crewId: 'CREW-P', baseSlotId: base.id, offsetDays: 3, jobCardId: base.jobCardId, byWhom: 'Test' }) || {}).slot;
    const firstDate = slotDate(d);
    // move the upstream slot; the derived one must move with it
    const moved = addDaysISO(base.date, 5);
    moveLaneSlot(base.id, moved, 'Test');
    return { firstDate, afterUpstreamMoved: slotDate(d), expected: addDaysISO(moved, 3), storesOwnDate: !!d.date };
  });
  check('a derived slot has no date of its own — it is computed',
    derived.storesOwnDate === false, derived);
  check('moving the joinery slot moves the paint slot with it',
    derived.afterUpstreamMoved === derived.expected && derived.afterUpstreamMoved !== derived.firstDate, derived);

  console.log('\n— commitment 3: hours and quantities, never a price —');
  const noPrice = await page.evaluate(() => {
    const r = raiseInputRequest({ type: 'pricing_input', raisedBy: 'Estimator — Arun Kumar A', raiserRole: 'estimator',
      question: 'Man-hours for 9 wardrobes', neededBy: todayISO() });
    const withMoney = answerInputRequest(r.id, { manHours: 40, rate: 12 }, 'Production Manager');
    const clean = answerInputRequest(r.id, { manHours: 40, men: 4, boards: 22, wastagePct: 12 }, 'Production Manager');
    return { moneyRefused: withMoney && withMoney.error, cleanOk: !(clean && clean.error) };
  });
  check('an answer carrying anything money-shaped is refused', !!noPrice.moneyRefused, noPrice);
  check('hours, men, boards and wastage go through', noPrice.cleanOk, noPrice);

  console.log('\n— commitment 4: a BOM change kills the cutting list —');
  const deadPaper = await page.evaluate((t) => {
    const sheet = createCuttingSheet({ jobCardId: t.jobId, saw: 'saw 2',
      lines: [{ part: 'Carcass side', material: '18mm oak MDF', qty: 12, l: 2100, w: 600, press: true }], byWhom: 'Test' });
    markSheetOnSaw(sheet.id, 'saw 2');
    startBOMRevision(t.jobId, 'Operations', 'Client changed the detail');
    issueBOMRevision(t.jobId, 'Operations');
    const afterIssue = cuttingSheets.find(s => s.id === sheet.id).status;
    const blockedWhileOnSaw = jobLaneBlockReason(t.jobId);
    confirmSheetOffSaw(sheet.id, 'Test');
    return { afterIssue, blockedWhileOnSaw, clearedAfterOffSaw: jobLaneBlockReason(t.jobId) };
  }, bomTrace);
  check('issuing a new revision kills the old sheet', deadPaper.afterIssue === 'dead', deadPaper);
  check('and the gate stays shut while that sheet is still on the saw',
    /saw/i.test(deadPaper.blockedWhileOnSaw || ''), deadPaper);
  check('it clears on confirming the sheet OFF the saw, not on issuing',
    deadPaper.clearedAfterOffSaw === null, deadPaper);

  console.log('\n— commitment 5: overtime buys hours, not material —');
  const ot = await page.evaluate((t) => {
    const noCause = bookOvertimeShift({ crewId: 'CREW-A', date: todayISO(), hours: 4, men: 3, recoversTarget: t.jobId, byWhom: 'Test' });
    const good = bookOvertimeShift({ crewId: 'CREW-A', date: todayISO(), hours: 4, men: 3,
      recoversTarget: t.jobId, cause: OVERTIME_CAUSES[0], byWhom: 'Test' });
    return { noCauseRefused: noCause && noCause.error, booked: !!(good && good.id), causes: OVERTIME_CAUSES.length };
  }, bomTrace);
  check('a shift with no stated cause is refused', !!ot.noCauseRefused, ot);
  check('a shift against a target and a cause is booked', ot.booked, ot);
  check('cause is a closed enum', ot.causes >= 3, ot);

  console.log('\n— the module opens through its real node —');
  const opened = await page.evaluate(() => {
    const n = window.__eco3d.NODES.find(x => x.id === 'production');
    if (!n) return { noNode: true };
    n.launch();
    return { launched: true };
  });
  await page.waitForTimeout(700);
  const shell = await page.evaluate(() => {
    const w = document.getElementById('prd-module-wrap');
    const others = ['ops-module-wrap', 'owner-module-wrap', 'joinery-module-wrap', 'purch-module-wrap', 'sk-module-wrap']
      .filter(id => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none'; });
    const nav = [...w.querySelectorAll('.xs-nav button, .xs-nav-item')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
    return {
      visible: getComputedStyle(w).display, othersVisible: others, nav,
      chat: !!document.getElementById('exec-chat-float'),
      quickActions: !!w.querySelector('.xs-qa'),
      sidebar: !!w.querySelector('.xs-side')
    };
  });
  check('it opens and hides every other module', opened.launched && shell.visible === 'flex' && shell.othersVisible.length === 0, shell.othersVisible);
  check('the rail carries the handoff\'s pages in its order',
    /Week board/.test(shell.nav.join('|')) && /Pricing input/.test(shell.nav.join('|')) &&
    /BOM input for budgeting/.test(shell.nav.join('|')) && /Teams & labour/.test(shell.nav.join('|')), shell.nav.slice(0, 6));
  check('the six non-negotiables come from the shell, not a second copy',
    shell.chat && shell.quickActions && shell.sidebar, shell);

  console.log('\n— the week board —');
  // Commitment 2's check MOVES the base slot five days out, which carries it
  // and its derived slot off the displayed week. Put fresh work inside this
  // week so the board has something of its own to render.
  await page.evaluate((t) => {
    const sun = new Date(); sun.setDate(sun.getDate() - sun.getDay());
    const day = (n) => { const d = new Date(sun); d.setDate(sun.getDate() + n); return localISO(d); };
    const a = allotLaneSlot({ crewId: 'CREW-B', jobCardId: t.jobId, date: day(1), portion: 'full', byWhom: 'Test' });
    if (a && a.slot) allotDerivedSlot({ crewId: 'CREW-P', baseSlotId: a.slot.id, offsetDays: 2, jobCardId: t.jobId, byWhom: 'Test' });
    // A shift on a day with NO work — the prototype's Friday. Booked on the
    // same crew as the Monday slot so both OT cases sit on one lane.
    bookOvertimeShift({ crewId: 'CREW-B', date: day(5), hours: 6, men: 4,
      recoversTarget: t.jobId, cause: OVERTIME_CAUSES[0], byWhom: 'Test' });
    // And one on the day that already has work — the prototype's Wednesday.
    bookOvertimeShift({ crewId: 'CREW-B', date: day(1), hours: 3, men: 3,
      recoversTarget: t.jobId, cause: OVERTIME_CAUSES[0], byWhom: 'Test' });
    // Paperwork and the inbox both render off real records. Seed one of each
    // kind so the four-kind rule and the need line are actually exercised,
    // rather than passing on an empty state.
    const sh = createCuttingSheet({ jobCardId: t.jobId, saw: '', lines: [], byWhom: 'Test' });
    // createCuttingSheet already lands 'released'; put it on a saw so the
    // row reads the way the shop sees it.
    if (sh && sh.id) markSheetOnSaw(sh.id, 'saw 2');
    const batch = createPressingBatch({ veneer: 'Oak crown 0.6mm', byWhom: 'Test' });
    if (batch && batch.id) addJobToPressingBatch(batch.id, t.jobId, 4);
    // A pull on the installation crew — the fourth paperwork kind. Paint is
    // already covered by the derived slot above.
    const b2 = allotLaneSlot({ crewId: 'CREW-A', jobCardId: t.jobId, date: day(2), portion: 'full', byWhom: 'Test' });
    if (b2 && b2.slot) allotDerivedSlot({ crewId: 'CREW-I', baseSlotId: b2.slot.id, offsetDays: 2, jobCardId: t.jobId, byWhom: 'Test' });
    // The sofa lane's story: a job routed to upholstery that cannot get a
    // lane, so that crew stands there with nothing it can start. Shaped on
    // the fixture rather than built as a second job through the whole chain.
    const stuck = getWaitingForLane()[0];
    if (stuck) (stuck.job.items || []).forEach(it => {
      it.departmentSequence = (it.departmentSequence || []).concat(['uph']);
    });
    raiseInputRequest({ type: 'pricing_input', raisedBy: 'Arun Kumar A', raiserRole: 'estimator',
      jobCardId: t.jobId, question: 'Man-hours to build and finish the run of wardrobes?', neededBy: day(3) });
    renderProductionBody();
  }, bomTrace);
  await page.waitForTimeout(250);
  const board = await page.evaluate(() => {
    const body = document.getElementById('prd-body');
    const cells = [...body.querySelectorAll('.prd-cell')];
    const states = cells.map(c => [...c.classList].find(x => x.startsWith('c-')))
      .reduce((a, s) => { a[s] = (a[s] || 0) + 1; return a; }, {});
    return {
      lanes: body.querySelectorAll('.prd-lane').length,
      cells: cells.length, states,
      headerDays: [...body.querySelectorAll('.prd-days .d')].map(d => d.textContent.trim().split(' ')[0]),
      hasWaitRule: /A lane will not take a job with no material or a pending revision/.test(body.textContent),
      labelInFill: [...body.querySelectorAll('.prd-track i')].some(i => i.textContent.trim().length > 0),
      laneB: (() => {
        const lane = [...body.querySelectorAll('.prd-lane')].find(l => /Crew B/i.test(l.textContent));
        return lane ? [...lane.querySelectorAll('.prd-cell')].map(c => ({
          st: [...c.classList].find(x => x.startsWith('c-')),
          j: (c.querySelector('.j') || {}).textContent,
          s: (c.querySelector('.s') || {}).textContent
        })) : null;
      })()
    };
  });
  check('five lanes, seven days each', board.lanes === 5 && board.cells === 35, board);
  check('the week runs Sunday to Saturday', board.headerDays.join(',') === 'Sun,Mon,Tue,Wed,Thu,Fri,Sat', board.headerDays);
  check('a booked day renders as an allotted cell', (board.states['c-full'] || 0) > 0, board.states);
  check('a derived slot renders in the pull state, not as a date of its own',
    (board.states['c-pull'] || 0) > 0, board.states);
  check('a day whose only reason to exist is the shift is an OT cell',
    (board.states['c-ot'] || 0) > 0, board.states);
  check('overtime on a day that already has work keeps the state of the job,',
    !!board.laneB && board.laneB[1] && board.laneB[1].st === 'c-full' && String(board.laneB[1].s || '').indexOf('+3 h OT') !== -1,
    board.laneB && board.laneB.slice(0, 6));
  check('Friday and Saturday are weekend cells otherwise', (board.states['c-wknd'] || 0) > 0, board.states);
  check('the waiting strip carries the rule verbatim', board.hasWaitRule, board);
  check('no bar fill contains a label (handoff chart rule)', board.labelInFill === false, board);

  const stepped = await page.evaluate(() => {
    const dates = () => [...document.querySelectorAll('#prd-body .prd-days .d')].map(d => d.textContent.trim()).join(',');
    const before = dates();
    document.querySelector('#prd-body [data-a="wk"][data-v="1"]').click();
    const after = dates();
    // "This week" is a reset control, not a period label — it takes you back.
    document.querySelector('#prd-body .prd-step .lbl').click();
    return { before, after, reset: dates() };
  });
  check('stepping the week moves the days', stepped.before !== stepped.after, stepped);
  check('"This week" resets to the current week', stepped.reset === stepped.before, stepped);
  // It is a <button> in the same row as two 30px arrows; without an explicit
  // width it inherits theirs and reads "This w".
  const lblFit = await page.evaluate(() => {
    const el = document.querySelector('#prd-body .prd-step .lbl');
    return { text: el.textContent.trim(), clipped: el.scrollWidth > el.clientWidth + 1 };
  });
  check('the week label is not clipped by the arrow width', !lblFit.clipped, lblFit);


  console.log('\n— the rail highlight follows the view —');
  // It stuck on "Week board" for a fortnight: prdBuildShell() shadowed
  // exec-shell's global nv(), which is what appends execMarkActive to every
  // item's onclick, and nothing else in the module ever called it except one
  // line at open that marked the wrong item.
  const rail = await page.evaluate(async () => {
    const active = () => {
      const a = document.querySelector('#prd-module-wrap .xs-item.active');
      return a ? (a.id || '').replace('xsnav-', '') : null;
    };
    const click = async (id) => {
      const el = document.querySelector('#prd-module-wrap [id="xsnav-' + id + '"]');
      if (el) el.click();
      await new Promise(r => setTimeout(r, 200));
      return active();
    };
    PrdUI.go('dash', 'board');
    await new Promise(r => setTimeout(r, 200));
    const onDash = active();
    const viaRail = await click('prd-mat');
    // The half that the rail's own onclick does NOT cover: navigation from
    // inside the body. A board cell opens the allot flow.
    // Back to the dashboard first — the Material page has no board cells.
    PrdUI.go('dash', 'board');
    await new Promise(r => setTimeout(r, 220));
    const cell = document.querySelector('#prd-body .prd-cell[data-a="cell"]');
    if (cell) cell.click();
    await new Promise(r => setTimeout(r, 250));
    const viaCell = active();
    PrdUI.go('dash', 'board');
    await new Promise(r => setTimeout(r, 250));
    return { onDash, viaRail, viaCell, backOnDash: active() };
  });
  check('the dashboard marks Dashboard, not Week board', rail.onDash === 'prd-dash', rail);
  check('a rail click marks the page it opened', rail.viaRail === 'prd-mat', rail);
  check('and navigating from the body marks it too — a board cell opens Create',
    rail.viaCell === 'prd-create', rail);
  check('returning to the dashboard marks Dashboard again', rail.backOnDash === 'prd-dash', rail);
  // execCurrentViewLabel() builds the breadcrumb's middle rung from
  // `.xs-item.active .xs-lbl`, so a stale highlight was a wrong breadcrumb too.
  const crumb = await page.evaluate(async () => {
    PrdUI.go('page', 'cut');
    await new Promise(r => setTimeout(r, 250));
    const el = document.querySelector('#prd-module-wrap .xs-item.active .xs-lbl');
    return el ? el.textContent.trim() : null;
  });
  check('so the breadcrumb reads the view you are actually on', /Cutting lists/.test(crumb || ''), crumb);

  console.log('\n— the rail and topbar against the prototype frame —');
  const frame = await page.evaluate(async () => {
    PrdUI.go('dash', 'board');
    await new Promise(r => setTimeout(r, 200));
    const items = [...document.querySelectorAll('#prd-module-wrap .xs-item')];
    return {
      labels: items.map(a => a.textContent.replace(/\s+/g, ' ').trim()),
      first: items[0] ? items[0].getAttribute('onclick') : null,
      last: items[items.length - 1] ? items[items.length - 1].getAttribute('onclick') : null,
      sub: (document.querySelector('#prd-module-wrap .xs-sub') || {}).textContent || '',
      badged: items.filter(a => a.querySelector('.xs-tag')).length
    };
  });
  // The frame's rail opens with Dashboard and closes with Create… Without the
  // first there is no rail route back to the board from inside a page.
  check('the rail opens with Dashboard, and it returns to the board',
    /Dashboard$/.test(frame.labels[0] || '') && /go\('dash'/.test(frame.first || ''), frame.labels.slice(0, 2));
  check('and closes with Create…, which opens the flows',
    /Create/.test(frame.labels[frame.labels.length - 1] || '') && /go\('form'/.test(frame.last || ''),
    frame.labels.slice(-2));
  check('all sixteen rail entries are there', frame.labels.length === 16, frame.labels.length);
  // "Thursday 13 August 2026 · 5 things asked of you · 3 jobs with no lane ·
  // Crew A over" — the day in one sentence.
  check('the topbar carries the date', /\d{4}/.test(frame.sub), frame.sub);
  check('and the counts alongside it, not instead of it',
    frame.sub.indexOf('·') !== -1 && /asked of you|no lane|over/.test(frame.sub), frame.sub);
  // A count of zero is dropped rather than rendered as "0" — a line of zeros
  // is noise, not information.
  check('a zero clause is dropped, not shown as 0', !/\b0 (things|jobs|crews)/.test(frame.sub), frame.sub);

  console.log('\n— the dashboard against the package —');
  // Every class below had a rule in production.css and no renderer emitting
  // it. A rule nothing produces is a deviation that reads as done.
  const spec = await page.evaluate(() => {
    const body = document.getElementById('prd-body');
    const txt = body.textContent;
    const kpis = [...body.querySelectorAll('.prd-kpi .prd-kpi-l b')].map(b => b.textContent.trim());
    const kinds = [...body.querySelectorAll('.prd-out-k')].map(k => k.textContent.trim());
    return {
      tgt: body.querySelectorAll('.prd-tgt').length,
      need: body.querySelectorAll('.prd-need').length,
      teamTgt: body.querySelectorAll('.prd-team-tgt').length,
      blocked: body.querySelectorAll('.prd-cell.c-blocked').length,
      kpis, kinds,
      opensFlow: body.querySelectorAll('[data-a="flow"]').length,
      sheetsSaved: /Veneer sheets saved/.test(txt),
      otThisWeek: /Overtime booked this week/.test(txt),
      otSub: (() => {
        const row = [...body.querySelectorAll('.prd-kpi')].find(r => /Overtime booked this week/.test(r.textContent));
        return row ? (row.querySelector('.prd-kpi-l span') || {}).textContent : null;
      })()
    };
  });
  check('lane target lines render', spec.tgt >= 5, spec.tgt);
  check('the inbox need line renders', spec.need > 0, spec.need);
  check('teams today carries a target', spec.teamTgt > 0, spec.teamTgt);
  check('a crew with work waiting and none allotted reads as blocked, not free',
    spec.blocked > 0, spec.blocked);
  check('paperwork produces all four kinds',
    ['Cutting list', 'Veneer press', 'Paint queue', 'Installation'].every(k => spec.kinds.some(x => x.indexOf(k) === 0)),
    spec.kinds);
  check('the KPI list is the frozen six', spec.kpis.length === 6, spec.kpis);
  check('KPI six is Veneer sheets saved, not press batches open', spec.sheetsSaved, spec.kpis);
  check('overtime is scoped to the week, not the month',
    spec.otThisWeek && !/month/i.test(spec.otSub || ''), spec.otSub);

  // Nothing on this screen was clickable before Phase 1 — the handler read a
  // data key the elements never set.
  const flows = await page.evaluate(() => {
    const body = () => document.getElementById('prd-body');
    const open = (sel) => {
      const el = body().querySelector(sel);
      if (!el) return null;
      el.click();
      const r = { v: PrdUI.state.view, k: PrdUI.state.form, g: PrdUI.state.gate };
      PrdUI.go('dash');
      return r;
    };
    return {
      cell: open('.prd-cell[data-a="cell"]'),
      paperwork: open('.prd-out [data-a="flow"]'),
      ask: open('.prd-ask [data-a="flow"]')
    };
  });
  check('a board cell opens the allot flow', flows.cell && flows.cell.v === 'form' && flows.cell.k === 'allot', flows.cell);
  check('a paperwork button opens its own flow', flows.paperwork && flows.paperwork.v === 'form', flows.paperwork);
  check('an inbox action opens its own flow', flows.ask && flows.ask.v === 'form', flows.ask);
  check('every flow opens with the gate reset — a stale answer must not carry over',
    [flows.cell, flows.paperwork, flows.ask].every(f => f && f.g === null),
    [flows.cell, flows.paperwork, flows.ask].map(f => f && f.g));

  console.log('\n— dark mode and the phone —');
  const dark = await page.evaluate(async () => {
    execThemeToggle();
    await new Promise(r => setTimeout(r, 250));
    const bg = getComputedStyle(document.querySelector('#prd-body .prd-card')).backgroundColor;
    execThemeToggle();
    return bg;
  });
  check('cards take the dark surface token (computed, not eyeballed)', dark === 'rgb(29, 24, 33)', dark);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.evaluate(() => renderProductionBody());
  await page.waitForTimeout(250);
  const phone = await page.evaluate(() => ({
    cols: getComputedStyle(document.querySelector('#prd-body .prd-dash')).flexDirection,
    overflow: document.documentElement.scrollWidth > 391,
    boardScrolls: getComputedStyle(document.querySelector('#prd-body .prd-board-scroll')).overflowX,
    // Declaring overflow-x:auto is not enough — in a column flex the CARD
    // grew to the 640px board instead, so the scroller never had anything to
    // scroll and the copy ran off the right edge. Measure it.
    cardW: Math.round(document.querySelector('#prd-body .prd-board').getBoundingClientRect().width),
    reallyScrolls: (() => { const el = document.querySelector('#prd-body .prd-board-scroll'); return el.scrollWidth > el.clientWidth; })()
  }));
  check('single column on a phone', phone.cols === 'column', phone);
  check('no horizontal page overflow at 390px', phone.overflow === false, phone);
  check('the board scrolls sideways rather than crushing seven days', phone.boardScrolls === 'auto', phone);
  check('the card is pinned to the viewport, so the copy is not cut off',
    phone.cardW <= 390, phone);
  check('and the board inside it really does scroll', phone.reallyScrolls === true, phone);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 4));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
