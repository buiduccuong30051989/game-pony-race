// Đường đua: đường tâm lấy mẫu mỗi 1 m (vị trí, hướng, độ cao), có khúc cua, cầu vồng (đường vồng lên qua suối),
// ngã rẽ THẬT hình chữ Y: đường chính bẻ sang 1 bên 40° rồi bẻ về (đường tiếp tục), nhánh kia bẻ sang bên ngược lại và
// cụt sau ~36 m (Track riêng tạo bằng Track.branch; rẽ sai thì Nhím chạy vào đó rồi quay ra).
// Đường hở (đua / bị đuổi: có vạch xuất phát + đích) hoặc vòng kín (đuổi quái, màn cuối trên trời: chạy mãi tới khi xong).
//
// Hệ trục: tiến = (tx, 0, tz) (mẫu), phải = (−tz, 0, tx) (camera đứng sau nhìn tới → bên phải màn hình).
import * as THREE from 'three';

export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Span { s0: number; s1: number }
export interface Bridge extends Span { h: number }
/** Ngã rẽ: ở quãng s đường chính rẽ `dir` (−1 trái, +1 phải). */
export interface Turn { s: number; dir: -1 | 1 }

/** Ngã rẽ: bẻ TURN_ANGLE trong TURN_LEN m, đi thẳng TURN_HOLD m, bẻ về trong TURN_LEN m. */
export const TURN_LEN = 14;
export const TURN_HOLD = 10;
export const TURN_ANGLE = (40 * Math.PI) / 180;
/** Tổng chiều dài 1 ngã rẽ trên đường chính. */
export const JOG_LEN = TURN_LEN * 2 + TURN_HOLD;
/** Chiều dài nhánh cụt. */
export const BRANCH_LEN = 36;

export interface TrackOpts {
  closed: boolean;
  length: number;
  seed: number;
  /** chiều rộng mặt đường chính */
  width: number;
  bridges: Span[];
  turns?: Turn[];
  /** đường tâm có sẵn (nhánh cụt) thay vì tự sinh */
  points?: [number, number][];
  /** độ cao nền (màn cuối bay trên trời) */
  baseY?: number;
  /** đường vòng kín: biên độ lượn lên xuống (màn trời) */
  wave?: number;
}

export interface Pose { pos: THREE.Vector3; yaw: number; pitch: number; fwd: THREE.Vector3; right: THREE.Vector3 }

export class Track {
  readonly closed: boolean;
  readonly length: number;
  readonly width: number;
  readonly px: Float32Array; readonly pz: Float32Array; readonly py: Float32Array;
  readonly tx: Float32Array; readonly tz: Float32Array;
  readonly bridges: Bridge[];
  readonly turns: Turn[];
  readonly baseY: number;
  readonly bounds = new THREE.Box3();
  private readonly grid = new Map<string, number[]>();
  private readonly cell = 6;

