'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { q, DATA_DIR } = require('./db');
const U = require('./util');
const { HttpError, str, clampInt, jparse } = U;
const META = require('./meta');
const S = require('./services');
const { valuate } = require('./valuation');
const SEO = require('./seo');
const TILES = require('./tiles');
const { smartParse } = require('./nlp');
const art = require('./art');
const A = require('./analytics');
const B = require('./bootstrap');
const X = require('./extern');

const PORT = +process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const UPLOADS = path.join(DATA_DIR, 'uploads');

B.start();

// ------------------------------------------------------------------ router
const routes = [];
function route(method, pattern, ...rest) {
  const handler = rest.pop(); const opts = Object.assign({}, ...rest);
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, opts, handler });
}
const get = (p, ...a) => route('GET', p, ...a);
const post = (p, ...a) => route('POST', p, ...a);
const put = (p, ...a) => route('PUT', p, ...a);
const del = (p, ...a) => route('DELETE', p, ...a);
const AUTH = { auth: true }, AGENT = { auth: 'agent' }, ADMIN = { auth: 'admin' };

function currentUser(req) {
  const h = req.headers.authorization || '';
  const p = U.verifyToken(h.startsWith('Bearer ') ? h.slice(7) : null);
  if (!p) return null;
  const u = q.get('SELECT * FROM users WHERE id=?', p.id);
  return u && !u.banned && (p.pv || 0) === (u.pwv || 0) ? u : null;
}
function requireRole(user, need) {
  if (!user) throw new HttpError(401, 'برای ادامه وارد حساب کاربری شوید.');
  if (need === 'admin' && user.role !== 'admin') throw new HttpError(403, 'دسترسی مجاز نیست.');
  if (need === 'agent' && !['agent', 'admin'].includes(user.role)) throw new HttpError(403, 'این بخش مخصوص مشاوران املاک است.');
}
const TRUST_PROXY = /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || '');
const ip = (req) => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'x';

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'حجم درخواست بیش از حد مجاز است.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'قالب درخواست نامعتبر است.')); }
    });
    req.on('error', reject);
  });
}

