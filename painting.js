// ══════════════════════════════════════════
// PAINTING MODULE — standalone
// Built session: 3 Aug 2026 (Batch 8, Phase 3). Deliberately built
// independent of joinery.js/upholstery.js/dept-pipeline-ui.js — Salman's
// explicit instruction: Painting has its own materials and process lead
// times, "I don't want it to share anything." Own queue UI, own material
// lead-time tracking (setPaintingMaterialStatus() in data.js — the actual
// point of difference from Joinery/Upholstery), own separate pipeline
// functions (startPaintingWork/submitPaintingForQC/recordPaintingQCResult/
// handOffPaintingLine, all in data.js), even though the stage shape looks
// similar to the shared one.
//
// Painting has no dedicated manager today (a real staffing fact, not a
// design choice — Al Maraya doesn't want to hire one yet). This module is
// used by a "Painting Lead / Work Supervisor" — an operational-visibility
// role (sees incoming/upcoming workload), distinct from budget-approval
// authority, which stays with the Joinery Production Manager until a
// dedicated Painting Manager exists (see Phase 4 / the department-approver
// assignment).
// ══════════════════════════════════════════

const paintingStyleTag = document.createElement('style');
paintingStyleTag.textContent = `
#painting-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#painting-module-wrap .ops-header{background:var(--biz-primary);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#painting-module-wrap .painting-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#painting-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px;}
#painting-module-wrap .sales-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#painting-module-wrap .sales-kpi-tile .num{font-size:21px;font-weight:700;color:var(--biz-primary);}
#painting-module-wrap .sales-kpi-tile .lbl{font-size:10.5px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#painting-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#painting-module-wrap .sales-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#painting-module-wrap .sales-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:var(--biz-card-bg);color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#painting-module-wrap .sales-tabbtn.active{background:var(--biz-primary);border-color:var(--biz-primary);color:#fff;}
#painting-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
#painting-module-wrap table.sales-items th{text-align:left;padding:7px 6px;background:var(--biz-input-bg);color:var(--biz-text-muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--biz-border-light);}
#painting-module-wrap table.sales-items td{padding:7px 6px;border-bottom:1px solid var(--biz-border-light);}
#painting-module-wrap .stage-pill{display:inline-block;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap;}
#painting-module-wrap .stage-pill.queued{background:#eef0f3;color:#475569;}
#painting-module-wrap .stage-pill.in-production{background:var(--warn-bg,#fff6e3);color:var(--warn,#c47d00);}
#painting-module-wrap .stage-pill.qc{background:#e0ecfb;color:var(--info,#2563eb);}
#painting-module-wrap .stage-pill.rework{background:var(--bad-bg,#fdeceb);color:var(--bad,#d9342b);}
#painting-module-wrap .stage-pill.ready-for-handoff{background:var(--ok-bg,#eafaf1);color:var(--ok,#0f9d58);}
#painting-module-wrap .mat-pill{display:inline-block;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:20px;}
#painting-module-wrap .mat-pill.awaiting{background:#eef0f3;color:#64748b;}
#painting-module-wrap .mat-pill.ordered{background:var(--warn-bg,#fff6e3);color:var(--warn,#c47d00);}
#painting-module-wrap .mat-pill.arrived{background:var(--ok-bg,#eafaf1);color:var(--ok,#0f9d58);}
`;
document.head.appendChild(paintingStyleTag);

const paintingModuleWrap = document.createElement('div');
paintingModuleWrap.id = 'painting-module-wrap';
paintingModuleWrap.style.cssText = 'display:none;';
paintingModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">🎨</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Painting</div>
        <div style="color:rgba(255,255,255,.7);font-size:11px;">Incoming Work · Materials</div>
      </div>
    </div>
    <button onclick="closePaintingModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="painting-scroll">
    <div id="painting-body"></div>
  </div>
