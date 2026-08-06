// ══════════════════════════════════════════
// EXEC SHELL — Owner/Admin pilot (6 Aug 2026)
// Replicates the structure of Salman's uploaded dashboard template
// (sidebar + topbar + reminders bell + chat panel) re-tinted onto the
// app's own wine/light identity, with a per-user light/dark toggle.
// PILOT SCOPE: consumed only by owner.js and admin.js for now — if
// Salman likes living in it, later phases roll it out app-wide.
//
// Dark mode works by re-defining the existing --biz-* token VALUES on
// the module wrap (custom properties inherit), so every existing card/
// chart inside re-themes without touching its render code. The dark
// palette adapts the template's layered-surface structure but keeps the
// wine hue family (brightened for contrast on dark) — Salman's explicit
// call: keep the wine identity, purple is out.
//
// Reminders: real signals only (pending sign-ups, Owner budget reviews,
// jobs awaiting routing, urgent/overdue jobs, reorder alerts, open
// tasks with their task code, unread messages) — never invented rows.
// Chat: a slide-in panel over the real messages[] system (sendMessage/
// getInboxFor/markMessageRead), per-person unread counts, thread view.
// ══════════════════════════════════════════

const execStyleTag = document.createElement('style');
execStyleTag.textContent = `
/* ---- shell tokens: light (default) = the app's existing identity ---- */
.xshell{
  --x-plane:var(--biz-page-bg,#f5f6f8);
  --x-surface:#ffffff;
  --x-surface-2:#f1edf0;
  --x-hairline:#e5e0e4;
  --x-hairline-strong:#d3cbd1;
  --x-ink:#16181d;
  --x-ink-2:#4b4550;
  --x-ink-3:#8a8390;
  --x-brand:var(--maraya,#600131);
  --x-brand-bright:#8a2151;
  --x-wash:rgba(96,1,49,.08);
  --x-wash-2:rgba(96,1,49,.16);
  --x-shadow:0 1px 2px rgba(16,24,40,.04);
}
/* ---- dark: the template's layered surfaces, wine-tinted ---- */
.xshell.x-dark{
  --x-plane:#141018;
  --x-surface:#1d1721;
  --x-surface-2:#251d29;
  --x-hairline:rgba(255,255,255,.075);
  --x-hairline-strong:rgba(255,255,255,.15);
  --x-ink:#f5f1f4;
  --x-ink-2:#c7bec6;
  --x-ink-3:#8d8292;
  --x-brand:#a83c63;
  --x-brand-bright:#d4749b;
  --x-wash:rgba(168,60,99,.16);
  --x-wash-2:rgba(168,60,99,.3);
  --x-shadow:0 1px 2px rgba(0,0,0,.4);
  /* re-theme everything already rendered inside via the biz tokens */
  --biz-page-bg:#141018;
  --biz-card-bg:#1d1721;
  --biz-border:#3a3040;
  --biz-border-light:rgba(255,255,255,.08);
  --biz-text:#f5f1f4;
  --biz-text-muted:#a89db0;
  --biz-text-faint:#7c7185;
  --biz-primary:#a83c63;
  --biz-primary2:#c05a80;
  --biz-shadow:0 1px 2px rgba(0,0,0,.4);
  --biz-draft-bg:#2c2331;
  --biz-draft-text:#c7bec6;
}
/* id-level rules in owner.js/admin.js (#owner-module-wrap .sales-card h3
   {color:#1a1f2e}) outrank a plain class selector — match their
   specificity with id+class so dark headings stay legible. */
#owner-module-wrap.x-dark .sales-card h3,
#admin-module-wrap.x-dark .sales-card h3{color:var(--x-ink);}
.xshell.x-dark .sales-card{box-shadow:none;}
.xshell{background:var(--x-plane);}

/* ---- app grid ---- */
.xs-app{display:grid;grid-template-columns:230px 1fr;height:100%;min-height:0;flex:1;}
.xs-side{
  background:var(--x-surface);border-right:1px solid var(--x-hairline);
  display:flex;flex-direction:column;min-height:0;overflow-y:auto;
}
.xs-brand{display:flex;align-items:center;gap:10px;padding:calc(16px + var(--safe-top,0px)) 16px 14px;}
.xs-brand-mark{
  width:36px;height:36px;border-radius:10px;flex:none;display:grid;place-items:center;
  background:linear-gradient(145deg,var(--x-brand-bright),var(--x-brand) 70%);
  color:#fff;font-weight:800;font-size:14px;letter-spacing:.03em;
  box-shadow:0 4px 14px var(--x-wash-2);
}
.xs-brand-name{font-size:13.5px;font-weight:700;letter-spacing:.12em;color:var(--x-ink);}
.xs-brand-sub{font-size:9.5px;color:var(--x-ink-3);letter-spacing:.1em;text-transform:uppercase;}
.xs-nav{padding:2px 10px;flex:1;}
.xs-navlabel{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--x-ink-3);padding:14px 10px 6px;}
.xs-item{
  display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;
  border-radius:8px;color:var(--x-ink-2);font-size:13px;font-weight:500;
  background:none;border:none;cursor:pointer;text-align:left;font-family:inherit;
  position:relative;transition:background .13s,color .13s;
}
.xs-item:hover{background:var(--x-wash);color:var(--x-ink);}
.xs-item.active{background:var(--x-wash);color:var(--x-ink);font-weight:600;}
.xs-item.active::before{content:"";position:absolute;left:-10px;top:8px;bottom:8px;width:3px;background:var(--x-brand);border-radius:0 3px 3px 0;}
.xs-item .xs-ico{width:18px;flex:none;text-align:center;opacity:.85;}
.xs-item .xs-tag{
  margin-left:auto;font-size:10px;font-weight:700;padding:1px 7px;border-radius:99px;
  background:var(--x-wash-2);color:var(--x-brand-bright);
}
.xs-foot{padding:12px;border-top:1px solid var(--x-hairline);}
.xs-user{display:flex;align-items:center;gap:9px;padding:7px;border-radius:8px;}
.xs-avatar{
  width:31px;height:31px;border-radius:50%;flex:none;display:grid;place-items:center;
  font-size:11.5px;font-weight:700;color:#fff;
  background:linear-gradient(145deg,var(--x-brand-bright),var(--x-brand));
}
.xs-user-name{font-size:12.5px;font-weight:600;color:var(--x-ink);}
.xs-user-role{font-size:10.5px;color:var(--x-ink-3);}

/* ---- main column ---- */
.xs-main{min-width:0;display:flex;flex-direction:column;min-height:0;}
.xs-top{
  display:flex;align-items:center;gap:11px;
  padding:calc(11px + var(--safe-top,0px)) 18px 11px;
  background:var(--x-surface);border-bottom:1px solid var(--x-hairline);flex:none;
}
.xs-title{font-size:16px;font-weight:650;color:var(--x-ink);letter-spacing:-.01em;}
.xs-sub{font-size:11px;color:var(--x-ink-3);}
.xs-top .xs-spacer{margin-left:auto;}
.xs-iconbtn{
  position:relative;width:36px;height:36px;border-radius:50%;flex:none;
  display:grid;place-items:center;background:var(--x-surface-2);
  border:1px solid var(--x-hairline);cursor:pointer;font-size:15px;
  transition:border-color .15s;color:var(--x-ink-2);
}
.xs-iconbtn:hover{border-color:var(--x-brand);}
.xs-badge{
  position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;
  border-radius:99px;background:var(--bad,#d9342b);color:#fff;font-size:9.5px;
  font-weight:800;display:grid;place-items:center;border:2px solid var(--x-surface);
}
.xs-pulse{
  position:absolute;inset:-1px;border-radius:50%;border:1.5px solid var(--x-brand);
  opacity:0;animation:xspulse 2.6s ease-out infinite;pointer-events:none;
}
@keyframes xspulse{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.45);opacity:0}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.xs-pulse{animation:none}}
.xs-burger{display:none;}

.xs-content{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 90px;min-height:0;}

/* ---- template-style stat tiles ---- */
.xs-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px;}
.xs-tile{
  background:var(--x-surface);border:1px solid var(--x-hairline);border-radius:14px;
  padding:13px 14px;position:relative;overflow:hidden;box-shadow:var(--x-shadow);
}
.xs-tile::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,var(--x-brand),transparent);opacity:.5;}
.xs-tile-label{font-size:10.5px;color:var(--x-ink-3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;}
.xs-tile-value{font-size:22px;font-weight:700;color:var(--x-ink);letter-spacing:-.02em;margin-top:5px;line-height:1.1;}
.xs-tile-value .unit{font-size:12px;font-weight:600;color:var(--x-ink-3);margin-right:2px;}
.xs-tile-foot{display:flex;align-items:center;gap:5px;margin-top:5px;font-size:10.5px;color:var(--x-ink-3);}
.xs-delta{font-weight:700;}
.xs-delta.up{color:var(--ok,#0f9d58);}
.xs-delta.down{color:var(--bad,#d9342b);}

/* ---- reminders dropdown ---- */
.xs-panel{
  position:absolute;top:calc(54px + var(--safe-top,0px));right:14px;width:min(350px,calc(100vw - 28px));
  z-index:130;background:var(--x-surface);border:1px solid var(--x-hairline-strong);
  border-radius:14px;box-shadow:0 22px 55px rgba(0,0,0,.35);overflow:hidden;display:none;
}
.xs-panel.open{display:block;animation:xspop .15s ease-out;}
@keyframes xspop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.xs-panel-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--x-hairline);}
.xs-panel-head h3{font-size:13px;font-weight:650;margin:0;color:var(--x-ink);}
.xs-panel-body{max-height:min(430px,60vh);overflow-y:auto;}
.xs-rem{display:flex;gap:10px;padding:11px 14px;border-bottom:1px solid var(--x-hairline);}
.xs-rem:last-child{border-bottom:none;}
.xs-rem-dot{width:7px;height:7px;border-radius:50%;margin-top:5px;flex:none;}
.xs-rem-title{font-size:12.3px;font-weight:550;line-height:1.4;color:var(--x-ink);margin:0;}
.xs-rem-meta{font-size:10.5px;color:var(--x-ink-3);margin:2px 0 0;}
.xs-rem-code{font-size:10px;font-weight:700;color:var(--x-brand-bright);background:var(--x-wash);padding:1px 6px;border-radius:6px;margin-left:6px;}
.xs-scrim{position:fixed;inset:0;z-index:120;display:none;}
.xs-scrim.open{display:block;}

/* ---- chat slide-over ---- */
.xs-chat{
  position:absolute;top:0;right:0;bottom:0;width:min(360px,100vw);z-index:140;
  background:var(--x-surface);border-left:1px solid var(--x-hairline-strong);
  box-shadow:-18px 0 50px rgba(0,0,0,.3);display:none;flex-direction:column;
}
.xs-chat.open{display:flex;animation:xsslide .18s ease-out;}
@keyframes xsslide{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
.xs-chat-head{
  display:flex;align-items:center;gap:9px;
  padding:calc(13px + var(--safe-top,0px)) 14px 13px;border-bottom:1px solid var(--x-hairline);flex:none;
}
.xs-chat-head h3{font-size:13.5px;font-weight:650;margin:0;color:var(--x-ink);flex:1;}
.xs-chat-body{flex:1;overflow-y:auto;min-height:0;}
.xs-person{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--x-hairline);cursor:pointer;}
.xs-person:hover{background:var(--x-wash);}
.xs-person-name{font-size:12.8px;font-weight:600;color:var(--x-ink);}
.xs-person-last{font-size:10.8px;color:var(--x-ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;}
.xs-person .xs-unread{
  margin-left:auto;min-width:18px;height:18px;padding:0 5px;border-radius:99px;
  background:var(--x-brand);color:#fff;font-size:10px;font-weight:800;
  display:grid;place-items:center;flex:none;
}
.xs-msg{max-width:82%;margin:5px 12px;padding:8px 11px;border-radius:12px;font-size:12.5px;line-height:1.45;}
.xs-msg.in{background:var(--x-surface-2);color:var(--x-ink);border-bottom-left-radius:4px;margin-right:auto;}
.xs-msg.out{background:var(--x-brand);color:#fff;border-bottom-right-radius:4px;margin-left:auto;}
.xs-msg .xs-msg-meta{display:block;font-size:9.5px;opacity:.65;margin-top:3px;}
.xs-chat-compose{display:flex;gap:7px;padding:11px 12px calc(11px + var(--safe-bottom,0px));border-top:1px solid var(--x-hairline);flex:none;}
.xs-chat-compose input{
  flex:1;padding:9px 12px;border:1px solid var(--x-hairline-strong);border-radius:99px;
  font-size:12.5px;font-family:inherit;background:var(--x-surface-2);color:var(--x-ink);outline:none;
}
.xs-chat-compose input:focus{border-color:var(--x-brand);}
.xs-chat-compose button{
  padding:9px 15px;border:none;border-radius:99px;background:var(--x-brand);color:#fff;
  font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;
}

/* ---- mobile: sidebar becomes a drawer ---- */
@media (max-width:880px){
  .xs-app{grid-template-columns:1fr;}
  .xs-side{
    position:absolute;top:0;left:0;bottom:0;width:min(260px,84vw);z-index:150;
    transform:translateX(-105%);transition:transform .2s ease-out;box-shadow:18px 0 50px rgba(0,0,0,.25);
  }
  .xs-side.open{transform:none;}
  .xs-burger{display:grid;}
}
`;
document.head.appendChild(execStyleTag);

function execEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

// ── theme (persisted per device) ──────────────────────────────────────
function execThemeGet() { try { return localStorage.getItem('amd-exec-theme') || 'light'; } catch (e) { return 'light'; } }
function execThemeApply() {
  const dark = execThemeGet() === 'dark';
  document.querySelectorAll('.xshell').forEach(el => el.classList.toggle('x-dark', dark));
}
function execThemeToggle() {
  try { localStorage.setItem('amd-exec-theme', execThemeGet() === 'dark' ? 'light' : 'dark'); } catch (e) {}
  execThemeApply();
  // re-render whichever dashboard is open so charts pick the new tokens up
  if (typeof renderOwnerBody === 'function') renderOwnerBody();
  if (typeof renderAdminBody === 'function') renderAdminBody();
}

function execIdentity() { return window.cloudIdentity || 'Salman Abdullah'; }

// ── reminders: real signals only ─────────────────────────────────────
function getExecReminders() {
  const R = [];
  const push = (sev, title, meta, code) => R.push({ sev, title, meta, code });
  try {
    if (typeof approvalQueueRows !== 'undefined' && approvalQueueRows.length) {
      push('critical', `${approvalQueueRows.length} sign-up${approvalQueueRows.length === 1 ? '' : 's'} awaiting approval`, 'Approvals', null);
    }
    if (typeof getPendingBudgetApprovalsFor === 'function') {
      const b = getPendingBudgetApprovalsFor('owner');
      if (b.length) push('serious', `${b.length} department budget${b.length === 1 ? '' : 's'} awaiting your approval`, b.slice(0, 2).map(r => `${r.job.id} · ${dc(r.deptKey).n}`).join(' · '), b[0].job.id);
    }
    if (typeof getJobsPendingRouting === 'function') {
      const r = getJobsPendingRouting();
      if (r.length) push('warning', `${r.length} confirmed job${r.length === 1 ? '' : 's'} awaiting routing`, 'Operations → New Jobs', r[0].id);
    }
    if (typeof jobCards !== 'undefined') {
      jobCards.filter(j => j.status === 'open' && j.urgent).forEach(j =>
        push('critical', `URGENT: ${j.projectName}`, `${j.id}${j.promisedDate ? ' · promised ' + j.promisedDate : ''}`, j.id));
      jobCards.filter(j => j.status === 'open' && !j.urgent && j.promisedDate && j.promisedDate < todayStrGlobal() && !jobProductionComplete(j)).forEach(j =>
        push('serious', `Promised date overdue: ${j.projectName}`, `${j.id} · promised ${j.promisedDate}`, j.id));
    }
    if (typeof getReorderAlerts === 'function') {
      const ro = getReorderAlerts();
      if (ro.length) push('warning', `${ro.length} stock item${ro.length === 1 ? '' : 's'} at/below reorder level`, ro.slice(0, 2).map(r => r.itemName).join(' · '), null);
    }
    if (typeof getOpenTasksForAssignee === 'function') {
      getOpenTasksForAssignee(execIdentity()).forEach(t =>
        push(t.dueDate && t.dueDate < todayStrGlobal() ? 'serious' : 'info', t.title, `${t.dueDate ? 'due ' + t.dueDate : 'no due date'}${t.linkedId ? ' · ' + t.linkedId : ''}`, t.id));
    }
    if (typeof getUnreadCountFor === 'function') {
      const u = getUnreadCountFor(execIdentity());
      if (u) push('info', `${u} unread message${u === 1 ? '' : 's'}`, 'Open the chat panel', null);
    }
  } catch (e) { /* a broken signal must never blank the whole panel */ }
  const order = { critical: 0, serious: 1, warning: 2, info: 3 };
  return R.sort((a, b) => order[a.sev] - order[b.sev]);
}
const EXEC_SEV_COLOR = { critical: 'var(--bad,#d9342b)', serious: '#e8703a', warning: 'var(--warn,#c47d00)', info: 'var(--x-brand-bright)' };

