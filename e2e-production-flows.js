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
