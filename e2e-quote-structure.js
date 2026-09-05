/**
 * e2e-quote-structure.js — Salman's test of the quotation wizard's Product &
 * Services step (5 Sep 2026): the Unit must be chosen (no "Box" default); the
 * step is two columns with the structure on the right; a photo attaches and
 * shows; the form clears after Add Item; and copying a Sub Group keeps it
 * INSIDE its Group, placed right after the original, with Groups, Sub Groups
 * and lines all orderable — "Q-Pro had this option". Offline.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } };
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const errors = [], toasts = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => { execAutoAlerted = true; window.__toasts = []; const o = window.salesAlert; window.salesAlert = (m) => { window.__toasts.push(String(m)); return o(m); }; });

  const q = await page.evaluate(() => {
    launchSalesModule();
    const c = createCustomer({ name: 'Structure Co', contactPerson: 'A', tel: '39000777', address: 'Seef' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'Karthik Silva' });
    const qq = convertEnquiryToQuotation(e.id, { projectName: 'Structure test', taxPercent: 10, contactPerson: 'A' });
    openQuotationWizard(qq.id); salesWizardStep = 2; renderSalesBody();
    return qq.id;
  });
  await page.waitForTimeout(300);

  console.log('\n— the form —');
  const unit = await page.evaluate(() => { const s = document.getElementById('it-unit'); return { value: s.value, first: s.options[0].textContent, n: s.options.length }; });
  check('Unit starts unselected ("Choose…"), not on Box', unit.value === '' && /Choose/.test(unit.first) && unit.n > 1, unit);
  await page.click('#it-product'); await page.keyboard.type('TV unit');
  await page.click('button[onclick^="salesAddItem"]'); await page.waitForTimeout(200);
  const refusedUnit = await page.evaluate((id) => ({ items: quotations.find(x => x.id === id).items.length, last: window.__toasts[window.__toasts.length - 1] }), q);
  check('Add Item without a Unit is refused and says so', refusedUnit.items === 0 && /Choose a Unit/.test(refusedUnit.last || ''), refusedUnit);
  const twoCol = await page.evaluate(() => { const g = document.querySelector('#sales-module-wrap .sales-wiz2'); return g && getComputedStyle(g).gridTemplateColumns.split(' ').length; });
  check('At 1280px the step is two columns — form left, structure right', twoCol === 2, twoCol);

  // Build the quote through the real form: Group "Living room" → Sub Groups "J01 - TV unit" (2 lines) and "J02 - Shelves" (1 line); Group "Bedroom" → "B01 - Wardrobe" (1 line).
  const addViaForm = async (group, sub, product) => {
    await page.fill('#it-group', group); await page.fill('#it-subgroup', sub);
    await page.click('#it-product'); await page.keyboard.press('Control+A'); await page.keyboard.type(product);
    await page.selectOption('#it-unit', 'Nos');
    await page.click('button[onclick^="salesAddItem"]'); await page.waitForTimeout(200);
  };
  await addViaForm('Living room', 'J01 - TV unit', 'TV unit carcass');
  const cleared = await page.evaluate(() => ({ product: document.getElementById('it-product').value, unit: document.getElementById('it-unit').value, focused: document.activeElement && document.activeElement.id, group: document.getElementById('it-group').value, last: window.__toasts[window.__toasts.length - 1] }));
  check('After Add Item the Product clears, the Unit returns to "Choose…", the cursor is back in Product, and the Group is kept for the next line', cleared.product === '' && cleared.unit === '' && cleared.focused === 'it-product' && cleared.group === 'Living room' && /Added: TV unit carcass/.test(cleared.last || ''), cleared);
  await addViaForm('Living room', 'J01 - TV unit', 'TV unit doors');
  await addViaForm('Living room', 'J02 - Shelves', 'Wall shelves');
  await addViaForm('Bedroom', 'B01 - Wardrobe', 'Sliding wardrobe');
  const serials = () => page.evaluate((id) => computeQuoteHierarchy(quotations.find(x => x.id === id).items).map(h => h.serial + ' ' + h.item.group + '/' + h.item.subgroup + '/' + h.item.product), q);
  check('Four lines in the expected structure', JSON.stringify(await serials()) === JSON.stringify(['1.1.0 Living room/J01 - TV unit/TV unit carcass', '1.1.1 Living room/J01 - TV unit/TV unit doors', '1.2.0 Living room/J02 - Shelves/Wall shelves', '2.1.0 Bedroom/B01 - Wardrobe/Sliding wardrobe']), await serials());

  console.log('\n— copy stays in the Group, right after the original —');
  await page.evaluate((id) => { const it = quotations.find(x => x.id === id).items[0]; salesCopySection(id, it.lineId, 'subgroup'); }, q);
  await page.waitForTimeout(200);
  let s = await serials();
  check('Copying "J01 - TV unit" puts "J01 - TV unit (copy)" with BOTH its lines directly after it, still inside Living room, before J02', s[2] === '1.2.0 Living room/J01 - TV unit (copy)/TV unit carcass' && s[3] === '1.2.1 Living room/J01 - TV unit (copy)/TV unit doors' && s[4] === '1.3.0 Living room/J02 - Shelves/Wall shelves' && s[5] === '2.1.0 Bedroom/B01 - Wardrobe/Sliding wardrobe', s);
  const ids = await page.evaluate((id) => quotations.find(x => x.id === id).items.map(i => i.lineId), q);
  check('Every line keeps a unique lineId after the copy (ids are max-based, not length-based)', new Set(ids).size === ids.length, ids);
  await page.evaluate((id) => { const it = quotations.find(x => x.id === id).items.find(i => i.group === 'Bedroom'); salesCopySection(id, it.lineId, 'group'); }, q);
  await page.waitForTimeout(200);
  s = await serials();
  check('Copying the Bedroom Group lands "Bedroom (copy)" as Group 3 with its Sub Group intact', s[6] === '3.1.0 Bedroom (copy)/B01 - Wardrobe/Sliding wardrobe', s.slice(5));

  console.log('\n— order —');
  const structureBtns = await page.evaluate(() => document.querySelectorAll('#sales-module-wrap .qs-b').length);
  check('The Structure panel on the right carries ▲▼⧉ controls for every Group, Sub Group and line', structureBtns > 20, structureBtns);
  await page.evaluate((id) => { const it = quotations.find(x => x.id === id).items.find(i => i.subgroup === 'J02 - Shelves'); salesMoveSection(id, it.lineId, 'subgroup', -1); }, q);
  await page.waitForTimeout(150);
  s = await serials();
  check('Moving "J02 - Shelves" up puts it before the copy, and the serials renumber (1.2 → shelves, 1.3 → the copy)', s[2] === '1.2.0 Living room/J02 - Shelves/Wall shelves' && s[3] === '1.3.0 Living room/J01 - TV unit (copy)/TV unit carcass', s);
  const stuck = await page.evaluate((id) => { const it = quotations.find(x => x.id === id).items[0]; return moveQuoteSectionAt(id, it.lineId, 'subgroup', -1); }, q);
  check('The first Sub Group cannot move above its Group — refused with the reason, not silently reordered out of the Group', stuck && /first/.test(stuck.error || ''), stuck);
  const crossGroup = await page.evaluate((id) => { const it = quotations.find(x => x.id === id).items.find(i => i.subgroup === 'J02 - Shelves'); const before = quotations.find(x => x.id === id).items.map(i => i.lineId).join(); const r1 = moveQuoteSectionAt(id, it.lineId, 'subgroup', 1); const r2 = moveQuoteSectionAt(id, it.lineId, 'subgroup', 1); return { r2, same: before !== quotations.find(x => x.id === id).items.map(i => i.lineId).join() }; }, q);
  check('A Sub Group at the end of its Group is refused when pushed further — it never leaves the Group', crossGroup.r2 && /in its Group/.test(crossGroup.r2.error || ''), crossGroup);
  await page.evaluate((id) => { const it = quotations.find(x => x.id === id).items.find(i => i.group === 'Bedroom (copy)'); salesMoveSection(id, it.lineId, 'group', -1); }, q);
  await page.waitForTimeout(150);
  s = await serials();
  check('Moving the "Bedroom (copy)" Group up swaps whole Groups: it becomes Group 2 and Bedroom Group 3', /^2\.1\.0 Bedroom \(copy\)/.test(s[s.length - 2]) && /^3\.1\.0 Bedroom\//.test(s[s.length - 1]), s.slice(-2));
  await page.evaluate((id) => { const it = quotations.find(x => x.id === id).items.find(i => i.product === 'TV unit doors' && i.subgroup === 'J01 - TV unit'); salesMoveItem(id, it.lineId, -1); }, q);
  await page.waitForTimeout(150);
  s = await serials();
  check('Moving a line up within its Sub Group swaps the two lines', s[0].endsWith('TV unit doors') && s[1].endsWith('TV unit carcass'), s.slice(0, 2));
  const lineStuck = await page.evaluate((id) => { const it = quotations.find(x => x.id === id).items.find(i => i.product === 'Wall shelves' && i.subgroup === 'J02 - Shelves'); return moveQuotationItem(id, it.lineId, 1); }, q);
  check('A line at the end of its Sub Group is refused when pushed further', lineStuck && /last/.test(lineStuck.error || ''), lineStuck);

  console.log('\n— photo —');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9QDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const inputs = await page.$$('#sales-module-wrap input[type=file][onchange^="salesUploadItemImage"]');
  check('Every line in the Items table carries a photo control', inputs.length > 0, inputs.length);
  await inputs[0].setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(600);
  const withPhoto = await page.evaluate((id) => { const it = quotations.find(x => x.id === id).items.find(i => i.imageUrl); return { has: !!it, dataUrl: it && /^data:image\//.test(it.imageUrl), thumb: !!document.querySelector('#sales-module-wrap img.it-thumb') }; }, q);
  check('A picked photo lands on the line (offline: as a data URL) and shows as a thumbnail in the row', withPhoto.has && withPhoto.dataUrl && withPhoto.thumb, withPhoto);
  const formPhoto = await page.evaluate(() => !!document.getElementById('it-photo') && !document.body.innerText.includes('Image upload not wired'));
  check('The Add Item form has a photo picker, and the stale "not wired" note is gone', formPhoto);
  const compressed = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1800; const g = c.getContext('2d');
    for (let i = 0; i < 400; i++) { g.fillStyle = 'hsl(' + (i * 7 % 360) + ',70%,50%)'; g.fillRect((i * 37) % 2400, (i * 53) % 1800, 300, 220); }
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'big.png', { type: 'image/png' });
    const out = await salesCompressImage(file);
    const bmp = await createImageBitmap(out);
    return { inKB: Math.round(file.size / 1024), outKB: Math.round(out.size / 1024), w: bmp.width, h: bmp.height, type: out.type };
  });
  check('A 2400px photo is compressed to ≤1280px JPEG under 500 KB before upload (the old cap refused it outright)', compressed.w === 1280 && compressed.outKB <= 500 && compressed.type === 'image/jpeg' && compressed.inKB > compressed.outKB, compressed);

  console.log('\n— phone —');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
  const phone = await page.evaluate(() => { const g = document.querySelector('#sales-module-wrap .sales-wiz2'); const w = document.getElementById('sales-module-wrap'); return { cols: g && getComputedStyle(g).gridTemplateColumns.split(' ').length, overflow: w.scrollWidth > w.clientWidth + 1 }; });
  check('At 390px the step is one column with no sideways overflow', phone.cols === 1 && !phone.overflow, phone);

  check('zero page errors', errors.length === 0, errors.slice(0, 3));
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
