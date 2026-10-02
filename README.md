# Nhím phi nước đại (game 6: pony race, Three.js)

Game chạy kiểu Temple Run cho Nhím (Hà An, 5 tuổi), **chơi bằng bàn phím** (↑ chạy / bay, ← → chọn đường). Nhím là
**Twilight Sparkle**, chạy trên đường đua 3D qua 4 thế giới, vừa chạy vừa học: **nhận mặt chữ**, **cộng / trừ trong 10**, **điền số** (3 + ? = 5), **ghép tiếng** (b + a = ba). Game riêng, repo riêng,
không dính gì tới game 5 (chỉ copy model + một phần engine lúc dựng). Kế hoạch: `PLAN.md`. Chạy: `RUN.md`. Giấy phép: `CREDITS.md`.

## Bản đồ

Chọn thế giới nào cũng được ngay từ đầu. Trong 1 thế giới, bài 2 mở khi xong bài 1. Màn cuối mở khi xong bài 2 cả 4 thế giới.

| Thế giới | Bài 1 (dễ): đua cùng cả nhà | Bài 2 (khó hơn) | Học |
|---|---|---|---|
| 1. Rừng Everfree (rừng nấm) | 5 ngã rẽ (câu hỏi) | **bị** slime + ma **đuổi** | nguyên âm, cộng / trừ trong 5 |
| 2. Ponyville (làng, vườn táo) | 5 ngã rẽ | **đuổi** yêu tinh, rồng nhỏ → cứu Pinkie Pie, Fluttershy | phụ âm b c d đ h l m n, ghép ba / mẹ / bà / ma / la, trong 10 |
| 3. Đồi cầu vồng (pha lê, cầu vồng) | 5 ngã rẽ, 2 cầu vồng | **bị** rồng nhỏ + ma **đuổi** | phụ âm g k p q r s t v x, điền số, ghép cá / bò / gà / dê / tô |
| 4. Canterlot (lâu đài) | 5 ngã rẽ | **đuổi** pháp sư, phù thuỷ → cứu Cadance, Cầu Vồng | cả 29 chữ, mọi loại |
| 🌙 Màn cuối | đường đua bầu trời: đấu Nữ hoàng Bóng Đêm | | trộn hết |

## Cách chơi (BÀN PHÍM, máy Mac / laptop màn ngang)

Chơi chỉ bằng 3 phím mũi tên cho bé tập trung (không dùng chuột trong lúc chạy). Dưới màn hình có bảng phím ⬅ ⬆ ➡, phím cần
bấm sẽ sáng lên.

- **Giữ ↑** thì Twilight phi nước đại; thả ra thì chậm dần rồi đứng (không bao giờ bị phạt vì thả tay: quái cũng dừng theo,
  người nhà đứng chờ).
- **Nháy nhanh ↑ 2 lần** = bay / nhảy xa, dùng lúc nào cũng được. Gặp **chướng ngại** (khúc gỗ, đá, hàng rào, rơm, pha lê…):
  mọi thứ chậm lại và Twilight **đứng chờ ngay trước chướng ngại** tới khi bé nháy ↑ 2 lần (không bao giờ vấp vì không kịp).
  Phía trên mỗi chướng ngại có vòm ngọc, bay qua là nhặt được.
- **Mỗi câu hỏi là 1 ngã rẽ 2 đường** (chữ Y), đáp án viết trên biển ở đầu mỗi đường. Tới gần ngã rẽ thì thời gian gần như dừng,
  bảng câu hỏi hiện trên cùng (phép tính có hàng quả; câu chữ chỉ có 👂 để khỏi lộ đáp án; ghép tiếng có hình + ô chữ), giọng đọc
  câu hỏi; **bấm ← hoặc →** để chọn đường. Không đếm giờ; im 16 s thì giọng hỏi lại; **R** hoặc nút 🔊 để nghe lại.
- **Đúng** → đi tiếp đường chính (đua: đường tắt cầu vồng tăng tốc; bị đuổi: bỏ xa quái; đuổi quái: tia phép trúng quái).
  **Sai** → mất 1 ❤️, Twilight chạy vào đường cụt (đống đá hoặc quái bóng tối trốn ở đó), người nhà gọi "Nhím ơi, quay lại!"
  (bài không có người nhà thì người kể nhắc), nghe đáp án đúng ("bờ… bò", "Hai cộng ba bằng năm!"), rồi Twilight tự quay ra
  ngã rẽ và đi đường đúng. Câu sai được ghi để **ôn lại** ở bài sau (đúng 2 lần thì thôi ôn).
