// Chơi như NGƯỜI THẬT (không ?auto): chạm kỳ lân bắt đầu, GIỮ nút 🏇 bằng chuột (thả ra khi bảng câu hỏi hiện),
// bấm nút 🪽 khi nó sáng, bấm vào ngôi sao / biển đúng trên màn hình (toạ độ chiếu từ 3D). Có tiếng thật (không mute).
// Đứng yên > 30 s = ĐƠ → exit 1. node scripts/test/play-human.mjs [bài=1-1]   (cần `pnpm dev` cổng 5186)
import { pathToFileURL } from 'node:url';
const PW = process.env.PW ?? '/private/tmp/pw/node_modules/playwright-core';
const CHROME = process.env.CHROME ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const { chromium } = await import(pathToFileURL(`${PW}/index.mjs`).href);
const id = process.argv[2] ?? '1-1';
const W = 1180, H = 820;
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:5186/?level=${id}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#start-btn.ready', { timeout: 60000 });
await page.click('#start-btn', { force: true });
const run = await page.locator('#run-btn').boundingBox().catch(() => null);
const t0 = Date.now();
let holding = false, flies = 0, taps = 0, last = '', lastChange = Date.now(), title = null;
const hold = async (on) => {
  if (on === holding) return;
  const b = await page.locator('#run-btn').boundingBox();
  if (!b) return;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  if (on) await page.mouse.down(); else await page.mouse.up();
  holding = on;
};
while (Date.now() - t0 < 400000) {
  const st = await page.evaluate(() => {
    const g = window.__game; const l = g?.level;
    if (!l) return null;
    const v = (i) => { const e = document.getElementById(i); return e && !e.hidden; };
    const choices = (l.choices ?? []).filter((c) => !c.gone).map((c) => ({ label: c.label || c.tone, ...g.engine.toScreen(c.worldCenter()) }));
    return { started: l.started, s: l.player?.s ?? 0, w: g.waiting, choices, fly: document.getElementById('fly-btn').classList.contains('hint'), panel: v('panel'),
      title: v('result') ? document.getElementById('res-title').textContent : null, hearts: l.hearts, held: document.getElementById('run-btn').classList.contains('down') };
  }).catch(() => null);
  if (!st) { await page.waitForTimeout(300); continue; }
  if (st.title) { title = st.title; break; }
  if (st.w && st.choices.length) {
    // bé thả nút ra để chạm sao
    await hold(false);
    const ans = st.w.split(':')[1];
    const c = st.choices.find((x) => x.label === ans);
    if (c) { await page.waitForTimeout(600); await page.mouse.click(c.x, c.y); taps++; await page.waitForTimeout(400); }
  } else if (st.fly) {
    const b = await page.locator('#fly-btn').boundingBox();
    // bé nhấc tay khỏi nút chạy rồi chạm nút cánh (chuột chỉ có 1 "ngón"; iPad thì 2 ngón cùng lúc cũng được)
    if (b) { await hold(false); await page.waitForTimeout(500); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); flies++; await page.waitForTimeout(300); await hold(true); }
  } else if (st.started) await hold(true);
  const key = `${Math.floor(st.s)}|${st.w}`;
  if (key !== last) { last = key; lastChange = Date.now(); }
  if (Date.now() - lastChange > 30000) { errors.push(`ĐƠ ở ${key} (giữ=${st.held})`); await page.screenshot({ path: `/tmp/play-human-STUCK-${id}.png` }); break; }
  await page.waitForTimeout(150);
}
console.log(`${title && !errors.length ? '✓' : '✗'} ${id} người chơi: ${title ?? 'KHÔNG XONG'} sau ${((Date.now() - t0) / 1000).toFixed(0)}s, chạm sao ${taps}, bay ${flies}${errors.length ? '\n  ' + errors.slice(0, 6).join('\n  ') : ''}`);
void run;
await browser.close();
process.exit(title && !errors.length ? 0 : 1);
