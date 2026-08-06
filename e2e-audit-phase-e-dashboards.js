// Verification for the 6 Aug 2026 audit, Phase E dashboard wins:
//   - Storekeeper: getReorderAlerts() surfaces open-order shortfall + below-
//     reorder-level items, shown as a KPI tile + list on the dashboard.
//   - Estimator/Approver: quoteAgeDays()/quoteAgeBadge() give queue rows a
//     time-in-queue signal (previously category counts only).

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== PHASE E DASHBOARD-WINS VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  // ── Reorder alerts (data layer) ──
  currentStep = 'reorder-data';
  const ro = await page.evaluate(() => {
    // Add an Item Master item sitting at/below its reorder level, no demand.
    const target = { id: 'IM-REORDER-1', name: 'Reorder Widget', unit: 'Nos', reorderLevel: 10, closingStock: 2, openingStock: 2 };
    itemMaster.push(target);
    const alerts = getReorderAlerts();
    const mine = alerts.find(a => a.itemId === target.id);
    return { count: alerts.length, mineBelow: mine ? mine.belowReorder : null, mineName: mine ? mine.itemName : null };
  });
  record('getReorderAlerts() flags an item at/below its reorder level', ro.mineBelow === true && ro.mineName === 'Reorder Widget' ? 'PASS' : 'FAIL', JSON.stringify(ro));

  // ── Reorder alerts (dashboard UI) ──
  currentStep = 'reorder-ui';
  await page.evaluate(() => { if (typeof launchStorekeeperModule === 'function') launchStorekeeperModule(); else goTo('storekeeper'); });
  await page.waitForSelector('#sk-module-wrap', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(200);
  const roUi = await page.evaluate(() => {
    const html = document.getElementById('sk-module-wrap').innerHTML;
    return { hasTile: html.includes('Reorder Alerts'), hasItem: html.includes('Reorder Widget') };
  });
  record('Storekeeper dashboard shows the Reorder Alerts tile', roUi.hasTile ? 'PASS' : 'FAIL', JSON.stringify(roUi));
  record('Storekeeper dashboard lists the flagged reorder item', roUi.hasItem ? 'PASS' : 'FAIL', '');

  // ── Quote aging (data layer) ──
  currentStep = 'aging-data';
  const ag = await page.evaluate(() => {
    const fresh = { date: new Date().toISOString().slice(0, 10) };
    const d10 = new Date(); d10.setDate(d10.getDate() - 10);
    const old = { date: d10.toISOString().slice(0, 10) };
    return {
      freshDays: quoteAgeDays(fresh), oldDays: quoteAgeDays(old),
      freshBadge: quoteAgeBadge(fresh), oldBadge: quoteAgeBadge(old)
    };
  });
  record('quoteAgeDays() is 0 for a same-day quote', ag.freshDays === 0 ? 'PASS' : 'FAIL', JSON.stringify(ag.freshDays));
  record('quoteAgeDays() counts ~10 days for an older quote', ag.oldDays >= 9 && ag.oldDays <= 11 ? 'PASS' : 'FAIL', JSON.stringify(ag.oldDays));
  record('quoteAgeBadge() is empty for a fresh quote, shows a red 10d for a stale one', ag.freshBadge === '' && ag.oldBadge.includes('10d') && ag.oldBadge.includes('d9342b') ? 'PASS' : 'FAIL', JSON.stringify(ag));

  // ── Quote aging on the Estimator dashboard row ──
  currentStep = 'aging-estimator-ui';
  const est = await page.evaluate(() => {
    const c = createCustomer({ name: 'Aging Client', contactPerson: 'X', tel: '39909090', address: 'Manama' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'X', tel: c.tel, source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Aging Cabinet', taxPercent: 10, contactPerson: 'X' });
    const row = addQuotationItem(q.id, { product: 'Cabinet', qty: 1, unit: 'Nos', vatPercent: 10 });
    addBOMMaterial(q.id, row.lineId, { name: 'm', qty: 1, unit: 'Nos', rate: 100 });
    submitItemBOM(q.id, row.lineId, 'E');
    // age it 12 days and leave it in the Estimator's Pending-to-Pick queue
    const d = new Date(); d.setDate(d.getDate() - 12); q.date = d.toISOString().slice(0, 10);
    transferQuotationStage(q.id, 'estimator', 'S');
    return { qId: q.id };
  });
  await page.evaluate(() => { if (typeof launchEstimatorModule === 'function') launchEstimatorModule(); else goTo('estimation'); });
  await page.waitForSelector('#estimator-module-wrap', { state: 'visible', timeout: 5000 });
  await page.evaluate(() => { estimatorDashExpanded = 'pending'; renderEstimatorBody(); });
  await page.waitForTimeout(200);
  const estUi = await page.evaluate((qId) => {
    const html = document.getElementById('estimator-body').innerHTML;
    return { hasRow: html.includes(qId), hasAge: html.includes('12d') };
  }, est.qId);
  record('Estimator Pending-to-Pick row shows the quote-age badge', estUi.hasRow && estUi.hasAge ? 'PASS' : 'FAIL', JSON.stringify(estUi));

  await browser.close();
  printReport();
  process.exit(results.filter(r => r.status === 'FAIL').length > 0 || pageErrors.length > 0 ? 1 : 0);
})();
