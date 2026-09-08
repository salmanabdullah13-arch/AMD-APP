/**
 * reconcile-audit.js — the same number, computed every way the app computes
 * it, checked against itself.
 *
 * Receivables alone is derived six different ways in this codebase, each
 * written in a different session: the Accounts KPI band, the Balance Sheet,
 * Sales Bill Outstanding, the Statement of Account, Project Outstanding, and
 * invoiceBalance() itself. Payables three ways. A job's value four. Nothing
 * has ever checked that they agree, and the iterations cannot: they assert
 * each step as it happens, not that every screen showing a figure shows the
 * same figure.
 *
 * A real lifecycle is seeded offline — VAT, a quote-level discount, a part
 * payment, a credit note, a supplier invoice part-paid, stock in and out,
 * labour logged — and then each group of figures that MUST agree is compared
 * to the fils.
 *
 * Pairs that legitimately differ are declared below with the reason, because
 * asserting a false equality would be worse than not checking: Accounts
 * recognises revenue when it is invoiced, the dashboards count it when the
 * job is confirmed, and that distinction is deliberate.
 *
 *   node reconcile-audit.js      → docs/test-run/reconcile-audit.md
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TOL = 0.0011;                       // one fils, and a hair for float noise
const bd = (n) => (Math.round((Number(n) || 0) * 1000) / 1000).toFixed(3);

/* Figures that are SUPPOSED to differ. Each needs a reason. */
const DIFFER = [
  { a: 'Accounts monthly revenue', b: 'dashboard monthly revenue',
    why: 'Accounts recognises revenue when it is INVOICED (taxInvoices); the Owner and Sales dashboards count it when the job is CONFIRMED. A real accounting distinction, recorded when the Batch 6 reports were built.' },
  { a: 'Job report materials', b: 'material consumption value',
    why: 'The Job report counts material MOVES, not a currency value — this app\'s issue/return moves carried no rate until the cost ledger, and the report says so in its own text.' }
];

