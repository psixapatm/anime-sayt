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

app.use(express.json({ limit: '100kb' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const wrap = (fn) => (req, res) => fn(req, res).catch(e => {
  console.error(e); res.status(500).json({ error: 'Server xatosi' });
});
const sign = (u) => jwt.sign({ id: u.id, username: u.username, role: u.role }, SECRET, { expiresIn: '30d' });

function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  let p;
  try { p = jwt.verify(t, SECRET); } catch { return res.status(401).json({ error: 'Avval tizimga kiring' }); }
  users.findOne({ id: p.id }).then(u => {
    if (!u) return res.status(401).json({ error: 'Avval tizimga kiring' });
    req.user = { id: u.id, username: u.username, role: u.role, owner: u.lower === ADMIN_USER.toLowerCase(), pro: (u.proUntil || 0) > Date.now() };
    next();
  }).catch(() => res.status(500).json({ error: 'Server xatosi' }));
}
const ownerOnly = (req, res, next) =>
  req.user.owner ? next() : res.status(403).json({ error: 'Bu amal faqat bosh admin uchun' });
const notify = (text, to = null) => notifs.insertOne({ id: crypto.randomUUID(), text, to, created: Date.now() });
const admin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Faqat admin uchun' });

// Telegram orqali ro'yxatdan o'tishni boshlash
app.post('/api/register/start', wrap(async (req, res) => {
  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(503).json({ error: 'Telegram bot tokeni Render Environment bo‘limiga kiritilmagan.' });
  }

  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "Login 3-20 ta harf, raqam yoki _ bo'lishi kerak" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Parol kamida 6 ta belgi bo'lishi kerak" });
  }

  if (await users.findOne({ lower: username.toLowerCase() })) {
    return res.status(409).json({ error: 'Bu login band' });
  }

  const nonce = crypto.randomBytes(18).toString('hex');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

  await pendingRegs.deleteMany({
    $or: [
      { lower: username.toLowerCase() },
      { expires: { $lte: Date.now() } }
    ]
  });

  await pendingRegs.insertOne({
    nonce,
    username,
    lower: username.toLowerCase(),
    hash: bcrypt.hashSync(password, 10),
    codeHash: crypto.createHash('sha256').update(code).digest('hex'),
    codeForBot: code,
    chatId: null,
    created: Date.now(),
    expires: Date.now() + 10 * 60 * 1000
  });

  res.json({
    ok: true,
    botUrl: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${nonce}`
  });
}));

// Telegramdan kelgan kodni tekshirish va akkaunt yaratish
app.post('/api/register/verify', wrap(async (req, res) => {
  const nonce = String(req.body.nonce || '');
  const code = String(req.body.code || '').trim();

  if (!/^[a-f0-9]{36}$/.test(nonce) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Tasdiqlash kodi yoki havola noto‘g‘ri.' });
  }

  const pending = await pendingRegs.findOne({
    nonce,
    expires: { $gt: Date.now() },
    chatId: { $ne: null }
  });

  if (!pending) {
    return res.status(400).json({
      error: 'Avval botdagi havolani ochib Start bosing. Kod 10 daqiqa amal qiladi.'
    });
  }

  const digest = crypto.createHash('sha256').update(code).digest('hex');

  if (digest !== pending.codeHash) {
    return res.status(400).json({ error: 'Tasdiqlash kodi noto‘g‘ri.' });
  }

  const user = {
    id: crypto.randomUUID(),
    username: pending.username,
    lower: pending.lower,
    hash: pending.hash,
    role: 'user',
    created: Date.now(),
    telegramChatId: pending.chatId
  };

  try {
    await users.insertOne(user);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ error: 'Bu login band' });
    }
    throw e;
  }

  await pendingRegs.deleteOne({ nonce });

  res.json({
    token: sign(user),
    user: { username: user.username, role: 'user' }
  });
}));

// Kirish
app.post('/api/login', wrap(async (req, res) => {
  const name = String(req.body.username || '').toLowerCase();
  const user = await users.findOne({ lower: name });

  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.hash)) {
    return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
  }

  res.json({
    token: sign(user),
    user: { username: user.username, role: user.role }
  });
}));

app.get('/api/me', auth, wrap(async (req, res) => {
  const u = await users.findOne({ id: req.user.id });
  if (!u) return res.status(401).json({ error: 'Avval tizimga kiring' });

  res.json({
    username: u.username,
    role: u.role,
    favs: u.favs || [],
    owner: u.lower === ADMIN_USER.toLowerCase(),
    proUntil: u.proUntil || null,
    pro: (u.proUntil || 0) > Date.now()
  });
}));

app.get('/api/anime', auth, wrap(async (req, res) => {
  const full = req.user.owner || req.user.role === 'admin' || req.user.pro;
  const all = await animes.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).toArray();

  res.json(all.map(a => full ? a : {
    ...a,
    video: a.videoPro ? '' : a.video,
    locked: !!(a.videoPro && a.video),
    episodes: (a.episodes || []).map(e => e.pro ? { ...e, video: '', locked: true } : e)
  }));
}));

const isUrl = (s) => /^https?:\/\//i.test(s);
const isVideoRef = (s) => isUrl(s) || /^bunny:[a-f0-9-]{30,40}$/i.test(String(s || ''));

const bunnyConfig = () => ({
  apiKey: process.env.BUNNY_STREAM_API_KEY,
  libraryId: process.env.BUNNY_STREAM_LIBRARY_ID,
  tokenKey: process.env.BUNNY_STREAM_TOKEN_KEY,
});

// Video yuklash uchun mavjud server yo'li
app.post('/api/videos/upload-init', auth, admin, wrap(async (req, res) => {
  const { apiKey, libraryId } = bunnyConfig();

  if (!apiKey || !libraryId) {
    return res.status(503).json({
      error: 'Video xotirasi sozlanmagan. Bunny Stream kalitlarini serverga kiriting.'
    });
  }

  const title = String(req.body.title || 'Yangi dars').trim().slice(0, 160);

  const created = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: {
      AccessKey: apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  });

  const video = await created.json().catch(() => ({}));

  if (!created.ok || !video.guid) {
    console.error('Bunny video create failed:', video);
    return res.status(502).json({
      error: 'Bunny Stream video yaratolmadi. API kaliti va Library ID ni tekshiring.'
    });
  }

  const expirationTime = Math.floor(Date.now() / 1000) + 86400;
  const signature = crypto.createHash('sha256')
    .update(`${libraryId}${apiKey}${expirationTime}${video.guid}`)
    .digest('hex');

  res.json({ videoId: video.guid, libraryId, expirationTime, signature });
}));

app.get('/api/videos/:videoId/play', auth, wrap(async (req, res) => {
  const { libraryId, tokenKey } = bunnyConfig();

  if (!libraryId || !tokenKey) {
    return res.status(503).json({ error: 'Himoyalangan video ko‘rish sozlanmagan.' });
  }

  const videoId = String(req.params.videoId || '');

  if (!/^[a-f0-9-]{30,40}$/i.test(videoId)) {
    return res.status(400).json({ error: 'Video ID noto‘g‘ri.' });
  }

  const marker = 'bunny:' + videoId;

  const course = await animes.findOne({
    $or: [
      { video: marker },
      { 'episodes.video': marker }
    ]
  });

  if (!course) {
    return res.status(404).json({ error: 'Video kursga biriktirilmagan yoki topilmadi.' });
  }

  const episode = (course.episodes || []).find(e => e.video === marker);
  const needsPro = episode ? !!episode.pro : !!course.videoPro;

  if (needsPro && !req.user.owner && req.user.role !== 'admin' && !req.user.pro) {
    return res.status(403).json({ error: 'Bu dars faqat Pro obunachilar uchun.' });
  }

  const expires = Math.floor(Date.now() / 1000) + 300;
  const token = crypto.createHash('sha256')
    .update(`${tokenKey}${videoId}${expires}`)
    .digest('hex');

  res.json({
    url: `https://player.mediadelivery.net/embed/${libraryId}/${videoId}?token=${token}&expires=${expires}`
  });
}));

