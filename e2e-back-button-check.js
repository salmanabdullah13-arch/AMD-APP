const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const SHOT_DIR = path.join(__dirname, 'e2e-shots-diag');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR);
for (const f of fs.readdirSync(SHOT_DIR)) fs.unlinkSync(path.join(SHOT_DIR, f));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  for (const d of ['1', '9', '9', '4']) { await page.click(`.num-btn[onclick="pt('${d}')"]`); await page.waitForTimeout(120); }
  await page.waitForSelector('#app', { state: 'visible' });
  await page.waitForTimeout(500);

  // ── Check 1: Operations page — bnav visibility + internal back button ──
  await page.evaluate(() => goTo('operations'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOT_DIR, '01-operations.png') });
  const opsInfo = await page.evaluate(() => {
    const bnav = document.querySelector('.bnav');
    const bnEco = document.getElementById('bn-eco');
    const backBtn = document.querySelector('#p-operations button[onclick="goTo(\'eco\')"]');
    const rectBnav = bnav ? bnav.getBoundingClientRect() : null;
    const csBack = backBtn ? getComputedStyle(backBtn) : null;
    const csBackParent = backBtn ? getComputedStyle(backBtn.parentElement) : null;
    return {
      bnavExists: !!bnav, bnavVisible: bnav ? getComputedStyle(bnav).display !== 'none' : false,
      bnavZIndex: bnav ? getComputedStyle(bnav).zIndex : null, bnavRect: rectBnav,
      bnEcoExists: !!bnEco,
      backBtnExists: !!backBtn,
      backBtnColor: csBack ? csBack.color : null,
      backBtnParentBg: csBackParent ? csBackParent.backgroundColor : null,
      backBtnBg: csBack ? csBack.backgroundColor : null
    };
  });
  console.log('OPERATIONS:', JSON.stringify(opsInfo, null, 2));

  // Try actually clicking bnav's eco button while on Operations
  try {
    await page.click('#bn-eco', { timeout: 2000 });
    await page.waitForTimeout(300);
    const activePage = await page.evaluate(() => document.querySelector('#scroll > .page.active')?.id);
    console.log('Clicking #bn-eco from Operations -> active page is now:', activePage);
    await page.screenshot({ path: path.join(SHOT_DIR, '02-after-bnav-eco-click.png') });
  } catch (e) { console.log('FAILED clicking #bn-eco from Operations:', e.message); }

  // Go back to operations and try the internal back button directly (even if "invisible")
  await page.evaluate(() => goTo('operations'));
  await page.waitForTimeout(300);
  try {
    await page.click('#p-operations button[onclick="goTo(\'eco\')"]', { timeout: 2000 });
    await page.waitForTimeout(300);
    const activePage2 = await page.evaluate(() => document.querySelector('#scroll > .page.active')?.id);
    console.log('Clicking internal Operations back button -> active page is now:', activePage2);
  } catch (e) { console.log('FAILED clicking internal Operations back button:', e.message); }

  // ── Check 2: each overlay module's own close button, opened via real launch() ──
  await page.evaluate(() => goTo('eco'));
  await page.waitForTimeout(300);
  const modules = [
    { id: 'sales', wrap: 'sales-module-wrap' },
    { id: 'accounts', wrap: 'accounts-module-wrap' },
    { id: 'purchasing', wrap: 'purch-module-wrap' },
    { id: 'storekeeper', wrap: 'sk-module-wrap' },
    { id: 'estimation', wrap: 'estimator-module-wrap' },
    { id: 'approvals', wrap: 'approver-module-wrap' },
    { id: 'delivery', wrap: 'jobs-module-wrap' },
    { id: 'hr', wrap: 'hr-module-wrap' },
    { id: 'curtain', wrap: 'curt-module-wrap' },
    { id: 'joinery', wrap: 'joinery-module-wrap' },
    { id: 'upholstery', wrap: 'upholstery-module-wrap' },
    { id: 'painting', wrap: 'painting-module-wrap' }
  ];
  for (const m of modules) {
    await page.evaluate((id) => {
      const mesh = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === id);
      if (mesh) mesh.userData.node.launch();
    }, m.id);
    await page.waitForSelector(`#${m.wrap}`, { state: 'visible', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(200);
    const closeSel = `#${m.wrap} button:has-text("×"), #${m.wrap} .icon-btn`;
    let clicked = false, err = null;
    try {
      await page.click(closeSel, { timeout: 2000 });
      clicked = true;
    } catch (e) { err = e.message; }
    await page.waitForTimeout(300);
    const state = await page.evaluate((wrap) => ({
      wrapHidden: getComputedStyle(document.getElementById(wrap)).display === 'none',
      ecoPageActive: document.getElementById('p-eco')?.classList.contains('active'),
      scrollVisible: getComputedStyle(document.getElementById('scroll')).display !== 'none'
    }), m.wrap);
    console.log(`${m.id}: clicked=${clicked} ${err ? '(' + err.split('\n')[0] + ')' : ''} ->`, JSON.stringify(state));
  }

  await browser.close();
})();
