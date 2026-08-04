// Verification for the Tasks/Activity Log retrofit (4 Aug 2026) — the
// tasks[]/activityLog[] primitive was previously only wired into the Job
// Card hub + Variation Order flow. Checks that key lifecycle events across
// the other modules now log to the shared activityLog: Enquiry creation,
// Quotation stage transfer/approval, BOM submission, Approver item
// correction, Customer approve/reject, Purchase Request/PO/Invoice, and
// Storekeeper stock release.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== ACTIVITY LOG RETROFIT VERIFICATION ===');
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
  page.on('dialog', async d => { await d.accept(d.type() === 'prompt' ? 'test reason' : undefined); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  currentStep = 'app-loads';
  await page.waitForSelector('#app', { state: 'visible' });
  record('App loads (real Supabase login replaced the old PIN, 4 Aug 2026)', 'PASS');

  currentStep = 'full-lifecycle-activity-check';
  const result = await page.evaluate(() => {
    const before = activityLog.length;
    salesCurrentUser = 'Salman Abdullah';

    const cust = createCustomer({ name: 'ActivityLog Client', contactPerson: 'Ali', tel: '39776600', email: 'ali@activitylog.bh', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Ali', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'ActivityLog Project', taxPercent: 10, contactPerson: 'Ali' });
    addQuotationItem(q.id, { product: 'Test Item', qty: 1, unit: 'Nos' });
    const item = q.items[0];
    addBOMMaterial(q.id, item.lineId, { name: 'Test Board', qty: 1, unit: 'Nos', rate: 10 });
    submitItemBOM(q.id, item.lineId, 'Estimator User');
    transferQuotationStage(q.id, 'estimator', 'Salman Abdullah');
    transferQuotationStage(q.id, 'approver', 'Estimator User');
    approveQuotation(q.id, 'Salman Abdullah');
    approverCorrectItem(q.id, item.lineId, { product: 'Corrected Test Item' }, 'fixing a typo', 'Salman Abdullah');

    const dupCust = createCustomer({ name: 'ActivityLog Client Branch', contactPerson: 'Ali B', tel: '39776600', address: 'Riffa' });
    approveCustomer(cust.id, 'Accounts');
    rejectCustomer(dupCust.id, 'Accounts', 'duplicate of existing client');

    const pr = raisePurchaseRequest({ department: 'carp', raisedBy: 'Salman Abdullah', destinationType: 'inventory', items: [{ name: 'Board', qty: 5, unit: 'Nos' }] });
    const po = createPurchaseOrderDirect({ department: 'carp', supplierDetails: { preparedBy: 'Salman Abdullah' }, items: [{ name: 'Board', qty: 5, unit: 'Nos' }] });
    approvePO(po.id, 'Operations Manager');
    convertPOtoInvoice(po.id, {});

    const after = activityLog.length;
    const types = activityLog.slice(before).map(a => a.type);
    return { before, after, types, qtnId: q.id };
  });

  record('Enquiry creation logs an activity entry', result.types.includes('enquiry-created') ? 'PASS' : 'FAIL', JSON.stringify(result.types));
  record('BOM submission logs an activity entry', result.types.includes('bom-submitted') ? 'PASS' : 'FAIL');
  record('Quotation stage transfer logs an activity entry', result.types.includes('quotation-transferred') ? 'PASS' : 'FAIL');
  record('Quotation approval logs an activity entry', result.types.includes('quotation-approved') ? 'PASS' : 'FAIL');
  record('Approver item correction logs an activity entry (in addition to the per-quote audit trail)', result.types.includes('item-corrected') ? 'PASS' : 'FAIL');
  record('Customer approval logs an activity entry', result.types.includes('customer-approved') ? 'PASS' : 'FAIL');
  record('Customer rejection logs an activity entry', result.types.includes('customer-rejected') ? 'PASS' : 'FAIL');
  record('Purchase Request logs an activity entry', result.types.includes('pr-raised') ? 'PASS' : 'FAIL');
  record('PO creation logs an activity entry', result.types.includes('po-created') ? 'PASS' : 'FAIL');
  record('PO approval logs an activity entry', result.types.includes('po-approved') ? 'PASS' : 'FAIL');
  record('Purchase Invoice receipt logs an activity entry', result.types.includes('purchase-invoice-received') ? 'PASS' : 'FAIL');
  record(`${result.after - result.before} total activity entries logged across this one lifecycle walk`, result.after - result.before >= 11 ? 'PASS' : 'FAIL', `${result.before} -> ${result.after}`);

  currentStep = 'per-quotation-activity-feed';
  const qtnActivity = await page.evaluate((id) => getActivityFor('quotation', id).map(a => a.type), result.qtnId);
  record('getActivityFor("quotation", id) surfaces this quote\'s own events (bom-submitted, transferred, approved, corrected)', qtnActivity.includes('bom-submitted') && qtnActivity.includes('quotation-approved') && qtnActivity.includes('item-corrected') ? 'PASS' : 'FAIL', JSON.stringify(qtnActivity));

  currentStep = 'stock-release-activity';
  const stockResult = await page.evaluate(() => {
    const before = activityLog.length;
    const cust = createCustomer({ name: 'StockRelease Client', contactPerson: 'Sara', tel: '39887788', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Sara', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'StockRelease Project', taxPercent: 10, contactPerson: 'Sara' });
    addQuotationItem(q.id, { product: 'Test Item', qty: 1, unit: 'Nos' });
    approveQuotation(q.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(q.id, 'Salman Abdullah');
    stockEntries.push({ id: 'STK-TEST-01', sourceInvoice: 'INV-TEST', itemName: 'Test Plank', qty: 20, unit: 'Nos', status: 'in-pool', dateReceived: '2026-08-04' });
    releaseStockEntry('STK-TEST-01', { department: 'carp', jobId: job.id, qty: 5, issuedBy: 'Storekeeper User' });
    const after = activityLog.length;
    return { types: activityLog.slice(before).map(a => a.type) };
  });
  record('Stock release logs an activity entry', stockResult.types.includes('stock-released') ? 'PASS' : 'FAIL', JSON.stringify(stockResult.types));

  await browser.close();
  printReport();
})();
