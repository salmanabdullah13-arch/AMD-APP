// ══════════════════════════════════════════
// PRINT / PREVIEW MODULE
// Shared across Sales/Estimator/Approver — one dialog, one document
// builder, not four separate "print types". Deliberately NOT modeled on
// the legacy Q-Pro "Approver Print" screen (see CLAUDE.md's 3 Aug 2026
// session log) — that screen was actually the live edit page with a print
// stylesheet slapped on (editable Cost cells, delete icons, a live
// comment box, zero audit trail). This is a real snapshot: a static HTML
// document opened in a new tab via Blob + object URL, no server, no PDF
// library — the user's own browser Print -> Save as PDF handles the PDF
// case, matching this app's zero-dependency, static-hosting architecture.
// Nothing rendered here is ever editable — any real correction happens in
// the real Sales/Estimator/Approver flows, never on this screen.
// Loads right after data.js — only depends on data.js (quotations,
// customers, computeQuoteHierarchy, computeBOMTotals), not on any other
// module file.
// ══════════════════════════════════════════

const PRINT_COMPANY = {
  name: "AL MARAYA DECOR MATERIAL CO. W.L.L.",
  trn: "200020059800002",
  cr: "84635-01,02,05",
  address: "P.O.Box 54348, Shop 33A, Road 3601, Block 336, Adliya, Kingdom of Bahrain",
  tel: "+973 17211862",
  email: "info@almarayadecor.com",
  web: "www.almarayadecor.com",
  bankName: "BANK OF BAHRAIN & KUWAIT (BBK)",
  bankAccountName: "AL MARAYA DECOR MATERIAL CO WLL",
  bankAccountNo: "100000338407",
  iban: "BH54-BBKU-0010-0000-3384-07"
};

function prEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

let printQtnId = null;
let printAllowInternalCost = false;
let printSettings = { audience: 'client', withImage: false, withoutGroupTotal: false, withoutSubTotal: false, withoutVat: false };

const printModalStyleTag = document.createElement('style');
printModalStyleTag.textContent = `
#print-modal-wrap{display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:400;background:rgba(15,23,42,.55);align-items:center;justify-content:center;padding:20px;}
#print-modal-inner{background:#fff;border-radius:14px;padding:18px;width:100%;max-width:420px;box-sizing:border-box;max-height:85vh;overflow-y:auto;font-family:var(--font-biz);}
#print-modal-inner label{display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:8px;color:#334155;}
#print-modal-inner select{width:100%;padding:9px 11px;border:1px solid var(--biz-border);border-radius:8px;font-size:13px;font-family:inherit;margin-bottom:10px;}
#print-modal-inner button.primary{background:var(--biz-primary);color:#fff;border:0;border-radius:8px;padding:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
#print-modal-inner button.secondary{background:#f1f5f9;border:1px solid var(--biz-border);border-radius:8px;color:#64748b;font-size:13px;padding:9px;cursor:pointer;font-family:inherit;}
`;
document.head.appendChild(printModalStyleTag);

const printModalWrap = document.createElement('div');
printModalWrap.id = 'print-modal-wrap';
printModalWrap.innerHTML = `<div id="print-modal-inner"></div>`;
document.body.appendChild(printModalWrap);

// allowInternalCost: whether the Internal Cost Review audience option is
// even offered — callers in sales.js/estimator.js always pass false,
// approver.js passes true. Matches who already sees cost/profit today.
function openPrintDialog(qtnId, allowInternalCost) {
  printQtnId = qtnId;
  printAllowInternalCost = !!allowInternalCost;
  printSettings = { audience: 'client', withImage: false, withoutGroupTotal: false, withoutSubTotal: false, withoutVat: false };
  renderPrintDialog();
  printModalWrap.style.display = 'flex';
}
function closePrintDialog() { printModalWrap.style.display = 'none'; }

