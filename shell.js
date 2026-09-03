// ═══════════════════════════════════════
// AL MARAYA — shell.js
// Main nav, dev checklist, notes, ecosystem
// panel, service worker.
// (The old shared 4-digit PIN lock was removed 4 Aug 2026 — it was
// never real security, just a hardcoded code shown as an on-screen
// hint. Real per-person login now lives in auth.js/cloudLoginStart(),
// which fires on page load instead.)
// ═══════════════════════════════════════

// NAV
const TT={eco:'Ecosystem',roadmap:'Roadmap',notes:'Notes',checklist:'Checklist',operations:'Operations',curtain:'Curtain & Blinds'};
function goTo(p){
  // Hide curtain/purchasing modules, restore main scroll
  const curtMod = document.getElementById('curt-module-wrap');
  if (curtMod) curtMod.style.cssText = 'display:none;';
  const purchMod = document.getElementById('purch-module-wrap');
  if (purchMod) purchMod.style.cssText = 'display:none;';
  const skMod = document.getElementById('sk-module-wrap');
  if (skMod) skMod.style.cssText = 'display:none;';
  const salesMod = document.getElementById('sales-module-wrap');
  if (salesMod) salesMod.style.cssText = 'display:none;';
  const estimatorMod = document.getElementById('estimator-module-wrap');
  if (estimatorMod) estimatorMod.style.cssText = 'display:none;';
  const approverMod = document.getElementById('approver-module-wrap');
  if (approverMod) approverMod.style.cssText = 'display:none;';
  const jobsMod = document.getElementById('jobs-module-wrap');
  if (jobsMod) jobsMod.style.cssText = 'display:none;';
  const accountsMod = document.getElementById('accounts-module-wrap');
  if (accountsMod) accountsMod.style.cssText = 'display:none;';
  const hrMod = document.getElementById('hr-module-wrap');
  if (hrMod) hrMod.style.cssText = 'display:none;';
  const joineryMod = document.getElementById('joinery-module-wrap');
  if (joineryMod) joineryMod.style.cssText = 'display:none;';
  const upholsteryMod = document.getElementById('upholstery-module-wrap');
  if (upholsteryMod) upholsteryMod.style.cssText = 'display:none;';
  const paintingMod = document.getElementById('painting-module-wrap');
  if (paintingMod) paintingMod.style.cssText = 'display:none;';
  const ownerMod = document.getElementById('owner-module-wrap');
  if (ownerMod) ownerMod.style.cssText = 'display:none;';
  // Milestone E (5 Aug 2026, role-based access rollout).
  const fleetMod = document.getElementById('fleet-module-wrap');
  if (fleetMod) fleetMod.style.cssText = 'display:none;';
  const deliverySchedMod = document.getElementById('delivery-sched-module-wrap');
  if (deliverySchedMod) deliverySchedMod.style.cssText = 'display:none;';
  // Nav overhaul Phase 2 (5 Aug 2026).
  const adminMod = document.getElementById('admin-module-wrap', 'prd-module-wrap', 'uph-module-wrap');
  if (adminMod) adminMod.style.cssText = 'display:none;';
  const opsMod = document.getElementById('ops-module-wrap');
  if (opsMod) opsMod.style.cssText = 'display:none;';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';

  document.querySelectorAll('#scroll > .page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.bni').forEach(x=>x.classList.remove('active'));
  document.getElementById('p-'+p)?.classList.add('active');
  document.getElementById('bn-'+p)?.classList.add('active');
  // The old app topbar (#tb-title) and bottom bar (.bni) were retired
  // 7 Aug 2026 — guard so goTo() keeps working without them.
  const tbTitle = document.getElementById('tb-title');
  if (tbTitle) tbTitle.textContent = TT[p] || p;
  scroll?.scrollTo({top:0,behavior:'smooth'});
  updateHubBadges();
  // The Operations Dashboard/New-Jobs badge only refreshed on script load
  // or when switching between Operations' OWN internal tabs (opsGoTo) —
  // navigating INTO Operations from the ecosystem hub never re-rendered
  // either, so anyone entering Operations saw whatever was true whenever
  // the page first loaded, not real current data (4 Aug 2026 audit finding,
  // found live-testing the new dashboard right after building it).
  if (p === 'operations') {
    // Operations is a real full-screen module now (7 Aug 2026) — this
    // stays as the alias every existing call site uses (ownerGoToOperations,
    // direct-landing for the operations role, e2e suites).
    if (typeof openOperationsModule === 'function') openOperationsModule();
  }
}

