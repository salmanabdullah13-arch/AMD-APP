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
/* ──────────────────────────────────────────────────────────────────────
   Restyled into the 19a (Production) visual language, 25 Aug 2026.

   Salman's call was "restyle Joinery to the 19a look" — keep the two
   modules separate, give this one the same design language. So this is
   a STYLING pass: not one label, count, class name, DOM order or onclick
   in this module changed, because ~30 e2e suites drive this module by
   text and by selector (e.g. e2e-dashboard-enhancements.js reads
   "#joinery-body .sales-kpi-tile .num" BY INDEX, and
   e2e-joinery-substages.js asserts "#joinery-body .sales-tabs" exists
   for the manager and not for the granular roles).

   Two deliberate boundaries:
     • Everything is scoped to #joinery-module-wrap, so the shared
       renderers in dept-pipeline-ui.js (renderDeptQueue/BudgetTab/
       QueuePreview/QualityCard/TasksPanel) pick up the 19a look HERE
       and Upholstery, which shares that file, is untouched.
     • dept-pipeline-ui.js carries 87 inline style= attributes, and an
       inline style beats any rule here. Rather than fight that with
       !important, the classed surfaces (.sales-card, .sales-items,
       .stage-pill, .primary, .secondary) are restyled and the inline
       bits are left alone — they are already within a hair of 19a's
       own values (13px/700 vs 13.5/650, #94a3b8 vs --tx3 #98a2b3).

   Tokens come from dashboard-tokens.css, which .jd now joins — one copy
   of the values, light and dark, exactly as .prd/.opsd/.od/.sd do.
   ────────────────────────────────────────────────────────────────────── */
#joinery-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#joinery-module-wrap .ops-header{background:var(--biz-primary);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
/* Padding moved onto .jd-dash / .jd-page — 19a puts it on the dashboard
   wrapper ("Dashboard padding 18px 22px 26px, gap 18px"), and leaving it
   here as well would double it. */
#joinery-module-wrap .joinery-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;}

.jd{ font-family:var(--font); color:var(--tx); }
.jd *{ box-sizing:border-box; }
.jd button{ font-family:inherit; }

/* ── layout: two columns, 340px right rail (19a's own geometry) ──────── */
.jd-dash{ display:flex; gap:18px; align-items:flex-start; padding:18px 22px 26px; }
.jd-l{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:18px; }
.jd-r{ flex:0 0 340px; width:340px; display:flex; flex-direction:column; gap:18px; }
.jd-page{ padding:18px 22px 26px; display:flex; flex-direction:column; gap:18px; }

/* ── card surface. .sales-card is the shared renderers' own class, so
      restyling it here re-skins their output without touching that file. */
#joinery-module-wrap .sales-card{
  background:var(--card); border:1px solid var(--line); border-radius:16px;
  box-shadow:var(--sh); padding:14px 18px; margin:0;
}
#joinery-module-wrap .jd-card{
  background:var(--card); border:1px solid var(--line); border-radius:16px;
  box-shadow:var(--sh); overflow:hidden;
}
#joinery-module-wrap .jd-card-h{ padding:14px 18px; border-bottom:1px solid var(--line2); }
#joinery-module-wrap .jd-t{ font-size:15px; font-weight:650; letter-spacing:-.01em; }
#joinery-module-wrap .jd-sub{ font-size:11px; color:var(--tx3); margin-top:3px; line-height:1.45; }
#joinery-module-wrap .jd-sec{ font-size:13.5px; font-weight:650; margin:0 0 8px; }

/* ── the six counts, as 19a's stats strip. Same tiles, same order, same
      labels — .sales-kpi-tile/.num/.lbl are what the suites read. */
#joinery-module-wrap .sales-kpi-grid{
  display:flex; background:var(--card); border:1px solid var(--line);
  border-radius:16px; box-shadow:var(--sh2); overflow:hidden; margin:0;
}
#joinery-module-wrap .sales-kpi-tile{
  flex:1; min-width:0; padding:13px 16px; text-align:left;
  border-left:1px solid var(--line2); border-radius:0;
  background:transparent; box-shadow:none; border-top:0; border-right:0; border-bottom:0;
}
#joinery-module-wrap .sales-kpi-tile:first-child{ border-left:0; }
#joinery-module-wrap .sales-kpi-tile .num{
  font-size:21px; font-weight:700; line-height:1.1; letter-spacing:-.02em;
  color:var(--tx); font-variant-numeric:tabular-nums;
}
#joinery-module-wrap .sales-kpi-tile .lbl{
  font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase;
  color:var(--tx3); margin-top:4px; white-space:nowrap;
}
#joinery-module-wrap .sales-kpi-tile[onclick]{ cursor:pointer; }
#joinery-module-wrap .sales-kpi-tile[onclick]:hover{ background:var(--sunk); }