function send(req, res, status, data, headers = {}) {
  const isBuf = Buffer.isBuffer(data) || typeof data === 'string';
  let body = isBuf ? data : JSON.stringify(data);
  const h = { 'Content-Type': isBuf ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', ...headers };
  const ct = h['Content-Type'];
  if (/json|text|javascript|svg|xml/.test(ct) && body.length > 800 && /gzip/.test(req.headers['accept-encoding'] || '')) {
    body = zlib.gzipSync(body); h['Content-Encoding'] = 'gzip'; h.Vary = 'Accept-Encoding';
  }
  h['Content-Length'] = Buffer.byteLength(body);
  res.writeHead(status, h); res.end(body);
}

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

const brCache = new Map();
function serveFile(req, res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(req, res, 404, { error: 'یافت نشد.' });
    const etag = `W/"${st.size}-${Math.round(st.mtimeMs)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304); return res.end(); }
    const ext = path.extname(file).toLowerCase();
    fs.readFile(file, (e, buf) => {
      if (e) return send(req, res, 500, { error: 'خطا' });
      const h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache, ETag: etag };
      // فشرده‌سازی Brotli (یک‌بار ساخته و در حافظه نگه داشته می‌شود) — برای اینترنت‌های کند بسیار مؤثر است
      if (/\.(html|js|css|svg|json|webmanifest|txt)$/.test(ext ? file : '') && buf.length > 800 && /\bbr\b/.test(req.headers['accept-encoding'] || '')) {
        const k = file + etag; let z = brCache.get(k);
        if (!z) { z = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }); if (brCache.size > 200) brCache.clear(); brCache.set(k, z); }
        res.writeHead(200, { ...h, 'Content-Encoding': 'br', Vary: 'Accept-Encoding', 'Content-Length': z.length }); return res.end(z);
      }
      send(req, res, 200, buf, h);
    });
  });
}

// ------------------------------------------------------------------ helpers
const FEATURE_KEYS = new Set(META.FEATURES.map((f) => f.k));
function isMine(user, l) { return user && (user.role === 'admin' || user.id === l.owner_id); }
function userOut(u) {
  return { ...S.publicUser(u), phone: u.phone, email: u.email, banned: !!u.banned, license_no: u.license_no, unread: q.get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0', u.id).n };
}
function listingOrThrow(id) {
  const l = S.getListingRow(+id);
  if (!l) throw new HttpError(404, 'آگهی پیدا نشد.');
  return l;
}
function uploadFiles(images) { return jparse(images, []).filter((u) => typeof u === 'string' && u.startsWith('/uploads/')).map((u) => path.join(UPLOADS, path.basename(u))); }
function removeFiles(files) { for (const f of files) { try { fs.unlinkSync(f); } catch { /* already gone */ } } }
function removeListingFiles(row) {
  const mine = uploadFiles(row.images);
  const others = new Set(q.all('SELECT images FROM listings WHERE id<>?', row.id).flatMap((r) => uploadFiles(r.images)));
  removeFiles(mine.filter((f) => !others.has(f)));
}
function removeUserFiles(uid) { for (const r of q.all('SELECT * FROM listings WHERE owner_id=?', uid)) removeListingFiles(r); }
const seenViews = new Map();
function countView(req, id) {
  const k = ip(req) + ':' + id, now = Date.now();
  if (now - (seenViews.get(k) || 0) < 6 * 3600e3) return false;
  seenViews.set(k, now); if (seenViews.size > 20000) for (const [kk, t] of seenViews) if (now - t > 6 * 3600e3) seenViews.delete(kk);
  return true;
}
const isVerifiedPublisher = (u) => u.role === 'admin' || (u.role === 'agent' && u.verified);
function safeImage(u) { return typeof u === 'string' && /^\/(uploads|art)\/[\w\-./?=&]+$/.test(u) && !u.includes('..'); }

function cleanListing(b, existing = {}) {
  const o = {};
  const need = (k, msg) => { if (!b[k] && !existing[k]) throw new HttpError(400, msg); };
  need('title', 'عنوان آگهی الزامی است.'); need('deal', 'نوع معامله را انتخاب کنید.'); need('ptype', 'نوع ملک را انتخاب کنید.');
  o.title = str(b.title ?? existing.title, 120);
  if (o.title.length < 5) throw new HttpError(400, 'عنوان آگهی باید حداقل ۵ نویسه باشد.');
  o.description = str(b.description ?? existing.description ?? '', 4000);
  o.deal = b.deal ?? existing.deal; if (!META.DEALS[o.deal]) throw new HttpError(400, 'نوع معامله نامعتبر است.');
  o.ptype = b.ptype ?? existing.ptype; if (!META.PTYPES[o.ptype]) throw new HttpError(400, 'نوع ملک نامعتبر است.');
  o.city = b.city ?? existing.city; const c = META.findCity(o.city); if (!c) throw new HttpError(400, 'شهر نامعتبر است.');
  o.district = b.district ?? existing.district; const d = META.findDistrict(o.city, o.district); if (!d) throw new HttpError(400, 'محله نامعتبر است.');
  o.area = clampInt(b.area ?? existing.area, 5, 100000, 0); if (o.area < 5) throw new HttpError(400, 'متراژ نامعتبر است.');
  o.price = clampInt(b.price ?? existing.price ?? 0, 0, 1e15, 0);
  o.rent = clampInt(b.rent ?? existing.rent ?? 0, 0, 1e12, 0);
  if (o.deal !== 'swap' && o.price <= 0) throw new HttpError(400, o.deal === 'rent' ? 'مبلغ ودیعه (رهن) را وارد کنید.' : 'قیمت را وارد کنید.');
  if (o.deal !== 'rent') o.rent = 0;
  o.negotiable = b.negotiable !== undefined ? (b.negotiable ? 1 : 0) : existing.negotiable ?? 0;
  o.exchange = b.exchange !== undefined ? (b.exchange ? 1 : 0) : existing.exchange ?? 0;
  o.rooms = clampInt(b.rooms ?? existing.rooms ?? 0, 0, 20, 0);
  o.baths = clampInt(b.baths ?? existing.baths ?? 1, 0, 20, 1);
  const yr = b.year_built ?? existing.year_built; o.year_built = yr ? clampInt(yr, 1300, 1420, null) : null;
  const fl = b.floor ?? existing.floor; o.floor = fl === '' || fl == null ? null : clampInt(fl, -3, 100, 0);
  const ft = b.floors_total ?? existing.floors_total; o.floors_total = ft === '' || ft == null ? null : clampInt(ft, 1, 100, 1);
  const up = b.units_per_floor ?? existing.units_per_floor; o.units_per_floor = up === '' || up == null ? null : clampInt(up, 1, 30, 1);
  o.doc_type = str(b.doc_type ?? existing.doc_type ?? '', 40); o.direction = str(b.direction ?? existing.direction ?? '', 20); o.flooring = str(b.flooring ?? existing.flooring ?? '', 20);
  o.address = str(b.address ?? existing.address ?? '', 250);
  const feats = Array.isArray(b.features) ? b.features : jparse(existing.features, []);
  o.features = [...new Set(feats.filter((k) => FEATURE_KEYS.has(k)))];
  o.parking = +o.features.includes('parking'); o.storage = +o.features.includes('storage'); o.elevator = +o.features.includes('elevator');
  o.lat = Number.isFinite(+b.lat) && b.lat !== null && b.lat !== '' ? +b.lat : existing.lat ?? d.lat;
  o.lng = Number.isFinite(+b.lng) && b.lng !== null && b.lng !== '' ? +b.lng : existing.lng ?? d.lng;
  const imgs = Array.isArray(b.images) ? b.images : jparse(existing.images, []);
  o.images = imgs.filter(safeImage).slice(0, 20);
  const vu = str(b.video_url ?? existing.video_url ?? '', 300); o.video_url = /^https?:\/\//.test(vu) ? vu : '';
  return o;
}

function marketVerdict(l) {
  if (l.deal !== 'sale' || !l.area) return null;
  const v = valuate({ exclude: l.id, city: l.city, district: l.district, ptype: l.ptype, area: l.area, year_built: l.year_built, floor: l.floor, floors_total: l.floors_total, features: jparse(l.features, []) });
  if (!v) return null;
  const diff = ((l.price - v.price) / v.price) * 100;
  const verdict = diff < -8 ? 'great' : diff < 4 ? 'fair' : diff < 12 ? 'high' : 'over';
  return { estimate: v.price, low: v.low, high: v.high, diff: +diff.toFixed(1), verdict, growth12: v.growth12, districtPpm: v.districtPpm, basis: v.basis, samples: v.samples, confidence: v.confidence };
}

// ------------------------------------------------------------------ meta & public
get('/api/health', () => ({ ok: true, name: 'دال', time: new Date().toISOString() }));
get('/api/meta', () => ({
  site: X.getSite(),
  cities: META.CITIES.map((c) => ({ slug: c.slug, name: c.name, lat: c.lat, lng: c.lng, districts: c.districts.map((d) => ({ slug: d.slug, name: d.name, lat: d.lat, lng: d.lng, noGeo: !!d.noGeo, ppm: d.ppm })) })),
  ptypes: META.PTYPES, deals: META.DEALS, features: META.FEATURES, docTypes: META.DOC_TYPES, directions: META.DIRECTIONS, floorings: META.FLOORINGS, categories: META.CATEGORIES,
  rentRate: META.RENT_RATE_MONTHLY, expireDays: B.EXPIRE_DAYS,
}));

get('/api/stats/home', () => {
  const c = (sql, ...p) => q.get(sql, ...p).n;
  const byCity = q.all(`SELECT city, COUNT(*) n FROM listings WHERE status='active' GROUP BY city ORDER BY n DESC`).map((r) => ({ slug: r.city, name: META.findCity(r.city)?.name, n: r.n }));
  const byType = q.all(`SELECT ptype, COUNT(*) n FROM listings WHERE status='active' GROUP BY ptype ORDER BY n DESC`);
  const byDeal = q.all(`SELECT deal, COUNT(*) n FROM listings WHERE status='active' GROUP BY deal`);
  return {
    listings: c(`SELECT COUNT(*) n FROM listings WHERE status='active'`), agents: c(`SELECT COUNT(*) n FROM users WHERE role='agent'`),
    users: c('SELECT COUNT(*) n FROM users'), closed: c(`SELECT COUNT(*) n FROM listings WHERE status IN ('sold','rented')`), byCity, byType, byDeal,
    cities: META.CITIES.length, districts: META.allDistricts().length,
  };
});

get('/api/suggest', (ctx) => {
  const t = U.normFa(ctx.query.q || '').slice(0, 40); if (t.length < 1) return { items: [] };
  const out = [];
  for (const c of META.CITIES) {
    if (c.name.includes(t)) out.push({ type: 'city', label: c.name, city: c.slug });
    for (const d of c.districts) if (U.normFa(d.name).includes(t)) out.push({ type: 'district', label: `${d.name}، ${c.name}`, city: c.slug, district: d.slug });
  }
  if (/^d?\d{3,}$/i.test(t)) q.all(`SELECT id,code,title FROM listings WHERE status='active' AND code LIKE ? LIMIT 4`, `%${t.toUpperCase()}%`).forEach((l) => out.push({ type: 'listing', label: `${l.code} — ${l.title}`, id: l.id }));
  return { items: out.slice(0, 8) };
});

post('/api/smart-search', async (ctx) => {
  const text = str(ctx.body.q, 300);
  if (!text) throw new HttpError(400, 'جمله‌ی جستجو را بنویسید.');
  const parsed = smartParse(text);
  const f = { ...parsed.filters };
  const count = S.searchListings({ ...f, limit: 1 }).total;
  return { ...parsed, count };
});

// ------------------------------------------------------------------ auth
const tokenFor = (u) => U.signToken({ id: u.id, pv: u.pwv || 0 });
const tooMany = (msg = 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.') => new HttpError(429, msg);

get('/api/setup/status', () => ({ needsSetup: !B.hasAdmin() }));
post('/api/setup', (ctx) => {
  if (B.hasAdmin()) throw new HttpError(403, 'مدیر قبلاً ساخته شده است.');
  if (!U.rateLimit('setup:' + ip(ctx.req), 10, 3600e3)) throw tooMany();
  const b = ctx.body;
  if (!B.checkSetupToken(String(b.token || '').trim())) throw new HttpError(403, 'کد راه‌اندازی نادرست است. آن را در خروجی ترمینال سرور (یا فایل data/.setup-token) پیدا کنید.');
  const name = str(b.name, 60), phone = U.normPhone(b.phone), pw = String(b.password || '');
  if (name.length < 3) throw new HttpError(400, 'نام را وارد کنید.');
  if (!U.validPhone(phone)) throw new HttpError(400, 'شماره‌ی موبایل معتبر نیست (مثال: 09121234567).');
  if (!U.validPassword(pw)) throw new HttpError(400, 'رمز عبور باید حداقل ۸ نویسه و شامل حرف و عدد باشد.');
  const ex = q.get('SELECT id FROM users WHERE phone=?', phone); let id, recovery = U.makeRecoveryCode();
  if (ex) { id = ex.id; q.run(`UPDATE users SET role='admin', verified=1, password_hash=?, recovery_hash=?, pwv=pwv+1, name=? WHERE id=?`, U.hashPassword(pw), U.hashPassword(U.normCode(recovery)), name, id); }
  else ({ id, recovery } = B.createUser({ name, phone, password: pw, role: 'admin', verified: 1 }));
  B.setupToken();
  return { token: tokenFor(q.get('SELECT * FROM users WHERE id=?', id)), user: userOut(q.get('SELECT * FROM users WHERE id=?', id)), recovery };
});

post('/api/auth/register', (ctx) => {
  const b = ctx.body;
  if (!U.rateLimit('reg:' + ip(ctx.req), 10, 3600e3)) throw tooMany();
  const name = str(b.name, 60), phone = U.normPhone(b.phone), pw = String(b.password || '');
  if (name.length < 3) throw new HttpError(400, 'نام و نام خانوادگی را وارد کنید.');
  if (!U.validPhone(phone)) throw new HttpError(400, 'شماره‌ی موبایل معتبر نیست (مثال: 09121234567).');
  if (!U.validPassword(pw)) throw new HttpError(400, 'رمز عبور باید حداقل ۸ نویسه و شامل حرف و عدد باشد.');
  const email = str(b.email, 100); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'ایمیل معتبر نیست.');
  if (q.get('SELECT 1 FROM users WHERE phone=?', phone)) throw new HttpError(409, 'این شماره قبلاً ثبت‌نام کرده است.');
  const role = b.role === 'agent' ? 'agent' : 'user';
  if (role === 'agent' && str(b.license_no, 40).length < 3) throw new HttpError(400, 'برای ثبت‌نام مشاور، شماره‌ی پروانه‌ی کسب را وارد کنید.');
  const { id, recovery } = B.createUser({ name, phone, password: pw, role, agency: str(b.agency, 80) || null, license_no: str(b.license_no, 40) || null, city: str(b.city, 40) || null, email: email || null });
  for (const a of role === 'agent' ? q.all(`SELECT id FROM users WHERE role='admin'`) : []) S.notify(a.id, 'مشاور جدید در انتظار تأیید', `${name} — پروانه‌ی ${str(b.license_no, 40)}`, '#/admin/users');
  S.notify(id, 'به دال خوش آمدید 🏡', role === 'agent' ? 'حساب مشاور شما ساخته شد. پس از بررسی پروانه توسط مدیر، نشان «تأییدشده» می‌گیرید و آگهی‌هایتان بدون صف بررسی منتشر می‌شود.' : 'حالا می‌توانید آگهی‌ها را ذخیره کنید، وقت بازدید بگیرید و با مشاوران گفتگو کنید.', '#/dashboard');
  const user = q.get('SELECT * FROM users WHERE id=?', id);
  return { token: tokenFor(user), user: userOut(user), recovery };
});

post('/api/auth/login', (ctx) => {
  const phone = U.normPhone(ctx.body.phone), pw = String(ctx.body.password || '');
  if (!U.rateLimit(`login:${ip(ctx.req)}:${phone}`, 10, 15 * 60e3) || !U.rateLimit(`loginp:${phone}`, 30, 15 * 60e3)) throw tooMany('تلاش‌های ناموفق زیاد بود. ۱۵ دقیقه بعد دوباره تلاش کنید.');
  const u = q.get('SELECT * FROM users WHERE phone=?', phone);
  if (!u || !U.verifyPassword(pw, u.password_hash)) throw new HttpError(401, 'شماره یا رمز عبور اشتباه است.');
  if (u.banned) throw new HttpError(403, 'حساب شما مسدود شده است.');
  return { token: tokenFor(u), user: userOut(u) };
});

// بازیابی رمز با «کد بازیابی» که هنگام ثبت‌نام به کاربر داده شده است
post('/api/auth/reset', (ctx) => {
  const phone = U.normPhone(ctx.body.phone), code = U.normCode(ctx.body.code), pw = String(ctx.body.password || '');
  if (!U.rateLimit(`reset:${ip(ctx.req)}`, 8, 3600e3) || !U.rateLimit(`resetp:${phone}`, 8, 3600e3)) throw tooMany('تلاش‌های ناموفق زیاد بود. یک ساعت بعد دوباره تلاش کنید.');
  if (!U.validPassword(pw)) throw new HttpError(400, 'رمز جدید باید حداقل ۸ نویسه و شامل حرف و عدد باشد.');
  const u = q.get('SELECT * FROM users WHERE phone=?', phone);
  if (!u || !u.recovery_hash || code.length !== 12 || !U.verifyPassword(code, u.recovery_hash)) throw new HttpError(400, 'شماره یا کد بازیابی درست نیست. اگر کد را گم کرده‌اید، از مدیر سایت بخواهید رمز را بازنشانی کند.');
  if (u.banned) throw new HttpError(403, 'حساب شما مسدود شده است.');
  const fresh = U.makeRecoveryCode();
  q.run('UPDATE users SET password_hash=?, recovery_hash=?, pwv=pwv+1 WHERE id=?', U.hashPassword(pw), U.hashPassword(U.normCode(fresh)), u.id);
  const nu = q.get('SELECT * FROM users WHERE id=?', u.id);
  S.notify(u.id, 'رمز عبور شما تغییر کرد', 'اگر این کار را شما انجام نداده‌اید فوراً با مدیر تماس بگیرید.', '#/dashboard/profile');
  return { token: tokenFor(nu), user: userOut(nu), recovery: fresh };
});

get('/api/me', AUTH, (ctx) => ({ user: userOut(ctx.user) }));
put('/api/me', AUTH, (ctx) => {
  const b = ctx.body, u = ctx.user;
  const name = str(b.name ?? u.name, 60); if (name.length < 3) throw new HttpError(400, 'نام نامعتبر است.');
  const email = str(b.email ?? u.email, 100); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'ایمیل معتبر نیست.');
  q.run('UPDATE users SET name=?, email=?, bio=?, agency=?, city=?, experience=?, specialties=?, license_no=? WHERE id=?', name, email || null, str(b.bio ?? u.bio, 600) || null,
    str(b.agency ?? u.agency, 80) || null, str(b.city ?? u.city, 40) || null, clampInt(b.experience ?? u.experience, 0, 60, 0),
    JSON.stringify((Array.isArray(b.specialties) ? b.specialties : jparse(u.specialties, [])).map((x) => str(x, 30)).slice(0, 6)), str(b.license_no ?? u.license_no, 40) || null, u.id);
  return { user: userOut(q.get('SELECT * FROM users WHERE id=?', u.id)) };
});
put('/api/me/password', AUTH, (ctx) => {
  if (!U.rateLimit('chpw:' + ctx.user.id, 10, 3600e3)) throw tooMany();
  if (!U.verifyPassword(String(ctx.body.old || ''), ctx.user.password_hash)) throw new HttpError(400, 'رمز فعلی اشتباه است.');
  const n = String(ctx.body.password || ''); if (!U.validPassword(n)) throw new HttpError(400, 'رمز جدید باید حداقل ۸ نویسه و شامل حرف و عدد باشد.');
  q.run('UPDATE users SET password_hash=?, pwv=pwv+1 WHERE id=?', U.hashPassword(n), ctx.user.id);
  return { ok: true, token: tokenFor(q.get('SELECT * FROM users WHERE id=?', ctx.user.id)) };
});
post('/api/me/recovery', AUTH, (ctx) => {
  if (!U.rateLimit('recov:' + ctx.user.id, 10, 3600e3)) throw tooMany();
  if (!U.verifyPassword(String(ctx.body.password || ''), ctx.user.password_hash)) throw new HttpError(400, 'رمز عبور اشتباه است.');
  const fresh = U.makeRecoveryCode();
  q.run('UPDATE users SET recovery_hash=? WHERE id=?', U.hashPassword(U.normCode(fresh)), ctx.user.id);
  return { recovery: fresh };
});
del('/api/me', AUTH, (ctx) => {
  if (!U.verifyPassword(String(ctx.body.password || ''), ctx.user.password_hash)) throw new HttpError(400, 'رمز عبور اشتباه است.');
  if (ctx.user.role === 'admin' && q.get(`SELECT COUNT(*) n FROM users WHERE role='admin'`).n <= 1) throw new HttpError(400, 'آخرین مدیر سایت نمی‌تواند حذف شود.');
  removeUserFiles(ctx.user.id); q.run('DELETE FROM users WHERE id=?', ctx.user.id);
  return { ok: true };
});

// ------------------------------------------------------------------ listings
get('/api/listings', (ctx) => S.searchListings(ctx.query, { userId: ctx.user?.id }));

get('/api/listings/compare', (ctx) => {
  const ids = String(ctx.query.ids || '').split(',').map(Number).filter(Boolean).slice(0, 4);
  const items = ids.map((id) => S.getListingRow(id)).filter(Boolean).map((r) => {
    const l = S.mapListing(r, { full: true });
    const nb = META.findDistrict(r.city, r.district);
    l.scores = nb && nb.walk != null ? { walk: nb.walk, transit: nb.transit, safety: nb.safety, school: nb.school, shop: nb.shop, green: nb.green } : null;
    return l;
  });
  return { items };
});

get('/api/listings/map', (ctx) => {
  const r = S.searchListings({ ...ctx.query, limit: 100, page: 1 }, { userId: ctx.user?.id });
  return { items: r.items.filter((l) => l.lat && l.lng).map((l) => ({ id: l.id, title: l.title, lat: l.lat, lng: l.lng, price: l.price, rent: l.rent, deal: l.deal, ptype: l.ptype, area: l.area, rooms: l.rooms, img: l.images[0], districtName: l.districtName })), total: r.total };
});

get('/api/listings/:id', (ctx) => {
  const row = listingOrThrow(ctx.params.id);
  if (row.status !== 'active' && !isMine(ctx.user, row) && !['sold', 'rented'].includes(row.status)) throw new HttpError(404, 'این آگهی در دسترس نیست.');
  if (row.status === 'active' && !isMine(ctx.user, row) && countView(ctx.req, row.id)) {
    q.run('UPDATE listings SET views=views+1 WHERE id=?', row.id);
    q.run(`INSERT INTO view_log (listing_id,day,n) VALUES (?,date('now'),1) ON CONFLICT(listing_id,day) DO UPDATE SET n=n+1`, row.id);
    row.views++;
  } else if (row.status === 'active' && !isMine(ctx.user, row)) { /* بازدید تکراری */ }
  const l = S.mapListing(row, { full: true, favSet: S.favSetFor(ctx.user?.id) });
  const owner = S.publicUser(q.get('SELECT * FROM users WHERE id=?', row.owner_id));
  const nb = META.findDistrict(row.city, row.district);
  const price = row.deal === 'rent' ? row.price : row.price;
  const similar = q.all(`SELECT ${S.BASE_FIELDS} FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.status='active' AND l.id<>? AND l.deal=? AND l.city=? AND (l.district=? OR l.ptype=?) AND l.area BETWEEN ? AND ? AND l.price BETWEEN ? AND ? ORDER BY (l.district=?) DESC, ABS(l.area-?) LIMIT 6`,
    row.id, row.deal, row.city, row.district, row.ptype, row.area * 0.6, row.area * 1.5, price * 0.5, price * 1.6, row.district, row.area)
    .map((r) => S.mapListing(r, { favSet: S.favSetFor(ctx.user?.id) }));
  const history = q.all('SELECT price, rent, at FROM price_history WHERE listing_id=? ORDER BY at', row.id);
  const distAvg = q.get(`SELECT AVG(1.0*price/area) AS ppm, COUNT(*) n FROM listings WHERE status='active' AND deal='sale' AND city=? AND district=? AND area>0`, row.city, row.district);
  const trend = A.districtTrend(row.city, row.district).map(({ month, ppm }) => ({ month, ppm }));
  const base = A.districtBase(row.city, row.district);
  const days = q.all(`SELECT day, n FROM view_log WHERE listing_id=? ORDER BY day DESC LIMIT 14`, row.id).reverse();
  return {
    listing: l, owner, similar, history,
    neighborhood: nb && { name: nb.name, scores: nb.walk == null ? null : { walk: nb.walk, transit: nb.transit, safety: nb.safety, school: nb.school, shop: nb.shop, green: nb.green }, ppm: base.ppm, ppmSource: base.source, activeAvgPpm: distAvg.ppm ? Math.round(distAvg.ppm) : null, activeCount: distAvg.n, trend },
    market: marketVerdict(row), viewsByDay: isMine(ctx.user, row) ? days : undefined,
    canEdit: !!isMine(ctx.user, row),
    appointments: undefined,
  };
});

post('/api/listings/:id/phone', (ctx) => {
  if (!U.rateLimit('ph:' + ip(ctx.req), 60, 3600e3)) throw new HttpError(429, 'تعداد درخواست زیاد است.');
  const row = listingOrThrow(ctx.params.id);
  if (ctx.user && ctx.user.id !== row.owner_id) S.notify(row.owner_id, 'مشاهده‌ی شماره‌ی تماس', `${ctx.user.name} شماره‌ی شما را برای آگهی «${row.title}» مشاهده کرد.`, `#/listing/${row.id}`);
  return { phone: row.owner_phone };
});

