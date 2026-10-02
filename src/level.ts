// Một bài chơi: dựng đường + cảnh, Nhím và (tuỳ bài) người nhà đua cùng / quái đuổi / quái chạy trước / Nữ hoàng Bóng Đêm.
// CHƠI BẰNG BÀN PHÍM (cho bé tập trung): giữ ↑ = chạy, nháy ↑ 2 lần = bay / nhảy xa (lúc nào cũng được), ← → = chọn đường.
//
//  - Chướng ngại: sắp tới thì mọi thứ chậm lại và Nhím DỪNG trước chướng ngại, chờ bé nháy ↑ 2 lần để bay qua.
//  - Mỗi câu hỏi là 1 NGÃ RẼ 2 đường, biển đáp án ở đầu mỗi đường. Thời gian gần như dừng (không đếm giờ) tới khi bé bấm ← / →.
//    Đúng: đi tiếp đường chính (đường tắt cầu vồng / thoát quái / bắn trúng quái). Sai: mất 1 tim, chạy vào đường cụt (đá chắn
//    hoặc quái), người nhà gọi "Nhím ơi, quay lại!", nghe đáp án đúng, rồi tự quay ra đi đường đúng. Ghép tiếng: mỗi bước
//    (chữ đầu, nguyên âm, dấu) là 1 ngã rẽ. Màn cuối trên trời: 2 vòng mây trái / phải thay cho ngã rẽ.
//  - Câu sai được ghi để ôn lại ở bài sau. Hết 3 tim là thua (chơi lại bài đó).
import * as THREE from 'three';
import type { Engine } from './engine';
import { Track, JOG_LEN, BRANCH_LEN, type Span, type Turn, mulberry32 } from './track';
import { Scenery, type Obstacle } from './scenery';
import { Pony } from './pony';
import { Runner } from './runner';
import { Monster } from './monster';
import { LetterStar, glowTexture, type ToneName } from './letterstar';
import { CAST, HEARTS, RACERS_BASE, type CastId, type FamilyId, type FriendId, type LevelDef, type MonsterKind } from './data';
import { makeQuiz, type Question, type Step } from './quiz';
import { markRight, markWrong, cosmetics, type Progress } from './progress';
import { play, sfx, speakSequence, stopSpeech } from './audio';
import { say, narrate } from './talk';
import { bankLine } from './voice';
import { FAMILY_LINES, familyKey, thanksKey, toneLabelKey } from './lines';
import { nameKey } from './letters';
import { tween, wait, easeInOutSine } from './tween';
import { setAnswer } from './testhook';
import * as ui from './ui';

export type Outcome = 'win' | 'lose' | 'quit';
export interface LevelResult { outcome: Outcome; gems: number; place?: number; winner?: CastId; friends: FriendId[]; racers: CastId[] }

const LANE = 2.5;
const BRIDGE_LEN = 36;
/** đoạn thẳng trước ngã rẽ (vùng hỏi) và sau ngã rẽ (có 1 chướng ngại) */
const APPROACH = 24;
const AFTER = 36;
/** màn cuối: khoảng cách giữa 2 cặp vòng mây */
const GATE_GAP = 58;
/** quái đứng chờ ở cuối nhánh cụt (theo thế giới) */
const DEAD_END_MONSTER: Record<number, MonsterKind> = { 1: 'slime_jt', 2: 'goblin', 3: 'ghost', 4: 'wizard' };

/** 1 lượt chọn đường: câu hỏi + bước (ghép tiếng có 2–3 bước, mỗi bước 1 ngã rẽ). */
interface Slot { q: Question; si: number; first: boolean; last: boolean }
interface Junction {
  turn: Turn; branch: Track; back: Track; slot: Slot;
  /** quái chờ ở cuối nhánh cụt (null = đống đá) */
  mon: Monster | null;
  signs: LetterStar[];
  asked: boolean;
  /** đường bé chọn: −1 trái, +1 phải, 0 = chưa chọn */
  choice: number;
  /** đang đi nhầm: vào nhánh / quay ra */
  trip: 'go' | 'end' | 'back' | null;
  wave?: boolean;
}
interface Gate { s: number; slot: Slot; signs: LetterStar[]; rings: THREE.Mesh[]; choice: number; mainDir: number; passed: boolean }
interface Chaser { m: Monster; s: number; gap: number; lat: number; extra: boolean }
interface Target { m: Monster; s: number; hp: number; friendId: FriendId; friend: Pony | null; bubble: THREE.Mesh | null; boostT: number; gap: number }
interface Orb { sprite: THREE.Sprite; from: THREE.Vector3; u: number; cap: number; miss: THREE.Vector3 | null; hitPlayer: boolean; color: number }

/** Cặp người nhà đua lần trước (không lặp lại liền). */
let lastPair = '';

/** Bên của đường đúng: biển trái là lựa chọn 0, biển phải là lựa chọn 1. */
const mainDirOf = (step: Step): -1 | 1 => (step.choices[0] === step.answer ? -1 : 1);

export class Level {
  track!: Track;
  scenery!: Scenery;
  player!: Runner;
  readonly racers: Runner[] = [];
  private racerBias: number[] = [];
  private readonly chasers: Chaser[] = [];
  private targets: { kind: MonsterKind; friend: FriendId }[] = [];
  private target: Target | null = null;
  private nmm: Pony | null = null;
  private nmmHits = 0;
  private turnWho: 'me' | 'nmm' = 'me';
  private readonly helpers: Runner[] = [];
  hearts = HEARTS;
  gems = 0;
  private wrong = 0;
  private slots: Slot[] = [];
  private slotI = 0;
  private junctions: Junction[] = [];
  private gate: Gate | null = null;
  private lastGateS = 0;
  private rnd: () => number;
  /** bé đang giữ ↑ */
  holding = false;
  busy = false;
  /** đang diễn cảnh (cứu bạn, đi nhầm đường): Nhím tự chạy / đứng xem */
  private cutscene = false;
  started = false;
  private over = false;
  private alive = true;
  private pickResolve: ((dir: number) => void) | null = null;
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
  private taughtTurn = false;
  private taughtFly = false;
  private friendsSaved: FriendId[] = [];
  private finishPlace = 0;
  private winner: CastId | undefined;
  private resolveEnd!: (o: Outcome) => void;
  readonly ended: Promise<Outcome>;
  private cosmetic = new Set<string>();
  private crown: THREE.Group | null = null;
  private night = 0;
  private waveAnswers: boolean[] = [];
  private qWrong = new Set<string>();
  loseFace: FamilyId | null = null;
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpPose = Track.newPose();

