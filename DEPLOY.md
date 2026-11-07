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
- **Bố cục từ 2026-11-07: dọc 9:16 + panel riêng** — `/` là trang điều
  khiển (`public/panel.html`: đăng nhập `PANEL_KEY`, kết nối TikTok, trạng
  thái live, bật/tắt tiếng stage, thử chat/quà/like, link stage 540×960),
  `/stage` là sàn dọc 9:16 (`public/index.html` + class `stage-916` khi mở
  ở `/stage`: header gọn + hype meter xuống hàng 2, canvas sàn nhảy ở
  trên, sidebar BXH/chat xuống dưới chiếm 34%, ẩn toolbar thử quà và nút
  nhạc/kết nối/OBS; stage tự mở WS `/ws` ở chế độ chỉ-nghe — live thì tắt
  bot Demo, hết live thì Demo chạy lại; có nút “Chạm để bật tiếng game”
  và nhận lệnh bật/tắt tiếng từ panel qua WS). Xem thêm mục thay đổi bên
  dưới.

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
- Trạng thái deploy 2026-11-07 — **ĐÃ LIVE**:
  - Repo: `VuBLA2025/cyber-bar`, nhánh `main`, commit `f7ec486` (10 file)
    + `b6d7281` (sửa docker-compose thêm `build:`).
  - Dokploy: project `Cyber Bar LIVE` (`eNOcqXkuv8T982biX5P87`,
    environment production `SXn9bPMePFiJ0DUpCTtsm`), compose `cyber-bar`
    (`s0OUHmxqeDtbZPFGjHGRR`, sourceType github, repo VuBLA2025/cyber-bar
    nhánh main, composePath `./docker-compose.yml`, `githubId`
    `0-f_X4vn1CYb3EnTqIaQo`, `PANEL_KEY` đã đặt trong env), domain
    `cyberbar.bla.io.vn` (`PC-ceXONBVqCkpaqrHERs`, port 4193, https:true,
    Let's Encrypt).
  - Deploy 2: `fHgsYP65b8uvbdpEmt-SB` status `done` 2026-11-07 ~11:35 UTC.
  - **LIVE: https://cyberbar.bla.io.vn/ — kiểm chứng cùng ngày:** `/` 200
    đúng title, `/stage` 200, `/api/status` 200 JSON (`mode:'idle',
    game:'cyber-bar'`), `/api/health` 200, test/emit không key 403 / đúng
    key 200, WS `wss://cyberbar.bla.io.vn/ws` bắt tay 101 + nhận frame
    `status` ngay. 8 game còn lại kiểm tra cùng lúc vẫn 200.
  - Lưu ý: test WS bằng node `ws` trực tiếp từ VM này timeout — do VM
    không có egress trực tiếp cho client WS (không qua proxy), không phải
    lỗi server; curl qua proxy bắt tay 101 bình thường.

## Thay đổi 2026-11-07 — dọc 9:16 + panel riêng (CHƯA deploy)

- `public/index.html` (game): thêm CSS `body.stage-916` (khung
  `min(100vw, 100dvh*9/16)` căn giữa nền đen, `main` thành cột, canvas
  trên + sidebar dưới 34%, ẩn `#bottom-controls`/`#obs-hint`/nút nhạc,
  kết nối, OBS, hype meter xuống hàng 2) + JS stage mode (`IS_STAGE`
  khi pathname `/stage`: thêm class, nút `#stage-sound-btn` chạm 1 lần
  để bật tiếng + resume AudioContext, `connectStageListenWS()` mở WS
  `/ws` chỉ-nghe: live → tắt Demo, idle → Demo chạy lại, nhận
  `soundOn`/`soundOff` từ panel). Vị trí vũ công vốn đã tỉ lệ theo
  `cw`/`ch` nên canvas dọc vẫn đúng, không cần sửa engine vẽ.
- `public/panel.html` (mới): trang điều khiển ở `/` — đăng nhập
  `PANEL_KEY` (cookie 30 ngày + `x-panel-key`, lưu sessionStorage),
  trạng thái live poll `/api/status` 2s, kết nối/ngắt TikTok, bật/tắt
  tiếng stage, thử chat/quà/like, link stage + nút sao chép.
- `server.js`: thêm `POST /api/login`, `GET /api/me` (cookie
  `panel_auth` sha256), `POST /api/control` (`soundOn`/`soundOff`,
  cần auth, broadcast WS + lưu `state.soundOn` để stage mới mở cũng
  biết); route `/` → panel, `/stage` + `/game` → game (đăng ký trước
  `express.static` để `/` không bị `index.html` của game chiếm).
- Test local (PORT=4193, PANEL_KEY=test): `/` ra panel, `/stage` ra
  game có `stage-916`, login sai 403 / đúng 200 + cookie, `/api/me`
  theo cookie, control không key 403 / đúng key 200 + `soundOn:true`
  trong `/api/status`.
- Xem stage live bằng mắt (browser, 2026-11-07 ~18:47): khung dọc 9:16
  đúng (canvas trên + BXH/chat dưới), header + hype meter + Fever
  chạy tốt, toolbar thử quà đã ẩn, panel đủ mục và nút bị khóa đúng khi
  chưa đăng nhập. Lỗi nhỏ thấy được: tên vũ công chồng nhau khi
  spotlight (chưa sửa — do code vẽ gốc), hàng thống kê cuối sidebar bị
  cắt (đã sửa bằng `min-height:0`), lúc mới mở chớp qua layout ngang
  1 thoáng (đã sửa bằng script thêm class ngay khi `<body>` mở), nút
  bật tiếng không hiện vì `soundOn` đang BẬT do test trước đó (đã sửa:
  nút chỉ ẩn khi nhạc chạy thật, deploy mới reset `soundOn` về TẮT).
- Thêm sau đó, cùng đợt deploy này: **nút tắt/mở bot Demo ở panel**
  (`/api/control` demoOn/demoOff, stage nghe qua WS, live thật tự tắt)
  và **giọng đọc cảm ơn khi tặng quà** (Edge TTS `vi-VN-HoaiMyNeural`
  qua `/api/tts` mới, hàng đợi + chờ 6s/câu, quà ≥ 299 xu chen hàng,
  nút bật/tắt giọng ở panel, `voiceOn` trong `/api/status`).

## Checklist áp dụng cho bản demo HTML sau này (đại ca dặn 2026-11-07)

Khi đại ca đưa bản demo mới bằng file HTML, bổ sung đủ các chức năng này
trước khi deploy (đừng chỉ đưa file tĩnh lên):

1. **Server bridge Node** (Express + `ws` + `tiktok-live-connector`):
   WS cùng origin `/ws` (không `localhost:8081`), `/api/status`,
   `/api/login` + `/api/me` (cookie `PANEL_KEY`), `/api/tiktok/connect` /
   `disconnect`, `/api/test/emit` (chat/gift/like), `/api/control`
   (sound/demo/voice), `/api/tts`.
2. **Stage dọc 9:16** ở `/stage` (nguồn OBS 540×960): class `stage-916`
   thêm ngay khi `<body>` mở (khỏi chớp layout ngang lúc mới tải);
   canvas sàn trên + sidebar BXH/chat dưới 34% (`min-height:0` để hàng
   thống kê cuối không bị cắt); ẩn toolbar thử quà; stage tự mở WS
   chế độ chỉ-nghe.
3. **Trang điều khiển riêng** ở `/`: đăng nhập `PANEL_KEY`, trạng thái
   live (poll 2s), kết nối TikTok, bật/tắt tiếng stage, thử chat/quà/like,
   link stage + sao chép.
4. **Bot Demo tắt/mở được từ panel** (mặc định BẬT; live thật tự tắt;
   hết live chạy lại theo nút panel).
5. **Giọng đọc cảm ơn khi tặng quà**: Edge TTS `vi-VN-HoaiMyNeural` qua
   `/api/tts` (cache câu đã đọc); stage hàng đợi tối đa 3 câu + chờ
   6 giây/câu, quà ≥ 299 xu chen hàng; nút bật/tắt giọng ở panel.
6. **Nhạc nền + tiếng**: nút “Chạm để bật tiếng game” trên stage chỉ ẩn
   khi nhạc đang chạy thật (còn `suspended` thì vẫn hiện để chạm lại).
7. **Deploy bền**: repo GitHub + `docker-compose.yml` PHẢI có mục
   `build:` (không thì Dokploy lỗi sau ~4s vì không có image để pull),
   `githubId` `0-f_X4vn1CYb3EnTqIaQo`, domain `https:true`, dùng
   `compose.deploy` (không `compose.redeploy`).

## Chưa kiểm chứng

- Kết nối TikTok LIVE thật, quà/chat/like thật chạy vào game, nhạc + hiệu
  ứng nghe/nhìn bằng mắt trên live thật.
- Hiển thị trên OBS khổ dọc 9:16 trong TikTok LIVE Studio.
