# Plan game 6: "Nhím phi nước đại" (pony race, Three.js)

Game chạy kiểu Temple Run, **game riêng, repo riêng** (`06-pony-race/`). Copy model pony + quái + phần engine dùng được từ
`05-pony-story` (rig pony, sao chữ, đánh vần, giọng Hoài My, hạt phép) sang, sau đó 2 game sống độc lập. Ngày 02/10/2026. Trạng thái: **đã dựng xong bản đầu (02/10/2026)**, chờ ba thử trên iPad. Quyết định khi làm: §11.

## 1. Ý chính (ba đề ra)

- 3 loại bài: **(1) đua** với 2 người nhà, **(2) bị quái đuổi**, **(3) đuổi quái**. Màn cuối: **đấu Nightmare Moon trên trời**.
- **Mỗi thế giới 2 bài, bài 2 khó hơn bài 1.**
- **Giữ nút thì chạy.** Gặp chướng ngại thì **bay lên**. Trước mỗi lựa chọn (chướng ngại, ngã rẽ, câu hỏi) mọi thứ **chậm lại**
  cho bé kịp thao tác.
- Đường đua có **ngã rẽ**, **cầu vồng**, cảnh đẹp.
- Học: **nhận mặt chữ**, **cộng / trừ trong 10**, **điền số** (3 + ? = 5), **nhặt chữ ghép tiếng**. Xen kẽ nhau. **Không dạy đếm** (bé đã biết).
- **Có thể thua: sai 3 lần là thua** (khác game 1–5 không có thua).

## 2. Nhân vật

| Người nhà | Pony | Ở game này |
|---|---|---|
| Nhím | Twilight Sparkle | luôn là người chơi |
| Ba Cường | Rainbow Dash | người đua cùng |
| Mẹ Yến | Rarity | người đua cùng |
| Ông Cương | Applejack | người đua cùng |
| Bà Tuyết | Celestia | người đua cùng |
| Bác Hanh | Luna / **Nightmare Moon** | trùm màn cuối; thắng xong thì bác Hanh (Luna) **mở khoá làm người đua cùng** |

Bài đua: mỗi lần **random 2 người nhà** đua cùng Nhím, không trùng cặp của lần chơi trước. Bảng tên trên đầu: "Ba Cường".
Giọng đọc chỉ gọi tên nhà (Nhím, ba, mẹ, ông, bà, bác), không đọc tên tiếng Anh (giữ luật game 5).

Quái: lấy từ `05-pony-story/public/models/monsters/`, đã chọn dễ thương: slime, ma, yêu tinh, rồng nhỏ, phù thuỷ, pháp sư.

## 3. Bản đồ

4 thế giới × 2 bài + màn cuối = **9 bài**. Mỗi bài 60–90 s.

**Bản đồ** (ba chốt: 1 game, chọn được thế giới muốn chơi): 4 thế giới + màn cuối, **chọn thế giới nào cũng được** ngay từ đầu.
Trong 1 thế giới: bài 2 mở khi xong bài 1. Màn cuối mở khi xong bài 2 của cả 4 thế giới.

| Thế giới | Cảnh | Quái | Học (gợi ý, xen kẽ) |
|---|---|---|---|
| 1. Rừng Everfree | đường đất, cây to, nấm, đom đóm, suối có cầu gỗ | slime, ma | nhận chữ (nguyên âm) · cộng trong 5 |
| 2. Ponyville | đường làng, nhà mái tranh, vườn táo của ông, cối xay gió | yêu tinh, rồng nhỏ | nhận chữ (phụ âm) · cộng / trừ trong 5 · ghép "ba", "mẹ" |
| 3. Đồi cầu vồng | thác nước, **cầu vồng làm cầu**, đảo bay, pha lê | rồng nhỏ, ma | cộng / trừ trong 10 · điền số |
| 4. Canterlot | đường lát đá trắng, tháp mái vàng, cờ bay | phù thuỷ, pháp sư | trộn hết · ghép tiếng có dấu ("bà", "cá") |
| **Màn cuối** | **đường đua bầu trời**: mây, chim, bướm, cầu vồng, trăng | Nightmare Moon | trộn hết, ưu tiên chữ / phép tính bé hay sai |

