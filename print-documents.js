// ══════════════════════════════════════════
// PRINT — THE REST OF THE DOCUMENTS (Salman, 6 Sep 2026: "build all and
// look for pdf prints, journals ledger, soa not built and build those.
// Any reports, consumptions reports, history all of it").
//
// print.js already carried seven: the Quotation (client + internal cost
// review), Job Order, Job Order Costing, Material Cost, the A4 cutting
// list, the upholstery cutting & sewing ticket, and the Payslip. This file
// adds the rest, on the same helpers (PRINT_COMPANY, prEsc, prFmt,
// numberToWordsBD, printLogoBlock, printPageFooter, printBaseCSS,
// printOpenHTML) so every document in the app carries one letterhead, one
// footer and one type scale:
//
//   • Tax Invoice        — the document that goes to a client for payment;
//                          its button used to say "not wired to a document
//                          generator yet".
//   • Proforma           — the same shape, marked PROFORMA, no VAT claim.
//   • Delivery Note      — what left the workshop, with a receiver's sign-off.
//   • Purchase Order     — what we asked a supplier for.
//   • Goods Receipt      — what arrived against it, and what was short.
//   • Vouchers           — Receipt, Credit Note, Supplier Payment, Debit
//                          Note and Journal, one builder: a voucher is a
//                          party, an amount, and what it was set against.
//   • Material Issue /
//     Return note        — what the store handed to a job.
//   • Statement of Account — opening balance, every document since, closing.
//   • Any report         — one table printer used by the Day Book, Ledger,
//                          Trial Balance, P&L, Balance Sheet, the registers,
//                          consumption and item history, so a report on
//                          screen and the same report on paper cannot drift.
//
// Loads after print.js. Static HTML in a new tab; the browser's own
// Print → Save as PDF makes the PDF, as everywhere else here.
// ══════════════════════════════════════════

