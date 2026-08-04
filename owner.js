// ══════════════════════════════════════════
// OWNER DASHBOARD
// Built 4 Aug 2026. Read-only, cross-department view for Salman —
// reuses every module's own existing KPI function rather than
// recomputing anything (getSalesKPIs, getAccountsKPIs, getCurtainKPIs,
// getPurchasingKPIs, getStockPoolSummary, getHRKPIs, getJobCardKPIs) plus
// the cross-module activityLog[] (see the 4 Aug 2026 Tasks/Activity Log
// retrofit) for a single company-wide recent-activity feed. No actions
// live here beyond quick-launch links into the real modules — this is a
// summary screen, not a management screen.
// ══════════════════════════════════════════

const ownerStyleTag = document.createElement('style');
ownerStyleTag.textContent = `
#owner-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#owner-module-wrap .ops-header{background:var(--biz-primary);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#owner-module-wrap .owner-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#owner-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;}
#owner-module-wrap .sales-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#owner-module-wrap .sales-kpi-tile .num{font-size:18px;font-weight:700;color:var(--biz-primary);}
#owner-module-wrap .sales-kpi-tile .num.alert{color:var(--bad,#d9342b);}
#owner-module-wrap .sales-kpi-tile .lbl{font-size:10px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#owner-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:12px;box-shadow:var(--biz-shadow);}
#owner-module-wrap .sales-card h3{font-weight:700;font-size:13px;margin:0 0 8px;color:#1a1f2e;}
#owner-module-wrap .owner-link{cursor:pointer;color:var(--biz-primary);font-weight:600;font-size:11px;}
#owner-module-wrap .sales-back{font-size:12px;color:var(--biz-primary);font-weight:600;cursor:pointer;margin-bottom:10px;display:inline-block;}
#owner-module-wrap .owner-activity-row{display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--biz-border-light);font-size:11.5px;}
#owner-module-wrap .owner-activity-row:last-child{border-bottom:0;}
#owner-module-wrap .owner-activity-date{color:#94a3b8;white-space:nowrap;font-size:10.5px;}
#owner-module-wrap .owner-dept-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--biz-border-light);font-size:12.5px;}
#owner-module-wrap .owner-dept-row:last-child{border-bottom:0;}
#owner-module-wrap .owner-dept-pill{font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:20px;background:var(--biz-draft-bg,#f1f5f9);color:var(--biz-draft-text,#475569);}
`;
document.head.appendChild(ownerStyleTag);

const ownerModuleWrap = document.createElement('div');
ownerModuleWrap.id = 'owner-module-wrap';
ownerModuleWrap.style.cssText = 'display:none;';
ownerModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">🧭</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Owner Dashboard</div>
        <div style="color:rgba(255,255,255,.7);font-size:11px;">Cross-department overview — read-only</div>
      </div>
    </div>
    <button onclick="closeOwnerModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="owner-scroll">
    <div id="owner-body"></div>
  </div>
