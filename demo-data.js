// ══════════════════════════════════════════
// DEMO DATA SEEDER — Admin Dashboard, 5 Aug 2026
// Populates the in-memory arrays with realistic, multi-month, multi-
// division business so every chart in the Dashboard Analytics rollout
// (chart-widgets.js) has real content to render instead of its own empty
// state — most dashboards ship with near-zero seed data (jobCards[],
// quotations[], purchaseRequests[]/Orders/Invoices, vehicles[],
// deliverySchedule[], customerFeedback[] all start empty), so almost
// every chart is blank on a fresh load.
//
// LOCAL-ONLY, NEVER PERSISTED — Salman's explicit call. Every create/
// persist function in data.js (persistNewCustomer, persistNewJobCard,
// etc.) already checks `window.__realCloudSession` before writing to
// Supabase; loadDemoData() temporarily flips that to false for the
// duration of seeding (restored in a `finally`), so calling the exact
// same real business functions the app already uses (createCustomer,
// confirmQuotationToJobCard, startLineProduction, ...) is guaranteed to
// touch zero network requests, regardless of whether the signed-in
// session is real. A page reload clears all of it — this is demo
// content, not real business data.
//
// Deliberately reuses this app's own real functions rather than hand-
// building array shapes — the same `withEstimation`-locked BOM->selling-
// price chain a real Sales/Estimator user goes through (addBOMMaterial
// + submitItemBOM), so seeded jobs have real, non-zero, correctly-taxed
// amounts flowing into every KPI/chart the same way real ones would.
// Estimator/Approver's own review screens are bypassed by directly
// setting qtn.lifecycleStatus = 'open' after the BOM is submitted — same
// shortcut this app's own e2e suite already uses when the point of a
// test isn't that specific stage transition (see CLAUDE.md, 2 Aug 2026
// entry: "manually flipped to Open, bypassing the Estimator/Approver
// stage since that flow is already covered by prior sessions' tests").
// ══════════════════════════════════════════

function demoDateMonthsAgo(n, dayOfMonth) {
  const d = new Date();
  d.setDate(1); // avoid month-length overflow (e.g. Jan 31 - 1 month)
  d.setMonth(d.getMonth() - n);
  d.setDate(dayOfMonth || Math.min(1 + ((n * 7) % 24), 28));
  return localISO(d);
}

function demoSeedCustomerAndEnquiry({ name, division, salesPerson, monthsAgo }) {
  const cust = createCustomer({
    name, contactPerson: name.split(' ')[0], tel: '39' + String(1000000 + Math.floor(Math.random() * 8999999)).slice(0, 6),
    address: 'Manama, Bahrain'
  });
  const enq = createEnquiry({
    division, customerId: cust.id, contactPerson: cust.contactPerson, tel: cust.tel,
    source: 'walk inn', salesPerson, dateCreated: demoDateMonthsAgo(monthsAgo)
  });
  return { cust, enq };
}

// itemDefs: [{ product, qty, unit, vatPercent, materialQty, materialUnit,
//   materialRate, deptSequenceOverride }] — one BOM material line per item
// is enough to drive a real, non-zero cost-plus selling price; deptSequenceOverride
// lets a demo item model a real multi-department case (e.g. a sofa frame
// routing carp -> uph) that suggestDepartmentSequence()'s own keyword match
// can't produce from a single product name alone (see the audit's own
// question about this exact ambiguity).
function demoSeedQuotation({ enq, projectName, salesPerson, itemDefs, monthsAgo }) {
  const qtn = convertEnquiryToQuotation(enq.id, { projectName, taxPercent: 10, contactPerson: enq.contactPerson });
  qtn.date = demoDateMonthsAgo(monthsAgo, 2);
  itemDefs.forEach(def => {
    const row = addQuotationItem(qtn.id, { product: def.product, qty: def.qty, unit: def.unit || 'Nos', vatPercent: def.vatPercent ?? 10 });
    if (def.deptSequenceOverride) setItemDepartmentSequence(qtn.id, row.lineId, def.deptSequenceOverride);
    addBOMMaterial(qtn.id, row.lineId, { name: def.product + ' — Material', qty: def.materialQty, unit: def.materialUnit || 'Nos', rate: def.materialRate });
    submitItemBOM(qtn.id, row.lineId, 'Demo Estimator');
  });
  // Bypass Estimator/Approver's own review screens — same shortcut this
  // app's own e2e suite already uses when the point isn't that specific
  // stage transition.
  qtn.stage = 'sales';
  qtn.lifecycleStatus = 'open';
  return qtn;
}

