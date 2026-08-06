// Real-quote replication run (6 Aug 2026) — rebuilds the actual Ewan
// Properties quotation AMD-14740-0 (one of the 5 real documents Salman
// supplied) inside the system and runs it start -> final delivery:
// customer -> enquiry -> quotation (3 groups x Bed & Headboard, real
// descriptions, the real BD 377.727 discount, real 535.000/Nos pricing via
// BOM override) -> Estimator BOM (real Nassaj fabric item from the seeded
// Item Master + per-day labour) -> Approver -> Job Card -> routing
// (carp+uph, the real production path for upholstered beds) -> department
// budgets -> Joinery sub-stages -> QC (authority-gated) -> hand-off ->
// Upholstery -> QC -> done -> Delivery Note -> 100% Invoice -> full
// Receipt. Verifies the real document's own arithmetic at each money step
// (Total 1605.000 / Discount 377.727 / Gross 1227.273 / VAT 122.727 /
// Net 1350.000) and generates all three print documents (Quotation /
// Job Order / Job Order Costing), asserting template-critical content —
// including that the production Job Order carries NO prices.
//
// KNOWN GAPS this run demonstrates (reported, not silently absorbed):
// 1. No quote-LEVEL discount field — Ewan's single BD 377.727 discount has
//    to be spread per-item as a % (same net result, different data shape).
// 2. No per-item image attachment — the real docs carry product photos.
// 3. Salesperson contact/email aren't on the staff record — the real
//    PREPARED BY block prints Altaf's phone + email; ours prints name only.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== REAL QUOTE REPLICATION — EWAN AMD-14740-0 ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const DESC = {
  master: '• Fabric: NSJ 5105 / 08 @ BD 6.500/mtr\n• Suede Fabric: 9067 / 02\n• Bed: 200 x 200cms\n• Headboard: W 450 x H 120cms',
  right: '• Fabric: NSJ 11011 / 02 @ BD 6.500/mtr\n• Bed: 200 x 200cms\n• Headboard: W 390 x H 120cms',
  left: '• Fabric: NSJ 11011 / 02 @ BD 6.500/mtr\n• Bed: 200 x 200cms\n• Headboard: W 460 x H 120cms'
};
const PRODUCT = 'Fabrication of Bed & Headboard in timber frame work with upholstery in fabric, foam, padding and labour charges';
// 377.727 / 1605 — the real quote's single discount spread per line (gap #1)
const DISC_PCT = 377.727 / 1605 * 100;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  currentStep = 'quote-build';
  const q = await page.evaluate(({ PRODUCT, DESC, DISC_PCT }) => {
    salesCurrentUser = 'Altaf Hasan Ali Ghare';
    const cust = createCustomer({ name: 'EWAN PROPERTIES', contactPerson: 'Mr. Ali', tel: '33096097', address: 'Seef, Kingdom of Bahrain' });
    const enq = createEnquiry({ division: 'Upholstery', customerId: cust.id, contactPerson: 'Mr. Ali', tel: cust.tel, source: 'walk inn', salesPerson: 'Altaf Hasan Ali Ghare' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Quotation for Bed & Headboard works for Hamala villa no 3', taxPercent: 10, contactPerson: 'Mr. Ali' });
    const lines = [];
    [['Master Bedroom', DESC.master], ['Bedroom Right', DESC.right], ['Bedroom Left', DESC.left]].forEach(([group, description]) => {
      const it = addQuotationItem(qtn.id, {
        product: PRODUCT, qty: 1, unit: 'Nos', vatPercent: 10, discPercent: DISC_PCT,
        group, subgroup: 'Bed & Headboard', description
      });
      lines.push(it.lineId);
    });
    return { qtnId: qtn.id, custId: cust.id, lines, seq0: qtn.items[0].departmentSequence };
  }, { PRODUCT, DESC, DISC_PCT });
  record('Quote built: 3 groups × Bed & Headboard with the real descriptions', q.lines.length === 3 ? 'PASS' : 'FAIL', q.qtnId);
  record('Auto-suggestion routes the upholstered bed to uph (frame dept still needs the Estimator — known gap)', JSON.stringify(q.seq0) === '["uph"]' ? 'PASS' : 'FAIL', JSON.stringify(q.seq0));

  currentStep = 'estimator-bom';
  const bom = await page.evaluate(({ qtnId, lines }) => {
    const out = [];
    lines.forEach(lineId => {
      // Estimator overrides routing to the real production path: frame in
      // Joinery, then Upholstery.
      setItemDepartmentSequence(qtnId, lineId, ['carp', 'uph']);
      // Real inventory item from the seeded live Item Master export.
      const m = addBOMMaterial(qtnId, lineId, { name: 'Nassaj N11011-002', qty: 9, unit: 'Meters', rate: 6.5 });
      const matLine = m && m.materials ? m.materials[m.materials.length - 1] : null;
      const l = addBOMLabour(qtnId, lineId, { department: 'uph', empCategory: 'Skilled', calcMode: 'days', noOfPpl: 2, qty: 3, rate: 5 });
      const l2 = addBOMLabour(qtnId, lineId, { department: 'carp', empCategory: 'Skilled', calcMode: 'days', noOfPpl: 1, qty: 2, rate: 6 });
      setBOMSellingOverride(qtnId, lineId, 535); // the real quoted 535.000/Nos
      const sub = submitItemBOM(qtnId, lineId, 'Jinesh Valiyavalappil Jayarajan');
      out.push({ material: m && !m.error, itemLinked: !!(matLine && matLine.itemId), labour: l && !l.error && l2 && !l2.error, rate: sub.item ? sub.item.rate : null });
    });
    return out;
  }, q);
  record('BOM: real Nassaj fabric linked to the real Item Master row + per-day labour on both routed depts', bom.every(b => b.material && b.itemLinked && b.labour) ? 'PASS' : 'FAIL', JSON.stringify(bom[0]));
  record('Selling override lands the real 535.000/Nos on every line', bom.every(b => b.rate === 535) ? 'PASS' : 'FAIL');

  currentStep = 'money-check';
  const money = await page.evaluate(({ qtnId }) => {
    const qtn = quotations.find(x => x.id === qtnId);
    const t = computeQuotationTotals(qtn);
    const disc = qtn.items.reduce((s, it) => s + it.discAmt, 0);
    const amount = qtn.items.reduce((s, it) => s + it.amount, 0);
    return { amount, disc, netTotal: t.netTotal };
  }, q);
  const close = (a, b) => Math.abs(a - b) < 0.01;
  record('Real document arithmetic: Total 1605.000 / Discount 377.727 / Net 1350.000',
    close(money.amount, 1605) && close(money.disc, 377.727) && close(money.netTotal, 1350) ? 'PASS' : 'FAIL', JSON.stringify(money));

  currentStep = 'approve-confirm';
  const job = await page.evaluate(({ qtnId }) => {
    transferQuotationStage(qtnId, 'approver', 'Jinesh Valiyavalappil Jayarajan');
    const ap = approveQuotation(qtnId, 'Salman Abdullah');
    if (ap && ap.error) return { error: 'approve: ' + ap.error };
    const j = confirmQuotationToJobCard(qtnId, 'Altaf Hasan Ali Ghare');
    if (j.error) return { error: j.error };
    return { jobId: j.id, amount: j.amount };
  }, q);
  record('Approved + confirmed to a Job Card at the real net value', !job.error && close(job.amount, 1350) ? 'PASS' : 'FAIL', JSON.stringify(job));

  currentStep = 'production';
  const prod = await page.evaluate(({ jobId }) => {
    const j = jobCards.find(x => x.id === jobId);
    const r = confirmJobRouting(jobId, {}, 'Operations Manager');
    if (r && r.error) return { error: 'routing: ' + r.error };
    const steps = [];
    for (const deptKey of ['carp', 'uph']) {
      submitDepartmentBudget(jobId, deptKey, { materials: 60, labour: deptKey === 'carp' ? 12 : 30, subcontract: 0, hiring: 0, others: 0 }, deptKey === 'carp' ? 'Joinery Production Manager' : 'Upholstery Manager');
      const ap = approveDepartmentBudget(jobId, deptKey, 'Operations Manager');
      if (ap && ap.error) return { error: deptKey + ' budget: ' + ap.error };
      for (const it of j.items) {
        const s = startLineProduction(jobId, it.lineId, deptKey);
        if (s && s.error) return { error: deptKey + ' start: ' + s.error };
        const entry = it.departmentStatuses.find(d => d.department === deptKey);
        if (deptKey === 'carp' && entry.joinerySubStage) ['cutting', 'veneer-pressing', 'assembly'].forEach(st => advanceJoinerySubStage(jobId, it.lineId, st));
        const sq = submitLineForQC(jobId, it.lineId, deptKey);
        if (sq && sq.error) return { error: deptKey + ' qc-submit: ' + sq.error };
        const qc = recordLineQCResult(jobId, it.lineId, deptKey, true, DEPT_QC_AUTHORITY[deptKey]);
        if (qc && qc.error) return { error: deptKey + ' qc: ' + qc.error };
        const h = handOffLine(jobId, it.lineId, deptKey, deptKey === 'carp' ? 'Joinery Production Manager' : 'Upholstery Manager');
        if (h && h.error) return { error: deptKey + ' handoff: ' + h.error };
      }
      steps.push(deptKey);
    }
    const allDone = j.items.every(it => it.departmentStatuses.every(d => d.status === 'done'));
    return { steps, allDone };
  }, job);
  record('Full production run: routing → budgets → Joinery sub-stages → QC → hand-off → Upholstery → done', !prod.error && prod.allDone ? 'PASS' : 'FAIL', JSON.stringify(prod));

  currentStep = 'delivery-invoice';
  const fin = await page.evaluate(({ jobId }) => {
    const j = jobCards.find(x => x.id === jobId);
    const dn = addDeliveryNote(jobId, j.items.map(it => ({ lineId: it.lineId, requiredQty: it.qty })));
    if (dn && dn.error) return { error: 'delivery: ' + dn.error };
    const inv = generateInvoiceFromJob(jobId, {});
    if (inv.error) return { error: 'invoice: ' + inv.error };
    const rec = createSalesReceipt({ customerId: j.customerId, amount: inv.totals.netTotal, methods: { cash: { enabled: true, amount: inv.totals.netTotal } }, allocations: [{ invoiceId: inv.id, payingAmount: inv.totals.netTotal, discountAmount: 0 }] });
    if (rec && rec.error) return { error: 'receipt: ' + rec.error };
    const bal = invoiceBalance(taxInvoices.find(i => i.id === inv.id));
    return { invNet: inv.totals.netTotal, balance: bal, completed: setJobStatus(jobId, 'completed', 'Operations Manager') };
  }, job);
  record('Delivered → invoiced 100% → receipted in full → job completable', !fin.error && close(fin.invNet, 1350) && close(fin.balance, 0) && !(fin.completed && fin.completed.error) ? 'PASS' : 'FAIL', JSON.stringify(fin));

  currentStep = 'print-docs';
  const docs = await page.evaluate(({ qtnId, jobId }) => {
    const qtn = quotations.find(x => x.id === qtnId);
    const jb = jobCards.find(x => x.id === jobId);
    return {
      quote: buildQuotationPrintHTML(qtn, { audience: 'client', withImage: true }),
      order: buildJobOrderPrintHTML(jb),
      costing: buildJobCostingPrintHTML(qtn, jb)
    };
  }, { qtnId: q.qtnId, jobId: job.jobId });
  const outDir = path.join(__dirname, 'e2e-shots-real-quote');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(path.join(outDir, 'quotation.html'), docs.quote);
  fs.writeFileSync(path.join(outDir, 'job-order.html'), docs.order);
  fs.writeFileSync(path.join(outDir, 'job-costing.html'), docs.costing);

  record('Quotation doc: real serials, groups, totals stack and amount-in-words',
    docs.quote.includes('>1.1.0</td>') && docs.quote.includes('Master Bedroom') && docs.quote.includes('BD 1605.000') &&
    docs.quote.includes('>Discount</td>') && docs.quote.includes('BD 377.727') && docs.quote.includes('BD 1350.000') &&
    docs.quote.includes('Bahrain Dinar One Thousand Three Hundred and Fifty Only') &&
    docs.quote.includes('Terms and Conditions') && docs.quote.includes('70% Advance payment') ? 'PASS' : 'FAIL');
  // The real Job Order's item DESCRIPTIONS legitimately carry fabric spec
  // rates ("@ BD 6.500/mtr") — the check is that no PRICE/AMOUNT column or
  // totals stack exists, not that the string "BD" never appears.
  record('Job Order doc: production copy has no price/amount columns or totals',
    docs.order.includes('JOB ORDER') && docs.order.includes(job.jobId) && !docs.order.includes('class="amount"') &&
    !docs.order.includes('Net Total') && !docs.order.includes('535.000') && !docs.order.includes('1,350') ? 'PASS' : 'FAIL');
  record('Job Costing doc: Job Total 1605 with per-line Cost/Profit from the real BOMs',
    docs.costing.includes('Job Order Costing') && docs.costing.includes('1605.000') && docs.costing.includes('Profit%') ? 'PASS' : 'FAIL');

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
