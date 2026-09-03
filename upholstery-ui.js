/* ==========================================================================
   upholstery-ui.js — 20a Upholstery supervisor: the interface
   ==========================================================================
   Traced from docs/design-handoffs/20a-upholstery.md (2 Sep 2026). One
   shell, three view modes off a single container — dashboard, twelve
   working pages from one template (two custom: Fabric & COM register,
   Crews & labour), ten create flows from one template, every one opening
   with a gate question that the primary button is dead until answered.
   Plus the fabric-plan builder with its nap and repeat arithmetic.

   The six non-negotiables are NOT drawn again here — the exec shell owns
   the back control, Quick actions, the collapsible rail, the planner, My
   tasks and the floating chat app-wide (same call 17a, 19a and 22 made);
   only the rail ORDER and the quick actions are applied.

   Structurally a sibling of production-ui.js (19a/22): same S store,
   same delegated data-a listeners, same repaint-only-what-changed rule.
   Where a control changes only part of the form, it repaints only that
   part — a full paint() throws away what is being typed.
   ========================================================================== */

const uphModuleWrap = document.createElement('div');
uphModuleWrap.id = 'uph-module-wrap', 'timer-module-wrap';
uphModuleWrap.className = 'xshell';
uphModuleWrap.style.cssText = 'display:none;';
document.body.appendChild(uphModuleWrap);

const UPH_OTHER_WRAPS = ['ops-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap',
  'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap',
  'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap',
  'painting-module-wrap', 'owner-module-wrap', 'admin-module-wrap', 'fleet-module-wrap',
  'delivery-sched-module-wrap', 'prd-module-wrap'];

/* The role whose name the data layer stamps. QC authority for `uph` lines
   is the Upholstery Manager (DEPT_QC_AUTHORITY), so passes go out under
   that name; everything else is signed by the supervisor. */
const UPH_USER = 'Upholstery Supervisor';
const UPH_QC_USER = 'Upholstery Manager';

function uphSafeTop(fn, fallback) { try { const v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }

function uphSubLine() {
  const k = uphSafeTop(() => getUphKPIs(), {});
  const bits = [];
  if (k.pricingInputOwed) bits.push(k.pricingInputOwed + (k.pricingInputOwed === 1 ? ' thing asked of you' : ' things asked of you'));
  if (k.waitingForStage) bits.push(k.waitingForStage + (k.waitingForStage === 1 ? ' suite with no stage' : ' suites with no stage'));
  if (k.deadOnTable) bits.push(k.deadOnTable + (k.deadOnTable === 1 ? ' dead ticket on the table' : ' dead tickets on the table'));
  return bits.length ? bits.join(' · ') : null;
}
function uphRefreshSubtitle() {
  const el = document.querySelector('#uph-module-wrap .xs-sub');
  if (!el) return;
  const d = new Date();
  const line = d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const rest = uphSubLine();
  const text = rest ? line + ' · ' + rest : line;
  el.textContent = text;
  const q = document.getElementById('uph-title-q');
  if (q) { q.title = text; const t = q.parentElement.querySelector('.uph-qtext'); if (t) t.textContent = text; }
}
function uphTitleBadge() {
  const title = uphModuleWrap.querySelector('.xs-title');
  if (!title || !window.UphUI || document.getElementById('uph-title-q')) return;
  title.parentElement.classList.add('xs-title-row');
  const holder = document.createElement('span');
  holder.className = 'uph-hrow';
  holder.innerHTML = UphUI.qBadge('Today', 'neutral');
  const q = holder.querySelector('.uph-q'); if (q) q.id = 'uph-title-q';
  title.insertAdjacentElement('afterend', holder);
  holder.addEventListener('click', function (e) {
    const c = e.target.closest('.uph-qchip'); if (!c) return;
    const t = holder.querySelector('.uph-qtext'); if (t) t.hidden = !t.hidden;
  });
}

/* The rail — the handoff's twelve pages in its order, with Dashboard above
   and Create… below, the same frame 22 settled on. Badges are real
   readers: an empty shop shows an empty rail. */
const UPH_RAIL = [
  ['board', '▦', 'Week board', () => getUphWaitingForStage().length, 'bad'],
  ['price', '∑', 'Pricing input', () => getUphInputRequests('pricing_input').filter(r => r.status === 'open').length, 'warn'],
  ['spec', '⊟', 'Upholstery spec', () => getUphInputRequests().filter(r => r.status === 'open' && (r.type === 'spec_revision' || r.type === 'fabric_change')).length, 'warn'],
  ['plan', '⌗', 'Fabric plans', () => fabricPlans.filter(p => p.status === 'live').length, 'wine'],
  ['foam', '▣', 'Foam schedules', () => foamSchedules.filter(f => !f.signedOff).length, 'warn'],
  ['fab', '▤', 'Fabric & COM register', () => getFabricRegisterRows().filter(r => r.st === 'bad').length, 'bad'],
  ['bay', '◧', 'Upholstery bays', () => uphStageSlots.filter(s => s.stageId === 'B' && s.provisional).length, 'plain'],
  ['fin', '◐', 'Finishing & QC', () => getDepartmentQueue('uph').filter(r => r.entry.status === 'qc').length, 'plain'],
  ['team', '☷', 'Crews & labour', () => getUphCrewless().length, 'bad'],
  ['ot', '◑', 'Overtime & recovery', () => uphOvertime.filter(o => o.status === 'booked').length, 'ok'],
  ['rem', '⏱', 'Reminders', () => getUphReminders().length, 'bad'],
  ['doc', '▨', 'Documents', () => 0, 'plain']
];
/* A granular login sees a slice of the rail, the way the joinery granular
   roles do — the manager's pages are structurally unreachable, not hidden. */
const UPH_SCOPES = {
  'team-leader': ['board', 'plan', 'foam', 'fab', 'team', 'rem'],
  'qc-packaging': ['fin', 'bay', 'doc', 'rem']
};
let uphScope = null;

function uphBuildShell() {
  const cnt = (fn) => uphSafeTop(fn, 0) || '';
  const allowed = uphScope ? UPH_SCOPES[uphScope] : null;
  const items = [];
  if (!allowed) items.push(nv('uph-dash', '⌂', 'Dashboard', "UphUI.go('dash','board')", cnt(() => getUphAskedToday().length)));
  // A granular role's rail is in ITS order — the page it lands on first.
  (allowed ? allowed.map(k => UPH_RAIL.find(r => r[0] === k)).filter(Boolean) : UPH_RAIL).forEach(r => {
    items.push(nv('uph-' + r[0], r[1], r[2], "UphUI.go('page','" + r[0] + "')", cnt(r[3])));
  });
  if (!allowed) items.push(nv('uph-create', '＋', 'Create…', "UphUI.go('form','price')"));
  uphModuleWrap.innerHTML = execShellHTML({
    title: 'Upholstery', sub: null,
    role: uphScope === 'team-leader' ? 'Upholstery Team Leader' : uphScope === 'qc-packaging' ? 'QC / Packaging Team' : 'Upholstery Supervisor',
    contentId: 'uph-body', closeFn: 'closeUphModule',
    navGroups: [{ label: 'Workspace', items }]
  });
}

function openUphModule(initialScope) {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => { m.style.display = 'none'; });
  UPH_OTHER_WRAPS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  uphScope = initialScope || null;
  uphModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  uphSafeTop(() => buildUphRoster(), null);
  uphBuildShell();
  execSetContext('upholstery', 'renderUphBody');
  uphTitleBadge();
  execThemeApply();
  UphUI.reset();
  if (uphScope) UphUI.go('page', UPH_SCOPES[uphScope][0]);
  renderUphBody();
  execMarkActive(uphScope ? 'uph-' + UPH_SCOPES[uphScope][0] : 'uph-dash');
  execRefreshBadges();
}
function closeUphModule() { closeModuleWrap(uphModuleWrap, 'launchUpholsteryModule'); }
// The three upholstery roles land here (Salman, 2 Sep 2026): the manager on
// the dashboard, the two granular roles on their slice of the rail.
function launchUpholsteryModule() { openUphModule(); }
function launchUpholsteryTeamLeaderModule() { openUphModule('team-leader'); }
function launchUpholsteryQCPackagingModule() { openUphModule('qc-packaging'); }
function renderUphBody() {
  const el = document.getElementById('uph-body');
  if (!el || typeof UphUI === 'undefined') return;
  UphUI.mount(el);
}

