// ══════════════════════════════════════════
// SALES MODULE — Enquiry + Quotation
// Built session: 25 Jul 2026, rebuilt from a live reverse-engineered Q-Pro
// spec (qpro.almarayadecor.com). Replaces an earlier version of this module
// that was described in a handoff brief but never actually landed in this
// repo.
//
// Single file covering both Enquiry and Quotation screens (rather than
// splitting per the old handoff's enquiry.js/quotation.js split) because the
// two are one continuous flow in the live system — Quotation only exists as
// a conversion off an Enquiry, never standalone. Reads/writes customers[],
// enquiries[], quotations[] and their helper functions in data.js.
//
// Creates its own #sales-module-wrap dynamically, same pattern as
// storekeeper.js — no HTML paste-in needed for the module shell itself.
// ══════════════════════════════════════════

const salesStyleTag = document.createElement('style');
salesStyleTag.textContent = `
#sales-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#sales-module-wrap .ops-header{background:var(--biz-purple);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#sales-module-wrap .sales-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#sales-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
#sales-module-wrap .sales-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#sales-module-wrap .sales-kpi-tile .num{font-size:21px;font-weight:700;color:var(--biz-purple);}
#sales-module-wrap .sales-kpi-tile .lbl{font-size:10.5px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#sales-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#sales-module-wrap .sales-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:3px 10px;border-radius:20px;background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#sales-module-wrap .sales-pill.draft{background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#sales-module-wrap .sales-pill.open{background:var(--biz-open-bg);color:var(--biz-open-text);}
#sales-module-wrap .sales-pill.confirmed{background:var(--biz-confirmed-bg);color:var(--biz-confirmed-text);}
#sales-module-wrap .sales-pill.closed{background:var(--biz-closed-bg);color:var(--biz-closed-text);}
#sales-module-wrap .sales-pill.stage-sales{background:#ede9fe;color:#5b21b6;}
#sales-module-wrap .sales-pill.stage-estimator{background:#fef3c7;color:#92400e;}
#sales-module-wrap .sales-pill.stage-approver{background:#fee2e2;color:#991b1b;}
#sales-module-wrap .sales-search{width:100%;padding:9px 12px;border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);font-size:13px;margin-bottom:12px;box-sizing:border-box;background:var(--biz-input-bg);font-family:inherit;}
#sales-module-wrap button.primary{background:var(--biz-primary);color:#fff;border:0;border-radius:var(--biz-r-sm);padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .12s;}
#sales-module-wrap button.primary:hover{background:var(--biz-primary-dark);}
#sales-module-wrap button.secondary{background:var(--biz-card-bg);border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);color:var(--biz-text-muted);font-size:13px;padding:9px 18px;cursor:pointer;font-family:inherit;}
#sales-module-wrap .sales-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#sales-module-wrap .sales-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:var(--biz-card-bg);color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#sales-module-wrap .sales-tabbtn.active{background:var(--biz-purple);border-color:var(--biz-purple);color:#fff;}
/* Segmented status tabs — Quotation List's Draft/Open/Confirmed/Closed/All,
   pale-fill-per-status like the live Q-Pro segmented control (kept as
   compact pills rather than full-width bars — modernized proportions) */
#sales-module-wrap .sales-status-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#sales-module-wrap .sales-status-tab{font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:20px;border:0;cursor:pointer;font-family:inherit;background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#sales-module-wrap .sales-status-tab.st-draft.active{background:var(--biz-draft-text);color:#fff;}
#sales-module-wrap .sales-status-tab.st-open{background:var(--biz-open-bg);color:var(--biz-open-text);}
#sales-module-wrap .sales-status-tab.st-open.active{background:var(--biz-open-text);color:#fff;}
#sales-module-wrap .sales-status-tab.st-confirmed{background:var(--biz-confirmed-bg);color:var(--biz-confirmed-text);}
#sales-module-wrap .sales-status-tab.st-confirmed.active{background:var(--biz-confirmed-text);color:#fff;}
#sales-module-wrap .sales-status-tab.st-closed{background:var(--biz-closed-bg);color:var(--biz-closed-text);}
#sales-module-wrap .sales-status-tab.st-closed.active{background:var(--biz-closed-text);color:#fff;}
#sales-module-wrap .sales-status-tab.st-all.active{background:#8a93a6;color:#fff;}
#sales-module-wrap .sales-toptabs{display:flex;gap:0;margin:-16px -18px 16px;background:var(--biz-card-bg);border-bottom:1px solid var(--biz-border-light);overflow-x:auto;-webkit-overflow-scrolling:touch;}
#sales-module-wrap .sales-toptab{flex:none;white-space:nowrap;text-align:center;padding:12px 12px;font-size:13px;font-weight:600;color:var(--biz-text-faint);cursor:pointer;border-bottom:2px solid transparent;}
#sales-module-wrap .sales-toptab.active{color:var(--biz-purple);border-bottom-color:var(--biz-purple);font-weight:700;}
#sales-module-wrap .sales-field{margin-bottom:10px;}
#sales-module-wrap .sales-field label{font-size:10.5px;font-weight:700;color:var(--biz-text-muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px;}
#sales-module-wrap .sales-field input, #sales-module-wrap .sales-field select, #sales-module-wrap .sales-field textarea{width:100%;padding:9px 11px;border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);font-size:13px;box-sizing:border-box;font-family:inherit;background:var(--biz-input-bg);color:var(--biz-text);transition:border-color .12s;}
#sales-module-wrap .sales-field input:focus, #sales-module-wrap .sales-field select:focus, #sales-module-wrap .sales-field textarea:focus{outline:none;border-color:var(--biz-primary);background:var(--biz-card-bg);}
#sales-module-wrap .sales-field textarea{min-height:70px;resize:vertical;}
#sales-module-wrap .sales-banner{background:#fff6e3;color:#92400e;font-size:12px;padding:9px 12px;border-radius:var(--biz-r-sm);margin-bottom:12px;font-weight:600;}
#sales-module-wrap .sales-preview{background:#f4e6ec;border:1px solid #e0c2d0;border-radius:var(--biz-r);padding:12px;margin-bottom:14px;}
#sales-module-wrap .sales-preview p{font-size:12px;margin:2px 0;color:var(--biz-text-muted);}
#sales-module-wrap .sales-preview b{color:var(--biz-text);}
#sales-module-wrap .sales-wizard-steps{display:flex;gap:4px;margin-bottom:16px;}
#sales-module-wrap .sales-wizard-step{flex:1;text-align:center;font-size:10.5px;font-weight:700;padding:8px 4px;border-radius:var(--biz-r-sm);background:var(--biz-input-bg);color:var(--biz-text-faint);}
#sales-module-wrap .sales-wizard-step.active{background:var(--biz-purple);color:#fff;}
#sales-module-wrap .sales-wizard-step.done{background:#f4e6ec;color:var(--biz-primary-dark);}
#sales-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
#sales-module-wrap table.sales-items th{text-align:left;padding:7px 6px;background:var(--biz-input-bg);color:var(--biz-text-muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--biz-border-light);}
#sales-module-wrap table.sales-items td{padding:7px 6px;border-bottom:1px solid var(--biz-border-light);}
#sales-module-wrap table.sales-items tr:hover td{background:#FAFBFD;}
#sales-module-wrap .sales-locked{background:var(--biz-border-light) !important;color:var(--biz-text-faint) !important;}
#sales-module-wrap .sales-tile-row{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;}
#sales-module-wrap .sales-tile{border:0;border-radius:var(--biz-r);padding:14px 10px;text-align:center;font-size:11.5px;font-weight:700;color:#fff;cursor:pointer;box-shadow:var(--biz-shadow);transition:transform .12s,box-shadow .12s;text-transform:uppercase;letter-spacing:.2px;}
#sales-module-wrap .sales-tile:hover{transform:translateY(-2px);box-shadow:0 12px 28px 0 rgba(37,37,42,.14);}
#sales-module-wrap .sales-tile .sales-tile-icon{font-size:18px;display:block;margin-bottom:6px;}
#sales-module-wrap .sales-tile.t-blue{background:linear-gradient(135deg,var(--biz-primary),var(--biz-primary2));}
#sales-module-wrap .sales-tile.t-purple{background:linear-gradient(135deg,var(--biz-purple),var(--biz-primary2));}
#sales-module-wrap .sales-tile.t-teal{background:linear-gradient(135deg,var(--biz-teal),var(--biz-primary2));}
#sales-module-wrap .sales-tile.t-magenta{background:linear-gradient(135deg,var(--biz-magenta),var(--biz-primary2));}
#sales-module-wrap .sales-tile.t-amber{background:linear-gradient(135deg,var(--biz-primary),var(--biz-primary2));}
#sales-module-wrap .sales-tile.t-cyan{background:linear-gradient(135deg,var(--biz-cyan),var(--biz-primary2));}
#sales-module-wrap .sales-back{font-size:12px;color:var(--biz-primary);font-weight:600;cursor:pointer;margin-bottom:10px;display:inline-block;}
`;
document.head.appendChild(salesStyleTag);