/* ── KPI rows (19a right column: label + sub + value 16px/700 in tone) ── */
#joinery-module-wrap .jd-kpi{
  display:flex; align-items:center; gap:12px; padding:11px 16px;
  border:0; border-bottom:1px solid var(--line2); width:100%;
  text-align:left; background:transparent;
}
#joinery-module-wrap .jd-kpi:last-child{ border-bottom:0; }
#joinery-module-wrap button.jd-kpi{ cursor:pointer; }
#joinery-module-wrap button.jd-kpi:hover{ background:var(--sunk); }
#joinery-module-wrap .jd-kpi-l{ flex:1 1 auto; min-width:0; }
#joinery-module-wrap .jd-kpi-l b{ display:block; font-size:11.5px; font-weight:650; }
#joinery-module-wrap .jd-kpi-l span{ display:block; font-size:10px; color:var(--tx3); margin-top:2px; line-height:1.4; }
#joinery-module-wrap .jd-kpi-v{ flex:none; font-size:16px; font-weight:700; font-variant-numeric:tabular-nums; color:var(--tx); }
#joinery-module-wrap .jd-kpi-v.t-ok{ color:var(--ok); }
#joinery-module-wrap .jd-kpi-v.t-warn{ color:var(--warn); }
#joinery-module-wrap .jd-kpi-v.t-bad{ color:var(--bad); }

/* ── chip row (the tab bar the shell hides on the manager views, and
      which the granular-role suites still assert is in the DOM) ─────── */
#joinery-module-wrap .sales-tabs{ display:flex; gap:7px; flex-wrap:wrap; margin:0 0 12px; }
#joinery-module-wrap .sales-tabbtn{
  height:30px; padding:0 12px; border-radius:999px; border:1px solid var(--line);
  background:var(--card); color:var(--tx2); font-size:11.5px; font-weight:650; cursor:pointer;
}
#joinery-module-wrap .sales-tabbtn.active{ background:var(--wine); border-color:var(--wine); color:#fff; }

/* ── tables: 10px/700/.05em uppercase column headers, --line2 rules ──── */
#joinery-module-wrap table.sales-items{ width:100%; border-collapse:collapse; margin:0; }
#joinery-module-wrap table.sales-items th{
  text-align:left; padding:8px 10px; background:var(--sunk); color:var(--tx3);
  font-weight:700; font-size:10px; letter-spacing:.05em; text-transform:uppercase;
  border-bottom:1px solid var(--line2);
}
#joinery-module-wrap table.sales-items td{
  padding:10px; border-bottom:1px solid var(--line2); font-size:12.5px;
  vertical-align:top; font-variant-numeric:tabular-nums;
}
#joinery-module-wrap table.sales-items tr:last-child td{ border-bottom:0; }

/* ── pills: 3px 9px / 999 / 10.5px / 700, tone pairs ─────────────────── */
#joinery-module-wrap .stage-pill{
  display:inline-block; padding:3px 9px; border-radius:999px;
  font-size:10.5px; font-weight:700; white-space:nowrap;
  background:var(--sunk); color:var(--tx2);
}
#joinery-module-wrap .stage-pill.queued{ background:var(--sunk); color:var(--tx3); }
#joinery-module-wrap .stage-pill.in-production{ background:var(--wine-tint); color:var(--wine); }
#joinery-module-wrap .stage-pill.qc{ background:var(--warn-bg); color:var(--warn); }
#joinery-module-wrap .stage-pill.rework{ background:var(--bad-bg); color:var(--bad); }
#joinery-module-wrap .stage-pill.ready-for-handoff{ background:var(--ok-bg); color:var(--ok); }

