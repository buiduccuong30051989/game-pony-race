// Móc cho test tự động (headless): mỗi lúc chờ bé chọn, hoạt động đăng ký hàm `answer(đúng?)` ở đây.
// window.__game.answer(true) = chạm đáp án đúng; answer(false) = chạm 1 đáp án sai.
export const testHook: { answer: ((ok: boolean) => void) | null; waiting: string | null } = { answer: null, waiting: null };
export function setAnswer(label: string | null, fn: ((ok: boolean) => void) | null): void {
  testHook.waiting = label;
  testHook.answer = fn;
}
