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
  const begin = async () => {
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
    ui.els.run.classList.remove('down');
    held = false;
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

  // ---- giữ để chạy: nút 🏇, giữ màn hình (chỗ không phải sao), phím Space / ↑
  let held = false;
  const setHeld = (on: boolean) => {
    if (held === on) return;
    held = on;
    ui.els.run.classList.toggle('down', on);
    level?.setHold(on);
  };
  const canvas = engine.renderer.domElement;
  const pointers = new Set<number>();
  const press = (id: number) => { pointers.add(id); setHeld(true); };
  const release = (id: number) => { pointers.delete(id); if (!pointers.size) setHeld(false); };
  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    if (phase !== 'level' || !level) return;
    if (level.tap(e.clientX, e.clientY)) return;
    press(e.pointerId);
  });
  ui.els.run.addEventListener('pointerdown', (e) => { e.preventDefault(); unlockAudio(); press(e.pointerId); ui.els.run.setPointerCapture(e.pointerId); });
  for (const t of [canvas, ui.els.run]) {
    t.addEventListener('pointerup', (e) => release(e.pointerId));
    t.addEventListener('pointercancel', (e) => release(e.pointerId));
  }
  ui.els.run.addEventListener('lostpointercapture', (e) => release(e.pointerId));
  ui.els.fly.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); level?.pressFly(); });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'ArrowUp') { press(-1); e.preventDefault(); }
    if (e.key === 'f' || e.key === 'F' || e.key === 'ArrowDown') level?.pressFly();
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'ArrowUp') release(-1); });
  window.addEventListener('blur', () => { pointers.clear(); setHeld(false); });
  // iPad: chạm giữ lâu không bật menu / kính lúp
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