app.post('/api/anime', auth, admin, wrap(async (req, res) => {
  const b = req.body;

  const a = {
    id: crypto.randomUUID(),
    created: Date.now(),
    title: String(b.title || '').trim().slice(0, 120),
    description: String(b.description || '').trim().slice(0, 2000),
    genre: String(b.genre || '').trim().slice(0, 80),
    year: parseInt(b.year) || null,
    poster: String(b.poster || '').trim(),
    video: String(b.video || '').trim()
  };

  a.videoPro = !!b.videoPro;

  if (!a.title) return res.status(400).json({ error: 'Nomini kiriting' });
  if (a.poster && !isUrl(a.poster)) {
    return res.status(400).json({ error: 'Poster havolasi http(s) bilan boshlanishi kerak' });
  }
  if (a.video && !isVideoRef(a.video)) {
    return res.status(400).json({ error: 'Video havolasi yoki Bunny orqali yuklangan video kerak' });
  }

  await animes.insertOne(a);
  await notify("Yangi kurs qo'shildi: " + a.title);
  res.json({ ok: true });
}));

app.delete('/api/anime/:id', auth, ownerOnly, wrap(async (req, res) => {
  await animes.deleteOne({ id: req.params.id });
  await comments.deleteMany({ animeId: req.params.id });
  res.json({ ok: true });
}));

