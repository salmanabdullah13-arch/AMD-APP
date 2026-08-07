// ══════════════════════════════════════════
// ADMIN DASHBOARD
// Built 5 Aug 2026, Nav overhaul Phase 2 — system administration, split
// out from the Owner Dashboard (which stays business-oversight-only).
// Three sections: Approvals (shared with Owner/HR, see
// approval-queue.js), Developer Preview (jump into any built dashboard
// for QA — reuses the same NODES + by-name launch() pattern
// owner.js's ownerGoTo() already proved, no new bypass logic), and
// User & Role Management (correct an approved account's role, or
// deactivate/reactivate one — the one genuinely new piece here, since
// no such screen existed anywhere before this).
// 'admin' gets the same full RLS wildcard 'owner' already has (see
// supabase/schema.sql's is_owner_or_hr()/is_accounts_or_owner()/
// caller_job_department_key(), and nodeAccessible() in index.html) —
// one trusted person holds both roles today.
// ══════════════════════════════════════════

const adminStyleTag = document.createElement('style');
adminStyleTag.textContent = `
#admin-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#admin-module-wrap .ops-header{background:var(--biz-primary);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#admin-module-wrap .admin-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#admin-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:12px;box-shadow:var(--biz-shadow);}
#admin-module-wrap .sales-card h3{font-weight:700;font-size:13px;margin:0 0 8px;color:#1a1f2e;}
#admin-module-wrap .sales-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;}
#admin-module-wrap .sales-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:var(--biz-card-bg);color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#admin-module-wrap .sales-tabbtn.active{background:var(--biz-primary);border-color:var(--biz-primary);color:#fff;}
#admin-module-wrap .admin-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--biz-border-light);font-size:12.5px;cursor:pointer;}
#admin-module-wrap .admin-row:last-child{border-bottom:0;}
#admin-module-wrap .admin-link{color:var(--biz-primary);font-weight:600;font-size:11px;}
#admin-module-wrap .admin-pill{font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:20px;}
#admin-module-wrap .admin-pill.active{background:#eafaf1;color:var(--ok,#0a9c5c);}
#admin-module-wrap .admin-pill.deactivated{background:#fdeceb;color:var(--bad,#d9342b);}
`;
document.head.appendChild(adminStyleTag);

const adminModuleWrap = document.createElement('div');
adminModuleWrap.id = 'admin-module-wrap';
adminModuleWrap.className = 'xshell'; // exec-shell pilot (6 Aug 2026) — same template shell as Owner
adminModuleWrap.style.cssText = 'display:none;';
document.body.appendChild(adminModuleWrap);

function adminBuildShell() {
  const signups = (typeof approvalQueueRows !== 'undefined' && approvalQueueRows.length) || 0;
  adminModuleWrap.innerHTML = execShellHTML({
    title: 'Admin Dashboard', sub: null, role: 'Admin · System administration',
    contentId: 'admin-body', closeFn: 'closeAdminModule',
    navGroups: [
      {
        label: 'Administration', items: [
          { id: 'admin-approvals', ico: '✔', label: 'Sign-up Approvals', tag: signups || null, onclick: "adminSetView('approvals')" },
          { id: 'admin-users', ico: '☰', label: 'User & Role Management', onclick: "adminSetView('users')" },
          { id: 'admin-devpreview', ico: '⚙', label: 'Developer Preview', onclick: "adminSetView('devpreview')" }
        ]
      },
      {
        label: 'Workspace', items: [
          { id: 'admin-to-owner', ico: '▦', label: 'Owner Dashboard', onclick: "adminGoToOwner()" }
        ]
      }
    ]
  });
}
function adminGoToOwner() {
  hideModuleWrap(adminModuleWrap);
  setTimeout(() => { if (typeof launchOwnerModule === 'function') launchOwnerModule(); }, 150);
}

function adminEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }

function openAdminModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['ops-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  adminModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  adminBuildShell();
  execSetContext('admin', 'renderAdminBody');
  execThemeApply();
  adminView = 'approvals';
  renderAdminBody();
  execMarkActive('admin-approvals');
  execRefreshBadges();
}
function closeAdminModule() { closeModuleWrap(adminModuleWrap, 'launchAdminModule'); }
function launchAdminModule() { openAdminModule(); }

