




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
let users, animes, comments, genres, reactions, notifs, promos, tariffs, pendingRegs, tests;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_BOT_USERNAME = 'verification_zverbot';
const ADMIN_TELEGRAM_ID = String(process.env.ADMIN_TELEGRAM_ID || '').trim();
let botReplies, payments, botSettings, telegramAdmins, blockedUsers, adminLogs;

app.use(express.json({ limit: '100kb' }));
app.get('/logo-mark.png', (req, res) => res.sendFile(path.join(__dirname, 'logo-mark.png')));
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
    req.user = { id: u.id, username: u.username, role: u.role, adminLevel: u.adminLevel || null, owner: u.lower === ADMIN_USER.toLowerCase(), pro: (u.proUntil || 0) > Date.now() };
    next();
  }).catch(() => res.status(500).json({ error: 'Server xatosi' }));
}
const ownerOnly = (req, res, next) =>
  req.user.owner ? next() : res.status(403).json({ error: 'Bu amal faqat bosh admin uchun' });
const mainAdminOnly = (req, res, next) =>
  (req.user.owner || (req.user.role === 'admin' && req.user.adminLevel === 'main')) ? next() : res.status(403).json({ error: 'Bu amal faqat Owner yoki Main Admin uchun' });
const staffOnly = (req, res, next) =>
  (req.user.owner || req.user.role === 'admin') ? next() : res.status(403).json({ error: 'Faqat admin uchun' });
const notify = (text, to = null) => notifs.insertOne({ id: crypto.randomUUID(), text, to, created: Date.now() });
const admin = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Faqat admin uchun' });

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
  const user = { id: crypto.randomUUID(), username: pending.username, lower: pending.lower, hash: pending.hash, role: 'user', created: Date.now(), telegramChatId: pending.chatId, telegramUserId: pending.telegramUserId || pending.chatId, telegramUsername: pending.telegramUsername || null, telegramFirstName: pending.telegramFirstName || null };
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
  res.json({ token: sign(user), user: { username: user.username, role: user.role, adminLevel: user.adminLevel || null } });
}));