post('/api/listings', AUTH, (ctx) => {
  if (!U.rateLimit('newl:' + ctx.user.id, 20, 3600e3)) throw new HttpError(429, 'تعداد آگهی ثبت‌شده در یک ساعت زیاد است.');
  const o = cleanListing(ctx.body);
  if (!o.images.length) throw new HttpError(400, 'حداقل یک تصویر از ملک آپلود کنید.');
  const status = isVerifiedPublisher(ctx.user) ? 'active' : 'pending';
  const code = S.genCode();
  const id = q.run(`INSERT INTO listings (code,owner_id,title,description,deal,ptype,price,rent,negotiable,area,rooms,baths,year_built,floor,floors_total,units_per_floor,parking,storage,elevator,doc_type,direction,flooring,city,district,address,lat,lng,features,images,video_url,status,exchange)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, code, ctx.user.id, o.title, o.description, o.deal, o.ptype, o.price, o.rent, o.negotiable, o.area, o.rooms, o.baths, o.year_built, o.floor, o.floors_total, o.units_per_floor,
    o.parking, o.storage, o.elevator, o.doc_type, o.direction, o.flooring, o.city, o.district, o.address, o.lat, o.lng, JSON.stringify(o.features), JSON.stringify(o.images), o.video_url, status, o.exchange).lastInsertRowid;
  q.run('INSERT INTO price_history (listing_id,price,rent) VALUES (?,?,?)', id, o.price, o.rent);
  A.invalidate();
  if (status === 'active') S.notifySavedSearches(id);
  else for (const a of q.all(`SELECT id FROM users WHERE role='admin'`)) S.notify(a.id, 'آگهی جدید در انتظار تأیید', o.title, '#/admin/listings');
  S.notify(ctx.user.id, status === 'active' ? 'آگهی شما منتشر شد ✅' : 'آگهی شما ثبت شد و در صف بررسی است', o.title, `#/listing/${id}`);
  return { id, status, code };
});

put('/api/listings/:id', AUTH, (ctx) => {
  const row = listingOrThrow(ctx.params.id);
  if (!isMine(ctx.user, row)) throw new HttpError(403, 'اجازه‌ی ویرایش این آگهی را ندارید.');
  const o = cleanListing(ctx.body, row);
  if (!o.images.length && !jparse(row.images, []).length) throw new HttpError(400, 'حداقل یک تصویر از ملک آپلود کنید.');
  // ویرایش آگهی ردشده یا ویرایش توسط ناشرِ تأییدنشده، آگهی را دوباره به صف بررسی می‌برد
  let nextStatus = row.status;
  if (ctx.user.role !== 'admin' && (row.status === 'rejected' || (row.status === 'active' && !isVerifiedPublisher(ctx.user)))) nextStatus = 'pending';
  if (nextStatus === 'pending' && row.status !== 'pending') for (const a of q.all(`SELECT id FROM users WHERE role='admin'`)) S.notify(a.id, 'آگهی ویرایش‌شده در انتظار بررسی', o.title, '#/admin/listings');
  A.invalidate();
  q.run(`UPDATE listings SET title=?,description=?,deal=?,ptype=?,price=?,rent=?,negotiable=?,area=?,rooms=?,baths=?,year_built=?,floor=?,floors_total=?,units_per_floor=?,parking=?,storage=?,elevator=?,doc_type=?,direction=?,flooring=?,city=?,district=?,address=?,lat=?,lng=?,features=?,images=?,video_url=?,exchange=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    o.title, o.description, o.deal, o.ptype, o.price, o.rent, o.negotiable, o.area, o.rooms, o.baths, o.year_built, o.floor, o.floors_total, o.units_per_floor, o.parking, o.storage, o.elevator, o.doc_type, o.direction, o.flooring, o.city, o.district, o.address, o.lat, o.lng,
    JSON.stringify(o.features), JSON.stringify(o.images.length ? o.images : jparse(row.images, [])), o.video_url, o.exchange, row.id);
  if (nextStatus !== row.status) q.run('UPDATE listings SET status=?, reject_reason=NULL WHERE id=?', nextStatus, row.id);
  { const keep = new Set(o.images); const dropped = jparse(row.images, []).filter((u) => !keep.has(u)); if (o.images.length && dropped.length) removeListingFiles({ id: row.id, images: JSON.stringify(dropped) }); }
  if (o.price !== row.price || o.rent !== row.rent) {
    q.run('INSERT INTO price_history (listing_id,price,rent) VALUES (?,?,?)', row.id, o.price, o.rent);
    for (const f of q.all('SELECT user_id FROM favorites WHERE listing_id=?', row.id)) if (f.user_id !== ctx.user.id)
      S.notify(f.user_id, o.price < row.price ? '📉 کاهش قیمت یک آگهی موردعلاقه' : 'تغییر قیمت یک آگهی موردعلاقه', o.title, `#/listing/${row.id}`);
  }
  return { ok: true, status: nextStatus };
});

put('/api/listings/:id/status', AUTH, (ctx) => {
  const row = listingOrThrow(ctx.params.id);
  if (!isMine(ctx.user, row)) throw new HttpError(403, 'دسترسی ندارید.');
  const st = ctx.body.status;
  if (!['active', 'sold', 'rented', 'archived'].includes(st)) throw new HttpError(400, 'وضعیت نامعتبر است.');
  if (st === 'active' && row.status === 'pending' && ctx.user.role !== 'admin') throw new HttpError(403, 'این آگهی در انتظار تأیید است.');
  if (st === 'active' && row.status === 'rejected' && ctx.user.role !== 'admin') throw new HttpError(403, 'آگهی ردشده را ویرایش و دوباره ارسال کنید.');
  if (st === 'active' && !isVerifiedPublisher(ctx.user) && row.status !== 'active') {
    // بازگرداندن آگهی بایگانی/فروخته‌شده توسط ناشرِ تأییدنشده → دوباره صف بررسی
    q.run(`UPDATE listings SET status='pending', renewed_at=CURRENT_TIMESTAMP, expire_warned=0, updated_at=CURRENT_TIMESTAMP WHERE id=?`, row.id);
    for (const a of q.all(`SELECT id FROM users WHERE role='admin'`)) S.notify(a.id, 'آگهی در انتظار بررسی', row.title, '#/admin/listings');
    A.invalidate(); return { ok: true, status: 'pending' };
  }
  q.run('UPDATE listings SET status=?, updated_at=CURRENT_TIMESTAMP, renewed_at=CASE WHEN ?=\'active\' THEN CURRENT_TIMESTAMP ELSE renewed_at END, expire_warned=0 WHERE id=?', st, st, row.id);
  if (st === 'active' && row.status !== 'active') S.notifySavedSearches(row.id);
  A.invalidate();
  return { ok: true, status: st };
});
post('/api/listings/:id/renew', AUTH, (ctx) => {
  const row = listingOrThrow(ctx.params.id);
  if (!isMine(ctx.user, row)) throw new HttpError(403, 'دسترسی ندارید.');
  if (!['active', 'archived'].includes(row.status)) throw new HttpError(400, 'فقط آگهی فعال یا بایگانی‌شده قابل تمدید است.');
  const st = row.status === 'archived' && !isVerifiedPublisher(ctx.user) ? 'pending' : 'active';
  q.run('UPDATE listings SET status=?, renewed_at=CURRENT_TIMESTAMP, expire_warned=0 WHERE id=?', st, row.id);
  if (st === 'pending') for (const a of q.all(`SELECT id FROM users WHERE role='admin'`)) S.notify(a.id, 'آگهی تمدیدشده در انتظار بررسی', row.title, '#/admin/listings');
  A.invalidate(); return { ok: true, status: st, days: B.EXPIRE_DAYS };
});

del('/api/listings/:id', AUTH, (ctx) => {
  const row = listingOrThrow(ctx.params.id);
  if (!isMine(ctx.user, row)) throw new HttpError(403, 'دسترسی ندارید.');
  removeListingFiles(row); q.run('DELETE FROM listings WHERE id=?', row.id); A.invalidate();
  return { ok: true };
});

post('/api/upload', AUTH, { limit: 6e6 }, (ctx) => {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(ctx.body.data || ''));
  if (!m) throw new HttpError(400, 'فقط تصویر PNG، JPG یا WebP مجاز است.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4e6) throw new HttpError(413, 'حجم تصویر نباید بیش از ۴ مگابایت باشد.');
  const sig = buf.subarray(0, 4).toString('hex');
  const okSig = (m[1] === 'png' && sig === '89504e47') || (m[1] === 'jpeg' && sig.startsWith('ffd8ff')) || (m[1] === 'webp' && sig === '52494646' && buf.subarray(8, 12).toString() === 'WEBP');
  if (!okSig) throw new HttpError(400, 'فایل تصویر معتبر نیست.');
  if (!U.rateLimit('up:' + ctx.user.id, 60, 3600e3)) throw new HttpError(429, 'تعداد آپلود زیاد است.');
  const name = crypto.randomBytes(10).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return { url: `/uploads/${name}` };
});

// ------------------------------------------------------------------ favorites / saved searches
get('/api/favorites', AUTH, (ctx) => {
  const rows = q.all(`SELECT ${S.BASE_FIELDS} FROM favorites f JOIN listings l ON l.id=f.listing_id JOIN users u ON u.id=l.owner_id WHERE f.user_id=? ORDER BY f.created_at DESC`, ctx.user.id);
  return { items: rows.map((r) => S.mapListing(r, { favSet: new Set(rows.map((x) => x.id)) })) };
});
post('/api/favorites/:id', AUTH, (ctx) => {
  const l = listingOrThrow(ctx.params.id);
  const ex = q.get('SELECT 1 FROM favorites WHERE user_id=? AND listing_id=?', ctx.user.id, l.id);
  if (ex) q.run('DELETE FROM favorites WHERE user_id=? AND listing_id=?', ctx.user.id, l.id);
  else q.run('INSERT INTO favorites (user_id,listing_id) VALUES (?,?)', ctx.user.id, l.id);
  return { fav: !ex };
});

get('/api/saved-searches', AUTH, (ctx) => ({ items: q.all('SELECT * FROM saved_searches WHERE user_id=? ORDER BY id DESC', ctx.user.id).map((s) => ({ ...s, query: jparse(s.query, {}), count: S.searchListings({ ...jparse(s.query, {}), limit: 1 }).total })) }));
post('/api/saved-searches', AUTH, (ctx) => {
  const query = {}; for (const [k, v] of Object.entries(ctx.body.query || {})) if (v !== '' && v != null && !['page', 'view', 'limit'].includes(k)) query[k] = str(v, 100);
  if (!Object.keys(query).length) throw new HttpError(400, 'ابتدا فیلتری برای جستجو انتخاب کنید.');
  if (q.get('SELECT COUNT(*) n FROM saved_searches WHERE user_id=?', ctx.user.id).n >= 20) throw new HttpError(400, 'حداکثر ۲۰ جستجوی ذخیره‌شده مجاز است.');
  const id = q.run('INSERT INTO saved_searches (user_id,name,query,notify) VALUES (?,?,?,1)', ctx.user.id, str(ctx.body.name, 80) || 'جستجوی من', JSON.stringify(query)).lastInsertRowid;
  return { id };
});
put('/api/saved-searches/:id', AUTH, (ctx) => { q.run('UPDATE saved_searches SET notify=? WHERE id=? AND user_id=?', ctx.body.notify ? 1 : 0, +ctx.params.id, ctx.user.id); return { ok: true }; });
del('/api/saved-searches/:id', AUTH, (ctx) => { q.run('DELETE FROM saved_searches WHERE id=? AND user_id=?', +ctx.params.id, ctx.user.id); return { ok: true }; });

// ------------------------------------------------------------------ inquiries / chat / appointments
post('/api/listings/:id/inquiries', (ctx) => {
  const l = listingOrThrow(ctx.params.id);
  if (!U.rateLimit('inq:' + ip(ctx.req), 15, 3600e3)) throw new HttpError(429, 'تعداد درخواست‌ها زیاد است.');
  const name = str(ctx.body.name || ctx.user?.name, 60), phone = U.normPhone(ctx.body.phone || ctx.user?.phone), message = str(ctx.body.message, 800);
  if (name.length < 2) throw new HttpError(400, 'نام خود را وارد کنید.');
  if (!U.validPhone(phone)) throw new HttpError(400, 'شماره‌ی موبایل معتبر نیست.');
  if (message.length < 3) throw new HttpError(400, 'پیام خود را بنویسید.');
  q.run('INSERT INTO inquiries (listing_id,user_id,name,phone,message) VALUES (?,?,?,?,?)', l.id, ctx.user?.id || null, name, phone, message);
  S.notify(l.owner_id, 'درخواست مشاوره‌ی جدید', `${name} درباره‌ی «${l.title}» پیام داد.`, '#/dashboard');
  return { ok: true };
});
get('/api/inquiries', AUTH, (ctx) => {
  const box = ctx.query.box === 'sent' ? 'sent' : 'received';
  const rows = box === 'sent'
    ? q.all(`SELECT i.*, l.title, l.code FROM inquiries i JOIN listings l ON l.id=i.listing_id WHERE i.user_id=? ORDER BY i.id DESC LIMIT 100`, ctx.user.id)
    : q.all(`SELECT i.*, l.title, l.code FROM inquiries i JOIN listings l ON l.id=i.listing_id WHERE l.owner_id=? ORDER BY i.id DESC LIMIT 100`, ctx.user.id);
  return { items: rows };
});
put('/api/inquiries/:id', AUTH, (ctx) => {
  const i = q.get('SELECT i.*, l.owner_id FROM inquiries i JOIN listings l ON l.id=i.listing_id WHERE i.id=?', +ctx.params.id);
  if (!i || i.owner_id !== ctx.user.id) throw new HttpError(404, 'یافت نشد.');
  q.run('UPDATE inquiries SET status=? WHERE id=?', ['new', 'contacted', 'closed'].includes(ctx.body.status) ? ctx.body.status : 'contacted', i.id);
  return { ok: true };
});

function threadFor(user, id) {
  const t = q.get('SELECT * FROM threads WHERE id=?', +id);
  if (!t || (t.buyer_id !== user.id && t.agent_id !== user.id)) throw new HttpError(404, 'گفتگو پیدا نشد.');
  return t;
}
get('/api/threads', AUTH, (ctx) => {
  const rows = q.all(`SELECT t.*, l.title AS listing_title, l.images AS listing_images,
    (SELECT body FROM messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
    (SELECT COUNT(*) FROM messages m WHERE m.thread_id=t.id AND m.sender_id<>? AND m.read=0) AS unread
    FROM threads t LEFT JOIN listings l ON l.id=t.listing_id WHERE t.buyer_id=? OR t.agent_id=? ORDER BY t.last_at DESC`, ctx.user.id, ctx.user.id, ctx.user.id);
  return { items: rows.map((t) => { const other = q.get('SELECT * FROM users WHERE id=?', t.buyer_id === ctx.user.id ? t.agent_id : t.buyer_id); return { id: t.id, listing_id: t.listing_id, listing_title: t.listing_title, image: jparse(t.listing_images, [])[0], other: S.publicUser(other, false), last: t.last_body, unread: t.unread, last_at: t.last_at }; }) };
});
post('/api/threads', AUTH, (ctx) => {
  const l = listingOrThrow(ctx.body.listing_id); const body = str(ctx.body.body, 2000);
  if (l.owner_id === ctx.user.id) throw new HttpError(400, 'نمی‌توانید به آگهی خودتان پیام دهید.');
  if (!body) throw new HttpError(400, 'متن پیام خالی است.');
  let t = q.get('SELECT * FROM threads WHERE listing_id=? AND buyer_id=? AND agent_id=?', l.id, ctx.user.id, l.owner_id);
  if (!t) t = { id: q.run('INSERT INTO threads (listing_id,buyer_id,agent_id) VALUES (?,?,?)', l.id, ctx.user.id, l.owner_id).lastInsertRowid };
  q.run('INSERT INTO messages (thread_id,sender_id,body) VALUES (?,?,?)', t.id, ctx.user.id, body);
  q.run('UPDATE threads SET last_at=CURRENT_TIMESTAMP WHERE id=?', t.id);
  S.notify(l.owner_id, `پیام جدید از ${ctx.user.name}`, body.slice(0, 80), `#/messages/${t.id}`);
  return { id: t.id };
});
get('/api/threads/:id', AUTH, (ctx) => {
  const t = threadFor(ctx.user, ctx.params.id);
  q.run('UPDATE messages SET read=1 WHERE thread_id=? AND sender_id<>?', t.id, ctx.user.id);
  const other = q.get('SELECT * FROM users WHERE id=?', t.buyer_id === ctx.user.id ? t.agent_id : t.buyer_id);
  const l = t.listing_id ? S.getListingRow(t.listing_id) : null;
  return { thread: { id: t.id, other: S.publicUser(other, false), listing: l && S.mapListing(l) }, messages: q.all('SELECT id, sender_id, body, created_at FROM messages WHERE thread_id=? ORDER BY id', t.id), me: ctx.user.id };
});
post('/api/threads/:id/messages', AUTH, (ctx) => {
  const t = threadFor(ctx.user, ctx.params.id); const body = str(ctx.body.body, 2000);
  if (!body) throw new HttpError(400, 'متن پیام خالی است.');
  if (!U.rateLimit('msg:' + ctx.user.id, 60, 60e3)) throw new HttpError(429, 'کمی آرام‌تر پیام دهید.');
  const id = q.run('INSERT INTO messages (thread_id,sender_id,body) VALUES (?,?,?)', t.id, ctx.user.id, body).lastInsertRowid;
  q.run('UPDATE threads SET last_at=CURRENT_TIMESTAMP WHERE id=?', t.id);
  S.notify(t.buyer_id === ctx.user.id ? t.agent_id : t.buyer_id, `پیام جدید از ${ctx.user.name}`, body.slice(0, 80), `#/messages/${t.id}`);
  return { id };
});

const SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
get('/api/listings/:id/slots', (ctx) => {
  const date = String(ctx.query.date || '');
  const booked = q.all(`SELECT time FROM appointments WHERE listing_id=? AND date=? AND status IN ('pending','confirmed')`, +ctx.params.id, date).map((r) => r.time);
  return { slots: SLOTS.map((t) => ({ time: t, free: !booked.includes(t) })) };
});
post('/api/listings/:id/appointments', AUTH, (ctx) => {
  const l = listingOrThrow(ctx.params.id);
  if (l.owner_id === ctx.user.id) throw new HttpError(400, 'نمی‌توانید برای آگهی خودتان وقت بگیرید.');
  const date = String(ctx.body.date || ''), time = String(ctx.body.time || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !SLOTS.includes(time)) throw new HttpError(400, 'تاریخ یا ساعت نامعتبر است.');
  const diff = (new Date(date + 'T12:00:00Z') - Date.now()) / 864e5;
  if (diff < -0.5 || diff > 30) throw new HttpError(400, 'تاریخ بازدید باید در ۳۰ روز آینده باشد.');
  if (q.get(`SELECT 1 FROM appointments WHERE listing_id=? AND date=? AND time=? AND status IN ('pending','confirmed')`, l.id, date, time)) throw new HttpError(409, 'این ساعت قبلاً رزرو شده است.');
  if (q.get(`SELECT 1 FROM appointments WHERE listing_id=? AND user_id=? AND status IN ('pending','confirmed') AND date>=date('now')`, l.id, ctx.user.id)) throw new HttpError(409, 'شما برای این ملک یک بازدید فعال دارید.');
  const id = q.run('INSERT INTO appointments (listing_id,user_id,agent_id,date,time,note) VALUES (?,?,?,?,?,?)', l.id, ctx.user.id, l.owner_id, date, time, str(ctx.body.note, 300)).lastInsertRowid;
  S.notify(l.owner_id, 'درخواست بازدید جدید 📅', `${ctx.user.name} برای «${l.title}» وقت بازدید خواسته است.`, '#/dashboard');
  return { id };
});
get('/api/appointments', AUTH, (ctx) => {
  const base = `SELECT a.*, l.title, l.code, l.address, l.images, b.name AS buyer_name, b.phone AS buyer_phone, g.name AS agent_name, g.phone AS agent_phone FROM appointments a JOIN listings l ON l.id=a.listing_id JOIN users b ON b.id=a.user_id JOIN users g ON g.id=a.agent_id`;
  const mine = q.all(`${base} WHERE a.user_id=? ORDER BY a.date DESC, a.time DESC`, ctx.user.id);
  const received = q.all(`${base} WHERE a.agent_id=? ORDER BY a.date DESC, a.time DESC`, ctx.user.id);
  const fix = (a) => ({ ...a, image: jparse(a.images, [])[0], images: undefined });
  return { mine: mine.map(fix), received: received.map(fix) };
});
put('/api/appointments/:id', AUTH, (ctx) => {
  const a = q.get('SELECT * FROM appointments WHERE id=?', +ctx.params.id);
  if (!a || (a.user_id !== ctx.user.id && a.agent_id !== ctx.user.id)) throw new HttpError(404, 'یافت نشد.');
  const st = ctx.body.status;
  if (!['confirmed', 'cancelled', 'done'].includes(st)) throw new HttpError(400, 'وضعیت نامعتبر است.');
  if (a.user_id === ctx.user.id && st !== 'cancelled') throw new HttpError(403, 'فقط می‌توانید بازدید را لغو کنید.');
  q.run('UPDATE appointments SET status=? WHERE id=?', st, a.id);
  const label = { confirmed: 'تأیید شد ✅', cancelled: 'لغو شد', done: 'انجام شد' }[st];
  S.notify(a.user_id === ctx.user.id ? a.agent_id : a.user_id, `بازدید ${label}`, `${a.date} ساعت ${a.time}`, '#/dashboard');
  return { ok: true };
});

// ------------------------------------------------------------------ agents & reviews
get('/api/agents', (ctx) => {
  const t = U.normFa(ctx.query.q || '');
  let rows = q.all(`SELECT * FROM users WHERE role='agent' AND banned=0`);
  if (ctx.query.city) rows = rows.filter((u) => u.city === ctx.query.city);
  if (t) rows = rows.filter((u) => U.normFa(`${u.name} ${u.agency || ''}`).includes(t));
  let items = rows.map((u) => S.publicUser(u));
  const sort = ctx.query.sort || 'rating';
  items.sort((a, b) => sort === 'listings' ? b.active - a.active : sort === 'exp' ? b.experience - a.experience : (b.rating || 0) - (a.rating || 0) || b.reviews - a.reviews);
  return { items };
});
get('/api/agents/:id', (ctx) => {
  const u = q.get(`SELECT * FROM users WHERE id=? AND role IN ('agent','admin')`, +ctx.params.id);
  if (!u) throw new HttpError(404, 'مشاور پیدا نشد.');
  const reviews = q.all(`SELECT r.*, u.name AS user_name, u.hue AS user_hue FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.agent_id=? ORDER BY r.created_at DESC LIMIT 50`, u.id);
  const dist = [5, 4, 3, 2, 1].map((s) => ({ stars: s, n: reviews.filter((r) => r.rating === s).length }));
  const l = S.searchListings({ owner: u.id, limit: 12, sort: 'newest' }, { userId: ctx.user?.id });
  return { agent: S.publicUser(u), reviews, dist, listings: l.items, total: l.total };
});
post('/api/agents/:id/reviews', AUTH, (ctx) => {
  const a = q.get(`SELECT * FROM users WHERE id=? AND role='agent'`, +ctx.params.id);
  if (!a) throw new HttpError(404, 'مشاور پیدا نشد.');
  if (a.id === ctx.user.id) throw new HttpError(400, 'نمی‌توانید به خودتان امتیاز دهید.');
  const rating = clampInt(ctx.body.rating, 1, 5, 0); if (!rating) throw new HttpError(400, 'امتیاز را انتخاب کنید.');
  // فقط کسی که با این مشاور ارتباط واقعی داشته (پیام، درخواست مشاوره یا بازدید) می‌تواند نظر بدهد
  const contact = q.get(`SELECT 1 FROM threads WHERE agent_id=? AND buyer_id=? UNION ALL SELECT 1 FROM appointments WHERE agent_id=? AND user_id=? UNION ALL
    SELECT 1 FROM inquiries i JOIN listings l ON l.id=i.listing_id WHERE l.owner_id=? AND i.user_id=? LIMIT 1`, a.id, ctx.user.id, a.id, ctx.user.id, a.id, ctx.user.id);
  if (!contact) throw new HttpError(403, 'برای ثبت نظر ابتدا باید با این مشاور گفتگو کنید، درخواست مشاوره بدهید یا بازدید رزرو کنید.');
  q.run(`INSERT INTO reviews (agent_id,user_id,rating,comment) VALUES (?,?,?,?) ON CONFLICT(agent_id,user_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment, created_at=CURRENT_TIMESTAMP`, a.id, ctx.user.id, rating, str(ctx.body.comment, 600));
  S.notify(a.id, 'نظر جدید دریافت کردید ⭐', `${ctx.user.name} به شما ${rating} ستاره داد.`, `#/agent/${a.id}`);
  return { ok: true };
});

// ------------------------------------------------------------------ notifications
get('/api/notifications', AUTH, (ctx) => ({ items: q.all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 60', ctx.user.id), unread: q.get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0', ctx.user.id).n, messages: q.get('SELECT COUNT(*) n FROM messages m JOIN threads t ON t.id=m.thread_id WHERE (t.buyer_id=? OR t.agent_id=?) AND m.sender_id<>? AND m.read=0', ctx.user.id, ctx.user.id, ctx.user.id).n }));
post('/api/notifications/read', AUTH, (ctx) => { q.run('UPDATE notifications SET read=1 WHERE user_id=?', ctx.user.id); return { ok: true }; });

