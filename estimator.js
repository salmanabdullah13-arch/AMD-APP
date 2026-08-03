// ══════════════════════════════════════════
// ESTIMATOR MODULE
// Built session: 25 Jul 2026. Split out of sales.js into its own standalone
// module per Salman's direction (25 Jul 2026) — Estimator is a distinct
// user/role in Q-Pro (separate dashboard route, separate login), not a tab
// inside Sales. Reads/writes quotations[]/enquiries[]/customers[] and the
// BOM helper functions in data.js — same data layer Sales already uses,
// just a separate UI surface with its own identity.
//
// Creates its own #estimator-module-wrap dynamically, same pattern as
// storekeeper.js/sales.js. Must load after data.js and purchasing.js
// (reuses dc()/DEPTS/purchDeptOptionsHtml) and after sales.js is fine too,
// but does not depend on anything sales.js defines.
// ══════════════════════════════════════════

const estimatorStyleTag = document.createElement('style');
estimatorStyleTag.textContent = `
#estimator-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#estimator-module-wrap .ops-header{background:var(--biz-amber);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#estimator-module-wrap .estimator-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#estimator-module-wrap .estimator-userbar{background:#f4e6ec;border-bottom:1px solid #e0c2d0;padding:8px 18px;font-size:11.5px;color:var(--biz-primary-dark);display:flex;align-items:center;gap:8px;flex:none;}
#estimator-module-wrap .estimator-userbar select{font-size:11.5px;padding:3px 6px;border-radius:6px;border:1px solid #e0c2d0;background:#fff;}
#estimator-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
#estimator-module-wrap .sales-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#estimator-module-wrap .sales-kpi-tile .num{font-size:21px;font-weight:700;color:var(--biz-amber);}
#estimator-module-wrap .sales-kpi-tile .lbl{font-size:10.5px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#estimator-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#estimator-module-wrap .sales-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:3px 10px;border-radius:20px;background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#estimator-module-wrap .sales-pill.draft{background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#estimator-module-wrap .sales-pill.open{background:var(--biz-open-bg);color:var(--biz-open-text);}
#estimator-module-wrap .sales-pill.confirmed{background:var(--biz-confirmed-bg);color:var(--biz-confirmed-text);}
#estimator-module-wrap .sales-pill.closed{background:var(--biz-closed-bg);color:var(--biz-closed-text);}
#estimator-module-wrap .sales-pill.stage-sales{background:#ede9fe;color:#5b21b6;}
#estimator-module-wrap .sales-pill.stage-estimator{background:#fef3c7;color:#92400e;}
#estimator-module-wrap .sales-pill.stage-approver{background:#fee2e2;color:#991b1b;}
#estimator-module-wrap button.primary{background:var(--biz-amber);color:#fff;border:0;border-radius:var(--biz-r-sm);padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .12s;}
#estimator-module-wrap button.primary:hover{background:var(--biz-primary-dark);}
#estimator-module-wrap button.secondary{background:var(--biz-card-bg);border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);color:var(--biz-text-muted);font-size:13px;padding:9px 18px;cursor:pointer;font-family:inherit;}
#estimator-module-wrap .sales-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#estimator-module-wrap .sales-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:var(--biz-card-bg);color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#estimator-module-wrap .sales-tabbtn.active{background:var(--biz-amber);border-color:var(--biz-amber);color:#fff;}
#estimator-module-wrap .sales-field{margin-bottom:10px;}
#estimator-module-wrap .sales-field label{font-size:10.5px;font-weight:700;color:var(--biz-text-muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px;}
#estimator-module-wrap .sales-field input, #estimator-module-wrap .sales-field select, #estimator-module-wrap .sales-field textarea{width:100%;padding:9px 11px;border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);font-size:13px;box-sizing:border-box;font-family:inherit;background:var(--biz-input-bg);color:var(--biz-text);transition:border-color .12s;}
#estimator-module-wrap .sales-field input:focus, #estimator-module-wrap .sales-field select:focus, #estimator-module-wrap .sales-field textarea:focus{outline:none;border-color:var(--biz-amber);background:var(--biz-card-bg);}
#estimator-module-wrap .sales-preview{background:#f4e6ec;border:1px solid #e0c2d0;border-radius:var(--biz-r);padding:12px;margin-bottom:14px;}
#estimator-module-wrap .sales-preview p{font-size:12px;margin:2px 0;color:var(--biz-text-muted);}
#estimator-module-wrap .sales-preview b{color:var(--biz-text);}
#estimator-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
#estimator-module-wrap table.sales-items th{text-align:left;padding:7px 6px;background:var(--biz-input-bg);color:var(--biz-text-muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--biz-border-light);}
#estimator-module-wrap table.sales-items td{padding:7px 6px;border-bottom:1px solid var(--biz-border-light);}
#estimator-module-wrap table.sales-items tr:hover td{background:#FAFBFD;}
#estimator-module-wrap .sales-tile-row{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;}
#estimator-module-wrap .sales-tile{border:0;border-radius:var(--biz-r);padding:14px 10px;text-align:center;font-size:11.5px;font-weight:700;color:#fff;cursor:pointer;box-shadow:var(--biz-shadow);transition:transform .12s,box-shadow .12s;text-transform:uppercase;letter-spacing:.2px;background:linear-gradient(135deg,var(--biz-amber),var(--biz-amber2));}
#estimator-module-wrap .sales-tile:hover{transform:translateY(-2px);box-shadow:0 12px 28px 0 rgba(37,37,42,.14);}
#estimator-module-wrap .sales-tile .sales-tile-icon{font-size:18px;display:block;margin-bottom:6px;}
#estimator-module-wrap .sales-back{font-size:12px;color:var(--biz-amber);font-weight:600;cursor:pointer;margin-bottom:10px;display:inline-block;}
`;
document.head.appendChild(estimatorStyleTag);

