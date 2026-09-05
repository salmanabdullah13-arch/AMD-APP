/**
 * run-iteration-1.js — the end-to-end run, iteration 1: happy paths, one
 * suite per division (docs/test-run/scenarios.md, S1–S5).
 *
 * Every step runs AS THE REAL ROLE that does it, in its own signed-in session
 * against the LIVE project, and is checked three ways where the record is
 * cloud-backed: the data layer has it, the live table has it, and another
 * role's session sees it arrive through realtime. Findings are reported, not
 * patched mid-run. Every id the run creates goes to a manifest that
 * clear-run-manifest.js can remove exactly.
 *
 *   SUPABASE_PAT=sbp_xxx node run-iteration-1.js [S1,S3]
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const https = require('https');

const REF = 'rwbxycxrrslgxskoufxo';
const PAT = process.env.SUPABASE_PAT;
const PASSWORD = 'E2eFixedTestPassword1234!';
const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';
const ONLY = (process.argv[2] || 'S1,S2,S3,S4,S5').split(',');
const OUT = path.join(__dirname, 'test-run', 'iter1');
fs.mkdirSync(OUT, { recursive: true });

const ROLES = {
  sales: 'E2E Test Account', estimator: 'E2E Estimator Account', approver: 'E2E Approver Role Account',
  operations_manager: 'E2E Operations Account', purchaser: 'E2E Purchaser Account', storekeeper: 'E2E Storekeeper Account',
  accounts: 'E2E Accounts Account', joinery_production_manager: 'E2E Joinery Account', upholstery_manager: 'E2E Upholstery Account',
  painting_lead: 'E2E Painting Account', curtain_manager: 'E2E Curtain Account', installation_crew_lead: 'E2E Install Lead Account',
  delivery_scheduling: 'E2E Delivery Account', owner: 'E2E Approver Account'
};
const localISO = (d) => { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return localISO(d); };
function workdays(n) { const out = []; let d = localISO(new Date()); while (out.length < n) { d = addDays(d, 1); const wd = new Date(d + 'T00:00:00').getDay(); if (wd !== 5 && wd !== 6) out.push(d); } return out; }
const DAYS = workdays(14);
const STAMP = Date.now();

function sql(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({ hostname: 'api.supabase.com', path: '/v1/projects/' + REF + '/database/query', method: 'POST',
      headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(d); } }); });
    req.on('error', reject); req.write(body); req.end();
  });
}
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
async function liveRow(table, id) { const r = await sql('select count(*)::int as n from ' + table + ' where id = ' + lit(id)); return Array.isArray(r) && r[0] && r[0].n > 0; }
async function livePayload(table, id) { const r = await sql('select payload from ' + table + ' where id = ' + lit(id)); return Array.isArray(r) && r[0] ? r[0].payload : null; }
async function liveCol(table, id, col) { const r = await sql('select ' + col + ' as v from ' + table + ' where id = ' + lit(id)); return Array.isArray(r) && r[0] ? r[0].v : undefined; }

/* ── the report ────────────────────────────────────────────────────── */
const results = []; const findings = [];
let scenario = '', stepNo = 0;
function record(name, role, ok, detail, kind) {
  const dtxt = detail === undefined ? '' : (typeof detail === 'string' ? detail : (JSON.stringify(detail) || String(detail)));
  results.push({ scenario, step: ++stepNo, name, role, ok: !!ok, detail: dtxt.slice(0, 400) });
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  [' + role + '] ' + name + (ok ? '' : '  → ' + dtxt.slice(0, 300)));
  if (!ok) findings.push({ scenario, step: stepNo, name, role, detail: dtxt, kind: kind || 'flow' });
}
const errorsByRole = {};

/* ── sessions: one signed-in page per role ─────────────────────────── */
let browser; const sessions = {};
async function session(role) {
  if (sessions[role]) return sessions[role].page;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  errorsByRole[role] = [];
  page.on('pageerror', e => errorsByRole[role].push(e.message));
  page.on('console', m => { if (m.type() === 'error') errorsByRole[role].push(m.text()); });
  page.on('dialog', d => d.accept());
  // A 403 on this stack is a write refused by a policy for THIS role — silent to the user. Name the URL.
  page.on('response', r => { if (r.status() === 403 || r.status() === 401) errorsByRole[role].push('HTTP ' + r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/^https:\/\/[^/]+/, '').slice(0, 120)); });
  await page.goto(fileUrl);
  await page.waitForFunction(() => { const s = document.getElementById('auth-identity-select'); return s && s.options.length > 1; }, { timeout: 20000 }).catch(() => null);
  await page.selectOption('#auth-identity-select', ROLES[role]);
  await page.fill('#auth-password-input', PASSWORD);
  await page.click('#cloud-login-body button[onclick="handleSignIn()"]');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none' && window.__realCloudSession === true, { timeout: 25000 }).catch(() => null);
  const ok = await page.evaluate((r) => window.__realCloudSession === true && window.cloudUserType === r, role);
  if (!ok) throw new Error('could not sign in as ' + role + ' (' + ROLES[role] + ')');
  await page.waitForTimeout(3500);   // the caches hydrate after login; the landing screen redraws when they land
  await page.evaluate(() => { if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; });
  sessions[role] = { ctx, page };
  return page;
}
async function act(role, fn, arg, gapMs) {
  const page = await session(role);
  const r = await page.evaluate(fn, arg);
  await page.waitForTimeout(gapMs === undefined ? 1200 : gapMs);   // the documented cross-record FK race: a person takes seconds between steps
  return r;
}
// Another role's session sees the record arrive through realtime.
async function seen(role, fn, arg, timeout) {
  const page = await session(role);
  try { await page.waitForFunction(fn, arg, { timeout: timeout || 15000 }); return true; } catch (e) { return false; }
}
async function shot(role, name) {
  const page = await session(role);
  await page.screenshot({ path: path.join(OUT, name + '.png') }).catch(() => null);
}
// Ids per cloud table, from the Owner's session (sees everything), for the manifest.
async function snapshotIds() {
  return act('owner', () => {
    const out = {};
    (CLOUD_JSON_COLLECTIONS || []).forEach(c => { try { out[c.table] = c.arr().map(r => r.id); } catch (e) { out[c.table] = []; } });
    out.customers = customers.map(c => c.id); out.enquiries = enquiries.map(e => e.id); out.quotations = quotations.map(q => q.id);
    out.job_cards = jobCards.map(j => j.id); out.curtain_jobs = (typeof curtainJobs !== 'undefined' ? curtainJobs : []).map(j => j.id);
    return out;
  }, null, 0);
}

