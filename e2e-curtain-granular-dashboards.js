// Verification for Milestone B of the role-based access rollout (5 Aug
// 2026) — four new ecosystem entry points opening curtain.js's own
// already-built standalone dashboards directly (Tracks/QC/Install Crew/
// Pipeline Board), bypassing the Curtain Manager's main dashboard/nav
// entirely, for the four granular Curtain roles (Tracks Team, QC Team,
// Site Installer, Team Leader).
//
// None of these four screens had ANY e2e coverage before this — first
// real verification that they open/close correctly at all, not just
// that the new entry points reach them. Also proves the real pre-
// existing bug fix in their close functions: closeTracksDashboard()/
// closeQCDashboard()/closeInstallCrewDashboard()/closePipelineBoard()
// used to reset only 2 of ~12 module wraps (relying on a `.module{}`
// CSS rule that never existed), which would leave Purchasing's module
// wrap incorrectly visible after closing any of these. Fixed to call
// goTo('eco') like every other module's own close button already does.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-curtain-granular');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== CURTAIN GRANULAR DASHBOARDS VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const OTHER_WRAPS = ['sales-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap'];

async function checkOnlyOneVisible(page, expectedWrapId) {
  return page.evaluate((expected) => {
    const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
    const otherWraps = ['sales-module-wrap', 'purch-module-wrap', 'curt-module-wrap', 'sk-module-wrap', 'estimator-module-wrap', 'approver-module-wrap', 'jobs-module-wrap', 'accounts-module-wrap', 'hr-module-wrap', 'joinery-module-wrap', 'upholstery-module-wrap', 'painting-module-wrap', 'owner-module-wrap'];
    return { expectedVisible: isVisible(expected), anyOtherVisible: otherWraps.some(isVisible) };
  }, expectedWrapId);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForTimeout(500);

  const dashboards = [
    { node: 'curtain-tracks', wrap: 'tracks-dash-wrap', label: 'Curtain – Tracks Team' },
    { node: 'curtain-qc', wrap: 'qc-dash-wrap', label: 'Curtain – QC Team' },
    { node: 'curtain-install', wrap: 'install-crew-wrap', label: 'Curtain – Site Installer' },
    { node: 'curtain-pipeline', wrap: 'pipeline-board-wrap', label: 'Curtain – Team Leader' }
  ];

  for (const d of dashboards) {
    currentStep = `open-${d.node}`;
    const opened = await page.evaluate((nodeId) => {
      const branch = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === nodeId);
      if (!branch) return { error: 'branch not found' };
      branch.userData.node.launch();
      return { ok: true };
    }, d.node);
    await page.waitForTimeout(600);
    const state = await checkOnlyOneVisible(page, d.wrap);
    record(
      `${d.label} opens as a standalone entry point with no other module wrap visible`,
      !opened.error && state.expectedVisible && !state.anyOtherVisible ? 'PASS' : 'FAIL',
      JSON.stringify({ opened, state })
    );
    await shot(page, `open-${d.node}`, dashboards.indexOf(d) * 2 + 1);

    currentStep = `close-${d.node}`;
    // Real interaction path — clicking the actual "← Back" button, not
    // calling closeXDashboard() directly.
    await page.click(`#${d.wrap} button[onclick^="close"]`);
    await page.waitForTimeout(500);
    const afterClose = await page.evaluate((wrapId) => {
      const isVisible = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
      const scroll = document.getElementById('scroll');
      return {
        wrapHidden: !isVisible(wrapId),
        ecoVisible: !!scroll && getComputedStyle(scroll).display !== 'none',
        purchVisible: isVisible('purch-module-wrap'),
        curtVisible: isVisible('curt-module-wrap')
      };
    }, d.wrap);
    record(
      `A real tap on ${d.label}'s "← Back" button returns cleanly to the ecosystem (the actual bug fix — Purchasing/Curtain used to leak visible)`,
      afterClose.wrapHidden && afterClose.ecoVisible && !afterClose.purchVisible && !afterClose.curtVisible ? 'PASS' : 'FAIL',
      JSON.stringify(afterClose)
    );
    await shot(page, `after-close-${d.node}`, dashboards.indexOf(d) * 2 + 2);
  }

  currentStep = 'final';
  const critical = consoleErrors.filter(e => !e.text.includes('favicon'));
  record('No unexpected console errors', critical.length === 0 ? 'PASS' : 'FAIL', critical.map(e => e.text).join(' | '));
  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.some(r => r.status === 'FAIL') ? 1 : 0);
})().catch(err => {
  console.error('FATAL:', err);
  printReport();
  process.exit(1);
});