// CHECKLIST
const CS={c1:true,c2:false,c3:false,c4:false,c5:false,c6:true,c7:true,c8:false,c9:false,c10:false,c11:false,c12:false,c13:false};
function tc(id){
  CS[id]=!CS[id];
  const box=document.getElementById('cbox-'+id);
  const ct=document.getElementById('ct-'+id);
  if(CS[id]){box.classList.add('done');box.innerHTML='<span style="font-size:10px;color:#fff;font-weight:800;">✓</span>';ct?.classList.add('done');}
  else{box.classList.remove('done');box.innerHTML='';ct?.classList.remove('done');}
  updCP();
}
function updCP(){
  const total=Object.keys(CS).length;
  const done=Object.values(CS).filter(Boolean).length;
  const pct=Math.round(done/total*100);
  const bar=document.getElementById('cp-bar');
  if(bar){bar.style.width=pct+'%';}
  const txt=document.getElementById('cp-text');
  if(txt)txt.textContent=done+' of '+total+' done';
  const pctEl=document.getElementById('cp-pct');
  if(pctEl)pctEl.textContent=pct+'%';
}

// HUB PUSH BADGES
// Reads live item-card state from curtain.js/data.js and reflects it as
// small numbered badges on the three Curtain sub-nodes (Tracks/QC/Install)
// — a leftover from the pre-3D-hub 2D SVG map (those sub-node badge
// elements no longer exist anywhere in the DOM since the 3D hub replaced
// it 3 Aug 2026; setHubBadge() below already no-ops safely when its
// target element isn't found). Left in place as harmless, already-inert
// legacy code rather than chasing every call site — not part of Nav
// overhaul Phase 4's actual scope (removing the 3D hub + M/showPanel()),
// just adjacent to it.
function updateHubBadges(){
  if (typeof curtainJobs === 'undefined' || !Array.isArray(curtainJobs)) return;

  let reworkCount = 0, qcNewCount = 0, readyToInstallCount = 0;

  curtainJobs.forEach(job => {
    if (typeof ensureItemCards === 'function') ensureItemCards(job);
    if (!job.itemCards) return;

    const qcStatus = typeof getJobQCStatus === 'function' ? getJobQCStatus(job) : null;
    const released = !!(qcStatus && (qcStatus.allPassed || (job.installation && job.installation.partialRelease === true)));

    (job.windows || []).forEach(w => {
      if (!w.calcDone) return;
      const card = job.itemCards[w.id];
      if (!card) return;
      if (card.isRework) reworkCount++;
      if (card.qcQueuedAt && !card.qcSeen) qcNewCount++;
      if (card.stage === 'Ready' && !card.isRework && released) readyToInstallCount++;
    });
  });

  setHubBadge('badge-sub-tracks', reworkCount);
  setHubBadge('badge-sub-qc', qcNewCount);
  setHubBadge('badge-sub-install', readyToInstallCount);
}

function setHubBadge(groupId, count){
  const g = document.getElementById(groupId);
  if (!g) return;
  if (count > 0) {
    g.style.display = '';
    const t = g.querySelector('text');
    if (t) t.textContent = count > 9 ? '9+' : String(count);
  } else {
    g.style.display = 'none';
  }
}