`;
document.body.appendChild(paintingModuleWrap);

let paintingView = 'dashboard'; // dashboard | queue
const paintingCurrentUser = 'Painting Lead / Work Supervisor'; // operational visibility only — no budget-approval authority, see Phase 4

function ptEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }
function paintingAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('painting-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'painting-toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;padding:10px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

function openPaintingModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['ops-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'owner-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap', 'admin-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  paintingModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  paintingView = 'dashboard';
  execEnsureShell(paintingModuleWrap, { key: 'painting', title: 'Painting', role: 'Painting Lead', navGroupsFn: EXEC_NAV_CONFIGS.painting, closeFn: 'closePaintingModule' });
  renderPaintingBody();
}
function closePaintingModule() { closeModuleWrap(paintingModuleWrap, 'launchPaintingModule'); }
function launchPaintingModule() { openPaintingModule(); }

function paintingSetView(v) { paintingView = v; renderPaintingBody(); }

function renderPaintingBody() {
  const body = document.getElementById('painting-body');
  if (!body) return;
  const tab = (v, label) => `<button class="sales-tabbtn ${paintingView === v ? 'active' : ''}" onclick="paintingSetView('${v}')">${label}</button>`;
  // No "Approvals" tab here on purpose — Painting Lead has operational
  // visibility only, no budget-approval authority (the Joinery Production
  // Manager approves Painting's budgets, in the Joinery module — see
  // DEPARTMENT_APPROVERS in data.js).
  const tabsHtml = `<div class="sales-tabs">${tab('dashboard', 'Dashboard')}${tab('queue', 'Incoming Work')}${tab('budget', 'Budget')}</div>`;
  let content;
  if (paintingView === 'queue') content = renderPaintingQueue();
  else if (paintingView === 'budget') content = renderPaintingBudgetTab();
  else content = renderPaintingDashboard();
  body.innerHTML = tabsHtml + content;
}

// Painting's own budget submit form — a near-duplicate of Joinery/
// Upholstery's shared one in dept-pipeline-ui.js, but deliberately coded
// separately here rather than calling into that shared file, consistent
// with Salman's "don't share anything" instruction extending to this UI
// too. Submits into the SAME data.js costing functions (submitDepartment
// Budget/computeBOMTotals/recordDepartmentActual) since costing itself is
// genuinely uniform business logic — only the UI code is kept separate.
let paintingBudgetEditingJobId = null;
function renderPaintingBudgetTab() {
  const jobs = getJobsForDepartmentBudget(PAINT_DEPT_KEY);
  if (jobs.length === 0) {
    return `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No jobs routed to Painting yet — jobs appear here once the Operations Manager confirms routing.</p></div>`;
  }
  return jobs.map(job => {
    const entry = job.departmentBudgets[PAINT_DEPT_KEY];
    const c = customers.find(x => x.id === job.customerId);
    const editing = paintingBudgetEditingJobId === job.id;
    const t = computeBOMTotals(entry.bom);
    const cats = [['materials', 'Material'], ['labour', 'Labour'], ['subcontract', 'Subcontract'], ['hiring', 'Hiring'], ['others', 'Others']];
    const formBody = editing
      ? `${cats.map(([cat, label]) => `<div class="sales-field" style="margin-bottom:6px;"><label style="font-size:10px;">${label} Cost (BD)</label><input type="number" step="0.001" id="pb-${cat}" value="${(entry.bom[cat][0] && entry.bom[cat][0].amount) || 0}" style="padding:6px 8px;"></div>`).join('')}
        <div style="display:flex;gap:8px;margin-top:6px;">
          <button class="primary" style="flex:1;font-size:11.5px;" onclick="paintingSubmitBudget('${job.id}')">Submit for Approval</button>
          <button class="secondary" style="flex:1;font-size:11.5px;" onclick="paintingBudgetEditingJobId=null;renderPaintingBody();">Cancel</button>
        </div>`
      : `<button class="secondary" style="font-size:11px;padding:6px 10px;" onclick="paintingBudgetEditingJobId='${job.id}';renderPaintingBody();">${entry.approvalStatus === 'not-submitted' ? 'Enter Budget' : 'Edit & Resubmit'}</button>`;
    return `
      <div class="sales-card">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <div><p style="font-weight:700;font-size:13px;">${ptEsc(job.id)} <span class="stage-pill ${entry.approvalStatus === 'approved' ? 'ready-for-handoff' : entry.approvalStatus === 'rejected' ? 'rework' : entry.approvalStatus === 'pending' ? 'qc' : 'queued'}">${entry.approvalStatus}</span></p><p style="font-size:11px;color:#94a3b8;">${ptEsc(c ? c.name : '—')}</p></div>
          <p style="font-size:12px;font-weight:700;">BD ${t.totalCostInclOH.toFixed(3)}</p>
        </div>
        ${entry.rejectionComment ? `<p style="font-size:11px;color:#b91c1c;margin:4px 0;">Rejected: ${ptEsc(entry.rejectionComment)}</p>` : ''}
        <p style="font-size:10.5px;color:#94a3b8;margin-top:6px;">Approved by the Joinery Production Manager — Painting doesn't have its own dedicated manager yet.</p>
        <div style="margin-top:8px;">${formBody}</div>
      </div>`;
  }).join('');
}
function paintingSubmitBudget(jobId) {
  const cats = ['materials', 'labour', 'subcontract', 'hiring', 'others'];
  const amounts = {};
  cats.forEach(cat => { amounts[cat] = document.getElementById(`pb-${cat}`).value; });
  const result = submitDepartmentBudget(jobId, PAINT_DEPT_KEY, amounts, paintingCurrentUser);
  if (result.error) { paintingAlert(result.error); return; }
  paintingBudgetEditingJobId = null;
  paintingAlert('✓ Budget submitted for approval.');
  renderPaintingBody();
}

function renderPaintingDashboard() {
  const rows = getPaintingQueue();
  const count = s => rows.filter(r => r.entry.status === s).length;
  const awaitingMaterial = rows.filter(r => (r.entry.materialStatus || 'awaiting') !== 'arrived').length;
  const overBudget = getOverBudgetCountForDept(PAINT_DEPT_KEY);
  return `
    <div class="sales-kpi-grid">
      <div class="sales-kpi-tile"><div class="num">${count('queued')}</div><div class="lbl">Queued</div></div>
      <div class="sales-kpi-tile"><div class="num">${count('in-production')}</div><div class="lbl">In Production</div></div>
      <div class="sales-kpi-tile"><div class="num">${count('qc')}</div><div class="lbl">Awaiting QC</div></div>
      <div class="sales-kpi-tile"><div class="num">${count('rework')}</div><div class="lbl">In Rework</div></div>
      <div class="sales-kpi-tile"><div class="num">${awaitingMaterial}</div><div class="lbl">Awaiting Material</div></div>
      <div class="sales-kpi-tile"><div class="num" style="${overBudget ? 'color:var(--bad,#d9342b);' : ''}">${overBudget}</div><div class="lbl">Over Budget</div></div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Ready for hand-off</p>
      <p style="font-size:22px;font-weight:700;color:var(--ok,#0f9d58);">${count('ready-for-handoff')}</p>
      <p style="font-size:11px;color:#94a3b8;">Passed QC, waiting to move to the next department (or finish, if Painting was the last stop).</p>
    </div>
    ${renderPaintingQueuePreview(rows, 5)}
    ${renderPaintingQualityCard()}
    ${renderPaintingTasksPanel()}`;
}

// Painting's own standalone versions of the queue-preview/quality/tasks
// pieces (4 Aug 2026) — same shape as dept-pipeline-ui.js's shared ones
// but hand-coded here since Painting deliberately doesn't share that
// file with Joinery/Upholstery (see the file header note near the top).
function renderPaintingQueuePreview(rows, limit) {
  limit = limit || 5;
  const active = rows.filter(r => r.entry.status !== 'ready-for-handoff');
  const body = active.length === 0
    ? `<p style="font-size:11.5px;color:#94a3b8;">Nothing queued right now.</p>`
    : active.slice(0, limit).map(r => {
      const c = customers.find(x => x.id === r.job.customerId);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--biz-border-light,#e2e8f0);">
        <div><p style="font-size:12.5px;font-weight:600;margin:0;">${ptEsc(r.item.product)}</p><p style="font-size:10.5px;color:#94a3b8;margin:0;">${ptEsc(r.job.id)} · ${ptEsc(c ? c.name : '—')}${r.entry.reworkCount ? ` · rework ×${r.entry.reworkCount}` : ''}</p></div>
        <span class="stage-pill ${r.entry.status}">${PAINT_STAGE_LABEL[r.entry.status] || r.entry.status}</span>
      </div>`;
    }).join('');
  return `
    <div class="sales-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <p style="font-weight:700;font-size:13px;margin:0;">This week's queue</p>
        <span style="font-size:11px;color:var(--biz-primary,#600131);cursor:pointer;font-weight:600;" onclick="paintingSetView('queue')">View all →</span>
      </div>
      ${body}
      ${active.length > limit ? `<p style="font-size:10.5px;color:#94a3b8;margin-top:6px;">+ ${active.length - limit} more in the full queue.</p>` : ''}
    </div>`;
}

