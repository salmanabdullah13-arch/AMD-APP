/* ==========================================================================
   AMD-APP · Operations dashboard — design handoff 13b
   ==========================================================================
   "The decision queue IS the dashboard." Five step buttons above ONE card of
   fixed geometry; tapping a step swaps the card's content. Nothing below it
   moves, which is the whole point — the manager works top to bottom without
   navigating.

   INTEGRATION, and where this deviates from the prototype (each deliberate):

   1. The handoff draws a sidebar, topbar, back button, Quick actions and a
      floating chat. This app already renders all five app-wide from
      exec-shell.js, so they are NOT drawn again here — drawing a second set
      would stack two of each. Same call the Sales 5a integration made. The
      handoff's sidebar ORDER is applied to EXEC_NAV_CONFIGS.operations
      instead, which is where this app's sidebar actually comes from.

   2. All sample data in the prototype is replaced with live getters. Five of
      the six widget states had a real source already:
        route  → getJobsPendingRouting() / confirmJobRouting()
        budget → getAllPendingBudgetApprovals() / approveDepartmentBudget()
        curt   → curtainPendingApprovals() / approveCurtainBom()
        exc    → getJobAttentionFlags()
        del    → opsReadyToScheduleJobs() / getDeliverySchedule()

   3. `quote` had NO equivalent — this app has no Operations feasibility stage
      (Sales → Estimator → Approver → Sales confirms). Rather than invent a
      mandatory new gate (which would change the quotation lifecycle and break
      ~24 test seeds), this reads quotes already costed and sitting with the
      Approver, and its actions use primitives that already exist: send back to
      Sales is a real stage transfer, delegation is the real delegateQuotation()
      built for the Estimator, and "recommend to the Owner" records an audit
      entry and messages the Owner rather than pretending a sign-off state
      exists. Flagged to Salman — a real Operations gate is a product decision.

   4. The prototype shows per-LINE department BOM rows with "filled by". This
      app's department budget is single-aggregate-per-category by an explicit
      earlier scope decision (submitDepartmentBudget takes categoryAmounts, not
      line items), so the rows here are the real categories. Inventing lines
      would show a granularity nobody entered.

   5. Chart rule from the handoff is followed everywhere: a bar's fill is a
      child of a full-width track, never shares a flex line with text, and
      never contains a label.
   ========================================================================== */

