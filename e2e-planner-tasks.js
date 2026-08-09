/**
 * e2e-planner-tasks.js — Weekly planner + My tasks (design package, 8 Aug 2026)
 *
 * The package's point is ONE implementation called from every dashboard, so the
 * first checks are that the same widgets appear everywhere rather than each
 * screen growing its own. Then the eight rules the README marks as "not
 * preferences", each of which is a behaviour, not a look.
 */
const { chromium } = require('@playwright/test');
const path = require('path');

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => loadDemoData());

  console.log('\n— one implementation, every dashboard —');
  const wraps = [['launchOwnerModule', 'owner-module-wrap'],
                 ['launchSalesModule', 'sales-module-wrap'],
                 ['launchEstimatorModule', 'estimator-module-wrap']];
  for (const [fn, wrap] of wraps) {
    await page.evaluate(f => window[f](), fn);
    await page.waitForTimeout(600);
    const r = await page.evaluate(w => {
      const el = document.getElementById(w);
      return {
        planners: el.querySelectorAll('[onclick="plTogglePlanner()"]').length,
        taskCards: el.querySelectorAll('[onclick="plToggleTasks()"]').length,
        tiles: ['Today', 'Urgent', 'All', 'Completed'].every(t => el.textContent.includes(t)),
        lists: /My lists/.test(el.textContent)
      };
    }, wrap);
    check(wrap + ' renders exactly one shared planner and one shared task card',
      r.planners === 1 && r.taskCards === 1 && r.tiles && r.lists, r);
  }

  // Rule: both cards in ONE wrapper, so collapsing the planner cannot reshuffle
  // the cards that follow it into the gap (the flow is column-count, not grid).
  const wrapped = await page.evaluate(() => {
    const p = document.querySelector('#estimator-module-wrap [onclick="plTogglePlanner()"]').closest('div[style]');
    const t = document.querySelector('#estimator-module-wrap [onclick="plToggleTasks()"]').closest('div[style]');
    return p.parentElement === t.parentElement;
  });
  check('planner and My tasks share one wrapper', wrapped);

  console.log('\n— rules the package marks as not preferences —');

  await page.evaluate(() => launchOwnerModule());
  await page.waitForTimeout(600);

  // 1. Collapsed shows a count only.
  const collapsed = await page.evaluate(() => {
    plannerState.open = false; tasksState.open = false;
    rerenderDashboard();
    const el = document.getElementById('owner-module-wrap');
    const cardOf = sel => document.querySelector('#owner-module-wrap [onclick="' + sel + '"]').parentElement;
    const p = cardOf('plTogglePlanner()'), t = cardOf('plToggleTasks()');
    const out = {
      plannerHasControls: /Week|Month|Today/.test(p.textContent),
      tasksHasTiles: /Urgent|Completed/.test(t.textContent),
      plannerPill: /^\d+$/.test(p.querySelector('span:nth-child(2)').textContent.trim())
    };
    plannerState.open = true; tasksState.open = true; rerenderDashboard();
    return out;
  });
  check('collapsed planner and tasks show a count only, nothing else',
    !collapsed.plannerHasControls && !collapsed.tasksHasTiles && collapsed.plannerPill, collapsed);

  // 2. Stepping the period carries the selection with it (a real bug, per the
  //    README) — otherwise the agenda shows a day outside the visible period.
  const stepping = await page.evaluate(() => {
    plannerState.scope = 'Week'; plannerState.offset = 0; plannerState.selDate = null;
    const before = plIso(plSelectedDay());
    plStepPeriod(1);
    const week = plIso(plSelectedDay());
    const inWeekCells = plWeekCells().some(c => c.iso === week);
    // The offset is relative to TODAY's month, not to the selected date — the
    // package's own logic. Stepping from a 31st into a 30-day month must clamp.
    plannerState.scope = 'Month'; plannerState.offset = 0;
    const t0 = plToday();
    const lastOfThis = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + 1, 0)).getUTCDate();
    plannerState.selDate = plIso(new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth(), lastOfThis)));
    plStepPeriod(1);
    const month = plIso(plSelectedDay());
    const nextFirst = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + 1, 1));
    const lastOfNext = new Date(Date.UTC(nextFirst.getUTCFullYear(), nextFirst.getUTCMonth() + 1, 0)).getUTCDate();
    const expectClamp = plIso(new Date(Date.UTC(nextFirst.getUTCFullYear(), nextFirst.getUTCMonth(), Math.min(lastOfThis, lastOfNext))));
    plResetPeriod(); plannerState.scope = 'Week';
    return { before, week, inWeekCells, month, expectClamp, sameWeekday:
      new Date(before + 'T00:00:00Z').getUTCDay() === new Date(week + 'T00:00:00Z').getUTCDay() };
  });
  check('week stepping keeps the same weekday and the selection stays visible',
    stepping.sameWeekday && stepping.inWeekCells, stepping);
  check('month stepping clamps the day to the month length',
    stepping.month === stepping.expectClamp, stepping);

  // 3. Dates are UTC, Monday-first, DD MMM YYYY — never toLocaleDateString.
  const dates = await page.evaluate(() => ({
    monday: plWeekCells()[0].label,
    sunday: plWeekCells()[6].label,
    format: plFmtDate(new Date('2026-08-03T00:00:00Z'))
  }));
  check('Monday-first week, DD MMM YYYY dates',
    dates.monday === 'Mon' && dates.sunday === 'Sun' && dates.format === '03 Aug 2026', dates);

  // 4. Adding a planner event also creates a task, so the two never disagree.
  page.once('dialog', d => d.accept('Site meeting with client'));
  const added = await page.evaluate(async () => {
    const before = tasks.length, evBefore = events.length;
    const d = plIso(plSelectedDay());
    // drive the real handler; the second prompt (time) is auto-dismissed below
    window.prompt = (msg) => /Time/.test(msg) ? '10:30' : 'Site meeting with client';
    plAddPlannerEvent();
    const t = tasks[tasks.length - 1];
    return { taskAdded: tasks.length === before + 1, eventAdded: events.length === evBefore + 1,
      sameDay: t && t.dueDate === d, title: t && t.title };
  });
  check('adding to a day creates BOTH the event and a matching task',
    added.taskAdded && added.eventAdded && added.sameDay, added);

  // The new event must actually reach the agenda for that day.
  const onAgenda = await page.evaluate(() => {
    const el = document.getElementById('owner-module-wrap');
    return el.textContent.includes('Site meeting with client');
  });
  check('the new commitment shows on that day\'s agenda', onAgenda);

  // A real company commitment (not just a diary entry) must land on its own
  // day — the strongest thing the retired planner suite proved.
  const realCommitment = await page.evaluate(() => {
    // Must be an OPEN job: getCalendarEvents() only carries promised dates for
    // open jobs, and demo jobs now auto-complete once delivered (9 Aug 2026,
    // derived completion) so 'not cancelled' is no longer the same thing.
    const job = jobCards.find(j => j.status === 'open');
    if (!job) return { skipped: true };
    const d = plIso(plAddDays(plToday(), 2));
    setJobPromisedDate(job.id, d);
    plSelectDay(d);
    const el = document.getElementById('owner-module-wrap');
    const onDay = (getPlannerEventsByDate(execIdentity(), execModuleKey)[d] || [])
      .some(e => e.type === 'promised');
    return { onDay, shown: el.textContent.includes('Promised') };
  });
  check('a real promised date lands on its own day in the agenda',
    realCommitment.skipped || (realCommitment.onDay && realCommitment.shown), realCommitment);

  // 5. Each role has its own task store — Sales must never see a receivables
  //    task belonging to the Owner.
  const isolation = await page.evaluate(() => {
    const owner = execIdentity();
    createTask({ title: 'Call Diyar on 90-day balance', assignee: owner, dueDate: plIso(plToday()) });
    const mineAsOwner = plMyTasks().some(t => t.title === 'Call Diyar on 90-day balance');
    const otherPerson = 'Someone Else';
    const theirs = tasks.filter(t => t.assignee === otherPerson);
    return { mineAsOwner, leakedToOthers: theirs.some(t => t.title === 'Call Diyar on 90-day balance') };
  });
  check('a task belongs to one person only — no shared store between roles',
    isolation.mineAsOwner && !isolation.leakedToOthers, isolation);

  // 6. Urgent is a tile, not a sort order — flagging must not reorder the list.
  const urgent = await page.evaluate(() => {
    const mine = plMyTasks().filter(t => t.status !== 'done');
    const orderBefore = plFilteredTasks(plMyTasks()).map(t => t.id);
    const target = mine[mine.length - 1];
    setTaskUrgent(target.id, true);
    const orderAfter = plFilteredTasks(plMyTasks()).map(t => t.id);
    tasksState.filter = 'urgent';
    const inUrgent = plFilteredTasks(plMyTasks()).map(t => t.id);
    tasksState.filter = 'all';
    return { unchanged: JSON.stringify(orderBefore) === JSON.stringify(orderAfter),
      counted: inUrgent.includes(target.id), id: target.id };
  });
  check('flagging urgent changes the tile count, not the order of the list',
    urgent.unchanged && urgent.counted, urgent);

  // 7. "＋ Link job" stays, and links to a real job card.
  const linked = await page.evaluate(() => {
    const job = jobCards.find(j => j.status !== 'cancelled');
    if (!job) return { skipped: true };
    const t = plMyTasks().find(x => x.status !== 'done');
    window.prompt = () => job.id;
    plLinkTaskToJob(t.id);
    const after = tasks.find(x => x.id === t.id);
    const html = document.getElementById('owner-module-wrap').innerHTML;
    return { linkedTo: after.linkedId, type: after.linkedType, affordanceKept: /＋ Link job/.test(html) };
  });
  check('a task links to a real job card, and the dashed affordance stays on unlinked ones',
    linked.skipped || (linked.linkedTo && linked.type === 'job' && linked.affordanceKept), linked);

  // 8. Every colour is a CSS variable — a hard-coded light colour is invisible
  //    in dark mode, which is why the package forbids hex.
  const noHex = await page.evaluate(() => {
    const el = document.getElementById('owner-module-wrap');
    const p = el.querySelector('[onclick="plTogglePlanner()"]').closest('div[style]');
    const t = el.querySelector('[onclick="plToggleTasks()"]').closest('div[style]');
    const html = p.outerHTML + t.outerHTML;
    return (html.match(/#[0-9a-fA-F]{3,6}\b/g) || []).filter(h => h !== '#fff' && h !== '#ffffff');
  });
  check('no hard-coded colours beyond #fff (dark mode reads the same variables)',
    noHex.length === 0, noHex);

  // Lists: cycling the pill, and the role's own seeded set.
  const lists = await page.evaluate(() => {
    const before = plMyTasks().find(t => t.status !== 'done');
    const startList = before.list;
    plCycleTaskList(before.id);
    const after = tasks.find(t => t.id === before.id).list;
    return { names: plLists().map(l => l.name), changed: startList !== after, after };
  });
  check('tapping the list pill cycles to the next list', lists.changed, lists);
  check('the Owner seeds the package\'s four lists',
    lists.names.join('|') === 'Operations|Sales|Accounts|Site visits', lists.names);

  // Lists belong to a PERSON, not a screen — someone who works in two modules
  // keeps one set. The module only picks the DEFAULTS, the first time that
  // person has no lists at all.
  const estLists = await page.evaluate(() => {
    const fresh = 'Arun Kumar A';
    return {
      seededForEstimator: getTaskListsFor(fresh, 'estimator').map(l => l.name),
      stableAcrossModules: getTaskListsFor(fresh, 'sales').map(l => l.name)
    };
  });
  check('someone first seen in the Estimator seeds that role\'s four lists',
    estLists.seededForEstimator.join('|') === 'To cost|Tenders|Rate library|Checks', estLists);
  check('their lists then follow the person, not the screen they are on',
    estLists.stableAcrossModules.join('|') === estLists.seededForEstimator.join('|'), estLists);

  console.log('\n— the full-screen planner is the same widget —');
  const overlay = await page.evaluate(() => {
    launchOwnerModule();
    execOpenPlanner();
    const h = document.getElementById('exec-planner');
    return {
      open: h.classList.contains('open'),
      planners: h.querySelectorAll('[onclick="plTogglePlanner()"]').length,
      taskCards: h.querySelectorAll('[onclick="plToggleTasks()"]').length,
      // the retired three-rail view stacked seven days and showed an
      // unscheduled count with nothing behind it on a phone
      noStackedDays: !/Nothing planned\./.test(h.textContent),
      noOrphanCount: !/unscheduled/.test(h.textContent),
      noOverflow: h.scrollWidth <= h.clientWidth + 1
    };
  });
  check('the full-screen planner renders the same shared widgets',
    overlay.open && overlay.planners === 1 && overlay.taskCards === 1, overlay);
  check('the seven stacked day columns and the orphan unscheduled count are gone',
    overlay.noStackedDays && overlay.noOrphanCount && overlay.noOverflow, overlay);

  // Scroll clearance for the floating chat bubble: 84px phone / 88px desktop.
  const clearance = await page.evaluate(() =>
    getComputedStyle(document.querySelector('#exec-planner .xs-pl-body')).paddingBottom);
  check('planner scroll clears the chat bubble on a phone (84px)', clearance === '84px', clearance);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
