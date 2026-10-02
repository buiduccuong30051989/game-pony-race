// Pony chạy trên đường: Nhím (Twilight), người nhà đua cùng, bạn ngựa nhỏ trong bong bóng, Nữ hoàng Bóng Đêm.
// Model không xương → auto-rig 4 chân phi nước đại (rig.ts); công chúa có xương sẵn → vỗ cánh, bay lơ lửng (makeFlyer).
// Mọi pony trừ Nhím dùng bóng tròn mờ dưới chân thay bóng đổ thật (nhẹ cho iPad).
import * as THREE from 'three';
import { CAST, type CastId } from './data';
import type { Engine } from './engine';
import { autoRigQuadruped, makeFlyer, type Walker, type WalkerPose } from './rig';
import { tween, easeOutQuad } from './tween';

let blobTex: THREE.CanvasTexture | null = null;
function blobShadow(radius: number): THREE.Mesh {
  if (!blobTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(40,30,70,0.5)');
    grad.addColorStop(0.6, 'rgba(40,30,70,0.22)');
    grad.addColorStop(1, 'rgba(40,30,70,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

/** Đôi cánh ánh sáng (Twilight không có xương cánh): sprite cộng màu, vỗ bằng co giãn. */
export function lightWings(): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  for (const s of [-1, 1]) {
    const grad = g.createRadialGradient(256 + s * 120, 128, 10, 256 + s * 120, 128, 140);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.5, 'rgba(230,190,255,0.6)');
    grad.addColorStop(1, 'rgba(230,190,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(256 + s * 130, 120, 130, 66, s * -0.4, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.position.set(0, 1.35, -0.1);
  sp.visible = false;
  return sp;
}

export class Pony {
  /** vị trí + hướng trên đường */
  readonly root = new THREE.Group();
  /** nhún, nghiêng, lộn vòng (diễn) */
  readonly pivot = new THREE.Group();
  readonly model: THREE.Object3D;
  readonly wings: THREE.Sprite;
  private readonly blob: THREE.Mesh | null;
  private animT = Math.random() * 10;
  private t = 0;
  private walkK = 0;
  /** 0..1: đang chạy nhanh cỡ nào (đặt từ ngoài mỗi khung) */
  run = 0;
  /** đang bay (cánh ánh sáng / vỗ cánh) */
  flying = false;
  /** độ cao lơ lửng của công chúa */
  readonly hover: number;
  private landSquash = 0;
  /** đang diễn tween trên pivot */
  busy = false;
  /** độ dốc mặt đường (rad, âm = lên dốc) */
  private slope = 0;

  private constructor(readonly id: CastId, model: THREE.Object3D, private readonly walker: (Walker & { flap?: number }) | null, shadow: 'real' | 'blob' | 'none') {
    this.model = model;
    const def = CAST[id];
    this.hover = def.kind === 'flyer' ? 0.45 : 0;
    this.pivot.add(model);
    this.root.add(this.pivot);
    this.wings = lightWings();
    this.wings.position.y = def.height * 0.78;
    this.root.add(this.wings);
    if (shadow === 'real') model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
    this.blob = shadow === 'blob' ? blobShadow(def.height * 0.42) : null;
    if (this.blob) this.root.add(this.blob);
  }

  static async load(engine: Engine, id: CastId, shadow: 'real' | 'blob' | 'none' = 'blob'): Promise<Pony> {
    const def = CAST[id];
    const { obj } = await engine.instance(def.model);
    engine.fitHeight(obj, def.height);
    let skinned = false;
    obj.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
    let walker: (Walker & { flap?: number }) | null = null;
    if (def.kind === 'flyer') walker = makeFlyer(obj);
    else if (!skinned) walker = autoRigQuadruped(obj);
    if (!walker) console.warn('[pony] không rig được', id);
    const p = new Pony(id, obj, walker, shadow);
    // xương động làm hộp bao lệch → đừng để pony biến mất ở mép màn hình
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.frustumCulled = false; });
    return p;
  }

  get height(): number { return CAST[this.id].height; }
  get flyer(): boolean { return CAST[this.id].kind === 'flyer'; }

  /** Đặt lên đường: vị trí chân, hướng nhìn, nghiêng dốc. y = độ cao thêm (nhảy / bay). */
  place(pos: THREE.Vector3, yaw: number, pitch: number, y: number): void {
    this.root.position.set(pos.x, pos.y + y + this.hover, pos.z);
    this.root.rotation.set(0, yaw, 0);
    this.slope = pitch;
    if (this.blob) {
      this.blob.position.y = -(y + this.hover) + 0.05;
      this.blob.scale.setScalar(Math.max(0.35, 1 - (y + this.hover) * 0.18));
    }
  }

  /** dt game: chân phi theo tốc độ, cánh vỗ khi bay, ép dẹt khi tiếp đất. */
  update(gdt: number, dt: number): void {
    this.t += dt;
    this.walkK += (this.run - this.walkK) * Math.min(1, gdt * 10);
    // nhịp chân theo tốc độ: chạy nhanh thì bước dày hơn
    this.animT += gdt * (this.flying ? 0.35 : 0.55 + 0.75 * this.walkK);
    if (this.walker && 'flap' in this.walker) this.walker.flap = this.flying ? 0.9 : 0.35 + 0.4 * this.walkK;
    const k = this.flying && !this.flyer ? 0.25 : this.walkK;
    const pose = (this.walker?.update(this.animT, k, this.root.rotation.y) as WalkerPose | undefined) ?? null;
    if (!this.busy) {
      const p = this.pivot;
      let bob = 0, roll = 0, sy = 1, sx = 1, pitch = 0;
      if (pose) { bob = pose.bob; pitch = pose.pitch; roll = pose.roll; }
      else if (this.walkK > 0.02) { const w = this.animT * 12; bob = Math.abs(Math.sin(w)) * 0.14 * this.walkK; }
      if (this.flyer) bob += Math.sin(this.t * 1.8) * 0.1;
      if (this.flying) { pitch -= 0.12; bob += Math.sin(this.t * 3) * 0.08; }
      if (this.landSquash > 0) {
        this.landSquash = Math.max(0, this.landSquash - dt * 5);
        const q = Math.sin(this.landSquash * Math.PI);
        sy = 1 - q * 0.16; sx = 1 + q * 0.1;
      }
      p.position.y = bob;
      p.rotation.x = pitch + this.slope * 0.8;
      p.rotation.z = roll;
      p.scale.set(sx, sy, sx);
    }
    this.wings.visible = this.flying && !this.flyer;
    if (this.wings.visible) {
      const flap = 0.75 + 0.25 * Math.sin(this.t * 13);
      this.wings.scale.set(3.4 * flap, 1.9, 1);
    }
  }

  land(): void { this.landSquash = 1; }

  /** Lộn vòng khi vấp (không đau, kiểu hoạt hình). */
  async tumble(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await tween(650, (k) => {
      this.pivot.rotation.x = -k * Math.PI * 2;
      this.pivot.position.y = Math.sin(k * Math.PI) * 0.9;
      this.pivot.scale.setScalar(1);
    }, easeOutQuad);
    this.pivot.rotation.x = 0; this.pivot.position.y = 0;
    this.busy = false;
  }

  /** Nhảy xoay ăn mừng. */
  async celebrate(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await tween(750, (k) => {
      this.pivot.position.y = Math.sin(k * Math.PI) * 1.2;
      this.pivot.rotation.y = k * Math.PI * 2;
    }, easeOutQuad);
    this.pivot.rotation.y = 0; this.pivot.position.y = 0;
    this.busy = false;
  }

  /** Né sang ngang (lật nghiêng) — phần dời vị trí do Runner lo. */
  async barrel(dir: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await tween(520, (k) => { this.pivot.rotation.z = -dir * k * Math.PI * 2; this.pivot.position.y = Math.sin(k * Math.PI) * 0.6; }, easeOutQuad);
    this.pivot.rotation.z = 0; this.pivot.position.y = 0;
    this.busy = false;
  }

  /** Bị trúng phép: rung + loé tím. */
  async hit(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await tween(600, (k) => { this.pivot.rotation.z = Math.sin(k * Math.PI * 6) * 0.25 * (1 - k); this.pivot.position.y = Math.sin(k * Math.PI) * 0.4; });
    this.pivot.rotation.z = 0; this.pivot.position.y = 0;
    this.busy = false;
  }

  /** Điểm giữa người / sừng (bắn phép, gắn hạt). */
  center(): THREE.Vector3 { return this.root.localToWorld(new THREE.Vector3(0, this.height * 0.6, 0)); }
  horn(): THREE.Vector3 { return this.root.localToWorld(new THREE.Vector3(0, this.height * 0.93, this.height * 0.3)); }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((o) => { const sm = o as THREE.SkinnedMesh; if (sm.isSkinnedMesh) sm.skeleton.dispose(); });
    if (this.blob) { this.blob.geometry.dispose(); (this.blob.material as THREE.Material).dispose(); }
    this.wings.material.map?.dispose();
    this.wings.material.dispose();
  }
}
