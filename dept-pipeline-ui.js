// ══════════════════════════════════════════
// SHARED DEPARTMENT-QUEUE UI (Batch 8, Phase 2)
// The one piece of UI Joinery and Upholstery genuinely share — a table
// rendering getDepartmentQueue()'s rows with stage-appropriate action
// buttons, plus one dispatcher so both modules' onclick strings look
// identical. Lives in its own file (loaded after data.js, before
// joinery.js/upholstery.js) rather than inside either module file, so
// neither one appears to "own" the other — they're siblings consuming a
// shared primitive, not one depending on the other's file existing.
// Painting does NOT use this — it's intentionally standalone (see
// painting.js).
// ══════════════════════════════════════════

function deptEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }

const DEPT_QUEUE_STAGE_LABEL = { queued: 'Queued', 'in-production': 'In Production', qc: 'QC', rework: 'Rework', 'ready-for-handoff': 'Ready for Hand-off' };

// modPrefix: 'joinery' | 'upholstery' — used only to route the dispatcher
// back to the right module's re-render + alert functions.
function renderDeptQueue(deptKey, currentUser, modPrefix) {
  const rows = getDepartmentQueue(deptKey);
  if (rows.length === 0) {
    return `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">Nothing in the ${deptEsc(dc(deptKey).n)} queue right now.</p></div>`;
  }
  return `<div class="sales-card" style="overflow-x:auto;">
    <table class="sales-items"><tr><th>Job</th><th>Product</th><th>Qty</th><th>Stage</th><th>Action</th></tr>
    ${rows.map(r => {
      const c = customers.find(x => x.id === r.job.customerId);
      let action = '';
      if (r.entry.status === 'queued') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="deptQueueAction('${modPrefix}','startLineProduction','${r.job.id}',${r.item.lineId},'${deptKey}')">Start Production</button>`;
      else if (r.entry.status === 'in-production') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="deptQueueAction('${modPrefix}','submitLineForQC','${r.job.id}',${r.item.lineId},'${deptKey}')">Submit for QC</button>`;
      else if (r.entry.status === 'qc') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;color:#0f9d58;" onclick="deptQueueAction('${modPrefix}','recordLineQCResult','${r.job.id}',${r.item.lineId},'${deptKey}',true,'${deptEsc(currentUser)}')">Pass</button> <button class="secondary" style="font-size:10.5px;padding:5px 8px;color:#b91c1c;" onclick="deptQueueAction('${modPrefix}','recordLineQCResult','${r.job.id}',${r.item.lineId},'${deptKey}',false,'${deptEsc(currentUser)}')">Fail</button>`;
      else if (r.entry.status === 'rework') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="deptQueueAction('${modPrefix}','reworkLineBackToProduction','${r.job.id}',${r.item.lineId},'${deptKey}')">Resume Production</button>`;
      else if (r.entry.status === 'ready-for-handoff') action = `<button class="primary" style="font-size:10.5px;padding:5px 8px;" onclick="deptQueueAction('${modPrefix}','handOffLine','${r.job.id}',${r.item.lineId},'${deptKey}','${deptEsc(currentUser)}')">Hand Off →</button>`;
      return `<tr>
        <td>${deptEsc(r.job.id)}<br><span style="color:#94a3b8;font-size:10.5px;">${deptEsc(c ? c.name : '—')}</span></td>
        <td>${deptEsc(r.item.product)}${r.entry.reworkCount ? ` <span style="color:#b91c1c;font-size:9.5px;">(rework ×${r.entry.reworkCount})</span>` : ''}</td>
        <td>${r.item.qty} ${deptEsc(r.item.unit)}</td>
        <td><span class="stage-pill ${r.entry.status}">${DEPT_QUEUE_STAGE_LABEL[r.entry.status] || r.entry.status}</span></td>
        <td>${action}</td>
      </tr>`;
    }).join('')}
    </table>
  </div>`;
}

// Routes to the right data.js pipeline function, alerts and re-renders
// whichever of the two modules is actually open.
function deptQueueAction(modPrefix, fnName, ...args) {
  const fns = { startLineProduction, submitLineForQC, recordLineQCResult, reworkLineBackToProduction, handOffLine };
  const result = fns[fnName](...args);
  const alertFn = modPrefix === 'upholstery' ? upholsteryAlert : joineryAlert;
  if (result && result.error) { alertFn(result.error); return; }
  alertFn('✓ Updated.');
  if (modPrefix === 'upholstery') renderUpholsteryBody(); else renderJoineryBody();
}

// ══════════════════════════════════════════
// SHARED BUDGET SUBMIT/APPROVE UI (Batch 8, Phase 4) — the other piece
// Joinery and Upholstery genuinely share, since costing/budgeting IS
// uniform business logic across departments (same computeBOMTotals()
// waterfall, same approval mechanics) even though the PRODUCTION pipeline
// above is department-flavoured. Painting deliberately does NOT use this
// — it has its own near-identical but separately-coded submit form in
// painting.js, consistent with "don't share anything" applying to
// Painting specifically.
// ══════════════════════════════════════════
let deptBudgetEditingJobId = null; // shared scratch state — only one module is ever open at a time

