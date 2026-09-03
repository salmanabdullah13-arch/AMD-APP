// ══════════════════════════════════════════
// JOINERY MODULE
// Built session: 3 Aug 2026 (Batch 8, Phase 2). One of the two ecosystem-
// hub placeholders that finally got built — Salman's own reasoning:
// Joinery (timber/hardware-driven) shares more with Operations' own
// dept-budget-vs-actuals tracking than with Curtain's bespoke workshop
// build, so this and upholstery.js consume ONE shared production-pipeline
// primitive (getDepartmentQueue/startLineProduction/submitLineForQC/
// recordLineQCResult/handOffLine/reworkLineBackToProduction, all in
// data.js) parameterized by department key ('carp' here, 'uph' in
// upholstery.js) rather than each being a bespoke ~5,900-line file the
// way Curtain is. Painting deliberately does NOT share any of this — see
// painting.js's own header comment for why.
// ══════════════════════════════════════════

const JOINERY_DEPT_KEY = 'carp';
const joineryStyleTag = document.createElement('style');
joineryStyleTag.textContent = `
#joinery-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#joinery-module-wrap .ops-header{background:var(--biz-primary);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#joinery-module-wrap .joinery-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#joinery-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;}
#joinery-module-wrap .sales-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#joinery-module-wrap .sales-kpi-tile .num{font-size:21px;font-weight:700;color:var(--biz-primary);}
#joinery-module-wrap .sales-kpi-tile .lbl{font-size:10.5px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#joinery-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#joinery-module-wrap .sales-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#joinery-module-wrap .sales-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:var(--biz-card-bg);color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#joinery-module-wrap .sales-tabbtn.active{background:var(--biz-primary);border-color:var(--biz-primary);color:#fff;}
#joinery-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
#joinery-module-wrap table.sales-items th{text-align:left;padding:7px 6px;background:var(--biz-input-bg);color:var(--biz-text-muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--biz-border-light);}
#joinery-module-wrap table.sales-items td{padding:7px 6px;border-bottom:1px solid var(--biz-border-light);}
#joinery-module-wrap .stage-pill{display:inline-block;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap;}
#joinery-module-wrap .stage-pill.queued{background:#eef0f3;color:#475569;}
#joinery-module-wrap .stage-pill.in-production{background:var(--warn-bg,#fff6e3);color:var(--warn,#c47d00);}
#joinery-module-wrap .stage-pill.qc{background:#e0ecfb;color:var(--info,#2563eb);}
#joinery-module-wrap .stage-pill.rework{background:var(--bad-bg,#fdeceb);color:var(--bad,#d9342b);}
#joinery-module-wrap .stage-pill.ready-for-handoff{background:var(--ok-bg,#eafaf1);color:var(--ok,#0f9d58);}
`;
document.head.appendChild(joineryStyleTag);

const joineryModuleWrap = document.createElement('div');
joineryModuleWrap.id = 'joinery-module-wrap';
joineryModuleWrap.style.cssText = 'display:none;';
joineryModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">🪚</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Joinery</div>
        <div style="color:rgba(255,255,255,.7);font-size:11px;">Production · QC</div>
      </div>
    </div>
    <button onclick="closeJoineryModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="joinery-scroll">
    <div id="joinery-body"></div>
  </div>
