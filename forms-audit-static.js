/**
 * forms-audit-static.js — the reading half of the comprehensive forms pass
 * (Salman, 6 Sep 2026). His own ten minutes on the quotation wizard found
 * five defects four scripted iterations had missed, all of one kind: the
 * screen, not the flow. Two of those classes can be found by reading the
 * source rather than clicking, and this finds every other instance of them.
 *
 *   A. A dropped refusal — a data-layer function that can return {error}
 *      called from a UI file with its result thrown away, so the guard
 *      fires and the person sees nothing. ("Images don't save.")
 *   B. A select that opens pre-answered — the first <option> carries a real
 *      value, so whatever happens to be first is what gets saved. (Unit
 *      opened on "Box".)
 *
 *   node forms-audit-static.js            → docs/test-run/forms-audit-static.md
 */
const fs = require('fs');
const path = require('path');

const DATA_FILES = ['data.js', 'store-data.js', 'purchase-data.js', 'production-data.js', 'upholstery-data.js', 'crew-timer-data.js'];
const UI_FILES = fs.readdirSync(__dirname).filter(f => /\.js$/.test(f) &&
  !/^(e2e-|run-|_|forms-audit|design-scorecard|seed-|clear-|purge-|create-role|smoke-test)/.test(f) &&
  !DATA_FILES.includes(f) && f !== 'sw.js' && f !== 'demo-data.js');

const src = {};
[...DATA_FILES, ...UI_FILES].forEach(f => { const p = path.join(__dirname, f); if (fs.existsSync(p)) src[f] = fs.readFileSync(p, 'utf8'); });

// ── which data-layer functions can refuse ──
const refusers = new Map();   // name -> file
DATA_FILES.forEach(f => {
  const s = src[f]; if (!s) return;
  const re = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  let m;
  while ((m = re.exec(s))) {
    const name = m[1];
    const start = m.index;
    const next = s.indexOf('\nfunction ', start + 10);
    const body = s.slice(start, next < 0 ? s.length : next);
    if (/return\s*\{\s*error\s*:/.test(body)) refusers.set(name, f);
  }
});

// ── A. call sites in UI files that throw the result away ──
const dropped = [];
UI_FILES.forEach(f => {
  const s = src[f]; if (!s) return;
  const lines = s.split('\n');
  lines.forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    refusers.forEach((_df, fn) => {
      // statement position: start of a line (or after ; or { ) and NOT captured
      const re = new RegExp('(^|[;{}]\\s*)' + fn + '\\s*\\(');
      if (!re.test(code.trim() === '' ? code : code)) return;
      if (!re.test(code)) return;
      // captured, tested or returned somewhere on the line → fine
      if (new RegExp('(=|return|\\?|&&|\\|\\||\\.then|await\\s+[A-Za-z_$]|\\(\\s*)\\s*' + fn + '\\s*\\(').test(code)) return;
      if (/^\s*(\/\/|\*)/.test(line)) return;
      // inside a string (a template handler) — those are click-handler bodies, still real
      dropped.push({ file: f, line: i + 1, fn, code: line.trim().slice(0, 150) });
    });
  });
});

// ── B. selects whose first option is a real value ──
const selects = [];
UI_FILES.concat(['index.html']).forEach(f => {
  const p = path.join(__dirname, f); if (!fs.existsSync(p)) return;
  const s = f === 'index.html' ? fs.readFileSync(p, 'utf8') : src[f];
  if (!s) return;
  const lines = s.split('\n');
  lines.forEach((line, i) => {
    let idx = 0;
    for (;;) {
      const at = line.indexOf('<select', idx); if (at < 0) break;
      idx = at + 7;
      const seg = line.slice(at, at + 900);
      const idm = seg.match(/id=["']?([\w-]+)/);
      const first = seg.match(/<option[^>]*>/);
      const firstVal = first && (first[0].match(/value=["']?([^"'>]*)/) || [])[1];
      const isTemplate = /\$\{[^}]*\.map/.test(seg.slice(0, (first ? seg.indexOf(first[0]) : 60)));
      // a placeholder first option is value="" (or "all"); a mapped list with no
      // placeholder in front of it opens pre-answered on whatever sorts first
      const placeholder = first && (firstVal === '' || /Select|Choose|All|Any|—/i.test(first[0]));
      if (isTemplate || (first && !placeholder && firstVal !== undefined)) {
        selects.push({ file: f, line: i + 1, id: idm ? idm[1] : '(no id)', mapped: isTemplate, first: first ? first[0].slice(0, 70) : '(none)', code: line.trim().slice(0, 120) });
      }
      if (!first) selects.push({ file: f, line: i + 1, id: idm ? idm[1] : '(no id)', mapped: true, first: '(options built elsewhere)', code: line.trim().slice(0, 120) });
    }
  });
});

const md = ['# Forms pass — the reading half (dropped refusals, pre-answered selects)', '',
  'Generated ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' by `forms-audit-static.js`.',
  'Two of the five defects Salman found on 5 Sep are findable by reading: a refusal the screen throws away, and a select that opens on a real answer. This lists every other instance.', '',
  '## A · Refusals thrown away (' + dropped.length + ')', '',
  'A data-layer function that can `return {error}`, called from a screen with its result discarded — the guard fires and the person sees nothing happen.', ''];
if (!dropped.length) md.push('_None._', '');
else {
  md.push('| File | Line | Function | Call |', '|---|---|---|---|');
  dropped.forEach(d => md.push('| `' + d.file + '` | ' + d.line + ' | `' + d.fn + '` | `' + d.code.replace(/\|/g, '\\|') + '` |'));
  md.push('');
}
md.push('## B · Selects that open pre-answered (' + selects.length + ')', '',
  'The first `<option>` carries a real value, so whatever happens to be first is what gets saved unless the person notices. A filter defaulting to "All" is fine; a field that becomes a record is not.', '');
if (!selects.length) md.push('_None._', '');
else {
  md.push('| File | Line | id | First option |', '|---|---|---|---|');
  selects.forEach(s => md.push('| `' + s.file + '` | ' + s.line + ' | `' + s.id + '` | ' + (s.mapped ? '_list, no placeholder_' : '`' + s.first.replace(/\|/g, '\\|') + '`') + ' |'));
}
fs.writeFileSync(path.join(__dirname, 'docs', 'test-run', 'forms-audit-static.md'), md.join('\n'));
console.log('refusing data-layer functions: ' + refusers.size);
console.log('A · dropped refusals: ' + dropped.length);
console.log('B · pre-answered selects: ' + selects.length);
