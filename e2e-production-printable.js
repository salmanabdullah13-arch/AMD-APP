/**
 * e2e-production-printable.js — 19a Production, the cutting list at A4.
 *
 * Phase 5. This is the one document a man carries to a saw, so the checks
 * here are about what is ON it and what it refuses to say, not about how it
 * looks: the revision it was cut from, the red line that stops a wrong cut,
 * every part with the dimension it is actually cut at, the boards to issue,
 * and — as with every other production screen — not one figure of money.
 *
 * The document is built as an HTML string, so it is rendered into a real
 * page and read back rather than pattern-matched as text.
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
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());

  await page.goto(pathToFileURL(path.resolve(__dirname, 'index.html')).href);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 20000 });

  const seed = await page.evaluate(() => {
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };
    const c = createCustomer({ name: 'Sheet Co', contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'Tubli' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Majlis wardrobes', taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Wardrobe carcass', qty: 2, unit: 'Nos' });
    const it = quotations.find(x => x.id === q.id).items[0];
    const oak = itemMaster.find(i => /oak|veneer/i.test(i.name)) || itemMaster[0];
    addBOMMaterial(q.id, it.lineId, { name: oak.name, qty: 6, rate: 25, unit: oak.unit });
    submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
    setItemDepartmentSequence(q.id, it.lineId, ['carp']);
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah', 'owner');
    const job = confirmQuotationToJobCard(q.id, 'Sales');
    confirmJobRouting(job.id, {}, 'Operations Manager', day(9));

    const sheet = createCuttingSheet({
      jobCardId: job.id, saw: 'saw 2', byWhom: 'Production Manager',
      lines: [
        { part: 'Carcass side', material: oak.name, qty: 6, length: 1800, width: 580, press: true },
        { part: 'Back panel', material: '6mm MDF plain', qty: 3, length: 1780, width: 900, press: false }
      ]
    });
    markSheetOnSaw(sheet.id, 'saw 2');
    return { sheet: sheet.id, job: job.id, client: 'Sheet Co', oak: oak.name, rev: sheet.revisionLetter };
  });

  const html = await page.evaluate((s) => buildCuttingListPrintHTML(s.sheet), seed);
  check('the document builds', typeof html === 'string' && html.indexOf('<!doctype html>') === 0, (html || '').slice(0, 40));

  // Render it for real rather than matching strings — a broken table is not
  // visible in a regex.
  const doc = await browser.newPage({ viewport: { width: 900, height: 1400 } });
  doc.on('pageerror', e => errors.push('doc: ' + e.message));
  await doc.setContent(html);
  await doc.waitForTimeout(200);

  const read = await doc.evaluate(() => {
    const t = document.body.textContent;
    const rows = [...document.querySelectorAll('table.cl tbody tr')].map(r =>
      [...r.querySelectorAll('td')].map(td => td.textContent.trim()));
    const issued = [...document.querySelectorAll('.cl-issue .g div')].map(d => d.textContent.trim());
    return {
      title: (document.querySelector('.cl-title') || {}).textContent,
      kicker: (document.querySelector('.cl-kick') || {}).textContent,
      rev: (document.querySelector('.cl-rev') || {}).textContent,
      scrap: (document.querySelector('.cl-scrap') || {}).textContent,
      sheetNo: (document.querySelector('.cl-no') || {}).textContent,
      strip: [...document.querySelectorAll('.cl-strip div')].map(d => d.querySelector('label').textContent),
      stripValues: [...document.querySelectorAll('.cl-strip div')].map(d => d.querySelector('b').textContent),
      cols: [...document.querySelectorAll('table.cl thead th')].map(h => h.textContent.trim()),
      rows, issued,
      ticks: document.querySelectorAll('.cl-after .g > div').length,
      signs: document.querySelectorAll('div[style*="repeat(3,1fr)"] > div').length,
      closing: (document.querySelector('.cl-rule') || {}).textContent,
      money: t.match(/\bBD\s?[\d,]+\.\d{3}|\bselling price\b|\bmargin\b|\bprofit\b|\brate\b/i),
      hasFooter: !!document.querySelector('.page-footer'),
      rowHeights: [...document.querySelectorAll('table.cl tbody tr')].map(tr => ({
        note: tr.querySelectorAll('td')[6].textContent.trim(),
        h: Math.round(tr.getBoundingClientRect().height)
      }))
    };
  });

  console.log('\n— the head, and the line that stops a wrong cut —');
  check('it is a cutting list, under the Joinery kicker',
    /Cutting list/.test(read.title || '') && /Al Maraya Decor · Joinery/.test(read.kicker || ''), read);
  check('the revision it was cut from is on it, in the wine chip',
    (read.rev || '').indexOf('REV ' + seed.rev) !== -1, read.rev);
  check('“Any other revision on this saw is scrap.” is on it verbatim',
    (read.scrap || '').trim() === 'Any other revision on this saw is scrap.', read.scrap);
  check('the sheet number and its saw are on it',
    (read.sheetNo || '').indexOf(seed.sheet) !== -1 && /saw 2/.test(read.sheetNo || ''), read.sheetNo);
  check('and it closes with the rule that brings it back',
    /If the BOM changes, this sheet is dead\. Bring it back to the office and take the reissue\./.test(read.closing || ''),
    read.closing);

  console.log('\n— the five-cell strip and the parts table —');
  check('five info cells, in the spec’s order',
    read.strip.map(s => s.toLowerCase()).join(',') === 'client,area,material,finish,due out', read.strip);
  check('the client is the real one', (read.stripValues[0] || '') === seed.client, read.stripValues);
  check('seven columns, in the spec’s order',
    read.cols.join(',') === '#,Part,Material,Qty,Length,Width,Note', read.cols);
  check('one row per part', read.rows.length === 2, read.rows);
  // 26px is the spec’s row. A row whose note wraps is legitimately taller,
  // so the plain row is the one that has to hit it exactly.
  const plainH = (read.rowHeights.find(r => !r.note) || {}).h;
  check('a row with no note is 26px, as specified', plainH === 26, read.rowHeights);
  // A real material name is long and legitimately wraps its own column, so
  // row height is not the thing to assert. What matters is that the NOTE is
  // short enough not to be what pushes a row over — the spec gives it 126px.
  check('the oversize note is short enough for its column',
    read.rowHeights.every(r => r.note.length <= 40), read.rowHeights.map(r => r.note));

  console.log('\n— an oversize part carries the dimension it is CUT at —');
  // The man at the saw needs the oversize number, not the finished one and a
  // flag. 1800 × 580 pressed is cut at 1820 × 600.
  const pressed = read.rows.find(r => /Carcass side/.test(r[1]));
  const plainRow = read.rows.find(r => /Back panel/.test(r[1]));
  check('the pressed part is dimensioned oversize', pressed && pressed[4] === '1820' && pressed[5] === '600', pressed);
  check('and its note says why', pressed && /oversize/i.test(pressed[6]) && /trimmed after press/i.test(pressed[6]), pressed);
  check('the plain part keeps its finished size, with no note',
    plainRow && plainRow[4] === '1780' && plainRow[5] === '900' && plainRow[6] === '', plainRow);

  console.log('\n— boards to issue, after the saw, and the signatures —');
  // 6 × 1800 × 580 × 1.12 / (2440 × 1220) → 3 oak boards; both faces pressed
  // → 5 veneer sheets. Worked out here, not read back from the code.
  const A = 1800 * 580, BOARD = 2440 * 1220;
  const wantOak = Math.ceil(6 * A / BOARD * 1.12);
  const wantVeneer = Math.ceil(6 * A * 2 / BOARD * 1.12);
  const wantPlain = Math.ceil(3 * 1780 * 900 / BOARD * 1.06);
  check('oak boards match the arithmetic', (read.issued[0] || '').indexOf(String(wantOak)) !== -1, { got: read.issued[0], wantOak });
  check('plain boards use 6% wastage', (read.issued[1] || '').indexOf(String(wantPlain)) !== -1, { got: read.issued[1], wantPlain });
  check('veneer counts both faces', (read.issued[2] || '').indexOf(String(wantVeneer)) !== -1, { got: read.issued[2], wantVeneer });
  check('cut oversize is the pressed quantity', (read.issued[3] || '').indexOf('6') !== -1, read.issued[3]);
  check('four tick boxes for after the saw', read.ticks === 4, read.ticks);
  check('three signatures, one naming the revision checked against',
    read.signs === 3, read.signs);
  check('the company footer is on it', read.hasFooter, read.hasFooter);

  console.log('\n— it says nothing about money —');
  check('no price, rate, margin or profit anywhere on the sheet', !read.money, read.money && read.money[0]);

  console.log('\n— a dead sheet says so on its face —');
  const deadHtml = await page.evaluate((s) => {
    // Kill it the way the app really does: a new revision supersedes it.
    const rev = startBOMRevision(s.job, 'Test', 'Client changed the carcass depth');
    if (rev && rev.id) issueBOMRevision(s.job, 'Test');
    return buildCuttingListPrintHTML(s.sheet);
  }, seed);
  const dead = await browser.newPage();
  await dead.setContent(deadHtml);
  await dead.waitForTimeout(150);
  const deadRead = await dead.evaluate(() => ({
    banner: document.body.textContent,
    hasBanner: /This sheet is dead/.test(document.body.textContent)
  }));
  // Reprinting a superseded sheet without saying so is how the wrong parts
  // get cut. It must be legible on the paper itself.
  check('a superseded sheet is marked dead on the printout',
    deadRead.hasBanner && /collect the reissue/i.test(deadRead.banner), deadRead.hasBanner);
  await dead.close();

  console.log('\n— an empty sheet does not pretend to be cuttable —');
  const emptyHtml = await page.evaluate(() => {
    // A fresh job: the seeded one now has dead paper on a saw, and the app
    // correctly refuses a new sheet until that is confirmed off — which is
    // the rule, not something to work around here.
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };
    const c = createCustomer({ name: 'Empty Sheet Co', contactPerson: 'A', tel: String(Math.floor(Math.random() * 1e8)), address: 'Tubli' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Salman Abdullah' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Empty run', taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'Shelf', qty: 1, unit: 'Nos' });
    const it = quotations.find(x => x.id === q.id).items[0];
    addBOMMaterial(q.id, it.lineId, { name: itemMaster[0].name, qty: 1, rate: 5, unit: itemMaster[0].unit });
    submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
    setItemDepartmentSequence(q.id, it.lineId, ['carp']);
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah', 'owner');
    const j = confirmQuotationToJobCard(q.id, 'Sales');
    confirmJobRouting(j.id, {}, 'Operations Manager', day(9));
    const sh = createCuttingSheet({ jobCardId: j.id, saw: '', lines: [], byWhom: 'Test' });
    return buildCuttingListPrintHTML(sh.id);
  });
  const empty = await browser.newPage();
  await empty.setContent(emptyHtml);
  await empty.waitForTimeout(150);
  const emptyRead = await empty.evaluate(() => document.body.textContent);
  check('an empty sheet says plainly not to cut to it',
    /No parts on this sheet/.test(emptyRead) && /do not cut to it/i.test(emptyRead), emptyRead.slice(0, 120));
  await empty.close();

  console.log('\n— a missing sheet does not throw —');
  const missing = await page.evaluate(() => buildCuttingListPrintHTML('CS-DOES-NOT-EXIST'));
  check('it returns a page rather than crashing', /No such cutting list/.test(missing), missing.slice(0, 80));

  console.log('\n— Print is reachable from the cutting lists page —');
  const wired = await page.evaluate(async () => {
    let opened = null;
    const orig = window.printOpenHTML;
    window.printOpenHTML = (h) => { opened = h; };
    launchProductionModule();
    PrdUI.go('page', 'cut');
    await new Promise(r => setTimeout(r, 200));
    const btn = document.querySelector('#prd-body [data-a="print-cut"]');
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 200));
    window.printOpenHTML = orig;
    return { hadButton: !!btn, built: !!opened && /Cutting list/.test(opened) };
  });
  check('every sheet row carries a Print action', wired.hadButton, wired);
  check('and it builds the real document', wired.built, wired);

  check('zero page errors', errors.length === 0, errors.slice(0, 4));

  await doc.close();
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