app.get('/api/me', auth, wrap(async (req, res) => {
  const u = await users.findOne({ id: req.user.id });
  if (!u) return res.status(401).json({ error: 'Avval tizimga kiring' });
  res.json({ username: u.username, role: u.role, adminLevel: u.adminLevel || null, favs: u.favs || [], owner: u.lower === ADMIN_USER.toLowerCase(), proUntil: u.proUntil || null, pro: (u.proUntil || 0) > Date.now(), profileName: u.profileName || '', profileNameEditUsed: !!u.profileNameEditUsed, badge: u.badge || 'none', recent: u.recent || [], certificates: u.certificates || [] });
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
app.post('/api/videos/upload-init', auth, mainAdminOnly, wrap(async (req, res) => {
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
app.post('/api/anime', auth, mainAdminOnly, wrap(async (req, res) => {
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
  // Kurs yaratilishida kiritilgan asosiy video avtomatik 1-qism bo'ladi.
  a.episodes = a.video ? [{ id: crypto.randomUUID(), title: '1-qism', video: a.video, order: 1, pro: !!b.videoPro, views: 0 }] : [];
  await animes.insertOne(a);
  await notify("Yangi kurs qo'shildi: " + a.title);
  res.json({ ok: true });
}));

app.delete('/api/anime/:id', auth, mainAdminOnly, wrap(async (req, res) => {
  await animes.deleteOne({ id: req.params.id });
  await comments.deleteMany({ animeId: req.params.id });
  res.json({ ok: true });
}));

// Qismlar (admin)
function cleanEp(b) {
  const title = String(b.title || '').trim().slice(0, 120);
  const video = String(b.video || '').trim();
  if (!title || !isVideoRef(video)) return { error: 'Dars nomi va video havolasi yoki yuklangan video kerak' };
  const order = parseInt(b.order);
  return { v: { title, video, order: Number.isFinite(order) ? order : null, pro: !!b.pro } };
}
app.post('/api/anime/:id/episodes', auth, mainAdminOnly, wrap(async (req, res) => {
  const ep = cleanEp(req.body);
  if (ep.error) return res.status(400).json({ error: ep.error });
  const a = await animes.findOneAndUpdate({ id: req.params.id }, { $push: { episodes: { id: crypto.randomUUID(), views: 0, ...ep.v } } });
  if (a) await notify('"' + a.title + '" kursiga yangi dars: ' + ep.v.title);
  res.json({ ok: true });
}));
app.put('/api/anime/:id/episodes/:eid', auth, mainAdminOnly, wrap(async (req, res) => {
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
app.delete('/api/anime/:id/episodes/:eid', auth, mainAdminOnly, wrap(async (req, res) => {
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
  if (c.userId !== req.user.id && !req.user.owner) return res.status(403).json({ error: "Ruxsat yo'q" });
  await comments.deleteOne({ id: c.id });
  res.json({ ok: true });
}));

// Ko'rishlar soni va tahrirlash
app.post('/api/anime/:id/view', auth, wrap(async (req, res) => {
  await animes.updateOne({ id: req.params.id }, { $inc: { views: 1 } });
  await users.updateOne({ id: req.user.id }, { $pull: { recent: { id: req.params.id } } });
  await users.updateOne({ id: req.user.id }, { $push: { recent: { $each: [{ id: req.params.id, at: Date.now() }], $position: 0, $slice: 5 } } });
  res.json({ ok: true });
}));

// Profil: ism-familiya bir marta tahrirlanadi; PRO bezagi.
app.put('/api/profile', auth, wrap(async (req, res) => {
  const profileName = String(req.body.profileName || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const badge = String(req.body.badge || 'none');
  const allowed = ['none','crown','star','fire','diamond','code'];
  if (profileName && !/^[\p{L} .'-]{2,80}$/u.test(profileName)) return res.status(400).json({ error: 'Ism-familiyani tekshiring.' });
  if (!allowed.includes(badge)) return res.status(400).json({ error: 'Belgi noto‘g‘ri.' });
  const u = await users.findOne({ id: req.user.id });
  if (badge !== 'none' && (u.proUntil || 0) <= Date.now()) return res.status(403).json({ error: 'Profil bezaklari faqat faol Pro obunachilar uchun.' });
  const oldName = String(u.profileName || '').trim();
  const nameChanged = !!oldName && profileName !== oldName;
  if (nameChanged && u.profileNameEditUsed) return res.status(403).json({ error: 'Ism-familiyangizni tahrirlash imkoniyati bir marta ishlatilgan.' });
  const set = { badge };
  if (!oldName || profileName === oldName || nameChanged) set.profileName = profileName;
  if (nameChanged) set.profileNameEditUsed = true;
  await users.updateOne({ id: req.user.id }, { $set: set });
  res.json({ ok: true, profileName: set.profileName ?? oldName, badge, profileNameEditUsed: !!(u.profileNameEditUsed || nameChanged) });
}));

// Login/parolni o‘zgartirish: tasdiqlash kodi faqat foydalanuvchining ulangan Telegram chatiga yuboriladi.
app.post('/api/account/change/start', auth, wrap(async (req, res) => {
  if (!TELEGRAM_BOT_TOKEN) return res.status(503).json({ error: 'Telegram bot hozircha sozlanmagan.' });
  const user = await users.findOne({ id: req.user.id });
  if (!user?.telegramChatId) return res.status(400).json({ error: 'Telegram hisobingiz ulanmagan. Avval bot orqali ro‘yxatdan o‘tgan hisobdan foydalaning.' });
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username && !password) return res.status(400).json({ error: 'Yangi login yoki yangi parol kiriting.' });
  if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) return res.status(400).json({ error: 'Login 3–20 ta harf, raqam yoki _ dan iborat bo‘lishi kerak.' });
  if (password && password.length < 6) return res.status(400).json({ error: 'Yangi parol kamida 6 ta belgidan iborat bo‘lsin.' });
  if (username && username.toLowerCase() !== user.lower && await users.findOne({ lower: username.toLowerCase() })) return res.status(409).json({ error: 'Bu login band.' });
  if (user.pendingAccountChange?.created > Date.now() - 60 * 1000) return res.status(429).json({ error: 'Yangi kod so‘rashdan oldin 1 daqiqa kuting.' });
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const pending = { username: username || null, hash: password ? bcrypt.hashSync(password, 10) : null, codeHash: crypto.createHash('sha256').update(code).digest('hex'), created: Date.now(), expires: Date.now() + 10 * 60 * 1000, attempts: 0 };
  await users.updateOne({ id: user.id }, { $set: { pendingAccountChange: pending } });
  try { await telegramSend(user.telegramChatId, `🔐 Akaunt ma’lumotlarini o‘zgartirish kodi: ${code}\n\nKod 10 daqiqa amal qiladi. Agar bu so‘rov sizniki bo‘lmasa, xabarni e’tiborsiz qoldiring.`); }
  catch (e) { await users.updateOne({ id: user.id }, { $unset: { pendingAccountChange: '' } }); return res.status(502).json({ error: 'Telegramga kod yuborilmadi. Botni ochib /start bosing va qayta urinib ko‘ring.' }); }
  res.json({ ok: true, message: 'Tasdiqlash kodi Telegram botingizga yuborildi.', botUrl: `https://t.me/${TELEGRAM_BOT_USERNAME}` });
}));
app.post('/api/account/change/verify', auth, wrap(async (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: '6 xonali kodni kiriting.' });
  const user = await users.findOne({ id: req.user.id });
  const pending = user?.pendingAccountChange;
  if (!pending || pending.expires <= Date.now()) { await users.updateOne({ id: req.user.id }, { $unset: { pendingAccountChange: '' } }); return res.status(400).json({ error: 'Kod muddati tugagan. Yangi kod so‘rang.' }); }
  const digest = crypto.createHash('sha256').update(code).digest('hex');
  if (digest !== pending.codeHash) {
    const attempts = Number(pending.attempts || 0) + 1;
    await users.updateOne({ id: req.user.id }, attempts >= 5 ? { $unset: { pendingAccountChange: '' } } : { $set: { 'pendingAccountChange.attempts': attempts } });
    return res.status(400).json({ error: attempts >= 5 ? 'Kod 5 marta noto‘g‘ri kiritildi. Yangi kod so‘rang.' : `Kod noto‘g‘ri. Qolgan urinish: ${5 - attempts}.` });
  }
  const set = {};
  if (pending.username && pending.username.toLowerCase() !== user.lower && await users.findOne({ lower: pending.username.toLowerCase() })) return res.status(409).json({ error: 'Bu login boshqa foydalanuvchi tomonidan band qilindi. Yangi login bilan qayta urinib ko‘ring.' });
  if (pending.username) { set.username = pending.username; set.lower = pending.username.toLowerCase(); }
  if (pending.hash) set.hash = pending.hash;
  await users.updateOne({ id: user.id }, { $set: set, $unset: { pendingAccountChange: '' } });
  res.json({ ok: true, username: set.username || user.username, message: 'Akaunt ma’lumotlari muvaffaqiyatli yangilandi.' });
}));

// Testlar: foydalanuvchilar faqat faol testlarni ko‘radi.
app.get('/api/tests', auth, wrap(async (req, res) => {
  const rows = await tests.find({ active: true }, { projection: { _id: 0, questions: 0 } }).sort({ created: -1 }).toArray();
  res.json(rows);
}));
app.get('/api/tests/:id', auth, wrap(async (req, res) => {
  const t = await tests.findOne({ id: req.params.id, active: true });
  if (!t) return res.status(404).json({ error: 'Test topilmadi.' });
  res.json({ id: t.id, title: t.title, courseId: t.courseId, courseTitle: t.courseTitle, questions: (t.questions || []).map(q => ({ id: q.id, text: q.text, options: q.options })) });
}));
app.post('/api/tests/:id/submit', auth, wrap(async (req, res) => {
  const t = await tests.findOne({ id: req.params.id, active: true });
  if (!t) return res.status(404).json({ error: 'Test topilmadi.' });
  const answers = req.body.answers || {};
  let correct = 0;
  for (const q of (t.questions || [])) if (Number(answers[q.id]) === Number(q.correct)) correct++;
  const total = (t.questions || []).length;
  if (!total) return res.status(400).json({ error: 'Test savollari mavjud emas.' });
  const percent = Math.round(correct / total * 100), passed = percent >= (t.passPercent || 70);
  await users.updateOne({ id: req.user.id }, { $push: { testResults: { $each: [{ testId: t.id, percent, passed, at: Date.now() }], $slice: -50 } } });
  res.json({ correct, total, percent, passed, testId: t.id, courseId: t.courseId, courseTitle: t.courseTitle, required: t.passPercent || 70 });
}));
app.get('/api/admin/tests', auth, mainAdminOnly, wrap(async (req, res) => {
  res.json(await tests.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).toArray());
}));
app.post('/api/admin/tests', auth, mainAdminOnly, wrap(async (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 100);
  const courseId = String(req.body.courseId || '');
  const course = await animes.findOne({ id: courseId });
  const questions = Array.isArray(req.body.questions) ? req.body.questions.slice(0, 50) : [];
  if (!title || !course || !questions.length) return res.status(400).json({ error: 'Test nomi, kurs va savollarni kiriting.' });
  const clean = questions.map(q => ({ id: crypto.randomUUID(), text: String(q.text || '').trim().slice(0, 500), options: (q.options || []).slice(0, 6).map(x => String(x).slice(0, 200)), correct: Number(q.correct) }));
  if (clean.some(q => !q.text || q.options.length < 2 || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length)) return res.status(400).json({ error: 'Savol yoki javob variantlarini tekshiring.' });
  const doc = { id: crypto.randomUUID(), title, courseId, courseTitle: course.title, questions: clean, passPercent: Math.max(50, Math.min(100, Number(req.body.passPercent) || 70)), active: req.body.active !== false, created: Date.now() };
  await tests.insertOne(doc); res.json({ ok: true, id: doc.id });
}));
app.put('/api/admin/tests/:id', auth, mainAdminOnly, wrap(async (req, res) => {
  const t = await tests.findOne({ id: req.params.id }); if (!t) return res.status(404).json({ error: 'Test topilmadi.' });
  const active = req.body.active !== false;
  const title = req.body.title === undefined ? t.title : String(req.body.title).trim().slice(0,100);
  const set = { title, active, passPercent: Math.max(50, Math.min(100, Number(req.body.passPercent) || t.passPercent || 70)) };
  if (Array.isArray(req.body.questions)) { const clean = req.body.questions.slice(0,50).map(q => ({ id: q.id || crypto.randomUUID(), text: String(q.text || '').trim().slice(0,500), options: (q.options || []).slice(0,6).map(x => String(x).slice(0,200)), correct: Number(q.correct) })); if (!clean.length || clean.some(q => !q.text || q.options.length < 2 || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= q.options.length)) return res.status(400).json({ error: 'Savol va javob variantlarini tekshiring.' }); set.questions = clean; }
  await tests.updateOne({ id: t.id }, { $set: set });
  res.json({ ok: true });
}));
app.delete('/api/admin/tests/:id', auth, mainAdminOnly, wrap(async (req, res) => { await tests.deleteOne({ id: req.params.id }); res.json({ ok: true }); }));
app.post('/api/certificates', auth, wrap(async (req, res) => {
  const testId = String(req.body.testId || '');
  const t = await tests.findOne({ id: testId, active: true });
  const user = await users.findOne({ id: req.user.id });
  const attempt = (user.testResults || []).filter(x => x.testId === testId && x.passed && x.percent >= (t?.passPercent || 70)).sort((a,b) => b.at - a.at)[0];
  const fullName = String(user.profileName || '').trim();
  if (!t || !attempt || !fullName || !/^[\p{L} .'-]{2,80}$/u.test(fullName)) return res.status(400).json({ error: 'Sertifikat uchun profilingizda ism-familiya saqlangan bo‘lishi va testdan o‘tgan bo‘lishingiz kerak.' });
  const cert = { id: 'DK-' + crypto.randomBytes(5).toString('hex').toUpperCase(), fullName, courseTitle: t.courseTitle, issuer: 'Sobirov Muhammadumar', percent: attempt.percent, created: Date.now() };
  await users.updateOne({ id: req.user.id }, { $push: { certificates: { $each: [cert], $slice: -30 } } });
  res.json(cert);
}));
app.put('/api/anime/:id', auth, mainAdminOnly, wrap(async (req, res) => {
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
app.get('/api/admin/stats', auth, staffOnly, wrap(async (req, res) => {
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
app.get('/api/admin/users', auth, mainAdminOnly, wrap(async (req, res) => {
  const list = await users.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).toArray();
  res.json(list.map(u => ({ id: u.id, username: u.username, role: u.role, adminLevel: u.adminLevel || null, created: u.created || null, favs: (u.favs || []).length, owner: u.lower === ADMIN_USER.toLowerCase(), proUntil: u.proUntil || null, telegramChatId: u.telegramChatId || null, telegramUserId: u.telegramUserId || u.telegramChatId || null, telegramUsername: u.telegramUsername || null, telegramFirstName: u.telegramFirstName || null })));
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
  const target = await users.findOne({ id: req.params.id });
  if (!target) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  if (target.lower === ADMIN_USER.toLowerCase()) return res.status(403).json({ error: 'Bosh adminning huquqini o‘zgartirib bo‘lmaydi' });
  if (req.body.role === 'admin') {
    const adminLevel = req.body.adminLevel === 'main' ? 'main' : 'ordinary';
    await users.updateOne({ id: req.params.id }, { $set: { role: 'admin', adminLevel } });
  } else {
    await users.updateOne({ id: req.params.id }, { $set: { role: 'user' }, $unset: { adminLevel: '' } });
  }
  res.json({ ok: true });
}));
app.delete('/api/admin/users/:id', auth, mainAdminOnly, wrap(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "O'zingizni o'chira olmaysiz" });
  const target = await users.findOne({ id: req.params.id });
  if (!target) return res.json({ ok: true });
  if (target.lower === ADMIN_USER.toLowerCase()) return res.status(403).json({ error: "Bosh adminni o'chirib bo'lmaydi" });
  if (target.role === 'admin' && !req.user.owner) return res.status(403).json({ error: "Adminlarni faqat bosh admin o'chira oladi" });
  await users.deleteOne({ id: req.params.id });
  await comments.deleteMany({ userId: req.params.id });
  res.json({ ok: true });
}));
app.get('/api/admin/comments', auth, mainAdminOnly, wrap(async (req, res) => {
  const cs = await comments.find({}, { projection: { _id: 0 } }).sort({ created: -1 }).limit(100).toArray();
  const titles = Object.fromEntries((await animes.find({}, { projection: { _id: 0, id: 1, title: 1 } }).toArray()).map(a => [a.id, a.title]));
  res.json(cs.map(c => ({ ...c, anime: titles[c.animeId] || '(o\'chirilgan)' })));
}));

// Janrlar
app.get('/api/genres', auth, wrap(async (req, res) => {
  res.json(await genres.find({}, { projection: { _id: 0, lower: 0 } }).sort({ name: 1 }).toArray());
}));
app.post('/api/genres', auth, mainAdminOnly, wrap(async (req, res) => {
  const name = String(req.body.name || '').replace(/,/g, ' ').trim().slice(0, 30);
  if (!name) return res.status(400).json({ error: 'Janr nomini kiriting' });
  try { await genres.insertOne({ id: crypto.randomUUID(), name, lower: name.toLowerCase() }); }
  catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'Bu janr allaqachon bor' }); throw e; }
  res.json({ ok: true });
}));
app.delete('/api/genres/:id', auth, mainAdminOnly, wrap(async (req, res) => {
  await genres.deleteOne({ id: req.params.id });
  res.json({ ok: true });
}));

// Yoqdi / yoqmadi
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

// Bildirishnomalar
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

// Pro obuna (faqat bosh admin beradi) va promo kodlar
const DAY = 86400000;
app.post('/api/admin/users/:id/pro', auth, mainAdminOnly, wrap(async (req, res) => {
  const days = Math.max(0, Math.min(3650, parseInt(req.body.days) || 0));
  const u = await users.findOne({ id: req.params.id });
  if (!u) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  const until = days ? Math.max(Date.now(), u.proUntil || 0) + days * DAY : null;
  await users.updateOne({ id: u.id }, { $set: { proUntil: until } });
  await notify(days ? 'Sizga Pro obuna berildi: ' + new Date(until).toISOString().slice(0, 10) + ' gacha' : 'Pro obunangiz bekor qilindi', u.id);
  res.json({ ok: true });
}));
app.get('/api/admin/promos', auth, mainAdminOnly, wrap(async (req, res) => {
  res.json(await promos.find({}, { projection: { _id: 0, usedBy: 0 } }).sort({ created: -1 }).toArray());
}));
app.post('/api/admin/promos', auth, mainAdminOnly, wrap(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30)
    || crypto.randomBytes(4).toString('hex').toUpperCase();
  const days = Math.max(1, Math.min(3650, parseInt(req.body.days) || 30));
  const maxUses = Math.max(1, Math.min(100000, parseInt(req.body.maxUses) || 1));
  try { await promos.insertOne({ id: crypto.randomUUID(), code, days, maxUses, used: 0, usedBy: [], created: Date.now() }); }
  catch (e) { if (e.code === 11000) return res.status(409).json({ error: 'Bu promo kod allaqachon bor' }); throw e; }
  res.json({ ok: true, code });
}));
app.delete('/api/admin/promos/:id', auth, mainAdminOnly, wrap(async (req, res) => {
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

// Hamma foydalanuvchiga xabar yuborish (admin va bosh admin)
app.post('/api/notifications', auth, mainAdminOnly, wrap(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ error: 'Xabar matnini yozing' });
  await notifs.insertOne({ id: crypto.randomUUID(), text, to: null, by: req.user.username, created: Date.now() });
  res.json({ ok: true });
}));
app.delete('/api/notifications/:id', auth, mainAdminOnly, wrap(async (req, res) => {
  const n = await notifs.findOne({ id: req.params.id });
  if (!n) return res.json({ ok: true });
  if (!req.user.owner && n.by !== req.user.username) return res.status(403).json({ error: "Faqat o'zingiz yuborgan xabarni o'chira olasiz" });
  await notifs.deleteOne({ id: n.id });
  res.json({ ok: true });
}));

// Pro tariflar (bosh admin qo'shadi)
app.get('/api/plans', auth, wrap(async (req, res) => {
  res.json(await tariffs.find({}, { projection: { _id: 0 } }).sort({ days: 1 }).toArray());
}));
app.post('/api/admin/plans', auth, mainAdminOnly, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 40);
  const price = String(req.body.price || '').trim().slice(0, 40);
  const days = Math.min(3650, parseInt(req.body.days) || 0);
  if (!name || !price || days < 1) return res.status(400).json({ error: 'Tarif nomi, narxi va muddatini (kun) kiriting' });
  await tariffs.insertOne({ id: crypto.randomUUID(), name, price, days, desc: String(req.body.desc || '').trim().slice(0, 200), created: Date.now() });
  res.json({ ok: true });
}));
app.delete('/api/admin/plans/:id', auth, mainAdminOnly, wrap(async (req, res) => {
  await tariffs.deleteOne({ id: req.params.id });
  res.json({ ok: true });
}));

// To'lov so'rovlari bot orqali ko'rib chiqiladi; promo kod faqat admin tasdiqlagach beriladi.

// Telegram bot: uch darajali admin, Pro to'lovlari va anonim murojaatlar.
let telegramOffset = 0;
let telegramPolling = false;
// Adminlar botga odatiy foydalanuvchi sifatida kiradi; /adminpanel bilan admin rejimini yoqadi.
// Bu holat xotirada saqlanadi va server qayta ishga tushganda xavfsizlik uchun o'chadi.
const adminPanelChats = new Set();
const USER_MENU = { keyboard: [[{ text: '💎 Pro obuna olish' }], [{ text: '📩 Adminga murojaat' }, { text: '❓ Yordam' }]], resize_keyboard: true };
const OWNER_MENU = { keyboard: [[{ text: '📊 Statistika' }, { text: '👥 Foydalanuvchilar' }], [{ text: '💳 To‘lov sozlamalari' }, { text: '💎 Tariflar' }], [{ text: '📢 E’lon yuborish' }, { text: '🛡 Adminlar' }], [{ text: '🚫 Bloklash' }], [{ text: '💎 Pro obuna olish' }, { text: '📩 Adminga murojaat' }]], resize_keyboard: true };
const MAIN_MENU = { keyboard: [[{ text: '📊 Statistika' }, { text: '👥 Foydalanuvchilar' }], [{ text: '💳 To‘lov sozlamalari' }, { text: '💎 Tariflar' }], [{ text: '📢 E’lon yuborish' }], [{ text: '💎 Pro obuna olish' }, { text: '📩 Adminga murojaat' }]], resize_keyboard: true };
const ORDINARY_MENU = { keyboard: [[{ text: '📊 Statistika' }], [{ text: '💎 Pro obuna olish' }, { text: '📩 Adminga murojaat' }], [{ text: '❓ Yordam' }]], resize_keyboard: true };
async function telegramApi(method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(`Telegram ${method} xatosi: ${data.description || r.status}`);
  return data.result;
}
async function telegramSend(chatId, text, extra = {}) { return telegramApi('sendMessage', { chat_id: chatId, text, ...extra }); }
function displayTelegramUser(from) { return from.username ? '@' + from.username : (from.first_name || 'Telegram foydalanuvchisi'); }
async function adminInfo(chatId) {
  if (ADMIN_TELEGRAM_ID && String(chatId) === ADMIN_TELEGRAM_ID) return { level: 'owner', label: 'Owner' };
  return telegramAdmins.findOne({ chatId: String(chatId), active: true });
}
function menuFor(role) { return role?.level === 'owner' ? OWNER_MENU : role?.level === 'main' ? MAIN_MENU : role?.level === 'ordinary' ? ORDINARY_MENU : USER_MENU; }
async function logAdmin(chatId, action, details = '') { await adminLogs.insertOne({ chatId: String(chatId), action, details: String(details).slice(0, 500), created: Date.now() }); }
async function activeAdmins(includeOrdinary = true) {
  const ids = ADMIN_TELEGRAM_ID ? [ADMIN_TELEGRAM_ID] : [];
  const levels = includeOrdinary ? ['main', 'ordinary'] : ['main'];
  const rows = await telegramAdmins.find({ active: true, level: { $in: levels } }).toArray();
  for (const a of rows) if (!ids.includes(a.chatId)) ids.push(a.chatId);
  return ids;
}
async function showBotPlans(chatId, selectedUserId = null) {
  const linked = await users.find({ telegramChatId: String(chatId), role: 'user' }).sort({ created: -1 }).toArray();
  if (!linked.length) return telegramSend(chatId, 'Pro obuna olish uchun avval saytda ro‘yxatdan o‘ting va Telegram hisobingizni bot orqali tasdiqlang.', { reply_markup: USER_MENU });

  let selected = null;
  if (selectedUserId) selected = linked.find(u => u.id === selectedUserId) || null;
  if (!selected && linked.length === 1) selected = linked[0];
  if (!selected) {
    const buttons = linked.map(u => [{
      text: `${u.username}${(u.proUntil || 0) > Date.now() ? ' — Pro faol' : ''} · ID ${String(u.id).slice(0, 8)}`,
      callback_data: `selectacct:${u.id}`
    }]);
    return telegramSend(chatId, `Qaysi sayt akkauntingiz uchun Pro obuna olmoqchisiz?\n\nQuyidan kerakli akkauntni tanlang:`, { reply_markup: { inline_keyboard: buttons } });
  }

  await botSettings.updateOne({ key: 'selectedProAccount', chatId: String(chatId) },
    { $set: { userId: selected.id, username: selected.username, updated: Date.now() } }, { upsert: true });
  const list = await tariffs.find({}).sort({ days: 1 }).toArray();
  if (!list.length) return telegramSend(chatId, `Tanlangan sayt akkaunti: ${selected.username}\nSayt ID: ${selected.id}\n\nHozircha obuna tariflari mavjud emas.`, { reply_markup: USER_MENU });
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text: `Tanlangan sayt akkaunti: ${selected.username}\nSayt ID: ${selected.id}\n\n💎 Endi shu akkaunt uchun Pro tarifini tanlang:`,
    reply_markup: { inline_keyboard: list.map(p => [{ text: `${p.name} — ${p.price}`, callback_data: `buyplan:${p.id}` }]) }
  });
}
async function showStats(chatId) {
  const total = await users.countDocuments({ role: 'user' });
  const admins = await telegramAdmins.countDocuments({ active: true }) + (ADMIN_TELEGRAM_ID ? 1 : 0);
  const pending = await pendingRegs.countDocuments({ expires: { $gt: Date.now() } });
  const paymentsPending = await payments.countDocuments({ status: 'pending' });
  await telegramSend(chatId, `📊 Bot statistikasi\n\n👥 Foydalanuvchilar: ${total}\n🛡 Adminlar: ${admins}\n⏳ Tasdiqlash kutilmoqda: ${pending}\n🧾 Tekshiriladigan to‘lovlar: ${paymentsPending}`);
}
async function pollTelegram() {
  if (!TELEGRAM_BOT_TOKEN || telegramPolling) return;
  telegramPolling = true;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?timeout=25&offset=${telegramOffset}`);
    const data = await r.json();
    if (data.ok && Array.isArray(data.result)) for (const update of data.result) {
      telegramOffset = update.update_id + 1;
      if (update.callback_query) {
        const q = update.callback_query, chatId = String(q.message?.chat?.id || ''), role = await adminInfo(chatId);
        if (/^(payok|payno):/.test(q.data || '')) {
          if (!role || !['owner', 'main'].includes(role.level)) { await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Bu amal uchun ruxsat yo‘q.' }); continue; }
          const [action, paymentId] = q.data.split(':');
          const payment = await payments.findOne({ id: paymentId, status: 'pending' });
          if (!payment) { await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'To‘lov allaqachon ko‘rib chiqilgan.' }); continue; }
          if (action === 'payok') {
            const days = Number(payment.days || (await tariffs.findOne({ id: payment.planId }))?.days || 0);
            if (!days) { await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Tarif muddati topilmadi.' }); continue; }
            const result = await payments.updateOne({ id: paymentId, status: 'pending' }, { $set: { status: 'activating', reviewed: Date.now(), reviewedBy: chatId } });
            if (!result.modifiedCount) { await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Boshqa admin avval ko‘rib chiqdi.' }); continue; }
            const paidUser = await users.findOne({ id: payment.userId });
            if (!paidUser) { await payments.updateOne({ id: paymentId }, { $set: { status: 'activation_error', reviewed: Date.now(), reviewedBy: chatId } }); await telegramSend(chatId, 'To‘lov tasdiqlandi, ammo sayt hisobi topilmadi. Adminga murojaat qiling.'); continue; }
            const startFrom = Math.max(Date.now(), Number(paidUser.proUntil || 0));
            const proUntil = startFrom + days * 24 * 60 * 60 * 1000;
            await users.updateOne({ id: paidUser.id }, { $set: { proUntil } });
            await payments.updateOne({ id: paymentId }, { $set: { status: 'approved', proActivated: true, proUntil } });
            await telegramSend(payment.chatId, `✅ To‘lovingiz tasdiqlandi va Pro obuna faollashtirildi!\n\nSayt akkaunti: ${paidUser.username}\nSayt ID: ${paidUser.id}\nTarif: ${payment.planName}\nMuddat: ${days} kun\nAmal qilish muddati: ${new Date(proUntil).toLocaleDateString('uz-UZ')}\n\nSaytga aynan ${paidUser.username} akkaunti orqali kiring va sahifani yangilang.`, { reply_markup: USER_MENU });
            await logAdmin(chatId, 'payment_approved', paymentId);
          } else {
            const result = await payments.updateOne({ id: paymentId, status: 'pending' }, { $set: { status: 'rejected', reviewed: Date.now(), reviewedBy: chatId } });
            if (!result.modifiedCount) { await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Boshqa admin avval ko‘rib chiqdi.' }); continue; }
            await telegramSend(payment.chatId, '❌ To‘lov chekingiz rad etildi. Chek va summani tekshirib, qayta yuboring yoki adminga murojaat qiling.', { reply_markup: USER_MENU });
            await logAdmin(chatId, 'payment_rejected', paymentId);
          }
          await telegramApi('editMessageReplyMarkup', { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
          await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: action === 'payok' ? 'Tasdiqlandi.' : 'Rad etildi.' });
          continue;
        }
        const [kind, itemId] = String(q.data || '').split(':');
        if (kind === 'selectacct') {
          const account = await users.findOne({ id: itemId, telegramChatId: chatId, role: 'user' });
          if (!account) { await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Akkaunt topilmadi yoki Telegramga ulanmagan.' }); continue; }
          await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: `${account.username} tanlandi.` });
          try { await telegramApi('editMessageReplyMarkup', { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }); } catch {}
          await showBotPlans(chatId, account.id);
          continue;
        }
        if (kind === 'buyplan') {
          const selected = await botSettings.findOne({ key: 'selectedProAccount', chatId });
          const user = selected?.userId ? await users.findOne({ id: selected.userId, telegramChatId: chatId, role: 'user' }) : null;
          const plan = await tariffs.findOne({ id: itemId });
          if (!user) {
            await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Avval sayt akkauntingizni tanlang.' });
            await showBotPlans(chatId);
            continue;
          }
          if (!plan) { await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Tarif topilmadi.' }); continue; }
          const existing = await payments.findOne({ chatId, status: 'waiting_receipt' });
          if (existing) {
            await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: 'Avval oldingi to‘lov chekingizni yuboring.' });
            await telegramSend(chatId, `Sizda hali chek kutilayotgan to‘lov bor.\nSayt akkaunti: ${existing.username}\nTarif: ${existing.planName}\nAvval shu to‘lov chekini yuboring.`, { reply_markup: USER_MENU });
            continue;
          }
          const setting = await botSettings.findOne({ key: 'paymentDetails' });
          const payment = {
            id: crypto.randomUUID(), userId: user.id, username: user.username, siteUserId: user.id,
            telegramUsername: user.telegramUsername || null, telegramUserId: user.telegramUserId || chatId,
            chatId, planId: plan.id, planName: plan.name, price: plan.price, days: plan.days,
            status: 'waiting_receipt', created: Date.now()
          };
          await payments.insertOne(payment);
          await botSettings.deleteOne({ key: 'selectedProAccount', chatId });
          await telegramSend(chatId, `📦 Sayt akkaunti: ${user.username}\nSayt ID: ${user.id}\n\nTarif: ${plan.name}\n💰 Narxi: ${plan.price}\n⏳ Muddati: ${plan.days} kun\n\n💳 To‘lov ma’lumotlari:\n${setting?.value || 'To‘lov rekvizitlari hali sozlanmagan. Adminga murojaat qiling.'}\n\nTo‘lovdan so‘ng chek rasmini shu chatga yuboring. Chek aynan ${user.username} akkaunti uchun rasmiylashtiriladi.`, { reply_markup: USER_MENU });
          await telegramApi('answerCallbackQuery', { callback_query_id: q.id, text: `${user.username} uchun tarif tanlandi.` });
        }
        continue;
      }
      const msg = update.message; if (!msg?.chat) continue;
      const chatId = String(msg.chat.id), text = String(msg.text || msg.caption || '').trim();
      const tgFrom = msg.from || {};
      await users.updateMany({ telegramChatId: chatId }, { $set: { telegramUserId: String(tgFrom.id || chatId), telegramUsername: tgFrom.username || null, telegramFirstName: tgFrom.first_name || null } });
      const actualRole = await adminInfo(chatId);
      const blocked = await blockedUsers.findOne({ chatId, active: true });
      if (blocked && actualRole?.level !== 'owner') { await telegramSend(chatId, '⛔ Botdan foydalanishingiz cheklangan.'); continue; }

      // Admin rejimini faqat admin huquqi bor Telegram akkaunt yoqa oladi.
      if (text === '/adminpanel' || text === '/panel') {
        if (!actualRole) { await telegramSend(chatId, '⛔ Sizda admin panelga kirish huquqi yo‘q.', { reply_markup: USER_MENU }); continue; }
        adminPanelChats.add(chatId);
        await telegramSend(chatId, `🛡 Admin panel yoqildi. Darajangiz: ${actualRole.level === 'owner' ? 'Owner' : actualRole.level === 'main' ? 'Main Admin' : 'Oddiy Admin'}.\n\nOddiy foydalanuvchi rejimiga qaytish uchun /exit buyrug‘ini yuboring.`, { reply_markup: menuFor(actualRole) });
        continue;
      }
      if (text === '/exit') {
        adminPanelChats.delete(chatId);
        await telegramSend(chatId, '✅ Oddiy foydalanuvchi rejimiga qaytdingiz. Admin huquqlaringiz saqlanadi. Qayta kirish uchun /adminpanel yuboring.', { reply_markup: USER_MENU });
        continue;
      }

      const role = actualRole && adminPanelChats.has(chatId) ? actualRole : null;
      const isAdmin = !!role, owner = role?.level === 'owner', manager = ['owner', 'main'].includes(role?.level);

      // Admin murojaatiga javob: barcha admin darajalari uchun.
      if (isAdmin && msg.reply_to_message) {
        const link = await botReplies.findOne({ adminMessageId: msg.reply_to_message.message_id });
        if (link && text) { await telegramSend(link.userChatId, `💬 Adminning javobi:\n\n${text}`, { reply_markup: USER_MENU }); await telegramSend(chatId, '✅ Javob anonim tarzda yuborildi.'); await logAdmin(chatId, 'contact_reply', link.userChatId); continue; }
      }
      if (text === '/id') { await telegramSend(chatId, `Telegram ID raqamingiz: ${chatId}`); continue; }

      // Owner-only boshqaruv buyruqlari.
      if (owner && text.startsWith('/addmain ')) { const id = text.split(/\s+/)[1]; if (!/^\d+$/.test(id) || id === ADMIN_TELEGRAM_ID) { await telegramSend(chatId, 'ID noto‘g‘ri.'); continue; } await telegramAdmins.updateOne({ chatId: id }, { $set: { chatId: id, level: 'main', active: true, addedBy: chatId, updated: Date.now() } }, { upsert: true }); await logAdmin(chatId, 'add_main_admin', id); await telegramSend(chatId, `✅ ${id} Main Admin qilindi.`); continue; }
      if (owner && text.startsWith('/addadmin ')) { const id = text.split(/\s+/)[1]; if (!/^\d+$/.test(id) || id === ADMIN_TELEGRAM_ID) { await telegramSend(chatId, 'ID noto‘g‘ri.'); continue; } await telegramAdmins.updateOne({ chatId: id }, { $set: { chatId: id, level: 'ordinary', active: true, addedBy: chatId, updated: Date.now() } }, { upsert: true }); await logAdmin(chatId, 'add_ordinary_admin', id); await telegramSend(chatId, `✅ ${id} Oddiy Admin qilindi.`); continue; }
      if (owner && text.startsWith('/removeadmin ')) { const id = text.split(/\s+/)[1]; if (id === ADMIN_TELEGRAM_ID) { await telegramSend(chatId, 'Owner huquqini bu buyruq bilan olib bo‘lmaydi.'); continue; } await telegramAdmins.updateOne({ chatId: id }, { $set: { active: false, updated: Date.now() } }); await logAdmin(chatId, 'remove_admin', id); await telegramSend(chatId, `✅ ${id} adminlikdan olindi.`); continue; }
      if (owner && text.startsWith('/block ')) { const id = text.split(/\s+/)[1]; if (!/^\d+$/.test(id) || id === ADMIN_TELEGRAM_ID) { await telegramSend(chatId, 'ID noto‘g‘ri yoki Owner bloklanmaydi.'); continue; } await blockedUsers.updateOne({ chatId: id }, { $set: { chatId: id, active: true, blockedBy: chatId, created: Date.now() } }, { upsert: true }); await logAdmin(chatId, 'block_user', id); await telegramSend(chatId, `🚫 ${id} bloklandi.`); continue; }
      if (owner && text.startsWith('/unblock ')) { const id = text.split(/\s+/)[1]; await blockedUsers.updateOne({ chatId: id }, { $set: { active: false } }); await logAdmin(chatId, 'unblock_user', id); await telegramSend(chatId, `✅ ${id} blokdan chiqarildi.`); continue; }

      // Bot ichidan to'lov rekvizitlari, tariflar va e'lonlarni boshqarish.
      if (manager && (text === '💳 To‘lov sozlamalari' || text === '/setpayment')) { await botSettings.updateOne({ key: 'waitingPaymentDetails', ownerChatId: chatId }, { $set: { value: true, ownerChatId: chatId } }, { upsert: true }); await telegramSend(chatId, 'Yangi to‘lov rekvizitlarini bitta xabar qilib yuboring.'); continue; }
      const waitingPay = manager ? await botSettings.findOne({ key: 'waitingPaymentDetails', value: true, ownerChatId: chatId }) : null;
      if (waitingPay && text) { await botSettings.updateOne({ key: 'paymentDetails' }, { $set: { value: text, updated: Date.now() } }, { upsert: true }); await botSettings.updateOne({ key: 'waitingPaymentDetails', ownerChatId: chatId }, { $set: { value: false } }); await logAdmin(chatId, 'update_payment_details'); await telegramSend(chatId, '✅ To‘lov rekvizitlari saqlandi.'); continue; }
      if (manager && (text === '💎 Tariflar' || text === '/plansadmin')) { const list = await tariffs.find({}).sort({ days: 1 }).toArray(); await telegramSend(chatId, `Tariflar:\n${list.map(p => `${p.name} — ${p.price} — ${p.days} kun (ID: ${p.id})`).join('\n') || 'Hozircha tarif yo‘q'}\n\nYangi tarif: /addplan Nomi | Narxi | Kun\nTahrirlash: /editplan ID | Yangi nom | Yangi narx | Kun\nO‘chirish: /delplan ID`); continue; }
      if (manager && text.startsWith('/addplan ')) { const parts = text.slice(9).split('|').map(x => x.trim()); const days = Number(parts[2]); if (parts.length < 3 || !parts[0] || !parts[1] || !Number.isInteger(days) || days < 1 || days > 3650) { await telegramSend(chatId, 'Format: /addplan Nomi | Narxi | Kun'); continue; } const p = { id: crypto.randomUUID(), name: parts[0].slice(0, 40), price: parts[1].slice(0, 40), days, created: Date.now() }; await tariffs.insertOne(p); await logAdmin(chatId, 'add_plan', `${p.name};${p.price};${days}`); await telegramSend(chatId, '✅ Tarif qo‘shildi.'); continue; }
      if (manager && text.startsWith('/delplan ')) { const id = text.slice(9).trim(); await tariffs.deleteOne({ id }); await logAdmin(chatId, 'delete_plan', id); await telegramSend(chatId, '✅ Tarif o‘chirildi.'); continue; }
      if (manager && text.startsWith('/editplan ')) { const parts = text.slice(10).split('|').map(x => x.trim()); const days = Number(parts[3]); if (parts.length < 4 || !parts[0] || !parts[1] || !parts[2] || !Number.isInteger(days) || days < 1 || days > 3650) { await telegramSend(chatId, 'Format: /editplan ID | Yangi nom | Yangi narx | Kun'); continue; } const result = await tariffs.updateOne({ id: parts[0] }, { $set: { name: parts[1].slice(0, 40), price: parts[2].slice(0, 40), days, updated: Date.now() } }); if (result.matchedCount) { await logAdmin(chatId, 'edit_plan', parts.join('|')); await telegramSend(chatId, '✅ Tarif yangilandi.'); } else await telegramSend(chatId, 'Bunday tarif ID topilmadi.'); continue; }
      if (manager && (text === '📢 E’lon yuborish' || text === '/announce')) { await botSettings.updateOne({ key: 'waitingAnnouncement', ownerChatId: chatId }, { $set: { value: true } }, { upsert: true }); await telegramSend(chatId, 'Barcha foydalanuvchilarga yuboriladigan e’lon matnini yuboring.'); continue; }
      const waitingAnn = manager ? await botSettings.findOne({ key: 'waitingAnnouncement', ownerChatId: chatId, value: true }) : null;
      if (waitingAnn && text) { const targets = await users.find({ telegramChatId: { $exists: true, $ne: null } }, { projection: { telegramChatId: 1 } }).toArray(); let sent = 0; for (const u of targets) { try { await telegramSend(u.telegramChatId, `📢 E’LON\n\n${text}`); sent++; } catch (e) { console.error('E’lon yuborilmadi:', e.message); } } await botSettings.updateOne({ key: 'waitingAnnouncement', ownerChatId: chatId }, { $set: { value: false } }); await logAdmin(chatId, 'announcement', `sent:${sent}`); await telegramSend(chatId, `✅ E’lon ${sent} ta foydalanuvchiga yuborildi.`); continue; }

      if (owner && text === '🛡 Adminlar') { const rows = await telegramAdmins.find({ active: true }).toArray(); await telegramSend(chatId, `Adminlar:\n${rows.map(a => `${a.level === 'main' ? 'Main Admin' : 'Oddiy Admin'}: ${a.chatId}`).join('\n') || 'Qo‘shimcha admin yo‘q'}\n\nQo‘shish: /addmain ID yoki /addadmin ID\nO‘chirish: /removeadmin ID`); continue; }
      if (manager && (text === '👥 Foydalanuvchilar' || text === '/users')) { let rows = await users.find({ role: 'user' }).sort({ created: -1 }).limit(10).toArray(); const chatIds = [...new Set(rows.map(u => u.telegramChatId).filter(Boolean).map(String))]; for (const linkedChatId of chatIds) { try { const tg = await telegramApi('getChat', { chat_id: linkedChatId }); await users.updateMany({ telegramChatId: linkedChatId }, { $set: { telegramUserId: String(tg.id || linkedChatId), telegramUsername: tg.username || null, telegramFirstName: tg.first_name || null } }); } catch (e) { console.error('Telegram profilini olishda xato:', linkedChatId, e.message); } } rows = await users.find({ role: 'user' }).sort({ created: -1 }).limit(10).toArray(); const lines = rows.map((u, i) => `${i + 1}. ${u.username}\nSayt ID: ${u.id}\nTelegram username: ${u.telegramUsername ? '@' + u.telegramUsername : 'Username mavjud emas'}\nTelegram ID: ${u.telegramUserId || u.telegramChatId || 'Telegram ulanmagan'}\nHolat: ${u.telegramChatId ? 'Ulangan' : 'Telegram ulanmagan'}`); await telegramSend(chatId, `Oxirgi ${rows.length} foydalanuvchi:\n\n${lines.join('\n\n') || 'Foydalanuvchi yo‘q'}`); continue; }
      if (owner && text === '🚫 Bloklash') { await telegramSend(chatId, 'Bloklash: /block TELEGRAM_ID\nBlokdan chiqarish: /unblock TELEGRAM_ID'); continue; }

      // To'lov cheki rasmini Owner va Main Adminlarga uzatish.
      if (!isAdmin && ((msg.photo?.length) || (msg.document && String(msg.document.mime_type || '').startsWith('image/')))) {
        const pendingPayment = await payments.findOne({ chatId, status: 'waiting_receipt' }, { sort: { created: -1 } });
        if (pendingPayment) { const reviewers = await activeAdmins(false); if (!reviewers.length) { await telegramSend(chatId, 'Admin sozlanmagan. Keyinroq urinib ko‘ring.'); continue; }
          const caption = `🧾 PRO OBUNA TO‘LOVI\nSayt akkaunti: ${pendingPayment.username}\nSayt akkaunt ID: ${pendingPayment.siteUserId || pendingPayment.userId}\nTelegram username: ${pendingPayment.telegramUsername ? '@' + pendingPayment.telegramUsername : 'Username mavjud emas'}\nTelegram ID: ${pendingPayment.telegramUserId || pendingPayment.chatId}\nTarif: ${pendingPayment.planName}\nNarx: ${pendingPayment.price}\nMuddat: ${pendingPayment.days} kun\nTo‘lov ID: ${pendingPayment.id}`;
          await payments.updateOne({ id: pendingPayment.id }, { $set: { status: 'pending', receiptAt: Date.now() } });
          for (const reviewer of reviewers) { try { const copied = await telegramApi('copyMessage', { chat_id: reviewer, from_chat_id: chatId, message_id: msg.message_id, caption, reply_markup: { inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: `payok:${pendingPayment.id}` }, { text: '❌ Rad etish', callback_data: `payno:${pendingPayment.id}` }]] } }); await payments.updateOne({ id: pendingPayment.id }, { $addToSet: { reviewerMessageIds: { chatId: reviewer, messageId: copied.message_id } } }); } catch (e) { console.error('Chek adminlarga yuborilmadi:', e.message); } }
          await telegramSend(chatId, '✅ Chekingiz adminlarga yuborildi. Tekshirilgach, natija shu botga keladi.', { reply_markup: USER_MENU });
        } else await telegramSend(chatId, 'Avval 💎 Pro obuna olish bo‘limidan tarif tanlang.');
        continue;
      }

      if (text.startsWith('/start')) {
        const match = text.match(/^\/start\s+([a-f0-9]{36})$/i);
        if (match) { const pending = await pendingRegs.findOne({ nonce: match[1], expires: { $gt: Date.now() } }); if (!pending?.codeForBot) { await telegramSend(chatId, 'Tasdiqlash havolasi eskirgan. Saytda qaytadan ro‘yxatdan o‘tishni boshlang.', { reply_markup: USER_MENU }); continue; } await pendingRegs.updateOne({ nonce: pending.nonce }, { $set: { chatId, telegramUserId: String((msg.from || {}).id || chatId), telegramUsername: (msg.from || {}).username || null, telegramFirstName: (msg.from || {}).first_name || null } }); await telegramSend(chatId, `Assalomu alaykum! 👋\n\nTelegram foydalanuvchisi: ${displayTelegramUser(msg.from || {})}\n\nSaytingiz uchun tasdiqlash kodingiz: ${pending.codeForBot}`, { reply_markup: menuFor(role) }); continue; }
        if (/^\/start\s+pro$/i.test(text)) { await showBotPlans(chatId); continue; }
        await telegramSend(chatId, 'Assalomu alaykum! 👋\nVerification botiga xush kelibsiz.', { reply_markup: menuFor(role) }); continue;
      }
      if ((text === '📊 Statistika' || text === '/stats') && isAdmin) { await showStats(chatId); continue; }
      if ((text === '📊 Statistika' || text === '/stats') && !isAdmin) { await telegramSend(chatId, 'Bu bo‘lim faqat adminlar uchun.', { reply_markup: USER_MENU }); continue; }
      if (text === '💎 Pro obuna olish' || text === '/plans') { await showBotPlans(chatId); continue; }
      if (text === '❓ Yordam' || text === '/help') { await telegramSend(chatId, '❓ Yordam\n\n• Saytda ro‘yxatdan o‘tish uchun Telegram havolasini oching.\n• Bot yuborgan 6 xonali kodni saytga kiriting.\n• Pro obuna uchun “💎 Pro obuna olish” tugmasini bosing.\n• Muammo bo‘lsa “📩 Adminga murojaat” bo‘limidan yozing.', { reply_markup: menuFor(role) }); continue; }
      if (text === '📩 Adminga murojaat' || text === '/contact') { await botReplies.updateOne({ userChatId: chatId }, { $set: { waitingForMessage: true, updated: Date.now() } }, { upsert: true }); await telegramSend(chatId, '✉️ Xabaringizni shu yerga yozing. U adminlarga anonim tarzda yetkaziladi.', { reply_markup: menuFor(role) }); continue; }
      const contactState = await botReplies.findOne({ userChatId: chatId, waitingForMessage: true });
      if (contactState && !isAdmin) { const reviewers = await activeAdmins(true); if (!reviewers.length) { await telegramSend(chatId, 'Hozircha admin manzili sozlanmagan.'); continue; } let sent = 0; for (const reviewer of reviewers) { try { const f = await telegramSend(reviewer, `📩 Yangi anonim murojaat\nFoydalanuvchi: ${displayTelegramUser(msg.from || {})}\nChat ID: ${chatId}\n\nXabar:\n${text}\n\nJavob berish uchun shu xabarga Reply qiling.`); await botReplies.insertOne({ adminMessageId: f.message_id, userChatId: chatId, created: Date.now() }); sent++; } catch (e) { console.error('Murojaat yuborilmadi:', e.message); } } await botReplies.updateOne({ userChatId: chatId }, { $set: { waitingForMessage: false, updated: Date.now() } }); await telegramSend(chatId, `✅ Xabaringiz ${sent} ta admin chatiga yuborildi. Javob shu bot orqali keladi.`, { reply_markup: USER_MENU }); continue; }
      if (isAdmin) await telegramSend(chatId, `Sizning darajangiz: ${role.level === 'owner' ? 'Owner' : role.level === 'main' ? 'Main Admin' : 'Oddiy Admin'}. Menyudan bo‘lim tanlang.`, { reply_markup: menuFor(role) });
      else await telegramSend(chatId, 'Menyudan kerakli bo‘limni tanlang.', { reply_markup: USER_MENU });
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
  tests = db.collection('tests');
  botReplies = db.collection('botReplies');
  payments = db.collection('payments');
  botSettings = db.collection('botSettings');
  telegramAdmins = db.collection('telegramAdmins');
  blockedUsers = db.collection('blockedUsers');
  adminLogs = db.collection('adminLogs');
  await pendingRegs.createIndex({ nonce: 1 }, { unique: true });
  await botReplies.createIndex({ adminMessageId: 1 });
  await botReplies.createIndex({ userChatId: 1 });
  await payments.createIndex({ id: 1 }, { unique: true });
  await telegramAdmins.createIndex({ chatId: 1 }, { unique: true });
  await blockedUsers.createIndex({ chatId: 1 }, { unique: true });
  await adminLogs.createIndex({ created: -1 });
  await payments.createIndex({ chatId: 1, status:  1, created: -1 });
  await promos.createIndex({ code: 1 }, { unique: true });
  await genres.createIndex({ lower: 1 }, { unique: true });
  const meta = db.collection('meta');
  if (!(await meta.findOne({ k: 'genres' }))) {   // boshlang'ich janrlar bir marta qo'shiladi
    await meta.insertOne({ k: 'genres' });
    for (const n of ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Samuray'])
      await genres.updateOne({ lower: n.toLowerCase() }, { $setOnInsert: { id: crypto.randomUUID(), name: n, lower: n.toLowerCase() } }, { upsert: true });
  }
  if (!(await meta.findOne({ k: 'cats-v2' }))) {   // dasturlash yo'nalishlari bir marta qo'shiladi
    await meta.insertOne({ k: 'cats-v2' });
    await genres.deleteMany({ lower: { $in: ['action', 'adventure', 'comedy', 'drama', 'fantasy', 'romance', 'sci-fi', 'samuray'] } });
    for (const n of ['Python', 'JavaScript', 'Web dasturlash', 'Mobil ilovalar', "Ma'lumotlar bazasi", 'Algoritmlar', "Sun'iy intellekt", "Boshlang'ich"])
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
  app.listen(process.env.PORT || 3000, () => { console.log('Sayt ishga tushdi'); if (TELEGRAM_BOT_TOKEN) { if (!ADMIN_TELEGRAM_ID) console.warn('ADMIN_TELEGRAM_ID kiritilmagan: admin xabarlari va anonim murojaatlar ishlamaydi.'); pollTelegram(); } else console.warn('TELEGRAM_BOT_TOKEN kiritilmagan: Telegram tasdiqlash o‘chiq.'); });
})().catch(e => { console.error('Bazaga ulanib bo\'lmadi:', e.message); process.exit(1); });




