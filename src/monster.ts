// Quái dễ thương (GLB Quaternius / poly.pizza) bị BÓNG TỐI NHẬP: tím đậm, mắt phát sáng, khói tím bốc lên.
// Trên đường: chạy theo (bị đuổi) hoặc chạy trước ôm bong bóng nhốt bạn (đuổi quái). Bắn cầu phép tím, cười khi bé sai,
// được THANH TẨY khi thua: nổ sao, về màu thật, nhảy múa.
import * as THREE from 'three';
import type { MonsterKind } from './data';
import type { Engine } from './engine';
import { tween, easeOutQuad } from './tween';
import { glowTexture } from './letterstar';

interface KindDef {
  file: string;
  h: number;
  /** bay lơ lửng */
  hover?: number;
  idle: string;
  run: string;
  happy: string;
  hurt?: string;
  /** model không có vật liệu mắt → 2 đốm sáng [cao, lệch ngang, ra trước] theo h */
  eyes?: [number, number, number];
  /** màu thật khi thanh tẩy cho vật liệu tối (tên vật liệu → màu) */
  purified?: Record<string, number>;
}

export const MONSTERS: Record<MonsterKind, KindDef> = {
  slime_jt: { file: 'slime_enemy_j_toastie.glb', h: 1.1, idle: 'Hop', run: 'Hop', happy: 'Hop' },
  ghost: {
    file: 'ghost_quaternius.glb', h: 1.7, hover: 0.5, idle: 'Flying_Idle', run: 'Fast_Flying', happy: 'Yes', hurt: 'HitReact',
    purified: { Ghost_Main: 0xf3eaff, Eye_White: 0xffffff, Eye_Black: 0x3b2a5a },
  },
  goblin: { file: 'goblin_quaternius.glb', h: 1.6, idle: 'Idle', run: 'Run', happy: 'Jump', hurt: 'HitRecieve', eyes: [0.73, 0.14, 0.24] },
  dragon: {
    file: 'dragon_quaternius.glb', h: 1.6, hover: 0.8, idle: 'Dragon_Flying', run: 'Dragon_Flying', happy: 'Dragon_Flying', hurt: 'Dragon_Hit',
    purified: { Main: 0x6fd6a8, Belly: 0xffe08a, Wings: 0x8fd0ff, Claws: 0xfff4d6 },
  },
  dragon_ev: { file: 'dragon_evolved_quaternius.glb', h: 1.7, hover: 0.7, idle: 'Flying_Idle', run: 'Fast_Flying', happy: 'Yes', hurt: 'HitReact' },
  wizard: { file: 'animated_wizard_quaternius.glb', h: 1.7, idle: 'Idle', run: 'Run', happy: 'Spell1', hurt: 'RecieveHit', eyes: [0.8, 0.04, 0.16] },
  witch: { file: 'witch_quaternius.glb', h: 1.8, idle: 'Idle', run: 'Run', happy: 'Wave', hurt: 'HitRecieve', eyes: [0.86, 0.035, 0.1] },
};

const SHADOW = new THREE.Color(0x7a3fd8);
const SHADOW_EMISSIVE = new THREE.Color(0x4a16a0);
const EYE_GLOW = new THREE.Color(0xff5ce1);

interface MatRec { mat: THREE.MeshStandardMaterial; true: THREE.Color; emissive: THREE.Color; eye: boolean; textured: boolean }

export class Monster {
  readonly root = new THREE.Group();
  readonly pivot = new THREE.Group();
  possessed = true;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private mats: MatRec[] = [];
  private eyeSprites: THREE.Sprite[] = [];
  private aura: THREE.Sprite;
  private t = Math.random() * 10;
  private wispT = 0;
  readonly hover: number;
  readonly h: number;
  /** hiện đang chạy (đổi clip run / idle) */
  private running = false;
  busy = false;

