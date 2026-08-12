// Seeds 2-3 realistic quotations into the LIVE Supabase project, sitting at the
// Estimator stage so they show up in the Estimator's "Pending to pick" queue on
// a real login. For hands-on testing of the estimation flow — not an e2e suite,
// nothing here asserts.
//
// Deliberately built through the app's OWN functions against a real cloud
// session rather than hand-writing rows: the quotation `items` jsonb carries a
// nested BOM shape, department routing, group/sub-group serials and an audit
// log, and hand-writing that would drift from whatever the code actually
// expects. Driving createCustomer -> createEnquiry -> convertEnquiryToQuotation
// -> addQuotationItem -> transferQuotationStage means the shapes are correct by
// construction and every persist path is the real one.
//
// Every record is named "DEMO — ..." so it can be identified and removed later.
// Removal: delete the quotation rows, then their enquiries, then the customers
// (that order — job_cards/enquiries carry FKs).
//
//   node seed-demo-quotes.js

const { chromium } = require('@playwright/test');
const path = require('path');

const TEST_IDENTITY = 'E2E Test Account';
const TEST_PASSWORD = 'E2eFixedTestPassword1234!';

// Products chosen to exercise the routing rules an estimator actually hits:
// a painted joinery item (carp + paint), a motorized track (routes to curt
// since Metal Works was dropped, 6 Aug), and a sofa — which the systems audit
// found never suggests carp for its frame, so the department override has to be
// done by hand. That last one is a KNOWN gap, included on purpose.
const QUOTES = [
  {
    customer: 'DEMO — Ewan Residence (Villa 22)',
    contact: 'Mr. Yousif',
    tel: '39001122',
    division: 'Joinery',
    project: 'DEMO — Villa 22, Master Bedroom Joinery',
    items: [
      { group: 'Master Bedroom', subgroup: 'Wardrobes', product: 'Walk-in Wardrobe — 3 door', qty: 3, unit: 'Nos',
        description: 'Carcass in 18mm MDF, white melamine interior. Shutters in veneered MDF with PU matt finish. Soft-close hinges, aluminium handle profile. H 2400 x W 1200 x D 600mm.' },
      { group: 'Master Bedroom', subgroup: 'Wardrobes', product: 'Wardrobe Internal Drawer Unit', qty: 6, unit: 'Nos',
        description: '4-drawer stack, 16mm MDF sides, soft-close undermount runners. W 600 x D 500mm.' },
      { group: 'Master Bedroom', subgroup: 'Loose furniture', product: 'Painted TV Unit — wall hung', qty: 1, unit: 'Nos',
        description: 'MDF carcass, wall-hung on concealed brackets. 2-pack paint finish, RAL to be confirmed by client. W 2200 x H 450 x D 400mm.' },
      { group: 'Master Bedroom', subgroup: 'Loose furniture', product: 'Dressing Table with mirror', qty: 1, unit: 'Nos',
        description: 'Veneered MDF top and frame, 6mm bevelled mirror, LED strip to perimeter. W 1200 x D 500mm.' }
    ]
  },
  {
    customer: 'DEMO — Seef Business Tower',
    contact: 'Ms. Huda',
    tel: '39003344',
    division: 'Curtain & Blinds',
    project: 'DEMO — Seef Office, 4th Floor Window Treatments',
    items: [
      { group: 'Level 4', subgroup: 'Executive offices', product: 'Blackout Curtain — wave heading', qty: 12, unit: 'Nos',
        description: 'Wave heading at 80mm spacing, blackout lining, weighted hem. Fabric TBC from client selection. Track width 2400mm, drop 2700mm.' },
      { group: 'Level 4', subgroup: 'Executive offices', product: 'Sheer Curtain — wave heading', qty: 12, unit: 'Nos',
        description: 'Paired with blackout on a double track. Voile, wave heading to match.' },
      { group: 'Level 4', subgroup: 'Tracks', product: 'Motorized Track — 4m', qty: 4, unit: 'Nos',
        description: 'Motorised track with remote and wall switch. Supply and fix, power point by others.' },
      { group: 'Level 4', subgroup: 'Meeting rooms', product: 'Roller Blind — solar screen 3%', qty: 8, unit: 'Nos',
        description: 'Solar screen fabric, 3% openness, chain control left hand side unless noted. W 1800 x H 2400mm.' }
    ]
  },
  {
    customer: 'DEMO — Al Ghanem Majlis',
    contact: 'Mr. Khalid',
    tel: '39005566',
    division: 'Upholstery',
    project: 'DEMO — Majlis Refurbishment',
    items: [
      { group: 'Majlis', subgroup: 'Seating', product: 'Majlis Sofa — 3 seater, new frame + upholstery', qty: 6, unit: 'Nos',
        description: 'New hardwood frame, webbing base, HR foam 35 density, fabric TBC. NOTE: frame is joinery work — routing needs a Carpentry stop added by hand.' },
      { group: 'Majlis', subgroup: 'Seating', product: 'Reupholster existing armchairs', qty: 4, unit: 'Nos',
        description: 'Strip back to frame, replace foam and webbing, recover in client fabric.' },
      { group: 'Majlis', subgroup: 'Soft furnishing', product: 'Scatter Cushion Covers — 50x50', qty: 20, unit: 'Nos',
        description: 'Piped edge, concealed zip, feather inner supplied separately.' },
      { group: 'Majlis', subgroup: 'Joinery', product: 'Wooden Side Cabinet', qty: 2, unit: 'Nos',
        description: 'Veneered MDF, 2 door, adjustable shelf. W 900 x H 750 x D 450mm.' }
    ]
  }
];

