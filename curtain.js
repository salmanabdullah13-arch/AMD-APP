// ═══════════════════════════════════════
// AL MARAYA — curtain.js
// Curtain & Blinds Module
// Production Manager: Silva (Selvaraj)
// ═══════════════════════════════════════
// WORKFLOW:
//   Q-Pro (Sales) → Confirmed Job → Ops Manager assigns to Silva
//   Silva receives window list READ-ONLY — fills calc sheet per window
//   BOM auto-generated → submitted to Ops Manager for budget approval
//   Ops Manager approves → Workshop starts → Fabric sourced → Install

// ── Rail types ──────────────────────────
// SUPERSEDED 3 Jul 2026: the old hardcoded list here was dead code (never
// referenced) — the calc sheet's rail-type dropdown is now built dynamically
// from `trackStock` (data.js) at open time, see openCalcSheet(). trackStock
// is the single source of truth for real rail/track products and their
// live warehouse quantities.

// ── Motor models (predefined) ──────────
const MOTOR_MODELS = [
  'Somfy RS100',
  'Somfy Glydea 60 RTS',
  'Somfy Glydea 35 WT',
  'Somfy 35 RTS with DCT',
  'Somfy 60 RTS with DCT',
  'Other',
];

const STITCH_TEAM = ['Waseem', 'Aslam', 'Rijwan', 'Ibrahim'];
const TRACK_TEAM  = ['Abdullah', 'Prince'];
const INSTALL_CREW = ['Shibu', 'Sohail', 'Mushraf', 'Furqan', 'Shahzad', 'Saeed'];

// ── State ──────────────────────────────
let curtCurrentJob   = null;
let curtCurrentPage  = 'curt-dashboard';
let roomCollapsed    = {};
let calcSheetWinId   = null;
let copyCalcSourceId = null;

// ── Module entry ───────────────────────
function openCurtainModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');

  const mod = document.getElementById('curt-module-wrap');
  mod.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:#f7f9fc;';

  curtGoTo('curt-dashboard');
  renderCurtDashboard();
}

// ── Navigation ─────────────────────────
function curtGoTo(pageId) {
  document.querySelectorAll('#curt-nav .ntab').forEach(t => {
    t.classList.toggle('active', t.dataset.p === pageId);
  });
  document.querySelectorAll('#curt-module-wrap .page').forEach(p => {
    p.classList.toggle('active', p.id === 'p-' + pageId);
  });
  curtCurrentPage = pageId;

  if (pageId === 'curt-dashboard') renderCurtDashboard();
  if (pageId === 'curt-jobs')      renderCurtJobs();
  if (pageId === 'curt-windows')   showCurtWinPicker();
  if (pageId === 'curt-bom')       showCurtBomPicker();
  if (pageId === 'curt-workshop')  renderCurtWorkshop();
  if (pageId === 'curt-fabric')    renderCurtFabric();
  if (pageId === 'curt-install')   renderCurtInstall();
}

// ── Helpers ────────────────────────────
function bd(n) {
  return 'BD ' + Number(n).toLocaleString('en-BH', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function totalWindowQty(job) {
  return job.windows.reduce((s, w) => s + (w.qty || 1), 0);
}

function treatmentLabel(t) {
  return { curtain:'Curtain', roller:'Roller Blind', roman:'Roman Blind',
           motorized:'Motorized', japanese:'Japanese Blind',
           wooden:'Wooden Blind', zebra:'Zebra Blind', blackout:'Blackout Curtain' }[t] || t;
}

function fabricLabel(f) {
  return { main:'Main Fabric', sheer:'Sheer', blackout:'Blackout',
           lining:'Lining', show:'Show Curtain' }[f] || f;
}

function statusPill(s) {
  const map = {
    bom_pending:    ['warn',   'BOM Pending'],
    submitted:      ['info',   'BOM Submitted'],
    budget_pending: ['warn',   'Awaiting Budget'],
    budget_approved:['ok',     'Budget Approved'],
    approved:       ['ok',     'Approved'],
    execution:      ['purple', 'In Execution'],
    complete:       ['ok',     'Complete'],
    pending:        ['grey',   'Pending'],
    received:       ['ok',     'Received'],
    overdue:        ['bad',    'Overdue'],
    calc_pending:   ['warn',   'Calc Pending'],
    calc_done:      ['ok',     'Calc Done'],
    cutting:        ['warn',   'Cutting'],
    stitching:      ['purple', 'Stitching'],
    assembly:       ['purple', 'Assembly'],
    track_making:   ['purple', 'Track Making'],
    motor_fit:      ['purple', 'Motor Fit'],
    qc:             ['info',   'QC'],
    hoist_qc:       ['info',   'Hoist QC'],
    rework:         ['bad',    'Rework'],
    ready:          ['ok',     'Ready'],
    installed:      ['ok',     'Installed'],
    in_production:  ['purple', 'In Production'],
    scheduled:      ['info',   'Scheduled'],
    in_progress:    ['purple', 'In Progress'],
    handover:       ['ok',     'Handover'],
  };
  const [cls, lbl] = map[s] || ['grey', s];
  return `<span class="pill ${cls}">${lbl}</span>`;
}

function varBadge(pct) {
  const v = parseFloat(pct);
  if (v > 15) return `<span class="pill bad">+${v}% 🔴</span>`;
  if (v > 10) return `<span class="pill warn">+${v}% 🟠</span>`;
  if (v > 5)  return `<span class="pill warn">+${v}% 🟡</span>`;
  if (v < 0)  return `<span class="pill ok">${v}%</span>`;
  return `<span class="pill grey">${v}%</span>`;
}

// ── Date helpers ───────────────────────
function addDays(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-BH', { day: 'numeric', month: 'short' });
}

// ── calcFabricWithHems ─────────────────
function calcFabricWithHems(w) {
  const topHem    = parseFloat(w.topHem)    || 0;
  const bottomHem = parseFloat(w.bottomHem) || 0;
  const sideHem   = parseFloat(w.sideHem)   || 0;
  const fullness    = parseFloat(w.fullness)      || 2.0;
  const rollWidth   = parseFloat(w.rollWidth)     || 137;
  const repV        = parseFloat(w.patternRepeatV) || 0;
  const repH        = parseFloat(w.patternRepeatH) || 0;
  const wastage     = parseFloat(w.wastageBuffer)  || 10;
  const overhang    = parseFloat(w.overhang)       || 0;
  const trackLength = parseFloat(w.trackLength) || (w.width + overhang * 2);
  const cutWidth  = (w.width * fullness) + (sideHem * 2) + (repH > 0 ? repH : 0);
  const cutHeight = w.height + topHem + bottomHem + (repV > 0 ? repV : 0);
  const widthsNeeded = Math.ceil(cutWidth / rollWidth);
  const rawMetres = (widthsNeeded * cutHeight) / 100;
  const totalMetres = parseFloat((rawMetres * (1 + wastage / 100)).toFixed(2));
  return {
    cutWidth: Math.round(cutWidth), cutHeight: Math.round(cutHeight),
    widthsNeeded, trackLength: Math.round(trackLength), totalMetres,
    topHem, bottomHem, sideHem,
  };
}

// ══════════════════════════════════════════
// GANTT ENGINE
// ══════════════════════════════════════════

function getGanttWeeks(numWeeks) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay()); // start of this week (Sunday)
  const weeks = [];
  for (let i = 0; i < numWeeks; i++) {
    const wStart = new Date(start);
    wStart.setDate(start.getDate() + i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wStart.getDate() + 6);
    weeks.push({
      label: wStart.toLocaleDateString('en-BH', { day:'numeric', month:'short' }),
      start: wStart,
      end: wEnd,
    });
  }
  return weeks;
}

function dateToGanttPct(dateStr, weeks) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const totalStart = weeks[0].start;
  const totalEnd   = weeks[weeks.length - 1].end;
  const totalMs    = totalEnd - totalStart;
  const offset     = d - totalStart;
  return Math.min(100, Math.max(0, (offset / totalMs) * 100));
}

function buildJobGanttData(job) {
  // Build stage timeline from workshop + install data
  const ws = job.workshop || {};
  const inst = job.installation || {};
  const stages = [];

  // Stitching stage
  if (ws.stitching) {
    stages.push({
      label: 'Stitching',
      start: ws.stitching.startDate || null,
      end:   ws.stitching.targetDate || null,
      status: ws.stitching.stage || 'pending',
      color: stageColor(ws.stitching.stage || 'pending'),
    });
  }

  // Track making stage
  if (ws.trackMaking) {
    stages.push({
      label: 'Track Making',
      start: ws.trackMaking.startDate || null,
      end:   ws.trackMaking.targetDate || null,
      status: ws.trackMaking.status || 'pending',
      color: stageColor(ws.trackMaking.status || 'pending'),
    });
  }

  // Install stage
  if (inst.scheduledDate) {
    stages.push({
      label: 'Installation',
      start: inst.scheduledDate,
      end:   addDays(inst.scheduledDate, 1),
      status: inst.status || 'scheduled',
      color: stageColor(inst.status || 'scheduled'),
    });
  }

  return stages;
}

function stageColor(status) {
  const map = {
    pending:      '#94a3b8',
    cutting:      '#f59e0b',
    stitching:    '#8b5cf6',
    qc:           '#3b82f6',
    ready:        '#10b981',
    in_production:'#8b5cf6',
    scheduled:    '#3b82f6',
    in_progress:  '#8b5cf6',
    complete:     '#10b981',
  };
  return map[status] || '#94a3b8';
}

// ── Full Gantt renderer (Workshop tab) ──
function renderGanttFull(containerId, numWeeks) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const weeks = getGanttWeeks(numWeeks || 5);
  const today = new Date(); today.setHours(0,0,0,0);
  const totalStart = weeks[0].start;
  const totalEnd   = weeks[weeks.length-1].end;
  const totalMs    = totalEnd - totalStart;
  const todayPct   = Math.min(100, Math.max(0, ((today - totalStart) / totalMs) * 100));

  let html = `<div class="gantt-wrap">`;

  // Header row
  html += `<div class="gantt-header">
    <div class="gantt-label-col"></div>
    <div class="gantt-track-col">
      ${weeks.map(w => `<div class="gantt-week-label">${w.label}</div>`).join('')}
    </div>
  </div>`;

  // Job rows
  curtainJobs.forEach(job => {
    const stages = buildJobGanttData(job);
    const rowCount = Math.max(1, stages.length);

    html += `<div class="gantt-job-block">
      <div class="gantt-job-name">${job.name}</div>`;

    if (stages.length === 0) {
      html += `<div class="gantt-row">
        <div class="gantt-label-col"><span style="font-size:11px;color:var(--ink2);">No schedule yet</span></div>
        <div class="gantt-track-col" style="position:relative;">
          <div class="gantt-today" style="left:${todayPct}%"></div>
          ${weeks.map(() => `<div class="gantt-cell"></div>`).join('')}
        </div>
      </div>`;
    } else {
      stages.forEach(stage => {
        const startPct = dateToGanttPct(stage.start, weeks);
        const endPct   = dateToGanttPct(stage.end,   weeks);
        const width    = (startPct !== null && endPct !== null) ? Math.max(1, endPct - startPct) : 0;

        html += `<div class="gantt-row">
          <div class="gantt-label-col">
            <span class="gantt-stage-label">${stage.label}</span>
          </div>
          <div class="gantt-track-col" style="position:relative;">
            <div class="gantt-today" style="left:${todayPct}%"></div>
            ${weeks.map(() => `<div class="gantt-cell"></div>`).join('')}
            ${startPct !== null ? `
            <div class="gantt-bar" style="
              left:${startPct}%;
              width:${width}%;
              background:${stage.color};
              min-width:${width > 0 ? '0' : '6px'};
            " title="${stage.label}: ${fmtDate(stage.start)} → ${fmtDate(stage.end)}">
              <span class="gantt-bar-label">${stage.label}</span>
            </div>` : ''}
          </div>
        </div>`;
      });
    }
    html += `</div>`;
  });

  html += `</div>`;

  // Legend
  html += `<div class="gantt-legend">
    <span><i style="background:#94a3b8"></i>Pending</span>
    <span><i style="background:#f59e0b"></i>Cutting</span>
    <span><i style="background:#8b5cf6"></i>Stitching / In Prod</span>
    <span><i style="background:#3b82f6"></i>QC / Scheduled</span>
    <span><i style="background:#10b981"></i>Ready / Complete</span>
    <span class="gantt-legend-today"><i style="background:#ef4444;width:2px;height:12px;border-radius:1px;"></i>Today</span>
  </div>`;

  el.innerHTML = html;
}

