// Sinh câu hỏi cho 1 bài: nhận mặt chữ, cộng, trừ, điền số (a + ? = c), ghép tiếng. Xen kẽ loại (không quá 2 câu cùng
// loại liền nhau), không lặp câu trong bài, chèn 1–2 câu bé từng sai (`weak`) để ôn lại. File THUẦN (scripts/check-quiz.mjs).
//
// Khoá câu (để ôn): 'L:ô' · 'A:2+3' · 'S:5-2' · 'M:3+?=5' · 'W:bà'.
import type { QKind, QuizDef } from './data.ts';
import { LETTERS, letter, confusablesOf, askKey, objKey, ASK_TEMPLATES } from './letters.ts';
import { addPairs, subPairs, addAskKey, addSayKey, subAskKey, subSayKey, missAskKey } from './numbers.ts';
import { spell, splitTone, type ToneName } from './spell.ts';
import { WORDS } from './words.ts';
import { spellKey, toneFindKey } from './lines.ts';

/** 1 lượt chọn: câu hỏi (audio), đáp án đúng, các lựa chọn (đã xáo). Lựa chọn dấu thanh đặt `tone`. */
export interface Step {
  ask: string;
  answer: string;
  choices: string[];
  tone?: boolean;
}

export type Panel =
  | { type: 'listen' }
  | { type: 'eq'; a: number | '?'; op: '+' | '−'; b: number | '?'; c: number | '?' }
  | { type: 'word'; word: string; emoji: string };

export interface Question {
  key: string;
  kind: QKind;
  /** nói trước các bước (ghép tiếng: "Mình ghép chữ ba nhé!") */
  intro: string[];
  steps: Step[];
  panel: Panel;
  /** đọc khi xong (đúng) / khi sai để bé học: "bờ… bò", "Hai cộng ba bằng năm!", chuỗi đánh vần */
  learn: string[];
  /** chữ sáng theo từng token đánh vần (ghép tiếng) */
  lit?: number[][];
}

type Rnd = () => number;
const shuffle = <T>(a: T[], r: Rnd): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pick = <T>(a: T[], r: Rnd): T => a[Math.floor(r() * a.length)];

/** Lựa chọn số: đáp án + số gần (±1, ±2) trong 0..max. */
function numChoices(ans: number, n: number, max: number, r: Rnd): string[] {
  const out = new Set<number>([ans]);
  const near = shuffle([ans - 1, ans + 1, ans - 2, ans + 2, ans + 3, ans - 3], r).filter((x) => x >= 0 && x <= max);
  for (const x of near) { if (out.size >= n) break; out.add(x); }
  while (out.size < n) out.add(Math.floor(r() * (max + 1)));
  return shuffle([...out].map(String), r);
}

/** Lựa chọn chữ: chữ đúng + nhiễu (cặp dễ lẫn nếu bật, còn lại lấy trong bể chữ cùng loại nguyên âm / phụ âm). */
function letterChoices(ch: string, n: number, pool: string[], confusable: boolean, r: Rnd): string[] {
  const out = new Set<string>([ch]);
  const isV = letter(ch).vowel;
  if (confusable) for (const c of shuffle(confusablesOf(ch), r)) { if (out.size >= n) break; out.add(c); }
  const conf = new Set(confusablesOf(ch));
  // bài dễ: tránh cặp dễ lẫn (b–d…) để bé tập nhận mặt trước
  const same = shuffle(pool.filter((c) => c !== ch && letter(c).vowel === isV && (confusable || !conf.has(c))), r);
  for (const c of same) { if (out.size >= n) break; out.add(c); }
  const any = shuffle(LETTERS.map((l) => l.ch).filter((c) => letter(c).vowel === isV && (confusable || !conf.has(c))), r);
  for (const c of any) { if (out.size >= n) break; out.add(c); }
  return shuffle([...out], r);
}

const TONES: ToneName[] = ['huyen', 'sac', 'hoi', 'nga', 'nang'];

