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
#sk-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#sk-module-wrap .ops-header{background:var(--biz-teal);padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#sk-module-wrap .sk-nav{background:var(--biz-card-bg);border-bottom:1px solid var(--biz-border-light);overflow-x:auto;display:flex;padding:0 10px;flex:none;}
#sk-module-wrap .sk-ntab{background:none;border:0;border-bottom:2.5px solid transparent;color:var(--biz-text-muted);padding:10px 10px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap;}
#sk-module-wrap .sk-ntab.active{color:var(--biz-teal);border-bottom-color:var(--biz-teal);font-weight:700;}
#sk-module-wrap .sk-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#sk-module-wrap .sk-subtabs{display:flex;gap:6px;margin-bottom:12px;}
#sk-module-wrap table.sk-table{width:100%;border-collapse:collapse;font-size:11.5px;}
#sk-module-wrap table.sk-table th{text-align:left;color:var(--biz-text-muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;padding:6px;}
#sk-module-wrap table.sk-table td{padding:6px;border-top:1px solid var(--biz-border-light);}
#sk-module-wrap .sk-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
#sk-module-wrap .sk-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#sk-module-wrap .sk-kpi-tile .num{font-size:21px;font-weight:700;color:var(--biz-teal);}
#sk-module-wrap .sk-kpi-tile .lbl{font-size:10.5px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#sk-module-wrap .sk-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#sk-module-wrap .sk-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:3px 10px;border-radius:20px;background:var(--biz-draft-bg);color:var(--biz-draft-text);}
#sk-module-wrap .sk-pill.released{background:var(--biz-confirmed-bg);color:var(--biz-confirmed-text);}
#sk-module-wrap .sk-search{width:100%;padding:9px 12px;border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);font-size:13px;margin-bottom:12px;box-sizing:border-box;background:var(--biz-input-bg);font-family:inherit;}
#sk-module-wrap button.primary{background:var(--biz-teal);color:#fff;border:0;border-radius:var(--biz-r-sm);padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .12s;}
#sk-module-wrap button.primary:hover{background:#0d5f58;}
#sk-module-wrap .sk-tabs{display:flex;gap:6px;margin-bottom:12px;}
#sk-module-wrap .sk-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:var(--biz-card-bg);color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#sk-module-wrap .sk-tabbtn.active{background:var(--biz-teal);border-color:var(--biz-teal);color:#fff;}
#sk-module-wrap .sk-panel{display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:200;background:rgba(15,23,42,.55);flex-direction:column;align-items:center;justify-content:flex-start;overflow-y:auto;padding:20px 12px;}
#sk-module-wrap .sk-panel-inner{background:var(--biz-card-bg);border-radius:14px;padding:18px;width:100%;max-width:480px;margin-top:20px;box-sizing:border-box;}
#sk-module-wrap .sk-field{margin-bottom:10px;}
#sk-module-wrap .sk-field label{font-size:10.5px;font-weight:700;color:var(--biz-text-muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px;}
#sk-module-wrap .sk-field input, #sk-module-wrap .sk-field select{width:100%;padding:9px 11px;border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);font-size:13px;box-sizing:border-box;background:var(--biz-input-bg);font-family:inherit;}
#sk-module-wrap .sk-field input:focus, #sk-module-wrap .sk-field select:focus{outline:none;border-color:var(--biz-teal);background:var(--biz-card-bg);}
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
        <div style="color:#ccfbf1;font-size:11px;">Inventory · stock pool → department release</div>
      </div>
    </div>
    <button onclick="closeStorekeeperModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="sk-nav" id="sk-nav">
    <button class="sk-ntab active" data-p="dashboard" onclick="skGoTo('dashboard')">Dashboard</button>
    <button class="sk-ntab" data-p="items" onclick="skGoTo('items')">Item Master</button>
    <button class="sk-ntab" data-p="masters" onclick="skGoTo('masters')">Masters</button>
    <button class="sk-ntab" data-p="adjustment" onclick="skGoTo('adjustment')">Stock Adj.</button>
    <button class="sk-ntab" data-p="mi" onclick="skGoTo('mi')">Material Issue</button>
    <button class="sk-ntab" data-p="mr" onclick="skGoTo('mr')">Material Return</button>
    <button class="sk-ntab" data-p="reports" onclick="skGoTo('reports')">Reports</button>
  </div>
  <div class="sk-scroll">
    <div id="sk-page-dashboard" class="sk-page"><div id="sk-dashboard-body"></div></div>
    <div id="sk-page-items" class="sk-page" style="display:none;"><div id="sk-items-body"></div></div>
    <div id="sk-page-masters" class="sk-page" style="display:none;"><div id="sk-masters-body"></div></div>
    <div id="sk-page-adjustment" class="sk-page" style="display:none;"><div id="sk-adjustment-body"></div></div>
    <div id="sk-page-mi" class="sk-page" style="display:none;"><div id="sk-mi-body"></div></div>
    <div id="sk-page-mr" class="sk-page" style="display:none;"><div id="sk-mr-body"></div></div>
    <div id="sk-page-reports" class="sk-page" style="display:none;"><div id="sk-reports-body"></div></div>
  </div>
  <div class="sk-panel" id="sk-release-panel">
    <div class="sk-panel-inner" id="sk-release-panel-inner"></div>
  </div>
  <div class="sk-panel" id="sk-item-form">
    <div class="sk-panel-inner" id="sk-item-form-inner"></div>
  </div>
  <div class="sk-panel" id="sk-adjustment-form">
    <div class="sk-panel-inner" id="sk-adjustment-form-inner"></div>
  </div>
  <div class="sk-panel" id="sk-catelog-form">
    <div class="sk-panel-inner" id="sk-catelog-form-inner"></div>
  </div>
