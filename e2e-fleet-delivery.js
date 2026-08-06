// Verification for Milestone E of the role-based access rollout (5 Aug
// 2026) — the last milestone in the plan, two entirely new modules with
// no existing code to build on (unlike Curtain/Upholstery/Joinery):
// Vehicle Fleet Inspector (vehicle list + inspection checklist/log) and
// Delivery/Scheduling (a planning layer alongside the existing,
// unchanged job.deliveryNotes[] system — see the design note in
// data.js for why it's a separate layer, not a change to that system).
//
// Proves: adding a vehicle, recording a pass and a fail inspection
// (overall status correctly derived from the checklist), the fleet KPI
// counts, scheduling a delivery for a real routed job, marking it
// delivered, and that both new module wraps open/close cleanly with no
// other module wrap left visible (the same discipline every other
// Milestone B/C/D dashboard was checked for).

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-fleet-delivery');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== VEHICLE FLEET + DELIVERY SCHEDULING VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const OTHER_WRAPS = ['sales-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForTimeout(500);

  currentStep = 'open-fleet';
  const fleetOpened = await page.evaluate(() => {
    const branch = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === 'fleet');
    if (!branch) return { error: 'branch not found' };
    branch.userData.node.launch();
    return { ok: true };
  });
  await page.waitForTimeout(600);
  const fleetOpenState = await page.evaluate(() => {
    const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
    const otherWraps = ['sales-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap'];
    return { wrapVisible: isVisible('fleet-module-wrap'), anyOtherVisible: otherWraps.some(isVisible) };
  });
  record('Vehicle Fleet Inspector opens as a standalone entry point with no other module wrap visible', !fleetOpened.error && fleetOpenState.wrapVisible && !fleetOpenState.anyOtherVisible ? 'PASS' : 'FAIL', JSON.stringify({ fleetOpened, fleetOpenState }));
  await shot(page, 'fleet-list-empty', 1);

  currentStep = 'add-vehicle';
  await page.click('button:has-text("+ Add Vehicle")');
  await page.fill('#fleet-new-plate', 'BH-1234');
  await page.fill('#fleet-new-make', 'Toyota');
  await page.fill('#fleet-new-model', 'Hiace');
  await page.selectOption('#fleet-new-type', 'Van');
  await page.click('button:has-text("Save Vehicle")');
  await page.waitForTimeout(300);
  const vehicleAdded = await page.evaluate(() => vehicles.length === 1 && vehicles[0].plateNumber === 'BH-1234');
  record('Adding a vehicle through the real form persists it', vehicleAdded ? 'PASS' : 'FAIL', JSON.stringify({ vehicleAdded }));

  currentStep = 'record-pass-inspection';
  await page.click('tr:has-text("BH-1234")');
  await page.click('button:has-text("+ New Inspection")');
  await page.click('button:has-text("Submit Inspection")'); // all default to "Pass"
  await page.waitForTimeout(300);
  const passInspection = await page.evaluate(() => vehicleInspections.length === 1 ? vehicleInspections[0].overallStatus : null);
  record('Recording an inspection with everything passing gives overallStatus "pass"', passInspection === 'pass' ? 'PASS' : 'FAIL', JSON.stringify({ passInspection }));

  currentStep = 'record-fail-inspection';
  await page.click('button:has-text("+ New Inspection")');
  await page.selectOption('#fleet-insp-pass-0', 'fail');
  await page.fill('#fleet-insp-notes-0', 'Worn tread');
  await page.click('button:has-text("Submit Inspection")');
  await page.waitForTimeout(300);
  const failInspection = await page.evaluate(() => {
    const latest = vehicleInspections[vehicleInspections.length - 1];
    return { overallStatus: latest.overallStatus, failedItem: latest.checklist[0] };
  });
  record('One failed checklist item correctly makes the overall inspection "fail"', failInspection.overallStatus === 'fail' && failInspection.failedItem.pass === false && failInspection.failedItem.notes === 'Worn tread' ? 'PASS' : 'FAIL', JSON.stringify(failInspection));
  await shot(page, 'fleet-inspection-history', 2);

  currentStep = 'fleet-kpis';
  const kpis = await page.evaluate(() => getVehicleFleetKPIs());
  record('Fleet KPIs reflect the failed-last-inspection state', kpis.total === 1 && kpis.failedLast === 1 ? 'PASS' : 'FAIL', JSON.stringify(kpis));

  currentStep = 'close-fleet';
  await page.click('#fleet-module-wrap button[onclick="closeFleetModule()"]');
  await page.waitForTimeout(400);
  const afterFleetClose = await page.evaluate(() => {
    const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
    return { wrapHidden: !isVisible('fleet-module-wrap'), ecoVisible: !!document.getElementById('scroll') && getComputedStyle(document.getElementById('scroll')).display !== 'none' };
  });
  record('Closing Vehicle Fleet Inspector returns cleanly to the ecosystem', afterFleetClose.wrapHidden && afterFleetClose.ecoVisible ? 'PASS' : 'FAIL', JSON.stringify(afterFleetClose));

  currentStep = 'setup-routed-job-for-delivery';
  const setup = await page.evaluate(() => {
    const cust = createCustomer({ name: 'Delivery Sched Test Client', contactPerson: 'Reem', tel: '39007788', address: 'Manama' });
    const enq = createEnquiry({ division: 'Furniture', customerId: cust.id, contactPerson: 'Reem', tel: '39007788', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Delivery Sched Test Project', taxPercent: 10, contactPerson: 'Reem' });
    addQuotationItem(qtn.id, { product: 'Dining Table', qty: 1, unit: 'Nos' });
    transferQuotationStage(qtn.id, 'approver', 'Estimator'); approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    return { jobId: job.id };
  });

  currentStep = 'open-delivery-scheduling';
  const dsOpened = await page.evaluate(() => {
    const branch = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === 'delivery-scheduling');
    if (!branch) return { error: 'branch not found' };
    branch.userData.node.launch();
    return { ok: true };
  });
  await page.waitForTimeout(600);
  const dsOpenState = await page.evaluate((jobId) => {
    const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
    const otherWraps = ['sales-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap'];
    const bodyText = document.getElementById('delivery-sched-body')?.textContent || '';
    return { wrapVisible: isVisible('delivery-sched-module-wrap'), anyOtherVisible: otherWraps.some(isVisible), showsJob: bodyText.includes(jobId) };
  }, setup.jobId);
  record('Delivery/Scheduling opens standalone and lists the routed, undelivered job as needing scheduling', !dsOpened.error && dsOpenState.wrapVisible && !dsOpenState.anyOtherVisible && dsOpenState.showsJob ? 'PASS' : 'FAIL', JSON.stringify({ dsOpened, dsOpenState }));
  await shot(page, 'delivery-scheduling-list', 3);

  currentStep = 'schedule-delivery';
  await page.click('button:has-text("Schedule →")');
  await page.fill('#ds-new-date', '2026-08-10');
  await page.fill('#ds-new-driver', 'Ahmed');
  await page.click('button:has-text("Save Schedule")');
  await page.waitForTimeout(300);
  const scheduled = await page.evaluate(() => deliverySchedule.length === 1 ? deliverySchedule[0] : null);
  record('Scheduling a delivery through the real form persists it with status "planned"', scheduled && scheduled.plannedDate === '2026-08-10' && scheduled.driver === 'Ahmed' && scheduled.status === 'planned' ? 'PASS' : 'FAIL', JSON.stringify(scheduled));

  currentStep = 'mark-delivered';
  await page.click('button:has-text("Delivered")');
  await page.waitForTimeout(300);
  const markedDelivered = await page.evaluate(() => deliverySchedule[0].status);
  record('Marking a scheduled delivery "Delivered" updates its status', markedDelivered === 'completed' ? 'PASS' : 'FAIL', JSON.stringify({ markedDelivered }));

  currentStep = 'close-delivery-scheduling';
  await page.click('#delivery-sched-module-wrap button[onclick="closeDeliverySchedModule()"]');
  await page.waitForTimeout(400);
  const afterDSClose = await page.evaluate(() => {
    const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
    return { wrapHidden: !isVisible('delivery-sched-module-wrap'), ecoVisible: !!document.getElementById('scroll') && getComputedStyle(document.getElementById('scroll')).display !== 'none' };
  });
  record('Closing Delivery/Scheduling returns cleanly to the ecosystem', afterDSClose.wrapHidden && afterDSClose.ecoVisible ? 'PASS' : 'FAIL', JSON.stringify(afterDSClose));

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
