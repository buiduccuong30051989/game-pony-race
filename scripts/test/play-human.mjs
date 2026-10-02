// Chơi như NGƯỜI THẬT bằng BÀN PHÍM (không ?auto, có tiếng): Space bắt đầu, GIỮ ↑ để chạy, thả ↑ rồi nháy ↑ 2 lần khi
// phím ↑ sáng (chướng ngại), thả ↑ rồi bấm ← / → đúng biển ở ngã rẽ (hoặc sai `WRONG` lần đầu để thử đường cụt).
// Đứng yên > 30 s = ĐƠ → exit 1. node scripts/test/play-human.mjs [bài=1-1]   (WRONG=1: rẽ sai ngã rẽ đầu tiên)
import { pathToFileURL } from 'node:url';
const PW = process.env.PW ?? '/private/tmp/pw/node_modules/playwright-core';
const CHROME = process.env.CHROME ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const { chromium } = await import(pathToFileURL(`${PW}/index.mjs`).href);
const id = process.argv[2] ?? '1-1';
let wrongLeft = Number(process.env.WRONG ?? 0);
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:5186/?level=${id}${process.env.MUTE ? '&mute=1' : ''}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#start-btn.ready', { timeout: 60000 });
await page.keyboard.press('Space');
const t0 = Date.now();
let holding = false, flies = 0, turns = 0, wrongs = 0, last = '', lastChange = Date.now(), title = null;
const hold = async (on) => { if (on === holding) return; if (on) await page.keyboard.down('ArrowUp'); else await page.keyboard.up('ArrowUp'); holding = on; };
while (Date.now() - t0 < 420000) {
  const st = await page.evaluate(() => {
    const g = window.__game; const l = g?.level;
    if (!l) return null;
    const ans = g.waiting?.split(':')[1];
    // bên có biển đúng (ngã rẽ hoặc vòng mây)
    const signs = [...(l.junctions ?? []).flatMap((j) => j.signs), ...(l.gate?.signs ?? [])];
    const right = signs.find((s) => (s.label || s.tone) === ans && !s.gone);
    const v = (i) => { const e = document.getElementById(i); return e && !e.hidden; };
    return { started: l.started, s: l.player?.s ?? 0, w: g.waiting, side: right?.root.userData.side ?? 0, fly: document.getElementById('keys').className === 'fly',
      title: v('result') ? document.getElementById('res-title').textContent : null };
  }).catch(() => null);
  if (!st) { await page.waitForTimeout(300); continue; }
  if (st.title) { title = st.title; break; }
  if (st.w && st.side) {
    await hold(false);
    await page.waitForTimeout(700);
    const side = wrongLeft > 0 ? -st.side : st.side;
    if (wrongLeft > 0) { wrongLeft--; wrongs++; }
    await page.keyboard.press(side < 0 ? 'ArrowLeft' : 'ArrowRight');
    turns++;
    await page.waitForTimeout(300);
  } else if (st.fly) {
    await hold(false);
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(120);
    await page.keyboard.down('ArrowUp'); holding = true;
    flies++;
    await page.waitForTimeout(300);
  } else if (st.started) await hold(true);
  const key = `${Math.floor(st.s)}|${st.w}`;
  if (key !== last) { last = key; lastChange = Date.now(); }
  if (Date.now() - lastChange > 30000) { errors.push(`ĐƠ ở ${key}`); await page.screenshot({ path: `/tmp/play-human-STUCK-${id}.png` }); break; }
  await page.waitForTimeout(150);
}
const ok = title && !errors.length;
console.log(`${ok ? '✓' : '✗'} ${id} bàn phím: ${title ?? 'KHÔNG XONG'} sau ${((Date.now() - t0) / 1000).toFixed(0)}s, rẽ ${turns} (sai ${wrongs}), bay ${flies}${errors.length ? '\n  ' + errors.slice(0, 6).join('\n  ') : ''}`);
await browser.close();
process.exit(ok ? 0 : 1);