// ── Mini Gantt renderer (Dashboard) ────
function renderGanttMini(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const weeks = getGanttWeeks(5);
  const today = new Date(); today.setHours(0,0,0,0);
  const totalStart = weeks[0].start;
  const totalEnd   = weeks[weeks.length-1].end;
  const totalMs    = totalEnd - totalStart;
  const todayPct   = Math.min(100, Math.max(0, ((today - totalStart) / totalMs) * 100));

  let html = `<div class="gantt-mini-wrap">`;

  // Week labels
  html += `<div class="gantt-mini-header">
    <div style="width:90px;flex:none;"></div>
    <div style="flex:1;display:flex;">
      ${weeks.map(w => `<div style="flex:1;font-size:9px;color:var(--ink2);text-align:center;">${w.label}</div>`).join('')}
    </div>
  </div>`;

  curtainJobs.forEach(job => {
    const stages = buildJobGanttData(job);
    // For mini: show all stages collapsed into one row with multiple bars
    html += `<div class="gantt-mini-row">
      <div class="gantt-mini-label">${job.name.length > 14 ? job.name.slice(0,13)+'…' : job.name}</div>
      <div style="flex:1;position:relative;height:20px;">
        <div class="gantt-today" style="left:${todayPct}%;height:20px;"></div>
        <div style="position:absolute;inset:0;display:flex;">
          ${weeks.map(() => `<div style="flex:1;border-right:1px solid var(--line);"></div>`).join('')}
        </div>
        ${stages.map(stage => {
          const sp = dateToGanttPct(stage.start, weeks);
          const ep = dateToGanttPct(stage.end,   weeks);
          if (sp === null) return '';
          const w2 = Math.max(1.5, (ep||sp+2) - sp);
          return `<div style="
            position:absolute;top:4px;height:12px;border-radius:3px;
            left:${sp}%;width:${w2}%;
            background:${stage.color};opacity:.9;
          " title="${stage.label}"></div>`;
        }).join('')}
        ${stages.length === 0 ? `<div style="position:absolute;top:7px;left:4px;font-size:10px;color:var(--ink2);">Not scheduled</div>` : ''}
      </div>
    </div>`;
  });

  html += `</div>`;
  el.innerHTML = html;
}


// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════

function renderCurtDashboard() {
  const kpis = getCurtainKPIs();

  document.getElementById('curt-kpis').innerHTML = `
    <p class="kpi-row-label">BOM &amp; materials</p>
    <div class="kpis">
      <div class="kpi ${kpis.awaitingBOM>0?'warn':''}">
        <p class="kl">Awaiting BOM</p>
        <p class="kv" style="color:${kpis.awaitingBOM>0?'var(--warn)':'var(--ink)'}">${kpis.awaitingBOM}</p>
        <p class="ks">not yet submitted</p>
      </div>
      <div class="kpi ${kpis.awaitingBudget>0?'warn':''}">
        <p class="kl">Budget pending</p>
        <p class="kv" style="color:${kpis.awaitingBudget>0?'var(--warn)':'var(--ink)'}">${kpis.awaitingBudget}</p>
        <p class="ks">awaiting Ops approval</p>
      </div>
      <div class="kpi ${kpis.materialOverage>0?'warn':'ok'}">
        <p class="kl">Material overage</p>
        <p class="kv" style="color:${kpis.materialOverage>0?'var(--warn)':'var(--ok)'}">${kpis.materialOverage}</p>
        <p class="ks">jobs over quote estimate</p>
      </div>
      <div class="kpi ${kpis.fabricOrdersPending>0?'warn':''}">
        <p class="kl">Fabric orders</p>
        <p class="kv" style="color:${kpis.fabricOrdersPending>0?'var(--warn)':'var(--ink)'}">${kpis.fabricOrdersPending}</p>
        <p class="ks">pending delivery</p>
      </div>
      <div class="kpi ${kpis.fabricArrivedAwaitingReceipt>0?'bad':''}">
        <p class="kl">Arrived, unreceived</p>
        <p class="kv" style="color:${kpis.fabricArrivedAwaitingReceipt>0?'var(--bad)':'var(--ink)'}">${kpis.fabricArrivedAwaitingReceipt}</p>
        <p class="ks">in Bahrain, awaiting handover</p>
      </div>
    </div>

    <p class="kpi-row-label">Jobs &amp; items</p>
    <div class="kpis">
      <div class="kpi">
        <p class="kl">Running jobs</p>
        <p class="kv" style="color:var(--purple)">${kpis.totalRunningJobs}</p>
        <p class="ks">active this period</p>
      </div>
      <div class="kpi">
        <p class="kl">Items to produce</p>
        <p class="kv" style="color:var(--purple)">${kpis.totalItemsToProduce}</p>
        <p class="ks">windows across all jobs</p>
      </div>
    </div>

    <p class="kpi-row-label">Work in progress</p>
    <div class="kpis">
      <div class="kpi">
        <p class="kl">In production</p>
        <p class="kv">${kpis.productionInProgress}</p>
        <p class="ks">jobs active</p>
      </div>
      <div class="kpi ${kpis.installationPending>0?'warn':''}">
        <p class="kl">Installation</p>
        <p class="kv" style="color:${kpis.installationPending>0?'var(--warn)':'var(--ink)'}">${kpis.installationPending}</p>
        <p class="ks">pending scheduling</p>
      </div>
    </div>`;

  let alertsHtml = '';
  curtainJobs.forEach(job => {
    const alerts = getCurtainMaterialAlerts(job);
    alerts.forEach(a => {
      alertsHtml += `
        <div class="alert-bar warn">
          <div>
            <span style="font-weight:700;">${job.name}</span>
            <span style="color:var(--ink2);font-size:12px;margin-left:6px;">${a.cat} — ${a.windowLabel}</span>
          </div>
          <div class="av">${a.actual}${a.unit} vs ${a.estimated}${a.unit} est. &nbsp;(+${a.overBy}${a.unit})</div>
        </div>`;
    });
  });
  document.getElementById('curt-budget-alerts').innerHTML =
    alertsHtml || '<p style="font-size:13px;color:var(--ok);font-weight:500;">✓ All categories within budget</p>';

  document.getElementById('curt-active-jobs').innerHTML = curtainJobs.map(job => {
    const pending = job.windows.filter(w => !w.calcDone).length;
    return `
      <div class="job-pick" onclick="curtOpenJobFromDash('${job.id}')">
        <div>
          <p class="jp-name">${job.name}</p>
          <p class="jp-meta">${job.id} · ${job.client} · ${totalWindowQty(job)} windows</p>
          ${pending > 0 ? `<p class="jp-meta" style="color:var(--warn);margin-top:3px;">⚠ ${pending} window${pending>1?'s':''} awaiting calc sheet</p>` : ''}
        </div>
        ${statusPill(job.status)}
      </div>`;
  }).join('');

  // Mini Gantt on dashboard
  renderGanttMini('curt-dash-gantt');
}

function curtOpenJobFromDash(jobId) {
  curtCurrentJob = curtainJobs.find(j => j.id === jobId);
  curtGoTo('curt-windows');
  openCurtWinDetail(jobId);
}

// ── Jobs list ──────────────────────────
function renderCurtJobs() {
  document.getElementById('curt-jobs-list').innerHTML = curtainJobs.map(job => {
    const materialAlerts = getCurtainMaterialAlerts(job);
    const pending = job.windows.filter(w => !w.calcDone).length;
    return `
      <div class="job-pick" onclick="curtOpenJob('${job.id}')">
        <div>
          <p class="jp-name">${job.name}</p>
          <p class="jp-meta">${job.id} · ${job.client}</p>
          <div style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap;">
            ${statusPill(job.status)}
            ${materialAlerts.length > 0 ? `<span class="pill warn">⚠ ${materialAlerts.length} material overage${materialAlerts.length>1?'s':''}</span>` : ''}
            <span class="pill grey">${totalWindowQty(job)} windows</span>
            ${pending > 0 ? `<span class="pill warn">${pending} calc pending</span>` : '<span class="pill ok">All calcs done</span>'}
          </div>
        </div>
        <span style="font-size:18px;color:var(--line2);">›</span>
      </div>`;
  }).join('') || '<p style="font-size:13px;color:var(--ink2);">No curtain jobs yet.</p>';
}

function curtOpenJob(jobId) {
  curtCurrentJob = curtainJobs.find(j => j.id === jobId);
  curtGoTo('curt-windows');
  openCurtWinDetail(jobId);
}

// ── Window Schedule — Picker ───────────
function showCurtWinPicker() {
  document.getElementById('curt-win-picker').style.display = 'block';
  document.getElementById('curt-win-detail').style.display = 'none';
  closeCalcSheet();
  closeCopyCalcPanel();
  document.getElementById('curt-win-job-list').innerHTML = curtainJobs.map(job => `
    <div class="job-pick" onclick="openCurtWinDetail('${job.id}')">
      <div>
        <p class="jp-name">${job.name}</p>
        <p class="jp-meta">${job.id} · ${job.client} · ${totalWindowQty(job)} windows</p>
      </div>
      ${statusPill(job.status)}
    </div>`).join('');
}

// ── Window Schedule — Detail ───────────
function openCurtWinDetail(jobId) {
  curtCurrentJob = curtainJobs.find(j => j.id === jobId);
  if (!curtCurrentJob) return;
  document.getElementById('curt-win-picker').style.display = 'none';
  document.getElementById('curt-win-detail').style.display = 'block';
  closeCalcSheet();
  closeCopyCalcPanel();
  document.getElementById('cw-job-name').textContent = curtCurrentJob.name;
  document.getElementById('cw-job-meta').textContent =
    `${curtCurrentJob.id} · ${curtCurrentJob.client}`;
  document.getElementById('cw-wastage').value = curtCurrentJob.wastageBuffer;
  renderWindowSchedule();
}

function renderWindowSchedule() {
  if (!curtCurrentJob) return;
  curtCurrentJob.windows.forEach(w => {
    w.wastageBuffer = curtCurrentJob.wastageBuffer;
    if (w.calcDone) w.calc = calcFabricWithHems(w);
  });
  renderFabricTotals();
  renderRooms();
}

// ── Fabric + track totals summary ──────
function renderFabricTotals() {
  const job = curtCurrentJob;
  const fabricTotals = {};
  let motorCount = 0;
  let motorBrands = {};
  const trackByType = {};

  job.windows.forEach(w => {
    if (!w.calc || !w.calcDone) return;
    const key = fabricLabel(w.fabricType);
    fabricTotals[key] = (fabricTotals[key] || 0) + w.calc.totalMetres;
    const tType = w.railType || (w.motorized ? 'Motorised Rail (Somfy)' : 'Manual Track');
    const tLen = w.calc.trackLength ? (w.calc.trackLength / 100).toFixed(2) : 0;
    trackByType[tType] = trackByType[tType] || { count: 0, totalM: 0 };
    trackByType[tType].count++;
    trackByType[tType].totalM = parseFloat((trackByType[tType].totalM + parseFloat(tLen)).toFixed(2));
    if (w.motorized) {
      motorCount++;
      const brand = (w.motorBrand || 'somfy');
      motorBrands[brand] = (motorBrands[brand] || 0) + 1;
    }
  });

  const calcDoneCount = job.windows.filter(w => w.calcDone).length;
  const totalWindows  = job.windows.length;
  const pendingCount  = totalWindows - calcDoneCount;

  document.getElementById('cw-fabric-totals').innerHTML =
    Object.entries(fabricTotals).map(([label, metres]) => `
      <div class="fabric-tile">
        <p class="ft-label">${label}</p>
        <p class="ft-value">${metres.toFixed(2)} m</p>
        <p class="ft-sub">incl. ${job.wastageBuffer}% wastage</p>
      </div>`).join('') ||
    `<p style="font-size:13px;color:var(--ink2);">
      ${pendingCount > 0 ? `${pendingCount} window${pendingCount>1?'s':''} awaiting calc sheet — totals will appear here.` : 'No windows in this job.'}
    </p>`;

  document.getElementById('cw-track-totals').innerHTML =
    Object.entries(trackByType).map(([type, data]) =>
      `<div class="track-chip">${type}: ${data.count} × (${data.totalM} m total)</div>`
    ).join('');

  const motorDiv = document.getElementById('cw-motor-flag');
  if (motorCount > 0) {
    motorDiv.style.display = 'block';
    const brandList = Object.entries(motorBrands)
      .map(([b, c]) => `${c} × ${b.charAt(0).toUpperCase()+b.slice(1)}`).join(', ');
    document.getElementById('cw-motor-text').textContent =
      `⚡ ${motorCount} motorized window${motorCount>1?'s':''} — ${brandList}`;
  } else {
    motorDiv.style.display = 'none';
  }

  const pct = totalWindows > 0 ? Math.round((calcDoneCount / totalWindows) * 100) : 0;
  const progEl = document.getElementById('cw-calc-progress');
  if (progEl) {
    progEl.innerHTML = totalWindows > 0 ? `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="flex:1;background:var(--line);border-radius:4px;height:6px;">
          <div style="width:${pct}%;background:${pct===100?'var(--ok)':'var(--warn)'};height:6px;border-radius:4px;transition:width .3s;"></div>
        </div>
        <span style="font-size:12px;color:${pct===100?'var(--ok)':'var(--warn)'};font-weight:600;white-space:nowrap;">
          ${calcDoneCount}/${totalWindows} calc sheets done
        </span>
      </div>` : '';
  }
}

// ── Room accordion ─────────────────────
function renderRooms() {
  const rooms = getWindowsByRoom(curtCurrentJob);
  let html = '';
  Object.entries(rooms).forEach(([roomName, windows]) => {
    const isCollapsed = roomCollapsed[roomName] === true;
    const totalM      = windows.filter(w => w.calcDone).reduce((s, w) => s + (w.calc ? w.calc.totalMetres : 0), 0);
    const motorCount  = windows.filter(w => w.motorized).length;
    const doneCount   = windows.filter(w => w.calcDone).length;
    html += `
      <div class="room-block" id="room-${roomName.replace(/\s/g,'_')}">
        <div class="room-header" onclick="toggleRoom('${roomName}')">
          <div>
            <p class="room-title">📐 ${roomName}</p>
            <p class="room-meta">
              ${windows.length} window${windows.length>1?'s':''}
              ${totalM > 0 ? ` · ${totalM.toFixed(2)} m fabric` : ''}
              ${motorCount > 0 ? ` · ⚡ ${motorCount} motor` : ''}
              · <span style="color:${doneCount===windows.length?'var(--ok)':'var(--warn)'}">
                  ${doneCount}/${windows.length} calcs done
                </span>
            </p>
          </div>
          <span class="room-toggle">${isCollapsed ? '▼' : '▲'}</span>
        </div>
        <div class="room-body ${isCollapsed ? 'collapsed' : ''}" id="rb-${roomName.replace(/\s/g,'_')}">
          ${windows.map(w => renderWindowRow(w)).join('')}
        </div>
      </div>`;
  });
  document.getElementById('cw-rooms').innerHTML = html ||
    '<p style="font-size:13px;color:var(--ink2);padding:12px 0;">No windows assigned to this job yet.</p>';
}

function renderWindowRow(w) {
  const done = w.calcDone && w.calc;
  const c    = w.calc;
  const pi   = getInquiryForWindow(w.id);
  let fabricBadge = '';
  if (pi) {
    if (piIsDone(pi)) fabricBadge = '<span class="pill ok" style="font-size:10px;">✓ Fabric in-house</span>';
    else if (pi.stage === 'arrived_bahrain') fabricBadge = '<span class="pill warn" style="font-size:10px;">📦 Arrived — awaiting handover</span>';
    else fabricBadge = `<span class="pill grey" style="font-size:10px;">⏳ Fabric ${fmtETA(pi.eta)}</span>`;
  } else if (w.fabricType) {
    fabricBadge = '<span class="pill warn" style="font-size:10px;">Fabric not ordered</span>';
  }
  return `
    <div class="win-row ${done ? '' : 'win-pending'}" id="wr-${w.id}">
      <div class="win-left">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap;">
          <p class="win-label">${w.label}</p>
          ${done ? '<span class="pill ok" style="font-size:10px;">✓ Calc done</span>' : '<span class="pill warn" style="font-size:10px;">Calc needed</span>'}
          ${fabricBadge}
        </div>
        <p class="win-spec">
          ${w.width} × ${w.height} cm
          · ${treatmentLabel(w.treatment)}
          ${w.fabricCode ? ` · ${w.fabricCode}` : ''}
          ${w.designType  ? ` · ${w.designType}`  : ''}
        </p>
        ${done ? `
        <p class="win-calc">
          Cut: ${c.cutWidth} × ${c.cutHeight} cm
          · ${c.widthsNeeded} width${c.widthsNeeded>1?'s':''}
          · ${c.totalMetres} m fabric
          · Track ${(c.trackLength/100).toFixed(2)} m
        </p>
        <p class="win-calc" style="color:var(--ink2);">
          ${w.railType || '—'}
          ${w.motorized ? ` · ⚡ ${(w.motorBrand||'Somfy').charAt(0).toUpperCase()+(w.motorBrand||'somfy').slice(1)}` : ''}
          · Hems: T${c.topHem} B${c.bottomHem} S${c.sideHem} cm
        </p>
        <p class="win-calc" style="color:var(--purple);font-size:11px;">
          ${w.openingDirection ? OPENING_DIRECTIONS[w.openingDirection] || w.openingDirection : ''}
          ${w.bracketType ? ' · ' + w.bracketType : ''}
          ${w.cordType    ? ' · ' + w.cordType + (w.cordLength ? ' ' + w.cordLength + 'cm' : '') + (w.cordSide ? ' (' + w.cordSide + ')' : '') : ''}
        </p>` : ''}
      </div>
      <div class="win-actions" style="display:flex;flex-direction:column;gap:6px;">
        <button class="${done ? 'copy' : 'primary'}" style="font-size:12px;white-space:nowrap;"
          onclick="openCalcSheet('${w.id}')">
          ${done ? 'Edit calc' : 'Open calc →'}
        </button>
        ${done ? `
        <button class="sec" style="font-size:12px;white-space:nowrap;"
          onclick="openCopyCalcPicker('${w.id}')">
          Copy to others →
        </button>` : ''}
      </div>
    </div>`;
}

function toggleRoom(roomName) {
  roomCollapsed[roomName] = !roomCollapsed[roomName];
  const body = document.getElementById('rb-' + roomName.replace(/\s/g,'_'));
  const btn  = document.querySelector(`#room-${roomName.replace(/\s/g,'_')} .room-toggle`);
  if (body) body.classList.toggle('collapsed', roomCollapsed[roomName]);
  if (btn)  btn.textContent = roomCollapsed[roomName] ? '▼' : '▲';
}

function updateWastage(val) {
  if (!curtCurrentJob) return;
  const v = parseFloat(val);
  if (isNaN(v) || v < 0 || v > 30) return;
  curtCurrentJob.wastageBuffer = v;
  renderWindowSchedule();
}

// ── Calc Sheet extras — opening / bracket / cord ──
// Injected dynamically below the motor row, treatment-aware

function renderCalcExtrasBlock(w) {
  const isRoller = ROLLER_TREATMENTS.includes(w.treatment);
  const isCurtain = ['curtain','roman','motorized'].includes(w.treatment);

  // Opening direction — curtain / roman / motorized only
  const openingBlock = isCurtain ? `
    <div class="cs-row" style="margin-top:10px;">
      <label class="cs-label">Opening direction</label>
      <select id="cs-opening-dir" class="cs-input">
        ${Object.entries(OPENING_DIRECTIONS).map(([k,v]) =>
          `<option value="${k}" ${(w.openingDirection || 'two_way') === k ? 'selected' : ''}>${v}</option>`
        ).join('')}
      </select>
    </div>` : '';

  // Bracket type — all treatments
  const bracketBlock = `
    <div class="cs-row" style="margin-top:10px;">
      <label class="cs-label">Bracket type</label>
      <select id="cs-bracket-type" class="cs-input">
        ${BRACKET_TYPES.map(b =>
          `<option value="${b}" ${(w.bracketType || '') === b ? 'selected' : ''}>${b}</option>`
        ).join('')}
      </select>
    </div>`;

  // Cord fields — roller / japanese / zebra / wooden / blackout
  const cordBlock = isRoller ? `
    <div class="cs-row" style="margin-top:10px;">
      <label class="cs-label">Cord type</label>
      <select id="cs-cord-type" class="cs-input">
        ${CORD_TYPES.map(c =>
          `<option value="${c}" ${(w.cordType || '') === c ? 'selected' : ''}>${c}</option>`
        ).join('')}
      </select>
    </div>
    <div class="cs-row" style="margin-top:10px;">
      <label class="cs-label">Cord length (cm)</label>
      <input id="cs-cord-length" type="number" class="cs-input" min="0" max="500"
        value="${w.cordLength || ''}" placeholder="e.g. 180">
    </div>
    <div class="cs-row" style="margin-top:10px;">
      <label class="cs-label">Cord side</label>
      <select id="cs-cord-side" class="cs-input">
        <option value="right" ${(w.cordSide || 'right') === 'right' ? 'selected' : ''}>Right</option>
        <option value="left"  ${(w.cordSide) === 'left'  ? 'selected' : ''}>Left</option>
      </select>
    </div>` : '';

  return `
    <div id="cs-extras" style="border-top:1px solid var(--line);margin-top:12px;padding-top:12px;">
      <p style="font-size:11px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px;">
        ${isRoller ? 'Blind Specs' : 'Rail Specs'}
      </p>
      ${openingBlock}
      ${bracketBlock}
      ${cordBlock}
    </div>`;
}

function readCalcExtras() {
  // Returns the extras values currently in the form — null if element missing
  return {
    openingDirection: document.getElementById('cs-opening-dir')  ? document.getElementById('cs-opening-dir').value  : null,
    bracketType:      document.getElementById('cs-bracket-type') ? document.getElementById('cs-bracket-type').value : null,
    cordType:         document.getElementById('cs-cord-type')    ? document.getElementById('cs-cord-type').value    : null,
    cordLength:       document.getElementById('cs-cord-length')  ? parseFloat(document.getElementById('cs-cord-length').value) || null : null,
    cordSide:         document.getElementById('cs-cord-side')    ? document.getElementById('cs-cord-side').value    : null,
  };
}

// ── Calc Sheet Panel ───────────────────
function openCalcSheet(winId) {
  if (!curtCurrentJob) return;
  const w = curtCurrentJob.windows.find(x => x.id === winId);
  if (!w) return;
  calcSheetWinId = winId;
  document.getElementById('cs-win-label').textContent   = w.label;
  document.getElementById('cs-win-room').textContent    = w.room;
  document.getElementById('cs-win-size').textContent    = `${w.width} × ${w.height} cm`;
  document.getElementById('cs-win-treatment').textContent = treatmentLabel(w.treatment);
  document.getElementById('cs-win-fabric').textContent  = w.fabricCode || (w.fabricType ? fabricLabel(w.fabricType) : '—');
  document.getElementById('cs-win-design').textContent  = w.designType || '—';
  document.getElementById('cs-fullness').value     = w.fullness      || 2.0;
  document.getElementById('cs-rollwidth').value    = w.rollWidth     || 137;
  document.getElementById('cs-repv').value         = w.patternRepeatV || 0;
  document.getElementById('cs-reph').value         = w.patternRepeatH || 0;
  document.getElementById('cs-top-hem').value      = w.topHem        || 8;
  document.getElementById('cs-bottom-hem').value   = w.bottomHem     || 12;
  document.getElementById('cs-side-hem').value     = w.sideHem       || 5;
  document.getElementById('cs-track-length').value = w.trackLength   || w.width;
  const railTypeSel = document.getElementById('cs-rail-type');
  if (railTypeSel) {
    // Rebuild every open — trackStock is the single source of truth (data.js),
    // no more hardcoded RAIL_TYPES list. Grouped cut-to-length vs fixed-piece,
    // with live stock qty shown so Silva sees availability while picking.
    const cutOptions = trackStock.filter(t => t.mode === 'cut').map(t =>
      `<option value="${t.label}">${t.label} (${t.metresInStock}m in stock)</option>`).join('');
    const pieceOptions = trackStock.filter(t => t.mode === 'piece').map(t =>
      `<option value="${t.label}">${t.label} (${t.piecesInStock} pcs in stock)</option>`).join('');
    const otherOptions = trackStock.filter(t => !t.mode).map(t =>
      `<option value="${t.label}">${t.label}</option>`).join('');
    railTypeSel.innerHTML =
      `<optgroup label="Cut-to-length">${cutOptions}</optgroup>` +
      `<optgroup label="Fixed-piece (Grabber Rail style)">${pieceOptions}</optgroup>` +
      `<optgroup label="Other">${otherOptions}</optgroup>`;
  }
  document.getElementById('cs-rail-type').value    = w.railType || (trackStock[0] && trackStock[0].label) || '';
  document.getElementById('cs-motorized').checked  = w.motorized     || false;
  toggleCalcMotorBrand(w.motorized || false);
  document.getElementById('cs-motorbrand').value   = w.motorBrand    || 'somfy';
  const motorModelSel = document.getElementById('cs-motormodel');
  if (motorModelSel && motorModelSel.options.length === 0) {
    motorModelSel.innerHTML = MOTOR_MODELS.map(m => `<option value="${m}">${m}</option>`).join('');
  }
  if (motorModelSel) motorModelSel.value = w.motorModel || MOTOR_MODELS[0];
  document.getElementById('cs-remote-type').value = w.remoteType || '';

  // Inject treatment-aware extras block (opening direction / bracket / cord)
  // Remove any previous extras block first, then insert after motor brand row
  const oldExtras = document.getElementById('cs-extras');
  if (oldExtras) oldExtras.remove();
  const motorRow = document.getElementById('cs-motor-brand-wrap');
  if (motorRow) {
    motorRow.insertAdjacentHTML('afterend', renderCalcExtrasBlock(w));
  } else {
    // Fallback: append before the result block
    const resultEl = document.getElementById('cs-result');
    if (resultEl) resultEl.insertAdjacentHTML('beforebegin', renderCalcExtrasBlock(w));
  }

  if (w.calc && w.calcDone) showCalcResult(w.calc);
  else document.getElementById('cs-result').style.display = 'none';
  document.getElementById('curt-calc-sheet').style.display = 'flex';
  document.getElementById('curt-calc-sheet').scrollTop = 0;
}

function closeCalcSheet() {
  calcSheetWinId = null;
  const panel = document.getElementById('curt-calc-sheet');
  if (panel) panel.style.display = 'none';
}

function toggleCalcMotorBrand(checked) {
  const el = document.getElementById('cs-motor-brand-wrap');
  if (el) el.style.display = checked ? 'block' : 'none';
}

function calcSheetLive() {
  const w = buildCalcInput();
  if (!w) return;
  showCalcResult(calcFabricWithHems(w));
}

function buildCalcInput() {
  if (!curtCurrentJob || !calcSheetWinId) return null;
  const w = curtCurrentJob.windows.find(x => x.id === calcSheetWinId);
  if (!w) return null;
  return {
    width: w.width, height: w.height,
    fullness:       parseFloat(document.getElementById('cs-fullness').value)      || 2.0,
    rollWidth:      parseFloat(document.getElementById('cs-rollwidth').value)     || 137,
    patternRepeatV: parseFloat(document.getElementById('cs-repv').value)          || 0,
    patternRepeatH: parseFloat(document.getElementById('cs-reph').value)          || 0,
    topHem:         parseFloat(document.getElementById('cs-top-hem').value)       || 0,
    bottomHem:      parseFloat(document.getElementById('cs-bottom-hem').value)    || 0,
    sideHem:        parseFloat(document.getElementById('cs-side-hem').value)      || 0,
    trackLength:    parseFloat(document.getElementById('cs-track-length').value)  || w.width,
    wastageBuffer:  curtCurrentJob.wastageBuffer,
    overhang:       w.overhang || 0,
    motorized:      document.getElementById('cs-motorized').checked,
    motorBrand:     document.getElementById('cs-motorbrand').value,
  };
}