let adminView = 'approvals'; // approvals | devpreview | users
function adminSetView(v) {
  adminView = v;
  renderAdminBody();
  if (typeof execMarkActive === 'function') execMarkActive('admin-' + (v === 'devpreview' ? 'devpreview' : v));
}

// Views moved from pill tabs into the exec-shell sidebar (6 Aug 2026
// pilot) — same three renders, navigation now lives in the sidebar.
function renderAdminBody() {
  const body = document.getElementById('admin-body');
  if (!body) return;
  if (adminView === 'devpreview') {
    body.innerHTML = renderAdminDevPreviewTab();
    return;
  }
  if (adminView === 'users') {
    body.innerHTML = `<div id="admin-users-body"></div>`;
    renderAdminUsersTab();
    return;
  }
  // Approvals — shared screen with Owner/HR, see approval-queue.js.
  body.innerHTML = `<div id="admin-approval-queue"></div>`;
  renderApprovalQueueScreen('admin-approval-queue');
}

// Developer Preview — lists every built dashboard (window.__eco3d.NODES,
// exposed by index.html's module script) and jumps straight into one via
// its own real launch(), the same by-name launch pattern owner.js's
// ownerGoTo() already proved works with no changes to nodeAccessible().
function renderAdminDevPreviewTab() {
  const allNodes = (window.__eco3d && window.__eco3d.NODES) || [];
  const built = allNodes.filter(n => n.built);
  const demoLoaded = typeof demoDataStartCounts !== 'undefined' && demoDataStartCounts !== null;
  return `
    <div class="sales-card">
      <h3>Demo Data</h3>
      <p style="font-size:11.5px;color:#94a3b8;margin:0 0 8px;">Fills every dashboard's charts with realistic multi-month, multi-division sample jobs — local only, never saved to the cloud. A page reload clears it too.</p>
      <div style="display:flex;gap:8px;">
        <button class="primary" style="flex:1;font-size:11.5px;" onclick="adminLoadDemoData()" ${demoLoaded ? 'disabled' : ''}>${demoLoaded ? 'Demo Data Loaded' : 'Load Demo Data'}</button>
        <button class="secondary" style="flex:1;font-size:11.5px;color:#b91c1c;" onclick="adminClearDemoData()" ${demoLoaded ? '' : 'disabled'}>Clear Demo Data</button>
      </div>
    </div>
    <div class="sales-card">
      <h3>Developer Preview</h3>
      <p style="font-size:11.5px;color:#94a3b8;margin:0 0 8px;">${built.length} of ${allNodes.length} dashboards built. Tap one to open it directly for QA.</p>
      ${built.map(n => `<div class="admin-row" onclick="adminDevPreviewLaunch('${adminEsc(n.id)}')"><span>${adminEsc(n.label)}</span><span class="admin-link">Open →</span></div>`).join('')}
    </div>`;
}
function adminLoadDemoData() {
  if (typeof loadDemoData === 'function') loadDemoData();
  renderAdminBody();
}
function adminClearDemoData() {
  if (typeof clearDemoData === 'function') clearDemoData();
  renderAdminBody();
}
function adminDevPreviewLaunch(nodeId) {
  const allNodes = (window.__eco3d && window.__eco3d.NODES) || [];
  const node = allNodes.find(n => n.id === nodeId);
  if (!node || typeof node.launch !== 'function') return;
  hideModuleWrap(adminModuleWrap);
  setTimeout(() => node.launch(), 150);
}