let askRot = 0;
function letterQ(ch: string, n: number, def: QuizDef, r: Rnd): Question {
  const ask = askKey(ch, askRot++ % ASK_TEMPLATES.length);
  return {
    key: `L:${ch}`, kind: 'letter', intro: [], panel: { type: 'listen' },
    steps: [{ ask, answer: ch, choices: letterChoices(ch, n, def.letters, def.confusable, r) }],
    learn: [objKey(ch)],
  };
}
function addQ(a: number, b: number, n: number, max: number, r: Rnd): Question {
  return {
    key: `A:${a}+${b}`, kind: 'add', intro: [], panel: { type: 'eq', a, op: '+', b, c: '?' },
    steps: [{ ask: addAskKey(a, b), answer: String(a + b), choices: numChoices(a + b, n, max, r) }], learn: [addSayKey(a, b)],
  };
}
function subQ(a: number, b: number, n: number, max: number, r: Rnd): Question {
  return {
    key: `S:${a}-${b}`, kind: 'sub', intro: [], panel: { type: 'eq', a, op: '−', b, c: '?' },
    steps: [{ ask: subAskKey(a, b), answer: String(a - b), choices: numChoices(a - b, n, max, r) }], learn: [subSayKey(a, b)],
  };
}
function missQ(a: number, c: number, n: number, max: number, r: Rnd): Question {
  const b = c - a;
  return {
    key: `M:${a}+?=${c}`, kind: 'miss', intro: [], panel: { type: 'eq', a, op: '+', b: '?', c },
    steps: [{ ask: missAskKey(a, c), answer: String(b), choices: numChoices(b, n, max, r) }], learn: [addSayKey(a, b)],
  };
}
/** Ghép tiếng: chữ đầu → nguyên âm → (dấu). Nhiễu chữ lấy cặp dễ lẫn + chữ cùng loại; nhiễu dấu là dấu khác. */
function wordQ(w: string, n: number, def: QuizDef, r: Rnd): Question {
  const sp = spell(w);
  const { tone } = splitTone(w);
  const steps: Step[] = [];
  const onset = sp.onset, vowel = sp.rhyme;
  steps.push({ ask: askKey(onset, 0), answer: onset, choices: letterChoices(onset, n, LETTERS.map((l) => l.ch), def.confusable, r) });
  steps.push({ ask: askKey(vowel, 0), answer: vowel, choices: letterChoices(vowel, n, LETTERS.map((l) => l.ch), def.confusable, r) });
  if (tone) {
    const others = shuffle(TONES.filter((t) => t !== tone), r).slice(0, n - 1);
    steps.push({ ask: toneFindKey(tone), answer: tone, choices: shuffle([tone, ...others], r), tone: true });
  }
  return {
    key: `W:${w}`, kind: 'word', intro: [spellKey(sp.id)], panel: { type: 'word', word: w, emoji: WORDS[w]?.emoji ?? '⭐' },
    steps, learn: sp.tokens.map((t) => t.audio), lit: sp.tokens.map((t) => t.lit),
  };
}

/** Dựng lại câu từ khoá (ôn câu sai). null nếu khoá hỏng / không hợp bài này. */
export function fromKey(key: string, n: number, def: QuizDef, r: Rnd): Question | null {
  let m: RegExpExecArray | null;
  try {
    if ((m = /^L:(.+)$/.exec(key))) return letterQ(m[1], n, def, r);
    if ((m = /^A:(\d+)\+(\d+)$/.exec(key))) return addQ(+m[1], +m[2], n, Math.max(def.maxN, +m[1] + +m[2]), r);
    if ((m = /^S:(\d+)-(\d+)$/.exec(key))) return subQ(+m[1], +m[2], n, Math.max(def.maxN, +m[1]), r);
    if ((m = /^M:(\d+)\+\?=(\d+)$/.exec(key))) return missQ(+m[1], +m[2], n, Math.max(def.maxN, +m[2]), r);
    if ((m = /^W:(.+)$/.exec(key)) && WORDS[m[1]] && n >= 3) return wordQ(m[1], n, def, r);
  } catch { /* khoá hỏng */ }
  return null;
}

function fresh(kind: QKind, n: number, def: QuizDef, r: Rnd): Question {
  switch (kind) {
    case 'letter': return letterQ(pick(def.letters, r), n, def, r);
    case 'add': { const [a, b] = pick(addPairs(def.maxN), r); return addQ(a, b, n, def.maxN, r); }
    case 'sub': { const [a, b] = pick(subPairs(def.maxN), r); return subQ(a, b, n, def.maxN, r); }
    case 'miss': { const [a, b] = pick(addPairs(def.maxN), r); return missQ(a, a + b, n, def.maxN, r); }
    case 'word': return wordQ(pick(def.words, r), n, def, r);
  }
}

/**
 * `count` câu cho 1 bài. `n` = số lựa chọn mỗi lượt (2 ở ngã rẽ, 3 ở sao). Ghép tiếng chỉ có khi n ≥ 3.
 * `weak`: khoá câu bé từng sai → chèn tối đa 2 câu (ưu tiên sai nhiều).
 */
export function makeQuiz(def: QuizDef, count: number, n: number, weak: Record<string, number>, r: Rnd): Question[] {
  const kinds = def.kinds.filter((k) => k !== 'word' || (n >= 3 && def.words.length));
  const out: Question[] = [];
  const used = new Set<string>();
  const review = Object.entries(weak).sort((a, b) => b[1] - a[1]).map(([k]) => fromKey(k, n, def, r)).filter((q): q is Question => !!q).slice(0, 2);
  const reviewAt = new Set(review.map((_, i) => Math.min(count - 1, 1 + i * Math.max(2, Math.floor(count / 2)))));
  let rot = Math.floor(r() * kinds.length);
  for (let i = 0; i < count; i++) {
    if (reviewAt.has(i) && review.length) {
      const q = review.shift()!;
      if (!used.has(q.key)) { used.add(q.key); out.push(q); continue; }
    }
    let q: Question | null = null;
    for (let tries = 0; tries < 30; tries++) {
      let kind = kinds[rot % kinds.length];
      // không quá 2 câu cùng loại liền nhau
      if (out.length >= 2 && out[out.length - 1].kind === kind && out[out.length - 2].kind === kind) kind = kinds[(rot + 1) % kinds.length];
      const c = fresh(kind, n, def, r);
      if (!used.has(c.key) || tries > 25) { q = c; break; }
    }
    rot++;
    used.add(q!.key);
    out.push(q!);
  }
  return out;
}
