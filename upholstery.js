// ══════════════════════════════════════════
// UPHOLSTERY MODULE
// Built session: 3 Aug 2026 (Batch 8, Phase 2). See joinery.js's own
// header comment for the full reasoning — Upholstery (fabric-driven,
// closer to Curtain's own reality than to Joinery's timber/hardware one)
// and Joinery share ONE production-pipeline primitive
// (dept-pipeline-ui.js + the pipeline functions in data.js) rather than
// each being a bespoke file. This file is deliberately structured almost
// identically to joinery.js — same shape, different department key/
// identity — since that symmetry IS the shared-pipeline design, not
// duplication to clean up later.
// ══════════════════════════════════════════

const UPHOLSTERY_DEPT_KEY = 'uph';
const upholsteryStyleTag = document.createElement('style');
upholsteryStyleTag.textContent = `
#upholstery-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#upholstery-module-wrap .ops-header{background:var(--biz-primary);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#upholstery-module-wrap .upholstery-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#upholstery-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;}
#upholstery-module-wrap .sales-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#upholstery-module-wrap .sales-kpi-tile .num{font-size:21px;font-weight:700;color:var(--biz-primary);}
#upholstery-module-wrap .sales-kpi-tile .lbl{font-size:10.5px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#upholstery-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#upholstery-module-wrap .sales-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#upholstery-module-wrap .sales-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:var(--biz-card-bg);color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#upholstery-module-wrap .sales-tabbtn.active{background:var(--biz-primary);border-color:var(--biz-primary);color:#fff;}
#upholstery-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
#upholstery-module-wrap table.sales-items th{text-align:left;padding:7px 6px;background:var(--biz-input-bg);color:var(--biz-text-muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--biz-border-light);}
#upholstery-module-wrap table.sales-items td{padding:7px 6px;border-bottom:1px solid var(--biz-border-light);}
#upholstery-module-wrap .stage-pill{display:inline-block;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap;}
#upholstery-module-wrap .stage-pill.queued{background:#eef0f3;color:#475569;}
#upholstery-module-wrap .stage-pill.in-production{background:var(--warn-bg,#fff6e3);color:var(--warn,#c47d00);}
#upholstery-module-wrap .stage-pill.qc{background:#e0ecfb;color:var(--info,#2563eb);}
#upholstery-module-wrap .stage-pill.rework{background:var(--bad-bg,#fdeceb);color:var(--bad,#d9342b);}
#upholstery-module-wrap .stage-pill.ready-for-handoff{background:var(--ok-bg,#eafaf1);color:var(--ok,#0f9d58);}
`;
document.head.appendChild(upholsteryStyleTag);

const upholsteryModuleWrap = document.createElement('div');
upholsteryModuleWrap.id = 'upholstery-module-wrap';
upholsteryModuleWrap.style.cssText = 'display:none;';
upholsteryModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">🛋️</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Upholstery</div>
        <div style="color:rgba(255,255,255,.7);font-size:11px;">Production · QC</div>
      </div>
    </div>
    <button onclick="closeUpholsteryModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="upholstery-scroll">
    <div id="upholstery-body"></div>
  </div>
