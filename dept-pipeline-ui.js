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
// statusFilter (optional, 5 Aug 2026, role-based access rollout): an
// array of departmentStatuses[].status values to restrict this render
// to — used by the granular per-role dashboards (e.g. Upholstery's
// Team Leader/QC-Packaging screens) so each role sees only the stage(s)
// it actually works, not the Manager's full cross-stage queue. Omitted
// entirely, this renders every row exactly as before — the Manager
// dashboards (joinery.js/upholstery.js) don't pass it and are unchanged.
function renderDeptQueue(deptKey, currentUser, modPrefix, statusFilter) {
  let rows = getDepartmentQueue(deptKey);
  if (statusFilter) rows = rows.filter(r => statusFilter.includes(r.entry.status));
  if (rows.length === 0) {
    return `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">Nothing in the ${deptEsc(dc(deptKey).n)} queue right now.</p></div>`;
  }
  return `<div class="sales-card" style="overflow-x:auto;">
    <table class="sales-items"><tr><th>Job</th><th>Product</th><th>Qty</th><th>Stage</th><th>Action</th></tr>
    ${rows.map(r => {
      const c = customers.find(x => x.id === r.job.customerId);
      let action = '';
      // Phase 2 audit finding #2 (5 Aug 2026): a carp line stuck before
      // Joinery's final internal sub-stage (JOINERY_SUB_STAGES) can no
      // longer submit for QC (see the gate in submitLineForQC(), data.js)
      // — show that as a waiting message instead of an action button that
      // would just get rejected. joinerySubStage is only ever set for
      // "carp", so this never fires for Upholstery.
      const notReadyForQC = r.entry.joinerySubStage && typeof JOINERY_SUB_STAGES !== 'undefined' && r.entry.joinerySubStage !== JOINERY_SUB_STAGES[JOINERY_SUB_STAGES.length - 1];
      if (r.entry.status === 'queued') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="deptQueueAction('${modPrefix}','startLineProduction','${r.job.id}',${r.item.lineId},'${deptKey}')">Start Production</button>`;
      else if (r.entry.status === 'in-production' && notReadyForQC) action = `<span style="font-size:10.5px;color:#94a3b8;">Waiting on ${deptEsc((typeof JOINERY_SUB_STAGE_LABEL !== 'undefined' && JOINERY_SUB_STAGE_LABEL[r.entry.joinerySubStage]) || r.entry.joinerySubStage)}</span>`;
      else if (r.entry.status === 'in-production') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="deptQueueAction('${modPrefix}','submitLineForQC','${r.job.id}',${r.item.lineId},'${deptKey}')">Submit for QC</button>`;
      else if (r.entry.status === 'qc') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;color:#0f9d58;" onclick="deptQueueAction('${modPrefix}','recordLineQCResult','${r.job.id}',${r.item.lineId},'${deptKey}',true,'${deptEsc(currentUser)}')">Pass</button> <button class="secondary" style="font-size:10.5px;padding:5px 8px;color:#b91c1c;" onclick="deptQCFail('${modPrefix}','${r.job.id}',${r.item.lineId},'${deptKey}','${deptEsc(currentUser)}')">Fail</button>`;
      else if (r.entry.status === 'rework') action = `<button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="deptQueueAction('${modPrefix}','reworkLineBackToProduction','${r.job.id}',${r.item.lineId},'${deptKey}')">Resume Production</button>`;
      else if (r.entry.status === 'ready-for-handoff') action = `<button class="primary" style="font-size:10.5px;padding:5px 8px;" onclick="deptQueueAction('${modPrefix}','handOffLine','${r.job.id}',${r.item.lineId},'${deptKey}','${deptEsc(currentUser)}')">Hand Off →</button>`;
      return `<tr>
        <td>${r.job.urgent ? '<span title="Urgent">🔥</span> ' : ''}${deptEsc(r.job.id)}${r.job.promisedDate ? `<br><span style="color:${r.job.promisedDate < todayStrGlobal() ? 'var(--bad,#d9342b)' : '#94a3b8'};font-size:10px;">due ${r.job.promisedDate}</span>` : ''}<br><span style="color:#94a3b8;font-size:10.5px;">${deptEsc(c ? c.name : '—')}</span></td>
        <td>${deptEsc(r.item.product)}${r.entry.reworkCount ? ` <span style="color:#b91c1c;font-size:9.5px;">(rework ×${r.entry.reworkCount})</span>` : ''}${r.entry.rejectReason ? `<br><span style="color:#b91c1c;font-size:9.5px;">✕ ${deptEsc(r.entry.rejectReason)}</span>` : ''}</td>
        <td>${r.item.qty} ${deptEsc(r.item.unit)}</td>
        <td><span class="stage-pill ${r.entry.status}">${DEPT_QUEUE_STAGE_LABEL[r.entry.status] || r.entry.status}</span>${deptProgressCell(r, modPrefix, deptKey)}</td>
        <td>${action}<br><span style="font-size:10px;color:var(--biz-primary);cursor:pointer;" onclick="deptToggleWorkLog('${modPrefix}','${r.job.id}',${r.item.lineId})">⏱ Log work</span></td>
      </tr>${deptWorkLogRow(r, modPrefix, deptKey)}`;
    }).join('')}
    </table>
  </div>`;
}

// ── STAGE 3 (cost ledger): team-leader work logging + progress ──
// Progress: fixed 25/50/75 one-tap milestones on in-flight lines; 100%
// only ever comes from a QC pass (see setLineProgress in data.js).
// Work log: the team leader logs hours ON BEHALF of the floor (workers
// have no logins) — multi-select from the department's real payroll
// roster, one labourDayLogs entry per person per day, costed at the real
// per-person rate. This is what feeds the item's derived actual cost
// (the real Q-Pro MATERIAL COST document's Labour Cost table).
let deptWorkLogOpenKey = null;
function deptProgressCell(r, modPrefix, deptKey) {
  const pct = r.entry.progressPct || 0;
  const inFlight = ['queued', 'in-production', 'rework'].includes(r.entry.status);
  if (!inFlight) return pct ? `<br><span style="font-size:10px;color:#94a3b8;">${pct}%</span>` : '';
  return `<br>${[25, 50, 75].map(p => `<span style="font-size:10px;cursor:pointer;padding:1px 4px;border-radius:4px;${pct >= p ? 'background:var(--biz-primary);color:#fff;' : 'background:#eef0f3;color:#64748b;'}" onclick="deptSetProgress('${modPrefix}','${r.job.id}',${r.item.lineId},'${deptKey}',${p})">${p}%</span>`).join(' ')}`;
}
function deptSetProgress(modPrefix, jobId, lineId, deptKey, pct) {
  const res = setLineProgress(jobId, lineId, deptKey, pct, null);
  const alertFn = modPrefix === 'upholstery' ? upholsteryAlert : joineryAlert;
  if (res && res.error) { alertFn(res.error); return; }
  if (modPrefix === 'upholstery') renderUpholsteryBody(); else renderJoineryBody();
}
function deptToggleWorkLog(modPrefix, jobId, lineId) {
  const key = jobId + ':' + lineId;
  deptWorkLogOpenKey = deptWorkLogOpenKey === key ? null : key;
  if (modPrefix === 'upholstery') renderUpholsteryBody(); else renderJoineryBody();
}
function deptWorkLogRow(r, modPrefix, deptKey) {
  const key = r.job.id + ':' + r.item.lineId;
  if (deptWorkLogOpenKey !== key) return '';
  const logged = getLabourLogsForLine(r.job.id, r.item.lineId);
  return `<tr><td colspan="5" style="background:#faf7f9;">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;padding:4px 0;">
      <label style="font-size:10.5px;color:#64748b;">Who worked on this<br>
        <select id="wl-emps-${r.item.lineId}" multiple size="4" style="min-width:170px;font-size:11px;">${getDeptRoster(deptKey).map(n => `<option value="${deptEsc(n)}">${deptEsc(n)}</option>`).join('')}</select></label>
      <label style="font-size:10.5px;color:#64748b;">Hours each<br><input id="wl-hours-${r.item.lineId}" type="number" step="0.5" min="0.5" max="12" value="8" style="width:70px;"></label>
      <label style="font-size:10.5px;color:#64748b;">Date<br><input id="wl-date-${r.item.lineId}" type="date" value="${new Date().toISOString().slice(0, 10)}" style="width:130px;"></label>
      <button class="primary" style="font-size:11px;padding:6px 10px;" onclick="deptSaveWorkLog('${modPrefix}','${r.job.id}',${r.item.lineId},'${deptKey}')">Save day log</button>
    </div>
    ${logged.length ? `<p style="font-size:10px;color:#94a3b8;">Logged so far: ${logged.length} day-entries · BD ${logged.reduce((s, l) => s + l.cost, 0).toFixed(3)}</p>` : ''}
  </td></tr>`;
}
function deptSaveWorkLog(modPrefix, jobId, lineId, deptKey) {
  const sel = document.getElementById('wl-emps-' + lineId);
  const names = Array.from(sel.selectedOptions).map(o => o.value);
  const hours = Number(document.getElementById('wl-hours-' + lineId).value);
  const date = document.getElementById('wl-date-' + lineId).value;
  const alertFn = modPrefix === 'upholstery' ? upholsteryAlert : joineryAlert;
  if (!names.length) { alertFn('Pick at least one employee.'); return; }
  const currentUser = modPrefix === 'upholstery' ? upholsteryCurrentUser : joineryCurrentUser;
  let ok = 0, err = null;
  names.forEach(n => {
    const res = logLabourDay({ jobId, lineId, date, employeeName: n, hours, loggedBy: currentUser });
    if (res && res.error) err = res.error; else ok++;
  });
  if (err) { alertFn(err); return; }
  alertFn(`✓ Logged ${ok} day-entr${ok === 1 ? 'y' : 'ies'}.`);
  if (modPrefix === 'upholstery') renderUpholsteryBody(); else renderJoineryBody();
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

// QC fail prompts for a reason (6 Aug 2026 audit, loophole #6). The reason is
// optional: OK with a blank field records the fail with no reason; Cancel
// aborts the fail entirely (nothing recorded). Playwright's default dialog
// accept returns "" here, so existing Fail-path e2e tests still record a
// reasonless fail exactly as before.
function deptQCFail(modPrefix, jobId, lineId, deptKey, user) {
  const reason = prompt('Reason this line failed QC (optional — leave blank if none):');
  if (reason === null) return; // cancelled — don't record a fail
  deptQueueAction(modPrefix, 'recordLineQCResult', jobId, lineId, deptKey, false, user, reason);
}

// ══════════════════════════════════════════
// SHARED DASHBOARD ENHANCEMENTS (4 Aug 2026) — built after role-playing
// the Joinery Production Manager's real day: Operations routes jobs in,
// Estimator sometimes asks for pricing input, the day is spent scheduling
// week by week and reviewing quality. The dashboard used to show counts
// only ("3 Queued") with no way to see WHAT those items actually are
// without switching tabs, and nothing about quality trends or a place to
// leave yourself a reminder. All three pieces below reuse primitives that
// already existed elsewhere in the app (getDepartmentQueue, activityLog,
// tasks[]) — none of this needed new data-model work. Shared here since
// Joinery and Upholstery are the same underlying pipeline; Painting has
// its own near-identical versions in painting.js (see that file's header
// for why it doesn't consume this one).
// ══════════════════════════════════════════

// Compact "what's actually queued" list for the dashboard itself — the
// full sortable table with actions stays in the Production Queue tab
// (renderDeptQueue above); this is just enough to plan a week without
// switching tabs.
function renderDeptQueuePreview(deptKey, modPrefix, limit) {
  limit = limit || 5;
  const rows = getDepartmentQueue(deptKey).filter(r => r.entry.status !== 'ready-for-handoff');
  const body = rows.length === 0
    ? `<p style="font-size:11.5px;color:#94a3b8;">Nothing queued right now.</p>`
    : rows.slice(0, limit).map(r => {
      const c = customers.find(x => x.id === r.job.customerId);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--biz-border-light,#e2e8f0);">
        <div><p style="font-size:12.5px;font-weight:600;margin:0;">${deptEsc(r.item.product)}</p><p style="font-size:10.5px;color:#94a3b8;margin:0;">${deptEsc(r.job.id)} · ${deptEsc(c ? c.name : '—')}${r.entry.reworkCount ? ` · rework ×${r.entry.reworkCount}` : ''}</p></div>
        <span class="stage-pill ${r.entry.status}">${DEPT_QUEUE_STAGE_LABEL[r.entry.status] || r.entry.status}</span>
      </div>`;
    }).join('');
  return `
    <div class="sales-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <p style="font-weight:700;font-size:13px;margin:0;">This week's queue</p>
        <span style="font-size:11px;color:var(--biz-primary,#600131);cursor:pointer;font-weight:600;" onclick="${modPrefix}SetView('queue')">View all →</span>
      </div>
      ${body}
      ${rows.length > limit ? `<p style="font-size:10.5px;color:#94a3b8;margin-top:6px;">+ ${rows.length - limit} more in the full queue.</p>` : ''}
    </div>`;
}