async function signIn(page, fileUrl) {
  await page.goto(fileUrl);
  await page.waitForFunction(() => {
    const s = document.getElementById('auth-identity-select');
    return s && s.options.length > 1;
  }, { timeout: 15000 }).catch(() => null);
  await page.selectOption('#auth-identity-select', TEST_IDENTITY).catch(() => null);
  await page.fill('#auth-password-input', TEST_PASSWORD).catch(() => null);
  await page.click('#cloud-login-body button[onclick="handleSignIn()"]').catch(() => null);
  await page.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', { timeout: 20000 }).catch(() => null);
  return page.evaluate(() => getComputedStyle(document.getElementById('app')).display !== 'none');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', async d => { await d.accept(); });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';

  const inApp = await signIn(page, fileUrl);
  if (!inApp) { console.log('FAILED to sign in — nothing was seeded.'); await browser.close(); process.exit(1); }
  console.log('Signed in. Waiting for the cloud caches to hydrate...');
  await page.waitForTimeout(5000);

  const made = await page.evaluate(async (QUOTES) => {
    const out = [];
    // Each record here is a foreign key of the next. serializedPersist() only
    // orders repeat writes to the SAME record, so a customer and the enquiry
    // referencing it race — and the enquiry's insert losing that race is a hard
    // FK rejection, not a retry. A first run with no gaps landed 3 customers,
    // 1 of 3 enquiries and 0 quotations. A real person takes seconds between
    // these steps; a script takes none, so the script has to wait. Same call as
    // e2e-cloud-jobcards.js: fix the fixture, not the app.
    const gap = () => new Promise(r => setTimeout(r, 2000));

    for (const spec of QUOTES) {
      const cust = createCustomer({
        name: spec.customer, contactPerson: spec.contact, tel: spec.tel,
        address: 'Kingdom of Bahrain', creditDays: 30
      });
      if (cust.error) { out.push({ error: 'customer: ' + cust.error }); continue; }
      await gap();

      const enq = createEnquiry({
        division: spec.division, customerId: cust.id, contactPerson: spec.contact,
        tel: spec.tel, source: 'walk inn', salesPerson: 'Salman Abdullah',
        requirements: spec.project
      });
      if (enq.error) { out.push({ error: 'enquiry: ' + enq.error }); continue; }
      await gap();

      const qtn = convertEnquiryToQuotation(enq.id, {
        projectName: spec.project, taxPercent: 10, contactPerson: spec.contact
      });
      if (qtn.error) { out.push({ error: 'quotation: ' + qtn.error }); continue; }
      await gap();

      // Rate is deliberately never passed — the pricing lock zeroes it anyway,
      // and pricing is the Estimator's job. That's the point of the exercise.
      spec.items.forEach(it => addQuotationItem(qtn.id, it));
      await gap();

      transferQuotationStage(qtn.id, 'estimator', 'Salman Abdullah');
      await gap();

      const fresh = quotations.find(q => q.id === qtn.id);
      out.push({
        qtnId: qtn.id, customer: cust.id, enquiry: enq.id, project: spec.project,
        lines: fresh.items.length, stage: fresh.stage,
        routing: fresh.items.map(i => i.product + ' -> [' + (i.departmentSequence || []).join(', ') + ']')
      });
    }
    return out;
  }, QUOTES);

  console.log('\nSeeding the live project...');
  made.forEach(m => {
    if (m.error) { console.log('  ERROR ' + m.error); return; }
    console.log(`\n  ${m.qtnId}  ${m.project}`);
    console.log(`    customer ${m.customer} · enquiry ${m.enquiry} · ${m.lines} lines · stage "${m.stage}"`);
    m.routing.forEach(r => console.log('      ' + r));
  });

  console.log('\nWaiting for the background persists to land...');
  await page.waitForTimeout(9000);

  const confirmed = await page.evaluate(async (ids) => {
    const res = {};
    for (const id of ids) {
      const r = await sb.from('quotations').select('id,stage,lifecycle_status,items').eq('id', id).maybeSingle();
      res[id] = r.data ? { stage: r.data.stage, lifecycle: r.data.lifecycle_status, lines: (r.data.items || []).length } : { missing: r.error && r.error.message };
    }
    return res;
  }, made.filter(m => m.qtnId).map(m => m.qtnId));

  console.log('\nConfirmed on the live project:');
  Object.entries(confirmed).forEach(([id, v]) => console.log(`  ${id}  ${JSON.stringify(v)}`));
  if (pageErrors.length) { console.log('\nPage errors:'); pageErrors.forEach(e => console.log('  ' + e)); }

  await browser.close();
})();
