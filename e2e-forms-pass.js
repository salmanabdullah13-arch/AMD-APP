/**
 * e2e-forms-pass.js — the comprehensive forms pass (Salman, 6 Sep 2026).
 * His ten minutes on the quotation wizard found five defects four scripted
 * iterations had missed, all of one kind: the screen, not the flow. This
 * covers every other instance the two audit harnesses found —
 * `forms-audit-static.js` (refusals thrown away) and `forms-audit-dom.js`
 * (selects that open pre-answered, unguarded numbers) — and asserts the
 * harnesses themselves still read zero, so the class cannot come back.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const { execFileSync } = require('child_process');
let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } };
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => { loadDemoData(); execAutoAlerted = true; window.__toasts = []; ['salesAlert', 'purchAlert', 'estimatorAlert', 'jobsAlert'].forEach(n => { const o = window[n]; if (typeof o === 'function') window[n] = (m) => { window.__toasts.push(String(m)); return o(m); }; }); });
  const lastToast = () => page.evaluate(() => window.__toasts[window.__toasts.length - 1] || '');

  console.log('\n— refusals reach the screen —');
  // A confirmed quotation refuses a line removal; the ✕ used to do nothing, silently.
  const removal = await page.evaluate(() => {
    const q = quotations.find(x => x.lifecycleStatus === 'confirmed' && (x.items || []).length) || (() => {
      const c = createCustomer({ name: 'Forms Co', contactPerson: 'A', tel: '39001234', address: 'x' });
      const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Karthik Silva' });
      const qq = convertEnquiryToQuotation(e.id, { projectName: 'Forms', taxPercent: 10, contactPerson: 'A' });
      addQuotationItem(qq.id, { product: 'Panel', qty: 1, unit: 'Nos' });
      transferQuotationStage(qq.id, 'approver', 'E'); approveQuotation(qq.id, 'Owner', 'owner'); confirmQuotationToJobCard(qq.id, 'Sales');
      return quotations.find(x => x.id === qq.id);
    })();
    launchSalesModule(); openQuotationWizard(q.id); salesWizardStep = 2; renderSalesBody();
    const before = q.items.length;
    salesRemoveItem(q.id, q.items[0].lineId);
    return { before, after: q.items.length, toast: window.__toasts[window.__toasts.length - 1] || '' };
  });
  check('Removing a line from a CONFIRMED quotation is refused and the screen says why (the ✕ used to do nothing)', removal.after === removal.before && /frozen|confirmed/i.test(removal.toast), removal);
  // The Estimator's cost fields on a frozen quote.
  const est = await page.evaluate(() => {
    const q = quotations.find(x => x.lifecycleStatus === 'confirmed' && (x.items || []).length);
    if (!q) return { skipped: true };
    launchEstimatorModule(); estimatorActiveQtnId = q.id; estimatorActiveLineId = q.items[0].lineId;
    window.__toasts.length = 0; estimatorSetProfit(45);
    return { toast: window.__toasts[window.__toasts.length - 1] || '' };
  });
  check("The Estimator's profit % on a frozen quote is refused out loud, not redrawn as if nothing was typed", /frozen|confirmed/i.test(est.toast || ''), est);

  console.log('\n— fields that become a record are chosen, not defaulted —');
  await page.evaluate(() => { hideModuleWrap(document.getElementById('estimator-module-wrap')); hideModuleWrap(document.getElementById('sales-module-wrap')); launchSalesModule(); openEnquiryCreate(); });
  await page.waitForTimeout(250);
  const enq = await page.evaluate(() => {
    const sels = [...document.querySelectorAll('#sales-body select')];
    const div = sels.find(s => (s.getAttribute('onchange') || '').includes("'division'"));
    const src = sels.find(s => (s.getAttribute('onchange') || '').includes("'source'"));
    return { div: div && div.value, divFirst: div && div.options[0].textContent.trim(), src: src && src.value, draftDiv: salesDraft.division, draftSrc: salesDraft.source };
  });
  check('A new enquiry opens with Division and Source unanswered (they used to read "Curtain & Blinds" and the first source)', enq.div === '' && enq.src === '' && /Choose/.test(enq.divFirst || '') && enq.draftDiv === '' && enq.draftSrc === '', enq);
  const enqGuard = await page.evaluate(() => {
    salesDraft.contactPerson = 'A'; salesDraft.tel = '39001111'; salesDraft.prospectName = 'Walk-in';
    window.__toasts.length = 0; const n = enquiries.length; saveEnquiryCreate();
    const noDiv = { made: enquiries.length - n, toast: window.__toasts[window.__toasts.length - 1] };
    salesDraft.division = 'Joinery'; window.__toasts.length = 0; saveEnquiryCreate();
    const noSrc = { made: enquiries.length - n, toast: window.__toasts[window.__toasts.length - 1] };
    salesDraft.source = 'walk inn'; window.__toasts.length = 0; saveEnquiryCreate();
    return { noDiv, noSrc, made: enquiries.length - n, last: window.__toasts[window.__toasts.length - 1] };
  });
  check('Saving without a Division is refused; then without a Source; then it saves', enqGuard.noDiv.made === 0 && /Division/.test(enqGuard.noDiv.toast || '') && enqGuard.noSrc.made === 0 && /Source/.test(enqGuard.noSrc.toast || '') && enqGuard.made === 1, enqGuard);

  await page.evaluate(() => { hideModuleWrap(document.getElementById('sales-module-wrap')); launchPurchasingModule(); openPRForm(); });
  await page.waitForTimeout(250);
  const pr = await page.evaluate(() => ({
    division: document.getElementById('pr-form-division').value,
    dept: document.getElementById('pr-form-dept').value,
    dest: document.getElementById('pr-form-dest').value,
    destFirst: document.getElementById('pr-form-dest').options[0].textContent.trim(),
    draft: { d: prFormDraft.division, p: prFormDraft.department, t: prFormDraft.destinationType }
  }));
  check('A Purchase Request opens with Division, Department and Destination unanswered (Destination used to read "Stock (shared pool)")', pr.division === '' && pr.dept === '' && pr.dest === '' && /Choose/.test(pr.destFirst) && pr.draft.t === '', pr);
  const prGuard = await page.evaluate(() => {
    prFormDraft.items = [{ name: 'MDF sheet', qty: 5, unit: 'Nos', itemRef: null }];
    const n = purchaseRequests.length; window.__toasts.length = 0;
    savePRForm(); const noDiv = { made: purchaseRequests.length - n, toast: window.__toasts[window.__toasts.length - 1] };
    prFormDraft.division = 'Joinery'; window.__toasts.length = 0;
    savePRForm(); const noDept = { made: purchaseRequests.length - n, toast: window.__toasts[window.__toasts.length - 1] };
    prFormDraft.department = 'carp'; window.__toasts.length = 0;
    savePRForm(); const noDest = { made: purchaseRequests.length - n, toast: window.__toasts[window.__toasts.length - 1] };
    return { noDiv, noDept, noDest };
  });
  check('A Purchase Request is refused without a Division, then a Department, then a Destination — never silently filed to stock', prGuard.noDiv.made === 0 && /Division/.test(prGuard.noDiv.toast || '') && prGuard.noDept.made === 0 && /Department/.test(prGuard.noDept.toast || '') && prGuard.noDest.made === 0 && /Destination/.test(prGuard.noDest.toast || ''), prGuard);

  console.log('\n— numbers —');
  const journal = await page.evaluate(() => {
    const led = ledgers[0] && ledgers[0].name;
    const a = ledgers[0].id, b = (ledgers[1] || ledgers[0]).id;   // real lines carry ledgerId + dr/cr
    const bothNeg = createJournal({ lines: [{ ledgerId: a, dr: -100, cr: 0 }, { ledgerId: b, dr: 0, cr: -100 }] });
    const ok = createJournal({ lines: [{ ledgerId: a, dr: 100, cr: 0 }, { ledgerId: b, dr: 0, cr: 100 }] });
    return { bothNeg: bothNeg && bothNeg.error, ok: !!(ok && ok.id) };
  });
  check('A Journal of two NEGATIVE lines is refused, though it balances; a normal one still posts', /negative/i.test(journal.bothNeg || '') && journal.ok, journal);
  const mins = await page.evaluate(() => {
    hideModuleWrap(document.getElementById('purch-module-wrap')); launchAccountsModule(); accountsSetView('receipt-new');
    const nums = [...document.querySelectorAll('#accounts-body input[type=number]')];
    return { n: nums.length, without: nums.filter(i => i.getAttribute('min') === null).map(i => i.id) };
  });
  check('Every amount field on a General Receipt carries min="0" — the spinner cannot go below zero', mins.n > 0 && mins.without.length === 0, mins);

  console.log('\n— the harnesses read zero —');
  const staticOut = execFileSync('node', [path.join(__dirname, 'forms-audit-static.js')], { encoding: 'utf8' });
  check('forms-audit-static.js finds no refusal thrown away anywhere in the app', /A · dropped refusals: 0/.test(staticOut), staticOut.trim().split('\n').slice(-2));
  const domOut = execFileSync('node', [path.join(__dirname, 'forms-audit-dom.js')], { encoding: 'utf8' });
  const m = domOut.match(/pre-answered in create forms: (\d+)[\s\S]*?overflow: (\d+)/);
  // Two are left on purpose and named in the report: a new ledger's tax
  // treatment (Taxable 10% is the norm here) and the enquiry's salesperson,
  // which is correct-by-construction — it IS the signed-in person.
  check('forms-audit-dom.js is down to the two documented, deliberate defaults, and no overflow anywhere', m && Number(m[1]) <= 2 && Number(m[2]) === 0, m && m.slice(1));

  check('zero page errors', errors.length === 0, errors.slice(0, 3));
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
