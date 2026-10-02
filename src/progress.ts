// Tiến độ của bé (localStorage `nhim-race-v1`), độc lập hoàn toàn với các game khác.
// Có tham số debug trên URL thì KHÔNG ghi đè tiến độ thật (trừ khi thêm &save=1).
import { COSMETICS, LEVELS, type FriendId } from './data';

export interface Progress {
  /** bài đã xong ('1-1', '1-2', …, 'final') */
  done: string[];
  /** tổng ngọc đã nhặt (mở đồ trang trí) */
  gems: number;
  /** câu bé trả lời sai → số lần cần trả lời đúng nữa mới thôi ôn ('L:ô', 'A:2+3', …) */
  weak: Record<string, number>;
  /** bạn đã cứu */
  friends: FriendId[];
}

const KEY = 'nhim-race-v1';
const Q = new URLSearchParams(location.search);
export const IS_DEBUG = [...Q.keys()].some((k) => k !== 'save');

export function fresh(): Progress { return { done: [], gems: 0, weak: {}, friends: [] }; }

export function loadProgress(): Progress {
  if (Q.has('reset')) { try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ } }
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (p && Array.isArray(p.done)) {
      const ids = new Set(LEVELS.map((l) => l.id));
      return {
        done: p.done.filter((x: unknown) => typeof x === 'string' && ids.has(x)),
        gems: Number.isFinite(p.gems) ? Math.max(0, p.gems | 0) : 0,
        weak: p.weak && typeof p.weak === 'object' ? Object.fromEntries(Object.entries(p.weak).filter(([, v]) => typeof v === 'number' && v > 0)) as Record<string, number> : {},
        friends: Array.isArray(p.friends) ? p.friends.filter((x: unknown) => typeof x === 'string') : [],
      };
    }
  } catch { /* hỏng thì làm lại */ }
  return fresh();
}

export function saveProgress(p: Progress): void {
  if (IS_DEBUG && !Q.has('save')) return;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* đầy bộ nhớ / chế độ riêng tư */ }
}

/** Trả lời sai: phải trả lời đúng 2 lần nữa mới thôi ôn. */
export function markWrong(p: Progress, key: string): void { p.weak[key] = 2; }
export function markRight(p: Progress, key: string): void {
  if (!p.weak[key]) return;
  if (--p.weak[key] <= 0) delete p.weak[key];
}

/** Bài mở: bài 1 mọi thế giới mở sẵn; bài 2 mở khi xong bài 1 cùng thế giới; màn cuối khi xong bài 2 cả 4 thế giới. */
export function isOpen(p: Progress, id: string): boolean {
  if (id === 'final') return [1, 2, 3, 4].every((w) => p.done.includes(`${w}-2`));
  const [w, n] = id.split('-');
  return n === '1' || p.done.includes(`${w}-1`);
}

/** Đồ trang trí đã mở theo tổng ngọc. */
export function cosmetics(p: Progress): Set<string> {
  return new Set(COSMETICS.filter((c) => p.gems >= c.gems).map((c) => c.id));
}
