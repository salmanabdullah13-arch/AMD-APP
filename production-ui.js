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
    crewOpen: 'CREW-A'
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
  // "14 Aug" — the handoff's short date, no year.
  function ddmmmShort(iso) {
    if (!iso) return '—';
    var d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? String(iso) : String(d.getDate()).padStart(2, '0') + ' ' + MON[d.getMonth()];
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
  // Which create flow a row opens, and the action word on its button — both
  // from the handoff's own table.
  function askAction(kind) {
    var k = String(kind || '').toLowerCase();
    if (/pricing/.test(k)) return { label: 'Return input', form: 'price' };
    if (/budget/.test(k)) return { label: 'Return input', form: 'bomb' };
    if (/bom/.test(k)) return { label: 'Accept and reissue', form: 'bom' };
    if (/quote/.test(k)) return { label: 'Compare quotes', form: 'quote' };
    return { label: 'Reserve or quote', form: 'res' };
  }
  // The need line — the tone-coded sentence saying what the asker actually
  // needs back. It is the row's whole point and it carries the rule.
  function needLine(r) {
    var k = String(r.kind || '').toLowerCase();
    if (/pricing/.test(k)) return { text: 'Hours and board counts. Not a price.', tone: 'wine' };
    if (/budget/.test(k)) return { text: 'A standard per unit, not this one job\'s numbers.', tone: 'wine' };
    if (/bom/.test(k)) return { text: 'Any sheet cut from the old revision is dead paper.', tone: 'bad' };
    if (/quote/.test(k)) return { text: 'Pick one, or the work cannot be finished.', tone: 'plain' };
    return { text: 'Reserve it or take supplier quotes before the crew stops.', tone: 'bad' };
  }
  function dueTone(due) {
    if (!due) return 'warn';
    var t = todayLocal();
    if (due <= t) return 'bad';
    return 'warn';
  }
  function dueLabel(due) {
    if (!due) return 'No date';
    var t = todayLocal();
    if (due === t) return 'Today';
    if (due < t) return 'Now';
    var tm = safe(function () { return addDaysISO(t, 1); }, null);
    if (due === tm) return 'Tomorrow';
    // "14 Aug" — the handoff's own short form, no year.
    var d = new Date(due + 'T00:00:00');
    return isNaN(d) ? String(due) : String(d.getDate()).padStart(2, '0') + ' ' + MON[d.getMonth()];
  }
  function askedHTML() {
    var rows = safe(function () { return getAskedOfYouToday(); }, []);
    var shown = rows.slice(0, 5);
    var dueToday = rows.filter(function (r) { return r.due && r.due <= todayLocal(); }).length;
    return '<section class="prd-card prd-asked">' +
      '<div class="prd-card-h"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="prd-asked-t">Asked of you today</div>' +
      '<div class="prd-sub prd-sub-lg">Other people\'s deadlines. These come before the board, because somebody is waiting on the other end.</div>' +
      '</div><span class="prd-pill solid prd-count">' + rows.length + ' open · ' + dueToday + ' due today</span></div>' +
      (shown.length ? shown.map(function (r) {
        var kc = kindChip(r.kind), tone = dueTone(r.due), act = askAction(r.kind), need = needLine(r);
        return '<div class="prd-ask' + (tone === 'bad' ? ' t-bad' : '') + '">' +
          '<span class="prd-kind ' + kc[1] + '">' + kc[0] + '</span>' +
          '<span class="prd-ask-n"><span class="prd-ask-t">' + esc(r.detail || r.kind) + '</span>' +
          '<span class="prd-ask-f">' + esc(r.from || '—') + (r.ref ? ' · ' + esc(r.ref) : '') + '</span>' +
          '<span class="prd-need t-' + need.tone + '">' + esc(need.text) + '</span></span>' +
          '<span class="prd-due t-' + tone + '">' + esc(dueLabel(r.due)) + '</span>' +
          '<button class="prd-btn-sm" data-a="flow" data-f="' + act.form + '">' + esc(act.label) + '</button></div>';
      }).join('')
        : '<div class="prd-empty">Nobody is waiting on you right now.</div>') +
      '</section>';
  }

  /* ── 2. The week board — the module's central artefact ──────────────── */
  function crewList() { return safe(function () { return crews; }, []); }

  // The cell vocabulary, exactly as the handoff defines it:
  // full · half · over · blocked · pull · ot · wknd.
  function crewIdleThisWeek(crew, days) {
    var busy = safe(function () {
      return laneSlots.some(function (s) { return s.crewId === crew.id && (days || []).indexOf(slotDate(s)) !== -1; });
    }, false);
    if (busy) return null;
    return safe(function () { return crewBlockedReason(crew.id); }, null);
  }
  function cellFor(crew, day, dayIdx, idleReason) {
    var slots = safe(function () { return laneSlots.filter(function (s) { return s.crewId === crew.id && slotDate(s) === day; }); }, []);
    var ot = safe(function () { return overtimeShifts.filter(function (o) { return o.crewId === crew.id && o.date === day; }); }, []);
    var otH = ot.reduce(function (a, o) { return a + (o.hours || 0); }, 0);
    var weekend = dayIdx === 5 || dayIdx === 6;

    if (slots.length > 1) {
      return { st: 'over', j: slots.map(function (s) { return String(s.jobCardId); }).join(' + '), s: 'two jobs' };
    }
    if (slots.length === 1) {
      var sl = slots[0];
      var st = sl.baseSlotId ? 'pull' : (sl.portion === 'half' ? 'half' : 'full');
      // Overtime on a day that already has work does NOT turn the cell green —
      // it stays the job's own state and says so in the sub-line. Only a day
      // whose ONLY reason to exist is the shift is an `ot` cell.
      var sub = otH ? '+' + otH + ' h OT'
        : sl.baseSlotId ? 'after joinery'
          : sl.portion === 'half' ? 'half day' : 'full day';
      return { st: st, j: sl.jobCardId, s: sub };
    }
    if (otH) return { st: 'ot', j: 'OT', s: 'OT ' + otH + ' h shift' };
    if (weekend) return { st: 'wknd', j: '—', s: '' };
    // Nothing allotted, and work routed to this crew is stuck in the waiting
    // strip: the crew is there with nothing it can start.
    if (idleReason) return { st: 'blocked', j: 'stopped', s: idleReason.length > 22 ? idleReason.slice(0, 20) + '…' : idleReason, title: idleReason };
    return { st: 'free', j: 'free', s: 'free' };
  }

  function laneLoad(crew, days) {
    var booked = 0;
    var idle = crewIdleThisWeek(crew, days);
    days.slice(0, 5).forEach(function (d, i) {
      var c = cellFor(crew, d, i, idle);
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
      '<div class="prd-card-h prd-card-h-lg"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="prd-t">The week board</div>' +
      '<div class="prd-sub prd-sub-lg">Four lanes, one clock. <b>Paint and install pull their dates from joinery</b> — move a joinery slot and the ones after it move with it. Green Friday cells are <b>overtime</b>, booked against the target they recover.</div>' +
      '</div><span class="prd-step"><button data-a="wk" data-v="-1" aria-label="Previous week">‹</button>' +
      '<button class="lbl" data-a="wk-today">This week</button>' +
      '<button data-a="wk" data-v="1" aria-label="Next week">›</button></span></div>' +

      '<div class="prd-board-scroll">' +
      '<div class="prd-days"><span class="spacer">TEAM</span>' +
      days.map(function (d, i) {
        return '<span class="d' + (d === today ? ' today' : '') + '">' + DL[i] + ' ' + shortDay(d) + '</span>';
      }).join('') + '</div>' +

      crewList().map(function (c) {
        var booked = laneLoad(c, days);
        var lt = booked > 5 ? 'bad' : booked >= 3 ? 'ok' : 'warn';
        var tgt = safe(function () { return crewTarget(c.id); }, { date: null, tone: 'wine', label: 'No target date yet' });
        var otH = safe(function () {
          return overtimeShifts.filter(function (o) { return o.crewId === c.id && days.indexOf(o.date) !== -1; })
            .reduce(function (a, o) { return a + (o.hours || 0); }, 0);
        }, 0);
        var idleReason = crewIdleThisWeek(c, days);
        var idle = !!idleReason;
        return '<div class="prd-lane"><div class="prd-lane-l">' +
          '<div class="prd-lane-n">' + esc(c.name) + '</div>' +
          '<div class="prd-lane-cap">' + esc(safe(function () { return crewCapacityLine(c); }, c.station || '')) + '</div>' +
          '<span class="prd-load prd-pill t-' + lt + '">' + booked + ' of 5 days</span>' +
          '<span class="prd-tgt t-' + tgt.tone + '">' + (tgt.date ? 'Target ' + esc(ddmmmShort(tgt.date)) + ' · ' + esc(tgt.label) : esc(tgt.label)) + '</span>' +
          // An idle crew's overtime badge is the warning, not a total.
          (otH ? '<span class="prd-ot prd-pill t-ok">OT ' + otH + ' h</span>'
            : idle ? '<span class="prd-ot prd-pill t-bad">OT would be idle</span>' : '') +
          '</div>' +
          days.map(function (d, i) {
            var cell = cellFor(c, d, i, idleReason);
            return '<button class="prd-cell c-' + cell.st + '" data-a="cell" data-c="' + esc(c.id) + '" data-d="' + esc(d) + '" ' +
              'title="' + esc(DL[i] + ' — ' + (cell.title || (cell.st === 'wknd' ? 'weekend' : cell.st === 'free' ? 'no work allotted' : cell.j + ' · ' + cell.s))) + '">' +
              '<span class="j">' + esc(cell.j) + '</span>' +
              (cell.s ? '<span class="s">' + esc(cell.s) + '</span>' : '') + '</button>';
          }).join('') + '</div>';
      }).join('') +
      '</div>' +

      '<div class="prd-wait"><div class="prd-wait-h-row">' +
      '<span class="prd-wait-h">Waiting for a lane</span>' +
      '<span class="prd-wait-rule">A lane will not take a job with no material or a pending revision</span></div>' +
      (waiting.length ? '<div class="prd-wait-row">' + waiting.slice(0, 3).map(function (w) {
        var tone = /short|No BOM/i.test(w.reason) ? 'bad' : 'warn';
        var form = /short/i.test(w.reason) ? 'res' : 'bom';
        return '<button class="prd-wait-c t-' + tone + '" data-a="flow" data-f="' + form + '" data-k="' + esc(w.job.id) + '">' +
          '<span class="prd-wait-id">' + esc(w.job.id) + '</span>' +
          '<span class="prd-wait-t">' + esc(w.job.projectName || '') + '</span>' +
          '<span class="prd-wait-why">' + esc(w.reason) + '</span></button>';
      }).join('') + '</div>'
        : '<div class="prd-empty prd-empty-sm">Every routed job has a lane.</div>') +
      '</div></section>';
  }

  /* ── 3. Paperwork the shop is waiting on ────────────────────────────── */
  // Four kinds, as the handoff's 132px kind column names them: Cutting list ·
  // Veneer press · Paint queue · Installation.
  function paperworkRows() {
    var rows = [];
    safe(function () { return cuttingSheets; }, []).forEach(function (sh) {
      if (sh.status === 'dead' && !sh.confirmedOffSaw) {
        rows.push({ k: 'Cutting list', t: sh.id + ' — cut from a superseded revision',
          s: 'Dead paper. It clears when the sheet is confirmed off the saw, not when the new revision is issued.',
          st: 'bad', state: 'Reissue now', action: 'Release', form: 'cut', blocked: true });
      } else if (sh.status === 'released' || sh.status === 'on-saw') {
        rows.push({ k: 'Cutting list', t: sh.id + ' — ' + (sh.jobCardId || ''),
          s: sh.saw ? 'On ' + sh.saw : 'Released, not yet on a saw',
          st: sh.status === 'on-saw' ? 'plain' : 'ok', state: sh.status === 'on-saw' ? 'On saw' : 'Released',
          action: 'Open', form: 'cut' });
      }
    });
    safe(function () { return pressingBatches; }, []).forEach(function (b) {
      if (b.status !== 'open') return;
      var saved = safe(function () { return veneerSheetsSaved(); }, 0);
      rows.push({ k: 'Veneer press', t: b.id + ' — ' + (b.veneer || '') + ', ' + (b.jobs || []).length + ' jobs in one run',
        s: (b.jobs || []).map(function (j) { return j.jobCardId; }).join(' · ') + (saved ? ' · saves ' + saved + ' sheets' : ''),
        st: 'ok', state: 'Batched', action: 'Schedule', form: 'press' });
    });
    // Paint queue and Installation: the pulled dates, which are the two kinds
    // the board's `pull` cells correspond to.
    safe(function () { return laneSlots.filter(function (s) { return s.kind === 'pull'; }); }, []).forEach(function (s) {
      var crew = crews.find(function (c) { return c.id === s.crewId; }) || {};
      var when = safe(function () { return ddmmmShort(slotDate(s)); }, '');
      if (crew.dept === 'paint') {
        rows.push({ k: 'Paint queue', t: s.jobCardId + ' — booth time',
          s: 'Booth booked ' + when + ', pulled off the joinery slot before it.',
          st: 'warn', state: 'Book ' + when, action: 'Book', form: 'allot' });
      } else {
        rows.push({ k: 'Installation', t: s.jobCardId + ' — site fit',
          s: 'Provisional ' + when + '. It moves when paint moves.',
          st: 'warn', state: 'Provisional', action: 'Confirm', form: 'inst' });
      }
    });
    return rows;
  }
  function paperworkHTML() {
    var rows = paperworkRows();
    var blocked = rows.filter(function (r) { return r.st === 'bad'; }).length;
    return '<section class="prd-card">' +
      '<div class="prd-card-h prd-card-h-sm"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="prd-t-sm">Paperwork the shop is waiting on</div></div>' +
      (blocked ? '<span class="prd-note">' + blocked + ' blocked on somebody else</span>' : '') + '</div>' +
      (rows.length ? rows.slice(0, 5).map(function (o) {
        return '<div class="prd-out' + (o.st === 'bad' ? ' t-bad' : '') + '">' +
          '<span class="prd-out-k">' + esc(o.k) + '</span>' +
          '<span class="prd-out-n"><span class="prd-out-t">' + esc(o.t) + '</span>' +
          '<span class="prd-out-s">' + esc(o.s) + '</span></span>' +
          '<span class="prd-pill t-' + o.st + '">' + esc(o.state) + '</span>' +
          '<button class="prd-btn-o" data-a="flow" data-f="' + o.form + '">' + esc(o.action) + '</button></div>';
      }).join('')
        : '<div class="prd-empty">Nothing is waiting on paperwork.</div>') +
      '</section>';
  }

  /* ── right column ───────────────────────────────────────────────────── */
  function teamsHTML() {
    var days = weekDates(S.off);
    var now = new Date(todayLocal() + 'T00:00:00');
    return '<section class="prd-card prd-teams">' +
      '<div class="prd-teams-h"><span class="prd-t-sm">Teams today</span>' +
      '<span class="prd-note">' + esc(DL[now.getDay()] + ' ' + ddmmmShort(todayLocal())) + '</span></div>' +
      '<div class="prd-teams-note">Crews and where they physically are. Who stands in each crew is the labour dashboard\'s business.</div>' +
      '<div class="prd-teams-list">' +
      crewList().map(function (c) {
        var booked = laneLoad(c, days);
        var pct = Math.round(Math.min(100, booked / 5 * 100));
        var idle = !!crewIdleThisWeek(c, days);
        var tone = booked > 5 ? 'bad' : idle ? 'warn' : booked >= 3 ? 'ok' : 'warn';
        var state = booked > 5 ? 'Over' : idle ? 'Idle' : booked >= 3 ? 'On track' : 'Light';
        var todayCell = cellFor(c, todayLocal(), now.getDay(), crewIdleThisWeek(c, days));
        var on = todayCell.st === 'free' ? 'Nothing allotted today'
          : todayCell.st === 'wknd' ? 'Weekend'
            : todayCell.st === 'blocked' ? (todayCell.title || 'Stopped — nothing to work on')
              : todayCell.j + ' — ' + todayCell.s;
        var tgt = safe(function () { return crewTarget(c.id); }, { date: null, tone: 'wine' });
        var members = safe(function () { return getCrewMembers(c.id).length; }, 0);
        return '<button class="prd-team" data-a="page" data-p="team" data-k="' + esc(c.id) + '">' +
          '<span class="prd-team-h"><span class="prd-team-n">' + esc(c.name) + (members ? ' (' + members + ')' : '') + '</span>' +
          '<span class="prd-pill t-' + tone + '">' + state + '</span></span>' +
          '<span class="prd-team-on">' + esc(on) + '</span>' +
          '<span class="prd-track"><i style="width:' + pct + '%;background:var(--' + (tone === 'bad' ? 'bad' : tone === 'ok' ? 'ok' : 'warn') + ')"></i></span>' +
          '<span class="prd-team-f"><span class="prd-team-cap">' + booked + ' of 5 days' + (booked > 5 ? ' booked' : '') + '</span>' +
          '<span class="prd-team-tgt t-' + tgt.tone + '">' + (tgt.date ? 'Target ' + esc(ddmmmShort(tgt.date)) : 'No target') + '</span></span>' +
          '</button>';
      }).join('') + '</div></section>';
  }

  function kpiHTML() {
    var k = safe(function () { return getProductionKPIs(); }, {});
    var days = weekDates(S.off);
    var otWeek = safe(function () { return overtimeHoursInWeek(days); }, 0);
    var saved = safe(function () { return veneerSheetsSaved(); }, 0);
    var dueToday = safe(function () {
      return getAskedOfYouToday().filter(function (r) { return r.due && r.due <= todayLocal(); }).length;
    }, 0);
    var onFloor = safe(function () {
      return jobCards.filter(function (j) { return j.status !== 'cancelled' && j.routingConfirmed; }).length;
    }, 0);
    // The handoff's own six, in its order. Sub-lines that state a fact about
    // the data are derived in the same shape rather than copied literally —
    // "one due 16:00 today" is a statement about the prototype's rows.
    var rows = [
      ['Jobs on the factory floor', 'across four teams', String(onFloor), 'plain'],
      ['Waiting for a lane', 'material or BOM', String(k.waitingForLane || 0), 'bad'],
      ['Pricing input owed', dueToday ? dueToday + ' due today' : 'none due today', String(k.askedOfYou || 0), 'warn'],
      ['Cutting lists live', k.deadPaperOut ? k.deadPaperOut + ' to reissue' : 'none to reissue', String(k.liveSheets || 0), 'plain'],
      ['Overtime booked this week', otWeek + ' h · all against a target', otWeek + ' h', 'ok'],
      ['Veneer sheets saved', 'by batching, this month', String(saved), 'ok']
    ];
    return '<section class="prd-card">' + rows.map(function (r) {
      return '<div class="prd-kpi"><span class="prd-kpi-l"><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></span>' +
        '<span class="prd-kpi-v t-' + r[3] + '">' + esc(r[2]) + '</span></div>';
    }).join('') + '</section>';
  }


  var FLOW_TITLES = {
    price: ['Pricing input', 'What are you sending back?'],
    bomb: ['BOM input for budgeting', 'Is this a standard, or the numbers for one job?'],
    bom: ['BOM change', 'Where is the old cutting list right now?'],
    res: ['Reserve material', 'Is the BOM revision current?'],
    purch: ['Purchase', 'Are you committing, or asking?'],
    quote: ['Supplier quotes', 'Why is this not coming from stock?'],
    cut: ['Create a cutting list', 'Which BOM revision is this cut from?'],
    press: ['Veneer pressing', 'Batch it, or press alone?'],
    allot: ['Allot a lane slot', 'Is the job clear to take a slot?'],
    ot: ['Overtime', 'What is this overtime actually recovering?'],
    lab: ['Assign labour', 'Which crew is he going into?'],
    inst: ['Site installation', 'Where has paint got to?']
  };
  function formHTML() {
    var t = FLOW_TITLES[S.form] || [S.form, ''];
    return '<div class="prd-dash"><div class="prd-l"><section class="prd-card">' +
      '<div class="prd-card-h"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="prd-t">' + esc(t[0]) + '</div>' +
      '<div class="prd-sub">This create flow is not built yet. Its gate — <b>' + esc(t[1]) + '</b> — and the rule behind it are already enforced in the data layer.</div>' +
      '</div></div>' +
      '<div class="prd-empty">Use the week board on the dashboard for now.</div>' +
      '</section></div></div>';
  }
  /* ── render ─────────────────────────────────────────────────────────── */
  var PRD_TABS = [
    { k: 'asked', ico: '◎', label: 'Asked' },
    { k: 'board', ico: '▦', label: 'Board' },
    { k: 'create', ico: '＋', label: 'Create' },
    { k: 'floor', ico: '◧', label: 'Floor' }
  ];
  function tabbarHTML() {
    var open = safe(function () { return getAskedOfYouToday().length; }, 0);
    return '<nav class="prd-tabbar" aria-label="Production">' +
      PRD_TABS.map(function (t) {
        var on = (S.tab || 'board') === t.k;
        return '<button class="prd-tab' + (on ? ' on' : '') + '" data-a="tab" data-t="' + t.k + '">' +
          '<span class="prd-tab-i">' + t.ico +
          (t.k === 'asked' && open ? '<i class="prd-tab-d"></i>' : '') + '</span>' +
          '<span class="prd-tab-l">' + t.label + '</span></button>';
      }).join('') + '</nav>';
  }
  function dashHTML() {
    // Planner and My tasks are the shared collapsible widget — the
    // non-negotiables, one implementation, not a per-module copy.
    var plannerTasks = typeof renderPlannerAndTasks === 'function' ? renderPlannerAndTasks('prd') : '';
    return '<div class="prd-dash">' +
      '<div class="prd-l">' + askedHTML() + boardHTML() + paperworkHTML() + '</div>' +
      '<div class="prd-r">' + teamsHTML() + kpiHTML() + plannerTasks + '</div>' +
      '</div>' + tabbarHTML();
  }

  /* ═══════════════════════════════════════════════════════════════════
     The fourteen working pages. One template — title and sub, a four-cell
     stats strip, a chip row with a wine primary, then the content — plus a
     300px right rail carrying the page's business rule and one context
     card. Two pages replace the table entirely (`mat` and `team`), because
     what they show is not a list of rows.
     ═══════════════════════════════════════════════════════════════════ */

  var PAGE_TITLES = {
    board: 'Week board', price: 'Pricing input', bomb: 'BOM input for budgeting',
    bom: 'BOM changes', mat: 'Material & reservations', quote: 'Supplier quotes',
    cut: 'Cutting lists', press: 'Veneer pressing', paint: 'Paint & polish',
    inst: 'Site installation', team: 'Teams & labour', ot: 'Overtime & recovery',
    rem: 'Reminders', doc: 'Documents'
  };

  function statsStrip(cells) {
    return '<div class="prd-stats">' + cells.map(function (c) {
      return '<div class="prd-stat"><div class="prd-stat-v' + (c.st ? ' t-' + c.st : '') + '">' +
        esc(String(c.v)) + '</div><div class="prd-stat-l">' + esc(c.l) + '</div></div>';
    }).join('') + '</div>';
  }

  function chipRow(chips, secondary, primary) {
    return '<div class="prd-chips">' +
      chips.map(function (c, i) {
        return '<button class="prd-chip' + (S.pgChip === i ? ' on' : '') + '" data-a="chip" data-i="' + i + '">' +
          esc(c.label) + (c.n !== undefined ? ' <i>' + c.n + '</i>' : '') + '</button>';
      }).join('') +
      '<span class="prd-chips-sp"></span>' +
      (secondary ? '<button class="prd-btn-o" data-a="flow" data-f="' + secondary.form + '">' + esc(secondary.label) + '</button>' : '') +
      (primary ? '<button class="prd-btn" data-a="flow" data-f="' + primary.form + '">' + esc(primary.label) + '</button>' : '') +
      '</div>';
  }

  /** The wine rule card. Every page states the rule it enforces. */
  function ruleCard(text) {
    return '<section class="prd-rule"><div class="prd-rule-h">The rule on this page</div>' +
      '<div class="prd-rule-b">' + esc(text) + '</div></section>';
  }
  function contextCard(title, rows, note) {
    return '<section class="prd-card prd-ctx">' +
      '<div class="prd-card-h prd-card-h-sm"><div class="prd-t-sm">' + esc(title) + '</div></div>' +
      (rows.length ? rows.map(function (r) {
        return '<div class="prd-ctx-r"><span class="prd-ctx-l">' + esc(r.l) + '</span>' +
          '<span class="prd-ctx-v' + (r.st ? ' t-' + r.st : '') + '">' + esc(String(r.v)) + '</span></div>';
      }).join('') : '<div class="prd-empty prd-empty-sm">Nothing to show yet.</div>') +
      (note ? '<div class="prd-ctx-n">' + esc(note) + '</div>' : '') +
      '</section>';
  }

  /** The standard table. Columns are declared per page; rows are plain data. */
  function pageTable(cols, rows, empty) {
    if (!rows.length) return '<div class="prd-empty">' + esc(empty) + '</div>';
    return '<div class="prd-tbl-scroll"><table class="prd-tbl"><thead><tr>' +
      cols.map(function (c) {
        return '<th' + (c.w ? ' style="width:' + c.w + '"' : '') + (c.right ? ' class="r"' : '') + '>' + esc(c.h) + '</th>';
      }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr' + (r.st === 'bad' ? ' class="t-bad"' : '') + '>' +
          cols.map(function (c) {
            var v = c.cell(r);
            return '<td' + (c.right ? ' class="r"' : '') + '>' + v + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function pill(st, text) { return '<span class="prd-pill t-' + st + '">' + esc(text) + '</span>'; }
  function jobRef(id) { return '<span class="prd-ref">' + esc(id || '—') + '</span>'; }

  /* ── the page definitions ─────────────────────────────────────────── */

  function pageBoard() {
    var rows = safe(function () { return getBoardPageRows(weekDates(S.off)); }, []);
    var lanes = rows.filter(function (r) { return r.kind === 'lane'; });
    var refused = rows.filter(function (r) { return r.kind === 'refused'; });
    var idle = lanes.filter(function (r) { return r.booked === 0; }).length;
    return {
      sub: 'One row per lane, and one for every job a lane has refused. The target-out column is the date the job is promised, not the date it is booked.',
      stats: [
        { v: lanes.length, l: 'Lanes' },
        { v: lanes.reduce(function (a, r) { return a + r.booked; }, 0), l: 'Days booked' },
        { v: idle, l: 'Lanes with no work', st: idle ? 'bad' : 'ok' },
        { v: refused.length, l: 'Refused a lane', st: refused.length ? 'bad' : 'ok' }
      ],
      chips: [{ label: 'All', n: rows.length }, { label: 'Lanes', n: lanes.length }, { label: 'Refused', n: refused.length }],
      primary: { label: 'Allot a lane', form: 'allot' },
      rows: S.pgChip === 1 ? lanes : S.pgChip === 2 ? refused : rows,
      cols: [
        { h: 'LANE / JOB', cell: function (r) { return '<b>' + esc(r.name) + '</b><span class="prd-td-s">' + esc(r.sub || '') + '</span>'; } },
        { h: 'TARGET OUT', w: '130px', cell: function (r) {
          var t = r.targetOut;
          if (!t || !t.date) return '<span class="prd-dim">not set</span>';
          return '<b>' + esc(ddmmmShort(t.date)) + '</b><span class="prd-td-s t-' + t.tone + '">' + esc(t.label) + '</span>';
        } },
        { h: '', w: '120px', right: true, cell: function (r) { return pill(r.st, r.state); } }
      ],
      empty: 'No lanes and nothing refused.',
      rule: 'A lane will not take a job with no material or a pending revision. Book the material first, or the lane books an idle day.',
      ctx: ['Refused, and why', refused.map(function (r) { return { l: r.id, v: r.sub, st: 'bad' }; }), null]
    };
  }

  function pageRequests(type, isPricing) {
    var rows = safe(function () { return getInputRequestsOfType(type); }, []);
    var open = rows.filter(function (r) { return r.status === 'open'; });
    var due = open.filter(function (r) { return r.neededBy && r.neededBy <= todayLocal(); });
    return {
      sub: isPricing
        ? 'Requests arrive from the estimator and from nowhere else. There is no new-request button here — the button returns input.'
        : 'Raised by the operations manager only, and it asks for standards rather than one job’s numbers.',
      stats: [
        { v: rows.length, l: 'Requests' },
        { v: open.length, l: 'Open', st: open.length ? 'warn' : 'ok' },
        { v: due.length, l: 'Due today or past', st: due.length ? 'bad' : 'ok' },
        { v: rows.length - open.length, l: 'Answered' }
      ],
      chips: [{ label: 'Open', n: open.length }, { label: 'All', n: rows.length }],
      primary: { label: 'Return input', form: isPricing ? 'price' : 'bomb' },
      rows: S.pgChip === 1 ? rows : open,
      cols: [
        { h: 'WHAT IS ASKED', cell: function (r) { return '<b>' + esc(r.question) + '</b><span class="prd-td-s">' + esc(r.raisedBy || '') + (r.jobCardId ? ' · ' + esc(r.jobCardId) : '') + '</span>'; } },
        { h: 'REF', w: '110px', cell: function (r) { return jobRef(r.id); } },
        { h: 'NEEDED BY', w: '110px', cell: function (r) { return r.neededBy ? esc(ddmmmShort(r.neededBy)) : '<span class="prd-dim">no date</span>'; } },
        { h: '', w: '110px', right: true, cell: function (r) { return pill(r.status === 'open' ? 'warn' : 'ok', r.status === 'open' ? 'Open' : 'Answered'); } }
      ],
      empty: isPricing ? 'The estimator is not waiting on anything.' : 'Operations is not waiting on anything.',
      rule: isPricing
        ? 'Requests come from the estimator only — not sales, not the client, not production itself. You return hours and quantities; the estimator turns them into money.'
        : 'Budgeting input is not pricing input. Operations asks for standards; job-specific hours are the estimator’s.',
      ctx: isPricing
        ? ['What you may return', [
            { l: 'Man-hours', v: 'yes', st: 'ok' }, { l: 'Quantities', v: 'yes', st: 'ok' },
            { l: 'Machine time', v: 'yes', st: 'ok' }, { l: 'A rate or a price', v: 'never', st: 'bad' }
          ], 'You do not send a price. The estimator prices it.']
        : ['What operations may ask for', [
            { l: 'Consumption per unit', v: 'yes', st: 'ok' },
            { l: 'Wastage by process', v: 'yes', st: 'ok' },
            { l: 'Labour standard per unit', v: 'yes', st: 'ok' },
            { l: 'Job-specific hours', v: 'that is the estimator', st: 'bad' }
          ], null]
    };
  }

  function pageBOM() {
    var rows = safe(function () { return getBOMChangeRows(); }, []);
    var out = rows.reduce(function (a, r) { return a + r.outstanding; }, 0);
    return {
      sub: 'Every revision, and the cutting lists it killed. A dead list clears when the sheet is confirmed off the saw — not when the new revision is issued.',
      stats: [
        { v: rows.length, l: 'Revisions' },
        { v: rows.reduce(function (a, r) { return a + r.killed; }, 0), l: 'Lists killed' },
        { v: out, l: 'Still on a saw', st: out ? 'bad' : 'ok' },
        { v: rows.filter(function (r) { return r.status === 'draft'; }).length, l: 'Draft' }
      ],
      chips: [{ label: 'All', n: rows.length }, { label: 'Outstanding', n: rows.filter(function (r) { return r.outstanding; }).length }],
      primary: { label: 'Start a revision', form: 'bom' },
      rows: S.pgChip === 1 ? rows.filter(function (r) { return r.outstanding; }) : rows,
      cols: [
        { h: 'REVISION', cell: function (r) { return '<b>' + esc(r.jobCardId + ' · rev ' + r.rev) + '</b><span class="prd-td-s">' + (r.sheets.length ? 'killed ' + esc(r.sheets.join(', ')) : 'no cutting list affected') + '</span>'; } },
        { h: 'REF', w: '110px', cell: function (r) { return jobRef(r.id); } },
        { h: '', w: '150px', right: true, cell: function (r) { return pill(r.st, r.state); } }
      ],
      empty: 'No revisions yet.',
      rule: 'A BOM change kills the cutting list cut from the revision before it. The list does not clear itself — somebody has to take the sheet off the saw and say so.',
      ctx: ['Still cutting to dead paper', rows.filter(function (r) { return r.outstanding; })
        .map(function (r) { return { l: r.jobCardId, v: r.outstanding + ' sheet' + (r.outstanding > 1 ? 's' : ''), st: 'bad' }; }), null]
    };
  }

  /** Custom layout — a table cannot carry the consequence line or the
      tri-state Reserve button, and both are the reason this page exists. */
  function pageMaterial() {
    var rows = safe(function () { return getMaterialRows(); }, []);
    var short = rows.filter(function (r) { return r.st === 'bad'; });
    var held = rows.filter(function (r) { return r.reserve === 'done'; });
    var shown = S.pgChip === 1 ? short : S.pgChip === 2 ? held : rows;
    var body = shown.length ? shown.map(function (r) {
      return '<div class="prd-mat' + (r.st === 'bad' ? ' t-bad' : '') + '">' +
        '<div class="prd-mat-n"><div class="prd-mat-t">' + esc(r.name) +
        '<span class="prd-mat-j">' + esc(r.jobCardId) + '</span></div>' +
        '<div class="prd-mat-d">Need ' + esc(String(r.need)) + ' ' + esc(r.unit) +
        ' · held ' + esc(String(r.held)) + ' · free on the shelf ' + esc(String(r.free)) + '</div>' +
        '<div class="prd-mat-c t-' + r.st + '">' + esc(r.consequence) + '</div></div>' +
        '<div class="prd-mat-f"><div class="prd-mat-fv t-' + r.st + '">' +
        esc(r.have + ' of ' + r.need) + '</div><div class="prd-mat-fl">FREE OF NEED</div></div>' +
        '<div class="prd-mat-a">' +
        (r.reserve === 'done'
          ? '<span class="prd-mat-res done">Reserved</span>'
          : r.reserve === 'can'
            ? '<button class="prd-mat-res can" data-a="reserve" data-j="' + esc(r.jobCardId) + '">Reserve</button>'
            : '<span class="prd-mat-res none" title="Nothing free to reserve">Reserve</span>') +
        '<button class="prd-btn-w sm" data-a="flow" data-f="res">Request purchase</button>' +
        '<button class="prd-btn-g sm" data-a="flow" data-f="quote">Ask for prices</button>' +
        '</div></div>';
    }).join('') + '<div class="prd-mat-note">Request purchase <b>commits</b> — Purchase raises an order against the job card. ' +
      'Ask for prices <b>commits nothing</b> — it asks the purchaser to come back with supplier quotes so the lead time can be chosen. ' +
      'That is why they are two buttons and not one.</div>'
      : '<div class="prd-empty">No routed job is waiting on material.</div>';
    return {
      sub: 'One row per material, against the job that needs it. Free of need is read live off the shelf, not from the BOM.',
      stats: [
        { v: rows.length, l: 'Materials' },
        { v: short.length, l: 'Short', st: short.length ? 'bad' : 'ok' },
        { v: held.length, l: 'Held for a job', st: 'ok' },
        { v: rows.filter(function (r) { return r.st === 'warn'; }).length, l: 'On the shelf, not held', st: 'warn' }
      ],
      chips: [{ label: 'All', n: rows.length }, { label: 'Short', n: short.length }, { label: 'Held', n: held.length }],
      primary: { label: 'Reserve for a job', form: 'res' },
      custom: body,
      rule: 'Stock on the shelf is not stock you have. Until it is held against this job card, another job can take it — and the lane you booked becomes an idle day.',
      ctx: ['Short, and who waits', short.slice(0, 6).map(function (r) {
        return { l: r.name, v: r.have + ' of ' + r.need, st: 'bad' };
      }), null]
    };
  }

  function pageQuotes() {
    var rows = safe(function () { return (typeof rfqs !== 'undefined' ? rfqs : []); }, []);
    var back = rows.filter(function (r) { return r.status === 'quotes-in'; });
    return {
      sub: 'Comparisons from Purchase. Cost and lead time are both visible here because the choice is between them — the cheapest quote is not the cheapest option when the floor is waiting.',
      stats: [
        { v: rows.length, l: 'Enquiries' },
        { v: back.length, l: 'Quotes back', st: back.length ? 'warn' : 'ok' },
        { v: rows.filter(function (r) { return r.status === 'awarded'; }).length, l: 'Awarded' },
        { v: rows.reduce(function (a, r) { return a + (r.quotes || []).length; }, 0), l: 'Quotes in total' }
      ],
      chips: [{ label: 'Quotes back', n: back.length }, { label: 'All', n: rows.length }],
      primary: { label: 'Ask for prices', form: 'quote' },
      rows: S.pgChip === 1 ? rows : back,
      cols: [
        { h: 'ENQUIRY', cell: function (r) { return '<b>' + esc(r.id) + '</b><span class="prd-td-s">' + esc((r.lines || []).map(function (l) { return l.name; }).join(', ') || '—') + '</span>'; } },
        { h: 'QUOTES', w: '90px', cell: function (r) { return esc(String((r.quotes || []).length)); } },
        { h: 'BEST LEAD', w: '110px', cell: function (r) {
          var q = (r.quotes || []).slice().sort(function (a, b) { return (a.leadDays || 99) - (b.leadDays || 99); })[0];
          return q ? esc(q.leadDays + ' days') : '<span class="prd-dim">—</span>';
        } },
        { h: '', w: '120px', right: true, cell: function (r) { return pill(r.status === 'quotes-in' ? 'warn' : 'ok', r.status || ''); } }
      ],
      empty: 'Purchase is not holding any enquiry for you.',
      rule: 'Asking for prices commits nothing. It is how a lead time gets chosen before an order is placed, not a way to place one quietly.',
      ctx: ['Waiting on Purchase', back.map(function (r) { return { l: r.id, v: (r.quotes || []).length + ' to compare', st: 'warn' }; }), null]
    };
  }

  function pageCut() {
    var rows = safe(function () { return getCuttingListRows(); }, []);
    var dead = rows.filter(function (r) { return r.st === 'bad'; });
    var onSaw = rows.filter(function (r) { return r.status === 'on-saw'; });
    return {
      sub: 'Live sheets, and what is on which saw. A sheet cut from a superseded revision stays here until somebody confirms it off the saw.',
      stats: [
        { v: rows.length, l: 'Sheets' },
        { v: onSaw.length, l: 'On a saw' },
        { v: dead.length, l: 'Dead, still cutting', st: dead.length ? 'bad' : 'ok' },
        { v: rows.reduce(function (a, r) { return a + r.lines; }, 0), l: 'Parts listed' }
      ],
      chips: [{ label: 'All', n: rows.length }, { label: 'On a saw', n: onSaw.length }, { label: 'Dead', n: dead.length }],
      primary: { label: 'Create a cutting list', form: 'cut' },
      rows: S.pgChip === 1 ? onSaw : S.pgChip === 2 ? dead : rows,
      cols: [
        { h: 'SHEET', cell: function (r) { return '<b>' + esc(r.id) + '</b><span class="prd-td-s">' + esc(r.jobCardId + ' · rev ' + r.rev + ' · ' + r.lines + ' parts') + '</span>'; } },
        { h: 'SAW', w: '110px', cell: function (r) { return r.saw ? esc(r.saw) : '<span class="prd-dim">not on a saw</span>'; } },
        { h: '', w: '150px', right: true, cell: function (r) { return pill(r.st, r.state); } }
      ],
      empty: 'No cutting lists yet.',
      rule: 'Take the sheet off the saw first. A revision does not stop the man cutting to the paper already in his hand.',
      ctx: ['Cutting to dead paper', dead.map(function (r) { return { l: r.id, v: r.saw || 'a saw', st: 'bad' }; }), null]
    };
  }

  function pagePress() {
    var rows = safe(function () { return getPressRows(); }, []);
    var open = rows.filter(function (r) { return r.status === 'open'; });
    var saved = safe(function () { return veneerSheetsSaved(); }, 0);
    return {
      sub: 'Batches by veneer. Two jobs pressed in one run use one set-up instead of two, and the sheets saved are the reason to wait for the second.',
      stats: [
        { v: rows.length, l: 'Batches' },
        { v: open.length, l: 'Still collecting', st: open.length ? 'warn' : 'ok' },
        { v: rows.reduce(function (a, r) { return a + r.jobs; }, 0), l: 'Jobs batched' },
        { v: saved, l: 'Sheets saved', st: 'ok' }
      ],
      chips: [{ label: 'All', n: rows.length }, { label: 'Open', n: open.length }],
      primary: { label: 'Start a batch', form: 'press' },
      rows: S.pgChip === 1 ? open : rows,
      cols: [
        { h: 'BATCH', cell: function (r) { return '<b>' + esc(r.veneer || r.id) + '</b><span class="prd-td-s">' + esc(r.id + ' · ' + r.jobs + ' job' + (r.jobs === 1 ? '' : 's') + ' · ' + r.sheets + ' sheets') + '</span>'; } },
        { h: 'SAVES', w: '90px', cell: function (r) { return r.saved ? esc(r.saved + ' set-ups') : '<span class="prd-dim">—</span>'; } },
        { h: '', w: '150px', right: true, cell: function (r) { return pill(r.st, r.state); } }
      ],
      empty: 'No press batches.',
      rule: 'A batch waits for the second job or it saves nothing. Pressing one job alone is the same cost as pressing it late.',
      ctx: ['Open batches', open.map(function (r) { return { l: r.veneer || r.id, v: r.jobs + ' jobs', st: 'warn' }; }), null]
    };
  }

  function pagePulled(dept, isPaint) {
    var rows = safe(function () { return getPulledSlotRows(dept); }, []);
    var prov = rows.filter(function (r) { return !r.booked; });
    return {
      sub: isPaint
        ? 'Booth days, pulled from the joinery slot before them. Move the joinery slot and the booth day moves with it.'
        : 'Provisional against booked. A site fit stays provisional until paint is finished, because it moves when paint moves.',
      stats: [
        { v: rows.length, l: isPaint ? 'Booth days' : 'Site fits' },
        { v: prov.length, l: 'Provisional', st: prov.length ? 'warn' : 'ok' },
        { v: rows.length - prov.length, l: 'Booked', st: 'ok' },
        { v: new Set(rows.map(function (r) { return r.jobCardId; })).size, l: 'Jobs' }
      ],
      chips: [{ label: 'All', n: rows.length }, { label: 'Provisional', n: prov.length }],
      primary: isPaint ? { label: 'Book a booth day', form: 'allot' } : { label: 'Confirm a site fit', form: 'inst' },
      rows: S.pgChip === 1 ? prov : rows,
      cols: [
        { h: 'JOB', cell: function (r) { return '<b>' + esc(r.jobCardId) + '</b><span class="prd-td-s">' + esc(r.crew) + '</span>'; } },
        { h: 'DATE', w: '110px', cell: function (r) { return esc(ddmmmShort(r.date)); } },
        { h: 'PULLED FROM', w: '120px', cell: function (r) { return r.pulledFrom ? esc(ddmmmShort(r.pulledFrom)) : '<span class="prd-dim">—</span>'; } },
        { h: '', w: '120px', right: true, cell: function (r) { return pill(r.st, r.state); } }
      ],
      empty: isPaint ? 'No booth days booked.' : 'No site fits booked.',
      rule: isPaint
        ? 'Paint pulls its date from joinery. It is never booked on its own, because a booth day with nothing to spray is a lost day.'
        : 'Installation pulls its date from paint. Confirming it early only moves the disappointment to the client.',
      ctx: ['Still provisional', prov.map(function (r) { return { l: r.jobCardId, v: ddmmmShort(r.date), st: 'warn' }; }), null]
    };
  }

  /** Custom layout — five expandable crew cards over the real roster, and a
      "not in a crew" card, because a man with no crew cannot be given work. */
  /** CA CB SU PP SI — a lettered crew keeps its letter, everything else
      takes the initials of what it does. */
  function prdWords(s) {
    return String(s || '').split(/[^A-Za-z]+/).filter(Boolean);
  }
  function prdMonogram(name) {
    var w = prdWords(name);
    var i = -1;
    w.forEach(function (x, n) { if (i === -1 && x.toLowerCase() === 'crew') i = n; });
    if (i !== -1 && w[i + 1] && w[i + 1].length === 1) return ('C' + w[i + 1]).toUpperCase();
    return w.slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase() || '?';
  }
  /** Two men whose first names start alike must not share a monogram. */
  function prdInitials(name) {
    var w = prdWords(name);
    if (!w.length) return '?';
    return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
  }

  function pageTeam() {
    var members = safe(function () { return crewMembers.filter(function (m) { return !!m.crewId; }); }, []);
    var loose = safe(function () { return getCrewlessMen(); }, []);
    var wkDays = weekDates(S.off);
    var idle = members.filter(function (m) { return safe(function () { return manState(m, wkDays); }, {}).tone === 'bad'; });
    var cards = crews.map(function (c) {
      var men = members.filter(function (m) { return m.crewId === c.id; });
      var open = S.crewOpen === c.id;
      var tgt = safe(function () { return crewTarget(c.id); }, null);
      var wk = safe(function () { return getCrewWeek(c.id, weekDates(S.off)); }, []) || [];
      var booked = wk.filter(function (d) { return d.slots && d.slots.length; }).length;
      var mono = prdMonogram(c.name);
      return '<section class="prd-crew' + (open ? ' open' : '') + '">' +
        '<button class="prd-crew-h" data-a="crew" data-c="' + esc(c.id) + '">' +
        '<span class="prd-mono">' + esc(mono) + '</span>' +
        '<span class="prd-crew-n"><b>' + esc(c.name) + '</b>' +
        '<i>' + esc(crewCapacityLine(c)) + '</i>' +
        '<em class="t-' + ((tgt && tgt.tone) || 'wine') + '">' +
        esc(tgt && tgt.date ? 'Target out ' + ddmmmShort(tgt.date) + ' · ' + tgt.label : (tgt && tgt.label) || 'No target date yet') + '</em></span>' +
        '<span class="prd-pill t-' + (booked ? 'ok' : 'bad') + '">' + booked + ' of 5 days</span>' +
        '<span class="prd-chev">' + (open ? '▴' : '▾') + '</span></button>' +
        (open ? '<div class="prd-crew-b">' +
          '<div class="prd-crew-hd"><span>WHO IS IN THIS CREW</span><span class="on">ON TODAY</span><span class="sp"></span></div>' +
          (men.length ? men.map(function (m) {
            var st = safe(function () { return manState(m, wkDays); }, { tone: 'ok', label: 'Free' });
            return '<div class="prd-man">' +
              '<span class="prd-man-m t-' + st.tone + '">' + esc(prdInitials(m.name)) + '</span>' +
              '<span class="prd-man-n">' + esc(m.name) +
              (m.leader ? '<span class="prd-lead">LEADER</span>' : '') +
              '<i>' + esc(m.trade || '') + '</i></span>' +
              '<span class="prd-man-on t-' + st.tone + '">' + esc(st.label) + '</span>' +
              '<button class="prd-man-mv" data-a="flow" data-f="lab">Move</button></div>';
          }).join('') : '<div class="prd-empty prd-empty-sm">Nobody is in this crew yet.</div>') +
          '<button class="prd-crew-add" data-a="flow" data-f="lab">＋ Assign labour to ' + esc(c.name) + '</button>' +
          '</div>' : '') +
        '</section>';
    }).join('');
    var looseCard = '<section class="prd-loose">' +
      '<div class="prd-loose-h">Not in a crew</div>' +
      '<div class="prd-loose-n">' + loose.length + ' ' + (loose.length === 1 ? 'man' : 'men') +
      ' · a paid day producing nothing</div>' +
      (loose.length ? loose.map(function (m) {
        return '<div class="prd-loose-r"><b>' + esc(m.name) + '</b><i>' + esc(m.trade || '') + '</i>' +
          '<button class="prd-btn-o sm" data-a="flow" data-f="lab">Assign</button></div>';
      }).join('') : '<div class="prd-empty prd-empty-sm">Everybody is in a crew.</div>') +
      '</section>';
    return {
      sub: 'Who is in each crew, and who is in none. Work on the week board is allotted to a crew, never to a person — so a man with no crew cannot be given any.',
      stats: [
        { v: members.length + loose.length, l: 'Men' },
        { v: crews.length, l: 'Crews' },
        { v: loose.length, l: 'Not in a crew', st: loose.length ? 'warn' : 'ok' },
        { v: idle.length, l: 'Idle today', st: idle.length ? 'bad' : 'ok' }
      ],
      chips: [],
      primary: { label: 'Assign labour', form: 'lab' },
      custom: cards + looseCard,
      rule: 'A man with no crew cannot be given work, because everything on the week board is allotted to a crew and never to a person. Assign him, or he is a paid day producing nothing.',
      ctx: ['Idle today', idle.map(function (m) { return { l: m.name, v: crewName(m.crewId), st: 'bad' }; }), null]
    };
  }

  function pageOT() {
    var rows = safe(function () { return getOvertimeRows(); }, []);
    var sum = safe(function () { return getOvertimeCauseSummary(4); }, { rows: [], refused: 0, weeks: 4 });
    var refused = rows.filter(function (r) { return r.refused; });
    var worked = rows.filter(function (r) { return !r.refused; });
    return {
      sub: 'One row per shift: what it recovers, and what caused the slip. The same cause three weeks running is a planning problem, not a labour cost.',
      stats: [
        { v: worked.length, l: 'Shifts booked' },
        { v: worked.reduce(function (a, r) { return a + (r.hours || 0) * (r.men || 1); }, 0), l: 'Man-hours' },
        { v: refused.length, l: 'Refused', st: refused.length ? 'bad' : 'ok' },
        { v: sum.rows.length ? sum.rows[0].cause : '—', l: 'Biggest cause' }
      ],
      chips: [{ label: 'All', n: rows.length }, { label: 'Refused', n: refused.length }],
      primary: { label: 'Book overtime', form: 'ot' },
      rows: S.pgChip === 1 ? refused : rows,
      cols: [
        { h: 'SHIFT', cell: function (r) { return '<b>' + esc(r.crew + ' · ' + ddmmmShort(r.date)) + '</b><span class="prd-td-s">' + esc(r.refused ? r.refusedReason : 'recovers ' + r.recoversTarget) + '</span>'; } },
        { h: 'CAUSE', w: '160px', cell: function (r) { return '<span class="prd-cause t-' + (r.cause === 'BOM revision late' ? 'bad' : 'warn') + '">' + esc(r.cause || '—') + '</span>'; } },
        { h: '', w: '120px', right: true, cell: function (r) { return pill(r.st, r.state); } }
      ],
      empty: 'No overtime booked.',
      rule: 'Overtime buys hours, not material. A shift on a job whose boards are not there is a paid idle day, and it is refused.',
      ctx: ['Last ' + sum.weeks + ' weeks by cause',
        sum.rows.map(function (r) { return { l: r.cause, v: r.hours + ' h', st: r.cause === 'BOM revision late' ? 'bad' : 'warn' }; })
          .concat(sum.refused ? [{ l: 'Nothing recoverable', v: sum.refused + ' refused', st: 'bad' }] : []), null]
    };
  }

  function pageRem() {
    var rows = safe(function () { return getProductionReminders(); }, []);
    var bad = rows.filter(function (r) { return r.st === 'bad'; });
    return {
      sub: 'Every row points at a crew waiting. A reminder nobody is waiting on is a to-do, and those live in My tasks.',
      stats: [
        { v: rows.length, l: 'Reminders' },
        { v: bad.length, l: 'Somebody is stopped', st: bad.length ? 'bad' : 'ok' },
        { v: rows.length - bad.length, l: 'Worth watching', st: 'warn' },
        { v: new Set(rows.map(function (r) { return r.waiting; })).size, l: 'Crews affected' }
      ],
      chips: [{ label: 'All', n: rows.length }, { label: 'Stopped', n: bad.length }],
      primary: null,
      rows: S.pgChip === 1 ? bad : rows,
      cols: [
        { h: 'WHAT', cell: function (r) { return '<b>' + esc(r.what) + '</b><span class="prd-td-s">' + esc(r.ref) + '</span>'; } },
        { h: 'WHO IS WAITING', w: '170px', cell: function (r) { return esc(r.waiting); } },
        { h: '', w: '110px', right: true, cell: function (r) { return pill(r.st, r.st === 'bad' ? 'Stopped' : 'Watch'); } }
      ],
      empty: 'Nobody is waiting on anything.',
      rule: 'A reminder here means a crew cannot work. If nobody is stopped, it belongs in My tasks instead.',
      ctx: ['Crews stopped', bad.map(function (r) { return { l: r.waiting, v: r.ref, st: 'bad' }; }), null]
    };
  }

  function pageDoc() {
    var rows = safe(function () { return getProductionDocuments(); }, []);
    var jobs = new Set(rows.map(function (r) { return r.jobCardId; }));
    return {
      sub: 'Filed against the job card. This list is derived from the paperwork that actually exists — there is no separate register to keep in step, because one kept by hand goes stale and then it lies.',
      stats: [
        { v: rows.length, l: 'Documents' },
        { v: jobs.size, l: 'Job cards' },
        { v: rows.filter(function (r) { return r.kind === 'Cutting list'; }).length, l: 'Cutting lists' },
        { v: rows.filter(function (r) { return r.st === 'bad'; }).length, l: 'Superseded', st: rows.filter(function (r) { return r.st === 'bad'; }).length ? 'bad' : 'ok' }
      ],
      chips: [{ label: 'All', n: rows.length }],
      primary: null,
      rows: rows,
      cols: [
        { h: 'DOCUMENT', cell: function (r) { return '<b>' + esc(r.ref) + '</b><span class="prd-td-s">' + esc(r.kind) + '</span>'; } },
        { h: 'JOB CARD', w: '140px', cell: function (r) { return jobRef(r.jobCardId); } },
        { h: '', w: '130px', right: true, cell: function (r) { return pill(r.st, r.state); } }
      ],
      empty: 'No production paperwork filed yet.',
      rule: 'Production paperwork belongs to the job card, not to a folder. Everything here is derived from a real record, so it cannot drift out of step with the shop.',
      ctx: ['By kind', ['BOM revision', 'Cutting list', 'Press batch'].map(function (k) {
        return { l: k, v: rows.filter(function (r) { return r.kind === k; }).length };
      }), null]
    };
  }

  var PAGES = {
    board: pageBoard,
    price: function () { return pageRequests('pricing_input', true); },
    bomb: function () { return pageRequests('bom_budget_input', false); },
    bom: pageBOM, mat: pageMaterial, quote: pageQuotes, cut: pageCut,
    press: pagePress,
    paint: function () { return pagePulled('paint', true); },
    inst: function () { return pagePulled('carp', false); },
    team: pageTeam, ot: pageOT, rem: pageRem, doc: pageDoc
  };

  function pageHTML() {
    var def = safe(function () { return (PAGES[S.page] || pageBoard)(); }, null);
    if (!def) {
      return '<div class="prd-dash"><div class="prd-l"><section class="prd-card">' +
        '<div class="prd-empty">This page could not be built from the current data.</div></section></div></div>';
    }
    var content = def.custom !== undefined
      ? def.custom
      : pageTable(def.cols, def.rows || [], def.empty || 'Nothing here.');
    return '<div class="prd-dash prd-page">' +
      '<div class="prd-l">' +
      '<div class="prd-page-h"><div class="prd-page-t">' + esc(PAGE_TITLES[S.page] || S.page) + '</div>' +
      '<div class="prd-page-s">' + esc(def.sub) + '</div></div>' +
      statsStrip(def.stats || []) +
      chipRow(def.chips || [], def.secondary, def.primary) +
      '<section class="prd-card prd-page-c">' + content + '</section>' +
      '</div>' +
      '<div class="prd-r prd-rail">' + ruleCard(def.rule) +
      contextCard((def.ctx || [])[0] || '', (def.ctx || [])[1] || [], (def.ctx || [])[2]) +
      '</div></div>';
  }
  function render() {
    if (S.view === 'form') return formHTML();
    if (S.view === 'page') return pageHTML();
    return dashHTML();
  }
  function paint() { if (root) { root.innerHTML = render(); } }

  function onClick(e) {
    var el = e.target.closest('[data-a]');
    if (!el || !root.contains(el)) return;
    var a = el.getAttribute('data-a');
    if (a === 'wk') { S.off += Number(el.getAttribute('data-v')) || 0; paint(); return; }
    if (a === 'wk-today') { S.off = 0; paint(); return; }
    if (a === 'page') { S.view = 'page'; S.page = el.getAttribute('data-p') || 'board'; S.pgChip = 0; paint(); return; }
    // A chip is a filter on the page you are already on, so it never
    // resets the page — but changing page must reset the chip, or the new
    // page opens on a filter that belonged to the last one.
    if (a === 'chip') { S.pgChip = Number(el.getAttribute('data-i')) || 0; paint(); return; }
    if (a === 'crew') { var k = el.getAttribute('data-c'); S.crewOpen = (S.crewOpen === k) ? null : k; paint(); return; }
    // Reserving is a real stock movement, so it goes through 18a rather
    // than a flag on the row.
    if (a === 'reserve') {
      var held = safe(function () { return reserveJobMaterial(el.getAttribute('data-j'), 'Production Manager'); }, []);
      if (typeof commsToast === 'function') {
        commsToast(held && held.length ? 'Held against the job card — nobody else can take it.'
          : 'Nothing free to hold. Ask for prices, or raise a purchase.');
      }
      paint(); return;
    }
    // Entering ANY create flow resets the gate to null. A gate that arrives
    // pre-answered in the job's favour defeats the entire mechanism.
    if (a === 'flow') { S.view = 'form'; S.form = el.getAttribute('data-f') || 'price'; S.gate = null; paint(); return; }
    // Every board cell opens the allotment flow — the handoff's own rule.
    if (a === 'cell') { S.view = 'form'; S.form = 'allot'; S.gate = null; S.cellCrew = el.getAttribute('data-c'); S.cellDay = el.getAttribute('data-d'); paint(); return; }
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
      if (view === 'page') { S.page = key; S.pgChip = 0; }
      if (view === 'form') { S.form = key; S.gate = null; }
      paint();
    }
  };
})();
