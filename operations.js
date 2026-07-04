// ═══════════════════════════════════════
// AL MARAYA — operations.js
// All Operations module functions.
// Depends on: data.js
// ═══════════════════════════════════════

// ══════════════════════════════
// HELPERS
// ══════════════════════════════
function money(n){return "BD "+(parseFloat(n)||0).toFixed(3);}
function unres(p){return p.alerts.filter(a=>!a.r).length;}
function showAlert(msg){
  const el=document.createElement("div");
  el.style.cssText="position:fixed;top:70px;left:50%;transform:translateX(-50%);background:var(--ok);color:#fff;padding:11px 20px;border-radius:var(--r2);font-size:13px;font-weight:600;z-index:999;max-width:90vw;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.15);";
  el.textContent=msg; document.body.appendChild(el);
  setTimeout(()=>el.remove(),3000);
}

// ══════════════════════════════
// CURTAIN ACCOUNTS-ALERT SYNC
// Curtain flags job.accountsAlert once a whole job clears QC (balance
// invoice can be requested before install). This pulls that signal into
// Operations' own alert feed. curtainJobs and projects are separate
// datasets — as of this session their IDs don't overlap, so unmatched
// alerts surface in a standalone banner here instead of being silently
// dropped. Once Q-Pro-issued job IDs align across both (Operations
// assigns a Job Card, Silva works the same ID), matched alerts route
// straight into that project's own Alerts tab — no code change needed.
// ══════════════════════════════
let curtainUnlinkedAlerts = []; // [{jobId, jobName, client, raisedAt, r}]

function syncCurtainAccountsAlerts(){
  if (typeof curtainJobs === 'undefined' || !Array.isArray(curtainJobs)) return;

  curtainJobs.forEach(job => {
    if (!job.accountsAlert) return;
    const proj = projects.find(p => p.id === job.id);

    if (job.accountsAlert.seen) {
      // Curtain-side "Mark sent" already handled it — echo the resolution
      if (proj) {
        const existing = proj.alerts.find(a => a.curtainSync && a.sourceRaisedAt === job.accountsAlert.raisedAt);
        if (existing) existing.r = true;
      }
      const unlinked = curtainUnlinkedAlerts.find(a => a.jobId === job.id && a.raisedAt === job.accountsAlert.raisedAt);
      if (unlinked) unlinked.r = true;
      return;
    }

    if (proj) {
      const already = proj.alerts.some(a => a.curtainSync && a.sourceRaisedAt === job.accountsAlert.raisedAt);
      if (!already) {
        proj.alerts.push({
          t:  'Balance invoice due — Curtain QC complete',
          s:  'All items passed QC — request balance invoice before install.',
          tp: 'warn',
          r:  false,
          curtainSync: true,
          sourceRaisedAt: job.accountsAlert.raisedAt,
        });
      }
    } else {
      const already = curtainUnlinkedAlerts.some(a => a.jobId === job.id && a.raisedAt === job.accountsAlert.raisedAt);
      if (!already) {
        curtainUnlinkedAlerts.push({
          jobId:    job.id,
          jobName:  job.name,
          client:   job.client,
          raisedAt: job.accountsAlert.raisedAt,
          r: false,
        });
      }
    }
  });
}

function renderCurtainUnlinkedAlerts(){
  const box = document.getElementById('ops-curtain-alerts');
  if (!box) return;
  const open = curtainUnlinkedAlerts.filter(a => !a.r);
  if (open.length === 0) { box.innerHTML = ''; return; }
  box.innerHTML = `
    <div class="card" style="border:1px solid var(--warn-line, #fde68a);background:var(--warn-bg, #fffbeb);">
      <p class="card-title">Curtain — Accounts alerts (${open.length})</p>
      <p style="font-size:11px;color:var(--ink2);margin-bottom:8px;">No matching project found yet for these Curtain job IDs — showing here until job IDs align.</p>
      ${open.map(a => `
        <div class="tl-item">
          <div class="tl-dot" style="background:var(--warn);"></div>
          <div class="tl-body">
            <div class="tl-t">${a.jobName} (${a.jobId})</div>
            <div class="tl-s">${a.client} — all items passed QC, request balance invoice before install.</div>
            <div style="margin-top:7px;"><button class="sm ok" onclick="resolveCurtainUnlinkedAlert('${a.jobId}','${a.raisedAt}')">Resolve ✓</button></div>
          </div>
        </div>`).join('')}
    </div>`;
}

function resolveCurtainUnlinkedAlert(jobId, raisedAt){
  const a = curtainUnlinkedAlerts.find(a => a.jobId === jobId && a.raisedAt === raisedAt);
  if (a) a.r = true;
  renderCurtainUnlinkedAlerts();
}

// ══════════════════════════════
// PROJECT LIST
// ══════════════════════════════
function renderProjList(){
  syncCurtainAccountsAlerts();
  renderCurtainUnlinkedAlerts();
  document.getElementById("all-proj-rows").innerHTML=projects.map((p,pi)=>{
    const u=unres(p);
    return`<div class="prow" onclick="openJob('${p.id}')">
      <div style="flex:1;"><div class="pname">${p.name}</div><div class="pmeta">${p.id} · ${p.client} · BD ${p.val.toLocaleString()}</div>
        <div class="ptags">
          <span class="pill ${p.health==="ok"?"ok":p.health==="warn"?"warn":"bad"}">${p.health==="ok"?"On budget":p.health==="warn"?"At risk":"Over budget"}</span>
          ${p.depts.map(d=>`<span style="font-size:10px;color:var(--ink2);display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dc(d.k).c};"></span>${dc(d.k).n} ${d.pct}%</span>`).join("")}
          ${p.variations.length?`<span class="pill purple">${p.variations.length} variation${p.variations.length>1?"s":""}</span>`:""}
          ${p.snags.filter(s=>!s.r).length?`<span class="pill bad">${p.snags.filter(s=>!s.r).length} snag${p.snags.filter(s=>!s.r).length>1?"s":""}</span>`:""}
        </div>
      </div>
      <span class="badge ${u===0?"zero":u<=2?"warn":""}">${u===0?"✓":u}</span>
    </div>`;
  }).join("");
}
function showProjList(){
  document.getElementById("proj-list").style.display="block";
  document.getElementById("proj-detail").style.display="none";
  renderProjList();
}