// SIGN OUT / SHARED CLOSE (5 Aug 2026, navigation overhaul) — replaces
// the identical hide-wrap + reveal-#scroll body every close*Module()
// function used to duplicate (12+ near-identical copies). Context-aware:
// most roles have exactly one dashboard (window.__dashboardHome is
// null, set at login by finishCloudLogin) — for them, closing their one
// screen has nowhere else to go, so it IS signing out. Owner/Admin have
// their own dashboard as a real hub (quick-links / developer preview
// into every other module) — window.__dashboardHome holds THEIR OWN
// launch function's name, so closing anything else returns to it;
// closing that home dashboard itself still means Sign Out, same as any
// other role's own dashboard.
// homeFnName: the launch-function name this module's OWN dashboard is
// registered under (e.g. 'launchSalesModule') — lets this tell "am I
// being closed as someone's home" apart from "am I a drill-in".
// Plain hide, no Sign-Out/return-home logic — for internal cross-module
// hops (ownerGoTo(), jobsNewVariation(), salesRequestPurchase(), etc.)
// that call a module's own close*Module() purely to tidy up its wrap
// before jumping to a different module, NOT because the user closed
// their dashboard. Nav overhaul Phase 3 (5 Aug 2026) real bug found
// live: once window.__dashboardHome is assigned, calling closeXModule()
// from one of these hops is indistinguishable from the user closing
// their own home dashboard (same wrap, same homeFnName) — it wrongly
// triggered a Sign-Out confirm instead of just hiding the wrap and
// continuing the jump. Use this instead of close*Module() anywhere a
// call is a means to navigate elsewhere, not a real close.
function hideModuleWrap(wrapEl) {
  if (wrapEl) wrapEl.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}

function closeModuleWrap(wrapEl, homeFnName) {
  const hide = () => {
    if (wrapEl) wrapEl.style.display = 'none';
    const scroll = document.getElementById('scroll');
    if (scroll) scroll.style.display = '';
  };
  const home = window.__dashboardHome;
  if (home === undefined) {
    // window.__dashboardHome isn't assigned until the direct-landing login
    // flow (Phase 3) sets it — until then, fall back to the pre-existing
    // "return to hub" behavior so nothing breaks mid-rollout.
    hide();
    if (typeof goTo === 'function') goTo('eco');
    return;
  }
  if (home && home !== homeFnName) {
    if (typeof window[home] === 'function') { hide(); window[home](); return; }
  }
  // BUG FIX (7 Aug 2026, Salman): the module used to be hidden BEFORE this
  // confirm, so tapping Cancel still dumped the user onto the empty Home
  // screen — indistinguishable from being signed out. Ask first; cancelling
  // now leaves them exactly where they were, untouched.
  if (!window.confirm('Sign out of AMD-APP?')) return;
  hide();
  if (typeof cloudSignOut === 'function') cloudSignOut();
}

// Nav overhaul Phase 4 (5 Aug 2026) — the bottom nav's old "Ecosystem"
// tab is now "Home" (Operations' own back button routes through this
// too). Deliberately NOT the same as closeModuleWrap()'s Sign-Out path —
// this is a nav tap, not a close action, so it should never sign anyone
// out on its own. For Owner/Admin (window.__dashboardHome set) it
// returns to their own hub; for every other role, already on their one
// screen, it's a plain no-op; if __dashboardHome hasn't been assigned
// yet (the offline e2e bypass never sets it), falls back to goTo('eco')
// for backward compatibility with the many existing suites that still
// check for #p-eco becoming active.
function goHome() {
  const home = window.__dashboardHome;
  if (home === undefined) { if (typeof goTo === 'function') goTo('eco'); return; }
  if (home && typeof window[home] === 'function') window[home]();
}

// NOTES
function addNote(){
  const text=prompt('Add note:');if(!text)return;
  const mod=prompt('Module:')||'General';
  const el=document.createElement('div');
  el.className='note-card';
  el.innerHTML=`<div class="note-module">${mod}</div><div class="note-text">${text}</div><div class="note-date">Just now</div>`;
  document.getElementById('notes-list').prepend(el);
}

// SW
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{});}
