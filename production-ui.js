/* ==========================================================================
   AMD-APP · Production manager module — design handoff 19a
   ==========================================================================
   The joinery production manager's module. Data layer is production-data.js
   (built 19 Aug from this same package); this is its interface.

   INTEGRATION, and the deviations, each deliberate:

   1. The handoff's own sidebar, topbar, back control, Quick actions, planner,
      tasks and floating chat are NOT drawn here. The exec shell owns all six
      app-wide — the same call 17a (Purchase) and 13b (Operations) made, and
      drawing a second set would stack two of each. 19a's rail ORDER, icons
      and badge tones go into EXEC_NAV_CONFIGS.production instead, which is
      where this app's sidebar actually comes from.

   2. Copy is frozen, per the package's contract: every title, subtitle, rule
      line and empty state below is transcribed, not rewritten. Where a
      sentence reads oddly it is encoding a business rule — the handoff says
      so explicitly and it is right.

   3. Content comes from the LIVE data layer, not the prototype's sample rows.
      The prototype's five inbox rows and five lane patterns are a scenario,
      not seed data; this app's standing rule (learned the hard way when the
      Operations dashboard turned out to be hand-authored fake numbers) is
      that a dashboard reads real state and shows an honest empty state when
      there is none. demo-data.js seeds the scenario for demonstrating it.

   4. The week board's cell vocabulary is reproduced exactly — full · half ·
      over · blocked · pull · ot · wknd — because it is the module's whole
      visual language, and `pull` (dashed wine) carries commitment 2: paint
      and install dates are DERIVED from joinery and move when it moves.
   ========================================================================== */

const prdModuleWrap = document.createElement('div');
prdModuleWrap.id = 'prd-module-wrap';
prdModuleWrap.className = 'xshell';
prdModuleWrap.style.cssText = 'display:none;';
document.body.appendChild(prdModuleWrap);

/* Every other module's wrap, hidden when this one opens. The standing rule:
   a new floating module joins every existing hide-list the day it is made. */
const PRD_OTHER_WRAPS = ['ops-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap',
  'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap',
  'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap',
  'painting-module-wrap', 'owner-module-wrap', 'admin-module-wrap', 'fleet-module-wrap',
  'delivery-sched-module-wrap'];

function prdBuildShell() {
  const k = (typeof getProductionKPIs === 'function') ? getProductionKPIs() : {};
  const nv = (id, ico, label, onclick, tag) => ({ id, ico, label, onclick, tag });
  prdModuleWrap.innerHTML = execShellHTML({
    title: 'Production', sub: null, role: 'Joinery Production Manager',
    contentId: 'prd-body', closeFn: 'closeProductionModule',
    /* Rail order, labels, icons and badge tones are the handoff's own
       fifteen-page table, in its order. Pages not yet built open the board
       rather than a dead view — flagged in the session log, not hidden. */
    navGroups: [{
      label: 'Workspace', items: [
        nv('prd-board', '▦', 'Week board', "PrdUI.go('page','board')", k.waitingForLane || ''),
        nv('prd-price', '∑', 'Pricing input', "PrdUI.go('page','price')", k.askedOfYou || ''),
        nv('prd-bomb', '⊟', 'BOM input for budgeting', "PrdUI.go('page','bomb')"),
        nv('prd-bom', '⇄', 'BOM changes', "PrdUI.go('page','bom')", k.deadPaperOut || ''),
        nv('prd-mat', '▣', 'Material & reservations', "PrdUI.go('page','mat')", k.blockedForMaterial || ''),
        nv('prd-quote', '⌸', 'Supplier quotes', "PrdUI.go('page','quote')"),
        nv('prd-cut', '⌗', 'Cutting lists', "PrdUI.go('page','cut')", k.liveSheets || ''),
        nv('prd-press', '▤', 'Veneer pressing', "PrdUI.go('page','press')", k.openBatches || ''),
        nv('prd-paint', '◐', 'Paint & polish', "PrdUI.go('page','paint')"),
        nv('prd-inst', '⌂', 'Site installation', "PrdUI.go('page','inst')"),
        nv('prd-team', '☷', 'Teams & labour', "PrdUI.go('page','team')"),
        nv('prd-ot', '◑', 'Overtime & recovery', "PrdUI.go('page','ot')"),
        nv('prd-rem', '⏱', 'Reminders', "PrdUI.go('page','rem')"),
        nv('prd-doc', '▨', 'Documents', "PrdUI.go('page','doc')")
      ]
    }]
  });
}

function openProductionModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => { m.style.display = 'none'; });
  PRD_OTHER_WRAPS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  prdModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  prdBuildShell();
  execSetContext('production', 'renderProductionBody');
  execThemeApply();
  PrdUI.reset();
  renderProductionBody();
  execMarkActive('prd-board');
  execRefreshBadges();
}
function closeProductionModule() { closeModuleWrap(prdModuleWrap, 'launchProductionModule'); }
function launchProductionModule() { openProductionModule(); }

function renderProductionBody() {
  const el = document.getElementById('prd-body');
  if (!el || typeof PrdUI === 'undefined') return;
  PrdUI.mount(el);
}

window.PrdUI = (function () {
  'use strict';

  var root = null;

  /* Per-role store, never shared — the handoff's State table. */
  var S = {
    view: 'dash',      // dash | page | form
    page: 'board',
    form: 'price',
    gate: null,        // null = unanswered. Entering any flow resets this.
    pgChip: 0,
    off: 0,            // period offset — drives the week board
    crewOpen: 'A'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function safe(fn, dflt) { try { var v = fn(); return v === undefined ? dflt : v; } catch (e) { return dflt; } }
  // BD 1,350.000 — 3 decimals, where cost appears. Production sees cost,
  // never selling price.
  function bd(n) { return 'BD ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
  // Dates DD MMM YYYY.
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function ddmmm(iso) {
    if (!iso) return '—';
    var d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return String(iso);
    return String(d.getDate()).padStart(2, '0') + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
  }
  function shortDay(iso) {
    var d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? '' : String(d.getDate());
  }
  function todayLocal() { return safe(function () { return todayISO(); }, new Date().toISOString().slice(0, 10)); }

  /* The working week is Sunday to Thursday; Friday and Saturday are weekend
     cells, dead grey unless overtime is booked. Week starts on Sunday. */
  function weekDates(off) {
    var t = new Date(todayLocal() + 'T00:00:00');
    t.setDate(t.getDate() - t.getDay() + (off || 0) * 7);   // getDay(): 0 = Sunday
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(t);
      d.setDate(t.getDate() + i);
      out.push(safe(function () { return localISO(d); }, d.toISOString().slice(0, 10)));
    }
    return out;
  }
  var DL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /* ── 1. Asked of you today ────────────────────────────────────────────
     "Other people's deadlines. These come before the board, because
      somebody is waiting on the other end." */
  function kindChip(kind) {
    var k = String(kind || '').toLowerCase();
    if (/pricing/.test(k)) return ['PRICING', 'k-wine'];
    if (/bom|budget/.test(k)) return ['BOM', 'k-bad'];
    return ['MATERIAL', 'k-warn'];
  }
  function dueTone(due) {
    if (!due) return 'ok';
    var t = todayLocal();
    if (due < t) return 'bad';
    if (due === t) return 'bad';
    return 'warn';
  }
  function dueLabel(due) {
    if (!due) return 'No date';
    var t = todayLocal();
    if (due === t) return 'Today';
    if (due < t) return 'Now';
    return ddmmm(due);
  }
  function askedHTML() {
    var rows = safe(function () { return getAskedOfYouToday(); }, []);
    var dueToday = rows.filter(function (r) { return r.due && r.due <= todayLocal(); }).length;
    return '<section class="prd-card prd-asked">' +
      '<div class="prd-card-h"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="prd-asked-t">Asked of you today</div>' +
      '<div class="prd-sub">Other people\'s deadlines. These come before the board, because somebody is waiting on the other end.</div>' +
      '</div><span class="prd-pill solid">' + rows.length + ' open · ' + dueToday + ' due today</span></div>' +
      (rows.length ? rows.slice(0, 5).map(function (r) {
        var kc = kindChip(r.kind), tone = dueTone(r.due);
        return '<button class="prd-ask' + (tone === 'bad' ? ' t-bad' : '') + '" data-a="ask" data-k="' + esc(r.ref || '') + '">' +
          '<span class="prd-kind ' + kc[1] + '">' + kc[0] + '</span>' +
          '<span class="prd-ask-n"><span class="prd-ask-t">' + esc(r.detail || r.kind) + '</span>' +
          '<span class="prd-ask-f">' + esc(r.from || '—') + (r.ref ? ' · ' + esc(r.ref) : '') + '</span></span>' +
          '<span class="prd-due t-' + tone + '">' + esc(dueLabel(r.due)) + '</span>' +
          '<span class="prd-btn-sm">Open</span></button>';
      }).join('')
        : '<div style="padding:22px 18px;font-size:11.5px;color:var(--tx3)">Nobody is waiting on you right now.</div>') +
      '</section>';
  }

  /* ── 2. The week board — the module's central artefact ──────────────── */
  function crewList() { return safe(function () { return crews; }, []); }

  // Cell state from real slots. The vocabulary is the handoff's, exactly.
  function cellFor(crew, day, dayIdx) {
    var slots = safe(function () { return laneSlots.filter(function (s) { return s.crewId === crew.id && slotDate(s) === day; }); }, []);
    var ot = safe(function () { return overtimeShifts.filter(function (o) { return o.crewId === crew.id && o.date === day; }); }, []);
    var weekend = dayIdx === 5 || dayIdx === 6;
    if (ot.length) {
      return { st: 'ot', j: 'OT', s: '+' + ot.reduce(function (a, o) { return a + (o.hours || 0); }, 0) + ' h OT' };
    }
    if (weekend && !slots.length) return { st: 'wknd', j: '—', s: '' };
    if (!slots.length) return { st: 'free', j: 'free', s: 'free' };
    if (slots.length > 1) {
      return { st: 'over', j: slots.map(function (s) { return String(s.jobCardId).slice(-4); }).join(' + '), s: 'two jobs' };
    }
    var sl = slots[0];
    var st = sl.baseSlotId ? 'pull' : (sl.portion === 'half' ? 'half' : 'full');
    var sub = sl.baseSlotId ? 'after joinery' : (sl.portion === 'half' ? 'half day' : 'full day');
    return { st: st, j: sl.jobCardId, s: sub };
  }

  function laneLoad(crew, days) {
    var booked = 0;
    days.slice(0, 5).forEach(function (d) {
      var c = cellFor(crew, d, days.indexOf(d));
      if (c.st === 'full' || c.st === 'pull' || c.st === 'over') booked += 1;
      else if (c.st === 'half') booked += 0.5;
    });
    return booked;
  }

  function boardHTML() {
    var days = weekDates(S.off);
    var today = todayLocal();
    var waiting = safe(function () { return getWaitingForLane(); }, []);

    return '<section class="prd-card prd-board">' +
      '<div class="prd-card-h"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="prd-t">The week board</div>' +
      '<div class="prd-sub">Four lanes, one clock. <b>Paint and install pull their dates from joinery</b> — move a joinery slot and the ones after it move with it. Green Friday cells are <b>overtime</b>, booked against the target they recover.</div>' +
      '</div><span class="prd-step"><button data-a="wk" data-v="-1" aria-label="Previous week">‹</button>' +
      '<span class="lbl">' + (S.off === 0 ? 'This week' : ddmmm(days[0])) + '</span>' +
      '<button data-a="wk" data-v="1" aria-label="Next week">›</button></span></div>' +

      '<div class="prd-board-scroll">' +
      '<div class="prd-days"><span class="spacer">TEAM</span>' +
      days.map(function (d, i) {
        return '<span class="d' + (d === today ? ' today' : '') + '">' + DL[i] + ' ' + shortDay(d) + '</span>';
      }).join('') + '</div>' +

      crewList().map(function (c) {
        var booked = laneLoad(c, days);
        var lt = booked > 5 ? 'bad' : booked >= 3 ? 'ok' : 'warn';
        var otH = safe(function () {
          return overtimeShifts.filter(function (o) { return o.crewId === c.id && days.indexOf(o.date) !== -1; })
            .reduce(function (a, o) { return a + (o.hours || 0); }, 0);
        }, 0);
        return '<div class="prd-lane"><div class="prd-lane-l">' +
          '<div class="prd-lane-n">' + esc(c.name) + '</div>' +
          '<div class="prd-lane-cap">' + esc(safe(function () { return crewCapacityLine(c); }, c.station || '')) + '</div>' +
          '<span class="prd-load prd-pill t-' + lt + '">' + booked + ' of 5 days</span>' +
          (otH ? '<span class="prd-ot prd-pill t-ok">OT ' + otH + ' h</span>' : '') +
          '</div>' +
          days.map(function (d, i) {
            var cell = cellFor(c, d, i);
            return '<button class="prd-cell c-' + cell.st + '" data-a="cell" data-c="' + esc(c.id) + '" data-d="' + esc(d) + '" ' +
              'title="' + esc(DL[i] + ' — ' + (cell.j === 'free' ? 'no work allotted' : cell.j)) + '">' +
              '<span class="j">' + esc(cell.j) + '</span>' +
              (cell.s ? '<span class="s">' + esc(cell.s) + '</span>' : '') + '</button>';
          }).join('') + '</div>';
      }).join('') +
      '</div>' +

      '<div class="prd-wait"><div class="prd-wait-h">Waiting for a lane</div>' +
      '<div class="prd-wait-rule">A lane will not take a job with no material or a pending revision</div>' +
      (waiting.length ? '<div class="prd-wait-row">' + waiting.slice(0, 6).map(function (w) {
        var tone = /short|No BOM/i.test(w.reason) ? 'bad' : 'warn';
        return '<button class="prd-wait-c t-' + tone + '" data-a="wait" data-k="' + esc(w.job.id) + '">' +
          '<span class="prd-wait-id">' + esc(w.job.id) + '</span>' +
          '<span class="prd-wait-t">' + esc(w.job.projectName || '') + '</span>' +
          '<span class="prd-wait-why">' + esc(w.reason) + '</span></button>';
      }).join('') + '</div>'
        : '<div style="font-size:11px;color:var(--tx3);margin-top:8px">Every routed job has a lane.</div>') +
      '</div></section>';
  }

  /* ── 3. Paperwork the shop is waiting on ────────────────────────────── */
  function paperworkHTML() {
    var rows = [];
    safe(function () { return cuttingSheets; }, []).forEach(function (sh) {
      if (sh.status === 'dead' && !sh.confirmedOffSaw) {
        rows.push({ k: 'Cutting list', t: sh.id + ' — cut from a superseded revision', s: 'Dead paper. It clears when the sheet is confirmed off the saw, not when the new revision is issued.', st: 'bad', state: 'Reissue now', action: 'Release' });
      } else if (sh.status === 'released' || sh.status === 'on-saw') {
        rows.push({ k: 'Cutting list', t: sh.id + ' — ' + (sh.jobCardId || ''), s: sh.saw ? 'On ' + sh.saw : 'Released, not yet on a saw', st: 'plain', state: sh.status === 'on-saw' ? 'On saw' : 'Released', action: 'Open' });
      }
    });
    safe(function () { return pressingBatches; }, []).forEach(function (b) {
      if (b.status === 'open') rows.push({ k: 'Veneer press', t: b.id + ' — ' + (b.veneer || ''), s: (b.jobs || []).length + ' job(s) batched', st: 'ok', state: 'Batched', action: 'Schedule' });
    });
    return '<section class="prd-card">' +
      '<div class="prd-card-h"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="prd-t">Paperwork the shop is waiting on</div></div></div>' +
      (rows.length ? rows.slice(0, 5).map(function (o) {
        return '<div class="prd-out' + (o.st === 'bad' ? ' t-bad' : '') + '">' +
          '<span class="prd-out-k">' + esc(o.k) + '</span>' +
          '<span class="prd-out-n"><span class="prd-out-t">' + esc(o.t) + '</span>' +
          '<span class="prd-out-s">' + esc(o.s) + '</span></span>' +
          '<span class="prd-pill t-' + o.st + '">' + esc(o.state) + '</span>' +
          '<button class="prd-btn-o" data-a="paper">' + esc(o.action) + '</button></div>';
      }).join('')
        : '<div style="padding:22px 16px;font-size:11.5px;color:var(--tx3)">Nothing is waiting on paperwork.</div>') +
      '</section>';
  }

  /* ── right column ───────────────────────────────────────────────────── */
  function teamsHTML() {
    var days = weekDates(S.off);
    return '<section class="prd-card">' +
      '<div class="prd-card-h"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="prd-t">Teams today</div>' +
      '<div class="prd-sub">Crews and where they physically are. Who stands in each crew is the labour dashboard\'s business.</div>' +
      '</div></div>' +
      crewList().map(function (c) {
        var booked = laneLoad(c, days);
        var pct = Math.round(Math.min(100, booked / 5 * 100));
        var tone = booked > 5 ? 'bad' : booked >= 3 ? 'ok' : 'warn';
        var todayCell = cellFor(c, todayLocal(), new Date(todayLocal() + 'T00:00:00').getDay());
        var on = todayCell.st === 'free' ? 'Nothing allotted today'
          : todayCell.st === 'wknd' ? 'Weekend'
            : todayCell.j + ' — ' + todayCell.s;
        return '<button class="prd-team" data-a="team" data-k="' + esc(c.id) + '">' +
          '<span class="prd-team-h"><span class="prd-team-n">' + esc(c.name) + '</span>' +
          '<span class="prd-pill t-' + tone + '">' + (booked > 5 ? 'Over' : booked >= 3 ? 'On track' : 'Light') + '</span></span>' +
          '<span class="prd-team-on">' + esc(on) + '</span>' +
          '<span class="prd-track"><i style="width:' + pct + '%;background:var(--' + (tone === 'bad' ? 'bad' : tone === 'ok' ? 'ok' : 'warn') + ')"></i></span>' +
          '<span class="prd-team-f"><span class="prd-team-cap">' + booked + ' of 5 days booked</span></span>' +
          '</button>';
      }).join('') + '</section>';
  }

  function kpiHTML() {
    var k = safe(function () { return getProductionKPIs(); }, {});
    var rows = [
      ['Jobs on the factory floor', 'across four teams', String(safe(function () {
        return jobCards.filter(function (j) { return j.status !== 'cancelled' && j.routingConfirmed; }).length;
      }, 0)), 'plain'],
      ['Waiting for a lane', 'material or BOM', String(k.waitingForLane || 0), (k.waitingForLane ? 'bad' : 'ok')],
      ['Pricing input owed', 'asked of you', String(k.askedOfYou || 0), (k.askedOfYou ? 'warn' : 'ok')],
      ['Cutting lists live', (k.deadPaperOut ? k.deadPaperOut + ' to reissue' : 'none to reissue'), String(k.liveSheets || 0), 'plain'],
      ['Overtime booked this month', 'all against a target', (k.otHoursThisMonth || 0) + ' h', 'ok'],
      ['Press batches open', 'batching saves sheets', String(k.openBatches || 0), 'ok']
    ];
    return '<section class="prd-card">' + rows.map(function (r) {
      return '<div class="prd-kpi"><span class="prd-kpi-l"><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></span>' +
        '<span class="prd-kpi-v t-' + r[3] + '">' + esc(r[2]) + '</span></div>';
    }).join('') + '</section>';
  }

  /* ── render ─────────────────────────────────────────────────────────── */
  function dashHTML() {
    // Planner and My tasks are the shared collapsible widget — the
    // non-negotiables, one implementation, not a per-module copy.
    var plannerTasks = typeof renderPlannerAndTasks === 'function' ? renderPlannerAndTasks('prd') : '';
    return '<div class="prd-dash">' +
      '<div class="prd-l">' + askedHTML() + boardHTML() + paperworkHTML() + '</div>' +
      '<div class="prd-r">' + teamsHTML() + kpiHTML() + plannerTasks + '</div>' +
      '</div>';
  }

  /* The fifteen working pages and twelve create flows are the next build
     increment. Until they land, a rail item says plainly which page it is
     rather than silently re-rendering the dashboard — a nav item that
     appears to do nothing is worse than one that says what it is. */
  var PAGE_TITLES = {
    board: 'Week board', price: 'Pricing input', bomb: 'BOM input for budgeting',
    bom: 'BOM changes', mat: 'Material & reservations', quote: 'Supplier quotes',
    cut: 'Cutting lists', press: 'Veneer pressing', paint: 'Paint & polish',
    inst: 'Site installation', team: 'Teams & labour', ot: 'Overtime & recovery',
    rem: 'Reminders', doc: 'Documents'
  };
  function pageHTML() {
    return '<div class="prd-dash"><div class="prd-l"><section class="prd-card">' +
      '<div class="prd-card-h"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="prd-t">' + esc(PAGE_TITLES[S.page] || S.page) + '</div>' +
      '<div class="prd-sub">This working page is not built yet. The dashboard, the week board and the data layer behind them are — everything this page will show is already enforced in production-data.js.</div>' +
      '</div></div>' +
      '<div style="padding:22px 18px;font-size:11.5px;color:var(--tx3)">Use the week board on the dashboard for now.</div>' +
      '</section></div></div>';
  }
  function render() { return S.view === 'page' && S.page !== 'board' ? pageHTML() : dashHTML(); }
  function paint() { if (root) { root.innerHTML = render(); } }

  function onClick(e) {
    var el = e.target.closest('[data-a]');
    if (!el || !root.contains(el)) return;
    var a = el.getAttribute('data-a');
    if (a === 'wk') { S.off += Number(el.getAttribute('data-v')) || 0; paint(); return; }
    if (a === 'team') { S.view = 'page'; S.page = 'team'; paint(); return; }
    if (a === 'wait' || a === 'ask' || a === 'cell' || a === 'paper') {
      // The create flows are the next build increment; until then these land
      // on the job they refer to rather than a dead view.
      var jobId = el.getAttribute('data-k');
      if (jobId && typeof execGoJob === 'function' && /^JB/.test(jobId)) { execGoJob(jobId); return; }
      return;
    }
  }

  function mount(el) {
    root = el;
    root.classList.add('prd');
    root.removeEventListener('click', onClick);
    root.addEventListener('click', onClick);
    paint();
  }

  return {
    mount: mount, render: render, paint: paint, state: S,
    reset: function () { S.view = 'dash'; S.page = 'board'; S.gate = null; S.off = 0; },
    // Entering any create flow resets the gate to null — a gate that arrives
    // pre-answered in the job's favour defeats the entire mechanism.
    go: function (view, key) {
      S.view = view;
      if (view === 'page') S.page = key;
      if (view === 'form') { S.form = key; S.gate = null; }
      paint();
    }
  };
})();