let execRemOpenFlag = false;
let execAutoAlerted = false; // auto-open once per page load when something needs attention
function execToggleReminders(force) {
  execRemOpenFlag = force !== undefined ? force : !execRemOpenFlag;
  document.querySelectorAll('.xs-panel').forEach(p => p.classList.toggle('open', execRemOpenFlag));
  document.querySelectorAll('.xs-scrim').forEach(s => s.classList.toggle('open', execRemOpenFlag));
  if (execRemOpenFlag) execRenderReminders();
}
function execRenderReminders() {
  const R = getExecReminders();
  document.querySelectorAll('.xs-panel-body').forEach(body => {
    body.innerHTML = R.length === 0
      ? `<div class="xs-rem"><p class="xs-rem-title" style="color:var(--x-ink-3);">Nothing needs your attention right now.</p></div>`
      : R.map(r => `
        <div class="xs-rem">
          <span class="xs-rem-dot" style="background:${EXEC_SEV_COLOR[r.sev]}"></span>
          <div style="min-width:0;">
            <p class="xs-rem-title">${execEsc(r.title)}${r.code ? `<span class="xs-rem-code">${execEsc(r.code)}</span>` : ''}</p>
            <p class="xs-rem-meta">${execEsc(r.meta)}</p>
          </div>
        </div>`).join('');
  });
}
function execRefreshBadges() {
  const R = getExecReminders();
  const unread = typeof getUnreadCountFor === 'function' ? getUnreadCountFor(execIdentity()) : 0;
  document.querySelectorAll('.xs-rem-badge').forEach(b => { b.textContent = R.length; b.style.display = R.length ? 'grid' : 'none'; });
  document.querySelectorAll('.xs-chat-badge').forEach(b => { b.textContent = unread; b.style.display = unread ? 'grid' : 'none'; });
  // "alert when a person opens the dashboard" — pulse + one auto-open when
  // anything critical/serious is waiting, once per page load.
  const hasUrgent = R.some(r => r.sev === 'critical' || r.sev === 'serious');
  document.querySelectorAll('.xs-pulse').forEach(p => { p.style.display = R.length ? 'block' : 'none'; });
  if (hasUrgent && !execAutoAlerted) { execAutoAlerted = true; setTimeout(() => execToggleReminders(true), 450); }
}

