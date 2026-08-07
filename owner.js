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
ownerModuleWrap.className = 'xshell'; // exec-shell pilot (6 Aug 2026) — template shell, wine identity, light/dark toggle
ownerModuleWrap.style.cssText = 'display:none;';
document.body.appendChild(ownerModuleWrap);

// Shell is (re)built on every open so the sidebar badges (approvals,
// budget reviews) are fresh — cheap, it's just innerHTML.
function ownerBuildShell() {
  const signups = (typeof approvalQueueRows !== 'undefined' && approvalQueueRows.length) || 0;
  const budgets = typeof getPendingBudgetApprovalsFor === 'function' ? getPendingBudgetApprovalsFor('owner').length : 0;
  ownerModuleWrap.innerHTML = execShellHTML({
    title: 'Owner Dashboard', sub: null, role: 'Owner · Full access',
    contentId: 'owner-body', closeFn: 'closeOwnerModule',
    navGroups: [
      {
        label: 'Workspace', items: [
          { id: 'owner-overview', ico: '▦', label: 'Overview', onclick: "ownerNav('dashboard')" },
          { id: 'owner-planner', ico: '🗓', label: 'Week planner', onclick: 'execOpenPlanner()' },
          { id: 'owner-tasks', ico: '✓', label: 'My tasks', onclick: "execFocusPanel('tasks')" }
        ]
      },
      {
        label: 'Business', items: [
          { id: 'm-sales', ico: '◉', label: 'Sales pipeline', onclick: "ownerGoTo('launchSalesModule')" },
          { id: 'm-jobs', ico: '⚒', label: 'Job cards', onclick: "ownerGoTo('launchJobsModule')" },
          /* "Deliveries" is this app's Delivery Scheduling module. */
          { id: 'm-deliveries', ico: '🚚', label: 'Deliveries', onclick: "ownerGoTo('launchDeliverySchedModule')" }
        ]
      },
      {
        label: 'Money', items: [
          /* Revenue/Invoices/Receivables are three views of the Accounts
             module, so each opens Accounts on the tab that owns it. */
          { id: 'm-revenue', ico: '▤', label: 'Revenue', onclick: "ownerGoToAccounts('dashboard')" },
          { id: 'm-invoices', ico: '🧾', label: 'Invoices', onclick: "ownerGoToAccounts('invoices')" },
          { id: 'm-receivables', ico: '⏳', label: 'Receivables', onclick: "ownerGoToAccounts('bill-os')" }
        ]
      },
      {
        label: 'Company', items: [
          /* "Departments" is Operations, which owns the cross-department view. */
          { id: 'm-departments', ico: '⚙', label: 'Departments', onclick: 'ownerGoToOperations()' },
          { id: 'm-hr', ico: '☰', label: 'HR & payroll', onclick: "ownerGoTo('launchHRModule')" },
          { id: 'm-purchasing', ico: '⬡', label: 'Purchasing', onclick: "ownerGoTo('launchPurchasingModule')" }
        ]
      },
      {
        label: 'Administration', items: [
          /* Users & roles and Settings both live in the Admin dashboard;
             Masters is Storekeeper's own Masters tab (units, categories,
             catalogues) — this app has no separate Masters module. */
          { id: 'm-users', ico: '🛡', label: 'Users & roles', onclick: "ownerGoToAdmin('users')" },
          { id: 'm-masters', ico: '🗂', label: 'Masters', onclick: 'ownerGoToMasters()' },
          { id: 'm-settings', ico: '⚙', label: 'Settings', onclick: "ownerGoToAdmin('devpreview')" }
        ]
      }
    ]
  });
}
// Sidebar destinations that need a specific tab once the module opens.
// hideModuleWrap (via ownerGoTo's own pattern), never close*Module().
function ownerGoToAccounts(view) {
  ownerGoTo('launchAccountsModule');
  setTimeout(() => { if (typeof accountsSetView === 'function') accountsSetView(view); }, 260);
}
function ownerGoToAdmin(view) {
  ownerGoTo('launchAdminModule');
  setTimeout(() => { if (typeof adminSetView === 'function') adminSetView(view); }, 260);
}
function ownerGoToMasters() {
  ownerGoTo('launchStorekeeperModule');
  setTimeout(() => { if (typeof skGoTo === 'function') skGoTo('masters'); }, 260);
}
function ownerNav(view) {
  ownerView = view;
  renderOwnerBody();
  execMarkActive(view === 'dashboard' ? 'owner-overview' : view === 'approvals' ? 'owner-approvals' : 'owner-budgets');
}

function ownerEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }
function ownerBHD(v) { return 'BD ' + Math.round(v).toLocaleString('en-US'); }

// Quality ring for one department (Dashboard Analytics rollout, 5 Aug
// 2026). Curtain is a special case: it never logs qc-pass/qc-fail to
// activityLog the way the shared Joinery/Upholstery/Painting pipeline
// does (getQCTrendForDept() would always read zero for 'curt') — it
// has its own separate stats (getCurtainQCStats(), curtain.js), read
// here instead so all four departments' rings are equally real.
function ownerDeptQualityRing(deptKey) {
  let passRate, passCount, total;
  if (deptKey === 'curt') {
    const qc = getCurtainQCStats();
    passRate = qc.pct; passCount = qc.passCount; total = qc.total;
  } else {
    const q = getQCTrendForDept(deptKey);
    passRate = q.passRate; passCount = q.passCount; total = q.total;
  }
  const color = passRate == null ? 'var(--biz-text-faint)' : passRate >= 90 ? 'var(--ok)' : passRate >= 75 ? 'var(--warn)' : 'var(--bad)';
  return cwRingStatCard(passRate || 0, passRate == null ? '—' : `${passRate}%`, dc(deptKey).n, total ? `${passCount} of ${total} passed` : 'No QC yet', color);
}

function openOwnerModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['ops-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap', 'admin-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  ownerModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  ownerBuildShell();
  execSetContext('owner', 'renderOwnerBody');
  execThemeApply();
  ownerView = 'dashboard';
  renderOwnerBody();
  execMarkActive('owner-overview');
  execRefreshBadges();
  // Fire-and-forget count for the "Pending Sign-ups" tile above — the
  // dashboard itself renders synchronously as always, this just patches
  // the badge in shortly after, same optimistic-then-patch pattern as
  // every cloud-backed cache in this app.
  if (typeof loadApprovalQueue === 'function') loadApprovalQueue().then(() => { if (ownerView === 'dashboard') renderOwnerBody(); });
}
function closeOwnerModule() { closeModuleWrap(ownerModuleWrap, 'launchOwnerModule'); }
function launchOwnerModule() { openOwnerModule(); }

// Jumps straight into a real module, same pattern as every other
// cross-module hop in this app (jobsNewVariation, salesRequestPurchase).
function ownerGoTo(fn) {
  hideModuleWrap(ownerModuleWrap);
  setTimeout(() => { if (typeof window[fn] === 'function') window[fn](); }, 150);
}
function ownerGoToOperations() {
  hideModuleWrap(ownerModuleWrap);
  setTimeout(() => goTo('operations'), 150);
}

// Approvals (5 Aug 2026, role-based access rollout) — the one new
// screen state this dashboard needs; everything else here stays the
// single static summary render it always was. Shared with HR's own
// Approvals tab, see approval-queue.js.
let ownerView = 'dashboard';
function ownerOpenApprovals() { ownerNav('approvals'); }
function ownerBackToDashboard() { ownerNav('dashboard'); }

