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
const { createHash } = require('node:crypto');
const path = require('node:path');

const TTS_VOICE = process.env.TTS_VOICE || 'vi-VN-HoaiMyNeural'; // nữ, hợp MC sàn nhảy

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
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)panel_auth=([a-f0-9]{64})/);
  const h = req.headers['x-panel-key'] || '';
  const b = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return (Boolean(m) && m[1] === createHash('sha256').update('panel:' + PANEL_KEY).digest('hex')) || h === PANEL_KEY || b === PANEL_KEY;
}
function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  return res.status(403).json({ ok: false, error: 'Sai mật khẩu panel' });
}

// Đăng nhập panel: đúng PANEL_KEY thì đặt cookie 30 ngày.
app.post('/api/login', (req, res) => {
  const key = String(req.body?.key || '');
  if (!PANEL_KEY) return res.json({ ok: true });
  if (!key || key !== PANEL_KEY) return res.status(403).json({ ok: false, error: 'Sai mật khẩu' });
  const token = createHash('sha256').update('panel:' + key).digest('hex');
  res.setHeader('Set-Cookie', `panel_auth=${token}; Path=/; Max-Age=${30 * 24 * 3600}; HttpOnly; SameSite=Lax`);
  return res.json({ ok: true });
});
app.get('/api/me', (req, res) => res.json({ ok: true, authed: isAuthed(req), needsSetup: !PANEL_KEY }));

const state = {
  mode: 'idle', username: '', roomId: '', viewers: 0,
  totalLikes: 0, totalGifts: 0, totalCoins: 0, lastError: '', botOn: false,
  game: 'cyber-bar', soundOn: false, demo: true, voiceOn: true,
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

// --- Giọng đọc cảm ơn khi tặng quà (Edge TTS tiếng Việt, giọng nữ) ---
// Stage gọi /api/tts?text=... rồi phát file MP3. Không cần auth vì stage
// (OBS, không có mật khẩu) cũng phải gọi được. Cache câu đã đọc để khỏi
// gọi Edge lại cho cùng một câu.
let MsEdgeTTS = null, OUTPUT_FORMAT = null;
try { ({ MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts')); } catch (e) { MsEdgeTTS = null; }
function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
async function edgeTts(text) {
  if (!MsEdgeTTS) throw new Error('Chưa cài msedge-tts');
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(text), { rate: '+8%', pitch: '+4%' });
    const chunks = [];
    const read = (async () => { for await (const c of audioStream) chunks.push(c); })();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Edge TTS timeout')), 20000));
    await Promise.race([read, timeout]);
    if (chunks.length === 0) throw new Error('Edge TTS không trả âm thanh');
    return Buffer.concat(chunks);
  } finally {
    try { tts.close(); } catch (e) {}
  }
}
const ttsCache = new Map();
app.get('/api/tts', async (req, res) => {
  try {
    const text = String(req.query.text || '').trim().slice(0, 200);
    if (!text) return res.status(400).send('Thiếu text');
    let audio = ttsCache.get(text);
    if (!audio) {
      audio = await edgeTts(text);
      ttsCache.set(text, audio);
      if (ttsCache.size > 200) ttsCache.delete(ttsCache.keys().next().value);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(audio);
  } catch (err) {
    console.error('TTS lỗi:', err && err.message ? err.message : err);
    res.status(503).send('Không đọc được giọng lúc này');
  }
});
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

// Điều khiển stage từ panel: bật/tắt tiếng + bật/tắt bot Demo
// (gửi tới mọi stage đang mở qua WS; live thật thì bot tự tắt).
app.post('/api/control', requireAuth, (req, res) => {
  const action = req.body?.action;
  if (action === 'soundOn') { state.soundOn = true; broadcast({ type: 'soundOn' }); }
  else if (action === 'soundOff') { state.soundOn = false; broadcast({ type: 'soundOff' }); }
  else if (action === 'demoOn') { state.demo = true; broadcast({ type: 'demoOn' }); }
  else if (action === 'demoOff') { state.demo = false; broadcast({ type: 'demoOff' }); }
  else if (action === 'voiceOn') { state.voiceOn = true; broadcast({ type: 'voiceOn' }); }
  else if (action === 'voiceOff') { state.voiceOn = false; broadcast({ type: 'voiceOff' }); }
  else return res.status(400).json({ ok: false, error: 'action phải là soundOn/soundOff/demoOn/demoOff/voiceOn/voiceOff' });
  broadcastStatus();
  res.json({ ok: true, ...state });
});

// --- Trang game tĩnh: / là panel điều khiển, /stage là sàn dọc 9:16 ---
// (Đăng ký trước express.static để / không bị index.html của game chiếm.)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'panel.html')));
app.get('/stage', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/game', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(express.static(path.join(__dirname, 'public')));

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Cyber Bar LIVE trên cổng ${PORT} — panel ở / , stage 9:16 ở /stage, WS ở /ws`);
});