// Estimator identities — a small subset of STAFF, distinct from the default
// Sales identity, since Estimator is meant to simulate a different logged-in
// user/role in Q-Pro (no real multi-user auth in this app yet).
const ESTIMATOR_USERS = STAFF.filter(s => s !== 'Operations');
let estimatorCurrentUser = ESTIMATOR_USERS[1] || ESTIMATOR_USERS[0];

// ── Module shell ──
const estimatorModuleWrap = document.createElement('div');
estimatorModuleWrap.id = 'estimator-module-wrap';
estimatorModuleWrap.style.cssText = 'display:none;';
estimatorModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">📐</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Estimator</div>
        <div style="color:rgba(255,255,255,.7);font-size:11px;">Pick → BOM → Selling Price</div>
      </div>
    </div>
    <button onclick="closeEstimatorModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="estimator-userbar">
    Logged in as
    <select id="estimator-user-select" onchange="estimatorSetCurrentUser(this.value)"></select>
  </div>
  <div class="estimator-scroll">
    <div id="estimator-body"></div>
  </div>
`;
document.body.appendChild(estimatorModuleWrap);

let estimatorView = 'dashboard';       // dashboard | hub | index | bom
let estimatorActiveQtnId = null;
let estimatorActiveLineId = null;
let estimatorBomTab = 'materials';     // materials | labour | subcontract | hiring | others | summary
let estimatorDashExpanded = null;      // null | 'pending' | 'my'

function eEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }

function estimatorAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('estimator-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'estimator-toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;padding:10px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

// ── Module open/close ──
function openEstimatorModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  estimatorModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  const sel = document.getElementById('estimator-user-select');
  if (sel) sel.innerHTML = ESTIMATOR_USERS.map(u => `<option value="${u}" ${u === estimatorCurrentUser ? 'selected' : ''}>${u}</option>`).join('');
  estimatorView = 'dashboard';
  renderEstimatorBody();
}
function closeEstimatorModule() {
  estimatorModuleWrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}
function launchEstimatorModule() { openEstimatorModule(); }

function estimatorSetCurrentUser(name) {
  estimatorCurrentUser = name;
  renderEstimatorBody();
}

function renderEstimatorBody() {
  const body = document.getElementById('estimator-body');
  if (!body) return;
  let content = '';
  switch (estimatorView) {
    case 'dashboard': content = renderEstimatorDashboard(); break;
    case 'hub': content = renderEstimatorQuoteHub(); break;
    case 'index': content = renderEstimationIndex(); break;
    case 'bom': content = renderJobEstimationBOM(); break;
    default: content = renderEstimatorDashboard();
  }
  body.innerHTML = content;
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════

function estimatorToggleTile(tile) {
  estimatorDashExpanded = estimatorDashExpanded === tile ? null : tile;
  renderEstimatorBody();
}

function estimatorPick(qtnId) {
  if (!window.confirm('Do you Want to Pick This Quotation?')) return;
  const result = pickQuotation(qtnId, estimatorCurrentUser, 'estimator');
  if (result.error) { estimatorAlert(result.error); return; }
  estimatorAlert(`✓ Picked ${qtnId}.`);
  renderEstimatorBody();
}

function estimatorQtnRowSummary(q) {
  const enq = enquiries.find(e => e.id === q.enquiryId);
  const c = customers.find(x => x.id === q.customerId);
  return { client: c ? c.name : '—', salesman: enq ? enq.salesPerson : '—' };
}

function renderEstimatorDashboard() {
  const k = getEstimatorKPIs(estimatorCurrentUser);

  const kpiTilesHtml = `
    <div class="sales-kpi-grid">
      <div class="sales-kpi-tile" style="cursor:pointer;" onclick="estimatorToggleTile('pending')"><div class="num">${k.pendingToPick}</div><div class="lbl">Pending to Pick</div></div>
      <div class="sales-kpi-tile" style="cursor:pointer;" onclick="estimatorToggleTile('my')"><div class="num">${k.myActions}</div><div class="lbl">My Actions</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.withApprover}</div><div class="lbl">With Approver</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.confirmed}</div><div class="lbl">Confirmed</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.prPending}</div><div class="lbl">PR Pending</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.prNotReceived}</div><div class="lbl">PR Not Received</div></div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Category Breakdown</p>
      <div style="display:flex;gap:16px;font-size:12.5px;color:#334155;">
        <span>Curtain: <b>${k.categoryBreakdown.curtain}</b></span>
        <span>Upholstery: <b>${k.categoryBreakdown.upholstery}</b></span>
        <span>Joinery: <b>${k.categoryBreakdown.joinery}</b></span>
      </div>
    </div>`;

  let expandedHtml = '';
  if (estimatorDashExpanded === 'pending') {
    expandedHtml = `<div class="sales-card"><p style="font-weight:700;font-size:13px;margin-bottom:8px;">Pending to Pick</p>` +
      (k.pendingToPickList.length === 0 ? `<p style="font-size:12px;color:#64748b;">Nothing pending.</p>` :
        k.pendingToPickList.map(q => {
          const s = estimatorQtnRowSummary(q);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;">
            <div><p style="font-weight:700;font-size:12.5px;">${q.id}</p><p style="font-size:11px;color:#64748b;">${eEsc(s.client)} · ${eEsc(q.projectName)} · ${eEsc(s.salesman)}</p></div>
            <button class="primary" style="font-size:11px;padding:6px 10px;" onclick="estimatorPick('${q.id}')">Pick</button>
          </div>`;
        }).join('')) + `</div>`;
  } else if (estimatorDashExpanded === 'my') {
    expandedHtml = `<div class="sales-card"><p style="font-weight:700;font-size:13px;margin-bottom:8px;">My Quotations</p>` +
      (k.myActionsList.length === 0 ? `<p style="font-size:12px;color:#64748b;">Nothing picked yet.</p>` :
        k.myActionsList.map(q => {
          const s = estimatorQtnRowSummary(q);
          return `<div style="padding:8px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="openEstimatorQuoteHub('${q.id}')">
            <p style="font-weight:700;font-size:12.5px;color:var(--biz-primary);">${q.id}</p>
            <p style="font-size:11px;color:#64748b;">${eEsc(s.client)} · ${eEsc(q.projectName)} · ${eEsc(s.salesman)}</p>
          </div>`;
        }).join('')) + `</div>`;
  }

  return kpiTilesHtml + expandedHtml;
}

