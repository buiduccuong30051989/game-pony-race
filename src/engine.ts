// Lõi 3D: renderer (giới hạn pixel ratio cho iPad), cảnh, camera, ánh sáng có bóng đổ bám theo Nhím, trời gradient,
// sương mù theo thế giới, tải GLB có cache, hạt phép, chạm (raycast), vòng lặp có ĐỒNG HỒ CHẬM (slow-mo).
//
// Hai đồng hồ: `dt` thật (giọng nói, hạt, nút, tween UI) và `gdt = dt × timeScale` (mọi chuyển động trên đường: chạy,
// quái, phép bay). Slow-mo chỉ đổi timeScale, không đụng giọng đọc → bé luôn nghe rõ câu hỏi.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Magic } from './magic';
import { tween, updateTweens, easeInOutSine } from './tween';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uBottom;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y * 1.6 + 0.12, 0.0, 1.0);
    gl_FragColor = vec4(mix(uBottom, uTop, pow(h, 0.8)), 1.0);
  }`;

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly magic: Magic;
  /** hạt bóng tối (trộn thường, không cộng màu) */
  readonly shadow: Magic;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  /** 1 = bình thường, nhỏ hơn = chậm lại */
  timeScale = 1;
  private timeGoal = 1;
  private readonly timer = new THREE.Timer();
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<GLTF>>();
  private readonly fixed = new Map<THREE.Material, THREE.Material>();
  private readonly sky: THREE.Mesh;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  /** cập nhật thêm mỗi khung: (dt thật, dt game) */
  readonly updaters = new Set<(dt: number, gdt: number) => void>();
  /** giây thật đã chạy */
  time = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // iPad DPR 2 → 1.5: vẫn nét nhờ antialias, nhẹ hơn ~44% số điểm ảnh
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.3, 230);
    this.scene.fog = new THREE.Fog(0xfff1df, 70, 175);
    this.scene.background = new THREE.Color(0xfff1df);

    this.hemi = new THREE.HemisphereLight(0xfff9ec, 0xbfe09c, 1.4);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff5e2, 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 50;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    sun.shadow.intensity = 0.45;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color(0x8fd3ff) }, uBottom: { value: new THREE.Color(0xfff1df) } },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 12), this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    this.magic = new Magic(this.scene);
    this.shadow = new Magic(this.scene, true);
    this.magic.setAdditive(false);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    // màn hẹp (dọc / điện thoại) thì mở góc nhìn rộng hơn để vẫn thấy 3 ngôi sao đáp án
    this.camera.fov = w / h < 1.2 ? 66 : 55;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** Màu trời + sương mù + ánh sáng theo thế giới. `night` 0..1 (màn cuối: đêm tím → bình minh). */
  setSky(top: number, bottom: number, fogNear: number, fogFar: number): void {
    (this.skyMat.uniforms.uTop.value as THREE.Color).setHex(top);
    (this.skyMat.uniforms.uBottom.value as THREE.Color).setHex(bottom);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setHex(bottom);
    fog.near = fogNear; fog.far = fogFar;
    (this.scene.background as THREE.Color).setHex(bottom);
  }

  /** Đổi màu trời mượt (bình minh màn cuối). */
  async tweenSky(top: number, bottom: number, ms: number): Promise<void> {
    const t0 = (this.skyMat.uniforms.uTop.value as THREE.Color).clone(), b0 = (this.skyMat.uniforms.uBottom.value as THREE.Color).clone();
    const t1 = new THREE.Color(top), b1 = new THREE.Color(bottom);
    const fog = this.scene.fog as THREE.Fog;
    await tween(ms, (k) => {
      (this.skyMat.uniforms.uTop.value as THREE.Color).lerpColors(t0, t1, k);
      (this.skyMat.uniforms.uBottom.value as THREE.Color).lerpColors(b0, b1, k);
      fog.color.copy(this.skyMat.uniforms.uBottom.value);
      (this.scene.background as THREE.Color).copy(fog.color);
    }, easeInOutSine);
  }

  // ---------- slow-mo ----------
  /** Đặt tốc độ thời gian game (0.03 = gần như dừng khi hỏi, 0.2 = chậm khi gặp chướng ngại, 1 = thường). */
  slow(goal: number): void { this.timeGoal = goal; }

  // ---------- GLB ----------
  load(name: string): Promise<GLTF> {
    let p = this.cache.get(name);
    if (!p) { p = this.loader.loadAsync(`${import.meta.env.BASE_URL}${name}`); this.cache.set(name, p); }
    return p;
  }

  /** Bản sao model (xương riêng nếu có) + clip. Vật liệu đổi sang mờ (không bóng kim loại) cho hợp tranh hoạt hình. */
  async instance(name: string): Promise<{ obj: THREE.Object3D; clips: THREE.AnimationClip[] }> {
    const gltf = await this.load(name);
    const obj = SkeletonUtils.clone(gltf.scene);
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.material = this.matte(mesh.material);
      }
    });
    return { obj, clips: gltf.animations };
  }

  private matte(mat: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
    if (Array.isArray(mat)) return mat.map((m) => this.matte(m) as THREE.Material);
    let out = this.fixed.get(mat);
    if (!out) {
      const m = mat.clone() as THREE.MeshStandardMaterial;
      if ('metalness' in m) { m.metalness = 0; m.roughness = Math.max(0.6, m.roughness ?? 1); }
      out = m;
      this.fixed.set(mat, out);
    }
    return out;
  }

  /** Thu model về chiều cao `height`, chân chạm y = 0, tâm ngang ở gốc. */
  fitHeight(obj: THREE.Object3D, height: number): number {
    obj.updateMatrixWorld(true);
    obj.traverse((o) => { const sm = o as THREE.SkinnedMesh; if (sm.isSkinnedMesh) sm.computeBoundingBox(); });
    const box = new THREE.Box3().setFromObject(obj, true);
    const size = box.getSize(new THREE.Vector3());
    const s = height / Math.max(size.y, 1e-4);
    obj.scale.multiplyScalar(s);
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj, true);
    const c = box2.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y;
    return s;
  }

  private readonly emojiTex = new Map<string, THREE.CanvasTexture>();
  emojiTexture(emoji: string): THREE.CanvasTexture {
    let tex = this.emojiTex.get(emoji);
    if (!tex) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d')!;
      ctx.font = '100px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 64, 70);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.emojiTex.set(emoji, tex);
    }
    return tex;
  }
  emojiSprite(emoji: string, size = 1): THREE.Sprite {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.emojiTexture(emoji), transparent: true, depthWrite: false }));
    sp.scale.setScalar(size);
    return sp;
  }

  // ---------- chạm ----------
  pick(px: number, py: number, objs: THREE.Object3D[]): THREE.Intersection | null {
    if (!objs.length) return null;
    this.ndc.set((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.intersectObjects(objs, true)[0] ?? null;
  }
  toScreen(p: THREE.Vector3): { x: number; y: number; behind: boolean } {
    const v = p.clone().project(this.camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, behind: v.z > 1 };
  }

  /** Bóng đổ thật chỉ quanh Nhím: hộp chiếu sáng của mặt trời bám theo `p`, chiếu từ phía camera chéo sang (nhân vật
   *  luôn được rọi sáng mặt bé nhìn thấy, không bị ngược sáng khi đường cua). */
  sunFollow(p: THREE.Vector3, fx: number, fz: number): void {
    this.sun.position.set(p.x - fx * 9 - fz * 6, p.y + 16, p.z - fz * 9 + fx * 6);
    this.sun.target.position.copy(p);
  }

  // ---------- vòng lặp ----------
  start(update: (dt: number, gdt: number) => void): void {
    this.renderer.setAnimationLoop(() => {
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), 0.05);
      this.time += dt;
      // timeScale đổi mượt (vào slow-mo ~0.25 s)
      this.timeScale += (this.timeGoal - this.timeScale) * Math.min(1, dt * 9);
      if (Math.abs(this.timeGoal - this.timeScale) < 0.002) this.timeScale = this.timeGoal;
      const gdt = dt * this.timeScale;
      updateTweens(dt);
      update(dt, gdt);
      for (const u of this.updaters) u(dt, gdt);
      this.magic.update(dt);
      this.shadow.update(dt);
      this.sky.position.copy(this.camera.position);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
