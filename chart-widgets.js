// ══════════════════════════════════════════
// SHARED CHART WIDGETS (Dashboard Analytics rollout, 5 Aug 2026)
// Promoted/generalized from curtain.js's original ring-gauge/mini-bar
// primitives (renderCurtDashboard()'s "DASHBOARD — INFOGRAPHIC HELPERS"
// section, svgRingGauge/ringStatCard/svgMiniBars) plus two new
// primitives (stacked monthly bars, horizontal bar list) modeled on a
// sales-dashboard prototype Salman shared. Vanilla SVG/CSS strings, no
// charting library — matches this app's whole architecture (the only
// script loaded elsewhere is supabase-js; Three.js is unrelated, just
// the 3D ecosystem hub).
//
// Curtain's own cw*-equivalent functions in curtain.js are UNCHANGED —
// these are new, separate function names (cwRingGauge, not
// svgRingGauge) so nothing here risks curtain.js's existing dashboard.
// The CSS these render into (.ring-card/.mini-bars/etc., styles.css)
// used to be scoped only to #curt-module-wrap; a global fallback
// version now exists (styles.css, "SHARED CHART WIDGETS" section) so
// any module can use these without a restyle — same technique already
// used for .sales-card/.sales-kpi-tile/.stage-pill.
//
// Every primitive here degrades to a plain "not enough data yet"
// message when given zero/near-zero records — non-negotiable, since
// this app ships with almost no seed business data (jobCards[] starts
// empty; customers/enquiries/quotations each have exactly one seed
// row) and these charts will often be empty until real usage
// populates Supabase.
//
// Pure rendering only — no data.js dependency, so load order relative
// to data.js doesn't matter. Consumed by owner.js/sales.js/accounts.js
// and (later) the department manager dashboards.
// ══════════════════════════════════════════

function cwEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }

function cwEmptyState(message) {
  return `<div class="cw-empty"><p>${cwEsc(message || 'Not enough data yet.')}</p></div>`;
}

function cwNiceMax(v) {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}
function cwCompact(n) {
  if (Math.abs(n) >= 1000) return (n / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'K';
  return Math.round(n).toLocaleString('en-US');
}

// ── Ring gauge — single stroke-dasharray ring, percent-based. Caller
// decides color so it can carry status meaning (ok/warn/bad/brand).
// Promoted from curtain.js's svgRingGauge(); identical math, renamed.
function cwRingGauge(pct, color, size, strokeWidth) {
  size = size || 84; strokeWidth = strokeWidth || 9;
  const p = Math.max(0, Math.min(100, pct || 0));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg);">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--biz-border-light)" stroke-width="${strokeWidth}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"
        stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
    </svg>`;
}
function cwRingStatCard(pct, valueLabel, title, sub, color) {
  return `
    <div class="ring-card">
      <div class="ring-wrap">
        ${cwRingGauge(pct, color)}
        <div class="ring-center"><p class="ring-value" style="color:${color}">${cwEsc(valueLabel)}</p></div>
      </div>
      <p class="ring-title">${cwEsc(title)}</p>
      <p class="ring-sub">${cwEsc(sub)}</p>
    </div>`;
}

// ── Mini vertical bar chart. items: [{label, value, color}]. Promoted
// from curtain.js's svgMiniBars(); identical math, renamed, plus an
// empty-state guard curtain's own version never needed (it always had
// at least the last-7-days zero-filled series to show).
function cwMiniBars(items) {
  if (!items || items.length === 0) return cwEmptyState();
  const max = Math.max(1, ...items.map(i => i.value));
  return `<div class="mini-bars">
    ${items.map(i => `
      <div class="mini-bar-col">
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="height:${Math.max(3, Math.round((i.value / max) * 100))}%;background:${i.color || 'var(--biz-primary)'};"></div>
        </div>
        <p class="mini-bar-val">${cwEsc(i.value)}</p>
        <p class="mini-bar-label">${cwEsc(i.label)}</p>
      </div>`).join('')}
  </div>`;
}

// ── Stacked monthly bar chart — the "monthly revenue by division"
// chart from the prototype, adapted to this app's template-string
// rendering convention (the prototype builds it via DOM/createElementNS
// calls; this returns a plain HTML string like every other primitive
// here and elsewhere in this codebase).
// months: [{key, label}]; series: [{name, color, values:[...]}] (each
// values[] array aligned 1:1 to months, same length).
// opts.valueFormatter(n) -> string, defaults to a plain thousands-comma number.
function cwStackedMonthlyBars(months, series, opts) {
  opts = opts || {};
  const fmt = opts.valueFormatter || function (n) { return Math.round(n).toLocaleString('en-US'); };
  if (!months || months.length === 0 || !series || series.length === 0) return cwEmptyState(opts.emptyMessage);
  const totals = months.map(function (m, i) { return series.reduce(function (s, ser) { return s + (ser.values[i] || 0); }, 0); });
  const grandTotal = totals.reduce(function (a, b) { return a + b; }, 0);
  if (grandTotal <= 0) return cwEmptyState(opts.emptyMessage || 'Not enough data yet — this will populate as real business activity happens.');

  const W = 720, H = opts.height || 260, padL = 46, padR = 10, padT = 14, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = months.length;
  const slot = plotW / n;
  const barW = Math.min(38, slot * 0.55);
  const maxTotal = cwNiceMax(Math.max.apply(null, totals) * 1.15);

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block;" role="img" aria-label="Monthly totals by category">`;
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const val = maxTotal * t / ticks;
    const y = padT + plotH - (val / maxTotal) * plotH;
    svg += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="var(--biz-border-light)" stroke-width="1"/>`;
    svg += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--biz-text-faint)">${cwCompact(val)}</text>`;
  }
  svg += `<line x1="${padL}" x2="${W - padR}" y1="${padT + plotH}" y2="${padT + plotH}" stroke="var(--biz-text-faint)" stroke-width="1"/>`;

  months.forEach(function (m, i) {
    const x0 = padL + i * slot + (slot - barW) / 2;
    let yCursor = padT + plotH;
    series.forEach(function (ser, si) {
      const val = ser.values[i] || 0;
      if (val <= 0) return;
      const segH = Math.max((val / maxTotal) * plotH, 0);
      const y = yCursor - segH;
      const isTop = series.slice(si + 1).every(function (s) { return (s.values[i] || 0) <= 0; });
      svg += `<rect x="${x0}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(segH, 1).toFixed(1)}" fill="${ser.color}" rx="${isTop ? 3 : 0}"><title>${cwEsc(ser.name)} — ${m.label}: ${fmt(val)}</title></rect>`;
      yCursor = y;
    });
    if (totals[i] > 0) {
      svg += `<text x="${(x0 + barW / 2).toFixed(1)}" y="${(padT + plotH - (totals[i] / maxTotal) * plotH - 6).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="650" fill="var(--biz-text)">${cwCompact(totals[i])}</text>`;
    }
    svg += `<text x="${(x0 + barW / 2).toFixed(1)}" y="${padT + plotH + 16}" text-anchor="middle" font-size="10" fill="var(--biz-text-muted)">${cwEsc(m.label)}</text>`;
  });
  svg += `</svg>`;

  const legend = `<div class="cw-legend">${series.map(function (s) {
    return `<span class="cw-legend-item"><span class="cw-legend-swatch" style="background:${s.color}"></span>${cwEsc(s.name)}</span>`;
  }).join('')}</div>`;
  return `<div class="cw-chart">${svg}${legend}</div>`;
}

