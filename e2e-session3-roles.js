// Session 3 of Salman's backlog — Sales role permission lockdown.
//
// His framing is the important part, and it shapes every check below:
//   "cross-reference every role-gated onclick against the role-check logic,
//    not just the DOM. A hidden button that's still reachable via a stale
//    event handler is the actual security bug, not the visual."
//
// So each gated action is checked TWICE: once that it isn't rendered for a
// Sales session, and once that calling the underlying function directly is
// refused. (The real boundary is still server-side RLS — this is the honest
// client surface on top of it.)
//
// Also covered: Sales must never see price or supplier/vendor detail on any
// purchase-related record, not just Job Cards.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== SESSION 3 — SALES ROLE LOCKDOWN ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text().slice(0, 150) }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message.slice(0, 150) }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => loadDemoData());

  // ── an operational role still sees everything (the regression guard) ──
  currentStep = 'ops-baseline';
  // Read the real controls (tiles + buttons), never the surrounding prose —
  // the "locked" banner mentions Delivery Note by name, so a text search over
  // the whole card would have quietly passed on a control that isn't there.
  await page.evaluate(() => {
    window.__jobControls = () => {
      const w = document.getElementById('jobs-module-wrap');
      const body = w.querySelector('#jobs-body') || w;
      return [...body.querySelectorAll('.sales-tile, button')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
    };
    window.__hasControl = label => window.__jobControls().some(t => t.includes(label));
  });

  const ops = await page.evaluate(async () => {
    window.cloudUserType = 'operations_manager';
    launchJobsModule();
    await new Promise(r => setTimeout(r, 400));
    openJobHub(jobCards[0].id);
    await new Promise(r => setTimeout(r, 400));
    const h = window.__hasControl;
    return { costing: h('Job Costing'), edit: h('Edit Job'), del: h('Delivery Note'), status: h('Update Job Status') };
  });
  record('An operational role still sees Job Costing, Edit Job, Delivery Note and Update Job Status',
    ops.costing && ops.edit && ops.del && ops.status ? 'PASS' : 'FAIL', JSON.stringify(ops));

  // ── the Sales Job Card: what is hidden, and what deliberately stays ──
  currentStep = 'sales-jobcard-dom';
  const sales = await page.evaluate(async () => {
    window.cloudUserType = 'sales';
    openJobHub(jobCards[0].id);
    await new Promise(r => setTimeout(r, 400));
    const h = window.__hasControl;
    return {
      costing: h('Job Costing'), edit: h('Edit Job'),
      delivery: h('Delivery Note'), issue: h('Material Issue'),
      ret: h('Material Return'), status: h('Update Job Status'),
      labour: h('Labour Cost'), cancel: h('Cancel Job'),
      invoice: h('Generate Invoice'),
      // deliberately kept for Sales:
      // Record page (9a, 9 Aug 2026) relabelled these, and Mark Completed is
      // gone for everyone — completion is derived from delivery + production now.
      order: h('Print job order'), variation: h('New variation'),
      pr: h('Raise purchase request'), completed: h('Mark Completed')
    };
  });
  const hidden = ['costing', 'edit', 'delivery', 'issue', 'ret', 'status', 'labour', 'cancel', 'invoice'].filter(k => sales[k]);
  record('Sales sees no Job Costing / Edit Job / Delivery Note / Material Issue+Return / Update Status / Labour Cost / Cancel Job / Generate Invoice',
    hidden.length === 0 ? 'PASS' : 'FAIL', hidden.length ? 'still visible: ' + hidden.join(', ') : '');
  record('Sales keeps Print job order, New variation and Raise purchase request — and has no completion control',
    sales.order && sales.variation && sales.pr && !sales.completed ? 'PASS' : 'FAIL', JSON.stringify(sales));

  // ── the actual security check: the functions themselves refuse ──
  currentStep = 'sales-function-guards';
  const guards = await page.evaluate(async () => {
    window.cloudUserType = 'sales';
    const id = jobCards[0].id;
    const before = jobsView;
    const out = {};
    const tryOpen = (fn, ...args) => { jobsView = 'hub'; try { fn(...args); } catch (e) { return 'threw'; } return jobsView; };
    out.editJob = tryOpen(openEditJob, id);
    out.delivery = tryOpen(openDeliveryNote, id);
    out.issue = tryOpen(openMaterialsMove, id, 'issue');
    out.ret = tryOpen(openMaterialsMove, id, 'return');
    out.status = tryOpen(openUpdateJobStatus, id);
    out.labour = tryOpen(openLabourCost, id);
    // invoicing must not create a record
    const invBefore = taxInvoices.length;
    try { jobsGenerateInvoice(id); } catch (e) {}
    out.invoiceCreated = taxInvoices.length !== invBefore;
    // cancelling must not change the job
    const statusBefore = jobCards.find(j => j.id === id).status;
    try { jobsSetStatus(id, 'cancelled'); } catch (e) {}
    out.cancelled = jobCards.find(j => j.id === id).status !== statusBefore;
    jobsView = before;
    return out;
  });
  const leaked = Object.entries(guards).filter(([k, v]) => k.startsWith('invoice') || k === 'cancelled' ? v === true : v !== 'hub');
  record('Calling the gated Job Card functions directly is refused (no view change, no invoice, no cancellation)',
    leaked.length === 0 ? 'PASS' : 'FAIL', leaked.length ? JSON.stringify(Object.fromEntries(leaked)) : '');

  // ── no supplier or price detail reaches Sales on a Job Card ──
  currentStep = 'sales-po-detail';
  const po = await page.evaluate(async () => {
    window.cloudUserType = 'sales';
    const job = jobCards[0];
    job.poNo = 'PO-TEST-001'; job.poDate = '2026-08-07'; job.vendor = 'Gulf Timber Trading WLL';
    openJobHub(job.id);
    await new Promise(r => setTimeout(r, 400));
    const body = document.querySelector('#jobs-module-wrap #jobs-body') || document.getElementById('jobs-module-wrap');
    const t = body.textContent;
    // The PO/Vendor card is no longer rendered for Sales at all — a card whose
    // only content is the refusal is worse than no card (record package §1).
    return { vendorShown: t.includes('Gulf Timber Trading'), poShown: t.includes('PO-TEST-001'), cardGone: !t.includes('PO / Vendor') };
  });
  record('A Job Card with a real PO shows Sales neither the PO number nor the vendor name',
    !po.vendorShown && !po.poShown && po.cardGone ? 'PASS' : 'FAIL', JSON.stringify(po));

  // ── the same rule everywhere POs surface, not just Job Cards ──
  currentStep = 'sales-purchasing';
  const purch = await page.evaluate(async () => {
    window.cloudUserType = 'sales';
    openPurchasingModule();
    await new Promise(r => setTimeout(r, 500));
    const landed = purchCurrentPage;
    purchGoTo('purch-orders');                 // try to reach PO pricing
    await new Promise(r => setTimeout(r, 300));
    const afterOrders = purchCurrentPage;
    purchGoTo('purch-suppliers');              // try to reach the vendor list
    await new Promise(r => setTimeout(r, 300));
    const afterSuppliers = purchCurrentPage;
    const t = document.getElementById('purch-module-wrap').textContent;
    return { landed, afterOrders, afterSuppliers, convertBtn: t.includes('Convert to PO') };
  });
  record('Sales entering Purchasing is confined to Purchase Requests — Orders and Suppliers redirect away',
    purch.landed === 'purch-requests' && purch.afterOrders === 'purch-requests' && purch.afterSuppliers === 'purch-requests' ? 'PASS' : 'FAIL', JSON.stringify(purch));
  record('Sales sees no "Convert to PO" action on a purchase request', !purch.convertBtn ? 'PASS' : 'FAIL', JSON.stringify(purch));

  const purchGuards = await page.evaluate(async () => {
    window.cloudUserType = 'sales';
    const before = purchCurrentPage;
    const out = {};
    for (const [k, fn] of [['po', () => openPOForm(purchaseRequests[0] && purchaseRequests[0].id)],
                           ['supplier', () => openSupplierForm()],
                           ['payment', () => openPaymentForm()],
                           ['debit', () => openDebitNoteForm()]]) {
      purchCurrentPage = 'purch-requests';
      try { fn(); } catch (e) { out[k] = 'threw'; continue; }
      out[k] = purchCurrentPage;
    }
    purchCurrentPage = before;
    return out;
  });
  const purchLeaked = Object.entries(purchGuards).filter(([, v]) => v !== 'purch-requests');
  record('Calling the PO / Supplier / Payment / Debit Note forms directly is refused for Sales',
    purchLeaked.length === 0 ? 'PASS' : 'FAIL', purchLeaked.length ? JSON.stringify(Object.fromEntries(purchLeaked)) : '');

  // ── the sign-up approval screen shows the whole submitted form ──
  currentStep = 'signup-detail';
  const signup = await page.evaluate(() => {
    const wasReal = window.__realCloudSession;
    window.__realCloudSession = true;
    const host = document.createElement('div');
    host.id = 'aq-test-host';
    document.body.appendChild(host);
    approvalQueueRows = [{ id: 'p1', display_name: 'Test Person', dob: '1990-04-02', phone: '+973 3300 1122', designation: 'Site Supervisor', user_type: 'operations_manager', approval_status: 'pending' }];
    approvalQueueUserTypes = [{ key: 'operations_manager', label: 'Operations Manager' }];
    renderApprovalQueueInto("aq-test-host");
    const t = host.textContent;
    window.__realCloudSession = wasReal;
    return { name: t.includes('Test Person'), desig: t.includes('Site Supervisor'), dob: t.includes('1990-04-02'), phone: t.includes('3300 1122'), labelled: t.includes('SIGN-UP DETAILS') };
  });
  record('The sign-up approval card shows the full submitted form (name, designation, DOB, telephone) as labelled fields',
    signup.name && signup.desig && signup.dob && signup.phone && signup.labelled ? 'PASS' : 'FAIL', JSON.stringify(signup));

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
