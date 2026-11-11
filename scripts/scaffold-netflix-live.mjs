// Netflix-live scaffold: drives the REAL built app headless, transforms the
// channel view into the Netflix rail layout, and captures screenshots.
//   node scripts/scaffold-netflix-live.mjs
// Output: /tmp/netflix-loading.png, /tmp/netflix-rails.png
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const DIR = 'dist';
const PORT = 3210;
const MIME = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'application/javascript',
  '.json': 'application/json', '.m3u': 'application/x-mpegurl', '.m3u8': 'application/vnd.apple.mpegurl',
  '.mp4': 'video/mp4', '.png': 'image/png', '.svg': 'image/svg+xml', '.ts': 'video/mp2t',
  '.vtt': 'text/vtt', '.xml': 'application/xml',
};

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  const file = join(ROOT, DIR, pathname === '/' ? '/index.html' : pathname);
  try {
    const ext = extname(file);
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
await new Promise(r => server.listen(PORT, r));
const base = `http://localhost:${PORT}`;

// Demo M3U fixtures (same shape as the app's own screenshot harness).
const GROUPS = [
  ['News', 24, ['Metro One', 'Metro Two', 'Civic TV', 'Beacon TV', 'Globe News 24', 'Skyline News',
    'Vantage News', 'Continental 24', 'Northwind News', 'Ledger Business', 'Capital Markets TV']],
  ['Sports', 22, ['Apex Sports 1', 'Apex Sports 2', 'Tempo Sports', 'Stadium TV', 'Pitchside', 'Overtime']],
  ['Movies', 32, ['Grand Cinema', 'Silver Screen', 'Reel One', 'Noir Classics', 'Indie Reel', 'Big Screen']],
  ['Series', 28, ['Binge TV', 'Primetime', 'Drama Lab', 'The Box Set', 'Serial', 'Marathon TV']],
  ['Documentary', 18, ['Terra Docs', 'Wildlife One', 'Deep Dive', 'Chronicle', 'Wild Earth']],
  ['Kids', 14, ['Kids Planet', 'Toonbox', 'Doodle TV', 'Junior Plus']],
  ['Music', 18, ['PulseMusic', 'Vibe TV', 'Hitlist', 'Amplify']],
];
const CHANNELS = [];
{ let i = 0; for (const [group, count, leads] of GROUPS) for (let n = 0; n < count; n++, i++)
  CHANNELS.push({ id: `ch${i}`, name: n < leads.length ? leads[n] : `${group} ${n + 1}`, group }); }
const m3u = CHANNELS.map(ch =>
  `#EXTINF:-1 tvg-id="${ch.id}" group-title="${ch.group}",${ch.name}\nhttps://demo.local/stream/${ch.id}.m3u8`).join('\n');

const browser = await chromium.launch();
try {
  // ---- Shot 1: the loading state (cache miss path) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/get.php**', route => route.fulfill({ status: 200, contentType: 'application/x-mpegurl', body: m3u }));
    await page.addInitScript(() => {
      // Force the loading view visible with the progress bar (as loadData does on cache miss).
      const css = document.createElement('style');
      css.textContent = `
        .loading-progress { width: 400px; height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden; margin-top: 16px; }
        .loading-progress-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--accent), var(--accent-dim)); transition: width 0.3s ease; }
      `;
      document.head.appendChild(css);
    });
    await page.goto(base);
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const text = document.getElementById('loading-text');
      if (text) text.textContent = 'Loading channels… 1526 processed, 1526 kept';
      const bar = document.getElementById('loading-progress');
      const fill = document.getElementById('loading-progress-fill');
      if (bar) bar.style.display = 'block';
      if (fill) fill.style.width = '100%';
    });
    await page.screenshot({ path: '/tmp/netflix-loading.png' });
    console.log('  /tmp/netflix-loading.png');
    await ctx.close();
  }

  // ---- Shot 2: the Netflix rail view (transform live DOM) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/get.php**', route => route.fulfill({ status: 200, contentType: 'application/x-mpegurl', body: m3u }));
    await page.goto(base);
    // Wait for the channel list to render (the app auto-loads the M3U).
    await page.locator('.channel-view').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1500);

    // Transform: read groups + channels from the rendered DOM, build rails.
    await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll('.group-item')).map(g => ({
        name: g.querySelector('.group-name')?.textContent?.trim() || '?',
      }));
      const channels = Array.from(document.querySelectorAll('.channel-item')).map((el, idx) => ({
        name: el.querySelector('.channel-name')?.textContent?.trim() || '?',
        group: groups.find(g => g.name)?.name || 'Uncategorized',
        index: el.dataset.channelIndex || idx,
        logo: el.querySelector('.channel-logo')?.getAttribute('src') || '',
      }));
      // Group by the channel's actual group via PlaylistService if exposed, else fallback.
      // The DOM channel rows don't carry group; approximate by walking the sidebar groups.
      const byGroup = new Map();
      for (const ch of channels) {
        const g = ch.group;
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g).push(ch);
      }
      let html = '';
      for (const [gName, gChannels] of byGroup) {
        html += `<div class="live-rail">
          <div class="live-rail-header">
            <span class="live-rail-title">${gName}</span>
            <span class="live-rail-count">${gChannels.length} channels</span>
          </div>
          <div class="live-rail-track">`;
        for (const ch of gChannels.slice(0, 12)) {
          const initial = ch.name ? ch.name.charAt(0).toUpperCase() : '?';
          html += `<div class="live-channel-card" data-focusable data-channel-index="${ch.index}">
            <div class="live-card-poster">
              ${ch.logo ? `<img class="live-card-poster-bg" src="${ch.logo}" alt="">` : `<div class="live-card-poster-placeholder">${initial}</div>`}
              <span class="live-card-number">${Number(ch.index) + 1}</span>
            </div>
            <div class="live-card-info">
              <div class="live-card-name">${ch.name}</div>
            </div>
          </div>`;
        }
        html += '</div></div>';
      }
      const main = document.querySelector('.channel-main');
      if (main) {
        main.innerHTML = html;
        main.className = 'channel-main live-rails-container';
        main.style.padding = '0';
      }
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.style.display = 'none';
      const editHints = document.querySelector('.edit-hints');
      if (editHints) editHints.style.display = 'none';
      // Focus the first card so the ring shows.
      const first = document.querySelector('.live-channel-card');
      if (first) first.classList.add('focused');
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/netflix-rails.png' });
    console.log('  /tmp/netflix-rails.png');
    await ctx.close();
  }

  console.log('Done. Open /tmp/netflix-loading.png and /tmp/netflix-rails.png');
} finally {
  await browser.close();
  server.close();
}