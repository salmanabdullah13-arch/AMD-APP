// Verification for the Job Card / Operations routing gap Salman flagged:
// a confirmed job used to be fully operable in the Jobs module the instant
// it was created, completely decoupled from Operations' own routing queue
// — Delivery Note / Material Issue / Material Return / Generate Invoice
// could all happen before Operations had even looked at the job. This
// suite checks: (1) those 4 actions are locked pre-routing and unlock once
// Operations confirms routing, (2) Tasks/Activity Log/Variations stay open
// throughout, (3) Sales' My Jobs gets a Request Purchase shortcut into
// Purchasing's real, existing job-linked PR form.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-job-routing-gate');
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
  console.log('\n=== JOB ROUTING GATE / SALES PURCHASE REQUEST VERIFICATION ===');
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

  currentStep = 'seed-confirmed-job';
  const seed = await page.evaluate(() => {
    salesCurrentUser = 'Salman Abdullah';
    const cust = createCustomer({ name: 'RoutingGate Client', contactPerson: 'Tariq', tel: '39112200', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Tariq', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'RoutingGate Project', taxPercent: 10, contactPerson: 'Tariq' });
    addQuotationItem(q.id, { product: 'Test Cabinet', qty: 1, unit: 'Nos' });
    approveQuotation(q.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(q.id, 'Salman Abdullah');
    return { jobId: job.id, routingConfirmed: job.routingConfirmed };
  });
  record('Freshly confirmed job starts with routingConfirmed=false', seed.routingConfirmed === false ? 'PASS' : 'FAIL', JSON.stringify(seed));

  // ── Pre-routing: production actions locked, Tasks/Variations open ──
  currentStep = 'pre-routing-hub';
  await openNode(page, 'delivery', 'jobs-module-wrap');
  await page.evaluate((jobId) => { openJobHub(jobId); }, seed.jobId);
  await page.waitForTimeout(200);
  await shot(page, 'job-hub-pre-routing');
  const preRoutingState = await page.evaluate(() => {
    const html = document.getElementById('jobs-body').innerHTML;
    return {
      bannerShown: html.includes('Awaiting Operations Routing'),
      deliveryLocked: html.includes('onclick="jobsAlert(\'Locked until Operations routes'),
      newVariationClickable: /onclick="jobsNewVariation\(/.test(html),
      generateInvoiceLocked: html.includes('Generate Invoice') && html.includes('cursor:not-allowed')
    };
  });
  record('Awaiting Operations Routing banner shown pre-routing', preRoutingState.bannerShown ? 'PASS' : 'FAIL', JSON.stringify(preRoutingState));
  record('Delivery Note/Material Issue/Return tiles are locked pre-routing', preRoutingState.deliveryLocked ? 'PASS' : 'FAIL');
  record('Generate Invoice button is locked pre-routing', preRoutingState.generateInvoiceLocked ? 'PASS' : 'FAIL');
  record('New Variation stays clickable pre-routing (does not presuppose production)', preRoutingState.newVariationClickable ? 'PASS' : 'FAIL');

  await page.click('#jobs-body .sales-tile:has-text("Material Issue")');
  await page.waitForTimeout(150);
  const stillOnHub = await page.evaluate(() => jobsView === 'hub');
  record('Clicking a locked tile does not navigate away (just alerts)', stillOnHub ? 'PASS' : 'FAIL');

  await page.click('#jobs-body button:has-text("+ Add Task")');
  await page.waitForTimeout(150);
  await page.fill('#jt-title', 'Confirm delivery window with client');
  await page.selectOption('#jt-assignee', { index: 0 });
  await page.click('#jobs-body button:has-text("Save Task")');
  await page.waitForTimeout(150);
  const taskAddedPreRouting = await page.evaluate((jobId) => getTasksFor('job', jobId).length, seed.jobId);
  record('Tasks can still be added pre-routing', taskAddedPreRouting === 1 ? 'PASS' : 'FAIL');

  // ── Operations routes the job ──
  currentStep = 'operations-routes-job';
  await page.evaluate((jobId) => {
    confirmJobRouting(jobId, {}, 'Operations Manager');
  }, seed.jobId);
  await page.evaluate((jobId) => { openJobHub(jobId); }, seed.jobId);
  await page.waitForTimeout(200);
  await shot(page, 'job-hub-post-routing');
  const postRoutingState = await page.evaluate(() => {
    const html = document.getElementById('jobs-body').innerHTML;
    return {
      bannerGone: !html.includes('Awaiting Operations Routing'),
      deliveryUnlocked: /onclick="openDeliveryNote\(/.test(html),
      generateInvoiceUnlocked: /onclick="jobsGenerateInvoice\(/.test(html)
    };
  });
  record('Awaiting Operations Routing banner gone once routed', postRoutingState.bannerGone ? 'PASS' : 'FAIL', JSON.stringify(postRoutingState));
  record('Delivery Note unlocked once routed', postRoutingState.deliveryUnlocked ? 'PASS' : 'FAIL');
  record('Generate Invoice unlocked once routed', postRoutingState.generateInvoiceUnlocked ? 'PASS' : 'FAIL');

  // ── Sales My Jobs -> Request Purchase hop ──
  currentStep = 'sales-request-purchase';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'sales', 'sales-module-wrap');
  await page.evaluate(() => { salesSetTopView('myjobs'); });
  await page.waitForTimeout(200);
  await shot(page, 'sales-my-jobs-request-purchase-btn');
  const requestPurchaseBtnShown = await page.evaluate(() => document.getElementById('sales-body').innerHTML.includes('Request Purchase'));
  record('My Jobs row shows a Request Purchase button', requestPurchaseBtnShown ? 'PASS' : 'FAIL');

  await page.click('#sales-body button:has-text("Request Purchase")');
  await page.waitForTimeout(300);
  await shot(page, 'purchasing-pr-form-prefilled');
  const prFormState = await page.evaluate((jobId) => ({
    purchWrapVisible: getComputedStyle(document.getElementById('purch-module-wrap')).display !== 'none',
    panelVisible: getComputedStyle(document.getElementById('purch-pr-form')).display !== 'none',
    linkedJobId: prFormDraft ? prFormDraft.linkedJobId : null,
    matchesJob: prFormDraft && prFormDraft.linkedJobId === jobId
  }), seed.jobId);
  record('Request Purchase opens Purchasing\'s real PR form pre-filled with this job', prFormState.purchWrapVisible && prFormState.panelVisible && prFormState.matchesJob ? 'PASS' : 'FAIL', JSON.stringify(prFormState));

  await browser.close();
  printReport();
})();
