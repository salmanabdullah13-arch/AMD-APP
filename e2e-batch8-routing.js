// Batch 8, Phase 0-1 verification: department auto-suggestion on
// quotation items (Estimator override UI) + Operations Manager routing
// queue (accept/override, confirm, dispatch, badge update).

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-batch8');
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
  console.log('\n=== BATCH 8 PHASE 0-1 (JOB ROUTING) VERIFICATION ===');
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

  currentStep = 'app-loads';
  await page.waitForSelector('#app', { state: 'visible' });
  record('App loads (real Supabase login replaced the old PIN, 4 Aug 2026)', 'PASS');

  // ── Phase 0: auto-suggestion on quotation item creation ──
  currentStep = 'auto-suggestion';
  const seed = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Batch8 Client', contactPerson: 'Reem', tel: '39556677', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Reem', tel: '39556677', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Batch8 Joinery Project', taxPercent: 10, contactPerson: 'Reem' });
    const item1 = addQuotationItem(qtn.id, { product: 'Painted Cabinet Unit', qty: 1, unit: 'Nos' });
    const item2 = addQuotationItem(qtn.id, { product: 'Curtain Set B', qty: 2, unit: 'Nos' });
    return { qtnId: qtn.id, item1Seq: item1.departmentSequence, item2Seq: item2.departmentSequence, item1LineId: item1.lineId };
  });
  record('Painted cabinet auto-suggests carp+paint sequence', JSON.stringify(seed.item1Seq) === JSON.stringify(['carp', 'paint']) ? 'PASS' : 'FAIL', JSON.stringify(seed.item1Seq));
  record('Curtain item auto-suggests curt from keyword match', JSON.stringify(seed.item2Seq) === JSON.stringify(['curt']) ? 'PASS' : 'FAIL', JSON.stringify(seed.item2Seq));

  // ── Estimator override UI ──
  currentStep = 'estimator-override-ui';
  await openNode(page, 'estimation', 'estimator-module-wrap');
  await page.evaluate((id) => { openEstimationIndex(id); }, seed.qtnId);
  await page.waitForTimeout(200);
  await shot(page, 'estimation-index-with-departments');
  await page.click(`#estimator-body td:has-text("Painted Cabinet Unit")`).catch(() => {});
  // Click the Departments cell for line 1 to open the editor, then toggle
  // "Upholstery" on. (Metal Works was dropped from the routable list in the
  // 6 Aug 2026 audit fix — it had no production pathway; the override UI
  // itself is unchanged and still adds any routable department.)
  await page.evaluate((lineId) => { estimatorEditingDeptLineId = lineId; renderEstimatorBody(); }, seed.item1LineId);
  await page.waitForTimeout(150);
  await shot(page, 'estimator-dept-editor-open');
  await page.click(`#estimator-body input[type=checkbox] >> nth=2`); // 3rd checkbox = Upholstery (carp,paint,uph,curt order)
  await page.waitForTimeout(150);
  const overriddenSeq = await page.evaluate((id) => quotations.find(q => q.id === id).items[0].departmentSequence, seed.qtnId);
  await shot(page, 'estimator-dept-overridden');
  record('Estimator override UI adds a department to the sequence', overriddenSeq.includes('uph') ? 'PASS' : 'FAIL', JSON.stringify(overriddenSeq));

  // ── Approve + confirm to Job Card, land in routing queue ──
  currentStep = 'confirm-to-job';
  const jobId = await page.evaluate((id) => {
    transferQuotationStage(id, 'approver', 'Estimator'); approveQuotation(id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(id, 'Salman Abdullah');
    return job.id;
  }, seed.qtnId);
  const pendingBefore = await page.evaluate(() => getJobsPendingRouting().map(j => j.id));
  record('Confirmed job lands in getJobsPendingRouting()', pendingBefore.includes(jobId) ? 'PASS' : 'FAIL', JSON.stringify(pendingBefore));

  // ── Real UI: Operations routing queue ──
  currentStep = 'operations-routing-queue-ui';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'operations', 'ops-module-wrap');
  await page.evaluate(() => opsGoTo('alerts'));
  await page.waitForTimeout(200);
  await shot(page, 'ops-routing-queue');
  const queueShowsJob = await page.evaluate((id) => document.getElementById('ops-routing-body').innerHTML.includes(id), jobId);
  record('Job Routing queue UI shows the confirmed job', queueShowsJob ? 'PASS' : 'FAIL');

  const badgeBefore = await page.evaluate(() => document.querySelector('#ops-module-wrap [data-p="alerts"] .nbadge').textContent.trim());
  record('Nav badge reflects real pending-routing count', Number(badgeBefore) >= 1 ? 'PASS' : 'FAIL', `badge=${badgeBefore}`);

  // Confirm routing via the real UI button
  await page.click(`#ops-routing-body button:has-text("Confirm routing")`);
  await page.waitForTimeout(200);
  await shot(page, 'ops-routing-confirmed');

  const afterConfirm = await page.evaluate((args) => {
    const job = getJobCard(args.jobId);
    return {
      routingConfirmed: job.routingConfirmed,
      item0Statuses: job.items[0].departmentStatuses,
      item1Statuses: job.items[1].departmentStatuses,
      stillPending: getJobsPendingRouting().some(j => j.id === args.jobId)
    };
  }, { jobId });
  record('Confirm Routing sets routingConfirmed + first-stop "queued" statuses', (afterConfirm.routingConfirmed && afterConfirm.item0Statuses[0].status === 'queued' && afterConfirm.item0Statuses.length === 3) ? 'PASS' : 'FAIL', JSON.stringify(afterConfirm.item0Statuses));
  record('Second stop (paint) starts "pending" until hand-off', afterConfirm.item0Statuses[1].status === 'pending' ? 'PASS' : 'FAIL', JSON.stringify(afterConfirm.item0Statuses));
  record('Job drops off the routing queue after confirm', !afterConfirm.stillPending ? 'PASS' : 'FAIL');

  const badgeAfter = await page.evaluate(() => document.querySelector('#ops-module-wrap [data-p="alerts"] .nbadge').textContent.trim());
  record('Nav badge updates after routing confirmed', Number(badgeAfter) === Number(badgeBefore) - 1 ? 'PASS' : 'FAIL', `before=${badgeBefore} after=${badgeAfter}`);

  const activity = await page.evaluate((id) => getActivityFor('job', id).some(a => a.type === 'job-routed'), jobId);
  record('Activity log records job-routed event', activity ? 'PASS' : 'FAIL');

  await browser.close();
  printReport();
})();
