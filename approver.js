// ══════════════════════════════════════════
// APPROVER MODULE
// Built session: 25 Jul 2026, from Salman's full live trace of the Sales ⇄
// Estimator ⇄ Approver loop (audit trail, comment system, Review Screen).
// Standalone module with its own identity, same pattern as estimator.js —
// Approver is a distinct role/login in Q-Pro, not a tab under Sales.
// Reads/writes quotations[]/enquiries[]/customers[] in data.js. Reuses
// renderQuotationAuditTable() from sales.js and computeQuotationTotals()/
// computeBOMTotals() from data.js — must load after both.
// ══════════════════════════════════════════

const approverStyleTag = document.createElement('style');
approverStyleTag.textContent = `
#approver-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#approver-module-wrap .ops-header{background:var(--biz-crimson);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#approver-module-wrap .approver-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#approver-module-wrap .approver-userbar{background:#f4e6ec;border-bottom:1px solid #e0c2d0;padding:8px 18px;font-size:11.5px;color:var(--biz-primary-dark);display:flex;align-items:center;gap:8px;flex:none;}
#approver-module-wrap .approver-userbar select{font-size:11.5px;padding:3px 6px;border-radius:6px;border:1px solid #e0c2d0;background:#fff;}
#approver-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
#approver-module-wrap .sales-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#approver-module-wrap .sales-kpi-tile .num{font-size:21px;font-weight:700;color:var(--biz-crimson);}
#approver-module-wrap .sales-kpi-tile .lbl{font-size:10.5px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#approver-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#approver-module-wrap .sales-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:3px 10px;border-radius:20px;background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#approver-module-wrap .sales-pill.draft{background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#approver-module-wrap .sales-pill.open{background:var(--biz-open-bg);color:var(--biz-open-text);}
#approver-module-wrap .sales-pill.confirmed{background:var(--biz-confirmed-bg);color:var(--biz-confirmed-text);}
#approver-module-wrap .sales-pill.closed{background:var(--biz-closed-bg);color:var(--biz-closed-text);}
#approver-module-wrap .sales-pill.stage-sales{background:#ede9fe;color:#5b21b6;}
#approver-module-wrap .sales-pill.stage-estimator{background:#fef3c7;color:#92400e;}
#approver-module-wrap .sales-pill.stage-approver{background:#fee2e2;color:#991b1b;}
#approver-module-wrap button.primary{background:var(--biz-crimson);color:#fff;border:0;border-radius:var(--biz-r-sm);padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .12s;}
#approver-module-wrap button.primary:hover{background:var(--biz-primary-dark);}
#approver-module-wrap button.secondary{background:var(--biz-card-bg);border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);color:var(--biz-text-muted);font-size:13px;padding:9px 18px;cursor:pointer;font-family:inherit;}
#approver-module-wrap .sales-field{margin-bottom:10px;}
#approver-module-wrap .sales-field label{font-size:10.5px;font-weight:700;color:var(--biz-text-muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px;}
#approver-module-wrap .sales-field input, #approver-module-wrap .sales-field select, #approver-module-wrap .sales-field textarea{width:100%;padding:9px 11px;border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);font-size:13px;box-sizing:border-box;font-family:inherit;background:var(--biz-input-bg);color:var(--biz-text);transition:border-color .12s;}
#approver-module-wrap .sales-field input:focus, #approver-module-wrap .sales-field select:focus, #approver-module-wrap .sales-field textarea:focus{outline:none;border-color:var(--biz-crimson);background:var(--biz-card-bg);}
#approver-module-wrap .sales-preview{background:#f4e6ec;border:1px solid #e0c2d0;border-radius:var(--biz-r);padding:12px;margin-bottom:14px;}
#approver-module-wrap .sales-preview p{font-size:12px;margin:2px 0;color:var(--biz-text-muted);}
#approver-module-wrap .sales-preview b{color:var(--biz-text);}
#approver-module-wrap .sales-back{font-size:12px;color:var(--biz-crimson);font-weight:600;cursor:pointer;margin-bottom:10px;display:inline-block;}
#approver-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
#approver-module-wrap table.sales-items th{text-align:left;padding:7px 6px;background:var(--biz-input-bg);color:var(--biz-text-muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--biz-border-light);}
#approver-module-wrap table.sales-items td{padding:7px 6px;border-bottom:1px solid var(--biz-border-light);vertical-align:top;}
#approver-module-wrap table.sales-items tr:hover td{background:#FAFBFD;}
#approver-module-wrap .sales-tile-row{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;}
#approver-module-wrap .sales-tile{border:0;border-radius:var(--biz-r);padding:14px 10px;text-align:center;font-size:11.5px;font-weight:700;color:#fff;cursor:pointer;box-shadow:var(--biz-shadow);transition:transform .12s,box-shadow .12s;text-transform:uppercase;letter-spacing:.2px;background:linear-gradient(135deg,var(--biz-crimson),var(--biz-crimson2));}
#approver-module-wrap .sales-tile:hover{transform:translateY(-2px);box-shadow:0 12px 28px 0 rgba(37,37,42,.14);}
#approver-module-wrap .sales-tile .sales-tile-icon{font-size:18px;display:block;margin-bottom:6px;}
#approver-module-wrap .apr-modal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:300;background:rgba(15,23,42,.55);align-items:center;justify-content:center;padding:20px;}
#approver-module-wrap .apr-modal-inner{background:var(--biz-card-bg);border-radius:14px;padding:18px;width:100%;max-width:420px;box-sizing:border-box;}
`;
document.head.appendChild(approverStyleTag);

