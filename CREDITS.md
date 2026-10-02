# Ghi công tài nguyên

Nhân vật My Little Pony là IP của Hasbro; các model pony là fan-made trên Sketchfab (CC BY 4.0).
**Chỉ chơi trong nhà, không publish, không bán.** Model pony copy từ `../05-pony-story/public/models` (đã giảm lưới ở game 5).

## Pony (Sketchfab, CC BY 4.0)

| File | Vai trong game | Tên model | Tác giả | Link |
|---|---|---|---|---|
| models/twilight_static/ | Nhím = Twilight Sparkle | Twilight Sparkle | royalroyaltymodel112 | https://sketchfab.com/3d-models/twilight-sparkle-5f56454bf21446939962cb5a3de55fc5 |
| models/ponies/rarity.glb | Mẹ Yến = Rarity (đua cùng) | Rarity | royalroyaltymodel112 | https://sketchfab.com/3d-models/rarity-243600fe8ad04ff382162b54640a323b |
| models/ponies/rainbow.glb | Ba Cường = Rainbow Dash (đua cùng) | Rainbowdash | royalroyaltymodel112 | https://sketchfab.com/3d-models/rainbowdash-ff9edb048bda425eb154fce4f30ed1e6 |
| models/ponies/applejack.glb | Ông Cương = Applejack (đua cùng) | Applejack | royalroyaltymodel112 | https://sketchfab.com/3d-models/applejack-9ca45b45ddd440bf8a7afbd6077d60b0 |
| models/ponies/celestia.glb | Bà Tuyết = Celestia (đua cùng) | Princess Celestia (MLP) | VV2006 | https://sketchfab.com/3d-models/princess-celestia-mlp-34f9c62251e04e889192c72207a0a7b1 |
| models/ponies/luna.glb | Bác Hanh = Luna (sau màn cuối, đua cùng) | Princess Luna (MLP) | VV2006 | https://sketchfab.com/3d-models/princess-luna-mlp-df4812a692e943d3bbf232cb6a44af62 |
| models/ponies/nightmare.glb | Nữ hoàng Bóng Đêm (màn cuối) | Nightmare Moon (MLP) | VV2006 | https://sketchfab.com/3d-models/nightmare-moon-mlp-72e6242c89fa47c588d6ab113ba99fce |
| models/friends/pinkie.glb, fluttershy.glb | bạn được cứu (thế giới 2) | Pinkie Pie / Fluttershy | royalroyaltymodel112 | https://sketchfab.com/3d-models/pinkie-pie-04c68b7f14ca4ff0b6b3688c14ba52a0 · https://sketchfab.com/3d-models/fluttershy-a8272dbdcfa44439a97e1885836545fd |
| models/friends/cadance.glb | bạn được cứu (thế giới 4) | My Little Pony Gameloft Cyber Princess Cadance | PRIZMA | https://sketchfab.com/3d-models/my-little-pony-gameloft-cyber-princess-cadance-ee4a3498c44649c1a249eb3ddfd1a771 |
| models/friends/rainbowswirl.glb | Cầu Vồng (bạn được cứu, thế giới 4, OC) | MLP inspired | procyonlotor | https://sketchfab.com/3d-models/mlp-inspired-62082b40500740e1bf14449b5f004f79 |

Ảnh chân dung `public/img/portraits/*.png` chụp lại từ chính các model trên (copy từ game 5).

## Quái dễ thương bị bóng tối nhập (poly.pizza)

| File | Dùng ở | Tên | Tác giả | Giấy phép | Link |
|---|---|---|---|---|---|
| models/monsters/slime_enemy_j_toastie.glb | 1-2 (đuổi) | Slime Enemy | **J-Toastie** | **CC-BY 3.0** (ghi công) | https://poly.pizza/m/SW5h0gbCtq |
| models/monsters/ghost_quaternius.glb | 1-2, 3-2 (đuổi) | Ghost | Quaternius | CC0 | https://poly.pizza/m/Iip30bDHmu |
| models/monsters/goblin_quaternius.glb | 2-2 (chạy trước, giữ bạn) | Goblin | Quaternius | CC0 | https://poly.pizza/m/OdCOFSmEhl |
| models/monsters/dragon_quaternius.glb | 2-2 (chạy trước, giữ bạn) | Dragon | Quaternius | CC0 | https://poly.pizza/m/VBvzjFIYws |
| models/monsters/dragon_evolved_quaternius.glb | 3-2 (đuổi) | Dragon Evolved | Quaternius | CC0 | https://poly.pizza/m/LlwD0QNUPj |
| models/monsters/animated_wizard_quaternius.glb | 4-2 (chạy trước, giữ bạn) | Animated Wizard | **Quaternius** | **CC-BY 3.0** (ghi công) | https://poly.pizza/m/kttbFvCl2C |
| models/monsters/witch_quaternius.glb | 4-2 (chạy trước, giữ bạn) | Witch | **Quaternius** | **CC-BY 3.0** (ghi công) | https://poly.pizza/m/QBEOV9ZUT8 |

## Cảnh

- Kenney Nature Kit (cây, nấm, hoa, cỏ, đá, gốc cây, khúc gỗ, hàng rào, bí ngô, ngô, lúa, tượng đá…): **CC0**,
  https://kenney.nl/assets/nature-kit — `public/models/props/`, đổi màu pastel theo thế giới lúc tải (src/scenery.ts).
- Nhà làng, cây táo, pha lê, cụm mây, tháp lâu đài, đống rơm, hàng rào cây, cầu vồng, vòng mây, chim, bướm (emoji): dựng bằng code.

## Âm thanh, chữ

- Giọng đọc: Microsoft Edge TTS — **Hoài My** (`vi-VN-HoaiMyNeural`), **Nam Minh** (`vi-VN-NamMinhNeural`), tên riêng tiếng Anh
  đọc bằng Jenny / Ana / Guy (en-US), qua gói `edge-tts`. Sinh 1 lần, dùng cá nhân trong nhà. 173 câu trùng chữ + giọng với game 5
  được copy sang thay vì sinh lại.
- Hiệu ứng âm (chạm, ngọc, bay, vấp, phép…): tổng hợp bằng WebAudio trong `src/audio.ts`, không dùng file.
- Font: Baloo 2 (Google Fonts, SIL OFL). Emoji: font hệ thống (Apple Color Emoji).
- Ảnh thật của Nhím / người nhà (`public/photos/`, `public/family/`): ảnh gia đình, KHÔNG đưa lên git.