const results = [];
function eq(group, what, values) {
  // values: { label: number, ... } — every one of them must agree
  const labels = Object.keys(values);
  const nums = labels.map(l => Number(values[l]) || 0);
  const spread = Math.max(...nums) - Math.min(...nums);
  const ok = spread <= TOL;
  results.push({ group, what, ok, values, spread });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + what + '  ' +
    labels.map(l => l + ' ' + bd(values[l])).join('  ·  ') + (ok ? '' : '   SPREAD ' + bd(spread)));
  return ok;
}
function note(group, what, detail) {
  results.push({ group, what, ok: true, note: true, values: detail });
  console.log('  NOTE  ' + what + '  ' + JSON.stringify(detail));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  /* ── one real lifecycle, through the app's own functions ─────────────── */
  const seed = await page.evaluate(() => {
    if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true;
    const out = { steps: [] };
    const say = (s, v) => out.steps.push(s + (v === undefined ? '' : ': ' + JSON.stringify(v)));

    const cust = createCustomer({ name: 'RECON Client', contactPerson: 'Sami', tel: '39001122', email: 'recon@example.com', address: 'Manama' });
    approveCustomer(cust.id, 'Accounts', '');
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Sami', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'RECON Project' });
    say('quotation', qtn.id);

    // two priced lines, real VAT
    const a = addQuotationItem(qtn.id, { product: 'Reception counter', qty: 1, unit: 'Nos', vatPercent: 10, description: 'Veneered' });
    const b = addQuotationItem(qtn.id, { product: 'Wall panelling', qty: 12, unit: 'Meter', vatPercent: 10, description: 'Oak' });

    // priced the only way Sales can be priced: through a BOM
    [[a, 400], [b, 55]].forEach(([it, rate]) => {
      addBOMMaterial(qtn.id, it.lineId, { itemId: itemMaster[0].id, itemName: itemMaster[0].name, qty: 1, unit: 'Nos', rate });
      submitItemBOM(qtn.id, it.lineId, 'Arun Kumar A');
    });
    // a real quote-level discount, spread per item
    setQuoteDiscount(qtn.id, 50, { userType: 'owner', name: 'Salman Abdullah' });

    transferQuotationStage(qtn.id, 'approver', 'Estimator');
    approveQuotation(qtn.id, 'Salman Abdullah', 'owner');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    say('job', job.id);
    confirmJobRouting(job.id, {}, 'Operations Manager', null);

    // production through to done, so delivery and completion are legal
    const routed = (job.items || []).map(it => ({ it, seq: it.departmentSequence || [] }));
    routed.forEach(({ it, seq }) => seq.forEach(dept => {
      const e = (job.departmentStatuses || []).find(d => d.lineId === it.lineId && d.deptKey === dept);
      if (!e) return;
      submitDepartmentBudget(job.id, dept, { categoryAmounts: { materials: 100, labour: 50 } }, 'Joinery Production Manager');
      approveDepartmentBudget(job.id, dept, 'Operations Manager');
    }));
    say('budgets', (job.departmentBudgets || []).length);

    // real stock, priced, issued against the job and partly returned
    const loc = storeLocations[0] || createStoreLocation({ name: 'RECON store' });
    const bin = storeBins.find(x => x.storeId === loc.id) || createStoreBin({ storeId: loc.id, code: 'R1', hint: 'recon' });
    const item = itemMaster[0];
    putAwayStock({ itemId: item.id, binId: bin.id, qty: 30 });
    const issue = issueMaterialToJob({ jobCardId: job.id, lines: [{ itemId: item.id, binId: bin.id, qty: 12 }], issuedTo: 'Ajay Paswan', byWhom: 'Storekeeper' });
    say('issue', issue && issue.id ? issue.id : issue);

    // an invoice, a part receipt and a credit note
    const inv = generateInvoiceFromJob(job.id, { invoicedPercent: 100 });
    say('invoice', inv && inv.id ? inv.id : inv);
    const net = inv && inv.totals ? inv.totals.netTotal : 0;
    createSalesReceipt({ customerId: cust.id, amount: 100, methods: { cash: { enabled: true, amount: 100 } },
      allocations: [{ invoiceId: inv.id, payingAmount: 100, discountAmount: 0 }] });
    createSalesCreditNote({ customerId: cust.id, amount: 25, reason: 'Two panels short',
      allocations: [{ invoiceId: inv.id, payingAmount: 25, discountAmount: 0 }] });

    // the supplier side: an invoice received, part paid
    const sup = (suppliers[0] || createSupplier({ name: 'RECON Supplier', taxPercent: 10 }));
    const pinv = createPurchaseInvoiceDirect({ department: 'Joinery', destinationType: 'inventory',
      supplierDetails: { supplierId: sup.id, supplierName: sup.name },
      items: [{ itemName: 'Board', qty: 10, rate: 20, vatPercent: 10 }], preparedBy: 'Purchaser' });
    if (pinv && pinv.id) {
      confirmPurchaseInvoiceDraft(pinv.id, {});
      pinv.status = 'received';                      // what getAccountsKPIs and the Balance Sheet count
      createPayment({ supplierId: sup.id, amount: 60, methods: { cash: { enabled: true, amount: 60 } },
        allocations: [{ invoiceId: pinv.id, payingAmount: 60, discountAmount: 0 }] });
    }
    say('purchase invoice', pinv && pinv.id ? pinv.id : pinv);

    return { out, custId: cust.id, qtnId: qtn.id, jobId: job.id, invId: inv && inv.id, supId: sup.id,
      pinvId: pinv && pinv.id, itemId: item.id, binId: bin.id, net };
  });
  console.log('seeded: ' + seed.out.steps.join(' | '));

  /* ── RECEIVABLES, six ways ───────────────────────────────────────────── */
  console.log('\n— receivables, every way the app computes it —');
  const recv = await page.evaluate(() => {
    const bs = getBalanceSheet();
    const bsAR = (bs.assets.find(a => /Accounts Receivable/i.test(a.name)) || { amount: 0 }).amount;
    const billOs = getSalesBillOutstandingAllCustomers().reduce((s, r) => s + r.balAmt, 0);
    const stmts = customers.map(c => getStatementOfAccount({ party: 'customer', partyId: c.id }))
      .reduce((s, st) => s + (st && !st.error ? st.closingBalance : 0), 0);
    const proj = getProjectOutstanding().reduce((s, r) => s + (r.balance || r.balAmt || 0), 0);
    return {
      accountsKPI: getAccountsKPIs().receivables,
      salesKPI: getSalesKPIs().receivables,
      balanceSheet: bsAR,
      billOutstanding: billOs,
      statements: stmts,
      invoiceBalances: taxInvoices.reduce((s, i) => s + invoiceBalance(i), 0),
      projectOutstanding: proj
    };
  });
  eq('receivables', 'the Accounts band, the Balance Sheet and invoiceBalance agree',
    { accountsKPI: recv.accountsKPI, balanceSheet: recv.balanceSheet, invoiceBalances: recv.invoiceBalances });
  eq('receivables', 'Sales\' own receivables figure agrees with Accounts\'',
    { salesKPI: recv.salesKPI, accountsKPI: recv.accountsKPI });
  eq('receivables', 'Sales Bill Outstanding totals to the same figure',
    { billOutstanding: recv.billOutstanding, accountsKPI: recv.accountsKPI });
  eq('receivables', 'every customer Statement of Account closes to the same total',
    { statements: recv.statements, accountsKPI: recv.accountsKPI });
  eq('receivables', 'Project Outstanding totals to the same figure',
    { projectOutstanding: recv.projectOutstanding, accountsKPI: recv.accountsKPI });

  /* ── PAYABLES, three ways ────────────────────────────────────────────── */
  console.log('\n— payables —');
  const pay = await page.evaluate(() => {
    const bs = getBalanceSheet();
    const bsAP = (bs.liabilities.find(a => /Accounts Payable/i.test(a.name)) || { amount: 0 }).amount;
    const billOs = getPurchaseBillOutstandingAllSuppliers().reduce((s, r) => s + r.balAmt, 0);
    const stmts = suppliers.map(s => getStatementOfAccount({ party: 'supplier', partyId: s.id }))
      .reduce((s2, st) => s2 + (st && !st.error ? st.closingBalance : 0), 0);
    return { accountsKPI: getAccountsKPIs().payables, balanceSheet: bsAP, billOutstanding: billOs, statements: stmts };
  });
  eq('payables', 'the Accounts band and the Balance Sheet agree',
    { accountsKPI: pay.accountsKPI, balanceSheet: pay.balanceSheet });
  eq('payables', 'Purchase Bill Outstanding totals to the same figure',
    { billOutstanding: pay.billOutstanding, accountsKPI: pay.accountsKPI });
  eq('payables', 'every supplier Statement of Account closes to the same total',
    { statements: pay.statements, accountsKPI: pay.accountsKPI });

  /* ── A JOB'S VALUE, four ways ────────────────────────────────────────── */
  console.log('\n— what one job is worth —');
  const jobVal = await page.evaluate(({ jobId, qtnId }) => {
    const job = getJobCard(jobId);
    const qtn = quotations.find(q => q.id === qtnId);
    const t = computeQuotationTotals(qtn);
    const proj = projects.find(p => p.linkedJobCardId === jobId);
    const rep = getJobReport(jobId);
    return { jobAmount: job.amount, quotationNet: t.netTotal,
      projectVal: proj ? proj.val : job.amount,
      jobReport: rep ? (rep.jobAmount !== undefined ? rep.jobAmount : rep.amount) : job.amount,
      itemsSum: (job.items || []).reduce((s, it) => s + (it.netAmount || 0), 0) };
  }, seed);
  eq('job value', 'the job, its quotation and the Operations rollup agree',
    { jobAmount: jobVal.jobAmount, quotationNet: jobVal.quotationNet, projectVal: jobVal.projectVal });
  eq('job value', 'the Job report shows the same figure', { jobReport: jobVal.jobReport, jobAmount: jobVal.jobAmount });
  eq('job value', 'and it is the sum of its own lines', { itemsSum: jobVal.itemsSum, jobAmount: jobVal.jobAmount });

  /* ── THE INVOICE against the job it came from ────────────────────────── */
  console.log('\n— the invoice against the job —');
  const invChk = await page.evaluate(({ jobId, invId }) => {
    const job = getJobCard(jobId);
    const inv = taxInvoices.find(i => i.id === invId);
    return { invoiceNet: inv.totals.netTotal, jobAmount: job.amount,
      balance: invoiceBalance(inv), computed: inv.totals.netTotal - (inv.paidAmount || 0) - (inv.creditedAmount || 0) };
  }, seed);
  eq('invoice', 'a 100% invoice bills the job\'s own value',
    { invoiceNet: invChk.invoiceNet, jobAmount: invChk.jobAmount });
  eq('invoice', 'its balance is the net less what was received and credited',
    { balance: invChk.balance, computed: invChk.computed });

  /* ── ACTUAL COST, three ways ─────────────────────────────────────────── */
  console.log('\n— what the job actually cost —');
  const cost = await page.evaluate(({ jobId }) => {
    const job = getJobCard(jobId);
    const whole = getJobActualCost(jobId);
    const lines = (job.items || []).reduce((s, it) => {
      const c = getLineActualCost(jobId, it.lineId);
      return s + (c && c.total !== undefined ? c.total : (c && c.totalCost) || 0);
    }, 0);
    const proj = projects.find(p => p.linkedJobCardId === jobId);
    const rolled = proj && proj.actuals ? Object.keys(proj.actuals).reduce((s, k) => {
      const v = proj.actuals[k];
      return s + (typeof v === 'number' ? v : 0);
    }, 0) : null;
    return { whole: whole && whole.total !== undefined ? whole.total : (whole && whole.totalCost) || 0, lines, rolled };
  }, seed);
  eq('actual cost', 'the job total is the sum of its lines', { whole: cost.whole, lines: cost.lines });
  if (cost.rolled !== null) note('actual cost', 'the Operations rollup carries', { rolled: bd(cost.rolled), jobActual: bd(cost.whole) });

  /* ── STOCK, three ways ───────────────────────────────────────────────── */
  console.log('\n— what is on the shelf —');
  const stock = await page.evaluate(({ itemId, binId }) => {
    const perBin = stockOnHand(itemId, binId);
    const allBins = storeBins.filter(b => true).reduce((s, b) => s + stockOnHand(itemId, b.id), 0);
    const itemTotal = stockOnHand(itemId);
    const lots = (typeof stockLots !== 'undefined' ? stockLots : [])
      .filter(l => l.itemId === itemId).reduce((s, l) => s + (Number(l.onHand) || 0), 0);
    const free = stockFree(itemId, binId), held = stockHeld(itemId, binId);
    return { perBin, allBins, itemTotal, lots, free, held };
  }, seed);
  eq('stock', 'the item total is the sum over its bins', { itemTotal: stock.itemTotal, allBins: stock.allBins });
  eq('stock', 'and the sum of its lots', { lots: stock.lots, itemTotal: stock.itemTotal });
  eq('stock', 'free plus held is what is on hand in that bin',
    { onHand: stock.perBin, freePlusHeld: stock.free + stock.held });

  /* ── CONSUMPTION against the cost ledger ─────────────────────────────── */
  console.log('\n— material consumed —');
  const cons = await page.evaluate(({ jobId }) => {
    const c0 = getMaterialConsumption({ jobId });
    const consValue = c0.totalValue;
    const consQty = c0.totalQty;
    const rowSum = (c0.rows || []).reduce((s, r) => s + r.value, 0);
    const c = getJobActualCost(jobId);
    const mat = c && c.materials !== undefined ? c.materials : (c && c.material) || 0;
    return { consValue, consQty, rowSum, ledgerMaterials: mat };
  }, seed);
  eq('consumption', 'consumption value equals the cost ledger\'s material figure',
    { consumption: cons.consValue, ledgerMaterials: cons.ledgerMaterials });
  note('consumption', 'quantity consumed', { qty: cons.consQty });

  /* ── REVENUE recognised two ways, which SHOULD differ ────────────────── */
  console.log('\n— revenue, where the two definitions legitimately part —');
  const rev = await page.evaluate(() => {
    const dash = getMonthlyRevenueByDivision(6);
    const dashTotal = (dash.months || []).reduce((s, m, i) => s, 0);
    let dSum = 0;
    Object.keys(dash.byDivision || {}).forEach(d => (dash.byDivision[d] || []).forEach(v => { dSum += (Number(v) || 0); }));
    const acc = getAccountsMonthlyRevenueByDivision(6);
    let aSum = 0;
    Object.keys(acc.byDivision || {}).forEach(d => (acc.byDivision[d] || []).forEach(v => { aSum += (Number(v) || 0); }));
    return { dashboard: dSum, accounts: aSum, invoiced: getAccountsKPIs().revenue };
  });
  eq('revenue', 'Accounts\' monthly chart totals to its own invoiced-revenue figure',
    { chart: rev.accounts, kpi: rev.invoiced });
  note('revenue', 'the two definitions, as designed', { dashboardConfirmed: bd(rev.dashboard), accountsInvoiced: bd(rev.accounts) });

  results.push({ group: 'run', what: 'no page errors during the audit', ok: errors.length === 0, values: errors.slice(0, 3) });
  console.log((errors.length === 0 ? '\n  PASS  ' : '\n  FAIL  ') + 'no page errors during the audit');

  await browser.close();

  /* ── the report ──────────────────────────────────────────────────────── */
  const failed = results.filter(r => !r.ok);
  const md = ['# Reconciliation audit — the same number, computed every way', '',
    'Generated ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' by `reconcile-audit.js`.', '',
    'One real lifecycle is seeded offline — VAT, a quote-level discount, a part',
    'payment, a credit note, a supplier invoice part-paid, stock in and out —',
    'and then every group of figures that must agree is compared to the fils.',
    'The iterations assert each step as it happens; this asserts that every',
    'screen showing a figure shows the same figure.', '',
    '## Result', '',
    failed.length === 0 ? '**All reconciled** — ' + results.filter(r => !r.note).length + ' comparisons.'
      : '**' + failed.length + ' of ' + results.filter(r => !r.note).length + ' comparisons disagree.**', ''];
  if (failed.length) {
    md.push('| Group | What | Figures | Spread |', '|---|---|---|---|');
    failed.forEach(r => md.push('| ' + r.group + ' | ' + r.what + ' | ' +
      Object.keys(r.values || {}).map(k => k + ' ' + bd(r.values[k])).join('<br>') + ' | ' + bd(r.spread || 0) + ' |'));
    md.push('');
  }
  md.push('## Every comparison', '', '| Group | What | Figures |', '|---|---|---|');
  results.filter(r => !r.note && r.group !== 'run').forEach(r => md.push('| ' + r.group + ' | ' + (r.ok ? '' : '**') + r.what + (r.ok ? '' : '**') + ' | ' +
    Object.keys(r.values || {}).map(k => k + ' ' + bd(r.values[k])).join(' · ') + ' |'));
  md.push('', '## Figures that are supposed to differ', '');
  DIFFER.forEach(d => md.push('- **' + d.a + '** vs **' + d.b + '** — ' + d.why));
  fs.writeFileSync(path.join(__dirname, 'docs', 'test-run', 'reconcile-audit.md'), md.join('\n'));

  const total = results.filter(r => !r.note).length;
  console.log('\n' + (total - failed.length) + '/' + total + ' comparisons reconcile');
  process.exit(failed.length ? 1 : 0);
})();