// ══════════════════════════════
// JOB DETAIL
// ══════════════════════════════
const JOB_TABS=[
  {k:"overview",l:"Overview"},
  {k:"budget",l:"Budget"},
  {k:"variations",l:"Variations"},
  {k:"subcons",l:"Subcontractors"},
  {k:"payments",l:"Payments"},
  {k:"snags",l:"Snags"},
  {k:"notes",l:"Internal Notes"},
  {k:"comms",l:"Client Log"},
  {k:"docs",l:"Documents"},
];
function openJob(id){
  currentJob=projects.find(p=>p.id===id);
  if(!currentJob) return;
  document.getElementById("proj-list").style.display="none";
  document.getElementById("proj-detail").style.display="block";
  document.getElementById("jd-name").textContent=currentJob.name;
  document.getElementById("jd-meta").textContent=currentJob.id+" · "+currentJob.client+" · BD "+currentJob.val.toLocaleString();
  const u=unres(currentJob);
  document.getElementById("jd-badge").innerHTML=`<span class="badge ${u===0?"zero":u<=2?"warn":""}" style="font-size:13px;min-width:26px;height:26px;">${u===0?"✓":u}</span>`;
  renderJobTabs(); setJobTab("overview");
  window.scrollTo({top:0,behavior:"smooth"});
}
function renderJobTabs(){
  document.getElementById("jtabs").innerHTML=JOB_TABS.map(t=>
    `<button class="jtab ${t.k===currentJobTab?"active":""}" data-jt="${t.k}" onclick="setJobTab('${t.k}')">${t.l}</button>`
  ).join("");
}
function setJobTab(tab){
  currentJobTab=tab;
  document.querySelectorAll(".jtab").forEach(b=>b.classList.toggle("active",b.dataset.jt===tab));
  const c=document.getElementById("jd-content");
  const j=currentJob;
  if(tab==="overview") c.innerHTML=renderOverview(j);
  else if(tab==="budget") c.innerHTML=renderBudgetTab(j);
  else if(tab==="variations") c.innerHTML=renderVariations(j);
  else if(tab==="subcons") c.innerHTML=renderSubcons(j);
  else if(tab==="payments") c.innerHTML=renderPayments(j);
  else if(tab==="snags") c.innerHTML=renderSnags(j);
  else if(tab==="notes") c.innerHTML=renderNotes(j);
  else if(tab==="comms") c.innerHTML=renderComms(j);
  else if(tab==="docs") c.innerHTML=renderDocs(j);
}

function renderOverview(j){
  const u=unres(j);
  return`
  <div class="card">
    <p class="card-title">Department progress</p>
    ${j.depts.map(d=>`
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
          <span style="font-weight:600;display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dc(d.k).c};"></span>${dc(d.k).n}</span>
          <span style="color:${d.pct>=80?"var(--ok)":d.pct>=50?"var(--warn)":"var(--bad)"};">${d.pct}%</span>
        </div>
        <div style="background:var(--line);height:8px;border-radius:20px;overflow:hidden;"><div style="width:${d.pct}%;height:100%;background:${dc(d.k).c};border-radius:20px;"></div></div>
      </div>`).join("")}
  </div>
  ${u>0?`<div class="card">
    <p class="card-title">Alerts — ${u} unresolved</p>
    ${j.alerts.map((a,ai)=>`
      <div class="tl-item ${a.r?"":""}" style="${a.r?"opacity:.4":""}">
        <div class="tl-dot" style="background:${a.tp==="bad"?"var(--bad)":"var(--warn)"}"></div>
        <div class="tl-body"><div class="tl-t">${a.t}</div><div class="tl-s">${a.s}</div>
          ${!a.r?`<div style="margin-top:7px;"><button class="sm ok" onclick="resolveAlert('${j.id}',${ai})">Resolve ✓</button></div>`:'<div style="font-size:11px;color:var(--ok);margin-top:5px;font-weight:600;">✓ Resolved</div>'}
        </div>
      </div>`).join("")}
  </div>`:""}
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
    ${JOB_TABS.filter(t=>t.k!=="overview").map(t=>`<button class="sm info" onclick="setJobTab('${t.k}')">${t.l} →</button>`).join("")}
  </div>`;
}

function renderBudgetTab(j){
  const b=j.budget, a=j.actuals;
  const heads=[["Materials",b.mat,a.mat],["Labour",b.lab,a.lab],["Sub-contract",b.sub,a.sub],["Hiring",b.hir,a.hir],["Others",b.oth,a.oth]];
  const tb=b.mat+b.lab+b.sub+b.hir+b.oth;
  const ta=a.mat+a.lab+a.sub+a.hir+a.oth;
  return`<div class="card">
    <p class="card-title">Execution budget vs actuals</p>
    <table>
      <thead><tr><th>Cost head</th><th class="r">Budget</th><th class="r">Actual</th><th class="r">Variance</th></tr></thead>
      <tbody>${heads.map(([n,bv,av])=>{const v=bv-av;return`<tr><td>${n}</td><td class="r">${money(bv)}</td><td class="r">${money(av)}</td><td class="r" style="color:${v<0?"var(--bad)":"var(--ok)"}">${v<0?"−":""}${money(Math.abs(v))}</td></tr>`;}).join("")}</tbody>
      <tfoot><tr class="tot"><td><b>Total cost</b></td><td class="r"><b>${money(tb)}</b></td><td class="r"><b>${money(ta)}</b></td><td class="r" style="color:${tb-ta<0?"var(--bad)":"var(--ok)"}"><b>${tb-ta<0?"−":""}${money(Math.abs(tb-ta))}</b></td></tr></tfoot>
    </table>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:13px;">
      <span>Sell: <b>${money(b.sell)}</b></span>
      <span>Budget margin: <b>${((b.sell-tb)/b.sell*100).toFixed(1)}%</b></span>
      <span style="color:${b.sell-ta<b.sell-tb?"var(--bad)":"var(--ok)"}">Running margin: <b>${((b.sell-ta)/b.sell*100).toFixed(1)}%</b></span>
    </div>
  </div>`;
}

