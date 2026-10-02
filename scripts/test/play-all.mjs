// Chơi tự động từng bài tới khi ra màn kết quả (không đơ, không lỗi console). Cách trả lời:
//   right = luôn đúng (phải thắng) · wrong = luôn sai (phải thua sau 3 câu) · mixed = sai 1 câu đầu rồi đúng (phải thắng)
// node scripts/test/play-all.mjs [right|wrong|mixed] [bài...]   (cần `pnpm dev` cổng 5186)
import { pathToFileURL } from 'node:url';
const PW = process.env.PW ?? '/private/tmp/pw/node_modules/playwright-core';
const CHROME = process.env.CHROME ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const { chromium } = await import(pathToFileURL(`${PW}/index.mjs`).href);
const [how = 'right', ...ids] = process.argv.slice(2);
const levels = ids.length ? ids : ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2', '4-1', '4-2', 'final'];
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
let failed = 0;
async function one(id) {
  const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:5186/?level=${id}&auto=1&mute=1&noanswer=1`, { waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  let answered = 0, last = '', lastChange = Date.now(), res = null, minFps = 999;
  while (Date.now() - t0 < 300000) {
    const st = await page.evaluate(() => {
      const g = window.__game; if (!g) return null;
      const l = g.level;
      return { phase: g.phase, w: g.waiting, s: l?.player?.s ?? 0, hearts: l?.hearts, title: document.getElementById('result').hidden ? null : document.getElementById('res-title').textContent, fps: g.perf().fps };
    }).catch(() => null);
    if (!st) { await new Promise((r) => setTimeout(r, 300)); continue; }
    if (st.fps > 0 && Date.now() - t0 > 8000) minFps = Math.min(minFps, st.fps);
    if (st.title) { res = st; break; }
    if (st.w) {
      const ok = how === 'right' || (how === 'mixed' && answered > 0);
      await page.waitForTimeout(250);
      await page.evaluate((ok) => window.__game.answer(ok), ok);
      answered++;
    }
    const key = `${Math.floor(st.s)}|${st.w}|${st.hearts}`;
    if (key !== last) { last = key; lastChange = Date.now(); }
    if (Date.now() - lastChange > 30000) { errors.push(`ĐƠ ở ${key}`); break; }
    await page.waitForTimeout(200);
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const want = how === 'wrong' ? 'Suýt nữa thôi!' : null;
  const ok = res && (want ? res.title === want : res.title !== 'Suýt nữa thôi!') && !errors.length;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${id.padEnd(5)} ${how}: ${res ? `"${res.title}"` : 'KHÔNG XONG'} sau ${secs}s, ${answered} câu, tim còn ${res?.hearts}, fps thấp nhất ${minFps}${errors.length ? '\n   ' + errors.slice(0, 5).join('\n   ') : ''}`);
  await page.close();
}
const par = Number(process.env.PAR ?? 3);
for (let i = 0; i < levels.length; i += par) await Promise.all(levels.slice(i, i + par).map(one));
await browser.close();
process.exit(failed ? 1 : 0);
