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
  /* semantic tints stay the light values here; the dark block re-tints them
     so ok/warn/bad panels dont glow white on dark (7 Aug 2026) */
  --x-ok-bg:#eafaf1;--x-warn-bg:#fff6e3;--x-bad-bg:#fdeceb;--x-ok-line:#b6e6c9;--x-warn-line:#ffe0a0;--x-bad-line:#f5b8b5;
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
  --x-ok-bg:rgba(15,157,88,.15);--x-warn-bg:rgba(196,125,0,.17);--x-bad-bg:rgba(217,52,43,.17);
  --x-ok-line:rgba(15,157,88,.35);--x-warn-line:rgba(196,125,0,.35);--x-bad-line:rgba(217,52,43,.35);
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
/* Owner-redesign handoff: collapse lives next to the brand mark now. */
.xs-collapse-chev{
  flex:none;width:26px;height:26px;margin-left:auto;border-radius:8px;cursor:pointer;
  border:1px solid var(--x-hairline);background:transparent;color:var(--x-ink-3);font-size:13px;line-height:1;
}
.xs-collapse-chev:hover{border-color:var(--x-brand);color:var(--x-ink);}
.xshell.xs-collapsed .xs-collapse-chev{margin-left:0;}
/* Quick actions: promoted out of the sidebar to the top-left of the content
   area, above the page title — reachable before any scrolling. */
.xs-qa-row-top{display:flex;align-items:center;gap:9px;margin-bottom:4px;}
.xs-qa{
  display:inline-flex;align-items:center;gap:6px;padding:5px 11px;
  border-radius:9px;border:0;cursor:pointer;background:var(--x-brand);color:#fff;
  font-size:11.5px;font-weight:650;letter-spacing:.01em;
}
.xs-qa:hover{background:var(--x-brand-bright);}
.xs-qa-scrim{position:fixed;inset:0;z-index:140;display:none;}
.xs-qa-scrim.open{display:block;}
.xs-qa-pop{
  position:absolute;top:calc(58px + var(--safe-top,0px));left:14px;width:min(300px,calc(100vw - 28px));
  z-index:145;background:var(--x-surface);border:1px solid var(--x-hairline-strong);
  border-radius:14px;box-shadow:0 22px 55px rgba(0,0,0,.35);overflow:hidden;display:none;padding:6px;
}
.xs-qa-pop.open{display:block;}
.xs-qa-item{
  display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:0;border-radius:9px;
  background:transparent;color:var(--x-ink);font-size:12.5px;font-weight:550;cursor:pointer;text-align:left;
}
.xs-qa-item:hover{background:var(--x-wash);}
.xs-qa-item .ico{flex:none;width:20px;text-align:center;font-size:13px;}
@media(max-width:880px){
  /* bottom sheet on phone */
  .xs-qa-pop{
    position:fixed;top:auto;left:0;right:0;bottom:0;width:auto;border-radius:16px 16px 0 0;
    padding:8px 8px calc(14px + env(safe-area-inset-bottom,0px));animation:xsSheet .2s ease;
  }
  @keyframes xsSheet{from{transform:translateY(100%)}to{transform:none}}
}
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
/* Two rows, as the reference has it: controls on one line, then the page title
   underneath. The controls used to be nested inside the title block, which put
   Quick actions above the title but indented to the title's left edge — out of
   line with the burger, and reading as a stray pill floating over the heading. */
.xs-top{
  display:flex;flex-direction:column;align-items:stretch;gap:7px;
  padding:calc(11px + var(--safe-top,0px)) 18px 11px;
  background:var(--x-surface);border-bottom:1px solid var(--x-hairline);flex:none;
}
.xs-toprow{display:flex;align-items:center;gap:9px;}
/* Desktop keeps the compact pill the reference shows at top-left; on a phone
   Quick actions takes the width left over, so the row reads as one control bar
   rather than a pill adrift between two icon clusters. */
.xs-toprow .xs-qa{flex:none;padding:8px 13px;}
.xs-toprow .xs-spacer{margin-left:auto;}
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
/* ── navigation (Session 2, 7 Aug 2026): a universal back control and a
   breadcrumb trail, so no screen is ever a dead end and you can always see
   where you are. Salman: "no back button anywhere to go back to previous
   pages" + the sidebar silently changing context after a module hop. ── */
/* PATCH 08 Aug 2026 §3: secondary chrome — transparent, hairline border,
   never competing with the wine primary beside it. 36px on a phone. */
.xs-back{
  width:34px;height:34px;border-radius:50%;flex:none;display:none;place-items:center;
  background:transparent;border:1px solid var(--x-hairline);cursor:pointer;
  font-size:17px;color:var(--x-ink-2);font-family:inherit;line-height:1;
}
@media(max-width:880px){ .xs-back{width:36px;height:36px;} }
.xs-back.on{display:grid;}
.xs-back:hover{border-color:var(--x-brand);color:var(--x-ink);}
.xs-crumbs{
  display:none;align-items:center;gap:5px;flex-wrap:wrap;
  padding:7px 18px;background:var(--x-surface);border-bottom:1px solid var(--x-hairline);
  font-size:11px;color:var(--x-ink-3);flex:none;
}
.xs-crumbs.on{display:flex;}
.xs-crumb{color:var(--x-brand-bright);cursor:pointer;font-weight:600;}
.xs-crumb.plain{color:var(--x-ink-3);cursor:default;font-weight:500;}
.xs-crumb-sep{color:var(--x-ink-3);opacity:.6;}
.xs-crumb-now{color:var(--x-ink);font-weight:700;}

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
.xs-rem-go{cursor:pointer;}
.xs-rem-go:hover{background:var(--x-wash);}
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