// Qismlar
function cleanEp(b) {
  const title = String(b.title || '').trim().slice(0, 120);
  const video = String(b.video || '').trim();

  if (!title || !isVideoRef(video)) {
    return { error: 'Dars nomi va video havolasi yoki yuklangan video kerak' };
  }

  const order = parseInt(b.order);

  return {
    v: {
      title,
      video,
      order: Number.isFinite(order) ? order : null,
      pro: !!b.pro
    }
  };
}

app.post('/api/anime/:id/episodes', auth, admin, wrap(async (req, res) => {
  const ep = cleanEp(req.body);
  if (ep.error) return res.status(400).json({ error: ep.error });

  const a = await animes.findOneAndUpdate(
    { id: req.params.id },
    { $push: { episodes: { id: crypto.randomUUID(), views: 0, ...ep.v } } }
  );

  if (a) await notify('"' + a.title + '" kursiga yangi dars: ' + ep.v.title);
  res.json({ ok: true });
}));

app.put('/api/anime/:id/episodes/:eid', auth, admin, wrap(async (req, res) => {
  const ep = cleanEp(req.body);
  if (ep.error) return res.status(400).json({ error: ep.error });

  await animes.updateOne(
    { id: req.params.id, 'episodes.id': req.params.eid },
    {
      $set: {
        'episodes.$.title': ep.v.title,
        'episodes.$.video': ep.v.video,
        'episodes.$.order': ep.v.order,
        'episodes.$.pro': ep.v.pro
      }
    }
  );

  res.json({ ok: true });
}));

app.post('/api/anime/:id/episodes/:eid/view', auth, wrap(async (req, res) => {
  await animes.updateOne(
    { id: req.params.id, 'episodes.id': req.params.eid },
    { $inc: { 'episodes.$.views': 1 } }
  );
  res.json({ ok: true });
}));

app.delete('/api/anime/:id/episodes/:eid', auth, ownerOnly, wrap(async (req, res) => {
  await animes.updateOne(
    { id: req.params.id },
    { $pull: { episodes: { id: req.params.eid } } }
  );
  res.json({ ok: true });
}));

// Sevimlilar
app.post('/api/anime/:id/fav', auth, wrap(async (req, res) => {
  const u = await users.findOne({ id: req.user.id });
  const has = (u.favs || []).includes(req.params.id);

  await users.updateOne(
    { id: req.user.id },
    has
      ? { $pull: { favs: req.params.id } }
      : { $addToSet: { favs: req.params.id } }
  );

  res.json({ favs: (await users.findOne({ id: req.user.id })).favs || [] });
}));

// Izohlar
app.get('/api/anime/:id/comments', auth, wrap(async (req, res) => {
  res.json(
    await comments.find(
      { animeId: req.params.id },
      { projection: { _id: 0 } }
    ).sort({ created: -1 }).limit(100).toArray()
  );
}));

app.post('/api/anime/:id/comments', auth, wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 500);

  if (!text) return res.status(400).json({ error: "Izoh bo'sh bo'lmasin" });

  await comments.insertOne({
    id: crypto.randomUUID(),
    animeId: req.params.id,
    userId: req.user.id,
    username: req.user.username,
    text,
    created: Date.now()
  });

  res.json({ ok: true });
}));

