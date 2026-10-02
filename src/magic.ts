// Hạt phép thuật: 1 THREE.Points với shader riêng (kích thước + alpha từng hạt, cộng màu).
import * as THREE from 'three';

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number; size: number;
  r: number; g: number; b: number;
  gravity: number; drag: number;
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha; vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (260.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
// uAdd = 1: cộng màu (đẹp trên nền tối/đêm); 0: trộn thường (nền sáng ban ngày không bị loá trắng)
const FRAG = /* glsl */ `
  uniform float uAdd;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.12, d) * vAlpha;
    vec3 core = mix(vColor, vec3(1.0), smoothstep(0.22, 0.0, d) * 0.6 * (1.0 - uAdd));
    gl_FragColor = vec4(mix(core, vColor * a, uAdd), a);
  }`;

export class Magic {
  readonly points: THREE.Points;
  private readonly max = 2500;
  private readonly parts: Particle[] = [];
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private readonly tmp = new THREE.Color();
  private readonly mat: THREE.ShaderMaterial;
  private additive = true;

  /** Đêm: cộng màu cho rực; ngày: trộn thường để hạt vẫn rõ trên nền sáng. */
  setAdditive(on: boolean): void {
    if (this.fixed) on = false;
    if (on === this.additive) return;
    this.additive = on;
    this.mat.blending = on ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.mat.uniforms.uAdd.value = on ? 1 : 0;
    this.mat.needsUpdate = true;
  }

  /** fixed = true: luôn trộn thường (hạt bóng tối tím đậm không bị cộng màu thành vô hình). */
  constructor(scene: THREE.Scene, private readonly fixed = false) {
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.size = new Float32Array(this.max);
    this.alpha = new Float32Array(this.max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, uniforms: { uAdd: { value: 1 } },
    });
    this.mat = mat;
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    if (fixed) { this.additive = true; this.setAdditive(false); }
  }

  emit(p: Partial<Particle> & { x: number; y: number; z: number; color: number }): void {
    if (this.parts.length >= this.max) this.parts.shift();
    this.tmp.setHex(p.color);
    this.parts.push({
      x: p.x, y: p.y, z: p.z,
      vx: p.vx ?? 0, vy: p.vy ?? 0, vz: p.vz ?? 0,
      life: 0, max: p.max ?? 0.8, size: p.size ?? 0.3,
      r: this.tmp.r, g: this.tmp.g, b: this.tmp.b,
      gravity: p.gravity ?? 0, drag: p.drag ?? 1,
    });
  }

  /** Nổ toé ra mọi hướng. */
  burst(at: THREE.Vector3, n: number, color: number, speed = 2.6, size = 0.32, life = 0.9, gravity = -2.5): void {
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.4 + Math.random() * 0.8);
      this.emit({
        x: at.x, y: at.y, z: at.z, color,
        vx: Math.sin(ph) * Math.cos(th) * s, vy: Math.cos(ph) * s + speed * 0.4, vz: Math.sin(ph) * Math.sin(th) * s,
        max: life * (0.6 + Math.random() * 0.8), size: size * (0.6 + Math.random() * 0.9), gravity, drag: 0.92,
      });
    }
  }

  /** Vòng sáng lan ra theo mặt phẳng ngang (biến hình / đại phép). */
  ring(at: THREE.Vector3, color: number, n = 90, speed = 3): void {
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      this.emit({ x: at.x, y: at.y, z: at.z, color, vx: Math.cos(th) * speed, vz: Math.sin(th) * speed, vy: 0.6, max: 0.9, size: 0.28, drag: 0.9 });
    }
  }

  /** Lấp lánh nhẹ quanh 1 điểm (sừng, ngọc). */
  twinkle(at: THREE.Vector3, color: number, n = 2, spread = 0.25): void {
    for (let i = 0; i < n; i++) {
      this.emit({
        x: at.x + (Math.random() - 0.5) * spread, y: at.y + (Math.random() - 0.5) * spread, z: at.z + (Math.random() - 0.5) * spread,
        color, vy: 0.5 + Math.random() * 0.5, max: 0.6, size: 0.14 + Math.random() * 0.12,
      });
    }
  }

  /** Tia phép bay theo đường cong từ `from` tới `to`, rắc hạt dọc đường. Resolve khi chạm đích. */
  beam(from: THREE.Vector3, to: THREE.Vector3, color: number, color2: number, duration = 0.9): Promise<void> {
    const ctrl = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 2.2, 0));
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), ctrl, to.clone());
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / (duration * 1000));
        const p = curve.getPoint(t);
        for (let i = 0; i < 7; i++) {
          const spiral = t * Math.PI * 10 + i;
          this.emit({
            x: p.x + Math.cos(spiral) * 0.22, y: p.y + Math.sin(spiral) * 0.22, z: p.z + (Math.random() - 0.5) * 0.2,
            color: i % 2 ? color : color2, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.3) * 0.6,
            max: 0.55 + Math.random() * 0.4, size: 0.24 + Math.random() * 0.2, drag: 0.95,
          });
        }
        if (t < 1) requestAnimationFrame(tick); else resolve();
      };
      tick();
    });
  }

  update(dt: number): void {
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.vx *= p.drag; p.vy *= p.drag; p.vz *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = p.life / p.max;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.col[n * 3] = p.r; this.col[n * 3 + 1] = p.g; this.col[n * 3 + 2] = p.b;
      this.size[n] = p.size * (1 - k * 0.5);
      this.alpha[n] = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      n++;
    }
    this.geo.setDrawRange(0, n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }
}
