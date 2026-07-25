// ═══════════════════════════════════════
// AL MARAYA — shell.js
// PIN lock, main nav, dev checklist,
// notes, ecosystem panel, service worker.
// ═══════════════════════════════════════

// PIN
const PIN='1994';let entered='';
function pt(v){
  if(v==='DEL'){entered=entered.slice(0,-1);}
  else if(entered.length>=4)return;
  else entered+=v;
  for(let i=0;i<4;i++){const d=document.getElementById('d'+i);d.classList.toggle('filled',i<entered.length);}
  if(entered.length===4){
    setTimeout(()=>{
      if(entered===PIN){document.getElementById('lock').style.display='none';document.getElementById('app').style.display='flex';updCP();updateHubBadges();}
      else{document.querySelectorAll('.pin-dot').forEach(d=>d.classList.add('error'));setTimeout(()=>{entered='';for(let i=0;i<4;i++)document.getElementById('d'+i).classList.remove('filled','error');},700);}
    },100);
  }
}

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
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';

  document.querySelectorAll('#scroll > .page').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.bni').forEach(x=>x.classList.remove('active'));
  document.getElementById('p-'+p)?.classList.add('active');
  document.getElementById('bn-'+p)?.classList.add('active');
  document.getElementById('tb-title').textContent=TT[p]||p;
  scroll?.scrollTo({top:0,behavior:'smooth'});
  updateHubBadges();
}

