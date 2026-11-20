const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');

const { MONGODB_URI, ADMIN_USER, ADMIN_PASS } = process.env;
if (!MONGODB_URI || !ADMIN_USER || !ADMIN_PASS) {
  console.error('MONGODB_URI, ADMIN_USER va ADMIN_PASS o\'zgaruvchilari kiritilishi shart.');
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET ||
  crypto.createHash('sha256').update(MONGODB_URI + ADMIN_PASS).digest('hex');

const app = express();
let users, animes, comments, genres, reactions, notifs, promos, tariffs, pendingRegs;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_BOT_USERNAME = 'verification_zverbot';
const ADMIN_TELEGRAM_ID = String(process.env.ADMIN_TELEGRAM_ID || '').trim();
let botReplies, payments, botSettings, telegramAdmins;

app.use(express.json({ limit: '100kb' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const wrap = (fn) => (req, res) => fn(req, res).catch(e => {
  console.error(e); res.status(500).json({ error: 'Server xatosi' });
});
const sign = (u) => jwt.sign({ id: u.id, username: u.username, role: u.role }, SECRET, { expiresIn: '30d' });

function normLogin(v) { return String(v || '').trim().toLowerCase(); }
function isOwnerAccount(u) { return !!u && (normLogin(u.lower) === normLogin(ADMIN_USER) || normLogin(u.username) === normLogin(ADMIN_USER)); }
function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  let p;
  try { p = jwt.verify(t, SECRET); } catch { return res.status(401).json({ error: 'Avval tizimga kiring' }); }
  users.findOne({ id: p.id }).then(u => {
    if (!u) return res.status(401).json({ error: 'Avval tizimga kiring' });
    req.user = { id: u.id, username: u.username, role: u.role, owner: isOwnerAccount(u), adminLevel: isOwnerAccount(u) ? 'owner' : (u.adminLevel || 'ordinary'), pro: (u.proUntil || 0) > Date.now() };
    next();
  }).catch(() => res.status(500).json({ error: 'Server xatosi' }));
}
const ownerOnly = (req, res, next) =>
  req.user.owner ? next() : res.status(403).json({ error: 'Bu amal faqat bosh admin uchun' });
const mainAdmin = (req, res, next) =>
  req.user.role === 'admin' && ['owner', 'main'].includes(req.user.adminLevel) ? next() : res.status(403).json({ error: 'Bu bo‘lim faqat bosh admin va Main Admin uchun' });
const anyAdmin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Faqat admin uchun' });
const notify = (text, to = null) => notifs.insertOne({ id: crypto.randomUUID(), text, to, created: Date.now() });
const admin = mainAdmin;

// Ro'yxatdan o'tish: Telegram bot orqali 6 xonali tasdiqlash kodi.
app.post('/api/register/start', wrap(async (req, res) => {
  if (!TELEGRAM_BOT_TOKEN) return res.status(503).json({ error: 'Telegram bot tokeni Render Environment bo‘limiga kiritilmagan.' });
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: "Login 3-20 ta harf, raqam yoki _ bo'lishi kerak" });
  if (password.length < 6) return res.status(400).json({ error: "Parol kamida 6 ta belgi bo'lishi kerak" });
  if (await users.findOne({ lower: username.toLowerCase() })) return res.status(409).json({ error: 'Bu login band' });
  const nonce = crypto.randomBytes(18).toString('hex');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await pendingRegs.deleteMany({ $or: [{ lower: username.toLowerCase() }, { expires: { $lte: Date.now() } }] });
  await pendingRegs.insertOne({ nonce, username, lower: username.toLowerCase(), hash: bcrypt.hashSync(password, 10),
    codeHash: crypto.createHash('sha256').update(code).digest('hex'), codeForBot: code, chatId: null, created: Date.now(), expires: Date.now() + 10 * 60 * 1000 });
  res.json({ ok: true, botUrl: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${nonce}` });
}));

app.post('/api/register/verify', wrap(async (req, res) => {
  const nonce = String(req.body.nonce || '');
  const code = String(req.body.code || '').trim();
  if (!/^[a-f0-9]{36}$/.test(nonce) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Tasdiqlash kodi yoki havola noto‘g‘ri.' });
  const pending = await pendingRegs.findOne({ nonce, expires: { $gt: Date.now() }, chatId: { $ne: null } });
  if (!pending) return res.status(400).json({ error: 'Avval botdagi havolani ochib Start bosing. Kod 10 daqiqa amal qiladi.' });
  const digest = crypto.createHash('sha256').update(code).digest('hex');
  if (digest !== pending.codeHash) return res.status(400).json({ error: 'Tasdiqlash kodi noto‘g‘ri.' });
  const user = { id: crypto.randomUUID(), username: pending.username, lower: pending.lower, hash: pending.hash, role: 'user', created: Date.now(), telegramChatId: pending.chatId };
  try { await users.insertOne(user); }
  catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'Bu login band' }); throw e; }
  await pendingRegs.deleteOne({ nonce });
  if (TELEGRAM_BOT_TOKEN && ADMIN_TELEGRAM_ID) {
    telegramSend(ADMIN_TELEGRAM_ID, `🆕 Yangi foydalanuvchi ro‘yxatdan o‘tdi\nLogin: ${user.username}\nJami foydalanuvchilar: ${await users.countDocuments({ role: 'user' })}`).catch(e => console.error('Admin xabari yuborilmadi:', e.message));
  }
  res.json({ token: sign(user), user: { username: user.username, role: 'user' } });
}));

app.post('/api/login', wrap(async (req, res) => {
  const name = String(req.body.username || '').toLowerCase();
  const user = await users.findOne({ lower: name });
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.hash))
    return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
  res.json({ token: sign(user), user: { username: user.username, role: user.role } });
}));

app.get('/api/me', auth, wrap(async (req, res) => {
  const u = await users.findOne({ id: req.user.id });
  if (!u) return res.status(401).json({ error: 'Avval tizimga kiring' });
  res.json({ username: u.username, role: u.role, favs: u.favs || [], owner: isOwnerAccount(u), adminLevel: isOwnerAccount(u) ? 'owner' : (u.adminLevel || 'ordinary'), proUntil: u.proUntil || null, pro: (u.proUntil || 0) > Date.now() });
}));

app.get('/api/anime', auth, wrap(async (req, res) => {
  const full = req.user.owner || req.user.role === 'admin' || req.user.pro;
  const all = await animes.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).toArray();
  res.json(all.map(a => full ? a : { ...a,
    video: a.videoPro ? '' : a.video, locked: !!(a.videoPro && a.video),
    episodes: (a.episodes || []).map(e => e.pro ? { ...e, video: '', locked: true } : e) }));
}));

const isUrl = (s) => /^https?:\/\//i.test(s);
const isVideoRef = (s) => isUrl(s) || /^bunny:[a-f0-9-]{30,40}$/i.test(String(s || ''));
const bunnyConfig = () => ({
  apiKey: process.env.BUNNY_STREAM_API_KEY,
  libraryId: process.env.BUNNY_STREAM_LIBRARY_ID,
  tokenKey: process.env.BUNNY_STREAM_TOKEN_KEY,
});

// Admin videoni Bunny Stream'ga to'g'ridan-to'g'ri yuklashi uchun vaqtinchalik TUS ruxsati.
app.post('/api/videos/upload-init', auth, admin, wrap(async (req, res) => {
  const { apiKey, libraryId } = bunnyConfig();
  if (!apiKey || !libraryId) return res.status(503).json({ error: 'Video xotirasi sozlanmagan. Bunny Stream kalitlarini serverga kiriting.' });
  const title = String(req.body.title || 'Yangi dars').trim().slice(0, 160);
  const created = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: { AccessKey: apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const video = await created.json().catch(() => ({}));
  if (!created.ok || !video.guid) {
    console.error('Bunny video create failed:', video);
    return res.status(502).json({ error: 'Bunny Stream video yaratolmadi. API kaliti va Library ID ni tekshiring.' });
  }
  const expirationTime = Math.floor(Date.now() / 1000) + 86400;
  const signature = crypto.createHash('sha256')
    .update(`${libraryId}${apiKey}${expirationTime}${video.guid}`).digest('hex');
  res.json({ videoId: video.guid, libraryId, expirationTime, signature });
}));

// Faqat tizimga kirgan, shu darsni ko'rishga huquqi bor foydalanuvchiga qisqa muddatli player tokeni.
app.get('/api/videos/:videoId/play', auth, wrap(async (req, res) => {
  const { libraryId, tokenKey } = bunnyConfig();
  if (!libraryId || !tokenKey) return res.status(503).json({ error: 'Himoyalangan video ko‘rish sozlanmagan.' });
  const videoId = String(req.params.videoId || '');
  if (!/^[a-f0-9-]{30,40}$/i.test(videoId)) return res.status(400).json({ error: 'Video ID noto‘g‘ri.' });
  const marker = 'bunny:' + videoId;
  const course = await animes.findOne({ $or: [{ video: marker }, { 'episodes.video': marker }] });
  if (!course) return res.status(404).json({ error: 'Video kursga biriktirilmagan yoki topilmadi.' });
  const episode = (course.episodes || []).find(e => e.video === marker);
  const needsPro = episode ? !!episode.pro : !!course.videoPro;
  if (needsPro && !req.user.owner && req.user.role !== 'admin' && !req.user.pro)
    return res.status(403).json({ error: 'Bu dars faqat Pro obunachilar uchun.' });
  const expires = Math.floor(Date.now() / 1000) + 300;
  const token = crypto.createHash('sha256').update(`${tokenKey}${videoId}${expires}`).digest('hex');
  res.json({ url: `https://player.mediadelivery.net/embed/${libraryId}/${videoId}?token=${token}&expires=${expires}` });
}));

app.post('/api/anime', auth, admin, wrap(async (req, res) => {
  const b = req.body;
  const a = {
    id: crypto.randomUUID(), created: Date.now(),
    title: String(b.title || '').trim().slice(0, 120),
    description: String(b.description || '').trim().slice(0, 2000),
    genre: String(b.genre || '').trim().slice(0, 80),
    year: parseInt(b.year) || null,
    poster: String(b.poster || '').trim(),
    video: String(b.video || '').trim(),
  };
  a.videoPro = false;
  if (!a.title) return res.status(400).json({ error: 'Nomini kiriting' });
  if (a.poster && !isUrl(a.poster)) return res.status(400).json({ error: 'Poster havolasi http(s) bilan boshlanishi kerak' });
  if (a.video && !isVideoRef(a.video)) return res.status(400).json({ error: 'YouTube video havolasini tekshiring' });
  a.episodes = a.video ? [{ id: crypto.randomUUID(), title: '1-qism', video: a.video, order: 1, pro: !!b.videoPro, views: 0 }] : [];
  await animes.insertOne(a);
  await notify("Yangi kurs qo'shildi: " + a.title);
  res.json({ ok: true });
}));

app.delete('/api/anime/:id', auth, mainAdmin, wrap(async (req, res) => {
  await animes.deleteOne({ id: req.params.id });
  await comments.deleteMany({ animeId: req.params.id });
  res.json({ ok: true });
}));

function cleanEp(b) {
  const title = String(b.title || '').trim().slice(0, 120);
  const video = String(b.video || '').trim();
  if (!title || !isVideoRef(video)) return { error: 'Dars nomi va video havolasi yoki yuklangan video kerak' };
  const order = parseInt(b.order);
  return { v: { title, video, order: Number.isFinite(order) ? order : null, pro: !!b.pro } };
}
app.post('/api/anime/:id/episodes', auth, admin, wrap(async (req, res) => {
  const ep = cleanEp(req.body);
  if (ep.error) return res.status(400).json({ error: ep.error });
  const a = await animes.findOneAndUpdate({ id: req.params.id }, { $push: { episodes: { id: crypto.randomUUID(), views: 0, ...ep.v } } });
  if (a) await notify('"' + a.title + '" kursiga yangi dars: ' + ep.v.title);
  res.json({ ok: true });
}));
app.put('/api/anime/:id/episodes/:eid', auth, admin, wrap(async (req, res) => {
  const ep = cleanEp(req.body);
  if (ep.error) return res.status(400).json({ error: ep.error });
  await animes.updateOne({ id: req.params.id, 'episodes.id': req.params.eid },
    { $set: { 'episodes.$.title': ep.v.title, 'episodes.$.video': ep.v.video, 'episodes.$.order': ep.v.order, 'episodes.$.pro': ep.v.pro } });
  res.json({ ok: true });
}));
app.post('/api/anime/:id/episodes/:eid/view', auth, wrap(async (req, res) => {
  await animes.updateOne({ id: req.params.id, 'episodes.id': req.params.eid }, { $inc: { 'episodes.$.views': 1 } });
  res.json({ ok: true });
}));
app.delete('/api/anime/:id/episodes/:eid', auth, mainAdmin, wrap(async (req, res) => {
  await animes.updateOne({ id: req.params.id }, { $pull: { episodes: { id: req.params.eid } } });
  res.json({ ok: true });
}));

app.post('/api/anime/:id/fav', auth, wrap(async (req, res) => {
  const u = await users.findOne({ id: req.user.id });
  const has = (u.favs || []).includes(req.params.id);
  await users.updateOne({ id: req.user.id }, has ? { $pull: { favs: req.params.id } } : { $addToSet: { favs: req.params.id } });
  res.json({ favs: (await users.findOne({ id: req.user.id })).favs || [] });
}));

app.get('/api/anime/:id/comments', auth, wrap(async (req, res) => {
  res.json(await comments.find({ animeId: req.params.id }, { projection: { _id: 0 } }).sort({ created: -1 }).limit(100).toArray());
}));
app.post('/api/anime/:id/comments', auth, wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: "Izoh bo'sh bo'lmasin" });
  await comments.insertOne({ id: crypto.randomUUID(), animeId: req.params.id, userId: req.user.id, username: req.user.username, text, created: Date.now() });
  res.json({ ok: true });
}));
app.delete('/api/comments/:cid', auth, wrap(async (req, res) => {
  const c = await comments.findOne({ id: req.params.cid });
  if (!c) return res.json({ ok: true });
  if (c.userId !== req.user.id && !(req.user.role === 'admin' && ['owner', 'main'].includes(req.user.adminLevel))) return res.status(403).json({ error: "Ruxsat yo'q" });
  await comments.deleteOne({ id: c.id });
  res.json({ ok: true });
}));