function showCalcResult(c) {
  const resultEl = document.getElementById('cs-result');
  resultEl.style.display = 'block';
  resultEl.innerHTML = `
    <div class="calc-result-grid">
      <div class="cr-item"><p class="cr-label">Cut width</p><p class="cr-value">${c.cutWidth} cm</p></div>
      <div class="cr-item"><p class="cr-label">Cut height</p><p class="cr-value">${c.cutHeight} cm</p></div>
      <div class="cr-item"><p class="cr-label">Widths needed</p><p class="cr-value">${c.widthsNeeded}</p></div>
      <div class="cr-item highlight"><p class="cr-label">Total fabric</p><p class="cr-value">${c.totalMetres} m</p></div>
      <div class="cr-item"><p class="cr-label">Track length</p><p class="cr-value">${(c.trackLength/100).toFixed(2)} m</p></div>
      <div class="cr-item"><p class="cr-label">Hems (T/B/S)</p><p class="cr-value">${c.topHem} / ${c.bottomHem} / ${c.sideHem} cm</p></div>
    </div>`;
}

function saveCalcSheet() {
  if (!curtCurrentJob || !calcSheetWinId) return;
  const w = curtCurrentJob.windows.find(x => x.id === calcSheetWinId);
  if (!w) return;
  w.fullness        = parseFloat(document.getElementById('cs-fullness').value)      || 2.0;
  w.rollWidth       = parseFloat(document.getElementById('cs-rollwidth').value)     || 137;
  w.patternRepeatV  = parseFloat(document.getElementById('cs-repv').value)          || 0;
  w.patternRepeatH  = parseFloat(document.getElementById('cs-reph').value)          || 0;
  w.topHem          = parseFloat(document.getElementById('cs-top-hem').value)       || 0;
  w.bottomHem       = parseFloat(document.getElementById('cs-bottom-hem').value)    || 0;
  w.sideHem         = parseFloat(document.getElementById('cs-side-hem').value)      || 0;
  w.trackLength     = parseFloat(document.getElementById('cs-track-length').value)  || w.width;
  w.railType        = document.getElementById('cs-rail-type').value;
  w.railItemCode    = (getTrackStockByLabel(w.railType) || {}).itemCode || null;
  w.motorized       = document.getElementById('cs-motorized').checked;
  w.motorBrand      = w.motorized ? document.getElementById('cs-motorbrand').value : null;
  w.motorModel      = w.motorized ? document.getElementById('cs-motormodel').value : null;
  w.remoteType      = w.motorized ? (document.getElementById('cs-remote-type').value || null) : null;

  // Save extras — opening direction / bracket / cord
  const extras = readCalcExtras();
  if (extras.openingDirection !== null) w.openingDirection = extras.openingDirection;
  if (extras.bracketType      !== null) w.bracketType      = extras.bracketType;
  if (extras.cordType         !== null) w.cordType         = extras.cordType;
  if (extras.cordLength       !== null) w.cordLength       = extras.cordLength;
  if (extras.cordSide         !== null) w.cordSide         = extras.cordSide;

  w.wastageBuffer   = curtCurrentJob.wastageBuffer;
  w.calc     = calcFabricWithHems(w);
  w.calcDone = true;
  // Auto-create item card for this window
  ensureItemCards(curtCurrentJob);
  closeCalcSheet();
  renderWindowSchedule();
  curtAlert(`✓ Calc saved for ${w.label} — ${w.calc.totalMetres} m fabric`);
}

// ── Copy Calc Sheet — apply a completed calc to other windows ──
// Copies fabric/hem/rail/motor/extras settings, NOT width/height/track length
// (each window keeps its own dimensions and recomputed track length)
function openCopyCalcPicker(sourceWinId) {
  if (!curtCurrentJob) return;
  const src = curtCurrentJob.windows.find(x => x.id === sourceWinId);
  if (!src || !src.calcDone) return;
  copyCalcSourceId = sourceWinId;
  document.getElementById('cc-src-label').textContent = src.label;
  document.getElementById('cc-src-meta').textContent =
    `${src.room} · ${treatmentLabel(src.treatment)} · ${src.width} × ${src.height} cm`;
  document.getElementById('cc-target-list').innerHTML = renderCopyCalcTargetList(sourceWinId);
  document.getElementById('curt-copy-calc-panel').style.display = 'flex';
  document.getElementById('curt-copy-calc-panel').scrollTop = 0;
}

function closeCopyCalcPanel() {
  copyCalcSourceId = null;
  const panel = document.getElementById('curt-copy-calc-panel');
  if (panel) panel.style.display = 'none';
}

function renderCopyCalcTargetList(sourceId) {
  const job = curtCurrentJob;
  const src = job.windows.find(x => x.id === sourceId);
  const others = job.windows.filter(w => w.id !== sourceId);
  if (others.length === 0) {
    return '<p style="font-size:13px;color:var(--ink2);">No other windows in this job.</p>';
  }
  return others.map(w => {
    const sameTreatment = w.treatment === src.treatment;
    return `
      <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;cursor:pointer;${sameTreatment ? '' : 'opacity:.6;'}">
        <input type="checkbox" class="copy-calc-target" value="${w.id}" style="width:18px;height:18px;flex:none;">
        <span style="flex:1;">
          <span style="display:block;font-size:13px;font-weight:600;color:#1e2a3b;">
            ${w.label} <span style="color:#94a3b8;font-weight:400;">· ${w.room}</span>
          </span>
          <span style="display:block;font-size:11px;color:#64748b;">
            ${treatmentLabel(w.treatment)} · ${w.width} × ${w.height} cm
            ${w.calcDone ? '· already has a calc (will be overwritten)' : ''}
          </span>
        </span>
        ${sameTreatment ? '<span class="pill ok" style="font-size:10px;">Match</span>' : '<span class="pill grey" style="font-size:10px;">Different</span>'}
      </label>`;
  }).join('');
}

function applyCopyCalc() {
  if (!copyCalcSourceId) return;
  const checked = Array.from(document.querySelectorAll('.copy-calc-target:checked')).map(el => el.value);
  if (checked.length === 0) { curtAlert('Select at least one window to copy to.'); return; }
  copyCalcToWindows(copyCalcSourceId, checked);
  closeCopyCalcPanel();
}

function copyCalcToWindows(sourceId, targetIds) {
  const job = curtCurrentJob;
  if (!job) return;
  const src = job.windows.find(x => x.id === sourceId);
  if (!src || !src.calcDone) return;

  let count = 0;
  targetIds.forEach(tid => {
    const t = job.windows.find(x => x.id === tid);
    if (!t) return;

    t.fullness        = src.fullness;
    t.rollWidth        = src.rollWidth;
    t.patternRepeatV   = src.patternRepeatV;
    t.patternRepeatH   = src.patternRepeatH;
    t.topHem           = src.topHem;
    t.bottomHem        = src.bottomHem;
    t.sideHem          = src.sideHem;
    t.overhang         = src.overhang;
    t.railType         = src.railType;
    t.railItemCode     = src.railItemCode;
    t.motorized        = src.motorized;
    t.motorBrand       = src.motorBrand;
    t.openingDirection = src.openingDirection;
    t.bracketType      = src.bracketType;
    t.cordType         = src.cordType;
    t.cordLength        = src.cordLength;
    t.cordSide          = src.cordSide;
    t.wastageBuffer     = job.wastageBuffer;

    // Track length stays specific to each window's own dimensions + overhang
    t.trackLength = t.width + (t.overhang || 0) * 2;
    t.calc     = calcFabricWithHems(t);
    t.calcDone = true;
    count++;
  });

  ensureItemCards(job);
  renderWindowSchedule();
  curtAlert(`✓ Calc copied to ${count} window${count > 1 ? 's' : ''}`);
}

// ── Push windows → BOM ─────────────────
function pushWindowsToBOM() {
  if (!curtCurrentJob) return;
  const doneWindows = curtCurrentJob.windows.filter(w => w.calcDone && w.calc);
  if (doneWindows.length === 0) { curtAlert('Complete at least one calc sheet before generating BOM.'); return; }
  const pending = curtCurrentJob.windows.filter(w => !w.calcDone).length;
  if (pending > 0) curtAlert(`Note: ${pending} window${pending>1?'s':''} still pending — BOM generated from completed calcs only.`);

  const fabricAgg = {};
  const trackAgg  = {};
  let motorCount  = 0;
  let motorBrand  = 'somfy';

  doneWindows.forEach(w => {
    const fKey = fabricLabel(w.fabricType);
    fabricAgg[fKey] = fabricAgg[fKey] || { metres: 0 };
    fabricAgg[fKey].metres = parseFloat((fabricAgg[fKey].metres + w.calc.totalMetres).toFixed(2));
    const tType = w.railType || (w.motorized ? 'Motorised Rail (Somfy)' : 'Manual Track');
    trackAgg[tType] = trackAgg[tType] || { count: 0, totalM: 0 };
    trackAgg[tType].count++;
    trackAgg[tType].totalM = parseFloat((trackAgg[tType].totalM + (w.calc.trackLength / 100)).toFixed(2));
    if (w.motorized) { motorCount++; motorBrand = w.motorBrand || 'somfy'; }
  });

  Object.entries(fabricAgg).forEach(([type, data]) => {
    const existing = curtCurrentJob.bom.fabric.find(f => f.type === type);
    if (existing) { existing._calcMetres = data.metres; }
    else curtCurrentJob.bom.fabric.push({ type, supplier: '', unitCost: 0, budgeted: 0, actual: 0, _calcMetres: data.metres });
  });

  Object.entries(trackAgg).forEach(([type, data]) => {
    const existing = curtCurrentJob.bom.tracks.find(t => t.type === type);
    if (existing) { existing.qty = data.count; existing.totalM = data.totalM; }
    else curtCurrentJob.bom.tracks.push({ type, qty: data.count, totalM: data.totalM, unitCost: 0, budgeted: 0, actual: 0 });
  });

  if (motorCount > 0) {
    const existing = curtCurrentJob.bom.motors.find(m => m.brand.toLowerCase() === motorBrand);
    if (existing) { existing.qty = motorCount; }
    else curtCurrentJob.bom.motors.push({ brand: motorBrand.charAt(0).toUpperCase() + motorBrand.slice(1), model: motorBrand === 'somfy' ? 'RS100' : 'TBC', qty: motorCount, unitCost: 0, budgeted: 0, actual: 0 });
  }

  curtCurrentJob.bomStatus = 'submitted';
  curtAlert('✓ BOM updated from calc sheets. Open BOM tab to set costs.');
  curtGoTo('curt-bom');
  openCurtBomDetail(curtCurrentJob.id);
}

// ── BOM — Picker ───────────────────────
function showCurtBomPicker() {
  document.getElementById('curt-bom-picker').style.display = 'block';
  document.getElementById('curt-bom-detail').style.display = 'none';
  document.getElementById('curt-bom-job-list').innerHTML = curtainJobs.map(job => `
    <div class="job-pick" onclick="openCurtBomDetail('${job.id}')">
      <div>
        <p class="jp-name">${job.name}</p>
        <p class="jp-meta">${job.id} · ${job.client} · ${totalWindowQty(job)} windows</p>
      </div>
      ${statusPill(job.bomStatus)}
    </div>`).join('');
}

// ── BOM — Detail ───────────────────────
function openCurtBomDetail(jobId) {
  curtCurrentJob = curtainJobs.find(j => j.id === jobId);
  if (!curtCurrentJob) return;
  document.getElementById('curt-bom-picker').style.display = 'none';
  document.getElementById('curt-bom-detail').style.display = 'block';
  document.getElementById('cb-job-name').textContent = curtCurrentJob.name;
  document.getElementById('cb-job-meta').textContent =
    `${curtCurrentJob.id} · ${curtCurrentJob.client}`;
  renderBOMSections();
}

// ── Aggregate quantities from window/layer entries ──
// Fabric & Tracks are computed live from the window schedule (estimate vs
// actual). Motors are counted from motorized windows. Accessories stay a
// manual list on job.bom.accessories (estimator-defined, not calc-derived).
function computeBOMQuantities(job) {
  const fabric = {}, tracks = {}, motors = {}, hardware = {};

  job.windows.forEach(w => {
    if (!w.calcDone || !w.calc) return;
    const qty = w.qty || 1;

    if (w.fabricType) {
      const hasCode = w.fabricCode && w.fabricCode !== 'TBS';
      const key = hasCode ? w.fabricCode : fabricLabel(w.fabricType);
      fabric[key] = fabric[key] || { code: hasCode ? w.fabricCode : null, type: fabricLabel(w.fabricType), estimated: 0, hasEstimate: false, actual: 0 };
      fabric[key].actual += w.calc.totalMetres * qty;
      if (w.quoteEstimateMetres != null) {
        fabric[key].estimated += w.quoteEstimateMetres * qty;
        fabric[key].hasEstimate = true;
      }
    }

    if (w.calc.trackLength && w.railType) {
      tracks[w.railType] = tracks[w.railType] || { type: w.railType, windows: 0, estMetres: 0, actualMetres: 0 };
      tracks[w.railType].windows += qty;
      const estCm = w.width + ((w.overhang || 0) * 2);
      tracks[w.railType].estMetres    += (estCm / 100) * qty;
      tracks[w.railType].actualMetres += (w.calc.trackLength / 100) * qty;
    }

    if (w.motorized && w.motorModel) {
      const key = (w.motorBrand || 'somfy') + '|' + w.motorModel;
      motors[key] = motors[key] || { brand: w.motorBrand || 'somfy', model: w.motorModel, qty: 0 };
      motors[key].qty += qty;
    }

    // Hardware — derived from the rail's recipe, not typed in by Silva.
    // qty:null ('unknown' formula) components are aggregated separately so
    // the BOM can flag them instead of silently showing 0.
    explodeWindowHardware(w).forEach(part => {
      hardware[part.key] = hardware[part.key] || { key: part.key, label: part.label, unit: part.unit, qty: 0, confirmed: part.confirmed, hasUnknown: false };
      if (part.qty == null) {
        hardware[part.key].hasUnknown = true;
      } else {
        hardware[part.key].qty += part.qty * qty;
      }
      // If any window contributing to this part is unconfirmed, the compiled total is unconfirmed
      hardware[part.key].confirmed = hardware[part.key].confirmed && part.confirmed;
    });
  });

  return {
    fabric: Object.values(fabric).map(f => ({
      ...f,
      estimated: f.hasEstimate ? parseFloat(f.estimated.toFixed(2)) : null,
      actual: parseFloat(f.actual.toFixed(2))
    })),
    tracks: Object.values(tracks).map(t => ({
      ...t,
      estMetres: parseFloat(t.estMetres.toFixed(2)),
      actualMetres: parseFloat(t.actualMetres.toFixed(2))
    })),
    motors: Object.values(motors),
    hardware: Object.values(hardware).map(h => ({
      ...h,
      qty: h.unit === 'm' ? parseFloat(h.qty.toFixed(2)) : Math.round(h.qty)
    }))
  };
}

function renderBOMSections() {
  const job = curtCurrentJob;
  const bom = job.bom;
  const qtyBom = computeBOMQuantities(job);
  const materialAlerts = getCurtainMaterialAlerts(job);

  document.getElementById('cb-budget-alerts').innerHTML = materialAlerts.length ? materialAlerts.map(a => `
    <div class="alert-bar warn">
      <span>⚠ ${a.cat} over estimate — ${a.windowLabel} (${a.room})</span>
      <span class="av">${a.actual}${a.unit} actual vs ${a.estimated}${a.unit} est. (+${a.overBy}${a.unit}) — needs Ops sign-off</span>
    </div>`).join('') : '<p style="font-size:13px;color:var(--ok);font-weight:500;">✓ All materials within quoted estimate</p>';

  // Project summary tiles
  const totalFabricM = qtyBom.fabric.reduce((s, f) => s + f.actual, 0);
  const totalTrackM  = qtyBom.tracks.reduce((s, t) => s + t.actualMetres, 0);
  const totalMotors  = qtyBom.motors.reduce((s, m) => s + m.qty, 0);
  const totalAcc     = (bom.accessories || []).reduce((s, a) => s + (a.qty || 0), 0);
  document.getElementById('cb-project-summary').innerHTML = `
    <div class="fabric-tile"><p class="ft-label">Fabric</p><p class="ft-value">${totalFabricM.toFixed(2)} m</p></div>
    <div class="fabric-tile"><p class="ft-label">Track</p><p class="ft-value">${totalTrackM.toFixed(2)} m</p></div>
    <div class="fabric-tile"><p class="ft-label">Motors</p><p class="ft-value">${totalMotors}</p></div>
    <div class="fabric-tile"><p class="ft-label">Accessories</p><p class="ft-value">${totalAcc}</p></div>
    <div class="fabric-tile"><p class="ft-label">Windows</p><p class="ft-value">${totalWindowQty(job)}</p></div>`;

  document.getElementById('cb-fabric').innerHTML = qtyBom.fabric.length ? `
    <table>
      <thead><tr><th>Type</th><th>Code</th><th class="r">Est.</th><th class="r">Actual</th><th class="r">Status</th></tr></thead>
      <tbody>${qtyBom.fabric.map(f => `<tr>
          <td><b>${f.type}</b></td>
          <td style="color:var(--purple);font-size:12px;">${f.code || '—'}</td>
          <td class="r">${f.estimated != null ? f.estimated + ' m' : '—'}</td>
          <td class="r" style="font-weight:600;">${f.actual} m</td>
          <td class="r">${f.estimated != null && f.actual > f.estimated ? '<span class="pill warn">Over</span>' : '<span class="pill ok">OK</span>'}</td>
        </tr>`).join('')}</tbody>
    </table>` : '<p style="font-size:13px;color:var(--ink2);">No fabric lines yet — complete calc sheets in the window schedule first.</p>';

  document.getElementById('cb-tracks').innerHTML = qtyBom.tracks.length ? `
    <table>
      <thead><tr><th>Rail type</th><th class="r">Windows</th><th class="r">Est.</th><th class="r">Actual</th><th class="r">Status</th></tr></thead>
      <tbody>${qtyBom.tracks.map(t => `<tr>
          <td><b>${t.type}</b></td><td class="r">${t.windows}</td>
          <td class="r">${t.estMetres} m</td>
          <td class="r" style="font-weight:600;">${t.actualMetres} m</td>
          <td class="r">${t.actualMetres > t.estMetres ? '<span class="pill warn">Over</span>' : '<span class="pill ok">OK</span>'}</td>
        </tr>`).join('')}</tbody>
    </table>` : '<p style="font-size:13px;color:var(--ink2);">No track lines yet.</p>';

  document.getElementById('cb-motors').innerHTML = qtyBom.motors.length ? `
    <table>
      <thead><tr><th>Brand</th><th>Model</th><th class="r">Qty</th></tr></thead>
      <tbody>${qtyBom.motors.map(m => `<tr>
          <td><b>${m.brand.charAt(0).toUpperCase()+m.brand.slice(1)}</b></td><td style="color:var(--ink2);">${m.model}</td><td class="r">${m.qty}</td>
        </tr>`).join('')}</tbody>
    </table>` : '<p style="font-size:13px;color:var(--ink2);">No motors — no motorized windows in schedule.</p>';

  document.getElementById('cb-accessories').innerHTML = (bom.accessories && bom.accessories.length) ? `
    <table>
      <thead><tr><th>Item</th><th class="r">Qty</th></tr></thead>
      <tbody>${bom.accessories.map(a => `<tr><td><b>${a.item}</b></td><td class="r">${a.qty}</td></tr>`).join('')}</tbody>
    </table>` : '<p style="font-size:13px;color:var(--ink2);">No accessories listed.</p>';

  // Hardware — derived automatically from rail recipes (runners, end caps,
  // master carrier, belt, driver pulley, brackets...). Silva never types
  // these in; unconfirmed figures are flagged so nobody purchases against
  // a guessed number without Ops/Silva sign-off.
  const cbHardwareEl = document.getElementById('cb-hardware');
  if (cbHardwareEl) {
    cbHardwareEl.innerHTML = qtyBom.hardware.length ? `
      <table>
        <thead><tr><th>Component</th><th class="r">Qty</th><th class="r">Status</th></tr></thead>
        <tbody>${qtyBom.hardware.map(h => `<tr>
            <td><b>${h.label}</b></td>
            <td class="r" style="font-weight:600;">${h.hasUnknown ? '?' : (h.qty + (h.unit === 'm' ? ' m' : ''))}</td>
            <td class="r">${h.hasUnknown ? '<span class="pill warn">Needs spec</span>' : (h.confirmed ? '<span class="pill ok">Confirmed</span>' : '<span class="pill warn">Unconfirmed</span>')}</td>
          </tr>`).join('')}</tbody>
      </table>
      <p style="font-size:11px;color:var(--ink2);margin-top:8px;">Auto-calculated from rail type + track length. "Unconfirmed" items use placeholder counts pending Silva's sign-off — don't purchase against these yet.</p>`
      : '<p style="font-size:13px;color:var(--ink2);">No hardware to list yet — complete calc sheets in the window schedule first.</p>';
  }

  // Per-window breakdown
  document.getElementById('cb-breakdown').innerHTML = job.windows.filter(w => w.calcDone).length ? `
    <table>
      <thead><tr><th>Window</th><th>Room</th><th>Code</th><th class="r">Fabric</th><th>Rail type</th><th class="r">Track</th><th>Motor</th></tr></thead>
      <tbody>${job.windows.filter(w => w.calcDone && w.calc).map(w => `<tr>
          <td><b>${w.label}</b>${w.qty > 1 ? ` <span style="color:var(--ink2);font-weight:400;">×${w.qty}</span>` : ''}${w.windowGroup ? ' 🔗' : ''}</td>
          <td style="color:var(--ink2);font-size:12px;">${w.room}</td>
          <td style="color:var(--purple);font-size:12px;">${w.fabricCode && w.fabricCode !== 'TBS' ? w.fabricCode : '—'}</td>
          <td class="r">${w.calc.totalMetres} m</td>
          <td style="color:var(--ink2);font-size:12px;">${w.railType || '—'}</td>
          <td class="r">${w.calc.trackLength ? (w.calc.trackLength/100).toFixed(2) + ' m' : '—'}</td>
          <td style="font-size:12px;color:var(--ink2);">${w.motorized ? (w.motorModel || 'Motorized') : '—'}</td>
        </tr>`).join('')}</tbody>
    </table>` : '<p style="font-size:13px;color:var(--ink2);">No completed calc sheets yet.</p>';

  const approvalSection = document.getElementById('cb-approval-section');
  const approvalDone    = document.getElementById('cb-approval-done');
  if (curtCurrentJob.budgetStatus === 'approved') {
    approvalSection.style.display = 'none';
    approvalDone.style.display = 'block';
    approvalDone.textContent = '✓ Budget approved by Operations — production can proceed.';
    approvalDone.style.background = 'var(--ok-bg)'; approvalDone.style.borderColor = 'var(--ok-line)'; approvalDone.style.color = 'var(--ok)';
  } else {
    approvalSection.style.display = 'block';
    approvalDone.style.display = 'none';
  }
}