  /** auto: máy tự giữ ↑ + tự bay (test); autoAnswer: máy tự chọn đường đúng. */
  constructor(private readonly engine: Engine, readonly def: LevelDef, private readonly progress: Progress, private readonly auto = false, private readonly autoAnswer = false) {
    this.rnd = mulberry32(def.seed * 31 + Math.floor(Math.random() * 1e6));
    this.ended = new Promise((r) => { this.resolveEnd = r; });
  }

  get mode(): LevelDef['mode'] { return this.def.mode; }

  /** Quãng đường "trên đường chính" của Nhím (đang đi nhầm vào nhánh cụt thì tính như đứng ở ngã rẽ). */
  private get mainS(): number {
    const j = this.junctions.find((x) => x.trip);
    return j ? j.turn.s : this.player.s;
  }

  // ================================================================== dựng bài

  async setup(): Promise<void> {
    const d = this.def;
    // câu hỏi trước (hướng mỗi ngã rẽ phụ thuộc đáp án nằm ở biển trái hay phải)
    const qCount = d.mode === 'hunt' ? 10 : d.mode === 'final' ? 16 : d.questions;
    const qs = makeQuiz(d.quiz, qCount, 2, this.progress.weak, this.rnd);
    const slots: Slot[] = [];
    for (const q of qs) q.steps.forEach((_, si) => slots.push({ q, si, first: si === 0, last: si === q.steps.length - 1 }));
    // đuổi quái: đủ ngã rẽ cho 6 phát trúng + 2 lần sai (sai 3 là thua)
    this.slots = d.mode === 'hunt' ? slots.slice(0, Math.max(8, slots.findIndex((s, i) => i >= 7 && s.last) + 1)) : slots;

    const bridges: Span[] = [];
    const turns: Turn[] = [];
    const obstacleAt: number[] = [];
    let L = d.length;
    if (d.mode !== 'final') {
      let s = 0;
      if (d.bridges >= 2) { bridges.push({ s0: 26, s1: 26 + BRIDGE_LEN }); s = 26 + BRIDGE_LEN + 14; }
      else { obstacleAt.push(36); s = 52; }
      this.slots.forEach((sl, i) => {
        const t: Turn = { s: s + APPROACH, dir: mainDirOf(sl.q.steps[sl.si]) };
        turns.push(t);
        s = t.s + JOG_LEN;
        if (i < this.slots.length - 1 && sl.last) obstacleAt.push(s + 15);
        s += sl.last ? AFTER : 16;
      });
      if (d.bridges >= 1) { bridges.push({ s0: s + 4, s1: s + 4 + BRIDGE_LEN }); s += BRIDGE_LEN + 16; }
      L = Math.round(s + 34);
    }
    this.track = new Track({ closed: d.mode === 'final', length: L, seed: d.seed, width: 7.2, bridges, turns,
      baseY: d.mode === 'final' ? 40 : 0, wave: d.mode === 'final' ? 5 : 0 });
    // nhánh cụt mỗi ngã rẽ (đi vào + đi ra)
    this.junctions = this.track.turns.map((t, i) => ({
      turn: t, branch: Track.branch(this.track, t, BRANCH_LEN), back: Track.branch(this.track, t, BRANCH_LEN, true),
      slot: this.slots[i], mon: null, signs: [], asked: false, choice: 0, trip: null,
      wave: d.mode === 'chase' && i === Math.floor(this.slots.length * 0.6),
    }));
    this.scenery = new Scenery(this.engine, this.track, d, this.junctions.map((j) => j.branch));
    for (const s of obstacleAt) await this.scenery.addObstacle(s);
    for (const s of obstacleAt) this.scenery.addGems(s - 3.5, 6, 1.4, 0, 2.2);
    // hàng ngọc giữa đường
    if (d.mode !== 'final') {
      for (const j of this.junctions) this.scenery.addGems(j.turn.s + JOG_LEN + 4, 5, 1.6, 0);
      this.scenery.addGems(14, 5, 1.6, 0);
    }
    this.scenery.onGem = () => { this.gems++; ui.setGems(this.gems, true); sfx('sfx_gem', 0.35); };
    await this.scenery.build();
    if (!this.alive) return;
    // nửa số nhánh cụt có quái chờ (cười khi bé chạy nhầm vào), còn lại là đống đá
    const monKind = DEAD_END_MONSTER[d.world] ?? 'slime_jt';
    for (const j of this.junctions) {
      if (this.rnd() < 0.5) continue;
      const m = await Monster.create(this.engine, monKind);
      if (!this.alive) { m.dispose(); return; }
      j.branch.pose(j.branch.length - 4.5, 0, this.tmpPose);
      m.place(this.tmpPose.pos, this.tmpPose.yaw + Math.PI);
      this.engine.scene.add(m.root);
      j.mon = m;
    }

    // Nhím
    const tw = await Pony.load(this.engine, 'twilight', 'real');
    this.engine.scene.add(tw.root);
    this.player = new Runner(tw, this.track);
    this.player.s = d.mode === 'final' ? 0 : 4;
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
      pair = [...fam].sort(() => this.rnd() - 0.5).slice(0, 2);
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
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.15, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0x9a7cff, transparent: true, opacity: 0.38, roughness: 0.1, clearcoat: 1, depthWrite: false, emissive: 0x2a0f60 }));
    bubble.renderOrder = 2;
    friend.root.scale.setScalar(0.62);
    this.engine.scene.add(bubble, friend.root);
    this.target = { m, s: this.mainS + gap, hp: 3, friendId: next.friend, friend, bubble, boostT: 0, gap };
    this.updateHud();
  }

  private async setupFinal(): Promise<void> {
    this.night = 1;
    this.engine.magic.setAdditive(true);
    const n = await Pony.load(this.engine, 'nightmare', 'none');
    this.engine.scene.add(n.root);
    n.flying = true;
    this.nmm = n;
    this.lastGateS = 20;
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
    await narrate('keys');
    if (!this.alive) return 'quit';
    this.camMode = 'follow';
    await ui.countdown();
    if (!this.alive) return 'quit';
    this.started = true;
    this.idleT = 5.5;
    if (this.auto) this.holding = true;
    return this.ended;
  }

  /** Giữ / thả ↑. */
  setHold(on: boolean): void {
    this.holding = on || this.auto;
    if (on) this.idleT = 0;
  }

  /** Nháy ↑ 2 lần: bay / nhảy xa (kỹ năng có sẵn, không cần chướng ngại). */
  pressFly(): void {
    if (!this.started || this.over || this.player.alwaysFly || this.cutscene) return;
    if (this.player.fly()) {
      sfx('sfx_fly', 0.45);
      if (this.obSlow) this.clearSlow();
    }
  }

  /** ← (−1) / → (+1): chọn đường ở ngã rẽ / vòng mây. Trả về true nếu đã dùng phím. */
  steer(dir: number): boolean {
    if (!this.pickResolve) return false;
    const r = this.pickResolve;
    this.pickResolve = null;
    r(dir);
    return true;
  }

  /** Nghe lại câu hỏi (nút 🔊 / phím R). */
  repeat(): void { if (this.currentAsk && this.pickResolve) { void play(this.currentAsk); this.askAt = this.engine.time; } }

  // ================================================================== mỗi khung

  tick(dt: number, gdt: number): void {
    if (!this.alive || !this.player) return;
    this.t += dt;
    const d = this.def;
    const p = this.player;
    const trip = this.junctions.find((j) => j.trip);
    // tốc độ mong muốn: giữ ↑ (hoặc đang hỏi / đang đi nhầm đường: tự chạy chậm)
    let want = this.started && !this.over && !this.cutscene && (this.holding || this.busy) ? d.speed : 0;
    if (trip && (trip.trip === 'go' || trip.trip === 'back')) want = d.speed * 0.8;
    // chưa chọn đường thì không vào được ngã rẽ / vòng mây
    const pending = this.junctions.find((j) => j.asked && !j.choice);
    if (pending && p.s > pending.turn.s - 1.5) want = 0;
    if (this.gate && !this.gate.choice && p.s > this.gate.s - 6) want = 0;
    p.update(gdt, dt, want);
    if (pending && !trip) p.s = Math.min(p.s, pending.turn.s - 1);
    if (this.over && !this.track.closed && p.track === this.track) p.s = Math.min(p.s, this.track.length - 2);

    if (trip) this.tickTrip(trip);
    if (this.started && !this.over) {
      if (!trip) {
        this.obstacles();
        this.junctionTriggers();
      }
      if (!this.busy && !trip) {
        // nhắc giữ ↑ khi đứng yên lâu
        if (p.v < 0.5 && !this.holding) {
          this.idleT += dt;
          if (this.idleT > 7) { this.idleT = -9; ui.keyHint('run'); this.talk(null, bankLine('hold')); }
        } else if (this.idleT !== 0) { if (!this.obSlow) ui.keyHint(null); this.idleT = 0; }
      }
      if (d.mode === 'race') this.tickRace(gdt, dt);
      else if (d.mode === 'chase') this.tickChase(gdt, dt);
      else if (d.mode === 'hunt') this.tickHunt(gdt, dt);
      else this.tickFinal(gdt, dt);
    } else {
      if (d.mode === 'race') for (const r of this.racers) r.update(gdt, dt, 0);
      if (d.mode === 'chase') this.placeChasers(gdt, dt);
      if (d.mode === 'hunt') this.placeTarget(gdt, dt);
      if (d.mode === 'final') this.placeNmm(gdt, dt);
    }
    for (const h of this.helpers) {
      h.latGoal = -1.8;
      h.update(gdt, dt, trip ? 0 : Math.max(0, p.v * 0.98 + (this.mainS - 3 - h.s) * 1.5));
    }
    for (const j of this.junctions) j.mon?.update(gdt, dt);

    this.scenery.collectGems(p.center(this.tmpV), 1.5);
    this.trail(dt);
    this.updateOrbs(gdt);
    for (const j of this.junctions) for (const c of j.signs) c.update(dt, this.engine.camera);
    if (this.gate) for (const c of this.gate.signs) c.update(dt, this.engine.camera);
    // nhắc lại câu hỏi khi bé im lâu (16 s, 32 s…)
    if (this.pickResolve && this.currentAsk && this.engine.time - this.askAt > 16 + this.askRepeats * 16) {
      this.askRepeats++;
      this.askAt = this.engine.time;
      void play(this.currentAsk);
    }
    this.scenery.update(dt, this.engine.time, this.mainS, this.engine.camera);
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
    if (this.cosmetic.has('aura') && Math.random() < dt * 14) m.twinkle(p.center(this.tmpV), 0xffe08a, 1, 1.4);
    if (p.pony.flying && !p.pony.flyer) {
      const c = p.center(this.tmpV);
      m.emit({ x: c.x + (Math.random() - 0.5) * 0.6, y: c.y + (Math.random() - 0.5) * 0.6, z: c.z + (Math.random() - 0.5) * 0.6, color: [0xff7ac8, 0xffd166, 0x7fd8ff, 0xc084fc][Math.floor(Math.random() * 4)], vy: -0.3, max: 0.8, size: 0.26 });
    }
  }

  // ------------------------------------------------------------------ chướng ngại: chậm lại, dừng chờ nháy ↑ 2 lần

  private obstacles(): void {
    const p = this.player, tr = this.track;
    let near: Obstacle | null = null;
    for (const ob of this.scenery.obstacles) {
      if (ob.hit) continue;
      const a = ob.s - p.s;
      if (this.prevS < ob.s && p.s >= ob.s) {
        // đi qua lúc không bay (hiếm: máy test / bé bay quá sớm rồi đáp xuống sát): vấp nhẹ, không tính sai
        if (p.y < ob.h * 0.85) {
          this.scenery.smash(ob);
          p.v = Math.min(p.v, 2.5);
          void p.pony.tumble();
          sfx('sfx_bonk', 0.5);
          this.talk(null, bankLine('oops'));
        } else if (Math.random() < 0.5) this.talk(null, bankLine('flyok'));
        if (this.obSlow === ob) this.clearSlow();
        continue;
      }
      if (a > 0 && a < 11 && (!near || a < near.s - p.s)) near = ob;
    }
    for (const r of this.racers) {
      for (const ob of this.scenery.obstacles) if (ob.s - r.s > 0 && ob.s - r.s < 2.6 && !r.airborne) r.fly();
    }
    if (!near || p.airborne) { if (this.obSlow && p.airborne) this.clearSlow(); return; }
    const a = near.s - p.s;
    // dừng hẳn trước chướng ngại tới khi bé bay (không bao giờ bị vấp vì không kịp)
    if (a < 3) p.s = near.s - 3;
    if (this.auto && a <= 3.2) this.pressFly();
    if (!this.busy && this.obSlow !== near && p.v > 2.5) {
      this.obSlow = near;
      this.engine.slow(0.15);
      ui.keyHint('fly');
      this.talk(null, this.taughtFly ? bankLine('fly') : { key: 'fly_teach', text: '' });
      this.taughtFly = true;
    }
    void tr;
  }

  private clearSlow(): void {
    this.obSlow = null;
    ui.keyHint(null);
    if (!this.busy) this.engine.slow(1);
  }

  // ------------------------------------------------------------------ ngã rẽ (câu hỏi) trên mặt đất

  private junctionTriggers(): void {
    if (this.busy || this.def.mode === 'final') return;
    const p = this.player;
    const j = this.junctions.find((x) => !x.asked && p.s > x.turn.s - APPROACH + 4);
    if (j && !this.obSlow) void this.askJunction(j);
    // tới điểm rẽ: đi theo đường đã chọn
    for (const x of this.junctions) {
      if (!x.choice || x.trip || p.track !== this.track) continue;
      if (this.prevS < x.turn.s && p.s >= x.turn.s && x.choice !== x.turn.dir) {
        x.trip = 'go';
        p.track = x.branch;
        p.s = Math.max(0, p.s - x.turn.s);
        p.lat = p.latGoal = 0;
        this.cutscene = false;
      }
    }
  }

  /** Hỏi ở ngã rẽ: biển đáp án ở đầu 2 đường, chờ ← / →. Đường đúng = đường chính. */
  private async askJunction(j: Junction): Promise<void> {
    j.asked = true;
    this.busy = true;
    const { q, si } = j.slot;
    const step = q.steps[si];
    // biển trái / phải (đường chính bên j.turn.dir)
    j.signs = [-1, 1].map((side, i) => {
      const star = this.makeSign(step, step.choices[i]);
      const onMain = side === j.turn.dir;
      (onMain ? this.track : j.branch).pose(onMain ? j.turn.s + 11 : 11, 0, this.tmpPose);
      star.setPos(this.tmpPose.pos.x, this.tmpPose.pos.y + 3.4, this.tmpPose.pos.z);
      star.root.userData.side = side;
      this.addPost(star);
      this.engine.scene.add(star.root);
      void star.appear(80);
      return star;
    });
    const dir = await this.ask(j.slot, j.signs, j.turn.dir);
    if (!this.alive) return;
    j.choice = dir;
    const ok = dir === j.turn.dir;
    this.player.latGoal = dir * 1.2;
    setTimeout(() => { if (this.alive && !j.trip) this.player.latGoal = 0; }, 1600);
    this.onAnswer(j, ok);
  }

  /** Hệ quả 1 lượt chọn theo kiểu bài. */
  private onAnswer(j: Junction, ok: boolean): void {
    const mode = this.def.mode;
    if (mode === 'race') {
      if (ok) { this.player.boostT = 2.4; this.racerBias = this.racerBias.map((b) => b - 6); this.talk(null, bankLine('boost')); }
      else this.racerBias = this.racerBias.map((b) => b + 6);
      this.afterAnswer(j.slot, ok, ok);
      this.busy = false;
    } else if (mode === 'chase') {
      if (ok) { this.chasers.forEach((c) => { c.gap += 3; }); this.talk(null, bankLine('escape')); }
      this.afterAnswer(j.slot, ok, ok);
      this.busy = false;
      this.waveAnswers.push(ok);
      void this.checkWave();
    } else {
      void this.huntShot(j, ok);
    }
  }

  /** Đi nhầm đường: chạy vào nhánh cụt → dừng (đá / quái) → người nhà gọi lại → quay ra ngã rẽ → đi đường đúng. */
  private tickTrip(j: Junction): void {
    const p = this.player;
    if (j.trip === 'go' && p.s >= j.branch.length - 7) {
      j.trip = 'end';
      p.v = 0;
      void this.deadEnd(j);
    } else if (j.trip === 'back' && p.s >= j.back.length - 0.6) {
      p.track = this.track;
      p.s = j.turn.s + 0.4;
      p.lat = p.latGoal = 0;
      j.choice = j.turn.dir;
      j.trip = null;
      this.cutscene = false;
      // bị đuổi: quay ra thì quái đã tới sát, bắn 1 phát (đã mất tim ở lúc chọn sai)
      if (this.def.mode === 'chase') {
        const c = this.chasers.find((x) => x.m.possessed);
        if (c) { const o = this.launchOrb(c.m.center(), 0x9b5cff, false); o.hitPlayer = true; }
      }
    }
  }

  private async deadEnd(j: Junction): Promise<void> {
    this.cutscene = true;
    if (j.mon) {
      void j.mon.giggle();
      this.engine.magic.burst(j.mon.center(), 40, 0x9b5cff, 2.2, 0.3, 0.8, -1);
      sfx('sfx_charge', 0.4);
      this.talk(null, bankLine('stubmon'));
    } else this.talk(null, bankLine('deadend'));
    // người nhà gọi lại (bài đua), người kể nhắc (bài khác)
    const r = this.racers[Math.floor(this.rnd() * this.racers.length)];
    if (r) this.talk(r.pony.id, { key: familyKey(r.pony.id as FamilyId, 'back'), text: FAMILY_LINES[r.pony.id as FamilyId].back });
    else this.talk(null, bankLine('back'));
    await this.talking;
    if (!this.alive) return;
    // quay đầu chạy ra
    const p = this.player;
    p.track = j.back;
    p.s = Math.max(0, j.branch.length - p.s);
    j.trip = 'back';
    this.cutscene = false;
  }

  // ------------------------------------------------------------------ câu hỏi chung (ngã rẽ / vòng mây)

  private makeSign(step: Step, label: string): LetterStar {
    return new LetterStar(step.tone ? { label: '', tone: label as ToneName, size: 1.5 } : { label, size: 1.5 });
  }
  private addPost(star: LetterStar): void {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.7, 8), new THREE.MeshLambertMaterial({ color: 0xc98d5e }));
    post.position.y = 1.35;
    star.root.add(post);
  }

  /**
   * Hỏi 1 lượt: thời gian gần như dừng, hiện bảng (lượt đầu của câu), đọc câu hỏi, chờ ← / → (không đếm giờ).
   * `mainDir`: bên có đáp án đúng. Trả về bên bé chọn. Sai: biển sai lắc, đọc chữ / số bé chọn, biển đúng sáng lên.
   */
  private async ask(slot: Slot, signs: LetterStar[], mainDir: number): Promise<number> {
    const { q, si } = slot;
    const step = q.steps[si];
    this.engine.slow(0.035);
    if (this.obSlow) { this.obSlow = null; }
    await this.talking;
    if (!this.alive) return 0;
    if (slot.first) {
      ui.showPanel(q.panel, this.def.theme.fruit);
      for (const k of q.intro) { await play(k); if (!this.alive) return 0; }
    }
    ui.keyHint('turn');
    this.currentAsk = step.ask;
    this.askAt = this.engine.time;
    this.askRepeats = 0;
    await play(step.ask);
    if (!this.alive) return 0;
    if (!this.taughtTurn) { this.taughtTurn = true; void play('turn_teach'); }
    const dir = await new Promise<number>((resolve) => {
      this.pickResolve = resolve;
      setAnswer(`${step.tone ? 'tone' : 'turn'}:${step.answer}`, (good) => {
        if (this.pickResolve === resolve) { this.pickResolve = null; resolve(good ? mainDir : -mainDir); }
      });
      if (this.autoAnswer) setTimeout(() => { if (this.pickResolve === resolve) { this.pickResolve = null; resolve(mainDir); } }, 700);
    });
    setAnswer(null, null);
    this.currentAsk = null;
    ui.keyHint(null);
    if (!this.alive || !dir) return 0;
    stopSpeech();
    const picked = signs.find((c) => c.root.userData.side === dir)!;
    const right = signs.find((c) => c.root.userData.side === mainDir)!;
    if (dir === mainDir) {
      sfx('sfx_win', 0.45);
      void picked.pop();
    } else {
      sfx('sfx_soft', 0.5);
      void picked.wobble();
      void right.pop();
      this.engine.magic.burst(right.worldCenter(), 30, 0xffe08a, 2, 0.25, 0.7, -1);
    }
    if (q.panel.type === 'word') { ui.fillWord(q.panel.word, Math.min(si + 1, Array.from(q.panel.word).length)); if (step.tone) ui.showWord(q.panel.word); }
    if (q.panel.type === 'eq') ui.solvePanel(step.answer);
    // biển bay đi sau khi Nhím chạy qua
    const old = signs.slice();
    setTimeout(() => { for (const c of old) void c.vanish(400); }, 2600);
    setTimeout(() => this.disposeSigns(old), 3200);
    this.engine.slow(1);
    return dir;
  }

  private disposeSigns(list: LetterStar[]): void {
    for (const c of list) {
      c.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry.type === 'CylinderGeometry') { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
      c.dispose();
    }
    for (const j of this.junctions) j.signs = j.signs.filter((s) => !list.includes(s));
  }

  /**
   * Sau mỗi lượt: trừ tim nếu sai, ghi ôn (1 lần cho cả câu), rồi (nối sau câu đang nói) khen / "chưa đúng" + đáp án.
   * Ghép tiếng: lượt giữa sai thì đọc tên chữ / dấu đúng; lượt cuối đọc đánh vần cả tiếng (chữ sáng theo).
   * `praised`: nơi gọi đã nói câu riêng (đường tắt, thoát, trúng rồi…) → bỏ câu khen chung.
   */
  private afterAnswer(slot: Slot, ok: boolean, praised = false): void {
    const { q, si, last } = slot;
    const step = q.steps[si];
    if (!ok) {
      if (!this.qWrong.has(q.key)) { this.qWrong.add(q.key); markWrong(this.progress, q.key); }
      this.wrong++;
      this.hearts--;
      ui.setHearts(this.hearts, HEARTS);
      sfx('sfx_hurt', 0.5);
    } else if (last && !this.qWrong.has(q.key)) markRight(this.progress, q.key);
    const lose = this.hearts <= 0;
    const prev = this.talking;
    this.talking = (async () => {
      await prev;
      if (!this.alive) return;
      if (!ok || (!praised && last)) await play(bankLine(ok ? 'ok' : 'no').key);
      if (q.panel.type === 'word') {
        if (!ok && !last) await play(step.tone ? toneLabelKey(step.answer) : nameKey(step.answer));
        if (last && q.lit) { await speakSequence(q.learn, (i) => ui.litWord(q.lit![i] ?? null), 120); ui.litWord(null); }
      } else for (const k of q.learn) await play(k);
      if (last) ui.showPanel(null);
    })();
    if (lose) void this.lose();
  }

  // ------------------------------------------------------------------ ĐUA

  private tickRace(gdt: number, dt: number): void {
    const p = this.player, L = this.track.length, ms = this.mainS;
    // người nhà: dây chun quanh Nhím (không bỏ xa, không tụt mất, Nhím đứng / đi nhầm đường thì chờ), đoạn cuối theo số câu sai
    this.racers.forEach((r, i) => {
      const lastStretch = ms > L - 90;
      const wobble = Math.sin(this.t * 0.35 + i * 2.1) * 3.5;
      const offset = lastStretch ? (this.wrong - 1) * 3.2 + (i ? 1.2 : -0.6) : wobble + this.racerBias[i];
      this.racerBias[i] *= Math.exp(-dt * 0.12);
      let want = this.def.speed * Math.min(1.35, Math.max(0.45, 1 + (ms + offset - r.s) * 0.07));
      if ((p.v < 1 || p.track !== this.track) && r.s > ms + 6) want = 0;
      if (r.finishedAt >= 0) want = r.s < L - 3 ? 3 : 0;
      // đợi ở ngã rẽ chưa chọn (không đi trước vào đoạn rẽ khi Nhím còn đang nghĩ)
      const pend = this.junctions.find((j) => !j.choice && r.s > j.turn.s - 6 && r.s < j.turn.s);
      if (pend && this.busy) want = Math.min(want, 2);
      r.latGoal = i ? LANE : -LANE;
      r.update(gdt, dt, want);
      if (r.s >= L - 14 && r.finishedAt < 0) r.finishedAt = this.t;
    });
    this.chatT -= dt;
    if (this.chatT <= 0 && !this.busy && !this.cutscene) {
      this.chatT = 14 + this.rnd() * 10;
      const ahead = this.racers.filter((r) => r.s > ms + 4);
      if (p.v < 1 && this.racers.length) this.familySay(this.racers[0].pony.id as FamilyId, 'wait');
      else if (ahead.length) this.familySay(ahead[0].pony.id as FamilyId, 'ahead');
    }
    if (p.track === this.track && p.s >= L - 14 && !this.over) void this.finishRace();
  }

  private async finishRace(): Promise<void> {
    this.over = true;
    this.busy = true;
    this.engine.slow(1);
    ui.keyHint(null);
    this.player.finishedAt = this.t;
    const before = this.racers.filter((r) => r.finishedAt >= 0 && r.finishedAt <= this.t);
    this.finishPlace = 1 + before.length;
    this.winner = this.finishPlace === 1 ? 'twilight' : before.sort((a, b) => a.finishedAt - b.finishedAt)[0].pony.id;
    sfx('sfx_win', 0.6);
    ui.confetti(40);
    await this.talking;
    await wait(500);
    if (!this.alive) return;
    this.camMode = 'front';
    void this.player.pony.celebrate();
    if (this.finishPlace === 1) await this.familySay(this.racers[Math.floor(this.rnd() * this.racers.length)].pony.id as FamilyId, 'win');
    else await this.familySay(this.winner as FamilyId, 'first');
    await wait(400);
    this.end('win');
  }

  // ------------------------------------------------------------------ BỊ ĐUỔI

  private placeChasers(gdt: number, dt: number): void {
    const p = this.player, ms = this.mainS;
    const onMain = p.track === this.track;
    for (const c of this.chasers) {
      // giữ khoảng cách sau lưng Nhím (Nhím đứng thì quái đứng); Nhím đi nhầm đường → quái dồn tới sát ngã rẽ
      const goalS = onMain ? ms - c.gap : ms - 2 - this.chasers.indexOf(c) * 1.2;
      c.s += (onMain ? p.v * gdt : 0) + (goalS - c.s) * Math.min(1, gdt * 2.2);
      this.track.pose(c.s, c.lat + Math.sin(this.t * 1.3 + c.gap) * 0.5, this.tmpPose);
      c.m.place(this.tmpPose.pos, this.tmpPose.yaw);
      c.m.setRunning(p.v > 1 || !this.started);
      c.m.update(gdt, dt);
    }
  }

  private tickChase(gdt: number, dt: number): void {
    const p = this.player, L = this.track.length;
    // đợt kịch tính: 2 quái lao lên trước ngã rẽ đánh dấu
    const wj = this.junctions.find((j) => j.wave && !j.asked && p.s > j.turn.s - APPROACH - 10);
    if (wj && !wj.asked && !this.chasers.some((c) => c.extra)) { wj.wave = false; void this.spawnWave(); }
    this.placeChasers(gdt, dt);
    this.chasers.forEach((c, i) => { if (!c.extra) c.gap += ((4 + i * 1.6) - c.gap) * Math.min(1, dt * 0.3); });
    if (p.track === this.track && p.s >= L - 14 && !this.over) void this.chaseSafe();
  }

  private async spawnWave(): Promise<void> {
    const kinds = this.def.monsters;
    this.waveAnswers = [];
    for (let i = 0; i < 2; i++) {
      const m = await Monster.create(this.engine, kinds[i % kinds.length]);
      if (!this.alive) { m.dispose(); return; }
      this.engine.scene.add(m.root);
      this.chasers.push({ m, s: this.player.s - 30, gap: 2.8 + i, lat: i ? 2.6 : -2.6, extra: true });
    }
    this.talk(null, { key: 'wave', text: '' });
  }

  /** Đợt kịch tính xong (2 lượt): đúng cả 2 → khiên phép đẩy lùi cả đám. */
  private async checkWave(): Promise<void> {
    const extras = this.chasers.filter((x) => x.extra);
    if (!extras.length || this.waveAnswers.length < 2) return;
    const both = this.waveAnswers.slice(-2).every(Boolean);
    this.waveAnswers = [];
    await this.talking;
    if (!this.alive) return;
    if (both) {
      this.engine.magic.ring(this.player.center(this.tmpV), 0xffe08a, 120, 6);
      this.engine.magic.ring(this.player.center(this.tmpV), 0xff7ac8, 90, 4.5);
      sfx('sfx_win', 0.5);
      this.talk(null, { key: 'shield', text: '' });
      for (const x of this.chasers) x.gap += 9;
    }
    for (const x of extras) void this.dropChaser(x);
  }

  private async dropChaser(c: Chaser): Promise<void> {
    c.extra = false;
    await tween(1200, (k) => { c.gap += k * 1.5; c.m.root.scale.setScalar(Math.max(0.01, 1 - k * 0.9)); });
    if (!this.alive) return;
    c.m.dispose();
    this.chasers.splice(this.chasers.indexOf(c), 1);
  }

  private async chaseSafe(): Promise<void> {
    this.over = true;
    this.busy = true;
    this.engine.slow(1);
    ui.keyHint(null);
    sfx('sfx_win', 0.6);
    await this.talking;
    await narrate('safe');
    if (!this.alive) return;
    this.camMode = 'front';
    void this.player.pony.celebrate();
    for (const c of this.chasers) void this.engine.magic.beam(this.player.pony.horn(), c.m.center(), 0xffe08a, 0xff7ac8, 0.8);
    await wait(800);
    for (const c of this.chasers) void c.m.purify();
    this.talk(null, bankLine('purify'));
    await this.talking;
    await narrate('win_chase');
    this.end('win');
  }

  // ------------------------------------------------------------------ ĐUỔI QUÁI

  private placeTarget(gdt: number, dt: number): void {
    const t = this.target;
    if (!t) return;
    const p = this.player, ms = this.mainS;
    // quái giữ khoảng 12–20 m phía trước (luôn thấy để bắn); bị trúng thì vọt lên; Nhím đứng / đi nhầm thì quái chạy chậm trêu
    const gapGoal = t.boostT > 0 ? 24 : 15;
    if (t.boostT > 0) t.boostT -= gdt;
    let v = Math.max(0, (p.track === this.track ? p.v : 1) + (gapGoal - (t.s - ms)) * 0.6);
    if (!this.started || this.over || !t.m.possessed) v = 0;
    // không chạy quá ngã rẽ chưa hỏi xa quá (bé phải thấy quái đi đường nào)
    t.s += Math.min(v, this.def.speed * 1.6) * gdt;
    t.s = Math.min(t.s, this.track.length - 6);
    t.gap = t.s - ms;
    this.track.pose(t.s, Math.sin(this.t * 0.7) * 1.4, this.tmpPose);
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
    this.placeTarget(gdt, dt);
  }

  /** Đuổi quái: chọn đúng → tia phép trúng quái phía trước; sai → quái cười chạy xa, Nhím vào đường cụt. */
  private async huntShot(j: Junction, ok: boolean): Promise<void> {
    const t = this.target;
    if (ok && t && t.m.possessed) {
      sfx('sfx_zap', 0.5);
      await this.engine.magic.beam(this.player.pony.horn(), t.m.center(), 0xffe08a, 0xff7ac8, 0.7);
      if (!this.alive) return;
      t.hp--;
      void t.m.hurt();
      this.talk(null, bankLine('zap'));
      t.boostT = 1.2;
    } else if (!ok && t) {
      void t.m.giggle();
      this.talk('nightmare', bankLine('laugh'));
      t.boostT = 2;
    }
    this.afterAnswer(j.slot, ok, true);
    if (t && t.hp <= 0) await this.freeFriend(t);
    else this.busy = false;
  }

  private async freeFriend(t: Target): Promise<void> {
    this.busy = true;
    this.cutscene = true;
    await this.talking;
    if (!this.alive) return;
    await t.m.purify();
    if (!this.alive) return;
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
    r.s = this.mainS - 1; r.lat = r.latGoal = -1.8;
    this.helpers.push(r);
    this.friendsSaved.push(t.friendId);
    await narrate('hunt_free');
    await say(t.friendId, thanksKey(t.friendId));
    if (!this.alive) return;
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

  // ------------------------------------------------------------------ MÀN CUỐI: đấu Nữ hoàng Bóng Đêm (2 vòng mây)

  private placeNmm(gdt: number, dt: number): void {
    const n = this.nmm;
    if (!n) return;
    const p = this.player;
    this.track.pose(p.s + 14, Math.sin(this.t * 0.5) * 3.5, this.tmpPose);
    // bay cao hơn 2 vòng mây để luôn thấy Nữ hoàng
    n.place(this.tmpPose.pos, this.tmpPose.yaw + Math.PI, 0, 4.6 + Math.sin(this.t * 1.1) * 0.6);
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
    const g = this.gate;
    if (g) {
      if (!g.choice) p.s = Math.min(p.s, g.s - 5);
      if (g.choice && !g.passed && p.s > g.s + 2) {
        g.passed = true;
        const old = g;
        void tween(600, (k) => { for (const r of old.rings) r.scale.setScalar(Math.max(0.01, 1 - k)); for (const s of old.signs) s.face.scale.setScalar(Math.max(0.01, 1.5 * (1 - k))); })
          .then(() => this.disposeGate(old));
        this.gate = null;
        p.latGoal = 0;
      }
    }
    if (this.busy || this.gate || this.nmmHits >= 5) return;
    if (p.s - this.lastGateS > GATE_GAP) { this.lastGateS = p.s; void this.finalTurn(); }
  }

  private ringMat: THREE.MeshLambertMaterial | null = null;
  private makeGate(slot: Slot): Gate {
    const step = slot.q.steps[slot.si];
    const mainDir = mainDirOf(step);
    const s = this.player.s + 26;
    if (!this.ringMat) this.ringMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffd6f5, emissiveIntensity: 0.5 });
    const rings: THREE.Mesh[] = [], signs: LetterStar[] = [];
    for (const [i, side] of [[0, -1], [1, 1]] as const) {
      this.track.pose(s, side * 3.6, this.tmpPose);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.4, 8, 26), this.ringMat);
      ring.position.copy(this.tmpPose.pos).add(new THREE.Vector3(0, 1.5, 0));
      ring.rotation.y = this.tmpPose.yaw;
      this.engine.scene.add(ring);
      rings.push(ring);
      const star = this.makeSign(step, step.choices[i]);
      star.setPos(this.tmpPose.pos.x, this.tmpPose.pos.y + 1.5, this.tmpPose.pos.z);
      star.root.userData.side = side;
      star.bobAmp = 0.05;
      this.engine.scene.add(star.root);
      void star.appear(80);
      signs.push(star);
    }
    return { s, slot, signs, rings, choice: 0, mainDir, passed: false };
  }
  private disposeGate(g: Gate): void {
    for (const r of g.rings) { r.removeFromParent(); r.geometry.dispose(); }
    for (const s of g.signs) s.dispose();
  }

  private async finalTurn(): Promise<void> {
    this.busy = true;
    const n = this.nmm!;
    const slot = this.slots[this.slotI++ % this.slots.length];
    const g = this.makeGate(slot);
    this.gate = g;
    const who = slot.first ? (this.turnWho = this.turnWho === 'me' ? 'nmm' : 'me', this.turnWho) : this.turnWho;
    let orb: Orb | null = null;
    if (slot.first) {
      if (who === 'nmm') { this.talk('nightmare', bankLine('nmm_turn')); orb = this.launchOrb(n.center(), 0x8fb0ff, true); }
      else this.talk('twilight', bankLine('my_turn'));
    }
    const dir = await this.ask(slot, g.signs, g.mainDir);
    if (!this.alive || !dir) return;
    g.choice = dir;
    this.player.latGoal = dir * 3.6;
    const ok = dir === g.mainDir;
    if (who === 'nmm') {
      if (orb) this.resolveOrb(orb, ok);
      if (ok) { void this.player.pony.barrel(dir); this.talk(null, bankLine('dodge'), 300); }
      this.afterAnswer(slot, ok, ok);
    } else if (ok && slot.last) {
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
      this.afterAnswer(slot, ok, this.nmmHits < 5);
      if (this.nmmHits >= 5 && !this.over) { await this.climax(); return; }
    } else {
      if (!ok) {
        void this.engine.magic.beam(this.player.pony.horn(), n.center().add(new THREE.Vector3(3, 2, 0)), 0x9fb3d9, 0xffffff, 0.6);
        this.talk('nightmare', bankLine('laugh'));
      }
      this.afterAnswer(slot, ok, ok);
    }
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

  // ================================================================== phép bay (quái / Nữ hoàng bắn)

  private launchOrb(from: THREE.Vector3, color: number, cap: boolean): Orb {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.scale.setScalar(1.6);
    sprite.position.copy(from);
    this.engine.scene.add(sprite);
    sfx('sfx_charge', 0.4);
    const orb: Orb = { sprite, from: from.clone(), u: 0, cap: cap ? 0.55 : 1, miss: null, hitPlayer: false, color };
    this.orbs.push(orb);
    return orb;
  }

  /** Sau khi chọn: phép bay tiếp — đúng thì trượt qua bên cạnh, sai thì trúng Nhím. */
  private resolveOrb(o: Orb, dodged: boolean): void {
    o.cap = 1;
    o.hitPlayer = !dodged;
    if (dodged) o.miss = this.player.center(new THREE.Vector3()).add(this.player.pose.right.clone().multiplyScalar(-this.player.latGoal * 0.8)).add(new THREE.Vector3(0, -1.6, 0));
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

  /** Nói 1 câu không chặn, nối sau câu đang nói (không chen câu hỏi). */
  private talk(who: CastId | null, line: { key: string; text: string }, delayMs = 0): void {
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
    const d = this.def;
    if (d.mode === 'race' || d.mode === 'chase') {
      const L = this.track.length - 14, ms = this.mainS;
      const marks: ui.BarMark[] = [{ id: 'me', frac: ms / L, who: 'twilight', me: true }];
      this.racers.forEach((r, i) => marks.push({ id: `r${i}`, frac: r.s / L, who: r.pony.id }));
      if (d.mode === 'chase' && this.chasers.length) marks.push({ id: 'm', frac: Math.min(...this.chasers.map((c) => c.s)) / L, emoji: '👾' });
      ui.setBar(ms / L, marks);
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
    base.y += p.y * 0.55;
    const cfg = { race: [8.2, 3.9, 9], chase: [12, 6, 3], hunt: [8.6, 4.0, 10], final: [9, 3.0, 8] }[this.def.mode] as [number, number, number];
    let [dist, h, look] = cfg;
    // đang hỏi ở ngã rẽ: lùi + nâng camera để thấy rõ 2 biển
    if (this.pickResolve) { dist *= 1.1; h += 1.2; look += 3; }
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
    if (this.pickResolve) { const r = this.pickResolve; this.pickResolve = null; r(0); }
    this.resolveEnd('quit');
    this.engine.slow(1);
    this.engine.timeScale = 1;
    this.engine.magic.setAdditive(false);
    ui.keyHint(null);
    ui.showPanel(null);
    for (const j of this.junctions) { this.disposeSigns(j.signs); j.mon?.dispose(); }
    if (this.gate) this.disposeGate(this.gate);
    this.ringMat?.dispose();
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