// Approver identities — same STAFF-derived pool as Estimator, but defaults
// to Salman Abdullah, since he's the real-world approver at Al Maraya.
const APPROVER_USERS = STAFF.filter(s => s !== 'Operations');
let approverCurrentUser = APPROVER_USERS.includes('Salman Abdullah') ? 'Salman Abdullah' : APPROVER_USERS[0];

// ── Module shell ──
const approverModuleWrap = document.createElement('div');
approverModuleWrap.id = 'approver-module-wrap';
approverModuleWrap.style.cssText = 'display:none;';
approverModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">✅</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Approver</div>
        <div style="color:rgba(255,255,255,.7);font-size:11px;">Pick → Review → Approve</div>
      </div>
    </div>
    <button onclick="closeApproverModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="approver-userbar">
    Logged in as
    <select id="approver-user-select" onchange="approverSetCurrentUser(this.value)"></select>
  </div>
  <div class="approver-scroll">
    <div id="approver-body"></div>
  </div>
  <div class="apr-modal" id="apr-comment-modal">
    <div class="apr-modal-inner" id="apr-comment-modal-inner"></div>
  </div>
  <div class="apr-modal" id="apr-detail-modal">
    <div class="apr-modal-inner" id="apr-detail-modal-inner" style="max-width:560px;max-height:80vh;overflow-y:auto;"></div>
  </div>