  constructor(opts: TrackOpts) {
    this.closed = opts.closed;
    this.width = opts.width;
    this.baseY = opts.baseY ?? 0;
    const rnd = mulberry32(opts.seed);
    const pts = opts.points ?? (opts.closed ? Track.loopPoints(opts.length, rnd) : Track.openPoints(opts, rnd));
    const n = pts.length;
    this.length = opts.closed ? n : n - 1;
    this.px = new Float32Array(n); this.pz = new Float32Array(n); this.py = new Float32Array(n);
    this.tx = new Float32Array(n); this.tz = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.px[i] = pts[i][0]; this.pz[i] = pts[i][1]; }
    for (let i = 0; i < n; i++) {
      const a = opts.closed ? (i - 1 + n) % n : Math.max(0, i - 1), b = opts.closed ? (i + 1) % n : Math.min(n - 1, i + 1);
      let dx = this.px[b] - this.px[a], dz = this.pz[b] - this.pz[a];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      this.tx[i] = dx; this.tz[i] = dz;
    }
    this.bridges = opts.bridges.map((b) => ({ ...b, h: 3.6 }));
    this.turns = opts.turns ?? [];
    const wave = opts.wave ?? 0;
    for (let i = 0; i < n; i++) {
      let y = this.baseY;
      if (wave) y += Math.sin((i / n) * Math.PI * 2 * 3) * wave + Math.sin((i / n) * Math.PI * 2 * 5 + 1) * wave * 0.4;
      for (const b of this.bridges) if (i > b.s0 && i < b.s1) y += b.h * Math.sin(Math.PI * (i - b.s0) / (b.s1 - b.s0));
      this.py[i] = y;
      this.bounds.expandByPoint(new THREE.Vector3(this.px[i], y, this.pz[i]));
    }
    // lưới tra cứu "chỗ này có đường không" (rải cây không đè lên đường)
    for (let i = 0; i < n; i++) {
      const k = this.key(this.px[i], this.pz[i]);
      let c = this.grid.get(k);
      if (!c) { c = []; this.grid.set(k, c); }
      c.push(i);
    }
  }

  /**
   * Đường hở: hướng đi lượn ngẫu nhiên (độ cong đổi mượt, kéo dần về hướng ban đầu để không cuộn tròn), thẳng ở cầu và
   * trước / sau ngã rẽ, bẻ sang rồi bẻ về ở mỗi ngã rẽ; không tự cắt.
   */
  private static openPoints(opts: TrackOpts, rnd: () => number): [number, number][] {
    const turns = opts.turns ?? [];
    const calm = (s: number) => opts.bridges.some((sp) => s > sp.s0 - 14 && s < sp.s1 + 10) || turns.some((t) => s > t.s - 26 && s < t.s + JOG_LEN + 12);
    for (let attempt = 0; attempt < 80; attempt++) {
      const pts: [number, number][] = [];
      let x = 0, z = 0, yaw = 0, k = 0, kGoal = 0, segLeft = 40;
      for (let s = 0; s <= opts.length; s++) {
        pts.push([x, z]);
        const turn = turns.find((t) => s >= t.s && s < t.s + JOG_LEN);
        if (turn) {
          // rẽ trái = yaw tăng (tiến quay về phía −phải); bẻ sang, đi thẳng, bẻ về
          const u = s - turn.s;
          if (u < TURN_LEN) yaw += (-turn.dir * TURN_ANGLE) / TURN_LEN;
          else if (u >= TURN_LEN + TURN_HOLD) yaw -= (-turn.dir * TURN_ANGLE) / TURN_LEN;
          k = 0;
        } else {
          if (--segLeft <= 0) {
            segLeft = 34 + rnd() * 46;
            kGoal = (rnd() * 2 - 1) / 38 - yaw * 0.006;
            if (Math.abs(kGoal) < 1 / 140) kGoal = 0;
          }
          const goal = calm(s) || s < 30 || s > opts.length - 40 ? kGoal * 0.12 : kGoal;
          k += (goal - k) * 0.06;
          yaw += k;
        }
        x += Math.sin(yaw); z += Math.cos(yaw);
      }
      if (!Track.selfIntersects(pts, 26)) return pts;
    }
    // không tìm được (hiếm): đường thẳng lượn nhẹ
    return Array.from({ length: opts.length + 1 }, (_, s) => [Math.sin(s / 40) * 6, s] as [number, number]);
  }

  /** Vòng kín: hình bầu dục méo (đều theo độ dài cung, chu vi ≈ length). */
  private static loopPoints(length: number, rnd: () => number): [number, number][] {
    const p1 = rnd() * 6, p2 = rnd() * 6, a2 = 0.12 + rnd() * 0.08, a3 = 0.06 + rnd() * 0.06;
    const dense: [number, number][] = [];
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2;
      const r = 1 + a2 * Math.sin(2 * th + p1) + a3 * Math.sin(3 * th + p2);
      dense.push([Math.sin(th) * r * 1.25, Math.cos(th) * r]);
    }
    let per = 0;
    for (let i = 0; i < N; i++) { const a = dense[i], b = dense[(i + 1) % N]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
    const sc = length / per;
    const out: [number, number][] = [];
    let acc = 0, next = 0;
    for (let i = 0; i < N && out.length < length; i++) {
      const a = dense[i], b = dense[(i + 1) % N];
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1]) * sc;
      while (next <= acc + seg && out.length < length) {
        const f = (next - acc) / seg;
        out.push([(a[0] + (b[0] - a[0]) * f) * sc, (a[1] + (b[1] - a[1]) * f) * sc]);
        next += 1;
      }
      acc += seg;
    }
    return out;
  }

  private static selfIntersects(pts: [number, number][], minGap: number): boolean {
    const cell = 10, grid = new Map<string, number[]>();
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
      for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (const j of grid.get(`${gx},${gz}`) ?? []) {
          if (i - j > 60 && Math.hypot(pts[j][0] - x, pts[j][1] - z) < minGap) return true;
        }
      }
      const k = `${cx},${cz}`;
      let c = grid.get(k);
      if (!c) { c = []; grid.set(k, c); }
      c.push(i);
    }
    return false;
  }

  private key(x: number, z: number): string { return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`; }

  /** Quãng đường hợp lệ (vòng kín: lấy dư). */
  wrap(s: number): number {
    if (this.closed) return ((s % this.length) + this.length) % this.length;
    return Math.min(this.length, Math.max(0, s));
  }

  private sample(s: number): { i: number; j: number; f: number } {
    s = this.wrap(s);
    const n = this.px.length;
    let i = Math.floor(s);
    if (!this.closed && i >= n - 1) i = n - 2;
    const f = s - i;
    const j = this.closed ? (i + 1) % n : i + 1;
    return { i, j, f };
  }

  /** Độ cao mặt đường ở s. */
  y(s: number): number {
    const { i, j, f } = this.sample(s);
    return this.py[i] + (this.py[j] - this.py[i]) * f;
  }

  /** Vị trí trên đường ở quãng s, lệch ngang `lat` (m, + = phải). Ghi vào `out` (tránh cấp phát mỗi khung). */
  pose(s: number, lat: number, out: Pose): Pose {
    const { i, j, f } = this.sample(s);
    const x = this.px[i] + (this.px[j] - this.px[i]) * f;
    const z = this.pz[i] + (this.pz[j] - this.pz[i]) * f;
    let tx = this.tx[i] + (this.tx[j] - this.tx[i]) * f, tz = this.tz[i] + (this.tz[j] - this.tz[i]) * f;
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const y0 = this.py[i] + (this.py[j] - this.py[i]) * f;
    const dy = this.py[j] - this.py[i];
    const L = lat;
    out.right.set(-tz, 0, tx);
    out.fwd.set(tx, 0, tz);
    out.pos.set(x - tz * L, y0, z + tx * L);
    out.yaw = Math.atan2(tx, tz);
    out.pitch = -Math.atan(dy);
    return out;
  }

  static newPose(): Pose { return { pos: new THREE.Vector3(), yaw: 0, pitch: 0, fwd: new THREE.Vector3(), right: new THREE.Vector3() }; }

  /** Khoảng cách từ (x, z) tới mép mặt đường gần nhất (âm = đang nằm trên đường). */
  roadClearance(x: number, z: number): number {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best = Infinity;
    for (let gx = cx - 2; gx <= cx + 2; gx++) for (let gz = cz - 2; gz <= cz + 2; gz++) {
      for (const i of this.grid.get(`${gx},${gz}`) ?? []) best = Math.min(best, Math.hypot(this.px[i] - x, this.pz[i] - z) - this.width / 2);
    }
    return best;
  }

  /** Ngã rẽ đang ở gần (đoạn từ `before` m trước tới hết khúc rẽ). */
  turnNear(s: number, before = 0): Turn | null {
    return this.turns.find((t) => s > t.s - before && s < t.s + JOG_LEN) ?? null;
  }

  /**
   * Nhánh cụt ở ngã rẽ `t`: bắt đầu đúng điểm rẽ, bẻ NGƯỢC hướng đường chính rồi chạy thẳng, dài `len` m.
   * `reverse`: cùng nhánh nhưng đi ngược (từ cuối nhánh về ngã rẽ) để Nhím quay lại.
   */
  static branch(main: Track, t: Turn, len: number, reverse = false): Track {
    const p = Track.newPose();
    main.pose(t.s, 0, p);
    let x = p.pos.x, z = p.pos.z, yaw = p.yaw;
    const pts: [number, number][] = [];
    for (let i = 0; i <= len; i++) {
      pts.push([x, z]);
      if (i < TURN_LEN) yaw += (t.dir * TURN_ANGLE) / TURN_LEN;
      x += Math.sin(yaw); z += Math.cos(yaw);
    }
    if (reverse) pts.reverse();
    return new Track({ closed: false, length: len, seed: 0, width: main.width * 0.85, bridges: [], points: pts, baseY: main.baseY });
  }

  /** Quãng s đang ở trên cầu vồng không. */
  onBridge(s: number): Bridge | null {
    const w = this.wrap(s);
    return this.bridges.find((b) => w >= b.s0 && w <= b.s1) ?? null;
  }
}

/**
 * Dải mặt đường từ s0 tới s1: tâm lệch `center(s)` m, nửa rộng `half`. u ngang (0..1), v dọc theo quãng / 6 m.
 * Vòng kín cho phép s1 > length (lấy dư).
 */
export function ribbon(track: Track, s0: number, s1: number, half: number | ((s: number) => number), center: (s: number) => number, yOff: number, vScale = 1 / 6): THREE.BufferGeometry {
  const steps = Math.max(1, Math.ceil(s1 - s0));
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const p = Track.newPose();
  for (let k = 0; k <= steps; k++) {
    const s = s0 + ((s1 - s0) * k) / steps;
    track.pose(s, center(s), p);
    const h = typeof half === 'number' ? half : half(s);
    const l = p.pos.clone().addScaledVector(p.right, -h), r = p.pos.clone().addScaledVector(p.right, h);
    pos.push(l.x, l.y + yOff, l.z, r.x, r.y + yOff, r.z);
    uv.push(0, s * vScale, 1, s * vScale);
    if (k < steps) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
