// Sao đáp án 3D: ngôi sao nổi khối (bevel) + đĩa chữ / số to quay về camera + quầng sáng. Hiện trước mặt Nhím khi hỏi,
// trên biển ngã rẽ. Vẽ được chữ cái, số 0–10, dấu thanh (huyền, sắc, hỏi, ngã, nặng).
import * as THREE from 'three';
import { tween, easeOutBack, easeInOutSine } from './tween';

export type ToneName = 'huyen' | 'sac' | 'hoi' | 'nga' | 'nang';

const COLORS = [0xff5fa8, 0xff9a2e, 0x2fb4ff, 0x58cc02, 0xa06cd5, 0xffc21a, 0x19c3b3];
let colorIdx = 0;

const starGeo = (() => {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.5 : 1.0;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 2 });
  g.translate(0, 0, -0.08);
  return g;
})();

let glowTex: THREE.CanvasTexture | null = null;
export function glowTexture(): THREE.CanvasTexture {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,240,200,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
    glowTex.colorSpace = THREE.SRGBColorSpace;
  }
  return glowTex;
}

const FONT = "'Baloo 2', 'Nunito', system-ui, sans-serif";

/** Vẽ dấu thanh bằng nét tay (font không có glyph dấu rời đẹp). */
function drawTone(g: CanvasRenderingContext2D, tone: ToneName, cx: number, cy: number, s: number): void {
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = s * 0.14;
  g.beginPath();
  if (tone === 'huyen') { g.moveTo(cx - s * 0.25, cy - s * 0.3); g.lineTo(cx + s * 0.22, cy + s * 0.25); g.stroke(); }
  else if (tone === 'sac') { g.moveTo(cx + s * 0.25, cy - s * 0.3); g.lineTo(cx - s * 0.22, cy + s * 0.25); g.stroke(); }
  else if (tone === 'hoi') {
    g.moveTo(cx - s * 0.2, cy - s * 0.18);
    g.bezierCurveTo(cx - s * 0.15, cy - s * 0.45, cx + s * 0.32, cy - s * 0.4, cx + s * 0.22, cy - s * 0.1);
    g.bezierCurveTo(cx + s * 0.15, cy + s * 0.05, cx, cy + s * 0.02, cx, cy + s * 0.25);
    g.stroke();
  } else if (tone === 'nga') {
    g.moveTo(cx - s * 0.32, cy + s * 0.1);
    g.bezierCurveTo(cx - s * 0.2, cy - s * 0.25, cx - s * 0.05, cy - s * 0.15, cx, cy);
    g.bezierCurveTo(cx + s * 0.05, cy + s * 0.15, cx + s * 0.2, cy + s * 0.25, cx + s * 0.32, cy - s * 0.1);
    g.stroke();
  } else { g.arc(cx, cy, s * 0.13, 0, Math.PI * 2); g.fill(); }
}

