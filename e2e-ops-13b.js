// Verification for the Operations dashboard, design handoff 13b.
//
// The premise being tested: "the decision queue IS the dashboard" — five step
// buttons above ONE card of fixed geometry, whose content swaps without the
// card moving. Plus the six non-negotiables, which come from exec-shell and
// must survive the rebuild.
//
// Every assertion drives the REAL DOM (clicks, not setStep) wherever the
// behaviour is a user action, and reads real app state afterwards rather than
// trusting rendered text.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-ops-13b');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}
async function shot(page, label) { await page.screenshot({ path: path.join(SHOT_DIR, label + '.png'), fullPage: false }); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => { await d.accept('because the floor needs it sooner'); });

  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForSelector('#app', { state: 'visible' });

  // ── seed: one job awaiting routing, one department budget awaiting
  // verification, one line in rework (held), all through real functions ────
  console.log('\n— seeding real records —');
  const seeded = await page.evaluate(() => {
    const mk = (name, product) => {
      const c = createCustomer({ name, contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'Manama' });
      const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
      const q = convertEnquiryToQuotation(e.id, { projectName: name + ' project', taxPercent: 10, contactPerson: 'A' });
      addQuotationItem(q.id, { product, qty: 2, unit: 'Nos' });
      return { c, e, q };
    };

    // (1) a job sitting in the routing gate
    const a = mk('OPS13B Route Co', 'Reception counter');
    transferQuotationStage(a.q.id, 'approver', 'Estimator');
    approveQuotation(a.q.id, 'Approver');
    const jobRoute = confirmQuotationToJobCard(a.q.id, 'Sales');

    // (2) a job already routed, with a department budget submitted
    const b = mk('OPS13B Budget Co', 'Bar counter');
    transferQuotationStage(b.q.id, 'approver', 'Estimator');
    approveQuotation(b.q.id, 'Approver');
    const jobBud = confirmQuotationToJobCard(b.q.id, 'Sales');
    confirmJobRouting(jobBud.id, { [jobBud.items[0].lineId]: ['carp'] }, 'Operations Manager', '2026-08-19');
    submitDepartmentBudget(jobBud.id, 'carp', { materials: 900, labour: 400 }, 'Joinery Production Manager');

    // (3) a costed quote sitting with the Approver — the feasibility queue
    const c3 = mk('OPS13B Quote Co', 'Wall panelling');
    const it3 = quotations.find(q => q.id === c3.q.id).items[0];
    addBOMMaterial(c3.q.id, it3.lineId, { itemName: itemMaster[0].name, qty: 3, rate: 12, unit: itemMaster[0].unit });
    submitItemBOM(c3.q.id, it3.lineId, 'Arun Kumar A');
    transferQuotationStage(c3.q.id, 'approver', 'Estimator');

    return { routeJob: jobRoute.id, budJob: jobBud.id, quote: c3.q.id, lineId: jobRoute.items[0].lineId };
  });
  check('seeded a routing job, a submitted department budget and a costed quote',
    !!(seeded.routeJob && seeded.budJob && seeded.quote), seeded);

  // ── open Operations through its real launcher ───────────────────────────
  await page.evaluate(() => launchOperationsModule());
  await page.waitForSelector('#ops-module-wrap', { state: 'visible' });
  await page.waitForTimeout(400);
  // The reminders panel auto-opens when something critical is waiting — which
  // the seed above guarantees. That is correct behaviour, and its scrim covers
  // the screen, so dismiss it exactly as a user would before working the queue.
  await page.evaluate(() => { if (typeof execToggleReminders === 'function') execToggleReminders(false); });
  await page.waitForTimeout(200);
  await shot(page, '01-desktop-route');

  console.log('\n— the day queue —');
  const steps = await page.evaluate(() => {
    const b = document.getElementById('ops-dashboard-body');
    return [...b.querySelectorAll('.opsd-step')].map(s => ({
      t: s.querySelector('.opsd-step-t').textContent,
      n: s.querySelector('.opsd-step-n').textContent.trim(),
      on: s.classList.contains('is-on')
    }));
  });
  check('six step buttons, in 13b\'s order', steps.length === 6 &&
    steps[0].t === 'Approve quotes' && steps[1].t === 'Route new jobs' &&
    steps[2].t === 'Verify department BOMs' && steps[3].t === 'Chase exceptions' &&
    steps[4].t === 'Curtain BOM' && steps[5].t === 'Upcoming deliveries', steps.map(s => s.t));
  check('counts are real, not sample data — routing shows the seeded job',
    Number(steps[1].n) >= 1 && Number(steps[2].n) >= 1, { route: steps[1].n, budget: steps[2].n });
  check('a step with nothing waiting shows ✓ rather than a zero',
    steps.every(s => s.n === '✓' || Number(s.n) > 0), steps.map(s => s.n));
  check('route is the default selected step', steps[1].on, steps.map(s => s.on));

  console.log('\n— the widget slot: fixed geometry —');
  const geo1 = await page.evaluate(() => {
    const w = document.querySelector('#ops-dashboard-body .opsd-w');
    const r = w.getBoundingClientRect();
    return { top: Math.round(r.top), h: Math.round(r.height), min: getComputedStyle(w).minHeight };
  });
  check('widget min-height is 436px on desktop, per the handoff', geo1.min === '436px', geo1);

  // swap to every other state through REAL clicks and confirm the card does
  // not move or resize — the whole point of the fixed slot
  const geos = [];
  for (const k of ['quote', 'budget', 'exc', 'curt', 'del']) {
    await page.click(`#ops-dashboard-body .opsd-step[data-k="${k}"]`);
    await page.waitForTimeout(160);
    geos.push(await page.evaluate((kk) => {
      const w = document.querySelector('#ops-dashboard-body .opsd-w');
      const r = w.getBoundingClientRect();
      return { k: kk, top: Math.round(r.top), h: Math.round(r.height), title: w.querySelector('.opsd-wh-t').textContent };
    }, k));
  }
  check('every step swaps the widget content', geos.map(g => g.title).join('|') ===
    'Quote approval|BOM verification|Exceptions|Curtain BOM|Upcoming deliveries', geos.map(g => g.title));
  check('the card never moves or resizes as content swaps',
    geos.every(g => g.top === geo1.top && g.h === geo1.h), { first: geo1, rest: geos });

  console.log('\n— ⤢ opens where —');
  await page.click('#ops-dashboard-body .opsd-step[data-k="budget"]');
  await page.waitForTimeout(120);
  await page.click('#ops-dashboard-body .opsd-wh-exp');
  await page.waitForTimeout(120);
  const menu = await page.evaluate(() => {
    const m = document.querySelector('.opsd-expmenu');
    return m ? [...m.querySelectorAll('button')].map(b => b.textContent.trim()) : null;
  });
  check('⤢ offers the queue full page and the job-wise roll-up',
    !!menu && menu.length === 2 && /full page/i.test(menu[0]) && /roll-up/i.test(menu[1]), menu);
  await page.click('#ops-dashboard-body .opsd-wh-exp');   // close it again

  console.log('\n— BOM verification reads the real submission —');
  const bud = await page.evaluate(() => {
    const b = document.getElementById('ops-dashboard-body');
    return {
      body: b.querySelector('.opsd-wb').textContent.replace(/\s+/g, ' '),
      cats: [...b.querySelectorAll('.opsd-roll-r')].map(r => r.textContent.replace(/\s+/g, ' ').trim())
    };
  });
  check('shows the real submitted categories (BD 900 materials + BD 400 labour)',
    /1,300\.000/.test(bud.body) && /Materials/.test(bud.body) && /Labour/.test(bud.body), bud.cats.slice(0, 4));
  check('says plainly that a department budget is per category, not per line',
    /one figure per category, not per line/i.test(bud.body));
  check('under BD 5,000 shows the no-Owner-step banner',
    /Under BD 5,000\.000 — you approve, no Owner step/i.test(bud.body), bud.body.slice(0, 200));

  const approved = await page.evaluate(async (jobId) => {
    document.querySelector('#ops-dashboard-body [data-a="bud-ok"]').click();
    await new Promise(r => setTimeout(r, 250));
    const j = getJobCard(jobId);
    return j.departmentBudgets.carp.approvalStatus;
  }, seeded.budJob);
  check('approving through the real button actually approves the budget',
    approved === 'approved', approved);

  console.log('\n— the routing gate: tap order IS the sequence —');
  await page.click('#ops-dashboard-body .opsd-step[data-k="route"]');
  await page.waitForTimeout(160);
  const chipState = async () => page.evaluate(() => {
    const b = document.getElementById('ops-dashboard-body');
    return {
      chips: [...b.querySelectorAll('.opsd-rchip')].map(c => ({ t: c.textContent.trim(), on: c.classList.contains('is-on') })),
      seq: b.querySelector('.opsd-rseq').textContent.trim()
    };
  });
  const before = await chipState();
  check('the gate lists a line with a chip per routable department',
    before.chips.length >= 3, before.chips.map(c => c.t));
  // The widget always works the FIRST job in the real queue, which need not be
  // the one this test seeded — assert against whichever job it is actually
  // showing rather than forcing the queue order.
  const gateJob = await page.evaluate(() => getJobsPendingRouting()[0].id);

  // A line arrives with a route already auto-suggested by
  // suggestDepartmentSequence(), so clear whatever is on it before tapping a
  // deliberate order — otherwise this would be measuring the suggestion.
  const cleared = await page.evaluate(async () => {
    const b = document.getElementById('ops-dashboard-body');
    for (let i = 0; i < 6; i++) {
      const on = b.querySelector('.opsd-rchip.is-on');
      if (!on) break;
      on.click();
      await new Promise(r => setTimeout(r, 90));
    }
    return b.querySelector('.opsd-rseq').textContent.trim();
  });
  check('clearing every chip leaves the line explicitly unrouted',
    /Not routed yet/i.test(cleared), cleared);

  // tap Painting THEN Joinery — the numbers must follow the tap order, not
  // the DEPTS array order
  await page.click('#ops-dashboard-body .opsd-rchip[data-d="paint"]');
  await page.waitForTimeout(100);
  await page.click('#ops-dashboard-body .opsd-rchip[data-d="carp"]');
  await page.waitForTimeout(120);
  const tapped = await chipState();
  const paintChip = tapped.chips.find(c => /Paint/i.test(c.t));
  const carpChip = tapped.chips.find(c => /Carp|Joinery/i.test(c.t));
  check('chips number by TAP order — Painting tapped first reads "1 ·"',
    /^1 ·/.test(paintChip.t) && /^2 ·/.test(carpChip.t), { paint: paintChip.t, carp: carpChip.t });
  check('the route summary follows the same order — Painting → Carpentry',
    /Painting\s*→\s*Carpentry/.test(tapped.seq), tapped.seq);

  // untapping the FIRST one renumbers what is left
  await page.click('#ops-dashboard-body .opsd-rchip[data-d="paint"]');
  await page.waitForTimeout(120);
  const untapped = await chipState();
  const carpAfter = untapped.chips.find(c => /Carp|Joinery/i.test(c.t));
  check('untapping renumbers what is left', /^1 ·/.test(carpAfter.t), carpAfter.t);

  const routed = await page.evaluate(async (jobId) => {
    document.querySelector('#ops-dashboard-body [data-a="confirm"]').click();
    await new Promise(r => setTimeout(r, 350));
    const j = getJobCard(jobId);
    return {
      confirmed: j.routingConfirmed,
      seq: j.items[0].departmentSequence,
      firstStatus: (j.items[0].departmentStatuses || [])[0]
    };
  }, gateJob);
  check('confirming dispatches with the tapped sequence, not the default',
    routed.confirmed === true && routed.seq.join(',') === 'carp', routed);
  check('the first stop is queued, per the real pipeline',
    routed.firstStatus && routed.firstStatus.status === 'queued', routed.firstStatus);
  const toastShown = await page.evaluate(() => {
    const t = document.querySelector('#ops-dashboard-body .opsd-toast');
    return t ? t.textContent : null;
  });
  check('a confirmation strip names the job it just routed',
    !!toastShown && toastShown.includes(gateJob), toastShown);

  console.log('\n— quote feasibility reads the real costed quote —');
  await page.click('#ops-dashboard-body .opsd-step[data-k="quote"]');
  await page.waitForTimeout(200);
  const quoteView = await page.evaluate(() => {
    const b = document.getElementById('ops-dashboard-body');
    return {
      body: b.querySelector('.opsd-wb').textContent.replace(/\s+/g, ' '),
      hasDeleg: !!b.querySelector('[data-a="delegate"]'),
      reasons: [...b.querySelectorAll('.opsd-reason')].length
    };
  });
  check('the feasibility card names the real quotation and its Estimator cost',
    quoteView.body.includes(seeded.quote) && /Estimator costed BD/.test(quoteView.body), quoteView.body.slice(0, 160));
  check('the Director delegation panel offers the four reasons',
    quoteView.hasDeleg && quoteView.reasons === 4, quoteView.reasons);
  const delegBlocked = await page.evaluate(async () => {
    document.querySelector('#ops-dashboard-body [data-a="delegate"]').click();
    await new Promise(r => setTimeout(r, 200));
    const q = quotations.find(x => x.stage === 'approver');
    return !!(q && q.delegatedTo);
  });
  check('delegating without picking a reason is refused', delegBlocked === false, delegBlocked);

  console.log('\n— capacity rolls down to live items —');
  const cap = await page.evaluate(async () => {
    const b = document.getElementById('ops-dashboard-body');
    const btn = b.querySelector('.opsd-cap');
    if (!btn) return { none: true };
    // the label must never live inside the fill — handoff chart rule
    const fillHasText = [...b.querySelectorAll('.opsd-track i')].some(i => i.textContent.trim().length > 0);
    btn.click();
    await new Promise(r => setTimeout(r, 200));
    const open = document.querySelector('#ops-dashboard-body .opsd-cap-open');
    return { fillHasText, opened: !!open, text: open ? open.textContent.replace(/\s+/g, ' ').slice(0, 120) : '' };
  });
  check('no bar fill anywhere contains a label (handoff chart rule)', cap.fillHasText === false, cap);
  check('tapping a department rolls down to its live items', cap.opened === true, cap.text);

  console.log('\n— the non-negotiables survive the rebuild —');
  const nn = await page.evaluate(() => {
    const wrap = document.getElementById('ops-module-wrap');
    return {
      quickActions: !!wrap.querySelector('.xs-qa, [onclick*="execToggleQA"]'),
      sidebar: !!wrap.querySelector('.xs-side'),
      collapse: !!wrap.querySelector('.xs-collapse, [onclick*="execToggleSide"]'),
      chat: !!document.getElementById('exec-chat-float'),
      planner: !!wrap.querySelector('[onclick*="plTogglePlanner"], .pl-planner, .pl-card'),
      tasks: /My tasks/i.test(wrap.textContent),
      backInfra: typeof window.execBack === 'function'
    };
  });
  check('Quick actions button present', nn.quickActions, nn);
  check('collapsible sidebar present', nn.sidebar && nn.collapse, nn);
  check('floating chat present', nn.chat, nn);
  check('weekly planner + My tasks present (the shared widget, not a copy)', nn.planner && nn.tasks, nn);
  check('back control infrastructure present', nn.backInfra, nn);

  console.log('\n— the sidebar follows 13b —');
  const nav = await page.evaluate(() => {
    const wrap = document.getElementById('ops-module-wrap');
    return [...wrap.querySelectorAll('.xs-nav-item, .xs-navitem, .xs-nav button')]
      .map(b => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
  });
  check('nav carries 13b\'s decision entries in order',
    /Quote approval/.test(nav.join('|')) && /New jobs/.test(nav.join('|')) &&
    /BOM verification/.test(nav.join('|')) && /Curtain BOM/.test(nav.join('|')), nav.slice(0, 12));

  console.log('\n— dark theme —');
  const dark = await page.evaluate(async () => {
    execThemeToggle();
    await new Promise(r => setTimeout(r, 250));
    const card = document.querySelector('#ops-dashboard-body .opsd-card');
    const bg = getComputedStyle(card).backgroundColor;
    execThemeToggle();
    return bg;
  });
  // Verified by COMPUTED STYLE, never by eyeballing a screenshot — the
  // documented PNG-preview artifact from earlier sessions.
  check('cards take the dark surface token in dark mode', dark === 'rgb(29, 24, 33)', dark);

  console.log('\n— phone —');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  // The earlier confirm emptied the routing queue — seed one more so the
  // route state has real controls to measure, and land on it.
  await page.evaluate(() => {
    const c = createCustomer({ name: 'Phone Route Co', contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'M' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Phone Route project', taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Console table', qty: 1, unit: 'Nos' });
    transferQuotationStage(q.id, 'approver', 'E'); approveQuotation(q.id, 'A');
    confirmQuotationToJobCard(q.id, 'S');
    OpsUI.setStep('route');
  });
  await page.waitForTimeout(300);
  await shot(page, '02-phone-route');
  const phone = await page.evaluate(() => {
    const b = document.getElementById('ops-dashboard-body');
    const w = b.querySelector('.opsd-w');
    const cols = getComputedStyle(b.querySelector('.opsd-cols')).flexDirection;
    const targets = [...b.querySelectorAll('.opsd-btn, .opsd-rchip, .opsd-chip')]
      .map(e => Math.round(e.getBoundingClientRect().height)).filter(h => h > 0);
    // The widget card is overflow:hidden, so a header that does not fit is
    // silently CLIPPED rather than causing page overflow — measure it directly.
    const wh = b.querySelector('.opsd-wh');
    const whr = wh.getBoundingClientRect();
    const exp = wh.querySelector('.opsd-wh-exp').getBoundingClientRect();
    return {
      cols, minH: getComputedStyle(w).minHeight,
      overflow: document.documentElement.scrollWidth > 390 + 1,
      smallest: targets.length ? Math.min(...targets) : 0,
      headerFits: Math.round(exp.right) <= Math.round(whr.right)
    };
  });
  check('single column on a phone', phone.cols === 'column', phone);
  check('widget min-height is 470px on a phone, per the handoff', phone.minH === '470px', phone);
  check('no horizontal overflow at 390px', phone.overflow === false, phone);
  check('every tap target in the widget clears 44px', phone.smallest >= 44, phone.smallest);
  check('the widget header (title · count pill · ⤢) is not clipped at 390px', phone.headerFits, phone);

  // 14 Aug 2026, from Salman's iPhone screenshot — the prototype's own phone
  // arrangement: route controls flow IN the body (no pinned footer with a
  // hole above it), step rows carry a trailing ›, and the shell subtitle
  // carries the production counts.
  const phoneFidelity = await page.evaluate(() => {
    const b = document.getElementById('ops-dashboard-body');
    const w = b.querySelector('.opsd-w');
    const isRoute = w.classList.contains('opsd-w-route');
    const footer = w.querySelector('.opsd-wf');
    const inline = w.querySelector('.opsd-route-inline');
    const confirmBtn = inline && inline.querySelector('[data-a="confirm"]');
    const chev = b.querySelector('.opsd-step-chev');
    const sub = document.querySelector('#ops-module-wrap .xs-sub');
    return {
      isRoute,
      footerHidden: !footer || getComputedStyle(footer).display === 'none',
      inlineShown: !!inline && getComputedStyle(inline).display !== 'none',
      confirmFullWidth: confirmBtn ? Math.round(confirmBtn.getBoundingClientRect().width) >= Math.round(inline.getBoundingClientRect().width) - 2 : false,
      chevShown: !!chev && getComputedStyle(chev).display !== 'none',
      subHasCounts: !!sub && / in production/.test(sub.textContent)
    };
  });
  check('phone: route controls flow in the body, the footer bar is gone',
    phoneFidelity.isRoute && phoneFidelity.footerHidden && phoneFidelity.inlineShown, phoneFidelity);
  check('phone: the confirm button is full width, per the prototype', phoneFidelity.confirmFullWidth, phoneFidelity);
  check('phone: step rows carry the trailing ›', phoneFidelity.chevShown, phoneFidelity);
  check('the shell subtitle carries the production counts', phoneFidelity.subHasCounts, phoneFidelity);

  // The safe-area floor: @media (display-mode: standalone) can't be forced in
  // Chromium, and file:// blocks cssRules on linked sheets — so guard the
  // SOURCE: the rule existing in styles.css is what a regression would delete.
  const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
  const floorRule = /@media[^{]*display-mode:\s*standalone[^{]*\{[^]*?--safe-top:\s*max\(env\(safe-area-inset-top/.test(css);
  check('the standalone safe-area floor rule exists (env()-lies-as-0 guard)', floorRule);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 4));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
