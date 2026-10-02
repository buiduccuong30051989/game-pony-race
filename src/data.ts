// Dữ liệu game 6: dàn nhân vật (cả nhà Nhím hoá pony), 4 thế giới × 2 bài + màn cuối trên trời.
// Tên tiếng Anh CHỈ hiện chữ (vai), giọng đọc gọi tên nhà; tên riêng tiếng Anh trong câu thoại viết {Tên} (đọc giọng Anh).

export type FamilyId = 'ba-cuong' | 'me-yen' | 'ong-cuong' | 'ba-tuyet' | 'bac-hanh';
export type FriendId = 'pinkie' | 'fluttershy' | 'cadance' | 'rainbowswirl';
export type CastId = 'twilight' | FamilyId | FriendId | 'nightmare';

/** pony = auto-rig 4 chân (không xương), flyer = công chúa có xương sẵn (bay lơ lửng). */
export type PonyKind = 'pony' | 'flyer';

export interface CastDef {
  id: CastId;
  /** tên gọi trong nhà (hiện to) */
  name: string;
  /** vai tiếng Anh (chỉ hiện chữ nhỏ) */
  role: string;
  kind: PonyKind;
  model: string;
  height: number;
  emoji: string;
  color: string;
  /** chân dung trong public/img/portraits */
  portrait: string;
}

export const CAST: Record<CastId, CastDef> = {
  twilight: { id: 'twilight', name: 'Nhím', role: 'Twilight Sparkle', kind: 'pony', model: 'models/twilight_static/scene.gltf', height: 1.75, emoji: '🦄', color: '#a06cd5', portrait: 'twilight' },
  'ba-cuong': { id: 'ba-cuong', name: 'Ba Cường', role: 'Rainbow Dash', kind: 'pony', model: 'models/ponies/rainbow.glb', height: 1.7, emoji: '⚡', color: '#2f9df5', portrait: 'rainbow' },
  'me-yen': { id: 'me-yen', name: 'Mẹ Yến', role: 'Rarity', kind: 'pony', model: 'models/ponies/rarity.glb', height: 1.7, emoji: '💎', color: '#9b5de5', portrait: 'rarity' },
  'ong-cuong': { id: 'ong-cuong', name: 'Ông Cương', role: 'Applejack', kind: 'pony', model: 'models/ponies/applejack.glb', height: 1.75, emoji: '🍎', color: '#e8892b', portrait: 'applejack' },
  'ba-tuyet': { id: 'ba-tuyet', name: 'Bà Tuyết', role: 'Celestia', kind: 'flyer', model: 'models/ponies/celestia.glb', height: 2.05, emoji: '☀️', color: '#f2a900', portrait: 'celestia' },
  'bac-hanh': { id: 'bac-hanh', name: 'Bác Hanh', role: 'Luna', kind: 'flyer', model: 'models/ponies/luna.glb', height: 1.95, emoji: '🌙', color: '#3b5bdb', portrait: 'luna' },
  pinkie: { id: 'pinkie', name: 'Pinkie Pie', role: 'bạn ngựa nhỏ', kind: 'pony', model: 'models/friends/pinkie.glb', height: 1.35, emoji: '🎈', color: '#ff5fb4', portrait: 'pinkie' },
  fluttershy: { id: 'fluttershy', name: 'Fluttershy', role: 'bạn ngựa nhỏ', kind: 'pony', model: 'models/friends/fluttershy.glb', height: 1.35, emoji: '🦋', color: '#e6b800', portrait: 'fluttershy' },
  cadance: { id: 'cadance', name: 'Cadance', role: 'bạn ngựa nhỏ', kind: 'pony', model: 'models/friends/cadance.glb', height: 1.55, emoji: '💖', color: '#ff8fc8', portrait: 'cadance' },
  rainbowswirl: { id: 'rainbowswirl', name: 'Cầu Vồng', role: 'bạn ngựa nhỏ', kind: 'pony', model: 'models/friends/rainbowswirl.glb', height: 1.3, emoji: '🌈', color: '#4fb3ff', portrait: 'rainbowswirl' },
  nightmare: { id: 'nightmare', name: 'Nữ hoàng Bóng Đêm', role: 'Nightmare Moon', kind: 'flyer', model: 'models/ponies/nightmare.glb', height: 2.6, emoji: '🌑', color: '#4b3b9a', portrait: 'nightmare' },
};

