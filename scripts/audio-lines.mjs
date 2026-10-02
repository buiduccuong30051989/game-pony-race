// Gom MỌI dòng audio của game → scripts/audio/_all.gen.txt (key|giọng|câu), cho scripts/gen-audio.py sinh bằng edge-tts.
// Nguồn: src/lines.ts (thoại, ngân hàng, người nhà, bạn), src/letters.ts (tên chữ, chữ + từ ví dụ, câu hỏi chữ),
// src/numbers.ts (số, câu cộng / trừ / điền số), src/spell.ts + src/words.ts (token đánh vần của tiếng ghép).
// Dùng: node scripts/audio-lines.mjs [--check]   (--check: chỉ soát, không ghi file)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const L = await imp('src/lines.ts');
const { letterAudioLines, LETTERS } = await imp('src/letters.ts');
const { numberAudioLines } = await imp('src/numbers.ts');
const { spell } = await imp('src/spell.ts');
const { WORDS } = await imp('src/words.ts');

const out = new Map();
let bad = 0;
const add = (key, voice, text) => {
  if (!/^[a-z0-9_]+$/.test(key)) { bad++; console.error(`✗ khoá lạ: ${key}`); return; }
  if (!text || !text.trim()) { bad++; console.error(`✗ câu rỗng: ${key}`); return; }
  if (!L.VOICES[voice]) { bad++; console.error(`✗ giọng lạ "${voice}" ở ${key}`); return; }
  const vi = text.replace(/\{[^}]*\}/g, ' ');
  for (const n of L.EN_NAMES) {
    if (new RegExp(`(^|[^\\p{L}])${n}([^\\p{L}]|$)`, 'iu').test(vi)) { bad++; console.error(`✗ ${key}: tên tiếng Anh "${n}" nằm trong phần giọng Việt — viết {${n}}`); }
  }
  if (/[{}]/.test(vi) || (text.match(/\{/g) ?? []).length !== (text.match(/\}/g) ?? []).length) { bad++; console.error(`✗ ${key}: ngoặc {} lệch`); }
  const prev = out.get(key);
  if (prev && (prev[0] !== voice || prev[1] !== text)) { bad++; console.error(`✗ khoá ${key} trùng mà khác câu: "${prev[1]}" ≠ "${text}"`); return; }
  out.set(key, [voice, text]);
};

for (const [k, [v, t]] of Object.entries(L.LINES)) add(k, v, t);
for (const [bank, [v, list]] of Object.entries(L.BANK_TEXT)) list.forEach((t, i) => add(L.bankKey(bank, i), v, t));
for (const [id, m] of Object.entries(L.FAMILY_LINES)) for (const [k, t] of Object.entries(m)) add(L.familyKey(id, k), L.FAMILY_VOICE[id], t);
for (const [id, t] of Object.entries(L.FRIEND_THANKS)) add(L.thanksKey(id), 'friend', t);
for (const [k, t] of letterAudioLines()) add(k, 'my', t);
for (const [k, t] of numberAudioLines()) add(k, 'my', t);
for (const l of LETTERS) for (const [k, t] of spell(l.word).lines) add(k, 'my', t);
for (const [t, txt] of Object.entries(L.TONE_FIND)) add(L.toneFindKey(t), 'my', txt);
for (const [t, txt] of Object.entries(L.TONE_LABEL)) add(L.toneLabelKey(t), 'my', txt);
for (const w of Object.values(WORDS)) {
  const sp = spell(w.word);
  for (const [k, t] of sp.lines) add(k, 'my', t);
  add(L.spellKey(sp.id), 'my', L.SPELL_TEMPLATE.replace('{w}', w.word));
}

if (bad) { console.error(`audio-lines: ${bad} lỗi`); process.exit(1); }
if (!process.argv.includes('--check')) {
  mkdirSync(join(root, 'scripts/audio'), { recursive: true });
  const vo = Object.entries(L.VOICES).map(([k, v]) => `#voice ${k}|${v.voice}|${v.rate}|${v.pitch}|${v.en}|${v.enPitch}`);
  const lines = [...out].sort(([a], [b]) => a.localeCompare(b)).map(([k, [v, t]]) => `${k}|${v}|${t}`);
  writeFileSync(join(root, 'scripts/audio/_all.gen.txt'),
    ['# TỰ SINH bởi scripts/audio-lines.mjs – ĐỪNG SỬA TAY. Sửa câu trong src/lines.ts / letters.ts / numbers.ts / words.ts rồi `pnpm audio`.', ...vo, ...lines].join('\n') + '\n');
}
console.log(`audio-lines: ${out.size} dòng`);
