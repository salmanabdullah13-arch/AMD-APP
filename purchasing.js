// ══════════════════════════════════════════
// PURCHASER MODULE — Ops/Owner facing
// Reads/writes: purchaseRequests[], purchaseOrders[], purchaseInvoices[],
// stockEntries[], itemCards[] (all in data.js). Curtain's purchaseInquiries[]
// is a separate system, deliberately not shown here — Curtain views its own
// tracker inside the Curtain module.
// ══════════════════════════════════════════

const purchStyleTag = document.createElement('style');
purchStyleTag.textContent = `
/* Retoned 3 Aug 2026 (Chunk 2) — migrated off its own hardcoded lavender
   scheme (was #6B3F7A/#9B5FB0) onto the shared --biz-* tokens, same wine
   accent as every other module. Status pill colors (pending/approved/
   rejected/issued/invoiced) are true semantics, left as their own literal
   hex on purpose. */
#purch-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#purch-module-wrap .ops-header{background:var(--biz-primary);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#purch-module-wrap .nav{background:var(--biz-card-bg);border-bottom:1px solid var(--biz-border);overflow-x:auto;display:flex;padding:0 16px;flex:none;}
#purch-module-wrap .ntab{background:none;border:0;border-bottom:2.5px solid transparent;color:var(--biz-text-muted);padding:10px 11px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;white-space:nowrap;position:relative;}
#purch-module-wrap .ntab.active{color:var(--biz-primary);border-bottom-color:var(--biz-primary2);font-weight:700;}
#purch-module-wrap .scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:80px;}
#purch-module-wrap .page{display:none;padding:16px 18px;max-width:980px;margin:0 auto;}
#purch-module-wrap .page.active{display:block;}
#purch-module-wrap button.primary{background:var(--biz-primary);color:#fff;border:0;border-radius:var(--biz-r-sm);padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
#purch-module-wrap .p-card {
  background:var(--biz-card-bg); border:1px solid var(--biz-border); border-radius:var(--biz-r);
  padding:14px; margin-bottom:12px; box-shadow:var(--biz-shadow);
}
#purch-module-wrap .p-kpi-grid {
  display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:16px;
}
#purch-module-wrap .p-kpi-tile {
  background:var(--biz-card-bg); border:1px solid var(--biz-border); border-radius:var(--biz-r);
  padding:12px; text-align:center; box-shadow:var(--biz-shadow);
}
#purch-module-wrap .p-kpi-tile .num { font-size:22px; font-weight:800; color:var(--biz-primary); }
#purch-module-wrap .p-kpi-tile .lbl { font-size:11px; color:var(--biz-text-muted); margin-top:2px; }
#purch-module-wrap .p-pill {
  display:inline-block; font-size:10.5px; font-weight:600; padding:3px 9px;
  border-radius:20px; background:var(--biz-border-light); color:var(--biz-text-muted);
}
#purch-module-wrap .p-pill.pending { background:#fef3c7; color:#92400e; }
#purch-module-wrap .p-pill.approved { background:#dcfce7; color:#166534; }
#purch-module-wrap .p-pill.rejected { background:#fee2e2; color:#991b1b; }
#purch-module-wrap .p-pill.issued { background:#dbeafe; color:#1e40af; }
#purch-module-wrap .p-pill.invoiced { background:#e0e7ff; color:#3730a3; }
#purch-module-wrap .p-pill.unpaid { background:var(--bad-bg,#fdeceb); color:var(--bad,#d9342b); }
#purch-module-wrap .p-pill.partial { background:var(--warn-bg,#fff6e3); color:var(--warn,#c47d00); }
#purch-module-wrap .p-pill.full { background:var(--ok-bg,#eafaf1); color:var(--ok,#0f9d58); }
#purch-module-wrap .p-pill.advance { background:#e0ecfb; color:var(--info,#2563eb); }
#purch-module-wrap .p-pill.cancelled { background:#eef0f3; color:#64748b; }
#purch-module-wrap .p-dept-filter {
  display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;
}
#purch-module-wrap .p-dept-filter button {
  font-size:11px; padding:5px 10px; border-radius:16px; border:1px solid var(--biz-border);
  background:var(--biz-card-bg); color:var(--biz-text-muted); cursor:pointer;
}
#purch-module-wrap .p-dept-filter button.active {
  background:var(--biz-primary); border-color:var(--biz-primary); color:#fff;
}
#purch-module-wrap .p-panel {
  display:none; position:fixed; top:0; left:0; right:0; bottom:0; z-index:200;
  background:rgba(16,24,40,.4); flex-direction:column; align-items:center;
  justify-content:flex-start; overflow-y:auto; padding:20px 12px;
}
#purch-module-wrap .p-panel-inner {
  background:var(--biz-card-bg); border-radius:var(--biz-r-lg); padding:18px; width:100%; max-width:480px;
  margin-top:20px;
}
#purch-module-wrap .p-field { margin-bottom:10px; }
#purch-module-wrap .p-field label { font-size:11px; color:var(--biz-text-muted); display:block; margin-bottom:3px; }
#purch-module-wrap .p-field input, #purch-module-wrap .p-field select, #purch-module-wrap .p-field textarea {
  width:100%; padding:8px 10px; border:1px solid var(--biz-border); border-radius:var(--biz-r-sm); font-size:13px;
}
`;
document.head.appendChild(purchStyleTag);

let purchCurrentPage   = 'purch-dashboard';
let purchPRDeptFilter  = 'all';           // 'all' | 'carp' | 'paint' | 'uph' | 'metal'
let poFormDraft        = null;            // { prId, items:[...], paymentMode, supplierNameTel, supplierRef, deliveryTerms, supplyAddress, exRate }
let invoiceFormDraft   = null;            // { poId, items:[...], supplierRef, totals }
let prFormDraft        = null;            // { department, linkedJobId, destinationType, items:[{name,qty,unit,itemRef}] }
let poDirectFormDraft  = null;            // same shape as prFormDraft + supplier fields, no prId
let invDirectFormDraft = null;            // same shape + rateBD/discBD/vatPercent per item, no poId
let poRegisterFilters  = { client: '', supplier: '', item: '', jobNo: '', from: '', to: '' };
let invoiceDraftActiveId = null;          // invoice id currently shown in the Submit→draft→Confirm panel
let supplierFormReturnSelectId = null;    // select element id to refresh after "+ New Supplier…"
let paymentFormDraft = null;              // { supplierId, division, methods, allocations, ledgerSplits }
let debitNoteFormDraft = null;            // { supplierId, division }
let purchBillOSFilters = { view: 'byparty', ageWise: false, ageBasis: 'bill', supplier: '' }; // Batch 6 — Purchase Bill Outstanding

// ── Job / item picker helpers (shared by PR, direct-PO, direct-Invoice forms) ──
// Combines projects[] (Carpentry/Painting/Upholstery/Metal Works — dept-% only,
// no item-level breakdown yet) and curtainJobs[] (has real window/opening data).
// Dedupes by id since a mixed-division job (e.g. AMD-15002) appears in both.
function purchGetAllJobs() {
  const map = new Map();
  if (typeof projects !== 'undefined') {
    projects.forEach(p => map.set(p.id, { id: p.id, name: p.name, client: p.client, windowGroups: null }));
  }
  if (typeof curtainJobs !== 'undefined') {
    curtainJobs.forEach(j => map.set(j.id, { id: j.id, name: j.name, client: j.client, windowGroups: j.windowGroups || null }));
  }
  return Array.from(map.values());
}

// Returns [{id,label}] window/opening options for a Curtain job, or null if
// the job has no structured item list yet (Carpentry/Painting/Upholstery/
// Metal Works) — caller falls back to a free-text field in that case.
function purchGetJobItemOptions(jobId) {
  const job = purchGetAllJobs().find(j => j.id === jobId);
  if (!job || !job.windowGroups) return null;
  const opts = [];
  job.windowGroups.forEach(wg => {
    (wg.layers || []).forEach(layer => {
      opts.push({ id: layer.id, label: `${wg.room} — ${layer.label}` });
    });
  });
  return opts;
}

// Formats an itemRef for inline display on cards: { id, label } window refs
// show their label; free-text refs show as-is; empty/null shows nothing.
function purchRefLabel(ref) {
  if (!ref) return '';
  if (typeof ref === 'string') return ref.trim() ? ` — ${ref}` : '';
  if (ref.label) return ` — ${ref.label}`;
  return '';
}

function purchDeptOptionsHtml(selected) {
  return DEPTS.map(d => `<option value="${d.k}" ${d.k === selected ? 'selected' : ''}>${d.n}</option>`).join('');
}

