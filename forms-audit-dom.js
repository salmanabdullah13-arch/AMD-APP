/**
 * forms-audit-dom.js — the clicking half of the comprehensive forms pass
 * (Salman, 6 Sep 2026). Opens every module and every page on its rail, with
 * demo data, and inventories what a person actually meets:
 *
 *   1. Selects that open pre-answered — the rendered first option carries a
 *      real value (the helper that builds the list emits no placeholder).
 *      Reported separately for selects that sit in a CREATE form, where the
 *      value becomes a record, versus filters, where a default is fine.
 *   2. Tap targets under 44px at 390px.
 *   3. Horizontal overflow at 390px.
 *   4. Number inputs with no min, where a negative silently saves.
 *
 *   node forms-audit-dom.js       → docs/test-run/forms-audit-dom.md
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
// Rail pages worth walking per module, beyond the landing.
const WALK = {
  sales: ["salesSetTopView('enq-list')", "salesSetTopView('qtn-list')", "openEnquiryCreate()"],
  jobs: ["jobsView='list';renderJobsBody()", "jobsView='reports';renderJobsBody()"],
  purchasing: ["purchGoTo('purch-requests')", "purchGoTo('purch-orders')", "purchGoTo('purch-suppliers')", "openPRForm()"],
  storekeeper: ["skGoTo('items')", "skGoTo('masters')", "skGoTo('adjustment')", "skGoTo('mi')", "skGoTo('requests')"],
  accounts: ["accountsSetView('receipt-new')", "accountsSetView('payment-new')", "accountsSetView('journal-new')", "accountsSetView('ledger-new')", "accountsSetView('custupdate')", "accountsSetView('custbanking')"],
  hr: ["hrSetView('emp-list')", "hrSetView('payroll-runs')"],
  curtain: ["curtGoTo('curt-jobs')", "curtGoTo('curt-windows')", "curtGoTo('curt-bom')", "curtGoTo('curt-fabric')", "curtGoTo('curt-install')"],
  estimator: ["estimatorView='dashboard';renderEstimatorBody()"],
  operations: ["opsGoTo('projects')", "opsGoTo('capacity')", "opsStep('route')"],
  production: ["PrdUI.go('page','mat')", "PrdUI.go('page','team')", "PrdUI.go('form','allot')", "PrdUI.go('form','cut')", "PrdUI.go('form','ot')"],
  upholstery: ["UphUI.go('page','reg')", "UphUI.go('form','plan')", "UphUI.go('form','ot')"],
  'crew-timer': ["timerView='start';renderCrewTimerBody()", "timerView='crews';renderCrewTimerBody()"],
  fleet: ["fleetView='new-inspection';renderFleetBody()"],
  delivery: ["deliverySchedView='schedule';renderDeliverySchedBody()"],
  owner: [], admin: ["adminSetView('users')", "adminSetView('discounts')"], approver: [], 'delivery-scheduling': []
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(fileUrl); await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => { loadDemoData(); if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; });
  const nodes = await page.evaluate(() => window.__eco3d.NODES.filter(n => n.built && !n.retired).map(n => ({ id: n.id, label: n.label })));

  const scan = () => page.evaluate(() => {
    const vis = [...document.querySelectorAll('[id$="-module-wrap"], #tracks-dash-wrap, #qc-dash-wrap, #install-crew-wrap, #pipeline-board-wrap')].filter(w => getComputedStyle(w).display !== 'none');
    const wrap = vis[0]; if (!wrap) return null;
    const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    // A select is "in a create form" if a create-ish button shares its card.
    const CREATE = /add|create|save|submit|raise|record|issue|release|book|send|apply|generate|allot|schedule|confirm|log |start/i;
    const selects = [...wrap.querySelectorAll('select')].filter(shown).map(s => {
      // The option actually SELECTED — a list whose current value sits on a later
      // option (a payroll month pre-set to now, a role pre-set to the person's own)
      // is correct, not pre-answered. Only index 0 with a real value is the defect.
      const o = s.options[s.selectedIndex >= 0 ? s.selectedIndex : 0];
      const atZero = s.selectedIndex <= 0;
      const card = s.closest('.sales-card,.sk-card,.p-card,.prd-card,.uph-card,.pur-card,.od-card,.ed-card,.opsd-card,section,form,div');
      let host = s.parentElement, btn = null;
      for (let i = 0; i < 6 && host; i++) { btn = [...host.querySelectorAll('button')].find(b => CREATE.test(b.textContent || '') || CREATE.test(b.getAttribute('onclick') || '')); if (btn) break; host = host.parentElement; }
      const lbl = (s.closest('.sales-field,.sk-field,.p-field,div') || {}).textContent || '';
      return { id: s.id || '(no id)', n: s.options.length, firstVal: o ? o.value : null, firstText: o ? (o.textContent || '').trim().slice(0, 28) : null,
        placeholder: !o || !atZero || o.value === '' || /^(select|choose|all|any|—|-|none)/i.test((o.textContent || '').trim()),
        inCreateForm: !!btn, action: btn ? (btn.textContent || '').trim().slice(0, 24) : null, label: lbl.replace(/\s+/g, ' ').trim().slice(0, 40) };
    });
    const numbers = [...wrap.querySelectorAll('input[type=number]')].filter(shown).map(i => ({ id: i.id || '(no id)', min: i.getAttribute('min'), step: i.getAttribute('step') }));
    return { wrapId: wrap.id, selects, numbers };
  });

  const scanPhone = () => page.evaluate(() => {
    const vis = [...document.querySelectorAll('[id$="-module-wrap"], #tracks-dash-wrap, #qc-dash-wrap, #install-crew-wrap, #pipeline-board-wrap')].filter(w => getComputedStyle(w).display !== 'none');
    const wrap = vis[0]; if (!wrap) return null;
    const small = [...wrap.querySelectorAll('button, select, input[type=file], .qs-b, [onclick]')].filter(el => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      if (el.closest('.xs-side, .xs-top')) return false;          // shell chrome is its own design
      return (r.height < 30 || r.width < 24) && (el.textContent || '').trim().length < 30;
    }).map(el => { const r = el.getBoundingClientRect(); return { tag: el.tagName, cls: (el.className || '').toString().slice(0, 30), text: (el.textContent || '').trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; });
    return { overflow: wrap.scrollWidth > wrap.clientWidth + 1, scrollW: wrap.scrollWidth, clientW: wrap.clientWidth, small: small.slice(0, 6), smallN: small.length };
  });

  const rows = [];
  for (const n of nodes) {
    const views = ['(landing)'].concat(WALK[n.id] || []);
    for (const v of views) {
      const opened = await page.evaluate(({ id, v }) => {
        document.querySelectorAll('[id$="-module-wrap"], #tracks-dash-wrap, #qc-dash-wrap, #install-crew-wrap, #pipeline-board-wrap').forEach(w => { w.style.display = 'none'; });
        const node = window.__eco3d.NODES.find(x => x.id === id); if (!node) return 'no node';
        try { node.launch(); } catch (e) { return 'launch: ' + e.message; }
        if (v !== '(landing)') { try { (new Function(v))(); } catch (e) { return 'view: ' + e.message; } }
        return 'ok';
      }, { id: n.id, v });
      if (opened !== 'ok') { rows.push({ node: n.label, view: v, error: opened }); continue; }
      await page.waitForTimeout(220);
      const d = await scan();
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(320);
      const p = await scanPhone();
      await page.setViewportSize({ width: 1280, height: 950 }); await page.waitForTimeout(200);
      if (d) rows.push({ node: n.label, view: v, ...d, phone: p });
    }
    console.log('  ' + n.label);
  }
  await browser.close();

  // ── report ──
  const preAnswered = [], filters = [], noMin = [], overflow = [], tiny = [], errs = [];
  const seen = new Set();
  rows.forEach(r => {
    if (r.error) { errs.push(r); return; }
    (r.selects || []).forEach(s => {
      if (s.placeholder) return;
      const key = r.node + '|' + s.id;
      if (seen.has(key)) return; seen.add(key);
      (s.inCreateForm ? preAnswered : filters).push({ node: r.node, view: r.view, ...s });
    });
    (r.numbers || []).forEach(i => { if (i.min === null && i.id !== '(no id)' && !noMin.some(x => x.id === i.id)) noMin.push({ node: r.node, ...i }); });
    if (r.phone && r.phone.overflow) overflow.push({ node: r.node, view: r.view, by: r.phone.scrollW - r.phone.clientW });
    if (r.phone && r.phone.smallN) tiny.push({ node: r.node, view: r.view, n: r.phone.smallN, sample: r.phone.small.map(s => s.text + ' ' + s.w + 'x' + s.h).join(', ').slice(0, 90) });
  });
  const md = ['# Forms pass — the clicking half (every module, every rail page)', '',
    'Generated ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' by `forms-audit-dom.js` (offline, demo data). ' + rows.length + ' screens walked.', '',
    '## 1 · Selects that open pre-answered INSIDE a create form (' + preAnswered.length + ')', '',
    'The rendered first option carries a real value and the card has a create/save action — whatever sorts first is what gets saved unless the person notices. This is the class of Salman\'s Unit-defaults-to-Box.', ''];
  if (!preAnswered.length) md.push('_None._', '');
  else { md.push('| Module | Page | id | Opens on | Action on the card |', '|---|---|---|---|---|'); preAnswered.forEach(s => md.push('| ' + s.node + ' | `' + s.view + '` | `' + s.id + '` | ' + (s.firstText || '') + ' | ' + (s.action || '') + ' |')); md.push(''); }
  md.push('## 2 · Selects pre-answered outside a create form (' + filters.length + ')', '', 'Filters and pick-a-row selects — a default is usually right here. Listed for completeness.', '');
  if (filters.length) { md.push('| Module | id | Opens on |', '|---|---|---|'); filters.forEach(s => md.push('| ' + s.node + ' | `' + s.id + '` | ' + (s.firstText || '') + ' |')); md.push(''); }
  md.push('## 3 · Horizontal overflow at 390px (' + overflow.length + ')', '');
  if (!overflow.length) md.push('_None._', ''); else { md.push('| Module | Page | Over by |', '|---|---|---|'); overflow.forEach(o => md.push('| ' + o.node + ' | `' + o.view + '` | ' + o.by + 'px |')); md.push(''); }
  md.push('## 4 · Controls under 30px on a phone (' + tiny.length + ' screens)', '');
  if (!tiny.length) md.push('_None._', ''); else { md.push('| Module | Page | Count | Sample |', '|---|---|---|---|'); tiny.forEach(t => md.push('| ' + t.node + ' | `' + t.view + '` | ' + t.n + ' | ' + t.sample + ' |')); md.push(''); }
  md.push('## 5 · Number inputs with no min (' + noMin.length + ')', '', 'A negative quantity or rate saves silently.', '');
  if (noMin.length) { md.push('| Module | id |', '|---|---|'); noMin.forEach(i => md.push('| ' + i.node + ' | `' + i.id + '` |')); md.push(''); }
  if (errs.length) { md.push('## Screens that would not open', ''); errs.forEach(e => md.push('- ' + e.node + ' `' + e.view + '` — ' + e.error)); md.push(''); }
  md.push('Page errors during the walk: ' + pageErrors.length + (pageErrors.length ? ' — ' + pageErrors.slice(0, 3).join(' | ') : ''));
  fs.writeFileSync(path.join(__dirname, 'docs', 'test-run', 'forms-audit-dom.md'), md.join('\n'));
  console.log('\npre-answered in create forms: ' + preAnswered.length + ' · filters: ' + filters.length + ' · overflow: ' + overflow.length + ' · tiny-control screens: ' + tiny.length + ' · no-min numbers: ' + noMin.length + ' · page errors: ' + pageErrors.length);
})();
