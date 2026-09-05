/**
 * run-iteration-2.js — the end-to-end run, iteration 2: the exception
 * branches (docs/test-run/scenarios.md, X1–X15), each as the real role,
 * against the live project.
 *
 *   SUPABASE_PAT=sbp_xxx node run-iteration-2.js [X1,X4]
 */
const run = require('./run-lib')({ label: 'iteration 2 (exception branches)', dir: 'iter2', report: 'iteration-2-report.md' });
const { DAYS, act, seen, record, note, setScenario, frontHalf, approveBudgets, liveCol, livePayload, liveRow, fresh } = run;
const ONLY = (process.argv[2] || 'X1,X2,X3,X4,X5,X6,X7,X8,X9,X10,X11,X12,X13,X14,X15').split(',');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// A routed joinery job with its budget approved and one line in production —
// the state most branches fork from.
async function joineryInProduction(tag, extra) {
  const F = await frontHalf(tag, Object.assign({ division: 'Joinery', product: tag + ' wardrobe', qty: 2, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 ' + tag }, extra || {}));
  // Production submits the budget first — a budget nobody submitted cannot be approved (the maker-checker's own rule).
  const sub = await act('joinery_production_manager', ({ job }) => { const r = submitDepartmentBudget(job, 'carp', { materials: 200, labour: 120, subcontract: 0, hiring: 0, others: 0 }, 'E2E Joinery Account'); return { err: r && r.error }; }, { job: F.job }, 1500);
  record('Production submits the joinery budget', 'joinery_production_manager', !sub.err, sub);
  const a = await approveBudgets(F.job, ['carp']);
  record('Operations approves the joinery budget', 'operations_manager', a.every(x => /ok$/.test(x)), a);
  const st = await act('joinery_production_manager', ({ job, line }) => { const r = startLineProduction(job, line, 'carp'); return { err: r && r.error, status: getJobCard(job).items[0].departmentStatuses[0].status }; }, { job: F.job, line: F.lines[0] });
  record('Production starts the line', 'joinery_production_manager', st.status === 'in-production', st);
  return F;
}
async function finishJoineryLine(job, line) {
  return act('joinery_production_manager', ({ job, line }) => {
    ['cutting', 'veneer-pressing', 'assembly'].forEach(s => advanceJoinerySubStage(job, line, s));
    const a = submitLineForQC(job, line, 'carp'); const b = recordLineQCResult(job, line, 'carp', true, 'Joinery Production Manager'); const c = handOffLine(job, line, 'carp', 'E2E Joinery Account');
    return { a: a && a.error, b: b && b.error, c: c && c.error, done: getJobCard(job).items.find(i => i.lineId === line).departmentStatuses[0].status };
  }, { job, line }, 1500);
}

/* X1 — the Approver sends it back for re-costing */
async function X1() {
  setScenario('X1 Sent back for re-costing');
  const F = await frontHalf('X1', { division: 'Joinery', product: 'X1 bookcase', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 X1', stopAfter: 'approver' });
  const back = await act('approver', ({ q }) => { const r = transferQuotationStage(q, 'estimator', 'E2E Approver Role Account'); const qq = quotations.find(x => x.id === q); return { err: r && r.error, stage: qq.stage, audit: (qq.auditLog || []).slice(-1)[0] }; }, { q: F.quotation }, 1500);
  record('The Approver sends the quote back to the Estimator, with an audit entry', 'approver', back.stage === 'estimator' && !back.err && back.audit, back);
  const est = await seen('estimator', (id) => quotations.some(q => q.id === id && q.stage === 'estimator'), F.quotation);
  record('It lands back in the Estimator\'s queue', 'estimator', est, F.quotation, 'realtime');
  const again = await act('estimator', ({ q, line }) => { const m = addBOMMaterial(q, line, { name: itemMaster[1].name, qty: 1, rate: 5, unit: itemMaster[1].unit }); const s = submitItemBOM(q, line, 'E2E Estimator Account'); const t = transferQuotationStage(q, 'approver', 'E2E Estimator Account'); return { m: m && m.error, s: s && s.error, t: t && t.error, stage: quotations.find(x => x.id === q).stage }; }, { q: F.quotation, line: F.lines[0] }, 1500);
  record('The Estimator re-costs and transfers again', 'estimator', again.stage === 'approver' && !again.t, again);
  const app = await act('approver', ({ q }) => { const r = approveQuotation(q, 'E2E Approver Role Account', 'approver'); return { err: r && r.error, lc: quotations.find(x => x.id === q).lifecycleStatus }; }, { q: F.quotation }, 1500);
  record('… and this time it is approved', 'approver', app.lc === 'open', app);
}

/* X2 — over BD 8,000: Operations recommends, the Owner counter-signs */
async function X2() {
  setScenario('X2 Over BD 8,000');
  const F = await frontHalf('X2', { division: 'Joinery', product: 'X2 full-height wardrobe wall', qty: 10, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 X2', matRate: 300, matQty: 6, stopAfter: 'approver' });
  record('The quote is worth more than BD 8,000', 'estimator', F.total > 8000, F.total);
  const ops = await act('operations_manager', ({ q }) => { const r = approveQuotation(q, 'E2E Operations Account', 'operations_manager'); const qq = quotations.find(x => x.id === q); return { err: r && r.error, lc: qq.lifecycleStatus, owner: qq.ownerReviewStatus, by: qq.recommendedBy }; }, { q: F.quotation }, 2000);
  record('Operations can only RECOMMEND — the quote waits for the Owner', 'operations_manager', ops.owner === 'pending-owner-review' && ops.lc !== 'open' && ops.by === 'E2E Operations Account', ops);
  const live = await liveCol('quotations', F.quotation, 'owner_review_status');
  record('… and the recommendation survives in the live row', 'operations_manager', live === 'pending-owner-review', live, 'persistence');
  const noJob = await act('sales', ({ q }) => confirmQuotationToJobCard(q, 'E2E Test Account').error, { q: F.quotation });
  record('Sales cannot confirm a Job Card before the Owner signs', 'sales', /Open/.test(noJob || ''), noJob);
  const ownerSees = await seen('owner', (id) => getQuotesAwaitingOwnerReview().some(q => q.id === id), F.quotation);
  record('The Owner\'s session sees it in Sign-offs', 'owner', ownerSees, F.quotation, 'realtime');
  const signed = await act('owner', ({ q }) => { const r = approveQuotationOwnerReview(q, 'E2E Approver Account', 'owner'); const qq = quotations.find(x => x.id === q); return { err: r && r.error, lc: qq.lifecycleStatus, owner: qq.ownerReviewStatus }; }, { q: F.quotation }, 2000);
  record('The Owner counter-signs — lifecycle open', 'owner', signed.lc === 'open' && !signed.err, signed);
  const job = await act('sales', ({ q }) => { const j = confirmQuotationToJobCard(q, 'E2E Test Account'); return j && j.id; }, { q: F.quotation }, 1500);
  record('… and Sales can now confirm it', 'sales', !!job, job);
}

/* X3 — discount over 30% */
async function X3() {
  setScenario('X3 Discount over 30%');
  const F = await frontHalf('X3', { division: 'Joinery', product: 'X3 sideboard', qty: 2, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 X3', stopAfter: 'estimated' });
  const disc = await act('estimator', ({ q }) => {
    const qq = quotations.find(x => x.id === q); const base = qq.items.reduce((s, it) => s + it.amount, 0);
    const r = setQuoteDiscount(q, Math.round(base * 0.4 * 1000) / 1000);
    return { err: r && r.error, pct: Math.round(qq.items[0].discPercent), base };
  }, { q: F.quotation }, 1500);
  record('A 40% discount is refused, or routed to the Approver, at the DATA layer', 'estimator', !!disc.err || disc.pct < 31, disc, 'design');
  if (!disc.err && disc.pct >= 31) note('The 30% discount ceiling lives only in the Estimator screen; setQuoteDiscount() applied 40% without a gate', 'estimator', 'The 6a package routes a discount over 30% to the Approver. The data layer has no such rule, so the raw API, the Excel round-trip and any future screen can apply any discount. Server-side the pricing-lock trigger covers Sales only.', 'finding');
}

/* X4 — a variation order after confirmation */
async function X4() {
  setScenario('X4 Variation order');
  const F = await joineryInProduction('X4');
  const frozen = await act('sales', ({ q }) => { const a = addQuotationItem(q, { product: 'Sneaked line', qty: 1, unit: 'Nos' }); const t = transferQuotationStage(q, 'estimator', 'E2E Test Account'); return { add: a && a.error, transfer: t && t.error }; }, { q: F.quotation });
  record('The confirmed quotation is frozen — no new line, no stage move', 'sales', /frozen|confirmed/i.test(frozen.add || '') && /frozen|confirmed/i.test(frozen.transfer || ''), frozen);
  const v = await act('sales', ({ job }) => { const vq = createVariationForJob(job, { notes: 'client added a bench seat' }); if (!vq || vq.error) return { err: vq && vq.error }; addQuotationItem(vq.id, { product: 'Upholstered bench seat', qty: 1, unit: 'Nos' }); return { vq: vq.id, parent: vq.parentJobId, rev: vq.rev, line: quotations.find(x => x.id === vq.id).items[0].lineId }; }, { job: F.job }, 2000);
  record('Sales raises a variation on the live job', 'sales', v.vq && v.parent === F.job, v);
  const est = await act('estimator', ({ vq, line }) => {
    const ok = seenQ => seenQ;
    const q = quotations.find(x => x.id === vq); if (!q) return { err: 'variation not in the estimator session' };
    addBOMMaterial(vq, line, { name: itemMaster[0].name, qty: 3, rate: 40, unit: itemMaster[0].unit });
    addBOMLabour(vq, line, { department: 'uph', description: 'Upholster', noOfPpl: 1, qty: 2, rate: 3, calcMode: 'days' });
    submitItemBOM(vq, line, 'E2E Estimator Account'); setItemDepartmentSequence(vq, line, ['uph']);
    const t = transferQuotationStage(vq, 'approver', 'E2E Estimator Account'); return { t: t && t.error };
  }, { vq: v.vq, line: v.line }, 1500);
  record('The variation goes through the Estimator like any quotation', 'estimator', !est.err && !est.t, est);
  const app = await act('approver', ({ vq }) => { const r = approveQuotation(vq, 'E2E Approver Role Account', 'approver'); return { err: r && r.error }; }, { vq: v.vq }, 1500);
  record('… and the Approver', 'approver', !app.err, app);
  const salesSees = await seen('sales', (vq) => quotations.some(q => q.id === vq && q.lifecycleStatus === 'open'), v.vq);
  record('Sales sees the variation approved', 'sales', salesSees, v.vq, 'realtime');
  if (!salesSees) { const w = await run.quotationWrites(v.vq); const srv = await liveRow('quotations', v.vq); note('Variation approval did not land — writes by session: ' + JSON.stringify(w) + ' · live row: ' + JSON.stringify(srv && { stage: srv.stage, lc: srv.lifecycle_status, updated: srv.updated_at }), 'driver', 'probe', 'probe'); }
  const merged = await act('sales', ({ vq, job }) => {
    const before = getJobCard(job).items.length; const r = confirmVariationToJobCard(vq, 'E2E Test Account'); const j = getJobCard(job);
    return { err: r && r.error, items: j.items.length, before, jobs: jobCards.filter(x => x.quotationId === vq).length, uphBudget: !!(j.departmentBudgets && j.departmentBudgets.uph), tagged: j.items.some(i => i.variationId === vq) };
  }, { vq: v.vq, job: F.job }, 2000);
  record('Confirming merges onto the SAME job — one more line, tagged with the variation, no second job card', 'sales', merged.items === merged.before + 1 && merged.jobs === 0 && merged.tagged, merged);
  record('The new department gets a budget slot (Fix Plan Phase 1)', 'sales', merged.uphBudget, merged);
  const live = await liveCol('job_cards', F.job, 'items');
  record('… and the live job card carries the merged line', 'sales', Array.isArray(live) && live.length === merged.items, Array.isArray(live) ? live.length : live, 'persistence');
}

/* X5 — a BOM revision mid-cut */
async function X5() {
  setScenario('X5 BOM revision mid-cut');
  const F = await joineryInProduction('X5');
  const sheet = await act('joinery_production_manager', ({ job }) => {
    const s = createCuttingSheet({ jobCardId: job, saw: 'saw 1', lines: [{ part: 'Side panel', material: 'MDF 18mm', qty: 4, length: 1800, width: 580, press: false }], byWhom: 'E2E Joinery Account' });
    if (!s || s.error) return { err: s && s.error };
    markSheetOnSaw(s.id, 'saw 1');
    return { sheet: s.id, status: cuttingSheets.find(x => x.id === s.id).status };
  }, { job: F.job }, 1500);
  record('A cutting list is released and on saw 1', 'joinery_production_manager', sheet.sheet && sheet.status === 'on-saw', sheet);
  const rev = await act('joinery_production_manager', ({ job, sheet }) => {
    const a = startBOMRevision(job, 'E2E Joinery Account', 'Carcass depth 600 → 550');
    const b = issueBOMRevision(job, 'E2E Joinery Account');
    const s = cuttingSheets.find(x => x.id === sheet);
    const block = jobLaneBlockReason(job);
    return { a: a && a.error, b: b && b.error, dead: s.status, killedBy: s.killedByRevision, block };
  }, { job: F.job, sheet: sheet.sheet }, 1500);
  record('Issuing the revision kills the sheet on the saw, and the lane refuses the job', 'joinery_production_manager', rev.dead === 'dead' && !!rev.killedBy && /dead|sheet|saw/i.test(rev.block || ''), rev);
  const off = await act('joinery_production_manager', ({ job, sheet }) => { const r = confirmSheetOffSaw(sheet, 'E2E Joinery Account'); return { err: r && r.error, block: jobLaneBlockReason(job) }; }, { job: F.job, sheet: sheet.sheet }, 1500);
  record('Confirming the sheet off the saw clears the gate — not the revision', 'joinery_production_manager', !off.err && !/dead|sheet|saw/i.test(off.block || ''), off);
  const live = await livePayload('cutting_sheets', sheet.sheet);
  record('… and the dead sheet\'s state is in the live table', 'joinery_production_manager', live && live.status === 'dead' && live.confirmedOffSaw, live && live.status, 'persistence');
}

// A material the store has NEVER held — chosen at run time, because a
// previous pass's put-away is real stock that survives a name-based purge.
async function neverStockedIndex() {
  return act('storekeeper', () => {
    const lots = typeof stockLots !== 'undefined' ? stockLots : [];
    for (let i = 100; i < itemMaster.length; i++) { const m = itemMaster[i]; if (m && m.cost && !lots.some(l => l.itemId === m.id && l.onHand > 0)) return i; }
    return -1;
  }, null, 0);
}

/* X6 — material short at lane allotment */
async function X6() {
  setScenario('X6 Material short at the lane');
  const mi = await neverStockedIndex();
  const F = await joineryInProduction('X6', { matIndex: mi });   // a material the store does not hold
  const short = await act('joinery_production_manager', ({ job, line, day }) => {
    const r = allotLaneSlot({ crewId: 'CREW-B', jobCardId: job, date: day, lineIds: [line], byWhom: 'E2E Joinery Account' });
    const w = getWaitingForLane().find(x => x.job.id === job);
    return { err: r.error, waiting: w && w.reason };
  }, { job: F.job, line: F.lines[0], day: DAYS[3] });
  record('The lane refuses the job for short material, and the waiting strip carries the reason', 'joinery_production_manager', /short/i.test(short.err || '') && /short/i.test(short.waiting || ''), short);
  const stock = await act('storekeeper', ({ job, mi }) => {
    const mat = itemMaster[mi];
    let loc = storeLocations[0] || createStoreLocation({ name: 'Riffa store' }); let bin = storeBins.find(b => b.storeId === loc.id) || createStoreBin({ storeId: loc.id, code: 'A1' });
    putAwayStock({ itemId: mat.id, binId: bin.id, qty: 20 }); return { free: stockFree(mat.id, bin.id), item: mat.id };
  }, { job: F.job, mi }, 1500);
  record('The store puts the boards on the shelf', 'storekeeper', stock.free >= 4, stock);
  const prdSees = await seen('joinery_production_manager', (item) => typeof stockLots !== 'undefined' && stockLots.some(l => l.itemId === item && l.onHand >= 20), stock.item);
  record('Production\'s session sees the stock arrive', 'joinery_production_manager', prdSees, null, 'realtime');
  const ok = await act('joinery_production_manager', ({ job, line, day }) => { const r = allotLaneSlot({ crewId: 'CREW-B', jobCardId: job, date: day, lineIds: [line], byWhom: 'E2E Joinery Account' }); return { slot: r.slot && r.slot.id, err: r.error, held: (typeof reservations !== 'undefined' ? reservations : []).filter(x => x.jobCardId === job && x.status === 'held').length }; }, { job: F.job, line: F.lines[0], day: DAYS[3] }, 1500);
  record('Now the lane takes it, and the slot claims the boards for the job', 'joinery_production_manager', ok.slot && ok.held >= 1, ok);
}

/* X7 — overtime to recover */
async function X7() {
  setScenario('X7 Overtime');
  const F = await joineryInProduction('X7', { matIndex: await neverStockedIndex() });   // short in the store, so the shift has nothing to work on
  const ot = await act('joinery_production_manager', ({ job, day }) => {
    const noCause = bookOvertimeShift({ crewId: 'CREW-A', date: day, hours: 3, men: 2, recoversTarget: job, cause: 'felt like it' });
    const idle = bookOvertimeShift({ crewId: 'CREW-A', date: day, hours: 3, men: 2, recoversTarget: job, cause: 'Material late' });
    return { noCause: noCause.error, idle: idle.error, refusedRow: overtimeShifts.some(o => o.recoversTarget === job && o.status === 'refused') };
  }, { job: F.job, day: DAYS[4] });
  record('No cause: refused. A job with short material and no lane: refused AND recorded', 'joinery_production_manager', /cause/i.test(ot.noCause || '') && /nothing to work on/i.test(ot.idle || '') && ot.refusedRow, ot);
  const uph = await act('upholstery_manager', ({ day }) => { const r = bookUphOvertime({ stageId: 'S', date: day, hours: 3, men: 2, recoversTarget: 'JBNOPE', cause: 'Fabric late' }); return { err: r.error }; }, { day: DAYS[4] });
  record('Upholstery\'s own overtime refuses an idle stage the same way', 'upholstery_manager', /nothing to work on|Which/i.test(uph.err || ''), uph);
}

/* X8 — QC fail with rework, the reason travels */
async function X8() {
  setScenario('X8 QC fail and rework');
  const F = await joineryInProduction('X8');
  const qc = await act('joinery_production_manager', ({ job, line }) => {
    ['cutting', 'veneer-pressing', 'assembly'].forEach(s => advanceJoinerySubStage(job, line, s));
    submitLineForQC(job, line, 'carp');
    const rogue = recordLineQCResult(job, line, 'carp', true, 'Some Fitter');
    const fail = recordLineQCResult(job, line, 'carp', false, 'Joinery Production Manager', 'Veneer lifted on the door');
    const e = getJobCard(job).items.find(i => i.lineId === line).departmentStatuses[0];
    const inQueue = getDepartmentQueue('carp').some(r => r.job.id === job && r.entry.status === 'rework');
    return { rogue: rogue && rogue.error, status: e.status, reason: e.rejectReason, count: e.reworkCount, inQueue, reasons: getQCRejectReasonsForDept('carp').map(x => x.reason || x.label || JSON.stringify(x)) };
  }, { job: F.job, line: F.lines[0] }, 1500);
  record('A pass from the wrong identity is refused; a fail from the manager sends it to rework with its reason', 'joinery_production_manager', /authority|Manager|QC/i.test(qc.rogue || '') && qc.status === 'rework' && qc.reason === 'Veneer lifted on the door' && qc.inQueue, qc);
  const live = await liveCol('job_cards', F.job, 'items');
  record('… and the reject reason is in the live job card', 'joinery_production_manager', Array.isArray(live) && live[0].departmentStatuses[0].rejectReason === 'Veneer lifted on the door', Array.isArray(live) && live[0].departmentStatuses[0], 'persistence');
  const again = await act('joinery_production_manager', ({ job, line }) => {
    const r = reworkLineBackToProduction(job, line, 'carp'); submitLineForQC(job, line, 'carp');
    const p = recordLineQCResult(job, line, 'carp', true, 'Joinery Production Manager'); const h = handOffLine(job, line, 'carp', 'E2E Joinery Account');
    const e = getJobCard(job).items.find(i => i.lineId === line).departmentStatuses[0];
    return { r: r && r.error, p: p && p.error, h: h && h.error, status: e.status, pct: e.progressPct, reason: e.rejectReason };
  }, { job: F.job, line: F.lines[0] }, 1500);
  record('Rework, second QC pass, hand-off — done at 100%, and the stale reason cleared', 'joinery_production_manager', again.status === 'done' && again.pct === 100 && !again.reason, again);
}

/* X9 — cancel mid-production, then un-cancel */
async function X9() {
  setScenario('X9 Cancel and un-cancel');
  const F = await joineryInProduction('X9');
  const cancelled = await act('operations_manager', ({ job, q }) => {
    const c = setJobStatus(job, 'cancelled');
    const dn = addDeliveryNote(job, [{ lineId: getJobCard(job).items[0].lineId, requiredQty: 1 }]);
    const v = createVariationForJob(job, { notes: 'x' });
    const inv = generateInvoiceFromJob(job, { invoicedPercent: 50 });
    const unfrozen = !quotationFrozen(q);
    return { c: c && c.error, status: getJobCard(job).status, dn: dn && dn.error, v: v && v.error, inv: inv && inv.error, unfrozen };
  }, { job: F.job, q: F.quotation }, 1500);
  record('Cancelled: delivery, variation and invoice all refused; the quotation unfreezes for correction', 'operations_manager', cancelled.status === 'cancelled' && /cancel/i.test(cancelled.dn || '') && /cancel/i.test(cancelled.v || '') && /cancel/i.test(cancelled.inv || '') && cancelled.unfrozen, cancelled);
  const live = await liveCol('job_cards', F.job, 'status');
  record('… and the live job card reads cancelled', 'operations_manager', live === 'cancelled', live, 'persistence');
  const queues = await act('joinery_production_manager', ({ job }) => ({ inQueue: getDepartmentQueue('carp').some(r => r.job.id === job), inRouting: getJobsPendingRouting().some(j => j.id === job) }), { job: F.job });
  record('The cancelled job drops out of the production queue', 'joinery_production_manager', !queues.inQueue && !queues.inRouting, queues);
  const back = await act('operations_manager', ({ job, q }) => { const r = setJobStatus(job, 'open'); return { err: r && r.error, status: getJobCard(job).status, frozen: !!quotationFrozen(q), inQueue: getDepartmentQueue('carp').some(x => x.job.id === job) }; }, { job: F.job, q: F.quotation }, 1500);
  record('Un-cancelling re-locks the quotation and puts the line back in the queue', 'operations_manager', back.status === 'open' && back.frozen && back.inQueue, back);
}

/* X10 — partial delivery, partial invoice */
async function X10() {
  setScenario('X10 Partial delivery and invoice');
  const F = await joineryInProduction('X10');
  const done = await finishJoineryLine(F.job, F.lines[0]);
  record('Production finishes the line', 'joinery_production_manager', done.done === 'done', done);
  const half = await act('operations_manager', ({ job, line }) => { const r = addDeliveryNote(job, [{ lineId: line, requiredQty: 1 }]); const j = getJobCard(job); return { err: r && r.error, delivered: j.items[0].deliveredQty, status: j.status }; }, { job: F.job, line: F.lines[0] }, 1500);
  record('One of two delivered — the job stays open', 'operations_manager', half.delivered === 1 && half.status === 'open', half);
  const inv = await act('accounts', ({ job }) => {
    const a = generateInvoiceFromJob(job, { invoicedPercent: 50 }); const b = generateInvoiceFromJob(job, { invoicedPercent: 50 }); const c = generateInvoiceFromJob(job, { invoicedPercent: 10 });
    return { a: a && a.id, b: b && b.id, c: c && c.error, sum: taxInvoices.filter(i => i.jobId === job).reduce((s, i) => s + (i.totals.invoicedPercent || 0), 0) };
  }, { job: F.job }, 1500);
  record('Two 50% invoices stack to exactly 100%; a third is refused', 'accounts', inv.a && inv.b && /100%|already|exceed/i.test(inv.c || '') && inv.sum === 100, inv);
  const rest = await act('operations_manager', ({ job, line }) => { const r = addDeliveryNote(job, [{ lineId: line, requiredQty: 1 }]); const j = getJobCard(job); return { err: r && r.error, delivered: j.items[0].deliveredQty, status: j.status, over: addDeliveryNote(job, [{ lineId: line, requiredQty: 1 }]) }; }, { job: F.job, line: F.lines[0] }, 1500);
  record('The second delivery completes the job by derivation; a third is refused — nothing left to deliver', 'operations_manager', rest.delivered === 2 && rest.status === 'completed' && rest.over && /already delivered/.test(rest.over.error || ''), rest);
}

/* X11 — near-duplicate customer */
async function X11() {
  setScenario('X11 Near-duplicate customer');
  const dup = await act('sales', async ({ stamp }) => {
    const a = createCustomer({ name: 'RUN1 X11 first ' + stamp, contactPerson: 'A', tel: '36' + String(stamp).slice(-6), address: 'Saar' });
    await new Promise(r => setTimeout(r, 1500));   // the flag is a foreign key to the first customer — a person takes longer than 0 ms
    const b = createCustomer({ name: 'RUN1 X11 second ' + stamp, contactPerson: 'B', tel: '36' + String(stamp).slice(-6), address: 'Saar' });
    await new Promise(r => setTimeout(r, 1500));   // and the enquiry is a foreign key to the second
    const e = createEnquiry({ division: 'Joinery', customerId: b.id, contactPerson: 'B', tel: '1', source: 'walk inn', salesPerson: 'E2E Test Account' });
    return { a: a.id, b: b.id, flagged: b.possibleDuplicateOf === a.id, status: b.status, enquiry: e && e.id };
  }, { stamp: run.STAMP }, 2000);
  record('The same phone number flags a possible duplicate, pending, and Sales can still raise an enquiry on it', 'sales', dup.flagged && dup.status === 'pending' && dup.enquiry, dup);
  let acc = await seen('accounts', (id) => customers.some(c => c.id === id && c.status === 'pending' && c.possibleDuplicateOf), dup.b, 20000);
  record('Accounts\' session sees the flagged customer arrive through realtime', 'accounts', acc, dup.b, 'realtime');
  if (!acc) { await fresh('accounts'); acc = await seen('accounts', (id) => customers.some(c => c.id === id), dup.b, 5000); record('… a fresh Accounts session hydrates it from the table', 'accounts', acc, dup.b, 'persistence'); }
  const approved = await act('accounts', ({ b }) => { const r = approveCustomer(b, 'E2E Accounts Account'); return { err: r && r.error, status: customers.find(c => c.id === b).status }; }, { b: dup.b }, 1500);
  record('Accounts approves it', 'accounts', approved.status === 'approved', approved);
  const live = await liveCol('customers', dup.b, 'status');
  record('… and the live row reads approved', 'accounts', live === 'approved', live, 'persistence');
}

/* X12 + X13 — COM roll short; two lots for one suite */
async function X12() {
  setScenario('X12 COM shortfall, X13 two lots');
  const F = await frontHalf('X12', { division: 'Upholstery', product: 'X12 dining chair', qty: 8, unit: 'Nos', depts: [['uph']], projectName: 'RUN1 X12' });
  const com = await act('upholstery_manager', ({ job }) => {
    const r = receiveFabricRoll({ name: "COM — client's weave", widthCm: 130, dyeLot: 'C-1', metres: 4, jobCardId: job, isCOM: true, byWhom: 'E2E Upholstery Account' }); inspectFabricRoll(r.id, { ok: true });
    const need = jobFabricNeed(job); const block = comBlockReason(job); const plan = releaseFabricPlan({ jobCardId: job, rollId: r.id });
    const n = raiseCOMShortfallNote({ jobCardId: job, rollId: r.id, shortfallM: Math.ceil(need - 4) }); const half = comBlockReason(job);
    signCOMNote(n.id, { option: 'join', clientSignedBy: 'Client' }); const stillHalf = comBlockReason(job);
    countersignCOMNote(n.id, 'E2E Test Account'); const clear = comBlockReason(job);
    return { need, block, plan: plan && plan.error, half, stillHalf, clear, note: n.id };
  }, { job: F.job }, 2000);
  record('A COM roll short of need blocks the table; the plan refuses; a client signature alone is not enough; the countersignature clears it', 'upholstery_manager', /COM roll/.test(com.block || '') && /Nobody cuts/.test(com.plan || '') && com.half && com.stillHalf && com.clear === null, com);
  const live = await livePayload('com_notes', com.note);
  record('… and the signed note is in the live table with both names', 'upholstery_manager', live && live.clientSignedBy && live.salesSignedBy, live && { c: live.clientSignedBy, s: live.salesSignedBy }, 'persistence');
  const lots = await act('upholstery_manager', ({ job }) => {
    const need = jobFabricNeed(job);
    const r1 = receiveFabricRoll({ name: 'Nova 04', dyeLot: '3310', metres: Math.max(1, Math.floor(need * 0.6)), jobCardId: job, costPerM: 11.2 }); inspectFabricRoll(r1.id, { ok: true });
    const r2 = receiveFabricRoll({ name: 'Nova 04', dyeLot: '3311', metres: Math.max(1, Math.floor(need * 0.6)), jobCardId: job, costPerM: 11.2 }); inspectFabricRoll(r2.id, { ok: true });
    const p1 = releaseFabricPlan({ jobCardId: job, rollId: r1.id }); const p2 = releaseFabricPlan({ jobCardId: job, rollId: r2.id });
    return { need, p1: p1 && p1.error, p2: p2 && p2.error };
  }, { job: F.job }, 1500);
  record('Two rolls of 60% of the need each: the plan refuses BOTH — the suite does not come off one roll', 'upholstery_manager', /does not come off one roll/.test(lots.p1 || '') && /does not come off one roll/.test(lots.p2 || ''), lots);
}

/* X14 — the crew clock: two clocks, a pause with no reason */
async function X14() {
  setScenario('X14 Crew clock refusals');
  const F = await joineryInProduction('X14');
  const r = await act('installation_crew_lead', ({ job, line }) => {
    if (typeof buildCrewRoster === 'function') buildCrewRoster();
    const s1 = startCrewSession({ crewId: 'CREW-A', jobCardId: job, lineIds: [line], activity: 'production' });
    const s2 = startCrewSession({ crewId: 'CREW-A', jobCardId: job, lineIds: [line], activity: 'production' });
    const p = pauseCrewSession(s1.id, ''); const p2 = pauseCrewSession(s1.id, 'Weather'); const pausedNow = p2.status;
    const e = endCrewSession(s1.id, { progressPct: 100 });
    const e2 = endCrewSession(s1.id, { progressPct: 25 });
    const again = endCrewSession(s1.id, {});
    return { s1: s1.id, s2: s2.error, p: p.error, paused: pausedNow, hundred: e && e.error, e2: e2 && e2.status, e2pct: e2 && e2.progressPct, again: again.error };
  }, { job: F.job, line: F.lines[0] }, 2000);
  record('A second clock is refused; a pause with no reason is refused; 100% is refused before the day ends; a day ends once', 'installation_crew_lead', /already on the clock/.test(r.s2 || '') && /Why is the clock stopping/.test(r.p || '') && r.paused === 'paused' && /100% comes from QC/.test(r.hundred || '') && r.e2 === 'ended' && r.e2pct === 25 && /already ended/.test(r.again || ''), r);
  const live = await livePayload('crew_sessions', r.s1);
  record('… and the ended session is in the live table with its pause', 'installation_crew_lead', live && live.status === 'ended' && live.pauses && live.pauses.length === 1, live && { status: live.status, pauses: live.pauses && live.pauses.length }, 'persistence');
}

/* X15 — a delegated estimate */
async function X15() {
  setScenario('X15 Delegated estimate');
  const F = await frontHalf('X15', { division: 'Joinery', product: 'X15 reception desk', qty: 1, unit: 'Nos', depts: [['carp']], projectName: 'RUN1 X15', stopAfter: 'estimated' });
  const d = await act('estimator', ({ q }) => {
    const bad = delegateQuotation(q, 'E2E Estimator Account', 'E2E Estimator Account', 'to myself');
    const noReason = delegateQuotation(q, 'Arun Kumar A', 'E2E Estimator Account', '');
    const ok = delegateQuotation(q, 'Arun Kumar A', 'E2E Estimator Account', 'tender, closes Thursday');
    const qq = quotations.find(x => x.id === q);
    return { bad: bad.error, noReason: noReason && noReason.error, picked: qq.estimatorPickedBy, audit: (qq.auditLog || []).slice(-1)[0] && (qq.auditLog || []).slice(-1)[0].action };
  }, { q: F.quotation }, 1500);
  record('Delegating to oneself is refused; delegating to Arun re-assigns the quote with an audit entry', 'estimator', /different/.test(d.bad || '') && d.picked === 'Arun Kumar A' && /Delegated/.test(d.audit || ''), d);
  if (!d.noReason) note('delegateQuotation() accepts a delegation with no reason', 'estimator', 'The 13b Operations widget refuses a delegation without a reason; the data-layer function does not. Minor inconsistency.', 'finding');
  const live = await liveCol('quotations', F.quotation, 'estimator_picked_by');
  record('… and the delegate is in the live row', 'estimator', live === 'Arun Kumar A', live, 'persistence');
}

(async () => {
  if (!run.PAT) { console.error('SUPABASE_PAT is required.'); process.exit(1); }
  const t0 = Date.now();
  const before = await run.snapshotIds();
  const runners = { X1, X2, X3, X4, X5, X6, X7, X8, X9, X10, X11, X12, X13: null, X14, X15 };
  for (const k of ONLY) {
    if (!runners[k]) continue;
    try { await runners[k](); } catch (e) { record('Scenario crashed: ' + e.message.split('\n')[0], 'driver', false, e.stack.split('\n').slice(0, 3).join(' | '), 'crash'); }
  }
  const r = await run.finish(t0, before);
  process.exit(r.passN === r.total ? 0 : 1);
})().catch(e => { console.error('driver failed: ' + e.message); process.exit(1); });