`;
document.body.appendChild(joineryModuleWrap);

let joineryView = 'dashboard'; // dashboard | queue
const joineryCurrentUser = 'Joinery Production Manager'; // no dedicated STAFF entry today — see project memory on the routing/budgeting design
// joineryApproverUserType() removed (Fix Plan Phase 2, 5 Aug 2026) —
// this module no longer approves budgets at all; that moved to the
// Operations Manager (Operations → Budget Approvals) so the submitting
// manager can never approve their own budget.

function jyEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }
function joineryAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('joinery-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'joinery-toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;padding:10px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

// initialView (optional, Milestone D, 5 Aug 2026, role-based access
// rollout): 'drafting' | 'cutting' | 'veneer-pressing' | 'floor' — see
// the granular-role views below. Omitted, this is the unchanged
// Production Manager dashboard entry point. Assistant Production
// Manager (see data.js's design note) deliberately reuses THIS same
// entry point unmodified rather than getting its own restricted view.
function openJoineryModule(initialView) {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['ops-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap', 'prd-module-wrap', 'uph-module-wrap', 'timer-module-wrap', 'admin-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  joineryModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  joineryView = initialView || 'dashboard';
  execEnsureShell(joineryModuleWrap, { key: 'joinery', title: 'Joinery', role: 'Production', navGroupsFn: EXEC_NAV_CONFIGS.joinery, closeFn: 'closeJoineryModule' });
  renderJoineryBody();
}
function closeJoineryModule() { closeModuleWrap(joineryModuleWrap, 'launchJoineryModule'); }
function launchJoineryModule() { openJoineryModule(); }
// Granular-role entry points (Milestone D).
function launchJoineryDraftingModule() { openJoineryModule('drafting'); }
function launchJoineryCuttingModule() { openJoineryModule('cutting'); }
function launchJoineryVeneerPressingModule() { openJoineryModule('veneer-pressing'); }
function launchJoineryFloorModule() { openJoineryModule('floor'); }

function joinerySetView(v) { joineryView = v; renderJoineryBody(); }

// Granular sub-stage views (Milestone D) — each shows ONLY the carp
// lines currently at that internal sub-stage (see data.js's
// getJoinerySubStageQueue()), with a single action to mark that
// sub-stage done and advance to the next one. No tab bar — Budgets/
// Approvals/the Manager's own Dashboard are structurally unreachable
// from these entry points, same principle as Upholstery's granular
// views (Milestone C).
const JOINERY_SUB_STAGE_LABEL = { drafting: 'Drafting', cutting: 'Cutting', 'veneer-pressing': 'Veneer Pressing', assembly: 'Assembly' };
function renderJoinerySubStageView(subStage) {
  const rows = getJoinerySubStageQueue(subStage);
  const idx = JOINERY_SUB_STAGES.indexOf(subStage);
  const nextStage = JOINERY_SUB_STAGES[idx + 1];
  const label = JOINERY_SUB_STAGE_LABEL[subStage];
  const header = `<p style="font-size:11px;color:#94a3b8;margin:0 0 10px;">${jyEsc(label)} Team — your queue</p>`;
  if (rows.length === 0) return header + `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">Nothing at the ${jyEsc(label)} stage right now.</p></div>`;
  return header + `<div class="sales-card" style="overflow-x:auto;">
    <table class="sales-items"><tr><th>Job</th><th>Product</th><th>Qty</th><th>Action</th></tr>
    ${rows.map(r => {
      const c = customers.find(x => x.id === r.job.customerId);
      return `<tr>
        <td>${jyEsc(r.job.id)}<br><span style="color:#94a3b8;font-size:10.5px;">${jyEsc(c ? c.name : '—')}</span></td>
        <td>${jyEsc(r.item.product)}</td>
        <td>${r.item.qty} ${jyEsc(r.item.unit)}</td>
        <td>${nextStage ? `<button class="primary" style="font-size:10.5px;padding:5px 8px;" onclick="joineryAdvanceSubStage('${r.job.id}',${r.item.lineId},'${nextStage}')">${jyEsc(label)} Done →</button>` : `<span style="font-size:10.5px;color:#94a3b8;">Ready for QC (Submit for QC from Production Queue)</span>`}</td>
      </tr>`;
    }).join('')}
    </table>
  </div>`;
}
function joineryAdvanceSubStage(jobId, lineId, toSubStage) {
  const result = advanceJoinerySubStage(jobId, lineId, toSubStage);
  if (result.error) { joineryAlert(result.error); return; }
  joineryAlert('✓ Advanced to ' + JOINERY_SUB_STAGE_LABEL[toSubStage] + '.');
  renderJoineryBody();
}

// Floor overview (Team Leader/Floor Supervisor/Site Supervisor, shared
// — see the design note in data.js on why these three collapse onto
// one view). Read-only, cross-sub-stage — coordination visibility, not
// an action surface (advancing a sub-stage stays that stage's own
// team's action, via the views above).
function renderJoineryFloorView() {
  const overview = getJoineryFloorOverview();
  const header = `<p style="font-size:11px;color:#94a3b8;margin:0 0 10px;">Floor overview — every Joinery line currently in production, by stage</p>`;
  return header + `<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;">
    ${JOINERY_SUB_STAGES.map(stage => {
      const rows = overview[stage];
      return `<div style="min-width:190px;flex:1;">
        <p style="font-weight:700;font-size:12px;margin:0 0 6px;">${jyEsc(JOINERY_SUB_STAGE_LABEL[stage])} <span style="color:#94a3b8;font-weight:400;">(${rows.length})</span></p>
        ${rows.length === 0 ? `<p style="font-size:11px;color:#94a3b8;">Nothing here.</p>` : rows.map(r => `
          <div class="sales-card" style="padding:8px 10px;margin-bottom:6px;">
            <p style="font-size:12px;font-weight:600;margin:0;">${jyEsc(r.item.product)}</p>
            <p style="font-size:10.5px;color:#94a3b8;margin:0;">${jyEsc(r.job.id)}</p>
          </div>`).join('')}
      </div>`;
    }).join('')}
  </div>`;
}