Thế giới nào cũng **bài 1 = đua cùng cả nhà** (dễ). **Bài 2** (khó hơn) đổi luân phiên giữa 2 loại quái:

| Thế giới | Bài 1 (dễ) | Bài 2 (khó) |
|---|---|---|
| 1. Rừng Everfree | đua | bị slime + ma đuổi |
| 2. Ponyville | đua | đuổi yêu tinh / rồng nhỏ, cứu bạn |
| 3. Đồi cầu vồng | đua | bị rồng nhỏ + ma đuổi |
| 4. Canterlot | đua | đuổi phù thuỷ / pháp sư, cứu bạn |
| Màn cuối | đấu Nightmare Moon trên trời | |

**Bài 2 khó hơn bài 1 ở chỗ**: 7 câu thay vì 5; số lớn hơn (bài 1 trong 5, bài 2 trong 10 từ thế giới 2); chữ nhiễu là cặp
dễ lẫn; chạy nhanh hơn ~20%; nhiều chướng ngại hơn; có đợt kịch tính (3–4 quái dồn sát). Câu hỏi vẫn không đếm giờ.

## 4. Điều khiển (iPad ngang)

- **Nút chạy to** góc phải dưới: giữ thì Twilight phi nước đại, thả thì chậm dần rồi đứng (không bị phạt).
- **Chướng ngại** (khúc gỗ, tảng đá, hàng rào, vũng nước): còn ~3 s thì **chậm lại** (time scale ~0.2), nút **bay** (cánh,
  tím) nảy lên + giọng "Bay lên nào!". Chạm → Twilight vỗ cánh bay qua. Không chạm thì vấp (lăn 1 vòng, chậm 1 s). **Vấp không tính là sai.**
- **Ngã rẽ**: chậm lại, 2 mũi tên to trên đường, chạm để chọn (xem §5).
- **Trả lời câu hỏi**: 3 **sao đáp án** 3D to lơ lửng phía trước (như sao chữ game 5), chạm vào sao. Đang hỏi thì **thời gian gần
  như dừng** và **không đếm giờ**; im 20 s thì giọng nhắc lại câu hỏi.
- Mac: Space = chạy, ↑ = bay, ←/→ = rẽ, 1/2/3 = đáp án.

## 5. Ba loại bài

### Loại 1: Đua cùng cả nhà
- 3 làn song song, Nhím + 2 người nhà xuất phát cùng vạch. Người nhà chạy theo "dây chun" (rubber band): luôn bám sát, không bỏ xa,
  không tụt mất, để cuộc đua lúc nào cũng hồi hộp.
- **Ngã rẽ = câu hỏi**: biển ở mỗi nhánh ghi chữ / số. "Nhím ơi, đường nào có chữ ô?" Đúng thì vào **đường tắt cầu vồng** (tăng tốc,
  vượt lên); sai thì vào đường vòng (chậm hơn chút, vẫn tới đích được).
- Ngọc rải trên đường, nhặt cho vui (đổi lấy trang trí ở §8).
- Đích: về nhất thì cả nhà nhảy mừng + pháo giấy; về nhì / ba thì người thắng ôm Nhím "Lần sau Nhím thắng nhé!".
- **Thua ở bài đua**: sai 3 lần ở ngã rẽ là thua; về thứ mấy không tính thua.

### Loại 2: Bị quái đuổi
- Camera lùi xa hơn để thấy quái phía sau. **Thả nút chạy thì quái cũng chậm theo**, không bao giờ bắt được Nhím vì thả tay;
  chỉ trả lời sai mới mất tim. Quái chạy sau lưng Nhím, thỉnh thoảng **bắn phép** (quả cầu tím).
- Phép bay tới thì chậm lại, câu hỏi hiện ra. **Đúng: Twilight né** (lộn vòng sang bên, phép bay trượt, quái tức giận).
  **Sai: trúng phép**, mất 1 tim, Twilight lảo đảo, quái nhích lại gần.
- **Đợt kịch tính** (1–2 lần mỗi bài): 3–4 quái dồn sát sau lưng, nhạc nhanh, 2 câu liền nhau; trả lời đúng cả 2 thì Twilight
  bung khiên sáng, cả đám quái văng ra xa.
