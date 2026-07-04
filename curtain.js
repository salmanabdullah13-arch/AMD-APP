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

const STITCH_TEAM = ['Waseem', 'Aslam', 'Rijwan', 'Ibrahim', 'Silva'];
const TRACK_TEAM  = ['Abdullah', 'Prince'];
const INSTALL_CREW = ['Shibu', 'Sohail', 'Mushraf', 'Furqan', 'Shahzad', 'Saeed'];

// QC department doesn't exist yet (as of 3 Jul 2026) — unlike STITCH_TEAM/
// TRACK_TEAM/INSTALL_CREW above, there are no real names to hardcode.
// `let` (not `const`) so names can be added from the QC panel itself as
// people are hired — tap "+ Add QC person" once, then it's on the roster
// for tap-select from then on. Once the department is staffed for real,
// swap this back to a `const` with the actual names, matching the other
// rosters.
let QC_TEAM = [];

// ── Labour tab (formerly "Workshop") — task roles a person can be
// assigned per job. Any name in STITCH_TEAM can take any role, and roles
// can repeat across people (e.g. two people ironing) or across jobs.
// 'Other' reveals a free-text box — used for a same-day replacement pulled
// from Upholstery when someone on STITCH_TEAM is out sick, until a full
// cross-department staff roster exists.
const LABOUR_ROLES = ['Cutting', 'Stitching', 'Heming', 'Tape Header Fixing', 'Ironing', 'Other'];

// ── State ──────────────────────────────
let curtCurrentJob   = null;
let curtCurrentPage  = 'curt-dashboard';
let roomCollapsed    = {};
let calcSheetWinId   = null;
let copyCalcSourceId = null;

// ── WIP tab (formerly Labour) state ────
let wipProjectPanelOpen = false;
let wipProjectDraft = { team: [], startDate: '', endDate: '' };

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
  if (pageId === 'curt-workshop')  showWipPicker();
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
  // Build stage timeline from per-window labour + install data
  const inst = job.installation || {};
  const stages = [];

  // Labour (stitching crew) stage — aggregated across every window's own
  // itemCard.labour (source of truth lives per-window since the WIP tab
  // rebuild; this rolls them up into one project-level bar spanning the
  // earliest start to the latest end across all windows).
  ensureItemCards(job);
  const labourEntries = job.windows
    .filter(w => w.calcDone)
    .map(w => job.itemCards[w.id] && job.itemCards[w.id].labour)
    .filter(l => l && (l.startDate || l.endDate));
  if (labourEntries.length) {
    const starts = labourEntries.map(l => l.startDate).filter(Boolean);
    const ends   = labourEntries.map(l => l.endDate).filter(Boolean);
    const start  = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null;
    const end    = ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null;
    const anyStaffed = labourEntries.some(l => l.team.length && l.team.some(r => r.worker));
    const labourStatus = anyStaffed ? 'in_progress' : 'pending';
    stages.push({
      label: 'Labour',
      start, end,
      status: labourStatus,
      color: stageColor(labourStatus),
    });
  }

  // Track making stage — status is computed live (no longer depends on
  // the Workshop/WIP tab having rendered first to populate it).
  const tmStatus = computeTrackMakingStatus(job);
  stages.push({
    label: 'Track Making',
    start: null,
    end:   null,
    status: tmStatus,
    color: stageColor(tmStatus),
  });

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
// DASHBOARD — INFOGRAPHIC HELPERS
// Ring gauges + mini bar charts. Everything below reads data that is
// ALREADY recorded elsewhere (QC history, stage timestamps, KPI calc) —
// no new fields added to data.js. Per-session rule: schema changes are
// a separate, deliberate task, not bundled into a visual restyle.
// ══════════════════════════════════════════

// SVG ring gauge — single stroke-dasharray ring, percent-based.
// Caller decides color so it can carry status meaning (ok/warn/bad/purple).
function svgRingGauge(pct, color, size = 84, strokeWidth = 9) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${strokeWidth}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
        stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
    </svg>`;
}

function ringStatCard(pct, valueLabel, title, sub, color) {
  return `
    <div class="ring-card">
      <div class="ring-wrap">
        ${svgRingGauge(pct, color)}
        <div class="ring-center"><p class="ring-value" style="color:${color}">${valueLabel}</p></div>
      </div>
      <p class="ring-title">${title}</p>
      <p class="ring-sub">${sub}</p>
    </div>`;
}

// Mini vertical bar chart. items: [{label, value, color}]
function svgMiniBars(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return `<div class="mini-bars">
    ${items.map(i => `
      <div class="mini-bar-col">
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="height:${Math.max(3, Math.round((i.value/max)*100))}%;background:${i.color || 'var(--purple)'};"></div>
        </div>
        <p class="mini-bar-val">${i.value}</p>
        <p class="mini-bar-label">${i.label}</p>
      </div>`).join('')}
  </div>`;
}

// ── QC quality stats — pure aggregation of collectAllQCHistory(), which
// already exists for the QC Performance tab. Adds a reject-reason
// breakdown by reading the checklist[] each fail attempt already saves.
function getCurtainQCStats() {
  const rows = collectAllQCHistory();
  if (rows.length === 0) {
    return { pct: null, passCount: 0, total: 0, avgTurnaroundLabel: '—', reject: [] };
  }
  const passCount = rows.filter(r => r.h.result === 'pass').length;
  const pct = Math.round((passCount / rows.length) * 100);

  const turnarounds = rows.map(r => qcTurnaroundMs(r.h)).filter(ms => ms != null);
  const avgMs = turnarounds.length ? turnarounds.reduce((a,b) => a+b, 0) / turnarounds.length : null;

  const counts = {};
  rows.forEach(r => {
    if (r.h.result !== 'fail') return;
    (r.h.checklist || []).forEach(c => { if (!c.ok) counts[c.label] = (counts[c.label] || 0) + 1; });
  });
  const reject = Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return { pct, passCount, total: rows.length, avgTurnaroundLabel: avgMs != null ? qcTurnaroundLabel(avgMs) : '—', reject };
}

// ── Windows reaching QC per day, last N days — built purely from
// qcHistory timestamps that already get written by recordQCResult().
function getWindowsToQCPerDay(days = 7) {
  const counts = {}, order = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0,10);
    counts[key] = 0; order.push(key);
  }
  curtainJobs.forEach(job => {
    ensureItemCards(job);
    job.windows.forEach(w => {
      if (!w.calcDone) return;
      const card = job.itemCards[w.id];
      if (!card) return;
      (card.qcHistory || []).forEach(h => {
        const key = (h.timestamp || '').slice(0,10);
        if (key in counts) counts[key]++;
      });
    });
  });
  return order.map(key => ({ label: new Date(key).toLocaleDateString('en-BH', { weekday: 'short' }), value: counts[key] }));
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════

function renderCurtDashboard() {
  const kpis = getCurtainKPIs();
  const finishedTotals = getAllJobsStitchingFinishedCount();
  const qc = getCurtainQCStats();
  const qcColor = qc.pct == null ? 'var(--ink3)' : qc.pct >= 90 ? 'var(--ok)' : qc.pct >= 75 ? 'var(--warn)' : 'var(--bad)';
  const stitchPct = finishedTotals.total > 0 ? Math.round((finishedTotals.finished / finishedTotals.total) * 100) : 0;
  const qcVolume = getWindowsToQCPerDay(7);

  document.getElementById('curt-kpis').innerHTML = `
    <div class="dash-rings">
      ${ringStatCard(stitchPct, `${stitchPct}%`, 'Stitching Finished', `${finishedTotals.finished} of ${finishedTotals.total} windows`, 'var(--purple)')}
      ${ringStatCard(qc.pct ?? 0, qc.pct == null ? '—' : `${qc.pct}%`, 'QC Pass Rate', qc.total ? `${qc.passCount} of ${qc.total} attempts` : 'No inspections yet', qcColor)}
    </div>

    <div class="stat-strip">
      <div class="stat-tile">
        <p class="st-v">${qc.avgTurnaroundLabel}</p>
        <p class="st-l">Avg QC turnaround</p>
      </div>
      <div class="stat-tile">
        <p class="st-v" style="color:var(--purple);">${kpis.totalRunningJobs}</p>
        <p class="st-l">Running jobs</p>
      </div>
      <div class="stat-tile">
        <p class="st-v" style="color:${kpis.windowsBehindSchedule>0?'var(--bad)':'var(--ink)'};">${kpis.windowsBehindSchedule}</p>
        <p class="st-l">Behind schedule</p>
      </div>
    </div>

    <p class="dash-section-title">Windows reaching QC — last 7 days</p>
    ${svgMiniBars(qcVolume.map(d => ({ label: d.label, value: d.value, color: 'var(--purple)' })))}

    <p class="dash-section-title">Reject reasons (all-time)</p>
    ${qc.reject.length > 0
      ? svgMiniBars(qc.reject.map(r => ({ label: r.label.length > 12 ? r.label.slice(0,11)+'…' : r.label, value: r.count, color: 'var(--bad)' })))
      : '<p style="font-size:12px;color:var(--ink3);padding:6px 0 4px;">No QC fails recorded yet.</p>'}

    <p class="dash-section-title">BOM &amp; materials</p>
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

    <p class="dash-section-title">Work in progress</p>
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
      <div class="kpi">
        <p class="kl">Items to produce</p>
        <p class="kv" style="color:var(--purple)">${kpis.totalItemsToProduce}</p>
        <p class="ks">windows across all jobs</p>
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

  // Accounts trigger: jobs where every item has passed QC — balance invoice
  // can be requested before installation. No BD figures shown here (Curtain
  // stays cost-free); this just flags the job for Operations/Accounts.
  // NOTE: this currently only surfaces inside the Curtain module. Wiring it
  // into the Operations alert feed (operations.js) is a follow-up — that
  // file wasn't in context this session.
  const accountsAlertJobs = curtainJobs.filter(j => j.accountsAlert && !j.accountsAlert.seen);
  const accountsBox = document.getElementById('curt-accounts-alerts');
  if (accountsBox) {
    accountsBox.innerHTML = accountsAlertJobs.length === 0 ? '' : accountsAlertJobs.map(j => `
      <div class="alert-bar" style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);">
        <div>
          <span style="font-weight:700;">${j.name}</span>
          <span style="color:var(--ink2);font-size:12px;margin-left:6px;">All items QC passed · ${fmtDate(j.installation.qcCompleteAt)}</span>
        </div>
        <div class="av" style="display:flex;gap:8px;align-items:center;">
          <span style="color:#3b82f6;font-weight:600;">Request balance invoice before install</span>
          <button class="sm sec" onclick="ackAccountsAlert('${j.id}')">Mark sent</button>
        </div>
      </div>`).join('');
  }

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

function ackAccountsAlert(jobId) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job || !job.accountsAlert) return;
  job.accountsAlert.seen = true;
  job.accountsAlert.seenAt = new Date().toISOString();
  curtAlert(`✓ Marked as sent to Accounts — ${job.name}`);
  renderCurtDashboard();
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