function deptBudgetPillClass(status) {
  return status === 'approved' ? 'ready-for-handoff' : status === 'rejected' ? 'rework' : status === 'pending' ? 'qc' : 'queued';
}

// Jobs currently routed to this department (a departmentBudgets[deptKey]
// entry exists) — the list a department manager submits budgets against.
function getJobsForDepartmentBudget(deptKey) {
  return jobCards.filter(j => j.departmentBudgets && j.departmentBudgets[deptKey] && j.status !== 'cancelled');
}

function renderDeptBudgetTab(deptKey, currentUser, modPrefix) {
  const jobs = getJobsForDepartmentBudget(deptKey);
  if (jobs.length === 0) {
    return `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No jobs routed to ${deptEsc(dc(deptKey).n)} yet — jobs appear here once the Operations Manager confirms routing.</p></div>`;
  }
  return jobs.map(job => {
    const entry = job.departmentBudgets[deptKey];
    const c = customers.find(x => x.id === job.customerId);
    const editing = deptBudgetEditingJobId === `${modPrefix}:${job.id}`;
    const t = computeBOMTotals(entry.bom);
    let body = '';
    if (editing) {
      const cats = [['materials', 'Material'], ['labour', 'Labour'], ['subcontract', 'Subcontract'], ['hiring', 'Hiring'], ['others', 'Others']];
      body = `
        ${cats.map(([cat, label]) => `<div class="sales-field" style="margin-bottom:6px;"><label style="font-size:10px;">${label} Cost (BD)</label><input type="number" step="0.001" id="db-${modPrefix}-${cat}" value="${(entry.bom[cat][0] && entry.bom[cat][0].amount) || 0}" style="padding:6px 8px;"></div>`).join('')}
        <div style="display:flex;gap:8px;margin-top:6px;">
          <button class="primary" style="flex:1;font-size:11.5px;" onclick="deptSubmitBudget('${modPrefix}','${job.id}','${deptKey}','${deptEsc(currentUser)}')">Submit for Approval</button>
          <button class="secondary" style="flex:1;font-size:11.5px;" onclick="deptBudgetEditingJobId=null;${modPrefix === 'upholstery' ? 'renderUpholsteryBody()' : 'renderJoineryBody()'};">Cancel</button>
        </div>`;
    } else {
      body = `<button class="secondary" style="font-size:11px;padding:6px 10px;" onclick="deptBudgetEditingJobId='${modPrefix}:${job.id}';${modPrefix === 'upholstery' ? 'renderUpholsteryBody()' : 'renderJoineryBody()'};">${entry.approvalStatus === 'not-submitted' ? 'Enter Budget' : 'Edit & Resubmit'}</button>`;
    }
    const actualBody = entry.approvalStatus === 'approved' ? renderActualEntry(job, deptKey, entry, currentUser, modPrefix) : '';
    return `
      <div class="sales-card">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <div><p style="font-weight:700;font-size:13px;">${deptEsc(job.id)} <span class="stage-pill ${deptBudgetPillClass(entry.approvalStatus)}">${entry.approvalStatus}</span></p><p style="font-size:11px;color:#94a3b8;">${deptEsc(c ? c.name : '—')}</p></div>
          <p style="font-size:12px;font-weight:700;">BD ${t.totalCostInclOH.toFixed(3)}</p>
        </div>
        ${entry.rejectionComment ? `<p style="font-size:11px;color:#b91c1c;margin:4px 0;">Rejected: ${deptEsc(entry.rejectionComment)}</p>` : ''}
        <div style="margin-top:8px;">${body}</div>
        ${actualBody}
      </div>`;
  }).join('');
}

function renderActualEntry(job, deptKey, entry, currentUser, modPrefix) {
  const editing = deptBudgetEditingJobId === `actual:${modPrefix}:${job.id}`;
  if (!editing) {
    const recorded = entry.actual && entry.actual.recordedDate;
    return `<div style="margin-top:8px;border-top:1px solid var(--biz-border-light);padding-top:8px;">
      ${recorded ? `<p style="font-size:11px;color:#94a3b8;">Actual recorded ${entry.actual.recordedDate} by ${deptEsc(entry.actual.recordedBy)}${isDepartmentOverBudget(job.id, deptKey) ? ' — <span style="color:#b91c1c;font-weight:700;">OVER BUDGET</span>' : ''}</p>` : ''}
      <button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="deptBudgetEditingJobId='actual:${modPrefix}:${job.id}';${modPrefix === 'upholstery' ? 'renderUpholsteryBody()' : 'renderJoineryBody()'};">${recorded ? 'Update Actual Cost' : 'Record Actual Cost'}</button>
    </div>`;
  }
  const cats = [['material', 'Material'], ['labour', 'Labour'], ['subcontract', 'Subcontract'], ['hiring', 'Hiring'], ['others', 'Others']];
  return `<div style="margin-top:8px;border-top:1px solid var(--biz-border-light);padding-top:8px;">
    ${cats.map(([cat, label]) => `<div class="sales-field" style="margin-bottom:6px;"><label style="font-size:10px;">${label} Actual (BD)</label><input type="number" step="0.001" id="da-${modPrefix}-${cat}" value="${entry.actual[cat] || 0}" style="padding:6px 8px;"></div>`).join('')}
    <button class="primary" style="width:100%;font-size:11.5px;" onclick="deptRecordActual('${modPrefix}','${job.id}','${deptKey}','${deptEsc(currentUser)}')">Save Actual Cost</button>
  </div>`;
}

