// Tiếng bé ghép (nhặt chữ đầu → chữ vần → dấu). Mỗi tiếng PHẢI có đáp án đánh vần trong bảng vàng
// scripts/check-spelling.mjs và chỉ gồm 1 phụ âm đầu 1 chữ + 1 nguyên âm (+ dấu) cho bé 5 tuổi. File THUẦN.
export interface GameWord { word: string; emoji: string }

export const WORDS: Record<string, GameWord> = {
  ba: { word: 'ba', emoji: '👨' },
  'mẹ': { word: 'mẹ', emoji: '👩' },
  'bà': { word: 'bà', emoji: '👵' },
  ma: { word: 'ma', emoji: '👻' },
  la: { word: 'la', emoji: '🎵' },
  'cá': { word: 'cá', emoji: '🐟' },
  'bò': { word: 'bò', emoji: '🐄' },
  'gà': { word: 'gà', emoji: '🐔' },
  'dê': { word: 'dê', emoji: '🐐' },
  'tô': { word: 'tô', emoji: '🥣' },
  'vẽ': { word: 'vẽ', emoji: '🎨' },
  xe: { word: 'xe', emoji: '🚗' },
  'nơ': { word: 'nơ', emoji: '🎀' },
  'lá': { word: 'lá', emoji: '🍃' },
};
export const GAME_WORDS = Object.keys(WORDS);
