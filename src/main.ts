// Khởi động: lõi 3D, tiến độ, màn bắt đầu (lần chạm đầu mở khoá tiếng iPad), bản đồ 4 thế giới + màn cuối, điều khiển
// (giữ nút / giữ màn hình = chạy, nút cánh = bay, chạm sao = chọn), kết quả, lưu tiến độ, tham số debug, móc test.
// Debug URL (README): ?level=1-1|…|final · ?unlock=all · ?reset=1 · &auto=1 · &mute=1 · &perf=1 · &save=1
import { Engine } from './engine';
import { Level, type Outcome } from './level';
import { CAST, COSMETICS, LEVELS, levelDef, type CastId, type FamilyId } from './data';
import { loadProgress, saveProgress, isOpen } from './progress';
import { unlockAudio, preload, sfx, stopSpeech, play } from './audio';
import { photoUrl, firstPhoto, FACE } from './photos';
import { testHook } from './testhook';
import { hideSubtitle } from './talk';
import * as ui from './ui';

const Q = new URLSearchParams(location.search);
const DEBUG = { level: Q.get('level'), unlock: Q.get('unlock') === 'all', auto: Q.has('auto'), perf: Q.has('perf') };

type Phase = 'start' | 'map' | 'level' | 'result';

async function boot(): Promise<void> {
  const engine = new Engine(document.getElementById('app')!);
  const progress = loadProgress();
  if (DEBUG.unlock) progress.done = LEVELS.map((l) => l.id).filter((id) => id !== 'final');
  let phase: Phase = 'start';
  let level: Level | null = null;
  void document.fonts?.load("800 100px 'Baloo 2'");
  const me = await photoUrl(firstPhoto('nhim-1'), 1, 240, FACE);
  ui.els.mePhoto.src = me;
  ui.els.mapHero.innerHTML = `<img src="${me}" alt="Nhím" />`;

  let fpsT = 0, fpsN = 0, fps = 0;
  engine.start((dt, gdt) => {
    fpsT += dt; fpsN++;
    if (fpsT >= 1) { fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }
    level?.tick(dt, gdt);
  });
  const perf = () => ({ fps: Math.round(fps), tris: engine.renderer.info.render.triangles, calls: engine.renderer.info.render.calls,
    geometries: engine.renderer.info.memory.geometries, textures: engine.renderer.info.memory.textures });
  if (DEBUG.perf) {
    ui.els.perf.hidden = false;
    setInterval(() => { const p = perf(); ui.els.perf.textContent = `${p.fps} fps · ${(p.tris / 1000).toFixed(0)}k tam giác · ${p.calls} draw · ${p.geometries} geo · ${p.textures} tex`; }, 500);
  }

  // ---- màn bắt đầu
  ui.els.startBtn.classList.add('ready');
  let started = false;
  const begin = async () => {
    if (started) return;
    started = true;
    unlockAudio();
    ui.els.start.classList.add('hide');
    setTimeout(() => (ui.els.start.hidden = true), 500);
    await preload(['b_ok_0', 'b_no_0', 'n_1', 'n_2', 'n_3', 'go']);
    if (DEBUG.level) await startLevel(DEBUG.level);
    else openMap(true);
  };
  if (DEBUG.auto) void begin();
  else ui.els.startBtn.addEventListener('click', () => void begin(), { once: true });

  function openMap(greet = false): void {
    phase = 'map';
    level?.dispose(); level = null;
    ui.showPlay(false);
    hideSubtitle();
    ui.showMap(progress, (id) => { sfx('sfx_tap', 0.4); void startLevel(id); });
    if (greet) void play('map_pick');
  }

  async function startLevel(id: string): Promise<void> {
    const def = levelDef(id);
    ui.hideMap();
    level?.dispose();
    const lv = new Level(engine, def, progress, DEBUG.auto, DEBUG.auto && !Q.has('noanswer'));
    level = lv;
    phase = 'level';
    ui.showPlay(true);
    held = false;
    ui.keyDown('up', false);
    await lv.setup();
    if (lv !== level) return;
    const outcome = await lv.run();
    if (lv !== level || outcome === 'quit') return;
    await finish(lv, outcome);
  }

  async function finish(lv: Level, outcome: Outcome): Promise<void> {
    phase = 'result';
    const res = lv.result(outcome);
    const def = lv.def;
    const before = new Set(COSMETICS.filter((c) => progress.gems >= c.gems).map((c) => c.id));
    progress.gems += res.gems;
    const firstWin = outcome === 'win' && !progress.done.includes(def.id);
    if (outcome === 'win' && !progress.done.includes(def.id)) progress.done.push(def.id);
    for (const f of res.friends) if (!progress.friends.includes(f)) progress.friends.push(f);
    saveProgress(progress);
    ui.showPlay(false);
    // đồ trang trí mới mở
    for (const c of COSMETICS) {
      if (!before.has(c.id) && progress.gems >= c.gems) { ui.toast(`${c.emoji} ${c.name}!`); await play(`unlock_${c.id}`); }
    }
    let photo: string | null = null;
    const worldDone = outcome === 'win' && def.n === 2 && def.world <= 4;
    if (worldDone) {
      photo = await photoUrl(firstPhoto(`world-${def.world}`, 'nhim-1'), 3 / 4, 700);
      void play(`wcard_${def.world}`);
    } else if (outcome === 'win' && def.id === 'final') {
      photo = await photoUrl(firstPhoto('final', 'nhim-1'), 3 / 4, 700);
    }
    const idx = LEVELS.findIndex((l) => l.id === def.id);
    const nextDef = LEVELS.slice(idx + 1).find((l) => isOpen(progress, l.id) && !progress.done.includes(l.id)) ?? LEVELS[idx + 1];
    const canNext = !!nextDef && isOpen(progress, nextDef.id);
    let faces: CastId[] = ['twilight'];
    let title = '';
    let place: string | undefined;
    if (outcome === 'lose') {
      title = 'Suýt nữa thôi!';
      faces = [(lv.loseFace ?? 'me-yen') as FamilyId, 'twilight'];
    } else if (def.mode === 'race') {
      title = res.place === 1 ? 'Nhím về nhất!' : 'Về đích rồi!';
      faces = ['twilight', ...res.racers];
      place = res.place === 1 ? '🥇 Nhất' : `${res.place === 2 ? '🥈 Nhì' : '🥉 Ba'} · ${CAST[res.winner as CastId]?.name ?? ''} về nhất`;
    } else if (def.mode === 'chase') {
      title = 'Thoát rồi!';
    } else if (def.mode === 'hunt') {
      title = 'Cứu được bạn rồi!';
      faces = ['twilight', ...res.friends];
    } else {
      title = 'Nhím đã thắng!';
      faces = ['twilight', 'bac-hanh', 'ba-cuong', 'me-yen', 'ong-cuong', 'ba-tuyet'];
    }
    if (firstWin && def.id === 'final') ui.toast('🌙 Bác Hanh đua cùng Nhím!');
    const pick = await ui.showResult({ win: outcome === 'win', title, faces, place, gems: res.gems, photo, canNext });
    stopSpeech();
    if (pick === 'retry') return startLevel(def.id);
    if (pick === 'next' && nextDef) return startLevel(nextDef.id);
    openMap();
  }

  ui.els.home.addEventListener('click', (e) => {
    e.stopPropagation();
    if (phase !== 'level') return;
    sfx('sfx_tap', 0.4);
    stopSpeech();
    openMap();
  });
  ui.els.repeat.addEventListener('click', (e) => { e.stopPropagation(); level?.repeat(); });

  // ---- BÀN PHÍM (chơi chỉ bằng phím cho bé tập trung): giữ ↑ chạy, nháy ↑ 2 lần bay, ← → chọn đường, R nghe lại.
  // Menu: Space / Enter = bắt đầu · chơi tiếp · thử lại; Esc = về bản đồ.
  let held = false;
  const setHeld = (on: boolean) => {
    if (held === on) return;
    held = on;
    ui.keyDown('up', on);
    level?.setHold(on);
  };
  let lastUp = 0;
  const visible = (el: HTMLElement) => !el.hidden;
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown', ' '].includes(k)) e.preventDefault();
    if (e.repeat) return;
    unlockAudio();
    if (k === ' ' || k === 'Enter') {
      if (!started) { void begin(); return; }
      if (visible(ui.els.result)) { (visible(ui.els.resNext) ? ui.els.resNext : visible(ui.els.resRetry) ? ui.els.resRetry : ui.els.resMap).click(); return; }
      if (phase === 'map') { (document.querySelector<HTMLElement>('.lv-btn.next') ?? (ui.els.mapFinal.classList.contains('next') ? ui.els.mapFinal : null))?.click(); return; }
    }
    if (k === 'Escape') {
      if (visible(ui.els.result)) { ui.els.resMap.click(); return; }
      if (phase === 'level') { stopSpeech(); openMap(); }
      return;
    }
    if (phase !== 'level' || !level) return;
    if (k === 'ArrowUp') {
      const now = performance.now();
      if (now - lastUp < 380) level.pressFly();
      lastUp = now;
      setHeld(true);
    } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      const side = k === 'ArrowLeft' ? 'left' : 'right';
      ui.keyDown(side, true);
      setTimeout(() => ui.keyDown(side, false), 160);
      if (level.steer(k === 'ArrowLeft' ? -1 : 1)) sfx('sfx_tap', 0.4);
    } else if (k === 'r' || k === 'R') level.repeat();
  });
  window.addEventListener('keyup', (e) => { if (e.key === 'ArrowUp') setHeld(false); });
  window.addEventListener('blur', () => setHeld(false));
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- móc test / chụp màn hình
  (window as unknown as { __game: unknown }).__game = {
    engine, progress,
    get phase() { return phase; },
    get level() { return level; },
    get waiting() { return testHook.waiting; },
    answer(ok: boolean) { const f = testHook.answer; f?.(ok); return !!f; },
    hold(on: boolean) { setHeld(on); },
    fly() { level?.pressFly(); },
    perf,
    startLevel, openMap,
  };
}

void boot();
