/**
 * seed-product-categories.js — put the in-code category master on the live
 * project, so a real session hydrates it rather than relying on the seed.
 *
 * Idempotent: an id already there is updated, not duplicated. Reads the list
 * straight out of data.js so the two can never drift.
 *
 *   SUPABASE_PAT=sbp_... node seed-product-categories.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PAT = process.env.SUPABASE_PAT;
const PROJECT = 'rwbxycxrrslgxskoufxo';
const DRY = process.argv.indexOf('--dry-run') !== -1;

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

/* Read PRODUCT_CATEGORY_SEED out of data.js and build the same ids the app
   builds, rather than keeping a second copy of the list here. */
function readSeed() {
  const src = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
  const i = src.indexOf('const PRODUCT_CATEGORY_SEED = [');
  if (i < 0) throw new Error('PRODUCT_CATEGORY_SEED not found in data.js');
  const end = src.indexOf('\n];', i);
  const block = src.slice(src.indexOf('[', i), end + 2);
  // eslint-disable-next-line no-new-func
  const seed = new Function('return ' + block)();
  const out = [];
  let n = 0;
  seed.forEach(([division, names]) => names.forEach(name => {
    out.push({ id: 'PC' + String(++n).padStart(3, '0'), name, division, status: 'Enabled' });
  }));
  return out;
}

const q = (v) => "'" + String(v).replace(/'/g, "''") + "'";

(async () => {
  if (!PAT) { console.error('SUPABASE_PAT is required.'); process.exit(1); }
  const cats = readSeed();
  console.log('read ' + cats.length + ' categories from data.js');
  const before = await sql('select count(*)::int as n from public.product_categories');
  console.log('live table holds ' + JSON.stringify(before));
  if (DRY) { console.log('(dry run)'); return; }

  const values = cats.map(c => '(' + q(c.id) + ',' + q(JSON.stringify(c)) + '::jsonb)').join(',');
  const r = await sql('insert into public.product_categories (id, payload) values ' + values
    + ' on conflict (id) do update set payload = excluded.payload, updated_at = now()');
  if (r && r.message) { console.error('failed:', String(r.message).slice(0, 200)); process.exit(1); }

  const after = await sql("select count(*)::int as rows,"
    + " count(*) filter (where payload->>'division' = 'Joinery')::int as joinery,"
    + " count(*) filter (where payload->>'division' = 'Curtain & Blinds')::int as curtain from public.product_categories");
  console.log('now:', JSON.stringify(after));
})();
