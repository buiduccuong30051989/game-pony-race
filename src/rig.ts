// Cho model "cứng" chạy được (port từ game 5):
//  - Ngựa (không xương): tự gắn xương (thân + 4 chân 2 khúc + đầu + đuôi) theo hình học rồi phi nước đại.
//  - Công chúa có xương sẵn (Celestia, Luna, Nightmare Moon): vỗ cánh, đung đưa chân, vẫy đuôi.
import * as THREE from 'three';

export interface WalkerPose { bob: number; pitch: number; roll: number }
/** Điều khiển thêm khi đứng chơi: ngó trái/phải (yaw), cúi/ngẩng (pitch), phẩy đuôi mạnh hơn (tail 0..1). */
export interface WalkerLook { yaw: number; pitch: number; tail: number }
export interface Walker {
  /** t: giây, k: 0..1 mức độ đang đi, yaw: hướng nhân vật (world). Trả về nhún thân nếu walker tự lo. */
  update(t: number, k: number, yaw: number): WalkerPose | void;
  /** có nếu walker biết quay đầu / phẩy đuôi (ngựa auto-rig) */
  look?: WalkerLook;
}

const Y = new THREE.Vector3(0, 1, 0);

// ---------------- Ngựa: auto-rig thân + 4 chân 2 khúc + đầu + đuôi ----------------

interface Frame { up: THREE.Vector3; fwd: THREE.Vector3; lat: THREE.Vector3 } // trục local đã nhân dấu
interface Fields { h: Float32Array; f: Float32Array; l: Float32Array; hMin: number; hMax: number; fMin: number; fMax: number }

function frameOf(mesh: THREE.Mesh): Frame {
  const rot = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const pick = (target: THREE.Vector3): THREE.Vector3 => {
    let best = axes[0], bd = -1, sign = 1;
    for (const a of axes) {
      const d = a.clone().applyMatrix3(rot).normalize().dot(target);
      if (Math.abs(d) > bd) { bd = Math.abs(d); best = a; sign = d >= 0 ? 1 : -1; }
    }
    return best.clone().multiplyScalar(sign);
  };
  return { up: pick(new THREE.Vector3(0, 1, 0)), fwd: pick(new THREE.Vector3(0, 0, 1)), lat: pick(new THREE.Vector3(1, 0, 0)) };
}

function fieldsOf(geo: THREE.BufferGeometry, fr: Frame): Fields {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const n = pos.count;
  const h = new Float32Array(n), f = new Float32Array(n), l = new Float32Array(n);
  const v = new THREE.Vector3();
  let hMin = Infinity, hMax = -Infinity, fMin = Infinity, fMax = -Infinity;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    h[i] = v.dot(fr.up); f[i] = v.dot(fr.fwd); l[i] = v.dot(fr.lat);
    if (h[i] < hMin) hMin = h[i]; if (h[i] > hMax) hMax = h[i];
    if (f[i] < fMin) fMin = f[i]; if (f[i] > fMax) fMax = f[i];
  }
  return { h, f, l, hMin, hMax, fMin, fMax };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Thay Mesh bằng SkinnedMesh cùng geometry/material, bind vào skeleton chung. */
function toSkinned(mesh: THREE.Mesh, idx: Uint16Array, w: Float32Array, skeleton: THREE.Skeleton): THREE.SkinnedMesh {
  const geo = mesh.geometry as THREE.BufferGeometry;
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4));
  const sk = new THREE.SkinnedMesh(geo, mesh.material);
  sk.position.copy(mesh.position); sk.quaternion.copy(mesh.quaternion); sk.scale.copy(mesh.scale);
  sk.castShadow = mesh.castShadow; sk.receiveShadow = mesh.receiveShadow;
  sk.frustumCulled = false;
  const parent = mesh.parent!;
  parent.remove(mesh);
  parent.add(sk);
  sk.updateMatrixWorld(true);
  sk.bind(skeleton, sk.matrixWorld);
  return sk;
}

