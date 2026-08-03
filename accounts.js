// ══════════════════════════════════════════
// ACCOUNTS MODULE
// Built session: 25 Jul 2026. NOT mapped from a live Q-Pro reference — the
// original shell.js placeholder was "Tally bridge" only. Built here as a
// read-only KPI dashboard/reporting surface over data this app already
// has (taxInvoices[], purchaseInvoices[], purchaseOrders[], enquiries[]/
// quotations[] for the division breakdown), since there is no accounts
// data model to invent from scratch — this reads, it doesn't create.
//
// Receivables/Payables net off real payment activity (Batch 4's Sales
// Receipt/Credit Note, Batch 1's Supplier Payment) as of Batch 6 — see
// getAccountsKPIs() below and getBalanceSheet() in data.js.
// ══════════════════════════════════════════

const accountsStyleTag = document.createElement('style');
accountsStyleTag.textContent = `
#accounts-module-wrap { font-family: var(--font-biz); background: var(--biz-page-bg); }
#accounts-module-wrap .ops-header{background:var(--biz-emerald);padding:calc(11px + var(--safe-top,0px)) 18px 11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;}
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
#accounts-module-wrap table.sales-items tr:hover td{background:#FAFBFD;}
#accounts-module-wrap .sales-back{font-size:12px;color:var(--biz-emerald);font-weight:600;cursor:pointer;margin-bottom:10px;display:inline-block;}
#accounts-module-wrap .sales-field{margin-bottom:10px;}
#accounts-module-wrap .sales-field label{font-size:10.5px;font-weight:700;color:var(--biz-text-muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px;}
#accounts-module-wrap .sales-field input, #accounts-module-wrap .sales-field select, #accounts-module-wrap .sales-field textarea{width:100%;padding:9px 11px;border:1px solid var(--biz-border);border-radius:var(--biz-r-sm);font-size:13px;box-sizing:border-box;font-family:inherit;background:var(--biz-input-bg);color:var(--biz-text);transition:border-color .12s;}
#accounts-module-wrap .sales-field input:focus, #accounts-module-wrap .sales-field select:focus, #accounts-module-wrap .sales-field textarea:focus{outline:none;border-color:var(--biz-primary);background:var(--biz-card-bg);}
#accounts-module-wrap .sales-field textarea{min-height:70px;resize:vertical;}
#accounts-module-wrap .bill-pill{display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;}
#accounts-module-wrap .bill-pill.unpaid{background:var(--bad-bg,#fdeceb);color:var(--bad,#d9342b);}
#accounts-module-wrap .bill-pill.partial{background:var(--warn-bg,#fff6e3);color:var(--warn,#c47d00);}
#accounts-module-wrap .bill-pill.full{background:var(--ok-bg,#eafaf1);color:var(--ok,#0f9d58);}
#accounts-module-wrap .bill-pill.advance{background:#e0ecfb;color:var(--info,#2563eb);}
#accounts-module-wrap .bill-pill.cancelled{background:#eef0f3;color:#64748b;}
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
        <div style="color:rgba(255,255,255,.7);font-size:11px;">Revenue · Receivables · Payables</div>
      </div>
    </div>
    <button onclick="closeAccountsModule()" style="background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;">×</button>
  </div>
  <div class="accounts-scroll">
    <div id="accounts-body"></div>
  </div>
`;
document.body.appendChild(accountsModuleWrap);

let accountsView = 'dashboard'; // dashboard | invoices | purchases | coa | ledgers | ledger-new | receipts | receipt-new | payments | payment-new | journals | journal-new | daybook | ledger-report | trial-balance | pl | balance-sheet | proforma | salesreceipts | salesreceipt-new | creditnotes | creditnote-new | custupdate | bill-os
let acVisibleLineRows = 1; // shared row-count for whichever line-entry form (Receipt/Payment/Journal) is currently open
const acToday = new Date().toISOString().slice(0, 10);
let acReportFilters = { dbFrom: acToday, dbTo: acToday, voucherType: 'All', glFrom: '2023-01-01', glTo: acToday, ledgerName: '', ledgerWise: true };
// Batch 7 — moved from sales.js: Sales Receipt/Credit Note/Customer Update
// creation, and Sales Bill Outstanding, are Accounts-only now (Salman's
// call, 3 Aug 2026 — Sales gets a read-only view via the existing
// renderRelatedRecords() helper in sales.js, unchanged).
let salesReceiptDraft = null;
let salesCreditNoteDraft = null;
let custUpdateSearch = '';
let custUpdateQtnId = null;
let salesBillOSFilters = { view: 'byparty', ageWise: false, ageBasis: 'bill' };

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
  ['purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'sales-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  accountsModuleWrap.style.cssText = 'display:flex;flex-direction:column;position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:var(--biz-page-bg);';
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
  const tab = (v, label) => `<button class="sales-tabbtn ${accountsView === v || (accountsView === v + '-new' ) ? 'active' : ''}" onclick="accountsSetView('${v}')">${label}</button>`;
  const pendingCustomerCount = customers.filter(c => c.status === 'pending').length;
  const tabsHtml = `
    <div class="sales-tabs">
      ${tab('dashboard', 'Dashboard')}
      ${tab('invoices', 'Sales Invoices')}
      ${tab('purchases', 'Purchase Invoices')}
      ${tab('coa', 'Chart of Accounts')}
      ${tab('ledgers', 'Ledgers')}
      ${tab('receipts', 'General Receipt')}
      ${tab('payments', 'General Payment')}
      ${tab('journals', 'Journal')}
      ${tab('voucher-map', 'Voucher Ledger Mapping')}
      ${tab('daybook', 'Day Book')}
      ${tab('ledger-report', 'Ledger Report')}
      ${tab('trial-balance', 'Trial Balance')}
      ${tab('pl', 'Profit & Loss')}
      ${tab('balance-sheet', 'Balance Sheet')}
      ${tab('proforma', 'Proforma')}
      ${tab('salesreceipts', 'Sales Receipt')}
      ${tab('creditnotes', 'Sales Credit Note')}
      ${tab('custupdate', 'Customer Update')}
      ${tab('bill-os', 'Sales Bill Outstanding')}
      ${tab('pending-customers', `Pending Customers${pendingCustomerCount ? ` (${pendingCustomerCount})` : ''}`)}
    </div>`;
  let content = '';
  if (accountsView === 'dashboard') content = renderAccountsDashboard();
  else if (accountsView === 'pending-customers') content = renderAccountsPendingCustomers();
  else if (accountsView === 'invoices') content = renderAccountsSalesInvoices();
  else if (accountsView === 'purchases') content = renderAccountsPurchaseInvoices();
  else if (accountsView === 'coa') content = renderAccountsGroups();
  else if (accountsView === 'ledgers') content = renderLedgers();
  else if (accountsView === 'ledger-new') content = renderLedgerForm();
  else if (accountsView === 'receipts') content = renderGeneralReceipts();
  else if (accountsView === 'receipt-new') content = renderGeneralReceiptForm();
  else if (accountsView === 'payments') content = renderGeneralPayments();
  else if (accountsView === 'payment-new') content = renderGeneralPaymentForm();
  else if (accountsView === 'journals') content = renderJournals();
  else if (accountsView === 'journal-new') content = renderJournalForm();
  else if (accountsView === 'voucher-map') content = renderVoucherLedgerMapping();
  else if (accountsView === 'daybook') content = renderDayBookReport();
  else if (accountsView === 'ledger-report') content = renderLedgerReportView();
  else if (accountsView === 'trial-balance') content = renderTrialBalanceView();
  else if (accountsView === 'proforma') content = renderProformaList();
  else if (accountsView === 'salesreceipts') content = renderSalesReceiptList();
  else if (accountsView === 'salesreceipt-new') content = renderSalesReceiptCreate();
  else if (accountsView === 'creditnotes') content = renderSalesCreditNoteList();
  else if (accountsView === 'creditnote-new') content = renderSalesCreditNoteCreate();
  else if (accountsView === 'custupdate') content = renderCustomerUpdateTool();
  else if (accountsView === 'bill-os') content = renderSalesBillOutstanding();
  else if (accountsView === 'pl') content = renderProfitLossView();
  else if (accountsView === 'balance-sheet') content = renderBalanceSheetView();
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
  // Nets off Batch 4's Sales Receipt/Credit Note activity and Batch 1's
  // Supplier Payment paidAmount — closes the long-open TODO this file's
  // header used to flag ("an overstatement once payments exist"). Building
  // Batch 6's Balance Sheet needed the same real-balance computation, so
  // fixed here rather than leaving two different Receivables/Payables
  // figures (a stale Dashboard one, a correct Balance Sheet one) side by side.
  const receivables = taxInvoices.reduce((s, inv) => s + invoiceBalance(inv), 0);
  const receivedPurchaseInvoices = purchaseInvoices.filter(inv => inv.status === 'received');
  const payables = receivedPurchaseInvoices.reduce((s, inv) => s + Math.max(0, (inv.totals ? inv.totals.netAmount : 0) - (inv.paidAmount || 0)), 0);
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
      <p style="font-size:11.5px;color:#94a3b8;">Receivables/Payables above are true outstanding balances, netting off Sales Receipt/Credit Note and Supplier Payment activity. Tally bridge sync is not built.</p>
    </div>`;
}

// ══════════════════════════════════════════
// PENDING CUSTOMERS — Accounts' approval queue
// Moved here from the Approver module 3 Aug 2026 — customer verification
// (catching duplicate client records before they cause receivables
// problems, a real past incident) is an Accounts responsibility, confirmed
// by Salman. Non-blocking: Sales can already create Enquiries/Quotations
// against a "pending" customer immediately (see createCustomer() in
// data.js) — this queue is after-the-fact governance, not a gate on Sales.
// ══════════════════════════════════════════

function renderAccountsPendingCustomers() {
  const pending = customers.filter(c => c.status === 'pending');
  const rows = pending.length === 0
    ? `<p style="font-size:12px;color:#64748b;">No customers awaiting approval.</p>`
    : pending.map(c => {
        const dup = c.possibleDuplicateOf ? customers.find(x => x.id === c.possibleDuplicateOf) : null;
        return `
      <div class="sales-card" style="margin-bottom:8px;${dup ? 'border-color:#f59e0b;' : ''}">
        <p style="font-weight:700;font-size:13px;">${acEsc(c.name)} <span class="sales-pill">${c.id}</span></p>
        <p style="font-size:11.5px;color:#64748b;">${acEsc(c.contactPerson)} · ${acEsc(c.tel)} · ${acEsc(c.email)} · ${acEsc(c.address)}</p>
        ${dup ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px;margin-top:8px;">
          <p style="font-size:11px;font-weight:700;color:#92400e;">⚠ Possible duplicate — matches existing customer ${acEsc(dup.id)}</p>
          <p style="font-size:11px;color:#92400e;">${acEsc(dup.name)} · ${acEsc(dup.contactPerson)} · ${acEsc(dup.tel)} · ${acEsc(dup.email)}</p>
        </div>` : ''}
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="primary" style="flex:1;font-size:11.5px;padding:7px;" onclick="accountsApproveCustomer('${c.id}')">Approve</button>
          <button class="secondary" style="flex:1;font-size:11.5px;padding:7px;color:#b91c1c;" onclick="accountsRejectCustomer('${c.id}')">Reject</button>
        </div>
      </div>`;
      }).join('');
  return `<div class="sales-card"><p style="font-weight:700;font-size:13px;margin-bottom:8px;">Pending Customers</p>${rows}</div>`;
}

