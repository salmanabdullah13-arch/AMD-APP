// Verification for the 6 Aug 2026 Fable systems-audit fixes:
//   Phase A — quotation lifecycle gates (no double-approval of a confirmed
//     quote; no double Job Card from one quotation; no approval of a quote
//     with zero submitted estimation), cumulative invoice cap, and
//     refreshJobFromQuotation() recomputing job.amount.
//   Metal — "Motorized Track" auto-routes to Curtain (curt); metal is dropped
//     from auto-suggestion, the division fallback, and ROUTABLE_DEPTS.
//   Delivery — no delivery note / mark-delivered until routed departments are
//     done (curt stops excluded, since Curtain tracks its own production).
// All against the real data-layer functions, offline (nothing persisted).

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== 6 AUG 2026 AUDIT-FIXES VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  // Shared seed helpers live in the page context.
  await page.evaluate(() => {
    window.__seedQuote = function (div, product, rate, seq, submitBom) {
      const c = createCustomer({ name: 'AF ' + Math.random().toString(36).slice(2, 7), contactPerson: 'X', tel: '39' + Math.floor(100000 + Math.random() * 899999), address: 'Manama' });
      const e = createEnquiry({ division: div, customerId: c.id, contactPerson: 'X', tel: c.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
      const q = convertEnquiryToQuotation(e.id, { projectName: product, taxPercent: 10, contactPerson: 'X' });
      const row = addQuotationItem(q.id, { product, qty: 3, unit: 'Nos', vatPercent: 10 });
      if (seq) setItemDepartmentSequence(q.id, row.lineId, seq);
      if (submitBom !== false) { addBOMMaterial(q.id, row.lineId, { name: 'm', qty: 3, unit: 'Nos', rate }); submitItemBOM(q.id, row.lineId, 'Estimator'); }
      return { q, lineId: row.lineId };
    };
    window.__fullApprove = function (qId) {
      transferQuotationStage(qId, 'estimator', 'S'); transferQuotationStage(qId, 'approver', 'E');
      return approveQuotation(qId, 'Approver');
    };
    window.__produce = function (job, deptKey) {
      const line = job.items[0].lineId;
      submitDepartmentBudget(job.id, deptKey, { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'E');
      approveDepartmentBudget(job.id, deptKey, 'Operations Manager');
      startLineProduction(job.id, line, deptKey);
      const entry = job.items[0].departmentStatuses.find(d => d.department === deptKey);
      if (deptKey === 'carp' && entry.joinerySubStage) ['cutting', 'veneer-pressing', 'assembly'].forEach(s => advanceJoinerySubStage(job.id, line, s));
      submitLineForQC(job.id, line, deptKey);
      recordLineQCResult(job.id, line, deptKey, true, DEPT_QC_AUTHORITY[deptKey]);
      handOffLine(job.id, line, deptKey, 'Lead');
    };
  });

  // ── Phase A: double-approval / double-confirm ──
  currentStep = 'lifecycle-gates';
  const la = await page.evaluate(() => {
    const { q } = window.__seedQuote('Joinery', 'Cabinet A', 300);
    window.__fullApprove(q.id);
    const job1 = confirmQuotationToJobCard(q.id, 'S');
    const reApprove = approveQuotation(q.id, 'Rogue');       // confirmed -> should be blocked
    const job2 = confirmQuotationToJobCard(q.id, 'Rogue');   // should be blocked (already open? no — still confirmed)
    return { job1: job1.id, reApprove: reApprove.error || 'ALLOWED', job2: job2.id ? ('ALLOWED ' + job2.id) : (job2.error || 'blocked') };
  });
  record('Re-approving a CONFIRMED quotation is blocked', la.reApprove !== 'ALLOWED' ? 'PASS' : 'FAIL', la.reApprove);
  record('No second Job Card from the same quotation', la.job2.startsWith('ALLOWED') ? 'FAIL' : 'PASS', la.job2);

  const na = await page.evaluate(() => {
    const { q } = window.__seedQuote('Joinery', 'Cabinet ReOpen', 100);
    window.__fullApprove(q.id);                 // now Open
    const again = approveQuotation(q.id, 'Rogue'); // re-approving an Open quote -> blocked
    return { again: again.error || 'ALLOWED' };
  });
  record('Re-approving an already-Open quotation is blocked', na.again !== 'ALLOWED' ? 'PASS' : 'FAIL', na.again);

  const sg2 = await page.evaluate(() => {
    // Loophole #2 (closed in its own pass): a Sales-stage draft can't be
    // approved directly — the quote must actually be with the Approver.
    const { q } = window.__seedQuote('Joinery', 'Cabinet SkipCycle', 100);
    const direct = approveQuotation(q.id, 'Rogue Sales');           // stage is still 'sales'
    transferQuotationStage(q.id, 'estimator', 'S');
    const atEstimator = approveQuotation(q.id, 'Rogue Estimator');  // not the Approver either
    return { direct: direct.error || 'ALLOWED', atEstimator: atEstimator.error || 'ALLOWED' };
  });
  record('Approving a Sales-stage draft directly is blocked (stage gate)', sg2.direct !== 'ALLOWED' ? 'PASS' : 'FAIL', sg2.direct);
  record('Approving at the Estimator stage is blocked too', sg2.atEstimator !== 'ALLOWED' ? 'PASS' : 'FAIL', sg2.atEstimator);

  const happy = await page.evaluate(() => {
    const { q } = window.__seedQuote('Joinery', 'Cabinet Happy', 200);
    const a = window.__fullApprove(q.id);
    const job = confirmQuotationToJobCard(q.id, 'S');
    return { approve: a.error || 'ok', job: job.id || job.error };
  });
  record('Normal approve+confirm still works (regression)', !String(happy.approve).includes('error') && String(happy.job).startsWith('JB') ? 'PASS' : 'FAIL', JSON.stringify(happy));

  // ── Phase A: invoice cap ──
  currentStep = 'invoice-cap';
  const inv = await page.evaluate(() => {
    const { q } = window.__seedQuote('Joinery', 'Invoice Job', 200);
    window.__fullApprove(q.id);
    const job = confirmQuotationToJobCard(q.id, 'S');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    const i1 = generateInvoiceFromJob(job.id, {});                       // 100%
    const i2 = generateInvoiceFromJob(job.id, {});                       // another 100% -> blocked
    // a partial-then-overflow case on a fresh job
    const { q: q2 } = window.__seedQuote('Joinery', 'Invoice Job 2', 200);
    window.__fullApprove(q2.id);
    const job2 = confirmQuotationToJobCard(q2.id, 'S');
    confirmJobRouting(job2.id, {}, 'Operations Manager');
    const p1 = generateInvoiceFromJob(job2.id, { invoicedPercent: 60 });
    const p2 = generateInvoiceFromJob(job2.id, { invoicedPercent: 60 }); // 60+60=120 -> blocked
    const p3 = generateInvoiceFromJob(job2.id, { invoicedPercent: 40 }); // 60+40=100 -> ok
    return {
      firstFull: i1.id || i1.error, secondFull: i2.id ? 'ALLOWED' : i2.error,
      partial1: p1.id || p1.error, overflow: p2.id ? 'ALLOWED' : p2.error, topUp: p3.id || p3.error
    };
  });
  record('Second full 100% invoice on one job is blocked', String(inv.secondFull) !== 'ALLOWED' ? 'PASS' : 'FAIL', String(inv.secondFull));
  record('Invoice that would exceed 100% cumulative is blocked', String(inv.overflow) !== 'ALLOWED' ? 'PASS' : 'FAIL', String(inv.overflow));
  record('A top-up invoice landing exactly at 100% is allowed', String(inv.topUp).startsWith('IN') ? 'PASS' : 'FAIL', String(inv.topUp));

  // ── Phase A: refreshJobFromQuotation recomputes amount ──
  currentStep = 'refresh-amount';
  const rj = await page.evaluate(() => {
    const { q, lineId } = window.__seedQuote('Joinery', 'Refresh Job', 200);
    window.__fullApprove(q.id);
    const job = confirmQuotationToJobCard(q.id, 'S');
    const before = job.amount;
    approverCorrectItem(q.id, lineId, { rate: 500 }, 'price fix', 'Approver');
    refreshJobFromQuotation(job.id);
    return { before, after: job.amount };
  });
  record('refreshJobFromQuotation() recomputes job.amount after a quote correction', rj.after !== rj.before ? 'PASS' : 'FAIL', `${rj.before} -> ${rj.after}`);

  // ── Metal drop / track -> curt ──
  currentStep = 'metal-routing';
  const mr = await page.evaluate(() => ({
    track: JSON.stringify(suggestDepartmentSequence('Motorized Track', 'Curtain & Blinds')),
    trackAtEntry: JSON.stringify(window.__seedQuote('Curtain & Blinds', 'Motorized Track', 25).q.items[0].departmentSequence),
    metalDivision: JSON.stringify(suggestDepartmentSequence('Steel Frame', 'Metal Works')),
    routableHasMetal: ROUTABLE_DEPTS.some(d => d.k === 'metal'),
    deptsStillHasMetal: DEPTS.some(d => d.k === 'metal')
  }));
  record('"Motorized Track" auto-routes to ["curt"]', mr.track === '["curt"]' ? 'PASS' : 'FAIL', mr.track);
  record('Track routes to curt at the real addQuotationItem entry point too', mr.trackAtEntry === '["curt"]' ? 'PASS' : 'FAIL', mr.trackAtEntry);
  record('Metal Works division no longer falls back to a metal stop', mr.metalDivision !== '["metal"]' ? 'PASS' : 'FAIL', mr.metalDivision);
  record('metal is not an assignable (routable) department', !mr.routableHasMetal ? 'PASS' : 'FAIL', 'ROUTABLE has metal=' + mr.routableHasMetal);
  record('DEPTS still keeps metal for badge/colour lookups', mr.deptsStillHasMetal ? 'PASS' : 'FAIL', '');

  // ── Delivery integrity ──
  currentStep = 'delivery-gate';
  const dg = await page.evaluate(() => {
    // unproduced joinery job
    const { q } = window.__seedQuote('Joinery', 'Deliver Wardrobe', 200);
    window.__fullApprove(q.id);
    const job = confirmQuotationToJobCard(q.id, 'S');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    const early = addDeliveryNote(job.id, job.items.map(it => ({ lineId: it.lineId, requiredQty: it.qty })));
    const s = scheduleDelivery(job.id, { plannedDate: '2026-08-15', driver: 'A', vehicleId: null, notes: '' });
    const earlyMark = markDeliveryScheduleStatus(s.id, 'delivered');
    // curtain job — deliverable despite curt never advancing
    const { q: cq } = window.__seedQuote('Curtain & Blinds', 'Blackout Curtain', 18);
    window.__fullApprove(cq.id);
    const cjob = confirmQuotationToJobCard(cq.id, 'S');
    confirmJobRouting(cjob.id, {}, 'Operations Manager');
    const curtainDeliver = addDeliveryNote(cjob.id, cjob.items.map(it => ({ lineId: it.lineId, requiredQty: it.qty })));
    // fully produce a joinery job -> deliverable
    const { q: pq } = window.__seedQuote('Joinery', 'Prod Shelf', 120);
    window.__fullApprove(pq.id);
    const pjob = confirmQuotationToJobCard(pq.id, 'S');
    confirmJobRouting(pjob.id, {}, 'Operations Manager');
    window.__produce(pjob, 'carp');
    const producedDeliver = addDeliveryNote(pjob.id, pjob.items.map(it => ({ lineId: it.lineId, requiredQty: it.qty })));
    return {
      early: early.error || 'ALLOWED', earlyMark: earlyMark.error || 'ALLOWED',
      curtain: curtainDeliver.error ? ('BLOCKED ' + curtainDeliver.error) : 'ALLOWED',
      produced: producedDeliver.error ? ('BLOCKED ' + producedDeliver.error) : 'ALLOWED'
    };
  });
  record('Delivery note blocked before production is finished', dg.early !== 'ALLOWED' ? 'PASS' : 'FAIL', dg.early);
  record('Mark-delivered blocked before production is finished', dg.earlyMark !== 'ALLOWED' ? 'PASS' : 'FAIL', dg.earlyMark);
  record('Curtain job (curt tracked externally) stays deliverable', dg.curtain === 'ALLOWED' ? 'PASS' : 'FAIL', dg.curtain);
  record('Fully-produced job is deliverable', dg.produced === 'ALLOWED' ? 'PASS' : 'FAIL', dg.produced);

  await browser.close();
  printReport();
  const failed = results.filter(r => r.status === 'FAIL').length;
  process.exit(failed > 0 || pageErrors.length > 0 ? 1 : 0);
})();
