/**
 * design-scorecard.js — the design audit that runs alongside the end-to-end
 * run (docs/test-run/scenarios.md, "The design audit"). Every built dashboard
 * is opened offline (demo data loaded), screenshotted at 1440 and 390 in
 * light and dark, and graded on one checklist drawn from the design
 * packages. What a script can measure is measured; what needs an eye is
 * left as a screenshot for Salman.
 *
 *   node design-scorecard.js            → docs/test-run/design-scorecard.md + test-run/scorecard/*.png
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, 'test-run', 'scorecard'); fs.mkdirSync(OUT, { recursive: true });
const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

// Role-scoped landings that are not their own node: opened by setting the role, then launching the node.
const EXTRA = [
  { id: 'production', role: 'painting_lead', label: 'Production — Painting Lead' },
  { id: 'production', role: 'joinery_draftsman', label: 'Production — Draftsman' },
  { id: 'production', role: 'joinery_team_leader', label: 'Production — Team Leader' },
  { id: 'upholstery-team-leader', role: 'upholstery_team_leader', label: 'Upholstery — Team Leader' },
  { id: 'upholstery-qc-packaging', role: 'upholstery_qc_packaging_team', label: 'Upholstery — QC/Packaging' }
];
// Roles that must never see money on their screens.
const NO_MONEY_ROLES = { sales: true, painting_lead: true, joinery_draftsman: true, joinery_team_leader: true, upholstery_team_leader: true, upholstery_qc_packaging_team: true, curtain_tracks_team: true, installation_crew_lead: true };
const MONEY_RE = /\bBD\s?\d|\d\.\d{3}\b|\bprofit\b|\bmargin\b|selling price/i;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(fileUrl); await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => { loadDemoData(); if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; });
  const nodes = await page.evaluate(() => window.__eco3d.NODES.filter(n => n.built && !n.retired).map(n => ({ id: n.id, label: n.label })));
  const targets = nodes.map(n => ({ id: n.id, role: 'owner', label: n.label })).concat(EXTRA);

  for (const t of targets) {
    const slug = (t.label || t.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const row = { label: t.label, id: t.id, role: t.role, checks: {}, notes: [] };
    for (const [w, h, name] of [[1440, 950, 'desktop'], [390, 844, 'phone']]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(700);   // the sidebar slides to its drawer position on resize — a shot mid-transition shows a half-open drawer that is not real
      for (const theme of ['light', 'dark']) {
        const r = await page.evaluate(({ id, role, theme }) => {
          window.cloudUserType = role; window.cloudIdentity = 'Scorecard ' + role;
          document.querySelectorAll('[id$="-module-wrap"], #tracks-dash-wrap, #qc-dash-wrap, #install-crew-wrap, #pipeline-board-wrap').forEach(w => { w.style.display = 'none'; });
          const n = window.__eco3d.NODES.find(x => x.id === id); if (!n) return { missing: true };
          try { n.launch(); } catch (e) { return { launchError: e.message }; }
          // theme
          try { if (typeof execSetTheme === 'function') execSetTheme(theme); else if (typeof execThemeApply === 'function') { localStorage.setItem('amd-exec-theme', theme); execThemeApply(); } } catch (e) {}
          const wraps = [...document.querySelectorAll('[id$="-module-wrap"], #tracks-dash-wrap, #qc-dash-wrap, #install-crew-wrap, #pipeline-board-wrap')].filter(x => getComputedStyle(x).display !== 'none');
          const wrap = wraps[0]; if (!wrap) return { noWrap: true };
          const de = document.documentElement;
          const bodyOverflow = de.scrollWidth > de.clientWidth + 1;
          const wrapOverflow = wrap.scrollWidth > wrap.clientWidth + 1;
          const hasShell = !!wrap.querySelector('.xs-side') && !!wrap.querySelector('.xs-top');
          const bg = getComputedStyle(wrap).backgroundColor;
          const isDark = (() => { const m = bg.match(/\d+/g); if (!m) return null; const [r, g, b] = m.map(Number); return (r + g + b) / 3 < 100; })();
          // chart rule: no text node inside a bar fill
          const fillsWithText = [...wrap.querySelectorAll('.cw-bar-fill, .od-bar-fill, .sd-bar-fill, .opsd-fill, .ed-fill, .pur-fill, .prd-fill, .uph-fill, [class*="-fill"]')].filter(f => f.textContent.trim().length > 0).length;
          const text = wrap.innerText || '';
          const emptyStates = (text.match(/Nothing (here|scheduled|in|to)|No (open|incoming|QC|jobs|items)|Every routed job has a lane|not enough data/gi) || []).length;
          const backBtn = !!wrap.querySelector('.xs-back, [data-a="back"], .xs-crumbs');
          const chat = !!document.getElementById('exec-chat-float');
          return { wrapId: wrap.id, bodyOverflow, wrapOverflow, hasShell, isDark, fillsWithText, money: text, emptyStates, backBtn, chat, textLen: text.length };
        }, { id: t.id, role: t.role, theme });
        const key = name + '-' + theme;
        if (r.missing || r.launchError || r.noWrap) { row.checks[key] = { error: r.launchError || (r.missing ? 'node missing' : 'no wrap opened') }; continue; }
        const shotName = slug + '-' + key + '.png';
        await page.screenshot({ path: path.join(OUT, shotName) }).catch(() => null);
        row.checks[key] = {
          shell: r.hasShell, overflow: r.bodyOverflow || r.wrapOverflow, darkOk: theme === 'dark' ? r.isDark === true : r.isDark === false,
          fillsWithText: r.fillsWithText, moneyLeak: NO_MONEY_ROLES[t.role] ? MONEY_RE.test(r.money) : null, emptyStates: r.emptyStates, chat: r.chat, shot: shotName
        };
      }
    }
    rows.push(row);
    console.log('  ' + t.label);
  }
  await browser.close();

  // ── the scorecard ──
  const md = ['# Design scorecard — every built dashboard, 1440 and 390, light and dark', '',
    'Generated ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' by `design-scorecard.js` (offline, demo data). Screenshots in `test-run/scorecard/`.',
    'Measured: the shell chrome (sidebar + topbar) present · no horizontal overflow · dark surface actually dark · no label inside a bar fill · the money rule for roles that must never see it · empty-state copy present. What needs an eye: type sizes, spacing, badge tones, the "first five seconds" test — see the screenshots.', '',
    '| Dashboard | Role | Shell | Overflow 390 | Dark | Fill labels | Money leak | Empty states | Screens |', '|---|---|---|---|---|---|---|---|---|'];
  const flag = (v, good) => v === undefined ? '?' : (v === good ? '✓' : '**✗**');
  let bad = 0;
  rows.forEach(r => {
    const c = r.checks; const d = c['desktop-light'] || {}, p = c['phone-light'] || {}, dk = c['desktop-dark'] || {};
    const err = Object.values(c).find(x => x.error);
    if (err) { md.push('| ' + r.label + ' | ' + r.role + ' | **error: ' + err.error + '** | | | | | | |'); bad++; return; }
    const problems = [!d.shell, p.overflow, !dk.darkOk, d.fillsWithText > 0, d.moneyLeak === true].filter(Boolean).length; if (problems) bad++;
    md.push('| ' + r.label + ' | ' + r.role + ' | ' + flag(d.shell, true) + ' | ' + flag(!p.overflow, true) + ' | ' + flag(dk.darkOk, true) + ' | ' + (d.fillsWithText ? '**' + d.fillsWithText + '**' : '✓') + ' | ' + (d.moneyLeak === null ? 'n/a' : d.moneyLeak ? '**✗**' : '✓') + ' | ' + (d.emptyStates || p.emptyStates || 0) + ' | ' + ['desktop-light', 'desktop-dark', 'phone-light', 'phone-dark'].map(k => c[k] && c[k].shot ? '`' + c[k].shot + '`' : '').filter(Boolean).join(' ') + ' |');
  });
  md.push('', rows.length + ' screens graded · ' + bad + ' with at least one measured problem.', '');
  fs.writeFileSync(path.join(__dirname, 'docs', 'test-run', 'design-scorecard.md'), md.join('\n'));
  fs.writeFileSync(path.join(OUT, 'scorecard.json'), JSON.stringify(rows, null, 1));
  console.log('\n' + rows.length + ' screens · ' + bad + ' flagged · page errors ' + errors.length + (errors.length ? ' → ' + errors.slice(0, 3).join(' | ') : ''));
})();
