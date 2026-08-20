/**
 * e2e-manage-quote.js — Manage Quote record page (10b / 12a), 9 Aug 2026.
 * Written against the package's own six behaviour items and §5–§8.
 */
const { chromium } = require('@playwright/test');
const path = require('path');

// Local calendar dates, matching the app (data.js localISO/todayISO). A test
// that computes an expected date through toISOString() disagrees with the app
// between local midnight and 03:00 in UTC+3 — a flake that only appears at
// night. Node-side copy: inside page.evaluate() the app's own global resolves.
const localISO = (d) => { const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
const todayISO = () => localISO(new Date());

let pass = 0, fail = 0;
const check = (name, ok, extra) => {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept('client asked us to hold it for another week'));

  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  const seed = await page.evaluate(() => {
    const c = createCustomer({ name: 'Ewan Properties', contactPerson: 'Mr Ali', tel: '39887766', address: 'Riffa' });
    const e = createEnquiry({ division: 'Joinery', customerId: c.id, contactPerson: 'Mr Ali', tel: c.tel,
      source: 'walk inn', salesPerson: 'Silva' });
    const q = convertEnquiryToQuotation(e.id, { projectName: 'Ewan Villas — Phase 2' });
    [['Bedroom', 'Master', 'Wardrobe carcass', 6], ['Bedroom', 'Master', 'Headboard', 2],
     ['Living', 'Majlis', 'TV unit', 1]].forEach(([g, sg, pr, qty]) =>
      addQuotationItem(q.id, { product: pr, qty, unit: 'Nos', vatPercent: 10, group: g, subgroup: sg, description: 'Oak veneer' }));
    q.items.forEach(it => { addBOMMaterial(q.id, it.lineId, { name: 'Ply', qty: 4, unit: 'Nos', rate: 25 });
      submitItemBOM(q.id, it.lineId, 'Arun Kumar A'); });
    transferQuotationStage(q.id, 'approver', 'Estimator');
    approveQuotation(q.id, 'Salman Abdullah');
    launchSalesModule(); openQuotationHub(q.id);
    return { qtnId: q.id, enqId: e.id };
  });
  check('seeded an approved 3-line quote across 2 groups', !!seed.qtnId, seed);

  console.log('\n— the six behaviour items —');
  const page1 = await page.evaluate(() => {
    const b = document.getElementById('sales-body');
    const t = b.textContent;
    return {
      deadTiles: /not implemented yet|apply from the Product/.test(t),
      // Count what is VISIBLE — the phone bottom bar's CTA is in the DOM at
      // desktop width too, hidden by CSS rather than by a second render pass.
      filledControls: [...b.querySelectorAll('.qh-cta:not(.is-off)')]
        .filter(el => getComputedStyle(el).display !== 'none' &&
                      getComputedStyle(el.parentElement).display !== 'none').length,
      pills: [...b.querySelectorAll('.qh-actions .qh-pill')].map(x => x.textContent.trim()),
      absenceCards: /File Manager|No Invoice List Exist/.test(t),
      linkedStrip: /Linked & attached/.test(t),
      backLink: /Back to Quotation List/.test(t),
      netTotal: (b.querySelector('.qh-net') || {}).textContent,
      moneyMentions: (t.match(/BD /g) || []).length
    };
  });
  check('1. the two dead-end tiles are gone', !page1.deadTiles, page1);
  check('2. Confirm is the only filled control; the rest are outlined pills',
    page1.filledControls === 1 && page1.pills.length === 4, page1);
  check('3. the absence-only cards collapse into one Linked & attached strip',
    !page1.absenceCards && page1.linkedStrip, page1);
  check('the money appears once, large', /^BD [\d,]+\.\d{3}$/.test(page1.netTotal || ''), page1);
  check('the third way back is gone', !page1.backLink, page1);

  // 6. quantities 2 dp, money 3 dp
  const dp = await page.evaluate(() => {
    qhSetTab('items');
    const b = document.getElementById('sales-body');
    const qtys = [...b.querySelectorAll('.qh-table tbody tr.qh-row td:nth-child(3)')].map(x => x.textContent.trim());
    const nets = [...b.querySelectorAll('.qh-table tbody tr.qh-row td:nth-child(6)')].map(x => x.textContent.trim());
    return { qtys, nets };
  });
  check('6. quantities print at 2 dp, money at 3',
    dp.qtys.every(x => /^\d+\.\d{2} \w+$/.test(x)) && dp.nets.every(x => /^BD [\d,]+\.\d{3}$/.test(x)), dp);

  console.log('\n— §5 the 300-line quote —');
  const items = await page.evaluate(() => {
    const b = document.getElementById('sales-body');
    const before = b.querySelectorAll('.qh-row').length;
    qhAllGroups(false);
    const closed = document.getElementById('sales-body').querySelectorAll('.qh-row').length;
    const bands = document.getElementById('sales-body').querySelectorAll('.qh-band').length;
    qhAllGroups(true);
    const reopened = document.getElementById('sales-body').querySelectorAll('.qh-row').length;
    return { before, closed, bands, reopened,
      railButtons: document.getElementById('sales-body').querySelectorAll('.qh-rail-b').length,
      photosOff: !document.getElementById('sales-body').querySelector('.qh-ph') };
  });
  check('a closed group renders ONE row — the lines are skipped, not hidden',
    items.closed === 0 && items.bands === 2 && items.reopened === items.before, items);
  check('the group index rail has one button per group', items.railButtons === 2, items);
  check('photos are not fetched until asked for', items.photosOff, items);

  const photos = await page.evaluate(() => {
    qhTogglePhotos();
    const b = document.getElementById('sales-body');
    const cells = [...b.querySelectorAll('.qh-ph')];
    // Measure BEFORE toggling back — qhTogglePhotos() re-renders, which detaches
    // these nodes and makes getComputedStyle return nothing useful.
    const out = { count: cells.length,
      fixed: cells.every(c => getComputedStyle(c).width === '66px' && getComputedStyle(c).height === '50px') };
    qhTogglePhotos();
    return out;
  });
  check('turning photos on gives fixed-size cells so row heights stay predictable',
    photos.count === 3 && photos.fixed, photos);

  const density = await page.evaluate(() => {
    qhSetDensity('compact');
    const spec = document.getElementById('sales-body').querySelectorAll('.qh-spec').length;
    qhSetDensity('full');
    const specFull = document.getElementById('sales-body').querySelectorAll('.qh-spec').length;
    return { spec, specFull };
  });
  check('Compact drops the spec line', density.spec === 0 && density.specFull === 3, density);

  const shared = await page.evaluate(() => {
    const q = quotations.find(x => x.id === salesActiveQtnId);
    const screenGroups = qhGroupsOf(q).map(g => g.name);
    const printGroups = [...new Set(computeQuoteHierarchy(q.items).map(r => r.item.group))];
    return { screenGroups, printGroups };
  });
  check('5. screen and paper share ONE hierarchy',
    JSON.stringify(shared.screenGroups) === JSON.stringify(shared.printGroups), shared);

  console.log('\n— §7 validity and auto-close —');
  const validity = await page.evaluate(id => {
    const q = quotations.find(x => x.id === id);
    const derived = quoteValidUntil(q);
    // clause 4 promises 5 days from the quote date
    const expected = addDaysISO(q.date, 5);
    q.validUntil = addDaysISO(todayISO(), -1);   // yesterday
    const expiredNow = quoteIsExpired(q);
    const closedIds = expireDueQuotations();
    const after = quotations.find(x => x.id === id);
    const audit = (after.auditLog || []).some(a => a.action === 'Auto-close on expiry' && a.user === 'system');
    const inOpenList = quotations.filter(x => x.lifecycleStatus === 'open').some(x => x.id === id);
    return { derived, expected, expiredNow, closed: closedIds.includes(id),
      status: after.lifecycleStatus, audit, inOpenList, canReinstate: quoteCanReinstate(after) };
  }, seed.qtnId);
  check('validity derives from clause 4\'s five days', validity.derived === validity.expected, validity);
  check('the scheduled job really closes it — a state change, not a filter',
    validity.expiredNow && validity.closed && validity.status === 'closed' && !validity.inOpenList, validity);
  check('and writes an audit row attributed to system', validity.audit, validity);

  const back = await page.evaluate(id => {
    const q = quotations.find(x => x.id === id);
    const reinstated = reinstateQuotation(id, 'Silva');
    const okNow = !reinstated.error && q.lifecycleStatus === 'open';
    // a quote closed long ago must NOT come back at old prices
    q.lifecycleStatus = 'closed'; q.closedDate = addDaysISO(todayISO(), -60);
    const refused = reinstateQuotation(id, 'Silva');
    q.lifecycleStatus = 'open'; q.closedDate = null;
    return { okNow, refused: !!(refused && refused.error), msg: refused && refused.error };
  }, seed.qtnId);
  check('Reinstate works inside 30 days', back.okNow, back);
  check('and is refused beyond it — no silent switch-on at old prices',
    back.refused && /30 days/.test(back.msg || ''), back);

  const extend = await page.evaluate(id => {
    const before = quoteValidUntil(quotations.find(x => x.id === id));
    const res = extendQuotationValidity(id, 7, 'Silva');
    return { before, after: res.validUntil, logged: (res.auditLog || []).some(a => /Validity extended/.test(a.action)) };
  }, seed.qtnId);
  check('Extend 7 days re-dates the quote and logs it',
    extend.after > extend.before && extend.logged, extend);

  console.log('\n— §6 revisions —');
  const revs = await page.evaluate(id => {
    const rev = raiseQuotationRevision(id, 'Silva');
    const src = quotations.find(x => x.id === id);
    const fam = quoteFamily(id);
    return {
      newId: rev.id, newRev: rev.rev, sameBase: quoteBaseId(rev.id) === quoteBaseId(id),
      srcSuperseded: src.supersededBy === rev.id,
      srcStillPrintable: !!quotations.find(x => x.id === id),
      audit: (rev.auditLog || []).some(a => /Revision 1 raised from rev 0/.test(a.action)),
      family: fam.length, lines: (rev.items || []).length
    };
  }, seed.qtnId);
  check('a revision keeps the base id and takes the next suffix',
    revs.sameBase && revs.newRev === 1 && /-1$/.test(revs.newId), revs);
  check('the earlier revision is superseded, not deleted — it stays printable',
    revs.srcSuperseded && revs.srcStillPrintable && revs.family === 2, revs);
  check('and the audit reads "Revision 1 raised from rev 0"', revs.audit, revs);
  check('the lines carry across', revs.lines === 3, revs);

  // The collision the package's id scheme would otherwise have caused.
  const collision = await page.evaluate(id => {
    const rev = quotations.find(q => quoteBaseId(q.id) === quoteBaseId(id) && q.rev === 1);
    rev.lifecycleStatus = 'open'; rev.stage = 'sales';
    const job = confirmQuotationToJobCard(rev.id, 'Silva');
    if (job.error) return { err: job.error };
    const v = createVariationForJob(job.id, 'extra shelf');
    return { variationId: v.id, clash: !!quotations.filter(q => q.id === v.id).length &&
      quotations.filter(q => q.id === v.id).length > 1 };
  }, seed.qtnId);
  check('a variation cannot take an id a revision already holds',
    !collision.err && /-2$/.test(collision.variationId || '') && !collision.clash, collision);

  console.log('\n— §8 follow-ups belong to the enquiry —');
  const fu = await page.evaluate(ids => {
    const before = (enquiries.find(e => e.id === ids.enqId).followUps || []).length;
    const res = addFollowUp(ids.enqId, { date: todayISO(),
      meetingType: 'Call', outcome: 'Interested', notes: 'Client asked for a revised layout.' });
    const after = (enquiries.find(e => e.id === ids.enqId).followUps || []).length;
    const short = addFollowUp(ids.enqId, { date: '2026-08-09', meetingType: 'Call', outcome: 'x', notes: 'too short' });
    return { grew: after === before + 1, ok: !res.error, shortRefused: !!(short && short.error),
      noLocalStore: !quotations.some(q => q.followUps) };
  }, seed);
  check('Log follow-up writes through addFollowUp() on the enquiry',
    fu.ok && fu.grew && fu.noLocalStore, fu);
  check('and the 10-character note rule still holds', fu.shortRefused, fu);

  console.log('\n— shell and phone —');
  const shell = await page.evaluate(() => {
    const wrap = document.getElementById('sales-module-wrap');
    return {
      back: !!wrap.querySelector('.xs-back'),
      quickRow: !!wrap.querySelector('.xs-toprow .xs-qa'),
      chat: !!document.querySelector('#exec-chat-float, .xs-chat-fab'),
      planner: !!document.getElementById('exec-planner'),
      thisQuote: [...wrap.querySelectorAll('.xs-navlabel')].some(l => l.textContent === 'This quote')
    };
  });
  check('the six non-negotiables survive, and the sidebar gains This quote',
    shell.back && shell.quickRow && shell.chat && shell.planner && shell.thisQuote, shell);

  const phone = await page.setViewportSize({ width: 390, height: 844 })
    .then(() => page.waitForTimeout(300))
    .then(() => page.evaluate(() => {
      const bar = document.querySelector('#sales-body .qh-bottom');
      const cs = bar ? getComputedStyle(bar) : null;
      const cta = bar && bar.querySelector('.qh-cta');
      return {
        visible: cs && cs.display === 'flex',
        fixed: cs && cs.position === 'fixed',
        ctaTall: cta ? cta.getBoundingClientRect().height >= 44 : false,
        moreBtn: !!(bar && bar.querySelector('.qh-pill'))
      };
    }));
  check('phone gets a fixed bottom bar with the primary action under the thumb',
    phone.visible && phone.fixed && phone.ctaTall && phone.moreBtn, phone);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
