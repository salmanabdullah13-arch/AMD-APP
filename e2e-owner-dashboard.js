// Verification for the new Owner Dashboard module (4 Aug 2026) — a
// read-only, cross-department view reusing every module's own existing
// KPI function, plus the cross-module activityLog[] (the same session's
// Tasks/Activity Log retrofit) for a company-wide recent-activity feed.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-owner-dashboard');
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
  console.log('\n=== OWNER DASHBOARD VERIFICATION ===');
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

  currentStep = 'seed-activity';
  await page.evaluate(() => {
    salesCurrentUser = 'Salman Abdullah';
    const cust = createCustomer({ name: 'OwnerDash Client', contactPerson: 'Nora', tel: '39990022', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'Nora', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
  });

  // Dashboard Analytics rollout (5 Aug 2026), Phase 2 — seed one real,
  // fully-delivered job so the new analytics section (monthly revenue,
  // division share, pipeline funnel, top clients) has something real to
  // render instead of just its own empty state.
  await page.evaluate(() => {
    const cust = createCustomer({ name: 'OwnerDash Analytics Client', contactPerson: 'Salim', tel: '39990033', address: 'Manama' });
    const enq = createEnquiry({ division: 'Curtain & Blinds', customerId: cust.id, contactPerson: 'Salim', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'OwnerDash Analytics Project', taxPercent: 10, contactPerson: 'Salim' });
    const item = addQuotationItem(qtn.id, { product: 'Living Room Curtains', qty: 1, unit: 'Nos' });
    item.rate = 2500; item.amount = 2500; item.netAmount = 2500;
    transferQuotationStage(qtn.id, 'approver', 'Estimator'); approveQuotation(qtn.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
    job.amount = 2500;
    confirmJobRouting(job.id, {}, 'Operations Manager');
    job.items.forEach(it => { it.deliveredQty = it.qty; });
  });

  currentStep = 'open-owner-dashboard';
  await openNode(page, 'owner', 'owner-module-wrap');
  await shot(page, 'owner-dashboard');

  const state = await page.evaluate(() => {
    const html = document.getElementById('owner-body').innerHTML;
    return {
      hasCompanySnapshot: html.includes('Company Snapshot'),
      hasSalesPipeline: html.includes('Sales Pipeline'),
      hasOperations: html.includes('Operations') && html.includes('Production'),
      hasPurchasing: html.includes('Purchasing'),
      hasHR: html.includes('HR &amp; Compliance') || html.includes('HR & Compliance'),
      hasRecentActivity: html.includes('Recent Activity'),
      mentionsNewEnquiry: html.includes('created for OwnerDash Client') || html.includes('OwnerDash Client')
    };
  });
  record('Owner Dashboard renders Company Snapshot section', state.hasCompanySnapshot ? 'PASS' : 'FAIL');
  record('Owner Dashboard renders Sales Pipeline section', state.hasSalesPipeline ? 'PASS' : 'FAIL');
  record('Owner Dashboard renders Operations & Production section', state.hasOperations ? 'PASS' : 'FAIL');
  record('Owner Dashboard renders Purchasing & Inventory section', state.hasPurchasing ? 'PASS' : 'FAIL');
  record('Owner Dashboard renders HR & Compliance section', state.hasHR ? 'PASS' : 'FAIL');
  record('Owner Dashboard renders a Recent Activity feed', state.hasRecentActivity ? 'PASS' : 'FAIL');
  record('Recent Activity feed shows the just-created Enquiry (real cross-module activityLog data, not fake)', state.mentionsNewEnquiry ? 'PASS' : 'FAIL', JSON.stringify(state));

  currentStep = 'analytics-charts';
  const charts = await page.evaluate(() => {
    const html = document.getElementById('owner-body').innerHTML;
    return {
      hasMonthlyRevenueSection: html.includes('Monthly Revenue by Division'),
      hasMonthlyRevenueSvg: html.includes('cw-chart'),
      hasDivisionShareSection: html.includes('Division Share'),
      hasCurtainInDivisionShare: html.includes('Curtain &amp; Blinds') || html.includes('Curtain & Blinds'),
      hasPipelineFunnelSection: html.includes('Pipeline Funnel'),
      hasTopClientsSection: html.includes('Top Clients'),
      mentionsAnalyticsClient: html.includes('OwnerDash Analytics Client'),
      hasDeptQualitySection: html.includes('Department Quality'),
      ringCardCount: (html.match(/ring-card/g) || []).length
    };
  });
  record('Owner Dashboard renders the new Monthly Revenue by Division chart (real SVG, not the empty state, since a real job was just seeded)', charts.hasMonthlyRevenueSection && charts.hasMonthlyRevenueSvg ? 'PASS' : 'FAIL', JSON.stringify(charts));
  record('Division Share section shows the seeded Curtain & Blinds division', charts.hasDivisionShareSection && charts.hasCurtainInDivisionShare ? 'PASS' : 'FAIL');
  record('Pipeline Funnel section renders', charts.hasPipelineFunnelSection ? 'PASS' : 'FAIL');
  record('Top Clients section renders and shows the seeded analytics client by name', charts.hasTopClientsSection && charts.mentionsAnalyticsClient ? 'PASS' : 'FAIL');
  record('Department Quality section renders one ring gauge per department (Joinery/Upholstery/Painting/Curtain)', charts.hasDeptQualitySection && charts.ringCardCount === 4 ? 'PASS' : 'FAIL', JSON.stringify(charts));

  record('No console/page errors on Owner Dashboard load', consoleErrors.length === 0 && pageErrors.length === 0 ? 'PASS' : 'FAIL', `console=${consoleErrors.length} page=${pageErrors.length}`);

  currentStep = 'quick-link-navigation';
  await page.click('#owner-body span:has-text("Open Sales")');
  await page.waitForTimeout(300);
  const salesOpened = await page.evaluate(() => getComputedStyle(document.getElementById('sales-module-wrap')).display !== 'none' && getComputedStyle(document.getElementById('owner-module-wrap')).display === 'none');
  record('Quick link "Open Sales" closes Owner Dashboard and opens the real Sales module', salesOpened ? 'PASS' : 'FAIL');

  // Nav overhaul (5 Aug 2026) — Owner stays the landing screen with Admin
  // one tap away (Salman's call), rather than switching the owner account's
  // own user_type to 'admin'. Verified via a real click on the new link.
  currentStep = 'admin-quick-link';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'owner', 'owner-module-wrap');
  await page.click('#owner-body span:has-text("Admin Dashboard")');
  await page.waitForSelector('#admin-module-wrap', { state: 'visible', timeout: 5000 });
  const adminOpened = await page.evaluate(() => ({
    adminVisible: getComputedStyle(document.getElementById('admin-module-wrap')).display !== 'none',
    ownerHidden: getComputedStyle(document.getElementById('owner-module-wrap')).display === 'none'
  }));
  record('Quick link "Admin Dashboard" opens the real Admin module from Owner', adminOpened.adminVisible && adminOpened.ownerHidden ? 'PASS' : 'FAIL', JSON.stringify(adminOpened));

  currentStep = 'mutual-exclusivity';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'accounts', 'accounts-module-wrap');
  await page.waitForTimeout(150);
  await openNode(page, 'owner', 'owner-module-wrap');
  const accountsHiddenNow = await page.evaluate(() => getComputedStyle(document.getElementById('accounts-module-wrap')).display === 'none');
  record('Opening Owner Dashboard hides a previously-open module (mutual exclusivity)', accountsHiddenNow ? 'PASS' : 'FAIL');

  currentStep = 'back-button';
  await page.click('#owner-module-wrap button:has-text("×")');
  await page.waitForTimeout(200);
  const closedProperly = await page.evaluate(() => getComputedStyle(document.getElementById('owner-module-wrap')).display === 'none' && document.getElementById('scroll').style.display !== 'none');
  record('Close (×) button returns to the ecosystem correctly', closedProperly ? 'PASS' : 'FAIL');

  await browser.close();
  printReport();
})();