window.OpsUI = (function () {
  'use strict';

  var root = null;

  /* Per-role Operations store. Never shared — the handoff is explicit that
     Operations' own task store is separate, and this app gets that for free
     since tasks[] carries an assignee and lists carry an owner. */
  var S = {
    step: 'route',        // quote | route | budget | exc | curt | del
    exp: false,           // ⤢ "Open where?" menu
    dept: 'all',          // BOM line filter
    deptOpen: {},         // group collapse (undefined ⇒ open when flagged)
    line: {},             // per-line build-up panel
    jobCost: false,       // job-wise costing panel
    delegR: '',           // selected delegation reason
    seq: {},              // routing order per line — tap order IS the sequence
    toast: '',
    urgent: false,
    date: '',
    capOpen: {}
  };

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // BD always 3 decimals, per the hard rules.
  function bd(n) {
    return 'BD ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  function ddmmyyyy(iso) {
    if (!iso) return '—';
    var d = new Date(iso + (String(iso).length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d)) return String(iso);
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return String(d.getDate()).padStart(2, '0') + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
  }
  function safe(fn, dflt) { try { var v = fn(); return v === undefined ? dflt : v; } catch (e) { return dflt; } }
  function deptName(k) { return safe(function () { return dc(k).n; }, k); }
  function me() { return window.cloudIdentity || 'Operations Manager'; }
  function marginTone(p) { return p < 0 ? 'bad' : p < 10 ? 'warn' : 'ok'; }
  function pctLabel(p) { return (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(1) + '%'; }

  function customerName(id) {
    var c = safe(function () { return customers.find(function (x) { return x.id === id; }); }, null);
    return c ? c.name : '—';
  }
  function bomCost(bom) { return bom ? safe(function () { return computeBOMTotals(bom).totalCost; }, 0) : 0; }

  /* Departments a job line is actually routed to, excluding curt — Curtain
     tracks its own production in curtainJobs[], the same exclusion
     jobLineProductionComplete() already makes. */
  function routedOf(item) {
    return safe(function () { return routedDepartmentsFor(item); },
      (item.departmentSequence || []).filter(function (d) { return d !== 'curt'; }));
  }

  /* ── queues (all real) ───────────────────────────────────────────────── */
  function qRoute() { return safe(function () { return getJobsPendingRouting(); }, []); }
  function qQuote() {
    // Costed and sitting with the Approver — the last point at which a
    // feasibility objection can still change anything. See note 3 above.
    return safe(function () {
      return quotations.filter(function (q) {
        return q.stage === 'approver' && q.lifecycleStatus !== 'confirmed';
      });
    }, []);
  }
  function qBudget() { return safe(function () { return getAllPendingBudgetApprovals(); }, []); }
  function qCurt() { return safe(function () { return curtainPendingApprovals(); }, []); }
  function qExc() {
    return safe(function () {
      return jobCards.filter(function (j) {
        return j.status !== 'cancelled' && getJobAttentionFlags(j).length > 0;
      });
    }, []);
  }
  function qDel() { return safe(function () { return opsReadyToScheduleJobs(); }, []); }

  var STEPS = [
    { k: 'quote', l: 'Approve quotes', m: 'feasibility sign-off before Sales sends it', q: qQuote, tone: 'bad' },
    { k: 'route', l: 'Route new jobs', m: 'the one human checkpoint', q: qRoute, tone: 'bad' },
    { k: 'budget', l: 'Verify department BOMs', m: 'before production starts · over BD 5,000 goes to Owner', q: qBudget, tone: 'warn' },
    { k: 'exc', l: 'Chase exceptions', m: 'rework · stalled · over budget', q: qExc, tone: 'bad' },
    { k: 'curt', l: 'Curtain BOM', m: "Silva's submission", q: qCurt, tone: 'warn' },
    { k: 'del', l: 'Upcoming deliveries', m: 'ready · the scheduler books the slot', q: qDel, tone: 'wine' }
  ];

  /* The handoff's escalation figure for QUOTES. The app's real, enforced
     BD 5,000 rule (BUDGET_APPROVAL_THRESHOLD) is about department budgets;
     this one is introduced by the design and is display-only — it recommends,
     it does not gate. Kept separate so the two are never confused. */
  var QUOTE_ESCALATION = 8000;

  /* ── step buttons ────────────────────────────────────────────────────── */
  function stepsHTML() {
    return '<section class="opsd-card">' +
      '<div class="opsd-eyebrow">Your day, in the order it runs</div>' +
      '<div class="opsd-steps">' +
      STEPS.map(function (t) {
        var n = t.q().length;
        var tone = n === 0 ? 'ok' : (t.tone === 'wine' ? '' : 't-' + t.tone);
        return '<button class="opsd-step' + (S.step === t.k ? ' is-on' : '') + '" data-a="step" data-k="' + t.k + '">' +
          '<span class="opsd-step-n ' + (n === 0 ? 't-ok' : tone) + '">' + (n === 0 ? '✓' : n) + '</span>' +
          '<span><span class="opsd-step-t">' + esc(t.l) + '</span>' +
          '<span class="opsd-step-s">' + esc(t.m) + '</span></span></button>';
      }).join('') +
      '</div></section>';
  }

  /* ── shared widget pieces ────────────────────────────────────────────── */
  function jobHeadHTML(t, sub, src) {
    return '<div class="opsd-job">' + esc(t) + '</div>' +
      (sub ? '<div class="opsd-job-s">' + esc(sub) + '</div>' : '') +
      (src ? '<div class="opsd-job-x">' + esc(src) + '</div>' : '');
  }
  function factsHTML(rows) {
    if (!rows.length) return '';
    return '<div class="opsd-facts">' + rows.map(function (r) {
      return '<div class="opsd-fact' + (r[2] ? ' t-' + r[2] : '') + '">' +
        '<span class="opsd-fact-l">' + esc(r[0]) + '</span>' +
        '<span class="opsd-fact-v">' + esc(r[1]) + '</span></div>';
    }).join('') + '</div>';
  }
  function rollHTML(rows, total, costLabel) {
    return '<div class="opsd-roll">' +
      '<div class="opsd-roll-h"><span class="opsd-roll-d">Department</span>' +
      '<span class="opsd-roll-n">Selling</span><span class="opsd-roll-n">' + esc(costLabel) + '</span>' +
      '<span class="opsd-roll-m">Margin</span></div>' +
      rows.map(function (r) {
        return '<div class="opsd-roll-r"><span class="opsd-roll-d">' + esc(r.d) + '</span>' +
          '<span class="opsd-roll-n">' + esc(bd(r.sell)) + '</span>' +
          '<span class="opsd-roll-n">' + esc(bd(r.cost)) + '</span>' +
          '<span class="opsd-roll-m"><span class="opsd-pill t-' + marginTone(r.pct) + '">' + pctLabel(r.pct) + '</span></span></div>';
      }).join('') +
      '<div class="opsd-roll-r is-tot"><span class="opsd-roll-d">Whole job</span>' +
      '<span class="opsd-roll-n">' + esc(bd(total.sell)) + '</span>' +
      '<span class="opsd-roll-n">' + esc(bd(total.cost)) + '</span>' +
      '<span class="opsd-roll-m"><span class="opsd-pill t-' + marginTone(total.pct) + '">' + pctLabel(total.pct) + '</span></span></div>' +
      '</div>';
  }
  function bomRowsHTML(rows, totalLabel, totalVal) {
    return '<div class="opsd-bom">' + rows.map(function (r) {
      return '<div class="opsd-bom-r"><span class="opsd-bom-c">' + esc(r.c) + '</span>' +
        '<span class="opsd-bom-q">' + esc(r.q) + '</span>' +
        '<span class="opsd-bom-a">' + esc(r.a) + '</span></div>';
    }).join('') +
      '<div class="opsd-bom-t"><span class="opsd-bom-c">' + esc(totalLabel) + '</span>' +
      '<span class="opsd-bom-q"></span><span class="opsd-bom-a">' + esc(totalVal) + '</span></div></div>';
  }
  function bannerHTML(text, tone) {
    return '<div class="opsd-banner' + (tone === 'ok' ? ' t-ok' : '') + '">' + esc(text) + '</div>';
  }
  function emptyHTML(msg, sub) {
    return '<div class="opsd-empty"><b>✓ ' + esc(msg) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>';
  }

  /* Every BOM entry carries an amount; qty/rate only on some categories. */
  function bomEntryRows(bom) {
    if (!bom) return [];
    var out = [];
    ['materials', 'labour', 'subcontract', 'hiring', 'others'].forEach(function (cat) {
      (bom[cat] || []).forEach(function (e) {
        out.push({
          c: e.itemName || e.name || e.workType || e.description || e.vendor || cat,
          q: e.qty != null ? (e.qty + ' ' + (e.unit || '')) : (e.manQty != null ? e.manQty + ' × ' + e.qty : '—'),
          a: bd(e.amount || 0)
        });
      });
    });
    return out;
  }

  /* ── state: route ────────────────────────────────────────────────────── */
  function routeBody() {
    var jobs = qRoute();
    // The strip belongs to the confirmation that just happened, so it shows
    // whether or not that confirmation emptied the queue — the handoff has
    // both the toast and the "every job is routed" state.
    var strip = S.toast ? '<div class="opsd-toast">' + esc(S.toast) + '</div>' : '';
    if (!jobs.length) return strip + emptyHTML('Every confirmed job is routed', 'Nothing is waiting on you here.');
    var job = jobs[0];
    // ROUTABLE_DEPTS holds {k,n,c} objects, not keys.
    var depts = safe(function () { return ROUTABLE_DEPTS.map(function (d) { return d.k; }); }, []);

    return jobHeadHTML(job.projectName || job.id,
      job.id + ' · ' + customerName(job.customerId) + ' · ' + bd(job.amount),
      'Confirmed ' + ddmmyyyy(job.confirmDate || job.date) + ' · ' + (job.items || []).length + ' line' + ((job.items || []).length === 1 ? '' : 's')) +
      '<div style="margin-top:13px">' +
      (job.items || []).map(function (it) {
        var key = job.id + ':' + it.lineId;
        var seq = S.seq[key] || (it.departmentSequence || []).slice();
        return '<div class="opsd-rline">' +
          '<div class="opsd-line-t">' + esc(it.product) + '</div>' +
          '<div class="opsd-line-why">' + esc(it.qty + ' ' + (it.unit || '')) + '</div>' +
          '<div class="opsd-rchips">' + depts.map(function (d) {
            var i = seq.indexOf(d), on = i !== -1;
            return '<button class="opsd-rchip' + (on ? ' is-on' : '') + '" data-a="chip" data-k="' + esc(key) + '" data-d="' + d + '">' +
              (on ? (i + 1) + ' · ' : '') + esc(deptName(d)) + '</button>';
          }).join('') + '</div>' +
          '<div class="opsd-rseq' + (seq.length ? '' : ' is-none') + '">' +
          (seq.length ? esc(seq.map(deptName).join(' → ')) : 'Not routed yet') + '</div>' +
          '</div>';
      }).join('') + '</div>' + strip;
  }
  function routeFoot() {
    var jobs = qRoute();
    if (!jobs.length) return '';
    return '<button class="opsd-urgent' + (S.urgent ? ' is-on' : '') + '" data-a="urgent">🔥 ' +
      (S.urgent ? 'Urgent — jumps the department queue' : 'Mark urgent') + '</button>' +
      '<input type="date" class="opsd-date" data-a="date" value="' + esc(S.date) + '" aria-label="Promised date">' +
      '<button class="opsd-btn flex" data-a="confirm">Confirm routing &amp; dispatch →</button>' +
      (jobs.length > 1 ? '<span class="opsd-more">' + (jobs.length - 1) + ' more after this</span>' : '');
  }

  /* ── state: quote ────────────────────────────────────────────────────── */
  function quoteModel() {
    var qs = qQuote();
    if (!qs.length) return null;
    var q = qs[0];
    var items = q.items || [];
    var enq = safe(function () { return enquiries.find(function (e) { return e.id === q.enquiryId; }); }, null);

    // Group by the line's FIRST routed department — one line can touch more
    // than one, and a roll-up that double-counts is worse than one that
    // simplifies. The whole-job row is summed from the lines, not the groups.
    var groups = {};
    items.forEach(function (it) {
      var d = (it.departmentSequence || [])[0] || 'other';
      (groups[d] = groups[d] || []).push(it);
    });
    var rows = Object.keys(groups).map(function (d) {
      var sell = groups[d].reduce(function (s, it) { return s + (it.netAmount || 0); }, 0);
      var cost = groups[d].reduce(function (s, it) { return s + bomCost(it.bom); }, 0);
      return { d: deptName(d), key: d, sell: sell, cost: cost, pct: sell ? (sell - cost) / sell * 100 : 0, items: groups[d] };
    });
    var sell = items.reduce(function (s, it) { return s + (it.netAmount || 0); }, 0);
    var cost = items.reduce(function (s, it) { return s + bomCost(it.bom); }, 0);
    return {
      q: q, enq: enq, rows: rows,
      total: { sell: sell, cost: cost, pct: sell ? (sell - cost) / sell * 100 : 0 },
      more: qs.length - 1
    };
  }
  function quoteFacts(m) {
    var facts = [];
    // Lead time the floor actually needs, from real booked labour hours in the
    // BOMs against a department's own daily capacity — not a typed promise.
    var hours = 0;
    (m.q.items || []).forEach(function (it) {
      if (it.bom) (it.bom.labour || []).forEach(function (l) {
        hours += (l.calcMode === 'days' ? (l.qty || 0) * 8 : (l.qty || 0)) * (l.manQty || 1);
      });
    });
    var cap = safe(function () { return getWeekCapacity(); }, []);
    var daily = cap.reduce(function (s, c) { return s + (c.avail || 0); }, 0) / 6 || 0;
    if (hours > 0 && daily > 0) {
      facts.push(['Floor time this quote books', Math.ceil(hours / daily) + ' working days (' + Math.round(hours) + ' h)', 'warn']);
    }
    // Any department already at or over capacity this week.
    cap.forEach(function (c) {
      if (c.avail > 0 && c.logged / c.avail > 0.95) {
        facts.push(['Capacity that week', c.label + ' already at ' + Math.round(c.logged / c.avail * 100) + '%', 'bad']);
      }
    });
    // Subcontract/hiring lines are the real long-lead signal in a BOM.
    var special = [];
    (m.q.items || []).forEach(function (it) {
      if (!it.bom) return;
      (it.bom.subcontract || []).forEach(function (sc) { special.push((sc.vendor || 'Subcontractor') + ' — ' + (sc.workType || 'subcontract')); });
      (it.bom.hiring || []).forEach(function (h) { special.push(h.description || h.name || 'Hired plant'); });
    });
    if (special.length) facts.push(['Special items', special.slice(0, 2).join(' · ') + (special.length > 2 ? ' +' + (special.length - 2) : ''), 'warn']);
    if (!facts.length) facts.push(['Feasibility', 'Nothing flagged — capacity and lead time look clear', 'ok']);
    return facts;
  }
  function quoteBody() {
    var m = quoteModel();
    if (!m) return emptyHTML('No quotes waiting on feasibility', 'Nothing is costed and awaiting sign-off.');
    var q = m.q;
    var prep = m.enq ? m.enq.salesPerson : null;

    return jobHeadHTML(q.projectName || q.id,
      'Quotation ' + q.id + ' · ' + customerName(q.customerId) + ' · ' + bd(m.total.sell),
      (prep ? 'Prepared by ' + prep + ' · ' : '') + ddmmyyyy(q.date) + ' · Estimator costed ' + bd(m.total.cost)) +
      factsHTML(quoteFacts(m)) +
      '<div class="opsd-note">Estimator build-up, department by department — verify the costing before Sales sends it.</div>' +
      rollHTML(m.rows, m.total, 'Estimated') +
      m.rows.map(function (g) {
        var open = S.deptOpen[g.key] === undefined ? false : !!S.deptOpen[g.key];
        return '<div class="opsd-grp"><button class="opsd-grp-h" data-a="grp" data-k="' + esc(g.key) + '">' +
          '<span class="opsd-line-n"><span class="opsd-line-t">' + esc(g.d) + '</span>' +
          '<span class="opsd-line-why">' + g.items.length + ' line' + (g.items.length === 1 ? '' : 's') + ' · ' + esc(bd(g.sell)) + ' selling</span></span>' +
          '<span class="opsd-chev">' + (open ? '▾' : '▸') + '</span></button>' +
          (open ? g.items.map(function (it) {
            var lo = !!S.line[it.lineId];
            var c = bomCost(it.bom);
            var pct = it.netAmount ? (it.netAmount - c) / it.netAmount * 100 : 0;
            return '<button class="opsd-line" data-a="line" data-k="' + it.lineId + '">' +
              '<span class="opsd-line-n"><span class="opsd-line-t">' + esc(it.product) + '</span>' +
              '<span class="opsd-line-why">' + esc(it.qty + ' ' + (it.unit || '')) + '</span></span>' +
              '<span class="opsd-roll-n">' + esc(bd(it.netAmount || 0)) + '</span>' +
              '<span class="opsd-roll-n">' + esc(bd(c)) + '</span>' +
              '<span class="opsd-roll-m"><span class="opsd-pill t-' + marginTone(pct) + '">' + pctLabel(pct) + '</span></span>' +
              '<span class="opsd-chev">' + (lo ? '▾' : '▸') + '</span></button>' +
              (lo ? (it.bom
                ? bomRowsHTML(bomEntryRows(it.bom), "This line's estimate", bd(c))
                : '<div class="opsd-bom"><div class="opsd-bom-r"><span class="opsd-bom-c">No BOM on this line yet — the Estimator hasn\'t costed it.</span></div></div>') : '');
          }).join('') : '') + '</div>';
      }).join('') +
      (m.total.sell > QUOTE_ESCALATION
        ? bannerHTML('Above ' + bd(QUOTE_ESCALATION) + ' — this quote needs your sign-off and the Owner\'s. You recommend, the Owner counter-signs.')
        : bannerHTML('Under ' + bd(QUOTE_ESCALATION) + ' — you sign this one off, no Owner step.', 'ok')) +
      '<div class="opsd-deleg"><div class="opsd-deleg-t">Cannot verify this one?</div>' +
      '<div class="opsd-deleg-n">The Director signs on your behalf. Your reason and the hand-off stay on the quote\'s audit trail.</div>' +
      '<div class="opsd-reasons">' +
      ['Technical detail outside Operations', 'Price concession needed', 'Client relationship call', 'I am on site / unavailable']
        .map(function (r, i) {
          return '<button class="opsd-reason' + (S.delegR === r ? ' is-on' : '') + '" data-a="reason" data-i="' + i + '">' + esc(r) + '</button>';
        }).join('') +
      '</div><div style="margin-top:10px"><button class="opsd-btn sec" data-a="delegate">Delegate to the Director →</button></div></div>';
  }
  function quoteFoot() {
    var m = quoteModel();
    if (!m) return '';
    return '<button class="opsd-btn flex" data-a="recommend">Recommend to the Owner →</button>' +
      '<button class="opsd-btn sec" data-a="sendback">Send back to Sales with conditions</button>' +
      (m.more > 0 ? '<span class="opsd-more">' + m.more + ' more after this</span>' : '');
  }

  /* ── state: budget ───────────────────────────────────────────────────── */
  function budgetModel() {
    var pend = qBudget();
    if (!pend.length) return null;
    var p = pend[0];
    // getAllPendingBudgetApprovals() rows are { job, deptKey, entry } — the
    // job object itself, not an id.
    var job = p.job;
    if (!job) return null;
    var entry = job.departmentBudgets[p.deptKey];
    var cost = bomCost(entry.bom);
    // Selling attributable to this department: the lines routed to it.
    var lines = (job.items || []).filter(function (it) { return (it.departmentSequence || []).indexOf(p.deptKey) !== -1; });
    var sell = lines.reduce(function (s, it) { return s + (it.netAmount || 0); }, 0);
    var est = lines.reduce(function (s, it) { return s + bomCost(it.bom); }, 0);
    return {
      p: p, job: job, entry: entry, deptKey: p.deptKey, lines: lines,
      sell: sell, cost: cost, est: est,
      pct: sell ? (sell - cost) / sell * 100 : 0,
      more: pend.length - 1
    };
  }
  function budgetBody() {
    var m = budgetModel();
    if (!m) return emptyHTML('No department BOMs waiting', 'The floor is not held up by a verification.');
    var overThreshold = m.cost > safe(function () { return BUDGET_APPROVAL_THRESHOLD; }, 5000);

    var catRows = ['materials', 'labour', 'subcontract', 'hiring', 'others'].map(function (cat) {
      var amt = (m.entry.bom[cat] || []).reduce(function (s, e) { return s + (e.amount || 0); }, 0);
      return { cat: cat, amt: amt };
    }).filter(function (r) { return r.amt > 0; });

    return jobHeadHTML(m.job.projectName || m.job.id,
      m.job.id + ' · ' + customerName(m.job.customerId) + (m.job.quotationId ? ' · quotation ' + m.job.quotationId : ''),
      deptName(m.deptKey) + ' BOM · filled by ' + (m.entry.submittedBy || '—') +
      (m.entry.submittedDate ? ' · ' + ddmmyyyy(m.entry.submittedDate) : '') +
      (m.job.promisedDate ? ' · promised ' + ddmmyyyy(m.job.promisedDate) : '')) +
      factsHTML([
        ['Selling price for these lines', bd(m.sell), 'plain'],
        ['Estimated at quote', bd(m.est), 'plain'],
        ['BOM cost as filled', bd(m.cost), m.cost > m.est ? 'bad' : 'ok'],
        ['Margin', pctLabel(m.pct), marginTone(m.pct)]
      ]) +
      '<div class="opsd-note">This app records a department budget as one figure per category, not per line — these are the real categories submitted, not invented line items.</div>' +
      '<div class="opsd-roll"><div class="opsd-roll-h"><span class="opsd-roll-d">Category</span>' +
      '<span class="opsd-roll-n">BOM cost</span></div>' +
      (catRows.length ? catRows.map(function (r) {
        return '<div class="opsd-roll-r"><span class="opsd-roll-d">' + esc(r.cat.charAt(0).toUpperCase() + r.cat.slice(1)) + '</span>' +
          '<span class="opsd-roll-n">' + esc(bd(r.amt)) + '</span></div>';
      }).join('') : '<div class="opsd-roll-r"><span class="opsd-roll-d">Nothing entered</span><span class="opsd-roll-n">' + esc(bd(0)) + '</span></div>') +
      '<div class="opsd-roll-r is-tot"><span class="opsd-roll-d">Total</span>' +
      '<span class="opsd-roll-n">' + esc(bd(m.cost)) + '</span></div></div>' +
      (m.lines.length ? '<div class="opsd-note">Covers ' + m.lines.length + ' routed line' + (m.lines.length === 1 ? '' : 's') + ': ' +
        esc(m.lines.map(function (l) { return l.product; }).join(' · ')) + '</div>' : '') +
      (overThreshold
        ? bannerHTML('Over ' + bd(safe(function () { return BUDGET_APPROVAL_THRESHOLD; }, 5000)) + ' — the Owner signs this one. You recommend it with a reason.')
        : bannerHTML('Under ' + bd(safe(function () { return BUDGET_APPROVAL_THRESHOLD; }, 5000)) + ' — you approve, no Owner step.', 'ok'));
  }
  function budgetFoot() {
    var m = budgetModel();
    if (!m) return '';
    var overThreshold = m.cost > safe(function () { return BUDGET_APPROVAL_THRESHOLD; }, 5000);
    return '<button class="opsd-btn flex" data-a="bud-ok">' + (overThreshold ? 'Recommend to the Owner →' : 'Approve the BOM') + '</button>' +
      '<button class="opsd-btn sec" data-a="bud-back">Send the BOM back to the department</button>' +
      (m.more > 0 ? '<span class="opsd-more">' + m.more + ' more after this</span>' : '');
  }

  /* ── state: curtain BOM ──────────────────────────────────────────────── */
  function curtBody() {
    var list = qCurt();
    if (!list.length) return emptyHTML('No Curtain BOM waiting', "Silva has nothing with you.");
    var j = list[0];
    return jobHeadHTML(j.name || j.id, j.id + (j.client ? ' · ' + j.client : ''),
      'Curtain BOM submitted for your approval') +
      factsHTML([
        ['Job value', bd(j.val || 0), 'plain'],
        ['Curtain department value', bd(j.deptVal || 0), 'plain'],
        ['BOM status', j.bomStatus || '—', 'warn']
      ]) +
      '<div class="opsd-note">Curtain runs its own production tracker, so this approves Silva\'s submission against the job — it does not create a department budget entry.</div>';
  }
  function curtFoot() {
    var list = qCurt();
    if (!list.length) return '';
    return '<button class="opsd-btn flex" data-a="curt-ok">Approve the BOM</button>' +
      '<button class="opsd-btn sec" data-a="curt-back">Send back to production</button>' +
      (list.length > 1 ? '<span class="opsd-more">' + (list.length - 1) + ' more after this</span>' : '');
  }

  /* ── state: exceptions ───────────────────────────────────────────────── */
  function excBody() {
    var list = qExc();
    if (!list.length) return emptyHTML('Nothing is stalled', 'No job is blocked, reworked or over budget.');
    var j = list[0];
    var flags = safe(function () { return getJobAttentionFlags(j); }, []);
    return jobHeadHTML(j.projectName || j.id,
      j.id + ' · ' + customerName(j.customerId) + ' · ' + bd(j.amount),
      (j.promisedDate ? 'Promised ' + ddmmyyyy(j.promisedDate) : 'No promised date set')) +
      factsHTML(flags.map(function (f) { return [f.label || f.text || 'Flag', f.detail || f.sub || '', f.tone || 'warn']; })) +
      '<div class="opsd-note">The reason stays on the row — it is read from the job, not typed here.</div>';
  }
  function excFoot() {
    var list = qExc();
    if (!list.length) return '';
    return '<button class="opsd-btn flex" data-a="exc-open">Open the job card →</button>' +
      '<button class="opsd-btn sec" data-a="exc-msg">Message the department</button>' +
      (list.length > 1 ? '<span class="opsd-more">' + (list.length - 1) + ' more after this</span>' : '');
  }

  /* ── state: deliveries ───────────────────────────────────────────────── */
  function delBody() {
    var list = qDel();
    if (!list.length) return emptyHTML('Nothing waiting on a slot', 'Every production-complete job is booked.');
    var j = list[0];
    var sched = safe(function () {
      return getDeliverySchedule().filter(function (d) { return d.jobId === j.id; })[0];
    }, null);
    return jobHeadHTML(j.projectName || j.id,
      j.id + ' · ' + customerName(j.customerId) + ' · ' + bd(j.amount),
      'Production complete · QC passed') +
      factsHTML([
        ['Slot', sched ? ('Booked ' + ddmmyyyy(sched.plannedDate)) : 'Not booked — with the scheduler', sched ? 'ok' : 'bad'],
        ['Promised to the client', j.promisedDate ? ddmmyyyy(j.promisedDate) : 'No promised date set', j.promisedDate ? 'warn' : 'plain'],
        ['Target date', j.targetDate ? ddmmyyyy(j.targetDate) : '—', 'plain']
      ]) +
      '<div class="opsd-note">Operations never books the slot — that belongs to the delivery dashboard. You can nudge it.</div>';
  }
  function delFoot() {
    var list = qDel();
    if (!list.length) return '';
    return '<button class="opsd-btn flex" data-a="del-nudge">Nudge the delivery scheduler</button>' +
      '<button class="opsd-btn sec" data-a="del-urgent">Mark it urgent for the scheduler</button>' +
      (list.length > 1 ? '<span class="opsd-more">' + (list.length - 1) + ' more after this</span>' : '');
  }

  /* ── the widget ──────────────────────────────────────────────────────── */
  var HEAD = {
    route: ['The routing gate', 'Nothing downstream moves until you confirm. The next job is already open.'],
    quote: ['Quote approval', 'Feasibility and price sign-off before Sales sends it to the client.'],
    budget: ['BOM verification', 'Department BOMs against the confirmed selling price — nothing starts on the floor until you verify.'],
    exc: ['Exceptions', 'Blocked, stalled, reworked or over budget — the reason stays on the row.'],
    curt: ['Curtain BOM', "Silva's BOM against the confirmed selling price."],
    del: ['Upcoming deliveries', 'Ready and QC-passed. The delivery dashboard books the slot — you can nudge it.']
  };
  var BODY = { route: routeBody, quote: quoteBody, budget: budgetBody, exc: excBody, curt: curtBody, del: delBody };
  var FOOT = { route: routeFoot, quote: quoteFoot, budget: budgetFoot, exc: excFoot, curt: curtFoot, del: delFoot };

  function widgetHTML() {
    var h = HEAD[S.step] || HEAD.route;
    var step = STEPS.filter(function (t) { return t.k === S.step; })[0] || STEPS[1];
    var n = step.q().length;
    var foot = (FOOT[S.step] || FOOT.route)();
    return '<section class="opsd-w">' +
      '<div class="opsd-wh"><div style="flex:1 1 auto;min-width:0">' +
      '<div class="opsd-wh-t">' + esc(h[0]) + '</div>' +
      '<div class="opsd-wh-s">' + esc(h[1]) + '</div></div>' +
      '<span class="opsd-wh-pill">' + n + ' waiting</span>' +
      '<span class="opsd-expwrap"><button class="opsd-wh-exp" data-a="exp" aria-label="Open where?">⤢</button>' +
      (S.exp ? '<span class="opsd-expmenu">' +
        '<button data-a="exp-queue"><b>The approvals queue, full page</b></button>' +
        '<button data-a="exp-roll"><b>Job-wise roll-up</b><span>Every live job — selling vs BOM cost vs margin</span></button>' +
        '</span>' : '') +
      '</span></div>' +
      '<div class="opsd-wb">' + (BODY[S.step] || BODY.route)() + '</div>' +
      (foot ? '<div class="opsd-wf">' + foot + '</div>' : '') +
      '</section>';
  }

  /* ── capacity, rolling down to live items ────────────────────────────── */
  function capacityHTML() {
    var cap = safe(function () { return getWeekCapacity(); }, []);
    return '<section class="opsd-card">' +
      '<div class="opsd-ttl">Capacity this week</div>' +
      '<div class="opsd-sub">from team-leader day logs · you route against a booked paint booth, not against a list.</div>' +
      '<div class="opsd-caps">' + (cap.length ? cap.map(function (c) {
        // getWeekCapacity() rows are { key, label, roster, avail, logged, pct }.
        var pct = c.avail > 0 ? Math.round(c.logged / c.avail * 100) : 0;
        var tone = pct > 95 ? 'bad' : pct > 75 ? 'warn' : 'ok';
        var open = !!S.capOpen[c.key];
        var items = liveItemsFor(c.key);
        return '<div><button class="opsd-cap" data-a="cap" data-k="' + esc(c.key) + '">' +
          '<span class="opsd-cap-l"><span class="opsd-cap-n">' + esc(c.label) + '</span>' +
          '<span class="opsd-cap-p t-' + tone + '">' + pct + '%</span>' +
          '<span class="opsd-chev">' + (open ? '▾' : '▸') + '</span></span>' +
          '<span class="opsd-track"><i class="t-' + tone + '" style="width:' + Math.min(100, pct) + '%"></i></span>' +
          '<span class="opsd-cap-m"><span>' + Math.round(c.logged) + 'h booked of ' + Math.round(c.avail) + 'h</span>' +
          '<span>' + items.length + ' in production</span></span></button>' +
          (open ? '<div class="opsd-cap-open">' + (items.length ? items.map(function (i) {
            return '<div class="opsd-ci"><div class="opsd-ci-t"><span class="opsd-ci-n">' + esc(i.name) + '</span>' +
              '<span class="opsd-pill t-' + i.tone + '">' + esc(i.status) + '</span></div>' +
              '<div class="opsd-ci-m">' + esc(i.job) + (i.due ? ' · due ' + ddmmyyyy(i.due) : '') + '</div>' +
              '<div class="opsd-ci-bar"><span class="opsd-track"><i class="t-' + i.tone + '" style="width:' + i.pct + '%"></i></span>' +
              '<span class="opsd-ci-pct">' + i.pct + '% done</span></div></div>';
          }).join('') : '<div class="opsd-sub">Nothing in production for this department.</div>') + '</div>' : '') +
          '</div>';
      }).join('') : '<div class="opsd-sub">No day logs yet this week — team leaders log hours as work happens.</div>') +
      '</div></section>';
  }
  // Live lines sitting with one department, with their real pipeline progress.
  function liveItemsFor(deptKey) {
    var out = [];
    safe(function () { return jobCards; }, []).forEach(function (j) {
      if (j.status === 'cancelled' || !j.routingConfirmed) return;
      (j.items || []).forEach(function (it) {
        (it.departmentStatuses || []).forEach(function (ds) {
          if (ds.department !== deptKey) return;
          if (ds.status === 'done' || ds.status === 'pending') return;
          out.push({
            name: it.product, job: j.id,
            due: j.promisedDate || j.targetDate,
            status: ds.status === 'rework' ? 'Rework' : ds.status === 'qc' ? 'Awaiting QC'
              : ds.status === 'ready-for-handoff' ? 'Ready to hand off'
                : ds.status === 'queued' ? 'Queued' : 'In production',
            tone: ds.status === 'rework' ? 'bad' : ds.status === 'qc' ? 'warn' : 'ok',
            pct: safe(function () { return Math.round(jobLineProgressPercent(it)); }, 0)
          });
        });
      });
    });
    return out;
  }

  /* ── long KPI cards ──────────────────────────────────────────────────── */
  function itemsInProductionHTML() {
    // ROUTABLE_DEPTS already includes curt (only metal is excluded).
    var depts = safe(function () { return ROUTABLE_DEPTS.map(function (d) { return d.k; }); }, []);
    var jobIds = {};
    var cols = depts.map(function (d) {
      var items = liveItemsFor(d);
      items.forEach(function (i) { jobIds[i.job] = true; });
      var late = items.filter(function (i) { return i.due && i.due < new Date().toISOString().slice(0, 10); }).length;
      var rework = items.filter(function (i) { return i.tone === 'bad'; }).length;
      return {
        n: deptName(d), v: items.length,
        note: late ? late + ' late' : rework ? rework + ' in rework' : items.length ? 'on track' : '—',
        tone: late ? 'bad' : rework ? 'warn' : 'ok'
      };
    });
    var total = cols.reduce(function (s, c) { return s + c.v; }, 0);
    // The jobs actually CONTRIBUTING those items — a completed or fully
    // handed-off job is not in production, so counting every routed job here
    // would keep it in the total forever.
    var jobsN = Object.keys(jobIds).length;
    var lateJobs = safe(function () {
      var today = new Date().toISOString().slice(0, 10);
      return jobCards.filter(function (j) {
        return j.status === 'open' && j.promisedDate && j.promisedDate < today;
      }).length;
    }, 0);
    return longCardHTML('Items in production', total,
      'across ' + jobsN + ' job card' + (jobsN === 1 ? '' : 's') + (lateJobs ? ' · ' + lateJobs + ' past their promised date' : ''), cols);
  }
  function itemsSubcontractedHTML() {
    // Real source: subcontract entries on the BOMs of live jobs. No delivery
    // date exists on a subcontract line, so lateness is NOT shown — the
    // prototype's "2 past their delivery date" has nothing behind it here.
    var byVendor = {};
    var total = 0;
    safe(function () { return jobCards; }, []).forEach(function (j) {
      if (j.status === 'cancelled') return;
      (j.items || []).forEach(function (it) {
        if (!it.bom) return;
        (it.bom.subcontract || []).forEach(function (sc) {
          var v = sc.vendor || 'Unnamed';
          byVendor[v] = (byVendor[v] || 0) + 1;
          total++;
        });
      });
    });
    var cols = Object.keys(byVendor).sort(function (a, b) { return byVendor[b] - byVendor[a]; })
      .slice(0, 4).map(function (v) { return { n: v, v: byVendor[v], note: 'with the supplier', tone: 'ok' }; });
    while (cols.length && cols.length < 4) cols.push({ n: '', v: '', note: '', tone: 'ok' });
    return longCardHTML('Items subcontracted', total,
      total ? 'with outside suppliers · from the BOMs of live jobs' : 'nothing subcontracted on a live job',
      cols.length ? cols : [{ n: '—', v: 0, note: '', tone: 'ok' }]);
  }
  function longCardHTML(label, total, sub, cols) {
    return '<section class="opsd-card">' +
      '<div class="opsd-long-h"><span class="opsd-eyebrow">' + esc(label) + '</span>' +
      '<span class="opsd-long-tot">' + esc(String(total)) + '</span></div>' +
      '<div class="opsd-sub">' + esc(sub) + '</div>' +
      '<div class="opsd-long-cols">' + cols.map(function (c) {
        return '<div class="opsd-long-c"><b>' + esc(c.n) + '</b><u>' + esc(String(c.v)) + '</u>' +
          '<i class="t-' + c.tone + '">' + esc(c.note) + '</i></div>';
      }).join('') + '</div></section>';
  }

  /* ── KPI stack ───────────────────────────────────────────────────────── */
  function kpiHTML() {
    var today = new Date().toISOString().slice(0, 10);
    var open = safe(function () { return jobCards.filter(function (j) { return j.status === 'open'; }); }, []);
    var withDate = open.filter(function (j) { return j.promisedDate; });
    var slipping = withDate.filter(function (j) { return j.promisedDate < today; }).length;
    var onTime = withDate.length ? Math.round((withDate.length - slipping) / withDate.length * 100) : 100;

    var pend = qBudget();
    var held = pend.reduce(function (s, p) {
      return s + (p.entry ? bomCost(p.entry.bom) : 0);
    }, 0);

    var atRisk = 0;
    open.forEach(function (j) {
      (j.items || []).forEach(function (it) {
        var c = bomCost(it.bom);
        if (c > (it.netAmount || 0)) atRisk += c - (it.netAmount || 0);
      });
    });

    var reworkN = 0;
    open.forEach(function (j) {
      (j.items || []).forEach(function (it) {
        (it.departmentStatuses || []).forEach(function (ds) { if (ds.status === 'rework') reworkN++; });
      });
    });

    var del = qDel().length;
    var unbooked = safe(function () {
      var booked = getDeliverySchedule().map(function (d) { return d.jobId; });
      return qDel().filter(function (j) { return booked.indexOf(j.id) === -1; }).length;
    }, del);

    var rows = [
      ['On the promised date', (withDate.length - slipping) + ' of ' + withDate.length + ' job cards · ' + slipping + ' slipping', onTime + '%', onTime >= 90 ? 'ok' : onTime >= 75 ? 'warn' : 'bad'],
      ['BOMs waiting on you', held > 0 ? bd(held) + ' of cost held — the floor cannot start' : 'nothing held', String(pend.length), pend.length ? 'bad' : 'ok'],
      ['Margin at risk', 'lines costed above their selling price', (atRisk > 0 ? '−' : '') + bd(atRisk), atRisk > 0 ? 'bad' : 'ok'],
      ['In rework this week', 'QC failures absorbed, not charged', String(reworkN), reworkN ? 'warn' : 'ok'],
      ['Deliveries ready', unbooked + ' still unbooked', String(del), unbooked ? 'warn' : 'ok']
    ];
    return '<section class="opsd-card opsd-kpi">' + rows.map(function (r) {
      return '<div class="opsd-kpi-r"><span class="opsd-kpi-l"><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></span>' +
        '<span class="opsd-kpi-v t-' + r[3] + '">' + esc(r[2]) + '</span></div>';
    }).join('') + '</section>';
  }

  /* ── needs you now / held ────────────────────────────────────────────── */
  function needsYouHTML() {
    var list = qExc().slice(0, 6);
    return '<section class="opsd-card"><div class="opsd-ttl">Needs you now</div>' +
      '<div class="opsd-sub">Blocked, stalled, reworked or over budget — the reason stays on the row.</div>' +
      (list.length ? list.map(function (j) {
        var flags = safe(function () { return getJobAttentionFlags(j); }, []);
        return '<button class="opsd-row" data-a="job" data-k="' + esc(j.id) + '">' +
          '<span class="opsd-row-n"><span class="opsd-row-t">' + esc(j.projectName || j.id) + '</span>' +
          '<span class="opsd-row-s">' + esc(j.id + ' · ' + customerName(j.customerId) + ' · ' + bd(j.amount)) + '</span>' +
          '<span class="opsd-flags">' + flags.slice(0, 3).map(function (f) {
            return '<span class="opsd-pill t-' + (f.tone || 'warn') + '">' + esc(f.label || f.text || 'Flag') + '</span>';
          }).join('') + '</span></span><span class="opsd-chev">›</span></button>';
      }).join('') : '<div class="opsd-sub" style="margin-top:11px">Nothing needs you right now.</div>') +
      '</section>';
  }
  function heldHTML() {
    // "Held" has no field of its own in this app; a line sitting in rework
    // with the QC reject reason on it is the real equivalent, and the reason
    // is already recorded by the department that failed it.
    var rows = [];
    safe(function () { return jobCards; }, []).forEach(function (j) {
      if (j.status === 'cancelled') return;
      (j.items || []).forEach(function (it) {
        (it.departmentStatuses || []).forEach(function (ds) {
          if (ds.status !== 'rework') return;
          rows.push({
            job: j, line: it.product, dept: ds.department,
            reason: ds.rejectReason || 'Failed QC — no reason recorded',
            owner: safe(function () { return DEPT_HANDOFF_RECIPIENT[ds.department]; }, null) || deptName(ds.department)
          });
        });
      });
    });
    return '<section class="opsd-card"><div class="opsd-ttl">Held jobs</div>' +
      '<div class="opsd-sub">Sales can read the reason. Only you can clear it.</div>' +
      (rows.length ? rows.slice(0, 6).map(function (r) {
        return '<button class="opsd-row" data-a="job" data-k="' + esc(r.job.id) + '">' +
          '<span class="opsd-row-n"><span class="opsd-row-t">' + esc(r.line) + '</span>' +
          '<span class="opsd-row-s">' + esc(r.job.id + ' · ' + deptName(r.dept)) + '</span>' +
          '<span class="opsd-row-r">' + esc(r.reason) + '</span>' +
          '<span class="opsd-row-s">Unblock owner — ' + esc(r.owner) + '</span></span>' +
          '<span class="opsd-chev">›</span></button>';
      }).join('') : '<div class="opsd-sub" style="margin-top:11px">Nothing is held.</div>') +
      '</section>';
  }

  /* ── render ──────────────────────────────────────────────────────────── */
  function render() {
    // The weekly planner and My tasks are the shared collapsible widget
    // (planner-tasks.js) — the non-negotiables, one implementation, not a
    // fourth copy. Everything else on this screen is context for the queue.
    var plannerTasks = typeof renderPlannerAndTasks === 'function' ? renderPlannerAndTasks('opsd') : '';
    return '<div class="opsd-cols">' +
      '<div class="opsd-l">' + stepsHTML() + widgetHTML() + capacityHTML() + needsYouHTML() + heldHTML() + '</div>' +
      '<div class="opsd-r">' + itemsInProductionHTML() + itemsSubcontractedHTML() + kpiHTML() + plannerTasks + '</div>' +
      '</div>';
  }
  function paint() { if (root) { root.innerHTML = render(); } }

  /* ── actions ─────────────────────────────────────────────────────────── */
  function toast(msg) { S.toast = msg; paint(); }
  function alertMsg(m) { if (typeof showAlert === 'function') showAlert(m); else if (typeof commsToast === 'function') commsToast(m); }

  function onClick(e) {
    var el = e.target.closest('[data-a]');
    if (!el || !root.contains(el)) return;
    var a = el.getAttribute('data-a'), k = el.getAttribute('data-k');

    if (a === 'step') { S.step = k; S.exp = false; S.line = {}; S.deptOpen = {}; S.toast = ''; paint(); return; }
    if (a === 'exp') { S.exp = !S.exp; paint(); return; }
    // ⤢ is what keeps the detailed pages reachable now that the sidebar
    // follows 13b's decision list — so "full page" means THIS step's page,
    // not one fixed destination.
    if (a === 'exp-queue') {
      S.exp = false;
      var page = { route: 'alerts', budget: 'budgetapprovals', curt: 'curtapp', exc: 'projects', del: 'delivery', quote: 'projects' }[S.step] || 'projects';
      if (typeof opsGoTo === 'function') opsGoTo(page);
      return;
    }
    // "Every live job — selling vs BOM cost vs margin" is Operations' own
    // BOM / Budget page, which is exactly that roll-up.
    if (a === 'exp-roll') { S.exp = false; if (typeof opsGoTo === 'function') opsGoTo('bom'); return; }
    if (a === 'grp') { S.deptOpen[k] = !S.deptOpen[k]; paint(); return; }
    if (a === 'line') { S.line[k] = !S.line[k]; paint(); return; }
    if (a === 'cap') { S.capOpen[k] = !S.capOpen[k]; paint(); return; }
    if (a === 'job') { if (typeof execGoJob === 'function') execGoJob(k); else if (typeof openJobsModule === 'function') openJobsModule(k); return; }
    if (a === 'reason') {
      var rs = ['Technical detail outside Operations', 'Price concession needed', 'Client relationship call', 'I am on site / unavailable'];
      var r = rs[Number(el.getAttribute('data-i'))];
      S.delegR = S.delegR === r ? '' : r;      // single-select, tap again to clear
      paint(); return;
    }

    /* routing chips — tap ORDER is the sequence, untapping renumbers */
    if (a === 'chip') {
      var d = el.getAttribute('data-d');
      var jobs = qRoute(); if (!jobs.length) return;
      var job = jobs[0];
      var lineId = Number(k.split(':')[1]);
      var item = (job.items || []).filter(function (x) { return x.lineId === lineId; })[0];
      var cur = S.seq[k] || (item ? (item.departmentSequence || []).slice() : []);
      var i = cur.indexOf(d);
      S.seq[k] = i === -1 ? cur.concat([d]) : cur.filter(function (x) { return x !== d; });
      paint(); return;
    }
    if (a === 'urgent') { S.urgent = !S.urgent; paint(); return; }
    if (a === 'confirm') {
      var js = qRoute(); if (!js.length) return;
      var jb = js[0];
      var overrides = {};
      (jb.items || []).forEach(function (it) {
        var key = jb.id + ':' + it.lineId;
        overrides[it.lineId] = S.seq[key] || it.departmentSequence || [];
      });
      var unrouted = (jb.items || []).filter(function (it) { return !overrides[it.lineId].length; });
      if (unrouted.length) { alertMsg('Every line needs at least one department before you can dispatch.'); return; }
      if (S.urgent) safe(function () { return setJobUrgent(jb.id, true, me()); }, null);
      var res = safe(function () { return confirmJobRouting(jb.id, overrides, me(), S.date || null); }, { error: 'Routing failed.' });
      if (res && res.error) { alertMsg(res.error); return; }
      S.seq = {}; S.urgent = false; S.date = '';
      if (typeof updateOpsRoutingBadge === 'function') updateOpsRoutingBadge();
      if (typeof execRefreshNavGroups === 'function') execRefreshNavGroups();
      toast(jb.id + ' routed — ' + (jb.items || []).length + ' line(s) dispatched');
      return;
    }

    /* quote */
    if (a === 'delegate') {
      var qm = quoteModel(); if (!qm) return;
      if (!S.delegR) { alertMsg('Pick a reason first — it stays on the quote\'s audit trail.'); return; }
      var dir = safe(function () {
        var d = REACHABLE_PEOPLE.filter(function (p) { return /director/i.test(p); })[0];
        return d || 'Abdullah Abdul Haq';
      }, 'Abdullah Abdul Haq');
      var r1 = safe(function () { return delegateQuotation(qm.q.id, dir, me(), S.delegR); }, { error: 'Could not delegate.' });
      if (r1 && r1.error) { alertMsg(r1.error); return; }
      S.delegR = '';
      alertMsg('Delegated to ' + dir + ' — the reason is on the audit trail.');
      paint(); return;
    }
    if (a === 'sendback') {
      var qm2 = quoteModel(); if (!qm2) return;
      var why = window.prompt('Send back to Sales with what condition?');
      if (why === null) return;
      var r2 = safe(function () { return transferQuotationStage(qm2.q.id, 'sales', me()); }, { error: 'Could not send it back.' });
      if (r2 && r2.error) { alertMsg(r2.error); return; }
      safe(function () {
        logActivity({
          type: 'quote-feasibility', linkedType: 'quotation', linkedId: qm2.q.id, user: me(),
          message: 'Sent back to Sales on feasibility' + (why ? ': ' + why : ''), reason: why || null
        });
      }, null);
      paint(); return;
    }
    if (a === 'recommend') {
      var qm3 = quoteModel(); if (!qm3) return;
      // No Owner quote sign-off state exists in this app — see note 3. This
      // records the recommendation and tells the Owner, rather than faking a
      // lifecycle transition that nothing downstream would honour.
      safe(function () {
        logQuotationAudit(qm3.q, { action: 'Operations recommends', user: me(), userType: 'OPERATIONS', status: qm3.q.lifecycleStatus });
        persistQuotationUpdate(qm3.q);
      }, null);
      safe(function () {
        Promise.resolve(sendMessage({
          from: me(), to: 'Owner',
          body: 'Operations recommends quotation ' + qm3.q.id + ' (' + bd(qm3.total.sell) + ') for your counter-signature.',
          linkedType: 'quotation', linkedId: qm3.q.id
        })).catch(function () { });
      }, null);
      alertMsg('Recommended — the Owner has been messaged and it is on the audit trail.');
      paint(); return;
    }

    /* budget */
    if (a === 'bud-ok') {
      var bm = budgetModel(); if (!bm) return;
      var r3 = safe(function () { return approveDepartmentBudget(bm.job.id, bm.deptKey, me()); }, { error: 'Could not approve.' });
      if (r3 && r3.error) { alertMsg(r3.error); return; }
      if (typeof execRefreshNavGroups === 'function') execRefreshNavGroups();
      paint(); return;
    }
    if (a === 'bud-back') {
      var bm2 = budgetModel(); if (!bm2) return;
      var note = window.prompt('Why is it going back to ' + deptName(bm2.deptKey) + '?');
      if (note === null) return;
      if (!note.trim()) { alertMsg('A reason is required — the department needs to know what to fix.'); return; }
      var r4 = safe(function () { return rejectDepartmentBudget(bm2.job.id, bm2.deptKey, me(), note.trim()); }, { error: 'Could not send it back.' });
      if (r4 && r4.error) { alertMsg(r4.error); return; }
      if (typeof execRefreshNavGroups === 'function') execRefreshNavGroups();
      paint(); return;
    }

    /* curtain */
    if (a === 'curt-ok') {
      var cl = qCurt(); if (!cl.length) return;
      safe(function () { return approveCurtainBom(cl[0].id); }, null);
      paint(); return;
    }
    if (a === 'curt-back') {
      var cl2 = qCurt(); if (!cl2.length) return;
      var n2 = window.prompt('Why is it going back to production?');
      if (n2 === null) return;
      if (!n2.trim()) { alertMsg('Silva needs to know what to fix.'); return; }
      safe(function () {
        var j = curtainJobs.filter(function (x) { return x.id === cl2[0].id; })[0];
        if (!j) return;
        j.budgetStatus = 'rejected'; j.bomStatus = 'bom_pending'; j.bomRejectionComment = n2.trim();
      }, null);
      paint(); return;
    }

    /* exceptions + deliveries */
    if (a === 'exc-open') { var xl = qExc(); if (xl.length && typeof execGoJob === 'function') execGoJob(xl[0].id); return; }
    if (a === 'exc-msg') {
      var xl2 = qExc(); if (!xl2.length) return;
      if (typeof openComposeMessage === 'function') openComposeMessage(null, 'job', xl2[0].id);
      else if (typeof execToggleChat === 'function') execToggleChat();
      return;
    }
    if (a === 'del-nudge') {
      var dl = qDel(); if (!dl.length) return;
      safe(function () {
        Promise.resolve(sendMessage({
          from: me(), to: 'Delivery Scheduler',
          body: dl[0].id + ' is production-complete and still unbooked. Please book a slot.',
          linkedType: 'job', linkedId: dl[0].id
        })).catch(function () { });
      }, null);
      alertMsg('Nudged the scheduler.');
      return;
    }
    if (a === 'del-urgent') {
      var dl2 = qDel(); if (!dl2.length) return;
      safe(function () { return setJobUrgent(dl2[0].id, true, me()); }, null);
      alertMsg('Flagged urgent for the scheduler.');
      paint(); return;
    }
  }

  function onChange(e) {
    var el = e.target.closest('[data-a="date"]');
    if (!el || !root.contains(el)) return;
    S.date = el.value;
  }

  function mount(el) {
    root = el;
    root.classList.add('opsd');
    root.removeEventListener('click', onClick);
    root.addEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.addEventListener('change', onChange);
    paint();
  }

  return {
    mount: mount, render: render, paint: paint, state: S,
    setStep: function (k) { S.step = k; paint(); }
  };
})();
