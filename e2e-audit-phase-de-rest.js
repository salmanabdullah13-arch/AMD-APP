// Verification for the 6 Aug 2026 audit — Phase E (rest) + Phase D (part):
//   - Hand-off notifications: routing and every pipeline hand-off now message
//     the receiving department's lead via the existing Messages system.
//   - setJobStatus('completed') refuses while routed production is unfinished.
//   - urgent flag + promisedDate on jobs: setters, attention flags, dept-queue
//     display.
//   - getMonthlyRevenueByDivision(): variation items bucket into the month
//     their variation was confirmed, not the job's original month.
//   - refreshJobFromQuotation() VAT fix: recomputed job.amount sums
//     netAmount (VAT-inclusive), matching job.amount's original definition.

const { chromium } = require('@playwright/test');
const path = require('path');

// Local calendar dates, matching the app (data.js localISO/todayISO). A test
// that computes an expected date through toISOString() disagrees with the app
// between local midnight and 03:00 in UTC+3 — a flake that only appears at
// night. Node-side copy: inside page.evaluate() the app's own global resolves.
const localISO = (d) => { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const todayISO = () => localISO(new Date());

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== PHASE D/E (REST) VERIFICATION ===');
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

  await page.evaluate(() => {
    window.__seedJob = function (product, seq, rate) {
      const c = createCustomer({ name: 'DE ' + Math.random().toString(36).slice(2, 7), contactPerson: 'X', tel: '39' + Math.floor(100000 + Math.random() * 899999), address: 'Manama' });
      const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'X', tel: c.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
      const q = convertEnquiryToQuotation(e.id, { projectName: product, taxPercent: 10, contactPerson: 'X' });
      const row = addQuotationItem(q.id, { product, qty: 2, unit: 'Nos', vatPercent: 10 });
      if (seq) setItemDepartmentSequence(q.id, row.lineId, seq);
      addBOMMaterial(q.id, row.lineId, { name: 'm', qty: 2, unit: 'Nos', rate: rate || 150 });
      submitItemBOM(q.id, row.lineId, 'E');
      transferQuotationStage(q.id, 'estimator', 'S'); transferQuotationStage(q.id, 'approver', 'E');
      approveQuotation(q.id, 'A');
      const job = confirmQuotationToJobCard(q.id, 'S');
      return { job, q, lineId: row.lineId };
    };
    window.__produceLine = function (job, lineId, deptKey) {
      submitDepartmentBudget(job.id, deptKey, { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'E');
      approveDepartmentBudget(job.id, deptKey, 'Operations Manager');
      startLineProduction(job.id, lineId, deptKey);
      const entry = job.items.find(i => i.lineId === lineId).departmentStatuses.find(d => d.department === deptKey);
      if (deptKey === 'carp' && entry.joinerySubStage) ['cutting', 'veneer-pressing', 'assembly'].forEach(s => advanceJoinerySubStage(job.id, lineId, s));
      submitLineForQC(job.id, lineId, deptKey);
      recordLineQCResult(job.id, lineId, deptKey, true, DEPT_QC_AUTHORITY[deptKey]);
      handOffLine(job.id, lineId, deptKey, 'Lead');
    };
  });

  // ── Hand-off notifications ──
  currentStep = 'handoff-notifications';
  const hn = await page.evaluate(async () => {
    const jBefore = getUnreadCountFor('Joinery Production Manager');
    const pBefore = getUnreadCountFor('Painting Lead / Work Supervisor');
    const { job, lineId } = window.__seedJob('Painted Handoff Cabinet', ['carp', 'paint']);
    confirmJobRouting(job.id, {}, 'Operations Manager');
    await new Promise(r => setTimeout(r, 50));
    const jAfterRouting = getUnreadCountFor('Joinery Production Manager');
    window.__produceLine(job, lineId, 'carp'); // ends in handOffLine -> paint queued
    await new Promise(r => setTimeout(r, 50));
    const pAfterHandoff = getUnreadCountFor('Painting Lead / Work Supervisor');
    const paintMsg = getInboxFor('Painting Lead / Work Supervisor').find(m => m.linkedId === job.id);
    return {
      joineryGotRoutingPing: jAfterRouting > jBefore,
      paintingGotHandoffPing: pAfterHandoff > pBefore,
      msgBody: paintMsg ? paintMsg.body : null
    };
  });
  record('Routing pings the first department (Joinery) via Messages', hn.joineryGotRoutingPing ? 'PASS' : 'FAIL', '');
  record('Hand-off pings the next department (Painting) via Messages', hn.paintingGotHandoffPing ? 'PASS' : 'FAIL', hn.msgBody || '');

  // ── setJobStatus gate ──
  currentStep = 'setjobstatus-gate';
  const sg = await page.evaluate(() => {
    const { job } = window.__seedJob('Status Gate Cabinet', ['carp']);
    confirmJobRouting(job.id, {}, 'Operations Manager');
    const early = setJobStatus(job.id, 'completed');            // carp still queued -> blocked
    const cancel = setJobStatus(job.id, 'cancelled');           // cancel stays allowed
    setJobStatus(job.id, 'open');
    window.__produceLine(job, job.items[0].lineId, 'carp');
    const done = setJobStatus(job.id, 'completed');             // production done -> allowed
    return { early: early.error || 'ALLOWED', cancel: cancel.error || 'ok', done: done.error || 'ok' };
  });
  record('Completed blocked while production unfinished', sg.early !== 'ALLOWED' ? 'PASS' : 'FAIL', sg.early);
  record('Cancel still allowed mid-production', sg.cancel === 'ok' ? 'PASS' : 'FAIL', sg.cancel);
  record('Completed allowed once production is done', sg.done === 'ok' ? 'PASS' : 'FAIL', sg.done);

  // ── urgent + promised date ──
  currentStep = 'urgent-promised';
  const up = await page.evaluate(() => {
    const { job } = window.__seedJob('Urgent Cabinet', ['carp']);
    confirmJobRouting(job.id, {}, 'Operations Manager');
    setJobUrgent(job.id, true, 'Operations Manager');
    setJobPromisedDate(job.id, '2026-08-01', 'Operations Manager'); // already past
    const flags = getJobAttentionFlags(job).map(f => f.label);
    const rowHtml = renderDeptQueue('carp', 'joinery');
    return { urgent: job.urgent, flags, hasFire: rowHtml.includes('🔥'), hasDue: rowHtml.includes('due 2026-08-01') };
  });
  record('setJobUrgent/setJobPromisedDate persist on the job', up.urgent === true ? 'PASS' : 'FAIL', JSON.stringify(up.flags));
  record('Attention flags show URGENT + overdue promised date', up.flags.includes('URGENT') && up.flags.some(f => f.includes('overdue')) ? 'PASS' : 'FAIL', JSON.stringify(up.flags));
  record('Department queue row shows 🔥 and the due date', up.hasFire && up.hasDue ? 'PASS' : 'FAIL', '');

  // ── variation month bucketing ──
  currentStep = 'variation-bucketing';
  const vb = await page.evaluate(() => {
    // snapshot first — earlier seeds in this same run also occupy this
    // month's Joinery bucket, so assert on the DELTA this scenario adds
    const rev0 = getMonthlyRevenueByDivision(4);
    const thisKey0 = rev0.months[rev0.months.length - 1].key;
    const oldKey0 = rev0.months[rev0.months.length - 3].key;
    const thisBefore = rev0.byMonthDiv[thisKey0]['Joinery'];
    const oldBefore = rev0.byMonthDiv[oldKey0]['Joinery'];
    const { job, q } = window.__seedJob('Bucket Base Cabinet', ['carp'], 100);
    // age the job 2 months back
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 2);
    job.date = localISO(d);
    const baseAmount = job.amount;
    // variation confirmed THIS month
    const v = createVariationForJob(job.id, { notes: 'later addition' });
    const row = addQuotationItem(v.id, { product: 'Bucket Extra Shelf', qty: 1, unit: 'Nos', vatPercent: 10 });
    setItemDepartmentSequence(v.id, row.lineId, ['carp']);
    addBOMMaterial(v.id, row.lineId, { name: 'm', qty: 1, unit: 'Nos', rate: 80 });
    submitItemBOM(v.id, row.lineId, 'E');
    transferQuotationStage(v.id, 'estimator', 'S'); transferQuotationStage(v.id, 'approver', 'E');
    approveQuotation(v.id, 'A');
    confirmVariationToJobCard(v.id, 'S');
    const variationValue = job.amount - baseAmount;
    const rev = getMonthlyRevenueByDivision(4);
    const thisKey = rev.months[rev.months.length - 1].key;
    const oldKey = rev.months[rev.months.length - 3].key;
    return {
      baseAmount, variationValue,
      thisMonthDelta: rev.byMonthDiv[thisKey]['Joinery'] - thisBefore,
      oldMonthDelta: rev.byMonthDiv[oldKey]['Joinery'] - oldBefore
    };
  });
  const vbOk = Math.abs(vb.thisMonthDelta - vb.variationValue) < 0.01 && Math.abs(vb.oldMonthDelta - vb.baseAmount) < 0.01;
  record('Variation value buckets into ITS month; base stays in the job month', vbOk ? 'PASS' : 'FAIL', JSON.stringify(vb));

  // ── refresh VAT fix ──
  currentStep = 'refresh-vat';
  const rv = await page.evaluate(() => {
    const { job, q, lineId } = window.__seedJob('Refresh VAT Cabinet', ['carp']);
    approverCorrectItem(q.id, lineId, { rate: 1000 }, 'price fix', 'Approver');
    refreshJobFromQuotation(job.id);
    const item = quotations.find(x => x.id === q.id).items[0];
    return { jobAmount: job.amount, itemNet: item.netAmount, itemAmount: item.amount };
  });
  record('Refreshed job.amount equals the VAT-inclusive netAmount sum (not pre-VAT)', Math.abs(rv.jobAmount - rv.itemNet) < 0.01 ? 'PASS' : 'FAIL', JSON.stringify(rv));

  await browser.close();
  printReport();
  process.exit(results.filter(r => r.status === 'FAIL').length > 0 || pageErrors.length > 0 ? 1 : 0);
})();
