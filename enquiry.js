// ══════════════════════════════════════════
// ENQUIRY MODULE (Sales)
// Built session: 24 Jul 2026
// First piece of the Enquiry -> Quotation -> Estimation -> Approval
// pipeline (replacing Q-Pro's Sales module) — screens replicated from
// live Q-Pro screenshots. Quote/Estimation/Approval are separate future
// sessions built on top of the customers[]/enquiries[] foundation here.
//
// Reads/writes: customers[], enquiries[] (data.js). Reuses no
// purchasing.js helpers — Enquiry has no job/department at this stage
// (Q-Pro's own Enquiry screen has neither; the Curtain/Upholstery/Joinery
// dashboard split there comes from the Quotation's product lines, not the
// enquiry). Must load AFTER storekeeper.js in index.html per the fixed
// script order.
//
// Own separate ecosystem module, same pattern as storekeeper.js — creates
// its own #enq-module-wrap dynamically. Hub node reused: index.html
// already had an un-built "sales" node/line, wired here to launch this
// module instead of a new node being added.
// ══════════════════════════════════════════

const enqStyleTag = document.createElement('style');
enqStyleTag.textContent = `
#enq-module-wrap { font-family: inherit; }
#enq-module-wrap .ops-header{background:#4338ca;padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#enq-module-wrap .enq-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#enq-module-wrap .enq-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
#enq-module-wrap .enq-kpi-tile{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center;}
#enq-module-wrap .enq-kpi-tile .num{font-size:20px;font-weight:800;color:#4338ca;}
#enq-module-wrap .enq-kpi-tile .lbl{font-size:10.5px;color:#64748b;margin-top:2px;}
#enq-module-wrap .enq-kpi-tile.alert .num{color:#b91c1c;}
#enq-module-wrap .enq-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;}
#enq-module-wrap .enq-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:20px;background:#f1f5f9;color:#64748b;}
#enq-module-wrap .enq-pill.unallocated{background:#fef9c3;color:#854d0e;}
#enq-module-wrap .enq-pill.in-progress{background:#dbeafe;color:#1e40af;}
#enq-module-wrap .enq-pill.quoted{background:#dcfce7;color:#166534;}
#enq-module-wrap .enq-pill.lost{background:#fee2e2;color:#991b1b;}
#enq-module-wrap .enq-pill.pending{background:#fef9c3;color:#854d0e;}
#enq-module-wrap .enq-search{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box;}
#enq-module-wrap button.primary{background:#4338ca;color:#fff;border:0;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
#enq-module-wrap button.secondary{background:none;border:1px solid #e2e8f0;border-radius:8px;color:#475569;font-size:13px;cursor:pointer;font-family:inherit;padding:9px 18px;}
#enq-module-wrap button.danger{background:#dc2626;color:#fff;border:0;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
#enq-module-wrap .enq-tabs{display:flex;gap:6px;margin-bottom:12px;}
#enq-module-wrap .enq-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer;font-family:inherit;}
#enq-module-wrap .enq-tabbtn.active{background:#4338ca;border-color:#4338ca;color:#fff;}
#enq-module-wrap .enq-panel{display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:200;background:rgba(15,23,42,.55);flex-direction:column;align-items:center;justify-content:flex-start;overflow-y:auto;padding:20px 12px;}
#enq-module-wrap .enq-panel-inner{background:#fff;border-radius:14px;padding:18px;width:100%;max-width:480px;margin-top:20px;box-sizing:border-box;}
#enq-module-wrap .enq-field{margin-bottom:10px;}
#enq-module-wrap .enq-field label{font-size:11px;color:#64748b;display:block;margin-bottom:3px;}
#enq-module-wrap .enq-field input, #enq-module-wrap .enq-field select, #enq-module-wrap .enq-field textarea{width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit;}
#enq-module-wrap .enq-field textarea{min-height:70px;resize:vertical;}
#enq-module-wrap .enq-customer-match{padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;cursor:pointer;font-size:12.5px;}
#enq-module-wrap .enq-customer-match:hover{background:#f8fafc;}
#enq-module-wrap .enq-summary-row{display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-bottom:1px solid #f1f5f9;}
#enq-module-wrap .enq-summary-row .k{color:#64748b;}
#enq-module-wrap table.enq-fu-table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:10px;}
#enq-module-wrap table.enq-fu-table th{text-align:left;color:#64748b;font-weight:600;padding:6px 4px;border-bottom:1px solid #e2e8f0;}
#enq-module-wrap table.enq-fu-table td{padding:6px 4px;border-bottom:1px solid #f1f5f9;}
`;
document.head.appendChild(enqStyleTag);

