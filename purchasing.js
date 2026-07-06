// ══════════════════════════════════════════
// PURCHASER MODULE — Ops/Owner facing
// Reads/writes: purchaseRequests[], purchaseOrders[], purchaseInvoices[],
// stockEntries[], itemCards[] (all in data.js). Curtain's purchaseInquiries[]
// is a separate system, deliberately not shown here — Curtain views its own
// tracker inside the Curtain module.
// ══════════════════════════════════════════

const purchStyleTag = document.createElement('style');
purchStyleTag.textContent = `
#purch-module-wrap { font-family: inherit; }
#purch-module-wrap .ops-header{background:#8a6d00;padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#purch-module-wrap .nav{background:#fff;border-bottom:1px solid #e2e8f0;overflow-x:auto;display:flex;padding:0 16px;flex:none;}
#purch-module-wrap .ntab{background:none;border:0;border-bottom:2.5px solid transparent;color:#64748b;padding:10px 11px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;white-space:nowrap;position:relative;}
#purch-module-wrap .ntab.active{color:#8a6d00;border-bottom-color:#d4a017;font-weight:700;}
#purch-module-wrap .scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:80px;}
#purch-module-wrap .page{display:none;padding:16px 18px;max-width:980px;margin:0 auto;}
#purch-module-wrap .page.active{display:block;}
#purch-module-wrap button.primary{background:#d4a017;color:#fff;border:0;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
#purch-module-wrap .p-card {
  background:#fff; border:1px solid #e2e8f0; border-radius:12px;
  padding:14px; margin-bottom:12px;
}
#purch-module-wrap .p-kpi-grid {
  display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:16px;
}
#purch-module-wrap .p-kpi-tile {
  background:#fff; border:1px solid #e2e8f0; border-radius:12px;
  padding:12px; text-align:center;
}
#purch-module-wrap .p-kpi-tile .num { font-size:22px; font-weight:800; color:#d4a017; }
#purch-module-wrap .p-kpi-tile .lbl { font-size:11px; color:#64748b; margin-top:2px; }
#purch-module-wrap .p-pill {
  display:inline-block; font-size:10.5px; font-weight:600; padding:3px 9px;
  border-radius:20px; background:#f1f5f9; color:#64748b;
}
#purch-module-wrap .p-pill.pending { background:#fef3c7; color:#92400e; }
#purch-module-wrap .p-pill.approved { background:#dcfce7; color:#166534; }
#purch-module-wrap .p-pill.rejected { background:#fee2e2; color:#991b1b; }
#purch-module-wrap .p-pill.issued { background:#dbeafe; color:#1e40af; }
#purch-module-wrap .p-pill.invoiced { background:#e0e7ff; color:#3730a3; }
#purch-module-wrap .p-dept-filter {
  display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;
}
#purch-module-wrap .p-dept-filter button {
  font-size:11px; padding:5px 10px; border-radius:16px; border:1px solid #e2e8f0;
  background:#fff; color:#475569; cursor:pointer;
}
#purch-module-wrap .p-dept-filter button.active {
  background:#d4a017; border-color:#d4a017; color:#fff;
}
#purch-module-wrap .p-panel {
  display:none; position:fixed; top:0; left:0; right:0; bottom:0; z-index:200;
  background:rgba(15,23,42,.55); flex-direction:column; align-items:center;
  justify-content:flex-start; overflow-y:auto; padding:20px 12px;
}
#purch-module-wrap .p-panel-inner {
  background:#fff; border-radius:14px; padding:18px; width:100%; max-width:480px;
  margin-top:20px;
}
#purch-module-wrap .p-field { margin-bottom:10px; }
#purch-module-wrap .p-field label { font-size:11px; color:#64748b; display:block; margin-bottom:3px; }
#purch-module-wrap .p-field input, #purch-module-wrap .p-field select, #purch-module-wrap .p-field textarea {
  width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px;
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

  const mod = document.getElementById('purch-module-wrap');
  mod.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:#f7f9fc;';

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
            <span class="p-pill">${pr.destinationType === 'job-direct' ? 'Job-direct' : 'Stock'}</span>
          </div>
          <p style="font-size:11.5px;color:#334155;margin:8px 0;">
            ${pr.items.map(it => `${it.name} (${it.qty} ${it.unit})${purchRefLabel(it.itemRef)}`).join(', ')}
          </p>
          <button class="primary" style="font-size:12px;background:#d4a017;border-color:#d4a017;" onclick="openPOForm('${pr.id}')">Convert to PO →</button>
        </div>`;
    });
  }

  document.getElementById('purch-requests-body').innerHTML = html;
}

