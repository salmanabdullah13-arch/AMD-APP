/**
 * clear-run-manifest.js — remove exactly what an iteration of the
 * end-to-end run created on the live project.
 *
 * The run driver writes a manifest of every id it created, per table. This
 * deletes only those rows, FK-safe (childless jsonb tables first, then job
 * cards, quotations, enquiries, customers), then verifies nothing is left.
 * Nothing is matched by name or guessed at.
 *
 *   SUPABASE_PAT=sbp_xxx node clear-run-manifest.js test-run/iter1-manifest.json [--dry-run]
 */
const fs = require('fs');
const https = require('https');
const PROJECT = 'rwbxycxrrslgxskoufxo';
const PAT = process.env.SUPABASE_PAT;
const file = process.argv.slice(2).find(a => !a.startsWith('--'));
const DRY = process.argv.includes('--dry-run');
if (!PAT || !file) { console.error('SUPABASE_PAT=sbp_xxx node clear-run-manifest.js <manifest.json> [--dry-run]'); process.exit(1); }
const m = JSON.parse(fs.readFileSync(file, 'utf8'));
function sql(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({ hostname: 'api.supabase.com', path: '/v1/projects/' + PROJECT + '/database/query', method: 'POST',
      headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const j = JSON.parse(d); if (j && j.message) return reject(new Error(j.message)); resolve(j); } catch (e) { reject(new Error(d.slice(0, 200))); } }); });
    req.on('error', reject); req.write(body); req.end();
  });
}
const lit = (arr) => (arr || []).map(x => "'" + String(x).replace(/'/g, "''") + "'").join(',');
// Deletion order: everything without a foreign key first, then the chain.
const ORDER = ['crew_sessions', 'progress_photos', 'timer_crews', 'labour_day_logs',
  'uph_stage_slots', 'uph_overtime', 'fabric_holds', 'fabric_plans', 'foam_schedules', 'com_notes', 'fabric_rolls',
  'lane_slots', 'overtime_shifts', 'cutting_sheets', 'pressing_batches', 'production_input_requests', 'bom_revisions',
  'store_issues', 'stock_reservations', 'goods_receipts', 'rfqs', 'purchase_invoices', 'purchase_orders', 'purchase_requests',
  'sales_credit_notes', 'sales_receipts', 'tax_invoices', 'material_requests', 'app_tasks', 'activity_log',
  'curtain_purchase_inquiries', 'curtain_jobs', 'job_cards', 'quotations', 'enquiries', 'customers'];
const tables = m.tables || {};
const STEPS = ORDER.filter(t => (tables[t] || []).length).map(t => [t, tables[t]]);
Object.keys(tables).forEach(t => { if (ORDER.indexOf(t) === -1 && tables[t].length) STEPS.unshift([t, tables[t]]); });
(async () => {
  console.log((m.label || 'run') + ' — created ' + m.createdAt + '\n');
  if (DRY) {
    for (const [t, ids] of STEPS) { const r = await sql('select count(*)::int as n from ' + t + ' where id in (' + lit(ids) + ')'); console.log('  ' + String(r[0].n).padStart(3) + '  ' + t + '   (manifest lists ' + ids.length + ')'); }
    console.log('\nDRY RUN — nothing deleted.'); return;
  }
  let total = 0;
  for (const [t, ids] of STEPS) {
    const r = await sql('with d as (delete from ' + t + ' where id in (' + lit(ids) + ') returning 1) select count(*)::int as n from d');
    total += r[0].n; console.log('  removed ' + String(r[0].n).padStart(3) + '  ' + t);
  }
  let left = 0;
  for (const [t, ids] of STEPS) { const r = await sql('select count(*)::int as n from ' + t + ' where id in (' + lit(ids) + ')'); if (r[0].n) { left += r[0].n; console.log('  STILL THERE: ' + r[0].n + ' in ' + t); } }
  console.log(left ? '\n  ' + left + ' rows could not be removed.' : '\n  clean — ' + total + ' rows removed.');
  fs.renameSync(file, file.replace('.json', '.cleared-' + Date.now() + '.json'));
})().catch(e => { console.error('Failed: ' + e.message); process.exit(1); });