function renderJoineryBody() {
  const body = document.getElementById('joinery-body');
  if (!body) return;
  if (JOINERY_SUB_STAGES.includes(joineryView)) { body.innerHTML = renderJoinerySubStageView(joineryView); return; }
  if (joineryView === 'floor') { body.innerHTML = renderJoineryFloorView(); return; }
  const tab = (v, label) => `<button class="sales-tabbtn ${joineryView === v ? 'active' : ''}" onclick="joinerySetView('${v}')">${label}</button>`;
  // Fix Plan Phase 2 (5 Aug 2026) — the Approvals tab is gone: the
  // manager who submits a budget can no longer approve it (maker-checker),
  // so approvals live with the Operations Manager (Operations → Budget
  // Approvals) and, over BD 5,000, with Owner. See DEPARTMENT_APPROVERS.
  const tabsHtml = `<div class="sales-tabs">${tab('dashboard', 'Dashboard')}${tab('queue', 'Production Queue')}${tab('budget', 'Budgets')}</div>`;
  let content;
  if (joineryView === 'queue') content = renderDeptQueue(JOINERY_DEPT_KEY, joineryCurrentUser, 'joinery');
  else if (joineryView === 'budget') content = renderDeptBudgetTab(JOINERY_DEPT_KEY, joineryCurrentUser, 'joinery');
  else content = renderJoineryDashboard();
  body.innerHTML = tabsHtml + content;
}

function renderJoineryDashboard() {
  const rows = getDepartmentQueue(JOINERY_DEPT_KEY);
  const count = s => rows.filter(r => r.entry.status === s).length;
  // Fix Plan Phase 2 (5 Aug 2026) — "Budgets Pending" now means Joinery's
  // OWN submissions still awaiting the Operations Manager's (or, over
  // BD 5,000, Owner's) approval — this manager no longer approves anything
  // here, including Painting's (that pairing ended with the maker-checker
  // change; Painting's budgets go to Operations like everyone else's).
  const pendingApprovals = getOwnPendingBudgetCountForDept(JOINERY_DEPT_KEY);
  const overBudget = getOverBudgetCountForDept(JOINERY_DEPT_KEY);
  return `
    <div class="sales-kpi-grid">
      <div class="sales-kpi-tile"><div class="num">${count('queued')}</div><div class="lbl">Queued</div></div>
      <div class="sales-kpi-tile"><div class="num">${count('in-production')}</div><div class="lbl">In Production</div></div>
      <div class="sales-kpi-tile"><div class="num">${count('qc')}</div><div class="lbl">Awaiting QC</div></div>
      <div class="sales-kpi-tile"><div class="num">${count('rework')}</div><div class="lbl">In Rework</div></div>
      <div class="sales-kpi-tile" style="cursor:pointer;" onclick="joinerySetView('budget')"><div class="num" style="${pendingApprovals ? 'color:var(--warn,#c47d00);' : ''}">${pendingApprovals}</div><div class="lbl">Budgets Pending</div></div>
      <div class="sales-kpi-tile"><div class="num" style="${overBudget ? 'color:var(--bad,#d9342b);' : ''}">${overBudget}</div><div class="lbl">Over Budget</div></div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Ready for hand-off</p>
      <p style="font-size:22px;font-weight:700;color:var(--ok,#0f9d58);">${count('ready-for-handoff')}</p>
      <p style="font-size:11px;color:#94a3b8;">Passed QC, waiting to move to the next department (or finish, if this was the last stop).</p>
    </div>
    ${renderDeptQueuePreview(JOINERY_DEPT_KEY, 'joinery', 5)}
    ${renderDeptQualityCard(JOINERY_DEPT_KEY)}
    ${renderDeptTasksPanel(joineryCurrentUser, 'joinery')}`;
}
