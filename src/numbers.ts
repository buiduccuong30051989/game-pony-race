// Phép tính trong 10: tên số, câu hỏi cộng / trừ / điền số và câu đáp án. File THUẦN (Node đọc được cho scripts/).
// Mọi câu có audio sinh sẵn (scripts/audio-lines.mjs): đổi chữ ở đây → `pnpm audio`.

export const NUM_TEXT = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const numKey = (n: number) => `n_${n}`;
/** a + b = ? */
export const addAskKey = (a: number, b: number) => `qa_${a}_${b}`;
export const addSayKey = (a: number, b: number) => `ra_${a}_${b}`;
/** a − b = ? */
export const subAskKey = (a: number, b: number) => `qs_${a}_${b}`;
export const subSayKey = (a: number, b: number) => `rs_${a}_${b}`;
/** a + ? = c (đáp án đọc lại bằng câu cộng đầy đủ addSayKey) */
export const missAskKey = (a: number, c: number) => `qm_${a}_${c}`;

/** Các cặp hợp lệ trong phạm vi max: cộng a, b ≥ 1, tổng ≤ max; trừ a ≤ max, 1 ≤ b < a (không ra 0). */
export function addPairs(max: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 1; a < max; a++) for (let b = 1; a + b <= max; b++) out.push([a, b]);
  return out;
}
export function subPairs(max: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 2; a <= max; a++) for (let b = 1; b < a; b++) out.push([a, b]);
  return out;
}

export function numberAudioLines(): [string, string][] {
  const out: [string, string][] = [];
  NUM_TEXT.forEach((t, i) => out.push([numKey(i), cap(t)]));
  for (const [a, b] of addPairs(10)) {
    out.push([addAskKey(a, b), `${cap(NUM_TEXT[a])} cộng ${NUM_TEXT[b]} bằng mấy?`]);
    out.push([addSayKey(a, b), `${cap(NUM_TEXT[a])} cộng ${NUM_TEXT[b]} bằng ${NUM_TEXT[a + b]}!`]);
    out.push([missAskKey(a, a + b), `${cap(NUM_TEXT[a])} cộng mấy bằng ${NUM_TEXT[a + b]}?`]);
  }
  for (const [a, b] of subPairs(10)) {
    out.push([subAskKey(a, b), `${cap(NUM_TEXT[a])} trừ ${NUM_TEXT[b]} bằng mấy?`]);
    out.push([subSayKey(a, b), `${cap(NUM_TEXT[a])} trừ ${NUM_TEXT[b]} bằng ${NUM_TEXT[a - b]}!`]);
  }
  return out;
}