/** Người đua cùng (random 2 người mỗi lần). Bác Hanh chỉ vào sau khi thắng màn cuối. */
export const RACERS_BASE: FamilyId[] = ['ba-cuong', 'me-yen', 'ong-cuong', 'ba-tuyet'];

// ------------------------------------------------------------------ quái

export type MonsterKind = 'slime_jt' | 'ghost' | 'goblin' | 'dragon' | 'dragon_ev' | 'wizard' | 'witch';

// ------------------------------------------------------------------ câu hỏi

/** Loại câu hỏi: nhận mặt chữ, cộng, trừ, điền số (a + ? = c), ghép tiếng. */
export type QKind = 'letter' | 'add' | 'sub' | 'miss' | 'word';

export interface QuizDef {
  /** các loại câu, xoay vòng xen kẽ (không quá 2 câu cùng loại liền nhau) */
  kinds: QKind[];
  /** phép tính trong phạm vi (5 hoặc 10) */
  maxN: 5 | 10;
  /** chữ được hỏi */
  letters: string[];
  /** chữ nhiễu ưu tiên cặp dễ lẫn (b–d, o–ô–ơ…) */
  confusable: boolean;
  /** tiếng để ghép (phải có trong bảng vàng scripts/check-spelling.mjs) */
  words: string[];
}

// ------------------------------------------------------------------ thế giới + bài

export type Mode = 'race' | 'chase' | 'hunt' | 'final';
export type SceneKind = 'forest' | 'village' | 'hills' | 'castle' | 'sky';

export interface Theme {
  scene: SceneKind;
  sky: [top: number, bottom: number];
  ground: number;
  road: [base: number, edge: number];
  fog: [near: number, far: number];
  /** đồ trang trí 2 bên đường: [file trong models/props, trọng số, tỉ lệ min, tỉ lệ max] */
  props: [string, number, number, number][];
  /** chướng ngại vật phải bay qua: file prop hoặc 'crystal' / 'hedge' dựng bằng code */
  obstacles: string[];
  /** hình quả trên bảng phép tính */
  fruit: string;
}

export interface LevelDef {
  id: string;
  world: number;
  /** 1 = dễ, 2 = khó hơn */
  n: 1 | 2;
  mode: Mode;
  title: string;
  /** dòng phụ trên thẻ bản đồ */
  sub: string;
  /** chiều dài đường (m), bài vòng kín (hunt, final) là chu vi */
  length: number;
  seed: number;
  speed: number;
  /** số câu (race: số ngã rẽ; chase: số lần quái bắn) */
  questions: number;
  /** số chướng ngại vật */
  obstacles: number;
  /** cầu vồng: số cây cầu vồng trên đường */
  bridges: number;
  monsters: MonsterKind[];
  /** bạn được cứu (hunt): mỗi quái giữ 1 bạn */
  friends?: FriendId[];
  quiz: QuizDef;
  theme: Theme;
}

const VOWELS = ['a', 'ă', 'â', 'e', 'ê', 'i', 'o', 'ô', 'ơ', 'u', 'ư', 'y'];
const CONS_1 = ['b', 'c', 'd', 'đ', 'h', 'l', 'm', 'n'];
const CONS_2 = ['g', 'k', 'p', 'q', 'r', 's', 't', 'v', 'x'];
const ALL = [...VOWELS, ...CONS_1, ...CONS_2];