function faceTexture(label: string, color: number, tone?: ToneName, wide = false): THREE.CanvasTexture {
  const W = wide ? 512 : 256, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const col = '#' + color.toString(16).padStart(6, '0');
  g.fillStyle = '#fffdf6';
  g.strokeStyle = col;
  g.lineWidth = 18;
  g.beginPath();
  if (wide) g.roundRect(12, 12, W - 24, H - 24, 110); else g.arc(W / 2, H / 2, H / 2 - 12, 0, Math.PI * 2);
  g.fill(); g.stroke();
  g.fillStyle = '#3b2a5a'; g.strokeStyle = '#3b2a5a';
  if (tone) drawTone(g, tone, W / 2, H / 2, 200);
  else {
    g.font = `800 ${wide ? 190 : Array.from(label).length > 1 ? 150 : 200}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    // chữ có dấu trên (ă â ê ô ơ) cao hơn → hạ thấp chút để cân
    const m = g.measureText(label);
    const top = m.actualBoundingBoxAscent, bot = m.actualBoundingBoxDescent;
    g.fillText(label, W / 2, H / 2 + (top - bot) / 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export interface StarOpts {
  /** chữ / tiếng hiện trên mặt (tiếng nhiều chữ → thẻ dài, không có ngôi sao) */
  label: string;
  tone?: ToneName;
  color?: number;
  size?: number;
}

/** Một sao chữ trong cảnh. `root` đặt vị trí; `face` tự quay về camera. */
export class LetterStar {
  readonly root = new THREE.Group();
  readonly face = new THREE.Group();
  readonly label: string;
  readonly tone?: ToneName;
  readonly color: number;
  /** để raycast: mọi mesh chạm được */
  readonly hits: THREE.Object3D[] = [];
  /** độ cao lơ lửng gốc */
  baseY = 1.5;
  bobAmp = 0.15;
  private t = Math.random() * 10;
  private star: THREE.Mesh | null = null;
  private glow: THREE.Sprite;
  private spin = 0;
  /** đã dùng xong (bay đi), không còn tương tác */
  gone = false;
  /** khoá vị trí y (không nhấp nhô) khi đang bay */
  frozen = false;

  constructor(opts: StarOpts) {
    this.label = opts.label;
    this.tone = opts.tone;
    this.color = opts.color ?? COLORS[colorIdx++ % COLORS.length];
    const size = opts.size ?? 1;
    const wide = Array.from(opts.label).length > 2 && !opts.tone;
    this.root.add(this.face);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: this.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 }));
    this.glow.scale.setScalar(wide ? 4.2 : 3.2);
    this.face.add(this.glow);
    if (!wide) {
      const mat = new THREE.MeshStandardMaterial({ color: this.color, emissive: this.color, emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.1 });
      this.star = new THREE.Mesh(starGeo, mat);
      this.star.scale.setScalar(1.05);
      this.face.add(this.star);
      this.hits.push(this.star);
    }
    const disc = new THREE.Mesh(
      wide ? new THREE.PlaneGeometry(2.4, 1.2) : new THREE.CircleGeometry(0.66, 40),
      new THREE.MeshBasicMaterial({ map: faceTexture(opts.label, this.color, opts.tone, wide), transparent: true }),
    );
    disc.position.z = 0.2;
    this.face.add(disc);
    this.hits.push(disc);
    this.face.scale.setScalar(size);
    for (const h of this.hits) h.userData.star = this;
  }

  setPos(x: number, y: number, z: number): void {
    this.root.position.set(x, 0, z);
    this.baseY = y;
    this.face.position.y = y;
  }

  /** Mỗi khung: nhấp nhô, xoay nhẹ quanh trục, quay mặt về camera. */
  update(dt: number, cam: THREE.Camera): void {
    this.t += dt;
    if (!this.frozen) this.face.position.y = this.baseY + Math.sin(this.t * 2.1) * this.bobAmp;
    const wp = this.root.getWorldPosition(_v);
    this.root.rotation.y = Math.atan2(cam.position.x - wp.x, cam.position.z - wp.z);
    if (this.star) this.star.rotation.z = Math.sin(this.t * 1.3) * 0.12 + this.spin;
    this.glow.material.opacity = 0.55 + Math.sin(this.t * 3) * 0.2;
  }

  /** Lắc nhẹ khi chọn sai. */
  async wobble(): Promise<void> {
    await tween(520, (k) => { this.face.rotation.z = Math.sin(k * Math.PI * 5) * 0.32 * (1 - k); });
    this.face.rotation.z = 0;
  }

  /** Phồng sáng khi đúng. */
  async pop(): Promise<void> {
    const s0 = this.face.scale.x;
    await tween(380, (k) => { this.face.scale.setScalar(s0 * (1 + Math.sin(k * Math.PI) * 0.35)); this.spin = k * Math.PI * 2; });
    this.spin = 0;
  }

  /** Mọc lên từ mặt đất. */
  async appear(delay = 0): Promise<void> {
    const s0 = this.face.scale.x;
    this.face.scale.setScalar(0.01);
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await tween(520, (k) => this.face.scale.setScalar(Math.max(0.01, s0 * k)), easeOutBack);
  }

  /** Bay tới điểm `to` (thế giới), thu nhỏ còn `scale`. */
  async flyTo(to: THREE.Vector3, ms = 700, scale = 0.6, arc = 1.5): Promise<void> {
    this.frozen = true;
    const from = this.face.getWorldPosition(new THREE.Vector3());
    const s0 = this.face.scale.x;
    const parentPos = this.root.position.clone();
    await tween(ms, (k) => {
      const p = from.clone().lerp(to, k);
      p.y += Math.sin(k * Math.PI) * arc;
      this.root.position.set(p.x, 0, p.z);
      this.face.position.y = p.y;
      this.face.scale.setScalar(s0 + (scale * s0 - s0) * k);
    }, easeInOutSine);
    void parentPos;
  }

  /** Thu nhỏ biến mất. */
  async vanish(ms = 400): Promise<void> {
    this.gone = true;
    const s0 = this.face.scale.x;
    await tween(ms, (k) => this.face.scale.setScalar(Math.max(0.01, s0 * (1 - k))));
    this.root.visible = false;
  }

  worldCenter(): THREE.Vector3 { return this.face.getWorldPosition(new THREE.Vector3()); }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        if (m.geometry !== starGeo) m.geometry.dispose();
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.map?.dispose();
        mat.dispose();
      }
    });
  }
}
const _v = new THREE.Vector3();

/** Đối tượng chạm được. */
export type Pickable = LetterStar;