`;
document.body.appendChild(ownerModuleWrap);

function ownerEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }

function openOwnerModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  ownerModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  ownerView = 'dashboard';
  renderOwnerBody();
  // Fire-and-forget count for the "Pending Sign-ups" tile above — the
  // dashboard itself renders synchronously as always, this just patches
  // the badge in shortly after, same optimistic-then-patch pattern as
  // every cloud-backed cache in this app.
  if (typeof loadApprovalQueue === 'function') loadApprovalQueue().then(() => { if (ownerView === 'dashboard') renderOwnerBody(); });
}
function closeOwnerModule() {
  ownerModuleWrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}
function launchOwnerModule() { openOwnerModule(); }

// Jumps straight into a real module, same pattern as every other
// cross-module hop in this app (jobsNewVariation, salesRequestPurchase).
function ownerGoTo(fn) {
  closeOwnerModule();
  setTimeout(() => { if (typeof window[fn] === 'function') window[fn](); }, 150);
}
function ownerGoToOperations() {
  closeOwnerModule();
  setTimeout(() => goTo('operations'), 150);
}

// Approvals (5 Aug 2026, role-based access rollout) — the one new
// screen state this dashboard needs; everything else here stays the
// single static summary render it always was. Shared with HR's own
// Approvals tab, see approval-queue.js.
let ownerView = 'dashboard';
function ownerOpenApprovals() { ownerView = 'approvals'; renderOwnerBody(); }
function ownerBackToDashboard() { ownerView = 'dashboard'; renderOwnerBody(); }

function renderOwnerBody() {
  const body = document.getElementById('owner-body');
  if (!body) return;
  if (ownerView === 'approvals') {
    body.innerHTML = `<span class="sales-back" onclick="ownerBackToDashboard()">‹ Back to Dashboard</span><div id="owner-approval-queue"></div>`;
    renderApprovalQueueScreen('owner-approval-queue');
    return;
  }

  const salesK = getSalesKPIs();
  const acctK = getAccountsKPIs();
  const jobK = getJobCardKPIs();
  const purchK = getPurchasingKPIs();
  const stockK = getStockPoolSummary();
  const hrK = getHRKPIs();
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const hrRiskCount = Object.values(hrK).reduce((s, g) => s + g.expiring.length + g.expired.length, 0);

  const withEstimator = quotations.filter(q => q.stage === 'estimator').length;
  const withApprover = quotations.filter(q => q.stage === 'approver').length;
  const jobsPendingRouting = getJobsPendingRouting().length;
  const pendingBudgetApprovals = getAllPendingBudgetApprovals().length;

  const curtK = getCurtainKPIs();
  const joineryQueue = getDepartmentQueue('carp').length;
  const upholsteryQueue = getDepartmentQueue('uph').length;
  const paintingQueue = getPaintingQueue().length;

  const recent = getRecentActivity(20);
  const activityRows = recent.length === 0
    ? `<p style="font-size:12px;color:#64748b;">No activity recorded yet.</p>`
    : recent.map(a => `<div class="owner-activity-row"><span class="owner-activity-date">${a.date}</span><span>${ownerEsc(a.message)} <span style="color:#94a3b8;">— ${ownerEsc(a.user)}</span></span></div>`).join('');

  body.innerHTML = `
    <div class="sales-card">
      <h3>Company Snapshot</h3>
      <div class="sales-kpi-grid">
        <div class="sales-kpi-tile"><div class="num">BD ${acctK.revenue.toFixed(0)}</div><div class="lbl">Revenue</div></div>
        <div class="sales-kpi-tile"><div class="num">BD ${acctK.receivables.toFixed(0)}</div><div class="lbl">Receivables</div></div>
        <div class="sales-kpi-tile"><div class="num">BD ${acctK.payables.toFixed(0)}</div><div class="lbl">Payables</div></div>
        <div class="sales-kpi-tile"><div class="num">${jobK.open}</div><div class="lbl">Jobs Open</div></div>
        <div class="sales-kpi-tile"><div class="num">${jobK.completed}</div><div class="lbl">Jobs Completed</div></div>
        <div class="sales-kpi-tile"><div class="num">${activeEmployees}</div><div class="lbl">Active Staff</div></div>
      </div>
      <span class="owner-link" onclick="ownerGoTo('launchAccountsModule')">Open Accounts →</span>
      <span class="owner-link" style="margin-left:14px;" onclick="ownerOpenApprovals()">Pending Sign-ups${approvalQueueRows.length ? ' (' + approvalQueueRows.length + ')' : ''} →</span>
    </div>

    <div class="sales-card">
      <h3>Sales Pipeline</h3>
      <div class="sales-kpi-grid">
        <div class="sales-kpi-tile"><div class="num">${salesK.unallocated}</div><div class="lbl">Un-allocated</div></div>
        <div class="sales-kpi-tile"><div class="num">${withEstimator}</div><div class="lbl">With Estimator</div></div>
        <div class="sales-kpi-tile"><div class="num">${withApprover}</div><div class="lbl">With Approver</div></div>
      </div>
      <span class="owner-link" onclick="ownerGoTo('launchSalesModule')">Open Sales →</span>
    </div>

    <div class="sales-card">
      <h3>Operations &amp; Production</h3>
      <div class="owner-dept-row"><span>Jobs awaiting routing</span><span class="owner-dept-pill">${jobsPendingRouting}</span></div>
      <div class="owner-dept-row"><span>Department budgets pending approval</span><span class="owner-dept-pill">${pendingBudgetApprovals}</span></div>
      <div class="owner-dept-row"><span>Joinery queue</span><span class="owner-dept-pill">${joineryQueue}</span></div>
      <div class="owner-dept-row"><span>Upholstery queue</span><span class="owner-dept-pill">${upholsteryQueue}</span></div>
      <div class="owner-dept-row"><span>Painting queue</span><span class="owner-dept-pill">${paintingQueue}</span></div>
      <div class="owner-dept-row"><span>Curtain running jobs</span><span class="owner-dept-pill">${curtK.totalRunningJobs}</span></div>
      <div class="owner-dept-row"><span>Curtain windows behind schedule</span><span class="owner-dept-pill" style="${curtK.windowsBehindSchedule > 0 ? 'background:#fdeceb;color:#d9342b;' : ''}">${curtK.windowsBehindSchedule}</span></div>
      <div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;">
        <span class="owner-link" onclick="ownerGoToOperations()">Operations →</span>
        <span class="owner-link" onclick="ownerGoTo('launchJoineryModule')">Joinery →</span>
        <span class="owner-link" onclick="ownerGoTo('launchUpholsteryModule')">Upholstery →</span>
        <span class="owner-link" onclick="ownerGoTo('launchPaintingModule')">Painting →</span>
        <span class="owner-link" onclick="ownerGoTo('launchCurtainModule')">Curtain →</span>
      </div>
    </div>

    <div class="sales-card">
      <h3>Purchasing &amp; Inventory</h3>
      <div class="sales-kpi-grid">
        <div class="sales-kpi-tile"><div class="num">${purchK.totals.openRequests}</div><div class="lbl">Open PRs</div></div>
        <div class="sales-kpi-tile"><div class="num">${purchK.totals.pendingPOApprovals}</div><div class="lbl">PO Approvals</div></div>
        <div class="sales-kpi-tile"><div class="num">${stockK.inPoolCount}</div><div class="lbl">Stock In Pool</div></div>
      </div>
      <span class="owner-link" onclick="ownerGoTo('launchPurchasingModule')">Open Purchasing →</span>
    </div>

    <div class="sales-card">
      <h3>HR &amp; Compliance</h3>
      <div class="owner-dept-row"><span>Active staff</span><span class="owner-dept-pill">${activeEmployees}</span></div>
      <div class="owner-dept-row"><span>Documents expiring/expired</span><span class="owner-dept-pill" style="${hrRiskCount > 0 ? 'background:#fff6e3;color:#c47d00;' : ''}">${hrRiskCount}</span></div>
      <span class="owner-link" onclick="ownerGoTo('launchHRModule')">Open HR →</span>
    </div>

    <div class="sales-card">
      <h3>Recent Activity (company-wide)</h3>
      ${activityRows}
    </div>`;
}