function submitCurtainBudget() {
  if (!curtCurrentJob) return;
  curtCurrentJob.bomStatus    = 'submitted';
  curtCurrentJob.budgetStatus = 'pending';
  const approvalSection = document.getElementById('cb-approval-section');
  const approvalDone    = document.getElementById('cb-approval-done');
  approvalSection.style.display = 'none';
  approvalDone.style.display    = 'block';
  approvalDone.textContent = '⏳ BOM submitted — awaiting Operations Manager approval. Production on hold until approved.';
  approvalDone.style.background = 'var(--warn-bg)'; approvalDone.style.borderColor = 'var(--warn-line)'; approvalDone.style.color = 'var(--warn)';
}


// ══════════════════════════════════════════
// WORKSHOP TAB
// ══════════════════════════════════════════

function renderCurtWorkshop() {
  // Ensure all jobs have workshop data structure
  curtainJobs.forEach(job => {
    if (!job.workshop) {
      job.workshop = {
        stitching: { tailor: '', stage: 'pending', startDate: '', targetDate: '', notes: '' },
        trackMaking: { assignee: '', status: 'pending', startDate: '', targetDate: '' },
      };
    }
  });

  let html = '';

  curtainJobs.forEach(job => {
    const ws = job.workshop;
    const approved = job.budgetStatus === 'approved';
    const lockMsg = !approved
      ? `<div class="ws-lock"><span>🔒</span><p>Budget must be approved before production starts</p></div>`
      : '';

    // Build track list from calc sheets
    const trackLines = buildTrackSummaryForJob(job);

    html += `
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div>
            <p style="font-weight:700;font-size:15px;">${job.name}</p>
            <p style="font-size:12px;color:var(--ink2);">${job.id} · ${job.client}</p>
          </div>
          ${statusPill(job.status)}
        </div>

        ${lockMsg}

        <div style="${!approved ? 'opacity:.45;pointer-events:none;' : ''}">

          <!-- STITCHING SECTION -->
          <div style="border-top:1px solid var(--line);padding-top:12px;margin-top:4px;">
            <p class="card-title" style="margin-bottom:10px;">✂️ Stitching</p>
            <div class="row2" style="margin-bottom:8px;">
              <div class="field">
                <label>Assign tailor</label>
                <select onchange="wsUpdate('${job.id}','stitching','tailor',this.value)">
                  <option value="">— Select —</option>
                  ${STITCH_TEAM.map(t => `<option value="${t}" ${ws.stitching.tailor===t?'selected':''}>${t}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label>Stage</label>
                <select onchange="wsUpdate('${job.id}','stitching','stage',this.value)">
                  <option value="pending"   ${ws.stitching.stage==='pending'   ?'selected':''}>Pending</option>
                  <option value="cutting"   ${ws.stitching.stage==='cutting'   ?'selected':''}>Cutting</option>
                  <option value="stitching" ${ws.stitching.stage==='stitching' ?'selected':''}>Stitching</option>
                  <option value="qc"        ${ws.stitching.stage==='qc'        ?'selected':''}>QC</option>
                  <option value="ready"     ${ws.stitching.stage==='ready'     ?'selected':''}>Ready</option>
                </select>
              </div>
            </div>
            <div class="row2" style="margin-bottom:8px;">
              <div class="field">
                <label>Start date</label>
                <input type="date" value="${ws.stitching.startDate||''}"
                  onchange="wsUpdate('${job.id}','stitching','startDate',this.value)">
              </div>
              <div class="field">
                <label>Target completion</label>
                <input type="date" value="${ws.stitching.targetDate||''}"
                  onchange="wsUpdate('${job.id}','stitching','targetDate',this.value)">
              </div>
            </div>
            <div class="field" style="margin-bottom:4px;">
              <label>Notes</label>
              <input type="text" value="${ws.stitching.notes||''}" placeholder="e.g. double-check lining quantity"
                onchange="wsUpdate('${job.id}','stitching','notes',this.value)">
            </div>
            <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${statusPill(ws.stitching.stage||'pending')}
              ${ws.stitching.tailor ? `<span style="font-size:12px;color:var(--ink2);">Assigned: ${ws.stitching.tailor}</span>` : ''}
              ${ws.stitching.targetDate ? `<span style="font-size:12px;color:var(--ink2);">Due: ${fmtDate(ws.stitching.targetDate)}</span>` : ''}
            </div>
          </div>

          <!-- TRACK MAKING SECTION -->
          <div style="border-top:1px solid var(--line);padding-top:12px;margin-top:12px;">
            <p class="card-title" style="margin-bottom:10px;">🔩 Track Making</p>

            ${trackLines.length > 0 ? `
            <div style="background:var(--card2,rgba(124,58,237,.05));border:1px solid rgba(124,58,237,.15);border-radius:var(--r3);padding:10px 12px;margin-bottom:10px;">
              <p style="font-size:11px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Rail requirements (from calc sheets)</p>
              ${trackLines.map(t => `
                <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid var(--line);">
                  <span style="font-weight:600;">${t.type}</span>
                  <span style="color:var(--ink2);">${t.qty} × · ${t.totalM} m total</span>
                </div>`).join('')}
            </div>` : `<p style="font-size:12px;color:var(--ink2);margin-bottom:10px;">No track data yet — complete window calc sheets first.</p>`}

            <div class="row2" style="margin-bottom:8px;">
              <div class="field">
                <label>Assign to</label>
                <select onchange="wsUpdate('${job.id}','trackMaking','assignee',this.value)">
                  <option value="">— Select —</option>
                  ${TRACK_TEAM.map(t => `<option value="${t}" ${ws.trackMaking.assignee===t?'selected':''}>${t}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label>Status</label>
                <select onchange="wsUpdate('${job.id}','trackMaking','status',this.value)">
                  <option value="pending"       ${ws.trackMaking.status==='pending'       ?'selected':''}>Pending</option>
                  <option value="in_production" ${ws.trackMaking.status==='in_production' ?'selected':''}>In Production</option>
                  <option value="ready"         ${ws.trackMaking.status==='ready'         ?'selected':''}>Ready</option>
                </select>
              </div>
            </div>
            <div class="row2">
              <div class="field">
                <label>Start date</label>
                <input type="date" value="${ws.trackMaking.startDate||''}"
                  onchange="wsUpdate('${job.id}','trackMaking','startDate',this.value)">
              </div>
              <div class="field">
                <label>Target date</label>
                <input type="date" value="${ws.trackMaking.targetDate||''}"
                  onchange="wsUpdate('${job.id}','trackMaking','targetDate',this.value)">
              </div>
            </div>
            <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${statusPill(ws.trackMaking.status||'pending')}
              ${ws.trackMaking.assignee ? `<span style="font-size:12px;color:var(--ink2);">Assigned: ${ws.trackMaking.assignee}</span>` : ''}
              ${ws.trackMaking.targetDate ? `<span style="font-size:12px;color:var(--ink2);">Due: ${fmtDate(ws.trackMaking.targetDate)}</span>` : ''}
            </div>
          </div>

        </div><!-- end locked wrapper -->
      </div>`;
  });

  document.getElementById('curt-workshop-jobs').innerHTML = html ||
    '<p style="font-size:13px;color:var(--ink2);">No curtain jobs yet.</p>';

  // Full Gantt below job cards
  renderGanttFull('curt-workshop-gantt', 5);
}

function buildTrackSummaryForJob(job) {
  const trackAgg = {};
  job.windows.forEach(w => {
    if (!w.calcDone || !w.calc) return;
    const tType = w.railType || (w.motorized ? 'Motorised Rail (Somfy)' : 'Manual Track');
    trackAgg[tType] = trackAgg[tType] || { qty: 0, totalM: 0 };
    trackAgg[tType].qty++;
    trackAgg[tType].totalM = parseFloat((trackAgg[tType].totalM + (w.calc.trackLength / 100)).toFixed(2));
  });
  return Object.entries(trackAgg).map(([type, data]) => ({ type, ...data }));
}

function wsUpdate(jobId, section, field, value) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job || !job.workshop) return;
  job.workshop[section][field] = value;
  // Re-render gantt on change
  renderGanttFull('curt-workshop-gantt', 5);
  if (curtCurrentPage === 'curt-dashboard') renderGanttMini('curt-dash-gantt');
}


// ══════════════════════════════════════════
// FABRIC TAB  — driven by Purchase Inquiries
// ══════════════════════════════════════════

function fmtETA(dateStr) {
  if (!dateStr) return 'ETA not set yet';
  const d = new Date(dateStr);
  const days = daysBetween(todayStr(), dateStr);
  const dateLabel = d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  if (days === null) return dateLabel;
  if (days < 0)  return `${dateLabel} (overdue by ${Math.abs(days)}d)`;
  if (days === 0) return `${dateLabel} (today)`;
  return `${dateLabel} (${days}d)`;
}

function renderInquiryStageBar(inquiry) {
  const stages = piStages(inquiry);
  const currentIdx = stages.indexOf(inquiry.stage);
  return `
    <div style="display:flex;align-items:center;gap:3px;margin:8px 0;flex-wrap:wrap;">
      ${stages.map((s, i) => `
        <span style="font-size:9.5px;padding:3px 7px;border-radius:20px;white-space:nowrap;
          background:${i<=currentIdx ? (i===currentIdx ? 'var(--purple)' : 'rgba(124,58,237,.15)') : '#f1f5f9'};
          color:${i<=currentIdx ? (i===currentIdx ? '#fff' : 'var(--purple)') : '#94a3b8'};
          font-weight:${i===currentIdx?'700':'500'};">
          ${PI_STAGE_LABELS[s]}
        </span>${i < stages.length-1 ? '<span style="color:#cbd5e1;font-size:10px;">→</span>' : ''}
      `).join('')}
    </div>`;
}

function renderCurtFabric() {
  let html = '';

  curtainJobs.forEach(job => {
    const inquiries = getInquiriesForJob(job.id);
    if (inquiries.length === 0) {
      html += `
        <div class="card" style="margin-bottom:14px;">
          <p style="font-weight:700;font-size:14px;margin-bottom:4px;">${job.name}</p>
          <p style="font-size:12px;color:var(--ink2);">${job.id} · No purchase inquiries raised yet.</p>
        </div>`;
      return;
    }

    html += `<div class="card" style="margin-bottom:16px;">
      <div style="margin-bottom:10px;">
        <p style="font-weight:700;font-size:15px;">${job.name}</p>
        <p style="font-size:12px;color:var(--ink2);">${job.id} · ${job.client}</p>
      </div>`;

    inquiries.forEach(pi => {
      const windows = pi.windowIds.map(wid => job.windows.find(w => w.id === wid)).filter(Boolean);
      const arrived = pi.stage === 'arrived_bahrain';
      const done = piIsDone(pi);

      html += `
        <div style="border-top:1px solid var(--line);padding:12px 0;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
            <div>
              <p style="font-weight:700;font-size:13px;">${pi.fabricCode || 'Stock item'} <span style="color:var(--ink2);font-weight:400;font-size:11px;">· ${pi.id}</span></p>
              <p style="font-size:11px;color:var(--ink2);">${pi.vendor} — ${pi.vendorRegion}${pi.quantityOrdered ? ` · ${pi.quantityOrdered}m ordered` : ''}</p>
            </div>
            <div>
              ${arrived ? '<span class="pill warn">📦 Arrived — awaiting handover</span>' : ''}
              ${done ? '<span class="pill ok">✓ Received by Curtain</span>' : ''}
            </div>
          </div>

          ${renderInquiryStageBar(pi)}

          <p style="font-size:11px;color:var(--ink2);margin-bottom:6px;">
            ETA: <b style="color:${!done && pi.eta && daysBetween(todayStr(),pi.eta)<0 ? 'var(--bad)' : 'var(--ink)'};">${fmtETA(pi.eta)}</b>
          </p>

          <p style="font-size:11px;color:var(--ink2);margin-bottom:6px;">
            Windows: ${windows.map(w => `${w.label} (${w.room})`).join(', ') || '—'}
          </p>

          ${pi.notes ? `<p style="font-size:11px;color:var(--purple);margin-bottom:8px;">${pi.notes}</p>` : ''}

          ${arrived ? `
            <button class="primary" style="background:rgba(124,58,237,.7);border-color:rgba(124,58,237,.5);font-size:12px;"
              onclick="markInquiryReceived('${pi.id}')">Mark received by Curtain →</button>
          ` : ''}
        </div>`;
    });

    html += `</div>`;
  });

  document.getElementById('curt-fabric-list').innerHTML = html ||
    '<div class="card"><p style="font-size:13px;color:var(--ink2);">No purchase inquiries yet.</p></div>';
}

function markInquiryReceived(inquiryId) {
  const pi = purchaseInquiries.find(p => p.id === inquiryId);
  if (!pi) return;
  pi.stage = 'received_by_curtain';
  pi.stageDates['received_by_curtain'] = todayStr();
  curtAlert(`✓ ${pi.fabricCode || 'Stock item'} marked as received by Curtain department`);
  renderCurtFabric();
}


// ══════════════════════════════════════════
// INSTALLATION TAB  (redesigned with readiness lock)
// ══════════════════════════════════════════

function getInstallReadiness(job) {
  // Fabric: every calc-done window must have a linked purchase inquiry
  // that's reached "received by Curtain" — no inquiry yet means fabric
  // hasn't even been ordered, which correctly blocks readiness.
  const fabricWindows = job.windows.filter(w => w.calcDone);
  const fabricReady = fabricWindows.length > 0 && fabricWindows.every(w => {
    const pi = getInquiryForWindow(w.id);
    return pi && piIsDone(pi);
  });

  // Rails: track making status = 'ready'
  const railsReady = job.workshop &&
    job.workshop.trackMaking &&
    job.workshop.trackMaking.status === 'ready';

  // Accessories: manual checkbox
  const accessoriesReady = job.installation && job.installation.accessoriesReady === true;

  return { fabricReady, railsReady, accessoriesReady };
}

function renderCurtInstall() {
  curtainJobs.forEach(job => {
    if (!job.installation) {
      job.installation = { status: 'pending', scheduledDate: '', team: [], siteContact: '', accessoriesReady: false, handoverSigned: false };
    }
    if (!job.installation.team) job.installation.team = [];
  });

  const html = curtainJobs.map(job => {
    const inst = job.installation;
    const ready = getInstallReadiness(job);
    const allReady = ready.fabricReady && ready.railsReady && ready.accessoriesReady;

    const checkRow = (label, done, hint) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);">
        <div style="width:22px;height:22px;border-radius:50%;background:${done?'var(--ok)':'var(--line)'};display:flex;align-items:center;justify-content:center;flex:none;">
          ${done ? '<span style="color:#fff;font-size:12px;font-weight:800;">✓</span>' : '<span style="color:var(--ink2);font-size:10px;">○</span>'}
        </div>
        <div>
          <p style="font-size:13px;font-weight:${done?'600':'400'};color:${done?'var(--ink)':'var(--ink2)'};">${label}</p>
          ${!done && hint ? `<p style="font-size:11px;color:var(--ink2);">${hint}</p>` : ''}
        </div>
      </div>`;

    return `
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
          <div>
            <p style="font-weight:700;font-size:15px;">${job.name}</p>
            <p style="font-size:12px;color:var(--ink2);margin:2px 0;">${job.id} · ${job.client}</p>
          </div>
          ${statusPill(inst.status)}
        </div>

        <!-- Readiness checklist -->
        <div style="margin-bottom:14px;">
          <p class="card-title" style="margin-bottom:4px;">Readiness check</p>
          ${checkRow('Fabric received / reserved', ready.fabricReady,
            job.bom.fabric.length === 0 ? 'No fabric lines in BOM yet' : 'Go to Fabric tab to mark received or reserve from stock')}
          ${checkRow('Rails ready', ready.railsReady,
            'Go to Workshop tab → Track Making → mark Ready')}
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;">
            <div style="width:22px;height:22px;border-radius:50%;background:${ready.accessoriesReady?'var(--ok)':'var(--line)'};display:flex;align-items:center;justify-content:center;flex:none;">
              ${ready.accessoriesReady ? '<span style="color:#fff;font-size:12px;font-weight:800;">✓</span>' : '<span style="color:var(--ink2);font-size:10px;">○</span>'}
            </div>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;">
              <input type="checkbox" ${inst.accessoriesReady?'checked':''} style="width:16px;height:16px;"
                onchange="instSetAccessories('${job.id}',this.checked)">
              <span style="font-size:13px;font-weight:${ready.accessoriesReady?'600':'400'};">Accessories ready</span>
            </label>
          </div>
        </div>

        <!-- Schedule section — locked until all ready -->
        ${!allReady ? `
        <div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:var(--r3);padding:11px 13px;margin-bottom:12px;">
          <p style="font-size:13px;font-weight:600;color:var(--bad);">🔒 Complete all 3 checks to unlock scheduling</p>
        </div>` : ''}

        <div style="${!allReady ? 'opacity:.4;pointer-events:none;' : ''}">
          <p class="card-title" style="margin-bottom:8px;">Schedule</p>
          <div class="row2" style="margin-bottom:8px;">
            <div class="field">
              <label>Install date</label>
              <input type="date" id="inst-date-${job.id}" value="${inst.scheduledDate || ''}"
                onchange="updateInstall('${job.id}','date',this.value)">
            </div>
            <div class="field">
              <label>Site contact</label>
              <input type="text" id="inst-contact-${job.id}" value="${inst.siteContact || ''}"
                placeholder="Name + number"
                onchange="updateInstall('${job.id}','contact',this.value)">
            </div>
          </div>

          <!-- Crew selector -->
          <div class="field" style="margin-bottom:10px;">
            <label>Install crew</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
              ${INSTALL_CREW.map(name => {
                const selected = inst.team && inst.team.includes(name);
                return `<button class="${selected?'primary':'sec'}" style="font-size:12px;padding:5px 12px;"
                  onclick="toggleCrewMember('${job.id}','${name}')">${name}</button>`;
              }).join('')}
            </div>
            ${inst.team && inst.team.length > 0 ? `<p style="font-size:11px;color:var(--ink2);margin-top:6px;">Selected: ${inst.team.join(', ')}</p>` : ''}
          </div>

          <div class="btnrow">
            ${inst.status !== 'complete' ? `
              <button class="primary" onclick="scheduleInstall('${job.id}')">
                ${inst.status === 'pending' ? 'Confirm schedule →' : 'Update schedule'}
              </button>
              <button class="sm ok" onclick="completeInstall('${job.id}')">Mark complete + handover signed</button>
            ` : `
              <span class="pill ok">✓ Complete · Client handover signed</span>
            `}
          </div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('curt-install-list').innerHTML = html ||
    '<p style="font-size:13px;color:var(--ink2);">No curtain jobs yet.</p>';
}

function instSetAccessories(jobId, val) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job) return;
  job.installation.accessoriesReady = val;
  renderCurtInstall();
}

