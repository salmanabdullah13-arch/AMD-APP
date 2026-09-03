/* ==========================================================================
   crew-timer.js — the crew clock, phone-first
   ==========================================================================
   The screen a crew lead holds on site or on the floor: pick the crew, tick
   who is here, pick the job and the items, Start. A big clock. Pause with a
   reason. End the day, mark progress, send photos. Everything it writes
   goes through crew-timer-data.js, which writes the existing per-person
   day-logs — this is the ONE way hours are logged (Salman, 2 Sep 2026).

   Built at 390px first, desktop second — the reverse of most of the app,
   because anyone logging hours is on a phone.
   ========================================================================== */

const timerModuleWrap = document.createElement('div');
timerModuleWrap.id = 'timer-module-wrap';
timerModuleWrap.className = 'xshell';
timerModuleWrap.style.cssText = 'display:none;';
document.body.appendChild(timerModuleWrap);

const TIMER_OTHER_WRAPS = ['ops-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap',
  'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap',
  'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap',
  'painting-module-wrap', 'owner-module-wrap', 'admin-module-wrap', 'fleet-module-wrap',
  'delivery-sched-module-wrap', 'prd-module-wrap', 'uph-module-wrap'];

function ctSafeTop(fn, fallback) { try { const v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }
function ctIdentity() {
  return (window.__realCloudSession && window.cloudIdentity) ? window.cloudIdentity : 'Crew Lead';
}
function timerBuildShell() {
  const cnt = (fn) => ctSafeTop(fn, 0) || '';
  timerModuleWrap.innerHTML = execShellHTML({
    title: 'Crew clock', sub: null, role: 'Installation Crew Lead',
    contentId: 'timer-body', closeFn: 'closeCrewTimerModule',
    navGroups: [{ label: 'Workspace', items: [
      nv('ct-today', '⏱', 'Today', "TimerUI.go('today')", cnt(() => getOpenSessions().length)),
      nv('ct-start', '▶', 'Start the clock', "TimerUI.go('start')"),
      nv('ct-crews', '☷', 'Crews', "TimerUI.go('crews')", cnt(() => timerCrewsAll().length)),
      nv('ct-history', '▨', 'History', "TimerUI.go('history')", cnt(() => crewSessions.filter(s => s.status === 'ended').length))
    ] }]
  });
}
function openCrewTimerModule(preset) {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => { m.style.display = 'none'; });
  TIMER_OTHER_WRAPS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  timerModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  ctSafeTop(() => { if (typeof buildCrewRoster === 'function') buildCrewRoster(); if (typeof buildUphRoster === 'function') buildUphRoster(); }, null);
  timerBuildShell();
  execSetContext('crew-timer', 'renderCrewTimerBody');
  execThemeApply();
  TimerUI.reset(preset || null);
  renderCrewTimerBody();
  execMarkActive(preset ? 'ct-start' : 'ct-today');
  execRefreshBadges();
}
function closeCrewTimerModule() { TimerUI.stopTick(); closeModuleWrap(timerModuleWrap, 'launchCrewTimerModule'); }
function launchCrewTimerModule() { openCrewTimerModule(); }
/* The hop the workshop queues and Curtain's install dashboard make — the
   old per-person forms are gone, this is where "log work" goes now. Leaves
   a return ticket, like every other hop helper. */
function openCrewTimerFor(deptKey, jobId, lineId) {
  if (typeof execPushCurrent === 'function') ctSafeTop(() => execPushCurrent(), null);
  const visible = TIMER_OTHER_WRAPS.map(id => document.getElementById(id)).find(el => el && getComputedStyle(el).display !== 'none');
  if (visible && typeof hideModuleWrap === 'function') hideModuleWrap(visible);
  openCrewTimerModule({ dept: deptKey || null, jobId: jobId || null, lineId: lineId === undefined ? null : lineId });
}
function renderCrewTimerBody() {
  const el = document.getElementById('timer-body');
  if (!el || typeof TimerUI === 'undefined') return;
  TimerUI.mount(el);
}

