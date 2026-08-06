// Stage 7 of the merged roadmap (6 Aug 2026) — monthly payroll runs:
// baseline from each Active employee's real Salary-tab pay heads, per-month
// OT/deductions edited on the draft, finalize locks it, payslip printable.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 480, height: 950 } });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  currentStep = 'create-run';
  const run = await page.evaluate(() => {
    const r = createPayrollRun(2026, 8, 'HR');
    if (r.error) return { error: r.error };
    const sohail = r.rows.find(x => x.name === 'Sohail Qureshi');
    const dup = createPayrollRun(2026, 8, 'HR');
    return {
      id: r.id, staff: r.rows.length,
      sohailBasic: sohail && sohail.basic, sohailNet: sohail && sohail.net,
      dupRejected: !!dup.error,
      activeOnly: r.rows.length === employees.filter(e => e.status === 'Active').length
    };
  });
  record('Run created for all Active staff with real Salary-tab baselines (Sohail basic 165)', !run.error && run.sohailBasic === 165 && run.activeOnly ? 'PASS' : 'FAIL', JSON.stringify(run));
  record('Duplicate month rejected', run.dupRejected ? 'PASS' : 'FAIL');

  currentStep = 'edit-finalize';
  const fin = await page.evaluate((runId) => {
    const r = payrollRuns.find(x => x.id === runId);
    const sohail = r.rows.find(x => x.name === 'Sohail Qureshi');
    updatePayrollRunRow(runId, sohail.employeeId, { ot: 55 });   // the real July OT figure
    const netAfter = r.rows.find(x => x.name === 'Sohail Qureshi').net;
    finalizePayrollRun(runId, 'HR');
    const editLocked = updatePayrollRunRow(runId, sohail.employeeId, { ot: 99 });
    return { netAfter, status: r.status, editLocked: !!editLocked.error, empId: sohail.employeeId };
  }, run.id);
  record('OT edit recomputes net (165 + 55 = 220, the real July payslip)', fin.netAfter === 220 ? 'PASS' : 'FAIL', String(fin.netAfter));
  record('Finalize locks the run against further edits', fin.status === 'finalized' && fin.editLocked ? 'PASS' : 'FAIL');

  currentStep = 'ui-and-payslip';
  await page.evaluate(() => { const n = window.__eco3d.NODES.find(n => n.id === 'hr'); n.launch(); hrSetView('payroll-runs'); });
  await page.waitForTimeout(500);
  const ui = await page.evaluate(() => document.getElementById('hr-module-wrap').innerHTML.includes('PRUN-2026-08'));
  record('Payroll Runs tab lists the run', ui ? 'PASS' : 'FAIL');
  // Payslip content — build the HTML directly (printOpenHTML would open a tab)
  const slip = await page.evaluate(({ runId, empId }) => {
    let html = null;
    const orig = window.printOpenHTML; window.printOpenHTML = h => { html = h; };
    printPayslip(runId, empId);
    window.printOpenHTML = orig;
    return { has: !!html, name: html && html.includes('Sohail Qureshi'), net: html && html.includes('220.000'), title: html && html.includes('PAYSLIP') };
  }, { runId: run.id, empId: fin.empId });
  record('Payslip document renders (name, PAYSLIP title, net 220.000)', slip.has && slip.name && slip.net && slip.title ? 'PASS' : 'FAIL');

  console.log('\n=== PAYROLL RUNS (Stage 7) ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