export function autoRigQuadruped(model: THREE.Object3D): Walker | null {
  model.updateMatrixWorld(true);
  const whole = new THREE.Box3().setFromObject(model, true);
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry?.attributes.position) meshes.push(m); });
  const H = whole.max.y - whole.min.y;
  const body = meshes
    .filter((m) => new THREE.Box3().setFromObject(m, true).min.y < whole.min.y + H * 0.05)
    .sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
  if (!body) return null;
  const fr = frameOf(body);
  const B = fieldsOf(body.geometry as THREE.BufferGeometry, fr);
  const height = B.hMax - B.hMin, L = B.fMax - B.fMin;

  // móng: 12% thấp nhất → 4 cụm theo góc phần tư quanh tâm móng
  const hoof: number[] = [];
  for (let i = 0; i < B.h.length; i++) if (B.h[i] < B.hMin + height * 0.12) hoof.push(i);
  if (hoof.length < 20) return null;
  let fc = 0, lc = 0;
  for (const i of hoof) { fc += B.f[i]; lc += B.l[i]; }
  fc /= hoof.length; lc /= hoof.length;
  const centers: { f: number; l: number; r: number }[] = [];
  for (const sf of [1, -1]) for (const sl of [1, -1]) {
    const pts = hoof.filter((i) => (B.f[i] - fc) * sf > 0 && (B.l[i] - lc) * sl > 0);
    if (pts.length < 4) return null;
    let cf = 0, cl = 0;
    for (const i of pts) { cf += B.f[i]; cl += B.l[i]; }
    cf /= pts.length; cl /= pts.length;
    let r = 0;
    for (const i of pts) r = Math.max(r, Math.hypot(B.f[i] - cf, B.l[i] - cl));
    centers.push({ f: cf, l: cl, r });
  }
  // centers: [FL, FR, BL, BR] (f dương = trước, l dương = trái)

  const hipH = B.hMin + height * 0.42, kneeH = B.hMin + height * 0.2, blend = height * 0.06;
  const headF0 = fc + L * 0.2, headH0 = B.hMin + height * 0.55;
  const toLocal = (hh: number, ff: number, ll: number) => new THREE.Vector3()
    .addScaledVector(fr.up, hh).addScaledVector(fr.fwd, ff).addScaledVector(fr.lat, ll);

  // xương: 0 thân, 1..8 = (hông, gối) × 4 chân, 9 đầu, 10 đuôi
  const root = new THREE.Bone();
  const bones: THREE.Bone[] = [root];
  const hips: THREE.Bone[] = [], knees: THREE.Bone[] = [];
  for (const c of centers) {
    const hip = new THREE.Bone(); hip.position.copy(toLocal(hipH, c.f, c.l)); root.add(hip);
    const knee = new THREE.Bone(); knee.position.copy(toLocal(kneeH, c.f, c.l).sub(hip.position)); hip.add(knee);
    hips.push(hip); knees.push(knee); bones.push(hip, knee);
  }
  const head = new THREE.Bone(); head.position.copy(toLocal(B.hMin + height * 0.66, fc + L * 0.16, lc)); root.add(head); bones.push(head);
  const tail = new THREE.Bone(); tail.position.copy(toLocal(B.hMin + height * 0.62, fc - L * 0.24, lc)); root.add(tail); bones.push(tail);
  const HEAD = 9, TAIL = 10;

  // trọng số thân
  const weightsBody = (F: Fields): [Uint16Array, Float32Array] => {
    const n = F.h.length;
    const idx = new Uint16Array(n * 4), w = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      let leg = -1, bd = Infinity;
      centers.forEach((c, k) => { const d = Math.hypot(F.f[i] - c.f, F.l[i] - c.l); if (d < bd) { bd = d; leg = k; } });
      const c = centers[leg];
      let wLeg = 0;
      if (F.h[i] < hipH + blend && bd < c.r * 1.7) wLeg = clamp01((hipH + blend - F.h[i]) / (2 * blend));
      const wKnee = clamp01((kneeH + blend - F.h[i]) / (2 * blend));
      const wHead = wLeg > 0 ? 0 : clamp01((F.f[i] - headF0) / (L * 0.08)) * clamp01((F.h[i] - headH0) / (height * 0.08));
      const o = i * 4;
      idx[o] = 1 + leg * 2; w[o] = wLeg * (1 - wKnee);
      idx[o + 1] = 2 + leg * 2; w[o + 1] = wLeg * wKnee;
      idx[o + 2] = HEAD; w[o + 2] = wHead;
      idx[o + 3] = 0; w[o + 3] = 1 - wLeg - wHead;
    }
    return [idx, w];
  };
  // trọng số bờm/đuôi (mesh tóc): sau mông → đuôi, trên đầu → đầu
  const weightsHair = (F: Fields): [Uint16Array, Float32Array] => {
    const n = F.h.length;
    const idx = new Uint16Array(n * 4), w = new Float32Array(n * 4);
    const tailF0 = fc - L * 0.14;
    let tailTop = -Infinity;
    for (let i = 0; i < n; i++) if (F.f[i] < tailF0 && F.h[i] > tailTop) tailTop = F.h[i];
    for (let i = 0; i < n; i++) {
      let wTail = 0, wHead = 0;
      if (F.f[i] < tailF0) wTail = clamp01((tailTop - F.h[i]) / (height * 0.22));
      else wHead = clamp01((F.f[i] - headF0) / (L * 0.08));
      const o = i * 4;
      idx[o] = TAIL; w[o] = wTail;
      idx[o + 1] = HEAD; w[o + 1] = wHead;
      idx[o + 2] = 0; w[o + 2] = 1 - wTail - wHead;
      idx[o + 3] = 0; w[o + 3] = 0;
    }
    return [idx, w];
  };

  const parent = body.parent!;
  parent.add(root);
  parent.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const [bi, bw] = weightsBody(B);
  toSkinned(body, bi, bw, skeleton);
  // các mesh anh em cùng transform (bờm/đuôi, mắt): mắt/đầu theo xương đầu, tóc theo đuôi/đầu
  for (const m of meshes) {
    if (m === body || m.parent !== parent || !m.matrix.equals(body.matrix)) continue;
    const F = fieldsOf(m.geometry as THREE.BufferGeometry, fr);
    const isHair = F.fMin < fc - L * 0.14; // có phần kéo ra sau mông → tóc
    const [i2, w2] = isHair ? weightsHair(F) : weightsBody(F);
    toSkinned(m, i2, w2, skeleton);
  }

  const lat = fr.lat, up = fr.up;
  const qTmp = new THREE.Quaternion();
  const look: WalkerLook = { yaw: 0, pitch: 0, tail: 0 };
  return {
    look,
    update(t, k) {
      // phi nước đại kiểu hoạt hình: 2 chân trước cùng pha, 2 chân sau lệch pha, thân nhún theo
      const w = t * 13;
      const phase = [0, 0.35, 2.6, 2.95]; // FL, FR, BL, BR
      for (let i = 0; i < 4; i++) {
        const s = Math.sin(w + phase[i]);
        const hipA = -0.5 * s * k;                                   // âm = vung ra trước
        const kneeA = (i < 2 ? 0.9 : 0.6) * Math.max(0, Math.sin(w + phase[i] + 1.0)) * k; // gập khi nhấc chân
        hips[i].quaternion.setFromAxisAngle(lat, hipA);
        knees[i].quaternion.setFromAxisAngle(lat, kneeA);
      }
      // đầu gật theo nhịp + ngó nghiêng khi đứng
      const nod = -0.1 * Math.sin(w + 1.0) * k + 0.04 * Math.sin(t * 1.3) * (1 - k) + look.pitch;
      const turn = 0.08 * Math.sin(t * 0.7) * (1 - k) + look.yaw;
      head.quaternion.setFromAxisAngle(lat, nod).multiply(qTmp.setFromAxisAngle(up, turn));
      // đuôi: dựng lên khi chạy, phất theo nhịp, ve vẩy khi đứng (look.tail = phẩy mạnh, nhanh)
      const tailPitch = -0.35 * k + 0.3 * Math.sin(w - 1.2) * k + 0.05 * Math.sin(t * 1.7) - 0.15 * look.tail;
      const tailSway = (0.14 + 0.3 * look.tail) * Math.sin(t * (2.1 + 7 * look.tail)) * (1 - k) + 0.08 * Math.sin(w * 0.5) * k;
      tail.quaternion.setFromAxisAngle(lat, tailPitch).multiply(qTmp.setFromAxisAngle(up, tailSway));
      return {
        bob: 0.16 * (0.5 + 0.5 * Math.sin(w + 1.0)) * k,
        pitch: 0.07 * Math.sin(w + 0.3) * k,
        roll: 0.02 * Math.sin(w * 0.5) * k,
      };
    },
  };
}

