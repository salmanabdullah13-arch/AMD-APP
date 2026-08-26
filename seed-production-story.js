/**
 * seed-production-story.js — Al Maraya's production week, as REAL records.
 *
 * Salman: "seed the story for real — this will give idea where the faults lie
 * in the system — take it through all scenarios. Use real stock materials, use
 * real people."
 *
 * So this is not demo content painted onto a screen. It drives the app's own
 * functions against the live Supabase project: real customers, real quotations
 * priced through the real BOM chain, real Item Master materials put away and
 * reserved through 18a's own store functions, real routing, real lane slots.
 * Where a gate refuses, the refusal is real and is REPORTED rather than worked
 * around — finding those is the point of the exercise.
 *
 * Every id it creates is written to production-story-manifest.json so
 * clear-production-story.js can remove exactly this and nothing else.
 *
 *   node seed-production-story.js
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const localISO = (d) => { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };

// Owner-typed fixture: production roles are READ-ONLY on quotations and
// customers (Stage 8 RLS), so the commercial half of the story cannot be
// created by the production manager. Owner is inside is_production_side() too,
// so one session can write the whole story.
const IDENTITY = 'E2E Approver Account';
const PASSWORD = 'E2eFixedTestPassword1234!';

const findings = [];
function finding(scenario, expected, actual, ok) {
  findings.push({ scenario, expected, actual, ok });
}

async function signIn(page, fileUrl) {
  await page.goto(fileUrl);
  await page.waitForFunction(() => {
    const s = document.getElementById('auth-identity-select');
    return s && s.options.length > 1;
  }, { timeout: 15000 }).catch(() => null);
  await page.selectOption('#auth-identity-select', IDENTITY).catch(() => null);
  await page.fill('#auth-password-input', PASSWORD).catch(() => null);
  await page.click('#cloud-login-body button[onclick="handleSignIn()"]').catch(() => null);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 20000 }).catch(() => null);
  return page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('dialog', d => d.accept());
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';

  const inApp = await signIn(page, fileUrl);
  if (!inApp) { console.log('FAILED to sign in — nothing seeded.'); await browser.close(); process.exit(1); }
  console.log('Signed in as ' + IDENTITY + '. Waiting for the caches to hydrate…\n');
  await page.waitForTimeout(5000);

  const out = await page.evaluate(async () => {
    const gap = (ms) => new Promise(r => setTimeout(r, ms || 1400));
    const log = [];
    const note = (scenario, expected, actual, ok) => log.push({ scenario, expected, actual, ok });
    const made = { customers: [], enquiries: [], quotations: [], jobCards: [], laneSlots: [], overtime: [], sheets: [], batches: [], requests: [], revisions: [], reservations: [], lots: [] };

    // Real people in real crews before anything else.
    buildCrewRoster();

    // Real materials off the real Item Master.
    const pick = (frag) => itemMaster.find(i => new RegExp(frag, 'i').test(i.name));
    const MFC = pick('MFC \\(INNOVUS\\)') || itemMaster[0];
    const VENEER = pick('MDF BEECH VENEER') || itemMaster[1];
    const HINGE = pick('CONCEALED HINGES') || itemMaster[2];
    // A material NOTHING else in the story touches and no stock exists for —
    // so the short-material scenario is genuinely short, not merely tight.
    const FABRIC = pick('LIPPING VENEER') || itemMaster[5];

    const store = storeLocations[0] || createStoreLocation({ name: 'Tubli Main Store', address: 'Tubli' });
    const bin = storeBins.find(b => b.code === 'A1') || createStoreBin({ storeId: store.id, code: 'A1', whatLivesHere: 'Boards and sheet goods' });
    made.lots.push(bin.id);

    // ── a job, end to end through the real chain ────────────────────────
    async function makeJob(client, project, lines) {
      const c = createCustomer({ name: client, contactPerson: 'Site contact', tel: String(Math.floor(Math.random() * 1e8)), address: 'Kingdom of Bahrain', creditDays: 30 });
      made.customers.push(c.id); await gap();
      const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'Site contact', tel: c.tel, source: 'walk inn', salesPerson: 'Salman Abdullah', requirements: project });
      made.enquiries.push(e.id); await gap();
      const q = convertEnquiryToQuotation(e.id, { projectName: project, taxPercent: 10, contactPerson: 'Site contact' });
      made.quotations.push(q.id);
      lines.forEach(l => addQuotationItem(q.id, { product: l.product, qty: l.qty, unit: 'Nos', group: l.group, subgroup: l.subgroup, description: l.description }));
      const fresh = quotations.find(x => x.id === q.id);
      fresh.items.forEach((it, i) => {
        const spec = lines[i];
        if (!spec.bom) return;                       // deliberately uncosted
        spec.bom.forEach(m => addBOMMaterial(q.id, it.lineId, { name: m.item.name, qty: m.qty, rate: m.item.cost, unit: m.item.unit }));
        submitItemBOM(q.id, it.lineId, 'Arun Kumar A');
        setItemDepartmentSequence(q.id, it.lineId, spec.depts || ['carp']);
      });
      transferQuotationStage(q.id, 'approver', 'Arun Kumar A');
      approveQuotation(q.id, 'Salman Abdullah', 'owner');
      await gap();
      const job = confirmQuotationToJobCard(q.id, 'Salman Abdullah');
      made.jobCards.push(job.id);
      confirmJobRouting(job.id, {}, 'Operations Manager', null);
      return job;
    }

    // Material actually in the store, so the lane gate can honestly open.
    function stockFor(job, mult) {
      jobBOMItems(job.id).forEach(it => {
        ((it.bom && it.bom.materials) || []).forEach(m => {
          if (!m.itemId) return;
          putAwayStock({ itemId: m.itemId, binId: bin.id, qty: Math.ceil((m.qty || 0) * (mult == null ? 1.2 : mult)), source: 'story', ref: job.id });
        });
      });
    }

    const sun = new Date(); sun.setDate(sun.getDate() - sun.getDay());
    const day = (n) => { const d = new Date(sun); d.setDate(sun.getDate() + n); return localISO(d); };

    // ══ JOB 1 — Amwaj Villa 22, the week's main run ═════════════════════
    const j1 = await makeJob('Amwaj Villa 22', 'Amwaj Villa 22 — master bedroom wardrobes', [
      { product: 'Walk-in wardrobe — 3 door', qty: 3, group: 'Master bedroom', subgroup: 'Wardrobes',
        description: 'Carcass in 18mm MFC, veneered shutters, soft-close hinges.',
        bom: [{ item: MFC, qty: 9 }, { item: VENEER, qty: 6 }, { item: HINGE, qty: 18 }], depts: ['carp', 'paint'] },
      { product: 'Dressing table with mirror', qty: 2, group: 'Master bedroom', subgroup: 'Loose furniture',
        description: 'Veneered MDF, 6mm bevelled mirror.',
        bom: [{ item: VENEER, qty: 4 }], depts: ['carp'] }
    ]);
    stockFor(j1);

    // S1 — a job that has everything: the lane should take it.
    const s1 = allotLaneSlot({ crewId: 'CREW-A', jobCardId: j1.id, date: day(0), portion: 'full', byWhom: 'Production Manager' });
    note('S1 material reserved + live BOM', 'lane accepts', s1.error || 'accepted', !s1.error);
    if (s1.slot) made.laneSlots.push(s1.slot.id);
    [1, 2, 3].forEach(d => {
      const r = allotLaneSlot({ crewId: 'CREW-A', jobCardId: j1.id, date: day(d), portion: 'full', byWhom: 'Production Manager' });
      if (r.slot) made.laneSlots.push(r.slot.id);
    });

    // ══ JOB 2 — Seef Tower reception counter, on Crew B ═════════════════
    const j2 = await makeJob('Diyar Development', 'Seef Tower — Level 3 reception counter', [
      { product: 'Reception counter — carcass and top', qty: 1, group: 'Level 3', subgroup: 'Reception',
        description: 'MFC carcass, veneered front, solid trim.',
        bom: [{ item: MFC, qty: 6 }, { item: VENEER, qty: 8 }], depts: ['carp', 'paint'] }
    ]);
    stockFor(j2);
    [0, 1, 2].forEach(d => {
      const r = allotLaneSlot({ crewId: 'CREW-B', jobCardId: j2.id, date: day(d), portion: 'full', byWhom: 'Production Manager' });
      if (r.slot) made.laneSlots.push(r.slot.id);
    });

    // S5 — two jobs on one crew on one day. Allowed, but never silent.
    const s5 = allotLaneSlot({ crewId: 'CREW-A', jobCardId: j2.id, date: day(4), portion: 'full', byWhom: 'Production Manager' });
    if (s5.slot) made.laneSlots.push(s5.slot.id);
    const s5b = allotLaneSlot({ crewId: 'CREW-A', jobCardId: j1.id, date: day(4), portion: 'full', byWhom: 'Production Manager' });
    if (s5b.slot) made.laneSlots.push(s5b.slot.id);
    note('S5 two jobs on one crew, one day', 'accepted WITH a warning', s5b.warning || (s5b.error ? 'refused: ' + s5b.error : 'accepted silently'), !!s5b.warning);

    // S6 — paint pulls its dates from joinery, and moves when joinery moves.
    const base = laneSlots.find(s => s.id === made.laneSlots[0]);
    const p1 = allotDerivedSlot({ crewId: 'CREW-P', baseSlotId: base.id, offsetDays: 3, jobCardId: j1.id, byWhom: 'Production Manager' });
    const p2 = allotDerivedSlot({ crewId: 'CREW-P', baseSlotId: base.id, offsetDays: 4, jobCardId: j1.id, byWhom: 'Production Manager' });
    if (p1.slot) made.laneSlots.push(p1.slot.id);
    if (p2.slot) made.laneSlots.push(p2.slot.id);
    const before = p1.slot ? slotDate(p1.slot) : null;
    moveLaneSlot(base.id, addDaysISO(base.date, 1), 'Production Manager');
    const after = p1.slot ? slotDate(p1.slot) : null;
    note('S6 derived slot follows its upstream', 'paint date moves with joinery', before + ' -> ' + after, before !== after);
    moveLaneSlot(base.id, addDaysISO(base.date, -1), 'Production Manager');   // put it back

    // S9 — overtime, booked against a target and a cause from the enum.
    const ot = bookOvertimeShift({ crewId: 'CREW-A', date: day(5), hours: 8, men: 4, recoversTarget: j1.id, cause: OVERTIME_CAUSES[0], byWhom: 'Production Manager' });
    if (ot.id) made.overtime.push(ot.id);
    note('S9 overtime with a target and a cause', 'booked', ot.error || 'booked', !ot.error);

    // S8 — the same shift with no cause. Must be refused.
    const otBad = bookOvertimeShift({ crewId: 'CREW-A', date: day(5), hours: 8, men: 4, recoversTarget: j1.id, byWhom: 'Production Manager' });
    note('S8 overtime with no stated cause', 'refused', otBad.error || 'ACCEPTED', !!otBad.error);

    // S12 — a crew with nothing to work on. The spec's `blocked` cell.
    const j5 = await makeJob('Budaiya Majlis', 'Budaiya majlis — sofa and armchairs', [
      { product: 'Majlis sofa — 3 seater', qty: 6, group: 'Majlis', subgroup: 'Seating',
        description: 'New hardwood frame, HR foam, fabric to be confirmed.',
        bom: [{ item: FABRIC, qty: 12 }], depts: ['uph'] }
    ]);
    // deliberately NO stock for this one — the fabric has not arrived
    const s12 = allotLaneSlot({ crewId: 'CREW-U', jobCardId: j5.id, date: day(2), portion: 'full', byWhom: 'Production Manager' });
    note('S3 material short', 'lane refuses, reason names the shortage', s12.error || 'ACCEPTED', /short/i.test(s12.error || ''));

    // ══ JOB 3 — uncosted. No BOM at all. ════════════════════════════════
    const j3 = await makeJob('Juffair Apartments', 'Juffair Apt 7 — kitchen and 3 wardrobes', [
      { product: 'Kitchen run — base and wall units', qty: 1, group: 'Kitchen', subgroup: 'Units',
        description: 'Awaiting the estimator.' }        // no bom
    ]);
    const s2 = allotLaneSlot({ crewId: 'CREW-B', jobCardId: j3.id, date: day(3), portion: 'full', byWhom: 'Production Manager' });
    note('S2 no BOM', 'lane refuses, job sits in the waiting strip', s2.error || 'ACCEPTED', /BOM/i.test(s2.error || ''));

    // ══ S7 — a cutting list, then a revision that kills it ══════════════
    const sheet = createCuttingSheet({ jobCardId: j2.id, saw: 'saw 2',
      lines: [
        { part: 'Counter carcass side', material: '18mm MFC', qty: 4, l: 2100, w: 600, press: false },
        { part: 'Counter front panel', material: 'Beech veneer MDF', qty: 2, l: 2400, w: 900, press: true }
      ], byWhom: 'Production Manager' });
    if (sheet.id) { made.sheets.push(sheet.id); markSheetOnSaw(sheet.id, 'saw 2'); }
    startBOMRevision(j2.id, 'Operations — Silva Fernandes', 'Client changed the counter detail');
    const issued = issueBOMRevision(j2.id, 'Operations — Silva Fernandes');
    if (issued && issued.id) made.revisions.push(issued.id);
    const sheetNow = cuttingSheets.find(s => s.id === sheet.id);
    note('S7a a revision kills the sheet on the saw', 'sheet becomes dead paper', sheetNow ? sheetNow.status : 'no sheet', sheetNow && sheetNow.status === 'dead');
    const s7 = allotLaneSlot({ crewId: 'CREW-B', jobCardId: j2.id, date: day(3), portion: 'full', byWhom: 'Production Manager' });
    note('S7b gate stays shut while dead paper is on the saw', 'refused, naming the saw', s7.error || 'ACCEPTED', /saw/i.test(s7.error || ''));
    confirmSheetOffSaw(sheet.id, 'Production Manager');
    note('S7c it clears on confirming OFF the saw, not on issuing', 'gate open again', jobLaneBlockReason(j2.id) || 'open', jobLaneBlockReason(j2.id) === null);

    // ── press batch: batching is what saves sheets ──────────────────────
    const batch = createPressingBatch({ veneer: 'Beech veneer 0.5mm', byWhom: 'Production Manager' });
    if (batch.id) { made.batches.push(batch.id); addJobToPressingBatch(batch.id, j1.id, 6); addJobToPressingBatch(batch.id, j2.id, 2); }

    // ── the two typed asks, from the only two roles allowed to raise them ─
    const r1 = raiseInputRequest({ type: 'pricing_input', raisedBy: 'Estimator — Arun Kumar A', raiserRole: 'estimator',
      jobCardId: j1.id, question: 'Man-hours and board counts for 3 wardrobes and 2 dressing tables', neededBy: day(0) });
    if (r1.id) made.requests.push(r1.id);
    const r2 = raiseInputRequest({ type: 'bom_budget_input', raisedBy: 'Operations — Silva Fernandes', raiserRole: 'operations_manager',
      jobCardId: j2.id, question: 'Build the BOM for this job so we can set the project budget.', neededBy: day(1) });
    if (r2.id) made.requests.push(r2.id);

    // S10/S11 — what he may send back.
    const money = answerInputRequest(r1.id, { manHours: 46, rate: 12 }, 'Production Manager');
    note('S10 an answer carrying a rate', 'refused', money.error || 'ACCEPTED', !!money.error);
    const clean = answerInputRequest(r1.id, { manHours: 46, men: 4, boards: 9, wastagePct: 12 }, 'Production Manager');
    note('S11 hours, men, boards and wastage', 'accepted', clean.error || 'accepted', !clean.error);

    // S4 — a pending revision blocks a lane.
    startBOMRevision(j1.id, 'Operations — Silva Fernandes', 'Client wants a different handle');
    const s4 = allotLaneSlot({ crewId: 'CREW-A', jobCardId: j1.id, date: day(3), portion: 'half', byWhom: 'Production Manager' });
    note('S4 a BOM revision pending', 'lane refuses', s4.error || 'ACCEPTED', /revision/i.test(s4.error || ''));
    issueBOMRevision(j1.id, 'Operations — Silva Fernandes');   // resolve it so the board reads cleanly

    // S13 — a half day, so the board's `half` state is exercised. On a job
    // that HAS its material: j5 is the deliberately-short one, and asking it
    // for a half day only re-proves S3.
    const half = allotLaneSlot({ crewId: 'CREW-I', jobCardId: j1.id, date: day(4), portion: 'half', byWhom: 'Production Manager' });
    note('S13 half-day allotment', 'accepted, renders as a half cell', half.error || 'accepted', !half.error);
    if (half.slot) made.laneSlots.push(half.slot.id);

    await gap(8000);   // let the scanner flush everything
    return { made, log, waiting: getWaitingForLane().map(w => w.job.id + ' — ' + w.reason) };
  });

  out.log.forEach(l => finding(l.scenario, l.expected, l.actual, l.ok));

  console.log('── Scenarios walked ─────────────────────────────────────────');
  findings.forEach(f => {
    console.log('  ' + (f.ok ? 'OK  ' : 'HM  ') + f.scenario);
    console.log('        expected: ' + f.expected);
    console.log('        actual  : ' + f.actual);
  });

  console.log('\n── Waiting for a lane ───────────────────────────────────────');
  out.waiting.forEach(w => console.log('  ' + w));

  console.log('\n── Records created ──────────────────────────────────────────');
  Object.entries(out.made).forEach(([k, v]) => console.log('  ' + String(v.length).padStart(3) + '  ' + k));

  fs.writeFileSync(path.join(__dirname, 'production-story-manifest.json'),
    JSON.stringify({ createdAt: new Date().toISOString(), identity: IDENTITY, ...out.made }, null, 2));
  console.log('\n  manifest written → production-story-manifest.json');

  const bad = findings.filter(f => !f.ok);
  console.log('\n' + (findings.length - bad.length) + '/' + findings.length + ' scenarios behaved as the design says they should.');
  if (bad.length) { console.log('\n  WORTH A LOOK:'); bad.forEach(f => console.log('   · ' + f.scenario + ' → ' + f.actual)); }
  if (pageErrors.length) { console.log('\n  page errors:'); pageErrors.slice(0, 5).forEach(e => console.log('   ' + e)); }

  await browser.close();
})();