// ── Module shell — created dynamically, same pattern as storekeeper.js ──
const enqModuleWrap = document.createElement('div');
enqModuleWrap.id = 'enq-module-wrap';
enqModuleWrap.style.cssText = 'display:none;';
enqModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">💼</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Enquiry</div>
        <div style="color:#e0e7ff;font-size:11px;">Sales · Enquiry → Quotation pipeline</div>
      </div>
    </div>
    <button onclick="closeEnquiryModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="enq-scroll">
    <div id="enq-dashboard-body"></div>
  </div>
  <div class="enq-panel" id="enq-new-panel"><div class="enq-panel-inner" id="enq-new-panel-inner"></div></div>
  <div class="enq-panel" id="enq-customer-panel"><div class="enq-panel-inner" id="enq-customer-panel-inner"></div></div>
  <div class="enq-panel" id="enq-reject-panel"><div class="enq-panel-inner" id="enq-reject-panel-inner"></div></div>
  <div class="enq-panel" id="enq-detail-panel"><div class="enq-panel-inner" id="enq-detail-panel-inner" style="max-width:560px;"></div></div>
`;
document.body.appendChild(enqModuleWrap);

let enqView          = 'list';   // 'list' | 'approvals'
let enqSearch        = '';
let enqNewDraft       = null;    // { customerId, customerSearch, contactPersonId, tel, email, requirements, sourceOfEnquiry, salesPersonAssigned }
let enqCustomerDraft  = null;    // { name, tel, tel2, email, address, vatName, vatNo, crNo, country }
let enqRejectDraft    = null;    // { customerId, comment, duplicateOfCustomerId }
let enqDetailId       = null;
let enqDetailTab      = 'basic'; // 'basic' | 'followup'
let enqFollowUpDraft  = null;    // { dateOfAppointment, meetingType, outcome, notes }

// ── Alert toast (mirrors skAlert's fallback pattern) ──
function enqAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('enq-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'enq-toast';
    toast.style.cssText = `
      position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
      background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;
      padding:10px 18px;border-radius:20px;z-index:9999;
      box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;
      transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

// ── Module open / close ─────────────────────
function openEnquiryModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  enqModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:#f7f9fc;';
  renderEnquiryDashboard();
}

function closeEnquiryModule() {
  enqModuleWrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}

function launchEnquiryModule() {
  openEnquiryModule();
}

// ── Dashboard ────────────────────────────────
function enqSetView(v) { enqView = v; renderEnquiryDashboard(); }
function enqSetSearch(v) { enqSearch = v; renderEnquiryDashboard(); }

function enqCustomerName(customerId) {
  const c = customers.find(c => c.id === customerId);
  return c ? c.name : '(unknown customer)';
}

function enqMatchesEnquiry(enq) {
  if (!enqSearch.trim()) return true;
  const q = enqSearch.trim().toLowerCase();
  return enq.id.toLowerCase().includes(q) || enqCustomerName(enq.customerId).toLowerCase().includes(q);
}

