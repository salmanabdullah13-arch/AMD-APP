/**
 * run-lib.js — what every iteration of the end-to-end run shares: one
 * signed-in session per role against the live project, steps run as the
 * role that does them, live-row checks over the Management API, realtime
 * "the next role sees it" checks, the front half of every scenario (Sales →
 * Estimator → Approver → confirm → Operations routes), screenshots, the
 * report and the manifest for clear-run-manifest.js.
 *
 *   const run = require('./run-lib')({ label: 'iteration 2', dir: 'iter2', report: 'iteration-2-report.md' });
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const https = require('https');

const REF = 'rwbxycxrrslgxskoufxo';
const PASSWORD = 'E2eFixedTestPassword1234!';
const ROLES = {
  sales: 'E2E Test Account', estimator: 'E2E Estimator Account', approver: 'E2E Approver Role Account',
  operations_manager: 'E2E Operations Account', purchaser: 'E2E Purchaser Account', storekeeper: 'E2E Storekeeper Account',
  accounts: 'E2E Accounts Account', joinery_production_manager: 'E2E Joinery Account', upholstery_manager: 'E2E Upholstery Account',
  painting_lead: 'E2E Painting Account', curtain_manager: 'E2E Curtain Account', installation_crew_lead: 'E2E Install Lead Account',
  delivery_scheduling: 'E2E Delivery Account', owner: 'E2E Approver Account', admin: 'E2E Admin Account', hr: 'E2E HR Account'
};
const localISO = (d) => { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return localISO(d); };
function workdays(n) { const out = []; let d = localISO(new Date()); while (out.length < n) { d = addDays(d, 1); const wd = new Date(d + 'T00:00:00').getDay(); if (wd !== 5 && wd !== 6) out.push(d); } return out; }

module.exports = function createRun({ label, dir, report }) {
  const PAT = process.env.SUPABASE_PAT;
  const root = __dirname;
  const fileUrl = 'file://' + path.resolve(root, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';
  const OUT = path.join(root, 'test-run', dir);
  fs.mkdirSync(OUT, { recursive: true });
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

  const results = [], findings = [], errorsByRole = {};
  let scenario = '', stepNo = 0;
  function setScenario(name) { scenario = name; stepNo = 0; console.log('\n═══ ' + name); }
  function record(name, role, ok, detail, kind) {
    const dtxt = detail === undefined ? '' : (typeof detail === 'string' ? detail : (JSON.stringify(detail) || String(detail)));
    results.push({ scenario, step: ++stepNo, name, role, ok: !!ok, detail: dtxt.slice(0, 400) });
    console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  [' + role + '] ' + name + (ok ? '' : '  → ' + dtxt.slice(0, 300)));
    if (!ok) findings.push({ scenario, step: stepNo, name, role, detail: dtxt, kind: kind || 'flow' });
  }
  function note(name, role, detail, kind) { findings.push({ scenario, step: stepNo, name, role, detail, kind: kind || 'note' }); console.log('  NOTE  [' + role + '] ' + name); }

  let browser; const sessions = {};
  async function session(role) {
    if (sessions[role]) return sessions[role].page;
    if (!browser) browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    errorsByRole[role] = [];
    page.on('pageerror', e => errorsByRole[role].push(e.message));
    page.on('console', m => { if (m.type() === 'error') errorsByRole[role].push(m.text()); });
    page.on('response', r => { if ([400, 401, 403, 404, 409, 422].includes(r.status())) errorsByRole[role].push('HTTP ' + r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/^https:\/\/[^/]+/, '').slice(0, 120)); });
    page.on('dialog', d => d.accept());
    // A persist that fails surfaces only as an on-screen toast — capture it, or a dropped write reads as a logic bug.
    await page.exposeFunction('__runToast', (m) => errorsByRole[role].push('TOAST ' + String(m).slice(0, 160)));
    await page.goto(fileUrl);
    await page.waitForFunction(() => { const s = document.getElementById('auth-identity-select'); return s && s.options.length > 1; }, { timeout: 20000 }).catch(() => null);
    await page.selectOption('#auth-identity-select', ROLES[role]);
    await page.fill('#auth-password-input', PASSWORD);
    await page.click('#cloud-login-body button[onclick="handleSignIn()"]');
    await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none' && window.__realCloudSession === true, { timeout: 25000 }).catch(() => null);
    const ok = await page.evaluate((r) => window.__realCloudSession === true && window.cloudUserType === r, role);
    if (!ok) throw new Error('could not sign in as ' + role + ' (' + ROLES[role] + ')');
    await page.waitForTimeout(3500);
    await page.evaluate(() => { if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; const o = window.commsToast; window.commsToast = (m) => { try { window.__runToast(String(m)); } catch (e) {} return typeof o === 'function' ? o(m) : undefined; };
      window.__qwrites = []; const pq = window.persistQuotationUpdate;
      window.persistQuotationUpdate = function (q) { window.__qwrites.push({ id: q.id, stage: q.stage, lc: q.lifecycleStatus, t: new Date().toISOString().slice(11, 23) }); return pq(q); }; });
    sessions[role] = { ctx, page };
    return page;
  }
  async function act(role, fn, arg, gapMs) { const page = await session(role); const r = await page.evaluate(fn, arg); await page.waitForTimeout(gapMs === undefined ? 1200 : gapMs); return r; }
  async function seen(role, fn, arg, timeout) { const page = await session(role); try { await page.waitForFunction(fn, arg, { timeout: timeout || 15000 }); return true; } catch (e) { return false; } }
  async function fresh(role) {
    // A brand-new session for the same role: what a reload sees.
    if (sessions[role]) { await sessions[role].ctx.close(); delete sessions[role]; }
    return session(role);
  }
  // Which sessions wrote a given quotation, in what state, when — for attributing an overwrite.
  async function quotationWrites(id) {
    const out = {};
    for (const role of Object.keys(sessions)) { out[role] = await sessions[role].page.evaluate((id) => (window.__qwrites || []).filter(w => w.id === id), id).catch(() => 'n/a'); }
    return out;
  }
  // A page at the app URL with NO login — for attacks that sign in through the API as an account the UI would turn away.
  async function rawPage() {
    if (!browser) browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.goto(fileUrl);
    await page.waitForFunction(() => typeof sb !== 'undefined' && !!sb, { timeout: 20000 });
    return page;
  }
  async function shot(role, name) { const page = await session(role); await page.screenshot({ path: path.join(OUT, name + '.png') }).catch(() => null); }
  async function snapshotIds() {
    return act('owner', () => {
      const out = {};
      (CLOUD_JSON_COLLECTIONS || []).forEach(c => { try { out[c.table] = c.arr().map(r => r.id); } catch (e) { out[c.table] = []; } });
      out.customers = customers.map(c => c.id); out.enquiries = enquiries.map(e => e.id); out.quotations = quotations.map(q => q.id);
      out.job_cards = jobCards.map(j => j.id); out.curtain_jobs = (typeof curtainJobs !== 'undefined' ? curtainJobs : []).map(j => j.id);
      return out;
    }, null, 0);
  }

  /* The front half every scenario shares. opts: { division, product, qty, unit, depts, projectName, extraItems, approveAs, stopAfter } */
  async function frontHalf(tag, o) {
    const sales = await act('sales', ({ tag, stamp }) => { const c = createCustomer({ name: 'RUN1 ' + tag + ' ' + stamp, contactPerson: 'Site contact', tel: '39' + String(stamp).slice(-6) + tag.replace(/\D/g, '').slice(0, 2), address: 'Budaiya' }); return { customer: c.id, err: c.error }; }, { tag, stamp: STAMP }, 1500);
    record('Sales creates the customer', 'sales', sales.customer && !sales.err, sales);
    const enq = await act('sales', ({ customer, division }) => { const e = createEnquiry({ division, customerId: customer, contactPerson: 'Site contact', tel: '39000000', source: 'walk inn', salesPerson: 'E2E Test Account' }); return { enquiry: e.id, err: e.error }; }, { customer: sales.customer, division: o.division }, 1500);
    record('Sales creates the enquiry', 'sales', enq.enquiry && !enq.err, enq);
    const qtn = await act('sales', ({ enquiry, product, qty, unit, projectName, extraItems }) => {
      const q = convertEnquiryToQuotation(enquiry, { projectName, taxPercent: 10, contactPerson: 'Site contact' });
      addQuotationItem(q.id, { product, qty, unit, group: 'Main', subgroup: 'Room 1' });
      (extraItems || []).forEach(it => addQuotationItem(q.id, { product: it.product, qty: it.qty, unit: it.unit, group: 'Main', subgroup: 'Room 1' }));
      const qq = quotations.find(x => x.id === q.id);
      return { quotation: q.id, lines: qq.items.map(i => i.lineId), rate0: qq.items.every(i => !i.rate) };
    }, { enquiry: enq.enquiry, product: o.product, qty: o.qty, unit: o.unit, projectName: o.projectName, extraItems: o.extraItems }, 1500);
    record('Sales builds the quotation — every rate locked at zero', 'sales', qtn.quotation && qtn.rate0, qtn);
    const toEst = await act('sales', ({ quotation }) => { const r = transferQuotationStage(quotation, 'estimator', 'E2E Test Account'); return { err: r && r.error, stage: quotations.find(q => q.id === quotation).stage }; }, { quotation: qtn.quotation });
    record('Sales transfers to the Estimator', 'sales', toEst.stage === 'estimator' && !toEst.err, toEst);
    const estSees = await seen('estimator', (id) => quotations.some(q => q.id === id && q.stage === 'estimator'), qtn.quotation);
    record('The Estimator sees it arrive', 'estimator', estSees, qtn.quotation, 'realtime');
    if (!estSees) await act('estimator', () => location.reload(), null, 6000);
    const est = await act('estimator', ({ quotation, depts, matRate, matQty, matIndex }) => {
      const q = quotations.find(x => x.id === quotation); if (!q) return { err: 'not in session' };
      const out = [];
      q.items.forEach((it, i) => {
        const mat = matIndex !== undefined ? itemMaster[matIndex] : (itemMaster.find(m => /mdf|board|ply/i.test(m.name)) || itemMaster[0]);
        const r1 = addBOMMaterial(quotation, it.lineId, { name: mat.name, qty: matQty || 4, rate: matRate || mat.cost || mat.lastPurchaseRate || 12, unit: mat.unit });
        const r2 = addBOMLabour(quotation, it.lineId, { department: (depts[i] || depts[0])[0], description: 'Make', noOfPpl: 2, qty: 3, rate: 3.5, calcMode: 'days' });
        const s = submitItemBOM(quotation, it.lineId, 'E2E Estimator Account');
        const d = setItemDepartmentSequence(quotation, it.lineId, depts[i] || depts[0]);
        out.push({ line: it.lineId, ok: !(r1 && r1.error) && !(r2 && r2.error) && !(s && s.error) && !(d && d.error), price: quotations.find(x => x.id === quotation).items.find(y => y.lineId === it.lineId).rate });
      });
      return { out, total: computeQuotationTotals(quotations.find(x => x.id === quotation)).netTotal };
    }, { quotation: qtn.quotation, depts: o.depts, matRate: o.matRate, matQty: o.matQty, matIndex: o.matIndex }, 2000);
    record('Estimator costs, books labour, submits, routes', 'estimator', est.out && est.out.every(x => x.ok && x.price > 0), est);
    if (o.stopAfter === 'estimated') return { customer: sales.customer, enquiry: enq.enquiry, quotation: qtn.quotation, lines: qtn.lines, total: est.total };
    const toApp = await act('estimator', ({ quotation }) => { const r = transferQuotationStage(quotation, 'approver', 'E2E Estimator Account'); return { err: r && r.error, stage: quotations.find(q => q.id === quotation).stage }; }, { quotation: qtn.quotation });
    record('Estimator transfers to the Approver', 'estimator', toApp.stage === 'approver' && !toApp.err, toApp);
    const appSees = await seen('approver', (id) => quotations.some(q => q.id === id && q.stage === 'approver' && q.items.every(i => i.rate > 0)), qtn.quotation);
    record('The Approver sees the priced quotation', 'approver', appSees, qtn.quotation, 'realtime');
    if (!appSees) await act('approver', () => location.reload(), null, 6000);
    if (o.stopAfter === 'approver') return { customer: sales.customer, enquiry: enq.enquiry, quotation: qtn.quotation, lines: qtn.lines, total: est.total };
    const app = await act('approver', ({ quotation }) => { const r = approveQuotation(quotation, 'E2E Approver Role Account', 'approver'); const q = quotations.find(x => x.id === quotation); return { err: r && r.error, lifecycle: q.lifecycleStatus, stage: q.stage }; }, { quotation: qtn.quotation }, 2000);
    record('Approver approves — lifecycle open, back to Sales', 'approver', !app.err && app.lifecycle === 'open' && app.stage === 'sales', app);
    const salesSees = await seen('sales', (id) => quotations.some(q => q.id === id && q.lifecycleStatus === 'open'), qtn.quotation);
    record('Sales sees the approval land', 'sales', salesSees, qtn.quotation, 'realtime');
    if (!salesSees) await act('sales', () => location.reload(), null, 6000);
    const job = await act('sales', ({ quotation }) => { const j = confirmQuotationToJobCard(quotation, 'E2E Test Account'); if (!j || j.error) return { err: (j && j.error) || 'no job' }; return { job: j.id, amount: j.amount }; }, { quotation: qtn.quotation }, 2500);
    record('Sales confirms to a Job Card', 'sales', job.job && !job.err, job);
    if (o.stopAfter === 'confirmed') return { customer: sales.customer, enquiry: enq.enquiry, quotation: qtn.quotation, lines: qtn.lines, job: job.job, total: est.total };
    const opsSees = await seen('operations_manager', (id) => getJobsPendingRouting().some(j => j.id === id), job.job);
    record('Operations sees the job in its routing queue', 'operations_manager', opsSees, job.job, 'realtime');
    if (!opsSees) await act('operations_manager', () => location.reload(), null, 6000);
    const routed = await act('operations_manager', ({ job, target }) => { const r = confirmJobRouting(job, {}, 'E2E Operations Account', target); const j = getJobCard(job); return { err: r && r.error, routing: j.routingConfirmed, budgets: Object.keys(j.departmentBudgets || {}) }; }, { job: job.job, target: DAYS[10] }, 2500);
    record('Operations routes; every department gets a budget slot', 'operations_manager', routed.routing && routed.budgets.length, routed);
    return { customer: sales.customer, enquiry: enq.enquiry, quotation: qtn.quotation, lines: qtn.lines, job: job.job, total: est.total, budgets: routed.budgets };
  }
  // Approve every department budget on a job as Operations.
  async function approveBudgets(job, depts) {
    return act('operations_manager', ({ job, depts }) => depts.map(d => { const r = approveDepartmentBudget(job, d, 'E2E Operations Account'); return d + ':' + (r && r.error ? r.error : 'ok'); }), { job, depts }, 1500);
  }

  async function finish(t0, before) {
    await (await session('owner')).waitForTimeout(6000);
    const after = await snapshotIds();
    const manifest = { label, createdAt: new Date().toISOString(), tables: {} };
    Object.keys(after).forEach(t => { const b = new Set(before[t] || []); manifest.tables[t] = (after[t] || []).filter(id => !b.has(id)); });
    fs.writeFileSync(path.join(root, 'test-run', dir + '-manifest.json'), JSON.stringify(manifest, null, 1));
    const errs = Object.keys(errorsByRole).filter(r => errorsByRole[r].length).map(r => ({ role: r, errors: errorsByRole[r].slice(0, 6) }));
    const passN = results.filter(r => r.ok).length;
    const scenarios = [...new Set(results.map(r => r.scenario))];
    const md = ['# End-to-end run — ' + label, '', 'Run ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' · ' + passN + '/' + results.length + ' checks passed · ' + Math.round((Date.now() - t0) / 1000) + ' s · manifest test-run/' + dir + '-manifest.json', ''];
    scenarios.forEach(sc => {
      md.push('## ' + sc, '', '| # | Role | Step | Result | Detail |', '|---|---|---|---|---|');
      results.filter(r => r.scenario === sc).forEach(r => md.push('| ' + r.step + ' | ' + r.role + ' | ' + r.name.replace(/\|/g, '\\|') + ' | ' + (r.ok ? 'PASS' : '**FAIL**') + ' | ' + r.detail.replace(/\|/g, '\\|').slice(0, 160) + ' |'));
      md.push('');
    });
    md.push('## Findings and notes', '');
    if (!findings.length) md.push('None.');
    findings.forEach((f, i) => md.push((i + 1) + '. **[' + f.kind + '] ' + f.scenario + ' step ' + f.step + ' (' + f.role + ')** — ' + f.name + '  \n   ' + String(f.detail).replace(/\n/g, ' ').slice(0, 500)));
    md.push('', '## Console / page errors and refused writes by role', '');
    if (!errs.length) md.push('None.'); else errs.forEach(e => md.push('- **' + e.role + '**: ' + e.errors.map(x => '`' + x.slice(0, 160) + '`').join(' · ')));
    fs.writeFileSync(path.join(root, 'docs', 'test-run', report), md.join('\n') + '\n');
    console.log('\n' + passN + '/' + results.length + ' checks passed · report docs/test-run/' + report);
    if (browser) await browser.close();
    return { passN, total: results.length };
  }

  return { PAT, DAYS, STAMP, ROLES, quotationWrites, rawPage, sql, liveRow, livePayload, liveCol, setScenario, record, note, session, act, seen, fresh, shot, snapshotIds, frontHalf, approveBudgets, finish, addDays, localISO };
};
