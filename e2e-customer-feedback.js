// Verification for Phase 2 business-cycle audit finding #3 (5 Aug
// 2026) — confirmed nothing in the app captured how a job actually
// landed with the customer. Built customerFeedback[] +
// recordCustomerFeedback()/getFeedbackForJob()/getRecentFeedback()/
// getAverageRating() in data.js, wired into Delivery/Scheduling
// (fleet-delivery.js): marking a delivery "Delivered" now opens a
// short star-rating + comments capture before returning to the list.
// Tests the real click path (star click, Save/Skip buttons), not
// direct function calls — see the project's "verify real interaction
// paths" discipline.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-customer-feedback');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== CUSTOMER FEEDBACK VERIFICATION ===');
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

  currentStep = 'setup-routed-job';
  const setup = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Feedback Test Client', contactPerson: 'Layla', tel: '39119900', address: 'Manama' });
    const enq = createEnquiry({ division: 'Furniture', customerId: cust.id, contactPerson: 'Layla', tel: '39119900', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Feedback Test Project', taxPercent: 10, contactPerson: 'Layla' });
    addQuotationItem(qtn.id, { product: 'Coffee Table', qty: 1, unit: 'Nos' });
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    return { jobId: job.id };
  });

  currentStep = 'open-delivery-scheduling';
  await page.evaluate(() => {
    const branch = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === 'delivery-scheduling');
    branch.userData.node.launch();
  });
  await page.waitForTimeout(600);

  currentStep = 'schedule-and-deliver';
  await page.click('button:has-text("Schedule →")');
  await page.fill('#ds-new-date', '2026-08-06');
  await page.fill('#ds-new-driver', 'Karim');
  await page.click('button:has-text("Save Schedule")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Delivered")');
  await page.waitForTimeout(300);

  currentStep = 'feedback-form-appears';
  const formState = await page.evaluate((jobId) => {
    const body = document.getElementById('delivery-sched-body').textContent;
    return { showsDelivered: body.includes('Delivered — ' + jobId), hasStars: document.querySelectorAll('span[onclick^="deliverySchedSetRating"]').length };
  }, setup.jobId);
  record('Marking a delivery "Delivered" opens a feedback capture form for that job with 5 stars', formState.showsDelivered && formState.hasStars === 5 ? 'PASS' : 'FAIL', JSON.stringify(formState));
  await shot(page, 'feedback-form', 1);

  currentStep = 'click-star-and-save';
  await page.click('span[onclick="deliverySchedSetRating(4)"]');
  await page.waitForTimeout(150);
  await page.fill('#ds-feedback-comments', 'Delivered on time, minor scratch on one leg.');
  await page.click('button:has-text("Save Feedback")');
  await page.waitForTimeout(300);
  const saved = await page.evaluate((jobId) => {
    const rows = getFeedbackForJob(jobId);
    return { count: rows.length, rating: rows[0] && rows[0].rating, comments: rows[0] && rows[0].comments, recordedBy: rows[0] && rows[0].recordedBy };
  }, setup.jobId);
  record('Clicking the 4th star and saving records a real customerFeedback[] entry with rating 4 and the comments', saved.count === 1 && saved.rating === 4 && saved.comments.includes('scratch') ? 'PASS' : 'FAIL', JSON.stringify(saved));

  currentStep = 'returns-to-list-with-panel';
  const afterSave = await page.evaluate((jobId) => {
    const body = document.getElementById('delivery-sched-body').textContent;
    return { backOnList: body.includes('Delivery schedule'), showsFeedbackPanel: body.includes('Customer Feedback'), showsAverage: body.includes('★ 4/5'), showsJobInPanel: body.includes(jobId) };
  }, setup.jobId);
  record('After saving, returns to the list view showing the new average rating and the feedback in the panel', afterSave.backOnList && afterSave.showsFeedbackPanel && afterSave.showsAverage && afterSave.showsJobInPanel ? 'PASS' : 'FAIL', JSON.stringify(afterSave));
  await shot(page, 'list-with-feedback-panel', 2);

  // ── Second job: confirm "Skip" leaves no feedback entry ──
  currentStep = 'skip-path';
  const setup2 = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Feedback Skip Client', contactPerson: 'Omar', tel: '39119901', address: 'Manama' });
    const enq = createEnquiry({ division: 'Furniture', customerId: cust.id, contactPerson: 'Omar', tel: '39119901', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Feedback Skip Project', taxPercent: 10, contactPerson: 'Omar' });
    addQuotationItem(qtn.id, { product: 'Coffee Table', qty: 1, unit: 'Nos' });
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    return { jobId: job.id };
  });
  await page.click('button:has-text("Schedule →")');
  await page.fill('#ds-new-date', '2026-08-07');
  await page.fill('#ds-new-driver', 'Sami');
  await page.click('button:has-text("Save Schedule")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Delivered")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Skip")');
  await page.waitForTimeout(300);
  const afterSkip = await page.evaluate((jobId) => ({ feedbackCount: getFeedbackForJob(jobId).length, totalFeedbackCount: customerFeedback.length }), setup2.jobId);
  record('Clicking "Skip" leaves no feedback entry for that job (total feedback count unchanged at 1)', afterSkip.feedbackCount === 0 && afterSkip.totalFeedbackCount === 1 ? 'PASS' : 'FAIL', JSON.stringify(afterSkip));

  // ── Regression: recordCustomerFeedback() rejects an out-of-range rating ──
  currentStep = 'validation';
  const invalid = await page.evaluate((jobId) => recordCustomerFeedback(jobId, { rating: 7, comments: '' }, 'Tester'), setup.jobId);
  record('recordCustomerFeedback() rejects an out-of-range rating (7)', !!invalid.error ? 'PASS' : 'FAIL', JSON.stringify(invalid));

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