app.delete('/api/comments/:cid', auth, wrap(async (req, res) => {
  const c = await comments.findOne({ id: req.params.cid });

  if (!c) return res.json({ ok: true });

  if (c.userId !== req.user.id && !req.user.owner) {
    return res.status(403).json({ error: "Ruxsat yo'q" });
  }

  await comments.deleteOne({ id: c.id });
  res.json({ ok: true });
}));

// Ko'rishlar soni va tahrirlash
app.post('/api/anime/:id/view', auth, wrap(async (req, res) => {
  await animes.updateOne({ id: req.params.id }, { $inc: { views: 1 } });
  res.json({ ok: true });
}));

app.put('/api/anime/:id', auth, ownerOnly, wrap(async (req, res) => {
  const b = req.body;

  const set = {
    title: String(b.title || '').trim().slice(0, 120),
    description: String(b.description || '').trim().slice(0, 2000),
    genre: String(b.genre || '').trim().slice(0, 80),
    year: parseInt(b.year) || null,
    poster: String(b.poster || '').trim(),
    video: String(b.video || '').trim()
  };

  set.videoPro = !!b.videoPro;

  if (!set.title) return res.status(400).json({ error: 'Nomini kiriting' });
  if (set.poster && !isUrl(set.poster)) {
    return res.status(400).json({ error: 'Poster havolasi http(s) bilan boshlanishi kerak' });
  }
  if (set.video && !isVideoRef(set.video)) {
    return res.status(400).json({ error: 'Video havolasi yoki Bunny orqali yuklangan video kerak' });
  }

  await animes.updateOne({ id: req.params.id }, { $set: set });
  res.json({ ok: true });
}));

// Admin panel
app.get('/api/admin/stats', auth, ownerOnly, wrap(async (req, res) => {
  const [u, a, c] = await Promise.all([
    users.countDocuments(),
    animes.countDocuments(),
    comments.countDocuments()
  ]);

  const pro = await users.countDocuments({ proUntil: { $gt: Date.now() } });
  const all = await animes.find({}, { projection: { _id: 0 } }).toArray();
  const rx = {};

  for (const r of await reactions.find({}).toArray()) {
    const k = r.animeId + ':' + r.ep;
    (rx[k] = rx[k] || { l: 0, d: 0 })[r.v > 0 ? 'l' : 'd']++;
  }

  const views = all.reduce((n, x) => n + (x.views || 0), 0);

  const courses = all
    .sort((x, y) => (y.views || 0) - (x.views || 0))
    .map(x => ({
      id: x.id,
      title: x.title,
      views: x.views || 0,
      lessons: (x.episodes || []).map(e => {
        const r = rx[x.id + ':' + e.id] || {};
        return {
          title: e.title,
          views: e.views || 0,
          pro: !!e.pro,
          likes: r.l || 0,
          dislikes: r.d || 0
        };
      })
    }));

  res.json({ users: u, anime: a, comments: c, views, pro, courses });
}));

app.get('/api/admin/users', auth, ownerOnly, wrap(async (req, res) => {
  const list = await users.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).toArray();

  res.json(list.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    created: u.created || null,
    favs: (u.favs || []).length,
    owner: u.lower === ADMIN_USER.toLowerCase(),
    proUntil: u.proUntil || null
  })));
}));

app.post('/api/admin/users', auth, ownerOnly, wrap(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "Login 3-20 ta harf, raqam yoki _ bo'lishi kerak" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Admin paroli kamida 8 ta belgi bo'lsin" });
  }

  try {
    await users.insertOne({
      id: crypto.randomUUID(),
      username,
      lower: username.toLowerCase(),
      hash: bcrypt.hashSync(password, 10),
      role: 'admin',
      created: Date.now()
    });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Bu login band' });
    throw e;
  }

  res.json({ ok: true });
}));

app.post('/api/admin/users/:id/role', auth, ownerOnly, wrap(async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "O'zingizning huquqingizni o'zgartira olmaysiz" });
  }

  const role = req.body.role === 'admin' ? 'admin' : 'user';
  await users.updateOne({ id: req.params.id }, { $set: { role } });
  res.json({ ok: true });
}));