// ══════════════════════════════════════════
// MANAGE QUOTE HUB (Estimator view) — same hub Sales sees, plus the
// ESTIMATION / Short List for Estimation tiles and Estimator-only actions.
// ══════════════════════════════════════════

function openEstimatorQuoteHub(qtnId) {
  estimatorActiveQtnId = qtnId;
  estimatorView = 'hub';
  renderEstimatorBody();
}

function renderEstimatorQuoteHub() {
  const q = quotations.find(x => x.id === estimatorActiveQtnId);
  if (!q) return `<p style="font-size:12.5px;color:#64748b;">Quotation not found.</p>`;
  const totals = computeQuotationTotals(q);
  const enq = enquiries.find(e => e.id === q.enquiryId);
  const c = customers.find(x => x.id === q.customerId);

  return `
    <span class="sales-back" onclick="estimatorView='dashboard';renderEstimatorBody();">‹ Back to Dashboard</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:15px;">${q.id} <span class="sales-pill ${q.lifecycleStatus}">${q.lifecycleStatus}</span> <span class="sales-pill stage-${q.stage}">${q.stage.toUpperCase()}</span></p>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">Client: ${eEsc(c ? c.name : '—')} · Project: ${eEsc(q.projectName)}</p>
      <p style="font-size:12px;color:#64748b;">Qtn Date: ${q.date} · Confirm Date: ${q.confirmDate || '—'} · Amount: BD ${totals.netTotal.toFixed(3)}</p>
      <p style="font-size:11px;color:#94a3b8;margin-top:4px;">${q.parentJobId ? `Variation for Job <b>${eEsc(q.parentJobId)}</b>` : `Linked Enquiry: ${eEsc(q.enquiryId)} · Salesman: ${eEsc(enq ? enq.salesPerson : '—')}`} · Picked by: ${eEsc(q.estimatorPickedBy) || '—'}</p>
    </div>
    ${q.headerComment ? `<div class="sales-preview"><p style="font-weight:700;color:#1a1f2e;margin-bottom:4px;">Approver Comments</p><p>${eEsc(q.headerComment)}</p></div>` : ''}
    <div class="sales-tile-row">
      ${q.lifecycleStatus !== 'draft' ? `<div class="sales-tile" onclick="estimatorAlert('Print Quote — not wired to a document generator yet.')"><span class="sales-tile-icon">🖨</span>Print Quote</div>` : ''}
      <div class="sales-tile" onclick="estimatorAlert('Duplicate — not implemented yet.')"><span class="sales-tile-icon">⧉</span>Duplicate</div>
      <div class="sales-tile" onclick="openEstimationIndex('${q.id}')"><span class="sales-tile-icon">📐</span>ESTIMATION</div>
      <div class="sales-tile" onclick="estimatorAlert('Short List for Estimation — consolidated print view not implemented yet; use the Estimation index below.')"><span class="sales-tile-icon">📋</span>Short List</div>
    </div>
    <div class="sales-kpi-tile" style="text-align:left;margin-bottom:10px;">
      <div class="lbl" style="margin-bottom:6px;">Action</div>
      <select onchange="if(this.value){estimatorTransferStage('${q.id}',this.value);this.value='';}" style="width:100%;padding:9px 10px;border:1px solid var(--biz-border);border-radius:8px;font-size:13px;font-weight:600;font-family:inherit;color:var(--biz-text);background:var(--biz-card-bg);">
        <option value="">Select…</option>
        <option value="sales">‹ Back to Sales</option>
        <option value="approver">Transfer to Approver →</option>
      </select>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Items (${q.items.length})</p>
      ${q.items.length === 0 ? `<p style="font-size:12px;color:#64748b;">No line items yet.</p>` :
        `<table class="sales-items"><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Net</th></tr>` +
        q.items.map(it => `<tr><td>${eEsc(it.product)}</td><td>${it.qty}</td><td>${eEsc(it.unit)}</td><td>${it.rate.toFixed(3)}</td><td>${it.netAmount.toFixed(3)}</td></tr>`).join('') + `</table>`}
    </div>
    ${renderQuotationAuditTable(q)}`;
}

