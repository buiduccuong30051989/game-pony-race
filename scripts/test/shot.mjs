// Chụp màn hình headless 1 bài (máy tự chạy + tự trả lời đúng): node scripts/test/shot.mjs 1-1 [giây...]
// Cần `pnpm dev` (cổng 5186) + playwright-core + chrome-headless-shell (đường dẫn qua PW / CHROME nếu khác máy).
import { pathToFileURL } from 'node:url';
const PW = process.env.PW ?? '/private/tmp/pw/node_modules/playwright-core';
const CHROME = process.env.CHROME ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const { chromium } = await import(pathToFileURL(`${PW}/index.mjs`).href);
const [lv = '1-1', ...times] = process.argv.slice(2);
const OUT = process.env.OUT ?? '/tmp';
const extra = process.env.Q ?? '';
const W = 1180, H = 820;
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
const t0 = Date.now();
await page.goto(`http://localhost:5186/?level=${lv}&auto=1&mute=1&perf=1${extra}`, { waitUntil: 'domcontentloaded' });
const ts = (times.length ? times : ['4', '9', '15']).map(Number);
for (const t of ts) {
  const wait = t * 1000 - (Date.now() - t0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const st = await page.evaluate(() => { const g = window.__game; const l = g?.level; return { phase: g?.phase, s: l?.player?.s?.toFixed(1), v: l?.player?.v?.toFixed(1), hearts: l?.hearts, gems: l?.gems, busy: l?.busy, perf: g?.perf(), waiting: g?.waiting }; });
  console.log(`t=${t}s`, JSON.stringify(st));
  await page.screenshot({ path: `${OUT}/shot-${lv}-${t}.png` });
}
console.log(errors.length ? errors.slice(0, 20).join('\n') : 'no errors');
await browser.close();
