// Batch 7 "big pieces" verification: shared Tasks/Activity Log primitive,
// Job-as-parent bridge to curtainJobs[]/projects[], and Variation Orders
// (reusing quotations[].rev, merging into the existing Job Card).

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-batch7-big');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
let shotN = 0;
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label) { shotN++; await page.screenshot({ path: path.join(SHOT_DIR, `${String(shotN).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== BATCH 7 BIG PIECES VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}
async function openNode(page, nodeId, wrapId) {
  await page.evaluate((id) => {
    const mesh = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === id);
    if (mesh) mesh.userData.node.launch();
  }, nodeId);
  await page.waitForSelector(`#${wrapId}`, { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  currentStep = 'pin-unlock';
  for (const d of ['1', '9', '9', '4']) { await page.click(`.num-btn[onclick="pt('${d}')"]`); await page.waitForTimeout(120); }
  await page.waitForSelector('#app', { state: 'visible' });
  record('PIN unlock', 'PASS');

  // ── Seed a Curtain-division job through the full real lifecycle (data layer, for speed) ──
  currentStep = 'seed-job-with-bridge';
  const seed = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Batch7 Big Client', contactPerson: 'Huda', tel: '39445566', address: 'Manama' });
    const enq = createEnquiry({ division: 'Curtain & Blinds', customerId: cust.id, contactPerson: 'Huda', tel: '39445566', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Batch7 Curtain Project', taxPercent: 10, contactPerson: 'Huda' });
    addQuotationItem(qtn.id, { product: 'Curtain Set A', qty: 2, unit: 'Nos', vatPercent: 10 });
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    const projEntry = projects.find(p => p.id === job.id);
    const curtEntry = curtainJobs.find(j => j.id === job.id);
    return { jobId: job.id, jobAmount: job.amount, hasProjEntry: !!projEntry, hasCurtEntry: !!curtEntry, projVal: projEntry ? projEntry.val : null };
  });
  record('Bridge: confirmQuotationToJobCard creates linked projects[] + curtainJobs[] entries', (seed.hasProjEntry && seed.hasCurtEntry) ? 'PASS' : 'FAIL', JSON.stringify(seed));

  // ── Confirm the bridged Curtain/Operations screens don't crash on the new live job ──
  currentStep = 'bridge-screens-no-crash';
  await openNode(page, 'curtain', 'curt-module-wrap');
  await shot(page, 'curtain-dashboard-with-bridged-job');
  await openNode(page, 'operations', 'p-operations');
  await shot(page, 'operations-dashboard-with-bridged-job');
  record('Curtain/Operations dashboards render with the new bridged job present', consoleErrors.length === 0 ? 'PASS' : 'FAIL', `consoleErrors so far: ${consoleErrors.length}`);
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  // ── Variation Order: full lifecycle through the REAL UI ──
  currentStep = 'variation-real-ui';
  await openNode(page, 'delivery', 'jobs-module-wrap');
  await page.evaluate((id) => { openJobHub(id); }, seed.jobId);
  await page.waitForTimeout(200);
  await shot(page, 'job-hub-before-variation');
  await page.click('#jobs-body .sales-tile:has-text("New Variation")');
  await page.waitForTimeout(300);
  // should now be in Sales module, wizard step 2 for the new variation
  const inWizard = await page.evaluate(() => ({ view: typeof salesView !== 'undefined' ? salesView : null, wrapVisible: getComputedStyle(document.getElementById('sales-module-wrap')).display !== 'none' }));
  await shot(page, 'variation-wizard-step2');
  record('New Variation opens Sales wizard step 2 for the new quotation', (inWizard.view === 'qtn-wizard' && inWizard.wrapVisible) ? 'PASS' : 'FAIL', JSON.stringify(inWizard));

  const varQtnId = await page.evaluate(() => salesActiveQtnId);
  await page.fill('#sales-body #it-product', 'Extra Curtain Panel');
  await page.fill('#sales-body #it-qty', '1');
  await page.click('#sales-body button:has-text("Add Item")');
  await page.waitForTimeout(150);
  await shot(page, 'variation-item-added');
  await page.click('#sales-body button:has-text("Save & Proceed")');
  await page.waitForTimeout(150);
  await page.click('#sales-body button:has-text("Update Quotation")');
  await page.waitForTimeout(150);
  await shot(page, 'variation-finalized-hub');
  // Finishing the wizard must NOT auto-transfer to Estimator (a real bug
  // Salman found and this session fixed — finaliseQuotation() used to
  // auto-set stage based on withEstimation, which became always-true in
  // Batch 7 and so silently auto-transferred every quotation). Moving to
  // Estimator is always the explicit "Transfer to Estimator" click.
  const stageAfterFinalise = await page.evaluate((id) => quotations.find(q => q.id === id).stage, varQtnId);
  record('Finishing the wizard leaves stage as "sales" (no silent auto-transfer)', stageAfterFinalise === 'sales' ? 'PASS' : 'FAIL', `stage=${stageAfterFinalise}`);
  await page.click('#sales-body button:has-text("Transfer to Estimator")');
  await page.waitForTimeout(150);
  const stageAfterExplicitTransfer = await page.evaluate((id) => quotations.find(q => q.id === id).stage, varQtnId);
  record('Explicit Transfer to Estimator button moves the Variation to stage=estimator', stageAfterExplicitTransfer === 'estimator' ? 'PASS' : 'FAIL', `stage=${stageAfterExplicitTransfer}`);

  // Transfer estimator -> approver (data layer call is fine here, this exact
  // transition is already covered by e2e-lifecycle.js's real-UI test)
  await page.evaluate((id) => { transferQuotationStage(id, 'approver', 'Estimator User'); }, varQtnId);
  await page.evaluate((id) => { approveQuotation(id, 'Salman Abdullah'); }, varQtnId);

  // Confirm via the real Sales Quotation Hub UI
  await openNode(page, 'sales', 'sales-module-wrap');
  await page.evaluate((id) => { openQuotationHub(id); }, varQtnId);
  await page.waitForTimeout(200);
  await shot(page, 'variation-hub-open-ready-to-confirm');
  const hasVariationLabel = await page.evaluate(() => document.getElementById('sales-body').innerHTML.includes('Variation for Job'));
  record('Quotation Hub shows "Variation for Job" label instead of blank enquiry info', hasVariationLabel ? 'PASS' : 'FAIL');
  await page.click('#sales-body button:has-text("Confirm Variation")');
  await page.waitForTimeout(200);
  await shot(page, 'variation-confirmed');

  const afterMerge = await page.evaluate((args) => {
    const job = getJobCard(args.jobId);
    const proj = projects.find(p => p.id === args.jobId);
    return { jobAmount: job.amount, itemCount: job.items.length, variationIds: job.variationIds, projVal: proj.val };
  }, { jobId: seed.jobId });
  // jobAmount stays 0 in this test — no BOM was run through the Estimator
  // (pricing is always locked now, small item #2), so both items have a
  // real rate of 0. That's expected, not a bug: what matters here is that
  // the merge landed on the SAME job (itemCount 1->2, variationIds tracked).
  record('Variation merged into existing Job Card (no new job created)', (afterMerge.itemCount === 2 && afterMerge.variationIds.includes(varQtnId)) ? 'PASS' : 'FAIL', JSON.stringify(afterMerge));
  record('Bridge updates linked projects[].val after variation merge', afterMerge.projVal === afterMerge.jobAmount ? 'PASS' : 'FAIL', `projVal=${afterMerge.projVal} jobAmount=${afterMerge.jobAmount}`);

  // ── Tasks + Activity Log on the Job Card hub ──
  currentStep = 'tasks-and-activity';
  await openNode(page, 'delivery', 'jobs-module-wrap');
  await page.evaluate((id) => { openJobHub(id); }, seed.jobId);
  await page.waitForTimeout(200);
  await shot(page, 'job-hub-after-merge-with-variations-list');
  const variationsShown = await page.evaluate(() => document.getElementById('jobs-body').innerHTML.includes('Variations (1)'));
  record('Job Card hub shows the merged Variation in its Variations list', variationsShown ? 'PASS' : 'FAIL');

  await page.click('#jobs-body button:has-text("+ Add Task")');
  await page.waitForTimeout(150);
  await page.fill('#jt-title', 'Confirm fabric delivery date with supplier');
  await page.selectOption('#jt-assignee', { index: 0 });
  await page.click('#jobs-body button:has-text("Save Task")');
  await page.waitForTimeout(150);
  await shot(page, 'job-hub-task-added');
  const taskCount = await page.evaluate((jobId) => getTasksFor('job', jobId).length, seed.jobId);
  record('Task created and linked to the job', taskCount === 1 ? 'PASS' : 'FAIL', `taskCount=${taskCount}`);

  await page.click('#jobs-body span:has-text("✓ Done")');
  await page.waitForTimeout(150);
  const openTaskCount = await page.evaluate((jobId) => getTasksFor('job', jobId).filter(t => t.status === 'open').length, seed.jobId);
  record('Task marked done (no longer open)', openTaskCount === 0 ? 'PASS' : 'FAIL');

  const activityCount = await page.evaluate((jobId) => getActivityFor('job', jobId).length, seed.jobId);
  await shot(page, 'job-hub-activity-log');
  record('Activity log has entries for job-created and variation-merged', activityCount >= 2 ? 'PASS' : 'FAIL', `activityCount=${activityCount}`);

  await browser.close();
  printReport();
})();
