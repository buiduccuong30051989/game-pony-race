// MỌI câu thoại của game (trừ tên chữ / câu hỏi chữ: src/letters.ts; phép tính: src/numbers.ts; đánh vần: src/spell.ts).
// File THUẦN: scripts/audio-lines.mjs đọc file này để sinh audio (edge-tts). Đổi chữ → `pnpm audio` (tự sinh lại câu đổi).
//
// Tên riêng tiếng Anh viết trong ngoặc nhọn và đọc bằng giọng tiếng Anh: "Cứu bạn {Pinkie Pie} nào!". Còn lại gọi tên nhà
// (Nhím, ba Cường, mẹ Yến, ông Cương, bà Tuyết, bác Hanh). scripts/audio-lines.mjs báo lỗi nếu phần tiếng Việt lọt tên Anh.
import type { FamilyId, FriendId } from './data';

export type Voice = 'my' | 'nar' | 'twi' | 'nmm' | 'ba' | 'me' | 'ong' | 'batuyet' | 'bachanh' | 'friend';

export interface VoiceDef { voice: string; rate: string; pitch: string; /** giọng tiếng Anh đọc {Tên riêng} */ en: string; enPitch: string }
const EN_F = 'en-US-JennyNeural';
const EN_KID = 'en-US-AnaNeural';
const EN_M = 'en-US-GuyNeural';
export const VOICES: Record<Voice, VoiceDef> = {
  my: { voice: 'vi-VN-HoaiMyNeural', rate: '-10%', pitch: '+0Hz', en: EN_F, enPitch: '+0Hz' },
  nar: { voice: 'vi-VN-HoaiMyNeural', rate: '-16%', pitch: '-2Hz', en: EN_F, enPitch: '-2Hz' },
  twi: { voice: 'vi-VN-HoaiMyNeural', rate: '-8%', pitch: '+14Hz', en: EN_KID, enPitch: '+0Hz' },
  nmm: { voice: 'vi-VN-HoaiMyNeural', rate: '-14%', pitch: '-18Hz', en: EN_F, enPitch: '-18Hz' },
  ba: { voice: 'vi-VN-NamMinhNeural', rate: '-6%', pitch: '+0Hz', en: EN_M, enPitch: '+0Hz' },
  me: { voice: 'vi-VN-HoaiMyNeural', rate: '-10%', pitch: '+3Hz', en: EN_F, enPitch: '+3Hz' },
  ong: { voice: 'vi-VN-NamMinhNeural', rate: '-16%', pitch: '-10Hz', en: EN_M, enPitch: '-10Hz' },
  batuyet: { voice: 'vi-VN-HoaiMyNeural', rate: '-16%', pitch: '-7Hz', en: EN_F, enPitch: '-7Hz' },
  bachanh: { voice: 'vi-VN-HoaiMyNeural', rate: '-12%', pitch: '-4Hz', en: EN_F, enPitch: '-4Hz' },
  friend: { voice: 'vi-VN-HoaiMyNeural', rate: '-4%', pitch: '+9Hz', en: EN_KID, enPitch: '+0Hz' },
};

export const FAMILY_VOICE: Record<FamilyId, Voice> = { 'ba-cuong': 'ba', 'me-yen': 'me', 'ong-cuong': 'ong', 'ba-tuyet': 'batuyet', 'bac-hanh': 'bachanh' };

/** Tên tiếng Anh có thể được ĐỌC (phần tiếng Việt không được chứa — scripts/audio-lines.mjs soát). */
export const EN_NAMES = [
  'Twilight Sparkle', 'Twilight', 'Rainbow Dash', 'Rarity', 'Applejack', 'Celestia', 'Luna', 'Nightmare Moon',
  'Fluttershy', 'Pinkie Pie', 'Cadance', 'Everfree', 'Ponyville', 'Canterlot', 'pony',
];