`;
document.body.appendChild(approverModuleWrap);

let approverView = 'dashboard';        // dashboard | hub | review
let approverActiveQtnId = null;
let approverDashExpanded = null;       // null | 'pending' | 'forApproval'
let approverCommentLineId = null;      // which line's Comment modal is open

function aEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }

function approverAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('approver-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'approver-toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;padding:10px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

// ── Module open/close ──
function openApproverModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap', 'admin-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  approverModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  const sel = document.getElementById('approver-user-select');
  if (sel) sel.innerHTML = APPROVER_USERS.map(u => `<option value="${u}" ${u === approverCurrentUser ? 'selected' : ''}>${u}</option>`).join('');
  approverView = 'dashboard';
  renderApproverBody();
}
function closeApproverModule() { closeModuleWrap(approverModuleWrap, 'launchApproverModule'); }
function launchApproverModule() { openApproverModule(); }

function approverSetCurrentUser(name) {
  approverCurrentUser = name;
  renderApproverBody();
}

function renderApproverBody() {
  const body = document.getElementById('approver-body');
  if (!body) return;
  let content = '';
  switch (approverView) {
    case 'dashboard': content = renderApproverDashboard(); break;
    case 'hub': content = renderApproverQuoteHub(); break;
    case 'review': content = renderApproverReview(); break;
    default: content = renderApproverDashboard();
  }
  body.innerHTML = content;
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════

function approverToggleTile(tile) {
  approverDashExpanded = approverDashExpanded === tile ? null : tile;
  renderApproverBody();
}

function approverPick(qtnId) {
  if (!window.confirm('Do you Want to Pick This Quotation?')) return;
  const result = pickQuotation(qtnId, approverCurrentUser, 'approver');
  if (result.error) { approverAlert(result.error); return; }
  approverAlert(`✓ Picked ${qtnId}.`);
  renderApproverBody();
}

function approverQtnRowSummary(q) {
  const enq = enquiries.find(e => e.id === q.enquiryId);
  const c = customers.find(x => x.id === q.customerId);
  return { client: c ? c.name : '—', salesman: enq ? enq.salesPerson : '—' };
}

// "PO Approval" is a rollup + shortcut into Purchasing's own PO approval
// queue (getPendingPOApprovals()) rather than a second PO approval flow.
function approverOpenPurchasing() {
  closeApproverModule();
  setTimeout(() => { if (typeof launchPurchasingModule === 'function') launchPurchasingModule(); }, 150);
}

function renderApproverDashboard() {
  const k = getApproverKPIs(approverCurrentUser);

  const commsHtml = `
    <div class="sales-card" style="display:flex;justify-content:space-between;align-items:center;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">Logged in as <b>${aEsc(approverCurrentUser)}</b></p>
      <div style="display:flex;gap:14px;">
        <span style="font-size:11.5px;font-weight:600;color:var(--biz-primary,#600131);cursor:pointer;" onclick="notifyStorekeeper('${approverCurrentUser}',null,null,'renderApproverBody')">🏬 Notify Storekeeper</span>
        <span style="font-size:11.5px;font-weight:600;color:var(--biz-primary,#600131);cursor:pointer;" onclick="requestPurchaseFromModule('closeApproverModule',null,null)">🛒 Request Purchase</span>
      </div>
    </div>
    ${renderInboxWidget(approverCurrentUser, 'renderApproverBody', 5)}`;

  const kpiTilesHtml = `
    <div class="sales-kpi-grid">
      <div class="sales-kpi-tile" style="cursor:pointer;" onclick="approverToggleTile('pending')"><div class="num">${k.pendingToPick}</div><div class="lbl">Pending to Pick</div></div>
      <div class="sales-kpi-tile" style="cursor:pointer;" onclick="approverToggleTile('forApproval')"><div class="num">${k.forApproval}</div><div class="lbl">For Approval</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.quotationsTotal}</div><div class="lbl">Quotations (Total)</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.prPending}</div><div class="lbl">PR Pending</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.prNotReceived}</div><div class="lbl">PR Not Received</div></div>
      <div class="sales-kpi-tile" style="cursor:pointer;" onclick="approverOpenPurchasing()"><div class="num">${k.poApproval}</div><div class="lbl">PO Approval →</div></div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Category Breakdown</p>
      ${cwMiniBars([
        { label: 'Curtain', value: k.categoryBreakdown.curtain, color: cwOrdinalColor(0) },
        { label: 'Upholstery', value: k.categoryBreakdown.upholstery, color: cwOrdinalColor(1) },
        { label: 'Joinery', value: k.categoryBreakdown.joinery, color: cwOrdinalColor(2) }
      ])}
    </div>`;

  let expandedHtml = '';
  if (approverDashExpanded === 'pending') {
    expandedHtml = `<div class="sales-card"><p style="font-weight:700;font-size:13px;margin-bottom:8px;">Pending to Pick</p>` +
      (k.pendingToPickList.length === 0 ? `<p style="font-size:12px;color:#64748b;">Nothing pending.</p>` :
        k.pendingToPickList.map(q => {
          const s = approverQtnRowSummary(q);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;">
            <div><p style="font-weight:700;font-size:12.5px;">${q.id}</p><p style="font-size:11px;color:#64748b;">${aEsc(s.client)} · ${aEsc(q.projectName)} · ${aEsc(s.salesman)}</p></div>
            <button class="primary" style="font-size:11px;padding:6px 10px;" onclick="approverPick('${q.id}')">Pick</button>
          </div>`;
        }).join('')) + `</div>`;
  } else if (approverDashExpanded === 'forApproval') {
    expandedHtml = `<div class="sales-card"><p style="font-weight:700;font-size:13px;margin-bottom:8px;">For Approval</p>` +
      (k.forApprovalList.length === 0 ? `<p style="font-size:12px;color:#64748b;">Nothing picked yet.</p>` :
        k.forApprovalList.map(q => {
          const s = approverQtnRowSummary(q);
          return `<div style="padding:8px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="openApproverReview('${q.id}')">
            <p style="font-weight:700;font-size:12.5px;color:var(--biz-primary);">${q.id}</p>
            <p style="font-size:11px;color:#64748b;">${aEsc(s.client)} · ${aEsc(q.projectName)} · ${aEsc(s.salesman)}</p>
          </div>`;
        }).join('')) + `</div>`;
  }

  return commsHtml + kpiTilesHtml + expandedHtml;
}