function renderPrintDialog() {
  const inner = document.getElementById('print-modal-inner');
  inner.innerHTML = `
    <p style="font-weight:700;font-size:15px;margin-bottom:10px;color:#1a1f2e;">Print / Preview</p>
    ${printAllowInternalCost ? `
    <label style="display:block;">Audience
      <select onchange="printSettings.audience=this.value;">
        <option value="client" ${printSettings.audience === 'client' ? 'selected' : ''}>Client Quotation</option>
        <option value="internal" ${printSettings.audience === 'internal' ? 'selected' : ''}>Internal Cost Review</option>
      </select>
    </label>` : ''}
    <label><input type="checkbox" onchange="printSettings.withImage=this.checked;"> With Image</label>
    <label><input type="checkbox" onchange="printSettings.withoutGroupTotal=this.checked;"> Without Group Total</label>
    <label><input type="checkbox" onchange="printSettings.withoutSubTotal=this.checked;"> Without Sub Total</label>
    <label><input type="checkbox" onchange="printSettings.withoutVat=this.checked;"> Without VAT</label>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="primary" style="flex:1;" onclick="printGenerate()">Generate</button>
      <button class="secondary" style="flex:1;" onclick="closePrintDialog()">Cancel</button>
    </div>`;
}

function printGenerate() {
  const qtn = quotations.find(q => q.id === printQtnId);
  if (!qtn) return;
  const html = buildQuotationPrintHTML(qtn, printSettings);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  closePrintDialog();
}