window.UphUI = (function () {
  'use strict';

  var root = null;
  var S = {
    view: 'dash', page: 'board', form: 'price',
    gate: null, pgChip: 0, off: 0,
    crewOpen: 'F',
    formJob: null, formRoll: null, formStage: null,
    planRows: null, foamRows: null
  };

  /* ── helpers ──────────────────────────────────────────────────────── */
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safe(fn, dflt) { try { var v = fn(); return v === undefined ? dflt : v; } catch (e) { return dflt; } }
  function bd(n) { return 'BD ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
  function m1(n) { return (Math.round((Number(n) || 0) * 10) / 10) + ' m'; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function ddmmm(iso) {
    var d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? '—' : String(d.getDate()).padStart(2, '0') + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
  }
  function ddmmmShort(iso) {
    var d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? '—' : String(d.getDate()).padStart(2, '0') + ' ' + MON[d.getMonth()];
  }
  function shortDay(iso) { var d = new Date(String(iso).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? '' : String(d.getDate()); }
  function todayLocal() { return safe(function () { return todayISO(); }, new Date().toISOString().slice(0, 10)); }
  function weekDates(off) {
    var t = new Date(todayLocal() + 'T00:00:00');
    t.setDate(t.getDate() - t.getDay() + (off || 0) * 7);
    var out = [];
    for (var i = 0; i < 7; i++) { var d = new Date(t); d.setDate(t.getDate() + i); out.push(safe(function () { return localISO(d); }, d.toISOString().slice(0, 10))); }
    return out;
  }
  var DL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function qBadge(text, tone) {
    if (!text) return '';
    var t = String(text).replace(/<[^>]+>/g, '');
    return '<span class="uph-q' + (tone === 'wine' ? ' q-wine' : tone === 'bad' ? ' q-bad' : '') + '" title="' + esc(t) + '">?</span>' +
      '<button type="button" class="uph-qchip" data-a="qchip">? What this page is for</button>' +
      '<span class="uph-qtext" hidden>' + esc(t) + '</span>';
  }
  function pill(st, text) { return '<span class="uph-pill t-' + st + '">' + esc(text) + '</span>'; }
  function jobRef(id) { return '<span class="uph-ref">' + esc(id || '—') + '</span>'; }
  function stageName(id) { var s = safe(function () { return uphStage(id); }, null); return s ? s.name : id; }
  function shortStage(id) { return stageName(id).replace(/^\d · /, ''); }
  function dueTone(due) { if (!due) return 'plain'; var t = todayLocal(); return due <= t ? 'bad' : 'warn'; }
  function dueLabel(due) { if (!due) return '—'; var t = todayLocal(); return due < t ? 'Overdue' : due === t ? 'Today' : ddmmmShort(due); }

  /* ── 1. Asked of you today ─────────────────────────────────────────── */
  var KIND_CLASS = { PRICING: 'k-wine', FABRIC: 'k-bad', COM: 'k-bad', MATERIAL: 'k-warn' };
  function askedHTML() {
    var rows = safe(function () { return getUphAskedToday(); }, []);
    var shown = rows.slice(0, 5);
    return '<section class="uph-card uph-asked">' +
      '<div class="uph-card-h"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="uph-hrow"><span class="uph-asked-t">Asked of you today</span>' +
      qBadge("Other people's deadlines. These come before the board, because somebody is waiting on the other end.", 'wine') + '</div>' +
      '</div><span class="uph-pill solid uph-count">' + rows.length + ' open</span></div>' +
      (shown.length ? shown.map(function (r) {
        var tone = dueTone(r.due);
        return '<div class="uph-ask' + (tone === 'bad' ? ' t-bad' : '') + '">' +
          '<span class="uph-kind ' + (KIND_CLASS[r.kind] || 'k-warn') + '">' + esc(r.kind) + '</span>' +
          '<span class="uph-ask-n"><span class="uph-ask-t">' + esc(r.title) + '</span>' +
          '<span class="uph-ask-f">' + esc(r.from || '—') + (r.ref ? ' · ' + esc(r.ref) : '') + '</span>' +
          '<span class="uph-need t-' + r.needTone + '">' + esc(r.need) + '</span></span>' +
          '<span class="uph-due t-' + tone + '">' + esc(r.due ? dueLabel(r.due) : 'Now') + '</span>' +
          '<button class="uph-btn-sm" data-a="flow" data-f="' + r.form + '" data-k="' + esc(r.key || '') + '">' + esc(r.action) + '</button></div>';
      }).join('') : '<div class="uph-empty">Nobody is waiting on you right now.</div>') +
      '</section>';
  }

  /* ── 2. The week board — five stages in one order ──────────────────── */
  function stageIdleThisWeek(st, days) {
    var busy = safe(function () { return uphStageSlots.some(function (s) { return s.stageId === st.id && days.indexOf(uphSlotDate(s)) !== -1; }); }, false);
    if (busy) return null;
    var w = safe(function () { return getUphWaitingForStage().find(function (x) { return x.stage.id === st.id; }); }, null);
    return w ? w.reason : null;
  }
  // The cell vocabulary — full · half · over · blocked · pull · ot · wknd · free.
  function cellFor(st, day, dayIdx, idleReason) {
    var slots = safe(function () { return uphStageSlots.filter(function (s) { return s.stageId === st.id && uphSlotDate(s) === day; }); }, []);
    var ot = safe(function () { return uphOvertime.filter(function (o) { return o.stageId === st.id && o.date === day && o.status === 'booked'; }); }, []);
    var otH = ot.reduce(function (a, o) { return a + o.hours; }, 0);
    var weekend = dayIdx === 5 || dayIdx === 6;
    var byJob = {};
    slots.forEach(function (s) { (byJob[s.jobCardId] = byJob[s.jobCardId] || []).push(s); });
    var jobs = Object.keys(byJob);
    if (jobs.length > 1) return { st: 'over', j: jobs.join(' + '), s: 'two jobs on one stage' };
    if (jobs.length === 1) {
      var g = byJob[jobs[0]], sl = g[0];
      var prev = safe(function () { return uphPrevStage(st.id); }, null);
      var isPull = g.some(function (s) { return s.kind === 'pull'; });
      var cst = isPull ? 'pull' : (g.some(function (s) { return s.portion !== 'half'; }) ? 'full' : 'half');
      var sub = otH ? '+' + otH + ' h OT'
        : isPull ? 'after ' + (prev ? shortStage(prev.id).toLowerCase() : 'upstream')
          : sl.provisional ? 'provisional' : cst === 'half' ? 'half day' : 'full day';
      return { st: cst, j: jobs[0], s: sub, title: DL[dayIdx] + ' — ' + jobs[0] + ' · ' + sub };
    }
    if (otH) return { st: 'ot', j: 'OT', s: otH + ' h shift', title: DL[dayIdx] + ' — OT ' + otH + ' h' };
    if (weekend) return { st: 'wknd', j: '—', s: '', title: DL[dayIdx] + ' — weekend' };
    if (idleReason) return { st: 'blocked', j: 'stopped', s: idleReason, title: DL[dayIdx] + ' — ' + idleReason };
    return { st: 'free', j: 'free', s: 'free', title: DL[dayIdx] + ' — nothing allotted' };
  }
  function boardHTML() {
    var days = weekDates(S.off), today = todayLocal();
    var waiting = safe(function () { return getUphWaitingForStage(); }, []);
    var stages = safe(function () { return UPH_STAGES; }, []);
    return '<section class="uph-card uph-board">' +
      '<div class="uph-card-h uph-card-h-lg"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="uph-hrow"><span class="uph-t">The week board</span>' +
      qBadge('Five stages in one order. Nothing overtakes — a stage cannot start before the one before it has an end date. Green Friday cells are overtime, booked against the target they recover.', 'neutral') + '</div>' +
      '</div><span class="uph-step"><button data-a="wk" data-v="-1" aria-label="Previous week">‹</button>' +
      '<button class="lbl" data-a="wk-today">This week</button>' +
      '<button data-a="wk" data-v="1" aria-label="Next week">›</button></span></div>' +
      '<div class="uph-board-scroll">' +
      '<div class="uph-days"><span class="spacer">STAGE</span>' +
      days.map(function (d, i) { return '<span class="d' + (d === today ? ' today' : '') + '">' + DL[i] + ' ' + shortDay(d) + '</span>'; }).join('') + '</div>' +
      stages.map(function (st) {
        var load = safe(function () { return uphStageLoad(st.id, days); }, 0);
        var lt = load > 5 ? 'bad' : load >= 3 ? 'ok' : 'warn';
        var tgt = safe(function () { return uphStageTarget(st.id); }, { date: null, tone: 'wine', label: 'No target date yet' });
        var otH = safe(function () { return uphOvertime.filter(function (o) { return o.stageId === st.id && o.status === 'booked' && days.indexOf(o.date) !== -1; }).reduce(function (a, o) { return a + o.hours; }, 0); }, 0);
        var idleReason = stageIdleThisWeek(st, days);
        return '<div class="uph-lane"><div class="uph-lane-l">' +
          '<div class="uph-lane-n">' + esc(st.name) + '</div>' +
          '<div class="uph-lane-cap">' + esc(st.capacity) + '</div>' +
          '<span class="uph-load uph-pill t-' + lt + '">' + load + ' of 5 days</span>' +
          '<span class="uph-tgt t-' + tgt.tone + '">' + (tgt.date ? 'Target ' + esc(ddmmmShort(tgt.date)) + ' · ' + esc(tgt.label) : esc(tgt.label)) + '</span>' +
          (otH ? '<span class="uph-ot uph-pill t-ok">OT ' + otH + ' h</span>'
            : idleReason ? '<span class="uph-ot uph-pill t-bad">OT would be idle</span>' : '') +
          '</div>' +
          days.map(function (d, i) {
            var cell = cellFor(st, d, i, idleReason);
            return '<button class="uph-cell c-' + cell.st + '" data-a="cell" data-st="' + st.id + '" data-d="' + esc(d) + '" title="' + esc(cell.title || '') + '">' +
              '<span class="j">' + esc(cell.j) + '</span>' + (cell.s ? '<span class="s">' + esc(cell.s) + '</span>' : '') + '</button>';
          }).join('') + '</div>';
      }).join('') + '</div>' +
      '<div class="uph-wait"><div class="uph-wait-h-row">' +
      '<span class="uph-wait-h">Waiting for a stage</span>' +
      '<span class="uph-wait-rule">' + (waiting.length ? waiting.length + ' suite' + (waiting.length === 1 ? '' : 's') + ' · none can be booked today' : 'Every suite has its next stage') + '</span></div>' +
      (waiting.length ? '<div class="uph-wait-row">' + waiting.slice(0, 3).map(function (w) {
        return '<button class="uph-wait-c t-' + w.tone + '" data-a="flow" data-f="' + w.form + '" data-k="' + esc(w.job.id) + '">' +
          '<span class="uph-wait-id">' + esc(w.job.id) + '</span>' +
          '<span class="uph-wait-t">' + esc(w.job.projectName || '') + '</span>' +
          '<span class="uph-wait-why">' + esc(w.reason) + '</span></button>';
      }).join('') + '</div>' : '<div class="uph-empty uph-empty-sm">Every suite on the floor can be booked.</div>') +
      '</div></section>';
  }

  /* ── 3. Paperwork the floor is waiting on ──────────────────────────── */
  function paperworkHTML() {
    var rows = safe(function () { return getUphPaperwork(); }, []);
    var bad = rows.filter(function (r) { return r.st === 'bad'; }).length;
    var warn = rows.filter(function (r) { return r.st === 'warn'; }).length;
    return '<section class="uph-card uph-paper">' +
      '<div class="uph-card-h uph-card-h-sm"><div class="uph-t-sm">Paperwork the floor is waiting on</div>' +
      '<span class="uph-note">' + (bad ? bad + ' to reissue' : 'nothing to reissue') + ', ' + warn + ' blocked</span></div>' +
      (rows.length ? rows.map(function (r) {
        return '<div class="uph-out' + (r.st === 'bad' ? ' t-bad' : '') + '">' +
          '<span class="uph-out-k">' + esc(r.k) + '</span>' +
          '<span class="uph-out-n"><span class="uph-out-t">' + esc(r.t) + '</span><span class="uph-out-s">' + esc(r.s) + '</span></span>' +
          pill(r.st, r.state) +
          '<button class="uph-btn-o sm" data-a="flow" data-f="' + r.form + '" data-k="' + esc(r.key || '') + '">' + esc(r.action) + '</button></div>';
      }).join('') : '<div class="uph-empty">No paperwork outstanding.</div>') +
      '</section>';
  }

  /* ── right column: Stages today · KPIs · planner + tasks ───────────── */
  function stagesHTML() {
    var days = weekDates(S.off);
    var rows = safe(function () { return getUphStagesToday(days); }, []);
    return '<section class="uph-card uph-teams">' +
      '<div class="uph-teams-h"><span class="uph-hrow"><span class="uph-t-sm">Stages today</span>' +
      qBadge('Five stages, where each one is and what it is on. Who stands at each stage is the labour dashboard\'s business.', 'neutral') + '</span>' +
      '<span class="uph-note">' + esc(DL[new Date(todayLocal() + 'T00:00:00').getDay()] + ' ' + ddmmmShort(todayLocal())) + '</span></div>' +
      '<div class="uph-teams-list">' + rows.map(function (r) {
        return '<button class="uph-team" data-a="page" data-p="team" data-k="' + r.stage.id + '">' +
          '<span class="uph-team-h"><span class="uph-team-n">' + esc(shortStage(r.stage.id)) + (r.men ? ' (' + r.men + ')' : '') + '</span>' +
          '<span class="uph-pill t-' + r.tone + '">' + esc(r.state) + '</span></span>' +
          '<span class="uph-team-on">' + esc(r.on) + '</span>' +
          '<span class="uph-track"><i style="width:' + r.pct + '%;background:var(--' + (r.tone === 'bad' ? 'bad' : r.tone === 'ok' ? 'ok' : 'warn') + ')"></i></span>' +
          '<span class="uph-team-f"><span class="uph-team-cap">' + esc(r.stage.capacity) + '</span>' +
          '<span class="uph-team-tgt t-' + r.target.tone + '">' + (r.target.date ? 'Target ' + esc(ddmmmShort(r.target.date)) : 'No target') + '</span></span>' +
          '</button>';
      }).join('') + '</div></section>';
  }
  function kpiHTML() {
    var k = safe(function () { return getUphKPIs(); }, {});
    var otWeek = safe(function () { return uphOvertimeHoursInWeek(weekDates(S.off)); }, 0);
    var rows = [
      ['Suites on the floor', 'across five stages', String(k.suitesOnFloor || 0), 'plain', 'board'],
      ['Waiting for a stage', 'spec, fabric or COM', String(k.waitingForStage || 0), 'bad', 'rem'],
      ['Pricing input owed', k.pricingDueToday ? k.pricingDueToday + ' due today' : 'none due today', String(k.pricingInputOwed || 0), 'warn', 'price'],
      ['Fabric plans live', k.deadOnTable ? k.deadOnTable + ' dead on the table' : 'none to reissue', String(k.fabricPlansLive || 0), 'plain', 'plan'],
      ['Overtime booked this week', 'all against a target', otWeek + ' h', 'ok', 'ot'],
      ['Metres saved by single lay', 'against cutting each panel alone', (k.metresSaved || 0) + ' m', 'ok', 'plan']
    ];
    return '<section class="uph-card uph-kpis">' + rows.map(function (r) {
      return '<button class="uph-kpi-r" data-a="page" data-p="' + r[4] + '">' +
        '<span class="uph-kpi-l"><b>' + esc(r[0]) + '</b><i>' + esc(r[1]) + '</i></span>' +
        '<span class="uph-kpi-v t-' + r[3] + '">' + esc(r[2]) + '</span></button>';
    }).join('') + '</section>';
  }
  function dashHTML() {
    var plannerTasks = typeof renderPlannerAndTasks === 'function' ? renderPlannerAndTasks('uph') : '';
    return '<div class="uph-dash">' +
      '<div class="uph-l">' + askedHTML() + boardHTML() + paperworkHTML() + '</div>' +
      '<div class="uph-r">' + stagesHTML() + kpiHTML() + plannerTasks + '</div></div>';
  }

  /* ═══ The create flows ═══════════════════════════════════════════════ */
  var FLOW_ORDER = ['price', 'spec', 'plan', 'foam', 'com', 'res', 'purch', 'quote', 'lab', 'allot'];
  var FLOW_TABS = { price: 'Pricing input', spec: 'Upholstery spec', plan: 'Fabric plan', foam: 'Foam schedule', com: 'COM sign-off',
    res: 'Reserve material', purch: 'Request purchase', quote: 'Ask for prices', lab: 'Crews & labour', allot: 'Allot a stage' };

  // The gate table — the enforcement layer. The blocked copy is the rule.
  var GATES = {
    price: { q: 'Which quote is this input for?', why: 'Metres per seat, foam grades and sewing hours go back against one quote. The estimator applies the rates — that is her half of it.',
      opts: [{ label: 'The quote on this request', tone: 'ok' }, { label: 'A quote already returned', tone: 'warn', note: 'It goes back as a correction, and says so.' }, { label: 'No reference yet', tone: 'bad', note: 'Nothing goes back without a quote to land on.' }] },
    spec: { q: 'Is this a standard spec or one job\'s change?', why: 'A spec is a standard, a plan is a job. You own the spec and can save it directly — operations is notified, not asked — which is exactly why a job change must never edit it.',
      opts: [{ label: 'Standard spec', tone: 'warn', note: 'You can save it, and it reprices every future quote.' }, { label: 'Job change', tone: 'ok' }, { label: 'Not decided', tone: 'bad', note: 'Decide which before anything changes.' }] },
    plan: { q: 'Is the fabric on site, inspected, and one dye lot?', why: 'Two lots covered onto the same sofa read as a fault for the life of the piece. The plan does not release unless every metre comes off a single roll.',
      opts: [{ label: 'One roll, one lot', tone: 'ok' }, { label: 'Two lots', tone: 'bad', note: 'Cannot release. Two lots on one suite is scrap.' }, { label: 'Not received', tone: 'bad', note: 'Nobody cuts. Receive and inspect it first.' }] },
    foam: { q: 'Is every grade on this schedule in stock or quoted?', why: 'Density is a spec, not a preference. Nobody at the bench substitutes a softer block because the right one is late.',
      opts: [{ label: 'All in stock', tone: 'ok' }, { label: 'Some quoted', tone: 'warn', note: 'It shows as blocked until the order lands.' }, { label: 'Nothing yet', tone: 'bad', note: 'Cannot sign off. Reserve, or take quotes.' }] },
    com: { q: 'What has the client agreed to?', why: 'We cannot buy the client\'s own weave. A shortfall is signed, the same day, or nobody cuts.',
      opts: [{ label: 'Sending more material', tone: 'ok' }, { label: 'Accepts a join', tone: 'warn', note: 'The join goes on the ticket and the client has signed for it.' }, { label: 'Nothing agreed', tone: 'bad', note: 'Nobody cuts. Nothing in this module can override it.' }] },
    res: { q: 'What is this for?', why: 'Reserve holds stock. Request purchase commits money. Ask for prices commits nothing.',
      opts: [{ label: 'A job card', tone: 'ok' }, { label: 'Bay stock', tone: 'warn', note: 'Held with no job — it shows as bay stock.' }, { label: 'Not chosen', tone: 'bad', note: 'Held against nothing is held against nobody.' }] },
    purch: { q: 'Has a supplier been picked?', why: 'A purchase request commits the company. Pick on the date first — nine days on foam costs a bay slot.',
      opts: [{ label: 'The fastest quote', tone: 'ok' }, { label: 'The cheaper, slower quote', tone: 'warn', note: 'Say in one line why the date can take it.' }, { label: 'Not picked', tone: 'bad', note: 'Ask for prices instead.' }] },
    quote: { q: 'What do you need to know?', why: 'Asking commits nothing. It is how a lead time gets chosen before an order exists.',
      opts: [{ label: 'Price and lead time', tone: 'ok' }, { label: 'Price only', tone: 'warn', note: 'A price with no date cannot be picked on.' }, { label: 'Not stated', tone: 'bad', note: 'Purchase cannot ask a supplier for nothing.' }] },
    lab: { q: 'Why is this man moving?', why: 'Work is allotted to a stage, never to a person. A man at the wrong stage is capacity the stage does not have.',
      opts: [{ label: 'Stage is idle', tone: 'ok' }, { label: 'Recovering a target', tone: 'warn', note: 'It shows as a temporary move.' }, { label: 'No reason given', tone: 'bad', note: 'A move with no reason hides the pattern that would fix it.' }] },
    allot: { q: 'Has the stage before this one finished?', why: 'Nothing overtakes. A stage cannot start before the one before it has an end date.',
      opts: [{ label: 'Yes, finished', tone: 'ok' }, { label: 'Curing, not signed off', tone: 'warn', note: 'The slot stays provisional until it is.' }, { label: 'Not started', tone: 'bad', note: 'Cannot book. Book the stage before it first.' }] }
  };
  var FLOW_META = {
    price: { title: 'Return pricing input', sub: 'Metres per seat, foam grades, sewing and bay hours against the estimator\'s request. What it is worth is not your half of this.', primary: 'Send back to the estimator',
      rule: 'You return metres, grades and hours, never a price. The estimator prices it — an answer carrying a rate is refused at the database, not just here.', banner: { tone: 'wine', text: 'No rate, no price, no margin on this form — those are hers.' } },
    spec: { title: 'Revise the upholstery spec', sub: 'The standing recipe for a type of piece, or one job\'s change. The two never edit the same record.', primary: 'Save the revision',
      rule: 'A spec is a standard, a plan is a job. Revising the standard reprices every future quote of that piece; a job change goes on the fabric plan and touches nothing else.' },
    plan: { title: 'Release a fabric plan', sub: 'Panel by panel, off one roll. This ticket is what the cutting table follows, so it is edited here and nowhere else.', primary: 'Release to the table',
      rule: 'One suite, one dye lot, one lay. The plan does not release unless the metres come off a single roll, and every panel of the suite is laid and cut together.', banner: { tone: 'bad', dyn: 'planKill' } },
    foam: { title: 'Build a foam schedule', sub: 'Density by part, from the spec. Stock and quotes are read live, so the schedule says whether the bench can be filled.', primary: 'Sign off the schedule',
      rule: 'Density is a spec, not a preference. Foam grade comes from the upholstery spec and only operations changes it.' },
    com: { title: 'Raise a COM shortfall note', sub: 'The client\'s own material landed short. The shortfall is theirs, in writing, the same day.', primary: 'Record the signed note',
      rule: 'COM shortfall is the client\'s risk, in writing, the same day. Until the note is signed the cutting table refuses the job — nothing in this module can override it.', banner: { tone: 'bad', dyn: 'comBlock' } },
    res: { title: 'Reserve material for a job', sub: 'Holds fabric or foam against the job card so nobody else can take it.', primary: 'Hold it against the job',
      rule: 'Stock on the shelf is not stock you have. Until it is held against this job card, another job can take it.', banner: { tone: 'wine', text: 'Reserve holds stock. Request purchase commits money. Ask for prices commits nothing.' } },
    purch: { title: 'Request a purchase', sub: 'Raises a real order against the job card. Purchase places it.', primary: 'Raise the request',
      rule: 'A purchase request commits the company. If you are still choosing, ask for prices instead — that commits nothing.', banner: { tone: 'warn', text: 'This commits. If you only want to know the price, use Ask for prices instead.' } },
    quote: { title: 'Ask Purchase for prices', sub: 'Comes back with supplier quotes and lead times so the date can be chosen. Nothing is ordered.', primary: 'Send the enquiry',
      rule: 'Lead time before price. Nine days on foam costs a bay slot and a target date; four days does not.', banner: { tone: 'plain', text: 'Nothing is committed by sending this. No order is raised.' } },
    lab: { title: 'Move a man', sub: 'Moves a man into a stage, or out of one. Wages, leave and rates are the labour dashboard\'s business.', primary: 'Move him',
      rule: 'Hours, never rates. You move men and return hours. What those hours cost belongs to labour and accounts — it is not shown here, and it is never shown to sales.', banner: { tone: 'wine', text: 'Hours go to the labour dashboard. No rate is entered or shown here.' } },
    allot: { title: 'Allot a stage', sub: 'Books a stage on a day for one suite. The stage after it pulls its date from this one.', primary: 'Book the stage',
      rule: 'Nothing overtakes. A bay slot cannot start before sewing ends, sewing cannot start before cutting ends, and cutting cannot start before the fabric is on site and inspected.', banner: { tone: 'warn', text: 'A stage whose predecessor has not signed off stays provisional until it does.' } }
  };

  /* ── fields ────────────────────────────────────────────────────────── */
  function fld(label, inner, hint, wide) {
    return '<div class="uph-f' + (wide ? ' wide' : '') + '"><label>' + esc(label) + '</label>' + inner +
      (hint ? '<span class="uph-f-h">' + esc(hint) + '</span>' : '') + '</div>';
  }
  function inp(id, ph, type, v) { return '<input class="uph-in" id="' + id + '" type="' + (type || 'text') + '" placeholder="' + esc(ph || '') + '"' + (v !== undefined ? ' value="' + esc(v) + '"' : '') + '>'; }
  function sel(id, opts, empty, cur) {
    return '<select class="uph-in" id="' + id + '"><option value="">' + esc(empty || 'Choose…') + '</option>' +
      opts.map(function (o) { return '<option value="' + esc(o.v) + '"' + (cur === o.v ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('') + '</select>';
  }
  function jobOpts() {
    return safe(function () { return getUphSuites().map(function (j) { return { v: j.id, l: j.id + ' — ' + (j.projectName || j.customerName || '') }; }); }, []);
  }
  function stageOpts() { return safe(function () { return UPH_STAGES.map(function (s) { return { v: s.id, l: s.name }; }); }, []); }
  function rollOpts(jobId, comOnly) {
    return safe(function () {
      return fabricRolls.filter(function (r) { return (!jobId || !r.jobCardId || r.jobCardId === jobId) && (!comOnly || r.isCOM); })
        .map(function (r) { return { v: r.id, l: r.id + ' — ' + r.name + ' · lot ' + r.dyeLot + ' · ' + rollMetresFree(r.id) + ' m free' + (r.isCOM ? ' · COM' : '') + (r.inspected ? '' : ' · not inspected') }; });
    }, []);
  }
  function itemOpts() {
    return safe(function () {
      return (typeof itemMaster !== 'undefined' ? itemMaster : []).filter(function (i) { return /foam|fibre|dacron|wadding|webbing|piping|zip|thread|calico|lining|fabric/i.test(i.name || ''); })
        .slice(0, 200).map(function (i) { return { v: i.id, l: i.name }; });
    }, []);
  }
  function flowFields(key) {
    var J = jobOpts();
    if (key === 'price') {
      var reqs = safe(function () { return getUphInputRequests('pricing_input').filter(function (r) { return r.status === 'open'; }).map(function (r) { return { v: r.id, l: r.id + ' — ' + r.question }; }); }, []);
      return fld('The request', sel('uph-req', reqs, 'Which request?'), 'Requests come from the estimator only.', true) +
        fld('Metres per seat', inp('uph-mps', '0', 'number'), 'Main fabric, one seat.') +
        fld('Foam grades', inp('uph-grades', '35kg HR seats · 28kg backs'), 'By part, from the spec.') +
        fld('Sewing hours', inp('uph-sew', '0', 'number'), 'Total, across the room.') +
        fld('Bay hours', inp('uph-bay', '0', 'number'), 'Total, both bays.') +
        fld('Note', inp('uph-note', 'Anything the estimator should know'), null, true) +
        priceLinesHTML();
    }
    if (key === 'spec') {
      var specs = safe(function () { return uphSpecs.map(function (s) { return { v: s.id, l: s.pieceType + ' · rev ' + s.rev }; }); }, []);
      var chg = safe(function () { return getUphInputRequests().filter(function (r) { return r.status === 'open' && (r.type === 'spec_revision' || r.type === 'fabric_change'); }).map(function (r) { return { v: r.id, l: r.id + ' — ' + r.question }; }); }, []);
      return fld('The request', sel('uph-req', chg, 'No request — revising on my own'), 'Fabric changes come from sales, spec revisions from operations.', true) +
        fld('Spec', sel('uph-spec', specs, 'Which piece type?'), 'The standing recipe.', true) +
        fld('Job card', sel('uph-job', J, 'Only for a job change'), 'A job change never edits the standard.', true) +
        fld('What changed', inp('uph-what', 'Nova 04 → Sahara 12 · seat depth 560 → 600'), null, true) +
        fld('Why', inp('uph-why', 'Client changed the fabric'), 'It travels with the revision.', true);
    }
    if (key === 'plan') {
      return fld('Job card', sel('uph-job', J, 'Which suite?', S.formJob), 'The ticket is this job\'s.', true) +
        fld('Roll', sel('uph-roll', rollOpts(S.formJob), 'Which roll?', S.formRoll), 'One roll, one dye lot — the plan will not release otherwise.', true) +
        fld('Bay', sel('uph-bay', [{ v: 'bay 1', l: 'bay 1' }, { v: 'bay 2', l: 'bay 2' }], 'Not yet in a bay'), 'Where the covers go after sewing.');
    }
    if (key === 'foam') {
      return fld('Job card', sel('uph-job', J, 'Which suite?', S.formJob), 'The grades below come from its spec.', true) +
        foamLinesHTML();
    }
    if (key === 'com') {
      return fld('Job card', sel('uph-job', J, 'Which suite?', S.formJob), null, true) +
        fld('Roll', sel('uph-roll', rollOpts(S.formJob, true), 'Which COM roll?', S.formRoll), 'Only the client\'s own material.', true) +
        fld('Metres short', inp('uph-short', '0', 'number'), 'Need minus landed.') +
        fld('Client signed by', inp('uph-client', 'Name'), 'The client\'s signature, the same day.') +
        fld('Sales countersigned by', inp('uph-sales', 'Name'), 'Sales countersigns.') +
        fld('Note', inp('uph-note', 'What the client chose, in their words'), null, true);
    }
    if (key === 'res') {
      return fld('Job card', sel('uph-job', J, 'Which suite?', S.formJob), 'Everything it needs that is free will be held.', true) +
        fld('Fabric roll', sel('uph-roll', rollOpts(S.formJob), 'The roll it is cut from', S.formRoll), 'Holds the metres the job needs.', true) +
        fld('Foam or fibre', sel('uph-item', itemOpts(), 'A stock item, optional'), 'Held across the store\'s bins.', true) +
        fld('Quantity', inp('uph-qty', '0', 'number'), 'Blocks, sheets or rolls.');
    }
    if (key === 'purch' || key === 'quote') {
      return fld('Item', sel('uph-item', itemOpts(), 'Which item?'), null, true) +
        fld('Quantity', inp('uph-qty', '0', 'number')) +
        fld('Needed by', inp('uph-by', '', 'date')) +
        (key === 'purch' ? fld('Job card', sel('uph-job', J, 'Which suite?', S.formJob), 'The order is raised against it.', true) : '') +
        fld('Note for Purchase', inp('uph-note', key === 'purch' ? 'Why the cheaper quote lost, in one line' : 'Anything that affects the lead time'), null, true) +
        (key === 'quote' ? quoteLinesHTML() : '');
    }
    if (key === 'lab') {
      var men = safe(function () { return uphStageMembers.map(function (m) { return { v: m.id, l: m.name + ' — ' + (m.trade || 'no trade') + (m.stageId ? ' · ' + shortStage(m.stageId) : ' · no stage') }; }); }, []);
      return fld('Who', sel('uph-man', men, 'Which man?'), null, true) +
        fld('Into which stage', sel('uph-stage', stageOpts(), 'Take him out of a stage', S.formStage), 'Leaving it blank takes him out of his stage.', true);
    }
    if (key === 'allot') {
      return fld('Stage', sel('uph-stage', stageOpts(), 'Which stage?', S.formStage)) +
        fld('Job card', sel('uph-job', J, 'Which suite?', S.formJob)) +
        fld('Day', inp('uph-date', '', 'date')) +
        fld('Portion', sel('uph-portion', [{ v: 'full', l: 'Full day' }, { v: 'half', l: 'Half day' }], 'Full day'));
    }
    return '';
  }
  // The pricing flow's lines table: five stages, crew and hours, and a Rate
  // column that is "—" on every row. That empty column is the point.
  function priceLinesHTML() {
    var stages = safe(function () { return UPH_STAGES; }, []);
    return '<div class="uph-lines"><div class="uph-lines-c"><span class="c-s">STAGE</span><span class="c-c">CREW</span><span class="c-h">HOURS</span><span class="c-r">RATE</span></div>' +
      stages.map(function (st, i) {
        return '<div class="uph-lines-r"><span class="c-s">' + esc(st.name) + '</span><span class="c-c">' + esc(st.capacity) + '</span>' +
          '<span class="c-h"><input class="uph-cin num" id="uph-lh-' + st.id + '" placeholder="0"></span><span class="c-r">—</span></div>';
      }).join('') +
      '<div class="uph-lines-f">Hours by stage. The Rate column is empty on every row — the estimator fills it, not you.</div></div>';
  }
  function quoteLinesHTML() {
    var rows = safe(function () { return getUphQuotesOnShortRows(); }, []);
    if (!rows.length) return '';
    return '<div class="uph-lines"><div class="uph-lines-c"><span class="c-s">SUPPLIER</span><span class="c-c">ITEM</span><span class="c-h">LEAD</span><span class="c-r">UNIT COST</span></div>' +
      rows.slice(0, 5).map(function (r) {
        return '<div class="uph-lines-r"><span class="c-s">' + esc(r.supplier) + '</span><span class="c-c">' + esc(r.item) + '</span>' +
          '<span class="c-h t-' + r.tone + '">' + esc(r.lead != null ? r.lead + ' days' : '—') + '</span><span class="c-r">' + (r.cost != null ? bd(r.cost) : '—') + '</span></div>';
      }).join('') + '<div class="uph-lines-f">Quotes already back. Cost per unit is visible; what we sell it for is not.</div></div>';
  }
  // Foam lines from the job's spec, each with the stock item it draws on.
  function foamLines() {
    if (!S.formJob) return null;
    if (S.foamRows) return S.foamRows;
    var spec = safe(function () { return uphSpecForJob(S.formJob); }, null);
    var pieces = safe(function () { return uphJobPieceCount(S.formJob); }, 1);
    S.foamRows = spec ? spec.foam.map(function (f) { return { part: f.part, grade: f.grade, itemId: '', qty: pieces }; }) : [];
    return S.foamRows;
  }
  function foamLinesHTML() {
    var rows = foamLines();
    if (!rows) return '<div class="uph-foam"><div class="uph-cut-e">Choose a job card and its grades appear here, from the spec.</div></div>';
    if (!rows.length) return '<div class="uph-foam"><div class="uph-cut-e">No spec released for this piece — the grades come from it. Operations still has it.</div></div>';
    var items = itemOpts();
    return '<div class="uph-foam"><div class="uph-cut-h"><div class="uph-cut-hn"><b>Density by part</b><i>' + rows.length + ' part' + (rows.length === 1 ? '' : 's') + ' · grades from the spec, not typed</i></div></div>' +
      '<div class="uph-cut-c"><span class="c-n">#</span><span class="c-p">PART</span><span class="c-m">GRADE</span><span class="c-q">QTY</span><span class="c-l">STOCK ITEM</span><span class="c-w">FREE</span></div>' +
      rows.map(function (r, i) {
        var free = r.itemId ? safe(function () { return uphItemFree(r.itemId); }, 0) : null;
        return '<div class="uph-cut-r"><span class="c-n">' + (i + 1) + '</span><span class="c-p"><b>' + esc(r.part) + '</b></span>' +
          '<span class="c-m">' + esc(r.grade) + '</span>' +
          '<span class="c-q"><button class="uph-stp" data-a="foam-q" data-i="' + i + '" data-v="-1">−</button><b>' + r.qty + '</b><button class="uph-stp" data-a="foam-q" data-i="' + i + '" data-v="1">＋</button></span>' +
          '<span class="c-l"><select class="uph-cin" data-a="foam-item" data-i="' + i + '"><option value="">not linked</option>' +
          items.map(function (o) { return '<option value="' + esc(o.v) + '"' + (r.itemId === o.v ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('') + '</select></span>' +
          '<span class="c-w t-' + (free === null ? 'plain' : free >= r.qty ? 'ok' : 'bad') + '">' + (free === null ? '—' : free) + '</span></div>';
      }).join('') + '</div>';
  }

  /* ── the fabric-plan builder — one suite, one lay ──────────────────── */
  function planRows() {
    if (S.planRows) return S.planRows;
    S.planRows = [];
    return S.planRows;
  }
  function planPullFromSpec() {
    var spec = safe(function () { return uphSpecForJob(S.formJob); }, null);
    if (!spec) return [];
    var pieces = safe(function () { return uphJobPieceCount(S.formJob); }, 1);
    return spec.panels.map(function (p) { return { panel: p.panel, fabric: p.fabric || 'main', qty: p.qty * pieces, length: p.length, width: p.width, nap: !!p.nap, note: p.note || '' }; });
  }
  function rollFreeM() {
    if (!S.formRoll) return null;
    return safe(function () { return rollMetresFree(S.formRoll); }, null);
  }
  function rollWidthMM() {
    var r = safe(function () { return fabricRolls.find(function (x) { return x.id === S.formRoll; }); }, null);
    return r ? r.widthCm * 10 : 1400;
  }
  function fabricClass(f) { return f === 'lining' ? 'plain' : f === 'com' ? 'warn' : 'wine'; }
  function planBuilderHTML() {
    var rows = planRows();
    var t = safe(function () { return fabricPlanTotals(rows, rollWidthMM()); }, { panelCount: 0, lines: 0, layM: 0, napRows: 0, napCount: 0, repeatM: 0, totalM: 0 });
    var pullN = S.formJob ? planPullFromSpec().length : 0;
    var free = rollFreeM();
    var roll = safe(function () { return fabricRolls.find(function (x) { return x.id === S.formRoll; }); }, null);
    var over = free !== null && t.totalM > free;
    var head = '<div class="uph-cut-h"><div class="uph-cut-hn"><b>Panels to cut</b>' +
      '<i>Laid on a ' + (roll ? roll.widthCm : 140) + 'cm roll · nap runs down on ' + t.napRows + ' line' + (t.napRows === 1 ? '' : 's') + ' · repeat 320mm</i></div>' +
      '<button class="uph-btn-w sm"' + (pullN ? '' : ' disabled') + ' data-a="plan-pull">' +
      (S.formJob ? (pullN ? 'Pull ' + pullN + ' panel' + (pullN === 1 ? '' : 's') + ' from the spec' : 'No spec for this piece') : 'Choose a job card first') + '</button>' +
      '<button class="uph-btn sm" data-a="plan-add">＋ Add a panel</button></div>';
    var cols = '<div class="uph-cut-c uph-plan-c"><span class="c-n">#</span><span class="c-p">PANEL</span><span class="c-m">FABRIC</span>' +
      '<span class="c-q">QTY</span><span class="c-l">LENGTH</span><span class="c-w">WIDTH</span><span class="c-pr">NAP</span><span class="c-x"></span></div>';
    var body = rows.length ? rows.map(function (r, i) {
      return '<div class="uph-cut-r uph-plan-r' + (r.nap ? ' napped' : '') + '">' +
        '<span class="c-n">' + (i + 1) + '</span>' +
        '<span class="c-p"><input class="uph-cin" data-a="plan-f" data-i="' + i + '" data-k="panel" value="' + esc(r.panel || '') + '"></span>' +
        '<span class="c-m"><select class="uph-cin t-' + fabricClass(r.fabric) + '" data-a="plan-f" data-i="' + i + '" data-k="fabric">' +
        [['main', roll ? roll.name : 'Main fabric'], ['lining', 'Calico lining'], ['com', 'COM']].map(function (o) { return '<option value="' + o[0] + '"' + (r.fabric === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></span>' +
        '<span class="c-q"><button class="uph-stp" data-a="plan-qty" data-i="' + i + '" data-v="-1">−</button><b>' + Math.max(1, Number(r.qty) || 1) + '</b><button class="uph-stp" data-a="plan-qty" data-i="' + i + '" data-v="1">＋</button></span>' +
        '<span class="c-l"><input class="uph-cin num" data-a="plan-f" data-i="' + i + '" data-k="length" value="' + esc(r.length || '') + '" placeholder="—"></span>' +
        '<span class="c-w"><input class="uph-cin num" data-a="plan-f" data-i="' + i + '" data-k="width" value="' + esc(r.width || '') + '" placeholder="—"></span>' +
        '<span class="c-pr"><button class="uph-prs uph-nap' + (r.nap ? ' on' : '') + '" data-a="plan-nap" data-i="' + i + '">' + (r.nap ? '↓ nap' : 'free') + '</button></span>' +
        '<span class="c-x"><button class="uph-cx" data-a="plan-del" data-i="' + i + '">✕</button></span></div>';
    }).join('') : '<div class="uph-cut-e">No panels yet. Pull them from the spec, then adjust — the ticket is what the table follows, so it is edited here and nowhere else.</div>';
    var cell = function (label, value, note, tone) {
      return '<div class="uph-cut-t' + (tone ? ' t-' + tone : '') + '"><span class="l">' + esc(label) + '</span><b>' + esc(String(value)) + '</b><span class="n">' + esc(note) + '</span></div>';
    };
    var totals = '<div class="uph-cut-f">' +
      cell('Panels', t.panelCount, t.lines + ' line' + (t.lines === 1 ? '' : 's')) +
      cell('Single lay', t.layM + ' m', 'on ' + (roll ? roll.widthCm : 140) + 'cm roll') +
      cell('Nap-matched', t.napCount, t.napRows + ' line' + (t.napRows === 1 ? '' : 's') + ' run ↓', 'wine') +
      cell('Repeat allowance', t.repeatM + ' m', '320mm per nap line', 'warn') +
      cell('Fabric to cut', t.totalM + ' m', free === null ? 'incl. 6% wastage' : (over ? 'more than the ' + free + ' m on ' + S.formRoll : 'incl. 6% wastage · ' + free + ' m on ' + S.formRoll), over ? 'bad' : null) +
      '</div>';
    return '<div class="uph-cut uph-plan">' + head + cols + body + totals + '</div>';
  }
  function repaintPlan() {
    var host = root.querySelector('.uph-plan');
    if (!host) return;
    var wrap = document.createElement('div'); wrap.innerHTML = planBuilderHTML();
    host.replaceWith(wrap.firstChild);
  }
  function repaintPlanTotals() {
    var host = root.querySelector('.uph-plan .uph-cut-f');
    if (!host) return;
    var wrap = document.createElement('div'); wrap.innerHTML = planBuilderHTML();
    var fresh = wrap.querySelector('.uph-cut-f'); if (fresh) host.replaceWith(fresh);
    var hn = root.querySelector('.uph-plan .uph-cut-hn'), hn2 = wrap.querySelector('.uph-cut-hn'); if (hn && hn2) hn.replaceWith(hn2);
  }
  function repaintFoam() {
    var host = root.querySelector('.uph-foam');
    if (!host) return;
    var wrap = document.createElement('div'); wrap.innerHTML = foamLinesHTML();
    host.replaceWith(wrap.firstChild);
  }

  /* ── the checks panel — "Before it can take a slot" ────────────────── */
  function flowChecks() {
    var jobId = S.formJob;
    var job = jobId && typeof getJobCard === 'function' ? getJobCard(jobId) : null;
    var mk = function (tone, label, detail) { return { tone: tone, label: label, detail: detail }; };
    if (!job) return [
      mk('wait', 'A job card', 'Choose one and these fill in.'),
      mk('wait', 'Fabric', 'One roll, one dye lot, inspected.'),
      mk('wait', 'COM', 'A shortfall stops the table until it is signed.'),
      mk('wait', 'Foam', 'Every grade in stock or quoted.')
    ];
    var spec = safe(function () { return uphSpecForJob(jobId); }, null);
    var rolls = safe(function () { return jobFabricRolls(jobId); }, []);
    var insp = rolls.filter(function (r) { return r.inspected; });
    var com = safe(function () { return comBlockReason(jobId); }, null);
    var fs = safe(function () { return jobFoamSchedule(jobId); }, null);
    var fstate = fs ? safe(function () { return foamScheduleState(fs); }, { st: 'warn', state: '' }) : null;
    return [
      mk(spec ? 'ok' : 'bad', spec ? 'Spec ' + spec.pieceType + ' rev ' + spec.rev : 'No spec released', spec ? (job.projectName || jobId) : 'Operations still has it'),
      mk(!rolls.length ? 'bad' : insp.length ? 'ok' : 'warn', !rolls.length ? 'No fabric on site' : insp.length ? 'Fabric inspected' : 'Fabric landed, not inspected',
        rolls.length ? rolls.map(function (r) { return r.id + ' lot ' + r.dyeLot; }).join(', ') : 'Receive and inspect a roll'),
      mk(com ? 'bad' : 'ok', com ? 'COM shortfall unsigned' : 'No COM shortfall', com || 'Nothing to sign'),
      mk(!fs ? 'warn' : fstate.st, !fs ? 'No foam schedule' : 'Foam ' + fstate.state.toLowerCase(), !fs ? 'Build one from the spec' : (fs.signedOff ? 'Signed off' : fstate.short + ' short · ' + fstate.quoted + ' quoted'))
    ];
  }
  function checksRowsHTML(checks) {
    return checks.map(function (c) {
      return '<div class="uph-chk"><span class="uph-chk-b t-' + c.tone + '">' + (TONE_ICON[c.tone] || '·') + '</span>' +
        '<span class="uph-chk-n"><b>' + esc(c.label) + '</b><i>' + esc(c.detail) + '</i></span></div>';
    }).join('');
  }

  /* ── the form ──────────────────────────────────────────────────────── */
  var TONE_ICON = { ok: '✓', warn: '!', bad: '✕' };
  function gateTone(key) {
    var g = GATES[key];
    if (!g || S.gate === null || S.gate === undefined) return null;
    var o = g.opts[S.gate]; return o ? o.tone : null;
  }
  function bannerFor(key, tone) {
    var g = GATES[key], m = FLOW_META[key];
    if (!tone) return { tone: 'wait', text: 'Answer the question above. Nothing is saved until you do.' };
    var o = g.opts[S.gate];
    if (tone === 'bad') return { tone: 'bad', text: 'This cannot be sent while the gate above is unanswered or blocked. ' + (o.note || '') };
    if (m.banner && m.banner.dyn === 'planKill') {
      var live = safe(function () { return jobLiveFabricPlan(S.formJob); }, null);
      if (live) return { tone: 'bad', text: 'Releasing this kills ' + live.id + '. The old lay comes off the table before the new one goes on.' };
      return { tone: tone, text: m.primary + '. Every metre comes off one roll, one dye lot, in a single lay.' };
    }
    if (m.banner && m.banner.dyn === 'comBlock') {
      return { tone: 'bad', text: 'Until this is signed the cutting table will not accept ' + (S.formJob || 'the job') + '. Nothing in this module can override it.' };
    }
    if (m.banner && m.banner.text) return { tone: tone === 'warn' ? 'warn' : m.banner.tone, text: m.banner.text + (tone === 'warn' && o.note ? ' ' + o.note : '') };
    if (tone === 'warn') return { tone: 'warn', text: (o.note || 'Allowed.') + ' ' + m.primary + ' will record it that way.' };
    return { tone: 'ok', text: m.primary + '. It will be recorded against the job card.' };
  }
  function formHTML() {
    var key = FLOW_ORDER.indexOf(S.form) !== -1 ? S.form : 'price';
    var g = GATES[key], m = FLOW_META[key];
    var tone = gateTone(key);
    var banner = bannerFor(key, tone);
    var dead = !tone || tone === 'bad';
    return '<div class="uph-dash uph-form"><div class="uph-l">' +
      '<div class="uph-tabs">' + FLOW_ORDER.map(function (k) {
        return '<button class="uph-tab-p' + (k === key ? ' on' : '') + '" data-a="flow" data-f="' + k + '">' + esc(FLOW_TABS[k]) + '</button>';
      }).join('') + '</div>' +
      '<div class="uph-page-h uph-hrow"><span class="uph-page-t">' + esc(m.title) + '</span>' + qBadge(m.sub, 'neutral') + '</div>' +
      gateHTML(key, g, tone) +
      '<section class="uph-card uph-fields"><div class="uph-fs">' + flowFields(key) + '</div>' +
      (key === 'plan' ? planBuilderHTML() : '') + '</section>' +
      '<div class="uph-banner t-' + banner.tone + '">' + esc(banner.text) + '</div>' +
      '<div class="uph-acts">' +
      '<button class="uph-btn' + (dead ? ' dead' : tone === 'warn' ? ' warn' : '') + '"' + (dead ? ' disabled' : '') + ' data-a="submit" data-f="' + key + '">' + esc(tone === 'bad' ? 'Blocked' : m.primary) + '</button>' +
      '<button class="uph-btn-g" data-a="draft">Save as draft</button>' +
      '<span class="uph-acts-h">' + esc(dead ? (tone === 'bad' ? 'Blocked by the answer above.' : 'Answer the question first.') : 'Nothing is written until you press this.') + '</span>' +
      '</div></div>' +
      '<div class="uph-r uph-rail"><section class="uph-rule"><div class="uph-rule-h">The rule on this page</div><div class="uph-rule-b">' + esc(m.rule) + '</div></section>' +
      '<section class="uph-card uph-ctx"><div class="uph-card-h uph-card-h-sm"><div class="uph-t-sm">Before it can take a slot</div></div>' +
      '<div id="uph-checks">' + checksRowsHTML(safe(flowChecks, [])) + '</div></section></div></div>';
  }
  function gateHTML(key, g, tone) {
    return '<section class="uph-gate' + (tone ? ' t-' + tone : '') + '">' +
      '<div class="uph-gate-h"><span class="uph-gate-b">' + (tone ? TONE_ICON[tone] : '?') + '</span>' +
      '<span class="uph-gate-n"><b>' + esc(g.q) + '</b><i>' + esc(g.why) + '</i></span></div>' +
      '<div class="uph-gate-o">' + g.opts.map(function (o, i) {
        return '<button class="uph-opt' + (S.gate === i ? ' on t-' + o.tone : '') + '" data-a="gate" data-i="' + i + '">' + esc(o.label) +
          (o.tone === 'bad' ? '<i>blocked</i>' : o.tone === 'warn' ? '<i>allowed, and it will show</i>' : '') + '</button>';
      }).join('') + '</div></section>';
  }
  // Answering the gate repaints the gate, the banner and the actions — NOT
  // the fields. A full paint() would throw away everything typed.
  function repaintGate() {
    var key = FLOW_ORDER.indexOf(S.form) !== -1 ? S.form : 'price';
    var g = GATES[key], m = FLOW_META[key];
    var tone = gateTone(key), banner = bannerFor(key, tone), dead = !tone || tone === 'bad';
    var wrap = document.createElement('div'); wrap.innerHTML = gateHTML(key, g, tone);
    var old = root.querySelector('.uph-gate'); if (old) old.replaceWith(wrap.firstChild);
    var b = root.querySelector('.uph-banner'); if (b) { b.className = 'uph-banner t-' + banner.tone; b.textContent = banner.text; }
    var acts = root.querySelector('.uph-acts');
    if (acts) {
      acts.innerHTML = '<button class="uph-btn' + (dead ? ' dead' : tone === 'warn' ? ' warn' : '') + '"' + (dead ? ' disabled' : '') + ' data-a="submit" data-f="' + key + '">' + esc(tone === 'bad' ? 'Blocked' : m.primary) + '</button>' +
        '<button class="uph-btn-g" data-a="draft">Save as draft</button>' +
        '<span class="uph-acts-h">' + esc(dead ? (tone === 'bad' ? 'Blocked by the answer above.' : 'Answer the question first.') : 'Nothing is written until you press this.') + '</span>';
    }
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function num(id) { return Number(val(id)) || 0; }

  function submitFlow(key) {
    var r;
    var byUser = UPH_USER;
    if (key === 'price') {
      var payload = { metresPerSeat: num('uph-mps'), foamGrades: val('uph-grades'), sewingHours: num('uph-sew'), bayHours: num('uph-bay'), note: val('uph-note') };
      var hrs = safe(function () { return UPH_STAGES.reduce(function (a, st) { return a + (Number(val('uph-lh-' + st.id)) || 0); }, 0); }, 0);
      if (hrs) payload.manHours = hrs;
      if (gateTone(key) === 'warn') payload.isEstimate = true;
      Object.keys(payload).forEach(function (k) { if (payload[k] === 0 || payload[k] === '' || payload[k] === null) delete payload[k]; });
      r = safe(function () { return uphAnswerPricing(val('uph-req'), payload, byUser); }, { error: 'Could not send it.' });
    } else if (key === 'spec') {
      if (gateTone(key) === 'warn') {
        r = safe(function () { return reviseUphSpec(val('uph-spec'), {}, byUser, (val('uph-what') ? val('uph-what') + ' — ' : '') + val('uph-why')); }, { error: 'Could not revise it.' });
      } else {
        // A job change never touches the standard: it is logged against the
        // job, and the request that raised it is answered.
        var jid = val('uph-job');
        if (!jid) r = { error: 'A job change needs a job card.' };
        else {
          safe(function () { logActivity({ type: 'uph-job-change', linkedType: 'job', linkedId: jid, user: byUser, message: (val('uph-what') || 'Job change') + (val('uph-why') ? ' — ' + val('uph-why') : ''), dept: 'uph' }); }, null);
          r = { ok: 'Job change recorded' };
        }
      }
      if (!(r && r.error) && val('uph-req')) safe(function () { return answerInputRequest(val('uph-req'), { note: val('uph-what') || 'Accepted and reissued' }, byUser); }, null);
    } else if (key === 'plan') {
      r = safe(function () {
        var res = releaseFabricPlan({ jobCardId: val('uph-job'), rollId: val('uph-roll'), panels: planRows(), byWhom: byUser });
        if (res && !res.error && val('uph-bay')) res.bay = val('uph-bay');
        return res;
      }, { error: 'Could not release it.' });
    } else if (key === 'foam') {
      r = safe(function () {
        var rows = foamLines() || [];
        var fs = createFoamSchedule({ jobCardId: val('uph-job'), lines: rows, byWhom: byUser });
        if (fs && fs.error) return fs;
        if (gateTone('foam') === 'ok') { var so = signOffFoamSchedule(fs.id, byUser); if (so && so.error) return { fs: fs, warning: so.error }; }
        return fs;
      }, { error: 'Could not build it.' });
    } else if (key === 'com') {
      r = safe(function () {
        var n = raiseCOMShortfallNote({ jobCardId: val('uph-job'), rollId: val('uph-roll'), shortfallM: num('uph-short'), byWhom: byUser });
        if (n && n.error) return n;
        var opt = gateTone('com') === 'ok' ? 'more' : 'join';
        var s = signCOMNote(n.id, { option: opt, clientSignedBy: val('uph-client') });
        if (s && s.error) return s;
        var c = countersignCOMNote(n.id, val('uph-sales'));
        if (c && c.error) return c;
        return n;
      }, { error: 'Could not record it.' });
    } else if (key === 'res') {
      r = safe(function () {
        var out = [];
        var jid = gateTone('res') === 'warn' ? null : val('uph-job');
        if (val('uph-roll')) {
          var need = jid ? jobFabricNeed(jid) : null;
          var m = Math.min(rollMetresFree(val('uph-roll')), need || rollMetresFree(val('uph-roll')));
          var h = holdFabricForJob({ rollId: val('uph-roll'), jobCardId: jid || 'BAY-STOCK', metres: m, byWhom: byUser });
          if (h && h.error) return h; out.push(h);
        }
        if (val('uph-item') && num('uph-qty') && typeof reserveStockForJob === 'function') {
          var left = num('uph-qty');
          var bins = (typeof stockLots === 'undefined' ? [] : stockLots).filter(function (l) { return l.itemId === val('uph-item'); });
          for (var i = 0; i < bins.length && left > 0; i++) {
            var f = stockFree(val('uph-item'), bins[i].binId); if (!f) continue;
            var q = Math.min(f, left);
            var rr = reserveStockForJob({ itemId: val('uph-item'), binId: bins[i].binId, qty: q, jobCardId: jid || 'BAY-STOCK', heldBy: byUser });
            if (rr && rr.error) return rr; out.push(rr); left -= q;
          }
          if (left > 0) return { error: left + ' short — nothing more free on the shelf. Request purchase, or ask for prices.' };
        }
        return out.length ? { ok: out.length + ' held' } : { error: 'Nothing free to hold. Ask for prices, or raise a purchase.' };
      }, { error: 'Could not hold it.' });
    } else if (key === 'purch') {
      r = safe(function () { return createPurchaseRequestFromShortfall([val('uph-item')], byUser, 'uph', null); }, { error: 'Could not raise it.' });
    } else if (key === 'quote') {
      r = safe(function () { return createRFQ({ items: [{ itemId: val('uph-item'), qty: num('uph-qty') }], supplierIds: [], raisedBy: byUser, note: val('uph-note') }); }, { error: 'Could not send the enquiry.' });
    } else if (key === 'lab') {
      r = safe(function () { return moveUphMan(val('uph-man'), val('uph-stage'), byUser, false); }, { error: 'Could not move him.' });
    } else if (key === 'allot') {
      r = safe(function () {
        return allotUphStageSlot({ stageId: val('uph-stage'), jobCardId: val('uph-job'), date: val('uph-date'), portion: val('uph-portion') || 'full', byWhom: byUser, provisional: gateTone('allot') === 'warn' });
      }, { error: 'Could not book it.' });
      if (r && r.slot) r = r.slot;
    }
    if (typeof commsToast === 'function') commsToast(r && r.error ? r.error : (r && r.warning ? r.warning : FLOW_META[key].primary + ' — done.'));
    if (!(r && r.error)) { S.gate = null; S.view = 'dash'; S.planRows = null; S.foamRows = null; }
    paint();
  }

  /* ═══ The twelve pages ═══════════════════════════════════════════════ */
  var PAGE_TITLES = { board: 'Week board', price: 'Pricing input', spec: 'Upholstery spec', plan: 'Fabric plans', foam: 'Foam schedules',
    fab: 'Fabric & COM register', bay: 'Upholstery bays', fin: 'Finishing & QC', team: 'Crews & labour', ot: 'Overtime & recovery', rem: 'Reminders', doc: 'Documents' };
  function statsStrip(cells) {
    return '<div class="uph-stats">' + cells.map(function (c) {
      return '<div class="uph-stat"><div class="uph-stat-v' + (c.st ? ' t-' + c.st : '') + '">' + esc(String(c.v)) + '</div><div class="uph-stat-l">' + esc(c.l) + '</div></div>';
    }).join('') + '</div>';
  }
  function chipRow(chips, secondary, primary) {
    return '<div class="uph-chips">' + chips.map(function (c, i) {
      return '<button class="uph-chip' + (S.pgChip === i ? ' on' : '') + '" data-a="chip" data-i="' + i + '">' + esc(c.label) + (c.n !== undefined ? ' <i>' + c.n + '</i>' : '') + '</button>';
    }).join('') + '<span class="uph-chips-sp"></span>' +
      (secondary ? '<button class="uph-btn-o" data-a="' + (secondary.a || 'flow') + '" data-f="' + (secondary.form || '') + '">' + esc(secondary.label) + '</button>' : '') +
      (primary ? '<button class="uph-btn" data-a="flow" data-f="' + primary.form + '">' + esc(primary.label) + '</button>' : '') + '</div>';
  }
  function ruleCard(title, text) {
    return '<section class="uph-rule"><div class="uph-rule-h">' + esc(title || 'The rule on this page') + '</div><div class="uph-rule-b">' + esc(text) + '</div></section>';
  }
  function contextCard(title, rows, note) {
    return '<section class="uph-card uph-ctx"><div class="uph-card-h uph-card-h-sm"><div class="uph-t-sm">' + esc(title) + '</div></div>' +
      (rows.length ? rows.map(function (r) { return '<div class="uph-ctx-r"><span class="uph-ctx-l">' + esc(r.l) + '</span><span class="uph-ctx-v' + (r.st ? ' t-' + r.st : '') + '">' + esc(String(r.v)) + '</span></div>'; }).join('')
        : '<div class="uph-empty uph-empty-sm">Nothing to show yet.</div>') +
      (note ? '<div class="uph-ctx-n">' + esc(note) + '</div>' : '') + '</section>';
  }
  function pageTable(cols, rows, empty) {
    if (!rows.length) return '<div class="uph-empty">' + esc(empty) + '</div>';
    return '<div class="uph-tbl-scroll"><table class="uph-tbl"><thead><tr>' +
      cols.map(function (c) { return '<th' + (c.w ? ' style="width:' + c.w + '"' : '') + (c.right ? ' class="r"' : '') + '>' + esc(c.h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr' + (r.st === 'bad' ? ' class="t-bad"' : '') + '>' + cols.map(function (c) { return '<td' + (c.right ? ' class="r"' : '') + '>' + c.cell(r) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function dim(t) { return '<span class="uph-dim">' + esc(t) + '</span>'; }

  function pageBoard() {
    var rows = safe(function () { return getUphBoardRows(); }, []);
    var days = weekDates(S.off);
    var booked = safe(function () { return UPH_STAGES.reduce(function (a, st) { return a + uphStageLoad(st.id, days); }, 0); }, 0);
    var blocked = safe(function () { return UPH_STAGES.reduce(function (a, st) { return a + (stageIdleThisWeek(st, days) ? 5 : 0); }, 0); }, 0);
    var ot = safe(function () { return uphOvertimeHoursInWeek(days); }, 0);
    var pulls = rows.filter(function (r) { return /pull/i.test(r.reason) || /Waiting/.test(r.state); });
    var shown = S.pgChip === 1 ? rows.filter(function (r) { return r.st === 'bad'; }) : S.pgChip === 2 ? rows.filter(function (r) { return safe(function () { return uphOvertime.some(function (o) { return o.recoversTarget === r.id && o.status === 'booked'; }); }, false); }) : S.pgChip === 3 ? pulls : rows;
    return {
      sub: 'Nothing overtakes. A stage can only be booked once the stage before it has an end date, so a late roll of fabric moves everything after it instead of quietly going wrong.',
      stats: [{ v: 5, l: 'Stages' }, { v: booked + ' of 25', l: 'Days booked' }, { v: blocked, l: 'Blocked cells', st: blocked ? 'bad' : 'ok' }, { v: ot + ' h', l: 'Overtime', st: 'ok' }],
      chips: [{ label: 'All stages', n: rows.length }, { label: 'Blocked', n: rows.filter(function (r) { return r.st === 'bad'; }).length }, { label: 'Overtime' }, { label: 'Pulls from another stage', n: pulls.length }],
      secondary: { label: 'Print the week', a: 'print-week' }, primary: { label: 'Allot work', form: 'allot' },
      rows: shown,
      cols: [
        { h: 'SUITE', cell: function (r) { return '<b>' + esc(r.name) + '</b>' + (r.tags.length ? ' ' + r.tags.map(function (t) { return pill(t === 'COM' ? 'bad' : 'warn', t); }).join(' ') : '') + '<span class="uph-td-s">' + esc(r.sub) + '</span>'; } },
        { h: 'STAGE NOW', w: '150px', cell: function (r) { return esc(r.stageNow); } },
        { h: 'TARGET OUT', w: '120px', cell: function (r) { return r.target ? '<b>' + esc(ddmmmShort(r.target)) + '</b>' : dim('— not set'); } },
        { h: '', w: '110px', right: true, cell: function (r) { return pill(r.st, r.state); } }
      ],
      empty: 'No suites on the floor.',
      ruleT: 'Nothing overtakes', rule: 'A bay slot cannot start before sewing ends, sewing cannot start before cutting ends, and cutting cannot start before the fabric is on site and inspected. The board enforces the order rather than trusting the dates.',
      ctx: ['Refused a stage, and why', rows.filter(function (r) { return r.reason; }).map(function (r) { return { l: r.id, v: r.reason, st: r.st }; }), null]
    };
  }
  function pagePrice() {
    var rows = safe(function () { return getUphInputRequests('pricing_input'); }, []);
    var open = rows.filter(function (r) { return r.status === 'open'; });
    var due = open.filter(function (r) { return r.neededBy && r.neededBy <= todayLocal(); });
    return {
      sub: 'Requests arrive from the estimator and from nowhere else. There is no new-request button here — the button returns input.',
      stats: [{ v: rows.length, l: 'Requests' }, { v: open.length, l: 'Open', st: open.length ? 'warn' : 'ok' }, { v: due.length, l: 'Due today or past', st: due.length ? 'bad' : 'ok' }, { v: rows.length - open.length, l: 'Answered' }],
      chips: [{ label: 'Open', n: open.length }, { label: 'All', n: rows.length }], primary: { label: 'Return input', form: 'price' },
      rows: S.pgChip === 1 ? rows : open,
      cols: [
        { h: 'WHAT IS ASKED', cell: function (r) { return '<b>' + esc(r.question) + '</b><span class="uph-td-s">' + esc(r.raisedBy || '') + (r.jobCardId ? ' · ' + esc(r.jobCardId) : '') + '</span>'; } },
        { h: 'REF', w: '110px', cell: function (r) { return jobRef(r.id); } },
        { h: 'NEEDED BY', w: '110px', cell: function (r) { return r.neededBy ? esc(ddmmmShort(r.neededBy)) : dim('no date'); } },
        { h: '', w: '110px', right: true, cell: function (r) { return pill(r.status === 'open' ? 'warn' : 'ok', r.status === 'open' ? 'Open' : 'Answered'); } }
      ],
      empty: 'The estimator is not waiting on anything.',
      ruleT: 'Metres, grades and hours', rule: 'Requests come from the estimator only. You return metres per seat, foam grades, sewing hours and bay hours; the estimator turns them into money.',
      ctx: ['What you may return', [{ l: 'Metres per seat', v: 'yes', st: 'ok' }, { l: 'Foam grades', v: 'yes', st: 'ok' }, { l: 'Sewing and bay hours', v: 'yes', st: 'ok' }, { l: 'A rate or a price', v: 'never', st: 'bad' }], 'You do not send a price. The estimator prices it.']
    };
  }
  function pageSpec() {
    var rows = safe(function () { return getUphSpecRows(); }, []);
    var chg = safe(function () { return getUphInputRequests().filter(function (r) { return r.status === 'open' && (r.type === 'spec_revision' || r.type === 'fabric_change'); }); }, []);
    return {
      sub: 'Standards by piece type — what a 3-seater takes. He owns the spec and edits it directly; operations is notified on save, not asked.',
      stats: [{ v: rows.length, l: 'Specs' }, { v: chg.length, l: 'Changes asked', st: chg.length ? 'warn' : 'ok' }, { v: rows.reduce(function (a, r) { return a + r.revisions; }, 0), l: 'Revisions' }, { v: rows.reduce(function (a, r) { return a + r.panels; }, 0), l: 'Panels defined' }],
      chips: [{ label: 'All', n: rows.length }], primary: { label: 'Revise a spec', form: 'spec' },
      rows: rows,
      cols: [
        { h: 'PIECE', cell: function (r) { return '<b>' + esc(r.pieceType) + '</b><span class="uph-td-s">' + r.panels + ' panels · ' + r.foam + ' foam parts · ' + r.metresPerPiece + ' m per piece</span>'; } },
        { h: 'HOURS', w: '120px', cell: function (r) { return esc(r.sewingHours + ' sew · ' + r.bayHours + ' bay'); } },
        { h: 'UPDATED', w: '110px', cell: function (r) { return esc(ddmmmShort(r.updatedOn)); } },
        { h: '', w: '90px', right: true, cell: function (r) { return pill('ok', r.state); } }
      ],
      empty: 'No specs yet.',
      ruleT: 'A spec is a standard, a plan is a job', rule: 'The spec is the standing recipe for a type of piece. A job-specific change must never edit it, or every future quote inherits one client\'s taste.',
      ctx: ['Changes asked of you', chg.map(function (r) { return { l: r.id, v: r.question, st: 'warn' }; }), null]
    };
  }
  function pagePlan() {
    var rows = safe(function () { return getUphPlanRows(); }, []);
    var live = rows.filter(function (r) { return r.status === 'live'; }), dead = rows.filter(function (r) { return r.st === 'bad'; });
    return {
      sub: 'Live tickets, and which are superseded. A dead ticket stays here until somebody confirms it off the table — not when the new one is issued.',
      stats: [{ v: rows.length, l: 'Tickets' }, { v: live.length, l: 'Live', st: 'ok' }, { v: dead.length, l: 'Dead, still on the table', st: dead.length ? 'bad' : 'ok' }, { v: rows.reduce(function (a, r) { return a + r.totalM; }, 0).toFixed(1) + ' m', l: 'Fabric on tickets' }],
      chips: [{ label: 'All', n: rows.length }, { label: 'Live', n: live.length }, { label: 'Dead', n: dead.length }], primary: { label: 'Release a plan', form: 'plan' },
      rows: S.pgChip === 1 ? live : S.pgChip === 2 ? dead : rows,
      cols: [
        { h: 'TICKET', cell: function (r) { return '<b>' + esc(r.id) + '</b><span class="uph-td-s">' + esc(r.jobCardId + ' · ' + r.fabric + ' · lot ' + r.dyeLot + ' · spec rev ' + r.specRev) + '</span>'; } },
        { h: 'FABRIC', w: '100px', cell: function (r) { return esc(r.totalM + ' m'); } },
        { h: 'PANELS', w: '80px', cell: function (r) { return esc(String(r.panels)); } },
        { h: '', w: '250px', right: true, cell: function (r) {
          return pill(r.st, r.state) + ' <button class="uph-btn-o sm" data-a="print-ticket" data-s="' + esc(r.id) + '">Print</button>' +
            (r.onTable && r.status === 'superseded' ? ' <button class="uph-btn sm" data-a="off-table" data-s="' + esc(r.id) + '">Off the table</button>'
              : r.status === 'live' && !r.onTable ? ' <button class="uph-btn-o sm" data-a="on-table" data-s="' + esc(r.id) + '">On the table</button>' : '');
        } }
      ],
      empty: 'No fabric plans yet.',
      ruleT: 'One suite, one dye lot', rule: 'A ticket is cut from one roll in one lay. Releasing a new ticket kills the old one, and the old lay comes off the table before the new one goes on.',
      ctx: ['Dead, still on the table', dead.map(function (r) { return { l: r.id, v: r.jobCardId, st: 'bad' }; }), null]
    };
  }
  function pageFoam() {
    var rows = safe(function () { return getUphFoamRows(); }, []);
    var blocked = rows.filter(function (r) { return r.st === 'bad'; });
    return {
      sub: 'Density by part, from the spec. A schedule reads blocked when a grade is short with nothing quoted — nobody substitutes a softer block.',
      stats: [{ v: rows.length, l: 'Schedules' }, { v: blocked.length, l: 'Blocked', st: blocked.length ? 'bad' : 'ok' }, { v: rows.filter(function (r) { return r.st === 'warn'; }).length, l: 'Quoted, not landed', st: 'warn' }, { v: rows.filter(function (r) { return r.signedOff; }).length, l: 'Signed off', st: 'ok' }],
      chips: [{ label: 'All', n: rows.length }, { label: 'Blocked', n: blocked.length }], primary: { label: 'Build a schedule', form: 'foam' },
      rows: S.pgChip === 1 ? blocked : rows,
      cols: [
        { h: 'SCHEDULE', cell: function (r) { return '<b>' + esc(r.id + ' — ' + r.jobCardId) + '</b><span class="uph-td-s">' + esc(r.lines.map(function (l) { return l.qty + ' ' + l.part + ' · ' + l.grade; }).join(' · ')) + '</span>'; } },
        { h: 'BLOCKS', w: '80px', cell: function (r) { return esc(String(r.blocks)); } },
        { h: 'SHORT', w: '90px', cell: function (r) { return r.short ? '<span class="t-bad">' + r.short + '</span>' : dim('none'); } },
        { h: '', w: '110px', right: true, cell: function (r) { return pill(r.st, r.state); } }
      ],
      empty: 'No foam schedules yet.',
      ruleT: 'Density is a spec', rule: 'Foam grade comes from the upholstery spec and only operations changes it. Nobody at the bench substitutes a softer block because the right one is late.',
      ctx: ['Blocked, and why', blocked.map(function (r) { return { l: r.id, v: r.short + ' short', st: 'bad' }; }), null]
    };
  }
  // Fabric & COM register — the custom layout.
  function pageFab() {
    var rows = safe(function () { return getFabricRegisterRows(); }, []);
    var short = rows.filter(function (r) { return r.st === 'bad'; }), held = rows.filter(function (r) { return r.reserve === 'done'; }), com = rows.filter(function (r) { return r.isCOM; });
    var shown = S.pgChip === 1 ? short : S.pgChip === 2 ? held : S.pgChip === 3 ? com : rows;
    var body = shown.length ? shown.map(function (r) {
      var resBtn = r.reserve === 'done' ? '<span class="uph-mat-res done">Reserved</span>'
        : r.reserve === 'release' ? '<button class="uph-mat-res can" data-a="release-hold" data-r="' + esc(r.roll.id) + '">' + esc(r.reserveLabel) + '</button>'
          : r.reserve === 'some' ? '<button class="uph-mat-res can" data-a="reserve-roll" data-r="' + esc(r.roll.id) + '" data-j="' + esc(r.jobCardId || '') + '">' + esc(r.reserveLabel) + '</button>'
            : '<span class="uph-mat-res none" title="Nothing free to reserve">' + esc(r.reserveLabel) + '</span>';
      return '<div class="uph-mat' + (r.st === 'bad' ? ' t-bad' : '') + '">' +
        '<div class="uph-mat-n"><div class="uph-mat-t">' + esc(r.name) + '<span class="uph-mat-j">' + esc(r.jobCardId || 'Bay stock') + '</span></div>' +
        '<div class="uph-mat-d">' + esc(r.detail) + (r.roll.costPerM ? ' · ' + bd(r.roll.costPerM) + '/m' : '') + '</div>' +
        '<div class="uph-mat-c t-' + r.st + '">' + esc(r.consequence) + '</div></div>' +
        '<div class="uph-mat-f"><div class="uph-mat-fv t-' + r.st + '">' + esc(r.freeLabel) + '</div><div class="uph-mat-fl">FREE OF NEED</div></div>' +
        '<div class="uph-mat-a">' + resBtn +
        '<button class="uph-btn-w sm" data-a="flow" data-f="purch" data-k="' + esc(r.jobCardId || '') + '">Request purchase</button>' +
        '<button class="uph-btn-g sm" data-a="flow" data-f="quote">Ask for prices</button></div></div>';
    }).join('') + '<div class="uph-mat-note">Request purchase <b>commits</b> — Purchase raises an order against the job card. Ask for prices <b>commits nothing</b>. That is why they are two buttons and not one.</div>'
      : '<div class="uph-empty">No rolls on the floor.</div>';
    var quotes = safe(function () { return getUphQuotesOnShortRows(); }, []);
    var qcard = '<section class="uph-card uph-qstrip"><div class="uph-card-h uph-card-h-sm"><div class="uph-t-sm">Quotes back on the short rows</div><span class="uph-note">Pick on the date, then say in one line why the cheaper quote lost.</span></div>' +
      (quotes.length ? quotes.map(function (q) {
        return '<div class="uph-qrow"><span class="uph-qrow-n"><b>' + esc(q.supplier) + '</b><i>' + esc(q.item) + '</i><em class="t-' + q.tone + '">' + esc(q.why) + '</em></span>' +
          '<span class="uph-qrow-l t-' + q.tone + '">' + esc(q.lead != null ? q.lead + ' days' : '—') + '</span><span class="uph-qrow-c">' + (q.cost != null ? bd(q.cost) : '—') + '</span>' +
          '<button class="uph-btn-o sm" data-a="flow" data-f="quote">Ask again</button></div>';
      }).join('') : '<div class="uph-empty uph-empty-sm">No quotes back on a short row.</div>') +
      '<div class="uph-ctx-n">There is no separate quotes page. The choice here is a lead-time choice — nine days on foam costs a bay slot and a target date, four days does not — so it sits beside the rows it decides.</div></section>';
    var costs = safe(function () {
      var seen = {};
      fabricRolls.forEach(function (r) { if (!seen[r.name]) seen[r.name] = r; });
      return Object.keys(seen).slice(0, 5).map(function (n) { var r = seen[n]; return { l: n, v: r.isCOM ? '—' : bd(r.costPerM) + '/m', st: r.isCOM ? 'plain' : undefined }; });
    }, []);
    return {
      sub: 'Every roll on the floor with the only three numbers that matter — landed, held against a job, free. Client\'s own material is flagged, because a shortfall there is not something we can buy our way out of.',
      stats: [{ v: rows.length, l: 'Rolls on the floor' }, { v: held.length, l: 'Held against a job' }, { v: short.length, l: 'Short of need', st: short.length ? 'bad' : 'ok' }, { v: com.length, l: 'COM rolls', st: com.length ? 'warn' : 'ok' }],
      chips: [{ label: 'All', n: rows.length }, { label: 'Short', n: short.length }, { label: 'Held', n: held.length }, { label: 'COM', n: com.length }],
      secondary: { label: 'Receive a roll', a: 'receive-roll' }, primary: { label: 'Reserve for a job', form: 'res' },
      custom: body + qcard,
      ruleT: 'One suite, one dye lot', rule: 'Stock on the shelf is not stock you have. Until it is held against this job card, another job can take it — and two lots on one suite is scrap.',
      ctx: ['Fabric cost — no selling price', costs, 'Cost per metre is visible because he takes the quotes. What we sell it for is not.']
    };
  }
  function pageBay() {
    var rows = safe(function () { return uphStageSlots.filter(function (s) { return s.stageId === 'B'; }).map(function (s) { return { id: s.id, jobCardId: s.jobCardId, date: uphSlotDate(s), pulled: s.kind === 'pull', provisional: s.provisional, st: s.provisional ? 'warn' : 'ok', state: s.provisional ? 'Provisional' : 'Booked' }; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }); }, []);
    var prov = rows.filter(function (r) { return r.provisional; });
    return {
      sub: 'Bays 1 and 2, slot by slot. A bay slot pulls its date from sewing and stays provisional until sewing has an end date.',
      stats: [{ v: rows.length, l: 'Bay slots' }, { v: prov.length, l: 'Provisional', st: prov.length ? 'warn' : 'ok' }, { v: rows.length - prov.length, l: 'Booked', st: 'ok' }, { v: new Set(rows.map(function (r) { return r.jobCardId; })).size, l: 'Suites' }],
      chips: [{ label: 'All', n: rows.length }, { label: 'Provisional', n: prov.length }], primary: { label: 'Book a bay', form: 'allot' },
      rows: S.pgChip === 1 ? prov : rows,
      cols: [
        { h: 'SUITE', cell: function (r) { return '<b>' + esc(r.jobCardId) + '</b><span class="uph-td-s">' + (r.pulled ? 'pulled from sewing' : 'booked directly') + '</span>'; } },
        { h: 'DAY', w: '110px', cell: function (r) { return esc(ddmmmShort(r.date)); } },
        { h: '', w: '200px', right: true, cell: function (r) { return pill(r.st, r.state) + (r.provisional ? ' <button class="uph-btn-o sm" data-a="confirm-slot" data-s="' + esc(r.id) + '">Confirm</button>' : ''); } }
      ],
      empty: 'No bay slots booked.',
      ruleT: 'Nothing overtakes', rule: 'A bay slot cannot start before sewing ends. Confirming it early only moves the disappointment to the client.',
      ctx: ['Still provisional', prov.map(function (r) { return { l: r.jobCardId, v: ddmmmShort(r.date), st: 'warn' }; }), null]
    };
  }
  // Finishing & QC — the last stage, and where the department's QC pass or
  // fail is recorded through the real pipeline (authority: Upholstery
  // Manager). Wrap and label happens here.
  function pageFin() {
    var q = safe(function () { return getDepartmentQueue('uph'); }, []);
    var atQC = q.filter(function (r) { return r.entry.status === 'qc'; }), ready = q.filter(function (r) { return r.entry.status === 'ready-for-handoff'; }), rework = q.filter(function (r) { return r.entry.status === 'rework'; });
    var rows = q.filter(function (r) { return ['qc', 'ready-for-handoff', 'rework', 'in-production'].indexOf(r.entry.status) !== -1; });
    var shown = S.pgChip === 1 ? atQC : S.pgChip === 2 ? ready : rows;
    return {
      sub: 'Wrap and label. A suite passes here or goes back to the bay with the reason on it — the reason is what the next one is fixed with.',
      stats: [{ v: atQC.length, l: 'Waiting for QC', st: atQC.length ? 'warn' : 'ok' }, { v: ready.length, l: 'Passed, to wrap', st: 'ok' }, { v: rework.length, l: 'Back to the bay', st: rework.length ? 'bad' : 'ok' }, { v: rows.length, l: 'On the bench or bays' }],
      chips: [{ label: 'All', n: rows.length }, { label: 'For QC', n: atQC.length }, { label: 'To wrap', n: ready.length }], primary: null,
      rows: shown,
      cols: [
        { h: 'PIECE', cell: function (r) { return '<b>' + esc(r.item.product || r.item.name || '') + '</b><span class="uph-td-s">' + esc(r.job.id + ' · ' + (r.job.projectName || '')) + (r.entry.rejectReason ? ' · ' + esc(r.entry.rejectReason) : '') + '</span>'; } },
        { h: 'STAGE', w: '130px', cell: function (r) { return pill(r.entry.status === 'rework' ? 'bad' : r.entry.status === 'qc' ? 'warn' : r.entry.status === 'ready-for-handoff' ? 'ok' : 'plain', r.entry.status.replace(/-/g, ' ')); } },
        { h: '', w: '260px', right: true, cell: function (r) {
          if (r.entry.status === 'qc') return '<button class="uph-btn sm" data-a="qc-pass" data-j="' + esc(r.job.id) + '" data-l="' + esc(r.item.lineId) + '">Pass</button> <button class="uph-btn-o sm" data-a="qc-fail" data-j="' + esc(r.job.id) + '" data-l="' + esc(r.item.lineId) + '">Fail</button>';
          if (r.entry.status === 'ready-for-handoff') return '<button class="uph-btn sm" data-a="handoff" data-j="' + esc(r.job.id) + '" data-l="' + esc(r.item.lineId) + '">Wrap, label, hand off</button>';
          if (r.entry.status === 'in-production') return '<button class="uph-btn-o sm" data-a="to-qc" data-j="' + esc(r.job.id) + '" data-l="' + esc(r.item.lineId) + '">Send to QC</button>';
          return '';
        } }
      ],
      empty: 'Nothing on the finishing bench.',
      ruleT: 'The reason travels', rule: 'A fail carries its reason back to the bay. A pass is the manager\'s call, never the man who covered it — the floor cannot pass its own work.',
      ctx: ['Back to the bay, and why', rework.map(function (r) { return { l: r.job.id, v: r.entry.rejectReason || 'no reason', st: 'bad' }; }), null]
    };
  }
  function prdWords(s) { return String(s || '').split(/[^A-Za-z]+/).filter(Boolean); }
  function initials(name) { var w = prdWords(name); return (w[0] ? w[0][0] : '') + (w[1] ? w[1][0] : '') || '?'; }
  function pageTeam() {
    var members = safe(function () { return uphStageMembers.filter(function (m) { return !!m.stageId; }); }, []);
    var loose = safe(function () { return getUphCrewless(); }, []);
    var days = weekDates(S.off);
    var idle = members.filter(function (m) { return safe(function () { return uphManState(m, days); }, {}).tone === 'bad'; });
    var cards = safe(function () { return UPH_STAGES; }, []).map(function (st) {
      var men = members.filter(function (m) { return m.stageId === st.id; });
      var open = S.crewOpen === st.id;
      var tgt = safe(function () { return uphStageTarget(st.id); }, { date: null, tone: 'wine', label: 'No target date yet' });
      var load = safe(function () { return uphStageLoad(st.id, days); }, 0);
      return '<section class="uph-crew' + (open ? ' open' : '') + '">' +
        '<button class="uph-crew-h" data-a="crew" data-c="' + st.id + '">' +
        '<span class="uph-mono">' + esc(st.mono) + '</span>' +
        '<span class="uph-crew-n"><b>' + esc(shortStage(st.id)) + '</b><i>' + esc(men.length + ' men · ' + st.capacity.replace(/^d+ (machinists )?· /, '')) + '</i>' +
        '<em class="t-' + tgt.tone + '">' + esc(tgt.date ? 'Target ' + ddmmmShort(tgt.date) + ' · ' + tgt.label : tgt.label) + '</em></span>' +
        '<span class="uph-pill t-' + (load > 5 ? 'bad' : load >= 3 ? 'ok' : 'warn') + '">' + load + ' of 5 days</span>' +
        '<span class="uph-chev">' + (open ? '▴' : '▾') + '</span></button>' +
        (open ? '<div class="uph-crew-b"><div class="uph-crew-hd"><span>WHO IS IN THIS CREW</span><span class="on">ON TODAY</span><span class="sp"></span></div>' +
          (men.length ? men.map(function (m) {
            var s = safe(function () { return uphManState(m, days); }, { tone: 'ok', label: 'Free' });
            return '<div class="uph-man"><span class="uph-man-m t-' + s.tone + '">' + esc(initials(m.name)) + '</span>' +
              '<span class="uph-man-n">' + esc(m.name) + (m.leader ? '<span class="uph-lead">LEADER</span>' : '') + '<i>' + esc(m.trade || '') + '</i></span>' +
              '<span class="uph-man-on t-' + s.tone + '">' + esc(s.label) + '</span>' +
              '<button class="uph-man-mv" data-a="flow" data-f="lab">Move</button></div>';
          }).join('') : '<div class="uph-empty uph-empty-sm">Nobody at this stage yet.</div>') +
          '<button class="uph-crew-add" data-a="flow" data-f="lab" data-k="' + st.id + '">＋ Assign labour to ' + esc(shortStage(st.id)) + '</button></div>' : '') +
        '</section>';
    }).join('');
    var looseCard = '<section class="uph-loose"><div class="uph-loose-h">Not in a crew</div>' +
      '<div class="uph-loose-n">' + loose.length + ' ' + (loose.length === 1 ? 'man' : 'men') + ' · assign them before Sunday</div>' +
      (loose.length ? loose.map(function (m) { return '<div class="uph-loose-r"><b>' + esc(m.name) + '</b><i>' + esc(m.trade || '') + '</i><button class="uph-btn-o sm" data-a="flow" data-f="lab">Assign</button></div>'; }).join('')
        : '<div class="uph-empty uph-empty-sm">Everybody stands at a stage.</div>') + '</section>';
    return {
      sub: 'Who stands in each stage today. Moving a man is allowed here; hiring, wages and leave are the labour dashboard\'s business, and hours hand over to it rather than being priced here.',
      stats: [{ v: members.length + loose.length, l: 'Men on the floor' }, { v: 5, l: 'Crews' }, { v: idle.length, l: 'Idle', st: idle.length ? 'bad' : 'ok' }, { v: loose.length, l: 'Not in a crew', st: loose.length ? 'warn' : 'ok' }],
      chips: [], primary: { label: 'Move a man', form: 'lab' }, custom: cards + looseCard,
      ruleT: 'Hours, never rates', rule: 'You move men and return hours. What those hours cost belongs to labour and accounts — it is not shown here, and it is never shown to sales.',
      ctx: ['Idle', idle.map(function (m) { return { l: m.name, v: shortStage(m.stageId), st: 'bad' }; }), 'A man with no stage cannot be given work, because everything on the board is allotted to a stage, never to a person.']
    };
  }
  function pageOT() {
    var rows = safe(function () { return getUphOvertimeRows(); }, []);
    var sum = safe(function () { return getUphOvertimeByCause(28); }, { rows: [], refused: 0, weeks: 4 });
    var refused = rows.filter(function (r) { return r.refused; }), worked = rows.filter(function (r) { return !r.refused; });
    return {
      sub: 'One row per shift: what it recovers, and what caused the slip. The same cause three weeks running is a planning problem, not a labour cost.',
      stats: [{ v: worked.length, l: 'Shifts booked' }, { v: worked.reduce(function (a, r) { return a + r.hours * r.men; }, 0), l: 'Man-hours' }, { v: refused.length, l: 'Refused', st: refused.length ? 'bad' : 'ok' }, { v: sum.rows.length ? sum.rows[0].cause : '—', l: 'Biggest cause' }],
      chips: [{ label: 'All', n: rows.length }, { label: 'Refused', n: refused.length }], primary: { label: 'Book overtime', a: 'ot-form' },
      rows: S.pgChip === 1 ? refused : rows,
      cols: [
        { h: 'SHIFT', cell: function (r) { return '<b>' + esc(r.stage + ' · ' + ddmmmShort(r.date)) + '</b><span class="uph-td-s">' + esc(r.refused ? r.refusedReason : r.hours + ' h × ' + r.men + ' · recovers ' + r.recoversTarget) + '</span>'; } },
        { h: 'CAUSE', w: '160px', cell: function (r) { return '<span class="uph-cause t-' + (/COM|changed/i.test(r.cause) ? 'bad' : 'warn') + '">' + esc(r.cause || '—') + '</span>'; } },
        { h: '', w: '110px', right: true, cell: function (r) { return pill(r.st, r.state); } }
      ],
      empty: 'No overtime booked.',
      ruleT: 'Overtime buys hours, not material', rule: 'A shift on a stage with nothing to work on is a paid idle day, and it is refused.',
      ctx: ['Last ' + sum.weeks + ' weeks by cause', sum.rows.map(function (r) { return { l: r.cause, v: r.hours + ' h', st: /COM|changed/i.test(r.cause) ? 'bad' : 'warn' }; }).concat(sum.refused ? [{ l: 'Nothing recoverable', v: sum.refused + ' refused', st: 'bad' }] : []), null]
    };
  }
  function pageRem() {
    var rows = safe(function () { return getUphReminders(); }, []);
    var bad = rows.filter(function (r) { return r.st === 'bad'; });
    return {
      sub: 'Every row points at a stage waiting. A reminder nobody is waiting on is a to-do, and those live in My tasks.',
      stats: [{ v: rows.length, l: 'Reminders' }, { v: bad.length, l: 'Somebody is stopped', st: bad.length ? 'bad' : 'ok' }, { v: rows.length - bad.length, l: 'Worth watching', st: 'warn' }, { v: new Set(rows.map(function (r) { return r.waiting; })).size, l: 'Stages affected' }],
      chips: [{ label: 'All', n: rows.length }, { label: 'Stopped', n: bad.length }], primary: null,
      rows: S.pgChip === 1 ? bad : rows,
      cols: [
        { h: 'WHAT', cell: function (r) { return '<b>' + esc(r.what) + '</b><span class="uph-td-s">' + esc(r.ref) + '</span>'; } },
        { h: 'WHO IS WAITING', w: '170px', cell: function (r) { return esc(r.waiting); } },
        { h: '', w: '170px', right: true, cell: function (r) { return pill(r.st, r.st === 'bad' ? 'Stopped' : 'Watch') + ' <button class="uph-btn-o sm" data-a="flow" data-f="' + r.form + '" data-k="' + esc(r.key || '') + '">Open</button>'; } }
      ],
      empty: 'Nobody is waiting on anything.',
      ruleT: 'A reminder is a stage waiting', rule: 'A reminder here means a stage cannot work. If nobody is stopped, it belongs in My tasks instead.',
      ctx: ['Stages stopped', bad.map(function (r) { return { l: r.waiting, v: r.ref, st: 'bad' }; }), null]
    };
  }
  function pageDoc() {
    var rows = safe(function () { return getUphDocuments(); }, []);
    return {
      sub: 'Tickets, specs, foam schedules and COM notes filed against the job card. Derived from the paperwork that exists — a register kept by hand goes stale and then it lies.',
      stats: [{ v: rows.length, l: 'Documents' }, { v: rows.filter(function (r) { return r.kind === 'Fabric plan'; }).length, l: 'Fabric plans' }, { v: rows.filter(function (r) { return r.kind === 'COM note'; }).length, l: 'COM notes' }, { v: rows.filter(function (r) { return r.st === 'bad'; }).length, l: 'Superseded or unsigned', st: rows.some(function (r) { return r.st === 'bad'; }) ? 'bad' : 'ok' }],
      chips: [{ label: 'All', n: rows.length }], primary: null, rows: rows,
      cols: [
        { h: 'DOCUMENT', cell: function (r) { return '<b>' + esc(r.ref) + '</b><span class="uph-td-s">' + esc(r.kind + ' · ' + ddmmmShort(r.on)) + '</span>'; } },
        { h: 'JOB CARD', w: '140px', cell: function (r) { return jobRef(r.jobCardId); } },
        { h: '', w: '130px', right: true, cell: function (r) { return pill(r.st, r.state); } }
      ],
      empty: 'No upholstery paperwork filed yet.',
      ruleT: 'Paperwork belongs to the job card', rule: 'Everything here is derived from a real record, so it cannot drift out of step with the floor.',
      ctx: ['By kind', ['Fabric plan', 'Foam schedule', 'COM note', 'Spec revision'].map(function (k) { return { l: k, v: rows.filter(function (r) { return r.kind === k; }).length }; }), null]
    };
  }
  var PAGES = { board: pageBoard, price: pagePrice, spec: pageSpec, plan: pagePlan, foam: pageFoam, fab: pageFab, bay: pageBay, fin: pageFin, team: pageTeam, ot: pageOT, rem: pageRem, doc: pageDoc };
  function pageHTML() {
    var def = safe(function () { return (PAGES[S.page] || pageBoard)(); }, null);
    if (!def) return '<div class="uph-dash"><div class="uph-l"><section class="uph-card"><div class="uph-empty">This page could not be built from the current data.</div></section></div></div>';
    var content = def.custom !== undefined ? def.custom : pageTable(def.cols, def.rows || [], def.empty || 'Nothing here.');
    return '<div class="uph-dash uph-page"><div class="uph-l">' +
      '<div class="uph-page-h uph-hrow"><span class="uph-page-t">' + esc(PAGE_TITLES[S.page] || S.page) + '</span>' + qBadge(def.sub, 'neutral') + '</div>' +
      statsStrip(def.stats || []) + chipRow(def.chips || [], def.secondary, def.primary) +
      '<section class="uph-card uph-page-c">' + content + '</section></div>' +
      '<div class="uph-r uph-rail">' + ruleCard(def.ruleT, def.rule) + contextCard((def.ctx || [])[0] || '', (def.ctx || [])[1] || [], (def.ctx || [])[2]) + '</div></div>';
  }

  /* ── render / events ───────────────────────────────────────────────── */
  function render() { return S.view === 'form' ? formHTML() : S.view === 'page' ? pageHTML() : dashHTML(); }
  function railIdForView() { return S.view === 'dash' ? 'uph-dash' : S.view === 'form' ? 'uph-create' : 'uph-' + S.page; }
  function paint() {
    if (root) root.innerHTML = render();
    uphSafeTop(uphRefreshSubtitle, null);
    uphSafeTop(function () { execMarkActive(railIdForView()); }, null);
  }
  function refreshChecks() {
    var panel = document.getElementById('uph-checks');
    if (panel) panel.innerHTML = checksRowsHTML(safe(flowChecks, []));
  }
  function onChange(e) {
    var t = e.target;
    if (!t || !root.contains(t)) return;
    var a = t.getAttribute && t.getAttribute('data-a');
    if (a === 'plan-f') {
      var i = Number(t.getAttribute('data-i')), rows = planRows();
      if (rows[i]) rows[i][t.getAttribute('data-k')] = t.value;
      if (t.getAttribute('data-k') === 'fabric') repaintPlan(); else repaintPlanTotals();
      return;
    }
    if (a === 'foam-item') {
      var fi = Number(t.getAttribute('data-i')), fr = foamLines();
      if (fr && fr[fi]) fr[fi].itemId = t.value;
      repaintFoam(); refreshChecks(); return;
    }
    if (t.id === 'uph-req') {
      var req = safe(function () { return inputRequests.find(function (x) { return x.id === t.value; }); }, null);
      if (req && req.jobCardId) { var js = document.getElementById('uph-job'); if (js) js.value = req.jobCardId; S.formJob = req.jobCardId; refreshChecks(); }
      return;
    }
    if (t.id === 'uph-job') {
      S.formJob = t.value || null; S.planRows = null; S.foamRows = null; S.formRoll = null;
      // NOT paint(): only what depends on the job repaints.
      refreshChecks();
      var rs = document.getElementById('uph-roll');
      if (rs) { var wrap = document.createElement('div'); wrap.innerHTML = sel('uph-roll', rollOpts(S.formJob, S.form === 'com'), rs.options[0].textContent); rs.replaceWith(wrap.firstChild); }
      if (root.querySelector('.uph-plan')) repaintPlan();
      if (root.querySelector('.uph-foam')) repaintFoam();
      return;
    }
    if (t.id === 'uph-roll') { S.formRoll = t.value || null; if (root.querySelector('.uph-plan')) repaintPlan(); return; }
    if (t.id === 'uph-stage') { S.formStage = t.value || null; return; }
  }
  function onClick(e) {
    var el = e.target.closest('[data-a]');
    if (!el || !root.contains(el)) return;
    var a = el.getAttribute('data-a');
    if (a === 'qchip') { var qt = el.nextElementSibling; if (qt && qt.classList.contains('uph-qtext')) qt.hidden = !qt.hidden; return; }
    if (a === 'wk') { S.off += Number(el.getAttribute('data-v')) || 0; paint(); return; }
    if (a === 'wk-today') { S.off = 0; paint(); return; }
    if (a === 'page') { S.view = 'page'; S.page = el.getAttribute('data-p') || 'board'; S.pgChip = 0; if (el.getAttribute('data-k') && S.page === 'team') S.crewOpen = el.getAttribute('data-k'); paint(); return; }
    if (a === 'chip') { S.pgChip = Number(el.getAttribute('data-i')) || 0; paint(); return; }
    if (a === 'crew') { var c = el.getAttribute('data-c'); S.crewOpen = S.crewOpen === c ? null : c; paint(); return; }
    if (a === 'cell') { go('form', 'allot'); S.formStage = el.getAttribute('data-st'); var ds = document.getElementById('uph-stage'); if (ds) ds.value = S.formStage; var dd = document.getElementById('uph-date'); if (dd) dd.value = el.getAttribute('data-d'); return; }
    if (a === 'flow') {
      var k = el.getAttribute('data-k');
      go('form', el.getAttribute('data-f'));
      if (k && /^JB|^C\d|^AMD|^REQ|^DEMO/i.test(k)) {
        if (/^REQ/.test(k)) { var rq = document.getElementById('uph-req'); if (rq) { rq.value = k; rq.dispatchEvent(new Event('change', { bubbles: true })); } }
        else { var jsel = document.getElementById('uph-job'); if (jsel) { jsel.value = k; jsel.dispatchEvent(new Event('change', { bubbles: true })); } }
      } else if (k && /^[FCSBQ]$/.test(k)) { S.formStage = k; var ss = document.getElementById('uph-stage'); if (ss) ss.value = k; }
      return;
    }
    if (a === 'ot-form') { go('form', 'allot'); if (typeof commsToast === 'function') commsToast('Overtime is booked from the board — tap a Friday cell, or the stage\'s OT badge.'); return; }
    if (a === 'gate') { S.gate = Number(el.getAttribute('data-i')); repaintGate(); return; }
    if (a === 'submit') { submitFlow(el.getAttribute('data-f')); return; }
    if (a === 'draft') { if (typeof commsToast === 'function') commsToast('Drafts are not built yet — nothing was saved.'); return; }
    if (a === 'plan-pull') { S.planRows = planPullFromSpec(); repaintPlan(); return; }
    if (a === 'plan-add') { planRows().push({ panel: '', fabric: 'main', qty: 1, length: 0, width: 0, nap: true }); repaintPlan(); return; }
    if (a === 'plan-qty') { var pi = Number(el.getAttribute('data-i')), pr = planRows(); if (pr[pi]) pr[pi].qty = Math.max(1, (Number(pr[pi].qty) || 1) + (Number(el.getAttribute('data-v')) || 0)); repaintPlan(); return; }
    if (a === 'plan-nap') { var ni = Number(el.getAttribute('data-i')), nr = planRows(); if (nr[ni]) nr[ni].nap = !nr[ni].nap; repaintPlan(); return; }
    if (a === 'plan-del') { planRows().splice(Number(el.getAttribute('data-i')), 1); repaintPlan(); return; }
    if (a === 'foam-q') { var qi = Number(el.getAttribute('data-i')), fr2 = foamLines(); if (fr2 && fr2[qi]) fr2[qi].qty = Math.max(1, fr2[qi].qty + (Number(el.getAttribute('data-v')) || 0)); repaintFoam(); return; }
    if (a === 'print-ticket') { if (typeof printCuttingSewingTicket === 'function') printCuttingSewingTicket(el.getAttribute('data-s')); return; }
    if (a === 'print-week') { if (typeof commsToast === 'function') commsToast('Print the week is not built yet.'); return; }
    if (a === 'off-table') { safe(function () { return confirmPlanOffTable(el.getAttribute('data-s'), UPH_USER); }, null); paint(); return; }
    if (a === 'on-table') { safe(function () { return putPlanOnTable(el.getAttribute('data-s')); }, null); paint(); return; }
    if (a === 'confirm-slot') { var cr = safe(function () { return confirmUphSlot(el.getAttribute('data-s'), UPH_USER); }, { error: 'Could not confirm it.' }); if (cr && cr.error && typeof commsToast === 'function') commsToast(cr.error); paint(); return; }
    if (a === 'release-hold') {
      var rid = el.getAttribute('data-r');
      safe(function () { fabricHolds.filter(function (h) { return h.rollId === rid && h.status === 'held'; }).forEach(function (h) { releaseFabricHold(h.id, UPH_USER, 'released from the register'); }); }, null);
      paint(); return;
    }
    if (a === 'reserve-roll') {
      var rr = el.getAttribute('data-r'), rj = el.getAttribute('data-j');
      var res = safe(function () { var need = rj ? jobFabricNeed(rj) : null; var m = Math.min(rollMetresFree(rr), need || rollMetresFree(rr)); return holdFabricForJob({ rollId: rr, jobCardId: rj || 'BAY-STOCK', metres: m, byWhom: UPH_USER }); }, { error: 'Could not hold it.' });
      if (res && res.error && typeof commsToast === 'function') commsToast(res.error);
      paint(); return;
    }
    if (a === 'receive-roll') {
      var name = window.prompt('Fabric name (e.g. Sahara 12 upholstery fabric)'); if (!name) return;
      var lot = window.prompt('Dye lot'); if (!lot) return;
      var m2 = Number(window.prompt('Metres landed')); if (!(m2 > 0)) return;
      var job = window.prompt('Job card it is for (blank for bay stock)') || null;
      var com = window.confirm('Is this the client\'s own material (COM)?');
      var r0 = safe(function () { return receiveFabricRoll({ name: name, dyeLot: lot, metres: m2, jobCardId: job, isCOM: com, byWhom: UPH_USER }); }, { error: 'Could not receive it.' });
      if (r0 && !r0.error) safe(function () { return inspectFabricRoll(r0.id, { ok: true, byWhom: UPH_USER }); }, null);
      if (typeof commsToast === 'function') commsToast(r0 && r0.error ? r0.error : r0.id + ' received and inspected.');
      paint(); return;
    }
    if (a === 'qc-pass' || a === 'qc-fail' || a === 'handoff' || a === 'to-qc') {
      var jid = el.getAttribute('data-j'), lid = Number(el.getAttribute('data-l'));
      var out = safe(function () {
        if (a === 'to-qc') return submitLineForQC(jid, lid, 'uph', UPH_USER);
        if (a === 'handoff') return handOffLine(jid, lid, 'uph', UPH_USER);
        if (a === 'qc-pass') return recordLineQCResult(jid, lid, 'uph', true, UPH_QC_USER);
        var why = window.prompt('Why did it fail? The reason goes back to the bay.'); if (why === null) return { error: 'Cancelled.' };
        return recordLineQCResult(jid, lid, 'uph', false, UPH_QC_USER, (why || '').trim() || null);
      }, { error: 'Could not record it.' });
      if (out && out.error && typeof commsToast === 'function') commsToast(out.error);
      paint(); return;
    }
  }
  function go(view, key) {
    S.view = view;
    if (view === 'page') { S.page = key; S.pgChip = 0; }
    // Entering any create flow resets the gate to null — a gate that arrives
    // pre-answered in the job's favour defeats the entire mechanism.
    if (view === 'form') { S.form = key; S.gate = null; S.formJob = null; S.formRoll = null; S.formStage = null; S.planRows = null; S.foamRows = null; }
    paint();
  }
  function mount(el) {
    root = el;
    root.classList.add('uph');
    root.removeEventListener('click', onClick);
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    if (typeof registerLiveUpdate === 'function') {
      registerLiveUpdate(function () {
        var w = document.getElementById('uph-module-wrap', 'timer-module-wrap');
        if (!w || getComputedStyle(w).display === 'none') return;
        if (S.view === 'form') return;
        paint();
      });
    }
    paint();
  }
  return {
    mount: mount, render: render, paint: paint, state: S, qBadge: qBadge, go: go,
    reset: function () { S.view = 'dash'; S.page = 'board'; S.gate = null; S.off = 0; S.pgChip = 0; },
    planTotals: function () { return fabricPlanTotals(planRows(), rollWidthMM()); }
  };
})();
