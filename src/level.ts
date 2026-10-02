// Một bài chơi: dựng đường + cảnh, Nhím và (tuỳ bài) người nhà đua cùng / quái đuổi / quái chạy trước / Nữ hoàng Bóng Đêm.
//
//  - Giữ nút thì chạy (thả ra thì chậm dần rồi đứng, không bị phạt). Gặp chướng ngại: mọi thứ CHẬM LẠI, nút cánh sáng lên,
//    chạm để bay qua; không chạm thì vấp lộn 1 vòng (không tính là sai).
//  - Câu hỏi: thời gian gần như DỪNG (không đếm giờ), 3 ngôi sao đáp án trước mặt (ngã rẽ: 2 biển trên 2 nhánh).
//    Mỗi câu 1 kết quả: đúng → né phép / bắn trúng / đường tắt cầu vồng; sai → mất 1 tim, đọc đáp án đúng để bé học,
//    câu đó được ghi để ôn lại ở bài sau. Hết 3 tim là thua (chơi lại bài đó).
import * as THREE from 'three';
import type { Engine } from './engine';
import { Track, type Fork, type Span, mulberry32 } from './track';
import { Scenery, type Obstacle } from './scenery';
import { Pony } from './pony';
import { Runner } from './runner';
import { Monster } from './monster';
import { LetterStar, glowTexture, type ToneName } from './letterstar';
import { CAST, HEARTS, RACERS_BASE, type CastId, type FamilyId, type FriendId, type LevelDef } from './data';
import { makeQuiz, type Question, type Step } from './quiz';
import { markRight, markWrong, cosmetics, type Progress } from './progress';
import { play, sfx, speakSequence, stopSpeech } from './audio';
import { say, narrate } from './talk';
import { bankLine } from './voice';
import { FAMILY_LINES, familyKey, thanksKey } from './lines';
import { nameKey } from './letters';
import { numKey } from './numbers';
import { tween, wait, easeInOutSine } from './tween';
import { setAnswer } from './testhook';
import * as ui from './ui';

export type Outcome = 'win' | 'lose' | 'quit';
export interface LevelResult { outcome: Outcome; gems: number; place?: number; winner?: CastId; friends: FriendId[]; racers: CastId[] }

const LANE = 2.5;
const FORK_LEN = 40;
const BRIDGE_LEN = 36;

interface Chaser { m: Monster; s: number; gap: number; lat: number; extra: boolean }
interface Target { m: Monster; s: number; hp: number; friendId: FriendId; friend: Pony | null; bubble: THREE.Mesh | null; boostT: number; gap: number }
interface Ev { s: number; kind: 'fork' | 'attack'; fork?: Fork; done: boolean; answered?: boolean; wave?: boolean }
interface Orb { sprite: THREE.Sprite; from: THREE.Vector3; u: number; cap: number; miss: THREE.Vector3 | null; hitPlayer: boolean; color: number; done: () => void }

/** Cặp người nhà đua lần trước (không lặp lại liền). */
let lastPair = '';

/** Rải `count` điểm đều trong vùng trống [from, to], tránh các khoảng `busy` (± margin). */
function spread(count: number, from: number, to: number, busy: Span[], margin: number): number[] {
  const free: number[] = [];
  for (let s = from; s <= to; s++) if (!busy.some((b) => s > b.s0 - margin && s < b.s1 + margin)) free.push(s);
  if (!free.length || !count) return [];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const s = free[Math.floor(((i + 0.5) / count) * free.length)];
    if (!out.length || s - out[out.length - 1] > 14) out.push(s);
  }
  return out;
}

export class Level {
  track!: Track;
  scenery!: Scenery;
  player!: Runner;
  readonly racers: Runner[] = [];
  private racerBias: number[] = [];
  private readonly chasers: Chaser[] = [];
  private targets: { kind: Monster['kind']; friend: FriendId }[] = [];
  private target: Target | null = null;
  private nmm: Pony | null = null;
  private nmmHits = 0;
  private turn: 'me' | 'nmm' = 'me';
  private lastTurnS = 0;
  private readonly helpers: Runner[] = [];
  hearts = HEARTS;
  gems = 0;
  private wrong = 0;
  private qs: Question[] = [];
  private qi = 0;
  private events: Ev[] = [];
  private rnd: () => number;
  /** bé đang giữ nút chạy */
  holding = false;
  busy = false;
  /** đang diễn cảnh (cứu bạn): Nhím đứng lại xem, không tự chạy */
  private cutscene = false;
  started = false;
  private over = false;
  private alive = true;
  /** sao / biển đáp án đang hiện */
  private choices: LetterStar[] = [];
  private posts: THREE.Mesh[] = [];
  private pickResolve: ((s: LetterStar | null) => void) | null = null;
  private currentAsk: string | null = null;
  private askAt = 0;
  private askRepeats = 0;
  private talking: Promise<unknown> = Promise.resolve();
  private orbs: Orb[] = [];
  private obSlow: Obstacle | null = null;
  private prevS = 0;
  private idleT = 0;
  private chatT = 8;
  private t = 0;
  private camYaw = 0;
  private readonly camLook = new THREE.Vector3();
  private camMode: 'follow' | 'front' = 'follow';
  private shownTapHint = false;
  private friendsSaved: FriendId[] = [];
  private finishPlace = 0;
  private winner: CastId | undefined;
  private resolveEnd!: (o: Outcome) => void;
  readonly ended: Promise<Outcome>;
  private cosmetic = new Set<string>();
  private crown: THREE.Group | null = null;
  private night = 0;
  private readonly tmpV = new THREE.Vector3();

  /** auto: máy tự giữ nút chạy + tự bay (test); autoAnswer: máy tự chọn đáp án đúng. */
  constructor(private readonly engine: Engine, readonly def: LevelDef, private readonly progress: Progress, private readonly auto = false, private readonly autoAnswer = false) {
    this.rnd = mulberry32(def.seed * 31 + Math.floor(Math.random() * 1e6));
    this.ended = new Promise((r) => { this.resolveEnd = r; });
  }

  get mode(): LevelDef['mode'] { return this.def.mode; }
  get waitingLabel(): string | null { return this.pickResolve ? this.currentAsk : null; }

  // ================================================================== dựng bài

