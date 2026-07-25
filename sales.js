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
#sales-module-wrap { font-family: inherit; }
#sales-module-wrap .ops-header{background:#7c3aed;padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#sales-module-wrap .sales-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#sales-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
#sales-module-wrap .sales-kpi-tile{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center;}
#sales-module-wrap .sales-kpi-tile .num{font-size:20px;font-weight:800;color:#7c3aed;}
#sales-module-wrap .sales-kpi-tile .lbl{font-size:10.5px;color:#64748b;margin-top:2px;}
#sales-module-wrap .sales-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px;}
#sales-module-wrap .sales-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:20px;background:#f1f5f9;color:#64748b;}
#sales-module-wrap .sales-pill.draft{background:#f1f5f9;color:#64748b;}
#sales-module-wrap .sales-pill.open{background:#dbeafe;color:#1e40af;}
#sales-module-wrap .sales-pill.confirmed{background:#dcfce7;color:#166534;}
#sales-module-wrap .sales-pill.closed{background:#e2e8f0;color:#475569;}
#sales-module-wrap .sales-pill.stage-sales{background:#ede9fe;color:#5b21b6;}
#sales-module-wrap .sales-pill.stage-estimator{background:#fef3c7;color:#92400e;}
#sales-module-wrap .sales-pill.stage-approver{background:#fee2e2;color:#991b1b;}
#sales-module-wrap .sales-search{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box;}
#sales-module-wrap button.primary{background:#7c3aed;color:#fff;border:0;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
#sales-module-wrap button.secondary{background:none;border:1px solid #e2e8f0;border-radius:8px;color:#475569;font-size:13px;padding:9px 18px;cursor:pointer;font-family:inherit;}
#sales-module-wrap .sales-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#sales-module-wrap .sales-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer;font-family:inherit;}
#sales-module-wrap .sales-tabbtn.active{background:#7c3aed;border-color:#7c3aed;color:#fff;}
#sales-module-wrap .sales-toptabs{display:flex;gap:0;margin:-16px -18px 16px;background:#fff;border-bottom:1px solid #e2e8f0;}
#sales-module-wrap .sales-toptab{flex:1;text-align:center;padding:12px 8px;font-size:13px;font-weight:700;color:#94a3b8;cursor:pointer;border-bottom:2px solid transparent;}
#sales-module-wrap .sales-toptab.active{color:#7c3aed;border-bottom-color:#7c3aed;}
#sales-module-wrap .sales-field{margin-bottom:10px;}
#sales-module-wrap .sales-field label{font-size:11px;color:#64748b;display:block;margin-bottom:3px;}
#sales-module-wrap .sales-field input, #sales-module-wrap .sales-field select, #sales-module-wrap .sales-field textarea{width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit;}
#sales-module-wrap .sales-field textarea{min-height:70px;resize:vertical;}
#sales-module-wrap .sales-banner{background:#fef3c7;color:#92400e;font-size:12px;padding:9px 12px;border-radius:8px;margin-bottom:12px;font-weight:600;}
#sales-module-wrap .sales-preview{background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:12px;margin-bottom:14px;}
#sales-module-wrap .sales-preview p{font-size:12px;margin:2px 0;color:#475569;}
#sales-module-wrap .sales-preview b{color:#1a1f2e;}
#sales-module-wrap .sales-wizard-steps{display:flex;gap:4px;margin-bottom:16px;}
#sales-module-wrap .sales-wizard-step{flex:1;text-align:center;font-size:10.5px;font-weight:700;padding:8px 4px;border-radius:8px;background:#f1f5f9;color:#94a3b8;}
#sales-module-wrap .sales-wizard-step.active{background:#7c3aed;color:#fff;}
#sales-module-wrap .sales-wizard-step.done{background:#ede9fe;color:#5b21b6;}
#sales-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:10px;}
#sales-module-wrap table.sales-items th{text-align:left;padding:6px;background:#f8fafc;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;}
#sales-module-wrap table.sales-items td{padding:6px;border-bottom:1px solid #f1f5f9;}
#sales-module-wrap .sales-locked{background:#f8fafc !important;color:#94a3b8 !important;}
#sales-module-wrap .sales-tile-row{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;}
#sales-module-wrap .sales-tile{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center;font-size:12px;font-weight:700;color:#475569;cursor:pointer;}
#sales-module-wrap .sales-back{font-size:12px;color:#7c3aed;font-weight:700;cursor:pointer;margin-bottom:10px;display:inline-block;}
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
        <div style="color:#ede9fe;font-size:11px;">Enquiry → Quotation</div>
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
let salesTopView = 'enquiries';        // 'enquiries' | 'quotations'
let salesView = 'enq-list';            // enq-list | enq-create | enq-detail | cust-create | qtn-list | qtn-hub | qtn-wizard
let salesActiveEnquiryId = null;
let salesActiveQtnId = null;
let salesActiveEnqTab = 'basic';       // basic | followup
let salesWizardStep = 1;
let salesEnqFilters = { from: '', to: '', customer: '', salesPerson: '', unassigned: false, unattended: false, unquoted: false };
let salesQtnFilters = { qtnNo: '', customer: '', project: '', tel: '', salesPerson: '' };
let salesQtnListTab = 'all';           // draft | open | confirmed | closed | all
let salesDraft = null;                 // scratch object for create forms
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
  ['purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  salesModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:#f7f9fc;';
  salesTopView = 'enquiries';
  salesView = 'enq-list';
  renderSalesBody();
}
function closeSalesModule() {
  salesModuleWrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}
function launchEnquiryModule() { openSalesModule(); }
function launchSalesModule() { openSalesModule(); }

function salesSetTopView(v) {
  salesTopView = v;
  salesView = v === 'enquiries' ? 'enq-list' : 'qtn-list';
  renderSalesBody();
}

