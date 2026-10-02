// Lớp DOM đè trên canvas: HUD (ảnh Nhím, tim, thanh đường đua có mặt người chạy, ngọc, ngọc Hài Hoà / máu quái),
// bảng câu hỏi (phép tính có hình quả, nghe chữ, ghép tiếng), nút giữ để chạy, nút bay, đếm ngược, kết quả, bản đồ.
import { CAST, COSMETICS, LEVELS, WORLDS, type CastId } from './data';
import type { Panel } from './quiz';
import type { Progress } from './progress';
import { isOpen } from './progress';
import { avatarEl, portraitUrl } from './talk';
import { play, sfx } from './audio';
import { numKey } from './numbers';
import { wait } from './tween';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const els = {
  hud: $('hud'), hearts: $('hearts'), gems: $('gems'), bar: $('bar'), harmony: $('harmony'), target: $('target'),
  mePhoto: $<HTMLImageElement>('me-photo'), home: $('home'), panel: $('panel'), panelBody: $('panel-body'), repeat: $('repeat'),
  keys: $('keys'), keyLeft: $('key-left'), keyUp: $('key-up'), keyRight: $('key-right'), keyUpLabel: $('key-up-label'), countdown: $('countdown'), toast: $('toast'), flash: $('flash'), confetti: $('confetti'),
  map: $('map'), mapWorlds: $('map-worlds'), mapFinal: $('map-final'), mapGems: $('map-gems'), mapHero: $('map-hero'),
  result: $('result'), resTitle: $('res-title'), resPhoto: $<HTMLImageElement>('res-photo'), resFaces: $('res-faces'), resPlace: $('res-place'),
  resGems: $('res-gems'), resMap: $('res-map'), resRetry: $('res-retry'), resNext: $('res-next'),
  start: $('start'), startBtn: $('start-btn'), perf: $('perf'),
};

// ------------------------------------------------------------------ HUD

export function showPlay(on: boolean): void {
  els.hud.hidden = !on; els.home.hidden = !on; els.keys.hidden = !on;
  if (!on) { els.panel.hidden = true; els.harmony.hidden = true; els.target.hidden = true; }
}

let lastHearts = -1;
export function setHearts(n: number, max: number): void {
  if (n === lastHearts && els.hearts.childElementCount === max) return;
  const lost = lastHearts > n;
  els.hearts.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const s = document.createElement('span');
    s.textContent = '❤️';
    if (i >= n) s.className = 'off' + (lost && i === n ? ' lost' : '');
    els.hearts.appendChild(s);
  }
  lastHearts = n;
}

export function setGems(n: number, bump = false): void {
  els.gems.textContent = String(n);
  if (bump) { els.gems.classList.remove('bump'); void els.gems.offsetWidth; els.gems.classList.add('bump'); }
}

export interface BarMark { id: string; frac: number; who?: CastId; emoji?: string; me?: boolean }
const marks = new Map<string, HTMLElement>();
/** Thanh đường đua: mặt từng người chạy theo % quãng đường. */
export function setBar(fill: number, list: BarMark[] | null): void {
  els.bar.hidden = !list;
  if (!list) return;
  (els.bar.querySelector('.fill') as HTMLElement).style.width = `${Math.round(Math.min(1, fill) * 100)}%`;
  const seen = new Set<string>();
  for (const m of list) {
    seen.add(m.id);
    let el = marks.get(m.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'mk' + (m.me ? ' me' : '');
      if (m.who) {
        const img = document.createElement('img');
        img.src = portraitUrl(m.who);
        img.alt = '';
        el.appendChild(img);
        el.style.borderColor = CAST[m.who].color;
      } else el.textContent = m.emoji ?? '•';
      els.bar.appendChild(el);
      marks.set(m.id, el);
    }
    el.style.left = `${Math.min(100, Math.max(0, m.frac * 100))}%`;
  }
  for (const [id, el] of marks) if (!seen.has(id)) { el.remove(); marks.delete(id); }
}

/** 5 ngọc Hài Hoà (màn cuối): `lit` viên đã sáng. null = ẩn. */
export function setHarmony(lit: number | null): void {
  els.harmony.hidden = lit === null;
  if (lit === null) return;
  els.harmony.innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < lit ? 'on' : ''}">🌟</span>`).join('');
}

/** Máu quái đang đuổi (đuổi quái): ⭐ còn lại / tổng. null = ẩn. */
export function setTarget(emoji: string, hp: number | null, max: number): void {
  els.target.hidden = hp === null;
  if (hp === null) return;
  els.target.innerHTML = `<span>${emoji}</span>` + Array.from({ length: max }, (_, i) => `<span class="${i < hp ? '' : 'off'}">💥</span>`).join('');
}

