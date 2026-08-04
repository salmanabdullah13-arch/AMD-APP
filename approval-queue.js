// ══════════════════════════════════════════
// APPROVAL QUEUE (5 Aug 2026, role-based access rollout)
// Shared screen for Owner + HR dashboards — self-registered accounts
// (auth.js's new sign-up form) land as approval_status='pending' and
// have zero app access (enforced in RLS via public.is_approved(), see
// supabase/schema.sql) until someone here approves or rejects them.
// Simple on-demand fetch each time this opens rather than a persistent
// cache/realtime subscription — this is a low-frequency admin action,
// not something that needs live cross-device sync the way messages or
// job cards do.
// ══════════════════════════════════════════

let approvalQueueRows = [];
let approvalQueueUserTypes = [];

function aqEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }

async function loadApprovalQueue() {
  if (!window.__realCloudSession || !sb) { approvalQueueRows = []; return; }
  const [{ data: pending, error }, { data: types }] = await Promise.all([
    sb.from('profiles').select('id, display_name, dob, phone, designation, user_type, approval_status').eq('approval_status', 'pending').order('display_name'),
    sb.from('user_types').select('key,label').order('label')
  ]);
  approvalQueueRows = error ? [] : (pending || []);
  approvalQueueUserTypes = types || [];
}

// containerId: the DOM node to re-render into once loaded/after an
// action — each host module (owner.js/hr.js) passes its own body id so
// this stays a plain shared function, not tied to one module's globals.
async function renderApprovalQueueScreen(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<p style="text-align:center;font-size:13px;color:#94a3b8;padding:20px 0;">Loading pending sign-ups…</p>`;
  await loadApprovalQueue();
  renderApprovalQueueInto(containerId);
}

function renderApprovalQueueInto(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!window.__realCloudSession) {
    el.innerHTML = `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">Approval queue needs a real cloud login — not available in this session.</p></div>`;
    return;
  }
  if (approvalQueueRows.length === 0) {
    el.innerHTML = `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No sign-ups waiting on approval right now.</p></div>`;
    return;
  }
  const typeOptions = approvalQueueUserTypes.map(t => `<option value="${aqEsc(t.key)}">${aqEsc(t.label)}</option>`).join('');
  el.innerHTML = approvalQueueRows.map(r => `
    <div class="sales-card" id="aq-row-${aqEsc(r.id)}">
      <p style="font-weight:700;font-size:13px;margin:0 0 4px;">${aqEsc(r.display_name)}</p>
      <p style="font-size:11px;color:#94a3b8;margin:0 0 8px;">${aqEsc(r.designation || '—')} · DOB ${aqEsc(r.dob || '—')} · ${aqEsc(r.phone || '—')}</p>
      <label style="font-size:11px;color:#64748b;">User Type (correct if needed before approving)</label>
      <select id="aq-usertype-${aqEsc(r.id)}" style="width:100%;padding:9px 10px;border:1px solid var(--biz-border-light,#e2e8f0);border-radius:8px;font-size:12.5px;margin:4px 0 10px;">
        ${approvalQueueUserTypes.map(t => `<option value="${aqEsc(t.key)}" ${t.key === r.user_type ? 'selected' : ''}>${aqEsc(t.label)}</option>`).join('')}
      </select>
      <div style="display:flex;gap:8px;">
        <button class="primary" style="flex:1;font-size:11.5px;" onclick="approvalQueueApprove('${aqEsc(r.id)}','${aqEsc(containerId)}')">Approve</button>
        <button class="secondary" style="flex:1;font-size:11.5px;color:#b91c1c;" onclick="approvalQueueReject('${aqEsc(r.id)}','${aqEsc(containerId)}')">Reject</button>
      </div>
    </div>`).join('');
}

async function approvalQueueApprove(profileId, containerId) {
  const select = document.getElementById(`aq-usertype-${profileId}`);
  const userType = select ? select.value : null;
  const { error } = await sb.from('profiles').update({
    approval_status: 'approved', user_type: userType,
    approved_by: window.cloudIdentity, approved_date: new Date().toISOString().slice(0, 10)
  }).eq('id', profileId);
  if (error) { if (typeof commsToast === 'function') commsToast(`Couldn't approve: ${error.message}`); return; }
  approvalQueueRows = approvalQueueRows.filter(r => r.id !== profileId);
  renderApprovalQueueInto(containerId);
}

async function approvalQueueReject(profileId, containerId) {
  const { error } = await sb.from('profiles').update({
    approval_status: 'rejected',
    approved_by: window.cloudIdentity, approved_date: new Date().toISOString().slice(0, 10)
  }).eq('id', profileId);
  if (error) { if (typeof commsToast === 'function') commsToast(`Couldn't reject: ${error.message}`); return; }
  approvalQueueRows = approvalQueueRows.filter(r => r.id !== profileId);
  renderApprovalQueueInto(containerId);
}