function renderEnquiryDashboard() {
  const body = document.getElementById('enq-dashboard-body');
  if (!body) return;
  const kpis = getEnquiryKPIs();

  const kpiHtml = `
    <div class="enq-kpi-grid">
      <div class="enq-kpi-tile"><div class="num">${kpis.unallocatedCount}</div><div class="lbl">Unallocated</div></div>
      <div class="enq-kpi-tile"><div class="num">${kpis.inProgressCount}</div><div class="lbl">In Progress</div></div>
      <div class="enq-kpi-tile"><div class="num">${kpis.quotedCount}</div><div class="lbl">Quoted</div></div>
      <div class="enq-kpi-tile"><div class="num">${kpis.lostCount}</div><div class="lbl">Lost</div></div>
      <div class="enq-kpi-tile ${kpis.pendingCustomerApprovals > 0 ? 'alert' : ''}"><div class="num">${kpis.pendingCustomerApprovals}</div><div class="lbl">Customers Pending Verification</div></div>
    </div>`;

  const tabsHtml = `
    <div class="enq-tabs">
      <button class="enq-tabbtn ${enqView === 'list' ? 'active' : ''}" onclick="enqSetView('list')">Enquiries</button>
      <button class="enq-tabbtn ${enqView === 'approvals' ? 'active' : ''}" onclick="enqSetView('approvals')">Customer Approvals${kpis.pendingCustomerApprovals > 0 ? ' (' + kpis.pendingCustomerApprovals + ')' : ''}</button>
    </div>`;

  let listHtml = '';
  if (enqView === 'list') {
    listHtml += `<input class="enq-search" type="text" placeholder="Search enquiry # or customer..." value="${enqSearch}" oninput="enqSetSearch(this.value)">`;
    listHtml += `<button class="primary" style="margin-bottom:12px;width:100%;" onclick="openNewEnquiryPanel()">+ New Enquiry</button>`;
    const items = enquiries.filter(enqMatchesEnquiry).slice().reverse();
    listHtml += items.length === 0
      ? `<div class="enq-card" style="cursor:default;"><p style="font-size:12.5px;color:#64748b;">No enquiries yet${enqSearch ? ' matching your search' : ''}.</p></div>`
      : items.map(e => `
        <div class="enq-card" onclick="openEnquiryDetail('${e.id}')">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <p style="font-weight:700;font-size:13px;">${enqCustomerName(e.customerId)}</p>
              <p style="font-size:11px;color:#64748b;">${e.id} · ${e.dateCreated}${e.salesPersonAssigned ? ' · ' + e.salesPersonAssigned : ''}</p>
              <p style="font-size:11.5px;color:#475569;margin-top:4px;">${(e.requirements || '').slice(0, 90)}${(e.requirements || '').length > 90 ? '…' : ''}</p>
            </div>
            <span class="enq-pill ${e.status}">${e.status.replace('-', ' ')}</span>
          </div>
        </div>`).join('');
  } else {
    const pending = getPendingCustomerApprovals();
    listHtml += pending.length === 0
      ? `<div class="enq-card" style="cursor:default;"><p style="font-size:12.5px;color:#64748b;">No customers awaiting verification.</p></div>`
      : pending.map(c => `
        <div class="enq-card" style="cursor:default;">
          <p style="font-weight:700;font-size:13px;">${c.name} <span class="enq-pill pending">pending</span></p>
          <p style="font-size:11.5px;color:#64748b;margin-top:2px;">${c.tel}${c.email ? ' · ' + c.email : ''}</p>
          <p style="font-size:11.5px;color:#64748b;">${c.address || ''}</p>
          <p style="font-size:10.5px;color:#94a3b8;margin-top:4px;">Created by ${c.createdBy || '—'} on ${c.dateCreated}</p>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="primary" style="flex:1;font-size:12px;" onclick="event.stopPropagation();enqApproveCustomer('${c.id}')">Approve</button>
            <button class="danger" style="flex:1;font-size:12px;" onclick="event.stopPropagation();openRejectCustomerPanel('${c.id}')">Reject / Duplicate</button>
          </div>
        </div>`).join('');
  }

  body.innerHTML = kpiHtml + tabsHtml + listHtml;
}

function enqApproveCustomer(customerId) {
  const approvedBy = (window.prompt("Your name (approving this customer):", "") || "").trim();
  if (!approvedBy) { enqAlert('Your name is required.'); return; }
  approveCustomer(customerId, approvedBy);
  enqAlert('✓ Customer approved.');
  renderEnquiryDashboard();
}