// ══════════════════════════════════════════
// MANAGE QUOTE HUB (Approver view)
// ══════════════════════════════════════════

function openApproverQuoteHub(qtnId) {
  approverActiveQtnId = qtnId;
  approverView = 'hub';
  renderApproverBody();
}

function renderApproverQuoteHub() {
  const q = quotations.find(x => x.id === approverActiveQtnId);
  if (!q) return `<p style="font-size:12.5px;color:#64748b;">Quotation not found.</p>`;
  const totals = computeQuotationTotals(q);
  const enq = enquiries.find(e => e.id === q.enquiryId);
  const c = customers.find(x => x.id === q.customerId);

  return `
    <span class="sales-back" onclick="approverView='dashboard';renderApproverBody();">‹ Back to Dashboard</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:15px;">${q.id} <span class="sales-pill ${q.lifecycleStatus}">${q.lifecycleStatus}</span> <span class="sales-pill stage-${q.stage}">${q.stage.toUpperCase()}</span></p>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">Client: ${aEsc(c ? c.name : '—')} · Project: ${aEsc(q.projectName)}</p>
      <p style="font-size:12px;color:#64748b;">Qtn Date: ${q.date} · Confirm Date: ${q.confirmDate || '—'} · Amount: BD ${totals.netTotal.toFixed(3)}</p>
      <p style="font-size:11px;color:#94a3b8;margin-top:4px;">${q.parentJobId ? `Variation for Job <b>${aEsc(q.parentJobId)}</b>` : `Linked Enquiry: ${aEsc(q.enquiryId)} · Salesman: ${aEsc(enq ? enq.salesPerson : '—')}`} · Picked by: ${aEsc(q.approverPickedBy) || '—'}</p>
    </div>
    <div class="sales-tile-row">
      <div class="sales-tile" onclick="openApproverReview('${q.id}')"><span class="sales-tile-icon">🔍</span>Review Quote</div>
      ${q.lifecycleStatus !== 'draft' ? `<div class="sales-tile" onclick="openPrintDialog('${q.id}',true)"><span class="sales-tile-icon">🖨</span>Print Quote</div>` : ''}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Action</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="secondary" style="flex:1;" onclick="approverTransferToEstimator('${q.id}')">Back to Estimator</button>
        <button class="primary" style="flex:1;" onclick="approverApproveQuote('${q.id}')">Approve Quote</button>
      </div>
    </div>
    ${renderQuotationAuditTable(q)}`;
}

