// ═══════════════════════════════════════════════════════════════════════
// Purchase module UI — design handoff 17a.
//
// One app, three view modes off a single shell: dashboard, working page,
// create flow. Recreated in this codebase's own idiom (template strings,
// delegated listeners, no inline styles carried over) as the handoff's own
// README instructs — its .dc.html is a design reference, not production
// code to copy.
//
// The six non-negotiables (back, quick actions, collapsible sidebar,
// weekly planner, my tasks, floating chat) are NOT drawn here: the exec
// shell already owns all six app-wide, and drawing a second set would
// stack two of each. Same call the Sales 5a and Operations 13b builds
// made. 17a's nav ORDER and labels are applied to EXEC_NAV_CONFIGS
// instead, where they drive the real sidebar.
//
// All figures come from purchase-data.js. Nothing here invents a number.
// ═══════════════════════════════════════════════════════════════════════

window.PurUI = (function () {

  /* ── state (the handoff's own names) ────────────────────────────────── */
  var S = {
    view: 'dash',        // dash | page | form
    page: 'pr',
    chip: 0,
    form: null,          // pr | rfq | po | item
    step: 'cmp',         // default selection, per the handoff
    reqSel: {}, priority: 'Normal',
    rfqSel: {},
    itemName: '', itemUnit: 'Nos', itemStock: true,
    itemOverride: false, itemDiff: ''
  };
  var root = null;

  /* ── helpers ────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function safe(fn, dflt) { try { var v = fn(); return v == null ? dflt : v; } catch (e) { return dflt; } }
  // Currency BD 1,350.000 — always 3 decimals, per the handoff.
  function bd(n) {
    var v = Number(n) || 0;
    return 'BD ' + v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Dates DD MMM YYYY.
  function dmy(iso) {
    if (!iso) return '—';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return String(iso);
    return p[2] + ' ' + MONTHS[(+p[1]) - 1] + ' ' + p[0];
  }
  function today() { return todayISO(); }
  function supName(id) { return safe(function () { return purSupplierName(id); }, '—'); }

  /* ── the five dashboard steps ───────────────────────────────────────── */
  var STEPS = [
    { k: 'pr', l: 'Purchase requests', s: 'verified BOMs waiting to be ordered', q: function () { return safe(purQueuePR, []); } },
    { k: 'cmp', l: 'Compare supplier quotes', s: 'RFQs back · one becomes the PO', q: function () { return safe(purQueueCMP, []); } },
    { k: 'rel', l: 'POs with Operations', s: 'awaiting release · nothing ordered yet', q: function () { return safe(purQueueREL, []); } },
    { k: 'late', l: 'Chase late deliveries', s: 'past the promised date · the floor waits', q: function () { return safe(purQueueLATE, []); } },
    { k: 'grn', l: 'GRN mismatches', s: 'the store received short or wrong', q: function () { return safe(purQueueGRN, []); } }
  ];

  function stepsHTML() {
    return '<p class="pur-eyebrow">Your day, in the order it runs</p><div class="pur-steps">' +
      STEPS.map(function (st) {
        var n = st.q().length;
        return '<button class="pur-step' + (S.step === st.k ? ' on' : '') + '" data-a="step" data-k="' + st.k + '">' +
          '<span class="pur-step-c' + (n ? '' : ' clear') + '">' + (n ? n : '✓') + '</span>' +
          '<span><span class="pur-step-t">' + esc(st.l) + '</span>' +
          '<span class="pur-step-s">' + esc(st.s) + '</span></span></button>';
      }).join('') + '</div>';
  }

  function factsHTML(rows) {
    return '<div class="pur-facts">' + rows.map(function (r) {
      return '<div class="pur-fact ' + (r[2] || '') + '"><span class="pur-fact-l">' + esc(r[0]) +
        '</span><span class="pur-fact-v">' + esc(r[1]) + '</span></div>';
    }).join('') + '</div>';
  }
  function jobHeadHTML(n, i, s) {
    return '<div class="pur-jh-n">' + esc(n) + '</div><div class="pur-jh-i">' + esc(i) +
      '</div><div class="pur-jh-s">' + esc(s) + '</div>';
  }
  function emptyHTML(t, s) {
    return '<div class="pur-empty"><div style="font-weight:650;color:var(--tx2);">' + esc(t) +
      '</div><div style="margin-top:4px;">' + esc(s) + '</div></div>';
  }

  /* ── widget: purchase requests ──────────────────────────────────────── */
  function prBody() {
    var list = STEPS[0].q();
    if (!list.length) return emptyHTML('No requests waiting', 'Nothing is queued to be ordered.');
    var pr = list[0];
    var lines = pr.items || [];
    // A rate contract on any line means this can be ordered direct.
    var contracted = lines.filter(function (l) { return l.itemId && safe(function () { return getRateContractFor(l.itemId); }, null); });
    var est = lines.reduce(function (s, l) {
      var it = l.itemId ? itemMaster.find(function (i) { return i.id === l.itemId; }) : null;
      return s + ((it ? (it.lastPurchaseRate || it.cost || 0) : 0) * (Number(l.qty) || 0));
    }, 0);
    return jobHeadHTML(
      pr.linkedJobId ? ('Job ' + pr.linkedJobId) : (pr.division || 'Stock request'),
      pr.id + ' · raised by ' + (pr.raisedBy || '—'),
      'Raised ' + dmy(pr.dateRaised)
    ) + factsHTML([
      ['Lines', String(lines.length), 'plain'],
      ['Estimated value', bd(est), est > PO_SOURCING_THRESHOLD ? 'warn' : 'ok'],
      ['Sourcing route', est > PO_SOURCING_THRESHOLD ? 'Three quotes required' : 'Order direct', est > PO_SOURCING_THRESHOLD ? 'warn' : 'ok'],
      ['On a rate contract', contracted.length + ' of ' + lines.length, contracted.length ? 'ok' : 'plain']
    ]) +
      '<div class="pur-lt"><div class="pur-lt-h"><span class="pur-lt-d">Item</span>' +
      '<span class="pur-lt-q">Qty</span><span class="pur-lt-v">Est. value</span></div>' +
      lines.map(function (l) {
        var it = l.itemId ? itemMaster.find(function (i) { return i.id === l.itemId; }) : null;
        var rate = it ? (it.lastPurchaseRate || it.cost || 0) : 0;
        var rc = l.itemId ? safe(function () { return getRateContractFor(l.itemId); }, null) : null;
        return '<div class="pur-lt-r"><span class="pur-lt-d">' + esc(l.name) +
          (rc ? '<small>rate held to ' + esc(dmy(rc.rateHeldTo)) + '</small>' : (it ? '' : '<small>not on the item master</small>')) +
          '</span><span class="pur-lt-q">' + esc((l.qty || 0) + ' ' + (l.unit || '')) +
          '</span><span class="pur-lt-v">' + esc(bd(rate * (l.qty || 0))) + '</span></div>';
      }).join('') + '</div>' +
      (contracted.length
        ? '<div class="pur-banner ok">' + contracted.length + ' line' + (contracted.length === 1 ? '' : 's') + ' sit on a live rate contract — order those direct rather than going out to quotes.</div>'
        : '<div class="pur-banner">No rate contract covers these lines. Above ' + bd(PO_SOURCING_THRESHOLD) + ' the request needs three quotes.</div>');
  }
  function prFoot() {
    var list = STEPS[0].q();
    if (!list.length) return '';
    return '<button class="pur-btn flex" data-a="pr-order">Order against the rate contract</button>' +
      '<button class="pur-btn sec" data-a="go-rfq">Send an RFQ instead</button>' +
      (list.length > 1 ? '<span class="pur-more">' + (list.length - 1) + ' more after this</span>' : '');
  }

  /* ── widget: compare supplier quotes ────────────────────────────────── */
  function cmpBody() {
    var list = STEPS[1].q();
    if (!list.length) return emptyHTML('No quotes to compare', 'Nothing is out to suppliers right now.');
    var rfq = list[0];
    var rec = safe(function () { return rfqRecommended(rfq); }, null);
    var cheap = safe(function () { return rfqBestPrice(rfq); }, null);
    var fast = safe(function () { return rfqBestLead(rfq); }, null);
    return jobHeadHTML(
      (rfq.items[0] || {}).name || rfq.id,
      rfq.id + ' · ' + rfq.quotes.length + ' of ' + rfq.supplierIds.length + ' quoted',
      'Sent ' + dmy(rfq.date) + ' by ' + (rfq.raisedBy || '—')
    ) + factsHTML([
      ['Best price', cheap ? bd(cheap.price) : '—', 'ok'],
      ['Best lead', fast ? (fast.leadDays + ' days') : '—', 'plain'],
      ['Quotes in', rfq.quotes.length + ' of ' + rfq.supplierIds.length, rfqMeetsQuoteRule(rfq.supplierIds.length) ? 'ok' : 'warn'],
      ['Spread', (cheap && fast) ? bd(Math.abs((rfqBestPriceMax(rfq) || 0) - cheap.price)) : '—', 'plain']
    ]) +
      rfq.quotes.slice().sort(function (a, b) { return a.price - b.price; }).map(function (q) {
        var isRec = rec && rec.supplierId === q.supplierId;
        return '<button class="pur-q' + (isRec ? ' rec' : '') + '" data-a="cmp-pick" data-s="' + esc(q.supplierId) + '">' +
          '<span class="pur-q-mark">' + (isRec ? '✓' : '') + '</span>' +
          '<span class="pur-q-main"><span class="pur-q-n">' + esc(supName(q.supplierId)) + '</span>' +
          '<span class="pur-q-r">' + esc(onTimeLabel(q.supplierId)) + '</span>' +
          (q.note ? '<span class="pur-q-note">' + esc(q.note) + '</span>' : '') + '</span>' +
          '<span class="pur-q-price"><b>' + esc(bd(q.price)) + '</b><span>' + esc(q.terms || '—') + '</span></span>' +
          '<span class="pur-q-lead">' + q.leadDays + ' days</span></button>';
      }).join('') +
      (rec ? '<div class="pur-banner wine">Recommended: ' + esc(supName(rec.supplierId)) +
        '. Cheapest wins unless a materially faster quote sits within 10% of it — a slower cheap quote that stops the floor is not the cheaper option.</div>' : '');
  }
  function rfqBestPriceMax(rfq) {
    return rfq.quotes.reduce(function (m, q) { return Math.max(m, q.price); }, 0);
  }
  function onTimeLabel(supplierId) {
    var p = safe(function () { return getSupplierOnTimePercent(supplierId); }, null);
    return p === null ? 'no delivery record yet' : (p + '% on time');
  }
  function cmpFoot() {
    var list = STEPS[1].q();
    if (!list.length) return '';
    return '<button class="pur-btn flex" data-a="cmp-award">Raise the PO from this quote →</button>' +
      '<button class="pur-btn sec" data-a="go-rfq-page">Open the RFQ</button>' +
      (list.length > 1 ? '<span class="pur-more">' + (list.length - 1) + ' more after this</span>' : '');
  }

  /* ── widget: POs with Operations ────────────────────────────────────── */
  function relBody() {
    var list = STEPS[2].q();
    if (!list.length) return emptyHTML('Nothing waiting on Operations', 'No purchase order is held up for release.');
    var po = list[0];
    var val = safe(function () { return poValue(po); }, 0);
    return jobHeadHTML(
      po.id + ' — ' + esc(po.supplierNameTel || supName(po.supplierId)),
      (po.linkedJobId ? po.linkedJobId + ' · ' : 'No job link · ') + bd(val),
      'Raised ' + dmy(po.date) + (po.preparedBy ? ' by ' + po.preparedBy : '')
    ) + factsHTML([
      ['Order value', bd(val), val > PO_OWNER_THRESHOLD ? 'warn' : 'plain'],
      ['Waiting since', dmy(po.date), 'plain'],
      ['Needs the Owner too', val > PO_OWNER_THRESHOLD ? 'Yes — over ' + bd(PO_OWNER_THRESHOLD) : 'No', val > PO_OWNER_THRESHOLD ? 'warn' : 'ok'],
      ['Sourced from', po.sourceRFQ || 'Direct', 'plain']
    ]) +
      '<div class="pur-note">Every purchase order is released by Operations, whatever its value — there is no auto-release tier in this app. Chasing does not approve it; it only tells them it is waiting.</div>' +
      '<div class="pur-banner">' + list.length + ' order' + (list.length === 1 ? '' : 's') + ' held here ' +
      'total ' + bd(list.reduce(function (s, p) { return s + safe(function () { return poValue(p); }, 0); }, 0)) + ' of unreleased spend.</div>';
  }
  function relFoot() {
    if (!STEPS[2].q().length) return '';
    return '<button class="pur-btn flex" data-a="rel-chase">Chase the release</button>' +
      '<button class="pur-btn sec" data-a="go-po">Open purchase orders</button>';
  }

  /* ── widget: late deliveries ────────────────────────────────────────── */
  function lateBody() {
    var list = STEPS[3].q();
    if (!list.length) return emptyHTML('Nothing is late', 'Every promised date is still ahead.');
    var po = list[0];
    var days = Math.round((new Date(today()) - new Date(po.promisedDate)) / 86400000);
    return jobHeadHTML(
      esc(po.supplierNameTel || supName(po.supplierId)),
      po.id + ' · promised ' + dmy(po.promisedDate),
      (po.linkedJobId ? 'Against ' + po.linkedJobId : 'Stock order')
    ) + factsHTML([
      ['Days late', String(days), days > 7 ? 'bad' : 'warn'],
      ['Order value', bd(safe(function () { return poValue(po); }, 0)), 'plain'],
      ['Supplier record', onTimeLabel(po.supplierId), 'plain'],
      ['Still outstanding', (po.items || []).length + ' line' + ((po.items || []).length === 1 ? '' : 's'), 'plain']
    ]) +
      '<div class="pur-lt"><div class="pur-lt-h"><span class="pur-lt-d">Item</span>' +
      '<span class="pur-lt-q">Ordered</span><span class="pur-lt-v">Received</span></div>' +
      (po.items || []).map(function (l, i) {
        var got = safe(function () { return poReceivedQty(po.id, i); }, 0);
        return '<div class="pur-lt-r"><span class="pur-lt-d">' + esc(l.productService) + '</span>' +
          '<span class="pur-lt-q">' + esc((l.qty || 0) + ' ' + (l.unit || '')) + '</span>' +
          '<span class="pur-lt-v">' + got + '</span></div>';
      }).join('') + '</div>';
  }
  function lateFoot() {
    var list = STEPS[3].q();
    if (!list.length) return '';
    return '<button class="pur-btn flex" data-a="late-revise">Ask for a revised date</button>' +
      '<button class="pur-btn sec" data-a="late-remind">Log a chase</button>' +
      (list.length > 1 ? '<span class="pur-more">' + (list.length - 1) + ' more after this</span>' : '');
  }

  /* ── widget: GRN mismatches ─────────────────────────────────────────── */
  function grnBody() {
    var list = STEPS[4].q();
    if (!list.length) return emptyHTML('No mismatches open', 'Everything the store booked in matched its order.');
    var g = list[0];
    var po = purchaseOrders.find(function (p) { return p.id === g.poId; }) || {};
    var short = safe(function () { return grnShortfallValue(g); }, 0);
    return jobHeadHTML(
      esc(po.supplierNameTel || supName(po.supplierId)),
      g.id + ' · against ' + g.poId,
      'Booked in ' + dmy(g.date) + ' by ' + (g.receivedBy || '—')
    ) + factsHTML([
      ['Result', g.result, g.result === 'full' ? 'ok' : 'bad'],
      ['Value to claim', bd(short), short > 0 ? 'bad' : 'ok'],
      ['Received value', bd(safe(function () { return grnValue(g); }, 0)), 'plain'],
      ['Claim', g.claimState, g.claimState === 'open' ? 'warn' : 'ok']
    ]) +
      '<div class="pur-lt"><div class="pur-lt-h"><span class="pur-lt-d">Item</span>' +
      '<span class="pur-lt-q">Ordered / got</span><span class="pur-lt-v">Short by</span></div>' +
      g.lines.map(function (l) {
        var d = (l.orderedQty || 0) - (l.receivedQty || 0);
        return '<div class="pur-lt-r"><span class="pur-lt-d">' + esc(l.name) + '</span>' +
          '<span class="pur-lt-q">' + l.orderedQty + ' / ' + l.receivedQty + '</span>' +
          '<span class="pur-lt-v">' + (d > 0 ? esc(bd(d * l.rate)) : '—') + '</span></div>';
      }).join('') + '</div>' +
      '<div class="pur-banner bad">A mismatch stays open until it is claimed. ' + bd(short) + ' has been paid for and not received.</div>';
  }
  function grnFoot() {
    var list = STEPS[4].q();
    if (!list.length) return '';
    var g = list[0];
    var po = purchaseOrders.find(function (p) { return p.id === g.poId; }) || {};
    return '<button class="pur-btn flex" data-a="grn-claim">Claim the balance from ' + esc((supName(po.supplierId) || '').split(' ')[0] || 'the supplier') + '</button>' +
      '<button class="pur-btn sec" data-a="go-grn">Open GRN &amp; returns</button>' +
      (list.length > 1 ? '<span class="pur-more">' + (list.length - 1) + ' more after this</span>' : '');
  }

  var WHEAD = {
    pr: ['Purchase requests', 'Verified BOM lines waiting to be ordered.'],
    cmp: ['Compare supplier quotes', 'One of these becomes the purchase order.'],
    rel: ['POs with Operations', 'Raised and waiting on release — nothing is ordered yet.'],
    late: ['Chase late deliveries', 'Past the promised date. The floor is waiting on these.'],
    grn: ['GRN mismatches', 'The store received short or wrong — open until claimed.']
  };
  var WBODY = { pr: prBody, cmp: cmpBody, rel: relBody, late: lateBody, grn: grnBody };
  var WFOOT = { pr: prFoot, cmp: cmpFoot, rel: relFoot, late: lateFoot, grn: grnFoot };

  function widgetHTML() {
    var h = WHEAD[S.step] || WHEAD.cmp;
    var n = (STEPS.filter(function (s) { return s.k === S.step; })[0] || STEPS[1]).q().length;
    return '<div class="pur-widget"><div class="pur-wh"><div>' +
      '<div class="pur-wh-t">' + esc(h[0]) + '</div><div class="pur-wh-s">' + esc(h[1]) + '</div></div>' +
      '<span class="pur-wh-pill">' + n + '</span></div>' +
      '<div class="pur-wb">' + (WBODY[S.step] || WBODY.cmp)() + '</div>' +
      '<div class="pur-wf">' + (WFOOT[S.step] || WFOOT.cmp)() + '</div></div>';
  }

  /* ── open purchase orders card ──────────────────────────────────────── */
  function openPOsHTML() {
    var open = purchaseOrders.filter(function (po) {
      return po.approvalStatus === 'approved' && !safe(function () { return poFullyReceived(po); }, false);
    });
    var committed = open.reduce(function (s, po) { return s + safe(function () { return poValue(po); }, 0); }, 0);
    return '<div class="pur-card"><div class="pur-card-h">' +
      '<span class="pur-card-t">Open purchase orders</span>' +
      '<span class="pur-card-s">' + open.length + ' open · ' + bd(committed) + ' committed</span></div>' +
      (open.length ? open.slice(0, 6).map(function (po) {
        var late = po.promisedDate && po.promisedDate < today();
        return '<div class="pur-row"><span class="pur-row-d">' +
          '<span class="pur-row-t">' + esc((po.items[0] || {}).productService || po.id) + '</span>' +
          '<span class="pur-row-s">' + esc(po.id + ' · ' + (po.supplierNameTel || supName(po.supplierId)) + ' · ' + (po.linkedJobId || 'stock')) + '</span>' +
          '</span><span class="pur-row-v">' + esc(bd(safe(function () { return poValue(po); }, 0))) + '</span>' +
          '<span class="pur-pill ' + (late ? 'bad' : 'ok') + '">' + (late ? 'Late' : 'On track') + '</span></div>';
      }).join('') : '<div class="pur-empty">Nothing open.</div>') + '</div>';
  }

  /* ── right column ───────────────────────────────────────────────────── */
  function spendHTML() {
    var cats = safe(function () { return getPurchaseSpendByCategory(); }, []);
    var month = new Date().toISOString().slice(0, 7);
    var total = purchaseOrders.filter(function (po) {
      return po.approvalStatus === 'approved' && String(po.date).slice(0, 7) === month;
    });
    var val = total.reduce(function (s, po) { return s + safe(function () { return poValue(po); }, 0); }, 0);
    var openN = total.filter(function (po) { return !safe(function () { return poFullyReceived(po); }, false); }).length;
    var max = cats.reduce(function (m, c) { return Math.max(m, c.value); }, 0) || 1;
    return '<div class="pur-card pur-spend"><div class="pur-spend-h">' +
      '<span class="pur-spend-l">Committed this month</span>' +
      '<span class="pur-spend-v">' + esc(bd(val)) + '</span></div>' +
      '<div class="pur-spend-s">across ' + total.length + ' purchase order' + (total.length === 1 ? '' : 's') + ' · ' + openN + ' still open</div>' +
      (cats.length ? '<div class="pur-bars">' + cats.map(function (c) {
        // Label above a full-width track; the fill is a child <i> and never
        // contains text — the handoff's chart rule.
        return '<div class="pur-bar"><div class="pur-bar-l">' +
          '<span class="pur-bar-n">' + esc(c.label) + '</span>' +
          '<span class="pur-bar-v">' + esc(bd(c.value)) + '</span></div>' +
          '<div class="pur-bar-t"><i style="width:' + Math.max(2, Math.round((c.value / max) * 100)) + '%"></i></div></div>';
      }).join('') + '</div>' : '<div class="pur-bars"><div class="pur-bar-n">Nothing ordered yet this month.</div></div>') +
      '</div>';
  }
  function kpiHTML() {
    var k = safe(function () { return getPurchaseKPIs(); }, {});
    var rows = [
      ['Late deliveries', 'past the promised date', String(k.lateDeliveries || 0), k.lateDeliveries ? 'bad' : 'ok'],
      ['Unclaimed shortfall', 'paid for and not received', bd(k.unclaimedValue || 0), k.unclaimedValue ? 'bad' : 'ok'],
      ['Missing supplier invoices', 'Accounts cannot pay these', String(k.missingInvoices || 0), k.missingInvoices ? 'warn' : 'ok'],
      ['Rate contracts expiring', 'within 30 days', String(k.expiringContracts || 0), k.expiringContracts ? 'warn' : 'ok']
    ];
    return '<div class="pur-card">' + rows.map(function (r) {
      return '<div class="pur-kpi"><span class="pur-kpi-d">' +
        '<span class="pur-kpi-l">' + esc(r[0]) + '</span>' +
        '<span class="pur-kpi-r">' + esc(r[1]) + '</span></span>' +
        '<span class="pur-kpi-v ' + r[3] + '">' + esc(r[2]) + '</span></div>';
    }).join('') + '</div>';
  }

  function dashHTML() {
    return '<div class="pur-page"><div class="pur-left">' +
      stepsHTML() + widgetHTML() + openPOsHTML() +
      '</div><div class="pur-right pur-col">' +
      spendHTML() + kpiHTML() +
      // The planner and tasks are the shell's shared widget — one store, so
      // they cannot disagree with what the sidebar shows.
      safe(function () { return typeof renderPlannerTasksPair === 'function' ? renderPlannerTasksPair('purchase') : ''; }, '') +
      '</div></div>';
  }

  /* ── working pages: one template, ten pages ─────────────────────────── */
  function pill(text, tone) { return '<span class="pur-pill ' + tone + '">' + esc(text) + '</span>'; }

  var PAGES = {
    pr: {
      title: 'Purchase requests',
      sub: 'Raised by a department off a verified BOM. The allowance is the ceiling — request less and the balance stays available; request more and it needs a variation before Purchase can act.',
      cols: ['Request', 'Job card', 'Needed by', 'BOM allowance', 'Status'],
      widths: [0, 128, 104, 118, 150], nums: [3],
      chips: ['All', 'Open', 'Converted'],
      primary: ['＋ New request', 'pr'], secondary: 'Export',
      rows: function () {
        return purchaseRequests.filter(function (p) {
          return S.chip === 0 || (S.chip === 1 ? p.status === 'open' : p.status === 'converted');
        }).map(function (p) {
          var est = (p.items || []).reduce(function (s, l) {
            var it = l.itemId ? itemMaster.find(function (i) { return i.id === l.itemId; }) : null;
            return s + ((it ? (it.lastPurchaseRate || it.cost || 0) : 0) * (Number(l.qty) || 0));
          }, 0);
          return [
            { t: p.id, s: (p.items || []).length + ' line' + ((p.items || []).length === 1 ? '' : 's') + ' · ' + (p.raisedBy || '—') },
            { t: p.linkedJobId || '—' },
            { t: dmy(p.neededBy || p.dateRaised) },
            { t: bd(est) },
            { pill: p.status === 'open' ? ['Open', 'warn'] : ['Converted', 'ok'] }
          ];
        });
      },
      stats: function () {
        var open = purchaseRequests.filter(function (p) { return p.status === 'open'; });
        return [['Open requests', String(open.length), open.length ? 'warn' : 'ok'],
        ['Total requests', String(purchaseRequests.length), 'plain'],
        ['Lines waiting', String(open.reduce(function (s, p) { return s + (p.items || []).length; }, 0)), 'plain'],
        ['Converted', String(purchaseRequests.filter(function (p) { return p.status === 'converted'; }).length), 'ok']];
      }
    },
    rfq: {
      title: 'RFQs & quotes',
      sub: 'What the supplier sees is the specification and the quantity. Our allowance, the job card and the client never leave the building.',
      cols: ['RFQ', 'Quotes in', 'Best price', 'Best lead', 'Status'],
      widths: [0, 96, 122, 96, 150], nums: [2],
      chips: ['All', 'Open', 'Quotes in', 'Awarded'],
      primary: ['＋ New RFQ', 'rfq'], secondary: 'Chase all open',
      rows: function () {
        var f = ['all', 'open', 'quotes-in', 'awarded'][S.chip];
        return rfqs.filter(function (r) { return f === 'all' || r.status === f; }).map(function (r) {
          var cheap = safe(function () { return rfqBestPrice(r); }, null);
          var fast = safe(function () { return rfqBestLead(r); }, null);
          return [
            { t: r.id, s: ((r.items[0] || {}).name || '—') + ' · sent ' + dmy(r.date) },
            { t: r.quotes.length + ' of ' + r.supplierIds.length },
            { t: cheap ? bd(cheap.price) : '—' },
            { t: fast ? fast.leadDays + ' days' : '—' },
            {
              pill: r.status === 'awarded' ? ['Awarded', 'ok']
                : r.status === 'quotes-in' ? ['Quotes in', 'wine'] : ['Out to suppliers', 'warn']
            }
          ];
        });
      },
      stats: function () {
        return [['Out to suppliers', String(rfqs.filter(function (r) { return r.status === 'open'; }).length), 'warn'],
        ['Quotes in', String(rfqs.filter(function (r) { return r.status === 'quotes-in'; }).length), 'wine'],
        ['Awarded', String(rfqs.filter(function (r) { return r.status === 'awarded'; }).length), 'ok'],
        ['Below three quotes', String(rfqs.filter(function (r) { return !rfqMeetsQuoteRule(r.supplierIds.length); }).length), 'bad']];
      }
    },
    po: {
      title: 'Purchase orders',
      sub: 'Every purchase order is released by Operations, whatever its value. Above ' + '​' + 'BD 5,000 the Owner counter-signs as well.',
      cols: ['Purchase order', 'Supplier', 'Job card', 'Value', 'Status'],
      widths: [0, 150, 120, 118, 148], nums: [3],
      chips: ['All', 'Awaiting release', 'Released', 'Rejected'],
      primary: ['＋ Raise a PO', 'po'], secondary: 'Export',
      rows: function () {
        var f = ['all', 'pending', 'approved', 'rejected'][S.chip];
        return purchaseOrders.filter(function (p) { return f === 'all' || p.approvalStatus === f; }).map(function (p) {
          return [
            { t: p.id, s: dmy(p.date) + (p.sourceRFQ ? ' · from ' + p.sourceRFQ : '') },
            { t: p.supplierNameTel || supName(p.supplierId) },
            { t: p.linkedJobId || '—' },
            { t: bd(safe(function () { return poValue(p); }, 0)) },
            {
              pill: p.approvalStatus === 'approved' ? ['Released', 'ok']
                : p.approvalStatus === 'rejected' ? ['Rejected', 'bad'] : ['Awaiting release', 'warn']
            }
          ];
        });
      },
      stats: function () {
        var pend = purchaseOrders.filter(function (p) { return p.approvalStatus === 'pending'; });
        var appr = purchaseOrders.filter(function (p) { return p.approvalStatus === 'approved'; });
        return [['Awaiting release', String(pend.length), pend.length ? 'bad' : 'ok'],
        ['Unreleased value', bd(pend.reduce(function (s, p) { return s + safe(function () { return poValue(p); }, 0); }, 0)), 'bad'],
        ['Released', String(appr.length), 'ok'],
        ['Committed', bd(appr.reduce(function (s, p) { return s + safe(function () { return poValue(p); }, 0); }, 0)), 'plain']];
      }
    },
    del: {
      title: 'Deliveries due',
      sub: 'An approved purchase order with a promised date that the store has not fully booked in yet.',
      cols: ['Item', 'Supplier', 'PO', 'Promised', 'Status'],
      widths: [0, 146, 126, 106, 150], nums: [],
      chips: ['All', 'Late', 'This week'],
      primary: ['Record a delivery', 'grn-form'], secondary: 'Print the week',
      rows: function () {
        var all = safe(function () { return getDeliveriesDue(); }, []);
        var wk = addDaysISO(today(), 7);
        var list = S.chip === 1 ? all.filter(function (p) { return p.promisedDate < today(); })
          : S.chip === 2 ? all.filter(function (p) { return p.promisedDate <= wk; }) : all;
        return list.map(function (p) {
          var late = p.promisedDate < today();
          return [
            { t: (p.items[0] || {}).productService || p.id, s: (p.items || []).length + ' line' + ((p.items || []).length === 1 ? '' : 's') },
            { t: p.supplierNameTel || supName(p.supplierId) },
            { t: p.id },
            { t: dmy(p.promisedDate) },
            { pill: late ? ['Late', 'bad'] : ['On track', 'ok'] }
          ];
        });
      },
      stats: function () {
        var all = safe(function () { return getDeliveriesDue(); }, []);
        var late = safe(function () { return getLateDeliveries(); }, []);
        return [['Due', String(all.length), 'plain'],
        ['Late', String(late.length), late.length ? 'bad' : 'ok'],
        ['Value outstanding', bd(all.reduce(function (s, p) { return s + safe(function () { return poValue(p); }, 0); }, 0)), 'plain'],
        ['Suppliers involved', String(Object.keys(all.reduce(function (m, p) { m[p.supplierId] = 1; return m; }, {})).length), 'plain']];
      }
    },
    grn: {
      title: 'GRN & returns',
      sub: 'The store books goods in line by line. Whether a receipt is full, short, over or wrong is worked out from the quantities — never typed.',
      cols: ['Goods receipt', 'PO', 'Received', 'Value', 'Result'],
      widths: [0, 126, 128, 118, 146], nums: [3],
      chips: ['All', 'Mismatches', 'Claims open', 'Settled'],
      primary: ['＋ New GRN', 'grn-form'], secondary: 'Open a return',
      rows: function () {
        var list = goodsReceipts.filter(function (g) {
          if (S.chip === 1) return g.result !== 'full';
          if (S.chip === 2) return g.claimState === 'open' || g.claimState === 'claimed';
          if (S.chip === 3) return g.claimState === 'settled';
          return true;
        });
        return list.map(function (g) {
          var got = g.lines.reduce(function (s, l) { return s + l.receivedQty; }, 0);
          var ord = g.lines.reduce(function (s, l) { return s + l.orderedQty; }, 0);
          return [
            { t: g.id, s: dmy(g.date) + ' · ' + (g.receivedBy || '—') },
            { t: g.poId },
            { t: got + ' of ' + ord },
            { t: bd(safe(function () { return grnValue(g); }, 0)) },
            {
              pill: g.result === 'full' ? ['Full', 'ok']
                : g.claimState === 'settled' ? ['Settled', 'ok']
                  : g.claimState === 'claimed' ? ['Claimed', 'warn']
                    : [g.result === 'short' ? 'Short — claim open' : g.result === 'over' ? 'Over' : 'Wrong', 'bad']
            }
          ];
        });
      },
      stats: function () {
        var mm = safe(function () { return getGRNMismatches(); }, []);
        return [['Receipts', String(goodsReceipts.length), 'plain'],
        ['Mismatches open', String(mm.length), mm.length ? 'bad' : 'ok'],
        ['Value to claim', bd(mm.reduce(function (s, g) { return s + safe(function () { return grnShortfallValue(g); }, 0); }, 0)), mm.length ? 'bad' : 'ok'],
        ['Settled', String(goodsReceipts.filter(function (g) { return g.claimState === 'settled'; }).length), 'ok']];
      }
    },
    item: {
      title: 'Item master',
      sub: 'Purchase owns the item code. Once it exists, every BOM, quote and store count uses this one spelling of it.',
      cols: ['Item', 'Code', 'Unit', 'Last rate', 'Stock'],
      widths: [0, 110, 84, 118, 150], nums: [3],
      chips: ['All', 'Below reorder', 'No stock'],
      primary: ['＋ New item', 'item'], secondary: 'Export',
      rows: function () {
        var list = itemMaster.filter(function (it) {
          if (S.chip === 1) return (it.closingStock || 0) <= (it.reorderLevel || 0);
          if (S.chip === 2) return (it.closingStock || 0) <= 0;
          return true;
        }).slice(0, 200);
        return list.map(function (it) {
          var low = (it.closingStock || 0) <= (it.reorderLevel || 0);
          return [
            { t: it.name, s: it.stockCategory || '—' },
            { t: it.id },
            { t: it.unit || '—' },
            { t: bd(it.lastPurchaseRate || it.cost || 0) },
            { pill: low ? [(it.closingStock || 0) + ' — below reorder', 'warn'] : [String(it.closingStock || 0), 'ok'] }
          ];
        });
      },
      stats: function () {
        var low = itemMaster.filter(function (it) { return (it.closingStock || 0) <= (it.reorderLevel || 0); });
        return [['Items', String(itemMaster.length), 'plain'],
        ['Below reorder', String(low.length), low.length ? 'warn' : 'ok'],
        ['Categories', String(Object.keys(itemMaster.reduce(function (m, i) { m[i.stockCategory] = 1; return m; }, {})).length), 'plain'],
        ['On a rate contract', String(itemMaster.filter(function (i) { return safe(function () { return getRateContractFor(i.id); }, null); }).length), 'ok']];
      }
    },
    sup: {
      title: 'Suppliers',
      sub: 'On-time is measured at the first receipt against a purchase order. A supplier we have never used shows no record rather than nought per cent.',
      cols: ['Supplier', 'Category', 'Open POs', 'Spend this year', 'On time'],
      widths: [0, 146, 92, 132, 128], nums: [3],
      chips: ['All', 'With open POs', 'Late record'],
      primary: ['＋ Add supplier', 'sup-form'], secondary: 'Export',
      rows: function () {
        var list = suppliers.filter(function (s) {
          var open = safe(function () { return getSupplierOpenPOs(s.id).length; }, 0);
          var ot = safe(function () { return getSupplierOnTimePercent(s.id); }, null);
          if (S.chip === 1) return open > 0;
          if (S.chip === 2) return ot !== null && ot < 100;
          return true;
        });
        return list.map(function (s) {
          var ot = safe(function () { return getSupplierOnTimePercent(s.id); }, null);
          return [
            { t: s.name, s: s.contactPerson || s.telephone || '—' },
            { t: s.stockCategory || s.country || 'General' },
            { t: String(safe(function () { return getSupplierOpenPOs(s.id).length; }, 0)) },
            { t: bd(safe(function () { return getSupplierSpendThisYear(s.id); }, 0)) },
            { pill: ot === null ? ['No record', 'plain'] : [ot + '%', ot >= 90 ? 'ok' : ot >= 70 ? 'warn' : 'bad'] }
          ];
        });
      },
      stats: function () {
        return [['Suppliers', String(suppliers.length), 'plain'],
        ['With open orders', String(suppliers.filter(function (s) { return safe(function () { return getSupplierOpenPOs(s.id).length; }, 0) > 0; }).length), 'plain'],
        ['Spend this year', bd(suppliers.reduce(function (t, s) { return t + safe(function () { return getSupplierSpendThisYear(s.id); }, 0); }, 0)), 'plain'],
        ['No delivery record', String(suppliers.filter(function (s) { return safe(function () { return getSupplierOnTimePercent(s.id); }, null) === null; }).length), 'plain']];
      }
    },
    ctr: {
      title: 'Rate contracts',
      sub: 'A held rate for named items until a date. While one is live the request is ordered direct rather than going out to quotes.',
      cols: ['Contract', 'Supplier', 'Items covered', 'Rate held to', 'Status'],
      widths: [0, 150, 150, 120, 130], nums: [],
      chips: ['All', 'Expiring', 'Expired'],
      primary: ['＋ New contract', 'ctr-form'], secondary: 'Renew expiring',
      rows: function () {
        var list = rateContracts.filter(function (rc) {
          var st = safe(function () { return rateContractState(rc); }, 'active');
          if (S.chip === 1) return st === 'expiring';
          if (S.chip === 2) return st === 'expired';
          return true;
        });
        return list.map(function (rc) {
          var st = safe(function () { return rateContractState(rc); }, 'active');
          return [
            { t: rc.id, s: 'agreed ' + dmy(rc.date) },
            { t: supName(rc.supplierId) },
            { t: rc.itemIds.length + ' item' + (rc.itemIds.length === 1 ? '' : 's') },
            { t: dmy(rc.rateHeldTo) },
            {
              pill: st === 'expired' ? ['Expired', 'bad'] : st === 'expiring' ? ['Expiring', 'warn']
                : st === 'cancelled' ? ['Cancelled', 'plain'] : ['Active', 'ok']
            }
          ];
        });
      },
      stats: function () {
        var exp = safe(function () { return getExpiringRateContracts(); }, []);
        return [['Contracts', String(rateContracts.length), 'plain'],
        ['Expiring or expired', String(exp.length), exp.length ? 'warn' : 'ok'],
        ['Items covered', String(rateContracts.reduce(function (s, r) { return s + r.itemIds.length; }, 0)), 'plain'],
        ['Suppliers', String(Object.keys(rateContracts.reduce(function (m, r) { m[r.supplierId] = 1; return m; }, {})).length), 'plain']];
      }
    },
    rem: {
      title: 'Reminders',
      sub: 'Not automated. This is the officer’s own list of dated chases against a PO, GRN, contract or request — a supplier gone quiet, a claim nobody answered, a contract about to lapse.',
      cols: ['Reminder', 'Against', 'Due', 'Raised by', 'Status'],
      widths: [0, 150, 118, 128, 140], nums: [],
      chips: ['All', 'Overdue', 'Today'],
      primary: ['＋ New reminder', 'rem-form'], secondary: 'Snooze the week',
      rows: function () {
        var list = (typeof reminders !== 'undefined' ? reminders : []).filter(function (r) {
          var due = r.dueDate || r.date;
          if (S.chip === 1) return due && due < today();
          if (S.chip === 2) return due === today();
          return true;
        });
        return list.map(function (r) {
          var due = r.dueDate || r.date;
          var over = due && due < today();
          return [
            { t: r.text || r.title || r.note || '—', s: r.type || 'chase' },
            { t: r.against || r.linkedId || '—' },
            { t: dmy(due) },
            { t: r.raisedBy || r.by || 'Purchase' },
            { pill: over ? ['Overdue', 'bad'] : due === today() ? ['Today', 'wine'] : ['Open', 'plain'] }
          ];
        });
      },
      stats: function () {
        var all = (typeof reminders !== 'undefined' ? reminders : []);
        var over = all.filter(function (r) { var d = r.dueDate || r.date; return d && d < today(); });
        return [['Reminders', String(all.length), 'plain'],
        ['Overdue', String(over.length), over.length ? 'bad' : 'ok'],
        ['Due today', String(all.filter(function (r) { return (r.dueDate || r.date) === today(); }).length), 'wine'],
        ['Ahead', String(all.length - over.length), 'ok']];
      }
    },
    doc: {
      title: 'Documents',
      sub: 'Every paper filed against the order it belongs to. The status that matters is the absence: a purchase order received in full with no supplier invoice is a payment Accounts cannot make.',
      cols: ['Document', 'Type', 'Filed against', 'Date', 'Status'],
      widths: [0, 132, 148, 112, 146], nums: [],
      chips: ['All', 'Missing invoices', 'Expiring'],
      primary: ['Upload a document', 'doc-form'], secondary: 'Export the month',
      rows: function () {
        if (S.chip === 1) {
          return safe(function () { return getMissingSupplierInvoices(); }, []).map(function (m) {
            return [
              { t: 'Supplier invoice', s: 'not filed' },
              { t: 'Supplier invoice' },
              { t: m.po.id + ' · ' + m.supplier },
              { t: bd(m.value) },
              { pill: ['Not received', 'warn'] }
            ];
          });
        }
        if (S.chip === 2) {
          return safe(function () { return getExpiringDocuments(); }, []).map(function (e) {
            return [
              { t: e.doc.type, s: e.doc.id },
              { t: e.doc.type },
              { t: e.doc.againstType + ' ' + e.doc.againstId },
              { t: dmy(e.doc.expiryDate) },
              { pill: e.expired ? ['Expired', 'bad'] : [e.daysLeft + ' days left', 'warn'] }
            ];
          });
        }
        return purchaseDocuments.map(function (d) {
          return [
            { t: d.type, s: d.id + (d.note ? ' · ' + d.note : '') },
            { t: d.type },
            { t: d.againstType + ' ' + d.againstId },
            { t: dmy(d.date) },
            { pill: d.expiryDate && d.expiryDate < today() ? ['Expired', 'bad'] : ['Filed', 'ok'] }
          ];
        });
      },
      stats: function () {
        var miss = safe(function () { return getMissingSupplierInvoices(); }, []);
        var exp = safe(function () { return getExpiringDocuments(); }, []);
        return [['Documents filed', String(purchaseDocuments.length), 'plain'],
        ['Missing invoices', String(miss.length), miss.length ? 'warn' : 'ok'],
        ['Value unbilled', bd(miss.reduce(function (s, m) { return s + m.value; }, 0)), miss.length ? 'warn' : 'ok'],
        ['Expiring or expired', String(exp.length), exp.length ? 'bad' : 'ok']];
      }
    }
  };

  function pageHTML() {
    var p = PAGES[S.page] || PAGES.pr;
    var rows = safe(p.rows, []);
    var stats = safe(p.stats, []);
    return '<div class="pur-page"><div class="pur-left">' +
      '<p class="pur-sub">' + esc(p.sub) + '</p>' +
      '<div class="pur-stats">' + stats.map(function (s) {
        return '<div class="pur-stat"><div class="pur-stat-l">' + esc(s[0]) + '</div>' +
          '<div class="pur-stat-v ' + (s[2] === 'plain' ? '' : s[2]) + '">' + esc(s[1]) + '</div></div>';
      }).join('') + '</div>' +
      '<div class="pur-toolbar">' +
      p.chips.map(function (c, i) {
        return '<button class="pur-chip' + (S.chip === i ? ' on' : '') + '" data-a="chip" data-i="' + i + '">' + esc(c) + '</button>';
      }).join('') +
      '<span class="pur-tb-r">' +
      '<button class="pur-btn sec" data-a="noop">' + esc(p.secondary) + '</button>' +
      '<button class="pur-btn" data-a="open-form" data-f="' + esc(p.primary[1]) + '">' + esc(p.primary[0]) + '</button>' +
      '</span></div>' +
      '<div class="pur-table"><div class="pur-th">' +
      p.cols.map(function (c, i) {
        var w = p.widths[i];
        return '<span class="' + (i === 0 ? 'first' : '') + (p.nums.indexOf(i) >= 0 ? ' num' : '') + '" style="' +
          (w ? 'width:' + w + 'px;flex:none;' : 'flex:1 1 0%;') + (p.nums.indexOf(i) >= 0 ? 'text-align:right;' : '') + '">' + esc(c) + '</span>';
      }).join('') + '</div>' +
      (rows.length ? rows.map(function (r) {
        return '<div class="pur-tr">' + r.map(function (cell, i) {
          var w = p.widths[i];
          var style = (w ? 'width:' + w + 'px;flex:none;' : 'flex:1 1 0%;');
          if (cell.pill) return '<span class="pur-td' + (i === 0 ? ' first' : '') + '" style="' + style + '">' + pill(cell.pill[0], cell.pill[1]) + '</span>';
          return '<span class="pur-td' + (i === 0 ? ' first' : ' meta') + (p.nums.indexOf(i) >= 0 ? ' num' : '') + '" style="' + style +
            (p.nums.indexOf(i) >= 0 ? 'text-align:right;' : '') + '">' + esc(cell.t) +
            (cell.s ? '<small>' + esc(cell.s) + '</small>' : '') + '</span>';
        }).join('') + '</div>';
      }).join('') : '<div class="pur-empty">Nothing here yet.</div>') +
      '</div></div></div>';
  }

  /* ── create flows ───────────────────────────────────────────────────── */
  // Mandatory on every create flow, per the handoff.
  function neverSeesHTML() {
    return '<div class="pur-never"><div class="pur-never-t">Purchase never sees</div>' +
      '<div class="pur-never-b">The client selling price or the job margin. Cost, allowance and supplier — that is the whole picture on this side.</div></div>';
  }
  function actionsHTML(primary, disabled, note) {
    return '<div class="pur-actions pinned">' +
      '<button class="pur-btn" data-a="submit"' + (disabled ? ' disabled' : '') + '>' + esc(primary) + '</button>' +
      '<button class="pur-btn sec" data-a="draft">Save as draft</button>' +
      '<span class="sp"></span>' +
      (note ? '<span class="pur-more">' + esc(note) + '</span>' : '') +
      '<button class="pur-btn sec" data-a="discard" style="color:var(--tx3)">Discard</button></div>';
  }

  function formPR() {
    var pr = safe(purQueuePR, [])[0];
    var lines = pr ? (pr.items || []) : [];
    var sel = lines.filter(function (l, i) { return S.reqSel[i] !== false; });
    var value = sel.reduce(function (s, l) {
      var it = l.itemId ? itemMaster.find(function (i) { return i.id === l.itemId; }) : null;
      return s + ((it ? (it.lastPurchaseRate || it.cost || 0) : 0) * (Number(l.qty) || 0));
    }, 0);
    var over = value > PO_SOURCING_THRESHOLD;
    return '<div class="pur-page"><div class="pur-form">' +
      '<div class="pur-form-l">' +
      '<div class="pur-fc"><h3 class="pur-fc-t">Lines from the verified BOM</h3>' +
      (lines.length ? lines.map(function (l, i) {
        var on = S.reqSel[i] !== false;
        return '<button class="pur-sel ' + (on ? 'on' : 'off') + '" data-a="req-line" data-i="' + i + '">' +
          '<span class="pur-cb">' + (on ? '✓' : '') + '</span><span>' +
          '<span class="pur-sel-n">' + esc(l.name) + '</span>' +
          '<span class="pur-sel-s">' + esc((l.qty || 0) + ' ' + (l.unit || '')) + '</span></span></button>';
      }).join('') : '<p class="pur-sub">No open request to draw lines from.</p>') + '</div>' +
      '<div class="pur-fc"><h3 class="pur-fc-t">Priority</h3>' +
      '<div class="pur-seg">' +
      '<button class="' + (S.priority === 'Normal' ? 'on' : '') + '" data-a="prio" data-v="Normal">Normal</button>' +
      '<button class="' + (S.priority !== 'Normal' ? 'on' : '') + '" data-a="prio" data-v="Urgent">Urgent — floor is waiting</button>' +
      '</div></div>' +
      actionsHTML('Raise the request', !sel.length) +
      '</div><div class="pur-form-r">' +
      '<div class="pur-fc"><div class="pur-fl">Requested value</div>' +
      '<div style="font-size:24px;font-weight:650;letter-spacing:-.02em;">' + esc(bd(value)) + '</div>' +
      '<div style="margin-top:10px;">' + pill(over ? 'Above ' + bd(PO_SOURCING_THRESHOLD) + ' — three quotes required' : 'Under ' + bd(PO_SOURCING_THRESHOLD) + ' — order direct', over ? 'warn' : 'ok') + '</div>' +
      '<p class="pur-never-b" style="margin-top:10px;">The BOM allowance is the ceiling. Request less and the balance stays available — request more and it needs a variation before Purchase can act.</p>' +
      '</div>' + neverSeesHTML() + '</div></div></div>';
  }

  function formRFQ() {
    var picked = suppliers.filter(function (s) { return S.rfqSel[s.id]; });
    var met = rfqMeetsQuoteRule(picked.length);
    return '<div class="pur-page"><div class="pur-form">' +
      '<div class="pur-form-l">' +
      '<div class="pur-fc"><h3 class="pur-fc-t">Which suppliers?</h3>' +
      (suppliers.length ? suppliers.slice(0, 12).map(function (s) {
        var on = !!S.rfqSel[s.id];
        return '<button class="pur-sel ' + (on ? 'on' : '') + '" data-a="rfq-sup" data-s="' + esc(s.id) + '">' +
          '<span class="pur-cb">' + (on ? '✓' : '') + '</span><span>' +
          '<span class="pur-sel-n">' + esc(s.name) + '</span>' +
          '<span class="pur-sel-s">' + esc((s.stockCategory || s.country || 'General') + ' · ' + onTimeLabel(s.id) + (s.creditDays ? ' · ' + s.creditDays + ' days' : '')) + '</span>' +
          '</span></button>';
      }).join('') : '<p class="pur-sub">No suppliers on the master yet.</p>') +
      '<div class="pur-banner ' + (met ? 'ok' : 'bad') + '">' +
      (met ? 'Three or more — the rule is met' : 'Fewer than three — Operations will send it back') + '</div>' +
      '</div>' +
      actionsHTML('Send the RFQ to ' + picked.length + ' supplier' + (picked.length === 1 ? '' : 's'), !picked.length) +
      '</div><div class="pur-form-r">' +
      '<div class="pur-fc"><div class="pur-fl">What the supplier sees</div>' +
      '<p class="pur-never-b" style="margin-top:6px;">The specification and the quantity. Our allowance, the job card and the client never leave the building.</p></div>' +
      neverSeesHTML() + '</div></div></div>';
  }

  function formPO() {
    var rfq = safe(purQueueCMP, [])[0];
    var rec = rfq ? safe(function () { return rfqRecommended(rfq); }, null) : null;
    var value = rec ? rec.price : 0;
    var route = safe(function () { return poSigningRoute(value); }, []);
    return '<div class="pur-page"><div class="pur-form">' +
      '<div class="pur-form-l">' +
      '<div class="pur-fc"><h3 class="pur-fc-t">Lines from the chosen quote</h3>' +
      (rfq ? '<div class="pur-lt"><div class="pur-lt-h"><span class="pur-lt-d">Item</span>' +
        '<span class="pur-lt-q">Qty</span><span class="pur-lt-v">Value</span></div>' +
        rfq.items.map(function (l) {
          return '<div class="pur-lt-r"><span class="pur-lt-d">' + esc(l.name) + '</span>' +
            '<span class="pur-lt-q">' + esc((l.qty || 0) + ' ' + (l.unit || '')) + '</span>' +
            '<span class="pur-lt-v">' + esc(bd(value)) + '</span></div>';
        }).join('') + '</div>'
        : '<p class="pur-sub">No quote selected yet — compare quotes on the dashboard first.</p>') +
      '</div>' +
      actionsHTML('Raise the purchase order', !rfq) +
      '</div><div class="pur-form-r">' +
      '<div class="pur-fc"><div class="pur-fl">The signing route</div>' +
      route.map(function (r, i) {
        return '<div style="display:flex;gap:8px;align-items:baseline;margin-top:8px;">' +
          '<span class="pur-pill plain">' + (i + 1) + '</span><span>' +
          '<span style="font-size:12.5px;font-weight:650;">' + esc(r.who) + '</span>' +
          (r.note ? '<span class="pur-sel-s">' + esc(r.note) + '</span>' : '') + '</span></div>';
      }).join('') +
      '<p class="pur-never-b" style="margin-top:10px;">Every purchase order is released by Operations, whatever its value.</p></div>' +
      neverSeesHTML() + '</div></div></div>';
  }

  function formItem() {
    var gate = safe(function () { return itemGateState(S.itemName, { override: S.itemOverride, difference: S.itemDiff }); },
      { state: 'clear', matches: [], canCreate: true, title: 'No match — safe to create', reason: '' });
    var units = safe(function () { return (typeof units !== 'undefined' ? units : null); }, null);
    var unitList = (typeof window.units !== 'undefined' && window.units && window.units.length)
      ? window.units.map(function (u) { return u.name || u; }) : ['Nos', 'Mtr', 'Sqm', 'Kg', 'Ltr', 'Set'];
    return '<div class="pur-page"><div class="pur-form">' +
      '<div class="pur-form-l">' +
      '<div class="pur-fc"><h3 class="pur-fc-t">The item</h3>' +
      '<div class="pur-fg"><label class="pur-fl">Description</label>' +
      '<input class="pur-fi" id="pur-item-name" value="' + esc(S.itemName) + '" placeholder="e.g. Veneer Oak bookmatched 18mm sheet"></div>' +
      '<div class="pur-fg2"><div class="pur-fg"><label class="pur-fl">Category</label>' +
      '<input class="pur-fi" id="pur-item-cat" placeholder="Stock category"></div>' +
      '<div class="pur-fg"><label class="pur-fl">Item code</label>' +
      '<div class="pur-lock">' + esc(safe(function () { return nextItemStockCode(); }, 'assigned')) + ' · assigned 🔒</div></div></div>' +
      '<div class="pur-fg"><label class="pur-fl">Unit of measure</label>' +
      '<div class="pur-diffs">' + unitList.map(function (u) {
        return '<button class="pur-chip' + (S.itemUnit === u ? ' on' : '') + '" data-a="item-unit" data-v="' + esc(u) + '">' + esc(u) + '</button>';
      }).join('') + '</div>' +
      '<div class="pur-sel-s" style="margin-top:6px;">this cannot change once a BOM uses it</div></div>' +
      '<div class="pur-fg2"><div class="pur-fg"><label class="pur-fl">Standard rate</label>' +
      '<input class="pur-fi" id="pur-item-rate" type="number" step="0.001" placeholder="0.000"></div>' +
      '<div class="pur-fg"><label class="pur-fl">Reorder level</label>' +
      '<input class="pur-fi" id="pur-item-reorder" type="number" placeholder="0"></div></div>' +
      '<div class="pur-fg"><label class="pur-fl">Stocked or buy-to-order</label>' +
      '<div class="pur-seg"><button class="' + (S.itemStock ? 'on' : '') + '" data-a="item-stock" data-v="1">Stocked</button>' +
      '<button class="' + (S.itemStock ? '' : 'on') + '" data-a="item-stock" data-v="0">Buy-to-order</button></div></div>' +
      '<div class="pur-fg"><label class="pur-fl">Specification</label>' +
      '<textarea class="pur-fi" id="pur-item-spec" placeholder="Anything the supplier needs to quote against"></textarea></div>' +
      '</div>' +
      actionsHTML(gate.canCreate ? 'Create the item' : 'Cannot create — duplicate', !gate.canCreate, gate.reason) +
      '</div><div class="pur-form-r">' + gateCardHTML(gate) + neverSeesHTML() + '</div></div></div>';
  }

  // The gate card: top of the right rail on desktop, inline below the
  // fields on phone (the column stacks, which puts it there naturally).
  function gateCardHTML(gate) {
    return '<div class="pur-gate ' + gate.state + '">' +
      '<div class="pur-gate-t">' + esc(gate.title) + '</div>' +
      '<div class="pur-gate-s">' +
      (gate.state === 'exact' ? 'There is no override for an exact match. Change the description, or open the existing code.'
        : gate.state === 'near' ? 'Say how this item differs before it can be created. The reason is stored on the code and shown to anyone who searches either spelling.'
          : gate.state === 'weak' ? 'One loose match, shown for information. You can create this.'
            : 'Nothing on the master looks like this.') + '</div>' +
      gate.matches.map(function (m) {
        var pct = Math.round(m.score * 100);
        return '<div class="pur-match"><div class="pur-match-h">' +
          '<span class="pur-match-n">' + esc(m.name) + '</span>' +
          '<span class="pur-match-p ' + (pct >= 92 ? 'bad' : pct >= 62 ? 'warn' : '') + '">' + pct + '%</span></div>' +
          '<div class="pur-match-s">' + esc(m.id + ' · ' + (m.unit || '—') + ' · used on ' + m.bomUses + ' BOM' + (m.bomUses === 1 ? '' : 's')) + '</div>' +
          '<button class="pur-use" data-a="use-code" data-c="' + esc(m.id) + '">Use this code</button></div>';
      }).join('') +
      (gate.state === 'near'
        ? '<button class="pur-btn sec" style="width:100%;margin-top:4px;" data-a="not-dup">' +
        (S.itemOverride ? '✓ Declared a different item' : 'Not a duplicate — this is a different item') + '</button>' +
        (S.itemOverride ? '<div class="pur-diffs">' + safe(function () { return ITEM_DIFF_REASONS; }, []).map(function (d) {
          return '<button class="pur-chip' + (S.itemDiff === d ? ' on' : '') + '" data-a="item-diff" data-v="' + esc(d) + '">' + esc(d) + '</button>';
        }).join('') + '</div>' : '')
        : '') + '</div>';
  }

  var FORMS = { pr: formPR, rfq: formRFQ, po: formPO, item: formItem };

  /* ── render + events ────────────────────────────────────────────────── */
  function html() {
    if (S.view === 'form') return (FORMS[S.form] || formPR)();
    if (S.view === 'page') return pageHTML();
    return dashHTML();
  }

  function title() {
    if (S.view === 'form') return ({ pr: 'New purchase request', rfq: 'New request for quotation', po: 'Raise a purchase order', item: 'New inventory item' })[S.form] || 'Create';
    if (S.view === 'page') return (PAGES[S.page] || PAGES.pr).title;
    return 'Purchase';
  }
  function subtitle() {
    var d = new Date();
    var day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
    var dateStr = day + ' ' + dmy(today());
    if (S.view === 'form') return 'Purchase · draft · nothing is sent until you say so';
    if (S.view === 'page') return 'Purchase · ' + dateStr;
    var k = safe(function () { return getPurchaseKPIs(); }, {});
    return dateStr + ' · ' + (k.openPOs || 0) + ' open POs · ' + (k.lateDeliveries || 0) +
      ' supplier deliver' + ((k.lateDeliveries === 1) ? 'y' : 'ies') + ' late · ' + (k.grnMismatches || 0) + ' GRN short';
  }

  function paint() {
    if (!root) return;
    root.innerHTML = html();
    // The shell owns the topbar, so the title/subtitle are pushed to it
    // rather than drawn again here.
    var t = document.querySelector('#purch-module-wrap .xs-title');
    var s = document.querySelector('#purch-module-wrap .xs-sub');
    if (t) t.textContent = title();
    if (s) s.textContent = subtitle();
    // Back is hidden on the dashboard root, present on page and form.
    if (typeof execRenderNav === 'function') execRenderNav();
    if (typeof execMarkActive === 'function') execMarkActive('pur-' + (S.view === 'dash' ? 'dash' : S.page));
  }

  function onClick(e) {
    var el = e.target.closest('[data-a]');
    if (!el) return;
    var a = el.getAttribute('data-a');

    if (a === 'step') { S.step = el.getAttribute('data-k'); paint(); return; }
    if (a === 'chip') { S.chip = Number(el.getAttribute('data-i')) || 0; paint(); return; }
    if (a === 'noop') return;

    if (a === 'open-form') {
      var f = el.getAttribute('data-f');
      // Only four create flows exist; the other primaries point at pages
      // that own the action rather than inventing a fifth form.
      if (FORMS[f]) { S.view = 'form'; S.form = f; paint(); }
      else purToast('That is recorded from its own screen.');
      return;
    }
    if (a === 'discard') { S.view = S.page ? 'page' : 'dash'; S.form = null; paint(); return; }
    if (a === 'draft') { purToast('Saved as a draft.'); return; }

    // dashboard actions
    if (a === 'go-rfq') { S.view = 'form'; S.form = 'rfq'; paint(); return; }
    if (a === 'go-rfq-page') { go('page', 'rfq'); return; }
    if (a === 'go-po') { go('page', 'po'); return; }
    if (a === 'go-grn') { go('page', 'grn'); return; }
    if (a === 'pr-order') { S.view = 'form'; S.form = 'po'; paint(); return; }
    if (a === 'rel-chase') { purToast('Operations has been told these are waiting.'); return; }
    if (a === 'late-revise' || a === 'late-remind') { purToast('Chase logged against the supplier.'); return; }

    if (a === 'cmp-award') {
      var rfq = safe(purQueueCMP, [])[0];
      if (!rfq) return;
      var rec = safe(function () { return rfqRecommended(rfq); }, null);
      if (!rec) { purToast('No quote to award yet.'); return; }
      var r = awardRFQ(rfq.id, rec.supplierId, 'Ali Mansoor');
      purToast(r && r.error ? r.error : (r.id + ' raised — it now needs Operations to release it.'));
      paint(); return;
    }
    if (a === 'grn-claim') {
      var g = safe(purQueueGRN, [])[0];
      if (!g) return;
      var note = window.prompt('What is being claimed?');
      if (note === null) return;
      var res = claimGRNBalance(g.id, 'Ali Mansoor', note);
      purToast(res && res.error ? res.error : 'Claim raised against the supplier.');
      paint(); return;
    }

    // form actions
    if (a === 'req-line') { var i = el.getAttribute('data-i'); S.reqSel[i] = S.reqSel[i] === false; paint(); return; }
    if (a === 'prio') { S.priority = el.getAttribute('data-v'); paint(); return; }
    if (a === 'rfq-sup') { var sid = el.getAttribute('data-s'); S.rfqSel[sid] = !S.rfqSel[sid]; paint(); return; }
    if (a === 'item-unit') { S.itemUnit = el.getAttribute('data-v'); paint(); return; }
    if (a === 'item-stock') { S.itemStock = el.getAttribute('data-v') === '1'; paint(); return; }
    if (a === 'not-dup') { S.itemOverride = !S.itemOverride; if (!S.itemOverride) S.itemDiff = ''; paint(); return; }
    if (a === 'item-diff') { S.itemDiff = el.getAttribute('data-v'); paint(); return; }
    if (a === 'use-code') {
      // Offering the existing code is the point — a block with no way
      // forward gets worked around.
      go('page', 'item');
      purToast(el.getAttribute('data-c') + ' is the existing code for this item.');
      return;
    }
    if (a === 'submit') { submitForm(); return; }
  }

  function submitForm() {
    if (S.form === 'rfq') {
      var picked = Object.keys(S.rfqSel).filter(function (k) { return S.rfqSel[k]; });
      var pr = safe(purQueuePR, [])[0];
      var r = createRFQ({
        linkedPRId: pr ? pr.id : null,
        items: pr ? pr.items : [{ name: 'Sourced item', qty: 1, unit: 'Nos' }],
        supplierIds: picked, raisedBy: 'Ali Mansoor'
      });
      purToast(r && r.error ? r.error : (r.id + ' sent to ' + picked.length + ' suppliers.'));
      if (r && !r.error) { S.rfqSel = {}; go('page', 'rfq'); }
      return;
    }
    if (S.form === 'item') {
      var name = (document.getElementById('pur-item-name') || {}).value || S.itemName;
      var cat = (document.getElementById('pur-item-cat') || {}).value || 'Uncategorised';
      var rate = Number((document.getElementById('pur-item-rate') || {}).value) || 0;
      var reorder = Number((document.getElementById('pur-item-reorder') || {}).value) || 0;
      var spec = (document.getElementById('pur-item-spec') || {}).value || '';
      var res = createItemMasterEntry({
        name: name, stockCategory: cat, unit: S.itemUnit, cost: rate,
        lastPurchaseRate: rate, reorderLevel: reorder, description: spec,
        duplicateOverride: S.itemOverride, duplicateDifference: S.itemDiff
      });
      purToast(res && res.error ? res.error : (res.id + ' created.'));
      if (res && !res.error) {
        S.itemName = ''; S.itemOverride = false; S.itemDiff = '';
        go('page', 'item');
      } else paint();
      return;
    }
    purToast('Raised.');
    go('page', S.form === 'po' ? 'po' : 'pr');
  }

  function onInput(e) {
    if (e.target && e.target.id === 'pur-item-name') {
      var v = e.target.value;
      // Editing the description resets the override AND the stated
      // difference — a reason given for one spelling must not carry to
      // another. itemGateResetOnEdit() holds that rule.
      var next = safe(function () {
        return itemGateResetOnEdit({ desc: S.itemName, override: S.itemOverride, difference: S.itemDiff }, v);
      }, { desc: v, override: false, difference: '' });
      S.itemName = v; S.itemOverride = next.override; S.itemDiff = next.difference;
      // Repaint only the gate card so the caret is never disturbed.
      var card = root.querySelector('.pur-gate');
      if (card) {
        var gate = safe(function () { return itemGateState(v, { override: S.itemOverride, difference: S.itemDiff }); },
          { state: 'clear', matches: [], canCreate: true, title: 'No match — safe to create', reason: '' });
        card.outerHTML = gateCardHTML(gate);
        var btn = root.querySelector('[data-a="submit"]');
        if (btn) {
          btn.disabled = !gate.canCreate;
          btn.textContent = gate.canCreate ? 'Create the item' : 'Cannot create — duplicate';
        }
      }
    }
  }

  function purToast(msg) {
    if (typeof commsToast === 'function') return commsToast(msg);
    if (typeof purchAlert === 'function') return purchAlert(msg);
    console.log('[purchase]', msg);
  }

  /* ── public ─────────────────────────────────────────────────────────── */
  function go(view, key) {
    S.view = view;
    if (view === 'page' && key) { S.page = key; S.chip = 0; }
    if (view === 'form') S.form = key;
    paint();
  }
  // Back steps form → page → dashboard.
  function back() {
    if (S.view === 'form') { S.view = 'page'; S.form = null; paint(); return true; }
    if (S.view === 'page') { S.view = 'dash'; paint(); return true; }
    return false;
  }
  function isRoot() { return S.view === 'dash'; }

  function mount(el) {
    root = el;
    root.classList.add('pur');
    if (!root.__purBound) {
      root.addEventListener('click', onClick);
      root.addEventListener('input', onInput);
      root.__purBound = true;
    }
    paint();
  }

  return {
    mount: mount, go: go, back: back, isRoot: isRoot, paint: paint,
    state: S, PAGES: PAGES, STEPS: STEPS
  };
})();
