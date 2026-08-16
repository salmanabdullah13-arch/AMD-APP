// Verification for the shared approver hat (15 Aug 2026).
//
// Salman: "I'm the approver, Salman Abdullah. As the owner I wear the approver
// hat — I want to pass the hat to Operations, or at least share the hat."
//
// Shared, not passed: Operations approves a quote up to
// QUOTE_APPROVAL_THRESHOLD; above it Operations RECOMMENDS and the Owner
// counter-signs. Mirrors the department-budget two-step that has worked since
// 5 Aug, so there is one escalation mechanism in the app, not two.
//
// These are money-authority rules, so every check drives the real data layer
// and asserts on real record state — never on rendered text.

const { chromium } = require('@playwright/test');
const path = require('path');

let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => { await d.accept('over budget for this client'); });

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  // A quote of a chosen value, parked at the approver stage.
  const mkQuote = async (name, lineValue) => page.evaluate(({ name, lineValue }) => {
    const c = createCustomer({ name, contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'Manama' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: name + ' project', taxPercent: 0, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Fit-out package', qty: 1, unit: 'Nos' });
    // Pricing is BOM-locked, so set the selling value the way the Estimator
    // really does — a submitted BOM with an explicit selling override.
    const it = quotations.find(x => x.id === q.id).items[0];
    addBOMMaterial(q.id, it.lineId, { itemName: itemMaster[0].name, qty: 1, rate: 10, unit: itemMaster[0].unit });
    setBOMSellingOverride(q.id, it.lineId, lineValue);
    submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
    transferQuotationStage(q.id, 'estimator', 'Salman Abdullah');
    pickQuotation(q.id, 'Arun Kumar A', 'estimator');
    transferQuotationStage(q.id, 'approver', 'Arun Kumar A');
    return { id: q.id, value: quoteSellingValue(quotations.find(x => x.id === q.id)) };
  }, { name, lineValue });

  console.log('\n— the threshold —');
  const thr = await page.evaluate(() => QUOTE_APPROVAL_THRESHOLD);
  check('the quote threshold is its own constant, separate from the budget one',
    thr === 8000 && thr !== 5000, { quote: thr });

  console.log('\n— Operations holds the hat under the threshold —');
  const small = await mkQuote('Hat Small Co', 3000);
  check('a small quote is priced through a real submitted BOM', small.value === 3000, small);
  const opsSmall = await page.evaluate((id) => {
    const r = approveQuotation(id, 'Operations Manager', 'operations_manager');
    const q = quotations.find(x => x.id === id);
    return { err: r && r.error, lifecycle: q.lifecycleStatus, stage: q.stage, review: q.ownerReviewStatus || null };
  }, small.id);
  check('Operations approves it outright — Open, no Owner step',
    !opsSmall.err && opsSmall.lifecycle === 'open' && opsSmall.stage === 'sales' && opsSmall.review === null, opsSmall);

  console.log('\n— above the threshold it becomes a recommendation —');
  const big = await mkQuote('Hat Big Co', 12480);
  const opsBig = await page.evaluate((id) => {
    const r = approveQuotation(id, 'Operations Manager', 'operations_manager');
    const q = quotations.find(x => x.id === id);
    return {
      err: r && r.error, lifecycle: q.lifecycleStatus, review: q.ownerReviewStatus || null,
      recommendedBy: q.recommendedBy || null,
      inOwnerInbox: getQuotesAwaitingOwnerReview().some(x => x.id === id),
      ownerMessaged: messages.some(m => m.to === 'Owner' && String(m.body).includes(id))
    };
  }, big.id);
  check('Operations cannot make it Open on its own — it stays a draft',
    opsBig.lifecycle === 'draft' && opsBig.review === 'pending-owner-review', opsBig);
  check('the recommendation is recorded against the person who made it',
    opsBig.recommendedBy === 'Operations Manager', opsBig);
  check('it lands in the Owner\'s counter-signature inbox', opsBig.inOwnerInbox, opsBig);
  check('the Owner is messaged, not left to notice it', opsBig.ownerMessaged, opsBig);

  const reApprove = await page.evaluate((id) => {
    const r = approveQuotation(id, 'Operations Manager', 'operations_manager');
    return r && r.error;
  }, big.id);
  check('Operations cannot approve it a second time to force it through',
    /awaiting the Owner/i.test(reApprove || ''), reApprove);

  console.log('\n— the Owner counter-signs —');
  const signed = await page.evaluate((id) => {
    const r = approveQuotationOwnerReview(id, 'Salman Abdullah', 'owner');
    const q = quotations.find(x => x.id === id);
    return {
      err: r && r.error, lifecycle: q.lifecycleStatus, review: q.ownerReviewStatus || null,
      counterSignedBy: q.counterSignedBy || null,
      audit: (q.auditLog || []).map(a => a.action)
    };
  }, big.id);
  check('the Owner\'s counter-signature makes it Open',
    !signed.err && signed.lifecycle === 'open' && signed.review === null, signed);
  check('both signatures are on the audit trail, not just the last one',
    signed.audit.includes('Recommend') && signed.audit.includes('Counter-sign'), signed.audit);

  console.log('\n— who may hold the hat —');
  const roles = await page.evaluate(async () => {
    const out = {};
    const mk = (nm) => {
      const c = createCustomer({ name: nm, contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'M' });
      const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
      const q = convertEnquiryToQuotation(e.id, { projectName: nm, taxPercent: 0, contactPerson: 'A' });
      addQuotationItem(q.id, { product: 'Thing', qty: 1, unit: 'Nos' });
      transferQuotationStage(q.id, 'approver', 'E');
      return q.id;
    };
    out.sales = (approveQuotation(mk('RoleSales'), 'A Salesperson', 'sales') || {}).error || null;
    out.joinery = (approveQuotation(mk('RoleJoinery'), 'A Manager', 'joinery_production_manager') || {}).error || null;
    const okId = mk('RoleOps');
    const okRes = approveQuotation(okId, 'Operations Manager', 'operations_manager');
    out.opsOk = !(okRes && okRes.error);
    return out;
  });
  check('Sales cannot approve a quotation', /role can't approve/i.test(roles.sales || ''), roles.sales);
  check('a production role cannot approve a quotation', /role can't approve/i.test(roles.joinery || ''), roles.joinery);
  check('Operations can', roles.opsOk, roles);

  console.log('\n— maker-checker —');
  const maker = await page.evaluate(() => {
    const c = createCustomer({ name: 'MakerChecker Co', contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'M' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'MakerChecker', taxPercent: 0, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Thing', qty: 1, unit: 'Nos' });
    transferQuotationStage(q.id, 'estimator', 'Salman Abdullah');
    pickQuotation(q.id, 'Arun Kumar A', 'estimator');
    transferQuotationStage(q.id, 'approver', 'Arun Kumar A');
    const self = approveQuotation(q.id, 'Arun Kumar A', 'owner');       // the estimator, even as owner
    const other = approveQuotation(q.id, 'Salman Abdullah', 'owner');
    return { self: self && self.error, otherOk: !(other && other.error) };
  });
  check('the Estimator who costed a quote cannot approve it, whatever their role',
    /can't also approve/i.test(maker.self || ''), maker.self);
  check('someone else can', maker.otherOk, maker);

  console.log('\n— the Owner cannot counter-sign their own recommendation —');
  const selfSign = await page.evaluate(async () => {
    const c = createCustomer({ name: 'SelfSign Co', contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'M' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'SelfSign', taxPercent: 0, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Thing', qty: 1, unit: 'Nos' });
    const it = quotations.find(x => x.id === q.id).items[0];
    addBOMMaterial(q.id, it.lineId, { itemName: itemMaster[0].name, qty: 1, rate: 10, unit: itemMaster[0].unit });
    setBOMSellingOverride(q.id, it.lineId, 20000);
    submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
    transferQuotationStage(q.id, 'approver', 'E');
    approveQuotation(q.id, 'Salman Abdullah', 'operations_manager');   // recommends as Ops
    const r = approveQuotationOwnerReview(q.id, 'Salman Abdullah', 'owner');
    return r && r.error;
  });
  check('the same person cannot both recommend and counter-sign',
    /can't also counter-sign/i.test(selfSign || ''), selfSign);

  console.log('\n— sending one back needs a reason —');
  const decline = await page.evaluate(() => {
    const q = getQuotesAwaitingOwnerReview()[0];
    if (!q) return { none: true };
    const blank = rejectQuotationOwnerReview(q.id, 'Salman Abdullah', '   ', 'owner');
    const real = rejectQuotationOwnerReview(q.id, 'Salman Abdullah', 'Margin too thin for this client', 'owner');
    const after = quotations.find(x => x.id === q.id);
    return {
      blankErr: blank && blank.error,
      backToOps: !(real && real.error) && after.ownerReviewStatus === null && after.lifecycleStatus === 'draft',
      reasonLogged: activityLog.some(a => a.linkedId === q.id && /Margin too thin/.test(a.message || ''))
    };
  });
  check('declining without a reason is refused', /reason is required/i.test(decline.blankErr || ''), decline);
  check('declining sends it back as a draft, not to Open', decline.backToOps, decline);
  check('the reason is on the record', decline.reasonLogged, decline);

  console.log('\n— the Owner\'s inbox surfaces it —');
  const inbox = await page.evaluate(async () => {
    // put one back in the queue
    const c = createCustomer({ name: 'Inbox Co', contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'M' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Inbox project', taxPercent: 0, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Thing', qty: 1, unit: 'Nos' });
    const it = quotations.find(x => x.id === q.id).items[0];
    addBOMMaterial(q.id, it.lineId, { itemName: itemMaster[0].name, qty: 1, rate: 10, unit: itemMaster[0].unit });
    setBOMSellingOverride(q.id, it.lineId, 15000);
    submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
    transferQuotationStage(q.id, 'approver', 'E');
    approveQuotation(q.id, 'Operations Manager', 'operations_manager');

    launchOwnerModule();
    await new Promise(r => setTimeout(r, 400));
    ownerOpenBudgetReviews();
    await new Promise(r => setTimeout(r, 250));
    const body = document.getElementById('owner-body');
    return { id: q.id, html: body.innerHTML.includes(q.id), heading: /Quotes to counter-sign/i.test(body.textContent) };
  });
  check('the Owner\'s Sign-offs screen lists the quote', inbox.html, inbox);
  check('quotes and budgets share one inbox, each under its own heading', inbox.heading, inbox);

  const signedFromUi = await page.evaluate(async (id) => {
    const btn = [...document.querySelectorAll('#owner-body button')]
      .find(b => (b.getAttribute('onclick') || '').includes("ownerQuoteSignOff('" + id + "')"));
    if (!btn) return { noButton: true };
    btn.click();
    await new Promise(r => setTimeout(r, 300));
    const q = quotations.find(x => x.id === id);
    return { lifecycle: q.lifecycleStatus, review: q.ownerReviewStatus || null };
  }, inbox.id);
  check('counter-signing from the real button opens the quote',
    signedFromUi.lifecycle === 'open' && signedFromUi.review === null, signedFromUi);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 4));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