// Quality/rework trend — matches Curtain's own pre-existing "Reject
// Reasons" dashboard tile in spirit, built off the same QC pass/fail
// events the production pipeline already logs to activityLog.
// Dashboard Analytics rollout (5 Aug 2026), Phase 6: the plain pass-
// rate NUMBER is now a real ring gauge (cwRingStatCard,
// chart-widgets.js) — bringing Joinery and Upholstery (both consume
// this one shared function) up to Curtain's own existing visual tier
// in a single change, rather than three separate near-identical edits.
function renderDeptQualityCard(deptKey) {
  const t = getQCTrendForDept(deptKey);
  const recentRows = t.recent.length === 0
    ? `<p style="font-size:11.5px;color:#94a3b8;">No QC history yet.</p>`
    : t.recent.map(a => `<p style="font-size:11.5px;margin:3px 0;color:${a.type === 'qc-fail' ? 'var(--bad,#d9342b)' : 'var(--ok,#0f9d58)'};">${a.type === 'qc-fail' ? '✕' : '✓'} ${deptEsc(a.message)}</p>`).join('');
  const color = t.passRate >= 90 ? 'var(--ok,#0f9d58)' : t.passRate >= 75 ? 'var(--warn,#c47d00)' : 'var(--bad,#d9342b)';
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">Quality</p>
      ${t.total === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No QC results recorded yet.</p>` : `
        <div class="dash-rings" style="margin-bottom:8px;">
          ${cwRingStatCard(t.passRate, t.passRate + '%', 'First-Pass QC Rate', `${t.passCount} passed, ${t.failCount} failed (all-time)`, color)}
        </div>
      `}
      ${renderQCRejectReasonList(deptKey)}
      ${recentRows}
    </div>`;
}

// Top QC reject reasons for a department (6 Aug 2026 audit, loophole #6) —
// the dashboard payoff of capturing reasons: WHY work fails, not just how
// often. Shared by Joinery/Upholstery here and reused by Painting's own
// quality card (painting.js). Renders nothing until at least one fail with a
// real (non-Unspecified) reason exists, so it stays quiet on a clean board.
function renderQCRejectReasonList(deptKey) {
  const reasons = getQCRejectReasonsForDept(deptKey).filter(r => r.reason !== 'Unspecified');
  if (reasons.length === 0) return '';
  const max = Math.max(...reasons.map(r => r.count));
  return `
    <div style="margin:8px 0;">
      <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;">Top reject reasons</p>
      ${reasons.map(r => `
        <div style="display:flex;align-items:center;gap:6px;margin:3px 0;">
          <span style="flex:0 0 auto;font-size:11px;min-width:16px;color:var(--bad,#d9342b);font-weight:700;">${r.count}</span>
          <div style="flex:1;height:8px;background:var(--biz-border-light,#e2e8f0);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${Math.round((r.count / max) * 100)}%;background:var(--bad,#d9342b);"></div></div>
          <span style="flex:0 0 auto;font-size:11px;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${deptEsc(r.reason)}</span>
        </div>`).join('')}
    </div>`;
}

// My Tasks/Reminders — reuses the exact tasks[] primitive the Job Card
// hub and Owner Dashboard already use, just never surfaced in a
// department's own module before. quickAddFn/completeFn are this
// module's own function names (string) since each module needs its own
// re-render after an action.
function renderDeptTasksPanel(currentUser, modPrefix) {
  const openTasks = getOpenTasksForAssignee(currentUser);
  const rows = openTasks.length === 0
    ? `<p style="font-size:11.5px;color:#94a3b8;">Nothing on your list.</p>`
    : openTasks.map(t => `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--biz-border-light,#e2e8f0);">
        <div><p style="font-size:12.5px;margin:0;">${deptEsc(t.title)}</p>${t.dueDate ? `<p style="font-size:10px;color:#94a3b8;margin:0;">Due ${t.dueDate}</p>` : ''}</div>
        <span style="font-size:11px;color:var(--ok,#0f9d58);cursor:pointer;white-space:nowrap;" onclick="deptCompleteTask('${t.id}','${modPrefix}')">✓ Done</span>
      </div>`).join('');
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">My Tasks</p>
      ${rows}
      <div style="display:flex;gap:6px;margin-top:8px;">
        <input id="${modPrefix}-quicktask" type="text" placeholder="Add a reminder…" style="flex:1;padding:8px 10px;border:1px solid var(--biz-border,#e2e8f0);border-radius:8px;font-size:12.5px;font-family:inherit;">
        <button class="secondary" style="font-size:11.5px;padding:8px 12px;" onclick="deptQuickAddTask('${modPrefix}','${currentUser}')">Add</button>
      </div>
    </div>`;
}
function deptQuickAddTask(modPrefix, currentUser) {
  const input = document.getElementById(`${modPrefix}-quicktask`);
  const title = input.value;
  if (!title || !title.trim()) return;
  const result = createTask({ title, assignee: currentUser });
  if (result.error) { (modPrefix === 'upholstery' ? upholsteryAlert : joineryAlert)(result.error); return; }
  if (modPrefix === 'upholstery') renderUpholsteryBody(); else renderJoineryBody();
}
function deptCompleteTask(taskId, modPrefix) {
  completeTask(taskId);
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
  // Fix Plan Phase 2 (5 Aug 2026) — 'pending-owner-review' gets its own
  // distinct look (in-production's amber, same family as 'pending' but
  // visually distinguishable) since it's a real, different state: the
  // department manager already approved it, it's stuck on Owner now.
  return status === 'approved' ? 'ready-for-handoff' : status === 'rejected' ? 'rework' : status === 'pending' ? 'qc' : status === 'pending-owner-review' ? 'in-production' : 'queued';
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
// approverUserType (a user_type key) decides WHICH pending approvals show;
// approverDisplayName (the real person's name) is what actually gets
// recorded as approvedBy/rejectedBy — split apart 5 Aug 2026 as part of
// the role-based access rollout, since a person's role and their name are
// no longer the same string (see the note on DEPARTMENT_APPROVERS).
function renderBudgetApprovals(approverUserType, approverDisplayName, modPrefix) {
  const rows = getPendingBudgetApprovalsFor(approverUserType);
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
        <button class="primary" style="flex:1;font-size:11.5px;" onclick="deptApproveBudget('${modPrefix}','${r.job.id}','${r.deptKey}','${deptEsc(approverDisplayName)}')">Approve</button>
        <button class="secondary" style="flex:1;font-size:11.5px;color:#b91c1c;" onclick="deptRejectBudget('${modPrefix}','${r.job.id}','${r.deptKey}','${deptEsc(approverDisplayName)}')">Reject</button>
      </div>
    </div>`;
  }).join('');
}