function demoConfirmToJob({ qtn, monthsAgo, confirmedBy }) {
  const job = confirmQuotationToJobCard(qtn.id, confirmedBy);
  if (job.error) return job;
  job.date = demoDateMonthsAgo(monthsAgo, 5);
  job.confirmDate = job.date;
  qtn.confirmDate = job.date;
  return job;
}

// Routes the job, submits+approves every routed department's budget
// (so startLineProduction()'s real budget gate doesn't block anything
// below), then walks each line to `targetStage` — mirrors exactly what a
// real department user clicking through their own queue would do.
// targetStage: 'queued' | 'in-production' | 'qc-fail' | 'qc-pass' | 'done'
function demoAdvanceJob(job, targetStage, routedBy) {
  if (!job.routingConfirmed) confirmJobRouting(job.id, {}, routedBy);
  const deptKeys = [...new Set(job.items.flatMap(it => it.departmentSequence || []))];
  deptKeys.forEach(deptKey => {
    if (job.departmentBudgets && job.departmentBudgets[deptKey] && job.departmentBudgets[deptKey].approvalStatus !== 'approved') {
      submitDepartmentBudget(job.id, deptKey, { materials: 400, labour: 250, subcontract: 0, hiring: 0, others: 50 }, 'Demo Estimator');
      approveDepartmentBudget(job.id, deptKey, deptKey === 'uph' ? 'Upholstery Manager' : 'Joinery Production Manager');
    }
  });
  if (targetStage === 'queued') return;
  job.items.forEach(item => {
    (item.departmentStatuses || []).forEach(entry => {
      const deptKey = entry.department;
      const idx = (item.departmentSequence || []).indexOf(deptKey);
      if (idx > 0) return; // only drive the FIRST stop per line here — hand-off drives the rest, see demoHandOff below
      if (deptKey === 'paint') {
        startPaintingWork(job.id, item.lineId);
        if (targetStage === 'in-production') return;
        submitPaintingForQC(job.id, item.lineId);
        if (targetStage === 'qc-fail') { recordPaintingQCResult(job.id, item.lineId, false, 'Demo Painting Lead'); return; }
        recordPaintingQCResult(job.id, item.lineId, true, DEPT_QC_AUTHORITY.paint);
        if (targetStage === 'done') handOffPaintingLine(job.id, item.lineId, 'Demo Painting Lead');
      } else {
        startLineProduction(job.id, item.lineId, deptKey);
        // Joinery-only internal sub-stage gate (Phase 2 audit finding #2) —
        // submitLineForQC() REFUSES a carp line until joinerySubStage
        // actually reaches 'assembly'. Must run here, after
        // startLineProduction() has set the initial sub-stage, not before
        // (an earlier version of this seeder tried to walk it before
        // production started, when the field didn't exist yet — every
        // downstream call silently no-op'd as a result, confirmed live).
        if (deptKey === 'carp' && entry.joinerySubStage) {
          while (entry.joinerySubStage !== JOINERY_SUB_STAGES[JOINERY_SUB_STAGES.length - 1]) {
            const next = JOINERY_SUB_STAGES[JOINERY_SUB_STAGES.indexOf(entry.joinerySubStage) + 1];
            advanceJoinerySubStage(job.id, item.lineId, next);
          }
        }
        if (targetStage === 'in-production') return;
        submitLineForQC(job.id, item.lineId, deptKey);
        if (targetStage === 'qc-fail') { recordLineQCResult(job.id, item.lineId, deptKey, false, 'Demo Team Lead'); return; }
        // A QC pass must come from the department's own QC authority
        // (DEPT_QC_AUTHORITY, 6 Aug 2026 audit) — a fail can be anyone.
        recordLineQCResult(job.id, item.lineId, deptKey, true, DEPT_QC_AUTHORITY[deptKey]);
        if (targetStage === 'done') handOffLine(job.id, item.lineId, deptKey, 'Demo Team Lead');
      }
    });
  });
}

