// Cyber Bar & Dance Club — TikTok LIVE game cho cyberbar.bla.io.vn, cổng 4193
// Trang game là 1 file HTML tĩnh (public/index.html, Canvas 2D, BPM 128).
// Server Node này phục vụ trang đó + làm cầu nối TikTok LIVE thật:
//  - WebSocket cùng origin tại /ws (trang game mặc định nối tới đây, không
//    còn ws://localhost:8081 như bản gốc) — frontend gửi {type:'subscribe',
//    username, key?}, server nối tiktok-live-connector bằng username và
//    chuyển tiếp chat/gift/like/follow/share về đúng format frontend chờ:
//    {type:'chat', uniqueId, nickname, comment}
//    {type:'gift', uniqueId, nickname, giftName, repeatCount, diamondCount}
//    {type:'like', uniqueId, nickname, likeCount}
//  - /api/status để kiểm tra live, /api/tiktok/connect|disconnect và
//    /api/test/emit (giả lập sự kiện để thử sân, cần PANEL_KEY khi đã đặt).
//  - Không có mật khẩu TikTok, không cần cookie. PANEL_KEY chỉ khóa các
//    endpoint ghi / lệnh kết nối; khi chưa đặt thì mở như các game khác lúc
//    chạy local.
const express = require('express');
const { createServer } = require('node:http');
const { WebSocketServer } = require('ws');
const path = require('node:path');

const PORT = Number(process.env.PORT || 4193);
const PANEL_KEY = process.env.PANEL_KEY || '';
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', 'cyberbar.bla.io.vn']);

const app = express();
app.use(express.json());

// Chặn DNS rebinding: chỉ chấp nhận Host quen thuộc (hoặc *.bla.io.vn).
app.use((req, res, next) => {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  if (!host || ALLOWED_HOSTS.has(host) || host.endsWith('.bla.io.vn')) return next();
  return res.status(403).json({ ok: false, error: 'Host không được phép' });
});

function isAuthed(req) {
  if (!PANEL_KEY) return true;
  const h = req.headers['x-panel-key'] || '';
  const b = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return h === PANEL_KEY || b === PANEL_KEY;
}
function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  return res.status(403).json({ ok: false, error: 'Sai mật khẩu panel' });
}

const state = {
  mode: 'idle', username: '', roomId: '', viewers: 0,
  totalLikes: 0, totalGifts: 0, totalCoins: 0, lastError: '', botOn: false,
  game: 'cyber-bar',
};

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const c of wss.clients) {
    if (c.readyState === 1) { try { c.send(msg); } catch (e) {} }
  }
}
function broadcastStatus() { broadcast({ type: 'status', ...state }); }

// --- TikTok LIVE (username only) ---
let tiktok = null;
let TikTokLiveConnection = null;
try { ({ TikTokLiveConnection } = require('tiktok-live-connector')); } catch (e) { TikTokLiveConnection = null; }

async function disconnectTikTok() {
  if (tiktok) { try { await tiktok.disconnect(); } catch (e) {} tiktok = null; }
  state.mode = 'idle'; state.username = ''; state.roomId = ''; state.viewers = 0;
  broadcastStatus();
}

