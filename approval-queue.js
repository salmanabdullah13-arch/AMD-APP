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
let passwordResetRequests = [];

function aqEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }

async function loadApprovalQueue() {
  if (!window.__realCloudSession || !sb) { approvalQueueRows = []; passwordResetRequests = []; return; }
  const [{ data: pending, error }, { data: types }, { data: resets }] = await Promise.all([
    sb.from('profiles').select('id, display_name, dob, phone, designation, user_type, approval_status').eq('approval_status', 'pending').order('display_name'),
    sb.from('user_types').select('key,label').order('label'),
    sb.from('password_reset_requests').select('id, display_name, requested_at').eq('resolved', false).order('requested_at', { ascending: false })
  ]);
  approvalQueueRows = error ? [] : (pending || []);
  approvalQueueUserTypes = types || [];
  passwordResetRequests = resets || [];
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

// Real hard block, not just a friendly rejection (that's auth.js's
// calculateAge() check at sign-up time) — this is what actually
// prevents an under-18 sign-up from ever being approved, including one
// that reached the manual identity-claim fallback (auth.js), which
// doesn't collect a DOB at all — a missing DOB is treated as "can't
// verify, don't approve" rather than silently letting it through.
function aqAgeBlockReason(dob) {
  const age = typeof calculateAge === 'function' ? calculateAge(dob) : null;
  if (age === null) return 'No date of birth on file — cannot verify age.';
  if (age < 18) return `Under 18 (age ${age}) — cannot be approved.`;
  return null;
}

function renderApprovalQueueInto(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!window.__realCloudSession) {
    el.innerHTML = `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">Approval queue needs a real cloud login — not available in this session.</p></div>`;
    return;
  }
  const resetsHtml = passwordResetRequests.length === 0 ? '' : `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin:0 0 8px;">Password reset requests</p>
      ${passwordResetRequests.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--biz-border-light,#e2e8f0);">
          <div><p style="font-size:12.5px;font-weight:600;margin:0;">${aqEsc(r.display_name)}</p><p style="font-size:10.5px;color:#94a3b8;margin:0;">${aqEsc(new Date(r.requested_at).toLocaleString())}</p></div>
          <button class="secondary" style="font-size:10.5px;padding:5px 8px;" onclick="resolvePasswordResetRequest(${r.id},'${aqEsc(containerId)}')">Mark Resolved</button>
        </div>`).join('')}
      <p style="font-size:10.5px;color:#94a3b8;margin:8px 0 0;">Reset the password via the Supabase dashboard (Authentication → Users), then mark resolved.</p>
    </div>`;
  if (approvalQueueRows.length === 0) {
    el.innerHTML = resetsHtml || `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No sign-ups waiting on approval right now.</p></div>`;
    return;
  }
  el.innerHTML = resetsHtml + approvalQueueRows.map(r => {
    const blockReason = aqAgeBlockReason(r.dob);
    return `
    <div class="sales-card" id="aq-row-${aqEsc(r.id)}">
      <p style="font-weight:700;font-size:13px;margin:0 0 4px;">${aqEsc(r.display_name)}</p>
      <p style="font-size:11px;color:#94a3b8;margin:0 0 8px;">${aqEsc(r.designation || '—')} · DOB ${aqEsc(r.dob || '—')} · ${aqEsc(r.phone || '—')}</p>
      ${blockReason ? `<p style="font-size:11.5px;color:#b91c1c;font-weight:600;margin:0 0 8px;">⚠ ${aqEsc(blockReason)}</p>` : ''}
      <label style="font-size:11px;color:#64748b;">User Type (correct if needed before approving)</label>
      <select id="aq-usertype-${aqEsc(r.id)}" style="width:100%;padding:9px 10px;border:1px solid var(--biz-border-light,#e2e8f0);border-radius:8px;font-size:12.5px;margin:4px 0 10px;">
        ${approvalQueueUserTypes.map(t => `<option value="${aqEsc(t.key)}" ${t.key === r.user_type ? 'selected' : ''}>${aqEsc(t.label)}</option>`).join('')}
      </select>
      <div style="display:flex;gap:8px;">
        ${blockReason ? `<button class="secondary" style="flex:1;font-size:11.5px;" disabled title="${aqEsc(blockReason)}">Approve</button>` : `<button class="primary" style="flex:1;font-size:11.5px;" onclick="approvalQueueApprove('${aqEsc(r.id)}','${aqEsc(containerId)}')">Approve</button>`}
        <button class="secondary" style="flex:1;font-size:11.5px;color:#b91c1c;" onclick="approvalQueueReject('${aqEsc(r.id)}','${aqEsc(containerId)}')">Reject</button>
      </div>
    </div>`;
  }).join('');
}

async function approvalQueueApprove(profileId, containerId) {
  // Real gate, not just a disabled button in the UI — the button is
  // already hidden for a blocked row, but this re-checks against the
  // in-memory row directly in case of a stale render or DOM tampering.
  const row = approvalQueueRows.find(r => r.id === profileId);
  const blockReason = row ? aqAgeBlockReason(row.dob) : 'Row not found.';
  if (blockReason) { if (typeof commsToast === 'function') commsToast(`Cannot approve: ${blockReason}`); return; }
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

async function resolvePasswordResetRequest(id, containerId) {
  const { error } = await sb.from('password_reset_requests').update({
    resolved: true, resolved_by: window.cloudIdentity, resolved_date: new Date().toISOString().slice(0, 10)
  }).eq('id', id);
  if (error) { if (typeof commsToast === 'function') commsToast(`Couldn't mark resolved: ${error.message}`); return; }
  passwordResetRequests = passwordResetRequests.filter(r => r.id !== id);
  renderApprovalQueueInto(containerId);
}
