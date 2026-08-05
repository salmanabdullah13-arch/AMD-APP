// ══════════════════════════════════════════
// HR & PAYROLL MODULE
// Built session: 3 Aug 2026, traced from
// docs/qpro-mapping/batch5administrationpayrollhr.txt (Q-Pro Batch 5).
// Reads/writes: employees[] (data.js). HR Dashboard is a pure read-side
// view over employees[] — no separate compliance-tracking entity, matching
// the live trace's own finding. Users/User Group/Quick Menu (Q-Pro's login
// system) and Employee Category (flagged vestigial in the trace itself)
// were deliberately not built here — see the data.js header comment above
// employees[] for the full reasoning.
// ══════════════════════════════════════════

const hrStyleTag = document.createElement('style');
hrStyleTag.textContent = `
#hr-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#hr-module-wrap .ops-header{background:var(--biz-primary);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#hr-module-wrap .hr-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#hr-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;}
#hr-module-wrap .sales-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#hr-module-wrap .sales-kpi-tile .num{font-size:19px;font-weight:700;color:var(--biz-primary);}
#hr-module-wrap .sales-kpi-tile .num.alert{color:var(--bad);}
#hr-module-wrap .sales-kpi-tile .lbl{font-size:10.5px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#hr-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#hr-module-wrap .sales-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#hr-module-wrap .sales-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:var(--biz-card-bg);color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#hr-module-wrap .sales-tabbtn.active{background:var(--biz-primary);border-color:var(--biz-primary);color:#fff;}
#hr-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
#hr-module-wrap table.sales-items th{text-align:left;padding:7px 6px;background:var(--biz-input-bg);color:var(--biz-text-muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--biz-border-light);}
#hr-module-wrap table.sales-items td{padding:7px 6px;border-bottom:1px solid var(--biz-border-light);}
#hr-module-wrap table.sales-items tr:hover td{background:#FAFBFD;}
#hr-module-wrap table.sales-items tr.emp-active td{background:#eafaf1;}
#hr-module-wrap table.sales-items tr.emp-active:hover td{background:#defbe9;}
#hr-module-wrap .sales-back{font-size:12px;color:var(--biz-primary);font-weight:600;cursor:pointer;margin-bottom:10px;display:inline-block;}
#hr-module-wrap .hr-field{margin-bottom:10px;}
#hr-module-wrap .hr-field label{display:block;font-size:11px;font-weight:700;color:var(--biz-text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.3px;}
#hr-module-wrap .hr-field input, #hr-module-wrap .hr-field select{width:100%;padding:8px 10px;border:1px solid var(--biz-border);border-radius:8px;font-size:13px;font-family:inherit;background:#fff;box-sizing:border-box;}
#hr-module-wrap .hr-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
#hr-module-wrap .hr-pill{display:inline-flex;align-items:center;font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;}
#hr-module-wrap .hr-pill.expired{background:#fdeceb;color:var(--bad);}
#hr-module-wrap .hr-pill.expiring{background:#fff6e3;color:var(--warn);}
#hr-module-wrap .hr-empty{font-size:12px;color:var(--biz-text-muted);padding:6px 0;}
`;
document.head.appendChild(hrStyleTag);

const hrModuleWrap = document.createElement('div');
hrModuleWrap.id = 'hr-module-wrap';
hrModuleWrap.style.cssText = 'display:none;';
hrModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">🧑‍💼</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">HR &amp; Payroll</div>
        <div style="color:rgba(255,255,255,.7);font-size:11px;">Employee Master · Compliance</div>
      </div>
    </div>
    <button onclick="closeHRModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="hr-scroll">
    <div id="hr-body"></div>
  </div>
