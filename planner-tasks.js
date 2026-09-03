/* ============================================================================
   AMD-APP — Weekly planner + My tasks
   From design_handoff_planner_tasks (8 Aug 2026). The package's own words:
   "Copy it. Do not re-derive these widgets from the description."

   These two widgets appear on EVERY role's dashboard (non-negotiables 4 and 5).
   One implementation, called from every dashboard — each rebuild used to
   produce a slightly different interface, which is the inconsistency this
   file exists to end.

     renderWeekPlanner()   → HTML string
     renderMyTasks()       → HTML string

   Mount both in ONE wrapper div. The dashboard column flow is column-count,
   not a grid: without the wrapper, collapsing the planner reshuffles unrelated
   cards into the gap.

   Every colour is a CSS variable from dashboard-tokens.css. No hex — dark mode
   reads the same variables, and a hard-coded light colour is invisible there.

   ── Deviations from the reference file, each forced and each deliberate ──
   1. Helper and handler names carry a `pl` prefix. The reference declares
      today/iso/addDays/wdKey/fmtDate at top level, and this app concatenates
      ~30 files into one global scope where all five already exist. (`pt` was
      the first choice and had to move too — that is Painting's prefix, and
      painting.js loads AFTER this file, so its own ptEsc would have won and it
      does not escape quotes.) A rename is mechanical, not a re-derivation.
   2. PLANNER_EVENTS is keyed by DATE, not weekday (getPlannerEventsByDate in
      data.js). The reference's weekday keys are a demo artifact — real
      commitments have real dates, and weekday keys repeat every week.
   3. State is UI-only. Tasks and lists live in the app's real tasks[] /
      taskLists[], filtered by the signed-in identity — which is how the
      package's "never share a task store between roles" rule is satisfied
      here, structurally rather than by convention.
   ========================================================================= */

/* ---------------------------------------------------------------------------
   STATE — UI only. The records themselves are in data.js.
   ------------------------------------------------------------------------ */

const plannerState = {
  open: true,              // planner card expanded
  scope: 'Week',           // 'Week' | 'Month'
  offset: 0,               // periods from today; 0 = current
  selDate: null            // 'YYYY-MM-DD'; null = today
};

const tasksState = {
  open: true,
  filter: 'all'            // 'today' | 'urgent' | 'all' | 'done' | <listKey>
};

/* ---------------------------------------------------------------------------
   DATE HELPERS — all UTC, Monday-first. Bahrain has no DST; UTC keeps the grid
   stable regardless of the device's timezone.
   ------------------------------------------------------------------------ */

const PL_WD_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                   'August', 'September', 'October', 'November', 'December'];

const plIso = (d) => localISO(d);
const plAddDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const plMondayOf = (d) => plAddDays(d, -(((d.getUTCDay() + 6) % 7)));

