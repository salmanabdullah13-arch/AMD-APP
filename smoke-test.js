const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fileUrl = 'file://' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'smoke-test.png', fullPage: true });
  console.log('Title:', await page.title());
  await browser.close();
})();