`;
document.body.appendChild(hrModuleWrap);

let hrView = 'dashboard'; // dashboard | emp-list | emp-detail
let hrDetailId = null;
let hrDetailTab = 'general';
let hrEmpSearch = '';
let hrPayrollYear = new Date().getFullYear();
let hrPayrollMonth = new Date().getMonth() + 1; // 1-12

function hrEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }
function hrFmtDate(d) { return d ? d : '—'; }

function openHRModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap', 'admin-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  hrModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  hrView = 'dashboard';
  renderHRBody();
}
function closeHRModule() { closeModuleWrap(hrModuleWrap, 'launchHRModule'); }
function launchHRModule() { openHRModule(); }

function hrSetView(v) { hrView = v; renderHRBody(); }
function hrOpenEmployee(id) { hrDetailId = id; hrDetailTab = 'general'; hrView = 'emp-detail'; renderHRBody(); }

function renderHRBody() {
  const body = document.getElementById('hr-body');
  if (!body) return;
  const tab = (v, label) => `<button class="sales-tabbtn ${hrView === v ? 'active' : ''}" onclick="hrSetView('${v}')">${label}</button>`;
  // Approvals (5 Aug 2026, role-based access rollout) — self-registered
  // sign-ups pending Owner/HR approval before they get any app access.
  // Shared with the Owner dashboard, see approval-queue.js.
  const tabsHtml = `<div class="sales-tabs">${tab('dashboard', 'HR Dashboard')}${tab('emp-list', 'Employee')}${tab('payroll', 'Payroll Report')}${tab('approvals', 'Approvals')}</div>`;
  let content = '';
  if (hrView === 'dashboard') content = renderHRDashboard();
  else if (hrView === 'emp-list') content = renderEmployeeList();
  else if (hrView === 'emp-detail') content = renderEmployeeDetail();
  else if (hrView === 'payroll') content = renderPayrollReport();
  else if (hrView === 'approvals') content = '<div id="hr-approval-queue"></div>';
  body.innerHTML = (hrView === 'emp-detail' ? '' : tabsHtml) + content;
  if (hrView === 'approvals') renderApprovalQueueScreen('hr-approval-queue');
}

// ── HR DASHBOARD — 6 expiry tiles ─────────────────────────
function renderHRDashboard() {
  const k = getHRKPIs();
  const tile = (key, label) => {
    const exp = k[key].expiring.length, exd = k[key].expired.length;
    return `<div class="sales-kpi-tile">
      <div class="num ${exd ? 'alert' : ''}">${exp} / ${exd}</div>
      <div class="lbl">${label}<br><span style="font-size:9px;opacity:.7;">Expiring / Expired</span></div>
    </div>`;
  };
  const allFlagged = ['cpr', 'passport', 'licence', 'visa', 'contract', 'dependent']
    .flatMap(key => [...k[key].expiring.map(x => ({ ...x, status: 'expiring' })), ...k[key].expired.map(x => ({ ...x, status: 'expired' }))]);
  return `
    <div class="sales-card" style="display:flex;justify-content:space-between;align-items:center;">
      <p style="font-size:11px;color:#94a3b8;margin:0;">HR</p>
      <div style="display:flex;gap:14px;">
        <span style="font-size:11.5px;font-weight:600;color:var(--biz-primary,#600131);cursor:pointer;" onclick="notifyStorekeeper('HR',null,null,'renderHRBody')">🏬 Notify Storekeeper</span>
        <span style="font-size:11.5px;font-weight:600;color:var(--biz-primary,#600131);cursor:pointer;" onclick="requestPurchaseFromModule('closeHRModule',null,null)">🛒 Request Purchase</span>
      </div>
    </div>
    ${renderInboxWidget('HR', 'renderHRBody', 5)}
    <div class="sales-kpi-grid">
      ${tile('cpr', 'CPR')}
      ${tile('passport', 'Passport')}
      ${tile('licence', 'Driving Licence')}
      ${tile('visa', 'Visa')}
      ${tile('contract', 'Contract')}
      ${tile('dependent', 'Dependent')}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Compliance Risk by Category</p>
      ${cwMiniBars([
        { label: 'CPR', value: k.cpr.expiring.length + k.cpr.expired.length, color: cwOrdinalColor(0) },
        { label: 'Passport', value: k.passport.expiring.length + k.passport.expired.length, color: cwOrdinalColor(1) },
        { label: 'Licence', value: k.licence.expiring.length + k.licence.expired.length, color: cwOrdinalColor(2) },
        { label: 'Visa', value: k.visa.expiring.length + k.visa.expired.length, color: cwOrdinalColor(3) },
        { label: 'Contract', value: k.contract.expiring.length + k.contract.expired.length, color: cwOrdinalColor(4) },
        { label: 'Dependent', value: k.dependent.expiring.length + k.dependent.expired.length, color: cwOrdinalColor(0) }
      ])}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Compliance Alerts</p>
      ${allFlagged.length === 0 ? `<p class="hr-empty">Nothing expiring or expired right now.</p>` :
        `<table class="sales-items"><tr><th>Employee</th><th>Item</th><th>Date</th><th></th></tr>
          ${allFlagged.map(f => `<tr><td>${hrEsc(f.name)}</td><td>${hrEsc(f.label)}</td><td>${hrFmtDate(f.date)}</td><td><span class="hr-pill ${f.status}">${f.status === 'expired' ? 'Expired' : 'Expiring'}</span></td></tr>`).join('')}
        </table>`}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Note</p>
      <p style="font-size:11.5px;color:#94a3b8;">Pure read-side view over the Employee master — no separate compliance-tracking record exists. "Expiring" = within ${HR_EXPIRY_WINDOW_DAYS} days. Resigned/Terminated/Retired staff are excluded.</p>
    </div>`;
}

// ── EMPLOYEE LIST ─────────────────────────
function renderEmployeeList() {
  const q = hrEmpSearch.trim().toLowerCase();
  const rows = employees.filter(e => !q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || (e.designation || '').toLowerCase().includes(q));
  return `
    <div class="sales-card">
      <input type="text" placeholder="Search employee name, number or designation…" value="${hrEsc(hrEmpSearch)}"
        oninput="hrEmpSearch=this.value;renderHRBody();"
        style="width:100%;padding:9px 12px;border:1px solid var(--biz-border);border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit;">
    </div>
    <table class="sales-items">
      <tr><th>#</th><th>Emp Number</th><th>Emp Name</th><th>Designation</th><th>Department</th></tr>
      ${rows.map((e, i) => `<tr class="${e.status === 'Active' ? 'emp-active' : ''}" style="cursor:pointer;" onclick="hrOpenEmployee('${e.id}')">
        <td>${i + 1}</td><td>${hrEsc(e.id)}</td><td>${hrEsc(e.name)}</td><td>${hrEsc(e.designation)}</td><td>${hrEsc(e.department)}</td>
      </tr>`).join('')}
    </table>
    <p style="font-size:11px;color:var(--biz-text-muted);">${rows.length} of ${employees.length} employees · green rows = Active</p>`;
}

// ── EMPLOYEE DETAIL — 8 tabs ─────────────────────────
const HR_DETAIL_TABS = [
  ['general', 'General Info'], ['statutory', 'Statutory'], ['passport', 'Passport & Visa'],
  ['contract', 'Contract'], ['salary', 'Salary'], ['dependents', 'Dependents'],
  ['assets', 'Assets'], ['notes', 'Notes']
];

function hrDetailField(label, value) {
  return `<div class="hr-field"><label>${label}</label><div style="padding:8px 0;font-size:13px;">${hrEsc(value) || '<span style="color:var(--biz-text-faint);">—</span>'}</div></div>`;
}

function renderEmployeeDetail() {
  const e = getEmployee(hrDetailId);
  if (!e) return `<p class="hr-empty">Employee not found.</p>`;
  const tabsHtml = `<div class="sales-tabs">${HR_DETAIL_TABS.map(([v, label]) =>
    `<button class="sales-tabbtn ${hrDetailTab === v ? 'active' : ''}" onclick="hrDetailTab='${v}';renderHRBody();">${label}</button>`).join('')}</div>`;

  let tabContent = '';
  if (hrDetailTab === 'general') {
    tabContent = `<div class="sales-card">
      <div class="hr-row2">${hrDetailField('Employee Number', e.id)}${hrDetailField('Employee Name', e.name)}</div>
      <div class="hr-row2">${hrDetailField('Designation', e.designation)}${hrDetailField('Department', e.department)}</div>
      <div class="hr-row2">${hrDetailField('Date of Joining', hrFmtDate(e.doj))}${hrDetailField('Status', e.status)}</div>
      <div class="hr-row2">${hrDetailField('Machine ID', e.machineId)}${hrDetailField('Working Hours / Day', e.workingHours)}</div>
      <div class="hr-row2">${hrDetailField('Nationality', e.nationality)}${hrDetailField('Gender', e.gender)}</div>
      <div class="hr-row2">${hrDetailField('Mobile', e.mobile)}${hrDetailField('Email', e.email)}</div>
      <div class="hr-field"><label>Bank</label><div style="padding:8px 0;font-size:13px;">${hrEsc(e.bankName) || '—'} ${e.bankAccountNo ? '· ' + hrEsc(e.bankAccountNo) : ''}</div></div>
    </div>`;
  } else if (hrDetailTab === 'statutory') {
    tabContent = `<div class="sales-card">
      <div class="hr-row2">${hrDetailField('CPR Number', e.cpr)}${hrDetailField('CPR Expiry', hrFmtDate(e.cprExpiry))}</div>
      <div class="hr-row2">${hrDetailField('Driving Licence No.', e.licenceNo)}${hrDetailField('Driving Licence Expiry', hrFmtDate(e.licenceExpiry))}</div>
    </div>`;
  } else if (hrDetailTab === 'passport') {
    tabContent = `<div class="sales-card">
      <div class="hr-row2">${hrDetailField('Passport Number', e.passportNo)}${hrDetailField('Country of Issue', e.passportCountry)}</div>
      <div class="hr-row2">${hrDetailField('Passport Issue Date', hrFmtDate(e.passportIssue))}${hrDetailField('Passport Expiry', hrFmtDate(e.passportExpiry))}</div>
      <div class="hr-row2">${hrDetailField('Visa Number', e.visaNo)}${hrDetailField('Visa Expiry', hrFmtDate(e.visaExpiry))}</div>
    </div>`;
  } else if (hrDetailTab === 'contract') {
    tabContent = `<div class="sales-card">
      <div class="hr-row2">${hrDetailField('Contract Start', hrFmtDate(e.contractStart))}${hrDetailField('Contract Expiry', hrFmtDate(e.contractExpiry))}</div>
    </div>`;
  } else if (hrDetailTab === 'salary') {
    tabContent = `<div class="sales-card">
      <div class="hr-row2">${hrDetailField('Normal Rate (BD/hr)', e.normalRate != null ? e.normalRate.toFixed(3) : '')}${hrDetailField('OT Rate (BD/hr)', e.otRate != null ? e.otRate.toFixed(3) : '')}</div>
      <p style="font-weight:700;font-size:12.5px;margin:10px 0 6px;">Pay Heads</p>
      ${e.payHeads.length === 0 ? `<p class="hr-empty">No pay-head rows added.</p>` :
        `<table class="sales-items"><tr><th>Pay Head</th><th>Amount</th></tr>${e.payHeads.map(p => `<tr><td>${hrEsc(p.head)}</td><td>${(p.amount || 0).toFixed(3)}</td></tr>`).join('')}</table>`}
      <div class="hr-row2" style="margin-top:8px;">
        <select id="hr-payhead-select">${PAY_HEADS.map(h => `<option>${h}</option>`).join('')}</select>
        <input type="number" id="hr-payhead-amount" placeholder="Amount" step="0.001">
      </div>
      <button class="primary" style="margin-top:8px;" onclick="hrAddPayHead('${e.id}')">+ Add a new Row</button>
    </div>`;
  } else if (hrDetailTab === 'dependents') {
    tabContent = `<div class="sales-card">
      ${e.dependents.length === 0 ? `<p class="hr-empty">No dependents on file.</p>` :
        `<table class="sales-items"><tr><th>Name</th><th>Relation</th><th>DOB</th><th>CPR Expiry</th><th>Passport Expiry</th></tr>
          ${e.dependents.map(d => `<tr><td>${hrEsc(d.name)}</td><td>${hrEsc(d.relation)}</td><td>${hrFmtDate(d.dob)}</td><td>${hrFmtDate(d.cprExpiry)}</td><td>${hrFmtDate(d.passportExpiry)}</td></tr>`).join('')}
        </table>`}
      <div class="hr-row2">
        <input type="text" id="hr-dep-name" placeholder="Dependent Name">
        <select id="hr-dep-relation">${DEPENDENT_RELATIONS.map(r => `<option>${r}</option>`).join('')}</select>
      </div>
      <button class="primary" style="margin-top:8px;" onclick="hrAddDependent('${e.id}')">+ Add a new Row</button>
    </div>`;
  } else if (hrDetailTab === 'assets') {
    tabContent = `<div class="sales-card">
      ${e.assets.length === 0 ? `<p class="hr-empty">No assets in custody.</p>` :
        `<table class="sales-items"><tr><th>Asset</th><th>Code</th><th>Issue Date</th><th>Return Date</th><th>Remarks</th></tr>
          ${e.assets.map(a => `<tr><td>${hrEsc(a.name)}</td><td>${hrEsc(a.code)}</td><td>${hrFmtDate(a.issueDate)}</td><td>${hrFmtDate(a.returnDate) === '—' ? 'In custody' : hrFmtDate(a.returnDate)}</td><td>${hrEsc(a.remarks)}</td></tr>`).join('')}
        </table>`}
      <div class="hr-row2">
        <input type="text" id="hr-asset-name" placeholder="Asset Name">
        <input type="text" id="hr-asset-code" placeholder="Asset Code">
      </div>
      <button class="primary" style="margin-top:8px;" onclick="hrAddAsset('${e.id}')">+ Add a new Row</button>
    </div>`;
  } else if (hrDetailTab === 'notes') {
    tabContent = `<div class="sales-card">
      ${hrDetailField('Notes 1', e.notes1)}
      ${hrDetailField('Notes 2', e.notes2)}
      ${hrDetailField('Notes 3', e.notes3)}
    </div>`;
  }

  return `<span class="sales-back" onclick="hrView='emp-list';renderHRBody();">‹ Back to Employee List</span>
    <div class="sales-card" style="display:flex;justify-content:space-between;align-items:center;">
      <div><p style="font-weight:700;font-size:15px;">${hrEsc(e.name)}</p><p style="font-size:12px;color:var(--biz-text-muted);">${hrEsc(e.id)} · ${hrEsc(e.designation)} · ${hrEsc(e.department)}</p></div>
      <span class="hr-pill" style="background:${e.status === 'Active' ? '#eafaf1' : '#fdeceb'};color:${e.status === 'Active' ? '#0f9d58' : 'var(--bad)'};">${hrEsc(e.status)}</span>
    </div>
    ${tabsHtml}${tabContent}`;
}

function hrAddPayHead(id) {
  const head = document.getElementById('hr-payhead-select').value;
  const amount = document.getElementById('hr-payhead-amount').value;
  const e = getEmployee(id);
  if (!e) return;
  e.payHeads.push({ head, amount: Number(amount) || 0 });
  renderHRBody();
}
function hrAddDependent(id) {
  const name = document.getElementById('hr-dep-name').value;
  const relation = document.getElementById('hr-dep-relation').value;
  if (!name || !name.trim()) { hrAlert('Dependent Name is required.'); return; }
  addEmployeeDependent(id, { name: name.trim(), relation });
  renderHRBody();
}
function hrAddAsset(id) {
  const name = document.getElementById('hr-asset-name').value;
  const code = document.getElementById('hr-asset-code').value;
  if (!name || !name.trim()) { hrAlert('Asset Name is required.'); return; }
  addEmployeeAsset(id, { name: name.trim(), code, issueDate: new Date().toISOString().slice(0, 10) });
  renderHRBody();
}

function hrAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('hr-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'hr-toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;padding:10px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

// ══════════════════════════════════════════
// BATCH 6 — PAYROLL REPORT. Data/computation (getPayrollReport) lives in
// data.js — UI only here.
// ══════════════════════════════════════════
const HR_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function hrPayrollFilterChanged(key, val) {
  if (key === 'year') hrPayrollYear = Number(val); else hrPayrollMonth = Number(val);
  renderHRBody();
}
function renderPayrollReport() {
  const rows = getPayrollReport();
  const grandTotal = Math.round(rows.reduce((s, r) => s + r.total, 0) * 1000) / 1000;
  const yearOptions = [];
  for (let y = 2024; y <= 2036; y++) yearOptions.push(y);
  return `
    <div class="sales-card">
      <div class="hr-row2">
        <div class="hr-field"><label>Select Year</label>
          <select onchange="hrPayrollFilterChanged('year',this.value)">${yearOptions.map(y => `<option value="${y}" ${hrPayrollYear === y ? 'selected' : ''}>${y}</option>`).join('')}</select>
        </div>
        <div class="hr-field"><label>Select Month</label>
          <select onchange="hrPayrollFilterChanged('month',this.value)">${HR_MONTH_NAMES.map((m, i) => `<option value="${i + 1}" ${hrPayrollMonth === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select>
        </div>
      </div>
      <p style="font-size:11px;color:var(--biz-text-muted);">Payroll has no separate monthly "run" entity — this is a live rollup of each Active employee's Pay Heads (Salary tab), same as the live system. Year/Month narrow the label only, not the underlying data.</p>
    </div>
    <div class="sales-card" style="overflow-x:auto;">
      ${rows.length === 0 ? `<p class="hr-empty">No active employees.</p>` :
        `<table class="sales-items"><tr><th>#</th><th>Name</th>${PAY_HEADS.map(h => `<th>${hrEsc(h)}</th>`).join('')}<th>Total Salary</th></tr>
        ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${hrEsc(r.name)}</td>${PAY_HEADS.map(h => `<td>${r.byHead[h] ? r.byHead[h].toFixed(3) : ''}</td>`).join('')}<td style="font-weight:700;">${r.total.toFixed(3)}</td></tr>`).join('')}
        <tr style="font-weight:700;"><td colspan="${PAY_HEADS.length + 2}">Grand Total</td><td>${grandTotal.toFixed(3)}</td></tr>
        </table>`}
    </div>`;
}
