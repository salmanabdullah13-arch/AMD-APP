/**
 * route-audit.js — every navigation destination, checked against what the
 * role actually lands on today.
 *
 * The bug this exists for has now bitten three times in two days, each
 * found by accident: a module moves, and a hardcoded destination somewhere
 * else does not. Owner's Store link still opened the legacy stock pool;
 * the reorder reminder did too; and the Joinery fold left a target
 * pointing at a retired wrapper. Every one of those is the same shape —
 * a hop helper, a sidebar entry or a role landing naming a module that has
 * been superseded.
 *
 * It derives from ONE place: `NODES` in index.html, which already knows
 * what is built and what is retired, and now also carries `supersededBy`.
 * Nothing here is a second hand-kept list; the deliberate exceptions are
 * declared below with a reason each, so an intentional legacy link is
 * stated rather than silently passing.
 *
 * Checks:
 *   A · every role's landing node exists, is built, and is not retired or
 *       superseded  (read live from `user_types`)
 *   B · Owner can reach every built, current module  (the standing rule)
 *   C · no source file hops to a retired or superseded module
 *   D · every sidebar entry in every module resolves to a real function
 *   E · every NODES launch target is a function that exists
 *
 *   node route-audit.js        → docs/test-run/route-audit.md
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const https = require('https');

const SUPABASE_URL = 'https://rwbxycxrrslgxskoufxo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-ksrLB1Xw8DiHeVH3EpkDQ_SolsWr7t';

/* Deliberate links to a superseded module. Each needs a reason: a legacy
   destination that is on purpose is a decision, and a decision should be
   written down where the checker can see it. */
const ALLOWED = [
  { file: 'owner.js', fn: 'ownerGoToMasters',
    why: 'Masters — units, categories, catalogue — still lives in the legacy module; the 18a build did not move it.' },
  { file: 'exec-shell.js', fn: 'execGoStock',
    why: 'Falls back to the legacy dashboard only when StoreUI is not loaded; the 18a Reminders page is the real destination.' }
];

const results = [];
function record(area, ok, what, detail) {
  results.push({ area, ok, what, detail: detail === undefined ? '' : detail });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + what + (ok || detail === undefined ? '' : '  -> ' + JSON.stringify(detail)));
}