/* 'DD MMM YYYY' — the app's date format. Never toLocaleDateString(). */
const plFmtDate = (d) =>
  String(d.getUTCDate()).padStart(2, '0') + ' ' +
  PL_MONTHS[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCFullYear();

const plToday = () => new Date(todayISO() + 'T00:00:00Z');
const plSelectedDay = () => plannerState.selDate
  ? new Date(plannerState.selDate + 'T00:00:00Z')
  : plToday();

function plIdentity() { return typeof execIdentity === 'function' ? execIdentity() : 'Owner'; }
function plModuleKey() { return typeof execModuleKey !== 'undefined' ? execModuleKey : null; }
function plEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

/* Real commitments for the signed-in person, grouped by date. Rebuilt per
   render — the underlying arrays change as jobs are routed and deliveries
   booked, and a cached copy would go stale silently. */
function plEvents() {
  try {
    return typeof getPlannerEventsByDate === 'function'
      ? getPlannerEventsByDate(plIdentity(), plModuleKey()) : {};
  } catch (e) { return {}; }
}
function plEventsOn(d, cache) { return (cache || plEvents())[plIso(d)] || []; }

/* The one re-render entry point. Whichever dashboard is showing owns its own
   body; this finds it rather than each dashboard having to register. */
function rerenderDashboard() {
  const M = [
    ['owner-module-wrap', 'renderOwnerBody'],
    ['admin-module-wrap', 'renderAdminBody'],
    ['sales-module-wrap', 'renderSalesBody'],
    ['estimator-module-wrap', 'renderEstimatorBody'],
    ['approver-module-wrap', 'renderApproverBody'],
    ['accounts-module-wrap', 'renderAccountsBody'],
    ['jobs-module-wrap', 'renderJobsBody'],
    ['hr-module-wrap', 'renderHRBody'],
    ['storekeeper-module-wrap', 'renderStorekeeperBody'],
    ['sk-module-wrap', 'renderSKBody'],
    ['joinery-module-wrap', 'renderJoineryBody'],
    ['upholstery-module-wrap', 'renderUpholsteryBody'],
    ['uph-module-wrap', 'renderUphBody'],
    ['painting-module-wrap', 'renderPaintingBody'],
    ['ops-module-wrap', 'renderOpsDashboard']
  ];
  for (const [id, fn] of M) {
    const el = document.getElementById(id);
    if (el && el.style.display !== 'none' && typeof window[fn] === 'function') {
      try { window[fn](); } catch (e) { /* one dashboard must not break the widget */ }
    }
  }
  if (typeof execRefreshBadges === 'function') execRefreshBadges();
  if (typeof plRenderFullScreen === 'function') plRenderFullScreen();
}

/* ---------------------------------------------------------------------------
   WEEKLY PLANNER
   Collapsed shows a count only. Week/Month switch plus ‹ Today › stepping.
   Selection follows the period — see plStepPeriod().
   ------------------------------------------------------------------------ */

function renderWeekPlanner() {
  const cache = plEvents();
  const cells = plannerState.scope === 'Week' ? plWeekCells() : plMonthCells();
  const total = cells.filter(c => c.inMonth).reduce((n, c) => n + plEventsOn(c.date, cache).length, 0);

  return `
  <div style="padding:16px;border-radius:var(--r);border:1px solid var(--line);background:var(--card);box-shadow:var(--sh)">
    <button onclick="plTogglePlanner()" style="display:flex;width:100%;align-items:center;gap:10px;background:transparent;border:0;padding:0;cursor:pointer;text-align:left">
      <span style="font-size:13.5px;font-weight:650;color:var(--tx);flex:1">This week</span>
      <span style="flex:none;min-width:22px;height:20px;padding:0 7px;border-radius:999px;background:var(--wine-tint);color:var(--wine);font-size:11px;font-weight:700;line-height:20px;text-align:center">${total}</span>
      <span style="flex:none;color:var(--tx3);font-size:12px;width:12px;text-align:center">${plannerState.open ? '⌃' : '⌄'}</span>
    </button>
    ${plannerState.open ? `
    <div style="margin-top:11px">
      ${plPeriodControls()}
      ${plannerState.scope === 'Week' ? plWeekStrip(cells, cache) : plMonthGrid(cells, cache)}
      ${plDayAgenda(cache)}
    </div>` : ''}
  </div>`;
}

/* Scope switch on the left, ‹ Today › on the right — two different kinds of
   control (what you are looking at, versus when). Splitting them stops the row
   reading as five equal buttons. */
function plPeriodControls() {
  const seg = (k) => `
    <button onclick="plSetScope('${k}')" style="padding:5px 12px;border:0;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer;${
      plannerState.scope === k
        ? 'background:var(--card);color:var(--wine);box-shadow:var(--sh)'
        : 'background:transparent;color:var(--tx3)'}">${k}</button>`;

  const nav = 'flex:none;width:26px;height:26px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--tx2);font-size:12px;cursor:pointer';

  return `
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:9px">
      <div style="display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--sunk);border:1px solid var(--line2)">
        ${seg('Week')}${seg('Month')}
      </div>
      <span style="flex:1"></span>
      <button onclick="plStepPeriod(-1)" style="${nav}">‹</button>
      <button onclick="plResetPeriod()" style="flex:none;height:26px;padding:0 9px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--tx2);font-size:11px;font-weight:600;cursor:pointer">Today</button>
      <button onclick="plStepPeriod(1)" style="${nav}">›</button>
    </div>
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:9px">
      <span style="font-size:12.5px;font-weight:650;color:var(--tx)">${plPeriodLabel()}</span>
      <span style="font-size:10.5px;color:var(--tx3)">${plPeriodRange()}</span>
    </div>`;
}

function plWeekStrip(cells, cache) {
  return `<div style="display:flex;gap:4px">${cells.map(c => plDayCell(c, cache)).join('')}</div>`;
}

function plMonthGrid(cells, cache) {
  return `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px">
      ${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d =>
        `<span style="text-align:center;font-size:9.5px;font-weight:700;color:var(--tx3)">${d}</span>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">
      ${cells.map(c => plDayCell(c, cache)).join('')}
    </div>`;
}

/* One day button. Same function for both scopes — only the label differs.
   Out-of-month days dim to 45% and stay tappable, so the edges of the month
   don't look broken. */
function plDayCell(c, cache) {
  const isSel = c.iso === plIso(plSelectedDay());
  const has = plEventsOn(c.date, cache).length > 0 && c.inMonth;
  const week = plannerState.scope === 'Week';

  const style = isSel
    ? 'flex:1;min-width:0;padding:7px 0 6px;border-radius:9px;border:1px solid var(--wine);background:var(--wine);color:#fff;cursor:pointer;text-align:center'
    : `flex:1;min-width:0;padding:7px 0 6px;border-radius:9px;border:1px solid ${c.inMonth ? 'var(--line)' : 'transparent'};background:${c.inMonth ? 'var(--card)' : 'transparent'};color:${c.inMonth ? 'var(--tx2)' : 'var(--tx3)'};cursor:pointer;text-align:center;opacity:${c.inMonth ? '1' : '.45'}`;

  const dot = has
    ? `display:block;width:5px;height:5px;border-radius:99px;margin:3px auto 0;background:${isSel ? '#fff' : 'var(--wine)'}`
    : 'display:block;width:5px;height:5px;margin:3px auto 0;background:transparent';

  return `
    <button onclick="plSelectDay('${c.iso}')" style="${style}">
      ${week ? `<span style="display:block;font-size:9.5px;font-weight:600;opacity:.8">${c.label}</span>` : ''}
      <span style="display:block;font-size:${week ? '13px' : '11.5px'};font-weight:${week ? '650' : '600'};margin-top:${week ? '1px' : '0'}">${c.n}</span>
      <i style="${dot}"></i>
    </button>`;
}

/* The selected day's events. Capped at 132px with its own scroll, so a heavy
   day cannot push My tasks off the screen. */
function plDayAgenda(cache) {
  const d = plSelectedDay();
  const events = plEventsOn(d, cache);

  const toneColor = { wine: 'var(--wine)', bad: 'var(--bad)', warn: 'var(--warn)', plain: 'var(--tx3)' };
  const toneBg = { wine: 'var(--wine-tint)', bad: 'var(--bad-bg)', warn: 'var(--warn-bg)', plain: 'var(--sunk)' };

  return `
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin:12px 0 7px">
      <span style="font-size:12px;font-weight:650;color:var(--tx)">${PL_WD_LABELS[(d.getUTCDay() + 6) % 7]} ${plFmtDate(d)}</span>
      <span style="font-size:11px;color:var(--tx3)">${events.length ? events.length + ' scheduled' : 'Nothing scheduled'}</span>
    </div>
    <div style="max-height:132px;overflow:auto;scrollbar-width:thin">
      ${events.length ? events.map(a => `
        <div style="display:flex;gap:9px;padding:7px 0;border-bottom:1px solid var(--line2)">
          <span style="flex:none;width:38px;font-size:11px;font-weight:650;color:var(--tx2);padding-top:1px">${plEsc(a.t || '—')}</span>
          <span style="flex:1;min-width:0">
            <span style="display:block;font-size:12px;font-weight:600;color:var(--tx);line-height:1.35">${plEsc(a.ttl)}</span>
            ${a.m ? `<span style="display:block;font-size:10.5px;color:var(--tx3);margin-top:2px">${plEsc(a.m)}</span>` : ''}
            <span style="display:inline-block;margin-top:5px;padding:1px 7px;border-radius:999px;font-size:9.5px;font-weight:700;background:${toneBg[a.tone]};color:${toneColor[a.tone]}">${plEsc(a.tag)}</span>
          </span>
        </div>`).join('')
      : `<div style="padding:14px 0;text-align:center;font-size:11.5px;color:var(--tx3)">Nothing scheduled this day.</div>`}
    </div>
    <button onclick="plAddPlannerEvent()" style="display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:10px;padding:8px 10px;border-radius:9px;border:1px dashed var(--wine-line);background:var(--wine-tint);color:var(--wine);font-size:12px;font-weight:600;cursor:pointer">＋ Add to this day</button>`;
}

/* --- period maths --------------------------------------------------------- */

function plWeekCells() {
  const start = plAddDays(plMondayOf(plToday()), plannerState.offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = plAddDays(start, i);
    return { date: d, iso: plIso(d), n: String(d.getUTCDate()).padStart(2, '0'),
             label: PL_WD_LABELS[i], inMonth: true };
  });
}

function plMonthCells() {
  const t = plToday();
  const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + plannerState.offset, 1));
  const gridStart = plMondayOf(first);
  return Array.from({ length: 42 }, (_, i) => {
    const d = plAddDays(gridStart, i);
    return { date: d, iso: plIso(d), n: String(d.getUTCDate()).padStart(2, '0'),
             label: PL_WD_LABELS[i % 7], inMonth: d.getUTCMonth() === first.getUTCMonth() };
  });
}

function plPeriodLabel() {
  const o = plannerState.offset;
  if (plannerState.scope === 'Month') {
    const t = plToday();
    const f = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + o, 1));
    return PL_MONTHS[f.getUTCMonth()] + ' ' + f.getUTCFullYear();
  }
  if (o === 0) return 'This week';
  if (o === -1) return 'Last week';
  if (o === 1) return 'Next week';
  return o < 0 ? Math.abs(o) + ' weeks back' : o + ' weeks ahead';
}

function plPeriodRange() {
  if (plannerState.scope === 'Month') return '';
  const start = plAddDays(plMondayOf(plToday()), plannerState.offset * 7);
  return plFmtDate(start).slice(0, 6) + ' – ' + plFmtDate(plAddDays(start, 6));
}

/* --- handlers ------------------------------------------------------------- */

function plTogglePlanner() { plannerState.open = !plannerState.open; rerenderDashboard(); }
function plSelectDay(isoStr) { plannerState.selDate = isoStr; rerenderDashboard(); }

function plSetScope(scope) {
  plannerState.scope = scope;
  plannerState.offset = 0;
  plannerState.selDate = null;
  rerenderDashboard();
}

/* Stepping MUST carry the selection with it. Without this the selected day
   falls outside the visible period and the agenda shows a day the user cannot
   see — a real bug the package calls out. Week: same weekday. Month: same
   day-of-month, clamped to the month's length. */
function plStepPeriod(delta) {
  plannerState.offset += delta;
  const sel = plSelectedDay();

  if (plannerState.scope === 'Week') {
    plannerState.selDate = plIso(plAddDays(sel, delta * 7));
  } else {
    const t = plToday();
    const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + plannerState.offset, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const day = Math.min(sel.getUTCDate(), lastDay);
    plannerState.selDate = plIso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day)));
  }
  rerenderDashboard();
}

function plResetPeriod() {
  plannerState.offset = 0;
  plannerState.selDate = null;
  rerenderDashboard();
}

/* Adding an event here also creates a task, so the planner and the task list
   never disagree about what is happening that day. */
function plAddPlannerEvent() {
  const d = plSelectedDay();
  const title = window.prompt('What is happening on ' + plFmtDate(d) + '?');
  if (!title || !title.trim()) return;
  const time = window.prompt('Time (HH:MM), or leave blank') || null;
  const res = createEvent({
    title: title.trim(), date: plIso(d), time: time && time.trim() ? time.trim() : null,
    kind: 'meeting', owner: plIdentity()
  });
  if (res && res.error) { if (typeof commsToast === 'function') commsToast(res.error); return; }
  createTask({ title: title.trim(), assignee: plIdentity(), dueDate: plIso(d) });
  rerenderDashboard();
}

/* ---------------------------------------------------------------------------
   MY TASKS
   Apple Reminders model: smart tiles, user lists, tasks linkable to a job card.
   Collapsed shows an open count only.
   ------------------------------------------------------------------------ */

function plMyTasks() {
  return (typeof tasks !== 'undefined' ? tasks : []).filter(t => t.assignee === plIdentity());
}
function plLists() {
  return typeof getTaskListsFor === 'function' ? getTaskListsFor(plIdentity(), plModuleKey()) : [];
}
function plIsToday(t) { return t.dueDate === plIso(plToday()); }
function plIsUrgent(t) { return !!t.urgent; }

function renderMyTasks() {
  const mine = plMyTasks();
  const openCount = mine.filter(t => t.status !== 'done').length;

  return `
  <div style="padding:16px;border-radius:var(--r);border:1px solid var(--line);background:var(--card);box-shadow:var(--sh)">
    <button onclick="plToggleTasks()" style="display:flex;width:100%;align-items:center;gap:10px;background:transparent;border:0;padding:0;cursor:pointer;text-align:left">
      <span style="font-size:13.5px;font-weight:650;color:var(--tx);flex:1">My tasks</span>
      <span style="flex:none;min-width:22px;height:20px;padding:0 7px;border-radius:999px;background:var(--wine-tint);color:var(--wine);font-size:11px;font-weight:700;line-height:20px;text-align:center">${openCount}</span>
      <span style="flex:none;color:var(--tx3);font-size:12px;width:12px;text-align:center">${tasksState.open ? '⌃' : '⌄'}</span>
    </button>
    ${tasksState.open ? `
    <div style="margin-top:11px">
      ${plTaskTiles(mine)}
      <div style="max-height:184px;overflow:auto;scrollbar-width:thin">
        ${plFilteredTasks(mine).map(plTaskRow).join('') || plEmptyTasks()}
      </div>
      <button onclick="plAddTask()" style="display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:10px;padding:8px 10px;border-radius:9px;border:1px dashed var(--wine-line);background:var(--wine-tint);color:var(--wine);font-size:12px;font-weight:600;cursor:pointer">＋ Add task</button>
      ${plTaskLists(mine)}
    </div>` : ''}
  </div>`;
}

/* Four smart tiles, 2×2 — a row of four crushes "Completed" to two lines at
   phone width. Urgent is its own tile, not a sort order: the whole point is
   seeing the count without changing what you are looking at. */
function plTaskTiles(mine) {
  const open = mine.filter(t => t.status !== 'done');
  const tiles = [
    { k: 'today',  g: '▤',  label: 'Today',     c: 'var(--wine)', n: open.filter(plIsToday).length },
    { k: 'urgent', g: '!!', label: 'Urgent',    c: 'var(--bad)',  n: open.filter(plIsUrgent).length },
    { k: 'all',    g: '▦',  label: 'All',       c: 'var(--tx2)',  n: open.length },
    { k: 'done',   g: '✓',  label: 'Completed', c: 'var(--ok)',   n: mine.filter(t => t.status === 'done').length }
  ];

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px">
      ${tiles.map(x => `
        <button onclick="plSetTaskFilter('${x.k}')" style="display:block;width:100%;text-align:left;padding:9px 10px;border-radius:11px;cursor:pointer;border:1px solid ${tasksState.filter === x.k ? x.c : 'var(--line2)'};background:${tasksState.filter === x.k ? 'var(--sunk)' : 'transparent'}">
          <span style="display:flex;align-items:center;justify-content:space-between">
            <i style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:${x.c};color:#fff;font-size:10px;font-weight:800;font-style:normal">${x.g}</i>
            <span style="font-size:17px;font-weight:650;letter-spacing:-.02em;color:${tasksState.filter === x.k ? x.c : 'var(--tx)'}">${x.n}</span>
          </span>
          <span style="display:block;font-size:10.5px;font-weight:600;color:var(--tx2);margin-top:4px">${x.label}</span>
        </button>`).join('')}
    </div>`;
}

function plTaskRow(t) {
  const list = plLists().find(l => l.key === t.list);
  const done = t.status === 'done';
  const overdue = !done && t.dueDate && t.dueDate < plIso(plToday());
  const due = t.dueDate ? plFmtDate(new Date(t.dueDate + 'T00:00:00Z')) : 'No date';

  const box = done
    ? 'flex:none;width:20px;height:20px;border-radius:999px;border:1px solid var(--wine);background:var(--wine);color:#fff;font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer'
    : 'flex:none;width:20px;height:20px;border-radius:999px;border:1.5px solid var(--line);background:transparent;color:transparent;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer';

  return `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--line2)">
      <button onclick="plToggleTask('${plEsc(t.id)}')" style="${box}">${done ? '✓' : ''}</button>
      <span style="flex:1;min-width:0">
        <span style="display:flex;align-items:baseline">
          ${plIsUrgent(t) ? '<i style="flex:none;font-size:12px;font-weight:800;color:var(--bad);margin-right:4px;font-style:normal">‼</i>' : ''}
          <span style="display:block;font-size:13px;color:${done ? 'var(--tx3)' : 'var(--tx)'};${done ? 'text-decoration:line-through' : ''}">${plEsc(t.title)}</span>
        </span>
        <span style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:5px">
          <button onclick="plCycleTaskList('${plEsc(t.id)}')" style="display:flex;align-items:center;gap:5px;padding:1px 7px 1px 4px;border-radius:999px;border:1px solid var(--line2);background:transparent;color:var(--tx3);font-size:10px;font-weight:600;cursor:pointer">
            <i style="width:7px;height:7px;border-radius:99px;background:${list ? list.color : 'var(--tx3)'};display:block"></i>${list ? plEsc(list.name) : 'No list'}
          </button>
          <span style="font-size:10.5px;font-weight:600;color:${overdue ? 'var(--bad)' : 'var(--tx3)'}">${due}</span>
          <button onclick="plToggleUrgent('${plEsc(t.id)}')" title="Flag urgent" style="padding:2px 7px;border-radius:999px;border:1px solid ${plIsUrgent(t) ? 'var(--bad)' : 'var(--line2)'};background:transparent;color:${plIsUrgent(t) ? 'var(--bad)' : 'var(--tx3)'};font-size:10px;font-weight:700;cursor:pointer">‼</button>
          ${t.linkedType === 'job' && t.linkedId
            ? `<span style="padding:2px 7px;border-radius:999px;background:var(--wine-tint);color:var(--wine);font-size:10px;font-weight:700">${plEsc(t.linkedId)}</span>`
            : `<button onclick="plLinkTaskToJob('${plEsc(t.id)}')" style="padding:2px 7px;border-radius:999px;border:1px dashed var(--line);background:transparent;color:var(--tx3);font-size:10px;font-weight:600;cursor:pointer">＋ Link job</button>`}
        </span>
      </span>
    </div>`;
}

function plTaskLists(mine) {
  const open = mine.filter(t => t.status !== 'done');
  return `
    <div style="margin-top:13px;padding-top:11px;border-top:1px solid var(--line2)">
      <div style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--tx3);font-weight:700;margin-bottom:6px">My lists</div>
      ${plLists().map(l => `
        <button onclick="plSetTaskFilter('${plEsc(l.key)}')" style="display:flex;align-items:center;gap:9px;width:100%;padding:7px 8px;border:0;border-radius:9px;cursor:pointer;text-align:left;background:${tasksState.filter === l.key ? 'var(--wine-tint)' : 'transparent'}">
          <i style="flex:none;width:18px;height:18px;border-radius:999px;background:${l.color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-style:normal">≡</i>
          <span style="flex:1;min-width:0;font-size:12.5px;color:var(--tx)">${plEsc(l.name)}</span>
          <span style="flex:none;font-size:11.5px;color:var(--tx3);font-weight:600">${open.filter(t => t.list === l.key).length}</span>
          <span style="color:var(--tx3);font-size:12px">›</span>
        </button>`).join('')}
      <button onclick="plAddTaskList()" style="display:flex;align-items:center;gap:9px;width:100%;padding:7px 8px;border:0;border-radius:9px;cursor:pointer;text-align:left;background:transparent;color:var(--wine);font-size:12.5px;font-weight:600">＋ Add list</button>
    </div>`;
}

function plEmptyTasks() {
  return `<div style="padding:18px 0;text-align:center;font-size:11.5px;color:var(--tx3)">Nothing in this list.</div>`;
}

function plFilteredTasks(mine) {
  const f = tasksState.filter;
  return mine.filter(t => {
    const done = t.status === 'done';
    if (f === 'done') return done;
    if (done) return false;
    if (f === 'all') return true;
    if (f === 'today') return plIsToday(t);
    if (f === 'urgent') return plIsUrgent(t);
    return t.list === f;
  });
}

/* --- handlers ------------------------------------------------------------- */

function plToggleTasks() { tasksState.open = !tasksState.open; rerenderDashboard(); }
function plSetTaskFilter(k) { tasksState.filter = k; rerenderDashboard(); }

function plToggleTask(id) {
  const t = (typeof tasks !== 'undefined' ? tasks : []).find(x => x.id === id);
  if (!t) return;
  if (t.status === 'done') reopenTask(id); else completeTask(id);
  rerenderDashboard();
}

function plToggleUrgent(id) {
  const t = (typeof tasks !== 'undefined' ? tasks : []).find(x => x.id === id);
  if (!t) return;
  setTaskUrgent(id, !t.urgent);
  rerenderDashboard();
}

/* Tapping the list pill cycles to the next list — no dropdown for four
   options. Reconsider past ~6 lists. */
function plCycleTaskList(id) {
  const t = (typeof tasks !== 'undefined' ? tasks : []).find(x => x.id === id);
  if (!t) return;
  const L = plLists();
  if (!L.length) return;
  const i = L.findIndex(l => l.key === t.list);
  setTaskList(id, L[(i + 1) % L.length].key);
  rerenderDashboard();
}

/* The dashed "＋ Link job" affordance must stay — a task tied to a job card is
   the reason this widget is in the app rather than in someone's phone. */
function plLinkTaskToJob(id) {
  const jobs = (typeof jobCards !== 'undefined' ? jobCards : []).filter(j => j.status !== 'cancelled');
  if (!jobs.length) { if (typeof commsToast === 'function') commsToast('No open job cards to link to.'); return; }
  const pick = window.prompt('Link to which job?\n\n' +
    jobs.slice(0, 12).map(j => j.id + ' — ' + (j.projectName || '')).join('\n') +
    '\n\nType the Job No:');
  if (!pick || !pick.trim()) return;
  const res = linkTaskToJobCard(id, pick.trim());
  if (res && res.error) { if (typeof commsToast === 'function') commsToast(res.error); return; }
  rerenderDashboard();
}

function plAddTask() {
  const title = window.prompt('New task');
  if (!title || !title.trim()) return;
  // A task added while a list is selected joins that list; from a smart tile it
  // stays unlisted rather than being filed somewhere the user didn't choose.
  const L = plLists();
  const list = L.some(l => l.key === tasksState.filter) ? tasksState.filter : null;
  const res = createTask({
    title: title.trim(), assignee: plIdentity(), dueDate: plIso(plToday()), list
  });
  if (res && res.error) { if (typeof commsToast === 'function') commsToast(res.error); return; }
  tasksState.open = true;
  rerenderDashboard();
}

function plAddTaskList() {
  const name = window.prompt('Name the list');
  if (!name || !name.trim()) return;
  const res = createTaskList(plIdentity(), name.trim());
  if (res && res.error) { if (typeof commsToast === 'function') commsToast(res.error); return; }
  rerenderDashboard();
}

/* ---------------------------------------------------------------------------
   MOUNTING
   Both cards go in ONE wrapper div — the dashboard column flow is column-count,
   so without it, collapsing the planner reshuffles unrelated cards into the gap.
   ------------------------------------------------------------------------ */
// The wrapper takes the host dashboard's own full-width class, since it is not
// itself a card and would otherwise sit in a single grid column at phone width.
function renderPlannerAndTasks(wrapClass) {
  return '<div' + (wrapClass ? ' class="' + wrapClass + '"' : '') + '>' +
    renderWeekPlanner() + renderMyTasks() + '</div>';
}