// ── Live crew banner — who's on this job right now (from WIP tab) ──
// Aggregated across every window's own itemCard.labour, since labour is
// assigned per-window now rather than once for the whole job.
function renderCrewBanner(job) {
  if (!job.itemCards) return '';
  const active = [];
  job.windows.forEach(w => {
    const card = job.itemCards[w.id];
    if (card && card.labour) {
      card.labour.team.filter(r => r.worker).forEach(r => active.push(r));
    }
  });
  if (!active.length) return '';
  const seen = new Set();
  const unique = active.filter(r => {
    const key = (r.worker === 'Other' ? r.otherName : r.worker) + '|' + r.role;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return `
    <div style="background:var(--card2,#f7f9fc);border:1px solid var(--line);border-radius:var(--r3);padding:8px 12px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
      <span style="font-size:11px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px;">👷 On this job:</span>
      ${unique.map(r => `<span class="pill grey" style="font-size:11px;">${r.worker==='Other'?(r.otherName||'—'):r.worker} — ${r.role||'—'}</span>`).join('')}
    </div>`;
}

// ── Room accordion ─────────────────────
function renderRooms() {
  const rooms = getWindowsByRoom(curtCurrentJob);
  let html = renderCrewBanner(curtCurrentJob);
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
  const done   = w.calcDone && w.calc;
  const locked = !!(curtCurrentJob && (curtCurrentJob.budgetStatus === 'approved' || curtCurrentJob.budgetStatus === 'pending'));
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
        <button class="${done ? 'copy' : 'primary'}" style="font-size:12px;white-space:nowrap;${locked ? 'opacity:.45;cursor:not-allowed;' : ''}"
          ${locked ? 'disabled' : `onclick="openCalcSheet('${w.id}')"`}>
          ${done ? 'Edit calc' : 'Open calc →'}
        </button>
        ${done ? `
        <button class="sec" style="font-size:12px;white-space:nowrap;${locked ? 'opacity:.45;cursor:not-allowed;' : ''}"
          ${locked ? 'disabled' : `onclick="openCopyCalcPicker('${w.id}')"`}>
          Copy to others →
        </button>` : ''}
        ${locked ? (curtCurrentJob.budgetStatus === 'approved'
            ? '<span class="pill ok" style="font-size:10px;text-align:center;">🔒 BOM approved</span>'
            : '<span class="pill warn" style="font-size:10px;text-align:center;">🔒 Pending Ops approval</span>') : ''}
      </div>
    </div>`;
}

// ── Stage-advance block (NOT currently rendered on Windows tab) ──
// Windows tab is BOM-entry only now (calc sheets), per Salman's 4/7/2026
// feedback — production stage tracking (Mark X complete) doesn't belong
// here anymore. This function is kept as-is, unused for now, because it
// will be reused in the Production tab rebuild (formerly Labour tab).
// Silva leads the department, so she sees BOTH tracks here: the fabric
// track is hers to advance (Cutting/Stitching), the rail track is shown
// read-only underneath so she can see where the track team is without
// being able to mark it for them — that stays self-picked in the Tracks
// Dashboard. Once both tracks converge the item moves to Hoist QC.
function renderWinStageAction(w) {
  if (!curtCurrentJob) return '';
  const jobId = curtCurrentJob.id;
  const card  = getItemCard(jobId, w.id);
  if (!card) return '';

  // Terminal / QC states — unified status, no track breakdown needed
  if (['Hoist QC', 'Ready', 'Installed'].includes(card.stage) && !card.isRework) {
    if (card.stage === 'Hoist QC') {
      return `<div style="margin-top:6px;padding:8px 10px;background:var(--ok-bg,#d1fae5);border:1px solid var(--ok-line,#10b981);border-radius:8px;">
        <span style="color:var(--ok,#10b981);font-weight:700;font-size:12px;">✓ Finished — Sent to QC</span>
      </div>`;
    }
    return `<div style="margin-top:4px;">${statusPill(card.stage.toLowerCase())}</div>`;
  }

  const fab  = getFabricDisplay(card);
  const rail = getRailDisplay(card);
  // Guard: production can't be marked complete on a window with nobody
  // assigned to do the work. card.labour.team is always an array (via
  // ensureCardLabour), so this only checks for a real worker in it.
  const labourAssigned = !!(card.labour && card.labour.team && card.labour.team.some(r =>
    r.worker && (r.worker !== 'Other' || (r.otherName && r.otherName.trim()))
  ));
  let html = '<div style="margin-top:4px;display:flex;flex-direction:column;gap:5px;">';

  if (fab.stage) {
    if (fab.stage === 'Done') {
      html += `<div><span class="pill ok" style="font-size:10px;">✓ Fabric done</span></div>`;
    } else {
      // Silva gets one button regardless of internal sub-stage (Cutting vs
      // Stitching) — clicking it finishes the whole fabric side in one go.
      html += `
        <div>
          ${fab.isRework ? `<span class="pill bad" style="font-size:10px;">Rework → ${fab.stage}</span>` : `<span class="pill warn" style="font-size:10px;">${fab.stage}</span>`}
        </div>`;
      if (labourAssigned) {
        html += `
        <button style="font-size:11px;white-space:nowrap;background:var(--ok,#10b981);color:#fff;border:none;font-weight:700;"
          onclick="${fab.isRework ? `finishFabricRework('${jobId}','${w.id}')` : `finishFabricWork('${jobId}','${w.id}')`};renderWipWindows();renderWipGantt();">
          Mark Fabric Complete →
        </button>`;
      } else {
        html += `<p style="font-size:11px;color:var(--warn,#f59e0b);font-weight:600;margin:2px 0 0;">⚠️ Add labour to mark complete</p>`;
      }
    }
  }

  if (rail.stage) {
    const railLabel = rail.stage === 'Done' ? 'Rail done' : `Rail: ${rail.stage}${rail.isRework ? ' (rework)' : ''}`;
    html += `<div style="font-size:10px;color:var(--ink2);">🔩 ${railLabel} <span style="opacity:.7;">— with track team</span></div>`;
  }

  html += '</div>';
  return html;
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
  curtAlert('✓ BOM generated from calc sheets.');
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

  renderCurtainApprovalSection();
}

// ── Budget approval section — single source of truth for the 4 states ──
// (never submitted / pending review / rejected / approved). Called on every
// BOM render so the correct state always shows, whether the job was just
// acted on or reopened fresh from the picker.
function renderCurtainApprovalSection() {
  const job = curtCurrentJob;
  if (!job) return;
  const approvalSection = document.getElementById('cb-approval-section');
  const approvalDone    = document.getElementById('cb-approval-done');
  const rejectionBanner = document.getElementById('cb-rejection-banner');
  const submitBtn       = document.getElementById('cb-submit-btn');
  if (!approvalSection || !approvalDone) return;

  rejectionBanner.style.display = 'none';
  approvalSection.style.display = 'none';
  approvalDone.style.display    = 'none';

  if (job.budgetStatus === 'approved') {
    approvalDone.style.display = 'block';
    approvalDone.textContent = '✓ Budget approved by Operations — production can proceed.';
    approvalDone.style.background = 'var(--ok-bg)'; approvalDone.style.borderColor = 'var(--ok-line)'; approvalDone.style.color = 'var(--ok)';
  } else if (job.budgetStatus === 'pending') {
    approvalDone.style.display = 'block';
    approvalDone.textContent = '⏳ BOM submitted — awaiting Operations Manager approval. Production on hold until approved.';
    approvalDone.style.background = 'var(--warn-bg)'; approvalDone.style.borderColor = 'var(--warn-line)'; approvalDone.style.color = 'var(--warn)';
  } else if (job.budgetStatus === 'rejected') {
    rejectionBanner.style.display = 'block';
    rejectionBanner.innerHTML = `<b>✕ Sent back by Operations</b><br>${job.bomRejectionComment ? job.bomRejectionComment : '(no comment left)'}`;
    approvalSection.style.display = 'block';
    if (submitBtn) submitBtn.textContent = 'Fix & resubmit for budget approval →';
  } else {
    // bom_pending / never submitted
    approvalSection.style.display = 'block';
    if (submitBtn) submitBtn.textContent = 'Submit for budget approval →';
  }
}

function submitCurtainBudget() {
  if (!curtCurrentJob) return;
  curtCurrentJob.bomStatus            = 'submitted';
  curtCurrentJob.budgetStatus         = 'pending';
  curtCurrentJob.bomRejectionComment  = null; // clear any prior rejection note on (re)submit
  renderCurtainApprovalSection();
  // Editing is now locked (budgetStatus === 'pending') — refresh the windows
  // list so calc-sheet buttons show the locked state immediately.
  if (typeof renderWindowSchedule === 'function') renderWindowSchedule();
}


// ══════════════════════════════════════════
// WORKSHOP TAB
// ══════════════════════════════════════════

// ── Track Making status is now fully automatic — no manual entry.
// Derived live from item-card stages, so Silva never assigns dates or
// people here; track makers self-pick per item in the Tracks Dashboard
// (Cutting → Assembly/Track work → Hoist QC → Ready).
function computeTrackMakingStatus(job) {
  const items = job.windows.filter(w => w.calcDone && needsTrackWork(w));
  if (items.length === 0) return 'pending';
  ensureItemCards(job);
  const allReady = items.every(w => {
    const card = job.itemCards[w.id];
    return card && !card.isRework && (card.stage === 'Ready' || card.stage === 'Installed');
  });
  if (allReady) return 'ready';
  const anyStarted = items.some(w => {
    const card = job.itemCards[w.id];
    if (!card) return false;
    if (card.isRework) return true;
    if (card.stage !== 'Production') return true; // past production = started
    if (!card.railTrack) return false; // no rail track to have started
    const railStages = getProdTracks(w.treatment).rail;
    return card.railTrack.done || card.railTrack.stage !== railStages[0];
  });
  return anyStarted ? 'in_production' : 'pending';
}

// ══════════════════════════════════════════
// WIP TAB (formerly Labour tab)
// ══════════════════════════════════════════

// ── Job picker (entry point) ────────────
function showWipPicker() {
  const picker = document.getElementById('curt-wip-picker');
  const detail = document.getElementById('curt-wip-detail');
  if (picker) picker.style.display = 'block';
  if (detail) detail.style.display = 'none';

  const listEl = document.getElementById('curt-wip-job-list');
  if (listEl) {
    listEl.innerHTML = curtainJobs.map(job => {
      const approved = job.budgetStatus === 'approved';
      const behindCount = approved ? getBehindScheduleWindows(job).length : 0;
      const finishedCount = approved ? getJobStitchingFinishedCount(job) : null;
      return `
      <div class="job-pick" ${approved ? `onclick="openWipDetail('${job.id}')"` : ''} style="${approved ? '' : 'opacity:.5;'}">
        <div>
          <p class="jp-name">${job.name}</p>
          <p class="jp-meta">${job.id} · ${job.client} · ${totalWindowQty(job)} windows</p>
          ${finishedCount && finishedCount.total > 0 ? `<p class="jp-meta" style="color:var(--ok);margin-top:3px;font-weight:600;">✓ ${finishedCount.finished} of ${finishedCount.total} stitching finished</p>` : ''}
          ${behindCount > 0 ? `<p class="jp-meta" style="color:var(--bad);margin-top:3px;">⚠ ${behindCount} window${behindCount>1?'s':''} behind schedule</p>` : ''}
        </div>
        ${approved ? statusPill(job.status) : '<span class="pill warn" style="font-size:10px;">🔒 Awaiting budget approval</span>'}
      </div>`;
    }).join('') || '<p style="font-size:13px;color:var(--ink2);">No curtain jobs yet.</p>';
  }

  // Project-level (all-jobs) overview Gantt lives at the picker level
  renderGanttFull('curt-workshop-gantt', 5);
}

// ── Job detail — window-by-window breakdown ─
function openWipDetail(jobId) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job || job.budgetStatus !== 'approved') return;
  curtCurrentJob = job;
  ensureItemCards(job);

  document.getElementById('curt-wip-picker').style.display = 'none';
  document.getElementById('curt-wip-detail').style.display = 'block';
  document.getElementById('wip-job-name').textContent = job.name;
  document.getElementById('wip-job-meta').textContent = `${job.id} · ${job.client}`;

  wipProjectPanelOpen = false;
  wipProjectDraft = { team: [], startDate: '', endDate: '' };
  renderWipDetail();
}

function renderWipDetail() {
  if (!curtCurrentJob) return;
  ensureItemCards(curtCurrentJob);
  renderWipProjectPanel();
  renderWipWindows();
  renderWipGantt();
}

// ── "Assign as project" — one-time bulk fill ─
// Fills the same team + dates onto every window's itemCard.labour in one
// shot. This is a one-time copy, not a persistent link — editing a window
// afterward only changes that window, nothing stays tied together.
function toggleWipProjectPanel() {
  wipProjectPanelOpen = !wipProjectPanelOpen;
  if (wipProjectPanelOpen) wipProjectDraft = { team: [], startDate: '', endDate: '' };
  renderWipProjectPanel();
}

function renderWipProjectPanel() {
  const el = document.getElementById('wip-project-panel');
  if (!el) return;

  if (!wipProjectPanelOpen) {
    el.innerHTML = `<button class="sec" style="font-size:12px;" onclick="toggleWipProjectPanel()">⚡ Assign as project — fill all windows at once</button>`;
    return;
  }

  el.innerHTML = `
    <div class="card" style="background:var(--card2,#f7f9fc);">
      <p class="card-title" style="margin-bottom:6px;">⚡ Assign as project</p>
      <p style="font-size:11px;color:var(--ink2);margin-bottom:10px;">
        Fills the same team and dates onto every window below in one go. It's a one-time copy —
        editing a window afterward only changes that window.
      </p>
      <div class="row2" style="margin-bottom:10px;">
        <div class="field">
          <label>Start date</label>
          <input type="date" id="wip-proj-start" value="${wipProjectDraft.startDate||''}"
            onchange="wipProjectDraft.startDate=this.value">
        </div>
        <div class="field">
          <label>End date</label>
          <input type="date" id="wip-proj-end" value="${wipProjectDraft.endDate||''}"
            onchange="wipProjectDraft.endDate=this.value">
        </div>
      </div>
      <div id="wip-proj-team"></div>
      <button class="sec" style="font-size:12px;" onclick="addWipProjectRow()">+ Add worker</button>
      <div class="btnrow" style="margin-top:10px;">
        <button class="primary" onclick="applyWipProject()">Apply to all windows →</button>
        <button class="sec" onclick="toggleWipProjectPanel()">Cancel</button>
      </div>
    </div>`;
  renderWipProjectTeamRows();
}

function addWipProjectRow() {
  wipProjectDraft.team.push({ id: 'wp_' + Date.now() + '_' + Math.floor(Math.random() * 1000), worker: '', role: '', otherName: '' });
  renderWipProjectTeamRows();
}

function removeWipProjectRow(rowId) {
  wipProjectDraft.team = wipProjectDraft.team.filter(r => r.id !== rowId);
  renderWipProjectTeamRows();
}

function updateWipProjectRow(rowId, field, value) {
  const row = wipProjectDraft.team.find(r => r.id === rowId);
  if (!row) return;
  row[field] = value;
  if (field === 'worker' && value !== 'Other') row.otherName = '';
}

function renderWipProjectTeamRows() {
  const el = document.getElementById('wip-proj-team');
  if (!el) return;
  el.innerHTML = wipProjectDraft.team.map(row => `
    <div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;margin-bottom:8px;padding:8px;background:var(--card,#fff);border-radius:8px;">
      <div class="field" style="flex:1;min-width:110px;">
        <label>Worker</label>
        <select onchange="updateWipProjectRow('${row.id}','worker',this.value)">
          <option value="">— Select —</option>
          ${STITCH_TEAM.map(t => `<option value="${t}" ${row.worker===t?'selected':''}>${t}</option>`).join('')}
          <option value="Other" ${row.worker==='Other'?'selected':''}>Other (replacement)…</option>
        </select>
        ${row.worker === 'Other' ? `
        <input type="text" placeholder="Name — e.g. from Upholstery" value="${row.otherName||''}"
          style="margin-top:4px;" onchange="updateWipProjectRow('${row.id}','otherName',this.value)">` : ''}
      </div>
      <div class="field" style="flex:1;min-width:110px;">
        <label>Task</label>
        <select onchange="updateWipProjectRow('${row.id}','role',this.value)">
          <option value="">— Select —</option>
          ${LABOUR_ROLES.map(r => `<option value="${r}" ${row.role===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
      <button class="sec" style="font-size:11px;padding:6px 8px;color:var(--bad,#ef4444);" onclick="removeWipProjectRow('${row.id}')">✕</button>
    </div>`).join('') || '<p style="font-size:12px;color:var(--ink2);">No workers added yet.</p>';
}

function applyWipProject() {
  const job = curtCurrentJob;
  if (!job) return;
  const start = document.getElementById('wip-proj-start').value;
  const end   = document.getElementById('wip-proj-end').value;
  ensureItemCards(job);
  job.windows.filter(w => w.calcDone).forEach(w => {
    const card = job.itemCards[w.id];
    if (!card) return;
    card.labour = {
      startDate: start,
      endDate:   end,
      team: wipProjectDraft.team.map(r => ({ ...r, id: 'lab_' + Date.now() + '_' + Math.floor(Math.random() * 1000) })),
    };
  });
  curtAlert(`⚡ Team + dates applied to all windows on ${job.name}`);
  wipProjectDraft = { team: [], startDate: '', endDate: '' };
  wipProjectPanelOpen = false;
  renderWipDetail();
}

// ── Per-window labour row helpers ───────
function addWinLabourRow(jobId, windowId) {
  const card = getItemCard(jobId, windowId);
  if (!card) return;
  ensureCardLabour(card).team.push({ id: 'lab_' + Date.now() + '_' + Math.floor(Math.random() * 1000), worker: '', role: '', otherName: '' });
  renderWipWindows();
  renderWipGantt();
}

function removeWinLabourRow(jobId, windowId, rowId) {
  const card = getItemCard(jobId, windowId);
  if (!card || !card.labour) return;
  card.labour.team = card.labour.team.filter(r => r.id !== rowId);
  renderWipWindows();
  renderWipGantt();
}

function updateWinLabourRow(jobId, windowId, rowId, field, value) {
  const card = getItemCard(jobId, windowId);
  if (!card || !card.labour) return;
  const row = card.labour.team.find(r => r.id === rowId);
  if (!row) return;
  row[field] = value;
  if (field === 'worker' && value !== 'Other') row.otherName = '';
  renderWipWindows();
  renderWipGantt();
}

function replaceWinLabourWorker(jobId, windowId, rowId, newWorker) {
  const card = getItemCard(jobId, windowId);
  if (!card || !card.labour || !newWorker) return;
  const row = card.labour.team.find(r => r.id === rowId);
  if (!row) return;
  if (!row.replacedLog) row.replacedLog = [];
  row.replacedLog.push({ was: row.worker || row.otherName || '(unassigned)', at: new Date().toISOString() });
  row.worker = newWorker;
  row.otherName = '';
  curtAlert(`🔁 ${row.role || 'Role'} reassigned to ${newWorker}`);
  renderWipWindows();
}

function updateWinLabourDates(jobId, windowId, field, value) {
  const card = getItemCard(jobId, windowId);
  if (!card) return;
  ensureCardLabour(card)[field] = value;
  renderWipGantt();
}

// ── Window list — fabric/rail stage advance + per-window labour ─
function renderWipWindows() {
  const job = curtCurrentJob;
  if (!job) return;
  ensureItemCards(job);

  const approved = job.budgetStatus === 'approved';
  const lockMsg = !approved
    ? `<div class="ws-lock"><span>🔒</span><p>Budget must be approved before production starts</p></div>`
    : '';

  const windows = job.windows.filter(w => w.calcDone);

  const finishedCount = getJobStitchingFinishedCount(job);
  const trackerHtml = finishedCount.total > 0 ? `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 12px;background:${finishedCount.finished === finishedCount.total ? 'var(--ok-bg,#d1fae5)' : 'var(--card2,#f7f9fc)'};border-radius:8px;">
      <div style="flex:1;background:var(--line);border-radius:4px;height:6px;">
        <div style="width:${Math.round((finishedCount.finished/finishedCount.total)*100)}%;background:var(--ok,#10b981);height:6px;border-radius:4px;transition:width .3s;"></div>
      </div>
      <span style="font-size:12px;font-weight:700;color:var(--ok,#10b981);white-space:nowrap;">${finishedCount.finished} of ${finishedCount.total} stitching finished</span>
    </div>` : '';

  let html = lockMsg + trackerHtml + `<div style="${!approved ? 'opacity:.45;pointer-events:none;' : ''}">`;

  if (!windows.length) {
    html += `<p style="font-size:13px;color:var(--ink2);">No calc sheets done yet — complete window calc sheets first.</p>`;
  }

  windows.forEach(w => {
    const card = job.itemCards[w.id];
    if (!card) return;
    ensureCardLabour(card);

    html += `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:2px;">
          <div>
            <p style="font-weight:700;font-size:14px;">${w.label}</p>
            <p style="font-size:11px;color:var(--ink2);">${w.room || ''}</p>
          </div>
          ${itemCardStagePill(card, w.treatment)}
        </div>

        ${renderWinStageAction(w)}

        <div style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px;">
          <p style="font-size:11px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">👷 Labour — this window</p>

          <div class="row2" style="margin-bottom:8px;">
            <div class="field">
              <label>Start date</label>
              <input type="date" value="${card.labour.startDate||''}"
                onchange="updateWinLabourDates('${job.id}','${w.id}','startDate',this.value)">
            </div>
            <div class="field">
              <label>End date</label>
              <input type="date" value="${card.labour.endDate||''}"
                onchange="updateWinLabourDates('${job.id}','${w.id}','endDate',this.value)">
            </div>
          </div>

          ${card.labour.team.map(row => `
            <div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;margin-bottom:8px;padding:8px;background:var(--card2,#f7f9fc);border-radius:8px;">
              <div class="field" style="flex:1;min-width:110px;">
                <label>Worker</label>
                <select onchange="updateWinLabourRow('${job.id}','${w.id}','${row.id}','worker',this.value)">
                  <option value="">— Select —</option>
                  ${STITCH_TEAM.map(t => `<option value="${t}" ${row.worker===t?'selected':''}>${t}</option>`).join('')}
                  <option value="Other" ${row.worker==='Other'?'selected':''}>Other (replacement)…</option>
                </select>
                ${row.worker === 'Other' ? `
                <input type="text" placeholder="Name — e.g. from Upholstery" value="${row.otherName||''}"
                  style="margin-top:4px;" onchange="updateWinLabourRow('${job.id}','${w.id}','${row.id}','otherName',this.value)">` : ''}
              </div>
              <div class="field" style="flex:1;min-width:110px;">
                <label>Task</label>
                <select onchange="updateWinLabourRow('${job.id}','${w.id}','${row.id}','role',this.value)">
                  <option value="">— Select —</option>
                  ${LABOUR_ROLES.map(r => `<option value="${r}" ${row.role===r?'selected':''}>${r}</option>`).join('')}
                </select>
              </div>
              <button class="sec" style="font-size:11px;padding:6px 8px;white-space:nowrap;"
                onclick="const n=prompt('Replace with who?'); if(n) replaceWinLabourWorker('${job.id}','${w.id}','${row.id}',n);">
                🔁 Replace
              </button>
              <button class="sec" style="font-size:11px;padding:6px 8px;color:var(--bad,#ef4444);"
                onclick="removeWinLabourRow('${job.id}','${w.id}','${row.id}')">✕</button>
            </div>
            ${row.replacedLog && row.replacedLog.length ? `
              <p style="font-size:10px;color:var(--ink2);margin:-4px 0 8px 8px;">
                ${row.replacedLog.map(l => `was ${l.was} until ${fmtDate(l.at)}`).join(' · ')}
              </p>` : ''}
          `).join('')}

          <button class="sec" style="font-size:12px;" onclick="addWinLabourRow('${job.id}','${w.id}')">+ Add worker</button>
        </div>
      </div>`;
  });

  html += `</div>`;
  document.getElementById('wip-windows').innerHTML = html;

  // Track Making — job-level, fully automatic (unchanged behaviour)
  const trackLines = buildTrackSummaryForJob(job);
  const tmStatus = computeTrackMakingStatus(job);
  const tmEl = document.getElementById('wip-track-making');
  if (tmEl) {
    tmEl.innerHTML = `
      <p class="card-title" style="margin-bottom:10px;">🔩 Track Making <span style="font-weight:400;color:var(--ink2);font-size:11px;">(auto — self-pick by track team)</span></p>
      ${trackLines.length > 0 ? `
      <div style="background:var(--card2,rgba(124,58,237,.05));border:1px solid rgba(124,58,237,.15);border-radius:var(--r3);padding:10px 12px;margin-bottom:10px;">
        <p style="font-size:11px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Rail requirements (from calc sheets)</p>
        ${trackLines.map(t => `
          <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid var(--line);">
            <span style="font-weight:600;">${t.type}</span>
            <span style="color:var(--ink2);">${t.qty} × · ${t.totalM} m total</span>
          </div>`).join('')}
      </div>` : `<p style="font-size:12px;color:var(--ink2);margin-bottom:10px;">No track data yet — complete window calc sheets first.</p>`}
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        ${statusPill(tmStatus||'pending')}
        <span style="font-size:12px;color:var(--ink2);">Approved jobs feed straight into the Tracks Dashboard — ${TRACK_TEAM.join(' / ')} pick their own items there, nothing to assign here.</span>
      </div>
      <button class="sec" style="font-size:12px;margin-top:8px;" onclick="openTracksDashboard();">Open Tracks Dashboard →</button>`;
  }
}

// ── Window-level Gantt — one row per window, driven by itemCard.labour ─
function buildWindowGanttRows(job) {
  const rows = [];
  job.windows.filter(w => w.calcDone).forEach(w => {
    const card = job.itemCards ? job.itemCards[w.id] : null;
    if (!card) return;
    const labour = card.labour;
    const stages = [];
    if (labour && (labour.startDate || labour.endDate)) {
      const status = !labour.team.length ? 'pending'
        : labour.team.every(r => r.worker) ? 'in_progress' : 'pending';
      stages.push({ label: 'Labour', start: labour.startDate || null, end: labour.endDate || null, status, color: stageColor(status) });
    }
    rows.push({ label: w.label, stages });
  });
  return rows;
}

function renderWipGantt() {
  const job = curtCurrentJob;
  const el  = document.getElementById('wip-window-gantt');
  if (!job || !el) return;

  const weeks      = getGanttWeeks(5);
  const today      = new Date(); today.setHours(0, 0, 0, 0);
  const totalStart = weeks[0].start;
  const totalEnd   = weeks[weeks.length - 1].end;
  const totalMs    = totalEnd - totalStart;
  const todayPct   = Math.min(100, Math.max(0, ((today - totalStart) / totalMs) * 100));

  const rows = buildWindowGanttRows(job);

  let html = `<div class="gantt-wrap">`;
  html += `<div class="gantt-header">
    <div class="gantt-label-col"></div>
    <div class="gantt-track-col">${weeks.map(w => `<div class="gantt-week-label">${w.label}</div>`).join('')}</div>
  </div>`;

  if (!rows.length) {
    html += `<p style="font-size:12px;color:var(--ink2);padding:8px 0;">No windows to schedule yet.</p>`;
  }

  rows.forEach(row => {
    html += `<div class="gantt-job-block"><div class="gantt-job-name">${row.label}</div>`;
    if (!row.stages.length) {
      html += `<div class="gantt-row">
        <div class="gantt-label-col"><span style="font-size:11px;color:var(--ink2);">No dates set</span></div>
        <div class="gantt-track-col" style="position:relative;">
          <div class="gantt-today" style="left:${todayPct}%"></div>
          ${weeks.map(() => `<div class="gantt-cell"></div>`).join('')}
        </div>
      </div>`;
    } else {
      row.stages.forEach(stage => {
        const startPct = dateToGanttPct(stage.start, weeks);
        const endPct   = dateToGanttPct(stage.end, weeks);
        const width    = (startPct !== null && endPct !== null) ? Math.max(1, endPct - startPct) : 0;
        html += `<div class="gantt-row">
          <div class="gantt-label-col"><span class="gantt-stage-label">${stage.label}</span></div>
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
  el.innerHTML = html;
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

  // Rails: track making status = 'ready' — computed live, not manually set
  const railsReady = computeTrackMakingStatus(job) === 'ready';

  // Accessories: manual checkbox
  const accessoriesReady = job.installation && job.installation.accessoriesReady === true;

  return { fabricReady, railsReady, accessoriesReady };
}

// Shared defaults — called from both the Ops Install tab and the Install
// Crew Dashboard so either entry point can be opened first without the
// other's fields being missing.
function ensureInstallDefaults(job) {
  if (!job.installation) {
    job.installation = { status: 'pending', scheduledDate: '', team: [], siteContact: '', accessoriesReady: false, handoverSigned: false };
  }
  const inst = job.installation;
  if (!inst.team) inst.team = [];
  if (inst.partialRelease === undefined) inst.partialRelease = false;
  if (!inst.snags) inst.snags = [];
  if (!inst.signoff) inst.signoff = { signedName: null, signatureDataUrl: null, photos: [], signedAt: null };
}

function renderCurtInstall() {
  curtainJobs.forEach(job => ensureInstallDefaults(job));

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
            'All track/rail items must reach Ready in the Tracks Dashboard')}
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

        <!-- QC completion + install release mode -->
        ${(() => {
          const qc = getJobQCStatus(job);
          return `
          <div style="background:${qc.allPassed?'rgba(16,185,129,.08)':'#f7f9fc'};border:1px solid ${qc.allPassed?'rgba(16,185,129,.25)':'var(--line)'};border-radius:var(--r3);padding:11px 13px;margin-bottom:12px;">
            <p style="font-size:13px;font-weight:600;color:${qc.allPassed?'var(--ok)':'var(--ink2)'};">
              ${qc.allPassed ? '✓' : '◐'} QC: ${qc.done} of ${qc.total} items passed
              ${qc.allPassed ? ' — Install crew notified' : ''}
            </p>
            ${!qc.allPassed ? `
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:8px;">
              <input type="checkbox" ${inst.partialRelease?'checked':''} style="width:16px;height:16px;"
                onchange="instSetPartialRelease('${job.id}',this.checked)">
              <span style="font-size:12px;color:var(--ink2);">Allow partial install release (big projects — send finished items to site before the whole job clears QC)</span>
            </label>` : ''}
          </div>`;
        })()}

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
              <button class="sm ok" onclick="openSignoffPanel('${job.id}')">Client sign-off →</button>
            ` : `
              <span class="pill ok">✓ Complete · Client handover signed</span>
            `}
          </div>
        </div>
      </div>`;
  }).join('');

  const crewEntryBtn = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
      <button class="sec" style="font-size:12px;" onclick="openInstallCrewDashboard()">🏠 Open Install Crew Dashboard →</button>
    </div>`;

  document.getElementById('curt-install-list').innerHTML = crewEntryBtn + (html ||
    '<p style="font-size:13px;color:var(--ink2);">No curtain jobs yet.</p>');
}

function instSetAccessories(jobId, val) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job) return;
  job.installation.accessoriesReady = val;
  renderCurtInstall();
}

function instSetPartialRelease(jobId, val) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job) return;
  job.installation.partialRelease = val;
  curtAlert(val
    ? `Partial install release enabled for ${job.name} — finished items will show as ready even before the whole job clears QC.`
    : `Partial install release turned off for ${job.name}.`);
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

// completeInstall() replaced by the sign-off panel below (openSignoffPanel /
// submitSignoff) — that flow gates on open snags and captures a real
// signature + photos instead of a single "mark complete" click.

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
// Curtain/Roman items run TWO PARALLEL production tracks — a fabric/
// stitch track (Silva's stitching team) and a rail/track-making track
// (Abdullah/Prince) — since both teams work the same window at the same
// time, not one after the other. An item only moves to Hoist QC once
// EVERY track it needs has finished. Roller-family treatments only ever
// need the rail track (no stitching); blackout (not used in live data
// today) only needs the fabric track.
// ══════════════════════════════════════════════════════════════

// Treatment → which production track(s) it needs, and that track's own
// stage list. null = this treatment doesn't need that track at all.
const PROD_TRACKS = {
  curtain:   { fabric: ['Cutting', 'Stitching'], rail: ['Cutting', 'Assembly'] },
  roman:     { fabric: ['Cutting', 'Stitching'], rail: ['Cutting', 'Assembly'] },
  blackout:  { fabric: ['Cutting', 'Stitching'], rail: null },
  roller:    { fabric: null, rail: ['Cutting', 'Assembly'] },
  tracks:    { fabric: null, rail: ['Cutting', 'Assembly'] },
  motorized: { fabric: null, rail: ['Cutting', 'Assembly'] },
  japanese:  { fabric: null, rail: ['Cutting', 'Assembly'] },
  wooden:    { fabric: null, rail: ['Cutting', 'Assembly'] },
  zebra:     { fabric: null, rail: ['Cutting', 'Assembly'] },
};
function getProdTracks(treatment) {
  return PROD_TRACKS[treatment] || PROD_TRACKS['curtain'];
}
// Shared stages once both tracks converge — same for every treatment.
const POST_QC_STAGES = ['Hoist QC', 'Ready', 'Installed'];

// Full combined stage list for a treatment (fabric stages, then rail
// stages, then the shared post-QC stages). Kept for anywhere a flat list
// is genuinely useful; track-specific UI uses getProdTracks() directly.
function getItemStages(treatment) {
  const t = getProdTracks(treatment);
  return [...(t.fabric || []), ...(t.rail || []), ...POST_QC_STAGES];
}

// ── QC critical-info checklist (treatment-aware) ───────────────
// Replaces free-text-only QC notes. Each item defaults to checked
// (assumed OK); unchecking it flags an issue and requires a remark.
// 'treatments: all' applies to every treatment; otherwise an explicit list.
const QC_CHECKLIST_ITEMS = [
  { key: 'fabric_match',  label: 'Fabric match (pattern/colour correct)',
    treatments: ['curtain','roman','blackout','roller','japanese','zebra'] },
  { key: 'seam_pleat',    label: 'Seam / pleat check',
    treatments: ['curtain','roman','blackout'] },
  { key: 'track_motor',   label: 'Track / motor function',
    treatments: ['roller','tracks','motorized','wooden','zebra','japanese'] },
  { key: 'dimensional',   label: 'Dimensional tolerance (size within spec)',
    treatments: 'all' },
];

function getQCChecklistForTreatment(treatment) {
  return QC_CHECKLIST_ITEMS.filter(it => it.treatments === 'all' || it.treatments.includes(treatment));
}

// Ensure every calc-done window has an item card object
function ensureItemCards(job) {
  if (!job.itemCards) job.itemCards = {};
  job.windows.forEach(w => {
    if (!w.calcDone) return;
    if (!job.itemCards[w.id]) {
      const tracks = getProdTracks(w.treatment);
      job.itemCards[w.id] = {
        windowId:    w.id,
        jobId:       job.id,
        fabricTrack: tracks.fabric ? { stage: tracks.fabric[0], done: false, stageDates: {} } : null,
        railTrack:   tracks.rail   ? { stage: tracks.rail[0],   done: false, stageDates: {} } : null,
        stage:       'Production',    // 'Production' | 'Hoist QC' | 'Ready' | 'Installed'
        stageDates:  {},              // timestamps for Hoist QC / Ready / Installed
        qcResult:    null,            // null | 'pass' | 'fail'
        qcHistory:   [],              // array of QC attempt records
        reworkLog:   [],              // array of rework records
        isRework:    false,
        reworkTrack: null,            // 'fabric' | 'rail' — which track QC sent back
        reworkStage: null,            // stage within reworkTrack QC sent it back to
        assignedTo:  null,            // 'Abdullah' | 'Prince' | null — track team assignment
        qcLockedBy:  null,            // QC_TEAM name currently inspecting this item, or null
        qcLockedAt:  null,            // ISO timestamp lock was claimed — used to expire stale locks
        labour:      { team: [], startDate: '', endDate: '' }, // WIP tab — per-window labour schedule
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

// Backfills the `labour` field on any item card created before this field
// existed. Safe to call repeatedly.
function ensureCardLabour(card) {
  if (!card.labour) card.labour = { team: [], startDate: '', endDate: '' };
  return card.labour;
}

// Once every track an item needs has finished, send it to Hoist QC.
function checkTracksConverged(job, win, card) {
  if (card.stage !== 'Production') return;
  const fabricOk = !card.fabricTrack || card.fabricTrack.done;
  const railOk   = !card.railTrack   || card.railTrack.done;
  if (fabricOk && railOk) {
    card.stage = 'Hoist QC';
    card.qcQueuedAt = new Date().toISOString();
    card.qcSeen = false;
    curtAlert(`✓ ${win.label} — fabric${card.railTrack ? ' + rail' : ''} complete, sent to QC`);
  }
}

// Advance ONE production track (fabric or rail) by one stage. Each team
// only ever advances its own track — Silva advancing fabric never touches
// rail, and vice versa. When a track finishes, checks whether the item is
// now ready for Hoist QC (i.e. every track it needs is done).
// Silva asked for a single "mark complete" action instead of clicking
// through each fabric stage (Cutting, then Stitching) one at a time. This
// fills every remaining fabric stageDate at once — so the Cut List /
// stage-progress views on the Tracks Dashboard still have real timestamps
// — and marks the whole fabric track done in one click. Rail keeps its own
// step-by-step flow via advanceProdTrack; this only touches fabric.
function finishFabricWork(jobId, windowId) {
  const job  = curtainJobs.find(j => j.id === jobId);
  const win  = job && job.windows.find(w => w.id === windowId);
  const card = getItemCard(jobId, windowId);
  if (!job || !win || !card || !card.fabricTrack || card.fabricTrack.done || card.stage !== 'Production') return;

  const stages = getProdTracks(win.treatment).fabric;
  stages.forEach(s => { card.fabricTrack.stageDates[s] = card.fabricTrack.stageDates[s] || new Date().toISOString(); });
  card.fabricTrack.stage = stages[stages.length - 1];
  card.fabricTrack.done  = true;
  curtAlert(`✓ ${win.label} — fabric work done`);
  checkTracksConverged(job, win, card);
}

// Same idea, for a fabric item that QC sent back for rework.
function finishFabricRework(jobId, windowId) {
  const job  = curtainJobs.find(j => j.id === jobId);
  const win  = job && job.windows.find(w => w.id === windowId);
  const card = getItemCard(jobId, windowId);
  if (!job || !win || !card || !card.isRework || card.reworkTrack !== 'fabric') return;

  const stages = getProdTracks(win.treatment).fabric;
  const idx = stages.indexOf(card.reworkStage);
  if (idx === -1) return;
  stages.slice(idx).forEach(s => { card.fabricTrack.stageDates[s] = new Date().toISOString(); });
  card.fabricTrack.stage = stages[stages.length - 1];
  card.fabricTrack.done  = true;
  card.isRework    = false;
  card.reworkTrack = null;
  card.reworkStage = null;
  curtAlert(`✓ ${win.label} — rework complete`);
  checkTracksConverged(job, win, card);
}

function advanceProdTrack(jobId, windowId, trackName) {
  const job  = curtainJobs.find(j => j.id === jobId);
  const win  = job && job.windows.find(w => w.id === windowId);
  const card = getItemCard(jobId, windowId);
  if (!job || !win || !card) return;
  const track = trackName === 'fabric' ? card.fabricTrack : card.railTrack;
  if (!track || track.done || card.stage !== 'Production') return;

  const stages = getProdTracks(win.treatment)[trackName];
  const idx    = stages.indexOf(track.stage);
  if (idx === -1) return;

  track.stageDates[track.stage] = track.stageDates[track.stage] || new Date().toISOString();

  if (idx >= stages.length - 1) {
    track.done = true;
    curtAlert(`✓ ${win.label} — ${trackName === 'fabric' ? 'fabric' : 'rail'} work done`);
    checkTracksConverged(job, win, card);
  } else {
    track.stage = stages[idx + 1];
    curtAlert(`✓ ${win.label} → ${track.stage}`);
  }
}

// Advance a track that's currently in rework (QC sent it back). Only the
// flagged track is affected — the other track's completed work stands.
function advanceReworkTrack(jobId, windowId) {
  const job  = curtainJobs.find(j => j.id === jobId);
  const win  = job && job.windows.find(w => w.id === windowId);
  const card = getItemCard(jobId, windowId);
  if (!job || !win || !card || !card.isRework) return;

  const trackName = card.reworkTrack;
  const track = trackName === 'fabric' ? card.fabricTrack : card.railTrack;
  const stages = getProdTracks(win.treatment)[trackName];
  const idx = stages.indexOf(card.reworkStage);
  if (!track || idx === -1) return;

  track.stageDates[card.reworkStage] = new Date().toISOString();

  if (idx >= stages.length - 1) {
    track.done  = true;
    track.stage = stages[stages.length - 1];
    card.isRework    = false;
    card.reworkTrack = null;
    card.reworkStage = null;
    curtAlert(`✓ ${win.label} — rework complete`);
    checkTracksConverged(job, win, card);
  } else {
    card.reworkStage = stages[idx + 1];
    curtAlert(`✓ ${win.label} → ${card.reworkStage} (rework)`);
  }
}

// Called from QC dashboard: pass or fail
function recordQCResult(jobId, windowId, result, notes, photos, qcPerson, reworkTrack, reworkStage, checklist) {
  const job  = curtainJobs.find(j => j.id === jobId);
  const win  = job && job.windows.find(w => w.id === windowId);
  const card = getItemCard(jobId, windowId);
  if (!job || !win || !card) return false;

  const timestamp = new Date().toISOString();

  const qcRecord = {
    result,
    notes:    notes || '',
    checklist: checklist || [],  // [{key,label,ok,remark}] — critical-info checklist for this attempt
    photos:   photos || [],    // array of base64 — for now, Nettworksy migrates to cloud
    person:   qcPerson || 'QC',
    timestamp,
    attempt:  card.qcHistory.length + 1,
    // Snapshot of when this attempt was queued (set by checkTracksConverged
    // each time the item enters Hoist QC, first pass or after rework) —
    // captured here before it gets overwritten by the next queue event, so
    // turnaround time per attempt survives in history for the Performance view.
    queuedAt: card.qcQueuedAt || null,
  };
  card.qcHistory.push(qcRecord);
  card.stageDates['Hoist QC'] = timestamp;
  card.qcSeen = true; // opened/actioned — clears the "new" badge either way

  // Release the inspection lock — this attempt is now recorded either way.
  card.qcLockedBy = null;
  card.qcLockedAt = null;

  if (result === 'pass') {
    card.qcResult    = 'pass';
    card.isRework     = false;
    card.reworkTrack  = null;
    card.reworkStage  = null;
    card.stage         = 'Ready';
    card.stageDates['Ready'] = timestamp;
    curtAlert(`✓ QC passed — ${win.label} is now Ready`);
    checkJobQCCompletion(job);
  } else {
    // Fail — send the flagged track back to rework. QC picks which track
    // caused the fail; defaults to whichever track exists for single-track
    // treatments where there's no ambiguity.
    const track    = reworkTrack || (card.fabricTrack ? 'fabric' : 'rail');
    const stages   = getProdTracks(win.treatment)[track];
    const returnTo = reworkStage || stages[0];
    const t = track === 'fabric' ? card.fabricTrack : card.railTrack;
    if (t) { t.done = false; t.stage = returnTo; }

    card.qcResult    = 'fail';
    card.isRework     = true;
    card.reworkTrack  = track;
    card.reworkStage  = returnTo;
    card.stage         = 'Production';
    card.reworkLog.push({
      attempt:   card.qcHistory.length,
      timestamp,
      track,
      returnTo,
      reason:    notes || '',
    });
    curtAlert(`⚠ QC failed — ${win.label} sent back to ${returnTo} (${track === 'fabric' ? 'fabric' : 'rail'})`);
    checkJobQCCompletion(job);
  }
  return true;
}

// ── Overall status — for terminal-state grouping (Hoist QC/Ready/Installed)
// and generic rework display where the track doesn't matter to the caller.
// Windows tab and Tracks Dashboard use getFabricDisplay/getRailDisplay
// instead, so each team only ever sees its own track.
function getItemCardStageDisplay(card, treatment) {
  if (!card) return { stage: '—', isRework: false, track: null };
  if (card.isRework) return { stage: card.reworkStage, isRework: true, track: card.reworkTrack };
  return { stage: card.stage, isRework: false, track: null };
}

// ── Silva's view — fabric track only (Windows tab). Shows 'Done' once
// fabric work is finished, even while the rail track (or a rail rework)
// is still in progress — Silva can see it happened, but can't act on it.
function getFabricDisplay(card) {
  if (!card || !card.fabricTrack) return { stage: null, isRework: false, actionable: false };
  if (card.isRework && card.reworkTrack === 'fabric') return { stage: card.reworkStage, isRework: true, actionable: true };
  if (card.stage !== 'Production') return { stage: 'Done', isRework: false, actionable: false };
  if (card.isRework && card.reworkTrack === 'rail')   return { stage: 'Done', isRework: false, actionable: false };
  if (card.fabricTrack.done) return { stage: 'Done', isRework: false, actionable: false };
  return { stage: card.fabricTrack.stage, isRework: false, actionable: true };
}

// ── Track team's view — rail track only (Tracks Dashboard).
function getRailDisplay(card) {
  if (!card || !card.railTrack) return { stage: null, isRework: false, actionable: false };
  if (card.isRework && card.reworkTrack === 'rail') return { stage: card.reworkStage, isRework: true, actionable: true };
  if (card.stage !== 'Production') return { stage: 'Done', isRework: false, actionable: false };
  if (card.isRework && card.reworkTrack === 'fabric') return { stage: 'Done', isRework: false, actionable: false };
  if (card.railTrack.done) return { stage: 'Done', isRework: false, actionable: false };
  return { stage: card.railTrack.stage, isRework: false, actionable: true };
}

function itemCardStagePill(card, treatment) {
  if (!card) return statusPill('pending');
  const { stage, isRework, track } = getItemCardStageDisplay(card, treatment);
  const stageKey = (stage || '').toLowerCase().replace(/\s/g, '_');
  const pill = statusPill(stageKey) || `<span class="pill grey">${stage}</span>`;
  if (isRework) {
    return `<span class="pill bad">Rework → ${stage}${track ? ` (${track === 'fabric' ? 'Fabric' : 'Rail'})` : ''}</span>`;
  }
  if (card.qcResult === 'pass' && card.stage === 'Ready') return `<span class="pill ok">✓ Ready</span>`;
  if (card.stage === 'Installed') return `<span class="pill ok">✓ Installed</span>`;
  if (stage === 'Hoist QC') return `<span class="pill info">QC</span>`;
  if (stage === 'Production') return `<span class="pill warn">In production</span>`;
  return `<span class="pill warn">${stage}</span>`;
}

// ── Finished-windows tracker — "finished" means the window has left
// Production (fabric+rail converged) and is at Hoist QC or beyond. Used
// by both the per-job WIP tab counter and the module-wide Dashboard KPI.
// ── Stitching-finished tracker — this counts fabric work Silva has
// actually finished (card.fabricTrack.done), NOT full window convergence
// to Hoist QC. Those are two different milestones: this one moves the
// moment Silva marks fabric complete; the per-window "Sent to QC" badge
// (rendered elsewhere in renderWinStageAction) still only shows once BOTH
// fabric and rail are done. Only counts windows that actually have a
// fabric track — rail-only treatments (roller, motorized, etc.) don't
// belong in this denominator since Silva's team never touches them.
function getJobStitchingFinishedCount(job) {
  ensureItemCards(job);
  const items = job.windows.filter(w => w.calcDone && getProdTracks(w.treatment).fabric);
  const finished = items.filter(w => {
    const card = job.itemCards[w.id];
    return card && card.fabricTrack && card.fabricTrack.done;
  });
  return { finished: finished.length, total: items.length };
}

function getAllJobsStitchingFinishedCount() {
  let finished = 0, total = 0;
  curtainJobs.forEach(job => {
    const c = getJobStitchingFinishedCount(job);
    finished += c.finished;
    total += c.total;
  });
  return { finished, total };
}

// ── Job-wide QC completion → gates Install release + flags Accounts ──
// Fires whenever an item passes QC. Only trips once every calc-done item
// in the job has reached Ready/Installed (i.e. nothing left in production
// or rework). This is what "whole job QC done" means downstream.
function getJobQCStatus(job) {
  ensureItemCards(job);
  const items = job.windows.filter(w => w.calcDone);
  const done  = items.filter(w => {
    const card = job.itemCards[w.id];
    return card && !card.isRework && (card.stage === 'Ready' || card.stage === 'Installed');
  });
  return { total: items.length, done: done.length, allPassed: items.length > 0 && done.length === items.length };
}

function checkJobQCCompletion(job) {
  if (!job) return;
  const status = getJobQCStatus(job);
  if (!job.installation) job.installation = { status: 'pending', scheduledDate: '', team: [], siteContact: '', accessoriesReady: false, handoverSigned: false };

  if (status.allPassed && !job.installation.qcAllComplete) {
    job.installation.qcAllComplete = true;
    job.installation.qcCompleteAt  = new Date().toISOString();
    if (!job.accountsAlert) {
      job.accountsAlert = { type: 'balance_invoice_due', raisedAt: new Date().toISOString(), seen: false };
    }
    curtAlert(`✓ All items QC passed for ${job.name} — Install team notified, Accounts flagged for balance invoice`);
  } else if (!status.allPassed && job.installation.qcAllComplete) {
    // A later rework/fail on this job reopened it after it had been marked complete
    job.installation.qcAllComplete = false;
  }
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
// Only items that actually have a rail track belong here — the track
// team's queue is the rail track, full stop. (Fabric-only items like
// blackout, if ever used, simply never appear.)
function getAllTrackItems() {
  const items = [];
  curtainJobs.forEach(job => {
    ensureItemCards(job);
    const days = daysUntilInstall(job);
    job.windows.forEach(w => {
      if (!w.calcDone) return;
      const card = job.itemCards[w.id];
      if (!card || !card.railTrack) return;
      const stageInfo = getItemCardStageDisplay(card, w.treatment); // overall (terminal/rework) status
      const railInfo  = getRailDisplay(card);                        // rail-track-only status
      items.push({ job, w, card, stageInfo, railInfo, days });
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
  // Bucketed off the RAIL track directly — that's the track team's own
  // work. A fabric rework doesn't reopen the track team's queue (rail's
  // work already stands); it shows under "waiting" instead.
  const active    = all.filter(i => i.railInfo.actionable && !i.railInfo.isRework);
  const rework    = all.filter(i => i.railInfo.isRework);
  const waitingOnFabric = all.filter(i => !i.railInfo.actionable && i.railInfo.stage === 'Done' && i.stageInfo.stage === 'Production');
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
    bodyHtml = renderTracksQueueView(rework, active, atHoistQC, waitingOnFabric);
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
function renderTracksQueueView(rework, active, atHoistQC, waitingOnFabric) {
  let html = '';
  waitingOnFabric = waitingOnFabric || [];

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

  // Rail's done, waiting on the stitching team to finish fabric
  if (waitingOnFabric.length > 0) {
    html += `<div style="padding:12px 16px 6px;">
      <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#a78bfa;text-transform:uppercase;">Rail Done — Waiting on Fabric (${waitingOnFabric.length})</p>
    </div>`;
    waitingOnFabric.forEach(i => { html += tracksItemCard(i, 'waiting-fabric'); });
  }

  // At Hoist QC — waiting, not actionable for tracks team
  if (atHoistQC.length > 0) {
    html += `<div style="padding:12px 16px 6px;">
      <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#3b82f6;text-transform:uppercase;">At Hoist QC — Awaiting result (${atHoistQC.length})</p>
    </div>`;
    atHoistQC.forEach(i => { html += tracksItemCard(i, 'waiting'); });
  }

  if (rework.length === 0 && active.length === 0 && atHoistQC.length === 0 && waitingOnFabric.length === 0) {
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
    const actionable = jobItems.filter(i => i.railInfo.actionable);
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
  const railInfo = i.railInfo || getRailDisplay(card);
  const railStages = getProdTracks(w.treatment).rail || [];
  const isRoller = isRollerItem(w);
  const siblings = getGroupSiblings(job, w);

  const daysColor = urgencyColor(days);
  const daysText  = urgencyLabel(days);

  // Stage progress dots — rail track only, this is the track team's own work
  const stageDots = railStages.map((s, si) => {
    const done    = card && card.railTrack && card.railTrack.stageDates && card.railTrack.stageDates[s];
    const isCurr  = railInfo.stage === s;
    const bg      = done ? '#10b981' : isCurr ? '#7c3aed' : '#374151';
    return `<div style="display:flex;align-items:center;gap:3px;">
      <div style="width:8px;height:8px;border-radius:50%;background:${bg};flex:none;"></div>
      <span style="font-size:9px;color:${done?'#10b981':isCurr?'#a78bfa':'#4b5563'};white-space:nowrap;">${s}</span>
      ${si < railStages.length-1 ? `<div style="width:10px;height:1px;background:#374151;margin:0 1px;"></div>` : ''}
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

  // Action buttons — derived straight from the rail track's own state, so
  // this is correct regardless of which bucket the card is rendered under.
  let actions = '';
  const railIdx     = railStages.indexOf(railInfo.stage);
  const railNext    = railIdx >= 0 && railIdx < railStages.length - 1 ? railStages[railIdx + 1] : null;
  const needsMotor  = w.motorized && railInfo.stage === 'Assembly' && !railInfo.isRework;

  if (railInfo.isRework) {
    actions = `
      <div style="background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
        <p style="font-size:11px;color:#f87171;font-weight:700;">QC failed — rail rework required</p>
        <p style="font-size:11px;color:#ef4444;">Return to: ${railInfo.stage}</p>
        ${card && card.reworkLog.length ? `<p style="font-size:10px;color:#991b1b;margin-top:4px;">Reason: ${card.reworkLog[card.reworkLog.length-1].reason || 'No notes'}</p>` : ''}
      </div>
      <button onclick="tracksMarkStageComplete('${job.id}','${w.id}');renderTracksDashboard()"
        style="width:100%;padding:12px;background:#dc2626;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">
        Rework complete — send to QC again →
      </button>`;
  } else if (!railInfo.actionable) {
    if (railInfo.stage === 'Done' && i.stageInfo.stage === 'Production') {
      actions = `<p style="font-size:12px;color:#a78bfa;padding:4px 0;text-align:center;">✂️ Rail done — waiting on the stitching team</p>`;
    } else if (i.stageInfo.stage === 'Hoist QC') {
      actions = `<p style="font-size:12px;color:#3b82f6;padding:4px 0;text-align:center;">Waiting for hoist QC result</p>`;
    } else if (i.stageInfo.stage === 'Ready') {
      actions = `<p style="font-size:12px;color:#10b981;font-weight:600;padding:4px 0;text-align:center;">✓ Ready — awaiting hoist inspection</p>`;
    }
  } else if (needsMotor) {
    actions = `
      <div style="background:#1c1208;border:1px solid #78350f;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
        <p style="font-size:11px;color:#f59e0b;font-weight:700;">⚡ Motor fit required before QC</p>
        <p style="font-size:11px;color:#92400e;">Mark assembly done — motor team will be notified</p>
      </div>
      <button onclick="tracksMarkStageComplete('${job.id}','${w.id}');renderTracksDashboard()"
        style="width:100%;padding:12px;background:#d97706;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">
        Assembly done — notify motor team →
      </button>`;
  } else {
    const btnLabel = !railNext ? 'Send to hoist QC →' : `Mark ${railInfo.stage} complete →`;
    actions = `
      <button onclick="tracksMarkStageComplete('${job.id}','${w.id}');renderTracksDashboard()"
        style="width:100%;padding:12px;background:#7c3aed;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">
        ${btnLabel}
      </button>`;
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

  const railStages = getProdTracks(w.treatment).rail || [];
  const days       = daysUntilInstall(job);
  const isRoller   = isRollerItem(w);
  const railInfo   = getRailDisplay(card);
  const fabInfo    = getFabricDisplay(card);

  const historyRows = card.qcHistory.map(h => `
    <div style="border-bottom:1px solid #1f2937;padding:10px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <div>
        <p style="font-size:12px;font-weight:700;color:${h.result==='pass'?'#10b981':'#ef4444'};">
          ${h.result==='pass'?'✓ Pass':'✗ Fail'} — Attempt ${h.attempt}
        </p>
        <p style="font-size:11px;color:#6b7280;">${h.person} · ${new Date(h.timestamp).toLocaleDateString('en-BH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
        ${h.notes ? `<p style="font-size:11px;color:#9ca3af;margin-top:3px;">${h.notes}</p>` : ''}
      </div>
      ${h.photos && h.photos.length ? `<div style="position:relative;flex:none;"><img src="${h.photos[0]}" style="width:44px;height:44px;border-radius:7px;object-fit:cover;">${h.photos.length>1?`<span style="position:absolute;bottom:-4px;right:-4px;background:#1e2a3b;color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:8px;">+${h.photos.length-1}</span>`:''}</div>` : ''}
    </div>`).join('');

  // Rail track timeline — this is the track team's own work
  const stageLine = railStages.map(s => {
    const done = card.railTrack && card.railTrack.stageDates && card.railTrack.stageDates[s];
    const curr = railInfo.stage === s;
    return `
      <div style="flex:1;text-align:center;">
        <div style="width:28px;height:28px;border-radius:50%;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;background:${done?'#10b981':curr?'#7c3aed':'#374151'};border:2px solid ${done?'#10b981':curr?'#a78bfa':'#4b5563'};">
          ${done ? `<span style="color:#fff;font-size:11px;font-weight:800;">✓</span>` : curr ? `<span style="width:8px;height:8px;border-radius:50%;background:#fff;display:block;"></span>` : ''}
        </div>
        <p style="font-size:9px;color:${done?'#10b981':curr?'#a78bfa':'#4b5563'};font-weight:${done||curr?'700':'400'};">${s}</p>
        ${done && card.railTrack.stageDates[s] ? `<p style="font-size:8px;color:#4b5563;">${new Date(card.railTrack.stageDates[s]).toLocaleDateString('en-BH',{day:'numeric',month:'short'})}</p>` : ''}
      </div>`;
  }).join('');

  // Fabric status note — read-only context for the track team, not actionable here
  const fabricNote = fabInfo.stage ? `
    <p style="font-size:11px;color:#a78bfa;margin-top:8px;">
      ✂️ Fabric: ${fabInfo.stage === 'Done' ? '✓ Done' : fabInfo.stage + (fabInfo.isRework ? ' (rework)' : '')}
    </p>` : '';

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
        <p style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#6b7280;text-transform:uppercase;margin-bottom:12px;">Rail progress</p>
        <div style="display:flex;align-items:flex-start;">${stageLine}</div>
        ${fabricNote}
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

  const railInfo = getRailDisplay(card);
  if (!railInfo.actionable) return;
  if (railInfo.isRework) {
    advanceReworkTrack(jobId, windowId);
  } else {
    advanceProdTrack(jobId, windowId, 'rail');
  }
}

// ── Mark all items for a job ready (rail track only) ──
function tracksMarkAllReady(jobId) {
  const job = curtainJobs.find(j => j.id === jobId);
  if (!job) return;
  ensureItemCards(job);
  let count = 0;
  job.windows.forEach(w => {
    if (!w.calcDone) return;
    const card = job.itemCards[w.id];
    if (!card || !card.railTrack) return;
    const railInfo = getRailDisplay(card);
    if (!railInfo.actionable) return;
    if (railInfo.isRework) {
      advanceReworkTrack(job.id, w.id);
    } else {
      advanceProdTrack(job.id, w.id, 'rail');
    }
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
let qcChecklistState = {};      // { key: { ok: boolean, remark: string } } for the open panel
let qcActiveChecklistItems = []; // checklist item defs (key+label) for the open panel's treatment
let qcDashView = 'queue';        // 'queue' | 'performance' | 'log' — top-level tab
let qcCurrentUser = null;        // QC_TEAM name "acting as" for this device session
let qcLogFilter = 'all';         // 'all' | 'pass' | 'fail' — Log view filter

// Stale locks auto-expire — protects against a crashed/abandoned session
// permanently blocking an item. Real cross-device enforcement needs a
// backend/sync layer (Nettworksky) — until then this only guards against
// two people picking up the same item on the same shared device.
const QC_LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 min

function qcLockIsStale(card) {
  if (!card.qcLockedAt) return true;
  return (Date.now() - new Date(card.qcLockedAt).getTime()) > QC_LOCK_TIMEOUT_MS;
}

function qcLockAgeLabel(card) {
  if (!card.qcLockedAt) return '';
  const mins = Math.max(1, Math.round((Date.now() - new Date(card.qcLockedAt).getTime()) / 60000));
  return mins < 60 ? `${mins}m ago` : `${Math.round(mins/60)}h ago`;
}

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

// Every qcHistory entry across every job, flattened, for Performance + Log
// views. Each row carries its own job/window/treatment context.
function collectAllQCHistory() {
  const rows = [];
  curtainJobs.forEach(job => {
    ensureItemCards(job);
    job.windows.forEach(w => {
      if (!w.calcDone) return;
      const card = job.itemCards[w.id];
      if (!card || !card.qcHistory) return;
      card.qcHistory.forEach(h => rows.push({ job, w, card, h }));
    });
  });
  rows.sort((a, b) => new Date(b.h.timestamp) - new Date(a.h.timestamp));
  return rows;
}

function qcTurnaroundMs(h) {
  if (!h.queuedAt) return null;
  const ms = new Date(h.timestamp).getTime() - new Date(h.queuedAt).getTime();
  return ms >= 0 ? ms : null;
}

function qcTurnaroundLabel(ms) {
  if (ms == null) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${(mins/60).toFixed(1)}h`;
  return `${(mins/1440).toFixed(1)}d`;
}

function qcSetView(v) {
  qcDashView = v;
  renderQCDashboard();
}

function renderQCDashboard() {
  const wrap = document.getElementById('qc-dash-wrap');
  if (!wrap) return;

  const tabs = ['queue', 'performance', 'log'];
  const tabLabels = { queue: 'Queue', performance: 'Performance', log: 'Log' };
  const tabBar = `
    <div style="display:flex;gap:6px;padding:10px 16px;background:#fff;border-bottom:1px solid #e8ecf0;flex:none;">
      ${tabs.map(t => `
        <button onclick="qcSetView('${t}')" style="flex:1;padding:8px;border-radius:8px;border:1px solid ${qcDashView===t?'#1e2a3b':'#e2e8f0'};background:${qcDashView===t?'#1e2a3b':'#f7f9fc'};color:${qcDashView===t?'#fff':'#475569'};font-size:12px;font-weight:700;cursor:pointer;">
          ${tabLabels[t]}
        </button>`).join('')}
    </div>`;

  const acting = `
    <div style="padding:8px 16px;background:#f1f5f9;border-bottom:1px solid #e8ecf0;display:flex;justify-content:space-between;align-items:center;flex:none;">
      <span style="font-size:11px;color:#64748b;">Acting as: <b style="color:#1e2a3b;">${qcCurrentUser || 'not set'}</b></span>
      <button onclick="qcSwitchUser()" style="background:none;border:none;color:#3b82f6;font-size:11px;font-weight:600;cursor:pointer;">Switch</button>
    </div>`;

  let body = '';
  if (qcDashView === 'performance') body = renderQCPerformanceView();
  else if (qcDashView === 'log') body = renderQCLogView();
  else body = renderQCQueueView();

  wrap.innerHTML = `
    <div style="background:#1e2a3b;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex:none;">
      <div>
        <p style="color:#fff;font-weight:700;font-size:16px;">🔍 QC Dashboard</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:2px;">${new Date().toLocaleDateString('en-BH',{day:'numeric',month:'short',year:'numeric'})}</p>
      </div>
      <button onclick="closeQCDashboard()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;">← Back</button>
    </div>
    ${tabBar}
    ${acting}
    ${body}
    <!-- QC Panel overlay (hidden by default) -->
    <div id="qc-panel" style="display:none;position:absolute;inset:0;background:#f7f9fc;overflow-y:auto;z-index:10;"></div>`;
}

function qcSwitchUser() {
  qcCurrentUser = null;
  renderQCDashboard();
}

function renderQCQueueView() {
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

      if (stageInfo.stage === 'Hoist QC' && !stageInfo.isRework) {
        qcItems.push({ job, w, card });
      } else if (stageInfo.isRework) {
        reworkItems.push({ job, w, card, stageInfo });
      } else if (card.qcResult === 'pass' && card.stageDates['Hoist QC']) {
        const d = card.stageDates['Hoist QC'].slice(0,10);
        if (d === today) passedToday.push({ job, w, card });
      }
    });
  });

  const newCount = qcItems.filter(i => i.card.qcQueuedAt && !i.card.qcSeen).length;

  const kpiRow = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:16px;background:#fff;border-bottom:1px solid #e8ecf0;">
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;position:relative;">
        ${newCount > 0 ? `<span style="position:absolute;top:6px;right:6px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;">${newCount} new</span>` : ''}
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
    const isNew = i.card.qcQueuedAt && !i.card.qcSeen;
    const locked = i.card.qcLockedBy && !qcLockIsStale(i.card) && i.card.qcLockedBy !== qcCurrentUser;
    return `
      <div style="border:1px solid ${locked?'#f59e0b':isNew?'#3b82f6':'#e8ecf0'};border-radius:12px;padding:14px;margin-bottom:10px;background:#fff;cursor:pointer;"
        onclick="openQCPanel('${i.job.id}','${i.w.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <p style="font-size:14px;font-weight:700;color:#1e2a3b;">${i.w.label}</p>
            <p style="font-size:11px;color:#64748b;">${i.job.name} · ${i.job.id} · ${i.w.room}</p>
            <p style="font-size:12px;color:#475569;margin-top:4px;">${treatmentLabel(i.w.treatment)} · ${i.w.width}×${i.w.height} cm</p>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
            ${isNew ? `<span class="pill" style="background:#dbeafe;color:#3b82f6;">● New</span>` : `<span class="pill info">QC</span>`}
            ${attempts > 0 ? `<span class="pill bad" style="font-size:10px;">Attempt ${attempts+1}</span>` : ''}
          </div>
        </div>
        ${locked ? `<div style="margin-top:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:6px 10px;">
          <p style="font-size:11px;color:#b45309;font-weight:600;">🔒 Being inspected by ${i.card.qcLockedBy} · ${qcLockAgeLabel(i.card)}</p>
        </div>` : ''}
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
          <span class="pill bad">Rework → ${i.stageInfo.stage}${i.stageInfo.track ? ` (${i.stageInfo.track === 'fabric' ? 'Fabric' : 'Rail'})` : ''}</span>
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

  return `${kpiRow}${listView}`;
}

// ── Performance view — pass rate, attempts, turnaround, per QC person ──
function renderQCPerformanceView() {
  const rows = collectAllQCHistory();

  if (rows.length === 0) {
    return `<div style="flex:1;overflow-y:auto;padding:16px;">
      <div style="text-align:center;padding:48px 20px;">
        <p style="font-size:32px;margin-bottom:8px;">📊</p>
        <p style="font-size:14px;color:#64748b;">No QC inspections recorded yet.</p>
      </div>
    </div>`;
  }

  const passCount = rows.filter(r => r.h.result === 'pass').length;
  const failCount = rows.length - passCount;
  const overallPassRate = Math.round((passCount / rows.length) * 100);

  const turnarounds = rows.map(r => qcTurnaroundMs(r.h)).filter(ms => ms != null);
  const avgTurnaround = turnarounds.length ? turnarounds.reduce((a,b) => a+b, 0) / turnarounds.length : null;

  // Avg attempts to reach a pass — only counts items that have actually passed
  const passedCards = new Set();
  const attemptsToPass = [];
  rows.forEach(r => {
    if (r.h.result === 'pass' && !passedCards.has(r.card)) {
      passedCards.add(r.card);
      attemptsToPass.push(r.h.attempt);
    }
  });
  const avgAttempts = attemptsToPass.length ? (attemptsToPass.reduce((a,b)=>a+b,0) / attemptsToPass.length) : null;

  const kpiRow = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:16px;background:#fff;border-bottom:1px solid #e8ecf0;">
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#10b981;">${overallPassRate}%</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Overall pass rate (${passCount}/${rows.length})</p>
      </div>
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#ef4444;">${failCount}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Total fails logged</p>
      </div>
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#3b82f6;">${avgAttempts ? avgAttempts.toFixed(1) : '—'}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Avg attempts to pass</p>
      </div>
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#7c3aed;">${qcTurnaroundLabel(avgTurnaround)}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Avg turnaround (queue → result)</p>
      </div>
    </div>`;

  // Per-person breakdown
  const byPerson = {};
  rows.forEach(r => {
    const p = r.h.person || 'Unknown';
    if (!byPerson[p]) byPerson[p] = { total: 0, pass: 0, fail: 0, turnarounds: [] };
    byPerson[p].total++;
    if (r.h.result === 'pass') byPerson[p].pass++; else byPerson[p].fail++;
    const ms = qcTurnaroundMs(r.h);
    if (ms != null) byPerson[p].turnarounds.push(ms);
  });

  const personRows = Object.entries(byPerson)
    .sort((a,b) => b[1].total - a[1].total)
    .map(([person, s]) => {
      const rate = Math.round((s.pass / s.total) * 100);
      const avgT = s.turnarounds.length ? s.turnarounds.reduce((a,b)=>a+b,0)/s.turnarounds.length : null;
      return `
        <div style="border-bottom:1px solid #f1f5f9;padding:10px 0;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <p style="font-size:13px;font-weight:700;color:#1e2a3b;">${person}</p>
            <p style="font-size:11px;color:#64748b;">${s.total} inspection${s.total>1?'s':''} · ${s.pass} pass / ${s.fail} fail</p>
          </div>
          <div style="text-align:right;">
            <p style="font-size:14px;font-weight:700;color:${rate>=80?'#10b981':rate>=50?'#f59e0b':'#ef4444'};">${rate}%</p>
            <p style="font-size:10px;color:#94a3b8;">avg ${qcTurnaroundLabel(avgT)}</p>
          </div>
        </div>`;
    }).join('');

  // Fail-reason breakdown by checklist key
  const failReasons = {};
  rows.forEach(r => {
    (r.h.checklist || []).forEach(c => {
      if (!c.ok) failReasons[c.label] = (failReasons[c.label] || 0) + 1;
    });
  });
  const reasonRows = Object.entries(failReasons)
    .sort((a,b) => b[1] - a[1])
    .map(([label, count]) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f1f5f9;">
        <p style="font-size:12px;color:#475569;">${label}</p>
        <span class="pill bad" style="font-size:11px;">${count}</span>
      </div>`).join('');

  return `
    ${kpiRow}
    <div style="flex:1;overflow-y:auto;padding:16px;padding-bottom:80px;">
      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:16px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:8px;">By QC person</p>
        ${personRows || '<p style="font-size:12px;color:#94a3b8;">No data yet.</p>'}
      </div>
      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:14px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:8px;">Most common fail reasons</p>
        ${reasonRows || '<p style="font-size:12px;color:#94a3b8;">No fails logged yet.</p>'}
      </div>
    </div>`;
}

// ── Log view — global audit trail across every job ──
function renderQCLogView() {
  const allRows = collectAllQCHistory();
  const rows = qcLogFilter === 'all' ? allRows : allRows.filter(r => r.h.result === qcLogFilter);

  const filterBar = `
    <div style="display:flex;gap:6px;padding:12px 16px;background:#fff;border-bottom:1px solid #e8ecf0;flex:none;">
      ${['all','pass','fail'].map(f => `
        <button onclick="qcSetLogFilter('${f}')" style="padding:6px 14px;border-radius:20px;border:1px solid ${qcLogFilter===f?'#1e2a3b':'#e2e8f0'};background:${qcLogFilter===f?'#1e2a3b':'#f7f9fc'};color:${qcLogFilter===f?'#fff':'#475569'};font-size:12px;font-weight:600;cursor:pointer;text-transform:capitalize;">
          ${f} ${f !== 'all' ? `(${allRows.filter(r=>r.h.result===f).length})` : `(${allRows.length})`}
        </button>`).join('')}
    </div>`;

  const rowsHtml = rows.map(r => {
    const ms = qcTurnaroundMs(r.h);
    return `
      <div style="border:1px solid #e8ecf0;border-radius:12px;padding:12px 14px;margin-bottom:8px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <p style="font-size:13px;font-weight:700;color:#1e2a3b;">${r.w.label} <span style="font-weight:400;color:#94a3b8;">· Attempt ${r.h.attempt}</span></p>
            <p style="font-size:11px;color:#64748b;">${r.job.name} · ${r.job.id} · ${treatmentLabel(r.w.treatment)}</p>
          </div>
          <span class="pill ${r.h.result==='pass'?'ok':'bad'}">${r.h.result==='pass'?'✓ Pass':'✗ Fail'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <p style="font-size:11px;color:#64748b;">${r.h.person} · ${new Date(r.h.timestamp).toLocaleDateString('en-BH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
          <p style="font-size:11px;color:#7c3aed;font-weight:600;">⏱ ${qcTurnaroundLabel(ms)}</p>
        </div>
        ${r.h.checklist && r.h.checklist.some(c => !c.ok) ? `
          <div style="margin-top:6px;background:#fef2f2;border-radius:8px;padding:6px 10px;">
            ${r.h.checklist.filter(c => !c.ok).map(c => `<p style="font-size:11px;color:#dc2626;">✗ ${c.label}${c.remark ? ' — ' + c.remark : ''}</p>`).join('')}
          </div>` : ''}
        ${r.h.notes ? `<p style="font-size:12px;color:#475569;margin-top:6px;">${r.h.notes}</p>` : ''}
        ${r.h.photos && r.h.photos.length ? `
          <div style="display:flex;gap:6px;margin-top:8px;">
            ${r.h.photos.map(p => `<img src="${p}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;" />`).join('')}
          </div>` : ''}
      </div>`;
  }).join('');

  return `
    ${filterBar}
    <div style="flex:1;overflow-y:auto;padding:16px;padding-bottom:80px;">
      ${rows.length ? rowsHtml : `
        <div style="text-align:center;padding:48px 20px;">
          <p style="font-size:32px;margin-bottom:8px;">📋</p>
          <p style="font-size:14px;color:#64748b;">No QC records${qcLogFilter!=='all' ? ` for "${qcLogFilter}"` : ''} yet.</p>
        </div>`}
    </div>`;
}

function qcSetLogFilter(f) {
  qcLogFilter = f;
  renderQCDashboard();
}

function openQCPanel(jobId, windowId) {
  const job  = curtainJobs.find(j => j.id === jobId);
  const win  = job && job.windows.find(w => w.id === windowId);
  const card = getItemCard(jobId, windowId);
  if (!job || !win || !card) return;

  // Locking — if someone else has this locked and it's not stale, show a
  // read-only "being inspected" view instead of the form.
  const lockedByOther = card.qcLockedBy && !qcLockIsStale(card) && card.qcLockedBy !== qcCurrentUser;
  if (lockedByOther) {
    qcActiveItem = { jobId, windowId };
    openQCLockedPanel(job, win, card);
    return;
  }
  // Claim the lock — for whoever is acting now (may be null if no QC
  // person has been picked yet this session; they'll pick one in the panel).
  card.qcLockedBy = qcCurrentUser;
  card.qcLockedAt = new Date().toISOString();

  qcActiveItem = { jobId, windowId };
  card.qcSeen = true; // clears the "new" badge once QC opens the item

  const prodTracks = getProdTracks(win.treatment);
  const attempts  = card.qcHistory.length;
  const lastFail  = card.qcHistory.filter(h => h.result === 'fail').pop();

  // Reset checklist state fresh for this attempt — all items default OK
  const checklistItems = getQCChecklistForTreatment(win.treatment);
  qcActiveChecklistItems = checklistItems;
  qcChecklistState = {};
  checklistItems.forEach(it => { qcChecklistState[it.key] = { ok: true, remark: '' }; });

  const checklistHtml = checklistItems.map(it => `
    <div style="border-bottom:1px solid #f1f5f9;padding:10px 0;">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
        <input type="checkbox" id="qc-check-${it.key}" checked
          onchange="qcChecklistItemToggle('${it.key}', this.checked)"
          style="width:18px;height:18px;accent-color:#10b981;flex:none;">
        <span style="font-size:13px;color:#1e2a3b;font-weight:500;">${it.label}</span>
      </label>
      <div id="qc-remark-wrap-${it.key}" style="display:none;margin:8px 0 0 28px;">
        <textarea id="qc-remark-${it.key}" rows="2" placeholder="What's the issue?"
          style="width:100%;padding:8px 10px;border:1px solid #fecaca;border-radius:8px;font-size:12px;background:#fef2f2;box-sizing:border-box;resize:vertical;"></textarea>
      </div>
    </div>`).join('');

  const stageOptions = [
    ...(prodTracks.fabric ? prodTracks.fabric.map(s => `<option value="fabric:${s}">${s} (Fabric)</option>`) : []),
    ...(prodTracks.rail   ? prodTracks.rail.map(s   => `<option value="rail:${s}">${s} (Rail)</option>`)     : []),
  ].join('');

  const historyRows = card.qcHistory.map((h, idx) => `
    <div style="border-bottom:1px solid #e8ecf0;padding:10px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
      <div>
        <p style="font-size:12px;font-weight:700;color:${h.result==='pass'?'#10b981':'#ef4444'};">
          ${h.result === 'pass' ? '✓ Pass' : '✗ Fail'} — Attempt ${h.attempt}
        </p>
        <p style="font-size:11px;color:#64748b;">${h.person} · ${new Date(h.timestamp).toLocaleDateString('en-BH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
        ${h.checklist && h.checklist.some(c => !c.ok) ? `
          <div style="margin-top:4px;">
            ${h.checklist.filter(c => !c.ok).map(c => `<p style="font-size:11px;color:#ef4444;">✗ ${c.label}${c.remark ? ' — ' + c.remark : ''}</p>`).join('')}
          </div>` : ''}
        ${h.notes ? `<p style="font-size:12px;color:#475569;margin-top:3px;">${h.notes}</p>` : ''}
        ${h.result==='fail' && card.reworkLog[idx] ? `<p style="font-size:11px;color:#ef4444;margin-top:2px;">Returned to: ${card.reworkLog[idx].returnTo}</p>` : ''}
      </div>
      ${h.photos && h.photos.length ? `<div style="display:flex;gap:4px;flex:none;flex-wrap:wrap;max-width:104px;justify-content:flex-end;">${h.photos.map(p => `<img src="${p}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" />`).join('')}</div>` : ''}
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
        ${prodTracks.fabric ? `
        <p style="font-size:10px;color:#94a3b8;margin-bottom:4px;">✂️ Fabric</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          ${prodTracks.fabric.map(s => {
            const done = card.fabricTrack && card.fabricTrack.stageDates[s];
            const isCurrent = card.fabricTrack && card.fabricTrack.stage === s && !card.fabricTrack.done;
            const bg = done ? '#10b981' : isCurrent ? '#3b82f6' : '#e2e8f0';
            const col = (done || isCurrent) ? '#fff' : '#94a3b8';
            return `<div style="background:${bg};color:${col};border-radius:20px;padding:5px 12px;font-size:12px;font-weight:600;">
              ${s}${done ? ' ✓' : ''}
              ${done ? `<span style="font-size:10px;opacity:.8;"> ${new Date(card.fabricTrack.stageDates[s]).toLocaleDateString('en-BH',{day:'numeric',month:'short'})}</span>` : ''}
            </div>`;
          }).join('')}
        </div>` : ''}
        ${prodTracks.rail ? `
        <p style="font-size:10px;color:#94a3b8;margin-bottom:4px;">🔩 Rail</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${prodTracks.rail.map(s => {
            const done = card.railTrack && card.railTrack.stageDates[s];
            const isCurrent = card.railTrack && card.railTrack.stage === s && !card.railTrack.done;
            const bg = done ? '#10b981' : isCurrent ? '#3b82f6' : '#e2e8f0';
            const col = (done || isCurrent) ? '#fff' : '#94a3b8';
            return `<div style="background:${bg};color:${col};border-radius:20px;padding:5px 12px;font-size:12px;font-weight:600;">
              ${s}${done ? ' ✓' : ''}
              ${done ? `<span style="font-size:10px;opacity:.8;"> ${new Date(card.railTrack.stageDates[s]).toLocaleDateString('en-BH',{day:'numeric',month:'short'})}</span>` : ''}
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>

      <!-- QC form -->
      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:16px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:12px;">QC inspection — Attempt ${attempts + 1}</p>

        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:6px;">QC person</label>
          <div id="qc-person-roster" style="display:flex;gap:8px;flex-wrap:wrap;">
            ${qcPersonRosterHtml(card)}
          </div>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:2px;">Inspection checklist</label>
          <p style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Checked = OK. Uncheck to flag an issue — a remark will be required.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:4px 12px;">
            ${checklistHtml}
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:6px;">Additional notes (optional)</label>
          <textarea id="qc-notes" rows="2" placeholder="Anything else worth recording..."
            style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;resize:vertical;box-sizing:border-box;background:#f8fafc;"></textarea>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:12px;font-weight:600;color:#475569;display:block;margin-bottom:6px;">Photos <span style="color:#ef4444;">*at least 1 required — pass or fail</span></label>
          <input id="qc-photo-input" type="file" accept="image/*" capture="environment"
            onchange="qcPhotoAdd(this)"
            style="display:none;">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button onclick="document.getElementById('qc-photo-input').click()"
              style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;">
              📷 Add photo
            </button>
            <span id="qc-photo-name" style="font-size:11px;color:#94a3b8;"></span>
          </div>
          <div id="qc-photo-gallery" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;"></div>
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
  window._qcPhotos = [];
  window._qcSelectedPerson = qcCurrentUser || null;
}

function closeQCPanel() {
  // Release the lock if it's still ours (nothing submitted this visit) —
  // recordQCResult already clears it on submit, this covers cancel/back-out.
  if (qcActiveItem) {
    const card = getItemCard(qcActiveItem.jobId, qcActiveItem.windowId);
    if (card && card.qcLockedBy === qcCurrentUser) {
      card.qcLockedBy = null;
      card.qcLockedAt = null;
    }
  }
  const panel = document.getElementById('qc-panel');
  if (panel) panel.style.display = 'none';
  qcActiveItem = null;
  renderQCDashboard();
}

// Read-only view shown when another QC person already has this item open.
function openQCLockedPanel(job, win, card) {
  const panel = document.getElementById('qc-panel');
  panel.innerHTML = `
    <div style="background:#1e2a3b;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5;">
      <div>
        <p style="color:#fff;font-weight:700;font-size:15px;">QC — ${win.label}</p>
        <p style="color:#94a3b8;font-size:11px;margin-top:1px;">${job.name} · ${win.room}</p>
      </div>
      <button onclick="closeQCPanel()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;">← List</button>
    </div>
    <div style="padding:16px;">
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;text-align:center;">
        <p style="font-size:32px;margin-bottom:10px;">🔒</p>
        <p style="font-size:14px;font-weight:700;color:#b45309;">Being inspected by ${card.qcLockedBy}</p>
        <p style="font-size:12px;color:#92400e;margin-top:4px;">Started ${qcLockAgeLabel(card)}. This item will unlock automatically after 15 minutes of inactivity.</p>
        <button onclick="qcOverrideLock('${job.id}','${win.id}')"
          style="margin-top:14px;background:#fff;border:1px solid #f59e0b;color:#b45309;padding:9px 18px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
          Override — take over inspection
        </button>
        <p style="font-size:10px;color:#92400e;margin-top:8px;">Only override if you know that session was abandoned (crashed app, wrong device, etc).</p>
      </div>
    </div>`;
  panel.style.display = 'block';
  panel.scrollTop = 0;
}

function qcOverrideLock(jobId, windowId) {
  const card = getItemCard(jobId, windowId);
  if (!card) return;
  card.qcLockedBy = null;
  card.qcLockedAt = null;
  openQCPanel(jobId, windowId);
}

function qcPhotoAdd(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    if (!window._qcPhotos) window._qcPhotos = [];
    window._qcPhotos.push(e.target.result); // base64
    qcRenderPhotoGallery();
  };
  reader.readAsDataURL(file);
  input.value = ''; // allow re-selecting the same file / adding another right after
}

function qcPhotoRemove(idx) {
  if (!window._qcPhotos) return;
  window._qcPhotos.splice(idx, 1);
  qcRenderPhotoGallery();
}

function qcRenderPhotoGallery() {
  const gallery = document.getElementById('qc-photo-gallery');
  const nameEl  = document.getElementById('qc-photo-name');
  if (!gallery) return;
  const photos = window._qcPhotos || [];
  gallery.innerHTML = photos.map((p, idx) => `
    <div style="position:relative;">
      <img src="${p}" style="width:64px;height:64px;border-radius:8px;object-fit:cover;" />
      <button onclick="qcPhotoRemove(${idx})"
        style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;border:2px solid #fff;font-size:11px;line-height:1;cursor:pointer;">✕</button>
    </div>`).join('');
  if (nameEl) nameEl.textContent = photos.length ? `${photos.length} photo${photos.length>1?'s':''}` : '';
}

// ── QC person roster — tap to select (mirrors TRACK_TEAM pattern) ──
function qcPersonRosterHtml(card) {
  const selected = window._qcSelectedPerson || qcCurrentUser;
  const chips = QC_TEAM.map(p => `
    <button onclick="qcSelectPerson('${p}')"
      style="padding:8px 14px;border-radius:20px;border:1px solid ${selected===p?'#1e2a3b':'#e2e8f0'};background:${selected===p?'#1e2a3b':'#f8fafc'};color:${selected===p?'#fff':'#475569'};font-size:13px;font-weight:600;cursor:pointer;">
      ${p}
    </button>`).join('');
  return `${chips}
    <button onclick="qcAddPersonPrompt()"
      style="padding:8px 14px;border-radius:20px;border:1px dashed #94a3b8;background:#fff;color:#64748b;font-size:13px;font-weight:600;cursor:pointer;">
      + Add QC person
    </button>`;
}

function qcSelectPerson(name) {
  window._qcSelectedPerson = name;
  qcCurrentUser = name; // remembered for the rest of this device session
  const roster = document.getElementById('qc-person-roster');
  if (roster && qcActiveItem) {
    const card = getItemCard(qcActiveItem.jobId, qcActiveItem.windowId);
    roster.innerHTML = qcPersonRosterHtml(card);
    // Claiming a name also claims/refreshes the lock on this item
    if (card) { card.qcLockedBy = name; card.qcLockedAt = new Date().toISOString(); }
  }
}

function qcAddPersonPrompt() {
  const name = (window.prompt('QC person\'s name:', '') || '').trim();
  if (!name) return;
  if (!QC_TEAM.includes(name)) QC_TEAM.push(name);
  qcSelectPerson(name);
}

// Checklist item toggled — show/hide its remark box, then re-evaluate
// whether the overall result should be auto-locked to Fail.
function qcChecklistItemToggle(key, checked) {
  if (!qcChecklistState[key]) return;
  qcChecklistState[key].ok = checked;
  const remarkWrap = document.getElementById(`qc-remark-wrap-${key}`);
  if (remarkWrap) remarkWrap.style.display = checked ? 'none' : 'block';
  qcEvaluateChecklistGate();
}

function qcChecklistHasFailure() {
  return Object.values(qcChecklistState).some(v => !v.ok);
}

// Any unchecked checklist item auto-fails the item and locks out Pass —
// this is a locked design decision, not a suggestion QC can override.
function qcEvaluateChecklistGate() {
  const passBtn = document.getElementById('qc-pass-btn');
  if (!passBtn) return;
  if (qcChecklistHasFailure()) {
    passBtn.style.opacity = '.35';
    passBtn.style.pointerEvents = 'none';
    qcSelectResult('fail');
  } else {
    passBtn.style.opacity = '1';
    passBtn.style.pointerEvents = 'auto';
  }
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

  // Gather checklist results — any unchecked item must have a remark
  const checklist = [];
  for (const key in qcChecklistState) {
    const val = qcChecklistState[key];
    const itemDef = qcActiveChecklistItems.find(it => it.key === key);
    const remarkEl = document.getElementById(`qc-remark-${key}`);
    const remark = remarkEl ? remarkEl.value.trim() : '';
    if (!val.ok && !remark) {
      curtAlert(`Please add a remark for "${itemDef ? itemDef.label : key}" — it's flagged as an issue.`);
      return;
    }
    checklist.push({ key, label: itemDef ? itemDef.label : key, ok: val.ok, remark });
  }

  const notes     = (document.getElementById('qc-notes') || {}).value || '';
  const person    = window._qcSelectedPerson;
  const photos    = window._qcPhotos || [];
  const reworkStageEl = document.getElementById('qc-rework-stage');
  const reworkRaw = (result === 'fail' && reworkStageEl) ? reworkStageEl.value : null;
  const [reworkTrack, reworkStage] = reworkRaw ? reworkRaw.split(':') : [null, null];

  if (!person) { curtAlert('Please select who is doing this QC inspection.'); return; }
  if (photos.length === 0) { curtAlert('At least one photo is required before submitting — pass or fail.'); return; }

  const ok = recordQCResult(
    qcActiveItem.jobId,
    qcActiveItem.windowId,
    result,
    notes,
    photos,
    person,
    reworkTrack,
    reworkStage,
    checklist
  );

  if (ok) {
    window._qcPhotos       = [];
    window._qcSelectedResult = null;
    window._qcSelectedPerson = null;
    qcChecklistState = {};
    qcActiveChecklistItems = [];
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
    ensureInstallDefaults(job);
    const inst   = job.installation;
    const allItems = job.windows.filter(w => w.calcDone);
    const readyAll = allItems.filter(w => {
      const card = job.itemCards[w.id];
      return card && card.stage === 'Ready' && !card.isRework;
    });
    const installed = allItems.filter(w => {
      const card = job.itemCards[w.id];
      return card && card.stage === 'Installed';
    });
    const total = allItems.length;
    const qc = getJobQCStatus(job);
    // Whole job must clear QC before items are released to the crew,
    // unless Ops has explicitly flipped on partial release for this job.
    const released = qc.allPassed || inst.partialRelease === true;
    const ready = released ? readyAll : [];
    const held  = released ? [] : readyAll;
    return { job, inst, ready, held, installed, total, qc };
  }).filter(j => j.total > 0);

  const todayJobs   = jobCards.filter(j => j.inst.scheduledDate === today);
  const upcomingJobs= jobCards.filter(j => j.inst.scheduledDate && j.inst.scheduledDate > today && j.inst.status !== 'complete');
  const readyJobs   = jobCards.filter(j => j.ready.length > 0 && !j.inst.scheduledDate);
  const doneJobs    = jobCards.filter(j => j.inst.status === 'complete');
  const heldJobs    = jobCards.filter(j => j.held.length > 0 && j.inst.status !== 'complete');

  function jobInstallCard(jc) {
    const { job, inst, ready, installed, total } = jc;
    const daysToInstall = inst.scheduledDate ? daysBetween(today, inst.scheduledDate) : null;
    const readyPct = total > 0 ? Math.round(((ready.length + installed.length) / total) * 100) : 0;
    const openSnags = getOpenSnagCount(job);

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

        <!-- Client sign-off -->
        ${installed.length === total && total > 0 && inst.status !== 'complete' ? `
        <div style="margin-top:10px;">
          <button style="width:100%;background:#10b981;color:#fff;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:700;cursor:pointer;"
            onclick="openSignoffPanel('${job.id}')">✍️ Client sign-off →</button>
        </div>` : ''}

        <!-- Snags -->
        <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #f1f5f9;padding-top:10px;">
          <span style="font-size:12px;color:${openSnags > 0 ? '#ef4444' : '#94a3b8'};font-weight:${openSnags > 0 ? '700' : '400'};">
            ${openSnags > 0 ? `⚠ ${openSnags} open snag${openSnags > 1 ? 's' : ''}` : 'No open snags'}
          </span>
          <button onclick="openSnagPanel('${job.id}')" style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">Snags →</button>
        </div>

        ${inst.status === 'complete' ? `<div style="margin-top:8px;"><span class="pill ok">✓ All done · Handover signed</span></div>` : ''}
      </div>`;
  }

  function heldJobCard(jc) {
    const { job, held, qc, total } = jc;
    const openSnags = getOpenSnagCount(job);
    return `
      <div style="border:1px solid #fde68a;border-radius:12px;padding:14px;margin-bottom:10px;background:#fffbeb;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
          <div>
            <p style="font-size:14px;font-weight:700;color:#1e2a3b;">${job.name}</p>
            <p style="font-size:11px;color:#64748b;">${job.id} · ${job.client}</p>
          </div>
          <span class="pill warn">Held</span>
        </div>
        <p style="font-size:12px;color:#92400e;margin-bottom:6px;">${held.length} of ${total} items finished, but held back — QC: ${qc.done}/${qc.total} passed. Released once the whole job clears QC, or Ops enables partial release for this job in the Install tab.</p>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${held.map(w => `<span style="background:#fff;border:1px solid #fde68a;border-radius:6px;padding:3px 8px;font-size:11px;color:#1e2a3b;">${w.label}</span>`).join('')}
        </div>
        <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #fde68a;padding-top:10px;">
          <span style="font-size:12px;color:${openSnags > 0 ? '#ef4444' : '#92400e'};font-weight:${openSnags > 0 ? '700' : '400'};">
            ${openSnags > 0 ? `⚠ ${openSnags} open snag${openSnags > 1 ? 's' : ''}` : 'No open snags'}
          </span>
          <button onclick="openSnagPanel('${job.id}')" style="background:#fff;border:1px solid #fde68a;color:#92400e;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">Snags →</button>
        </div>
      </div>`;
  }

  function section(title, items, accent) {
    if (items.length === 0) return '';
    return `
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${accent||'#94a3b8'};margin:0 0 10px;">${title} (${items.length})</p>
      ${items.map(i => jobInstallCard(i)).join('')}
      <div style="height:16px;"></div>`;
  }

  function heldSection(title, items, accent) {
    if (items.length === 0) return '';
    return `
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${accent||'#94a3b8'};margin:0 0 10px;">${title} (${items.length})</p>
      ${items.map(i => heldJobCard(i)).join('')}
      <div style="height:16px;"></div>`;
  }

  const totalReady = jobCards.reduce((s, j) => s + j.ready.length, 0);
  const totalDone  = jobCards.reduce((s, j) => s + j.installed.length, 0);
  const totalHeld  = jobCards.reduce((s, j) => s + j.held.length, 0);

  wrap.innerHTML = `
    <div style="background:#1e2a3b;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex:none;">
      <div>
        <p style="color:#fff;font-weight:700;font-size:16px;">🏠 Installation Crew</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:2px;">${new Date().toLocaleDateString('en-BH',{day:'numeric',month:'short',year:'numeric'})}</p>
      </div>
      <button onclick="closeInstallCrewDashboard()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;">← Back</button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:16px;background:#fff;border-bottom:1px solid #e8ecf0;flex:none;">
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#f59e0b;">${todayJobs.length}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Today</p>
      </div>
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#10b981;">${totalReady}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Items ready</p>
      </div>
      <div style="text-align:center;padding:10px;background:#f7f9fc;border-radius:10px;">
        <p style="font-size:22px;font-weight:800;color:#f59e0b;">${totalHeld}</p>
        <p style="font-size:11px;color:#64748b;margin-top:2px;">Held (QC pending)</p>
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
      ${heldSection('Held — awaiting full job QC', heldJobs, '#f59e0b')}
      ${section('Completed', doneJobs, '#94a3b8')}
      ${jobCards.length === 0 && heldJobs.length === 0 ? `
        <div style="text-align:center;padding:48px 20px;">
          <p style="font-size:32px;margin-bottom:8px;">🏠</p>
          <p style="font-size:14px;color:#64748b;">No items ready for installation yet.</p>
        </div>` : ''}
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// ON-SITE SNAGS  (Install Crew Dashboard)
// Lightweight, install-specific snag tracking on job.installation.snags[].
// This is separate from Operations' formal job-card snags workflow in
// data.js (top-level `snags[]` on the Operations job object) — this one
// is what the install crew logs and resolves on-site, and it's what
// gates client sign-off below.
// ══════════════════════════════════════════════════════════════
let snagActiveJobId = null;
let snagResolvingId = null; // id of the snag currently showing its resolve form

function getOpenSnagCount(job) {
  ensureInstallDefaults(job);
  return job.installation.snags.filter(s => !s.resolved).length;
}

function openSnagPanel(jobId) {
  snagActiveJobId  = jobId;
  snagResolvingId  = null;
  window._snagPhotos   = [];
  window._snagReporter = null;

  let panel = document.getElementById('snag-panel-wrap');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'snag-panel-wrap';
    panel.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:300;background:#f7f9fc;overflow:hidden;';
    document.body.appendChild(panel);
  }
  panel.style.display = 'flex';
  renderSnagPanel();
}

function closeSnagPanel() {
  const panel = document.getElementById('snag-panel-wrap');
  if (panel) panel.style.display = 'none';
  snagActiveJobId = null;
  renderInstallCrewDashboard();
}

function renderSnagPanel() {
  const panel = document.getElementById('snag-panel-wrap');
  if (!panel) return;
  const job = curtainJobs.find(j => j.id === snagActiveJobId);
  if (!job) { closeSnagPanel(); return; }
  ensureInstallDefaults(job);
  const snags    = job.installation.snags;
  const open     = snags.filter(s => !s.resolved);
  const resolved = snags.filter(s => s.resolved);

  const reporterChips = INSTALL_CREW.map(name => `
    <button type="button" style="padding:6px 12px;border-radius:20px;font-size:12px;border:1px solid ${window._snagReporter===name?'#1e2a3b':'#e2e8f0'};background:${window._snagReporter===name?'#1e2a3b':'#fff'};color:${window._snagReporter===name?'#fff':'#475569'};cursor:pointer;"
      onclick="selectSnagReporter('${name}')">${name}</button>`).join('');

  function newPhotoGallery() {
    const photos = window._snagPhotos || [];
    if (photos.length === 0) return '';
    return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
      ${photos.map((p, i) => `
        <div style="position:relative;width:56px;height:56px;">
          <img src="${p}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;">
          <button onclick="snagPhotoRemove(${i})" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;line-height:1;cursor:pointer;">×</button>
        </div>`).join('')}
    </div>`;
  }

  function snagRow(s) {
    const isResolving = snagResolvingId === s.id;
    return `
      <div style="background:#fff;border:1px solid ${s.resolved ? '#e8ecf0' : '#fecaca'};border-radius:10px;padding:12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
          <div style="flex:1;">
            <p style="font-size:13px;font-weight:600;color:#1e2a3b;">${s.desc}</p>
            <p style="font-size:11px;color:#94a3b8;margin-top:2px;">Reported by ${s.reportedBy} · ${fmtDate(s.reportedAt)}</p>
          </div>
          ${s.resolved ? `<span class="pill ok">✓ Resolved</span>` : `<span class="pill bad">Open</span>`}
        </div>
        ${s.photos && s.photos.length > 0 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${s.photos.map(p => `<img src="${p}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;">`).join('')}</div>` : ''}
        ${s.resolved
          ? `<p style="font-size:11px;color:#64748b;margin-top:8px;">${s.resolvedNotes ? '— ' + s.resolvedNotes + ' ' : ''}${s.resolvedAt ? '· ' + fmtDate(s.resolvedAt) : ''}</p>`
          : (isResolving ? `
          <div style="margin-top:10px;border-top:1px solid #f1f5f9;padding-top:10px;">
            <textarea id="snag-resolve-notes-${s.id}" rows="2" placeholder="What was done to fix it..."
              style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;resize:vertical;box-sizing:border-box;"></textarea>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button onclick="confirmResolveSnag('${s.id}')" style="flex:1;background:#10b981;color:#fff;border:none;border-radius:8px;padding:8px;font-size:12px;font-weight:600;cursor:pointer;">✓ Confirm resolved</button>
              <button onclick="cancelResolveSnag()" style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer;">Cancel</button>
            </div>
          </div>` : `
          <button onclick="startResolveSnag('${s.id}')" style="margin-top:8px;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;">Mark resolved</button>`)}
      </div>`;
  }

  panel.innerHTML = `
    <div style="background:#1e2a3b;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex:none;">
      <div>
        <p style="color:#fff;font-weight:700;font-size:15px;">Snags — ${job.name}</p>
        <p style="color:#94a3b8;font-size:11px;margin-top:1px;">${job.id} · ${open.length} open · ${resolved.length} resolved</p>
      </div>
      <button onclick="closeSnagPanel()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;">← Back</button>
    </div>

    <div style="flex:1;overflow-y:auto;padding:16px;padding-bottom:100px;">
      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:16px;">
        <p style="font-size:12px;font-weight:700;color:#475569;margin-bottom:8px;">Report a snag</p>
        <textarea id="snag-new-desc" rows="2" placeholder="What's the issue..."
          style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;resize:vertical;box-sizing:border-box;margin-bottom:10px;"></textarea>
        <p style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Reported by</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">${reporterChips}</div>
        <input id="snag-photo-input" type="file" accept="image/*" capture="environment" onchange="snagPhotoAdd(this)" style="display:none;">
        <button onclick="document.getElementById('snag-photo-input').click()"
          style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:8px 16px;border-radius:8px;font-size:12px;cursor:pointer;">📷 Add photo</button>
        ${newPhotoGallery()}
        <button onclick="submitSnag()" style="width:100%;margin-top:12px;padding:12px;border-radius:10px;background:#1e2a3b;color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer;">Submit snag</button>
      </div>

      ${open.length > 0 ? `<p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#ef4444;margin-bottom:8px;">Open (${open.length})</p>${open.map(snagRow).join('')}` : ''}
      ${resolved.length > 0 ? `<p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin:16px 0 8px;">Resolved (${resolved.length})</p>${resolved.map(snagRow).join('')}` : ''}
      ${snags.length === 0 ? `<p style="font-size:13px;color:#94a3b8;text-align:center;padding:24px;">No snags reported for this job.</p>` : ''}
    </div>`;
}

function selectSnagReporter(name) {
  window._snagReporter = name;
  renderSnagPanel();
}

function snagPhotoAdd(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    if (!window._snagPhotos) window._snagPhotos = [];
    window._snagPhotos.push(e.target.result);
    renderSnagPanel();
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function snagPhotoRemove(idx) {
  if (!window._snagPhotos) return;
  window._snagPhotos.splice(idx, 1);
  renderSnagPanel();
}

function submitSnag() {
  const job = curtainJobs.find(j => j.id === snagActiveJobId);
  if (!job) return;
  const descEl = document.getElementById('snag-new-desc');
  const desc = descEl ? descEl.value.trim() : '';
  if (!desc) { curtAlert('Please describe the snag first.'); return; }
  if (!window._snagReporter) { curtAlert('Please select who is reporting this.'); return; }
  ensureInstallDefaults(job);
  job.installation.snags.push({
    id: 'snag-' + Date.now(),
    desc,
    reportedBy: window._snagReporter,
    reportedAt: new Date().toISOString(),
    photos: window._snagPhotos || [],
    resolved: false,
    resolvedAt: null,
    resolvedNotes: ''
  });
  window._snagPhotos   = [];
  window._snagReporter = null;
  curtAlert('✓ Snag logged for ' + job.name);
  renderSnagPanel();
}

function startResolveSnag(snagId) {
  snagResolvingId = snagId;
  renderSnagPanel();
}

function cancelResolveSnag() {
  snagResolvingId = null;
  renderSnagPanel();
}

function confirmResolveSnag(snagId) {
  const job = curtainJobs.find(j => j.id === snagActiveJobId);
  if (!job) return;
  const snag = job.installation.snags.find(s => s.id === snagId);
  if (!snag) return;
  const notesEl = document.getElementById('snag-resolve-notes-' + snagId);
  snag.resolved       = true;
  snag.resolvedAt     = new Date().toISOString();
  snag.resolvedNotes  = notesEl ? notesEl.value.trim() : '';
  snagResolvingId = null;
  curtAlert('✓ Snag marked resolved');
  renderSnagPanel();
}

// ══════════════════════════════════════════════════════════════
// CLIENT SIGN-OFF
// Canvas signature pad + client name + completion photos. Hard-gated:
// cannot sign off while the job has any unresolved on-site snag.
// ══════════════════════════════════════════════════════════════
let signoffJobId    = null;
let signoffHasDrawn = false;
let signoffDrawing  = false;
let signoffCtx      = null;
let signoffLastPt   = null;

function openSignoffPanel(jobId) {
  signoffJobId    = jobId;
  signoffHasDrawn = false;
  signoffDrawing  = false;
  signoffCtx      = null;
  signoffLastPt   = null;
  window._signoffPhotos = [];

  let panel = document.getElementById('signoff-panel-wrap');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'signoff-panel-wrap';
    panel.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:300;background:#f7f9fc;overflow:hidden;';
    document.body.appendChild(panel);
  }
  panel.style.display = 'flex';
  renderSignoffPanel();
}

function closeSignoffPanel() {
  const panel = document.getElementById('signoff-panel-wrap');
  if (panel) panel.style.display = 'none';
  signoffJobId = null;
  renderInstallCrewDashboard();
  renderCurtInstall();
}

function renderSignoffPanel() {
  const panel = document.getElementById('signoff-panel-wrap');
  if (!panel) return;
  const job = curtainJobs.find(j => j.id === signoffJobId);
  if (!job) { closeSignoffPanel(); return; }
  ensureInstallDefaults(job);
  const openSnags = getOpenSnagCount(job);

  const header = `
    <div style="background:#1e2a3b;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex:none;">
      <div>
        <p style="color:#fff;font-weight:700;font-size:15px;">Client sign-off — ${job.name}</p>
        <p style="color:#94a3b8;font-size:11px;margin-top:1px;">${job.id} · ${job.client}</p>
      </div>
      <button onclick="closeSignoffPanel()" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;padding:7px 14px;border-radius:8px;font-size:13px;cursor:pointer;">← Back</button>
    </div>`;

  // Hard gate — no form at all while snags are open.
  if (openSnags > 0) {
    panel.innerHTML = header + `
      <div style="flex:1;overflow-y:auto;padding:16px;">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:24px;text-align:center;">
          <p style="font-size:32px;margin-bottom:10px;">🔒</p>
          <p style="font-size:14px;font-weight:700;color:#dc2626;">${openSnags} open snag${openSnags > 1 ? 's' : ''} must be resolved first</p>
          <p style="font-size:12px;color:#991b1b;margin-top:6px;">Client sign-off is locked until every on-site snag for this job is marked resolved.</p>
          <button onclick="closeSignoffPanel();openSnagPanel('${job.id}');" style="margin-top:16px;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;">Go to snags →</button>
        </div>
      </div>`;
    return;
  }

  const photos = window._signoffPhotos || [];
  const photoGallery = photos.length === 0 ? '' : `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
      ${photos.map((p, i) => `
        <div style="position:relative;width:56px;height:56px;">
          <img src="${p}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;">
          <button onclick="signoffPhotoRemove(${i})" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;line-height:1;cursor:pointer;">×</button>
        </div>`).join('')}
    </div>`;

  panel.innerHTML = header + `
    <div style="flex:1;overflow-y:auto;padding:16px;padding-bottom:100px;">
      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:14px;">
        <p style="font-size:12px;font-weight:700;color:#475569;margin-bottom:8px;">Client name</p>
        <input id="signoff-client-name" type="text" placeholder="Name of person signing"
          style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>

      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:14px;">
        <p style="font-size:12px;font-weight:700;color:#475569;margin-bottom:8px;">Completion photos</p>
        <input id="signoff-photo-input" type="file" accept="image/*" capture="environment" onchange="signoffPhotoAdd(this)" style="display:none;">
        <button onclick="document.getElementById('signoff-photo-input').click()"
          style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:8px 16px;border-radius:8px;font-size:12px;cursor:pointer;">📷 Add photo</button>
        ${photoGallery}
      </div>

      <div style="background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:14px;margin-bottom:14px;">
        <p style="font-size:12px;font-weight:700;color:#475569;margin-bottom:8px;">Client signature</p>
        <canvas id="signoff-canvas" width="320" height="160"
          style="width:100%;height:160px;border:1px dashed #cbd5e1;border-radius:8px;background:#fafafa;touch-action:none;"></canvas>
        <button onclick="clearSignoffCanvas()" style="margin-top:8px;background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:6px 14px;border-radius:8px;font-size:12px;cursor:pointer;">Clear</button>
      </div>

      <button onclick="submitSignoff()" style="width:100%;padding:13px;border-radius:10px;background:#10b981;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;">
        ✓ Confirm sign-off
      </button>
    </div>`;

  setupSignoffCanvas();
}

function setupSignoffCanvas() {
  const canvas = document.getElementById('signoff-canvas');
  if (!canvas) return;
  // Match internal pixel size to displayed size for crisp, correctly-aligned strokes.
  canvas.width  = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  signoffCtx = canvas.getContext('2d');
  signoffCtx.strokeStyle = '#1e2a3b';
  signoffCtx.lineWidth   = 2;
  signoffCtx.lineCap     = 'round';

  function pointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches && e.touches[0] ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }
  function start(e) {
    e.preventDefault();
    signoffDrawing = true;
    signoffLastPt  = pointFromEvent(e);
  }
  function move(e) {
    if (!signoffDrawing) return;
    e.preventDefault();
    const pt = pointFromEvent(e);
    signoffCtx.beginPath();
    signoffCtx.moveTo(signoffLastPt.x, signoffLastPt.y);
    signoffCtx.lineTo(pt.x, pt.y);
    signoffCtx.stroke();
    signoffLastPt   = pt;
    signoffHasDrawn = true;
  }
  function end() { signoffDrawing = false; }

  canvas.onmousedown  = start;
  canvas.onmousemove  = move;
  canvas.onmouseup    = end;
  canvas.onmouseleave = end;
  canvas.ontouchstart = start;
  canvas.ontouchmove  = move;
  canvas.ontouchend   = end;
}

function clearSignoffCanvas() {
  const canvas = document.getElementById('signoff-canvas');
  if (!canvas || !signoffCtx) return;
  signoffCtx.clearRect(0, 0, canvas.width, canvas.height);
  signoffHasDrawn = false;
}

function signoffPhotoAdd(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    if (!window._signoffPhotos) window._signoffPhotos = [];
    window._signoffPhotos.push(e.target.result);
    renderSignoffPanel();
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function signoffPhotoRemove(idx) {
  if (!window._signoffPhotos) return;
  window._signoffPhotos.splice(idx, 1);
  renderSignoffPanel();
}

function submitSignoff() {
  const job = curtainJobs.find(j => j.id === signoffJobId);
  if (!job) return;
  if (getOpenSnagCount(job) > 0) { curtAlert('Open snags must be resolved before sign-off.'); return; }
  const nameEl = document.getElementById('signoff-client-name');
  const name   = nameEl ? nameEl.value.trim() : '';
  if (!name) { curtAlert('Please enter the client name.'); return; }
  if (!signoffHasDrawn) { curtAlert('Please capture the client signature first.'); return; }

  const canvas = document.getElementById('signoff-canvas');
  const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : null;

  ensureInstallDefaults(job);
  job.installation.signoff = {
    signedName: name,
    signatureDataUrl,
    photos: window._signoffPhotos || [],
    signedAt: new Date().toISOString()
  };
  job.installation.status = 'complete';
  job.installation.handoverSigned = true;
  job.status = 'complete';

  curtAlert(`✓ Sign-off recorded for ${job.name} — ${name}`);
  closeSignoffPanel();
  renderCurtDashboard();
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


