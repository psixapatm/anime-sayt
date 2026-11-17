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
let users, animes;

app.use(express.json({ limit: '100kb' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const wrap = (fn) => (req, res) => fn(req, res).catch(e => {
  console.error(e); res.status(500).json({ error: 'Server xatosi' });
});
const sign = (u) => jwt.sign({ id: u.id, username: u.username, role: u.role }, SECRET, { expiresIn: '30d' });

function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  try { req.user = jwt.verify(t, SECRET); next(); }
  catch { res.status(401).json({ error: 'Avval tizimga kiring' }); }
}
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
                 hash: bcrypt.hashSync(password, 10), role: 'user' };
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

app.get('/api/me', auth, (req, res) => res.json({ username: req.user.username, role: req.user.role }));

app.get('/api/anime', wrap(async (req, res) => {
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
  res.json({ ok: true });
}));

(async () => {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('animexona');
  users = db.collection('users');
  animes = db.collection('anime');
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