app.delete('/api/admin/users/:id', auth, ownerOnly, wrap(async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "O'zingizni o'chira olmaysiz" });
  }

  const target = await users.findOne({ id: req.params.id });

  if (!target) return res.json({ ok: true });

  if (target.lower === ADMIN_USER.toLowerCase()) {
    return res.status(403).json({ error: "Bosh adminni o'chirib bo'lmaydi" });
  }

  if (target.role === 'admin' && !req.user.owner) {
    return res.status(403).json({ error: "Adminlarni faqat bosh admin o'chira oladi" });
  }

  await users.deleteOne({ id: req.params.id });
  await comments.deleteMany({ userId: req.params.id });
  res.json({ ok: true });
}));

app.get('/api/admin/comments', auth, ownerOnly, wrap(async (req, res) => {
  const cs = await comments.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).limit(100).toArray();

  const titles = Object.fromEntries(
    (await animes.find({}, { projection: { _id: 0, id: 1, title: 1 } }).toArray())
      .map(a => [a.id, a.title])
  );

  res.json(cs.map(c => ({
    ...c,
    anime: titles[c.animeId] || '(o\'chirilgan)'
  })));
}));

// Janrlar
app.get('/api/genres', auth, wrap(async (req, res) => {
  res.json(
    await genres.find({}, { projection: { _id: 0, lower: 0 } }).sort({ name: 1 }).toArray()
  );
}));

app.post('/api/genres', auth, ownerOnly, wrap(async (req, res) => {
  const name = String(req.body.name || '').replace(/,/g, ' ').trim().slice(0, 30);

  if (!name) return res.status(400).json({ error: 'Janr nomini kiriting' });

  try {
    await genres.insertOne({
      id: crypto.randomUUID(),
      name,
      lower: name.toLowerCase()
    });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Bu janr allaqachon bor' });
    throw e;
  }

  res.json({ ok: true });
}));

app.delete('/api/genres/:id', auth, ownerOnly, wrap(async (req, res) => {
  await genres.deleteOne({ id: req.params.id });
  res.json({ ok: true });
}));

// Yoqdi / yoqmadi
app.get('/api/anime/:id/reactions', auth, wrap(async (req, res) => {
  const out = {};

  for (const r of await reactions.find({ animeId: req.params.id }).toArray()) {
    const o = out[r.ep] || (out[r.ep] = { like: 0, dislike: 0, mine: 0 });

    if (r.v > 0) o.like++;
    else o.dislike++;

    if (r.userId === req.user.id) o.mine = r.v;
  }

  res.json(out);
}));

app.post('/api/anime/:id/react', auth, wrap(async (req, res) => {
  const v = Math.sign(Number(req.body.v)) || 0;
  const f = {
    animeId: req.params.id,
    ep: String(req.body.ep || 'main'),
    userId: req.user.id
  };

  if (v === 0) {
    await reactions.deleteOne(f);
  } else {
    await reactions.updateOne(f, { $set: { v } }, { upsert: true });
  }

  res.json({ ok: true });
}));

// Bildirishnomalar
app.get('/api/notifications', auth, wrap(async (req, res) => {
  const u = await users.findOne({ id: req.user.id });
  const seen = u.notifSeen || 0;

  const items = await notifs.find({
    $or: [{ to: null }, { to: req.user.id }],
    created: { $gte: u.created || 0 }
  }, { projection: { _id: 0 } })
    .sort({ created: -1 })
    .limit(30)
    .toArray();

  res.json({
    items: items.map(n => ({ ...n, unread: n.created > seen })),
    unread: items.filter(n => n.created > seen).length
  });
}));

app.post('/api/notifications/seen', auth, wrap(async (req, res) => {
  await users.updateOne({ id: req.user.id }, { $set: { notifSeen: Date.now() } });
  res.json({ ok: true });
}));

// Pro obuna va promo kodlar
const DAY = 86400000;

app.post('/api/admin/users/:id/pro', auth, ownerOnly, wrap(async (req, res) => {
  const days = Math.max(0, Math.min(3650, parseInt(req.body.days) || 0));
  const u = await users.findOne({ id: req.params.id });

  if (!u) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

  const until = days ? Math.max(Date.now(), u.proUntil || 0) + days * DAY : null;

  await users.updateOne({ id: u.id }, { $set: { proUntil: until } });

  await notify(
    days
      ? 'Sizga Pro obuna berildi: ' + new Date(until).toISOString().slice(0, 10) + ' gacha'
      : 'Pro obunangiz bekor qilindi',
    u.id
  );

  res.json({ ok: true });
}));

