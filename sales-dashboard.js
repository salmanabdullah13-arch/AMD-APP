/* ==========================================================================
   AMD-APP · Sales dashboard
   Vanilla JS, template strings, no build step, no libraries.

       salesWrap.innerHTML = SalesDashboard.render();
       SalesDashboard.mount(salesWrap);

   ⚠ THE RULE THAT SHAPES THIS FILE
   Sales must never see price, cost, or supplier/vendor names — anywhere,
   including summaries, job cards and chat. There is deliberately NO currency
   formatting helper in this file and no field that could carry a value.
   If you add a data source, check it cannot leak one. See README.
   ========================================================================== */

window.SalesDashboard = (function () {
  'use strict';

  /* ---------------------------------------------------------------- data --
     Live, and scoped to the LOGGED-IN salesperson — the handoff lists
     "per-salesperson scope exists but is never surfaced" as a bug in the
     current build, so every source below is filtered by whose book it is.

     Every field here is a count, a stage, a date or a name. There is no
     currency helper in this file and no field that could carry one. If you
     add a source, check it against that before it ships.                    */

  var DATA = {};

  function safe(fn, fallback) { try { var v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }
  function ddmmm(isoStr) {
    if (!isoStr) return '—';
    var d = new Date(isoStr + 'T00:00:00');
    if (isNaN(d)) return String(isoStr);
    var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return String(d.getDate()).padStart(2,'0') + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
  }
  function daysAgo(isoStr) {
    if (!isoStr) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(isoStr + 'T00:00:00').getTime()) / 864e5));
  }
  function ageWords(isoStr) {
    var n = daysAgo(isoStr);
    return n === 0 ? 'today' : n === 1 ? '1 day' : n + ' days';
  }

  /* Whose book this is. A real cloud session is authoritative; the module's
     own simulated identity is the fallback the rest of Sales already uses. */
  function me() {
    // One resolver, in sales.js, so this screen and the rest of the module
    // can never disagree about who is looking at it.
    if (typeof salesIdentity === 'function') return salesIdentity();
    if (typeof window !== 'undefined' && window.__realCloudSession && window.cloudIdentity) return window.cloudIdentity;
    return typeof salesCurrentUser !== 'undefined' ? salesCurrentUser : 'Sales';
  }

  /* An enquiry belongs to me if I'm its salesperson; a quotation through its
     enquiry; a job through its quotation. Same trace getSalesPersonJobs() uses. */
  function myEnquiries() {
    var who = me();
    return (typeof enquiries !== 'undefined' ? enquiries : []).filter(function (e) { return e.salesPerson === who; });
  }
  function enquiryOf(qtn) {
    if (!qtn || !qtn.enquiryId) return null;
    return (typeof enquiries !== 'undefined' ? enquiries : []).filter(function (e) { return e.id === qtn.enquiryId; })[0] || null;
  }
  function myQuotations() {
    var who = me();
    return (typeof quotations !== 'undefined' ? quotations : []).filter(function (q) {
      var e = enquiryOf(q);
      return e && e.salesPerson === who;
    });
  }
  function myJobs() {
    // Deliberately NOT getSalesPersonJobs(): that helper returns a projection
    // carrying job.amount — money, which must never reach this screen — and
    // it drops items/promisedDate/routingConfirmed, which the production card
    // needs. Same trace it uses (job → quotation → enquiry.salesPerson), on
    // the real job cards, reading only value-free fields.
    var who = me();
    return (typeof jobCards !== 'undefined' ? jobCards : []).filter(function (j) {
      if (j.status === 'cancelled') return false;
      var q = (typeof quotations !== 'undefined' ? quotations : []).filter(function (x) { return x.id === j.quotationId; })[0];
      var e = q ? enquiryOf(q) : null;
      return e && e.salesPerson === who;
    });
  }
  function clientName(id) {
    var c = (typeof customers !== 'undefined' ? customers : []).filter(function (x) { return x.id === id; })[0];
    return c ? c.name : '—';
  }

  /* --- production mapping -------------------------------------------------
     The handoff's six-segment bar (Cutting list → Machining → Assembly →
     Finishing → QC → Ready) is mapped onto the app's REAL per-line pipeline
     rather than invented: departmentStatuses[].status plus Joinery's own
     sub-stage, and progressPct for the percentage. A line in rework is the
     hold state, and its rejectReason — written by the manager who failed the
     QC — is the hold reason the handoff asks for ("must be a real field a
     department manager writes, not free text bolted on later").             */
  var STAGE_OF = {
    'queued': 0,
    'drafting': 0, 'cutting': 1, 'veneer-pressing': 2, 'assembly': 2,
    'in-production': 1,
    'ready-for-handoff': 3,
    'qc': 4,
    'done': 5
  };
  function lineStep(entry) {
    if (!entry) return 0;
    if (entry.status === 'rework') return 2;
    if (entry.status === 'in-production' && entry.joinerySubStage) {
      return STAGE_OF[entry.joinerySubStage] === undefined ? 1 : STAGE_OF[entry.joinerySubStage];
    }
    return STAGE_OF[entry.status] === undefined ? 0 : STAGE_OF[entry.status];
  }
  function lineStageName(entry) {
    if (!entry) return 'Not started';
    if (entry.status === 'rework') return 'On hold';
    if (entry.status === 'done') return 'Ready';
    if (entry.status === 'qc') return 'QC';
    if (entry.status === 'ready-for-handoff') return 'Finishing';
    if (entry.status === 'queued' || entry.status === 'pending') return 'Not started';
    return DATA.productionStages[lineStep(entry)] || 'In production';
  }
  function linePct(entry) {
    if (!entry) return 0;
    if (entry.status === 'done') return 100;
    if (typeof entry.progressPct === 'number' && entry.progressPct) return entry.progressPct;
    return Math.round(lineStep(entry) / 5 * 100);
  }
  /* A line's own department entry — the furthest-along one, since a line can
     be routed through more than one department in sequence. */
  function activeEntry(item) {
    var ds = (item && item.departmentStatuses) || [];
    if (!ds.length) return null;
    var rework = ds.filter(function (d) { return d.status === 'rework'; })[0];
    if (rework) return rework;
    return ds.slice().sort(function (a, b) { return lineStep(b) - lineStep(a); })[0];
  }

  function buildData() {
    var who = me();
    var qtns = myQuotations();
    var enqs = myEnquiries();
    var jobs = myJobs();
    var today = todayISO();

    DATA.productionStages = ['Cutting list','Machining','Assembly','Finishing','QC','Ready'];

    DATA.me = { name: who, role: 'Sales', initials: who.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() };
    DATA.today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

    /* stage buckets, from the app's real quotation stage + lifecycle */
    function stageOf(q) {
      if (q.lifecycleStatus === 'confirmed') return 'confirmed';
      if (q.stage === 'estimator') return 'estimator';
      if (q.stage === 'approver') return 'approver';
      if (q.lifecycleStatus === 'open') return 'sent';       // approved, with the client
      return 'action';                                        // sitting with me
    }
    /* "Returned by the Estimator" is a real event in the audit trail: the
       quote went to the estimator and came back to sales. */
    function returnedByEstimator(q) {
      var log = q.auditLog || [];
      return q.stage === 'sales' && log.some(function (a) {
        return /estimator/i.test(a.action || '') || /estimator/i.test(a.detail || '');
      });
    }

    var unallocated = enqs.filter(function (e) { return !e.salesPerson || e.status === 'unallocated'; }).length;
    var needsMe = qtns.filter(function (q) { return stageOf(q) === 'action'; }).length;

    DATA.counts = {
      enquiries: enqs.length,
      unallocated: unallocated,
      quotations: qtns.length,
      needsMe: needsMe,
      jobs: jobs.length,
      unread: safe(function () { return getUnreadCountFor(who); }, 0)
    };

    DATA.quickActions = [
      { k:'enquiry',   ic:'＋', t:'New enquiry',      m:'Start a customer enquiry' },
      { k:'quotation', ic:'◈', t:'New quotation',    m:'Quote against an enquiry', n: enqs.filter(function (e) { return !e.quotationId; }).length || '' },
      { k:'jobs',      ic:'▥', t:'My jobs',          m:'Jobs from my confirmed quotes', n: jobs.length || '' },
      { k:'pr',        ic:'▣', t:'Purchase request', m:'Request materials for a job' }
    ];

    /* Steps with nothing waiting collapse to one muted line so the sequence
       stays visible — do not hide them. */
    var returned = qtns.filter(returnedByEstimator);
    var expiring = qtns.filter(function (q) { return stageOf(q) === 'sent' && daysAgo(q.date) >= 25; });
    var readyToConfirm = jobs.filter(function (j) { return !j.promisedDate && j.status === 'open'; });
    var awaitingClient = qtns.filter(function (q) { return stageOf(q) === 'sent'; });

    DATA.queue = [
      { k:'ret',   n: returned.length,       t:'Returned by the Estimator',        m: returned.length ? 'Re-check specification before re-submitting' : 'Nothing waiting', tone:'bad' },
      { k:'exp',   n: expiring.length,       t:'Quotations ageing with the client', m: expiring.length ? 'Open over 25 days' : 'Nothing waiting', tone:'warn' },
      { k:'un',    n: unallocated,           t:'Unallocated enquiries',            m: unallocated ? 'Assign a salesperson' : 'Nothing waiting', tone:'warn' },
      { k:'appr',  n: awaitingClient.length, t:'Client approvals',                 m: awaitingClient.length ? 'Approved and sent — chase the client' : 'Nothing waiting', tone:'' },
      { k:'sched', n: readyToConfirm.length, t:'Ready to confirm a delivery date', m: readyToConfirm.length ? 'No promised date set yet' : 'Nothing waiting', tone:'wine' }
    ];

    DATA.stages = {
      action:    { label:'Needs me',       tone:'bad' },
      estimator: { label:'With Estimator', tone:'' },
      approver:  { label:'With Approver',  tone:'warn' },
      sent:      { label:'With client',    tone:'' },
      confirmed: { label:'Confirmed',      tone:'ok' }
    };
    DATA.stageFilters = [
      { k:'all', l:'All' }, { k:'action', l:'Needs me' },
      { k:'estimator', l:'With Estimator' }, { k:'approver', l:'With Approver' },
      { k:'sent', l:'With client' }
    ];

    DATA.quotations = qtns.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
      .map(function (q) {
        var e = enquiryOf(q);
        return {
          id: q.id, client: clientName(q.customerId), project: q.projectName || '—',
          stage: stageOf(q),
          age: q.lifecycleStatus === 'confirmed' ? 'confirmed ' + ddmmm(q.confirmDate) : ageWords(q.date),
          division: (e && e.division) || '—',
          why: returnedByEstimator(q) ? 'Returned by Estimator' : ''
        };
      });

    /* Counts, not value — conversion is how many move, not what they're worth. */
    var confirmed = qtns.filter(function (q) { return q.lifecycleStatus === 'confirmed'; }).length;
    var delivered = jobs.filter(function (j) {
      return (j.items || []).length && (j.items || []).every(function (it) { return (it.deliveredQty || 0) >= it.qty; });
    }).length;
    var band = Math.max(enqs.length, qtns.length, confirmed, delivered, 1);
    function w(n) { return Math.max(24, Math.round(n / band * 100)); }
    DATA.pipeline = [
      { label:'Enquiry · ' + enqs.length,   w: w(enqs.length),  c:'var(--wine)',      fg:'#fff' },
      { label:'Quotation · ' + qtns.length, w: w(qtns.length),  c:'var(--wine2)',     fg:'#fff' },
      { label:'Confirmed · ' + confirmed,   w: w(confirmed),    c:'var(--wine3)',     fg:'#fff' },
      { label:'Delivered · ' + delivered,   w: w(delivered),    c:'var(--wine-line)', fg:'var(--wine)' }
    ];

    DATA.jobs = jobs.map(function (j) {
      var items = (j.items || []).map(function (it) {
        var entry = activeEntry(it);
        return { n: it.product || it.name || '—', q: it.qty || 1, pct: linePct(entry), st: lineStageName(entry), _entry: entry };
      });
      var held = items.filter(function (i) { return i.st === 'On hold'; });
      var steps = items.map(function (i) { return DATA.productionStages.indexOf(i.st === 'On hold' ? 'Assembly' : i.st); });
      var step = steps.length ? Math.min.apply(null, steps.map(function (s) { return s < 0 ? 0 : s; })) : 0;
      var pct = items.length ? Math.round(items.reduce(function (s, i) { return s + i.pct; }, 0) / items.length) : 0;
      var holdEntry = held.length ? held[0]._entry : null;
      var dept = (j.items || []).reduce(function (acc, it) {
        (it.departmentSequence || []).forEach(function (d) { if (acc.indexOf(d) === -1) acc.push(d); });
        return acc;
      }, []).map(function (d) { return safe(function () { return dc(d).n; }, d); }).join(' · ') || '—';
      var c = (typeof customers !== 'undefined' ? customers : []).filter(function (x) { return x.id === j.customerId; })[0];
      return {
        id: j.id, client: clientName(j.customerId), project: j.projectName || '—', dept: dept,
        status: held.length ? 'On hold' : pct >= 100 ? 'Ready to deliver' : !j.routingConfirmed ? 'Awaiting routing' : 'In production',
        due: j.promisedDate ? ddmmm(j.promisedDate) : 'no date set',
        pct: pct, step: step, hold: held.length > 0,
        holdWhy: holdEntry && holdEntry.rejectReason
          ? holdEntry.rejectReason
          : (held.length ? 'Failed QC and is back in rework — no reason was recorded.' : ''),
        contact: (c && c.contactPerson ? c.contactPerson : '—') + (c && c.tel ? ' · ' + c.tel : ''),
        note: j.urgent ? 'Flagged urgent by Operations.' : '',
        dates: DATA.productionStages.map(function (_, i) { return i <= step ? ddmmm(j.confirmDate || j.date) : '—'; }),
        items: items
      };
    });

    /* Ranked by activity, never by spend. */
    var byClient = {};
    jobs.forEach(function (j) {
      var k = j.customerId; if (!k) return;
      byClient[k] = byClient[k] || { n: clientName(k), jobs: 0, quotes: 0, last: '' };
      byClient[k].jobs++;
      if (String(j.date) > byClient[k].last) byClient[k].last = j.date;
    });
    qtns.forEach(function (q) {
      var k = q.customerId; if (!k) return;
      byClient[k] = byClient[k] || { n: clientName(k), jobs: 0, quotes: 0, last: '' };
      byClient[k].quotes++;
      if (String(q.date) > byClient[k].last) byClient[k].last = q.date;
    });
    DATA.clients = Object.keys(byClient).map(function (k) { return byClient[k]; })
      .sort(function (a, b) { return (b.jobs + b.quotes) - (a.jobs + a.quotes); })
      .slice(0, 5)
      .map(function (c) { return { n: c.n, jobs: c.jobs, quotes: c.quotes, last: ddmmm(c.last), cold: daysAgo(c.last) > 7 }; });

    /* Calendar commitments, keyed by ISO date. No values — safe for this
       role, which is exactly why the planner is reusable here. */
    var evs = safe(function () { return getCalendarEvents(who, 'sales'); }, []);
    var byDate = {};
    evs.forEach(function (e) {
      var tag = e.type === 'task' ? 'Task' : e.type === 'promised' ? 'Promised' : e.type === 'delivery' ? 'Delivery' : 'Diary';
      var tone = e.type === 'promised' ? 'warn' : e.type === 'delivery' ? 'wine' : e.type === 'task' ? '' : 'wine';
      (byDate[e.date] = byDate[e.date] || []).push({
        t: (e.label.match(/^\d{2}:\d{2}/) || [''])[0] || '—',
        ttl: e.label.replace(/^\d{2}:\d{2}\s*/, ''), m: e.ref || '', tag: tag, tone: tone
      });
    });
    DATA.week = byDate;

    DATA.jobPool = jobs.map(function (j) { return j.id; });

    loadTasks();
    S.lists = LISTS.slice();
  }

  /* Sales has its OWN lists — the handoff calls out that a shared task store
     leaks across roles, and the Owner's list carries receivables chasing,
     which is ageing information by another name. Tasks here are the app's
     real tasks[] filtered to this salesperson, so they persist; the list key
     rides the task object, as it does on the Owner dashboard. */
  var LISTS = [
    { k:'enq',  n:'Enquiries',   c:'var(--d1)' },
    { k:'qtn',  n:'Quotations',  c:'var(--d3)' },
    { k:'cli',  n:'Clients',     c:'var(--d2)' },
    { k:'site', n:'Site visits', c:'var(--d4)' }
  ];
  function loadTasks() {
    var today = todayISO();
    var mine = (typeof tasks !== 'undefined' ? tasks : []).filter(function (t) { return t.assignee === me(); });
    S.tasks = mine.map(function (t) {
      return {
        id: t.id, t: t.title, done: t.status === 'done',
        job: t.linkedType === 'job' ? t.linkedId : null,
        list: t.list || 'qtn',
        due: t.dueDate ? ddmmm(t.dueDate) : 'No due date',
        today: !!(t.dueDate && t.dueDate <= today),
        urgent: !!t.urgent
      };
    });
  }
  function appTask(id) { return (typeof tasks !== 'undefined' ? tasks : []).filter(function (t) { return t.id === id; })[0]; }

  /* --------------------------------------------------------------- state -- */

  var S = {
    stage:'all', job:null, qa:false, chat:false,
    tasksOpen:true, weekOpen:true, taskFilter:'all',
    planScope:'Week', planOffset:0, selDate:todayISO(),
    nextTask:41, nextList:1,
    lists:[], tasks:[]
  };

  var root = null;
  function paint(){ if (root) root.innerHTML = render(); }

  /* -------------------------------------------------------------- helpers -- */

  var WD  = ['mon','tue','wed','thu','fri','sat','sun'];
  var WDL = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  var MN  = ['January','February','March','April','May','June','July','August',
             'September','October','November','December'];

  function esc(v){
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function utc(y,m,d){ return new Date(Date.UTC(y,m,d)); }
  function addDays(d,n){ var x=new Date(d); x.setUTCDate(x.getUTCDate()+n); return x; }
  function monday(d){ return addDays(d, -(((d.getUTCDay()+6)%7))); }
  function iso(d){ return localISO(d); }
  function parseIso(s){ return new Date(s+'T00:00:00Z'); }
  function fmtDate(d){
    return String(d.getUTCDate()).padStart(2,'0')+' '+MN[d.getUTCMonth()].slice(0,3)+' '+d.getUTCFullYear();
  }
  /* Keyed by ISO date now that this reads real dated events. */
  function agendaFor(d){ return DATA.week[iso(d)] || []; }
  function todayIso(){ return todayISO(); }
  function toneCls(t){ return t ? ' is-'+t : ''; }

  /* ------------------------------------------------------------- renderers -- */

  function topbar(){
    var c = DATA.counts;
    return '<div class="sd-top">' +
      '<div style="display:flex;align-items:center;gap:8px;flex:1">' +
        '<button class="sd-icon" data-act="menu" aria-label="Menu" style="width:38px;height:38px">☰</button>' +
        '<button class="sd-qa" data-act="qa"><span style="font-size:15px;line-height:1">＋</span>Quick actions</button>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:9px">' +
        '<button class="sd-icon" data-act="theme" aria-label="Theme">◐</button>' +
        '<button class="sd-icon sd-bell" data-act="reminders" aria-label="Reminders">🔔' +
          '<span class="sd-badge">' + c.unread + '</span></button>' +
      '</div>' +
    '</div>';
  }

  function title(){
    return '<div style="flex:none;padding:18px 24px 0">' +
      '<div style="font-size:21px;font-weight:650;letter-spacing:-.015em;color:var(--tx)">My book</div>' +
      '<div style="font-size:12px;color:var(--tx3);margin-top:3px">' +
        esc(DATA.me.name) + ' · ' + esc(DATA.today) + ' · ' + DATA.counts.needsMe + ' need you</div>' +
    '</div>';
  }

  function queueCard(){
    return '<section class="sd-clip sd-span2">' +
      '<div style="padding:14px 16px;border-bottom:1px solid var(--line2)" class="sd-title">Needs you today</div>' +
      DATA.queue.map(function(q){
        if (!q.n) {
          return '<div class="sd-q is-empty"><span class="sd-q-n" style="text-align:center;color:var(--tx3);font-size:14px">—</span>' +
            '<span style="flex:1;font-size:12.5px;color:var(--tx3)">' + esc(q.t) + ' · ' + esc(q.m) + '</span></div>';
        }
        return '<div class="sd-q' + toneCls(q.tone) + '" data-act="queue" data-k="' + q.k + '">' +
          '<span class="sd-q-n">' + q.n + '</span>' +
          '<span style="flex:1;min-width:0"><span class="sd-q-t">' + esc(q.t) + '</span>' +
          '<span class="sd-q-m">' + esc(q.m) + '</span></span>' +
          '<span style="flex:none;color:var(--tx3);font-size:15px">›</span></div>';
      }).join('') +
    '</section>';
  }

  function quotationsCard(){
    var chips = DATA.stageFilters.map(function(f){
      return '<button role="tab" aria-selected="' + (S.stage===f.k) + '" data-act="stage" data-v="' + f.k + '">' +
        esc(f.l) + '</button>';
    }).join('');

    var rows = DATA.quotations.filter(function(q){
      return S.stage === 'all' || q.stage === S.stage;
    }).map(function(q){
      var st = DATA.stages[q.stage];
      return '<button class="sd-row' + (st.tone === 'bad' ? ' is-bad' : '') + '" data-act="quote" data-id="' + q.id + '">' +
        '<span style="flex:1;min-width:0">' +
          '<span style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">' +
            '<span class="sd-id">' + esc(q.id) + '</span>' +
            '<span class="sd-pill' + toneCls(st.tone) + '">' + esc(st.label) + '</span>' +
            '<span class="sd-micro">' + esc(q.age) + '</span>' +
          '</span>' +
          '<span class="sd-meta">' + esc(q.client) + ' · ' + esc(q.project) + '</span>' +
          '<span class="sd-micro" style="display:block;margin-top:3px">' + esc(q.division) + '</span>' +
          (q.why ? '<span class="sd-why">' + esc(q.why) + '</span>' : '') +
        '</span>' +
        '<span style="flex:none;color:var(--tx3);font-size:15px;align-self:center">›</span>' +
      '</button>';
    }).join('');

    return '<section class="sd-card sd-span2">' +
      '<div class="sd-title">My quotations</div>' +
      '<div class="sd-sub" style="margin-bottom:11px">Stage and age — no values shown</div>' +
      '<div class="sd-chips" role="tablist" style="margin-bottom:11px">' + chips + '</div>' +
      '<div class="sd-scroll">' + rows + '</div>' +
    '</section>';
  }

  function productionCard(){
    var held = DATA.jobs.filter(function(j){ return j.hold; });
    var banner = held.length
      ? '<div class="sd-hold"><span style="flex:none;font-size:14px;color:var(--bad);line-height:1.2">‼</span>' +
        '<span style="flex:1;min-width:0"><span class="sd-hold-t">' + held.length +
        ' job on hold — ' + esc(held[0].id) + '</span>' +
        '<span class="sd-hold-m">' + esc(held[0].holdWhy) + '</span></span></div>'
      : '';

    var rows = DATA.jobs.map(function(j){
      var segs = DATA.productionStages.map(function(_, i){
        var cls = j.hold && i === j.step ? ' is-hold' : i < j.step ? ' is-done' : i === j.step ? ' is-now' : '';
        return '<i class="' + cls.trim() + '"></i>';
      }).join('');
      var pill = j.hold ? 'is-bad' : j.pct >= 95 ? 'is-ok' : '';
      return '<button class="sd-job" data-act="job" data-id="' + j.id + '">' +
        '<span style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
          '<span class="sd-id">' + esc(j.id) + '</span>' +
          '<span class="sd-pill ' + pill + '">' + esc(j.status) + '</span>' +
          '<span style="flex:1"></span>' +
          '<span class="sd-pct' + (j.hold ? ' is-hold' : '') + '">' + j.pct + '%</span>' +
        '</span>' +
        '<span class="sd-segs">' + segs + '</span>' +
        '<span style="display:flex;justify-content:space-between;margin-top:5px">' +
          '<span class="sd-micro">' + esc(j.client) + ' · ' + esc(j.dept) + '</span>' +
          '<span class="sd-micro">due ' + esc(j.due) + '</span>' +
        '</span>' +
      '</button>';
    }).join('');

    return '<section class="sd-card sd-span2">' +
      '<div class="sd-title">Production status</div>' +
      '<div class="sd-sub" style="margin-bottom:11px">How far along your jobs actually are</div>' +
      banner +
      '<div style="display:flex;flex-direction:column;gap:13px">' + rows + '</div>' +
      '<div class="sd-legend">' +
        '<span><i style="background:var(--wine)"></i>Done</span>' +
        '<span><i style="background:var(--wine3)"></i>In progress</span>' +
        '<span><i style="background:var(--bad)"></i>On hold</span>' +
        '<span><i style="background:var(--line2)"></i>Not started</span>' +
      '</div>' +
    '</section>';
  }

  function pipelineCard(){
    return '<section class="sd-card">' +
      '<div class="sd-title" style="margin-bottom:11px">My pipeline</div>' +
      '<div style="display:flex;flex-direction:column;gap:7px">' + DATA.pipeline.map(function(p){
        return '<div style="width:' + p.w + '%;height:24px;border-radius:6px;background:' + p.c +
          ';display:flex;align-items:center;padding:0 8px;color:' + p.fg +
          ';font-size:11px;font-weight:600">' + esc(p.label) + '</div>';
      }).join('') + '</div>' +
      '<div style="margin-top:11px;padding-top:10px;border-top:1px solid var(--line2);font-size:11px;color:var(--tx3);line-height:1.5">' +
        'Counts, not value — conversion is measured on how many move.</div>' +
    '</section>';
  }

  function clientsCard(){
    return '<section class="sd-card">' +
      '<div class="sd-title">My clients</div>' +
      '<div class="sd-sub" style="margin-bottom:11px">By activity, not spend</div>' +
      DATA.clients.map(function(c){
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line2)">' +
          '<span style="flex:1;min-width:0"><span style="display:block;font-size:12px;font-weight:600;color:var(--tx)">' + esc(c.n) + '</span>' +
          '<span style="display:block;font-size:10px;color:var(--tx3);margin-top:2px">' + c.jobs + ' jobs · ' + c.quotes + ' quotes</span></span>' +
          '<span style="flex:none;font-size:10.5px;font-weight:600;color:' + (c.cold ? 'var(--warn)' : 'var(--tx3)') + '">' + esc(c.last) + '</span>' +
        '</div>';
      }).join('') +
    '</section>';
  }

  function policyCard(){
    return '<section class="sd-card sd-span2" style="border-style:dashed;background:var(--sunk)">' +
      '<div style="font-size:12px;font-weight:700;color:var(--tx2);margin-bottom:5px">Why there are no values on this dashboard</div>' +
      '<div style="font-size:11.5px;color:var(--tx3);line-height:1.55;max-width:520px">' +
        'Prices, costs and supplier names are hidden from Sales by company policy. Everything here is counts, ' +
        'stages and dates. Ask Operations or Accounts if you need a figure for a client conversation.</div>' +
    '</section>';
  }

  /* --- week planner (identical behaviour to the Owner dashboard) ---------- */

  function calendar(){
    var cells = [], i, d;
    function cell(date, inMonth){
      var has = agendaFor(date).length, isSel = iso(date) === S.selDate;
      return '<button class="sd-day' + (inMonth ? '' : ' is-out') + '" role="tab"' +
        ' aria-selected="' + isSel + '" data-act="day" data-d="' + iso(date) + '"' +
        ' style="flex:1;min-width:0;padding:7px 0 6px;border-radius:9px;cursor:pointer;text-align:center;' +
        (isSel ? 'border:1px solid var(--wine);background:var(--wine);color:#fff'
               : 'border:1px solid ' + (inMonth ? 'var(--line)' : 'transparent') +
                 ';background:' + (inMonth ? 'var(--card)' : 'transparent') +
                 ';color:' + (inMonth ? 'var(--tx2)' : 'var(--tx3)') + ';opacity:' + (inMonth ? 1 : .45)) + '">' +
        (S.planScope === 'Week' ? '<span style="display:block;font-size:9.5px;font-weight:600;opacity:.8">' + WDL[(date.getUTCDay()+6)%7] + '</span>' : '') +
        '<span style="display:block;font-size:13px;font-weight:650;margin-top:1px">' + String(date.getUTCDate()).padStart(2,'0') + '</span>' +
        '<i style="display:block;width:5px;height:5px;border-radius:99px;margin:3px auto 0;background:' +
          (has && inMonth ? (isSel ? '#fff' : 'var(--wine)') : 'transparent') + '"></i>' +
      '</button>';
    }
    if (S.planScope === 'Week') {
      var start = addDays(monday(parseIso(todayIso())), S.planOffset*7), count = 0;
      for (i=0;i<7;i++){ d = addDays(start,i); cells.push(cell(d,true)); count += agendaFor(d).length; }
      return { html:'<div style="display:flex;gap:4px" role="tablist">'+cells.join('')+'</div>',
        label: S.planOffset===0?'This week':S.planOffset===-1?'Last week':S.planOffset===1?'Next week'
             : (S.planOffset<0 ? Math.abs(S.planOffset)+' weeks back' : S.planOffset+' weeks ahead'),
        range: fmtDate(start).slice(0,6)+' – '+fmtDate(addDays(start,6)), count:count };
    }
    var __n = parseIso(todayIso()), first = utc(__n.getUTCFullYear(), __n.getUTCMonth()+S.planOffset, 1), gs = monday(first), cnt = 0;
    for (i=0;i<42;i++){ d = addDays(gs,i);
      var inM = d.getUTCMonth() === first.getUTCMonth();
      cells.push(cell(d,inM)); if (inM) cnt += agendaFor(d).length; }
    return {
      html:'<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:4px">' +
             WDL.map(function(w){ return '<span style="text-align:center;font-size:9.5px;font-weight:700;color:var(--tx3)">'+w.charAt(0)+'</span>'; }).join('') +
           '</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px" role="tablist">'+cells.join('')+'</div>',
      label: MN[first.getUTCMonth()]+' '+first.getUTCFullYear(), range:'', count:cnt };
  }

  function plannerCard(){
    var cal = calendar(), sel = parseIso(S.selDate), items = agendaFor(sel);
    var body = !S.weekOpen ? '' :
      '<div style="margin-top:11px">' +
        '<div style="display:flex;align-items:center;gap:5px;margin-bottom:9px">' +
          '<div class="sd-chips" style="flex-wrap:nowrap">' +
            ['Week','Month'].map(function(k){
              return '<button role="tab" aria-selected="' + (S.planScope===k) + '" data-act="scope" data-v="'+k+'">'+k+'</button>';
            }).join('') + '</div>' +
          '<span style="flex:1"></span>' +
          '<button class="sd-icon" data-act="period" data-v="-1" style="width:26px;height:26px;border-radius:8px">‹</button>' +
          '<button class="sd-icon" data-act="period" data-v="0" style="width:auto;height:26px;padding:0 9px;border-radius:8px;font-size:11px;font-weight:600">Today</button>' +
          '<button class="sd-icon" data-act="period" data-v="1" style="width:26px;height:26px;border-radius:8px">›</button>' +
        '</div>' +
        '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:9px">' +
          '<span style="font-size:12.5px;font-weight:650;color:var(--tx)">' + esc(cal.label) + '</span>' +
          '<span class="sd-micro">' + esc(cal.range) + '</span></div>' +
        cal.html +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin:12px 0 7px">' +
          '<span style="font-size:12px;font-weight:650;color:var(--tx)">' + WDL[(sel.getUTCDay()+6)%7] + ' ' + fmtDate(sel) + '</span>' +
          '<span class="sd-micro">' + items.length + ' scheduled</span></div>' +
        '<div style="max-height:132px;overflow:auto;scrollbar-width:thin">' + (items.length ? items.map(function(a){
          return '<div style="display:flex;gap:9px;padding:7px 0;border-bottom:1px solid var(--line2)">' +
            '<span style="flex:none;width:38px;font-size:11px;font-weight:650;color:var(--tx2);padding-top:1px">' + esc(a.t) + '</span>' +
            '<span style="flex:1;min-width:0"><span style="display:block;font-size:12px;font-weight:600;color:var(--tx);line-height:1.35">' + esc(a.ttl) + '</span>' +
            '<span class="sd-pill' + (a.tone === 'wine' ? '' : toneCls(a.tone)) + '" style="margin-top:4px;display:inline-block' +
              (a.tone === 'wine' ? ';background:var(--wine-tint);color:var(--wine)' : '') + '">' + esc(a.tag) + '</span></span></div>';
        }).join('') : '<div style="padding:16px 0;text-align:center;font-size:11.5px;color:var(--tx3)">Nothing scheduled</div>') + '</div>' +
        '<button class="sd-add" data-act="openplanner" style="display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:10px;padding:8px;border-radius:9px;border:1px dashed var(--wine-line);background:var(--wine-tint);color:var(--wine);font-size:12px;font-weight:600;cursor:pointer">Open planner ›</button>' +
      '</div>';

    return '<section class="sd-card">' +
      '<button data-act="toggleweek" aria-expanded="' + S.weekOpen + '" style="display:flex;width:100%;align-items:center;gap:10px;background:transparent;border:0;padding:0;cursor:pointer;text-align:left">' +
        '<span class="sd-title" style="flex:1">This week</span>' +
        '<span style="flex:none;min-width:22px;height:20px;padding:0 7px;border-radius:999px;background:var(--wine-tint);color:var(--wine);font-size:11px;font-weight:700;line-height:20px;text-align:center">' + cal.count + '</span>' +
        '<span style="flex:none;color:var(--tx3);font-size:12px;width:12px;text-align:center">' + (S.weekOpen ? '⌃' : '⌄') + '</span>' +
      '</button>' + body +
    '</section>';
  }

  /* --- tasks (Apple Reminders model, Sales' own store) ------------------- */

  function taskPasses(t){
    var f = S.taskFilter;
    if (f === 'done')   return t.done;
    if (t.done)         return false;
    if (f === 'all')    return true;
    if (f === 'today')  return !!t.today;
    if (f === 'urgent') return !!t.urgent;
    return t.list === f;
  }

  function tasksCard(){
    var open = S.tasks.filter(function(t){ return !t.done; }).length;
    var tiles = [
      {k:'today', g:'▤', label:'Today',     n:S.tasks.filter(function(t){return !t.done&&t.today;}).length, c:'var(--wine)'},
      {k:'urgent',g:'!!',label:'Urgent',    n:S.tasks.filter(function(t){return !t.done&&t.urgent;}).length,c:'var(--bad)'},
      {k:'all',   g:'▦', label:'All',       n:open,                                                          c:'var(--tx2)'},
      {k:'done',  g:'✓', label:'Completed', n:S.tasks.filter(function(t){return t.done;}).length,             c:'var(--ok)'}
    ].map(function(x){
      var on = S.taskFilter === x.k;
      return '<button data-act="taskfilter" data-v="' + x.k + '" aria-selected="' + on + '"' +
        ' style="display:block;width:100%;text-align:left;padding:9px 10px;border-radius:11px;cursor:pointer;border:1px solid ' +
        (on ? x.c : 'var(--line2)') + ';background:' + (on ? 'var(--sunk)' : 'transparent') + '">' +
        '<span style="display:flex;align-items:center;justify-content:space-between">' +
          '<i style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:' + x.c + ';color:#fff;font-size:10px;font-weight:800">' + x.g + '</i>' +
          '<span style="font-size:17px;font-weight:650;letter-spacing:-.02em;color:' + (on ? x.c : 'var(--tx)') + '">' + x.n + '</span>' +
        '</span><span style="display:block;font-size:10.5px;font-weight:600;color:var(--tx2);margin-top:4px">' + x.label + '</span>' +
      '</button>';
    }).join('');

    var rows = S.tasks.filter(taskPasses).map(function(t){
      var L = S.lists.filter(function(l){ return l.k === t.list; })[0];
      return '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--line2)">' +
        '<button data-act="taskcheck" data-id="' + t.id + '" role="checkbox" aria-checked="' + t.done + '"' +
          ' style="flex:none;width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;' +
          (t.done ? 'border:1px solid var(--wine);background:var(--wine);color:#fff' : 'border:1.5px solid var(--line);background:transparent;color:transparent') + '">' + (t.done?'✓':'') + '</button>' +
        '<span style="flex:1;min-width:0">' +
          '<span style="display:flex;align-items:baseline">' +
            (t.urgent ? '<i style="flex:none;font-size:12px;font-weight:800;color:var(--bad);margin-right:4px">‼</i>' : '') +
            '<span style="display:block;font-size:13px;' + (t.done ? 'color:var(--tx3);text-decoration:line-through' : 'color:var(--tx)') + '">' + esc(t.t) + '</span>' +
          '</span>' +
          '<span style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:5px">' +
            '<button data-act="taskmove" data-id="' + t.id + '" title="Move to next list"' +
              ' style="display:flex;align-items:center;gap:5px;padding:1px 7px 1px 4px;border-radius:999px;border:1px solid var(--line2);background:transparent;color:var(--tx3);font-size:10px;font-weight:600;cursor:pointer">' +
              '<i style="width:7px;height:7px;border-radius:99px;display:block;background:' + (L?L.c:'var(--tx3)') + '"></i>' + esc(L?L.n:'No list') + '</button>' +
            '<span style="font-size:10.5px;font-weight:600;color:' + ((t.today||t.urgent)&&!t.done ? 'var(--bad)' : 'var(--tx3)') + '">' + esc(t.due) + '</span>' +
            (t.job ? '<span style="padding:2px 7px;border-radius:999px;background:var(--wine-tint);color:var(--wine);font-size:10px;font-weight:700">' + esc(t.job) + '</span>'
                   : '<button data-act="tasklink" data-id="' + t.id + '" style="padding:2px 7px;border-radius:999px;border:1px dashed var(--line);background:transparent;color:var(--tx3);font-size:10px;font-weight:600;cursor:pointer">＋ Link job</button>') +
          '</span>' +
        '</span>' +
      '</div>';
    }).join('');

    var lists = S.lists.map(function(l){
      var n = S.tasks.filter(function(t){ return !t.done && t.list === l.k; }).length;
      return '<button data-act="taskfilter" data-v="' + l.k + '" aria-selected="' + (S.taskFilter===l.k) + '"' +
        ' style="display:flex;align-items:center;gap:9px;width:100%;padding:7px 8px;border:0;border-radius:9px;cursor:pointer;text-align:left;background:' +
        (S.taskFilter===l.k ? 'var(--wine-tint)' : 'transparent') + '">' +
        '<i style="flex:none;width:18px;height:18px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;background:' + l.c + '">≡</i>' +
        '<span style="flex:1;min-width:0;font-size:12.5px;color:var(--tx)">' + esc(l.n) + '</span>' +
        '<span style="flex:none;font-size:11.5px;color:var(--tx3);font-weight:600">' + n + '</span>' +
        '<span style="color:var(--tx3);font-size:12px">›</span></button>';
    }).join('');

    var body = !S.tasksOpen ? '' :
      '<div style="margin-top:11px">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px">' + tiles + '</div>' +
        /* Cap is load-bearing: without it the card grows and pushes the grid. */
        '<div style="max-height:184px;overflow:auto;scrollbar-width:thin">' + rows + '</div>' +
        '<button data-act="addtask" style="display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:10px;padding:8px 10px;border-radius:9px;border:1px dashed var(--wine-line);background:var(--wine-tint);color:var(--wine);font-size:12px;font-weight:600;cursor:pointer">＋ Add task</button>' +
        '<div style="margin-top:13px;padding-top:11px;border-top:1px solid var(--line2)">' +
          '<div class="sd-card-h" style="margin-bottom:6px">' +
            '<span style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--tx3);font-weight:700">My lists</span>' +
            '<button data-act="addlist" style="border:0;background:transparent;color:var(--wine);font-size:11px;font-weight:700;cursor:pointer">＋ New list</button>' +
          '</div>' + lists +
        '</div>' +
      '</div>';

    return '<section class="sd-card">' +
      '<button data-act="toggletasks" aria-expanded="' + S.tasksOpen + '" style="display:flex;width:100%;align-items:center;gap:10px;background:transparent;border:0;padding:0;cursor:pointer;text-align:left">' +
        '<span class="sd-title" style="flex:1">My tasks</span>' +
        '<span style="flex:none;min-width:22px;height:20px;padding:0 7px;border-radius:999px;background:var(--wine-tint);color:var(--wine);font-size:11px;font-weight:700;line-height:20px;text-align:center">' + open + '</span>' +
        '<span style="flex:none;color:var(--tx3);font-size:12px;width:12px;text-align:center">' + (S.tasksOpen ? '⌃' : '⌄') + '</span>' +
      '</button>' + body +
    '</section>';
  }

  /* --- overlays ---------------------------------------------------------- */

  function quickActions(){
    if (!S.qa) return '';
    return '<div class="sd-backdrop" data-act="closeqa" style="z-index:26"></div>' +
      '<div class="sd-qa-pop">' +
        '<div style="padding:12px 14px;border-bottom:1px solid var(--line2);display:flex;justify-content:space-between;align-items:center">' +
          '<span class="sd-title">Quick actions</span>' +
          '<button data-act="closeqa" style="width:24px;height:24px;border-radius:7px;border:1px solid var(--line);background:var(--sunk);color:var(--tx2);font-size:11px;cursor:pointer">✕</button></div>' +
        DATA.quickActions.map(function(q){
          return '<div class="sd-qa-row" data-act="qapick" data-k="' + q.k + '">' +
            '<span class="sd-qa-ic">' + q.ic + '</span>' +
            '<span style="flex:1;min-width:0"><span style="display:block;font-size:13px;font-weight:600;color:var(--tx)">' + esc(q.t) + '</span>' +
            '<span style="display:block;font-size:11px;color:var(--tx3);margin-top:1px">' + esc(q.m) + '</span></span>' +
            (q.n ? '<span style="flex:none;min-width:20px;height:19px;padding:0 6px;border-radius:999px;background:var(--bad-bg);color:var(--bad);font-size:10.5px;font-weight:700;line-height:19px;text-align:center">' + q.n + '</span>' : '') +
            '<span style="flex:none;color:var(--tx3);font-size:14px">›</span></div>';
        }).join('') +
      '</div>';
  }

  function jobSheet(){
    if (!S.job) return '';
    var j = DATA.jobs.filter(function(x){ return x.id === S.job; })[0];
    if (!j) return '';
    var ready = j.items.filter(function(i){ return i.pct === 100; }).length;
    var pieces = j.items.reduce(function(n,i){ return n + i.q; }, 0);

    var steps = DATA.productionStages.map(function(n, i){
      var cls = j.hold && i === j.step ? 'is-hold' : i < j.step ? 'is-done' : i === j.step ? 'is-now' : '';
      return '<div class="sd-step' + (i <= j.step ? ' is-reached' : '') + '">' +
        '<i class="' + cls + '"></i>' +
        '<span style="flex:1;min-width:0"><span class="sd-step-n">' + esc(n) + '</span></span>' +
        '<span class="sd-micro">' + esc(j.dates[i]) + '</span></div>';
    }).join('');

    var items = j.items.map(function(i){
      var c = i.st === 'On hold' ? 'var(--bad)' : i.st === 'Ready' ? 'var(--ok)'
            : i.st === 'Not started' ? 'var(--tx3)' : 'var(--wine)';
      var pill = i.st === 'On hold' ? 'is-bad' : i.st === 'Ready' ? 'is-ok' : '';
      return '<div class="sd-item' + (i.st === 'On hold' ? ' is-hold' : '') + '">' +
        '<span style="flex:1;min-width:0">' +
          '<span style="display:flex;align-items:center;gap:7px"><span style="font-size:12.5px;color:var(--tx)">' + esc(i.n) + '</span>' +
          '<span class="sd-micro" style="font-weight:600">×' + i.q + '</span></span>' +
          '<span style="display:flex;align-items:center;gap:8px;margin-top:5px">' +
            '<span class="sd-pill ' + pill + '">' + esc(i.st) + '</span>' +
            '<span class="sd-bar"><i style="width:' + i.pct + '%;background:' + c + '"></i></span>' +
            '<span style="flex:none;width:34px;text-align:right;font-size:11px;font-weight:650;color:' + (i.st === 'On hold' ? 'var(--bad)' : 'var(--tx2)') + '">' + i.pct + '%</span>' +
          '</span>' +
        '</span></div>';
    }).join('');

    return '<div class="sd-backdrop" data-act="closejob"></div>' +
      '<div class="sd-sheet">' +
        '<div class="sd-sheet-h">' +
          '<button data-act="closejob" style="flex:none;width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--sunk);color:var(--tx);font-size:15px;cursor:pointer">✕</button>' +
          '<span style="flex:1;min-width:0"><span style="display:block;font-size:16px;font-weight:650;color:var(--tx);letter-spacing:-.01em">' + esc(j.id) + '</span>' +
          '<span style="display:block;font-size:11.5px;color:var(--tx3);margin-top:2px">' + esc(j.client) + ' · ' + esc(j.project) + '</span></span>' +
        '</div>' +
        '<div class="sd-sheet-b">' +
          (j.hold ? '<div class="sd-hold" style="margin-bottom:0"><span style="flex:none;font-size:14px;color:var(--bad)">‼</span>' +
            '<span style="flex:1;min-width:0"><span class="sd-hold-t">This job is on hold</span>' +
            '<span class="sd-hold-m">' + esc(j.holdWhy) + '</span></span></div>' : '') +
          '<div class="sd-facts">' +
            '<div class="sd-fact"><span class="sd-fact-l">Department</span><span class="sd-fact-v">' + esc(j.dept) + '</span></div>' +
            '<div class="sd-fact"><span class="sd-fact-l">Promised date</span><span class="sd-fact-v">' + esc(j.due) + '</span></div>' +
            '<div class="sd-fact"><span class="sd-fact-l">Stage</span><span class="sd-fact-v">' + esc(j.status) + '</span></div>' +
            '<div class="sd-fact"><span class="sd-fact-l">Complete</span><span class="sd-fact-v">' + j.pct + '%</span></div>' +
          '</div>' +
          '<div class="sd-card"><div class="sd-title" style="margin-bottom:11px">Progress</div>' + steps + '</div>' +
          '<div class="sd-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">' +
              '<span class="sd-title">Items in this job</span>' +
              '<span style="font-size:11px;font-weight:650;color:var(--wine)">' + j.items.length + '</span></div>' +
            '<div class="sd-sub" style="margin-bottom:9px">' + ready + ' of ' + j.items.length + ' ready · ' + pieces + ' pieces</div>' +
            '<div class="sd-scroll">' + items + '</div>' +
          '</div>' +
          '<div class="sd-card"><div class="sd-title" style="margin-bottom:7px">Client contact</div>' +
            '<div style="font-size:12.5px;color:var(--tx2)">' + esc(j.contact) + '</div>' +
            (j.note ? '<div style="font-size:11.5px;color:var(--tx3);margin-top:9px;padding-top:9px;border-top:1px solid var(--line2);line-height:1.5">' + esc(j.note) + '</div>' : '') +
          '</div>' +
          '<div class="sd-note">Costs, budgets and supplier names are not shown on a Sales job card.</div>' +
        '</div>' +
      '</div>';
  }

  function chat(){
    if (!S.chat) {
      return '<button class="sd-chat-btn" data-act="chat" aria-label="Team chat">💬' +
        '<span class="sd-badge" style="top:-2px;right:-2px;min-width:20px;height:20px;font-size:11px;line-height:20px">2</span></button>';
    }
    return '<div class="sd-chat">' +
      '<div style="flex:none;display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line2)">' +
        '<span class="sd-qa-ic">💬</span>' +
        '<span style="flex:1;min-width:0"><span class="sd-title" style="display:block">Team chat</span>' +
        '<span style="display:block;font-size:10.5px;color:var(--ok);margin-top:1px">Hussain and Arun are online</span></span>' +
        '<button data-act="chat" style="flex:none;width:26px;height:26px;border-radius:8px;border:1px solid var(--line);background:var(--sunk);color:var(--tx2);font-size:11px;cursor:pointer">✕</button>' +
      '</div>' +
      '<div style="flex:1;min-height:0;overflow:auto;padding:13px 14px;display:flex;flex-direction:column;gap:12px;background:var(--page)">' +
        DATA.chat.map(function(m){
          return '<div class="sd-msg' + (m.me ? ' is-me' : '') + '">' +
            (m.me ? '' : '<span style="font-size:10px;color:var(--tx3);font-weight:600">' + esc(m.who) + ' · ' + esc(m.role) + '</span>') +
            '<span class="sd-bubble">' + esc(m.text) + '</span>' +
            '<span style="font-size:9.5px;color:var(--tx3)">' + esc(m.at) + '</span></div>';
        }).join('') +
      '</div>' +
      '<div style="flex:none;display:flex;gap:8px;padding:11px 12px;border-top:1px solid var(--line2)">' +
        '<input class="sd-input" placeholder="Message the team…">' +
        '<button style="flex:none;width:36px;height:36px;border-radius:10px;border:0;background:var(--wine);color:#fff;font-size:14px;cursor:pointer">↑</button>' +
      '</div>' +
    '</div>';
  }

  /* ---------------------------------------------------------------- render -- */

  function render(){
    buildData();
    /* topbar() and chat() are deliberately not called: the exec-shell already
       renders the burger / Quick actions / theme / bell row and the floating
       chat bubble app-wide, and drawing the handoff's own copies would stack
       two of each. Their CONTENT is honoured — the four Sales quick actions
       are registered into the shell's popover (see salesQuickActions below),
       and the shell's chat is the same messages[] store the handoff's mock
       conversation stands in for.
       Everything else below is the handoff's own render order. */
    return title() +
      '<div class="sd-grid">' +
        /* Shared planner/tasks widgets — one implementation across every
           dashboard, per the planner/tasks design package. Both in one wrapper
           so collapsing the planner cannot reshuffle the cards after it. */
        renderPlannerAndTasks() +
        queueCard() +
        quotationsCard() +
        productionCard() +
        pipelineCard() + clientsCard() +
        policyCard() +
      '</div>' +
      jobSheet();
  }

  /* ---------------------------------------------------------------- wiring -- */

  function shiftSelection(delta){
    var d = parseIso(S.selDate);
    if (S.planScope === 'Week') d = addDays(d, delta*7);
    else {
      var dom = d.getUTCDate();
      d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+delta);
      var last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)).getUTCDate();
      d.setUTCDate(Math.min(dom, last));
    }
    S.selDate = iso(d);
  }

  var ACTIONS = {
    stage: function(el){ S.stage = el.getAttribute('data-v'); },
    quote: function(el){ sdOpenQuotation(el.getAttribute('data-id')); },
    queue: function(el){ openQueueStep(el.getAttribute('data-k')); },

    // Scroll the sheet into view after it renders. It opens inline in the
    // grid, so on a long dashboard it can land below the fold and the click
    // looks like it did nothing — which is what happened once the shared
    // planner/tasks widget made the page taller (9 Aug 2026).
    job:      function(el){
                S.job = el.getAttribute('data-id');
                setTimeout(function(){
                  var sheet = root && root.querySelector('.sd-sheet');
                  if (sheet) sheet.scrollIntoView({ block: 'nearest' });
                }, 0);
              },
    closejob: function(){ S.job = null; },

    toggleweek:  function(){ S.weekOpen = !S.weekOpen; },
    toggletasks: function(){ S.tasksOpen = !S.tasksOpen; },
    scope:  function(el){ S.planScope = el.getAttribute('data-v'); S.planOffset = 0; S.selDate = todayIso(); },
    period: function(el){
      var v = parseInt(el.getAttribute('data-v'), 10);
      if (v === 0) { S.planOffset = 0; S.selDate = todayIso(); }
      else { S.planOffset += v; shiftSelection(v); }   /* keep selection inside the visible period */
    },
    day: function(el){ S.selDate = el.getAttribute('data-d'); },
    openplanner: function(){ emit('navigate', {to:'week-planner'}); },

    taskfilter: function(el){ S.taskFilter = el.getAttribute('data-v'); },
    /* The four task actions write to the app's real tasks[], so they persist
       and stay in step with the shell's own My Tasks panel. */
    taskcheck: function(el){
      var t = appTask(el.getAttribute('data-id'));
      if (!t) return;
      if (t.status === 'done') { t.status = 'open'; t.completedDate = null; }
      else if (typeof completeTask === 'function') completeTask(t.id);
      if (typeof execRefreshSidePanels === 'function') execRefreshSidePanels();
      if (typeof execRefreshBadges === 'function') execRefreshBadges();
    },
    taskmove: function(el){
      var t = appTask(el.getAttribute('data-id'));
      if (!t) return;
      var i = S.lists.map(function(l){ return l.k; }).indexOf(t.list || LISTS[0].k);
      t.list = S.lists[(i+1) % S.lists.length].k;
    },
    tasklink: function(el){
      var t = appTask(el.getAttribute('data-id'));
      if (!t) return;
      var used = S.tasks.map(function(x){ return x.job; }).filter(Boolean);
      var free = DATA.jobPool.filter(function(j){ return used.indexOf(j) === -1; })[0] || DATA.jobPool[0];
      if (!free) return;
      t.linkedType = 'job'; t.linkedId = free;
    },
    addtask: function(){
      var title = window.prompt('New task');
      if (!title || !title.trim()) return;
      var res = typeof createTask === 'function'
        ? createTask({ title: title.trim(), assignee: me(), dueDate: todayIso() })
        : null;
      if (res && res.error) { if (typeof commsToast === 'function') commsToast(res.error); return; }
      if (res) res.list = S.lists[0].k;
      S.tasksOpen = true;
      if (typeof execRefreshSidePanels === 'function') execRefreshSidePanels();
      if (typeof execRefreshBadges === 'function') execRefreshBadges();
    },
    addlist: function(){
      var name = window.prompt('New list name');
      if (!name || !name.trim()) return;
      LISTS.push({ k:'l'+S.nextList, n:name.trim(), c:'var(--wine3)' });
      S.nextList++;
    }
  };

  /* --- the app's real routers --------------------------------------------
     Quotation rows open the Quotation Hub Sales already has; queue steps open
     the list that owns that step. Cross-module hops use hideModuleWrap, never
     close*Module(), so a single-dashboard role isn't offered a sign-out. */
  function sdOpenQuotation(id){
    // sales.js's own Quotation Hub — same screen the Quotations list opens.
    if (typeof openQuotationHub === 'function') return openQuotationHub(id);
    if (typeof salesSetTopView === 'function') salesSetTopView('quotations');
  }
  function openQueueStep(k){
    if (k === 'un' && typeof salesSetTopView === 'function') { salesSetTopView('enquiries'); return; }
    if (k === 'sched' && typeof salesSetTopView === 'function') { salesSetTopView('myjobs'); return; }
    if (typeof salesSetTopView === 'function') salesSetTopView('quotations');
  }
  /* The four Quick actions from the handoff, surfaced through the shell's own
     popover so there is exactly one Quick-actions button on the page. */
  function salesQuickActions(){
    return (DATA.quickActions || []).map(function(q){
      return { ico: q.ic, label: q.t, on: 'SalesDashboard.quickAction(\'' + q.k + '\')' };
    });
  }
  function quickAction(k){
    if (k === 'enquiry' && typeof salesNewEnquiry === 'function') return salesNewEnquiry();
    if (k === 'enquiry' && typeof salesSetTopView === 'function') { salesSetTopView('enquiries'); return; }
    if (k === 'quotation' && typeof salesSetTopView === 'function') { salesSetTopView('enquiries'); return; }
    if (k === 'jobs' && typeof salesSetTopView === 'function') { salesSetTopView('myjobs'); return; }
    if (k === 'pr' && typeof requestPurchaseFromModule === 'function') return requestPurchaseFromModule(null, null, null);
  }

  function emit(name, detail){
    (root || document).dispatchEvent(new CustomEvent('sales:' + name, {bubbles:true, detail:detail}));
  }

  function onClick(e){
    var el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    var fn = ACTIONS[el.getAttribute('data-act')];
    if (!fn) return;
    fn(el);
    paint();
  }

  function mount(el){
    root = el;
    root.classList.add('sd');
    root.removeEventListener('click', onClick);
    root.addEventListener('click', onClick);
    paint();
  }

  return {
    render: render,
    mount: mount,
    state: S,
    // Exposed so a test can prove this screen and the rest of Sales resolve
    // the same person, rather than trusting that they both call me().
    whoami: me,
    data: DATA,
    quickActions: salesQuickActions,
    quickAction: quickAction,
    setData: function(patch){ Object.assign(DATA, patch || {}); paint(); }
  };
})();