/** key → [giọng, câu]. Khoá chỉ dùng a-z 0-9 _ (tên file). */
export const LINES: Record<string, [Voice, string]> = {
  go: ['my', 'Chạy nào!'],
  map_pick: ['my', 'Nhím muốn chơi ở đâu nào?'],
  rotate: ['my', 'Nhím ơi, xoay ngang máy nhé!'],

  // ---- mở đầu từng bài
  lv_1_1: ['nar', 'Rừng nấm. Hôm nay Nhím đua cùng cả nhà! Giữ nút để chạy, gặp chướng ngại thì bay lên nhé.'],
  lv_1_2: ['nar', 'Ối! Quái bóng tối trong rừng đuổi theo Nhím! Chạy mau tới cổng an toàn nào!'],
  lv_2_1: ['nar', 'Làng ngựa nhỏ {Ponyville}. Cả nhà đua qua làng nào!'],
  lv_2_2: ['nar', 'Yêu tinh và rồng nhỏ bắt bạn {Pinkie Pie} với bạn {Fluttershy} trong bong bóng! Đuổi theo cứu bạn nào!'],
  lv_3_1: ['nar', 'Đồi cầu vồng. Hôm nay cả nhà đua trên cầu vồng!'],
  lv_3_2: ['nar', 'Rồng nhỏ và ma bóng tối đuổi theo Nhím! Chạy qua đồi cầu vồng nào!'],
  lv_4_1: ['nar', 'Thành phố lâu đài {Canterlot}. Cả nhà đua tới lâu đài nào!'],
  lv_4_2: ['nar', 'Phù thuỷ bắt bạn {Cadance} và bạn Cầu Vồng! Đuổi theo cứu bạn nào!'],
  lv_final: ['nar', 'Bầu trời đêm. Nữ hoàng Bóng Đêm đang chờ Nhím ở trên cao!'],
  final_2: ['nmm', 'Ha ha ha! Đấu với ta trên trời nào, cô bé!'],
  final_3: ['my', 'Trả lời đúng để né phép, và bắn phép vào Nữ hoàng nhé!'],

  // ---- bị đuổi / đuổi quái
  wave: ['my', 'Ôi, nhiều quái quá! Trả lời đúng hai câu để bật khiên phép thuật!'],
  shield: ['my', 'Khiên phép thuật! Quái văng ra xa rồi!'],
  safe: ['my', 'Tới cổng an toàn rồi! Nhím làm phép tẩy bóng tối nào!'],
  hunt_free: ['my', 'Bong bóng vỡ rồi! Bạn được tự do rồi!'],
  hunt_next: ['my', 'Còn một bạn nữa! Đuổi tiếp nào!'],
  hunt_done: ['my', 'Cứu được cả hai bạn rồi! Nhím giỏi quá!'],

  // ---- màn cuối
  cl_1: ['twi', 'Bằng phép màu của tình bạn và gia đình!'],
  cl_2: ['nar', 'Nữ hoàng Bóng Đêm biến mất… và bác Hanh trở lại thành công chúa {Luna}!'],
  cl_3: ['bachanh', 'Bác được cứu rồi! Cảm ơn Nhím! Từ nay bác sẽ đua cùng Nhím nhé!'],
  cl_4: ['nar', 'Trời sáng rồi! Nhím đã thắng Nữ hoàng Bóng Đêm!'],

  // ---- thua (hết tim)
  lose: ['my', 'Hết tim rồi. Suýt nữa thôi!'],

  // ---- thắng
  win_chase: ['my', 'Nhím chạy giỏi quá! Thoát được quái rồi!'],
  win_race: ['my', 'Về đích rồi!'],

  // ---- đồ trang trí mở theo ngọc
  unlock_crown: ['my', 'Nhím có vòng hoa mới rồi!'],
  unlock_trail: ['my', 'Nhím có vệt cầu vồng mới rồi!'],
  unlock_aura: ['my', 'Nhím có hào quang sao lấp lánh rồi!'],

  // ---- thẻ ảnh khi xong 1 thế giới
  wcard_1: ['nar', 'Nhím đã chạy qua khu rừng nấm!'],
  wcard_2: ['nar', 'Nhím đã chạy qua làng ngựa nhỏ!'],
  wcard_3: ['nar', 'Nhím đã chạy qua đồi cầu vồng!'],
  wcard_4: ['nar', 'Nhím đã tới thành phố lâu đài!'],
};

