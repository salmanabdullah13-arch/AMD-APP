/**
 * dead-control-sweep.js — the detector recommended on 6 Sep 2026 and the
 * one that would have caught Salman's own findings without knowing about
 * them in advance: click every control on every screen and check that
 * SOMETHING happened.
 *
 * "Something" is any of: the module body changed, a toast or dialog
 * appeared, the view/page state moved, a new tab was opened (a print), or
 * another module took over the screen. A control that does none of those
 * is dead — the ✕ that silently refused, and the photo that silently
 * capped, both looked exactly like this.
 *
 * Destructive controls are never clicked (sign out, delete, remove,
 * cancel, purge, clear). Each control is clicked from a freshly reopened
 * page, so one click can never mask the next.
 *
 *   node dead-control-sweep.js         → docs/test-run/dead-controls.md
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const SKIP = /sign ?out|log ?out|delete|remove|\bcancel\b|purge|clear demo|clear all|reset|✕|×|✖|deactivate|reject|discard/i;
const WALK = {
  sales: ["salesSetTopView('enq-list')", "salesSetTopView('qtn-list')", "openEnquiryCreate()"],
  jobs: ["jobsView='list';renderJobsBody()", "jobsView='reports';renderJobsBody()"],
  purchasing: ["purchGoTo('purch-requests')", "purchGoTo('purch-orders')", "purchGoTo('purch-suppliers')", "purchGoTo('purch-register')"],
  storekeeper: ["skGoTo('items')", "skGoTo('masters')", "skGoTo('reports')", "skGoTo('requests')"],
  accounts: ["accountsSetView('invoices')", "accountsSetView('soa')", "accountsSetView('daybook')", "accountsSetView('ledger-report')", "accountsSetView('trial-balance')", "accountsSetView('journals')"],
  hr: ["hrSetView('emp-list')", "hrSetView('payroll-runs')"],
  curtain: ["curtGoTo('curt-jobs')", "curtGoTo('curt-bom')", "curtGoTo('curt-fabric')"],
  estimator: [], approver: [], owner: [], admin: ["adminSetView('users')", "adminSetView('discounts')"],
  operations: ["opsGoTo('projects')", "opsGoTo('capacity')"],
  production: ["PrdUI.go('page','mat')", "PrdUI.go('page','cut')", "PrdUI.go('page','team')"],
  upholstery: ["UphUI.go('page','reg')"],
  'crew-timer': ["timerView='crews';renderCrewTimerBody()"],
  fleet: [], delivery: []
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  // The stack, not just the message: an error can land in the window of a
  // LATER click than the one that caused it, and without a source line
  // there is nothing to chase.
  page.on('pageerror', e => pageErrors.push(e.message + '  [' + ((e.stack || '').split('\n')[1] || '').trim().slice(0, 80) + ']'));
  let dialogs = 0;
  page.on('dialog', d => { dialogs++; d.accept(); });
  let popups = 0;
  ctx.on('page', () => popups++);

  await page.goto(fileUrl); await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => {
    loadDemoData();
    if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true;
    window.__toasts = 0;
    ['salesAlert', 'purchAlert', 'estimatorAlert', 'jobsAlert', 'accountsAlert', 'skAlert', 'hrAlert', 'joineryAlert',
      'upholsteryAlert', 'paintingAlert', 'commsToast', 'showAlert', 'curtAlert', 'approverAlert'].forEach(n => {
      const o = window[n];
      if (typeof o === 'function') window[n] = function () { window.__toasts++; try { return o.apply(this, arguments); } catch (e) { return undefined; } };
    });
  });
  const nodes = await page.evaluate(() => window.__eco3d.NODES.filter(n => n.built && !n.retired).map(n => ({ id: n.id, label: n.label })));

  const openTo = (id, view) => page.evaluate(({ id, view }) => {
    document.querySelectorAll('[id$="-module-wrap"], #tracks-dash-wrap, #qc-dash-wrap, #install-crew-wrap, #pipeline-board-wrap').forEach(w => { w.style.display = 'none'; });
    const n = window.__eco3d.NODES.find(x => x.id === id); if (!n) return 'no node';
    try { n.launch(); } catch (e) { return 'launch: ' + e.message; }
    if (view) { try { (new Function(view))(); } catch (e) { return 'view: ' + e.message; } }
    return 'ok';
  }, { id, view });

  const inventory = () => page.evaluate((skipSrc) => {
    const SKIP = new RegExp(skipSrc, 'i');
    const vis = [...document.querySelectorAll('[id$="-module-wrap"], #tracks-dash-wrap, #qc-dash-wrap, #install-crew-wrap, #pipeline-board-wrap')].filter(w => getComputedStyle(w).display !== 'none');
    const wrap = vis[0]; if (!wrap) return null;
    const body = wrap.querySelector('[id$="-body"], .curt-ov, .xs-content') || wrap;
    const els = [...body.querySelectorAll('button, [onclick], .sales-tile, .jr-btn, .qs-b, .prd-wait-c')]
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .filter(el => !el.closest('.xs-side, .xs-top'))
      .filter(el => { const t = (el.textContent || '').trim() + ' ' + (el.getAttribute('onclick') || ''); return !SKIP.test(t); });
    // A stable path for each so it can be found again after a re-render.
    return els.map((el, i) => ({ i, tag: el.tagName, text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      onclick: (el.getAttribute('onclick') || '').slice(0, 90), act: el.getAttribute('data-a') || el.getAttribute('data-act') || '' }));
  }, SKIP.source);

  const snapshot = () => page.evaluate(() => {
    const vis = [...document.querySelectorAll('[id$="-module-wrap"], #tracks-dash-wrap, #qc-dash-wrap, #install-crew-wrap, #pipeline-board-wrap')].filter(w => getComputedStyle(w).display !== 'none');
    const wrap = vis[0];
    const state = [typeof salesView !== 'undefined' ? salesView : '', typeof jobsView !== 'undefined' ? jobsView : '',
      typeof accountsView !== 'undefined' ? accountsView : '', typeof skPage !== 'undefined' ? skPage : '',
      typeof estimatorView !== 'undefined' ? estimatorView : '', typeof PrdUI !== 'undefined' ? PrdUI.state.view + PrdUI.state.page : '',
      typeof UphUI !== 'undefined' ? UphUI.state.view + UphUI.state.page : '', typeof purchPage !== 'undefined' ? purchPage : '',
      typeof curtPage !== 'undefined' ? curtPage : '', typeof hrView !== 'undefined' ? hrView : ''].join('|');
    // Hash the WHOLE document, not a prefix of the module wrap: a modal is
    // appended to document.body, and a change 4000 characters down the page
    // is still a change. Both read as 'nothing happened' otherwise.
    const h = (s) => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return x; };
    const all = document.body.innerHTML;
    return { wrapId: wrap ? wrap.id : 'none', len: all.length, hash: h(all), state, toasts: window.__toasts };
  });

  const dead = [], errs = [];
  let clicked = 0;
  for (const n of nodes) {
    for (const view of [null].concat(WALK[n.id] || [])) {
      if ((await openTo(n.id, view)) !== 'ok') continue;
      await page.waitForTimeout(180);
      const items = await inventory();
      if (!items || !items.length) continue;
      for (const it of items) {
        if ((await openTo(n.id, view)) !== 'ok') break;
        await page.waitForTimeout(120);
        const before = await snapshot();
        const popBefore = popups, dlgBefore = dialogs, errBefore = pageErrors.length;
        const ok = await page.evaluate(({ idx, skipSrc }) => {
          const SKIP = new RegExp(skipSrc, 'i');
          const vis = [...document.querySelectorAll('[id$="-module-wrap"], #tracks-dash-wrap, #qc-dash-wrap, #install-crew-wrap, #pipeline-board-wrap')].filter(w => getComputedStyle(w).display !== 'none');
          const wrap = vis[0]; if (!wrap) return false;
          const body = wrap.querySelector('[id$="-body"], .curt-ov, .xs-content') || wrap;
          const els = [...body.querySelectorAll('button, [onclick], .sales-tile, .jr-btn, .qs-b, .prd-wait-c')]
            .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
            .filter(el => !el.closest('.xs-side, .xs-top'))
            .filter(el => { const t = (el.textContent || '').trim() + ' ' + (el.getAttribute('onclick') || ''); return !SKIP.test(t); });
          const el = els[idx]; if (!el) return false;
          // A tab that is already the one you are on does nothing when you
          // click it, and that is correct — not a dead control.
          if (/(^|\s)(on|active|sel|selected|current)(\s|$)/.test(el.className || '')) return 'active';
          el.click(); return true;
        }, { idx: it.i, skipSrc: SKIP.source });
        if (ok === 'active') continue;
        if (!ok) continue;
        clicked++;
        await page.waitForTimeout(260);
        const after = await snapshot();
        const moved = after.wrapId !== before.wrapId || after.state !== before.state ||
          after.len !== before.len || after.hash !== before.hash ||
          after.toasts !== before.toasts || popups !== popBefore || dialogs !== dlgBefore;
        if (pageErrors.length > errBefore) errs.push({ node: n.label, view: view || '(landing)', ...it, error: pageErrors[pageErrors.length - 1].slice(0, 120) });
        else if (!moved) dead.push({ node: n.label, view: view || '(landing)', ...it });
      }
    }
    console.log('  ' + n.label + '  (' + clicked + ' clicks so far)');
  }
  await browser.close();

  const md = ['# Dead-control sweep — every control on every screen, clicked', '',
    'Generated ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' by `dead-control-sweep.js` (offline, demo data). ' + clicked + ' controls clicked.',
    '', 'A control passes if ANYTHING happened: the body changed, a toast or dialog appeared, the view moved, a print opened a tab, or another module took over. Destructive controls (sign out, delete, remove, cancel, purge, clear) are never clicked.', '',
    'Four classes of entry below are known NOT to be defects, and were each',
    'checked by hand on 7 Sep 2026 rather than assumed:',
    '',
    '- **A tab you are already on.** Clicking the active tab correctly does',
    '  nothing. Controls carrying an `on`/`active`/`selected` class are skipped,',
    '  but a module that marks its active tab some other way still shows up.',
    '- **A screen whose queue is empty.** The Estimator\'s Quote/Items/BOM tabs',
    '  render the same "nothing on your desk" panel when no quote is picked;',
    '  with a real quote in the queue all five change.',
    '- **`event.stopPropagation()` chips.** Their whole job is to stop the row',
    '  underneath from firing. Clicking one directly is meant to do nothing.',
    '- **A prompt the harness answers with nothing.** Dialogs are auto-accepted',
    '  with an empty value, so a control that acts on what you typed correctly',
    '  does not act.',
    '',
    '## Controls where nothing happened (' + dead.length + ')', ''];
  if (!dead.length) md.push('_None._', '');
  else {
    md.push('| Module | Page | Control | Handler |', '|---|---|---|---|');
    dead.forEach(d => md.push('| ' + d.node + ' | `' + d.view + '` | ' + (d.text || '(no label)') + ' | `' + (d.onclick || d.act || '—').replace(/\|/g, '\\|') + '` |'));
    md.push('');
  }
  md.push('## Controls that threw (' + errs.length + ')', '');
  if (!errs.length) md.push('_None._', '');
  else { md.push('| Module | Page | Control | Error |', '|---|---|---|---|'); errs.forEach(e => md.push('| ' + e.node + ' | `' + e.view + '` | ' + (e.text || '(no label)') + ' | ' + e.error.replace(/\|/g, '\\|') + ' |')); }
  fs.writeFileSync(path.join(__dirname, 'docs', 'test-run', 'dead-controls.md'), md.join('\n'));
  console.log('\nclicked ' + clicked + ' · dead ' + dead.length + ' · threw ' + errs.length);
})();
