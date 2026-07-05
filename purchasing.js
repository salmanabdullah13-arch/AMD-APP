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

  const filterHtml = `
    <div class="p-dept-filter">
      ${depts.map(d => `<button class="${purchPRDeptFilter === d.k ? 'active' : ''}" onclick="purchSetPRFilter('${d.k}')">${d.n}</button>`).join('')}
    </div>`;

  const open = purchaseRequests.filter(pr =>
    pr.status === 'open' && (purchPRDeptFilter === 'all' || pr.department === purchPRDeptFilter)
  );

  let html = filterHtml;

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
            ${pr.items.map(it => `${it.name} (${it.qty} ${it.unit})`).join(', ')}
          </p>
          <button class="primary" style="font-size:12px;background:#d4a017;border-color:#d4a017;" onclick="openPOForm('${pr.id}')">Convert to PO →</button>
        </div>`;
    });
  }

  document.getElementById('purch-requests-body').innerHTML = html;
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

// ── Approval queue ─────────────────────────
function renderPurchApprovals() {
  const pending = getPendingPOApprovals();
  let html = '';

  if (pending.length === 0) {
    html = `<div class="p-card"><p style="font-size:12.5px;color:#64748b;">No POs waiting on approval.</p></div>`;
  } else {
    pending.forEach(po => {
      const pr = purchaseRequests.find(p => p.id === po.sourcePR);
      const netTotal = po.items.reduce((s, it) => s + (it.netAmountBD || 0), 0);
      html += `
        <div class="p-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div>
              <p style="font-weight:700;font-size:13px;">${po.id} ${pr ? '· ' + dc(pr.department).n : ''}</p>
              <p style="font-size:11px;color:#64748b;">${po.supplierNameTel || '—'} · ${po.date}${po.linkedJobId ? ' · ' + po.linkedJobId : ''}</p>
            </div>
            <span class="p-pill pending">Pending</span>
          </div>
          <p style="font-size:11.5px;color:#334155;margin:8px 0;">
            ${po.items.map(it => `${it.productService} (${it.qty} ${it.unit})`).join(', ')}
          </p>
          <p style="font-size:12px;font-weight:700;margin-bottom:8px;">Net total: BD ${netTotal.toFixed(3)}</p>
          <div style="display:flex;gap:8px;">
            <button class="primary" style="font-size:12px;background:#16a34a;border-color:#16a34a;flex:1;" onclick="approvePOAction('${po.id}')">Approve</button>
            <button class="primary" style="font-size:12px;background:#dc2626;border-color:#dc2626;flex:1;" onclick="rejectPOAction('${po.id}')">Reject</button>
          </div>
        </div>`;
    });
  }

  document.getElementById('purch-approvals-body').innerHTML = html;
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

  let html = `<p style="font-weight:700;font-size:13px;margin:4px 0 8px;">Awaiting Delivery (${issued.length})</p>`;

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

  html += `<p style="font-weight:700;font-size:13px;margin:16px 0 8px;">Invoiced (${invoiced.length})</p>`;
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
