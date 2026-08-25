/**
 * purge-test-residue.js — remove accumulated e2e fixture data from the live
 * project, once.
 *
 * Salman: "Purge the old ones for now… moving forward retain the information
 * until I purge in the future."
 *
 * THE RULE, and why it is safe: every e2e suite names its fixtures with
 * Date.now() appended ("Banking RLS Client 1785920202566", "Cloud Curtain Test
 * 1786012812478"). Real work never carries a 10-digit timestamp in the client
 * name. So the rule is exactly that — a customer whose name contains a 10+
 * digit run is a fixture — and everything hanging off it goes with it.
 *
 * When this was written that matched 318 of 325 customers. The seven it does
 * NOT match are the four from the production story and the three "DEMO —"
 * quotations seeded for the estimator walkthrough; those survive on purpose
 * and can be removed by hand if they are no longer wanted.
 *
 * NEVER TOUCHED: profiles, allowed_identities, user_types (the E2E fixture
 * ACCOUNTS — eight live suites sign in as them), item_master, suppliers,
 * employees, store bins and lots, and activity_log. Deleting an audit trail
 * is worse than leaving it noisy.
 *
 *   SUPABASE_PAT=sbp_xxx node purge-test-residue.js              # dry run
 *   SUPABASE_PAT=sbp_xxx node purge-test-residue.js --confirm    # delete
 */
const https = require('https');

const PROJECT = 'rwbxycxrrslgxskoufxo';
const PAT = process.env.SUPABASE_PAT;
const GO = process.argv.includes('--confirm');
const FIXTURE = "name ~ '[0-9]{10,}'";

if (!PAT) {
  console.error('Set SUPABASE_PAT first:  SUPABASE_PAT=sbp_xxx node purge-test-residue.js');
  process.exit(1);
}

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
        catch (e) { reject(new Error(d.slice(0, 300))); }
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

// The doomed set, derived once and reused: fixture customers, then everything
// that hangs off them.
const DOOMED = `
  doomed_cust as (select id from customers where ${FIXTURE}),
  doomed_enq  as (select id from enquiries where customer_id in (select id from doomed_cust)),
  doomed_qtn  as (select id from quotations where customer_id in (select id from doomed_cust)
                     or enquiry_id in (select id from doomed_enq)),
  doomed_job  as (select id from job_cards where customer_id in (select id from doomed_cust)
                     or quotation_id in (select id from doomed_qtn))`;

// jsonb collections that hang off a job card. Each names the payload key it
// uses — they are not consistent, which is worth knowing.
const BY_JOB = [
  ['lane_slots', 'jobCardId'],
  ['bom_revisions', 'jobCardId'],
  ['cutting_sheets', 'jobCardId'],
  ['production_input_requests', 'jobCardId'],
  ['overtime_shifts', 'recoversTarget'],
  ['labour_day_logs', 'jobId'],
  ['material_requests', 'jobId'],
  ['tax_invoices', 'jobId'],
  ['curtain_jobs', 'linkedJobCardId']
];

(async () => {
  console.log(GO ? 'PURGING — this deletes live rows.\n' : 'DRY RUN — nothing will be deleted.\n');

  const counts = await sql(`with ${DOOMED}
    select (select count(*) from doomed_cust)::int as customers,
           (select count(*) from doomed_enq)::int  as enquiries,
           (select count(*) from doomed_qtn)::int  as quotations,
           (select count(*) from doomed_job)::int  as job_cards`);
  const c = counts[0];

  console.log('  fixture rows found');
  console.log('    ' + String(c.customers).padStart(4) + '  customers');
  console.log('    ' + String(c.enquiries).padStart(4) + '  enquiries');
  console.log('    ' + String(c.quotations).padStart(4) + '  quotations');
  console.log('    ' + String(c.job_cards).padStart(4) + '  job_cards');

  console.log('\n  hanging off those job cards');
  for (const [table, key] of BY_JOB) {
    try {
      const r = await sql(`with ${DOOMED}
        select count(*)::int as n from ${table} where payload->>'${key}' in (select id from doomed_job)`);
      if (r[0].n) console.log('    ' + String(r[0].n).padStart(4) + '  ' + table + '  (payload.' + key + ')');
    } catch (e) { console.log('    ' + table + ': ' + e.message.slice(0, 70)); }
  }

  const keep = await sql(`select name from customers where not (${FIXTURE}) order by name`);
  console.log('\n  KEEPING these ' + keep.length + ' customers and everything under them:');
  keep.forEach(k => console.log('    ' + k.name));

  if (!GO) {
    console.log('\n  Re-run with --confirm to delete.');
    return;
  }

  console.log('\n── deleting ────────────────────────────────────────────────');
  let total = 0;
  // Children first — the jsonb tables have no FK, but leaving them orphaned
  // is what makes a dashboard read 82 when the truth is 4.
  for (const [table, key] of BY_JOB) {
    try {
      const r = await sql(`with ${DOOMED}, d as (
        delete from ${table} where payload->>'${key}' in (select id from doomed_job) returning 1)
        select count(*)::int as n from d`);
      if (r[0].n) { total += r[0].n; console.log('  removed ' + String(r[0].n).padStart(4) + '  ' + table); }
    } catch (e) { console.log('  skipped ' + table + ': ' + e.message.slice(0, 70)); }
  }
  // Then the commercial chain, FK-safe: job cards, quotations, enquiries,
  // customers.
  for (const [table, pred] of [
    ['job_cards', 'id in (select id from doomed_job)'],
    ['quotations', 'id in (select id from doomed_qtn)'],
    ['enquiries', 'id in (select id from doomed_enq)'],
    ['customers', 'id in (select id from doomed_cust)']
  ]) {
    const r = await sql(`with ${DOOMED}, d as (delete from ${table} where ${pred} returning 1) select count(*)::int as n from d`);
    total += r[0].n;
    console.log('  removed ' + String(r[0].n).padStart(4) + '  ' + table);
  }

  console.log('\n── what is left ────────────────────────────────────────────');
  const after = await sql(`select (select count(*) from customers)::int as customers,
    (select count(*) from enquiries)::int as enquiries,
    (select count(*) from quotations)::int as quotations,
    (select count(*) from job_cards)::int as job_cards,
    (select count(*) from lane_slots)::int as lane_slots`);
  Object.entries(after[0]).forEach(([k, v]) => console.log('  ' + String(v).padStart(4) + '  ' + k));

  const stragglers = await sql(`select count(*)::int as n from customers where ${FIXTURE}`);
  console.log('\n  ' + total + ' rows removed. Fixture customers remaining: ' + stragglers[0].n +
    (stragglers[0].n ? '  ← unexpected' : '  (clean)'));
})().catch(e => { console.error('\nFailed: ' + e.message); process.exit(1); });