app.post('/api/anime/:id/view', auth, wrap(async (req, res) => {
  await animes.updateOne({ id: req.params.id }, { $inc: { views: 1 } });
  res.json({ ok: true });
}));
app.put('/api/anime/:id', auth, mainAdmin, wrap(async (req, res) => {
  const b = req.body;
  const set = {
    title: String(b.title || '').trim().slice(0, 120),
    description: String(b.description || '').trim().slice(0, 2000),
    genre: String(b.genre || '').trim().slice(0, 80),
    year: parseInt(b.year) || null,
    poster: String(b.poster || '').trim(),
    video: String(b.video || '').trim(),
  };
  set.videoPro = false;
  if (!set.title) return res.status(400).json({ error: 'Nomini kiriting' });
  if (set.poster && !isUrl(set.poster)) return res.status(400).json({ error: 'Poster havolasi http(s) bilan boshlanishi kerak' });
  if (set.video && !isVideoRef(set.video)) return res.status(400).json({ error: 'YouTube video havolasini tekshiring' });
  const existing = await animes.findOne({ id: req.params.id });
  if (!existing) return res.status(404).json({ error: 'Kurs topilmadi' });
  const eps = existing.episodes || [];
  if (set.video) {
    if (eps.length) {
      eps[0].video = set.video;
      eps[0].pro = !!b.videoPro;
      if (!eps[0].title) eps[0].title = '1-qism';
      if (eps[0].order == null) eps[0].order = 1;
    } else {
      eps.push({ id: crypto.randomUUID(), title: '1-qism', video: set.video, order: 1, pro: !!b.videoPro, views: 0 });
    }
  } else if (eps.length && eps[0].title === '1-qism') {
    eps.shift();
  }
  set.episodes = eps;
  await animes.updateOne({ id: req.params.id }, { $set: set });
  res.json({ ok: true });
}));