app.get('/api/admin/promos', auth, ownerOnly, wrap(async (req, res) => {
  res.json(
    await promos.find({}, { projection: { _id: 0, usedBy: 0 } }).sort({ created: -1 }).toArray()
  );
}));

app.post('/api/admin/promos', auth, ownerOnly, wrap(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '').slice(0, 30)
    || crypto.randomBytes(4).toString('hex').toUpperCase();

  const days = Math.max(1, Math.min(3650, parseInt(req.body.days) || 30));
  const maxUses = Math.max(1, Math.min(100000, parseInt(req.body.maxUses) || 1));

  try {
    await promos.insertOne({
      id: crypto.randomUUID(),
      code,
      days,
      maxUses,
      used: 0,
      usedBy: [],
      created: Date.now()
    });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Bu promo kod allaqachon bor' });
    throw e;
  }

  res.json({ ok: true, code });
}));

app.delete('/api/admin/promos/:id', auth, ownerOnly, wrap(async (req, res) => {
  await promos.deleteOne({ id: req.params.id });
  res.json({ ok: true });
}));

app.post('/api/promo/redeem', auth, wrap(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();

  const p = await promos.findOneAndUpdate(
    {
      code,
      usedBy: { $ne: req.user.id },
      $expr: { $lt: ['$used', '$maxUses'] }
    },
    {
      $inc: { used: 1 },
      $push: { usedBy: req.user.id }
    }
  );

  if (!p) {
    return res.status(400).json({ error: "Promo kod noto'g'ri, ishlatilgan yoki tugagan" });
  }

  const u = await users.findOne({ id: req.user.id });
  const until = Math.max(Date.now(), u.proUntil || 0) + p.days * DAY;

  await users.updateOne({ id: u.id }, { $set: { proUntil: until } });

  res.json({ ok: true, proUntil: until, days: p.days });
}));

// Hamma foydalanuvchiga xabar yuborish
app.post('/api/notifications', auth, admin, wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 300);

  if (!text) return res.status(400).json({ error: 'Xabar matnini yozing' });

  await notifs.insertOne({
    id: crypto.randomUUID(),
    text,
    to: null,
    by: req.user.username,
    created: Date.now()
  });

  res.json({ ok: true });
}));

app.delete('/api/notifications/:id', auth, admin, wrap(async (req, res) => {
  const n = await notifs.findOne({ id: req.params.id });

  if (!n) return res.json({ ok: true });

  if (!req.user.owner && n.by !== req.user.username) {
    return res.status(403).json({ error: "Faqat o'zingiz yuborgan xabarni o'chira olasiz" });
  }

  await notifs.deleteOne({ id: n.id });
  res.json({ ok: true });
}));

// Pro tariflar
app.get('/api/plans', auth, wrap(async (req, res) => {
  res.json(
    await tariffs.find({}, { projection: { _id: 0 } }).sort({ days: 1 }).toArray()
  );
}));

app.post('/api/admin/plans', auth, ownerOnly, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 40);
  const price = String(req.body.price || '').trim().slice(0, 40);
  const days = Math.min(3650, parseInt(req.body.days) || 0);

  if (!name || !price || days < 1) {
    return res.status(400).json({ error: 'Tarif nomi, narxi va muddatini (kun) kiriting' });
  }

  await tariffs.insertOne({
    id: crypto.randomUUID(),
    name,
    price,
    days,
    desc: String(req.body.desc || '').trim().slice(0, 200),
    created: Date.now()
  });

  res.json({ ok: true });
}));

app.delete('/api/admin/plans/:id', auth, ownerOnly, wrap(async (req, res) => {
  await tariffs.deleteOne({ id: req.params.id });
  res.json({ ok: true });
}));

// Telegram bot: long polling
let telegramOffset = 0;
let telegramPolling = false;

async function telegramSend(chatId, text) {
  const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });

  if (!r.ok) {
    throw new Error('Telegram sendMessage xatosi: ' + r.status);
  }
}