/* ---- collapsible sidebar (rollout, 6 Aug 2026): icon rail on desktop ---- */
.xs-collapse-btn{
  width:100%;display:flex;align-items:center;justify-content:center;gap:6px;
  background:none;border:1px solid var(--x-hairline);border-radius:8px;
  color:var(--x-ink-3);font-size:11px;padding:6px;cursor:pointer;font-family:inherit;margin-bottom:8px;
}
.xs-collapse-btn:hover{border-color:var(--x-brand);color:var(--x-ink);}
.xshell.xs-collapsed .xs-app{grid-template-columns:64px 1fr;}
.xshell.xs-collapsed .xs-brand{justify-content:center;padding-left:8px;padding-right:8px;}
.xshell.xs-collapsed .xs-brand > div:not(.xs-brand-mark),
.xshell.xs-collapsed .xs-navlabel,
.xshell.xs-collapsed .xs-item .xs-lbl,
.xshell.xs-collapsed .xs-item .xs-tag,
.xshell.xs-collapsed .xs-user > div:not(.xs-avatar),
.xshell.xs-collapsed .xs-sidepanels{display:none;}
.xshell.xs-collapsed .xs-item{justify-content:center;padding:9px 0;}
.xshell.xs-collapsed .xs-user{justify-content:center;padding:7px 0;}
/* ---- sidebar panels: My Tasks + Calendar (Salman's ask, 6 Aug 2026) ---- */
.xs-sidepanels{padding:4px 10px 10px;border-top:1px solid var(--x-hairline);}
.xs-sp-head{
  display:flex;align-items:center;justify-content:space-between;cursor:pointer;
  font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--x-ink-3);
  padding:12px 4px 6px;font-weight:700;
}
.xs-sp-head .xs-sp-count{background:var(--x-wash-2);color:var(--x-brand-bright);border-radius:99px;padding:0 7px;font-size:9.5px;font-weight:800;letter-spacing:0;}
.xs-sp-task{display:flex;align-items:flex-start;gap:6px;padding:5px 4px;border-bottom:1px solid var(--x-hairline);}
.xs-sp-task:last-of-type{border-bottom:none;}
.xs-sp-task .t-code{font-size:8.5px;font-weight:800;color:var(--x-brand-bright);background:var(--x-wash);padding:1px 5px;border-radius:5px;flex:none;margin-top:1px;}
.xs-sp-task .t-title{font-size:11px;color:var(--x-ink);line-height:1.35;min-width:0;}
.xs-sp-task .t-due{display:block;font-size:9px;color:var(--x-ink-3);}
.xs-sp-task .t-due.overdue{color:var(--bad,#d9342b);font-weight:700;}
.xs-sp-task .t-done{margin-left:auto;flex:none;background:none;border:none;color:var(--ok,#0f9d58);font-size:12px;cursor:pointer;padding:0 2px;}
.xs-sp-add{display:flex;gap:5px;margin-top:6px;}
.xs-sp-add input{flex:1;min-width:0;padding:6px 9px;border:1px solid var(--x-hairline-strong);border-radius:8px;font-size:11px;font-family:inherit;background:var(--x-surface-2);color:var(--x-ink);outline:none;}
.xs-sp-add button{padding:6px 10px;border:none;border-radius:8px;background:var(--x-brand);color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;}
/* calendar */
.xs-cal-nav{display:flex;align-items:center;justify-content:space-between;padding:2px 4px 4px;font-size:11px;color:var(--x-ink);font-weight:600;}
.xs-cal-nav button{background:none;border:none;color:var(--x-ink-3);cursor:pointer;font-size:12px;padding:2px 6px;}
.xs-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;}
.xs-cal-dow{font-size:8px;color:var(--x-ink-3);text-align:center;padding:2px 0;text-transform:uppercase;}
.xs-cal-day{
  position:relative;aspect-ratio:1;display:grid;place-items:center;font-size:10px;
  color:var(--x-ink-2);border-radius:6px;cursor:pointer;border:none;background:none;font-family:inherit;
}
.xs-cal-day:hover{background:var(--x-wash);}
.xs-cal-day.today{font-weight:800;color:var(--x-brand-bright);}
.xs-cal-day.sel{background:var(--x-brand);color:#fff;}
.xs-cal-day .dots{position:absolute;bottom:2px;display:flex;gap:2px;}
.xs-cal-day .dot{width:4px;height:4px;border-radius:50%;}
.xs-cal-agenda{margin-top:5px;max-height:150px;overflow-y:auto;}
/* Session 4: the lists scroll inside the panel rather than pushing the
   sidebar's own footer (and the collapse button) off the bottom. */
.xs-sp-list{max-height:190px;overflow-y:auto;}
.xs-sp-list::-webkit-scrollbar,.xs-cal-agenda::-webkit-scrollbar{width:5px;}
.xs-sp-list::-webkit-scrollbar-thumb,.xs-cal-agenda::-webkit-scrollbar-thumb{background:var(--x-hairline-strong);border-radius:9px;}
.xs-sp-link{display:block;width:100%;text-align:left;background:none;border:none;cursor:pointer;
  font-size:10.5px;color:var(--x-brand-bright);font-weight:650;padding:6px 4px 2px;}
.xs-sp-link:hover{text-decoration:underline;}

/* ---- weekly planner overlay (Session 4) ---- */
/* --x-bg is not a token — the shell's page surface is --x-plane. This said
   var(--x-bg), so the overlay painted nothing and the dashboard underneath
   showed through it (fixed 8 Aug 2026 from Salman's screenshot). */
/* ---- week planner (redesigned 8 Aug 2026 from Salman's reference) ---- */
.xs-planner{position:fixed;inset:0;z-index:150;background:var(--x-plane);display:none;}
.xs-planner.open{display:block;}
.xs-pl-rail{background:var(--x-surface);border-right:1px solid var(--x-hairline);
  display:flex;flex-direction:column;padding:calc(14px + var(--safe-top,0px)) 12px 12px;overflow-y:auto;}
.xs-pl-brand{display:flex;align-items:center;gap:9px;margin-bottom:18px;}
.xs-pl-brand .mk{width:30px;height:30px;border-radius:9px;background:#fff;overflow:hidden;flex:none;
  display:grid;place-items:center;font-size:10px;font-weight:800;color:var(--x-brand);}
.xs-pl-brand .nm{font-size:12.5px;font-weight:700;color:var(--x-ink);line-height:1.2;}
.xs-pl-grouplabel{font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:var(--x-ink-3);margin:14px 4px 6px;}
.xs-pl-navitem{display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;border:0;border-radius:9px;
  background:transparent;color:var(--x-ink-2);font-size:12.5px;font-weight:550;cursor:pointer;text-align:left;font-family:inherit;}
.xs-pl-navitem:hover{background:var(--x-wash);}
.xs-pl-navitem.on{background:var(--x-brand);color:#fff;font-weight:650;}
.xs-pl-navitem .tag{margin-left:auto;min-width:19px;height:18px;padding:0 6px;border-radius:99px;
  background:var(--x-wash-2);color:var(--x-brand-bright);font-size:10px;font-weight:800;line-height:18px;text-align:center;}
.xs-pl-navitem.on .tag{background:rgba(255,255,255,.22);color:#fff;}
.xs-pl-chips{display:flex;flex-wrap:wrap;gap:5px;padding:0 2px;}
.xs-pl-chip{padding:5px 10px;border-radius:99px;border:1px solid var(--x-hairline);background:transparent;
  color:var(--x-ink-2);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;}
.xs-pl-chip.on{background:var(--x-brand);border-color:var(--x-brand);color:#fff;}
.xs-pl-user{margin-top:auto;padding-top:12px;border-top:1px solid var(--x-hairline);
  display:flex;align-items:center;gap:9px;}

/* The overlay is now a plain full-screen frame around the shared widgets. */
.xs-pl-frame{display:flex;flex-direction:column;height:100%;min-width:0;background:var(--x-plane);}
.xs-pl-body{flex:1;overflow:auto;padding:16px 18px 88px;}
.xs-pl-body > div{max-width:640px;margin:0 auto;}
@media (max-width:880px){ .xs-pl-body{padding:14px 14px 84px;} }

.xs-pl-main{display:flex;flex-direction:column;min-width:0;overflow:hidden;}
.xs-pl-top{display:flex;align-items:flex-start;gap:12px;flex:none;
  padding:calc(16px + var(--safe-top,0px)) 18px 12px;border-bottom:1px solid var(--x-hairline);}
.xs-pl-top h3{margin:0;font-size:17px;font-weight:650;color:var(--x-ink);letter-spacing:-.01em;}
.xs-pl-sub{font-size:11.5px;color:var(--x-ink-3);margin-top:3px;}
.xs-pl-nav{display:flex;align-items:center;gap:5px;margin-left:auto;flex:none;}
.xs-pl-nav button{background:var(--x-wash);border:1px solid var(--x-hairline);border-radius:8px;
  color:var(--x-ink-2);min-width:28px;height:28px;padding:0 10px;cursor:pointer;font-size:12px;font-family:inherit;}
.xs-pl-nav button:hover{border-color:var(--x-brand);color:var(--x-ink);}

.xs-pl-week{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));
  gap:10px;padding:14px 18px 22px;align-content:start;}
.xs-pl-col{min-width:0;display:flex;flex-direction:column;gap:8px;}
.xs-pl-colh{display:flex;align-items:baseline;gap:6px;padding:0 2px 2px;border-bottom:1px solid var(--x-hairline);}
.xs-pl-dow{font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--x-ink-3);}
.xs-pl-dnum{font-size:15px;font-weight:700;color:var(--x-ink);}
.xs-pl-today .xs-pl-dnum,.xs-pl-today .xs-pl-dow{color:var(--x-brand-bright);}
.xs-pl-todaytag{margin-left:auto;font-size:9px;font-weight:800;letter-spacing:.1em;color:var(--x-brand-bright);}

.xs-pl-card{border:1px solid var(--x-hairline);border-left:3px solid var(--x-hairline-strong);
  border-radius:10px;background:var(--x-surface);padding:8px 9px;cursor:default;}
.xs-pl-card.t-wine{border-left-color:var(--x-brand);background:var(--x-wash-2);}
.xs-pl-card.t-bad{border-left-color:var(--bad);background:var(--x-bad-bg,#fdeceb);}
.xs-pl-card.t-warn{border-left-color:var(--warn);background:var(--x-warn-bg,#fff6e3);}
.xs-pl-card .hd{display:flex;align-items:baseline;gap:6px;margin-bottom:3px;}
.xs-pl-card .tm{font-size:10px;font-weight:800;color:var(--x-ink-2);}
.xs-pl-card .tp{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--x-ink-3);}
.xs-pl-card.t-wine .tp{color:var(--x-brand-bright);}
.xs-pl-card.t-bad .tp{color:var(--bad);}
.xs-pl-card.t-warn .tp{color:var(--warn);}
.xs-pl-card .ttl{display:block;font-size:11.5px;font-weight:600;color:var(--x-ink);line-height:1.35;}
.xs-pl-card .mt{display:block;font-size:10px;color:var(--x-ink-3);margin-top:3px;line-height:1.35;}
.xs-pl-empty{font-size:10.5px;color:var(--x-ink-3);padding:6px 2px;}

.xs-pl-side{background:var(--x-surface);border-left:1px solid var(--x-hairline);
  display:flex;flex-direction:column;min-height:0;padding:calc(16px + var(--safe-top,0px)) 14px 14px;overflow-y:auto;}
.xs-pl-sideh{display:flex;align-items:baseline;gap:7px;}
.xs-pl-sideh h4{margin:0;font-size:13px;font-weight:650;color:var(--x-ink);}
.xs-pl-slot{border:1px solid var(--x-hairline);border-radius:10px;padding:9px 10px;margin-top:8px;background:var(--x-plane);}
.xs-pl-slot .t{display:block;font-size:11.5px;font-weight:600;color:var(--x-ink);line-height:1.35;}
.xs-pl-slot .m{display:block;font-size:10px;color:var(--x-ink-3);margin-top:2px;}
.xs-pl-cap{margin-top:auto;padding-top:14px;border-top:1px solid var(--x-hairline);}
.xs-pl-caprow{margin-top:9px;}
.xs-pl-caprow .l{display:flex;justify-content:space-between;font-size:10.5px;color:var(--x-ink-2);margin-bottom:4px;}
.xs-pl-captrack{display:block;width:100%;height:6px;border-radius:3px;background:var(--x-hairline);}
.xs-pl-captrack i{display:block;height:6px;border-radius:3px;background:var(--x-brand);}

/* Phone: the rails fold away and the week becomes a day-by-day scroll. */
@media(max-width:980px){
  /* Phone: the left rail folds away (its filters move into the header), but
     the "needs a slot" list must NOT — it is the whole point of the screen,
     and hiding it left a count in the subtitle with nothing behind it. The
     planner becomes one scroll with that list beneath the week. */
  .xs-planner.open{display:block;overflow-y:auto;}
  .xs-pl-rail{display:none;}
  .xs-pl-main{overflow:visible;}
  .xs-pl-week{grid-template-columns:1fr;gap:14px;padding:12px 12px 18px;overflow:visible;}
  .xs-pl-side{border-left:0;border-top:1px solid var(--x-hairline);
    padding:16px 14px calc(20px + env(safe-area-inset-bottom,0px));}
  .xs-pl-cap{margin-top:18px;}
  .xs-pl-mobfilters{display:flex;gap:5px;overflow-x:auto;padding:0 18px 10px;flex:none;scrollbar-width:none;}
}
@media(min-width:981px){ .xs-pl-mobfilters{display:none;} }
.xs-pl-add{width:100%;margin-top:7px;background:var(--x-wash);border:1px dashed var(--x-hairline-strong);
  border-radius:8px;color:var(--x-ink-3);font-size:11px;padding:6px;cursor:pointer;}
.xs-pl-add:hover{color:var(--x-brand-bright);border-color:var(--x-brand-bright);}
.xs-pl-form{margin-top:8px;display:grid;gap:6px;}
.xs-pl-form input,.xs-pl-form select,.xs-pl-form textarea{
  width:100%;background:var(--x-plane);border:1px solid var(--x-hairline-strong);border-radius:8px;
  padding:7px 9px;font-size:12px;color:var(--x-ink);font-family:inherit;}
.xs-pl-form .row{display:flex;gap:6px;}
.xs-pl-form .row > *{flex:1;min-width:0;}
.xs-pl-form .acts{display:flex;gap:6px;}
.xs-pl-form .acts button{flex:1;border-radius:8px;padding:7px;font-size:11.5px;cursor:pointer;border:1px solid var(--x-hairline-strong);}
.xs-pl-form .acts .save{background:var(--x-brand-bright);border-color:var(--x-brand-bright);color:#fff;font-weight:650;}
.xs-pl-form .acts .cancel{background:var(--x-wash);color:var(--x-ink-2);}
.xs-cal-ev{display:flex;gap:6px;align-items:flex-start;padding:4px;font-size:10.5px;color:var(--x-ink);line-height:1.35;}
.xs-cal-ev .dot{width:6px;height:6px;border-radius:50%;flex:none;margin-top:3px;}
.xs-cal-empty{font-size:10px;color:var(--x-ink-3);padding:4px;}
/* ---- floating chat (app-wide, one instance on document.body) ---- */
#exec-chat-float .xs-chat-fab{
  position:fixed;right:16px;bottom:calc(74px + var(--safe-bot,0px));z-index:299;
  width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;font-size:21px;
  background:linear-gradient(145deg,var(--x-brand-bright,#8a2151),var(--x-brand,#600131));
  color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.28);display:grid;place-items:center;
}
#exec-chat-float .xs-chat-fab .xs-badge{border-color:#fff;}
#exec-chat-float .xs-chat{
  position:fixed;top:auto;left:auto;right:16px;bottom:calc(134px + var(--safe-bot,0px));
  width:min(360px,calc(100vw - 32px));height:min(540px,70vh);z-index:300;
  border:1px solid var(--x-hairline-strong);border-radius:16px;overflow:hidden;
  box-shadow:0 24px 60px rgba(0,0,0,.35);
}
@media (max-width:880px){
  #exec-chat-float .xs-chat{right:8px;left:8px;width:auto;}
}
/* drawer close affordances — desktop hides both (the rail Collapse button
   owns it there); mobile shows the × and the tap-outside scrim */
.xs-side-close{display:none;}
.xs-side-scrim{display:none;}
/* ---- mobile: sidebar becomes a drawer ---- */
@media (max-width:880px){
  .xs-side-close{
    display:grid;place-items:center;margin-left:auto;width:32px;height:32px;flex:none;
    border-radius:50%;border:1px solid var(--x-hairline);background:var(--x-surface-2);
    color:var(--x-ink-2);font-size:18px;line-height:1;cursor:pointer;font-family:inherit;
  }
  .xs-side-scrim.open{display:block;position:absolute;inset:0;z-index:149;background:rgba(0,0,0,.35);}
  .xs-app{grid-template-columns:1fr;}
  .xs-side{
    position:absolute;top:0;left:0;bottom:0;width:min(260px,84vw);z-index:150;
    transform:translateX(-105%);transition:transform .2s ease-out;box-shadow:18px 0 50px rgba(0,0,0,.25);
  }
  .xs-side.open{transform:none;}
  .xs-burger{display:grid;}
  .xs-toprow .xs-qa{flex:1;justify-content:center;}
  .xs-collapse-btn{display:none;}
  /* Collapsing means "shrink to the 64px icon rail", which has no meaning in a
     drawer — the drawer is open or closed. Leaving the chevron here let a phone
     tap put the drawer into the rail state, which is what Salman hit. The old
     .xs-collapse-btn was already hidden; the chevron replaced it during the
     Owner redesign and was never covered. */
  .xs-collapse-chev{display:none;}
  .xshell.xs-collapsed .xs-app{grid-template-columns:1fr;}
  /* The drawer is ALWAYS a full drawer, never the 64px icon rail — so the
     collapsed state is neutralised wholesale here rather than undone rule by
     rule. Collapse is persisted per device, so a sidebar collapsed on desktop
     was arriving on the phone as a rail: centred rows with no left padding, no
     brand text and no user name. Undoing only the hidden labels (what this rule
     used to do) left the centring and the missing brand/user behind. */
  .xshell.xs-collapsed .xs-brand > div:not(.xs-brand-mark),
  .xshell.xs-collapsed .xs-navlabel,
  .xshell.xs-collapsed .xs-item .xs-lbl,
  .xshell.xs-collapsed .xs-item .xs-tag,
  .xshell.xs-collapsed .xs-user > div:not(.xs-avatar),
  .xshell.xs-collapsed .xs-sidepanels{display:initial;}
  .xshell.xs-collapsed .xs-brand{justify-content:flex-start;padding-left:14px;padding-right:14px;}
  .xshell.xs-collapsed .xs-item{justify-content:flex-start;padding:9px 10px;}
  .xshell.xs-collapsed .xs-user{justify-content:flex-start;padding:7px;}
}
`;
document.head.appendChild(execStyleTag);

function execEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

// ── theme (persisted per device) ──────────────────────────────────────
function execThemeGet() { try { return localStorage.getItem('amd-exec-theme') || 'light'; } catch (e) { return 'light'; } }
function execThemeApply() {
  const dark = execThemeGet() === 'dark';
  document.querySelectorAll('.xshell').forEach(el => el.classList.toggle('x-dark', dark));
  // hosts call this once on open — piggyback the persisted collapse state
  // so open*Module() needs exactly one chrome call, same as the pilot.
  if (typeof execCollapseApply === 'function') execCollapseApply();
}
function execThemeToggle() {
  try { localStorage.setItem('amd-exec-theme', execThemeGet() === 'dark' ? 'light' : 'dark'); } catch (e) {}
  execThemeApply();
  // re-render whichever dashboard is open so charts pick the new tokens up
  execHostRerender();
}

// ── host-module context (rollout, 6 Aug 2026) ────────────────────────
// Every shelled module registers itself on open: which module it is (drives
// the Calendar's role filter) and which function re-renders its body (drives
// theme toggle + task/calendar refreshes). Replaces the pilot's hardcoded
// renderOwnerBody/renderAdminBody calls.
let execModuleKey = null;
let execRerenderFnName = null;
// Runs `fn` against whichever adopted shell is actually on screen. Adopted
// shells are never torn down, so ids repeat across them (Session 5).
function execVisibleShell(fn) {
  const shells = [...document.querySelectorAll('.xshell')]
    .filter(el => el.id && el.id !== 'exec-chat-float' && el.offsetParent !== null);
  for (const s of shells) { const r = fn(s); if (r) return r; }
  return null;
}
function execSetContext(moduleKey, rerenderFnName) {
  execModuleKey = moduleKey;
  execRerenderFnName = rerenderFnName;
}
function execHostRerender() {
  if (execRerenderFnName && typeof window[execRerenderFnName] === 'function') window[execRerenderFnName]();
  else { // pilot-era fallback
    if (typeof renderOwnerBody === 'function') renderOwnerBody();
    if (typeof renderAdminBody === 'function') renderAdminBody();
  }
}

// ── collapsible sidebar (persisted per device) ───────────────────────
function execCollapsedGet() { try { return localStorage.getItem('amd-exec-side-collapsed') === '1'; } catch (e) { return false; } }
function execCollapseApply() {
  const c = execCollapsedGet();
  document.querySelectorAll('.xshell').forEach(el => { if (el.id !== 'exec-chat-float') el.classList.toggle('xs-collapsed', c); });
  document.querySelectorAll('.xs-collapse-btn').forEach(b => { b.innerHTML = c ? '»' : '« Collapse'; b.title = c ? 'Expand sidebar' : 'Collapse sidebar'; });
}
function execToggleCollapse() {
  try { localStorage.setItem('amd-exec-side-collapsed', execCollapsedGet() ? '0' : '1'); } catch (e) {}
  execCollapseApply();
}

function execIdentity() { return window.cloudIdentity || 'Salman Abdullah'; }

// ── reminders: real signals only ─────────────────────────────────────
function getExecReminders() {
  const R = [];
  // 7 Aug 2026 (Salman): reminders were dead text — each one now carries a
  // route to the screen where the work actually happens.
  const push = (sev, title, meta, code, go) => R.push({ sev, title, meta, code, go });
  try {
    if (typeof approvalQueueRows !== 'undefined' && approvalQueueRows.length) {
      push('critical', `${approvalQueueRows.length} sign-up${approvalQueueRows.length === 1 ? '' : 's'} awaiting approval`, 'Tap to review', null, 'execGoSignups()');
    }
    if (typeof getPendingBudgetApprovalsFor === 'function') {
      const b = getPendingBudgetApprovalsFor('owner');
      if (b.length) push('serious', `${b.length} department budget${b.length === 1 ? '' : 's'} awaiting your approval`, b.slice(0, 2).map(r => `${r.job.id} · ${dc(r.deptKey).n}`).join(' · '), b[0].job.id, "execGoOps('budgetapprovals')");
    }
    if (typeof getJobsPendingRouting === 'function') {
      const r = getJobsPendingRouting();
      if (r.length) push('warning', `${r.length} confirmed job${r.length === 1 ? '' : 's'} awaiting routing`, 'Operations → New Jobs', r[0].id, "execGoOps('alerts')");
    }
    if (typeof jobCards !== 'undefined') {
      jobCards.filter(j => j.status === 'open' && j.urgent).forEach(j =>
        push('critical', `URGENT: ${j.projectName}`, `${j.id}${j.promisedDate ? ' · promised ' + j.promisedDate : ''}`, j.id, `execGoJob('${j.id}')`));
      jobCards.filter(j => j.status === 'open' && !j.urgent && j.promisedDate && j.promisedDate < todayStrGlobal() && !jobProductionComplete(j)).forEach(j =>
        push('serious', `Promised date overdue: ${j.projectName}`, `${j.id} · promised ${j.promisedDate}`, j.id, `execGoJob('${j.id}')`));
    }
    if (typeof getReorderAlerts === 'function') {
      const ro = getReorderAlerts();
      if (ro.length) push('warning', `${ro.length} stock item${ro.length === 1 ? '' : 's'} at/below reorder level`, ro.slice(0, 2).map(r => r.itemName).join(' · '), null, 'execGoStock()');
    }
    if (typeof getOpenTasksForAssignee === 'function') {
      getOpenTasksForAssignee(execIdentity()).forEach(t =>
        push(t.dueDate && t.dueDate < todayStrGlobal() ? 'serious' : 'info', t.title, `${t.dueDate ? 'due ' + t.dueDate : 'no due date'}${t.linkedId ? ' · ' + t.linkedId : ''}`, t.id, t.linkedType === 'job' && t.linkedId ? `execGoJob('${t.linkedId}')` : null));
    }
    if (typeof getUnreadCountFor === 'function') {
      const u = getUnreadCountFor(execIdentity());
      if (u) push('info', `${u} unread message${u === 1 ? '' : 's'}`, 'Tap to open chat', null, 'execToggleChat(true)');
    }
  } catch (e) { /* a broken signal must never blank the whole panel */ }
  const order = { critical: 0, serious: 1, warning: 2, info: 3 };
  return R.sort((a, b) => order[a.sev] - order[b.sev]);
}
const EXEC_SEV_COLOR = { critical: 'var(--bad,#d9342b)', serious: '#e8703a', warning: 'var(--warn,#c47d00)', info: 'var(--x-brand-bright)' };

let execRemOpenFlag = false;
let execAutoAlerted = false; // auto-open once per page load when something needs attention
// Quick actions popover (desktop) / bottom sheet (mobile). Same items the
// sidebar group used to carry, minus any this role can't use.
let execQuickOpen = false;
// Per-module quick actions come FIRST — a role's own four verbs are what the
// button is for; the shared planner/request items follow. Estimator's set is
// the design package's own (6a, 8 Aug 2026).
const EXEC_QUICK_BY_MODULE = {
  sales: [
    { ico: '✓', label: 'Confirm quote', on: "qhQuickConfirm()" },
    { ico: '☎', label: 'Log a client call', on: "qhQuickFollowUp()" },
    { ico: '🖨', label: 'Print / send PDF', on: "qhQuickPrint()" },
    { ico: '⧉', label: 'Raise revision', on: "qhQuickRevision()" },
    { ico: '+', label: 'New enquiry', on: "salesSetTopView('enquiries');salesView='enq-form';renderSalesBody()" }
  ],
  jobs: [
    { ico: '🖨', label: 'Print job order', on: "jobsQuickPrint()" },
    { ico: '➕', label: 'New variation', on: "jobsQuickVariation()" },
    { ico: '🛒', label: 'Raise purchase request', on: "jobsQuickPurchase()" },
    { ico: '✓', label: 'Add a task to this job', on: "jobsQuickTask()" },
    { ico: '💬', label: 'Message operations', on: "openComposeMessage(execIdentity(), 'Operations Manager', null, null)" }
  ],
  estimator: [
    { ico: '⌸', label: 'Cost a quotation', on: "EstimatorUI.setView('queue')" },
    { ico: '◈', label: 'Quick tender estimate', on: "EstimatorUI.setQueueFilter('tenders')" },
    { ico: '▤', label: 'Rate library', on: "EstimatorUI.setView('rates')" },
    { ico: '𝄜', label: 'Estimated vs actual', on: "EstimatorUI.setView('actuals')" }
  ]
};
function execQuickItems() {
  const own = (EXEC_QUICK_BY_MODULE[execModuleKey] || []).slice();
  const items = own.concat([
    { ico: '🗓', label: 'Weekly planner', on: 'execOpenPlanner()' },
    { ico: '✓', label: 'My tasks', on: 'execOpenPlanner()' },
    { ico: '📅', label: 'Calendar', on: 'execOpenPlanner()' },
    { ico: '🏬', label: 'Request Material', on: 'execOpenMaterialRequest()' },
    { ico: '🛒', label: 'Request Purchase', on: 'execRequestPurchase()' }
  ]);
  return items.filter(i => i.label !== 'Request Material' || EXEC_CAN_REQUEST_MATERIAL.includes(execModuleKey));
}
function execToggleQuick(force) {
  execQuickOpen = force !== undefined ? force : !execQuickOpen;
  document.querySelectorAll('.xs-qa-pop').forEach(p => {
    p.classList.toggle('open', execQuickOpen);
    if (execQuickOpen) {
      p.innerHTML = execQuickItems().map(i =>
        `<button class="xs-qa-item" onclick="execToggleQuick(false);${i.on}"><span class="ico">${i.ico}</span>${execEsc(i.label)}</button>`).join('');
    }
  });
  document.querySelectorAll('.xs-qa-scrim').forEach(el => el.classList.toggle('open', execQuickOpen));
}
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
        <div class="xs-rem${r.go ? ' xs-rem-go' : ''}"${r.go ? ` onclick="execToggleReminders(false);${r.go}"` : ''}>
          <span class="xs-rem-dot" style="background:${EXEC_SEV_COLOR[r.sev]}"></span>
          <div style="min-width:0;flex:1;">
            <p class="xs-rem-title">${execEsc(r.title)}${r.code ? `<span class="xs-rem-code">${execEsc(r.code)}</span>` : ''}</p>
            <p class="xs-rem-meta">${execEsc(r.meta)}</p>
          </div>
          ${r.go ? '<span style="color:var(--x-ink-3);font-size:15px;align-self:center;flex:none;">›</span>' : ''}
        </div>`).join('');
  });
}
// ── reminder routes ──────────────────────────────────────────────────
// Each opens the module that owns the work, then its own view function —
// same module-hop pattern as ownerGoTo/salesRequestPurchase (never
// close*Module(), which would prompt a sign-out).
// Records where we are now, so a hop can be undone. Used by every
// reminder route and available to any module-hop helper.
function execPushCurrent() {
  const cfg = EXEC_MODULE_NAV[execModuleKey];
  if (!cfg) return;
  const opener = { sales: 'openSalesModule', estimator: 'openEstimatorModule', approver: 'openApproverModule',
    jobs: 'openJobsModule', accounts: 'openAccountsModule', hr: 'openHRModule', joinery: 'openJoineryModule',
    upholstery: 'openUpholsteryModule', painting: 'openPaintingModule', fleet: 'openFleetModule',
    delivery: 'openDeliverySchedModule', storekeeper: 'openStorekeeperModule', purchasing: 'openPurchasingModule',
    curtain: 'openCurtainModule', operations: 'openOperationsModule', owner: 'openOwnerModule', admin: 'openAdminModule' }[execModuleKey];
  if (!opener) return;
  execPushNav(cfg.label, opener + '()');
}

function execGoSignups() {
  if (typeof launchAdminModule === 'function' && window.cloudUserType === 'admin') { launchAdminModule(); if (typeof adminSetView === 'function') adminSetView('approvals'); return; }
  if (typeof launchOwnerModule === 'function') { launchOwnerModule(); if (typeof ownerNav === 'function') ownerNav('approvals'); return; }
  if (typeof launchHRModule === 'function') { launchHRModule(); if (typeof hrSetView === 'function') hrSetView('approvals'); }
}
function execGoOps(page) {
  execPushCurrent();
  if (typeof openOperationsModule === 'function') { openOperationsModule(); if (typeof opsGoTo === 'function' && page) opsGoTo(page); }
}
function execGoJob(jobId) {
  execPushCurrent();
  if (typeof openJobsModule === 'function') openJobsModule(jobId);   // jumps straight to that job's hub
  if (typeof execSetCrumb === 'function') execSetCrumb(jobId);
}
function execGoStock() {
  execPushCurrent();
  if (typeof openStorekeeperModule === 'function') { openStorekeeperModule(); if (typeof skGoTo === 'function') skGoTo('dashboard'); }
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
// Mobile drawer. `force` true/false opens/closes explicitly; omitted toggles.
// The scrim moves with it so there's always a tap-outside way back — the
// drawer previously had NO exit at all on a phone (the Collapse button is
// desktop-only), which is exactly what Salman hit: "the task bar once
// opened doesn't collapse back".
function execToggleSide(force) {
  const open = force !== undefined ? force
    : !document.querySelector('.xshell .xs-side.open');
  document.querySelectorAll('.xshell .xs-side').forEach(s => s.classList.toggle('open', open));
  document.querySelectorAll('.xs-side-scrim').forEach(s => s.classList.toggle('open', open));
}
// Every sidebar item calls this after doing its work (appended centrally in
// execNavHTML) — on a phone, picking a destination should close the drawer
// so you land on the content you just chose.
function execCloseSideOnMobile() {
  if (window.innerWidth <= 880) execToggleSide(false);
}

// ══════════════════════════════════════════
// SIDEBAR PANELS — My Tasks + Calendar (rollout, 6 Aug 2026)
// Salman circled the sidebar's empty lower half: tasks and a calendar live
// here now, shared by every shelled module. Tasks = the real tasks[]
// primitive (extracted from owner.js's pilot-era private card). Calendar =
// a compact month grid + day agenda over getCalendarEvents() (data.js):
// my due-dated tasks + role-relevant job promised dates + planned
// deliveries — his AskUserQuestion picks.
// ══════════════════════════════════════════
let execTasksOpen = true;
let execCalOpen = true;
let execCalMonth = null;    // 'YYYY-MM', null = current month
let execCalSelected = null; // 'YYYY-MM-DD', null = today

const EXEC_CAL_COLOR = { task: 'var(--x-brand-bright)', promised: 'var(--warn,#c47d00)', delivery: 'var(--info,#2563eb)', event: 'var(--ok,#0f9d58)' };

// Salman, 8 Aug 2026: "my tasks on taskbar serves no useful purpose now".
// He is right — the dashboards carry a full task card and the planner shows
// tasks on their due day, so the sidebar copy was a third, clipped view of
// the same list. Kept as an empty hook so every caller stays valid.
function execSidePanelsHTML() { return ''; }

function execRefreshSidePanels() {
  document.querySelectorAll('.xs-sidepanels').forEach(el => { el.innerHTML = execSidePanelsHTML(); });
}

function execTasksPanelHTML() {
  const tasks = typeof getOpenTasksForAssignee === 'function' ? getOpenTasksForAssignee(execIdentity()) : [];
  const today = new Date().toISOString().slice(0, 10);
  const rows = tasks.map(t => `
    <div class="xs-sp-task">
      <span class="t-code">${execEsc(t.id)}</span>
      <span class="t-title">${execEsc(t.title)}
        <span class="t-due ${t.dueDate && t.dueDate < today ? 'overdue' : ''}">${t.dueDate ? (t.dueDate < today ? 'overdue ' : 'due ') + t.dueDate : 'no due date'}</span>
      </span>
      <button class="t-done" title="Mark done" onclick="execCompleteTask('${execEsc(t.id)}')">✓</button>
    </div>`).join('');
  return `
    <div class="xs-sp-head" onclick="execTasksOpen=!execTasksOpen;execRefreshSidePanels();">
      <span>My Tasks</span><span class="xs-sp-count">${tasks.length}</span>
    </div>
    ${execTasksOpen ? `
      ${rows ? `<div class="xs-sp-list">${rows}</div>` : '<p class="xs-cal-empty">No open tasks.</p>'}
      <div class="xs-sp-add">
        <input class="xs-task-input" type="text" placeholder="Add a task…" onkeydown="if(event.key==='Enter')execAddTask();">
        <button onclick="execAddTask()">Add</button>
      </div>` : ''}`;
}
function execAddTask() {
  // the panel exists once per ADOPTED wrap — take whichever instance has
  // input (duplicate-id lesson from the rollout suite's first run)
  const inputs = [...document.querySelectorAll('input.xs-task-input')];
  const input = inputs.find(i => i.value.trim()) || inputs.find(i => i.offsetParent);
  if (!input || !input.value.trim()) return;
  const res = createTask({ title: input.value.trim(), assignee: execIdentity() });
  if (res && res.error) { if (typeof commsToast === 'function') commsToast(res.error); return; }
  execRefreshSidePanels();
  execRefreshBadges();
}
function execCompleteTask(id) {
  completeTask(id);
  execRefreshSidePanels();
  execRefreshBadges();
}

function execCalendarPanelHTML() {
  const today = new Date().toISOString().slice(0, 10);
  const monthKey = execCalMonth || today.slice(0, 7);
  const sel = execCalSelected || today;
  const [y, m] = monthKey.split('-').map(Number);
  const events = typeof getCalendarEvents === 'function' ? getCalendarEvents(execIdentity(), execModuleKey) : [];
  const byDate = {};
  events.forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e); });
  const first = new Date(y, m - 1, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(y, m, 0).getDate();
  let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span class="xs-cal-dow">${d}</span>`).join('');
  for (let i = 0; i < startDow; i++) cells += '<span></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = monthKey + '-' + String(d).padStart(2, '0');
    const evs = byDate[ds] || [];
    const types = [...new Set(evs.map(e => e.type))].slice(0, 3);
    cells += `<button class="xs-cal-day ${ds === today ? 'today' : ''} ${ds === sel ? 'sel' : ''}" onclick="execCalSelected='${ds}';execRefreshSidePanels();">${d}
      ${types.length ? `<span class="dots">${types.map(t => `<span class="dot" style="background:${EXEC_CAL_COLOR[t]}"></span>`).join('')}</span>` : ''}
    </button>`;
  }
  const dayEvents = byDate[sel] || [];
  const monthLabel = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return `
    <div class="xs-sp-head" onclick="execCalOpen=!execCalOpen;execRefreshSidePanels();">
      <span>Calendar</span><span class="xs-sp-count">${events.length}</span>
    </div>
    ${execCalOpen ? `
      <div class="xs-cal-nav">
        <button onclick="event.stopPropagation();execCalNav(-1);">‹</button>
        <span>${monthLabel}</span>
        <button onclick="event.stopPropagation();execCalNav(1);">›</button>
      </div>
      <div class="xs-cal-grid">${cells}</div>
      <button class="xs-sp-link" onclick="event.stopPropagation();execOpenPlanner(execCalSelected||undefined);">Open weekly planner →</button>
      <div class="xs-cal-agenda">
        ${dayEvents.length === 0 ? `<p class="xs-cal-empty">Nothing on ${sel === today ? 'today' : sel}.</p>` :
          dayEvents.map(e => `
            <div class="xs-cal-ev"><span class="dot" style="background:${EXEC_CAL_COLOR[e.type]}"></span>
              <span>${execEsc(e.label)}${e.ref ? ` <span style="color:var(--x-ink-3);font-size:9px;">${execEsc(e.ref)}</span>` : ''}
              ${e.type === 'task' ? `<button class="t-done" style="font-size:11px;" title="Mark done" onclick="execCompleteTask('${execEsc(e.ref)}')">✓</button>` : ''}</span>
            </div>`).join('')}
      </div>` : ''}`;
}
// ══════════════════════════════════════════
// WEEKLY PLANNER (backlog Session 4, 7 Aug 2026)
// Salman asked for a way to log a meeting or a day's note against a date,
// and a week view to plan against. Mounted at document.body level like the
// floating chat so it opens from any module and from the home page —
// no per-module view plumbing, nothing to add to 17 nav configs.
// It shows the same getCalendarEvents() feed the sidebar calendar uses
// (my tasks, role-relevant promised dates, planned deliveries) plus the
// new events[] entries, so the two can never disagree.
// ══════════════════════════════════════════
// The shared widget (planner-tasks.js) owns period, selection and composing;
// the overlay is just a full-screen frame around it now.

function execTodayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function execOpenPlanner(dateStr) {
  if (dateStr && typeof plannerState !== 'undefined') plannerState.selDate = dateStr;
  execRenderPlanner();
  const el = document.getElementById('exec-planner');
  if (el) el.classList.add('open');
  if (typeof execCloseSideOnMobile === 'function') execCloseSideOnMobile();
}
function execClosePlanner() {
  const el = document.getElementById('exec-planner');
  if (el) el.classList.remove('open');
  // the sidebar calendar/tasks may have changed while the planner was open
  if (typeof execRefreshSidePanels === 'function') execRefreshSidePanels();
  if (typeof execRefreshBadges === 'function') execRefreshBadges();
}


function execRenderPlanner() {
  const host = document.getElementById('exec-planner');
  if (!host) return;
  // One implementation. renderWeekPlanner()/renderMyTasks() (planner-tasks.js)
  // are the same widgets every dashboard mounts — the package is explicit that
  // "the same renderWeekPlanner() output works there without changes".
  if (typeof renderPlannerAndTasks !== 'function') { host.innerHTML = ''; return; }
  host.innerHTML =
    '<div class="xs-pl-frame">' +
      '<header class="xs-pl-top">' +
        '<div style="min-width:0"><h3>Week planner</h3>' +
          '<div class="xs-pl-sub">' + execEsc(execIdentity()) + '</div></div>' +
        '<div class="xs-pl-nav">' +
          '<button onclick="execThemeToggle()" title="Light / dark mode">◐</button>' +
          '<button onclick="execClosePlanner()" aria-label="Close">✕</button>' +
        '</div>' +
      '</header>' +
      '<div class="xs-pl-body od">' + renderPlannerAndTasks() + '</div>' +
    '</div>';
}



const execPlannerEl = document.createElement('div');
execPlannerEl.id = 'exec-planner';
execPlannerEl.className = 'xshell xs-planner';   // opts into --x-* tokens + dark mode
document.body.appendChild(execPlannerEl);

function execCalNav(delta) {
  const today = new Date().toISOString().slice(0, 10);
  const [y, m] = (execCalMonth || today.slice(0, 7)).split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  execCalMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  execRefreshSidePanels();
}

// ══════════════════════════════════════════
// FLOATING CHAT — one document.body-level instance (Salman's ask):
// available in EVERY module and on the home page, not only inside shells.
// The launcher bubble carries the unread badge; the panel reuses the same
// .xs-chat classes/functions the pilot's slide-over used. Shown once the
// app itself is visible (hidden on the lock/login screen).
// ══════════════════════════════════════════
const execChatFloat = document.createElement('div');
execChatFloat.id = 'exec-chat-float';
execChatFloat.className = 'xshell';               // opts into --x-* tokens + dark mode
execChatFloat.style.cssText = 'display:none;background:none;';
execChatFloat.innerHTML = `
  <button class="xs-chat-fab" onclick="execToggleChat()" title="Messages" aria-label="Messages">💬<span class="xs-badge xs-chat-badge" style="display:none;">0</span></button>
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
  </div>`;
document.body.appendChild(execChatFloat);
// Reveal once the app is unlocked (login screen has #app hidden); polling is
// the least invasive hook — auth.js needs no changes.
setInterval(() => {
  const app = document.getElementById('app');
  const inApp = app && getComputedStyle(app).display !== 'none';
  execChatFloat.style.display = inApp ? 'block' : 'none';
  if (inApp) execThemeApply();
}, 1500);

// ── shell builder ────────────────────────────────────────────────────
// navGroups: [{label, items:[{id, ico, label, tag, onclick}]}]
// Returns the full shell markup; the host module drops it into its wrap
// and renders its own views into #<contentId>.
// Session 4: every module's sidebar gets the same Planner quick action, so
// the tasks/calendar work is reachable without hunting for the panel —
// appended here rather than copied into all 17 nav configs.
function execWithSharedNav(groups) {
  // Session 5: Salman asked for quick actions at the top rather than buried
  // under each dashboard's own content, and for messaging to have ONE entry
  // point. The per-dashboard "Notify Storekeeper / Request Purchase" strips
  // and Messages cards are gone; these two live here, and the floating chat
  // bubble owns messaging everywhere.
  // Owner-redesign handoff: "Quick Actions removed from the sidebar and
  // promoted to a wine button at the top-left of the content area". The
  // sidebar is navigation + My tasks + user chip only; execQuickItems()
  // owns the shortcut list now.
  return (groups || []);
}
// The department a module's purchase request should default to, so a
// Joinery manager raising one doesn't have to re-pick their own department.
const EXEC_MODULE_DEPT = { joinery: 'carp', upholstery: 'uph', painting: 'paint', curtain: 'curt' };
// Who can ask the storekeeper for material: the production modules and the
// oversight ones that work a job. Everyone else just uses the chat.
const EXEC_CAN_REQUEST_MATERIAL = ['joinery', 'upholstery', 'painting', 'curtain', 'operations', 'jobs', 'owner', 'admin'];
function execOpenMaterialRequest() {
  if (typeof openMaterialRequestForm === 'function') {
    openMaterialRequestForm(execIdentity(), EXEC_MODULE_DEPT[execModuleKey] || null);
  }
}
function execRequestPurchase() {
  if (typeof requestPurchaseFromModule === 'function') requestPurchaseFromModule(null, EXEC_MODULE_DEPT[execModuleKey] || null, null);
}
// Opens the sidebar (drawer on mobile, un-collapses on desktop), makes sure
// the panel is expanded, and scrolls it into view.
// The sidebar panels are gone (8 Aug 2026); anything still asking to focus
// one is really asking for the planner, which owns tasks and the calendar now.
function execFocusPanel() {
  if (typeof execOpenPlanner === 'function') execOpenPlanner();
}

// Rebuild the visible shell's sidebar without re-adopting it. Needed by any
// module whose nav groups depend on what is on screen — the Jobs record page
// and the Manage Quote record page both grow a "This …" group only while a
// record is open, and the sidebar is otherwise only built at adopt time.
function execRefreshNavGroups() {
  const fn = EXEC_NAV_CONFIGS[execModuleKey];
  if (typeof fn !== 'function') return;
  // Not execVisibleShell(): it filters on offsetParent, which is null for a
  // position:fixed element — and every module wrap is one. Pick the shell that
  // is actually displayed instead.
  const shell = [...document.querySelectorAll('.xshell')].filter(el =>
    el.id && el.id !== 'exec-chat-float' && getComputedStyle(el).display !== 'none').pop();
  const nav = shell && shell.querySelector('.xs-nav');
  if (nav) nav.innerHTML = execNavHTML(execWithSharedNav(fn()));
  execRefreshBadges();
}

function execNavHTML(navGroups) {
  return navGroups.map(g => `
    <div class="xs-navlabel">${execEsc(g.label)}</div>
    ${g.items.map(it => `
      <button class="xs-item" id="xsnav-${execEsc(it.id)}" title="${execEsc(it.label)}" onclick="${it.onclick};execCloseSideOnMobile()">
        <span class="xs-ico">${it.ico}</span><span class="xs-lbl">${execEsc(it.label)}</span>
        ${it.tag ? `<span class="xs-tag">${execEsc(String(it.tag))}</span>` : ''}
      </button>`).join('')}
  `).join('');
}
function execShellHTML({ title, sub, role, navGroups, contentId, closeFn }) {
  const navHtml = execNavHTML(execWithSharedNav(navGroups));
  const me = execIdentity();
  const initials = me.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `
  <div class="xs-app">
    <div class="xs-side-scrim" onclick="execToggleSide(false)"></div>
    <aside class="xs-side">
      <div class="xs-brand">
        <div class="xs-brand-mark" style="background:#fff;overflow:hidden;"><img src="logo.jpeg" alt="AM" style="width:100%;height:100%;object-fit:contain;" onerror="this.parentElement.textContent='AM';this.parentElement.style.background=''"></div>
        <div>
          <div class="xs-brand-name">AL MARAYA</div>
          <div class="xs-brand-sub">Decor</div>
        </div>
        <button class="xs-collapse-chev" onclick="execToggleCollapse()" aria-label="Collapse menu" title="Collapse menu">«</button>
        <button class="xs-side-close" onclick="execToggleSide(false)" aria-label="Close menu">×</button>
      </div>
      <nav class="xs-nav">${navHtml}</nav>
      <div class="xs-sidepanels">${execSidePanelsHTML()}</div>
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
        <!-- Row 1: every control. Back sits immediately left of Quick actions
             (PATCH 08 Aug 2026 §3) and hides itself on a dashboard root, where
             there is nothing to go back to (execRenderNav). -->
        <div class="xs-toprow">
          <button class="xs-iconbtn xs-burger" onclick="execToggleSide()" aria-label="Menu">☰</button>
          <button class="xs-back" onclick="execBack()" title="Back" aria-label="Back">‹</button>
          <button class="xs-qa" onclick="execToggleQuick()" aria-haspopup="true">＋ Quick actions</button>
          <span class="xs-spacer"></span>
          <button class="xs-iconbtn" onclick="execThemeToggle()" title="Light / dark mode" aria-label="Toggle theme">◐</button>
          <!-- Session 5: the header's chat icon is gone. Salman asked for ONE
               messaging entry point and named the floating bubble as the one to
               keep; a header icon opening the same panel was the third of three. -->
          <button class="xs-iconbtn" onclick="execToggleReminders()" title="Reminders" aria-label="Reminders">
            <span class="xs-pulse"></span>🔔<span class="xs-badge xs-rem-badge" style="display:none;">0</span>
          </button>
          <button class="xs-iconbtn" onclick="${closeFn}()" title="Close" aria-label="Close">×</button>
        </div>
        <!-- Row 2: the page title, on its own line under the controls. -->
        <div>
          <div class="xs-title">${execEsc(title)}</div>
          <div class="xs-sub">${execEsc(sub || today)}</div>
        </div>
      </header>
      <div class="xs-qa-scrim" onclick="execToggleQuick(false)"></div>
      <div class="xs-qa-pop"></div>
      <div class="xs-scrim" onclick="execToggleReminders(false)"></div>
      <div class="xs-panel">
        <div class="xs-panel-head"><h3>Reminders</h3>
          <button style="background:none;border:none;font-size:11px;color:var(--x-brand-bright);font-weight:600;cursor:pointer;font-family:inherit;" onclick="execToggleReminders(false)">Close</button>
        </div>
        <div class="xs-panel-body"></div>
      </div>
      <div class="xs-crumbs"></div>
      <main class="xs-content"><div id="${contentId}"></div></main>
    </div>
  </div>`;
}

// ══════════════════════════════════════════
// NAVIGATION (Session 2, 7 Aug 2026)
// Two layers, deliberately kept separate:
//  • WITHIN a module — every module already tracks its own view variable
//    (salesView/jobsView/...). EXEC_MODULE_NAV below says what each
//    module's "home" view is and how to get back to it, so the header's
//    back control works on any drill-down without touching module code.
//  • ACROSS modules — cross-module hops (a Sales KPI opening a Job Card,
//    a reminder opening Operations) push a return ticket onto execNavStack
//    so the user can come back to exactly where they were. This is the
//    fix for "the sidebar changed context and I couldn't get back".
// The breadcrumb renders both layers: Module › View › Record.
// ══════════════════════════════════════════
const EXEC_MODULE_NAV = {
  sales:       { label: 'Sales',        home: () => salesTopView === 'dashboard' && salesView === 'dashboard', goHome: "salesSetTopView('dashboard')" },
  estimator:   { label: 'Estimation',   home: () => estimatorView === 'dashboard', goHome: "estimatorView='dashboard';renderEstimatorBody()" },
  approver:    { label: 'Approvals',    home: () => approverView === 'dashboard', goHome: "approverView='dashboard';renderApproverBody()" },
  jobs:        { label: 'Job Cards',    home: () => jobsView === 'list', goHome: "jobsView='list';renderJobsBody()" },
  accounts:    { label: 'Accounts',     home: () => accountsView === 'dashboard', goHome: "accountsSetView('dashboard')" },
  hr:          { label: 'HR & Payroll', home: () => hrView === 'dashboard', goHome: "hrSetView('dashboard')" },
  joinery:     { label: 'Joinery',      home: () => joineryView === 'dashboard', goHome: "joinerySetView('dashboard')" },
  upholstery:  { label: 'Upholstery',   home: () => upholsteryView === 'dashboard', goHome: "upholsterySetView('dashboard')" },
  painting:    { label: 'Painting',     home: () => paintingView === 'dashboard', goHome: "paintingSetView('dashboard')" },
  fleet:       { label: 'Vehicle Fleet', home: () => fleetView === 'list', goHome: "fleetView='list';renderFleetBody()" },
  delivery:    { label: 'Delivery',     home: () => deliverySchedView === 'list', goHome: "deliverySchedView='list';renderDeliverySchedBody()" },
  storekeeper: { label: 'Storekeeper',  home: () => true, goHome: "skGoTo('dashboard')" },
  purchasing:  { label: 'Purchaser',    home: () => true, goHome: "purchGoTo('purch-dashboard')" },
  curtain:     { label: 'Curtain & Blinds', home: () => true, goHome: "curtGoTo('curt-dashboard')" },
  operations:  { label: 'Operations',   home: () => true, goHome: "opsGoTo('dashboard')" },
  owner:       { label: 'Owner',        home: () => true, goHome: "ownerNav('dashboard')" },
  admin:       { label: 'Admin',        home: () => true, goHome: "adminSetView('approvals')" }
};

const execNavStack = [];            // [{ label, restore }] — cross-module return tickets
let execCrumbNow = null;            // record-level crumb the module sets (e.g. a Job No)

// Called by any cross-module hop BEFORE it navigates away.
function execPushNav(label, restore) {
  if (!label || !restore) return;
  if (execNavStack.length > 8) execNavStack.shift();
  execNavStack.push({ label, restore });
}
// Modules call this when they open a specific record, so the trail can show
// it (e.g. execSetCrumb('JB26AMD01105')). Cleared automatically on the way
// back to a module's home view.
function execSetCrumb(text) { execCrumbNow = text || null; execRenderNav(); }

function execInModuleDrilldown() {
  const cfg = EXEC_MODULE_NAV[execModuleKey];
  if (!cfg) return false;
  try { return !cfg.home(); } catch (e) { return false; }
}
function execBack() {
  // Prefer stepping back inside the module (a drill-down), then fall back
  // to the cross-module return ticket.
  if (execInModuleDrilldown()) {
    const cfg = EXEC_MODULE_NAV[execModuleKey];
    execCrumbNow = null;
    try { (new Function(cfg.goHome))(); } catch (e) { /* never trap the user */ }
    execRenderNav();
    return;
  }
  const back = execNavStack.pop();
  if (back) {
    execCrumbNow = null;
    try { (new Function(back.restore))(); } catch (e) { /* ditto */ }
  }
}
// Renders the back control + breadcrumb into whichever shell is on screen.
function execRenderNav() {
  const cfg = EXEC_MODULE_NAV[execModuleKey];
  const drill = execInModuleDrilldown();
  const canBack = drill || execNavStack.length > 0;
  document.querySelectorAll('.xshell .xs-back').forEach(b => b.classList.toggle('on', canBack));

  const parts = [];
  if (execNavStack.length) {
    const from = execNavStack[execNavStack.length - 1];
    parts.push({ label: from.label, go: 'execBack()' });
  }
  if (cfg) parts.push({ label: cfg.label, go: drill ? cfg.goHome : null });
  if (drill && !execCrumbNow) parts.push({ label: execCurrentViewLabel() || 'Detail', now: true });
  if (execCrumbNow) parts.push({ label: execCrumbNow, now: true });

  document.querySelectorAll('.xshell .xs-crumbs').forEach(strip => {
    if (parts.length < 2) { strip.classList.remove('on'); strip.innerHTML = ''; return; }
    strip.classList.add('on');
    strip.innerHTML = parts.map((p, i) => {
      const sep = i ? '<span class="xs-crumb-sep">›</span>' : '';
      if (p.now) return sep + `<span class="xs-crumb-now">${execEsc(p.label)}</span>`;
      if (p.go) return sep + `<span class="xs-crumb" onclick="${p.go}">${execEsc(p.label)}</span>`;
      return sep + `<span class="xs-crumb plain">${execEsc(p.label)}</span>`;
    }).join('');
  });
}
// The label of whichever sidebar item is currently active — gives the
// breadcrumb its middle rung without every module having to report it.
function execCurrentViewLabel() {
  const el = document.querySelector('.xshell .xs-item.active .xs-lbl');
  return el ? el.textContent.trim() : null;
}

function execMarkActive(navId) {
  document.querySelectorAll('.xs-item').forEach(b => b.classList.remove('active'));
  // Every adopted shell stays in the DOM once opened, so nav ids repeat
  // across modules — getElementById would hand back whichever shell was
  // adopted first, not the one on screen. Same duplicate-id trap the
  // rollout hit with the task input; scope to the visible shell.
  const el = execVisibleShell(el0 => el0.querySelector('#xsnav-' + CSS.escape(navId)))
    || document.getElementById('xsnav-' + navId);
  if (el) el.classList.add('active');
  execCrumbNow = null;          // a sidebar jump is a fresh context
  if (typeof execRenderNav === 'function') execRenderNav();
}

// ══════════════════════════════════════════
// APP-WIDE ROLLOUT (6 Aug 2026) — adopt-once shell + per-role nav registry
// Salman: one coherent layout for all users; "act like each single user and
// put the things that will be important to them."
//
// ADOPT-ONCE: most module wraps carry STATIC markup (index.html pages for
// Purchasing/Curtain/Operations, load-time templates elsewhere) — rebuilding
// innerHTML per open would destroy it. execEnsureShell() therefore builds
// the shell around the wrap's EXISTING children exactly once, moving them
// into the shell's content slot; every later open just refreshes the nav
// badges/panels. Legacy chrome (old wine headers, horizontal tab bars) is
// hidden by the CSS block below — the view logic, ids and sub-tabs inside
// each module are completely untouched, the sidebar simply drives the same
// view functions the old tabs called.
// ══════════════════════════════════════════
const execRolloutCSS = document.createElement('style');
execRolloutCSS.textContent = `
/* legacy chrome hidden once a module lives inside the shell */
.xshell .xs-content .ops-header{display:none!important;}
.xshell .xs-content .sales-toptabs{display:none!important;}
.xshell .xs-content #purch-nav,.xshell .xs-content #curt-nav,
.xshell .xs-content .sk-nav{display:none!important;}
/* Operations' banner/.nav have no ids and land one level deeper after
   adoption (inside the content slot) — wrap-scoped selectors match at any
   depth. Fixed 6 Aug 2026 after Salman's iPhone screenshot caught the
   old chrome leaking through (the original .xs-content > .nav selector
   never matched — same false negative in the first smoke check). */
#ops-module-wrap.xshell .topbar,
#ops-module-wrap.xshell .nav{display:none!important;}
/* the module's own MAIN tab bar (first child of its body div) — sub-tab
   bars deeper in a view (e.g. the Estimator's BOM Materials/Labour tabs)
   stay visible */
.xshell .xs-content [id$="-body"] > .sales-tabs:first-child{display:none!important;}
/* old inner scroll containers become plain blocks — the shell's xs-content
   is the one scroller */
.xshell .xs-content .sales-scroll,.xshell .xs-content .hr-scroll{overflow:visible;flex:none;}
/* Operations lives embedded in a page, not a fixed overlay — give its
   shell grid a real height */
#ops-module-wrap.xshell .xs-app{min-height:calc(100vh - 160px);}
#ops-module-wrap.xshell .xs-top .xs-iconbtn[title="Close"]{display:none;}
`;
document.head.appendChild(execRolloutCSS);

// Per-module body-rerender function names (theme toggle + panel refresh).
const EXEC_RERENDER_OF = {
  owner: 'renderOwnerBody', admin: 'renderAdminBody', sales: 'renderSalesBody',
  estimator: 'renderEstimatorBody', approver: 'renderApproverBody', jobs: 'renderJobsBody',
  accounts: 'renderAccountsBody', hr: 'renderHRBody', joinery: 'renderJoineryBody',
  upholstery: 'renderUpholsteryBody', painting: 'renderPaintingBody',
  fleet: 'renderFleetBody', delivery: 'renderDeliverySchedBody',
  purchasing: null, storekeeper: null, curtain: null, operations: null // DOM-router modules
};

function execEnsureShell(wrap, { key, title, role, navGroupsFn, closeFn }) {
  if (!wrap) return;
  execSetContext(key, EXEC_RERENDER_OF[key] || null);
  if (!wrap.__xsAdopted) {
    const kids = Array.from(wrap.childNodes);
    wrap.classList.add('xshell');
    wrap.innerHTML = execShellHTML({ title, sub: null, role, navGroups: navGroupsFn(), contentId: 'xs-slot-' + key, closeFn });
    const slot = wrap.querySelector('#xs-slot-' + key);
    kids.forEach(k => slot.appendChild(k));
    wrap.__xsAdopted = true;
  } else {
    const nav = wrap.querySelector('.xs-nav');
    if (nav) nav.innerHTML = execNavHTML(execWithSharedNav(navGroupsFn()));
    const t = wrap.querySelector('.xs-title');
    if (t) t.textContent = title;
    execRefreshSidePanels();
  }
  execThemeApply();
  execRefreshBadges();
  execRenderNav();
}

// ── per-role nav configs: what matters to THIS user, with live badges ──
function nvTag(fn) { try { const n = fn(); return n > 0 ? n : null; } catch (e) { return null; } }
function nv(id, ico, label, onclick, tag) { return { id, ico, label, onclick: onclick + ";execMarkActive('" + id + "')", tag }; }

const EXEC_NAV_CONFIGS = {
  sales: () => {
    const groups = [
      { label: 'Workspace', items: [
        nv('sal-dash', '▦', 'Overview', "salesSetTopView('dashboard')"),
        nv('sal-enq', '☎', 'Enquiries', "salesSetTopView('enquiries')"),
        nv('sal-qtn', '⎘', 'Quotations', "salesSetTopView('quotations')", nvTag(() => quotations.filter(q => q.lifecycleStatus === 'open').length)),
        nv('sal-jobs', '⚒', 'My Jobs', "salesSetTopView('myjobs')"),
        nv('sal-rep', '𝄜', 'Reports', "salesSetTopView('reports')")
      ] },
      { label: 'Quick actions', items: [
        nv('sal-new', '＋', 'New Enquiry', "salesView='enq-create';renderSalesBody()")
      ] }
    ];
    // 'This quote' only exists while a record is open — anchors that point at
    // nothing are worse than a group that isn't there.
    const q = (typeof salesView !== 'undefined' && salesView === 'qtn-hub')
      ? quotations.find(x => x.id === salesActiveQtnId) : null;
    if (q) {
      const enq = enquiries.find(e => e.id === q.enquiryId);
      groups.push({ label: 'This quote', items: [
        nv('qh-a-where', '◷', 'Where it is', "qhSetTab('record');qhScrollTo('qh-summary')"),
        nv('qh-a-items', '▤', 'Items', "qhSetTab('items')", nvTag(() => (q.items || []).length)),
        nv('qh-a-doc', '🗎', 'Document', "qhSetTab('document')"),
        nv('qh-a-hist', '𝄜', 'History', "qhSetTab('history')", nvTag(() => (q.auditLog || []).length)),
        nv('qh-a-att', '📎', 'Attachments', "qhSetTab('record');qhScrollTo('qh-attachments')",
          nvTag(() => (enq && enq.followUps ? enq.followUps.length : 0)))
      ] });
    }
    return groups;
  },
  estimator: () => [
    { label: 'Workspace', items: [
      nv('est-dash', '▦', 'Dashboard', "estimatorView='dashboard';renderEstimatorBody();EstimatorUI.setView('queue')", nvTag(() => getEstimatorKPIs(estimatorCurrentUser).pendingToPick + getEstimatorKPIs(estimatorCurrentUser).myActions)),
      nv('est-tenders', '◈', 'Tenders', "estimatorView='dashboard';renderEstimatorBody();EstimatorUI.setQueueFilter('tenders')"),
      nv('est-rates', '▤', 'Rate library', "estimatorView='dashboard';renderEstimatorBody();EstimatorUI.setView('rates')"),
      nv('est-actuals', '𝄜', 'Estimated vs actual', "estimatorView='dashboard';renderEstimatorBody();EstimatorUI.setView('actuals')")
    ] }
  ],
  approver: () => [
    { label: 'Workspace', items: [
      nv('apr-dash', '▦', 'For Approval', "approverView='dashboard';renderApproverBody()", nvTag(() => quotations.filter(q => q.stage === 'approver').length))
    ] }
  ],
  jobs: () => {
    // 'This job' only exists while a record is open — the anchors have nothing
    // to point at from the list, and a nav group that scrolls to nowhere is
    // worse than one that isn't there.
    const job = (typeof jobsView !== 'undefined' && jobsView === 'hub' && typeof getJobCard === 'function')
      ? getJobCard(jobsActiveJobId) : null;
    const groups = [
      { label: 'Workspace', items: [
        nv('job-list', '⚒', 'Job Cards', "jobsView='list';renderJobsBody()", nvTag(() => jobCards.filter(j => j.status === 'open').length)),
        nv('job-rep', '𝄜', 'Reports', "jobsView='reports';renderJobsBody()")
      ] }
    ];
    if (job) {
      const docs = (typeof getInvoicesForJob === 'function' ? getInvoicesForJob(job.id).length : 0) + (job.deliveryNotes || []).length;
      const depts = [...new Set((job.items || []).flatMap(it => routedDepartmentsFor(it)))].length;
      groups.push({ label: 'This job', items: [
        nv('job-a-items', '▤', 'Items', "jobsScrollTo('jr-items')", nvTag(() => (job.items || []).length)),
        nv('job-a-dept', '⚙', 'Departments', "jobsScrollTo('jr-departments')", nvTag(() => depts)),
        nv('job-a-docs', '🗎', 'Documents', "jobsScrollTo('jr-documents')", nvTag(() => docs)),
        nv('job-a-act', '◷', 'Activity', "jobsScrollTo('jr-activity')")
      ] });
    }
    return groups;
  },
  accounts: () => [
    { label: 'Money', items: [
      nv('ac-dash', '▦', 'Overview', "accountsSetView('dashboard')"),
      nv('ac-pend', '👤', 'Pending Customers', "accountsSetView('pending-customers')", nvTag(() => customers.filter(c => c.status === 'pending').length)),
      nv('ac-inv', '🧾', 'Invoices', "accountsSetView('invoices')"),
      nv('ac-rcpt', '💵', 'Sales Receipts', "accountsSetView('salesreceipts')"),
      nv('ac-scn', '↩', 'Credit Notes', "accountsSetView('creditnotes')"),
      nv('ac-prof', '⎘', 'Proforma', "accountsSetView('proforma')"),
      nv('ac-bos', '⏳', 'Bill O/s', "accountsSetView('bill-os')")
    ] },
    { label: 'General Ledger', items: [
      nv('ac-coa', '🗂', 'Chart of Accounts', "accountsSetView('coa')"),
      nv('ac-led', '📒', 'Ledgers', "accountsSetView('ledgers')"),
      nv('ac-grcpt', '⇣', 'General Receipt', "accountsSetView('receipts')"),
      nv('ac-gpay', '⇡', 'General Payment', "accountsSetView('payments')"),
      nv('ac-jrn', '⇄', 'Journal', "accountsSetView('journals')"),
      nv('ac-day', '📅', 'Day Book', "accountsSetView('daybook')"),
      nv('ac-vmap', '🔗', 'Voucher Map', "accountsSetView('voucher-map')")
    ] },
    { label: 'Reports', items: [
      nv('ac-tb', '⚖', 'Trial Balance', "accountsSetView('trial-balance')"),
      nv('ac-pl', '∑', 'Profit & Loss', "accountsSetView('pl')"),
      nv('ac-bs', '🏛', 'Balance Sheet', "accountsSetView('balance-sheet')"),
      nv('ac-lr', '🔍', 'Ledger Report', "accountsSetView('ledger-report')")
    ] },
    { label: 'Customer tools', items: [
      nv('ac-cu', '✎', 'Customer Update', "accountsSetView('custupdate')"),
      nv('ac-cb', '🏦', 'Banking Details', "accountsSetView('custbanking')")
    ] }
  ],
  hr: () => [
    { label: 'Workspace', items: [
      nv('hr-dash', '▦', 'HR Dashboard', "hrSetView('dashboard')", nvTag(() => { const k = getHRKPIs(); return Object.values(k).reduce((s, v) => s + (v.expired ? v.expired.length + v.expiring.length : 0), 0); })),
      nv('hr-emp', '🧑‍💼', 'Employees', "hrSetView('emp-list')"),
      nv('hr-pay', '𝄜', 'Payroll Report', "hrSetView('payroll')"),
      nv('hr-runs', '💵', 'Payroll Runs', "hrSetView('payroll-runs')"),
      nv('hr-appr', '✔', 'Sign-up Approvals', "hrSetView('approvals')", nvTag(() => typeof approvalQueueRows !== 'undefined' ? approvalQueueRows.length : 0))
    ] }
  ],
  joinery: () => {
    // granular shop-floor roles (drafting/cutting/veneer-pressing/floor)
    // must never see the manager tabs — access control, not cosmetics.
    if (typeof joineryView !== 'undefined' && !['dashboard', 'queue', 'budget'].includes(joineryView)) return [];
    return [
    { label: 'Workspace', items: [
      nv('jn-dash', '▦', 'Dashboard', "joinerySetView('dashboard')"),
      nv('jn-queue', '🪚', 'Production Queue', "joinerySetView('queue')", nvTag(() => getDepartmentQueue('carp').length)),
      nv('jn-bud', '💰', 'Budgets', "joinerySetView('budget')", nvTag(() => getOwnPendingBudgetCountForDept('carp')))
    ] }
  ]; },
  upholstery: () => {
    if (typeof upholsteryView !== 'undefined' && !['dashboard', 'queue', 'budget'].includes(upholsteryView)) return [];
    return [
    { label: 'Workspace', items: [
      nv('up-dash', '▦', 'Dashboard', "upholsterySetView('dashboard')"),
      nv('up-queue', '🛋', 'Production Queue', "upholsterySetView('queue')", nvTag(() => getDepartmentQueue('uph').length)),
      nv('up-bud', '💰', 'Budgets', "upholsterySetView('budget')", nvTag(() => getOwnPendingBudgetCountForDept('uph')))
    ] }
  ]; },
  painting: () => [
    { label: 'Workspace', items: [
      nv('pt-dash', '▦', 'Dashboard', "paintingSetView('dashboard')"),
      nv('pt-queue', '🎨', 'Queue', "paintingSetView('queue')", nvTag(() => getPaintingQueue().length)),
      nv('pt-bud', '💰', 'Budgets', "paintingSetView('budget')")
    ] }
  ],
  fleet: () => [
    { label: 'Workspace', items: [
      nv('fl-list', '🚚', 'Vehicles', "fleetView='list';renderFleetBody()"),
      nv('fl-insp', '🔧', 'New Inspection', "fleetView='new-inspection';renderFleetBody()")
    ] }
  ],
  delivery: () => [
    { label: 'Workspace', items: [
      nv('dl-list', '📦', 'Schedule', "deliverySchedView='list';renderDeliverySchedBody()", nvTag(() => (typeof deliverySchedule !== 'undefined' ? deliverySchedule : []).filter(d => d.status === 'planned').length)),
      nv('dl-fb', '⭐', 'Feedback', "deliverySchedView='feedback';renderDeliverySchedBody()")
    ] }
  ],
  purchasing: () => [
    { label: 'Workspace', items: [
      nv('pu-dash', '▦', 'Dashboard', "purchGoTo('purch-dashboard')"),
      nv('pu-req', '📝', 'Requests', "purchGoTo('purch-requests')", nvTag(() => purchaseRequests.filter(r => r.status === 'open').length)),
      nv('pu-appr', '✔', 'Approvals', "purchGoTo('purch-approvals')", nvTag(() => typeof getPendingPOApprovals === 'function' ? getPendingPOApprovals().length : 0)),
      nv('pu-ord', '📦', 'Orders', "purchGoTo('purch-orders')"),
      nv('pu-reg', '𝄜', 'PO Register', "purchGoTo('purch-register')"),
      nv('pu-sup', '🏭', 'Suppliers', "purchGoTo('purch-suppliers')"),
      nv('pu-pay', '💵', 'Payment', "purchGoTo('purch-payments')"),
      nv('pu-dn', '↩', 'Debit Note', "purchGoTo('purch-debitnotes')"),
      nv('pu-bos', '⏳', 'Bill O/s', "purchGoTo('purch-billos')")
    ] }
  ],
  storekeeper: () => [
    { label: 'Workspace', items: [
      nv('sk-dash', '▦', 'Dashboard', "skGoTo('dashboard')", nvTag(() => getReorderAlerts().length)),
      nv('sk-req', '🙋', 'Material Requests', "skGoTo('requests')", nvTag(() => getOpenMaterialRequests().length)),
      nv('sk-items', '🏷', 'Item Master', "skGoTo('items')"),
      nv('sk-mast', '🗂', 'Masters', "skGoTo('masters')"),
      nv('sk-adj', '± ', 'Stock Adjustment', "skGoTo('adjustment')"),
      nv('sk-mi', '⇡', 'Material Issue', "skGoTo('mi')"),
      nv('sk-mr', '⇣', 'Material Return', "skGoTo('mr')"),
      nv('sk-rep', '𝄜', 'Reports', "skGoTo('reports')")
    ] }
  ],
  curtain: () => [
    { label: 'Workspace', items: [
      nv('cu-dash', '▦', 'Dashboard', "curtGoTo('curt-dashboard')"),
      nv('cu-jobs', '⚒', 'Jobs', "curtGoTo('curt-jobs')"),
      nv('cu-win', '🪟', 'Windows', "curtGoTo('curt-windows')"),
      nv('cu-bom', '🧾', 'BOM', "curtGoTo('curt-bom')"),
      nv('cu-wip', '🧵', 'WIP', "curtGoTo('curt-workshop')"),
      nv('cu-fab', '🧶', 'Fabric', "curtGoTo('curt-fabric')"),
      nv('cu-inst', '🏠', 'Installation', "curtGoTo('curt-install')")
    ] }
  ],
  operations: () => [
    { label: 'Workspace', items: [
      nv('op-dash', '▦', 'Dashboard', "opsGoTo('dashboard')"),
      nv('op-new', '🆕', 'New Jobs', "opsGoTo('alerts')", nvTag(() => getJobsPendingRouting().length)),
      nv('op-bud', '💰', 'Budget Approvals', "opsGoTo('budgetapprovals')", nvTag(() => typeof getAllPendingBudgetApprovals === 'function' ? getAllPendingBudgetApprovals().length : 0)),
      nv('op-curt', '🪟', 'Curtain Approvals', "opsGoTo('curtapp')"),
      nv('op-bom', '🧾', 'BOM / Budget', "opsGoTo('bom')"),
      nv('op-proj', '🏗', 'All Projects', "opsGoTo('projects')"),
      nv('op-del', '🚚', 'Delivery', "opsGoTo('delivery')"),
      nv('op-cap', '👷', 'Capacity', "opsGoTo('capacity')")
      // Reminders page retired from the sidebar 6 Aug 2026 — the shell's
      // own bell (real signals) owns this now; the page stays reachable
      // for old links but isn't day-to-day navigation.
    ] }
  ]
};