- **Ghép tiếng** (ba, mẹ, bà, cá…): mỗi bước là 1 ngã rẽ: chữ đầu → nguyên âm → dấu; xong thì đánh vần cả tiếng, chữ sáng theo.
- **Sai 3 lần là thua**: màn "Suýt nữa thôi!" nhẹ nhàng, người nhà động viên, 🔄 thử lại.
- Menu: **Space / Enter** = bắt đầu, chơi bài tiếp, thử lại; **Esc** = về bản đồ. Bản đồ vẫn bấm chuột được (cho ba mẹ chọn bài).

### 3 kiểu bài + màn cuối

- **Đua** (bài 1): 2 người nhà random mỗi lần (ba Cường, mẹ Yến, ông Cương, bà Tuyết; bác Hanh vào sau khi thắng màn cuối), không
  lặp cặp lần trước. Người nhà chạy kiểu dây chun, luôn đi đường đúng, gọi Nhím quay lại khi Nhím rẽ nhầm. Về đích thứ mấy cũng
  xong bài; đoạn cuối ai về trước tuỳ số câu sai.
- **Bị đuổi** (bài 2 thế giới 1, 3): 2 quái chạy sát sau lưng. Rẽ đúng thì bỏ xa quái; rẽ nhầm thì quái dồn tới ngã rẽ, Nhím
  quay ra bị bắn 1 phát. Đợt kịch tính: thêm 2 quái lao lên, đúng cả 2 ngã rẽ sau đó → khiên phép đẩy lùi. Tới cổng an toàn thì
  Nhím làm phép tẩy bóng tối cho cả đám.
- **Đuổi quái** (bài 2 thế giới 2, 4): quái ôm bong bóng nhốt bạn chạy trước 15–24 m. Mỗi ngã rẽ đúng = 1 tia phép trúng (💥).
  3 phát → thanh tẩy, bong bóng vỡ, bạn cảm ơn rồi chạy cùng Nhím. Mỗi bài cứu 2 bạn.
- **Màn cuối**: bay trên đường đua bầu trời. Mỗi lượt có **2 vòng mây trái / phải**, đáp án trong vòng: bấm ← / → để bay qua vòng
  đúng. Lượt Nữ hoàng bắn phép trăng (đúng thì né), lượt Nhím bắn phép (đúng thì 1 🌟 Hài Hoà sáng). Đủ 5 🌟 → cầu vồng 6 tia,
  Nữ hoàng hoá lại bác Hanh (Luna), trời sáng.

### Phần thưởng

- 💎 ngọc nhặt dọc đường (kể cả khi thua vẫn giữ ngọc). Tổng ngọc mở đồ cho Twilight: 60 🌸 vòng hoa trên đầu, 150 🌈 vệt cầu vồng
  khi chạy, 300 ✨ hào quang sao.
- Xong bài 2 của mỗi thế giới: thẻ ảnh thật của Nhím (`public/photos/world-N.jpg`, thiếu thì `nhim-1.jpg`) trên màn thắng.
  Thắng màn cuối: ảnh `final.jpg`.

## Debug URL

Có tham số debug thì KHÔNG ghi đè tiến độ thật (`localStorage` `nhim-race-v1`), trừ khi thêm `&save=1`.

| Tham số | Tác dụng |
|---|---|
| `?level=1-1` … `?level=4-2`, `?level=final` | vào thẳng 1 bài |
| `?unlock=all` | mở hết (trừ màn cuối đã xong) |
| `?reset=1` | xoá tiến độ |
| `&auto=1` | bỏ màn bắt đầu, máy tự giữ ↑ + tự bay + tự chọn đường đúng |
| `&noanswer=1` | (cùng `auto`) không tự trả lời: để chụp màn hình lúc hỏi / test trả lời sai |
| `&mute=1` | tắt tiếng, mỗi câu coi như 150 ms (chạy nhanh khi test) |
| `&perf=1` | hiện fps · tam giác · draw call · geometry · texture |

`window.__game` cho test headless: `phase`, `level`, `waiting` (vd `turn:ô`, `tone:huyen`), `answer(true|false)` (rẽ đúng / sai), `hold(on)`,
`fly()`, `perf()`, `startLevel(id)`, `openMap()`.

