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
let users, animes, comments, genres;

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
    req.user = { id: u.id, username: u.username, role: u.role, owner: u.lower === ADMIN_USER.toLowerCase() };
    next();
  }).catch(() => res.status(500).json({ error: 'Server xatosi' }));
}
const ownerOnly = (req, res, next) =>
  req.user.owner ? next() : res.status(403).json({ error: 'Bu amal faqat bosh admin uchun' });
const admin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Faqat admin uchun' });

app.post('/api/register', wrap(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: "Login 3-20 ta harf, raqam yoki _ bo'lishi kerak" });
  if (password.length < 6)
    return res.status(400).json({ error: "Parol kamida 6 ta belgi bo'lishi kerak" });
  const user = { id: crypto.randomUUID(), username, lower: username.toLowerCase(),
                 hash: bcrypt.hashSync(password, 10), role: 'user', created: Date.now() };
  try { await users.insertOne(user); }
  catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Bu login band' });
    throw e;
  }
  res.json({ token: sign(user), user: { username, role: 'user' } });
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
  res.json({ username: u.username, role: u.role, favs: u.favs || [], owner: u.lower === ADMIN_USER.toLowerCase() });
}));

app.get('/api/anime', auth, wrap(async (req, res) => {
  res.json(await animes.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).toArray());
}));

const isUrl = (s) => /^https?:\/\//i.test(s);
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
  if (!a.title) return res.status(400).json({ error: 'Nomini kiriting' });
  if (a.poster && !isUrl(a.poster)) return res.status(400).json({ error: 'Poster havolasi http(s) bilan boshlanishi kerak' });
  if (a.video && !isUrl(a.video)) return res.status(400).json({ error: 'Video havolasi http(s) bilan boshlanishi kerak' });
  await animes.insertOne(a);
  res.json({ ok: true });
}));

app.delete('/api/anime/:id', auth, admin, wrap(async (req, res) => {
  await animes.deleteOne({ id: req.params.id });
  await comments.deleteMany({ animeId: req.params.id });
  res.json({ ok: true });
}));

// Qismlar (admin)
app.post('/api/anime/:id/episodes', auth, admin, wrap(async (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 120);
  const video = String(req.body.video || '').trim();
  if (!title || !isUrl(video)) return res.status(400).json({ error: 'Qism nomi va video havolasi (https://...) kerak' });
  await animes.updateOne({ id: req.params.id }, { $push: { episodes: { id: crypto.randomUUID(), title, video } } });
  res.json({ ok: true });
}));
app.delete('/api/anime/:id/episodes/:eid', auth, admin, wrap(async (req, res) => {
  await animes.updateOne({ id: req.params.id }, { $pull: { episodes: { id: req.params.eid } } });
  res.json({ ok: true });
}));

// Sevimlilar
app.post('/api/anime/:id/fav', auth, wrap(async (req, res) => {
  const u = await users.findOne({ id: req.user.id });
  const has = (u.favs || []).includes(req.params.id);
  await users.updateOne({ id: req.user.id }, has ? { $pull: { favs: req.params.id } } : { $addToSet: { favs: req.params.id } });
  res.json({ favs: (await users.findOne({ id: req.user.id })).favs || [] });
}));

// Izohlar
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
  if (c.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: "Ruxsat yo'q" });
  await comments.deleteOne({ id: c.id });
  res.json({ ok: true });
}));

// Ko'rishlar soni va tahrirlash
app.post('/api/anime/:id/view', auth, wrap(async (req, res) => {
  await animes.updateOne({ id: req.params.id }, { $inc: { views: 1 } });
  res.json({ ok: true });
}));
app.put('/api/anime/:id', auth, admin, wrap(async (req, res) => {
  const b = req.body;
  const set = {
    title: String(b.title || '').trim().slice(0, 120),
    description: String(b.description || '').trim().slice(0, 2000),
    genre: String(b.genre || '').trim().slice(0, 80),
    year: parseInt(b.year) || null,
    poster: String(b.poster || '').trim(),
    video: String(b.video || '').trim(),
  };
  if (!set.title) return res.status(400).json({ error: 'Nomini kiriting' });
  if (set.poster && !isUrl(set.poster)) return res.status(400).json({ error: 'Poster havolasi http(s) bilan boshlanishi kerak' });
  if (set.video && !isUrl(set.video)) return res.status(400).json({ error: 'Video havolasi http(s) bilan boshlanishi kerak' });
  await animes.updateOne({ id: req.params.id }, { $set: set });
  res.json({ ok: true });
}));

