// ══════════════════════════════════════════
// TEAM COMMS — shared UI usable from any module: a compose-message modal,
// a reusable inbox widget, and a generalized "Raise Purchase Request"
// shortcut. Built 4 Aug 2026 per Salman's explicit asks: "want everyone
// to have system to reach their teammates," "a link to storekeeper to
// inform him things," and "make sure all the users have an option for
// raising purchase requests to the purchaser."
// Loads right after data.js/print.js — reuses the same .sales-card/
// .sales-field/.sales-tile CSS classes every module already shares from
// the original Sales template, so no new stylesheet is needed. Depends
// only on data.js (messages[]/REACHABLE_PEOPLE) and, at call time, on
// purchasing.js's openPRForm()/prFormDeptChanged()/prFormJobChanged().
// ══════════════════════════════════════════

let commsComposeTo = '';

const commsModalWrap = document.createElement('div');
commsModalWrap.id = 'comms-modal-wrap';
commsModalWrap.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:400;background:rgba(15,23,42,.55);align-items:center;justify-content:center;padding:20px;';
commsModalWrap.innerHTML = `<div id="comms-modal-inner" style="background:#fff;border-radius:14px;padding:18px;width:100%;max-width:420px;box-sizing:border-box;max-height:85vh;overflow-y:auto;font-family:var(--font-biz);"></div>`;
document.body.appendChild(commsModalWrap);

function commsEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }
function commsToast(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('comms-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'comms-toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;padding:10px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

// asUser: the calling module's own "logged in as" identity (who's
// sending). toDefault: pre-fill the recipient (e.g. 'Storekeeper' for a
// Notify Storekeeper shortcut) — leave blank to let the sender pick.
// onSent: optional callback name (string) to re-render the calling
// module's own body after sending, since each module has its own render
// function this file can't know about ahead of time.
function openComposeMessage(asUser, toDefault, linkedType, linkedId, onSent) {
  commsComposeTo = toDefault || '';
  renderComposeMessage(asUser, linkedType, linkedId, onSent);
  commsModalWrap.style.display = 'flex';
}
function closeCommsModal() { commsModalWrap.style.display = 'none'; }

function renderComposeMessage(asUser, linkedType, linkedId, onSent) {
  // Real login (window.cloudIdentity) is authoritative once it exists —
  // asUser is each module's own simulated currentUser, still used for
  // display/exclusion until Phase 2/3 migrate every module off it, but
  // never trusted as WHO actually sends (sendMessage() in data.js
  // enforces this server-side too, via Supabase's real auth + RLS).
  const realFrom = (window.__realCloudSession && window.cloudIdentity) ? window.cloudIdentity : asUser;
  const inner = document.getElementById('comms-modal-inner');
  inner.innerHTML = `
    <p style="font-weight:700;font-size:15px;margin-bottom:10px;color:#1a1f2e;">Message a teammate</p>
    <p style="font-size:11px;color:#94a3b8;margin:-4px 0 10px;">From ${commsEsc(realFrom)}</p>
    <div class="sales-field"><label>To</label>
      <select id="comms-to" onchange="commsComposeTo=this.value;">
        <option value="">— Select —</option>
        ${REACHABLE_PEOPLE.filter(p => p !== realFrom).map(p => `<option value="${p}" ${commsComposeTo === p ? 'selected' : ''}>${p}${typeof isOnline === 'function' && isOnline(p) ? ' 🟢' : ''}</option>`).join('')}
      </select>
    </div>
    <div class="sales-field"><label>Message</label><textarea id="comms-body" placeholder="What do they need to know?"></textarea></div>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="primary" style="flex:1;" onclick="commsSend('${asUser}','${linkedType || ''}','${linkedId || ''}','${onSent || ''}')">Send</button>
      <button class="secondary" style="flex:1;" onclick="closeCommsModal()">Cancel</button>
    </div>`;
}

async function commsSend(asUser, linkedType, linkedId, onSent) {
  const to = document.getElementById('comms-to').value;
  const body = document.getElementById('comms-body').value;
  const sendBtn = document.querySelector('#comms-modal-inner button.primary');
  if (sendBtn) sendBtn.textContent = 'Sending…';
  const result = await sendMessage({ from: asUser, to, body, linkedType: linkedType || null, linkedId: linkedId || null });
  if (result.error) { commsToast(result.error); if (sendBtn) sendBtn.textContent = 'Send'; return; }
  closeCommsModal();
  commsToast(`✓ Sent to ${to}.`);
  if (onSent && typeof window[onSent] === 'function') window[onSent]();
}

// Shortcut used by "Notify Storekeeper" buttons across modules.
function notifyStorekeeper(asUser, linkedType, linkedId, onSent) {
  openComposeMessage(asUser, 'Storekeeper', linkedType, linkedId, onSent);
}

// Reusable inbox widget — drop straight into any dashboard's HTML.
// onReadRerender: the calling module's own render-function name (string),
// called after marking a message read so the unread badge updates in place.
function renderInboxWidget(person, onReadRerender, limit) {
  limit = limit || 5;
  // Realtime message/presence events (data.js) replay whichever
  // rerender function was last used to draw an inbox — this records
  // that on every draw, so live updates land wherever the user is
  // actually looking.
  window.__lastInboxRerenderFn = onReadRerender || null;
  const inbox = getInboxFor(person);
  const unread = inbox.filter(m => !m.read).length;
  const rows = inbox.slice(0, limit).map(m => `
    <div style="padding:8px 0;border-bottom:1px solid var(--biz-border-light,#e2e8f0);cursor:pointer;${m.read ? '' : 'background:#fef9f0;'}" onclick="markMessageRead('${m.id}').then(()=>{${onReadRerender ? onReadRerender + '();' : ''}})">
      <p style="font-size:12px;margin:0;"><b>${commsEsc(m.from)}</b>${m.read ? '' : ' <span style="color:var(--warn,#c47d00);font-size:9px;font-weight:700;">● NEW</span>'}</p>
      <p style="font-size:12.5px;margin:2px 0 0;color:#334155;">${commsEsc(m.body)}</p>
      <p style="font-size:10px;color:#94a3b8;margin:2px 0 0;">${m.date}</p>
    </div>`).join('');
  const onlineOthers = (typeof onlineIdentities !== 'undefined' ? [...onlineIdentities] : []).filter(p => p !== window.cloudIdentity);
  const presenceLine = (window.__realCloudSession && onlineOthers.length > 0)
    ? `<p style="font-size:10.5px;color:#0f9d58;margin:0 0 8px;">🟢 Online now: ${onlineOthers.map(commsEsc).join(', ')}</p>` : '';
  return `
    <div class="sales-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <p style="font-weight:700;font-size:13px;margin:0;">Messages ${unread ? `<span style="background:var(--warn,#c47d00);color:#fff;font-size:10px;padding:1px 7px;border-radius:20px;">${unread}</span>` : ''}</p>
        <span style="font-size:11px;color:var(--biz-primary,#600131);cursor:pointer;font-weight:600;" onclick="openComposeMessage('${person}','',null,null,'${onReadRerender || ''}')">+ New</span>
      </div>
      ${presenceLine}
      ${inbox.length === 0 ? `<p style="font-size:11.5px;color:#94a3b8;">No messages yet.</p>` : rows}
    </div>`;
}

// Hops into Purchasing's real "New Purchase Request" form from any
// module — same module-hop pattern as jobsNewVariation()/the earlier
// Sales-specific salesRequestPurchase(), generalized so it doesn't need
// duplicating per module. closeCurrentModuleFn: the calling module's own
// close function name (string), e.g. 'closeJoineryModule'. deptKey/jobId
// are both optional — Purchasing's PR form already supports "no specific
// job."
function requestPurchaseFromModule(closeCurrentModuleFn, deptKey, jobId) {
  // Hide the current module rather than CLOSING it: since every module's
  // close routes through closeModuleWrap(), a close here would prompt
  // "Sign out of AMD-APP?" for any single-dashboard role mid-hop. Same fix
  // the other cross-module hops got; these call sites passed the close
  // function by name, so that sweep didn't reach them.
  const wrap = [...document.querySelectorAll('.module, [id$="-module-wrap"]')]
    .find(el => el.style && el.style.display && el.style.display !== 'none');
  if (wrap && typeof hideModuleWrap === 'function') hideModuleWrap(wrap);
  else if (closeCurrentModuleFn && typeof window[closeCurrentModuleFn] === 'function') window[closeCurrentModuleFn]();
  setTimeout(() => {
    launchPurchasingModule();
    openPRForm();
    if (deptKey) { const el = document.getElementById('pr-form-dept'); if (el) el.value = deptKey; prFormDeptChanged(deptKey); }
    if (jobId) { const el = document.getElementById('pr-form-job'); if (el) el.value = jobId; prFormJobChanged(jobId); }
  }, 150);
}
