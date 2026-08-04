// Verification for the Team Comms + dashboard-enhancements batch (4 Aug
// 2026), built after role-playing the Joinery Production Manager's real
// day: a shared Messages primitive (data.js) + UI (teamcomms.js) usable
// from any module, a generalized "Request Purchase" shortcut, a "Notify
// Storekeeper" shortcut, and (for Joinery/Upholstery/Painting) a real
// queue preview + QC quality/rework trend + My Tasks panel replacing the
// old counts-only dashboards. Also confirms Messages/Request-Purchase
// access was wired into every other module (Operations, Curtain, Sales,
// Estimator, Approver, Accounts, HR, Storekeeper).

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-team-comms-dashboard');
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
  console.log('\n=== TEAM COMMS + DASHBOARD ENHANCEMENTS VERIFICATION ===');
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

  // ── Data-layer primitives ──────────────────────────────
  currentStep = 'data-layer';
  const dataLayer = await page.evaluate(() => {
    const before = messages.length;
    const sent = sendMessage({ from: 'Joinery Production Manager', to: 'Storekeeper', body: 'Need 4x8 ply sheets moved to the cutting bay.' });
    const unreadBefore = getUnreadCountFor('Storekeeper');
    const inbox = getInboxFor('Storekeeper');
    const emptyErr = sendMessage({ from: 'Joinery Production Manager', to: '', body: 'x' });
    return {
      grewByOne: messages.length === before + 1,
      hasId: !!sent.id,
      unreadBefore,
      inInbox: inbox.some(m => m.id === sent.id),
      rejectsNoRecipient: !!emptyErr.error,
      reachablePeopleHasKeyRoles: ['Storekeeper', 'Accounts', 'HR', 'Operations Manager', 'Joinery Production Manager', 'Upholstery Manager', 'Painting Lead / Work Supervisor'].every(p => REACHABLE_PEOPLE.includes(p)),
      operationsPlaceholderExcluded: !REACHABLE_PEOPLE.includes('Operations')
    };
  });
  record('sendMessage() adds to messages[] and returns an id', dataLayer.grewByOne && dataLayer.hasId ? 'PASS' : 'FAIL', JSON.stringify(dataLayer));
  record('getInboxFor() returns the new message for the recipient', dataLayer.inInbox ? 'PASS' : 'FAIL');
  record('sendMessage() rejects an empty recipient', dataLayer.rejectsNoRecipient ? 'PASS' : 'FAIL');
  record('REACHABLE_PEOPLE includes all dept pseudo-identities, excludes the "Operations" placeholder', dataLayer.reachablePeopleHasKeyRoles && dataLayer.operationsPlaceholderExcluded ? 'PASS' : 'FAIL', JSON.stringify(dataLayer));

  // ── Storekeeper: inbox widget shows the unread message, click marks it read ──
  currentStep = 'storekeeper-inbox';
  await openNode(page, 'storekeeper', 'sk-module-wrap');
  await shot(page, 'storekeeper-dashboard');
  const skInboxBefore = await page.evaluate(() => {
    const html = document.getElementById('sk-dashboard-body').innerHTML;
    return { hasPlySheetMsg: html.includes('4x8 ply sheets'), hasUnreadBadge: html.includes('● NEW') };
  });
  record('Storekeeper dashboard shows the Joinery message with an unread badge', skInboxBefore.hasPlySheetMsg && skInboxBefore.hasUnreadBadge ? 'PASS' : 'FAIL', JSON.stringify(skInboxBefore));
  await page.evaluate(() => { const m = getInboxFor('Storekeeper')[0]; if (m) document.querySelector(`[onclick*="markMessageRead('${m.id}')"]`)?.click(); });
  await page.waitForTimeout(200);
  const skInboxAfter = await page.evaluate(() => getInboxFor('Storekeeper')[0]?.read === true);
  record('Clicking the message row marks it read (both DOM handler and data layer)', skInboxAfter ? 'PASS' : 'FAIL');
  await shot(page, 'storekeeper-after-read');

  // ── Compose modal: Sales sends a fresh message to Accounts ──────────
  currentStep = 'compose-modal';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'sales', 'sales-module-wrap');
  await page.evaluate(() => salesCurrentUser = 'Salman Abdullah');
  await page.evaluate(() => renderSalesBody());
  await page.click('#sales-module-wrap [onclick*="openComposeMessage"]');
  await page.waitForSelector('#comms-modal-wrap', { state: 'visible' });
  await page.selectOption('#comms-to', 'Accounts');
  await page.fill('#comms-body', 'Client asked for a payment plan on JOB-TEST — can you advise?');
  await shot(page, 'compose-modal-open');
  await page.click('#comms-modal-inner button.primary');
  await page.waitForTimeout(300);
  const composeResult = await page.evaluate(() => ({
    modalClosed: document.getElementById('comms-modal-wrap').style.display === 'none',
    delivered: getInboxFor('Accounts').some(m => m.body.includes('payment plan on JOB-TEST'))
  }));
  record('Compose modal sends a message and closes', composeResult.modalClosed && composeResult.delivered ? 'PASS' : 'FAIL', JSON.stringify(composeResult));

  // ── Request Purchase shortcut: from Estimator, hops to Purchasing's real PR form ──
  currentStep = 'request-purchase-shortcut';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'estimation', 'estimator-module-wrap');
  await page.click('#estimator-module-wrap [onclick*="requestPurchaseFromModule"]');
  await page.waitForSelector('#purch-module-wrap', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(300);
  const prLanded = await page.evaluate(() => {
    const wrap = document.getElementById('purch-module-wrap');
    return { estimatorHidden: document.getElementById('estimator-module-wrap').style.display === 'none', purchVisible: wrap.style.display !== 'none' };
  });
  record('Request Purchase shortcut closes Estimator and opens Purchasing', prLanded.estimatorHidden && prLanded.purchVisible ? 'PASS' : 'FAIL', JSON.stringify(prLanded));
  await shot(page, 'request-purchase-landed-on-purchasing');

  // ── Joinery: queue preview, quality card, tasks panel ────────────────
  currentStep = 'joinery-dashboard';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  const seed = await page.evaluate(() => {
    salesCurrentUser = 'Salman Abdullah';
    const cust = createCustomer({ name: 'Comms Test Client', contactPerson: 'X', tel: '39001234', address: 'Manama' });
    const enq = createEnquiry({ division: 'Joinery', customerId: cust.id, contactPerson: 'X', tel: cust.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(enq.id, { projectName: 'Comms Test Job', taxPercent: 10, contactPerson: 'X' });
    addQuotationItem(q.id, { product: 'Test Cabinet', qty: 1, unit: 'Nos' });
    const item = q.items[0];
    addBOMMaterial(q.id, item.lineId, { name: 'Board', qty: 1, unit: 'Nos', rate: 200 });
    submitItemBOM(q.id, item.lineId, 'Estimator User');
    approveQuotation(q.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(q.id, 'Salman Abdullah');
    confirmJobRouting(job.id, {}, 'Operations Manager');
    return job.id;
  });
  await openNode(page, 'joinery', 'joinery-module-wrap');
  await shot(page, 'joinery-dashboard-with-queue');
  const joineryDash = await page.evaluate(() => {
    const html = document.getElementById('joinery-body').innerHTML;
    return {
      hasQueuePreview: html.includes("This week's queue") && html.includes('Test Cabinet'),
      hasQualityCard: html.includes('Quality') && html.includes('QC results recorded'),
      hasTasksPanel: html.includes('My Tasks'),
      hasInbox: html.includes('Messages'),
      hasNotifyStorekeeper: html.includes('Notify Storekeeper'),
      hasRequestPurchase: html.includes('Request Purchase')
    };
  });
  record('Joinery dashboard shows a real queue preview with the seeded job', joineryDash.hasQueuePreview ? 'PASS' : 'FAIL', JSON.stringify(joineryDash));
  record('Joinery dashboard shows a Quality card', joineryDash.hasQualityCard ? 'PASS' : 'FAIL');
  record('Joinery dashboard shows a My Tasks panel', joineryDash.hasTasksPanel ? 'PASS' : 'FAIL');
  record('Joinery dashboard shows the Messages inbox + Notify Storekeeper + Request Purchase shortcuts', joineryDash.hasInbox && joineryDash.hasNotifyStorekeeper && joineryDash.hasRequestPurchase ? 'PASS' : 'FAIL');

  // Add a quick task from the dashboard, then complete it
  await page.fill('#joinery-quicktask', 'Call fabric supplier about delayed board delivery');
  await page.click('#joinery-body [onclick*="deptQuickAddTask"]');
  await page.waitForTimeout(200);
  const taskAdded = await page.evaluate(() => document.getElementById('joinery-body').innerHTML.includes('Call fabric supplier'));
  record('Quick-add task from Joinery dashboard appears in My Tasks', taskAdded ? 'PASS' : 'FAIL');
  await shot(page, 'joinery-task-added');
  await page.click('#joinery-body [onclick*="deptCompleteTask"]');
  await page.waitForTimeout(200);
  const taskCompleted = await page.evaluate(() => !document.getElementById('joinery-body').innerHTML.includes('Call fabric supplier'));
  record('Completing the task removes it from the open list', taskCompleted ? 'PASS' : 'FAIL');

  // ── Upholstery + Painting: same pieces present (reuse for Upholstery, standalone rebuild for Painting) ──
  currentStep = 'upholstery-painting-dashboards';
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'upholstery', 'upholstery-module-wrap');
  const uphDash = await page.evaluate(() => {
    const html = document.getElementById('upholstery-body').innerHTML;
    return { hasQueuePreview: html.includes("This week's queue"), hasQuality: html.includes('Quality'), hasTasks: html.includes('My Tasks'), hasInbox: html.includes('Messages') };
  });
  record('Upholstery dashboard has queue preview + quality + tasks + inbox', uphDash.hasQueuePreview && uphDash.hasQuality && uphDash.hasTasks && uphDash.hasInbox ? 'PASS' : 'FAIL', JSON.stringify(uphDash));

  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(200);
  await openNode(page, 'painting', 'painting-module-wrap');
  const paintDash = await page.evaluate(() => {
    const html = document.getElementById('painting-body').innerHTML;
    return { hasQueuePreview: html.includes("This week's queue"), hasQuality: html.includes('Quality'), hasTasks: html.includes('My Tasks'), hasInbox: html.includes('Messages') };
  });
  record('Painting dashboard (standalone) has queue preview + quality + tasks + inbox', paintDash.hasQueuePreview && paintDash.hasQuality && paintDash.hasTasks && paintDash.hasInbox ? 'PASS' : 'FAIL', JSON.stringify(paintDash));
  await shot(page, 'painting-dashboard');

  // ── Sweep: every other module renders its comms banner cleanly, no console errors ──
  currentStep = 'remaining-modules-sweep';
  const sweepTargets = [
    { id: 'operations', wrap: 'p-operations', bodyCheckJs: `document.getElementById('ops-dashboard-body').innerHTML` },
    { id: 'curtain', wrap: 'curt-module-wrap', bodyCheckJs: `document.getElementById('curt-comms').innerHTML` },
    { id: 'approvals', wrap: 'approver-module-wrap', bodyCheckJs: `document.getElementById('approver-body').innerHTML` },
    { id: 'accounts', wrap: 'accounts-module-wrap', bodyCheckJs: `document.getElementById('accounts-body').innerHTML` },
    { id: 'hr', wrap: 'hr-module-wrap', bodyCheckJs: `document.getElementById('hr-body').innerHTML` }
  ];
  for (const t of sweepTargets) {
    await page.evaluate(() => goTo('eco'));
    await page.waitForTimeout(200);
    if (t.id === 'operations') {
      await openNode(page, 'operations', 'p-operations');
    } else {
      await openNode(page, t.id, t.wrap);
    }
    const html = await page.evaluate(new Function(`return ${t.bodyCheckJs};`)).catch(() => '');
    const hasMessages = typeof html === 'string' && html.includes('Messages');
    record(`${t.id}: comms/Messages widget renders`, hasMessages ? 'PASS' : 'FAIL', typeof html === 'string' ? '' : 'body element not found');
  }

  currentStep = 'final';
  await shot(page, 'final-state');

  const critical = consoleErrors.filter(e => !e.text.includes('favicon'));
  record('No unexpected console errors across the whole flow', critical.length === 0 ? 'PASS' : 'FAIL', critical.map(e => e.text).join(' | '));
  record('No uncaught page errors across the whole flow', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.some(r => r.status === 'FAIL') ? 1 : 0);
})().catch(err => {
  console.error('FATAL:', err);
  printReport();
  process.exit(1);
});
