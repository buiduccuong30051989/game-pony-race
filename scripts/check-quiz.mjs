// Soát bộ sinh câu hỏi (src/quiz.ts) cho MỌI bài, nhiều hạt ngẫu nhiên: đủ lựa chọn, đáp án nằm trong lựa chọn, không trùng,
// số trong phạm vi bài, chữ đúng bể chữ của bài, không quá 2 câu cùng loại liền nhau, mọi khoá audio đều có câu để sinh,
// câu bé từng sai (weak) được chèn lại. Chạy đầu `pnpm build`: lỗi là build đỏ.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { makeQuiz } = await imp('src/quiz.ts');
const { LEVELS } = await imp('src/data.ts');
const { letterAudioLines } = await imp('src/letters.ts');
const { numberAudioLines } = await imp('src/numbers.ts');
const { spell } = await imp('src/spell.ts');
const { WORDS } = await imp('src/words.ts');
const L = await imp('src/lines.ts');

const known = new Set([...letterAudioLines(), ...numberAudioLines()].map(([k]) => k));
for (const w of Object.keys(WORDS)) { const sp = spell(w); for (const [k] of sp.lines) known.add(k); known.add(L.spellKey(sp.id)); }
for (const t of Object.keys(L.TONE_FIND)) known.add(L.toneFindKey(t));

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

let bad = 0, total = 0;
const fail = (lv, msg) => { if (bad < 40) console.error(`✗ ${lv}: ${msg}`); bad++; };
for (const lv of LEVELS) {
  const n = lv.mode === 'race' ? 2 : 3;
  const count = lv.mode === 'race' || lv.mode === 'chase' ? lv.questions : 16;
  for (let seed = 1; seed <= 150; seed++) {
    const weak = seed % 3 === 0 ? { 'L:ô': 2, 'A:2+3': 1, 'W:bà': 2, 'S:5-2': 2 } : {};
    const qs = makeQuiz(lv.quiz, count, n, weak, rng(seed * 97 + lv.seed));
    if (qs.length !== count) fail(lv.id, `ra ${qs.length} câu, cần ${count}`);
    for (let i = 2; i < qs.length; i++) {
      if (qs[i].kind === qs[i - 1].kind && qs[i].kind === qs[i - 2].kind && new Set(lv.quiz.kinds).size > 1) fail(lv.id, `3 câu "${qs[i].kind}" liền nhau (hạt ${seed})`);
    }
    for (const q of qs) {
      total++;
      for (const k of [...q.intro, ...q.learn, ...q.steps.map((s) => s.ask)]) if (!known.has(k)) fail(lv.id, `khoá audio "${k}" không có câu (${q.key})`);
      if (q.kind === 'word' && n < 3) fail(lv.id, `ghép tiếng ở ngã rẽ (${q.key})`);
      for (const s of q.steps) {
        if (s.choices.length !== n) fail(lv.id, `${q.key}: ${s.choices.length} lựa chọn, cần ${n}`);
        if (!s.choices.includes(s.answer)) fail(lv.id, `${q.key}: đáp án ${s.answer} không có trong lựa chọn`);
        if (new Set(s.choices).size !== s.choices.length) fail(lv.id, `${q.key}: lựa chọn trùng ${s.choices}`);
        if (/^[ASM]:/.test(q.key) && s.choices.some((c) => !/^\d+$/.test(c) || +c < 0 || +c > 10)) fail(lv.id, `${q.key}: số ngoài 0..10 ${s.choices}`);
      }
      const isWeak = Object.keys(weak).includes(q.key);
      if (q.kind === 'letter' && !isWeak && !lv.quiz.letters.includes(q.steps[0].answer)) fail(lv.id, `chữ ${q.steps[0].answer} ngoài bể chữ của bài`);
      const m = /^A:(\d+)\+(\d+)$/.exec(q.key);
      if (m && !isWeak && +m[1] + +m[2] > lv.quiz.maxN) fail(lv.id, `${q.key} vượt phạm vi ${lv.quiz.maxN}`);
    }
    if (seed % 3 === 0 && !qs.some((q) => q.key === 'L:ô' || q.key === 'S:5-2' || q.key === 'A:2+3')) fail(lv.id, `không chèn câu ôn (hạt ${seed})`);
  }
}
if (bad) { console.error(`\ncheck-quiz: ${bad} lỗi`); process.exit(1); }
console.log(`check-quiz: ✓ ${total} câu ở ${LEVELS.length} bài`);
