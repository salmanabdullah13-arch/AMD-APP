/**
 * e2e-crew-timer.js — the crew clock, the ONE way hours are logged
 *
 * Salman's flow (2 Sep 2026): create crew → add members → select job →
 * select item → Start → Pause with a reason → End → photos and a progress
 * marker. The checks drive the REAL phone screens and assert on the real
 * ledger: at End the hours land per man present in labourDayLogs at real
 * payroll rates, split across the items the crew was on — the same records
 * the old per-person forms wrote, which are gone.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => { if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; });

  // ── seed: a routed joinery job with two items, and a curtain job ─────
  const seed = await page.evaluate(() => {
    const c = createCustomer({ name: 'Clock Co ' + Date.now(), contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'Tubli' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Clock test villa', taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Wardrobe', qty: 2, unit: 'Nos' });
    addQuotationItem(q.id, { product: 'TV unit', qty: 1, unit: 'Nos' });
    const qq = quotations.find(x => x.id === q.id);
    qq.items.forEach(it => { addBOMMaterial(q.id, it.lineId, { name: itemMaster[0].name, qty: 2, rate: 25, unit: itemMaster[0].unit }); submitItemBOM(q.id, it.lineId, 'Arun Kumar A'); setItemDepartmentSequence(q.id, it.lineId, ['carp']); });
    transferQuotationStage(q.id, 'approver', 'Estimator'); approveQuotation(q.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(q.id, 'Sales'); confirmJobRouting(job.id, {}, 'Operations Manager', null);
    buildCrewRoster();
    const crewA = crews[0];
    const before = labourDayLogs.length;
    return { job: job.id, lines: job.items.map(i => i.lineId), crewA: crewA.id, crewAName: crewA.name, men: getCrewMembers(crewA.id).map(m => m.name), before,
      roster: timerDeptRoster('install').length, crewsAll: timerCrewsAll().length };
  });
  check('every crew the clock can run for is in one list — production, upholstery stages, and none yet from the timer', seed.crewsAll === 10, seed.crewsAll);

  // ── 1–2: create a crew and add members (data layer, then the screen) ──
  console.log('\n— create crew, add members —');
  const mk = await page.evaluate((s) => {
    const names = timerDeptRoster('install').slice(0, 3);
    const bad = createTimerCrew({ name: 'Install crew B', dept: 'install', members: ['Nobody Real'] });
    const dup = createTimerCrew({ name: s.crewAName, dept: 'carp', members: [] });
    const c = createTimerCrew({ name: 'Install crew B', dept: 'install', members: names.slice(0, 2), lead: names[0] });
    const add = addTimerCrewMember(c.id, names[2]);
    const noEdit = addTimerCrewMember(s.crewA, names[2]);
    return { bad: bad.error, dup: dup.error, id: c.id, members: add.members.length, lead: c.lead, noEdit: noEdit.error, names };
  }, seed);
  check('a name that is not on the payroll is refused', /not on the/.test(mk.bad || ''), mk.bad);
  check('a crew name that already exists is refused', /already a crew/.test(mk.dup || ''), mk.dup);
  check('a crew is created with a lead, and a third man added', mk.members === 3 && mk.lead === mk.names[0], mk);
  check('production and upholstery crews are edited on their own labour pages, not here', /own labour pages/.test(mk.noEdit || ''), mk.noEdit);

  // ── 3–5: select job, select item, Start — through the real phone screen ─
  console.log('\n— select job, select item, start —');
  await page.evaluate(() => launchCrewTimerModule());
  await page.waitForTimeout(400);
  const started = await page.evaluate(async (s) => {
    const q = (sel) => document.querySelector('#timer-body ' + sel);
    q('[data-a="go"][data-v="start"]').click(); await new Promise(r => setTimeout(r, 120));
    q('[data-a="pick-crew"][data-c="' + s.crewA + '"]').click(); await new Promise(r => setTimeout(r, 120));
    const ticked = document.querySelectorAll('#timer-body .ct-tick.on').length;
    // one man absent today
    document.querySelector('#timer-body [data-a="tick-man"][data-n="' + s.men[s.men.length - 1] + '"]').click(); await new Promise(r => setTimeout(r, 100));
    const startDeadNoJob = q('[data-a="start"]').disabled;
    const sel = q('#ct-job'); sel.value = s.job; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 150));
    const startDeadNoItem = q('[data-a="start"]').disabled;
    const lines = document.querySelectorAll('#timer-body [data-a="tick-line"]').length;
    document.querySelector('#timer-body [data-a="tick-line"][data-l="' + s.lines[0] + '"]').click(); await new Promise(r => setTimeout(r, 100));
    document.querySelector('#timer-body [data-a="tick-line"][data-l="' + s.lines[1] + '"]').click(); await new Promise(r => setTimeout(r, 100));
    const live = !q('[data-a="start"]').disabled;
    q('[data-a="start"]').click(); await new Promise(r => setTimeout(r, 200));
    const sess = getOpenSessions()[0];
    return { ticked, startDeadNoJob, startDeadNoItem, lines, live, view: TimerUI.state.view,
      sess: sess && { crew: sess.crewName, job: sess.jobCardId, present: sess.present.length, lines: sess.lineIds.length, status: sess.status, startedAt: !!sess.startedAt },
      clock: (document.querySelector('#timer-body .ct-clock') || {}).textContent };
  }, seed);
  check('everyone in the crew is ticked present by default', started.ticked === seed.men.length, started);
  check('Start is dead until a job is picked, and until an item is ticked', started.startDeadNoJob && started.startDeadNoItem && started.lines === 2, started);
  check('Start writes a running session — crew, job, two items, one man absent, a start time', started.live && started.view === 'run' && started.sess && started.sess.status === 'running' && started.sess.present === seed.men.length - 1 && started.sess.lines === 2 && started.sess.startedAt, started.sess);
  check('the clock is on screen', /^\d\d:\d\d:\d\d$/.test(started.clock || ''), started.clock);

  const second = await page.evaluate((s) => startCrewSession({ crewId: s.crewA, jobCardId: s.job, lineIds: s.lines }), seed);
  check('a crew cannot be on two clocks at once', /already on the clock/.test(second.error || ''), second.error);

  // ── 6: pause with a reason ──────────────────────────────────────────
  console.log('\n— pause with a reason —');
  const paused = await page.evaluate(async () => {
    const q = (sel) => document.querySelector('#timer-body ' + sel);
    q('[data-a="pause-open"]').click(); await new Promise(r => setTimeout(r, 100));
    const chips = [...document.querySelectorAll('#timer-body [data-a="pause"]')].map(x => x.textContent);
    const bad = pauseCrewSession(getOpenSessions()[0].id, 'felt like it');
    document.querySelector('#timer-body [data-a="pause"][data-r="Waiting on material"]').click(); await new Promise(r => setTimeout(r, 150));
    const s = getOpenSessions()[0];
    const clockCls = (q('.ct-clock') || {}).className;
    return { chips, bad: bad.error, status: s.status, reason: s.pauses[0] && s.pauses[0].reason, clockCls };
  });
  check('the pause reasons are the closed list', paused.chips.join('|') === PAUSE_LIST(), paused.chips);
  function PAUSE_LIST() { return 'Waiting on material|Client not on site|No power|Weather|Break|Other'; }
  check('a reason off the list is refused', /Why is the clock stopping/.test(paused.bad || ''), paused.bad);
  check('the session reads paused with its reason, and the clock shows it', paused.status === 'paused' && paused.reason === 'Waiting on material' && /paused/.test(paused.clockCls), paused);

  // Make the day worth something: backdate the start so the ledger has real
  // hours to write, and resume so the pause is closed.
  const timing = await page.evaluate(async () => {
    const s = getOpenSessions()[0];
    const now = Date.now();
    s.startedAt = new Date(now - 4 * 3600000).toISOString();                 // 4 h ago
    s.pauses[0].at = new Date(now - 1.5 * 3600000).toISOString();            // paused 1.5 h ago
    document.querySelector('#timer-body [data-a="resume"]').click(); await new Promise(r => setTimeout(r, 150));
    const el = sessionElapsedHours(s);
    return { status: s.status, resumed: !!s.pauses[0].resumedAt, el: Math.round(el * 100) / 100 };
  });
  check('resume closes the pause, and elapsed excludes it (4 h − 1.5 h paused ≈ 2.5 h)', timing.status === 'running' && timing.resumed && Math.abs(timing.el - 2.5) < 0.05, timing);

  // ── 7–8: end the day, progress, photos → the ledger ─────────────────
  console.log('\n— end the day, photos, progress → the ledger —');
  const ended = await page.evaluate(async (s) => {
    const q = (sel) => document.querySelector('#timer-body ' + sel);
    q('[data-a="open-end"]').click(); await new Promise(r => setTimeout(r, 150));
    const facts = [...document.querySelectorAll('#timer-body .ct-facts b')].map(x => x.textContent);
    // A figure, not the word: the screen SAYS "at his own rate" — what it must never show is a rate.
    const rateOnScreen = /\bBD\b|\d+(\.\d+)?\s*\/\s*h\b/.test(document.getElementById('timer-body').textContent);
    q('[data-a="progress"][data-p="50"]').click(); await new Promise(r => setTimeout(r, 100));
    // A photo through the real file input, offline → data URL.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blob = await (await fetch(png)).blob();
    const file = new File([blob], 'site.png', { type: 'image/png' });
    const input = q('[data-a="photo"]'); const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 400));
    const thumbs = document.querySelectorAll('#timer-body .ct-thumb').length;
    q('#ct-note').value = 'Carcasses up, doors tomorrow';
    const sess = getOpenSessions()[0];
    const before = labourDayLogs.length;
    q('[data-a="end"]').click(); await new Promise(r => setTimeout(r, 300));
    const done = crewSessions.find(x => x.id === sess.id);
    const logs = labourDayLogs.slice(before);
    const job = getJobCard(s.job);
    const pcts = job.items.map(it => it.departmentStatuses.find(d => d.department === 'carp').progressPct);
    const photos = getJobPhotos(s.job);
    return { facts, rateOnScreen, thumbs, status: done.status, hours: done.hours, present: done.present.length,
      logs: logs.length, perLog: [...new Set(logs.map(l => l.hours))], names: [...new Set(logs.map(l => l.employeeName))].length, lines: [...new Set(logs.map(l => String(l.lineId)))].sort(),
      costed: logs.every(l => l.cost > 0 && l.employeeName in EMPLOYEE_RATES), activity: [...new Set(logs.map(l => l.activity))],
      pcts, photos: photos.length, photoNote: photos[0] && photos[0].note, view: TimerUI.state.view, note: done.note };
  }, seed);
  check('the end screen says what will be logged and shows no rate', ended.facts.length === 3 && !ended.rateOnScreen, ended.facts);
  check('a photo taken through the real input shows as a thumbnail', ended.thumbs === 1, ended.thumbs);
  check('End writes the day — 2.5 h, split across the two items, per man present', ended.status === 'ended' && ended.hours === 2.5 && ended.logs === ended.present * 2 && ended.perLog.length === 1 && ended.perLog[0] === 1.25, ended);
  check('every log is a real payroll name at a real rate, against the right lines',
    ended.costed && ended.names === ended.present && ended.lines.join(',') === seed.lines.map(String).sort().join(','), { names: ended.names, lines: ended.lines });
  check('the progress marker lands on both items; the photo lands on the job with the note', ended.pcts.join(',') === '50,50' && ended.photos === 1 && ended.photoNote === 'Carcasses up, doors tomorrow', ended);
  check('and it returns to Today with the day listed', ended.view === 'today', ended.view);

  // 100 only comes from QC.
  const hundred = await page.evaluate((s) => setLineProgress(s.job, s.lines[0], 'carp', 100, 'x'), seed);
  check('100% cannot be marked from the clock — it only comes from QC', /100% comes from QC/.test(hundred.error || ''), hundred.error);

  // ── the running record survives a re-open ───────────────────────────
  console.log('\n— a running clock survives leaving and coming back —');
  const survive = await page.evaluate(async (s) => {
    const r = startCrewSession({ crewId: s.crewA, jobCardId: s.job, lineIds: [s.lines[0]] });
    hideModuleWrap(document.getElementById('timer-module-wrap'));
    launchCrewTimerModule(); await new Promise(r2 => setTimeout(r2, 300));
    const card = document.querySelector('#timer-body .ct-sess.running');
    return { id: r.id, shown: !!card, hasClock: !!(card && card.querySelector('[data-sess]')), open: getOpenSessions().length };
  }, seed);
  check('reopening shows the running session on Today with its clock', survive.shown && survive.hasClock && survive.open === 1, survive);
  await page.evaluate(() => endCrewSession(getOpenSessions()[0].id, {}));

  // ── the old forms are gone; the queues start the clock instead ──────
  console.log('\n— one mechanism everywhere —');
  const forms = await page.evaluate(async (s) => {
    const gone = typeof deptSaveWorkLog === 'undefined' && typeof paintingSaveWorkLog === 'undefined' && typeof installCrewSaveLog === 'undefined';
    hideModuleWrap(document.getElementById('timer-module-wrap'));
    const html = renderDeptQueue('carp', 'Joinery Production Manager', 'joinery');
    const link = /Start the clock/.test(html) && !/Log work|Save day log/.test(html);
    // The hop from a queue lands on the start screen with crew, job and item preset.
    openCrewTimerFor('carp', s.job, s.lines[1]); await new Promise(r => setTimeout(r, 300));
    const st = TimerUI.state;
    const back = !!document.querySelector('#timer-module-wrap .xs-back, #timer-module-wrap [onclick*="execBack"]');
    return { gone, link, view: st.view, crew: st.crewId, job: st.jobId, lines: st.lineIds.slice(), back };
  }, seed);
  check('the three per-person day-log forms are gone', forms.gone, forms.gone);
  check('the workshop queue links to the clock instead', forms.link, forms.link);
  check('the hop from a queue lands on Start with the crew, job and item preset', forms.view === 'start' && forms.crew === seed.crewA && forms.job === seed.job && forms.lines[0] === seed.lines[1], forms);

  // ── the photos reach Sales and the Job Card; the hours do not ────────
  console.log('\n— photos travel, hours do not —');
  const seen = await page.evaluate((s) => {
    hideModuleWrap(document.getElementById('timer-module-wrap'));
    // As SALES — the role the photo is for and the hours are not.
    const prev = window.cloudUserType; window.cloudUserType = 'sales';
    launchJobsModule(); openJobHub(s.job);
    const hub = document.getElementById('jobs-body').textContent;
    const card = document.querySelector('#jobs-body img[src^="data:image"]');
    window.cloudUserType = prev;
    return { photoOnCard: !!card, hubMentionsHours: /2\.5 h|1\.25 h/.test(hub) };
  }, seed);
  check('the Job Card record page shows the progress photo', seen.photoOnCard, seen);
  check('and carries none of the session hours', !seen.hubMentionsHours, seen);

  // ── the shell and the role ──────────────────────────────────────────
  const shell = await page.evaluate(async () => {
    hideModuleWrap(document.getElementById('jobs-module-wrap'));
    const node = window.__eco3d.NODES.find(n => n.id === 'crew-timer'); node.launch(); await new Promise(r => setTimeout(r, 300));
    const w = document.getElementById('timer-module-wrap');
    const quick = (EXEC_QUICK_BY_MODULE.production || []).concat(EXEC_QUICK_BY_MODULE.upholstery || [], EXEC_QUICK_BY_MODULE.curtain || []).filter(q => /Start the clock/.test(q.label)).length;
    const btn = document.querySelector('#timer-body .ct-big');
    return { shown: getComputedStyle(w).display, rail: [...w.querySelectorAll('.xs-item .xs-lbl')].map(x => x.textContent.trim()), quick, overflow: document.documentElement.scrollWidth > 391,
      tap: btn ? Math.round(btn.getBoundingClientRect().height) : 0 };
  });
  check('the Crew clock is a node of its own with Today · Start · Crews · History', shell.shown === 'flex' && shell.rail.join('|') === 'Today|Start the clock|Crews|History', shell.rail);
  check('"Start the clock" leads the quick actions of Production, Upholstery and Curtain', shell.quick === 3, shell.quick);
  check('phone-first: no sideways overflow, and the big button is at least 56px tall', !shell.overflow && shell.tap >= 56, shell);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 4));
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