// ── chat panel (over the real messages system) ───────────────────────
let execChatOpenFlag = false;
let execChatWith = null;
function execAllMyMessages() {
  const me = execIdentity();
  if (window.__realCloudSession && typeof cloudMessagesCache !== 'undefined') {
    return cloudMessagesCache.filter(m => m.to === me || m.from === me);
  }
  return (typeof messages !== 'undefined' ? messages : []).filter(m => m.to === me || m.from === me);
}
function execToggleChat(force) {
  execChatOpenFlag = force !== undefined ? force : !execChatOpenFlag;
  document.querySelectorAll('.xs-chat').forEach(c => c.classList.toggle('open', execChatOpenFlag));
  if (execChatOpenFlag) { execChatWith = null; execRenderChat(); }
}
function execOpenThread(person) {
  execChatWith = person;
  execRenderChat();
  // mark this person's messages to me as read
  const me = execIdentity();
  execAllMyMessages().filter(m => m.to === me && m.from === person && !m.read).forEach(m => { markMessageRead(m.id); });
  setTimeout(execRefreshBadges, 250);
}
function execRenderChat() {
  const me = execIdentity();
  document.querySelectorAll('.xs-chat').forEach(panel => {
    const head = panel.querySelector('.xs-chat-head h3');
    const body = panel.querySelector('.xs-chat-body');
    const compose = panel.querySelector('.xs-chat-compose');
    if (!body) return;
    if (!execChatWith) {
      if (head) head.textContent = 'Messages';
      if (compose) compose.style.display = 'none';
      const mine = execAllMyMessages();
      const roster = (typeof REACHABLE_PEOPLE !== 'undefined' ? REACHABLE_PEOPLE : []).filter(p => p !== me);
      body.innerHTML = roster.map(p => {
        const thread = mine.filter(m => m.from === p || m.to === p);
        const last = thread.length ? thread[thread.length - 1] : null;
        const unread = thread.filter(m => m.to === me && m.from === p && !m.read).length;
        return `
        <div class="xs-person" onclick="execOpenThread('${execEsc(p)}')">
          <div class="xs-avatar" style="width:29px;height:29px;font-size:10.5px;">${execEsc(p.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase())}</div>
          <div style="min-width:0;">
            <div class="xs-person-name">${execEsc(p)}</div>
            <div class="xs-person-last">${last ? execEsc(last.body) : 'No messages yet'}</div>
          </div>
          ${unread ? `<span class="xs-unread">${unread}</span>` : ''}
        </div>`;
      }).join('');
      return;
    }
    if (head) head.textContent = execChatWith;
    if (compose) compose.style.display = 'flex';
    const thread = execAllMyMessages()
      .filter(m => m.from === execChatWith || m.to === execChatWith)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    body.innerHTML = `<div style="padding:9px 12px 4px;"><span style="font-size:11px;color:var(--x-brand-bright);font-weight:600;cursor:pointer;" onclick="execChatWith=null;execRenderChat();">‹ All conversations</span></div>` +
      (thread.length === 0
        ? `<p style="font-size:12px;color:var(--x-ink-3);text-align:center;padding:22px 0;">No messages yet — say hello.</p>`
        : thread.map(m => `
          <div class="xs-msg ${m.from === me ? 'out' : 'in'}">${execEsc(m.body)}
            <span class="xs-msg-meta">${execEsc(m.date || '')}</span>
          </div>`).join(''));
    body.scrollTop = body.scrollHeight;
  });
}
async function execChatSend() {
  const input = document.querySelector('.xs-chat.open .xs-chat-compose input');
  if (!input || !execChatWith) return;
  const text = input.value.trim();
  if (!text) return;
  const result = await sendMessage({ from: execIdentity(), to: execChatWith, body: text });
  if (result && result.error) { if (typeof commsToast === 'function') commsToast(result.error); return; }
  input.value = '';
  execRenderChat();
}

