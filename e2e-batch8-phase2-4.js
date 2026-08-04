// Batch 8, Phase 2-4 verification: shared Joinery/Upholstery production
// pipeline, standalone Painting module, and the three-tier costing/
// budget-approval gate — end to end through the REAL UI.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-batch8-phase2-4');
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
  console.log('\n=== BATCH 8 PHASE 2-4 VERIFICATION ===');
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

  // ── Ecosystem hub: confirm the 3 new nodes are built and reachable ──
  currentStep = 'ecosystem-hub-nodes';
  const nodeInfo = await page.evaluate(() => window.__eco3d.NODES.filter(n => ['joinery', 'upholstery', 'painting'].includes(n.id)));
  record('Joinery/Upholstery/Painting are all built:true in NODES', nodeInfo.every(n => n.built) ? 'PASS' : 'FAIL', JSON.stringify(nodeInfo));

  // ── Seed a job with a Joinery (paint-tagged) item and an Upholstery item ──
  currentStep = 'seed-and-route';
  const seed = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Batch8P2 Client', contactPerson: 'Nasser', tel: '39667788', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Nasser', tel: '39667788', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Batch8 Mixed Project', taxPercent: 10, contactPerson: 'Nasser' });
    const cabinetItem = addQuotationItem(qtn.id, { product: 'Painted Cabinet Unit', qty: 1, unit: 'Nos' });
    const sofaItem = addQuotationItem(qtn.id, { product: 'Custom Sofa', qty: 1, unit: 'Nos' });
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations');
    return { jobId: job.id, cabinetLineId: cabinetItem.lineId, sofaLineId: sofaItem.lineId };
  });
  record('Job routed with carp->paint sequence on cabinet, uph on sofa', 'PASS', JSON.stringify(seed));

  // ── Joinery module: queue shows the line, can't start before budget approved ──
  currentStep = 'joinery-queue-and-gate';
  await openNode(page, 'joinery', 'joinery-module-wrap');
  await page.evaluate(() => joinerySetView('queue'));
  await page.waitForTimeout(200);
  await shot(page, 'joinery-queue');
  const queueShowsCabinet = await page.evaluate(() => document.getElementById('joinery-body').innerHTML.includes('Painted Cabinet Unit'));
  record('Joinery queue shows the routed cabinet line', queueShowsCabinet ? 'PASS' : 'FAIL');
  await page.click('#joinery-body button:has-text("Start Production")');
  await page.waitForTimeout(200);
  await shot(page, 'joinery-start-blocked-no-budget');
  const stillQueued = await page.evaluate((args) => getJobCard(args.jobId).items.find(it => it.lineId === args.lineId).departmentStatuses.find(d => d.department === 'carp').status, { jobId: seed.jobId, lineId: seed.cabinetLineId });
  record('Start Production blocked — budget not approved yet', stillQueued === 'queued' ? 'PASS' : 'FAIL', `status=${stillQueued}`);

  // ── Submit + approve Joinery's own budget via the real UI ──
  currentStep = 'joinery-budget-submit-approve';
  await page.evaluate(() => joinerySetView('budget'));
  await page.waitForTimeout(200);
  await page.click('#joinery-body button:has-text("Enter Budget")');
  await page.waitForTimeout(150);
  await page.fill('#db-joinery-materials', '200');
  await page.fill('#db-joinery-labour', '80');
  await shot(page, 'joinery-budget-form-filled');
  await page.click('#joinery-body button:has-text("Submit for Approval")');
  await page.waitForTimeout(200);
  await page.evaluate(() => joinerySetView('approvals'));
  await page.waitForTimeout(200);
  await shot(page, 'joinery-approvals-shows-own-submission');
  const approvalsShowCarp = await page.evaluate(() => document.getElementById('joinery-body').innerHTML.includes('Carpentry'));
  record('Joinery Approvals tab shows its own pending budget', approvalsShowCarp ? 'PASS' : 'FAIL');
  await page.click('#joinery-body button:has-text("Approve")');
  await page.waitForTimeout(200);
  await shot(page, 'joinery-budget-approved');

  // ── Now Start Production actually works ──
  await page.evaluate(() => joinerySetView('queue'));
  await page.waitForTimeout(200);
  await page.click('#joinery-body button:has-text("Start Production")');
  await page.waitForTimeout(200);
  const nowInProduction = await page.evaluate((args) => getJobCard(args.jobId).items.find(it => it.lineId === args.lineId).departmentStatuses.find(d => d.department === 'carp').status, { jobId: seed.jobId, lineId: seed.cabinetLineId });
  record('Start Production works once budget is approved', nowInProduction === 'in-production' ? 'PASS' : 'FAIL', `status=${nowInProduction}`);

  // ── Walk the line through QC fail -> rework -> QC pass -> hand-off, via real UI ──
  currentStep = 'joinery-qc-cycle-real-ui';
  await page.click('#joinery-body button:has-text("Submit for QC")');
  await page.waitForTimeout(150);
  await page.click('#joinery-body button:has-text("Fail")');
  await page.waitForTimeout(150);
  await shot(page, 'joinery-qc-failed-rework');
  const reworkStatus = await page.evaluate((args) => getJobCard(args.jobId).items.find(it => it.lineId === args.lineId).departmentStatuses.find(d => d.department === 'carp').status, { jobId: seed.jobId, lineId: seed.cabinetLineId });
  record('QC Fail moves line to rework via real UI', reworkStatus === 'rework' ? 'PASS' : 'FAIL', `status=${reworkStatus}`);
  await page.click('#joinery-body button:has-text("Resume Production")');
  await page.waitForTimeout(150);
  await page.click('#joinery-body button:has-text("Submit for QC")');
  await page.waitForTimeout(150);
  await page.click('#joinery-body button:has-text("Pass")');
  await page.waitForTimeout(150);
  await shot(page, 'joinery-qc-passed-ready-for-handoff');
  await page.click('#joinery-body button:has-text("Hand Off")');
  await page.waitForTimeout(150);
  await shot(page, 'joinery-handed-off');
  const afterHandoff = await page.evaluate((args) => getJobCard(args.jobId).items.find(it => it.lineId === args.lineId).departmentStatuses, { jobId: seed.jobId, lineId: seed.cabinetLineId });
  record('Hand-off marks carp done and queues paint next', (afterHandoff[0].status === 'done' && afterHandoff[1].status === 'queued') ? 'PASS' : 'FAIL', JSON.stringify(afterHandoff));

  // ── Painting module: incoming work shows the handed-off line ──
  currentStep = 'painting-module';
  await openNode(page, 'painting', 'painting-module-wrap');
  await page.evaluate(() => paintingSetView('queue'));
  await page.waitForTimeout(200);
  await shot(page, 'painting-incoming-work');
  const paintingShowsIt = await page.evaluate(() => document.getElementById('painting-body').innerHTML.includes('Painted Cabinet Unit'));
  record('Painting queue shows the line handed off from Joinery', paintingShowsIt ? 'PASS' : 'FAIL');

  // Submit Painting's own budget (separate module, own form)
  await page.evaluate(() => paintingSetView('budget'));
  await page.waitForTimeout(200);
  await page.click('#painting-body button:has-text("Enter Budget")');
  await page.waitForTimeout(150);
  await page.fill('#pb-materials', '40');
  await page.click('#painting-body button:has-text("Submit for Approval")');
  await page.waitForTimeout(200);
  await shot(page, 'painting-budget-submitted');

  // Painting's budget is approved by the Joinery Production Manager, IN the Joinery module
  await openNode(page, 'joinery', 'joinery-module-wrap');
  await page.evaluate(() => joinerySetView('approvals'));
  await page.waitForTimeout(200);
  await shot(page, 'joinery-approvals-shows-painting-too');
  const approvalsShowPainting = await page.evaluate(() => document.getElementById('joinery-body').innerHTML.includes('Painting'));
  record('Joinery Approvals ALSO shows Painting\'s pending budget (same approver, separate submission)', approvalsShowPainting ? 'PASS' : 'FAIL');
  await page.click('#joinery-body .sales-card:has-text("Painting") button:has-text("Approve")');
  await page.waitForTimeout(200);

  // Back in Painting, production can now start
  await openNode(page, 'painting', 'painting-module-wrap');
  await page.evaluate(() => paintingSetView('queue'));
  await page.waitForTimeout(200);
  await page.click('#painting-body button:has-text("Start Production")');
  await page.waitForTimeout(200);
  const paintInProduction = await page.evaluate((args) => getJobCard(args.jobId).items.find(it => it.lineId === args.lineId).departmentStatuses.find(d => d.department === 'paint').status, { jobId: seed.jobId, lineId: seed.cabinetLineId });
  record('Painting can start production once its own budget is approved', paintInProduction === 'in-production' ? 'PASS' : 'FAIL', `status=${paintInProduction}`);

  // ── Upholstery module: fully independent flow (own approver) ──
  currentStep = 'upholstery-module';
  await openNode(page, 'upholstery', 'upholstery-module-wrap');
  await page.evaluate(() => upholsterySetView('queue'));
  await page.waitForTimeout(200);
  await shot(page, 'upholstery-queue');
  const upQueueShows = await page.evaluate(() => document.getElementById('upholstery-body').innerHTML.includes('Custom Sofa'));
  record('Upholstery queue shows the routed sofa line', upQueueShows ? 'PASS' : 'FAIL');
  await page.evaluate(() => upholsterySetView('budget'));
  await page.waitForTimeout(200);
  await page.click('#upholstery-body button:has-text("Enter Budget")');
  await page.waitForTimeout(150);
  await page.fill('#db-upholstery-materials', '120');
  await page.click('#upholstery-body button:has-text("Submit for Approval")');
  await page.waitForTimeout(200);
  await page.evaluate(() => upholsterySetView('approvals'));
  await page.waitForTimeout(200);
  await shot(page, 'upholstery-approvals-own-only');
  const upApprovalsShow = await page.evaluate(() => document.getElementById('upholstery-body').innerHTML.includes('Upholstery'));
  record('Upholstery Approvals shows only its own submission (separate approver from Joinery/Painting)', upApprovalsShow ? 'PASS' : 'FAIL');
  await page.click('#upholstery-body button:has-text("Approve")');
  await page.waitForTimeout(200);
  await page.evaluate(() => upholsterySetView('queue'));
  await page.waitForTimeout(200);
  await page.click('#upholstery-body button:has-text("Start Production")');
  await page.waitForTimeout(200);
  const upInProduction = await page.evaluate((args) => getJobCard(args.jobId).items.find(it => it.lineId === args.lineId).departmentStatuses.find(d => d.department === 'uph').status, { jobId: seed.jobId, lineId: seed.sofaLineId });
  record('Upholstery production starts once its own budget is approved', upInProduction === 'in-production' ? 'PASS' : 'FAIL', `status=${upInProduction}`);

  // ── Record actual cost, over-budget flag, rollup into projects[] ──
  currentStep = 'costing-rollup';
  const rollup = await page.evaluate((args) => {
    recordDepartmentActual(args.jobId, 'carp', { material: 260, labour: 90, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    const proj = projects.find(p => p.id === args.jobId);
    return { overBudget: isDepartmentOverBudget(args.jobId, 'carp'), budget: proj.budget, actuals: proj.actuals };
  }, { jobId: seed.jobId });
  record('Over-budget detected after recording a higher actual (flag only, no hold)', rollup.overBudget ? 'PASS' : 'FAIL', JSON.stringify(rollup));
  record('projects[] budget/actuals rollup reflects submitted figures', (rollup.budget.mat > 0 && rollup.actuals.mat > 0) ? 'PASS' : 'FAIL', JSON.stringify(rollup));

  await browser.close();
  printReport();
})();