const FOREST: Theme = {
  scene: 'forest', sky: [0x8fd3ff, 0xfff1df], ground: 0x9fdc78, road: [0xe9c48f, 0xc99a63], fog: [70, 175],
  props: [
    ['tree_oak.glb', 5, 2.4, 3.4], ['tree_default.glb', 4, 2.4, 3.2], ['tree_detailed.glb', 3, 2.2, 3.0], ['tree_fat.glb', 3, 2.2, 3.0],
    ['tree_pineRoundA.glb', 3, 2.4, 3.4], ['mushroom_redGroup.glb', 3, 1.6, 2.4], ['mushroom_red.glb', 2, 1.8, 2.6],
    ['plant_bushLarge.glb', 3, 1.8, 2.6], ['flower_purpleA.glb', 3, 1.8, 2.6], ['flower_yellowA.glb', 3, 1.8, 2.6],
    ['grass_large.glb', 4, 1.8, 2.6], ['rock_largeA.glb', 1, 1.2, 1.8], ['stump_round.glb', 1, 1.6, 2.2],
  ],
  obstacles: ['log_large.glb', 'rock_largeB.glb', 'stump_old.glb'], fruit: '🍄',
};
const VILLAGE: Theme = {
  scene: 'village', sky: [0x86cfff, 0xffeedd], ground: 0xb2e68a, road: [0xf0d3a2, 0xd3a86e], fog: [70, 175],
  props: [
    ['house', 3, 1, 1], ['tree_oak.glb', 3, 2.4, 3.2], ['tree_simple.glb', 3, 2.4, 3.2], ['crop_pumpkin.glb', 3, 1.8, 2.6],
    ['crops_cornStageC.glb', 2, 2.0, 2.6], ['crops_wheatStageB.glb', 3, 2.0, 2.6], ['fence_simple.glb', 3, 2.2, 2.2],
    ['flower_redA.glb', 3, 1.8, 2.6], ['flower_yellowB.glb', 3, 1.8, 2.6], ['plant_bushSmall.glb', 3, 1.8, 2.6],
    ['apple_tree', 3, 1, 1],
  ],
  obstacles: ['fence_planks.glb', 'hay', 'crop_pumpkin.glb'], fruit: '🍎',
};
const HILLS: Theme = {
  scene: 'hills', sky: [0xa58cff, 0xffd9ec], ground: 0xbfe8a8, road: [0xfff0f7, 0xffb3d9], fog: [70, 180],
  props: [
    ['crystal', 5, 1, 1], ['tree_oak.glb', 2, 2.4, 3.2], ['tree_cone.glb', 3, 2.4, 3.2], ['mushroom_tanGroup.glb', 3, 1.8, 2.6],
    ['flower_purpleB.glb', 4, 1.8, 2.6], ['flower_yellowA.glb', 3, 1.8, 2.6], ['rock_tallA.glb', 2, 1.4, 2.0], ['cloudlet', 3, 1, 1],
  ],
  obstacles: ['crystal_wall', 'rock_tallC.glb', 'mushroom_redTall.glb'], fruit: '💎',
};
const CASTLE: Theme = {
  scene: 'castle', sky: [0x7cc4ff, 0xfff6e0], ground: 0xc4ecaa, road: [0xf4f1ff, 0xd6cdee], fog: [75, 185],
  props: [
    ['tower', 3, 1, 1], ['tree_cone.glb', 4, 2.4, 3.4], ['plant_bushLargeTriangle.glb', 4, 2.0, 2.8], ['statue_column.glb', 2, 1.8, 2.4],
    ['statue_obelisk.glb', 1, 1.8, 2.4], ['flower_redA.glb', 3, 1.8, 2.6], ['flower_purpleA.glb', 3, 1.8, 2.6], ['statue_ring.glb', 1, 1.8, 2.4],
  ],
  obstacles: ['hedge', 'statue_block.glb', 'fence_simple.glb'], fruit: '⭐',
};
const SKY: Theme = {
  scene: 'sky', sky: [0x5a4bc8, 0xffc6e6], ground: 0xffffff, road: [0xffffff, 0xffffff], fog: [90, 220],
  props: [], obstacles: [], fruit: '🌟',
};

export const WORLDS: { n: number; title: string; sub: string; emoji: string; color: string }[] = [
  { n: 1, title: 'Rừng Everfree', sub: 'Rừng nấm', emoji: '🌳', color: '#7fcc62' },
  { n: 2, title: 'Ponyville', sub: 'Làng ngựa nhỏ', emoji: '🏡', color: '#ff9a5a' },
  { n: 3, title: 'Đồi cầu vồng', sub: 'Pha lê và cầu vồng', emoji: '🌈', color: '#b084ff' },
  { n: 4, title: 'Canterlot', sub: 'Thành phố lâu đài', emoji: '🏰', color: '#ffc94a' },
];

