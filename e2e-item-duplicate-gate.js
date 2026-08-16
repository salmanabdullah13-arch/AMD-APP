// Verification for the item duplicate gate (design handoff 17a).
//
// The handoff is explicit that this must BLOCK, not warn: two codes for one
// item split the stock count, split the purchase history, and put two
// different "last rates" in front of the Estimator.
//
// So every check here drives the real data layer and asserts on real record
// state — never on rendered text. The scoring checks run against the REAL
// 200-item Q-Pro master already seeded in data.js, not a fixture, because
// the abbreviation map is only worth anything against real spellings.

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

  console.log('\n— normalisation —');
  const norm = await page.evaluate(() => ({
    abbrev: inorm('18mm VNR bookmatched sht').words,
    nums: inorm('Veneer 1.2 x 280 sheet').nums,
    punct: inorm('Veneer,  Oak / Natural-Grade').words,
    empty: inorm('   ').tokens.length
  }));
  check('abbreviations map to their canonical token',
    norm.abbrev.includes('veneer') && norm.abbrev.includes('bookmatch') && norm.abbrev.includes('sheet'), norm.abbrev);
  check('figures split out as numeric tokens, decimals kept whole',
    norm.nums.includes('1.2') && norm.nums.includes('280'), norm.nums);
  check('punctuation runs collapse without inventing tokens',
    norm.punct.includes('veneer') && norm.punct.includes('oak') && !norm.punct.some(w => w === ''), norm.punct);
  check('an empty description yields no tokens', norm.empty === 0, norm.empty);

  console.log('\n— scoring, per the handoff\'s own adjustment rules —');
  const sc = await page.evaluate(() => ({
    identical: iScore('Veneer Oak 18', 'Veneer Oak 18'),
    spelledDifferently: iScore('18 VNR Oak', 'Veneer Oak 18'),
    exactThreshold: ITEM_DUP_EXACT,
    sameWordsDiffFigures: iScore('Veneer Oak 18', 'Veneer Oak 25'),
    diffWordsSameFigures: iScore('Veneer Oak 18', 'Laminate Walnut 18'),
    unrelated: iScore('Veneer Oak 18', 'Spanner 14')
  }));
  check('identical words AND figures score exactly 1.0', sc.identical === 1, sc.identical);
  check('the same item spelled with abbreviations also scores 1.0',
    sc.spelledDifferently === 1, sc.spelledDifferently);
  check('same words, different figures is floored at 0.70 — a variant, not a duplicate',
    sc.sameWordsDiffFigures >= 0.70 && sc.sameWordsDiffFigures < sc.exactThreshold, sc.sameWordsDiffFigures);
  check('different words, identical figures takes the +0.10 nudge but stays low',
    sc.diffWordsSameFigures > 0 && sc.diffWordsSameFigures < 0.62, sc.diffWordsSameFigures);
  check('genuinely unrelated items score below the weak threshold',
    sc.unrelated < 0.34, sc.unrelated);

  console.log('\n— the four gate states —');
  const states = await page.evaluate(() => {
    // Anchor on a REAL seeded item so this exercises the live master.
    const real = itemMaster.find(i => /SPANNER/i.test(i.name));
    return {
      realName: real ? real.name : null,
      exact: itemGateState(real ? real.name : 'x').state,
      near: itemGateState('TOO090 SPANNER 15\'\'').state,
      clear: itemGateState('Zircon plasma widget QX9').state,
      clearCanCreate: itemGateState('Zircon plasma widget QX9').canCreate
    };
  });
  check('an exact match against a real master item reads "exact"', states.exact === 'exact', states);
  check('a close variant of a real item reads "near"', states.near === 'near', states);
  check('an unrelated description reads "clear" and can be created',
    states.clear === 'clear' && states.clearCanCreate === true, states);

  console.log('\n— exact duplicates cannot be created, and have no override —');
  const exact = await page.evaluate(() => {
    const real = itemMaster.find(i => /SPANNER/i.test(i.name));
    const before = itemMaster.length;
    const plain = createItemMasterEntry({ name: real.name, stockCategory: 'Workshop Tools & Accessories', unit: 'Nos' });
    // The key assertion: even DECLARING an override must not let it through.
    const forced = createItemMasterEntry({
      name: real.name, stockCategory: 'Workshop Tools & Accessories', unit: 'Nos',
      duplicateOverride: true, duplicateDifference: 'Different grade'
    });
    return { before, after: itemMaster.length, plainErr: plain.error, plainOf: plain.duplicateOf, forcedErr: forced.error };
  });
  check('creating an exact duplicate is refused', !!exact.plainErr, exact.plainErr);
  check('the refusal names the existing code, so there is a way forward',
    !!exact.plainOf && exact.plainErr.includes(exact.plainOf), exact);
  check('there is NO override for an exact duplicate — declaring one changes nothing',
    !!exact.forcedErr, exact.forcedErr);
  check('nothing was added to the master by either attempt', exact.after === exact.before, exact);

  console.log('\n— near matches need a stated difference —');
  const near = await page.evaluate(() => {
    const desc = 'TOO090 SPANNER 15\'\'';
    const bare = createItemMasterEntry({ name: desc, stockCategory: 'Workshop Tools & Accessories', unit: 'Nos' });
    const declaredOnly = createItemMasterEntry({
      name: desc, stockCategory: 'Workshop Tools & Accessories', unit: 'Nos', duplicateOverride: true
    });
    const proper = createItemMasterEntry({
      name: desc, stockCategory: 'Workshop Tools & Accessories', unit: 'Nos',
      duplicateOverride: true, duplicateDifference: 'Different size'
    });
    return {
      bareErr: bare.error, declaredOnlyErr: declaredOnly.error,
      created: !proper.error, id: proper.id, distinctFrom: proper.distinctFrom
    };
  });
  check('a near match is refused with no override', !!near.bareErr, near.bareErr);
  check('declaring "not a duplicate" without saying HOW is still refused',
    !!near.declaredOnlyErr, near.declaredOnlyErr);
  check('with a stated difference it is created', near.created === true, near);
  check('the stated difference is persisted on the new code, not discarded',
    !!near.distinctFrom && near.distinctFrom.difference === 'Different size' && !!near.distinctFrom.of, near.distinctFrom);

  console.log('\n— editing the description resets the declaration —');
  const reset = await page.evaluate(() => {
    let st = { desc: 'Veneer Oak 18', override: true, difference: 'Different grade' };
    const same = itemGateResetOnEdit(st, 'Veneer Oak 18');
    const edited = itemGateResetOnEdit(st, 'Veneer Oak 19');
    return { keptOnNoChange: same.override, clearedOnEdit: edited.override, clearedDiff: edited.difference };
  });
  check('an unchanged description keeps the declaration', reset.keptOnNoChange === true, reset);
  check('editing the description clears both the override and the difference',
    reset.clearedOnEdit === false && reset.clearedDiff === '', reset);

  console.log('\n— the seeding path is not blocked —');
  const seed = await page.evaluate(() => {
    const real = itemMaster.find(i => /SPANNER/i.test(i.name));
    // An explicit id is the import path — the real Q-Pro export carries
    // codes that already exist by definition and must not be gated.
    const r = createItemMasterEntry({ id: 'IT999001', name: real.name, stockCategory: 'Workshop Tools & Accessories', unit: 'Nos' });
    return { ok: !r.error, id: r.id };
  });
  check('an explicit-id import is allowed straight through', seed.ok === true, seed);

  console.log('\n— matches carry what the officer needs to decide —');
  const rows = await page.evaluate(() => {
    const real = itemMaster.find(i => /SPANNER/i.test(i.name));
    const m = iScored(real.name)[0];
    return { hasCode: !!m.id, hasUnit: !!m.unit, usesIsNumber: typeof m.bomUses === 'number', capped: iScored('veneer').length <= 3 };
  });
  check('every match row carries the code and unit', rows.hasCode && rows.hasUnit, rows);
  check('every match row carries a real BOM usage count', rows.usesIsNumber === true, rows);
  check('at most three matches are ever offered', rows.capped === true, rows);

  check('zero console/page errors', errors.length === 0, errors.slice(0, 3));

  console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
