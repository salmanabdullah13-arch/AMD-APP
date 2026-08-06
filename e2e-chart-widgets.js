// Verification for Dashboard Analytics rollout, Phase 1 (5 Aug 2026) —
// the shared chart-widgets.js primitives (promoted/generalized from
// curtain.js's ring-gauge/mini-bar-chart code, plus two new ones:
// stacked monthly bars, horizontal ranked bar list) and the three new
// data.js aggregations that feed them (getMonthlyRevenueByDivision,
// getPipelineFunnel, getTopClientsByValue). Uses the fast offline
// bypass (no `?test_cloud_login=1`) since these are pure functions
// over the in-memory arrays — no live Supabase round trip needed to
// verify the logic.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== CHART WIDGETS + ANALYTICS AGGREGATIONS VERIFICATION ===');
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
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  currentStep = 'app-loads';
  await page.waitForSelector('#app', { state: 'visible' });
  record('App loads', 'PASS');

  currentStep = 'ring-gauge';
  const ring = await page.evaluate(() => {
    const svg = cwRingGauge(75, '#600131');
    return { hasSvg: svg.includes('<svg'), hasStrokeDasharray: svg.includes('stroke-dasharray') };
  });
  record('cwRingGauge() renders an SVG ring with stroke-dasharray', ring.hasSvg && ring.hasStrokeDasharray ? 'PASS' : 'FAIL', JSON.stringify(ring));

  currentStep = 'ring-gauge-clamp';
  const clamp = await page.evaluate(() => {
    const over = cwRingGauge(150, '#600131');
    const under = cwRingGauge(-20, '#600131');
    return { overRendered: over.includes('<svg'), underRendered: under.includes('<svg') };
  });
  record('cwRingGauge() clamps out-of-range percentages without throwing', clamp.overRendered && clamp.underRendered ? 'PASS' : 'FAIL', JSON.stringify(clamp));

  currentStep = 'ring-stat-card';
  const card = await page.evaluate(() => cwRingStatCard(80, '80%', 'QC Pass Rate', '4 of 5 passed', '#0f9d58').includes('ring-card'));
  record('cwRingStatCard() wraps the ring in a .ring-card with title/sub', card ? 'PASS' : 'FAIL');

  currentStep = 'mini-bars-populated';
  const bars = await page.evaluate(() => {
    const html = cwMiniBars([{ label: 'Mon', value: 4, color: '#600131' }, { label: 'Tue', value: 8, color: '#600131' }]);
    return { hasBars: html.includes('mini-bar-col'), barCount: (html.match(/mini-bar-col/g) || []).length };
  });
  record('cwMiniBars() renders one column per item', bars.hasBars && bars.barCount === 2 ? 'PASS' : 'FAIL', JSON.stringify(bars));

  currentStep = 'mini-bars-empty';
  const barsEmpty = await page.evaluate(() => cwMiniBars([]).includes('cw-empty'));
  record('cwMiniBars() with zero items renders the empty state, not a broken chart', barsEmpty ? 'PASS' : 'FAIL');

  currentStep = 'stacked-bars-empty';
  const stackedEmpty = await page.evaluate(() => {
    const months = [{ key: '2026-01', label: 'Jan' }, { key: '2026-02', label: 'Feb' }];
    const series = [{ name: 'Joinery', color: '#600131', values: [0, 0] }];
    return cwStackedMonthlyBars(months, series).includes('cw-empty');
  });
  record('cwStackedMonthlyBars() with all-zero data renders the empty state (not a broken/blank chart)', stackedEmpty ? 'PASS' : 'FAIL');

  currentStep = 'stacked-bars-populated';
  const stackedReal = await page.evaluate(() => {
    const months = [{ key: '2026-01', label: 'Jan' }, { key: '2026-02', label: 'Feb' }];
    const series = [
      { name: 'Joinery', color: '#600131', values: [1000, 1500] },
      { name: 'Curtain & Blinds', color: '#9c3d6c', values: [500, 300] }
    ];
    const html = cwStackedMonthlyBars(months, series);
    return { hasSvg: html.includes('<svg'), rectCount: (html.match(/<rect/g) || []).length, hasLegend: html.includes('cw-legend-item') };
  });
  record('cwStackedMonthlyBars() with real data renders an SVG with one rect per non-zero month/series segment and a legend', stackedReal.hasSvg && stackedReal.rectCount === 4 && stackedReal.hasLegend ? 'PASS' : 'FAIL', JSON.stringify(stackedReal));

  currentStep = 'hbar-list-populated';
  const hbar = await page.evaluate(() => {
    const html = cwHorizontalBarList([{ label: 'Client A', value: 5000 }, { label: 'Client B', value: 2000 }]);
    return { rowCount: (html.match(/cw-hbar-row/g) || []).length, hasWidths: html.includes('width:100.00%') };
  });
  record('cwHorizontalBarList() renders one row per entry, largest at 100% width', hbar.rowCount === 2 && hbar.hasWidths ? 'PASS' : 'FAIL', JSON.stringify(hbar));

  currentStep = 'hbar-list-empty';
  const hbarEmpty = await page.evaluate(() => cwHorizontalBarList([]).includes('cw-empty'));
  record('cwHorizontalBarList() with zero rows renders the empty state', hbarEmpty ? 'PASS' : 'FAIL');

  // ── Real data aggregations, built via a live multi-division, multi-month scenario ──
  currentStep = 'seed-scenario';
  const scenario = await page.evaluate(() => {
    function makeJob(divisionName, product, amountRate, monthOffset, salesPerson, deliveredFully) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - monthOffset);
      const cust = createCustomer({ name: 'Chart Widgets Client ' + divisionName + ' ' + monthOffset + '-' + Math.random().toString(36).slice(2, 6), contactPerson: 'Tester', tel: '39' + Math.floor(Math.random() * 900000 + 100000), address: 'Manama' });
      const enq = createEnquiry({ division: divisionName, customerId: cust.id, contactPerson: 'Tester', tel: cust.tel, source: 'walk inn', salesPerson: salesPerson || 'Salman Abdullah' });
      const qtn = convertEnquiryToQuotation(enq.id, { projectName: product, taxPercent: 10, contactPerson: 'Tester' });
      const item = addQuotationItem(qtn.id, { product, qty: 1, unit: 'Nos' });
      item.rate = amountRate; item.amount = amountRate; item.netAmount = amountRate;
      transferQuotationStage(qtn.id, 'approver', 'Estimator'); approveQuotation(qtn.id, 'Salman Abdullah');
      const job = confirmQuotationToJobCard(qtn.id, 'Salman Abdullah');
      job.date = d.toISOString().slice(0, 10);
      job.amount = amountRate;
      if (deliveredFully) {
        confirmJobRouting(job.id, {}, 'Operations Manager');
        job.items.forEach(it => { it.deliveredQty = it.qty; });
      }
      return { job, cust };
    }
    const salesPerson = 'Chart Widgets Tester';
    const j1 = makeJob('Joinery', 'Wardrobe', 3000, 0, salesPerson, true);   // this month, delivered
    const j2 = makeJob('Joinery', 'TV Unit', 2000, 1, salesPerson, false);   // last month, not delivered (still job-confirmed, not routed)
    const j3 = makeJob('Curtain & Blinds', 'Curtains', 1000, 0, salesPerson, false);
    const j4 = makeJob('Upholstery', 'Sofa', 4000, 0, salesPerson, false); // biggest single job -> should be top client
    return { salesPerson, customerIds: [j1.cust.id, j2.cust.id, j3.cust.id, j4.cust.id], topCustomerId: j4.cust.id };
  });

  currentStep = 'monthly-revenue-by-division';
  const monthly = await page.evaluate((salesPerson) => getMonthlyRevenueByDivision(4, { salesPerson }), scenario.salesPerson);
  const thisMonthKey = monthly.months[monthly.months.length - 1].key;
  const lastMonthKey = monthly.months[monthly.months.length - 2].key;
  record(
    'getMonthlyRevenueByDivision() correctly buckets confirmed job value by month x division, scoped to one salesperson',
    monthly.byMonthDiv[thisMonthKey]['Joinery'] === 3000 &&
    monthly.byMonthDiv[thisMonthKey]['Curtain & Blinds'] === 1000 &&
    monthly.byMonthDiv[thisMonthKey]['Upholstery'] === 4000 &&
    monthly.byMonthDiv[lastMonthKey]['Joinery'] === 2000
      ? 'PASS' : 'FAIL',
    JSON.stringify({ thisMonthKey, lastMonthKey, thisMonth: monthly.byMonthDiv[thisMonthKey], lastMonth: monthly.byMonthDiv[lastMonthKey] })
  );

  currentStep = 'pipeline-funnel';
  const funnel = await page.evaluate((salesPerson) => getPipelineFunnel({ salesPerson }), scenario.salesPerson);
  record(
    'getPipelineFunnel() correctly buckets jobs into Delivered vs In Production/Job Confirmed by real deliveredQty-vs-qty and routingConfirmed state',
    funnel.byStage['Delivered'].count === 1 && funnel.byStage['Delivered'].value === 3000 &&
    (funnel.byStage['Job Confirmed'].count + funnel.byStage['In Production'].count) === 3
      ? 'PASS' : 'FAIL',
    JSON.stringify(funnel.byStage)
  );

  currentStep = 'top-clients';
  const topClients = await page.evaluate((salesPerson) => getTopClientsByValue(10, { salesPerson }), scenario.salesPerson);
  record(
    'getTopClientsByValue() sorts by confirmed order value descending, biggest job\'s customer first',
    topClients.length > 0 && topClients[0].customerId === scenario.topCustomerId && topClients[0].value === 4000 ? 'PASS' : 'FAIL',
    JSON.stringify(topClients.slice(0, 2))
  );

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