/* ── buttons ─────────────────────────────────────────────────────────── */
#joinery-module-wrap button.primary{
  height:32px; padding:0 13px; border-radius:9px; border:0;
  background:var(--wine); color:#fff; font-size:11.5px; font-weight:650; cursor:pointer;
}
#joinery-module-wrap button.secondary{
  height:32px; padding:0 13px; border-radius:9px; border:1px solid var(--line);
  background:transparent; color:var(--tx2); font-size:11.5px; font-weight:650; cursor:pointer;
}
#joinery-module-wrap button.secondary:hover{ border-color:var(--wine); color:var(--wine); }

/* The ring gauge sat in a bordered .ring-card inside an already bordered
   .sales-card — one frame inside another, stretched full width, mostly
   empty. Drop the inner frame and cap it, so it reads as an element of the
   card rather than a centred hero. */
#joinery-module-wrap .dash-rings{ margin:0 0 8px; }
#joinery-module-wrap .ring-card{
  flex:0 0 auto; min-width:0; max-width:200px; padding:4px 0 0;
  background:transparent; border:0; border-radius:0;
}

/* ── phone: one column, 14px gutters, 96px clear of the chat bubble ──── */
@media (max-width: 880px){
  .jd-dash{ flex-direction:column; padding:14px 14px 96px; gap:14px; }
  .jd-page{ padding:14px 14px 96px; gap:14px; }
  .jd-r{ flex:1 1 auto; width:100%; }
  /* A flex item defaults to min-width:auto, so a wide table would grow the
     card instead of scrolling inside it — the same trap 19a's own board and
     the Owner grid both hit. */
  .jd-l, .jd-r{ min-width:0; max-width:100%; }
  #joinery-module-wrap .sales-card, #joinery-module-wrap .jd-card,
  #joinery-module-wrap .sales-kpi-grid{ border-radius:14px; min-width:0; max-width:100%; }
  #joinery-module-wrap .sales-kpi-grid{ flex-wrap:wrap; }
  #joinery-module-wrap .sales-kpi-tile{ flex:1 1 50%; border-left:0; border-top:1px solid var(--line2); }
  #joinery-module-wrap .sales-kpi-tile:nth-child(-n+2){ border-top:0; }
  #joinery-module-wrap .sales-kpi-tile:nth-child(even){ border-left:1px solid var(--line2); }
}
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
    <div id="joinery-body" class="jd"></div>
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
  ['ops-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap', 'prd-module-wrap', 'admin-module-wrap'].forEach(id => {
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
  const head = `<div class="jd-card-h"><div class="jd-t">${jyEsc(label)} Team — your queue</div>
    <div class="jd-sub">Only the Joinery lines sitting at the ${jyEsc(label)} stage right now.</div></div>`;
  if (rows.length === 0) {
    return `<div class="jd-page"><div class="jd-card">${head}
      <div style="padding:22px 18px;font-size:11.5px;color:var(--tx3);">Nothing at the ${jyEsc(label)} stage right now.</div>
    </div></div>`;
  }
  return `<div class="jd-page"><div class="jd-card">${head}
    <div style="overflow-x:auto;">
    <table class="sales-items"><tr><th>Job</th><th>Product</th><th>Qty</th><th>Action</th></tr>
    ${rows.map(r => {
      const c = customers.find(x => x.id === r.job.customerId);
      return `<tr>
        <td><b style="font-weight:650;">${jyEsc(r.job.id)}</b><br><span style="color:var(--tx3);font-size:10.5px;">${jyEsc(c ? c.name : '—')}</span></td>
        <td>${jyEsc(r.item.product)}</td>
        <td>${r.item.qty} ${jyEsc(r.item.unit)}</td>
        <td>${nextStage ? `<button class="primary" onclick="joineryAdvanceSubStage('${r.job.id}',${r.item.lineId},'${nextStage}')">${jyEsc(label)} Done →</button>` : `<span style="font-size:10.5px;color:var(--tx3);">Ready for QC (Submit for QC from Production Queue)</span>`}</td>
      </tr>`;
    }).join('')}
    </table>
    </div>
  </div></div>`;
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
  return `<div class="jd-page"><div class="jd-card">
    <div class="jd-card-h"><div class="jd-t">Floor overview</div>
      <div class="jd-sub">Every Joinery line currently in production, by stage. Read-only — advancing a stage stays that stage's own team's action.</div></div>
    <div style="display:flex;gap:14px;overflow-x:auto;padding:14px 18px;">
    ${JOINERY_SUB_STAGES.map(stage => {
      const rows = overview[stage];
      return `<div style="min-width:190px;flex:1;">
        <p class="jd-sec">${jyEsc(JOINERY_SUB_STAGE_LABEL[stage])} <span style="color:var(--tx3);font-weight:400;">(${rows.length})</span></p>
        ${rows.length === 0 ? `<p style="font-size:11px;color:var(--tx3);">Nothing here.</p>` : rows.map(r => `
          <div style="background:var(--sunk);border:1px solid var(--line2);border-radius:10px;padding:9px 11px;margin-bottom:7px;">
            <p style="font-size:12.5px;font-weight:650;margin:0;">${jyEsc(r.item.product)}</p>
            <p style="font-size:10.5px;color:var(--tx3);margin:2px 0 0;">${jyEsc(r.job.id)}</p>
          </div>`).join('')}
      </div>`;
    }).join('')}
    </div>
  </div></div>`;
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
  if (joineryView === 'queue') content = `<div class="jd-page">${renderDeptQueue(JOINERY_DEPT_KEY, joineryCurrentUser, 'joinery')}</div>`;
  else if (joineryView === 'budget') content = `<div class="jd-page">${renderDeptBudgetTab(JOINERY_DEPT_KEY, joineryCurrentUser, 'joinery')}</div>`;
  else content = renderJoineryDashboard();
  // The tab bar stays the DIRECT first child of #joinery-body: the shell
  // hides it via `[id$="-body"] > .sales-tabs:first-child`, and
  // e2e-joinery-substages.js asserts it is present for the manager views
  // and absent for the granular ones.
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
  const handoff = count('ready-for-handoff');
  // The six tiles keep their markup, order and labels verbatim: three e2e
  // suites read them, one of them by index (.sales-kpi-tile .num[4] is
  // Budgets Pending). The 19a look comes from CSS, not from rebuilding them.
  const kpiRow = (label, sub, value, tone, onclick) => {
    const tag = onclick ? 'button' : 'div';
    return `<${tag} class="jd-kpi"${onclick ? ` onclick="${onclick}"` : ''}>
      <span class="jd-kpi-l"><b>${label}</b><span>${sub}</span></span>
      <span class="jd-kpi-v${tone ? ' t-' + tone : ''}">${value}</span>
    </${tag}>`;
  };
  return `
    <div class="jd-dash">
      <div class="jd-l">
        <div class="sales-kpi-grid">
          <div class="sales-kpi-tile"><div class="num">${count('queued')}</div><div class="lbl">Queued</div></div>
          <div class="sales-kpi-tile"><div class="num">${count('in-production')}</div><div class="lbl">In Production</div></div>
          <div class="sales-kpi-tile"><div class="num">${count('qc')}</div><div class="lbl">Awaiting QC</div></div>
          <div class="sales-kpi-tile"><div class="num">${count('rework')}</div><div class="lbl">In Rework</div></div>
          <div class="sales-kpi-tile" onclick="joinerySetView('budget')"><div class="num" style="${pendingApprovals ? 'color:var(--warn);' : ''}">${pendingApprovals}</div><div class="lbl">Budgets Pending</div></div>
          <div class="sales-kpi-tile"><div class="num" style="${overBudget ? 'color:var(--bad);' : ''}">${overBudget}</div><div class="lbl">Over Budget</div></div>
        </div>
        ${renderDeptQueuePreview(JOINERY_DEPT_KEY, 'joinery', 5)}
        ${renderDeptQualityCard(JOINERY_DEPT_KEY)}
      </div>
      <div class="jd-r">
        <div class="jd-card">
          ${kpiRow('Ready for hand-off', 'Passed QC, waiting to move to the next department (or finish, if this was the last stop).', handoff, handoff ? 'ok' : '')}
          ${kpiRow('Budgets Pending', 'Your submissions still with the Operations Manager.', pendingApprovals, pendingApprovals ? 'warn' : '', "joinerySetView('budget')")}
          ${kpiRow('Over Budget', 'Recorded actuals above the approved budget.', overBudget, overBudget ? 'bad' : '')}
        </div>
        ${renderDeptTasksPanel(joineryCurrentUser, 'joinery')}
      </div>
    </div>`;
}
