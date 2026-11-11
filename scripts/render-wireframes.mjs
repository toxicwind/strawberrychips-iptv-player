// Render the wireframe panels and composite them into one image.
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('file:///tmp/iptv-wireframes.html');

  // Panel A: loading
  await page.locator('#loading').evaluate(el => el.style.display = 'flex');
  await page.locator('#browse, #player, #search').evaluateAll(els => els.forEach(el => el.style.display = 'none'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/wf-loading.png' });

  // Panel B: browse
  await page.locator('#browse').evaluate(el => el.style.display = 'block');
  await page.locator('#loading, #player, #search').evaluateAll(els => els.forEach(el => el.style.display = 'none'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/wf-browse.png' });

  // Panel C: player OSD
  await page.locator('#player').evaluate(el => el.style.display = 'block');
  await page.locator('#loading, #browse, #search').evaluateAll(els => els.forEach(el => el.style.display = 'none'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/wf-player.png' });

  // Panel D: search
  await page.locator('#search').evaluate(el => el.style.display = 'block');
  await page.locator('#loading, #browse, #player').evaluateAll(els => els.forEach(el => el.style.display = 'none'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/wf-search.png' });

  console.log('wireframes: /tmp/wf-loading.png /tmp/wf-browse.png /tmp/wf-player.png /tmp/wf-search.png');
} finally {
  await browser.close();
}