`;
document.body.appendChild(upholsteryModuleWrap);

let upholsteryView = 'dashboard'; // dashboard | queue
const upholsteryCurrentUser = 'Upholstery Manager'; // no dedicated STAFF entry today — see project memory on the routing/budgeting design
// upholsteryApproverUserType() removed (Fix Plan Phase 2, 5 Aug 2026) —
// this module no longer approves budgets at all; that moved to the
// Operations Manager (Operations → Budget Approvals) so the submitting
// manager can never approve their own budget.

function upEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }
function upholsteryAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('upholstery-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'upholstery-toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;padding:10px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

// initialView (optional, 5 Aug 2026, role-based access rollout):
// 'team-leader' | 'qc-packaging' — jumps straight to a restricted,
// role-scoped view with no tab bar (Manager-level tabs like Budgets/
// Approvals never render for these), used by the granular-role NODES
// entries in index.html. Omitted, this is the unchanged Manager
// dashboard entry point.
function openUpholsteryModule(initialView) {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['ops-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'painting-module-wrap', 'owner-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap', 'prd-module-wrap', 'admin-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  upholsteryModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  upholsteryView = initialView || 'dashboard';
  execEnsureShell(upholsteryModuleWrap, { key: 'upholstery', title: 'Upholstery', role: 'Production', navGroupsFn: EXEC_NAV_CONFIGS.upholstery, closeFn: 'closeUpholsteryModule' });
  renderUpholsteryBody();
}
// Granular-role entry points (Milestone C) — see openUpholsteryModule()'s note.
function launchUpholsteryTeamLeaderModule() { openUpholsteryModule('team-leader'); }
function launchUpholsteryQCPackagingModule() { openUpholsteryModule('qc-packaging'); }
function closeUpholsteryModule() { closeModuleWrap(upholsteryModuleWrap, 'launchUpholsteryModule'); }
function launchUpholsteryModule() { openUpholsteryModule(); }

function upholsterySetView(v) { upholsteryView = v; renderUpholsteryBody(); }

// Granular-role views (Milestone C, 5 Aug 2026) — deliberately render
// with NO tab bar, so a Team Leader/QC-Packaging login can never reach
// Budgets/Approvals or the Manager's own Dashboard by tapping a tab
// that simply isn't there — matches the plan's rule that a granular
// role never falls back to a manager's full view. Each reuses
// renderDeptQueue()'s new optional statusFilter param rather than a
// separate render function, since the table/action markup is identical
// — only which rows show differs.
const UPHOLSTERY_TEAM_LEADER_STATUSES = ['queued', 'in-production', 'rework'];
const UPHOLSTERY_QC_PACKAGING_STATUSES = ['qc', 'ready-for-handoff'];
function renderUpholsteryTeamLeaderView() {
  return `<p style="font-size:11px;color:#94a3b8;margin:0 0 10px;">Team Leader — production queue</p>`
    + renderDeptQueue(UPHOLSTERY_DEPT_KEY, upholsteryCurrentUser, 'upholstery', UPHOLSTERY_TEAM_LEADER_STATUSES);
}
function renderUpholsteryQCPackagingView() {
  return `<p style="font-size:11px;color:#94a3b8;margin:0 0 10px;">QC / Packaging Team — quality &amp; hand-off queue</p>`
    + renderDeptQueue(UPHOLSTERY_DEPT_KEY, upholsteryCurrentUser, 'upholstery', UPHOLSTERY_QC_PACKAGING_STATUSES);
}

function renderUpholsteryBody() {
  const body = document.getElementById('upholstery-body');
  if (!body) return;
  if (upholsteryView === 'team-leader') { body.innerHTML = renderUpholsteryTeamLeaderView(); return; }
  if (upholsteryView === 'qc-packaging') { body.innerHTML = renderUpholsteryQCPackagingView(); return; }
  const tab = (v, label) => `<button class="sales-tabbtn ${upholsteryView === v ? 'active' : ''}" onclick="upholsterySetView('${v}')">${label}</button>`;
  // Fix Plan Phase 2 (5 Aug 2026) — Approvals tab removed; budget
  // approvals moved to the Operations Manager (see DEPARTMENT_APPROVERS).
  const tabsHtml = `<div class="sales-tabs">${tab('dashboard', 'Dashboard')}${tab('queue', 'Production Queue')}${tab('budget', 'Budgets')}</div>`;
  let content;
  if (upholsteryView === 'queue') content = renderDeptQueue(UPHOLSTERY_DEPT_KEY, upholsteryCurrentUser, 'upholstery');
  else if (upholsteryView === 'budget') content = renderDeptBudgetTab(UPHOLSTERY_DEPT_KEY, upholsteryCurrentUser, 'upholstery');
  else content = renderUpholsteryDashboard();
  body.innerHTML = tabsHtml + content;
}

function renderUpholsteryDashboard() {
  const rows = getDepartmentQueue(UPHOLSTERY_DEPT_KEY);
  const count = s => rows.filter(r => r.entry.status === s).length;
  // "Budgets Pending" = Upholstery's OWN submissions awaiting the
  // Operations Manager's (or Owner's, over BD 5,000) approval.
  const pendingApprovals = getOwnPendingBudgetCountForDept(UPHOLSTERY_DEPT_KEY);
  const overBudget = getOverBudgetCountForDept(UPHOLSTERY_DEPT_KEY);
  return `
    <div class="sales-kpi-grid">
      <div class="sales-kpi-tile"><div class="num">${count('queued')}</div><div class="lbl">Queued</div></div>
      <div class="sales-kpi-tile"><div class="num">${count('in-production')}</div><div class="lbl">In Production</div></div>
      <div class="sales-kpi-tile"><div class="num">${count('qc')}</div><div class="lbl">Awaiting QC</div></div>
      <div class="sales-kpi-tile"><div class="num">${count('rework')}</div><div class="lbl">In Rework</div></div>
      <div class="sales-kpi-tile" style="cursor:pointer;" onclick="upholsterySetView('budget')"><div class="num" style="${pendingApprovals ? 'color:var(--warn,#c47d00);' : ''}">${pendingApprovals}</div><div class="lbl">Budgets Pending</div></div>
      <div class="sales-kpi-tile"><div class="num" style="${overBudget ? 'color:var(--bad,#d9342b);' : ''}">${overBudget}</div><div class="lbl">Over Budget</div></div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Ready for hand-off</p>
      <p style="font-size:22px;font-weight:700;color:var(--ok,#0f9d58);">${count('ready-for-handoff')}</p>
      <p style="font-size:11px;color:#94a3b8;">Passed QC, waiting to move to the next department (or finish, if this was the last stop).</p>
    </div>
    ${renderDeptQueuePreview(UPHOLSTERY_DEPT_KEY, 'upholstery', 5)}
    ${renderDeptQualityCard(UPHOLSTERY_DEPT_KEY)}
    ${renderDeptTasksPanel(upholsteryCurrentUser, 'upholstery')}`;
}
