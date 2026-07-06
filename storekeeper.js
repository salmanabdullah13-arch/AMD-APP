// ══════════════════════════════════════════
// STOREKEEPER MODULE
// Built session: 6 Jul 2026
// Reads/writes: stockEntries[], itemCards[] (data.js). Reuses purchGetAllJobs(),
// purchGetJobItemOptions(), purchItemRefControl(), purchDeptOptionsHtml(), dc()
// from purchasing.js/data.js rather than duplicating — must load AFTER
// purchasing.js in index.html.
//
// Own separate ecosystem module (Salman's call, 6 Jul 2026) — not a tab
// inside the Purchasing module. Creates its own #sk-module-wrap dynamically
// (index.html wasn't in context this session), so no HTML paste-in is
// needed for the module shell itself. The one remaining piece is the
// ecosystem hub SVG node/icon in index.html that calls showPanel('storekeeper')
// — see handoff notes.
// ══════════════════════════════════════════

const skStyleTag = document.createElement('style');
skStyleTag.textContent = `
#sk-module-wrap { font-family: inherit; }
#sk-module-wrap .ops-header{background:#0f766e;padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#sk-module-wrap .sk-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#sk-module-wrap .sk-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
#sk-module-wrap .sk-kpi-tile{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center;}
#sk-module-wrap .sk-kpi-tile .num{font-size:20px;font-weight:800;color:#0f766e;}
#sk-module-wrap .sk-kpi-tile .lbl{font-size:10.5px;color:#64748b;margin-top:2px;}
#sk-module-wrap .sk-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px;}
#sk-module-wrap .sk-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:20px;background:#f1f5f9;color:#64748b;}
#sk-module-wrap .sk-pill.released{background:#dcfce7;color:#166534;}
#sk-module-wrap .sk-search{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box;}
#sk-module-wrap button.primary{background:#0f766e;color:#fff;border:0;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
#sk-module-wrap .sk-tabs{display:flex;gap:6px;margin-bottom:12px;}
#sk-module-wrap .sk-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid #e2e8f0;background:#fff;color:#475569;cursor:pointer;font-family:inherit;}
#sk-module-wrap .sk-tabbtn.active{background:#0f766e;border-color:#0f766e;color:#fff;}
#sk-module-wrap .sk-panel{display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:200;background:rgba(15,23,42,.55);flex-direction:column;align-items:center;justify-content:flex-start;overflow-y:auto;padding:20px 12px;}
#sk-module-wrap .sk-panel-inner{background:#fff;border-radius:14px;padding:18px;width:100%;max-width:480px;margin-top:20px;box-sizing:border-box;}
#sk-module-wrap .sk-field{margin-bottom:10px;}
#sk-module-wrap .sk-field label{font-size:11px;color:#64748b;display:block;margin-bottom:3px;}
#sk-module-wrap .sk-field input, #sk-module-wrap .sk-field select{width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;}
`;
document.head.appendChild(skStyleTag);

// ── Module shell — created dynamically since index.html wasn't in context ──
const skModuleWrap = document.createElement('div');
skModuleWrap.id = 'sk-module-wrap';
skModuleWrap.style.cssText = 'display:none;';
skModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">📦</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Storekeeper</div>
        <div style="color:#ccfbf1;font-size:11px;">Stock pool → department release</div>
      </div>
    </div>
    <button onclick="closeStorekeeperModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="sk-scroll">
    <div id="sk-dashboard-body"></div>
  </div>
  <div class="sk-panel" id="sk-release-panel">
    <div class="sk-panel-inner" id="sk-release-panel-inner"></div>
  </div>