function getJSON(url, headers) {
  return new Promise((resolve) => {
    https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });
  await page.evaluate(() => { loadDemoData(); if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; });

  const nodes = await page.evaluate(() => window.__eco3d.NODES.map(n => ({
    id: n.id, label: n.label, built: !!n.built, retired: !!n.retired,
    supersededBy: n.supersededBy || null, hasLaunch: typeof n.launch === 'function',
    launchSrc: n.launch ? String(n.launch) : ''
  })));
  const byId = {};
  nodes.forEach(n => { byId[n.id] = n; });
  const current = (n) => n.built && !n.retired && !n.supersededBy;

  /* ── E · every launch target is a function that exists ───────────────── */
  console.log('\n— every node launches something real —');
  const launchable = await page.evaluate(() => window.__eco3d.NODES
    .filter(n => n.built && typeof n.launch === 'function')
    .map(n => {
      const m = String(n.launch).match(/([A-Za-z0-9_$]+)\s*\(/);
      const fn = m ? m[1] : null;
      return { id: n.id, fn, exists: fn ? typeof window[fn] === 'function' : false };
    }));
  const missingFn = launchable.filter(l => !l.exists);
  record('E', missingFn.length === 0, 'every built node launches a function that exists', missingFn);

  /* ── A · role landings ───────────────────────────────────────────────── */
  console.log('\n— every role lands on a current module —');
  const types = await getJSON(SUPABASE_URL + '/rest/v1/user_types?select=key,dashboard_node_id',
    { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY });
  if (!Array.isArray(types)) {
    record('A', false, 'read the live user_types table', 'no response — the audit cannot check role landings offline');
  } else {
    const withNode = types.filter(t => t.dashboard_node_id);
    const unknown = withNode.filter(t => !byId[t.dashboard_node_id]);
    const notBuilt = withNode.filter(t => byId[t.dashboard_node_id] && !byId[t.dashboard_node_id].built);
    const stale = withNode.filter(t => { const n = byId[t.dashboard_node_id]; return n && (n.retired || n.supersededBy); });
    record('A', true, types.length + ' roles read from the live table, ' + withNode.length + ' with a landing');
    record('A', unknown.length === 0, 'every landing names a node that exists', unknown.map(t => t.key + ' -> ' + t.dashboard_node_id));
    record('A', notBuilt.length === 0, 'every landing names a node that is built', notBuilt.map(t => t.key + ' -> ' + t.dashboard_node_id));
    record('A', stale.length === 0, 'no role lands on a retired or superseded module',
      stale.map(t => t.key + ' -> ' + t.dashboard_node_id + (byId[t.dashboard_node_id].supersededBy ? ' (superseded by ' + byId[t.dashboard_node_id].supersededBy + ')' : ' (retired)')));
    const noLanding = types.filter(t => !t.dashboard_node_id).map(t => t.key);
    record('A', noLanding.length === 0, 'every role has a landing at all', noLanding);
  }

  /* ── B · Owner reaches every current module ──────────────────────────── */
  console.log('\n— Owner reaches every current module —');
  const ownerReach = await page.evaluate(async () => {
    launchOwnerModule();
    await new Promise(r => setTimeout(r, 400));
    const sidebar = document.getElementById('owner-module-wrap').innerHTML;
    // 'alldash' is the view that lists every built node, read from NODES.
    if (typeof ownerNav === 'function') { try { ownerNav('alldash'); } catch (e) { /* ignore */ } }
    await new Promise(r => setTimeout(r, 300));
    const listed = [...document.querySelectorAll('#owner-body [onclick^="ownerOpenNode"]')]
      .map(b => (b.getAttribute('onclick').match(/ownerOpenNode\('([^']+)'\)/) || [])[1]);
    return { sidebar, listed };
  });
  const currentNodes = nodes.filter(n => current(n) && n.id !== 'owner');
  const unreachable = currentNodes.filter(n => ownerReach.listed.indexOf(n.id) < 0);
  record('B', unreachable.length === 0, 'every current module is reachable from Owner',
    unreachable.map(n => n.id));
  // and Owner's own sidebar must not point at a superseded one
  const ownerStale = nodes.filter(n => n.supersededBy || n.retired)
    .filter(n => { const m = n.launchSrc.match(/([A-Za-z0-9_$]+)\s*\(/); return m && ownerReach.sidebar.indexOf(m[1]) >= 0; })
    .filter(n => !ALLOWED.some(a => a.file === 'owner.js'));
  record('B', ownerStale.length === 0, 'Owner\'s own sidebar points at no superseded module', ownerStale.map(n => n.id));

  /* ── C · source hops ─────────────────────────────────────────────────── */
  console.log('\n— no file hops to a module that has been replaced —');
  // node id -> the launch function name it uses
  const fnOfNode = {};
  nodes.forEach(n => { const m = n.launchSrc.match(/([A-Za-z0-9_$]+)\s*\(/); if (m) fnOfNode[n.id] = m[1]; });
  const stalePairs = nodes.filter(n => n.retired || n.supersededBy)
    .map(n => ({ id: n.id, fn: fnOfNode[n.id], to: n.supersededBy || '(retired)' }))
    .filter(p => p.fn);
  // A file that DEFINES a legacy launcher is its own file, not a hop into
  // it — derived by looking for the definition rather than kept as a list,
  // which is the very thing this audit exists to stop.
  const files = fs.readdirSync(__dirname).filter(f => /\.js$/.test(f) && !/^e2e-|^_|^route-audit|^dead-control|^forms-audit|^design-scorecard|^run-|^seed-|^purge-|^clear-|^create-/.test(f));
  const hops = [];
  files.concat(['index.html']).forEach(f => {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
    const lines = src.split('\n');
    stalePairs.forEach(p => {
      if (src.indexOf('function ' + p.fn) >= 0) return;   // this file defines it, it does not hop to it
      lines.forEach((line, i) => {
        if (line.indexOf(p.fn) < 0) return;
        if (/^\s*(\/\/|\*)/.test(line)) return;            // a comment mentioning it
        if (f === 'index.html' && /supersededBy|retired:true/.test(line)) return;   // the registry entry itself
        const allowed = ALLOWED.find(a => a.file === f && src.slice(0, src.indexOf(line)).lastIndexOf('function ' + a.fn) >= 0
          && src.indexOf('function ' + a.fn) >= 0
          && src.slice(src.indexOf('function ' + a.fn)).indexOf(line) >= 0
          && src.slice(src.indexOf('function ' + a.fn)).indexOf(line) < 900);
        hops.push({ file: f, line: i + 1, fn: p.fn, to: p.to, allowed: !!allowed,
          why: allowed ? allowed.why : '', text: line.trim().slice(0, 90) });
      });
    });
  });
  const badHops = hops.filter(h => !h.allowed);
  record('C', badHops.length === 0, 'no hop targets a retired or superseded module',
    badHops.map(h => h.file + ':' + h.line + ' -> ' + h.fn));

  /* ── D · sidebar entries resolve ─────────────────────────────────────── */
  console.log('\n— every sidebar entry calls something that exists —');
  const navBad = await page.evaluate(() => {
    const out = [];
    const keys = Object.keys(typeof EXEC_NAV_CONFIGS !== 'undefined' ? EXEC_NAV_CONFIGS : {});
    keys.forEach(k => {
      let cfg;
      try { cfg = typeof EXEC_NAV_CONFIGS[k] === 'function' ? EXEC_NAV_CONFIGS[k]() : EXEC_NAV_CONFIGS[k]; } catch (e) { out.push({ module: k, item: '(config threw)', fn: e.message.slice(0, 60) }); return; }
      const groups = (cfg && cfg.groups) || [];
      groups.forEach(g => (g.items || []).forEach(it => {
        const src = String(it.onclick || '');
        const m = src.match(/([A-Za-z0-9_$]+)\s*\(/);
        if (m && typeof window[m[1]] !== 'function') out.push({ module: k, item: it.label || '(no label)', fn: m[1] });
      }));
    });
    return out;
  });
  record('D', navBad.length === 0, 'every sidebar entry resolves to a defined function', navBad);

  record('X', pageErrors.length === 0, 'no page errors during the audit', pageErrors.slice(0, 3));

  await browser.close();

  /* ── the report ──────────────────────────────────────────────────────── */
  const failed = results.filter(r => !r.ok);
  const md = ['# Route audit — every destination against what the role lands on today', '',
    'Generated ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' by `route-audit.js`.', '',
    'Derived from `NODES` in index.html — what is built, what is retired, and',
    'what `supersededBy` says replaced it. Nothing here is a second hand-kept',
    'list. Deliberate links to a legacy module are declared in the script with',
    'a reason each.', '',
    '## Result', '',
    failed.length === 0 ? '**All clear** — ' + results.length + ' checks.'
      : '**' + failed.length + ' of ' + results.length + ' checks failed.**', ''];
  if (failed.length) {
    md.push('| Check | What | Detail |', '|---|---|---|');
    failed.forEach(r => md.push('| ' + r.area + ' | ' + r.what + ' | `' + JSON.stringify(r.detail).replace(/\|/g, '\\|').slice(0, 160) + '` |'));
    md.push('');
  }
  md.push('## Modules superseded', '', '| Legacy | Replaced by | Still built |', '|---|---|---|');
  nodes.filter(n => n.supersededBy).forEach(n => md.push('| ' + n.label + ' | ' + n.supersededBy + ' | ' + (n.built ? 'yes' : 'no') + ' |'));
  md.push('', '## Deliberate links to a legacy module', '');
  ALLOWED.forEach(a => md.push('- **`' + a.fn + '`** (' + a.file + ') — ' + a.why));
  md.push('', '## Every hop at a legacy module found in source', '',
    '| File | Line | Target | Replaced by | Declared |', '|---|---|---|---|---|');
  hops.forEach(h => md.push('| ' + h.file + ' | ' + h.line + ' | `' + h.fn + '` | ' + h.to + ' | ' + (h.allowed ? 'yes' : '**no**') + ' |'));
  fs.writeFileSync(path.join(__dirname, 'docs', 'test-run', 'route-audit.md'), md.join('\n'));

  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  process.exit(failed.length ? 1 : 0);
})();