function accountsApproveCustomer(customerId) {
  approveCustomer(customerId, 'Accounts');
  accountsAlert('✓ Customer approved.');
  renderAccountsBody();
}
function accountsRejectCustomer(customerId) {
  const comment = window.prompt('Reason for rejecting this customer:', '');
  if (comment === null) return;
  const result = rejectCustomer(customerId, 'Accounts', comment);
  if (result.error) { accountsAlert(result.error); return; }
  accountsAlert('✓ Customer rejected.');
  renderAccountsBody();
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

// ══════════════════════════════════════════
// BATCH 3 — GENERAL LEDGER (Chart of Accounts, Ledger, General Receipt,
// General Payment, Journal). Data model + validation lives in data.js
// (createAccountsGroup / createLedger / createGeneralReceipt /
// createGeneralPayment / createJournal) — this section is UI only.
// ══════════════════════════════════════════

function renderAccountsGroups() {
  const rows = accountsGroups.slice().sort((a, b) => a.sortOption - b.sortOption);
  return `
    <div class="sales-card">
      <p style="font-size:11.5px;color:#94a3b8;margin-bottom:8px;">The 15 system Primary groups are locked (no parent, not editable) — matches the live system exactly. Only the 11 custom sub-groups can be added to.</p>
      <button class="primary" style="width:100%;margin-bottom:10px;" onclick="acNewCustomGroup()">+ New Custom Group</button>
      <table class="sales-items"><tr><th>Group Name</th><th>Under</th><th>Classification</th></tr>
      ${rows.map(g => `<tr><td>${acEsc(g.name)}${g.isPrimary ? ' <span style="color:#94a3b8;font-size:10px;">(Primary)</span>' : ''}</td><td>${acEsc(g.under)}</td><td>${acEsc(g.classification)}</td></tr>`).join('')}
      </table>
    </div>`;
}

function acNewCustomGroup() {
  const name = prompt('New Group Name:');
  if (!name) return;
  const under = prompt('Under which Primary group?\n' + ACCOUNTS_PRIMARY_GROUPS.map(g => g.name).join(', '));
  if (!under) return;
  const result = createAccountsGroup({ name, under });
  if (result && result.error) { accountsAlert(result.error); return; }
  accountsAlert(`✓ ${result.name} added under ${result.under}`);
  renderAccountsBody();
}

function acLedgerOptionsHtml(selectedId = '') {
  return `<option value="">-Select-</option>` + ledgers.map(l =>
    `<option value="${l.id}" ${l.id === selectedId ? 'selected' : ''}>${acEsc(l.name)} (${l.code})</option>`).join('');
}

function renderLedgers() {
  const rows = ledgers.slice().sort((a, b) => a.code.localeCompare(b.code));
  return `
    <div class="sales-card">
      <button class="primary" style="width:100%;margin-bottom:10px;" onclick="accountsSetView('ledger-new')">+ New Ledger</button>
      <table class="sales-items"><tr><th>Ledger Code</th><th>Ledger Name</th><th>Accounts Group</th></tr>
      ${rows.map(l => `<tr><td>${l.code}</td><td>${acEsc(l.name)}</td><td>${acEsc(l.groupName)}</td></tr>`).join('')}
      </table>
    </div>`;
}

function renderLedgerForm() {
  const groupOptions = accountsGroups.slice().sort((a, b) => a.sortOption - b.sortOption)
    .map(g => `<option value="${acEsc(g.name)}">${acEsc(g.name)}${g.isPrimary ? ' (Primary)' : ''}</option>`).join('');
  return `
    <div class="sales-card">
      <p class="sales-back" onclick="accountsSetView('ledgers')">‹ Back to Ledgers</p>
      <p style="font-weight:700;font-size:13px;margin-bottom:10px;">New Ledger</p>
      <label style="font-size:11px;color:#64748b;">Ledger Name*</label>
      <input id="ac-lg-name" type="text" style="width:100%;padding:8px;margin:4px 0 10px;border:1px solid #e2e8f0;border-radius:6px;">
      <label style="font-size:11px;color:#64748b;">Under (Group)*</label>
      <select id="ac-lg-group" style="width:100%;padding:8px;margin:4px 0 10px;border:1px solid #e2e8f0;border-radius:6px;"><option value="">-Select-</option>${groupOptions}</select>
      <label style="font-size:11px;color:#64748b;">Taxability</label>
      <select id="ac-lg-tax" style="width:100%;padding:8px;margin:4px 0 10px;border:1px solid #e2e8f0;border-radius:6px;">${ACCOUNTS_TAXABILITY_OPTIONS.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
      <label style="font-size:11px;color:#64748b;">Opening Balance</label>
      <input id="ac-lg-opening" type="number" step="0.001" value="0" style="width:100%;padding:8px;margin:4px 0 10px;border:1px solid #e2e8f0;border-radius:6px;">
      <label style="font-size:11px;display:flex;align-items:center;gap:6px;margin-bottom:12px;"><input id="ac-lg-payroll" type="checkbox"> Is Payroll</label>
      <button class="primary" style="width:100%;" onclick="acSaveLedgerForm()">Save Ledger</button>
    </div>`;
}

function acSaveLedgerForm() {
  const result = createLedger({
    name: document.getElementById('ac-lg-name').value.trim(),
    groupName: document.getElementById('ac-lg-group').value,
    taxability: document.getElementById('ac-lg-tax').value,
    openingBalance: document.getElementById('ac-lg-opening').value,
    isPayroll: document.getElementById('ac-lg-payroll').checked
  });
  if (result && result.error) { accountsAlert(result.error); return; }
  accountsAlert(`✓ ${result.code} — ${result.name} created`);
  accountsSetView('ledgers');
}

// ── Shared 5-mode payment header (Cash/Bank/C Card/Wallet/Cheque) — used
// identically by General Receipt and General Payment, per the live trace.
function acMethodsBlockHtml(prefix) {
  const row = (key, label, extra = '') => `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <input type="checkbox" id="${prefix}-m-${key}-en" onchange="acRecalcAmount('${prefix}')">
      <span style="font-size:11.5px;width:52px;">${label}</span>
      <input type="number" step="0.001" id="${prefix}-m-${key}-amt" placeholder="Amt" oninput="acRecalcAmount('${prefix}')" style="width:90px;padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;">
      ${extra}
    </div>`;
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:12.5px;margin-bottom:8px;">Payment Mode</p>
      ${row('cash', 'Cash')}
      ${row('bank', 'Bank')}
      ${row('cCard', 'C Card')}
      ${row('wallet', 'Wallet')}
      ${row('cheque', 'Cheque')}
      <label style="font-size:11px;color:#64748b;">Amount (auto-summed)*</label>
      <input id="${prefix}-amount" type="number" step="0.001" readonly style="width:100%;padding:8px;margin:4px 0;border:1px solid #10b981;background:#F4FBF8;border-radius:6px;font-weight:700;">
    </div>`;
}
function acRecalcAmount(prefix) {
  const total = ['cash', 'bank', 'cCard', 'wallet', 'cheque'].reduce((s, k) => {
    const en = document.getElementById(`${prefix}-m-${k}-en`);
    const amt = document.getElementById(`${prefix}-m-${k}-amt`);
    return s + (en && en.checked ? (Number(amt.value) || 0) : 0);
  }, 0);
  const amountEl = document.getElementById(`${prefix}-amount`);
  if (amountEl) amountEl.value = total.toFixed(3);
}
function acReadMethods(prefix) {
  const methods = {};
  ['cash', 'bank', 'cCard', 'wallet', 'cheque'].forEach(k => {
    const en = document.getElementById(`${prefix}-m-${k}-en`);
    const amt = document.getElementById(`${prefix}-m-${k}-amt`);
    methods[k] = { enabled: !!(en && en.checked), amount: Number(amt && amt.value) || 0 };
  });
  return methods;
}

const AC_MAX_LINE_ROWS = 6;
function acAddLineRow(formType) {
  if (acVisibleLineRows >= AC_MAX_LINE_ROWS) return;
  const row = document.getElementById(`ac-row-${formType}-${acVisibleLineRows}`);
  if (row) row.style.display = '';
  acVisibleLineRows++;
}

// ── General Receipt ──
function renderGeneralReceipts() {
  const rows = generalReceipts.slice().sort((a, b) => b.id.localeCompare(a.id));
  return `
    <div class="sales-card">
      <button class="primary" style="width:100%;margin-bottom:10px;" onclick="accountsSetView('receipt-new')">+ New General Receipt</button>
      ${rows.length === 0 ? `<p style="font-size:12px;color:#64748b;">No General Receipts yet.</p>` :
        `<table class="sales-items"><tr><th>Receipt No</th><th>Date</th><th>Amount</th></tr>
        ${rows.map(r => `<tr><td>${r.id}</td><td>${r.date}</td><td>BD ${r.amount.toFixed(3)}</td></tr>`).join('')}
        </table>`}
    </div>`;
}

function acLineRowHtml(formType, i, withJob) {
  return `
    <tr id="ac-row-${formType}-${i}" style="display:${i === 0 ? '' : 'none'};">
      <td style="padding:4px;"><select id="ac-${formType}-ledger-${i}" style="width:100%;padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11.5px;">${acLedgerOptionsHtml()}</select></td>
      <td style="padding:4px;"><input id="ac-${formType}-amt-${i}" type="number" step="0.001" style="width:80px;padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11.5px;"></td>
      <td style="padding:4px;"><input id="ac-${formType}-narr-${i}" type="text" placeholder="Narration" style="width:100%;padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11.5px;"></td>
      ${withJob ? `<td style="padding:4px;"><input id="ac-${formType}-job-${i}" type="text" placeholder="Job No" style="width:90px;padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11.5px;"></td>` : ''}
    </tr>`;
}

function renderGeneralReceiptForm() {
  acVisibleLineRows = 1;
  const rowsHtml = Array.from({ length: AC_MAX_LINE_ROWS }, (_, i) => acLineRowHtml('gr', i, false)).join('');
  return `
    <div class="sales-card">
      <p class="sales-back" onclick="accountsSetView('receipts')">‹ Back to General Receipts</p>
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">New General Receipt</p>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Pure GL-coded receipt — no Customer/Invoice linkage. Ledger allocation lines below must total the Amount.</p>
    </div>
    ${acMethodsBlockHtml('gr')}
    <div class="sales-card">
      <p style="font-weight:700;font-size:12.5px;margin-bottom:8px;">Ledger Allocation</p>
      <table class="sales-items"><tr><th>Ledger</th><th>Amount</th><th>Narration</th></tr>${rowsHtml}</table>
      <button style="font-size:11px;background:none;border:1px solid #10b981;color:#10b981;border-radius:6px;padding:4px 10px;cursor:pointer;margin-bottom:10px;" onclick="acAddLineRow('gr')">+ Add Row</button>
      <label style="font-size:11px;color:#64748b;display:block;margin-top:8px;">Remarks</label>
      <textarea id="ac-gr-remarks" style="width:100%;padding:8px;margin:4px 0 10px;border:1px solid #e2e8f0;border-radius:6px;min-height:50px;"></textarea>
      <button class="primary" style="width:100%;" onclick="acSaveGeneralReceipt()">Create Receipt</button>
    </div>`;
}

function acCollectLines(formType, withJob) {
  const lines = [];
  for (let i = 0; i < acVisibleLineRows; i++) {
    const ledgerEl = document.getElementById(`ac-${formType}-ledger-${i}`);
    const amtEl = document.getElementById(`ac-${formType}-amt-${i}`);
    if (!ledgerEl || !ledgerEl.value || !amtEl || !Number(amtEl.value)) continue;
    const narrEl = document.getElementById(`ac-${formType}-narr-${i}`);
    const line = { ledgerId: ledgerEl.value, amount: Number(amtEl.value), narration: narrEl ? narrEl.value : '' };
    if (withJob) {
      const jobEl = document.getElementById(`ac-${formType}-job-${i}`);
      line.jobId = jobEl && jobEl.value ? jobEl.value.trim() : null;
    }
    lines.push(line);
  }
  return lines;
}

function acSaveGeneralReceipt() {
  const result = createGeneralReceipt({
    methods: acReadMethods('gr'),
    amount: document.getElementById('gr-amount').value,
    lines: acCollectLines('gr', false),
    remarks: document.getElementById('ac-gr-remarks').value
  });
  if (result && result.error) { accountsAlert(result.error); return; }
  accountsAlert(`✓ ${result.id} created`);
  accountsSetView('receipts');
}

// ── General Payment ──
function renderGeneralPayments() {
  const rows = generalPayments.slice().sort((a, b) => b.id.localeCompare(a.id));
  return `
    <div class="sales-card">
      <button class="primary" style="width:100%;margin-bottom:10px;" onclick="accountsSetView('payment-new')">+ New General Payment</button>
      ${rows.length === 0 ? `<p style="font-size:12px;color:#64748b;">No General Payments yet.</p>` :
        `<table class="sales-items"><tr><th>Payment No</th><th>Date</th><th>Amount</th><th>Status</th></tr>
        ${rows.map(p => `<tr style="${p.status === 'cancelled' ? 'background:#FEF2F2;color:#B91C1C;' : ''}"><td>${p.id}</td><td>${p.date}</td><td>BD ${p.amount.toFixed(3)}</td><td>${acEsc(p.status)}${p.status !== 'cancelled' ? ` <button style="font-size:10px;background:none;border:1px solid #B91C1C;color:#B91C1C;border-radius:6px;padding:2px 6px;cursor:pointer;" onclick="acCancelPayment('${p.id}')">Cancel</button>` : ''}</td></tr>`).join('')}
        </table>`}
    </div>`;
}

function renderGeneralPaymentForm() {
  acVisibleLineRows = 1;
  const rowsHtml = Array.from({ length: AC_MAX_LINE_ROWS }, (_, i) => acLineRowHtml('gp', i, true)).join('');
  return `
    <div class="sales-card">
      <p class="sales-back" onclick="accountsSetView('payments')">‹ Back to General Payments</p>
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">New General Payment</p>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">GL-coded payment — each line can optionally tie to a Job No (e.g. refunding a customer advance).</p>
    </div>
    ${acMethodsBlockHtml('gp')}
    <div class="sales-card">
      <p style="font-weight:700;font-size:12.5px;margin-bottom:8px;">Ledger Allocation</p>
      <table class="sales-items"><tr><th>Ledger</th><th>Amount</th><th>Narration</th><th>Job No</th></tr>${rowsHtml}</table>
      <button style="font-size:11px;background:none;border:1px solid #10b981;color:#10b981;border-radius:6px;padding:4px 10px;cursor:pointer;margin-bottom:10px;" onclick="acAddLineRow('gp')">+ Add Row</button>
      <label style="font-size:11px;color:#64748b;display:block;margin-top:8px;">Remarks</label>
      <textarea id="ac-gp-remarks" style="width:100%;padding:8px;margin:4px 0 10px;border:1px solid #e2e8f0;border-radius:6px;min-height:50px;"></textarea>
      <button class="primary" style="width:100%;" onclick="acSaveGeneralPayment()">Create Payment</button>
    </div>`;
}

function acSaveGeneralPayment() {
  const result = createGeneralPayment({
    methods: acReadMethods('gp'),
    amount: document.getElementById('gp-amount').value,
    lines: acCollectLines('gp', true),
    remarks: document.getElementById('ac-gp-remarks').value
  });
  if (result && result.error) { accountsAlert(result.error); return; }
  accountsAlert(`✓ ${result.id} created`);
  accountsSetView('payments');
}
function acCancelPayment(id) {
  cancelGeneralPayment(id);
  renderAccountsBody();
}

// ── Journal ──
function renderJournals() {
  const rows = journals.slice().sort((a, b) => b.id.localeCompare(a.id));
  return `
    <div class="sales-card">
      <button class="primary" style="width:100%;margin-bottom:10px;" onclick="accountsSetView('journal-new')">+ New Journal</button>
      ${rows.length === 0 ? `<p style="font-size:12px;color:#64748b;">No Journal entries yet.</p>` :
        `<table class="sales-items"><tr><th>JL No</th><th>Date</th><th>Debit</th><th>Credit</th><th>Status</th></tr>
        ${rows.map(j => `<tr style="${j.status === 'cancelled' ? 'background:#FEF2F2;color:#B91C1C;' : ''}"><td>${j.id}</td><td>${j.date}</td><td>BD ${j.drTotal.toFixed(3)}</td><td>BD ${j.crTotal.toFixed(3)}</td><td>${acEsc(j.status)}${j.status !== 'cancelled' ? ` <button style="font-size:10px;background:none;border:1px solid #B91C1C;color:#B91C1C;border-radius:6px;padding:2px 6px;cursor:pointer;" onclick="acCancelJournal('${j.id}')">Cancel</button>` : ''}</td></tr>`).join('')}
        </table>`}
    </div>`;
}

function acJournalRowHtml(i, visible) {
  return `
    <tr id="ac-row-jl-${i}" style="display:${visible ? '' : 'none'};">
      <td style="padding:4px;"><select id="ac-jl-ledger-${i}" style="width:100%;padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11.5px;">${acLedgerOptionsHtml()}</select></td>
      <td style="padding:4px;"><input id="ac-jl-dr-${i}" type="number" step="0.001" style="width:70px;padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11.5px;"></td>
      <td style="padding:4px;"><input id="ac-jl-cr-${i}" type="number" step="0.001" style="width:70px;padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11.5px;"></td>
      <td style="padding:4px;"><input id="ac-jl-narr-${i}" type="text" placeholder="Narration" style="width:100%;padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11.5px;"></td>
      <td style="padding:4px;"><input id="ac-jl-job-${i}" type="text" placeholder="Job No" style="width:80px;padding:5px;border:1px solid #e2e8f0;border-radius:6px;font-size:11.5px;"></td>
    </tr>`;
}

function renderJournalForm() {
  acVisibleLineRows = 2; // minimum 2 rows (DR/CR), matches the live system's default
  const rowsHtml = Array.from({ length: AC_MAX_LINE_ROWS }, (_, i) => acJournalRowHtml(i, i < 2)).join('');
  return `
    <div class="sales-card">
      <p class="sales-back" onclick="accountsSetView('journals')">‹ Back to Journal</p>
      <p style="font-weight:700;font-size:13px;margin-bottom:6px;">New Journal</p>
      <p style="font-size:11px;color:#94a3b8;margin-bottom:8px;">Free-form double entry — Debit total must equal Credit total, enforced on save.</p>
      <table class="sales-items"><tr><th>Ledger</th><th>DR</th><th>CR</th><th>Narration</th><th>Job No</th></tr>${rowsHtml}</table>
      <button style="font-size:11px;background:none;border:1px solid #10b981;color:#10b981;border-radius:6px;padding:4px 10px;cursor:pointer;margin-bottom:10px;" onclick="acAddLineRow('jl')">+ Add a new Row</button>
      <label style="font-size:11px;color:#64748b;display:block;margin-top:8px;">Remarks</label>
      <textarea id="ac-jl-remarks" style="width:100%;padding:8px;margin:4px 0 10px;border:1px solid #e2e8f0;border-radius:6px;min-height:50px;"></textarea>
      <button class="primary" style="width:100%;" onclick="acSaveJournal()">Create Journal</button>
    </div>`;
}

function acSaveJournal() {
  const lines = [];
  for (let i = 0; i < acVisibleLineRows; i++) {
    const ledgerEl = document.getElementById(`ac-jl-ledger-${i}`);
    const drEl = document.getElementById(`ac-jl-dr-${i}`);
    const crEl = document.getElementById(`ac-jl-cr-${i}`);
    if (!ledgerEl || !ledgerEl.value) continue;
    const narrEl = document.getElementById(`ac-jl-narr-${i}`);
    const jobEl = document.getElementById(`ac-jl-job-${i}`);
    lines.push({
      ledgerId: ledgerEl.value, dr: Number(drEl.value) || 0, cr: Number(crEl.value) || 0,
      narration: narrEl ? narrEl.value : '', jobId: jobEl && jobEl.value ? jobEl.value.trim() : null
    });
  }
  const result = createJournal({ lines, remarks: document.getElementById('ac-jl-remarks').value });
  if (result && result.error) { accountsAlert(result.error); return; }
  accountsAlert(`✓ ${result.id} created`);
  accountsSetView('journals');
}
function acCancelJournal(id) {
  cancelJournal(id);
  renderAccountsBody();
}

// ── VOUCHER LEDGER MAPPING (Batch 5) ──────────────────────
// Resolves each payment instrument used on Receipt/Payment/Credit-Note
// forms to a real Ledger — the config step Batch 3's notes flagged as
// missing. Not yet consumed by the existing Receipt/Payment/Credit Note/
// Debit Note forms elsewhere in the app (Purchasing's Supplier Payment,
// Sales' Receipt/Credit Note, this module's own General Receipt/Payment
// all still pick a ledger directly) — building the correct mapping here
// first, wiring it into those already-working flows is a documented
// follow-up rather than a same-pass change across 4+ forms.
function acLedgerNameOptionsHtml(selectedName = '') {
  return ledgers.map(l => `<option value="${acEsc(l.name)}" ${l.name === selectedName ? 'selected' : ''}>${acEsc(l.name)}</option>`).join('');
}
function acSetVoucherMapping(key, ledgerName) {
  const result = setVoucherLedgerMapping(key, ledgerName);
  if (result && result.error) { accountsAlert(result.error); return; }
  accountsAlert(`✓ ${key} → ${ledgerName}`);
  renderAccountsBody();
}
function renderVoucherLedgerMapping() {
  return `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Voucher Ledger Mapping</p>
      <p style="font-size:11.5px;color:#94a3b8;margin-bottom:10px;">Every payment instrument used on a Receipt/Payment/Credit Note voucher must resolve to a real Ledger before it can post correctly.</p>
      <table class="sales-items">
        <tr><th>Payment Instrument</th><th>Mapped Ledger</th></tr>
        ${VOUCHER_PAYMENT_METHODS.map(m => `<tr>
          <td>${acEsc(m.label)}</td>
          <td><select onchange="acSetVoucherMapping('${m.key}', this.value)" style="width:100%;padding:6px 8px;border:1px solid var(--biz-border);border-radius:6px;font-size:12.5px;font-family:inherit;">
            ${acLedgerNameOptionsHtml(voucherLedgerMap[m.key])}
          </select></td>
        </tr>`).join('')}
      </table>
    </div>`;
}

// ══════════════════════════════════════════
// BATCH 6 — REPORTS. Data/computation lives in data.js
// (getDayBookRows/getGLPostings/getLedgerBalance/getTrialBalance/
// getProfitAndLoss/getBalanceSheet) — this section is UI only, same split
// as the Batch 3 GL layer above.
// ══════════════════════════════════════════

function acReportFilterChanged(key, val) {
  acReportFilters[key] = key === 'ledgerWise' ? (val === 'true' || val === true) : val;
  renderAccountsBody();
}
function acFilterDateField(label, key, value) {
  return `<div style="flex:1;min-width:110px;"><label style="font-size:10.5px;color:#64748b;display:block;margin-bottom:3px;">${label}</label><input type="date" value="${value}" onchange="acReportFilterChanged('${key}',this.value)" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;box-sizing:border-box;"></div>`;
}
// Every report but Trial Balance defaults to the single real Division —
// Trial Balance is the one exception the live spec calls out ("- Select
// Division -" shown unselected by default), preserved here for fidelity.
function acDivisionFieldHtml(unselected = false) {
  return unselected
    ? `<div style="flex:1;min-width:140px;"><label style="font-size:10.5px;color:#64748b;display:block;margin-bottom:3px;">Division</label><select disabled style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;color:#94a3b8;"><option>- Select Division -</option></select></div>`
    : `<div style="flex:1;min-width:140px;"><label style="font-size:10.5px;color:#64748b;display:block;margin-bottom:3px;">Division</label><input type="text" value="Al Maraya Decor" disabled style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;box-sizing:border-box;color:#94a3b8;"></div>`;
}

function renderDayBookReport() {
  const f = acReportFilters;
  const rows = getDayBookRows({ voucherType: f.voucherType, from: f.dbFrom, to: f.dbTo });
  return `
    <div class="sales-card">
      <p style="font-size:11.5px;color:#94a3b8;margin-bottom:8px;">A consolidated transaction log spanning every voucher type across Sales, Purchases, and Accounts in one feed.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${acDivisionFieldHtml()}
        <div style="flex:2;min-width:160px;"><label style="font-size:10.5px;color:#64748b;display:block;margin-bottom:3px;">Voucher Type</label>
          <select onchange="acReportFilterChanged('voucherType',this.value)" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;">
            ${DAY_BOOK_VOUCHER_TYPES.map(t => `<option value="${t}" ${f.voucherType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        ${acFilterDateField('From Date', 'dbFrom', f.dbFrom)}
        ${acFilterDateField('To Date', 'dbTo', f.dbTo)}
      </div>
    </div>
    <div class="sales-card" style="overflow-x:auto;">
      ${rows.length === 0 ? `<p style="font-size:12px;color:#64748b;">No vouchers match these filters.</p>` :
        `<table class="sales-items"><tr><th>Voucher Type</th><th>Voucher No</th><th>Voucher Date</th><th>Client</th><th>Amount</th><th>Status</th></tr>
        ${rows.map(r => `<tr><td>${acEsc(r.type)}</td><td>${acEsc(r.no)}</td><td>${r.date}</td><td>${acEsc(r.client)}</td><td>BD ${(r.amount || 0).toFixed(3)}</td><td>${acEsc(r.status)}</td></tr>`).join('')}
        </table>`}
    </div>`;
}

function renderLedgerReportView() {
  const f = acReportFilters;
  const postings = f.ledgerName ? getGLPostings().filter(p => p.ledgerName === f.ledgerName && (!f.glFrom || p.date >= f.glFrom) && (!f.glTo || p.date <= f.glTo)) : [];
  return `
    <div class="sales-card">
      <p style="font-size:11.5px;color:#94a3b8;margin-bottom:8px;">Standard general-ledger transaction printout. Only Journal/General Receipt/General Payment postings appear here — Supplier Payment, Debit Note, Sales Receipt/Credit Note and Tax/Purchase Invoices don't post to a Ledger yet (see the Voucher Ledger Mapping tab).</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${acDivisionFieldHtml()}
        <div style="flex:2;min-width:160px;"><label style="font-size:10.5px;color:#64748b;display:block;margin-bottom:3px;">Ledger Name</label>
          <select onchange="acReportFilterChanged('ledgerName',this.value)" style="width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;">
            <option value="">- Select Ledger -</option>${ledgers.map(l => `<option value="${acEsc(l.name)}" ${f.ledgerName === l.name ? 'selected' : ''}>${acEsc(l.name)}</option>`).join('')}
          </select>
        </div>
        ${acFilterDateField('From Date', 'glFrom', f.glFrom)}
        ${acFilterDateField('To Date', 'glTo', f.glTo)}
      </div>
    </div>
    <div class="sales-card" style="overflow-x:auto;">
      ${!f.ledgerName ? `<p style="font-size:12px;color:#64748b;">Select a Ledger to view its transactions.</p>` :
        postings.length === 0 ? `<p style="font-size:12px;color:#64748b;">No transactions posted to ${acEsc(f.ledgerName)} in this range.</p>` :
        `<table class="sales-items"><tr><th>#</th><th>Date</th><th>Voucher</th><th>Voucher No</th><th>Voucher Ref</th><th>Debit</th><th>Credit</th><th>Narration</th></tr>
        ${postings.map((p, i) => `<tr><td>${i + 1}</td><td>${p.date}</td><td>${acEsc(p.voucherType)}</td><td>${acEsc(p.voucherNo)}</td><td>${acEsc(p.voucherRef)}</td><td>${p.dr ? 'BD ' + p.dr.toFixed(3) : ''}</td><td>${p.cr ? 'BD ' + p.cr.toFixed(3) : ''}</td><td>${acEsc(p.narration) || '—'}</td></tr>`).join('')}
        </table>`}
    </div>`;
}

function renderTrialBalanceView() {
  const f = acReportFilters;
  const rows = getTrialBalance({ from: f.glFrom, to: f.glTo, ledgerWise: f.ledgerWise });
  const fmt = n => (n < 0 ? '(' + Math.abs(n).toFixed(3) + ')' : n.toFixed(3));
  const totals = rows.reduce((s, r) => ({ debit: s.debit + r.debit, credit: s.credit + r.credit }), { debit: 0, credit: 0 });
  return `
    <div class="sales-card">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${acDivisionFieldHtml(true)}
        ${acFilterDateField('From Date', 'glFrom', f.glFrom)}
        ${acFilterDateField('To Date', 'glTo', f.glTo)}
        <div style="flex:1;min-width:140px;"><label style="font-size:10.5px;color:#64748b;display:block;margin-bottom:3px;">&nbsp;</label>
          <label style="font-size:12px;display:flex;align-items:center;gap:6px;padding:6px 0;"><input type="checkbox" ${f.ledgerWise ? 'checked' : ''} onchange="acReportFilterChanged('ledgerWise',this.checked)"> Ledger wise</label>
        </div>
      </div>
    </div>
    <div class="sales-card" style="overflow-x:auto;">
      ${rows.length === 0 ? `<p style="font-size:12px;color:#64748b;">No ledger activity in this range.</p>` :
        `<table class="sales-items"><tr><th>Particulars</th><th>Opening Balance</th><th>Debit</th><th>Credit</th><th>Closing Balance</th></tr>
        ${rows.map(r => `<tr><td>${acEsc(r.name)}</td><td>${fmt(r.opening)}</td><td>${r.debit.toFixed(3)}</td><td>${r.credit.toFixed(3)}</td><td>${fmt(r.closing)}</td></tr>`).join('')}
        <tr style="font-weight:700;"><td>Total</td><td></td><td>${totals.debit.toFixed(3)}</td><td>${totals.credit.toFixed(3)}</td><td></td></tr>
        </table>`}
    </div>`;
}

function renderProfitLossView() {
  const f = acReportFilters;
  const p = getProfitAndLoss({ from: f.glFrom, to: f.glTo });
  const zeroRed = n => `style="color:${n <= 0 ? '#B91C1C' : 'inherit'};font-weight:700;"`;
  return `
    <div class="sales-card">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${acFilterDateField('From Date', 'glFrom', f.glFrom)}
        ${acFilterDateField('To Date', 'glTo', f.glTo)}
      </div>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Trading Account</p>
      <table class="sales-items">
        <tr><td>Direct Incomes</td><td>${p.directIncome.toFixed(3)}</td></tr>
        <tr><td>Direct Expenses</td><td>${p.directExpense.toFixed(3)}</td></tr>
        <tr><td style="font-weight:700;">Gross Profit</td><td ${zeroRed(p.grossProfit)}>${p.grossProfit.toFixed(3)}</td></tr>
      </table>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Income Statement</p>
      <table class="sales-items">
        <tr><td>Gross Profit b/f</td><td>${p.grossProfit.toFixed(3)}</td></tr>
        <tr><td>Indirect Incomes</td><td>${p.indirectIncome.toFixed(3)}</td></tr>
        <tr><td>Indirect Expenses</td><td>${p.indirectExpense.toFixed(3)}</td></tr>
        <tr><td style="font-weight:700;">Net Profit</td><td ${zeroRed(p.netProfit)}>${p.netProfit.toFixed(3)}</td></tr>
      </table>
    </div>
    <div class="sales-card">
      <p style="font-size:11px;color:#94a3b8;">Direct Income/Expense read straight from Tax Invoices and received Purchase Invoices. Indirect Income/Expense come from the Journal/General Receipt/General Payment ledger layer — see the Ledger Report tab's note on why Sales/Purchase vouchers don't post to a Ledger.</p>
    </div>`;
}

function renderBalanceSheetView() {
  const bs = getBalanceSheet();
  return `
    <div class="sales-card">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Assets</p>
          ${bs.assets.length === 0 ? `<p style="font-size:12px;color:#64748b;">No asset balances.</p>` :
            `<table class="sales-items">${bs.assets.map(a => `<tr><td>${acEsc(a.name)}</td><td>${a.amount.toFixed(3)}</td></tr>`).join('')}
            <tr style="font-weight:700;"><td>Total</td><td>${bs.totalAssets.toFixed(3)}</td></tr></table>`}
        </div>
        <div>
          <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Liabilities</p>
          ${bs.liabilities.length === 0 ? `<p style="font-size:12px;color:#64748b;">No liability balances.</p>` :
            `<table class="sales-items">${bs.liabilities.map(a => `<tr><td>${acEsc(a.name)}</td><td>${a.amount.toFixed(3)}</td></tr>`).join('')}
            <tr style="font-weight:700;"><td>Total</td><td>${bs.totalLiabilities.toFixed(3)}</td></tr></table>`}
        </div>
      </div>
    </div>
    <div class="sales-card">
      <p style="font-size:11px;color:#94a3b8;">As-of-today snapshot, no date filter (matches the live report). Capital/retained-earnings roll-up from Profit &amp; Loss is not folded in — a flagged simplification, not an oversight.</p>
    </div>`;
}

// ══════════════════════════════════════════
// BATCH 7 — moved from sales.js (3 Aug 2026): Proforma, Sales Receipt,
// Sales Credit Note, Customer Update, and Sales Bill Outstanding are
// Accounts-only now, per Salman's direct instruction — Sales never
// creates/edits/deletes these, only views them read-only via
// renderRelatedRecords() (still in sales.js, called from both sales.js's
// Quotation Hub and jobs.js's Job Card hub, unchanged). Quotation Register
// Report stayed in Sales — it's Sales' own domain, not accounting.
// ══════════════════════════════════════════

// ── PROFORMA — Batch 4. List-only per the live trace: no manual create
// form exists there, Proforma is generated from the Job Card Management
// hub's own action (see createProformaFromJob() in data.js). ──
let acProformaJobSearch = '';
function acProformaSearchChanged(v) { acProformaJobSearch = v; renderAccountsBody(); }
// Proforma generation moved here from the Job Card hub (was
// jobsGenerateProforma() in jobs.js) — Salman's call, 3 Aug 2026: Jobs/
// Sales shouldn't be able to trigger creation of a financial document,
// only view it read-only via renderRelatedRecords().
function accountsGenerateProforma() {
  const jobId = acProformaJobSearch.trim();
  if (!jobId) { accountsAlert('Enter a Job No.'); return; }
  const p = createProformaFromJob(jobId);
  if (p.error) { accountsAlert(p.error); return; }
  accountsAlert(`✓ Proforma ${p.id} generated.`);
  acProformaJobSearch = '';
  renderAccountsBody();
}
function renderProformaList() {
  const rows = proformas.slice().sort((a, b) => b.date.localeCompare(a.date));
  const generateHtml = `
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">Generate Proforma</p>
      <div style="display:flex;gap:8px;">
        <input type="text" placeholder="Job No, e.g. JB26AMD01000" value="${acEsc(acProformaJobSearch)}" oninput="acProformaSearchChanged(this.value)" style="flex:1;padding:9px 11px;border:1px solid var(--biz-border);border-radius:8px;font-size:13px;font-family:inherit;">
        <button class="primary" onclick="accountsGenerateProforma()">Generate</button>
      </div>
    </div>`;
  if (rows.length === 0) {
    return generateHtml + `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No proforma invoices yet.</p></div>`;
  }
  return generateHtml + `<div class="sales-card" style="overflow-x:auto;">
    <table class="sales-items"><tr><th>Proforma</th><th>Qtn No</th><th>Date</th><th>Client</th><th>Amount</th></tr>
    ${rows.map(p => {
      const c = customers.find(x => x.id === p.customerId);
      return `<tr style="cursor:pointer;" onclick="closeAccountsModule();setTimeout(()=>launchJobsModule('${p.jobId}'),150);"><td>${acEsc(p.id)}</td><td>${acEsc(p.quotationId)}</td><td>${p.date}</td><td>${acEsc(c ? c.name : '—')}</td><td>${p.totals.netTotal.toFixed(3)}</td></tr>`;
    }).join('')}
    </table>
  </div>`;
}

// ── SALES RECEIPT — Batch 4. Customer-side, mirrors Purchasing's Supplier
// Payment (Batch 1) structurally. getCustomerOpenInvoices() (data.js)
// actually looks the client's open invoices up — the live system's "No
// Invoice List Available..!" bug is fixed here, not reproduced. ──
function renderSalesReceiptList() {
  let html = `<button class="primary" style="width:100%;margin-bottom:12px;" onclick="openSalesReceiptCreate()">+ New Receipt</button>`;
  if (salesReceipts.length === 0) {
    html += `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No receipts yet.</p></div>`;
  } else {
    html += `<div class="sales-card" style="overflow-x:auto;"><table class="sales-items"><tr><th>Receipt No</th><th>Client</th><th>Date</th><th>Amount</th></tr>
    ${salesReceipts.slice().reverse().map(r => {
      const c = customers.find(x => x.id === r.customerId);
      return `<tr><td>${acEsc(r.id)}</td><td>${acEsc(c ? c.name : '—')}</td><td>${r.receiptDate}</td><td>${r.amount.toFixed(3)}</td></tr>`;
    }).join('')}
    </table></div>`;
  }
  return html;
}

function openSalesReceiptCreate() {
  salesReceiptDraft = {
    customerId: '',
    methods: {
      cash: { enabled: false, amount: 0 },
      bank: { enabled: false, amount: 0, bank: '' },
      cCard: { enabled: false, amount: 0, type: 'Visa Card', authorized: '' },
      wallet: { enabled: false, amount: 0, type: 'B wallet', authorized: '' },
      cheque: { enabled: false, amount: 0, number: '', bank: '' }
    },
    referenceNumber: '', allocations: [], advanceAmount: 0, remarks: ''
  };
  accountsView = 'salesreceipt-new';
  renderAccountsBody();
}

function salesReceiptCustomerChanged(customerId) {
  salesReceiptDraft.customerId = customerId;
  salesReceiptDraft.allocations = customerId
    ? getCustomerOpenInvoices(customerId).map(row => ({ ...row, payingAmount: 0, discountAmount: 0 }))
    : [];
  renderAccountsBody();
}
function salesReceiptMethodToggle(method, checked) { salesReceiptDraft.methods[method].enabled = checked; renderAccountsBody(); }
function salesReceiptMethodField(method, field, val) { salesReceiptDraft.methods[method][field] = (field === 'amount') ? Number(val) || 0 : val; }
function salesReceiptAllocationChanged(i, field, val) { salesReceiptDraft.allocations[i][field] = Number(val) || 0; }

function renderSalesReceiptCreate() {
  const d = salesReceiptDraft;
  const c = customers.find(x => x.id === d.customerId);

  const methodBlock = (key, label, extraHtml) => `
    <div class="sales-field">
      <label><input type="checkbox" ${d.methods[key].enabled ? 'checked' : ''} onchange="salesReceiptMethodToggle('${key}',this.checked)"> ${label}</label>
      ${d.methods[key].enabled ? `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
        <input type="number" step="0.001" style="flex:1;" placeholder="Amount" value="${d.methods[key].amount}" onchange="salesReceiptMethodField('${key}','amount',this.value)">
        ${extraHtml || ''}
      </div>` : ''}
    </div>`;

  let reveal = '';
  if (d.customerId) {
    const allocHtml = d.allocations.length === 0
      ? `<p style="font-size:12px;color:#64748b;">No Invoice List Available..!</p>`
      : `<div style="overflow-x:auto;"><table class="sales-items"><tr><th>Invoice #</th><th>Date</th><th>Inv. Amt</th><th>Paid</th><th>Paying Amt</th><th>Disc</th><th>Balance</th></tr>
        ${d.allocations.map((a, i) => `<tr><td>${acEsc(a.invoiceId)}</td><td>${a.invoiceDate}</td><td>${a.invoiceAmount.toFixed(3)}</td><td>${a.paidAmount.toFixed(3)}</td>
          <td><input type="number" step="0.001" style="width:80px;" value="${a.payingAmount}" onchange="salesReceiptAllocationChanged(${i},'payingAmount',this.value)"></td>
          <td><input type="number" step="0.001" style="width:70px;" value="${a.discountAmount}" onchange="salesReceiptAllocationChanged(${i},'discountAmount',this.value)"></td>
          <td>${a.balanceAmount.toFixed(3)}</td></tr>`).join('')}
        </table></div>`;

    reveal = `
      <p style="font-size:12px;color:#64748b;margin-bottom:10px;">Client Name: ${acEsc(c ? c.name : '—')}</p>
      ${methodBlock('cash', 'Cash')}
      ${methodBlock('bank', 'Bank', `<input type="text" style="flex:1;" placeholder="Bank" value="${acEsc(d.methods.bank.bank)}" onchange="salesReceiptMethodField('bank','bank',this.value)">`)}
      ${methodBlock('cCard', 'C Card', `<select style="flex:1;" onchange="salesReceiptMethodField('cCard','type',this.value)"><option ${d.methods.cCard.type === 'Visa Card' ? 'selected' : ''}>Visa Card</option><option ${d.methods.cCard.type === 'Master Card' ? 'selected' : ''}>Master Card</option><option ${d.methods.cCard.type === 'Others' ? 'selected' : ''}>Others</option></select><input type="text" style="flex:1;" placeholder="Authorized" value="${acEsc(d.methods.cCard.authorized)}" onchange="salesReceiptMethodField('cCard','authorized',this.value)">`)}
      ${methodBlock('wallet', 'Wallet', `<select style="flex:1;" onchange="salesReceiptMethodField('wallet','type',this.value)"><option ${d.methods.wallet.type === 'B wallet' ? 'selected' : ''}>B wallet</option><option ${d.methods.wallet.type === 'IBAN' ? 'selected' : ''}>IBAN</option><option ${d.methods.wallet.type === 'Benefit' ? 'selected' : ''}>Benefit</option></select><input type="text" style="flex:1;" placeholder="Authorized" value="${acEsc(d.methods.wallet.authorized)}" onchange="salesReceiptMethodField('wallet','authorized',this.value)">`)}
      ${methodBlock('cheque', 'Cheque', `<input type="text" style="flex:1;" placeholder="Number" value="${acEsc(d.methods.cheque.number)}" onchange="salesReceiptMethodField('cheque','number',this.value)"><input type="text" style="flex:1;" placeholder="Bank" value="${acEsc(d.methods.cheque.bank)}" onchange="salesReceiptMethodField('cheque','bank',this.value)">`)}
      <div class="sales-field"><label>Amount *</label><input type="number" step="0.001" id="rc-amount"></div>
      <div class="sales-field"><label>Reference Number</label><input type="text" id="rc-reference"></div>
      <div class="sales-field"><label>Advance payment</label><input type="number" step="0.001" id="rc-advance" value="0"></div>
      <p style="font-weight:700;font-size:12px;margin:10px 0 4px;">Invoice Allocation</p>
      ${allocHtml}
      <div class="sales-field" style="margin-top:10px;"><label>Remarks</label><textarea id="rc-remarks"></textarea></div>
      <div style="display:flex;gap:8px;">
        <button class="primary" style="flex:1;" onclick="saveSalesReceipt()">Create Receipt</button>
        <button class="secondary" style="flex:1;" onclick="accountsView='salesreceipts';renderAccountsBody();">Exit</button>
      </div>`;
  }

  return `
    <span class="sales-back" onclick="accountsView='salesreceipts';renderAccountsBody();">‹ Back to Receipt List</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;margin-bottom:12px;">Create Receipt</p>
      <div class="sales-field"><label>Name</label>
        <select onchange="salesReceiptCustomerChanged(this.value)">
          <option value="">Select client…</option>
          ${customers.map(x => `<option value="${x.id}" ${d.customerId === x.id ? 'selected' : ''}>${acEsc(x.name)}</option>`).join('')}
        </select>
      </div>
      ${reveal}
    </div>`;
}

function saveSalesReceipt() {
  const d = salesReceiptDraft;
  const amount = Number(document.getElementById('rc-amount').value) || 0;
  const referenceNumber = document.getElementById('rc-reference').value.trim();
  const advanceAmount = Number(document.getElementById('rc-advance').value) || 0;
  const remarks = document.getElementById('rc-remarks').value.trim();
  if (!d.customerId) { accountsAlert('Please select a client.'); return; }
  if (!amount) { accountsAlert('Amount is required.'); return; }
  const result = createSalesReceipt({
    customerId: d.customerId, methods: d.methods, amount, referenceNumber,
    allocations: d.allocations.filter(a => a.payingAmount > 0), advanceAmount, remarks
  });
  if (result.error) { accountsAlert(result.error); return; }
  accountsAlert(`✓ Receipt ${result.id} created.`);
  salesReceiptDraft = null;
  accountsView = 'salesreceipts';
  renderAccountsBody();
}

// ── SALES CREDIT NOTE — Batch 4. Same two-stage pattern as Receipt (client
// first, then an invoice-allocation table). List view uses the red/pink
// cancelled-row convention observed live and used elsewhere in this app. ──
function renderSalesCreditNoteList() {
  let html = `<button class="primary" style="width:100%;margin-bottom:12px;" onclick="openSalesCreditNoteCreate()">+ New Credit Note</button>`;
  if (salesCreditNotes.length === 0) {
    html += `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No credit notes yet.</p></div>`;
  } else {
    html += `<div class="sales-card" style="overflow-x:auto;"><table class="sales-items"><tr><th>Credit Note No</th><th>Client</th><th>Date</th><th>Amount</th><th>Action</th></tr>
    ${salesCreditNotes.slice().reverse().map(cn => {
      const c = customers.find(x => x.id === cn.customerId);
      return `<tr style="${cn.status === 'cancelled' ? 'background:#fee2e2;' : ''}"><td>${acEsc(cn.id)}</td><td>${acEsc(c ? c.name : '—')}</td><td>${cn.creditNoteDate}</td><td>${cn.amount.toFixed(3)}</td>
        <td>${cn.status === 'cancelled' ? 'Cancelled' : `<span style="cursor:pointer;color:#b91c1c;" onclick="salesCancelCreditNote('${cn.id}')">Cancel</span>`}</td></tr>`;
    }).join('')}
    </table></div>`;
  }
  return html;
}

function salesCancelCreditNote(id) {
  if (!window.confirm('Cancel this credit note?')) return;
  cancelSalesCreditNote(id);
  accountsAlert('✓ Credit Note cancelled.');
  renderAccountsBody();
}

function openSalesCreditNoteCreate() {
  salesCreditNoteDraft = { customerId: '', allocations: [], reason: '' };
  accountsView = 'creditnote-new';
  renderAccountsBody();
}
function salesCreditNoteCustomerChanged(customerId) {
  salesCreditNoteDraft.customerId = customerId;
  salesCreditNoteDraft.allocations = customerId
    ? getCustomerOpenInvoices(customerId).map(row => ({ ...row, creditingAmount: 0 }))
    : [];
  renderAccountsBody();
}
function salesCreditNoteAllocationChanged(i, val) { salesCreditNoteDraft.allocations[i].creditingAmount = Number(val) || 0; }

function renderSalesCreditNoteCreate() {
  const d = salesCreditNoteDraft;
  const c = customers.find(x => x.id === d.customerId);

  let reveal = '';
  if (d.customerId) {
    const allocHtml = d.allocations.length === 0
      ? `<p style="font-size:12px;color:#64748b;">No Invoice List Available..!</p>`
      : `<div style="overflow-x:auto;"><table class="sales-items"><tr><th>Invoice #</th><th>Date</th><th>Inv. Amt</th><th>Balance</th><th>Crediting Amt</th></tr>
        ${d.allocations.map((a, i) => `<tr><td>${acEsc(a.invoiceId)}</td><td>${a.invoiceDate}</td><td>${a.invoiceAmount.toFixed(3)}</td><td>${a.balanceAmount.toFixed(3)}</td>
          <td><input type="number" step="0.001" style="width:80px;" value="${a.creditingAmount}" onchange="salesCreditNoteAllocationChanged(${i},this.value)"></td></tr>`).join('')}
        </table></div>`;

    reveal = `
      <p style="font-size:12px;color:#64748b;margin-bottom:10px;">Client Name: ${acEsc(c ? c.name : '—')}</p>
      <p style="font-weight:700;font-size:12px;margin:6px 0 4px;">Invoice Allocation</p>
      ${allocHtml}
      <div class="sales-field" style="margin-top:10px;"><label>Amount *</label><input type="number" step="0.001" id="cn-amount"></div>
      <div class="sales-field"><label>Reason</label><textarea id="cn-reason"></textarea></div>
      <div style="display:flex;gap:8px;">
        <button class="primary" style="flex:1;" onclick="saveSalesCreditNote()">Create Credit Note</button>
        <button class="secondary" style="flex:1;" onclick="accountsView='creditnotes';renderAccountsBody();">Exit</button>
      </div>`;
  }

  return `
    <span class="sales-back" onclick="accountsView='creditnotes';renderAccountsBody();">‹ Back to Credit Note List</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:14px;margin-bottom:12px;">Create Credit Note</p>
      <div class="sales-field"><label>Name</label>
        <select onchange="salesCreditNoteCustomerChanged(this.value)">
          <option value="">Select client…</option>
          ${customers.map(x => `<option value="${x.id}" ${d.customerId === x.id ? 'selected' : ''}>${acEsc(x.name)}</option>`).join('')}
        </select>
      </div>
      ${reveal}
    </div>`;
}

function saveSalesCreditNote() {
  const d = salesCreditNoteDraft;
  const amount = Number(document.getElementById('cn-amount').value) || 0;
  const reason = document.getElementById('cn-reason').value.trim();
  if (!d.customerId) { accountsAlert('Please select a client.'); return; }
  if (!amount) { accountsAlert('Amount is required.'); return; }
  const result = createSalesCreditNote({
    customerId: d.customerId, amount,
    allocations: d.allocations.filter(a => a.creditingAmount > 0), reason
  });
  if (result.error) { accountsAlert(result.error); return; }
  accountsAlert(`✓ Credit Note ${result.id} created.`);
  salesCreditNoteDraft = null;
  accountsView = 'creditnotes';
  renderAccountsBody();
}

// ── CUSTOMER UPDATE (Q-Pro Batch 5) — a single-quotation correction
// utility, not a customer master editor. Pick one quotation, then apply
// any of three independent corrections against it. ──
function renderCustomerUpdateTool() {
  if (!custUpdateQtnId) {
    const q = custUpdateSearch.trim().toLowerCase();
    const rows = quotations.filter(qt => !q || qt.id.toLowerCase().includes(q) || custName(qt.customerId).toLowerCase().includes(q))
      .slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
    return `
      <div class="sales-card">
        <p style="font-weight:700;font-size:13px;margin-bottom:4px;">Customer Update</p>
        <p style="font-size:11.5px;color:#94a3b8;margin-bottom:10px;">Select Quotation, then correct Customer, Salesman or VAT% against it — without re-keying the whole quotation.</p>
        <input type="text" placeholder="Search Qtn No or Customer…" value="${acEsc(custUpdateSearch)}"
          oninput="custUpdateSearch=this.value;renderAccountsBody();"
          style="width:100%;padding:9px 12px;border:1px solid var(--biz-border);border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit;">
      </div>
      ${rows.length === 0 ? `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No matching quotations.</p></div>` :
        rows.map(qt => `<div class="sales-card" style="cursor:pointer;" onclick="custUpdateQtnId='${qt.id}';renderAccountsBody();">
          <p style="font-weight:700;font-size:13px;">${qt.id} <span style="font-weight:400;color:#94a3b8;">· ${qt.date}</span></p>
          <p style="font-size:12px;color:#334155;">${acEsc(custName(qt.customerId))} · ${acEsc(qt.projectName)}</p>
        </div>`).join('')}`;
  }

  const qtn = quotations.find(qt => qt.id === custUpdateQtnId);
  if (!qtn) { custUpdateQtnId = null; return renderCustomerUpdateTool(); }
  const enq = enquiries.find(e => e.id === qtn.enquiryId);
  return `
    <span class="sales-back" onclick="custUpdateQtnId=null;renderAccountsBody();">‹ Back to search</span>
    <div class="sales-card">
      <p style="font-weight:700;font-size:15px;">${qtn.id}</p>
      <p style="font-size:12px;color:var(--biz-text-muted, #64748b);">${acEsc(custName(qtn.customerId))} · ${acEsc(qtn.projectName)}</p>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">(a) Update Customer</p>
      <div class="sales-field"><label>Select Customer</label>
        <select id="cu-customer">${customers.map(c => `<option value="${c.id}" ${c.id === qtn.customerId ? 'selected' : ''}>${acEsc(c.name)}</option>`).join('')}</select>
      </div>
      <div class="sales-field"><label>Select Contact Person</label>
        <input type="text" id="cu-contact" value="${acEsc(qtn.contactPerson || '')}">
      </div>
      <button class="primary" onclick="custUpdateApplyCustomer()">Update Customer</button>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">(b) Update Salesman</p>
      <div class="sales-field"><label>Sales Person Assigned</label>
        <select id="cu-salesman">${STAFF.map(s => `<option value="${s}" ${enq && enq.salesPerson === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
      <button class="primary" onclick="custUpdateApplySalesman()">Update Salesman</button>
    </div>
    <div class="sales-card">
      <p style="font-weight:700;font-size:13px;margin-bottom:8px;">(c) Update VAT</p>
      <div class="sales-field"><label>VAT %</label>
        <select id="cu-vat">${[10, 5, 0].map(v => `<option value="${v}" ${qtn.taxPercent === v ? 'selected' : ''}>${v}%</option>`).join('')}</select>
      </div>
      <button class="primary" onclick="custUpdateApplyVat()">Update VAT</button>
    </div>`;
}
function custUpdateApplyCustomer() {
  const customerId = document.getElementById('cu-customer').value;
  const contactPerson = document.getElementById('cu-contact').value;
  const result = applyCustomerUpdate(custUpdateQtnId, { customerId, contactPerson });
  if (result && result.error) { accountsAlert(result.error); return; }
  accountsAlert('✓ Customer updated.');
  renderAccountsBody();
}
function custUpdateApplySalesman() {
  const salesPerson = document.getElementById('cu-salesman').value;
  const result = applyCustomerUpdate(custUpdateQtnId, { salesPerson });
  if (result && result.error) { accountsAlert(result.error); return; }
  accountsAlert('✓ Salesman updated.');
  renderAccountsBody();
}
function custUpdateApplyVat() {
  const taxPercent = document.getElementById('cu-vat').value;
  const result = applyCustomerUpdate(custUpdateQtnId, { taxPercent });
  if (result && result.error) { accountsAlert(result.error); return; }
  accountsAlert('✓ VAT updated.');
  renderAccountsBody();
}

// ── SALES BILL OUTSTANDING (Batch 6, moved here Batch 7) ──
function billPillClass(status) {
  return status === 'Fully Paid' ? 'full' : status === 'Partially Paid' ? 'partial' : status === 'Advance' ? 'advance' : status === 'Cancelled' ? 'cancelled' : 'unpaid';
}
function salesBillOSFilterChanged(key, val) { salesBillOSFilters[key] = val; renderAccountsBody(); }
function billOSLegendHtml() {
  return `<p style="font-size:10.5px;color:#94a3b8;margin-top:8px;">Legend:
    <span class="bill-pill advance">Advance</span> <span class="bill-pill unpaid">Unpaid</span>
    <span class="bill-pill partial">Partially Paid</span> <span class="bill-pill full">Fully Paid</span>
    <span class="bill-pill cancelled">Cancelled</span></p>`;
}

function renderSalesBillOutstanding() {
  const f = salesBillOSFilters;
  const opts = { ageBasis: f.ageBasis };
  let rows, buckets = false;
  if (f.view === 'all') {
    rows = f.ageWise ? getSalesBillOutstandingAllCustomersAgeWise(opts) : getSalesBillOutstandingAllCustomers();
    buckets = f.ageWise;
  } else {
    rows = f.ageWise ? getSalesBillOutstandingByPartyAgeWise(opts) : getSalesBillOutstandingByParty(opts);
    buckets = f.ageWise;
  }
  if (f.client) rows = rows.filter(r => custName(r.customerId).toLowerCase().includes(f.client.toLowerCase()));
  if (f.salesPerson && f.view === 'byparty') rows = rows.filter(r => r.salesPerson === f.salesPerson);
  const outstandingTotal = rows.reduce((s, r) => s + r.balAmt, 0);

  const filterHtml = `
    <div class="sales-card">
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button class="sales-tabbtn ${f.view === 'byparty' ? 'active' : ''}" onclick="salesBillOSFilterChanged('view','byparty')">By Party</button>
        <button class="sales-tabbtn ${f.view === 'all' ? 'active' : ''}" onclick="salesBillOSFilterChanged('view','all')">All</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="sales-field" style="margin-bottom:0;"><label>Division</label><input type="text" value="Al Maraya Decor" disabled></div>
        <div class="sales-field" style="margin-bottom:0;"><label>Client Name</label><input type="text" value="${f.client || ''}" oninput="salesBillOSFilterChanged('client',this.value)"></div>
      </div>
      ${f.view === 'byparty' ? `
      <div class="sales-field" style="margin-top:8px;margin-bottom:0;"><label>Select Salesman</label>
        <select onchange="salesBillOSFilterChanged('salesPerson',this.value)">
          <option value="">All</option>${STAFF.map(s => `<option value="${s}" ${f.salesPerson === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>` : ''}
      <div style="display:flex;gap:14px;align-items:center;margin-top:10px;flex-wrap:wrap;">
        <label style="font-size:12px;display:flex;align-items:center;gap:6px;"><input type="checkbox" ${f.ageWise ? 'checked' : ''} onchange="salesBillOSFilterChanged('ageWise',this.checked)"> Age-wise</label>
        ${!f.ageWise ? `
        <label style="font-size:12px;display:flex;align-items:center;gap:6px;"><input type="radio" name="ageBasis" ${f.ageBasis === 'bill' ? 'checked' : ''} onchange="salesBillOSFilterChanged('ageBasis','bill')"> Age by Bill Date</label>
        <label style="font-size:12px;display:flex;align-items:center;gap:6px;"><input type="radio" name="ageBasis" ${f.ageBasis === 'due' ? 'checked' : ''} onchange="salesBillOSFilterChanged('ageBasis','due')"> Age by Due Date</label>` : ''}
      </div>
      ${billOSLegendHtml()}
    </div>
    <div class="sales-card"><p style="font-weight:700;font-size:13px;">Outstanding Amount: BD ${outstandingTotal.toFixed(3)}</p></div>`;

  let tableHtml;
  if (rows.length === 0) {
    tableHtml = `<div class="sales-card"><p style="font-size:12.5px;color:#64748b;">No outstanding bills match these filters.</p></div>`;
  } else if (f.view === 'byparty' && !buckets) {
    tableHtml = `<div class="sales-card" style="overflow-x:auto;"><table class="sales-items"><tr><th>#</th><th>Bill No</th><th>Bill Type</th><th>Date</th><th>PO No</th><th>Salesman</th><th>Bill Amt</th><th>Paid Amt</th><th>Bal Amt</th><th>Age</th><th>Status</th></tr>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${acEsc(r.invoiceId)}</td><td>Tax Invoice</td><td>${r.date}</td><td>${acEsc(r.lpoNo) || '—'}</td><td>${acEsc(r.salesPerson) || '—'}</td><td>${r.billAmt.toFixed(3)}</td><td>${r.paidAmt.toFixed(3)}</td><td>${r.balAmt.toFixed(3)}</td><td>${r.age}</td><td><span class="bill-pill ${billPillClass(billOutstandingStatus(r.billAmt, r.paidAmt))}">${billOutstandingStatus(r.billAmt, r.paidAmt)}</span></td></tr>`).join('')}
      </table></div>`;
  } else if (f.view === 'byparty' && buckets) {
    tableHtml = `<div class="sales-card" style="overflow-x:auto;"><table class="sales-items"><tr><th>#</th><th>Bill No</th><th>Date</th><th>Client</th><th>Bal Amt</th><th>${BILL_AGE_BUCKETS.map(b => b.label).join('</th><th>')}</th><th>Due On</th></tr>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${acEsc(r.invoiceId)}</td><td>${r.date}</td><td>${acEsc(custName(r.customerId))}</td><td>${r.balAmt.toFixed(3)}</td>${BILL_AGE_BUCKETS.map(b => `<td>${r.buckets[b.key] ? r.buckets[b.key].toFixed(3) : ''}</td>`).join('')}<td>${r.dueDate}</td></tr>`).join('')}
      </table></div>`;
  } else if (f.view === 'all' && !buckets) {
    tableHtml = `<div class="sales-card" style="overflow-x:auto;"><table class="sales-items"><tr><th>#</th><th>Client</th><th>Bill Amt</th><th>Paid Amt</th><th>Bal Amt</th><th>Status</th></tr>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${acEsc(custName(r.customerId))}</td><td>${r.billAmt.toFixed(3)}</td><td>${r.paidAmt.toFixed(3)}</td><td>${r.balAmt.toFixed(3)}</td><td><span class="bill-pill ${billPillClass(billOutstandingStatus(r.billAmt, r.paidAmt))}">${billOutstandingStatus(r.billAmt, r.paidAmt)}</span></td></tr>`).join('')}
      </table></div>`;
  } else {
    tableHtml = `<div class="sales-card" style="overflow-x:auto;"><table class="sales-items"><tr><th>#</th><th>Client</th><th>Bal Amt</th><th>${BILL_AGE_BUCKETS.map(b => b.label).join('</th><th>')}</th></tr>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${acEsc(custName(r.customerId))}</td><td>${r.balAmt.toFixed(3)}</td>${BILL_AGE_BUCKETS.map(b => `<td>${r.buckets[b.key] ? r.buckets[b.key].toFixed(3) : ''}</td>`).join('')}</tr>`).join('')}
      </table></div>`;
  }

  return filterHtml + tableHtml;
}