  async setup(): Promise<void> {
    const d = this.def;
    const closed = d.mode === 'hunt' || d.mode === 'final';
    const L = d.length;
    const forks: Span[] = [], bridges: Span[] = [];
    if (d.mode === 'race') {
      // cầu đầu (nếu có 2), các ngã rẽ cách đều, cầu cuối, rồi về đích
      let s = 30;
      if (d.bridges >= 2) { bridges.push({ s0: s, s1: s + BRIDGE_LEN }); s += BRIDGE_LEN + 14; }
      s = Math.max(s, 72);
      const room = L - 30 - (d.bridges >= 1 ? BRIDGE_LEN + 30 : 0) - s;
      // mỗi khối: hỏi (18 m trước ngã rẽ) → ngã rẽ → 1 chướng ngại giữa 2 ngã rẽ
      const gap = Math.max(FORK_LEN + 52, room / d.questions);
      for (let i = 0; i < d.questions; i++) forks.push({ s0: s + i * gap, s1: s + i * gap + FORK_LEN });
      const last = forks[forks.length - 1].s1 + 14;
      if (d.bridges >= 1) bridges.push({ s0: last, s1: last + BRIDGE_LEN });
    } else if (d.mode === 'chase') {
      const n = d.bridges;
      for (let i = 0; i < n; i++) { const s0 = Math.round(L * (0.3 + i * 0.36)); bridges.push({ s0, s1: s0 + BRIDGE_LEN }); }
    } else if (d.mode === 'hunt') {
      for (let i = 0; i < d.bridges; i++) { const s0 = Math.round(L * (0.25 + i * 0.4)); bridges.push({ s0, s1: s0 + BRIDGE_LEN }); }
    }
    this.track = new Track({ closed, length: L, seed: d.seed, width: 7.2, bridges, forks, baseY: d.mode === 'final' ? 40 : 0, wave: d.mode === 'final' ? 5 : 0 });
    this.scenery = new Scenery(this.engine, this.track, d);
    for (const f of this.track.forks) this.events.push({ s: f.s0 - 18, kind: 'fork', fork: f, done: false });

    // câu hỏi
    const n = d.mode === 'race' ? 2 : 3;
    const count = d.mode === 'race' ? d.questions : d.mode === 'chase' ? d.questions : 16;
    this.qs = makeQuiz(d.quiz, count, n, this.progress.weak, this.rnd);

    if (d.mode === 'chase') {
      const busy: Span[] = [...bridges];
      const at = spread(d.questions - 1, 80, L - 70, busy, 14);
      const waveI = Math.min(at.length - 1, Math.floor(at.length * 0.6));
      at.forEach((s, i) => {
        this.events.push({ s, kind: 'attack', done: false, wave: i === waveI });
        if (i === waveI) this.events.push({ s: s + 26, kind: 'attack', done: false });
      });
    }
    this.events.sort((a, b) => a.s - b.s);

    // chướng ngại: chỗ trống, tránh cầu, ngã rẽ, chỗ quái bắn
    if (d.obstacles) {
      const busy: Span[] = [...bridges, ...this.track.forks.map((f) => ({ s0: f.s0 - 22, s1: f.s1 + 4 })), ...this.events.filter((e) => e.kind === 'attack').map((e) => ({ s0: e.s - 8, s1: e.s + 16 }))];
      const end = closed ? L - 20 : L - 40;
      let spots = spread(d.obstacles, closed ? 60 : 44, end, busy, 10);
      if (d.mode === 'race') {
        // đua: 1 chướng ngại giữa mỗi 2 ngã rẽ (sau ngã rẽ, trước vùng hỏi của ngã rẽ sau), 1 trước ngã rẽ đầu, 1 sau cầu cuối
        const fk = this.track.forks;
        spots = fk.slice(0, -1).map((f, i) => Math.round((f.s1 + fk[i + 1].s0 - 18) / 2));
        if (!bridges.some((b) => b.s0 < 70)) spots.unshift(46);
        const lastB = bridges[bridges.length - 1];
        if (lastB && lastB.s1 + 16 < L - 30) spots.push(lastB.s1 + 16);
      }
      for (const s of spots) {
        await this.scenery.addObstacle(s);
        // vòm ngọc bay qua chướng ngại
        this.scenery.addGems(s - 3.5, 6, 1.4, 0, 0, 2.2);
      }
    }
    // hàng ngọc giữa đường (làn của Nhím)
    if (d.mode !== 'final') {
      for (let s = 38; s < L - 30; s += 32) {
        if (bridges.some((b) => s > b.s0 - 4 && s < b.s1) || this.track.forks.some((f) => s > f.s0 - 4 && s < f.s1 + 2)) continue;
        if (this.scenery.obstacles.some((o) => Math.abs(o.s - s) < 8)) continue;
        this.scenery.addGems(s, 5, 1.6, 0, 0);
      }
      for (const f of this.track.forks) for (const side of [-1, 1]) this.scenery.addGems(f.s0 + 14, 6, 2.2, 0, side);
    }
    this.scenery.onGem = () => { this.gems++; ui.setGems(this.gems, true); sfx('sfx_gem', 0.35); };
    await this.scenery.build();
    if (!this.alive) return;

    // Nhím
    const tw = await Pony.load(this.engine, 'twilight', 'real');
    this.engine.scene.add(tw.root);
    this.player = new Runner(tw, this.track);
    this.player.s = closed ? 0 : 4;
    this.player.alwaysFly = d.mode === 'final';
    this.prevS = this.player.s;
    this.cosmetic = cosmetics(this.progress);
    if (this.cosmetic.has('crown')) this.addCrown(tw);

    if (d.mode === 'race') await this.setupRace();
    else if (d.mode === 'chase') await this.setupChase();
    else if (d.mode === 'hunt') await this.setupHunt();
    else await this.setupFinal();
    if (!this.alive) return;

    this.player.update(0, 0, 0);
    for (const r of this.racers) r.update(0, 0, 0);
    this.camYaw = this.player.pose.yaw;
    this.updateCamera(1, true);
    ui.setHearts(this.hearts, HEARTS);
    ui.setGems(0);
    this.updateHud();
  }

  private async setupRace(): Promise<void> {
    const fam: FamilyId[] = [...RACERS_BASE, ...(this.progress.done.includes('final') ? ['bac-hanh' as FamilyId] : [])];
    let pair: FamilyId[];
    do {
      const a = [...fam].sort(() => this.rnd() - 0.5);
      pair = a.slice(0, 2);
    } while (pair.slice().sort().join() === lastPair && fam.length > 2);
    lastPair = pair.slice().sort().join();
    for (let i = 0; i < 2; i++) {
      const p = await Pony.load(this.engine, pair[i], 'blob');
      this.engine.scene.add(p.root);
      const r = new Runner(p, this.track);
      r.s = 4; r.lat = r.latGoal = i ? LANE : -LANE;
      this.racers.push(r);
      this.racerBias.push(0);
    }
  }

  private async setupChase(): Promise<void> {
    const kinds = this.def.monsters;
    for (let i = 0; i < kinds.length; i++) {
      const m = await Monster.create(this.engine, kinds[i]);
      this.engine.scene.add(m.root);
      this.chasers.push({ m, s: this.player.s - 4 - i * 1.6, gap: 4 + i * 1.6, lat: i % 2 ? 1.6 : -1.6, extra: false });
    }
  }

  private async setupHunt(): Promise<void> {
    this.targets = this.def.monsters.map((k, i) => ({ kind: k, friend: this.def.friends![i] }));
    await this.spawnTarget(22);
  }