// ------------------------------------------------------------------ articles
get('/api/articles', (ctx) => {
  const cat = ctx.query.category;
  const rows = cat ? q.all('SELECT id,slug,title,excerpt,category,hue,read_min,views,created_at FROM articles WHERE category=? ORDER BY created_at DESC', cat) : q.all('SELECT id,slug,title,excerpt,category,hue,read_min,views,created_at FROM articles ORDER BY created_at DESC');
  return { items: rows.slice(0, clampInt(ctx.query.limit, 1, 50, 50)) };
});
get('/api/articles/:slug', (ctx) => {
  const a = q.get('SELECT * FROM articles WHERE slug=?', ctx.params.slug);
  if (!a) throw new HttpError(404, 'مقاله پیدا نشد.');
  q.run('UPDATE articles SET views=views+1 WHERE id=?', a.id);
  return { article: a, related: q.all('SELECT id,slug,title,excerpt,category,hue,read_min FROM articles WHERE id<>? ORDER BY (category=?) DESC, created_at DESC LIMIT 3', a.id, a.category) };
});

// ------------------------------------------------------------------ demand board
get('/api/requests', (ctx) => {
  const rows = q.all(`SELECT r.*, u.name AS user_name, u.hue AS user_hue FROM requests r JOIN users u ON u.id=r.user_id WHERE r.status='open' ORDER BY r.id DESC LIMIT 100`);
  return { items: rows.map((r) => ({ ...r, cityName: META.findCity(r.city)?.name, districtName: META.findDistrict(r.city, r.district)?.name, mine: ctx.user?.id === r.user_id })) };
});
post('/api/requests', AUTH, (ctx) => {
  const b = ctx.body; const title = str(b.title, 120);
  if (title.length < 5) throw new HttpError(400, 'عنوان درخواست را کامل‌تر بنویسید.');
  if (!META.DEALS[b.deal]) throw new HttpError(400, 'نوع معامله را انتخاب کنید.');
  if (q.get(`SELECT COUNT(*) n FROM requests WHERE user_id=? AND status='open'`, ctx.user.id).n >= 5) throw new HttpError(400, 'حداکثر ۵ درخواست فعال می‌توانید داشته باشید.');
  const id = q.run('INSERT INTO requests (user_id,title,deal,ptype,city,district,budget_max,rent_max,area_min,rooms,description) VALUES (?,?,?,?,?,?,?,?,?,?,?)', ctx.user.id, title, b.deal, META.PTYPES[b.ptype] ? b.ptype : null,
    META.findCity(b.city)?.slug || null, META.findDistrict(b.city, b.district)?.slug || null, clampInt(b.budget_max, 0, 1e15, 0), clampInt(b.rent_max, 0, 1e12, 0), clampInt(b.area_min, 0, 10000, 0), clampInt(b.rooms, 0, 10, 0), str(b.description, 800)).lastInsertRowid;
  return { id };
});
del('/api/requests/:id', AUTH, (ctx) => {
  const r = q.get('SELECT * FROM requests WHERE id=?', +ctx.params.id);
  if (!r || (r.user_id !== ctx.user.id && ctx.user.role !== 'admin')) throw new HttpError(404, 'یافت نشد.');
  q.run('DELETE FROM requests WHERE id=?', r.id); return { ok: true };
});
post('/api/requests/:id/respond', AGENT, (ctx) => {
  const r = q.get('SELECT * FROM requests WHERE id=?', +ctx.params.id); if (!r) throw new HttpError(404, 'یافت نشد.');
  const lid = ctx.body.listing_id ? +ctx.body.listing_id : null;
  if (lid) { const l = S.getListingRow(lid); if (!l || l.owner_id !== ctx.user.id) throw new HttpError(400, 'آگهی نامعتبر است.'); }
  S.notify(r.user_id, `${ctx.user.name} به درخواست شما پاسخ داد`, str(ctx.body.message, 200) || 'مشاور برای درخواست شما گزینه‌ای دارد.', lid ? `#/listing/${lid}` : `#/agent/${ctx.user.id}`);
  return { ok: true };
});

