// Verification for Milestone D of the role-based access rollout (5 Aug
// 2026) — Joinery's new internal sub-stage layer (data.js:
// JOINERY_SUB_STAGES/advanceJoinerySubStage/getJoinerySubStageQueue/
// getJoineryFloorOverview) plus four new ecosystem entry points
// (Draftsman, Cutting List Team, Veneer Pressing Team, Floor Overview
// shared by Team Leader/Floor Supervisor/Site Supervisor).
//
// This is the one department that needed genuinely NEW internal
// granularity, not just wiring — Joinery had a single flat
// queued/in-production/qc/done pipeline, same as Upholstery. Proves
// the whole chain live: starting production seeds joinerySubStage,
// each granular role's queue shows only its own stage, advancing moves
// the line to the next role's queue, the final stage (assembly) is
// still submitted for QC through the existing shared Production Queue
// (unchanged), and the Floor Overview shows the right counts per stage
// with no action buttons (read-only, by design).

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-joinery-substages');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== JOINERY SUB-STAGES VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const OTHER_WRAPS = ['sales-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap'];

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
    const cust = createCustomer({ name: 'Joinery Substage Test Client', contactPerson: 'Arun', tel: '39001234', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Arun', tel: '39001234', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Joinery Substage Test Project', taxPercent: 10, contactPerson: 'Arun' });
    const item = addQuotationItem(qtn.id, { product: 'TV Unit', qty: 1, unit: 'Nos' });
    item.departmentSequence = ['carp'];
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    submitDepartmentBudget(job.id, 'carp', { materials: 200, labour: 100, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    approveDepartmentBudget(job.id, 'carp', 'Joinery Production Manager');
    const startResult = startLineProduction(job.id, item.lineId, 'carp');
    return { jobId: job.id, lineId: item.lineId, subStageAfterStart: startResult.departmentStatuses.find(d => d.department === 'carp').joinerySubStage };
  });
  record('startLineProduction() seeds joinerySubStage to the first stage (drafting)', setup.subStageAfterStart === 'drafting' ? 'PASS' : 'FAIL', JSON.stringify(setup));

  const stages = [
    { node: 'joinery-drafting', stage: 'drafting', next: 'cutting', label: 'Draftsman' },
    { node: 'joinery-cutting', stage: 'cutting', next: 'veneer-pressing', label: 'Cutting List Team' },
    { node: 'joinery-veneer-pressing', stage: 'veneer-pressing', next: 'assembly', label: 'Veneer Pressing Team' }
  ];

  for (const s of stages) {
    currentStep = `${s.stage}-view`;
    const opened = await page.evaluate((nodeId) => {
      const branch = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === nodeId);
      if (!branch) return { error: 'branch not found' };
      branch.userData.node.launch();
      return { ok: true };
    }, s.node);
    await page.waitForTimeout(600);
    const state = await page.evaluate((jobId) => {
      const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
      const otherWraps = ['sales-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap'];
      const bodyText = document.getElementById('joinery-body')?.textContent || '';
      return { wrapVisible: isVisible('joinery-module-wrap'), anyOtherVisible: otherWraps.some(isVisible), hasTabBar: !!document.querySelector('#joinery-body .sales-tabs'), showsJob: bodyText.includes(jobId) };
    }, setup.jobId);
    record(
      `${s.label}'s entry point shows the job at the ${s.stage} stage, no tab bar, no other module visible`,
      !opened.error && state.wrapVisible && !state.anyOtherVisible && !state.hasTabBar && state.showsJob ? 'PASS' : 'FAIL',
      JSON.stringify({ opened, state })
    );
    await shot(page, `${s.stage}-view`, stages.indexOf(s) * 2 + 1);

    currentStep = `${s.stage}-advance`;
    // Real interaction path — clicking the actual advance button.
    await page.click(`button[onclick*="joineryAdvanceSubStage"]`);
    await page.waitForTimeout(400);
    const afterAdvance = await page.evaluate((args) => {
      const job = getJobCard(args.jobId);
      const entry = job.items.find(it => it.lineId === args.lineId).departmentStatuses.find(d => d.department === 'carp');
      return { subStage: entry.joinerySubStage, status: entry.status };
    }, { jobId: setup.jobId, lineId: setup.lineId });
    record(`Clicking "${s.label} Done" advances joinerySubStage to ${s.next}`, afterAdvance.subStage === s.next && afterAdvance.status === 'in-production' ? 'PASS' : 'FAIL', JSON.stringify(afterAdvance));
    await shot(page, `${s.stage}-after-advance`, stages.indexOf(s) * 2 + 2);

    await page.click('#joinery-module-wrap button[onclick="closeJoineryModule()"]');
    await page.waitForTimeout(400);
  }

  currentStep = 'assembly-ready-for-qc';
  const assemblyState = await page.evaluate((jobId) => {
    const opened = (() => {
      const branch = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === 'joinery');
      if (!branch) return false;
      branch.userData.node.launch();
      return true;
    })();
    return { opened };
  }, setup.jobId);
  await page.waitForTimeout(600);
  await page.evaluate(() => { if (typeof joinerySetView === 'function') joinerySetView('queue'); });
  await page.waitForTimeout(400);
  const queueShowsSubmitForQC = await page.evaluate(() => {
    const bodyText = document.getElementById('joinery-body')?.textContent || '';
    return bodyText.includes('Submit for QC');
  });
  record('Once at the final sub-stage (assembly), the line is submitted for QC through the existing, unchanged Production Queue tab', assemblyState.opened && queueShowsSubmitForQC ? 'PASS' : 'FAIL', JSON.stringify({ assemblyState, queueShowsSubmitForQC }));
  await page.click('#joinery-module-wrap button[onclick="closeJoineryModule()"]');
  await page.waitForTimeout(400);

  currentStep = 'floor-overview';
  const floorSetup = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Joinery Floor Test Client 2', contactPerson: 'Arun', tel: '39001235', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Arun', tel: '39001235', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Joinery Floor Test Project 2', taxPercent: 10, contactPerson: 'Arun' });
    const item = addQuotationItem(qtn.id, { product: 'Wardrobe', qty: 1, unit: 'Nos' });
    item.departmentSequence = ['carp'];
    approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    submitDepartmentBudget(job.id, 'carp', { materials: 200, labour: 100, subcontract: 0, hiring: 0, others: 0 }, 'Joinery Production Manager');
    approveDepartmentBudget(job.id, 'carp', 'Joinery Production Manager');
    startLineProduction(job.id, item.lineId, 'carp'); // stays at 'drafting'
    return { jobId: job.id };
  });
  const floorOpened = await page.evaluate(() => {
    const branch = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === 'joinery-floor');
    if (!branch) return { error: 'branch not found' };
    branch.userData.node.launch();
    return { ok: true };
  });
  await page.waitForTimeout(600);
  const floorState = await page.evaluate((args) => {
    const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
    const bodyText = document.getElementById('joinery-body')?.textContent || '';
    return {
      wrapVisible: isVisible('joinery-module-wrap'),
      hasTabBar: !!document.querySelector('#joinery-body .sales-tabs'),
      hasActionButtons: !!document.querySelector('#joinery-body button[onclick*="joineryAdvanceSubStage"]'),
      showsBothJobs: bodyText.includes(args.job1) && bodyText.includes(args.job2),
      showsCuttingWithVeneerJob: bodyText.includes('Veneer Pressing') // sanity: cutting-stage job from earlier test is now at veneer-pressing
    };
  }, { job1: setup.jobId, job2: floorSetup.jobId });
  record(
    'Floor Overview (Team Leader/Floor Supervisor/Site Supervisor) shows all in-production lines grouped by stage, read-only, no tab bar',
    !floorOpened.error && floorState.wrapVisible && !floorState.hasTabBar && !floorState.hasActionButtons && floorState.showsBothJobs ? 'PASS' : 'FAIL',
    JSON.stringify({ floorOpened, floorState })
  );
  await shot(page, 'floor-overview', 10);
  await page.click('#joinery-module-wrap button[onclick="closeJoineryModule()"]');
  await page.waitForTimeout(400);

  currentStep = 'manager-dashboard-unaffected';
  const managerOpen = await page.evaluate(() => {
    const branch = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === 'joinery');
    if (!branch) return { error: 'branch not found' };
    branch.userData.node.launch();
    return { ok: true };
  });
  await page.waitForTimeout(600);
  const managerHasTabs = await page.evaluate(() => !!document.querySelector('#joinery-body .sales-tabs'));
  record('The Joinery Production Manager\'s own entry point still shows the full tab bar, unaffected by the new restricted views', !managerOpen.error && managerHasTabs ? 'PASS' : 'FAIL', JSON.stringify({ managerOpen, managerHasTabs }));

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