function deptSubmitBudget(modPrefix, jobId, deptKey, currentUser) {
  const cats = ['materials', 'labour', 'subcontract', 'hiring', 'others'];
  const amounts = {};
  cats.forEach(cat => { amounts[cat] = document.getElementById(`db-${modPrefix}-${cat}`).value; });
  const result = submitDepartmentBudget(jobId, deptKey, amounts, currentUser);
  const alertFn = modPrefix === 'upholstery' ? upholsteryAlert : joineryAlert;
  if (result.error) { alertFn(result.error); return; }
  deptBudgetEditingJobId = null;
  alertFn('✓ Budget submitted for approval.');
  if (modPrefix === 'upholstery') renderUpholsteryBody(); else renderJoineryBody();
}

function deptRecordActual(modPrefix, jobId, deptKey, currentUser) {
  const cats = ['material', 'labour', 'subcontract', 'hiring', 'others'];
  const amounts = {};
  cats.forEach(cat => { amounts[cat] = document.getElementById(`da-${modPrefix}-${cat}`).value; });
  const result = recordDepartmentActual(jobId, deptKey, amounts, currentUser);
  const alertFn = modPrefix === 'upholstery' ? upholsteryAlert : joineryAlert;
  if (result.error) { alertFn(result.error); return; }
  deptBudgetEditingJobId = null;
  alertFn(isDepartmentOverBudget(jobId, deptKey) ? '✓ Actual cost recorded — this is over budget, flagged only, production continues.' : '✓ Actual cost recorded.');
  if (modPrefix === 'upholstery') renderUpholsteryBody(); else renderJoineryBody();
}

// Approvals list — one department manager may see MORE than one
// department's pending submissions here (Joinery Production Manager sees
// both Joinery's and Painting's, since that's today's real assignment,
// not a data-model merge — see DEPARTMENT_APPROVERS in data.js).
function renderBudgetApprovals(approverName, modPrefix) {
  const rows = getPendingBudgetApprovalsFor(approverName);
  if (rows.length === 0) {
    return `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No budgets waiting on your approval right now.</p></div>`;
  }
  return rows.map(r => {
    const c = customers.find(x => x.id === r.job.customerId);
    const t = computeBOMTotals(r.entry.bom);
    return `<div class="sales-card">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div><p style="font-weight:700;font-size:13px;">${deptEsc(r.job.id)} — ${deptEsc(dc(r.deptKey).n)}</p><p style="font-size:11px;color:#94a3b8;">${deptEsc(c ? c.name : '—')} · submitted by ${deptEsc(r.entry.submittedBy)} on ${r.entry.submittedDate}</p></div>
        <p style="font-size:13px;font-weight:700;">BD ${t.totalCostInclOH.toFixed(3)}</p>
      </div>
      <table class="sales-items" style="margin-top:8px;"><tr><th>Material</th><th>Labour</th><th>Subcontract</th><th>Hiring</th><th>Others</th></tr>
        <tr><td>${t.materialCost.toFixed(3)}</td><td>${t.labourCost.toFixed(3)}</td><td>${t.subcontractCost.toFixed(3)}</td><td>${t.hiringCost.toFixed(3)}</td><td>${t.othersCost.toFixed(3)}</td></tr>
      </table>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="primary" style="flex:1;font-size:11.5px;" onclick="deptApproveBudget('${modPrefix}','${r.job.id}','${r.deptKey}','${deptEsc(approverName)}')">Approve</button>
        <button class="secondary" style="flex:1;font-size:11.5px;color:#b91c1c;" onclick="deptRejectBudget('${modPrefix}','${r.job.id}','${r.deptKey}','${deptEsc(approverName)}')">Reject</button>
      </div>
    </div>`;
  }).join('');
}

function deptApproveBudget(modPrefix, jobId, deptKey, approverName) {
  const result = approveDepartmentBudget(jobId, deptKey, approverName);
  const alertFn = modPrefix === 'upholstery' ? upholsteryAlert : joineryAlert;
  if (result.error) { alertFn(result.error); return; }
  alertFn(`✓ ${dc(deptKey).n} budget approved.`);
  if (modPrefix === 'upholstery') renderUpholsteryBody(); else renderJoineryBody();
}
function deptRejectBudget(modPrefix, jobId, deptKey, approverName) {
  const comment = window.prompt('Reason for rejecting this budget:', '') || '';
  const result = rejectDepartmentBudget(jobId, deptKey, approverName, comment);
  const alertFn = modPrefix === 'upholstery' ? upholsteryAlert : joineryAlert;
  if (result.error) { alertFn(result.error); return; }
  alertFn(`Budget rejected.`);
  if (modPrefix === 'upholstery') renderUpholsteryBody(); else renderJoineryBody();
}
