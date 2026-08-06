// ══════════════════════════════════════════
// PRINT / PREVIEW MODULE
// Shared across Sales/Estimator/Approver/Jobs — one dialog, three document
// builders. Rebuilt 6 Aug 2026 against the REAL Al Maraya print documents
// Salman supplied (Ewan Properties AMD-14740-0, Qreative Design AMD-10788-2,
// Cubique Design Studio AMD-15400-1 quotations; Job Order + Job Order
// Costing for JB26AMD02232) — layout, column set, group banding, totals
// stack, amount-in-words, T&C list, and the 3-column signature block all
// match those templates:
//   • Client Quotation  — # | IMAGE | ITEM DESCRIPTION | QTY | PRICE |
//     AMOUNT, grey group bands, "1.1 Sub Group" underlined rows, x.y.z
//     serials, Total/Discount/Gross/Vat/Net stack, Benefit Pay + bank
//     block, amount in words, Terms and Conditions, PREPARED BY /
//     MANAGEMENT APPROVAL / CLIENT APPROVAL signatures.
//   • Job Order Costing — internal: # | Name/Description | Qty | Unit |
//     Job Amount | Est. Amount | Cost | Profit | Profit% with the real
//     yellow-group / pink-subgroup / green-totals banding and Job Total.
//   • Job Order         — production copy: Name/Description | Qty | Image,
//     NO prices anywhere.
// Still a real snapshot: static HTML in a new tab via Blob + object URL, no
// server, no PDF library — browser Print -> Save as PDF handles the PDF
// case. Nothing rendered here is ever editable.
// Loads right after data.js — only depends on data.js.
// ══════════════════════════════════════════

const PRINT_COMPANY = {
  name: "AL MARAYA DECOR MATERIAL CO. W.L.L.",
  nameArabic: "شركة المرايا لمواد الديكور ذ م م",
  brand: "AL MARAYA DECOR",
  trn: "200020059800002",
  cr: "84635-01,02,05",
  address: "P.O.Box 54348 | Shop 33A | Road 3601 | Block 336 | Adliya | Kingdom of Bahrain",
  tel: "+973 17211862",
  tel2: "+973 17211863",
  email: "info@almarayadecor.com",
  web: "www.almarayadecor.com",
  bankName: "BANK OF BAHRAIN & KUWAIT (BBK)",
  bankAccountName: "AL MARAYA DECOR MATERIAL CO WLL",
  bankAccountNo: "100000338407",
  iban: "BH54-BBKU-0010-0000-3384-07"
};

