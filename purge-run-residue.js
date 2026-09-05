/**
 * purge-run-residue.js — remove what the end-to-end run's earlier passes
 * left on the live project when their manifests were overwritten.
 *
 * Every run customer is named "RUN1 <scenario> <stamp>", so this finds those
 * customers and cascades: their enquiries, quotations, job cards, curtain
 * jobs, and every jsonb-collection row whose payload names one of those job
 * cards or quotations. Nothing else is matched.
 *
 *   SUPABASE_PAT=sbp_xxx node purge-run-residue.js [--dry-run]
 */
const https = require('https');
const PAT = process.env.SUPABASE_PAT; const DRY = process.argv.includes('--dry-run');
if (!PAT) { console.error('SUPABASE_PAT required'); process.exit(1); }
function sql(query) { return new Promise((resolve, reject) => { const body = JSON.stringify({ query }); const req = https.request({ hostname: 'api.supabase.com', path: '/v1/projects/rwbxycxrrslgxskoufxo/database/query', method: 'POST', headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const j = JSON.parse(d); if (j && j.message) return reject(new Error(j.message)); resolve(j); } catch (e) { reject(new Error(d.slice(0, 200))); } }); }); req.on('error', reject); req.write(body); req.end(); }); }
const JSONB = ['crew_sessions', 'progress_photos', 'labour_day_logs', 'uph_stage_slots', 'uph_overtime', 'fabric_holds', 'fabric_plans', 'foam_schedules', 'com_notes', 'fabric_rolls',
  'lane_slots', 'overtime_shifts', 'cutting_sheets', 'pressing_batches', 'production_input_requests', 'bom_revisions', 'store_issues', 'stock_reservations',
  'sales_credit_notes', 'sales_receipts', 'tax_invoices', 'material_requests', 'app_tasks', 'activity_log', 'curtain_purchase_inquiries', 'curtain_jobs'];
(async () => {
  const cust = await sql("select id from customers where name like 'RUN1 %'");
  const cids = cust.map(r => r.id);
  if (!cids.length) { console.log('nothing named RUN1 — clean'); return; }
  const L = a => a.map(x => "'" + x + "'").join(',');
  const jobs = (await sql('select id from job_cards where customer_id in (' + L(cids) + ')')).map(r => r.id);
  const qtns = (await sql('select id from quotations where customer_id in (' + L(cids) + ')')).map(r => r.id);
  console.log((DRY ? 'DRY RUN — ' : '') + cids.length + ' customers, ' + qtns.length + ' quotations, ' + jobs.length + ' job cards');
  const refs = jobs.concat(qtns);
  let total = 0;
  for (const t of JSONB) {
    if (!refs.length) break;
    const where = t === 'curtain_jobs' ? 'id in (' + L(jobs) + ") or payload->>'linkedJobCardId' in (" + L(jobs) + ')'
      : (t === 'sales_receipts' || t === 'sales_credit_notes') ? "payload->>'customerId' in (" + L(cids) + ')'
      : "coalesce(payload->>'jobCardId', payload->>'jobId', payload->>'quotationId', payload->>'linkedId', payload->>'recoversTarget', '') in (" + L(refs) + ')';
    const q = DRY ? 'select count(*)::int as n from ' + t + ' where ' + where : 'with d as (delete from ' + t + ' where ' + where + ' returning 1) select count(*)::int as n from d';
    const r = await sql(q); if (r[0].n) { total += r[0].n; console.log('  ' + String(r[0].n).padStart(3) + '  ' + t); }
  }
  for (const [t, ids] of [['job_cards', jobs], ['quotations', qtns], ['enquiries', null], ['customers', cids]]) {
    const where = t === 'enquiries' ? 'customer_id in (' + L(cids) + ')' : 'id in (' + L(ids) + ')';
    if (t !== 'enquiries' && !ids.length) continue;
    const q = DRY ? 'select count(*)::int as n from ' + t + ' where ' + where : 'with d as (delete from ' + t + ' where ' + where + ' returning 1) select count(*)::int as n from d';
    const r = await sql(q); total += r[0].n; console.log('  ' + String(r[0].n).padStart(3) + '  ' + t);
  }
  console.log((DRY ? 'would remove ' : 'removed ') + total + ' rows');
})().catch(e => { console.error('failed: ' + e.message); process.exit(1); });