// ── Horizontal ranked bar list — one shared primitive covering
// "division share" (percentage rows), "top clients" (value rows), and
// a pipeline funnel (ordered stage rows) all at once: they're the same
// visual shape, just different formatting/coloring of the same rows.
// rows: [{label, value, color, sublabel}]; opts.valueFormatter,
// opts.maxRows, opts.emptyMessage.
function cwHorizontalBarList(rows, opts) {
  opts = opts || {};
  if (!rows || rows.length === 0) return cwEmptyState(opts.emptyMessage);
  const fmt = opts.valueFormatter || function (n) { return Math.round(n).toLocaleString('en-US'); };
  const list = opts.maxRows ? rows.slice(0, opts.maxRows) : rows;
  const maxVal = Math.max.apply(null, list.map(function (r) { return r.value; }).concat([1]));
  if (maxVal <= 0) return cwEmptyState(opts.emptyMessage);
  return `<div class="cw-hbar-list">
    ${list.map(function (r) {
      const pct = Math.max((r.value / maxVal) * 100, 2);
      return `<div class="cw-hbar-row">
        <div class="cw-hbar-label" title="${cwEsc(r.label)}">${cwEsc(r.label)}</div>
        <div class="cw-hbar-track"><div class="cw-hbar-fill" style="width:${pct.toFixed(2)}%;background:${r.color || 'var(--biz-primary)'};"></div></div>
        <div class="cw-hbar-val">${fmt(r.value)}${r.sublabel ? ` <span class="cw-hbar-sub">${cwEsc(r.sublabel)}</span>` : ''}</div>
      </div>`;
    }).join('')}
  </div>`;
}

// A small fixed ordinal ramp for rows that don't carry real semantic
// colors of their own (e.g. pipeline funnel stages, division share
// bars where no per-division color convention exists — DEPTS' own
// carp/paint/uph/curt colors don't map 1:1 onto SALES_DIVISIONS, which
// includes "Furniture"/"Metal Works" as whole-quote divisions, not
// per-line departments).
const CW_ORDINAL_RAMP = ['#600131', '#9c3d6c', '#c47d00', '#2563eb', '#0f9d58'];
function cwOrdinalColor(i) { return CW_ORDINAL_RAMP[i % CW_ORDINAL_RAMP.length]; }