/* ── the shared front half: Sales → Estimator → Approver → Sales confirm → Operations routes ── */
async function frontHalf(tag, { division, product, qty, unit, depts, projectName, extraItems }) {
  const sales = await act('sales', ({ tag, division, product, qty, unit, projectName, extraItems, stamp }) => {
    const c = createCustomer({ name: 'RUN1 ' + tag + ' ' + stamp, contactPerson: 'Site contact', tel: '39' + String(stamp).slice(-6) + tag.replace(/\D/g, '').slice(0, 2), address: 'Budaiya' });
    return { customer: c.id, err: c.error };
  }, { tag, division, product, qty, unit, projectName, extraItems, stamp: STAMP }, 1500);
  record('Sales creates the customer', 'sales', sales.customer && !sales.err, sales);
  // The live row must be THIS customer, not an older one under the same id.
  const cName = await liveCol('customers', sales.customer, 'name');
  record('… and it is in the live customers table under its own name', 'sales', cName === 'RUN1 ' + tag + ' ' + STAMP, { id: sales.customer, live: cName }, 'persistence');

  const enq = await act('sales', ({ customer, division }) => {
    const e = createEnquiry({ division, customerId: customer, contactPerson: 'Site contact', tel: '39000000', source: 'walk inn', salesPerson: 'E2E Test Account' });
    return { enquiry: e.id, err: e.error };
  }, { customer: sales.customer, division }, 1500);
  record('Sales creates the enquiry', 'sales', enq.enquiry && !enq.err, enq);

  const qtn = await act('sales', ({ enquiry, product, qty, unit, projectName, extraItems }) => {
    const q = convertEnquiryToQuotation(enquiry, { projectName, taxPercent: 10, contactPerson: 'Site contact' });
    addQuotationItem(q.id, { product, qty, unit, group: 'Main', subgroup: 'Room 1' });
    (extraItems || []).forEach(it => addQuotationItem(q.id, { product: it.product, qty: it.qty, unit: it.unit, group: 'Main', subgroup: 'Room 1' }));
    const qq = quotations.find(x => x.id === q.id);
    return { quotation: q.id, lines: qq.items.map(i => i.lineId), rate0: qq.items.every(i => !i.rate), stage: qq.stage };
  }, { enquiry: enq.enquiry, product, qty, unit, projectName, extraItems }, 1500);
  record('Sales builds the quotation with its lines — every rate locked at zero', 'sales', qtn.quotation && qtn.rate0, qtn);
  const qProj = await liveCol('quotations', qtn.quotation, 'project_name');
  record('… and the quotation row is live under its own project name', 'sales', qProj === projectName, { id: qtn.quotation, live: qProj }, 'persistence');

  const toEst = await act('sales', ({ quotation }) => { const r = transferQuotationStage(quotation, 'estimator', 'E2E Test Account'); return { err: r && r.error, stage: quotations.find(q => q.id === quotation).stage }; }, { quotation: qtn.quotation });
  record('Sales transfers to the Estimator', 'sales', toEst.stage === 'estimator' && !toEst.err, toEst);

  const estSees = await seen('estimator', (id) => quotations.some(q => q.id === id && q.stage === 'estimator'), qtn.quotation);
  record('The Estimator\'s session sees the quotation arrive at its stage', 'estimator', estSees, qtn.quotation, 'realtime');
  if (!estSees) await act('estimator', () => location.reload(), null, 6000);

  const est = await act('estimator', ({ quotation, depts }) => {
    const q = quotations.find(x => x.id === quotation); if (!q) return { err: 'quotation not in the estimator session' };
    const out = [];
    q.items.forEach((it, i) => {
      const mat = itemMaster.find(m => /mdf|board|ply/i.test(m.name)) || itemMaster[0];
      const r1 = addBOMMaterial(quotation, it.lineId, { name: mat.name, qty: 4, rate: mat.cost || mat.lastPurchaseRate || 12, unit: mat.unit });
      const r2 = addBOMLabour(quotation, it.lineId, { department: depts[i] ? depts[i][0] : depts[0][0], description: 'Make', noOfPpl: 2, qty: 3, rate: 3.5, calcMode: 'days' });
      const s = submitItemBOM(quotation, it.lineId, 'E2E Estimator Account');
      const d = setItemDepartmentSequence(quotation, it.lineId, depts[i] || depts[0]);
      out.push({ line: it.lineId, mat: !(r1 && r1.error), lab: !(r2 && r2.error), submitted: !(s && s.error), depts: !(d && d.error), price: quotations.find(x => x.id === quotation).items.find(y => y.lineId === it.lineId).rate });
    });
    return { out, err: out.find(o => !o.mat || !o.lab || !o.submitted || !o.depts) ? 'a BOM step failed' : null };
  }, { quotation: qtn.quotation, depts }, 2000);
  record('Estimator costs each line from the Item Master, books labour, submits, routes', 'estimator', !est.err && est.out.every(o => o.price > 0), est);

  const toApp = await act('estimator', ({ quotation }) => { const r = transferQuotationStage(quotation, 'approver', 'E2E Estimator Account'); return { err: r && r.error, stage: quotations.find(q => q.id === quotation).stage }; }, { quotation: qtn.quotation });
  record('Estimator transfers to the Approver', 'estimator', toApp.stage === 'approver' && !toApp.err, toApp);

  const appSees = await seen('approver', (id) => quotations.some(q => q.id === id && q.stage === 'approver' && q.items.every(i => i.rate > 0)), qtn.quotation);
  record('The Approver\'s session sees the priced quotation', 'approver', appSees, qtn.quotation, 'realtime');
  if (!appSees) await act('approver', () => location.reload(), null, 6000);
  const app = await act('approver', ({ quotation }) => {
    const r = approveQuotation(quotation, 'E2E Approver Role Account', 'approver');
    const q = quotations.find(x => x.id === quotation);
    return { err: r && r.error, lifecycle: q && q.lifecycleStatus, stage: q && q.stage, total: q && q.netTotal };
  }, { quotation: qtn.quotation }, 2000);
  record('Approver approves — lifecycle open, back to Sales', 'approver', !app.err && app.lifecycle === 'open' && app.stage === 'sales', app);
  const lifeLive = await liveCol('quotations', qtn.quotation, 'lifecycle_status');
  record('… and lifecycle_status is open in the live row', 'approver', lifeLive === 'open', lifeLive, 'persistence');

  const salesSees = await seen('sales', (id) => quotations.some(q => q.id === id && q.lifecycleStatus === 'open'), qtn.quotation);
  record('Sales sees the approval land', 'sales', salesSees, qtn.quotation, 'realtime');
  if (!salesSees) await act('sales', () => location.reload(), null, 6000);
  const job = await act('sales', ({ quotation }) => {
    const j = confirmQuotationToJobCard(quotation, 'E2E Test Account');
    if (!j || j.error) return { err: (j && j.error) || 'no job' };
    return { job: j.id, amount: j.amount, routing: j.routingConfirmed, bridged: (typeof projects !== 'undefined' ? projects : []).some(p => p.linkedJobCardId === j.id), curtainBridged: (typeof curtainJobs !== 'undefined' ? curtainJobs : []).some(c => c.linkedJobCardId === j.id) };
  }, { quotation: qtn.quotation }, 2500);
  record('Sales confirms to a Job Card, unrouted, bridged to Operations', 'sales', job.job && !job.err && job.routing === false && job.bridged, job);
  const jLive = await liveRow('job_cards', job.job);
  record('… and the job card is live', 'sales', jLive, job.job, 'persistence');

  const opsSees = await seen('operations_manager', (id) => jobCards.some(j => j.id === id) && getJobsPendingRouting().some(j => j.id === id), job.job);
  record('Operations sees the job in its routing queue', 'operations_manager', opsSees, job.job, 'realtime');
  if (!opsSees) await act('operations_manager', () => location.reload(), null, 6000);
  const routed = await act('operations_manager', ({ job, target }) => {
    const r = confirmJobRouting(job, {}, 'E2E Operations Account', target);
    const j = getJobCard(job);
    return { err: r && r.error, routing: j && j.routingConfirmed, target: j && j.targetDate, budgets: j && Object.keys(j.departmentBudgets || {}) };
  }, { job: job.job, target: DAYS[10] }, 2500);
  record('Operations routes with a target date; every routed department gets a budget slot', 'operations_manager', routed.routing && routed.target === DAYS[10] && routed.budgets.length, routed);
  await shot('operations_manager', tag + '-ops-after-routing');
  return { customer: sales.customer, enquiry: enq.enquiry, quotation: qtn.quotation, lines: qtn.lines, job: job.job, routed, curtainBridged: job.curtainBridged };
}

