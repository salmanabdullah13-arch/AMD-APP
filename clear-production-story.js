/**
 * clear-production-story.js — remove exactly what seed-production-story.js made.
 *
 * Salman: "we are not using the system right now for real — before launching
 * for real we can help erase data from supabase?" Yes. This is that.
 *
 * It reads production-story-manifest.json, which the seeder writes with every
 * id it created, and deletes only those rows. Nothing is matched by name or
 * guessed at, so real work created alongside the story is never touched.
 *
 * Deletion order matters: job_cards references customers and quotations,
 * quotations references enquiries, enquiries references customers. The 19a and
 * 18a tables are id/payload jsonb with no foreign keys, so they go first.
 *
 * Needs the Supabase Management API token — it is never stored in the repo:
 *
 *   SUPABASE_PAT=sbp_xxx node clear-production-story.js
 *   SUPABASE_PAT=sbp_xxx node clear-production-story.js --dry-run
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT = 'rwbxycxrrslgxskoufxo';
const PAT = process.env.SUPABASE_PAT;
const DRY = process.argv.includes('--dry-run');

if (!PAT) {
  console.error('Set SUPABASE_PAT first:  SUPABASE_PAT=sbp_xxx node clear-production-story.js');
  process.exit(1);
}

const manifestPath = path.join(__dirname, 'production-story-manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('No production-story-manifest.json — nothing to clear.');
  process.exit(1);
}
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function sql(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com', path: '/v1/projects/' + PROJECT + '/database/query', method: 'POST',
      headers: { 'Authorization': 'Bearer ' + PAT, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { const j = JSON.parse(d); if (j && j.message) return reject(new Error(j.message)); resolve(j); }
        catch (e) { reject(new Error(d.slice(0, 200))); }
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
const lit = (arr) => (arr || []).map(x => "'" + String(x).replace(/'/g, "''") + "'").join(',');

// FK-safe: the childless jsonb tables first, then job cards, then up the chain.
const STEPS = [
  ['lane_slots', m.laneSlots],
  ['overtime_shifts', m.overtime],
  ['cutting_sheets', m.sheets],
  ['pressing_batches', m.batches],
  ['production_input_requests', m.requests],
  ['bom_revisions', m.revisions],
  ['job_cards', m.jobCards],
  ['quotations', m.quotations],
  ['enquiries', m.enquiries],
  ['customers', m.customers]
];

(async () => {
  console.log('Story seeded ' + m.createdAt + ' by ' + m.identity + '\n');

  if (DRY) {
    console.log('DRY RUN — nothing will be deleted.\n');
    for (const [table, ids] of STEPS) {
      if (!ids || !ids.length) { console.log('  ' + String(0).padStart(3) + '  ' + table); continue; }
      const r = await sql('select count(*)::int as n from ' + table + ' where id in (' + lit(ids) + ')');
      console.log('  ' + String(r[0].n).padStart(3) + '  ' + table + '   (manifest lists ' + ids.length + ')');
    }
    console.log('\nRe-run without --dry-run to delete.');
    return;
  }

  let total = 0;
  for (const [table, ids] of STEPS) {
    if (!ids || !ids.length) continue;
    const r = await sql('with d as (delete from ' + table + ' where id in (' + lit(ids) + ') returning 1) select count(*)::int as n from d');
    const n = r[0].n;
    total += n;
    console.log('  removed ' + String(n).padStart(3) + '  ' + table);
  }

  // The stock the story put away is real stock in a real bin; it is NOT
  // deleted here. Releasing the reservations is enough — the boards stay on
  // the shelf where they physically are, which is the honest outcome.
  console.log('\n  (stock lots and bins are left alone — the boards are really on the shelf)');

  console.log('\n── verifying nothing is left ────────────────────────────────');
  let leftover = 0;
  for (const [table, ids] of STEPS) {
    if (!ids || !ids.length) continue;
    const r = await sql('select count(*)::int as n from ' + table + ' where id in (' + lit(ids) + ')');
    if (r[0].n) { leftover += r[0].n; console.log('  STILL THERE: ' + r[0].n + ' in ' + table); }
  }
  console.log(leftover ? '\n  ' + leftover + ' rows could not be removed.' : '  clean — every manifest row is gone.');

  fs.renameSync(manifestPath, manifestPath.replace('.json', '.cleared-' + Date.now() + '.json'));
  console.log('\n  ' + total + ' rows removed; manifest archived.');
})().catch(e => { console.error('\nFailed: ' + e.message); process.exit(1); });