  private constructor(private engine: Engine, readonly kind: MonsterKind, obj: THREE.Object3D, clips: THREE.AnimationClip[]) {
    const def = MONSTERS[kind];
    this.hover = def.hover ?? 0;
    this.h = def.h;
    this.root.add(this.pivot);
    this.pivot.add(obj);
    engine.fitHeight(obj, def.h);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      m.frustumCulled = false;
      const list = (Array.isArray(m.material) ? m.material : [m.material]).map((src) => {
        const mat = (src as THREE.MeshStandardMaterial).clone();
        mat.metalness = 0; mat.roughness = 0.75;
        const eye = /eye/i.test(src.name) && mat.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.45;
        const tr = def.purified?.[src.name];
        this.mats.push({ mat, true: tr !== undefined ? new THREE.Color(tr) : mat.color.clone(), emissive: mat.emissive.clone(), eye, textured: !!mat.map });
        return mat;
      });
      m.material = Array.isArray(m.material) ? list : list[0];
    });
    if (def.eyes) {
      const [y, dx, dz] = def.eyes;
      for (const s of [-1, 1]) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: EYE_GLOW, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        sp.scale.setScalar(def.h * 0.13);
        sp.position.set(s * dx * def.h, y * def.h, dz * def.h);
        this.pivot.add(sp);
        this.eyeSprites.push(sp);
      }
    }
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x7a3cff, transparent: true, depthWrite: false, opacity: 0.5 }));
    this.aura.scale.setScalar(def.h * 2.2);
    this.aura.position.set(0, def.h * 0.5, -0.3);
    this.pivot.add(this.aura);
    this.mixer = new THREE.AnimationMixer(obj);
    for (const c of clips) this.actions.set(c.name.split('|').pop()!, this.mixer.clipAction(c));
    this.setPossessed(1);
    this.play(def.idle);
    this.mixer.update(Math.random() * 2);
  }

  static async create(engine: Engine, kind: MonsterKind): Promise<Monster> {
    const { obj, clips } = await engine.instance(`models/monsters/${MONSTERS[kind].file}`);
    return new Monster(engine, kind, obj, clips);
  }

  private play(name: string, fade = 0.25, once = false): THREE.AnimationAction | null {
    const a = this.actions.get(name) ?? this.actions.get(MONSTERS[this.kind].idle) ?? [...this.actions.values()][0];
    if (!a) return null;
    if (a === this.current && !once) return a;
    a.reset().setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity).fadeIn(fade).play();
    a.clampWhenFinished = once;
    this.current?.fadeOut(fade);
    this.current = a;
    return a;
  }

  /** Chạy / đứng (đổi clip khi đổi trạng thái). */
  setRunning(on: boolean): void {
    if (on === this.running || this.busy) return;
    this.running = on;
    const def = MONSTERS[this.kind];
    this.play(on ? (this.possessed ? def.run : def.happy) : (this.possessed ? def.idle : def.happy));
  }

  place(pos: THREE.Vector3, yaw: number, y = 0): void {
    this.root.position.set(pos.x, pos.y + this.hover + y, pos.z);
    this.root.rotation.y = yaw;
  }

  center(): THREE.Vector3 { return this.root.localToWorld(new THREE.Vector3(0, this.h * 0.55, 0)); }

  /** k = 1: bị nhập hoàn toàn; 0: màu thật. */
  private setPossessed(k: number): void {
    for (const r of this.mats) {
      if (r.textured) r.mat.color.copy(r.true).lerp(new THREE.Color(0x8a6ad8), k * 0.75);
      else r.mat.color.copy(r.true).lerp(SHADOW, k * 0.7);
      if (r.eye) { r.mat.emissive.copy(r.emissive).lerp(EYE_GLOW, k); r.mat.emissiveIntensity = 1 + k * 1.5; }
      else { r.mat.emissive.copy(r.emissive).lerp(SHADOW_EMISSIVE, k); r.mat.emissiveIntensity = 1; }
    }
    for (const s of this.eyeSprites) { s.material.opacity = k; s.visible = k > 0.02; }
    this.aura.material.opacity = 0.5 * k; this.aura.visible = k > 0.02;
  }

  /** Chuẩn bị bắn: phồng lên, tay giơ. */
  async charge(): Promise<void> {
    await tween(350, (k) => { this.pivot.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.18); });
    this.pivot.scale.setScalar(1);
  }

  /** Trúng phép của Nhím: loé trắng, nảy, clip đau. */
  async hurt(): Promise<void> {
    this.busy = true;
    const def = MONSTERS[this.kind];
    if (def.hurt) this.play(def.hurt, 0.1, true);
    this.engine.magic.burst(this.center(), 50, 0xffffff, 2.6, 0.3, 0.7, -1);
    await tween(600, (k) => { this.pivot.rotation.z = Math.sin(k * Math.PI * 5) * 0.3 * (1 - k); this.pivot.position.y = Math.sin(k * Math.PI) * 0.6; });
    this.pivot.rotation.z = 0; this.pivot.position.y = 0;
    this.busy = false;
    // trả lại clip chạy / đứng như trước khi bị trúng
    const was = this.running;
    this.running = !was;
    this.setRunning(was);
  }

  /** Cười khi bé sai. */
  async giggle(): Promise<void> {
    await tween(600, (k) => { this.pivot.rotation.z = Math.sin(k * Math.PI * 4) * 0.16 * (1 - k); this.pivot.position.y = Math.abs(Math.sin(k * Math.PI * 3)) * 0.3; });
    this.pivot.rotation.z = 0; this.pivot.position.y = 0;
  }

  /** Thanh tẩy: nổ sao, màu thật, xoay + nhảy múa. */
  async purify(): Promise<void> {
    if (!this.possessed) return;
    this.possessed = false;
    const c = this.center();
    this.engine.magic.burst(c, 110, 0xffffff, 3.2, 0.34, 1.0, -1);
    this.engine.magic.burst(c, 70, 0xffd166, 2.6, 0.3, 0.9, -1);
    this.engine.magic.ring(this.root.position.clone().add(new THREE.Vector3(0, 0.15, 0)), 0xff9ad8, 60, 2.2);
    this.busy = true;
    await tween(900, (k) => {
      this.setPossessed(1 - k);
      this.pivot.position.y = Math.sin(k * Math.PI) * 0.9;
      this.pivot.rotation.y = k * Math.PI * 2;
    }, easeOutQuad);
    this.pivot.rotation.y = 0; this.pivot.position.y = 0;
    this.busy = false;
    this.play(MONSTERS[this.kind].happy);
  }

  update(gdt: number, dt: number): void {
    this.t += dt;
    this.mixer.update(gdt);
    if (this.hover && !this.busy) this.pivot.position.y = Math.sin(this.t * 1.6) * 0.14;
    if (this.possessed && this.root.visible) {
      this.wispT += dt;
      while (this.wispT > 0.12) {
        this.wispT -= 0.12;
        const a = Math.random() * Math.PI * 2, r = this.h * 0.4;
        const p = this.root.position;
        this.engine.shadow.emit({
          x: p.x + Math.cos(a) * r, y: p.y + 0.2 + Math.random() * this.h * 0.6, z: p.z + Math.sin(a) * r,
          color: Math.random() < 0.6 ? 0x6a3cc8 : 0x9b5cff, vy: 0.7, max: 0.9, size: 0.32,
        });
      }
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.mixer.stopAllAction();
    for (const r of this.mats) r.mat.dispose();
    for (const s of this.eyeSprites) s.material.dispose();
    this.aura.material.dispose();
  }
}