// ------------------------------------------------------------------ bảng câu hỏi

const fruitRow = (n: number, fruit: string, cross = 0) =>
  `<small>${Array.from({ length: n }, (_, i) => `<i class="${i >= n - cross ? 'x' : ''}">${fruit}</i>`).join('')}</small>`;

/** Hiện bảng câu hỏi: phép tính (số + hàng quả), nghe chữ (👂), ghép tiếng (hình + ô chữ). */
export function showPanel(p: Panel | null, fruit = '🍎'): void {
  if (!p) { els.panel.hidden = true; return; }
  let html = '';
  if (p.type === 'listen') html = '<span class="listen">👂</span>';
  else if (p.type === 'eq') {
    const num = (v: number | '?', cross = 0) => v === '?' ? `<span class="eq-n eq-q">?</span>` : `<span class="eq-n">${v}${fruitRow(v, fruit, cross)}</span>`;
    html = `${num(p.a, p.op === '−' && p.b !== '?' ? p.b : 0)}<span class="eq-op">${p.op}</span>${num(p.b)}<span class="eq-op">=</span>${num(p.c)}`;
  } else {
    html = `<span class="word-emoji">${p.emoji}</span>` + Array.from(p.word).map((_, i) => `<span class="slot" data-i="${i}"></span>`).join('');
  }
  els.panelBody.innerHTML = html;
  els.panel.hidden = false;
  els.panel.classList.remove('in'); void els.panel.offsetWidth; els.panel.classList.add('in');
}

/** Ghép tiếng: điền chữ đã chọn vào ô (`text` = chữ hiện ra, `upto` = số ô đã có). */
export function fillWord(word: string, upto: number): void {
  const chars = Array.from(word);
  els.panelBody.querySelectorAll<HTMLElement>('.slot').forEach((el, i) => { el.textContent = i < upto ? chars[i] : ''; });
}
/** Ghép tiếng: hiện cả tiếng có dấu. */
export function showWord(word: string): void {
  const chars = Array.from(word);
  els.panelBody.querySelectorAll<HTMLElement>('.slot').forEach((el, i) => { el.textContent = chars[i] ?? ''; });
}
export function litWord(idx: number[] | null): void {
  els.panelBody.querySelectorAll<HTMLElement>('.slot').forEach((el, i) => el.classList.toggle('lit', !!idx && idx.includes(i)));
}
/** Phép tính: thay "?" bằng đáp án. */
export function solvePanel(ans: string): void {
  const q = els.panelBody.querySelector('.eq-q');
  if (q) { q.classList.remove('eq-q'); q.textContent = ans; (q as HTMLElement).style.color = '#58cc02'; }
}

// ------------------------------------------------------------------ bảng phím

/** Làm sáng phím cần bấm: 'run' (giữ ↑), 'fly' (nháy ↑ 2 lần), 'turn' (← / →), null = bình thường. */
export function keyHint(what: 'run' | 'fly' | 'turn' | null): void {
  els.keys.className = what ?? '';
  els.keyUp.classList.toggle('hint', what === 'run' || what === 'fly');
  els.keyLeft.classList.toggle('hint', what === 'turn');
  els.keyRight.classList.toggle('hint', what === 'turn');
  els.keyUpLabel.textContent = what === 'fly' ? 'nháy 2 lần: bay!' : what === 'run' ? 'giữ để chạy' : 'giữ: chạy · 2 lần: bay';
}
/** Phím đang bấm (lún xuống). */
export function keyDown(key: 'left' | 'up' | 'right', on: boolean): void {
  ({ left: els.keyLeft, up: els.keyUp, right: els.keyRight })[key].classList.toggle('down', on);
}

// ------------------------------------------------------------------ hiệu ứng

export async function countdown(): Promise<void> {
  els.countdown.hidden = false;
  for (const n of [3, 2, 1]) {
    els.countdown.innerHTML = `<b>${n}</b>`;
    void play(numKey(n));
    await wait(800);
  }
  els.countdown.innerHTML = '<b>🏇</b>';
  void play('go');
  await wait(500);
  els.countdown.hidden = true;
}

export async function flash(ms = 500): Promise<void> {
  els.flash.style.opacity = '1';
  await wait(ms);
  els.flash.style.opacity = '0';
}