function demoInvoiceAndReceipt(job, monthsAgo) {
  if (!job.routingConfirmed) return;
  const inv = generateInvoiceFromJob(job.id, {});
  if (inv.error) return;
  inv.date = demoDateMonthsAgo(monthsAgo, 20);
  // Roughly 70% paid, so Receivables/Payables charts show a real partial balance, not just BD 0 or 100%.
  const payAmount = Math.round(inv.totals.netTotal * 0.7 * 1000) / 1000;
  createSalesReceipt({
    customerId: job.customerId, receiptDate: demoDateMonthsAgo(monthsAgo, 22),
    methods: { bank: { enabled: true, amount: payAmount, bank: 'BBK' } }, amount: payAmount,
    allocations: [{ invoiceId: inv.id, payingAmount: payAmount, discountAmount: 0 }]
  });
}

// ── Snapshot every array's length before seeding, so clearDemoData() can
// remove exactly what was added without disturbing anything a signed-in
// user did in the same session before/after loading demo data. ──
const DEMO_TRACKED_ARRAYS = {
  customers, enquiries, quotations, jobCards, curtainJobs, projects,
  suppliers, purchaseRequests, purchaseOrders, purchaseInvoices, stockEntries,
  taxInvoices, salesReceipts, vehicles, vehicleInspections, deliverySchedule,
  customerFeedback, activityLog, purchaseInquiries
};
let demoDataStartCounts = null;

// Fills a bridged curtainJobs[] entry with realistic windowGroups (the same
// authoring schema the old fixtures used: group -> layers, each layer a
// full window spec), rebuilds the derived flat windows[] array, marks the
// job in execution, and raises a purchase inquiry against the main fabric.
// variant 0 = 2 groups (wave+sheer pair, motorized slider); variant 1 adds
// a roller blind with cord fields so every treatment family appears.
function demoAuthorCurtainWindows(job, variant) {
  if (!job || !job.id) return;
  const cj = curtainJobs.find(j => j.id === job.id);
  if (!cj) return;
  const p = 'w-' + job.id + '-';
  cj.windowGroups = [
    { id: p + 'g1', room: 'Master Bedroom', width: 280, height: 260, qty: 1, layers: [
      { id: p + '1', role: 'main', label: 'Window 1', overhang: 20,
        treatment: 'curtain', fabricType: 'main', fabricCode: 'Nassaj N11011-002', designType: 'Wave',
        fullness: 2.5, rollWidth: 140, patternRepeatV: 32, patternRepeatH: 0, topHem: 8, bottomHem: 12, sideHem: 5,
        motorized: false, motorBrand: null, motorModel: null, remoteType: null,
        railType: 'Aluminium U-Shape Head Rail — Ningbo CH016', railItemCode: 'IT001886', openingDirection: 'two_way', bracketType: 'Ceiling bracket',
        quoteEstimateMetres: 19, calcDone: true, calc: null },
      { id: p + '2', role: 'sheer', label: 'Window 1 — Sheer', overhang: 20,
        treatment: 'curtain', fabricType: 'sheer', fabricCode: 'Gulf Sheer Voile', designType: 'Wave',
        fullness: 2.5, rollWidth: 300, patternRepeatV: 0, patternRepeatH: 0, topHem: 8, bottomHem: 12, sideHem: 5,
        motorized: false, motorBrand: null, motorModel: null, remoteType: null,
        railType: 'Aluminium U-Shape Head Rail — Ningbo CH016', railItemCode: 'IT001886', openingDirection: 'two_way', bracketType: 'Ceiling bracket',
        quoteEstimateMetres: 9.6, calcDone: true, calc: null }
    ] },
    { id: p + 'g2', room: 'Living Room', width: 420, height: 280, qty: 1, layers: [
      { id: p + '3', role: 'single', label: 'Sliding Door — Motorized', overhang: 30,
        treatment: 'motorized', fabricType: 'blackout', fabricCode: 'CURFAB010 FABRIC 100', designType: 'Triple pleat',
        fullness: 2, rollWidth: 140, patternRepeatV: 0, patternRepeatH: 0, topHem: 8, bottomHem: 12, sideHem: 5,
        motorized: true, motorBrand: 'somfy', motorModel: 'Somfy RS100', remoteType: 'Single-channel Somfy Remote',
        railType: 'Somfy Glydea Track — raw rail', railItemCode: 'IT000450', openingDirection: 'two_way', bracketType: 'Motorised ceiling bracket',
        quoteEstimateMetres: 23.5, calcDone: variant === 0, calc: null }
    ] }
  ];
  if (variant === 1) {
    cj.windowGroups.push({ id: p + 'g3', room: 'Study', width: 120, height: 180, qty: 1, layers: [
      { id: p + '4', role: 'single', label: 'Roller Blind — Study', overhang: 0,
        treatment: 'roller', fabricType: 'blackout', fabricCode: 'CURFAB007 ROLLER BLIND FABRIC-216566RFR-1-300', designType: null,
        fullness: 1, rollWidth: 200, patternRepeatV: 0, patternRepeatH: 0, topHem: 0, bottomHem: 0, sideHem: 0,
        motorized: false, motorBrand: null, motorModel: null, remoteType: null,
        railType: 'Roman Blind Headrail — Unisoiel RAE01', railItemCode: 'IT000362', openingDirection: 'fixed', bracketType: 'Recess bracket',
        cordType: 'Ball chain', cordLength: 180, cordSide: 'right',
        quoteEstimateMetres: 2.3, calcDone: false, calc: null }
    ] });
  }
  cj.windows = flattenWindowGroups(cj);
  cj.status = 'execution';
  cj.bomStatus = 'approved';
  cj.budgetStatus = 'approved';
  raiseInquiry({
    jobId: cj.id, windowIds: [p + '1', p + '2'], vendor: 'Gulf Textiles', vendorRegion: 'Bahrain / Dubai',
    source: 'vendor', fabricCode: 'Nassaj N11011-002', quantityOrdered: 29, notes: 'Demo inquiry — main + sheer fabric'
  });
}