async function connectTikTok(username) {
  username = String(username || '').replace(/^@/, '').trim();
  if (!username) throw new Error('Thiếu username TikTok');
  if (!TikTokLiveConnection) throw new Error('Chưa cài tiktok-live-connector');
  if (tiktok) await disconnectTikTok();
  state.username = username; state.lastError = '';
  tiktok = new TikTokLiveConnection(username, {
    processInitialData: true, enableExtendedGiftInfo: true, requestPollingIntervalMs: 2000,
  });
  tiktok.on('connected', (s) => {
    state.mode = 'live'; state.roomId = String(s?.roomId || '');
    broadcastStatus();
  });
  tiktok.on('disconnected', () => { state.mode = 'idle'; broadcastStatus(); });
  tiktok.on('roomUser', (d) => { if (typeof d?.viewerCount === 'number') { state.viewers = d.viewerCount; } });
  tiktok.on('chat', (d) => {
    broadcast({ type: 'chat', uniqueId: d.uniqueId, nickname: d.nickname || d.uniqueId, comment: d.comment });
  });
  tiktok.on('gift', (d) => {
    const repeat = d.repeatCount || d.repeat_count || 1;
    const coins = (d.diamondCount || 0) * repeat;
    state.totalGifts += 1; state.totalCoins += coins;
    broadcast({
      type: 'gift', uniqueId: d.uniqueId, nickname: d.nickname || d.uniqueId,
      giftName: d.giftName || d.extendedGiftInfo?.name || 'Rose',
      giftId: d.giftId, repeatCount: repeat, diamondCount: d.diamondCount || 0,
    });
    broadcastStatus();
  });
  tiktok.on('like', (d) => {
    const n = d.likeCount || 1;
    state.totalLikes += n;
    broadcast({ type: 'like', uniqueId: d.uniqueId, nickname: d.nickname || d.uniqueId, likeCount: n });
  });
  tiktok.on('follow', (d) => {
    broadcast({ type: 'chat', uniqueId: d.uniqueId, nickname: d.nickname || d.uniqueId, comment: 'đã follow phòng ❤️' });
  });
  tiktok.on('share', (d) => {
    broadcast({ type: 'chat', uniqueId: d.uniqueId, nickname: d.nickname || d.uniqueId, comment: 'đã chia sẻ live 🔁' });
  });
  tiktok.on('member', (d) => { if (typeof d?.viewerCount === 'number') state.viewers = d.viewerCount; });
  try {
    await tiktok.connect();
    state.mode = 'live';
  } catch (e) {
    state.mode = 'idle';
    state.lastError = String(e?.message || e);
    tiktok = null;
    broadcastStatus();
    throw new Error(`Không thể kết nối với @${username}: ${state.lastError}`);
  }
  broadcastStatus();
  return { ok: true };
}

// --- API ---
app.get('/api/health', (req, res) => res.json({ ok: true, game: 'cyber-bar' }));
app.get('/api/status', (req, res) => res.json({ ...state }));

app.post('/api/tiktok/connect', requireAuth, async (req, res) => {
  try { await connectTikTok(req.body?.username); res.json({ ok: true, ...state }); }
  catch (e) { res.status(400).json({ ok: false, error: String(e?.message || e) }); }
});
app.post('/api/tiktok/disconnect', requireAuth, async (req, res) => {
  await disconnectTikTok(); res.json({ ok: true, ...state });
});

// Giả lập sự kiện để thử sân khi chưa live thật (cần PANEL_KEY nếu đã đặt).
app.post('/api/test/emit', requireAuth, (req, res) => {
  const { type, data } = req.body || {};
  if (!type || !data) return res.status(400).json({ ok: false, error: 'Thiếu type/data' });
  if (type === 'chat') broadcast({ type: 'chat', uniqueId: data.uniqueId || 'test-user', nickname: data.nickname || 'Test', comment: data.comment || 'nhay' });
  else if (type === 'gift') broadcast({ type: 'gift', uniqueId: data.uniqueId || 'test-user', nickname: data.nickname || 'Test', giftName: data.giftName || 'Rose', repeatCount: data.repeatCount || 1, diamondCount: data.diamondCount || 0 });
  else if (type === 'like') { state.totalLikes += (data.likeCount || 1); broadcast({ type: 'like', uniqueId: data.uniqueId || 'test-user', nickname: data.nickname || 'Test', likeCount: data.likeCount || 1 }); }
  else return res.status(400).json({ ok: false, error: 'type phải là chat/gift/like' });
  res.json({ ok: true });
});

// --- WebSocket /ws: trang game nối tới đây ---
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', ...state }));
  ws.on('message', async (raw) => {
    let msg = null;
    try { msg = JSON.parse(String(raw)); } catch (e) { return; }
    if (msg?.type === 'subscribe' && msg.username) {
      if (PANEL_KEY && msg.key !== PANEL_KEY) {
        ws.send(JSON.stringify({ type: 'error', message: 'Sai mật khẩu panel' }));
        return;
      }
      try { await connectTikTok(msg.username); }
      catch (e) { ws.send(JSON.stringify({ type: 'error', message: String(e?.message || e) })); }
    }
    if (msg?.type === 'unsubscribe') { await disconnectTikTok(); }
  });
});

// --- Trang game tĩnh (landscape; /stage cùng 1 trang) ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('/stage', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Cyber Bar LIVE trên cổng ${PORT} — trang game ở / , stage ở /stage, WS ở /ws`);
});