`;
document.body.appendChild(skModuleWrap);

let skView          = 'pool';   // 'pool' | 'history'
let skSearch        = '';
let skReleaseDraft  = null;     // { entryId, department, jobId, qty, itemRef }

// ── Alert toast (mirrors purchAlert's fallback pattern) ──
function skAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('sk-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sk-toast';
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

// ── Module open / close ─────────────────────
function openStorekeeperModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  const purchMod = document.getElementById('purch-module-wrap');
  if (purchMod) purchMod.style.display = 'none';
  const curtMod = document.getElementById('curt-module-wrap');
  if (curtMod) curtMod.style.display = 'none';

  skModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:#f7f9fc;';
  renderStorekeeperDashboard();
}

function closeStorekeeperModule() {
  skModuleWrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}

function launchStorekeeperModule() {
  openStorekeeperModule();
}

// ── Dashboard ────────────────────────────────
function skSetView(v) { skView = v; renderStorekeeperDashboard(); }
function skSetSearch(v) { skSearch = v; renderStorekeeperDashboard(); }

function skMatches(entry) {
  if (!skSearch.trim()) return true;
  const q = skSearch.trim().toLowerCase();
  return entry.itemName.toLowerCase().includes(q) || entry.sourceInvoice.toLowerCase().includes(q);
}

function renderStorekeeperDashboard() {
  const body = document.getElementById('sk-dashboard-body');
  if (!body) return;
  const summary = getStockPoolSummary();

  const kpiHtml = `
    <div class="sk-kpi-grid">
      <div class="sk-kpi-tile"><div class="num">${summary.inPoolCount}</div><div class="lbl">Entries In-Pool</div></div>
      <div class="sk-kpi-tile"><div class="num">${summary.inPoolQty}</div><div class="lbl">Total Qty In-Pool</div></div>
      <div class="sk-kpi-tile"><div class="num">${summary.releasedTodayCount}</div><div class="lbl">Released Today</div></div>
    </div>`;

  const tabsHtml = `
    <div class="sk-tabs">
      <button class="sk-tabbtn ${skView === 'pool' ? 'active' : ''}" onclick="skSetView('pool')">In-Pool</button>
      <button class="sk-tabbtn ${skView === 'history' ? 'active' : ''}" onclick="skSetView('history')">Release History</button>
    </div>`;

  const searchHtml = `<input class="sk-search" type="text" placeholder="Search item or invoice #..." value="${skSearch}" oninput="skSetSearch(this.value)">`;

  let listHtml = '';
  if (skView === 'pool') {
    const items = stockEntries.filter(s => s.status === 'in-pool' && skMatches(s));
    listHtml = items.length === 0
      ? `<div class="sk-card"><p style="font-size:12.5px;color:#64748b;">No stock entries in the pool${skSearch ? ' matching your search' : ''}.</p></div>`
      : items.map(s => `
        <div class="sk-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <p style="font-weight:700;font-size:13px;">${s.itemName}</p>
              <p style="font-size:11px;color:#64748b;">${s.qty} ${s.unit || ''} · from ${s.sourceInvoice} · received ${s.dateReceived}</p>
            </div>
            <span class="sk-pill">${s.id}</span>
          </div>
          <button class="primary" style="margin-top:10px;font-size:12px;" onclick="openReleasePanel('${s.id}')">Release →</button>
        </div>`).join('');
  } else {
    const items = stockEntries.filter(s => s.status === 'released' && skMatches(s))
      .sort((a, b) => (b.dateReleased || '').localeCompare(a.dateReleased || ''));
    listHtml = items.length === 0
      ? `<div class="sk-card"><p style="font-size:12.5px;color:#64748b;">No release history yet.</p></div>`
      : items.map(s => `
        <div class="sk-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <p style="font-weight:700;font-size:13px;">${s.itemName}</p>
              <p style="font-size:11px;color:#64748b;">${s.qty} ${s.unit || ''} → ${dc(s.releasedTo).n}${s.releasedJobId ? ' · ' + s.releasedJobId : ''}</p>
              <p style="font-size:10.5px;color:#94a3b8;margin-top:2px;">${s.dateReleased} · issued by ${s.issuedBy || '—'} · from ${s.sourceInvoice}</p>
            </div>
            <span class="sk-pill released">Released</span>
          </div>
        </div>`).join('');
  }

  body.innerHTML = kpiHtml + tabsHtml + searchHtml + listHtml;
}

// ── Release panel ────────────────────────────
function openReleasePanel(entryId) {
  const entry = stockEntries.find(s => s.id === entryId);
  if (!entry) return;
  skReleaseDraft = { entryId, department: 'carp', jobId: '', qty: entry.qty, itemRef: null };
  renderReleasePanel();
  const panel = document.getElementById('sk-release-panel');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function renderReleasePanel() {
  const inner = document.getElementById('sk-release-panel-inner');
  if (!inner || !skReleaseDraft) return;
  const entry = stockEntries.find(s => s.id === skReleaseDraft.entryId);
  if (!entry) return;

  inner.innerHTML = `
    <p style="font-weight:700;font-size:14px;margin-bottom:4px;">Release ${entry.itemName}</p>
    <p style="font-size:11px;color:#64748b;margin-bottom:14px;">${entry.qty} ${entry.unit || ''} available · from ${entry.sourceInvoice}</p>

    <div class="sk-field">
      <label>Department receiving stock</label>
      <select onchange="skReleaseDeptChanged(this.value)">${purchDeptOptionsHtml(skReleaseDraft.department)}</select>
    </div>
    <div class="sk-field">
      <label>Job (required)</label>
      <select onchange="skReleaseJobChanged(this.value)">
        <option value="">Select a job…</option>
        ${purchGetAllJobs().map(j => `<option value="${j.id}" ${j.id === skReleaseDraft.jobId ? 'selected' : ''}>${j.id} — ${j.name}</option>`).join('')}
      </select>
    </div>
    <div class="sk-field">
      <label>Item / window allocation (optional)</label>
      ${purchItemRefControl(skReleaseDraft.jobId, skReleaseDraft.itemRef, `skReleaseRefChanged(this.value)`)}
    </div>
    <div class="sk-field">
      <label>Quantity to release (max ${entry.qty})</label>
      <input type="number" step="0.01" max="${entry.qty}" value="${skReleaseDraft.qty}" onchange="skReleaseQtyChanged(this.value)">
    </div>

    <div style="display:flex;gap:8px;margin-top:16px;">
      <button class="primary" style="flex:1;" onclick="saveReleasePanel()">Confirm Release</button>
      <button style="flex:1;background:none;border:1px solid #e2e8f0;border-radius:8px;color:#475569;font-size:13px;cursor:pointer;font-family:inherit;" onclick="closeReleasePanel()">Cancel</button>
    </div>`;
}

function skReleaseDeptChanged(v) { if (skReleaseDraft) skReleaseDraft.department = v; }

function skReleaseJobChanged(v) {
  if (!skReleaseDraft) return;
  skReleaseDraft.jobId = v || '';
  skReleaseDraft.itemRef = null; // job changed — old ref no longer valid
  renderReleasePanel();
}

function skReleaseRefChanged(v) {
  if (!skReleaseDraft) return;
  const opts = skReleaseDraft.jobId ? purchGetJobItemOptions(skReleaseDraft.jobId) : null;
  if (opts) {
    const match = opts.find(o => o.id === v);
    skReleaseDraft.itemRef = match ? { id: match.id, label: match.label } : null;
  } else {
    skReleaseDraft.itemRef = v || null;
  }
}

function skReleaseQtyChanged(v) { if (skReleaseDraft) skReleaseDraft.qty = Number(v); }

function saveReleasePanel() {
  if (!skReleaseDraft) return;
  if (!skReleaseDraft.jobId) { skAlert('Select a job — release requires a job.'); return; }
  if (!skReleaseDraft.qty || skReleaseDraft.qty <= 0) { skAlert('Enter a quantity greater than 0.'); return; }

  const issuedBy = (window.prompt("Your name (releasing this stock):", "") || "").trim();
  if (!issuedBy) { skAlert('Your name is required.'); return; }

  const result = releaseStockEntry(skReleaseDraft.entryId, {
    department: skReleaseDraft.department,
    jobId: skReleaseDraft.jobId,
    qty: skReleaseDraft.qty,
    issuedBy,
    itemRef: skReleaseDraft.itemRef
  });

  if (result.error) { skAlert(result.error); return; }

  skAlert(`✓ Released as ${result.itemCard.code}`);
  closeReleasePanel();
  renderStorekeeperDashboard();
}

function closeReleasePanel() {
  skReleaseDraft = null;
  const panel = document.getElementById('sk-release-panel');
  if (panel) panel.style.display = 'none';
}
