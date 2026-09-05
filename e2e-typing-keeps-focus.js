/**
 * e2e-typing-keeps-focus.js — Salman, 5 Sep 2026: "typing one letter exits
 * the text box". Sixteen keystroke handlers redrew their whole body on every
 * oninput, replacing the field under the cursor. renderKeepingFocus()
 * (shell.js) redraws and puts focus and the caret back. This types three
 * characters, one at a time, into every one of those fields and asserts that
 * after EACH character the same field still has focus and holds the text.
 * Offline (the bug is in rendering, not the cloud).
 */
const { chromium } = require('@playwright/test');
const path = require('path');
let pass = 0, fail = 0;
const check = (name, ok, extra) => { if (ok) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } };
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => { loadDemoData(); if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; });

  // Type "abc" one key at a time; after every key the SAME field (by its oninput attribute) must be focused and hold the text so far.
  async function typeInto(label, selector, text = 'abc') {
    const el = await page.$(selector);
    if (!el) { check(label + ': field present', false, selector); return; }
    await el.click();
    await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace');
    const key = await page.evaluate((s) => { const e = document.querySelector(s); return e.getAttribute('oninput'); }, selector);
    let ok = true, detail = null;
    for (let i = 0; i < text.length; i++) {
      await page.keyboard.type(text[i]);
      await page.waitForTimeout(60);
      const st = await page.evaluate((k) => { const a = document.activeElement; return { focusedSame: !!a && a.getAttribute && a.getAttribute('oninput') === k, value: a && a.value, tag: a && a.tagName }; }, key);
      if (!st.focusedSame || st.value !== text.slice(0, i + 1)) { ok = false; detail = { after: i + 1, ...st }; break; }
    }
    check(label + ' — focus and text survive every keystroke', ok, detail);
  }

  console.log('\n— Sales —');
  await page.evaluate(() => { launchSalesModule(); openEnquiryCreate(); });
  await page.waitForTimeout(300);
  await typeInto('Enquiry · Contact Person', 'input[oninput="salesEnqDraftChanged(\'contactPerson\',this.value)"]');
  await typeInto('Enquiry · Email', 'input[oninput="salesEnqDraftChanged(\'email\',this.value)"]', 'a@b');
  await typeInto('Enquiry · Requirements (textarea)', 'textarea[oninput="salesEnqDraftChanged(\'requirements\',this.value)"]');
  const kept = await page.evaluate(() => ({ contact: salesDraft.contactPerson, req: salesDraft.requirements }));
  check('Enquiry draft holds what was typed', kept.contact === 'abc' && kept.req === 'abc', kept);
  await page.evaluate(() => { salesView = 'enq-list'; renderSalesBody(); });
  await page.waitForTimeout(200);
  await typeInto('Enquiry list · Customer filter', 'input[oninput="salesEnqFilterChanged(\'customer\',this.value)"]');
  await page.evaluate(() => { salesView = 'qtn-list'; renderSalesBody(); });
  await page.waitForTimeout(200);
  const qf = await page.evaluate(() => { const e = document.querySelector('#sales-module-wrap input[oninput^="salesQtnFilterChanged"]'); return e && e.getAttribute('oninput'); });
  if (qf) await typeInto('Quotation list · filter', '#sales-module-wrap input[oninput="' + qf.replace(/"/g, '\\"') + '"]');

  console.log('\n— Jobs —');
  await page.evaluate(() => { hideModuleWrap(document.getElementById('sales-module-wrap')); launchJobsModule(); });
  await page.waitForTimeout(300);
  const jf = await page.evaluate(() => { const e = document.querySelector('#jobs-module-wrap input[oninput^="jobsFilterChanged"]'); return e && e.getAttribute('oninput'); });
  if (jf) await typeInto('Job list · filter', '#jobs-module-wrap input[oninput="' + jf + '"]'); else check('Jobs filter field present', false);

  console.log('\n— Purchasing —');
  await page.evaluate(() => { hideModuleWrap(document.getElementById('jobs-module-wrap')); launchPurchasingModule(); purchGoTo('purch-register'); });
  await page.waitForTimeout(300);
  const pf = await page.evaluate(() => { const e = document.querySelector('#purch-module-wrap input[oninput^="poRegisterFilterChanged"]'); return e && e.getAttribute('oninput'); });
  if (pf) await typeInto('PO register · filter', '#purch-module-wrap input[oninput="' + pf + '"]'); else check('PO register filter present', false);
  await page.evaluate(() => purchGoTo('purch-billos'));
  await page.waitForTimeout(300);
  await typeInto('Purchase Bill O/s · Supplier', 'input[oninput="purchBillOSFilterChanged(\'supplier\',this.value)"]');

  console.log('\n— Accounts —');
  await page.evaluate(() => { hideModuleWrap(document.getElementById('purch-module-wrap')); launchAccountsModule(); accountsSetView('bill-os'); });
  await page.waitForTimeout(300);
  await typeInto('Sales Bill O/s · Client', 'input[oninput="salesBillOSFilterChanged(\'client\',this.value)"]');
  await page.evaluate(() => accountsSetView('custupdate'));
  await page.waitForTimeout(200);
  await typeInto('Customer Update · search', 'input[oninput="custUpdateSearch=this.value;renderKeepingFocus(renderAccountsBody);"]');
  await page.evaluate(() => accountsSetView('proforma'));
  await page.waitForTimeout(200);
  await typeInto('Proforma · Job No search', 'input[oninput="acProformaSearchChanged(this.value)"]');

  console.log('\n— Storekeeper —');
  await page.evaluate(() => { hideModuleWrap(document.getElementById('accounts-module-wrap')); launchStorekeeperModule(); skGoTo('dashboard'); });
  await page.waitForTimeout(300);
  await typeInto('Storekeeper · dashboard search', 'input[oninput="skSetSearch(this.value)"]');
  await page.evaluate(() => skGoTo('items'));
  await page.waitForTimeout(200);
  const skf = await page.evaluate(() => { const e = document.querySelector('#sk-page-items input[oninput^="skItemFilterChanged"]'); return e && e.getAttribute('oninput'); });
  if (skf) await typeInto('Item Master · name filter', '#sk-page-items input[oninput="' + skf + '"]'); else check('Item Master filter present', false);

  console.log('\n— Estimator —');
  const est = await page.evaluate(() => { hideModuleWrap(document.getElementById('sk-module-wrap')); const q = quotations.find(x => x.stage === 'estimator' && (x.items || []).length) || quotations.find(x => (x.items || []).length); if (!q) return null; launchEstimatorModule(); openJobEstimationBOM(q.id, q.items[0].lineId); estimatorBomTab = 'materials'; renderEstimatorBody(); return q.id; });
  await page.waitForTimeout(300);
  if (est) await typeInto('BOM · material search', '#mat-search'); else check('a quotation to cost exists', false);

  console.log('\n— HR —');
  await page.evaluate(() => { hideModuleWrap(document.getElementById('estimator-module-wrap')); launchHRModule(); hrSetView('emp-list'); });
  await page.waitForTimeout(300);
  await typeInto('HR · employee search', 'input[oninput="hrEmpSearch=this.value;renderKeepingFocus(renderHRBody);"]');

  check('zero page errors', errors.length === 0, errors.slice(0, 3));
  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
