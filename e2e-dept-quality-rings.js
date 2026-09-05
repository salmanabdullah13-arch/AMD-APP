// Verification for Dashboard Analytics rollout, Phase 6 (5 Aug 2026) —
// the shared "Quality" card (dept-pipeline-ui.js's renderDeptQualityCard(),
// used by Joinery and Upholstery) and Painting's own separate
// renderPaintingQualityCard() are upgraded from a plain pass-rate number
// to a real ring gauge (cwRingStatCard, chart-widgets.js), bringing all
// three up to Curtain's existing visual tier. Confirms a real QC
// pass/fail cycle (via the shared production pipeline for Joinery/
// Upholstery, via Painting's own separate but string-identical pipeline)
// renders a ring with the correct pass rate for each department.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-dept-quality-rings');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label) { await page.screenshot({ path: path.join(SHOT_DIR, `${label}.png`) }); }
function printReport() {
  console.log('\n=== DEPARTMENT QUALITY RING GAUGE VERIFICATION ===');
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
  await page.waitForTimeout(300);
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
  record('App loads', 'PASS');

  // ── Empty state first: no QC history yet for a fresh department ──
  currentStep = 'joinery-empty-state';
  await openNode(page, 'joinery', 'joinery-module-wrap');
  const joineryEmpty = await page.evaluate(() => document.getElementById('joinery-body').innerHTML.includes('No QC results recorded yet.'));
  record('Joinery Quality card shows the plain empty-state message (no ring) when there is no QC history yet', joineryEmpty ? 'PASS' : 'FAIL');
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  currentStep = 'seed-joinery-qc-pass';
  const joinerySeed = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Quality Ring Joinery Client', contactPerson: 'Yara', tel: '39551122', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Yara', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Quality Ring Joinery Project', taxPercent: 10, contactPerson: 'Yara' });
    const item = addQuotationItem(qtn.id, { product: 'Wardrobe Cabinet', qty: 1, unit: 'Nos' });
    transferQuotationStage(qtn.id, 'approver', 'Estimator'); approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    submitDepartmentBudget(job.id, 'carp', { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    approveDepartmentBudget(job.id, 'carp', 'Owner');
    startLineProduction(job.id, item.lineId, 'carp');
    advanceJoinerySubStage(job.id, item.lineId, 'cutting');
    advanceJoinerySubStage(job.id, item.lineId, 'veneer-pressing');
    advanceJoinerySubStage(job.id, item.lineId, 'assembly');
    submitLineForQC(job.id, item.lineId, 'carp');
    recordLineQCResult(job.id, item.lineId, 'carp', true, 'Joinery Production Manager');
    return { jobId: job.id };
  });

  currentStep = 'joinery-ring-renders';
  await openNode(page, 'joinery', 'joinery-module-wrap');
  await shot(page, 'joinery-quality-ring');
  const joineryRing = await page.evaluate(() => {
    const html = document.getElementById('joinery-body').innerHTML;
    return { hasRingCard: html.includes('ring-card'), hasRingSvg: html.includes('ring-wrap'), has100pct: html.includes('100%'), hasFirstPassLabel: html.includes('First-Pass QC Rate') };
  });
  record('Joinery Quality card now renders a real ring gauge (cwRingStatCard) at 100% pass rate after one real QC pass', joineryRing.hasRingCard && joineryRing.hasRingSvg && joineryRing.has100pct && joineryRing.hasFirstPassLabel ? 'PASS' : 'FAIL', JSON.stringify(joineryRing));
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  // ── Upholstery: same shared function, confirm it's isolated per-department ──
  currentStep = 'seed-upholstery-qc-fail';
  await page.evaluate(() => {
    const cust = createCustomer({ name: 'Quality Ring Upholstery Client', contactPerson: 'Noor', tel: '39551133', address: 'Manama' });
    const enq = createEnquiry({ division: 'Upholstery', customerId: cust.id, contactPerson: 'Noor', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Quality Ring Upholstery Project', taxPercent: 10, contactPerson: 'Noor' });
    const item = addQuotationItem(qtn.id, { product: 'Sofa Set', qty: 1, unit: 'Nos' });
    transferQuotationStage(qtn.id, 'approver', 'Estimator'); approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    submitDepartmentBudget(job.id, 'uph', { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'Upholstery Manager');
    approveDepartmentBudget(job.id, 'uph', 'Owner');
    startLineProduction(job.id, item.lineId, 'uph');
    submitLineForQC(job.id, item.lineId, 'uph');
    recordLineQCResult(job.id, item.lineId, 'uph', false, 'Upholstery Manager');
  });

  currentStep = 'upholstery-ring-renders';
  await openNode(page, 'upholstery-legacy', 'upholstery-module-wrap');   // the Batch 8 wrapper this card belongs to (retired 5 Sep 2026, still launchable)
  await shot(page, 'upholstery-quality-ring');
  const upholsteryRing = await page.evaluate(() => {
    const html = document.getElementById('upholstery-body').innerHTML;
    return { hasRingCard: html.includes('ring-card'), has0pct: html.includes('0%') };
  });
  record('Upholstery Quality card renders its own ring gauge at 0% (one QC fail), correctly isolated from Joinery\'s 100%', upholsteryRing.hasRingCard && upholsteryRing.has0pct ? 'PASS' : 'FAIL', JSON.stringify(upholsteryRing));
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  // ── Painting: its own separate function, same upgrade ──
  currentStep = 'seed-painting-qc-pass';
  await page.evaluate(() => {
    const cust = createCustomer({ name: 'Quality Ring Painting Client', contactPerson: 'Reem', tel: '39551144', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Reem', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Quality Ring Painting Project', taxPercent: 10, contactPerson: 'Reem' });
    const item = addQuotationItem(qtn.id, { product: 'Painted TV Unit Cabinet', qty: 1, unit: 'Nos' });
    transferQuotationStage(qtn.id, 'approver', 'Estimator'); approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    submitDepartmentBudget(job.id, 'carp', { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    approveDepartmentBudget(job.id, 'carp', 'Owner');
    startLineProduction(job.id, item.lineId, 'carp');
    advanceJoinerySubStage(job.id, item.lineId, 'cutting');
    advanceJoinerySubStage(job.id, item.lineId, 'veneer-pressing');
    advanceJoinerySubStage(job.id, item.lineId, 'assembly');
    submitLineForQC(job.id, item.lineId, 'carp');
    recordLineQCResult(job.id, item.lineId, 'carp', true, 'Joinery Production Manager');
    handOffLine(job.id, item.lineId, 'carp', 'Joinery Production Manager');
    submitDepartmentBudget(job.id, 'paint', { materials: 50, labour: 30, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    approveDepartmentBudget(job.id, 'paint', 'Owner');
    startPaintingWork(job.id, item.lineId);
    submitPaintingForQC(job.id, item.lineId);
    recordPaintingQCResult(job.id, item.lineId, true, 'Painting Lead / Work Supervisor');
  });

  currentStep = 'painting-ring-renders';
  await openNode(page, 'painting', 'painting-module-wrap');
  await shot(page, 'painting-quality-ring');
  const paintingRing = await page.evaluate(() => {
    const html = document.getElementById('painting-body').innerHTML;
    return { hasRingCard: html.includes('ring-card'), has100pct: html.includes('100%') };
  });
  record('Painting Quality card (its own separate function) also renders a real ring gauge', paintingRing.hasRingCard && paintingRing.has100pct ? 'PASS' : 'FAIL', JSON.stringify(paintingRing));

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
