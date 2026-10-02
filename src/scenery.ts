// Cảnh hai bên đường theo thế giới: mặt đường (dải theo spline, cầu vồng 7 màu, 2 nhánh ở ngã rẽ), cỏ, suối dưới cầu,
// cây / nấm / nhà / tháp / pha lê rải 2 bên, vạch xuất phát + cổng đích, chướng ngại vật, ngọc, mây, chim, bướm.
// Màn cuối: biển mây phía dưới, cầu vồng lớn, vòng mây để bay qua.
//
// Hiệu năng (iPad): đồ tĩnh GỘP theo vật liệu trong từng đoạn 60 m (mỗi đoạn vài draw call, đoạn ngoài tầm nhìn tự bị
// loại nhờ bounding sphere), ngọc / mây / chim / bướm / vòng mây là InstancedMesh (1 draw call mỗi loại).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Engine } from './engine';
import { Track, ribbon, mulberry32 } from './track';
import type { LevelDef, SceneKind } from './data';

const CHUNK = 60;

/** Đổi màu vật liệu Kenney cho hợp tông pastel từng thế giới. */
const RECOLOR: Record<SceneKind, Record<string, number>> = {
  forest: { leafsGreen: 0x7fd36a, leafsDark: 0x5cbf6e, grass: 0x9ee07a, woodBark: 0xc98d5e, woodBarkDark: 0xa8714f, dirt: 0xc98d5e },
  village: { leafsGreen: 0x86d66c, leafsDark: 0x62c470, grass: 0xa6e47e, woodBark: 0xc98d5e, dirt: 0xc98d5e },
  hills: { leafsGreen: 0xff9fd2, leafsDark: 0xc79bff, grass: 0xb6ef9a, woodBark: 0xf0c9a6, woodBarkDark: 0xe0b28e, dirt: 0xd8b4ff, leafsFall: 0xffb86b },
  castle: { leafsGreen: 0x6fd07a, leafsDark: 0x52b865, grass: 0x9fe07e, woodBark: 0xc98d5e, dirt: 0xc98d5e, stone: 0xf4f1ff, stoneDark: 0xd9d2f2 },
  sky: {},
};