// Admin panel
app.get('/api/admin/stats', auth, admin, wrap(async (req, res) => {
  const [u, a, c] = await Promise.all([users.countDocuments(), animes.countDocuments(), comments.countDocuments()]);
  const all = await animes.find({}, { projection: { _id: 0, id: 1, title: 1, views: 1 } }).toArray();
  const views = all.reduce((n, x) => n + (x.views || 0), 0);
  const top = all.sort((x, y) => (y.views || 0) - (x.views || 0)).slice(0, 5);
  res.json({ users: u, anime: a, comments: c, views, top });
}));
app.get('/api/admin/users', auth, admin, wrap(async (req, res) => {
  const list = await users.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).toArray();
  res.json(list.map(u => ({ id: u.id, username: u.username, role: u.role, created: u.created || null, favs: (u.favs || []).length, owner: u.lower === ADMIN_USER.toLowerCase() })));
}));
app.post('/api/admin/users', auth, ownerOnly, wrap(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: "Login 3-20 ta harf, raqam yoki _ bo'lishi kerak" });
  if (password.length < 8) return res.status(400).json({ error: "Admin paroli kamida 8 ta belgi bo'lsin" });
  try {
    await users.insertOne({ id: crypto.randomUUID(), username, lower: username.toLowerCase(),
      hash: bcrypt.hashSync(password, 10), role: 'admin', created: Date.now() });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Bu login band' });
    throw e;
  }
  res.json({ ok: true });
}));
app.post('/api/admin/users/:id/role', auth, ownerOnly, wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "O'zingizning huquqingizni o'zgartira olmaysiz" });
  const role = req.body.role === 'admin' ? 'admin' : 'user';
  await users.updateOne({ id: req.params.id }, { $set: { role } });
  res.json({ ok: true });
}));
app.delete('/api/admin/users/:id', auth, admin, wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "O'zingizni o'chira olmaysiz" });
  const target = await users.findOne({ id: req.params.id });
  if (!target) return res.json({ ok: true });
  if (target.lower === ADMIN_USER.toLowerCase()) return res.status(403).json({ error: "Bosh adminni o'chirib bo'lmaydi" });
  if (target.role === 'admin' && !req.user.owner) return res.status(403).json({ error: "Adminlarni faqat bosh admin o'chira oladi" });
  await users.deleteOne({ id: req.params.id });
  await comments.deleteMany({ userId: req.params.id });
  res.json({ ok: true });
}));
app.get('/api/admin/comments', auth, admin, wrap(async (req, res) => {
  const cs = await comments.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).limit(100).toArray();
  const titles = Object.fromEntries((await animes.find({}, { projection: { _id: 0, id: 1, title: 1 } }).toArray()).map(a => [a.id, a.title]));
  res.json(cs.map(c => ({ ...c, anime: titles[c.animeId] || '(o\'chirilgan)' })));
}));

// Janrlar
app.get('/api/genres', auth, wrap(async (req, res) => {
  res.json(await genres.find({}, { projection: { _id: 0, lower: 0 } }).sort({ name: 1 }).toArray());
}));
app.post('/api/genres', auth, admin, wrap(async (req, res) => {
  const name = String(req.body.name || '').replace(/,/g, ' ').trim().slice(0, 30);
  if (!name) return res.status(400).json({ error: 'Janr nomini kiriting' });
  try { await genres.insertOne({ id: crypto.randomUUID(), name, lower: name.toLowerCase() }); }
  catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'Bu janr allaqachon bor' }); throw e; }
  res.json({ ok: true });
}));
app.delete('/api/genres/:id', auth, admin, wrap(async (req, res) => {
  await genres.deleteOne({ id: req.params.id });
  res.json({ ok: true });
}));

(async () => {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('animexona');
  users = db.collection('users');
  animes = db.collection('anime');
  comments = db.collection('comments');
  genres = db.collection('genres');
  await genres.createIndex({ lower: 1 }, { unique: true });
  const meta = db.collection('meta');
  if (!(await meta.findOne({ k: 'genres' }))) {   // boshlang'ich janrlar bir marta qo'shiladi
    await meta.insertOne({ k: 'genres' });
    for (const n of ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Samuray'])
      await genres.updateOne({ lower: n.toLowerCase() }, { $setOnInsert: { id: crypto.randomUUID(), name: n, lower: n.toLowerCase() } }, { upsert: true });
  }
  await users.createIndex({ lower: 1 }, { unique: true });
  // Admin akaunt har ishga tushganda tekshiriladi (parol o'zgarsa yangilanadi)
  await users.updateOne(
    { lower: ADMIN_USER.toLowerCase() },
    { $set: { username: ADMIN_USER, hash: bcrypt.hashSync(ADMIN_PASS, 10), role: 'admin' },
      $setOnInsert: { id: crypto.randomUUID() } },
    { upsert: true }
  );
  app.listen(process.env.PORT || 3000, () => console.log('Sayt ishga tushdi'));
})().catch(e => { console.error('Bazaga ulanib bo\'lmadi:', e.message); process.exit(1); });
