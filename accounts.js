// ══════════════════════════════════════════
// ACCOUNTS MODULE
// Built session: 25 Jul 2026. NOT mapped from a live Q-Pro reference — the
// original shell.js placeholder was "Tally bridge" only. Built here as a
// read-only KPI dashboard/reporting surface over data this app already
// has (taxInvoices[], purchaseInvoices[], purchaseOrders[], enquiries[]/
// quotations[] for the division breakdown), since there is no accounts
// data model to invent from scratch — this reads, it doesn't create.
//
// Biggest flagged assumption: this app has no payment/receipt tracking
// anywhere yet, so every generated Tax Invoice and every received Purchase
// Invoice is treated as fully outstanding (Receivables/Payables). That's an
// overstatement once real payments exist — a real Accounts module would
// need a receipts/payments ledger, which is out of scope for this pass.
// ══════════════════════════════════════════

const accountsStyleTag = document.createElement('style');
accountsStyleTag.textContent = `
#accounts-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#accounts-module-wrap .ops-header{background:var(--biz-emerald);padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
#accounts-module-wrap .accounts-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 80px;}
#accounts-module-wrap .sales-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
#accounts-module-wrap .sales-kpi-tile{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:12px;text-align:center;box-shadow:var(--biz-shadow);}
#accounts-module-wrap .sales-kpi-tile .num{font-size:19px;font-weight:700;color:var(--biz-emerald);}
#accounts-module-wrap .sales-kpi-tile .lbl{font-size:10.5px;color:var(--biz-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.3px;}
#accounts-module-wrap .sales-card{background:var(--biz-card-bg);border:1px solid var(--biz-border-light);border-radius:var(--biz-r);padding:14px;margin-bottom:10px;box-shadow:var(--biz-shadow);}
#accounts-module-wrap .sales-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;}
#accounts-module-wrap .sales-tabbtn{font-size:11px;padding:5px 10px;border-radius:16px;border:1px solid var(--biz-border);background:var(--biz-card-bg);color:var(--biz-text-muted);cursor:pointer;font-family:inherit;}
#accounts-module-wrap .sales-tabbtn.active{background:var(--biz-emerald);border-color:var(--biz-emerald);color:#fff;}
#accounts-module-wrap table.sales-items{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;}
#accounts-module-wrap table.sales-items th{text-align:left;padding:7px 6px;background:var(--biz-input-bg);color:var(--biz-text-muted);font-weight:700;font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--biz-border-light);}
#accounts-module-wrap table.sales-items td{padding:7px 6px;border-bottom:1px solid var(--biz-border-light);}
#accounts-module-wrap table.sales-items tr:hover td{background:#F4FBF8;}
#accounts-module-wrap .sales-back{font-size:12px;color:var(--biz-emerald);font-weight:600;cursor:pointer;margin-bottom:10px;display:inline-block;}
`;
document.head.appendChild(accountsStyleTag);

const accountsModuleWrap = document.createElement('div');
accountsModuleWrap.id = 'accounts-module-wrap';
accountsModuleWrap.style.cssText = 'display:none;';
accountsModuleWrap.innerHTML = `
  <div class="ops-header">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:20px;">💰</span>
      <div>
        <div style="color:#fff;font-weight:700;font-size:15px;">Accounts</div>
        <div style="color:#d1fae5;font-size:11px;">Revenue · Receivables · Payables</div>
      </div>
    </div>
    <button onclick="closeAccountsModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="accounts-scroll">
    <div id="accounts-body"></div>
  </div>
`;
document.body.appendChild(accountsModuleWrap);

let accountsView = 'dashboard'; // dashboard | invoices | purchases

function acEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/</g, '&lt;'); }
function accountsAlert(msg) {
  if (typeof showAlert === 'function') { showAlert(msg); return; }
  let toast = document.getElementById('accounts-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'accounts-toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1f2e;color:#fff;font-size:13px;font-weight:500;padding:10px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:80vw;text-align:center;transition:opacity .3s;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2800);
}

function openAccountsModule() {
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = 'none';
  document.querySelectorAll('.module').forEach(m => m.style.display = 'none');
  ['purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  accountsModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:#f7f9fc;';
  accountsView = 'dashboard';
  renderAccountsBody();
}
function closeAccountsModule() {
  accountsModuleWrap.style.display = 'none';
  const scroll = document.getElementById('scroll');
  if (scroll) scroll.style.display = '';
}
function launchAccountsModule() { openAccountsModule(); }

function accountsSetView(v) { accountsView = v; renderAccountsBody(); }

function renderAccountsBody() {
  const body = document.getElementById('accounts-body');
  if (!body) return;
  const tabsHtml = `
    <div class="sales-tabs">
      <button class="sales-tabbtn ${accountsView === 'dashboard' ? 'active' : ''}" onclick="accountsSetView('dashboard')">Dashboard</button>
      <button class="sales-tabbtn ${accountsView === 'invoices' ? 'active' : ''}" onclick="accountsSetView('invoices')">Sales Invoices</button>
      <button class="sales-tabbtn ${accountsView === 'purchases' ? 'active' : ''}" onclick="accountsSetView('purchases')">Purchase Invoices</button>
    </div>`;
  let content = '';
  if (accountsView === 'dashboard') content = renderAccountsDashboard();
  else if (accountsView === 'invoices') content = renderAccountsSalesInvoices();
  else content = renderAccountsPurchaseInvoices();
  body.innerHTML = tabsHtml + content;
}

// Division for a Tax Invoice, traced Invoice -> Job -> Quotation -> Enquiry.
function accountsDivisionForInvoice(inv) {
  const job = getJobCard(inv.jobId);
  if (!job) return null;
  const qtn = quotations.find(q => q.id === job.quotationId);
  const enq = qtn ? enquiries.find(e => e.id === qtn.enquiryId) : null;
  return enq ? enq.division : null;
}

function getAccountsKPIs() {
  const revenue = taxInvoices.reduce((s, inv) => s + inv.totals.netTotal, 0);
  const receivables = revenue; // no payments ledger yet — see file header note
  const receivedPurchaseInvoices = purchaseInvoices.filter(inv => inv.status === 'received');
  const payables = receivedPurchaseInvoices.reduce((s, inv) => s + (inv.totals ? inv.totals.netAmount : 0), 0);
  const pendingPOValue = purchaseOrders.filter(po => po.status === 'issued')
    .reduce((s, po) => s + po.items.reduce((s2, it) => s2 + (it.netAmountBD || 0), 0), 0);
  const cashPosition = revenue - payables; // rough proxy, not a real cash-flow statement

  const byDivision = {};
  taxInvoices.forEach(inv => {
    const div = accountsDivisionForInvoice(inv) || 'Unassigned';
    byDivision[div] = (byDivision[div] || 0) + inv.totals.netTotal;
  });

  return {
    revenue, receivables, payables, pendingPOValue, cashPosition,
    invoiceCount: taxInvoices.length, purchaseInvoiceCount: receivedPurchaseInvoices.length,
    byDivision
  };
}

function renderAccountsDashboard() {
  const k = getAccountsKPIs();
  const divisionRows = Object.entries(k.byDivision);
  return `
    <div class="sales-kpi-grid">
      <div class="sales-kpi-tile"><div class="num">BD ${k.revenue.toFixed(3)}</div><div class="lbl">Revenue (Invoiced)</div></div>
      <div class="sales-kpi-tile"><div class="num">BD ${k.receivables.toFixed(3)}</div><div class="lbl">Receivables</div></div>
      <div class="sales-kpi-tile"><div class="num">BD ${k.payables.toFixed(3)}</div><div class="lbl">Payables</div></div>
      <div class="sales-kpi-tile"><div class="num">BD ${k.pendingPOValue.toFixed(3)}</div><div class="lbl">PO Value Awaiting Delivery</div></div>
      <div class="sales-kpi-tile"><div class="num">BD ${k.cashPosition.toFixed(3)}</div><div class="lbl">Cash Position (proxy)</div></div>
      <div class="sales-kpi-tile"><div class="num">${k.invoiceCount}</div><div class="lbl">Sales Invoices</div></div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Revenue by Division</p>
      ${divisionRows.length === 0 ? `<p style="font-size:12px;color:#64748b;">No invoices generated yet.</p>` :
        `<table class="sales-items"><tr><th>Division</th><th>Revenue (BD)</th></tr>${divisionRows.map(([div, amt]) => `<tr><td>${acEsc(div)}</td><td>${amt.toFixed(3)}</td></tr>`).join('')}</table>`}
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Note</p>
      <p style="font-size:11.5px;color:#94a3b8;">This app has no payment/receipt ledger yet, so Receivables and Payables above are the full invoiced/received amounts, not a true outstanding balance. Tally bridge sync is not built.</p>
    </div>`;
}

function renderAccountsSalesInvoices() {
  const rows = taxInvoices.slice().sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="sales-card">
      ${rows.length === 0 ? `<p style="font-size:12px;color:#64748b;">No sales invoices generated yet.</p>` :
        `<table class="sales-items"><tr><th>Invoice No</th><th>Date</th><th>Job</th><th>Net Total</th></tr>
        ${rows.map(inv => `<tr><td>${acEsc(inv.id)}</td><td>${inv.date}</td><td>${acEsc(inv.jobId)}</td><td>BD ${inv.totals.netTotal.toFixed(3)}</td></tr>`).join('')}
        </table>`}
    </div>`;
}

function renderAccountsPurchaseInvoices() {
  const rows = purchaseInvoices.slice().sort((a, b) => b.dateReceived.localeCompare(a.dateReceived));
  return `
    <div class="sales-card">
      ${rows.length === 0 ? `<p style="font-size:12px;color:#64748b;">No purchase invoices yet.</p>` :
        `<table class="sales-items"><tr><th>Invoice</th><th>Date</th><th>Supplier</th><th>Status</th><th>Net Amount</th></tr>
        ${rows.map(inv => `<tr><td>${acEsc(inv.id)}</td><td>${inv.dateReceived}</td><td>${acEsc(inv.supplierNameTel) || '—'}</td><td>${acEsc(inv.status)}</td><td>BD ${(inv.totals ? inv.totals.netAmount : 0).toFixed(3)}</td></tr>`).join('')}
        </table>`}
    </div>`;
}
