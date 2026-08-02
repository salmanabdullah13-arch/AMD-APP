// Deep E2E test of the AMD-APP Sales lifecycle: Enquiry -> Quotation ->
// Estimator -> Approver -> Job Card -> Tax Invoice -> Proforma -> Receipt ->
// Credit Note -> Related Records check. Screenshots after every major step;
// captures console/page errors throughout. Ad hoc investigative script, not
// part of the app's own test suite.
//
// Notes from earlier debugging:
// - The ecosystem hub SVG only lays out sanely on a mobile-sized viewport
//   (app is iPad/iPhone-first per CLAUDE.md) — desktop viewport pushed
//   #node-sales etc. off-screen.
// - A tap/click on a BUILT ecosystem node launches its module DIRECTLY
//   (index.html's handleNodeTap() sets window._ecoDirectLaunch and calls
//   launch() immediately) — it does NOT go through shell.js's showPanel()
//   info panel + "Open X Module ->" button at all for mouse/touch taps.
//   That panel path appears to be effectively dead/unreachable code for
//   built nodes now. So: click node -> wait directly for the module wrap.
// - Selectors must be scoped to the active module's own body container
//   (#sales-body, #estimator-body, etc.) — generic `button:has-text(...)`
//   across the whole page can match a same-labeled but hidden button in a
//   DIFFERENT module's DOM (e.g. Curtain's hidden "Submit for budget
//   approval") and Playwright will wait forever for that invisible one.
// - The app ships with pre-seeded demo data (1 enquiry, 1 open quotation,
//   etc. visible even on a fresh unlock) — so identifying "our" new record
//   by regexing rendered text is unreliable. Read the actual data arrays
//   via page.evaluate() and diff against a baseline captured before the
//   action instead.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.join(__dirname, 'e2e-shots');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
let shotN = 0;

