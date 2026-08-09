/**
 * e2e-job-record-page.js — Job Card record page (9a) + Job Order print (8a)
 * 9 Aug 2026. Written against the package's own acceptance checklist.
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
  page.on('dialog', d => d.accept('because the site signed off on paper'));

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  const seed = await page.evaluate(() => {
    const c = createCustomer({ name: 'Bayan Villas', contactPerson: 'Mr Khalid', tel: '39112233', address: 'Bayan' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'Mr Khalid', tel: c.tel,
      source: 'walk inn', salesPerson: 'Silva' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Villa 12 Wardrobes' });
    [['Wardrobe carcass', 6, 'Nos'], ['Headboard panel', 2, 'Nos']].forEach(([p, qty, u]) => {
      addQuotationItem(q.id, { product: p, qty, unit: u, vatPercent: 10, group: 'Bedroom', subgroup: 'Master' });
    });
    q.items.forEach(it => {
      addBOMMaterial(q.id, it.lineId, { name: 'Ply 18mm', qty: 4, unit: 'Nos', rate: 25 });
      submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
      setItemDepartmentSequence(q.id, it.lineId, ['carp']);
    });
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah');
    const job = confirmQuotationToJobCard(q.id, 'Silva');
    const target = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    confirmJobRouting(job.id, {}, 'Operations Manager', target);
    job.notes = 'Client wants soft-close hinges throughout.';
    return { jobId: job.id, qtnId: q.id, target, lineIds: job.items.map(i => i.lineId) };
  });
  check('seeded a routed 2-line Joinery job with a target date', !!seed.jobId, seed);

  console.log('\n— completion is derived, not clicked —');
  const derived = await page.evaluate(id => {
    const job = getJobCard(id);
    const before = job.status;
    // walk both lines all the way through the real pipeline
    job.items.forEach(it => {
      submitDepartmentBudget(id, 'carp', { materials: [{ name: 'Ply', qty: 1, unit: 'Nos', rate: 10 }] }, 'Joinery Production Manager');
    });
    approveDepartmentBudget(id, 'carp', 'Operations Manager');
    job.items.forEach(it => {
      startLineProduction(id, it.lineId, 'carp', 'Joinery Production Manager');
      // advanceJoinerySubStage(jobId, lineId, toSubStage) — the target stage,
      // not the actor. The sub-stage gate correctly refuses QC before 'assembly'.
      ['cutting', 'veneer-pressing', 'assembly'].forEach(st => advanceJoinerySubStage(id, it.lineId, st));
      submitLineForQC(id, it.lineId, 'carp', 'Joinery Production Manager');
      recordLineQCResult(id, it.lineId, 'carp', true, 'Joinery Production Manager');
    });
    const midway = getJobCard(id).status;
    job.items.forEach(it => handOffLine(id, it.lineId, 'carp', 'Joinery Production Manager'));
    const afterProduction = getJobCard(id).status;
    // production done but nothing delivered yet — must NOT be complete
    addDeliveryNote(id, job.items.map(it => ({ lineId: it.lineId, requiredQty: it.qty })), 'Operations');
    const afterDelivery = getJobCard(id).status;
    const log = getActivityFor('job', id).filter(a => a.type === 'job-auto-completed');
    return { before, midway, afterProduction, afterDelivery, logged: log.length, msg: log[0] && log[0].message };
  }, seed.jobId);
  check('a job in production is not complete', derived.before === 'open' && derived.midway === 'open', derived);
  check('production finished but undelivered is still not complete', derived.afterProduction === 'open', derived);
  check('delivering the last line flips it to completed on its own', derived.afterDelivery === 'completed', derived);
  check('and a job-auto-completed entry names the line that closed it',
    derived.logged === 1 && /delivered and finished/.test(derived.msg || ''), derived);

  // Sales must have no control that sets completed.
  const salesCannot = await page.evaluate(id => {
    const job = getJobCard(id);
    job.status = 'open';
    window.cloudUserType = 'sales';
    launchJobsModule(id);
    const body = document.getElementById('jobs-body');
    const controls = [...body.querySelectorAll('button, .sales-tile, .jr-btn')].map(e => e.textContent.trim());
    jobsSetStatus(id, 'completed');
    const after = getJobCard(id).status;
    return { controls, hasMarkCompleted: controls.some(t => /Mark Completed/i.test(t)),
      hasOverride: controls.some(t => /Close manually/i.test(t)), statusAfterDirectCall: after };
  }, seed.jobId);
  check('Sales has no Mark Completed control', !salesCannot.hasMarkCompleted, salesCannot.controls);
  check('Sales has no manual override either', !salesCannot.hasOverride, salesCannot.controls);
  check('and calling jobsSetStatus(completed) directly does nothing',
    salesCannot.statusAfterDirectCall === 'open', salesCannot);

  console.log('\n— Sales sees the work, never the money —');
  const salesView = await page.evaluate(() => {
    const body = document.getElementById('jobs-body');
    const html = body.innerHTML, text = body.textContent;
    return {
      hasBD: /\bBD\b/.test(text),
      hasAmountLabel: /Amount:/.test(text),
      hasPoVendor: /PO \/ Vendor|Vendor:/.test(text),
      hasSupplierWord: /supplier/i.test(text),
      hasMaterialCostLink: /printMaterialCost/.test(html),
      hasRateCol: /<th>Rate<\/th>/.test(html),
      itemsCard: /What is being made/.test(text),
      lineNames: /Wardrobe carcass/.test(text),
      qtyWhole: /\b6 Nos\b/.test(text) && !/6\.000/.test(text),
      backLink: /Back to Job Card List/.test(text)
    };
  });
  check('no BD, no Amount line', !salesView.hasBD && !salesView.hasAmountLabel, salesView);
  check('no PO/Vendor card and no supplier word anywhere',
    !salesView.hasPoVendor && !salesView.hasSupplierWord, salesView);
  check('no Rate column and no Material Cost link',
    !salesView.hasRateCol && !salesView.hasMaterialCostLink, salesView);
  check('Sales DOES get the Items card with the real line names',
    salesView.itemsCard && salesView.lineNames, salesView);
  check('quantity is a whole number (6 Nos, never 6.000)', salesView.qtyWhole, salesView);
  check('the third way back is gone (breadcrumb + topbar are enough)', !salesView.backLink, salesView);

  console.log('\n— progress, charts and documents —');
  const charts = await page.evaluate(() => {
    const body = document.getElementById('jobs-body');
    const tracks = [...body.querySelectorAll('.jr-track')];
    const labelInsideFill = tracks.some(t => (t.querySelector('i') || {}).textContent);
    return {
      tracks: tracks.length,
      labelInsideFill,
      pctCols: body.querySelectorAll('.jr-pctcol').length,
      deptRows: body.querySelectorAll('.jr-dept-row').length,
      headerPct: (body.querySelector('.jr-pct') || {}).textContent
    };
  });
  check('one progress track per line plus the header and departments',
    charts.tracks >= 4 && charts.pctCols === 2 && charts.deptRows === 1, charts);
  check('no label ever sits inside a bar fill', !charts.labelInsideFill, charts);
  check('the header shows a derived production figure', /^\d+%$/.test(charts.headerPct || ''), charts);

  const docs = await page.evaluate(id => {
    // this job HAS delivery notes, so the card opens by default
    const openState = document.getElementById('jobs-body').textContent;
    const wasOpen = /Delivery notes/.test(openState);
    // and a fresh job with nothing should be closed with the "Nothing yet" line
    const c = createCustomer({ name: 'Empty Co', contactPerson: 'B', tel: '39445566', address: 'M' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'B', tel: c.tel, source: 'walk inn', salesPerson: 'Silva' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Nothing Yet' });
    addQuotationItem(q.id, { product: 'Shelf', qty: 1, unit: 'Nos', vatPercent: 10 });
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah');
    const j2 = confirmQuotationToJobCard(q.id, 'Silva');
    jobsDocsOpen = null;
    openJobHub(j2.id);
    const emptyText = document.getElementById('jobs-body').textContent;
    return {
      wasOpen,
      emptyClosed: /Nothing yet — 0 invoices, 0 delivery notes, 0 files/.test(emptyText) && !/Attach a file/.test(emptyText),
      noDevNote: !/No upload infrastructure/.test(emptyText)
    };
  }, seed.jobId);
  check('Documents & records opens by default when there ARE records', docs.wasOpen, docs);
  check('and is closed with a summary line when there are none', docs.emptyClosed, docs);
  check('the "No upload infrastructure in this app yet" note is gone', docs.noDevNote, docs);

  console.log('\n— the Job Order document —');
  const doc = await page.evaluate(id => {
    window.cloudUserType = 'owner';
    const job = getJobCard(id);
    const html = buildJobOrderPrintHTML(job);
    return {
      qtyCount: /\b6 Nos\b/.test(html), qtyDecimal: /6\.000/.test(html),
      dept: /Carpentry/.test(html),   // dc('carp').n is 'Carpentry'
      target: html.includes(job.targetDate),
      ticks: (html.match(/class="jo-tick"/g) || []).length,
      headCols: /Item &amp; specification/.test(html) && /<th style="width:56px;">Made<\/th>/.test(html),
      notes: /soft-close hinges/.test(html),
      priceRule: /Do not write prices here/.test(html),
      signOff: (html.match(/class="rule"/g) || []).length,
      money: (html.match(/BD\s?[\d,]/g) || []).length,
      trn: /TRN/i.test(html) || /CR/.test(html),
      photoPlaceholder: /jo-photo-none/.test(html) && !/no image/.test(html),
      pageRule: /@page \{ size: A4 portrait/.test(html),
      breakInside: /\.jo-row \{ break-inside: avoid/.test(html),
      repeatHead: /thead \{ display: table-header-group/.test(html)
    };
  }, seed.jobId);
  check('quantity prints as a count with its unit (6 Nos), never 6.000',
    doc.qtyCount && !doc.qtyDecimal, doc);
  check('header band carries the department and the target date', doc.dept && doc.target, doc);
  check('two tick boxes per line — a production copy is worked on with a pen',
    doc.ticks === 4 && doc.headCols, doc);
  check('notes reach the floor, with the do-not-write-prices rule',
    doc.notes && doc.priceRule, doc);
  check('four-column sign-off strip', doc.signOff === 4, doc);
  check('still no figures anywhere, footer TRN/CR intact', doc.money === 0 && doc.trn, doc);
  check('a missing photo is a dashed box, not the words "no image"', doc.photoPlaceholder, doc);
  check('print rules: A4, rows never break, column head repeats',
    doc.pageRule && doc.breakInside && doc.repeatHead, doc);

  // An absent target date must print "—" and show no red — never a fabricated date.
  const noTarget = await page.evaluate(() => {
    const job = jobCards.find(j => !j.targetDate);
    if (!job) return { skipped: true };
    const html = buildJobOrderPrintHTML(job);
    return { dash: /<label>Target date<\/label><b>—<\/b>/.test(html), noLate: !/class="late"/.test(html) };
  });
  check('a job with no target date prints — and no red', noTarget.skipped || (noTarget.dash && noTarget.noLate), noTarget);

  console.log('\n— scroll clearance —');
  const clearance = await page.evaluate(() => {
    const sc = document.querySelector('#jobs-module-wrap .jobs-scroll');
    const cs = getComputedStyle(sc);
    return { right: cs.paddingRight, bottom: cs.paddingBottom };
  });
  check('68px right / 84px bottom so the chat bubble covers nothing',
    clearance.right === '68px' && clearance.bottom === '84px', clearance);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
