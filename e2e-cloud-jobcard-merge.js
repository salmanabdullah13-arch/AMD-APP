/**
 * e2e-cloud-jobcard-merge.js — LIVE. Finding F10 of the end-to-end run.
 *
 * Two roles write to ONE job card at the same moment: Operations moves a
 * line's status (the `items` column) and Accounts, holding a copy that is
 * a few hundred milliseconds stale, raises an invoice (`linked_invoice_ids`).
 * Before the fix every write sent the whole row, so whichever landed second
 * put the other role's column back — in the run it was a delivered quantity
 * going back to zero. Now a write sends only the columns that changed
 * against the last server copy, a realtime row never replaces a job card
 * with unpersisted edits, and the columns the other role changed are merged
 * onto the local job once the write completes.
 *
 * The first cut of the fix diffed against a base that SHARED the local
 * job's arrays (jobCardRowToObj hands them straight through), so every
 * nested edit read as "no change" and routing dropped its lines. The last
 * two checks here exist for that specifically.
 *
 *   SUPABASE_PAT is NOT needed — every read goes through a signed-in session.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const PASSWORD = 'E2eFixedTestPassword1234!';
const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').split('\\').join('/') + '?test_cloud_login=1';
let pass = 0, fail = 0; const errors = [];
function check(name, ok, detail) { if (ok) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); } }
async function login(browser, name, role) {
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(role + ': ' + e.message));
  await p.goto(fileUrl); await p.waitForFunction(() => { const s = document.getElementById('auth-identity-select'); return s && s.options.length > 1; }, { timeout: 20000 });
  await p.selectOption('#auth-identity-select', name); await p.fill('#auth-password-input', PASSWORD); await p.click('#cloud-login-body button[onclick="handleSignIn()"]');
  await p.waitForFunction((r) => window.__realCloudSession === true && window.cloudUserType === r, role, { timeout: 25000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => { if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; });
  return p;
}
// What a session holds locally, what it thinks the server holds, and what the server actually holds.
const view = (p, jid) => p.evaluate(async (jid) => {
  const job = getJobCard(jid); if (!job) return { present: false };
  const base = cloudJobCardRows[jid];
  const dirty = base ? Object.keys(jobCardRowDiff(jobCardObjToRow(job), base)) : 'no-base';
  const { data } = await sb.from('job_cards').select('items, linked_invoice_ids, department_budgets, routing_confirmed').eq('id', jid).single();
  const st = (items) => ((items[0] || {}).departmentStatuses || []).map(d => d.status).join(',');
  return { present: true, dirty, local: { status: st(job.items), invoices: (job.linkedInvoiceIds || []).length, budgets: Object.keys(job.departmentBudgets || {}) },
    server: { status: st(data.items), invoices: (data.linked_invoice_ids || []).length, budgets: Object.keys(data.department_budgets || {}), routed: data.routing_confirmed } };
}, jid);
(async () => {
  const browser = await chromium.launch({ headless: true });
  const sales = await login(browser, 'E2E Test Account', 'sales');
  const ops = await login(browser, 'E2E Operations Account', 'operations_manager');
  const accounts = await login(browser, 'E2E Accounts Account', 'accounts');
  const stamp = Date.now();

  const job = await sales.evaluate(async (stamp) => {
    const gap = (ms) => new Promise(r => setTimeout(r, ms));
    const c = createCustomer({ name: 'RUN1 F10 ' + stamp, contactPerson: 'A', tel: '35' + String(stamp).slice(-6), address: 'Juffair' }); await gap(1500);
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'E2E Test Account' }); await gap(1500);
    const q = convertEnquiryToQuotation(e.id, { projectName: 'RUN1 F10 ' + stamp, taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'F10 wardrobe', qty: 2, unit: 'Nos' });
    const it = quotations.find(x => x.id === q.id).items[0];
    addBOMMaterial(q.id, it.lineId, { name: itemMaster[0].name, qty: 2, rate: 20, unit: itemMaster[0].unit }); submitItemBOM(q.id, it.lineId, 'E2E Test Account');
    setItemDepartmentSequence(q.id, it.lineId, ['carp']);
    transferQuotationStage(q.id, 'approver', 'Estimator'); approveQuotation(q.id, 'E2E Test Account', 'owner'); await gap(2000);
    const j = confirmQuotationToJobCard(q.id, 'E2E Test Account');
    return { id: j.id, line: j.items[0].lineId };
  }, stamp);
  check('Sales confirmed a joinery job', !!job.id, job);
  await ops.waitForTimeout(3000);

  // Routing writes THREE nested columns at once — the case the aliasing bug dropped.
  const routed = await ops.evaluate((jid) => { const r = confirmJobRouting(jid, {}, 'E2E Operations Account'); return r && r.error ? r.error : 'ok'; }, job.id);
  check('Operations routes the job', routed === 'ok', routed);
  await ops.waitForTimeout(3000);
  const afterRoute = await accounts.evaluate(async (jid) => { const { data } = await sb.from('job_cards').select('items, department_budgets').eq('id', jid).single(); return { status: ((data.items[0] || {}).departmentStatuses || []).map(d => d.status).join(','), budgets: Object.keys(data.department_budgets || {}) }; }, job.id);
  check('the routed line AND the budget slot both reached the live row (nested columns diff against a deep-copied base)', afterRoute.status === 'queued' && afterRoute.budgets.join() === 'carp', afterRoute);
  const opsClean = await view(ops, job.id);
  check('the routing session reads clean against the server afterwards — nothing left unpersisted', Array.isArray(opsClean.dirty) && opsClean.dirty.length === 0, opsClean);

  // The race: Operations moves the line while Accounts, 150 ms behind, invoices off its stale copy.
  const opsWrite = ops.evaluate(({ jid, line }) => { const r = updateJobLineStatus(jid, line, 'carp', 'in-production'); return r && r.error ? r.error : 'ok'; }, { jid: job.id, line: job.line });
  await accounts.waitForTimeout(150);
  const accWrite = accounts.evaluate((jid) => { const r = generateInvoiceFromJob(jid, { invoicedPercent: 50 }); return r && r.error ? r.error : (r && r.id) || 'no id'; }, job.id);
  const [o, a] = await Promise.all([opsWrite, accWrite]);
  check('both writes were accepted locally', o === 'ok' && /^IN/.test(a), { o, a });
  await ops.waitForTimeout(6000);

  const srv = await view(sales, job.id);
  check('the live row holds BOTH — the line moved by Operations and the invoice raised by Accounts', srv.server.status === 'in-production' && srv.server.invoices === 1, srv.server);
  const accV = await view(accounts, job.id);
  check("Accounts' own session now also holds Operations' line move (merged back after its write, not lost)", accV.local.status === 'in-production' && accV.local.invoices === 1, accV.local);
  const opsV = await view(ops, job.id);
  check("Operations' session holds the invoice Accounts raised", opsV.local.invoices === 1 && opsV.local.status === 'in-production', opsV.local);
  check('no session is left dirty against the server', [srv, accV, opsV].every(v => Array.isArray(v.dirty) && v.dirty.length === 0), { s: srv.dirty, a: accV.dirty, o: opsV.dirty });
  const fresh = await login(browser, 'E2E Approver Account', 'owner');
  const fv = await view(fresh, job.id);
  check('a session logging in afterwards hydrates both', fv.local.status === 'in-production' && fv.local.invoices === 1, fv.local);

  // ── The same class on quotations (iteration 2, X4): the Estimator's five
  // queued writes must not drain over the Approver's approval 1.5 s later.
  const est = await login(browser, 'E2E Estimator Account', 'estimator');
  const appr = await login(browser, 'E2E Approver Role Account', 'approver');
  const q2 = await sales.evaluate(async (stamp) => {
    const gap = (ms) => new Promise(r => setTimeout(r, ms));
    const c = customers.find(x => x.name === 'RUN1 F10 ' + stamp);
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'E2E Test Account' }); await gap(1500);
    const q = convertEnquiryToQuotation(e.id, { projectName: 'RUN1 F10 race ' + stamp, taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'F10 sideboard', qty: 1, unit: 'Nos' });
    transferQuotationStage(q.id, 'estimator', 'E2E Test Account');
    return { id: q.id, line: quotations.find(x => x.id === q.id).items[0].lineId };
  }, stamp);
  const arrived = await est.evaluate(async (id) => { const t0 = Date.now(); while (Date.now() - t0 < 15000 && !quotations.some(q => q.id === id && q.stage === 'estimator')) await new Promise(r => setTimeout(r, 100)); return quotations.some(q => q.id === id && q.stage === 'estimator'); }, q2.id);
  check('a second quotation reached the Estimator', arrived, q2);
  const estWrites = await est.evaluate(({ id, line }) => {
    addBOMMaterial(id, line, { name: itemMaster[0].name, qty: 3, rate: 40, unit: itemMaster[0].unit });
    addBOMLabour(id, line, { department: 'carp', description: 'Build', noOfPpl: 1, qty: 2, rate: 3, calcMode: 'days' });
    submitItemBOM(id, line, 'E2E Estimator Account'); setItemDepartmentSequence(id, line, ['carp']);
    const t = transferQuotationStage(id, 'approver', 'E2E Estimator Account'); return t && t.error ? t.error : 'ok';
  }, q2);
  check('the Estimator costs, routes and transfers in one burst (five queued writes)', estWrites === 'ok', estWrites);
  await appr.waitForTimeout(1500);
  const approved = await appr.evaluate((id) => { const r = approveQuotation(id, 'E2E Approver Role Account', 'approver'); return r && r.error ? r.error : 'ok'; }, q2.id);
  check('the Approver approves 1.5 s behind the burst', approved === 'ok', approved);
  await appr.waitForTimeout(7000);
  const qLive = await sales.evaluate(async (id) => { const { data } = await sb.from('quotations').select('stage, lifecycle_status').eq('id', id).single(); const loc = (p) => { const q = p.find(x => x.id === id); return q && q.stage + '/' + q.lifecycleStatus; }; return { server: data.stage + '/' + data.lifecycle_status, sales: loc(quotations) }; }, q2.id);
  const qEst = await est.evaluate((id) => { const q = quotations.find(x => x.id === id); return q && q.stage + '/' + q.lifecycleStatus; }, q2.id);
  const qBom = await appr.evaluate(async (id) => { const { data } = await sb.from('quotations').select('items').eq('id', id).single(); const it = data.items[0]; return { bom: !!(it.bom && it.bom.materials && it.bom.materials.length), route: (it.departmentSequence || []).join() }; }, q2.id);
  check('the live row holds the approval — the queued Estimator writes did not drain over it', qLive.server === 'sales/open', qLive);
  check("… and the Estimator's own BOM and routing are on the row too (nothing of theirs lost)", qBom.bom && qBom.route === 'carp', qBom);
  check("the Estimator's session shows the approval (its queue emptied, the remote row applied)", qEst === 'sales/open', qEst);

  await sales.evaluate((jid) => { try { setJobStatus(jid, 'cancelled'); } catch (e) {} }, job.id);
  check('zero page errors across the sessions', errors.length === 0, errors.slice(0, 3));
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