// ── PR creation form (new, direct — no conversion involved) ───────
function openPRForm() {
  prFormDraft = {
    department: 'carp',
    linkedJobId: '',
    destinationType: 'inventory',
    items: [{ name: '', qty: 1, unit: '', itemRef: null }]
  };

  document.getElementById('pr-form-dept').innerHTML = purchDeptOptionsHtml(prFormDraft.department);
  document.getElementById('pr-form-job').innerHTML = purchJobOptionsHtml(prFormDraft.linkedJobId);
  document.getElementById('pr-form-dest').value = prFormDraft.destinationType;
  renderPRFormItems();

  const panel = document.getElementById('purch-pr-form');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
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
    `<button style="background:none;border:1px dashed #d4a017;color:#8a6d00;border-radius:8px;padding:8px;width:100%;font-size:12.5px;cursor:pointer;" onclick="prFormAddItem()">+ Add item</button>`;
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
    items
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
    supplierNameTel: '',
    supplierRef: '',
    deliveryTerms: '',
    supplyAddress: '',
    exRate: 1,
    items: pr.items.map(it => ({ productService: it.name, qty: it.qty, unit: it.unit, fxRateBD: 0, discountBD: 0, vatPercent: 10 }))
  };

  document.getElementById('po-form-pr-id').textContent = pr.id;
  document.getElementById('po-form-dept').textContent = dc(pr.department).n;
  document.getElementById('po-payment-mode').value = 'Cash';
  document.getElementById('po-supplier-name-tel').value = '';
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

  poFormDraft.paymentMode     = document.getElementById('po-payment-mode').value;
  poFormDraft.supplierNameTel = document.getElementById('po-supplier-name-tel').value.trim();
  poFormDraft.supplierRef     = document.getElementById('po-supplier-ref').value.trim();
  poFormDraft.deliveryTerms   = document.getElementById('po-delivery-terms').value.trim();
  poFormDraft.supplyAddress   = document.getElementById('po-supply-address').value.trim();
  poFormDraft.exRate          = Number(document.getElementById('po-ex-rate').value) || 1;

  if (!poFormDraft.supplierNameTel) { purchAlert('Enter supplier name / tel.'); return; }

  const preparedBy = (window.prompt("Your name (prepared by):", "") || "").trim();
  if (!preparedBy) { purchAlert('Preparer name is required.'); return; }

  const po = convertPRtoPO(poFormDraft.prId, {
    paymentMode:     poFormDraft.paymentMode,
    supplierNameTel: poFormDraft.supplierNameTel,
    supplierRef:     poFormDraft.supplierRef,
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
    supplierNameTel: '',
    supplierRef: '',
    deliveryTerms: '',
    supplyAddress: '',
    exRate: 1,
    items: [{ name: '', qty: 1, unit: '', itemRef: null, fxRateBD: 0, discountBD: 0, vatPercent: 10 }]
  };

  document.getElementById('pod-form-dept').innerHTML = purchDeptOptionsHtml(poDirectFormDraft.department);
  document.getElementById('pod-form-job').innerHTML = purchJobOptionsHtml(poDirectFormDraft.linkedJobId);
  document.getElementById('pod-form-dest').value = poDirectFormDraft.destinationType;
  document.getElementById('pod-payment-mode').value = 'Cash';
  document.getElementById('pod-supplier-name-tel').value = '';
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
          <input type="text" value="${it.name}" onchange="poDirectFormUpdateItem(${i}, 'name', this.value)">
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
    `<button style="background:none;border:1px dashed #d4a017;color:#8a6d00;border-radius:8px;padding:8px;width:100%;font-size:12.5px;cursor:pointer;" onclick="poDirectFormAddItem()">+ Add item</button>`;
}

function poDirectFormUpdateItem(idx, field, value) {
  if (!poDirectFormDraft) return;
  poDirectFormDraft.items[idx][field] = (field === 'name' || field === 'unit') ? value : Number(value);
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
  poDirectFormDraft.items.push({ name: '', qty: 1, unit: '', itemRef: null, fxRateBD: 0, discountBD: 0, vatPercent: 10 });
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
}