// Dashboard Analytics rollout (5 Aug 2026), Phase 6: same ring-gauge
// upgrade as dept-pipeline-ui.js's renderDeptQualityCard() — Painting
// keeps its own separate copy of this function by design (see this
// file's header), so it needs its own matching edit.
function renderPaintingQualityCard() {
  const t = getQCTrendForDept(PAINT_DEPT_KEY);
  const recentRows = t.recent.length === 0
    ? `<p style="font-size:11.5px;color:#94a3b8;">No QC history yet.</p>`
    : t.recent.map(a => `<p style="font-size:11.5px;margin:3px 0;color:${a.type === 'qc-fail' ? 'var(--bad,#d9342b)' : 'var(--ok,#0f9d58)'};">${a.type === 'qc-fail' ? '✕' : '✓'} ${ptEsc(a.message)}</p>`).join('');
  const color = t.passRate >= 90 ? 'var(--ok,#0f9d58)' : t.passRate >= 75 ? 'var(--warn,#c47d00)' : 'var(--bad,#d9342b)';
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Quality</p>
      ${t.total === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No QC results recorded yet.</p>` : `
        <div class="dash-rings" style="margin-bottom:8px;">
          ${cwRingStatCard(t.passRate, t.passRate + '%', 'First-Pass QC Rate', `${t.passCount} passed, ${t.failCount} failed (all-time)`, color)}
        </div>
      `}
      ${renderPaintingRejectReasons()}
      ${recentRows}
    </div>`;
}

// Painting's own top-reject-reasons list (6 Aug 2026 audit, loophole #6) —
// same shape as dept-pipeline-ui.js's renderQCRejectReasonList(), inlined
// here since Painting stays standalone (see this file's header). Quiet until
// a fail with a real reason exists.
function renderPaintingRejectReasons() {
  const reasons = getQCRejectReasonsForDept(PAINT_DEPT_KEY).filter(r => r.reason !== 'Unspecified');
  if (reasons.length === 0) return '';
  const max = Math.max(...reasons.map(r => r.count));
  return `
    <div style="margin:8px 0;">
      <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;">Top reject reasons</p>
      ${reasons.map(r => `
        <div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
          <span style="flex:0 0 auto;font-size:11px;min-width:16px;color:var(--bad,#d9342b);font-weight:700;">${r.count}</span>
          <div style="flex:1;height:8px;background:var(--biz-border-light,#e2e8f0);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${Math.round((r.count / max) * 100)}%;background:var(--bad,#d9342b);"></div></div>
          <span style="flex:0 0 auto;font-size:11px;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ptEsc(r.reason)}</span>
        </div>`).join('')}
    </div>`;
}

function renderPaintingTasksPanel() {
  const openTasks = getOpenTasksForAssignee(paintingCurrentUser);
  const rows = openTasks.length === 0
    ? `<p style="font-size:11.5px;color:#94a3b8;">Nothing on your list.</p>`
    : openTasks.map(t => `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--biz-border-light,#e2e8f0);">
        <div><p style="font-size:12.5px;margin:0;">${ptEsc(t.title)}</p>${t.dueDate ? `<p style="font-size:10px;color:#94a3b8;margin:0;">Due ${t.dueDate}</p>` : ''}</div>
        <span style="font-size:11px;color:var(--ok,#0f9d58);cursor:pointer;white-space:nowrap;" onclick="paintingCompleteTask('${t.id}')">✓ Done</span>
      </div>`).join('');
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">My Tasks</p>
      ${rows}
      <div style="display:flex;gap:6px;margin-top:8px;">
        <input id="painting-quicktask" type="text" placeholder="Add a reminder…" style="flex:1;padding:8px 10px;border:1px solid var(--biz-border,#e2e8f0);border-radius:8px;font-size:12.5px;font-family:inherit;">
        <button class="secondary" style="font-size:11.5px;padding:8px 12px;" onclick="paintingQuickAddTask()">Add</button>
      </div>
    </div>`;
}
function paintingQuickAddTask() {
  const input = document.getElementById('painting-quicktask');
  const title = input.value;
  if (!title || !title.trim()) return;
  const result = createTask({ title, assignee: paintingCurrentUser });
  if (result.error) { paintingAlert(result.error); return; }
  renderPaintingBody();
}
function paintingCompleteTask(taskId) {
  completeTask(taskId);
  renderPaintingBody();
}

const PAINT_STAGE_LABEL = { queued: 'Queued', 'in-production': 'In Production', qc: 'QC', rework: 'Rework', 'ready-for-handoff': 'Ready for Hand-off' };
const PAINT_MATERIAL_LABEL = { awaiting: 'Awaiting', ordered: 'Ordered', arrived: 'Arrived' };

function renderPaintingQueue() {
  const rows = getPaintingQueue();
  if (rows.length === 0) {
    return `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No incoming work for Painting right now.</p></div>`;
  }
  return `<div class="sales-card" style="overflow-x:auto;">
    <table class="sales-items"><tr><th>Job</th><th>Product</th><th>Qty</th><th>Material</th><th>Stage</th><th>Action</th></tr>
    ${rows.map(r => {
      const c = customers.find(x => x.id === r.job.customerId);
      const mat = r.entry.materialStatus || 'awaiting';
      const matCell = `<span class="mat-pill ${mat}">${PAINT_MATERIAL_LABEL[mat]}</span>
        <select style="font-size:10px;margin-top:3px;width:100%;" onchange="paintingSetMaterial('${r.job.id}',${r.item.lineId},this.value)">
          ${Object.keys(PAINT_MATERIAL_LABEL).map(k => `<option value="${k}" ${mat === k ? 'selected' : ''}>${PAINT_MATERIAL_LABEL[k]}</option>`).join('')}
        </select>`;
      let action = '';
      if (r.entry.status === 'queued') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="paintingAction('startPaintingWork','${r.job.id}',${r.item.lineId})">Start Production</button>`;
      else if (r.entry.status === 'in-production') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="paintingAction('submitPaintingForQC','${r.job.id}',${r.item.lineId})">Submit for QC</button>`;
      else if (r.entry.status === 'qc') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;color:#0f9d58;" onclick="paintingAction('recordPaintingQCResult','${r.job.id}',${r.item.lineId},true,'${ptEsc(paintingCurrentUser)}')">Pass</button> <button class="secondary" style="font-size:10.5px;padding:5px 8px;color:#b91c1c;" onclick="paintingQCFail('${r.job.id}',${r.item.lineId})">Fail</button>`;
      else if (r.entry.status === 'rework') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="paintingAction('reworkPaintingBackToProduction','${r.job.id}',${r.item.lineId})">Resume Production</button>`;
      else if (r.entry.status === 'ready-for-handoff') action = `<button class="primary" style="font-size:10.5px;padding:5px 8px;" onclick="paintingAction('handOffPaintingLine','${r.job.id}',${r.item.lineId},'${ptEsc(paintingCurrentUser)}')">Hand Off →</button>`;
      return `<tr>
        <td>${r.job.urgent ? '<span title="Urgent">🔥</span> ' : ''}${ptEsc(r.job.id)}${r.job.promisedDate ? `<br><span style="color:${r.job.promisedDate < todayStrGlobal() ? 'var(--bad,#d9342b)' : '#94a3b8'};font-size:10px;">due ${r.job.promisedDate}</span>` : ''}<br><span style="color:#94a3b8;font-size:10.5px;">${ptEsc(c ? c.name : '—')}</span></td>
        <td>${ptEsc(r.item.product)}${r.entry.reworkCount ? ` <span style="color:#b91c1c;font-size:9.5px;">(rework ×${r.entry.reworkCount})</span>` : ''}${r.entry.rejectReason ? `<br><span style="color:#b91c1c;font-size:9.5px;">✕ ${ptEsc(r.entry.rejectReason)}</span>` : ''}</td>
        <td>${r.item.qty} ${ptEsc(r.item.unit)}</td>
        <td>${matCell}</td>
        <td><span class="stage-pill ${r.entry.status}">${PAINT_STAGE_LABEL[r.entry.status] || r.entry.status}</span>${paintingProgressCell(r)}</td>
        <td>${action}<br><span style="font-size:10px;color:var(--biz-primary);cursor:pointer;" onclick="paintingToggleWorkLog('${r.job.id}',${r.item.lineId})">⏱ Log work</span></td>
      </tr>${paintingWorkLogRow(r)}`;
    }).join('')}
    </table>
  </div>`;
}

// ── STAGE 3 (cost ledger): Painting's own work-log + progress copy ──
// Painting deliberately doesn't consume dept-pipeline-ui.js (standing
// design rule — see this file's header), so it carries its own
// near-identical versions of the shared helpers.
let paintingWorkLogOpenKey = null;
function paintingProgressCell(r) {
  const pct = r.entry.progressPct || 0;
  const inFlight = ['queued', 'in-production', 'rework'].includes(r.entry.status);
  if (!inFlight) return pct ? `<br><span style="font-size:10px;color:#94a3b8;">${pct}%</span>` : '';
  return `<br>${[25, 50, 75].map(p => `<span style="font-size:10px;cursor:pointer;padding:1px 4px;border-radius:4px;${pct >= p ? 'background:var(--biz-primary);color:#fff;' : 'background:#eef0f3;color:#64748b;'}" onclick="paintingSetProgress('${r.job.id}',${r.item.lineId},${p})">${p}%</span>`).join(' ')}`;
}
function paintingSetProgress(jobId, lineId, pct) {
  const res = setLineProgress(jobId, lineId, 'paint', pct, paintingCurrentUser);
  if (res && res.error) { paintingAlert(res.error); return; }
  renderPaintingBody();
}
function paintingToggleWorkLog(jobId, lineId) {
  const key = jobId + ':' + lineId;
  paintingWorkLogOpenKey = paintingWorkLogOpenKey === key ? null : key;
  renderPaintingBody();
}
function paintingWorkLogRow(r) {
  const key = r.job.id + ':' + r.item.lineId;
  if (paintingWorkLogOpenKey !== key) return '';
  const logged = getLabourLogsForLine(r.job.id, r.item.lineId);
  return `<tr><td colspan="6" style="background:#faf7f9;">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:4px 0;">
      <label style="font-size:10.5px;color:#64748b;">Who worked on this<br>
        <select id="pwl-emps-${r.item.lineId}" multiple size="4" style="min-width:170px;font-size:11px;">${getDeptRoster('paint').map(n => `<option value="${ptEsc(n)}">${ptEsc(n)}</option>`).join('')}</select></label>
      <label style="font-size:10.5px;color:#64748b;">Hours each<br><input id="pwl-hours-${r.item.lineId}" type="number" step="0.5" min="0.5" max="12" value="8" style="width:70px;"></label>
      <label style="font-size:10.5px;color:#64748b;">Date<br><input id="pwl-date-${r.item.lineId}" type="date" value="${new Date().toISOString().slice(0, 10)}" style="width:130px;"></label>
      <button class="primary" style="font-size:11px;padding:6px 10px;" onclick="paintingSaveWorkLog('${r.job.id}',${r.item.lineId})">Save day log</button>
    </div>
    ${logged.length ? `<p style="font-size:10px;color:#94a3b8;">Logged so far: ${logged.length} day-entries · BD ${logged.reduce((s, l) => s + l.cost, 0).toFixed(3)}</p>` : ''}
  </td></tr>`;
}
function paintingSaveWorkLog(jobId, lineId) {
  const sel = document.getElementById('pwl-emps-' + lineId);
  const names = Array.from(sel.selectedOptions).map(o => o.value);
  const hours = Number(document.getElementById('pwl-hours-' + lineId).value);
  const date = document.getElementById('pwl-date-' + lineId).value;
  if (!names.length) { paintingAlert('Pick at least one employee.'); return; }
  let ok = 0, err = null;
  names.forEach(n => {
    const res = logLabourDay({ jobId, lineId, date, employeeName: n, hours, loggedBy: paintingCurrentUser });
    if (res && res.error) err = res.error; else ok++;
  });
  if (err) { paintingAlert(err); return; }
  paintingAlert(`✓ Logged ${ok} day-entr${ok === 1 ? 'y' : 'ies'}.`);
  renderPaintingBody();
}

function paintingSetMaterial(jobId, lineId, materialStatus) {
  setPaintingMaterialStatus(jobId, lineId, materialStatus);
  renderPaintingBody();
}

function paintingAction(fnName, ...args) {
  const fns = { startPaintingWork, submitPaintingForQC, recordPaintingQCResult, reworkPaintingBackToProduction, handOffPaintingLine };
  const result = fns[fnName](...args);
  if (result && result.error) { paintingAlert(result.error); return; }
  paintingAlert('✓ Updated.');
  renderPaintingBody();
}

// QC fail prompts for an optional reason (6 Aug 2026 audit, loophole #6) —
// same behaviour as the shared pipeline's deptQCFail(): Cancel aborts, a
// blank OK records a reasonless fail.
function paintingQCFail(jobId, lineId) {
  const reason = prompt('Reason this line failed QC (optional — leave blank if none):');
  if (reason === null) return;
  paintingAction('recordPaintingQCResult', jobId, lineId, false, paintingCurrentUser, reason);
}
