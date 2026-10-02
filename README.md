# Nhím phi nước đại (game 6: pony race, Three.js)

Game chạy kiểu Temple Run cho Nhím (Hà An, 5 tuổi). Nhím là **Twilight Sparkle**, chạy trên đường đua 3D qua 4 thế giới, vừa chạy
vừa học: **nhận mặt chữ**, **cộng / trừ trong 10**, **điền số** (3 + ? = 5), **ghép tiếng** (b + a = ba). Game riêng, repo riêng,
không dính gì tới game 5 (chỉ copy model + một phần engine lúc dựng). Kế hoạch: `PLAN.md`. Chạy: `RUN.md`. Giấy phép: `CREDITS.md`.

## Bản đồ

Chọn thế giới nào cũng được ngay từ đầu. Trong 1 thế giới, bài 2 mở khi xong bài 1. Màn cuối mở khi xong bài 2 cả 4 thế giới.

| Thế giới | Bài 1 (dễ): đua cùng cả nhà | Bài 2 (khó hơn) | Học |
|---|---|---|---|
| 1. Rừng Everfree (rừng nấm) | 5 ngã rẽ | **bị** slime + ma **đuổi** | nguyên âm, cộng / trừ trong 5 |
| 2. Ponyville (làng, vườn táo) | 5 ngã rẽ | **đuổi** yêu tinh, rồng nhỏ → cứu Pinkie Pie, Fluttershy | phụ âm b c d đ h l m n, ghép ba / mẹ / bà / ma / la, trong 10 |
| 3. Đồi cầu vồng (pha lê, cầu vồng) | 5 ngã rẽ, 2 cầu vồng | **bị** rồng nhỏ + ma **đuổi** | phụ âm g k p q r s t v x, điền số, ghép cá / bò / gà / dê / tô |
| 4. Canterlot (lâu đài) | 5 ngã rẽ | **đuổi** pháp sư, phù thuỷ → cứu Cadance, Cầu Vồng | cả 29 chữ, mọi loại |
| 🌙 Màn cuối | đường đua bầu trời: đấu Nữ hoàng Bóng Đêm | | trộn hết |

## Cách chơi (iPad ngang, chỉ chạm)

- **Giữ nút 🏇** (góc phải dưới) **hoặc giữ ngón tay bất kỳ đâu trên màn hình** thì Twilight phi nước đại; thả ra thì chậm dần rồi
  đứng (không bao giờ bị phạt vì thả tay: quái cũng dừng theo, người nhà đứng chờ). Mac: giữ Space / ↑.
- **Chướng ngại** (khúc gỗ, đá, hàng rào, đống rơm, pha lê, hàng rào cây): sắp tới thì **mọi thứ chậm lại**, nút **🪽** (góc trái
  dưới) sáng rực + giọng "Bay lên nào!". Chạm 🪽 là bay qua (đang bay thì giữ đà, nhấc tay khỏi nút chạy vẫn qua được). Không chạm thì
  vấp lộn 1 vòng rồi chạy tiếp: **vấp không tính là sai**. Có vòm ngọc phía trên mỗi chướng ngại (bay qua là nhặt được). Mac: F / ↓.
- **Câu hỏi**: thời gian **gần như dừng**, không đếm giờ. Bảng câu hỏi trên cùng: phép tính có hàng quả bên dưới mỗi số (bài trừ
  gạch ✕ phần bị trừ), câu chữ chỉ có 👂 (không hiện chữ để khỏi lộ đáp án), ghép tiếng có hình + ô chữ. Nút 🔊 nghe lại; im 16 s
  thì giọng tự hỏi lại. Chạm **ngôi sao** đúng (3 sao trước mặt) hoặc **biển** đúng ở ngã rẽ (2 biển trên 2 nhánh).
- **Mỗi câu 1 kết quả**: đúng → đường tắt cầu vồng (tăng tốc) / né phép / bắn trúng quái; sai → mất 1 ❤️, ngôi sao bé chạm đọc tên
  ("dờ"), sao đúng sáng lên, rồi đọc đáp án để học ("bờ… bò", "Hai cộng ba bằng năm!", đánh vần từng âm có chữ sáng theo).
  Câu sai được ghi để **ôn lại** ở các bài sau (đúng 2 lần thì thôi ôn).
- **Sai 3 lần là thua**: màn "Suýt nữa thôi!" nhẹ nhàng, người nhà động viên, nút 🔄 thử lại to.

### 3 kiểu bài + màn cuối

- **Đua** (bài 1): 2 người nhà random mỗi lần (ba Cường, mẹ Yến, ông Cương, bà Tuyết; bác Hanh vào sau khi thắng màn cuối), không lặp
  cặp lần trước. Người nhà chạy kiểu dây chun (không bỏ xa, không tụt mất, Nhím đứng thì họ chờ). Ngã rẽ = câu hỏi 2 lựa chọn: đúng
  vào đường tắt cầu vồng, sai vào đường bùn chậm. Về đích thứ mấy cũng là xong bài; đoạn cuối ai về trước tuỳ số câu sai.
