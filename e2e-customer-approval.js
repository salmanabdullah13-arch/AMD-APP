// Verification for the Customer creation/approval workflow, moved from
// Approver to Accounts per Salman's explicit call (customer verification —
// catching duplicate client records, a real past incident — is an Accounts
// responsibility). Confirmed non-blocking: Sales can create Enquiries on an
// unapproved customer right away. Duplicate detection flags on phone OR
// email match, doesn't hard-block creation.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-customer-approval');
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
  console.log('\n=== CUSTOMER APPROVAL WORKFLOW VERIFICATION ===');
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
  page.on('dialog', async d => { await d.accept(d.type() === 'prompt' ? 'Duplicate of an existing client on file.' : undefined); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  currentStep = 'pin-unlock';
  for (const d of ['1', '9', '9', '4']) { await page.click(`.num-btn[onclick="pt('${d}')"]`); await page.waitForTimeout(120); }
  await page.waitForSelector('#app', { state: 'visible' });
  record('PIN unlock', 'PASS');

  currentStep = 'create-first-customer';
  const first = await page.evaluate(() => createCustomer({ name: 'Approval Test Client', contactPerson: 'Yusuf', tel: '39112233', email: 'yusuf@apprtest.bh', address: 'Manama' }));
  record('New customer starts status=pending, no duplicate flagged', first.status === 'pending' && first.possibleDuplicateOf === null ? 'PASS' : 'FAIL', JSON.stringify(first));

  currentStep = 'sales-not-blocked';
  const enqResult = await page.evaluate((custId) => {
    const enq = createEnquiry({ division: 'Joinery', customerId: custId, contactPerson: 'Yusuf', tel: '39112233', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    return enq && !enq.error;
  }, first.id);
  record('Sales can create an Enquiry against a pending (unapproved) customer immediately', enqResult ? 'PASS' : 'FAIL');

  currentStep = 'duplicate-by-phone';
  const dupByPhone = await page.evaluate(() => createCustomer({ name: 'Approval Test Client — Branch 2', contactPerson: 'Yusuf B', tel: '39112233', email: 'different@x.bh', address: 'Riffa' }));
  record('Duplicate phone number is FLAGGED (possibleDuplicateOf set), not blocked', dupByPhone && !dupByPhone.error && dupByPhone.possibleDuplicateOf === first.id ? 'PASS' : 'FAIL', JSON.stringify(dupByPhone));

  currentStep = 'duplicate-by-email';
  const dupByEmail = await page.evaluate(() => createCustomer({ name: 'Totally Different Name', contactPerson: 'Someone Else', tel: '39998877', email: 'YUSUF@APPRTEST.BH', address: 'Isa Town' }));
  record('Duplicate EMAIL (case-insensitive) is flagged even with a different phone/name', dupByEmail && !dupByEmail.error && dupByEmail.possibleDuplicateOf === first.id ? 'PASS' : 'FAIL', JSON.stringify(dupByEmail));

  currentStep = 'no-false-positive';
  const noDup = await page.evaluate(() => createCustomer({ name: 'Unrelated Client', contactPerson: 'Ahmed', tel: '39554433', email: 'ahmed@unrelated.bh', address: 'Muharraq' }));
  record('A genuinely new customer (no phone/email match) is NOT flagged', noDup.possibleDuplicateOf === null ? 'PASS' : 'FAIL');

  currentStep = 'approver-no-longer-has-customer-queue';
  await openNode(page, 'approvals', 'approver-module-wrap');
  await page.waitForTimeout(200);
  await shot(page, 'approver-dashboard-no-customer-tile');
  const noCustomerTileInApprover = await page.evaluate(() => !document.getElementById('approver-body').innerHTML.includes('New Customers'));
  record('Approver dashboard no longer shows a "New Customers" tile/queue', noCustomerTileInApprover ? 'PASS' : 'FAIL');
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);

  currentStep = 'accounts-pending-queue';
  await openNode(page, 'accounts', 'accounts-module-wrap');
  await page.evaluate(() => { accountsSetView('pending-customers'); });
  await page.waitForTimeout(200);
  await shot(page, 'accounts-pending-customers-queue');
  const queueHtml = await page.evaluate(() => document.getElementById('accounts-body').innerHTML);
  record('Accounts "Pending Customers" tab lists the pending customers', queueHtml.includes('Approval Test Client') && queueHtml.includes('Unrelated Client') ? 'PASS' : 'FAIL');
  record('Duplicate warning shown with the matched existing customer\'s details side by side', queueHtml.includes('Possible duplicate') && queueHtml.includes(first.id) ? 'PASS' : 'FAIL');

  currentStep = 'approve-from-accounts';
  await page.click(`button[onclick="accountsApproveCustomer('${noDup.id}')"]`);
  await page.waitForTimeout(150);
  await shot(page, 'after-approve');
  const approvedState = await page.evaluate((custId) => customers.find(c => c.id === custId), noDup.id);
  record('Approving from Accounts sets status=approved with approvedBy=Accounts', approvedState.status === 'approved' && approvedState.approvedBy === 'Accounts' ? 'PASS' : 'FAIL', JSON.stringify(approvedState));

  currentStep = 'reject-from-accounts';
  await page.click(`button[onclick="accountsRejectCustomer('${dupByEmail.id}')"]`);
  await page.waitForTimeout(150);
  await shot(page, 'after-reject');
  const rejectedState = await page.evaluate((custId) => customers.find(c => c.id === custId), dupByEmail.id);
  record('Rejecting from Accounts sets status=rejected with a rejection comment recorded', rejectedState.status === 'rejected' && !!rejectedState.rejectionComment ? 'PASS' : 'FAIL', JSON.stringify(rejectedState));

  await browser.close();
  printReport();
})();
