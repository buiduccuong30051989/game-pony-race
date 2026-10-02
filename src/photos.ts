// Ảnh thật của Nhím (public/photos/, gitignore). Mọi ảnh đi qua canvas trước khi dùng: cắt theo tỉ lệ, thu ≤ 800 px,
// mã hoá lại → bỏ EXIF (vị trí GPS, máy chụp…). Thiếu ảnh → vẽ chân dung Twilight thay thế.
import files from 'virtual:nhim-photos';

/** Ô ảnh có tên cố định (album từng chương). Ảnh khác trong thư mục tự vào cuối album. */
export const PHOTO_SLOTS = ['nhim-1', 'nhim-2', 'with-cats', 'with-ba-me', 'with-ong-ba', 'with-bac-hanh', 'ca-nha'] as const;
export type PhotoSlot = typeof PHOTO_SLOTS[number];

const byName = new Map(files.map((f) => [f.replace(/\.[^.]+$/, '').toLowerCase(), f]));
export const hasPhoto = (slot: string): boolean => byName.has(slot);
/** Tên các ảnh lạ (không thuộc ô cố định) → trang album thêm. */
export function extraPhotos(): string[] {
  return [...byName.keys()].filter((k) => !(PHOTO_SLOTS as readonly string[]).includes(k));
}
/** Ảnh đầu tiên có trong danh sách ưu tiên, không có thì null. */
export function firstPhoto(...slots: string[]): string | null {
  return slots.find((s) => byName.has(s)) ?? null;
}

const cache = new Map<string, Promise<HTMLCanvasElement>>();
function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Canvas của ảnh `slot` (cắt giữa theo `aspect` = rộng/cao, cạnh dài ≤ max). Không có ảnh → chân dung Twilight vẽ tay.
 * Trình duyệt tự xoay theo EXIF khi vẽ (image-orientation: from-image), canvas ra không còn EXIF.
 */
/** Vùng cắt quanh mặt: tâm (x, y theo tỉ lệ ảnh) + độ phóng (1 = cắt vừa ảnh). */
export interface Focus { x: number; y: number; zoom: number }
/** Mặt bé trong ảnh chân dung thường ở giữa, hơi cao (nhim-1: khoảng 47% ngang, 40% dọc). */
export const FACE: Focus = { x: 0.47, y: 0.4, zoom: 2.3 };

export function photoCanvas(slot: string | null, aspect = 3 / 4, max = 800, focus?: Focus): Promise<HTMLCanvasElement> {
  const key = `${slot}|${aspect}|${max}|${focus ? `${focus.x},${focus.y},${focus.zoom}` : ''}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const f = slot ? byName.get(slot) : undefined;
      const img = f ? await loadImg(`${import.meta.env.BASE_URL}photos/${f}`) : null;
      const w = aspect >= 1 ? max : Math.round(max * aspect), h = aspect >= 1 ? Math.round(max / aspect) : max;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d')!;
      if (img && focus) {
        // cắt quanh mặt: phóng `zoom` lần, đặt điểm focus vào giữa khung, không lòi viền ảnh
        const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * focus.zoom;
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        const ox = Math.min(0, Math.max(w - dw, w / 2 - focus.x * dw));
        const oy = Math.min(0, Math.max(h - dh, h / 2 - focus.y * dh));
        g.drawImage(img, ox, oy, dw, dh);
      } else if (img) {
        const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        // ảnh chân dung: lệch lên trên chút để giữ mặt
        g.drawImage(img, (w - dw) / 2, Math.min(0, (h - dh) * 0.35), dw, dh);
      } else {
        await drawTwilight(g, w, h);
      }
      return c;
    })();
    cache.set(key, p);
  }
  return p;
}

/** data URL (JPEG) cho thẻ <img> — đã đi qua canvas nên sạch EXIF. */
export async function photoUrl(slot: string | null, aspect = 3 / 4, max = 800, focus?: Focus): Promise<string> {
  return (await photoCanvas(slot, aspect, max, focus)).toDataURL('image/jpeg', 0.88);
}

/** Chân dung Twilight thay ảnh thật: nền tím gradient, sao, mặt pony chụp sẵn. */
async function drawTwilight(g: CanvasRenderingContext2D, w: number, h: number): Promise<void> {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#c9a6ff');
  grad.addColorStop(1, '#ffb8e0');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 40; i++) {
    const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 5;
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.fill();
  }
  const face = await loadImg(`${import.meta.env.BASE_URL}img/portraits/twilight.png`);
  const s = Math.min(w, h) * 0.86;
  g.save();
  g.beginPath(); g.arc(w / 2, h * 0.46, s / 2, 0, Math.PI * 2); g.closePath();
  g.fillStyle = '#fff'; g.fill(); g.clip();
  if (face) g.drawImage(face, w / 2 - s / 2, h * 0.46 - s / 2, s, s);
  g.restore();
  g.font = `800 ${Math.round(h * 0.09)}px 'Baloo 2', system-ui, sans-serif`;
  g.textAlign = 'center';
  g.lineWidth = h * 0.012; g.strokeStyle = '#6f3fa8'; g.fillStyle = '#fff';
  g.strokeText('Nhím', w / 2, h * 0.94); g.fillText('Nhím', w / 2, h * 0.94);
}