- **Bị đuổi** (bài 2 thế giới 1, 3): 2 quái chạy sát sau lưng, thỉnh thoảng bắn cầu phép tím (bay chậm lại chờ bé trả lời): đúng →
  Twilight lộn né, sai → trúng. Đợt kịch tính: thêm 2 quái lao lên, 2 câu liền, đúng cả 2 → khiên phép đẩy lùi. Tới cổng an toàn thì
  Nhím làm phép tẩy bóng tối cho cả đám (về màu thật, nhảy múa).
- **Đuổi quái** (bài 2 thế giới 2, 4): đường vòng kín. Quái ôm bong bóng nhốt bạn chạy phía trước (chậm hơn Nhím chút). Đuổi kịp →
  câu hỏi: đúng → tia phép trúng (💥), quái vọt lên; sai → quái cười, chạy xa. 3 phát trúng → thanh tẩy, bong bóng vỡ, bạn ra cảm ơn
  rồi chạy cùng Nhím. Mỗi bài cứu 2 bạn.
- **Màn cuối**: bay trên đường đua bầu trời (cánh ánh sáng), mây, chim, cầu vồng, vòng mây có ngọc. Nữ hoàng Bóng Đêm bay phía
  trước quay mặt lại; 2 bên thay phiên: lượt Nữ hoàng bắn phép trăng (đúng thì né), lượt Nhím bắn phép (đúng thì 1 🌟 Hài Hoà sáng).
  Đủ 5 🌟 → cầu vồng 6 tia, màn trắng, Nữ hoàng hoá lại bác Hanh (Luna), trời sáng, pháo giấy.

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
| `&auto=1` | bỏ màn chạm bắt đầu, máy tự giữ chạy + tự bay + tự trả lời đúng |
| `&noanswer=1` | (cùng `auto`) không tự trả lời: để chụp màn hình lúc hỏi / test trả lời sai |
| `&mute=1` | tắt tiếng, mỗi câu coi như 150 ms (chạy nhanh khi test) |
| `&perf=1` | hiện fps · tam giác · draw call · geometry · texture |

`window.__game` cho test headless: `phase`, `level`, `waiting` (vd `pick:ô`, `tone:huyen`), `answer(true|false)`, `hold(on)`,
`fly()`, `perf()`, `startLevel(id)`, `openMap()`.

## Cấu trúc

```
index.html        DOM đè canvas: HUD (ảnh Nhím, ❤️, thanh đường đua có mặt người chạy, 🌟 Hài Hoà / 💥 máu quái, 💎), bảng câu hỏi,
                  nút 🏇 giữ để chạy, nút 🪽, đếm ngược, kết quả, bản đồ, màn bắt đầu, nhắc xoay ngang
src/main.ts       khởi động, bản đồ ↔ bài ↔ kết quả, giữ để chạy (nút / màn hình / phím), lưu tiến độ, mở đồ trang trí, debug, __game
src/level.ts      1 bài: dựng, 4 kiểu chơi, chướng ngại + slow-mo, câu hỏi (sao / biển), phép bay, camera, thắng / thua
src/track.ts      đường đua: spline lấy mẫu 1 m, khúc cua, cầu vồng (vồng lên), ngã rẽ 2 nhánh, đường hở / vòng kín, dải mặt đường
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
                  test/play-all.mjs (máy tự chơi), test/play-human.mjs (chơi như người: giữ nút, chạm sao), test/shot.mjs (chụp)
```

## Hiệu năng (đo headless Chrome trên Mac, 1180×820)

~150–210k tam giác, ~75–145 draw call, 110–120 fps (giới hạn của máy đo, iPad sẽ thấp hơn). Cách giữ nhẹ: pixel ratio ≤ 1.5; đồ
trang trí gộp theo vật liệu trong từng đoạn 60 m (đoạn ngoài tầm nhìn bị loại nhờ bounding sphere) + sương mù + far plane 230 m;
vật liệu Lambert cho đồ tĩnh; ngọc / mây / chim / bướm / vòng mây mỗi loại 1 draw call (InstancedMesh); chỉ Nhím đổ bóng thật
(shadow map 1024 bám theo Nhím), người khác bóng tròn; hạt phép 2 Points (1 draw call mỗi loại). Bộ nhớ ổn định khi chơi
(heap JS ~40 MB, số geometry không tăng dần).

## Đã biết / chưa làm

- Chưa test trên iPad thật (chỉ headless Chrome trên Mac): cần ba thử độ khó (tốc độ 9–10.5 m/s, độ chậm 0.2 khi gặp chướng ngại)
  và độ dài bài (đo có tiếng: ~2 phút / bài kể cả lời chào, đếm ngược, lời khen).
- Celestia (6.7 MB) và Nightmare Moon (8.8 MB) nặng nhất, tải lần đầu qua Wi-Fi hơi lâu; nén texture nếu iPad tải chậm.
- Twilight không có xương cánh: bay bằng cánh ánh sáng (sprite), chân auto-rig.
