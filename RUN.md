# Cách chạy: Nhím phi nước đại

Game web 3D (Vite + TypeScript + Three.js) cho Nhím (5 tuổi). **Chơi bằng bàn phím** trên Mac / laptop (↑ chạy, nháy ↑ 2 lần
bay, ← → chọn đường ở ngã rẽ).
Không cần mạng khi chơi (giọng đọc đã sinh sẵn trong `public/audio/`), trừ font Baloo 2 lấy từ Google Fonts lần đầu.

## Cần có

- Node.js 22.18 trở lên (`node -v`): các script kiểm tra đọc thẳng file `.ts`.
- pnpm 9 trở lên: `corepack enable` (không dùng npm).
- Chỉ khi muốn sinh lại giọng đọc: macOS (có `afconvert`) + Python 3 + mạng.

## Chạy

```bash
cd 06-pony-race
pnpm install
pnpm dev          # http://localhost:5186
```

Bấm Space (hoặc chạm chú ngựa 🏇) để bắt đầu → bản đồ → chọn bài (Space chơi bài đang sáng). Mở toàn màn hình (Ctrl+Cmd+F)
cho bé đỡ phân tâm.

## Chơi trên máy khác cùng Wi-Fi

`pnpm dev` in dòng `Network: http://192.168.x.x:5186` → mở bằng trình duyệt trên laptop có bàn phím. Bản build nhẹ hơn:
`pnpm build && pnpm preview`. (iPad không có bàn phím thì không điều khiển được lúc chạy.)

## Ảnh thật (không lên git)

- `public/photos/nhim-1.jpg`: chân dung Nhím (huy hiệu góc màn hình, bản đồ). `world-1.jpg` … `world-4.jpg`: thẻ ảnh khi xong bài 2
  mỗi thế giới. `final.jpg`: ảnh khi thắng màn cuối. Thiếu ảnh nào thì dùng `nhim-1`, thiếu cả thì vẽ chân dung Twilight.
- `public/family/<id>.jpg` (`ba-cuong`, `me-yen`, `ong-cuong`, `ba-tuyet`, `bac-hanh`): huy hiệu ảnh thật cạnh mặt pony trên phụ đề
  và màn kết quả. Xem `public/family/README.txt`.
- Nhận `.jpg/.jpeg/.png/.webp`. Đang `pnpm dev` thì thả ảnh vào là trang tự tải lại.

## Giọng đọc

Mọi câu nằm trong `src/lines.ts` (thoại), `src/letters.ts` (chữ), `src/numbers.ts` (phép tính), `src/words.ts` + `src/spell.ts`
(đánh vần). Sửa chữ xong:

```bash
python3 -m venv scripts/.venv && scripts/.venv/bin/pip install edge-tts   # lần đầu
pnpm audio        # chỉ sinh câu mới / câu đã đổi (sổ scripts/audio/.done.json)
```

edge-tts thỉnh thoảng trả về rỗng với câu ngắn: script tự thử lại 5 lần; vẫn lỗi thì chạy lại `pnpm audio` (chỉ sinh câu còn thiếu).

## Kiểm tra

```bash
pnpm check        # bảng vàng đánh vần + soát bộ câu hỏi (12k câu) + soát câu thoại + tsc
pnpm build        # như trên + build vào dist/
# cần pnpm dev đang chạy + playwright-core + chrome-headless-shell (đường dẫn qua PW= / CHROME= nếu khác máy):
node scripts/test/play-all.mjs right        # máy tự chơi 9 bài, trả lời đúng hết → phải thắng
node scripts/test/play-all.mjs wrong 1-1    # trả lời sai hết → phải thua sau 3 câu
node scripts/test/play-all.mjs mixed        # sai 1 câu rồi đúng → vẫn thắng
node scripts/test/play-human.mjs 1-2        # chơi như người bằng phím: giữ ↑, nháy ↑↑ khi sáng, ← → đúng biển (có tiếng)
WRONG=1 node scripts/test/play-human.mjs 1-1  # rẽ sai ngã rẽ đầu → đường cụt → quay ra
OUT=/tmp node scripts/test/shot.mjs 3-1 8 14  # chụp màn hình giây 8, 14
```

Chạy `play-all` nhiều bài song song quá 2 trang có thể làm Chrome headless tự đóng (GPU giả lập hết tài nguyên): dùng `PAR=2`.