// ── Reject / duplicate panel ─────────────────
function openRejectCustomerPanel(customerId) {
  enqRejectDraft = { customerId, comment: '', duplicateOfCustomerId: '' };
  renderRejectCustomerPanel();
  const panel = document.getElementById('enq-reject-panel');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function renderRejectCustomerPanel() {
  const inner = document.getElementById('enq-reject-panel-inner');
  if (!inner || !enqRejectDraft) return;
  const customer = customers.find(c => c.id === enqRejectDraft.customerId);
  if (!customer) return;
  const otherCustomers = customers.filter(c => c.id !== customer.id && c.approvalStatus === 'approved');

  inner.innerHTML = `
    <p style="font-weight:700;font-size:14px;margin-bottom:4px;">Reject "${customer.name}"</p>
    <p style="font-size:11px;color:#64748b;margin-bottom:14px;">If this is a duplicate, link it to the real existing record so Accounts can trace it.</p>
    <div class="enq-field">
      <label>Reason (required)</label>
      <textarea onchange="enqRejectDraft.comment=this.value">${enqRejectDraft.comment}</textarea>
    </div>
    <div class="enq-field">
      <label>Duplicate of existing customer (optional)</label>
      <select onchange="enqRejectDraft.duplicateOfCustomerId=this.value">
        <option value="">— Not a known duplicate —</option>
        ${otherCustomers.map(c => `<option value="${c.id}" ${c.id === enqRejectDraft.duplicateOfCustomerId ? 'selected' : ''}>${c.name} (${c.id})</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;">
      <button class="danger" style="flex:1;" onclick="saveRejectCustomerPanel()">Confirm Reject</button>
      <button class="secondary" style="flex:1;" onclick="closeRejectCustomerPanel()">Cancel</button>
    </div>`;
}

function saveRejectCustomerPanel() {
  if (!enqRejectDraft) return;
  if (!enqRejectDraft.comment || enqRejectDraft.comment.trim().length === 0) { enqAlert('A reason is required.'); return; }
  const rejectedBy = (window.prompt("Your name (rejecting this customer):", "") || "").trim();
  if (!rejectedBy) { enqAlert('Your name is required.'); return; }
  rejectCustomer(enqRejectDraft.customerId, rejectedBy, enqRejectDraft.comment.trim(), enqRejectDraft.duplicateOfCustomerId || null);
  enqAlert('Customer rejected.');
  closeRejectCustomerPanel();
  renderEnquiryDashboard();
}

function closeRejectCustomerPanel() {
  enqRejectDraft = null;
  const panel = document.getElementById('enq-reject-panel');
  if (panel) panel.style.display = 'none';
}

// ── New Enquiry panel ────────────────────────
function openNewEnquiryPanel() {
  enqNewDraft = { customerId: null, customerSearch: '', contactPersonId: null, tel: '', email: '', requirements: '', sourceOfEnquiry: ENQUIRY_SOURCES[0], salesPersonAssigned: '' };
  renderNewEnquiryPanel();
  const panel = document.getElementById('enq-new-panel');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function renderNewEnquiryPanel() {
  const inner = document.getElementById('enq-new-panel-inner');
  if (!inner || !enqNewDraft) return;
  const selectedCustomer = enqNewDraft.customerId ? customers.find(c => c.id === enqNewDraft.customerId) : null;

  let customerBlockHtml;
  if (selectedCustomer) {
    customerBlockHtml = `
      <div class="enq-field">
        <label>Customer</label>
        <div style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;font-size:13px;">
          ${selectedCustomer.name} ${selectedCustomer.approvalStatus === 'pending' ? '<span class="enq-pill pending">pending verification</span>' : ''}
          <span style="float:right;color:#4338ca;cursor:pointer;font-size:12px;" onclick="enqClearCustomerSelection()">change</span>
        </div>
      </div>
      <div class="enq-field">
        <label>Contact Person</label>
        <select onchange="enqNewDraft.contactPersonId=this.value||null">
          <option value="">— Select Contact Person —</option>
          ${selectedCustomer.contactPersons.map(cp => `<option value="${cp.id}" ${cp.id === enqNewDraft.contactPersonId ? 'selected' : ''}>${cp.name}</option>`).join('')}
        </select>
        <span style="display:inline-block;margin-top:4px;color:#4338ca;cursor:pointer;font-size:11.5px;" onclick="enqAddContactPerson('${selectedCustomer.id}')">+ New contact person</span>
      </div>
      <div class="enq-field">
        <label>Telephone</label>
        <input type="text" value="${enqNewDraft.tel}" onchange="enqNewDraft.tel=this.value">
      </div>
      <div class="enq-field">
        <label>Email</label>
        <input type="text" value="${enqNewDraft.email}" onchange="enqNewDraft.email=this.value">
      </div>`;
  } else {
    const q = enqNewDraft.customerSearch.trim().toLowerCase();
    const matches = q.length === 0 ? [] : customers.filter(c => c.name.toLowerCase().includes(q) || (c.tel || '').includes(q)).slice(0, 8);
    customerBlockHtml = `
      <div class="enq-field">
        <label>Search Customer</label>
        <input type="text" placeholder="Name or telephone..." value="${enqNewDraft.customerSearch}" oninput="enqCustomerSearchChanged(this.value)">
      </div>
      ${matches.map(c => `
        <div class="enq-customer-match" onclick="enqSelectCustomer('${c.id}')">
          <strong>${c.name}</strong>${c.approvalStatus === 'pending' ? ' <span class="enq-pill pending">pending</span>' : ''}<br>
          <span style="color:#64748b;">${c.tel}${c.email ? ' · ' + c.email : ''}</span>
        </div>`).join('')}
      <button class="secondary" style="width:100%;margin-top:6px;margin-bottom:10px;" onclick="openNewCustomerPanel()">+ New Customer</button>`;
  }

  inner.innerHTML = `
    <p style="font-weight:700;font-size:14px;margin-bottom:14px;">New Enquiry</p>
    ${customerBlockHtml}
    <div class="enq-field">
      <label>Requirements</label>
      <textarea onchange="enqNewDraft.requirements=this.value">${enqNewDraft.requirements}</textarea>
    </div>
    <div class="enq-field">
      <label>Source of Enquiry</label>
      <select onchange="enqNewDraft.sourceOfEnquiry=this.value">
        ${ENQUIRY_SOURCES.map(s => `<option value="${s}" ${s === enqNewDraft.sourceOfEnquiry ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="enq-field">
      <label>Sales Person Assigned</label>
      <select onchange="enqNewDraft.salesPersonAssigned=this.value">
        <option value="">— Unassigned —</option>
        ${SALES_PEOPLE.map(s => `<option value="${s}" ${s === enqNewDraft.salesPersonAssigned ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;">
      <button class="primary" style="flex:1;" onclick="saveNewEnquiryPanel()">Submit</button>
      <button class="secondary" style="flex:1;" onclick="closeNewEnquiryPanel()">Exit</button>
    </div>`;
}

function enqCustomerSearchChanged(v) { if (enqNewDraft) { enqNewDraft.customerSearch = v; renderNewEnquiryPanel(); } }

function enqSelectCustomer(customerId) {
  if (!enqNewDraft) return;
  const c = customers.find(c => c.id === customerId);
  if (!c) return;
  enqNewDraft.customerId = c.id;
  enqNewDraft.tel = c.tel || '';
  enqNewDraft.email = c.email || '';
  enqNewDraft.contactPersonId = c.contactPersons[0] ? c.contactPersons[0].id : null;
  renderNewEnquiryPanel();
}

function enqClearCustomerSelection() {
  if (!enqNewDraft) return;
  enqNewDraft.customerId = null;
  enqNewDraft.contactPersonId = null;
  enqNewDraft.customerSearch = '';
  renderNewEnquiryPanel();
}

function enqAddContactPerson(customerId) {
  const name = (window.prompt("Contact person name:", "") || "").trim();
  if (!name) return;
  const contact = addCustomerContactPerson(customerId, name);
  if (contact && enqNewDraft) enqNewDraft.contactPersonId = contact.id;
  renderNewEnquiryPanel();
}

function saveNewEnquiryPanel() {
  if (!enqNewDraft) return;
  if (!enqNewDraft.customerId) { enqAlert('Select or create a customer first.'); return; }
  if (!enqNewDraft.requirements || !enqNewDraft.requirements.trim()) { enqAlert('Enter the requirements for this enquiry.'); return; }

  const enquiry = createEnquiry({
    customerId: enqNewDraft.customerId,
    contactPersonId: enqNewDraft.contactPersonId,
    tel: enqNewDraft.tel,
    email: enqNewDraft.email,
    requirements: enqNewDraft.requirements.trim(),
    sourceOfEnquiry: enqNewDraft.sourceOfEnquiry,
    salesPersonAssigned: enqNewDraft.salesPersonAssigned || null
  });

  enqAlert(`✓ Enquiry ${enquiry.id} created.`);
  closeNewEnquiryPanel();
  renderEnquiryDashboard();
  openEnquiryDetail(enquiry.id);
}

function closeNewEnquiryPanel() {
  enqNewDraft = null;
  const panel = document.getElementById('enq-new-panel');
  if (panel) panel.style.display = 'none';
}

// ── New Customer panel (opened from within New Enquiry) ──
function openNewCustomerPanel() {
  enqCustomerDraft = {
    name: '', tel: '', tel2: '', email: '', address: '', vatName: '', vatNo: '', crNo: '', country: 'Bahrain',
    taxPercent: 10, isCredit: false, creditLimit: 0, creditDays: 0,
    bankAccountNumber: '', bankAccountHolder: '', iban: '', swift: '', bankName: '', bankBranch: '',
    openingBalance: 0
  };
  renderNewCustomerPanel();
  const panel = document.getElementById('enq-customer-panel');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function renderNewCustomerPanel() {
  const inner = document.getElementById('enq-customer-panel-inner');
  if (!inner || !enqCustomerDraft) return;
  const f = enqCustomerDraft;
  inner.innerHTML = `
    <p style="font-weight:700;font-size:14px;margin-bottom:14px;">New Customer</p>
    <div class="enq-field"><label>Name *</label><input type="text" value="${f.name}" onchange="enqCustomerDraft.name=this.value"></div>
    <div class="enq-field"><label>Telephone *</label><input type="text" value="${f.tel}" onchange="enqCustomerDraft.tel=this.value"></div>
    <div class="enq-field"><label>Telephone 2</label><input type="text" value="${f.tel2}" onchange="enqCustomerDraft.tel2=this.value"></div>
    <div class="enq-field"><label>Email</label><input type="text" value="${f.email}" onchange="enqCustomerDraft.email=this.value"></div>
    <div class="enq-field"><label>Address *</label><textarea onchange="enqCustomerDraft.address=this.value">${f.address}</textarea></div>
    <div class="enq-field"><label>VAT Name</label><input type="text" value="${f.vatName}" onchange="enqCustomerDraft.vatName=this.value"></div>
    <div class="enq-field"><label>VAT No</label><input type="text" value="${f.vatNo}" onchange="enqCustomerDraft.vatNo=this.value"></div>
    <div class="enq-field"><label>Tax %</label><input type="number" step="0.01" value="${f.taxPercent}" onchange="enqCustomerDraft.taxPercent=Number(this.value)"></div>
    <div class="enq-field"><label>CR No</label><input type="text" value="${f.crNo}" onchange="enqCustomerDraft.crNo=this.value"></div>
    <div class="enq-field"><label>Country</label><input type="text" value="${f.country}" onchange="enqCustomerDraft.country=this.value"></div>
    <div class="enq-field"><label><input type="checkbox" ${f.isCredit ? 'checked' : ''} onchange="enqCustomerDraft.isCredit=this.checked" style="width:auto;display:inline-block;margin-right:6px;"> Is Credit</label></div>
    <div class="enq-field"><label>Credit Limit</label><input type="number" step="0.01" value="${f.creditLimit}" onchange="enqCustomerDraft.creditLimit=Number(this.value)"></div>
    <div class="enq-field"><label>Credit Days</label><input type="number" value="${f.creditDays}" onchange="enqCustomerDraft.creditDays=Number(this.value)"></div>
    <div class="enq-field"><label>Bank Account Number</label><input type="text" value="${f.bankAccountNumber}" onchange="enqCustomerDraft.bankAccountNumber=this.value"></div>
    <div class="enq-field"><label>Bank Account Holder Name</label><input type="text" value="${f.bankAccountHolder}" onchange="enqCustomerDraft.bankAccountHolder=this.value"></div>
    <div class="enq-field"><label>IBAN Number</label><input type="text" value="${f.iban}" onchange="enqCustomerDraft.iban=this.value"></div>
    <div class="enq-field"><label>Bank Swift</label><input type="text" value="${f.swift}" onchange="enqCustomerDraft.swift=this.value"></div>
    <div class="enq-field"><label>Bank Name</label><input type="text" value="${f.bankName}" onchange="enqCustomerDraft.bankName=this.value"></div>
    <div class="enq-field"><label>Bank Branch</label><input type="text" value="${f.bankBranch}" onchange="enqCustomerDraft.bankBranch=this.value"></div>
    <div class="enq-field"><label>Opening Balance</label><input type="number" step="0.01" value="${f.openingBalance}" onchange="enqCustomerDraft.openingBalance=Number(this.value)"></div>
    <p style="font-size:10.5px;color:#94a3b8;margin-bottom:10px;">Saved as pending — Accounts verifies it isn't a duplicate before it's trusted.</p>
    <div style="display:flex;gap:8px;">
      <button class="primary" style="flex:1;" onclick="saveNewCustomerPanel()">Save and continue</button>
      <button class="secondary" style="flex:1;" onclick="closeNewCustomerPanel()">Exit</button>
    </div>`;
}

function saveNewCustomerPanel() {
  if (!enqCustomerDraft) return;
  const f = enqCustomerDraft;
  if (!f.name.trim()) { enqAlert('Name is required.'); return; }
  if (!f.tel.trim()) { enqAlert('Telephone is required.'); return; }
  if (!f.address.trim()) { enqAlert('Address is required.'); return; }

  const createdBy = (window.prompt("Your name (creating this customer):", "") || "").trim();
  if (!createdBy) { enqAlert('Your name is required.'); return; }

  const customer = createCustomer({
    name: f.name.trim(), tel: f.tel.trim(), tel2: f.tel2.trim(), email: f.email.trim(),
    address: f.address.trim(), vatName: f.vatName.trim(), vatNo: f.vatNo.trim(),
    crNo: f.crNo.trim(), country: f.country.trim() || 'Bahrain', createdBy,
    taxPercent: f.taxPercent, isCredit: f.isCredit, creditLimit: f.creditLimit, creditDays: f.creditDays,
    bankAccountNumber: f.bankAccountNumber.trim(), bankAccountHolder: f.bankAccountHolder.trim(),
    iban: f.iban.trim(), swift: f.swift.trim(), bankName: f.bankName.trim(), bankBranch: f.bankBranch.trim(),
    openingBalance: f.openingBalance
  });

  enqAlert(`✓ Customer ${customer.id} created — pending verification.`);
  closeNewCustomerPanel();
  if (enqNewDraft) enqSelectCustomer(customer.id);
}

function closeNewCustomerPanel() {
  enqCustomerDraft = null;
  const panel = document.getElementById('enq-customer-panel');
  if (panel) panel.style.display = 'none';
}

// ── Enquiry detail (Basic + Follow up tabs) ──
function openEnquiryDetail(enquiryId) {
  enqDetailId = enquiryId;
  enqDetailTab = 'basic';
  enqFollowUpDraft = null;
  renderEnquiryDetail();
  const panel = document.getElementById('enq-detail-panel');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function enqSetDetailTab(tab) {
  enqDetailTab = tab;
  if (tab === 'followup' && !enqFollowUpDraft) {
    enqFollowUpDraft = { dateOfAppointment: new Date().toISOString().slice(0, 10), meetingType: FOLLOWUP_MEETING_TYPES[0], outcome: FOLLOWUP_OUTCOMES[0], notes: '' };
  }
  renderEnquiryDetail();
}

function renderEnquiryDetail() {
  const inner = document.getElementById('enq-detail-panel-inner');
  const enquiry = enquiries.find(e => e.id === enqDetailId);
  if (!inner || !enquiry) return;
  const customer = customers.find(c => c.id === enquiry.customerId);
  const contact = customer ? customer.contactPersons.find(cp => cp.id === enquiry.contactPersonId) : null;

  const tabsHtml = `
    <div class="enq-tabs">
      <button class="enq-tabbtn ${enqDetailTab === 'basic' ? 'active' : ''}" onclick="enqSetDetailTab('basic')">Basic</button>
      <button class="enq-tabbtn ${enqDetailTab === 'followup' ? 'active' : ''}" onclick="enqSetDetailTab('followup')">Follow up</button>
    </div>`;

  let bodyHtml;
  if (enqDetailTab === 'basic') {
    bodyHtml = `
      <div class="enq-summary-row"><span class="k">Enquiry No</span><span>${enquiry.id}</span></div>
      <div class="enq-summary-row"><span class="k">Enquiry Date</span><span>${enquiry.dateCreated}</span></div>
      <div class="enq-summary-row"><span class="k">Customer</span><span>${customer ? customer.name : '—'}</span></div>
      <div class="enq-summary-row"><span class="k">Contact Person</span><span>${contact ? contact.name : '—'}</span></div>
      <div class="enq-summary-row"><span class="k">Telephone</span><span>${enquiry.tel || '—'}</span></div>
      <div class="enq-summary-row"><span class="k">Email</span><span>${enquiry.email || '—'}</span></div>
      <div class="enq-summary-row"><span class="k">Source</span><span>${enquiry.sourceOfEnquiry}</span></div>
      <div class="enq-summary-row"><span class="k">Status</span><span class="enq-pill ${enquiry.status}">${enquiry.status.replace('-', ' ')}</span></div>
      <div class="enq-field" style="margin-top:10px;"><label>Requirements</label><p style="font-size:12.5px;color:#334155;">${enquiry.requirements}</p></div>
      <div class="enq-field">
        <label>Sales Person Assigned</label>
        <select onchange="enqAssignSalesPerson('${enquiry.id}', this.value)" ${enquiry.status === 'lost' || enquiry.status === 'quoted' ? 'disabled' : ''}>
          <option value="">— Unassigned —</option>
          ${SALES_PEOPLE.map(s => `<option value="${s}" ${s === enquiry.salesPersonAssigned ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      ${enquiry.status === 'lost' ? `<p style="font-size:11.5px;color:#991b1b;">Marked lost${enquiry.lostReason ? ': ' + enquiry.lostReason : ''}.</p>` : ''}
      ${(enquiry.status !== 'lost' && enquiry.status !== 'quoted') ? `<button class="danger" style="width:100%;margin-top:10px;" onclick="enqMarkLost('${enquiry.id}')">Mark as Lost</button>` : ''}
    `;
  } else {
    const rowsHtml = enquiry.followUps.length === 0
      ? `<tr><td colspan="3" style="color:#94a3b8;">No follow-ups logged yet.</td></tr>`
      : enquiry.followUps.slice().reverse().map(f => `<tr><td>${f.dateOfAppointment}</td><td>${f.meetingType}</td><td>${f.outcome}</td></tr>`).join('');

    bodyHtml = `
      <div class="enq-field">
        <label>Date of Appointment</label>
        <input type="date" value="${enqFollowUpDraft.dateOfAppointment}" onchange="enqFollowUpDraft.dateOfAppointment=this.value">
      </div>
      <div class="enq-field">
        <label>Meeting Type</label>
        <select onchange="enqFollowUpDraft.meetingType=this.value">
          ${FOLLOWUP_MEETING_TYPES.map(m => `<option value="${m}" ${m === enqFollowUpDraft.meetingType ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
      <div class="enq-field">
        <label>Outcome</label>
        <select onchange="enqFollowUpDraft.outcome=this.value">
          ${FOLLOWUP_OUTCOMES.map(o => `<option value="${o}" ${o === enqFollowUpDraft.outcome ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="enq-field">
        <label>Notes (min 10 characters)</label>
        <textarea onchange="enqFollowUpDraft.notes=this.value">${enqFollowUpDraft.notes}</textarea>
      </div>
      <button class="primary" style="width:100%;" onclick="saveEnquiryFollowUp('${enquiry.id}')">Submit</button>
      <table class="enq-fu-table">
        <tr><th>Date</th><th>Meeting Type</th><th>Outcome</th></tr>
        ${rowsHtml}
      </table>
    `;
  }

  inner.innerHTML = `
    <p style="font-weight:700;font-size:14px;margin-bottom:10px;">${customer ? customer.name : enquiry.id}</p>
    ${tabsHtml}
    ${bodyHtml}
    <button class="secondary" style="width:100%;margin-top:14px;" onclick="closeEnquiryDetail()">Close</button>
  `;
}

function enqAssignSalesPerson(enquiryId, salesPerson) {
  assignEnquirySalesPerson(enquiryId, salesPerson || null);
  renderEnquiryDetail();
  renderEnquiryDashboard();
}

function enqMarkLost(enquiryId) {
  const reason = (window.prompt("Reason (optional):", "") || "").trim() || null;
  markEnquiryLost(enquiryId, reason);
  enqAlert('Enquiry marked as lost.');
  renderEnquiryDetail();
  renderEnquiryDashboard();
}

function saveEnquiryFollowUp(enquiryId) {
  if (!enqFollowUpDraft) return;
  const result = addEnquiryFollowUp(enquiryId, enqFollowUpDraft);
  if (result.error) { enqAlert(result.error); return; }
  enqAlert('✓ Follow-up logged.');
  enqFollowUpDraft = { dateOfAppointment: new Date().toISOString().slice(0, 10), meetingType: FOLLOWUP_MEETING_TYPES[0], outcome: FOLLOWUP_OUTCOMES[0], notes: '' };
  renderEnquiryDetail();
}

function closeEnquiryDetail() {
  enqDetailId = null;
  const panel = document.getElementById('enq-detail-panel');
  if (panel) panel.style.display = 'none';
  renderEnquiryDashboard();
}
