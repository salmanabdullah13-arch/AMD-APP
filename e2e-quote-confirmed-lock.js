/**
 * e2e-quote-confirmed-lock.js — a confirmed quote is frozen (9 Aug 2026)
 *
 * Salman: "once a quote is confirmed, the edit tab and discount tab is still
 * accessible. It should be greyed out."
 *
 * Before this there was exactly ONE gate on quotation editing anywhere in the
 * app — `q.stage === 'sales'` on Sales' Edit Quote tile — and approveQuotation()
 * sets stage back to "sales" so Sales can confirm, so a confirmed quote sat at
 * that exact stage and the gate never fired.
 *
 * These are GREYED locks, not removals, so each control gets the three
 * assertions the codebase uses for that case (e2e-job-routing-gate...js:89):
 * it renders as not-allowed, clicking it does not navigate, and the underlying
 * data function refuses when called directly.
 */
const { chromium } = require('@playwright/test');
const path = require('path');

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  // Seed through the real chain, the way e2e-edit-quote-lock.js does.
  const seed = await page.evaluate(() => {
    const c = createCustomer({ name: 'Freeze Co', contactPerson: 'A', tel: '39554433', address: 'Manama' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: c.tel,
      source: 'walk inn', salesPerson: 'Silva' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Freeze Test' });
    addQuotationItem(q.id, { product: 'TV Unit', qty: 2, unit: 'Nos', vatPercent: 10 });
    addBOMMaterial(q.id, 1, { name: 'Ply 18mm', qty: 4, unit: 'Nos', rate: 25 });
    submitItemBOM(q.id, 1, 'Arun Kumar A');
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah');
    const openRate = q.items[0].rate;
    const job = confirmQuotationToJobCard(q.id, 'Silva');
    return { qtnId: q.id, jobId: job.id, openRate, amount: job.amount };
  });
  check('seeded a confirmed quote with a real Job Card', !!seed.jobId && seed.amount > 0, seed);

  console.log('\n— the data layer refuses, not just the screens —');
  const refusals = await page.evaluate(id => {
    const q = quotations.find(x => x.id === id);
    const before = { items: q.items.length, rate: q.items[0].rate, stage: q.stage };
    const call = fn => { try { const r = fn(); return (r && r.error) ? 'refused' : 'ALLOWED'; } catch (e) { return 'threw'; } };
    const out = {
      addItem:    call(() => addQuotationItem(id, { product: 'Sneak', qty: 1, unit: 'Nos', vatPercent: 10 })),
      removeItem: call(() => removeQuotationItem(id, 1)),
      updateItem: call(() => updateQuotationItemFields(id, 1, { qty: 99 })),
      copySection:call(() => copyQuoteSection(id, undefined, undefined)),
      discount:   call(() => setQuoteDiscount(id, 100)),
      bomMat:     call(() => addBOMMaterial(id, 1, { name: 'X', qty: 1, unit: 'Nos', rate: 5 })),
      bomLabour:  call(() => addBOMLabour(id, 1, { department: 'carp', calcMode: 'hours', noOfPpl: 1, qty: 1, rate: 5 })),
      submitBOM:  call(() => submitItemBOM(id, 1, 'Arun Kumar A')),
      clearBOM:   call(() => clearItemBOM(id, 1)),
      profitPct:  call(() => setBOMProfitPercent(id, 1, 90)),
      sellOver:   call(() => setBOMSellingOverride(id, 1, 1)),
      correct:    call(() => approverCorrectItem(id, 1, { rate: 1 }, 'reason', 'Approver')),
      finalise:   call(() => finaliseQuotation(id, {})),
      transfer:   call(() => transferQuotationStage(id, 'estimator', 'Approver')),
      deptSeq:    call(() => setItemDepartmentSequence(id, 1, ['uph'])),
      vat:        call(() => applyCustomerUpdate(id, { taxPercent: 0 }))
    };
    out.__unchanged = q.items.length === before.items && q.items[0].rate === before.rate && q.stage === before.stage;
    return out;
  }, seed.qtnId);
  const allowed = Object.entries(refusals).filter(([k, v]) => k !== '__unchanged' && v !== 'refused');
  check('every quotation mutator refuses on a confirmed quote', allowed.length === 0, allowed);
  check('and nothing on the record actually moved', refusals.__unchanged === true);

  // The hole UNDER the old lock: bouncing the stage used to reopen Edit Quote.
  const stillSales = await page.evaluate(id => quotations.find(x => x.id === id).stage, seed.qtnId);
  check('transferQuotationStage() cannot bounce a confirmed quote back to reopen editing',
    refusals.transfer === 'refused' && stillSales === 'sales', { transfer: refusals.transfer, stillSales });

  console.log('\n— what stays open, deliberately —');
  const open = await page.evaluate(id => {
    const dup = duplicateQuotation(id);
    const job = jobCards.find(j => j.quotationId === id);
    const v = createVariationForJob(job.id, 'extra shelf');
    return {
      duplicate: !!(dup && dup.id) && dup.lifecycleStatus === 'draft',
      variation: !!(v && v.id) && v.lifecycleStatus === 'draft',
      comment: !(setLineApproverComment(id, 1, 'noted') || {}).error
    };
  }, seed.qtnId);
  check('Duplicate still works — it makes a NEW draft, it does not edit the confirmed record', open.duplicate);
  check('New Variation still works — a lock that blocks the change path is worse than no lock', open.variation);
  check('Approver comments still work (commentary, no money in them)', open.comment);

  console.log('\n— Sales: greyed, does not navigate —');
  const salesUI = await page.evaluate(id => {
    launchSalesModule();
    openQuotationHub(id);
    const body = document.getElementById('sales-body');
    const tile = label => [...body.querySelectorAll('.qh-pill')].find(t => t.textContent.includes(label));
    const edit = tile('Edit quote'), disc = tile('Raise revision'), print = tile('Print / send'), dup = tile('Duplicate');
    const greyed = el => !!el && el.classList.contains('is-off');
    return {
      editPresent: !!edit, editGreyed: greyed(edit),
      discPresent: !!disc, discGreyed: greyed(disc),
      printLive: !!print && !greyed(print),
      dupLive: !!dup && !greyed(dup),
      banner: /frozen/.test(body.textContent)
    };
  }, seed.qtnId);
  check('Edit Quote renders but is greyed (not hidden — the user should see WHY)',
    salesUI.editPresent && salesUI.editGreyed, salesUI);
  check('Discount renders but is greyed', salesUI.discPresent && salesUI.discGreyed, salesUI);
  check('Print and Duplicate stay live', salesUI.printLive && salesUI.dupLive, salesUI);
  check('a banner explains the freeze and names the Variation route', salesUI.banner);

  // Clicking a greyed tile must not navigate — the behavioural half.
  await page.evaluate(() => { salesView = 'qtn-hub'; });
  const editTile = await page.$('#sales-body .qh-pill:has-text("Edit quote")');
  if (editTile) await editTile.click();
  await page.waitForTimeout(150);
  const stayed = await page.evaluate(() => salesView);
  check('clicking the greyed Edit Quote tile does not open the wizard', stayed === 'qtn-hub', stayed);

  // ...and the wizard refuses even when called directly (jobs.js proves it is).
  const wizardDirect = await page.evaluate(id => {
    salesView = 'qtn-hub';
    openQuotationWizard(id, 2);
    return salesView;
  }, seed.qtnId);
  check('openQuotationWizard() refuses directly, so the tile lock is not bypassable',
    wizardDirect === 'qtn-hub', wizardDirect);

  console.log('\n— Estimator and Approver —');
  const estUI = await page.evaluate(id => {
    launchEstimatorModule();
    estimatorActiveQtnId = id;
    estimatorView = 'index';
    renderEstimatorBody();
    const body = document.getElementById('estimator-body');
    const btns = [...body.querySelectorAll('button')];
    const dead = label => {
      const b = btns.find(x => x.textContent.includes(label));
      return !!b && /not-allowed/.test(b.getAttribute('style') || '');
    };
    return {
      banner: /frozen/.test(body.textContent),
      clearDead: dead('Clear BOM'),
      uploadDead: dead('Upload filled Excel'),
      noReviewSend: !btns.some(b => b.textContent.includes('Review & Send to Approver'))
    };
  }, seed.qtnId);
  check('Estimation Index banners the freeze and greys Clear BOM / Excel upload',
    estUI.banner && estUI.clearDead && estUI.uploadDead, estUI);
  check('and drops "Review & Send to Approver" — there is nowhere to send it', estUI.noReviewSend, estUI);

  const edUI = await page.evaluate(id => {
    EstimatorUI.state.qtnId = id;
    EstimatorUI.setView('quote');
    const body = document.getElementById('estimator-body');
    const discInput = body.querySelector('input[type="number"]');
    return {
      banner: /frozen/.test(body.textContent),
      discountDisabled: !!discInput && discInput.disabled,
      noDiscHook: !body.querySelector('[data-act-input="disc"]'),
      noStageHook: !body.querySelector('[data-act="tostage"]'),
      dupStillLive: !!body.querySelector('[data-act="dup"]')
    };
  }, seed.qtnId);
  check('EstimatorUI disables the discount input and drops its write hook',
    edUI.discountDisabled && edUI.noDiscHook, edUI);
  check('EstimatorUI drops the stage-move hooks but keeps Duplicate',
    edUI.noStageHook && edUI.dupStillLive, edUI);

  const aprUI = await page.evaluate(id => {
    launchApproverModule();
    approverActiveQtnId = id;
    approverView = 'review';
    renderApproverBody();
    const body = document.getElementById('approver-body');
    return {
      deleteFrozen: /Confirmed — this quote is frozen/.test(body.innerHTML) ||
                    !/approverDeleteItem/.test(body.innerHTML),
      noDeleteAction: !/approverDeleteItem/.test(body.innerHTML)
    };
  }, seed.qtnId);
  check('Approver cannot delete a line on a confirmed quote', aprUI.noDeleteAction, aprUI);

  console.log('\n— cancelling the job unlocks it again (Salman\'s call) —');
  const afterCancel = await page.evaluate(id => {
    const job = jobCards.find(j => j.quotationId === id && j.status !== 'cancelled');
    setJobStatus(job.id, 'cancelled');
    const q = quotations.find(x => x.id === id);
    const out = {
      lockCleared: !quotationLock(q),
      lifecycleUntouched: q.lifecycleStatus === 'confirmed',   // history is not rewritten
      editAllowed: !(addQuotationItem(id, { product: 'Corrected', qty: 1, unit: 'Nos', vatPercent: 10 }) || {}).error
    };
    launchSalesModule();
    openQuotationHub(id);
    const body = document.getElementById('sales-body');
    const edit = [...body.querySelectorAll('.qh-pill')].find(t => t.textContent.includes('Edit Quote'));
    out.editLive = !!edit && !edit.classList.contains('is-off');
    const re = confirmQuotationToJobCard(id, 'Silva');
    out.reconfirmed = re.error || re.id;
    return out;
  }, seed.qtnId);
  check('a cancelled Job Card unlocks its quotation', afterCancel.lockCleared && afterCancel.editAllowed, afterCancel);
  check('lifecycleStatus stays "confirmed" — the audit trail is not rewritten',
    afterCancel.lifecycleUntouched, afterCancel);
  check('the Edit Quote tile is live again', afterCancel.editLive, afterCancel);
  check('and the corrected quote can be re-confirmed into a fresh Job Card',
    typeof afterCancel.reconfirmed === 'string' && afterCancel.reconfirmed.startsWith('JB'), afterCancel);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