// Admin panel
app.get('/api/admin/stats', auth, anyAdmin, wrap(async (req, res) => {
  const [u, a, c] = await Promise.all([users.countDocuments(), animes.countDocuments(), comments.countDocuments()]);
  const pro = await users.countDocuments({ proUntil: { $gt: Date.now() } });
  const all = await animes.find({}, { projection: { _id: 0 } }).toArray();
  const rx = {};
  for (const r of await reactions.find({}).toArray()) { const k = r.animeId + ':' + r.ep; (rx[k] = rx[k] || { l: 0, d: 0 })[r.v > 0 ? 'l' : 'd']++; }
  const views = all.reduce((n, x) => n + (x.views || 0), 0);
  const courses = all.sort((x, y) => (y.views || 0) - (x.views || 0)).map(x => ({ id: x.id, title: x.title, views: x.views || 0,
    lessons: (x.episodes || []).map(e => { const r = rx[x.id + ':' + e.id] || {}; return { title: e.title, views: e.views || 0, pro: !!e.pro, likes: r.l || 0, dislikes: r.d || 0 }; }) }));
  res.json({ users: u, anime: a, comments: c, views, pro, courses });
}));
app.get('/api/admin/users', auth, mainAdmin, wrap(async (req, res) => {
  const list = await users.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).toArray();
  res.json(list.map(u => ({ id: u.id, username: u.username, role: u.role, created: u.created || null, favs: (u.favs || []).length, owner: isOwnerAccount(u), adminLevel: isOwnerAccount(u) ? 'owner' : (u.adminLevel || 'ordinary'), proUntil: u.proUntil || null })));
}));
app.post('/api/admin/users', auth, ownerOnly, wrap(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: "Login 3-20 ta harf, raqam yoki _ bo'lishi kerak" });
  if (password.length < 8) return res.status(400).json({ error: "Admin paroli kamida 8 ta belgi bo'lsin" });
  try {
    await users.insertOne({ id: crypto.randomUUID(), username, lower: username.toLowerCase(),
      hash: bcrypt.hashSync(password, 10), role: 'admin', adminLevel: 'ordinary', created: Date.now() });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Bu login band' });
    throw e;
  }
  res.json({ ok: true });
}));
app.post('/api/admin/users/:id/role', auth, ownerOnly, wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "O'zingizning huquqingizni o'zgartira olmaysiz" });
  const role = req.body.role === 'admin' ? 'admin' : 'user';
  const adminLevel = role === 'admin' && req.body.adminLevel === 'main' ? 'main' : 'ordinary';
  await users.updateOne({ id: req.params.id }, { $set: { role, adminLevel } });
  res.json({ ok: true });
}));
app.delete('/api/admin/users/:id', auth, ownerOnly, wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "O'zingizni o'chira olmaysiz" });
  const target = await users.findOne({ id: req.params.id });
  if (!target) return res.json({ ok: true });
  if (isOwnerAccount(target)) return res.status(403).json({ error: "Bosh adminni o'chirib bo'lmaydi" });
  if (target.role === 'admin' && !req.user.owner) return res.status(403).json({ error: "Adminlarni faqat bosh admin o'chira oladi" });
  await users.deleteOne({ id: req.params.id });
  await comments.deleteMany({ userId: req.params.id });
  res.json({ ok: true });
}));
app.get('/api/admin/comments', auth, mainAdmin, wrap(async (req, res) => {
  const cs = await comments.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).limit(100).toArray();
  const titles = Object.fromEntries((await animes.find({}, { projection: { _id: 0, id: 1, title: 1 } }).toArray()).map(a => [a.id, a.title]));
  res.json(cs.map(c => ({ ...c, anime: titles[c.animeId] || '(o\'chirilgan)' })));
}));