function renderVariations(j){
  const statusFlow={
    "With Estimator":{cls:"warn",icon:"⏳",step:"2",desc:"Being priced by Estimator"},
    "With Approver":{cls:"warn",icon:"🔍",step:"3",desc:"Awaiting Approver sign-off"},
    "Approved":{cls:"ok",icon:"✓",step:"4",desc:"Approved — attached to job"},
    "Rejected":{cls:"bad",icon:"✕",step:"—",desc:"Rejected — back to Sales/PM"},
  };
  const vHTML=j.variations.length?j.variations.map((v)=>{
    const sf=statusFlow[v.status]||{cls:"grey",icon:"?",step:"?",desc:v.status};
    return`<div class="var-row">
      <div class="vr-top">
        <div>
          <div class="vr-name">${v.id} — ${v.desc}</div>
          <div style="font-size:12px;color:var(--ink2);margin:3px 0 0;">${v.reason}</div>
          <div style="font-size:11px;color:var(--ink3);margin:3px 0 0;">Flow: Sales/PM raises → Estimator prices → Approver signs → attaches here</div>
        </div>
        <div style="text-align:right;">
          <span class="pill ${sf.cls}">${sf.icon} ${v.status}</span>
          <div style="font-size:12px;color:var(--ink2);margin-top:5px;">Sell ${money(v.sell||0)} · Cost ${money(v.cost||0)}</div>
          ${v.sell?`<div style="font-size:11px;color:var(--ink3);margin-top:2px;">Margin: ${v.sell?((v.sell-v.cost)/v.sell*100).toFixed(0)+"%" : "—"}</div>`:""}
        </div>
      </div>
      <div style="margin-top:10px;background:var(--bg);border-radius:var(--r3);padding:8px 10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        ${["Sales/PM raises","Estimator prices","Approver signs","Attached to job"].map((step,si)=>`
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;
            background:${si<["With Estimator","With Approver","Approved"].indexOf(v.status)+1||v.status==="Approved"&&si<=3?"var(--ok-bg)":"var(--line)"};
            color:${si<["With Estimator","With Approver","Approved"].indexOf(v.status)+1||v.status==="Approved"&&si<=3?"var(--ok)":"var(--ink3)"};">${step}</span>
          ${si<3?'<span style="font-size:10px;color:var(--ink3);">→</span>':""}`).join("")}
      </div>
    </div>`;
  }).join(""):'<p style="font-size:13px;color:var(--ink3);margin:0;">No variations on this job yet.</p>';

  const approvedVars=j.variations.filter(v=>v.status==="Approved");
  const pendingVars=j.variations.filter(v=>v.status!=="Approved"&&v.status!=="Rejected");
  const totSell=approvedVars.reduce((s,v)=>s+v.sell,0);
  const totCost=approvedVars.reduce((s,v)=>s+v.cost,0);

  return`<div class="card">
    <p class="card-title">Variation tracker — read only for Operations</p>
    <p class="card-sub">Variations are raised by <b>Sales</b> (client-driven changes) or <b>Production Managers</b> (site or scope changes). They go through the standard flow: Estimator prices → Approver signs. Operations tracks status here and sees the impact on project budget.</p>

    ${pendingVars.length?`<div style="background:var(--warn-bg);border:1px solid var(--warn-line);border-radius:var(--r2);padding:9px 12px;margin-bottom:12px;font-size:13px;color:var(--warn);font-weight:500;">⏳ ${pendingVars.length} variation${pendingVars.length>1?"s are":" is"} still in the approval flow — project budget is not final until approved.</div>`:""}

    ${vHTML}

    ${approvedVars.length?`
    <div style="background:var(--ok-bg);border:1px solid var(--ok-line);border-radius:var(--r2);padding:11px 13px;margin-top:10px;">
      <p style="font-size:12px;font-weight:700;color:var(--ok);margin-bottom:6px;">Approved variations — project impact</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;">
        <span>Original: <b>${money(j.val)}</b></span>
        <span>+ Variations: <b>${money(totSell)}</b></span>
        <span>= Combined: <b>${money(j.val+totSell)}</b></span>
        <span>Extra cost: <b>${money(totCost)}</b></span>
      </div>
    </div>`:""}

    <div style="background:var(--info-bg);border:1px solid var(--info-line);border-radius:var(--r2);padding:10px 12px;margin-top:10px;font-size:12px;color:var(--info);">
      💡 If a variation is stuck in the flow, Operations can send a reminder to the Estimator or Approver from the Reminders tab.
    </div>
  </div>`;
}

function renderSubcons(j){
  const rows=j.subcons.map((s,si)=>`
    <div class="sub-row">
      <div class="sr-top">
        <div><div class="sr-name">${s.name}</div><div class="sr-meta">${s.item} · Ordered ${s.ordered} · Expected ${s.expected}</div></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
          <span class="pill ${s.status==="received"?"ok":s.status==="overdue"?"bad":"warn"}">${s.status==="received"?"✓ Received":s.status==="overdue"?"⚠ Overdue":"⏳ Pending"}</span>
          <span class="pill ${s.paid?"ok":"grey"}">${s.paid?"Paid":"Payment pending"}</span>
        </div>
      </div>
      ${s.status==="overdue"?`<div style="margin-top:8px;display:flex;gap:6px;"><button class="sm bad" onclick="showAlert('Reminder sent to ${s.name}')">Send reminder</button><button class="sm warn" onclick="showAlert('Delay flagged to production manager')">Flag delay to PM</button></div>`:""}
    </div>`).join("")||'<p style="font-size:13px;color:var(--ink3);">No subcontractors on this job.</p>';
  return`<div class="card">
    <p class="card-title">External suppliers &amp; subcontractors</p>
    <p class="card-sub">Track what's been ordered, from whom, when it's due. A delayed sub kills your delivery date — flag it early.</p>
    ${rows}
    <div class="card" style="border-style:dashed;margin-top:12px;margin-bottom:0;">
      <p class="card-title">Add subcontractor / supplier</p>
      <div class="row3">
        <div class="field"><label>Supplier name</label><input id="sub-name" placeholder="Gulf Glass Trading"></div>
        <div class="field"><label>Item / service</label><input id="sub-item" placeholder="Glass panels"></div>
        <div class="field"><label>Expected delivery</label><input type="date" id="sub-date"></div>
      </div>
      <div class="btnrow"><button class="primary" onclick="addSubcon('${j.id}')">Add supplier</button></div>
    </div>
  </div>`;
}