// ══════════════════════════════════════════
// APPROVER REVIEW SCREEN (print-style)
// ══════════════════════════════════════════

function openApproverReview(qtnId) {
  approverActiveQtnId = qtnId;
  approverView = 'review';
  renderApproverBody();
}

function renderApproverReview() {
  const q = quotations.find(x => x.id === approverActiveQtnId);
  if (!q) return `<p style="font-size:12.5px;color:#64748b;">Quotation not found.</p>`;
  const c = customers.find(x => x.id === q.customerId);

  // Page-level summary — quote value, cost, profit, VAT, grand total.
  // Cost only aggregates lines that actually have a BOM (matches the
  // per-row "—" fallback below); a quote isn't fully estimated until every
  // line has one, so this total is a running figure, not a guarantee.
  let sumAmount = 0, sumDisc = 0, sumNet = 0, sumCost = 0;
  q.items.forEach(it => {
    sumAmount += it.amount; sumDisc += it.discAmt; sumNet += it.netAmount;
    if (it.bom) sumCost += computeBOMTotals(it.bom).totalCostInclOH;
  });
  const subtotal = sumAmount - sumDisc;
  const vatTotal = sumNet - subtotal;
  const profitTotal = subtotal - sumCost;
  const profitPctTotal = sumCost > 0 ? (profitTotal / sumCost * 100).toFixed(1) + '%' : '—';

  const rows = q.items.map((it, i) => {
    let cost = '—', profit = '—', profitPct = '—';
    if (it.bom) {
      const t = computeBOMTotals(it.bom);
      cost = t.totalCostInclOH.toFixed(3);
      const actualProfit = it.rate * it.qty - t.totalCostInclOH;
      profit = actualProfit.toFixed(3);
      profitPct = t.totalCostInclOH > 0 ? (actualProfit / t.totalCostInclOH * 100).toFixed(1) + '%' : '—';
    }
    return `
      <tr style="cursor:pointer;" onclick="approverOpenItemDetailModal(${it.lineId})">
        <td>${i + 1}</td>
        <td>${aEsc(it.product)}${it.description ? `<div style="font-size:10.5px;color:#94a3b8;">${aEsc(it.description)}</div>` : ''}</td>
        <td>${it.qty}</td>
        <td>${it.rate.toFixed(3)}</td>
        <td>${it.discPercent}%</td>
        <td>${it.amount.toFixed(3)}</td>
        <td>${cost}</td>
        <td>${profit}</td>
        <td>${profitPct}</td>
        <td><button class="secondary" style="font-size:10px;padding:4px 7px;" onclick="event.stopPropagation();approverOpenCommentModal(${it.lineId})">${it.approverComment ? '✎ Comment' : '+ Comment'}</button></td>
        <td>—</td>
        <td><span style="cursor:pointer;color:#b91c1c;" onclick="event.stopPropagation();approverDeleteItem('${q.id}',${it.lineId})">✕</span></td>
      </tr>`;
  }).join('');

  return `
    <span class="sales-back" onclick="approverView='dashboard';renderApproverBody();">‹ Back to Dashboard</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:15px;">${aEsc(c ? c.name : '—')}</p>
      <p style="font-size:12px;color:#64748b;">${aEsc(c ? c.address : '—')} · Tel: ${aEsc(c ? c.tel : '—')}</p>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">Qtn No: ${aEsc(q.id)} · Date: ${q.date}</p>
      ${q.notes ? `<p style="font-size:12px;color:#64748b;margin-top:4px;"><b>Notes:</b> ${aEsc(q.notes)}</p>` : ''}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Common Comments</p>
      <textarea id="apr-header-comment" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;min-height:60px;">${aEsc(q.headerComment)}</textarea>
      <button class="primary" style="width:100%;margin-top:8px;" onclick="approverSubmitHeaderComment('${q.id}')">Submit</button>
    </div>
    <div class="sales-card" style="overflow-x:auto;">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Line Items</p>
      <p style="font-size:10.5px;color:#94a3b8;margin:-2px 0 8px;">Tap a row for its full material/labour/subcontract estimation breakdown.</p>
      <table class="sales-items"><tr><th>#</th><th>Name/Description</th><th>Qty</th><th>Price</th><th>Disc</th><th>Amount</th><th>Cost</th><th>Profit</th><th>Profit%</th><th>Comments</th><th>Image</th><th></th></tr>${rows}</table>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Quote Summary</p>
      <div class="sales-kpi-grid">
        <div class="sales-kpi-tile"><div class="num">${subtotal.toFixed(3)}</div><div class="lbl">Quote Value</div></div>
        <div class="sales-kpi-tile"><div class="num">${sumCost.toFixed(3)}</div><div class="lbl">Cost</div></div>
        <div class="sales-kpi-tile"><div class="num">${profitTotal.toFixed(3)}</div><div class="lbl">Profit (${profitPctTotal})</div></div>
      </div>
      <p style="font-size:12px;color:#64748b;">VAT: BD ${vatTotal.toFixed(3)}</p>
      <p style="font-weight:700;font-size:14px;margin-top:4px;">Grand Total: BD ${sumNet.toFixed(3)}</p>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Terms and Conditions</p>
      <p style="font-size:11.5px;color:#64748b;white-space:pre-wrap;">${aEsc(q.termsBody) || '—'}</p>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">ACTION</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="secondary" style="flex:1;" onclick="approverView='dashboard';renderApproverBody();">Exit</button>
        <button class="secondary" style="flex:1;" onclick="openApproverQuoteHub('${q.id}')">Manage Quote</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button class="secondary" style="flex:1;" onclick="approverTransferToEstimator('${q.id}')">Back to Estimator</button>
        <button class="primary" style="flex:1;" onclick="approverApproveQuote('${q.id}')">Approve Quote</button>
      </div>
    </div>`;
}