// ── Supplier Master picker (shared by PO/Invoice/Payment/Debit Note forms) ──
// One canonical supplier list (Masters → Accounts → Vendor) — no duplicate
// "Inventory → Vendor" list built, per the Batch 1: Purchases spec.
function purchSupplierOptionsHtml(selectedId) {
  return `<option value="" ${!selectedId ? 'selected' : ''}>-Select-</option>` +
    suppliers.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.name} — ${s.telephone}</option>`).join('') +
    `<option value="__new__">+ New Supplier…</option>`;
}
function purchCashLedgerOptionsHtml(selected) {
  return `<option value="" ${!selected ? 'selected' : ''}>-Select-</option>` +
    CASH_LEDGERS.map(l => `<option value="${l}" ${l === selected ? 'selected' : ''}>${l}</option>`).join('');
}

// ── Item Master picker for line items (only Inventory-type transactions
// reference a real item — Job/Others stay free text, matching the exact
// distinction the Batch 2 spec calls out for the Stock Report). ──
function purchItemFieldControl(destinationType, currentItemId, currentName, onSelectExpr, onTextExpr) {
  if (destinationType !== 'inventory') {
    return `<input type="text" value="${currentName}" onchange="${onTextExpr}">`;
  }
  return `<select onchange="${onSelectExpr}">
    <option value="">-Select item / new-</option>
    ${itemMaster.map(it => `<option value="${it.id}" ${it.id === currentItemId ? 'selected' : ''}>${it.name} (${it.id})</option>`).join('')}
  </select>
  <p style="font-size:10px;color:#94a3b8;margin-top:3px;">Not listed? Add it in Storekeeper → Item Master first.</p>`;
}

function purchJobOptionsHtml(selected) {
  const jobs = purchGetAllJobs();
  return `<option value="" ${!selected ? 'selected' : ''}>No specific job / stock</option>` +
    jobs.map(j => `<option value="${j.id}" ${j.id === selected ? 'selected' : ''}>${j.id} — ${j.name}</option>`).join('');
}

// Renders the item/ref control for one row: a dropdown of the job's windows
// if it has structured item data, otherwise a free-text input. Used by all
// three "create" forms below.
// onChangeExpr is a complete JS expression to run onchange, e.g.
// "prFormUpdateItemRef(0, this.value)" — built by the caller so it can
// target the right form's update function with the right row index.
function purchItemRefControl(jobId, currentRef, onChangeExpr) {
  const opts = jobId ? purchGetJobItemOptions(jobId) : null;
  if (opts) {
    const selId = currentRef && currentRef.id ? currentRef.id : '';
    return `<select onchange="${onChangeExpr}">
      <option value="">General / no specific item</option>
      ${opts.map(o => `<option value="${o.id}" ${o.id === selId ? 'selected' : ''}>${o.label}</option>`).join('')}
    </select>`;
  }
  const textVal = typeof currentRef === 'string' ? currentRef : '';
  return `<input type="text" placeholder="Item / allocation (optional)" value="${textVal}" onchange="${onChangeExpr}">`;
}

// ── Module open / nav ─────────────────────
function openPurchasingModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['ops-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap', 'fleet-module-wrap', 'delivery-sched-module-wrap', 'admin-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const mod = document.getElementById('purch-module-wrap');
  mod.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
  execEnsureShell(mod, { key: 'purchasing', title: 'Purchaser', role: 'Purchasing', navGroupsFn: EXEC_NAV_CONFIGS.purchasing, closeFn: 'closePurchasingModule' });

  purchGoTo('purch-dashboard');
}

function purchGoTo(pageId) {
  document.querySelectorAll('#purch-nav .ntab').forEach(t => {
    t.classList.toggle('active', t.dataset.p === pageId);
  });
  document.querySelectorAll('#purch-module-wrap .page').forEach(p => {
    p.classList.toggle('active', p.id === 'p-' + pageId);
  });
  purchCurrentPage = pageId;

  if (pageId === 'purch-dashboard') renderPurchDashboard();
  if (pageId === 'purch-requests')  renderPurchRequests();
  if (pageId === 'purch-approvals') renderPurchApprovals();
  if (pageId === 'purch-orders')    renderPurchOrders();
  if (pageId === 'purch-register')  renderPORegister();
  if (pageId === 'purch-suppliers') renderSuppliers();
  if (pageId === 'purch-payments')  renderSupplierPayments();
  if (pageId === 'purch-debitnotes') renderDebitNotes();
  if (pageId === 'purch-billos') renderPurchaseBillOutstanding();
}

// ── Alert toast (mirrors curtAlert's fallback pattern) ──
function purchAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('purch-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'purch-toast';
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

// ── Dashboard (KPIs) ───────────────────────
function renderPurchDashboard() {
  const kpi = getPurchasingKPIs();

  const html = `
    <div class="p-kpi-grid">
      <div class="p-kpi-tile"><div class="num">${kpi.totals.openRequests}</div><div class="lbl">Open Requests</div></div>
      <div class="p-kpi-tile"><div class="num">${kpi.totals.pendingPOApprovals}</div><div class="lbl">Pending PO Approvals</div></div>
      <div class="p-kpi-tile"><div class="num">${kpi.totals.awaitingDelivery}</div><div class="lbl">Awaiting Delivery</div></div>
      <div class="p-kpi-tile"><div class="num">${kpi.totals.curtainOpenInquiries}</div><div class="lbl">Curtain Open Inquiries</div></div>
    </div>

    <div class="p-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Open Requests by Division</p>
      ${cwMiniBars([
        { label: 'Curtain', value: kpi.byDivision.curtain.openInquiries, color: cwOrdinalColor(0) },
        { label: 'Upholstery', value: kpi.byDivision.upholstery.openRequests, color: cwOrdinalColor(1) },
        { label: 'Joinery', value: kpi.byDivision.joinery.openRequests, color: cwOrdinalColor(2) },
        { label: 'Metal Works', value: kpi.byDivision.metal.openRequests, color: cwOrdinalColor(3) }
      ])}
    </div>

    <div class="p-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:10px;">By Division</p>
      ${renderDivRow('Curtain (own tracker)', `${kpi.byDivision.curtain.openInquiries} open · ${kpi.byDivision.curtain.awaitingVendor} awaiting vendor`)}
      ${renderDivRow('Upholstery', `${kpi.byDivision.upholstery.openRequests} open · ${kpi.byDivision.upholstery.pendingApprovals} pending approval · ${kpi.byDivision.upholstery.awaitingDelivery} awaiting delivery`)}
      ${renderDivRow('Joinery (incl. Painting)', `${kpi.byDivision.joinery.openRequests} open · ${kpi.byDivision.joinery.pendingApprovals} pending approval · ${kpi.byDivision.joinery.awaitingDelivery} awaiting delivery`)}
      ${renderDivRow('Metal Works', `${kpi.byDivision.metal.openRequests} open · ${kpi.byDivision.metal.pendingApprovals} pending approval · ${kpi.byDivision.metal.awaitingDelivery} awaiting delivery`)}
      <p style="font-size:10.5px;color:#94a3b8;margin-top:8px;">Curtain's fabric/rail requests are tracked in its own module — shown here read-only for context.</p>
    </div>`;

  document.getElementById('purch-dashboard-body').innerHTML = html;
}

function renderDivRow(label, sub) {
  return `
    <div style="border-top:1px solid #f1f5f9;padding:8px 0;">
      <p style="font-size:12.5px;font-weight:600;">${label}</p>
      <p style="font-size:11px;color:#64748b;">${sub}</p>
    </div>`;
}

// ── PR Queue ───────────────────────────────
function purchSetPRFilter(dept) {
  purchPRDeptFilter = dept;
  renderPurchRequests();
}

function renderPurchRequests() {
  const depts = [
    { k: 'all',   n: 'All' },
    { k: 'carp',  n: 'Carpentry' },
    { k: 'paint', n: 'Painting' },
    { k: 'uph',   n: 'Upholstery' },
    { k: 'metal', n: 'Metal Works' }
  ];

  const newBtnHtml = `
    <button class="primary" style="width:100%;margin-bottom:12px;" onclick="openPRForm()">+ New Purchase Request</button>`;

  const filterHtml = `
    <div class="p-dept-filter">
      ${depts.map(d => `<button class="${purchPRDeptFilter === d.k ? 'active' : ''}" onclick="purchSetPRFilter('${d.k}')">${d.n}</button>`).join('')}
    </div>`;

  const open = purchaseRequests.filter(pr =>
    pr.status === 'open' && (purchPRDeptFilter === 'all' || pr.department === purchPRDeptFilter)
  );

  let html = newBtnHtml + filterHtml;

  if (open.length === 0) {
    html += `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">No open purchase requests${purchPRDeptFilter === 'all' ? '' : ' for this department'}.</p></div>`;
  } else {
    open.forEach(pr => {
      html += `
        <div class="p-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <p style="font-weight:700;font-size:13px;">${pr.id} · ${dc(pr.department).n}</p>
              <p style="font-size:11px;color:#64748b;">Raised by ${pr.raisedBy || '—'} · ${pr.dateRaised}${pr.linkedJobId ? ' · ' + pr.linkedJobId : ''}</p>
            </div>
            <span class="p-pill">${pr.destinationType === 'job-direct' ? 'Job-direct' : pr.destinationType === 'others' ? 'Others' : 'Stock'}</span>
          </div>
          <p style="font-size:11.5px;color:#334155;margin:8px 0;">
            ${pr.items.map(it => `${it.name} (${it.qty} ${it.unit})${purchRefLabel(it.itemRef)}`).join(', ')}
          </p>
          <button class="primary" style="font-size:12px;background:var(--biz-primary);border-color:var(--biz-primary);" onclick="openPOForm('${pr.id}')">Convert to PO →</button>
        </div>`;
    });
  }

  document.getElementById('purch-requests-body').innerHTML = html;
}

