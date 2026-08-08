/* ==========================================================================
   AMD-APP · Owner dashboard (redesign 4a)
   Vanilla JS, template strings, no build step, no libraries.
   Mirrors the existing renderXxxBody() + event-delegation pattern.

   Usage from owner.js:
       ownerBodyWrap.innerHTML = OwnerDashboard.render();
       OwnerDashboard.mount(ownerBodyWrap);

   The handoff shipped this file with an invented DATA block and said:
   "Replace the DATA block with your real getOwnerKPIs() / getPipelineFunnel()
   / getDeptQuality() calls. Everything below the DATA block is presentation
   and needs no change." That is exactly what happened — buildData() below
   assembles the same shapes from the app's own functions, and every
   renderer past it is the handoff's, unchanged.

   Three wiring changes the handoff itself called for, noted where they are:
     • agendaFor() keys by ISO date, not weekday, because getCalendarEvents()
       returns dated events (README: "Replace with getCalendarEvents()").
     • "today" is new Date(), not the mock's frozen 2026-08-07.
     • tasks read and write the app's real tasks[] primitive, so they persist
       to Supabase and stay in step with the shell's own My Tasks panel
       (README known gap: "task and list data is in-memory in the reference;
       it needs to persist to Supabase per user").
   ========================================================================== */