- Thắng: chạy tới cổng an toàn (cổng lâu đài, cầu vồng) → quái bị chặn lại, ngồi phịch xuống.

### Loại 3: Đuổi quái
- Một con quái ôm **bong bóng nhốt bạn pony** chạy phía trước. Nhím giữ nút để bám theo.
- Bám đủ gần thì câu hỏi hiện ra. **Đúng: Twilight bắn phép**, trúng quái (quái có 3 "vạch sáng", mỗi phát mất 1).
  **Sai: quái cười, chạy vọt lên**, mất 1 tim.
- Trúng 3 phát → quái được **thanh tẩy** (màu thật, nhảy múa, giống game 5), bong bóng vỡ, bạn pony ra cảm ơn.

### Câu hỏi trong bài
Mỗi bài 5–7 câu, xoay vòng các loại; không quá 2 câu cùng loại liền nhau.

| Loại | Ví dụ | Sao đáp án |
|---|---|---|
| Nhận mặt chữ | "Chữ ô đâu?" | 3 chữ, chữ nhiễu ưu tiên cặp dễ lẫn (o–ô–ơ, b–d, m–n…) |
| Cộng | "Hai cộng ba bằng mấy?" + hiện `2 + 3 = ?` | 3 số |
| Trừ | "Năm trừ hai bằng mấy?" | 3 số |
| Điền số | `3 + ? = 5`: "Ba cộng mấy bằng năm?" | 3 số |
| Ghép tiếng | phải chạm **b** rồi **a**, tiếng "ba" sáng lên + đánh vần | 2–3 lượt chạm, mỗi lượt 3 sao |

- Phép tính hiện **chữ số + hình nhỏ** bên cạnh (🍎🍎 + 🍎🍎🍎) để bé có chỗ dựa, vì mới chuyển từ đếm sang tính.
- Sai: sao sai lắc + đọc tên cái bé vừa chạm, sao đúng sáng lên, rồi đọc đáp án để học (§11: mỗi câu 1 kết quả, không thử lại).
- **Ôn câu sai**: câu nào bé trả lời sai (chữ, phép cộng, trừ, điền số, ghép tiếng) thì ghi vào `weak` của **game 6**; câu đó
  quay lại ở bài sau và màn cuối, trả lời đúng 2 lần thì xoá khỏi `weak`. Hoàn toàn độc lập, không đọc / ghi gì của game 5.

## 6. Màn cuối: đấu Nightmare Moon trên trời

- Twilight **bay** (cánh ánh sáng như cao trào game 5, vì cánh model không vỗ được), đường đua bầu trời có vòng mây để bay qua,
  đàn chim, bướm, cầu vồng, trăng lớn phía sau.
- **Hai bên thay phiên**:
  - Lượt Nightmare Moon: bắn tia trăng → câu hỏi → **đúng thì né**, sai thì trúng (mất 1 tim).
  - Lượt Nhím: niệm phép → câu hỏi → **đúng thì bắn trúng** (Nightmare Moon mất 1 ngọc Hài Hoà màu tối → sáng lại), sai thì trượt (mất 1 tim).
- Thắng khi đủ 5 ngọc sáng (5 phát trúng) → Nightmare Moon hoá lại bác Hanh, bình minh, cả nhà bay ra đón, mở khoá bác Hanh làm người đua.
- Thua khi 3 tim mất hết.

## 7. Thua (3 sai) và chơi lại

- 3 tim trên HUD. Mỗi lần sai mất 1 tim, giọng **không trách**.
- Hết tim: cảnh ngắn và nhẹ nhàng (pony ngồi xuống thở, quái / Nightmare Moon lè lưỡi chạy đi), giọng người nhà động viên:
  "Suýt nữa thôi! Mình thử lại nhé!" + 1 nút **Thử lại** to. Không có chữ "THUA", không màn đen.
- Thử lại: chơi lại bài đó từ đầu (bài ngắn 60–90 s nên không nản), câu hỏi vừa sai được hỏi lại sớm.

## 8. Phần thưởng

