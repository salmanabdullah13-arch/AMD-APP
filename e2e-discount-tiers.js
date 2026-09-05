/**
 * e2e-discount-tiers.js — F9 of the end-to-end run (Salman, 5 Sep 2026):
 * Sales may discount up to 10%, the Estimator up to 20%, the Owner up to
 * 30%, configurable per role and per person from Admin → Discount Limits.
 * The rule lives in setQuoteDiscount(), so the Estimator screen's discount
 * (previously a screen-only figure) and Sales' discount are one number.
 * Offline; the database trigger is proven live by run-iteration-3.js A12.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } };
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [], dialogs = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  // A priced quotation at the Estimator stage, built through the real functions.
  const q = await page.evaluate(() => {
    const c = createCustomer({ name: 'Tier Test Co', contactPerson: 'A', tel: '39000123', address: 'Seef' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Karthik Silva' });
    const qq = convertEnquiryToQuotation(e.id, { projectName: 'Tier test', taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(qq.id, { product: 'Tier dresser', qty: 2, unit: 'Nos' });
    const it = quotations.find(x => x.id === qq.id).items[0];
    addBOMMaterial(qq.id, it.lineId, { name: itemMaster[0].name, qty: 5, rate: 20, unit: itemMaster[0].unit });
    submitItemBOM(qq.id, it.lineId, 'Arun Kumar A');
    return { id: qq.id, base: quotations.find(x => x.id === qq.id).items.reduce((s, i) => s + i.amount, 0) };
  });
  check('a priced quotation exists to discount', q.base > 0, q);
  const tryPct = (pct, by) => page.evaluate(({ id, pct, by, base }) => { const r = setQuoteDiscount(id, Math.round(base * pct / 100 * 1000) / 1000, by); const qq = quotations.find(x => x.id === id); return { err: r && r.error, applied: Math.round(qq.items[0].discPercent * 10) / 10 }; }, { id: q.id, pct, by, base: q.base });

  console.log('\n— the tiers —');
  let r = await tryPct(15, { userType: 'sales', identity: 'Karthik Silva' });
  check('Sales at 15% is refused, naming the limit and who can', /above your limit of 10%/.test(r.err || '') && /Estimator|Owner/.test(r.err || '') && r.applied === 0, r);
  r = await tryPct(10, { userType: 'sales', identity: 'Karthik Silva' });
  check('Sales at 10% is applied', !r.err && r.applied === 10, r);
  r = await tryPct(25, { userType: 'estimator', identity: 'Arun Kumar A' });
  check('Estimator at 25% is refused (tier 20%) and the 10% stands', /limit of 20%/.test(r.err || '') && r.applied === 10, r);
  r = await tryPct(20, { userType: 'estimator', identity: 'Arun Kumar A' });
  check('Estimator at 20% is applied', !r.err && r.applied === 20, r);
  r = await tryPct(35, { userType: 'owner', identity: 'Salman Abdullah' });
  check('Owner at 35% is refused (tier 30%) — nobody holds a higher tier', /limit of 30%/.test(r.err || '') && /nobody/.test(r.err || '') && r.applied === 20, r);
  r = await tryPct(30, { userType: 'owner', identity: 'Salman Abdullah' });
  check('Owner at 30% is applied', !r.err && r.applied === 30, r);
  r = await tryPct(5, { userType: 'storekeeper', identity: 'X' });
  check('A role with no tier cannot discount at all', /limit of 0%/.test(r.err || ''), r);
  r = await page.evaluate(({ id, base }) => { window.cloudUserType = 'sales'; window.cloudIdentity = 'Karthik Silva'; const a = setQuoteDiscount(id, base * 0.12); window.cloudUserType = 'owner'; return { err: a && a.error }; }, q);
  check('With no explicit caller, the signed-in role is what is judged', /limit of 10%/.test(r.err || ''), r);

  console.log('\n— the master —');
  r = await page.evaluate(({ id, base }) => {
    const a = setDiscountLimit({ kind: 'role', key: 'sales', maxPct: 15, setBy: 'Admin' });
    const s = setQuoteDiscount(id, base * 0.15, { userType: 'sales', identity: 'Karthik Silva' });
    const u = setDiscountLimit({ kind: 'user', key: 'Karthik Silva', maxPct: 5, setBy: 'Admin' });
    const s2 = setQuoteDiscount(id, base * 0.08, { userType: 'sales', identity: 'Karthik Silva' });
    const other = setQuoteDiscount(id, base * 0.08, { userType: 'sales', identity: 'Mohammad Shafeel' });
    const bad = setDiscountLimit({ kind: 'role', key: 'sales', maxPct: 140 });
    const cleared = clearDiscountLimit('user:Karthik Silva');
    const s3 = setQuoteDiscount(id, base * 0.08, { userType: 'sales', identity: 'Karthik Silva' });
    return { role: a && a.id, s: s && s.error, user: u && u.id, s2: s2 && s2.error, other: other && other.error, bad: bad && bad.error, cleared: cleared && cleared.ok, s3: s3 && s3.error, rows: discountLimits.length };
  }, q);
  check('Raising the Sales tier to 15% lets Sales apply 15%', r.role === 'role:sales' && !r.s, r);
  check("A per-person override (5%) wins over the person's role (15%)", r.user === 'user:Karthik Silva' && /limit of 5%/.test(r.s2 || ''), r);
  check('… and does not touch another salesperson', !r.other, r);
  check('A limit outside 0–100 is refused', /between 0 and 100/.test(r.bad || ''), r);
  check('Removing the override restores the role tier', r.cleared && !r.s3 && r.rows === 1, r);
  const reg = await page.evaluate(() => (typeof CLOUD_JSON_COLLECTIONS !== 'undefined' ? CLOUD_JSON_COLLECTIONS : []).some(c => c.table === 'discount_limits'));
  check('The master is a cloud collection (discount_limits), so a change reaches every device', reg);

  console.log('\n— the masters page —');
  await page.evaluate(() => { launchAdminModule(); adminSetView('discounts'); });
  await page.waitForTimeout(500);
  const pg = await page.evaluate(() => ({
    nav: [...document.querySelectorAll('#admin-module-wrap .xs-item .xs-lbl')].map(n => n.textContent.trim()),
    salesInput: document.getElementById('admin-dl-role-sales') && document.getElementById('admin-dl-role-sales').value,
    estInput: document.getElementById('admin-dl-role-estimator') && document.getElementById('admin-dl-role-estimator').value,
    ownerInput: document.getElementById('admin-dl-role-owner') && document.getElementById('admin-dl-role-owner').value,
    userSelect: !!document.getElementById('admin-dl-user')
  }));
  check('Admin\'s sidebar carries Discount Limits', pg.nav.includes('Discount Limits'), pg.nav);
  check('The page shows the current tiers — Sales 15 (raised above), Estimator 20, Owner 30', pg.salesInput === '15' && pg.estInput === '20' && pg.ownerInput === '30', pg);
  await page.fill('#admin-dl-role-sales', '10');
  await page.click('button[onclick="adminSaveDiscountLimit(\'role\',\'sales\')"]');
  await page.waitForTimeout(300);
  const saved = await page.evaluate(({ id, base }) => ({ lim: discountLimitFor('sales', null), s: (setQuoteDiscount(id, base * 0.12, { userType: 'sales', identity: 'Karthik Silva' }) || {}).error, logged: activityLog.some(a => a.type === 'discount-limit-set') }), q);
  check('Saving from the page changes the tier the data layer enforces, and logs it', saved.lim === 10 && /limit of 10%/.test(saved.s || '') && saved.logged, saved);
  await page.selectOption('#admin-dl-user', { index: 1 });
  await page.fill('#admin-dl-user-pct', '25');
  await page.click('button[onclick="adminSaveDiscountLimit(\'user\')"]');
  await page.waitForTimeout(300);
  const ov = await page.evaluate(() => ({ users: discountLimits.filter(d => d.kind === 'user').map(d => d.key + '=' + d.maxPct), shown: document.getElementById('admin-discounts-body').innerText.includes('25%') }));
  check('A per-person override set from the page lands in the master and shows on the page', ov.users.length === 1 && /=25$/.test(ov.users[0]) && ov.shown, ov);

  console.log('\n— the Estimator screen —');
  await page.evaluate(({ id }) => { hideModuleWrap(document.getElementById('admin-module-wrap')); window.cloudUserType = 'estimator'; window.cloudIdentity = 'Arun Kumar A'; launchEstimatorModule(); estimatorView = 'dashboard'; renderEstimatorBody(); EstimatorUI.state.qtnId = id; EstimatorUI.state.view = 'quote'; EstimatorUI.mount(document.getElementById('estimator-body')); }, q).catch(() => null);
  await page.waitForTimeout(500);
  const hasUI = await page.evaluate(() => !!document.querySelector('#estimator-body [data-act-input="disc"]'));
  if (hasUI) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('#estimator-body [data-act="discmode"]')].find(x => x.getAttribute('data-v') === '%'); if (b) b.click(); });
    await page.waitForTimeout(200);
    const el = await page.$('#estimator-body [data-act-input="disc"]');
    // fill() on a type=number input does not reliably fire change (CLAUDE.md §2) — type it the way a person does.
    const typeInto = async (h, v) => { await h.click(); await page.keyboard.press('Control+A'); await page.keyboard.type(v); await page.keyboard.press('Tab'); };
    await typeInto(el, '15');
    await page.waitForTimeout(300);
    const s1 = await page.evaluate(({ id }) => { const qq = quotations.find(x => x.id === id); return { pct: Math.round(qq.items[0].discPercent), quoteDiscount: qq.quoteDiscount, screen: document.getElementById('estimator-body').innerText.includes('Your limit is 20%') }; }, q);
    check('Typing 15% on the Estimator screen applies the REAL per-item discount (one number, not a screen figure)', s1.pct === 15 && s1.quoteDiscount > 0, s1);
    check("The screen names the signed-in role's tier", s1.screen, s1);
    const before = dialogs.length;
    const el2 = await page.$('#estimator-body [data-act-input="disc"]');   // the screen repainted — re-query, never reuse the handle
    await typeInto(el2, '28');
    await page.waitForTimeout(300);
    const s2 = await page.evaluate(({ id }) => ({ pct: Math.round(quotations.find(x => x.id === id).items[0].discPercent), shown: document.body.innerText.includes('limit of 20%') }), q);
    check('Typing 28% (above the Estimator tier) is refused with the reason on screen, and 15% stands', s2.pct === 15 && (s2.shown || /limit of 20%/.test(dialogs[dialogs.length - 1] || '')), { s2, last: dialogs[dialogs.length - 1] });
  } else {
    check('the Estimator quote screen rendered its discount input', false, 'no [data-act-input=disc]');
  }
  await page.evaluate(() => { window.cloudUserType = 'owner'; });

  check('zero page errors', errors.length === 0, errors.slice(0, 3));
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