// Fix Plan Phase 2 (5 Aug 2026) — Operations Manager became a third
// caller of renderBudgetApprovals() (DEPARTMENT_APPROVERS now points
// carp/paint/uph at 'operations_manager' instead of the submitting
// department's own manager — real maker-checker, since Operations
// Manager never submits any of these budgets themselves). Generalized
// from the old two-way upholstery/joinery-only ternary rather than
// bolting on a third hardcoded branch inline at every call site.
function deptAlertFn(modPrefix) {
  if (modPrefix === 'upholstery') return upholsteryAlert;
  if (modPrefix === 'operations') return (typeof showAlert === 'function' ? showAlert : alert);
  return joineryAlert;
}
function deptRerenderBody(modPrefix) {
  if (modPrefix === 'upholstery') renderUpholsteryBody();
  else if (modPrefix === 'operations') { if (typeof renderOpsBudgetApprovals === 'function') renderOpsBudgetApprovals(); }
  else renderJoineryBody();
}

function deptApproveBudget(modPrefix, jobId, deptKey, approverName) {
  const result = approveDepartmentBudget(jobId, deptKey, approverName);
  const alertFn = deptAlertFn(modPrefix);
  if (result.error) { alertFn(result.error); return; }
  alertFn(`✓ ${dc(deptKey).n} budget approved.`);
  deptRerenderBody(modPrefix);
}
function deptRejectBudget(modPrefix, jobId, deptKey, approverName) {
  const comment = window.prompt('Reason for rejecting this budget:', '') || '';
  const result = rejectDepartmentBudget(jobId, deptKey, approverName, comment);
  const alertFn = deptAlertFn(modPrefix);
  if (result.error) { alertFn(result.error); return; }
  alertFn(`Budget rejected.`);
  deptRerenderBody(modPrefix);
}
