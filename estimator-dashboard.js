/* ==========================================================================
   AMD-APP · Estimator (design package 6a, 8 Aug 2026)

   Spec-only handoff — no source files shipped with it, unlike the Owner and
   Sales packages. This is the shell and the screens; the costing logic stays
   in estimator.js and is called from here, exactly as the package asks
   ("a redesign of the shell and the screens around them, not a rewrite").

   View tabs: Queue · Quote · Items · BOM · Roll-up, plus Rate library and
   Estimated vs actual off the sidebar.
   ========================================================================== */

window.EstimatorUI = (function () {
  'use strict';

  /* ---- one override store (§9) -----------------------------------------
     Qty and rate overrides live in a single map keyed {quoteId}-{lineNo},
     read by the Items list, the BOM rail and the Roll-up. Margin is never
     stored — it is derived, and setting it writes rate.

     Where a line has a BOM, the rate also writes through to the real record
     via setBOMSellingOverride(), so it survives a reload rather than being a
     screen-local number. Lines with no BOM yet have nothing to write to, so
     they live here until they get one.                                     */
  var OV = {};
  function ovKey(qtnId, lineId) { return qtnId + '-' + lineId; }
  function ovGet(qtnId, lineId) { return OV[ovKey(qtnId, lineId)] || {}; }
  function ovSet(qtnId, lineId, patch) {
    var k = ovKey(qtnId, lineId);
    OV[k] = Object.assign({}, OV[k] || {}, patch);
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function bd(n) {
    return 'BD ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  function ddmmm(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return String(iso);
    var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return String(d.getDate()).padStart(2, '0') + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
  }
  function ageDays(iso) {
    if (!iso) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 864e5));
  }
  function ageWords(iso) { var n = ageDays(iso); return n === 0 ? 'today' : n === 1 ? '1 day' : n + ' days'; }
  function safe(fn, fb) { try { var v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } }
  function me() { return typeof estimatorCurrentUser !== 'undefined' ? estimatorCurrentUser : 'Estimator'; }
  function clientOf(q) {
    var c = (typeof customers !== 'undefined' ? customers : []).filter(function (x) { return x.id === q.customerId; })[0];
    return c ? c.name : '—';
  }
  function qtn(id) { return (typeof quotations !== 'undefined' ? quotations : []).filter(function (q) { return q.id === id; })[0]; }

  /* Serial: last four of the quote id + zero-padded line number (§5). The
     package leans on it everywhere — Copy BOM, chat, the audit trail. */
  function serial(qtnId, lineId) {
    return String(qtnId).replace(/[^0-9]/g, '').slice(-4) + '-' + String(lineId).padStart(2, '0');
  }

  /* Effective qty/rate for a line: the override if there is one, else the
     record. Every screen reads through here so they cannot disagree. */
  function lineQty(q, it) { var o = ovGet(q.id, it.lineId); return o.qty !== undefined ? o.qty : (it.qty || 0); }
  function lineRate(q, it) {
    var o = ovGet(q.id, it.lineId);
    if (o.rate !== undefined) return o.rate;
    if (it.bom) { var t = safe(function () { return computeBOMTotals(it.bom); }, null); if (t) return t.sellingPrice || 0; }
    return it.rate || 0;
  }
  function lineAmount(q, it) { return lineQty(q, it) * lineRate(q, it); }
  function lineCost(q, it) {
    if (!it.bom) return 0;
    var t = safe(function () { return computeBOMTotals(it.bom); }, null);
    return t ? (t.totalCostInclOH || t.totalCost || 0) * lineQty(q, it) : 0;
  }
  function lineMargin(q, it) {
    var amt = lineAmount(q, it), cost = lineCost(q, it);
    return amt ? Math.round((amt - cost) / amt * 1000) / 10 : 0;
  }

  /* ---- state ------------------------------------------------------------ */
  var S = {
    view: 'queue',          // queue | quote | items | bom | rollup | rates | actuals
    qtnId: null, lineId: null,
    queueFilter: 'all',     // all | awaiting | returned | revision | tenders
    delegRow: null,
    bomTab: 'materials',
    discMode: '%',
    dupOpen: false,
    perItemOpen: false,
    specOpen: false, copyOpen: false, tplOpen: false,
    copySearch: '',
    expandedActual: null,
    rateSearch: ''
  };
  var root = null;
  function paint() { if (root) root.innerHTML = render(); }
  function go(view) { S.view = view; paint(); }

  /* ================================================================= QUEUE */

  /* A quote is "returned" if it is back with the Estimator having previously
     been with the Approver — the audit trail records every transfer, so this
     is derived rather than a new flag. */
  function wasWithApprover(q) {
    return (q.auditLog || []).some(function (a) { return /approver/i.test((a.userType || '') + ' ' + (a.action || '')); });
  }
  function queueBuckets() {
    var all = (typeof quotations !== 'undefined' ? quotations : []).filter(function (q) { return q.stage === 'estimator'; });
    return {
      all: all,
      awaiting: all.filter(function (q) { return !q.estimatorPickedBy; }),
      returned: all.filter(function (q) { return wasWithApprover(q); }),
      revision: all.filter(function (q) { return q.parentJobId || (q.rev && Number(String(q.rev).replace(/\D/g, '')) > 0); }),
      /* Tenders are not modelled in this app — the row stays, and collapses
         to its muted line, rather than being filled with something invented. */
      tenders: []
    };
  }

  function queueCard() {
    var b = queueBuckets();
    var rows = [
      { k: 'all', n: b.all.length, t: 'All', m: 'everything on my desk', tone: 'wine' },
      { k: 'awaiting', n: b.awaiting.length, t: 'Awaiting costing', m: 'no estimator has picked these', tone: 'warn' },
      { k: 'returned', n: b.returned.length, t: 'Returned', m: 'came back from the Approver', tone: 'bad' },
      { k: 'revision', n: b.revision.length, t: 'Revision', m: 'Sales changed the scope', tone: 'warn' },
      { k: 'tenders', n: b.tenders.length, t: 'Tenders', m: 'not tracked in this app yet', tone: '' }
    ];
    return '<section class="ed-card" style="padding:0">' +
      '<div style="padding:14px 16px;border-bottom:1px solid var(--line2)" class="ed-title">Needs you today</div>' +
      rows.map(function (r) {
        if (!r.n) {
          return '<div class="ed-q is-empty"><span class="ed-q-n" style="text-align:center;color:var(--tx3);font-size:14px">—</span>' +
            '<span style="flex:1;font-size:12.5px;color:var(--tx3)">' + esc(r.t) + ' · ' + esc(r.m) + '</span></div>';
        }
        return '<button class="ed-q' + (r.tone ? ' is-' + r.tone : '') + '" data-act="qfilter" data-v="' + r.k + '">' +
          '<span class="ed-q-n">' + r.n + '</span>' +
          '<span style="flex:1;min-width:0"><span class="ed-q-t">' + esc(r.t) + '</span>' +
          '<span class="ed-q-m">' + esc(r.m) + '</span></span>' +
          '<span style="flex:none;color:var(--tx3);font-size:15px">›</span></button>';
      }).join('') +
    '</section>';
  }

  function queueList() {
    var b = queueBuckets();
    var list = b[S.queueFilter] || b.all;
    var rows = list.length ? list.map(function (q) {
      var mine = q.estimatorPickedBy === me();
      var held = q.estimatorPickedBy && !mine;
      var totals = safe(function () { return computeQuotationTotals(q); }, { netTotal: 0 });
      var status = !q.estimatorPickedBy ? { l: 'Awaiting costing', t: 'warn' }
        : mine ? { l: 'Mine', t: 'wine' } : { l: 'With ' + q.estimatorPickedBy, t: '' };
      return '<div class="ed-row"><span style="flex:1;min-width:0">' +
        '<span style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">' +
          '<span class="ed-id">' + esc(q.id) + '</span>' +
          '<span class="ed-pill' + (status.t ? ' is-' + status.t : '') + '">' + esc(status.l) + '</span>' +
          '<span class="ed-micro">' + esc(ageWords(q.date)) + '</span>' +
          /* The colour-coded age badge from the audit Phase E work (6 Aug 2026)
             — green <=3d, amber 4-7d, red >7d. A plain day count alone loses
             the at-a-glance "this one has gone stale" signal. */
          (typeof quoteAgeBadge === 'function' ? quoteAgeBadge(q) : '') +
          (wasWithApprover(q) ? '<span class="ed-pill is-bad">Returned</span>' : '') +
        '</span>' +
        '<span class="ed-meta">' + esc(clientOf(q)) + ' · ' + esc(q.projectName || '') + '</span>' +
        '<span class="ed-micro" style="display:block;margin-top:3px">Last quoted ' + esc(bd(totals.netTotal)) + '</span>' +
        (S.delegRow === q.id ? '<span class="ed-deleg">' +
          (typeof ESTIMATOR_USERS !== 'undefined' ? ESTIMATOR_USERS : []).filter(function (u) { return u !== me(); })
            .map(function (u) { return '<button data-act="delegto" data-id="' + esc(q.id) + '" data-v="' + esc(u) + '">' + esc(u) + '</button>'; }).join('') +
        '</span>' : '') +
      '</span>' +
      '<span style="flex:none;display:flex;gap:7px;align-items:center">' +
        (mine ? '<button class="ed-btn" data-act="open" data-id="' + esc(q.id) + '">Open ›</button>'
          : held ? '<button class="ed-btn muted" title="' + esc(q.estimatorPickedBy) + ' holds this">Picked</button>'
          : '<button class="ed-btn" data-act="pick" data-id="' + esc(q.id) + '">Pick</button>') +
        '<button class="ed-btn ghost" data-act="deleg" data-id="' + esc(q.id) + '" title="Delegate">⇄</button>' +
      '</span></div>';
    }).join('') : '<p class="ed-micro" style="padding:10px 0">Nothing in this filter.</p>';

    return '<section class="ed-card">' +
      '<div class="ed-card-h" style="margin-bottom:4px"><span class="ed-title">Queue</span>' +
        '<span class="ed-micro">' + list.length + ' quotation' + (list.length === 1 ? '' : 's') + '</span></div>' +
      '<div class="ed-sub" style="margin-bottom:10px">Picking a quote claims it and opens its items</div>' +
      rows + '</section>';
  }

  function weekCard() {
    var evs = safe(function () { return getCalendarEvents(me(), 'estimator'); }, []);
    var today = new Date().toISOString().slice(0, 10);
    var soon = evs.filter(function (e) { return e.date >= today; }).slice(0, 5);
    return '<section class="ed-card"><div class="ed-card-h"><span class="ed-title">This week</span>' +
      '<button class="ed-link" data-act="planner">Open planner ›</button></div>' +
      '<div class="ed-sub" style="margin-bottom:9px">' + soon.length + ' ahead</div>' +
      (soon.length ? soon.map(function (e) {
        return '<div style="display:flex;gap:9px;padding:7px 0;border-bottom:1px solid var(--line2)">' +
          '<span class="ed-micro" style="flex:none;width:64px">' + esc(ddmmm(e.date)) + '</span>' +
          '<span style="font-size:12px;color:var(--tx)">' + esc(e.label) + '</span></div>';
      }).join('') : '<p class="ed-micro">Nothing scheduled.</p>') + '</section>';
  }


  function ratesMovedCard() {
    var all = rateMovements();
    var moved = all.slice(0, 4);
    return '<section class="ed-card"><div class="ed-card-h"><span class="ed-title">Rate movements</span>' +
      '<button class="ed-link" data-act="go" data-v="rates">Rate library ›</button></div>' +
      '<div class="ed-sub" style="margin-bottom:9px">' + (all.length
        ? all.length + ' material' + (all.length === 1 ? '' : 's') + ' moved in the last ' + RATE_WINDOW +
          ' days — quotes older than that are stale'
        : 'Nothing has moved in the last ' + RATE_WINDOW + ' days') + '</div>' +
      moved.map(function (m) {
        var up = m.movePercent > 0;
        return '<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line2)">' +
          '<span style="font-size:12px;color:var(--tx);min-width:0">' + esc(m.name) +
            '<span class="ed-micro" style="display:block">was ' + esc(bd(m.previous)) + ' · ' + esc(ddmmm(m.date)) + '</span></span>' +
          '<span style="text-align:right;flex:none"><span class="ed-micro" style="display:block">' +
            esc(bd(m.rate)) + ' / ' + esc(m.unit || '') + '</span>' +
            '<span style="font-size:11px;font-weight:700;color:' + (up ? 'var(--bad)' : 'var(--ok)') + '">' +
            (up ? '▲ +' : '▼ ') + m.movePercent + '%</span></span></div>';
      }).join('') + '</section>';
  }

  function estVsActualCard() {
    var rows = estVsActualRows().slice(0, 3);
    return '<section class="ed-card"><div class="ed-card-h"><span class="ed-title">Estimated vs actual</span>' +
      '<button class="ed-link" data-act="go" data-v="actuals">All ›</button></div>' +
      '<div class="ed-sub" style="margin-bottom:11px">Delivered jobs, estimate against what it really cost</div>' +
      (rows.length ? rows.map(function (r) { return barPair(r.label, r.est, r.act); }).join('')
        : '<p class="ed-micro">No delivered job has recorded actuals yet.</p>') + '</section>';
  }

  /* Chart rule: label above, fill inside a full-width track. */
  function barPair(label, est, act) {
    var peak = Math.max(est, act, 1);
    var over = act > est;
    return '<div style="margin-bottom:13px">' +
      '<div class="ed-bar-h"><span class="ed-bar-l">' + esc(label) + '</span>' +
        '<span class="ed-bar-v">' + (est ? (over ? '▲ ' : '▼ ') + Math.abs(Math.round((act - est) / est * 1000) / 10) + '%' : '—') + '</span></div>' +
      '<div class="ed-bar-h" style="margin-bottom:2px"><span class="ed-micro">Estimated</span><span class="ed-bar-v">' + esc(bd(est)) + '</span></div>' +
      '<span class="ed-track"><i style="width:' + Math.round(est / peak * 100) + '%;background:var(--wine3)"></i></span>' +
      '<div class="ed-bar-h" style="margin:6px 0 2px"><span class="ed-micro">Actual</span><span class="ed-bar-v">' + esc(bd(act)) + '</span></div>' +
      '<span class="ed-track"><i style="width:' + Math.round(act / peak * 100) + '%;background:' + (over ? 'var(--bad)' : 'var(--ok)') + '"></i></span>' +
    '</div>';
  }

  function queueView() {
    return queueCard() +
      '<div class="ed-cols">' +
        /* Shared planner/tasks widgets replace this module's own two cards —
           one implementation across every dashboard (planner/tasks package).
           Estimated vs actual follows them inside the same wrapper, so the
           card after the planner is always the same one when it collapses. */
        '<div>' + renderWeekPlanner() + renderMyTasks() + estVsActualCard() + '</div>' +
        ratesMovedCard() +
      '</div>' +
      queueList();
  }

  /* ============================================================= QUOTE HUB */

  function trail(q) {
    var steps = ['Enquiry', 'Quotation', 'Costing', 'Approval'];
    var at = q.lifecycleStatus === 'confirmed' ? 3 : q.stage === 'approver' ? 3 : q.stage === 'estimator' ? 2 : 1;
    return '<div class="ed-trail">' + steps.map(function (s, i) {
      return (i ? '<span class="ed-trail-c"></span>' : '') +
        '<span class="ed-trail-s ' + (i < at ? 'done' : i === at ? 'now' : '') + '"><i></i>' + s + '</span>';
    }).join('') + '</div>';
  }

  var DISCOUNT_LIMIT = 30;   // Estimator's ceiling, from the User Groups master

  /* A confirmed quote is frozen (quotationLock, data.js). Estimation is the
     one screen where the money is actually set, so every control that writes
     to the quote has to go dead here — not just Sales' two tiles. */
  function lockOf(q) {
    return typeof quotationLock === 'function' ? quotationLock(q) : null;
  }
  /* An unactionable button: same label, muted, and NO data-act, so the
     delegated handler skips it (the idiom this UI already uses for a queue
     row someone else holds). */
  function deadBtn(label, reason, extraCls) {
    return '<button class="ed-btn muted' + (extraCls ? ' ' + extraCls : '') +
      '" title="' + esc(reason) + '">' + esc(label) + '</button>';
  }
  function lockBanner(lock) {
    return '<section class="ed-card" style="border-color:var(--warn);background:var(--warn-bg)">' +
      '<div class="ed-title" style="color:var(--warn)">Confirmed — frozen</div>' +
      '<p class="ed-micro" style="margin-top:5px;color:var(--tx2)">' + esc(lock.reason) + '</p></section>';
  }

  function quoteView() {
    var q = qtn(S.qtnId);
    if (!q) return '<section class="ed-card"><p class="ed-micro">Pick a quotation from the queue first.</p></section>';
    var lock = lockOf(q);
    var totals = safe(function () { return computeQuotationTotals(q); }, { netTotal: 0, subtotal: 0 });
    var gross = (q.items || []).reduce(function (s, it) { return s + lineAmount(q, it); }, 0);
    var discPct = q.discountPercent || 0;
    var discBd = gross * discPct / 100;
    var over = discPct > DISCOUNT_LIMIT;

    return '<section class="ed-card">' +
      '<div class="ed-title" style="font-size:16px">' + esc(q.id) + ' — ' + esc(clientOf(q)) + ' · ' + esc(q.projectName || '') + '</div>' +
      '<div class="ed-sub" style="margin-bottom:13px">' + esc(ddmmm(q.date)) + ' · ' + (q.items || []).length + ' items</div>' +
      trail(q) +
    '</section>' +

    (lock ? lockBanner(lock) : '') +

    '<section class="ed-card"><div class="ed-title" style="margin-bottom:10px">Manage quote</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        /* Duplicate and Print stay live on a frozen quote — one makes a NEW
           draft, the other changes nothing. */
        (lock ? deadBtn('Edit quote', lock.reason) : '<button class="ed-btn" data-act="editquote">Edit quote</button>') +
        '<button class="ed-btn ghost" data-act="dup">Duplicate quote</button>' +
        '<button class="ed-btn ghost" data-act="printquote">Print quote</button>' +
      '</div>' +
      (S.dupOpen ? duplicateDialog(q) : '') +
    '</section>' +

    '<section class="ed-card">' +
      '<div class="ed-card-h"><span class="ed-title">Quote total</span>' +
        '<span style="font-size:19px;font-weight:650;color:var(--tx)">' + esc(bd(gross - discBd)) + '</span></div>' +
      '<div class="ed-sub" style="margin-bottom:12px">Before discount ' + esc(bd(gross)) + '</div>' +
      '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">' +
        '<span style="font-size:12px;font-weight:600;color:var(--tx2)">Discount</span>' +
        '<div class="ed-seg" style="flex:none">' +
          ['%', 'BD'].map(function (m) {
            return '<button aria-selected="' + (S.discMode === m) + '"' +
              (lock ? '' : ' data-act="discmode" data-v="' + m + '"') + '>' + m + '</button>';
          }).join('') + '</div>' +
        '<input class="ed-in" style="max-width:120px;text-align:left;border-color:' + (over ? 'var(--bad)' : 'var(--line)') + ';background:var(--card)"' +
          ' type="number" step="0.1" value="' + (S.discMode === '%' ? discPct : Math.round(discBd * 1000) / 1000) + '"' +
          (lock ? ' disabled title="' + esc(lock.reason) + '"' : ' data-act-input="disc"') + '>' +
        '<span class="ed-micro">' + (S.discMode === '%' ? esc(bd(discBd)) : discPct.toFixed(1) + '%') + '</span>' +
      '</div>' +
      (over ? '<p class="ed-bad">Above your ' + DISCOUNT_LIMIT + '% limit — the Approver must release this.</p>'
            : '<p class="ed-micro" style="margin-top:7px">Your limit is ' + DISCOUNT_LIMIT + '%. Record what the client asked for; anything past the limit routes to the Approver.</p>') +
    '</section>' +

    '<section class="ed-card"><div class="ed-title" style="margin-bottom:10px">Move this quote</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        (lock ? deadBtn('‹ Back to Sales', lock.reason) + deadBtn('Transfer to Approver →', lock.reason)
          : '<button class="ed-btn ghost" data-act="tostage" data-v="sales">‹ Back to Sales</button>' +
            '<button class="ed-btn" data-act="tostage" data-v="approver">Transfer to Approver →</button>') +
      '</div>' +
      '<div class="ed-sub" style="margin:11px 0 6px">Or hand it to another estimator</div>' +
      '<div class="ed-deleg">' + (typeof ESTIMATOR_USERS !== 'undefined' ? ESTIMATOR_USERS : [])
        .filter(function (u) { return u !== me(); })
        .map(function (u) { return '<button data-act="delegto" data-id="' + esc(q.id) + '" data-v="' + esc(u) + '">' + esc(u) + '</button>'; }).join('') +
      '</div></section>';
  }

  function duplicateDialog(q) {
    return '<div class="ed-fold" style="margin-top:12px"><div class="ed-fold-b">' +
      '<div class="ed-title" style="margin-bottom:9px">Duplicate quotation</div>' +
      '<div class="ed-sub" style="margin-bottom:10px">A new quotation is created from this one. Client and project can be changed.</div>' +
      '<label class="ed-micro">Client</label>' +
      '<input class="ed-in" id="ed-dup-client" style="max-width:none;text-align:left;border-color:var(--line);background:var(--card);margin-bottom:8px" value="' + esc(clientOf(q)) + '" readonly>' +
      '<label class="ed-micro">Project</label>' +
      '<input class="ed-in" id="ed-dup-project" style="max-width:none;text-align:left;border-color:var(--line);background:var(--card);margin-bottom:10px" value="' + esc(q.projectName || '') + '">' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:6px"><input type="checkbox" id="ed-dup-bom" checked> Copy BOMs</label>' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:6px"><input type="checkbox" id="ed-dup-desc" checked> Copy descriptions</label>' +
      /* off by default — a repeat job at last quarter's margin is the mistake
         worth preventing */
      '<label style="display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:10px"><input type="checkbox" id="ed-dup-margin"> Copy margin overrides</label>' +
      '<div style="display:flex;gap:8px"><button class="ed-btn" data-act="dupgo">Create copy</button>' +
        '<button class="ed-btn ghost" data-act="dup">Cancel</button></div>' +
    '</div></div>';
  }

  /* ================================================================= ITEMS */

  function itemsView() {
    var q = qtn(S.qtnId);
    if (!q) return '<section class="ed-card"><p class="ed-micro">Pick a quotation from the queue first.</p></section>';
    var items = q.items || [];
    var costed = items.filter(function (it) { return !!it.bom; }).length;
    var missing = items.length - costed;

    var rows = items.map(function (it) {
      var sl = serial(q.id, it.lineId);
      var hasInternal = !!(it.internalComment && it.internalComment.trim());
      var photos = it.imageUrl ? [it.imageUrl] : [];
      return '<tr>' +
        '<td><span class="ed-sl">' + esc(sl) + '</span></td>' +
        '<td><span style="font-size:12.5px;color:var(--tx);font-weight:600">' + esc(it.product) + '</span>' +
          (hasInternal ? ' <span class="ed-tag">internal</span>' : '') +
          (it.description ? '<span class="ed-micro" style="display:block;margin-top:3px">' + esc(it.description) + '</span>' : '') +
          ((it.departmentSequence || []).length ? '<span style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap">' +
            it.departmentSequence.map(function (d) { return '<span class="ed-pill">' + esc(safe(function () { return dc(d).n; }, d)) + '</span>'; }).join('') +
          '</span>' : '') +
          (photos.length ? '<span class="ed-thumbs">' + photos.map(function (p) {
            return '<img class="ed-thumb" loading="lazy" src="' + esc(p) + '" alt="" data-act="photo" data-v="' + esc(p) + '">';
          }).join('') + '</span>' : '') +
        '</td>' +
        '<td class="num"><input class="ed-in" type="number" step="any" value="' + lineQty(q, it) + '" data-act-input="qty" data-id="' + it.lineId + '"></td>' +
        '<td class="num"><input class="ed-in" type="number" step="any" value="' + lineRate(q, it) + '" data-act-input="rate" data-id="' + it.lineId + '"></td>' +
        '<td class="num ed-locked">' + esc(bd(lineAmount(q, it))) + '</td>' +
        '<td class="num ed-locked">' + (it.bom ? esc(bd(lineCost(q, it))) : '—') + '</td>' +
        '<td class="num"><input class="ed-in" style="max-width:70px" type="number" step="0.1" value="' + lineMargin(q, it) + '" data-act-input="margin" data-id="' + it.lineId + '"></td>' +
        '<td style="white-space:nowrap">' +
          (costed && !it.bom ? '<button class="ed-btn ghost" style="padding:4px 9px" data-act="copybom" data-id="' + it.lineId + '">Copy</button> ' : '') +
          '<button class="ed-btn" style="padding:4px 9px" data-act="bom" data-id="' + it.lineId + '">' + (it.bom ? 'Update BOM' : '＋ Add BOM') + '</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    return '<section class="ed-card">' +
      '<div class="ed-card-h"><span class="ed-title">' + esc(q.id) + ' · items</span>' +
        '<span class="ed-micro">' + costed + ' of ' + items.length + ' items costed</span></div>' +
      '<span class="ed-prog"><i style="width:' + (items.length ? Math.round(costed / items.length * 100) : 0) + '%"></i></span>' +
      (missing ? '<p class="ed-warn">' + missing + ' item' + (missing === 1 ? '' : 's') + ' still need a BOM — the roll-up is a running total, not final.</p>' : '') +
      '<div style="overflow-x:auto;margin-top:12px"><table class="ed-table">' +
        '<thead><tr><th>SL</th><th>Item</th><th class="num">Qty</th><th class="num">Rate</th>' +
        '<th class="num">Amount <span class="ed-lock">🔒</span></th><th class="num">Cost <span class="ed-lock">🔒</span></th>' +
        '<th class="num">Margin</th><th></th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
      '<p class="ed-micro" style="margin-top:9px">Amount is qty × rate and cost comes from the BOM — both are locked. Editing margin writes back through rate.</p>' +
    '</section>';
  }

  /* =================================================================== BOM */

  function bomView() {
    var q = qtn(S.qtnId);
    if (!q) return '<section class="ed-card"><p class="ed-micro">Pick a quotation from the queue first.</p></section>';
    var items = q.items || [];
    if (!S.lineId && items.length) S.lineId = items[0].lineId;
    var item = items.filter(function (it) { return it.lineId === S.lineId; })[0];
    if (!item) return '<section class="ed-card"><p class="ed-micro">This quotation has no items yet.</p></section>';
    var costed = items.filter(function (it) { return !!it.bom; }).length;

    /* Costing item switcher — every line as a chip with its serial and a ✓
       where a BOM exists. Staying on this page and stepping across items is
       the better way to work a quote. */
    var chips = '<section class="ed-card"><div class="ed-card-h" style="margin-bottom:9px">' +
      '<span class="ed-title">Costing item</span><span class="ed-micro">' + costed + ' of ' + items.length + ' costed</span></div>' +
      '<div class="ed-chips">' + items.map(function (it) {
        return '<button class="ed-chip' + (it.lineId === S.lineId ? ' on' : '') + '" data-act="chip" data-id="' + it.lineId + '">' +
          esc(serial(q.id, it.lineId)) + (it.bom ? ' <span class="ok">✓</span>' : '') + '</button>';
      }).join('') + '</div></section>';

    var TABS = [['materials', 'Materials'], ['labour', 'Labour cost'], ['subcontract', 'Sub contract'], ['hiring', 'Hiring'], ['others', 'Others']];
    var tabBar = '<div class="ed-tabs">' + TABS.map(function (t) {
      return '<button aria-selected="' + (S.bomTab === t[0]) + '" data-act="bomtab" data-v="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';

    /* The entry tables themselves are estimator.js's — unchanged logic. */
    var body = '';
    if (typeof estimatorBomTab !== 'undefined') estimatorBomTab = S.bomTab;
    if (S.bomTab === 'materials') body = safe(function () { return renderBomMaterialsTab(item); }, '');
    else if (S.bomTab === 'labour') body = safe(function () { return renderBomLabourTab(item); }, '');
    else if (S.bomTab === 'others') body = safe(function () { return renderBomOthersTab(item); }, '');
    else body = safe(function () { return renderBomGenericTab(item, S.bomTab); }, '');

    var sub = S.bomTab === 'subcontract'
      ? '<p class="ed-micro" style="margin-bottom:9px">Supplier names are recorded on the purchase side, not here — a costing sheet circulates more widely than a vendor list.</p>' : '';

    return chips +
      '<div class="ed-bom">' +
        '<div>' +
          '<section class="ed-card">' + tabBar + sub + body + '</section>' +
          specFold(item) + copyFold(q, item) + tplFold() +
        '</div>' +
        railCard(q, item) +
      '</div>';
  }

  function specFold(item) {
    var bits = [];
    if (item.description) bits.push('Description');
    if (item.internalComment) bits.push('1 internal comment');
    if (item.imageUrl) bits.push('1 photo');
    return '<div class="ed-fold"><button class="ed-fold-h" data-act="fold" data-v="spec">' +
      '<span class="ed-fold-t">Spec from Sales</span>' +
      '<span class="ed-fold-s">' + (bits.length ? esc(bits.join(' · ')) : 'nothing attached') + '</span>' +
      '<span class="ed-fold-s">' + (S.specOpen ? '⌃' : '⌄') + '</span></button>' +
      (S.specOpen ? '<div class="ed-fold-b">' +
        (item.description ? '<p style="font-size:12px;color:var(--tx);margin-bottom:8px">' + esc(item.description) + '</p>' : '') +
        (item.internalComment ? '<p style="font-size:11.5px;color:var(--warn);background:var(--warn-bg);padding:8px 10px;border-radius:9px">' + esc(item.internalComment) + '</p>' : '') +
        (item.imageUrl ? '<img class="ed-thumb" style="width:80px;height:80px;margin-top:8px" loading="lazy" src="' + esc(item.imageUrl) + '" alt="">' : '') +
        (!item.description && !item.internalComment && !item.imageUrl ? '<p class="ed-micro">Sales attached nothing to this line.</p>' : '') +
      '</div>' : '') + '</div>';
  }

  function copyFold(q, item) {
    var term = (S.copySearch || '').trim().toLowerCase();
    var others = (q.items || []).filter(function (it) { return it.lineId !== item.lineId && it.bom; });
    var hits = !term ? others : others.filter(function (it) {
      var sl = serial(q.id, it.lineId);
      return sl.toLowerCase().indexOf(term) !== -1
        || String(it.lineId).padStart(2, '0').indexOf(term) !== -1
        || (it.product || '').toLowerCase().indexOf(term) !== -1;
    });
    return '<div class="ed-fold"><button class="ed-fold-h" data-act="fold" data-v="copy">' +
      '<span class="ed-fold-t">Copy BOM from another item</span>' +
      '<span class="ed-fold-s">' + others.length + ' costed</span>' +
      '<span class="ed-fold-s">' + (S.copyOpen ? '⌃' : '⌄') + '</span></button>' +
      (S.copyOpen ? '<div class="ed-fold-b">' +
        '<input class="ed-in" style="max-width:none;text-align:left;border-color:var(--line);background:var(--card)" placeholder="Search by serial, name or line number" value="' + esc(S.copySearch) + '" data-act-input="copysearch">' +
        '<p class="ed-warn">Copying replaces this item\'s current BOM.</p>' +
        (hits.length ? hits.map(function (it) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid var(--line2)">' +
            '<span style="min-width:0"><span class="ed-sl">' + esc(serial(q.id, it.lineId)) + '</span> ' +
            '<span style="font-size:12px;color:var(--tx)">' + esc(it.product) + '</span></span>' +
            '<button class="ed-btn ghost" data-act="copyfrom" data-id="' + it.lineId + '">Copy</button></div>';
        }).join('') : '<p class="ed-micro">No other costed item matches.</p>') +
      '</div>' : '') + '</div>';
  }

  function tplFold() {
    var list = typeof bomTemplates !== 'undefined' ? bomTemplates : [];
    return '<div class="ed-fold"><button class="ed-fold-h" data-act="fold" data-v="tpl">' +
      '<span class="ed-fold-t">BOM templates</span>' +
      '<span class="ed-fold-s">' + list.length + ' saved</span>' +
      '<span class="ed-fold-s">' + (S.tplOpen ? '⌃' : '⌄') + '</span></button>' +
      (S.tplOpen ? '<div class="ed-fold-b">' +
        '<button class="ed-btn ghost" style="width:100%;margin-bottom:8px" data-act="tplsave">Save this build-up as a template</button>' +
        (list.length ? list.map(function (t) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--line2)">' +
            '<span style="font-size:12px;color:var(--tx)">' + esc(t.name) + '</span>' +
            '<button class="ed-btn ghost" data-act="tplapply" data-v="' + esc(t.id) + '">Apply</button></div>';
        }).join('') : '<p class="ed-micro">No templates saved yet.</p>') +
      '</div>' : '') + '</div>';
  }

  function railCard(q, item) {
    var t = item.bom ? safe(function () { return computeBOMTotals(item.bom); }, null) : null;
    var qty = lineQty(q, item);
    var mat = t ? (t.materialTotal || 0) : 0, lab = t ? (t.labourTotal || 0) : 0, sub = t ? (t.subcontractTotal || 0) : 0;
    var cost = lineCost(q, item), quoted = lineAmount(q, item);
    var profit = quoted - cost;
    var margin = lineMargin(q, item);
    return '<section class="ed-card">' +
      '<div class="ed-title" style="margin-bottom:10px">Item cost</div>' +
      '<div class="ed-rail-row"><span>Materials</span><b>' + esc(bd(mat * qty)) + '</b></div>' +
      '<div class="ed-rail-row"><span>Labour</span><b>' + esc(bd(lab * qty)) + '</b></div>' +
      '<div class="ed-rail-row"><span>Subcontract</span><b>' + esc(bd(sub * qty)) + '</b></div>' +
      '<div class="ed-rail-row"><span>Item cost</span><b>' + esc(bd(cost)) + '</b></div>' +
      '<div class="ed-rail-row"><span>Quoted</span><b>' + esc(bd(quoted)) + '</b></div>' +
      '<div class="ed-rail-row"><span>Profit</span><b style="color:' + (profit < 0 ? 'var(--bad)' : 'var(--ok)') + '">' + esc(bd(profit)) + '</b></div>' +
      '<div class="ed-rail-row total"><span>Item margin</span>' +
        '<input class="ed-in" type="number" step="0.1" value="' + margin + '" data-act-input="margin" data-id="' + item.lineId + '"></div>' +
      '<div class="ed-rail-row"><span>Selling price</span>' +
        '<input class="ed-in" type="number" step="any" value="' + lineRate(q, item) + '" data-act-input="rate" data-id="' + item.lineId + '"></div>' +
      (margin < 15 ? '<p class="ed-bad">Below the 15% floor — the Approver will send this back.</p>' : '') +
      '<button class="ed-btn" style="width:100%;margin-top:11px" data-act="submitbom" data-id="' + item.lineId + '">Submit this BOM</button>' +
    '</section>';
  }

  /* ================================================================ ROLLUP */

  function rollupView() {
    var q = qtn(S.qtnId);
    if (!q) return '<section class="ed-card"><p class="ed-micro">Pick a quotation from the queue first.</p></section>';
    var items = q.items || [];
    var costed = items.filter(function (it) { return !!it.bom; });
    var direct = costed.reduce(function (s, it) { return s + lineCost(q, it); }, 0);
    var price = items.reduce(function (s, it) { return s + lineAmount(q, it); }, 0);
    var wastage = q.wastagePercent || 0, overhead = q.overheadPercent || 0;
    var afterW = direct * (1 + wastage / 100);
    var afterO = afterW * (1 + overhead / 100);
    var margin = price ? Math.round((price - afterO) / price * 1000) / 10 : 0;

    var byDivision = {};
    items.forEach(function (it) {
      (it.departmentSequence || ['—']).forEach(function (d) {
        var k = safe(function () { return dc(d).n; }, d);
        byDivision[k] = (byDivision[k] || 0) + lineAmount(q, it) / (it.departmentSequence || ['—']).length;
      });
    });
    var divPeak = Math.max.apply(null, Object.keys(byDivision).map(function (k) { return byDivision[k]; }).concat([1]));

    return '<section class="ed-card">' +
      '<div class="ed-card-h"><span class="ed-title">Roll-up</span>' +
        '<span class="ed-micro">' + costed.length + ' of ' + items.length + ' costed</span></div>' +
      (costed.length < items.length ? '<p class="ed-warn">A running total — ' + (items.length - costed.length) + ' item(s) still need a BOM.</p>' : '') +
      '<div style="margin-top:10px">' +
        '<div class="ed-step"><span class="l">Direct cost</span><span class="v">' + esc(bd(direct)) + '</span></div>' +
        '<div class="ed-step"><span class="l">Wastage</span><span class="ed-stepper">' +
          '<button data-act="pct" data-v="wastage" data-d="-1">−</button>' +
          '<input class="ed-in" style="max-width:70px" type="number" step="0.5" value="' + wastage + '" data-act-input="wastage">' +
          '<button data-act="pct" data-v="wastage" data-d="1">＋</button>' +
          '<span class="v" style="margin-left:8px">' + esc(bd(afterW)) + '</span></span></div>' +
        '<div class="ed-step"><span class="l">Overhead</span><span class="ed-stepper">' +
          '<button data-act="pct" data-v="overhead" data-d="-1">−</button>' +
          '<input class="ed-in" style="max-width:70px" type="number" step="0.5" value="' + overhead + '" data-act-input="overhead">' +
          '<button data-act="pct" data-v="overhead" data-d="1">＋</button>' +
          '<span class="v" style="margin-left:8px">' + esc(bd(afterO)) + '</span></span></div>' +
        '<div class="ed-step"><span class="l">Margin</span><span class="v">' + margin.toFixed(1) + '%</span></div>' +
        '<div class="ed-step" style="border-bottom:0"><span class="l" style="font-weight:650;color:var(--tx)">Quotation price</span>' +
          '<input class="ed-in" style="max-width:150px;font-weight:650" type="number" step="any" value="' + Math.round(price * 1000) / 1000 + '" data-act-input="price"></div>' +
      '</div>' +
      '<p class="ed-micro" style="margin-top:9px">Price and margin are one decision — typing either solves the other. Cost never moves.</p>' +
    '</section>' +

    '<section class="ed-card"><div class="ed-title" style="margin-bottom:10px">Margin and price</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<input class="ed-in" style="max-width:110px;text-align:left;border-color:var(--line);background:var(--card)" type="number" step="0.5" value="' + margin.toFixed(1) + '" data-act-input="quotemargin">' +
        '<button class="ed-btn" data-act="applyall">Apply to all costed items</button>' +
        '<button class="ed-btn ghost" data-act="fold" data-v="peritem">Per-item margin ' + (S.perItemOpen ? '⌃' : '⌄') + '</button>' +
      '</div>' +
      (S.perItemOpen ? '<div style="margin-top:11px">' + costed.map(function (it) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid var(--line2)">' +
          '<span style="min-width:0"><span class="ed-sl">' + esc(serial(q.id, it.lineId)) + '</span> ' +
          '<span style="font-size:12px;color:var(--tx)">' + esc(it.product) + '</span></span>' +
          '<input class="ed-in" style="max-width:80px" type="number" step="0.1" value="' + lineMargin(q, it) + '" data-act-input="margin" data-id="' + it.lineId + '"></div>';
      }).join('') + '</div>' : '') +
    '</section>' +

    '<section class="ed-card"><div class="ed-title" style="margin-bottom:11px">By division</div>' +
      Object.keys(byDivision).map(function (k) {
        return '<div style="margin-bottom:12px">' +
          '<div class="ed-bar-h"><span class="ed-bar-l">' + esc(k) + '</span><span class="ed-bar-v">' + esc(bd(byDivision[k])) + '</span></div>' +
          '<span class="ed-track"><i style="width:' + Math.round(byDivision[k] / divPeak * 100) + '%;background:var(--wine)"></i></span></div>';
      }).join('') + '</section>';
  }

  /* ======================================================== RATES / ACTUAL */

  var RATE_WINDOW = 30;   // days — the package's own "last 30 days"
  /* Real dated movement from received purchase invoices, not a
     standard-cost-vs-last-paid proxy. See getRateMovements() in data.js. */
  function rateMovements() {
    return typeof getRateMovements === 'function' ? getRateMovements(RATE_WINDOW) : [];
  }

  function ratesView() {
    var term = (S.rateSearch || '').trim().toLowerCase();
    var all = (typeof itemMaster !== 'undefined' ? itemMaster : []);
    /* Search matches name OR unit — a unit search ("sheet") is how you check
       whether a board price rise hit everything. */
    var hits = !term ? all.slice(0, 40) : all.filter(function (i) {
      return (i.name || '').toLowerCase().indexOf(term) !== -1 || (i.unit || '').toLowerCase().indexOf(term) !== -1;
    });
    var moved = rateMovements();
    // Index the movements once — a per-row lookup would rebuild the whole
    // invoice history for every one of up to 200 rows.
    var byId = {};
    moved.forEach(function (m) { byId[m.itemId] = m; });
    return '<section class="ed-card">' +
      '<div class="ed-card-h"><span class="ed-title">Rate library</span>' +
        '<span class="ed-micro">' + hits.length + ' match' + (hits.length === 1 ? '' : 'es') + '</span></div>' +
      '<div class="ed-sub" style="margin-bottom:10px">' + (moved.length
        ? moved.length + ' material' + (moved.length === 1 ? '' : 's') + ' moved in the last ' + RATE_WINDOW +
          ' days — quotes older than that are stale.'
        : 'Nothing has moved in the last ' + RATE_WINDOW + ' days. Movement is read from received purchase invoices, so an item bought only once has none to show.') + '</div>' +
      '<input class="ed-in" style="max-width:none;text-align:left;border-color:var(--line);background:var(--card);margin-bottom:11px" placeholder="Search by name or unit" value="' + esc(S.rateSearch) + '" data-act-input="ratesearch">' +
      '<div style="overflow-x:auto"><table class="ed-table"><thead><tr>' +
        '<th>Material</th><th>Unit</th><th class="num">Rate</th><th class="num">Movement</th></tr></thead><tbody>' +
        hits.map(function (i) {
          // No movement in the window is an honest em-dash, never a 0% that
          // reads as "checked and stable".
          var m = byId[i.id];
          return '<tr><td style="font-size:12px">' + esc(i.name) + '</td>' +
            '<td class="ed-micro">' + esc(i.unit || '') + '</td>' +
            '<td class="num">' + esc(bd(i.cost || 0)) + '</td>' +
            '<td class="num" style="color:' + (m ? (m.movePercent > 0 ? 'var(--bad)' : 'var(--ok)') : 'var(--tx3)') +
              ';font-weight:' + (m ? 700 : 400) + '">' +
              (m ? (m.movePercent > 0 ? '▲ +' : '▼ ') + m.movePercent + '%' +
                   '<span class="ed-micro" style="display:block;font-weight:400">' + esc(ddmmm(m.date)) + '</span>'
                 : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
  }

  function estVsActualRows() {
    return (typeof jobCards !== 'undefined' ? jobCards : [])
      .filter(function (j) { return j.status !== 'cancelled'; })
      .map(function (j) {
        var act = safe(function () { return getJobActualCost(j.id); }, null);
        var actual = act ? (act.total || 0) : 0;
        var est = (j.items || []).reduce(function (s, it) {
          if (!it.bom) return s;
          var t = safe(function () { return computeBOMTotals(it.bom); }, null);
          return s + (t ? (t.totalCostInclOH || 0) * (it.qty || 1) : 0);
        }, 0);
        return { id: j.id, label: j.id + ' · ' + (j.projectName || ''), est: est, act: actual, job: j };
      })
      .filter(function (r) { return r.est > 0 || r.act > 0; })
      .sort(function (a, b) { return (b.act - b.est) - (a.act - a.est); });
  }

  function actualsView() {
    var rows = estVsActualRows();
    if (!rows.length) {
      return '<section class="ed-card"><div class="ed-title">Estimated vs actual</div>' +
        '<p class="ed-micro" style="margin-top:8px">No job has both an estimate and recorded actuals yet. Actuals come from the production cost ledger — priced material issues and team-leader day-logs.</p></section>';
    }
    return '<section class="ed-card">' +
      '<div class="ed-title">Estimated vs actual</div>' +
      '<div class="ed-sub" style="margin-bottom:12px">Estimate against what the job really cost. Rows open into their line items.</div>' +
      rows.map(function (r) {
        var overItems = (r.job.items || []).filter(function (it) {
          var a = safe(function () { return getLineActualCost(r.job.id, it.lineId); }, null);
          var t = it.bom ? safe(function () { return computeBOMTotals(it.bom); }, null) : null;
          var e = t ? (t.totalCostInclOH || 0) * (it.qty || 1) : 0;
          return a && (a.total || 0) > e && e > 0;
        });
        var open = S.expandedActual === r.id;
        return '<div class="ed-varrow' + (r.act > r.est ? ' over' : '') + '">' +
          '<button style="all:unset;cursor:pointer;display:block;width:100%" data-act="expandactual" data-v="' + esc(r.id) + '">' +
            barPair(r.label, r.est, r.act) +
          '</button>' +
          (open ? '<div style="padding-top:6px">' +
            (overItems.length ? '<p class="ed-bad">' + overItems.length + ' item' + (overItems.length === 1 ? '' : 's') + ' over estimate — flagged to Operations.</p>' : '') +
            (r.job.items || []).map(function (it) {
              var a = safe(function () { return getLineActualCost(r.job.id, it.lineId); }, null);
              var t = it.bom ? safe(function () { return computeBOMTotals(it.bom); }, null) : null;
              var e = t ? (t.totalCostInclOH || 0) * (it.qty || 1) : 0;
              return barPair('  ' + (it.product || ''), e, a ? (a.total || 0) : 0);
            }).join('') +
          '</div>' : '') +
        '</div>';
      }).join('') +
      '<p class="ed-micro" style="margin-top:10px">The Operations trigger is not built — this flag is a label. Raising an Ops decision-queue row from an overrun needs a threshold agreed with Operations first.</p>' +
    '</section>';
  }

  /* ================================================================ RENDER */

  var TABS = [['queue', 'Queue'], ['quote', 'Quote'], ['items', 'Items'], ['bom', 'BOM'], ['rollup', 'Roll-up']];

  function render() {
    var showTabs = ['queue', 'quote', 'items', 'bom', 'rollup'].indexOf(S.view) !== -1;
    var head = showTabs ? '<div class="ed-tabs">' + TABS.map(function (t) {
      var disabled = t[0] !== 'queue' && !S.qtnId;
      return '<button aria-selected="' + (S.view === t[0]) + '"' + (disabled ? ' disabled style="opacity:.45"' : '') +
        ' data-act="go" data-v="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>' : '';

    var body = S.view === 'queue' ? queueView()
      : S.view === 'quote' ? quoteView()
      : S.view === 'items' ? itemsView()
      : S.view === 'bom' ? bomView()
      : S.view === 'rollup' ? rollupView()
      : S.view === 'rates' ? ratesView()
      : actualsView();

    return '<div class="ed-page ed-scroll">' + head + body + '</div>';
  }

  /* =============================================================== ACTIONS */

  function setMargin(q, it, pct) {
    /* Margin is never stored — setting it writes rate. */
    var cost = lineCost(q, it), qty = lineQty(q, it) || 1;
    if (pct >= 100) return;
    var amount = cost / (1 - pct / 100);
    setRate(q, it, qty ? amount / qty : 0);
  }
  function setRate(q, it, rate) {
    ovSet(q.id, it.lineId, { rate: rate });
    /* Where a BOM exists there is a real field to write to, so the number
       survives a reload instead of living only on this screen. */
    if (it.bom && typeof setBOMSellingOverride === 'function') {
      safe(function () { return setBOMSellingOverride(q.id, it.lineId, rate); }, null);
    }
  }

  var ACTIONS = {
    go: function (el) { S.view = el.getAttribute('data-v'); },
    qfilter: function (el) { S.queueFilter = el.getAttribute('data-v'); },

    /* Defect 1: pick and open are one action — claiming a quote lands you on
       the Items index. */
    pick: function (el) {
      var id = el.getAttribute('data-id');
      var res = safe(function () { return pickQuotation(id, me(), 'estimator'); }, null);
      if (res && res.error) { if (typeof estimatorAlert === 'function') estimatorAlert(res.error); return; }
      S.qtnId = id; S.lineId = null; S.view = 'items';
    },
    open: function (el) { S.qtnId = el.getAttribute('data-id'); S.lineId = null; S.view = 'items'; },

    /* Defect 2: delegation from the queue row — triage is the common case, so
       you should not have to claim a quote to hand it on. */
    deleg: function (el) { var id = el.getAttribute('data-id'); S.delegRow = S.delegRow === id ? null : id; },
    delegto: function (el) {
      var id = el.getAttribute('data-id'), to = el.getAttribute('data-v');
      var res = safe(function () { return estimatorDelegate(id, to); }, null);
      if (res && res.error) { if (typeof estimatorAlert === 'function') estimatorAlert(res.error); return; }
      S.delegRow = null;
    },

    discmode: function (el) { S.discMode = el.getAttribute('data-v'); },
    dup: function () { S.dupOpen = !S.dupOpen; },
    dupgo: function () {
      var q = qtn(S.qtnId);
      if (!q || typeof duplicateQuotation !== 'function') {
        if (typeof estimatorAlert === 'function') estimatorAlert('Duplicating a quotation is not wired to a data function yet.');
        return;
      }
      var copy = duplicateQuotation(q.id, {
        projectName: (document.getElementById('ed-dup-project') || {}).value || q.projectName,
        copyBom: (document.getElementById('ed-dup-bom') || {}).checked,
        copyDescriptions: (document.getElementById('ed-dup-desc') || {}).checked,
        copyMargins: (document.getElementById('ed-dup-margin') || {}).checked
      });
      if (copy && copy.error) { if (typeof estimatorAlert === 'function') estimatorAlert(copy.error); return; }
      S.dupOpen = false; S.qtnId = copy.id; S.view = 'quote';
    },
    editquote: function () { if (typeof estimatorAlert === 'function') estimatorAlert('Edit quote opens Sales\' own wizard — use Back to Sales, or open the quotation there.'); },
    printquote: function () { if (typeof openPrintDialog === 'function') openPrintDialog(S.qtnId, false); },
    tostage: function (el) {
      var to = el.getAttribute('data-v');
      var res = safe(function () { return transferQuotationStage(S.qtnId, to, me()); }, null);
      if (res && res.error) { if (typeof estimatorAlert === 'function') estimatorAlert(res.error); return; }
      S.view = 'queue'; S.qtnId = null;
    },

    bom: function (el) { S.lineId = Number(el.getAttribute('data-id')); S.view = 'bom'; },
    chip: function (el) { S.lineId = Number(el.getAttribute('data-id')); },
    bomtab: function (el) { S.bomTab = el.getAttribute('data-v'); },
    fold: function (el) {
      var v = el.getAttribute('data-v');
      if (v === 'spec') S.specOpen = !S.specOpen;
      else if (v === 'copy') S.copyOpen = !S.copyOpen;
      else if (v === 'tpl') S.tplOpen = !S.tplOpen;
      else if (v === 'peritem') S.perItemOpen = !S.perItemOpen;
    },
    copybom: function (el) { S.lineId = Number(el.getAttribute('data-id')); S.view = 'bom'; S.copyOpen = true; },
    copyfrom: function (el) {
      var src = Number(el.getAttribute('data-id'));
      var res = safe(function () { return cloneBOMToItem(S.qtnId, src, S.lineId); }, null);
      if (res && res.error) { if (typeof estimatorAlert === 'function') estimatorAlert(res.error); return; }
      S.copyOpen = false;
    },
    tplsave: function () { safe(function () { return estimatorSaveTemplate(S.qtnId, S.lineId); }, null); },
    tplapply: function (el) { safe(function () { return applyBOMTemplate(el.getAttribute('data-v'), S.qtnId, S.lineId); }, null); },
    submitbom: function (el) {
      var res = safe(function () { return submitItemBOM(S.qtnId, Number(el.getAttribute('data-id')), me()); }, null);
      if (res && res.error) { if (typeof estimatorAlert === 'function') estimatorAlert(res.error); }
    },

    applyall: function () {
      var q = qtn(S.qtnId); if (!q) return;
      var el = document.querySelector('#estimator-body [data-act-input="quotemargin"]');
      var pct = el ? parseFloat(el.value) : NaN;
      if (isNaN(pct)) return;
      var costed = (q.items || []).filter(function (it) { return !!it.bom; });
      costed.forEach(function (it) { setMargin(q, it, pct); });
      if (typeof commsToast === 'function') commsToast(pct.toFixed(1) + '% applied to all ' + costed.length + ' costed items');
    },
    pct: function (el) {
      var q = qtn(S.qtnId); if (!q) return;
      var field = el.getAttribute('data-v'), d = Number(el.getAttribute('data-d'));
      var key = field === 'wastage' ? 'wastagePercent' : 'overheadPercent';
      q[key] = Math.max(0, (q[key] || 0) + d * 0.5);
    },
    expandactual: function (el) {
      var v = el.getAttribute('data-v');
      S.expandedActual = S.expandedActual === v ? null : v;
    },
    photo: function (el) { window.open(el.getAttribute('data-v'), '_blank'); },
    planner: function () { if (typeof execOpenPlanner === 'function') execOpenPlanner(); },
    done: function (el) { safe(function () { return completeTask(el.getAttribute('data-id')); }, null); },
    addtask: function () { if (typeof plAddTask === 'function') plAddTask(); }
  };

  /* Inputs commit on change, not on every keystroke — a repaint per keypress
     would take the caret with it. */
  function onChange(e) {
    var el = e.target.closest('[data-act-input]');
    if (!el || !root.contains(el)) return;
    // Belt and braces: even if a stale input survives a re-render, a frozen
    // quote takes no writes. The data layer refuses too — this just stops the
    // screen showing a value that was never saved.
    if (lockOf(qtn(S.qtnId))) { paint(); return; }
    var kind = el.getAttribute('data-act-input');
    var q = qtn(S.qtnId);
    var val = el.value;
    if (kind === 'ratesearch') { S.rateSearch = val; paint(); return; }
    if (kind === 'copysearch') { S.copySearch = val; paint(); return; }
    if (!q) return;
    var num = parseFloat(val);
    var it = (q.items || []).filter(function (x) { return x.lineId === Number(el.getAttribute('data-id')); })[0];
    if (kind === 'qty' && it && !isNaN(num)) ovSet(q.id, it.lineId, { qty: num });
    else if (kind === 'rate' && it && !isNaN(num)) setRate(q, it, num);
    else if (kind === 'margin' && it && !isNaN(num)) setMargin(q, it, num);
    else if (kind === 'disc' && !isNaN(num)) {
      var gross = (q.items || []).reduce(function (s, x) { return s + lineAmount(q, x); }, 0);
      q.discountPercent = S.discMode === '%' ? num : (gross ? num / gross * 100 : 0);
    }
    else if (kind === 'wastage' && !isNaN(num)) q.wastagePercent = num;
    else if (kind === 'overhead' && !isNaN(num)) q.overheadPercent = num;
    else if (kind === 'price' && !isNaN(num)) {
      /* Typing a price solves back to a margin by scaling every line. */
      var cur = (q.items || []).reduce(function (s, x) { return s + lineAmount(q, x); }, 0);
      if (cur > 0) {
        var f = num / cur;
        (q.items || []).forEach(function (x) { setRate(q, x, lineRate(q, x) * f); });
      }
    }
    else if (kind === 'quotemargin') return;   // only applied by the button
    paint();
  }

  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    var fn = ACTIONS[el.getAttribute('data-act')];
    if (!fn) return;
    fn(el);
    paint();
  }

  function mount(el) {
    root = el;
    root.classList.add('ed');
    root.removeEventListener('click', onClick);
    root.addEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.addEventListener('change', onChange);
    paint();
  }

  return {
    render: render, mount: mount, state: S, overrides: OV,
    serial: serial, go: go,
    setView: function (v) { S.view = v; paint(); },
    // Tenders is the queue filtered, not a separate screen — a tender is a
    // quotation with a closing date, so it lives in the same list.
    setQueueFilter: function (f) { S.queueFilter = f; S.view = 'queue'; paint(); }
  };
})();