// Matches the live confirmation copy exactly ("Do you Want to Change Status?").
function estimatorTransferStage(qtnId, stage) {
  if (!window.confirm('Do you Want to Change Status?')) return;
  transferQuotationStage(qtnId, stage, estimatorCurrentUser);
  estimatorAlert(`✓ Transferred to ${stage === 'approver' ? 'Approver' : 'Sales'}.`);
  estimatorView = 'dashboard';
  renderEstimatorBody();
}

// ══════════════════════════════════════════
// ESTIMATION INDEX — per-quote list of line items → Add/Update/Clear BOM
// ══════════════════════════════════════════

function openEstimationIndex(qtnId) {
  estimatorActiveQtnId = qtnId;
  estimatorView = 'index';
  renderEstimatorBody();
}

function renderEstimationIndex() {
  const q = quotations.find(x => x.id === estimatorActiveQtnId);
  if (!q) return `<p style="font-size:12.5px;color:#64748b;">Quotation not found.</p>`;

  const rows = q.items.map((it, i) => {
    const hasBom = !!(it.bom && it.bom.submitted);
    // "Copy BOM" — qty changed since Sales last sent this back after a BOM was
    // already submitted, so the Estimator should revisit material quantities.
    const qtyDrifted = hasBom && it.bom.qtyAtSubmit !== it.qty;
    const commentsHtml = (it.internalComments || it.approverComment) ? `
      <div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">
        ${it.internalComments ? `<span title="${eEsc(it.internalComments)}" style="cursor:help;">💬 Sales comment</span>` : ''}
        ${it.approverComment ? ` <span title="${eEsc(it.approverComment)}" style="cursor:help;">👁 Approver comment</span>` : ''}
      </div>` : '';
    const deptEditing = estimatorEditingDeptLineId === it.lineId;
    const deptCell = deptEditing ? `
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${DEPTS.map(d => `<label style="font-size:10.5px;display:flex;align-items:center;gap:4px;"><input type="checkbox" ${(it.departmentSequence || []).includes(d.k) ? 'checked' : ''} onchange="estimatorToggleDept('${q.id}',${it.lineId},'${d.k}',this.checked)"> ${d.n}</label>`).join('')}
        <span style="font-size:10px;color:var(--biz-primary);cursor:pointer;" onclick="estimatorEditingDeptLineId=null;renderEstimatorBody();">Done</span>
      </div>` :
      `<div style="cursor:pointer;" onclick="estimatorEditingDeptLineId=${it.lineId};renderEstimatorBody();">
        ${(it.departmentSequence || []).length === 0 ? '<span style="color:#94a3b8;font-size:11px;">— tap to set —</span>' :
          (it.departmentSequence || []).map(k => `<span style="display:inline-block;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:20px;margin:1px;background:${dc(k).c}22;color:${dc(k).c};">${eEsc(dc(k).n)}</span>`).join(' → ')}
      </div>`;
    return `
      <tr style="${hasBom ? 'background:#dcfce7;' : ''}">
        <td>${i + 1}</td>
        <td>${eEsc(it.product)}${commentsHtml}</td>
        <td>${it.qty} ${eEsc(it.unit)}</td>
        <td>${it.rate.toFixed(3)}</td>
        <td>${hasBom ? '✓' : ''}</td>
        <td>${deptCell}</td>
        <td>
          ${it.bom ? `<button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="openJobEstimationBOM('${q.id}',${it.lineId})">${qtyDrifted ? 'Copy BOM' : 'Update BOM'}</button>
          <button class="secondary" style="font-size:10.5px;padding:5px 8px;color:#b91c1c;" onclick="estimatorClearBOMConfirm('${q.id}',${it.lineId})">Clear BOM</button>`
          : `<button class="primary" style="font-size:10.5px;padding:5px 8px;" onclick="openJobEstimationBOM('${q.id}',${it.lineId})">+ Add BOM</button>`}
        </td>
      </tr>`;
  }).join('');

  return `
    <span class="sales-back" onclick="openEstimatorQuoteHub('${q.id}');">‹ Back to Manage Quote</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;">${q.id} — Estimation</p>
      <p style="font-size:11.5px;color:#64748b;">${eEsc(q.projectName)}</p>
    </div>
    <div class="sales-card">
      <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Department routing is auto-suggested per line (tap a job's Departments cell to review/override) — the Operations Manager confirms it for real once the job is created, this is just getting it right early.</p>
      <table class="sales-items"><tr><th>SL</th><th>Product</th><th>Qty</th><th>Rate</th><th>BOM</th><th>Departments</th><th>Actions</th></tr>${rows}</table>
    </div>`;
}