// MODULE DATA
const M={
  center:{icon:'◣',title:'Al Maraya Decor',sub:'Business Operations System',status:'built',sl:'Core · all modules branch from here',features:['Operations module complete','Curtain & Blinds module complete','Production modules building','Owner dashboard planned','Tally bridge planned'],note:'Every module in the ecosystem connects back to the core business. Tap any node to see its details.',btn:'System overview'},
  operations:{icon:'⚙️',title:'Operations',sub:'Full job lifecycle management',status:'built',sl:'✓ Fully designed · 9 screens',features:['Dashboard + KPIs','New job alerts','Dept assignment + item detail','BOM with 3 ownership modes','Delegated tasks queue','Variations tracker (read-only)','Subcontractor tracking','Payment milestones','Snag list + sign-off','Internal notes','Client log + Documents','Delivery checklist','Capacity heatmap','Reminders log'],note:'Fully designed. Ready to hand to Nettworksy. Variations are raised by Sales/PM — not Operations.',btn:'View module summary'},
  curtain:{icon:'🪟',title:'Curtain & Blinds',sub:'Silva · Workshop + dedicated install crew',status:'built',sl:'✓ Built · 6 screens',features:['Dashboard — cost control KPIs','Window schedule with fabric calculator','Pattern repeat + roll width calculation','Room accordion — copy room / copy window','BOM — auto-generated from window schedule','Budget approval with BD 5k threshold','Procurement tracking','Installation scheduling + handover'],note:'Full module built. Window schedule calculates fabric metres from roll width, fullness, and pattern repeats. BOM auto-populates. Budget escalates to Salman over BD 5,000.',btn:'Open Curtain Module →'},
  purchasing:{icon:'🛒',title:'Purchaser',sub:'Ops/Owner · Request → PO → Invoice',status:'built',sl:'✓ Built · 4 screens',features:['Dashboard — KPI rollup by division','Purchase Request queue, dept-filterable','Convert PR → PO with supplier + pricing','PO approval — mandatory rejection comment','Receive & convert PO → Invoice','Curtain fabric/rail shown read-only for context'],note:'Covers Upholstery, Joinery (incl. Painting) and Metal Works purchasing. Curtain keeps its own fabric/rail tracker (raised from the Fabric tab) — reconciled here only as a read-only rollup, never merged.',btn:'Open Purchaser →'},
  storekeeper:{icon:'📦',title:'Storekeeper',sub:'Stock pool → department release',status:'built',sl:'✓ Built · release with full traceability',features:['Stock pool — all received Stock-type invoice items','Search pool by item or source invoice','Release to department, tied to a job (always produces an itemCard)','Partial release — remainder stays in-pool','Release history log'],note:'Every Stock-type PO/Invoice receipt lands here automatically. Release always requires a job so it stays traceable end-to-end via the itemCard it produces.',btn:'Open Storekeeper →'},
  upholstery:{icon:'🛋️',title:'Upholstery',sub:'Sofas, re-upholstery, headboards',status:'soon',sl:'Planned — after Curtain',features:[],soon:['Job cards + measurements','Frame making stage','Foam & fabric cutting','Sewing & covering','QC checklist'],note:'After Curtain module is complete, this is next.'},
  joinery:{icon:'🪵',title:'Joinery',sub:'Woodwork, wardrobes, doors',status:'soon',sl:'Planned',features:[],soon:['Workshop job cards','Cutting & CNC','Assembly','Machine scheduling','Labour hours','Paint & metal sub-stages'],note:'Largest module — painting and metal works sit inside Joinery.'},
  painting:{icon:'🎨',title:'Painting',sub:'Finishes, spray, metal coating',status:'soon',sl:'Planned',features:[],soon:['Queue from Joinery','Finish specs (RAL, texture)','Spray stages','Curing tracking','QC sign-off'],note:'Serves both Joinery and Metal Works.'},
  sales:{icon:'💼',title:'Sales',sub:'Enquiry → Quotation',status:'built',sl:'✓ Built · Enquiry + Quotation',features:['Enquiry dashboard with filters (Un Assigned/Un Attended/Un Quoted)','Create Enquiry + inline New Customer','Enquiry Basic/Follow-up tabs, salesman-locked','Convert Quotation — only once linked to a real Customer','3-step Quotation wizard: Client & Project, Product & Services, Finalise','With Estimation locks pricing, routes to Estimator stage'],note:'Quotations can ONLY be created by converting an Enquiry linked to a real Customer — no standalone Create button, matching live Q-Pro. Estimator is its own standalone module (see the Estimator hub node) — Approver is tracked but not yet built as a screen.',btn:'Open Sales →'},
  estimation:{icon:'📐',title:'Estimator',sub:'Pick → BOM → Selling Price',status:'built',sl:'✓ Built · standalone module',features:['Dashboard: Pending to Pick, My Actions, With Approver, Confirmed, PR','Pick a quotation off the Estimator stage','Manage Quote hub (Estimator view) with ESTIMATION tile','Estimation index — per-item Add/Update/Clear BOM','6-tab Job Estimation: Materials, Labour, Sub Contract, Hiring, Others, Summary','Cost-plus waterfall: overhead % per category → profit % → Selling Price, with manual override'],note:'Split out as its own module with its own simulated user identity (Salman\'s call, 25 Jul 2026) — Estimator is a distinct role in Q-Pro, not a Sales tab. Shares quotations[] with Sales via data.js.',btn:'Open Estimator →'},
  owner:{icon:'👑',title:'Owner Dashboard',sub:'Daily business health view',status:'soon',sl:'Planned',features:[],soon:['Revenue vs costs','Division performance','Cash position','Escalations only','Job profitability ranking'],note:'Daily view for Salman — answers 3 questions in 3 seconds. No noise.'},
  accounts:{icon:'💰',title:'Accounts',sub:'Tally bridge',status:'soon',sl:'Planned',features:[],soon:['Invoice sync to Tally','Payment reconciliation','P&L per division','Supplier payments'],note:'Tally stays for accounting. Bridge removes double entry.'},
  delivery:{icon:'🚚',title:'Delivery',sub:'Scheduling + sign-off',status:'soon',sl:'Partially built in Operations',features:['Pre-delivery checklist (in Operations)','Dispatch → invoice trigger','Delivery schedule'],soon:['Standalone driver view','Photo proof of delivery'],note:'Basic delivery is inside Operations already.'},
  hr:{icon:'👥',title:'HR & Payroll',sub:'Staff, attendance, payroll',status:'soon',sl:'Planned',features:[],soon:['Employee profiles','Attendance','Payroll','Leave management','Visa expiry alerts'],note:'Q-Pro already has HR. Decide whether to extend or build separately.'},
  approvals:{icon:'✅',title:'Approver',sub:'Pick → Review → Approve',status:'built',sl:'✓ Built · standalone module',features:['Dashboard: Pending to Pick, For Approval, Quotations (Total), PR, PO Approval, New Customers','Pick a quotation off the Approver stage','Review Screen — Common Comments + per-line Comments, Cost/Profit/Profit% columns','Approve Quote (Draft → Open, back to Sales) or Back to Estimator','New Customers approval queue','Full audit trail on every Manage Quote hub page'],note:'Split out as its own module with its own simulated user identity (defaults to Salman Abdullah). Approve Quote is the only action that flips a quotation from Draft to Open — "Confirm Quote" (Open → Confirmed, the bridge into Jobs/Invoicing) is out of scope for now.',btn:'Open Approver →'},
  tally:{icon:'🔗',title:'Tally Bridge',sub:'Sync with Tally',status:'soon',sl:'Planned',features:[],soon:['Auto-push invoices','Payment sync','No manual re-entry'],note:'Removes duplicate data entry between this system and Tally.'},
};