function approverSubmitHeaderComment(qtnId) {
  const text = document.getElementById('apr-header-comment').value;
  setQuotationHeaderComment(qtnId, text);
  approverAlert('✓ Comment saved.');
  renderApproverBody();
}

function approverDeleteItem(qtnId, lineId) {
  if (!window.confirm('Delete this line item?')) return;
  removeQuotationItem(qtnId, lineId);
  renderApproverBody();
}

// Per-line Comment modal
function approverOpenCommentModal(lineId) {
  approverCommentLineId = lineId;
  const item = findQuotationItem(approverActiveQtnId, lineId);
  const inner = document.getElementById('apr-comment-modal-inner');
  inner.innerHTML = `
    <p style="font-weight:700;font-size:14px;margin-bottom:10px;">Comment — ${aEsc(item.product)}</p>
    <textarea id="apr-line-comment-text" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;min-height:80px;">${aEsc(item.approverComment)}</textarea>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="primary" style="flex:1;" onclick="approverSaveLineComment()">Update</button>
      <button class="secondary" style="flex:1;" onclick="approverCloseCommentModal()">Cancel</button>
    </div>`;
  document.getElementById('apr-comment-modal').style.display = 'flex';
}
function approverCloseCommentModal() {
  document.getElementById('apr-comment-modal').style.display = 'none';
  approverCommentLineId = null;
}
function approverSaveLineComment() {
  const text = document.getElementById('apr-line-comment-text').value;
  setLineApproverComment(approverActiveQtnId, approverCommentLineId, text);
  approverCloseCommentModal();
  approverAlert('✓ Comment saved.');
  renderApproverBody();
}