function loadDemoData() {
  if (demoDataStartCounts) { if (typeof commsToast === 'function') commsToast('Demo data is already loaded — Clear it first to reload.'); return; }
  const wasReal = window.__realCloudSession;
  window.__realCloudSession = false; // suppresses every persist*() call below — see file header
  demoDataStartCounts = {};
  Object.keys(DEMO_TRACKED_ARRAYS).forEach(k => { demoDataStartCounts[k] = DEMO_TRACKED_ARRAYS[k].length; });
  try {
    // ── Curtain & Blinds — 4 jobs spread across the current + 3 prior months,
    // one fully delivered/invoiced, one left un-routed so the Pipeline
    // Funnel's "Job Confirmed" stage isn't empty either. Qty varies per job
    // so the monthly chart doesn't show 3 identical bar heights. ──
    const curtainDemoJobs = [];
    for (let i = 0; i < 4; i++) {
      const monthsAgo = 3 - i;
      const { enq } = demoSeedCustomerAndEnquiry({ name: `Al Fardan Villa ${i + 1}`, division: 'Curtain & Blinds', salesPerson: 'Salman Abdullah', monthsAgo });
      const qtn = demoSeedQuotation({
        enq, projectName: `Al Fardan Villa ${i + 1} — Curtains`, salesPerson: 'Salman Abdullah', monthsAgo,
        itemDefs: [{ product: 'Blackout Curtain — Living Room', qty: 4 + i * 2, unit: 'Meters', materialQty: 4 + i * 2, materialUnit: 'Meters', materialRate: 18 }]
      });
      const job = demoConfirmToJob({ qtn, monthsAgo, confirmedBy: 'Salman Abdullah' });
      curtainDemoJobs.push(job);
      if (i === 3) continue; // left un-routed on purpose — populates the funnel's "Job Confirmed" stage
      demoAdvanceJob(job, i === 0 ? 'done' : 'in-production', 'Operations Manager');
      if (i === 0) {
        addDeliveryNote(job.id, job.items.map(it => ({ lineId: it.lineId, requiredQty: it.qty })));
        demoInvoiceAndReceipt(job, monthsAgo);
      }
    }
    // Author real window data on the first two bridged curtain jobs so
    // Curtain's own screens (Dashboard/Windows/Tracks/QC/Pipeline/Purchase
    // Inquiries) show content — since the old hand-seeded fixtures were
    // cleared (6 Aug 2026), the bridge seeds windowGroups empty and this is
    // the only demo path that fills them.
    demoAuthorCurtainWindows(curtainDemoJobs[0], 0);
    demoAuthorCurtainWindows(curtainDemoJobs[1], 1);

    // ── Joinery + Painting — a painted cabinet job, 2 months apart ──
    for (let i = 0; i < 2; i++) {
      const monthsAgo = 3 - i;
      const { enq } = demoSeedCustomerAndEnquiry({ name: `Seef Business Center ${i + 1}`, division: 'Joinery', salesPerson: 'Salman Abdullah', monthsAgo });
      const qtn = demoSeedQuotation({
        enq, projectName: `Seef Reception ${i + 1} — TV Unit`, salesPerson: 'Salman Abdullah', monthsAgo,
        itemDefs: [{ product: 'Painted TV Unit Cabinet', qty: 1 + i, unit: 'Nos', materialQty: 1 + i, materialUnit: 'Nos', materialRate: 650 }]
      });
      const job = demoConfirmToJob({ qtn, monthsAgo, confirmedBy: 'Salman Abdullah' });
      if (!job.routingConfirmed) confirmJobRouting(job.id, {}, 'Operations Manager');
      demoAdvanceJob(job, i === 0 ? 'done' : 'qc-fail', 'Operations Manager');
      if (i === 0) {
        // hand off the now-QC-passed carp stop into Painting's own separate queue
        job.items.forEach(item => {
          const carpEntry = (item.departmentStatuses || []).find(d => d.department === 'carp');
          if (carpEntry && carpEntry.status === 'ready-for-handoff') handOffLine(job.id, item.lineId, 'carp', 'Demo Team Lead');
        });
        job.items.forEach(item => {
          const paintEntry = (item.departmentStatuses || []).find(d => d.department === 'paint');
          if (paintEntry && paintEntry.status === 'queued') { startPaintingWork(job.id, item.lineId); submitPaintingForQC(job.id, item.lineId); recordPaintingQCResult(job.id, item.lineId, true, DEPT_QC_AUTHORITY.paint); }
        });
        demoInvoiceAndReceipt(job, monthsAgo);
      }
    }

    // ── Joinery (sofa frame) + Upholstery — the real handoff-risk case the
    // Fable audit is specifically checking. suggestDepartmentSequence()'s
    // own keyword match can't produce ["carp","uph"] from one product name
    // (sofa/chair/cushion keywords route straight to uph) — manually
    // overridden here via setItemDepartmentSequence(), same override an
    // Estimator has available in the real UI. ──
    {
      const monthsAgo = 2;
      const { enq } = demoSeedCustomerAndEnquiry({ name: 'Riffa Views Furniture Co', division: 'Furniture', salesPerson: 'Salman Abdullah', monthsAgo });
      const qtn = demoSeedQuotation({
        enq, projectName: 'Riffa Views — Custom Sofa Set', salesPerson: 'Salman Abdullah', monthsAgo,
        itemDefs: [{ product: 'Custom Sofa Frame + Upholstery', qty: 2, unit: 'Nos', materialQty: 2, materialUnit: 'Nos', materialRate: 380, deptSequenceOverride: ['carp', 'uph'] }]
      });
      const job = demoConfirmToJob({ qtn, monthsAgo, confirmedBy: 'Salman Abdullah' });
      if (!job.routingConfirmed) confirmJobRouting(job.id, {}, 'Operations Manager');
      demoAdvanceJob(job, 'done', 'Operations Manager'); // carp: production -> qc pass (ready-for-handoff)
      job.items.forEach(item => {
        const carpEntry = (item.departmentStatuses || []).find(d => d.department === 'carp');
        if (carpEntry && carpEntry.status === 'ready-for-handoff') handOffLine(job.id, item.lineId, 'carp', 'Demo Joinery Lead');
      });
      // Upholstery's own stop starts fresh once handed off — walk it partway
      // (in-production) so Upholstery's queue has real, visibly-in-progress content.
      job.items.forEach(item => {
        const uphEntry = (item.departmentStatuses || []).find(d => d.department === 'uph');
        if (uphEntry && uphEntry.status === 'queued') {
          if (job.departmentBudgets && job.departmentBudgets.uph && job.departmentBudgets.uph.approvalStatus !== 'approved') {
            submitDepartmentBudget(job.id, 'uph', { materials: 300, labour: 200, subcontract: 0, hiring: 0, others: 0 }, 'Demo Estimator');
            approveDepartmentBudget(job.id, 'uph', 'Upholstery Manager');
          }
          startLineProduction(job.id, item.lineId, 'uph');
        }
      });
    }

    // ── One more Upholstery-only job, a stand-alone armchair, kept at "in QC" ──
    {
      const monthsAgo = 1;
      const { enq } = demoSeedCustomerAndEnquiry({ name: 'Amwaj Residences', division: 'Upholstery', salesPerson: 'Salman Abdullah', monthsAgo });
      const qtn = demoSeedQuotation({
        enq, projectName: 'Amwaj — Accent Armchair Re-upholstery', salesPerson: 'Salman Abdullah', monthsAgo,
        itemDefs: [{ product: 'Accent Armchair Re-upholstery', qty: 3, unit: 'Nos', materialQty: 3, materialUnit: 'Nos', materialRate: 140 }]
      });
      const job = demoConfirmToJob({ qtn, monthsAgo, confirmedBy: 'Salman Abdullah' });
      demoAdvanceJob(job, 'qc-fail', 'Operations Manager');
    }

    // ── Purchasing + Storekeeper — one supplier, a couple of PRs, one full Stock-type receipt cycle ──
    const supplier = createSupplier({ name: 'Gulf Timber & Hardware WLL', contactPerson: 'Yousif', telephone: '17123456', address: 'Sitra Industrial Area' });
    const prJoinery = raisePurchaseRequest({ department: 'carp', raisedBy: 'Demo Joinery Lead', destinationType: 'inventory', division: 'Joinery', items: [{ name: 'MDF Board 18mm', qty: 20, unit: 'Sheets' }] });
    raisePurchaseRequest({ department: 'uph', raisedBy: 'Demo Upholstery Lead', destinationType: 'job-direct', division: 'Upholstery', items: [{ name: 'Upholstery Foam 4-inch', qty: 15, unit: 'Meters' }] });
    raisePurchaseRequest({ department: 'curt', raisedBy: 'Salman Abdullah', destinationType: 'job-direct', division: 'Curtain & Blinds', items: [{ name: 'Curtain Track Rail', qty: 30, unit: 'Meters' }] });
    const po = convertPRtoPO(prJoinery.id, { supplierId: supplier.id, supplierNameTel: `${supplier.name} / ${supplier.telephone}`, preparedBy: 'Demo Purchaser' });
    approvePO(po.id, 'Operations Manager');
    convertPOtoInvoice(po.id, {});
    if (stockEntries.length) releaseStockEntry(stockEntries[stockEntries.length - 1].id, { department: 'carp', jobId: null, qty: 5, issuedBy: 'Demo Storekeeper' });

    // ── Vehicle Fleet + Delivery/Scheduling ──
    const van = addVehicle({ plateNumber: '55-2024', make: 'Toyota', model: 'Hiace', type: 'Delivery Van' });
    recordVehicleInspection(van.id, [
      { label: 'Tyres', pass: true }, { label: 'Brakes', pass: true }, { label: 'Lights', pass: true },
      { label: 'Engine Oil', pass: true }, { label: 'Coolant', pass: true }, { label: 'Body', pass: true }, { label: 'Registration', pass: true }
    ], 'Demo Fleet Inspector');
    const van2 = addVehicle({ plateNumber: '77-2022', make: 'Nissan', model: 'Urvan', type: 'Delivery Van' });
    recordVehicleInspection(van2.id, [
      { label: 'Tyres', pass: false }, { label: 'Brakes', pass: true }, { label: 'Lights', pass: true },
      { label: 'Engine Oil', pass: true }, { label: 'Coolant', pass: true }, { label: 'Body', pass: true }, { label: 'Registration', pass: true }
    ], 'Demo Fleet Inspector');
    const routedJob = jobCards.find(j => j.routingConfirmed && j.status !== 'cancelled');
    if (routedJob) {
      scheduleDelivery(routedJob.id, { plannedDate: demoDateMonthsAgo(0, 20), driver: 'Ahmed', vehicleId: van.id, notes: 'Demo scheduled delivery' });
      recordCustomerFeedback(routedJob.id, { rating: 5, comments: 'Excellent finish, on time.' }, 'Demo Fleet Inspector');
    }

    if (typeof notifyLiveUpdateListeners === 'function') notifyLiveUpdateListeners();
    if (typeof commsToast === 'function') commsToast('Demo data loaded — reload the page to clear it, or use Clear Demo Data.');
  } finally {
    window.__realCloudSession = wasReal;
  }
}

function clearDemoData() {
  if (!demoDataStartCounts) { if (typeof commsToast === 'function') commsToast('No demo data is currently loaded.'); return; }
  Object.entries(DEMO_TRACKED_ARRAYS).forEach(([key, arr]) => {
    const keep = arr.slice(0, demoDataStartCounts[key]);
    arr.length = 0;
    keep.forEach(x => arr.push(x));
  });
  demoDataStartCounts = null;
  if (typeof notifyLiveUpdateListeners === 'function') notifyLiveUpdateListeners();
  if (typeof commsToast === 'function') commsToast('Demo data cleared.');
}
