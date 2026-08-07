// Verification for dashboard enhancements (4 Aug 2026): Operations' main
// Dashboard tab was entirely static hand-authored demo markup baked into
// index.html — fake KPI numbers, fake project rows, zero JS ever touched
// it. Replaced with a real renderOpsDashboard() reading actual job/task/
// invoice data. Also enriched Joinery/Upholstery/Painting's dashboards,
// which showed production-queue counts only, with real budget-status
// visibility (Budgets Pending / Over Budget) that already existed in the
// data layer but was never surfaced.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-dashboard-enhancements');
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
  console.log('\n=== DASHBOARD ENHANCEMENTS VERIFICATION ===');
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
  record('App loads (real Supabase login replaced the old PIN, 4 Aug 2026)', 'PASS');

  // ── Operations: confirm the old static fake content is gone before seeding ──
  currentStep = 'operations-dashboard-empty-state';
  await openNode(page, 'operations', 'ops-module-wrap');
  await shot(page, 'operations-empty');
  const emptyState = await page.evaluate(() => {
    const html = document.getElementById('ops-dashboard-body').innerHTML;
    return {
      noFakeProject: !html.includes('Majlis Refurbishment') && !html.includes('AMD-15010'),
      // The 4-Aug redesign leads with the action queue and compacts the
      // numbers band to three tiles — 'Needs Action' is deliberately gone
      // (the queue owns it) and Approval Pending/Open Tasks moved into it.
      hasRealKpiLabels: html.includes('Active Jobs') && html.includes('Jobs On Budget') && html.includes('Invoiced This Month'),
      hasActionQueue: html.includes('opsGoTo('),
      noSubsOrSnags: !html.includes('Subs overdue') && !html.includes('Snags open')
    };
  });
  record('Old static fake project rows (Majlis Refurbishment, AMD-15010) are gone', emptyState.noFakeProject ? 'PASS' : 'FAIL', JSON.stringify(emptyState));
  record('Real KPI tiles render (Active Jobs / Jobs On Budget / Invoiced This Month) above a real action queue', emptyState.hasRealKpiLabels && emptyState.hasActionQueue ? 'PASS' : 'FAIL', JSON.stringify(emptyState));
  record('Fabricated "Subs overdue"/"Snags open" tiles removed rather than faked (no real data backs them)', emptyState.noSubsOrSnags ? 'PASS' : 'FAIL');
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  // ── Seed a realistic mix: one clear job, one unrouted (needs action), one with a pending dept budget ──
  currentStep = 'seed-real-data';
  const seed = await page.evaluate(() => {
    salesCurrentUser = 'Salman Abdullah';
    function makeJob(name, rate, route) {
      const cust = createCustomer({ name: name + ' Client', contactPerson: 'X', tel: '3900' + Math.floor(Math.random() * 900000), address: 'Manama' });
      const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'X', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
      const q = convertEnquiryToQuotation(enq.id, { projectName: name, taxPercent: 10, contactPerson: 'X' });
      addQuotationItem(q.id, { product: 'Item', qty: 1, unit: 'Nos' });
      const item = q.items[0];
      addBOMMaterial(q.id, item.lineId, { name: 'Board', qty: 1, unit: 'Nos', rate });
      submitItemBOM(q.id, item.lineId, 'Estimator User');
      transferQuotationStage(q.id, 'approver', 'Estimator'); approveQuotation(q.id, 'Salman Abdullah');
      const job = confirmQuotationToJobCard(q.id, 'Salman Abdullah');
      if (route) confirmJobRouting(job.id, {}, 'Operations Manager');
      return job;
    }
    const clearJob = makeJob('Dash Clear Job', 500, true);
    const unroutedJob = makeJob('Dash Unrouted Job', 300, false);

    const budgetJobEnq = createEnquiry({ division: 'Joinery', customerId: createCustomer({ name: 'Dash Budget Client', contactPerson: 'X', tel: '39887799', address: 'Manama' }).id, contactPerson: 'X', tel: '39887799', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const budgetQ = convertEnquiryToQuotation(budgetJobEnq.id, { projectName: 'Dash Budget Job', taxPercent: 10, contactPerson: 'X' });
    addQuotationItem(budgetQ.id, { product: 'Cabinet', qty: 1, unit: 'Nos' });
    transferQuotationStage(budgetQ.id, 'approver', 'Estimator'); approveQuotation(budgetQ.id, 'Salman Abdullah');
    const budgetJob = confirmQuotationToJobCard(budgetQ.id, 'Salman Abdullah');
    confirmJobRouting(budgetJob.id, {}, 'Operations Manager');
    submitDepartmentBudget(budgetJob.id, 'carp', { mat: 100, lab: 50, sub: 0, hir: 0, oth: 0 }, 'Joinery Production Manager');

    createTask({ title: 'Follow up with client', assignee: STAFF[0], linkedType: 'job', linkedId: clearJob.id });

    return { clearJobId: clearJob.id, unroutedJobId: unroutedJob.id, budgetJobId: budgetJob.id };
  });

  // ── Operations dashboard now reflects real seeded data ──
  currentStep = 'operations-dashboard-real-data';
  await openNode(page, 'operations', 'ops-module-wrap');
  await shot(page, 'operations-with-real-data');
  const opsState = await page.evaluate((s) => {
    const html = document.getElementById('ops-dashboard-body').innerHTML;
    return {
      showsUnroutedInAttention: html.includes('Dash Unrouted Job') && html.includes('Awaiting Routing'),
      showsClearJobInAllClear: html.includes('Dash Clear Job'),
      showsBudgetPendingJobFlagged: html.includes('Dash Budget Job') && html.includes('Budget Pending'),
      newJobsBadgeReal: document.querySelector('#ops-module-wrap [data-p="alerts"] .nbadge')?.textContent
    };
  }, seed);
  record('Unrouted job appears in "Needs your attention now" tagged Awaiting Routing', opsState.showsUnroutedInAttention ? 'PASS' : 'FAIL', JSON.stringify(opsState));
  record('Clear (routed, no flags) job appears in "All clear"', opsState.showsClearJobInAllClear ? 'PASS' : 'FAIL');
  record('Job with a pending department budget is flagged "Needs Action" too', opsState.showsBudgetPendingJobFlagged ? 'PASS' : 'FAIL');
  record('"New Jobs" nav badge reflects real unrouted count, not stale/fake', opsState.newJobsBadgeReal === '1' ? 'PASS' : 'FAIL', `badge=${opsState.newJobsBadgeReal}`);

  const opsKpis = await page.evaluate(() => {
    const nums = Array.from(document.querySelectorAll('#ops-dashboard-body .kpi .kv')).map(el => el.textContent.trim());
    return nums;
  });
  record('Active Jobs KPI counts only routed, non-cancelled jobs (2: clear + budget job)', opsKpis[0] === '2' ? 'PASS' : 'FAIL', JSON.stringify(opsKpis));

  // ── Dashboard Analytics rollout (5 Aug 2026), Phase 5 — new Pipeline
  // Funnel + Department Queue Depth cards, genuinely new information on
  // this dashboard (unlike Owner's, which already had these as plain
  // number rows before its own chart upgrade). Reuses the exact seed
  // data above: unroutedJob -> "Job Confirmed" stage; clearJob/budgetJob
  // (both routed to carp, per division "Joinery") -> "In Production" and
  // queued into the Joinery department queue.
  currentStep = 'analytics-charts';
  const analytics = await page.evaluate(() => {
    const html = document.getElementById('ops-dashboard-body').innerHTML;
    return {
      hasPipelineFunnelSection: html.includes('Pipeline Funnel'),
      hasJobConfirmedStage: html.includes('Job Confirmed'),
      hasInProductionStage: html.includes('In Production'),
      hasQueueDepthSection: html.includes('Department Queue Depth'),
      hasJoineryBar: html.includes('Carpentry') || html.includes('Joinery')
    };
  });
  record('Operations Dashboard renders the new Pipeline Funnel section with real stage buckets (Job Confirmed / In Production)', analytics.hasPipelineFunnelSection && analytics.hasJobConfirmedStage && analytics.hasInProductionStage ? 'PASS' : 'FAIL', JSON.stringify(analytics));
  record('Operations Dashboard renders the new Department Queue Depth section', analytics.hasQueueDepthSection && analytics.hasJoineryBar ? 'PASS' : 'FAIL', JSON.stringify(analytics));

  // Navigating INTO Operations from the ecosystem hub re-renders — this was
  // the actual bug found live-testing the fix: goTo('operations') never
  // called renderOpsDashboard() at all, only opsGoTo() (switching between
  // Operations' OWN internal tabs) did.
  currentStep = 'operations-refreshes-on-hub-navigation';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await page.evaluate((jobId) => {
    // setJobStatus('completed') now (6 Aug 2026 audit) refuses while routed
    // production is unfinished — walk the clear job's line to done first,
    // the same way a real job would actually reach completed.
    const job = getJobCard(jobId);
    const lineId = job.items[0].lineId;
    submitDepartmentBudget(jobId, 'carp', { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'Estimator User');
    approveDepartmentBudget(jobId, 'carp', 'Operations Manager');
    startLineProduction(jobId, lineId, 'carp');
    const entry = job.items[0].departmentStatuses.find(d => d.department === 'carp');
    if (entry.joinerySubStage) ['cutting', 'veneer-pressing', 'assembly'].forEach(s => advanceJoinerySubStage(jobId, lineId, s));
    submitLineForQC(jobId, lineId, 'carp');
    recordLineQCResult(jobId, lineId, 'carp', true, DEPT_QC_AUTHORITY.carp);
    handOffLine(jobId, lineId, 'carp', 'Lead');
    jobsSetStatus(jobId, 'completed');
  }, seed.clearJobId);
  await openNode(page, 'operations', 'ops-module-wrap');
  const refreshedKpi = await page.evaluate(() => document.querySelector('#ops-dashboard-body .kpi .kv').textContent.trim());
  record('Re-entering Operations from the ecosystem hub shows fresh data (not stale from first load)', refreshedKpi === '1' ? 'PASS' : 'FAIL', `activeJobs now shows ${refreshedKpi}, expected 1 (clear job marked completed)`);
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  // ── Joinery dashboard shows real budget-pending count ──
  currentStep = 'joinery-dashboard-budget-visibility';
  await openNode(page, 'joinery', 'joinery-module-wrap');
  await shot(page, 'joinery-with-budget-pending');
  const joineryState = await page.evaluate(() => {
    const html = document.getElementById('joinery-body').innerHTML;
    return { hasBudgetsPending: html.includes('Budgets Pending'), hasOverBudget: html.includes('Over Budget'), hasRework: html.includes('In Rework') };
  });
  record('Joinery dashboard shows a real Budgets Pending tile (previously absent)', joineryState.hasBudgetsPending ? 'PASS' : 'FAIL', JSON.stringify(joineryState));
  record('Joinery dashboard shows a real Over Budget tile', joineryState.hasOverBudget ? 'PASS' : 'FAIL');
  const joineryKpis = await page.evaluate(() => Array.from(document.querySelectorAll('#joinery-body .sales-kpi-tile .num')).map(el => el.textContent.trim()));
  record('Joinery\'s Budgets Pending tile shows the real count (1)', joineryKpis[4] === '1' ? 'PASS' : 'FAIL', JSON.stringify(joineryKpis));
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  // ── Upholstery dashboard shows the same enrichment, correctly isolated (0, not leaking Joinery's count) ──
  currentStep = 'upholstery-dashboard-budget-visibility';
  await openNode(page, 'upholstery', 'upholstery-module-wrap');
  await shot(page, 'upholstery-dashboard');
  const upholsteryKpis = await page.evaluate(() => Array.from(document.querySelectorAll('#upholstery-body .sales-kpi-tile .num')).map(el => el.textContent.trim()));
  record('Upholstery\'s Budgets Pending stays 0 — correctly isolated from Joinery\'s pending budget', upholsteryKpis[4] === '0' ? 'PASS' : 'FAIL', JSON.stringify(upholsteryKpis));
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  // ── Painting dashboard shows Over Budget + Rework (previously absent), no Approvals tab (by design) ──
  currentStep = 'painting-dashboard-enrichment';
  await openNode(page, 'painting', 'painting-module-wrap');
  await shot(page, 'painting-dashboard');
  const paintingState = await page.evaluate(() => {
    const html = document.getElementById('painting-body').innerHTML;
    return { hasRework: html.includes('In Rework'), hasOverBudget: html.includes('Over Budget'), noApprovalsTab: !html.includes('>Approvals<') };
  });
  record('Painting dashboard now shows an In Rework tile (previously absent)', paintingState.hasRework ? 'PASS' : 'FAIL', JSON.stringify(paintingState));
  record('Painting dashboard now shows an Over Budget tile', paintingState.hasOverBudget ? 'PASS' : 'FAIL');
  record('Painting still has no Approvals tab — by design, budgets approve via Joinery', paintingState.noApprovalsTab ? 'PASS' : 'FAIL');

  await browser.close();
  printReport();
})();
