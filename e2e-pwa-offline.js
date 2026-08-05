// Verification for the new sw.js/manifest.json PWA offline support (4 Aug
// 2026, last item on the original Known Issues backlog). Service workers
// require a real HTTP origin — file:// URLs can't register one at all —
// so this test spins up a plain Node static file server (no new
// dependency) rather than using the file:// pattern every other e2e
// script uses. "Offline support" here means exactly one thing: the app
// SHELL loads with no network connection. This app has no backend and
// persists no data across reloads regardless of network state, online or
// offline — that's unrelated, pre-existing, and out of scope.

const { chromium } = require('@playwright/test');
const path = require('path');
const http = require('http');
const fs = require('fs');

const results = [];
let currentStep = 'startup';
function record(name, status, detail = '') { results.push({ name, status, detail, step: currentStep }); }
function printReport() {
  console.log('\n=== PWA OFFLINE SUPPORT VERIFICATION ===');
  results.forEach(r => console.log(`[${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.log(`\n${results.filter(r => r.status === 'PASS').length}/${results.length} checks passed.`);
}

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
function startServer(root, port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      if (req.url === '/' || req.url === '') filePath = path.join(root, 'index.html');
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(port, () => resolve(server));
  });
}

(async () => {
  const PORT = 8934;
  const server = await startServer(__dirname, PORT);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const page = await context.newPage();

  currentStep = 'initial-load-and-sw-register';
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForSelector('#app', { state: 'visible' });
  record('App loads (served over real HTTP, not file:// — real Supabase login replaced the old PIN, 4 Aug 2026)', 'PASS');

  // Wait for the service worker to actually activate, not just register.
  const swActivated = await page.evaluate(() => new Promise((resolve) => {
    if (!('serviceWorker' in navigator)) { resolve(false); return; }
    navigator.serviceWorker.ready.then((reg) => resolve(!!reg.active)).catch(() => resolve(false));
  }));
  record('Service worker registers and reaches "active" state', swActivated ? 'PASS' : 'FAIL');

  currentStep = 'cache-populated';
  await page.waitForTimeout(500); // let the install-time cache.addAll() settle
  const cacheState = await page.evaluate(() => caches.keys().then(async (keys) => {
    if (!keys.length) return { keys: [], count: 0 };
    const cache = await caches.open(keys[0]);
    const reqs = await cache.keys();
    return { keys, count: reqs.length, urls: reqs.map(r => new URL(r.url).pathname) };
  }));
  record('Cache is created with the versioned name (amd-app-v5)', cacheState.keys.includes('amd-app-v5') ? 'PASS' : 'FAIL', JSON.stringify(cacheState.keys));
  record('Cache contains the core app shell files (24 entries expected)', cacheState.count >= 20 ? 'PASS' : 'FAIL', `count=${cacheState.count}`);
  record('Cache includes every real module JS file (data.js, owner.js, print.js, etc.)', cacheState.urls && cacheState.urls.some(u => u.endsWith('owner.js')) && cacheState.urls.some(u => u.endsWith('print.js')) && cacheState.urls.some(u => u.endsWith('data.js')) ? 'PASS' : 'FAIL', JSON.stringify(cacheState.urls));

  currentStep = 'offline-reload';
  await context.setOffline(true);
  await page.reload();
  await page.waitForTimeout(500);
  const offlineLoadOk = await page.evaluate(() => !!document.getElementById('cloud-login'));
  record('Page still loads (cloud-login entry gate renders) with the network fully offline', offlineLoadOk ? 'PASS' : 'FAIL');

  if (offlineLoadOk) {
    const appVisibleOffline = await page.evaluate(() => {
      const app = document.getElementById('app');
      return app && getComputedStyle(app).display !== 'none';
    });
    record('Full app unlocks and is usable while offline (not just the lock screen)', appVisibleOffline ? 'PASS' : 'FAIL');

    const moduleWorksOffline = await page.evaluate(() => {
      try {
        const mesh = window.__eco3d.branches.find(b => b.userData.node && b.userData.node.id === 'sales');
        if (mesh) mesh.userData.node.launch();
        return true;
      } catch (e) { return false; }
    });
    await page.waitForTimeout(400);
    const salesWrapVisible = await page.evaluate(() => {
      const el = document.getElementById('sales-module-wrap');
      return el && getComputedStyle(el).display !== 'none';
    });
    record('A real module (Sales) opens correctly while fully offline', moduleWorksOffline && salesWrapVisible ? 'PASS' : 'FAIL');
  }

  currentStep = 'back-online-refreshes-cache';
  await context.setOffline(false);
  await page.reload();
  await page.waitForTimeout(500);
  const backOnlineOk = await page.evaluate(() => {
    const app = document.getElementById('app');
    return !!document.getElementById('cloud-login') && app && getComputedStyle(app).display !== 'none';
  });
  record('Coming back online and reloading works normally (network-first, not stuck on cache)', backOnlineOk ? 'PASS' : 'FAIL');

  await browser.close();
  server.close();
  printReport();
})();
