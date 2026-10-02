// Chọn câu trong ngân hàng (src/lines.ts BANK_TEXT): ngẫu nhiên, không lặp 3 câu gần nhất của ngân hàng đó.
// Mọi lời nói ngắn của game đi qua đây để bé không nghe lặp.
import { BANK_TEXT, bankKey } from './lines';
import { askKey, ASK_TEMPLATES } from './letters';

const recent = new Map<string, number[]>();

function pick(name: string, n: number, keep = 3): number {
  const last = recent.get(name) ?? [];
  const free = Array.from({ length: n }, (_, i) => i).filter((i) => !last.includes(i));
  const i = free[Math.floor(Math.random() * free.length)] ?? 0;
  recent.set(name, [...last, i].slice(-Math.min(keep, n - 1)));
  return i;
}

/** Khoá audio + chữ của 1 câu ngân hàng. */
export function bankLine(bank: string): { key: string; text: string; voice: string } {
  const [voice, list] = BANK_TEXT[bank];
  const i = pick(bank, list.length);
  return { key: bankKey(bank, i), text: list[i], voice };
}

/** Câu hỏi chữ khác mẫu với lần trước. */
export function askLine(ch: string): string { return askKey(ch, pick('ask', ASK_TEMPLATES.length, 1)); }