function renderPayments(j){
  const pct=Math.round(j.payments.received/j.payments.invoiced*100);
  const outstanding=j.payments.invoiced-j.payments.received;
  return`<div class="card">
    <p class="card-title">Payment tracking</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:14px;">
      <div class="kpi"><p class="kl">Total invoiced</p><p class="kv">${money(j.payments.invoiced)}</p></div>
      <div class="kpi ok"><p class="kl">Received</p><p class="kv" style="color:var(--ok)">${money(j.payments.received)}</p><p class="ks">${pct}% collected</p></div>
      <div class="kpi warn"><p class="kl">Outstanding</p><p class="kv" style="color:var(--warn)">${money(outstanding)}</p></div>
    </div>
    <div class="pay-bar"><div class="pay-fill" style="width:${pct}%"></div></div>
    <p style="font-size:12px;color:var(--ink2);margin-bottom:12px;">${pct}% of project value received</p>
    ${j.payments.breakdown.map(b=>`
      <div class="tl-item">
        <div class="tl-dot" style="background:${b.st==="ok"?"var(--ok)":b.st==="warn"?"var(--warn)":"var(--line2)"}"></div>
        <div class="tl-body"><div class="tl-t">${b.l}</div><div class="tl-s">${b.n}</div></div>
        ${b.st==="warn"?`<button class="sm warn" onclick="showAlert('Invoice reminder sent to Accounts')">Chase Accounts</button>`:""}
      </div>`).join("")}
  </div>`;
}

