// 29 chữ cái tiếng Việt: thứ tự bảng chữ, tên gọi theo ÂM (SGK Tiếng Việt 1, GDPT 2018), đồ vật quen của mỗi chữ,
// các nhóm dễ lẫn (để chọn chữ nhiễu khi ôn). File THUẦN (chạy được bằng Node cho scripts/).
//
// Tên chữ: phụ âm gọi theo âm (bờ, cờ...), k = "ca", ă = "á", â = "ớ", i = "i ngắn", y = "i dài".
// q: tên chữ trong bảng là "cu" (quy) nhưng SGK lớp 1 dạy q luôn đi với u thành "qu", đọc "quờ" → game dùng "quờ".
import { slug } from './spell.ts';

export interface Letter {
  ch: string;
  /** tên đọc */
  name: string;
  /** TỪ VÍ DỤ: 1 tiếng, bắt đầu bằng chính chữ đó, ghép được ở mức lớp 1 (đọc: "ê… ếch: ê – chờ – ếch") */
  word: string;
  /** cách gọi đồ vật cho ba mẹ (hiện nhỏ dưới từ) */
  obj: string;
  emoji: string;
  vowel: boolean;
}

/**
 * [chữ, tên, từ ví dụ, đồ vật, emoji]. Từ ví dụ PHẢI bắt đầu bằng chữ đó và có trong bảng vàng scripts/check-spelling.mjs.
 * Ca khó (PLAN.md §4): ă → "ăn" (ăn cơm 🍚), â → "ấm" (ấm trà), e → "em" (em bé), i → "in" (máy in), ô → "ô" (cái ô),
 * ư → "ướt" (mưa ướt 💦: không có đồ vật nào bắt đầu bằng ư), y → "yên" (yên ngựa: hợp truyện pony).
 */
const RAW: [string, string, string, string, string][] = [
  ['a', 'a', 'áo', 'cái áo', '👕'], ['ă', 'á', 'ăn', 'ăn cơm', '🍚'], ['â', 'ớ', 'ấm', 'cái ấm', '🫖'], ['b', 'bờ', 'bò', 'con bò', '🐄'],
  ['c', 'cờ', 'cá', 'con cá', '🐟'], ['d', 'dờ', 'dê', 'con dê', '🐐'], ['đ', 'đờ', 'đèn', 'cái đèn', '💡'], ['e', 'e', 'em', 'em bé', '👶'],
  ['ê', 'ê', 'ếch', 'con ếch', '🐸'], ['g', 'gờ', 'gà', 'con gà', '🐔'], ['h', 'hờ', 'hoa', 'bông hoa', '🌸'], ['i', 'i ngắn', 'in', 'máy in', '🖨️'],
  ['k', 'ca', 'kẹo', 'viên kẹo', '🍬'], ['l', 'lờ', 'lá', 'chiếc lá', '🍃'], ['m', 'mờ', 'mèo', 'con mèo', '🐈'], ['n', 'nờ', 'nơ', 'cái nơ', '🎀'],
  ['o', 'o', 'ong', 'con ong', '🐝'], ['ô', 'ô', 'ô', 'cái ô', '☂️'], ['ơ', 'ơ', 'ớt', 'quả ớt', '🌶️'], ['p', 'pờ', 'pin', 'cục pin', '🔋'],
  ['q', 'quờ', 'quà', 'hộp quà', '🎁'], ['r', 'rờ', 'rùa', 'con rùa', '🐢'], ['s', 'sờ', 'sao', 'ngôi sao', '⭐'], ['t', 'tờ', 'táo', 'quả táo', '🍎'],
  ['u', 'u', 'ủng', 'đôi ủng', '👢'], ['ư', 'ư', 'ướt', 'mưa ướt', '💦'], ['v', 'vờ', 'vịt', 'con vịt', '🦆'], ['x', 'xờ', 'xe', 'xe ô tô', '🚗'],
  ['y', 'i dài', 'yên', 'yên ngựa', '🐎'],
];
const VOWELS = new Set(Array.from('aăâeêioôơuưy'));

export const LETTERS: Letter[] = RAW.map(([ch, name, word, obj, emoji]) => ({ ch, name, word, obj, emoji, vowel: VOWELS.has(ch) }));
export const LETTER_ORDER = LETTERS.map((l) => l.ch);
const BY = new Map(LETTERS.map((l) => [l.ch, l]));
export function letter(ch: string): Letter {
  const l = BY.get(ch);
  if (!l) throw new Error(`không có chữ "${ch}"`);
  return l;
}
export function letterNameText(ch: string): string { return letter(ch).name; }

/** Nhóm dễ lẫn: chữ nhiễu ưu tiên lấy cùng nhóm khi cả hai đã mở. */
export const CONFUSABLE: string[][] = [
  ['b', 'd'], ['m', 'n'], ['o', 'ô', 'ơ'], ['u', 'ư'], ['a', 'ă', 'â'], ['e', 'ê'], ['p', 'q'], ['i', 'y'], ['d', 'đ'],
];
export function confusablesOf(ch: string): string[] {
  const out = new Set<string>();
  for (const g of CONFUSABLE) if (g.includes(ch)) for (const x of g) if (x !== ch) out.add(x);
  return [...out];
}

// ---- khoá audio
export const nameKey = (ch: string) => `ln_${slug(ch)}`;
export const objKey = (ch: string) => `lo_${slug(ch)}`;
export const askKey = (ch: string, i: number) => `ql_${slug(ch)}_${i}`;
/** Mẫu câu hỏi chữ ({n} = tên chữ), xoay vòng không lặp liền. */
export const ASK_TEMPLATES = [
  'Chữ {n} đâu?',
  'Nhím ơi, chữ {n} ở đâu?',
  'Tìm chữ {n} nào!',
];

/** Mọi dòng audio của bảng chữ: tên, tên + từ ví dụ, câu hỏi chữ. */
export function letterAudioLines(): [string, string][] {
  const out: [string, string][] = [];
  for (const l of LETTERS) {
    out.push([nameKey(l.ch), l.name]);
    out.push([objKey(l.ch), `${l.name}… ${l.word}`]);
    ASK_TEMPLATES.forEach((t, i) => out.push([askKey(l.ch, i), t.replace('{n}', l.name)]));
  }
  return out;
}