async function pollTelegram() {
  if (!TELEGRAM_BOT_TOKEN || telegramPolling) return;

  telegramPolling = true;

  try {
    const r = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?timeout=25&offset=${telegramOffset}`
    );

    const data = await r.json();

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        telegramOffset = update.update_id + 1;

        const msg = update.message;

        if (!msg || !msg.text || !msg.chat) continue;

        const match = msg.text.trim().match(/^\/start\s+([a-f0-9]{36})$/i);

        if (!match) {
          if (msg.text.trim().startsWith('/start')) {
            await telegramSend(
              msg.chat.id,
              'Sayt orqali ro‘yxatdan o‘tishni boshlang, keyin saytdagi maxsus havolani shu botda oching.'
            );
          }
          continue;
        }

        const pending = await pendingRegs.findOne({
          nonce: match[1],
          expires: { $gt: Date.now() }
        });

        if (!pending) {
          await telegramSend(
            msg.chat.id,
            'Bu tasdiqlash havolasi eskirgan. Saytga qaytib qaytadan ro‘yxatdan o‘tishni boshlang.'
          );
          continue;
        }

        const actual = pending.codeForBot || null;

        if (!actual) {
          await telegramSend(
            msg.chat.id,
            'Kod yuborilmadi. Sayt orqali qaytadan ro‘yxatdan o‘tishni boshlang.'
          );
          continue;
        }

        await pendingRegs.updateOne(
          { nonce: pending.nonce },
          { $set: { chatId: String(msg.chat.id) } }
        );

        await telegramSend(
          msg.chat.id,
          `Saytingiz uchun tasdiqlash kodi: ${actual}\nKod 10 daqiqa amal qiladi. Uni faqat saytdagi tasdiqlash oynasiga kiriting.`
        );
      }
    }
  } catch (e) {
    console.error('Telegram bot:', e.message);
  } finally {
    telegramPolling = false;
    setTimeout(pollTelegram, 1000);
  }
}

// Serverni ishga tushirish
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

  await pendingRegs.createIndex({ nonce: 1 }, { unique: true });
  await promos.createIndex({ code: 1 }, { unique: true });
  await genres.createIndex({ lower: 1 }, { unique: true });

  const meta = db.collection('meta');

  if (!(await meta.findOne({ k: 'genres' }))) {
    await meta.insertOne({ k: 'genres' });

    for (const n of [
      'Action',
      'Adventure',
      'Comedy',
      'Drama',
      'Fantasy',
      'Romance',
      'Sci-Fi',
      'Samuray'
    ]) {
      await genres.updateOne(
        { lower: n.toLowerCase() },
        {
          $setOnInsert: {
            id: crypto.randomUUID(),
            name: n,
            lower: n.toLowerCase()
          }
        },
        { upsert: true }
      );
    }
  }

  if (!(await meta.findOne({ k: 'cats-v2' }))) {
    await meta.insertOne({ k: 'cats-v2' });

    await genres.deleteMany({
      lower: {
        $in: [
          'action',
          'adventure',
          'comedy',
          'drama',
          'fantasy',
          'romance',
          'sci-fi',
          'samuray'
        ]
      }
    });

    for (const n of [
      'Python',
      'JavaScript',
      'Web dasturlash',
      'Mobil ilovalar',
      "Ma'lumotlar bazasi",
      'Algoritmlar',
      "Sun'iy intellekt",
      'Boshlang‘ich'
    ]) {
      await genres.updateOne(
        { lower: n.toLowerCase() },
        {
          $setOnInsert: {
            id: crypto.randomUUID(),
            name: n,
            lower: n.toLowerCase()
          }
        },
        { upsert: true }
      );
    }
  }

  await users.createIndex({ lower: 1 }, { unique: true });

  // Bosh admin akkauntini tekshirish
  await users.updateOne(
    { lower: ADMIN_USER.toLowerCase() },
    {
      $set: {
        username: ADMIN_USER,
        hash: bcrypt.hashSync(ADMIN_PASS, 10),
        role: 'admin'
      },
      $setOnInsert: {
        id: crypto.randomUUID()
      }
    },
    { upsert: true }
  );

  app.listen(process.env.PORT || 3000, () => {
    console.log('Sayt ishga tushdi');

    if (TELEGRAM_BOT_TOKEN) {
      pollTelegram();
    } else {
      console.warn('TELEGRAM_BOT_TOKEN kiritilmagan: Telegram tasdiqlash o‘chiq.');
    }
  });
})().catch(e => {
  console.error('Bazaga ulanib bo\'lmadi:', e.message);
  process.exit(1);
});
