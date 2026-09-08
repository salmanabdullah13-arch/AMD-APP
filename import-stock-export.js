/**
 * import-stock-export.js — load a QPRO stock export into the live Item Master.
 *
 * Salman, 8 Sep 2026: "Update this as the stock summary — add all this to the
 * stocks." The app had been seeded from the August 2 export, 200 items, which
 * turned out to be the curtain and blind side only: no MDF, no plywood, no
 * veneer, so a joinery BOM could not be built from real stock and joinery
 * material cost could not reach the product P&L. This export carries the
 * whole inventory.
 *
 * Matching is by NAME, normalised, because this export has no item codes —
 * so an item already in the master keeps its real QPRO code and gains the new
 * stock figure, and only genuinely new names are minted a code.
 *
 * Rows are written with legacy_import = true: the duplicate-code trigger
 * exists to stop a person creating a second code for the same thing, and a
 * real export legitimately carries near-identical names (MDF PLAIN 4X8X12mm
 * against 4X8X18mm), which it would otherwise refuse.
 *
 *   SUPABASE_PAT=sbp_... node import-stock-export.js <export.xlsx> [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const PAT = process.env.SUPABASE_PAT;
const PROJECT = 'rwbxycxrrslgxskoufxo';
const DRY = process.argv.indexOf('--dry-run') !== -1;
const FILE = process.argv[2];

function sql(query) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com', path: '/v1/projects/' + PROJECT + '/database/query', method: 'POST',
      headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let o = ''; res.on('data', d => o += d); res.on('end', () => { try { resolve(JSON.parse(o)); } catch (e) { resolve(o); } }); });
    req.on('error', e => resolve({ error: e.message }));
    req.write(body); req.end();
  });
}

/* A minimal xlsx reader — the app already ships SheetJS for the browser, but
   this runs in Node where it is not installed, and an export is just a zip. */
