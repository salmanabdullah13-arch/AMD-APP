// Verification for the exec-shell pilot (6 Aug 2026) — the template-based
// Owner/Admin shell: sidebar nav, light/dark theme toggle (persisted),
// reminders bell wired to REAL pending signals (with the task code
// visible), the My Tasks card, and the slide-in chat panel over the real
// messages system. All via real clicks, per house discipline.

const { chromium } = require('@playwright/test');
const path = require('path');

const results = [];
const consoleErrors = [];
const pageErrors = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== EXEC-SHELL PILOT VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
  console.log(`Console errors: ${consoleErrors.length}`); consoleErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
  console.log(`Page errors: ${pageErrors.length}`); pageErrors.forEach(e => console.log(`  [${e.step}] ${e.text}`));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push({ step: currentStep, text: msg.text() }); });
  page.on('pageerror', err => pageErrors.push({ step: currentStep, text: err.message }));
  page.on('dialog', async d => { await d.accept(); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForSelector('#app', { state: 'visible' });

  // Seed real signals for the identity the offline bypass uses.
  currentStep = 'seed';
  const seed = await page.evaluate(async () => {
    const me = window.cloudIdentity; // 'E2E Test User' in the offline bypass
    const t = createTask({ title: 'Chase Diyar snag list', assignee: me, dueDate: '2026-08-01' }); // overdue -> serious
    await sendMessage({ from: 'Karthik Silva', to: me, body: 'Track fabric for Villa 3 arrived.' });
    return { me, taskId: t.id };
  });

  currentStep = 'shell-renders';
  await page.evaluate(() => launchOwnerModule());
  await page.waitForSelector('#owner-module-wrap .xs-side', { state: 'visible', timeout: 5000 });
  const shell = await page.evaluate(() => ({
    hasSidebar: !!document.querySelector('#owner-module-wrap .xs-side'),
    hasTopbar: !!document.querySelector('#owner-module-wrap .xs-top'),
    // Redesign 4a replaced the pilot's .xs-tile stat band with the
    // handoff's own KPI buttons (.od-kpi) — four of them, each a drill-down.
    hasTiles: document.querySelectorAll('#owner-module-wrap .od-kpi').length >= 4,
    overviewActive: document.getElementById('xsnav-owner-overview')?.classList.contains('active'),
    hasTasksCard: (document.querySelector('#owner-module-wrap .xs-sidepanels')?.innerHTML || '').includes('My Tasks')
  }));
  record('Owner renders in the new shell (sidebar, topbar, stat tiles, tasks card)', Object.values(shell).every(Boolean) ? 'PASS' : 'FAIL', JSON.stringify(shell));

  // ── reminders: auto-alert on open + task code visible ──
  currentStep = 'reminders';
  await page.waitForTimeout(700); // auto-open fires at ~450ms when something is critical/serious
  const remState = await page.evaluate((s) => {
    const panel = document.querySelector('#owner-module-wrap .xs-panel');
    const badge = document.querySelector('#owner-module-wrap .xs-rem-badge');
    return {
      autoOpened: panel?.classList.contains('open'),
      badgeCount: badge ? Number(badge.textContent) : 0,
      panelHtml: panel ? panel.innerHTML : ''
    };
  }, seed);
  record('Reminders panel auto-opens on dashboard open (overdue task = serious)', remState.autoOpened ? 'PASS' : 'FAIL', `badge=${remState.badgeCount}`);
  record('Reminder shows the task with its task code', remState.panelHtml.includes(seed.taskId) && remState.panelHtml.includes('Chase Diyar snag list') ? 'PASS' : 'FAIL', seed.taskId);
  record('Bell badge counts the real signals', remState.badgeCount >= 2 ? 'PASS' : 'FAIL', `badge=${remState.badgeCount} (task + unread message)`);
  await page.evaluate(() => execToggleReminders(false));

  // ── theme toggle via real click, persisted ──
  currentStep = 'theme-toggle';
  await page.click('#owner-module-wrap button[onclick="execThemeToggle()"]');
  await page.waitForTimeout(250);
  const darkState = await page.evaluate(() => ({
    isDark: document.getElementById('owner-module-wrap').classList.contains('x-dark'),
    stored: localStorage.getItem('amd-exec-theme'),
    sideBg: getComputedStyle(document.querySelector('#owner-module-wrap .xs-side')).backgroundColor
  }));
  record('Theme toggle switches to dark and persists', darkState.isDark && darkState.stored === 'dark' && darkState.sideBg === 'rgb(29, 23, 33)' ? 'PASS' : 'FAIL', JSON.stringify(darkState));
  await page.click('#owner-module-wrap button[onclick="execThemeToggle()"]');
  await page.waitForTimeout(250);
  const lightState = await page.evaluate(() => ({
    isDark: document.getElementById('owner-module-wrap').classList.contains('x-dark'),
    stored: localStorage.getItem('amd-exec-theme')
  }));
  record('Toggling back returns to light', !lightState.isDark && lightState.stored === 'light' ? 'PASS' : 'FAIL', JSON.stringify(lightState));

  // ── chat: unread badge, roster, thread, real send, mark-read ──
  currentStep = 'chat';
  const chatBadge = await page.evaluate(() => Number(document.querySelector('#exec-chat-float .xs-chat-badge')?.textContent || 0));
  record('Chat badge shows the unread count', chatBadge === 1 ? 'PASS' : 'FAIL', `badge=${chatBadge}`);
  await page.click('#exec-chat-float .xs-chat-fab');
  await page.waitForTimeout(250);
  const roster = await page.evaluate(() => {
    const person = [...document.querySelectorAll('#exec-chat-float .xs-person')].find(p => p.textContent.includes('Karthik Silva'));
    return { hasRoster: document.querySelectorAll('#exec-chat-float .xs-person').length > 3, karthikUnread: person ? person.querySelector('.xs-unread')?.textContent : null };
  });
  record('Chat roster lists people with per-person unread counts', roster.hasRoster && roster.karthikUnread === '1' ? 'PASS' : 'FAIL', JSON.stringify(roster));
  await page.evaluate(() => {
    [...document.querySelectorAll('#exec-chat-float .xs-person')].find(p => p.textContent.includes('Karthik Silva'))?.click();
  });
  await page.waitForTimeout(400);
  const thread = await page.evaluate(() => document.querySelector('#exec-chat-float .xs-chat-body')?.innerHTML || '');
  record('Opening a thread shows the incoming message', thread.includes('Track fabric for Villa 3 arrived.') ? 'PASS' : 'FAIL');
  await page.fill('#exec-chat-float .xs-chat-compose input', 'Great — start tomorrow morning.');
  await page.click('#exec-chat-float .xs-chat-compose button');
  await page.waitForTimeout(300);
  const afterSend = await page.evaluate((s) => ({
    threadShowsReply: (document.querySelector('#exec-chat-float .xs-chat-body')?.innerHTML || '').includes('start tomorrow morning'),
    landedInData: messages.some(m => m.from === s.me && m.to === 'Karthik Silva' && m.body.includes('start tomorrow morning')),
    unreadNow: getUnreadCountFor(s.me)
  }), seed);
  record('Sending a reply lands in the thread AND the real messages data', afterSend.threadShowsReply && afterSend.landedInData ? 'PASS' : 'FAIL', JSON.stringify(afterSend));
  record('Opening the thread marked the incoming message read', afterSend.unreadNow === 0 ? 'PASS' : 'FAIL', `unread=${afterSend.unreadNow}`);
  await page.evaluate(() => execToggleChat(false));

  // ── tasks card: complete via real click ──
  currentStep = 'tasks-card';
  await page.evaluate(() => {
    [...document.querySelectorAll('#owner-module-wrap .xs-sidepanels button')].find(el => el.getAttribute('onclick')?.includes('execCompleteTask'))?.click();
  });
  await page.waitForTimeout(200);
  const taskDone = await page.evaluate((s) => tasks.find(t => t.id === s.taskId)?.status, seed);
  record('Completing a task from the card really completes it', taskDone === 'done' ? 'PASS' : 'FAIL', `status=${taskDone}`);

  // ── sidebar: hop to Admin via the real nav item ──
  currentStep = 'admin-shell';
  // Redesign 4a: Owner's Administration group reaches Admin via Users & roles.
  await page.evaluate(() => { document.querySelector('#owner-module-wrap #xsnav-m-users')?.click(); });
  await page.waitForSelector('#admin-module-wrap .xs-side', { state: 'visible', timeout: 5000 });
  const adminShell = await page.evaluate(() => ({
    ownerHidden: document.getElementById('owner-module-wrap').style.display === 'none',
    approvalsActive: document.getElementById('xsnav-admin-approvals')?.classList.contains('active'),
    sameTheme: !document.getElementById('admin-module-wrap').classList.contains('x-dark')
  }));
  record('Sidebar Admin item hops into the Admin shell (Approvals active, theme carried)', Object.values(adminShell).every(Boolean) ? 'PASS' : 'FAIL', JSON.stringify(adminShell));

  // ── mobile: sidebar collapses to a drawer ──
  currentStep = 'mobile-drawer';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const burgerVisible = await page.evaluate(() => {
    const b = document.querySelector('#admin-module-wrap .xs-burger');
    return b && getComputedStyle(b).display !== 'none';
  });
  record('Mobile viewport shows the burger button', burgerVisible ? 'PASS' : 'FAIL');
  await page.click('#admin-module-wrap .xs-burger');
  await page.waitForTimeout(300);
  const drawerOpen = await page.evaluate(() => document.querySelector('#admin-module-wrap .xs-side')?.classList.contains('open'));
  record('Burger opens the sidebar drawer', drawerOpen ? 'PASS' : 'FAIL');

  await browser.close();
  printReport();
  process.exit(results.filter(r => r.status === 'FAIL').length > 0 || pageErrors.length > 0 ? 1 : 0);
})();
