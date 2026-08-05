// Verification for Phase 3, second slice (5 Aug 2026) — customer bank/
// payment details (account number, IBAN, swift, etc.) restricted to
// Accounts/Owner. Confirmed via code search that Sales used to enter
// these on the intake form (sales.js), but every approved user could
// read them via the customers table's unrestricted SELECT policy.
// Salman's explicit call: tighten to Accounts + Owner only, accepting
// that Sales' intake form loses these fields (a real workflow change,
// not a bug). The fields were moved to a new customer_banking_details
// table with its own RLS (supabase/schema.sql); the old columns were
// dropped from customers entirely (verified 0 rows had any bank data
// before dropping — no data loss).
//
// This test signs in as the real, live, user_type=sales E2E account and
// issues RAW supabase-js calls (not through the app's own functions) to
// prove the restriction is enforced at the database, then confirms a
// non-Sales role (Owner, which the RLS also allows) can read/write it.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-customer-banking-rls');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== CUSTOMER BANKING DETAILS RLS VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

const SALES_IDENTITY = 'E2E Test Account'; // live, approved, user_type = 'sales'
const OWNER_IDENTITY = 'E2E Approver Account'; // live, approved, user_type = 'owner'
const FIXED_PASSWORD = 'E2eFixedTestPassword1234!';

async function signIn(page, fileUrl, identity) {
  await page.goto(fileUrl);
  await page.waitForFunction(() => {
    const s = document.getElementById('auth-identity-select');
    return s && s.options.length > 1;
  }, { timeout: 10000 }).catch(() => null);
  await page.selectOption('#auth-identity-select', identity).catch(() => null);
  await page.fill('#auth-password-input', FIXED_PASSWORD).catch(() => null);
  await page.click('#cloud-login-body button[onclick="handleSignIn()"]').catch(() => null);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 15000 }).catch(() => null);
  return page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';

  currentStep = 'customer-form-no-bank-fields';
  await page.goto(fileUrl);
  const salesFormCheck = await page.evaluate(() => {
    const draft = { name: '', contactPerson: '', tel: '', address: '' };
    return {
      createCustomerHasNoBankParams: typeof createCustomer === 'function' && !createCustomer.toString().includes('bankAccountNumber')
    };
  }).catch(() => ({ createCustomerHasNoBankParams: false }));
  record('createCustomer() no longer accepts/sets bank fields (moved to Accounts\' own tool)', salesFormCheck.createCustomerHasNoBankParams ? 'PASS' : 'FAIL', JSON.stringify(salesFormCheck));

  currentStep = 'sign-in-sales';
  const salesIn = await signIn(page, fileUrl, SALES_IDENTITY);
  record('Signs in as the real, live, user_type=sales E2E account', salesIn ? 'PASS' : 'FAIL');
  if (!salesIn) { printReport(); await browser.close(); process.exit(1); }
  await page.waitForTimeout(1500);

  currentStep = 'create-customer-live';
  const stamp = Date.now();
  const cust = await page.evaluate((stamp) => {
    const c = createCustomer({ name: 'Banking RLS Client ' + stamp, contactPerson: 'Huda', tel: '39' + String(stamp).slice(-6), address: 'Manama' });
    return { id: c.id };
  }, stamp);
  await page.waitForTimeout(1000);
  record('A real customer exists to attach banking details to', cust.id ? 'PASS' : 'FAIL', JSON.stringify(cust));

  currentStep = 'raw-read-as-sales';
  const salesRead = await page.evaluate(async (customerId) => {
    const { data, error } = await sb.from('customer_banking_details').select('*').eq('customer_id', customerId);
    return { rowCount: data ? data.length : null, errorMessage: error ? error.message : null };
  }, cust.id);
  record('A raw read of customer_banking_details as Sales returns zero rows (RLS-filtered, not an error — no data to see yet anyway)', salesRead.rowCount === 0 ? 'PASS' : 'FAIL', JSON.stringify(salesRead));

  currentStep = 'raw-write-as-sales';
  const salesWrite = await page.evaluate(async (customerId) => {
    const { error } = await sb.from('customer_banking_details').insert({ customer_id: customerId, bank_account_number: '1234567890', bank_name: 'Smuggled Bank' });
    return { errorMessage: error ? error.message : null };
  }, cust.id);
  record('A raw insert into customer_banking_details as Sales is REJECTED by RLS', !!salesWrite.errorMessage ? 'PASS' : 'FAIL', JSON.stringify(salesWrite));
  await shot(page, 'sales-rejected', 1);

  currentStep = 'sign-out';
  await page.evaluate(() => sb.auth.signOut());
  await page.waitForTimeout(500);

  currentStep = 'sign-in-owner';
  const ownerIn = await signIn(page, fileUrl, OWNER_IDENTITY);
  record('Signs in as the real, live, user_type=owner E2E account', ownerIn ? 'PASS' : 'FAIL');
  await page.waitForTimeout(1500);

  currentStep = 'save-via-real-function-as-owner';
  const ownerSave = await page.evaluate((customerId) => {
    return saveBankingDetailsForCustomer(customerId, { bankAccountNumber: '9988776655', bankAccountHolderName: 'Banking RLS Client', ibanNumber: 'BH00TEST0000000000000001', bankSwift: 'TESTBHXX', bankName: 'Test Bank', bankBranch: 'Manama Main' }, 'E2E Approver Account');
  }, cust.id);
  await page.waitForTimeout(1200);
  record('saveBankingDetailsForCustomer() (the real app function) succeeds for Owner', ownerSave && !ownerSave.error && ownerSave.bankAccountNumber === '9988776655' ? 'PASS' : 'FAIL', JSON.stringify(ownerSave));

  currentStep = 'verify-persisted-and-readable-as-owner';
  const ownerRead = await page.evaluate(async (customerId) => {
    const { data, error } = await sb.from('customer_banking_details').select('*').eq('customer_id', customerId).maybeSingle();
    return { errorMessage: error ? error.message : null, bankAccountNumber: data ? data.bank_account_number : null };
  }, cust.id);
  record('The saved banking details actually persisted live and are readable by Owner', !ownerRead.errorMessage && ownerRead.bankAccountNumber === '9988776655' ? 'PASS' : 'FAIL', JSON.stringify(ownerRead));
  await shot(page, 'owner-saved', 2);

  currentStep = 'confirm-bank-columns-gone-from-customers';
  const customersRowCheck = await page.evaluate(async (customerId) => {
    const { data } = await sb.from('customers').select('*').eq('id', customerId).maybeSingle();
    return { hasBankAccountNumberColumn: data ? Object.prototype.hasOwnProperty.call(data, 'bank_account_number') : null };
  }, cust.id);
  record('The customers table itself no longer has any bank_account_number column at all (fully removed, not just hidden)', customersRowCheck.hasBankAccountNumberColumn === false ? 'PASS' : 'FAIL', JSON.stringify(customersRowCheck));

  currentStep = 'final';
  const critical = consoleErrors.filter(e => !e.text.includes('favicon') && e.step !== 'raw-write-as-sales');
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