export interface Obstacle { s: number; h: number; group: THREE.Group; hit: boolean }
interface Gem { s: number; lat: number; y: number; taken: boolean; pos: THREE.Vector3 }
interface Bird { s: number; r: number; h: number; phase: number; speed: number }
interface Fly { s: number; lat: number; h: number; phase: number }

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export class Scenery {
  readonly group = new THREE.Group();
  readonly obstacles: Obstacle[] = [];
  private readonly rnd: () => number;
  private gems: Gem[] = [];
  private gemMesh: THREE.InstancedMesh | null = null;
  private readonly tmp = new THREE.Object3D();
  private readonly pose = Track.newPose();
  private birds: Bird[] = [];
  private birdBody: THREE.InstancedMesh | null = null;
  private birdWings: THREE.InstancedMesh[] = [];
  private flies: Fly[] = [];
  private flyMesh: THREE.InstancedMesh | null = null;
  private waterTex: THREE.Texture[] = [];
  private rainbowMat: THREE.MeshStandardMaterial | null = null;
  private stars: THREE.Points | null = null;
  private readonly disposables: { dispose(): void }[] = [];
  /** ngọc vừa nhặt (Level đọc để phát âm + đếm) */
  onGem: ((p: THREE.Vector3) => void) | null = null;

  /** branches: nhánh cụt ở các ngã rẽ (rải cây tránh cả chúng) */
  constructor(private readonly engine: Engine, readonly track: Track, private readonly def: LevelDef, private readonly branches: Track[] = []) {
    this.rnd = mulberry32(def.seed * 7919 + 3);
    engine.scene.add(this.group);
  }

  get kind(): SceneKind { return this.def.theme.scene; }

  async build(): Promise<void> {
    const th = this.def.theme;
    this.engine.setSky(th.sky[0], th.sky[1], th.fog[0], th.fog[1]);
    if (this.kind === 'sky') {
      this.buildSkyWorld();
    } else {
      this.buildGround();
      this.buildRoad();
      this.buildWater();
      await this.scatter();
      await this.buildDeadEnds();
      if (this.def.mode === 'race' || this.def.mode === 'chase') { this.buildArch(10, false); this.buildArch(this.track.length - 14, true); }
    }
    this.buildClouds();
    this.buildBirds();
    if (this.kind !== 'sky') this.buildButterflies();
    this.buildGems();
  }

  // ------------------------------------------------------------------ mặt đất, đường, suối

  private buildGround(): void {
    const th = this.def.theme;
    const b = this.track.bounds;
    const c = b.getCenter(new THREE.Vector3());
    const size = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) + 420;
    const base = new THREE.Color(th.ground);
    const tex = canvasTex(256, 256, (g) => {
      g.fillStyle = hex(th.ground); g.fillRect(0, 0, 256, 256);
      const r = mulberry32(5);
      for (let i = 0; i < 900; i++) {
        const k = 0.88 + r() * 0.2;
        g.fillStyle = `rgb(${Math.min(255, base.r * 255 * k) | 0},${Math.min(255, base.g * 255 * k) | 0},${Math.min(255, base.b * 255 * k) | 0})`;
        g.beginPath(); g.arc(r() * 256, r() * 256, 2 + r() * 7, 0, Math.PI * 2); g.fill();
      }
    });
    tex.repeat.set(size / 24, size / 24);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(c.x, -0.02, c.z);
    ground.receiveShadow = true;
    this.group.add(ground);
    this.disposables.push(ground.geometry, mat, tex);
  }

  private roadMaterial(): THREE.MeshLambertMaterial {
    const [base, edge] = this.def.theme.road;
    const tex = canvasTex(128, 256, (g) => {
      g.fillStyle = hex(base); g.fillRect(0, 0, 128, 256);
      const r = mulberry32(9);
      g.fillStyle = 'rgba(120,80,40,0.08)';
      for (let i = 0; i < 160; i++) { g.beginPath(); g.arc(14 + r() * 100, r() * 256, 1 + r() * 3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = hex(edge);
      g.fillRect(0, 0, 11, 256); g.fillRect(117, 0, 11, 256);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let y = 0; y < 256; y += 64) { g.fillRect(3, y, 5, 30); g.fillRect(120, y + 32, 5, 30); }
    });
    const m = new THREE.MeshLambertMaterial({ map: tex });
    this.disposables.push(m, tex);
    return m;
  }

  private rainbowMaterial(): THREE.MeshStandardMaterial {
    if (this.rainbowMat) return this.rainbowMat;
    const bands = ['#ff4d6d', '#ff9a3c', '#ffd93d', '#6bd968', '#4fb3ff', '#7b6cff', '#c86bff'];
    const tex = canvasTex(256, 64, (g) => {
      bands.forEach((c, i) => { g.fillStyle = c; g.fillRect((i * 256) / 7, 0, 256 / 7 + 1, 64); });
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = 6; x < 256; x += 256 / 7) g.fillRect(x, 0, 3, 64);
    });
    this.rainbowMat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.6, side: THREE.DoubleSide });
    this.disposables.push(this.rainbowMat, tex);
    return this.rainbowMat;
  }

  private buildRoad(): void {
    const tr = this.track;
    const road = this.roadMaterial();
    const rain = this.rainbowMaterial();
    const half = tr.width / 2;
    // mặt đường chính cắt mỗi CHUNK m (loại theo tầm nhìn) + đầu / cuối cầu (đổi sang vật liệu cầu vồng)
    const cuts = new Set<number>([0, tr.length]);
    for (let s = CHUNK; s < tr.length; s += CHUNK) cuts.add(s);
    for (const b of tr.bridges) { cuts.add(b.s0); cuts.add(b.s1); }
    const sorted = [...cuts].sort((a, b) => a - b);
    for (let k = 0; k < sorted.length - 1; k++) {
      const s0 = sorted[k], s1 = sorted[k + 1], mid = (s0 + s1) / 2;
      const bridge = tr.onBridge(mid);
      const geo = ribbon(tr, s0, s1, half, () => 0, 0.03, bridge ? 0.02 : 1 / 6);
      const m = new THREE.Mesh(geo, bridge ? rain : road);
      m.receiveShadow = true;
      this.group.add(m);
      this.disposables.push(geo);
      if (bridge) this.bridgeRails(s0, s1, half);
    }
    // nhánh cụt ở mỗi ngã rẽ (cao hơn mặt chính 6 mm để chỗ chồng không nhấp nháy) + đống đá chắn cuối nhánh
    for (const br of this.branches) {
      const geo = ribbon(br, 0, br.length, br.width / 2, () => 0, 0.036);
      const m = new THREE.Mesh(geo, road);
      m.receiveShadow = true;
      this.group.add(m);
      this.disposables.push(geo);
    }
  }

  /** Đống đá + khúc gỗ chắn cuối mỗi nhánh cụt. */
  private async buildDeadEnds(): Promise<void> {
    if (!this.branches.length) return;
    const rock = await this.loadProp('rock_largeA.glb');
    const log = await this.loadProp('log_large.glb');
    const g = new THREE.Group();
    for (const br of this.branches) {
      br.pose(br.length - 1, 0, this.pose);
      const end = new THREE.Group();
      for (const [lat, sc] of [[-2.2, 2.6], [0, 3.2], [2.2, 2.4]] as const) {
        const r = rock.clone();
        r.scale.setScalar(sc);
        r.position.set(lat, 0, 0.6);
        r.rotation.y = this.rnd() * 6.28;
        end.add(r);
      }
      const l = log.clone();
      l.scale.setScalar(2.2);
      l.rotation.y = Math.PI / 2;
      l.position.set(0, 0, -0.8);
      end.add(l);
      end.position.copy(this.pose.pos);
      end.rotation.y = this.pose.yaw;
      g.add(end);
    }
    this.mergeStatic(g);
    this.group.add(g);
    // biển 🚧 to trên đống đá: bé nhìn là biết đường cụt
    for (const br of this.branches) {
      br.pose(br.length - 1, 0, this.pose);
      const sp = this.engine.emojiSprite('🚧', 2.2);
      sp.position.copy(this.pose.pos).add(new THREE.Vector3(0, 3.6, 0));
      this.group.add(sp);
      this.disposables.push(sp.material);
    }
  }

  /** Lan can lấp lánh 2 bên cầu vồng (mây trắng nhỏ dọc mép). */
  private bridgeRails(s0: number, s1: number, half: number): void {
    const geos: THREE.BufferGeometry[] = [];
    const ball = new THREE.IcosahedronGeometry(0.42, 1);
    for (let s = s0 + 1; s < s1; s += 2.2) {
      for (const side of [-1, 1]) {
        this.track.pose(s, side * (half + 0.15), this.pose);
        const g = ball.clone();
        g.scale(1, 0.8, 1);
        g.translate(this.pose.pos.x, this.pose.pos.y + 0.25, this.pose.pos.z);
        geos.push(g);
      }
    }
    const merged = mergeGeometries(geos);
    ball.dispose(); geos.forEach((g) => g.dispose());
    if (!merged) return;
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xf4ecff, emissiveIntensity: 0.25 });
    this.group.add(new THREE.Mesh(merged, mat));
    this.disposables.push(merged, mat);
  }

  /** Suối chảy ngang dưới mỗi cầu vồng. */
  private buildWater(): void {
    for (const b of this.track.bridges) {
      const tex = canvasTex(64, 256, (g) => {
        const grad = g.createLinearGradient(0, 0, 64, 0);
        grad.addColorStop(0, '#7fd3f7'); grad.addColorStop(0.5, '#a8e6ff'); grad.addColorStop(1, '#7fd3f7');
        g.fillStyle = grad; g.fillRect(0, 0, 64, 256);
        g.fillStyle = 'rgba(255,255,255,0.55)';
        for (let y = 0; y < 256; y += 32) { g.fillRect(10 + (y % 3) * 12, y, 14, 4); }
      });
      tex.repeat.set(1, 10);
      this.waterTex.push(tex);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const mid = (b.s0 + b.s1) / 2;
      this.track.pose(mid, 0, this.pose);
      const w = (b.s1 - b.s0) * 0.42;
      const geo = new THREE.PlaneGeometry(w, 160);
      const m = new THREE.Mesh(geo, mat);
      // dải suối nằm NGANG đường (dài 160 m theo hướng vuông góc với đường)
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = this.pose.yaw + Math.PI / 2;
      m.position.set(this.pose.pos.x, 0.01, this.pose.pos.z);
      // bờ cát nhạt 2 bên suối
      const bank = new THREE.Mesh(new THREE.PlaneGeometry(w + 4, 160), new THREE.MeshLambertMaterial({ color: 0xf5e2b4 }));
      bank.rotation.copy(m.rotation);
      bank.position.set(this.pose.pos.x, 0.0, this.pose.pos.z);
      m.receiveShadow = true;
      this.group.add(bank, m);
      this.disposables.push(geo, mat, tex, bank.geometry, bank.material as THREE.Material);
    }
  }

  // ------------------------------------------------------------------ đồ trang trí rải 2 bên (gộp theo đoạn)

  private async loadProp(name: string): Promise<THREE.Object3D> {
    const { obj } = await this.engine.instance(`models/props/${name}`);
    const map = RECOLOR[this.kind];
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      const src = m.material as THREE.MeshStandardMaterial;
      const c = map[src.name];
      if (c !== undefined) { const mm = src.clone(); mm.color.setHex(c); m.material = mm; }
    });
    return obj;
  }

  private async scatter(): Promise<void> {
    const th = this.def.theme;
    const total = th.props.reduce((a, p) => a + p[1], 0);
    const pickProp = () => {
      let r = this.rnd() * total;
      for (const p of th.props) { if ((r -= p[1]) <= 0) return p; }
      return th.props[0];
    };
    const protos = new Map<string, THREE.Object3D>();
    for (const [name] of th.props) if (name.endsWith('.glb') && !protos.has(name)) protos.set(name, await this.loadProp(name));
    if (this.kind === 'village') protos.set('tree_oak.glb', protos.get('tree_oak.glb') ?? await this.loadProp('tree_oak.glb'));
    const chunks = new Map<number, THREE.Group>();
    const chunkOf = (s: number) => {
      const k = Math.floor(s / CHUNK);
      let g = chunks.get(k);
      if (!g) { g = new THREE.Group(); chunks.set(k, g); }
      return g;
    };
    const tr = this.track;
    const place = (s: number, dist: number, side: number, far: boolean) => {
      tr.pose(s, side * (tr.width / 2 + dist), this.pose);
      const x = this.pose.pos.x, z = this.pose.pos.z;
      const [name, , smin, smax] = pickProp();
      const big = name === 'house' || name === 'tower';
      const clear = Math.min(tr.roadClearance(x, z), ...this.branches.map((b) => b.roadClearance(x, z)));
      if (clear < (big ? 4.5 : 1.2)) return;
      let obj: THREE.Object3D;
      if (name.endsWith('.glb')) {
        obj = protos.get(name)!.clone();
        obj.scale.setScalar((smin + this.rnd() * (smax - smin)) * (far ? 1.35 : 1));
      } else obj = this.procedural(name, protos);
      obj.position.set(x, 0, z);
      // nhà / tháp quay mặt ra đường, còn lại xoay ngẫu nhiên
      obj.rotation.y = big ? this.pose.yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2) : this.rnd() * Math.PI * 2;
      chunkOf(s).add(obj);
    };
    const step = this.kind === 'village' || this.kind === 'castle' ? 3.4 : 2.6;
    for (let s = 0; s < tr.length; s += step) {
      for (const side of [-1, 1]) {
        if (this.rnd() < 0.82) place(s + this.rnd() * step, 0.8 + this.rnd() * 9, side, false);
        if (this.rnd() < 0.55) place(s + this.rnd() * step, 11 + this.rnd() * 30, side, true);
      }
    }
    for (const g of chunks.values()) {
      this.mergeStatic(g);
      this.group.add(g);
    }
  }

  /** Đồ dựng bằng code: nhà làng, cây táo, pha lê, cụm mây nhỏ, tháp lâu đài. */
  private procedural(name: string, protos: Map<string, THREE.Object3D>): THREE.Object3D {
    const g = new THREE.Group();
    const r = this.rnd;
    const mat = (c: number, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e ? c : 0, emissiveIntensity: e });
    if (name === 'house') {
      const walls = [0xfff3e0, 0xffe1ec, 0xe6f4ff, 0xfff8c9, 0xe9ffe0];
      const roofs = [0xff7a7a, 0x7aa8ff, 0xffa64d, 0xb084ff, 0x5fc48a];
      const w = 3.6 + r() * 1.6, d = 3.4 + r() * 1.2, h = 2.6 + r() * 1.2;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(walls[Math.floor(r() * walls.length)]));
      body.position.y = h / 2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.2, 4), mat(roofs[Math.floor(r() * roofs.length)]));
      roof.position.y = h + 1.1; roof.rotation.y = Math.PI / 4;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.1), mat(0xb27148));
      door.position.set(0, 0.8, d / 2 + 0.02);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), mat(0x9fe0ff, 0.2));
      win.position.set(w * 0.28, h * 0.6, d / 2 + 0.02);
      const win2 = win.clone(); win2.position.x = -w * 0.28;
      g.add(body, roof, door, win, win2);
    } else if (name === 'apple_tree') {
      const tree = protos.get('tree_oak.glb')!.clone();
      tree.scale.setScalar(2.6 + r() * 0.6);
      g.add(tree);
      const apple = new THREE.IcosahedronGeometry(0.2, 0);
      const red = mat(0xff3b3b);
      for (let i = 0; i < 7; i++) {
        const a = new THREE.Mesh(apple, red);
        const th = r() * Math.PI * 2, rr = 0.8 + r() * 0.7;
        a.position.set(Math.cos(th) * rr, 2.0 + r() * 1.6, Math.sin(th) * rr);
        g.add(a);
      }
    } else if (name === 'crystal' || name === 'crystal_wall') {
      const cols = [0xffa8e0, 0xb8a8ff, 0x9fe8ff, 0xffe08a];
      const n = name === 'crystal_wall' ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const h = name === 'crystal_wall' ? 1.4 + r() * 0.4 : 1.2 + r() * 2.2;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.45, h, 6), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], emissive: cols[i % cols.length], emissiveIntensity: 0.25, roughness: 0.25, flatShading: true }));
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, h * 0.5, 6), m.material);
        const lat = name === 'crystal_wall' ? (i - (n - 1) / 2) * 1.5 : (r() - 0.5) * 1.2;
        m.position.set(lat, h * 0.5 + h * 0.5, name === 'crystal_wall' ? 0 : (r() - 0.5) * 1.2);
        base.position.set(m.position.x, h * 0.25, m.position.z);
        if (name !== 'crystal_wall') { m.rotation.z = (r() - 0.5) * 0.4; base.rotation.z = m.rotation.z; }
        g.add(m, base);
      }
    } else if (name === 'cloudlet') {
      const ball = new THREE.IcosahedronGeometry(1, 1);
      const white = mat(0xffffff, 0.15);
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(ball, white);
        b.scale.setScalar(0.7 + r() * 0.6);
        b.position.set((i - 1.5) * 0.9, 0.5 + r() * 0.3, (r() - 0.5) * 0.6);
        g.add(b);
      }
    } else if (name === 'tower') {
      const h = 6 + r() * 6;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, h, 12), mat(0xf6f2ff));
      body.position.y = h / 2;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.2, 12), mat(r() < 0.6 ? 0xffc94a : 0x8fa6ff));
      roof.position.y = h + 1.6;
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.1), mat(0xffe58a, 0.4));
      win.position.set(0, h * 0.65, 1.3);
      g.add(body, roof, win);
    } else if (name === 'hay') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 2.0, 14), mat(0xf2cf63));
      m.rotation.z = Math.PI / 2; m.position.y = 0.75;
      g.add(m);
    } else if (name === 'hedge') {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.25, 1.0), mat(0x5fbf6e));
      m.position.y = 0.62;
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mat(0xff8fc8));
      top.position.set(0, 1.3, 0);
      g.add(m, top);
    }
    return g;
  }

  /** Gộp mọi mesh tĩnh của 1 đoạn theo vật liệu (cùng màu = 1 draw call). Hình học dùng chung được nhân bản. */
  private mergeStatic(g: THREE.Group): void {
    g.updateMatrixWorld(true);
    const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
    const remove: THREE.Object3D[] = [];
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(k)) geo.deleteAttribute(k);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.applyMatrix4(m.matrixWorld);
      const mm = m.material as THREE.MeshStandardMaterial;
      const key = `${mm.type}|${mm.color?.getHexString()}|${mm.emissive?.getHexString()}|${(mm as THREE.MeshStandardMaterial).emissiveIntensity}|${mm.flatShading}`;
      let b = buckets.get(key);
      if (!b) {
        // vật liệu Lambert cho đồ tĩnh: rẻ hơn Standard trên iPad
        const flat = !!mm.flatShading;
        const lm = new THREE.MeshLambertMaterial({ color: mm.color, emissive: mm.emissive ?? 0x000000, emissiveIntensity: mm.emissiveIntensity ?? 0, flatShading: flat });
        b = { mat: lm, geos: [] };
        buckets.set(key, b);
        this.disposables.push(lm);
      }
      b.geos.push(geo);
      remove.push(m);
    });
    for (const m of remove) m.removeFromParent();
    g.clear();
    for (const b of buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      b.geos.forEach((x) => x.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.mat);
      mesh.receiveShadow = true;
      g.add(mesh);
      this.disposables.push(merged);
    }
  }

  /** Cổng xuất phát / đích: 2 cột + băng rôn ca-rô (đích có cờ cầu vồng). */
  private buildArch(s: number, finish: boolean): void {
    const tr = this.track;
    tr.pose(s, 0, this.pose);
    const g = new THREE.Group();
    const half = tr.width / 2 + 0.6;
    const postMat = new THREE.MeshLambertMaterial({ color: finish ? 0xffd166 : 0xffffff });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 5.2, 10), postMat);
      post.position.set(side * half, 2.6, 0);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshLambertMaterial({ color: finish ? 0xff5fa8 : 0x7fd3ff }));
      ball.position.set(side * half, 5.4, 0);
      g.add(post, ball);
    }
    const tex = canvasTex(512, 96, (c) => {
      const sq = 24;
      for (let y = 0; y < 96; y += sq) for (let x = 0; x < 512; x += sq) {
        c.fillStyle = ((x + y) / sq) % 2 ? '#3b2a5a' : '#ffffff'; c.fillRect(x, y, sq, sq);
      }
      c.fillStyle = finish ? '#ff5fa8' : '#58cc02';
      c.fillRect(150, 10, 212, 76);
      c.fillStyle = '#fff';
      c.font = '800 60px "Baloo 2", system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(finish ? 'ĐÍCH' : 'CHẠY!', 256, 52);
    }, false);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 1.2), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    banner.position.y = 4.4;
    // mặt chữ quay về phía Nhím chạy tới
    banner.rotation.y = Math.PI;
    g.add(banner);
    if (finish) {
      // vạch đích trên mặt đường
      const line = new THREE.Mesh(new THREE.PlaneGeometry(tr.width, 1.4), new THREE.MeshBasicMaterial({ map: tex }));
      line.rotation.x = -Math.PI / 2;
      line.position.y = 0.05;
      g.add(line);
    }
    g.position.copy(this.pose.pos);
    g.rotation.y = this.pose.yaw;
    this.group.add(g);
    this.disposables.push(tex, postMat);
  }

  // ------------------------------------------------------------------ chướng ngại vật

  /** Đặt 1 chướng ngại chắn ngang đường ở quãng s (bé phải bay qua). Trả về độ cao. */
  async addObstacle(s: number): Promise<Obstacle> {
    const th = this.def.theme;
    const name = th.obstacles[Math.floor(this.rnd() * th.obstacles.length)];
    const g = new THREE.Group();
    const tr = this.track;
    const W = tr.width;
    let h = 1.3;
    if (name === 'log_large.glb') {
      const o = await this.loadProp(name);
      this.engine.fitHeight(o, 1.0);
      const box = new THREE.Box3().setFromObject(o);
      const len = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
      const along = box.max.x - box.min.x >= box.max.z - box.min.z;
      const piv = new THREE.Group();
      piv.add(o);
      piv.scale.set(W / len, 1, 1);
      if (!along) piv.rotation.y = Math.PI / 2;
      g.add(piv);
      h = 1.0;
    } else if (name === 'fence_planks.glb' || name === 'fence_simple.glb') {
      const o = await this.loadProp(name);
      this.engine.fitHeight(o, 1.2);
      const box = new THREE.Box3().setFromObject(o);
      const len = Math.max(0.5, box.max.x - box.min.x);
      for (let x = -W / 2 + len / 2; x <= W / 2; x += len) { const c = o.clone(); c.position.x += x; g.add(c); }
      h = 1.2;
    } else if (name.endsWith('.glb')) {
      const o = await this.loadProp(name);
      this.engine.fitHeight(o, 1.25);
      for (const lat of [-W / 3, 0, W / 3]) { const c = o.clone(); c.position.x += lat; c.rotation.y = this.rnd() * 6.28; g.add(c); }
      h = 1.25;
    } else {
      if (name === 'crystal_wall') { g.add(this.procedural('crystal_wall', new Map())); h = 1.6; }
      else for (const lat of [-W / 3, 0, W / 3]) { const p = this.procedural(name, new Map()); p.position.x = lat; g.add(p); h = name === 'hay' ? 1.5 : 1.4; }
    }
    // vòng sáng mờ trên mặt đường báo trước (bé để ý)
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(W, 2.6), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.32, depthWrite: false }));
    warn.rotation.x = -Math.PI / 2; warn.position.set(0, 0.06, -2.2);
    g.add(warn);
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = false; });
    tr.pose(s, 0, this.pose);
    g.position.copy(this.pose.pos);
    g.rotation.y = this.pose.yaw;
    this.group.add(g);
    const ob: Obstacle = { s, h, group: g, hit: false };
    this.obstacles.push(ob);
    return ob;
  }

  /** Chướng ngại vỡ tung khi bé vấp vào (không phạt, chỉ chậm lại). */
  smash(ob: Obstacle): void {
    ob.hit = true;
    const c = ob.group.position.clone().add(new THREE.Vector3(0, 0.8, 0));
    this.engine.magic.burst(c, 40, 0xffe08a, 3, 0.3, 0.8, -4);
    ob.group.visible = false;
  }

  // ------------------------------------------------------------------ ngọc

  /** Thêm hàng ngọc: n viên từ quãng s, cách nhau gap m, lệch lat (vòm ngọc qua chướng ngại: arc = độ cao vòm). */
  addGems(s: number, n: number, gap: number, lat: number, arc = 0): void {
    for (let i = 0; i < n; i++) {
      const y = 1.0 + (arc ? Math.sin((i / Math.max(1, n - 1)) * Math.PI) * arc : 0);
      this.gems.push({ s: s + i * gap, lat, y, taken: false, pos: new THREE.Vector3() });
    }
  }

  private buildGems(): void {
    if (!this.gems.length) return;
    const geo = new THREE.OctahedronGeometry(0.34, 0);
    geo.scale(1, 1.35, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x7fe3ff, emissive: 0x4fb3ff, emissiveIntensity: 0.55, roughness: 0.25, flatShading: true });
    this.gemMesh = new THREE.InstancedMesh(geo, mat, this.gems.length);
    const colors = [0x7fe3ff, 0xff8fd0, 0xffe066, 0xb28cff, 0x8ff0a4];
    this.gems.forEach((g, i) => {
      this.track.pose(g.s, g.lat, this.pose);
      g.pos.copy(this.pose.pos); g.pos.y += g.y;
      this.gemMesh!.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    });
    this.gemMesh.frustumCulled = false;
    this.group.add(this.gemMesh);
    this.disposables.push(geo, mat);
  }

  /** Nhặt ngọc quanh điểm p (bán kính r). Trả về số viên nhặt. */
  collectGems(p: THREE.Vector3, r = 1.3): number {
    let n = 0;
    for (const g of this.gems) {
      if (g.taken) continue;
      const dx = g.pos.x - p.x, dz = g.pos.z - p.z, dy = g.pos.y - p.y - 0.9;
      if (dx * dx + dz * dz < r * r && Math.abs(dy) < 1.6) {
        g.taken = true; n++;
        this.engine.magic.burst(g.pos, 14, 0x9fe8ff, 1.8, 0.22, 0.5, -1);
        this.onGem?.(g.pos);
      }
    }
    return n;
  }

  // ------------------------------------------------------------------ trời: mây, chim, bướm

  private buildClouds(): void {
    const b = this.track.bounds;
    const c = b.getCenter(new THREE.Vector3());
    const span = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2 + 120;
    const sky = this.kind === 'sky';
    const clusters = sky ? 70 : 34, per = 4;
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: sky ? 0.35 : 0.25 });
    const mesh = new THREE.InstancedMesh(geo, mat, clusters * per);
    const r = this.rnd;
    let k = 0;
    for (let i = 0; i < clusters; i++) {
      let x: number, y: number, z: number;
      if (sky) {
        // mây quanh đường bay, tránh đường bay ±7 m
        // mây quanh đường bay nhưng không che: cách ngang ≥ 15 m, cao / thấp hơn đường bay
        const s = r() * this.track.length;
        const side = r() < 0.5 ? -1 : 1;
        this.track.pose(s, side * (15 + r() * 45), this.pose);
        x = this.pose.pos.x; z = this.pose.pos.z; y = this.pose.pos.y + (r() < 0.65 ? -5 - r() * 14 : 7 + r() * 10);
      } else {
        const a = r() * Math.PI * 2, d = span * (0.5 + r() * 0.6);
        x = c.x + Math.cos(a) * d; z = c.z + Math.sin(a) * d; y = 30 + r() * 26;
      }
      const sc = sky ? 3 + r() * 4 : 4 + r() * 5;
      for (let j = 0; j < per; j++) {
        this.tmp.position.set(x + (j - 1.5) * sc * 0.9, y + r() * sc * 0.3, z + (r() - 0.5) * sc * 0.6);
        this.tmp.scale.set(sc * (0.8 + r() * 0.5), sc * (0.55 + r() * 0.3), sc * (0.8 + r() * 0.4));
        this.tmp.rotation.set(0, r() * 3, 0);
        this.tmp.updateMatrix();
        mesh.setMatrixAt(k++, this.tmp.matrix);
      }
    }
    mesh.computeBoundingSphere();
    this.group.add(mesh);
    this.disposables.push(geo, mat);
  }

  private buildBirds(): void {
    const n = 12;
    const r = this.rnd;
    for (let i = 0; i < n; i++) this.birds.push({ s: r() * this.track.length, r: 6 + r() * 14, h: 7 + r() * 9, phase: r() * 10, speed: 0.25 + r() * 0.3 });
    const body = new THREE.SphereGeometry(0.22, 8, 6); body.scale(1, 0.8, 1.8);
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.18, 0, 0, 0.22, 0.75, 0, 0], 3));
    wing.computeVertexNormals();
    const bodyMat = new THREE.MeshLambertMaterial({ color: this.kind === 'sky' ? 0xffffff : 0x6aa8ff });
    const wingMat = new THREE.MeshLambertMaterial({ color: this.kind === 'sky' ? 0xfff0fb : 0x9cc8ff, side: THREE.DoubleSide });
    this.birdBody = new THREE.InstancedMesh(body, bodyMat, n);
    for (let w = 0; w < 2; w++) {
      const g = wing.clone();
      if (w === 1) g.scale(-1, 1, 1);
      this.birdWings.push(new THREE.InstancedMesh(g, wingMat, n));
    }
    for (const m of [this.birdBody, ...this.birdWings]) { m.frustumCulled = false; this.group.add(m); }
    this.disposables.push(body, wing, bodyMat, wingMat, ...this.birdWings.map((m) => m.geometry));
  }

  private buildButterflies(): void {
    const n = 14;
    const r = this.rnd;
    for (let i = 0; i < n; i++) this.flies.push({ s: r() * this.track.length, lat: (r() < 0.5 ? -1 : 1) * (this.track.width / 2 + 0.5 + r() * 4), h: 0.8 + r() * 1.6, phase: r() * 10 });
    const tex = this.engine.emojiTexture('🦋');
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.05 });
    const geo = new THREE.PlaneGeometry(0.7, 0.7);
    this.flyMesh = new THREE.InstancedMesh(geo, mat, n);
    this.flyMesh.frustumCulled = false;
    this.group.add(this.flyMesh);
    this.disposables.push(geo, mat);
  }

  // ------------------------------------------------------------------ màn cuối: bầu trời

  private buildSkyWorld(): void {
    // biển mây bên dưới
    const tex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#f7ecff'; g.fillRect(0, 0, 256, 256);
      const r = mulberry32(3);
      for (let i = 0; i < 70; i++) {
        const x = r() * 256, y = r() * 256, rr = 14 + r() * 30;
        const grad = g.createRadialGradient(x, y, 0, x, y, rr);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
      }
    });
    const b = this.track.bounds, c = b.getCenter(new THREE.Vector3());
    tex.repeat.set(14, 14);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ map: tex, emissive: 0xd8c8ff, emissiveIntensity: 0.25 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(c.x, this.track.baseY - 34, c.z);
    this.group.add(sea);
    this.disposables.push(tex, sea.geometry, sea.material as THREE.Material);
    // cầu vồng lớn quanh đường bay
    for (let i = 0; i < 4; i++) {
      const s = (i + 0.3) * this.track.length / 4;
      this.track.pose(s, (i % 2 ? -1 : 1) * 30, this.pose);
      const rb = this.rainbowArc(26 + i * 4);
      rb.position.set(this.pose.pos.x, this.track.baseY - 30, this.pose.pos.z);
      rb.rotation.y = this.pose.yaw + Math.PI / 2;
      this.group.add(rb);
    }
    // hàng ngọc trên đường bay (không đặt vòng mây trang trí: dễ lẫn với 2 vòng mây đáp án)
    for (let s = 20; s < this.track.length; s += 45) this.addGems(s - 2, 5, 1, 0, 0.6);
    // sao đêm (Nữ hoàng Bóng Đêm) — tắt dần khi bình minh
    const n = 400, pos = new Float32Array(n * 3), r = mulberry32(8);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2, ph = r() * 0.45 * Math.PI;
      pos[i * 3] = Math.cos(th) * Math.cos(ph) * 190; pos[i * 3 + 1] = Math.sin(ph) * 190 + 10; pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * 190;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff6d0, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
    this.disposables.push(sg, this.stars.material as THREE.Material);
  }

  /** Cầu vồng nửa vòng 7 dải (1 mesh, màu đỉnh). */
  private rainbowArc(R: number): THREE.Mesh {
    const bands = [0xff4d6d, 0xff9a3c, 0xffd93d, 0x6bd968, 0x4fb3ff, 0x7b6cff, 0xc86bff];
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const seg = 48, bw = 1.3;
    const cc = new THREE.Color();
    bands.forEach((b, k) => {
      cc.setHex(b);
      const r0 = R - k * bw, r1 = r0 - bw;
      const base = pos.length / 3;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI;
        pos.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
        col.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
        if (i < seg) { const v = base + i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    this.disposables.push(g, m.material as THREE.Material);
    return m;
  }

  /** Sao đêm mờ dần (k: 1 = đêm, 0 = ngày). */
  setNight(k: number): void {
    if (this.stars) { (this.stars.material as THREE.PointsMaterial).opacity = 0.9 * k; this.stars.visible = k > 0.02; }
  }

  // ------------------------------------------------------------------ mỗi khung

  update(dt: number, t: number, playerS: number, cam: THREE.Camera): void {
    for (const tx of this.waterTex) tx.offset.y -= dt * 0.35;
    if (this.gemMesh) {
      this.gems.forEach((g, i) => {
        this.tmp.position.copy(g.pos);
        this.tmp.position.y += Math.sin(t * 3 + g.s) * 0.1;
        this.tmp.rotation.set(0, t * 2.2 + g.s, 0);
        this.tmp.scale.setScalar(g.taken ? 0.0001 : 1);
        this.tmp.updateMatrix();
        this.gemMesh!.setMatrixAt(i, this.tmp.matrix);
      });
      this.gemMesh.instanceMatrix.needsUpdate = true;
    }
    // chim bay vòng phía trước Nhím (luôn có chim trong tầm nhìn)
    if (this.birdBody) {
      const L = this.track.length;
      this.birds.forEach((b, i) => {
        let d = b.s - playerS;
        if (d < -20) b.s += 140 + this.rnd() * 60;
        if (d > 220) b.s -= 200;
        d = b.s - playerS;
        const a = t * b.speed + b.phase;
        this.track.pose(((b.s % L) + L) % L, Math.sin(a) * b.r, this.pose);
        const p = this.pose.pos;
        this.tmp.position.set(p.x, p.y + b.h + Math.sin(a * 2) * 1.2, p.z);
        this.tmp.rotation.set(0, this.pose.yaw + Math.cos(a) * 0.9, 0);
        this.tmp.scale.setScalar(this.kind === 'sky' ? 1.6 : 1.2);
        this.tmp.updateMatrix();
        this.birdBody!.setMatrixAt(i, this.tmp.matrix);
        const flap = Math.sin(t * 11 + b.phase) * 0.7;
        for (let w = 0; w < 2; w++) {
          this.tmp.rotation.set(0, this.pose.yaw + Math.cos(a) * 0.9, (w ? -1 : 1) * flap, 'YXZ');
          this.tmp.updateMatrix();
          this.birdWings[w].setMatrixAt(i, this.tmp.matrix);
        }
      });
      this.birdBody.instanceMatrix.needsUpdate = true;
      for (const w of this.birdWings) w.instanceMatrix.needsUpdate = true;
    }
    // bướm: bảng quay về camera, vỗ cánh (co giãn ngang)
    if (this.flyMesh) {
      const q = cam.quaternion;
      this.flies.forEach((f, i) => {
        const d = f.s - playerS;
        if (d < -12) f.s += 90 + this.rnd() * 50;
        if (d > 160) f.s -= 150;
        const a = t * 1.4 + f.phase;
        this.track.pose(f.s + Math.sin(a) * 1.5, f.lat + Math.cos(a * 0.8) * 0.8, this.pose);
        this.tmp.position.set(this.pose.pos.x, this.pose.pos.y + f.h + Math.sin(a * 2.3) * 0.35, this.pose.pos.z);
        this.tmp.quaternion.copy(q);
        const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 13 + f.phase));
        this.tmp.scale.set(flap, 1, 1);
        this.tmp.updateMatrix();
        this.flyMesh!.setMatrixAt(i, this.tmp.matrix);
      });
      this.flyMesh.instanceMatrix.needsUpdate = true;
      this.tmp.quaternion.identity();
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => { const m = o as THREE.InstancedMesh; if (m.isInstancedMesh) m.dispose(); });
    for (const d of this.disposables) d.dispose();
  }
}