// ── PR creation form (new, direct — no conversion involved) ───────
function openPRForm() {
  prFormDraft = {
    division: SALES_DIVISIONS[0],
    department: 'carp',
    linkedJobId: '',
    destinationType: 'inventory',
    items: [{ name: '', qty: 1, unit: '', itemRef: null }]
  };

  document.getElementById('pr-form-division').innerHTML = SALES_DIVISIONS.map(d => `<option ${d === prFormDraft.division ? 'selected' : ''}>${d}</option>`).join('');
  document.getElementById('pr-form-dept').innerHTML = purchDeptOptionsHtml(prFormDraft.department);
  document.getElementById('pr-form-job').innerHTML = purchJobOptionsHtml(prFormDraft.linkedJobId);
  document.getElementById('pr-form-dest').value = prFormDraft.destinationType;
  renderPRFormProjectDetails();
  renderPRFormItems();

  const panel = document.getElementById('purch-pr-form');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

// "Project Details" panel — read-only, only populated once a Job No is
// attached (matches the real PR (Others) form exactly).
function renderPRFormProjectDetails() {
  const wrap = document.getElementById('pr-form-project-details');
  if (!wrap || !prFormDraft) return;
  const job = prFormDraft.linkedJobId ? purchGetAllJobs().find(j => j.id === prFormDraft.linkedJobId) : null;
  wrap.innerHTML = job
    ? `<p style="font-size:11.5px;color:#334155;">Client: <b>${job.client || '—'}</b> · Project: <b>${job.name || '—'}</b></p>`
    : `<p style="font-size:11px;color:#94a3b8;">Attach a Job No to see Client/Project details.</p>`;
}
function prFormDivisionChanged(value) {
  if (!prFormDraft) return;
  prFormDraft.division = value;
}

function renderPRFormItems() {
  const wrap = document.getElementById('pr-form-items');
  if (!wrap || !prFormDraft) return;
  wrap.innerHTML = prFormDraft.items.map((it, i) => `
    <div class="p-card" style="margin-bottom:8px;">
      <div style="display:flex;gap:6px;">
        <div class="p-field" style="flex:2;margin-bottom:6px;">
          <label>Item / material</label>
          <input type="text" placeholder="e.g. MDF sheet 18mm" value="${it.name}" onchange="prFormUpdateItem(${i}, 'name', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:6px;">
          <label>Qty</label>
          <input type="number" step="0.01" value="${it.qty}" onchange="prFormUpdateItem(${i}, 'qty', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:6px;">
          <label>Unit</label>
          <input type="text" placeholder="pcs" value="${it.unit}" onchange="prFormUpdateItem(${i}, 'unit', this.value)">
        </div>
      </div>
      <div class="p-field" style="margin-bottom:0;">
        <label>Allocation (job item, optional)</label>
        ${purchItemRefControl(prFormDraft.linkedJobId, it.itemRef, `prFormUpdateItemRef(${i}, this.value)`)}
      </div>
      ${prFormDraft.items.length > 1 ? `<button style="margin-top:8px;background:none;border:0;color:#dc2626;font-size:11.5px;cursor:pointer;padding:0;" onclick="prFormRemoveItem(${i})">Remove item</button>` : ''}
    </div>`).join('') +
    `<button style="background:none;border:1px dashed var(--biz-primary);color:var(--biz-primary);border-radius:8px;padding:8px;width:100%;font-size:12.5px;cursor:pointer;" onclick="prFormAddItem()">+ Add item</button>`;
}

function prFormUpdateItem(idx, field, value) {
  if (!prFormDraft) return;
  prFormDraft.items[idx][field] = (field === 'qty') ? Number(value) : value;
}
function prFormUpdateItemRef(idx, value) {
  if (!prFormDraft) return;
  const opts = prFormDraft.linkedJobId ? purchGetJobItemOptions(prFormDraft.linkedJobId) : null;
  if (opts) {
    const match = opts.find(o => o.id === value);
    prFormDraft.items[idx].itemRef = match ? { id: match.id, label: match.label } : null;
  } else {
    prFormDraft.items[idx].itemRef = value || null;
  }
}
function prFormAddItem() {
  if (!prFormDraft) return;
  prFormDraft.items.push({ name: '', qty: 1, unit: '', itemRef: null });
  renderPRFormItems();
}
function prFormRemoveItem(idx) {
  if (!prFormDraft || prFormDraft.items.length <= 1) return;
  prFormDraft.items.splice(idx, 1);
  renderPRFormItems();
}
function prFormDeptChanged(value) {
  if (!prFormDraft) return;
  prFormDraft.department = value;
}
function prFormJobChanged(value) {
  if (!prFormDraft) return;
  prFormDraft.linkedJobId = value || null;
  prFormDraft.items.forEach(it => it.itemRef = null); // job changed — old refs no longer valid
  renderPRFormProjectDetails();
  renderPRFormItems();
}
function prFormDestChanged(value) {
  if (!prFormDraft) return;
  prFormDraft.destinationType = value;
}

function savePRForm() {
  if (!prFormDraft) return;
  const items = prFormDraft.items.filter(it => it.name.trim() && it.qty > 0);
  if (items.length === 0) { purchAlert('Add at least one item with a name and quantity.'); return; }

  const raisedBy = (window.prompt("Your name (raising this request):", "") || "").trim();
  if (!raisedBy) { purchAlert('Raiser name is required.'); return; }

  const pr = raisePurchaseRequest({
    department: prFormDraft.department,
    raisedBy,
    linkedJobId: prFormDraft.linkedJobId || null,
    destinationType: prFormDraft.destinationType,
    items,
    division: prFormDraft.division
  });

  purchAlert(`✓ ${pr.id} raised`);
  closePRForm();
  renderPurchRequests();
}

function closePRForm() {
  prFormDraft = null;
  const panel = document.getElementById('purch-pr-form');
  if (panel) panel.style.display = 'none';
}

// ── PO creation form ───────────────────────
function openPOForm(prId) {
  const pr = purchaseRequests.find(p => p.id === prId);
  if (!pr) return;

  poFormDraft = {
    prId: pr.id,
    paymentMode: 'Cash',
    supplierId: null,
    supplierNameTel: '',
    supplierRef: '',
    cashLedger: '',
    deliveryTerms: '',
    supplyAddress: '',
    exRate: 1,
    items: pr.items.map(it => ({ productService: it.name, qty: it.qty, unit: it.unit, fxRateBD: 0, discountBD: 0, vatPercent: 10 }))
  };

  document.getElementById('po-form-pr-id').textContent = pr.id;
  document.getElementById('po-form-dept').textContent = dc(pr.department).n;
  document.getElementById('po-payment-mode').value = 'Cash';
  document.getElementById('po-supplier-select').innerHTML = purchSupplierOptionsHtml(null);
  document.getElementById('po-cash-ledger').innerHTML = purchCashLedgerOptionsHtml('');
  document.getElementById('po-supplier-ref').value = '';
  document.getElementById('po-delivery-terms').value = '';
  document.getElementById('po-supply-address').value = '';
  document.getElementById('po-ex-rate').value = 1;
  renderPOFormItems();

  const panel = document.getElementById('purch-po-form');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function renderPOFormItems() {
  const wrap = document.getElementById('po-form-items');
  if (!wrap || !poFormDraft) return;
  wrap.innerHTML = poFormDraft.items.map((it, i) => `
    <div class="p-card" style="margin-bottom:8px;">
      <p style="font-size:12.5px;font-weight:600;">${it.productService} — ${it.qty} ${it.unit}</p>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>Rate (BD)</label>
          <input type="number" step="0.001" value="${it.fxRateBD}" onchange="poFormUpdateItem(${i}, 'fxRateBD', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>Discount (BD)</label>
          <input type="number" step="0.001" value="${it.discountBD}" onchange="poFormUpdateItem(${i}, 'discountBD', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>VAT %</label>
          <input type="number" step="1" value="${it.vatPercent}" onchange="poFormUpdateItem(${i}, 'vatPercent', this.value)">
        </div>
      </div>
    </div>`).join('');
}

function poFormUpdateItem(idx, field, value) {
  if (!poFormDraft) return;
  poFormDraft.items[idx][field] = Number(value);
}

function savePOForm() {
  if (!poFormDraft) return;

  const pr = purchaseRequests.find(p => p.id === poFormDraft.prId);

  poFormDraft.paymentMode     = document.getElementById('po-payment-mode').value;
  poFormDraft.supplierId      = document.getElementById('po-supplier-select').value || null;
  poFormDraft.cashLedger      = document.getElementById('po-cash-ledger').value;
  poFormDraft.supplierRef     = document.getElementById('po-supplier-ref').value.trim();
  poFormDraft.deliveryTerms   = document.getElementById('po-delivery-terms').value.trim();
  poFormDraft.supplyAddress   = document.getElementById('po-supply-address').value.trim();
  poFormDraft.exRate          = Number(document.getElementById('po-ex-rate').value) || 1;

  if (!poFormDraft.supplierId) { purchAlert('Select a vendor.'); return; }
  if (!poFormDraft.cashLedger) { purchAlert('Please select a Cash ledger'); return; }
  if (pr && pr.destinationType === 'job-direct' && !pr.linkedJobId) { purchAlert('Job No is required'); return; }

  const supplier = suppliers.find(s => s.id === poFormDraft.supplierId);
  poFormDraft.supplierNameTel = supplier ? `${supplier.name} — ${supplier.telephone}` : '';

  const preparedBy = (window.prompt("Your name (prepared by):", "") || "").trim();
  if (!preparedBy) { purchAlert('Preparer name is required.'); return; }

  const po = convertPRtoPO(poFormDraft.prId, {
    paymentMode:     poFormDraft.paymentMode,
    supplierId:      poFormDraft.supplierId,
    supplierNameTel: poFormDraft.supplierNameTel,
    supplierRef:     poFormDraft.supplierRef,
    cashLedger:      poFormDraft.cashLedger,
    preparedBy
  });

  // Carry forward the per-item pricing entered above (convertPRtoPO seeds
  // zeros — the Purchaser fills real figures on this form).
  if (po) {
    po.deliveryTerms = poFormDraft.deliveryTerms;
    po.supplyAddress = poFormDraft.supplyAddress;
    po.exRate = poFormDraft.exRate;
    po.items.forEach((it, i) => {
      const draftIt = poFormDraft.items[i];
      if (!draftIt) return;
      it.fxRateBD = draftIt.fxRateBD;
      it.discountBD = draftIt.discountBD;
      it.vatPercent = draftIt.vatPercent;
      it.amountBD = draftIt.fxRateBD * it.qty;
      it.vatBD = it.amountBD * (draftIt.vatPercent / 100);
      it.netAmountBD = it.amountBD - it.discountBD + it.vatBD;
    });
  }

  purchAlert(`✓ ${po.id} created — awaiting approval`);
  closePOForm();
  renderPurchRequests();
}

function closePOForm() {
  poFormDraft = null;
  const panel = document.getElementById('purch-po-form');
  if (panel) panel.style.display = 'none';
}

// ── PO creation form (direct — no PR behind it) ────
function openPODirectForm() {
  poDirectFormDraft = {
    department: 'carp',
    linkedJobId: '',
    destinationType: 'inventory',
    paymentMode: 'Cash',
    supplierId: null,
    supplierNameTel: '',
    supplierRef: '',
    cashLedger: '',
    deliveryTerms: '',
    supplyAddress: '',
    exRate: 1,
    items: [{ name: '', qty: 1, unit: '', itemRef: null, itemId: null, fxRateBD: 0, discountBD: 0, vatPercent: 10 }]
  };

  document.getElementById('pod-form-dept').innerHTML = purchDeptOptionsHtml(poDirectFormDraft.department);
  document.getElementById('pod-form-job').innerHTML = purchJobOptionsHtml(poDirectFormDraft.linkedJobId);
  document.getElementById('pod-supplier-select').innerHTML = purchSupplierOptionsHtml(null);
  document.getElementById('pod-cash-ledger').innerHTML = purchCashLedgerOptionsHtml('');
  document.getElementById('pod-form-dest').value = poDirectFormDraft.destinationType;
  document.getElementById('pod-payment-mode').value = 'Cash';
  document.getElementById('pod-supplier-ref').value = '';
  document.getElementById('pod-delivery-terms').value = '';
  document.getElementById('pod-supply-address').value = '';
  document.getElementById('pod-ex-rate').value = 1;
  renderPODirectFormItems();

  const panel = document.getElementById('purch-po-form-direct');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function renderPODirectFormItems() {
  const wrap = document.getElementById('pod-form-items');
  if (!wrap || !poDirectFormDraft) return;
  wrap.innerHTML = poDirectFormDraft.items.map((it, i) => `
    <div class="p-card" style="margin-bottom:8px;">
      <div style="display:flex;gap:6px;">
        <div class="p-field" style="flex:2;margin-bottom:6px;">
          <label>Item / material</label>
          ${purchItemFieldControl(poDirectFormDraft.destinationType, it.itemId, it.name, `poDirectFormUpdateItemMaster(${i}, this.value)`, `poDirectFormUpdateItem(${i}, 'name', this.value)`)}
        </div>
        <div class="p-field" style="flex:1;margin-bottom:6px;">
          <label>Qty</label>
          <input type="number" step="0.01" value="${it.qty}" onchange="poDirectFormUpdateItem(${i}, 'qty', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:6px;">
          <label>Unit</label>
          <input type="text" value="${it.unit}" onchange="poDirectFormUpdateItem(${i}, 'unit', this.value)">
        </div>
      </div>
      <div class="p-field" style="margin-bottom:6px;">
        <label>Allocation (job item, optional)</label>
        ${purchItemRefControl(poDirectFormDraft.linkedJobId, it.itemRef, `poDirectFormUpdateItemRef(${i}, this.value)`)}
      </div>
      <div style="display:flex;gap:6px;">
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>Rate (BD)</label>
          <input type="number" step="0.001" value="${it.fxRateBD}" onchange="poDirectFormUpdateItem(${i}, 'fxRateBD', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>Discount (BD)</label>
          <input type="number" step="0.001" value="${it.discountBD}" onchange="poDirectFormUpdateItem(${i}, 'discountBD', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>VAT %</label>
          <input type="number" step="1" value="${it.vatPercent}" onchange="poDirectFormUpdateItem(${i}, 'vatPercent', this.value)">
        </div>
      </div>
      ${poDirectFormDraft.items.length > 1 ? `<button style="margin-top:8px;background:none;border:0;color:#dc2626;font-size:11.5px;cursor:pointer;padding:0;" onclick="poDirectFormRemoveItem(${i})">Remove item</button>` : ''}
    </div>`).join('') +
    `<button style="background:none;border:1px dashed var(--biz-primary);color:var(--biz-primary);border-radius:8px;padding:8px;width:100%;font-size:12.5px;cursor:pointer;" onclick="poDirectFormAddItem()">+ Add item</button>`;
}

function poDirectFormUpdateItem(idx, field, value) {
  if (!poDirectFormDraft) return;
  poDirectFormDraft.items[idx][field] = (field === 'name' || field === 'unit') ? value : Number(value);
}
function poDirectFormUpdateItemMaster(idx, itemId) {
  if (!poDirectFormDraft) return;
  const it = poDirectFormDraft.items[idx];
  const master = itemMaster.find(m => m.id === itemId);
  it.itemId = master ? master.id : null;
  it.name = master ? master.name : '';
  it.unit = master ? master.unit : it.unit;
}
function poDirectFormUpdateItemRef(idx, value) {
  if (!poDirectFormDraft) return;
  const opts = poDirectFormDraft.linkedJobId ? purchGetJobItemOptions(poDirectFormDraft.linkedJobId) : null;
  if (opts) {
    const match = opts.find(o => o.id === value);
    poDirectFormDraft.items[idx].itemRef = match ? { id: match.id, label: match.label } : null;
  } else {
    poDirectFormDraft.items[idx].itemRef = value || null;
  }
}
function poDirectFormAddItem() {
  if (!poDirectFormDraft) return;
  poDirectFormDraft.items.push({ name: '', qty: 1, unit: '', itemRef: null, itemId: null, fxRateBD: 0, discountBD: 0, vatPercent: 10 });
  renderPODirectFormItems();
}
function poDirectFormRemoveItem(idx) {
  if (!poDirectFormDraft || poDirectFormDraft.items.length <= 1) return;
  poDirectFormDraft.items.splice(idx, 1);
  renderPODirectFormItems();
}
function poDirectFormDeptChanged(value) {
  if (!poDirectFormDraft) return;
  poDirectFormDraft.department = value;
}
function poDirectFormJobChanged(value) {
  if (!poDirectFormDraft) return;
  poDirectFormDraft.linkedJobId = value || null;
  poDirectFormDraft.items.forEach(it => it.itemRef = null);
  renderPODirectFormItems();
}
function poDirectFormDestChanged(value) {
  if (!poDirectFormDraft) return;
  poDirectFormDraft.destinationType = value;
  poDirectFormDraft.items.forEach(it => it.itemId = null);
  renderPODirectFormItems();
}

function savePODirectForm() {
  if (!poDirectFormDraft) return;

  poDirectFormDraft.paymentMode     = document.getElementById('pod-payment-mode').value;
  poDirectFormDraft.supplierId      = document.getElementById('pod-supplier-select').value || null;
  poDirectFormDraft.cashLedger      = document.getElementById('pod-cash-ledger').value;
  poDirectFormDraft.supplierRef     = document.getElementById('pod-supplier-ref').value.trim();
  poDirectFormDraft.deliveryTerms   = document.getElementById('pod-delivery-terms').value.trim();
  poDirectFormDraft.supplyAddress   = document.getElementById('pod-supply-address').value.trim();
  poDirectFormDraft.exRate          = Number(document.getElementById('pod-ex-rate').value) || 1;

  if (!poDirectFormDraft.supplierId) { purchAlert('Select a vendor.'); return; }
  if (!poDirectFormDraft.cashLedger) { purchAlert('Please select a Cash ledger'); return; }
  if (poDirectFormDraft.destinationType === 'job-direct' && !poDirectFormDraft.linkedJobId) { purchAlert('Job No is required'); return; }

  const podSupplier = suppliers.find(s => s.id === poDirectFormDraft.supplierId);
  poDirectFormDraft.supplierNameTel = podSupplier ? `${podSupplier.name} — ${podSupplier.telephone}` : '';

  const items = poDirectFormDraft.items.filter(it => it.name.trim() && it.qty > 0);
  if (items.length === 0) { purchAlert('Add at least one item with a name and quantity.'); return; }

  const preparedBy = (window.prompt("Your name (prepared by):", "") || "").trim();
  if (!preparedBy) { purchAlert('Preparer name is required.'); return; }

  const po = createPurchaseOrderDirect({
    department: poDirectFormDraft.department,
    linkedJobId: poDirectFormDraft.linkedJobId || null,
    destinationType: poDirectFormDraft.destinationType,
    supplierDetails: {
      paymentMode: poDirectFormDraft.paymentMode,
      supplierId: poDirectFormDraft.supplierId,
      supplierNameTel: poDirectFormDraft.supplierNameTel,
      supplierRef: poDirectFormDraft.supplierRef,
      cashLedger: poDirectFormDraft.cashLedger,
      deliveryTerms: poDirectFormDraft.deliveryTerms,
      supplyAddress: poDirectFormDraft.supplyAddress,
      exRate: poDirectFormDraft.exRate,
      preparedBy
    },
    items
  });

  po.items.forEach((it, i) => {
    const draftIt = items[i];
    if (!draftIt) return;
    it.amountBD = it.fxRateBD * it.qty;
    it.vatBD = it.amountBD * (it.vatPercent / 100);
    it.netAmountBD = it.amountBD - it.discountBD + it.vatBD;
  });

  purchAlert(`✓ ${po.id} created — awaiting approval`);
  closePODirectForm();
  renderPurchOrders();
}

function closePODirectForm() {
  poDirectFormDraft = null;
  const panel = document.getElementById('purch-po-form-direct');
  if (panel) panel.style.display = 'none';
}

// ── Approval queue ─────────────────────────
function renderPurchApprovals() {
  const pendingPOs = getPendingPOApprovals();
  const pendingInvoices = getPendingInvoiceApprovals();

  let html = `<p style="font-weight:700;font-size:13px;margin:4px 0 8px;">Purchase Orders (${pendingPOs.length})</p>`;

  if (pendingPOs.length === 0) {
    html += `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">No POs waiting on approval.</p></div>`;
  } else {
    pendingPOs.forEach(po => {
      const netTotal = po.items.reduce((s, it) => s + (it.netAmountBD || 0), 0);
      html += `
        <div class="p-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <p style="font-weight:700;font-size:13px;">${po.id} ${po.department ? '· ' + dc(po.department).n : ''} ${!po.sourcePR ? '<span class="p-pill" style="margin-left:4px;">Direct</span>' : ''}</p>
              <p style="font-size:11px;color:#64748b;">${po.supplierNameTel || '—'} · ${po.date}${po.linkedJobId ? ' · ' + po.linkedJobId : ''}</p>
            </div>
            <span class="p-pill pending">Pending</span>
          </div>
          <p style="font-size:11.5px;color:#334155;margin:8px 0;">
            ${po.items.map(it => `${it.productService} (${it.qty} ${it.unit})${purchRefLabel(it.itemRef)}`).join(', ')}
          </p>
          <p style="font-size:12px;font-weight:700;margin-bottom:8px;">Net total: BD ${netTotal.toFixed(3)}</p>
          <div style="display:flex;gap:8px;">
            <button class="primary" style="font-size:12px;background:#16a34a;border-color:#16a34a;flex:1;" onclick="approvePOAction('${po.id}')">Approve</button>
            <button class="primary" style="font-size:12px;background:#dc2626;border-color:#dc2626;flex:1;" onclick="rejectPOAction('${po.id}')">Reject</button>
          </div>
        </div>`;
    });
  }

  html += `<p style="font-weight:700;font-size:13px;margin:16px 0 8px;">Purchase Invoices (${pendingInvoices.length})</p>`;

  if (pendingInvoices.length === 0) {
    html += `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">No invoices waiting on approval.</p></div>`;
  } else {
    pendingInvoices.forEach(inv => {
      const total = inv.totals && inv.totals.netAmount ? inv.totals.netAmount :
        inv.items.reduce((s, it) => s + (it.amtBD || 0), 0);
      html += `
        <div class="p-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <p style="font-weight:700;font-size:13px;">${inv.id} ${inv.department ? '· ' + dc(inv.department).n : ''} <span class="p-pill" style="margin-left:4px;">Direct</span></p>
              <p style="font-size:11px;color:#64748b;">${inv.supplierNameTel || '—'} · ${inv.dateReceived}${inv.linkedJobId ? ' · ' + inv.linkedJobId : ''}</p>
            </div>
            <span class="p-pill pending">Pending</span>
          </div>
          <p style="font-size:11.5px;color:#334155;margin:8px 0;">
            ${inv.items.map(it => `${it.itemName} (${it.qty})${purchRefLabel(it.itemRef)}`).join(', ')}
          </p>
          <p style="font-size:12px;font-weight:700;margin-bottom:8px;">Total: BD ${Number(total).toFixed(3)}</p>
          <div style="display:flex;gap:8px;">
            <button class="primary" style="font-size:12px;background:#16a34a;border-color:#16a34a;flex:1;" onclick="approveInvoiceAction('${inv.id}')">Approve</button>
            <button class="primary" style="font-size:12px;background:#dc2626;border-color:#dc2626;flex:1;" onclick="rejectInvoiceAction('${inv.id}')">Reject</button>
          </div>
        </div>`;
    });
  }

  document.getElementById('purch-approvals-body').innerHTML = html;
}

function approveInvoiceAction(invId) {
  const approvedBy = (window.prompt("Your name (approving):", "") || "").trim();
  if (!approvedBy) { purchAlert('Approver name is required.'); return; }
  approveInvoice(invId, approvedBy);
  purchAlert(`✓ ${invId} approved`);
  renderPurchApprovals();
}
function rejectInvoiceAction(invId) {
  const rejectedBy = (window.prompt("Your name (rejecting):", "") || "").trim();
  if (!rejectedBy) { purchAlert('Rejector name is required.'); return; }
  const comment = (window.prompt("Rejection reason (required):", "") || "").trim();
  if (!comment) { purchAlert('A rejection comment is required.'); return; }
  rejectInvoice(invId, rejectedBy, comment);
  purchAlert(`Invoice ${invId} rejected`);
  renderPurchApprovals();
}

function approvePOAction(poId) {
  const approvedBy = (window.prompt("Your name (approving):", "") || "").trim();
  if (!approvedBy) { purchAlert('Approver name is required.'); return; }
  approvePO(poId, approvedBy);
  purchAlert(`✓ ${poId} approved`);
  renderPurchApprovals();
}

function rejectPOAction(poId) {
  const rejectedBy = (window.prompt("Your name (rejecting):", "") || "").trim();
  if (!rejectedBy) { purchAlert('Rejector name is required.'); return; }
  const comment = (window.prompt("Rejection reason (required):", "") || "").trim();
  if (!comment) { purchAlert('A rejection comment is required.'); return; }
  rejectPO(poId, rejectedBy, comment);
  purchAlert(`PO ${poId} rejected`);
  renderPurchApprovals();
}

// ── Orders (issued / invoiced) ─────────────
function renderPurchOrders() {
  const issued   = purchaseOrders.filter(po => po.status === 'issued');
  const invoiced = purchaseOrders.filter(po => po.status === 'invoiced');

  let html = `
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <button class="primary" style="flex:1;" onclick="openPODirectForm()">+ New PO</button>
      <button class="primary" style="flex:1;background:var(--biz-primary);border-color:var(--biz-primary);" onclick="openInvDirectForm()">+ New Invoice</button>
    </div>`;

  html += `<p style="font-weight:700;font-size:13px;margin:4px 0 8px;">Awaiting Delivery (${issued.length})</p>`;

  if (issued.length === 0) {
    html += `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">Nothing awaiting delivery.</p></div>`;
  } else {
    issued.forEach(po => {
      html += `
        <div class="p-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <p style="font-weight:700;font-size:13px;">${po.id}</p>
              <p style="font-size:11px;color:#64748b;">${po.supplierNameTel || '—'} · approved by ${po.approvedBy || '—'}</p>
            </div>
            <span class="p-pill issued">Issued</span>
          </div>
          <button class="primary" style="font-size:12px;background:var(--biz-primary);border-color:var(--biz-primary);margin-top:8px;" onclick="openInvoiceForm('${po.id}')">Receive & Convert to Invoice →</button>
        </div>`;
    });
  }

  html += `<p style="font-weight:700;font-size:13px;margin:16px 0 8px;">Invoiced from PO (${invoiced.length})</p>`;
  if (invoiced.length === 0) {
    html += `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">No invoices yet.</p></div>`;
  } else {
    invoiced.forEach(po => {
      const inv = purchaseInvoices.find(i => i.sourcePO === po.id);
      html += `
        <div class="p-card">
          <p style="font-weight:700;font-size:13px;">${po.id} → ${inv ? inv.id : '—'}</p>
          <p style="font-size:11px;color:#64748b;">${po.supplierNameTel || '—'} · received ${inv ? inv.dateReceived : '—'}</p>
          <span class="p-pill invoiced">Invoiced</span>
        </div>`;
    });
  }

  // Direct invoices (no PO/PR behind them) — shown separately since they
  // don't have a matching entry in purchaseOrders[] to key off.
  const directInvoices = purchaseInvoices.filter(inv => !inv.sourcePO);
  html += `<p style="font-weight:700;font-size:13px;margin:16px 0 8px;">Direct Invoices (${directInvoices.length})</p>`;
  if (directInvoices.length === 0) {
    html += `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">No direct invoices yet.</p></div>`;
  } else {
    directInvoices.forEach(inv => {
      let pillClass = 'pending', pillLabel = 'Pending approval';
      if (inv.status === 'draft') { pillClass = 'pending'; pillLabel = 'Draft'; }
      else if (inv.approvalStatus === 'approved') { pillClass = 'invoiced'; pillLabel = 'Received'; }
      else if (inv.approvalStatus === 'rejected') { pillClass = 'rejected'; pillLabel = 'Rejected'; }
      html += `
        <div class="p-card">
          <p style="font-weight:700;font-size:13px;">${inv.id} ${inv.department ? '· ' + dc(inv.department).n : ''}</p>
          <p style="font-size:11px;color:#64748b;">${inv.supplierNameTel || '—'} · ${inv.dateReceived}${inv.linkedJobId ? ' · ' + inv.linkedJobId : ''}</p>
          <span class="p-pill ${pillClass}">${pillLabel}</span>
          ${inv.status === 'draft' ? `<button class="primary" style="font-size:12px;background:var(--biz-primary);border-color:var(--biz-primary);margin-top:8px;" onclick="openInvoiceDraftPanel('${inv.id}')">Continue draft →</button>` : ''}
        </div>`;
    });
  }

  document.getElementById('purch-orders-body').innerHTML = html;
}

// ── PO REGISTER (report) ──────────────────
// Cross-links a PO back to the originating customer Job, same as Q-Pro's
// own Reports → PO Register. linkedJobId can point at either the old
// curtainJobs/projects id (has a `client` string directly) or a new
// jobCards[] Job Card id (has customerId -> customers[].name) — both job
// models are checked since POs can be raised against either.
function poRegisterCustomerForJob(linkedJobId) {
  if (!linkedJobId) return '—';
  const oldJob = purchGetAllJobs().find(j => j.id === linkedJobId);
  if (oldJob) return oldJob.client || '—';
  if (typeof jobCards !== 'undefined') {
    const jc = jobCards.find(j => j.id === linkedJobId);
    if (jc) {
      const c = typeof customers !== 'undefined' ? customers.find(x => x.id === jc.customerId) : null;
      return c ? c.name : '—';
    }
  }
  return '—';
}

function poRegisterFilterChanged(key, val) { poRegisterFilters[key] = val; renderPORegister(); }

function renderPORegister() {
  const f = poRegisterFilters;
  // Flattened one row per PO line item, matching Q-Pro's own report grain
  // (filterable by Item Name, not just by PO).
  const rows = [];
  purchaseOrders.forEach(po => {
    const customer = poRegisterCustomerForJob(po.linkedJobId);
    (po.items || []).forEach(it => {
      rows.push({ po, item: it, customer });
    });
  });

  const filtered = rows.filter(r => {
    if (f.client && !r.customer.toLowerCase().includes(f.client.toLowerCase())) return false;
    if (f.supplier && !(r.po.supplierNameTel || '').toLowerCase().includes(f.supplier.toLowerCase())) return false;
    if (f.item && !(r.item.productService || '').toLowerCase().includes(f.item.toLowerCase())) return false;
    if (f.jobNo && !(r.po.linkedJobId || '').toLowerCase().includes(f.jobNo.toLowerCase())) return false;
    if (f.from && r.po.date < f.from) return false;
    if (f.to && r.po.date > f.to) return false;
    return true;
  });

  const filterHtml = `
    <div class="p-card">
      <div class="p-field"><label>Client Name</label><input type="text" value="${f.client}" oninput="poRegisterFilterChanged('client',this.value)"></div>
      <div class="p-field"><label>Supplier</label><input type="text" value="${f.supplier}" oninput="poRegisterFilterChanged('supplier',this.value)"></div>
      <div class="p-field"><label>Item Name</label><input type="text" value="${f.item}" oninput="poRegisterFilterChanged('item',this.value)"></div>
      <div class="p-field"><label>Job Number</label><input type="text" value="${f.jobNo}" oninput="poRegisterFilterChanged('jobNo',this.value)"></div>
      <div style="display:flex;gap:8px;">
        <div class="p-field" style="flex:1;"><label>From Date</label><input type="date" value="${f.from}" onchange="poRegisterFilterChanged('from',this.value)"></div>
        <div class="p-field" style="flex:1;"><label>To Date</label><input type="date" value="${f.to}" onchange="poRegisterFilterChanged('to',this.value)"></div>
      </div>
    </div>`;

  const tableHtml = filtered.length === 0
    ? `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">No PO lines match these filters.</p></div>`
    : `<div class="p-card" style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
          <tr style="text-align:left;color:#64748b;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;">
            <th style="padding:6px;">#</th><th style="padding:6px;">Date</th><th style="padding:6px;">PO</th>
            <th style="padding:6px;">Customer</th><th style="padding:6px;">Supplier</th><th style="padding:6px;">Job</th>
            <th style="padding:6px;">Item</th><th style="padding:6px;">Qty</th><th style="padding:6px;">BHD</th><th style="padding:6px;">Ordered By</th>
          </tr>
          ${filtered.map((r, i) => `
          <tr style="border-top:1px solid #f1f5f9;">
            <td style="padding:6px;">${i + 1}</td><td style="padding:6px;">${r.po.date}</td><td style="padding:6px;">${r.po.id}</td>
            <td style="padding:6px;">${r.customer}</td><td style="padding:6px;">${r.po.supplierNameTel || '—'}</td><td style="padding:6px;">${r.po.linkedJobId || '—'}</td>
            <td style="padding:6px;">${r.item.productService}</td><td style="padding:6px;">${r.item.qty}</td>
            <td style="padding:6px;">${(r.item.netAmountBD || 0).toFixed(3)}</td><td style="padding:6px;">${r.po.preparedBy || '—'}</td>
          </tr>`).join('')}
        </table>
      </div>`;

  document.getElementById('purch-register-body').innerHTML = filterHtml + tableHtml;
}

function openInvoiceForm(poId) {
  const po = purchaseOrders.find(p => p.id === poId);
  if (!po) return;

  invoiceFormDraft = {
    poId: po.id,
    supplierRef: '',
    items: po.items.map(it => ({ itemName: it.productService, qty: it.qty, itemId: it.itemId || null, rateBD: it.fxRateBD || 0, discBD: it.discountBD || 0, vatPercent: it.vatPercent || 10 }))
  };

  document.getElementById('inv-form-po-id').textContent = po.id;
  document.getElementById('inv-supplier-ref').value = '';
  renderInvoiceFormItems();

  const panel = document.getElementById('purch-invoice-form');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function renderInvoiceFormItems() {
  const wrap = document.getElementById('inv-form-items');
  if (!wrap || !invoiceFormDraft) return;
  wrap.innerHTML = invoiceFormDraft.items.map((it, i) => `
    <div class="p-card" style="margin-bottom:8px;">
      <p style="font-size:12.5px;font-weight:600;">${it.itemName} — ${it.qty}</p>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>Rate (BD)</label>
          <input type="number" step="0.001" value="${it.rateBD}" onchange="invFormUpdateItem(${i}, 'rateBD', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>Discount (BD)</label>
          <input type="number" step="0.001" value="${it.discBD}" onchange="invFormUpdateItem(${i}, 'discBD', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>VAT %</label>
          <input type="number" step="1" value="${it.vatPercent}" onchange="invFormUpdateItem(${i}, 'vatPercent', this.value)">
        </div>
      </div>
    </div>`).join('');
}

function invFormUpdateItem(idx, field, value) {
  if (!invoiceFormDraft) return;
  invoiceFormDraft.items[idx][field] = Number(value);
}

function saveInvoiceForm() {
  if (!invoiceFormDraft) return;

  invoiceFormDraft.supplierRef = document.getElementById('inv-supplier-ref').value.trim();

  const preparedBy = (window.prompt("Your name (received by):", "") || "").trim();
  if (!preparedBy) { purchAlert('Receiver name is required.'); return; }

  const items = invoiceFormDraft.items.map(it => {
    const amtBD = it.rateBD * it.qty - it.discBD;
    const vatBD = amtBD * (it.vatPercent / 100);
    return { ...it, amtBD: amtBD + vatBD };
  });
  const total = items.reduce((s, it) => s + it.amtBD, 0);
  const vatTotal = items.reduce((s, it) => s + (it.amtBD - (it.rateBD * it.qty - it.discBD)), 0);

  const result = convertPOtoInvoice(invoiceFormDraft.poId, {
    supplierRef: invoiceFormDraft.supplierRef,
    items,
    totals: { total, vat: vatTotal, roundOff: 0, netAmount: total },
    preparedBy
  });

  if (result && result.error) { purchAlert(result.error); return; }

  purchAlert(`✓ ${result.id} created — items received`);
  closeInvoiceForm();
  renderPurchOrders();
}

function closeInvoiceForm() {
  invoiceFormDraft = null;
  const panel = document.getElementById('purch-invoice-form');
  if (panel) panel.style.display = 'none';
}

// ── Invoice creation form (direct — no PO behind it) ────
function openInvDirectForm() {
  invDirectFormDraft = {
    department: 'carp',
    linkedJobId: '',
    destinationType: 'inventory',
    supplierId: null,
    supplierNameTel: '',
    supplierRef: '',
    sourcePOSearch: null,
    items: [{ name: '', qty: 1, unit: '', itemRef: null, itemId: null, rateBD: 0, discBD: 0, vatPercent: 10 }]
  };

  document.getElementById('invd-form-dept').innerHTML = purchDeptOptionsHtml(invDirectFormDraft.department);
  document.getElementById('invd-form-job').innerHTML = purchJobOptionsHtml(invDirectFormDraft.linkedJobId);
  document.getElementById('invd-form-dest').value = invDirectFormDraft.destinationType;
  document.getElementById('invd-supplier-select').innerHTML = purchSupplierOptionsHtml(null);
  document.getElementById('invd-po-search').value = '';
  document.getElementById('invd-supplier-ref').value = '';
  renderInvDirectFormItems();

  const panel = document.getElementById('purch-invoice-form-direct');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

// "Search PO Number" + "Locate" — pulls supplier + items forward from an
// issued PO into this invoice draft (Others/Inventory variant behavior).
function invDirectLocatePO() {
  const poId = document.getElementById('invd-po-search').value.trim();
  if (!poId) { purchAlert('Enter a PO number to locate.'); return; }
  const po = purchaseOrders.find(p => p.id.toLowerCase() === poId.toLowerCase());
  if (!po) { purchAlert(`PO ${poId} not found.`); return; }

  invDirectFormDraft.sourcePOSearch = po.id;
  invDirectFormDraft.supplierId = po.supplierId || null;
  invDirectFormDraft.linkedJobId = po.linkedJobId || '';
  invDirectFormDraft.destinationType = po.type === 'Job' ? 'job-direct' : po.type === 'Others' ? 'others' : 'inventory';
  invDirectFormDraft.items = po.items.map(it => ({
    name: it.productService, qty: it.qty, unit: it.unit, itemRef: it.itemRef || null, itemId: it.itemId || null,
    rateBD: it.fxRateBD || 0, discBD: it.discountBD || 0, vatPercent: it.vatPercent || 10
  }));

  document.getElementById('invd-form-job').innerHTML = purchJobOptionsHtml(invDirectFormDraft.linkedJobId);
  document.getElementById('invd-form-dest').value = invDirectFormDraft.destinationType;
  document.getElementById('invd-supplier-select').innerHTML = purchSupplierOptionsHtml(invDirectFormDraft.supplierId);
  renderInvDirectFormItems();
  purchAlert(`✓ Located ${po.id} — supplier and items carried forward`);
}

function renderInvDirectFormItems() {
  const wrap = document.getElementById('invd-form-items');
  if (!wrap || !invDirectFormDraft) return;
  wrap.innerHTML = invDirectFormDraft.items.map((it, i) => `
    <div class="p-card" style="margin-bottom:8px;">
      <div style="display:flex;gap:6px;">
        <div class="p-field" style="flex:2;margin-bottom:6px;">
          <label>Item / material</label>
          ${purchItemFieldControl(invDirectFormDraft.destinationType, it.itemId, it.name, `invDirectFormUpdateItemMaster(${i}, this.value)`, `invDirectFormUpdateItem(${i}, 'name', this.value)`)}
        </div>
        <div class="p-field" style="flex:1;margin-bottom:6px;">
          <label>Qty</label>
          <input type="number" step="0.01" value="${it.qty}" onchange="invDirectFormUpdateItem(${i}, 'qty', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:6px;">
          <label>Unit</label>
          <input type="text" value="${it.unit}" onchange="invDirectFormUpdateItem(${i}, 'unit', this.value)">
        </div>
      </div>
      <div class="p-field" style="margin-bottom:6px;">
        <label>Allocation (job item, optional)</label>
        ${purchItemRefControl(invDirectFormDraft.linkedJobId, it.itemRef, `invDirectFormUpdateItemRef(${i}, this.value)`)}
        <p style="font-size:10.5px;color:${it.itemRef ? '#166534' : '#94a3b8'};margin-top:4px;">📎 ${it.itemRef ? purchRefLabel(it.itemRef).replace(' — ', '') : 'Not allocated'}</p>
      </div>
      <div style="display:flex;gap:6px;">
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>Rate (BD)</label>
          <input type="number" step="0.001" value="${it.rateBD}" onchange="invDirectFormUpdateItem(${i}, 'rateBD', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>Discount (BD)</label>
          <input type="number" step="0.001" value="${it.discBD}" onchange="invDirectFormUpdateItem(${i}, 'discBD', this.value)">
        </div>
        <div class="p-field" style="flex:1;margin-bottom:0;">
          <label>VAT %</label>
          <input type="number" step="1" value="${it.vatPercent}" onchange="invDirectFormUpdateItem(${i}, 'vatPercent', this.value)">
        </div>
      </div>
      ${invDirectFormDraft.items.length > 1 ? `<button style="margin-top:8px;background:none;border:0;color:#dc2626;font-size:11.5px;cursor:pointer;padding:0;" onclick="invDirectFormRemoveItem(${i})">Remove item</button>` : ''}
    </div>`).join('') +
    `<button style="background:none;border:1px dashed var(--biz-primary);color:var(--biz-primary);border-radius:8px;padding:8px;width:100%;font-size:12.5px;cursor:pointer;" onclick="invDirectFormAddItem()">+ Add item</button>`;
}

function invDirectFormUpdateItem(idx, field, value) {
  if (!invDirectFormDraft) return;
  invDirectFormDraft.items[idx][field] = (field === 'name' || field === 'unit') ? value : Number(value);
}
function invDirectFormUpdateItemMaster(idx, itemId) {
  if (!invDirectFormDraft) return;
  const it = invDirectFormDraft.items[idx];
  const master = itemMaster.find(m => m.id === itemId);
  it.itemId = master ? master.id : null;
  it.name = master ? master.name : '';
  it.unit = master ? master.unit : it.unit;
  if (master) it.rateBD = master.cost || it.rateBD;
}
function invDirectFormUpdateItemRef(idx, value) {
  if (!invDirectFormDraft) return;
  const opts = invDirectFormDraft.linkedJobId ? purchGetJobItemOptions(invDirectFormDraft.linkedJobId) : null;
  if (opts) {
    const match = opts.find(o => o.id === value);
    invDirectFormDraft.items[idx].itemRef = match ? { id: match.id, label: match.label } : null;
  } else {
    invDirectFormDraft.items[idx].itemRef = value || null;
  }
}
function invDirectFormAddItem() {
  if (!invDirectFormDraft) return;
  invDirectFormDraft.items.push({ name: '', qty: 1, unit: '', itemRef: null, itemId: null, rateBD: 0, discBD: 0, vatPercent: 10 });
  renderInvDirectFormItems();
}
function invDirectFormRemoveItem(idx) {
  if (!invDirectFormDraft || invDirectFormDraft.items.length <= 1) return;
  invDirectFormDraft.items.splice(idx, 1);
  renderInvDirectFormItems();
}
function invDirectFormDeptChanged(value) {
  if (!invDirectFormDraft) return;
  invDirectFormDraft.department = value;
}
function invDirectFormJobChanged(value) {
  if (!invDirectFormDraft) return;
  invDirectFormDraft.linkedJobId = value || null;
  invDirectFormDraft.items.forEach(it => it.itemRef = null);
  renderInvDirectFormItems();
}
function invDirectFormDestChanged(value) {
  if (!invDirectFormDraft) return;
  invDirectFormDraft.destinationType = value;
  invDirectFormDraft.items.forEach(it => it.itemId = null);
  renderInvDirectFormItems();
}

function saveInvDirectForm() {
  if (!invDirectFormDraft) return;

  invDirectFormDraft.supplierId  = document.getElementById('invd-supplier-select').value || null;
  invDirectFormDraft.supplierRef = document.getElementById('invd-supplier-ref').value.trim();

  if (!invDirectFormDraft.supplierId) { purchAlert('Select a vendor.'); return; }
  if (invDirectFormDraft.destinationType === 'job-direct' && !invDirectFormDraft.linkedJobId) { purchAlert('Job No is required'); return; }

  const invdSupplier = suppliers.find(s => s.id === invDirectFormDraft.supplierId);
  invDirectFormDraft.supplierNameTel = invdSupplier ? `${invdSupplier.name} — ${invdSupplier.telephone}` : '';

  const rawItems = invDirectFormDraft.items.filter(it => it.name.trim() && it.qty > 0);
  if (rawItems.length === 0) { purchAlert('Add at least one item with a name and quantity.'); return; }

  const preparedBy = (window.prompt("Your name (received by):", "") || "").trim();
  if (!preparedBy) { purchAlert('Receiver name is required.'); return; }

  const items = rawItems.map(it => {
    const amtBD = it.rateBD * it.qty - it.discBD;
    const vatBD = amtBD * (it.vatPercent / 100);
    return { ...it, amtBD: amtBD + vatBD };
  });
  const total = items.reduce((s, it) => s + it.amtBD, 0);
  const vatTotal = items.reduce((s, it) => s + (it.amtBD - (it.rateBD * it.qty - it.discBD)), 0);

  const inv = createPurchaseInvoiceDirect({
    department: invDirectFormDraft.department,
    linkedJobId: invDirectFormDraft.linkedJobId || null,
    destinationType: invDirectFormDraft.destinationType,
    supplierDetails: {
      supplierId: invDirectFormDraft.supplierId,
      supplierNameTel: invDirectFormDraft.supplierNameTel,
      supplierRef: invDirectFormDraft.supplierRef,
      totals: { total, vat: vatTotal, roundOff: 0, netAmount: total }
    },
    items,
    preparedBy,
    sourcePOSearch: invDirectFormDraft.sourcePOSearch
  });

  closeInvDirectForm();
  openInvoiceDraftPanel(inv.id);
}

function closeInvDirectForm() {
  invDirectFormDraft = null;
  const panel = document.getElementById('purch-invoice-form-direct');
  if (panel) panel.style.display = 'none';
}

// ── Two-stage flow, stage 2: draft/edit view with Other Expenses, then
// Confirm — matches the real Purchase Invoice screen (Submit → draft →
// Confirm finalizes) without its data-loss bug.
function openInvoiceDraftPanel(invId) {
  const inv = purchaseInvoices.find(i => i.id === invId);
  if (!inv) return;
  invoiceDraftActiveId = invId;
  renderInvoiceDraftPanel();
  const panel = document.getElementById('purch-invoice-draft');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function renderInvoiceDraftPanel() {
  const inv = purchaseInvoices.find(i => i.id === invoiceDraftActiveId);
  const body = document.getElementById('invd-draft-body');
  if (!inv || !body) return;

  const base = inv.totals.total || 0;
  const otherExp = inv.otherExpenseAmount || 0;
  const grand = base + otherExp;

  body.innerHTML = `
    <p style="font-size:12px;color:#64748b;margin-bottom:8px;">${inv.id} · ${inv.supplierNameTel || '—'}${inv.linkedJobId ? ' · ' + inv.linkedJobId : ''}</p>
    <div class="p-card">
      ${inv.items.map(it => `
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #f1f5f9;">
          <span>${it.itemName} (${it.qty}) ${it.itemRef ? '📎' : '<span style="color:#94a3b8;">📎 Not allocated</span>'}</span>
          <span>BD ${(it.amtBD || 0).toFixed(3)}</span>
        </div>`).join('')}
    </div>
    <div class="p-field">
      <label>Other Expense Amount</label>
      <input type="number" step="0.001" id="invd-draft-other-expense" value="${otherExp}" onchange="invDraftOtherExpenseChanged(this.value)">
    </div>
    <button style="background:none;border:1px dashed var(--biz-primary);color:var(--biz-primary);border-radius:8px;padding:7px;width:100%;font-size:12px;cursor:pointer;margin-bottom:10px;" onclick="invDraftOtherExpenseChanged(document.getElementById('invd-draft-other-expense').value)">+ Add Other Expenses</button>
    <div class="p-card" style="background:#f8fafc;">
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;"><span>Invoice Total</span><span>BD ${base.toFixed(3)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;"><span>Other Expenses</span><span>BD ${otherExp.toFixed(3)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;padding:4px 0 0;border-top:1px solid #e2e8f0;margin-top:4px;"><span>Grand Total</span><span id="invd-draft-grand">BD ${grand.toFixed(3)}</span></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button style="flex:1;background:var(--biz-primary);color:#fff;border:0;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;" onclick="confirmInvoiceDraftAction()">Confirm</button>
      <button style="flex:1;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;color:#475569;font-size:13px;cursor:pointer;" onclick="closeInvoiceDraftPanel()">Save as Draft</button>
    </div>`;
}

function invDraftOtherExpenseChanged(value) {
  const inv = purchaseInvoices.find(i => i.id === invoiceDraftActiveId);
  if (!inv) return;
  inv.otherExpenseAmount = Number(value) || 0;
  renderInvoiceDraftPanel();
}

function confirmInvoiceDraftAction() {
  const otherExpenseAmount = Number(document.getElementById('invd-draft-other-expense').value) || 0;
  const result = confirmPurchaseInvoiceDraft(invoiceDraftActiveId, { otherExpenseAmount });
  if (result && result.error) { purchAlert(result.error); return; }
  purchAlert(`✓ ${result.id} confirmed — awaiting approval`);
  closeInvoiceDraftPanel();
  renderPurchOrders();
}

function closeInvoiceDraftPanel() {
  invoiceDraftActiveId = null;
  const panel = document.getElementById('purch-invoice-draft');
  if (panel) panel.style.display = 'none';
  renderPurchOrders();
}

// ═══════════════════════════════════════
// SUPPLIER MASTER (Masters → Accounts → Vendor)
// The one canonical supplier list — no duplicate "Inventory → Vendor" list.
// ═══════════════════════════════════════
function renderSuppliers() {
  let html = `<button class="primary" style="width:100%;margin-bottom:12px;" onclick="openSupplierForm()">+ New Supplier</button>`;

  if (suppliers.length === 0) {
    html += `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">No suppliers yet.</p></div>`;
  } else {
    html += `<div class="p-card" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <tr style="text-align:left;color:#64748b;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;">
          <th style="padding:6px;">Vendor Name</th><th style="padding:6px;">Telephone</th>
          <th style="padding:6px;">Contact Person</th><th style="padding:6px;">Address</th><th style="padding:6px;">Action</th>
        </tr>
        ${suppliers.map(s => `
        <tr style="border-top:1px solid #f1f5f9;">
          <td style="padding:6px;font-weight:600;">${s.name}</td>
          <td style="padding:6px;">${s.telephone}</td>
          <td style="padding:6px;">${s.contactPerson}</td>
          <td style="padding:6px;">${s.address}</td>
          <td style="padding:6px;"><button style="font-size:11px;background:none;border:1px solid var(--biz-primary);color:var(--biz-primary);border-radius:6px;padding:3px 8px;cursor:pointer;" onclick="viewSupplierDetail('${s.id}')">View</button></td>
        </tr>`).join('')}
      </table>
    </div>`;
  }

  document.getElementById('purch-suppliers-body').innerHTML = html;
}

function viewSupplierDetail(id) {
  const s = suppliers.find(x => x.id === id);
  if (!s) return;
  purchAlert(`${s.name} · ${s.telephone} · ${s.contactPerson} · ${s.address} · Tax ${s.taxPercent}% · ${s.country}`);
}

// selectId is passed when the supplier form was opened from a "+ New
// Supplier…" option inside another form's picker — on save, that select
// gets repopulated with the new supplier chosen, and the caller's onchange
// handler fires so the rest of that form reveals as normal.
function openSupplierForm(selectId = null) {
  supplierFormReturnSelectId = selectId;
  const ids = ['sup-name','sup-contact','sup-tel','sup-tel2','sup-email','sup-fax','sup-vat-name','sup-vat-no',
    'sup-credit-limit','sup-credit-days','sup-bank-acc-no','sup-bank-holder','sup-iban','sup-swift',
    'sup-bank-name','sup-bank-branch','sup-address','sup-cr-no'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('sup-tax-percent').innerHTML = SUPPLIER_TAX_PERCENTS.map(t => `<option value="${t}" ${t === 10 ? 'selected' : ''}>${t}%</option>`).join('');
  document.getElementById('sup-country').innerHTML = SUPPLIER_COUNTRIES.map(c => `<option value="${c}" ${c === 'Bahrain' ? 'selected' : ''}>${c}</option>`).join('');
  document.getElementById('sup-is-credit').checked = false;
  document.getElementById('sup-credit-limit').value = 0;
  document.getElementById('sup-credit-days').value = 0;
  document.getElementById('sup-opening-balance').value = 0;

  const panel = document.getElementById('purch-supplier-form');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function saveSupplierForm() {
  const get = id => document.getElementById(id).value.trim();
  const result = createSupplier({
    name: get('sup-name'), contactPerson: get('sup-contact'), telephone: get('sup-tel'),
    telephone2: get('sup-tel2'), email: get('sup-email'), fax: get('sup-fax'),
    vatName: get('sup-vat-name'), vatNo: get('sup-vat-no'),
    taxPercent: document.getElementById('sup-tax-percent').value,
    isCredit: document.getElementById('sup-is-credit').checked,
    creditLimit: get('sup-credit-limit'), creditDays: get('sup-credit-days'),
    bankAccountNumber: get('sup-bank-acc-no'), bankAccountHolderName: get('sup-bank-holder'),
    ibanNumber: get('sup-iban'), bankSwift: get('sup-swift'), bankName: get('sup-bank-name'),
    bankBranch: get('sup-bank-branch'), address: get('sup-address'), crNo: get('sup-cr-no'),
    country: document.getElementById('sup-country').value, openingBalance: get('sup-opening-balance')
  });

  if (result && result.error) { purchAlert(result.error); return; }

  purchAlert(`✓ ${result.id} — ${result.name} created`);
  const returnSelectId = supplierFormReturnSelectId;
  closeSupplierForm();

  if (returnSelectId) {
    const sel = document.getElementById(returnSelectId);
    if (sel) {
      sel.innerHTML = purchSupplierOptionsHtml(result.id);
      sel.dispatchEvent(new Event('change'));
    }
  } else {
    renderSuppliers();
  }
}

function closeSupplierForm() {
  supplierFormReturnSelectId = null;
  const panel = document.getElementById('purch-supplier-form');
  if (panel) panel.style.display = 'none';
}

// Onchange handler shared by every supplier <select> — intercepts the
// "+ New Supplier…" option before it reaches the form-specific handler.
function purchSupplierSelectNewCheck(selectId) {
  const sel = document.getElementById(selectId);
  if (sel.value === '__new__') {
    sel.value = '';
    openSupplierForm(selectId);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════
// SUPPLIER PAYMENT
// Real Q-Pro bugs fixed here, not replicated: the invoice-allocation table
// below actually looks the vendor's open invoices up (getVendorOpenInvoices
// in data.js), the method checkboxes are plain toggles, and Create Payment
// actually persists — the record shows up in the list immediately.
// ═══════════════════════════════════════
function renderSupplierPayments() {
  let html = `<button class="primary" style="width:100%;margin-bottom:12px;" onclick="openPaymentForm()">+ New Payment</button>`;

  if (payments.length === 0) {
    html += `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">No payments yet.</p></div>`;
  } else {
    html += `<div class="p-card" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <tr style="text-align:left;color:#64748b;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;">
          <th style="padding:6px;">Payment Number</th><th style="padding:6px;">Vendor</th>
          <th style="padding:6px;">Payment Date</th><th style="padding:6px;">Payment Amount</th><th style="padding:6px;">Action</th>
        </tr>
        ${payments.slice().reverse().map(p => {
          const s = suppliers.find(x => x.id === p.supplierId);
          return `
        <tr style="border-top:1px solid #f1f5f9;">
          <td style="padding:6px;font-weight:600;">${p.id}</td>
          <td style="padding:6px;">${s ? s.name : '—'}</td>
          <td style="padding:6px;">${p.paymentDate}</td>
          <td style="padding:6px;">BD ${p.amount.toFixed(3)}</td>
          <td style="padding:6px;"><span class="p-pill approved">Confirmed</span></td>
        </tr>`;}).join('')}
      </table>
    </div>`;
  }

  document.getElementById('purch-payments-body').innerHTML = html;
}

function openPaymentForm() {
  paymentFormDraft = {
    supplierId: null, division: 'Al Maraya Decor',
    methods: {
      cash:   { enabled: false, amount: 0 },
      cCard:  { enabled: false, amount: 0, type: '', authorized: '' },
      wallet: { enabled: false, amount: 0, type: '', authorized: '' },
      cheque: { enabled: false, amount: 0, number: '', bank: '' }
    },
    referenceNumber: '', allocations: [], advanceAmount: 0, ledgerSplits: [], remarks: ''
  };
  document.getElementById('pay-supplier-select').innerHTML = purchSupplierOptionsHtml(null);
  document.getElementById('pay-reveal').style.display = 'none';

  const panel = document.getElementById('purch-payment-form');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function paymentVendorChanged(value) {
  if (purchSupplierSelectNewCheck('pay-supplier-select')) return;
  if (!paymentFormDraft) return;
  paymentFormDraft.supplierId = value || null;
  const reveal = document.getElementById('pay-reveal');
  if (!value) { reveal.style.display = 'none'; return; }
  reveal.style.display = 'block';
  paymentFormDraft.allocations = getVendorOpenInvoices(value).map(row => ({ ...row, payingAmount: 0, discountAmount: 0 }));
  renderPaymentAllocationTable();
  renderPaymentLedgerSplits();
}

function renderPaymentAllocationTable() {
  const wrap = document.getElementById('pay-allocation-table');
  if (!wrap || !paymentFormDraft) return;
  if (paymentFormDraft.allocations.length === 0) {
    wrap.innerHTML = `<p style="font-size:12px;color:#64748b;padding:8px 0;">No open invoices for this vendor.</p>`;
    return;
  }
  wrap.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr style="text-align:left;color:#64748b;font-size:10px;text-transform:uppercase;">
      <th style="padding:4px;">Invoice #</th><th style="padding:4px;">Date</th><th style="padding:4px;">Inv. Amt</th>
      <th style="padding:4px;">Paid</th><th style="padding:4px;">Paying Amt</th><th style="padding:4px;">Disc</th><th style="padding:4px;">Balance</th>
    </tr>
    ${paymentFormDraft.allocations.map((a, i) => `
    <tr style="border-top:1px solid #f1f5f9;">
      <td style="padding:4px;">${a.invoiceId}</td><td style="padding:4px;">${a.invoiceDate}</td>
      <td style="padding:4px;">${a.invoiceAmount.toFixed(3)}</td><td style="padding:4px;">${a.paidAmount.toFixed(3)}</td>
      <td style="padding:4px;"><input type="number" step="0.001" style="width:70px;padding:3px;" value="${a.payingAmount}" onchange="paymentAllocationChanged(${i}, 'payingAmount', this.value)"></td>
      <td style="padding:4px;"><input type="number" step="0.001" style="width:60px;padding:3px;" value="${a.discountAmount}" onchange="paymentAllocationChanged(${i}, 'discountAmount', this.value)"></td>
      <td style="padding:4px;">${a.balanceAmount.toFixed(3)}</td>
    </tr>`).join('')}
  </table></div>`;
}
function paymentAllocationChanged(idx, field, value) {
  if (!paymentFormDraft) return;
  paymentFormDraft.allocations[idx][field] = Number(value) || 0;
}

function paymentMethodToggle(method, checked) {
  if (!paymentFormDraft) return;
  paymentFormDraft.methods[method].enabled = checked;
  document.getElementById(`pay-${method}-fields`).style.display = checked ? 'block' : 'none';
}
function paymentMethodField(method, field, value) {
  if (!paymentFormDraft) return;
  paymentFormDraft.methods[method][field] = (field === 'amount') ? Number(value) || 0 : value;
}

function renderPaymentLedgerSplits() {
  const wrap = document.getElementById('pay-ledger-splits');
  if (!wrap || !paymentFormDraft) return;
  wrap.innerHTML = paymentFormDraft.ledgerSplits.map((l, i) => `
    <div style="display:flex;gap:6px;margin-bottom:6px;">
      <input type="text" placeholder="Ledger" style="flex:1;padding:6px;border:1px solid #e2e8f0;border-radius:6px;" value="${l.ledger}" onchange="paymentLedgerSplitChanged(${i},'ledger',this.value)">
      <input type="number" step="0.001" placeholder="Amount" style="width:80px;padding:6px;border:1px solid #e2e8f0;border-radius:6px;" value="${l.amount}" onchange="paymentLedgerSplitChanged(${i},'amount',this.value)">
      <input type="text" placeholder="Remarks" style="flex:1;padding:6px;border:1px solid #e2e8f0;border-radius:6px;" value="${l.remarks}" onchange="paymentLedgerSplitChanged(${i},'remarks',this.value)">
    </div>`).join('') +
    `<button style="background:none;border:1px dashed #16a34a;color:#16a34a;border-radius:8px;padding:6px;width:100%;font-size:12px;cursor:pointer;" onclick="paymentAddLedgerSplit()">+ Add ledger split</button>`;
}
function paymentAddLedgerSplit() {
  if (!paymentFormDraft) return;
  paymentFormDraft.ledgerSplits.push({ ledger: '', amount: 0, remarks: '' });
  renderPaymentLedgerSplits();
}
function paymentLedgerSplitChanged(idx, field, value) {
  if (!paymentFormDraft) return;
  paymentFormDraft.ledgerSplits[idx][field] = (field === 'amount') ? Number(value) || 0 : value;
}

function savePaymentForm() {
  if (!paymentFormDraft) return;
  const amount = Number(document.getElementById('pay-amount').value) || 0;
  const referenceNumber = document.getElementById('pay-reference').value.trim();
  const advanceAmount = Number(document.getElementById('pay-advance').value) || 0;
  const remarks = document.getElementById('pay-remarks').value.trim();

  if (!paymentFormDraft.supplierId) { purchAlert('Please select a vendor.'); return; }
  if (!amount) { purchAlert('Amount is required.'); return; }

  const result = createPayment({
    supplierId: paymentFormDraft.supplierId,
    division: paymentFormDraft.division,
    methods: paymentFormDraft.methods,
    amount, referenceNumber,
    allocations: paymentFormDraft.allocations.filter(a => a.payingAmount > 0),
    advanceAmount, ledgerSplits: paymentFormDraft.ledgerSplits, remarks
  });

  if (result && result.error) { purchAlert(result.error); return; }

  purchAlert(`✓ ${result.id} created`);
  closePaymentForm();
  renderSupplierPayments();
}

function closePaymentForm() {
  paymentFormDraft = null;
  const panel = document.getElementById('purch-payment-form');
  if (panel) panel.style.display = 'none';
}

// ═══════════════════════════════════════
// DEBIT NOTE
// Same real-system freeze/non-persistence bug fixed here, not replicated.
// ═══════════════════════════════════════
function renderDebitNotes() {
  let html = `<button class="primary" style="width:100%;margin-bottom:12px;" onclick="openDebitNoteForm()">+ New Debit Note</button>`;

  if (debitNotes.length === 0) {
    html += `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">No debit notes yet.</p></div>`;
  } else {
    html += `<div class="p-card" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <tr style="text-align:left;color:#64748b;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;">
          <th style="padding:6px;">Debit Note No</th><th style="padding:6px;">Client</th>
          <th style="padding:6px;">Date</th><th style="padding:6px;">Amount</th><th style="padding:6px;">Action</th>
        </tr>
        ${debitNotes.slice().reverse().map(dn => {
          const s = suppliers.find(x => x.id === dn.supplierId);
          return `
        <tr style="border-top:1px solid #f1f5f9;">
          <td style="padding:6px;font-weight:600;">${dn.id}</td>
          <td style="padding:6px;">${s ? s.name : '—'}</td>
          <td style="padding:6px;">${dn.debitNoteDate}</td>
          <td style="padding:6px;">BD ${dn.amount.toFixed(3)}</td>
          <td style="padding:6px;"><span class="p-pill approved">Confirmed</span></td>
        </tr>`;}).join('')}
      </table>
    </div>`;
  }

  document.getElementById('purch-debitnotes-body').innerHTML = html;
}

function openDebitNoteForm() {
  debitNoteFormDraft = { supplierId: null, division: 'Al Maraya Decor' };
  document.getElementById('dn-supplier-select').innerHTML = purchSupplierOptionsHtml(null);
  document.getElementById('dn-reveal').style.display = 'none';
  document.getElementById('dn-taxable-type').innerHTML = DEBIT_NOTE_TAXABLE_TYPES.map(t => `<option>${t}</option>`).join('');
  document.getElementById('dn-ledger').value = '';
  document.getElementById('dn-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('dn-amount').value = '';
  document.getElementById('dn-reason').value = '';

  const panel = document.getElementById('purch-debitnote-form');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function debitNoteVendorChanged(value) {
  if (purchSupplierSelectNewCheck('dn-supplier-select')) return;
  if (!debitNoteFormDraft) return;
  debitNoteFormDraft.supplierId = value || null;
  document.getElementById('dn-reveal').style.display = value ? 'block' : 'none';
}

function saveDebitNoteForm() {
  if (!debitNoteFormDraft) return;
  const ledger = document.getElementById('dn-ledger').value.trim();
  const debitNoteDate = document.getElementById('dn-date').value;
  const taxableType = document.getElementById('dn-taxable-type').value;
  const amount = Number(document.getElementById('dn-amount').value) || 0;
  const reason = document.getElementById('dn-reason').value.trim();

  if (!debitNoteFormDraft.supplierId) { purchAlert('Please select a vendor.'); return; }

  const result = createDebitNote({
    supplierId: debitNoteFormDraft.supplierId, division: debitNoteFormDraft.division,
    ledger, debitNoteDate, taxableType, amount, reason
  });

  if (result && result.error) { purchAlert(result.error); return; }

  purchAlert(`✓ ${result.id} created`);
  closeDebitNoteForm();
  renderDebitNotes();
}

function closeDebitNoteForm() {
  debitNoteFormDraft = null;
  const panel = document.getElementById('purch-debitnote-form');
  if (panel) panel.style.display = 'none';
}

// ═══════════════════════════════════════
// BATCH 6 — PURCHASE BILL OUTSTANDING
// Data/computation (getPurchaseBillOutstanding*) lives in data.js. Mirrors
// Sales Bill Outstanding structurally, but every label below correctly
// says Supplier/Vendor — the live spec's own "Client Name"/"CLIENT"
// mislabel on this vendor-side report (a confirmed copy-paste-without-
// relabeling bug) is fixed here, not reproduced.
// ═══════════════════════════════════════
function purchBillOSFilterChanged(key, val) { purchBillOSFilters[key] = val; renderPurchaseBillOutstanding(); }
function purchBillPillClass(status) {
  return status === 'Fully Paid' ? 'full' : status === 'Partially Paid' ? 'partial' : status === 'Advance' ? 'advance' : status === 'Cancelled' ? 'cancelled' : 'unpaid';
}
function purchBillOSLegendHtml() {
  return `<p style="font-size:10.5px;color:#94a3b8;margin-top:8px;">Legend:
    <span class="p-pill advance">Advance</span> <span class="p-pill unpaid">Unpaid</span>
    <span class="p-pill partial">Partially Paid</span> <span class="p-pill full">Fully Paid</span>
    <span class="p-pill cancelled">Cancelled</span></p>`;
}

function renderPurchaseBillOutstanding() {
  const f = purchBillOSFilters;
  const opts = { ageBasis: f.ageBasis };
  const rows0 = f.view === 'all'
    ? (f.ageWise ? getPurchaseBillOutstandingAllSuppliersAgeWise(opts) : getPurchaseBillOutstandingAllSuppliers())
    : (f.ageWise ? getPurchaseBillOutstandingByPartyAgeWise(opts) : getPurchaseBillOutstandingByParty(opts));
  const supplierName = r => r.supplierName || (r.supplierId ? ((suppliers.find(s => s.id === r.supplierId) || {}).name || '—') : '—');
  const rows = f.supplier ? rows0.filter(r => supplierName(r).toLowerCase().includes(f.supplier.toLowerCase())) : rows0;
  const outstandingTotal = rows.reduce((s, r) => s + r.balAmt, 0);

  const filterHtml = `
    <div class="p-card">
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button class="p-dept-filter-btn" style="font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:${f.view === 'byparty' ? 'var(--biz-primary)' : 'var(--biz-card-bg)'};color:${f.view === 'byparty' ? '#fff' : 'var(--biz-text-muted)'};cursor:pointer;" onclick="purchBillOSFilterChanged('view','byparty')">By Party</button>
        <button style="font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:${f.view === 'all' ? 'var(--biz-primary)' : 'var(--biz-card-bg)'};color:${f.view === 'all' ? '#fff' : 'var(--biz-text-muted)'};cursor:pointer;" onclick="purchBillOSFilterChanged('view','all')">All</button>
      </div>
      <div class="p-field"><label>Division</label><input type="text" value="Al Maraya Decor" disabled></div>
      <div class="p-field"><label>Supplier Name</label><input type="text" value="${f.supplier || ''}" oninput="purchBillOSFilterChanged('supplier',this.value)"></div>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
        <label style="font-size:12px;display:flex;align-items:center;gap:6px;"><input type="checkbox" ${f.ageWise ? 'checked' : ''} onchange="purchBillOSFilterChanged('ageWise',this.checked)"> Age-wise</label>
        ${!f.ageWise ? `
        <label style="font-size:12px;display:flex;align-items:center;gap:6px;"><input type="radio" name="pAgeBasis" ${f.ageBasis === 'bill' ? 'checked' : ''} onchange="purchBillOSFilterChanged('ageBasis','bill')"> Age by Bill Date</label>
        <label style="font-size:12px;display:flex;align-items:center;gap:6px;"><input type="radio" name="pAgeBasis" ${f.ageBasis === 'due' ? 'checked' : ''} onchange="purchBillOSFilterChanged('ageBasis','due')"> Age by Due Date</label>` : ''}
      </div>
      ${purchBillOSLegendHtml()}
    </div>
    <div class="p-card"><p style="font-weight:700;font-size:13px;">Outstanding Amount: BD ${outstandingTotal.toFixed(3)}</p></div>`;

  let tableHtml;
  if (rows.length === 0) {
    tableHtml = `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">No outstanding bills match these filters.</p></div>`;
  } else if (f.view === 'byparty' && !f.ageWise) {
    tableHtml = `<div class="p-card" style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11.5px;"><tr style="text-align:left;color:#64748b;font-size:10.5px;text-transform:uppercase;"><th style="padding:6px;">#</th><th style="padding:6px;">Bill No</th><th style="padding:6px;">Date</th><th style="padding:6px;">Supplier Ref</th><th style="padding:6px;">Bill Amt</th><th style="padding:6px;">Paid Amt</th><th style="padding:6px;">Bal Amt</th><th style="padding:6px;">Age</th><th style="padding:6px;">Status</th></tr>
      ${rows.map((r, i) => `<tr style="border-top:1px solid #f1f5f9;"><td style="padding:6px;">${i + 1}</td><td style="padding:6px;">${r.invoiceId}</td><td style="padding:6px;">${r.date}</td><td style="padding:6px;">${r.poNo || '—'}</td><td style="padding:6px;">${r.billAmt.toFixed(3)}</td><td style="padding:6px;">${r.paidAmt.toFixed(3)}</td><td style="padding:6px;">${r.balAmt.toFixed(3)}</td><td style="padding:6px;">${r.age}</td><td style="padding:6px;"><span class="p-pill ${purchBillPillClass(billOutstandingStatus(r.billAmt, r.paidAmt))}">${billOutstandingStatus(r.billAmt, r.paidAmt)}</span></td></tr>`).join('')}
      </table></div>`;
  } else if (f.view === 'byparty' && f.ageWise) {
    tableHtml = `<div class="p-card" style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11.5px;"><tr style="text-align:left;color:#64748b;font-size:10.5px;text-transform:uppercase;"><th style="padding:6px;">#</th><th style="padding:6px;">Bill No</th><th style="padding:6px;">Supplier</th><th style="padding:6px;">Bal Amt</th>${BILL_AGE_BUCKETS.map(b => `<th style="padding:6px;">${b.label}</th>`).join('')}<th style="padding:6px;">Due On</th></tr>
      ${rows.map((r, i) => `<tr style="border-top:1px solid #f1f5f9;"><td style="padding:6px;">${i + 1}</td><td style="padding:6px;">${r.invoiceId}</td><td style="padding:6px;">${supplierName(r)}</td><td style="padding:6px;">${r.balAmt.toFixed(3)}</td>${BILL_AGE_BUCKETS.map(b => `<td style="padding:6px;">${r.buckets[b.key] ? r.buckets[b.key].toFixed(3) : ''}</td>`).join('')}<td style="padding:6px;">${r.dueDate}</td></tr>`).join('')}
      </table></div>`;
  } else if (f.view === 'all' && !f.ageWise) {
    tableHtml = `<div class="p-card" style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11.5px;"><tr style="text-align:left;color:#64748b;font-size:10.5px;text-transform:uppercase;"><th style="padding:6px;">#</th><th style="padding:6px;">Supplier</th><th style="padding:6px;">Bill Amt</th><th style="padding:6px;">Paid Amt</th><th style="padding:6px;">Bal Amt</th><th style="padding:6px;">Status</th></tr>
      ${rows.map((r, i) => `<tr style="border-top:1px solid #f1f5f9;"><td style="padding:6px;">${i + 1}</td><td style="padding:6px;">${supplierName(r)}</td><td style="padding:6px;">${r.billAmt.toFixed(3)}</td><td style="padding:6px;">${r.paidAmt.toFixed(3)}</td><td style="padding:6px;">${r.balAmt.toFixed(3)}</td><td style="padding:6px;"><span class="p-pill ${purchBillPillClass(billOutstandingStatus(r.billAmt, r.paidAmt))}">${billOutstandingStatus(r.billAmt, r.paidAmt)}</span></td></tr>`).join('')}
      </table></div>`;
  } else {
    tableHtml = `<div class="p-card" style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11.5px;"><tr style="text-align:left;color:#64748b;font-size:10.5px;text-transform:uppercase;"><th style="padding:6px;">#</th><th style="padding:6px;">Supplier</th><th style="padding:6px;">Bal Amt</th>${BILL_AGE_BUCKETS.map(b => `<th style="padding:6px;">${b.label}</th>`).join('')}</tr>
      ${rows.map((r, i) => `<tr style="border-top:1px solid #f1f5f9;"><td style="padding:6px;">${i + 1}</td><td style="padding:6px;">${supplierName(r)}</td><td style="padding:6px;">${r.balAmt.toFixed(3)}</td>${BILL_AGE_BUCKETS.map(b => `<td style="padding:6px;">${r.buckets[b.key] ? r.buckets[b.key].toFixed(3) : ''}</td>`).join('')}</tr>`).join('')}
      </table></div>`;
  }

  document.getElementById('purch-billos-body').innerHTML = filterHtml + tableHtml;
}

function closePurchasingModule() { closeModuleWrap(document.getElementById('purch-module-wrap'), 'launchPurchasingModule'); }

// ── Hook into shell ─────────────────────
function launchPurchasingModule() {
  openPurchasingModule();
}