- Ngọc nhặt được → mở **đồ trang trí cho Twilight** (vòng hoa, nơ, khăn, vệt cầu vồng sau chân) và màu đường đua.
- Bạn pony cứu được ở loại 3 đứng cổ vũ ở vạch đích các bài sau.
- Xong mỗi thế giới: 1 trang album ảnh thật (dùng lại `album.ts` của game 5).
- Bạn pony chỉ được cứu ở bài "đuổi quái" (thế giới 2, 4), 2 bạn mỗi bài, tổng 4 bạn.

## 9. Kỹ thuật

- **Repo riêng** `06-pony-race/` (git riêng, cổng dev 5186). Copy từ game 5 rồi sửa riêng: `rig.ts` (tăng biên độ, tần số chân → phi nước đại), `letterstar.ts`,
  `spell.ts` + bảng vàng, `letters.ts`, `lines.ts` + `voice.ts` + `scripts/gen-audio.py`, `monster.ts`, `magic.ts`, `audio.ts`,
  `photos.ts`, `album.ts`, `tween.ts`.
- **Đường đua**: `CatmullRomCurve3` có khúc cua, dốc, cầu; nhân vật đi theo tham số quãng đường `s` + lệch làn. Dựng mặt đường
  theo spline (ribbon mesh), cảnh hai bên rải dọc spline bằng `InstancedMesh` (cây, nấm, đá Kenney Nature Kit). Ngã rẽ = 2 spline
  tách ra rồi nhập lại.
- **Slow-mo**: 1 biến `timeScale` toàn cục nhân vào `dt` cho mọi chuyển động + AnimationMixer; tween về 0.2 trong 0.3 s,
  giọng đọc và UI chạy theo thời gian thật.
- **Cầu vồng**: mặt đường dùng shader gradient 7 màu cuộn theo `s` + hạt lấp lánh.
- **Trời**: shader gradient + mây Kenney / mây InstancedMesh; chim, bướm (tìm model CC0 trên poly.pizza, không có thì dựng bằng
  quad vỗ cánh).
- Ngân sách iPad: ≤ 200k tam giác, ≤ 120 draw call (ít nhân vật hơn trận cuối game 5). Người đua cùng dùng model đã giảm lưới.
- Tiến độ localStorage `nhim-race-v1` = { done: ["1-1", "1-2", …], final, gems, cosmetics, weak, friends }.
- Câu hỏi chữ lấy cả 29 chữ; mỗi bài chèn 1–2 câu từ `weak` (câu sai trước đó trong game 6).
- Debug URL: `?race=W-N` (vd `?race=2-1`), `?race=final`, `?unlock=all`, `?reset=1`, `&auto=1&mute=1`, `&perf=1`; `window.__game.answer(true|false)`.

## 10. Đã chốt (02/10/2026)

1. Bài đua: sai 3 lần ở ngã rẽ là thua; về thứ mấy không tính.
2. Thả nút chạy không bị phạt: quái chậm theo, chỉ trả lời sai mới mất tim.
3. Không có nấc dễ hơn khi thua liền; thua thì thử lại bài đó.
4. Game riêng, repo riêng, **không liên quan game 5** (chỉ copy code / model lúc dựng). Ôn lại = ôn câu sai trong chính game 6.
   Trong game chọn thế giới tự do (xem §3).

## 11. Quyết định khi dựng (02/10/2026)

- **Điều khiển**: ngoài nút 🏇, **giữ ngón tay bất kỳ đâu trên màn hình** cũng là chạy (bé 5 tuổi dễ hơn). Không đổi làn: Nhím luôn
  chạy giữa đường, người nhà 2 bên; 3 lựa chọn là 3 ngôi sao trước mặt (ngã rẽ: 2 biển trên 2 nhánh). Đang bay thì giữ đà, để bé nhấc
  tay khỏi nút chạy chạm 🪽 vẫn bay qua.
- **Mỗi câu 1 kết quả** (thay "thử tiếp cùng câu"): đúng / sai quyết định ngay hệ quả (đường tắt / bùn, né / trúng, bắn trúng / trượt),
  sai thì đọc tên cái bé vừa chạm, sao đúng sáng lên, rồi đọc đáp án ("bờ… bò", "Hai cộng ba bằng năm!", đánh vần có chữ sáng).
  Ghép tiếng 2–3 lượt chạm (chữ đầu, nguyên âm, dấu), sai lượt nào cũng chỉ tính 1 lần sai cho cả tiếng.
