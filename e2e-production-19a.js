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
      labelInFill: [...body.querySelectorAll('.prd-track i')].some(i => i.textContent.trim().length > 0)
    };
  });
  check('five lanes, seven days each', board.lanes === 5 && board.cells === 35, board);
  check('the week runs Sunday to Saturday', board.headerDays.join(',') === 'Sun,Mon,Tue,Wed,Thu,Fri,Sat', board.headerDays);
  check('a booked day renders as an allotted cell', (board.states['c-full'] || 0) > 0, board.states);
  check('a derived slot renders in the pull state, not as a date of its own',
    (board.states['c-pull'] || 0) > 0, board.states);
  check('overtime turns a weekend cell green', (board.states['c-ot'] || 0) > 0, board.states);
  check('Friday and Saturday are weekend cells otherwise', (board.states['c-wknd'] || 0) > 0, board.states);
  check('the waiting strip carries the rule verbatim', board.hasWaitRule, board);
  check('no bar fill contains a label (handoff chart rule)', board.labelInFill === false, board);

  const stepped = await page.evaluate(() => {
    const before = document.querySelector('#prd-body .prd-step .lbl').textContent.trim();
    document.querySelector('#prd-body [data-a="wk"][data-v="1"]').click();
    return { before, after: document.querySelector('#prd-body .prd-step .lbl').textContent.trim() };
  });
  check('stepping the week changes the period', stepped.before !== stepped.after, stepped);

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
    boardScrolls: getComputedStyle(document.querySelector('#prd-body .prd-board-scroll')).overflowX
  }));
  check('single column on a phone', phone.cols === 'column', phone);
  check('no horizontal page overflow at 390px', phone.overflow === false, phone);
  check('the board scrolls sideways rather than crushing seven days', phone.boardScrolls === 'auto', phone);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 4));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