function record(step, status, detail) {
  results.push({ step, status, detail: detail || '' });
  console.log(`[${status}] ${step}${detail ? ' — ' + detail : ''}`);
}
async function shot(page, label) {
  shotN++;
  const fname = `${String(shotN).padStart(2, '0')}-${label}.png`;
  try { await page.screenshot({ path: path.join(SHOT_DIR, fname), fullPage: true }); }
  catch (e) { console.log('screenshot failed for', label, e.message); }
  return fname;
}
async function openNode(page, nodeId, wrapId, label) {
  currentStep = `open-${nodeId}`;
  await page.click(`#node-${nodeId}`);
  await page.waitForSelector(`#${wrapId}`, { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400);
  await shot(page, `${label}-opened`);
}
async function closeModule(page, wrapId) {
  await page.click(`#${wrapId} button:has-text("×")`);
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { console.log('DIALOG:', d.message()); await d.accept(); });

  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  // ── Step 0: PIN unlock ──
  currentStep = 'pin-unlock';
  try {
    for (const digit of ['1', '9', '9', '4']) {
      await page.click(`.num-btn[onclick="pt('${digit}')"]`);
      await page.waitForTimeout(150);
    }
    await page.waitForSelector('#app', { state: 'visible', timeout: 3000 });
    await shot(page, 'pin-unlocked');
    record('PIN unlock', 'PASS');
  } catch (e) {
    record('PIN unlock', 'FAIL', e.message);
    await shot(page, 'pin-unlock-FAILED');
    await browser.close(); printReport(); return;
  }

  // ── Step 1: Launch Sales via ecosystem hub tap ──
  currentStep = 'launch-sales';
  try {
    await openNode(page, 'sales', 'sales-module-wrap', 'sales');
    record('Ecosystem hub tap -> launch Sales module', 'PASS');
  } catch (e) {
    record('Ecosystem hub tap -> launch Sales module', 'FAIL', e.message);
    await shot(page, 'launch-sales-FAILED');
  }

  // ── Step 2a: Create a real Customer first ──
  // canConvertToQuotation() (data.js) requires enquiry.customerId to be set —
  // an enquiry against a bare prospect name (no linked Customer) can never
  // be converted, matching CLAUDE.md's documented "convert only from a real
  // Customer" rule. So the Enquiry must be linked to a real Customer for the
  // rest of this lifecycle to be reachable at all.
  currentStep = 'create-customer';
  let customerId = null;
  try {
    const beforeC = await page.evaluate(() => customers.map(c => c.id));
    await page.click('#sales-body button:has-text("+ Create Enquiry")');
    await page.waitForTimeout(200);
    await page.click('#sales-body button:has-text("+ New Customer")');
    await page.waitForTimeout(200);
    await shot(page, 'customer-create-form');
    await page.fill('#sales-body .sales-field:has(label:text("Name *")) input', 'Playwright Test Client');
    await page.fill('#sales-body .sales-field:has(label:text("Contact Person *")) input', 'Ahmed Test');
    await page.fill('#sales-body .sales-field:has(label:text("Telephone *")) input', '33445566');
    await page.fill('#sales-body .sales-field:has(label:text("Address *")) textarea', 'Building 123, Road 456, Manama');
    await shot(page, 'customer-form-filled');
    await page.click('#sales-body button:has-text("Save and continue")');
    await page.waitForTimeout(300);
    const afterC = await page.evaluate(() => customers.map(c => c.id));
    customerId = afterC.filter(id => !beforeC.includes(id))[0] || null;
    await shot(page, 'customer-created-return-to-enquiry');
    record('Create Customer', customerId ? 'PASS' : 'FAIL', customerId ? `id=${customerId}` : 'No new entry in customers[] after Save and continue');
  } catch (e) {
    record('Create Customer', 'FAIL', e.message);
    await shot(page, 'create-customer-FAILED');
  }

  // ── Step 2b: Create Enquiry (linked to that Customer) ──
  currentStep = 'create-enquiry';
  let enquiryId = null;
  try {
    const before = await page.evaluate(() => enquiries.map(e => e.id));
    // Should now be back on the Enquiry Create form with customerId prefilled
    // (saveCustomerCreate()'s returnTo='enq-create' path, sales.js)
    if (customerId) {
      await page.selectOption('#sales-body .sales-field:has(label:text("Select Customer")) select', customerId).catch(() => {});
    }
    await page.fill('#sales-body .sales-field:has(label:text("Contact Person")) input', 'Ahmed Test');
    await page.fill('#sales-body .sales-field:has(label:text("Tel")) input', '33445566');
    await page.fill('#sales-body .sales-field:has(label:text("Email")) input', 'test@example.com');
    await page.fill('#sales-body .sales-field:has(label:text("Requirements")) textarea', 'Living room curtains, 3 windows');
    await shot(page, 'enquiry-form-filled');
    await page.click('#sales-body button:has-text("Submit")');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => enquiries.map(e => e.id));
    const newIds = after.filter(id => !before.includes(id));
    enquiryId = newIds[0] || null;
    await shot(page, 'enquiry-created-list');
    const linkedOk = enquiryId ? await page.evaluate(id => !!enquiries.find(e => e.id === id)?.customerId, enquiryId) : false;
    record('Create Enquiry', enquiryId ? 'PASS' : 'FAIL', enquiryId ? `id=${enquiryId}, linkedToCustomer=${linkedOk}` : 'No new enquiry appeared in enquiries[] after Submit');
  } catch (e) {
    record('Create Enquiry', 'FAIL', e.message);
    await shot(page, 'create-enquiry-FAILED');
  }

  // ── Step 3: Convert Enquiry to Quotation (3-step wizard) ──
  currentStep = 'convert-to-quotation';
  let quotationId = null;
  try {
    if (!enquiryId) throw new Error('No enquiryId from previous step — cannot locate this enquiry\'s Convert button reliably');
    await page.click(`#sales-body .sales-card:has-text("${enquiryId}") button:has-text("Convert Quotation")`);
    await page.waitForTimeout(200);
    await shot(page, 'wizard-step1');
    const beforeQ = await page.evaluate(() => quotations.map(q => q.id));
    await page.fill('#sales-body .sales-field:has(label:text("Project Name")) input', 'Playwright Villa Project');
    await page.click('#sales-body button:has-text("Save & Proceed")');
    await page.waitForTimeout(300);
    const afterQ = await page.evaluate(() => quotations.map(q => q.id));
    quotationId = afterQ.filter(id => !beforeQ.includes(id))[0] || null;
    await shot(page, 'wizard-step2-entered');
    record('Convert to Quotation (step 1)', quotationId ? 'PASS' : 'FAIL', quotationId ? `id=${quotationId}` : 'No new quotation appeared after Save & Proceed');

    // Step 2: add a line item with a direct rate (withEstimation left unchecked)
    await page.fill('#sales-body #it-product', 'Curtain Fabric - Blackout');
    await page.fill('#sales-body #it-qty', '3');
    await page.fill('#sales-body #it-rate', '25');
    await page.click('#sales-body button:has-text("Add Item")');
    await page.waitForTimeout(200);
    await shot(page, 'wizard-step2-item-added');
    const itemAdded = quotationId ? await page.evaluate(qid => {
      const q = quotations.find(x => x.id === qid);
      return q ? q.items.some(it => it.product === 'Curtain Fabric - Blackout') : false;
    }, quotationId) : false;
    record('Add quotation line item', itemAdded ? 'PASS' : 'FAIL', itemAdded ? '' : 'Item not present in quotation.items[] after Add Item');
    await page.click('#sales-body button:has-text("Save & Proceed")');
    await page.waitForTimeout(200);
    await shot(page, 'wizard-step3');
    await page.click('#sales-body button:has-text("Update Quotation")');
    await page.waitForTimeout(300);
    await shot(page, 'quotation-hub-after-finalise');
    record('Finalise Quotation (step 3)', 'PASS');
  } catch (e) {
    record('Convert to Quotation / wizard', 'FAIL', e.message);
    await shot(page, 'convert-quotation-FAILED');
  }

  // ── Step 4: Transfer to Estimator ──
  currentStep = 'transfer-to-estimator';
  try {
    if (!quotationId) throw new Error('No quotationId — skipping');
    await page.click('#sales-body button:has-text("Transfer to Estimator")');
    await page.waitForTimeout(300);
    await shot(page, 'after-transfer-to-estimator');
    const stage = await page.evaluate(qid => quotations.find(q => q.id === qid)?.stage, quotationId);
    record('Transfer to Estimator', stage === 'estimator' ? 'PASS' : 'FAIL', `quotation.stage=${stage}`);
  } catch (e) {
    record('Transfer to Estimator', 'FAIL', e.message);
    await shot(page, 'transfer-estimator-FAILED');
  }

  // ── Step 5: Estimator picks & transfers to Approver ──
  currentStep = 'estimator-flow';
  try {
    await closeModule(page, 'sales-module-wrap');
    await openNode(page, 'estimation', 'estimator-module-wrap', 'estimator');
    // "Pending to Pick" list only renders after expanding that KPI tile
    // (estimatorToggleTile('pending') toggles estimatorDashExpanded).
    await page.click('#estimator-body .sales-kpi-tile:has-text("Pending to Pick")');
    await page.waitForTimeout(200);
    await shot(page, 'estimator-pending-expanded');

    // IMPORTANT: seed/demo data ships a second quotation also sitting in
    // "Pending to Pick" (AMD-15350-0) alongside ours. A naive
    // `div:has-text(id) button:has-text('Pick')` selector matches the whole
    // #estimator-body wrapper too (since our id appears SOMEWHERE in its
    // subtree), returning EVERY Pick button on the page — Playwright then
    // clicked the first one in DOM order, which picked the WRONG (seeded)
    // quotation. Scope to the specific flex row via its unique inline style
    // instead, and filter that row by our id.
    const pickBtn = page.locator('#estimator-body div[style*="justify-content:space-between"]')
      .filter({ hasText: quotationId }).locator('button:has-text("Pick")');
    if (await pickBtn.count() === 0) {
      record('Estimator: quotation appears Pending to Pick', 'FAIL', 'No Pick button found for our quotation on Estimator dashboard');
    } else {
      await pickBtn.first().click();
      await page.waitForTimeout(300);
      record('Estimator: Pick quotation', 'PASS');
      // estimatorPick() (estimator.js) re-renders the dashboard, it does
      // NOT navigate into the quote hub automatically — have to go via
      // "My Actions" -> click the row, same as a real user would.
      await page.click('#estimator-body .sales-kpi-tile:has-text("My Actions")');
      await page.waitForTimeout(200);
      await page.locator('#estimator-body div[style*="cursor:pointer"]').filter({ hasText: quotationId }).first().click();
      await page.waitForTimeout(300);
      await shot(page, 'estimator-quote-hub');
      const transferBtn = page.locator('#estimator-body button:has-text("Transfer to Approver")');
      if (await transferBtn.count() === 0) {
        record('Estimator: Transfer to Approver button present', 'FAIL', 'Button not found in Estimator quote hub');
      } else {
        await transferBtn.click();
        await page.waitForTimeout(300);
        await shot(page, 'estimator-after-transfer');
        const stage = await page.evaluate(qid => quotations.find(q => q.id === qid)?.stage, quotationId);
        record('Estimator: Transfer to Approver', stage === 'approver' ? 'PASS' : 'FAIL', `quotation.stage=${stage}`);
      }
    }
  } catch (e) {
    record('Estimator flow', 'FAIL', e.message);
    await shot(page, 'estimator-flow-FAILED');
  }

  // ── Step 6: Approver picks & approves ──
  currentStep = 'approver-flow';
  try {
    await closeModule(page, 'estimator-module-wrap');
    await openNode(page, 'approvals', 'approver-module-wrap', 'approver');
    // Same expand-on-click pattern as Estimator's dashboard.
    await page.click('#approver-body .sales-kpi-tile:has-text("Pending to Pick")');
    await page.waitForTimeout(200);
    await shot(page, 'approver-pending-expanded');

    // Same row-scoping fix as Estimator's Pick button (see comment above).
    const pickBtn = page.locator('#approver-body div[style*="justify-content:space-between"]')
      .filter({ hasText: quotationId }).locator('button:has-text("Pick")');
    if (await pickBtn.count() === 0) {
      record('Approver: quotation appears Pending to Pick', 'FAIL', 'No Pick button found for our quotation on Approver dashboard');
    } else {
      await pickBtn.first().click();
      await page.waitForTimeout(300);
      record('Approver: Pick quotation', 'PASS');
      // Same pattern as Estimator — approverPick() just re-renders the
      // dashboard, doesn't navigate into the review screen. Go via "For
      // Approval" -> click the row (openApproverReview), like a real user.
      await page.click('#approver-body .sales-kpi-tile:has-text("For Approval")');
      await page.waitForTimeout(200);
      await page.locator('#approver-body div[style*="cursor:pointer"]').filter({ hasText: quotationId }).first().click();
      await page.waitForTimeout(300);
      await shot(page, 'approver-quote-hub');
      const approveBtn = page.locator('#approver-body button:has-text("Approve Quote")');
      if (await approveBtn.count() === 0) {
        record('Approver: Approve Quote button present', 'FAIL', 'Button not found in Approver quote hub');
      } else {
        await approveBtn.click();
        await page.waitForTimeout(300);
        await shot(page, 'approver-after-approve');
        const q = await page.evaluate(qid => { const x = quotations.find(q => q.id === qid); return x ? { stage: x.stage, lifecycleStatus: x.lifecycleStatus } : null; }, quotationId);
        const ok = q && q.stage === 'sales' && q.lifecycleStatus === 'open';
        record('Approver: Approve Quote', ok ? 'PASS' : 'FAIL', `quotation=${JSON.stringify(q)}`);
      }
    }
  } catch (e) {
    record('Approver flow', 'FAIL', e.message);
    await shot(page, 'approver-flow-FAILED');
  }

  // ── Step 7: Sales — Confirm Quote -> creates Job Card ──
  currentStep = 'confirm-quote';
  let jobId = null;
  try {
    await closeModule(page, 'approver-module-wrap');
    await openNode(page, 'sales', 'sales-module-wrap', 'sales');
    await page.click('#sales-body .sales-toptab:has-text("Quotation")');
    await page.waitForTimeout(200);
    await page.click(`#sales-body .sales-card:has-text("${quotationId}")`);
    await page.waitForTimeout(300);
    await shot(page, 'sales-quotation-hub-before-confirm');
    const confirmBtn = page.locator('#sales-body button:has-text("Confirm Quote")');
    if (await confirmBtn.count() === 0) {
      record('Sales: Confirm Quote button present', 'FAIL', 'Button not found — lifecycleStatus may not be "open" as expected');
    } else {
      const beforeJobs = await page.evaluate(() => jobCards.map(j => j.id));
      await confirmBtn.click();
      await page.waitForTimeout(300);
      await shot(page, 'sales-after-confirm-quote');
      const afterJobs = await page.evaluate(() => jobCards.map(j => j.id));
      jobId = afterJobs.filter(id => !beforeJobs.includes(id))[0] || null;
      record('Sales: Confirm Quote -> Job Card created', jobId ? 'PASS' : 'FAIL', jobId ? `jobId=${jobId}` : 'No new entry in jobCards[] after Confirm Quote');
    }
  } catch (e) {
    record('Confirm Quote flow', 'FAIL', e.message);
    await shot(page, 'confirm-quote-FAILED');
  }

  // ── Step 8: Open Job Card, generate Tax Invoice ──
  currentStep = 'job-card-invoice';
  let invoiceId = null;
  try {
    if (!jobId) throw new Error('No jobId — skipping');
    await closeModule(page, 'sales-module-wrap');
    await openNode(page, 'delivery', 'jobs-module-wrap', 'jobs');
    await page.click(`#jobs-body .sales-card:has-text("${jobId}")`);
    await page.waitForTimeout(300);
    await shot(page, 'job-card-hub');
    const jobHubText = await page.textContent('#jobs-body');
    record('Open Job Card hub', jobHubText.includes('Playwright Villa Project') ? 'PASS' : 'FAIL', jobHubText.includes('Playwright Villa Project') ? '' : 'Job hub missing expected project name');

    const genInvoiceBtn = page.locator('#jobs-body button:has-text("Generate Invoice")');
    if (await genInvoiceBtn.count() === 0) {
      record('Generate Invoice button present', 'FAIL', 'Not found on Job Card hub');
    } else {
      const beforeInv = await page.evaluate(() => taxInvoices.map(i => i.id));
      await genInvoiceBtn.click();
      await page.waitForTimeout(300);
      await shot(page, 'job-card-after-generate-invoice');
      const afterInv = await page.evaluate(() => taxInvoices.map(i => i.id));
      invoiceId = afterInv.filter(id => !beforeInv.includes(id))[0] || null;
      record('Generate Tax Invoice', invoiceId ? 'PASS' : 'FAIL', invoiceId ? `invoiceId=${invoiceId}` : 'No new entry in taxInvoices[] after Generate Invoice');
    }
  } catch (e) {
    record('Job Card / Generate Invoice', 'FAIL', e.message);
    await shot(page, 'job-card-invoice-FAILED');
  }

  // ── Step 9: Generate Proforma ──
  currentStep = 'generate-proforma';
  let proformaId = null;
  try {
    // jobsGenerateInvoice() navigates jobsView to the Tax Invoice document
    // view, away from the hub (screenshot confirmed: full invoice layout,
    // only a "‹ Back to Job Card" link, no tile row) — go back first.
    await page.click('#jobs-body span:has-text("Back to Job Card")');
    await page.waitForTimeout(300);
    await shot(page, 'back-to-job-hub-after-invoice');
    const proformaTile = page.locator('#jobs-body .sales-tile:has-text("Proforma")');
    if (await proformaTile.count() === 0) {
      record('Proforma tile present', 'FAIL', 'Not found on Job Card hub');
    } else {
      const beforeP = await page.evaluate(() => proformas.map(p => p.id));
      await proformaTile.click();
      await page.waitForTimeout(300);
      await shot(page, 'after-generate-proforma');
      const afterP = await page.evaluate(() => proformas.map(p => p.id));
      proformaId = afterP.filter(id => !beforeP.includes(id))[0] || null;
      record('Generate Proforma', proformaId ? 'PASS' : 'FAIL', proformaId ? `proformaId=${proformaId}` : 'No new entry in proformas[] after tile click');
    }
  } catch (e) {
    record('Generate Proforma', 'FAIL', e.message);
    await shot(page, 'generate-proforma-FAILED');
  }

  // ── Step 10: Sales Receipt (partial payment) ──
  currentStep = 'sales-receipt';
  let receiptId = null;
  try {
    await closeModule(page, 'jobs-module-wrap');
    await openNode(page, 'sales', 'sales-module-wrap', 'sales');

    await page.click('#sales-body .sales-toptab:has-text("Proforma")');
    await page.waitForTimeout(200);
    const proformaListText = await page.textContent('#sales-body');
    const proformaOk = proformaId ? proformaListText.includes(proformaId) : false;
    record('Proforma list shows generated record', proformaOk ? 'PASS' : 'FAIL', proformaOk ? '' : 'Proforma id not visible in Sales > Proforma list');
    await shot(page, 'proforma-list');

    await page.click('#sales-body .sales-toptab:has-text("Receipt")');
    await page.waitForTimeout(200);
    await page.click('#sales-body button:has-text("+ New Receipt")');
    await page.waitForTimeout(200);
    const sel = page.locator('#sales-body select').first();
    const options = await sel.locator('option').allTextContents();
    const idx = options.findIndex(o => o.includes('Playwright Test Client'));
    if (idx > 0) await sel.selectOption({ index: idx });
    await page.waitForTimeout(300);
    await shot(page, 'receipt-create-client-selected');

    const allocText = await page.textContent('#sales-body');
    const allocOk = !allocText.includes('No Invoice List Available');
    record('Receipt: invoice allocation table populates', allocOk ? 'PASS' : 'FAIL', allocOk ? '' : 'Shows "No Invoice List Available..!" for a client with a real open invoice — documented bug-fix may have regressed');

    const cashCheckbox = page.locator('#sales-body .sales-field:has-text("Cash") input[type=checkbox]').first();
    if (await cashCheckbox.count() > 0) await cashCheckbox.check();
    await page.waitForTimeout(150);
    const cashAmountInput = page.locator('#sales-body .sales-field:has-text("Cash") input[type=number]').first();
    if (await cashAmountInput.count() > 0) await cashAmountInput.fill('30');
    await page.fill('#sales-body #rc-amount', '30');
    const payingInput = page.locator('#sales-body table.sales-items input[type=number]').first();
    if (await payingInput.count() > 0) await payingInput.fill('30');
    await shot(page, 'receipt-form-filled');

    const beforeR = await page.evaluate(() => salesReceipts.map(r => r.id));
    await page.click('#sales-body button:has-text("Create Receipt")');
    await page.waitForTimeout(300);
    await shot(page, 'after-create-receipt');
    const afterR = await page.evaluate(() => salesReceipts.map(r => r.id));
    receiptId = afterR.filter(id => !beforeR.includes(id))[0] || null;
    record('Create Sales Receipt', receiptId ? 'PASS' : 'FAIL', receiptId ? `receiptId=${receiptId}` : 'No new entry in salesReceipts[] after Create Receipt');

    if (receiptId && invoiceId) {
      const inv = await page.evaluate(id => { const i = taxInvoices.find(x => x.id === id); return i ? { paidAmount: i.paidAmount, netTotal: i.totals.netTotal } : null; }, invoiceId);
      const netsOff = inv && Math.abs((inv.paidAmount || 0) - 30) < 0.001;
      record('Receipt correctly nets off invoice.paidAmount', netsOff ? 'PASS' : 'FAIL', `invoice=${JSON.stringify(inv)}`);
    }
  } catch (e) {
    record('Sales Receipt flow', 'FAIL', e.message);
    await shot(page, 'sales-receipt-FAILED');
  }

  // ── Step 11: Sales Credit Note ──
  currentStep = 'sales-credit-note';
  let creditNoteId = null;
  try {
    await page.click('#sales-body .sales-toptab:has-text("Credit Note")');
    await page.waitForTimeout(200);
    await page.click('#sales-body button:has-text("+ New Credit Note")');
    await page.waitForTimeout(200);
    const sel = page.locator('#sales-body select').first();
    const options = await sel.locator('option').allTextContents();
    const idx = options.findIndex(o => o.includes('Playwright Test Client'));
    if (idx > 0) await sel.selectOption({ index: idx });
    await page.waitForTimeout(300);
    await shot(page, 'creditnote-create-client-selected');

    const allocText = await page.textContent('#sales-body');
    const allocOk = !allocText.includes('No Invoice List Available');
    record('Credit Note: invoice allocation table populates', allocOk ? 'PASS' : 'FAIL', allocOk ? '' : 'Shows "No Invoice List Available..!" — bug-fix may have regressed');

    const creditingInput = page.locator('#sales-body table.sales-items input[type=number]').first();
    if (await creditingInput.count() > 0) await creditingInput.fill('10');
    await page.fill('#sales-body #cn-amount', '10');
    await page.fill('#sales-body #cn-reason', 'Playwright test credit note');
    await shot(page, 'creditnote-form-filled');

    const beforeCN = await page.evaluate(() => salesCreditNotes.map(c => c.id));
    await page.click('#sales-body button:has-text("Create Credit Note")');
    await page.waitForTimeout(300);
    await shot(page, 'after-create-creditnote');
    const afterCN = await page.evaluate(() => salesCreditNotes.map(c => c.id));
    creditNoteId = afterCN.filter(id => !beforeCN.includes(id))[0] || null;
    record('Create Sales Credit Note', creditNoteId ? 'PASS' : 'FAIL', creditNoteId ? `creditNoteId=${creditNoteId}` : 'No new entry in salesCreditNotes[] after Create Credit Note');

    if (creditNoteId && invoiceId) {
      const inv = await page.evaluate(id => { const i = taxInvoices.find(x => x.id === id); return i ? { creditedAmount: i.creditedAmount, paidAmount: i.paidAmount, netTotal: i.totals.netTotal } : null; }, invoiceId);
      const netsOff = inv && Math.abs((inv.creditedAmount || 0) - 10) < 0.001;
      record('Credit Note correctly nets off invoice.creditedAmount', netsOff ? 'PASS' : 'FAIL', `invoice=${JSON.stringify(inv)}`);
      if (inv) {
        const expectedBalance = inv.netTotal - inv.paidAmount - inv.creditedAmount;
        record('invoiceBalance() sanity (netTotal - paid - credited)', 'INFO', `expected balance=${expectedBalance.toFixed(3)}`);
      }
    }
  } catch (e) {
    record('Sales Credit Note flow', 'FAIL', e.message);
    await shot(page, 'sales-credit-note-FAILED');
  }

  // ── Step 12: Related Records check — Quotation Hub ──
  currentStep = 'related-records-quotation-hub';
  try {
    await page.click('#sales-body .sales-toptab:has-text("Quotation")');
    await page.waitForTimeout(200);
    await page.click(`#sales-body .sales-card:has-text("${quotationId}")`);
    await page.waitForTimeout(300);
    await shot(page, 'quotation-hub-related-records');
    const qHubText = await page.textContent('#sales-body');
    const invoiceRowOk = invoiceId ? qHubText.includes(invoiceId) : false;
    const receiptRowOk = receiptId ? qHubText.includes(receiptId) : false;
    const creditNoteRowOk = creditNoteId ? qHubText.includes(creditNoteId) : false;
    const proformaRowOk = proformaId ? qHubText.includes(proformaId) : false;
    record('Quotation Hub Related Records: Invoice row visible', invoiceRowOk ? 'PASS' : 'FAIL');
    record('Quotation Hub Related Records: Receipt row visible', receiptRowOk ? 'PASS' : 'FAIL');
    record('Quotation Hub Related Records: Credit Note row visible', creditNoteRowOk ? 'PASS' : 'FAIL');
    record('Quotation Hub Related Records: Proforma row visible', proformaRowOk ? 'PASS' : 'FAIL');
  } catch (e) {
    record('Related Records (Quotation Hub) check', 'FAIL', e.message);
    await shot(page, 'related-records-quotation-hub-FAILED');
  }

  // ── Step 13: Related Records check — Job Card hub ──
  currentStep = 'related-records-job-hub';
  try {
    await closeModule(page, 'sales-module-wrap');
    await openNode(page, 'delivery', 'jobs-module-wrap', 'jobs');
    await page.click(`#jobs-body .sales-card:has-text("${jobId}")`);
    await page.waitForTimeout(300);
    await shot(page, 'job-hub-related-records');
    const jHubText = await page.textContent('#jobs-body');
    const receiptRowOk2 = receiptId ? jHubText.includes(receiptId) : false;
    const creditNoteRowOk2 = creditNoteId ? jHubText.includes(creditNoteId) : false;
    record('Job Card Hub Related Records: Receipt row visible', receiptRowOk2 ? 'PASS' : 'FAIL');
    record('Job Card Hub Related Records: Credit Note row visible', creditNoteRowOk2 ? 'PASS' : 'FAIL');
  } catch (e) {
    record('Related Records (Job Card Hub) check', 'FAIL', e.message);
    await shot(page, 'related-records-job-hub-FAILED');
  }

  await browser.close();
  printReport();

  function printReport() {
    console.log('\n\n========== FINAL REPORT ==========');
    console.log(JSON.stringify({ results, consoleErrors, pageErrors }, null, 2));
  }
})();