/** Câu riêng của từng người nhà khi đua: chào, vượt lên, chờ Nhím, Nhím thắng, mình về trước, động viên khi thua. */
export const FAMILY_LINES: Record<FamilyId, Record<'hi' | 'ahead' | 'wait' | 'win' | 'first' | 'lose', string>> = {
  'ba-cuong': {
    hi: 'Nhím ơi, đua với ba nào! Ba nhanh như tia chớp đó!', ahead: 'Ba vượt lên nè!', wait: 'Nhím ơi, chạy tiếp đi con!',
    win: 'Nhím về nhất rồi! Con gái ba giỏi quá!', first: 'Ba về trước rồi! Lần sau Nhím thắng ba nhé!', lose: 'Không sao con ơi, mình thử lại nhé! Ba tin con!',
  },
  'me-yen': {
    hi: 'Nhím đua với mẹ nhé! Cố lên con yêu!', ahead: 'Mẹ ở đằng trước nè Nhím!', wait: 'Mẹ chờ Nhím nè!',
    win: 'Nhím về nhất! Mẹ thương Nhím nhất!', first: 'Mẹ về trước rồi! Lần sau Nhím thắng mẹ nha!', lose: 'Suýt nữa thôi con! Mình chơi lại nhé!',
  },
  'ong-cuong': {
    hi: 'Ông cũng đua với cháu nhé! Ông chạy khoẻ lắm!', ahead: 'Ông vượt lên rồi nhé!', wait: 'Cháu ông chạy tiếp nào!',
    win: 'Cháu ông về nhất! Giỏi quá!', first: 'Ông về trước rồi! Lần sau cháu thắng ông nhé!', lose: 'Không sao cháu ơi, thử lại nào!',
  },
  'ba-tuyet': {
    hi: 'Bà đua cùng Nhím đây! Bà bay nhẹ như mây!', ahead: 'Bà bay lên trước rồi nè!', wait: 'Bà chờ Nhím nhé!',
    win: 'Nhím về nhất! Bà vui quá!', first: 'Bà về trước rồi! Lần sau Nhím thắng bà nhé!', lose: 'Suýt nữa thôi cháu yêu! Mình thử lại nhé!',
  },
  'bac-hanh': {
    hi: 'Bác Hanh đua với Nhím nhé!', ahead: 'Bác vượt lên rồi nè!', wait: 'Nhím ơi, bác chờ nè!',
    win: 'Nhím về nhất! Bác tự hào lắm!', first: 'Bác về trước rồi! Lần sau Nhím thắng bác nhé!', lose: 'Không sao Nhím ơi, mình chơi lại nào!',
  },
};
export const familyKey = (id: FamilyId, k: string) => `f_${id.replace('-', '')}_${k}`;