// ── sidebar drawer (mobile) ──────────────────────────────────────────
function execToggleSide() {
  document.querySelectorAll('.xshell .xs-side').forEach(s => s.classList.toggle('open'));
}

// ── shell builder ────────────────────────────────────────────────────
// navGroups: [{label, items:[{id, ico, label, tag, onclick}]}]
// Returns the full shell markup; the host module drops it into its wrap
// and renders its own views into #<contentId>.
function execShellHTML({ title, sub, role, navGroups, contentId, closeFn }) {
  const navHtml = navGroups.map(g => `
    <div class="xs-navlabel">${execEsc(g.label)}</div>
    ${g.items.map(it => `
      <button class="xs-item" id="xsnav-${execEsc(it.id)}" onclick="${it.onclick}">
        <span class="xs-ico">${it.ico}</span>${execEsc(it.label)}
        ${it.tag ? `<span class="xs-tag">${execEsc(String(it.tag))}</span>` : ''}
      </button>`).join('')}
  `).join('');
  const me = execIdentity();
  const initials = me.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `
  <div class="xs-app">
    <aside class="xs-side">
      <div class="xs-brand">
        <div class="xs-brand-mark">AM</div>
        <div>
          <div class="xs-brand-name">AL MARAYA</div>
          <div class="xs-brand-sub">Decor</div>
        </div>
      </div>
      <nav class="xs-nav">${navHtml}</nav>
      <div class="xs-foot">
        <div class="xs-user">
          <div class="xs-avatar">${execEsc(initials)}</div>
          <div>
            <div class="xs-user-name">${execEsc(me)}</div>
            <div class="xs-user-role">${execEsc(role)}</div>
          </div>
        </div>
      </div>
    </aside>
    <div class="xs-main">
      <header class="xs-top">
        <button class="xs-iconbtn xs-burger" onclick="execToggleSide()" aria-label="Menu">☰</button>
        <div>
          <div class="xs-title">${execEsc(title)}</div>
          <div class="xs-sub">${execEsc(sub || today)}</div>
        </div>
        <span class="xs-spacer"></span>
        <button class="xs-iconbtn" onclick="execThemeToggle()" title="Light / dark mode" aria-label="Toggle theme">◐</button>
        <button class="xs-iconbtn" onclick="execToggleChat()" title="Messages" aria-label="Messages">💬<span class="xs-badge xs-chat-badge" style="display:none;">0</span></button>
        <button class="xs-iconbtn" onclick="execToggleReminders()" title="Reminders" aria-label="Reminders">
          <span class="xs-pulse"></span>🔔<span class="xs-badge xs-rem-badge" style="display:none;">0</span>
        </button>
        <button class="xs-iconbtn" onclick="${closeFn}()" title="Close" aria-label="Close">×</button>
      </header>
      <div class="xs-scrim" onclick="execToggleReminders(false)"></div>
      <div class="xs-panel">
        <div class="xs-panel-head"><h3>Reminders</h3>
          <button style="background:none;border:none;font-size:11px;color:var(--x-brand-bright);font-weight:600;cursor:pointer;font-family:inherit;" onclick="execToggleReminders(false)">Close</button>
        </div>
        <div class="xs-panel-body"></div>
      </div>
      <div class="xs-chat">
        <div class="xs-chat-head">
          <h3>Messages</h3>
          <button class="xs-iconbtn" style="width:30px;height:30px;font-size:13px;" onclick="execToggleChat(false)" aria-label="Close chat">×</button>
        </div>
        <div class="xs-chat-body"></div>
        <div class="xs-chat-compose" style="display:none;">
          <input type="text" placeholder="Type a message…" onkeydown="if(event.key==='Enter')execChatSend();">
          <button onclick="execChatSend()">Send</button>
        </div>
      </div>
      <main class="xs-content"><div id="${contentId}"></div></main>
    </div>
  </div>`;
}

function execMarkActive(navId) {
  document.querySelectorAll('.xs-item').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('xsnav-' + navId);
  if (el) el.classList.add('active');
}