app.get('/api/genres', auth, wrap(async (req, res) => {
  res.json(await genres.find({}, { projection: { _id: 0, lower: 0 } }).sort({ name: 1 }).toArray());
}));
app.post('/api/genres', auth, mainAdmin, wrap(async (req, res) => {
  const name = String(req.body.name || '').replace(/,/g, ' ').trim().slice(0, 30);
  if (!name) return res.status(400).json({ error: 'Janr nomini kiriting' });
  try { await genres.insertOne({ id: crypto.randomUUID(), name, lower: name.toLowerCase() }); }
  catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'Bu janr allaqachon bor' }); throw e; }
  res.json({ ok: true });
}));
app.delete('/api/genres/:id', auth, mainAdmin, wrap(async (req, res) => {
  await genres.deleteOne({ id: req.params.id });
  res.json({ ok: true });
}));

app.get('/api/anime/:id/reactions', auth, wrap(async (req, res) => {
  const out = {};
  for (const r of await reactions.find({ animeId: req.params.id }).toArray()) {
    const o = out[r.ep] || (out[r.ep] = { like: 0, dislike: 0, mine: 0 });
    if (r.v > 0) o.like++; else o.dislike++;
    if (r.userId === req.user.id) o.mine = r.v;
  }
  res.json(out);
}));
app.post('/api/anime/:id/react', auth, wrap(async (req, res) => {
  const v = Math.sign(Number(req.body.v)) || 0;
  const f = { animeId: req.params.id, ep: String(req.body.ep || 'main'), userId: req.user.id };
  if (v === 0) await reactions.deleteOne(f); else await reactions.updateOne(f, { $set: { v } }, { upsert: true });
  res.json({ ok: true });
}));

app.get('/api/notifications', auth, wrap(async (req, res) => {
  const u = await users.findOne({ id: req.user.id });
  const seen = u.notifSeen || 0;
  const items = await notifs.find({ $or: [{ to: null }, { to: req.user.id }], created: { $gte: u.created || 0 } }, { projection: { _id: 0 } })
    .sort({ created: -1 }).limit(30).toArray();
  res.json({ items: items.map(n => ({ ...n, unread: n.created > seen })), unread: items.filter(n => n.created > seen).length });
}));
app.post('/api/notifications/seen', auth, wrap(async (req, res) => {
  await users.updateOne({ id: req.user.id }, { $set: { notifSeen: Date.now() } });
  res.json({ ok: true });
}));

const DAY = 86400000;
app.post('/api/admin/users/:id/pro', auth, mainAdmin, wrap(async (req, res) => {
  const days = Math.max(0, Math.min(3650, parseInt(req.body.days) || 0));
  const u = await users.findOne({ id: req.params.id });
  if (!u) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  const until = days ? Math.max(Date.now(), u.proUntil || 0) + days * DAY : null;
  await users.updateOne({ id: u.id }, { $set: { proUntil: until } });
  await notify(days ? 'Sizga Pro obuna berildi: ' + new Date(until).toISOString().slice(0, 10) + ' gacha' : 'Pro obunangiz bekor qilindi', u.id);
  res.json({ ok: true });
}));
app.get('/api/admin/promos', auth, mainAdmin, wrap(async (req, res) => {
  res.json(await promos.find({}, { projection: { _id: 0, usedBy: 0 } }).sort({ created: -1 }).toArray());
}));
app.post('/api/admin/promos', auth, mainAdmin, wrap(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30)
    || crypto.randomBytes(4).toString('hex').toUpperCase();
  const days = Math.max(1, Math.min(3650, parseInt(req.body.days) || 30));
  const maxUses = Math.max(1, Math.min(100000, parseInt(req.body.maxUses) || 1));
  try { await promos.insertOne({ id: crypto.randomUUID(), code, days, maxUses, used: 0, usedBy: [], created: Date.now() }); }
  catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'Bu promo kod allaqachon bor' }); throw e; }
  res.json({ ok: true, code });
}));
app.delete('/api/admin/promos/:id', auth, mainAdmin, wrap(async (req, res) => {
  await promos.deleteOne({ id: req.params.id });
  res.json({ ok: true });
}));
app.post('/api/promo/redeem', auth, wrap(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const p = await promos.findOneAndUpdate(
    { code, usedBy: { $ne: req.user.id }, $expr: { $lt: ['$used', '$maxUses'] } },
    { $inc: { used: 1 }, $push: { usedBy: req.user.id } });
  if (!p) return res.status(400).json({ error: "Promo kod noto'g'ri, ishlatilgan yoki tugagan" });
  const u = await users.findOne({ id: req.user.id });
  const until = Math.max(Date.now(), u.proUntil || 0) + p.days * DAY;
  await users.updateOne({ id: u.id }, { $set: { proUntil: until } });
  res.json({ ok: true, proUntil: until, days: p.days });
}));

