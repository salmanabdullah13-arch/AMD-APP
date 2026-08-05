// Verification for Phase 3 (5 Aug 2026) — server-side enforcement of
// the pricing-lock rule (a real, non-negotiable fraud-prevention rule:
// Sales staff previously used an editable-price field on quotations to
// defraud the company). addQuotationItem()/data.js already zeroes
// rate/amount for Sales client-side, but until now RLS placed zero
// restriction on quotations UPDATE beyond "any approved user" — a
// Sales-role login could call the Supabase REST API directly (bypassing
// the app's own JS entirely) and write any price into any quotation.
//
// This test goes around the app's own functions on purpose — it signs
// in as the real 'E2E Test Account' (a live, approved, user_type =
// 'sales' account already used by 4 other cloud tests), then calls the
// raw Supabase client (`sb.from('quotations').update(...)`) directly
// from the page, exactly as someone inspecting network calls and
// replaying them would. Proves the new `quotation_pricing_lock`
// trigger (supabase/schema.sql) rejects it at the DATABASE, not just
// hides the field in the UI.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-pricing-lock-rls');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
async function shot(page, label, n) { await page.screenshot({ path: path.join(SHOT_DIR, `${String(n).padStart(2, '0')}-${label}.png`) }); }
function printReport() {
  console.log('\n=== PRICING-LOCK RLS/TRIGGER VERIFICATION ===');
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

  currentStep = 'sign-in-sales';
  const salesIn = await signIn(page, fileUrl, SALES_IDENTITY);
  record('Signs in as the real, live, user_type=sales E2E account (real cloud login, not the offline bypass)', salesIn ? 'PASS' : 'FAIL');
  if (!salesIn) { printReport(); await browser.close(); process.exit(1); }
  await page.waitForTimeout(1500);

  currentStep = 'create-quotation-live';
  const stamp = Date.now();
  const setup = await page.evaluate(async (stamp) => {
    const cust = createCustomer({ name: 'Pricing Lock RLS Client ' + stamp, contactPerson: 'Sara', tel: '39' + String(stamp).slice(-6), address: 'Manama' });
    await new Promise(r => setTimeout(r, 600));
    const enq = createEnquiry({ division: 'Furniture', customerId: cust.id, contactPerson: 'Sara', tel: cust.tel, source: 'walk inn', salesPerson: 'E2E Test Account' });
    await new Promise(r => setTimeout(r, 600));
    const qtn = convertEnquiryToQuotation(enq.id, { projectName: 'Pricing Lock RLS Project ' + stamp, taxPercent: 10, contactPerson: 'Sara' });
    await new Promise(r => setTimeout(r, 600));
    const item = addQuotationItem(qtn.id, { product: 'Test Cabinet', qty: 1, unit: 'Nos' });
    await new Promise(r => setTimeout(r, 800));
    return { qtnId: qtn.id, lineId: item.lineId, initialRate: item.rate, initialAmount: item.amount };
  }, stamp);
  record('A real quotation + zero-priced line exists, created the normal client way (rate/amount both 0)', setup.initialRate === 0 && setup.initialAmount === 0 ? 'PASS' : 'FAIL', JSON.stringify(setup));

  currentStep = 'raw-tamper-attempt-as-sales';
  const tamperAttempt = await page.evaluate(async ({ qtnId, lineId }) => {
    const { data: row } = await sb.from('quotations').select('items').eq('id', qtnId).single();
    const items = row.items.map(it => it.lineId === lineId ? { ...it, rate: 9999, amount: 9999, netAmount: 9999 } : it);
    const { error } = await sb.from('quotations').update({ items }).eq('id', qtnId);
    const { data: after } = await sb.from('quotations').select('items').eq('id', qtnId).single();
    const afterItem = after.items.find(it => it.lineId === lineId);
    return { errorMessage: error ? error.message : null, rateAfter: afterItem.rate, amountAfter: afterItem.amount };
  }, { qtnId: setup.qtnId, lineId: setup.lineId });
  record(
    'A raw supabase-js .update() call as Sales trying to set rate/amount to 9999 is REJECTED by the database trigger — the row is unchanged',
    !!tamperAttempt.errorMessage && tamperAttempt.errorMessage.toLowerCase().includes('pricing') && tamperAttempt.rateAfter === 0 && tamperAttempt.amountAfter === 0 ? 'PASS' : 'FAIL',
    JSON.stringify(tamperAttempt)
  );
  await shot(page, 'tamper-rejected', 1);

  currentStep = 'raw-non-pricing-update-as-sales';
  const nonPricingAttempt = await page.evaluate(async ({ qtnId, lineId }) => {
    const { data: row } = await sb.from('quotations').select('items').eq('id', qtnId).single();
    const items = row.items.map(it => it.lineId === lineId ? { ...it, description: 'Updated by Sales, non-pricing' } : it);
    const { error } = await sb.from('quotations').update({ items }).eq('id', qtnId);
    const { data: after } = await sb.from('quotations').select('items').eq('id', qtnId).single();
    return { errorMessage: error ? error.message : null, descriptionAfter: after.items.find(it => it.lineId === lineId).description };
  }, { qtnId: setup.qtnId, lineId: setup.lineId });
  record(
    'A non-pricing field update (description) by the same Sales user still succeeds — the trigger isn\'t blocking everything',
    !nonPricingAttempt.errorMessage && nonPricingAttempt.descriptionAfter === 'Updated by Sales, non-pricing' ? 'PASS' : 'FAIL',
    JSON.stringify(nonPricingAttempt)
  );

  currentStep = 'raw-new-line-with-price-as-sales';
  const newLineAttempt = await page.evaluate(async (qtnId) => {
    const { data: row } = await sb.from('quotations').select('items').eq('id', qtnId).single();
    const items = [...row.items, { lineId: 999, product: 'Smuggled Line', qty: 1, unit: 'Nos', rate: 500, amount: 500, netAmount: 500, vatPercent: 0, discPercent: 0, discAmt: 0, bom: null }];
    const { error } = await sb.from('quotations').update({ items }).eq('id', qtnId);
    return { errorMessage: error ? error.message : null };
  }, setup.qtnId);
  record('Sales adding a brand-new line with nonzero pricing via a raw update is also rejected', !!newLineAttempt.errorMessage ? 'PASS' : 'FAIL', JSON.stringify(newLineAttempt));

  currentStep = 'sign-out';
  await page.evaluate(() => sb.auth.signOut());
  await page.waitForTimeout(500);

  currentStep = 'sign-in-owner';
  const ownerIn = await signIn(page, fileUrl, OWNER_IDENTITY);
  record('Signs in as the real, live, user_type=owner E2E account', ownerIn ? 'PASS' : 'FAIL');

  currentStep = 'raw-price-update-as-owner';
  const ownerAttempt = await page.evaluate(async ({ qtnId, lineId }) => {
    const { data: row } = await sb.from('quotations').select('items').eq('id', qtnId).single();
    const items = row.items.map(it => it.lineId === lineId ? { ...it, rate: 120, amount: 120, netAmount: 120 } : it);
    const { error } = await sb.from('quotations').update({ items }).eq('id', qtnId);
    const { data: after } = await sb.from('quotations').select('items').eq('id', qtnId).single();
    return { errorMessage: error ? error.message : null, rateAfter: after.items.find(it => it.lineId === lineId).rate };
  }, { qtnId: setup.qtnId, lineId: setup.lineId });
  record(
    'The same raw pricing update, made by a non-Sales role (Owner), succeeds — the trigger is scoped to Sales only, not everyone',
    !ownerAttempt.errorMessage && ownerAttempt.rateAfter === 120 ? 'PASS' : 'FAIL',
    JSON.stringify(ownerAttempt)
  );

  currentStep = 'final';
  // The two 400s from 'raw-tamper-attempt-as-sales' and
  // 'raw-new-line-with-price-as-sales' ARE the trigger correctly
  // rejecting those requests — that's the thing under test, not a bug.
  const critical = consoleErrors.filter(e => !e.text.includes('favicon') && !(e.step === 'raw-tamper-attempt-as-sales' || e.step === 'raw-new-line-with-price-as-sales'));
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