- **Câu chữ không hiện chữ** trên bảng / phụ đề (chỉ 👂 + 🔊), tránh bé so hình chữ thay vì nghe.
- **Ôn câu sai**: khoá câu (`L:ô`, `A:2+3`, `S:5-2`, `M:3+?=5`, `W:bà`), sai → cần đúng 2 lần nữa; mỗi bài chèn tối đa 2 câu ôn.
- **Bố cục đua**: mỗi khối = vùng hỏi (18 m) → ngã rẽ 40 m → 1 chướng ngại → khối sau; đường 620–670 m. Đo có tiếng ~2 phút / bài
  (dài hơn mục tiêu 60–90 s: ba thử rồi quyết định có rút còn 4 ngã rẽ không).
- **Bị đuổi**: quái giữ khoảng cách 4–5.6 m sau lưng (Nhím đứng thì quái đứng), camera lùi 12 m cao 6 m để thấy quái ở nửa dưới
  màn hình. Đợt kịch tính ở ~60% đường (2 câu liền).
- **Đuổi quái**: đường vòng kín (chạy mãi tới khi cứu đủ 2 bạn), quái chạy 80% tốc độ Nhím, chờ khi bỏ xa > 34 m. Bạn được cứu chạy
  theo Nhím tới hết bài. Cảnh cứu bạn: Nhím đứng lại xem.
- **Màn cuối**: Nữ hoàng bay cao hơn hàng sao đáp án để luôn thấy; 🌟 Hài Hoà (khác ❤️ tim) trên HUD; mây xếp cao / thấp hơn đường bay.
- **Ánh sáng**: mặt trời (bóng đổ) đặt chéo phía camera theo hướng đường → Nhím không bị ngược sáng ở khúc cua.
- **Quái dùng**: slime (J-Toastie), ma, yêu tinh, rồng nhỏ, rồng lớn, pháp sư, phù thuỷ (bỏ 2 slime Quaternius không dùng).
- **Đo** (headless Chrome, Mac): 150–210k tam giác, 75–145 draw call (vượt 120 một chút ở bài bị đuổi lúc đợt kịch tính có 4 quái);
  heap JS ổn định ~40 MB. Test: `scripts/test/play-all.mjs` (9 bài × đúng / sai / sai 1), `play-human.mjs` (giữ nút, chạm sao thật).

## 12. Đổi cách chơi sau khi ba thử (02/10/2026)

Ba thấy bay qua chướng ngại bằng 2 nút riêng quá khó, chốt lại:
- **Chỉ dùng bàn phím** (bé tập trung): giữ ↑ chạy, **nháy ↑ 2 lần = bay / nhảy xa** (kỹ năng có sẵn, lúc nào cũng dùng được;
  bỏ nút cánh). Chướng ngại: chậm lại rồi **dừng trước chướng ngại** chờ bé nháy ↑ 2 lần.
- **Mỗi câu hỏi là 1 ngã rẽ 2 đường** (← / →), biển đáp án ở đầu mỗi đường, cho MỌI bài trên mặt đất (đua, bị đuổi, đuổi quái);
  màn cuối là 2 vòng mây trái / phải. Bỏ 3 ngôi sao trước mặt và chạm màn hình.
- **Rẽ sai**: mất 1 tim, vào đường cụt (đá hoặc quái), người nhà gọi lại, nghe đáp án đúng, tự quay ra đi đường đúng (không chọn lại).
- Ghép tiếng: mỗi bước 1 ngã rẽ. Đuổi quái: mỗi ngã rẽ đúng = 1 phát trúng; đủ ngã rẽ cho 6 phát + 2 lần sai.
- Ngã rẽ hình chữ Y: đường chính bẻ 40° sang bên đáp án đúng rồi bẻ về; nhánh cụt bẻ ngược lại, dài 36 m, cuối có đống đá chắn
  (một nửa có quái chờ). Đường dài theo số ngã rẽ: mỗi khối = 24 m hỏi + 38 m ngã rẽ + 36 m (1 chướng ngại).
