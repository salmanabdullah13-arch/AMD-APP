/**
 * run-iteration-3.js — the end-to-end run, iteration 3: ADVERSARIAL.
 *
 * Raw API writes with the wrong role, stale state, a pending account, a
 * double tap, a reload mid-step. Every attack expects a refusal or a single
 * record, and reads the live row back to prove nothing changed. Runs as the
 * real roles against the live project, like iterations 1 and 2.
 *
 *   SUPABASE_PAT=sbp_xxx node run-iteration-3.js [A1,A2,...]
 */
const run = require('./run-lib')({ label: 'iteration 3 (adversarial)', dir: 'iter3', report: 'iteration-3-report.md' });
const { DAYS, act, seen, record, note, setScenario, frontHalf, approveBudgets, liveRow, liveCol, livePayload, fresh, session, sql, rawPage } = run;
const ONLY = (process.argv[2] || 'A1,A2,A3,A4,A5,A6,A7,A8,A9,A10,A11,A12').split(',');
const refused = (r) => !!(r && (r.error || r.err));
const rawErr = (r) => (r && r.error) ? (r.error.message || r.error) : null;

/* A1 — Sales tampers a rate through the raw API; and tries a discount the trigger covers */
async function A1() {
  setScenario('A1 Sales tampers pricing through the raw API');
  const F = await frontHalf('A1', { division: 'Joinery', product: 'A1 console table', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 A1', stopAfter: 'estimated' });
  const before = await liveCol('quotations', F.quotation, 'items');
  const t = await act('sales', async ({ q }) => {
    const { data } = await sb.from('quotations').select('items').eq('id', q).single();
    const items = JSON.parse(JSON.stringify(data.items)); items[0].rate = 1; items[0].amount = 1; items[0].netAmount = 1.1;
    const r1 = await sb.from('quotations').update({ items }).eq('id', q);
    const items2 = JSON.parse(JSON.stringify(data.items)); items2[0].discPercent = 40; items2[0].discAmt = items2[0].amount * 0.4; items2[0].netAmount = items2[0].amount * 0.6 * 1.1;
    const r2 = await sb.from('quotations').update({ items: items2 }).eq('id', q);
    const items3 = JSON.parse(JSON.stringify(data.items)); items3.push({ lineId: 99, product: 'smuggled', qty: 1, rate: 500, amount: 500, netAmount: 550, discPercent: 0, discAmt: 0, vatPercent: 10 });
    const r3 = await sb.from('quotations').update({ items: items3 }).eq('id', q);
    const r4 = await sb.from('quotations').update({ project_name: 'RUN1 A1 renamed' }).eq('id', q);
    return { rate: r1.error && r1.error.message, disc: r2.error && r2.error.message, smuggle: r3.error && r3.error.message, rename: r4.error && r4.error.message };
  }, { q: F.quotation }, 1500);
  record('A rate change is refused by the pricing-lock trigger', 'sales', /pric|Sales|lock/i.test(t.rate || ''), t.rate);
  record('A 40% discount written into the items is refused (the discount-tier trigger fires first; the pricing lock stands behind it)', 'sales', /pric|Sales|lock|limit of/i.test(t.disc || ''), t.disc);
  record('A smuggled priced line is refused', 'sales', /pric|Sales|lock/i.test(t.smuggle || ''), t.smuggle);
  record('A non-pricing field still updates (the trigger is not blocking everything)', 'sales', !t.rename, t.rename);
  const after = await liveCol('quotations', F.quotation, 'items');
  record('The live items are byte-for-byte what they were', 'sales', JSON.stringify(before) === JSON.stringify(after), { before: (before || []).length, after: (after || []).length }, 'persistence');
}

/* A2 — Sales reads and writes what Sales must never see */
async function A2() {
  setScenario('A2 Sales reaches for supplier prices and bank details');
  const r = await act('sales', async () => {
    const bank = await sb.from('customer_banking_details').select('*').limit(5);
    const rfq = await sb.from('rfqs').select('*').limit(5);
    const gr = await sb.from('goods_receipts').select('*').limit(5);
    const ins = await sb.from('rfqs').insert({ id: 'RFQ-ATTACK-' + Date.now(), payload: { id: 'x', supplierIds: [] } });
    const im = await sb.from('item_master').update({ cost: 0.001 }).eq('id', (typeof itemMaster !== 'undefined' && itemMaster[0]) ? itemMaster[0].id : 'IT003318');
    const imSel = await sb.from('item_master').select('id').limit(1);
    return { bank: (bank.data || []).length, bankErr: bank.error && bank.error.message, rfq: (rfq.data || []).length, gr: (gr.data || []).length, ins: ins.error && ins.error.message, imRows: (im.data || []).length, imErr: im.error && im.error.message, imSel: (imSel.data || []).length };
  }, null, 500);
  record('Customer banking details: zero rows for Sales', 'sales', r.bank === 0, r);
  record('RFQs and goods receipts (supplier prices): zero rows for Sales', 'sales', r.rfq === 0 && r.gr === 0, r);
  record('Inserting an RFQ as Sales is refused', 'sales', /polic|permission|denied|violates/i.test(r.ins || ''), r.ins);
  record('Sales can read the item master (the BOM typeahead needs it) but cannot change a cost', 'sales', r.imSel === 1 && (r.imErr || r.imRows === 0), r);
}

/* A3 — a joinery login and someone else's department */
async function A3() {
  setScenario('A3 Joinery reaches across departments');
  const F = await frontHalf('A3', { division: 'Curtain & Blinds', product: 'A3 wave curtains', qty: 1, unit: 'Nos', depts: [['curt']], projectName: 'RUN1 A3' });
  await act('operations_manager', () => null, null, 2000);
  const r = await act('joinery_production_manager', async ({ job }) => {
    const sel = await sb.from('job_cards').select('id').eq('id', job);
    const upd = await sb.from('job_cards').update({ notes: 'joinery was here' }).eq('id', job).select();
    const uph = await sb.from('uph_stage_slots').insert({ id: 'US-ATTACK-' + Date.now(), payload: { id: 'x' } });
    const cust = await sb.from('customers').update({ address: 'moved' }).eq('id', getJobCard(job) ? getJobCard(job).customerId : 'C0').select();
    const qtn = await sb.from('quotations').update({ project_name: 'x' }).eq('id', 'AMD-0').select();
    return { sel: (sel.data || []).length, selErr: sel.error && sel.error.message, upd: (upd.data || []).length, updErr: upd.error && upd.error.message, uph: uph.error && uph.error.message, cust: (cust.data || []).length, custErr: cust.error && cust.error.message, qtnErr: qtn.error && qtn.error.message, qtn: (qtn.data || []).length };
  }, { job: F.job }, 500);
  record('A pure-curtain job card is invisible to a joinery login (zero rows, not an error)', 'joinery_production_manager', r.sel === 0 && !r.selErr, r);
  record('… and cannot be written (zero rows affected)', 'joinery_production_manager', r.upd === 0, r);
  record("Writing to upholstery's stage slots is refused", 'joinery_production_manager', /polic|permission|denied|violates/i.test(r.uph || ''), r.uph);
  record('Customers and quotations are read-only for a production role', 'joinery_production_manager', r.cust === 0 && r.qtn === 0, r);
  const notes = await liveCol('job_cards', F.job, 'notes');
  record('The live job card carries no trace of the attempt', 'joinery_production_manager', !notes, notes, 'persistence');
}

/* A4 — a pending account reads nothing */
async function A4() {
  setScenario('A4 A pending account signs in through the API');
  const who = 'E2E Delivery Account';
  await sql("update profiles set approval_status = 'pending' where display_name = '" + who + "'");
  try {
    const page = await rawPage();
    const r = await page.evaluate(async ({ who, pw }) => {
      const { error } = await sb.auth.signInWithPassword({ email: identityToInternalEmail(who), password: pw });
      if (error) return { signIn: error.message };
      const out = {};
      for (const t of ['customers', 'job_cards', 'quotations', 'messages', 'item_master', 'lane_slots']) { const q = await sb.from(t).select('id').limit(3); out[t] = (q.data || []).length + (q.error ? ' err:' + q.error.message : ''); }
      const ins = await sb.from('customers').insert({ id: 'C-ATTACK', name: 'attack', status: 'approved' });
      out.insert = ins.error ? ins.error.message : 'ACCEPTED';
      await sb.auth.signOut();
      return out;
    }, { who, pw: 'E2eFixedTestPassword1234!' });
    record('The account signs in (authentication is not the gate — approval is)', 'pending', !r.signIn, r);
    record('Every business table returns zero rows to a pending account', 'pending', ['customers', 'job_cards', 'quotations', 'messages', 'item_master', 'lane_slots'].every(t => String(r[t]).startsWith('0')), r);
    record('A pending account cannot insert a customer', 'pending', /polic|permission|denied|violates/i.test(r.insert || ''), r.insert);
    await page.context().close();
  } finally {
    await sql("update profiles set approval_status = 'approved' where display_name = '" + who + "'");
  }
  const restored = await sql("select approval_status from profiles where display_name = '" + who + "'");
  record('The fixture is restored to approved afterwards', 'driver', restored[0] && restored[0].approval_status === 'approved', restored);
}

/* A5 — a second Job Card from a confirmed quotation */
async function A5() {
  setScenario('A5 A second Job Card from the same quotation');
  const F = await frontHalf('A5', { division: 'Joinery', product: 'A5 shoe cabinet', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 A5' });
  const r = await act('sales', ({ q }) => { const a = confirmQuotationToJobCard(q, 'E2E Test Account'); const b = approveQuotation(q, 'E2E Test Account', 'owner'); const c = confirmQuotationToJobCard(q, 'E2E Test Account'); return { again: a && a.error, reapprove: b && b.error, afterReapprove: c && c.error, jobs: jobCards.filter(j => j.quotationId === q && j.status !== 'cancelled').length }; }, { q: F.quotation }, 1500);
  record('Confirming again is refused', 'sales', /already|live|confirmed/i.test(r.again || ''), r.again);
  record('Re-approving a confirmed quotation is refused (the stage gate fires first — it sits at Sales, confirmed)', 'sales', /confirmed|already|must be with the Approver/i.test(r.reapprove || ''), r.reapprove);
  record('Exactly one live Job Card exists for it', 'sales', r.jobs === 1, r.jobs);
  const live = await sql("select count(*)::int as n from job_cards where quotation_id = '" + F.quotation + "' and status <> 'cancelled'");
  record('… on the live table too', 'sales', live[0] && live[0].n === 1, live, 'persistence');
}

/* A6 — approve a draft directly */
async function A6() {
  setScenario('A6 Approve a draft that never went through estimation');
  const F = await frontHalf('A6', { division: 'Joinery', product: 'A6 desk', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 A6', stopAfter: 'estimated' });
  const r = await act('approver', ({ q }) => { const a = approveQuotation(q, 'E2E Approver Role Account', 'approver'); const qq = quotations.find(x => x.id === q); return { err: a && a.error, stage: qq && qq.stage, lc: qq && qq.lifecycleStatus }; }, { q: F.quotation }, 1500);
  record('Approval at the Estimator stage is refused', 'approver', refused(r) && r.lc === 'draft', r);
  const s = await act('sales', ({ c }) => {
    const e = createEnquiry({ division: 'Joinery', customerId: c, contactPerson: 'A', tel: '1', source: 'walk inn', salesPerson: 'E2E Test Account' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'RUN1 A6 draft', taxPercent: 10, contactPerson: 'A' });
    addQuotationItem(q.id, { product: 'A6 stool', qty: 1, unit: 'Nos' });
    const a = approveQuotation(q.id, 'E2E Test Account', 'owner'); const qq = quotations.find(x => x.id === q.id);
    const cj = confirmQuotationToJobCard(q.id, 'E2E Test Account');
    return { err: a && a.error, lc: qq.lifecycleStatus, confirm: cj && cj.error };
  }, { c: F.customer }, 1500);
  record('Approval of a Sales-stage draft is refused even by an Owner-typed call', 'sales', refused(s) && s.lc === 'draft', s);
  record('… and it cannot be confirmed to a Job Card', 'sales', /open|approv/i.test(s.confirm || ''), s.confirm);
}

/* A7 — reload mid-step: the landing screen before the caches hydrate */
async function A7() {
  setScenario('A7 Reload on every role — the landing screen before hydration');
  const F = await frontHalf('A7', { division: 'Joinery', product: 'A7 wardrobe', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 A7' });
  const G = await frontHalf('A7b', { division: 'Joinery', product: 'A7b bookcase', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 A7b' });
  // An UNROUTED job for the Operations landing screen — its routing queue is what that screen shows.
  const H = await frontHalf('A7c', { division: 'Joinery', product: 'A7c hall bench', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 A7c', stopAfter: 'confirmed' });
  // What each landing screen genuinely prints once the data is in: Sales and Owner name the project; Operations lists the job awaiting routing once that step is
  // selected; Production's strip shows the first three waiting jobs, so it is asked whether the job is in its waiting data AND the strip is not the empty state.
  const probes = {
    sales: { needles: ['RUN1 A7'], prep: null },
    operations_manager: { needles: ['New jobs'], prep: () => { if (window.OpsUI && OpsUI.setStep) OpsUI.setStep('route'); }, extra: (j) => { const p = getJobsPendingRouting(); return p.some(x => x.id === j) && p.length > 0 && document.body.innerText.includes(p[0].id); }, arg: H.job },
    joinery_production_manager: { needles: ['Waiting for a lane'], prep: null, extra: (j) => getWaitingForLane().some(w => w.job.id === j) && !document.body.innerText.includes('Every routed job has a lane'), arg: G.job },
    owner: { needles: ['RUN1 A7'], prep: null }
  };
  for (const role of Object.keys(probes)) {
    const { needles, prep, extra, arg } = probes[role];
    const page = await session(role);
    await page.reload();
    const signedIn = await page.waitForFunction(() => window.__realCloudSession === true, { timeout: 25000 }).then(() => true).catch(() => false);
    await page.evaluate(() => { if (typeof execAutoAlerted !== 'undefined') execAutoAlerted = true; });
    const t0 = Date.now(); let found = false;
    while (Date.now() - t0 < 15000) {
      found = await page.evaluate(({ ns, prepSrc, extraSrc, arg }) => { if (prepSrc) { try { (new Function('return (' + prepSrc + ')')())(); } catch (e) {} } const ok = ns.some(n => document.body.innerText.includes(n)); return ok && (!extraSrc || (new Function('return (' + extraSrc + ')')())(arg)); }, { ns: needles, prepSrc: prep ? prep.toString() : null, extraSrc: extra ? extra.toString() : null, arg: arg || null });
      if (found) break; await page.waitForTimeout(250);
    }
    const state = await page.evaluate(() => ({ session: window.__realCloudSession, jobs: typeof jobCards !== 'undefined' ? jobCards.length : -1, wraps: [...document.querySelectorAll('[id$="-module-wrap"]')].filter(w => getComputedStyle(w).display !== 'none').map(w => w.id), text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160) }));
    record('After a reload, ' + role + "'s landing screen redraws with " + needles[0] + ' once the caches land (' + (found ? Date.now() - t0 : '>15000') + ' ms)', role, found, { signedIn, ...state });
  }
}

/* A8 — two devices */
async function A8() {
  setScenario('A8 Two devices: confirm on one, watch the other');
  const F = await frontHalf('A8', { division: 'Joinery', product: 'A8 vanity', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 A8', stopAfter: 'approver' });
  await act('approver', ({ q }) => approveQuotation(q, 'E2E Approver Role Account', 'approver'), { q: F.quotation }, 1500);
  const owner = await session('owner');
  const watch = owner.evaluate(async (q) => { const t0 = Date.now(); while (Date.now() - t0 < 20000) { const j = jobCards.find(x => x.quotationId === q); if (j) return { ms: Date.now() - t0, job: j.id }; await new Promise(r => setTimeout(r, 50)); } return { ms: -1 }; }, F.quotation);
  const c = await act('sales', ({ q }) => { const j = confirmQuotationToJobCard(q, 'E2E Test Account'); return { job: j && j.id, err: j && j.error }; }, { q: F.quotation }, 0);
  const w = await watch;
  record('The Owner\'s device sees the new Job Card through realtime (' + w.ms + ' ms)', 'owner', w.ms >= 0 && w.ms < 10000 && w.job === c.job, { c, w }, 'realtime');
  const p = await act('owner', ({ job }) => { const pr = projects.find(x => x.id === job); return { bridged: !!pr, val: pr && pr.val }; }, { job: c.job }, 0);
  record("… and the Operations rollup on that device is bridged, reading the job's value live", 'owner', p.bridged && p.val > 0, p);
}

/* A9 — a money-shaped answer to a pricing request */
async function A9() {
  setScenario('A9 A pricing answer carrying money');
  const F = await frontHalf('A9', { division: 'Joinery', product: 'A9 reception counter', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 A9' });
  await act('operations_manager', ({ job }) => confirmJobRouting(job, {}, 'E2E Operations Account'), { job: F.job }, 1500);
  const req = await act('estimator', ({ job }) => { const r = raiseInputRequest({ type: 'pricing_input', raisedBy: 'E2E Estimator Account', raiserRole: 'estimator', jobCardId: job, question: 'Hours for the counter?', dept: 'carp' }); return { id: r && r.id, err: r && r.error }; }, { job: F.job }, 2000);
  record('The Estimator raises a pricing request', 'estimator', !!req.id, req);
  const seenReq = await seen('joinery_production_manager', (id) => inputRequests.some(r => r.id === id), req.id);
  record("Production's session sees it", 'joinery_production_manager', seenReq, req.id, 'realtime');
  const r = await act('joinery_production_manager', async ({ id }) => {
    const client = answerInputRequest(id, { manHours: 12, rate: 4.5 }, 'E2E Joinery Account');
    const row = await sb.from('production_input_requests').select('payload').eq('id', id).single();
    const payload = JSON.parse(JSON.stringify(row.data.payload)); payload.answer = { manHours: 12, rate: 4.5 }; payload.status = 'answered';
    const raw = await sb.from('production_input_requests').update({ payload }).eq('id', id);
    const clean = answerInputRequest(id, { manHours: 12, men: 2 }, 'E2E Joinery Account');
    return { client: client && client.error, raw: raw.error && raw.error.message, clean: clean && clean.error, status: inputRequests.find(x => x.id === id).status };
  }, { id: req.id }, 1500);
  record('The client refuses a money-shaped key', 'joinery_production_manager', /price|money|rate/i.test(r.client || ''), r.client);
  record('The database trigger refuses the same payload written raw', 'joinery_production_manager', /price|money|rate|amount/i.test(r.raw || ''), r.raw);
  record('An answer in hours and men is accepted', 'joinery_production_manager', !r.clean && r.status === 'answered', r);
  const live = await livePayload('production_input_requests', req.id);
  record('The live answer carries hours and men, and no rate', 'joinery_production_manager', live && live.answer && live.answer.manHours === 12 && !('rate' in live.answer), live && live.answer, 'persistence');
}

/* A10 — the same action twice */
async function A10() {
  setScenario('A10 Double tap: Start, Submit, Confirm, Allot, Invoice');
  const F = await frontHalf('A10', { division: 'Joinery', product: 'A10 media unit', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 A10' });
  const route = await act('operations_manager', ({ job }) => { const j = getJobCard(job); const before = j.routingConfirmedDate; const b = confirmJobRouting(job, {}, 'E2E Operations Account'); return { b: b && b.error, same: j.routingConfirmedDate === before, routed: j.routingConfirmed }; }, { job: F.job }, 1500);
  record('Routing an already-routed job again is refused and changes nothing', 'operations_manager', /already/i.test(route.b || '') && route.same && route.routed, route);
  const sub = await act('joinery_production_manager', ({ job }) => { const a = submitDepartmentBudget(job, 'carp', { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'E2E Joinery Account'); const b = submitDepartmentBudget(job, 'carp', { materials: 100, labour: 50, subcontract: 0, hiring: 0, others: 0 }, 'E2E Joinery Account'); const j = getJobCard(job); return { a: a && a.error, b: b && b.error, slots: Object.keys(j.departmentBudgets).length, status: j.departmentBudgets.carp.approvalStatus }; }, { job: F.job }, 1500);
  record('Submitting a budget twice leaves ONE slot awaiting approval (a resubmission replaces, never duplicates)', 'joinery_production_manager', sub.slots === 1 && /pending|submitted/.test(sub.status || ''), sub);
  const a = await approveBudgets(F.job, ['carp']);
  const st = await act('joinery_production_manager', ({ job, line }) => { const a = startLineProduction(job, line, 'carp'); const b = startLineProduction(job, line, 'carp'); return { a: a && a.error, b: b && b.error, status: getJobCard(job).items[0].departmentStatuses[0].status }; }, { job: F.job, line: F.lines[0] }, 1500);
  record('Starting production twice: the second is refused, the line is in production once', 'joinery_production_manager', !st.a && refused(st) === false && /Queued/i.test(st.b || '') && st.status === 'in-production', st);
  const inv = await act('accounts', ({ job }) => { const a = generateInvoiceFromJob(job, { invoicedPercent: 100 }); const b = generateInvoiceFromJob(job, { invoicedPercent: 100 }); return { a: a && a.error, b: b && b.error, n: taxInvoices.filter(i => i.jobCardId === job || i.jobId === job).length }; }, { job: F.job }, 1500);
  record('Invoicing 100% twice: the second is refused, one invoice exists', 'accounts', !inv.a && /100|already|exceed/i.test(inv.b || '') && inv.n === 1, inv);
  const live = await sql("select count(*)::int as n from tax_invoices where coalesce(payload->>'jobCardId', payload->>'jobId') = '" + F.job + "'");
  record('… one invoice on the live table', 'accounts', live[0] && live[0].n === 1, live, 'persistence');
}

/* A11 — a routing ping must reach the real joinery manager (F17) */
async function A11() {
  setScenario('A11 A hand-off notification reaches the person holding the role');
  const F = await frontHalf('A11', { division: 'Joinery', product: 'A11 pantry', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 A11' });
  await act('operations_manager', ({ job }) => confirmJobRouting(job, {}, 'E2E Operations Account'), { job: F.job }, 1000);
  const got = await seen('joinery_production_manager', (job) => getInboxFor('E2E Joinery Account').some(m => (m.body || '').includes(job)), F.job, 12000);
  record("The joinery manager's OWN inbox receives the routing ping (not a role-name inbox nobody reads)", 'joinery_production_manager', got, F.job, 'realtime');
  if (!got) note('Routing pinged "Joinery Production Manager" — a roster pseudo-identity; the signed-in manager never sees it (F17)', 'joinery_production_manager', 'Decision taken 5 Sep: resolve recipients by role to the people holding it. Built in the fix phase of this iteration.', 'finding');
}

/* A12 — discounts above the role's tier (F9) */
async function A12() {
  setScenario('A12 Discounts above the role tier: Sales 10%, Estimator 20%, Owner 30%');
  const F = await frontHalf('A12', { division: 'Joinery', product: 'A12 dresser', qty: 2, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 A12', stopAfter: 'estimated' });
  const tryDisc = (role, pct, by) => act(role, ({ q, pct, by }) => { const qq = quotations.find(x => x.id === q); const base = qq.items.reduce((s, it) => s + it.amount, 0); const r = setQuoteDiscount(q, Math.round(base * pct / 100 * 1000) / 1000, by); return { err: r && r.error, applied: Math.round(qq.items[0].discPercent) }; }, { q: F.quotation, pct, by }, 1200);
  const s15 = await tryDisc('sales', 15, { userType: 'sales', identity: 'E2E Test Account' });
  record('Sales at 15% is refused (tier 10%)', 'sales', refused(s15) && s15.applied < 15, s15, 'design');
  const s10 = await tryDisc('sales', 10, { userType: 'sales', identity: 'E2E Test Account' });
  record('Sales at 10% is accepted', 'sales', !refused(s10) && s10.applied === 10, s10, 'design');
  const e25 = await tryDisc('estimator', 25, { userType: 'estimator', identity: 'E2E Estimator Account' });
  record('Estimator at 25% is refused (tier 20%)', 'estimator', refused(e25) && e25.applied < 25, e25, 'design');
  const e20 = await tryDisc('estimator', 20, { userType: 'estimator', identity: 'E2E Estimator Account' });
  record('Estimator at 20% is accepted', 'estimator', !refused(e20) && e20.applied === 20, e20, 'design');
  // The raw attack goes BEFORE the Owner's 30% — the trigger judges a RISE past the caller's tier, so once 30% is legitimately on the row a 30% write is not a rise.
  const est = await act('estimator', async ({ q }) => { const { data } = await sb.from('quotations').select('items').eq('id', q).single(); const items = JSON.parse(JSON.stringify(data.items)); items.forEach(it => { it.discPercent = 30; it.discAmt = it.amount * 0.3; it.netAmount = it.amount * 0.7 * 1.1; }); const r = await sb.from('quotations').update({ items }).eq('id', q); return { err: r.error && r.error.message }; }, { q: F.quotation }, 500);
  record('An Estimator session writing 30% straight to the row is refused by the database (tier 20%)', 'estimator', /limit of 20/.test(est.err || ''), est.err, 'design');
  const o35 = await tryDisc('owner', 35, { userType: 'owner', identity: 'E2E Approver Account' });
  record('Owner at 35% is refused (tier 30%)', 'owner', refused(o35) && o35.applied < 35, o35, 'design');
  const o30 = await tryDisc('owner', 30, { userType: 'owner', identity: 'E2E Approver Account' });
  record('Owner at 30% is accepted', 'owner', !refused(o30) && o30.applied === 30, o30, 'design');
  const raw = await act('sales', async ({ q }) => { const { data } = await sb.from('quotations').select('items').eq('id', q).single(); const items = JSON.parse(JSON.stringify(data.items)); items.forEach(it => { it.discPercent = 30; it.discAmt = it.amount * 0.3; it.netAmount = it.amount * 0.7 * 1.1; }); const r = await sb.from('quotations').update({ items }).eq('id', q); return { err: r.error && r.error.message }; }, { q: F.quotation }, 500);
  record('A Sales session writing 30% straight to the row is refused by the database (the pricing lock covers Sales; a rise past 30% would also trip the tier)', 'sales', !!raw.err, raw.err);
  const lv = await liveCol('quotations', F.quotation, 'items');
  record('The live discount stands at the last ACCEPTED tier, 30% by the Owner', 'owner', Array.isArray(lv) && Math.round(lv[0].discPercent) === 30, lv && lv[0] && lv[0].discPercent, 'persistence');
}

(async () => {
  const t0 = Date.now();
  const before = await run.snapshotIds();
  const all = { A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12 };
  for (const k of ONLY) { if (!all[k]) continue; console.log('\n═══ ' + k); try { await all[k](); } catch (e) { record('Scenario crashed: ' + String(e.message).slice(0, 140), 'driver', false, String(e.stack || e).slice(0, 400)); } }
  await run.finish(t0, before);
  process.exit(0);
})();