function showPanel(id){
  const m=M[id];if(!m)return;
  document.getElementById('pi').textContent=m.icon;
  document.getElementById('pt').textContent=m.title;
  document.getElementById('ps').textContent=m.sub;
  const pst=document.getElementById('pst');
  pst.textContent=m.sl;
  pst.className='ph-status '+(m.status==='built'?'st-built':m.status==='building'?'st-building':'st-soon');
  let b='';
  if(m.features?.length){b+=`<div class="pb-section"><div class="pb-label">${m.status==='built'?'Built features':'Confirmed'}</div><div>`;b+=m.features.map(f=>`<span class="fc">✓ ${f}</span>`).join('');b+='</div></div>';}
  if(m.soon?.length){b+=`<div class="pb-section"><div class="pb-label">Planned</div><div>`;b+=m.soon.map(f=>`<span class="fc soon">${f}</span>`).join('');b+='</div></div>';}
  b+=`<div class="pb-section"><div class="pb-label">Note</div><p class="panel-note">${m.note}</p></div>`;

  // Button action per module
  let btnAction='closePanel()';
  let btnLabel=m.status==='building'?'Continue designing →':m.status==='built'?'View summary →':'Not yet started';
  let btnDim=m.status==='soon';

  if(id==='operations'){
    btnAction="closePanel();setTimeout(()=>goTo('operations'),300)";
    btnLabel='Open Operations Module →';
    btnDim=false;
  } else if(id==='curtain'){
    btnAction="closePanel();setTimeout(()=>launchCurtainModule(),300)";
    btnLabel='Open Curtain & Blinds →';
    btnDim=false;
  } else if(id==='purchasing'){
    btnAction="closePanel();setTimeout(()=>launchPurchasingModule(),300)";
    btnLabel='Open Purchaser →';
    btnDim=false;
  } else if(id==='storekeeper'){
    btnAction="closePanel();setTimeout(()=>launchStorekeeperModule(),300)";
    btnLabel='Open Storekeeper →';
    btnDim=false;
  } else if(id==='sales'){
    btnAction="closePanel();setTimeout(()=>launchSalesModule(),300)";
    btnLabel='Open Sales →';
    btnDim=false;
  } else if(id==='estimation'){
    btnAction="closePanel();setTimeout(()=>launchEstimatorModule(),300)";
    btnLabel='Open Estimator →';
    btnDim=false;
  } else if(id==='approvals'){
    btnAction="closePanel();setTimeout(()=>launchApproverModule(),300)";
    btnLabel='Open Approver →';
    btnDim=false;
  }

  b+=`<button class="panel-btn${btnDim?' dim':''}" ${btnDim?'':'onclick="'+btnAction+'"'}>${btnLabel}</button>`;

  document.getElementById('pb').innerHTML=b;
  document.getElementById('info-panel').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}

function closePanel(){
  document.getElementById('info-panel').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
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
// on the ecosystem hub. Safe no-op if curtain.js hasn't loaded/hydrated yet.
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