function toggleCrewMember(jobId, name) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job || !job.installation) return;
  if (!job.installation.team) job.installation.team = [];
  const idx = job.installation.team.indexOf(name);
  if (idx === -1) job.installation.team.push(name);
  else job.installation.team.splice(idx, 1);
  renderCurtInstall();
}

function updateInstall(jobId, field, val) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job) return;
  if (field === 'date')    job.installation.scheduledDate = val;
  if (field === 'contact') job.installation.siteContact = val;
  // Update gantt when install date changes
  if (curtCurrentPage === 'curt-workshop') renderGanttFull('curt-workshop-gantt', 5);
}

function scheduleInstall(jobId) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job) return;
  if (!job.installation.scheduledDate) { curtAlert('Please set an install date first.'); return; }
  job.installation.status = 'scheduled';
  curtAlert(`✓ Installation scheduled for ${fmtDate(job.installation.scheduledDate)}`);
  renderCurtInstall();
}

function completeInstall(jobId) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job) return;
  job.installation.status = 'complete';
  job.installation.handoverSigned = true;
  job.status = 'complete';
  curtAlert('✓ Installation complete. Client handover recorded.');
  renderCurtInstall();
  renderCurtDashboard();
}

// ── Toast alert ────────────────────────
function curtAlert(msg) {
  if (typeof showAlert === 'function') {
    showAlert(msg);
  } else {
    let toast = document.getElementById('curt-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'curt-toast';
      toast.style.cssText = `
        position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
        background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;
        padding:10px 18px;border-radius:20px;z-index:9999;
        box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;
        transition:opacity .3s;`;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
  }
}

// ── Hook into shell ─────────────────────
function launchCurtainModule() {
  openCurtainModule();
}


// ══════════════════════════════════════════════════════════════
// ITEM CARD MODEL
// One item card per window. Auto-created when calc sheet saved.
// Treatment-aware stage lifecycle with QC + Rework support.
// ══════════════════════════════════════════════════════════════

// Treatment → ordered stages
const ITEM_STAGES = {
  curtain:  ['Cutting', 'Stitching', 'Hoist QC', 'Ready', 'Installed'],
  roller:   ['Cutting', 'Assembly',  'Hoist QC', 'Ready', 'Installed'],
  roman:    ['Cutting', 'Stitching', 'Assembly', 'Hoist QC', 'Ready', 'Installed'],
  tracks:   ['Cutting', 'Assembly',  'Hoist QC', 'Ready', 'Installed'],
  motorized:['Cutting', 'Assembly',  'Hoist QC', 'Ready', 'Installed'],
  japanese: ['Cutting', 'Assembly',  'Hoist QC', 'Ready', 'Installed'],
  wooden:   ['Cutting', 'Assembly',  'Hoist QC', 'Ready', 'Installed'],
  zebra:    ['Cutting', 'Assembly',  'Hoist QC', 'Ready', 'Installed'],
  blackout: ['Cutting', 'Stitching', 'Hoist QC', 'Ready', 'Installed'],
};

function getItemStages(treatment) {
  return ITEM_STAGES[treatment] || ITEM_STAGES['curtain'];
}

// Ensure every calc-done window has an item card object
function ensureItemCards(job) {
  if (!job.itemCards) job.itemCards = {};
  job.windows.forEach(w => {
    if (!w.calcDone) return;
    if (!job.itemCards[w.id]) {
      job.itemCards[w.id] = {
        windowId:    w.id,
        jobId:       job.id,
        stage:       'Cutting',       // current live stage
        stageDates:  {},              // { 'Cutting': '2026-06-01', ... }
        qcResult:    null,            // null | 'pass' | 'fail'
        qcHistory:   [],              // array of QC attempt records
        reworkLog:   [],              // array of rework records
        isRework:    false,
        reworkStage: null,            // stage QC sent it back to
        assignedTo:  null,            // 'Abdullah' | 'Prince' | null — track team assignment
      };
    }
  });
}

function getItemCard(jobId, windowId) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job) return null;
  ensureItemCards(job);
  return job.itemCards[windowId] || null;
}

function advanceItemStage(jobId, windowId) {
  const job  = curtainJobs.find(j => j.id === jobId);
  const win  = job && job.windows.find(w => w.id === windowId);
  const card = getItemCard(jobId, windowId);
  if (!job || !win || !card) return;

  const stages  = getItemStages(win.treatment);
  const current = card.isRework ? card.reworkStage : card.stage;
  const idx     = stages.indexOf(current);

  if (idx === -1 || idx >= stages.length - 1) return; // already at last stage

  // Cannot advance past QC without a pass result
  const nextStage = stages[idx + 1];
  if (current === 'QC') {
    curtAlert('QC result required before advancing. Use the QC dashboard.');
    return;
  }

  // Record completion timestamp for current stage
  card.stageDates[current] = card.stageDates[current] || new Date().toISOString();

  if (card.isRework) {
    card.reworkStage = nextStage;
    if (nextStage === 'QC') card.isRework = false; // back in QC, rework complete
  } else {
    card.stage = nextStage;
  }
}

// Called from QC dashboard: pass or fail
function recordQCResult(jobId, windowId, result, notes, photo, qcPerson, reworkStage) {
  const job  = curtainJobs.find(j => j.id === jobId);
  const win  = job && job.windows.find(w => w.id === windowId);
  const card = getItemCard(jobId, windowId);
  if (!job || !win || !card) return false;

  const timestamp = new Date().toISOString();
  const stages    = getItemStages(win.treatment);
  const qcIdx     = stages.indexOf('QC');

  const qcRecord = {
    result,
    notes:    notes || '',
    photo:    photo || null,   // base64 for now, Nettworksy migrates to cloud
    person:   qcPerson || 'QC',
    timestamp,
    attempt:  card.qcHistory.length + 1,
  };
  card.qcHistory.push(qcRecord);
  card.stageDates['QC'] = timestamp;

  if (result === 'pass') {
    card.qcResult  = 'pass';
    card.isRework  = false;
    card.reworkStage = null;
    card.stage     = stages[qcIdx + 1] || 'Ready'; // advance to Ready
    card.stageDates[card.stage] = timestamp;
    curtAlert(`✓ QC passed — ${win.label} is now Ready`);
  } else {
    // Fail — send to rework
    const returnTo = reworkStage || stages[0]; // QC picks, default to Cutting
    card.qcResult  = 'fail';
    card.isRework  = true;
    card.reworkStage = returnTo;
    card.reworkLog.push({
      attempt:   card.qcHistory.length,
      timestamp,
      returnTo,
      reason:    notes || '',
    });
    curtAlert(`⚠ QC failed — ${win.label} sent back to ${returnTo}`);
  }
  return true;
}

function getItemCardStageDisplay(card, treatment) {
  if (!card) return { stage: '—', isRework: false };
  if (card.isRework) return { stage: card.reworkStage, isRework: true };
  return { stage: card.stage, isRework: false };
}

function itemCardStagePill(card, treatment) {
  if (!card) return statusPill('pending');
  const { stage, isRework } = getItemCardStageDisplay(card, treatment);
  const stageKey = (stage || '').toLowerCase().replace(/\s/g, '_');
  const pill = statusPill(stageKey) || `<span class="pill grey">${stage}</span>`;
  if (isRework) {
    return `<span class="pill bad">Rework → ${stage}</span>`;
  }
  if (card.qcResult === 'pass' && card.stage === 'Ready') return `<span class="pill ok">✓ Ready</span>`;
  if (card.stage === 'Installed') return `<span class="pill ok">✓ Installed</span>`;
  if (stage === 'QC') return `<span class="pill info">QC</span>`;
  return `<span class="pill warn">${stage}</span>`;
}


// ══════════════════════════════════════════════════════════════
// TRACKS DASHBOARD — FULL IN-DEPTH BUILD
// Abdullah & Prince — track production + roller blind assembly
// ══════════════════════════════════════════════════════════════

// Predefined lists — from inventory
const BRACKET_TYPES = [
  'Ceiling bracket',
  'Wall bracket (single)',
  'Wall bracket (double)',
  'Top fix bracket',
  'Side fix bracket',
  'Recess bracket',
  'Motorised ceiling bracket',
  'Motorised wall bracket',
];

const CORD_TYPES = [
  'Ball chain',
  'Continuous loop cord',
  'Spring mechanism (no cord)',
  'Motorised (no cord)',
];

const OPENING_DIRECTIONS = {
  two_way:       'Two way (centre split)',
  one_way_left:  'One way left',
  one_way_right: 'One way right',
  fixed:         'Fixed (decorative)',
};

// Which treatments need the Tracks dashboard
const TRACKS_TREATMENTS = ['curtain','roman','motorized','tracks'];
const ROLLER_TREATMENTS = ['roller','japanese','wooden','zebra','blackout'];

function isTracksItem(w) {
  return TRACKS_TREATMENTS.includes(w.treatment);
}
function isRollerItem(w) {
  return ROLLER_TREATMENTS.includes(w.treatment);
}
function needsTrackWork(w) {
  return isTracksItem(w) || isRollerItem(w);
}

// Days until install — returns number or null
function daysUntilInstall(job) {
  const inst = job.installation && job.installation.scheduledDate;
  if (!inst) return null;
  return daysBetween(todayStr(), inst);
}

// Urgency colour for install countdown
function urgencyColor(days) {
  if (days === null) return '#94a3b8';
  if (days <= 3)  return '#ef4444';
  if (days <= 7)  return '#f59e0b';
  if (days <= 14) return '#3b82f6';
  return '#10b981';
}

function urgencyLabel(days) {
  if (days === null) return 'No install date';
  if (days < 0)  return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Install today';
  if (days === 1) return '1 day left';
  return `${days} days`;
}

// ── State ─────────────────────────────────────
let tracksDashView   = 'queue';   // 'queue' | 'jobs' | 'done'
let tracksActiveJob  = null;      // jobId when in job view
let tracksDetailItem = null;      // { jobId, windowId } for detail panel

function openTracksDashboard() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');

  let wrap = document.getElementById('tracks-dash-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'tracks-dash-wrap';
    wrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:200;background:#111827;overflow:hidden;font-family:inherit;';
    document.body.appendChild(wrap);
  }
  wrap.style.display = 'flex';
  tracksDashView  = 'queue';
  tracksActiveJob = null;
  tracksDetailItem = null;
  renderTracksDashboard();
}

function closeTracksDashboard() {
  const wrap = document.getElementById('tracks-dash-wrap');
  if (wrap) wrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
  document.querySelectorAll('.module').forEach(m => m.style.display = '');
}

// ── Collect all track work items ──────────────
function getAllTrackItems() {
  const items = [];
  curtainJobs.forEach(job => {
    ensureItemCards(job);
    const days = daysUntilInstall(job);
    job.windows.forEach(w => {
      if (!w.calcDone) return;
      if (!needsTrackWork(w)) return;
      const card      = job.itemCards[w.id];
      const stageInfo = getItemCardStageDisplay(card, w.treatment);
      items.push({ job, w, card, stageInfo, days });
    });
  });
  // Sort by urgency — closest install first, then no-date at bottom
  return items.sort((a, b) => {
    if (a.days === null && b.days === null) return 0;
    if (a.days === null) return 1;
    if (b.days === null) return -1;
    return a.days - b.days;
  });
}

// ── Assign to Abdullah / Prince ────────────────
function assignTrackItem(jobId, windowId, person) {
  const card = getItemCard(jobId, windowId);
  if (!card) return;
  card.assignedTo = person || null;
  renderTracksDashboard();
}

// ── Paired-opening siblings (same physical window, different layer) ──
// Uses the windowGroup link produced by flattenWindowGroups() in data.js —
// e.g. a main curtain + its sheer, or a curtain + Roman blind at the same
// opening. Surfaced here so the track team knows two cards belong together
// even though each is tracked as an independent production item.
function getGroupSiblings(job, w) {
  if (!w.windowGroup) return [];
  ensureItemCards(job);
  return job.windows
    .filter(x => x.windowGroup === w.windowGroup && x.id !== w.id)
    .map(x => ({ w: x, card: job.itemCards[x.id] }));
}

// ── Main render ───────────────────────────────
function renderTracksDashboard() {
  const wrap = document.getElementById('tracks-dash-wrap');
  if (!wrap) return;

  // If a detail panel is open, render that instead
  if (tracksDetailItem) { renderTracksDetailPanel(); return; }

  const all       = getAllTrackItems();
  const active    = all.filter(i => !['Ready','Installed','Hoist QC'].includes(i.stageInfo.stage) && !i.stageInfo.isRework);
  const rework    = all.filter(i => i.stageInfo.isRework);
  const atHoistQC = all.filter(i => i.stageInfo.stage === 'Hoist QC');
  const ready     = all.filter(i => i.stageInfo.stage === 'Ready');
  const installed = all.filter(i => i.stageInfo.stage === 'Installed');
  const dueThisWeek = all.filter(i => i.days !== null && i.days <= 7 && !['Ready','Installed'].includes(i.stageInfo.stage));

  // ── Today's Focus — what needs attention right now ──
  const workingSet  = [...active, ...rework]; // anything the track team can still act on
  const dueToday    = workingSet.filter(i => i.days !== null && i.days <= 0);
  const todayMetres = dueToday.reduce((s, i) => {
    if (isRollerItem(i.w) || !i.w.calc) return s;
    return s + (i.w.calc.trackLength / 100) * (i.w.qty || 1);
  }, 0);
  const todayMotorized = dueToday.filter(i => i.w.motorized).length;

  const workload = { Unassigned: 0 };
  TRACK_TEAM.forEach(p => workload[p] = 0);
  workingSet.forEach(i => {
    const person = (i.card && i.card.assignedTo) || 'Unassigned';
    workload[person] = (workload[person] || 0) + 1;
  });

  const focusBanner = workingSet.length === 0 ? '' : `
    <div style="background:#0c1a2e;border-bottom:1px solid #1f2937;padding:12px 16px;flex:none;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div><span style="font-size:18px;font-weight:800;color:${dueToday.length>0?'#ef4444':'#6b7280'};">${dueToday.length}</span> <span style="font-size:11px;color:#9ca3af;">due today</span></div>
          <div><span style="font-size:18px;font-weight:800;color:#38bdf8;">${todayMetres.toFixed(1)}m</span> <span style="font-size:11px;color:#9ca3af;">track needed today</span></div>
          ${todayMotorized > 0 ? `<div><span style="font-size:18px;font-weight:800;color:#f59e0b;">⚡${todayMotorized}</span> <span style="font-size:11px;color:#9ca3af;">motorized</span></div>` : ''}
        </div>
        <div style="display:flex;gap:8px;font-size:11px;flex-wrap:wrap;">
          ${TRACK_TEAM.map(p => `<span style="background:#1f2937;border:1px solid #374151;border-radius:20px;padding:3px 10px;color:#e2e8f0;">${p}: <b>${workload[p]}</b></span>`).join('')}
          ${workload.Unassigned > 0 ? `<span style="background:#1f2937;border:1px solid #374151;border-radius:20px;padding:3px 10px;color:#94a3b8;">Unassigned: <b>${workload.Unassigned}</b></span>` : ''}
        </div>
      </div>
    </div>`;

  // ── KPI bar ──
  const kpiBar = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#1f2937;flex:none;">
      <div style="background:#111827;padding:14px 10px;text-align:center;">
        <p style="font-size:24px;font-weight:800;color:#f59e0b;line-height:1;">${dueThisWeek.length}</p>
        <p style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.2;">Due this<br>week</p>
      </div>
      <div style="background:#111827;padding:14px 10px;text-align:center;">
        <p style="font-size:24px;font-weight:800;color:#7c3aed;line-height:1;">${active.length}</p>
        <p style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.2;">In<br>production</p>
      </div>
      <div style="background:#111827;padding:14px 10px;text-align:center;position:relative;">
        <p style="font-size:24px;font-weight:800;color:${rework.length>0?'#ef4444':'#374151'};line-height:1;">${rework.length}</p>
        <p style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.2;">QC failed<br>urgent</p>
        ${rework.length > 0 ? `<div style="position:absolute;top:8px;right:8px;width:7px;height:7px;border-radius:50%;background:#ef4444;"></div>` : ''}
      </div>
      <div style="background:#111827;padding:14px 10px;text-align:center;">
        <p style="font-size:24px;font-weight:800;color:#10b981;line-height:1;">${ready.length}</p>
        <p style="font-size:10px;color:#6b7280;margin-top:4px;line-height:1.2;">Ready<br>for QC</p>
      </div>
    </div>`;

  // ── View tabs ──
  const viewTabs = `
    <div style="display:flex;background:#1f2937;border-bottom:1px solid #374151;flex:none;overflow-x:auto;">
      <button onclick="tracksDashView='queue';renderTracksDashboard()"
        style="flex:1;padding:11px 6px;border:none;background:${tracksDashView==='queue'?'#111827':'transparent'};color:${tracksDashView==='queue'?'#fff':'#6b7280'};font-size:12px;font-weight:${tracksDashView==='queue'?'700':'400'};cursor:pointer;border-bottom:${tracksDashView==='queue'?'2px solid #10b981':'2px solid transparent'};white-space:nowrap;">
        My Queue (${active.length + rework.length})
      </button>
      <button onclick="tracksDashView='jobs';tracksActiveJob=null;renderTracksDashboard()"
        style="flex:1;padding:11px 6px;border:none;background:${tracksDashView==='jobs'?'#111827':'transparent'};color:${tracksDashView==='jobs'?'#fff':'#6b7280'};font-size:12px;font-weight:${tracksDashView==='jobs'?'700':'400'};cursor:pointer;border-bottom:${tracksDashView==='jobs'?'2px solid #10b981':'2px solid transparent'};white-space:nowrap;">
        By Job
      </button>
      <button onclick="tracksDashView='cutlist';renderTracksDashboard()"
        style="flex:1;padding:11px 6px;border:none;background:${tracksDashView==='cutlist'?'#111827':'transparent'};color:${tracksDashView==='cutlist'?'#fff':'#6b7280'};font-size:12px;font-weight:${tracksDashView==='cutlist'?'700':'400'};cursor:pointer;border-bottom:${tracksDashView==='cutlist'?'2px solid #10b981':'2px solid transparent'};white-space:nowrap;">
        Cut List
      </button>
      <button onclick="tracksDashView='done';renderTracksDashboard()"
        style="flex:1;padding:11px 6px;border:none;background:${tracksDashView==='done'?'#111827':'transparent'};color:${tracksDashView==='done'?'#fff':'#6b7280'};font-size:12px;font-weight:${tracksDashView==='done'?'700':'400'};cursor:pointer;border-bottom:${tracksDashView==='done'?'2px solid #10b981':'2px solid transparent'};white-space:nowrap;">
        Completed (${ready.length + installed.length})
      </button>
    </div>`;

  // ── Render active view ──
  let bodyHtml = '';
  if (tracksDashView === 'queue') {
    bodyHtml = renderTracksQueueView(rework, active, atHoistQC);
  } else if (tracksDashView === 'jobs') {
    bodyHtml = renderTracksJobView(all);
  } else if (tracksDashView === 'cutlist') {
    bodyHtml = renderTracksCutListView(workingSet);
  } else {
    bodyHtml = renderTracksDoneView(ready, installed);
  }

  wrap.innerHTML = `
    <!-- Header -->
    <div style="background:#1e2a3b;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex:none;">
      <div>
        <p style="color:#fff;font-weight:700;font-size:16px;">🔩 Tracks & Roller Blinds</p>
        <p style="color:#94a3b8;font-size:11px;margin-top:2px;">${new Date().toLocaleDateString('en-BH',{weekday:'short',day:'numeric',month:'short'})}</p>
      </div>
      <button onclick="closeTracksDashboard()"
        style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:#fff;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;">
        ← Back
      </button>
    </div>
    ${kpiBar}
    ${focusBanner}
    ${viewTabs}
    <div style="flex:1;overflow-y:auto;padding-bottom:30px;">
      ${bodyHtml}
    </div>`;
}


// ── Queue view — sorted by urgency ────────────
function renderTracksQueueView(rework, active, atHoistQC) {
  let html = '';

  // Rework items first — urgent
  if (rework.length > 0) {
    html += `<div style="padding:12px 16px 6px;">
      <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#ef4444;text-transform:uppercase;">⚠ QC Failed — Rework Required (${rework.length})</p>
    </div>`;
    rework.forEach(i => { html += tracksItemCard(i, 'rework'); });
  }

  // Active production items
  if (active.length > 0) {
    html += `<div style="padding:12px 16px 6px;">
      <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#94a3b8;text-transform:uppercase;">In Production (${active.length})</p>
    </div>`;
    active.forEach(i => { html += tracksItemCard(i, 'active'); });
  }

  // At Hoist QC — waiting, not actionable for tracks team
  if (atHoistQC.length > 0) {
    html += `<div style="padding:12px 16px 6px;">
      <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#3b82f6;text-transform:uppercase;">At Hoist QC — Awaiting result (${atHoistQC.length})</p>
    </div>`;
    atHoistQC.forEach(i => { html += tracksItemCard(i, 'waiting'); });
  }

  if (rework.length === 0 && active.length === 0 && atHoistQC.length === 0) {
    html = `<div style="padding:60px 20px;text-align:center;">
      <p style="font-size:40px;margin-bottom:12px;">✓</p>
      <p style="font-size:15px;color:#9ca3af;font-weight:600;">Queue is clear</p>
      <p style="font-size:12px;color:#4b5563;margin-top:6px;">All items are ready or installed.</p>
    </div>`;
  }
  return html;
}

// ── Job view — grouped by job ─────────────────
function renderTracksJobView(all) {
  if (tracksActiveJob) {
    // Drill into one job
    const jobItems = all.filter(i => i.job.id === tracksActiveJob);
    const job = jobItems[0] && jobItems[0].job;
    if (!job) { tracksActiveJob = null; return renderTracksJobView(all); }
    const days = daysUntilInstall(job);
    let html = `
      <div style="padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #1f2937;">
        <button onclick="tracksActiveJob=null;renderTracksDashboard()"
          style="background:rgba(255,255,255,.07);border:1px solid #374151;color:#9ca3af;padding:6px 12px;border-radius:7px;font-size:12px;cursor:pointer;">← Jobs</button>
        <div>
          <p style="color:#fff;font-weight:700;font-size:14px;">${job.name}</p>
          <p style="font-size:11px;color:#6b7280;">${job.id} · ${job.client}</p>
        </div>
        ${days !== null ? `<span style="margin-left:auto;background:${urgencyColor(days)}22;color:${urgencyColor(days)};border:1px solid ${urgencyColor(days)}44;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;">${urgencyLabel(days)}</span>` : ''}
      </div>`;
    jobItems.forEach(i => { html += tracksItemCard(i, 'active', true); });
    // Group mark all ready button
    const actionable = jobItems.filter(i => {
      const stages  = getItemStages(i.w.treatment);
      const current = i.stageInfo.stage;
      const idx     = stages.indexOf(current);
      return idx >= 0 && idx < stages.length - 1 && !['Hoist QC','Ready','Installed'].includes(current);
    });
    if (actionable.length > 1) {
      html += `<div style="padding:12px 16px;">
        <button onclick="tracksMarkAllReady('${job.id}')"
          style="width:100%;padding:13px;background:#10b981;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:14px;cursor:pointer;">
          Mark all ${actionable.length} items ready for hoist →
        </button>
      </div>`;
    }
    return html;
  }

  // Job picker list
  const jobGroups = {};
  all.forEach(i => {
    if (!jobGroups[i.job.id]) jobGroups[i.job.id] = { job: i.job, items: [], days: i.days };
    jobGroups[i.job.id].items.push(i);
  });

  if (Object.keys(jobGroups).length === 0) {
    return `<div style="padding:60px 20px;text-align:center;"><p style="color:#6b7280;">No jobs with track work yet.</p></div>`;
  }

  let html = `<div style="padding:12px 16px 6px;"><p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#6b7280;text-transform:uppercase;">Select a job</p></div>`;
  Object.values(jobGroups).sort((a,b) => {
    if (a.days === null) return 1;
    if (b.days === null) return -1;
    return a.days - b.days;
  }).forEach(({ job, items, days }) => {
    const pending = items.filter(i => !['Ready','Installed'].includes(i.stageInfo.stage)).length;
    const rdone   = items.filter(i => ['Ready','Installed'].includes(i.stageInfo.stage)).length;
    html += `
      <div onclick="tracksActiveJob='${job.id}';renderTracksDashboard()"
        style="margin:0 16px 10px;background:#1f2937;border:1px solid #374151;border-radius:12px;padding:14px;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <p style="color:#fff;font-weight:700;font-size:14px;">${job.name}</p>
            <p style="font-size:11px;color:#6b7280;margin-top:2px;">${job.id} · ${items.length} item${items.length>1?'s':''}</p>
          </div>
          ${days !== null ? `<span style="background:${urgencyColor(days)}22;color:${urgencyColor(days)};border:1px solid ${urgencyColor(days)}44;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;white-space:nowrap;">${urgencyLabel(days)}</span>` : ''}
        </div>
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
          ${pending > 0 ? `<span style="background:#7c3aed22;color:#a78bfa;border:1px solid #7c3aed33;border-radius:20px;padding:3px 9px;font-size:11px;">${pending} pending</span>` : ''}
          ${rdone > 0 ? `<span style="background:#10b98122;color:#34d399;border:1px solid #10b98133;border-radius:20px;padding:3px 9px;font-size:11px;">${rdone} ready</span>` : ''}
        </div>
      </div>`;
  });
  return html;
}