function prEsc(s) { return (s === null || s === undefined) ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// "2,040.000" — thousands separators on item figures, 3 decimals (BD fils)
function prFmt(n) { return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
// Totals in the real docs carry no thousands separator ("BD 16183.000")
function prFmtPlain(n) { return (Number(n) || 0).toFixed(3); }

// "Bahrain Dinar One Thousand Three Hundred and Fifty Only" /
// "... Nine Thousand Three Hundred and Fifty-Seven & Seven Hundred Fils Only"
// — matches the real documents' amount-in-words line exactly.
function numberToWordsBD(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', 'Ten', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = n => n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '');
  const three = n => n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + two(n % 100) : '') : two(n);
  const int = Math.floor(Number(amount) || 0);
  const fils = Math.round(((Number(amount) || 0) - int) * 1000);
  let words = '';
  if (int === 0) words = 'Zero';
  else {
    const m = Math.floor(int / 1e6), t = Math.floor((int % 1e6) / 1000), r = int % 1000;
    if (m) words += three(m) + ' Million ';
    if (t) words += three(t) + ' Thousand ';
    if (r) words += (words && r < 100 ? 'and ' : '') + three(r);
    words = words.trim();
  }
  let out = 'Bahrain Dinar ' + words;
  if (fils) out += ' & ' + three(fils) + ' Fils';
  return out + ' Only';
}

// Simple wine logomark standing in for the real logo image (an asset the
// data model doesn't carry yet) — same silhouette family as the app shell.
function printLogoBlock() {
  return `<div class="logo-block">
    <svg width="54" height="44" viewBox="0 0 60 48"><path d="M4 44 V6 h13 l13 15 L43 6 h13 v38 h-12 V24 l-14 15 -14-15 v20 z" fill="#600131"/></svg>
    <div class="logo-word">${PRINT_COMPANY.brand}</div>
  </div>`;
}
// The repeating page footer (fixed to the bottom of every printed page).
function printPageFooter() {
  return `<div class="page-footer">
    <div class="pf-line1"><span>${PRINT_COMPANY.name}</span><span class="ar">${PRINT_COMPANY.nameArabic}</span></div>
    <div class="pf-line2">TRN No: ${PRINT_COMPANY.trn} | CR No: ${PRINT_COMPANY.cr} | ${PRINT_COMPANY.address}<br>
    Tel : ${PRINT_COMPANY.tel} | Email : ${PRINT_COMPANY.email} | ${PRINT_COMPANY.web}</div>
  </div>`;
}

let printQtnId = null;
let printAllowInternalCost = false;
let printSettings = { audience: 'client', withImage: true, withoutGroupTotal: false, withoutSubTotal: false, withoutVat: false };

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

// allowInternalCost: whether the Internal (Job Order Costing) audience is
// even offered — callers in sales.js/estimator.js always pass false,
// approver.js passes true. Matches who already sees cost/profit today.
function openPrintDialog(qtnId, allowInternalCost) {
  printQtnId = qtnId;
  printAllowInternalCost = !!allowInternalCost;
  printSettings = { audience: 'client', withImage: true, withoutGroupTotal: false, withoutSubTotal: false, withoutVat: false };
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
        <option value="internal" ${printSettings.audience === 'internal' ? 'selected' : ''}>Job Order Costing (Internal)</option>
      </select>
    </label>` : ''}
    <label><input type="checkbox" ${printSettings.withImage ? 'checked' : ''} onchange="printSettings.withImage=this.checked;"> With Image column</label>
    <label><input type="checkbox" onchange="printSettings.withoutGroupTotal=this.checked;"> Without Group Total</label>
    <label><input type="checkbox" onchange="printSettings.withoutSubTotal=this.checked;"> Without Sub Total</label>
    <label><input type="checkbox" onchange="printSettings.withoutVat=this.checked;"> Without VAT</label>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="primary" style="flex:1;" onclick="printGenerate()">Generate</button>
      <button class="secondary" style="flex:1;" onclick="closePrintDialog()">Cancel</button>
    </div>`;
}

function printOpenHTML(html) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

function printGenerate() {
  const qtn = quotations.find(q => q.id === printQtnId);
  if (!qtn) return;
  const html = printSettings.audience === 'internal'
    ? buildJobCostingPrintHTML(qtn, null)
    : buildQuotationPrintHTML(qtn, printSettings);
  printOpenHTML(html);
  closePrintDialog();
}

// Jobs-module entry points (wired from the Job Card hub tiles).
function printJobOrder(jobId) {
  const job = jobCards.find(j => j.id === jobId);
  if (!job) return;
  printOpenHTML(buildJobOrderPrintHTML(job));
}
function printJobCosting(jobId) {
  const job = jobCards.find(j => j.id === jobId);
  if (!job) return;
  const qtn = quotations.find(q => q.id === job.quotationId);
  if (!qtn) return;
  printOpenHTML(buildJobCostingPrintHTML(qtn, job));
}

// Shared <style> for all three documents.
function printBaseCSS() {
  return `
    *{box-sizing:border-box;}
    body{font-family:Georgia,'Times New Roman',serif;font-size:12px;color:#1a1f2e;max-width:900px;margin:0 auto;padding:24px 24px 90px;}
    .print-btn{margin-bottom:16px;font-family:Arial,sans-serif;}
    .print-btn button{background:#600131;color:#fff;border:0;border-radius:8px;padding:10px 20px;font-size:13px;cursor:pointer;}
    .logo-block{width:150px;}
    .logo-word{font-size:12px;letter-spacing:2px;color:#3d3d3d;margin-top:4px;font-family:Georgia,serif;}
    .doc-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;}
    .doc-title{font-size:30px;font-weight:700;text-align:right;margin:0;font-family:Georgia,serif;}
    .doc-no{text-align:right;font-size:13px;margin-top:10px;}
    .meta-table{font-size:11.5px;border-collapse:collapse;margin-left:auto;}
    .meta-table td{padding:1px 4px;vertical-align:top;}
    .meta-table td:first-child{color:#333;}
    .submitted{font-size:12px;margin:6px 0 4px;}
    .submitted .cname{font-weight:700;text-transform:uppercase;}
    .sub-line{font-weight:700;text-decoration:underline;margin:6px 0 12px;font-size:13px;}
    table.items{width:100%;border-collapse:collapse;margin-bottom:14px;border:1px solid #d7d7d7;}
    table.items th{background:#ececec;text-align:center;padding:7px 6px;font-size:10.5px;font-weight:700;border:1px solid #d7d7d7;text-transform:uppercase;font-family:Arial,sans-serif;}
    table.items td{padding:7px 6px;border:1px solid #e3e3e3;vertical-align:top;font-size:11.5px;}
    tr.grp-row td{background:#a9a9a9;color:#111;font-weight:400;text-align:center;font-size:13px;padding:8px;font-family:Georgia,serif;}
    tr.sub-row td.sn{text-align:center;width:52px;}
    tr.sub-row td.snm{text-decoration:underline;font-weight:600;}
    td.serial{text-align:center;width:52px;}
    td.qty,td.price,td.amount{text-align:right;white-space:nowrap;}
    td.img-cell{width:90px;text-align:center;color:#b9b9b9;font-size:10px;}
    .desc{font-size:10.8px;color:#555;white-space:pre-wrap;margin-top:3px;}
    tr.total-row td{background:#e2efda;font-weight:700;font-size:11.5px;}
    tr.total-row td.lbl{text-align:right;}
    tr.total-row td.val{text-align:right;white-space:nowrap;}
    .foot-wrap{display:flex;gap:18px;align-items:flex-start;margin-bottom:10px;}
    .bank-block{font-size:10.8px;display:flex;gap:10px;align-items:flex-start;flex:1;}
    .qr-ph{width:74px;height:74px;border:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:8.5px;color:#777;text-align:center;flex-shrink:0;}
    table.totals-table{width:300px;border-collapse:collapse;margin-left:auto;}
    table.totals-table td{padding:7px 10px;font-size:12.5px;border:1px solid #d7d7d7;background:#ececec;}
    table.totals-table td:last-child{text-align:right;white-space:nowrap;}
    table.totals-table tr.grand td{background:#7a7a7a;color:#fff;font-weight:700;}
    .words-line{font-size:11.5px;margin:6px 0 16px;}
    .terms-block{font-size:11px;margin:18px 0 8px;}
    .terms-title{font-weight:700;font-size:17px;text-decoration:underline;margin-bottom:6px;font-family:Georgia,serif;}
    .terms-body{white-space:pre-wrap;line-height:1.55;}
    table.sign-table{width:100%;border-collapse:collapse;margin-top:22px;font-family:Arial,sans-serif;}
    table.sign-table th{text-align:left;font-size:11px;padding-bottom:8px;text-transform:uppercase;}
    table.sign-table td{font-size:11px;padding:3px 12px 3px 0;vertical-align:top;}
    .dot{display:inline-block;min-width:150px;border-bottom:1px dotted #888;}
    .page-footer{margin-top:30px;border-top:1px solid #bbb;padding-top:6px;font-size:9.5px;color:#555;text-align:center;}
    .pf-line1{display:flex;justify-content:space-between;font-weight:700;color:#333;}
    .pf-line1 .ar{direction:rtl;}
    @media print{
      .print-btn{display:none;}
      .page-footer{position:fixed;bottom:0;left:0;right:0;background:#fff;}
      body{padding-bottom:70px;}
    }
  `;
}

// ── CLIENT QUOTATION — matches the real AMD quotation template ──
function buildQuotationPrintHTML(qtn, settings) {
  const c = customers.find(x => x.id === qtn.customerId);
  const enq = enquiries.find(e => e.id === qtn.enquiryId);
  const hierarchy = computeQuoteHierarchy(qtn.items);
  const withImage = settings.withImage !== false;
  const colCount = 5 + (withImage ? 1 : 0);

  let bodyRows = '';
  let subTotal = 0, groupTotal = 0;
  let grandAmount = 0, grandDisc = 0, grandNet = 0;

  hierarchy.forEach((h, i) => {
    const it = h.item;
    const next = hierarchy[i + 1];
    const isLastInSub = !next || next.isNewSubgroup;
    const isLastInGroup = !next || next.isNewGroup;

    if (h.isNewGroup && it.group) bodyRows += `<tr class="grp-row"><td colspan="${colCount}">${prEsc(it.group)}</td></tr>`;
    if (h.isNewSubgroup && it.subgroup) bodyRows += `<tr class="sub-row"><td class="sn">${h.groupNo}.${h.subgroupNo}</td><td class="snm" colspan="${colCount - 1}">${prEsc(it.subgroup)}</td></tr>`;

    bodyRows += `<tr>
      <td class="serial">${h.serial}</td>
      ${withImage ? `<td class="img-cell">no image</td>` : ''}
      <td>${prEsc(it.product)}${it.description ? `<div class="desc">${prEsc(it.description).replace(/\n/g, '<br>')}</div>` : ''}</td>
      <td class="qty">${prFmtPlain(it.qty)}</td>
      <td class="price">${prFmt(it.rate)}/${prEsc(it.unit)}</td>
      <td class="amount">${prFmt(it.amount)}</td>
    </tr>`;

    subTotal += it.amount; groupTotal += it.amount;
    grandAmount += it.amount; grandDisc += it.discAmt; grandNet += it.netAmount;

    if (isLastInSub && !settings.withoutSubTotal && it.subgroup) {
      bodyRows += `<tr class="total-row"><td class="lbl" colspan="${colCount - 1}">${prEsc(it.subgroup)} Total</td><td class="val">BD ${prFmtPlain(subTotal)}</td></tr>`;
    }
    if (isLastInSub) subTotal = 0;
    if (isLastInGroup && !settings.withoutGroupTotal && it.group) {
      bodyRows += `<tr class="total-row"><td class="lbl" colspan="${colCount - 1}">${prEsc(it.group)} Total</td><td class="val">BD ${prFmtPlain(groupTotal)}</td></tr>`;
    }
    if (isLastInGroup) groupTotal = 0;
  });

  const grossTotal = grandAmount - grandDisc;
  const vatTotal = grandNet - grossTotal;
  const netShown = settings.withoutVat ? grossTotal : grandNet;

  // Totals stack exactly per the template: Discount + Gross Total rows only
  // appear when a discount exists (Ewan has them, Qreative doesn't).
  let totalsRows = `<tr><td>Total</td><td>BD ${prFmtPlain(grandAmount)}</td></tr>`;
  if (grandDisc > 0.0005) totalsRows += `<tr><td>Discount</td><td>BD ${prFmtPlain(grandDisc)}</td></tr><tr><td>Gross Total</td><td>BD ${prFmtPlain(grossTotal)}</td></tr>`;
  if (!settings.withoutVat) totalsRows += `<tr><td>Vat</td><td>BD ${prFmtPlain(vatTotal)}</td></tr>`;
  totalsRows += `<tr class="grand"><td>Net Total</td><td>BD ${prFmtPlain(netShown)}</td></tr>`;

  const terms = qtn.termsBody || TERMS_TEMPLATES["Al Maraya Decor Standard."] || '';
  const salesName = enq ? enq.salesPerson : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>${prEsc(qtn.id)}</title>
  <style>${printBaseCSS()}</style></head>
  <body>
    <div class="print-btn"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>
    <div class="doc-head">
      ${printLogoBlock()}
      <div>
        <p class="doc-title">QUOTATION</p>
        <p class="doc-no">Quote No # ${prEsc(qtn.id)}</p>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div class="submitted">
        Submitted To<br>
        <span class="cname">${prEsc(c ? c.name : '—')}</span><br>
        ${prEsc(c ? c.address : '')}
      </div>
      <table class="meta-table">
        <tr><td>Quote Date</td><td>:</td><td>${prEsc(qtn.date)}</td></tr>
        <tr><td>Attn</td><td>:</td><td>${prEsc((qtn.contactPerson || (enq && enq.contactPerson)) || '—')}</td></tr>
        <tr><td>Tel</td><td>:</td><td>${prEsc(c ? c.tel : '—')}</td></tr>
        ${c && c.email ? `<tr><td>E-mail</td><td>:</td><td>${prEsc(c.email)}</td></tr>` : ''}
      </table>
    </div>
    <p class="sub-line">Sub: ${prEsc(qtn.projectName)}</p>
    <table class="items">
      <tr><th>#</th>${withImage ? '<th>Image</th>' : ''}<th>Item Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr>
      ${bodyRows}
    </table>
    <div class="foot-wrap">
      <div class="bank-block">
        <div><div class="qr-ph">Benefit Pay<br>QR</div><div style="text-align:center;font-size:9px;margin-top:2px;">Benefit Pay</div></div>
        <div>
          <b>All payments in favor of</b><br>
          Account: ${PRINT_COMPANY.bankAccountName}<br>
          A/C No: ${PRINT_COMPANY.bankAccountNo}<br>
          Bank Name: ${PRINT_COMPANY.bankName}<br>
          IBAN: ${PRINT_COMPANY.iban}
        </div>
      </div>
      <table class="totals-table">${totalsRows}</table>
    </div>
    <p class="words-line">${numberToWordsBD(netShown)}</p>
    <div class="terms-block">
      <p class="terms-title">Terms and Conditions</p>
      <p class="terms-body">${prEsc(terms)}</p>
    </div>
    <table class="sign-table">
      <tr><th>Prepared By</th><th>Management Approval</th><th>Client Approval</th></tr>
      <tr>
        <td>Name : <span class="dot">${prEsc(salesName)}</span></td>
        <td>Date : <span class="dot"></span></td>
        <td>Date : <span class="dot"></span></td>
      </tr>
      <tr>
        <td>Contact : <span class="dot"></span></td>
        <td>Signature : <span class="dot"></span></td>
        <td>Name : <span class="dot"></span></td>
      </tr>
      <tr>
        <td>Signature : <span class="dot"></span></td>
        <td></td>
        <td>Signature : <span class="dot"></span></td>
      </tr>
      <tr><td>Email : <span class="dot"></span></td><td></td><td></td></tr>
    </table>
    ${printPageFooter()}
  </body></html>`;
}

// ── JOB ORDER COSTING (internal) — matches the real internal template ──
// Works quotation-first (Approver's Print dialog, job may not exist yet) or
// job-first (Jobs module tile). Job Amount = the line's quoted amount;
// Est. Amount = the Estimator's BOM calculated selling price; Cost = BOM
// total cost incl. overheads; Profit = Job Amount − Cost (matches the real
// document's own arithmetic: 535.000 − 117.254 = 417.746 @ 356.274%).
function buildJobCostingPrintHTML(qtn, job) {
  const c = customers.find(x => x.id === qtn.customerId);
  const hierarchy = computeQuoteHierarchy(qtn.items);
  const COLS = 9;

  let bodyRows = '';
  let subTotal = 0, groupTotal = 0;
  let jobTotal = 0, amtTotal = 0, costTotal = 0;

  hierarchy.forEach((h, i) => {
    const it = h.item;
    const next = hierarchy[i + 1];
    const isLastInSub = !next || next.isNewSubgroup;
    const isLastInGroup = !next || next.isNewGroup;

    if (h.isNewGroup && it.group) bodyRows += `<tr class="jc-grp"><td colspan="${COLS}">${prEsc(it.group)}</td></tr>`;
    if (h.isNewSubgroup && it.subgroup) bodyRows += `<tr class="jc-sub"><td colspan="${COLS}">${prEsc(it.subgroup)}</td></tr>`;

    let est = null, cost = null, profit = null, profitPct = null;
    if (it.bom) {
      const t = computeBOMTotals(it.bom);
      est = t.calculatedSellingPrice;
      cost = t.totalCostInclOH;
      profit = it.amount - cost;
      profitPct = cost > 0 ? (profit / cost * 100) : null;
    }

    bodyRows += `<tr>
      <td class="serial">${h.serial}</td>
      <td>${prEsc(it.product)}${it.description ? `<div class="desc">${prEsc(it.description).replace(/\n/g, '<br>')}</div>` : ''}</td>
      <td class="qty">${prFmtPlain(it.qty)}</td>
      <td style="text-align:center;">${prEsc(it.unit)}</td>
      <td class="amount">${prFmt(it.amount)}</td>
      <td class="amount">${est !== null ? prFmt(est) : '—'}</td>
      <td class="amount">${cost !== null ? prFmt(cost) : '—'}</td>
      <td class="amount">${profit !== null ? prFmt(profit) : '—'}</td>
      <td class="amount">${profitPct !== null ? profitPct.toFixed(3) : '—'}</td>
    </tr>`;

    subTotal += it.amount; groupTotal += it.amount; jobTotal += it.amount;
    if (it.bom) { const t = computeBOMTotals(it.bom); amtTotal += t.calculatedSellingPrice; costTotal += t.totalCostInclOH; }

    if (isLastInSub && it.subgroup) bodyRows += `<tr class="jc-total"><td colspan="${COLS - 1}" class="lbl">${prEsc(it.subgroup)} Total</td><td class="val">BD ${prFmtPlain(subTotal)}</td></tr>`;
    if (isLastInSub) subTotal = 0;
    if (isLastInGroup && it.group) bodyRows += `<tr class="jc-total"><td colspan="${COLS - 1}" class="lbl">${prEsc(it.group)} Total</td><td class="val">BD ${prFmtPlain(groupTotal)}</td></tr>`;
    if (isLastInGroup) groupTotal = 0;
  });

  const profitTotal = jobTotal - costTotal;
  const profitPctTotal = costTotal > 0 ? (profitTotal / costTotal * 100).toFixed(3) : '—';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Job Order Costing ${prEsc(job ? job.id : qtn.id)}</title>
  <style>${printBaseCSS()}
    body{font-family:Arial,Helvetica,sans-serif;}
    .jc-company{font-size:10px;text-align:right;color:#333;}
    .jc-title{background:#e3e3e3;font-size:15px;font-weight:700;text-align:center;padding:7px;margin:6px 0;}
    table.items th{background:#5c6670;color:#fff;border-color:#5c6670;}
    tr.jc-grp td{background:#fdf3d0;font-weight:700;text-align:center;color:#4a3a00;}
    tr.jc-sub td{background:#f6cfcf;font-weight:700;text-align:center;color:#7a1f1f;}
    tr.jc-total td{background:#e2efda;font-weight:700;}
    tr.jc-total td.lbl{text-align:right;color:#2f5e1f;}
    tr.jc-total td.val{text-align:right;color:#2f5e1f;white-space:nowrap;}
    table.jobtotal{width:100%;border-collapse:collapse;margin-top:4px;}
    table.jobtotal td,table.jobtotal th{border:1px solid #d7d7d7;padding:7px;font-size:11.5px;text-align:right;}
    table.jobtotal th{background:#ececec;}
  </style></head>
  <body>
    <div class="print-btn"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>
    <div class="doc-head">
      ${printLogoBlock()}
      <div class="jc-company">
        ${PRINT_COMPANY.name.replace('W.L.L.', 'W.L.L.')} | ${PRINT_COMPANY.cr}<br>
        ${PRINT_COMPANY.address} | ${PRINT_COMPANY.email}<br>
        ${PRINT_COMPANY.tel} | ${PRINT_COMPANY.tel2}<br>
        TRN # ${PRINT_COMPANY.trn}
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;">
      <div class="submitted">
        <b>Submitted to:</b><br>${prEsc(c ? c.name : '—')}<br>${prEsc(c ? c.address : '')}<br>
        Tel : ${prEsc(c ? c.tel : '—')}<br>Notes :
      </div>
      <div style="min-width:300px;">
        <div class="jc-title">Job Order Costing</div>
        <table class="meta-table" style="margin-left:0;width:100%;">
          <tr><td>Job No:</td><td style="font-weight:700;">${prEsc(job ? job.id : '— (pre-job)')}</td></tr>
          <tr><td>Date:</td><td>${prEsc(job ? job.date : qtn.date)}</td></tr>
          <tr><td>Quotation No:</td><td>${prEsc(qtn.id)}</td></tr>
        </table>
      </div>
    </div>
    <table class="items" style="margin-top:10px;">
      <tr><th>#</th><th>Name/Description</th><th>Qty</th><th>Unit</th><th>Job Amount<br>(BD)</th><th>Est. Amount<br>(BD)</th><th>Cost (BD)</th><th>Profit (BD)</th><th>Profit%</th></tr>
      ${bodyRows}
    </table>
    <table class="jobtotal">
      <tr><th style="width:40%;"></th><th>Job Total</th><th>Amount</th><th>Cost</th><th>Profit</th><th>Profit%</th></tr>
      <tr><td></td><td><b>${prFmtPlain(jobTotal)}</b></td><td><b>${prFmtPlain(amtTotal)}</b></td><td><b>${prFmtPlain(costTotal)}</b></td><td><b>${prFmtPlain(profitTotal)}</b></td><td><b>${profitPctTotal}</b></td></tr>
    </table>
    <p style="color:#b91c1c;font-weight:700;text-align:center;font-size:11px;margin-top:14px;">INTERNAL COST REVIEW — not for client distribution.</p>
    ${printPageFooter()}
  </body></html>`;
}

// ── JOB ORDER (production copy) — matches the real template: NO prices ──
// Descriptions/groups come from the linked quotation's items (matched by
// lineId) since Job Card lines don't carry description/group themselves.
function buildJobOrderPrintHTML(job) {
  const qtn = quotations.find(q => q.id === job.quotationId);
  const c = customers.find(x => x.id === job.customerId);
  const enq = qtn ? enquiries.find(e => e.id === qtn.enquiryId) : null;
  const items = qtn ? qtn.items : job.items;
  const hierarchy = computeQuoteHierarchy(items);

  let bodyRows = '';
  hierarchy.forEach(h => {
    const it = h.item;
    if (h.isNewGroup && it.group) bodyRows += `<tr class="jo-grp"><td colspan="3">${prEsc(it.group)}</td></tr>`;
    if (h.isNewSubgroup && it.subgroup) bodyRows += `<tr class="jo-sub"><td colspan="3">${prEsc(it.subgroup)}</td></tr>`;
    bodyRows += `<tr>
      <td>${prEsc(it.product)}${it.description ? `<div class="desc">${prEsc(it.description).replace(/\n/g, '<br>')}</div>` : ''}</td>
      <td class="qty" style="text-align:right;">${prFmtPlain(it.qty)}</td>
      <td class="img-cell">no image</td>
    </tr>`;
  });

  return `<!doctype html><html><head><meta charset="utf-8"><title>Job Order ${prEsc(job.id)}</title>
  <style>${printBaseCSS()}
    body{font-family:Arial,Helvetica,sans-serif;}
    .jo-title{background:#e3e3e3;font-size:15px;font-weight:700;text-align:center;padding:7px;margin-bottom:6px;font-family:Georgia,serif;}
    tr.jo-grp td{font-weight:700;font-size:14px;font-family:Georgia,serif;border-bottom:1px solid #999;}
    tr.jo-sub td{font-weight:700;text-decoration:underline;font-size:12px;}
  </style></head>
  <body>
    <div class="print-btn"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;">
      <div class="submitted" style="font-size:13px;">
        Submitted to:<br><b>${prEsc(c ? c.name : '—')}</b>
      </div>
      <div style="min-width:300px;">
        <div class="jo-title">JOB ORDER</div>
        <table class="meta-table" style="margin-left:0;width:100%;">
          <tr><td>Job Card No</td><td>${prEsc(job.id)}</td></tr>
          <tr><td>Date</td><td>${prEsc(job.date)}</td></tr>
          <tr><td>Qtn No</td><td>${prEsc(job.quotationId || '—')}</td></tr>
          <tr><td>Salesman</td><td>${prEsc(enq ? enq.salesPerson : '—')}</td></tr>
        </table>
      </div>
    </div>
    <table class="items" style="margin-top:10px;">
      <tr><th style="text-align:left;">Name/Description</th><th>Qty</th><th>Image</th></tr>
      ${bodyRows}
    </table>
    ${printPageFooter()}
  </body></html>`;
}

// ── MATERIAL COST (per line item) — matches the real Q-Pro template ──
// The derived actual-cost ledger for one job line: header block (Job /
// Group / Sub Group / Product / Description / Qty), priced Material Cost
// rows, per-employee Labour Cost rows, Job Purchase, Job Expense, TOTAL
// COST band. Everything is read from the ledger (getLineActualCost) —
// nothing on this document is ever hand-entered.
function printMaterialCost(jobId, lineId) {
  const job = jobCards.find(j => j.id === jobId);
  if (!job) return;
  printOpenHTML(buildMaterialCostPrintHTML(job, Number(lineId)));
}
function buildMaterialCostPrintHTML(job, lineId) {
  const qtn = quotations.find(q => q.id === job.quotationId);
  const c = customers.find(x => x.id === job.customerId);
  const qi = qtn ? qtn.items.find(i => i.lineId === lineId) : null;
  const ji = job.items.find(i => i.lineId === lineId) || {};
  const serial = (() => {
    if (!qtn) return '';
    const h = computeQuoteHierarchy(qtn.items).find(x => x.item.lineId === lineId);
    return h ? h.serial + ' / ' : '';
  })();
  const actual = getLineActualCost(job.id, lineId) || { materials: [], materialTotal: 0, labour: [], labourTotal: 0, totalCost: 0 };
  const jobLevel = getJobActualCost(job.id);
  const purchases = jobLevel ? jobLevel.purchases : [];

  const matRows = actual.materials.map(m => `<tr>
    <td>${prEsc(m.type)}</td><td>${prEsc(m.date)}</td><td>${prEsc(m.name)}</td>
    <td class="qty">${m.qty}</td><td style="text-align:center;">${prEsc(m.unit)}</td>
    <td class="amount">${prFmtPlain(m.rate)}</td><td class="amount">${prFmtPlain(m.amount)}</td></tr>`).join('');
  const labRows = actual.labour.map(l => `<tr>
    <td>${prEsc(l.date)}</td><td>${prEsc(l.employeeName)}${l.activity && l.activity !== 'production' ? ` <span style="color:#777;">(${prEsc(l.activity)})</span>` : ''}</td>
    <td class="amount">${prFmtPlain(l.cost)}</td></tr>`).join('');
  const purRows = purchases.map(pi => `<tr><td>${prEsc(pi.date || '')}</td><td>${prEsc(pi.supplierName || pi.vendor || '')}</td><td>${prEsc(pi.id)}</td><td class="amount">${prFmtPlain((pi.totals && (pi.totals.netTotal ?? pi.totals.total)) || 0)}</td></tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Material Cost ${prEsc(job.id)} #${lineId}</title>
  <style>${printBaseCSS()}
    body{font-family:Arial,Helvetica,sans-serif;}
    table.hdr{width:100%;border-collapse:collapse;margin-bottom:10px;}
    table.hdr td{border:1px solid #cfcfcf;padding:6px 8px;font-size:11.5px;vertical-align:top;}
    table.hdr td.k{width:130px;font-weight:700;background:#eef3f9;}
    .mc-title{border:1px solid #cfcfcf;text-align:center;font-weight:700;font-size:15px;padding:8px;margin-bottom:0;}
    .sec{background:#b8b8c8;font-weight:700;padding:6px 8px;border:1px solid #cfcfcf;font-size:12.5px;}
    table.items th{background:#d6d6e8;color:#111;}
    tr.sec-total td{background:#eef3e2;font-weight:700;color:#b03030;}
    .grand-band{background:#ffff99;font-weight:700;display:flex;justify-content:space-between;padding:8px 10px;border:1px solid #cfcfcf;font-size:13px;}
  </style></head>
  <body>
    <div class="print-btn"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>
    <p class="mc-title">MATERIAL COST</p>
    <table class="hdr">
      <tr><td class="k">Job Number</td><td>${prEsc(job.id)}</td></tr>
      <tr><td class="k">Job Name</td><td>${prEsc(c ? c.name : '—')}</td></tr>
      <tr><td class="k">Project</td><td>${prEsc(job.projectName)}</td></tr>
      <tr><td class="k">GROUP</td><td>${prEsc(qi ? qi.group : '')}</td></tr>
      <tr><td class="k">SUB GROUP</td><td>${prEsc(qi ? qi.subgroup : '')}</td></tr>
      <tr><td class="k">PRODUCT NAME</td><td>${serial}${prEsc(ji.product || (qi && qi.product) || '')}</td></tr>
      <tr><td class="k">DESCRIPTION</td><td style="white-space:pre-wrap;">${prEsc(qi ? qi.description : '')}</td></tr>
      <tr><td class="k">QUANTITY / UNIT</td><td>${prFmtPlain(ji.qty || 0)} / ${prEsc(ji.unit || '')}</td></tr>
    </table>
    <div class="sec">Material Cost</div>
    <table class="items"><tr><th>Type</th><th>Date</th><th>Materials Details</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr>
      ${matRows || '<tr><td colspan="7" style="color:#888;">No material issues logged against this item yet.</td></tr>'}
      <tr class="sec-total"><td colspan="6" style="text-align:right;">Material Total</td><td class="amount">${prFmtPlain(actual.materialTotal)}</td></tr>
    </table>
    <div class="sec">Labour Cost</div>
    <table class="items"><tr><th>Date</th><th>Employee</th><th>Total Salary</th></tr>
      ${labRows || '<tr><td colspan="3" style="color:#888;">No labour logged against this item yet.</td></tr>'}
      <tr class="sec-total"><td colspan="2" style="text-align:right;">Labour Total</td><td class="amount">${prFmtPlain(actual.labourTotal)}</td></tr>
    </table>
    <div class="sec">Job Purchase <span style="font-weight:400;font-size:10.5px;">(job level — not split per item)</span></div>
    <table class="items"><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th>Amount</th></tr>
      ${purRows || ''}
      <tr class="sec-total"><td colspan="3" style="text-align:right;">Total</td><td class="amount">${prFmtPlain(jobLevel ? jobLevel.purchaseTotal : 0)}</td></tr>
    </table>
    <div class="sec">Job Expense</div>
    <table class="items"><tr class="sec-total"><td colspan="3" style="text-align:right;">Total</td><td class="amount">0.000</td></tr></table>
    <div class="grand-band"><span>TOTAL COST (this item)</span><span>${prFmtPlain(actual.totalCost)}</span></div>
    ${printPageFooter()}
  </body></html>`;
}