function renderSnags(j){
  const open=j.snags.filter(s=>!s.r).length;
  const rows=j.snags.map((s,si)=>`
    <div class="snag ${s.r?"resolved":""}">
      <div class="snag-t">${s.dept} — ${s.desc}</div>
      <div class="snag-s">Assigned to: ${s.assigned}</div>
      ${!s.r?`<button class="sm ok" onclick="resolveSnag('${j.id}',${si})">Mark resolved ✓</button>`:'<span style="font-size:11px;color:var(--ok);font-weight:600;">✓ Resolved</span>'}
    </div>`).join("")||'<p style="font-size:13px;color:var(--ink3);">No snags logged.</p>';
  return`<div class="card">
    <p class="card-title">Snag list — ${open} open</p>
    <p class="card-sub">Post-delivery issues logged and tracked to resolution. Final invoice is not released until all snags are resolved.</p>
    ${rows}
    <div class="card" style="border-style:dashed;margin-top:12px;margin-bottom:0;">
      <p class="card-title">Log new snag</p>
      <div class="row2">
        <div class="field"><label>Department</label><select id="snag-dept"><option>Joinery</option><option>Curtain</option><option>Upholstery</option><option>Painting</option><option>Metal</option></select></div>
        <div class="field"><label>Assign to</label><select id="snag-assign">${STAFF.map(s=>`<option>${s}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>Description</label><input id="snag-desc" placeholder="Describe the snag…"></div>
      <div class="btnrow"><button class="primary" onclick="addSnag('${j.id}')">Log snag &amp; alert PM</button></div>
    </div>
    ${!j.signoff.done?`<div class="card" style="border-color:var(--ok-line);background:var(--ok-bg);margin-top:12px;margin-bottom:0;">
      <p class="card-title" style="color:var(--ok);">Client sign-off</p>
      <p style="font-size:13px;color:var(--ink2);margin-bottom:10px;">Client signs physical form on site. Upload a photo/scan here to record it and release the final payment milestone.</p>
      <div class="btnrow"><button class="primary" onclick="recordSignoff('${j.id}')">Record sign-off &amp; release final invoice →</button></div>
    </div>`:`<div style="background:var(--ok-bg);border:1px solid var(--ok-line);border-radius:var(--r2);padding:10px 12px;margin-top:12px;font-size:13px;color:var(--ok);font-weight:500;">✓ Client signed off ${j.signoff.date} — final invoice released to Accounts</div>`}
  </div>`;
}

function renderNotes(j){
  return`<div class="card">
    <p class="card-title">Internal notes</p>
    <p class="card-sub">Private notes for the team — not visible to the client. Capture anything that helps future jobs or avoids repeat mistakes.</p>
    ${j.notes.map(n=>`
      <div class="tl-item">
        <div class="tl-dot" style="background:var(--ink3)"></div>
        <div class="tl-body"><div class="tl-t">${n.by}</div><div class="tl-s">${n.note}</div><div class="tl-m">${n.d}</div></div>
      </div>`).join("")||'<p style="font-size:13px;color:var(--ink3);">No notes yet.</p>'}
    <div style="border-top:1px solid var(--line);margin-top:8px;padding-top:12px;">
      <textarea id="note-text" rows="2" placeholder="Add an internal note…" style="margin-bottom:8px;"></textarea>
      <div class="btnrow"><button class="primary" onclick="addNote('${j.id}')">Add note</button></div>
    </div>
  </div>`;
}

function renderComms(j){
  return`<div class="card">
    <p class="card-title">Client communication log</p>
    <p class="card-sub">Every call, visit, approval and change — timestamped. Your evidence trail if a dispute arises.</p>
    ${j.comms.map(c=>`
      <div class="tl-item">
        <div class="tl-dot" style="background:${c.c}"></div>
        <div class="tl-body"><div class="tl-t">${c.t}</div><div class="tl-s">${c.n}</div><div class="tl-m">${c.by} · ${c.d}</div></div>
      </div>`).join("")||'<p style="font-size:13px;color:var(--ink3);">No communications logged.</p>'}
    <div style="border-top:1px solid var(--line);margin-top:8px;padding-top:12px;">
      <div class="row2" style="margin-bottom:8px;">
        <div class="field"><label>Type</label><select id="comm-type"><option>Call</option><option>Site visit</option><option>Email</option><option>Client approval</option><option>Change request</option><option>WhatsApp</option></select></div>
        <div class="field"><label>By</label><select id="comm-by">${STAFF.map(s=>`<option>${s}</option>`).join("")}</select></div>
      </div>
      <textarea id="comm-notes" rows="2" placeholder="What was discussed or actioned…" style="margin-bottom:8px;"></textarea>
      <div class="btnrow"><button class="primary" onclick="addComm('${j.id}')">Add to log</button></div>
    </div>
  </div>`;
}

function renderDocs(j){
  const icons={"Signed Quote":"📄","BOQ":"📊","Client PO":"📋","Site photo":"📷","Delivery note":"🚚","Client sign-off":"✅","Other":"📁"};
  return`<div class="card">
    <p class="card-title">Document vault</p>
    <p class="card-sub">All job files in one place. Signed quote, BOQ, photos, POs, sign-offs.</p>
    ${j.docs.map(d=>`
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);">
        <div style="width:30px;height:30px;border-radius:6px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:15px;flex:none;">${d.i}</div>
        <div style="flex:1;"><div style="font-weight:600;font-size:13px;">${d.n}</div><div style="font-size:11px;color:var(--ink3);">${d.d}</div></div>
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--bg);color:var(--ink2);border:1px solid var(--line);">${d.c}</span>
      </div>`).join("")}
    <div style="border-top:1px solid var(--line);padding-top:12px;margin-top:4px;">
      <div class="row2">
        <div class="field"><label>Category</label><select id="doc-cat"><option>Signed Quote</option><option>BOQ</option><option>Client PO</option><option>Site photo</option><option>Delivery note</option><option>Client sign-off</option><option>Other</option></select></div>
        <div class="field"><label>File name</label><input id="doc-name" placeholder="filename.pdf"></div>
      </div>
      <div class="btnrow"><button class="primary" onclick="addDoc('${j.id}')">Add to vault</button></div>
    </div>
  </div>`;
}

// ══════════════════════════════
// ACTIONS
// ══════════════════════════════
function resolveAlert(id,ai){
  const p=projects.find(j=>j.id===id);
  p.alerts[ai].r=true;
  const u=unres(p);
  document.getElementById("jd-badge").innerHTML=`<span class="badge ${u===0?"zero":u<=2?"warn":""}" style="font-size:13px;min-width:26px;height:26px;">${u===0?"✓":u}</span>`;
  setJobTab("overview"); renderProjList();
}
function addVariation(id){
  const p=projects.find(j=>j.id===id);
  const desc=document.getElementById("var-desc")?.value||"Scope change";
  const reason=document.getElementById("var-reason")?.value||"Client change";
  p.variations.push({id:"VO-0"+(p.variations.length+1),desc,reason,sell:0,cost:0,status:"With Estimator"});
  showAlert("Variation sent to Estimator — you'll be alerted when priced and approved.");
  setJobTab("variations");
}
function addSubcon(id){
  const p=projects.find(j=>j.id===id);
  const name=document.getElementById("sub-name")?.value||"Supplier";
  const item=document.getElementById("sub-item")?.value||"Item";
  const date=document.getElementById("sub-date")?.value||"TBC";
  p.subcons.push({name,item,ordered:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"}),expected:date,status:"pending",paid:false});
  showAlert(name+" added as subcontractor."); setJobTab("subcons");
}
function resolveSnag(id,si){
  projects.find(j=>j.id===id).snags[si].r=true;
  setJobTab("snags"); renderProjList();
}
function addSnag(id){
  const p=projects.find(j=>j.id===id);
  const dept=document.getElementById("snag-dept")?.value||"Joinery";
  const desc=document.getElementById("snag-desc")?.value||"Issue noted";
  const assigned=document.getElementById("snag-assign")?.value||"Operations";
  p.snags.push({dept,desc,assigned,r:false});
  showAlert("Snag logged — "+assigned+" alerted."); setJobTab("snags");
}
function recordSignoff(id){
  const p=projects.find(j=>j.id===id);
  p.signoff={done:true,date:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})};
  showAlert("Sign-off recorded — final invoice triggered to Accounts."); setJobTab("snags");
}
function addNote(id){
  const p=projects.find(j=>j.id===id);
  const t=document.getElementById("note-text")?.value; if(!t) return;
  p.notes.unshift({by:"Operations",note:t,d:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"})});
  setJobTab("notes");
}
function addComm(id){
  const p=projects.find(j=>j.id===id);
  const t=document.getElementById("comm-type")?.value;
  const by=document.getElementById("comm-by")?.value;
  const n=document.getElementById("comm-notes")?.value||"No notes.";
  const cols={"Call":"var(--info)","Site visit":"var(--ok)","Email":"var(--ink2)","Client approval":"var(--ok)","Change request":"var(--bad)","WhatsApp":"#25d366"};
  p.comms.unshift({t,by,n,d:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"}),c:cols[t]||"var(--ink2)"});
  setJobTab("comms");
}
function addDoc(id){
  const p=projects.find(j=>j.id===id);
  const n=document.getElementById("doc-name")?.value||"untitled";
  const c=document.getElementById("doc-cat")?.value;
  const icons={"Signed Quote":"📄","BOQ":"📊","Client PO":"📋","Site photo":"📷","Delivery note":"🚚","Client sign-off":"✅","Other":"📁"};
  p.docs.unshift({n,c,d:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"}),i:icons[c]||"📁"});
  setJobTab("docs");
}

// ══════════════════════════════
// BOM / BUDGET
let selBomJob=null;
function money2(n){return "BD "+(parseFloat(n)||0).toFixed(3);}
function filterBom(){
  const q=document.getElementById("bom-search").value.toLowerCase();
  renderBomList(q);
}
function renderBomList(q){
  const f=q||"";
  const list=bomJobs.filter(j=>!f||j.name.toLowerCase().includes(f)||j.client.toLowerCase().includes(f)||j.id.toLowerCase().includes(f));
  document.getElementById("bom-list").innerHTML=list.map(j=>{
    const over=j.depts.filter(d=>d.status==="overdue").length;
    const pend=j.depts.filter(d=>d.status==="pending"||d.status==="delegated").length;
    const sub=j.depts.filter(d=>d.status==="submitted").length;
    return`<div class="job-pick" onclick="openBomJob('${j.id}')">
      <div><div class="pname">${j.name}</div><div class="pmeta">${j.id} · ${j.client}</div>
        <div class="ptags" style="margin-top:5px;">
          ${over?`<span class="pill bad">${over} overdue</span>`:""}
          ${pend?`<span class="pill warn">${pend} pending</span>`:""}
          ${sub===j.depts.length?`<span class="pill ok">All submitted</span>`:""}
        </div>
      </div><span style="font-size:12px;color:var(--info);">Open →</span>
    </div>`;
  }).join("")||'<p style="font-size:13px;color:var(--ink3)">No jobs found.</p>';
}
function showBomPicker(){
  document.getElementById("bom-picker").style.display="block";
  document.getElementById("bom-detail").style.display="none";
  selBomJob=null;
}
function openBomJob(id){
  selBomJob=bomJobs.find(j=>j.id===id);
  document.getElementById("bd-title").textContent=selBomJob.name;
  document.getElementById("bd-meta").textContent=selBomJob.id+" · "+selBomJob.client+" · Quote: "+money2(selBomJob.val);
  document.getElementById("bom-picker").style.display="none";
  document.getElementById("bom-detail").style.display="block";
  document.getElementById("bom-done").style.display="none";
  renderBomCards2();
  recalcBomSummary();
}
function renderBomCards2(){
  document.getElementById("bom-dept-cards").innerHTML=selBomJob.depts.map((d,di)=>{
    const stLabel=d.status==="submitted"?(d.owner==="ops"?"✏️ Filled by Ops":"✓ PM submitted"):d.status==="overdue"?"⚠ Overdue 48h+":d.owner==="delegated"&&d.delegate?"👤 Delegated → "+d.delegate.to:"⏳ Awaiting PM";
    const stCls=d.status==="submitted"?"ok":d.status==="overdue"?"bad":d.owner==="delegated"?"info":"warn";
    return`<div class="bom-card">
      <div class="bom-head">
        <div class="bom-head-l"><div class="dept-dot" style="background:${dc(d.k).c}"></div>
          <div><div style="font-weight:700;font-size:13px;">${dc(d.k).n}</div><div style="font-size:11px;color:var(--ink2);">PM: ${d.pm}</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span class="pill ${stCls}">${stLabel}</span>
          ${d.status!=="submitted"?`<button class="sm purple" onclick="toggleOpsPanel(${di})">✏️ Fill</button>`:""}
          ${d.status!=="submitted"&&d.owner!=="delegated"?`<button class="sm info" onclick="toggleDelPanel(${di})">👤 Delegate</button>`:""}
          ${d.status!=="submitted"?`<button class="sm ok" onclick="submitBomDept(${di})">✓ Submit</button>`:""}
        </div>
      </div>
      <div id="ops-panel-${di}" style="display:none;background:#faf5ff;border-top:1px dashed #c4b5fd;padding:12px 13px;">
        <p style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:8px;">✏️ Operations filling directly</p>
        <div class="row3">
          <div class="field"><label>Materials BD</label><input type="number" id="bm-${di}-mat" value="${d.bom.mat}" oninput="recalcBomSummary()"></div>
          <div class="field"><label>Labour BD</label><input type="number" id="bm-${di}-lab" value="${d.bom.lab}" oninput="recalcBomSummary()"></div>
          <div class="field"><label>Other BD</label><input type="number" id="bm-${di}-oth" value="${d.bom.oth}" oninput="recalcBomSummary()"></div>
        </div>
        <div class="btnrow"><button class="sm purple" onclick="saveOps2(${di})">Save &amp; submit ✓</button></div>
      </div>
      <div id="del-panel-${di}" style="display:none;background:var(--info-bg);border-top:1px solid var(--info-line);padding:12px 13px;">
        <p style="font-size:11px;font-weight:700;color:var(--info);margin-bottom:8px;">👤 Delegate to staff member</p>
        <div class="row3">
          <div class="field"><label>Assign to</label><select id="del-to-${di}">${STAFF.filter(s=>s!==d.pm).map(s=>`<option>${s}</option>`).join("")}</select></div>
          <div class="field"><label>Deadline</label><input id="del-dead-${di}" placeholder="Today 5pm"></div>
          <div class="field"><label>Note</label><input id="del-note-${di}" placeholder="Please fill BOM urgently"></div>
        </div>
        <div class="btnrow"><button class="sm info" onclick="sendDel2(${di})">Send + alert →</button></div>
        <div id="del-sent-${di}" style="display:none;font-size:12px;color:var(--ok);font-weight:600;margin-top:8px;"></div>
      </div>
      ${d.status==="submitted"?`<div style="padding:11px 13px;">
        <table><thead><tr><th>Materials</th><th>Labour</th><th>Other</th><th class="r">Total</th></tr></thead>
        <tbody><tr><td>${money2(d.bom.mat)}</td><td>${money2(d.bom.lab)}</td><td>${money2(d.bom.oth)}</td><td class="r"><b>${money2(d.bom.mat+d.bom.lab+d.bom.oth)}</b></td></tr></tbody></table>
      </div>`:""}
    </div>`;
  }).join("");
}
function toggleOpsPanel(di){
  const p=document.getElementById("ops-panel-"+di);
  p.style.display=p.style.display==="block"?"none":"block";
  document.getElementById("del-panel-"+di).style.display="none";
}
function toggleDelPanel(di){
  const p=document.getElementById("del-panel-"+di);
  p.style.display=p.style.display==="block"?"none":"block";
  document.getElementById("ops-panel-"+di).style.display="none";
}
function saveOps2(di){
  const d=selBomJob.depts[di];
  d.bom.mat=parseFloat(document.getElementById("bm-"+di+"-mat")?.value)||0;
  d.bom.lab=parseFloat(document.getElementById("bm-"+di+"-lab")?.value)||0;
  d.bom.oth=parseFloat(document.getElementById("bm-"+di+"-oth")?.value)||0;
  d.status="submitted"; d.owner="ops";
  renderBomCards2(); recalcBomSummary();
}
function submitBomDept(di){selBomJob.depts[di].status="submitted"; renderBomCards2(); recalcBomSummary();}
function sendDel2(di){
  const to=document.getElementById("del-to-"+di)?.value;
  const dead=document.getElementById("del-dead-"+di)?.value||"ASAP";
  selBomJob.depts[di].owner="delegated";
  selBomJob.depts[di].delegate={to,deadline:dead};
  selBomJob.depts[di].status="delegated";
  document.getElementById("del-sent-"+di).style.display="block";
  document.getElementById("del-sent-"+di).textContent="✓ Sent to "+to+" (deadline: "+dead+") — in-system + WhatsApp alert fired.";
  renderBomCards2();
}
function recalcBomSummary(){
  if(!selBomJob) return;
  let tm=0,tl=0,to=0;
  selBomJob.depts.forEach((d,di)=>{
    const mat=parseFloat(document.getElementById("bm-"+di+"-mat")?.value)||d.bom.mat;
    const lab=parseFloat(document.getElementById("bm-"+di+"-lab")?.value)||d.bom.lab;
    const oth=parseFloat(document.getElementById("bm-"+di+"-oth")?.value)||d.bom.oth;
    tm+=mat; tl+=lab; to+=oth;
  });
  const tot=tm+tl+to;
  document.getElementById("s-mat").textContent=money2(tm);
  document.getElementById("s-lab").textContent=money2(tl);
  document.getElementById("s-oth").textContent=money2(to);
  document.getElementById("s-tot").textContent=money2(tot);
  const sell=selBomJob.val;
  const margin=sell?((sell-tot)/sell*100).toFixed(1):0;
  document.getElementById("s-margin").textContent="Margin: "+margin+"%";
  const el=document.getElementById("bom-threshold");
  if(tot>5000){el.className="threshold warn";el.textContent="⚠ Total "+money2(tot)+" exceeds BD 5,000 — routes to Owner for approval.";}
  else{el.className="threshold ok";el.textContent="✓ Total "+money2(tot)+" within threshold — approves immediately. Margin: "+margin+"%.";}
  document.getElementById("bom-sum-rows").innerHTML=selBomJob.depts.map((d,di)=>{
    const mat=parseFloat(document.getElementById("bm-"+di+"-mat")?.value)||d.bom.mat;
    const lab=parseFloat(document.getElementById("bm-"+di+"-lab")?.value)||d.bom.lab;
    const oth=parseFloat(document.getElementById("bm-"+di+"-oth")?.value)||d.bom.oth;
    return`<tr><td><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dc(d.k).c};margin-right:5px;"></span>${dc(d.k).n}</td>
      <td class="r">${money2(mat)}</td><td class="r">${money2(lab)}</td><td class="r">${money2(oth)}</td><td class="r">${money2(mat+lab+oth)}</td>
      <td style="font-size:11px;color:var(--ink2);">${d.owner==="ops"?"Ops":d.owner==="delegated"?d.delegate?.to||"Delegated":d.pm}</td>
      <td><span class="pill ${d.status==="submitted"?"ok":d.status==="overdue"?"bad":"warn"}" style="font-size:10px;">${d.status}</span></td></tr>`;
  }).join("");
}
function approveBudget(){
  const tot=parseFloat(document.getElementById("s-tot").textContent.replace("BD ",""))||0;
  const el=document.getElementById("bom-done");
  el.style.display="block";
  if(tot>5000){el.style.cssText="display:block;margin-top:10px;background:var(--warn-bg);border:1px solid var(--warn-line);border-radius:var(--r2);padding:11px 13px;font-size:13px;color:var(--warn);font-weight:500;";el.textContent="⚠ Budget "+money2(tot)+" sent to Owner for approval.";}
  else{el.style.cssText="display:block;margin-top:10px;background:var(--ok-bg);border:1px solid var(--ok-line);border-radius:var(--r2);padding:11px 13px;font-size:13px;color:var(--ok);font-weight:500;";el.textContent="✓ Budget "+money2(tot)+" approved — production live. All PMs notified.";}
  el.scrollIntoView({behavior:"smooth",block:"nearest"});
}

// ══════════════════════════════
// CURTAIN BOM APPROVALS
// Separate from the BOM/Budget screen above — that screen works on the
// generic multi-division bomJobs/depts[] structure. This queue is specific
// to curtainJobs (Silva's BOM submissions from the Curtain module), which
// use their own bomStatus/budgetStatus/bomRejectionComment fields.
// ══════════════════════════════
function curtainBomTotal(job){
  if(!job.bom) return 0;
  const sum=arr=>(arr||[]).reduce((s,x)=>s+(x.actual||0),0);
  return sum(job.bom.fabric)+sum(job.bom.tracks)+sum(job.bom.motors)+sum(job.bom.accessories)+sum(job.bom.labour);
}
function curtainPendingApprovals(){
  return curtainJobs.filter(j=>j.budgetStatus==="pending");
}
function updateCurtAppBadge(){
  const badge=document.getElementById("curtapp-badge");
  if(!badge) return;
  const n=curtainPendingApprovals().length;
  badge.textContent=n;
  badge.style.display=n>0?"inline-block":"none";
}
function renderCurtainApprovals(){
  const pending=curtainPendingApprovals();
  document.getElementById("curtapp-list").innerHTML=pending.length?pending.map(j=>{
    const tot=curtainBomTotal(j);
    return`<div class="bom-card" id="curtapp-card-${j.id}">
      <div class="bom-head">
        <div class="bom-head-l"><div class="dept-dot" style="background:${dc("curt").c}"></div>
          <div><div style="font-weight:700;font-size:13px;">${j.name}</div><div style="font-size:11px;color:var(--ink2);">${j.id} · ${j.client}</div></div>
        </div>
        <span class="pill warn">⏳ Awaiting approval</span>
      </div>
      <div style="padding:11px 13px;">
        <table><thead><tr><th>BOM total (materials + labour, actuals)</th></tr></thead>
          <tbody><tr><td class="r"><b>${money2(tot)}</b></td></tr></tbody>
        </table>
        <div class="btnrow" style="margin-top:10px;">
          <button class="sm ok" onclick="approveCurtainBom('${j.id}')">✓ Approve</button>
          <button class="sm bad" onclick="toggleCurtainRejectPanel('${j.id}')">✕ Reject</button>
        </div>
        <div id="curtapp-reject-panel-${j.id}" style="display:none;background:var(--warn-bg);border-top:1px solid var(--warn-line);margin-top:10px;padding:12px 13px 13px;border-radius:0 0 var(--r2) var(--r2);">
          <div class="field"><label>Reason (required — Silva will see this)</label><textarea id="curtapp-reject-note-${j.id}" rows="2" placeholder="e.g. Track budget over estimate on Living Room window — check rail spec"></textarea></div>
          <div class="btnrow"><button class="sm bad" onclick="rejectCurtainBom('${j.id}')">Send back to Silva →</button></div>
        </div>
      </div>
    </div>`;
  }).join(""):'<p style="font-size:13px;color:var(--ink3);">No curtain BOMs awaiting approval right now.</p>';
  updateCurtAppBadge();
}
function toggleCurtainRejectPanel(id){
  const p=document.getElementById("curtapp-reject-panel-"+id);
  if(p) p.style.display=p.style.display==="block"?"none":"block";
}
function approveCurtainBom(id){
  const job=curtainJobs.find(j=>j.id===id);
  if(!job) return;
  job.budgetStatus="approved";
  job.bomStatus="approved";
  renderCurtainApprovals();
}
function rejectCurtainBom(id){
  const note=(document.getElementById("curtapp-reject-note-"+id)?.value||"").trim();
  if(!note){ showAlert("Please enter a reason before sending back — Silva needs to know what to fix."); return; }
  const job=curtainJobs.find(j=>j.id===id);
  if(!job) return;
  job.budgetStatus="rejected";
  job.bomStatus="bom_pending";
  job.bomRejectionComment=note;
  renderCurtainApprovals();
}

// ══════════════════════════════
function renderChecklist(){
  const done=checks.filter(c=>c.done).length;
  document.getElementById("checklist").innerHTML=checks.map((c,i)=>`
    <div class="check-row">
      <input type="checkbox" ${c.done?"checked":""} onchange="toggleCheck(${i})" style="accent-color:var(--ok);">
      <div style="flex:1;"><div style="font-weight:600;${c.done?"text-decoration:line-through;color:var(--ink3);":""}">${c.l}</div><div style="font-size:11px;color:var(--ink3);">${c.n}</div></div>
      <span class="pill ${c.done?"ok":"warn"}" style="font-size:10px;">${c.done?"✓":"Pending"}</span>
    </div>`).join("");
  document.getElementById("check-prog").innerHTML=`${done}/${checks.length} `+(done===checks.length?'<span class="pill ok">✓ Ready to dispatch</span>':'<span class="pill warn">Not ready yet</span>');
  const btn=document.getElementById("dispatch-btn");
  if(btn){btn.disabled=done<checks.length;btn.style.opacity=done<checks.length?".5":"1";}
}
function toggleCheck(i){checks[i].done=!checks[i].done;renderChecklist();}
function confirmDispatch(){document.getElementById("dispatch-done").style.display="block";}
renderChecklist();

// ══════════════════════════════
// CAPACITY
// ══════════════════════════════
// weeks[], cap[], hstyles[], hl[] are declared once in data.js (loaded before
// this file) — reused here, not redeclared, to avoid a global const collision.
function buildHeat(){
  const g=document.getElementById("heat-grid");
  let h=`<div style="font-size:10px;color:var(--ink2);padding:3px 0;"></div>`+weeks.map(w=>`<div style="font-size:9px;font-weight:700;color:var(--ink2);text-align:center;padding:3px 1px;">${w}</div>`).join("");
  cap.forEach(d=>{
    h+=`<div style="font-size:10px;font-weight:700;display:flex;align-items:center;padding:2px 3px;">${d.n}</div>`;
    d.l.forEach(l=>{h+=`<div class="heat-cell" style="${hstyles[l]};border-radius:4px;padding:7px 2px;text-align:center;font-weight:700;font-size:9px;">${hl[l]}</div>`;});
  });
  g.innerHTML=h;
}
buildHeat();

// ══════════════════════════════
// REMINDERS LOG
// No persistent reminders log exists yet — "Send reminder" buttons on
// Subcontractors/Payments/Variations currently fire a toast via showAlert()
// only; nothing is recorded. This stub renders an honest empty state so the
// tab doesn't crash. Wire to a real reminders[] array in data.js as its own
// task when ready.
// ══════════════════════════════
function renderReminders(){
  const box = document.getElementById('rem-list');
  if (!box) return;
  box.innerHTML = '<p style="font-size:13px;color:var(--ink3);">No reminders log wired up yet — "Send reminder" actions currently show a confirmation toast only, nothing is recorded here.</p>';
}

// ══════════════════════════════
// NAV
// ══════════════════════════════
function opsGoTo(p){
  document.querySelectorAll("#ops-module-wrap .page").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll("#ops-module-wrap .ntab").forEach(x=>x.classList.remove("active"));
  document.getElementById("p-"+p).classList.add("active");
  document.querySelector("[data-p="+p+"]").classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
  if(p==="bom"){ renderBomList(""); }
  if(p==="curtapp"){ renderCurtainApprovals(); }
  if(p==="projects"){ renderProjList(); }
  if(p==="reminders"){ renderReminders(); }
}

// init
renderProjList();
updateCurtAppBadge();