// Builds the full static HTML document — company letterhead, Submitted To,
// grouped line items (reusing computeQuoteHierarchy() for the same
// Group/Sub Group headers and serials Sales/Estimator already see live),
// group/sub-group/grand totals, VAT, and either client Terms/signature
// blocks or an internal Cost/Profit summary. Every cell here is plain
// text — no inputs, no onclick handlers, nothing editable.
function buildQuotationPrintHTML(qtn, settings) {
  const c = customers.find(x => x.id === qtn.customerId);
  const enq = enquiries.find(e => e.id === qtn.enquiryId);
  const isInternal = settings.audience === 'internal';
  const hierarchy = computeQuoteHierarchy(qtn.items);
  const colCount = 5 + (settings.withImage ? 1 : 0) + (isInternal ? 3 : 0);

  let bodyRows = '';
  let subTotal = 0, groupTotal = 0;
  let grandAmount = 0, grandDisc = 0, grandNet = 0, grandCost = 0;

  hierarchy.forEach((h, i) => {
    const it = h.item;
    const next = hierarchy[i + 1];
    const isLastInSub = !next || next.isNewSubgroup;
    const isLastInGroup = !next || next.isNewGroup;

    if (h.isNewGroup && it.group) bodyRows += `<tr class="grp-row"><td colspan="${colCount}">${prEsc(it.group)}</td></tr>`;
    if (h.isNewSubgroup && it.subgroup) bodyRows += `<tr class="sub-row"><td colspan="${colCount}">${h.groupNo}.${h.subgroupNo} ${prEsc(it.subgroup)}</td></tr>`;

    let cost = 0, profit = 0, profitPct = '—';
    if (isInternal && it.bom) {
      const t = computeBOMTotals(it.bom);
      cost = t.totalCostInclOH;
      profit = it.rate * it.qty - cost;
      profitPct = cost > 0 ? (profit / cost * 100).toFixed(1) + '%' : '—';
    }

    bodyRows += `<tr>
      <td>${h.serial}</td>
      ${settings.withImage ? `<td class="img-cell">—</td>` : ''}
      <td>${prEsc(it.product)}${it.description ? `<div class="desc">${prEsc(it.description).replace(/\n/g, '<br>')}</div>` : ''}</td>
      <td>${it.qty}</td>
      <td>${it.rate.toFixed(3)}/${prEsc(it.unit)}</td>
      <td>${it.amount.toFixed(3)}</td>
      ${isInternal ? `<td>${it.bom ? cost.toFixed(3) : '—'}</td><td>${it.bom ? profit.toFixed(3) : '—'}</td><td>${profitPct}</td>` : ''}
    </tr>`;

    subTotal += it.amount; groupTotal += it.amount;
    grandAmount += it.amount; grandDisc += it.discAmt; grandNet += it.netAmount;
    if (isInternal && it.bom) grandCost += cost;

    if (isLastInSub && !settings.withoutSubTotal && it.subgroup) {
      bodyRows += `<tr class="total-row"><td colspan="${colCount - 1}">${prEsc(it.subgroup)} Total</td><td>BD ${subTotal.toFixed(3)}</td></tr>`;
    }
    if (isLastInSub) subTotal = 0;
    if (isLastInGroup && !settings.withoutGroupTotal && it.group) {
      bodyRows += `<tr class="total-row group-total"><td colspan="${colCount - 1}">${prEsc(it.group)} Total</td><td>BD ${groupTotal.toFixed(3)}</td></tr>`;
    }
    if (isLastInGroup) groupTotal = 0;
  });

  const grandSubtotal = grandAmount - grandDisc;
  const vatTotal = grandNet - grandSubtotal;
  const profitTotal = grandSubtotal - grandCost;
  const profitPctTotal = grandCost > 0 ? (profitTotal / grandCost * 100).toFixed(1) + '%' : '—';

  const headerCols = `<th>#</th>${settings.withImage ? '<th>Image</th>' : ''}<th>Item Description</th><th>Qty</th><th>Price</th><th>Amount</th>${isInternal ? '<th>Cost</th><th>Profit</th><th>Profit%</th>' : ''}`;

  const footer = isInternal ? `
    <table class="totals-table">
      <tr><td>Quote Value</td><td>BD ${grandSubtotal.toFixed(3)}</td></tr>
      <tr><td>Cost</td><td>BD ${grandCost.toFixed(3)}</td></tr>
      <tr><td>Profit (${profitPctTotal})</td><td>BD ${profitTotal.toFixed(3)}</td></tr>
      ${!settings.withoutVat ? `<tr><td>VAT</td><td>BD ${vatTotal.toFixed(3)}</td></tr>` : ''}
      <tr class="grand"><td>Grand Total</td><td>BD ${(settings.withoutVat ? grandSubtotal : grandNet).toFixed(3)}</td></tr>
    </table>
    <p class="internal-note">INTERNAL COST REVIEW — not for client distribution.</p>`
    : `
    <table class="totals-table">
      ${!settings.withoutVat
        ? `<tr><td>Item Total</td><td>BD ${grandSubtotal.toFixed(3)}</td></tr><tr><td>VAT (${qtn.taxPercent}%)</td><td>BD ${vatTotal.toFixed(3)}</td></tr><tr class="grand"><td>Net Total</td><td>BD ${grandNet.toFixed(3)}</td></tr>`
        : `<tr class="grand"><td>Net Total (Without Vat)</td><td>BD ${grandSubtotal.toFixed(3)}</td></tr>`}
    </table>
    <div class="bank-block">
      <p><b>All payments in favor of</b></p>
      <p>Account: ${PRINT_COMPANY.bankAccountName} · A/C No: ${PRINT_COMPANY.bankAccountNo}</p>
      <p>Bank: ${PRINT_COMPANY.bankName} · IBAN: ${PRINT_COMPANY.iban}</p>
    </div>
    <div class="terms-block">
      <p class="terms-title">Terms and Conditions</p>
      <p class="terms-body">${prEsc(qtn.termsBody || '—').replace(/\n/g, '<br>')}</p>
    </div>
    <table class="sign-table">
      <tr><th>PREPARED BY</th><th>MANAGEMENT APPROVAL</th><th>CLIENT APPROVAL</th></tr>
      <tr>
        <td>Name: ${prEsc(enq ? enq.salesPerson : '—')}<br>Date: ${qtn.date}</td>
        <td>Signature: ______________<br>Date: ______________</td>
        <td>Name: ______________<br>Signature: ______________</td>
      </tr>
    </table>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${prEsc(qtn.id)}${isInternal ? ' (Internal)' : ''}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1f2e;max-width:900px;margin:0 auto;padding:24px;}
    .letterhead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #600131;padding-bottom:12px;margin-bottom:14px;}
    .letterhead h1{font-size:22px;margin:0;color:#600131;}
    .letterhead .company{font-weight:700;font-size:13px;margin-top:4px;}
    .letterhead .meta{text-align:right;font-size:11px;}
    .company-footer{font-size:10px;color:#64748b;text-align:center;margin-top:6px;border-top:1px solid #e2e8f0;padding-top:6px;}
    .submitted{margin-bottom:12px;font-size:12px;}
    table.items{width:100%;border-collapse:collapse;margin-bottom:14px;}
    table.items th{background:#f1f5f9;text-align:left;padding:6px;font-size:10.5px;text-transform:uppercase;border-bottom:1px solid #cbd5e1;}
    table.items td{padding:6px;border-bottom:1px solid #e2e8f0;vertical-align:top;}
    tr.grp-row td{background:#94a3b8;color:#fff;font-weight:700;text-align:center;}
    tr.sub-row td{background:#e2e8f0;font-weight:700;text-decoration:underline;}
    tr.total-row td{font-weight:700;text-align:right;}
    tr.total-row td:first-child{text-align:left;}
    .desc{font-size:10.5px;color:#64748b;white-space:pre-wrap;}
    .img-cell{color:#94a3b8;text-align:center;}
    table.totals-table{width:280px;margin-left:auto;border-collapse:collapse;margin-bottom:14px;}
    table.totals-table td{padding:4px 8px;font-size:12px;}
    table.totals-table td:last-child{text-align:right;}
    table.totals-table tr.grand td{font-weight:700;font-size:13px;border-top:2px solid #1a1f2e;}
    .internal-note{color:#b91c1c;font-weight:700;text-align:center;font-size:11px;}
    .bank-block{font-size:11px;margin-bottom:12px;}
    .terms-block{font-size:10.5px;margin-bottom:14px;}
    .terms-title{font-weight:700;font-size:13px;text-decoration:underline;margin-bottom:4px;}
    table.sign-table{width:100%;border-collapse:collapse;margin-top:20px;}
    table.sign-table th{text-align:left;font-size:11px;padding-bottom:6px;}
    table.sign-table td{font-size:11px;padding-top:20px;vertical-align:top;}
    .print-btn{margin-bottom:16px;}
    .print-btn button{background:#600131;color:#fff;border:0;border-radius:8px;padding:10px 20px;font-size:13px;cursor:pointer;}
    @media print{.print-btn{display:none;}}
  </style></head>
  <body>
    <div class="print-btn"><button onclick="window.print()">🖨 Print Quotation</button></div>
    <div class="letterhead">
      <div>
        <h1>${isInternal ? 'INTERNAL COST REVIEW' : 'QUOTATION'}</h1>
        <p class="company">${PRINT_COMPANY.name}</p>
      </div>
      <div class="meta">
        <p><b>Quote No #</b> ${prEsc(qtn.id)}</p>
        <p>Quote Date: ${qtn.date}</p>
      </div>
    </div>
    <div class="submitted">
      <p><b>Submitted To</b><br>${prEsc(c ? c.name : '—')}<br>${prEsc(c ? c.address : '—')}</p>
      <p>Attn: ${prEsc(enq ? enq.contactPerson : '—')} · Tel: ${prEsc(c ? c.tel : '—')}</p>
      <p><b>Sub:</b> ${prEsc(qtn.projectName)}</p>
    </div>
    <table class="items"><tr>${headerCols}</tr>${bodyRows}</table>
    ${footer}
    <div class="company-footer">${PRINT_COMPANY.name} · TRN No: ${PRINT_COMPANY.trn} · CR No: ${PRINT_COMPANY.cr}<br>${PRINT_COMPANY.address}<br>Tel: ${PRINT_COMPANY.tel} · Email: ${PRINT_COMPANY.email} · ${PRINT_COMPANY.web}</div>
  </body></html>`;
}