// Job Routing (Batch 8, Phase 0) — Estimator's override of the
// auto-suggested department sequence. DEPTS' own array order (carp, paint,
// uph, curt, metal) doubles as the canonical stop order — matches the
// real physical sequence closely enough (joinery before paint) without
// needing a separate drag-to-reorder UI.
let estimatorEditingDeptLineId = null;
function estimatorToggleDept(qtnId, lineId, deptKey, checked) {
  const item = findQuotationItem(qtnId, lineId);
  if (!item) return;
  const current = new Set(item.departmentSequence || []);
  if (checked) current.add(deptKey); else current.delete(deptKey);
  const ordered = DEPTS.map(d => d.k).filter(k => current.has(k));
  setItemDepartmentSequence(qtnId, lineId, ordered);
  renderEstimatorBody();
}

function estimatorClearBOMConfirm(qtnId, lineId) {
  if (!window.confirm('Clear this BOM? Pricing on this item will reset to 0.')) return;
  clearItemBOM(qtnId, lineId);
  estimatorAlert('✓ BOM cleared.');
  renderEstimatorBody();
}

// ══════════════════════════════════════════
// JOB ESTIMATION — BOM entry, 6 tabs
// ══════════════════════════════════════════

function openJobEstimationBOM(qtnId, lineId) {
  estimatorActiveQtnId = qtnId;
  estimatorActiveLineId = lineId;
  estimatorBomTab = 'materials';
  estimatorView = 'bom';
  const item = findQuotationItem(qtnId, lineId);
  if (item) ensureItemBOM(item);
  renderEstimatorBody();
}
function estimatorSetBomTab(t) { estimatorBomTab = t; renderEstimatorBody(); }

function renderJobEstimationBOM() {
  const q = quotations.find(x => x.id === estimatorActiveQtnId);
  const item = q && q.items.find(it => it.lineId === estimatorActiveLineId);
  if (!q || !item) return `<p style="font-size:12.5px;color:#64748b;">Item not found.</p>`;
  const enq = enquiries.find(e => e.id === q.enquiryId);
  const c = customers.find(x => x.id === q.customerId);

  const header = `
    <div class="sales-preview">
      <p><b>BOQ Ref:</b> ${eEsc(q.id)}-${item.lineId}</p>
      <p><b>Customer Name:</b> ${eEsc(c ? c.name : '—')}</p>
      <p><b>Project Name:</b> ${eEsc(q.projectName)}</p>
      <p><b>Item:</b> ${eEsc(item.product)} · <b>Qty/Unit:</b> ${item.qty} ${eEsc(item.unit)}</p>
      <p><b>Quote Date:</b> ${q.date} · <b>Date of Request:</b> ${eEsc(enq ? enq.dateCreated : '—')} · <b>Qtn No:</b> ${eEsc(q.id)}</p>
      ${item.internalComments ? `<p><b>Internal Comments (Sales):</b> ${eEsc(item.internalComments)}</p>` : ''}
      ${q.headerComment ? `<p><b>Approver Comments (header):</b> ${eEsc(q.headerComment)}</p>` : ''}
      ${item.approverComment ? `<p><b>Comments (line-item):</b> ${eEsc(item.approverComment)}</p>` : ''}
    </div>`;

  const tabs = ['materials', 'labour', 'subcontract', 'hiring', 'others', 'summary'];
  const tabLabels = { materials: 'Materials', labour: 'Labour Cost', subcontract: 'Sub Contract', hiring: 'Hiring', others: 'Others', summary: 'Summary' };
  const tabsHtml = `<div class="sales-tabs">${tabs.map(t => `<button class="sales-tabbtn ${estimatorBomTab === t ? 'active' : ''}" onclick="estimatorSetBomTab('${t}')">${tabLabels[t]}</button>`).join('')}</div>`;

  let tabBody = '';
  if (estimatorBomTab === 'materials') tabBody = renderBomMaterialsTab(item);
  else if (estimatorBomTab === 'labour') tabBody = renderBomLabourTab(item);
  else if (estimatorBomTab === 'subcontract') tabBody = renderBomGenericTab(item, 'subcontract');
  else if (estimatorBomTab === 'hiring') tabBody = renderBomGenericTab(item, 'hiring');
  else if (estimatorBomTab === 'others') tabBody = renderBomOthersTab(item);
  else tabBody = renderBomSummaryTab(item);

  return `<span class="sales-back" onclick="openEstimationIndex('${q.id}');">‹ Back to Estimation</span>${header}${tabsHtml}<div class="sales-card">${tabBody}</div>`;
}