export function confetti(n = 50): void {
  const e = ['⭐', '💖', '🌈', '✨', '💎', '🎉', '🦄'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.textContent = e[i % e.length];
    c.style.left = `${Math.random() * 100}%`;
    c.style.animationDuration = `${2 + Math.random() * 2}s`;
    c.style.animationDelay = `${Math.random() * 0.8}s`;
    els.confetti.appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }
}

export function toast(text: string): void {
  els.toast.textContent = text;
  els.toast.classList.remove('show'); void els.toast.offsetWidth; els.toast.classList.add('show');
}

// ------------------------------------------------------------------ kết quả

export interface ResultOpts {
  win: boolean;
  title: string;
  faces: CastId[];
  place?: string;
  gems: number;
  photo?: string | null;
  canNext: boolean;
}
/** Màn thắng / thua. Trả về nút bé chạm. */
export function showResult(o: ResultOpts): Promise<'map' | 'retry' | 'next'> {
  const r = els.result;
  r.classList.toggle('lose', !o.win);
  els.resTitle.textContent = o.title;
  els.resFaces.innerHTML = '';
  for (const f of o.faces) els.resFaces.appendChild(avatarEl(f, 'res-ava'));
  els.resPlace.textContent = o.place ?? '';
  els.resPlace.hidden = !o.place;
  els.resGems.innerHTML = `💎 +${o.gems}`;
  els.resPhoto.hidden = !o.photo;
  if (o.photo) els.resPhoto.src = o.photo;
  els.resRetry.hidden = o.win;
  els.resNext.hidden = !o.win || !o.canNext;
  r.hidden = false;
  if (o.win) confetti(60);
  return new Promise((resolve) => {
    const done = (v: 'map' | 'retry' | 'next') => () => {
      sfx('sfx_tap', 0.4);
      r.hidden = true;
      for (const b of [els.resMap, els.resRetry, els.resNext]) b.onclick = null;
      resolve(v);
    };
    els.resMap.onclick = done('map');
    els.resRetry.onclick = done('retry');
    els.resNext.onclick = done('next');
  });
}

// ------------------------------------------------------------------ bản đồ

const MODE_ICON: Record<string, string> = { race: '🏇', chase: '👾', hunt: '🎯', final: '🌙' };

/** Bản đồ 4 thế giới × 2 bài + màn cuối. Chạm bài mở được → onPick(id). */
export function showMap(p: Progress, onPick: (id: string) => void): void {
  els.mapWorlds.innerHTML = '';
  // bài nên chơi tiếp: bài mở đầu tiên chưa xong
  const next = LEVELS.find((l) => isOpen(p, l.id) && !p.done.includes(l.id))?.id;
  for (const w of WORLDS) {
    const card = document.createElement('div');
    card.className = 'w-card';
    card.style.setProperty('--i', String(w.n));
    card.style.setProperty('--wc', w.color);
    card.innerHTML = `<div class="w-emoji">${w.emoji}</div><strong>${w.title}</strong>`;
    for (const l of LEVELS.filter((x) => x.world === w.n)) {
      const b = document.createElement('button');
      const open = isOpen(p, l.id);
      b.className = 'lv-btn' + (open ? '' : ' locked') + (p.done.includes(l.id) ? ' done' : '') + (l.id === next ? ' next' : '');
      b.innerHTML = `<span class="ic">${open ? MODE_ICON[l.mode] : '🔒'}</span><span>${l.n === 1 ? 'Bài 1' : 'Bài 2'}<br><small>${l.sub.replace(/[{}]/g, '')}</small></span>`;
      b.onclick = () => { if (open) onPick(l.id); else sfx('sfx_soft', 0.4); };
      card.appendChild(b);
    }
    els.mapWorlds.appendChild(card);
  }
  const fOpen = isOpen(p, 'final');
  els.mapFinal.className = (fOpen ? '' : 'locked') + (p.done.includes('final') ? ' done' : '') + (next === 'final' ? ' next' : '');
  els.mapFinal.innerHTML = `${fOpen ? '🌙' : '🔒'} Đấu Nữ hoàng Bóng Đêm`;
  els.mapFinal.onclick = () => { if (fOpen) onPick('final'); else sfx('sfx_soft', 0.4); };
  els.mapGems.innerHTML = `💎 ${p.gems}` + COSMETICS.map((c) => `<span class="cos ${p.gems >= c.gems ? '' : 'off'}">${c.emoji}<small>${p.gems >= c.gems ? '' : c.gems}</small></span>`).join('');
  els.map.hidden = false;
}
export function hideMap(): void { els.map.hidden = true; }