// ── My Tasks (exec-shell pilot) — the "task code should be there" ask:
// every task row leads with its real id (T-00001 style) plus any linked
// job/record id, with quick-add and one-tap complete. Reuses the same
// tasks[] primitive every other tasks panel in the app already uses.
function ownerTasksCard() {
  const open = getOpenTasksForAssignee(execIdentity());
  const rows = open.length === 0
    ? `<p style="font-size:12px;color:var(--biz-text-muted,#64748b);margin:0;">Nothing on your list.</p>`
    : open.map(t => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--biz-border-light);">
        <span class="xs-rem-code" style="margin:2px 0 0;">${ownerEsc(t.id)}</span>
        <div style="flex:1;min-width:0;">
          <p style="font-size:12.5px;margin:0;color:var(--biz-text,#16181d);">${ownerEsc(t.title)}</p>
          <p style="font-size:10.5px;color:var(--biz-text-muted,#94a3b8);margin:1px 0 0;">${t.dueDate ? 'due ' + t.dueDate : 'no due date'}${t.linkedId ? ' · ' + ownerEsc(t.linkedId) : ''}</p>
        </div>
        <span style="font-size:11px;color:var(--ok,#0f9d58);cursor:pointer;white-space:nowrap;font-weight:600;" onclick="ownerCompleteTask('${ownerEsc(t.id)}')">✓ Done</span>
      </div>`).join('');
  return `
    <div class="sales-card">
      <h3>My Tasks${open.length ? ` <span style="color:var(--biz-text-muted);font-weight:500;">· ${open.length} open</span>` : ''}</h3>
      ${rows}
      <div style="display:flex;gap:7px;margin-top:9px;">
        <input id="owner-task-input" type="text" placeholder="Add a task…" style="flex:1;padding:8px 11px;border:1px solid var(--biz-border-light);border-radius:8px;font-size:12px;font-family:inherit;background:var(--biz-card-bg);color:var(--biz-text,#16181d);" onkeydown="if(event.key==='Enter')ownerAddTask();">
        <button class="primary" style="font-size:11.5px;padding:8px 14px;" onclick="ownerAddTask()">Add</button>
      </div>
    </div>`;
}
function ownerAddTask() {
  const input = document.getElementById('owner-task-input');
  if (!input || !input.value.trim()) return;
  const r = createTask({ title: input.value.trim(), assignee: execIdentity() });
  if (r.error) { if (typeof commsToast === 'function') commsToast(r.error); return; }
  renderOwnerBody();
  execRefreshBadges();
}
function ownerCompleteTask(id) {
  completeTask(id);
  renderOwnerBody();
  execRefreshBadges();
}

// Template-style stat tiles: real numbers with a real month-over-month
// delta where one is computable (invoiced revenue), plain values where a
// delta would be invented.
function ownerStatTiles(acctK, jobK) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const lastMonthDate = new Date(); lastMonthDate.setDate(1); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.getFullYear() + '-' + String(lastMonthDate.getMonth() + 1).padStart(2, '0');
  const invTotal = (mk) => taxInvoices.filter(i => (i.date || '').slice(0, 7) === mk).reduce((s, i) => s + (i.totals ? i.totals.netTotal : 0), 0);
  const revMTD = invTotal(thisMonth), revPrev = invTotal(lastMonth);
  const revDelta = revPrev > 0 ? Math.round((revMTD - revPrev) / revPrev * 100) : null;
  const openQuotes = quotations.filter(q => q.lifecycleStatus === 'open');
  const openQuoteValue = openQuotes.reduce((s, q) => s + computeQuotationTotals(q).netTotal, 0);
  const urgentCount = jobCards.filter(j => j.status === 'open' && j.urgent).length;
  const reminders = getExecReminders().length;
  return `
    <div class="xs-tiles">
      <div class="xs-tile" style="cursor:pointer;" onclick="ownerGoTo('accounts')">
        <div class="xs-tile-label">Revenue — invoiced MTD</div>
        <div class="xs-tile-value"><span class="unit">BD</span>${Math.round(revMTD).toLocaleString('en-US')}</div>
        <div class="xs-tile-foot">${revDelta === null ? '<span>first month of data</span>' : `<span class="xs-delta ${revDelta >= 0 ? 'up' : 'down'}">${revDelta >= 0 ? '▲' : '▼'} ${Math.abs(revDelta)}%</span><span>vs last month</span>`}</div>
      </div>
      <div class="xs-tile" style="cursor:pointer;" onclick="ownerGoTo('sales')">
        <div class="xs-tile-label">Open quotations</div>
        <div class="xs-tile-value"><span class="unit">BD</span>${Math.round(openQuoteValue).toLocaleString('en-US')}</div>
        <div class="xs-tile-foot"><span>${openQuotes.length} live quote${openQuotes.length === 1 ? '' : 's'}</span></div>
      </div>
      <div class="xs-tile" style="cursor:pointer;" onclick="ownerGoTo('jobs')">
        <div class="xs-tile-label">Active jobs</div>
        <div class="xs-tile-value">${jobK.open}</div>
        <div class="xs-tile-foot">${urgentCount ? `<span class="xs-delta down">🔥 ${urgentCount}</span><span>urgent</span>` : '<span>none urgent</span>'}</div>
      </div>
      <div class="xs-tile" style="cursor:pointer;" onclick="ownerGoTo('accounts')">
        <div class="xs-tile-label">Receivables</div>
        <div class="xs-tile-value"><span class="unit">BD</span>${Math.round(acctK.receivables).toLocaleString('en-US')}</div>
        <div class="xs-tile-foot"><span>outstanding balance</span></div>
      </div>
      <div class="xs-tile" style="cursor:pointer;" onclick="execToggleReminders(true)">
        <div class="xs-tile-label">Needs attention</div>
        <div class="xs-tile-value">${reminders}</div>
        <div class="xs-tile-foot"><span>open reminders — see 🔔</span></div>
      </div>
    </div>`;
}

// Fix Plan Phase 2 (5 Aug 2026, Fable audit findings #1/#2) — a
// department budget over BD 5,000 needs a second, Owner-only approval
// (approveDepartmentBudgetOwnerReview()/rejectDepartmentBudgetOwnerReview(),
// data.js) on top of the department manager's own. getPendingBudgetApprovalsFor
// ('owner') already surfaces both a normal department-level "pending"
// entry (Owner is a wildcard, can approve directly like any department
// approver) and the over-threshold "pending-owner-review" ones — this
// screen shows both, branching the action per row's own actual status.
function ownerOpenBudgetReviews() { ownerView = 'budget-review'; renderOwnerBody(); }
function ownerBudgetReviewApprove(jobId, deptKey, status) {
  const result = status === 'pending-owner-review'
    ? approveDepartmentBudgetOwnerReview(jobId, deptKey, 'Salman Abdullah')
    : approveDepartmentBudget(jobId, deptKey, 'Salman Abdullah');
  if (result.error) { if (typeof commsToast === 'function') commsToast(result.error); return; }
  renderOwnerBody();
}
function ownerBudgetReviewReject(jobId, deptKey, status) {
  const comment = window.prompt('Reason for rejecting this budget:');
  if (!comment) return;
  const result = status === 'pending-owner-review'
    ? rejectDepartmentBudgetOwnerReview(jobId, deptKey, 'Salman Abdullah', comment)
    : rejectDepartmentBudget(jobId, deptKey, 'Salman Abdullah', comment);
  if (result.error) { if (typeof commsToast === 'function') commsToast(result.error); return; }
  renderOwnerBody();
}

function renderOwnerBody() {
  const body = document.getElementById('owner-body');
  if (!body) return;
  if (ownerView === 'approvals') {
    body.innerHTML = `<span class="sales-back" onclick="ownerBackToDashboard()">‹ Back to Dashboard</span><div id="owner-approval-queue"></div>`;
    renderApprovalQueueScreen('owner-approval-queue');
    return;
  }
  if (ownerView === 'budget-review') {
    const rows = getPendingBudgetApprovalsFor('owner');
    body.innerHTML = `<span class="sales-back" onclick="ownerBackToDashboard()">‹ Back to Dashboard</span>` + (rows.length === 0
      ? `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No department budgets waiting on you right now.</p></div>`
      : rows.map(({ job, deptKey, entry }) => {
          const c = customers.find(x => x.id === job.customerId);
          const t = computeBOMTotals(entry.bom);
          const overThreshold = requiresOwnerApproval(t.totalCostInclOH);
          return `
          <div class="sales-card">
            <p style="font-weight:700;font-size:13px;margin:0 0 4px;">${ownerEsc(job.id)} — ${ownerEsc(dc(deptKey).n)}</p>
            <p style="font-size:11px;color:#94a3b8;margin:0 0 6px;">${ownerEsc(c ? c.name : '—')} · ${ownerBHD(t.totalCostInclOH)}${overThreshold ? ` · over BD ${BUDGET_APPROVAL_THRESHOLD} — ${entry.approvalStatus === 'pending-owner-review' ? 'manager already approved, needs your final review' : 'will need a second Owner review once approved'}` : ''}</p>
            <div style="display:flex;gap:8px;">
              <button class="primary" style="flex:1;font-size:11.5px;" onclick="ownerBudgetReviewApprove('${ownerEsc(job.id)}','${ownerEsc(deptKey)}','${ownerEsc(entry.approvalStatus)}')">Approve</button>
              <button class="secondary" style="flex:1;font-size:11.5px;color:#b91c1c;" onclick="ownerBudgetReviewReject('${ownerEsc(job.id)}','${ownerEsc(deptKey)}','${ownerEsc(entry.approvalStatus)}')">Reject</button>
            </div>
          </div>`;
        }).join(''));
    return;
  }

  // ── Overview — the redesigned dashboard (7 Aug 2026) ──
  // Salman supplied a high-fidelity design handoff and asked for it exactly.
  // owner-dashboard.js owns the layout and every card; this just mounts it.
  // The old hand-rolled overview (KPI tiles + per-department cards + charts)
  // is gone — the new By-department card replaces the eight stacked ones,
  // and its own tiles read the same KPI functions those cards used.
  if (typeof OwnerDashboard === 'undefined') {
    body.innerHTML = '<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">Owner dashboard failed to load.</p></div>';
    return;
  }
  OwnerDashboard.mount(body);
}