/** Ngân hàng câu: chọn ngẫu nhiên, không lặp lại 3 câu gần nhất (src/voice.ts). */
export const BANK_TEXT: Record<string, [Voice, string[]]> = {
  ok: ['my', [
    'Đúng rồi!', 'Giỏi quá!', 'Hay lắm Nhím ơi!', 'Tuyệt vời!', 'Chính xác!', 'Nhím giỏi ghê!', 'Hoan hô Nhím!', 'Xuất sắc!',
    'Đúng rồi, giỏi lắm!', 'Nhím nhanh quá!',
  ]],
  no: ['my', [
    'Ồ, chưa đúng rồi. Nghe nè:', 'Hì, chưa phải rồi. Nghe nè:', 'Chưa đúng rồi, Nhím nhớ nhé:', 'Ừm, không phải rồi. Đáp án là:',
    'Gần đúng rồi! Nghe nè:', 'Không sao, mình học nhé:',
  ]],
  hold: ['my', [
    'Giữ nút để chạy nào!', 'Nhím ơi, giữ nút ngựa để chạy nhé!', 'Chạy tiếp thôi Nhím!', 'Giữ ngón tay trên nút là chạy đó!',
    'Mình chạy tiếp nhé!', 'Đường đua đang chờ Nhím đó!', 'Nhấn giữ nút để phi nhanh nào!', 'Cố lên Nhím, chạy nào!',
  ]],
  fly: ['my', [
    'Bay lên nào!', 'Chạm đôi cánh để bay qua!', 'Có chướng ngại kìa! Bay lên!', 'Vỗ cánh bay qua nhé!', 'Bay qua đi Nhím!',
    'Chạm nút cánh nào!', 'Ối, cái gì chắn đường kìa! Bay lên!', 'Nhím ơi, bay lên!',
  ]],
  flyok: ['my', [
    'Vèo! Bay qua rồi!', 'Giỏi quá, bay cao ghê!', 'Bay đẹp quá!', 'Qua rồi!', 'Nhím bay như chim!', 'Hay lắm!',
  ]],
  oops: ['my', [
    'Ối, vấp rồi! Không sao, chạy tiếp nào!', 'Úi! Đứng dậy chạy tiếp nhé!', 'Lộn một vòng rồi! Chạy tiếp thôi!',
    'Không sao, lần sau bay lên nhé!', 'Ui da! Mình chạy tiếp nào!',
  ]],
  fork: ['my', [
    'Chạm vào biển đường đúng nhé!', 'Đường nào đây ta?', 'Chọn một biển nhé Nhím!', 'Ngã rẽ kìa! Chạm biển đúng nào!',
    'Đường tắt cầu vồng ở bên nào nhỉ?', 'Nhím chọn đường nào?',
  ]],
  tap: ['my', [
    'Chạm vào ngôi sao đúng nhé!', 'Ngôi sao nào đây ta?', 'Chạm nhẹ vào ngôi sao nào!', 'Nhím chọn ngôi sao nào?',
    'Ngôi sao đang chờ Nhím chạm đó!', 'Thử chạm một ngôi sao xem!',
  ]],
  boost: ['my', [
    'Đường tắt cầu vồng! Nhanh quá!', 'Vút! Nhím vượt lên rồi!', 'Cầu vồng đẩy Nhím bay vèo!', 'Nhanh như gió!', 'Vượt lên nào!',
  ]],
  mud: ['my', [
    'Ôi, đường này lầy quá! Cố lên!', 'Đường vòng rồi, chạy tiếp nào!', 'Bì bõm! Chạy chậm một chút thôi!', 'Đường bùn rồi, không sao!',
  ]],
  attack: ['my', [
    'Quái bắn phép kìa! Trả lời đúng để né nhé!', 'Cẩn thận! Phép bóng tối bay tới!', 'Ối, quái bắn phép! Trả lời nhanh nào!',
    'Phép tím bay tới kìa! Né đi Nhím!', 'Quái làm phép rồi! Trả lời đúng là né được!',
  ]],
  dodge: ['my', [
    'Né được rồi!', 'Vèo, trượt rồi nhé!', 'Phép không trúng Nhím!', 'Né giỏi quá!', 'Hụt rồi, quái ơi!', 'Nhím nhanh hơn phép!',
  ]],
  ouch: ['my', [
    'Ối, trúng phép rồi!', 'Úi da! Cố lên Nhím!', 'Trúng rồi, nhưng Nhím vẫn chạy tiếp!', 'Ối! Mất một trái tim rồi!',
  ]],
  near: ['my', [
    'Đuổi kịp rồi! Trả lời đúng để bắn phép!', 'Sắp bắt được rồi! Làm phép nào!', 'Quái ở ngay trước mặt! Trả lời nào!',
    'Gần lắm rồi! Bắn phép thôi!',
  ]],
  zap: ['my', [
    'Trúng rồi!', 'Phép của Nhím mạnh quá!', 'Bùm! Trúng quái rồi!', 'Hay lắm! Trúng ngay!', 'Phép sáng quá!',
  ]],
  miss: ['my', [
    'Ôi, phép bay trượt rồi!', 'Hụt mất rồi!', 'Phép chưa trúng, cố lên!', 'Ối, quái chạy mất rồi!',
  ]],
  purify: ['my', [
    'Bóng tối tan rồi! Bạn ấy vui lại rồi!', 'Nhìn kìa, bạn ấy hết buồn rồi!', 'Bạn ấy về phe mình rồi!', 'Hoan hô! Bóng tối chạy mất rồi!',
    'Bạn ấy đang nhảy múa kìa!', 'Hết bị bóng tối nhập rồi!',
  ]],
  laugh: ['nmm', [
    'Hô hô hô! Chưa đúng rồi!', 'Hi hi! Thử lại đi nào!', 'Ha ha! Bóng tối tiến lên!', 'Hừm hừm, sai rồi nhé!',
    'Hô hô! Ta vẫn còn mạnh lắm!', 'Ha ha ha! Nhìn kỹ lại xem!',
  ]],
  nmm_turn: ['nmm', [
    'Đỡ phép của ta này!', 'Ha ha! Phép trăng đây!', 'Bóng đêm, bay đi!', 'Ta bắn phép đây, cô bé!', 'Né được không nào?',
  ]],
  my_turn: ['twi', [
    'Đến lượt Nhím!', 'Nhím bắn phép nào!', 'Phép thuật tình bạn đây!', 'Nhím làm phép nè!', 'Đến lượt mình rồi!',
  ]],
  nmm_hurt: ['nmm', [
    'Ối! Không thể nào!', 'Hừm! Ngọc Hài Hoà sáng thêm rồi!', 'Phép gì mà sáng thế!', 'Bóng tối của ta… mỏng dần rồi!',
    'Á! Đau quá đi!',
  ]],
  gate: ['my', [
    'Sắp tới đích rồi!', 'Cố lên, gần tới rồi!', 'Đích ở ngay phía trước!',
  ]],
};