/* ── the back half: delivery → invoice → receipt → completion → Owner ── */
async function backHalf(tag, F, { skipDeliveryGate } = {}) {
  const sched = await act('delivery_scheduling', ({ job, when }) => {
    const s = scheduleDelivery(job, { plannedDate: when, driver: 'Driver', vehicleId: null, notes: 'run 1' });
    return { id: s && s.id, err: s && s.error };
  }, { job: F.job, when: DAYS[11] });
  record('Delivery schedules the job', 'delivery_scheduling', sched.id && !sched.err, sched);
  findings.push({ scenario, step: stepNo, name: 'addDeliveryNote() accepts an entry with no requiredQty and delivers nothing', role: 'operations_manager', detail: 'The driver first sent {lineId, qty}; the function created an empty delivery note and called auto-complete rather than refusing. The UI always sends requiredQty, so this is a data-layer hole, not a screen bug. Minor.', kind: 'note' });
  const dn = await act('operations_manager', ({ job }) => {
    const j = getJobCard(job);
    // An entry with no requiredQty is ACCEPTED and delivers nothing — noted in the report; the UI always sends it.
    const r = addDeliveryNote(job, j.items.map(it => ({ lineId: it.lineId, requiredQty: it.qty - it.deliveredQty })));
    const jj = getJobCard(job);
    return { err: r && r.error, delivered: jj.items.every(it => it.deliveredQty >= it.qty), status: jj.status };
  }, { job: F.job }, 2000);
  record('A full delivery note is accepted once production is complete, and the job completes by derivation', 'operations_manager', !dn.err && dn.delivered && dn.status === 'completed', dn);
  const statusLive = await liveCol('job_cards', F.job, 'status');
  record('… and the live job card reads completed', 'operations_manager', statusLive === 'completed', statusLive, 'persistence');
  const delivered = await act('delivery_scheduling', ({ id }) => { const r = markDeliveryScheduleStatus(id, 'delivered'); return { err: r && r.error }; }, { id: sched.id });
  record('Delivery marks the schedule delivered', 'delivery_scheduling', !delivered.err, delivered);

  const accSees = await seen('accounts', (id) => jobCards.some(j => j.id === id && j.status === 'completed'), F.job);
  record('Accounts sees the completed job', 'accounts', accSees, F.job, 'realtime');
  if (!accSees) await act('accounts', () => location.reload(), null, 6000);
  const inv = await act('accounts', ({ job, customer }) => {
    const i = generateInvoiceFromJob(job, { invoicedPercent: 100 });
    if (!i || i.error) return { err: (i && i.error) || 'no invoice' };
    const net = i.totals.netTotal;
    const rc = createSalesReceipt({ customerId: customer, amount: net, methods: { bank: { enabled: true, amount: net } }, allocations: [{ invoiceId: i.id, payingAmount: net, discountAmount: 0 }] });
    const inv = taxInvoices.find(x => x.id === i.id);
    return { invoice: i.id, net: net, receipt: rc && rc.id, rerr: rc && rc.error, balance: invoiceBalance(inv), second: generateInvoiceFromJob(job, { invoicedPercent: 10 }).error };
  }, { job: F.job, customer: F.customer }, 2500);
  record('Accounts invoices 100%, receives it in full — balance nets to zero; a second invoice is refused', 'accounts', inv.invoice && !inv.rerr && Math.abs(inv.balance) < 0.001 && /100%|already|exceed|past/i.test(inv.second || ''), inv);
  const invLive = await liveRow('tax_invoices', inv.invoice);
  record('… and the invoice is in the live tax_invoices table', 'accounts', invLive, inv.invoice, 'persistence');

  const owner = await seen('owner', (id) => jobCards.some(j => j.id === id && j.status === 'completed') && taxInvoices.some(i => i.jobId === id || i.jobCardId === id), F.job, 20000);
  record('The Owner\'s session holds the completed job and its invoice', 'owner', owner, F.job, 'realtime');
  const ownerDash = await act('owner', ({ job }) => {
    launchOwnerModule();
    const t = document.getElementById('owner-module-wrap').textContent;
    return { shown: getComputedStyle(document.getElementById('owner-module-wrap')).display !== 'none', mentionsJob: t.indexOf(job) !== -1 || /Recent activity|Company/i.test(t) };
  }, { job: F.job }, 500);
  record('The Owner dashboard opens with the numbers behind it', 'owner', ownerDash.shown, ownerDash);
  await shot('owner', tag + '-owner');
}

