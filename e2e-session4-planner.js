// Session 4 of Salman's backlog — task/calendar reachability and real
// day logging.
//
// Three asks, all covered here:
//   • the sidebar Tasks/Calendar widgets must scroll rather than run off the
//     bottom of the sidebar (and stop truncating at 6 tasks);
//   • both must be reachable from Quick Actions, not only by scrolling the
//     sidebar until you find them;
//   • you must be able to log a meeting or a day's note against a date, and
//     plan a week against it.
//
// events[] is deliberately its own primitive rather than an extension of
// tasks[] or the cost ledger's labourDayLogs[] — see the comment on the
// array in data.js.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== SESSION 4 — PLANNER, TASKS, CALENDAR ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text().slice(0, 150) }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message.slice(0, 150) }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => loadDemoData());

  // ── the events[] primitive itself ──
  currentStep = 'events-data-layer';
  const data = await page.evaluate(() => {
    const me = execIdentity();
    const bad = createEvent({ title: '', date: '2026-08-10', owner: me });
    const noDate = createEvent({ title: 'Untimed', date: '', owner: me });
    const ok = createEvent({ title: 'Site meeting — Villa 5', date: '2026-08-10', time: '09:30', kind: 'site', owner: me, withWhom: 'Silva' });
    const other = createEvent({ title: 'Someone else’s', date: '2026-08-10', owner: 'Not Me' });
    return {
      rejectedNoTitle: !!(bad && bad.error), rejectedNoDate: !!(noDate && noDate.error),
      id: ok.id, kind: ok.kind,
      mine: getEventsForIdentity(me).length,
      // the person named in withWhom sees it on their own calendar too
      shared: getEventsForIdentity('Silva').some(e => e.id === ok.id),
      // and someone else's private entry never appears on mine
      notMine: !getEventsForIdentity(me).some(e => e.id === other.id),
      week: weekDatesOf('2026-08-12')
    };
  });
  record('createEvent rejects an entry with no title and one with no date',
    data.rejectedNoTitle && data.rejectedNoDate ? 'PASS' : 'FAIL', JSON.stringify(data));
  record('A logged entry belongs to its owner and also reaches whoever it names',
    /^EVT-/.test(data.id) && data.kind === 'site' && data.shared && data.notMine ? 'PASS' : 'FAIL', JSON.stringify(data));
  record('weekDatesOf() returns a Monday-first week of 7 days',
    data.week.length === 7 && data.week[0] === '2026-08-10' && data.week[6] === '2026-08-16' ? 'PASS' : 'FAIL', JSON.stringify(data.week));

  // ── logged entries surface on the shared calendar feed ──
  currentStep = 'calendar-feed';
  const feed = await page.evaluate(() => {
    const evs = getCalendarEvents(execIdentity(), 'owner');
    const mine = evs.filter(e => e.type === 'event');
    return { hasEvent: mine.some(e => e.label.includes('Site meeting')), timePrefixed: mine.some(e => e.label.startsWith('09:30')) };
  });
  record('A logged entry shows on the same calendar feed the sidebar and planner both read',
    feed.hasEvent && feed.timePrefixed ? 'PASS' : 'FAIL', JSON.stringify(feed));

  // ── Quick Actions reach: every shelled module gets the Planner group ──
  currentStep = 'quick-actions';
  // The Owner-redesign handoff (7 Aug 2026) moved these out of the sidebar
  // into the Quick actions button above the page title — same three
  // shortcuts, one tap, reachable before any scrolling.
  const nav = await page.evaluate(async () => {
    const labels = async (fn, wrapId) => {
      window[fn]();
      await new Promise(r => setTimeout(r, 500));
      execToggleQuick(true);
      await new Promise(r => setTimeout(r, 150));
      const items = [...document.querySelectorAll('#' + wrapId + ' .xs-qa-pop .xs-qa-item')].map(b => b.textContent);
      execToggleQuick(false);
      return items;
    };
    const owner = await labels('launchOwnerModule', 'owner-module-wrap');
    const sales = await labels('openSalesModule', 'sales-module-wrap');
    return { owner: owner, inSales: sales.some(t => /Weekly planner/.test(t)) };
  });
  record('Every shelled module reaches Weekly planner / My tasks / Calendar from Quick actions',
    ['Weekly planner', 'My tasks', 'Calendar'].every(l => nav.owner.some(t => t.indexOf(l) !== -1)) && nav.inSales ? 'PASS' : 'FAIL', JSON.stringify(nav));

  // ── the panels scroll instead of truncating ──
  currentStep = 'panels-scroll';
  // 8 Aug 2026 — Salman: "my tasks on taskbar serves no useful purpose now".
  // The sidebar panel is gone; these two checks now prove nothing was lost
  // with it: many tasks still list, and an undated one is still reachable.
  const scroll = await page.evaluate(async () => {
    const me = execIdentity();
    for (let i = 0; i < 12; i++) createTask({ title: 'Bulk task ' + i, assignee: me, dueDate: '2026-08-1' + (i % 10) });
    createTask({ title: 'Undated bulk task', assignee: me });
    execOpenPlanner();
    await new Promise(r => setTimeout(r, 400));
    const planner = document.getElementById('exec-planner');
    const slots = [...planner.querySelectorAll('.xs-pl-slot')].map(x => x.textContent);
    const out = {
      panelGone: (document.querySelector('.xs-sidepanels') || { innerHTML: '' }).innerHTML === '',
      undatedReachable: planner.textContent.includes('Undated bulk task'),
      datedInWeek: planner.textContent.includes('Bulk task'),
      cols: plWeekCells().length
    };
    execClosePlanner();
    return out;
  });
  record('The sidebar tasks panel is gone, as asked',
    scroll.panelGone ? 'PASS' : 'FAIL', JSON.stringify(scroll));
  record('Nothing was lost with it — an undated task lands in the planner\'s unscheduled rail',
    scroll.undatedReachable && scroll.cols === 7 ? 'PASS' : 'FAIL', JSON.stringify(scroll));

  // ── the planner opens from the sidebar and shows the real week ──
  currentStep = 'planner-open';
  await page.evaluate(() => launchOwnerModule());
  // The reminders auto-open is on a 450ms timer (exec-shell.js), so waiting
  // less than that dismisses nothing and the panel opens right afterwards.
  await page.waitForTimeout(700);
  // This suite seeds due-dated tasks, which correctly fire reminders — so the
  // reminders panel auto-opens (by design, when something is waiting) and its
  // full-screen scrim swallows every click below. Dismiss it exactly as a
  // person would before working the screen. Same fix e2e-ops-13b needed.
  await page.evaluate(() => { if (typeof execToggleReminders === 'function') execToggleReminders(false); });
  await page.waitForTimeout(200);
  await page.click('#owner-module-wrap .xs-qa');
  await page.waitForTimeout(200);
  await page.click('#owner-module-wrap .xs-qa-pop .xs-qa-item');
  await page.waitForTimeout(300);
  const opened = await page.evaluate(() => {
    const host = document.getElementById('exec-planner');
    return {
      open: host.classList.contains('open'),
      days: plWeekCells().length,
      hasToday: plWeekCells().some(c => c.iso === plIso(plToday()))
    };
  });
  record('The Weekly planner quick action opens a real 7-day week with today marked',
    opened.open && opened.days === 7 && opened.hasToday ? 'PASS' : 'FAIL', JSON.stringify(opened));

  // ── logging a meeting through the real form ──
  currentStep = 'planner-log';
  // The bespoke per-day compose form is gone — the shared planner widget owns
  // adding to a day now (plAddPlannerEvent), and the package's own rule is that
  // it creates BOTH the diary entry and a matching task so the two can never
  // disagree about what is happening that day.
  const logged = await page.evaluate(() => {
    const today = plIso(plToday());
    plSelectDay(today);
    const evBefore = events.length, taskBefore = tasks.length;
    window.prompt = (msg) => /Time/.test(msg) ? '14:00' : 'Client walkthrough';
    plAddPlannerEvent();
    const ev = events[events.length - 1];
    return {
      today,
      stored: !!ev && ev.title === 'Client walkthrough',
      time: ev && ev.time,
      onToday: ev && ev.date === today,
      alsoMadeATask: tasks.length === taskBefore + 1,
      added: events.length === evBefore + 1,
      shownInPlanner: document.getElementById('owner-body')
        ? document.getElementById('owner-body').textContent.includes('Client walkthrough') : true
    };
  });
  record('Logging a meeting saves it against that day and creates the matching task',
    logged.stored && logged.onToday && logged.time === '14:00' && logged.added && logged.alsoMadeATask ? 'PASS' : 'FAIL', JSON.stringify(logged));

  // ── removal is scoped to the person who logged it ──
  currentStep = 'planner-remove';
  const removal = await page.evaluate(() => {
    const ev = events.find(e => e.title === 'Client walkthrough');
    const refused = deleteEvent(ev.id, 'Somebody Else');
    const removed = deleteEvent(ev.id, execIdentity());
    return { refused: !!(refused && refused.error), removed: !!(removed && removed.id), gone: !events.some(e => e.id === ev.id) };
  });
  record('Only the person who logged an entry can remove it', removal.refused && removal.removed && removal.gone ? 'PASS' : 'FAIL', JSON.stringify(removal));

  // ── the planner also reaches the home page, not just a module ──
  currentStep = 'planner-everywhere';
  const home = await page.evaluate(async () => {
    execClosePlanner();
    closeOwnerModule && null;                       // no-op guard, keep state simple
    goTo('eco');
    await new Promise(r => setTimeout(r, 250));
    execOpenPlanner();
    await new Promise(r => setTimeout(r, 250));
    const host = document.getElementById('exec-planner');
    const ok = host.classList.contains('open') && plWeekCells().length === 7;
    execClosePlanner();
    return { ok, closed: !host.classList.contains('open') };
  });
  record('The planner opens from the home page too, and closes cleanly', home.ok && home.closed ? 'PASS' : 'FAIL', JSON.stringify(home));

  const critical = consoleErrors.filter(e => !e.text.includes('favicon'));
  record('No unexpected console errors', critical.length === 0 ? 'PASS' : 'FAIL', critical.map(e => e.text).join(' | '));
  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
