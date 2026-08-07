// ══════════════════════════════════════════
// JOB CARD MODULE (Module 5)
// Built session: 25 Jul 2026, from Salman's live Q-Pro trace (read-only
// exploration — no real production data touched). A Job Card is created
// from a Quotation via Sales' "Confirm Quote" action (see salesConfirmQuote
// in sales.js / confirmQuotationToJobCard in data.js).
//
// Deliberately separate from curtainJobs[]/projects[] (the pre-existing
// Curtain workshop tracker) — see the MODULE 5 comment block in data.js for
// why. Reads/writes jobCards[] and reuses quotations[]/customers[]/DEPTS/
// SALES_DIVISIONS/purchaseRequests. Built using the shared --biz- design
// tokens from styles.css (born into the redesigned look, not migrated).
//
// Also covers "Purchase Request (Job)" — a bonus discovery tying into the
// existing Purchasing PR chain, given its own lavender accent per Q-Pro's
// own per-transaction-area color convention.
// ══════════════════════════════════════════

const jobsStyleTag = document.createElement('style');
jobsStyleTag.textContent = `
#jobs-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#jobs-module-wrap .ops-header{background:var(--biz-primary);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#jobs-module-wrap .jobs-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#jobs-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#jobs-module-wrap .sales-field{margin-bottom:10px;}
#jobs-module-wrap .sales-field label{font-size:10.5px;font-weight:700;color:var(--biz-text-muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px;}
#jobs-module-wrap .sales-field input, #jobs-module-wrap .sales-field select, #jobs-module-wrap .sales-field textarea{width:100%;padding:9px 11px;border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);font-size:13px;box-sizing:border-box;font-family:inherit;background:var(--biz-input-bg);color:var(--biz-text);}
#jobs-module-wrap .sales-field input:focus, #jobs-module-wrap .sales-field select:focus, #jobs-module-wrap .sales-field textarea:focus{outline:none;border-color:var(--biz-primary);background:var(--biz-card-bg);}
#jobs-module-wrap button.primary{background:var(--biz-primary);color:#fff;border:0;border-radius:var(--biz-r-sm);padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
#jobs-module-wrap button.secondary{background:var(--biz-card-bg);border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);color:var(--biz-text-muted);font-size:13px;padding:9px 18px;cursor:pointer;font-family:inherit;}
#jobs-module-wrap .sales-back{font-size:12px;color:var(--biz-primary);font-weight:600;cursor:pointer;margin-bottom:10px;display:inline-block;}
#jobs-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
#jobs-module-wrap table.sales-items th{text-align:left;padding:7px 6px;background:var(--biz-input-bg);color:var(--biz-text-muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--biz-border-light);}
#jobs-module-wrap table.sales-items td{padding:7px 6px;border-bottom:1px solid var(--biz-border-light);vertical-align:top;}
#jobs-module-wrap table.sales-items tr:hover td{background:#FAFBFD;}
#jobs-module-wrap .job-legend{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;}
#jobs-module-wrap .job-legend-pill{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:20px;font-size:12.5px;font-weight:600;cursor:pointer;border:0;}
#jobs-module-wrap .job-legend-pill .n{font-size:15px;font-weight:800;}
#jobs-module-wrap .job-legend-pill.open{background:var(--biz-open-bg);color:var(--biz-open-text);}
#jobs-module-wrap .job-legend-pill.completed{background:var(--biz-confirmed-bg);color:var(--biz-confirmed-text);}
#jobs-module-wrap .job-legend-pill.cancelled{background:var(--biz-closed-bg);color:var(--biz-closed-text);}
#jobs-module-wrap .job-legend-pill.active{outline:2px solid currentColor;}
#jobs-module-wrap .sales-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:3px 10px;border-radius:20px;}
#jobs-module-wrap .sales-pill.open{background:var(--biz-open-bg);color:var(--biz-open-text);}
#jobs-module-wrap .sales-pill.completed{background:var(--biz-confirmed-bg);color:var(--biz-confirmed-text);}
#jobs-module-wrap .sales-pill.cancelled{background:var(--biz-closed-bg);color:var(--biz-closed-text);}
#jobs-module-wrap .sales-pill.pending{background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#jobs-module-wrap .sales-pill.in-progress{background:#fff6e3;color:#92400e;}
#jobs-module-wrap .sales-pill.delivered{background:var(--biz-confirmed-bg);color:var(--biz-confirmed-text);}
#jobs-module-wrap .sales-tile-row{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;}
#jobs-module-wrap .sales-tile{border:0;border-radius:var(--biz-r);padding:14px 10px;text-align:center;font-size:11.5px;font-weight:700;color:#fff;cursor:pointer;box-shadow:var(--biz-shadow);transition:transform .12s,box-shadow .12s;text-transform:uppercase;letter-spacing:.2px;}
#jobs-module-wrap .sales-tile:hover{transform:translateY(-2px);box-shadow:0 12px 28px 0 rgba(37,37,42,.14);}
#jobs-module-wrap .sales-tile .sales-tile-icon{font-size:18px;display:block;margin-bottom:6px;}
#jobs-module-wrap .sales-tile.t-blue{background:linear-gradient(135deg,var(--biz-primary),var(--biz-primary2));}
#jobs-module-wrap .sales-tile.t-purple{background:linear-gradient(135deg,var(--biz-purple),var(--biz-primary2));}
#jobs-module-wrap .sales-tile.t-teal{background:linear-gradient(135deg,var(--biz-teal),var(--biz-primary2));}
#jobs-module-wrap .sales-tile.t-magenta{background:linear-gradient(135deg,var(--biz-magenta),var(--biz-primary2));}
#jobs-module-wrap .sales-tile.t-amber{background:linear-gradient(135deg,var(--biz-primary),var(--biz-primary2));}
#jobs-module-wrap .sales-tile.t-cyan{background:linear-gradient(135deg,var(--biz-cyan),var(--biz-primary2));}
#jobs-module-wrap .sales-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#jobs-module-wrap .sales-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:var(--biz-card-bg);color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#jobs-module-wrap .sales-tabbtn.active{background:var(--biz-primary);border-color:var(--biz-primary);color:#fff;}
#jobs-module-wrap .job-row-add{display:flex;gap:6px;margin-bottom:8px;}
/* Purchase Request (Job) header — was its own lavender/mauve zone color
   (Q-Pro per-transaction-area convention); folded into the shared wine
   accent 3 Aug 2026, same as every other module's zone color. */
#jobs-module-wrap .prjob-header{background:#f4e6ec;}
#jobs-module-wrap .prjob-header h2, #jobs-module-wrap .prjob-header small{color:var(--biz-primary-dark);}

/* ── TAX INVOICE — print/PDF register ──
   Deliberately NOT dense-ERP styled like the rest of the app — a clean,
   formal single-page document look, per the design note: transactional
   documents should read as professional printed paper, not app chrome. */
#jobs-module-wrap .invoice-paper{background:#fff;border:1px solid #E2E4E9;border-radius:4px;padding:32px 28px;font-family:Georgia,"Times New Roman",serif;color:#1a1a1a;max-width:560px;margin:0 auto 16px;box-shadow:0 2px 10px rgba(0,0,0,.06);}
#jobs-module-wrap .invoice-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;}
#jobs-module-wrap .invoice-logo{font-size:28px;font-weight:900;letter-spacing:1px;}
#jobs-module-wrap .invoice-logo small{display:block;font-family:var(--font-biz);font-size:10px;font-weight:400;letter-spacing:.5px;color:#666;}
#jobs-module-wrap .invoice-title{font-size:20px;font-weight:700;letter-spacing:1px;text-align:right;}
#jobs-module-wrap .invoice-title small{display:block;font-family:var(--font-biz);font-size:11px;font-weight:400;color:#666;margin-top:2px;}
#jobs-module-wrap .invoice-meta-row{display:flex;justify-content:space-between;gap:20px;margin-bottom:18px;font-family:var(--font-biz);font-size:12px;}
#jobs-module-wrap .invoice-meta-row .lbl{color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.4px;}
#jobs-module-wrap .invoice-hr{border:0;border-top:1px solid #ddd;margin:14px 0;}
#jobs-module-wrap table.invoice-items{width:100%;border-collapse:collapse;font-family:var(--font-biz);font-size:12.5px;margin-bottom:14px;}
#jobs-module-wrap table.invoice-items th{text-align:left;padding:7px 6px;border-bottom:2px solid #1a1a1a;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;}
#jobs-module-wrap table.invoice-items td{padding:7px 6px;border-bottom:1px solid #eee;}
#jobs-module-wrap table.invoice-items th.r, #jobs-module-wrap table.invoice-items td.r{text-align:right;}
#jobs-module-wrap .invoice-totals{margin-left:auto;width:240px;font-family:var(--font-biz);font-size:12.5px;}
#jobs-module-wrap .invoice-totals-row{display:flex;justify-content:space-between;padding:4px 0;}
#jobs-module-wrap .invoice-totals-row.net{font-weight:700;font-size:14px;border-top:2px solid #1a1a1a;margin-top:4px;padding-top:8px;}
#jobs-module-wrap .invoice-payment{display:flex;gap:16px;align-items:flex-start;margin-top:20px;font-family:var(--font-biz);font-size:11px;color:#444;}
#jobs-module-wrap .invoice-qr{width:72px;height:72px;border:1px dashed #999;display:flex;align-items:center;justify-content:center;text-align:center;font-size:9px;color:#999;flex:none;line-height:1.3;}
#jobs-module-wrap .invoice-sign{text-align:right;margin-top:28px;font-family:var(--font-biz);font-size:12px;}
#jobs-module-wrap .invoice-sign .line{margin-top:36px;border-top:1px solid #1a1a1a;width:180px;margin-left:auto;padding-top:4px;font-size:10.5px;color:#666;}
#jobs-module-wrap .invoice-footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-family:var(--font-biz);font-size:9.5px;color:#888;text-align:center;line-height:1.6;}
`;
document.head.appendChild(jobsStyleTag);

