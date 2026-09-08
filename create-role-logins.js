/**
 * create-role-logins.js — a real, working login for each role name that
 * already appears in the sign-in list.
 *
 * The roster (`allowed_identities`) carries thirteen real names, but only
 * four had an account behind them, so picking "Storekeeper" or "Operations
 * Manager" on the live site got you nowhere. The eighteen E2E fixtures that
 * DO cover those roles are deliberately hidden from real staff's dropdown
 * (auth.js filterRealIdentities), so they cannot fill the gap.
 *
 * Created the same way as the fixtures: through the REAL sign-up form, then
 * approved with SQL over the Management API — a fresh sign-up cannot approve
 * itself, and the Auth admin API needs a key that never leaves the dashboard.
 *
 *   SUPABASE_PAT=sbp_... node create-role-logins.js
 *
 * Idempotent: a name that already has an account is skipped.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const https = require('https');

const PAT = process.env.SUPABASE_PAT;
const PROJECT = 'rwbxycxrrslgxskoufxo';
const PASSWORD = '123456';        // Salman's call, 8 Sep 2026 — one password while he tests
const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';

/* name, user_type, designation — the names are the ones already in the
   roster, so nothing new appears in the dropdown; they simply start working. */
const LOGINS = [
  ['Storekeeper', 'storekeeper', 'Storekeeper'],
  ['Operations Manager', 'operations_manager', 'Operations Manager'],
  ['Joinery Production Manager', 'joinery_production_manager', 'Production Manager'],
  ['Upholstery Manager', 'upholstery_manager', 'Upholstery Manager'],
  ['Painting Lead / Work Supervisor', 'painting_lead', 'Work Supervisor'],
  ['HR', 'hr', 'HR & Payroll'],
  ['Arun Kumar', 'estimator', 'Estimator'],
  ['Karthik Silva', 'curtain_manager', 'Curtain & Blinds PM'],
  ['Silva', 'curtain_manager', 'Curtain & Blinds PM']
];

function sql(query) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com', path: '/v1/projects/' + PROJECT + '/database/query', method: 'POST',
      headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let o = ''; res.on('data', d => o += d); res.on('end', () => { try { resolve(JSON.parse(o)); } catch (e) { resolve(o); } }); });
    req.on('error', () => resolve(null));
    req.write(body); req.end();
  });
}

(async () => {
  if (!PAT) { console.error('SUPABASE_PAT is required (used only for the approval SQL).'); process.exit(1); }
  const existing = await sql('select display_name from profiles');
  const have = new Set((Array.isArray(existing) ? existing : []).map(r => r.display_name));

  const browser = await chromium.launch({ headless: true });
  const made = [];
  for (const [name, role, designation] of LOGINS) {
    if (have.has(name)) { console.log('  have  ' + name); continue; }
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    try {
      await page.goto(fileUrl);
      // The Sign Up tab has to be opened BEFORE its fields exist — waiting on
      // one of them first can never pass on a freshly loaded page.
      await page.waitForSelector('#auth-identity-select', { timeout: 15000 });
      await page.click('#cloud-login-body button:nth-of-type(2)');
      await page.waitForSelector('#auth-fullname-input', { state: 'visible', timeout: 10000 });
      await page.waitForFunction(() => { const s = document.getElementById('auth-usertype-select'); return s && s.options.length > 1; }, { timeout: 15000 });
      await page.fill('#auth-fullname-input', name);
      await page.fill('#auth-dob-input', '1990-03-12');
      await page.fill('#auth-phone-input', '3300' + String(Math.floor(Math.random() * 900000) + 100000));
      await page.fill('#auth-designation-input', designation);
      await page.selectOption('#auth-usertype-select', role);
      await page.fill('#auth-password-input', PASSWORD);
      await page.fill('#auth-password-confirm-input', PASSWORD);
      await page.click('#cloud-login-body button[onclick="handleSignUp()"]');
      await page.waitForFunction(() => /pending|approval|awaiting/i.test(document.getElementById('cloud-login-body') ? document.getElementById('cloud-login-body').textContent : ''), { timeout: 20000 });
      console.log('  made  ' + name);
      made.push([role, name]);
    } catch (e) {
      console.log('  FAIL  ' + name + ': ' + e.message.split('\n')[0]);
    }
    await page.close();
  }
  await browser.close();

  if (made.length) {
    const values = made.map(([role, name]) => "('" + role + "','" + name.replace(/'/g, "''") + "')").join(',');
    const r = await sql("update profiles set approval_status = 'approved', approved_by = 'create-role-logins', approved_date = now(), user_type = v.role from (values " + values + ") as v(role, name) where profiles.display_name = v.name");
    console.log('approved:', JSON.stringify(r).slice(0, 120));
  }

  const after = await sql("select a.display_name as name, coalesce((select p.user_type from profiles p where p.display_name = a.display_name limit 1),'-') as user_type, (select count(*) from profiles p where p.display_name = a.display_name)::int as account from allowed_identities a where a.display_name not ilike 'E2E %' order by 1");
  (Array.isArray(after) ? after : []).forEach(x => console.log((x.account ? '  ok   ' : '  NONE ') + x.name.padEnd(32) + x.user_type));
})();