// ── Done view ─────────────────────────────────
function renderTracksDoneView(ready, installed) {
  let html = '';
  if (ready.length === 0 && installed.length === 0) {
    return `<div style="padding:60px 20px;text-align:center;"><p style="color:#6b7280;">No completed items yet.</p></div>`;
  }
  if (ready.length > 0) {
    html += `<div style="padding:12px 16px 6px;"><p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#10b981;text-transform:uppercase;">Ready for hoist / install (${ready.length})</p></div>`;
    ready.forEach(i => { html += tracksItemCard(i, 'ready'); });
  }
  if (installed.length > 0) {
    html += `<div style="padding:12px 16px 6px;"><p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#6b7280;text-transform:uppercase;">Installed (${installed.length})</p></div>`;
    installed.forEach(i => { html += tracksItemCard(i, 'done'); });
  }
  return html;
}

// ── Cut List view — grouped by rail type, with stock check + hardware pick list ──
// items = everything still actionable (active + rework), not just "due this week",
// since cutting ahead of schedule is normal shop-floor practice.
function renderTracksCutListView(items) {
  if (items.length === 0) {
    return `<div style="padding:60px 20px;text-align:center;">
      <p style="font-size:32px;margin-bottom:8px;">✓</p>
      <p style="font-size:14px;color:#9ca3af;">Nothing in production — cut list is empty.</p>
    </div>`;
  }

  // Rail/track cutting list — grouped by exact rail type (itemCode where known)
  const railGroups = {};
  items.forEach(i => {
    const { w, job } = i;
    if (isRollerItem(w) || !w.railType) return;
    const key = w.railType;
    if (!railGroups[key]) railGroups[key] = { railType: key, railItemCode: w.railItemCode || null, rows: [], totalM: 0, totalPieces: 0 };
    const lengthM = w.calc ? w.calc.trackLength / 100 : w.width / 100;
    const qty = w.qty || 1;
    railGroups[key].rows.push({ job, w, lengthM, qty });
    railGroups[key].totalM += lengthM * qty;
    railGroups[key].totalPieces += qty;
  });

  // Hardware pick list — rail hardware (recipe-derived), motors, cords across everything in the set
  const hardwareParts = {}, motors = {}, cords = {};
  items.forEach(i => {
    const { w } = i;
    const qty = w.qty || 1;
    explodeWindowHardware(w).forEach(part => {
      hardwareParts[part.key] = hardwareParts[part.key] || { key: part.key, label: part.label, unit: part.unit, qty: 0, confirmed: part.confirmed, hasUnknown: false };
      if (part.qty == null) hardwareParts[part.key].hasUnknown = true;
      else hardwareParts[part.key].qty += part.qty * qty;
      hardwareParts[part.key].confirmed = hardwareParts[part.key].confirmed && part.confirmed;
    });
    if (w.motorized && w.motorModel) {
      const key = (w.motorBrand || 'somfy') + '|' + w.motorModel;
      motors[key] = motors[key] || { brand: w.motorBrand || 'somfy', model: w.motorModel, qty: 0 };
      motors[key].qty += qty;
    }
    if (isRollerItem(w) && w.cordType) cords[w.cordType] = (cords[w.cordType] || 0) + qty;
  });

  const railSection = Object.values(railGroups).sort((a, b) => b.totalM - a.totalM).map(g => {
    const stock = g.railItemCode ? getTrackStock(g.railItemCode) : null;
    const isPieceMode = stock && stock.mode === 'piece';
    const hasStock = stock && (isPieceMode ? stock.piecesInStock != null : stock.metresInStock != null);
    const sufficient = !hasStock ? null : isPieceMode
      ? stock.piecesInStock >= g.totalPieces
      : stock.metresInStock >= g.totalM;
    const needLabel = isPieceMode ? `${g.totalPieces} piece${g.totalPieces > 1 ? 's' : ''} needed` : `${g.totalM.toFixed(2)}m needed`;
    const shortLabel = !hasStock ? '' : isPieceMode
      ? `⚠ Short ${g.totalPieces - stock.piecesInStock} pc${(g.totalPieces - stock.piecesInStock) !== 1 ? 's' : ''}`
      : `⚠ Short ${(g.totalM - stock.metresInStock).toFixed(1)}m`;
    return `
      <div style="margin:0 16px 12px;background:#1f2937;border:1px solid #374151;border-radius:12px;overflow:hidden;">
        <div style="padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;background:#161f2e;">
          <div>
            <p style="font-size:13px;font-weight:700;color:#f1f5f9;">${g.railType}${isPieceMode ? ` <span style="font-size:10px;color:#a78bfa;font-weight:600;">· ${stock.pieceLengthM}m pieces</span>` : ''}</p>
            <p style="font-size:11px;color:#6b7280;">${g.rows.length} item${g.rows.length > 1 ? 's' : ''} · ${needLabel}</p>
          </div>
          ${hasStock ? `
            <span style="background:${sufficient ? '#10b98122' : '#ef444422'};color:${sufficient ? '#34d399' : '#f87171'};border:1px solid ${sufficient ? '#10b98144' : '#ef444444'};border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;white-space:nowrap;">
              ${sufficient ? '✓ Stock OK' : shortLabel}
            </span>` : `<span style="background:#37415122;color:#9ca3af;border:1px solid #37415144;border-radius:20px;padding:4px 10px;font-size:11px;white-space:nowrap;">Stock n/a</span>`}
        </div>
        <div style="padding:6px 14px 8px;">
          ${g.rows.map(r => `
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid #111827;">
              <span style="color:#e2e8f0;">${r.w.label} <span style="color:#6b7280;">· ${r.job.name}</span></span>
              <span style="color:#9ca3af;">${isPieceMode ? (r.qty > 1 ? r.qty + ' pcs' : '1 pc') : r.lengthM.toFixed(2) + 'm' + (r.qty > 1 ? ' × ' + r.qty : '')}</span>
            </div>`).join('')}
        </div>
        ${hasStock ? `<div style="padding:0 14px 10px;font-size:10px;color:#4b5563;">In stock: ${isPieceMode ? stock.piecesInStock + ' pcs' : stock.metresInStock + 'm'} · updated ${fmtDate(stock.lastUpdated)}</div>` : ''}
      </div>`;
  }).join('');

  const hardwareSection = `
    <div style="margin:0 16px 12px;background:#1f2937;border:1px solid #374151;border-radius:12px;padding:14px;">
      <p style="font-size:11px;font-weight:700;letter-spacing:.6px;color:#6b7280;text-transform:uppercase;margin-bottom:10px;">Hardware pick list</p>
      ${Object.values(hardwareParts).length ? Object.values(hardwareParts).sort((a, b) => (b.qty||0) - (a.qty||0)).map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:5px 0;border-bottom:1px solid #111827;">
          <span style="color:#e2e8f0;">${p.label}</span>
          <span style="display:flex;align-items:center;gap:6px;">
            <span style="color:#9ca3af;font-weight:600;">${p.hasUnknown ? '?' : '× ' + p.qty + (p.unit === 'm' ? 'm' : '')}</span>
            ${p.hasUnknown ? `<span style="background:#f59e0b22;color:#fbbf24;border:1px solid #f59e0b44;border-radius:10px;padding:1px 7px;font-size:9px;font-weight:700;">NEEDS SPEC</span>`
              : (!p.confirmed ? `<span style="background:#f59e0b22;color:#fbbf24;border:1px solid #f59e0b44;border-radius:10px;padding:1px 7px;font-size:9px;font-weight:700;">UNCONFIRMED</span>` : '')}
          </span>
        </div>`).join('') : `<p style="font-size:12px;color:#4b5563;">No hardware data yet.</p>`}
      ${Object.keys(motors).length ? `
        <p style="font-size:10px;color:#6b7280;margin:10px 0 4px;text-transform:uppercase;letter-spacing:.5px;">Motors</p>
        ${Object.values(motors).map(m => `
          <div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid #111827;">
            <span style="color:#f59e0b;">⚡ ${m.brand.charAt(0).toUpperCase() + m.brand.slice(1)} ${m.model}</span><span style="color:#9ca3af;font-weight:600;">× ${m.qty}</span>
          </div>`).join('')}` : ''}
      ${Object.keys(cords).length ? `
        <p style="font-size:10px;color:#6b7280;margin:10px 0 4px;text-transform:uppercase;letter-spacing:.5px;">Cord (roller / blind)</p>
        ${Object.entries(cords).map(([type, qty]) => `
          <div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid #111827;">
            <span style="color:#e2e8f0;">${type}</span><span style="color:#9ca3af;font-weight:600;">× ${qty}</span>
          </div>`).join('')}` : ''}
    </div>`;

  return `
    <div style="padding:12px 16px 6px;">
      <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#38bdf8;text-transform:uppercase;">Cutting list — by rail type (${Object.keys(railGroups).length} types)</p>
    </div>
    ${railSection || `<p style="padding:0 16px 12px;font-size:12px;color:#4b5563;">No track/rail items in production right now.</p>`}
    <div style="padding:12px 16px 6px;">
      <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#38bdf8;text-transform:uppercase;">Hardware needed — all ${items.length} items in production</p>
    </div>
    ${hardwareSection}`;
}

// ── Item card — the core display unit ─────────
function tracksItemCard(i, mode, showDetail) {
  const { job, w, card, days } = i;
  const stages  = getItemStages(w.treatment);
  const current = i.stageInfo.stage;
  const idx     = stages.indexOf(current);
  const isRoller = isRollerItem(w);
  const siblings = getGroupSiblings(job, w);

  const daysColor = urgencyColor(days);
  const daysText  = urgencyLabel(days);

  // Stage progress dots
  const stageDots = stages.map((s, si) => {
    const done    = card && card.stageDates && card.stageDates[s];
    const isCurr  = s === current && !i.stageInfo.isRework;
    const bg      = done ? '#10b981' : isCurr ? '#7c3aed' : '#374151';
    return `<div style="display:flex;align-items:center;gap:3px;">
      <div style="width:8px;height:8px;border-radius:50%;background:${bg};flex:none;"></div>
      <span style="font-size:9px;color:${done?'#10b981':isCurr?'#a78bfa':'#4b5563'};white-space:nowrap;">${s}</span>
      ${si < stages.length-1 ? `<div style="width:10px;height:1px;background:#374151;margin:0 1px;"></div>` : ''}
    </div>`;
  }).join('');

  // Full spec block
  const specBlock = isRoller ? `
    <div style="background:#1a2332;border-radius:8px;padding:10px 12px;margin:8px 0;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <div><p style="font-size:10px;color:#6b7280;">Size (W×H)</p><p style="font-size:13px;font-weight:700;color:#e2e8f0;">${w.width} × ${w.height} cm</p></div>
      <div><p style="font-size:10px;color:#6b7280;">Bracket</p><p style="font-size:12px;color:#e2e8f0;font-weight:600;">${w.bracketType ? w.bracketType.replace(/_/g,' ') : '—'}</p></div>
      <div><p style="font-size:10px;color:#6b7280;">Fabric</p><p style="font-size:12px;color:#e2e8f0;">${w.fabricCode || fabricLabel(w.fabricType) || '—'}</p></div>
      <div><p style="font-size:10px;color:#6b7280;">Cord type</p><p style="font-size:12px;color:#e2e8f0;">${w.cordType ? w.cordType.replace(/_/g,' ') : '—'}</p></div>
      <div><p style="font-size:10px;color:#6b7280;">Cord length</p><p style="font-size:12px;color:#e2e8f0;">${w.cordLength ? w.cordLength + ' cm' : '—'}</p></div>
      <div><p style="font-size:10px;color:#6b7280;">Cord side</p><p style="font-size:12px;color:#e2e8f0;font-weight:700;color:${w.cordSide==='left'?'#60a5fa':'#f472b6'};">${w.cordSide ? w.cordSide.charAt(0).toUpperCase()+w.cordSide.slice(1) : '—'}</p></div>
    </div>` : `
    <div style="background:#1a2332;border-radius:8px;padding:10px 12px;margin:8px 0;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
      <div><p style="font-size:10px;color:#6b7280;">Track length</p><p style="font-size:13px;font-weight:700;color:#e2e8f0;">${w.calc ? (w.calc.trackLength/100).toFixed(2)+' m' : w.width ? (w.width/100).toFixed(2)+' m' : '—'}</p></div>
      <div><p style="font-size:10px;color:#6b7280;">Rail type</p><p style="font-size:12px;color:#e2e8f0;font-weight:600;">${w.railType || '—'}</p></div>
      <div><p style="font-size:10px;color:#6b7280;">Opening</p><p style="font-size:12px;color:#e2e8f0;font-weight:700;">${OPENING_DIRECTIONS[w.openingDirection] || '—'}</p></div>
      <div><p style="font-size:10px;color:#6b7280;">Bracket</p><p style="font-size:12px;color:#e2e8f0;">${w.bracketType ? w.bracketType.replace(/_/g,' ') : '—'}</p></div>
      ${w.motorized ? `<div style="grid-column:1/-1;"><p style="font-size:10px;color:#6b7280;">Motor</p><p style="font-size:12px;color:#f59e0b;font-weight:700;">⚡ ${(w.motorBrand||'Somfy').charAt(0).toUpperCase()+(w.motorBrand||'somfy').slice(1)} — needs motor team fit</p></div>` : ''}
    </div>`;

  // Action buttons based on mode
  let actions = '';
  if (mode === 'rework') {
    const reworkStage = i.stageInfo.stage;
    actions = `
      <div style="background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
        <p style="font-size:11px;color:#f87171;font-weight:700;">QC failed — rework required</p>
        <p style="font-size:11px;color:#ef4444;">Return to: ${reworkStage}</p>
        ${card && card.reworkLog.length ? `<p style="font-size:10px;color:#991b1b;margin-top:4px;">Reason: ${card.reworkLog[card.reworkLog.length-1].reason || 'No notes'}</p>` : ''}
      </div>
      <button onclick="tracksMarkStageComplete('${job.id}','${w.id}');renderTracksDashboard()"
        style="width:100%;padding:12px;background:#dc2626;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">
        Rework complete — send to QC again →
      </button>`;
  } else if (mode === 'active') {
    const nextStage = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;
    const canAdv    = nextStage && !['Hoist QC','Ready','Installed'].includes(current);
    const needsMotor = w.motorized && current === 'Assembly';
    if (needsMotor) {
      actions = `
        <div style="background:#1c1208;border:1px solid #78350f;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
          <p style="font-size:11px;color:#f59e0b;font-weight:700;">⚡ Motor fit required before QC</p>
          <p style="font-size:11px;color:#92400e;">Mark assembly done — motor team will be notified</p>
        </div>
        <button onclick="tracksMarkStageComplete('${job.id}','${w.id}');renderTracksDashboard()"
          style="width:100%;padding:12px;background:#d97706;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">
          Assembly done — notify motor team →
        </button>`;
    } else if (canAdv) {
      const btnLabel = nextStage === 'Hoist QC' ? 'Send to hoist QC →' : `Mark ${nextStage} complete →`;
      actions = `
        <button onclick="tracksMarkStageComplete('${job.id}','${w.id}');renderTracksDashboard()"
          style="width:100%;padding:12px;background:#7c3aed;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">
          ${btnLabel}
        </button>`;
    }
  } else if (mode === 'waiting') {
    actions = `<p style="font-size:12px;color:#3b82f6;padding:4px 0;text-align:center;">Waiting for hoist QC result</p>`;
  } else if (mode === 'ready') {
    actions = `<p style="font-size:12px;color:#10b981;font-weight:600;padding:4px 0;text-align:center;">✓ Ready — awaiting hoist inspection</p>`;
  }

  // QC history badge
  const qcFails = card ? card.qcHistory.filter(h => h.result === 'fail').length : 0;

  // Paired-opening note — same physical window, different layer (main+sheer, curtain+Roman, etc.)
  const pairedNote = siblings.length > 0 ? `
    <p style="font-size:11px;color:#a78bfa;margin-top:3px;">
      🔗 Paired: ${siblings.map(s => `${s.w.label}${s.card ? ` <span style="color:#6b7280;">(${getItemCardStageDisplay(s.card, s.w.treatment).stage})</span>` : ''}`).join(', ')}
    </p>` : '';

  // Assignee row — tap to assign Abdullah / Prince
  const assigneeRow = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
      <span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Assigned:</span>
      ${TRACK_TEAM.map(p => `
        <button onclick="assignTrackItem('${job.id}','${w.id}', ${card && card.assignedTo === p ? 'null' : `'${p}'`})"
          style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;
            background:${card && card.assignedTo === p ? '#7c3aed' : '#111827'};
            color:${card && card.assignedTo === p ? '#fff' : '#9ca3af'};
            border:1px solid ${card && card.assignedTo === p ? '#7c3aed' : '#374151'};">
          ${p}
        </button>`).join('')}
      ${!card || !card.assignedTo ? `<span style="font-size:11px;color:#4b5563;">— unassigned</span>` : ''}
    </div>`;

  const borderColor = mode === 'rework' ? '#7f1d1d' :
                      mode === 'ready'  ? '#065f46' :
                      mode === 'done'   ? '#1f2937' : '#374151';
  const bgColor     = mode === 'rework' ? '#1a0a0a' :
                      mode === 'ready'  ? '#0a1f17' :
                      mode === 'done'   ? '#1a1f2a' : '#1f2937';

  return `
    <div style="margin:0 16px 10px;background:${bgColor};border:1px solid ${borderColor};border-radius:12px;padding:14px;cursor:pointer;"
      onclick="tracksDetailItem={jobId:'${job.id}',windowId:'${w.id}'};renderTracksDashboard()">

      <!-- Header row -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <p style="font-size:15px;font-weight:800;color:#f1f5f9;">${w.label}</p>
            ${isRoller ? `<span style="background:#7c3aed22;color:#a78bfa;border:1px solid #7c3aed44;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">ROLLER</span>` : `<span style="background:#0ea5e922;color:#38bdf8;border:1px solid #0ea5e944;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">RAIL</span>`}
            ${qcFails > 0 ? `<span style="background:#ef444422;color:#f87171;border:1px solid #ef444444;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">${qcFails} QC fail${qcFails>1?'s':''}</span>` : ''}
          </div>
          <p style="font-size:11px;color:#6b7280;margin-top:2px;">${job.name} · ${w.room}</p>
          ${pairedNote}
        </div>
        <!-- Install countdown -->
        <div style="text-align:right;flex:none;">
          <p style="font-size:14px;font-weight:800;color:${daysColor};">${daysText}</p>
          ${days !== null ? `<p style="font-size:10px;color:#4b5563;">to install</p>` : `<p style="font-size:10px;color:#4b5563;">no date set</p>`}
        </div>
      </div>

      <!-- Stage progress -->
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;overflow-x:auto;">
        ${stageDots}
      </div>

      <!-- Spec block -->
      ${specBlock}

      <!-- Actions — stop propagation so card tap doesn't fire -->
      <div onclick="event.stopPropagation()">
        ${assigneeRow}
        ${actions}
      </div>
    </div>`;
}