  private async spawnTarget(gap: number): Promise<void> {
    const next = this.targets.shift();
    if (!next) return;
    const m = await Monster.create(this.engine, next.kind);
    const friend = await Pony.load(this.engine, next.friend, 'none');
    if (!this.alive) { m.dispose(); friend.dispose(); return; }
    this.engine.scene.add(m.root);
    // bong bóng nhốt bạn trên lưng quái
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.15, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0x9a7cff, transparent: true, opacity: 0.38, roughness: 0.1, clearcoat: 1, depthWrite: false, emissive: 0x2a0f60 }));
    bubble.renderOrder = 2;
    friend.root.scale.setScalar(0.62);
    this.engine.scene.add(bubble, friend.root);
    this.target = { m, s: this.player.s + gap, hp: 3, friendId: next.friend, friend, bubble, boostT: 0, gap };
    this.updateHud();
  }

  private async setupFinal(): Promise<void> {
    this.night = 1;
    this.engine.magic.setAdditive(true);
    const n = await Pony.load(this.engine, 'nightmare', 'none');
    this.engine.scene.add(n.root);
    n.flying = true;
    this.nmm = n;
    this.lastTurnS = this.player.s + 25;
    ui.setHarmony(0);
  }

  /** Vòng hoa trên đầu Twilight (mở ở 60 ngọc). */
  private addCrown(p: Pony): void {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 18), new THREE.MeshLambertMaterial({ color: 0x6fd07a }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const cols = [0xff7ac8, 0xffd166, 0xffffff, 0xc084fc];
    for (let i = 0; i < 8; i++) {
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshLambertMaterial({ color: cols[i % 4], emissive: cols[i % 4], emissiveIntensity: 0.2 }));
      const a = (i / 8) * Math.PI * 2;
      f.position.set(Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.2);
      g.add(f);
    }
    g.position.set(0, p.height * 0.9, p.height * 0.27);
    g.rotation.x = -0.35;
    p.pivot.add(g);
    this.crown = g;
  }

  // ================================================================== chạy bài

  async run(): Promise<Outcome> {
    // mở đầu: camera đứng trước mặt, người kể + người nhà chào
    this.camMode = 'front';
    const key = this.def.id === 'final' ? 'lv_final' : `lv_${this.def.id.replace('-', '_')}`;
    await narrate(key);
    if (!this.alive) return 'quit';
    if (this.def.mode === 'race') {
      for (const r of this.racers) {
        const id = r.pony.id as FamilyId;
        void r.pony.celebrate();
        await say(id, familyKey(id, 'hi'), FAMILY_LINES[id].hi);
        if (!this.alive) return 'quit';
      }
    } else if (this.def.mode === 'final') {
      await say('nightmare', 'final_2');
      await narrate('final_3');
    }
    if (!this.alive) return 'quit';
    this.camMode = 'follow';
    await ui.countdown();
    if (!this.alive) return 'quit';
    this.started = true;
    this.idleT = 5.5;
    if (this.auto) this.holding = true;
    return this.ended;
  }

  /** Giữ / thả nút chạy. */
  setHold(on: boolean): void {
    this.holding = on || this.auto;
    if (on) this.idleT = 0;
  }

  /** Chạm nút cánh. */
  pressFly(): void {
    if (!this.started || this.over || this.player.alwaysFly) return;
    if (this.player.fly()) {
      sfx('sfx_fly', 0.45);
      if (this.obSlow) { this.clearSlow(); }
    }
  }

  /** Chạm màn hình: trúng sao / biển đáp án thì chọn. Trả về true nếu đã dùng cú chạm. */
  tap(x: number, y: number): boolean {
    if (!this.pickResolve || !this.choices.length) return false;
    const hits = this.choices.filter((c) => !c.gone).flatMap((c) => c.hits);
    const hit = this.engine.pick(x, y, hits);
    const star = hit?.object.userData.star as LetterStar | undefined;
    if (!star) return false;
    const r = this.pickResolve;
    this.pickResolve = null;
    r(star);
    return true;
  }

  /** Nghe lại câu hỏi (nút 🔊). */
  repeat(): void { if (this.currentAsk && this.pickResolve) { void play(this.currentAsk); this.askAt = this.engine.time; } }

  // ================================================================== mỗi khung

  tick(dt: number, gdt: number): void {
    if (!this.alive || !this.player) return;
    this.t += dt;
    const d = this.def;
    const p = this.player;
    // tốc độ mong muốn: giữ nút (hoặc đang hỏi / máy tự chạy) → chạy
    let want = (this.started && !this.over && !this.cutscene && (this.holding || this.busy)) ? d.speed : 0;
    // ngã rẽ: chưa chọn đường thì không vào được
    const pendingFork = this.events.find((e) => e.kind === 'fork' && !e.answered && e.fork && p.s > e.fork.s0 - 20);
    if (pendingFork && p.s > pendingFork.fork!.s0 - 1.5 && !p.side) want = 0;
    p.update(gdt, dt, want);
    if (pendingFork && !p.side) p.s = Math.min(p.s, pendingFork.fork!.s0 - 1);
    if (this.over && !this.track.closed) p.s = Math.min(p.s, this.track.length - 2);

    if (this.started && !this.over) {
      this.obstacles();
      if (!this.busy) {
        // nhắc giữ nút khi đứng yên lâu
        if (p.v < 0.5 && !this.holding) {
          this.idleT += dt;
          if (this.idleT > 7) { this.idleT = -9; ui.runHint(true); this.talk(null, bankLine('hold')); }
        } else { if (this.idleT > 0 || this.idleT < -0.5) ui.runHint(false); this.idleT = 0; }
      }
      if (d.mode === 'race') this.tickRace(gdt, dt);
      else if (d.mode === 'chase') this.tickChase(gdt, dt);
      else if (d.mode === 'hunt') this.tickHunt(gdt, dt);
      else this.tickFinal(gdt, dt);
    } else {
      if (d.mode === 'race') for (const r of this.racers) r.update(gdt, dt, 0);
      if (d.mode === 'chase') this.placeChasers(gdt, dt);
      if (d.mode === 'hunt') this.placeTarget(gdt, dt, 0);
      if (d.mode === 'final') this.placeNmm(gdt, dt);
    }
    for (const h of this.helpers) { h.latGoal = -1.8; h.update(gdt, dt, Math.max(0, p.v * 0.98 + (p.s - 3 - h.s) * 1.5)); }

    // ngọc + hiệu ứng chạy
    this.scenery.collectGems(p.center(this.tmpV), 1.5);
    this.trail(dt);
    this.updateOrbs(gdt);
    for (const c of this.choices) c.update(dt, this.engine.camera);
    // nhắc lại câu hỏi khi bé im lâu (16 s, 32 s…)
    if (this.pickResolve && this.currentAsk && this.engine.time - this.askAt > 16 + this.askRepeats * 16) {
      this.askRepeats++;
      this.askAt = this.engine.time;
      void play(this.currentAsk);
      for (const c of this.choices) void c.pop();
    }
    this.scenery.update(dt, this.engine.time, p.s, this.engine.camera);
    this.updateCamera(dt, false);
    this.updateHud();
    this.prevS = p.s;
  }

  private trail(dt: number): void {
    const p = this.player;
    const m = this.engine.magic;
    if (p.boostT > 0 || (this.cosmetic.has('trail') && p.v > 4)) {
      const c = p.pose.pos;
      const cols = [0xff4d6d, 0xff9a3c, 0xffd93d, 0x6bd968, 0x4fb3ff, 0xc86bff];
      for (let i = 0; i < 2; i++) m.emit({ x: c.x + (Math.random() - 0.5) * 0.8, y: c.y + p.y + 0.5 + Math.random() * 0.6, z: c.z + (Math.random() - 0.5) * 0.8, color: cols[Math.floor(Math.random() * 6)], vy: 0.3, max: 0.8, size: 0.3 });
    }
    if (p.mudT > 0 && p.v > 2 && Math.random() < dt * 30) {
      const c = p.pose.pos;
      m.emit({ x: c.x + (Math.random() - 0.5), y: c.y + 0.2, z: c.z + (Math.random() - 0.5), color: 0x9b6a3c, vy: 2.2, vx: (Math.random() - 0.5) * 2, max: 0.5, size: 0.3, gravity: -9 });
    }
    if (this.cosmetic.has('aura') && Math.random() < dt * 14) m.twinkle(p.center(this.tmpV), 0xffe08a, 1, 1.4);
    if (p.pony.flying && !p.pony.flyer) {
      const c = p.center(this.tmpV);
      m.emit({ x: c.x + (Math.random() - 0.5) * 0.6, y: c.y + (Math.random() - 0.5) * 0.6, z: c.z + (Math.random() - 0.5) * 0.6, color: [0xff7ac8, 0xffd166, 0x7fd8ff, 0xc084fc][Math.floor(Math.random() * 4)], vy: -0.3, max: 0.8, size: 0.26 });
    }
  }

  // ------------------------------------------------------------------ chướng ngại: chậm lại, bay qua, vấp

  private obstacles(): void {
    const p = this.player, tr = this.track;
    const ahead = (s: number) => (tr.closed ? ((s - p.s) % tr.length + tr.length) % tr.length : s - p.s);
    let near: Obstacle | null = null;
    for (const ob of this.scenery.obstacles) {
      if (ob.hit) {
        // vòng kín: chướng ngại đã vỡ hiện lại khi Nhím đi xa
        if (tr.closed && ahead(ob.s) > 60 && ahead(ob.s) < tr.length - 40) { ob.hit = false; ob.group.visible = true; }
        continue;
      }
      const a = ahead(ob.s);
      // vừa đi qua
      const pa = tr.closed ? this.prevAhead(ob.s) : 0;
      const crossed = tr.closed ? (pa > 0 && pa <= 4 && (a > tr.length - 4 || a === 0)) : this.prevS < ob.s && p.s >= ob.s;
      if (crossed) {
        if (p.y < ob.h * 0.85) {
          // vấp: lộn 1 vòng, chậm lại, chướng ngại vỡ tung
          this.scenery.smash(ob);
          p.v = Math.min(p.v, 2.5);
          void p.pony.tumble();
          sfx('sfx_bonk', 0.5);
          this.talk(null, bankLine('oops'));
        } else if (Math.random() < 0.5) this.talk(null, bankLine('flyok'));
        if (this.obSlow === ob) this.clearSlow();
        continue;
      }
      if (a > 0 && a < 12 && (!near || a < ahead(near.s))) near = ob;
    }
    // máy tự chạy (test) / người nhà: tự bay qua
    if (this.auto && near && ahead(near.s) < 3.2 && !p.airborne) this.pressFly();
    for (const r of this.racers) {
      for (const ob of this.scenery.obstacles) if (ob.s - r.s > 0 && ob.s - r.s < 2.6 && !r.airborne) r.fly();
    }
    // chậm lại khi sắp tới chướng ngại (chỉ khi đang chạy và chưa bay)
    if (near && !this.busy && !p.airborne && p.v > 2.5 && this.obSlow !== near) {
      this.obSlow = near;
      this.engine.slow(0.2);
      ui.flyHint(true);
      this.talk(null, bankLine('fly'));
    }
    if (this.obSlow && (p.airborne || p.v < 1)) this.clearSlow();
  }
  private prevAhead(s: number): number { const L = this.track.length; return ((s - this.prevS) % L + L) % L; }

  private clearSlow(): void {
    this.obSlow = null;
    ui.flyHint(false);
    if (!this.busy) this.engine.slow(1);
  }

  // ------------------------------------------------------------------ ĐUA

  private tickRace(gdt: number, dt: number): void {
    const p = this.player, L = this.track.length;
    // ngã rẽ
    for (const e of this.events) if (e.kind === 'fork' && !e.done && !this.busy && p.s >= e.s) { e.done = true; void this.forkQuestion(e); }
    // người nhà: bám theo Nhím kiểu dây chun (không bỏ xa, không tụt mất), đoạn cuối theo số câu sai
    this.racers.forEach((r, i) => {
      const lastStretch = p.s > L - 90;
      const wobble = Math.sin(this.t * 0.35 + i * 2.1) * 3.5;
      const offset = lastStretch ? (this.wrong - 1) * 3.2 + (i ? 1.2 : -0.6) : wobble + this.racerBias[i];
      this.racerBias[i] *= Math.exp(-dt * 0.12);
      const target = p.s + offset;
      let want = this.def.speed * Math.min(1.35, Math.max(0.45, 1 + (target - r.s) * 0.07));
      // Nhím đứng lại → người nhà chờ (không bỏ xa quá 7 m)
      if (p.v < 1 && r.s > p.s + 6) want = 0;
      if (r.finishedAt >= 0 || this.over) want = r.s < L - 3 ? 3 : 0;
      // chọn nhánh khi vào ngã rẽ
      const fk = this.track.forkAt(r.s + 2);
      if (fk.fork && !r.side) r.side = this.rnd() < 0.5 ? -1 : 1;
      r.latGoal = (i ? LANE : -LANE) * (this.track.forkAt(r.s).fork ? 0.35 : 1);
      r.update(gdt, dt, want);
      if (r.s >= L - 14 && r.finishedAt < 0) r.finishedAt = this.t;
    });
    p.latGoal = 0;
    // nói chuyện lúc đua
    this.chatT -= dt;
    if (this.chatT <= 0 && !this.busy) {
      this.chatT = 14 + this.rnd() * 10;
      const ahead = this.racers.filter((r) => r.s > p.s + 4);
      if (p.v < 1 && this.racers.length) { const r = this.racers[0]; this.familySay(r.pony.id as FamilyId, 'wait'); }
      else if (ahead.length) this.familySay(ahead[0].pony.id as FamilyId, 'ahead');
    }
    if (p.s >= L - 14 && !this.over) void this.finishRace();
  }

  private async forkQuestion(e: Ev): Promise<void> {
    const q = this.nextQ();
    const res = await this.ask(q, 'signs', e.fork);
    if (!this.alive || res.side === undefined) return;
    this.player.side = res.side;
    e.answered = true;
    if (res.ok) {
      this.player.boostT = 2.6;
      this.racerBias = this.racerBias.map((b) => b - 7);
      this.talk(null, bankLine('boost'));
    } else {
      this.player.mudT = 2.0;
      this.racerBias = this.racerBias.map((b) => b + 7);
    }
    this.afterAnswer(q, res.ok, true);
    this.busy = false;
  }

  private async finishRace(): Promise<void> {
    this.over = true;
    this.busy = true;
    this.engine.slow(1);
    ui.flyHint(false);
    this.player.finishedAt = this.t;
    const before = this.racers.filter((r) => r.finishedAt >= 0 && r.finishedAt <= this.t);
    this.finishPlace = 1 + before.length;
    this.winner = this.finishPlace === 1 ? 'twilight' : before.sort((a, b) => a.finishedAt - b.finishedAt)[0].pony.id;
    sfx('sfx_win', 0.6);
    ui.confetti(40);
    await wait(900);
    if (!this.alive) return;
    this.camMode = 'front';
    void this.player.pony.celebrate();
    if (this.finishPlace === 1) {
      const r = this.racers[Math.floor(this.rnd() * this.racers.length)];
      await this.familySay(r.pony.id as FamilyId, 'win');
    } else {
      await this.familySay(this.winner as FamilyId, 'first');
    }
    await wait(400);
    this.end('win');
  }

  // ------------------------------------------------------------------ BỊ ĐUỔI

  private placeChasers(gdt: number, dt: number): void {
    const p = this.player;
    for (const c of this.chasers) {
      // giữ khoảng cách sau lưng Nhím: Nhím đứng thì quái cũng đứng (không bao giờ bắt được vì thả tay)
      const goalS = p.s - c.gap;
      c.s += p.v * gdt + (goalS - c.s) * Math.min(1, gdt * 2.2);
      this.track.pose(c.s, c.lat + Math.sin(this.t * 1.3 + c.gap) * 0.5, 0, this.tmpPose);
      c.m.place(this.tmpPose.pos, this.tmpPose.yaw);
      c.m.setRunning(p.v > 1 || !this.started);
      c.m.update(gdt, dt);
    }
  }
  private readonly tmpPose = Track.newPose();

  private tickChase(gdt: number, dt: number): void {
    const p = this.player, L = this.track.length;
    this.placeChasers(gdt, dt);
    for (const e of this.events) if (e.kind === 'attack' && !e.done && !this.busy && p.s >= e.s && !p.airborne) { e.done = true; void this.attack(e); }
    // khoảng cách quái về lại bình thường
    this.chasers.forEach((c, i) => { if (!c.extra) c.gap += ((4 + i * 1.6) - c.gap) * Math.min(1, dt * 0.3); });
    if (p.s >= L - 14 && !this.over) void this.chaseSafe();
  }

  private async attack(e: Ev): Promise<void> {
    this.busy = true;
    if (e.wave) {
      // đợt kịch tính: thêm 2 quái lao lên sát sau lưng
      await this.spawnWave();
      if (!this.alive) return;
      this.talk(null, { key: 'wave', text: '', voice: 'my' });
      await this.talking;
    }
    const pool = this.chasers.filter((c) => c.m.possessed);
    const c = pool[Math.floor(this.rnd() * pool.length)];
    const q = this.nextQ();
    void c.m.charge();
    this.talk(null, bankLine('attack'));
    const orb = this.launchOrb(c.m.center(), 0x9b5cff, true);
    const res = await this.ask(q, 'stars');
    if (!this.alive) return;
    this.resolveOrb(orb, res.ok);
    if (res.ok) {
      void this.player.pony.barrel(this.rnd() < 0.5 ? 1 : -1);
      this.talk(null, bankLine('dodge'), 300);
    } else {
      this.chasers.forEach((x) => { x.gap = Math.max(2.6, x.gap - 1.2); });
      void c.m.giggle();
    }
    this.afterAnswer(q, res.ok, true);
    this.busy = false;
    this.waveAnswers.push(res.ok);
    // đợt kịch tính xong (2 câu): đúng cả 2 → khiên phép đẩy lùi quái
    const extras = this.chasers.filter((x) => x.extra);
    if (extras.length && this.waveAnswers.length >= 2) {
      const both = this.waveAnswers.slice(-2).every(Boolean);
      this.waveAnswers = [];
      await this.talking;
      if (!this.alive) return;
      if (both) {
        this.engine.magic.ring(this.player.center(this.tmpV), 0xffe08a, 120, 6);
        this.engine.magic.ring(this.player.center(this.tmpV), 0xff7ac8, 90, 4.5);
        sfx('sfx_win', 0.5);
        this.talk(null, { key: 'shield', text: '', voice: 'my' });
        for (const x of this.chasers) x.gap += 9;
      }
      for (const x of extras) void this.dropChaser(x);
    }
  }
  private waveAnswers: boolean[] = [];

  private async spawnWave(): Promise<void> {
    const kinds = this.def.monsters;
    for (let i = 0; i < 2; i++) {
      const m = await Monster.create(this.engine, kinds[i % kinds.length]);
      if (!this.alive) { m.dispose(); return; }
      this.engine.scene.add(m.root);
      const c: Chaser = { m, s: this.player.s - 30, gap: 2.8 + i * 1.0, lat: i ? 2.6 : -2.6, extra: true };
      this.chasers.push(c);
    }
    this.waveAnswers = [];
  }

  private async dropChaser(c: Chaser): Promise<void> {
    await tween(1200, (k) => { c.gap = c.gap + k * 1.5; c.m.root.scale.setScalar(1 - k * 0.9); });
    c.m.dispose();
    this.chasers.splice(this.chasers.indexOf(c), 1);
  }

  private async chaseSafe(): Promise<void> {
    this.over = true;
    this.busy = true;
    this.engine.slow(1);
    ui.flyHint(false);
    sfx('sfx_win', 0.6);
    await narrate('safe');
    if (!this.alive) return;
    this.camMode = 'front';
    void this.player.pony.celebrate();
    for (const c of this.chasers) {
      void this.engine.magic.beam(this.player.pony.horn(), c.m.center(), 0xffe08a, 0xff7ac8, 0.8);
    }
    await wait(800);
    for (const c of this.chasers) void c.m.purify();
    this.talk(null, bankLine('purify'));
    await this.talking;
    await narrate('win_chase');
    this.end('win');
  }

  // ------------------------------------------------------------------ ĐUỔI QUÁI

  private placeTarget(gdt: number, dt: number, playerV: number): void {
    const t = this.target;
    if (!t) return;
    const p = this.player;
    // quái chạy chậm hơn Nhím chút; bị bắn trúng thì vọt lên; bỏ xa quá thì chờ (quay lại trêu)
    let v = this.def.speed * 0.8;
    if (t.boostT > 0) { t.boostT -= gdt; v *= 1.9; }
    const gap = t.s - p.s;
    if (gap > 34) v = Math.min(v, playerV * 0.6);
    if (!this.started || this.over || !t.m.possessed) v = 0;
    t.s += v * gdt;
    t.gap = t.s - p.s;
    this.track.pose(t.s, Math.sin(this.t * 0.7) * 1.6, 0, this.tmpPose);
    t.m.place(this.tmpPose.pos, this.tmpPose.yaw);
    t.m.setRunning(v > 0.5);
    t.m.update(gdt, dt);
    if (t.bubble && t.friend) {
      const bp = this.tmpPose.pos;
      const y = bp.y + t.m.hover + t.m.h + 1.15 + Math.sin(this.t * 2) * 0.12;
      t.bubble.position.set(bp.x, y, bp.z);
      t.friend.root.position.set(bp.x, y - 0.75, bp.z);
      t.friend.root.rotation.y = this.tmpPose.yaw + Math.PI;
      t.friend.run = 0;
      t.friend.update(gdt, dt);
    }
  }

  private tickHunt(gdt: number, dt: number): void {
    const t = this.target;
    this.placeTarget(gdt, dt, this.player.v);
    if (!t || this.busy || !t.m.possessed) return;
    const nearOb = this.scenery.obstacles.some((o) => !o.hit && ((o.s - this.player.s) % this.track.length + this.track.length) % this.track.length < 16);
    if (t.gap < 7.5 && !this.player.airborne && !nearOb) void this.huntQuestion(t);
  }

  private async huntQuestion(t: Target): Promise<void> {
    this.busy = true;
    const q = this.nextQ();
    this.talk(null, bankLine('near'));
    const res = await this.ask(q, 'stars');
    if (!this.alive) return;
    if (res.ok) {
      this.engine.slow(0.25);
      sfx('sfx_zap', 0.5);
      await this.engine.magic.beam(this.player.pony.horn(), t.m.center(), 0xffe08a, 0xff7ac8, 0.7);
      if (!this.alive) return;
      this.engine.slow(1);
      t.hp--;
      void t.m.hurt();
      this.talk(null, bankLine('zap'));
      t.boostT = 1.3;
    } else {
      const miss = t.m.center().add(new THREE.Vector3(2.5, -1.5, 0));
      void this.engine.magic.beam(this.player.pony.horn(), miss, 0x9fb3d9, 0xffffff, 0.6);
      void t.m.giggle();
      this.talk('nightmare', bankLine('laugh'));
      t.boostT = 1.8;
    }
    this.afterAnswer(q, res.ok, true);
    if (t.hp <= 0) await this.freeFriend(t);
    else this.busy = false;
  }

  private async freeFriend(t: Target): Promise<void> {
    this.busy = true;
    this.cutscene = true;
    await this.talking;
    if (!this.alive) return;
    await t.m.purify();
    if (!this.alive) return;
    // bong bóng rung rồi vỡ, bạn rơi xuống chạy cùng Nhím
    const b = t.bubble!;
    await tween(380, (k) => b.scale.setScalar(1 + Math.sin(k * Math.PI * 6) * 0.1 * (1 + k)));
    this.engine.magic.burst(b.position, 110, 0xffffff, 3, 0.32, 1, -1.5);
    this.engine.magic.burst(b.position, 60, 0xff7ac8, 2.2, 0.28, 0.9, -1.5);
    sfx('sfx_pop', 0.6);
    b.removeFromParent(); b.geometry.dispose(); (b.material as THREE.Material).dispose();
    t.bubble = null;
    const f = t.friend!;
    f.root.scale.setScalar(1);
    t.friend = null;
    const r = new Runner(f, this.track);
    r.s = this.player.s - 1; r.lat = r.latGoal = -1.8;
    this.helpers.push(r);
    this.friendsSaved.push(t.friendId);
    await narrate('hunt_free');
    await say(t.friendId, thanksKey(t.friendId));
    if (!this.alive) return;
    // quái đã hiền: đứng lại vẫy, mờ dần phía sau
    const old = t.m;
    void tween(2500, (k) => old.root.scale.setScalar(Math.max(0.01, 1 - k))).then(() => old.dispose());
    this.target = null;
    if (this.targets.length) {
      await narrate('hunt_next');
      await this.spawnTarget(26);
      this.cutscene = false;
      this.busy = false;
    } else {
      this.over = true;
      this.camMode = 'front';
      void this.player.pony.celebrate();
      sfx('sfx_win', 0.6);
      ui.confetti(40);
      await narrate('hunt_done');
      this.end('win');
    }
  }

  // ------------------------------------------------------------------ MÀN CUỐI: đấu Nữ hoàng Bóng Đêm

  private placeNmm(gdt: number, dt: number): void {
    const n = this.nmm;
    if (!n) return;
    const p = this.player;
    this.track.pose(p.s + 14, Math.sin(this.t * 0.5) * 3.5, 0, this.tmpPose);
    // bay cao hơn hàng sao đáp án để luôn thấy Nữ hoàng
    n.place(this.tmpPose.pos, this.tmpPose.yaw + Math.PI, 0, 4.2 + Math.sin(this.t * 1.1) * 0.6);
    n.run = 0.5;
    n.update(gdt, dt);
    if (this.night > 0.2 && Math.random() < dt * 10) {
      const c = n.center();
      this.engine.shadow.emit({ x: c.x + (Math.random() - 0.5) * 2, y: c.y + (Math.random() - 0.5) * 1.5, z: c.z + (Math.random() - 0.5) * 2, color: 0x4b3b9a, vy: 0.4, max: 1.2, size: 0.5 });
    }
  }

  private tickFinal(gdt: number, dt: number): void {
    this.placeNmm(gdt, dt);
    const p = this.player;
    if (this.busy || this.nmmHits >= 5) return;
    if (p.s - this.lastTurnS > 52) { this.lastTurnS = p.s; void this.finalTurn(); }
  }

  private async finalTurn(): Promise<void> {
    this.busy = true;
    const n = this.nmm!;
    const q = this.nextQ();
    if (this.turn === 'nmm') {
      this.talk('nightmare', bankLine('nmm_turn'));
      const orb = this.launchOrb(n.center(), 0x8fb0ff, true);
      const res = await this.ask(q, 'stars');
      if (!this.alive) return;
      this.resolveOrb(orb, res.ok);
      if (res.ok) { void this.player.pony.barrel(this.rnd() < 0.5 ? 1 : -1); this.talk(null, bankLine('dodge'), 300); }
      this.afterAnswer(q, res.ok, true);
    } else {
      this.talk('twilight', bankLine('my_turn'));
      const res = await this.ask(q, 'stars');
      if (!this.alive) return;
      if (res.ok) {
        this.engine.slow(0.25);
        sfx('sfx_zap', 0.5);
        await this.engine.magic.beam(this.player.pony.horn(), n.center(), 0xffe08a, 0xff7ac8, 0.7);
        if (!this.alive) return;
        this.engine.slow(1);
        this.nmmHits++;
        ui.setHarmony(this.nmmHits);
        this.engine.magic.burst(n.center(), 80, 0xffffff, 3, 0.34, 1, -1);
        void n.hit();
        if (this.nmmHits < 5) this.talk('nightmare', bankLine('nmm_hurt'));
      } else {
        void this.engine.magic.beam(this.player.pony.horn(), n.center().add(new THREE.Vector3(3, 2, 0)), 0x9fb3d9, 0xffffff, 0.6);
        this.talk('nightmare', bankLine('laugh'));
      }
      this.afterAnswer(q, res.ok, res.ok && this.nmmHits < 5);
      if (this.nmmHits >= 5 && !this.over) { await this.climax(); return; }
    }
    this.turn = this.turn === 'me' ? 'nmm' : 'me';
    this.busy = false;
  }

  private async climax(): Promise<void> {
    this.over = true;
    this.busy = true;
    await this.talking;
    if (!this.alive) return;
    this.engine.slow(0.3);
    const n = this.nmm!;
    await say('twilight', 'cl_1');
    if (!this.alive) return;
    const cols = [0xff4d6d, 0xff9a3c, 0xffd93d, 0x6bd968, 0x4fb3ff, 0xc86bff];
    for (let i = 0; i < cols.length; i++) void this.engine.magic.beam(this.player.pony.horn(), n.center(), cols[i], 0xffffff, 0.8 + i * 0.08);
    sfx('sfx_win', 0.7);
    await wait(900);
    await ui.flash(700);
    if (!this.alive) return;
    // Nữ hoàng Bóng Đêm → bác Hanh (công chúa Luna), trời sáng
    const luna = await Pony.load(this.engine, 'bac-hanh', 'none');
    if (!this.alive) { luna.dispose(); return; }
    n.dispose();
    this.engine.scene.add(luna.root);
    luna.flying = true;
    this.nmm = luna;
    this.engine.slow(1);
    this.engine.magic.setAdditive(false);
    void tween(4000, (k) => { this.night = 1 - k; this.scenery.setNight(1 - k); }, easeInOutSine);
    void this.engine.tweenSky(0x86cfff, 0xfff1df, 4000);
    ui.confetti(70);
    await narrate('cl_2');
    await say('bac-hanh', 'cl_3');
    await narrate('cl_4');
    this.end('win');
  }

  // ================================================================== câu hỏi

  private nextQ(): Question {
    const q = this.qs[this.qi % this.qs.length];
    this.qi++;
    return q;
  }

  /**
   * Hỏi 1 câu: chậm gần như dừng, hiện bảng + sao (hoặc 2 biển ở ngã rẽ), đọc câu hỏi, chờ bé chạm (không đếm giờ).
   * Sai 1 lượt: sao lắc, đọc chữ / số bé vừa chạm, sao đúng sáng lên. Trả về đúng hết không (+ nhánh đã chọn ở ngã rẽ).
   */
  private async ask(q: Question, where: 'stars' | 'signs', fork?: Fork): Promise<{ ok: boolean; side?: number }> {
    this.busy = true;
    if (this.obSlow) { this.obSlow = null; ui.flyHint(false); }
    this.engine.slow(0.035);
    await this.talking;
    if (!this.alive) return { ok: false };
    ui.showPanel(q.panel, this.def.theme.fruit);
    for (const k of q.intro) { await play(k); if (!this.alive) return { ok: false }; }
    let ok = true;
    let side: number | undefined;
    let filled = 0;
    for (let si = 0; si < q.steps.length; si++) {
      const step = q.steps[si];
      this.spawnChoices(step, where, fork);
      for (const c of this.choices) void c.appear(80);
      this.currentAsk = step.ask;
      this.askAt = this.engine.time;
      this.askRepeats = 0;
      await play(step.ask);
      if (!this.alive) return { ok: false };
      if (!this.shownTapHint) { this.shownTapHint = true; void play(bankLine(where === 'signs' ? 'fork' : 'tap').key); }
      const picked = await this.waitPick(step);
      if (!this.alive || !picked) return { ok: false };
      stopSpeech();
      const good = this.isRight(picked, step);
      if (where === 'signs') side = (picked.root.userData.side as number) ?? 1;
      if (good) {
        sfx('sfx_win', 0.45);
        void picked.pop();
      } else {
        ok = false;
        sfx('sfx_soft', 0.5);
        void picked.wobble();
        // đọc cái bé vừa chạm, rồi sáng sao đúng
        const said = step.tone ? null : /^\d+$/.test(picked.label) ? numKey(+picked.label) : nameKey(picked.label);
        if (said) await play(said);
        const right = this.choices.find((c) => this.isRight(c, step));
        if (right) { void right.pop(); this.engine.magic.burst(right.worldCenter(), 30, 0xffe08a, 2, 0.25, 0.7, -1); }
        await wait(500);
      }
      if (!this.alive) return { ok: false };
      if (q.panel.type === 'word') { filled = si + 1; ui.fillWord(q.panel.word, Math.min(filled, Array.from(q.panel.word).length)); if (step.tone) ui.showWord(q.panel.word); }
      if (q.panel.type === 'eq') ui.solvePanel(step.answer);
      // sao bay đi (biển ngã rẽ: giữ biển đã chọn thêm 1 chút)
      for (const c of this.choices) void c.vanish(where === 'signs' && c === picked ? 900 : 300);
      const old = this.choices;
      setTimeout(() => this.disposeChoices(old), 1000);
      this.choices = [];
      this.currentAsk = null;
    }
    if (q.panel.type === 'word') ui.showWord(q.panel.word);
    return { ok, side };
  }

  private isRight(s: LetterStar, step: Step): boolean {
    return step.tone ? s.tone === step.answer : s.label === step.answer;
  }

  private waitPick(step: Step): Promise<LetterStar | null> {
    return new Promise((resolve) => {
      this.pickResolve = resolve;
      setAnswer(`${step.tone ? 'tone' : 'pick'}:${step.answer}`, (good) => {
        const s = this.choices.find((c) => this.isRight(c, step) === good);
        if (s && this.pickResolve === resolve) { this.pickResolve = null; setAnswer(null, null); resolve(s); }
      });
      if (this.autoAnswer) setTimeout(() => {
        const s = this.choices.find((c) => this.isRight(c, step));
        if (s && this.pickResolve === resolve) { this.pickResolve = null; resolve(s); }
      }, 700);
    }).then((s) => { setAnswer(null, null); return s as LetterStar | null; });
  }

  private spawnChoices(step: Step, where: 'stars' | 'signs', fork?: Fork): void {
    const p = this.player;
    this.choices = step.choices.map((label, i) => {
      const star = new LetterStar(step.tone ? { label: '', tone: label as ToneName, size: where === 'signs' ? 1.5 : 1.15 } : { label, size: where === 'signs' ? 1.5 : 1.15 });
      if (where === 'signs' && fork) {
        const side = i === 0 ? -1 : 1;
        this.track.pose(fork.s0 + 7, side * 3.6, 0, this.tmpPose);
        star.setPos(this.tmpPose.pos.x, this.tmpPose.pos.y + 3.3, this.tmpPose.pos.z);
        star.root.userData.side = side;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 8), new THREE.MeshLambertMaterial({ color: 0xc98d5e }));
        post.position.y = 1.3;
        star.root.add(post);
        this.posts.push(post);
      } else {
        const n = step.choices.length;
        const lat = (i - (n - 1) / 2) * 2.9;
        this.track.pose(p.s + 7.5, lat, 0, this.tmpPose);
        star.setPos(this.tmpPose.pos.x, this.tmpPose.pos.y + p.y + 2.4, this.tmpPose.pos.z);
      }
      this.engine.scene.add(star.root);
      return star;
    });
  }

  private disposeChoices(list: LetterStar[]): void {
    for (const c of list) {
      c.root.traverse((o) => {
        const i = this.posts.indexOf(o as THREE.Mesh);
        if (i >= 0) { this.posts.splice(i, 1); (o as THREE.Mesh).geometry.dispose(); ((o as THREE.Mesh).material as THREE.Material).dispose(); }
      });
      c.dispose();
    }
  }

  /**
   * Sau mỗi câu: ghi ôn, trừ tim nếu sai, rồi (nối sau câu đang nói) khen / "chưa đúng" + đọc đáp án để bé học.
   * `praised`: nơi gọi đã nói câu riêng (né được, trúng rồi, đường tắt…) → bỏ câu khen chung cho đỡ nói nhiều.
   */
  private afterAnswer(q: Question, ok: boolean, praised = false): void {
    if (ok) markRight(this.progress, q.key);
    else {
      markWrong(this.progress, q.key);
      this.wrong++;
      this.hearts--;
      ui.setHearts(this.hearts, HEARTS);
      sfx('sfx_hurt', 0.5);
    }
    this.engine.slow(1);
    const lose = this.hearts <= 0;
    const prev = this.talking;
    this.talking = (async () => {
      await prev;
      if (!this.alive) return;
      if (!ok || !praised) await play(bankLine(ok ? 'ok' : 'no').key);
      if (q.lit && q.learn.length) {
        await speakSequence(q.learn, (i) => ui.litWord(q.lit![i] ?? null), 120);
        ui.litWord(null);
      } else for (const k of q.learn) await play(k);
      ui.showPanel(null);
    })();
    if (lose) void this.lose();
  }

  private async lose(): Promise<void> {
    if (this.over) return;
    this.over = true;
    this.busy = true;
    await this.talking;
    if (!this.alive) return;
    this.engine.slow(1);
    this.camMode = 'front';
    await narrate('lose');
    if (!this.alive) return;
    const fam: FamilyId = (this.racers[0]?.pony.id as FamilyId) ?? (['ba-cuong', 'me-yen', 'ong-cuong', 'ba-tuyet'] as FamilyId[])[Math.floor(this.rnd() * 4)];
    await this.familySay(fam, 'lose');
    this.loseFace = fam;
    this.end('lose');
  }
  loseFace: FamilyId | null = null;

  // ================================================================== phép bay (quái / Nữ hoàng bắn)

  private launchOrb(from: THREE.Vector3, color: number, cap: boolean): Orb {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.scale.setScalar(1.6);
    sprite.position.copy(from);
    this.engine.scene.add(sprite);
    sfx('sfx_charge', 0.4);
    const orb: Orb = { sprite, from: from.clone(), u: 0, cap: cap ? 0.55 : 1, miss: null, hitPlayer: false, color, done: () => {} };
    this.orbs.push(orb);
    return orb;
  }

  /** Sau khi trả lời: phép bay tiếp — đúng thì trượt qua bên cạnh, sai thì trúng Nhím. */
  private resolveOrb(o: Orb, dodged: boolean): void {
    o.cap = 1;
    o.hitPlayer = !dodged;
    if (dodged) {
      this.player.latGoal = (this.rnd() < 0.5 ? -1 : 1) * 2.6;
      setTimeout(() => { if (this.alive) this.player.latGoal = 0; }, 900);
      o.miss = this.player.center(new THREE.Vector3()).add(this.player.pose.right.clone().multiplyScalar(-this.player.latGoal * 0.6)).add(new THREE.Vector3(0, -1.6, 0));
    }
  }

  private updateOrbs(gdt: number): void {
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.u = Math.min(o.cap, o.u + gdt * 1.4);
      const to = o.miss ?? this.player.center(this.tmpV);
      const mid = o.from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 1.5, 0));
      const k = o.u;
      const pos = o.from.clone().multiplyScalar((1 - k) * (1 - k)).add(mid.multiplyScalar(2 * k * (1 - k))).add(to.clone().multiplyScalar(k * k));
      o.sprite.position.copy(pos);
      o.sprite.scale.setScalar(1.4 + Math.sin(this.t * 20) * 0.2);
      if (Math.random() < 0.7) this.engine.magic.emit({ x: pos.x, y: pos.y, z: pos.z, color: o.color, vy: 0.2, max: 0.5, size: 0.35 });
      if (o.u >= 1) {
        this.engine.magic.burst(pos, 60, o.color, 2.6, 0.3, 0.8, -1);
        if (o.hitPlayer) { void this.player.pony.hit(); this.player.v *= 0.4; sfx('sfx_bonk', 0.5); }
        o.sprite.removeFromParent();
        o.sprite.material.dispose();
        this.orbs.splice(i, 1);
      }
    }
  }

  // ================================================================== lời nói, HUD, camera

  /** Nói 1 câu không chặn (không chen câu hỏi đang chờ). */
  private talk(who: CastId | null, line: { key: string; text: string; voice?: string }, delayMs = 0): void {
    const prev = this.talking;
    this.talking = (async () => {
      await prev;
      if (delayMs) await wait(delayMs);
      if (!this.alive) return;
      await say(who, line.key, line.text || undefined);
    })();
  }

  private familySay(id: FamilyId, k: keyof (typeof FAMILY_LINES)[FamilyId]): Promise<void> {
    return say(id, familyKey(id, k), FAMILY_LINES[id][k]);
  }

  private updateHud(): void {
    if (!this.player) return;
    const d = this.def, p = this.player;
    if (d.mode === 'race' || d.mode === 'chase') {
      const L = this.track.length - 14;
      const marks: ui.BarMark[] = [{ id: 'me', frac: p.s / L, who: 'twilight', me: true }];
      this.racers.forEach((r, i) => marks.push({ id: `r${i}`, frac: r.s / L, who: r.pony.id }));
      if (d.mode === 'chase' && this.chasers.length) marks.push({ id: 'm', frac: Math.min(...this.chasers.map((c) => c.s)) / L, emoji: '👾' });
      ui.setBar(p.s / L, marks);
    } else ui.setBar(0, null);
    if (d.mode === 'hunt') {
      const t = this.target;
      ui.setTarget(t ? CAST[t.friendId].emoji : '🫧', t ? t.hp : null, 3);
    }
  }

  private updateCamera(dt: number, snap: boolean): void {
    const p = this.player;
    const cam = this.engine.camera;
    let d = p.pose.yaw - this.camYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.camYaw += d * Math.min(1, dt * 2.6);
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const base = this.tmpV.copy(p.pose.pos);
    base.y += p.y * 0.55 + (p.alwaysFly ? 0 : 0);
    const cfg = { race: [8.2, 3.7, 7], chase: [12, 6, 2], hunt: [8.6, 3.9, 9], final: [9, 3.0, 8] }[this.def.mode] as [number, number, number];
    let [dist, h, look] = cfg;
    if (this.busy && this.choices.length) { dist *= 0.92; h += 0.5; }
    const desired = new THREE.Vector3();
    const lookAt = new THREE.Vector3();
    if (this.camMode === 'front') {
      desired.set(base.x + fx * 7.5 - fz * 2.2, base.y + 2.4, base.z + fz * 7.5 + fx * 2.2);
      lookAt.set(base.x, base.y + 1.1, base.z);
    } else {
      desired.set(base.x - fx * dist, base.y + h, base.z - fz * dist);
      lookAt.set(base.x + fx * look, base.y + 1.2, base.z + fz * look);
    }
    if (snap) { cam.position.copy(desired); this.camLook.copy(lookAt); }
    else {
      cam.position.lerp(desired, 1 - Math.exp(-dt * (this.camMode === 'front' ? 2.2 : 5)));
      this.camLook.lerp(lookAt, 1 - Math.exp(-dt * 6));
    }
    cam.lookAt(this.camLook);
    this.engine.sunFollow(base, fx, fz);
  }

  // ================================================================== kết thúc

  private end(o: Outcome): void {
    if (!this.alive) return;
    this.over = true;
    this.resolveEnd(o);
  }

  result(o: Outcome): LevelResult {
    return { outcome: o, gems: this.gems, place: this.finishPlace || undefined, winner: this.winner, friends: this.friendsSaved, racers: this.racers.map((r) => r.pony.id) };
  }

  dispose(): void {
    if (!this.alive) return;
    this.alive = false;
    this.started = false;
    stopSpeech();
    setAnswer(null, null);
    if (this.pickResolve) { const r = this.pickResolve; this.pickResolve = null; r(null); }
    this.resolveEnd('quit');
    this.engine.slow(1);
    this.engine.timeScale = 1;
    this.engine.magic.setAdditive(false);
    ui.flyHint(false);
    ui.runHint(false);
    ui.showPanel(null);
    this.disposeChoices(this.choices);
    this.choices = [];
    for (const o of this.orbs) { o.sprite.removeFromParent(); o.sprite.material.dispose(); }
    this.orbs = [];
    this.player?.pony.dispose();
    for (const r of [...this.racers, ...this.helpers]) r.pony.dispose();
    for (const c of this.chasers) c.m.dispose();
    if (this.target) { this.target.m.dispose(); this.target.friend?.dispose(); this.target.bubble?.removeFromParent(); }
    this.nmm?.dispose();
    this.crown?.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.scenery?.dispose();
  }
}