// Item Name is a real search-and-select against the Item Master, not a
// datalist suggestion — Salman's explicit call: an estimator typing a
// free-text name that doesn't match a real inventory item was silently
// accepted before, which meant the BOM line never linked to real stock
// (no itemId, invisible to Job Material Requirement's demand tracking).
// Forcing a real selection guarantees addBOMMaterial()'s itemId match
// always succeeds, not just when the typed text happens to line up.
let estimatorMatSearch = '';
let estimatorMatSelectedId = null;

function renderBomMaterialsTab(item) {
  const bom = item.bom;
  const rows = bom.materials.map(m => `
    <tr><td>${eEsc(m.name)}</td><td>${m.qty}</td><td>${eEsc(m.unit)}</td><td>${m.rate.toFixed(3)}</td><td>${m.amount.toFixed(3)}</td>
    <td><span style="cursor:pointer;color:#b91c1c;" onclick="estimatorRemoveEntry('materials',${m.id})">✕</span></td></tr>`).join('');
  const total = bom.materials.reduce((s, m) => s + m.amount, 0);

  const selected = estimatorMatSelectedId ? ITEM_MASTER.find(it => it.id === estimatorMatSelectedId) : null;
  const q = estimatorMatSearch.trim().toLowerCase();
  const matches = (!selected && q) ? ITEM_MASTER.filter(it => it.name.toLowerCase().includes(q)).slice(0, 8) : [];

  return `
    <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Add Material</p>
    <div class="sales-field"><label>Item Name</label>
      ${selected
        ? `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid var(--biz-border);border-radius:8px;background:var(--biz-input-bg);">
            <span style="flex:1;font-size:13px;">${eEsc(selected.name)}</span>
            <span style="cursor:pointer;color:var(--biz-primary);font-size:11.5px;font-weight:600;" onclick="estimatorClearMaterialSelection()">Change</span>
          </div>`
        : `<input type="text" id="mat-search" placeholder="Search inventory item…" value="${eEsc(estimatorMatSearch)}" oninput="estimatorMatSearch=this.value;renderEstimatorBody();" autocomplete="off">`}
    </div>
    ${!selected && q
      ? (matches.length === 0
          ? `<p style="font-size:11px;color:#94a3b8;margin:-6px 0 8px;">No matching inventory item — add it in Storekeeper → Item Master first.</p>`
          : `<div style="border:1px solid var(--biz-border);border-radius:8px;margin:-6px 0 10px;max-height:160px;overflow-y:auto;">
              ${matches.map(it => `<div style="padding:8px 11px;font-size:12.5px;cursor:pointer;border-bottom:1px solid var(--biz-border-light);" onclick="estimatorSelectMaterialItem('${it.id}')">${eEsc(it.name)} <span style="color:#94a3b8;font-size:10.5px;">· BD ${it.cost.toFixed(3)}/${eEsc(it.unit)}</span></div>`).join('')}
            </div>`)
      : (!selected ? `<p style="font-size:10.5px;color:#94a3b8;margin:-6px 0 8px;">Search and select a real inventory item — free text isn't accepted.</p>` : '')}
    <div class="sales-field"><label>Description</label><input type="text" id="mat-desc"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div class="sales-field"><label>Qty</label><input type="number" id="mat-qty" value="1"></div>
      <div class="sales-field"><label>Unit</label><input type="text" id="mat-unit" value="${selected ? eEsc(selected.unit) : 'Nos'}" ${selected ? 'readonly' : ''}></div>
    </div>
    <div class="sales-field"><label>Rate</label><input type="number" step="0.001" id="mat-rate" value="${selected ? selected.cost : 0}"></div>
    <button class="primary" style="width:100%;" onclick="estimatorAddMaterial()" ${!selected ? 'disabled title="Select an inventory item first"' : ''}>ADD</button>
    <table class="sales-items" style="margin-top:12px;"><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th><th></th></tr>${rows}</table>
    <p style="font-weight:700;font-size:12.5px;">Total: BD ${total.toFixed(3)}</p>`;
}

function estimatorSelectMaterialItem(itemId) {
  estimatorMatSelectedId = itemId;
  estimatorMatSearch = '';
  renderEstimatorBody();
}
function estimatorClearMaterialSelection() {
  estimatorMatSelectedId = null;
  estimatorMatSearch = '';
  renderEstimatorBody();
}

function estimatorAddMaterial() {
  const selected = estimatorMatSelectedId ? ITEM_MASTER.find(it => it.id === estimatorMatSelectedId) : null;
  if (!selected) { estimatorAlert('Please select an item from the inventory search.'); return; }
  addBOMMaterial(estimatorActiveQtnId, estimatorActiveLineId, {
    name: selected.name, description: document.getElementById('mat-desc').value,
    qty: Number(document.getElementById('mat-qty').value),
    unit: document.getElementById('mat-unit').value,
    rate: Number(document.getElementById('mat-rate').value)
  });
  estimatorMatSelectedId = null;
  estimatorMatSearch = '';
  renderEstimatorBody();
}

function renderBomLabourTab(item) {
  const bom = item.bom;
  const rows = bom.labour.map(l => `
    <tr><td>${dc(l.department).n}</td><td>${eEsc(l.empCategory)}</td><td>${l.noOfPpl}</td><td>${l.hrs}</td><td>${l.manHrs}</td><td>${l.rate.toFixed(3)}</td><td>${l.amount.toFixed(3)}</td>
    <td><span style="cursor:pointer;color:#b91c1c;" onclick="estimatorRemoveEntry('labour',${l.id})">✕</span></td></tr>`).join('');
  const total = bom.labour.reduce((s, l) => s + l.amount, 0);

  return `
    <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Add Labour Cost</p>
    <div class="sales-field"><label>Select Department</label><select id="lab-dept">${typeof purchDeptOptionsHtml === 'function' ? purchDeptOptionsHtml('carp') : DEPTS.map(d => `<option value="${d.k}">${d.n}</option>`).join('')}</select></div>
    <div class="sales-field"><label>Select Emp Category</label><select id="lab-cat">${EMP_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div class="sales-field"><label>No of PPL</label><input type="number" id="lab-ppl" value="1"></div>
      <div class="sales-field"><label>Hrs</label><input type="number" id="lab-hrs" value="1"></div>
    </div>
    <div class="sales-field"><label>Rate</label><input type="number" step="0.001" id="lab-rate" value="0"></div>
    <button class="primary" style="width:100%;" onclick="estimatorAddLabour()">ADD</button>
    <table class="sales-items" style="margin-top:12px;"><tr><th>Dept</th><th>Category</th><th>PPL</th><th>Hrs</th><th>Man Hrs</th><th>Rate</th><th>Amount</th><th></th></tr>${rows}</table>
    <p style="font-weight:700;font-size:12.5px;">Total: BD ${total.toFixed(3)}</p>`;
}

function estimatorAddLabour() {
  addBOMLabour(estimatorActiveQtnId, estimatorActiveLineId, {
    department: document.getElementById('lab-dept').value,
    empCategory: document.getElementById('lab-cat').value,
    noOfPpl: Number(document.getElementById('lab-ppl').value),
    hrs: Number(document.getElementById('lab-hrs').value),
    rate: Number(document.getElementById('lab-rate').value)
  });
  renderEstimatorBody();
}

// Sub Contract and Hiring share an identical schema (Vendor, Work Type, Amount) per spec.
function renderBomGenericTab(item, category) {
  const bom = item.bom;
  const rows = bom[category].map(r => `
    <tr><td>${eEsc(r.vendor)}</td><td>${eEsc(r.workType)}</td><td>${r.amount.toFixed(3)}</td>
    <td><span style="cursor:pointer;color:#b91c1c;" onclick="estimatorRemoveEntry('${category}',${r.id})">✕</span></td></tr>`).join('');
  const total = bom[category].reduce((s, r) => s + r.amount, 0);
  return `
    <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Add ${category === 'hiring' ? 'Hiring' : 'Sub Contract'}</p>
    <div class="sales-field"><label>Vendor</label><input type="text" id="gen-${category}-vendor"></div>
    <div class="sales-field"><label>Work Type</label><input type="text" id="gen-${category}-worktype"></div>
    <div class="sales-field"><label>Amount</label><input type="number" step="0.001" id="gen-${category}-amount" value="0"></div>
    <button class="primary" style="width:100%;" onclick="estimatorAddGeneric('${category}')">ADD</button>
    <table class="sales-items" style="margin-top:12px;"><tr><th>Vendor</th><th>Work Type</th><th>Amount</th><th></th></tr>${rows}</table>
    <p style="font-weight:700;font-size:12.5px;">Total: BD ${total.toFixed(3)}</p>`;
}
function estimatorAddGeneric(category) {
  const vendor = document.getElementById(`gen-${category}-vendor`).value;
  const workType = document.getElementById(`gen-${category}-worktype`).value;
  const amount = Number(document.getElementById(`gen-${category}-amount`).value);
  if (category === 'hiring') addBOMHiring(estimatorActiveQtnId, estimatorActiveLineId, { vendor, workType, amount });
  else addBOMSubcontract(estimatorActiveQtnId, estimatorActiveLineId, { vendor, workType, amount });
  renderEstimatorBody();
}

function renderBomOthersTab(item) {
  const bom = item.bom;
  const rows = bom.others.map(r => `
    <tr><td>${eEsc(r.party)}</td><td>${eEsc(r.details)}</td><td>${r.amount.toFixed(3)}</td>
    <td><span style="cursor:pointer;color:#b91c1c;" onclick="estimatorRemoveEntry('others',${r.id})">✕</span></td></tr>`).join('');
  const total = bom.others.reduce((s, r) => s + r.amount, 0);
  return `
    <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Add Other Cost</p>
    <div class="sales-field"><label>Party</label><input type="text" id="oth-party"></div>
    <div class="sales-field"><label>Details</label><input type="text" id="oth-details"></div>
    <div class="sales-field"><label>Amount</label><input type="number" step="0.001" id="oth-amount" value="0"></div>
    <button class="primary" style="width:100%;" onclick="estimatorAddOther()">ADD</button>
    <table class="sales-items" style="margin-top:12px;"><tr><th>Party</th><th>Details</th><th>Amount</th><th></th></tr>${rows}</table>
    <p style="font-weight:700;font-size:12.5px;">Total: BD ${total.toFixed(3)}</p>`;
}
function estimatorAddOther() {
  addBOMOther(estimatorActiveQtnId, estimatorActiveLineId, {
    party: document.getElementById('oth-party').value,
    details: document.getElementById('oth-details').value,
    amount: Number(document.getElementById('oth-amount').value)
  });
  renderEstimatorBody();
}

function estimatorRemoveEntry(category, entryId) {
  removeBOMEntry(estimatorActiveQtnId, estimatorActiveLineId, category, entryId);
  renderEstimatorBody();
}

function renderBomSummaryTab(item) {
  const bom = item.bom;
  const t = computeBOMTotals(bom);
  const sellingPrice = bom.sellingPriceOverride !== null ? bom.sellingPriceOverride : t.calculatedSellingPrice;
  return `
    <p style="font-weight:700;font-size:13px;margin-bottom:10px;">Cost-plus Summary</p>
    <table class="sales-items">
      <tr><td>Material Cost</td><td>${t.materialCost.toFixed(3)}</td></tr>
      <tr><td>Labour Cost</td><td>${t.labourCost.toFixed(3)}</td></tr>
      <tr><td>Sub Contract Cost</td><td>${t.subcontractCost.toFixed(3)}</td></tr>
      <tr><td>Hiring Cost</td><td>${t.hiringCost.toFixed(3)}</td></tr>
      <tr><td>Others Cost</td><td>${t.othersCost.toFixed(3)}</td></tr>
      <tr><td style="font-weight:700;">Total Cost</td><td style="font-weight:700;">${t.totalCost.toFixed(3)}</td></tr>
    </table>
    <div class="sales-field"><label>Material OH %</label><input type="number" step="0.1" value="${bom.ohPercents.material}" onchange="estimatorSetOH('material',Number(this.value))"></div>
    <div class="sales-field"><label>Labour Cost OH %</label><input type="number" step="0.1" value="${bom.ohPercents.labour}" onchange="estimatorSetOH('labour',Number(this.value))"></div>
    <div class="sales-field"><label>Subcontract OH %</label><input type="number" step="0.1" value="${bom.ohPercents.subcontract}" onchange="estimatorSetOH('subcontract',Number(this.value))"></div>
    <div class="sales-field"><label>Hiring OH %</label><input type="number" step="0.1" value="${bom.ohPercents.hiring}" onchange="estimatorSetOH('hiring',Number(this.value))"></div>
    <div class="sales-field"><label>Others OH %</label><input type="number" step="0.1" value="${bom.ohPercents.others}" onchange="estimatorSetOH('others',Number(this.value))"></div>
    <p style="font-weight:700;font-size:12.5px;margin-top:6px;">Total Cost Including Overhead: BD ${t.totalCostInclOH.toFixed(3)}</p>
    <div class="sales-field"><label>Profit %</label><input type="number" step="0.1" value="${bom.profitPercent}" onchange="estimatorSetProfit(Number(this.value))"></div>
    <p style="font-weight:700;font-size:12.5px;">Profit: BD ${t.profitAmount.toFixed(3)}</p>
    <p style="font-weight:700;font-size:13px;">Calculated Selling Price: BD ${t.calculatedSellingPrice.toFixed(3)}</p>
    <div class="sales-field"><label>Enter Selling Price (override)</label><input type="number" step="0.001" value="${sellingPrice.toFixed(3)}" onchange="estimatorSetOverride(this.value)"></div>
    <button class="primary" style="width:100%;margin-top:8px;" onclick="estimatorSubmitBOM()">Submit</button>`;
}

function estimatorSetOH(category, val) { setBOMOHPercent(estimatorActiveQtnId, estimatorActiveLineId, category, val); renderEstimatorBody(); }
function estimatorSetProfit(val) { setBOMProfitPercent(estimatorActiveQtnId, estimatorActiveLineId, val); renderEstimatorBody(); }
function estimatorSetOverride(val) { setBOMSellingOverride(estimatorActiveQtnId, estimatorActiveLineId, val); renderEstimatorBody(); }

function estimatorSubmitBOM() {
  const result = submitItemBOM(estimatorActiveQtnId, estimatorActiveLineId);
  if (result.error) { estimatorAlert(result.error); return; }
  estimatorAlert(`✓ BOM saved — Selling Price BD ${result.item.rate.toFixed(3)}, Quote Amount BD ${result.item.netAmount.toFixed(3)}.`);
  openEstimationIndex(estimatorActiveQtnId);
}