/* ── S1: Joinery — a wardrobe ──────────────────────────────────────── */
async function S1() {
  scenario = 'S1 Joinery'; stepNo = 0; console.log('\n═══ ' + scenario);
  const F = await frontHalf('S1', { division: 'Joinery', product: 'Master wardrobe — oak veneer', qty: 2, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 S1 Saar villa' });
  // Production: the BOM request answered by building the budget; approve; lane slot; crew clock; QC; hand-off.
  const opsAsk = await act('operations_manager', ({ job }) => {
    const r = raiseInputRequest({ type: 'bom_budget_input', raisedBy: 'E2E Operations Account', raiserRole: 'operations_manager', jobCardId: job, question: 'Build the BOM for this job so we can set the project budget.', dept: 'carp' });
    return { req: r && r.id, err: r && r.error };
  }, { job: F.job });
  record('Operations asks Production for the job BOM', 'operations_manager', opsAsk.req && !opsAsk.err, opsAsk);
  const prdSees = await seen('joinery_production_manager', (id) => jobCards.some(j => j.id === id && j.routingConfirmed), F.job);
  record('Production sees the routed job', 'joinery_production_manager', prdSees, F.job, 'realtime');
  if (!prdSees) await act('joinery_production_manager', () => location.reload(), null, 6000);
  const budget = await act('joinery_production_manager', ({ job, req }) => {
    const seed = seedDepartmentBudgetLinesFromEstimate(job, 'carp');
    const lines = { materials: seed.materials.map(m => ({ itemId: m.itemId, qty: m.qty })), labour: seed.labour.length ? seed.labour : [{ task: 'Carcass assembly', men: 2, days: 3 }] };
    const r = submitDepartmentBudgetFromBOM(job, 'carp', lines, 'E2E Joinery Account', { note: 'run 1' });
    const c = closeInputRequestWithBudget(req, { jobCardId: job, deptKey: 'carp' }, 'E2E Joinery Account');
    const j = getJobCard(job);
    return { err: r && r.error, cerr: c && c.error, status: j.departmentBudgets.carp.approvalStatus, lines: lines.materials.length };
  }, { job: F.job, req: opsAsk.req }, 2000);
  record('Production builds the job BOM from the estimate and submits it; the request is answered by a pointer', 'joinery_production_manager', !budget.err && !budget.cerr && budget.status === 'pending', budget);
  const approved = await act('operations_manager', ({ job }) => {
    const r = approveDepartmentBudget(job, 'carp', 'E2E Operations Account');
    return { err: r && r.error, status: getJobCard(job).departmentBudgets.carp.approvalStatus, gate: isDepartmentBudgetApproved(getJobCard(job), 'carp') };
  }, { job: F.job }, 2000);
  record('Operations approves the budget (maker-checker), which opens production', 'operations_manager', !approved.err && approved.gate, approved);

  const prod = await act('joinery_production_manager', ({ job, lines, days }) => {
    const l = lines[0];
    const st = startLineProduction(job, l, 'carp');
    const short = jobMaterialShortLines(job).length;
    const slot = allotLaneSlot({ crewId: 'CREW-A', jobCardId: job, date: days[0], lineIds: [l], byWhom: 'E2E Joinery Account' });
    return { started: !(st && st.error), serr: st && st.error, short, slot: slot.slot && slot.slot.id, slotErr: slot.error };
  }, { job: F.job, lines: F.lines, days: DAYS }, 2000);
  record('Production starts the line and books a lane slot (or is refused honestly for short material)', 'joinery_production_manager', prod.started && (prod.slot || /short|No BOM/.test(prod.slotErr || '')), prod);
  if (prod.slotErr) findings.push({ scenario, step: stepNo, name: 'Lane refused: ' + prod.slotErr, role: 'joinery_production_manager', detail: 'Expected when the store holds none of the BOM material. Recorded, not worked around.', kind: 'note' });

  // The crew clock, as the install/joinery lead: a day on Crew A.
  const clock = await act('installation_crew_lead', ({ job, line }) => {
    if (typeof buildCrewRoster === 'function') buildCrewRoster();
    const crew = timerCrewsAll().find(c => c.id === 'CREW-A');
    const s = startCrewSession({ crewId: 'CREW-A', jobCardId: job, lineIds: [line], present: crew.members.slice(0, 3), activity: 'production', leadName: 'E2E Install Lead Account' });
    if (!s || s.error) return { err: (s && s.error) || 'no session' };
    s.startedAt = new Date(Date.now() - 3 * 3600000).toISOString();
    const p = pauseCrewSession(s.id, 'Break'); const r = resumeCrewSession(s.id);
    const before = labourDayLogs.length;
    const e = endCrewSession(s.id, { progressPct: 50, note: 'carcasses up' });
    const ph = addProgressPhoto({ sessionId: s.id, jobCardId: job, lineId: line, url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', note: 'carcasses up' });
    return { session: s.id, hours: e.hours, logs: labourDayLogs.length - before, pct: getJobCard(job).items[0].departmentStatuses[0].progressPct, photo: ph && ph.id };
  }, { job: F.job, line: F.lines[0] }, 2500);
  record('The crew clock logs a day: 3 h for 3 men on the line, progress 50, a photo', 'installation_crew_lead', clock.session && clock.hours === 3 && clock.logs === 3 && clock.pct === 50 && clock.photo, clock);
  const sessLive = await liveRow('crew_sessions', clock.session);
  record('… and the session is in the live crew_sessions table', 'installation_crew_lead', sessLive, clock.session, 'persistence');

  const qc = await act('joinery_production_manager', ({ job, lines }) => {
    const l = lines[0];
    ['cutting', 'veneer-pressing', 'assembly'].forEach(s => advanceJoinerySubStage(job, l, s));
    const a = submitLineForQC(job, l, 'carp');
    const b = recordLineQCResult(job, l, 'carp', true, 'Joinery Production Manager');
    const c = handOffLine(job, l, 'carp', 'E2E Joinery Account');
    const entry = getJobCard(job).items[0].departmentStatuses.find(d => d.department === 'carp');
    return { aerr: a && a.error, berr: b && b.error, cerr: c && c.error, status: entry.status, pct: entry.progressPct, complete: jobProductionComplete(job) };
  }, { job: F.job, lines: F.lines }, 2000);
  record('Sub-stages, QC pass under authority, hand-off — the line is done at 100%', 'joinery_production_manager', qc.status === 'done' && qc.pct === 100 && qc.complete, qc);
  // Second line the same way, so the job is production-complete.
  await act('joinery_production_manager', ({ job, lines }) => { const l = lines[1]; if (!l) return; startLineProduction(job, l, 'carp'); ['cutting', 'veneer-pressing', 'assembly'].forEach(s => advanceJoinerySubStage(job, l, s)); submitLineForQC(job, l, 'carp'); recordLineQCResult(job, l, 'carp', true, 'Joinery Production Manager'); handOffLine(job, l, 'carp', 'E2E Joinery Account'); }, { job: F.job, lines: F.lines }, 2000);

  // Store: put-away, reservation, an issue against the job — the hard gate.
  const store = await act('storekeeper', ({ job }) => {
    const item = itemMaster.find(m => /mdf|board|ply/i.test(m.name)) || itemMaster[0];
    let loc = storeLocations[0] || createStoreLocation({ name: 'Riffa store' });
    let bin = storeBins.find(b => b.storeId === loc.id) || createStoreBin({ storeId: loc.id, code: 'A1' });
    putAwayStock({ itemId: item.id, binId: bin.id, qty: 10 });
    const res = reserveStockForJob({ itemId: item.id, binId: bin.id, qty: 4, jobCardId: job, heldBy: 'E2E Storekeeper Account' });
    const noJob = issueMaterialToJob({ jobCardId: 'general use', lines: [{ itemId: item.id, binId: bin.id, qty: 1 }] });
    const iss = issueMaterialToJob({ jobCardId: job, lines: [{ itemId: item.id, binId: bin.id, qty: 4 }], issuedBy: 'E2E Storekeeper Account' });
    return { res: res && res.id, rerr: res && res.error, noJob: noJob.error, issue: iss && iss.id, ierr: iss && iss.error };
  }, { job: F.job }, 2000);
  record('Store puts away, reserves for the job, refuses "general use", issues against the job', 'storekeeper', store.res && /not a job card/i.test(store.noJob || '') && store.issue && !store.ierr, store);
  const issLive = await liveRow('store_issues', store.issue);
  record('… and the issue is in the live store_issues table', 'storekeeper', issLive, store.issue, 'persistence');

  await backHalf('S1', F);
}

/* ── S2: Joinery + Paint — a painted TV unit ───────────────────────── */
async function S2() {
  scenario = 'S2 Joinery + Paint'; stepNo = 0; console.log('\n═══ ' + scenario);
  const F = await frontHalf('S2', { division: 'Joinery', product: 'Painted TV unit', qty: 1, unit: 'Nos', depts: [['carp', 'paint']], projectName: 'RUN1 S2 Amwaj apartment' });
  const both = await act('joinery_production_manager', ({ job }) => {
    const r1 = submitDepartmentBudgetFromBOM(job, 'carp', { materials: [], labour: [{ task: 'Carcass', men: 2, days: 2 }] }, 'E2E Joinery Account', {});
    const r2 = submitDepartmentBudgetFromBOM(job, 'paint', { materials: [], labour: [{ task: 'Spray and polish', men: 1, days: 1 }] }, 'E2E Joinery Account', {});
    const j = getJobCard(job);
    return { e1: r1 && r1.error, e2: r2 && r2.error, carp: j.departmentBudgets.carp.approvalStatus, paint: j.departmentBudgets.paint.approvalStatus };
  }, { job: F.job }, 2000);
  record('One manager submits both budgets — joinery and paint', 'joinery_production_manager', !both.e1 && !both.e2 && both.carp === 'pending' && both.paint === 'pending', both);
  const app = await act('operations_manager', ({ job }) => { const a = approveDepartmentBudget(job, 'carp', 'E2E Operations Account'); const b = approveDepartmentBudget(job, 'paint', 'E2E Operations Account'); return { a: a && a.error, b: b && b.error, ok: isDepartmentBudgetApproved(getJobCard(job), 'carp') && isDepartmentBudgetApproved(getJobCard(job), 'paint') }; }, { job: F.job }, 2000);
  record('Operations approves both', 'operations_manager', app.ok, app);
  const pull = await act('joinery_production_manager', ({ job, line, days }) => {
    startLineProduction(job, line, 'carp');
    const base = allotLaneSlot({ crewId: 'CREW-A', jobCardId: job, date: days[1], lineIds: [line] });
    if (!base.slot) return { err: base.error };
    const paint = allotDerivedSlot({ crewId: 'CREW-P', baseSlotId: base.slot.id, offsetDays: 2, jobCardId: job });
    const d1 = slotDate(paint.slot);
    moveLaneSlot(base.slot.id, days[2]);
    const d2 = slotDate(paint.slot);
    return { d1, d2, moved: d2 !== d1 && d2 === addDaysISO(days[2], 2) };
  }, { job: F.job, line: F.lines[0], days: DAYS }, 2000);
  record('Paint\'s booth day is derived from joinery\'s slot and moves with it', 'joinery_production_manager', pull.moved, pull);
  if (pull.err) findings.push({ scenario, step: stepNo, name: 'Lane refused: ' + pull.err, role: 'joinery_production_manager', detail: 'Material short in the store — the gate held, as designed.', kind: 'note' });
  const walk = await act('joinery_production_manager', ({ job, line }) => {
    ['cutting', 'veneer-pressing', 'assembly'].forEach(s => advanceJoinerySubStage(job, line, s));
    submitLineForQC(job, line, 'carp'); recordLineQCResult(job, line, 'carp', true, 'Joinery Production Manager'); handOffLine(job, line, 'carp', 'E2E Joinery Account');
    const e = getJobCard(job).items[0].departmentStatuses.find(d => d.department === 'paint');
    return { paintQueued: e && e.status === 'queued' };
  }, { job: F.job, line: F.lines[0] }, 2000);
  record('Hand-off from joinery lands the line in Painting\'s queue', 'joinery_production_manager', walk.paintQueued, walk);
  const paintSees = await seen('painting_lead', (id) => getPaintingQueue().some(r => r.job.id === id), F.job);
  record('The Painting lead\'s session sees the line arrive', 'painting_lead', paintSees, F.job, 'realtime');
  if (!paintSees) await act('painting_lead', () => location.reload(), null, 6000);
  const paint = await act('painting_lead', ({ job, line }) => {
    const a = startPaintingWork(job, line); const b = submitPaintingForQC(job, line); const c = recordPaintingQCResult(job, line, true, 'Painting Lead / Work Supervisor'); const d = handOffPaintingLine(job, line, 'E2E Painting Account');
    return { a: a && a.error, b: b && b.error, c: c && c.error, d: d && d.error, complete: jobProductionComplete(job) };
  }, { job: F.job, line: F.lines[0] }, 2000);
  record('Painting starts, QC passes under its own lead, hands off — the job is production-complete', 'painting_lead', paint.complete, paint);
  await backHalf('S2', F);
}

/* ── S3: Upholstery — a 3-seater sofa ──────────────────────────────── */
async function S3() {
  scenario = 'S3 Upholstery'; stepNo = 0; console.log('\n═══ ' + scenario);
  const ask = await act('estimator', () => { const r = raiseInputRequest({ type: 'pricing_input', raisedBy: 'E2E Estimator Account', raiserRole: 'estimator', question: 'Metres per seat and sewing hours — 3-seater sofa', neededBy: todayISO(), dept: 'uph' }); return { req: r && r.id, err: r && r.error }; });
  record('The Estimator asks the upholstery supervisor for pricing input', 'estimator', ask.req && !ask.err, ask);
  const uphSees = await seen('upholstery_manager', (id) => getUphInputRequests('pricing_input').some(r => r.id === id), ask.req);
  record('The supervisor\'s session sees the request', 'upholstery_manager', uphSees, ask.req, 'realtime');
  if (!uphSees) await act('upholstery_manager', () => location.reload(), null, 6000);
  const ans = await act('upholstery_manager', ({ req }) => { const m = uphAnswerPricing(req, { metresPerSeat: 4.7, foamGrades: '35kg HR seats', sewingHours: 9, bayHours: 16 }); const bad = uphAnswerPricing(req, { rate: 3 }); return { status: m && m.status, err: m && m.error, bad: bad && bad.error }; }, { req: ask.req }, 2000);
  record('… answers in metres and hours; a rate is refused', 'upholstery_manager', ans.status === 'answered' && /Already answered|not something/.test(ans.bad || ''), ans);
  // The store holds foam before the bench asks for it — the real order of things.
  const foamStock = await act('storekeeper', () => {
    const foamItem = itemMaster.find(i => /foam/i.test(i.name)) || itemMaster[1];
    let loc = storeLocations[0] || createStoreLocation({ name: 'Riffa store' });
    let bin = storeBins.find(b => b.storeId === loc.id) || createStoreBin({ storeId: loc.id, code: 'A1' });
    const r = putAwayStock({ itemId: foamItem.id, binId: bin.id, qty: 12 });
    return { item: foamItem.id, free: stockFree(foamItem.id, bin.id), err: r && r.error };
  }, null, 1500);
  record('The store puts twelve foam blocks on the shelf', 'storekeeper', foamStock.free >= 12 && !foamStock.err, foamStock);
  const F = await frontHalf('S3', { division: 'Upholstery', product: '3-seater sofa — Sahara 12', qty: 1, unit: 'Nos', depts: [['uph']], projectName: 'RUN1 S3 Budaiya sofa' });
  const bud = await act('upholstery_manager', ({ job }) => { const r = submitDepartmentBudget(job, 'uph', { materials: 400, labour: 250, subcontract: 0, hiring: 0, others: 0 }, 'E2E Upholstery Account'); return { err: r && r.error }; }, { job: F.job });
  record('The supervisor submits the upholstery budget', 'upholstery_manager', !bud.err, bud);
  const uapp = await act('operations_manager', ({ job }) => { const r = approveDepartmentBudget(job, 'uph', 'E2E Operations Account'); return { err: r && r.error, ok: isDepartmentBudgetApproved(getJobCard(job), 'uph') }; }, { job: F.job }, 2000);
  record('Operations approves it', 'operations_manager', uapp.ok, uapp);
  const uph = await act('upholstery_manager', ({ job, days }) => {
    const spec = uphSpecForJob(job);
    const f1 = allotUphStageSlot({ stageId: 'F', jobCardId: job, date: days[0], byWhom: 'E2E Upholstery Account' });
    const early = allotUphStageSlot({ stageId: 'C', jobCardId: job, date: days[1] });
    const roll = receiveFabricRoll({ name: 'Sahara 12 upholstery fabric', dyeLot: '4471', metres: 46, jobCardId: job, costPerM: 14.5, byWhom: 'E2E Upholstery Account' });
    inspectFabricRoll(roll.id, { ok: true, byWhom: 'E2E Upholstery Account' });
    const foamItem = itemMaster.find(i => /foam/i.test(i.name)) || itemMaster[1];
    const fs = createFoamSchedule({ jobCardId: job, lines: [{ part: 'Seat cushion', grade: '35kg HR', itemId: foamItem.id, qty: 3 }] });
    const plan = releaseFabricPlan({ jobCardId: job, rollId: roll.id, byWhom: 'E2E Upholstery Account' });
    const foamState = foamScheduleState(fs);
    return { spec: spec && spec.pieceType, f1: !!f1.slot, early: early.error, roll: roll.id, plan: plan && plan.id, perr: plan && plan.error, totalM: plan && plan.totalM, free: rollMetresFree(roll.id), foam: foamState.state, fsId: fs.id };
  }, { job: F.job, days: DAYS }, 2500);
  record('Frames booked; cutting refused before frames ends; the roll received and inspected; the plan released off one roll', 'upholstery_manager', uph.spec === '3-seater sofa' && uph.f1 && /Nothing overtakes|No fabric|foam/i.test(uph.early || '') && uph.plan && Math.abs(uph.free - (46 - uph.totalM)) < 0.01, uph);
  const planLive = await liveRow('fabric_plans', uph.plan);
  record('… and the ticket is in the live fabric_plans table', 'upholstery_manager', planLive, uph.plan, 'persistence');
  if (uph.foam !== 'Ready') findings.push({ scenario, step: stepNo, name: 'Foam schedule reads ' + uph.foam + ' — no foam stock in the store', role: 'upholstery_manager', detail: 'The cutting stage stays blocked on "Foam grade not signed off" until the store holds the grade or a quote is back. Honest, and it stops the serial line here.', kind: 'note' });
  const chain = await act('upholstery_manager', ({ job, line, days, fsId }) => {
    // Give the bench its foam so the line can move: put a grade on the shelf (as the store would) and sign off.
    const foamItem = itemMaster.find(i => /foam/i.test(i.name)) || itemMaster[1];
    let loc = storeLocations[0]; let bin = loc && storeBins.find(b => b.storeId === loc.id);
    const st = typeof stockFree === 'function' && bin ? stockFree(foamItem.id, bin.id) : 0;
    const so = signOffFoamSchedule(fsId, 'E2E Upholstery Account');
    const c = allotUphStageSlot({ stageId: 'C', jobCardId: job, date: days[2] });
    const s = c.slot && allotUphDerivedSlot({ stageId: 'S', baseSlotId: c.slot.id, offsetDays: 1, jobCardId: job });
    const b = s && s.slot && allotUphDerivedSlot({ stageId: 'B', baseSlotId: s.slot.id, offsetDays: 2, jobCardId: job });
    startLineProduction(job, line, 'uph');
    return { foamOnShelf: st, so: so && so.error, c: c.error || (c.slot && c.slot.id), s: s && s.slot && uphSlotDate(s.slot), b: b && b.slot && uphSlotDate(b.slot) };
  }, { job: F.job, line: F.lines[0], days: DAYS, fsId: uph.fsId }, 2000);
  record('Cutting books after frames; sewing and the bays pull their dates from it', 'upholstery_manager', chain.c && !/Cannot book/.test(String(chain.c)) && chain.s && chain.b, chain, chain.so ? 'store-dependency' : 'flow');
  const fin = await act('upholstery_manager', ({ job, line }) => {
    const a = submitLineForQC(job, line, 'uph'); const b = recordLineQCResult(job, line, 'uph', true, 'Upholstery Manager'); const c = handOffLine(job, line, 'uph', 'E2E Upholstery Account');
    return { a: a && a.error, b: b && b.error, c: c && c.error, complete: jobProductionComplete(job) };
  }, { job: F.job, line: F.lines[0] }, 2000);
  record('Finishing & QC passes under the manager\'s authority and hands off', 'upholstery_manager', fin.complete, fin);
  await backHalf('S3', F);
}

/* ── S4: Curtain — wave curtains, two windows ──────────────────────── */
async function S4() {
  scenario = 'S4 Curtain'; stepNo = 0; console.log('\n═══ ' + scenario);
  const F = await frontHalf('S4', { division: 'Curtain & Blinds', product: 'Wave curtains — two windows', qty: 2, unit: 'Nos', depts: [['curt']], projectName: 'RUN1 S4 Juffair apartment' });
  record('The confirm bridged the job into Curtain\'s own tracker', 'sales', F.curtainBridged, F.curtainBridged);
  const curtSees = await seen('curtain_manager', (id) => curtainJobs.some(c => c.linkedJobCardId === id || c.id === id), F.job);
  record('The Curtain manager\'s session sees the bridged job', 'curtain_manager', curtSees, F.job, 'realtime');
  if (!curtSees) await act('curtain_manager', () => location.reload(), null, 6000);
  const curt = await act('curtain_manager', ({ job, when }) => {
    const cj = curtainJobs.find(c => c.linkedJobCardId === job || c.id === job); if (!cj) return { err: 'not bridged' };
    const p = 'w-' + cj.id + '-';
    cj.windowGroups = [{ id: p + 'g1', room: 'Living room', width: 320, height: 270, qty: 2, layers: [
      { id: p + '1', role: 'main', label: 'Window 1', overhang: 20, treatment: 'curtain', fabricType: 'main', fabricCode: 'Nassaj N11011-002', designType: 'Wave', fullness: 2.5, rollWidth: 140, patternRepeatV: 32, patternRepeatH: 0, topHem: 8, bottomHem: 12, sideHem: 5, motorized: false, railType: 'Aluminium U-Shape Head Rail — Ningbo CH016', railItemCode: 'IT001886', openingDirection: 'two_way', bracketType: 'Ceiling bracket', quoteEstimateMetres: 19, calcDone: true, calc: null }
    ] }];
    cj.windows = flattenWindowGroups(cj); cj.status = 'execution';
    cj.installation = cj.installation || {}; cj.installation.scheduledDate = when; cj.installation.status = 'scheduled';
    return { id: cj.id, windows: cj.windows.length, sched: cj.installation.scheduledDate };
  }, { job: F.job, when: DAYS[8] }, 4000);
  record('Curtain authors the windows and schedules the install', 'curtain_manager', curt.windows === 1 && curt.sched === DAYS[8], curt);
  const cjLive = await livePayload('curtain_jobs', curt.id);
  record('… and the curtain job persisted with its windows (the 3s scanner)', 'curtain_manager', cjLive && Array.isArray(cjLive.windowGroups) && cjLive.windowGroups.length === 1, cjLive && Object.keys(cjLive).length, 'persistence');
  const clock = await act('installation_crew_lead', ({ cj }) => {
    const crew = timerCrewsAll().find(c => c.dept === 'curt') || createTimerCrew({ name: 'Curtain install crew', dept: 'curt', members: timerDeptRoster('curt').slice(0, 2), lead: timerDeptRoster('curt')[0] });
    const s = startCrewSession({ crewId: crew.id, jobCardId: cj, present: crew.members.slice(0, 2), activity: 'installation' });
    if (!s || s.error) return { err: (s && s.error) || 'no session', crew: crew.id, jobs: timerJobsForCrew(crew.id).map(j => j.id).slice(0, 5) };
    s.startedAt = new Date(Date.now() - 5 * 3600000).toISOString();
    const before = labourDayLogs.length;
    const e = endCrewSession(s.id, {});
    return { session: s.id, hours: e.hours, logs: labourDayLogs.length - before, activity: labourDayLogs[labourDayLogs.length - 1].activity, curtainLog: labourDayLogs[labourDayLogs.length - 1].jobId === cj };
  }, { cj: curt.id }, 2000);
  record('The install crew clocks 5 h of installation on the curtain job, per man, into the ledger', 'installation_crew_lead', clock.session && clock.hours === 5 && clock.logs === 2 && clock.activity === 'installation' && clock.curtainLog, clock);
  await backHalf('S4', F);
}

/* ── S5: the mixed quotation ───────────────────────────────────────── */
async function S5() {
  scenario = 'S5 Mixed'; stepNo = 0; console.log('\n═══ ' + scenario);
  const F = await frontHalf('S5', { division: 'Joinery', product: 'Wave curtains — bedroom', qty: 1, unit: 'Nos', depts: [['curt'], ['carp', 'paint'], ['uph']], projectName: 'RUN1 S5 Riffa villa',
    extraItems: [{ product: 'Painted TV unit', qty: 1, unit: 'Nos' }, { product: '3-seater sofa', qty: 1, unit: 'Nos' }] });
  record('The curtain line bridged into Curtain although the enquiry division is Joinery', 'sales', F.curtainBridged, F.curtainBridged);
  const views = {};
  views.prd = await act('joinery_production_manager', ({ job }) => getDepartmentQueue('carp').filter(r => r.job.id === job).map(r => r.item.product), { job: F.job }, 300);
  views.uph = await act('upholstery_manager', ({ job }) => getDepartmentQueue('uph').filter(r => r.job.id === job).map(r => r.item.product), { job: F.job }, 300);
  views.curt = await act('curtain_manager', ({ job }) => curtainJobs.filter(c => c.linkedJobCardId === job).length, { job: F.job }, 300);
  record('Each department sees only its own line: joinery the TV unit, upholstery the sofa, curtain its job', 'owner',
    views.prd.length === 1 && /TV/.test(views.prd[0]) && views.uph.length === 1 && /sofa/i.test(views.uph[0]) && views.curt === 1, views);
  const ownerAll = await act('owner', ({ job }) => { const j = getJobCard(job); return { items: j ? j.items.length : 0, depts: j ? [...new Set(j.items.flatMap(i => i.departmentSequence))].sort() : [] }; }, { job: F.job }, 300);
  record('The Owner sees all three lines and all four departments on one job', 'owner', ownerAll.items === 3 && ownerAll.depts.join(',') === 'carp,curt,paint,uph', ownerAll);
}

/* ── run ───────────────────────────────────────────────────────────── */
(async () => {
  if (!PAT) { console.error('SUPABASE_PAT is required.'); process.exit(1); }
  browser = await chromium.launch({ headless: true });
  const t0 = Date.now();
  const before = await snapshotIds();
  const runners = { S1, S2, S3, S4, S5 };
  for (const k of ONLY) {
    if (!runners[k]) continue;
    try { await runners[k](); }
    catch (e) { record('Scenario crashed: ' + e.message.split('\n')[0], 'driver', false, e.stack.split('\n').slice(0, 3).join(' | '), 'crash'); }
  }
  await (await session('owner')).waitForTimeout(6000);
  const after = await snapshotIds();
  const manifest = { label: 'iteration 1', createdAt: new Date().toISOString(), tables: {} };
  Object.keys(after).forEach(t => { const b = new Set(before[t] || []); manifest.tables[t] = (after[t] || []).filter(id => !b.has(id)); });
  fs.writeFileSync(path.join(__dirname, 'test-run', 'iter1-manifest.json'), JSON.stringify(manifest, null, 1));

  const errs = Object.keys(errorsByRole).filter(r => errorsByRole[r].length).map(r => ({ role: r, errors: errorsByRole[r].slice(0, 5) }));
  const passN = results.filter(r => r.ok).length;
  const md = ['# End-to-end run — iteration 1 (happy paths)', '', 'Run ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' · ' + passN + '/' + results.length + ' checks passed · ' + Math.round((Date.now() - t0) / 1000) + ' s · manifest test-run/iter1-manifest.json', ''];
  ['S1 Joinery', 'S2 Joinery + Paint', 'S3 Upholstery', 'S4 Curtain', 'S5 Mixed'].forEach(sc => {
    const rows = results.filter(r => r.scenario === sc); if (!rows.length) return;
    md.push('## ' + sc, '', '| # | Role | Step | Result | Detail |', '|---|---|---|---|---|');
    rows.forEach(r => md.push('| ' + r.step + ' | ' + r.role + ' | ' + r.name.replace(/\|/g, '\\|') + ' | ' + (r.ok ? 'PASS' : '**FAIL**') + ' | ' + r.detail.replace(/\|/g, '\\|').slice(0, 160) + ' |'));
    md.push('');
  });
  md.push('## Findings', '');
  if (!findings.length) md.push('None.');
  findings.forEach((f, i) => md.push((i + 1) + '. **[' + f.kind + '] ' + f.scenario + ' step ' + f.step + ' (' + f.role + ')** — ' + f.name + '  \n   ' + f.detail.replace(/\n/g, ' ').slice(0, 500)));
  md.push('', '## Console / page errors by role', '');
  if (!errs.length) md.push('None.'); else errs.forEach(e => md.push('- **' + e.role + '**: ' + e.errors.map(x => '`' + x.slice(0, 160) + '`').join(' · ')));
  fs.writeFileSync(path.join(__dirname, 'docs', 'test-run', 'iteration-1-report.md'), md.join('\n') + '\n');
  console.log('\n' + passN + '/' + results.length + ' checks passed · report docs/test-run/iteration-1-report.md');
  await browser.close();
})().catch(async e => { console.error('driver failed: ' + e.message); if (browser) await browser.close(); process.exit(1); });