// User & Role Management — genuinely new, nothing like this existed
// before. Lists every approved OR deactivated account (so a deactivated
// one can be found again and reactivated from here too), lets Admin
// correct the role or flip active/deactivated. Simple on-demand fetch,
// same low-frequency-admin-action reasoning as approval-queue.js.
let adminUserRoster = [];
let adminUserTypesList = [];
async function loadAdminUserRoster() {
  if (!window.__realCloudSession || !sb) { adminUserRoster = []; return; }
  const [{ data: profiles }, { data: types }] = await Promise.all([
    sb.from('profiles').select('id, display_name, user_type, approval_status, designation').in('approval_status', ['approved', 'deactivated']).order('display_name'),
    sb.from('user_types').select('key,label').order('label')
  ]);
  adminUserRoster = profiles || [];
  adminUserTypesList = types || [];
}
async function renderAdminUsersTab() {
  const el = document.getElementById('admin-users-body');
  if (!el) return;
  el.innerHTML = `<p style="text-align:center;font-size:13px;color:#94a3b8;padding:20px 0;">Loading roster…</p>`;
  await loadAdminUserRoster();
  renderAdminUsersInto();
}
function renderAdminUsersInto() {
  const el = document.getElementById('admin-users-body');
  if (!el) return;
  if (!window.__realCloudSession) {
    el.innerHTML = `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">User &amp; Role Management needs a real cloud login — not available in this session.</p></div>`;
    return;
  }
  if (adminUserRoster.length === 0) {
    el.innerHTML = `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No approved accounts yet.</p></div>`;
    return;
  }
  el.innerHTML = adminUserRoster.map(p => {
    const isActive = p.approval_status === 'approved';
    return `
    <div class="sales-card" id="admin-user-${adminEsc(p.id)}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <p style="font-weight:700;font-size:13px;margin:0 0 4px;">${adminEsc(p.display_name)}</p>
          <p style="font-size:11px;color:#94a3b8;margin:0 0 8px;">${adminEsc(p.designation || '—')}</p>
        </div>
        <span class="admin-pill ${isActive ? 'active' : 'deactivated'}">${isActive ? 'Active' : 'Deactivated'}</span>
      </div>
      <label style="font-size:11px;color:#64748b;">User Type</label>
      <select id="admin-usertype-${adminEsc(p.id)}" style="width:100%;padding:9px 10px;border:1px solid var(--biz-border-light);border-radius:8px;font-size:12.5px;margin:4px 0 10px;">
        ${adminUserTypesList.map(t => `<option value="${adminEsc(t.key)}" ${t.key === p.user_type ? 'selected' : ''}>${adminEsc(t.label)}</option>`).join('')}
      </select>
      <div style="display:flex;gap:8px;">
        <button class="primary" style="flex:1;font-size:11.5px;" onclick="adminUpdateUserType('${adminEsc(p.id)}')">Save Role</button>
        <button class="secondary" style="flex:1;font-size:11.5px;color:${isActive ? '#b91c1c' : 'var(--biz-primary)'};" onclick="adminToggleUserActive('${adminEsc(p.id)}')">${isActive ? 'Deactivate' : 'Reactivate'}</button>
      </div>
    </div>`;
  }).join('');
}
async function adminUpdateUserType(profileId) {
  const select = document.getElementById(`admin-usertype-${profileId}`);
  const userType = select ? select.value : null;
  if (!userType) return;
  const { error } = await sb.from('profiles').update({ user_type: userType }).eq('id', profileId);
  if (error) { if (typeof commsToast === 'function') commsToast(`Couldn't update role: ${error.message}`); return; }
  const row = adminUserRoster.find(p => p.id === profileId);
  if (row) row.user_type = userType;
  if (typeof commsToast === 'function') commsToast('Role updated.');
}
async function adminToggleUserActive(profileId) {
  const row = adminUserRoster.find(p => p.id === profileId);
  if (!row) return;
  const goingTo = row.approval_status === 'approved' ? 'deactivated' : 'approved';
  const verb = goingTo === 'deactivated' ? 'Deactivate' : 'Reactivate';
  if (!window.confirm(`${verb} ${row.display_name}?`)) return;
  const patch = { approval_status: goingTo };
  if (goingTo === 'approved') { patch.approved_by = window.cloudIdentity; patch.approved_date = new Date().toISOString().slice(0, 10); }
  const { error } = await sb.from('profiles').update(patch).eq('id', profileId);
  if (error) { if (typeof commsToast === 'function') commsToast(`Couldn't ${verb.toLowerCase()}: ${error.message}`); return; }
  row.approval_status = goingTo;
  renderAdminUsersInto();
}