function worldAxisRotate(bone: THREE.Object3D, rest: THREE.Quaternion, axis: THREE.Vector3, angle: number, tmp: THREE.Quaternion): void {
  const pq = bone.parent!.getWorldQuaternion(tmp);
  const qa = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const inv = pq.clone().invert();
  bone.quaternion.copy(inv).multiply(qa).multiply(pq).multiply(rest);
}

// ---------------- Công chúa bay (model có xương sẵn tên chuẩn: *Wing*, *Thigh*, *Shoulder*, Head, Tail1) ----------------

/**
 * Vỗ cánh + đung đưa chân + vẫy đuôi cho model đã có skeleton (Celestia, Nightmare Moon).
 * Không tìm thấy xương nào (tên hỏng như Luna) thì trả walker rỗng: actor vẫn bay nhún bằng pivot.
 * `flap` 0..1: biên độ vỗ cánh (bay lên mạnh thì 1, lơ lửng thì ~0.4).
 */
export function makeFlyer(model: THREE.Object3D): Walker & { flap: number } {
  model.updateMatrixWorld(true);
  const bones: THREE.Bone[] = [];
  model.traverse((o) => { if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone); });
  const box = new THREE.Box3().setFromObject(model, true);
  const cx = (box.min.x + box.max.x) / 2;
  const sideOf = (b: THREE.Bone) => Math.sign(b.getWorldPosition(new THREE.Vector3()).x - cx) || 1;
  const isWing = (b: THREE.Object3D | null) => !!b && /wing/i.test(b.name);
  const wings = bones
    .filter((b) => isWing(b) && !/closed/i.test(b.name) && !isWing(b.parent))
    .map((b) => ({ b, rest: b.quaternion.clone(), side: sideOf(b) }));
  const legs = bones.filter((b) => /(thigh|shoulder)/i.test(b.name)).map((b, i) => ({ b, rest: b.quaternion.clone(), i }));
  const head = bones.find((b) => /^head/i.test(b.name));
  const headRest = head?.quaternion.clone();
  const tail = bones.find((b) => /^tail_?1/i.test(b.name) || /jiggle_tail1/i.test(b.name));
  const tailRest = tail?.quaternion.clone();
  const tmp = new THREE.Quaternion();
  const look: WalkerLook = { yaw: 0, pitch: 0, tail: 0 };
  const fwd = new THREE.Vector3(), lat = new THREE.Vector3();
  if (import.meta.env.DEV) console.debug('[rig] flyer wings', wings.length, 'legs', legs.length, 'head', !!head, 'tail', !!tail);
  const walker = {
    flap: 0.4,
    look,
    update(t: number, _k: number, yaw: number) {
      fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
      lat.set(Math.cos(yaw), 0, -Math.sin(yaw));
      const f = walker.flap;
      const beat = Math.sin(t * (4 + f * 5));
      for (const w of wings) worldAxisRotate(w.b, w.rest, fwd, -w.side * (0.12 + 0.45 * f) * beat, tmp);
      for (const l of legs) worldAxisRotate(l.b, l.rest, lat, 0.1 * Math.sin(t * 1.7 + l.i * 1.3) + 0.12, tmp);
      if (head && headRest) worldAxisRotate(head, headRest, Y, 0.1 * Math.sin(t * 0.6) + look.yaw, tmp);
      if (tail && tailRest) worldAxisRotate(tail, tailRest, Y, (0.18 + 0.3 * look.tail) * Math.sin(t * 1.4), tmp);
    },
  };
  return walker;
}