// ── Module shell ──
const jobsModuleWrap = document.createElement('div');
jobsModuleWrap.id = 'jobs-module-wrap';
jobsModuleWrap.style.cssText = 'display:none;';
jobsModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">🗂️</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Jobs</div>
        <div style="color:rgba(255,255,255,.7);font-size:11px;">Job Card — post-Approval production</div>
      </div>
    </div>
    <button onclick="closeJobsModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="jobs-scroll">
    <div id="jobs-body"></div>
  </div>
`;
document.body.appendChild(jobsModuleWrap);

let jobsView = 'list';           // list | hub | edit | delivery | issue | return | status | labour | prjob
let jobsActiveJobId = null;
let jobsActiveInvoiceId = null;
let jobsListStatusFilter = null; // null | 'open' | 'completed' | 'cancelled'
let jobsFilters = { jobNo: '', project: '', qtnNo: '', customer: '', salesPerson: '' };
let jobsReportsTab = 'job-report'; // job-report | project-outstanding | proj-inv-receipt
let jobsReportSearch = '';         // Job No typed into Job report / Project wise Invoice & Receipt

function jEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }
function jobsAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('jobs-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'jobs-toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;padding:10px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

// ── Module open/close ──
function openJobsModule(jumpToJobId) {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['ops-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap', 'admin-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  jobsModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  execEnsureShell(jobsModuleWrap, { key: 'jobs', title: 'Job Cards', role: 'Jobs', navGroupsFn: EXEC_NAV_CONFIGS.jobs, closeFn: 'closeJobsModule' });
  if (jumpToJobId) { openJobHub(jumpToJobId); }
  else { jobsView = 'list'; renderJobsBody(); }
}
function closeJobsModule() { closeModuleWrap(jobsModuleWrap, 'launchJobsModule'); }
function launchJobsModule(jumpToJobId) { openJobsModule(jumpToJobId); }

function renderJobsBody() {
  const body = document.getElementById('jobs-body');
  if (!body) return;
  let content = '';
  switch (jobsView) {
    case 'list': content = renderJobList(); break;
    case 'hub': content = renderJobHub(); break;
    case 'edit': content = renderEditJob(); break;
    case 'delivery': content = renderDeliveryNote(); break;
    case 'issue': content = renderMaterialsMove('issue'); break;
    case 'return': content = renderMaterialsMove('return'); break;
    case 'status': content = renderUpdateJobStatus(); break;
    case 'labour': content = renderLabourCost(); break;
    case 'prjob': content = renderPurchaseRequestJob(); break;
    case 'invoice': content = renderInvoicePrint(); break;
    case 'reports': content = renderJobsReports(); break;
    default: content = renderJobList();
  }
  body.innerHTML = content;
}

function jobRowSummary(job) {
  const qtn = quotations.find(q => q.id === job.quotationId);
  const c = customers.find(x => x.id === job.customerId);
  const enq = qtn ? enquiries.find(e => e.id === qtn.enquiryId) : null;
  return { client: c ? c.name : '—', salesman: enq ? enq.salesPerson : '—', qtnNo: job.quotationId };
}

// ══════════════════════════════════════════
// JOB CARD LIST
// ══════════════════════════════════════════

function jobsToggleStatusFilter(status) {
  jobsListStatusFilter = jobsListStatusFilter === status ? null : status;
  renderJobsBody();
}
function jobsFilterChanged(key, val) { jobsFilters[key] = val; renderJobsBody(); }

function jobMatchesFilters(job) {
  const f = jobsFilters;
  const s = jobRowSummary(job);
  if (jobsListStatusFilter && job.status !== jobsListStatusFilter) return false;
  if (f.jobNo && !job.id.toLowerCase().includes(f.jobNo.toLowerCase())) return false;
  if (f.project && !job.projectName.toLowerCase().includes(f.project.toLowerCase())) return false;
  if (f.qtnNo && !job.quotationId.toLowerCase().includes(f.qtnNo.toLowerCase())) return false;
  if (f.customer && !s.client.toLowerCase().includes(f.customer.toLowerCase())) return false;
  if (f.salesPerson && s.salesman !== f.salesPerson) return false;
  return true;
}

function renderJobList() {
  const k = getJobCardKPIs();
  const legendHtml = `
    <div class="job-legend">
      <button class="job-legend-pill open ${jobsListStatusFilter === 'open' ? 'active' : ''}" onclick="jobsToggleStatusFilter('open')"><span class="n">${k.open}</span> Open</button>
      <button class="job-legend-pill completed ${jobsListStatusFilter === 'completed' ? 'active' : ''}" onclick="jobsToggleStatusFilter('completed')"><span class="n">${k.completed}</span> Completed</button>
      <button class="job-legend-pill cancelled ${jobsListStatusFilter === 'cancelled' ? 'active' : ''}" onclick="jobsToggleStatusFilter('cancelled')"><span class="n">${k.cancelled}</span> Cancelled</button>
    </div>
    <button class="secondary" style="width:100%;margin-bottom:12px;" onclick="jobsView='reports';renderJobsBody();">📊 Reports</button>`;

  const filterHtml = `
    <div class="sales-card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Job No</label><input type="text" value="${jobsFilters.jobNo}" oninput="jobsFilterChanged('jobNo',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>Project</label><input type="text" value="${jobsFilters.project}" oninput="jobsFilterChanged('project',this.value)"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Quotation No</label><input type="text" value="${jobsFilters.qtnNo}" oninput="jobsFilterChanged('qtnNo',this.value)"></div>
        <div class="sales-field" style="margin-bottom:0;"><label>Customer</label><input type="text" value="${jobsFilters.customer}" oninput="jobsFilterChanged('customer',this.value)"></div>
      </div>
      <div class="sales-field" style="margin-top:8px;margin-bottom:0;"><label>Sales Person</label>
        <select onchange="jobsFilterChanged('salesPerson',this.value)">
          <option value="">All</option>${STAFF.map(s => `<option value="${s}" ${jobsFilters.salesPerson === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>`;

  const rows = jobCards.filter(jobMatchesFilters).slice().sort((a, b) => b.date.localeCompare(a.date));
  const listHtml = rows.length === 0
    ? `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No job cards match. Job Cards are created from Sales' "Confirm Quote" action once a quotation is Open.</p></div>`
    : rows.map(job => {
      const s = jobRowSummary(job);
      return `
      <div class="sales-card" style="cursor:pointer;" onclick="openJobHub('${job.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <p style="font-weight:700;font-size:13px;">${job.id} <span style="font-weight:400;color:#94a3b8;">· ${job.date}</span></p>
            <p style="font-size:12px;color:#334155;">${jEsc(s.client)} · ${jEsc(job.projectName)}</p>
            <p style="font-size:11px;color:#64748b;">Salesman: ${jEsc(s.salesman)} · Qtn: ${jEsc(s.qtnNo)} · Amt: BD ${job.amount.toFixed(3)}</p>
          </div>
          <span class="sales-pill ${job.status}">${job.status}</span>
        </div>
      </div>`;
    }).join('');

  return legendHtml + filterHtml + listHtml;
}

// ══════════════════════════════════════════
// JOB CARD MANAGEMENT (detail hub)
// ══════════════════════════════════════════

function openJobHub(jobId) {
  // Session 2 nav: show the record in the breadcrumb trail.
  if (typeof execSetCrumb === 'function') setTimeout(() => execSetCrumb(jobId), 0);
  jobsActiveJobId = jobId;
  jobsView = 'hub';
  renderJobsBody();
}

// Production-presupposing actions (Delivery Note, Material Issue/Return,
// Invoice generation) are locked until Operations has actually routed the
// job — Salman's call: these don't correspond to anything real if
// Operations hasn't reviewed/routed the job yet, and the Jobs module
// previously had zero awareness of routingConfirmed at all, letting a job
// "live on its own" fully operable the instant it was created, completely
// decoupled from the Operations hand-off. Tasks/Activity Log/Variations
// stay open immediately — they don't presuppose production has started.
function jobsLockedTile(cls, icon, label, reason) {
  return `<div class="sales-tile ${cls}" style="opacity:.5;cursor:not-allowed;" onclick="jobsAlert('${reason}')"><span class="sales-tile-icon">${icon}</span>${label}</div>`;
}
function renderJobHub() {
  const job = getJobCard(jobsActiveJobId);
  if (!job) return `<p style="font-size:12.5px;color:#64748b;">Job Card not found.</p>`;
  const c = customers.find(x => x.id === job.customerId);
  const cancelled = job.status === 'cancelled';
  // A job routed before being cancelled previously stayed fully
  // invoiceable/issuable forever — the department production queues
  // already excluded cancelled jobs, this hub didn't (4 Aug 2026 audit
  // finding, matches the same fix in data.js's own guards).
  const routed = !!job.routingConfirmed && !cancelled;
  // Session 3 role lockdown — Sales sees only Job Order (print), New
  // Variation, Raise Purchase Request and Mark Completed. Costing, editing,
  // delivery, materials, status/labour, cancellation, invoicing and any
  // PO price/vendor detail are hidden AND blocked at the function level.
  const sales = typeof isSalesRole === 'function' && isSalesRole();

  return `
    <span class="sales-back" onclick="jobsView='list';renderJobsBody();">‹ Back to Job Card List</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:15px;">${job.id} <span class="sales-pill ${job.status}">${job.status}</span></p>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">Client: ${jEsc(c ? c.name : '—')} · Project: ${jEsc(job.projectName)}</p>
      <p style="font-size:12px;color:#64748b;">Job Date: ${job.date} · Amount: BD ${job.amount.toFixed(3)} · Confirm Date: ${job.confirmDate || '—'}</p>
      <p style="font-size:11px;color:#94a3b8;margin-top:4px;">Linked Quotation: ${jEsc(job.quotationId)}</p>
    </div>
    ${cancelled ? `<div class="sales-banner">This job is cancelled — Delivery Note, Material Issue/Return, and Invoice generation are locked permanently.</div>`
      : !routed ? `<div class="sales-banner">Awaiting Operations Routing — Delivery Note, Material Issue/Return, and Invoice generation unlock once the Operations Manager confirms department routing for this job.</div>` : ''}
    <div class="sales-tile-row">
      <div class="sales-tile t-blue" onclick="printJobOrder('${job.id}')"><span class="sales-tile-icon">🖨</span>Job Order</div>
      ${sales ? '' : `<div class="sales-tile t-blue" onclick="printJobCosting('${job.id}')"><span class="sales-tile-icon">📊</span>Job Costing</div>`}
      ${sales ? '' : `<div class="sales-tile t-purple" onclick="openEditJob('${job.id}')"><span class="sales-tile-icon">✎</span>Edit Job</div>`}
      ${sales ? '' : (routed ? `<div class="sales-tile t-teal" onclick="openDeliveryNote('${job.id}')"><span class="sales-tile-icon">🚚</span>Delivery Note</div>` : jobsLockedTile('t-teal', '🚚', 'Delivery Note', cancelled ? 'This job is cancelled.' : 'Locked until Operations routes this job to a department.'))}
      ${sales ? '' : (routed ? `<div class="sales-tile t-amber" onclick="openMaterialsMove('${job.id}','issue')"><span class="sales-tile-icon">📦</span>Material Issue</div>` : jobsLockedTile('t-amber', '📦', 'Material Issue', cancelled ? 'This job is cancelled.' : 'Locked until Operations routes this job to a department.'))}
      ${sales ? '' : (routed ? `<div class="sales-tile t-magenta" onclick="openMaterialsMove('${job.id}','return')"><span class="sales-tile-icon">↩</span>Material Return</div>` : jobsLockedTile('t-magenta', '↩', 'Material Return', cancelled ? 'This job is cancelled.' : 'Locked until Operations routes this job to a department.'))}
      ${cancelled ? jobsLockedTile('t-cyan', '➕', 'New Variation', 'This job is cancelled.') : `<div class="sales-tile t-cyan" onclick="jobsNewVariation('${job.id}')"><span class="sales-tile-icon">➕</span>New Variation</div>`}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Job Actions</p>
      ${sales ? '' : `<div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="secondary" style="flex:1;" onclick="openUpdateJobStatus('${job.id}')">Update Job Status</button>
        <button class="secondary" style="flex:1;" onclick="openLabourCost('${job.id}')">Labour Cost</button>
      </div>`}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <button class="secondary" style="flex:1;" onclick="openPurchaseRequestJob('${job.id}')">Raise Purchase Request (Job)</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        ${job.status !== 'completed' ? `<button class="secondary" style="flex:1;" onclick="jobsSetStatus('${job.id}','completed')">Mark Completed</button>` : ''}
        ${sales || job.status === 'cancelled' ? '' : `<button class="secondary" style="flex:1;color:#b91c1c;" onclick="jobsSetStatus('${job.id}','cancelled')">Cancel Job</button>`}
      </div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">File Manager</p>
      <p style="font-size:11.5px;color:#94a3b8;">No upload infrastructure in this app yet.</p>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Invoices</p>
      ${getInvoicesForJob(job.id).length === 0
        ? `<p style="font-size:11.5px;color:#94a3b8;margin-bottom:8px;">No invoice generated yet.</p>`
        : `<table class="sales-items"><tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>Received</th><th>Balance</th></tr>${getInvoicesForJob(job.id).map(inv => `<tr style="cursor:pointer;" onclick="openInvoicePrint('${inv.id}')"><td>${jEsc(inv.id)}</td><td>${inv.date}</td><td>${inv.totals.netTotal.toFixed(3)}</td><td>${(inv.paidAmount || 0).toFixed(3)}</td><td>${invoiceBalance(inv).toFixed(3)}</td></tr>`).join('')}</table>`}
      ${sales ? '' : `<button class="secondary" style="width:100%;margin-top:6px;${routed ? '' : 'opacity:.5;cursor:not-allowed;'}" onclick="${routed ? `jobsGenerateInvoice('${job.id}')` : `jobsAlert('${cancelled ? 'This job is cancelled.' : 'Locked until Operations routes this job to a department.'}')`}">Generate Invoice</button>`}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Related records</p>
      <p style="font-weight:700;font-size:12px;margin:6px 0 4px;">Receipts</p>
      ${getReceiptsForJob(job.id).length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No Invoice List Exist...</p>` :
        `<table class="sales-items"><tr><th>Receipt No.</th><th>Date</th><th>Amount</th></tr>${getReceiptsForJob(job.id).map(r => `<tr><td>${jEsc(r.id)}</td><td>${r.receiptDate}</td><td>${r.amount.toFixed(3)}</td></tr>`).join('')}</table>`}
      <p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Credit Notes</p>
      ${getCreditNotesForJob(job.id).length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No Invoice List Exist...</p>` :
        `<table class="sales-items"><tr><th>Credit Note No.</th><th>Date</th><th>Amount</th><th>Status</th></tr>${getCreditNotesForJob(job.id).map(cn => `<tr style="${cn.status === 'cancelled' ? 'background:#fee2e2;' : ''}"><td>${jEsc(cn.id)}</td><td>${cn.creditNoteDate}</td><td>${cn.amount.toFixed(3)}</td><td>${cn.status}</td></tr>`).join('')}</table>`}
      <p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Proforma</p>
      ${getProformasForJob(job.id).length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No Proforma generated yet.</p>` :
        `<table class="sales-items"><tr><th>Proforma No.</th><th>Date</th><th>Amount</th></tr>${getProformasForJob(job.id).map(p => `<tr><td>${jEsc(p.id)}</td><td>${p.date}</td><td>${p.totals.netTotal.toFixed(3)}</td></tr>`).join('')}</table>`}
      <p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Delivery Notes</p>
      ${job.deliveryNotes.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No delivery notes yet.</p>` : `<table class="sales-items"><tr><th>DN</th><th>Date</th><th>Lines</th></tr>${job.deliveryNotes.map(dn => `<tr><td>${dn.id}</td><td>${dn.date}</td><td>${dn.lines.length}</td></tr>`).join('')}</table>`}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">PO / Vendor</p>
      ${sales ? `<p style="font-size:12px;color:#64748b;">Supplier and pricing detail is not available for the Sales role.</p>` : (job.poNo ? `<p style="font-size:12px;">PO No: ${jEsc(job.poNo)} · Date: ${job.poDate} · Vendor: ${jEsc(job.vendor)}</p>` : `<p style="font-size:12px;color:#64748b;">Empty unless materials were purchased specifically for this job.</p>`)}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Items (${job.items.length})</p>
      <table class="sales-items"><tr><th>Product</th><th>Qty</th><th>Delivered</th><th>Rate</th><th>Net</th><th>Actual</th><th></th></tr>
      ${job.items.map(it => {
        const act = getLineActualCost(job.id, it.lineId);
        return `<tr><td>${jEsc(it.product)}</td><td>${it.qty} ${jEsc(it.unit)}</td><td>${it.deliveredQty}</td><td>${it.rate.toFixed(3)}</td><td>${it.netAmount.toFixed(3)}</td>
          <td><span style="color:var(--biz-primary);cursor:pointer;white-space:nowrap;" title="Material Cost sheet — derived from real issues + labour day-logs" onclick="printMaterialCost('${job.id}',${it.lineId})">🧾 ${act && act.totalCost ? act.totalCost.toFixed(3) : '0.000'}</span></td>
          <td>${it.variationId ? `<span class="sales-pill open" style="font-size:9.5px;">${jEsc(it.variationId)}</span>` : ''}</td></tr>`;
      }).join('')}
      </table>
    </div>
    ${renderJobCostComparison(job)}
    ${renderJobVariations(job)}
    ${renderJobTasksAndActivity(job)}`;
}

// ── STAGE 4 (cost ledger): Estimated vs Budgeted vs Actual ──
// Estimated = the Estimator's BOM cost (per line, from the linked
// quotation); Budgeted = the approved department budgets (job-level —
// budgets aren't per-line); Actual = the derived ledger (issues +
// labour day-logs). Nothing here is typed; it's all read-side.
function renderJobCostComparison(job) {
  const qtn = quotations.find(q => q.id === job.quotationId);
  const lines = job.items.map(it => {
    const qi = qtn ? qtn.items.find(x => x.lineId === it.lineId) : null;
    const est = qi && qi.bom ? computeBOMTotals(qi.bom).totalCostInclOH : null;
    const act = getLineActualCost(job.id, it.lineId);
    return { it, est, actual: act ? act.totalCost : 0 };
  });
  const estTotal = lines.reduce((s, l) => s + (l.est || 0), 0);
  const budgets = job.departmentBudgets ? Object.values(job.departmentBudgets)
    .filter(e => e.approvalStatus === 'approved')
    .reduce((s, e) => s + computeBOMTotals(e.bom).totalCost, 0) : 0;
  const jobAct = getJobActualCost(job.id);
  const actTotal = jobAct ? jobAct.totalCost : 0;
  if (estTotal === 0 && budgets === 0 && actTotal === 0) return '';
  const fmt = n => n === null ? '—' : n.toFixed(3);
  const delta = (a, b) => (a === null || !b) ? '' : ` <span style="font-size:9.5px;color:${a > b ? 'var(--bad,#d9342b)' : 'var(--ok,#0f9d58)'};">${a > b ? '+' : ''}${(a - b).toFixed(3)}</span>`;
  return `<div class="sales-card">
    <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Estimated vs Budgeted vs Actual</p>
    <table class="sales-items"><tr><th>Line</th><th>Estimated</th><th>Actual</th></tr>
      ${lines.map(l => `<tr><td>${jEsc(l.it.product)}</td><td>${fmt(l.est)}</td><td>${fmt(l.actual)}${delta(l.actual, l.est)}</td></tr>`).join('')}
      <tr style="font-weight:700;"><td>Job totals — Est / Budgeted / Actual</td><td>${estTotal.toFixed(3)} / ${budgets.toFixed(3)}</td><td>${actTotal.toFixed(3)}${delta(actTotal, budgets || estTotal)}</td></tr>
    </table>
    <p style="font-size:10px;color:#94a3b8;margin-top:4px;">Actuals derive from priced material issues + labour day-logs (Budgeted is job-level — department budgets aren't split per line). Tap 🧾 on an item above for its full MATERIAL COST sheet.</p>
  </div>`;
}

function jobsSetStatus(jobId, status) {
  if (status === 'cancelled' && typeof salesBlocked==='function' && salesBlocked('cancelJob', jobsAlert)) return;
  if (!window.confirm(`Mark this job as ${status}?`)) return;
  setJobStatus(jobId, status);
  jobsAlert(`✓ Job marked ${status}.`);
  renderJobsBody();
}

// ══════════════════════════════════════════
// EDIT JOB
// ══════════════════════════════════════════

function openEditJob(jobId) {
  if (typeof salesBlocked==='function' && salesBlocked('editJob', jobsAlert)) return;
  jobsActiveJobId = jobId; jobsView = 'edit'; renderJobsBody(); }

function renderEditJob() {
  const job = getJobCard(jobsActiveJobId);
  if (!job) return `<p style="font-size:12.5px;color:#64748b;">Job Card not found.</p>`;
  const c = customers.find(x => x.id === job.customerId);

  const rows = job.items.map(it => `
    <tr><td>${jEsc(it.product)}</td><td>${it.qty}</td><td>${it.rate.toFixed(3)}</td><td>${it.discPercent}%</td><td>${it.amount.toFixed(3)}</td><td>${it.vatPercent}%</td><td>${(it.amount * it.vatPercent / 100).toFixed(3)}</td><td>${it.netAmount.toFixed(3)}</td></tr>`).join('');

  return `
    <span class="sales-back" onclick="openJobHub('${job.id}');">‹ Back to Job Card</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;">Edit Job</p>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">Client: ${jEsc(c ? c.name : '—')} · Phone: ${jEsc(c ? c.tel : '—')}</p>
      <p style="font-size:12px;color:#64748b;">Job No: ${job.id} · Quotation No: ${jEsc(job.quotationId)} · PO No: ${job.poNo || '—'}</p>
    </div>
    <div class="sales-card" style="overflow-x:auto;">
      <table class="sales-items"><tr><th>Name</th><th>Qty</th><th>Unit Price</th><th>Disc</th><th>Total (BD)</th><th>VAT %</th><th>VAT Amount</th><th>Net Total (BD)</th></tr>${rows}</table>
      <p style="font-size:11px;color:#94a3b8;">Line items are carried over from the confirmed Quotation. Use "Update BOM" to re-sync Qty/Rate if Estimation changed them after this Job Card was created.</p>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="primary" style="flex:1;" onclick="jobsAlert('✓ Job updated.')">Submit</button>
      <button class="secondary" style="flex:1;" onclick="jobsUpdateBOM('${job.id}')">Update BOM</button>
      <button class="secondary" style="flex:1;" onclick="openJobHub('${job.id}');">Exit</button>
    </div>`;
}

function jobsUpdateBOM(jobId) {
  refreshJobFromQuotation(jobId);
  jobsAlert('✓ BOM re-synced from the linked Quotation.');
  renderJobsBody();
}

// ══════════════════════════════════════════
// CREATE DELIVERY NOTE
// ══════════════════════════════════════════

function openDeliveryNote(jobId) {
  if (typeof salesBlocked==='function' && salesBlocked('deliveryNote', jobsAlert)) return;
  jobsActiveJobId = jobId; jobsView = 'delivery'; renderJobsBody(); }

function renderDeliveryNote() {
  const job = getJobCard(jobsActiveJobId);
  if (!job) return `<p style="font-size:12.5px;color:#64748b;">Job Card not found.</p>`;
  const c = customers.find(x => x.id === job.customerId);

  const rows = job.items.map((it, i) => `
    <tr>
      <td>${i + 1}</td><td>—</td><td>—</td><td>${jEsc(it.product)}</td>
      <td>${it.qty}</td><td>${it.deliveredQty}</td><td>${(it.qty - it.deliveredQty).toFixed(2)}</td>
      <td><input type="number" min="0" max="${it.qty - it.deliveredQty}" value="0" id="dn-qty-${it.lineId}" style="width:80px;padding:5px 6px;border:1px solid var(--biz-border);border-radius:6px;"></td>
    </tr>`).join('');

  return `
    <span class="sales-back" onclick="openJobHub('${job.id}');">‹ Back to Job Card</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;">Create Delivery Note</p>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">Client: ${jEsc(c ? c.name : '—')} · Phone: ${jEsc(c ? c.tel : '—')} · Job No: ${job.id} · Quotation No: ${jEsc(job.quotationId)}</p>
    </div>
    <div class="sales-card" style="overflow-x:auto;">
      <table class="sales-items"><tr><th>#</th><th>Group</th><th>Sub Group</th><th>Name</th><th>Job Qty</th><th>Del Qty</th><th>Balance Qty</th><th>Required Qty</th></tr>${rows}</table>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="primary" style="flex:1;" onclick="jobsSubmitDeliveryNote('${job.id}')">Submit</button>
      <button class="secondary" style="flex:1;" onclick="openJobHub('${job.id}');">Cancel</button>
    </div>`;
}

function jobsSubmitDeliveryNote(jobId) {
  const job = getJobCard(jobId);
  const entries = job.items.map(it => ({ lineId: it.lineId, requiredQty: Number(document.getElementById(`dn-qty-${it.lineId}`).value) || 0 })).filter(e => e.requiredQty > 0);
  if (entries.length === 0) { jobsAlert('Enter a Required Qty for at least one item.'); return; }
  const note = addDeliveryNote(jobId, entries);
  jobsAlert(`✓ Delivery Note ${note.id} created.`);
  openJobHub(jobId);
}

// ══════════════════════════════════════════
// MATERIALS ISSUE / RETURN (mirrored structure)
// ══════════════════════════════════════════

let jobsMoveRows = [];

function openMaterialsMove(jobId, kind) {
  if (typeof salesBlocked==='function' && salesBlocked('materials', jobsAlert)) return;
  jobsActiveJobId = jobId;
  jobsView = kind === 'issue' ? 'issue' : 'return';
  jobsMoveRows = [{ jobItemLineId: '', stockItemName: '', unit: '', qty: 1 }];
  renderJobsBody();
}

function renderMaterialsMove(kind) {
  const job = getJobCard(jobsActiveJobId);
  if (!job) return `<p style="font-size:12.5px;color:#64748b;">Job Card not found.</p>`;
  const c = customers.find(x => x.id === job.customerId);
  const title = kind === 'issue' ? 'Materials Issue' : 'Materials Return';

  const rowsHtml = jobsMoveRows.map((r, i) => `
    <div class="job-row-add">
      <select style="flex:2;" onchange="jobsMoveRowChanged(${i},'jobItemLineId',this.value)">
        <option value="">Job Item…</option>
        ${job.items.map(it => `<option value="${it.lineId}" ${r.jobItemLineId == it.lineId ? 'selected' : ''}>${jEsc(it.product)}</option>`).join('')}
      </select>
      <input style="flex:2;" type="text" placeholder="Stock Item 🔗" value="${jEsc(r.stockItemName)}" onchange="jobsMoveRowChanged(${i},'stockItemName',this.value)">
      <input style="flex:1;" type="text" placeholder="Unit" value="${jEsc(r.unit)}" onchange="jobsMoveRowChanged(${i},'unit',this.value)">
      <input style="flex:1;" type="number" value="${r.qty}" onchange="jobsMoveRowChanged(${i},'qty',Number(this.value))">
    </div>`).join('');

  return `
    <span class="sales-back" onclick="openJobHub('${job.id}');">‹ Back to Job Card</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;">${title}</p>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">Client: ${jEsc(c ? c.name : '—')} · Phone: ${jEsc(c ? c.tel : '—')} · Job No: ${job.id} · Quotation No: ${jEsc(job.quotationId)}</p>
      <div class="sales-field" style="margin-top:10px;"><label>Location *</label><input type="text" id="move-location" placeholder="e.g. Main Warehouse"></div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Items</p>
      ${rowsHtml}
      <button class="secondary" style="margin-top:6px;" onclick="jobsAddMoveRow()">+ Add Row</button>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="primary" style="flex:1;" onclick="jobsSubmitMove('${kind}')">Submit</button>
      <button class="secondary" style="flex:1;" onclick="openJobHub('${job.id}');">Cancel</button>
    </div>`;
}

function jobsMoveRowChanged(i, key, val) { jobsMoveRows[i][key] = val; }
function jobsAddMoveRow() { jobsMoveRows.push({ jobItemLineId: '', stockItemName: '', unit: '', qty: 1 }); renderJobsBody(); }

function jobsSubmitMove(kind) {
  const location = document.getElementById('move-location').value;
  if (!location) { jobsAlert('Location is required.'); return; }
  const items = jobsMoveRows.filter(r => r.stockItemName && r.qty > 0);
  if (items.length === 0) { jobsAlert('Add at least one item.'); return; }
  const result = kind === 'issue' ? addMaterialsIssue(jobsActiveJobId, { location, items }) : addMaterialsReturn(jobsActiveJobId, { location, items });
  if (result.error) { jobsAlert(result.error); return; }
  jobsAlert(`✓ ${kind === 'issue' ? 'Materials Issue' : 'Materials Return'} ${result.id} recorded.`);
  openJobHub(jobsActiveJobId);
}

// ══════════════════════════════════════════
// UPDATE JOB STATUS — per line, per department
// ══════════════════════════════════════════

let jobsStatusRows = [];

function openUpdateJobStatus(jobId) {
  if (typeof salesBlocked==='function' && salesBlocked('jobStatus', jobsAlert)) return;
  jobsActiveJobId = jobId;
  jobsView = 'status';
  jobsStatusRows = [{ lineId: '', department: JOB_DEPARTMENTS[0], status: JOB_LINE_STATUSES[0] }];
  renderJobsBody();
}

function renderUpdateJobStatus() {
  const job = getJobCard(jobsActiveJobId);
  if (!job) return `<p style="font-size:12.5px;color:#64748b;">Job Card not found.</p>`;
  const c = customers.find(x => x.id === job.customerId);

  const existingHtml = job.items.some(it => it.departmentStatuses.length) ? `
    <table class="sales-items"><tr><th>Item</th><th>Department</th><th>Status</th></tr>
    ${job.items.flatMap(it => it.departmentStatuses.map(d => `<tr><td>${jEsc(it.product)}</td><td>${jEsc(d.department)}</td><td><span class="sales-pill ${d.status.toLowerCase().replace(' ', '-')}">${jEsc(d.status)}</span></td></tr>`)).join('')}
    </table>` : `<p style="font-size:12px;color:#64748b;">No status set yet.</p>`;

  const rowsHtml = jobsStatusRows.map((r, i) => `
    <div class="job-row-add">
      <select style="flex:2;" onchange="jobsStatusRowChanged(${i},'lineId',this.value)">
        <option value="">Item…</option>
        ${job.items.map(it => `<option value="${it.lineId}" ${r.lineId == it.lineId ? 'selected' : ''}>${jEsc(it.product)}</option>`).join('')}
      </select>
      <select style="flex:1;" onchange="jobsStatusRowChanged(${i},'department',this.value)">
        ${JOB_DEPARTMENTS.map(d => `<option value="${d}" ${r.department === d ? 'selected' : ''}>${d}</option>`).join('')}
      </select>
      <select style="flex:1;" onchange="jobsStatusRowChanged(${i},'status',this.value)">
        ${JOB_LINE_STATUSES.map(s => `<option value="${s}" ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>`).join('');

  return `
    <span class="sales-back" onclick="openJobHub('${job.id}');">‹ Back to Job Card</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;">Update Job Status</p>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">Job No: ${job.id} · Customer: ${jEsc(c ? c.name : '—')} · Project: ${jEsc(job.projectName)}</p>
    </div>
    <div class="sales-card"><p style="font-weight:700;font-size:13px;margin-bottom:6px;">Current Status</p>${existingHtml}</div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Set Status</p>
      ${rowsHtml}
      <button class="secondary" style="margin-top:6px;" onclick="jobsAddStatusRow()">+ Add Row</button>
    </div>
    <button class="primary" style="width:100%;" onclick="jobsSubmitStatus()">Submit</button>`;
}

function jobsStatusRowChanged(i, key, val) { jobsStatusRows[i][key] = val; }
function jobsAddStatusRow() { jobsStatusRows.push({ lineId: '', department: JOB_DEPARTMENTS[0], status: JOB_LINE_STATUSES[0] }); renderJobsBody(); }
function jobsSubmitStatus() {
  const valid = jobsStatusRows.filter(r => r.lineId);
  if (valid.length === 0) { jobsAlert('Pick at least one item.'); return; }
  valid.forEach(r => updateJobLineStatus(jobsActiveJobId, Number(r.lineId), r.department, r.status));
  jobsAlert('✓ Status updated.');
  openJobHub(jobsActiveJobId);
}

// ══════════════════════════════════════════
// LABOUR COST (actual, vs. Estimator's earlier estimate)
// ══════════════════════════════════════════

let jobsLabourRows = [];

function openLabourCost(jobId) {
  if (typeof salesBlocked==='function' && salesBlocked('labourCost', jobsAlert)) return;
  jobsActiveJobId = jobId;
  jobsView = 'labour';
  jobsLabourRows = [{ employee: STAFF[0], jobItemLineId: '', normalHrs: 0, otHrs: 0, normalRate: 0, otRate: 0 }];
  renderJobsBody();
}

function renderLabourCost() {
  const job = getJobCard(jobsActiveJobId);
  if (!job) return `<p style="font-size:12.5px;color:#64748b;">Job Card not found.</p>`;
  const c = customers.find(x => x.id === job.customerId);

  const existingHtml = job.labourCostEntries.length === 0 ? `<p style="font-size:12px;color:#64748b;">No labour cost entries yet.</p>` : `
    <table class="sales-items"><tr><th>Employee</th><th>Normal Hrs</th><th>OT</th><th>Amount</th></tr>
    ${job.labourCostEntries.map(e => `<tr><td>${jEsc(e.employee)}</td><td>${e.normalHrs}</td><td>${e.otHrs}</td><td>${e.amount.toFixed(3)}</td></tr>`).join('')}
    </table>`;

  const rowsHtml = jobsLabourRows.map((r, i) => `
    <div class="job-row-add">
      <select style="flex:2;" onchange="jobsLabourRowChanged(${i},'employee',this.value)">${STAFF.map(s => `<option value="${s}" ${r.employee === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <select style="flex:2;" onchange="jobsLabourRowChanged(${i},'jobItemLineId',this.value)">
        <option value="">Job Item…</option>
        ${job.items.map(it => `<option value="${it.lineId}" ${r.jobItemLineId == it.lineId ? 'selected' : ''}>${jEsc(it.product)}</option>`).join('')}
      </select>
      <input style="flex:1;" type="number" placeholder="Normal Hrs" value="${r.normalHrs}" onchange="jobsLabourRowChanged(${i},'normalHrs',Number(this.value))">
      <input style="flex:1;" type="number" placeholder="OT" value="${r.otHrs}" onchange="jobsLabourRowChanged(${i},'otHrs',Number(this.value))">
      <input style="flex:1;" type="number" placeholder="Rate" value="${r.normalRate}" onchange="jobsLabourRowChanged(${i},'normalRate',Number(this.value))">
      <input style="flex:1;" type="number" placeholder="OT Rate" value="${r.otRate}" onchange="jobsLabourRowChanged(${i},'otRate',Number(this.value))">
    </div>`).join('');

  return `
    <span class="sales-back" onclick="openJobHub('${job.id}');">‹ Back to Job Card</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;">Labour Cost</p>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">Customer: ${jEsc(c ? c.name : '—')} · Project: ${jEsc(job.projectName)} · Ref: ${job.id}</p>
    </div>
    <div class="sales-card"><p style="font-weight:700;font-size:13px;margin-bottom:6px;">Recorded</p>${existingHtml}</div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Add Entry</p>
      ${rowsHtml}
      <button class="secondary" style="margin-top:6px;" onclick="jobsAddLabourRow()">+ Add Row</button>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="primary" style="flex:1;" onclick="jobsSubmitLabour()">Submit</button>
      <button class="secondary" style="flex:1;" onclick="openJobHub('${job.id}');">Exit</button>
    </div>`;
}

function jobsLabourRowChanged(i, key, val) { jobsLabourRows[i][key] = val; }
function jobsAddLabourRow() { jobsLabourRows.push({ employee: STAFF[0], jobItemLineId: '', normalHrs: 0, otHrs: 0, normalRate: 0, otRate: 0 }); renderJobsBody(); }
function jobsSubmitLabour() {
  const valid = jobsLabourRows.filter(r => r.normalHrs > 0 || r.otHrs > 0);
  if (valid.length === 0) { jobsAlert('Enter hours for at least one entry.'); return; }
  valid.forEach(r => addLabourCostEntry(jobsActiveJobId, r));
  jobsAlert('✓ Labour cost recorded.');
  openJobHub(jobsActiveJobId);
}

// ══════════════════════════════════════════
// PURCHASE REQUEST (JOB) — bonus discovery, own lavender accent
// ══════════════════════════════════════════

let prJobDraft = null;
let prJobItems = [];

function openPurchaseRequestJob(jobId) {
  const job = getJobCard(jobId);
  jobsActiveJobId = jobId;
  jobsView = 'prjob';
  prJobDraft = { division: SALES_DIVISIONS[0], department: 'carp', jobId, type: 'Job' };
  prJobItems = [];
  renderJobsBody();
}

function renderPurchaseRequestJob() {
  const job = getJobCard(jobsActiveJobId);
  if (!job) return `<p style="font-size:12.5px;color:#64748b;">Job Card not found.</p>`;
  const c = customers.find(x => x.id === job.customerId);

  const rowsHtml = prJobItems.length === 0 ? '' : `
    <table class="sales-items"><tr><th>SL</th><th>Product</th><th>Qty</th><th>UOM</th><th>Remarks</th><th></th></tr>
    ${prJobItems.map((it, i) => `<tr><td>${i + 1}</td><td>${jEsc(it.name)}</td><td>${it.qty}</td><td>${jEsc(it.unit)}</td><td>${jEsc(it.remarks)}</td><td><span style="cursor:pointer;color:#b91c1c;" onclick="prJobRemoveItem(${i})">✕</span></td></tr>`).join('')}
    </table>`;

  return `
    <span class="sales-back" onclick="openJobHub('${job.id}');">‹ Back to Job Card</span>
    <div class="sales-card prjob-header" style="padding:14px;">
      <h2 style="font-size:15px;margin-bottom:2px;">Purchase Request (Job)</h2>
      <small style="font-size:11.5px;">PR Date: ${new Date().toISOString().slice(0, 10)} · PR No: ${nextPRId()}</small>
    </div>
    <div class="sales-card">
      <div class="sales-field"><label>Division</label>
        <select onchange="prJobDraft.division=this.value">${SALES_DIVISIONS.map(d => `<option value="${d}" ${prJobDraft.division === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
      </div>
      <div class="sales-field"><label>Dept</label>
        <select onchange="prJobDraft.department=this.value">${DEPTS.map(d => `<option value="${d.k}" ${prJobDraft.department === d.k ? 'selected' : ''}>${d.n}</option>`).join('')}</select>
      </div>
      <div class="sales-field"><label>Type</label><input type="text" value="Job" disabled style="background:var(--biz-border-light);"></div>
      <div class="sales-field"><label>Job No</label><input type="text" value="${job.id}" disabled style="background:var(--biz-border-light);"></div>
      <div class="sales-preview">
        <p style="font-weight:700;color:#1a1f2e;margin-bottom:4px;">Project Details</p>
        <p><b>Client:</b> ${jEsc(c ? c.name : '—')}</p>
        <p><b>Project Name:</b> ${jEsc(job.projectName)}</p>
      </div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Add Item</p>
      <div class="sales-field"><label>Product/Service</label><input type="text" id="prjob-product"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field"><label>Qty</label><input type="number" id="prjob-qty" value="1"></div>
        <div class="sales-field"><label>Unit</label><select id="prjob-unit">${units.map(u => `<option value="${u.name}">${u.name}</option>`).join('')}</select></div>
      </div>
      <div class="sales-field"><label>Remarks</label><input type="text" id="prjob-remarks"></div>
      <button class="secondary" style="width:100%;" onclick="prJobAddItem()">+ Add</button>
    </div>
    <div class="sales-card">${rowsHtml || '<p style="font-size:12px;color:#64748b;">No items added yet.</p>'}</div>
    <div style="display:flex;gap:8px;">
      <button class="primary" style="flex:1;" onclick="prJobSubmit()">Submit</button>
      <button class="secondary" style="flex:1;" onclick="openJobHub('${job.id}');">Exit</button>
    </div>`;
}

function prJobAddItem() {
  const name = document.getElementById('prjob-product').value;
  if (!name) { jobsAlert('Product/Service is required.'); return; }
  prJobItems.push({
    name, qty: Number(document.getElementById('prjob-qty').value),
    unit: document.getElementById('prjob-unit').value,
    remarks: document.getElementById('prjob-remarks').value
  });
  renderJobsBody();
}
function prJobRemoveItem(i) { prJobItems.splice(i, 1); renderJobsBody(); }
function prJobSubmit() {
  if (prJobItems.length === 0) { jobsAlert('Add at least one item.'); return; }
  const pr = raisePurchaseRequest({
    department: prJobDraft.department, raisedBy: 'Jobs Module', linkedJobId: prJobDraft.jobId,
    destinationType: 'job-direct', items: prJobItems, division: prJobDraft.division
  });
  jobsAlert(`✓ Purchase Request ${pr.id} raised.`);
  openJobHub(prJobDraft.jobId);
}

// ══════════════════════════════════════════
// TAX INVOICE — generated from a Job Card, print/PDF-style view
// ══════════════════════════════════════════

// Proforma generation moved to Accounts (accountsGenerateProforma() in
// accounts.js) — Salman's call, 3 Aug 2026: Sales/Jobs shouldn't be able
// to trigger creation of a financial document, only view it read-only via
// renderRelatedRecords() above.
function jobsGenerateInvoice(jobId) {
  if (typeof salesBlocked==='function' && salesBlocked('invoice', jobsAlert)) return;
  const lpoNo = window.prompt("Customer's LPO No (optional — leave blank if none):", '') || null;
  const inv = generateInvoiceFromJob(jobId, { lpoNo });
  if (inv.error) { jobsAlert(inv.error); return; }
  jobsAlert(`✓ Invoice ${inv.id} generated.`);
  openInvoicePrint(inv.id);
}

function openInvoicePrint(invoiceId) {
  jobsActiveInvoiceId = invoiceId;
  jobsView = 'invoice';
  renderJobsBody();
}

function renderInvoicePrint() {
  const inv = taxInvoices.find(i => i.id === jobsActiveInvoiceId);
  if (!inv) return `<p style="font-size:12.5px;color:#64748b;">Invoice not found.</p>`;
  const job = getJobCard(inv.jobId);
  const c = customers.find(x => x.id === inv.customerId);

  const rows = inv.items.map((it, i) => `
    <tr><td>${i + 1}</td><td>${jEsc(it.description)}</td><td class="r">${it.qty}</td><td class="r">${it.rate.toFixed(3)} /${jEsc(it.unit)}</td><td class="r">${it.amount.toFixed(3)}</td></tr>`).join('');

  return `
    <span class="sales-back" onclick="openJobHub('${job.id}');">‹ Back to Job Card</span>
    <div class="invoice-paper">
      <div class="invoice-top">
        <div class="invoice-logo">◣ AL MARAYA<small>DECOR W.L.L.</small></div>
        <div class="invoice-title">TAX INVOICE<small>${jEsc(inv.id)}</small></div>
      </div>
      <div class="invoice-meta-row">
        <div>
          <div class="lbl">Submitted To</div>
          <div style="font-size:13px;font-weight:700;">${jEsc(c ? c.name : '—')}</div>
          <div>${jEsc(c ? c.address : '—')}</div>
          <div>${jEsc(job.projectName)}</div>
        </div>
        <div style="text-align:right;">
          <div><span class="lbl">Date</span> ${inv.date}</div>
          <div><span class="lbl">Quote No</span> ${jEsc(inv.quotationId)}</div>
          <div><span class="lbl">Job No</span> ${jEsc(inv.jobId)}</div>
          <div><span class="lbl">LPO No</span> ${jEsc(inv.lpoNo) || '—'}</div>
        </div>
      </div>
      <hr class="invoice-hr">
      <table class="invoice-items">
        <tr><th>#</th><th>Item Description</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr>
        ${rows}
      </table>
      <div class="invoice-totals">
        <div class="invoice-totals-row"><span>Total</span><span>BD ${inv.totals.total.toFixed(3)}</span></div>
        <div class="invoice-totals-row"><span>Invoiced (${inv.totals.invoicedPercent}%)</span><span>BD ${(inv.totals.total * inv.totals.invoicedPercent / 100).toFixed(3)}</span></div>
        <div class="invoice-totals-row"><span>VAT</span><span>BD ${inv.totals.vat.toFixed(3)}</span></div>
        <div class="invoice-totals-row net"><span>Net Total</span><span>BD ${inv.totals.netTotal.toFixed(3)}</span></div>
      </div>
      <div class="invoice-payment">
        <div class="invoice-qr">Benefit Pay QR<br>(placeholder — no real payment integration wired)</div>
        <div>
          <b>Bank Details</b><br>
          [Bank name — placeholder]<br>
          IBAN: [placeholder — not captured]<br>
          Account Name: Al Maraya Decor W.L.L.
        </div>
      </div>
      <div class="invoice-sign">
        For Al Maraya Decor W.L.L.
        <div class="line">Authorised signatory</div>
      </div>
      <div class="invoice-footer">
        Al Maraya Decor W.L.L. — [Registration address / contact — placeholder]<br>
        شركة المرايا للديكور ذ.م.م — [العنوان المسجل / بيانات الاتصال — نص مؤقت]
      </div>
    </div>
    <div style="display:flex;gap:8px;max-width:560px;margin:0 auto;">
      <button class="primary" style="flex:1;" onclick="jobsAlert('Print/PDF export not wired to a document generator yet.')">Print / Download PDF</button>
      <button class="secondary" style="flex:1;" onclick="openJobHub('${job.id}');">Exit</button>
    </div>`;
}

// ══════════════════════════════════════════
// BATCH 6 — REPORTS (Job report, Project Outstanding, Project wise
// Invoice & Receipt). Data/computation lives in data.js — UI only here.
// ══════════════════════════════════════════

function jobsSetReportsTab(t) { jobsReportsTab = t; jobsReportSearch = ''; renderJobsBody(); }
function jobsReportSearchChanged(v) { jobsReportSearch = v; renderJobsBody(); }

function renderJobsReports() {
  const tabs = `
    <span class="sales-back" onclick="jobsView='list';renderJobsBody();">‹ Back to Job Card List</span>
    <div class="sales-tabs">
      <button class="sales-tabbtn ${jobsReportsTab === 'job-report' ? 'active' : ''}" onclick="jobsSetReportsTab('job-report')">Job Report</button>
      <button class="sales-tabbtn ${jobsReportsTab === 'project-outstanding' ? 'active' : ''}" onclick="jobsSetReportsTab('project-outstanding')">Project Outstanding</button>
      <button class="sales-tabbtn ${jobsReportsTab === 'proj-inv-receipt' ? 'active' : ''}" onclick="jobsSetReportsTab('proj-inv-receipt')">Project wise Invoice &amp; Receipt</button>
    </div>`;
  let content = '';
  if (jobsReportsTab === 'job-report') content = renderJobReportView();
  else if (jobsReportsTab === 'project-outstanding') content = renderProjectOutstandingView();
  else content = renderProjectWiseInvoiceReceiptView();
  return tabs + content;
}

function jobsSearchBoxHtml(placeholder) {
  return `
    <div class="sales-card">
      <div class="sales-field" style="margin-bottom:0;"><label>Job No</label>
        <input type="text" placeholder="${placeholder}" value="${jEsc(jobsReportSearch)}" oninput="jobsReportSearchChanged(this.value)">
      </div>
    </div>`;
}

// ── Job Report — single Job No lookup, a per-job mini P&L ──
function renderJobReportView() {
  const search = jobsSearchBoxHtml('e.g. JB26AMD01000');
  if (!jobsReportSearch) return search + `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">Enter a Job No to view its report.</p></div>`;
  const job = jobCards.find(j => j.id.toLowerCase() === jobsReportSearch.trim().toLowerCase());
  if (!job) return search + `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No Job Card found for "${jEsc(jobsReportSearch)}".</p></div>`;
  const r = getJobReport(job.id);
  const row = (label, val) => `<tr><td>${label}</td><td style="text-align:right;font-weight:600;">${val}</td></tr>`;
  return search + `
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;">${jEsc(job.id)} <span style="font-weight:400;color:#94a3b8;">· ${r.date}</span></p>
      <p style="font-size:12px;color:#64748b;">Client: ${jEsc(r.customer ? r.customer.name : '—')} · Project: ${jEsc(r.projectName)}</p>
    </div>
    <div class="sales-card">
      <table class="sales-items">
        ${row('Job Amount', 'BD ' + r.jobAmount.toFixed(3))}
        ${row('Total Purchases', 'BD ' + r.totalPurchases.toFixed(3))}
        ${row('Materials Issued', r.materialsIssuedCount + ' move(s)')}
        ${row('Materials Returned', r.materialsReturnedCount + ' move(s)')}
        ${row('PO Pending', 'BD ' + r.poPending.toFixed(3))}
        ${row('Budget (Dry Cost)', 'BD ' + r.budgetDryCost.toFixed(3))}
        ${row('Budget (with Overhead)', 'BD ' + r.budgetWithOH.toFixed(3))}
        ${row('Total Cost', 'BD ' + r.totalCost.toFixed(3))}
        ${row('Running Profit', 'BD ' + r.runningProfit.toFixed(3))}
        ${row('Proforma', 'BD ' + r.proforma.toFixed(3))}
        ${row('Invoiced', 'BD ' + r.invoiced.toFixed(3))}
        ${row('Received', 'BD ' + r.received.toFixed(3))}
      </table>
      <p style="font-size:10.5px;color:#94a3b8;margin-top:6px;">Materials Issued/Returned are shown as move counts, not a currency value — this app doesn't carry a rate/cost on Material Issue/Return moves (same as the Stock Report). Budget comes from the Estimator's BOM cost-plus waterfall, where one was run; Total Cost is real incurred spend (received Purchase Invoices + logged Labour Cost) — the two are independent figures, not expected to match.</p>
    </div>`;
}

// ── Project Outstanding — job-level receivables reconciliation ──
function renderProjectOutstandingView() {
  const rows = getProjectOutstanding().slice().sort((a, b) => b.date.localeCompare(a.date));
  if (rows.length === 0) return `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No job cards yet.</p></div>`;
  return `<div class="sales-card" style="overflow-x:auto;">
    <table class="sales-items"><tr><th>Job No</th><th>Qtn No</th><th>Job Date</th><th>Client</th><th>Salesman</th><th>Job Amt</th><th>Inv Amt</th><th>Paid Amt</th><th>Cr Amt</th><th>Uninv Amt</th><th>Balance</th></tr>
    ${rows.map(r => {
      const s = jobRowSummary(r.job);
      return `<tr><td>${jEsc(r.jobId)}</td><td>${jEsc(r.qtnId)}</td><td>${r.date}</td><td>${jEsc(s.client)}</td><td>${jEsc(s.salesman)}</td><td>${r.jobAmt.toFixed(3)}</td><td>${r.invAmt.toFixed(3)}</td><td>${r.paidAmt.toFixed(3)}</td><td>${r.crAmt.toFixed(3)}</td><td>${r.uninvAmt.toFixed(3)}</td><td>${r.balance.toFixed(3)}</td></tr>`;
    }).join('')}
    </table>
  </div>`;
}

// ── Project wise Invoice & Receipt — single Job No lookup ──
function renderProjectWiseInvoiceReceiptView() {
  const search = jobsSearchBoxHtml('e.g. JB26AMD01000');
  if (!jobsReportSearch) return search + `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">Enter a Job No to view its invoice/receipt ledger.</p></div>`;
  const job = jobCards.find(j => j.id.toLowerCase() === jobsReportSearch.trim().toLowerCase());
  if (!job) return search + `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No Job Card found for "${jEsc(jobsReportSearch)}".</p></div>`;
  const rows = getProjectWiseInvoiceReceipt(job.id);
  if (rows.length === 0) return search + `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No invoices or receipts recorded against ${jEsc(job.id)} yet.</p></div>`;
  return search + `<div class="sales-card" style="overflow-x:auto;">
    <table class="sales-items"><tr><th>#</th><th>Doc No.</th><th>Date</th><th>Debit Amount</th><th>Credit Amount</th></tr>
    ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${jEsc(r.docNo)}</td><td>${r.date}</td><td>${r.debit ? r.debit.toFixed(3) : ''}</td><td>${r.credit ? r.credit.toFixed(3) : ''}</td></tr>`).join('')}
    </table>
  </div>`;
}

// ══════════════════════════════════════════
// BATCH 7 — VARIATION ORDERS + TASKS/ACTIVITY LOG (Job Card hub surface)
// Data/computation lives in data.js (createVariationForJob/
// confirmVariationToJobCard/getVariationsForJob, createTask/completeTask/
// getTasksFor, logActivity/getActivityFor). This is UI only.
// ══════════════════════════════════════════

function jobsNewVariation(jobId) {
  const result = createVariationForJob(jobId);
  if (result.error) { jobsAlert(result.error); return; }
  jobsAlert(`✓ Variation ${result.id} created — continue in Sales to add items.`);
  hideModuleWrap(jobsModuleWrap);
  setTimeout(() => { openSalesModule(); openQuotationWizard(result.id, 2); }, 150);
}

function renderJobVariations(job) {
  const variations = getVariationsForJob(job.id);
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Variations (${variations.length})</p>
      ${variations.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No variations yet — use "New Variation" above for additions/changes/returns on this job without starting a new Enquiry.</p>` :
        `<table class="sales-items"><tr><th>Variation</th><th>Date</th><th>Status</th><th>Stage</th></tr>
        ${variations.map(v => `<tr style="cursor:pointer;" onclick="hideModuleWrap(jobsModuleWrap);setTimeout(()=>{openSalesModule();openQuotationHub('${v.id}');},150);"><td>${jEsc(v.id)}</td><td>${v.date}</td><td><span class="sales-pill ${v.lifecycleStatus}">${v.lifecycleStatus}</span></td><td>${v.lifecycleStatus === 'confirmed' ? 'Merged' : v.stage}</td></tr>`).join('')}
        </table>`}
    </div>`;
}

let jobsNewTaskDraft = null;
function jobsOpenNewTask(jobId) { jobsNewTaskDraft = { jobId, title: '', assignee: STAFF[0], dueDate: '' }; renderJobsBody(); }
function jobsCancelNewTask() { jobsNewTaskDraft = null; renderJobsBody(); }
function jobsSaveNewTask() {
  const title = document.getElementById('jt-title').value;
  const assignee = document.getElementById('jt-assignee').value;
  const dueDate = document.getElementById('jt-due').value || null;
  const result = createTask({ title, assignee, dueDate, linkedType: 'job', linkedId: jobsNewTaskDraft.jobId });
  if (result.error) { jobsAlert(result.error); return; }
  jobsAlert(`✓ Task created.`);
  jobsNewTaskDraft = null;
  renderJobsBody();
}
function jobsCompleteTask(id) { completeTask(id); renderJobsBody(); }

function renderJobTasksAndActivity(job) {
  const jobTasks = getTasksFor('job', job.id);
  const openTasks = jobTasks.filter(t => t.status === 'open');
  const doneTasks = jobTasks.filter(t => t.status === 'done');
  const activity = getActivityFor('job', job.id);
  const showForm = jobsNewTaskDraft && jobsNewTaskDraft.jobId === job.id;

  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Tasks (${openTasks.length} open)</p>
      ${openTasks.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No open tasks on this job.</p>` :
        `<table class="sales-items"><tr><th>Task</th><th>Assignee</th><th>Due</th><th></th></tr>
        ${openTasks.map(t => `<tr><td>${jEsc(t.title)}</td><td>${jEsc(t.assignee)}</td><td>${t.dueDate || '—'}</td><td><span style="cursor:pointer;color:#0f9d58;font-size:11px;" onclick="jobsCompleteTask('${t.id}')">✓ Done</span></td></tr>`).join('')}
        </table>`}
      ${doneTasks.length > 0 ? `<p style="font-size:10.5px;color:#94a3b8;margin-top:6px;">${doneTasks.length} completed task(s) not shown.</p>` : ''}
      ${showForm ? `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--biz-border-light);">
          <div class="sales-field"><label>Title</label><input type="text" id="jt-title"></div>
          <div class="sales-field"><label>Assignee</label><select id="jt-assignee">${STAFF.map(s => `<option value="${s}">${s}</option>`).join('')}</select></div>
          <div class="sales-field"><label>Due Date</label><input type="date" id="jt-due"></div>
          <div style="display:flex;gap:8px;">
            <button class="primary" style="flex:1;" onclick="jobsSaveNewTask()">Save Task</button>
            <button class="secondary" style="flex:1;" onclick="jobsCancelNewTask()">Cancel</button>
          </div>
        </div>` : `<button class="secondary" style="width:100%;margin-top:8px;" onclick="jobsOpenNewTask('${job.id}')">+ Add Task</button>`}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Activity</p>
      ${activity.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No activity logged yet.</p>` :
        activity.map(a => `<p style="font-size:11.5px;color:#334155;margin:4px 0;">${a.date} · <b>${jEsc(a.user)}</b> — ${jEsc(a.message)}</p>`).join('')}
    </div>`;
}
