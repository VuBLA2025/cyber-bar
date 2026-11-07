# Cyber Bar & Dance Club — TikTok LIVE game mới

Game sàn nhảy Cyber Bar: Canvas 2D, BPM 128, Hype Meter / Fever Mode, spotlight
zoom khi tặng quà, leaderboard + chat. Chạy riêng ở **cyberbar.bla.io.vn**,
cổng **4193**, không chạm tới Sàn Vui cũ ở sanvui.bla.io.vn.

## Nguồn

- File gốc do user gửi: 1 file HTML tĩnh 112K
  (`tiktok_live_cyber_bar_dance_club_game_s_n_nh_y_t_ng_t_c.html`, 2863 dòng).
  Bản gốc chỉ chạy Demo (bot giả lập) và chờ WebSocket ở `ws://localhost:8081`,
  không có server đi kèm.
- Bộ này giữ nguyên file game, chỉ vá 2 chỗ (xem `public/index.html`, bản gốc
  giữ ở `public/index.original.html` — file này KHÔNG đưa lên GitHub):
  1. WebSocket mặc định đổi sang cùng origin `/ws` (wss khi https), ô nhập
     WS trong modal cũng tự điền sẵn URL đó.
  2. Modal kết nối thêm ô "Mật khẩu panel" (gửi kèm `subscribe` khi server
     đã đặt `PANEL_KEY`).
- Luật quà trong file game là cố định theo loại (không theo xu thật):
  Rose 10 xu, Heart 50, Cap/Kính & Mũ 99, Champagne 299, Fireworks 1088,
  Galaxy 1000, Lion 29999 — spotlight 4.5–7.5s theo tổng xu. Lệnh chat:
  `nhay/dance/quay`, `uong/drink/bia/ruou`, `nhaylen/jump`, `xoay/spin`,
  `123zo/cheers/zo`, `dj` lên bàn DJ.
- **Layout là bản ngang (landscape), KHÔNG phải 9:16 dọc** như stage các game
  kia. Đưa vào OBS dọc TikTok LIVE sẽ bị cắt khung — dùng nguồn trình duyệt
  ngang hoặc để khung 16:9.

## Stack

- Node 20 + Express + `ws` + `tiktok-live-connector` 2.5.0 (giống Sàn Vui 3D).
- `server.js`: phục vụ trang ở `/` và `/stage` (cùng 1 trang), WS ở `/ws`,
  `/api/status`, `/api/health`, `POST /api/tiktok/connect|disconnect`,
  `POST /api/test/emit` (chat/gift/like, cần `PANEL_KEY` khi đã đặt).
- Kết nối TikTok bằng username, không cần mật khẩu/cookie. Follow/share được
  chuyển thành chat "đã follow phòng ❤️" / "đã chia sẻ live 🔁".
- Không lưu state bền: tắt container là đếm lại từ đầu (likes/gifts/viewers
  chỉ trong RAM). Không có nhạc MP3 — nhạc nền là WebAudio synth trong file
  game, bật sau 1 lần chạm (autoplay block) như các game khác.

## Kết quả test local (2026-11-07, PORT=4193, PANEL_KEY=test)

8/8 đạt, server test đã dừng, không mật khẩu test nào còn trong file repo:

- `/` 200, `/stage` 200, title đúng "TikTok Live Cyber Bar & Dance Club"
- `/api/status` 200 JSON `{mode:'idle', game:'cyber-bar', ...}`
- `/api/health` 200 `{ok:true}`
- `POST /api/test/emit` không key 403, đúng key 200
- `POST /api/tiktok/connect` username giả → 400 thân thiện
  ("Failed to retrieve Room ID from all sources")
- WS `/ws`: open → nhận `status` → subscribe username giả → nhận `error`
  thân thiện, server không crash

## Deploy (chờ repo GitHub)

1. User tạo repo trống **`VuBLA2025/cyber-bar`** trên GitHub và chọn repo này
   trong GitHub App installation của Muse (mẫu như Lớp Học Chữ / Đi Chùa).
2. Push bộ này lên repo, nhánh `main` (file text qua GitHub connector;
   không có file nhị phân nên không cần upload qua trình duyệt).
3. Tạo project **`Cyber Bar LIVE`** + compose **`cyber-bar`** trên Dokploy
   (sourceType github, owner VuBLA2025, repo cyber-bar, branch main,
   composePath `./docker-compose.yml`, domain `cyberbar.bla.io.vn` port 4193,
   **nhớ bật `https: true` ngay khi tạo domain** — mặc định qua API là
   `false`), env `PANEL_KEY` (mật khẩu panel do đệ tạo, đưa cho user trong
   chat, KHÔNG ghi vào file repo).
4. Sau `compose.create` phải `compose.update` đặt `githubId` =
   `0-f_X4vn1CYb3EnTqIaQo` (id GitHub chung của instance, giống Lớp Học /
   Đi Chùa / Đám Cưới) rồi mới `compose.deploy` — nếu không deploy lỗi ngay
   vì compose mới có `githubId` null. Dùng **`compose.deploy`**, KHÔNG dùng
   `compose.redeploy` (redeploy rebuild từ composeFile cũ).
5. Theo dõi deployment tới `done` rồi kiểm tra live:
   - https://cyberbar.bla.io.vn/ — game Cyber Bar (Demo tự quẩy khi chưa nối)
   - https://cyberbar.bla.io.vn/stage — cùng trang game (dùng làm nguồn OBS)
   - https://cyberbar.bla.io.vn/api/status — JSON `{mode:'idle',...}`
   - Mở modal 🔗, nhập username TikTok + mật khẩu panel, bấm Kết Nối.

- Deploy 1 lỗi ngay sau ~4s (status error, không có errorMessage): nguyên
  nhân là `docker-compose.yml` lúc đầu chỉ ghi `image: cyber-bar:1.0.0` mà
  không có mục `build:` — Dokploy không có image nào để pull. Bài học:
  compose build từ GitHub PHẢI có `build: {context: ., dockerfile:
  Dockerfile}` như Lớp Học Chữ / Đi Chùa (Sàn Vui 3D không có vì chưa bao
  giờ deploy từ GitHub). Đã sửa file, push lại, deploy lại.
- Trạng thái deploy 2026-11-07 — ĐANG DEPLOY LẠI (sau khi sửa build).

- Kết nối TikTok LIVE thật, quà/chat/like thật chạy vào game, nhạc + hiệu
  ứng nghe/nhìn bằng mắt trên live thật.
- Hiển thị trên OBS khổ ngang trong TikTok LIVE Studio.
