/**
 * e2e-production-flows.js — 19a Production, the twelve create flows.
 *
 * Phase 3. The gate is the enforcement layer, not a confirmation step, so
 * the central check here is exhaustive rather than sampled: EVERY option of
 * EVERY gate is selected in turn through the real DOM, and the primary
 * button's live/dead state is read from the real element.
 *
 * The second thing this proves is that the gate does not REPLACE the data
 * layer's own rules. An `ok` answer still has to survive the same checks any
 * other caller faces, and the refusal has to reach the user rather than be
 * swallowed — a form that says "done" while the data layer refused is worse
 * than one that never had a gate.
 */
const { chromium } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');

let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}

const FLOWS = ['price', 'bomb', 'bom', 'res', 'purch', 'quote',
  'cut', 'press', 'allot', 'ot', 'lab', 'inst'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto(pathToFileURL(path.resolve(__dirname, 'index.html')).href);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 20000 });

  const seed = await page.evaluate(() => {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };
    const mk = (name, product, depts, matQty) => {
      const c = createCustomer({ name, contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'Tubli' });
      const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
      const q = convertEnquiryToQuotation(e.id, { projectName: product, taxPercent: 10, contactPerson: 'A' });
      addQuotationItem(q.id, { product, qty: 2, unit: 'Nos' });
      const it = quotations.find(x => x.id === q.id).items[0];
      addBOMMaterial(q.id, it.lineId, { name: itemMaster[0].name, qty: matQty, rate: 25, unit: itemMaster[0].unit });
      submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
      setItemDepartmentSequence(q.id, it.lineId, depts);
      transferQuotationStage(q.id, 'approver', 'Estimator');
      approveQuotation(q.id, 'Salman Abdullah', 'owner');
      const job = confirmQuotationToJobCard(q.id, 'Sales');
      confirmJobRouting(job.id, {}, 'Operations Manager', day(12));
      return job;
    };
    const store = storeLocations[0] || createStoreLocation({ name: 'Flows Store' });
    const bin = storeBins[0] || createStoreBin({ storeId: store.id, code: 'F1' });
    putAwayStock({ itemId: itemMaster[0].id, binId: bin.id, qty: 500, source: 'test' });

    const clear = mk('Flows Clear Co', 'Wardrobe run', ['carp', 'paint'], 4);
    const shortJob = mk('Flows Short Co', 'Sofa frame', ['uph'], 9000);

    raiseInputRequest({ type: 'pricing_input', raisedBy: 'Arun Kumar A', raiserRole: 'estimator',
      jobCardId: clear.id, question: 'Man-hours for the wardrobe run?', neededBy: day(2) });
    raiseInputRequest({ type: 'bom_budget_input', raisedBy: 'Operations Manager', raiserRole: 'operations_manager',
      question: 'Board consumption per linear metre?', neededBy: day(4) });

    if (typeof buildCrewRoster === 'function' && !crewMembers.length) buildCrewRoster();
    launchProductionModule();
    return { clear: clear.id, short: shortJob.id, day1: day(1), day3: day(3) };
  });
  await page.waitForTimeout(500);

  console.log('— the gate table, every option of every gate —');
  // The plan's own acceptance line: a `bad` option must leave the primary
  // dead. Sampling one flow would not prove the table; this walks all 34
  // options through real clicks and reads the real button.
  const table = await page.evaluate(async (flows) => {
    const out = {};
    for (const k of flows) {
      PrdUI.go('form', k);
      await new Promise(r => setTimeout(r, 90));
      const n = document.querySelectorAll('#prd-body .prd-opt').length;
      out[k] = { opts: n, rows: [] };
      for (let i = 0; i < n; i++) {
        document.querySelectorAll('#prd-body .prd-opt')[i].click();
        await new Promise(r => setTimeout(r, 70));
        const body = document.getElementById('prd-body');
        const btn = body.querySelector('.prd-acts .prd-btn');
        const opt = body.querySelectorAll('.prd-opt')[i];
        out[k].rows.push({
          label: opt.textContent.trim().split('\n')[0],
          tone: [...opt.classList].filter(c => c.indexOf('t-') === 0)[0],
          dead: btn.classList.contains('dead'),
          disabled: btn.disabled,
          warnFill: btn.classList.contains('warn'),
          banner: (body.querySelector('.prd-banner') || {}).className,
          gateCard: (body.querySelector('.prd-gate') || {}).className
        });
      }
    }
    return out;
  }, FLOWS);

  const all = Object.entries(table).flatMap(([k, v]) => v.rows.map(r => ({ flow: k, ...r })));
  check('all twelve flows offer their gate options', Object.values(table).every(v => v.opts >= 2 && v.opts <= 3),
    Object.entries(table).map(([k, v]) => k + ':' + v.opts));
  const bads = all.filter(r => r.tone === 't-bad');
  const oks = all.filter(r => r.tone === 't-ok');
  const warns = all.filter(r => r.tone === 't-warn');
  check('every blocked option leaves the primary dead — and disabled, not just grey',
    bads.length > 0 && bads.every(r => r.dead && r.disabled),
    bads.filter(r => !(r.dead && r.disabled)).map(r => r.flow + ':' + r.label));
  check('every clear option makes it live',
    oks.length > 0 && oks.every(r => !r.dead && !r.disabled && !r.warnFill),
    oks.filter(r => r.dead || r.warnFill).map(r => r.flow + ':' + r.label));
  // Amber is not a quieter green: it means allowed, and it will show.
  check('every amber option makes it live but fills it amber, not wine',
    warns.length > 0 && warns.every(r => !r.dead && r.warnFill),
    warns.filter(r => r.dead || !r.warnFill).map(r => r.flow + ':' + r.label));
  check('the gate card re-tints to the tone of the answer',
    all.every(r => (r.gateCard || '').indexOf(r.tone) !== -1),
    all.filter(r => (r.gateCard || '').indexOf(r.tone) === -1).slice(0, 3));
  check('and so does the banner', all.every(r => (r.banner || '').indexOf(r.tone) !== -1),
    all.filter(r => (r.banner || '').indexOf(r.tone) === -1).slice(0, 3));
  // The spec table gives `quote` (ok/ok/warn) and `press` (ok/warn/ok) no
  // blocked option on purpose — neither can be wrong enough to stop. Every
  // other flow has one, and asserting the exact pair keeps a later edit
  // from quietly dropping a real block.
  const noBlock = FLOWS.filter(k => !table[k].rows.some(r => r.tone === 't-bad'));
  check('exactly the two flows the spec allows through have no blocked option',
    noBlock.join(',') === 'quote,press', noBlock);

  console.log('\n— the blocked copy is the business rule, kept verbatim —');
  const copy = await page.evaluate(async () => {
    const want = {
      price: 'You do not send a price.',
      bom: 'Take the sheet off the saw first.',
      ot: 'Overtime will not fix this.',
      lab: 'Trade does not match the crew.'
    };
    const got = {};
    for (const k of Object.keys(want)) {
      PrdUI.go('form', k);
      await new Promise(r => setTimeout(r, 90));
      const opts = [...document.querySelectorAll('#prd-body .prd-opt')];
      const badIdx = opts.findIndex(o => /blocked/i.test(o.textContent));
      opts[badIdx].click();
      await new Promise(r => setTimeout(r, 80));
      got[k] = (document.querySelector('#prd-body .prd-banner') || {}).textContent || '';
    }
    return { want, got };
  });
  Object.keys(copy.want).forEach(k => {
    check('“' + copy.want[k] + '” survives verbatim', (copy.got[k] || '').indexOf(copy.want[k]) !== -1, copy.got[k]);
  });

  console.log('\n— an unanswered gate is not a passable one —');
  const fresh = await page.evaluate(async () => {
    PrdUI.go('form', 'ot');
    await new Promise(r => setTimeout(r, 90));
    document.querySelectorAll('#prd-body .prd-opt')[0].click();
    await new Promise(r => setTimeout(r, 80));
    const answered = !document.querySelector('#prd-body .prd-acts .prd-btn').classList.contains('dead');
    // Moving to another flow must clear it. A gate that arrives pre-answered
    // in the job's favour defeats the whole mechanism.
    document.querySelector('#prd-body .prd-tab-p:not(.on)').click();
    await new Promise(r => setTimeout(r, 90));
    return {
      answered,
      gateAfter: PrdUI.state.gate,
      deadAfter: document.querySelector('#prd-body .prd-acts .prd-btn').classList.contains('dead'),
      badge: (document.querySelector('#prd-body .prd-gate-b') || {}).textContent
    };
  });
  check('answering makes it live', fresh.answered, fresh);
  check('switching flow clears the answer', fresh.gateAfter === null && fresh.deadAfter, fresh);
  check('and the badge goes back to the question mark', (fresh.badge || '').trim() === '?', fresh);

  console.log('\n— the checks panel is real, and goes red —');
  const checksPanel = await page.evaluate(async (s) => {
    const read = async (job) => {
      PrdUI.go('form', 'allot');
      await new Promise(r => setTimeout(r, 100));
      const selEl = document.getElementById('prd-job');
      selEl.value = job;
      selEl.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 140));
      return [...document.querySelectorAll('#prd-body .prd-chk')].map(c => ({
        tone: [...c.querySelector('.prd-chk-b').classList].filter(x => x.indexOf('t-') === 0)[0],
        label: c.querySelector('b').textContent.trim()
      }));
    };
    return { clear: await read(s.clear), short: await read(s.short) };
  }, seed);
  check('a job with its material shows four green checks',
    checksPanel.clear.length === 4 && checksPanel.clear.every(c => c.tone === 't-ok'), checksPanel.clear);
  check('a job short of material shows it red, on the material row',
    checksPanel.short.some(c => c.tone === 't-bad' && /material short/i.test(c.label)), checksPanel.short);

  console.log('\n— answering the gate does not wipe the form —');
  // The third instance of this trap in this module: the job select, the cut
  // builder, and the gate itself all repainted the whole form and threw away
  // everything already typed into it.
  const gateKeeps = await page.evaluate(async (s) => {
    PrdUI.go('form', 'allot');
    await new Promise(r => setTimeout(r, 130));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('prd-crew', 'CREW-A'); set('prd-date', s.day1); set('prd-job', s.clear);
    await new Promise(r => setTimeout(r, 200));
    document.querySelectorAll('#prd-body .prd-opt')[0].click();
    await new Promise(r => setTimeout(r, 180));
    return {
      crew: document.getElementById('prd-crew').value,
      date: document.getElementById('prd-date').value,
      job: document.getElementById('prd-job').value,
      live: !document.querySelector('#prd-body .prd-acts .prd-btn').disabled
    };
  }, seed);
  check('every field survives answering the gate',
    gateKeeps.crew === 'CREW-A' && !!gateKeeps.date && gateKeeps.job === seed.clear, gateKeeps);
  check('and the primary still comes live', gateKeeps.live, gateKeeps);

  console.log('\n— an ok gate does not override the data layer —');
  // The gate is not a permission slip. A clear answer on a job whose boards
  // are not there must still be refused by allotLaneSlot(), and the refusal
  // must reach the user rather than be swallowed into a success message.
  const override = await page.evaluate(async (s) => {
    const toasts = [];
    const orig = window.commsToast;
    window.commsToast = (m) => { toasts.push(m); };
    PrdUI.go('form', 'allot');
    await new Promise(r => setTimeout(r, 110));
    document.querySelectorAll('#prd-body .prd-opt')[0].click();   // "Material reserved · BOM current"
    await new Promise(r => setTimeout(r, 90));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('prd-crew', 'CREW-U'); set('prd-job', s.short); set('prd-date', s.day1); set('prd-portion', 'full');
    // The allot form now books chosen ITEMS, so a booking with nothing
    // ticked is refused before it reaches the data layer.
    await new Promise(r => setTimeout(r, 180));
    const tickAll = document.querySelector('#prd-body [data-a="allot-all"]');
    if (tickAll) tickAll.click();
    await new Promise(r => setTimeout(r, 150));
    await new Promise(r => setTimeout(r, 120));
    const before = laneSlots.length;
    document.querySelector('#prd-body .prd-acts .prd-btn').click();
    await new Promise(r => setTimeout(r, 260));
    window.commsToast = orig;
    return { before, after: laneSlots.length, toasts, stillOnForm: PrdUI.state.view === 'form' };
  }, seed);
  check('the data layer still refuses it', override.after === override.before, override);
  check('the refusal is shown, not swallowed into a success message',
    override.toasts.some(t => /material|short|revision|lane/i.test(t)) &&
    !override.toasts.some(t => /done\.$/.test(t)), override.toasts);
  check('and the form stays open so it can be corrected', override.stillOnForm, override);

  console.log('\n— a clear flow actually writes —');
  const wrote = await page.evaluate(async (s) => {
    const toasts = [];
    const orig = window.commsToast;
    window.commsToast = (m) => { toasts.push(m); };
    PrdUI.go('form', 'allot');
    await new Promise(r => setTimeout(r, 110));
    document.querySelectorAll('#prd-body .prd-opt')[0].click();
    await new Promise(r => setTimeout(r, 90));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('prd-crew', 'CREW-A'); set('prd-job', s.clear); set('prd-date', s.day1); set('prd-portion', 'full');
    // The allot form now books chosen ITEMS, so a booking with nothing
    // ticked is refused before it reaches the data layer.
    await new Promise(r => setTimeout(r, 180));
    const tickAll = document.querySelector('#prd-body [data-a="allot-all"]');
    if (tickAll) tickAll.click();
    await new Promise(r => setTimeout(r, 150));
    await new Promise(r => setTimeout(r, 120));
    const before = laneSlots.length;
    document.querySelector('#prd-body .prd-acts .prd-btn').click();
    await new Promise(r => setTimeout(r, 300));
    window.commsToast = orig;
    return {
      before, after: laneSlots.length, toasts,
      view: PrdUI.state.view, gate: PrdUI.state.gate,
      slotIsReal: laneSlots.some(x => x.jobCardId === s.clear && x.crewId === 'CREW-A')
    };
  }, seed);
  check('a real lane slot is created through the real function', wrote.after === wrote.before + 1 && wrote.slotIsReal, wrote);
  check('it returns to the board once written', wrote.view === 'dash', wrote);
  check('and the gate is cleared behind it', wrote.gate === null, wrote);

  console.log('\n— overtime refuses without a cause, from the form —');
  const otForm = await page.evaluate(async (s) => {
    const toasts = [];
    const orig = window.commsToast;
    window.commsToast = (m) => { toasts.push(m); };
    PrdUI.go('form', 'ot');
    await new Promise(r => setTimeout(r, 110));
    document.querySelectorAll('#prd-body .prd-opt')[0].click();   // "A slipped target"
    await new Promise(r => setTimeout(r, 90));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('prd-crew', 'CREW-A'); set('prd-date', s.day1); set('prd-hours', '4');
    set('prd-men', '3'); set('prd-job', s.clear);
    // cause deliberately left blank
    await new Promise(r => setTimeout(r, 110));
    const before = overtimeShifts.length;
    document.querySelector('#prd-body .prd-acts .prd-btn').click();
    await new Promise(r => setTimeout(r, 250));
    window.commsToast = orig;
    return { before, after: overtimeShifts.length, toasts };
  }, seed);
  check('a shift with no cause is refused even with a clear gate',
    otForm.after === otForm.before && otForm.toasts.some(t => /cause/i.test(t)), otForm);

  console.log('\n— Save as draft says plainly that it is not built —');
  const draft = await page.evaluate(async () => {
    const toasts = [];
    const orig = window.commsToast;
    window.commsToast = (m) => { toasts.push(m); };
    PrdUI.go('form', 'price');
    await new Promise(r => setTimeout(r, 100));
    document.querySelector('#prd-body [data-a="draft"]').click();
    await new Promise(r => setTimeout(r, 150));
    window.commsToast = orig;
    return toasts;
  });
  // Pretending to save a draft is worse than saying it is not built.
  check('it does not pretend to have saved anything',
    draft.some(t => /not built|nothing was saved/i.test(t)), draft);

  console.log('\n— booking a lane against chosen items —');
  const picker = await page.evaluate(async () => {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };
    // A four-item job, one item already in production so the picker has
    // something real to grey.
    const c = createCustomer({ name: 'Picker Co ' + Date.now(), contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'Tubli' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Villa fit-out', taxPercent: 10, contactPerson: 'A' });
    ['Wardrobe A', 'Wardrobe B', 'Dresser', 'TV unit'].forEach(nm => addQuotationItem(q.id, { product: nm, qty: 1, unit: 'Nos' }));
    quotations.find(x => x.id === q.id).items.forEach(it => {
      addBOMMaterial(q.id, it.lineId, { name: itemMaster[0].name, qty: 2, rate: 25, unit: itemMaster[0].unit });
      submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
      setItemDepartmentSequence(q.id, it.lineId, ['carp']);
    });
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah', 'owner');
    const job = confirmQuotationToJobCard(q.id, 'Sales');
    confirmJobRouting(job.id, {}, 'Operations Manager', day(10));
    submitDepartmentBudget(job.id, 'carp', { materials: 50, labour: 20, subcontract: 0, hiring: 0, others: 0 }, 'PM');
    approveDepartmentBudget(job.id, 'carp', 'Operations Manager');
    startLineProduction(job.id, job.items[0].lineId, 'carp');
    // Week-relative, and days of its own: the board only shows this week, and
    // an earlier block books CREW-A on day(1) with another job — that IS a
    // real overload, which would mask the check below.
    const sun = new Date(); sun.setDate(sun.getDate() - sun.getDay());
    const wk = (n) => { const d = new Date(sun); d.setDate(sun.getDate() + n); return localISO(d); };
    return { job: job.id, day1: wk(1), day2: wk(2), lines: job.items.map(i => Number(i.lineId)) };
  });

  const rows = await page.evaluate(async (s) => {
    PrdUI.go('form', 'allot');
    await new Promise(r => setTimeout(r, 160));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('prd-crew', 'CREW-A'); set('prd-job', s.job); set('prd-date', s.day1);
    await new Promise(r => setTimeout(r, 300));
    return [...document.querySelectorAll('#prd-body .prd-allot-r')].map(x => ({
      n: Number(x.querySelector('.c-n').textContent),
      product: x.querySelector('.c-p b').textContent.trim(),
      stage: x.querySelector('.c-s').textContent.trim(),
      greyed: x.classList.contains('off'),
      tickable: !!x.querySelector('button[data-a="allot-t"]')
    }));
  }, picker);
  check('the picker lists every line routed to the crew', rows.length === 4, rows);
  check('in serial order', rows.map(r => r.n).join(',') === picker.lines.join(','), rows.map(r => r.n));
  // Greying without saying why is what makes people think the app is broken.
  const started = rows.find(r => r.n === picker.lines[0]);
  check('a line already in production is greyed and not tickable',
    started && started.greyed && !started.tickable, started);
  check('and its stage is named, down to the joinery sub-stage',
    started && /In production/.test(started.stage) && /drafting/.test(started.stage), started);
  check('the rest are tickable and read "Ready to start"',
    rows.filter(r => r.n !== picker.lines[0]).every(r => r.tickable && !r.greyed && /Ready to start/.test(r.stage)),
    rows);

  const booked = await page.evaluate(async (s) => {
    const before = laneSlots.length;
    // Tick two of the three available, by hand rather than "tick all".
    document.querySelectorAll('#prd-body [data-a="allot-t"]')[0].click();
    await new Promise(r => setTimeout(r, 140));
    document.querySelectorAll('#prd-body [data-a="allot-t"]')[1].click();
    await new Promise(r => setTimeout(r, 140));
    const headAfterTicks = (document.querySelector('#prd-body .prd-allot-hn i') || {}).textContent;
    document.querySelectorAll('#prd-body .prd-opt')[0].click();   // gate: clear
    await new Promise(r => setTimeout(r, 140));
    // Answering the gate must not wipe the ticks — same trap as every other
    // field on this form.
    const ticksSurvived = (PrdUI.state.allotLines || []).length;
    const toasts = []; const orig = window.commsToast; window.commsToast = (m) => toasts.push(m);
    document.querySelector('#prd-body .prd-acts .prd-btn').click();
    await new Promise(r => setTimeout(r, 300));
    window.commsToast = orig;
    const slot = laneSlots[laneSlots.length - 1];
    return {
      before, after: laneSlots.length, headAfterTicks, ticksSurvived, toasts,
      lineIds: slot && slot.lineIds, jobCardId: slot && slot.jobCardId
    };
  }, picker);
  check('ticking updates the count in the header', /2 of 3/.test(booked.headAfterTicks || ''), booked);
  check('answering the gate does not wipe the ticks', booked.ticksSurvived === 2, booked);
  check('a slot is written carrying exactly the ticked lines',
    booked.after === booked.before + 1 && (booked.lineIds || []).length === 2, booked);

  const coverage = await page.evaluate((s) => {
    const w = getWaitingForLane().find(x => x.job.id === s.job);
    return {
      stillWaiting: !!w,
      missing: w ? w.missing.length : 0,
      partial: w ? w.partial : false,
      reason: w ? w.reason : null,
      cov: jobLaneCoverage(s.job)
    };
  }, picker);
  // Booking three of four items used to drop the whole job out of the strip,
  // which made picking items meaningless.
  check('a partly-booked job stays in the waiting strip', coverage.stillWaiting, coverage);
  check('and says how many items still have no lane',
    coverage.missing === 2 && coverage.partial && /2 items still without a lane/.test(coverage.reason || ''),
    coverage);

  const noTicks = await page.evaluate(async (s) => {
    PrdUI.go('form', 'allot');
    await new Promise(r => setTimeout(r, 160));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('prd-crew', 'CREW-A'); set('prd-job', s.job); set('prd-date', s.day2);
    await new Promise(r => setTimeout(r, 300));
    document.querySelectorAll('#prd-body .prd-opt')[0].click();
    await new Promise(r => setTimeout(r, 140));
    const before = laneSlots.length;
    const toasts = []; const orig = window.commsToast; window.commsToast = (m) => toasts.push(m);
    document.querySelector('#prd-body .prd-acts .prd-btn').click();
    await new Promise(r => setTimeout(r, 300));
    window.commsToast = orig;
    // A line already on a lane must not be offered again on another day.
    const greyedNow = [...document.querySelectorAll('#prd-body .prd-allot-r.off')].length;
    return { before, after: laneSlots.length, toasts, greyedNow };
  }, picker);
  check('booking with nothing ticked is refused, not treated as "everything"',
    noTicks.after === noTicks.before && noTicks.toasts.some(t => /Tick at least one/.test(t)), noTicks);
  check('and a line already on a lane is greyed on the next booking',
    noTicks.greyedNow === 3, noTicks);

  const sameDay = await page.evaluate(async (s) => {
    // The rest of the same job, same crew, same day. Not a clash — the board
    // must not cry "two jobs" at one job's own items.
    const r = allotLaneSlot({ crewId: 'CREW-A', jobCardId: s.job, date: s.day1,
      portion: 'full', lineIds: [s.lines[3]], byWhom: 'Test' });
    PrdUI.go('dash', 'board');
    await new Promise(x => setTimeout(x, 300));
    const lane = [...document.querySelectorAll('#prd-body .prd-lane')].find(l => /Crew A/.test(l.textContent));
    const cells = lane ? [...lane.querySelectorAll('.prd-cell')].map(c => ({
      st: [...c.classList].find(x => x.indexOf('c-') === 0),
      sub: (c.querySelector('.s') || {}).textContent
    })) : [];
    return { warning: r && r.warning, cells };
  }, picker);
  check('a second booking of the same job on one crew and day is not an overload',
    !sameDay.warning, sameDay.warning);
  check('the cell stays the job, and counts the items covered',
    sameDay.cells.some(c => c.st === 'c-full' && /3 of 4/.test(c.sub || '')), sameDay.cells);

  console.log('\n— the cutting-list builder —');
  const cutSeed = await page.evaluate(() => {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };
    const c = createCustomer({ name: 'Cut Flow Co', contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'Tubli' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Cut run', taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Wardrobe carcass', qty: 2, unit: 'Nos' });
    const it = quotations.find(x => x.id === q.id).items[0];
    // One oak-veneered board and one plain, so the press default and the
    // two wastage figures are both exercised rather than assumed.
    const oak = itemMaster.find(i => /oak|veneer/i.test(i.name)) || itemMaster[0];
    const plain = itemMaster.find(i => /mdf|ply|board/i.test(i.name) && !/oak|veneer/i.test(i.name)) || itemMaster[1];
    addBOMMaterial(q.id, it.lineId, { name: oak.name, qty: 6, rate: 25, unit: oak.unit });
    addBOMMaterial(q.id, it.lineId, { name: plain.name, qty: 4, rate: 12, unit: plain.unit });
    submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
    setItemDepartmentSequence(q.id, it.lineId, ['carp']);
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah', 'owner');
    const job = confirmQuotationToJobCard(q.id, 'Sales');
    confirmJobRouting(job.id, {}, 'Operations Manager', day(9));
    return { job: job.id, oak: oak.name, plain: plain.name };
  });

  const emptyState = await page.evaluate(async () => {
    PrdUI.go('form', 'cut');
    await new Promise(r => setTimeout(r, 140));
    const b = document.getElementById('prd-body');
    return {
      empty: (b.querySelector('.prd-cut-e') || {}).textContent || '',
      pullLabel: (b.querySelector('[data-a="cut-pull"]') || {}).textContent || '',
      pullDisabled: !!(b.querySelector('[data-a="cut-pull"]') || {}).disabled
    };
  });
  check('the builder starts empty with the spec’s own words',
    /No parts yet\. Pull them from the BOM, then adjust — the sheet is what the saw follows, so it is edited here and nowhere else\./.test(emptyState.empty),
    emptyState.empty);
  check('and Pull is dead until a job card is chosen',
    emptyState.pullDisabled && /Choose a job card/i.test(emptyState.pullLabel), emptyState);

  const pulled = await page.evaluate(async (s) => {
    const el = document.getElementById('prd-job');
    el.value = s.job; el.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 220));
    const label = document.querySelector('#prd-body [data-a="cut-pull"]').textContent;
    document.querySelector('#prd-body [data-a="cut-pull"]').click();
    await new Promise(r => setTimeout(r, 220));
    const b = document.getElementById('prd-body');
    const rows = [...b.querySelectorAll('.prd-cut-r')].map(r => ({
      material: r.querySelector('[data-k="material"]').value,
      qty: Number(r.querySelector('.c-q b').textContent),
      pressed: r.classList.contains('pressed'),
      pressLabel: r.querySelector('.prd-prs').textContent.trim()
    }));
    return { label, rows };
  }, cutSeed);
  check('Pull names the revision and the real count', /Pull 2 parts from/i.test(pulled.label), pulled.label);
  check('it pulls the job’s real BOM materials, not a fixture',
    pulled.rows.length === 2 && pulled.rows.some(r => r.material === cutSeed.oak) && pulled.rows.some(r => r.material === cutSeed.plain),
    pulled.rows);
  check('quantities come from the BOM', pulled.rows.map(r => r.qty).sort().join(',') === '4,6', pulled.rows);
  // "The press flag defaults true on every oak-veneer MDF part" — and only
  // on those, or every plain part gets cut oversize for no reason.
  const oakRow = pulled.rows.find(r => r.material === cutSeed.oak);
  const plainRow = pulled.rows.find(r => r.material === cutSeed.plain);
  check('press defaults on for the veneered part', oakRow && oakRow.pressed && oakRow.pressLabel === 'PRESS', oakRow);
  check('and off for the plain one, which shows an em dash', plainRow && !plainRow.pressed && plainRow.pressLabel === '—', plainRow);

  const pullTwice = await page.evaluate(async () => {
    document.querySelector('#prd-body [data-a="cut-pull"]').click();
    await new Promise(r => setTimeout(r, 200));
    return document.querySelectorAll('#prd-body .prd-cut-r').length;
  });
  // Pulling twice must replace, not append — a doubled sheet is a doubled
  // cut, and the saw follows the sheet.
  check('pulling again replaces rather than doubling the sheet', pullTwice === 2, pullTwice);

  console.log('\n— the five totals, checked against the arithmetic —');
  const totals = await page.evaluate(async () => {
    // 1800 × 580 on every row, so the numbers can be worked out by hand.
    document.querySelectorAll('#prd-body .prd-cut-r').forEach(r => {
      ['length', 'width'].forEach(k => {
        const el = r.querySelector('[data-k="' + k + '"]');
        el.value = k === 'length' ? '1800' : '580';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    await new Promise(r => setTimeout(r, 200));
    const cells = [...document.querySelectorAll('#prd-body .prd-cut-t')].map(t => [
      t.querySelector('.l').textContent.trim(), t.querySelector('b').textContent.trim(), t.querySelector('.n').textContent.trim()
    ]);
    return { cells, note: document.querySelector('#prd-body .prd-cut-hn i').textContent };
  });
  const A = 1800 * 580, BOARD = 2440 * 1220;
  const wantOak = Math.ceil(6 * A / BOARD * 1.12);
  const wantPlain = Math.ceil(4 * A / BOARD * 1.06);
  const wantVeneer = Math.ceil(6 * A * 2 / BOARD * 1.12);
  const got = Object.fromEntries(totals.cells.map(c => [c[0].toUpperCase(), c[1]]));
  check('five totals cells', totals.cells.length === 5, totals.cells.map(c => c[0]));
  check('oak boards = ceil(area / board × 1.12)', Number(got['OAK BOARDS']) === wantOak, { got: got['OAK BOARDS'], want: wantOak });
  check('plain boards use 6% wastage, not 12%', Number(got['PLAIN BOARDS']) === wantPlain, { got: got['PLAIN BOARDS'], want: wantPlain });
  check('veneer counts both faces of every pressed part', Number(got['VENEER SHEETS']) === wantVeneer, { got: got['VENEER SHEETS'], want: wantVeneer });
  check('cut oversize is the pressed quantity', Number(got['CUT OVERSIZE']) === 6, got['CUT OVERSIZE']);
  check('parts is the total quantity', Number(got['PARTS']) === 10, got['PARTS']);
  check('and the live note in the header agrees',
    /2 lines · 10 parts · 6 cut oversize for the press/.test(totals.note), totals.note);

  console.log('\n— editing a row —');
  const edits = await page.evaluate(async () => {
    const row = () => document.querySelector('#prd-body .prd-cut-r');
    const qty = () => Number(row().querySelector('.c-q b').textContent);
    const before = qty();
    row().querySelector('[data-v="1"]').click();
    await new Promise(r => setTimeout(r, 130));
    const up = qty();
    // The stepper floors at 1 — a part with zero of it is not a part.
    for (let i = 0; i < up + 4; i++) { row().querySelector('[data-v="-1"]').click(); await new Promise(r => setTimeout(r, 45)); }
    const floored = qty();
    const wasPressed = row().classList.contains('pressed');
    row().querySelector('.prd-prs').click();
    await new Promise(r => setTimeout(r, 130));
    const toggled = row().classList.contains('pressed');
    const n0 = document.querySelectorAll('#prd-body .prd-cut-r').length;
    row().querySelector('[data-a="cut-del"]').click();
    await new Promise(r => setTimeout(r, 150));
    return { before, up, floored, wasPressed, toggled, n0, n1: document.querySelectorAll('#prd-body .prd-cut-r').length };
  });
  check('the ＋ stepper adds one', edits.up === edits.before + 1, edits);
  check('and the − stepper floors at 1, never zero', edits.floored === 1, edits);
  check('the PRESS toggle really toggles', edits.wasPressed !== edits.toggled, edits);
  check('✕ removes the row', edits.n1 === edits.n0 - 1, edits);

  console.log('\n— typing a dimension does not disturb the form —');
  const typing = await page.evaluate(async (s) => {
    PrdUI.go('form', 'cut');
    await new Promise(r => setTimeout(r, 140));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('prd-job', s.job);
    await new Promise(r => setTimeout(r, 200));
    set('prd-saw', 'saw 2');
    document.querySelector('#prd-body [data-a="cut-pull"]').click();
    await new Promise(r => setTimeout(r, 200));
    const first = document.querySelector('#prd-body .prd-cut-r [data-k="length"]');
    first.focus();
    first.value = '1500';
    first.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 180));
    return {
      saw: document.getElementById('prd-saw').value,
      job: document.getElementById('prd-job').value,
      // The field the caret is in must survive its own keystroke.
      stillFocused: document.activeElement === document.querySelector('#prd-body .prd-cut-r [data-k="length"]'),
      value: document.querySelector('#prd-body .prd-cut-r [data-k="length"]').value,
      rows: document.querySelectorAll('#prd-body .prd-cut-r').length
    };
  }, cutSeed);
  check('the saw and job card are not thrown away by typing', typing.saw === 'saw 2' && typing.job === cutSeed.job, typing);
  check('the field being typed into keeps focus and its value',
    typing.stillFocused && typing.value === '1500', typing);

  console.log('\n— releasing the sheet —');
  const released = await page.evaluate(async () => {
    const toasts = [];
    const orig = window.commsToast;
    window.commsToast = (m) => { toasts.push(m); };
    document.querySelectorAll('#prd-body .prd-opt')[0].click();   // "The current revision"
    await new Promise(r => setTimeout(r, 120));
    const before = cuttingSheets.length;
    document.querySelector('#prd-body .prd-acts .prd-btn').click();
    await new Promise(r => setTimeout(r, 300));
    window.commsToast = orig;
    const sheet = cuttingSheets[cuttingSheets.length - 1];
    return {
      before, after: cuttingSheets.length, toasts,
      lines: sheet ? (sheet.lines || []).length : 0,
      firstLine: sheet && sheet.lines ? sheet.lines[0] : null,
      saw: sheet && sheet.saw
    };
  });
  check('a real cutting sheet is created', released.after === released.before + 1, released);
  check('with the builder’s real parts on it, not an empty list',
    released.lines === 2 && released.firstLine && released.firstLine.material, released);
  check('and the parts carry their press flag and dimensions',
    released.firstLine && typeof released.firstLine.press === 'boolean' && released.firstLine.qty >= 1, released.firstLine);

  const cleared = await page.evaluate(async () => {
    PrdUI.go('form', 'cut');
    await new Promise(r => setTimeout(r, 150));
    return { rows: document.querySelectorAll('#prd-body .prd-cut-r').length, state: PrdUI.state.cutRows };
  });
  // Parts belong to one sheet. Carrying them into the next one would put
  // the last job's parts on this job's saw.
  check('re-entering the flow starts from an empty sheet', cleared.rows === 0 && cleared.state === null, cleared);

  console.log('\n— returning input actually saves —');
  // Every submit of both request forms used to fail: the UI sent `quantity`,
  // `machineHours`, `wastagePercent` and `isEstimate`, none of which were on
  // INPUT_ANSWER_FIELDS, so the first key hit the guard. Nothing was ever
  // saved, and nobody had tried it.
  const answered = await page.evaluate(async (s) => {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };
    const req = raiseInputRequest({ type: 'pricing_input', raisedBy: 'Arun Kumar A', raiserRole: 'estimator',
      jobCardId: s.clear, question: 'Man-hours for the run?', neededBy: day(2) });
    PrdUI.go('form', 'price');
    await new Promise(r => setTimeout(r, 150));
    document.querySelectorAll('#prd-body .prd-opt')[0].click();   // "Hours and quantities"
    await new Promise(r => setTimeout(r, 120));
    const set = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); } };
    set('prd-req', req.id); set('prd-hrs', '40'); set('prd-qty', '6'); set('prd-mch', '9');
    set('prd-note', 'Two men on the saw.');
    await new Promise(r => setTimeout(r, 150));
    const toasts = [];
    const orig = window.commsToast; window.commsToast = (m) => toasts.push(m);
    document.querySelector('#prd-body .prd-acts .prd-btn').click();
    await new Promise(r => setTimeout(r, 300));
    window.commsToast = orig;
    const saved = inputRequests.find(x => x.id === req.id);
    return { toasts, status: saved.status, answer: saved.answer };
  }, seed);
  check('a clear answer is accepted, not refused by the whitelist',
    answered.status === 'answered' && !answered.toasts.some(t => /is not something this role returns/.test(t)),
    answered);
  check('and the figures land on the record', answered.answer &&
    answered.answer.manHours === 40 && answered.answer.quantity === 6 && answered.answer.machineHours === 9,
    answered.answer);

  const guard = await page.evaluate(() => {
    const bad = raiseInputRequest({ type: 'pricing_input', raisedBy: 'Arun Kumar A', raiserRole: 'estimator',
      question: 'What does it cost?', neededBy: null });
    // The whitelist still exists to keep MONEY out — that is commitment 3,
    // and widening it for the form's own advertised fields must not have
    // opened it to a rate.
    const money = answerInputRequest(bad.id, { manHours: 10, rate: 12 }, 'Test');
    const empty = answerInputRequest(bad.id, {}, 'Test');
    return {
      moneyRefused: !!(money && money.error), moneyMsg: money && money.error,
      emptyRefused: !!(empty && empty.error),
      // Every key on the list must also survive the Postgres trigger, whose
      // regex is substring-based — a failure there appears only live.
      trippedByTrigger: INPUT_ANSWER_FIELDS.filter(k => /(rate|price|cost|amount|margin|total|bd|money|value)/i.test(k))
    };
  });
  check('a rate is still refused', guard.moneyRefused && /rate/.test(guard.moneyMsg || ''), guard);
  check('an empty answer is still refused', guard.emptyRefused, guard);
  check('and no whitelisted key would be refused by the database trigger',
    guard.trippedByTrigger.length === 0, guard.trippedByTrigger);

  console.log('\n— no flow shows money, anywhere —');
  const money = await page.evaluate(async (flows) => {
    const hits = [];
    for (const k of flows) {
      PrdUI.go('form', k);
      await new Promise(r => setTimeout(r, 90));
      const t = document.getElementById('prd-body').textContent;
      const m = t.match(/\bBD\s?[\d,]+\.\d{3}|\bselling price\b|\bmargin\b|\bprofit\b/i);
      // "You do not send a price" is the rule NAMING money, which is the
      // opposite of leaking it — the sweep must not read that as a hit.
      if (m && !/do not send a price/i.test(t)) hits.push(k + ': ' + m[0]);
    }
    return hits;
  }, FLOWS);
  check('no selling price, margin or profit renders on any of the twelve', money.length === 0, money);

  console.log('\n— dark mode and the phone —');
  const dark = await page.evaluate(async () => {
    PrdUI.go('form', 'allot');
    execThemeToggle();
    await new Promise(r => setTimeout(r, 250));
    const input = getComputedStyle(document.querySelector('#prd-body .prd-in')).backgroundColor;
    const card = getComputedStyle(document.querySelector('#prd-body .prd-fields')).backgroundColor;
    execThemeToggle();
    await new Promise(r => setTimeout(r, 200));
    return { input, card };
  });
  check('fields take the dark surface tokens (computed, not eyeballed)',
    dark.card === 'rgb(29, 24, 33)' && dark.input !== 'rgb(255, 255, 255)', dark);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const phone = await page.evaluate(async () => {
    PrdUI.go('form', 'allot');
    await new Promise(r => setTimeout(r, 200));
    const opt = document.querySelector('#prd-body .prd-opt');
    const gate = document.querySelector('#prd-body .prd-gate');
    return {
      optFull: Math.round(opt.getBoundingClientRect().width) > 250,
      gateW: Math.round(gate.getBoundingClientRect().width),
      overflow: document.documentElement.scrollWidth > 391
    };
  });
  check('gate options stack full width on a phone', phone.optFull, phone);
  check('and nothing scrolls sideways', phone.overflow === false && phone.gateW <= 390, phone);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 4));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
