/**
 * e2e-production-pages.js — 19a Production, the fourteen working pages.
 *
 * Phase 2 of the design package. Every page is driven through the REAL rail
 * and the REAL chips; nothing is asserted from a string the renderer happens
 * to contain, and no page is allowed to pass on its own empty state — the
 * seed below puts real work behind every one of them first.
 *
 * Runs offline (the file:// e2e bypass), like the rest of the production
 * suites — none of this touches auth, RLS or cloud persistence.
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

const PAGES = ['board', 'price', 'bomb', 'bom', 'mat', 'quote', 'cut', 'press',
  'paint', 'inst', 'team', 'ot', 'rem', 'doc'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto(pathToFileURL(path.resolve(__dirname, 'index.html')).href);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 20000 });

  // ── seed real work behind every page ────────────────────────────────
  const seed = await page.evaluate(() => {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };

    const mkJob = (name, product, depts, matQty) => {
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

    // Stock for one job only — so the other is genuinely short, which is what
    // the material page, the waiting strip and the blocked lane all read.
    const store = storeLocations[0] || createStoreLocation({ name: 'Prd Pages Store' });
    const bin = storeBins[0] || createStoreBin({ storeId: store.id, code: 'P1' });
    putAwayStock({ itemId: itemMaster[0].id, binId: bin.id, qty: 8, source: 'test' });

    const good = mkJob('Pages Good Co', 'Wardrobe run', ['carp', 'paint'], 3);
    const short = mkJob('Pages Short Co', 'Sofa frame', ['uph'], 400);

    // A booked lane, a pulled paint day, and a pulled site fit.
    const a = allotLaneSlot({ crewId: 'CREW-A', jobCardId: good.id, date: day(1), portion: 'full', byWhom: 'Test' });
    if (a && a.slot) {
      allotDerivedSlot({ crewId: 'CREW-P', baseSlotId: a.slot.id, offsetDays: 2, jobCardId: good.id, byWhom: 'Test' });
      allotDerivedSlot({ crewId: 'CREW-I', baseSlotId: a.slot.id, offsetDays: 4, jobCardId: good.id, byWhom: 'Test' });
    }

    // Paperwork: a live sheet on a saw, a dead sheet from a revision, a batch.
    const sh1 = createCuttingSheet({ jobCardId: good.id, saw: 'saw 2', lines: [{ part: 'Side', qty: 4 }], byWhom: 'Test' });
    if (sh1 && sh1.id) markSheetOnSaw(sh1.id, 'saw 2');
    const rev = startBOMRevision(good.id, 'Client changed the carcass depth', 'Test');
    if (rev && rev.id) issueBOMRevision(rev.id, 'Test');
    const batch = createPressingBatch({ veneer: 'Oak crown 0.6mm', byWhom: 'Test' });
    if (batch && batch.id) { addJobToPressingBatch(batch.id, good.id, 4); addJobToPressingBatch(batch.id, short.id, 3); }

    // One request of each type — they must never appear on each other's page.
    raiseInputRequest({ type: 'pricing_input', raisedBy: 'Arun Kumar A', raiserRole: 'estimator',
      jobCardId: good.id, question: 'Man-hours to build and finish the wardrobe run?', neededBy: day(2) });
    raiseInputRequest({ type: 'bom_budget_input', raisedBy: 'Operations Manager', raiserRole: 'operations_manager',
      question: 'Board consumption per linear metre of carcass?', neededBy: day(5) });

    // Overtime: one booked, and one that is refused for having nothing to
    // work on — the refused row is part of the spec for the ot page.
    bookOvertimeShift({ crewId: 'CREW-A', date: day(1), hours: 3, men: 4,
      recoversTarget: good.id, cause: OVERTIME_CAUSES[0], byWhom: 'Test' });
    const refusal = bookOvertimeShift({ crewId: 'CREW-U', date: day(3), hours: 6, men: 4,
      recoversTarget: short.id, cause: OVERTIME_CAUSES[1], byWhom: 'Test' });

    if (typeof buildCrewRoster === 'function' && !crewMembers.length) buildCrewRoster();

    launchProductionModule();
    return {
      good: good.id, short: short.id,
      refusalRejected: !!(refusal && refusal.error),
      refusalRecorded: overtimeShifts.some(o => o.status === 'refused')
    };
  });

  console.log('— the refusal is recorded, not thrown away —');
  check('overtime with nothing to work on is still refused', seed.refusalRejected, seed);
  // The spec's ot page shows a refused row and counts "nothing recoverable".
  // A refusal that only ever existed as a return value cannot do either.
  check('and the refusal is persisted so it can be shown and counted', seed.refusalRecorded, seed);

  const otMath = await page.evaluate(() => ({
    week: overtimeHoursInWeek(overtimeShifts.map(o => o.date)),
    byCause: getOvertimeByCause(28).reduce((a, r) => a + r.hours, 0),
    refusedHours: overtimeShifts.filter(o => o.status === 'refused').reduce((a, o) => a + o.hours, 0)
  }));
  check('refused hours are excluded from hours worked',
    otMath.refusedHours > 0 && otMath.week === otMath.byCause && otMath.week < otMath.byCause + otMath.refusedHours, otMath);

  await page.waitForTimeout(600);

  console.log('\n— every page opens from the real rail —');
  const opened = [];
  for (const key of PAGES) {
    const r = await page.evaluate(async (k) => {
      const item = document.querySelector('#prd-module-wrap .xs-side [data-prd-page="' + k + '"]')
        || document.querySelector('#prd-module-wrap .xs-side #xs-nav-prd-' + k);
      if (item) item.click();
      else { PrdUI.go('page', k); }
      await new Promise(r2 => setTimeout(r2, 120));
      const body = document.getElementById('prd-body');
      return {
        view: PrdUI.state.view, page: PrdUI.state.page,
        title: (body.querySelector('.prd-page-t') || {}).textContent,
        stats: body.querySelectorAll('.prd-stat').length,
        rule: (body.querySelector('.prd-rule-b') || {}).textContent,
        ctx: !!body.querySelector('.prd-ctx'),
        // A page must show either real content or a table — never a bare
        // "not built yet" panel, which is what these were before Phase 2.
        placeholder: /not built yet/i.test(body.textContent),
        hasContent: !!(body.querySelector('.prd-tbl') || body.querySelector('.prd-mat') ||
          body.querySelector('.prd-crew') || body.querySelector('.prd-empty'))
      };
    }, key);
    opened.push([key, r]);
  }
  check('all fourteen pages open on the right key', opened.every(([k, r]) => r.page === k && r.view === 'page'),
    opened.filter(([k, r]) => r.page !== k).map(([k]) => k));
  check('none of them is still a placeholder', opened.every(([, r]) => !r.placeholder),
    opened.filter(([, r]) => r.placeholder).map(([k]) => k));
  check('every page has a title, four stat cells and content',
    opened.every(([, r]) => r.title && r.stats === 4 && r.hasContent),
    opened.filter(([, r]) => !(r.title && r.stats === 4 && r.hasContent)).map(([k]) => k));
  check('every page states the rule it enforces',
    opened.every(([, r]) => r.rule && r.rule.length > 30),
    opened.filter(([, r]) => !r.rule).map(([k]) => k));
  const prim = await page.evaluate(async () => {
    PrdUI.go('page', 'cut');
    await new Promise(r => setTimeout(r, 140));
    const b = document.querySelector('#prd-body .prd-chips .prd-btn');
    const cs = b && getComputedStyle(b);
    return cs ? { bg: cs.backgroundColor, color: cs.color, radius: cs.borderRadius } : null;
  });
  check('the page primary is a real wine button, not a bare browser one',
    !!prim && prim.bg !== 'rgba(0, 0, 0, 0)' && prim.color === 'rgb(255, 255, 255)' && prim.radius !== '0px', prim);
  check('and carries one context card', opened.every(([, r]) => r.ctx),
    opened.filter(([, r]) => !r.ctx).map(([k]) => k));

  console.log('\n— the two request pages never show each other’s work —');
  const reqs = await page.evaluate(async () => {
    const read = async (k) => {
      PrdUI.go('page', k);
      await new Promise(r => setTimeout(r, 120));
      const t = document.getElementById('prd-body').textContent;
      return { hours: /Man-hours to build/.test(t), standard: /consumption per linear metre/i.test(t) };
    };
    return { price: await read('price'), bomb: await read('bomb') };
  });
  check('pricing input shows the estimator’s request only',
    reqs.price.hours && !reqs.price.standard, reqs.price);
  check('budgeting input shows the operations request only',
    reqs.bomb.standard && !reqs.bomb.hours, reqs.bomb);
  const noNew = await page.evaluate(async () => {
    PrdUI.go('page', 'price');
    await new Promise(r => setTimeout(r, 120));
    const body = document.getElementById('prd-body');
    return {
      primary: (body.querySelector('.prd-chips .prd-btn') || {}).textContent,
      rule: (body.querySelector('.prd-rule-b') || {}).textContent
    };
  });
  // "There is no new-request affordance on this page; the primary button
  // RETURNS input." A create button here would invite production to raise
  // its own pricing request, which is the thing the rule forbids.
  check('the primary button returns input rather than raising a request',
    /return/i.test(noNew.primary || '') && !/new|create|raise/i.test(noNew.primary || ''), noNew);
  check('and the rule names the estimator as the only source',
    /estimator only/i.test(noNew.rule || ''), noNew);

  console.log('\n— material: free of need, and the tri-state Reserve —');
  const mat = await page.evaluate(async () => {
    PrdUI.go('page', 'mat');
    await new Promise(r => setTimeout(r, 150));
    const body = document.getElementById('prd-body');
    const rows = [...body.querySelectorAll('.prd-mat')].map(r => ({
      free: (r.querySelector('.prd-mat-fv') || {}).textContent,
      label: (r.querySelector('.prd-mat-fl') || {}).textContent,
      consequence: (r.querySelector('.prd-mat-c') || {}).textContent,
      reserve: (() => {
        const el = r.querySelector('.prd-mat-res');
        return el ? { text: el.textContent.trim(), cls: [...el.classList].find(c => c !== 'prd-mat-res'), tag: el.tagName } : null;
      })(),
      buttons: [...r.querySelectorAll('button')].map(b => b.textContent.trim()),
      // The two purchase routes differ in whether they commit. Two buttons
      // styled identically say they do not — which is what happened when a
      // later change made the shared outline class neutral.
      routeStyles: [...r.querySelectorAll('button')]
        .filter(b => /purchase|prices/i.test(b.textContent))
        .map(b => getComputedStyle(b).borderColor)
    }));
    return { rows, note: (body.querySelector('.prd-mat-note') || {}).textContent };
  });
  check('it is not a table — one row per material', mat.rows.length > 0, mat.rows.length);
  check('every row carries a FREE OF NEED value in "n of n" form',
    mat.rows.every(r => /^\d+ of \d+$/.test((r.free || '').trim())), mat.rows.map(r => r.free));
  check('and the column is labelled', mat.rows.every(r => (r.label || '').trim() === 'FREE OF NEED'));
  check('every row carries a consequence line, not just a number',
    mat.rows.every(r => (r.consequence || '').trim().length > 20), mat.rows.map(r => r.consequence));
  // The tri-state is the point: "nothing to reserve" must not look like
  // "already reserved", and neither may be clickable.
  const states = mat.rows.map(r => r.reserve && r.reserve.cls);
  check('Reserve is tri-state', states.every(s => ['can', 'done', 'none'].indexOf(s) !== -1), states);
  check('only the reservable state is a real button',
    mat.rows.every(r => r.reserve && (r.reserve.cls === 'can' ? r.reserve.tag === 'BUTTON' : r.reserve.tag === 'SPAN')),
    mat.rows.map(r => r.reserve));
  check('both purchase routes are offered, separately',
    mat.rows.every(r => r.buttons.indexOf('Request purchase') !== -1 && r.buttons.indexOf('Ask for prices') !== -1),
    mat.rows[0] && mat.rows[0].buttons);
  check('the committing route is visually distinct from the one that does not',
    mat.rows.every(r => r.routeStyles && r.routeStyles.length === 2 && r.routeStyles[0] !== r.routeStyles[1]),
    mat.rows.map(r => r.routeStyles));
  check('and the footnote says why they are two buttons and not one',
    /commits/.test(mat.note || '') && /commits nothing/.test(mat.note || ''), mat.note);

  console.log('\n— reserving really holds the stock —');
  const held = await page.evaluate(async () => {
    PrdUI.go('page', 'mat');
    await new Promise(r => setTimeout(r, 150));
    const btn = document.querySelector('#prd-body .prd-mat-res.can');
    if (!btn) return { skipped: true };
    const job = btn.getAttribute('data-j');
    const before = reservations.filter(r => r.jobCardId === job).length;
    btn.click();
    await new Promise(r => setTimeout(r, 250));
    const after = reservations.filter(r => r.jobCardId === job).length;
    const row = document.querySelector('#prd-body .prd-mat-res.done');
    return { job, before, after, nowDone: !!row };
  });
  check('a real click creates a real reservation against the job card',
    held.skipped ? false : held.after > held.before, held);
  check('and the button flips out of the reservable state', held.skipped ? false : held.nowDone, held);

  console.log('\n— teams: crews, the roster, and the men in no crew —');
  const team = await page.evaluate(async () => {
    PrdUI.go('page', 'team');
    await new Promise(r => setTimeout(r, 150));
    const body = document.getElementById('prd-body');
    const cards = [...body.querySelectorAll('.prd-crew')];
    const openBefore = body.querySelectorAll('.prd-crew.open').length;
    const first = cards[0].querySelector('.prd-crew-h');
    const men = cards[0].querySelectorAll('.prd-man').length;
    // Collapse the open one, then open the second — a card must be able to
    // close, or "one open at a time" is really "one that can never shut".
    first.click();
    await new Promise(r => setTimeout(r, 120));
    const afterClose = document.querySelectorAll('#prd-body .prd-crew.open').length;
    document.querySelectorAll('#prd-body .prd-crew-h')[1].click();
    await new Promise(r => setTimeout(r, 120));
    const b2 = document.getElementById('prd-body');
    return {
      cards: cards.length, openBefore, men, afterClose,
      openAfter: b2.querySelectorAll('.prd-crew.open').length,
      secondOpen: [...b2.querySelectorAll('.prd-crew')][1].classList.contains('open'),
      leaders: b2.querySelectorAll('.prd-lead').length,
      monos: [...b2.querySelectorAll('.prd-mono')].map(m => m.textContent.trim()),
      manMonos: [...b2.querySelectorAll('.prd-man-m')].map(m => m.textContent.trim()),
      loose: !!b2.querySelector('.prd-loose'),
      looseNote: (b2.querySelector('.prd-loose-n') || {}).textContent,
      rule: (b2.querySelector('.prd-rule-b') || {}).textContent
    };
  });
  check('five crew cards, one open', team.cards === 5 && team.openBefore === 1, team);
  check('the open card lists its men from the real roster', team.men > 0, team.men);
  check('a crew card can be closed as well as opened', team.afterClose === 0, team);
  check('opening another moves the open card rather than adding one',
    team.openAfter === 1 && team.secondOpen, team);
  check('the leader is marked', team.leaders > 0, team.leaders);
  // Two crews sharing a monogram is worse than none — the spec fixes them.
  check('the five crew monograms are the spec’s, and all distinct',
    team.monos.join('') === 'CACBSUPPSI', team.monos);
  check('no two men in one crew share a monogram',
    new Set(team.manMonos).size === team.manMonos.length, team.manMonos);
  check('the men in no crew have their own card', team.loose, team);
  check('and it says what that costs', /producing nothing/.test(team.looseNote || ''), team.looseNote);
  check('the rule states work is allotted to a crew, never to a person',
    /never to a person/.test(team.rule || ''), team.rule);

  console.log('\n— overtime page: cause and the refused row —');
  const ot = await page.evaluate(async () => {
    PrdUI.go('page', 'ot');
    await new Promise(r => setTimeout(r, 150));
    const body = document.getElementById('prd-body');
    return {
      causes: [...body.querySelectorAll('.prd-cause')].map(c => c.textContent.trim()),
      refused: /Refused/.test(body.textContent),
      ctx: [...body.querySelectorAll('.prd-ctx-r')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
      recoverable: /Nothing recoverable/.test(body.textContent)
    };
  });
  check('every shift shows the cause of the slip', ot.causes.length > 0, ot.causes);
  check('the refused shift is on the page', ot.refused, ot);
  check('the side card breaks four weeks down by cause', ot.ctx.length > 0, ot.ctx);
  check('and counts what was refused as nothing recoverable', ot.recoverable, ot.ctx);

  console.log('\n— chips filter, and do not leak between pages —');
  const chips = await page.evaluate(async () => {
    PrdUI.go('page', 'cut');
    await new Promise(r => setTimeout(r, 150));
    const rowsFor = () => document.querySelectorAll('#prd-body .prd-tbl tbody tr').length;
    const all = rowsFor();
    const cs = document.querySelectorAll('#prd-body .prd-chip');
    cs[cs.length - 1].click();
    await new Promise(r => setTimeout(r, 120));
    const filtered = rowsFor();
    const chipIdx = PrdUI.state.pgChip;
    // Switching page must reset the chip, or the next page opens on a filter
    // that belonged to the last one and silently shows a subset.
    PrdUI.go('page', 'doc');
    await new Promise(r => setTimeout(r, 120));
    return { all, filtered, chipIdx, afterSwitch: PrdUI.state.pgChip };
  });
  check('a chip narrows the page it is on', chips.filtered < chips.all && chips.chipIdx > 0, chips);
  check('changing page resets the chip', chips.afterSwitch === 0, chips);

  console.log('\n— no page shows money, anywhere —');
  // The hardest rule in the package: production returns hours and
  // quantities, never a price. Swept across every page rather than argued.
  const money = await page.evaluate(async (pages) => {
    const hits = [];
    for (const k of pages) {
      PrdUI.go('page', k);
      await new Promise(r => setTimeout(r, 110));
      const t = document.getElementById('prd-body').textContent;
      // "BD 1,200.000", "Rate", "Margin", "Selling price", "Profit"
      const m = t.match(/\bBD\s?[\d,]+\.\d{3}|\bselling price\b|\bmargin\b|\bprofit\b/i);
      if (m) hits.push(k + ': ' + m[0]);
    }
    return hits;
  }, PAGES);
  check('no selling price, margin or profit renders on any of the fourteen',
    money.length === 0, money);

  console.log('\n— dark mode and the phone —');
  const dark = await page.evaluate(async () => {
    PrdUI.go('page', 'mat');
    execThemeToggle();
    await new Promise(r => setTimeout(r, 250));
    const c = getComputedStyle(document.querySelector('#prd-body .prd-page-c')).backgroundColor;
    const rule = getComputedStyle(document.querySelector('#prd-body .prd-rule')).backgroundColor;
    execThemeToggle();
    await new Promise(r => setTimeout(r, 200));
    return { c, rule };
  });
  check('page cards take the dark surface token (computed, not eyeballed)',
    dark.c === 'rgb(29, 24, 33)', dark);
  check('the rule card keeps its wine ground in dark', /rgb\(/.test(dark.rule) && dark.rule !== dark.c, dark);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const phone = await page.evaluate(async () => {
    const worst = [];
    for (const k of ['board', 'mat', 'team', 'cut']) {
      PrdUI.go('page', k);
      await new Promise(r => setTimeout(r, 140));
      const card = document.querySelector('#prd-body .prd-page-c');
      if (card && card.getBoundingClientRect().width > 390) worst.push(k + ':' + Math.round(card.getBoundingClientRect().width));
    }
    return { worst, overflow: document.documentElement.scrollWidth > 391 };
  });
  check('no page card is wider than the phone', phone.worst.length === 0, phone);
  check('and the page itself does not scroll sideways', phone.overflow === false, phone);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 4));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