app.post('/api/notifications', auth, admin, wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ error: 'Xabar matnini yozing' });
  await notifs.insertOne({ id: crypto.randomUUID(), text, to: null, by: req.user.username, created: Date.now() });
  res.json({ ok: true });
}));
app.delete('/api/notifications/:id', auth, admin, wrap(async (req, res) => {
  const n = await notifs.findOne({ id: req.params.id });
  if (!n) return res.json({ ok: true });
  if (!req.user.owner && n.by !== req.user.username) return res.status(403).json({ error: "Faqat o'zingiz yuborgan xabarni o'chira olasiz" });
  await notifs.deleteOne({ id: n.id });
  res.json({ ok: true });
}));

app.get('/api/plans', auth, wrap(async (req, res) => {
  res.json(await tariffs.find({}, { projection: { _id: 0 } }).sort({ days: 1 }).toArray());
}));
app.post('/api/admin/plans', auth, mainAdmin, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 40);
  const price = String(req.body.price || '').trim().slice(0, 40);
  const days = Math.min(3650, parseInt(req.body.days) || 0);
  if (!name || !price || days < 1) return res.status(400).json({ error: 'Tarif nomi, narxi va muddatini (kun) kiriting' });
  await tariffs.insertOne({ id: crypto.randomUUID(), name, price, days, desc: String(req.body.desc || '').trim().slice(0, 200), created: Date.now() });
  res.json({ ok: true });
}));
app.delete('/api/admin/plans/:id', auth, mainAdmin, wrap(async (req, res) => {
  await tariffs.deleteOne({ id: req.params.id });
  res.json({ ok: true });
}));

let telegramOffset = 0;
let telegramPolling = false;
const USER_MENU = { keyboard: [[{ text: '💎 Pro obuna olish' }], [{ text: '📩 Adminga murojaat' }, { text: '❓ Yordam' }]], resize_keyboard: true };
const OWNER_MENU = { keyboard: [[{ text: '🛠 Admin paneli' }, { text: '📊 Statistika' }], [{ text: '💳 To‘lov sozlamalari' }, { text: '💎 Tariflar' }], [{ text: '📢 E’lon yuborish' }], [{ text: '💎 Pro obuna olish' }, { text: '📩 Adminga murojaat' }]], resize_keyboard: true };
const MAIN_MENU = { keyboard: [[{ text: '📊 Statistika' }, { text: '👥 Foydalanuvchilar' }], [{ text: '💳 To‘lov sozlamalari' }, { text: '💎 Tariflar' }], [{ text: '📢 E’lon yuborish' }], [{ text: '💎 Pro obuna olish' }, { text: '📩 Adminga murojaat' }]], resize_keyboard: true };
const ORDINARY_MENU = { keyboard: [[{ text: '📊 Statistika' }], [{ text: '💎 Pro obuna olish' }, { text: '📩 Adminga murojaat' }], [{ text: '❓ Yordam' }]], resize_keyboard: true };

async function getBotRole(chatId) {
  if (ADMIN_TELEGRAM_ID && String(chatId) === ADMIN_TELEGRAM_ID) return 'owner';
  const a = await telegramAdmins.findOne({ chatId: String(chatId), active: true });
  return a?.level || 'user';
}
function botMenu(role) { return role === 'owner' ? OWNER_MENU : role === 'main' ? MAIN_MENU : role === 'ordinary' ? ORDINARY_MENU : USER_MENU; }
const OWNER_PANEL = { inline_keyboard: [[{ text: '➕ Main Admin qo‘shish', callback_data: 'adm:addmain' }], [{ text: '➕ Oddiy Admin qo‘shish', callback_data: 'adm:addordinary' }], [{ text: '👥 Adminlar ro‘yxati', callback_data: 'adm:list' }], [{ text: '➖ Adminni o‘chirish', callback_data: 'adm:remove' }]] };

async function telegramApi(method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(`Telegram ${method} xatosi: ${data.description || r.status}`);
  return data.result;
}
async function telegramSend(chatId, text, extra = {}) {
  return telegramApi('sendMessage', { chat_id: chatId, text, ...extra });
}
function displayTelegramUser(from) {
  return from.username ? '@' + from.username : (from.first_name || 'Telegram foydalanuvchisi');
}
async function showBotPlans(chatId) {
  const linked = await users.findOne({ telegramChatId: String(chatId) });
  if (!linked) {
    await telegramSend(chatId, 'Pro obuna olish uchun avval saytda ro‘yxatdan o‘ting va Telegram hisobingizni bot orqali tasdiqlang.', { reply_markup: USER_MENU });
    return;
  }
  const list = await tariffs.find({}).sort({ days: 1 }).toArray();
  if (!list.length) {
    await telegramSend(chatId, 'Hozircha obuna tariflari mavjud emas. Keyinroq urinib ko‘ring.', { reply_markup: USER_MENU });
    return;
  }
  const keyboard = list.map(p => [{ text: `${p.name} — ${p.price}`, callback_data: `buyplan:${p.id}` }]);
  await telegramApi('sendMessage', { chat_id: chatId, text: '💎 Pro obuna tariflaridan birini tanlang:', reply_markup: { inline_keyboard: keyboard } });
}