post('/api/contact', (ctx) => {
  if (!U.rateLimit('contact:' + ip(ctx.req), 5, 3600e3)) throw new HttpError(429, 'تعداد پیام‌ها زیاد است؛ کمی بعد تلاش کنید.');
  const name = str(ctx.body.name, 80), contact = str(ctx.body.contact, 120), message = str(ctx.body.message, 2000);
  if (name.length < 2) throw new HttpError(400, 'نام خود را وارد کنید.');
  if (contact.length < 5) throw new HttpError(400, 'ایمیل یا شماره‌ی تماس معتبر وارد کنید.');
  if (message.length < 10) throw new HttpError(400, 'پیام خیلی کوتاه است.');
  q.run('INSERT INTO contacts (user_id,name,contact,message) VALUES (?,?,?,?)', ctx.user?.id || null, name, contact, message);
  for (const a of q.all(`SELECT id FROM users WHERE role='admin'`)) S.notify(a.id, 'پیام جدید از فرم تماس', name, '#/admin/contacts');
  return { ok: true };
});
const KINDS = { buy: 'خرید ملک', rent: 'رهن و اجاره', sell: 'فروش ملک', invest: 'سرمایه‌گذاری', other: 'سایر' };
post('/api/consult', (ctx) => {
  if (!U.rateLimit('consult:' + ip(ctx.req), 5, 3600e3)) throw new HttpError(429, 'تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید یا مستقیم تماس بگیرید.');
  const name = str(ctx.body.name, 80), phone = U.normPhone(ctx.body.phone || '');
  if (name.length < 2) throw new HttpError(400, 'نام خود را وارد کنید.');
  if (!U.validPhone(phone)) throw new HttpError(400, 'شماره‌ی موبایل معتبر وارد کنید.');
  const city = META.findCity(ctx.body.city)?.slug || META.FOCUS[0]; const kind = KINDS[ctx.body.kind] ? ctx.body.kind : 'other';
  const note = str(ctx.body.note, 1000) || '—';
  q.run('INSERT INTO contacts (user_id,name,contact,message,city,kind) VALUES (?,?,?,?,?,?)', ctx.user?.id || null, name, phone, `درخواست مشاوره — ${KINDS[kind]} — ${META.findCity(city).name}\n${note}`, city, kind);
  for (const a of q.all(`SELECT id FROM users WHERE role='admin'`)) S.notify(a.id, `درخواست مشاوره‌ی جدید (${META.findCity(city).name})`, `${name} — ${phone}\n${KINDS[kind]}: ${note}`, '#/admin/contacts');
  return { ok: true };
});
get('/api/geocode', (ctx) => {
  const t = str(ctx.query.q, 120); if (t.length < 3) return { items: [] };
  if (!U.rateLimit('geo:' + ip(ctx.req), 30, 60e3)) throw new HttpError(429, 'درخواست‌ها زیاد است؛ کمی صبر کنید.');
  return X.geocode(t, ctx.query.city).then((items) => ({ items })).catch(() => { throw new HttpError(503, 'سرویس نشانی‌یابی در دسترس نیست؛ موقعیت را روی نقشه انتخاب کنید.'); });
});
get('/api/reverse', (ctx) => {
  const lat = +ctx.query.lat, lng = +ctx.query.lng; if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, 'مختصات نامعتبر است.');
  if (!U.rateLimit('geo:' + ip(ctx.req), 30, 60e3)) throw new HttpError(429, 'درخواست‌ها زیاد است؛ کمی صبر کنید.');
  return X.reverse(lat, lng).catch(() => ({ label: '' }));
});
const chanInfo = (c, envKey) => ({ configured: !!c, chat: c?.chat || '', fromEnv: !!process.env[envKey] });
get('/api/admin/site', ADMIN, () => ({ site: X.getSite(), telegram: { ...chanInfo(X.tgConf(), 'DAL_TG_TOKEN'), api: X.getSetting('tg_api') || process.env.DAL_TG_API || '' }, bale: chanInfo(X.baleConf(), 'DAL_BALE_TOKEN') }));
put('/api/admin/site', ADMIN, (ctx) => {
  let site; try { site = X.saveSite(ctx.body); } catch (e) { throw new HttpError(e.status || 400, e.message); }
  const b = ctx.body;
  for (const [k, max] of [['tg_token', 120], ['bale_token', 120]]) if (b[k]) X.setSetting(k, str(b[k], max));
  for (const [k, max] of [['tg_chat', 40], ['bale_chat', 40]]) if (b[k] !== undefined) X.setSetting(k, str(b[k], max));
  if (b.tg_api !== undefined) { const u = str(b.tg_api, 200); if (u && !/^https?:\/\/[\w.-]+(:\d+)?(\/[\w./-]*)?$/.test(u)) throw new HttpError(400, 'نشانی رله‌ی تلگرام معتبر نیست.'); X.setSetting('tg_api', u); }
  return { ok: true, site };
});
async function notifyTest() {
  if (!X.channels().length) throw new HttpError(400, 'هنوز ربات تلگرام یا بله تنظیم نشده است.');
  const r = await X.sendAll('✅ اتصال دال برقرار است.');
  return { ok: Object.values(r).some((x) => x.ok), results: r };
}
post('/api/admin/notify/test', ADMIN, notifyTest);
post('/api/admin/telegram/test', ADMIN, async () => { const r = await notifyTest(); if (!r.ok) throw new HttpError(502, 'ارسال ناموفق بود؛ توکن، شناسه‌ی گفتگو و دسترسی سرور به سرویس را بررسی کنید.'); return r; });
get('/api/admin/diagnostics', ADMIN, async () => {
  const d = await X.diagnostics(); const ts = await TILES.stats().catch(() => ({ count: 0, bytes: 0 }));
  let dbBytes = 0; try { dbBytes = fs.statSync(path.join(DATA_DIR, 'dal.db')).size; } catch { /* custom path */ }
  let backups = []; try { backups = fs.readdirSync(path.join(DATA_DIR, 'backups')).filter((n) => n.endsWith('.db')).sort(); } catch { /* none */ }
  return { ...d, node: process.version, uptime: Math.round(process.uptime()), trustProxy: TRUST_PROXY, baseUrl: process.env.DAL_BASE_URL || '', tiles: ts, dbBytes, backups: backups.slice(-3), lastRemoteBackup: X.getSetting('last_remote_backup') || '' };
});
post('/api/admin/backup', ADMIN, async () => { const f = X.localBackup(); const r = await X.remoteBackup(); return { ok: true, file: path.basename(f), remote: r }; });
const CONTACT_ST = ['new', 'contacted', 'done'];
function contactRows(query) {
  const w = [], a = [];
  if (CONTACT_ST.includes(query.status)) { w.push('status=?'); a.push(query.status); }
  if (query.city) { w.push('city=?'); a.push(String(query.city)); }
  if (query.q) { w.push('(name LIKE ? OR contact LIKE ? OR message LIKE ?)'); const k = '%' + String(query.q).slice(0, 40) + '%'; a.push(k, k, k); }
  return q.all(`SELECT * FROM contacts ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`, ...a);
}
get('/api/admin/contacts', ADMIN, (ctx) => ({ items: contactRows(ctx.query), counts: Object.fromEntries(CONTACT_ST.map((s) => [s, q.get('SELECT COUNT(*) n FROM contacts WHERE status=?', s).n])) }));
get('/api/admin/contacts.csv', ADMIN, () => {
  const ST = { new: 'جدید', contacted: 'پیگیری‌شده', done: 'بسته‌شده' };
  const rows = q.all('SELECT * FROM contacts ORDER BY id DESC').map((r) => [r.id, r.name, r.contact, META.findCity(r.city)?.name || '', r.kind || '', ST[r.status] || r.status, (r.message || '').replace(/\n/g, ' '), r.admin_note || '', r.created_at]);
  const csv = '\ufeff' + ['کد,نام,تلفن,شهر,نوع,وضعیت,پیام,یادداشت,تاریخ', ...rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  return { __raw: csv, type: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="dal-contacts.csv"' } };
});
put('/api/admin/contacts/:id', ADMIN, (ctx) => {
  const row = q.get('SELECT * FROM contacts WHERE id=?', +ctx.params.id); if (!row) throw new HttpError(404, 'پیدا نشد.');
  const st = CONTACT_ST.includes(ctx.body.status) ? ctx.body.status : row.status;
  const note = ctx.body.admin_note === undefined ? row.admin_note : str(ctx.body.admin_note, 1000);
  q.run('UPDATE contacts SET status=?, admin_note=? WHERE id=?', st, note, row.id); return { ok: true };
});
del('/api/admin/contacts/:id', ADMIN, (ctx) => { q.run('DELETE FROM contacts WHERE id=?', +ctx.params.id); return { ok: true }; });
post('/api/listings/:id/report', (ctx) => {
  const l = listingOrThrow(ctx.params.id);
  if (!U.rateLimit('rep:' + ip(ctx.req), 10, 3600e3)) throw new HttpError(429, 'تعداد گزارش‌ها زیاد است.');
  const reason = str(ctx.body.reason, 60); if (!reason) throw new HttpError(400, 'دلیل گزارش را انتخاب کنید.');
  q.run('INSERT INTO reports (listing_id,user_id,reason,details) VALUES (?,?,?,?)', l.id, ctx.user?.id || null, reason, str(ctx.body.details, 500));
  for (const a of q.all(`SELECT id FROM users WHERE role='admin'`)) S.notify(a.id, 'گزارش تخلف جدید', `${l.title} — ${reason}`, '#/admin/reports');
  return { ok: true };
});

// ------------------------------------------------------------------ analytics & tools
post('/api/valuate', (ctx) => {
  const b = ctx.body;
  const area = clampInt(b.area, 10, 100000, 0); if (!area) throw new HttpError(400, 'متراژ را وارد کنید.');
  if (!META.findDistrict(b.city, b.district)) throw new HttpError(400, 'شهر و محله را انتخاب کنید.');
  const res = valuate({ city: b.city, district: b.district, ptype: META.PTYPES[b.ptype] ? b.ptype : 'apartment', area, rooms: clampInt(b.rooms, 0, 20, 0), year_built: b.year_built ? clampInt(b.year_built, 1300, 1420, null) : null,
    floor: b.floor === '' || b.floor == null ? null : clampInt(b.floor, -2, 100, 0), floors_total: b.floors_total ? clampInt(b.floors_total, 1, 100, 1) : null, features: (b.features || []).filter((k) => FEATURE_KEYS.has(k)) });
  if (!res) throw new HttpError(422, 'برای این محله هنوز آگهی یا معامله‌ی مشابهی در دال ثبت نشده و قیمت مرجعی هم نداریم؛ با ثبت آگهی‌ها این ابزار فعال می‌شود. برای ارزیابی دقیق با مشاوران دال تماس بگیرید.');
  return res;
});

get('/api/analytics/market', (ctx) => {
  const city = META.findCity(ctx.query.city || META.FOCUS[0]) || META.CITIES[0];
  const districts = A.cityDistricts(city.slug).map(({ series, ...d }) => d);
  const cityTrend = A.cityTrend(city.slug).map(({ month, ppm, n }) => ({ month, ppm, n }));
  const types = q.all(`SELECT ptype, COUNT(*) n, AVG(CASE WHEN deal='sale' AND area>0 THEN 1.0*price/area END) ppm FROM listings WHERE status='active' AND city=? GROUP BY ptype`, city.slug);
  const deals = q.all(`SELECT deal, COUNT(*) n FROM listings WHERE status='active' AND city=? GROUP BY deal`, city.slug);
  const top = q.all(`SELECT l.id,l.title,l.views,l.district FROM listings l WHERE l.status='active' AND l.city=? ORDER BY l.views DESC LIMIT 5`, city.slug);
  const total = districts.reduce((n, d) => n + d.listings, 0);
  return { city: city.slug, cityName: city.name, districts, cityTrend, types, deals, top, total, samples: districts.reduce((n, d) => n + d.samples, 0) };
});
get('/api/analytics/trend', (ctx) => ({ items: ctx.query.district ? A.districtTrend(String(ctx.query.city), String(ctx.query.district)) : A.cityTrend(String(ctx.query.city)) }));

// ------------------------------------------------------------------ dashboard
get('/api/dashboard', AUTH, (ctx) => {
  const u = ctx.user; const n = (sql, ...p) => q.get(sql, ...p).n;
  const mine = q.all('SELECT id, status, views, deal, price, rent FROM listings WHERE owner_id=?', u.id);
  const series = q.all(`SELECT day, SUM(n) n FROM view_log WHERE listing_id IN (SELECT id FROM listings WHERE owner_id=?) AND day>=date('now','-13 day') GROUP BY day ORDER BY day`, u.id);
  return {
    listings: { total: mine.length, active: mine.filter((l) => l.status === 'active').length, pending: mine.filter((l) => l.status === 'pending').length, closed: mine.filter((l) => ['sold', 'rented'].includes(l.status)).length, views: mine.reduce((s, l) => s + l.views, 0) },
    favorites: n('SELECT COUNT(*) n FROM favorites WHERE user_id=?', u.id), saved: n('SELECT COUNT(*) n FROM saved_searches WHERE user_id=?', u.id),
    inquiriesNew: n(`SELECT COUNT(*) n FROM inquiries i JOIN listings l ON l.id=i.listing_id WHERE l.owner_id=? AND i.status='new'`, u.id),
    appointmentsPending: n(`SELECT COUNT(*) n FROM appointments WHERE agent_id=? AND status='pending'`, u.id),
    favoritesOnMine: n('SELECT COUNT(*) n FROM favorites f JOIN listings l ON l.id=f.listing_id WHERE l.owner_id=?', u.id),
    series,
  };
});
get('/api/my/listings', AUTH, (ctx) => {
  const rows = q.all(`SELECT ${S.BASE_FIELDS}, (SELECT COUNT(*) FROM favorites f WHERE f.listing_id=l.id) AS fav_count, (SELECT COUNT(*) FROM inquiries i WHERE i.listing_id=l.id) AS inq_count FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.owner_id=? ORDER BY l.id DESC`, ctx.user.id);
  return { items: rows.map((r) => ({ ...S.mapListing(r), reject_reason: r.reject_reason, renewed_at: r.renewed_at, fav_count: r.fav_count, inq_count: r.inq_count })) };
});
get('/api/my/listings.csv', AUTH, (ctx) => {
  const rows = q.all('SELECT code,title,deal,ptype,price,rent,area,rooms,city,district,status,views,created_at FROM listings WHERE owner_id=? ORDER BY id DESC', ctx.user.id);
  const csv = '\ufeff' + ['کد,عنوان,معامله,نوع,قیمت/ودیعه,اجاره,متراژ,خواب,شهر,محله,وضعیت,بازدید,تاریخ', ...rows.map((r) => Object.values(r).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  return { __raw: csv, type: 'text/csv; charset=utf-8', headers: { 'Content-Disposition': 'attachment; filename="dal-listings.csv"' } };
});

// ------------------------------------------------------------------ admin
get('/api/admin/stats', ADMIN, () => {
  const n = (sql, ...p) => q.get(sql, ...p).n;
  return {
    users: n('SELECT COUNT(*) n FROM users'), agents: n(`SELECT COUNT(*) n FROM users WHERE role='agent'`), pendingAgents: n(`SELECT COUNT(*) n FROM users WHERE role='agent' AND verified=0`),
    listings: n('SELECT COUNT(*) n FROM listings'), active: n(`SELECT COUNT(*) n FROM listings WHERE status='active'`), pending: n(`SELECT COUNT(*) n FROM listings WHERE status='pending'`),
    reports: n(`SELECT COUNT(*) n FROM reports WHERE status='open'`), contacts: n(`SELECT COUNT(*) n FROM contacts WHERE status='new'`), inquiries: n('SELECT COUNT(*) n FROM inquiries'), appointments: n('SELECT COUNT(*) n FROM appointments'), views: n('SELECT COALESCE(SUM(views),0) n FROM listings'),
    signups: q.all(`SELECT substr(created_at,1,10) day, COUNT(*) n FROM users WHERE created_at>=date('now','-29 day') GROUP BY day ORDER BY day`),
    byStatus: q.all('SELECT status, COUNT(*) n FROM listings GROUP BY status'),
    traffic: q.all(`SELECT day, SUM(n) n FROM view_log WHERE day>=date('now','-13 day') GROUP BY day ORDER BY day`),
  };
});
get('/api/admin/users', ADMIN, (ctx) => {
  const t = `%${str(ctx.query.q, 40)}%`;
  return { items: q.all(`SELECT id,name,phone,email,role,agency,verified,banned,created_at,(SELECT COUNT(*) FROM listings WHERE owner_id=users.id) AS listings FROM users WHERE (name LIKE ? OR phone LIKE ?) ${ctx.query.role ? 'AND role=?' : ''} ORDER BY id DESC LIMIT 100`, ...[t, t, ...(ctx.query.role ? [ctx.query.role] : [])]) };
});
put('/api/admin/users/:id', ADMIN, (ctx) => {
  const u = q.get('SELECT * FROM users WHERE id=?', +ctx.params.id); if (!u) throw new HttpError(404, 'کاربر پیدا نشد.');
  if (u.id === ctx.user.id && (ctx.body.banned || (ctx.body.role && ctx.body.role !== 'admin'))) throw new HttpError(400, 'نمی‌توانید حساب خودتان را محدود کنید.');
  const role = ['user', 'agent', 'admin'].includes(ctx.body.role) ? ctx.body.role : u.role;
  q.run('UPDATE users SET role=?, verified=?, banned=? WHERE id=?', role, ctx.body.verified !== undefined ? +!!ctx.body.verified : u.verified, ctx.body.banned !== undefined ? +!!ctx.body.banned : u.banned, u.id);
  if (ctx.body.verified && !u.verified) S.notify(u.id, 'حساب شما تأیید شد ✅', 'نشان «تأییدشده» به پروفایل شما اضافه شد.', '#/dashboard');
  if (ctx.body.banned) q.run('UPDATE users SET pwv=pwv+1 WHERE id=?', u.id);
  if (ctx.body.verified !== undefined && !!ctx.body.verified !== !!u.verified) A.invalidate();
  let temp = null;
  if (ctx.body.reset_password) { temp = U.randomPassword(10); q.run('UPDATE users SET password_hash=?, pwv=pwv+1 WHERE id=?', U.hashPassword(temp), u.id); }
  return { ok: true, temp_password: temp };
});
post('/api/admin/users', ADMIN, (ctx) => {
  const b = ctx.body, name = str(b.name, 60), phone = U.normPhone(b.phone);
  if (name.length < 3) throw new HttpError(400, 'نام و نام خانوادگی را وارد کنید.');
  if (!U.validPhone(phone)) throw new HttpError(400, 'شماره‌ی موبایل معتبر نیست (مثال: 09121234567).');
  if (q.get('SELECT 1 FROM users WHERE phone=?', phone)) throw new HttpError(409, 'این شماره قبلاً ثبت شده است.');
  const role = ['agent', 'admin', 'user'].includes(b.role) ? b.role : 'agent';
  const temp = U.randomPassword(10);
  const { id, recovery } = B.createUser({ name, phone, password: temp, role, verified: role !== 'user', agency: str(b.agency, 80) || null, license_no: str(b.license_no, 40) || null, city: str(b.city, 40) || null });
  S.notify(id, 'به دال خوش آمدید 🏡', 'حساب شما توسط مدیر ساخته شد. بعد از اولین ورود، رمز خود را از بخش «حساب من» عوض کنید.', '#/account');
  A.invalidate(); return { ok: true, id, temp_password: temp, recovery };
});
del('/api/admin/users/:id', ADMIN, (ctx) => {
  const u = q.get('SELECT * FROM users WHERE id=?', +ctx.params.id); if (!u) throw new HttpError(404, 'کاربر پیدا نشد.');
  if (u.id === ctx.user.id) throw new HttpError(400, 'نمی‌توانید حساب خودتان را حذف کنید.');
  removeUserFiles(u.id); q.run('DELETE FROM users WHERE id=?', u.id); A.invalidate(); return { ok: true };
});
del('/api/admin/listings/:id', ADMIN, (ctx) => { const row = listingOrThrow(ctx.params.id); removeListingFiles(row); q.run('DELETE FROM listings WHERE id=?', row.id); A.invalidate(); return { ok: true }; });
get('/api/admin/articles', ADMIN, () => ({ items: q.all('SELECT * FROM articles ORDER BY id DESC') }));
function cleanArticle(b, ex = {}) {
  const title = str(b.title ?? ex.title, 160), body = String(b.body ?? ex.body ?? '').slice(0, 40000).trim();
  if (title.length < 5) throw new HttpError(400, 'عنوان مقاله حداقل ۵ نویسه باشد.');
  if (body.length < 30) throw new HttpError(400, 'متن مقاله خیلی کوتاه است.');
  const cats = META.CATEGORIES || []; const category = str(b.category ?? ex.category, 40) || cats[0] || 'عمومی';
  return { title, body, category, excerpt: str(b.excerpt ?? ex.excerpt, 300) || body.replace(/^##.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 160), hue: clampInt(b.hue ?? ex.hue ?? 210, 0, 360, 210), read_min: Math.max(1, Math.round(body.length / 900)) };
}
post('/api/admin/articles', ADMIN, (ctx) => {
  const a = cleanArticle(ctx.body); let slug = str(ctx.body.slug, 80).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '') || 'post-' + Date.now().toString(36);
  if (q.get('SELECT 1 FROM articles WHERE slug=?', slug)) slug += '-' + Date.now().toString(36).slice(-4);
  const id = q.run('INSERT INTO articles (slug,title,excerpt,body,category,hue,read_min) VALUES (?,?,?,?,?,?,?)', slug, a.title, a.excerpt, a.body, a.category, a.hue, a.read_min).lastInsertRowid;
  return { id, slug };
});
put('/api/admin/articles/:id', ADMIN, (ctx) => {
  const ex = q.get('SELECT * FROM articles WHERE id=?', +ctx.params.id); if (!ex) throw new HttpError(404, 'مقاله پیدا نشد.');
  const a = cleanArticle(ctx.body, ex); q.run('UPDATE articles SET title=?,excerpt=?,body=?,category=?,hue=?,read_min=? WHERE id=?', a.title, a.excerpt, a.body, a.category, a.hue, a.read_min, ex.id); return { ok: true, slug: ex.slug };
});
del('/api/admin/articles/:id', ADMIN, (ctx) => { q.run('DELETE FROM articles WHERE id=?', +ctx.params.id); return { ok: true }; });
get('/api/admin/listings', ADMIN, (ctx) => S.searchListings({ ...ctx.query }, { publicOnly: false, defaultLimit: 20 }));
put('/api/admin/listings/:id', ADMIN, (ctx) => {
  const l = listingOrThrow(ctx.params.id); const b = ctx.body;
  const status = ['active', 'pending', 'rejected', 'archived', 'sold', 'rented'].includes(b.status) ? b.status : l.status;
  q.run('UPDATE listings SET status=?, featured=?, verified=?, reject_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', status, b.featured !== undefined ? +!!b.featured : l.featured, b.verified !== undefined ? +!!b.verified : l.verified, status === 'rejected' ? str(b.reject_reason, 200) : null, l.id);
  if (status !== l.status) {
    if (status === 'active') { S.notify(l.owner_id, 'آگهی شما تأیید شد ✅', l.title, `#/listing/${l.id}`); if (l.status === 'pending') S.notifySavedSearches(l.id); }
    A.invalidate();
    if (status === 'rejected') S.notify(l.owner_id, 'آگهی شما رد شد', `${l.title} — ${str(b.reject_reason, 200) || 'قوانین دال رعایت نشده است.'}`, `#/edit/${l.id}`);
  }
  return { ok: true };
});
get('/api/admin/reports', ADMIN, () => ({ items: q.all(`SELECT r.*, l.title, l.code, u.name AS user_name FROM reports r JOIN listings l ON l.id=r.listing_id LEFT JOIN users u ON u.id=r.user_id ORDER BY (r.status='open') DESC, r.id DESC LIMIT 100`) }));
put('/api/admin/reports/:id', ADMIN, (ctx) => { q.run('UPDATE reports SET status=? WHERE id=?', ctx.body.status === 'resolved' ? 'resolved' : 'dismissed', +ctx.params.id); return { ok: true }; });

// ------------------------------------------------------------------ server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);
  for (const [k, v] of Object.entries(SEC_HEADERS)) res.setHeader(k, v);
  try {
    if (pathname.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      let matched = null;
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(pathname); if (!m) continue;
        matched = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }; break;
      }
      if (!matched) {
        const any = routes.some((r) => r.re.test(pathname));
        throw new HttpError(any ? 405 : 404, any ? 'متد مجاز نیست.' : 'مسیر پیدا نشد.');
      }
      const user = currentUser(req);
      if (matched.r.opts.auth) requireRole(user, matched.r.opts.auth);
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req, matched.r.opts.limit || 1e6) : {};
      const out = await matched.r.handler({ req, res, params: matched.params, query: Object.fromEntries(url.searchParams), body, user });
      if (out && out.__raw !== undefined) return send(req, res, 200, out.__raw, { 'Content-Type': out.type, ...out.headers });
      return send(req, res, 200, out ?? { ok: true });
    }
    if (pathname.startsWith('/art/')) {
      const m = /^\/art\/([\w-]+)\/(\w+)\.svg$/.exec(pathname);
      if (!m) throw new HttpError(404, 'یافت نشد.');
      const qs = url.searchParams;
      const svg = art.render(m[1], m[2], { ptype: qs.get('t') || 'apartment', hue: +qs.get('h') || 200, rooms: +qs.get('r') || 2, area: +qs.get('a') || 100 });
      return send(req, res, 200, svg, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=604800, immutable' });
    }
    let tm;
    if ((tm = /^\/tiles\/(light|dark)\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})\.png$/.exec(pathname))) {
      const [z, x, y] = [+tm[2], +tm[3], +tm[4]]; const n = 2 ** z;
      if (z > 19 || x >= n || y >= n) throw new HttpError(404, 'یافت نشد.');
      if (!U.rateLimit('tile:' + ip(req), 1500, 60e3)) throw new HttpError(429, 'درخواست بیش از حد.');
      const t = await TILES.getTile(tm[1], z, x, y);
      if (!t) throw new HttpError(404, 'کاشی در دسترس نیست.');
      return send(req, res, 200, t.buf, { 'Content-Type': 'image/png', 'Cache-Control': t.stale ? 'public, max-age=300' : 'public, max-age=604800' });
    }
    if (pathname.startsWith('/uploads/')) {
      const f = path.join(UPLOADS, path.basename(pathname));
      return serveFile(req, res, f, 'public, max-age=2592000, immutable');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'متد مجاز نیست.');
    let lm;
    if ((lm = /^\/l\/(\d+)$/.exec(pathname))) return send(req, res, 200, SEO.listingPage(lm[1], req, TRUST_PROXY), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    if (pathname === '/sitemap.xml') return send(req, res, 200, SEO.sitemap(req, TRUST_PROXY), { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    if (pathname === '/robots.txt') return send(req, res, 200, SEO.robots(req, TRUST_PROXY), { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    let rel = pathname === '/' ? '/index.html' : pathname;
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep)) throw new HttpError(403, 'دسترسی ممنوع.');
    return serveFile(req, res, file, /\.(woff2|png|svg)$/.test(file) ? 'public, max-age=2592000' : 'no-cache');
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(req, res, e.status || 500, { error: e instanceof HttpError ? e.message : 'خطای داخلی سرور.' });
  }
});

if (require.main === module) server.listen(PORT, '0.0.0.0', () => console.log(`🏡 دال روی پورت ${PORT} در حال اجراست → http://localhost:${PORT}`));
module.exports = { server, routes };
