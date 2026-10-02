// Chơi như NGƯỜI THẬT bằng CHẠM (không ?auto, có tiếng, viewport cảm ứng cỡ iPad): chạm chú ngựa bắt đầu, Twilight tự chạy;
// khi hiện "Chạm để bay!" thì chạm giữa màn hình; ở ngã rẽ chạm vào biển đúng (toạ độ chiếu từ 3D) — hoặc biển sai `WRONG`
// lần đầu để thử đường cụt. Đứng yên > 30 s = ĐƠ → exit 1.
// node scripts/test/play-human.mjs [bài=1-1]   (WRONG=1: chạm sai ngã rẽ đầu; MUTE=1: tắt tiếng)
import { pathToFileURL } from 'node:url';
const PW = process.env.PW ?? '/private/tmp/pw/node_modules/playwright-core';
const CHROME = process.env.CHROME ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const { chromium } = await import(pathToFileURL(`${PW}/index.mjs`).href);
const id = process.argv[2] ?? '1-1';
let wrongLeft = Number(process.env.WRONG ?? 0);
const W = 1180, H = 820;
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:5186/?level=${id}${process.env.MUTE ? '&mute=1' : ''}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#start-btn.ready', { timeout: 60000 });
await page.tap('#start-btn', { force: true });
const t0 = Date.now();
let flies = 0, turns = 0, wrongs = 0, last = '', lastChange = Date.now(), title = null;
while (Date.now() - t0 < 420000) {
  const st = await page.evaluate(() => {
    const g = window.__game; const l = g?.level;
    if (!l) return null;
    const ans = g.waiting?.split(':')[1];
    const signs = [...(l.junctions ?? []).flatMap((j) => j.signs), ...(l.gate?.signs ?? [])].filter((s) => !s.gone);
    const pos = (s) => s ? g.engine.toScreen(s.worldCenter()) : null;
    const right = signs.find((s) => (s.label || s.tone) === ans);
    const wrong = signs.find((s) => right && s !== right && Math.abs(s.root.position.distanceTo(right.root.position)) < 30);
    const v = (i) => { const e = document.getElementById(i); return e && !e.hidden; };
    return { s: l.player?.s ?? 0, w: g.waiting, right: pos(right), wrong: pos(wrong),
      fly: v('touch-hint') && document.getElementById('touch-hint-text').textContent.includes('bay'),
      title: v('result') ? document.getElementById('res-title').textContent : null };
  }).catch(() => null);
  if (!st) { await page.waitForTimeout(300); continue; }
  if (st.title) { title = st.title; break; }
  if (st.w && st.right) {
    await page.waitForTimeout(700);
    const p = wrongLeft > 0 && st.wrong ? st.wrong : st.right;
    if (p === st.wrong) { wrongLeft--; wrongs++; }
    await page.touchscreen.tap(p.x, p.y);
    turns++;
    await page.waitForTimeout(400);
  } else if (st.fly) {
    await page.waitForTimeout(500);
    await page.touchscreen.tap(W / 2, H * 0.45);
    flies++;
    await page.waitForTimeout(400);
  }
  const key = `${Math.floor(st.s)}|${st.w}`;
  if (key !== last) { last = key; lastChange = Date.now(); }
  if (Date.now() - lastChange > 30000) { errors.push(`ĐƠ ở ${key}`); await page.screenshot({ path: `/tmp/play-human-STUCK-${id}.png` }); break; }
  await page.waitForTimeout(150);
}
const ok = title && !errors.length;
console.log(`${ok ? '✓' : '✗'} ${id} chạm: ${title ?? 'KHÔNG XONG'} sau ${((Date.now() - t0) / 1000).toFixed(0)}s, chọn ${turns} (sai ${wrongs}), bay ${flies}${errors.length ? '\n  ' + errors.slice(0, 6).join('\n  ') : ''}`);
await browser.close();
process.exit(ok ? 0 : 1);