// ── Detail panel — full spec + history ────────
function renderTracksDetailPanel() {
  const wrap = document.getElementById('tracks-dash-wrap');
  if (!wrap || !tracksDetailItem) return;

  const { jobId, windowId } = tracksDetailItem;
  const job  = curtainJobs.find(j => j.id === jobId);
  const w    = job && job.windows.find(x => x.id === windowId);
  const card = getItemCard(jobId, windowId);
  if (!job || !w || !card) { tracksDetailItem = null; renderTracksDashboard(); return; }

  const stages     = getItemStages(w.treatment);
  const days       = daysUntilInstall(job);
  const isRoller   = isRollerItem(w);
  const stageInfo  = getItemCardStageDisplay(card, w.treatment);

  const historyRows = card.qcHistory.map(h => `
    <div style="border-bottom:1px solid #1f2937;padding:10px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <div>
        <p style="font-size:12px;font-weight:700;color:${h.result==='pass'?'#10b981':'#ef4444'};">
          ${h.result==='pass'?'✓ Pass':'✗ Fail'} — Attempt ${h.attempt}
        </p>
        <p style="font-size:11px;color:#6b7280;">${h.person} · ${new Date(h.timestamp).toLocaleDateString('en-BH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
        ${h.notes ? `<p style="font-size:11px;color:#9ca3af;margin-top:3px;">${h.notes}</p>` : ''}
      </div>
      ${h.photo ? `<img src="${h.photo}" style="width:44px;height:44px;border-radius:7px;object-fit:cover;flex:none;">` : ''}
    </div>`).join('');

  const stageLine = stages.map(s => {
    const done = card.stageDates && card.stageDates[s];
    const curr = stageInfo.stage === s;
    return `
      <div style="flex:1;text-align:center;">
        <div style="width:28px;height:28px;border-radius:50%;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;background:${done?'#10b981':curr?'#7c3aed':'#374151'};border:2px solid ${done?'#10b981':curr?'#a78bfa':'#4b5563'};">
          ${done ? `<span style="color:#fff;font-size:11px;font-weight:800;">✓</span>` : curr ? `<span style="width:8px;height:8px;border-radius:50%;background:#fff;display:block;"></span>` : ''}
        </div>
        <p style="font-size:9px;color:${done?'#10b981':curr?'#a78bfa':'#4b5563'};font-weight:${done||curr?'700':'400'};">${s}</p>
        ${done && card.stageDates[s] ? `<p style="font-size:8px;color:#4b5563;">${new Date(card.stageDates[s]).toLocaleDateString('en-BH',{day:'numeric',month:'short'})}</p>` : ''}
      </div>`;
  }).join('');

  const siblings = getGroupSiblings(job, w);
  const stock = !isRoller && w.railItemCode ? getTrackStock(w.railItemCode) : null;
  const stockIsPiece = stock && stock.mode === 'piece';

  wrap.innerHTML = `
    <div style="background:#1e2a3b;padding:14px 16px;display:flex;align-items:center;gap:10px;flex:none;">
      <button onclick="tracksDetailItem=null;renderTracksDashboard()"
        style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);color:#fff;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;">← Queue</button>
      <div>
        <p style="color:#fff;font-weight:700;font-size:15px;">${w.label}</p>
        <p style="color:#94a3b8;font-size:11px;">${job.name} · ${w.room}</p>
      </div>
      ${days !== null ? `<span style="margin-left:auto;background:${urgencyColor(days)}22;color:${urgencyColor(days)};border:1px solid ${urgencyColor(days)}44;border-radius:20px;padding:5px 11px;font-size:12px;font-weight:700;">${urgencyLabel(days)}</span>` : ''}
    </div>

    <div style="flex:1;overflow-y:auto;padding-bottom:30px;">

      <!-- Assignment -->
      <div style="padding:16px;border-bottom:1px solid #1f2937;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#6b7280;text-transform:uppercase;">Assigned to</span>
        ${TRACK_TEAM.map(p => `
          <button onclick="assignTrackItem('${job.id}','${w.id}', ${card.assignedTo === p ? 'null' : `'${p}'`})"
            style="padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;
              background:${card.assignedTo === p ? '#7c3aed' : '#111827'};
              color:${card.assignedTo === p ? '#fff' : '#9ca3af'};
              border:1px solid ${card.assignedTo === p ? '#7c3aed' : '#374151'};">
            ${p}
          </button>`).join('')}
      </div>

      ${siblings.length > 0 ? `
      <!-- Paired opening -->
      <div style="padding:16px;border-bottom:1px solid #1f2937;background:#160f28;">
        <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#a78bfa;text-transform:uppercase;margin-bottom:8px;">🔗 Same opening — ${siblings.length + 1} layers</p>
        ${siblings.map(s => `
          <div onclick="tracksDetailItem={jobId:'${job.id}',windowId:'${s.w.id}'};renderTracksDashboard()"
            style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;cursor:pointer;">
            <span style="font-size:12px;color:#e2e8f0;">${s.w.label}</span>
            ${s.card ? itemCardStagePill(s.card, s.w.treatment) : ''}
          </div>`).join('')}
      </div>` : ''}

      <!-- Stage timeline -->
      <div style="background:#1f2937;padding:16px;border-bottom:1px solid #374151;">
        <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#6b7280;text-transform:uppercase;margin-bottom:12px;">Stage progress</p>
        <div style="display:flex;align-items:flex-start;">${stageLine}</div>
      </div>

      <!-- Full spec -->
      <div style="padding:16px;border-bottom:1px solid #1f2937;">
        <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#6b7280;text-transform:uppercase;margin-bottom:12px;">${isRoller ? 'Roller blind spec' : 'Rail spec'}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          ${isRoller ? `
            <div><p style="font-size:10px;color:#6b7280;">Width</p><p style="font-size:15px;font-weight:800;color:#f1f5f9;">${w.width} cm</p></div>
            <div><p style="font-size:10px;color:#6b7280;">Height</p><p style="font-size:15px;font-weight:800;color:#f1f5f9;">${w.height} cm</p></div>
            <div><p style="font-size:10px;color:#6b7280;">Fabric</p><p style="font-size:13px;font-weight:600;color:#e2e8f0;">${w.fabricCode || fabricLabel(w.fabricType) || '—'}</p></div>
            <div><p style="font-size:10px;color:#6b7280;">Bracket</p><p style="font-size:13px;font-weight:600;color:#e2e8f0;">${w.bracketType ? w.bracketType.replace(/_/g,' ') : '—'}</p></div>
            <div><p style="font-size:10px;color:#6b7280;">Cord type</p><p style="font-size:13px;font-weight:600;color:#e2e8f0;">${w.cordType ? w.cordType.replace(/_/g,' ') : '—'}</p></div>
            <div><p style="font-size:10px;color:#6b7280;">Cord length</p><p style="font-size:13px;font-weight:600;color:#e2e8f0;">${w.cordLength ? w.cordLength+' cm' : '—'}</p></div>
            <div><p style="font-size:10px;color:#6b7280;">Cord side</p><p style="font-size:14px;font-weight:800;color:${w.cordSide==='left'?'#60a5fa':'#f472b6'};">${w.cordSide ? '● '+w.cordSide.charAt(0).toUpperCase()+w.cordSide.slice(1) : '—'}</p></div>
          ` : `
            <div><p style="font-size:10px;color:#6b7280;">Track length</p><p style="font-size:15px;font-weight:800;color:#f1f5f9;">${w.calc ? (w.calc.trackLength/100).toFixed(2)+' m' : (w.width/100).toFixed(2)+' m'}</p></div>
            <div><p style="font-size:10px;color:#6b7280;">Rail type</p><p style="font-size:13px;font-weight:600;color:#e2e8f0;">${w.railType || '—'}</p></div>
            <div style="grid-column:1/-1;"><p style="font-size:10px;color:#6b7280;">Opening direction</p><p style="font-size:15px;font-weight:800;color:#f1f5f9;">${OPENING_DIRECTIONS[w.openingDirection] || '—'}</p></div>
            <div><p style="font-size:10px;color:#6b7280;">Bracket type</p><p style="font-size:13px;font-weight:600;color:#e2e8f0;">${w.bracketType ? w.bracketType.replace(/_/g,' ') : '—'}</p></div>
            ${w.motorized ? `<div><p style="font-size:10px;color:#6b7280;">Motor</p><p style="font-size:13px;font-weight:700;color:#f59e0b;">⚡ ${(w.motorBrand||'Somfy').charAt(0).toUpperCase()+(w.motorBrand||'somfy').slice(1)}</p></div>` : ''}
            ${stock && (stockIsPiece ? stock.piecesInStock != null : stock.metresInStock != null) ? `<div style="grid-column:1/-1;border-top:1px solid #1f2937;padding-top:8px;margin-top:4px;"><p style="font-size:10px;color:#6b7280;">Rail stock on hand</p><p style="font-size:13px;font-weight:700;color:${(stockIsPiece ? stock.piecesInStock < stock.reorderAt : stock.metresInStock < stock.reorderAt) ? '#f87171' : '#34d399'};">${stockIsPiece ? stock.piecesInStock + ' pcs (' + stock.pieceLengthM + 'm each)' : stock.metresInStock + 'm'} ${(stockIsPiece ? stock.piecesInStock < stock.reorderAt : stock.metresInStock < stock.reorderAt) ? '— low, check Cut List' : 'available'}</p></div>` : ''}
          `}
        </div>
      </div>

      <!-- QC history -->
      ${card.qcHistory.length > 0 ? `
      <div style="padding:16px;">
        <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#6b7280;text-transform:uppercase;margin-bottom:10px;">QC history (${card.qcHistory.length})</p>
        ${historyRows}
      </div>` : `
      <div style="padding:16px;">
        <p style="font-size:12px;color:#4b5563;">No QC history yet.</p>
      </div>`}
    </div>`;
}

// ── Stage advancement ─────────────────────────
function tracksMarkStageComplete(jobId, windowId) {
  const job  = curtainJobs.find(j => j.id === jobId);
  const w    = job && job.windows.find(x => x.id === windowId);
  const card = getItemCard(jobId, windowId);
  if (!job || !w || !card) return;

  const stages  = getItemStages(w.treatment);
  const current = card.isRework ? card.reworkStage : card.stage;
  const idx     = stages.indexOf(current);
  if (idx < 0 || idx >= stages.length - 1) return;

  const nextStage = stages[idx + 1];
  card.stageDates[current] = card.stageDates[current] || new Date().toISOString();

  if (card.isRework) {
    if (nextStage === 'Hoist QC' || nextStage === 'QC') {
      card.isRework    = false;
      card.reworkStage = null;
      card.stage       = nextStage;
    } else {
      card.reworkStage = nextStage;
    }
  } else {
    card.stage = nextStage;
  }
  curtAlert(`✓ ${w.label} → ${nextStage}`);
}

// ── Mark all items for a job ready ────────────
function tracksMarkAllReady(jobId) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job) return;
  ensureItemCards(job);
  let count = 0;
  job.windows.forEach(w => {
    if (!w.calcDone || !needsTrackWork(w)) return;
    const card   = job.itemCards[w.id];
    if (!card) return;
    const stages = getItemStages(w.treatment);
    const current = card.isRework ? card.reworkStage : card.stage;
    const idx    = stages.indexOf(current);
    if (idx < 0 || idx >= stages.length - 1) return;
    const nextStage = stages[idx + 1];
    if (['Hoist QC','Ready','Installed'].includes(current)) return;
    card.stageDates[current] = card.stageDates[current] || new Date().toISOString();
    card.stage = nextStage;
    count++;
  });
  curtAlert(`✓ ${count} item${count!==1?'s':''} advanced`);
  renderTracksDashboard();
}


// ══════════════════════════════════════════════════════════════
// QC DASHBOARD  (QC person — separate role, separate screen)
// Photo upload, pass/fail, notes, timestamp, rework stage picker
// ══════════════════════════════════════════════════════════════

let qcActiveItem = null; // { jobId, windowId } for open QC panel

function openQCDashboard() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');

  let wrap = document.getElementById('qc-dash-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'qc-dash-wrap';
    wrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:200;background:#f7f9fc;overflow:hidden;';
    document.body.appendChild(wrap);
  }
  wrap.style.display = 'flex';
  qcActiveItem = null;
  renderQCDashboard();
}

function closeQCDashboard() {
  const wrap = document.getElementById('qc-dash-wrap');
  if (wrap) wrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
  document.querySelectorAll('.module').forEach(m => m.style.display = '');
}

