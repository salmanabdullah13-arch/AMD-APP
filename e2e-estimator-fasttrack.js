// Stage 5 of the merged roadmap (6 Aug 2026) — Estimator fast-track:
// ① Delegate a picked quote (reassign + audit trail + Messages ping)
// ② BOM template library (save/apply, always lands unsubmitted)
// ③ Excel round-trip — marker-guarded import, validation mirroring the UI
//    gates (Item Master exact match, routed-dept labour, mandatory rates),
//    review-before-apply, apply through the real addBOM*() functions.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== ESTIMATOR FAST-TRACK (Stage 5) ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 480, height: 950 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  currentStep = 'seed';
  const seed = await page.evaluate(() => {
    salesCurrentUser = 'Altaf Hasan Ali Ghare';
    const cust = createCustomer({ name: 'Fasttrack Client', contactPerson: 'F', tel: '39990333', address: 'Manama' });
    const enq = createEnquiry({ division: 'Upholstery', customerId: cust.id, contactPerson: 'F', tel: cust.tel, source: 'walk inn', salesPerson: 'Altaf Hasan Ali Ghare' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'Fasttrack Headboard', taxPercent: 10, contactPerson: 'F' });
    const it = addQuotationItem(q.id, { product: 'Upholstered Headboard', qty: 1, unit: 'Nos', rate: 0 });
    setItemDepartmentSequence(q.id, it.lineId, ['uph']);
    transferQuotationStage(q.id, 'estimator', 'Sales');
    return { qtnId: q.id, lineId: it.lineId };
  });
  record('Quote seeded at the estimator stage', !!seed.qtnId ? 'PASS' : 'FAIL', seed.qtnId);

  currentStep = 'delegate';
  const del = await page.evaluate(({ qtnId }) => {
    const q = quotations.find(x => x.id === qtnId);
    pickQuotation(qtnId, 'Arun Kumar A', 'estimator');
    const msgCountBefore = getInboxFor('Sohail Qureshi').length;
    const res = delegateQuotation(qtnId, 'Sohail Qureshi', 'Arun Kumar A', 'Fabric expertise needed');
    const badStage = delegateQuotation('AMD-00000-0', 'X', 'Y');
    const samePerson = delegateQuotation(qtnId, 'Sohail Qureshi', 'Sohail Qureshi');
    return {
      picked: q.estimatorPickedBy,
      audited: (q.auditLog || []).some(a => String(a.action || '').includes('Delegated from Arun Kumar A to Sohail Qureshi')),
      activity: activityLog.some(a => a.type === 'quote-delegated' && a.linkedId === qtnId),
      msgArrived: getInboxFor('Sohail Qureshi').length === msgCountBefore + 1,
      badStageRejected: !!badStage.error, samePersonRejected: !!samePerson.error
    };
  }, seed);
  record('Delegation reassigns the pick + audit trail + activity feed', del.picked === 'Sohail Qureshi' && del.audited && del.activity ? 'PASS' : 'FAIL', JSON.stringify(del));
  record('New estimator pinged through the real Messages system', del.msgArrived ? 'PASS' : 'FAIL');
  record('Bad delegations rejected (missing quote / delegate-to-self)', del.badStageRejected && del.samePersonRejected ? 'PASS' : 'FAIL');

  currentStep = 'templates';
  const tpl = await page.evaluate(({ qtnId, lineId }) => {
    addBOMMaterial(qtnId, lineId, { name: 'Nassaj N11011-002', qty: 6, unit: 'Meters', rate: 6.5 });
    addBOMLabour(qtnId, lineId, { department: 'uph', empCategory: 'Skilled', calcMode: 'days', noOfPpl: 2, qty: 2, rate: 5 });
    const t = saveBOMTemplate('Headboard — standard', qtnId, lineId, 'Arun Kumar A');
    if (t.error) return { error: t.error };
    // apply onto a brand-new line in a new quote
    const cust = customers[customers.length - 1];
    const enq = createEnquiry({ division: 'Upholstery', customerId: cust.id, contactPerson: 'F', tel: cust.tel, source: 'walk inn', salesPerson: 'Altaf Hasan Ali Ghare' });
    const q2 = convertEnquiryToQuotation(enq.id, { projectName: 'Second Headboard', taxPercent: 10, contactPerson: 'F' });
    const it2 = addQuotationItem(q2.id, { product: 'Upholstered Headboard King', qty: 1, unit: 'Nos', rate: 0 });
    const applied = applyBOMTemplate(t.id, q2.id, it2.lineId);
    return {
      tplId: t.id, tplName: t.name,
      appliedMats: applied.materials.length, appliedLab: applied.labour.length,
      unsubmitted: applied.submitted === false, matLinked: !!applied.materials[0].itemId,
      noName: saveBOMTemplate('', qtnId, lineId).error ? true : false
    };
  }, seed);
  record('Template saved and applied to a new quote line (unsubmitted, item links intact)',
    !tpl.error && tpl.appliedMats === 1 && tpl.appliedLab === 1 && tpl.unsubmitted && tpl.matLinked ? 'PASS' : 'FAIL', JSON.stringify(tpl));
  record('Nameless template rejected', tpl.noName ? 'PASS' : 'FAIL');

  currentStep = 'excel-library';
  const hasXlsx = await page.evaluate(() => typeof XLSX !== 'undefined');
  record('SheetJS loads from the pinned CDN', hasXlsx ? 'PASS' : 'FAIL');

  currentStep = 'excel-validation';
  const val = await page.evaluate(({ qtnId, lineId }) => {
    const q = quotations.find(x => x.id === qtnId);
    const aoa = [
      ['AMD BOM IMPORT v1', qtnId, q.items.length],
      ['Line #', 'Product', 'Section', 'Item / Name', 'Dept', 'Ppl', 'Qty', 'Unit', 'Rate'],
      [lineId, 'x', 'Material', 'Nassaj N11011-002', '', '', 8, 'Meters', 6.5],       // valid
      [lineId, 'x', 'Material', 'Nonexistent Fabric XYZ', '', '', 2, 'Meters', 3],     // bad item name
      [lineId, 'x', 'Labour', 'Skilled', 'carp', 1, 8, 'Hours', 5],                    // dept not routed (only uph)
      [lineId, 'x', 'Labour', 'Skilled', 'uph', 2, 3, 'Days', 5],                      // valid
      [lineId, 'x', 'Material', 'ACC046 CHALK LINE POWDER SET', '', '', 1, 'Nos', 0]   // missing rate
    ];
    processExcelImport(qtnId, aoa);
    const rows = excelImportState ? excelImportState.rows : [];
    return {
      view: estimatorView,
      total: rows.length,
      flagged: rows.filter(r => r.status === 'flagged').length,
      reasons: rows.filter(r => r.status === 'flagged').map(r => r.reason.slice(0, 40))
    };
  }, seed);
  record('Import lands on the review screen with the 3 bad rows flagged (bad item / unrouted dept / missing rate)',
    val.view === 'excelReview' && val.total === 5 && val.flagged === 3 ? 'PASS' : 'FAIL', JSON.stringify(val));

  currentStep = 'excel-stale-guard';
  const stale = await page.evaluate(({ qtnId }) => {
    let alerted = null;
    const orig = window.estimatorAlert; window.estimatorAlert = m => { alerted = m; };
    processExcelImport(qtnId, [['AMD BOM IMPORT v1', 'AMD-WRONG-0', 1], [], []]);
    window.estimatorAlert = orig;
    return alerted;
  }, seed);
  record('Stale/mismatched file rejected by the marker guard', stale && stale.includes('not exported from quotation') ? 'PASS' : 'FAIL', String(stale).slice(0, 60));

  currentStep = 'excel-apply';
  const applied = await page.evaluate(({ qtnId, lineId }) => {
    // re-import with only clean rows, then apply through the real UI button path
    const q = quotations.find(x => x.id === qtnId);
    processExcelImport(qtnId, [
      ['AMD BOM IMPORT v1', qtnId, q.items.length],
      ['h'],
      [lineId, 'x', 'Material', 'Nassaj N11011-002', '', '', 8, 'Meters', 6.5],
      [lineId, 'x', 'Labour', 'Skilled', 'uph', 2, 3, 'Days', 5],
      [lineId, 'x', 'Subcontract', 'Gulf CNC Cutting', '', '', 1, '', 40]
    ]);
    estimatorApplyExcelImport();
    const it = q.items.find(x => x.lineId === lineId);
    return {
      mats: it.bom.materials.length, matQty: it.bom.materials[0].qty, matLinked: !!it.bom.materials[0].itemId,
      lab: it.bom.labour.length, labAmount: it.bom.labour[0].amount,
      sub: it.bom.subcontract.length, subAmount: it.bom.subcontract[0].amount,
      unsubmitted: !it.bom.submitted,
      logged: activityLog.some(a => a.type === 'bom-excel-import' && a.linkedId === qtnId)
    };
  }, seed);
  record('Apply replaces the BOM through the real addBOM*() functions (linked material, per-day labour 2×3×5=30, subcontract)',
    applied.mats === 1 && applied.matQty === 8 && applied.matLinked && applied.lab === 1 && applied.labAmount === 30 && applied.sub === 1 && applied.subAmount === 40 && applied.unsubmitted && applied.logged ? 'PASS' : 'FAIL', JSON.stringify(applied));

  currentStep = 'ui-presence';
  await page.evaluate(({ qtnId }) => { const n = window.__eco3d.NODES.find(n => n.id === 'estimation'); n.launch(); openEstimationIndex(qtnId); }, seed);
  await page.waitForTimeout(500);
  const ui = await page.evaluate(() => {
    const html = document.getElementById('estimator-module-wrap').innerHTML;
    return { dl: html.includes('Download BOM Excel'), ul: html.includes('Upload filled Excel') };
  });
  record('Estimation Index shows the Excel download/upload controls', ui.dl && ui.ul ? 'PASS' : 'FAIL');
  const hub = await page.evaluate(({ qtnId }) => { openEstimatorQuoteHub ? openEstimatorQuoteHub(qtnId) : (estimatorActiveQtnId = qtnId, estimatorView = 'hub', renderEstimatorBody()); return document.getElementById('estimator-module-wrap').innerHTML.includes('Delegate to another estimator'); }, seed);
  record('Quote hub shows the Delegate control', hub ? 'PASS' : 'FAIL');

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