function renderSalesBody() {
  const body = document.getElementById('sales-body');
  if (!body) return;
  const topTabs = `
    <div class="sales-toptabs">
      <div class="sales-toptab ${salesTopView === 'enquiries' ? 'active' : ''}" onclick="salesSetTopView('enquiries')">Enquiry</div>
      <div class="sales-toptab ${salesTopView === 'quotations' ? 'active' : ''}" onclick="salesSetTopView('quotations')">Quotation</div>
    </div>`;

  let content = '';
  switch (salesView) {
    case 'enq-list': content = renderEnquiryList(); break;
    case 'enq-create': content = renderEnquiryCreate(); break;
    case 'cust-create': content = renderCustomerCreate(); break;
    case 'enq-detail': content = renderEnquiryDetail(); break;
    case 'qtn-list': content = renderQuotationList(); break;
    case 'qtn-hub': content = renderQuotationHub(); break;
    case 'qtn-wizard': content = renderQuotationWizard(); break;
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
  salesAlert(`✓ Customer ${result.id} created.`);
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
  salesDraft = { enquiryId, projectName: '', taxPercent: 10, contactPerson: enq.contactPerson, withEstimation: false, notes: '' };
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

  const tabsHtml = `<div class="sales-tabs">${tabs.map(t => `<button class="sales-tabbtn ${salesQtnListTab === t ? 'active' : ''}" onclick="salesSetQtnListTab('${t}')">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>`;

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
      <p style="font-size:11px;color:#94a3b8;margin-top:4px;">Linked Enquiry: ${esc(q.enquiryId)} · Salesman: ${esc(enq ? enq.salesPerson : '—')}</p>
    </div>
    <div class="sales-tile-row">
      <div class="sales-tile" onclick="openQuotationWizard('${q.id}',1)">Edit Quote</div>
      <div class="sales-tile" onclick="salesAlert('Print Quote — not wired to a document generator yet.')">Print Quote</div>
      <div class="sales-tile" onclick="salesAlert('Duplicate — not implemented yet.')">Duplicate</div>
      <div class="sales-tile" onclick="salesAlert('Discount — apply from the Product & Services step.')">Discount</div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Action</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${q.stage === 'sales' ? `<button class="secondary" style="flex:1;" onclick="salesTransferToEstimator('${q.id}')">Transfer to Estimator</button>` : ''}
        ${q.stage !== 'sales' ? `<button class="secondary" style="flex:1;" onclick="salesTransferStage('${q.id}','sales')">Back to Sales</button>` : ''}
        ${q.stage !== 'approver' ? `<button class="primary" style="flex:1;" onclick="salesTransferStage('${q.id}','approver')">Transfer to Approver</button>` : ''}
      </div>
      ${q.stage === 'estimator' ? `<p style="font-size:11px;color:#92400e;margin-top:8px;">Sitting in Estimator stage${q.pickedBy ? ' · picked by ' + esc(q.pickedBy) : ' · not yet picked'} — Estimator is now its own module (see the ecosystem hub).</p>` : ''}
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
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Related records</p>
      <p style="font-size:11.5px;color:#94a3b8;">Invoices · Receipts · Credit Notes · Jobs · Proforma · Delivery Notes — not built in this app.</p>
    </div>`;
}

function salesTransferStage(qtnId, stage) {
  transferQuotationStage(qtnId, stage);
  salesAlert(`✓ Transferred to ${stage === 'approver' ? 'Approver' : 'Sales'}.`);
  renderSalesBody();
}

// Matches the live confirmation copy exactly ("Do you Want to Change Status?").
function salesTransferToEstimator(qtnId) {
  if (!window.confirm('Do you Want to Change Status?')) return;
  transferQuotationStage(qtnId, 'estimator');
  salesAlert('✓ Transferred to Estimator.');
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
        <div class="sales-field"><label><input type="checkbox" ${d.withEstimation ? 'checked' : ''} onchange="salesDraft.withEstimation=this.checked"> Quote Type: With Estimation</label></div>
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
      <div class="sales-field"><label><input type="checkbox" ${q.withEstimation ? 'checked' : ''} disabled> Quote Type: With Estimation (locked after creation)</label></div>
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
      q.items.map(it => `<tr><td>${esc(it.product)}</td><td>${it.qty}</td><td>${esc(it.unit)}</td><td>${it.rate.toFixed(3)}</td><td>${it.netAmount.toFixed(3)}</td><td><span style="cursor:pointer;color:#b91c1c;" onclick="salesRemoveItem('${q.id}',${it.lineId})">✕</span></td></tr>`).join('') +
      `</table>`;

  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Add Item</p>
      ${locked ? `<div class="sales-banner">With Estimation is checked — Rate/Amount/Net Amount are locked at 0.000 for Sales. Pricing will be completed by the Estimator.</div>` : ''}
      <div class="sales-field"><label>Product/Service</label><input type="text" id="it-product"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field"><label>Qty</label><input type="number" id="it-qty" value="1"></div>
        <div class="sales-field"><label>Unit</label><select id="it-unit">${QUOTE_UNITS.map(u => `<option value="${u}">${u}</option>`).join('')}</select></div>
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
// DASHBOARD KPIs — used by shell.js hub panel if needed later
// ══════════════════════════════════════════
function getSalesKPIs() {
  return {
    openEnquiries: enquiries.filter(e => !e.linkedQuotationId).length,
    unassigned: enquiries.filter(e => !e.salesPerson).length,
    unattended: enquiries.filter(e => e.followUps.length === 0).length,
    quotationsDraft: quotations.filter(q => q.lifecycleStatus === 'draft').length,
    quotationsOpen: quotations.filter(q => q.lifecycleStatus === 'open').length
  };
}
