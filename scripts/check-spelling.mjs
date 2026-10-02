// Bảng vàng đánh vần: so chuỗi token (CHỮ đọc ra) của src/spell.ts với đáp án viết tay theo SGK Tiếng Việt 1.
// Chạy đầu `pnpm build`: lệch 1 token là build đỏ. Thêm từ mới vào GOLDEN khi game dùng từ mới.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { spell, splitTone } = await import(pathToFileURL(join(root, 'src/spell.ts')).href);
const spellBase = (w) => splitTone(w).base;
const { LETTERS, letterNameText } = await import(pathToFileURL(join(root, 'src/letters.ts')).href);
const { GAME_WORDS } = await import(pathToFileURL(join(root, 'src/words.ts')).href);

/** từ → chuỗi đọc, các token cách nhau bởi " – " */
const GOLDEN = {
  // phụ âm + a (chương 2)
  ba: 'bờ – a – ba', ca: 'cờ – a – ca', da: 'dờ – a – da', 'đa': 'đờ – a – đa', ha: 'hờ – a – ha',
  la: 'lờ – a – la', ma: 'mờ – a – ma', na: 'nờ – a – na',
  // phụ âm + vần 1 chữ + dấu (chương 3, trận cuối)
  'bà': 'bờ – a – ba – huyền – bà', 'cá': 'cờ – a – ca – sắc – cá', 'bò': 'bờ – o – bo – huyền – bò',
  'mẹ': 'mờ – e – me – nặng – mẹ', 'vẽ': 'vờ – e – ve – ngã – vẽ', 'tô': 'tờ – ô – tô', 'dê': 'dờ – ê – dê',
  'gà': 'gờ – a – ga – huyền – gà', 'thỏ': 'thờ – o – tho – hỏi – thỏ', 'quả': 'quờ – a – qua – hỏi – quả',
  'gió': 'giờ – o – gio – sắc – gió', 'kẹo': 'e – o – eo – ca – eo – keo – nặng – kẹo',
  // vần 2+ chữ
  'mèo': 'e – o – eo – mờ – eo – meo – huyền – mèo', heo: 'e – o – eo – hờ – eo – heo',
  'ông': 'ô – ngờ – ông', 'xe': 'xờ – e – xe',
  // vần tắc c/ch/p/t: vần đọc sắc, tiếng không dấu đọc sắc, rồi mới thêm dấu
  'vịt': 'i – tờ – ít – vờ – ít – vít – nặng – vịt',
  'học': 'o – cờ – óc – hờ – óc – hóc – nặng – học',
  'hát': 'a – tờ – át – hờ – át – hát',
  'ếch': 'ê – chờ – ếch',
  'cấp': 'ớ – pờ – ấp – cờ – ấp – cấp',
  'ớt': 'ơ – tờ – ớt',
  'đẹp': 'e – pờ – ép – đờ – ép – đép – nặng – đẹp',
  'sách': 'a – chờ – ách – sờ – ách – sách',
  // từ ví dụ của 29 chữ cái (src/letters.ts)
  'áo': 'a – o – ao – sắc – áo', 'em': 'e – mờ – em', 'đèn': 'e – nờ – en – đờ – en – đen – huyền – đèn',
  'hoa': 'o – a – oa – hờ – oa – hoa', 'in': 'i – nờ – in', 'lá': 'lờ – a – la – sắc – lá', 'nơ': 'nờ – ơ – nơ',
  'ong': 'o – ngờ – ong', 'ô': 'ô', 'pin': 'i – nờ – in – pờ – in – pin', 'quà': 'quờ – a – qua – huyền – quà',
  'rùa': 'u – a – ua – rờ – ua – rua – huyền – rùa', 'sao': 'a – o – ao – sờ – ao – sao', 'táo': 'a – o – ao – tờ – ao – tao – sắc – táo',
  'ủng': 'u – ngờ – ung – hỏi – ủng', 'ướt': 'ưa – tờ – ướt', 'yên': 'ia – nờ – yên',
  // ă, â đọc á, ớ; y đọc i
  'ăn': 'á – nờ – ăn', 'ấm': 'ớ – mờ – âm – sắc – ấm', 'ly': 'lờ – i – ly',
};

/** tên chữ cái (gọi theo âm, SGK lớp 1) */
const NAMES = {
  a: 'a', 'ă': 'á', 'â': 'ớ', b: 'bờ', c: 'cờ', d: 'dờ', 'đ': 'đờ', e: 'e', 'ê': 'ê', g: 'gờ', h: 'hờ', i: 'i ngắn',
  k: 'ca', l: 'lờ', m: 'mờ', n: 'nờ', o: 'o', 'ô': 'ô', 'ơ': 'ơ', p: 'pờ', q: 'quờ', r: 'rờ', s: 'sờ', t: 'tờ',
  u: 'u', 'ư': 'ư', v: 'vờ', x: 'xờ', y: 'i dài',
};
const ORDER = 'a ă â b c d đ e ê g h i k l m n o ô ơ p q r s t u ư v x y'.split(' ');

let bad = 0;
const textOf = (w) => {
  const s = spell(w);
  const map = new Map(s.lines);
  return s.tokens.map((t) => map.get(t.audio)).join(' – ');
};
for (const [w, want] of Object.entries(GOLDEN)) {
  let got;
  try { got = textOf(w); } catch (e) { got = `LỖI ${e.message}`; }
  if (got !== want) { bad++; console.error(`✗ ${w}\n    muốn: ${want}\n    ra:   ${got}`); }
}
// mọi từ game dùng phải có trong bảng vàng (từ mới → thêm đáp án tay)
for (const w of GAME_WORDS) {
  if (!(w in GOLDEN)) { bad++; console.error(`✗ từ "${w}" có trong game nhưng chưa có đáp án trong bảng vàng`); }
}
// từ ví dụ của mỗi chữ: bắt đầu bằng chữ đó + có đáp án trong bảng vàng
for (const l of LETTERS) {
  const first = Array.from(spellBase(l.word))[0];
  if (first !== l.ch) { bad++; console.error(`✗ từ ví dụ "${l.word}" của chữ ${l.ch} không bắt đầu bằng ${l.ch}`); }
  if (!(l.word in GOLDEN)) { bad++; console.error(`✗ từ ví dụ "${l.word}" (chữ ${l.ch}) chưa có đáp án trong bảng vàng`); }
}
// 29 chữ cái: đúng thứ tự, đúng tên
const order = LETTERS.map((l) => l.ch);
if (order.join(' ') !== ORDER.join(' ')) { bad++; console.error(`✗ thứ tự bảng chữ cái sai: ${order.join(' ')}`); }
for (const l of LETTERS) {
  if (letterNameText(l.ch) !== NAMES[l.ch]) { bad++; console.error(`✗ tên chữ ${l.ch}: "${letterNameText(l.ch)}" ≠ "${NAMES[l.ch]}"`); }
}
if (bad) { console.error(`\ncheck-spelling: ${bad} lỗi`); process.exit(1); }
console.log(`check-spelling: ✓ ${Object.keys(GOLDEN).length} từ + 29 tên chữ khớp bảng vàng`);
