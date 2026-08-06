// Verification for Milestone C of the role-based access rollout (5 Aug
// 2026) — two new ecosystem entry points for Upholstery's granular
// roles (Team Leader, QC/Packaging Team). Unlike Curtain (Milestone B,
// which already had genuinely separate standalone dashboards built),
// Upholstery is a thin wrapper around the shared Joinery/Upholstery
// production-pipeline primitive (dept-pipeline-ui.js) with one
// undifferentiated queue view — so this milestone reuses the EXISTING
// upholstery-module-wrap (not a new standalone overlay) but lands on a
// restricted, no-tab-bar view scoped to each role's own stage(s) of the
// pipeline, via renderDeptQueue()'s new optional statusFilter param.
//
// Proves: each entry point opens with NO tab bar (so Budgets/Approvals/
// the Manager's own Dashboard are never reachable, not just hidden),
// each shows only its own role's relevant queue rows for a routed job
// with lines at every pipeline stage, and closing returns cleanly to
// the ecosystem with no other module wrap visible.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-upholstery-granular');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== UPHOLSTERY GRANULAR DASHBOARDS VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const OTHER_WRAPS = ['sales-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'painting-module-wrap', 'owner-module-wrap'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForTimeout(500);

  // Route a job with an upholstery line through every pipeline stage so
  // both new views have real, distinct rows to show — reusing the
  // exact data-layer functions e2e-batch8-phase2-4.js already exercises.
  currentStep = 'setup-routed-job';
  const setup = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Upholstery Granular Test Client', contactPerson: 'Reem', tel: '39556699', address: 'Manama' });
    const enq = createEnquiry({ division: 'Upholstery', customerId: cust.id, contactPerson: 'Reem', tel: '39556699', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Upholstery Granular Test Project', taxPercent: 10, contactPerson: 'Reem' });
    const item1 = addQuotationItem(qtn.id, { product: 'Armchair A', qty: 1, unit: 'Nos' });
    const item2 = addQuotationItem(qtn.id, { product: 'Armchair B', qty: 1, unit: 'Nos' });
    item1.departmentSequence = ['uph'];
    item2.departmentSequence = ['uph'];
    transferQuotationStage(qtn.id, 'approver', 'Estimator'); approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    submitDepartmentBudget(job.id, 'uph', { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'Upholstery Manager');
    approveDepartmentBudget(job.id, 'uph', 'Operations Manager'); // maker-checker (Fix Plan Phase 2): approver must differ from submitter
    // item1 stays 'queued' (Team Leader's stage); item2 advances to 'qc' (QC/Packaging's stage).
    startLineProduction(job.id, item2.lineId, 'uph');
    submitLineForQC(job.id, item2.lineId, 'uph');
    return { jobId: job.id, item1Status: getJobCard(job.id).items.find(i => i.lineId === item1.lineId).departmentStatuses[0].status, item2Status: getJobCard(job.id).items.find(i => i.lineId === item2.lineId).departmentStatuses[0].status };
  });
  record('Test job routed with one line queued and one line at qc', setup.item1Status === 'queued' && setup.item2Status === 'qc' ? 'PASS' : 'FAIL', JSON.stringify(setup));

  currentStep = 'team-leader-open';
  const teamLeaderOpen = await page.evaluate(() => {
    const branch = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === 'upholstery-team-leader');
    if (!branch) return { error: 'branch not found' };
    branch.userData.node.launch();
    return { ok: true };
  });
  await page.waitForTimeout(600);
  const teamLeaderState = await page.evaluate((jobId) => {
    const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
    const otherWraps = ['sales-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'painting-module-wrap', 'owner-module-wrap'];
    const bodyText = document.getElementById('upholstery-body')?.textContent || '';
    return {
      wrapVisible: isVisible('upholstery-module-wrap'),
      anyOtherVisible: otherWraps.some(isVisible),
      hasTabBar: !!document.querySelector('#upholstery-body .sales-tabs'),
      showsJob: bodyText.includes(jobId),
      showsArmchairA: bodyText.includes('Armchair A'),
      showsArmchairB: bodyText.includes('Armchair B')
    };
  }, setup.jobId);
  record(
    "Team Leader entry point opens with the production queue (queued line), no tab bar, no other module visible",
    !teamLeaderOpen.error && teamLeaderState.wrapVisible && !teamLeaderState.anyOtherVisible && !teamLeaderState.hasTabBar && teamLeaderState.showsArmchairA && !teamLeaderState.showsArmchairB ? 'PASS' : 'FAIL',
    JSON.stringify({ teamLeaderOpen, teamLeaderState })
  );
  await shot(page, 'team-leader-view', 1);

  currentStep = 'team-leader-close';
  await page.click('#upholstery-module-wrap button[onclick="closeUpholsteryModule()"]');
  await page.waitForTimeout(500);
  const afterTeamLeaderClose = await page.evaluate(() => {
    const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
    return { wrapHidden: !isVisible('upholstery-module-wrap'), ecoVisible: !!document.getElementById('scroll') && getComputedStyle(document.getElementById('scroll')).display !== 'none' };
  });
  record('Closing the Team Leader view returns cleanly to the ecosystem', afterTeamLeaderClose.wrapHidden && afterTeamLeaderClose.ecoVisible ? 'PASS' : 'FAIL', JSON.stringify(afterTeamLeaderClose));

  currentStep = 'qc-packaging-open';
  const qcOpen = await page.evaluate(() => {
    const branch = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === 'upholstery-qc-packaging');
    if (!branch) return { error: 'branch not found' };
    branch.userData.node.launch();
    return { ok: true };
  });
  await page.waitForTimeout(600);
  const qcState = await page.evaluate(() => {
    const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
    const otherWraps = ['sales-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'painting-module-wrap', 'owner-module-wrap'];
    const bodyText = document.getElementById('upholstery-body')?.textContent || '';
    return {
      wrapVisible: isVisible('upholstery-module-wrap'),
      anyOtherVisible: otherWraps.some(isVisible),
      hasTabBar: !!document.querySelector('#upholstery-body .sales-tabs'),
      showsArmchairA: bodyText.includes('Armchair A'),
      showsArmchairB: bodyText.includes('Armchair B')
    };
  });
  record(
    "QC/Packaging entry point opens with the QC queue (qc-stage line), no tab bar, no other module visible",
    !qcOpen.error && qcState.wrapVisible && !qcState.anyOtherVisible && !qcState.hasTabBar && !qcState.showsArmchairA && qcState.showsArmchairB ? 'PASS' : 'FAIL',
    JSON.stringify({ qcOpen, qcState })
  );
  await shot(page, 'qc-packaging-view', 2);

  currentStep = 'qc-packaging-close';
  await page.click('#upholstery-module-wrap button[onclick="closeUpholsteryModule()"]');
  await page.waitForTimeout(500);
  const afterQCClose = await page.evaluate(() => {
    const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
    return { wrapHidden: !isVisible('upholstery-module-wrap'), ecoVisible: !!document.getElementById('scroll') && getComputedStyle(document.getElementById('scroll')).display !== 'none' };
  });
  record('Closing the QC/Packaging view returns cleanly to the ecosystem', afterQCClose.wrapHidden && afterQCClose.ecoVisible ? 'PASS' : 'FAIL', JSON.stringify(afterQCClose));

  currentStep = 'manager-dashboard-unaffected';
  const managerOpen = await page.evaluate(() => {
    const branch = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === 'upholstery');
    if (!branch) return { error: 'branch not found' };
    branch.userData.node.launch();
    return { ok: true };
  });
  await page.waitForTimeout(600);
  const managerState = await page.evaluate(() => !!document.querySelector('#upholstery-body .sales-tabs'));
  record('The Upholstery Manager\'s own entry point still shows the full tab bar (Dashboard/Queue/Budgets/Approvals), unaffected by the new restricted views', !managerOpen.error && managerState ? 'PASS' : 'FAIL', JSON.stringify({ managerOpen, managerState }));
  await shot(page, 'manager-dashboard', 3);

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
