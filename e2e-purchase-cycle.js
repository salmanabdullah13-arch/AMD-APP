// Verification for the Purchase request-to-delivery cycle (handoff 17a).
//
// The handoff states the whole module in one sentence: "a department raises
// a request off a verified BOM, Purchase sources it (rate contract or RFQ),
// raises the PO, Operations releases it, the store books the goods in, and
// mismatches stay open until claimed."
//
// This drives that sentence start to finish through the real data layer and
// asserts on real record state — never on rendered text. Four of the
// entities here did not exist before 17a, so this is their first coverage.

const { chromium } = require('@playwright/test');
const path = require('path');

let pass = 0, fail = 0;
const errors = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  console.log('\n— the RFQ rule —');
  const rule = await page.evaluate(() => {
    const sup = [1, 2, 3, 4].map(i => createSupplier({
      name: 'Cycle Supplier ' + i, contactPerson: 'C', telephone: '1700000' + i, address: 'Manama'
    }));
    return {
      supIds: sup.map(s => s.id),
      two: rfqMeetsQuoteRule(2), three: rfqMeetsQuoteRule(3),
      noItems: createRFQ({ items: [], supplierIds: [sup[0].id] }).error,
      noSups: createRFQ({ items: [{ name: 'Ply 18mm', qty: 10, unit: 'Nos' }], supplierIds: [] }).error
    };
  });
  check('fewer than three suppliers does not meet the rule', rule.two === false, rule.two);
  check('three suppliers meets it', rule.three === true, rule.three);
  check('an RFQ with no lines is refused', !!rule.noItems, rule.noItems);
  check('an RFQ with no suppliers is refused', !!rule.noSups, rule.noSups);

  console.log('\n— sourcing: quotes in, best price and lead, recommendation —');
  const src = await page.evaluate((supIds) => {
    const r = createRFQ({
      items: [{ name: 'Ply 18mm sheet', qty: 20, unit: 'Nos' }],
      supplierIds: supIds.slice(0, 3), raisedBy: 'Ali Mansoor'
    });
    const stranger = recordRFQQuote(r.id, { supplierId: supIds[3], price: 100, leadDays: 1 });
    const noPrice = recordRFQQuote(r.id, { supplierId: supIds[0], price: 0, leadDays: 5 });
    recordRFQQuote(r.id, { supplierId: supIds[0], price: 1000, leadDays: 21, terms: '30 days' });
    recordRFQQuote(r.id, { supplierId: supIds[1], price: 1060, leadDays: 4, terms: '30 days' });
    recordRFQQuote(r.id, { supplierId: supIds[2], price: 1400, leadDays: 3, terms: 'Cash' });
    // A revised quote replaces rather than duplicates.
    recordRFQQuote(r.id, { supplierId: supIds[2], price: 1380, leadDays: 3 });
    const rf = rfqs.find(x => x.id === r.id);
    return {
      id: r.id, status: rf.status, quoteCount: rf.quotes.length,
      strangerErr: stranger.error, noPriceErr: noPrice.error,
      best: rfqBestPrice(rf).supplierId, fastest: rfqBestLead(rf).supplierId,
      recommended: rfqRecommended(rf).supplierId,
      s0: supIds[0], s1: supIds[1], s2: supIds[2]
    };
  }, rule.supIds);
  check('a quote from a supplier who was never asked is refused', !!src.strangerErr, src.strangerErr);
  check('a quote with no price is refused', !!src.noPriceErr, src.noPriceErr);
  check('a revised quote replaces the old one rather than duplicating it', src.quoteCount === 3, src.quoteCount);
  check('the RFQ moves to quotes-in once a quote lands', src.status === 'quotes-in', src.status);
  check('best price is the cheapest quote', src.best === src.s0, src);
  check('best lead is the fastest quote', src.fastest === src.s2, src);
  check('the recommendation prefers a materially faster quote within 10% of the cheapest',
    src.recommended === src.s1, { recommended: src.recommended, expected: src.s1 });

  console.log('\n— awarding raises a real PO, and it is NOT auto-released —');
  const award = await page.evaluate((d) => {
    const po = awardRFQ(d.id, d.s1, 'Ali Mansoor');
    const rf = rfqs.find(x => x.id === d.id);
    const second = awardRFQ(d.id, d.s0, 'Ali Mansoor');
    return {
      poId: po.id, approvalStatus: po.approvalStatus, promised: po.promisedDate,
      supplierId: po.supplierId, sourceRFQ: po.sourceRFQ,
      rfqStatus: rf.status, awardedTo: rf.awardedTo, secondErr: second.error,
      value: poValue(po)
    };
  }, src);
  check('awarding raises a purchase order', !!award.poId, award);
  check('that PO lands PENDING approval — there is no auto-release tier',
    award.approvalStatus === 'pending', award.approvalStatus);
  check('the PO carries a promised date derived from the quoted lead time', !!award.promised, award.promised);
  check('the PO points back at the RFQ it came from', award.sourceRFQ === src.id, award);
  check('the RFQ is marked awarded and cannot be awarded twice',
    award.rfqStatus === 'awarded' && !!award.secondErr, award);

  console.log('\n— nothing can be booked in against an unapproved PO —');
  const gate = await page.evaluate((poId) => {
    const early = recordGoodsReceipt({ poId, lines: [{ lineIndex: 0, receivedQty: 20 }] });
    return { err: early.error, count: goodsReceipts.length };
  }, award.poId);
  check('a goods receipt against an unapproved PO is refused', !!gate.err, gate.err);
  check('and nothing was recorded', gate.count === 0, gate.count);

  console.log('\n— deliveries due, and going late —');
  const del = await page.evaluate((poId) => {
    approvePO(poId, 'Operations Manager');
    const po = purchaseOrders.find(p => p.id === poId);
    const dueNow = getDeliveriesDue().some(p => p.id === poId);
    const lateBefore = getLateDeliveries().some(p => p.id === poId);
    po.promisedDate = '2020-01-01';   // force it past due
    const lateAfter = getLateDeliveries().some(p => p.id === poId);
    return { dueNow, lateBefore, lateAfter };
  }, award.poId);
  check('an approved PO with a promised date shows as a delivery due', del.dueNow === true, del);
  check('it is not late while the promised date is ahead', del.lateBefore === false, del);
  check('it goes late once the promised date passes', del.lateAfter === true, del);

  console.log('\n— the store books it in short, and the claim stays open —');
  const grn = await page.evaluate((poId) => {
    const g = recordGoodsReceipt({ poId, lines: [{ lineIndex: 0, receivedQty: 14 }], receivedBy: 'Storekeeper' });
    return {
      id: g.id, result: g.result, claimState: g.claimState,
      shortfall: grnShortfallValue(g), value: grnValue(g),
      mismatches: getGRNMismatches().length,
      stillDue: getDeliveriesDue().some(p => p.id === poId)
    };
  }, award.poId);
  check('a short delivery is derived as short, not typed', grn.result === 'short', grn.result);
  check('a mismatch opens a claim automatically', grn.claimState === 'open', grn.claimState);
  check('it appears in the GRN mismatch queue', grn.mismatches === 1, grn.mismatches);
  check('the shortfall carries a real value to claim', grn.shortfall > 0, grn.shortfall);
  check('the PO is still an open delivery until the balance arrives', grn.stillDue === true, grn.stillDue);

  console.log('\n— claiming needs a note; settling follows —');
  const claim = await page.evaluate((grnId) => {
    const bare = claimGRNBalance(grnId, 'Ali Mansoor', '   ');
    const ok = claimGRNBalance(grnId, 'Ali Mansoor', '6 sheets short on delivery');
    // Snapshot now: these functions return the live record, so reading
    // ok.claimState after settleGRNClaim() below would report 'settled'
    // and look like the claim step had failed.
    const afterClaim = { state: ok.claimState, note: ok.claimNote };
    const twice = claimGRNBalance(grnId, 'Ali Mansoor', 'again');
    const settled = settleGRNClaim(grnId, 'Ali Mansoor');
    return {
      bareErr: bare.error, state: afterClaim.state, note: afterClaim.note,
      twiceErr: twice.error, settledState: settled.claimState,
      offQueue: getGRNMismatches().length
    };
  }, grn.id);
  check('claiming without a note is refused', !!claim.bareErr, claim.bareErr);
  check('a claim records its note against the receipt',
    claim.state === 'claimed' && claim.note === '6 sheets short on delivery', claim);
  check('the same balance cannot be claimed twice', !!claim.twiceErr, claim.twiceErr);
  check('settling closes it and it leaves the mismatch queue',
    claim.settledState === 'settled' && claim.offQueue === 0, claim);

  console.log('\n— an over-delivery reads differently from a short one —');
  const over = await page.evaluate((supId) => {
    const po = createPurchaseOrderDirect({
      department: 'purchase', destinationType: 'inventory',
      supplierDetails: { supplierId: supId, supplierNameTel: 'Over Supplier' },
      items: [{ name: 'Screws 40mm', qty: 100, unit: 'Nos', fxRateBD: 0.1 }]
    });
    approvePO(po.id, 'Operations Manager');
    const g = recordGoodsReceipt({ poId: po.id, lines: [{ lineIndex: 0, receivedQty: 120 }] });
    const full = recordGoodsReceipt({
      poId: createPOFull(supId), lines: [{ lineIndex: 0, receivedQty: 5 }]
    });
    function createPOFull(sid) {
      const p = createPurchaseOrderDirect({
        department: 'purchase', destinationType: 'inventory',
        supplierDetails: { supplierId: sid, supplierNameTel: 'Over Supplier' },
        items: [{ name: 'Hinge', qty: 5, unit: 'Nos', fxRateBD: 1 }]
      });
      approvePO(p.id, 'Operations Manager');
      return p.id;
    }
    return { over: g.result, overClaim: g.claimState, full: full.result, fullClaim: full.claimState };
  }, rule.supIds[0]);
  check('receiving more than ordered reads "over"', over.over === 'over', over);
  check('a full delivery has nothing to claim', over.full === 'full' && over.fullClaim === 'none', over);

  console.log('\n— rate contracts —');
  const rc = await page.evaluate((supId) => {
    const item = itemMaster[0];
    const noExpiry = createRateContract({ supplierId: supId, itemIds: [item.id] });
    const live = createRateContract({ supplierId: supId, itemIds: [item.id], rates: { [item.id]: 4.5 }, rateHeldTo: '2099-12-31' });
    const gone = createRateContract({ supplierId: supId, itemIds: ['IT000000'], rateHeldTo: '2020-01-01' });
    return {
      noExpiryErr: noExpiry.error,
      liveState: rateContractState(live), goneState: rateContractState(gone),
      lookup: (getRateContractFor(item.id) || {}).id, liveId: live.id,
      expiring: getExpiringRateContracts().length
    };
  }, rule.supIds[0]);
  check('a rate contract without an expiry is refused', !!rc.noExpiryErr, rc.noExpiryErr);
  check('state is derived from the date, not stored',
    rc.liveState === 'active' && rc.goneState === 'expired', rc);
  check('an item resolves to its live contract', rc.lookup === rc.liveId, rc);
  check('the expired one shows up in the expiring/expired list', rc.expiring >= 1, rc.expiring);

  console.log('\n— documents, where the status that matters is an absence —');
  const doc = await page.evaluate(() => {
    const orphan = filePurchaseDocument({ type: 'Supplier invoice' });
    const missingBefore = getMissingSupplierInvoices();
    const target = missingBefore[0];
    if (target) filePurchaseDocument({ type: 'Supplier invoice', againstType: 'po', againstId: target.po.id });
    const missingAfter = getMissingSupplierInvoices();
    filePurchaseDocument({ type: 'Trade licence', againstType: 'supplier', againstId: 'S1', expiryDate: '2020-01-01' });
    return {
      orphanErr: orphan.error,
      before: missingBefore.length, after: missingAfter.length,
      expiredFlagged: getExpiringDocuments().some(d => d.expired)
    };
  });
  check('a document must be filed against something', !!doc.orphanErr, doc.orphanErr);
  check('a fully-received PO with no supplier invoice is flagged as missing',
    doc.before > 0, doc.before);
  check('filing the invoice clears it — the absence is what is tracked',
    doc.after === doc.before - 1, doc);
  check('an expired certificate is flagged', doc.expiredFlagged === true, doc);

  console.log('\n— supplier performance is derived, and honest about "no record" —');
  const perf = await page.evaluate((supIds) => ({
    onTime: getSupplierOnTimePercent(supIds[1]),
    neverUsed: getSupplierOnTimePercent(supIds[3]),
    spend: getSupplierSpendThisYear(supIds[1]),
    openPOs: getSupplierOpenPOs(supIds[1]).length
  }), rule.supIds);
  check('a supplier with no delivery record returns null, not 0%',
    perf.neverUsed === null, perf.neverUsed);
  check('a supplier who delivered late scores 0% on time', perf.onTime === 0, perf.onTime);
  check('spend this year is real', perf.spend > 0, perf.spend);
  check('open POs are counted', perf.openPOs >= 1, perf.openPOs);

  console.log('\n— the signing route keeps CLAUDE.md\'s every-PO-needs-approval rule —');
  const route = await page.evaluate(() => ({
    small: poSigningRoute(500).map(r => r.who),
    large: poSigningRoute(9000).map(r => r.who)
  }));
  check('even a small PO routes through Operations — no auto-release step',
    route.small.includes('Operations releases') && !route.small.join(' ').includes('auto'), route.small);
  check('above the owner threshold the Owner counter-signs',
    route.large.includes('Owner counter-signs'), route.large);

  console.log('\n— the five dashboard queues and the KPIs —');
  const kpi = await page.evaluate(() => {
    const k = getPurchaseKPIs();
    return {
      k, cats: getPurchaseSpendByCategory().length,
      queues: { pr: purQueuePR().length, cmp: purQueueCMP().length, rel: purQueueREL().length, late: purQueueLATE().length, grn: purQueueGRN().length }
    };
  });
  check('every dashboard step has a real queue function', typeof kpi.queues.cmp === 'number' && typeof kpi.queues.grn === 'number', kpi.queues);
  check('open POs and committed value are real', kpi.k.openPOs > 0 && kpi.k.committed > 0, kpi.k);
  check('missing supplier invoices feed the KPI stack', typeof kpi.k.missingInvoices === 'number', kpi.k);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