window.OwnerDashboard = (function () {
  'use strict';

  /* ---------------------------------------------------------------- data --
     Live values, assembled into the shapes the renderers expect.            */

  var DATA = {};

  function bd(n) {
    return 'BD ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  function ddmmm(isoStr) {
    if (!isoStr) return '—';
    var d = new Date(isoStr + 'T00:00:00');
    if (isNaN(d)) return isoStr;
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return String(d.getDate()).padStart(2, '0') + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
  }
  function pctDelta(now, prev) {
    if (!prev) return null;
    return Math.round(((now - prev) / prev) * 1000) / 10;
  }
  function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function safe(fn, fallback) { try { var v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }

  /* Owner's identity for anything person-scoped (tasks, calendar). */
  function me() {
    return safe(function () { return execIdentity(); }, 'Owner');
  }

  /* --- the four KPI tiles + their drill-downs ----------------------------- */
  function buildKpis() {
    var salesK = safe(getSalesKPIs, {});
    var acctK = safe(getAccountsKPIs, {});
    var jobK = safe(getJobCardKPIs, {});
    var now = new Date(), thisMonth = monthKey(now);
    var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1), prevMonth = monthKey(prev);

    var invThis = 0, invPrev = 0, invRows = [];
    (typeof taxInvoices !== 'undefined' ? taxInvoices : []).forEach(function (inv) {
      var m = (inv.date || '').slice(0, 7), v = (inv.totals && inv.totals.netTotal) || 0;
      if (m === thisMonth) { invThis += v; invRows.push([inv.id + ' · ' + (inv.projectName || inv.customerName || ''), bd(v)]); }
      if (m === prevMonth) invPrev += v;
    });
    var d = pctDelta(invThis, invPrev);

    var openQuotes = (typeof quotations !== 'undefined' ? quotations : []).filter(function (q) { return q.lifecycleStatus === 'open'; });
    var openValue = openQuotes.reduce(function (s, q) { return s + safe(function () { return computeQuotationTotals(q).netTotal; }, 0); }, 0);

    var jobs = (typeof jobCards !== 'undefined' ? jobCards : []).filter(function (j) { return j.status === 'open'; });
    var urgent = jobs.filter(function (j) { return j.urgent; });
    var today = new Date().toISOString().slice(0, 10);
    var overdue = jobs.filter(function (j) { return j.promisedDate && j.promisedDate < today; });

    var recvRows = (typeof taxInvoices !== 'undefined' ? taxInvoices : [])
      .map(function (inv) { return { inv: inv, bal: safe(function () { return invoiceBalance(inv); }, 0) }; })
      .filter(function (x) { return x.bal > 0.0005; })
      .sort(function (a, b) { return b.bal - a.bal; });

    DATA.kpis = [
      { k: 'revenue', label: 'Invoiced MTD', value: bd(invThis),
        delta: d === null ? (invThis ? 'first month of data' : 'nothing invoiced yet') : (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d) + '% vs ' + ddmmm(prevMonth + '-01').slice(3, 6),
        tone: d === null ? '' : (d >= 0 ? 'ok' : 'bad') },
      { k: 'quotes', label: 'Open quotes', value: bd(openValue), delta: openQuotes.length + ' live', tone: '' },
      { k: 'jobs', label: 'Active jobs', value: String(jobs.length),
        delta: urgent.length || overdue.length ? urgent.length + ' urgent · ' + overdue.length + ' past promised' : 'none urgent',
        tone: urgent.length || overdue.length ? 'bad' : '' },
      { k: 'recv', label: 'Receivables', value: bd(acctK.receivables || 0),
        delta: recvRows.length ? recvRows.length + ' invoice' + (recvRows.length === 1 ? '' : 's') + ' outstanding' : 'all settled',
        tone: recvRows.length ? 'warn' : '' }
    ];

    DATA.drill = {
      revenue: { title: 'Invoiced revenue', sub: ddmmm(thisMonth + '-01') + ' onwards', big: bd(invThis),
        rows: invRows.slice(0, 8).length ? invRows.slice(0, 8) : [['No invoices raised this month', '']] },
      quotes: { title: 'Open quotations', sub: openQuotes.length + ' live · awaiting client', big: bd(openValue),
        rows: openQuotes.slice(0, 8).map(function (q) {
          return [q.id + ' · ' + (q.projectName || ''), bd(safe(function () { return computeQuotationTotals(q).netTotal; }, 0))];
        }) },
      jobs: { title: 'Active jobs', sub: jobs.length + ' open · ' + urgent.length + ' urgent', big: String(jobs.length),
        rows: jobs.slice(0, 8).map(function (j) {
          var flags = safe(function () { return getJobAttentionFlags(j); }, []);
          return [j.id + ' · ' + (j.projectName || ''), flags.length ? flags.join(' · ') : 'On track'];
        }) },
      recv: { title: 'Receivables', sub: 'Outstanding invoices', big: bd(acctK.receivables || 0),
        rows: recvRows.slice(0, 8).map(function (x) { return [x.inv.id + ' · ' + (x.inv.customerName || x.inv.projectName || ''), bd(x.bal)]; }) }
    };
    DATA._salesK = salesK; DATA._acctK = acctK; DATA._jobK = jobK;
  }

  /* --- by department: every tile in that role's own vocabulary ------------ */
  function buildDept() {
    var salesK = DATA._salesK || {}, acctK = DATA._acctK || {};
    var today = new Date().toISOString().slice(0, 10);
    var qtns = typeof quotations !== 'undefined' ? quotations : [];
    var jobs = typeof jobCards !== 'undefined' ? jobCards : [];
    var openJobs = jobs.filter(function (j) { return j.status === 'open'; });
    var prs = typeof purchaseRequests !== 'undefined' ? purchaseRequests : [];
    var pos = typeof purchaseOrders !== 'undefined' ? purchaseOrders : [];
    var purchK = safe(getPurchasingKPIs, {});
    var hrK = safe(getHRKPIs, {});

    function n(x) { return String(x == null ? 0 : x); }
    function toneIf(cond, t) { return cond ? t : undefined; }

    var deptKeys = ['carp', 'uph', 'curt', 'paint'];
    var deptLetter = { carp: 'J', uph: 'U', curt: 'C', paint: 'P' };
    function prodCount(status) {
      var out = { carp: 0, uph: 0, curt: 0, paint: 0 };
      jobs.forEach(function (j) {
        (j.items || []).forEach(function (it) {
          (it.departmentStatuses || []).forEach(function (ds) {
            if (out[ds.department] === undefined) return;
            if (status.indexOf(ds.status) !== -1) out[ds.department]++;
          });
        });
      });
      return out;
    }
    function splitOf(counts) {
      return deptKeys.map(function (k) { return [deptLetter[k], counts[k]]; });
    }
    function total(counts) { return deptKeys.reduce(function (s, k) { return s + counts[k]; }, 0); }

    var inProd = prodCount(['in-production']);
    var atQC = prodCount(['qc']);
    var rework = prodCount(['rework']);
    var done = prodCount(['done']);

    var qcFails = 0, qcPasses = 0;
    deptKeys.forEach(function (k) {
      var t = k === 'curt' ? safe(function () { return getCurtainQCStats(); }, { passed: 0, failed: 0 })
                           : safe(function () { return getQCTrendForDept(k); }, { passed: 0, failed: 0 });
      qcPasses += (t.passed || 0); qcFails += (t.failed || 0);
    });

    // Per-department first-pass rate, for that tile's own split.
    var qcByDept = deptKeys.map(function (k) {
      var t = k === 'curt' ? safe(function () { return getCurtainQCStats(); }, { passed: 0, failed: 0 })
                           : safe(function () { return getQCTrendForDept(k); }, { passed: 0, failed: 0 });
      var tot = (t.passed || 0) + (t.failed || 0);
      return [deptLetter[k], tot ? Math.round((t.passed || 0) / tot * 100) + '%' : '—'];
    });
    var pendingRouting = safe(getJobsPendingRouting, []);
    var budgetsPending = safe(getAllPendingBudgetApprovals, []);
    var reorder = safe(getReorderAlerts, []);
    var matReq = safe(getOpenMaterialRequests, []);
    var attention = openJobs.filter(function (j) { return safe(function () { return getJobAttentionFlags(j).length; }, 0) > 0; });

    DATA.deptOrder = ['sales', 'estimator', 'operations', 'jobs', 'purchase', 'production', 'accounts', 'hr'];
    DATA.dept = {
      sales: { label: 'Sales', open: 'Open Sales', tiles: [
        { t: 'Enquiries', v: n(typeof enquiries !== 'undefined' ? enquiries.length : 0), s: n(salesK.unallocated) + ' unallocated', tone: toneIf(salesK.unallocated > 0, 'warn') },
        { t: 'Quotations', v: n(qtns.length), s: 'all time' },
        { t: 'Open quote value', v: DATA.kpis[1].value, s: DATA.kpis[1].delta },
        { t: 'With Estimator', v: n(salesK.withEstimator), s: 'being costed' },
        { t: 'To invoice', v: n(salesK.toInvoice), s: 'jobs ready' },
        { t: 'Receivables', v: bd(salesK.receivables || 0), s: 'outstanding' }] },
      estimator: { label: 'Estimator', open: 'Open Estimator', tiles: (function () {
        var e = safe(function () { return getEstimatorKPIs(me()); }, {});
        return [
          { t: 'Pending to pick', v: n(e.pendingToPick), s: 'waiting on an estimator', tone: toneIf(e.pendingToPick > 0, 'warn') },
          { t: 'My actions', v: n(e.myActions), s: 'in costing' },
          { t: 'With Approver', v: n(e.withApprover), s: 'awaiting approval' },
          { t: 'Confirmed', v: n(e.confirmed), s: 'became jobs' },
          { t: 'PR pending', v: n(e.prPending), s: 'awaiting PO' },
          { t: 'PR not received', v: n(e.prNotReceived), s: 'not yet delivered', tone: toneIf(e.prNotReceived > 0, 'warn') }];
      })() },
      operations: { label: 'Operations', open: 'Open Operations', tiles: [
        { t: 'Awaiting routing', v: n(pendingRouting.length), s: 'confirmed, not routed', tone: toneIf(pendingRouting.length > 0, 'bad') },
        { t: 'Budgets to approve', v: n(budgetsPending.length), s: 'department submissions', tone: toneIf(budgetsPending.length > 0, 'warn') },
        { t: 'Attention flags', v: n(attention.length), s: 'jobs needing a decision', tone: toneIf(attention.length > 0, 'bad') },
        { t: 'Ready to schedule', v: n(safe(function () { return opsReadyToScheduleJobs().length; }, 0)), s: 'production complete' },
        { t: 'Planned deliveries', v: n(safe(function () { return getDeliverySchedule().filter(function (d) { return d.status === 'planned'; }).length; }, 0)), s: 'booked in' },
        { t: 'Material requests', v: n(matReq.length), s: 'waiting on stores', tone: toneIf(matReq.length > 0, 'warn') }] },
      jobs: { label: 'Jobs', open: 'Open Jobs', tiles: [
        { t: 'Active job cards', v: n(openJobs.length), s: 'open right now' },
        { t: 'Urgent', v: n(openJobs.filter(function (j) { return j.urgent; }).length), s: 'client-critical', tone: toneIf(openJobs.filter(function (j) { return j.urgent; }).length > 0, 'bad') },
        { t: 'Past promised date', v: n(openJobs.filter(function (j) { return j.promisedDate && j.promisedDate < today; }).length), s: 'overdue', tone: toneIf(openJobs.filter(function (j) { return j.promisedDate && j.promisedDate < today; }).length > 0, 'bad') },
        { t: 'Unrouted', v: n(openJobs.filter(function (j) { return !j.routingConfirmed; }).length), s: 'locked until routed' },
        { t: 'Completed', v: n(jobs.filter(function (j) { return j.status === 'completed'; }).length), s: 'all time' },
        { t: 'Cancelled', v: n(jobs.filter(function (j) { return j.status === 'cancelled'; }).length), s: 'all time' }] },
      purchase: { label: 'Purchase', open: 'Open Purchasing', tiles: [
        { t: 'PR pending', v: n(prs.filter(function (p) { return p.status === 'open'; }).length), s: 'awaiting PO' },
        { t: 'PO awaiting approval', v: n(pos.filter(function (p) { return p.approvalStatus === 'pending'; }).length), s: 'needs a decision', tone: toneIf(pos.filter(function (p) { return p.approvalStatus === 'pending'; }).length > 0, 'warn') },
        { t: 'Open POs', v: n(pos.filter(function (p) { return p.status !== 'invoiced'; }).length), s: bd(DATA._acctK.pendingPOValue || 0) },
        { t: 'Stock alerts', v: n(reorder.length), s: 'below reorder level', tone: toneIf(reorder.length > 0, 'bad') },
        { t: 'Payables', v: bd(acctK.payables || 0), s: 'owed to suppliers' },
        { t: 'Suppliers', v: n(typeof suppliers !== 'undefined' ? suppliers.length : 0), s: 'on the master' }] },
      /* Production KPIs carry a department split as well as the total. */
      production: { label: 'Production', open: 'Open Production', tiles: [
        { t: 'In production', v: n(total(inProd)), s: 'lines being worked', split: splitOf(inProd) },
        { t: 'Awaiting QC', v: n(total(atQC)), s: 'submitted for check', tone: toneIf(total(atQC) > 0, 'warn'), split: splitOf(atQC) },
        { t: 'In rework', v: n(total(rework)), s: 'failed QC', tone: toneIf(total(rework) > 0, 'bad'), split: splitOf(rework) },
        { t: 'Completed lines', v: n(total(done)), s: 'through production', split: splitOf(done) },
        { t: 'First-pass QC', v: (qcPasses + qcFails) ? Math.round(qcPasses / (qcPasses + qcFails) * 100) + '%' : '—', s: (qcPasses + qcFails) ? qcPasses + ' of ' + (qcPasses + qcFails) + ' passed' : 'no QC results yet', tone: toneIf((qcPasses + qcFails) && (qcPasses / (qcPasses + qcFails)) < 0.85, 'warn'), bar: false, split: qcByDept },
        /* bar:false — these are percentages of each department's own capacity,
           so summing them into a proportional bar would be meaningless. */
        { t: 'Queue depth', v: n(total(inProd) + total(atQC)), s: 'in flight per department', bar: false,
          split: deptKeys.map(function (k) { return [deptLetter[k], inProd[k] + atQC[k]]; }) }] },
      accounts: { label: 'Accounts', open: 'Open Accounts', tiles: [
        { t: 'Receivables', v: bd(acctK.receivables || 0), s: 'owed to us' },
        { t: 'Payables', v: bd(acctK.payables || 0), s: 'we owe' },
        { t: 'Revenue invoiced', v: bd(acctK.revenue || 0), s: 'all time' },
        { t: 'Cash position', v: bd(acctK.cashPosition || 0), s: 'proxy' },
        { t: 'Sales invoices', v: n(acctK.invoiceCount), s: 'raised' },
        { t: 'Pending customers', v: n(safe(function () { return customers.filter(function (c) { return c.status === 'pending'; }).length; }, 0)), s: 'awaiting approval', tone: toneIf(safe(function () { return customers.filter(function (c) { return c.status === 'pending'; }).length; }, 0) > 0, 'warn') }] },
      hr: { label: 'HR', open: 'Open HR', tiles: (function () {
        // getHRKPIs() nests each category as {expiring, expired}.
        // Each category is {expiring:[], expired:[]} — arrays, not counts.
        var g = function (k, f) { var a = hrK[k] && hrK[k][f]; return Array.isArray(a) ? a.length : (a || 0); };
        return [
        { t: 'CPR expiring', v: n(g('cpr','expiring')), s: 'within 30 days', tone: toneIf(g('cpr','expiring') > 0, 'warn') },
        { t: 'CPR expired', v: n(g('cpr','expired')), s: 'action required', tone: toneIf(g('cpr','expired') > 0, 'bad') },
        { t: 'Visa expiring', v: n(g('visa','expiring')), s: 'within 30 days', tone: toneIf(g('visa','expiring') > 0, 'warn') },
        { t: 'Passport expiring', v: n(g('passport','expiring')), s: 'within 30 days', tone: toneIf(g('passport','expiring') > 0, 'warn') },
        { t: 'Contracts due', v: n(g('contract','expiring')), s: 'renewal due', tone: toneIf(g('contract','expiring') > 0, 'warn') },
        { t: 'Headcount', v: n(safe(function () { return employees.filter(function (e) { return e.status === 'Active'; }).length; }, 0)), s: 'active staff' }]; })() }
    };
  }

  /* --- revenue by division, with a real 6-month sparkline ----------------- */
  function buildDivisions() {
    var src = safe(function () { return getMonthlyRevenueByDivision(6); }, null);
    var months = (src && src.months) || [];
    var byMonth = (src && src.byMonthDiv) || {};
    var keys = (src && src.divisions) || [];
    var colours = ['var(--d1)', 'var(--d2)', 'var(--d3)', 'var(--d4)'];
    var latestKey = months.length ? months[months.length - 1].key : null;
    var prevKey = months.length > 1 ? months[months.length - 2].key : null;
    function val(mk, k) { return (mk && byMonth[mk] && byMonth[mk][k]) || 0; }
    var totalNow = keys.reduce(function (s2, k) { return s2 + val(latestKey, k); }, 0);

    // One shared 0 0 60 24 viewBox across all divisions, so the sparklines
    // stay comparable with each other rather than each scaling to its own max.
    var peak = 0;
    months.forEach(function (m) { keys.forEach(function (k) { peak = Math.max(peak, val(m.key, k)); }); });

    DATA.divisions = keys.map(function (k, i) {
      var v = val(latestKey, k), p = val(prevKey, k), dl = pctDelta(v, p);
      var pts = months.map(function (m, mi) {
        var x = months.length > 1 ? 2 + (mi * (56 / (months.length - 1))) : 30;
        var y = peak ? 22 - (val(m.key, k) / peak) * 19 : 22;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      return {
        n: k, c: colours[i % 4],
        pct: totalNow ? Math.round(v / totalNow * 100) : 0,
        value: bd(v),
        delta: dl === null ? '—' : (dl >= 0 ? '▲ ' : '▼ ') + Math.abs(dl) + '%',
        tone: dl === null ? 'ok' : (dl >= 0 ? 'ok' : 'bad'),
        spark: pts
      };
    }).sort(function (a, b) { return b.pct - a.pct; });
    DATA.divisionsTotal = bd(totalNow);
  }

  /* --- funnel / clients / quality ----------------------------------------- */
  function buildPipeline() {
    // PATCH 08 Aug 2026 §1: the funnel now carries the stage's value as well
    // as its count, in full BD format — the old build put a shortened "386.9k"
    // in a narrow grey column, which is neither the house format nor legible.
    var src = safe(getPipelineFunnel, null);
    var stages = (src && src.stages) || [];
    var byStage = (src && src.byStage) || {};
    var top = stages.reduce(function (m, st) { return Math.max(m, (byStage[st] && byStage[st].count) || 0); }, 0);
    var ramp = ['var(--wine)', 'var(--wine2)', 'var(--wine3)', 'var(--wine-line)'];
    DATA.funnel = stages.map(function (st, i) {
      var c = (byStage[st] && byStage[st].count) || 0;
      return {
        label: st + ' · ' + c,
        value: bd((byStage[st] && byStage[st].value) || 0),
        w: top ? Math.max(4, Math.round(c / top * 100)) : 0,
        c: ramp[i % 4]
      };
    });

    var clients = safe(function () { return getTopClientsByValue(3); }, []);
    var cTop = clients.length ? clients[0].value : 0;
    DATA.clients = clients.map(function (c, i) {
      return { n: c.name, v: bd(c.value), w: cTop ? Math.round(c.value / cTop * 100) : 0, c: ramp[i % 3] };
    });

    var qDefs = [['carp', 'Joinery'], ['uph', 'Uphol.'], ['paint', 'Painting'], ['curt', 'Curtains']];
    DATA.quality = qDefs.map(function (q) {
      var t = q[0] === 'curt' ? safe(function () { return getCurtainQCStats(); }, { passed: 0, failed: 0 })
                              : safe(function () { return getQCTrendForDept(q[0]); }, { passed: 0, failed: 0 });
      var tot = (t.passed || 0) + (t.failed || 0);
      var pct = tot ? Math.round((t.passed || 0) / tot * 100) : 0;
      return { n: q[1], pct: pct, tone: tot === 0 || pct >= 85 ? 'ok' : 'warn' };
    });
  }

  /* --- profit & loss (PATCH 08 Aug 2026 §2) -------------------------------
     Quarterly or running-cumulative revenue, cost and net profit. Revenue is
     invoiced (taxInvoices) and cost is purchased (purchaseInvoices) — the same
     two transactional sources the app's own P&L report reads, rather than the
     ledger layer, for the reason recorded when that report was built: the seed
     Chart of Accounts files Sales under Current Assets, so a pure-GL P&L shows
     zero direct income. Figures are in thousands, as the patch's own shape is. */
  function buildPnl() {
    var now = new Date(), year = now.getFullYear();
    function qOf(isoStr) {
      if (!isoStr) return -1;
      var d = new Date(isoStr + 'T00:00:00');
      return isNaN(d) || d.getFullYear() !== year ? -1 : Math.floor(d.getMonth() / 3);
    }
    var rows = [0, 1, 2, 3].map(function (q) { return { q: 'Q' + (q + 1) + ' ' + year, rev: 0, cost: 0 }; });
    (typeof taxInvoices !== 'undefined' ? taxInvoices : []).forEach(function (inv) {
      var q = qOf(inv.date); if (q >= 0) rows[q].rev += ((inv.totals && inv.totals.netTotal) || 0) / 1000;
    });
    (typeof purchaseInvoices !== 'undefined' ? purchaseInvoices : []).forEach(function (pi) {
      var q = qOf(pi.date); if (q >= 0) rows[q].cost += ((pi.totals && pi.totals.netAmount) || 0) / 1000;
    });
    /* The quarter we're in is only part-way through. Saying so keeps a short
       bar from reading as a collapse in trade. */
    var thisQ = Math.floor(now.getMonth() / 3);
    rows[thisQ].partial = true;
    DATA.pnl = rows.slice(0, thisQ + 1);
  }
  /* Above a thousand-k, read as millions — running mode crosses that. */
  function pnlFmt(k) {
    return k >= 1000 ? 'BD ' + (k / 1000).toFixed(2) + 'm' : 'BD ' + k.toFixed(1) + 'k';
  }
  function pnlSeries() {
    var rows = DATA.pnl || [];
    if (S.pnlMode !== 'Running') return rows.slice();
    var rev = 0, cost = 0;
    return rows.map(function (r) {
      rev += r.rev; cost += r.cost;
      return { q: r.q, rev: rev, cost: cost, partial: r.partial };
    });
  }
  function pnlCard(){
    /* The patch's own rule: Owner and Accounts only, never Sales. The Owner
       dashboard is already role-gated, so this is belt and braces — but the
       rule it enforces is the fraud-prevention one, so it is worth the line. */
    if (typeof isSalesRole === 'function' && isSalesRole()) return '';
    var rows = pnlSeries();
    if (!rows.length) {
      return '<section class="od-card od-span2">' +
        '<div class="od-title">Profit &amp; loss</div>' +
        '<div class="od-sub" style="margin-bottom:2px">Nothing invoiced or purchased yet this year.</div>' +
      '</section>';
    }
    var last = rows[rows.length - 1], prev = rows.length > 1 ? rows[rows.length - 2] : null;
    var net = last.rev - last.cost;
    var margin = last.rev ? (net / last.rev * 100) : 0;
    var prevMargin = prev && prev.rev ? ((prev.rev - prev.cost) / prev.rev * 100) : null;
    var pts = prevMargin === null ? null : Math.round((margin - prevMargin) * 10) / 10;
    var peak = rows.reduce(function (m, r) { return Math.max(m, r.rev, r.cost, Math.abs(r.rev - r.cost)); }, 0) || 1;

    function bar(label, val, colour) {
      return '<div>' +
        '<div class="od-fstep-h">' +
          '<span class="od-fstep-l">' + esc(label) + '</span>' +
          '<span class="od-fstep-v">' + esc(pnlFmt(val)) + '</span>' +
        '</div>' +
        // a genuinely zero period draws nothing; a small non-zero one keeps a
        // visible 1% rather than rounding away to an empty track
        '<span class="od-track"><i style="width:' + (val ? Math.max(1, Math.round(Math.abs(val) / peak * 100)) : 0) + '%;background:' + colour + '"></i></span>' +
      '</div>';
    }

    var groups = rows.map(function (r) {
      var n = r.rev - r.cost;
      return '<div class="od-pnl-q">' +
        '<div class="od-pnl-qh">' + esc(r.q) +
          (r.partial ? '<span class="od-pnl-part">part-quarter to date</span>' : '') + '</div>' +
        bar('Revenue', r.rev, 'var(--wine)') +
        bar('Cost', r.cost, 'var(--wine-line)') +
        bar('Net profit', n, n < 0 ? 'var(--bad)' : 'var(--ok)') +
      '</div>';
    }).join('');

    return '<section class="od-card od-span2">' +
      '<div class="od-card-h" style="margin-bottom:4px">' +
        '<span class="od-title">Profit &amp; loss</span>' +
        '<div class="od-seg" role="tablist">' +
          ['Quarterly','Running'].map(function(k){
            return '<button role="tab" aria-selected="' + (S.pnlMode === k) + '" data-act="pnlmode" data-v="' + k + '">' + k + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="od-sub" style="margin-bottom:12px">Invoiced revenue against purchased cost' +
        (S.pnlMode === 'Running' ? ' · cumulative year to date' : ' · per quarter') + '</div>' +
      '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:13px">' +
        '<span style="font-size:24px;font-weight:650;letter-spacing:-.02em;color:' + (net < 0 ? 'var(--bad)' : 'var(--tx)') + '">' + esc(pnlFmt(net)) + '</span>' +
        '<span style="font-size:12px;color:var(--tx3)">net · ' + margin.toFixed(1) + '% margin</span>' +
        (pts === null ? '' : '<span style="font-size:11.5px;font-weight:700;color:var(--' + (pts >= 0 ? 'ok' : 'bad') + ')">' +
          (pts >= 0 ? '▲ ' : '▼ ') + Math.abs(pts).toFixed(1) + ' pts</span>') +
      '</div>' +
      '<div class="od-pnl">' + groups + '</div>' +
    '</section>';
  }

  /* --- money: cash, expenses, purchases ----------------------------------- */
  function buildMoney() {
    var acctK = DATA._acctK || {};
    var cashLedgers = (typeof ledgers !== 'undefined' ? ledgers : [])
      .filter(function (l) { return l.group === 'Cash Accounts' || l.group === 'Bank Accounts'; })
      .map(function (l) { return { n: l.name, bal: safe(function () { return getLedgerBalance(l.name); }, 0) }; })
      .filter(function (l) { return Math.abs(l.bal) > 0.0005; })
      .sort(function (a, b) { return b.bal - a.bal; });
    var cashTotal = cashLedgers.reduce(function (s, l) { return s + l.bal; }, 0);
    var top = cashLedgers.length ? Math.abs(cashLedgers[0].bal) : 0;
    var ramp = ['var(--wine)', 'var(--wine2)', 'var(--wine3)'];

    DATA.cash = {
      total: bd(cashTotal),
      delta: cashLedgers.length ? '▲ ' + cashLedgers.length + ' account' + (cashLedgers.length === 1 ? '' : 's') : 'no ledger movement',
      deltaNote: 'with a balance',
      committed: '− ' + bd(acctK.pendingPOValue || 0),
      accounts: cashLedgers.slice(0, 3).map(function (l, i) {
        return { n: l.n, v: bd(l.bal), w: top ? Math.round(Math.abs(l.bal) / top * 100) : 0, c: ramp[i % 3] };
      })
    };
    if (!DATA.cash.accounts.length) {
      DATA.cash.accounts = [{ n: 'No cash or bank ledger has a balance yet', v: bd(0), w: 0, c: 'var(--wine)' }];
    }

    var pis = (typeof purchaseInvoices !== 'undefined' ? purchaseInvoices : [])
      .slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    var weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    var weekTotal = pis.filter(function (p) { return (p.date || '') >= weekAgo; })
      .reduce(function (s, p) { return s + ((p.totals && p.totals.netAmount) || 0); }, 0);
    DATA.expenses = {
      week: bd(weekTotal) + ' this week',
      rows: pis.slice(0, 4).map(function (p) {
        return {
          t: (p.items && p.items[0] ? p.items[0].itemName : p.id) + (p.items && p.items.length > 1 ? ' + ' + (p.items.length - 1) + ' more' : ''),
          m: (safe(function () { return dc(p.department).n; }, p.department || 'Purchasing')) + ' · ' + ddmmm(p.date),
          v: bd((p.totals && p.totals.netAmount) || 0)
        };
      })
    };
    if (!DATA.expenses.rows.length) DATA.expenses.rows = [{ t: 'No purchase invoices recorded yet', m: 'Purchasing', v: bd(0) }];

    var now = new Date(), thisMonth = monthKey(now);
    var monthPOs = (typeof purchaseOrders !== 'undefined' ? purchaseOrders : [])
      .map(function (po) {
        return { po: po, v: (po.items || []).reduce(function (s, it) { return s + (it.netAmountBD || 0); }, 0) };
      })
      .filter(function (x) { return (x.po.date || '').slice(0, 7) === thisMonth; })
      .sort(function (a, b) { return b.v - a.v; });
    var poTop = monthPOs.length ? monthPOs[0].v : 0;
    var poTotal = monthPOs.reduce(function (s, x) { return s + x.v; }, 0);
    DATA.purchases = {
      month: ddmmm(thisMonth + '-01').slice(3) + ' · ' + bd(poTotal) + ' total',
      rows: monthPOs.slice(0, 4).map(function (x) {
        return {
          t: (x.po.items && x.po.items[0] ? x.po.items[0].productService : x.po.id),
          m: x.po.id + ' · ' + safe(function () { return dc(x.po.department).n; }, x.po.department || ''),
          v: bd(x.v), w: poTop ? Math.round(x.v / poTop * 100) : 0
        };
      })
    };
    if (!DATA.purchases.rows.length) DATA.purchases.rows = [{ t: 'No purchase orders raised this month', m: 'Purchasing', v: bd(0), w: 0 }];
  }

  /* --- company health -----------------------------------------------------
     The weakest signal sets the tone and is named explicitly, so the
     composite can never read better than the worst part of the business.   */
  function buildHealth() {
    var acctK = DATA._acctK || {};
    var jobs = (typeof jobCards !== 'undefined' ? jobCards : []).filter(function (j) { return j.status === 'open'; });

    var cashPct = (function () {
      var cash = acctK.cashPosition || 0, committed = acctK.pendingPOValue || 0;
      if (cash <= 0) return 10;
      if (!committed) return 90;
      return Math.max(5, Math.min(100, Math.round(cash / (cash + committed) * 100)));
    })();
    var recvPct = (function () {
      var r = acctK.receivables || 0, rev = acctK.revenue || 0;
      if (!rev) return 70;
      return Math.max(5, Math.min(100, Math.round((1 - r / rev) * 100)));
    })();
    var prodPct = (function () {
      if (!jobs.length) return 75;
      var flagged = jobs.filter(function (j) { return safe(function () { return getJobAttentionFlags(j).length; }, 0) > 0; }).length;
      return Math.max(5, Math.round((1 - flagged / jobs.length) * 100));
    })();
    var qualityPct = (function () {
      var pass = 0, fail = 0;
      DATA.quality.forEach(function (q) { if (q.pct) { pass += q.pct; fail += 100 - q.pct; } });
      var withData = DATA.quality.filter(function (q) { return q.pct; }).length;
      return withData ? Math.round(pass / withData) : 80;
    })();

    function word(p) { return p >= 80 ? 'Strong' : p >= 65 ? 'On track' : p >= 45 ? 'Watch' : 'At risk'; }
    function colour(p) { return p >= 65 ? 'var(--ok)' : p >= 45 ? 'var(--warn)' : 'var(--bad)'; }

    var signals = [
      { n: 'Cash', s: word(cashPct), pct: cashPct, c: colour(cashPct) },
      { n: 'Receivables', s: word(recvPct), pct: recvPct, c: colour(recvPct) },
      { n: 'Production', s: word(prodPct), pct: prodPct, c: colour(prodPct) },
      { n: 'Quality', s: word(qualityPct), pct: qualityPct, c: colour(qualityPct) }
    ];
    var weakest = signals.slice().sort(function (a, b) { return a.pct - b.pct; })[0];
    var notes = {
      Cash: 'Cash is tight against what is already committed to open purchase orders.',
      Receivables: 'Too much of what has been invoiced is still outstanding.',
      Production: 'Open jobs are carrying attention flags — routing, budgets or overdue dates.',
      Quality: 'QC pass rates are the drag — check the department quality rings below.'
    };
    DATA.health = {
      score: Math.round(signals.reduce(function (s, x) { return s + x.pct; }, 0) / 4),
      note: weakest.pct >= 80 ? 'No signal is dragging right now — the weakest is ' + weakest.n + ' at ' + weakest.pct + '%.'
                              : notes[weakest.n] + ' (' + weakest.n + ' at ' + weakest.pct + '%.)',
      signals: signals
    };
  }

  /* --- activity, calendar, tasks ------------------------------------------ */
  function buildFeeds() {
    var acts = safe(function () { return getRecentActivity(3); }, []);
    DATA.activity = acts.map(function (a) {
      var c = /fail|reject|cancel|declin/i.test(a.type || '') ? 'var(--bad)'
            : /approve|paid|pass|complete|fulfil/i.test(a.type || '') ? 'var(--ok)' : 'var(--wine)';
      return { t: a.message, d: ddmmm(a.date) + (a.by ? ' · ' + a.by : ''), c: c };
    });
    if (!DATA.activity.length) DATA.activity = [{ t: 'Nothing has happened yet today', d: ddmmm(new Date().toISOString().slice(0, 10)), c: 'var(--tx3)' }];

    /* Calendar commitments, keyed by ISO date (the handoff keyed by weekday
       and said to replace this with getCalendarEvents(), which is dated). */
    var evs = safe(function () { return getCalendarEvents(me(), 'owner'); }, []);
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

    DATA.jobPool = (typeof jobCards !== 'undefined' ? jobCards : [])
      .filter(function (j) { return j.status === 'open'; }).map(function (j) { return j.id; });
  }

  /* Task lists are this app's own addition — the handoff's model needs them,
     and tasks[] has no list concept. Stored on the task object itself so it
     rides the existing app_tasks jsonb payload with no schema change. */
  var LISTS = [
    { k: 'ops', n: 'Operations', c: 'var(--d3)' },
    { k: 'sales', n: 'Sales', c: 'var(--d1)' },
    { k: 'accounts', n: 'Accounts', c: 'var(--d4)' },
    { k: 'site', n: 'Site visits', c: 'var(--d2)' }
  ];

  function loadTasks() {
    var today = new Date().toISOString().slice(0, 10);
    var mine = (typeof tasks !== 'undefined' ? tasks : []).filter(function (t) { return t.assignee === me(); });
    S.tasks = mine.map(function (t) {
      return {
        id: t.id, t: t.title, done: t.status === 'done',
        job: t.linkedType === 'job' ? t.linkedId : null,
        list: t.list || 'ops',
        due: t.dueDate ? ddmmm(t.dueDate) : 'No due date',
        today: !!(t.dueDate && t.dueDate <= today),
        urgent: !!t.urgent
      };
    });
  }
  function appTask(id) { return (typeof tasks !== 'undefined' ? tasks : []).filter(function (t) { return t.id === id; })[0]; }

  function buildData() {
    buildKpis(); buildDept(); buildDivisions(); buildPipeline();
    buildMoney(); buildPnl(); buildHealth(); buildFeeds(); loadTasks();
    S.lists = LISTS.slice();
  }

  /* --------------------------------------------------------------- state -- */

  var S = {
    dept:'sales',
    tasksOpen:true, weekOpen:true,
    taskFilter:'all',
    nextTask:128, nextList:1,
    pnlMode:'Quarterly',
    planScope:'Week', planOffset:0,
    selDate:new Date().toISOString().slice(0,10),   // real today, per the README
    lists:LISTS.slice(),
    tasks:[]
  };

  var root = null;
  function paint(){ if (root){ root.innerHTML = render(); } }

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
  function monday(d){ return addDays(d, -(((d.getUTCDay()+6)%7)) ); }
  function iso(d){ return d.toISOString().slice(0,10); }
  function parseIso(s){ return new Date(s+'T00:00:00Z'); }
  function wdKey(d){ return WD[(d.getUTCDay()+6)%7]; }
  function fmtDate(d){
    return String(d.getUTCDate()).padStart(2,'0') + ' ' +
           MN[d.getUTCMonth()].slice(0,3) + ' ' + d.getUTCFullYear();
  }
  /* Keyed by ISO date now that this reads real dated events. */
  function agendaFor(d){ return DATA.week[iso(d)] || []; }
  function todayIso(){ return new Date().toISOString().slice(0,10); }
  function tone(t){ return t === 'bad' ? 'is-bad' : t === 'warn' ? 'is-warn' : t === 'ok' ? 'is-ok' : ''; }

  /* ------------------------------------------------------------- renderers -- */

  function kpiBand(){
    return DATA.kpis.map(function(k){
      return '<button class="od-kpi ' + tone(k.tone === 'ok' ? '' : k.tone) + '" data-act="drill" data-k="' + k.k + '">' +
        '<span class="od-kpi-l">' + esc(k.label) + '<span aria-hidden="true">›</span></span>' +
        '<span class="od-kpi-v">' + esc(k.value) + '</span>' +
        '<span class="od-kpi-d ' + tone(k.tone) + '">' + esc(k.delta) + '</span>' +
      '</button>';
    }).join('');
  }

  /* --- week planner ------------------------------------------------------- */

  function calendar(){
    var sel = parseIso(S.selDate), cells = [], label = '', range = '', count = 0, i, d;
    var now = parseIso(todayIso());

    function cell(date, inMonth){
      var items = agendaFor(date), isSel = iso(date) === S.selDate;
      return '<button class="od-day' + (inMonth ? '' : ' is-out') + '" role="tab"' +
        ' aria-selected="' + (isSel ? 'true' : 'false') + '"' +
        ' data-act="pickday" data-d="' + iso(date) + '">' +
        (S.planScope === 'Week'
          ? '<span class="od-day-w">' + WDL[(date.getUTCDay()+6)%7] + '</span>' : '') +
        '<span class="od-day-n">' + String(date.getUTCDate()).padStart(2,'0') + '</span>' +
        '<i class="od-day-dot' + (items.length && inMonth ? ' has' : '') + '"></i>' +
      '</button>';
    }

    if (S.planScope === 'Week') {
      var start = addDays(monday(now), S.planOffset * 7);
      for (i = 0; i < 7; i++) { d = addDays(start,i); cells.push(cell(d,true)); count += agendaFor(d).length; }
      label = S.planOffset === 0 ? 'This week'
            : S.planOffset === -1 ? 'Last week'
            : S.planOffset === 1 ? 'Next week'
            : (S.planOffset < 0 ? Math.abs(S.planOffset)+' weeks back' : S.planOffset+' weeks ahead');
      range = fmtDate(start).slice(0,6) + ' – ' + fmtDate(addDays(start,6));
      return { html:'<div class="od-days" role="tablist">'+cells.join('')+'</div>',
               label:label, range:range, count:count };
    }

    var first = utc(now.getUTCFullYear(), now.getUTCMonth() + S.planOffset, 1), gs = monday(first);
    for (i = 0; i < 42; i++) {
      d = addDays(gs,i);
      var inM = d.getUTCMonth() === first.getUTCMonth();
      cells.push(cell(d,inM));
      if (inM) count += agendaFor(d).length;
    }
    var head = WDL.map(function(w){ return '<span class="od-month-h">'+w.charAt(0)+'</span>'; }).join('');
    return {
      html:'<div class="od-month" style="margin-bottom:4px">'+head+'</div>' +
           '<div class="od-month" role="tablist">'+cells.join('')+'</div>',
      label: MN[first.getUTCMonth()] + ' ' + first.getUTCFullYear(),
      range:'', count:count
    };
  }

  function plannerCard(){
    var cal = calendar(), sel = parseIso(S.selDate), items = agendaFor(sel);

    var body = !S.weekOpen ? '' :
      '<div style="margin-top:11px">' +
        '<div style="display:flex;align-items:center;gap:5px;margin-bottom:9px">' +
          '<div class="od-seg" role="tablist">' +
            ['Week','Month'].map(function(k){
              return '<button role="tab" aria-selected="' + (S.planScope===k) + '" data-act="scope" data-v="'+k+'">'+k+'</button>';
            }).join('') +
          '</div>' +
          '<span style="flex:1"></span>' +
          '<button class="od-navbtn" data-act="period" data-v="-1" aria-label="Previous">‹</button>' +
          '<button class="od-navbtn" data-act="period" data-v="0">Today</button>' +
          '<button class="od-navbtn" data-act="period" data-v="1" aria-label="Next">›</button>' +
        '</div>' +
        '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:9px">' +
          '<span style="font-size:12.5px;font-weight:650;color:var(--tx)">' + esc(cal.label) + '</span>' +
          '<span style="font-size:10.5px;color:var(--tx3)">' + esc(cal.range) + '</span>' +
        '</div>' +
        cal.html +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin:12px 0 7px">' +
          '<span style="font-size:12px;font-weight:650;color:var(--tx)">' + WDL[(sel.getUTCDay()+6)%7] + ' ' + fmtDate(sel) + '</span>' +
          '<span style="font-size:10.5px;color:var(--tx3)">' + items.length + ' scheduled</span>' +
        '</div>' +
        '<div class="od-agenda">' + (items.length ? items.map(function(a){
          return '<div class="od-ag">' +
            '<span class="od-ag-t">' + esc(a.t) + '</span>' +
            '<span style="flex:1;min-width:0">' +
              '<span class="od-ag-ttl">' + esc(a.ttl) + '</span>' +
              '<span class="od-tag ' + (a.tone === 'wine' ? 'is-wine' : tone(a.tone)) + '">' + esc(a.tag) + '</span>' +
            '</span>' +
          '</div>';
        }).join('') : '<div style="padding:16px 0;text-align:center;font-size:11.5px;color:var(--tx3)">Nothing scheduled</div>') + '</div>' +
        '<button class="od-add" data-act="openplanner">Open planner ›</button>' +
      '</div>';

    return '<section class="od-card">' +
      '<button class="od-toggle" data-act="togglweek" aria-expanded="' + S.weekOpen + '">' +
        '<span style="flex:1" class="od-title">This week</span>' +
        '<span class="od-count">' + cal.count + '</span>' +
        '<span class="od-chev">' + (S.weekOpen ? '⌃' : '⌄') + '</span>' +
      '</button>' + body +
    '</section>';
  }

  /* --- tasks (Apple Reminders model) -------------------------------------- */

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
      {k:'today',  g:'▤',  label:'Today',     n:S.tasks.filter(function(t){ return !t.done && t.today; }).length},
      {k:'urgent', g:'!!', label:'Urgent',    n:S.tasks.filter(function(t){ return !t.done && t.urgent; }).length},
      {k:'all',    g:'▦',  label:'All',       n:open},
      {k:'done',   g:'✓',  label:'Completed', n:S.tasks.filter(function(t){ return t.done; }).length}
    ].map(function(x){
      return '<button class="od-tile" data-k="' + x.k + '" data-act="filter" data-v="' + x.k + '"' +
        ' aria-selected="' + (S.taskFilter === x.k) + '">' +
        '<span class="od-tile-r"><i class="od-tile-g">' + x.g + '</i><span class="od-tile-n">' + x.n + '</span></span>' +
        '<span class="od-tile-l">' + x.label + '</span>' +
      '</button>';
    }).join('');

    var rows = S.tasks.filter(taskPasses).map(function(t){
      var L = S.lists.filter(function(l){ return l.k === t.list; })[0];
      return '<div class="od-task' + (t.done ? ' is-done' : '') + '">' +
        '<button class="od-check" data-act="check" data-id="' + t.id + '" aria-checked="' + t.done + '" role="checkbox">' + (t.done ? '✓' : '') + '</button>' +
        '<span style="flex:1;min-width:0">' +
          '<span style="display:flex;align-items:baseline">' +
            (t.urgent ? '<i class="od-bang">‼</i>' : '') +
            '<span class="od-task-t">' + esc(t.t) + '</span>' +
          '</span>' +
          '<span class="od-task-m">' +
            '<button class="od-pill" data-act="move" data-id="' + t.id + '" title="Move to next list">' +
              '<i style="background:' + (L ? L.c : 'var(--tx3)') + '"></i>' + esc(L ? L.n : 'No list') +
            '</button>' +
            '<span class="od-due' + ((t.today || t.urgent) && !t.done ? ' is-soon' : '') + '">' + esc(t.due) + '</span>' +
            (t.job
              ? '<span class="od-job">' + esc(t.job) + '</span>'
              : '<button class="od-job-add" data-act="link" data-id="' + t.id + '">＋ Link job</button>') +
          '</span>' +
        '</span>' +
      '</div>';
    }).join('');

    var lists = S.lists.map(function(l){
      var n = S.tasks.filter(function(t){ return !t.done && t.list === l.k; }).length;
      return '<button class="od-list" data-act="filter" data-v="' + l.k + '" aria-selected="' + (S.taskFilter === l.k) + '">' +
        '<i style="background:' + l.c + '">≡</i>' +
        '<span class="od-list-n">' + esc(l.n) + '</span>' +
        '<span class="od-list-c">' + n + '</span>' +
        '<span style="color:var(--tx3);font-size:12px">›</span>' +
      '</button>';
    }).join('');

    var body = !S.tasksOpen ? '' :
      '<div style="margin-top:11px">' +
        '<div class="od-tiles" style="margin-bottom:12px">' + tiles + '</div>' +
        '<div class="od-tasks">' + rows + '</div>' +
        '<button class="od-add" data-act="addtask">＋ Add task</button>' +
        '<div class="od-lists">' +
          '<div class="od-card-h" style="margin-bottom:6px">' +
            '<span class="od-lists-h">My lists</span>' +
            '<button class="od-link" data-act="addlist">＋ New list</button>' +
          '</div>' + lists +
        '</div>' +
      '</div>';

    return '<section class="od-card">' +
      '<button class="od-toggle" data-act="toggltasks" aria-expanded="' + S.tasksOpen + '">' +
        '<span style="flex:1" class="od-title">My tasks</span>' +
        '<span class="od-count">' + open + '</span>' +
        '<span class="od-chev">' + (S.tasksOpen ? '⌃' : '⌄') + '</span>' +
      '</button>' + body +
    '</section>';
  }

  /* --- by department ------------------------------------------------------ */

  function deptCard(){
    var cur = DATA.dept[S.dept];

    var tabs = DATA.deptOrder.map(function(k){
      return '<button role="tab" aria-selected="' + (S.dept === k) + '" data-act="dept" data-v="' + k + '">' +
        esc(DATA.dept[k].label) + '</button>';
    }).join('');

    var tiles = cur.tiles.map(function(t){
      var split = '';
      if (t.split) {
        if (t.bar !== false) {
          split += '<span class="od-split">' + t.split.map(function(x,i){
            return '<i style="flex:' + (typeof x[1] === 'number' ? x[1] : 1) + ';background:var(--d' + (i+1) + ')"></i>';
          }).join('') + '</span>';
        }
        split += '<span class="od-splitk">' + t.split.map(function(x,i){
          return '<span><i style="background:var(--d' + (i+1) + ')"></i>' + x[0] + ' ' + x[1] + '</span>';
        }).join('') + '</span>';
      }
      return '<div class="od-dtile ' + tone(t.tone) + '">' +
        '<span class="od-dtile-l">' + esc(t.t) + '</span>' +
        '<span class="od-dtile-v">' + esc(t.v) + '</span>' +
        '<span class="od-dtile-s">' + esc(t.s) + '</span>' + split +
      '</div>';
    }).join('');

    return '<section class="od-card od-span2">' +
      '<div class="od-card-h" style="margin-bottom:11px">' +
        '<span class="od-title">By department</span>' +
        '<button class="od-link" data-act="opendept">' + esc(cur.open) + ' ›</button>' +
      '</div>' +
      '<div class="od-tabs" role="tablist" style="margin-bottom:12px">' + tabs + '</div>' +
      '<div class="od-dept">' + tiles + '</div>' +
    '</section>';
  }

  /* --- division share ----------------------------------------------------- */

  function divisionCard(){
    var rows = DATA.divisions.map(function(r){
      return '<div class="od-share">' +
        '<span class="od-share-n"><i style="background:' + r.c + '"></i><span>' + esc(r.n) + '</span></span>' +
        '<span class="od-share-p">' + r.pct + '%</span>' +
        '<span class="od-bar"><i style="width:' + r.pct + '%;background:' + r.c + '"></i></span>' +
        '<svg viewBox="0 0 60 24" style="flex:none;width:60px;height:24px;display:block" aria-hidden="true">' +
          '<polyline points="' + r.spark + '" fill="none" stroke="' + r.c + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></polyline>' +
        '</svg>' +
        '<span class="od-share-d" style="color:var(--' + (r.tone === 'bad' ? 'bad' : 'ok') + ')">' + esc(r.delta) + '</span>' +
        '<span class="od-share-v">' + esc(r.value) + '</span>' +
      '</div>';
    }).join('');

    return '<section class="od-card od-span2">' +
      '<div class="od-title">Revenue by division</div>' +
      '<div class="od-sub" style="margin-bottom:13px">Share of this month · trend is last 6 months</div>' +
      '<div class="od-stack od-stack-13">' + (rows || '<div style="font-size:11.5px;color:var(--tx3)">No invoiced revenue yet.</div>') + '</div>' +
      '<div class="od-foot">' +
        '<span style="font-size:11.5px;color:var(--tx3)">Share of this month\'s invoiced revenue</span>' +
        '<span style="font-size:12px;font-weight:650;color:var(--tx)">Total ' + esc(DATA.divisionsTotal) + '</span>' +
      '</div>' +
    '</section>';
  }

  /* --- small reference cards --------------------------------------------- */

  function funnelCard(){
    /* PATCH 08 Aug 2026 §1 — a bar's fill must not share a flex line with any
       text. The label sits above; the fill lives inside a full-width track, so
       a short stage stays readable and every row is drawn to the same scale. */
    return '<section class="od-card">' +
      '<div class="od-title" style="margin-bottom:11px">Pipeline funnel</div>' +
      '<div class="od-funnel">' + DATA.funnel.map(function(f){
        return '<div>' +
          '<div class="od-fstep-h">' +
            '<span class="od-fstep-l">' + esc(f.label) + '</span>' +
            '<span class="od-fstep-v">' + esc(f.value) + '</span>' +
          '</div>' +
          '<span class="od-track"><i style="width:' + f.w + '%;background:' + f.c + '"></i></span>' +
        '</div>';
      }).join('') + '</div>' +
    '</section>';
  }

  function clientsCard(){
    return '<section class="od-card">' +
      '<div class="od-title" style="margin-bottom:11px">Top clients</div>' +
      '<div class="od-stack od-stack-8">' + (DATA.clients.length ? DATA.clients.map(function(c){
        return '<div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--tx2);margin-bottom:3px">' +
          '<span>' + esc(c.n) + '</span><b style="color:var(--tx)">' + esc(c.v) + '</b></div>' +
          '<span class="od-bar" style="height:6px"><i style="width:' + c.w + '%;height:6px;background:' + c.c + '"></i></span></div>';
      }).join('') : '<div style="font-size:11.5px;color:var(--tx3)">No confirmed jobs yet.</div>') + '</div>' +
    '</section>';
  }

  function qualityCard(){
    var C = 2 * Math.PI * 18;
    return '<section class="od-card od-span2">' +
      '<div class="od-title" style="margin-bottom:10px">Department quality</div>' +
      '<div style="display:flex;justify-content:space-between">' + DATA.quality.map(function(q){
        var dash = (q.pct / 100 * C).toFixed(1) + ' ' + C.toFixed(1);
        return '<div style="text-align:center">' +
          '<svg viewBox="0 0 44 44" style="width:52px;height:52px" role="img" aria-label="' + esc(q.n) + ' ' + q.pct + '%">' +
            '<circle cx="22" cy="22" r="18" fill="none" stroke="var(--line)" stroke-width="5"></circle>' +
            '<circle cx="22" cy="22" r="18" fill="none" stroke="var(--' + (q.tone === 'warn' ? 'warn' : 'ok') + ')" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + dash + '" transform="rotate(-90 22 22)"></circle>' +
            '<text x="22" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="var(--tx)">' + q.pct + '%</text>' +
          '</svg>' +
          '<div style="font-size:10px;color:var(--tx2)">' + esc(q.n) + '</div>' +
        '</div>';
      }).join('') + '</div>' +
    '</section>';
  }

  function cashCard(){
    var c = DATA.cash;
    return '<section class="od-card">' +
      '<div class="od-title">Cash in hand</div>' +
      '<div class="od-sub" style="margin-bottom:11px">Cash and bank ledgers · ' + esc(fmtDate(parseIso(todayIso()))) + '</div>' +
      '<div style="font-size:24px;font-weight:650;letter-spacing:-.02em;color:var(--tx)">' + esc(c.total) + '</div>' +
      '<div style="display:flex;align-items:center;gap:7px;margin:3px 0 13px">' +
        '<span style="font-size:11.5px;font-weight:700;color:var(--ok);background:var(--ok-bg);padding:2px 6px;border-radius:6px">' + esc(c.delta) + '</span>' +
        '<span style="font-size:11px;color:var(--tx3)">' + esc(c.deltaNote) + '</span>' +
      '</div>' +
      '<div class="od-stack od-stack-10">' + c.accounts.map(function(a){
        return '<div><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">' +
          '<span style="color:var(--tx2)">' + esc(a.n) + '</span><b style="color:var(--tx)">' + esc(a.v) + '</b></div>' +
          '<span class="od-bar" style="height:6px"><i style="width:' + a.w + '%;height:6px;background:' + a.c + '"></i></span></div>';
      }).join('') + '</div>' +
      '<div class="od-foot">' +
        '<span style="font-size:11px;color:var(--tx3)">Committed to open POs</span>' +
        '<span style="font-size:11.5px;font-weight:650;color:var(--warn)">' + esc(c.committed) + '</span>' +
      '</div>' +
    '</section>';
  }

  function expensesCard(){
    return '<section class="od-card">' +
      '<div class="od-card-h"><span class="od-title">Recent expenses</span><button class="od-link" data-act="openexpenses">All ›</button></div>' +
      '<div class="od-sub" style="margin-bottom:11px">' + esc(DATA.expenses.week) + '</div>' +
      DATA.expenses.rows.map(function(e){
        return '<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--line2)">' +
          '<span style="min-width:0"><span style="display:block;font-size:12px;color:var(--tx)">' + esc(e.t) + '</span>' +
          '<span style="display:block;font-size:10.5px;color:var(--tx3);margin-top:2px">' + esc(e.m) + '</span></span>' +
          '<b style="flex:none;font-size:12px;color:var(--tx)">' + esc(e.v) + '</b></div>';
      }).join('') +
    '</section>';
  }

  function purchasesCard(){
    return '<section class="od-card od-span2">' +
      '<div class="od-card-h"><span class="od-title">Top purchases</span><button class="od-link" data-act="openpurchasing">Purchasing ›</button></div>' +
      '<div class="od-sub" style="margin-bottom:12px">' + esc(DATA.purchases.month) + '</div>' +
      '<div class="od-stack od-stack-13">' + DATA.purchases.rows.map(function(p){
        return '<div><div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;margin-bottom:5px">' +
          '<span style="min-width:0"><span style="display:block;font-size:12px;color:var(--tx)">' + esc(p.t) + '</span>' +
          '<span style="display:block;font-size:10.5px;color:var(--tx3);margin-top:2px">' + esc(p.m) + '</span></span>' +
          '<b style="flex:none;font-size:12px;color:var(--tx)">' + esc(p.v) + '</b></div>' +
          '<span class="od-bar" style="height:5px"><i style="width:' + p.w + '%;height:5px;background:var(--wine2)"></i></span></div>';
      }).join('') + '</div>' +
    '</section>';
  }

  function activityCard(){
    return '<section class="od-card">' +
      '<div class="od-title" style="margin-bottom:10px">Recent activity</div>' +
      '<div class="od-stack od-stack-10">' + DATA.activity.map(function(a){
        return '<div class="od-act"><i style="background:' + a.c + '"></i>' +
          '<div><div class="od-act-t">' + esc(a.t) + '</div><div class="od-act-d">' + esc(a.d) + '</div></div></div>';
      }).join('') + '</div>' +
    '</section>';
  }

  function healthCard(){
    var h = DATA.health, sum = h.signals.reduce(function(n,x){ return n + x.pct; }, 0);
    return '<section class="od-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
        '<span class="od-title">Company health</span>' +
        '<span style="font-size:19px;font-weight:650;color:var(--tx);letter-spacing:-.02em">' + h.score +
          '<span style="font-size:12px;color:var(--tx3);font-weight:500">/100</span></span>' +
      '</div>' +
      '<div class="od-sub" style="margin-bottom:12px">Four signals · weakest one sets the tone</div>' +
      '<div class="od-health" style="margin-bottom:12px">' +
        h.signals.map(function(x){ return '<i style="flex:' + x.pct + ';background:' + x.c + '"></i>'; }).join('') +
        '<i style="flex:' + Math.max(0, 400 - sum) + ';background:var(--line2)"></i>' +
      '</div>' +
      '<div class="od-stack od-stack-8">' + h.signals.map(function(x){
        return '<div class="od-sig"><i style="background:' + x.c + '"></i>' +
          '<span class="od-sig-n">' + esc(x.n) + '</span>' +
          '<span class="od-sig-s" style="color:' + x.c + '">' + esc(x.s) + '</span></div>';
      }).join('') + '</div>' +
      '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line2);font-size:11.5px;color:var(--tx2);line-height:1.5">' +
        esc(h.note) + '</div>' +
    '</section>';
  }

  /* ---------------------------------------------------------------- render -- */

  function render(){
    buildData();
    return '<div class="od-grid">' +
      /* row 1 — the band */
      kpiBand() +
      /* row 2 — today */
      /* Planner + My tasks are the shared widgets from the planner/tasks
         design package — ONE implementation, called from every dashboard.
         Both in one wrapper so collapsing the planner cannot reshuffle the
         cards that follow it into the gap (the column flow is column-count). */
      renderPlannerAndTasks('od-span2') + activityCard() + healthCard() +
      /* row 3 — analysis */
      deptCard() + divisionCard() +
      /* row 4 — money */
      cashCard() + expensesCard() + purchasesCard() +
      /* row 5 — pipeline and quality */
      funnelCard() + clientsCard() +
      /* PATCH 08 Aug 2026 §2 — directly above Department quality */
      pnlCard() + qualityCard() +
    '</div>';
  }

  /* ----------------------------------------------------------------- wiring -- */

  function shiftSelection(delta){
    var d = parseIso(S.selDate);
    if (S.planScope === 'Week') { d = addDays(d, delta * 7); }
    else {
      var dom = d.getUTCDate();
      d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + delta);
      var last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(dom, last));
    }
    S.selDate = iso(d);
  }

  var ACTIONS = {
    drill: function(el){ openDrill(el.getAttribute('data-k')); },

    togglweek:  function(){ S.weekOpen  = !S.weekOpen; },
    toggltasks: function(){ S.tasksOpen = !S.tasksOpen; },

    scope: function(el){ S.planScope = el.getAttribute('data-v'); S.planOffset = 0; S.selDate = todayIso(); },
    period: function(el){
      var v = parseInt(el.getAttribute('data-v'), 10);
      if (v === 0) { S.planOffset = 0; S.selDate = todayIso(); }
      /* Move the selection with the period, or the agenda below shows a day
         that is not in the visible week/month. */
      else { S.planOffset += v; shiftSelection(v); }
    },
    pickday: function(el){ S.selDate = el.getAttribute('data-d'); },

    dept:   function(el){ S.dept = el.getAttribute('data-v'); },
    pnlmode: function(el){ S.pnlMode = el.getAttribute('data-v'); },
    filter: function(el){ S.taskFilter = el.getAttribute('data-v'); },

    /* The four task actions write to the app's real tasks[] so they persist
       and stay in step with the shell's own My Tasks panel. */
    check: function(el){
      var id = el.getAttribute('data-id'), t = appTask(id);
      if (!t) return;
      if (t.status === 'done') { t.status = 'open'; t.completedDate = null; }
      else if (typeof completeTask === 'function') completeTask(id);
      if (typeof execRefreshSidePanels === 'function') execRefreshSidePanels();
      if (typeof execRefreshBadges === 'function') execRefreshBadges();
    },
    move: function(el){
      var id = el.getAttribute('data-id'), t = appTask(id);
      if (!t) return;
      var i = S.lists.map(function(l){ return l.k; }).indexOf(t.list || 'ops');
      t.list = S.lists[(i + 1) % S.lists.length].k;
    },
    link: function(el){
      var id = el.getAttribute('data-id'), t = appTask(id);
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
      LISTS.push({ k: 'l' + S.nextList, n: name.trim(), c: 'var(--wine3)' });
      S.nextList++;
    },

    /* Navigation hooks — wired to the app's real routers. */
    openplanner:    function(){ if (typeof execOpenPlanner === 'function') execOpenPlanner(S.selDate); },
    opendept:       function(){ openDept(S.dept); },
    openexpenses:   function(){ hop('launchPurchasingModule', function(){ if (typeof purchGoTo === 'function') purchGoTo('purch-invoices'); }); },
    openpurchasing: function(){ hop('launchPurchasingModule', null); }
  };

  /* Cross-module hop. hideModuleWrap, never close*Module(): a close would
     offer to sign a single-dashboard role out mid-hop. */
  function hop(launchFn, after){
    var wrap = document.getElementById('owner-module-wrap');
    if (wrap && typeof hideModuleWrap === 'function') hideModuleWrap(wrap);
    setTimeout(function(){
      if (typeof window[launchFn] === 'function') window[launchFn]();
      if (after) setTimeout(after, 60);
    }, 150);
  }

  var DEPT_TARGET = {
    sales:      ['launchSalesModule', null],
    estimator:  ['launchEstimatorModule', null],
    operations: ['launchOperationsModule', null],
    jobs:       ['launchJobsModule', null],
    purchase:   ['launchPurchasingModule', null],
    production: ['launchJoineryModule', null],
    accounts:   ['launchAccountsModule', null],
    hr:         ['launchHRModule', null]
  };
  function openDept(k){
    var t = DEPT_TARGET[k];
    if (t) hop(t[0], t[1]);
  }

  function emit(name, detail){
    (root || document).dispatchEvent(new CustomEvent('owner:' + name, {bubbles:true, detail:detail}));
  }

  /* Drill-down detail view, rendered in place with a way back. */
  var drillKey = null;
  function openDrill(k){
    var d = DATA.drill[k];
    if (!d) return;
    drillKey = k;
    emit('drill', {key:k, data:d});
    if (!root) return;
    root.innerHTML =
      '<div class="od-grid" style="grid-template-columns:1fr">' +
        '<section class="od-card">' +
          '<button class="od-link" data-act="backfromdrill" style="margin-bottom:10px">‹ Back to dashboard</button>' +
          '<div class="od-title">' + esc(d.title) + '</div>' +
          '<div class="od-sub" style="margin-bottom:12px">' + esc(d.sub) + '</div>' +
          '<div style="font-size:24px;font-weight:650;letter-spacing:-.02em;color:var(--tx);margin-bottom:14px">' + esc(d.big) + '</div>' +
          d.rows.map(function(r){
            return '<div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;padding:9px 0;border-bottom:1px solid var(--line2)">' +
              '<span style="font-size:12px;color:var(--tx);min-width:0">' + esc(r[0]) + '</span>' +
              '<b style="flex:none;font-size:12px;color:var(--tx2)">' + esc(r[1]) + '</b></div>';
          }).join('') +
        '</section>' +
      '</div>';
  }
  ACTIONS.backfromdrill = function(){ drillKey = null; };

  function onClick(e){
    var el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    var fn = ACTIONS[el.getAttribute('data-act')];
    if (!fn) return;
    fn(el);
    if (el.getAttribute('data-act') !== 'drill') paint();
  }

  function mount(el){
    root = el;
    root.classList.add('od');
    root.removeEventListener('click', onClick);
    root.addEventListener('click', onClick);
    paint();
  }

  return {
    render: render,
    mount: mount,
    state: S,
    data: DATA,
    /* Feed live values in, then repaint. */
    setData: function(patch){ Object.assign(DATA, patch || {}); paint(); }
  };
})();