async function pollTelegram() {
  if (!TELEGRAM_BOT_TOKEN || telegramPolling) return;
  telegramPolling = true;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?timeout=25&offset=${telegramOffset}`);
    const data = await r.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        telegramOffset = update.update_id + 1;
        if (update.callback_query) {
          const q = update.callback_query;
          const adminChat = String(q.message?.chat?.id || '');
          const callbackRole = await getBotRole(adminChat);
          if (String(q.data || '').startsWith('adm:')) {
            if (callbackRole !== 'owner') {
              await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Faqat Owner boshqaradi.' });
              continue;
            }
            const action = q.data.split(':')[1];
            if (action === 'addmain' || action === 'addordinary' || action === 'remove') {
              const state = action === 'addmain' ? 'addmain' : action === 'addordinary' ? 'addordinary' : 'remove';
              await botSettings.updateOne({ key: 'adminAction', chatId: adminChat }, { $set: { value: state, updated: Date.now() } }, { upsert: true });
              const prompt = action === 'addmain' ? 'Main Admin qilinadigan odamning Telegram ID raqamini yuboring.' : action === 'addordinary' ? 'Oddiy Admin qilinadigan odamning Telegram ID raqamini yuboring.' : 'Adminlikdan olinadigan odamning Telegram ID raqamini yuboring.';
              await telegramSend(adminChat, prompt);
            } else if (action === 'list') {
              const list = await telegramAdmins.find({ active: true }).toArray();
              await telegramSend(adminChat, '👥 Adminlar ro‘yxati\n\n' + (list.map(a => `${a.level === 'main' ? 'Main Admin' : 'Oddiy Admin'} — ${a.chatId}`).join('\n') || 'Hozircha qo‘shimcha admin yo‘q.'));
            }
            await telegramApi('answerCallbackQuery', { callback_query_id: q.id });
            continue;
          }
          const isAdminCallback = ['owner', 'main'].includes(callbackRole);
          if (isAdminCallback && /^(payok|payno):/.test(q.data || '')) {
            const [action, paymentId] = q.data.split(':');
            const payment = await payments.findOne({ id: paymentId, status: 'pending' });
            if (!payment) {
              await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Bu to‘lov allaqachon ko‘rib chiqilgan.' });
              continue;
            }
            if (action === 'payok') {
              const plan = await tariffs.findOne({ id: payment.planId });
              const days = Number(payment.days || plan?.days || 0);
              if (!days) {
                await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Tarif muddati topilmadi.' });
                continue;
              }
              let code;
              for (let i = 0; i < 5; i++) {
                code = 'PRO-' + crypto.randomBytes(5).toString('hex').toUpperCase();
                try {
                  await promos.insertOne({ id: crypto.randomUUID(), code, days, maxUses: 1, used: 0, usedBy: [], created: Date.now(), source: 'telegram-payment' });
                  break;
                } catch (e) { if (e.code !== 11000 || i === 4) throw e; }
              }
              await payments.updateOne({ id: paymentId, status: 'pending' }, { $set: { status: 'approved', promoCode: code, reviewed: Date.now() } });
              await telegramSend(payment.chatId, `✅ To‘lovingiz tasdiqlandi!

Tarif: ${payment.planName}
Muddat: ${days} kun

🎟 Promo-kodingiz: ${code}

Saytga kirib Obuna bo‘limida kodni faollashtiring. Kod faqat bir marta ishlatiladi.`, { reply_markup: USER_MENU });
              await telegramApi('editMessageReplyMarkup', { chat_id: adminChat, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
              await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Tasdiqlandi, promo-kod yuborildi.' });
            } else {
              await payments.updateOne({ id: paymentId, status: 'pending' }, { $set: { status: 'rejected', reviewed: Date.now() } });
              await telegramSend(payment.chatId, '❌ To‘lov chekingiz rad etildi. Iltimos, chekni va to‘lov summasini tekshirib, qayta yuboring yoki adminga murojaat qiling.', { reply_markup: USER_MENU });
              await telegramApi('editMessageReplyMarkup', { chat_id: adminChat, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
              await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'To‘lov rad etildi.' });
            }
          } else {
            const [kind, planId] = String(q.data || '').split(':');
            if (kind === 'buyplan') {
              const chatId = String(q.message?.chat?.id || '');
              const user = await users.findOne({ telegramChatId: chatId });
              const plan = await tariffs.findOne({ id: planId });
              if (!user || !plan) {
                await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Hisob yoki tarif topilmadi.' });
                continue;
              }
              const setting = await botSettings.findOne({ key: 'paymentDetails' });
              const payment = { id: crypto.randomUUID(), userId: user.id, username: user.username, chatId, planId: plan.id, planName: plan.name, price: plan.price, days: plan.days, status: 'waiting_receipt', created: Date.now() };
              await payments.insertOne(payment);
              const details = setting?.value || 'To‘lov rekvizitlari hozircha sozlanmagan. Adminga murojaat qiling.';
              await telegramSend(chatId, `📦 Tanlangan tarif: ${plan.name}
💰 Narxi: ${plan.price}
⏳ Muddati: ${plan.days} kun

💳 To‘lov ma’lumotlari:
${details}

To‘lovni amalga oshirgach, chekni skrinshot yoki rasm ko‘rinishida shu chatga yuboring.`, { reply_markup: USER_MENU });
              await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Tarif tanlandi.' });
            }
          }
          continue;
        }

        const msg = update.message;
        if (!msg || !msg.chat) continue;
        const chatId = String(msg.chat.id);
        const text = String(msg.text || msg.caption || '').trim();
        const botRole = await getBotRole(chatId);
        const isAdmin = botRole !== 'user';
        const isManager = ['owner', 'main'].includes(botRole);

        if (botRole === 'owner' && text === '🛠 Admin paneli') {
          await telegramSend(chatId, '🛠 Boshqaruv paneli\nKerakli amalni tugma orqali tanlang:', { reply_markup: OWNER_PANEL });
          continue;
        }
        const adminAction = botRole === 'owner' ? await botSettings.findOne({ key: 'adminAction', chatId, value: { $in: ['addmain', 'addordinary', 'remove'] } }) : null;
        if (adminAction && text) {
          const targetId = text.trim();
          if (!/^\d+$/.test(targetId) || targetId === ADMIN_TELEGRAM_ID) {
            await telegramSend(chatId, 'Telegram ID noto‘g‘ri. Raqamli ID yuboring.');
            continue;
          }
          if (adminAction.value === 'remove') {
            await telegramAdmins.updateOne({ chatId: targetId }, { $set: { active: false, updated: Date.now() } });
            await telegramSend(chatId, `✅ ${targetId} adminlikdan olindi.`);
          } else {
            await telegramAdmins.updateOne({ chatId: targetId }, { $set: { chatId: targetId, level: adminAction.value, active: true, addedBy: chatId, updated: Date.now() } }, { upsert: true });
            await telegramSend(chatId, `✅ ${targetId} ${adminAction.value === 'main' ? 'Main Admin' : 'Oddiy Admin'} qilindi.`);
          }
          await botSettings.updateOne({ key: 'adminAction', chatId }, { $set: { value: null, updated: Date.now() } });
          continue;
        }

        if (isManager && (text === '💳 To‘lov sozlamalari' || text === '/setpayment')) {
          await botSettings.updateOne({ key: 'waitingPaymentDetails' }, { $set: { value: true } }, { upsert: true });
          await telegramSend(chatId, 'To‘lov rekvizitlarini (karta raqami, qabul qiluvchi va izoh) bitta xabar qilib yuboring.');
          continue;
        }
        if (isManager && text && await botSettings.findOne({ key: 'waitingPaymentDetails', value: true })) {
          await botSettings.updateOne({ key: 'paymentDetails' }, { $set: { value: text, updated: Date.now() } }, { upsert: true });
          await botSettings.updateOne({ key: 'waitingPaymentDetails' }, { $set: { value: false } });
          await telegramSend(chatId, '✅ To‘lov rekvizitlari saqlandi.');
          continue;
        }

        if (!isAdmin && ((msg.photo && msg.photo.length) || (msg.document && String(msg.document.mime_type || '').startsWith('image/')))) {
          const pendingPayment = await payments.findOne({ chatId, status: 'waiting_receipt' }, { sort: { created: -1 } });
          if (pendingPayment) {
            if (!ADMIN_TELEGRAM_ID) {
              await telegramSend(chatId, 'Admin ID sozlanmagan. Keyinroq urinib ko‘ring.');
              continue;
            }
            const caption = `🧾 PRO OBUNA TO‘LOVI
Foydalanuvchi: ${pendingPayment.username}
Tarif: ${pendingPayment.planName}
Narx: ${pendingPayment.price}
Muddat: ${pendingPayment.days} kun
ID: ${pendingPayment.id}`;
            const copied = await telegramApi('copyMessage', { chat_id: ADMIN_TELEGRAM_ID, from_chat_id: chatId, message_id: msg.message_id, caption, reply_markup: { inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: `payok:${pendingPayment.id}` }, { text: '❌ Rad etish', callback_data: `payno:${pendingPayment.id}` }]] } });
            await payments.updateOne({ id: pendingPayment.id }, { $set: { status: 'pending', adminMessageId: copied.message_id, receiptAt: Date.now() } });
            await telegramSend(chatId, '✅ Chekingiz adminga yuborildi. Tekshirilgach, natija shu botga keladi.', { reply_markup: USER_MENU });
          } else {
            await telegramSend(chatId, 'Avval 💎 Pro obuna olish bo‘limidan tarif tanlang.');
          }
          continue;
        }

        if (text === '/id') {
          await telegramSend(chatId, `Telegram ID raqamingiz: ${chatId}`);
          continue;
        }

        if (isAdmin && msg.reply_to_message) {
          const link = await botReplies.findOne({ adminMessageId: msg.reply_to_message.message_id });
          if (link) {
            await telegramSend(link.userChatId, `💬 Adminning javobi:\n\n${text}`, { reply_markup: USER_MENU });
            await telegramSend(chatId, '✅ Javob foydalanuvchiga anonim tarzda yuborildi.');
            continue;
          }
        }

        if (text.startsWith('/start')) {
          const match = text.match(/^\/start\s+([a-f0-9]{36})$/i);
          if (match) {
            const pending = await pendingRegs.findOne({ nonce: match[1], expires: { $gt: Date.now() } });
            if (!pending) {
              await telegramSend(chatId, 'Bu tasdiqlash havolasi eskirgan. Saytga qaytib, qaytadan ro‘yxatdan o‘tishni boshlang.', { reply_markup: USER_MENU });
              continue;
            }
            const actual = pending.codeForBot || null;
            if (!actual) {
              await telegramSend(chatId, 'Kod yuborilmadi. Sayt orqali qaytadan ro‘yxatdan o‘tishni boshlang.', { reply_markup: USER_MENU });
              continue;
            }
            await pendingRegs.updateOne({ nonce: pending.nonce }, { $set: { chatId } });
            const usernameText = displayTelegramUser(msg.from || {});
            await telegramSend(chatId, `Assalomu alaykum! 👋\n\nTelegram foydalanuvchisi: ${usernameText}\n\nSaytingiz uchun tasdiqlash kodingiz: ${actual}`, { reply_markup: botMenu(botRole) });
            continue;
          }
          if (/^\/start\s+pro$/i.test(text)) {
            await showBotPlans(chatId);
            continue;
          }
          await telegramSend(chatId, 'Assalomu alaykum! 👋\n\nVerification botiga xush kelibsiz. Quyidagi menyudan kerakli bo‘limni tanlang.', { reply_markup: botMenu(botRole) });
          continue;
        }

        if (isAdmin && (text === '📊 Statistika' || text === '/stats')) {
          const total = await users.countDocuments({ role: 'user' });
          const admins = await users.countDocuments({ role: 'admin' });
          const pending = await pendingRegs.countDocuments({ expires: { $gt: Date.now() } });
          await telegramSend(chatId, `📊 Bot statistikasi\n\n👥 Ro‘yxatdan o‘tgan foydalanuvchilar: ${total}\n🛡 Adminlar: ${admins}\n⏳ Kutilayotgan tasdiqlashlar: ${pending}`, { reply_markup: botMenu(botRole) });
          continue;
        }
        if (text === '📊 Statistika' || text === '/stats') {
          await telegramSend(chatId, 'Statistikani faqat bot administratori ko‘ra oladi.', { reply_markup: botMenu(botRole) });
          continue;
        }

        if (text === '💎 Pro obuna olish' || text === '/plans') {
          await showBotPlans(chatId);
          continue;
        }

        if (text === '❓ Yordam' || text === '/help') {
          await telegramSend(chatId, '❓ Yordam\n\n• Saytda ro‘yxatdan o‘tish uchun saytdagi maxsus Telegram havolasini oching.\n• Bot yuborgan 6 xonali kodni saytdagi tasdiqlash oynasiga kiriting.\n• Muammo bo‘lsa, “📩 Adminga murojaat” bo‘limidan xabar yuboring.', { reply_markup: botMenu(botRole) });
          continue;
        }

        if (text === '📩 Adminga murojaat' || text === '/contact') {
          await botReplies.updateOne({ userChatId: chatId }, { $set: { waitingForMessage: true, updated: Date.now() } }, { upsert: true });
          await telegramSend(chatId, '✉️ Xabaringizni shu yerga yozib yuboring. Men uni adminga anonim tarzda yetkazaman.', { reply_markup: USER_MENU });
          continue;
        }

        const contactState = await botReplies.findOne({ userChatId: chatId, waitingForMessage: true });
        if (contactState) {
          if (!ADMIN_TELEGRAM_ID) {
            await telegramSend(chatId, 'Hozircha admin manzili sozlanmagan. Keyinroq urinib ko‘ring.', { reply_markup: USER_MENU });
            continue;
          }
          const forwarded = await telegramSend(ADMIN_TELEGRAM_ID,
            `📩 Yangi anonim murojaat\nFoydalanuvchi: ${displayTelegramUser(msg.from || {})}\nChat ID: ${chatId}\n\nXabar:\n${text}\n\nJavob berish uchun shu xabarga Reply qiling.`);
          await botReplies.updateOne({ userChatId: chatId }, { $set: { waitingForMessage: false, lastAdminMessageId: forwarded.message_id, updated: Date.now() } });
          await botReplies.insertOne({ adminMessageId: forwarded.message_id, userChatId: chatId, created: Date.now() });
          await telegramSend(chatId, '✅ Xabaringiz adminga yuborildi. Javob kelganda shu bot orqali anonim tarzda olasiz.', { reply_markup: USER_MENU });
          continue;
        }

        if (isAdmin) {
          await telegramSend(chatId, 'Admin menyusi. Kerakli bo‘limni tanlang.', { reply_markup: botMenu(botRole) });
        } else {
          await telegramSend(chatId, 'Menyudan bo‘lim tanlang. Ro‘yxatdan o‘tish kodini olish uchun saytdagi maxsus havolani oching.', { reply_markup: USER_MENU });
        }
      }
    }
  } catch (e) { console.error('Telegram bot:', e.message); }
  finally { telegramPolling = false; setTimeout(pollTelegram, 1000); }
}

(async () => {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('animexona');
  users = db.collection('users');
  animes = db.collection('anime');
  comments = db.collection('comments');
  genres = db.collection('genres');
  reactions = db.collection('reactions');
  notifs = db.collection('notifs');
  promos = db.collection('promos');
  tariffs = db.collection('tariffs');
  pendingRegs = db.collection('pendingRegs');
  botReplies = db.collection('botReplies');
  payments = db.collection('payments');
  botSettings = db.collection('botSettings');
  telegramAdmins = db.collection('telegramAdmins');
  await telegramAdmins.createIndex({ chatId: 1 }, { unique: true });
  await pendingRegs.createIndex({ nonce: 1 }, { unique: true });
  await botReplies.createIndex({ adminMessageId: 1 });
  await botReplies.createIndex({ userChatId: 1 });
  await payments.createIndex({ id: 1 }, { unique: true });
  await payments.createIndex({ chatId: 1, status: 1, created: -1 });
  await promos.createIndex({ code: 1 }, { unique: true });
  await genres.createIndex({ lower: 1 }, { unique: true });
  const meta = db.collection('meta');
  if (!(await meta.findOne({ k: 'genres' }))) {
    await meta.insertOne({ k: 'genres' });
    for (const n of ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Samuray'])
      await genres.updateOne({ lower: n.toLowerCase() }, { $setOnInsert: { id: crypto.randomUUID(), name: n, lower: n.toLowerCase() } }, { upsert: true });
  }
  if (!(await meta.findOne({ k: 'cats-v2' }))) {
    await meta.insertOne({ k: 'cats-v2' });
    await genres.deleteMany({ lower: { $in: ['action', 'adventure', 'comedy', 'drama', 'fantasy', 'romance', 'sci-fi', 'samuray'] } });
    for (const n of ['Python', 'JavaScript', 'Web dasturlash', 'Mobil ilovalar', "Ma'lumotlar bazasi", 'Algoritmlar', "Sun'iy intellekt", "Boshlang'ich"])
      await genres.updateOne({ lower: n.toLowerCase() }, { $setOnInsert: { id: crypto.randomUUID(), name: n, lower: n.toLowerCase() } }, { upsert: true });
  }
  await users.createIndex({ lower: 1 }, { unique: true });
  await users.updateOne(
    { lower: normLogin(ADMIN_USER) },
    { $set: { username: ADMIN_USER, lower: normLogin(ADMIN_USER), hash: bcrypt.hashSync(ADMIN_PASS, 10), role: 'admin', adminLevel: 'owner' },
      $setOnInsert: { id: crypto.randomUUID() } },
    { upsert: true }
  );
  app.listen(process.env.PORT || 3000, () => {
    console.log('Sayt ishga tushdi');
    if (TELEGRAM_BOT_TOKEN) {
      if (!ADMIN_TELEGRAM_ID) console.warn('ADMIN_TELEGRAM_ID kiritilmagan: admin xabarlari va anonim murojaatlar ishlamaydi.');
      pollTelegram();
    } else console.warn('TELEGRAM_BOT_TOKEN kiritilmagan: Telegram tasdiqlash o‘chiq.');
  });
})().catch(e => { console.error('Bazaga ulanib bo\'lmadi:', e.message); process.exit(1); });