## Cấu trúc

```
index.html        DOM đè canvas: HUD (ảnh Nhím, ❤️, thanh đường đua có mặt người chạy, 🌟 Hài Hoà / 💥 máu quái, 💎), bảng câu hỏi,
                  bảng phím ⬅ ⬆ ➡ (sáng phím cần bấm), đếm ngược, kết quả, bản đồ, màn bắt đầu
src/main.ts       khởi động, bản đồ ↔ bài ↔ kết quả, BÀN PHÍM (↑ giữ / nháy 2 lần, ← →, R, Space, Esc), lưu tiến độ, debug, __game
src/level.ts      1 bài: dựng, 4 kiểu chơi, chướng ngại (dừng chờ bay), ngã rẽ = câu hỏi, đi nhầm → đường cụt → quay ra, vòng mây,
                  phép bay, camera, thắng / thua
src/track.ts      đường đua: spline lấy mẫu 1 m, khúc cua, cầu vồng (vồng lên), ngã rẽ chữ Y + nhánh cụt (Track.branch), dải mặt đường
src/scenery.ts    cảnh theo thế giới: mặt đường, suối dưới cầu, đồ trang trí GỘP theo đoạn 60 m, cổng xuất phát / đích,
                  chướng ngại, ngọc / mây / chim / bướm / vòng mây = InstancedMesh, trời màn cuối
src/runner.ts     người chạy trên đường: s, tốc độ, làn, nhánh, bay qua, tăng tốc / bùn
src/pony.ts       pony: auto-rig phi nước đại / công chúa vỗ cánh, cánh ánh sáng, bóng tròn, lộn vòng, né, trúng phép, ăn mừng
src/monster.ts    quái GLB: bị nhập (tím, mắt sáng, khói) / thanh tẩy, chạy / đứng / đau / cười
src/quiz.ts       sinh câu hỏi 5 loại, xen kẽ, không trùng, chèn câu ôn; src/letters.ts, numbers.ts, words.ts, spell.ts
src/lines.ts      MỌI câu thoại + ngân hàng câu + giọng; src/voice.ts chọn câu không lặp; src/talk.ts phụ đề có mặt người nói
src/engine.ts     renderer, camera, ánh sáng + bóng bám Nhím, trời gradient, sương mù, tải GLB, vòng lặp có ĐỒNG HỒ CHẬM
src/ui.ts, progress.ts, audio.ts, magic.ts, letterstar.ts, rig.ts, photos.ts, tween.ts, testhook.ts
scripts/          check-spelling.mjs (bảng vàng đánh vần), check-quiz.mjs (soát bộ câu hỏi), audio-lines.mjs + gen-audio.py (giọng),
                  test/play-all.mjs (máy tự chơi), test/play-human.mjs (chơi như người bằng phím), test/shot.mjs (chụp)
```

## Hiệu năng (đo headless Chrome trên Mac, 1180×820)

~150–210k tam giác, ~75–145 draw call, 110–120 fps (giới hạn của máy đo, iPad sẽ thấp hơn). Cách giữ nhẹ: pixel ratio ≤ 1.5; đồ
trang trí gộp theo vật liệu trong từng đoạn 60 m (đoạn ngoài tầm nhìn bị loại nhờ bounding sphere) + sương mù + far plane 230 m;
vật liệu Lambert cho đồ tĩnh; ngọc / mây / chim / bướm / vòng mây mỗi loại 1 draw call (InstancedMesh); chỉ Nhím đổ bóng thật
(shadow map 1024 bám theo Nhím), người khác bóng tròn; hạt phép 2 Points (1 draw call mỗi loại). Bộ nhớ ổn định khi chơi
(heap JS ~40 MB, số geometry không tăng dần).

## Đã biết / chưa làm

- Chơi bằng bàn phím (ba chốt 02/10/2026): iPad không có bàn phím thì không chơi được trong lúc chạy (bản đồ vẫn bấm được).
- Chưa thử với bé: cần ba xem tốc độ (9–10.5 m/s), độ dài bài (~2 phút có tiếng) và việc nháy ↑ 2 lần có dễ không.
- Celestia (6.7 MB) và Nightmare Moon (8.8 MB) nặng nhất, tải lần đầu hơi lâu.
- Twilight không có xương cánh: bay bằng cánh ánh sáng (sprite), chân auto-rig.
