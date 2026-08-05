// Verification for the sign-in roster filter (5 Aug 2026) — Salman
// reported the sign-in dropdown was full of test accounts. Two e2e
// suites (e2e-signup-approval.js, e2e-role-gating.js) each create a
// fresh timestamped throwaway account per run to exercise the real
// sign-up → approve flow, and can't delete it afterwards (removing an
// auth user needs the service_role key, which must never reach client
// code), so they accumulate in allowed_identities indefinitely — 73
// test names against 11 real staff by the time this was reported.
//
// filterRealIdentities() (auth.js) strips them from the dropdown on
// real origins only; test origins still see everything so the suites
// that sign in as those accounts keep working. This suite exercises
// BOTH branches by monkey-patching isLocalTestOrigin() (a plain global
// function declaration, so reassigning window.isLocalTestOrigin really
// does replace what filterRealIdentities() resolves) — otherwise the
// production branch would be untestable from a file:// origin.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== SIGN-IN ROSTER FILTER VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const SAMPLE = [
  { display_name: 'Accounts' },
  { display_name: 'E2E Approver Account' },
  { display_name: 'E2E Gating Throwaway 1785953881136' },
  { display_name: 'E2E Signup Throwaway 1785953287955' },
  { display_name: 'E2E Test Account' },
  { display_name: 'Salman Abdullah' },
  { display_name: 'Silva' },
  { display_name: 'Upholstery Manager' }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  currentStep = 'functions-exist';
  const exists = await page.evaluate(() => typeof filterRealIdentities === 'function' && typeof isLocalTestOrigin === 'function');
  record('filterRealIdentities() and isLocalTestOrigin() are both defined', exists ? 'PASS' : 'FAIL');

  currentStep = 'test-origin-passthrough';
  const passthrough = await page.evaluate((sample) => filterRealIdentities(sample).length, SAMPLE);
  record('On a test origin the roster passes through unfiltered (e2e suites still see their own accounts)', passthrough === SAMPLE.length ? 'PASS' : 'FAIL', `${passthrough}/${SAMPLE.length}`);

  currentStep = 'real-origin-filtered';
  const filtered = await page.evaluate((sample) => {
    const original = window.isLocalTestOrigin;
    window.isLocalTestOrigin = () => false;          // simulate the real deployed origin
    const out = filterRealIdentities(sample).map(r => r.display_name);
    window.isLocalTestOrigin = original;
    return out;
  }, SAMPLE);
  const expected = ['Accounts', 'Salman Abdullah', 'Silva', 'Upholstery Manager'];
  const matches = JSON.stringify(filtered) === JSON.stringify(expected);
  record('On a real origin every E2E account is stripped and only real staff remain', matches ? 'PASS' : 'FAIL', JSON.stringify(filtered));
  record('Named E2E fixtures (Test/Approver Account) are filtered too, not just the timestamped throwaways',
    !filtered.some(n => /^E2E /i.test(n)) ? 'PASS' : 'FAIL');
  record('Real staff whose names merely contain "e2e"-like text are not over-matched (prefix-anchored)',
    filtered.includes('Accounts') && filtered.includes('Silva') ? 'PASS' : 'FAIL');

  currentStep = 'restored';
  const restored = await page.evaluate((sample) => filterRealIdentities(sample).length, SAMPLE);
  record('isLocalTestOrigin() restored cleanly after the patch (no leaked state)', restored === SAMPLE.length ? 'PASS' : 'FAIL');

  currentStep = 'live-roster';
  const live = await page.evaluate(async () => {
    const { data, error } = await sb.from('allowed_identities').select('display_name').order('display_name');
    if (error) return { error: error.message };
    const original = window.isLocalTestOrigin;
    window.isLocalTestOrigin = () => false;
    const kept = filterRealIdentities(data).map(r => r.display_name);
    window.isLocalTestOrigin = original;
    return { total: data.length, kept };
  });
  if (live.error) {
    record('Live roster check (network)', 'FAIL', live.error);
  } else {
    record('Against the REAL live roster, the dropdown a staff member sees contains zero test accounts',
      !live.kept.some(n => /^E2E /i.test(n)) ? 'PASS' : 'FAIL',
      `${live.kept.length} shown of ${live.total} total — ${JSON.stringify(live.kept)}`);
  }

  currentStep = 'final';
  record('No uncaught page errors', pageErrors.length === 0 ? 'PASS' : 'FAIL', pageErrors.map(e => e.text).join(' | '));

  printReport();
  await browser.close();
  process.exit(results.some(r => r.status === 'FAIL') ? 1 : 0);
})().catch(err => {
  console.error('FATAL:', err);
  printReport();
  process.exit(1);
});