window.TimerUI = (function () {
  'use strict';
  var root = null, tick = null;
  var S = { view: 'today', crewId: null, present: null, jobId: null, lineIds: [], activity: 'production',
    sessionId: null, pauseOpen: false, progress: null, photos: [], note: '', crewsDept: null, newcrew: null, historyJob: null };

  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safe(fn, d) { try { var v = fn(); return v === undefined ? d : v; } catch (e) { return d; } }
  function hhmmss(hours) {
    var s = Math.max(0, Math.round(hours * 3600));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }
  function hm(iso) { return iso ? String(iso).slice(11, 16) : '—'; }
  function deptName(k) { var d = safe(function () { return TIMER_DEPTS.find(function (x) { return x.key === k; }); }, null); return d ? d.name : k; }
  function jobLabel(id) {
    var j = safe(function () { return getJobCard(id); }, null);
    if (j) return j.id + ' — ' + (j.projectName || j.customerName || '');
    var cj = safe(function () { return curtainJobs.find(function (x) { return x.id === id; }); }, null);
    return cj ? cj.id + ' — ' + (cj.name || '') : id;
  }
  function toast(m) { if (typeof commsToast === 'function') commsToast(m); }

  /* ── Today ─────────────────────────────────────────────────────────── */
  function sessionCard(s, live) {
    var el = safe(function () { return sessionElapsedHours(s); }, 0);
    var photos = safe(function () { return getSessionPhotos(s.id).length; }, 0);
    return '<section class="ct-card ct-sess ' + s.status + '">' +
      '<div class="ct-sess-h"><span class="ct-sess-crew">' + esc(s.crewName) + '</span>' +
      '<span class="ct-pill t-' + (s.status === 'running' ? 'ok' : s.status === 'paused' ? 'warn' : 'plain') + '">' + esc(s.status === 'running' ? 'On the clock' : s.status === 'paused' ? 'Paused' : s.hours + ' h') + '</span></div>' +
      '<div class="ct-sess-j">' + esc(jobLabel(s.jobCardId)) + '</div>' +
      '<div class="ct-sess-m">' + esc(s.present.length + ' present · ' + s.activity + (s.lineIds.length ? ' · ' + s.lineIds.length + ' item' + (s.lineIds.length === 1 ? '' : 's') : '') + ' · started ' + hm(s.startedAt)) + '</div>' +
      (live && s.status !== 'ended'
        ? '<div class="ct-clock-sm" data-sess="' + s.id + '">' + hhmmss(el) + '</div>' +
          '<div class="ct-row">' +
          (s.status === 'running' ? '<button class="ct-btn-o" data-a="open-run" data-s="' + s.id + '">Pause</button>' : '<button class="ct-btn-o" data-a="resume" data-s="' + s.id + '">Resume</button>') +
          '<button class="ct-btn" data-a="open-end" data-s="' + s.id + '">End the day</button></div>'
        : '<div class="ct-sess-m">' + esc((s.progressPct !== null && s.progressPct !== undefined ? s.progressPct + '% marked · ' : '') + photos + ' photo' + (photos === 1 ? '' : 's') + (s.pauses.length ? ' · ' + s.pauses.length + ' pause' + (s.pauses.length === 1 ? '' : 's') : '')) + '</div>') +
      '</section>';
  }
  function todayHTML() {
    var open = safe(function () { return getOpenSessions(); }, []);
    var done = safe(function () { return getTodaySessions().filter(function (s) { return s.status === 'ended'; }); }, []);
    return '<div class="ct-page">' +
      '<div class="ct-h1">Today<span>' + esc(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' })) + '</span></div>' +
      (open.length ? '<div class="ct-h2">On the clock now</div>' + open.map(function (s) { return sessionCard(s, true); }).join('') : '') +
      '<button class="ct-btn ct-big" data-a="go" data-v="start">▶ Start the clock</button>' +
      '<div class="ct-h2">Days ended today</div>' +
      (done.length ? done.map(function (s) { return sessionCard(s, false); }).join('') : '<div class="ct-empty">No day ended yet. When the crew stops, the hours land here — and in the ledger.</div>') +
      '</div>';
  }

  /* ── Start ─────────────────────────────────────────────────────────── */
  function startHTML() {
    var crewsAll = safe(function () { return timerCrewsAll(); }, []);
    var crew = S.crewId ? crewsAll.find(function (c) { return c.id === S.crewId; }) : null;
    var jobs = crew ? safe(function () { return timerJobsForCrew(crew.id); }, []) : [];
    var lines = (crew && S.jobId) ? safe(function () { return timerLinesForJob(S.jobId, crew.id); }, []) : [];
    var present = S.present || (crew ? crew.members.slice() : []);
    var running = crew ? safe(function () { return getRunningSession(crew.id); }, null) : null;
    return '<div class="ct-page">' +
      '<div class="ct-h1">Start the clock</div>' +
      '<div class="ct-step"><b>1 · Crew</b>' +
      '<div class="ct-crews">' + crewsAll.map(function (c) {
        return '<button class="ct-crew' + (S.crewId === c.id ? ' on' : '') + '" data-a="pick-crew" data-c="' + esc(c.id) + '">' +
          '<b>' + esc(c.name) + '</b><i>' + esc(deptName(c.dept) + ' · ' + c.members.length + (c.members.length === 1 ? ' man' : ' men')) + '</i></button>';
      }).join('') + '<button class="ct-crew add" data-a="go" data-v="newcrew"><b>＋ New crew</b><i>name it, add the men</i></button></div></div>' +
      (crew ? (running
        ? '<div class="ct-banner t-warn">' + esc(crew.name + ' is already on the clock for ' + running.jobCardId + '. End that day before starting another.') + '</div>'
        : '<div class="ct-step"><b>2 · Who is here</b><span class="ct-hint">Everyone ticked logs the day. Untick anyone absent.</span>' +
          '<div class="ct-ticks">' + (crew.members.length ? crew.members.map(function (n) {
            var on = present.indexOf(n) !== -1;
            return '<button class="ct-tick' + (on ? ' on' : '') + '" data-a="tick-man" data-n="' + esc(n) + '">' + (on ? '✓ ' : '') + esc(n) + (n === crew.lead ? ' <em>lead</em>' : '') + '</button>';
          }).join('') : '<div class="ct-empty">Nobody in this crew yet. Add men on the Crews page.</div>') + '</div></div>' +
          '<div class="ct-step"><b>3 · Job</b>' +
          '<select class="ct-in" id="ct-job"><option value="">Which job?</option>' + jobs.map(function (j) { return '<option value="' + esc(j.id) + '"' + (S.jobId === j.id ? ' selected' : '') + '>' + esc(j.label) + '</option>'; }).join('') + '</select>' +
          (!jobs.length ? '<span class="ct-hint">Nothing routed to ' + esc(deptName(crew.dept)) + ' right now.</span>' : '') + '</div>' +
          (S.jobId ? '<div class="ct-step"><b>4 · Items</b>' +
            (lines.length ? '<div class="ct-ticks col">' + lines.map(function (l) {
              var on = S.lineIds.indexOf(Number(l.lineId)) !== -1;
              return '<button class="ct-tick' + (on ? ' on' : '') + (l.done ? ' off' : '') + '" data-a="tick-line" data-l="' + esc(l.lineId) + '"' + (l.done ? ' disabled' : '') + '>' +
                (on ? '✓ ' : '') + esc('#' + l.lineId + ' ' + l.product) + '<em>' + esc(l.done ? 'finished' : (l.qty || '') + ' ' + (l.unit || '') + (l.progressPct ? ' · ' + l.progressPct + '%' : '')) + '</em></button>';
            }).join('') + '</div>' : '<span class="ct-hint">A curtain job — the hours land on the job as a whole.</span>') + '</div>' : '') +
          '<div class="ct-step"><b>5 · What kind of work</b><div class="ct-chips">' + TIMER_ACTIVITIES.map(function (a) {
            return '<button class="ct-chip' + (S.activity === a ? ' on' : '') + '" data-a="activity" data-v="' + a + '">' + esc(a) + '</button>';
          }).join('') + '</div></div>' +
          '<button class="ct-btn ct-big" data-a="start"' + (!S.jobId || !present.length || (lines.length && !S.lineIds.length) ? ' disabled' : '') + '>▶ Start</button>' +
          '<div class="ct-hint c">The start time is saved the moment you press it. Lock the phone, close the app — the clock keeps running.</div>'
      ) : '<div class="ct-hint c">Pick a crew to begin.</div>') +
      '</div>';
  }

  /* ── Running ───────────────────────────────────────────────────────── */
  function runHTML() {
    var s = safe(function () { return crewSessions.find(function (x) { return x.id === S.sessionId; }); }, null);
    if (!s) return '<div class="ct-page"><div class="ct-empty">That session is gone.</div></div>';
    var el = safe(function () { return sessionElapsedHours(s); }, 0);
    var last = s.pauses[s.pauses.length - 1];
    return '<div class="ct-page">' +
      '<div class="ct-h1">' + esc(s.crewName) + '<span>' + esc(jobLabel(s.jobCardId)) + '</span></div>' +
      '<div class="ct-clock' + (s.status === 'paused' ? ' paused' : '') + '" data-sess="' + s.id + '">' + hhmmss(el) + '</div>' +
      '<div class="ct-clock-l">' + esc(s.status === 'paused' ? 'Paused — ' + (last ? last.reason : '') : 'On the clock since ' + hm(s.startedAt)) + '</div>' +
      '<div class="ct-facts"><div><span>Present</span><b>' + s.present.length + '</b></div><div><span>Items</span><b>' + (s.lineIds.length || '—') + '</b></div><div><span>Pauses</span><b>' + s.pauses.length + '</b></div></div>' +
      (s.status === 'running'
        ? (S.pauseOpen
          ? '<div class="ct-step"><b>Why is the clock stopping?</b><span class="ct-hint">Closed list, on purpose — a reason that cannot be counted cannot be fixed.</span><div class="ct-chips">' +
            PAUSE_REASONS.map(function (r) { return '<button class="ct-chip" data-a="pause" data-r="' + esc(r) + '">' + esc(r) + '</button>'; }).join('') + '</div>' +
            '<button class="ct-btn-g" data-a="pause-cancel">Keep going</button></div>'
          : '<button class="ct-btn-o ct-big" data-a="pause-open">⏸ Pause</button>')
        : '<button class="ct-btn ct-big" data-a="resume" data-s="' + s.id + '">▶ Resume</button>') +
      '<button class="ct-btn ct-big end" data-a="open-end" data-s="' + s.id + '">■ End the day</button>' +
      '<div class="ct-present">' + s.present.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + '</div>' +
      '</div>';
  }

  /* ── End ───────────────────────────────────────────────────────────── */
  function endHTML() {
    var s = safe(function () { return crewSessions.find(function (x) { return x.id === S.sessionId; }); }, null);
    if (!s) return '<div class="ct-page"><div class="ct-empty">That session is gone.</div></div>';
    var el = safe(function () { return sessionElapsedHours(s); }, 0);
    var hours = Math.max(0.5, Math.round(el * 4) / 4);
    var canProgress = s.jobKind === 'job' && ['carp', 'uph', 'paint'].indexOf(s.dept) !== -1 && s.lineIds.length;
    return '<div class="ct-page">' +
      '<div class="ct-h1">End the day<span>' + esc(s.crewName + ' · ' + jobLabel(s.jobCardId)) + '</span></div>' +
      '<div class="ct-facts"><div><span>On the clock</span><b>' + hhmmss(el) + '</b></div><div><span>Logs as</span><b>' + hours + ' h</b></div><div><span>Each of</span><b>' + s.present.length + '</b></div></div>' +
      '<div class="ct-hint">' + hours + ' h goes to each man present, at his own rate, against ' + (s.lineIds.length ? 'the ' + s.lineIds.length + ' item' + (s.lineIds.length === 1 ? '' : 's') : 'the job') + '. You never see the rate.</div>' +
      (canProgress ? '<div class="ct-step"><b>How far along?</b><span class="ct-hint">100% only comes from QC.</span><div class="ct-chips big">' +
        [25, 50, 75].map(function (p) { return '<button class="ct-chip' + (S.progress === p ? ' on' : '') + '" data-a="progress" data-p="' + p + '">' + p + '%</button>'; }).join('') + '</div></div>' : '') +
      '<div class="ct-step"><b>Progress photos</b><span class="ct-hint">What it looks like right now. They land on the job card — Sales sees the photo, never the hours.</span>' +
      '<label class="ct-btn-o ct-file">📷 Take or add photos<input type="file" accept="image/*" capture="environment" multiple data-a="photo" hidden></label>' +
      (S.photos.length ? '<div class="ct-thumbs">' + S.photos.map(function (p, i) { return '<span class="ct-thumb"><img src="' + esc(p.url) + '" alt=""><button data-a="photo-del" data-i="' + i + '">✕</button></span>'; }).join('') + '</div>' : '') +
      '<input class="ct-in" id="ct-note" placeholder="A line for tomorrow — what is left, what is waiting" value="' + esc(S.note) + '"></div>' +
      '<button class="ct-btn ct-big" data-a="end">✓ Save the day</button>' +
      '<button class="ct-btn-g" data-a="go" data-v="run">Back to the clock</button>' +
      '</div>';
  }

  /* ── Crews ─────────────────────────────────────────────────────────── */
  function crewsHTML() {
    var all = safe(function () { return timerCrewsAll(); }, []);
    return '<div class="ct-page"><div class="ct-h1">Crews<span>' + all.length + ' crews · ' + all.reduce(function (a, c) { return a + c.members.length; }, 0) + ' men</span></div>' +
      '<button class="ct-btn ct-big" data-a="go" data-v="newcrew">＋ New crew</button>' +
      all.map(function (c) {
        return '<section class="ct-card"><div class="ct-sess-h"><span class="ct-sess-crew">' + esc(c.name) + '</span><span class="ct-pill t-plain">' + esc(deptName(c.dept)) + '</span></div>' +
          '<div class="ct-present">' + (c.members.length ? c.members.map(function (n) { return '<span>' + esc(n) + (n === c.lead ? ' <em>lead</em>' : '') + (c.source === 'timer' ? ' <button class="ct-x" data-a="crew-rm" data-c="' + esc(c.id) + '" data-n="' + esc(n) + '">✕</button>' : '') + '</span>'; }).join('') : '<i>Nobody yet.</i>') + '</div>' +
          (c.source === 'timer' ? '<div class="ct-row"><select class="ct-in" id="ct-add-' + esc(c.id) + '"><option value="">Add a man…</option>' + safe(function () { return timerDeptRoster(c.dept); }, []).filter(function (n) { return c.members.indexOf(n) === -1; }).map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select><button class="ct-btn-o" data-a="crew-add" data-c="' + esc(c.id) + '">Add</button></div>'
            : '<div class="ct-hint">Edited on ' + (c.source === 'production' ? 'Production' : 'Upholstery') + '\'s own labour page.</div>') +
          '</section>';
      }).join('') + '</div>';
  }
  function newcrewHTML() {
    var n = S.newcrew || (S.newcrew = { name: '', dept: 'install', members: [], lead: '' });
    var roster = safe(function () { return timerDeptRoster(n.dept); }, []);
    return '<div class="ct-page"><div class="ct-h1">New crew</div>' +
      '<div class="ct-step"><b>Name</b><input class="ct-in" id="ct-nc-name" placeholder="Install crew B" value="' + esc(n.name) + '"></div>' +
      '<div class="ct-step"><b>Department</b><div class="ct-chips">' + TIMER_DEPTS.map(function (d) { return '<button class="ct-chip' + (n.dept === d.key ? ' on' : '') + '" data-a="nc-dept" data-v="' + d.key + '">' + esc(d.name) + '</button>'; }).join('') + '</div></div>' +
      '<div class="ct-step"><b>Who is in it</b><span class="ct-hint">Real names from the payroll. Tap the lead twice to make him lead.</span><div class="ct-ticks col">' +
      roster.map(function (name) { var on = n.members.indexOf(name) !== -1; return '<button class="ct-tick' + (on ? ' on' : '') + '" data-a="nc-tick" data-n="' + esc(name) + '">' + (on ? '✓ ' : '') + esc(name) + (n.lead === name ? ' <em>lead</em>' : '') + '</button>'; }).join('') + '</div></div>' +
      '<button class="ct-btn ct-big" data-a="nc-save">Save the crew</button>' +
      '<button class="ct-btn-g" data-a="go" data-v="crews">Cancel</button></div>';
  }

  /* ── History ───────────────────────────────────────────────────────── */
  function historyHTML() {
    var ended = safe(function () { return crewSessions.filter(function (s) { return s.status === 'ended'; }).slice().reverse(); }, []);
    var byJob = {};
    ended.forEach(function (s) { (byJob[s.jobCardId] = byJob[s.jobCardId] || []).push(s); });
    var jobs = Object.keys(byJob);
    return '<div class="ct-page"><div class="ct-h1">History<span>' + ended.length + ' days ended</span></div>' +
      (jobs.length ? jobs.map(function (jid) {
        var ss = byJob[jid], open = S.historyJob === jid;
        var hrs = ss.reduce(function (a, s) { return a + (s.hours || 0) * s.present.length; }, 0);
        var photos = safe(function () { return getJobPhotos(jid); }, []);
        return '<section class="ct-card"><button class="ct-sess-h as-btn" data-a="hist" data-j="' + esc(jid) + '"><span class="ct-sess-crew">' + esc(jobLabel(jid)) + '</span><span class="ct-pill t-plain">' + ss.length + ' day' + (ss.length === 1 ? '' : 's') + ' · ' + hrs + ' man-h</span></button>' +
          (open ? ss.map(function (s) {
            return '<div class="ct-hist-r"><b>' + esc(s.date + ' · ' + s.crewName) + '</b><i>' + esc(s.hours + ' h × ' + s.present.length + ' · ' + s.activity + (s.progressPct !== null && s.progressPct !== undefined ? ' · ' + s.progressPct + '%' : '') + (s.note ? ' · ' + s.note : '')) + '</i>' +
              (s.pauses.length ? '<i>' + esc(s.pauses.map(function (p) { return p.reason + ' ' + hm(p.at) + '–' + hm(p.resumedAt); }).join(' · ')) + '</i>' : '') + '</div>';
          }).join('') + (photos.length ? '<div class="ct-thumbs">' + photos.map(function (p) { return '<span class="ct-thumb"><img src="' + esc(p.url) + '" alt="" title="' + esc(p.date + (p.note ? ' — ' + p.note : '')) + '"></span>'; }).join('') + '</div>' : '') : '') +
          '</section>';
      }).join('') : '<div class="ct-empty">No days ended yet.</div>') + '</div>';
  }

  /* ── render / tick / events ────────────────────────────────────────── */
  function render() {
    return S.view === 'start' ? startHTML() : S.view === 'run' ? runHTML() : S.view === 'end' ? endHTML()
      : S.view === 'crews' ? crewsHTML() : S.view === 'newcrew' ? newcrewHTML() : S.view === 'history' ? historyHTML() : todayHTML();
  }
  function railId() { return S.view === 'start' ? 'ct-start' : S.view === 'crews' || S.view === 'newcrew' ? 'ct-crews' : S.view === 'history' ? 'ct-history' : 'ct-today'; }
  function paint() {
    if (root) root.innerHTML = render();
    ctSafeTop(function () { execMarkActive(railId()); }, null);
    startTick();
  }
  // The clock face updates every second WITHOUT repainting the page —
  // repainting would wipe the pause chips and the note being typed.
  function startTick() {
    stopTick();
    tick = setInterval(function () {
      if (!root) return;
      root.querySelectorAll('[data-sess]').forEach(function (el) {
        var s = safe(function () { return crewSessions.find(function (x) { return x.id === el.getAttribute('data-sess'); }); }, null);
        if (s) el.textContent = hhmmss(safe(function () { return sessionElapsedHours(s); }, 0));
      });
    }, 1000);
  }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }

  function applyPreset(p) {
    if (!p) return;
    var all = safe(function () { return timerCrewsAll(); }, []);
    var crew = p.dept ? all.find(function (c) { return c.dept === p.dept; }) : null;
    if (crew) { S.crewId = crew.id; S.present = crew.members.slice(); }
    if (p.jobId) S.jobId = p.jobId;
    if (p.lineId !== null && p.lineId !== undefined) S.lineIds = [Number(p.lineId)];
    S.activity = p.dept === 'install' || p.dept === 'curt' ? 'installation' : 'production';
    S.view = 'start';
  }
  function onChange(e) {
    var t = e.target;
    if (!t || !root.contains(t)) return;
    if (t.id === 'ct-job') { S.jobId = t.value || null; S.lineIds = []; paint(); return; }
    if (t.id === 'ct-note') { S.note = t.value; return; }
    if (t.id === 'ct-nc-name' && S.newcrew) { S.newcrew.name = t.value; return; }
    if (t.getAttribute('data-a') === 'photo') {
      var files = Array.prototype.slice.call(t.files || []);
      var s = crewSessions.find(function (x) { return x.id === S.sessionId; });
      Promise.all(files.map(function (f) { return uploadProgressPhoto(f, s ? s.jobCardId : null); })).then(function (rs) {
        rs.forEach(function (r) { if (r && r.url) S.photos.push({ url: r.url }); else if (r && r.error) toast(r.error); });
        var note = document.getElementById('ct-note'); if (note) S.note = note.value;
        paint();
      });
      t.value = '';
    }
  }
  function onClick(e) {
    var el = e.target.closest('[data-a]');
    if (!el || !root.contains(el)) return;
    var a = el.getAttribute('data-a');
    if (a === 'go') { go(el.getAttribute('data-v')); return; }
    if (a === 'pick-crew') {
      var c = safe(function () { return timerCrew(el.getAttribute('data-c')); }, null);
      S.crewId = c ? c.id : null; S.present = c ? c.members.slice() : []; S.jobId = null; S.lineIds = [];
      S.activity = c && (c.dept === 'install' || c.dept === 'curt') ? 'installation' : 'production';
      paint(); return;
    }
    if (a === 'tick-man') {
      var n = el.getAttribute('data-n'); S.present = S.present || [];
      var i = S.present.indexOf(n); if (i === -1) S.present.push(n); else S.present.splice(i, 1);
      paint(); return;
    }
    if (a === 'tick-line') {
      var l = Number(el.getAttribute('data-l')); var j = S.lineIds.indexOf(l);
      if (j === -1) S.lineIds.push(l); else S.lineIds.splice(j, 1);
      paint(); return;
    }
    if (a === 'activity') { S.activity = el.getAttribute('data-v'); paint(); return; }
    if (a === 'start') {
      var r = safe(function () { return startCrewSession({ crewId: S.crewId, jobCardId: S.jobId, lineIds: S.lineIds, present: S.present, activity: S.activity, leadName: ctIdentity(), byWhom: ctIdentity() }); }, { error: 'Could not start.' });
      if (r && r.error) { toast(r.error); return; }
      S.sessionId = r.id; S.view = 'run'; S.pauseOpen = false; paint(); return;
    }
    if (a === 'open-run') { S.sessionId = el.getAttribute('data-s'); S.view = 'run'; S.pauseOpen = true; paint(); return; }
    if (a === 'pause-open') { S.pauseOpen = true; paint(); return; }
    if (a === 'pause-cancel') { S.pauseOpen = false; paint(); return; }
    if (a === 'pause') {
      var pr = safe(function () { return pauseCrewSession(S.sessionId, el.getAttribute('data-r')); }, { error: 'Could not pause.' });
      if (pr && pr.error) toast(pr.error);
      S.pauseOpen = false; paint(); return;
    }
    if (a === 'resume') {
      var rr = safe(function () { return resumeCrewSession(el.getAttribute('data-s') || S.sessionId); }, { error: 'Could not resume.' });
      if (rr && rr.error) toast(rr.error); else if (el.getAttribute('data-s')) S.sessionId = el.getAttribute('data-s');
      if (S.view !== 'run' && S.view !== 'today') S.view = 'run';
      paint(); return;
    }
    if (a === 'open-end') { S.sessionId = el.getAttribute('data-s') || S.sessionId; S.view = 'end'; S.progress = null; S.photos = []; S.note = ''; paint(); return; }
    if (a === 'progress') { S.progress = Number(el.getAttribute('data-p')); var nt = document.getElementById('ct-note'); if (nt) S.note = nt.value; paint(); return; }
    if (a === 'photo-del') { S.photos.splice(Number(el.getAttribute('data-i')), 1); paint(); return; }
    if (a === 'end') {
      var nt2 = document.getElementById('ct-note'); if (nt2) S.note = nt2.value;
      var s = crewSessions.find(function (x) { return x.id === S.sessionId; });
      var er = safe(function () { return endCrewSession(S.sessionId, { progressPct: S.progress, note: S.note, byWhom: ctIdentity() }); }, { error: 'Could not end the day.' });
      if (er && er.error) { toast(er.error); return; }
      S.photos.forEach(function (p) { safe(function () { return addProgressPhoto({ sessionId: s.id, jobCardId: s.jobCardId, lineId: s.lineIds[0] === undefined ? null : s.lineIds[0], url: p.url, note: S.note, by: ctIdentity() }); }, null); });
      toast(er.hours + ' h logged for ' + er.present.length + (er.present.length === 1 ? ' man' : ' men') + (S.photos.length ? ' · ' + S.photos.length + ' photo' + (S.photos.length === 1 ? '' : 's') : '') + '.');
      S.photos = []; S.note = ''; S.progress = null; S.sessionId = null; S.view = 'today'; paint(); return;
    }
    if (a === 'nc-dept') { S.newcrew.dept = el.getAttribute('data-v'); S.newcrew.members = []; S.newcrew.lead = ''; var nm = document.getElementById('ct-nc-name'); if (nm) S.newcrew.name = nm.value; paint(); return; }
    if (a === 'nc-tick') {
      var nn = el.getAttribute('data-n'), N = S.newcrew; var nm2 = document.getElementById('ct-nc-name'); if (nm2) N.name = nm2.value;
      var k = N.members.indexOf(nn);
      if (k === -1) N.members.push(nn); else if (N.lead !== nn) N.lead = nn; else { N.members.splice(k, 1); N.lead = N.members[0] || ''; }
      paint(); return;
    }
    if (a === 'nc-save') {
      var nm3 = document.getElementById('ct-nc-name'); if (nm3) S.newcrew.name = nm3.value;
      var cr = safe(function () { return createTimerCrew({ name: S.newcrew.name, dept: S.newcrew.dept, members: S.newcrew.members, lead: S.newcrew.lead || null, byWhom: ctIdentity() }); }, { error: 'Could not save it.' });
      if (cr && cr.error) { toast(cr.error); return; }
      toast(cr.name + ' saved — ' + cr.members.length + (cr.members.length === 1 ? ' man' : ' men') + '.');
      S.newcrew = null; S.view = 'crews'; paint(); return;
    }
    if (a === 'crew-add') { var sel = document.getElementById('ct-add-' + el.getAttribute('data-c')); var ar = safe(function () { return addTimerCrewMember(el.getAttribute('data-c'), sel.value); }, { error: 'Could not add.' }); if (ar && ar.error) toast(ar.error); paint(); return; }
    if (a === 'crew-rm') { safe(function () { return removeTimerCrewMember(el.getAttribute('data-c'), el.getAttribute('data-n')); }, null); paint(); return; }
    if (a === 'hist') { var jj = el.getAttribute('data-j'); S.historyJob = S.historyJob === jj ? null : jj; paint(); return; }
  }
  function go(view) {
    S.view = view;
    if (view === 'start') { S.pauseOpen = false; }
    if (view === 'newcrew') S.newcrew = null;
    paint();
  }
  function mount(el) {
    root = el; root.classList.add('ct');
    root.removeEventListener('click', onClick); root.addEventListener('click', onClick);
    root.removeEventListener('change', onChange); root.addEventListener('change', onChange);
    if (typeof registerLiveUpdate === 'function') {
      registerLiveUpdate(function () {
        var w = document.getElementById('timer-module-wrap');
        if (!w || getComputedStyle(w).display === 'none') return;
        if (S.view === 'today' || S.view === 'history' || S.view === 'crews') paint();
      });
    }
    paint();
  }
  return {
    mount: mount, paint: paint, go: go, state: S, stopTick: stopTick,
    reset: function (preset) { S.view = 'today'; S.crewId = null; S.present = null; S.jobId = null; S.lineIds = []; S.sessionId = null; S.pauseOpen = false; S.photos = []; S.note = ''; S.progress = null; S.newcrew = null; applyPreset(preset); }
  };
})();