function savePODirectForm() {
  if (!poDirectFormDraft) return;

  poDirectFormDraft.paymentMode     = document.getElementById('pod-payment-mode').value;
  poDirectFormDraft.supplierNameTel = document.getElementById('pod-supplier-name-tel').value.trim();
  poDirectFormDraft.supplierRef     = document.getElementById('pod-supplier-ref').value.trim();
  poDirectFormDraft.deliveryTerms   = document.getElementById('pod-delivery-terms').value.trim();
  poDirectFormDraft.supplyAddress   = document.getElementById('pod-supply-address').value.trim();
  poDirectFormDraft.exRate          = Number(document.getElementById('pod-ex-rate').value) || 1;

  if (!poDirectFormDraft.supplierNameTel) { purchAlert('Enter supplier name / tel.'); return; }

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
      supplierNameTel: poDirectFormDraft.supplierNameTel,
      supplierRef: poDirectFormDraft.supplierRef,
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
      <button class="primary" style="flex:1;background:#8a6d00;border-color:#8a6d00;" onclick="openInvDirectForm()">+ New Invoice</button>
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
          <button class="primary" style="font-size:12px;background:#d4a017;border-color:#d4a017;margin-top:8px;" onclick="openInvoiceForm('${po.id}')">Receive & Convert to Invoice →</button>
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
      const pillClass = inv.approvalStatus === 'approved' ? 'invoiced' : inv.approvalStatus === 'rejected' ? 'rejected' : 'pending';
      const pillLabel = inv.approvalStatus === 'approved' ? 'Received' : inv.approvalStatus === 'rejected' ? 'Rejected' : 'Pending approval';
      html += `
        <div class="p-card">
          <p style="font-weight:700;font-size:13px;">${inv.id} ${inv.department ? '· ' + dc(inv.department).n : ''}</p>
          <p style="font-size:11px;color:#64748b;">${inv.supplierNameTel || '—'} · ${inv.dateReceived}${inv.linkedJobId ? ' · ' + inv.linkedJobId : ''}</p>
          <span class="p-pill ${pillClass}">${pillLabel}</span>
        </div>`;
    });
  }

  document.getElementById('purch-orders-body').innerHTML = html;
}

function openInvoiceForm(poId) {
  const po = purchaseOrders.find(p => p.id === poId);
  if (!po) return;

  invoiceFormDraft = {
    poId: po.id,
    supplierRef: '',
    items: po.items.map(it => ({ itemName: it.productService, qty: it.qty, rateBD: it.fxRateBD || 0, discBD: it.discountBD || 0, vatPercent: it.vatPercent || 10 }))
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
    supplierNameTel: '',
    supplierRef: '',
    items: [{ name: '', qty: 1, unit: '', itemRef: null, rateBD: 0, discBD: 0, vatPercent: 10 }]
  };

  document.getElementById('invd-form-dept').innerHTML = purchDeptOptionsHtml(invDirectFormDraft.department);
  document.getElementById('invd-form-job').innerHTML = purchJobOptionsHtml(invDirectFormDraft.linkedJobId);
  document.getElementById('invd-form-dest').value = invDirectFormDraft.destinationType;
  document.getElementById('invd-supplier-name-tel').value = '';
  document.getElementById('invd-supplier-ref').value = '';
  renderInvDirectFormItems();

  const panel = document.getElementById('purch-invoice-form-direct');
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = 0; }
}

function renderInvDirectFormItems() {
  const wrap = document.getElementById('invd-form-items');
  if (!wrap || !invDirectFormDraft) return;
  wrap.innerHTML = invDirectFormDraft.items.map((it, i) => `
    <div class="p-card" style="margin-bottom:8px;">
      <div style="display:flex;gap:6px;">
        <div class="p-field" style="flex:2;margin-bottom:6px;">
          <label>Item / material</label>
          <input type="text" value="${it.name}" onchange="invDirectFormUpdateItem(${i}, 'name', this.value)">
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
    `<button style="background:none;border:1px dashed #d4a017;color:#8a6d00;border-radius:8px;padding:8px;width:100%;font-size:12.5px;cursor:pointer;" onclick="invDirectFormAddItem()">+ Add item</button>`;
}

function invDirectFormUpdateItem(idx, field, value) {
  if (!invDirectFormDraft) return;
  invDirectFormDraft.items[idx][field] = (field === 'name' || field === 'unit') ? value : Number(value);
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
  invDirectFormDraft.items.push({ name: '', qty: 1, unit: '', itemRef: null, rateBD: 0, discBD: 0, vatPercent: 10 });
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
}

function saveInvDirectForm() {
  if (!invDirectFormDraft) return;

  invDirectFormDraft.supplierNameTel = document.getElementById('invd-supplier-name-tel').value.trim();
  invDirectFormDraft.supplierRef     = document.getElementById('invd-supplier-ref').value.trim();

  if (!invDirectFormDraft.supplierNameTel) { purchAlert('Enter supplier name / tel.'); return; }

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
      supplierNameTel: invDirectFormDraft.supplierNameTel,
      supplierRef: invDirectFormDraft.supplierRef,
      totals: { total, vat: vatTotal, roundOff: 0, netAmount: total }
    },
    items,
    preparedBy
  });

  purchAlert(`✓ ${inv.id} created — awaiting approval`);
  closeInvDirectForm();
  renderPurchOrders();
}

function closeInvDirectForm() {
  invDirectFormDraft = null;
  const panel = document.getElementById('purch-invoice-form-direct');
  if (panel) panel.style.display = 'none';
}

function closePurchasingModule() {
  const mod = document.getElementById('purch-module-wrap');
  if (mod) mod.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}

// ── Hook into shell ─────────────────────
function launchPurchasingModule() {
  openPurchasingModule();
}
