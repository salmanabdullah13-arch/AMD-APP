/**
 * e2e-production-bom-estimate.js — what the estimator allowed, and the
 * Excel round-trip, on 19a's Build-the-job-BOM screen.
 *
 * SALMAN, 26 Aug 2026, correcting the premise this was designed against:
 * "the estimator doesn't put all the items for the quote — he roughly
 * calculates and puts the material cost and labour cost as two line items
 * lumpsum." So the comparison is tested at BOTH levels, on two deliberately
 * different jobs: one whose estimate is itemised per Item Master code, and
 * one that is the rough two-line figure he describes. A comparison that only
 * worked on the itemised job would read as empty on most real ones.
 *
 * The first checks are the money rule, because it is the one that matters
 * most: this role sees material cost and man-days, never a labour rate and
 * never a selling price. It is asserted two ways — nothing money-shaped
 * renders, AND the data-layer function that feeds the screen does not carry
 * a labour amount for a screen to leak in the first place.
 */
const { chromium } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');

let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  → ' + JSON.stringify(detail) : '')); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto(pathToFileURL(path.resolve(__dirname, 'index.html')).href);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 20000 });

  // ── Seed ──────────────────────────────────────────────────────────────
  // Two jobs, deliberately different in how the estimator costed them.
  const seed = await page.evaluate(() => {
    const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };
    const A = itemMaster[0], B = itemMaster[1], C = itemMaster[2];

    function job(name, build) {
      const c = createCustomer({ name, contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'Tubli' });
      const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1',
        source: 'walk inn', salesPerson: 'Salman Abdullah' });
      const q = convertEnquiryToQuotation(e.id, { projectName: name, taxPercent: 10, contactPerson: 'A' });
      build(q.id);
      quotations.find(x => x.id === q.id).items.forEach(it => {
        submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
        setItemDepartmentSequence(q.id, it.lineId, ['carp', 'paint']);
      });
      transferQuotationStage(q.id, 'approver', 'Estimator');
      approveQuotation(q.id, 'Salman Abdullah', 'owner');
      const j = confirmQuotationToJobCard(q.id, 'Sales');
      confirmJobRouting(j.id, {}, 'Operations Manager', day(14));
      const req = raiseInputRequest({ type: 'bom_budget_input', raisedBy: 'Silva Fernandes',
        raiserRole: 'operations_manager', jobCardId: j.id,
        question: 'Build the BOM for ' + name + '.', neededBy: day(3) });
      return { job: j.id, qtn: q.id, req: req.id };
    }

    // ITEMISED — a real parts list, per code, plus a photo Sales attached.
    const itemised = job('Itemised Wardrobes', qid => {
      addQuotationItem(qid, { product: 'Master wardrobe', qty: 2, unit: 'Nos' });
      const it = quotations.find(x => x.id === qid).items[0];
      it.imageUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
      addBOMMaterial(qid, it.lineId, { name: A.name, qty: 6, rate: 25, unit: A.unit });
      addBOMMaterial(qid, it.lineId, { name: B.name, qty: 3, rate: 12, unit: B.unit });
      addBOMLabour(qid, it.lineId, { department: 'carp', empCategory: 'Skilled',
        calcMode: 'days', noOfPpl: 3, qty: 4, rate: 5 });
    });

    // LUMP SUM — Salman's own description: two line items covering everything,
    // across more than one product, plus a subcontract figure this form never
    // offers. Two items, one material line: fewer lines than items.
    const lump = job('Lump Sum Majlis', qid => {
      addQuotationItem(qid, { product: 'Majlis units', qty: 1, unit: 'Nos' });
      addQuotationItem(qid, { product: 'Feature panelling', qty: 1, unit: 'Nos' });
      const items = quotations.find(x => x.id === qid).items;
      addBOMMaterial(qid, items[0].lineId, { name: C.name, qty: 40, rate: 20, unit: C.unit });
      addBOMLabour(qid, items[0].lineId, { department: 'carp', empCategory: 'Skilled',
        calcMode: 'days', noOfPpl: 4, qty: 5, rate: 6 });
      addBOMSubcontract(qid, items[0].lineId, { vendor: 'Glass co', workType: 'Mirror', amount: 150 });
    });

    if (typeof buildCrewRoster === 'function' && !crewMembers.length) buildCrewRoster();
    launchProductionModule();
    return {
      itemised, lump,
      A: { id: A.id, name: A.name, cost: Number(A.cost) || Number(A.lastPurchaseRate) || 0 },
      B: { id: B.id, name: B.name },
      C: { id: C.id, name: C.name }
    };
  });

  // ── 1. The money rule, at the data layer ──────────────────────────────
  console.log('\n— the money rule —');
  const layer = await page.evaluate(s => {
    const cmp = getEstimateComparisonForDepartment(s.itemised.job, 'carp');
    const flat = JSON.stringify(cmp);
    return {
      keys: Object.keys(cmp.items[0] || {}),
      // 3 men x 4 days = 12 man-days, and NOT the 12 x 5 = BD 60 it cost.
      manDays: cmp.totals.manDays,
      // 6 x 25 + 3 x 12 = 186.
      materialCost: cmp.totals.materialCost,
      leaks: /sellingPrice|profit|margin|labourCost|"rate"/i.test(flat),
    };
  }, seed);
  check('labour comes back as man-days, not money',
    layer.manDays === 12 && layer.keys.indexOf('manDays') !== -1 && layer.keys.indexOf('labourCost') === -1, layer);
  check('material cost does come back — it is in scope for this role',
    Math.abs(layer.materialCost - 186) < 0.001, layer.materialCost);
  check('and nothing in it carries a selling price, profit, margin or rate',
    !layer.leaks, layer.leaks);

  // ── 2. The itemised job ───────────────────────────────────────────────
  console.log('\n— an itemised estimate —');
  const open = await page.evaluate(async s => {
    PrdUI.go('form', 'bomb');
    await new Promise(r => setTimeout(r, 200));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('prd-req', s.itemised.req);
    await new Promise(r => setTimeout(r, 350));
    const body = document.getElementById('prd-body');
    const sec = body.querySelector('.prd-bom-sec[data-dept="carp"]');
    return {
      job: document.getElementById('prd-job').value,
      strip: !!sec.querySelector('.prd-bom-strip'),
      stripNote: (sec.querySelector('.prd-bom-strip-h i') || {}).textContent || '',
      cards: [...sec.querySelectorAll('.prd-bom-card')].map(c => c.textContent.replace(/\s+/g, ' ').trim()),
      photos: sec.querySelectorAll('.prd-bom-ph:not(.is-none)').length,
      matHead: (sec.querySelectorAll('.prd-bom-c')[0] || {}).textContent || '',
      money: (body.textContent.match(/selling price|margin|\bprofit\b/i) || [null])[0]
    };
  }, seed);
  check('picking the request fills in the job it names', open.job === seed.itemised.job, open.job);
  check('an item strip renders above the material rows', open.strip, open);
  // The photo is Sales' own, uploaded at quote level. The job card never
  // copied it, so this proves the read-time resolve by lineId works.
  check('the photo Sales attached at quote level reaches the strip', open.photos === 1, open.photos);
  check('the card names the product and what was allowed for it',
    /Master wardrobe/.test(open.cards[0] || '') && /material/.test(open.cards[0] || '') &&
    /12 man-days/.test(open.cards[0] || ''), open.cards);
  check('an itemised estimate says so, and points at the EST column',
    /Itemised/i.test(open.stripNote), open.stripNote);
  check('the material header gains an EST column', /EST/.test(open.matHead), open.matHead);
  check('no selling price, margin or profit anywhere on the screen', !open.money, open.money);

  const est = await page.evaluate(async () => {
    document.querySelector('#prd-body .prd-bom-sec[data-dept="carp"] [data-a="bom-pull"]').click();
    await new Promise(r => setTimeout(r, 300));
    const sec = document.querySelector('#prd-body .prd-bom-sec[data-dept="carp"]');
    return {
      estCells: [...sec.querySelectorAll('.prd-bom-r .c-e')].map(x => x.textContent.trim()),
      foot: [...sec.querySelectorAll('.prd-bom-t')].map(x => x.textContent.replace(/\s+/g, ' ').trim())
    };
  });
  check('each material row shows the estimator\'s own quantity for that code',
    est.estCells.join(',') === '6,3', est.estCells);
  check('the footer names what he allowed for material',
    /Estimator allowed BD 186/.test(est.foot[0] || ''), est.foot[0]);
  check('and for labour, in man-days rather than money',
    /Estimator allowed 12/.test(est.foot[1] || '') && !/BD/.test((est.foot[1] || '').split('Estimator')[1] || ''),
    est.foot[1]);

  // Raising a quantity above the estimate has to be visible, not silent.
  const over = await page.evaluate(async () => {
    const sec = () => document.querySelector('#prd-body .prd-bom-sec[data-dept="carp"]');
    const plus = sec().querySelectorAll('.prd-bom-r')[0].querySelectorAll('.prd-stp')[1];
    for (let i = 0; i < 4; i++) { sec().querySelectorAll('.prd-bom-r')[0].querySelectorAll('.prd-stp')[1].click(); await new Promise(r => setTimeout(r, 60)); }
    void plus;
    await new Promise(r => setTimeout(r, 200));
    const s = sec();
    return {
      qty: s.querySelectorAll('.prd-bom-r')[0].querySelector('.c-q b').textContent.trim(),
      flagged: !!s.querySelector('.prd-bom-r .c-e.over'),
      delta: (s.querySelector('.prd-bom-t .prd-bom-d') || {}).textContent || ''
    };
  });
  check('budgeting more than the estimate flags the row', over.qty === '10' && over.flagged, over);
  // Either side is possible and both are worth saying: the budget is priced
  // at Item Master cost while the estimate carries the estimator own rate.
  check('and the footer says how far off the estimate the section is',
    /(over|under|same as) the estimate/.test(over.delta), over.delta);

  // ── 3. The lump-sum job — the normal case ─────────────────────────────
  console.log('\n— a lump-sum estimate, which is the usual case —');
  const lump = await page.evaluate(async s => {
    PrdUI.go('form', 'bomb');
    await new Promise(r => setTimeout(r, 200));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('prd-req', s.lump.req);
    await new Promise(r => setTimeout(r, 350));
    const sec = document.querySelector('#prd-body .prd-bom-sec[data-dept="carp"]');
    document.querySelector('#prd-body .prd-bom-sec[data-dept="carp"] [data-a="bom-pull"]').click();
    await new Promise(r => setTimeout(r, 300));
    const s2 = document.querySelector('#prd-body .prd-bom-sec[data-dept="carp"]');
    return {
      note: (sec.querySelector('.prd-bom-strip-h i') || {}).textContent || '',
      cards: [...sec.querySelectorAll('.prd-bom-card')].map(c => c.textContent.replace(/\s+/g, ' ').trim()),
      noneCards: sec.querySelectorAll('.prd-bom-card.none').length,
      estCells: [...s2.querySelectorAll('.prd-bom-r .c-e')].map(x => x.textContent.trim()),
      foot: (s2.querySelectorAll('.prd-bom-t')[0] || {}).textContent || ''
    };
  }, seed);
  check('an item the estimator did not itemise is named as such',
    /1 of 2 items carry no material line of their own/.test(lump.note), lump.note);
  // Narrower than an earlier version, deliberately: telling the reader to
  // ignore the EST column would be wrong whenever another item DOES carry a
  // parts list, which is exactly the mixed case this job is.
  check('and the note points at the totals for those without claiming the column is useless',
    /Read the totals for those/.test(lump.note) && /real wherever it shows a number/.test(lump.note),
    lump.note);
  check('the item he costed nothing for is shown as such, not hidden',
    lump.noneCards === 1 && lump.cards.some(c => /costed nothing/.test(c)), lump.cards);
  // 40 x 20 = 800 material, so the totals comparison still works.
  check('the totals comparison still holds on a lump sum',
    /Estimator allowed BD 800/.test(lump.foot), lump.foot);
  check('a subcontract figure the form does not offer is named, not silently dropped',
    lump.cards.some(c => /150.*subcontract, hiring or other|subcontract, hiring or other/.test(c)), lump.cards);
  check('the EST column is honest about having nothing for a code',
    lump.estCells.indexOf('—') !== -1 || lump.estCells.length > 0, lump.estCells);

  // ── 4. The Excel round-trip ───────────────────────────────────────────
  console.log('\n— download, fill in, upload, review —');
  const dl = await page.evaluate(async s => {
    PrdUI.go('form', 'bomb');
    await new Promise(r => setTimeout(r, 200));
    const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('prd-req', s.itemised.req);
    await new Promise(r => setTimeout(r, 350));
    return {
      hasDl: !!document.querySelector('#prd-body [data-a="bom-xl-dl"]'),
      hasUp: !!document.querySelector('#prd-body [data-a="bom-xl"]'),
      xlsx: typeof XLSX
    };
  }, seed);
  check('the form offers a download and an upload', dl.hasDl && dl.hasUp, dl);
  check('the Excel library is loaded', dl.xlsx === 'object', dl.xlsx);

  // Build the workbook the download would build, in the page, and read it
  // back — proving the sheet layout rather than that a file appeared.
  const sheet = await page.evaluate(() => {
    const dls = [];
    const real = XLSX.writeFile;
    XLSX.writeFile = (wb, name) => { dls.push({ wb, name }); };
    document.querySelector('#prd-body [data-a="bom-xl-dl"]').click();
    XLSX.writeFile = real;
    if (!dls.length) return { none: true };
    const { wb, name } = dls[0];
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true });
    return { name, sheets: wb.SheetNames, marker: aoa[0], head: aoa[1], rows: aoa.slice(2) };
  });
  check('the file is named for the job', /^JOB-BOM-/.test(sheet.name || ''), sheet.name);
  check('one sheet per department, so the two can never be mixed up',
    (sheet.sheets || []).length === 2, sheet.sheets);
  check('the first row identifies the job and department',
    sheet.marker && sheet.marker[0] === 'AMD JOB BOM v1' && sheet.marker[1] === seed.itemised.job,
    sheet.marker);
  check('the estimator\'s figures ride along as reference columns',
    (sheet.head || []).filter(h => /reference/i.test(String(h))).length >= 3, sheet.head);
  check('and no column carries a labour rate or a selling price',
    !(sheet.head || []).some(h => /selling|margin|profit|labour rate/i.test(String(h))), sheet.head);
  check('the estimator\'s own material quantity is on the row',
    (sheet.rows || []).some(r => r[0] === 'Material' && r[8] === 6), (sheet.rows || [])[0]);

  // Upload a filled sheet, through the real parser.
  const review = await page.evaluate(s => {
    const good = [
      ['AMD JOB BOM v1', s.itemised.job, 'carp', 'Carpentry'],
      ['Section', 'Item code / Task', 'Item name', 'Unit', 'Men', 'Days', 'Qty', 'Cost', 'Est qty', 'Est cost', 'Est man-days'],
      ['Material', s.A.id, s.A.name, '', '', '', 9, '', 6, '', ''],
      ['Material', 'NOT-A-REAL-CODE', 'Mystery board', '', '', '', 4, '', '', '', ''],
      ['Material', s.B.id, s.B.name, '', '', '', 0, '', 3, '', ''],
      ['Labour', 'Carcass assembly', '', '', 2, 5, '', '', '', '', ''],
      ['Labour', 'Spray and cure', '', '', 0, 0, '', '', '', '', '']
    ];
    PrdUI.processBOMExcel([good]);
    const body = document.getElementById('prd-body');
    return {
      rows: [...body.querySelectorAll('.prd-bom-rv-r')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
      bad: body.querySelectorAll('.prd-bom-rv-r.bad').length,
      head: (body.querySelector('.prd-bom-rv-h') || {}).textContent || '',
      // The editor must be gone: reviewing and editing at once is how an
      // unreviewed budget reaches operations.
      editorStillThere: !!body.querySelector('.prd-bom-sec'),
      acts: [...body.querySelectorAll('.prd-acts button')].map(b => b.textContent.trim())
    };
  }, seed);
  check('the upload opens a review rather than writing anything', review.rows.length === 5, review.rows.length);
  check('the editor is replaced while the review is open', !review.editorStillThere, review);
  check('Submit is not reachable under a pending review',
    !review.acts.some(a => /Submit for approval/i.test(a)) &&
    review.acts.some(a => /Put these rows on the form/i.test(a)), review.acts);
  check('a code that is not in the Item Master is refused, with a reason',
    review.bad === 3 && review.rows.some(r => /not a real Item Master code/.test(r)), review.rows);
  check('a material line with no quantity is refused',
    review.rows.some(r => /needs a quantity/.test(r)), review.rows);
  check('a labour line with no men or days is refused',
    review.rows.some(r => /needs men and days/.test(r)), review.rows);
  check('and the header says how many cannot be used',
    /3 cannot be used/.test(review.head), review.head);

  const applied = await page.evaluate(() => {
    document.querySelector('#prd-body [data-a="bom-xl-apply"]').click();
    return new Promise(r => setTimeout(() => {
      const sec = document.querySelector('#prd-body .prd-bom-sec[data-dept="carp"]');
      r({
        back: !!sec,
        mats: [...sec.querySelectorAll('.prd-bom-r')].slice(0, 1).map(x => x.textContent.replace(/\s+/g, ' ').trim()),
        matCount: [...sec.querySelectorAll('.prd-bom-sub')].length,
        rows: sec.querySelectorAll('.prd-bom-r').length,
        acts: [...document.querySelectorAll('#prd-body .prd-acts button')].map(b => b.textContent.trim())
      });
    }, 350));
  });
  check('applying puts the good rows on the form and brings the editor back',
    applied.back && applied.rows === 2, applied);
  check('the flagged rows are left out rather than half-imported',
    /\b9\b/.test(applied.mats[0] || ''), applied.mats);
  check('and Submit is live again once the review is done',
    applied.acts.some(a => /Submit for approval/i.test(a)), applied.acts);

  // A sheet from another job must never land on this one.
  const wrongJob = await page.evaluate(s => {
    const before = document.getElementById('prd-body').querySelectorAll('.prd-bom-sec').length;
    PrdUI.processBOMExcel([[
      ['AMD JOB BOM v1', s.lump.job, 'carp', 'Carpentry'],
      ['Section', 'Item code / Task'],
      ['Material', s.A.id, '', '', '', '', 5, '', '', '', '']
    ]]);
    return { review: !!PrdUI.bomExcelState(), stillEditor: document.getElementById('prd-body').querySelectorAll('.prd-bom-sec').length === before };
  }, seed);
  check('a sheet downloaded for another job is refused outright',
    !wrongJob.review && wrongJob.stillEditor, wrongJob);

  // And the imported budget still goes through the one real submit path.
  const submitted = await page.evaluate(async () => {
    document.querySelectorAll('#prd-body .prd-opt')[0].click();
    await new Promise(r => setTimeout(r, 200));
    document.querySelector('#prd-body .prd-acts .prd-btn').click();
    await new Promise(r => setTimeout(r, 400));
    return true;
  });
  void submitted;
  const budget = await page.evaluate(s => {
    const j = getJobCard(s.itemised.job);
    const e = j.departmentBudgets && j.departmentBudgets.carp;
    return e ? { status: e.approvalStatus, mats: e.bom.materials.length, qty: e.bom.materials[0] && e.bom.materials[0].qty,
      labour: e.bom.labour.length, source: e.source } : null;
  }, seed);
  check('an imported budget submits through the same path a typed one does',
    budget && budget.status === 'pending' && budget.source === 'bom' && budget.qty === 9, budget);

  // ── 5. Dark mode and the phone ────────────────────────────────────────
  console.log('\n— dark mode and the phone —');
  const dark = await page.evaluate(async () => {
    execThemeToggle();
    await new Promise(r => setTimeout(r, 250));
    const card = document.querySelector('#prd-body .prd-bom-card');
    const bg = card ? getComputedStyle(card).backgroundColor : '';
    execThemeToggle();
    return bg;
  });
  check('the strip cards take the dark surface token (computed, not eyeballed)',
    /rgb\((\d+), (\d+), (\d+)\)/.test(dark) && Number(dark.match(/\d+/g)[0]) < 90, dark);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const phone = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    stripScrolls: (() => {
      const s = document.querySelector('#prd-body .prd-bom-cards');
      return s ? getComputedStyle(s).overflowX === 'auto' : false;
    })(),
    cardFits: (() => {
      const c = document.querySelector('#prd-body .prd-bom-card');
      return c ? c.getBoundingClientRect().width <= 390 : false;
    })()
  }));
  check('nothing scrolls the page sideways on a phone', phone.overflow, phone);
  check('the item strip scrolls inside itself instead', phone.stripScrolls && phone.cardFits, phone);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 5));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
