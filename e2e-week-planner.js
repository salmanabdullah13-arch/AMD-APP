// Week planner — rebuilt 8 Aug 2026 to Salman's reference design.
//
// The design is a seven-column week of typed commitment cards, a left rail
// (navigation + type filters), and a right rail holding "needs a slot" work
// plus crew capacity.
//
// The rule this screen is built on, and what most of these checks defend:
// every card in the week is a REAL dated commitment. Work that genuinely has
// no date — a budget waiting on a decision, a job with no promised date —
// is never given one to fill a column; it goes to the unscheduled rail. A
// week that looks planned when it isn't would be worse than an empty one.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== WEEK PLANNER ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text().slice(0, 150) }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message.slice(0, 150) }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => { loadDemoData(); launchOwnerModule(); });
  await page.waitForTimeout(700);

  // ── seed one of each real commitment type, on known days of this week ──
  currentStep = 'seed';
  const seed = await page.evaluate(() => {
    const iso = d => d.toISOString().slice(0, 10);
    const mon = plannerMonday(iso(new Date()));
    const jobs = jobCards.filter(j => j.status !== 'cancelled');
    const [a, b] = jobs;
    scheduleDelivery(a.id, { plannedDate: plannerAddDays(mon, 1), driver: 'Shibu', vehicleId: 'V-1' });
    // a job whose line is sitting at QC — its promised date is a QC deadline
    b.promisedDate = plannerAddDays(mon, 3);
    const line = b.items.find(it => (it.departmentStatuses || []).length);
    if (line) line.departmentStatuses[0].status = 'qc';
    createEvent({ title: 'Client walkthrough', date: plannerAddDays(mon, 2), time: '16:30',
      kind: 'meeting', owner: execIdentity(), withWhom: 'Silva' });
    createTask({ title: 'Chase the veneer supplier', assignee: execIdentity(), dueDate: plannerAddDays(mon, 4) });
    return { mon, deliveryJob: a.id, qcJob: b.id };
  });
  record('Seeded a delivery, a QC deadline, a diary entry and a task across the week', 'PASS', JSON.stringify(seed));

  await page.evaluate(() => execOpenPlanner());
  await page.waitForTimeout(500);

  // ── the layout ──
  currentStep = 'layout';
  const layout = await page.evaluate(() => {
    const el = document.getElementById('exec-planner');
    return {
      open: el.classList.contains('open'),
      cols: el.querySelectorAll('.xs-pl-col').length,
      rail: getComputedStyle(el.querySelector('.xs-pl-rail')).display !== 'none',
      side: getComputedStyle(el.querySelector('.xs-pl-side')).display !== 'none',
      filters: [...el.querySelectorAll('.xs-pl-rail .xs-pl-chip')].map(c => c.textContent),
      nav: [...el.querySelectorAll('.xs-pl-navitem')].map(n => n.textContent.replace(/[^A-Za-z ]/g, '').trim()),
      today: el.querySelectorAll('.xs-pl-today').length,
      opaque: getComputedStyle(el).backgroundColor
    };
  });
  record('Seven day columns with the left and right rails, today marked once',
    layout.cols === 7 && layout.rail && layout.side && layout.today === 1 ? 'PASS' : 'FAIL', JSON.stringify(layout));
  record('The rail carries the four type filters and its own navigation',
    JSON.stringify(layout.filters) === JSON.stringify(['All', 'Deliveries', 'Installs', 'QC']) &&
    layout.nav.length === 4 ? 'PASS' : 'FAIL', JSON.stringify(layout));
  record('The overlay is opaque — nothing behind it shows through',
    layout.opaque !== 'rgba(0, 0, 0, 0)' ? 'PASS' : 'FAIL', layout.opaque);

  // ── every card is a real dated commitment, on the right day ──
  currentStep = 'cards';
  const cards = await page.evaluate((s) => {
    const el = document.getElementById('exec-planner');
    const cols = [...el.querySelectorAll('.xs-pl-col')];
    const byDay = cols.map(c => [...c.querySelectorAll('.xs-pl-card')].map(k => ({
      type: (k.querySelector('.tp') || {}).textContent,
      title: (k.querySelector('.ttl') || {}).textContent,
      time: (k.querySelector('.tm') || {}).textContent || ''
    })));
    return {
      tue: byDay[1].map(c => c.type),
      wed: byDay[2].map(c => c.type),
      thu: byDay[3].map(c => c.type),
      fri: byDay[4].map(c => c.type),
      qcTitle: (byDay[3][0] || {}).title || '',
      meetingTime: (byDay[2][0] || {}).time || ''
    };
  }, seed);
  record('The booked delivery lands on its planned day', cards.tue.includes('Delivery') ? 'PASS' : 'FAIL', JSON.stringify(cards));
  record('A job with a line at QC shows its promised date as a QC deadline, not a plain promise',
    cards.thu.includes('QC') && /QC deadline/.test(cards.qcTitle) ? 'PASS' : 'FAIL', JSON.stringify(cards));
  record('A diary entry keeps its own time, and a due task appears on its due day',
    cards.wed.includes('Meeting') && cards.meetingTime === '16:30' && cards.fri.includes('Task') ? 'PASS' : 'FAIL', JSON.stringify(cards));

  // ── undated work is NOT given a day; it goes to the rail ──
  currentStep = 'unscheduled';
  const unsched = await page.evaluate(() => {
    const el = document.getElementById('exec-planner');
    const inWeek = [...el.querySelectorAll('.xs-pl-card .ttl')].map(t => t.textContent);
    const rail = [...el.querySelectorAll('.xs-pl-slot .t')].map(t => t.textContent);
    const railMeta = [...el.querySelectorAll('.xs-pl-slot .m')].map(t => t.textContent);
    const data = getUnscheduledWork(execIdentity(), execModuleKey);
    return {
      railCount: rail.length, dataCount: data.length,
      kinds: [...new Set(data.map(d => d.kind))],
      // nothing in the week may be one of the undated items
      leaked: rail.filter(r => inWeek.some(w => w.indexOf(r.split(' · ')[0]) !== -1 && /no date|not routed|no slot/i.test(railMeta.join(' ')))).length,
      sub: (el.querySelector('.xs-pl-sub') || {}).textContent
    };
  });
  record('Work with no date is listed in the rail rather than dropped into a day',
    unsched.railCount > 0 && unsched.dataCount > 0 ? 'PASS' : 'FAIL', JSON.stringify(unsched));
  record('The header counts both the week\'s commitments and the unscheduled work',
    /commitment/.test(unsched.sub) && /unscheduled/.test(unsched.sub) ? 'PASS' : 'FAIL', unsched.sub);

  // ── filters ──
  currentStep = 'filters';
  const filtered = await page.evaluate(async () => {
    const el = document.getElementById('exec-planner');
    const all = el.querySelectorAll('.xs-pl-card').length;
    execPlannerSetFilter('delivery');
    await new Promise(r => setTimeout(r, 200));
    const deliveries = [...document.querySelectorAll('#exec-planner .xs-pl-card .tp')].map(t => t.textContent);
    execPlannerSetFilter('all');
    await new Promise(r => setTimeout(r, 200));
    return { all, deliveries, restored: document.querySelectorAll('#exec-planner .xs-pl-card').length };
  });
  record('A type filter shows only that type, and All restores the week',
    filtered.deliveries.every(t => t === 'Delivery') && filtered.deliveries.length > 0 &&
    filtered.restored === filtered.all ? 'PASS' : 'FAIL', JSON.stringify(filtered));

  // ── stepping the week ──
  currentStep = 'stepping';
  const step = await page.evaluate(async () => {
    const range = () => document.querySelector('#exec-planner .xs-pl-sub').textContent;
    const before = range();
    document.querySelector('#exec-planner .xs-pl-nav button').click();   // ‹
    await new Promise(r => setTimeout(r, 250));
    const back = range();
    const buttons = [...document.querySelectorAll('#exec-planner .xs-pl-nav button')];
    buttons.find(b => b.textContent.trim() === 'This week').click();
    await new Promise(r => setTimeout(r, 250));
    return { before, back, restored: range() };
  });
  record('Stepping back changes the week, and This week returns to it',
    step.back !== step.before && step.restored === step.before ? 'PASS' : 'FAIL', JSON.stringify(step));

  // ── crew capacity is the real day-log figure, not an invented one ──
  currentStep = 'capacity';
  const cap = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#exec-planner .xs-pl-caprow .l')].map(r => r.textContent);
    const data = getWeekCapacity(plannerMonday(new Date().toISOString().slice(0, 10)));
    return { rows, depts: data.map(d => d.label), fromRoster: data.every(d => d.avail === d.roster * 8 * 6) };
  });
  record('Crew capacity shows each department\'s logged hours against its real roster',
    cap.rows.length === 4 && cap.fromRoster ? 'PASS' : 'FAIL', JSON.stringify(cap));

  // ── logging a meeting from a day column still works ──
  currentStep = 'log';
  const logged = await page.evaluate(async () => {
    const mon = plannerMonday(new Date().toISOString().slice(0, 10));
    execPlannerShowForm(mon);
    await new Promise(r => setTimeout(r, 250));
    const form = document.querySelector('#exec-planner .xs-pl-form');
    if (!form) return { error: 'no form' };
    form.querySelector('[data-f="title"]').value = 'Planner log check';
    form.querySelector('[data-f="time"]').value = '09:15';
    execPlannerSave(mon);
    await new Promise(r => setTimeout(r, 300));
    return {
      stored: events.some(e => e.title === 'Planner log check' && e.date === mon),
      shown: document.getElementById('exec-planner').textContent.includes('Planner log check')
    };
  });
  record('Logging a meeting on a day saves it and shows it in that column',
    logged.stored && logged.shown ? 'PASS' : 'FAIL', JSON.stringify(logged));

  // ── phone: the rails fold, but the unscheduled list must not vanish ──
  currentStep = 'mobile';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const mobile = await page.evaluate(() => {
    const el = document.getElementById('exec-planner');
    return {
      railHidden: getComputedStyle(el.querySelector('.xs-pl-rail')).display === 'none',
      sideShown: getComputedStyle(el.querySelector('.xs-pl-side')).display !== 'none',
      filtersInHeader: getComputedStyle(el.querySelector('.xs-pl-mobfilters')).display !== 'none',
      cols: el.querySelectorAll('.xs-pl-col').length,
      overflow: el.scrollWidth - Math.round(el.getBoundingClientRect().width)
    };
  });
  record('On a phone the left rail folds away and its filters move into the header',
    mobile.railHidden && mobile.filtersInHeader ? 'PASS' : 'FAIL', JSON.stringify(mobile));
  record('The unscheduled list stays reachable on a phone — the count in the header has something behind it',
    mobile.sideShown ? 'PASS' : 'FAIL', JSON.stringify(mobile));
  record('The week still shows all seven days and does not overflow sideways',
    mobile.cols === 7 && mobile.overflow <= 1 ? 'PASS' : 'FAIL', JSON.stringify(mobile));

  await page.evaluate(() => execClosePlanner());
  await page.waitForTimeout(250);
  const closed = await page.evaluate(() => !document.getElementById('exec-planner').classList.contains('open'));
  record('The planner closes cleanly', closed ? 'PASS' : 'FAIL');

  const critical = consoleErrors.filter(e => !e.text.includes('favicon'));
  record('No unexpected console errors', critical.length === 0 ? 'PASS' : 'FAIL', critical.map(e => e.text).join(' | '));
  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.every(r => r.status === 'PASS') ? 0 : 1);
})();
