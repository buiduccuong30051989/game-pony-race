// Lời nói trên màn hình: khung phụ đề đáy màn có mặt tròn người nói + "Tên:" + câu, kèm giọng đọc.
// Câu HỎI chữ không hiện phụ đề (chữ trong câu sẽ lộ đáp án); bảng câu hỏi có riêng nút 🔊 nghe lại.
import photos from 'virtual:family-photos';
import { CAST, type CastId, type FamilyId } from './data';
import { LINES, BANK_TEXT, FAMILY_LINES, FRIEND_THANKS, familyKey, thanksKey } from './lines';
import { play, sfx } from './audio';
import { wait } from './tween';

/** Ai nói: người trong CAST, hoặc người kể chuyện (null). */
export type Speaker = CastId | null;

const TEXT = new Map<string, string>();
function texts(): Map<string, string> {
  if (TEXT.size) return TEXT;
  for (const [k, [, t]] of Object.entries(LINES)) TEXT.set(k, t);
  for (const [b, [, list]] of Object.entries(BANK_TEXT)) list.forEach((t, i) => TEXT.set(`b_${b}_${i}`, t));
  for (const [id, m] of Object.entries(FAMILY_LINES)) for (const [k, t] of Object.entries(m)) TEXT.set(familyKey(id as FamilyId, k), t);
  for (const [id, t] of Object.entries(FRIEND_THANKS)) TEXT.set(thanksKey(id as keyof typeof FRIEND_THANKS), t);
  return TEXT;
}
export function lineText(key: string): string { return texts().get(key) ?? ''; }

export function portraitUrl(id: CastId): string {
  return `${import.meta.env.BASE_URL}img/portraits/${CAST[id].portrait}.png`;
}
export function familyPhotoUrl(id: CastId): string | null {
  const f = photos[id];
  return f ? `${import.meta.env.BASE_URL}family/${f}` : null;
}

/** Ô tròn mặt pony + huy hiệu ảnh thật người nhà (nếu ba mẹ đã thả ảnh vào public/family/). */
export function avatarEl(id: CastId, cls = 'ava'): HTMLElement {
  const info = CAST[id];
  const a = document.createElement('div');
  a.className = cls;
  a.style.borderColor = info.color;
  const img = document.createElement('img');
  img.alt = info.name;
  img.src = portraitUrl(id);
  img.onerror = () => { img.remove(); a.prepend(info.emoji); };
  a.appendChild(img);
  const ph = familyPhotoUrl(id);
  if (ph) {
    const badge = document.createElement('img');
    badge.className = 'ava-photo';
    badge.alt = '';
    badge.src = ph;
    badge.onerror = () => badge.remove();
    a.appendChild(badge);
  }
  return a;
}

export function speakerLabel(id: Speaker): string {
  if (!id) return 'Người kể chuyện';
  const d = CAST[id];
  if (id === 'twilight') return 'Nhím';
  if (id === 'nightmare') return 'Nữ hoàng Bóng Đêm';
  return d.role && d.role !== 'bạn ngựa nhỏ' ? `${d.name} (${d.role})` : d.name;
}

let sub: HTMLElement | null = null;
function subtitleEl(): HTMLElement {
  if (!sub) {
    sub = document.createElement('div');
    sub.id = 'subtitle';
    sub.hidden = true;
    document.body.appendChild(sub);
  }
  return sub;
}
let subToken = 0;
export function showSubtitle(text: string, who: Speaker): void {
  const s = subtitleEl();
  s.innerHTML = '';
  const color = who ? CAST[who].color : '#a06cd5';
  s.style.setProperty('--sc', color);
  s.classList.toggle('dark', who === 'nightmare');
  const ava = who ? avatarEl(who, 'sub-ava') : Object.assign(document.createElement('div'), { className: 'sub-ava narr', textContent: '📖' });
  ava.style.borderColor = color;
  const body = document.createElement('div');
  body.className = 'sub-body';
  const name = document.createElement('b');
  name.textContent = `${speakerLabel(who)}:`;
  const t = document.createElement('span');
  t.textContent = text.replace(/[{}]/g, '');
  body.append(name, t);
  s.append(ava, body);
  s.hidden = false;
  s.classList.remove('in');
  void s.offsetWidth;
  s.classList.add('in');
}
export function hideSubtitle(): void { if (sub) sub.hidden = true; }

/** 1 người nói 1 câu (phụ đề + giọng). Resolve khi đọc xong (tối thiểu `minMs`). */
export async function say(who: Speaker, key: string, text = lineText(key), minMs = 900): Promise<void> {
  const my = ++subToken;
  sfx('sfx_pop', 0.25);
  if (text) showSubtitle(text, who);
  await Promise.all([play(key), wait(minMs)]);
  if (my === subToken) hideSubtitle();
}

/** Người kể / người giúp nói (giọng Hoài My). */
export const narrate = (key: string): Promise<void> => say(null, key);