// Per-line estimation breakdown — read-only by default, so the Approver
// can see exactly what went into the price before approving. A "✎ Correct"
// toggle underneath (approverCorrectingLineId) opens an editable Product
// Name/Description/Price panel — unlike the legacy Q-Pro "Approver Print"
// screen this replaces, every correction here requires a reason and is
// fully audit-logged (see approverCorrectItem() in data.js), never a
// silent inline edit.
let approverDetailLineId = null;
let approverCorrectingLineId = null;
function approverOpenItemDetailModal(lineId) {
  approverDetailLineId = lineId;
  approverCorrectingLineId = null;
  approverRenderDetailModal();
}
function approverRenderDetailModal() {
  const lineId = approverDetailLineId;
  const item = findQuotationItem(approverActiveQtnId, lineId);
  const inner = document.getElementById('apr-detail-modal-inner');
  if (!item) { document.getElementById('apr-detail-modal').style.display = 'none'; return; }

  const correctionPanel = approverCorrectingLineId === lineId ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;margin-top:10px;">
      <p style="font-weight:700;font-size:12px;margin-bottom:6px;color:#92400e;">Correct This Item</p>
      <div class="sales-field"><label>Product Name</label><input type="text" id="apr-corr-product" value="${aEsc(item.product)}"></div>
      <div class="sales-field"><label>Description</label><textarea id="apr-corr-desc">${aEsc(item.description)}</textarea></div>
      <div class="sales-field"><label>Price (Rate)</label><input type="number" step="0.001" id="apr-corr-rate" value="${item.rate.toFixed(3)}"></div>
      <div class="sales-field"><label>Reason for correction *</label><textarea id="apr-corr-reason" placeholder="Required — recorded in the audit trail"></textarea></div>
      <div style="display:flex;gap:8px;">
        <button class="primary" style="flex:1;" onclick="approverSaveCorrection()">Save Correction</button>
        <button class="secondary" style="flex:1;" onclick="approverCorrectingLineId=null;approverRenderDetailModal();">Cancel</button>
      </div>
    </div>` : `<button class="secondary" style="width:100%;margin-top:10px;" onclick="approverCorrectingLineId=${lineId};approverRenderDetailModal();">✎ Correct Product/Description/Price</button>`;

  const correctionsHistory = (item.corrections && item.corrections.length) ? `
    <div style="margin-top:10px;font-size:10.5px;color:#94a3b8;border-top:1px solid var(--biz-border-light);padding-top:6px;">
      <p style="font-weight:700;">Correction history:</p>
      ${item.corrections.map(c => `<p>${c.date} — ${aEsc(c.by)}: ${Object.entries(c.changes).map(([f, v]) => `${f} "${aEsc(String(v.from))}" → "${aEsc(String(v.to))}"`).join('; ')} (${aEsc(c.reason)})</p>`).join('')}
    </div>` : '';

  if (!item.bom) {
    inner.innerHTML = `
      <p style="font-weight:700;font-size:14px;margin-bottom:10px;">${aEsc(item.product)}</p>
      <p style="font-size:12.5px;color:#64748b;">No BOM has been entered for this item yet.</p>
      ${correctionPanel}${correctionsHistory}
      <button class="secondary" style="width:100%;margin-top:12px;" onclick="approverCloseDetailModal()">Close</button>`;
    document.getElementById('apr-detail-modal').style.display = 'flex';
    return;
  }
  const bom = item.bom;
  const t = computeBOMTotals(bom);
  const section = (title, rows, cols) => rows.length ? `
    <p style="font-weight:700;font-size:12px;margin:10px 0 4px;">${title}</p>
    <table class="sales-items"><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>${rows}</table>` : '';
  const matRows = bom.materials.map(m => `<tr><td>${aEsc(m.name)}</td><td>${m.qty} ${aEsc(m.unit)}</td><td>${m.rate.toFixed(3)}</td><td>${m.amount.toFixed(3)}</td></tr>`).join('');
  const labRows = bom.labour.map(l => `<tr><td>${dc(l.department).n}</td><td>${aEsc(l.empCategory)}</td><td>${l.noOfPpl} × ${l.qty}${l.calcMode === 'days' ? 'd' : 'h'}</td><td>${l.rate.toFixed(3)}</td><td>${l.amount.toFixed(3)}</td></tr>`).join('');
  const subRows = bom.subcontract.map(r => `<tr><td>${aEsc(r.vendor)}</td><td>${aEsc(r.workType)}</td><td>${r.amount.toFixed(3)}</td></tr>`).join('');
  const hirRows = bom.hiring.map(r => `<tr><td>${aEsc(r.vendor)}</td><td>${aEsc(r.workType)}</td><td>${r.amount.toFixed(3)}</td></tr>`).join('');
  const othRows = bom.others.map(r => `<tr><td>${aEsc(r.party)}</td><td>${aEsc(r.details)}</td><td>${r.amount.toFixed(3)}</td></tr>`).join('');
  inner.innerHTML = `
    <p style="font-weight:700;font-size:14px;margin-bottom:2px;">${aEsc(item.product)}${item.priceManuallyOverridden ? ' <span style="font-size:10px;font-weight:600;color:#92400e;">(price manually corrected)</span>' : ''}</p>
    <p style="font-size:11.5px;color:#94a3b8;margin-bottom:6px;">Qty: ${item.qty} ${aEsc(item.unit)} · Rate: BD ${item.rate.toFixed(3)}</p>
    ${section('Materials', matRows, ['Item', 'Qty', 'Rate', 'Amount'])}
    ${section('Labour', labRows, ['Dept', 'Category', 'PPL × Qty', 'Rate', 'Amount'])}
    ${section('Sub Contract', subRows, ['Vendor', 'Work Type', 'Amount'])}
    ${section('Hiring', hirRows, ['Vendor', 'Work Type', 'Amount'])}
    ${section('Others', othRows, ['Party', 'Details', 'Amount'])}
    <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--biz-border-light);font-size:12px;">
      <p>Total Cost: BD ${t.totalCost.toFixed(3)} · Overhead: BD ${(t.totalCostInclOH - t.totalCost).toFixed(3)}</p>
      <p>Cost incl. Overhead: BD ${t.totalCostInclOH.toFixed(3)} · Profit (${bom.profitPercent}%): BD ${t.profitAmount.toFixed(3)}</p>
      <p style="font-weight:700;margin-top:4px;">Calculated Selling Price: BD ${t.calculatedSellingPrice.toFixed(3)}${bom.sellingPriceOverride !== null ? ` (override applied: BD ${bom.sellingPriceOverride.toFixed(3)})` : ''}</p>
    </div>
    ${correctionPanel}${correctionsHistory}
    <button class="secondary" style="width:100%;margin-top:12px;" onclick="approverCloseDetailModal()">Close</button>`;
  document.getElementById('apr-detail-modal').style.display = 'flex';
}
function approverSaveCorrection() {
  const reason = document.getElementById('apr-corr-reason').value;
  const result = approverCorrectItem(approverActiveQtnId, approverCorrectingLineId, {
    product: document.getElementById('apr-corr-product').value,
    description: document.getElementById('apr-corr-desc').value,
    rate: Number(document.getElementById('apr-corr-rate').value)
  }, reason, approverCurrentUser);
  if (result && result.error) { approverAlert(result.error); return; }
  approverAlert('✓ Correction saved.');
  approverCorrectingLineId = null;
  approverRenderDetailModal();
  renderApproverBody();
}
function approverCloseDetailModal() {
  document.getElementById('apr-detail-modal').style.display = 'none';
}

// Matches the live confirmation copy exactly ("Do you Want to Change Status?").
function approverTransferToEstimator(qtnId) {
  if (!window.confirm('Do you Want to Change Status?')) return;
  transferQuotationStage(qtnId, 'estimator', approverCurrentUser);
  approverAlert('✓ Sent back to Estimator.');
  approverView = 'dashboard';
  renderApproverBody();
}
function approverApproveQuote(qtnId) {
  if (!window.confirm('Do you Want to Change Status?')) return;
  approveQuotation(qtnId, approverCurrentUser);
  approverAlert('✓ Quotation approved — back with Sales, status Open.');
  approverView = 'dashboard';
  renderApproverBody();
}