// ── the shell every document below shares ──────────────────────────
// meta: [[label, value], …] printed top-right. party: { title, lines[] }.
// bodyHTML is the document's own middle. foot: [[label, value], …] totals.
function prDocShell({ title, subtitle, docNo, meta = [], party = null, bodyHTML = '', noteHTML = '', signatures = null, landscape = false }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${prEsc(title)}${docNo ? ' ' + prEsc(docNo) : ''}</title>
  <style>${printBaseCSS()}${prDocCSS()}${landscape ? '@page{size:A4 landscape;margin:12mm;} body{max-width:1180px;}' : ''}</style></head><body>
  <div class="print-btn"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="doc-head">
    ${printLogoBlock()}
    <div><h1 class="doc-title">${prEsc(title)}</h1>${subtitle ? `<div class="doc-sub">${prEsc(subtitle)}</div>` : ''}
      ${meta.length ? `<table class="meta-table">${meta.map(m => `<tr><td>${prEsc(m[0])}</td><td>:</td><td><b>${prEsc(m[1])}</b></td></tr>`).join('')}</table>` : ''}
    </div>
  </div>
  ${party ? `<div class="party-block"><div class="party-t">${prEsc(party.title)}</div>
    ${party.lines.filter(Boolean).map((l, i) => `<div class="${i === 0 ? 'party-name' : 'party-l'}">${prEsc(l)}</div>`).join('')}</div>` : ''}
  ${bodyHTML}
  ${noteHTML}
  ${signatures ? `<div class="sig-row">${signatures.map(s => `<div class="sig-cell"><div class="sig-line"></div><div class="sig-lbl">${prEsc(s)}</div></div>`).join('')}</div>` : ''}
  ${printPageFooter()}
  </body></html>`;
}
function prDocCSS() {
  return `
    .doc-sub{text-align:right;font-size:12px;color:#555;margin-top:2px;letter-spacing:1px;text-transform:uppercase;}
    .party-block{border:1px solid #d7d7d7;padding:8px 10px;margin-bottom:12px;font-size:11.5px;}
    .party-t{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:3px;}
    .party-name{font-weight:700;font-size:13px;}
    .party-l{color:#333;}
    table.doc{width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #d7d7d7;}
    table.doc th{background:#ececec;text-align:left;padding:6px 7px;font-size:10.5px;font-weight:700;border:1px solid #d7d7d7;text-transform:uppercase;font-family:Arial,sans-serif;}
    table.doc td{padding:6px 7px;border:1px solid #e3e3e3;font-size:11.5px;vertical-align:top;}
    table.doc td.n,table.doc th.n{text-align:right;white-space:nowrap;}
    table.doc td.c,table.doc th.c{text-align:center;}
    table.doc tr.tot td{font-weight:700;background:#f4f4f4;}
    table.doc tr.sec td{background:#ececec;font-weight:700;}
    .tot-stack{margin-left:auto;width:290px;font-size:12px;}
    .tot-stack div{display:flex;justify-content:space-between;padding:3px 0;}
    .tot-stack div.grand{border-top:1.5px solid #333;border-bottom:3px double #333;font-weight:700;font-size:13px;margin-top:3px;padding:6px 0;}
    .words{font-size:11.5px;margin:8px 0 12px;font-style:italic;}
    .bank-block{border:1px solid #d7d7d7;padding:8px 10px;font-size:11px;margin-bottom:12px;}
    .bank-block b{font-family:Arial,sans-serif;}
    .note-box{border:1px solid #d7d7d7;padding:8px 10px;font-size:11px;margin-bottom:12px;background:#fbfbfb;}
    .sig-row{display:flex;gap:24px;margin-top:34px;}
    .sig-cell{flex:1;text-align:center;}
    .sig-line{border-top:1px solid #333;margin-bottom:4px;}
    .sig-lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#555;font-family:Arial,sans-serif;}
    .stamp{float:right;border:2px solid #b00;color:#b00;padding:4px 12px;font-weight:700;letter-spacing:2px;transform:rotate(-6deg);font-family:Arial,sans-serif;font-size:13px;}
  `;
}
function prCustomerParty(customerId, title) {
  const c = (typeof customers !== 'undefined' ? customers : []).find(x => x.id === customerId);
  if (!c) return { title: title || 'To', lines: ['—'] };
  return { title: title || 'To', lines: [c.name, c.contactPerson, c.address, c.tel ? 'Tel ' + c.tel : '', c.vatNo ? 'VAT ' + c.vatNo : ''] };
}
function prSupplierParty(supplierId, title) {
  const s = (typeof suppliers !== 'undefined' ? suppliers : []).find(x => x.id === supplierId);
  if (!s) return { title: title || 'Supplier', lines: ['—'] };
  return { title: title || 'Supplier', lines: [s.name, s.contactPerson, s.address, s.telephone ? 'Tel ' + s.telephone : '', s.vatNo ? 'VAT ' + s.vatNo : ''] };
}
function prBankBlock() {
  return `<div class="bank-block"><b>PAYMENT DETAILS</b><br>
    ${prEsc(PRINT_COMPANY.bankName)} &nbsp;|&nbsp; A/C Name: ${prEsc(PRINT_COMPANY.bankAccountName)}<br>
    A/C No: ${prEsc(PRINT_COMPANY.bankAccountNo)} &nbsp;|&nbsp; IBAN: ${prEsc(PRINT_COMPANY.iban)}</div>`;
}

// ── Tax Invoice ────────────────────────────────────────────────────
function buildTaxInvoicePrintHTML(invoiceId) {
  const inv = (typeof taxInvoices !== 'undefined' ? taxInvoices : []).find(i => i.id === invoiceId);
  if (!inv) return prDocShell({ title: 'Tax Invoice', bodyHTML: '<p>That invoice no longer exists.</p>' });
  const job = (typeof jobCards !== 'undefined' ? jobCards : []).find(j => j.id === inv.jobId);
  const t = inv.totals || {};
  const pct = Number(t.invoicedPercent) || 100;
  const part = pct < 100;
  const rows = (inv.items || []).map((it, i) => {
    const lineNet = (Number(it.amount) || 0) * (pct / 100);
    return `<tr><td class="c">${i + 1}</td><td>${prEsc(it.description)}</td>
      <td class="c">${prQty(it.qty)} ${prEsc(it.unit || '')}</td>
      <td class="n">${prFmt(it.rate)}</td><td class="n">${prFmt(lineNet)}</td></tr>`;
  }).join('');
  const paid = Number(inv.paidAmount) || 0, credited = Number(inv.creditedAmount) || 0;
  const balance = Math.round(((t.netTotal || 0) - paid - credited) * 1000) / 1000;
  return prDocShell({
    title: 'Tax Invoice', docNo: inv.id,
    meta: [['Invoice No', inv.id], ['Date', inv.date], ['Job No', inv.jobId || '—'],
      ['Project', job ? job.projectName : '—'], ['Quotation', inv.quotationId || '—'], ['LPO No', inv.lpoNo || '—'],
      ['TRN', PRINT_COMPANY.trn]],
    party: prCustomerParty(inv.customerId, 'Bill To'),
    bodyHTML:
      (part ? `<div class="note-box">This invoice covers <b>${pct}%</b> of the job value. Earlier and later invoices cover the rest.</div>` : '') +
      `<table class="doc"><tr><th class="c" style="width:38px">#</th><th>Description</th><th class="c" style="width:110px">Qty</th><th class="n" style="width:100px">Rate</th><th class="n" style="width:120px">Amount</th></tr>
        ${rows || '<tr><td colspan="5">No lines on this invoice.</td></tr>'}</table>
      <div class="tot-stack">
        <div><span>Total${part ? ' (' + pct + '%)' : ''}</span><span>${prFmt(t.total * pct / 100)}</span></div>
        <div><span>VAT</span><span>${prFmt(t.vat)}</span></div>
        <div class="grand"><span>Net Amount (BD)</span><span>${prFmt(t.netTotal)}</span></div>
        ${(paid || credited) ? `<div><span>Received</span><span>${prFmt(paid)}</span></div>
        ${credited ? `<div><span>Credited</span><span>${prFmt(credited)}</span></div>` : ''}
        <div class="grand"><span>Balance Due (BD)</span><span>${prFmt(balance)}</span></div>` : ''}
      </div>
      <div style="clear:both"></div>
      <div class="words">Amount in words: ${prEsc(numberToWordsBD(t.netTotal || 0))}</div>` + prBankBlock(),
    signatures: ['Prepared By', 'For Al Maraya Decor', 'Received By']
  });
}
function printTaxInvoice(invoiceId) { printOpenHTML(buildTaxInvoicePrintHTML(invoiceId)); }

// ── Proforma ───────────────────────────────────────────────────────
function buildProformaPrintHTML(proformaId) {
  const p = (typeof proformas !== 'undefined' ? proformas : []).find(x => x.id === proformaId);
  if (!p) return prDocShell({ title: 'Proforma Invoice', bodyHTML: '<p>That proforma no longer exists.</p>' });
  const job = (typeof jobCards !== 'undefined' ? jobCards : []).find(j => j.id === p.jobId);
  const items = (p.items && p.items.length ? p.items : (job ? job.items.map(it => ({ description: it.product, qty: it.qty, unit: it.unit, rate: it.rate, amount: it.amount })) : []));
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const net = Number(p.amount) || Number((p.totals || {}).netTotal) || total;
  return prDocShell({
    title: 'Proforma Invoice', subtitle: 'Not a tax invoice', docNo: p.id,
    meta: [['Proforma No', p.id], ['Date', p.date], ['Job No', p.jobId || '—'], ['Project', job ? job.projectName : '—']],
    party: prCustomerParty(p.customerId || (job && job.customerId), 'To'),
    bodyHTML: `<table class="doc"><tr><th class="c" style="width:38px">#</th><th>Description</th><th class="c" style="width:110px">Qty</th><th class="n" style="width:100px">Rate</th><th class="n" style="width:120px">Amount</th></tr>
      ${items.map((it, i) => `<tr><td class="c">${i + 1}</td><td>${prEsc(it.description || it.product)}</td><td class="c">${prQty(it.qty)} ${prEsc(it.unit || '')}</td><td class="n">${prFmt(it.rate)}</td><td class="n">${prFmt(it.amount)}</td></tr>`).join('') || '<tr><td colspan="5">No lines.</td></tr>'}</table>
      <div class="tot-stack"><div class="grand"><span>Amount (BD)</span><span>${prFmt(net)}</span></div></div>
      <div style="clear:both"></div>
      <div class="words">Amount in words: ${prEsc(numberToWordsBD(net))}</div>
      <div class="note-box">A proforma is a quotation of what will be invoiced. VAT is charged, and reclaimable, only on the tax invoice that follows.</div>` + prBankBlock(),
    signatures: ['Prepared By', 'For Al Maraya Decor']
  });
}
function printProforma(proformaId) { printOpenHTML(buildProformaPrintHTML(proformaId)); }

// ── Delivery Note ──────────────────────────────────────────────────
function buildDeliveryNotePrintHTML(jobId, noteId) {
  const job = (typeof jobCards !== 'undefined' ? jobCards : []).find(j => j.id === jobId);
  const note = job && (job.deliveryNotes || []).find(n => n.id === noteId);
  if (!note) return prDocShell({ title: 'Delivery Note', bodyHTML: '<p>That delivery note no longer exists.</p>' });
  return prDocShell({
    title: 'Delivery Note', docNo: note.id,
    meta: [['Delivery Note', note.id], ['Date', note.date], ['Job No', job.id], ['Project', job.projectName],
      ['Site', (customers.find(c => c.id === job.customerId) || {}).address || '—']],
    party: prCustomerParty(job.customerId, 'Deliver To'),
    bodyHTML: `<table class="doc"><tr><th class="c" style="width:38px">#</th><th>Item</th><th class="c" style="width:120px">Delivered</th><th class="c" style="width:120px">Ordered</th></tr>
      ${(note.lines || []).map((l, i) => {
        const item = job.items.find(it => it.lineId === l.lineId) || {};
        return `<tr><td class="c">${i + 1}</td><td>${prEsc(item.product || '')}${item.description ? `<div style="color:#555;font-size:10.5px">${prEsc(item.description)}</div>` : ''}</td>
          <td class="c">${prQty(l.requiredQty)} ${prEsc(item.unit || '')}</td><td class="c">${prQty(item.qty)} ${prEsc(item.unit || '')}</td></tr>`;
      }).join('') || '<tr><td colspan="4">Nothing on this note.</td></tr>'}</table>
      <div class="note-box">No prices appear on a delivery note. Goods remain the property of Al Maraya Decor until paid for in full. Please check the quantities above before signing.</div>`,
    signatures: ['Delivered By', 'Driver / Vehicle', 'Received By (name, sign, date)']
  });
}
function printDeliveryNote(jobId, noteId) { printOpenHTML(buildDeliveryNotePrintHTML(jobId, noteId)); }

// ── Purchase Order ─────────────────────────────────────────────────
function buildPurchaseOrderPrintHTML(poId) {
  const po = (typeof purchaseOrders !== 'undefined' ? purchaseOrders : []).find(p => p.id === poId);
  if (!po) return prDocShell({ title: 'Purchase Order', bodyHTML: '<p>That purchase order no longer exists.</p>' });
  const items = po.items || [];
  const total = items.reduce((s, it) => s + ((Number(it.qty) || 0) * (Number(it.rateBD) || 0)), 0);
  const vat = items.reduce((s, it) => s + ((Number(it.qty) || 0) * (Number(it.rateBD) || 0) * ((Number(it.vatPercent) || 0) / 100)), 0);
  const job = po.linkedJobId ? (jobCards.find(j => j.id === po.linkedJobId) || {}) : null;
  return prDocShell({
    title: 'Purchase Order', docNo: po.id,
    meta: [['PO No', po.id], ['Date', po.date], ['Payment', po.paymentMode || '—'],
      ['Our Ref', po.supplierRef || '—'], ['For Job', po.linkedJobId || (po.destinationType === 'inventory' ? 'Stock' : '—')],
      ['Project', job ? job.projectName : '—'], ['TRN', PRINT_COMPANY.trn]],
    party: prSupplierParty(po.supplierId, 'Supplier'),
    bodyHTML: `<table class="doc"><tr><th class="c" style="width:38px">#</th><th>Item / Service</th><th class="c" style="width:100px">Qty</th><th class="n" style="width:90px">Rate</th><th class="n" style="width:70px">VAT%</th><th class="n" style="width:110px">Amount</th></tr>
      ${items.map((it, i) => `<tr><td class="c">${i + 1}</td><td>${prEsc(it.productService || it.itemName || it.name)}</td>
        <td class="c">${prQty(it.qty)} ${prEsc(it.unit || '')}</td><td class="n">${prFmt(it.rateBD)}</td>
        <td class="n">${Number(it.vatPercent) || 0}</td><td class="n">${prFmt((Number(it.qty) || 0) * (Number(it.rateBD) || 0))}</td></tr>`).join('') || '<tr><td colspan="6">No lines on this order.</td></tr>'}</table>
      <div class="tot-stack">
        <div><span>Total</span><span>${prFmt(total)}</span></div>
        <div><span>VAT</span><span>${prFmt(vat)}</span></div>
        <div class="grand"><span>Order Value (BD)</span><span>${prFmt(total + vat)}</span></div>
      </div><div style="clear:both"></div>
      <div class="note-box"><b>Terms.</b> Please quote our PO number on your delivery note and invoice. Deliver to the address in the footer unless a site is named above.
      Goods are subject to inspection on arrival; short or damaged items will be recorded on our goods receipt and claimed.
      ${po.deliveryTerms ? '<br><b>Delivery:</b> ' + prEsc(po.deliveryTerms) : ''}</div>`,
    signatures: ['Prepared By', 'Approved By', 'Supplier Acknowledgement']
  });
}
function printPurchaseOrder(poId) { printOpenHTML(buildPurchaseOrderPrintHTML(poId)); }

// ── Goods Receipt (17a) ────────────────────────────────────────────
function buildGoodsReceiptPrintHTML(grnId) {
  const g = (typeof goodsReceipts !== 'undefined' ? goodsReceipts : []).find(x => x.id === grnId);
  if (!g) return prDocShell({ title: 'Goods Receipt', bodyHTML: '<p>That goods receipt no longer exists.</p>' });
  const po = (typeof purchaseOrders !== 'undefined' ? purchaseOrders : []).find(p => p.id === g.poId);
  return prDocShell({
    title: 'Goods Receipt', docNo: g.id,
    meta: [['GRN No', g.id], ['Date', g.date], ['Against PO', g.poId || '—'], ['Result', (g.result || '').toUpperCase()],
      ['Received By', g.receivedBy || '—']],
    party: prSupplierParty(po && po.supplierId, 'Received From'),
    bodyHTML: `<table class="doc"><tr><th class="c" style="width:38px">#</th><th>Item</th><th class="c" style="width:100px">Ordered</th><th class="c" style="width:100px">Received</th><th class="c" style="width:100px">Short / Over</th></tr>
      ${(g.lines || []).map((l, i) => {
        const diff = (Number(l.receivedQty) || 0) - (Number(l.orderedQty) || 0);
        return `<tr><td class="c">${i + 1}</td><td>${prEsc(l.name || l.itemName || '')}</td>
          <td class="c">${prQty(l.orderedQty)}</td><td class="c">${prQty(l.receivedQty)}</td>
          <td class="c">${diff === 0 ? '—' : (diff > 0 ? '+' : '') + prQty(diff)}</td></tr>`;
      }).join('') || '<tr><td colspan="5">No lines booked in.</td></tr>'}</table>
      ${g.claimState && g.claimState !== 'none' ? `<div class="note-box"><b>Claim ${prEsc(g.claimState)}.</b> ${prEsc(g.claimNote || '')}</div>` : ''}`,
    signatures: ['Store', 'Checked By', 'Supplier / Driver']
  });
}
function printGoodsReceipt(grnId) { printOpenHTML(buildGoodsReceiptPrintHTML(grnId)); }

// ── Vouchers: receipt, credit note, payment, debit note, journal ────
// One builder. A voucher is a party, an amount, and what it was set
// against — only the words and the sign change between them.
function buildVoucherPrintHTML(kind, id) {
  const K = {
    receipt: { title: 'Receipt Voucher', arr: () => salesReceipts, party: 'customer', dateKey: 'receiptDate', partyKey: 'customerId', note: 'Received with thanks' },
    creditnote: { title: 'Credit Note', arr: () => salesCreditNotes, party: 'customer', dateKey: 'creditNoteDate', partyKey: 'customerId', note: 'Credited to your account' },
    payment: { title: 'Payment Voucher', arr: () => payments, party: 'supplier', dateKey: 'paymentDate', partyKey: 'supplierId', note: 'Paid' },
    debitnote: { title: 'Debit Note', arr: () => debitNotes, party: 'supplier', dateKey: 'debitNoteDate', partyKey: 'supplierId', note: 'Debited to your account' },
    journal: { title: 'Journal Voucher', arr: () => journals, party: null, dateKey: 'date', partyKey: null, note: '' }
  }[kind];
  if (!K) return prDocShell({ title: 'Voucher', bodyHTML: '<p>Unknown voucher type.</p>' });
  const v = (K.arr() || []).find(x => x.id === id);
  if (!v) return prDocShell({ title: K.title, bodyHTML: `<p>That ${K.title.toLowerCase()} no longer exists.</p>` });

  if (kind === 'journal') {
    const led = (lid) => ((typeof ledgers !== 'undefined' ? ledgers : []).find(l => l.id === lid) || {}).name || lid || '—';
    return prDocShell({
      title: 'Journal Voucher', docNo: v.id,
      meta: [['Voucher No', v.id], ['Date', v.date]],
      bodyHTML: `<table class="doc"><tr><th>Ledger</th><th>Narration</th><th class="c" style="width:110px">Job</th><th class="n" style="width:110px">Debit</th><th class="n" style="width:110px">Credit</th></tr>
        ${(v.lines || []).map(l => `<tr><td>${prEsc(led(l.ledgerId))}</td><td>${prEsc(l.narration || '')}</td><td class="c">${prEsc(l.jobId || '—')}</td>
          <td class="n">${l.dr ? prFmt(l.dr) : ''}</td><td class="n">${l.cr ? prFmt(l.cr) : ''}</td></tr>`).join('')}
        <tr class="tot"><td colspan="3">Total</td><td class="n">${prFmt(v.drTotal)}</td><td class="n">${prFmt(v.crTotal)}</td></tr></table>
        ${v.remarks ? `<div class="note-box">${prEsc(v.remarks)}</div>` : ''}`,
      signatures: ['Prepared By', 'Checked By', 'Approved By']
    });
  }

  const methods = Object.entries(v.methods || {}).filter(([, m]) => m && m.enabled && Number(m.amount))
    .map(([k, m]) => `${k === 'cCard' ? 'Card' : k.charAt(0).toUpperCase() + k.slice(1)} ${prFmt(m.amount)}`).join(' · ');
  const allocs = (v.allocations || []).filter(a => a.invoiceId);
  const cancelled = v.status === 'cancelled';
  return prDocShell({
    title: K.title, docNo: v.id,
    meta: [['Voucher No', v.id], ['Date', v[K.dateKey]], ['Division', v.division || '—'],
      methods ? ['Mode', methods] : null, v.referenceNumber ? ['Reference', v.referenceNumber] : null].filter(Boolean),
    party: K.party === 'customer' ? prCustomerParty(v[K.partyKey], 'From') : prSupplierParty(v[K.partyKey], 'To'),
    bodyHTML: (cancelled ? '<div class="stamp">CANCELLED</div><div style="clear:both"></div>' : '') +
      `<div class="tot-stack" style="margin:0 0 12px 0;width:340px;">
        <div class="grand"><span>${prEsc(K.note)} (BD)</span><span>${prFmt(v.amount)}</span></div>
      </div>
      <div class="words">Amount in words: ${prEsc(numberToWordsBD(v.amount))}</div>
      ${allocs.length ? `<table class="doc"><tr><th>Set against</th><th class="n" style="width:130px">Amount</th>${kind === 'payment' ? '<th class="n" style="width:120px">Discount</th>' : ''}</tr>
        ${allocs.map(a => `<tr><td>${prEsc(a.invoiceId)}</td><td class="n">${prFmt(a.payingAmount || a.amount || a.appliedAmount)}</td>${kind === 'payment' ? `<td class="n">${prFmt(a.discountAmount)}</td>` : ''}</tr>`).join('')}
        </table>` : `<div class="note-box">Not set against a specific invoice — held on account.</div>`}
      ${v.reason ? `<div class="note-box"><b>Reason.</b> ${prEsc(v.reason)}</div>` : ''}
      ${v.remarks ? `<div class="note-box">${prEsc(v.remarks)}</div>` : ''}`,
    signatures: kind === 'receipt' || kind === 'creditnote' ? ['Prepared By', 'For Al Maraya Decor'] : ['Prepared By', 'Approved By', 'Received By']
  });
}
function printVoucher(kind, id) { printOpenHTML(buildVoucherPrintHTML(kind, id)); }

// ── Material Issue / Return note ───────────────────────────────────
function buildMaterialMovePrintHTML(jobId, kind, moveId) {
  const job = (typeof jobCards !== 'undefined' ? jobCards : []).find(j => j.id === jobId);
  const list = job ? (kind === 'return' ? job.materialsReturns : job.materialsIssues) || [] : [];
  const move = list.find(m => m.id === moveId);
  if (!move) return prDocShell({ title: 'Material Note', bodyHTML: '<p>That movement no longer exists.</p>' });
  const total = (move.items || []).reduce((s, it) => s + ((Number(it.qty) || 0) * (Number(it.rate) || 0)), 0);
  return prDocShell({
    title: kind === 'return' ? 'Material Return Note' : 'Material Issue Note', docNo: move.id,
    meta: [['Note No', move.id], ['Date', move.date], ['Job No', job.id], ['Project', job.projectName],
      ['Store', move.location || '—'], ['Status', (move.status || '').toUpperCase()]],
    bodyHTML: (move.status === 'cancelled' ? '<div class="stamp">CANCELLED</div><div style="clear:both"></div>' : '') +
      `<table class="doc"><tr><th class="c" style="width:38px">#</th><th>Item</th><th class="c" style="width:120px">Qty</th><th class="n" style="width:100px">Rate</th><th class="n" style="width:110px">Value</th><th class="c" style="width:90px">For line</th></tr>
      ${(move.items || []).map((it, i) => `<tr><td class="c">${i + 1}</td><td>${prEsc(it.name || it.stockItemName || '')}</td>
        <td class="c">${prQty(it.qty)} ${prEsc(it.unit || '')}</td><td class="n">${prFmt(it.rate)}</td>
        <td class="n">${prFmt((Number(it.qty) || 0) * (Number(it.rate) || 0))}</td>
        <td class="c">${it.lineId === null || it.lineId === undefined ? '—' : prEsc(String(it.lineId))}</td></tr>`).join('')}
      <tr class="tot"><td colspan="4">Total</td><td class="n">${prFmt(total)}</td><td></td></tr></table>
      <div class="note-box">Internal document. Every issue is booked against a job — the value above is what this movement adds to that job's actual material cost.</div>`,
    signatures: ['Store', kind === 'return' ? 'Returned By' : 'Issued To', 'Job / Crew Lead']
  });
}
function printMaterialMove(jobId, kind, moveId) { printOpenHTML(buildMaterialMovePrintHTML(jobId, kind, moveId)); }

// ── Statement of Account ───────────────────────────────────────────
function buildStatementPrintHTML({ party = 'customer', partyId, from = '', to = '' } = {}) {
  const st = getStatementOfAccount({ party, partyId, from, to });
  if (!st || st.error) return prDocShell({ title: 'Statement of Account', bodyHTML: `<p>${prEsc((st && st.error) || 'Not found.')}</p>` });
  const owedLabel = party === 'customer' ? 'Balance due to Al Maraya Decor' : 'Balance due to supplier';
  return prDocShell({
    title: 'Statement of Account',
    subtitle: (from || to) ? `${from || 'the beginning'} to ${to || 'today'}` : 'All transactions',
    docNo: st.partyId,
    meta: [['Account', st.name], ['Period', (from || '—') + ' to ' + (to || 'today')], ['Printed', todayISO()],
      st.vatNo ? ['VAT No', st.vatNo] : null].filter(Boolean),
    party: { title: party === 'customer' ? 'Statement For' : 'Supplier', lines: [st.name, st.contact, st.address, st.tel ? 'Tel ' + st.tel : ''] },
    bodyHTML: `<table class="doc">
      <tr><th class="c" style="width:92px">Date</th><th style="width:120px">Type</th><th style="width:130px">Reference</th><th>Particulars</th>
        <th class="n" style="width:100px">Debit</th><th class="n" style="width:100px">Credit</th><th class="n" style="width:110px">Balance</th></tr>
      <tr class="sec"><td colspan="6">Opening balance</td><td class="n">${prFmt(st.openingBalance)}</td></tr>
      ${st.rows.map(r => `<tr><td class="c">${prEsc(r.date)}</td><td>${prEsc(r.type)}</td><td>${prEsc(r.ref)}</td><td>${prEsc(r.particulars)}</td>
        <td class="n">${r.debit ? prFmt(r.debit) : ''}</td><td class="n">${r.credit ? prFmt(r.credit) : ''}</td><td class="n">${prFmt(r.balance)}</td></tr>`).join('')
        || '<tr><td colspan="7">No transactions in this period.</td></tr>'}
      <tr class="tot"><td colspan="4">Totals</td><td class="n">${prFmt(st.totals.debit)}</td><td class="n">${prFmt(st.totals.credit)}</td><td class="n">${prFmt(st.closingBalance)}</td></tr>
    </table>
    <div class="tot-stack"><div class="grand"><span>${owedLabel} (BD)</span><span>${prFmt(st.closingBalance)}</span></div></div>
    <div style="clear:both"></div>
    <div class="words">Closing balance in words: ${prEsc(numberToWordsBD(Math.abs(st.closingBalance)))}${st.closingBalance < 0 ? ' (in your favour)' : ''}</div>
    ${party === 'customer' ? prBankBlock() : ''}
    <div class="note-box">Please advise us in writing within 7 days of any difference. This statement reflects documents raised up to the print date above.</div>`,
    signatures: ['Prepared By', 'For Al Maraya Decor']
  });
}
function printStatement(opts) { printOpenHTML(buildStatementPrintHTML(opts)); }

// ── Any report ─────────────────────────────────────────────────────
// cols: [{ label, key, align, fmt }] · rows: objects · totals: same shape.
// Used by the Day Book, Ledger Report, Trial Balance, P&L, Balance Sheet,
// the registers, consumption and item history — one printer, so a report
// on screen and the same report on paper cannot drift.
function buildReportPrintHTML({ title, subtitle = '', meta = [], cols = [], rows = [], totalRow = null, noteHTML = '', landscape = false }) {
  const cell = (c, r, isTot) => {
    const raw = typeof c.key === 'function' ? c.key(r) : r[c.key];
    const v = c.fmt === 'bd' ? (raw === '' || raw === null || raw === undefined ? '' : prFmt(raw))
      : c.fmt === 'qty' ? (raw === '' || raw === null || raw === undefined ? '' : prQty(raw)) : (raw === undefined || raw === null ? '' : raw);
    return `<td class="${c.align === 'right' || c.fmt === 'bd' || c.fmt === 'qty' ? 'n' : c.align === 'center' ? 'c' : ''}">${isTot ? '<b>' + prEsc(v) + '</b>' : prEsc(v)}</td>`;
  };
  return prDocShell({
    title, subtitle, meta,
    bodyHTML: `<table class="doc">
      <tr>${cols.map(c => `<th class="${c.align === 'right' || c.fmt === 'bd' || c.fmt === 'qty' ? 'n' : c.align === 'center' ? 'c' : ''}"${c.width ? ` style="width:${c.width}"` : ''}>${prEsc(c.label)}</th>`).join('')}</tr>
      ${rows.length ? rows.map(r => r.__section
        ? `<tr class="sec"><td colspan="${cols.length}">${prEsc(r.__section)}</td></tr>`
        : `<tr>${cols.map(c => cell(c, r)).join('')}</tr>`).join('')
        : `<tr><td colspan="${cols.length}">Nothing to report for this selection.</td></tr>`}
      ${totalRow ? `<tr class="tot">${cols.map(c => cell(c, totalRow, true)).join('')}</tr>` : ''}
    </table>${noteHTML}`,
    landscape
  });
}
function printReport(opts) { printOpenHTML(buildReportPrintHTML(opts)); }