`;
document.body.appendChild(skModuleWrap);

let skView          = 'pool';   // 'pool' | 'history'
let skSearch        = '';
let skReleaseDraft  = null;     // { entryId, department, jobId, qty, itemRef }
let skPage             = 'dashboard';
let skMastersTab       = 'unit';    // 'unit' | 'category' | 'catelog'
let skItemFormDraft    = null;      // Item Master create/edit draft
let skItemEditingId    = null;
let skAdjDraft         = null;      // Stock Adjustment create draft
let skReportsTab       = 'stock';   // 'stock' | 'summary' | 'mrp'
let skStockReportItemId = '';
let skStockReportFilters = { voucherType: 'All', from: '', to: '' };
let skSummaryFilters   = { category: '', itemName: '', includeZero: true };
let skMrpChecked       = new Set();

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
  ['sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  skModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:#f7f9fc;';
  skGoTo('dashboard');
}

function closeStorekeeperModule() {
  skModuleWrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}

function launchStorekeeperModule() {
  openStorekeeperModule();
}

// ── Nav / page switch ────────────────────────
function skGoTo(page) {
  skPage = page;
  document.querySelectorAll('#sk-nav .sk-ntab').forEach(t => t.classList.toggle('active', t.dataset.p === page));
  document.querySelectorAll('#sk-module-wrap .sk-page').forEach(p => p.style.display = (p.id === 'sk-page-' + page) ? 'block' : 'none');
  if (page === 'dashboard') renderStorekeeperDashboard();
  if (page === 'items') renderItemMasterList();
  if (page === 'masters') renderMastersTab();
  if (page === 'adjustment') renderStockAdjustmentList();
  if (page === 'mi') renderMaterialsMoveList('MI');
  if (page === 'mr') renderMaterialsMoveList('MR');
  if (page === 'reports') renderInventoryReports();
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
      <div class="sk-kpi-tile"><div class="num">${summary.distinctItemsInPool}</div><div class="lbl">Distinct Items</div></div>
      <div class="sk-kpi-tile"><div class="num">${summary.releasedTodayCount}</div><div class="lbl">Released Today</div></div>
      <div class="sk-kpi-tile"><div class="num">${summary.releasedTotalCount}</div><div class="lbl">Released (Total)</div></div>
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

// ══════════════════════════════════════════
// ITEM MASTER (Masters → Inventory → Item)
// ══════════════════════════════════════════
let skItemFilters = { category: '', vendor: '', catelog: '', name: '' };

function skItemFilterChanged(key, val) { skItemFilters[key] = val; renderItemMasterList(); }

function renderItemMasterList() {
  const f = skItemFilters;
  const rows = itemMaster.filter(it =>
    (!f.category || it.stockCategory === f.category) &&
    (!f.vendor || it.vendorId === f.vendor) &&
    (!f.catelog || it.catelogId === f.catelog) &&
    (!f.name || it.name.toLowerCase().includes(f.name.toLowerCase()))
  );

  const filterHtml = `
    <div class="sk-card">
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <select style="flex:1;min-width:120px;" onchange="skItemFilterChanged('category', this.value)">
          <option value="">All Categories</option>
          ${stockCategories.map(c => `<option value="${c.name}" ${c.name === f.category ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
        <select style="flex:1;min-width:120px;" onchange="skItemFilterChanged('vendor', this.value)">
          <option value="">All Vendors</option>
          ${suppliers.map(s => `<option value="${s.id}" ${s.id === f.vendor ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
        <select style="flex:1;min-width:120px;" onchange="skItemFilterChanged('catelog', this.value)">
          <option value="">All Catelogs</option>
          ${catelogs.map(c => `<option value="${c.id}" ${c.id === f.catelog ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <input class="sk-search" style="margin:8px 0 0;" type="text" placeholder="Item Name..." value="${f.name}" oninput="skItemFilterChanged('name', this.value)">
    </div>
    <button class="primary" style="width:100%;margin-bottom:12px;" onclick="openItemForm()">+ New Item</button>`;

  const tableHtml = rows.length === 0
    ? `<div class="sk-card"><p style="font-size:12.5px;color:#64748b;">No items match these filters.</p></div>`
    : `<div class="sk-card" style="overflow-x:auto;"><table class="sk-table">
        <tr><th>Item Name</th><th>Item Code</th><th>Cost Price</th><th>Selling Price</th><th>Closing Stock</th><th>Last Purchase Rate</th><th>Action</th></tr>
        ${rows.map(it => `
        <tr>
          <td style="font-weight:600;">${it.name}</td><td>${it.id}</td>
          <td>${it.cost.toFixed(3)}</td><td>${it.sellingPrice.toFixed(3)}</td>
          <td>${it.closingStock}</td><td>${it.lastPurchaseRate.toFixed(3)}</td>
          <td><button style="font-size:11px;background:none;border:1px solid var(--biz-teal);color:var(--biz-teal);border-radius:6px;padding:3px 8px;cursor:pointer;" onclick="openItemForm('${it.id}')">Edit</button></td>
        </tr>`).join('')}
      </table></div>`;

  document.getElementById('sk-items-body').innerHTML = filterHtml + tableHtml;
}

function openItemForm(itemId = null) {
  skItemEditingId = itemId;
  const existing = itemId ? itemMaster.find(i => i.id === itemId) : null;
  skItemFormDraft = existing ? { ...existing } : {
    stockCategory: stockCategories[0] ? stockCategories[0].name : '', vendorId: null, catelogId: null,
    vatPercent: 10, name: '', rollWidth: '', packing: '', unit: units[0] ? units[0].name : '',
    cost: 0, sellingPrice: 0, reorderLevel: 0, description: '',
    purchaseAllowed: true, salesAllowed: true, rawMaterial: false, openingStock: 0
  };
  renderItemForm();
  const panel = document.getElementById('sk-item-form');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function renderItemForm() {
  const inner = document.getElementById('sk-item-form-inner');
  if (!inner || !skItemFormDraft) return;
  const d = skItemFormDraft;
  inner.innerHTML = `
    <p style="font-weight:700;font-size:14px;margin-bottom:10px;">${skItemEditingId ? 'Edit Item' : 'New Item'}</p>
    <div class="sk-field"><label>Stock Category*</label>
      <select onchange="skItemFieldChanged('stockCategory', this.value)">${stockCategories.map(c => `<option value="${c.name}" ${c.name === d.stockCategory ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
    </div>
    <div class="sk-field"><label>Vendor</label>
      <select onchange="skItemFieldChanged('vendorId', this.value)">
        <option value="">-None-</option>
        ${suppliers.map(s => `<option value="${s.id}" ${s.id === d.vendorId ? 'selected' : ''}>${s.name}</option>`).join('')}
      </select>
    </div>
    <div class="sk-field"><label>Catelog</label>
      <select onchange="skItemFieldChanged('catelogId', this.value)">
        <option value="">-None-</option>
        ${catelogs.map(c => `<option value="${c.id}" ${c.id === d.catelogId ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="sk-field"><label>VAT %*</label>
      <select onchange="skItemFieldChanged('vatPercent', Number(this.value))">${SUPPLIER_TAX_PERCENTS.map(t => `<option value="${t}" ${t === d.vatPercent ? 'selected' : ''}>${t}%</option>`).join('')}</select>
    </div>
    <div class="sk-field"><label>Stock Name*</label><input type="text" value="${d.name}" onchange="skItemFieldChanged('name', this.value)"></div>
    <div class="sk-field"><label>Roll Width (Mtr)</label><input type="number" step="0.01" value="${d.rollWidth || ''}" onchange="skItemFieldChanged('rollWidth', this.value)"></div>
    <div class="sk-field"><label>Packing</label><input type="text" value="${d.packing}" onchange="skItemFieldChanged('packing', this.value)"></div>
    <div class="sk-field"><label>Units*</label>
      <select onchange="skItemFieldChanged('unit', this.value)">${units.map(u => `<option value="${u.name}" ${u.name === d.unit ? 'selected' : ''}>${u.name}</option>`).join('')}</select>
    </div>
    <div class="sk-field"><label>Cost</label><input type="number" step="0.001" value="${d.cost}" onchange="skItemFieldChanged('cost', Number(this.value))"></div>
    <div class="sk-field"><label>Avg. Cost</label><input type="number" step="0.001" value="${(d.avgCost != null ? d.avgCost : d.cost).toFixed ? (d.avgCost != null ? d.avgCost : d.cost).toFixed(3) : d.cost}" disabled></div>
    <div class="sk-field"><label>Selling Price</label><input type="number" step="0.001" value="${d.sellingPrice}" onchange="skItemFieldChanged('sellingPrice', Number(this.value))"></div>
    <div class="sk-field"><label>Reorder Level</label><input type="number" step="1" value="${d.reorderLevel}" onchange="skItemFieldChanged('reorderLevel', Number(this.value))"></div>
    ${skItemEditingId ? '' : `<div class="sk-field"><label>Opening Stock</label><input type="number" step="0.01" value="${d.openingStock}" onchange="skItemFieldChanged('openingStock', Number(this.value))"></div>`}
    <div class="sk-field"><label>Stock Description</label><textarea rows="3" onchange="skItemFieldChanged('description', this.value)">${d.description}</textarea></div>
    <div class="sk-field"><label><input type="checkbox" style="width:auto;display:inline;margin-right:6px;" ${d.purchaseAllowed ? 'checked' : ''} onchange="skItemFieldChanged('purchaseAllowed', this.checked)">Purchase Allowed</label></div>
    <div class="sk-field"><label><input type="checkbox" style="width:auto;display:inline;margin-right:6px;" ${d.salesAllowed ? 'checked' : ''} onchange="skItemFieldChanged('salesAllowed', this.checked)">Sales Allowed</label></div>
    <div class="sk-field"><label><input type="checkbox" style="width:auto;display:inline;margin-right:6px;" ${d.rawMaterial ? 'checked' : ''} onchange="skItemFieldChanged('rawMaterial', this.checked)">Raw Material</label></div>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="primary" style="flex:1;" onclick="saveItemForm()">Save Item →</button>
      <button style="flex:1;background:none;border:1px solid var(--biz-border);border-radius:8px;color:var(--biz-text-muted);font-size:13px;cursor:pointer;font-family:inherit;" onclick="closeItemForm()">Cancel</button>
    </div>`;
}

function skItemFieldChanged(field, value) { if (skItemFormDraft) skItemFormDraft[field] = value; }

function saveItemForm() {
  if (!skItemFormDraft) return;
  const d = skItemFormDraft;
  if (skItemEditingId) {
    updateItemMasterEntry(skItemEditingId, {
      stockCategory: d.stockCategory, vendorId: d.vendorId || null, catelogId: d.catelogId || null,
      vatPercent: d.vatPercent, name: d.name, rollWidth: d.rollWidth ? Number(d.rollWidth) : null,
      packing: d.packing, unit: d.unit, cost: d.cost, sellingPrice: d.sellingPrice,
      reorderLevel: d.reorderLevel, description: d.description,
      purchaseAllowed: d.purchaseAllowed, salesAllowed: d.salesAllowed, rawMaterial: d.rawMaterial
    });
    skAlert(`✓ ${skItemEditingId} updated`);
  } else {
    const result = createItemMasterEntry(d);
    if (result && result.error) { skAlert(result.error); return; }
    skAlert(`✓ ${result.id} created`);
  }
  closeItemForm();
  renderItemMasterList();
}

function closeItemForm() {
  skItemFormDraft = null;
  skItemEditingId = null;
  const panel = document.getElementById('sk-item-form');
  if (panel) panel.style.display = 'none';
}

// ══════════════════════════════════════════
// MASTERS — Unit / Stock Category / Catelog
// (Masters → Inventory → Vendor / "Stock Group" is the confirmed vestigial
// duplicate from Batch 1 — deliberately not built here.)
// ══════════════════════════════════════════
function skSetMastersTab(tab) { skMastersTab = tab; renderMastersTab(); }

function renderMastersTab() {
  const tabsHtml = `
    <div class="sk-subtabs">
      <button class="sk-tabbtn ${skMastersTab === 'unit' ? 'active' : ''}" onclick="skSetMastersTab('unit')">Unit</button>
      <button class="sk-tabbtn ${skMastersTab === 'category' ? 'active' : ''}" onclick="skSetMastersTab('category')">Stock Category</button>
      <button class="sk-tabbtn ${skMastersTab === 'catelog' ? 'active' : ''}" onclick="skSetMastersTab('catelog')">Catelog</button>
    </div>`;

  let body = '';
  if (skMastersTab === 'unit') {
    body = `
      <div class="sk-card">
        <div style="display:flex;gap:6px;"><input id="sk-new-unit" type="text" placeholder="New unit name" style="flex:1;padding:8px;border:1px solid var(--biz-border);border-radius:8px;"><button class="primary" onclick="skAddUnitInline()">Add</button></div>
      </div>
      <div class="sk-card" style="overflow-x:auto;"><table class="sk-table"><tr><th>Name</th><th>Status</th></tr>
        ${units.map(u => `<tr><td>${u.name}</td><td>${u.status}</td></tr>`).join('')}
      </table></div>`;
  } else if (skMastersTab === 'category') {
    body = `
      <div class="sk-card">
        <div style="display:flex;gap:6px;"><input id="sk-new-category" type="text" placeholder="New category name" style="flex:1;padding:8px;border:1px solid var(--biz-border);border-radius:8px;"><button class="primary" onclick="skAddCategoryInline()">Add</button></div>
      </div>
      <div class="sk-card" style="overflow-x:auto;"><table class="sk-table"><tr><th>Name</th></tr>
        ${stockCategories.map(c => `<tr><td>${c.name}</td></tr>`).join('')}
      </table></div>`;
  } else {
    body = `
      <button class="primary" style="width:100%;margin-bottom:12px;" onclick="openCatelogForm()">+ New Catelog</button>
      <div class="sk-card" style="overflow-x:auto;"><table class="sk-table"><tr><th>Name</th><th>Vendor</th></tr>
        ${catelogs.map(c => { const v = suppliers.find(s => s.id === c.vendorId); return `<tr><td>${c.name}</td><td>${v ? v.name : '—'}</td></tr>`; }).join('')}
      </table></div>`;
  }

  document.getElementById('sk-masters-body').innerHTML = tabsHtml + body;
}

function skAddUnitInline() {
  const val = document.getElementById('sk-new-unit').value;
  const result = addUnit(val);
  if (result && result.error) { skAlert(result.error); return; }
  renderMastersTab();
}
function skAddCategoryInline() {
  const val = document.getElementById('sk-new-category').value;
  const result = addStockCategory(val);
  if (result && result.error) { skAlert(result.error); return; }
  renderMastersTab();
}

function openCatelogForm() {
  const inner = document.getElementById('sk-catelog-form-inner');
  inner.innerHTML = `
    <p style="font-weight:700;font-size:14px;margin-bottom:10px;">New Catelog</p>
    <div class="sk-field"><label>Name</label><input id="sk-catelog-name" type="text"></div>
    <div class="sk-field"><label>Vendor</label>
      <select id="sk-catelog-vendor"><option value="">-None-</option>${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="primary" style="flex:1;" onclick="saveCatelogForm()">Save →</button>
      <button style="flex:1;background:none;border:1px solid var(--biz-border);border-radius:8px;color:var(--biz-text-muted);font-size:13px;cursor:pointer;font-family:inherit;" onclick="closeCatelogForm()">Cancel</button>
    </div>`;
  const panel = document.getElementById('sk-catelog-form');
  if (panel) panel.style.display = 'flex';
}
function saveCatelogForm() {
  const name = document.getElementById('sk-catelog-name').value;
  const vendorId = document.getElementById('sk-catelog-vendor').value || null;
  const result = createCatelog({ name, vendorId });
  if (result && result.error) { skAlert(result.error); return; }
  skAlert(`✓ ${result.name} created`);
  closeCatelogForm();
  renderMastersTab();
}
function closeCatelogForm() {
  const panel = document.getElementById('sk-catelog-form');
  if (panel) panel.style.display = 'none';
}

// ══════════════════════════════════════════
// STOCK ADJUSTMENT (Transactions → Inventory → Stock Adjustment)
// ══════════════════════════════════════════
let skAdjFilters = { from: '', to: '', saNo: '' };
function skAdjFilterChanged(key, val) { skAdjFilters[key] = val; renderStockAdjustmentList(); }

function renderStockAdjustmentList() {
  const f = skAdjFilters;
  const rows = stockAdjustments.filter(sa =>
    (!f.from || sa.date >= f.from) && (!f.to || sa.date <= f.to) && (!f.saNo || sa.id.toLowerCase().includes(f.saNo.toLowerCase()))
  ).slice().reverse();

  const filterHtml = `
    <div class="sk-card">
      <div style="display:flex;gap:6px;">
        <input type="date" style="flex:1;" value="${f.from}" onchange="skAdjFilterChanged('from', this.value)">
        <input type="date" style="flex:1;" value="${f.to}" onchange="skAdjFilterChanged('to', this.value)">
      </div>
      <input class="sk-search" style="margin-top:8px;" type="text" placeholder="SA No..." value="${f.saNo}" oninput="skAdjFilterChanged('saNo', this.value)">
    </div>
    <button class="primary" style="width:100%;margin-bottom:12px;" onclick="openAdjustmentForm()">+ New Stock Adjustment</button>`;

  const tableHtml = rows.length === 0
    ? `<div class="sk-card"><p style="font-size:12.5px;color:#64748b;">No stock adjustments yet.</p></div>`
    : rows.map(sa => `
      <div class="sk-card">
        <p style="font-weight:700;font-size:13px;">${sa.id}</p>
        <p style="font-size:11px;color:#64748b;">${sa.date} · ${sa.type} · ${sa.reason}</p>
        <p style="font-size:11.5px;color:#334155;margin-top:6px;">${sa.items.map(it => `${it.itemName} (${it.qty > 0 ? '+' : ''}${it.qty})`).join(', ')}</p>
      </div>`).join('');

  document.getElementById('sk-adjustment-body').innerHTML = filterHtml + tableHtml;
}

function openAdjustmentForm() {
  skAdjDraft = { reason: 'Not Applicable', items: [{ itemId: '', qty: 0 }] };
  renderAdjustmentForm();
  const panel = document.getElementById('sk-adjustment-form');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function renderAdjustmentForm() {
  const inner = document.getElementById('sk-adjustment-form-inner');
  if (!inner || !skAdjDraft) return;
  inner.innerHTML = `
    <p style="font-weight:700;font-size:14px;margin-bottom:2px;">New Stock Adjustment</p>
    <p style="font-size:11px;color:#64748b;margin-bottom:10px;">Type: Stock Adjustment · Location: Location 1 (single-location system)</p>
    <div class="sk-field"><label>Adjustment Reason</label>
      <select onchange="skAdjReasonChanged(this.value)">${STOCK_ADJUSTMENT_REASONS.map(r => `<option ${r === skAdjDraft.reason ? 'selected' : ''}>${r}</option>`).join('')}</select>
    </div>
    <p style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px;">Items (qty is a signed delta — negative reduces stock)</p>
    ${skAdjDraft.items.map((it, i) => {
      const master = itemMaster.find(m => m.id === it.itemId);
      return `
      <div class="sk-card" style="margin-bottom:8px;">
        <select onchange="skAdjItemChanged(${i}, this.value)">
          <option value="">-Select item-</option>
          ${itemMaster.map(m => `<option value="${m.id}" ${m.id === it.itemId ? 'selected' : ''}>${m.name} (stock: ${m.closingStock})</option>`).join('')}
        </select>
        <div style="display:flex;gap:6px;margin-top:6px;align-items:center;">
          <span style="font-size:11px;color:#64748b;">${master ? master.unit : ''}</span>
          <input type="number" step="0.01" style="flex:1;" placeholder="Qty (+/-)" value="${it.qty}" onchange="skAdjQtyChanged(${i}, this.value)">
        </div>
      </div>`;
    }).join('')}
    <button style="background:none;border:1px dashed var(--biz-teal);color:var(--biz-teal);border-radius:8px;padding:8px;width:100%;font-size:12.5px;cursor:pointer;" onclick="skAdjAddRow()">+ Add row</button>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="primary" style="flex:1;" onclick="saveAdjustmentForm()">Submit</button>
      <button style="flex:1;background:none;border:1px solid var(--biz-border);border-radius:8px;color:var(--biz-text-muted);font-size:13px;cursor:pointer;font-family:inherit;" onclick="closeAdjustmentForm()">Cancel</button>
    </div>`;
}

function skAdjReasonChanged(v) { if (skAdjDraft) skAdjDraft.reason = v; }
function skAdjItemChanged(i, v) { if (skAdjDraft) { skAdjDraft.items[i].itemId = v; renderAdjustmentForm(); } }
function skAdjQtyChanged(i, v) { if (skAdjDraft) skAdjDraft.items[i].qty = Number(v) || 0; }
function skAdjAddRow() { if (skAdjDraft) { skAdjDraft.items.push({ itemId: '', qty: 0 }); renderAdjustmentForm(); } }

function saveAdjustmentForm() {
  if (!skAdjDraft) return;
  const items = skAdjDraft.items.filter(it => it.itemId && it.qty !== 0).map(it => {
    const master = itemMaster.find(m => m.id === it.itemId);
    return { itemId: it.itemId, itemName: master ? master.name : '', unit: master ? master.unit : '', qty: it.qty };
  });
  if (items.length === 0) { skAlert('Add at least one item with a non-zero quantity.'); return; }
  const result = createStockAdjustment({ reason: skAdjDraft.reason, items });
  if (result && result.error) { skAlert(result.error); return; }
  skAlert(`✓ ${result.id} recorded`);
  closeAdjustmentForm();
  renderStockAdjustmentList();
}
function closeAdjustmentForm() {
  skAdjDraft = null;
  const panel = document.getElementById('sk-adjustment-form');
  if (panel) panel.style.display = 'none';
}

// ══════════════════════════════════════════
// MATERIAL ISSUE / MATERIAL RETURN — cross-job lists
// (Transactions → Inventory → Material Issue / Material Return)
// Creation itself happens on the Job Card's own screen (Jobs module,
// already built) — "Search Client or Job Card" here is a job picker that
// hands off straight to that screen, matching the real requirement that a
// Material Issue/Return can't exist without an underlying Job Card.
// ══════════════════════════════════════════
function skStartMaterialsMove(kind) {
  const openJobs = jobCards.filter(j => j.status === 'open');
  if (openJobs.length === 0) { skAlert('No open Job Cards to issue/return materials against.'); return; }
  const jobId = window.prompt(
    `Enter Job No to ${kind === 'MI' ? 'issue materials to' : 'return materials from'}:\n` +
    openJobs.map(j => j.id).join(', '), openJobs[0].id
  );
  if (!jobId) return;
  const job = getJobCard(jobId.trim());
  if (!job) { skAlert('Job Card not found.'); return; }
  closeStorekeeperModule();
  openJobsModule(job.id);
  openMaterialsMove(job.id, kind === 'MI' ? 'issue' : 'return');
}

function renderMaterialsMoveList(kind) {
  const rows = getAllMaterialsMoves(kind);
  const label = kind === 'MI' ? 'Material Issue' : 'Material Return';

  const html = `
    <button class="primary" style="width:100%;margin-bottom:12px;" onclick="skStartMaterialsMove('${kind}')">+ New ${label}</button>` +
    (rows.length === 0
      ? `<div class="sk-card"><p style="font-size:12.5px;color:#64748b;">No ${label} documents yet.</p></div>`
      : `<div class="sk-card" style="overflow-x:auto;"><table class="sk-table">
          <tr><th>${kind} Number</th><th>Client</th><th>Date</th><th>Job Number</th><th>Action</th></tr>
          ${rows.map(r => `
          <tr style="${r.move.status === 'cancelled' ? 'background:#fef2f2;color:#991b1b;' : ''}">
            <td style="font-weight:600;">${r.move.id}${r.move.status === 'cancelled' ? ' (Cancelled)' : ''}</td>
            <td>${r.client}</td><td>${r.move.date}</td><td>${r.jobId}</td>
            <td>
              <button style="font-size:11px;background:none;border:0;color:var(--biz-teal);cursor:pointer;" onclick="skAlert('Print not implemented in this build.')">Print</button>
              <button style="font-size:11px;background:none;border:0;color:var(--biz-teal);cursor:pointer;" onclick="closeStorekeeperModule();openJobsModule('${r.jobId}')">Edit</button>
              ${r.move.status !== 'cancelled' ? `<button style="font-size:11px;background:none;border:0;color:#dc2626;cursor:pointer;" onclick="skCancelMove('${r.jobId}','${kind}','${r.move.id}')">Cancel</button>` : ''}
            </td>
          </tr>`).join('')}
        </table></div>`);

  document.getElementById(kind === 'MI' ? 'sk-mi-body' : 'sk-mr-body').innerHTML = html;
}

function skCancelMove(jobId, kind, moveId) {
  const result = cancelMaterialsMove(jobId, kind, moveId);
  if (result && result.error) { skAlert(result.error); return; }
  skAlert(`${moveId} cancelled`);
  renderMaterialsMoveList(kind);
}

// ══════════════════════════════════════════
// STOCK REPORTS (Reports → Stock Ledger)
// ══════════════════════════════════════════
function skSetReportsTab(tab) { skReportsTab = tab; renderInventoryReports(); }

function renderInventoryReports() {
  const tabsHtml = `
    <div class="sk-subtabs">
      <button class="sk-tabbtn ${skReportsTab === 'stock' ? 'active' : ''}" onclick="skSetReportsTab('stock')">Stock Report</button>
      <button class="sk-tabbtn ${skReportsTab === 'summary' ? 'active' : ''}" onclick="skSetReportsTab('summary')">Item Summary</button>
      <button class="sk-tabbtn ${skReportsTab === 'mrp' ? 'active' : ''}" onclick="skSetReportsTab('mrp')">Job Material Requirement</button>
    </div>`;

  let body = '';
  if (skReportsTab === 'stock') body = renderStockReportTab();
  else if (skReportsTab === 'summary') body = renderItemSummaryTab();
  else body = renderJobMaterialRequirementTab();

  document.getElementById('sk-reports-body').innerHTML = tabsHtml + body;
}

function renderStockReportTab() {
  const f = skStockReportFilters;
  const filterHtml = `
    <div class="sk-card">
      <div class="sk-field"><label>Item Name*</label>
        <select onchange="skStockReportItemChanged(this.value)">
          <option value="">-Select item-</option>
          ${itemMaster.map(it => `<option value="${it.id}" ${it.id === skStockReportItemId ? 'selected' : ''}>${it.name}</option>`).join('')}
        </select>
      </div>
      <div class="sk-field"><label>Voucher Type</label>
        <select onchange="skStockReportFilterChanged('voucherType', this.value)">
          ${['All', 'Purchase Invoice', 'Stock Adjustment', 'Material Issue', 'Material Return'].map(v => `<option ${v === f.voucherType ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:6px;">
        <div class="sk-field" style="flex:1;"><label>From Date</label><input type="date" value="${f.from}" onchange="skStockReportFilterChanged('from', this.value)"></div>
        <div class="sk-field" style="flex:1;"><label>To Date</label><input type="date" value="${f.to}" onchange="skStockReportFilterChanged('to', this.value)"></div>
      </div>
    </div>`;

  if (!skStockReportItemId) return filterHtml + `<div class="sk-card"><p style="font-size:12.5px;color:#64748b;">Select an item to view its ledger.</p></div>`;

  const rows = getStockReport({ itemId: skStockReportItemId, voucherType: f.voucherType, from: f.from, to: f.to });
  const tableHtml = rows.length === 0
    ? `<div class="sk-card"><p style="font-size:12.5px;color:#64748b;">No transactions match these filters.</p></div>`
    : `<div class="sk-card" style="overflow-x:auto;"><table class="sk-table">
        <tr><th>Voucher Type</th><th>Voucher No</th><th>Date</th><th>Vendor</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Closing Stock</th></tr>
        ${rows.map(r => `<tr><td>${r.voucherType}</td><td>${r.voucherNo}</td><td>${r.date}</td><td>${r.vendor}</td><td>${r.qty}</td><td>${r.rate.toFixed(3)}</td><td>${r.amount.toFixed(3)}</td><td>${r.closingStock}</td></tr>`).join('')}
      </table></div>`;

  return filterHtml + tableHtml;
}
function skStockReportItemChanged(v) { skStockReportItemId = v; renderInventoryReports(); }
function skStockReportFilterChanged(key, v) { skStockReportFilters[key] = v; renderInventoryReports(); }

function renderItemSummaryTab() {
  const f = skSummaryFilters;
  const filterHtml = `
    <div class="sk-card">
      <div style="display:flex;gap:6px;">
        <select style="flex:1;" onchange="skSummaryFilterChanged('category', this.value)">
          <option value="">All Categories</option>
          ${stockCategories.map(c => `<option value="${c.name}" ${c.name === f.category ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
        <input style="flex:1;padding:8px;border:1px solid var(--biz-border);border-radius:8px;" type="text" placeholder="Item Name" value="${f.itemName}" oninput="skSummaryFilterChanged('itemName', this.value)">
      </div>
      <label style="font-size:11.5px;margin-top:8px;display:block;"><input type="checkbox" style="width:auto;display:inline;margin-right:6px;" ${f.includeZero ? 'checked' : ''} onchange="skSummaryFilterChanged('includeZero', this.checked)">Include Zero</label>
    </div>`;

  const rows = getItemSummaryReport(f);
  const tableHtml = rows.length === 0
    ? `<div class="sk-card"><p style="font-size:12.5px;color:#64748b;">No items match these filters.</p></div>`
    : `<div class="sk-card" style="overflow-x:auto;"><table class="sk-table">
        <tr><th>Item Name</th><th>Closing Stock</th><th>Purchase Rate</th></tr>
        ${rows.map(r => `<tr><td>${r.itemName}</td><td>${r.closingStock}</td><td>${r.purchaseRate.toFixed(3)}</td></tr>`).join('')}
      </table></div>`;

  return filterHtml + tableHtml;
}
function skSummaryFilterChanged(key, v) { skSummaryFilters[key] = v; renderInventoryReports(); }

function renderJobMaterialRequirementTab() {
  const rows = getJobMaterialRequirement().filter(r => r.orders > 0 || r.reqQty > 0);
  const note = `<p style="font-size:10.5px;color:#94a3b8;margin-bottom:8px;">Orders only shows demand for items picked from the Item Master in the Estimator's BOM (Materials tab) — free-text material names aren't linked to a real item, matching the real system's own distinction.</p>`;

  if (rows.length === 0) return note + `<div class="sk-card"><p style="font-size:12.5px;color:#64748b;">No open-order demand recorded against any Item Master item yet.</p></div>`;

  const tableHtml = `<div class="sk-card" style="overflow-x:auto;"><table class="sk-table">
      <tr><th></th><th>Item Name</th><th>Closing Stock</th><th>Orders</th><th>Mat Issued</th><th>PO</th><th>Req Qty</th></tr>
      ${rows.map(r => `
      <tr>
        <td>${r.reqQty > 0 ? `<input type="checkbox" ${skMrpChecked.has(r.itemId) ? 'checked' : ''} onchange="skMrpToggle('${r.itemId}', this.checked)">` : ''}</td>
        <td style="font-weight:600;">${r.itemName}</td><td>${r.closingStock}</td><td>${r.orders}</td><td>${r.matIssued}</td><td>${r.poQty}</td><td>${r.reqQty}</td>
      </tr>`).join('')}
    </table></div>
    <button class="primary" style="width:100%;" onclick="skCreatePRFromShortfall()">Create Purchase Request (${skMrpChecked.size} selected)</button>`;

  return note + tableHtml;
}
function skMrpToggle(itemId, checked) {
  if (checked) skMrpChecked.add(itemId); else skMrpChecked.delete(itemId);
  renderInventoryReports();
}
function skCreatePRFromShortfall() {
  if (skMrpChecked.size === 0) { skAlert('Check at least one shortfall item.'); return; }
  const raisedBy = (window.prompt("Your name (raising this request):", "") || "").trim();
  if (!raisedBy) { skAlert('Raiser name is required.'); return; }
  const result = createPurchaseRequestFromShortfall([...skMrpChecked], raisedBy);
  if (result && result.error) { skAlert(result.error); return; }
  skAlert(`✓ ${result.id} raised for ${skMrpChecked.size} item(s)`);
  skMrpChecked.clear();
  renderInventoryReports();
}