/** Lời cảm ơn của bạn được cứu (tên tiếng Anh đọc bằng giọng tiếng Anh). */
export const FRIEND_THANKS: Record<FriendId, string> = {
  pinkie: 'Mình là {Pinkie Pie}! Cảm ơn Nhím, mình mở tiệc mừng nhé!',
  fluttershy: 'Mình là {Fluttershy}… Cảm ơn Nhím nhiều lắm!',
  cadance: 'Cô là công chúa {Cadance}! Cảm ơn Nhím nhé!',
  rainbowswirl: 'Mình là Cầu Vồng! Cảm ơn Nhím đã cứu mình!',
};
export const thanksKey = (id: FriendId) => `thx_${id}`;

/** Khoá audio câu thứ i trong ngân hàng. */
export const bankKey = (bank: string, i: number) => `b_${bank}_${i}`;

/** Ghép tiếng: "Mình ghép chữ ba nhé!" */
export const SPELL_TEMPLATE = 'Mình ghép chữ {w} nhé!';
export const spellKey = (id: string) => `sp_${id}`;
/** Tìm dấu thanh. */
export const TONE_FIND: Record<string, string> = {
  huyen: 'Dấu huyền đâu nhỉ?', sac: 'Dấu sắc đâu nhỉ?', hoi: 'Dấu hỏi đâu nhỉ?', nga: 'Dấu ngã đâu nhỉ?', nang: 'Dấu nặng đâu nhỉ?',
};
export const toneFindKey = (t: string) => `tf_${t}`;
export const TONE_LABEL: Record<string, string> = { huyen: 'dấu huyền', sac: 'dấu sắc', hoi: 'dấu hỏi', nga: 'dấu ngã', nang: 'dấu nặng' };
export const toneLabelKey = (t: string) => `tl_${t}`;