function renderQCDashboard() {
  const wrap = document.getElementById('qc-dash-wrap');
  if (!wrap) return;

  // Collect all items currently at QC stage or in Rework (waiting to return to QC)
  const qcItems     = [];
  const reworkItems = [];
  const passedToday = [];
  const today       = todayStr();

  curtainJobs.forEach(job => {
    ensureItemCards(job);
    job.windows.forEach(w => {
      if (!w.calcDone) return;
      const card = job.itemCards[w.id];
      if (!card) return;
      const stageInfo = getItemCardStageDisplay(card, w.treatment);

      if (stageInfo.stage === 'QC' && !stageInfo.isRework) {
        qcItems.push({ job, w, card });
      } else if (stageInfo.isRework) {
        reworkItems.push({ job, w, card, stageInfo });
      } else if (card.qcResult === 'pass' && card.stageDates['QC']) {
        const d = card.stageDates['QC'].slice(0,10);
        if (d === today) passedToday.push({ job, w, card });
      }
    });
  });

  const kpiRow = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:16px;background:#fff;border-bottom:1px solid #e8ecf0;">
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#3b82f6;">${qcItems.length}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Awaiting QC</p>
      </div>
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#ef4444;">${reworkItems.length}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">In rework</p>
      </div>
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#10b981;">${passedToday.length}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Passed today</p>
      </div>
    </div>`;

  function qcItemCard(i) {
    const attempts = i.card.qcHistory.length;
    const lastFail = i.card.qcHistory.filter(h => h.result === 'fail').pop();
    return `
      <div style="border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:10px;background:#fff;cursor:pointer;"
        onclick="openQCPanel('${i.job.id}','${i.w.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <p style="font-size:14px;font-weight:700;color:#1e2a3b;">${i.w.label}</p>
            <p style="font-size:11px;color:#64748b;">${i.job.name} · ${i.job.id} · ${i.w.room}</p>
            <p style="font-size:12px;color:#475569;margin-top:4px;">${treatmentLabel(i.w.treatment)} · ${i.w.width}×${i.w.height} cm</p>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
            <span class="pill info">QC</span>
            ${attempts > 0 ? `<span class="pill bad" style="font-size:10px;">Attempt ${attempts+1}</span>` : ''}
          </div>
        </div>
        ${lastFail ? `<div style="margin-top:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 10px;">
          <p style="font-size:11px;color:#dc2626;font-weight:600;">Previous fail: ${lastFail.notes || 'No notes'}</p>
          <p style="font-size:10px;color:#ef4444;">${new Date(lastFail.timestamp).toLocaleDateString('en-BH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
        </div>` : ''}
        <p style="font-size:11px;color:#3b82f6;margin-top:8px;font-weight:600;">Tap to open QC panel →</p>
      </div>`;
  }

  function reworkCard(i) {
    return `
      <div style="border:1px solid #fecaca;border-radius:12px;padding:12px 14px;margin-bottom:8px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <p style="font-size:14px;font-weight:700;color:#1e2a3b;">${i.w.label}</p>
            <p style="font-size:11px;color:#64748b;">${i.job.name} · ${i.job.id}</p>
          </div>
          <span class="pill bad">Rework → ${i.stageInfo.stage}</span>
        </div>
        <p style="font-size:12px;color:#64748b;margin-top:6px;">Returned to ${i.stageInfo.stage} for correction. Will reappear here when production marks it ready for QC again.</p>
      </div>`;
  }

  const listView = `
    <div style="flex:1;overflow-y:auto;padding:16px;padding-bottom:80px;">
      ${qcItems.length > 0 ? `
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:10px;">Awaiting QC (${qcItems.length})</p>
        ${qcItems.map(i => qcItemCard(i)).join('')}` : `
        <div style="text-align:center;padding:48px 20px;">
          <p style="font-size:32px;margin-bottom:8px;">✓</p>
          <p style="font-size:14px;color:#64748b;">No items waiting for QC.</p>
        </div>`}
      ${reworkItems.length > 0 ? `
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin:16px 0 10px;">In Rework (${reworkItems.length})</p>
        ${reworkItems.map(i => reworkCard(i)).join('')}` : ''}
      ${passedToday.length > 0 ? `
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin:16px 0 10px;">Passed Today (${passedToday.length})</p>
        ${passedToday.map(i => `
          <div style="border:1px solid #d1fae5;border-radius:12px;padding:12px 14px;margin-bottom:8px;background:#fff;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <p style="font-size:14px;font-weight:700;color:#1e2a3b;">${i.w.label}</p>
                <p style="font-size:11px;color:#64748b;">${i.job.name} · ${treatmentLabel(i.w.treatment)}</p>
              </div>
              <span class="pill ok">✓ Passed</span>
            </div>
          </div>`).join('')}` : ''}
    </div>`;

  wrap.innerHTML = `
    <div style="background:#1e2a3b;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex:none;">
      <div>
        <p style="color:#fff;font-weight:700;font-size:16px;">🔍 QC Dashboard</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:2px;">${new Date().toLocaleDateString('en-BH',{day:'numeric',month:'short',year:'numeric'})}</p>
      </div>
      <button onclick="closeQCDashboard()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;">← Back</button>
    </div>
    ${kpiRow}
    ${listView}
    <!-- QC Panel overlay (hidden by default) -->
    <div id="qc-panel" style="display:none;position:absolute;inset:0;background:#f7f9fc;overflow-y:auto;z-index:10;"></div>`;
}

function openQCPanel(jobId, windowId) {
  const job  = curtainJobs.find(j => j.id === jobId);
  const win  = job && job.windows.find(w => w.id === windowId);
  const card = getItemCard(jobId, windowId);
  if (!job || !win || !card) return;

  qcActiveItem = { jobId, windowId };
  const stages    = getItemStages(win.treatment);
  const attempts  = card.qcHistory.length;
  const lastFail  = card.qcHistory.filter(h => h.result === 'fail').pop();

  const stageOptions = stages
    .filter(s => s !== 'QC' && s !== 'Ready' && s !== 'Installed')
    .map(s => `<option value="${s}">${s}</option>`)
    .join('');

  const historyRows = card.qcHistory.map((h, idx) => `
    <div style="border-bottom:1px solid #e8ecf0;padding:10px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
      <div>
        <p style="font-size:12px;font-weight:700;color:${h.result==='pass'?'#10b981':'#ef4444'};">
          ${h.result === 'pass' ? '✓ Pass' : '✗ Fail'} — Attempt ${h.attempt}
        </p>
        <p style="font-size:11px;color:#64748b;">${h.person} · ${new Date(h.timestamp).toLocaleDateString('en-BH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
        ${h.notes ? `<p style="font-size:12px;color:#475569;margin-top:3px;">${h.notes}</p>` : ''}
        ${h.result==='fail' && card.reworkLog[idx] ? `<p style="font-size:11px;color:#ef4444;margin-top:2px;">Returned to: ${card.reworkLog[idx].returnTo}</p>` : ''}
      </div>
      ${h.photo ? `<img src="${h.photo}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;flex:none;" />` : ''}
    </div>`).join('');

  const panel = document.getElementById('qc-panel');
  panel.innerHTML = `
    <div style="background:#1e2a3b;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
      <div>
        <p style="color:#fff;font-weight:700;font-size:15px;">QC — ${win.label}</p>
        <p style="color:#94a3b8;font-size:11px;margin-top:1px;">${job.name} · ${win.room} · ${treatmentLabel(win.treatment)}</p>
      </div>
      <button onclick="closeQCPanel()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;">← List</button>
    </div>

    <div style="padding:16px;">

      <!-- Item specs -->
      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:16px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:10px;">Item specs</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div><p style="font-size:11px;color:#94a3b8;">Size</p><p style="font-size:13px;font-weight:600;">${win.width} × ${win.height} cm</p></div>
          <div><p style="font-size:11px;color:#94a3b8;">Treatment</p><p style="font-size:13px;font-weight:600;">${treatmentLabel(win.treatment)}</p></div>
          <div><p style="font-size:11px;color:#94a3b8;">Rail type</p><p style="font-size:13px;font-weight:600;">${win.railType || '—'}</p></div>
          <div><p style="font-size:11px;color:#94a3b8;">Hems T/B/S</p><p style="font-size:13px;font-weight:600;">${win.topHem||0} / ${win.bottomHem||0} / ${win.sideHem||0} cm</p></div>
          ${win.calc ? `<div><p style="font-size:11px;color:#94a3b8;">Cut size</p><p style="font-size:13px;font-weight:600;">${win.calc.cutWidth} × ${win.calc.cutHeight} cm</p></div>` : ''}
          <div><p style="font-size:11px;color:#94a3b8;">QC attempts</p><p style="font-size:13px;font-weight:600;color:${attempts>0?'#ef4444':'#10b981'};">${attempts}</p></div>
        </div>
      </div>

      <!-- Lifecycle stages -->
      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:16px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:10px;">Stage progress</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${stages.map(s => {
            const done = card.stageDates[s];
            const isCurrent = card.stage === s && !card.isRework;
            const bg = done ? '#10b981' : isCurrent ? '#3b82f6' : '#e2e8f0';
            const col = (done || isCurrent) ? '#fff' : '#94a3b8';
            return `<div style="background:${bg};color:${col};border-radius:20px;padding:5px 12px;font-size:12px;font-weight:600;">
              ${s}${done ? ' ✓' : ''}
              ${done ? `<span style="font-size:10px;opacity:.8;"> ${new Date(card.stageDates[s]).toLocaleDateString('en-BH',{day:'numeric',month:'short'})}</span>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- QC form -->
      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:16px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:12px;">QC inspection — Attempt ${attempts + 1}</p>

        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:6px;">QC person name</label>
          <input id="qc-person-name" type="text" placeholder="Your name"
            style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;background:#f8fafc;">
        </div>

        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:6px;">Notes / observations</label>
          <textarea id="qc-notes" rows="3" placeholder="Describe what you checked and any issues..."
            style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;resize:vertical;box-sizing:border-box;background:#f8fafc;"></textarea>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:6px;">Photo</label>
          <input id="qc-photo-input" type="file" accept="image/*" capture="environment"
            onchange="qcPhotoPreview(this)"
            style="display:none;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button onclick="document.getElementById('qc-photo-input').click()"
              style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;">
              📷 Take / upload photo
            </button>
            <span id="qc-photo-name" style="font-size:11px;color:#94a3b8;"></span>
          </div>
          <img id="qc-photo-preview" src="" alt="" style="display:none;width:100%;max-width:200px;border-radius:10px;margin-top:8px;object-fit:cover;" />
        </div>

        <!-- Result buttons -->
        <div style="border-top:1px solid #e8ecf0;padding-top:14px;">
          <p style="font-size:12px;font-weight:600;color:#475569;margin-bottom:10px;">Result</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <button id="qc-pass-btn"
              onclick="qcSelectResult('pass')"
              style="padding:14px;border-radius:10px;border:2px solid #d1fae5;background:#f0fdf4;color:#10b981;font-weight:700;font-size:14px;cursor:pointer;">
              ✓ Pass
            </button>
            <button id="qc-fail-btn"
              onclick="qcSelectResult('fail')"
              style="padding:14px;border-radius:10px;border:2px solid #fecaca;background:#fef2f2;color:#ef4444;font-weight:700;font-size:14px;cursor:pointer;">
              ✗ Fail
            </button>
          </div>

          <!-- Rework stage picker — shown only when Fail selected -->
          <div id="qc-rework-section" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:12px;">
            <label style="font-size:12px;font-weight:600;color:#dc2626;display:block;margin-bottom:6px;">Send back to which stage?</label>
            <select id="qc-rework-stage"
              style="width:100%;padding:10px 12px;border:1px solid #fecaca;border-radius:8px;font-size:13px;background:#fff;box-sizing:border-box;">
              ${stageOptions}
            </select>
          </div>

          <button id="qc-submit-btn" onclick="submitQCResult()"
            style="width:100%;padding:13px;border-radius:10px;background:#1e2a3b;color:#fff;font-weight:700;font-size:14px;cursor:pointer;border:none;opacity:.4;pointer-events:none;">
            Submit QC result
          </button>
        </div>
      </div>

      <!-- QC history -->
      ${card.qcHistory.length > 0 ? `
      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:24px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:8px;">QC history (${card.qcHistory.length} attempt${card.qcHistory.length>1?'s':''})</p>
        ${historyRows}
      </div>` : ''}

    </div>`;

  panel.style.display = 'block';
  panel.scrollTop = 0;
  window._qcSelectedResult = null;
}

function closeQCPanel() {
  const panel = document.getElementById('qc-panel');
  if (panel) panel.style.display = 'none';
  qcActiveItem = null;
  renderQCDashboard();
}

function qcPhotoPreview(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  document.getElementById('qc-photo-name').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('qc-photo-preview');
    preview.src   = e.target.result;
    preview.style.display = 'block';
    window._qcPhotoData = e.target.result; // base64
  };
  reader.readAsDataURL(file);
}

function qcSelectResult(result) {
  window._qcSelectedResult = result;
  const passBtn = document.getElementById('qc-pass-btn');
  const failBtn = document.getElementById('qc-fail-btn');
  const reworkSection = document.getElementById('qc-rework-section');
  const submitBtn = document.getElementById('qc-submit-btn');

  if (passBtn && failBtn) {
    passBtn.style.borderWidth = result === 'pass' ? '3px' : '2px';
    passBtn.style.background  = result === 'pass' ? '#d1fae5' : '#f0fdf4';
    failBtn.style.borderWidth = result === 'fail' ? '3px' : '2px';
    failBtn.style.background  = result === 'fail' ? '#fecaca' : '#fef2f2';
  }
  if (reworkSection) {
    reworkSection.style.display = result === 'fail' ? 'block' : 'none';
  }
  if (submitBtn) {
    submitBtn.style.opacity = '1';
    submitBtn.style.pointerEvents = 'auto';
    submitBtn.style.background = result === 'pass' ? '#10b981' : '#ef4444';
    submitBtn.textContent = result === 'pass' ? '✓ Confirm pass' : '✗ Confirm fail & send to rework';
  }
}

function submitQCResult() {
  if (!qcActiveItem) return;
  const result    = window._qcSelectedResult;
  if (!result) { curtAlert('Please select Pass or Fail first.'); return; }

  const notes     = (document.getElementById('qc-notes') || {}).value || '';
  const person    = (document.getElementById('qc-person-name') || {}).value || 'QC';
  const photo     = window._qcPhotoData || null;
  const reworkStageEl = document.getElementById('qc-rework-stage');
  const reworkStage   = (result === 'fail' && reworkStageEl) ? reworkStageEl.value : null;

  if (!person.trim()) { curtAlert('Please enter your name.'); return; }

  const ok = recordQCResult(
    qcActiveItem.jobId,
    qcActiveItem.windowId,
    result,
    notes,
    photo,
    person.trim(),
    reworkStage
  );

  if (ok) {
    window._qcPhotoData    = null;
    window._qcSelectedResult = null;
    closeQCPanel();
  }
}


// ══════════════════════════════════════════════════════════════
// INSTALLATION CREW DASHBOARD  (Shibu's crew — separate screen)
// ══════════════════════════════════════════════════════════════

function openInstallCrewDashboard() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');

  let wrap = document.getElementById('install-crew-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'install-crew-wrap';
    wrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:200;background:#f7f9fc;overflow:hidden;';
    document.body.appendChild(wrap);
  }
  wrap.style.display = 'flex';
  renderInstallCrewDashboard();
}

function closeInstallCrewDashboard() {
  const wrap = document.getElementById('install-crew-wrap');
  if (wrap) wrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
  document.querySelectorAll('.module').forEach(m => m.style.display = '');
}

function renderInstallCrewDashboard() {
  const wrap = document.getElementById('install-crew-wrap');
  if (!wrap) return;

  const today = todayStr();

  // Collect all items that are Ready or Installed, grouped by job
  const jobCards = curtainJobs.map(job => {
    ensureItemCards(job);
    const inst   = job.installation || {};
    const allItems = job.windows.filter(w => w.calcDone);
    const ready    = allItems.filter(w => {
      const card = job.itemCards[w.id];
      return card && card.stage === 'Ready' && !card.isRework;
    });
    const installed = allItems.filter(w => {
      const card = job.itemCards[w.id];
      return card && card.stage === 'Installed';
    });
    const total = allItems.length;
    return { job, inst, ready, installed, total };
  }).filter(j => j.total > 0);

  const todayJobs   = jobCards.filter(j => j.inst.scheduledDate === today);
  const upcomingJobs= jobCards.filter(j => j.inst.scheduledDate && j.inst.scheduledDate > today && j.inst.status !== 'complete');
  const readyJobs   = jobCards.filter(j => j.ready.length > 0 && !j.inst.scheduledDate);
  const doneJobs    = jobCards.filter(j => j.inst.status === 'complete');

  function jobInstallCard(jc) {
    const { job, inst, ready, installed, total } = jc;
    const daysToInstall = inst.scheduledDate ? daysBetween(today, inst.scheduledDate) : null;
    const readyPct = total > 0 ? Math.round(((ready.length + installed.length) / total) * 100) : 0;

    return `
      <div style="border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:10px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
          <div>
            <p style="font-size:14px;font-weight:700;color:#1e2a3b;">${job.name}</p>
            <p style="font-size:11px;color:#64748b;">${job.id} · ${job.client}</p>
          </div>
          ${statusPill(inst.status || 'pending')}
        </div>

        <!-- Progress bar -->
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:4px;">
            <span>${ready.length + installed.length} of ${total} items ready</span>
            <span style="color:${readyPct===100?'#10b981':'#f59e0b'};font-weight:600;">${readyPct}%</span>
          </div>
          <div style="background:#e2e8f0;border-radius:4px;height:6px;">
            <div style="width:${readyPct}%;background:${readyPct===100?'#10b981':'#f59e0b'};height:6px;border-radius:4px;transition:width .3s;"></div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:10px;">
          <div><span style="color:#94a3b8;">Install date:</span> <span style="font-weight:600;">${inst.scheduledDate ? fmtDate(inst.scheduledDate) : '—'}</span></div>
          <div><span style="color:#94a3b8;">Site contact:</span> <span style="font-weight:600;">${inst.siteContact || '—'}</span></div>
          <div><span style="color:#94a3b8;">Crew:</span> <span style="font-weight:600;">${inst.team && inst.team.length > 0 ? inst.team.join(', ') : '—'}</span></div>
          ${daysToInstall !== null ? `<div><span style="color:#94a3b8;">Days to install:</span> <span style="font-weight:600;color:${daysToInstall<=1?'#ef4444':daysToInstall<=3?'#f59e0b':'#10b981'};">${daysToInstall}d</span></div>` : ''}
        </div>

        <!-- Items list -->
        ${ready.length > 0 ? `
        <div style="background:#f0fdf4;border:1px solid #d1fae5;border-radius:8px;padding:10px;margin-bottom:8px;">
          <p style="font-size:11px;font-weight:700;color:#10b981;margin-bottom:6px;">Ready to install (${ready.length})</p>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${ready.map(w => `<span style="background:#fff;border:1px solid #d1fae5;border-radius:6px;padding:3px 8px;font-size:11px;color:#1e2a3b;">${w.label}</span>`).join('')}
          </div>
        </div>` : ''}
        ${installed.length > 0 ? `
        <div style="background:#f0fdf4;border-radius:8px;padding:8px 10px;">
          <p style="font-size:11px;color:#10b981;">✓ ${installed.length} item${installed.length>1?'s':''} already installed</p>
        </div>` : ''}

        <!-- Mark installed button -->
        ${ready.length > 0 && inst.status !== 'complete' ? `
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          ${ready.map(w => `
            <button style="background:#1e2a3b;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:12px;cursor:pointer;"
              onclick="markItemInstalled('${job.id}','${w.id}');renderInstallCrewDashboard();">
              ✓ ${w.label} installed
            </button>`).join('')}
        </div>` : ''}

        ${inst.status === 'complete' ? `<div style="margin-top:8px;"><span class="pill ok">✓ All done · Handover signed</span></div>` : ''}
      </div>`;
  }

  function section(title, items, accent) {
    if (items.length === 0) return '';
    return `
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${accent||'#94a3b8'};margin:0 0 10px;">${title} (${items.length})</p>
      ${items.map(i => jobInstallCard(i)).join('')}
      <div style="height:16px;"></div>`;
  }

  const totalReady = jobCards.reduce((s, j) => s + j.ready.length, 0);
  const totalDone  = jobCards.reduce((s, j) => s + j.installed.length, 0);

  wrap.innerHTML = `
    <div style="background:#1e2a3b;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex:none;">
      <div>
        <p style="color:#fff;font-weight:700;font-size:16px;">🏠 Installation Crew</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:2px;">${new Date().toLocaleDateString('en-BH',{day:'numeric',month:'short',year:'numeric'})}</p>
      </div>
      <button onclick="closeInstallCrewDashboard()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;">← Back</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:16px;background:#fff;border-bottom:1px solid #e8ecf0;flex:none;">
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#f59e0b;">${todayJobs.length}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Today</p>
      </div>
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#10b981;">${totalReady}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Items ready</p>
      </div>
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#7c3aed;">${totalDone}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Installed</p>
      </div>
    </div>

    <div style="flex:1;overflow-y:auto;padding:16px;padding-bottom:80px;">
      ${section("Today's installs", todayJobs, '#f59e0b')}
      ${section('Upcoming', upcomingJobs, '#3b82f6')}
      ${section('Ready — not yet scheduled', readyJobs, '#10b981')}
      ${section('Completed', doneJobs, '#94a3b8')}
      ${jobCards.length === 0 ? `
        <div style="text-align:center;padding:48px 20px;">
          <p style="font-size:32px;margin-bottom:8px;">🏠</p>
          <p style="font-size:14px;color:#64748b;">No items ready for installation yet.</p>
        </div>` : ''}
    </div>`;
}

function markItemInstalled(jobId, windowId) {
  const job  = curtainJobs.find(j => j.id === jobId);
  const card = getItemCard(jobId, windowId);
  const win  = job && job.windows.find(w => w.id === windowId);
  if (!card || !win) return;
  card.stage = 'Installed';
  card.stageDates['Installed'] = new Date().toISOString();
  curtAlert(`✓ ${win.label} marked as installed`);
}

// ══════════════════════════════════════════════════════════════
// STARTUP HYDRATION
// data.js loads before this file, so it can only store calc INPUTS
// (calcDone + fields) — it can't call calcFabricWithHems() itself.
// Run once here so Tracks / QC / BOM / Install all have correct figures
// immediately, regardless of which page is opened first.
// ══════════════════════════════════════════════════════════════
curtainJobs.forEach(job => {
  job.windows.forEach(w => {
    w.wastageBuffer = job.wastageBuffer;
    if (w.calcDone && !w.calc) w.calc = calcFabricWithHems(w);
  });
  ensureItemCards(job);
});


