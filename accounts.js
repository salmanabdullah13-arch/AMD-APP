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
#accounts-module-wrap table.sales-items tr:hover td{background:#FAFBFD;}
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

let accountsView = 'dashboard'; // dashboard | invoices | purchases | coa | ledgers | ledger-new | receipts | receipt-new | payments | payment-new | journals | journal-new
let acVisibleLineRows = 1; // shared row-count for whichever line-entry form (Receipt/Payment/Journal) is currently open

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
    </div>`;
  let content = '';
  if (accountsView === 'dashboard') content = renderAccountsDashboard();
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
