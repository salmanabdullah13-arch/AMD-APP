/**
 * create-role-fixtures.js — one live fixture login per role, for the
 * end-to-end run (2–3 Sep 2026).
 *
 * The run signs in as the real role that does each step, so every gate is
 * exercised as the person it applies to. Three fixtures already existed
 * (E2E Test Account = sales, E2E Approver Account = owner, E2E Joinery
 * Account = joinery_production_manager); this creates the rest through the
 * REAL sign-up form and then approves them with SQL over the Management API
 * — a fresh sign-up cannot approve itself, and the Auth admin API needs a
 * key that never leaves the dashboard.
 *
 *   SUPABASE_PAT=sbp_... node create-role-fixtures.js
 *
 * Idempotent: a role whose fixture already exists is skipped. Names carry
 * the "E2E " prefix, which auth.js hides from real staff's sign-in roster.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const https = require('https');

const REF = 'rwbxycxrrslgxskoufxo';
const PAT = process.env.SUPABASE_PAT;
const PASSWORD = 'E2eFixedTestPassword1234!';   // the same constant every live suite uses
const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/') + '?test_cloud_login=1';

const ROLES = [
  ['estimator', 'E2E Estimator Account', 'Estimator'],
  ['approver', 'E2E Approver Role Account', 'Approver'],
  ['operations_manager', 'E2E Operations Account', 'Operations Manager'],
  ['purchaser', 'E2E Purchaser Account', 'Purchaser'],
  ['storekeeper', 'E2E Storekeeper Account', 'Storekeeper'],
  ['accounts', 'E2E Accounts Account', 'Accounts'],
  ['hr', 'E2E HR Account', 'HR'],
  ['upholstery_manager', 'E2E Upholstery Account', 'Upholstery Supervisor'],
  ['upholstery_team_leader', 'E2E Upholstery TL Account', 'Team Leader'],
  ['painting_lead', 'E2E Painting Account', 'Painting Lead'],
  ['curtain_manager', 'E2E Curtain Account', 'Curtain Manager'],
  ['curtain_site_installer', 'E2E Curtain Installer Account', 'Site Installer'],
  ['installation_crew_lead', 'E2E Install Lead Account', 'Installation Crew Lead'],
  ['delivery_scheduling', 'E2E Delivery Account', 'Delivery / Scheduling'],
  ['admin', 'E2E Admin Account', 'Admin']
];

function sql(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({ hostname: 'api.supabase.com', path: '/v1/projects/' + REF + '/database/query', method: 'POST',
      headers: { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(d); } }); });
    req.on('error', reject); req.write(body); req.end();
  });
}

(async () => {
  if (!PAT) { console.error('SUPABASE_PAT is required (used only for the approval SQL).'); process.exit(1); }
  const existing = await sql("select display_name, user_type, approval_status from profiles where display_name like 'E2E %'");
  const have = new Set((Array.isArray(existing) ? existing : []).map(r => r.display_name));
  const browser = await chromium.launch({ headless: true });
  const made = [];
  for (const [role, name, designation] of ROLES) {
    if (have.has(name)) { console.log('  have  ' + name); continue; }
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    try {
      await page.goto(fileUrl);
      await page.waitForFunction(() => { const s = document.getElementById('auth-usertype-select'); return s && s.options.length > 1; }, { timeout: 15000 }).catch(() => null);
      await page.click('#cloud-login-body button:nth-of-type(2)');
      await page.waitForSelector('#auth-fullname-input', { state: 'visible', timeout: 10000 });
      await page.fill('#auth-fullname-input', name);
      await page.fill('#auth-dob-input', '1990-03-12');
      await page.fill('#auth-phone-input', '3300' + String(Math.floor(Math.random() * 900000) + 100000));
      await page.fill('#auth-designation-input', designation);
      await page.selectOption('#auth-usertype-select', role);
      await page.fill('#auth-password-input', PASSWORD);
      await page.fill('#auth-password-confirm-input', PASSWORD);
      await page.click('#cloud-login-body button[onclick="handleSignUp()"]');
      await page.waitForFunction(() => /pending|approval|awaiting/i.test(document.getElementById('cloud-login-body')?.textContent || ''), { timeout: 20000 }).catch(() => null);
      const state = await page.evaluate(() => (document.getElementById('cloud-login-body') || {}).textContent.slice(0, 120));
      console.log('  made  ' + name + ' → ' + state.replace(/\s+/g, ' ').trim());
      made.push([role, name]);
    } catch (e) {
      console.log('  FAIL  ' + name + ': ' + e.message.split('\n')[0]);
    }
    await page.close();
  }
  await browser.close();
  if (made.length) {
    const r = await sql("update profiles set approval_status = 'approved', approved_by = 'create-role-fixtures', approved_date = now(), user_type = v.role from (values " +
      made.map(([role, name]) => "('" + role + "','" + name.replace(/'/g, "''") + "')").join(',') + ") as v(role, name) where profiles.display_name = v.name");
    console.log('approved', JSON.stringify(r).slice(0, 120));
  }
  const after = await sql("select display_name, user_type, approval_status from profiles where display_name like 'E2E %' and display_name not like '%Throwaway%' order by user_type");
  console.log(JSON.stringify(after, null, 1));
})();