// ── Module shell ──
const salesModuleWrap = document.createElement('div');
salesModuleWrap.id = 'sales-module-wrap';
salesModuleWrap.style.cssText = 'display:none;';
salesModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">💼</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Sales</div>
        <div style="color:rgba(255,255,255,.7);font-size:11px;">Enquiry → Quotation</div>
      </div>
    </div>
    <button onclick="closeSalesModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="sales-scroll">
    <div id="sales-body"></div>
  </div>
`;
document.body.appendChild(salesModuleWrap);

// ── State ──
let salesTopView = 'enquiries';        // 'enquiries' | 'quotations' | 'reports'
let salesView = 'enq-list';            // enq-list | enq-create | enq-detail | cust-create | qtn-list | qtn-hub | qtn-wizard | qtn-register
let salesActiveEnquiryId = null;
let salesActiveQtnId = null;
let salesActiveEnqTab = 'basic';       // basic | followup
let salesWizardStep = 1;
let salesEnqFilters = { from: '', to: '', customer: '', salesPerson: '', unassigned: false, unattended: false, unquoted: false };
let salesQtnFilters = { qtnNo: '', customer: '', project: '', tel: '', salesPerson: '' };
let salesQtnListTab = 'all';           // draft | open | confirmed | closed | all
let salesQtnRegFilters = { from: '', to: '', salesPerson: '', status: 'All' };
let salesDraft = null;                 // scratch object for create forms
let salesEditingLineId = null;         // which item's inline edit panel is open on Wizard Step 2
let salesCurrentUser = STAFF.find(s => s !== 'Operations') || STAFF[0]; // simulates the logged-in Salesman for the lock/banner rule

function salesAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('sales-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sales-toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;padding:10px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

function esc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }

// ── Module open/close ──
function openSalesModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  salesModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  salesTopView = 'dashboard';
  salesView = 'dashboard';
  renderSalesBody();
}
function closeSalesModule() {
  salesModuleWrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}
function launchEnquiryModule() { openSalesModule(); }
function launchSalesModule() { openSalesModule(); }

const SALES_TOPVIEW_DEFAULTS = {
  dashboard: 'dashboard', enquiries: 'enq-list', quotations: 'qtn-list', reports: 'qtn-register'
};
function salesSetTopView(v) {
  salesTopView = v;
  salesView = SALES_TOPVIEW_DEFAULTS[v] || 'enq-list';
  renderSalesBody();
}

function renderSalesBody() {
  const body = document.getElementById('sales-body');
  if (!body) return;
  const topTabs = `
    <div class="sales-toptabs">
      <div class="sales-toptab ${salesTopView === 'dashboard' ? 'active' : ''}" onclick="salesSetTopView('dashboard')">Dashboard</div>
      <div class="sales-toptab ${salesTopView === 'enquiries' ? 'active' : ''}" onclick="salesSetTopView('enquiries')">Enquiry</div>
      <div class="sales-toptab ${salesTopView === 'quotations' ? 'active' : ''}" onclick="salesSetTopView('quotations')">Quotation</div>
      <div class="sales-toptab ${salesTopView === 'reports' ? 'active' : ''}" onclick="salesSetTopView('reports')">Reports</div>
    </div>`;

  let content = '';
  switch (salesView) {
    case 'dashboard': content = renderSalesDashboard(); break;
    case 'enq-list': content = renderEnquiryList(); break;
    case 'enq-create': content = renderEnquiryCreate(); break;
    case 'cust-create': content = renderCustomerCreate(); break;
    case 'enq-detail': content = renderEnquiryDetail(); break;
    case 'qtn-list': content = renderQuotationList(); break;
    case 'qtn-hub': content = renderQuotationHub(); break;
    case 'qtn-wizard': content = renderQuotationWizard(); break;
    case 'qtn-register': content = renderSalesReports(); break;
    default: content = renderEnquiryList();
  }
  body.innerHTML = topTabs + content;
}

// ══════════════════════════════════════════
// MODULE 1 — ENQUIRY
// ══════════════════════════════════════════

function custName(customerId) {
  const c = customers.find(x => x.id === customerId);
  return c ? c.name : '';
}

function enquiryStatusLabel(e) {
  if (!e.salesPerson) return 'Un Assigned';
  if (e.followUps.length === 0) return 'Un Attended';
  if (!e.linkedQuotationId) return 'Un Quoted';
  return 'Quoted';
}

function enquiryMatchesFilters(e) {
  const f = salesEnqFilters;
  if (f.from && e.dateCreated < f.from) return false;
  if (f.to && e.dateCreated > f.to) return false;
  if (f.customer && !custName(e.customerId).toLowerCase().includes(f.customer.toLowerCase()) && !e.prospectName.toLowerCase().includes(f.customer.toLowerCase())) return false;
  if (f.salesPerson && e.salesPerson !== f.salesPerson) return false;
  if (f.unassigned && e.salesPerson) return false;
  if (f.unattended && e.followUps.length > 0) return false;
  if (f.unquoted && e.linkedQuotationId) return false;
  return true;
}

function salesEnqFilterChanged(key, val) { salesEnqFilters[key] = val; renderSalesBody(); }

function renderEnquiryList() {
  const rows = enquiries.filter(enquiryMatchesFilters)
    .slice().sort((a, b) => b.dateCreated.localeCompare(a.dateCreated));

  const filterHtml = `
    <div class="sales-card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>From Date</label><input type="date" value="${salesEnqFilters.from}" onchange="salesEnqFilterChanged('from',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>To Date</label><input type="date" value="${salesEnqFilters.to}" onchange="salesEnqFilterChanged('to',this.value)"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Customer</label><input type="text" value="${salesEnqFilters.customer}" placeholder="Search customer/prospect" oninput="salesEnqFilterChanged('customer',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>Sales Person</label>
          <select onchange="salesEnqFilterChanged('salesPerson',this.value)">
            <option value="">All</option>
            ${STAFF.map(s => `<option value="${s}" ${salesEnqFilters.salesPerson === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;">
        <label><input type="checkbox" ${salesEnqFilters.unassigned ? 'checked' : ''} onchange="salesEnqFilterChanged('unassigned',this.checked)"> Un Assigned</label>
        <label><input type="checkbox" ${salesEnqFilters.unattended ? 'checked' : ''} onchange="salesEnqFilterChanged('unattended',this.checked)"> Un Attended</label>
        <label><input type="checkbox" ${salesEnqFilters.unquoted ? 'checked' : ''} onchange="salesEnqFilterChanged('unquoted',this.checked)"> Un Quoted</label>
      </div>
    </div>
    <button class="primary" style="width:100%;margin-bottom:12px;" onclick="openEnquiryCreate()">+ Create Enquiry</button>`;

  const listHtml = rows.length === 0
    ? `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No enquiries match these filters.</p></div>`
    : rows.map(e => `
      <div class="sales-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="flex:1;cursor:pointer;" onclick="openEnquiryDetail('${e.id}')">
            <p style="font-weight:700;font-size:13px;">${e.id} <span style="font-weight:400;color:#94a3b8;">· ${e.dateCreated}</span></p>
            <p style="font-size:12px;color:#334155;">${esc(e.customerId ? custName(e.customerId) : e.prospectName)}</p>
            <p style="font-size:11px;color:#64748b;">Salesman: ${esc(e.salesPerson) || '—'} · Source: ${esc(e.source)}</p>
          </div>
          <div style="text-align:right;">
            <span class="sales-pill">${enquiryStatusLabel(e)}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="secondary" style="flex:1;font-size:11.5px;padding:7px;" onclick="openEnquiryDetail('${e.id}')">Update</button>
          ${canConvertToQuotation(e) && !e.linkedQuotationId ? `<button class="primary" style="flex:1;font-size:11.5px;padding:7px;" onclick="startConvertToQuotation('${e.id}')">Convert Quotation</button>` : ''}
          <button class="secondary" style="flex:1;font-size:11.5px;padding:7px;color:#b91c1c;" onclick="salesCancelEnquiry('${e.id}')">Cancel</button>
        </div>
      </div>`).join('');

  return filterHtml + listHtml;
}

function salesCancelEnquiry(id) {
  if (!window.confirm('Are you sure you want to delete?')) return;
  cancelEnquiry(id);
  salesAlert('Enquiry deleted.');
  renderSalesBody();
}

// ── Create Enquiry ──
function openEnquiryCreate() {
  salesDraft = { division: SALES_DIVISIONS[0], customerId: '', prospectName: '', contactPerson: '', tel: '', email: '', requirements: '', source: ENQUIRY_SOURCES[0], salesPerson: STAFF[0] };
  salesView = 'enq-create';
  renderSalesBody();
}
function salesEnqDraftChanged(key, val) { if (salesDraft) salesDraft[key] = val; renderSalesBody(); }

function renderEnquiryCreate() {
  const d = salesDraft;
  const c = customers.find(x => x.id === d.customerId);
  const preview = `
    <div class="sales-preview">
      <p style="font-weight:700;color:#1a1f2e;margin-bottom:6px;">Customer preview</p>
      <p><b>Customer Name:</b> ${esc(c ? c.name : '—')}</p>
      <p><b>Telephone:</b> ${esc(c ? c.tel : '—')}</p>
      <p><b>Email:</b> ${esc(c ? c.email : '—')}</p>
      <p><b>Address:</b> ${esc(c ? c.address : '—')}</p>
      <p><b>Contact Person:</b> ${esc(c ? c.contactPerson : '—')}</p>
      <p><b>VAT Name:</b> ${esc(c ? c.vatName : '—')}</p>
      <p><b>VAT No:</b> ${esc(c ? c.vatNo : '—')}</p>
      <p><b>Sales Man:</b> ${esc(c ? c.salesMan : '—')}</p>
    </div>`;

  return `
    <span class="sales-back" onclick="salesView='enq-list';renderSalesBody();">‹ Back to Enquiry List</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;margin-bottom:12px;">Create Enquiry</p>
      <div class="sales-field"><label>Division</label>
        <select onchange="salesEnqDraftChanged('division',this.value)">${SALES_DIVISIONS.map(x => `<option value="${x}" ${d.division === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      <div class="sales-field"><label>Select Customer</label>
        <select onchange="salesEnqDraftChanged('customerId',this.value)">
          <option value="">— None (new prospect) —</option>
          ${customers.map(c => `<option value="${c.id}" ${d.customerId === c.id ? 'selected' : ''}>${c.name} (${c.id})</option>`).join('')}
        </select>
        <button class="secondary" style="margin-top:6px;font-size:11.5px;padding:6px 10px;" onclick="openCustomerCreate('enq-create')">+ New Customer</button>
      </div>
      ${!d.customerId ? `<div class="sales-field"><label>New Prospect Name</label><input type="text" value="${esc(d.prospectName)}" oninput="salesEnqDraftChanged('prospectName',this.value)"></div>` : ''}
      <div class="sales-field"><label>Contact Person</label><input type="text" value="${esc(d.contactPerson)}" oninput="salesEnqDraftChanged('contactPerson',this.value)"></div>
      <div class="sales-field"><label>Tel</label><input type="text" value="${esc(d.tel)}" oninput="salesEnqDraftChanged('tel',this.value)"></div>
      <div class="sales-field"><label>Email</label><input type="email" value="${esc(d.email)}" oninput="salesEnqDraftChanged('email',this.value)"></div>
      <div class="sales-field"><label>Requirements</label><textarea oninput="salesEnqDraftChanged('requirements',this.value)">${esc(d.requirements)}</textarea></div>
      <div class="sales-field"><label>Select Source of Enquiry</label>
        <select onchange="salesEnqDraftChanged('source',this.value)">${ENQUIRY_SOURCES.map(x => `<option value="${x}" ${d.source === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      <div class="sales-field"><label>Sales Person Assigned</label>
        <select onchange="salesEnqDraftChanged('salesPerson',this.value)">${STAFF.map(x => `<option value="${x}" ${d.salesPerson === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      ${preview}
      <div style="display:flex;gap:8px;">
        <button class="primary" style="flex:1;" onclick="saveEnquiryCreate()">Submit</button>
        <button class="secondary" style="flex:1;" onclick="salesView='enq-list';renderSalesBody();">Exit</button>
      </div>
    </div>`;
}

function saveEnquiryCreate() {
  const d = salesDraft;
  if (!d.contactPerson || !d.tel) { salesAlert('Contact Person and Tel are required.'); return; }
  const result = createEnquiry(d);
  if (result.error) { salesAlert(result.error); return; }
  salesAlert(`✓ Enquiry ${result.id} created.`);
  salesDraft = null;
  salesView = 'enq-list';
  renderSalesBody();
}

// ── Add Customer ──
function openCustomerCreate(returnTo) {
  salesDraft = { _returnTo: returnTo, name: '', contactPerson: '', tel: '', tel2: '', email: '', fax: '', vatName: '', vatNo: '', taxPercent: 0, isCredit: false, creditLimit: 0, creditDays: 0, bankAccountNumber: '', bankAccountHolderName: '', ibanNumber: '', bankSwift: '', bankName: '', bankBranch: '', address: '', crNo: '', country: 'Bahrain', openingBalance: 0, salesMan: STAFF[0] };
  salesView = 'cust-create';
  renderSalesBody();
}
function salesCustDraftChanged(key, val) { if (salesDraft) salesDraft[key] = val; }

function renderCustomerCreate() {
  const d = salesDraft;
  return `
    <span class="sales-back" onclick="salesView=salesDraft._returnTo||'enq-list';renderSalesBody();">‹ Back</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;margin-bottom:12px;">Add Customer</p>
      <div class="sales-field"><label>Name *</label><input type="text" value="${esc(d.name)}" oninput="salesCustDraftChanged('name',this.value)"></div>
      <div class="sales-field"><label>Contact Person *</label><input type="text" value="${esc(d.contactPerson)}" oninput="salesCustDraftChanged('contactPerson',this.value)"></div>
      <div class="sales-field"><label>Telephone *</label><input type="text" value="${esc(d.tel)}" oninput="salesCustDraftChanged('tel',this.value)"></div>
      <div class="sales-field"><label>Telephone 2</label><input type="text" value="${esc(d.tel2)}" oninput="salesCustDraftChanged('tel2',this.value)"></div>
      <div class="sales-field"><label>Email</label><input type="email" value="${esc(d.email)}" oninput="salesCustDraftChanged('email',this.value)"></div>
      <div class="sales-field"><label>Fax</label><input type="text" value="${esc(d.fax)}" oninput="salesCustDraftChanged('fax',this.value)"></div>
      <div class="sales-field"><label>Vat Name</label><input type="text" value="${esc(d.vatName)}" oninput="salesCustDraftChanged('vatName',this.value)"></div>
      <div class="sales-field"><label>Vat No</label><input type="text" value="${esc(d.vatNo)}" oninput="salesCustDraftChanged('vatNo',this.value)"></div>
      <div class="sales-field"><label>Tax %</label>
        <select onchange="salesCustDraftChanged('taxPercent',Number(this.value))">
          ${[0, 5, 10].map(v => `<option value="${v}" ${d.taxPercent === v ? 'selected' : ''}>${v}%</option>`).join('')}
        </select>
      </div>
      <div class="sales-field"><label><input type="checkbox" ${d.isCredit ? 'checked' : ''} onchange="salesCustDraftChanged('isCredit',this.checked)"> Is Credit</label></div>
      <div class="sales-field"><label>Credit Limit</label><input type="number" value="${d.creditLimit}" oninput="salesCustDraftChanged('creditLimit',Number(this.value))"></div>
      <div class="sales-field"><label>Credit Days</label><input type="number" value="${d.creditDays}" oninput="salesCustDraftChanged('creditDays',Number(this.value))"></div>
      <div class="sales-field"><label>Bank Account Number</label><input type="text" value="${esc(d.bankAccountNumber)}" oninput="salesCustDraftChanged('bankAccountNumber',this.value)"></div>
      <div class="sales-field"><label>Bank Account Holder Name</label><input type="text" value="${esc(d.bankAccountHolderName)}" oninput="salesCustDraftChanged('bankAccountHolderName',this.value)"></div>
      <div class="sales-field"><label>IBAN Number</label><input type="text" value="${esc(d.ibanNumber)}" oninput="salesCustDraftChanged('ibanNumber',this.value)"></div>
      <div class="sales-field"><label>Bank Swift</label><input type="text" value="${esc(d.bankSwift)}" oninput="salesCustDraftChanged('bankSwift',this.value)"></div>
      <div class="sales-field"><label>Bank Name</label><input type="text" value="${esc(d.bankName)}" oninput="salesCustDraftChanged('bankName',this.value)"></div>
      <div class="sales-field"><label>Bank Branch</label><input type="text" value="${esc(d.bankBranch)}" oninput="salesCustDraftChanged('bankBranch',this.value)"></div>
      <div class="sales-field"><label>Address *</label><textarea oninput="salesCustDraftChanged('address',this.value)">${esc(d.address)}</textarea></div>
      <div class="sales-field"><label>CR No</label><input type="text" value="${esc(d.crNo)}" oninput="salesCustDraftChanged('crNo',this.value)"></div>
      <div class="sales-field"><label>Country</label>
        <select onchange="salesCustDraftChanged('country',this.value)">${COUNTRIES.map(x => `<option value="${x}" ${d.country === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      <div class="sales-field"><label>Opening Balance</label><input type="number" value="${d.openingBalance}" oninput="salesCustDraftChanged('openingBalance',Number(this.value))"></div>
      <div class="sales-field"><label>Sales Man</label>
        <select onchange="salesCustDraftChanged('salesMan',this.value)">${STAFF.map(x => `<option value="${x}" ${d.salesMan === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="primary" style="flex:1;" onclick="saveCustomerCreate()">Save and continue</button>
        <button class="secondary" style="flex:1;" onclick="salesView=salesDraft._returnTo||'enq-list';renderSalesBody();">Exit</button>
      </div>
    </div>`;
}

function saveCustomerCreate() {
  const d = salesDraft;
  const returnTo = d._returnTo;
  const result = createCustomer(d);
  if (result.error) { salesAlert(result.error); return; }
  salesAlert(result.possibleDuplicateOf
    ? `✓ Customer ${result.id} created — flagged as a possible duplicate of ${result.possibleDuplicateOf} for Accounts to review. You can keep working with it right away.`
    : `✓ Customer ${result.id} created.`);
  if (returnTo === 'enq-create') {
    salesDraft = { division: SALES_DIVISIONS[0], customerId: result.id, prospectName: '', contactPerson: result.contactPerson, tel: result.tel, email: result.email, requirements: '', source: ENQUIRY_SOURCES[0], salesPerson: STAFF[0] };
    salesView = 'enq-create';
  } else {
    salesDraft = null;
    salesView = returnTo || 'enq-list';
  }
  renderSalesBody();
}

// ── Enquiry Detail (Basic / Follow-up tabs) ──
function openEnquiryDetail(id) {
  salesActiveEnquiryId = id;
  salesActiveEnqTab = 'basic';
  salesView = 'enq-detail';
  renderSalesBody();
}
function salesSetEnqTab(t) { salesActiveEnqTab = t; renderSalesBody(); }

function renderEnquiryDetail() {
  const e = enquiries.find(x => x.id === salesActiveEnquiryId);
  if (!e) return `<p style="font-size:12.5px;color:#64748b;">Enquiry not found.</p>`;
  const locked = e.salesPerson !== salesCurrentUser;

  const tabs = `
    <div class="sales-tabs">
      <button class="sales-tabbtn ${salesActiveEnqTab === 'basic' ? 'active' : ''}" onclick="salesSetEnqTab('basic')">Basic</button>
      <button class="sales-tabbtn ${salesActiveEnqTab === 'followup' ? 'active' : ''}" onclick="salesSetEnqTab('followup')">Follow up</button>
    </div>`;

  let tabBody = '';
  if (salesActiveEnqTab === 'basic') {
    tabBody = `
      ${locked ? `<div class="sales-banner">Assigned Sales man can update this Enquiry (assigned to ${esc(e.salesPerson)}).</div>` : ''}
      <div class="sales-field"><label>Division</label><input class="${locked ? 'sales-locked' : ''}" type="text" value="${esc(e.division)}" ${locked ? 'disabled' : `onchange="salesUpdateEnquiryField('division',this.value)"`}></div>
      <div class="sales-field"><label>Customer</label><input class="sales-locked" type="text" value="${esc(e.customerId ? custName(e.customerId) : e.prospectName)}" disabled></div>
      <div class="sales-field"><label>Contact Person</label><input class="${locked ? 'sales-locked' : ''}" type="text" value="${esc(e.contactPerson)}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('contactPerson',this.value)"></div>
      <div class="sales-field"><label>Tel</label><input class="${locked ? 'sales-locked' : ''}" type="text" value="${esc(e.tel)}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('tel',this.value)"></div>
      <div class="sales-field"><label>Email</label><input class="${locked ? 'sales-locked' : ''}" type="email" value="${esc(e.email)}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('email',this.value)"></div>
      <div class="sales-field"><label>Requirements</label><textarea class="${locked ? 'sales-locked' : ''}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('requirements',this.value)">${esc(e.requirements)}</textarea></div>
      <div class="sales-field"><label>Source of Enquiry</label>
        <select class="${locked ? 'sales-locked' : ''}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('source',this.value)">${ENQUIRY_SOURCES.map(x => `<option value="${x}" ${e.source === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      <div class="sales-field"><label>Sales Person Assigned</label>
        <select class="${locked ? 'sales-locked' : ''}" ${locked ? 'disabled' : ''} onchange="salesUpdateEnquiryField('salesPerson',this.value)">${STAFF.map(x => `<option value="${x}" ${e.salesPerson === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      </div>
      ${!locked ? `<div style="display:flex;gap:8px;"><button class="primary" style="flex:1;" onclick="salesAlert('✓ Enquiry updated.')">Submit</button><button class="secondary" style="flex:1;" onclick="salesView='enq-list';renderSalesBody();">Exit</button></div>` : ''}
    `;
  } else {
    const historyHtml = e.followUps.length === 0
      ? `<p style="font-size:12.5px;color:#64748b;margin-bottom:12px;">No follow-ups logged yet.</p>`
      : `<table class="sales-items"><tr><th>Date</th><th>Meeting Type</th><th>Outcome</th><th></th></tr>` +
        e.followUps.map((f, i) => `<tr><td>${f.date}</td><td>${esc(f.meetingType)}</td><td>${esc(f.outcome)}</td><td title="${esc(f.notes)}" style="cursor:help;">👁</td></tr>`).join('') +
        `</table>`;

    const canConvert = canConvertToQuotation(e) && !e.linkedQuotationId && e.followUps.length > 0;

    tabBody = `
      ${historyHtml}
      <div class="sales-card" style="padding:12px;">
        <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Add Follow-up</p>
        <div class="sales-field"><label>Date of Appointment</label><input type="date" id="fu-date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="sales-field"><label>Meeting Type</label><select id="fu-type">${MEETING_TYPES.map(x => `<option value="${x}">${x}</option>`).join('')}</select></div>
        <div class="sales-field"><label>Outcome</label><select id="fu-outcome">${FOLLOWUP_OUTCOMES.map(x => `<option value="${x}">${x}</option>`).join('')}</select></div>
        <div class="sales-field"><label>Notes (min 10 characters)</label><textarea id="fu-notes"></textarea></div>
        <div style="display:flex;gap:8px;">
          <button class="primary" style="flex:1;" onclick="saveFollowUp()">Submit</button>
          <button class="secondary" style="flex:1;" onclick="salesView='enq-list';renderSalesBody();">Exit</button>
        </div>
      </div>
      ${e.linkedQuotationId ? `<button class="primary" style="width:100%;margin-top:10px;" onclick="openQuotationHub('${e.linkedQuotationId}')">View Quotation ${e.linkedQuotationId} →</button>`
        : canConvert ? `<button class="primary" style="width:100%;margin-top:10px;" onclick="startConvertToQuotation('${e.id}')">Convert Quotation</button>` : ''}
    `;
  }

  return `<span class="sales-back" onclick="salesView='enq-list';renderSalesBody();">‹ Back to Enquiry List</span>
    <p style="font-weight:700;font-size:14px;margin-bottom:6px;">${e.id}</p>
    ${tabs}<div class="sales-card">${tabBody}</div>`;
}

function salesUpdateEnquiryField(key, val) {
  const e = enquiries.find(x => x.id === salesActiveEnquiryId);
  if (e) e[key] = val;
}

function salesUpdateQtnField(key, val) {
  const q = quotations.find(x => x.id === salesActiveQtnId);
  if (q) q[key] = val;
}

function saveFollowUp() {
  const date = document.getElementById('fu-date').value;
  const meetingType = document.getElementById('fu-type').value;
  const outcome = document.getElementById('fu-outcome').value;
  const notes = document.getElementById('fu-notes').value;
  const result = addFollowUp(salesActiveEnquiryId, { date, meetingType, outcome, notes });
  if (result.error) { salesAlert(result.error); return; }
  salesAlert('✓ Follow-up added.');
  renderSalesBody();
}

// ══════════════════════════════════════════
// MODULE 2 — QUOTATION
// ══════════════════════════════════════════

function startConvertToQuotation(enquiryId) {
  const enq = enquiries.find(e => e.id === enquiryId);
  if (!enq) return;
  if (!canConvertToQuotation(enq)) { salesAlert('Please Select Customer To Proceed!!!'); return; }
  salesDraft = { enquiryId, projectName: '', taxPercent: 10, contactPerson: enq.contactPerson, notes: '' };
  salesWizardStep = 1;
  salesActiveQtnId = null;
  salesView = 'qtn-wizard';
  renderSalesBody();
}

function quotationMatchesFilters(q) {
  const f = salesQtnFilters;
  if (f.qtnNo && !q.id.toLowerCase().includes(f.qtnNo.toLowerCase())) return false;
  if (f.customer && !custName(q.customerId).toLowerCase().includes(f.customer.toLowerCase())) return false;
  if (f.project && !q.projectName.toLowerCase().includes(f.project.toLowerCase())) return false;
  if (f.salesPerson) {
    const enq = enquiries.find(e => e.id === q.enquiryId);
    if (!enq || enq.salesPerson !== f.salesPerson) return false;
  }
  if (f.tel) {
    const c = customers.find(x => x.id === q.customerId);
    if (!c || !c.tel.includes(f.tel)) return false;
  }
  return true;
}

function salesQtnFilterChanged(key, val) { salesQtnFilters[key] = val; renderSalesBody(); }
function salesSetQtnListTab(t) { salesQtnListTab = t; renderSalesBody(); }

function renderQuotationList() {
  const tabs = ['draft', 'open', 'confirmed', 'closed', 'all'];
  const rows = quotations.filter(quotationMatchesFilters)
    .filter(q => salesQtnListTab === 'all' || q.lifecycleStatus === salesQtnListTab)
    .slice().sort((a, b) => b.date.localeCompare(a.date));

  const tabsHtml = `<div class="sales-status-tabs">${tabs.map(t => `<button class="sales-status-tab st-${t} ${salesQtnListTab === t ? 'active' : ''}" onclick="salesSetQtnListTab('${t}')">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>`;

  const filterHtml = `
    <div class="sales-card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Qtn No</label><input type="text" value="${salesQtnFilters.qtnNo}" oninput="salesQtnFilterChanged('qtnNo',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>Customer</label><input type="text" value="${salesQtnFilters.customer}" oninput="salesQtnFilterChanged('customer',this.value)"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Project</label><input type="text" value="${salesQtnFilters.project}" oninput="salesQtnFilterChanged('project',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>Tel No</label><input type="text" value="${salesQtnFilters.tel}" oninput="salesQtnFilterChanged('tel',this.value)"></div>
      </div>
      <div class="sales-field" style="margin-top:8px;margin-bottom:0;"><label>Sales Person</label>
        <select onchange="salesQtnFilterChanged('salesPerson',this.value)">
          <option value="">All</option>${STAFF.map(s => `<option value="${s}" ${salesQtnFilters.salesPerson === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>`;

  const listHtml = rows.length === 0
    ? `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No quotations in this view. Quotations can only be created by converting an Enquiry.</p></div>`
    : rows.map(q => {
      const totals = computeQuotationTotals(q);
      const enq = enquiries.find(e => e.id === q.enquiryId);
      return `
      <div class="sales-card" style="cursor:pointer;" onclick="openQuotationHub('${q.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <p style="font-weight:700;font-size:13px;">${q.id} <span style="font-weight:400;color:#94a3b8;">· ${q.date}</span></p>
            <p style="font-size:12px;color:#334155;">${esc(custName(q.customerId))} · ${esc(q.projectName)}</p>
            <p style="font-size:11px;color:#64748b;">Salesman: ${esc(enq ? enq.salesPerson : '—')} · Amt: BD ${totals.netTotal.toFixed(3)}</p>
          </div>
          <div style="text-align:right;display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
            <span class="sales-pill ${q.lifecycleStatus}">${q.lifecycleStatus}</span>
            <span class="sales-pill stage-${q.stage}">${q.stage.toUpperCase()}</span>
          </div>
        </div>
      </div>`;
    }).join('');

  return tabsHtml + filterHtml + listHtml;
}

// ── Manage Quote hub ──
function openQuotationHub(id) {
  salesActiveQtnId = id;
  salesTopView = 'quotations';
  salesView = 'qtn-hub';
  renderSalesBody();
}

function renderQuotationHub() {
  const q = quotations.find(x => x.id === salesActiveQtnId);
  if (!q) return `<p style="font-size:12.5px;color:#64748b;">Quotation not found.</p>`;
  const totals = computeQuotationTotals(q);
  const enq = enquiries.find(e => e.id === q.enquiryId);
  const c = customers.find(x => x.id === q.customerId);

  return `
    <span class="sales-back" onclick="salesView='qtn-list';renderSalesBody();">‹ Back to Quotation List</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:15px;">${q.id} <span class="sales-pill ${q.lifecycleStatus}">${q.lifecycleStatus}</span> <span class="sales-pill stage-${q.stage}">${q.stage.toUpperCase()}</span></p>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">Client: ${esc(c ? c.name : '—')} · Project: ${esc(q.projectName)}</p>
      <p style="font-size:12px;color:#64748b;">Qtn Date: ${q.date} · Confirm Date: ${q.confirmDate || '—'} · Amount: BD ${totals.netTotal.toFixed(3)}</p>
      <p style="font-size:11px;color:#94a3b8;margin-top:4px;">${q.parentJobId ? `Variation for Job <b>${esc(q.parentJobId)}</b>` : `Linked Enquiry: ${esc(q.enquiryId)} · Salesman: ${esc(enq ? enq.salesPerson : '—')}`}</p>
    </div>
    <div class="sales-tile-row">
      ${q.stage === 'sales' ? `<div class="sales-tile t-blue" onclick="openQuotationWizard('${q.id}',1)"><span class="sales-tile-icon">✎</span>Edit Quote</div>` : ''}
      ${q.lifecycleStatus !== 'draft' ? `<div class="sales-tile t-purple" onclick="salesAlert('Print Quote — not wired to a document generator yet.')"><span class="sales-tile-icon">🖨</span>Print Quote</div>` : ''}
      <div class="sales-tile t-teal" onclick="salesAlert('Duplicate — not implemented yet.')"><span class="sales-tile-icon">⧉</span>Duplicate</div>
      <div class="sales-tile t-magenta" onclick="salesAlert('Discount — apply from the Product & Services step.')"><span class="sales-tile-icon">%</span>Discount</div>
    </div>
    ${q.stage !== 'sales' ? `<p style="font-size:10.5px;color:#94a3b8;margin:-8px 0 10px;">Edit Quote is locked while this is with the ${q.stage === 'estimator' ? 'Estimator' : 'Approver'} — it reopens once they send it back to Sales.</p>` : ''}
    ${q.lifecycleStatus === 'draft' && q.stage === 'sales' ? `<p style="font-size:10.5px;color:#94a3b8;margin:-8px 0 10px;">Print Quote becomes available once the Approver has approved this quote.</p>` : ''}
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Action</p>
      ${q.stage === 'sales' && q.lifecycleStatus === 'draft'
        ? `<button class="primary" style="width:100%;" onclick="salesTransferToEstimator('${q.id}')">Transfer to Estimator</button>` : ''}
      ${q.stage === 'sales' && q.lifecycleStatus === 'open'
        ? `<button class="primary" style="width:100%;" onclick="${q.parentJobId ? `salesConfirmVariation('${q.id}')` : `salesConfirmQuote('${q.id}')`}">${q.parentJobId ? 'Confirm Variation — Merge into Job' : 'Confirm Quote'}</button>` : ''}
      ${q.stage !== 'sales'
        ? `<p style="font-size:11.5px;color:#64748b;">This quotation is with ${q.stage === 'estimator' ? 'the Estimator' : 'the Approver'} — Sales has no action here until it's sent back.</p>` : ''}
      ${q.stage === 'estimator' ? `<p style="font-size:11px;color:#92400e;margin-top:8px;">${q.estimatorPickedBy ? 'Picked by ' + esc(q.estimatorPickedBy) : 'Not yet picked'} — see the Estimator module.</p>` : ''}
      ${q.stage === 'approver' ? `<p style="font-size:11px;color:#92400e;margin-top:8px;">${q.approverPickedBy ? 'Picked by ' + esc(q.approverPickedBy) : 'Not yet picked'} — see the Approver module.</p>` : ''}
      ${q.lifecycleStatus === 'confirmed' ? (() => {
        const job = q.parentJobId ? getJobCard(q.parentJobId) : jobCards.find(j => j.quotationId === q.id);
        if (!job) return '';
        const label = q.parentJobId ? `✓ Merged into Job Card <b>${esc(job.id)}</b>.` : `✓ Confirmed — Job Card <b>${esc(job.id)}</b> created.`;
        return `<p style="font-size:11.5px;color:#166534;margin-top:8px;">${label}</p><button class="secondary" style="width:100%;margin-top:6px;" onclick="closeSalesModule();setTimeout(()=>launchJobsModule('${job.id}'),150);">Open Job Card →</button>`;
      })() : ''}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Approver Comments</p>
      <p style="font-size:12px;color:#334155;">${q.headerComment ? esc(q.headerComment) : '(none yet)'}</p>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Items (${q.items.length})</p>
      ${q.items.length === 0 ? `<p style="font-size:12px;color:#64748b;">No line items yet — add them from Edit Quote → Product & Services.</p>` :
        `<table class="sales-items"><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Net</th></tr>` +
        q.items.map(it => `<tr><td>${esc(it.product)}</td><td>${it.qty}</td><td>${esc(it.unit)}</td><td>${it.rate.toFixed(3)}</td><td>${it.netAmount.toFixed(3)}</td></tr>`).join('') + `</table>`}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">File Manager</p>
      <p style="font-size:11.5px;color:#94a3b8;">No upload infrastructure in this app yet — Q-Pro's File Manager is not reproduced here.</p>
    </div>
    ${renderRelatedRecords(jobCards.find(j => j.quotationId === q.id))}
    ${renderQuotationAuditTable(q)}`;
}

// Shared by the Quotation Hub and the Job Card Management hub (jobs.js) —
// both render the identical set of linked-document mini-tables per the live
// trace's "hub" pattern. Takes the Job Card (or null if none exists yet,
// e.g. an unconfirmed quotation) since every one of these documents hangs
// off the Job Card, not the Quotation, once a job exists.
function renderRelatedRecords(job) {
  if (!job) {
    return `<div class="sales-card"><p style="font-weight:700;font-size:13px;margin-bottom:4px;">Related records</p><p style="font-size:11.5px;color:#94a3b8;">Invoices · Receipts · Credit Notes · Proforma · Delivery Notes — available once this quotation is confirmed and a Job Card exists.</p></div>`;
  }
  const invoices = getInvoicesForJob(job.id);
  const receipts = getReceiptsForJob(job.id);
  const creditNotes = getCreditNotesForJob(job.id);
  const proforma = getProformasForJob(job.id);
  const dnRows = job.deliveryNotes.length === 0 ? '' :
    `<p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Delivery Notes</p>
     <table class="sales-items"><tr><th>DN</th><th>Date</th><th>Lines</th></tr>${job.deliveryNotes.map(dn => `<tr><td>${esc(dn.id)}</td><td>${dn.date}</td><td>${dn.lines.length}</td></tr>`).join('')}</table>`;

  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Related records</p>
      <p style="font-weight:700;font-size:12px;margin:6px 0 4px;">Invoices</p>
      ${invoices.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No Invoice List Exist...</p>` :
        `<table class="sales-items"><tr><th>Invoice No.</th><th>Date</th><th>Amount</th><th>Received</th><th>Balance</th></tr>${invoices.map(inv => `<tr><td>${esc(inv.id)}</td><td>${inv.date}</td><td>${inv.totals.netTotal.toFixed(3)}</td><td>${(inv.paidAmount || 0).toFixed(3)}</td><td>${invoiceBalance(inv).toFixed(3)}</td></tr>`).join('')}</table>`}
      <p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Receipts</p>
      ${receipts.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No Invoice List Exist...</p>` :
        `<table class="sales-items"><tr><th>Receipt No.</th><th>Date</th><th>Amount</th></tr>${receipts.map(r => `<tr><td>${esc(r.id)}</td><td>${r.receiptDate}</td><td>${r.amount.toFixed(3)}</td></tr>`).join('')}</table>`}
      <p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Credit Notes</p>
      ${creditNotes.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No Invoice List Exist...</p>` :
        `<table class="sales-items"><tr><th>Credit Note No.</th><th>Date</th><th>Amount</th><th>Status</th></tr>${creditNotes.map(cn => `<tr style="${cn.status === 'cancelled' ? 'background:#fee2e2;' : ''}"><td>${esc(cn.id)}</td><td>${cn.creditNoteDate}</td><td>${cn.amount.toFixed(3)}</td><td>${cn.status}</td></tr>`).join('')}</table>`}
      <p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Proforma</p>
      ${proforma.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No Proforma generated yet.</p>` :
        `<table class="sales-items"><tr><th>Proforma No.</th><th>Date</th><th>Amount</th></tr>${proforma.map(p => `<tr><td>${esc(p.id)}</td><td>${p.date}</td><td>${p.totals.netTotal.toFixed(3)}</td></tr>`).join('')}</table>`}
      ${dnRows}
    </div>`;
}

// Shared across every Manage Quote hub view (Sales/Estimator/Approver all
// render the same log at the bottom of the page) — one running trail of
// every status transition, per the live reference.
function renderQuotationAuditTable(qtn) {
  const log = qtn.auditLog || [];
  const rows = log.map(r => `<tr><td>${r.seq}</td><td>${esc(r.action)}</td><td>${esc(r.user)}</td><td>${r.date}</td><td>${esc(r.userType)}</td><td>${esc(r.status)}</td></tr>`).join('');
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Audit Trail</p>
      <table class="sales-items"><tr><th>#</th><th>Action</th><th>User</th><th>Date</th><th>User Type</th><th>Status</th></tr>${rows}</table>
    </div>`;
}

// Matches the live confirmation copy exactly ("Do you Want to Change Status?").
// Sales only ever transfers forward to Estimator — it can't jump straight to
// Approver (that's Estimator's own action) or re-send to itself.
function salesTransferToEstimator(qtnId) {
  if (!window.confirm('Do you Want to Change Status?')) return;
  transferQuotationStage(qtnId, 'estimator', salesCurrentUser);
  salesAlert('✓ Transferred to Estimator.');
  renderSalesBody();
}

// Creates the Job Card — the bridge into Module 5 (Jobs). Matches the live
// confirmation copy used for every other status change in this loop.
function salesConfirmQuote(qtnId) {
  if (!window.confirm('Do you Want to Change Status?')) return;
  const result = confirmQuotationToJobCard(qtnId, salesCurrentUser);
  if (result.error) { salesAlert(result.error); return; }
  salesAlert(`✓ Quotation confirmed — Job Card ${result.id} created.`);
  renderSalesBody();
}

// Variation Order equivalent of salesConfirmQuote() — merges into the
// EXISTING parent Job Card instead of creating a new one.
function salesConfirmVariation(qtnId) {
  if (!window.confirm('Do you Want to Change Status?')) return;
  const result = confirmVariationToJobCard(qtnId, salesCurrentUser);
  if (result.error) { salesAlert(result.error); return; }
  salesAlert(`✓ Variation approved and merged into Job Card ${result.id}.`);
  renderSalesBody();
}

// ── Edit Quote wizard (3 steps) ──
function openQuotationWizard(id, step) {
  salesActiveQtnId = id;
  salesWizardStep = step || 1;
  salesView = 'qtn-wizard';
  renderSalesBody();
}

function renderQuotationWizard() {
  const isNew = !salesActiveQtnId;
  const steps = ['Client & Project', 'Product & Services', 'Finalise'];
  const stepBar = `<div class="sales-wizard-steps">${steps.map((s, i) => `<div class="sales-wizard-step ${salesWizardStep === i + 1 ? 'active' : (isNew ? '' : 'done')}">${i + 1}. ${s}</div>`).join('')}</div>`;

  let body = '';
  if (salesWizardStep === 1) body = renderWizardStep1(isNew);
  else if (salesWizardStep === 2) body = renderWizardStep2();
  else body = renderWizardStep3();

  return `<span class="sales-back" onclick="${isNew ? `salesView='enq-list';` : `openQuotationHub('${salesActiveQtnId}');`}renderSalesBody();">‹ Back</span>${stepBar}${body}`;
}

function renderWizardStep1(isNew) {
  if (isNew) {
    const d = salesDraft;
    const enq = enquiries.find(e => e.id === d.enquiryId);
    const c = customers.find(x => x.id === enq.customerId);
    return `
      <div class="sales-preview">
        <p style="font-weight:700;color:#1a1f2e;margin-bottom:6px;">Enquiry Details (read-only)</p>
        <p><b>Enquiry No:</b> ${esc(enq.id)}</p>
        <p><b>Customer Name:</b> ${esc(c.name)}</p>
        <p><b>Customer Code:</b> ${esc(c.id)}</p>
        <p><b>Telephone:</b> ${esc(c.tel)}</p>
        <p><b>Email:</b> ${esc(c.email)}</p>
        <p><b>Address:</b> ${esc(c.address)}</p>
        <p><b>Contact Person:</b> ${esc(enq.contactPerson)}</p>
        <p><b>VAT Name/No:</b> ${esc(c.vatName)} / ${esc(c.vatNo)}</p>
      </div>
      <div class="sales-card">
        <div class="sales-field"><label>Tax %</label><input type="number" value="${d.taxPercent}" oninput="salesDraft.taxPercent=Number(this.value)"></div>
        <div class="sales-field"><label>Project Name</label><input type="text" value="${esc(d.projectName)}" oninput="salesDraft.projectName=this.value"></div>
        <div class="sales-field"><label>Contact Person</label><input type="text" value="${esc(d.contactPerson)}" oninput="salesDraft.contactPerson=this.value"></div>
        <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Pricing is always completed by the Estimator — Sales never enters a Rate.</p>
        <div class="sales-field"><label>Notes</label><textarea oninput="salesDraft.notes=this.value">${esc(d.notes)}</textarea></div>
        <button class="primary" style="width:100%;" onclick="saveWizardStep1()">Save & Proceed</button>
      </div>`;
  }
  const q = quotations.find(x => x.id === salesActiveQtnId);
  const enq = enquiries.find(e => e.id === q.enquiryId);
  const c = customers.find(x => x.id === q.customerId);
  return `
    <div class="sales-preview">
      <p style="font-weight:700;color:#1a1f2e;margin-bottom:6px;">Enquiry Details (read-only)</p>
      <p><b>Enquiry No:</b> ${esc(enq.id)}</p>
      <p><b>Customer Name:</b> ${esc(c.name)}</p>
      <p><b>Customer Code:</b> ${esc(c.id)}</p>
      <p><b>Telephone:</b> ${esc(c.tel)}</p>
      <p><b>Email:</b> ${esc(c.email)}</p>
      <p><b>Address:</b> ${esc(c.address)}</p>
      <p><b>Contact Person:</b> ${esc(enq.contactPerson)}</p>
      <p><b>VAT Name/No:</b> ${esc(c.vatName)} / ${esc(c.vatNo)}</p>
    </div>
    <div class="sales-card">
      <div class="sales-field"><label>Tax %</label><input type="number" value="${q.taxPercent}" onchange="salesUpdateQtnField('taxPercent',Number(this.value))"></div>
      <div class="sales-field"><label>Project Name</label><input type="text" value="${esc(q.projectName)}" onchange="salesUpdateQtnField('projectName',this.value)"></div>
      <div class="sales-field"><label>Contact Person</label><input type="text" value="${esc(q.contactPerson)}" onchange="salesUpdateQtnField('contactPerson',this.value)"></div>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Pricing is always completed by the Estimator — Sales never enters a Rate.</p>
      <div class="sales-field"><label>Notes</label><textarea onchange="salesUpdateQtnField('notes',this.value)">${esc(q.notes)}</textarea></div>
      <button class="primary" style="width:100%;" onclick="salesWizardStep=2;renderSalesBody();">Save & Proceed</button>
    </div>`;
}

function saveWizardStep1() {
  const d = salesDraft;
  if (!d.projectName) { salesAlert('Project Name is required.'); return; }
  const result = convertEnquiryToQuotation(d.enquiryId, d);
  if (result.error) { salesAlert(result.error); return; }
  salesAlert(`✓ Quotation ${result.id} created.`);
  salesActiveQtnId = result.id;
  salesDraft = null;
  salesWizardStep = 2;
  renderSalesBody();
}

function renderWizardStep2() {
  const q = quotations.find(x => x.id === salesActiveQtnId);
  const totals = computeQuotationTotals(q);
  const locked = q.withEstimation;

  const rowsHtml = q.items.length === 0
    ? `<p style="font-size:12px;color:#64748b;margin-bottom:10px;">No items added yet.</p>`
    : `<table class="sales-items"><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Net</th><th></th></tr>` +
      q.items.map(it => `<tr><td>${esc(it.product)}</td><td>${it.qty}</td><td>${esc(it.unit)}</td><td>${it.rate.toFixed(3)}</td><td>${it.netAmount.toFixed(3)}</td>
        <td><span style="cursor:pointer;color:var(--biz-primary);margin-right:8px;" onclick="salesToggleEditItem(${it.lineId})" title="Edit">✎</span><span style="cursor:pointer;color:var(--biz-primary);margin-right:8px;" onclick="salesDuplicateItem('${q.id}',${it.lineId})" title="Duplicate">⧉</span><span style="cursor:pointer;color:#b91c1c;" onclick="salesRemoveItem('${q.id}',${it.lineId})" title="Remove">✕</span></td></tr>` +
        (salesEditingLineId === it.lineId ? `<tr><td colspan="6">${renderSalesItemEditPanel(q, it)}</td></tr>` : '')
      ).join('') +
      `</table>`;

  return `
    ${q.headerComment ? `<div class="sales-preview"><p style="font-weight:700;color:#1a1f2e;margin-bottom:4px;">Approver Comments</p><p>${esc(q.headerComment)}</p></div>` : ''}
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Add Item</p>
      ${locked ? `<div class="sales-banner">Rate/Amount/Net Amount are locked at 0.000 for Sales — pricing is always completed by the Estimator.</div>` : ''}
      <div class="sales-field"><label>Product/Service</label><input type="text" id="it-product"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field"><label>Qty</label><input type="number" id="it-qty" value="1"></div>
        <div class="sales-field"><label>Unit</label><select id="it-unit">${units.map(u => `<option value="${u.name}">${u.name}</option>`).join('')}</select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field"><label>Rate</label><input class="${locked ? 'sales-locked' : ''}" type="number" id="it-rate" ${locked ? 'disabled value="0"' : 'value="0"'}></div>
        <div class="sales-field"><label>Vat%</label><input type="number" id="it-vat" value="${q.taxPercent}"></div>
      </div>
      <div class="sales-field"><label>Disc%</label><input type="number" id="it-disc" value="0"></div>
      <div class="sales-field"><label>Description</label><textarea id="it-desc"></textarea></div>
      <div class="sales-field"><label>Internal Comments</label><textarea id="it-comments"></textarea></div>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Image upload not wired — no upload infrastructure in this app yet.</p>
      <button class="primary" style="width:100%;" onclick="salesAddItem('${q.id}')">Add Item</button>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Items</p>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Once a quotation has been to the Estimator, use ✎ to adjust Qty/Description/Internal Comments — Rate stays Estimator-controlled.</p>
      ${rowsHtml}
      <div style="font-size:12px;color:#334155;">
        <p>Item Total: BD ${totals.itemTotal.toFixed(3)}</p>
        <p>Discount: BD ${totals.discTotal.toFixed(3)}</p>
        <p>Gross Amount: BD ${(totals.itemTotal - totals.discTotal).toFixed(3)}</p>
        <p>VAT: BD ${totals.vatTotal.toFixed(3)}</p>
        <p style="font-weight:700;">Net Amount: BD ${totals.netTotal.toFixed(3)}</p>
      </div>
    </div>
    <button class="primary" style="width:100%;" onclick="salesWizardStep=3;renderSalesBody();">Save & Proceed</button>`;
}

function renderSalesItemEditPanel(qtn, item) {
  return `
    <div style="background:#f4e6ec;border-radius:8px;padding:10px;margin:4px 0;">
      ${item.approverComment ? `<p style="font-size:11px;color:#92400e;margin-bottom:8px;"><b>Approver comment on this line:</b> ${esc(item.approverComment)}</p>` : ''}
      <div class="sales-field"><label>Qty</label><input type="number" value="${item.qty}" onchange="salesUpdateItemField(${item.lineId},'qty',Number(this.value))"></div>
      <div class="sales-field"><label>Description</label><textarea onchange="salesUpdateItemField(${item.lineId},'description',this.value)">${esc(item.description)}</textarea></div>
      <div class="sales-field"><label>Internal Comments</label><textarea onchange="salesUpdateItemField(${item.lineId},'internalComments',this.value)">${esc(item.internalComments)}</textarea></div>
      <button class="secondary" style="width:100%;" onclick="salesToggleEditItem(${item.lineId})">Done</button>
    </div>`;
}
function salesToggleEditItem(lineId) { salesEditingLineId = salesEditingLineId === lineId ? null : lineId; renderSalesBody(); }
function salesUpdateItemField(lineId, key, val) {
  updateQuotationItemFields(salesActiveQtnId, lineId, { [key]: val });
  renderSalesBody();
}

function salesAddItem(qtnId) {
  const product = document.getElementById('it-product').value;
  if (!product) { salesAlert('Product/Service is required.'); return; }
  addQuotationItem(qtnId, {
    product,
    qty: Number(document.getElementById('it-qty').value),
    unit: document.getElementById('it-unit').value,
    rate: Number(document.getElementById('it-rate').value),
    vatPercent: Number(document.getElementById('it-vat').value),
    discPercent: Number(document.getElementById('it-disc').value),
    description: document.getElementById('it-desc').value,
    internalComments: document.getElementById('it-comments').value
  });
  renderSalesBody();
}
function salesRemoveItem(qtnId, lineId) { removeQuotationItem(qtnId, lineId); renderSalesBody(); }

// Duplicate — Salman's real ask: a way to copy an existing line item
// (same product/qty/unit/description) as a starting point for a similar
// one, rather than retyping everything from scratch. Rate/amount stay
// locked at 0 like any new item (pricing is always Estimator-controlled),
// same as addQuotationItem() already enforces.
function salesDuplicateItem(qtnId, lineId) {
  const qtn = quotations.find(q => q.id === qtnId);
  const item = qtn && qtn.items.find(it => it.lineId === lineId);
  if (!item) return;
  addQuotationItem(qtnId, {
    product: item.product, qty: item.qty, unit: item.unit,
    vatPercent: item.vatPercent, discPercent: item.discPercent,
    description: item.description, internalComments: item.internalComments
  });
  salesAlert('✓ Item duplicated.');
  renderSalesBody();
}

function renderWizardStep3() {
  const q = quotations.find(x => x.id === salesActiveQtnId);
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">File Manager</p>
      <p style="font-size:11.5px;color:#94a3b8;">No upload infrastructure in this app yet.</p>
    </div>
    <div class="sales-card">
      <div class="sales-field"><label>Covering Letter template</label>
        <select id="fin-covering">
          <option value="">— None —</option>
          ${Object.keys(COVERING_LETTER_TEMPLATES).map(t => `<option value="${t}" ${q.coveringLetterTemplate === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="sales-field"><label>Terms & Conditions template</label>
        <select id="fin-terms">
          <option value="">— None —</option>
          ${Object.keys(TERMS_TEMPLATES).map(t => `<option value="${t}" ${q.termsTemplate === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <button class="primary" style="width:100%;" onclick="saveWizardStep3()">Update Quotation</button>
    </div>`;
}

function saveWizardStep3() {
  const covering = document.getElementById('fin-covering').value;
  const terms = document.getElementById('fin-terms').value;
  finaliseQuotation(salesActiveQtnId, { coveringLetterTemplate: covering, termsTemplate: terms });
  salesAlert('Quotation Status Updated successfully');
  openQuotationHub(salesActiveQtnId);
}

// ══════════════════════════════════════════
// SALES DASHBOARD — the module's landing tab
// ══════════════════════════════════════════
function renderSalesDashboard() {
  const k = getSalesKPIs();
  return `
    <div class="sales-kpi-grid">
      <div class="sales-kpi-tile" style="cursor:pointer;" onclick="salesSetTopView('enquiries');salesEnqFilterChanged('unassigned',true);"><div class="num">${k.unallocated}</div><div class="lbl">Un-allocated</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.inProgress}</div><div class="lbl">In-Progress</div></div>
      <div class="sales-kpi-tile" style="cursor:pointer;" onclick="salesSetTopView('quotations');"><div class="num">${k.openQuotations}</div><div class="lbl">Open Quotations</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.withEstimator}</div><div class="lbl">With Estimator</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.withApprover}</div><div class="lbl">With Approver</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.jobsPending}</div><div class="lbl">Jobs Pending</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.jobsOngoing}</div><div class="lbl">Jobs On-going</div></div>
      <div class="sales-kpi-tile" style="cursor:pointer;" onclick="closeSalesModule();setTimeout(()=>launchJobsModule(),150);"><div class="num">${k.toInvoice}</div><div class="lbl">To Invoice</div></div>
      <div class="sales-kpi-tile"><div class="num">BD ${k.receivables.toFixed(3)}</div><div class="lbl">Receivables</div></div>
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
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Quick Actions</p>
      <div style="display:flex;gap:8px;">
        <button class="primary" style="flex:1;" onclick="salesSetTopView('enquiries');openEnquiryCreate();">+ Create Enquiry</button>
        <button class="secondary" style="flex:1;" onclick="salesSetTopView('quotations');">View Quotations</button>
      </div>
    </div>`;
}

// Was written but never actually wired into any dashboard UI — the Sales
// module opened straight to the Enquiry List with no landing KPI view.
// Expanded to match the KPI list from Salman's design notes (Enquiries Un-
// allocated/In-Progress, Quotations pipeline stage, Jobs, To Invoice,
// Receivables, PR) and now rendered by renderSalesDashboard() above.
function getSalesKPIs() {
  const unallocated = enquiries.filter(e => !e.salesPerson).length;
  const inProgress = enquiries.filter(e => e.salesPerson && !e.linkedQuotationId).length;
  const openQuotations = quotations.filter(q => q.lifecycleStatus !== 'closed').length;
  const withEstimator = quotations.filter(q => q.stage === 'estimator').length;
  const withApprover = quotations.filter(q => q.stage === 'approver').length;

  // Job Card only tracks whole-item deliveredQty, not a distinct "ongoing"
  // flag — Pending = nothing delivered yet, On-going = partially delivered.
  // Not confirmed against Q-Pro's own exact Pending/On-going definition.
  const openJobs = typeof jobCards !== 'undefined' ? jobCards.filter(j => j.status === 'open') : [];
  const jobsPending = openJobs.filter(j => j.items.every(it => it.deliveredQty === 0)).length;
  const jobsOngoing = openJobs.length - jobsPending;

  // "To Invoice" = an open/completed job with no Tax Invoice generated yet.
  const toInvoice = typeof jobCards !== 'undefined' && typeof getInvoicesForJob === 'function'
    ? jobCards.filter(j => j.status !== 'cancelled' && getInvoicesForJob(j.id).length === 0).length : 0;
  // Receivables — sum of each invoice's real outstanding balance (Net Total
  // minus Batch 4's Receipt paidAmount and Credit Note creditedAmount).
  // Previously summed the full netTotal since no payment tracking existed —
  // corrected now that Sales Receipt/Credit Note actually net things off.
  const receivables = typeof taxInvoices !== 'undefined' ? taxInvoices.reduce((s, inv) => s + invoiceBalance(inv), 0) : 0;

  const prPending = typeof purchaseRequests !== 'undefined' ? purchaseRequests.filter(pr => pr.status === 'open').length : 0;
  const prNotReceived = typeof purchaseOrders !== 'undefined' ? purchaseOrders.filter(po => po.status === 'issued').length : 0;

  function divisionCategory(div) {
    if (div === 'Curtain & Blinds') return 'curtain';
    if (div === 'Upholstery') return 'upholstery';
    return 'joinery';
  }
  const categoryBreakdown = { curtain: 0, upholstery: 0, joinery: 0 };
  enquiries.forEach(e => categoryBreakdown[divisionCategory(e.division)]++);

  return {
    unallocated, inProgress, openQuotations, withEstimator, withApprover,
    jobsPending, jobsOngoing, toInvoice, receivables, prPending, prNotReceived,
    categoryBreakdown
  };
}

// ══════════════════════════════════════════
// Batch 7 (3 Aug 2026): Proforma, Sales Receipt, Sales Credit Note, and
// Customer Update all moved to accounts.js — Salman's call: Sales never
// creates/edits/deletes these, only views them read-only via
// renderRelatedRecords() above (still here, called from both this file
// and jobs.js). See accounts.js for the moved create/list functions.
// ══════════════════════════════════════════

function renderSalesReports() {
  return renderQuotationRegisterReport();
}

function salesQtnRegFilterChanged(key, val) { salesQtnRegFilters[key] = val; renderSalesBody(); }

function renderQuotationRegisterReport() {
  const f = salesQtnRegFilters;
  const rows = quotations.filter(q => {
    if (f.from && q.date < f.from) return false;
    if (f.to && q.date > f.to) return false;
    if (f.status !== 'All' && q.lifecycleStatus !== f.status.toLowerCase()) return false;
    if (f.salesPerson) {
      const enq = enquiries.find(e => e.id === q.enquiryId);
      if (!enq || enq.salesPerson !== f.salesPerson) return false;
    }
    return true;
  }).slice().sort((a, b) => b.date.localeCompare(a.date));

  return `
    <div class="sales-card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Division</label><input type="text" value="Al Maraya Decor" disabled></div>
        <div class="sales-field" style="margin-bottom:0;"><label>Status</label>
          <select onchange="salesQtnRegFilterChanged('status',this.value)">
            ${['All', 'Draft', 'Open', 'Closed', 'Confirmed'].map(s => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>From Date</label><input type="date" value="${f.from}" onchange="salesQtnRegFilterChanged('from',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>To Date</label><input type="date" value="${f.to}" onchange="salesQtnRegFilterChanged('to',this.value)"></div>
      </div>
      <div class="sales-field" style="margin-top:8px;margin-bottom:0;"><label>Select Salesman</label>
        <select onchange="salesQtnRegFilterChanged('salesPerson',this.value)">
          <option value="">All</option>${STAFF.map(s => `<option value="${s}" ${f.salesPerson === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <p style="font-size:10.5px;color:#94a3b8;margin-top:8px;">Legend: <span class="sales-pill draft">Draft</span> <span class="sales-pill open">Open</span> <span class="sales-pill confirmed">Confirmed</span> <span class="sales-pill closed">Closed</span></p>
    </div>
    <div class="sales-card" style="overflow-x:auto;">
      ${rows.length === 0 ? `<p style="font-size:12.5px;color:#64748b;">No quotations match these filters.</p>` :
        `<table class="sales-items"><tr><th>#</th><th>Qtn No</th><th>Date</th><th>Confirmed Date</th><th>Client</th><th>Project</th><th>Salesman</th><th>Amount</th><th>Status</th></tr>
        ${rows.map((q, i) => {
          const totals = computeQuotationTotals(q);
          const enq = enquiries.find(e => e.id === q.enquiryId);
          return `<tr><td>${i + 1}</td><td>${esc(q.id)}</td><td>${q.date}</td><td>${q.confirmDate || '—'}</td><td>${esc(custName(q.customerId))}</td><td>${esc(q.projectName)}</td><td>${esc(enq ? enq.salesPerson : '—')}</td><td>BD ${totals.netTotal.toFixed(3)}</td><td><span class="sales-pill ${q.lifecycleStatus}">${q.lifecycleStatus}</span></td></tr>`;
        }).join('')}
        </table>`}
    </div>`;
}
