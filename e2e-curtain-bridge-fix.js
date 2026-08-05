// Verification for Phase 2 business-cycle audit finding #1 (5 Aug
// 2026) — bridgeJobToOperationsAndCurtain() (data.js) used to check
// the ENQUIRY's single `division` field, so a curtain line inside a
// mixed-division quote (the audit's worked example: Curtains + a
// Joinery TV Unit + a Sofa needing Upholstery, all in one quotation)
// never got a real curtainJobs[] production entry — confirmed live in
// the audit (curtainJobsEntryExists: false even though the line
// correctly routed to departmentSequence: ["curt"]). Fixed to check
// the JOB's own items directly instead.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-curtain-bridge-fix');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== CURTAIN BRIDGE FIX VERIFICATION ===');
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
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForTimeout(500);

  // ── Case 1: the exact audit scenario — mixed-division quote ──
  currentStep = 'mixed-division-quote';
  const mixed = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Curtain Bridge Fix Client', contactPerson: 'Fatima', tel: '39112233', address: 'Manama' });
    const enq = createEnquiry({ division: 'Furniture', customerId: cust.id, contactPerson: 'Fatima', tel: '39112233', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Mixed Division Project', taxPercent: 10, contactPerson: 'Fatima' });
    const curtainItem = addQuotationItem(qtn.id, { product: 'Living Room Curtains', qty: 3, unit: 'Nos' });
    const tvUnitItem = addQuotationItem(qtn.id, { product: 'Painted TV Unit Cabinet', qty: 1, unit: 'Nos' });
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    const cj = curtainJobs.find(j => j.id === job.id);
    confirmJobRouting(job.id, {}, 'Operations Manager');
    return {
      enquiryDivision: enq.division,
      curtainItemSeq: curtainItem.departmentSequence,
      tvUnitSeq: tvUnitItem.departmentSequence,
      curtainJobsEntryExists: !!cj,
      curtainJobsEntryHasWindows: cj ? Array.isArray(cj.windows) : null,
      jobId: job.id,
      // Confirm the OTHER (non-curtain) line in the same mixed job
      // still routes correctly via the shared pipeline — this fix
      // must not disturb the already-working Joinery/Painting path.
      tvUnitInCarpQueue: getDepartmentQueue('carp').some(r => r.job.id === job.id)
    };
  });
  record(
    'A curtain line inside a mixed-division quote (enquiry division "Furniture") now gets a real curtainJobs[] entry',
    mixed.enquiryDivision === 'Furniture' && JSON.stringify(mixed.curtainItemSeq) === '["curt"]' && mixed.curtainJobsEntryExists && mixed.curtainJobsEntryHasWindows ? 'PASS' : 'FAIL',
    JSON.stringify(mixed)
  );
  record('The other (Joinery/Painting) line in the same mixed job still routes correctly — the fix didn\'t disturb the shared pipeline', mixed.tvUnitInCarpQueue ? 'PASS' : 'FAIL', JSON.stringify({ tvUnitInCarpQueue: mixed.tvUnitInCarpQueue }));
  await shot(page, 'mixed-division-bridged', 1);

  // ── Case 2: a job with NO curtain items must NOT get a spurious entry ──
  currentStep = 'no-curtain-items';
  const noCurtain = await page.evaluate(() => {
    const cust = createCustomer({ name: 'No Curtain Client', contactPerson: 'Reem', tel: '39001111', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Reem', tel: '39001111', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'No Curtain Project', taxPercent: 10, contactPerson: 'Reem' });
    addQuotationItem(qtn.id, { product: 'Wardrobe Cabinet', qty: 1, unit: 'Nos' });
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    return { curtainJobsEntryExists: !!curtainJobs.find(j => j.id === job.id) };
  });
  record('A job with no curtain-routed items does NOT get a spurious curtainJobs[] entry', !noCurtain.curtainJobsEntryExists ? 'PASS' : 'FAIL', JSON.stringify(noCurtain));

  // ── Case 3: the original, straightforward Curtain & Blinds-only quote still works ──
  currentStep = 'pure-curtain-division-quote';
  const pureCurtain = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Pure Curtain Client', contactPerson: 'Noor', tel: '39002222', address: 'Manama' });
    const enq = createEnquiry({ division: 'Curtain & Blinds', customerId: cust.id, contactPerson: 'Noor', tel: '39002222', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Pure Curtain Project', taxPercent: 10, contactPerson: 'Noor' });
    const item = addQuotationItem(qtn.id, { product: 'Bedroom Drapes', qty: 2, unit: 'Nos' });
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    return { itemSeq: item.departmentSequence, curtainJobsEntryExists: !!curtainJobs.find(j => j.id === job.id) };
  });
  record('A normal Curtain & Blinds-division quote still bridges correctly (unchanged behavior for the common case)', JSON.stringify(pureCurtain.itemSeq) === '["curt"]' && pureCurtain.curtainJobsEntryExists ? 'PASS' : 'FAIL', JSON.stringify(pureCurtain));

  currentStep = 'final';
  const critical = consoleErrors.filter(e => !e.text.includes('favicon'));
  record('No unexpected console errors', critical.length === 0 ? 'PASS' : 'FAIL', critical.map(e => e.text).join(' | '));
  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.some(r => r.status === 'FAIL') ? 1 : 0);
})().catch(err => {
  console.error('FATAL:', err);
  printReport();
  process.exit(1);
});