function readSheet(file) {
  const tmp = path.join(__dirname, '_import_tmp');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.copyFileSync(file, path.join(tmp, 'f.zip'));
  execSync('unzip -o -q f.zip', { cwd: tmp });
  const ssPath = path.join(tmp, 'xl', 'sharedStrings.xml');
  const strs = [];
  if (fs.existsSync(ssPath)) {
    const ss = fs.readFileSync(ssPath, 'utf8');
    const re = /<si>([\s\S]*?)<\/si>/g;
    let m; while ((m = re.exec(ss))) strs.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
  }
  const wsDir = path.join(tmp, 'xl', 'worksheets');
  const sheet = fs.readFileSync(path.join(wsDir, fs.readdirSync(wsDir)[0]), 'utf8');
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let r;
  while ((r = rowRe.exec(sheet))) {
    const cells = {};
    const cRe = /<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g;
    let c;
    while ((c = cRe.exec(r[1]))) {
      let v = (c[3].match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '';
      if (/t="s"/.test(c[2])) v = strs[Number(v)] !== undefined ? strs[Number(v)] : v;
      else if (/t="inlineStr"/.test(c[2])) v = (c[3].match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || '';
      cells[c[1]] = String(v).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    }
    const cols = Object.keys(cells).sort((a, b) => a.length - b.length || a.localeCompare(b));
    rows.push(cols.map(k => cells[k]));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return rows;
}

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const q = (s) => "'" + String(s === null || s === undefined ? '' : s).replace(/'/g, "''") + "'";
const num = (v) => { const n = Number(String(v).replace(/,/g, '')); return isFinite(n) ? Math.round(n * 1000) / 1000 : 0; };

(async () => {
  if (!PAT) { console.error('SUPABASE_PAT is required.'); process.exit(1); }
  if (!FILE || !fs.existsSync(FILE)) { console.error('usage: node import-stock-export.js <export.xlsx> [--dry-run]'); process.exit(1); }

  const rows = readSheet(FILE);
  // Find the header row, then read Item Name / Closing Stock / purchase Rate.
  let head = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some(c => /item name/i.test(c))) { head = i; break; }
  }
  if (head < 0) { console.error('No "Item Name" header found — is this a stock export?'); process.exit(1); }
  const cols = rows[head].map(c => String(c).toLowerCase());
  const iName = cols.findIndex(c => /item name/.test(c));
  const iStock = cols.findIndex(c => /closing stock/.test(c));
  const iRate = cols.findIndex(c => /purchase rate/.test(c));
  const iCode = cols.findIndex(c => /item code/.test(c));
  const iCost = cols.findIndex(c => /cost price/.test(c));

  const items = [];
  const seen = new Set();
  for (let i = head + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[iName] || '').trim();
    if (!name) continue;
    const key = norm(name);
    if (seen.has(key)) continue;          // an export can list the same name twice
    seen.add(key);
    items.push({
      name,
      code: iCode >= 0 ? (r[iCode] || '').trim() : '',
      stock: iStock >= 0 ? num(r[iStock]) : 0,
      rate: iRate >= 0 ? num(r[iRate]) : 0,
      cost: iCost >= 0 ? num(r[iCost]) : 0
    });
  }
  console.log('read ' + items.length + ' distinct items from ' + path.basename(FILE));

  const existing = await sql('select id, name, cost, closing_stock from public.item_master');
  if (!Array.isArray(existing)) { console.error('could not read item_master:', JSON.stringify(existing).slice(0, 200)); process.exit(1); }
  const byName = new Map();
  existing.forEach(e => byName.set(norm(e.name), e));
  console.log('live item master holds ' + existing.length + ' items');

  let maxSeq = 0;
  existing.forEach(e => { const m = /^IT0*(\d+)$/.exec(e.id); if (m) maxSeq = Math.max(maxSeq, Number(m[1])); });

  const updates = [], inserts = [];
  items.forEach(it => {
    const hit = byName.get(norm(it.name));
    if (hit) {
      updates.push({ id: hit.id, stock: it.stock, rate: it.rate,
        // Only fill a cost that is missing — a real cost already on the record
        // is better than a purchase rate, and must not be overwritten.
        cost: (Number(hit.cost) || 0) > 0 ? Number(hit.cost) : (it.cost || it.rate) });
    } else {
      inserts.push({ id: 'IT' + String(++maxSeq).padStart(6, '0'), name: it.name,
        stock: it.stock, rate: it.rate, cost: it.cost || it.rate });
    }
  });
  console.log('would update ' + updates.length + ' existing, insert ' + inserts.length + ' new');
  const mdf = inserts.filter(i => /\bmdf\b|plywood|veneer/i.test(i.name)).length;
  console.log('  of the new: ' + mdf + ' MDF / plywood / veneer');
  if (DRY) { console.log('(dry run — nothing written)'); return; }

  // Updates in batches, via a values list.
  const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
  let done = 0;
  for (const part of chunk(updates, 300)) {
    const values = part.map(u => '(' + q(u.id) + ',' + u.stock + ',' + u.rate + ',' + u.cost + ')').join(',');
    const r = await sql('update public.item_master m set closing_stock = v.stock, last_purchase_rate = v.rate, cost = v.cost'
      + ' from (values ' + values + ') as v(id, stock, rate, cost) where m.id = v.id');
    if (r && r.message) { console.error('update failed:', String(r.message).slice(0, 160)); process.exit(1); }
    done += part.length;
    process.stdout.write('\r  updated ' + done + '/' + updates.length);
  }
  if (updates.length) console.log('');

  done = 0;
  for (const part of chunk(inserts, 200)) {
    const values = part.map(i => '(' + q(i.id) + ',' + q(i.name) + ',' + i.stock + ',' + i.stock + ',' + i.rate + ',' + i.cost + ',true)').join(',');
    const r = await sql('insert into public.item_master (id, name, closing_stock, opening_stock, last_purchase_rate, cost, legacy_import) values '
      + values + ' on conflict (id) do nothing');
    if (r && r.message) { console.error('insert failed:', String(r.message).slice(0, 200)); process.exit(1); }
    done += part.length;
    process.stdout.write('\r  inserted ' + done + '/' + inserts.length);
  }
  if (inserts.length) console.log('');

  const after = await sql("select count(*)::int as rows, count(*) filter (where name ilike '%mdf%')::int as mdf,"
    + " count(*) filter (where closing_stock < 0)::int as negative from public.item_master");
  console.log('live item master now:', JSON.stringify(after));
})();