export const LEVELS: LevelDef[] = [
  {
    id: '1-1', world: 1, n: 1, mode: 'race', title: 'Đua trong rừng', sub: 'Đua cùng cả nhà', length: 620, seed: 11, speed: 9,
    questions: 5, obstacles: 6, bridges: 1, monsters: [],
    quiz: { kinds: ['letter', 'add'], maxN: 5, letters: VOWELS, confusable: false, words: [] }, theme: FOREST,
  },
  {
    id: '1-2', world: 1, n: 2, mode: 'chase', title: 'Quái đuổi trong rừng', sub: 'Slime và ma đuổi theo', length: 640, seed: 12, speed: 10.5,
    questions: 7, obstacles: 8, bridges: 1, monsters: ['slime_jt', 'ghost'],
    quiz: { kinds: ['letter', 'add', 'letter', 'sub'], maxN: 5, letters: VOWELS, confusable: true, words: [] }, theme: FOREST,
  },
  {
    id: '2-1', world: 2, n: 1, mode: 'race', title: 'Đua qua làng', sub: 'Đua cùng cả nhà', length: 630, seed: 21, speed: 9,
    questions: 5, obstacles: 6, bridges: 1, monsters: [],
    quiz: { kinds: ['letter', 'add', 'sub'], maxN: 5, letters: CONS_1, confusable: false, words: [] }, theme: VILLAGE,
  },
  {
    id: '2-2', world: 2, n: 2, mode: 'hunt', title: 'Đuổi yêu tinh', sub: 'Cứu {Pinkie Pie} và {Fluttershy}', length: 520, seed: 22, speed: 10.5,
    questions: 7, obstacles: 7, bridges: 1, monsters: ['goblin', 'dragon'], friends: ['pinkie', 'fluttershy'],
    quiz: { kinds: ['letter', 'add', 'word', 'sub', 'miss'], maxN: 10, letters: CONS_1, confusable: true, words: ['ba', 'mẹ', 'bà', 'ma', 'la'] }, theme: VILLAGE,
  },
  {
    id: '3-1', world: 3, n: 1, mode: 'race', title: 'Đua trên cầu vồng', sub: 'Đua cùng cả nhà', length: 670, seed: 31, speed: 9,
    questions: 5, obstacles: 6, bridges: 2, monsters: [],
    quiz: { kinds: ['add', 'letter', 'sub', 'miss'], maxN: 10, letters: CONS_2, confusable: false, words: [] }, theme: HILLS,
  },
  {
    id: '3-2', world: 3, n: 2, mode: 'chase', title: 'Rồng nhỏ đuổi', sub: 'Rồng nhỏ và ma đuổi theo', length: 660, seed: 32, speed: 10.5,
    questions: 7, obstacles: 8, bridges: 2, monsters: ['dragon_ev', 'ghost'],
    quiz: { kinds: ['add', 'miss', 'letter', 'sub', 'word'], maxN: 10, letters: CONS_2, confusable: true, words: ['cá', 'bò', 'gà', 'dê', 'tô'] }, theme: HILLS,
  },
  {
    id: '4-1', world: 4, n: 1, mode: 'race', title: 'Đua vào lâu đài', sub: 'Đua cùng cả nhà', length: 630, seed: 41, speed: 9,
    questions: 5, obstacles: 6, bridges: 1, monsters: [],
    quiz: { kinds: ['letter', 'miss', 'add', 'sub'], maxN: 10, letters: ALL, confusable: false, words: [] }, theme: CASTLE,
  },
  {
    id: '4-2', world: 4, n: 2, mode: 'hunt', title: 'Đuổi phù thuỷ', sub: 'Cứu {Cadance} và Cầu Vồng', length: 540, seed: 42, speed: 10.5,
    questions: 7, obstacles: 7, bridges: 1, monsters: ['wizard', 'witch'], friends: ['cadance', 'rainbowswirl'],
    quiz: { kinds: ['word', 'sub', 'letter', 'miss', 'add'], maxN: 10, letters: ALL, confusable: true, words: ['bà', 'mẹ', 'cá', 'vẽ', 'xe', 'nơ', 'lá'] }, theme: CASTLE,
  },
  {
    id: 'final', world: 5, n: 2, mode: 'final', title: 'Đấu Nữ hoàng Bóng Đêm', sub: 'Trên đường đua bầu trời', length: 760, seed: 51, speed: 10,
    questions: 10, obstacles: 0, bridges: 0, monsters: [],
    quiz: { kinds: ['letter', 'add', 'sub', 'word', 'miss'], maxN: 10, letters: ALL, confusable: true, words: ['ba', 'mẹ', 'bà'] }, theme: SKY,
  },
];

export function levelDef(id: string): LevelDef {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`không có bài ${id}`);
  return l;
}

/** Số tim mỗi bài: sai 3 lần là thua. */
export const HEARTS = 3;

/** Đồ trang trí cho Twilight, mở theo tổng ngọc. */
export const COSMETICS: { id: 'crown' | 'trail' | 'aura'; gems: number; emoji: string; name: string }[] = [
  { id: 'crown', gems: 60, emoji: '🌸', name: 'Vòng hoa' },
  { id: 'trail', gems: 150, emoji: '🌈', name: 'Vệt cầu vồng' },
  { id: 'aura', gems: 300, emoji: '✨', name: 'Hào quang sao' },
];
