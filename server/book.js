'use strict';
/* دفترچه‌ی دال: «کمد»های مخصوص هر نفر + یک کمد عمومی اصلی
 *  - مدیر تعیین می‌کند چه کسانی کمد دارند؛ هر کمد یک توکن دسترسی دارد.
 *  - داخل هر کمد، «خواهان ملک» و «مالک/سپرده‌گذار» ثبت می‌شود.
 *  - پیشنهاد هوشمند: تطبیق خواهان‌ها با آگهی‌های فعال و مالک‌های ثبت‌شده (و برعکس) با توضیح دلیل.
 */
const crypto = require('node:crypto');
const { db, q } = require('./db');
const U = require('./util');
const { HttpError, str, clampInt } = U;
const META = require('./meta');
const S = require('./services');
const { smartParse, fmtShort } = require('./nlp');

db.exec(`
CREATE TABLE IF NOT EXISTS book_cabinets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'personal', owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, token TEXT NOT NULL UNIQUE, created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS book_members (
  cabinet_id INTEGER NOT NULL REFERENCES book_cabinets(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor', added_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (cabinet_id, user_id)
);
CREATE TABLE IF NOT EXISTS book_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cabinet_id INTEGER NOT NULL REFERENCES book_cabinets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL,
  deal TEXT NOT NULL DEFAULT 'sale', ptype TEXT, city TEXT, districts TEXT DEFAULT '[]',
  area INTEGER DEFAULT 0, rooms INTEGER DEFAULT 0,
  price_min INTEGER DEFAULT 0, price_max INTEGER DEFAULT 0, rent_max INTEGER DEFAULT 0,
  price INTEGER DEFAULT 0, rent INTEGER DEFAULT 0, listing_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active', note TEXT, tags TEXT DEFAULT '[]', next_follow TEXT, last_contact TEXT,
  created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_book_entries ON book_entries(cabinet_id, kind, status);
CREATE INDEX IF NOT EXISTS idx_book_match ON book_entries(kind, status, deal, city);
`);

const DEALS = { sale: 'خرید', rent: 'رهن و اجاره', presale: 'پیش‌فروش', swap: 'معاوضه' };
const STATUSES = ['active', 'paused', 'done'];
const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ کمدها و دسترسی
function makeToken() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const g = () => Array.from(crypto.randomBytes(4), (b) => A[b % A.length]).join('');
  return `DK-${g()}-${g()}-${g()}`;
}
function ensureMain() {
  let m = q.get(`SELECT * FROM book_cabinets WHERE kind='main'`);
  if (!m) { q.run(`INSERT INTO book_cabinets (kind,title,token) VALUES ('main','کمد اصلی دال',?)`, makeToken()); m = q.get(`SELECT * FROM book_cabinets WHERE kind='main'`); }
  return m;
}
const isHolder = (u) => !!q.get(`SELECT 1 FROM book_cabinets WHERE kind='personal' AND owner_id=?`, u.id);
function roleIn(u, cab) {
  if (u.role === 'admin') return 'admin';
  if (cab.kind === 'main') return isHolder(u) ? 'holder' : null;
  const m = q.get('SELECT role FROM book_members WHERE cabinet_id=? AND user_id=?', cab.id, u.id);
  return m ? m.role : null;
}
function accessibleIds(u) {
  if (u.role === 'admin') return q.all('SELECT id FROM book_cabinets').map((r) => r.id);
  const ids = q.all('SELECT cabinet_id id FROM book_members WHERE user_id=?', u.id).map((r) => r.id);
  if (isHolder(u)) ids.push(ensureMain().id);
  return ids;
}
function getCab(u, id) {
  const cab = q.get('SELECT * FROM book_cabinets WHERE id=?', +id);
  const role = cab && roleIn(u, cab);
  if (!cab || !role) throw new HttpError(404, 'این کمد پیدا نشد یا به آن دسترسی ندارید.');
  return { cab, role };
}
const canSeeToken = (role) => role === 'admin' || role === 'owner';

function cabinetSummary(u, cab) {
  const role = roleIn(u, cab);
  const c = q.get(`SELECT SUM(kind='seeker') seekers, SUM(kind='owner') owners, SUM(status='active' AND next_follow IS NOT NULL AND next_follow<>'' AND next_follow<=?) due FROM book_entries WHERE cabinet_id=?`, today(), cab.id);
  const owner = cab.owner_id ? q.get('SELECT id,name,phone FROM users WHERE id=?', cab.owner_id) : null;
  return {
    id: cab.id, kind: cab.kind, title: cab.title, role, owner, created_at: cab.created_at,
    token: canSeeToken(role) ? cab.token : null,
    members: cab.kind === 'personal' ? q.get('SELECT COUNT(*) n FROM book_members WHERE cabinet_id=? AND role=?', cab.id, 'editor').n : null,
    counts: { seekers: c.seekers || 0, owners: c.owners || 0, due: c.due || 0 },
  };
}

// ------------------------------------------------------------------ ثبت‌ها
const intIn = (v, max) => clampInt(v, 0, max, 0);
function cleanEntry(b, old = {}) {
  const pick = (k, d = '') => (b[k] !== undefined ? b[k] : (old[k] !== undefined ? old[k] : d));
  const kind = pick('kind') === 'owner' ? 'owner' : 'seeker';
  if (old.kind && b.kind && b.kind !== old.kind) throw new HttpError(400, 'نوع ثبت را نمی‌توان تغییر داد.');
  const name = str(pick('name'), 80); if (name.length < 2) throw new HttpError(400, 'نام را وارد کنید.');
  let phone = U.normPhone(String(pick('phone')));
  if (!(U.validPhone(phone) || /^0\d{9,10}$/.test(phone))) throw new HttpError(400, 'شماره‌ی تلفن معتبر نیست (مثلاً ۰۹۱۲۳۴۵۶۷۸۹).');
  const deal = DEALS[pick('deal', 'sale')] ? pick('deal', 'sale') : 'sale';
  const ptype = pick('ptype') && META.PTYPES[pick('ptype')] ? pick('ptype') : '';
  if (kind === 'owner' && !ptype) throw new HttpError(400, 'نوع ملک را مشخص کنید.');
  const cityObj = META.findCity(pick('city')); if (!cityObj) throw new HttpError(400, 'شهر را انتخاب کنید.');
  let ds = pick('districts', []); if (typeof ds === 'string') { try { ds = JSON.parse(ds); } catch { ds = []; } }
  ds = [...new Set((Array.isArray(ds) ? ds : []).map(String))].filter((d) => cityObj.districts.some((x) => x.slug === d)).slice(0, kind === 'owner' ? 1 : 6);
  let tags = pick('tags', []); if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch { tags = []; } }
  tags = (Array.isArray(tags) ? tags : []).map((t) => str(t, 20)).filter(Boolean).slice(0, 6);
  const nf = String(pick('next_follow') || ''); const next_follow = /^\d{4}-\d{2}-\d{2}$/.test(nf) ? nf : '';
  let listing_id = pick('listing_id') ? +pick('listing_id') : null;
  if (listing_id && !q.get('SELECT 1 FROM listings WHERE id=?', listing_id)) listing_id = null;
  const status = STATUSES.includes(pick('status', 'active')) ? pick('status', 'active') : 'active';
  const E = 1e13;
  const row = {
    kind, name, phone, deal, ptype, city: cityObj.slug, districts: JSON.stringify(ds), area: intIn(pick('area', 0), 100000), rooms: intIn(pick('rooms', 0), 20),
    price_min: intIn(pick('price_min', 0), E), price_max: intIn(pick('price_max', 0), E), rent_max: intIn(pick('rent_max', 0), E),
    price: intIn(pick('price', 0), E), rent: intIn(pick('rent', 0), E), listing_id, status, note: str(pick('note'), 1000), tags: JSON.stringify(tags), next_follow,
  };
  if (kind === 'seeker' && row.price_min && row.price_max && row.price_min > row.price_max) [row.price_min, row.price_max] = [row.price_max, row.price_min];
  return row;
}
function shapeEntry(r) {
  const city = META.findCity(r.city); const ds = U.jparse(r.districts, []);
  const by = r.created_by ? q.get('SELECT name FROM users WHERE id=?', r.created_by)?.name : null;
  return {
    ...r, districts: ds, tags: U.jparse(r.tags, []), cityName: city?.name || '', by,
    districtNames: ds.map((d) => city?.districts.find((x) => x.slug === d)?.name).filter(Boolean),
    due: !!(r.status === 'active' && r.next_follow && r.next_follow <= today()),
  };
}
const COLS = ['kind', 'name', 'phone', 'deal', 'ptype', 'city', 'districts', 'area', 'rooms', 'price_min', 'price_max', 'rent_max', 'price', 'rent', 'listing_id', 'status', 'note', 'tags', 'next_follow'];

// ------------------------------------------------------------------ تطبیق هوشمند
const toSeek = (r) => ({ deal: r.deal, city: r.city, ptype: r.ptype || '', districts: U.jparse(r.districts, []), area: r.area || 0, rooms: r.rooms || 0, price_min: r.price_min || 0, price_max: r.price_max || 0, rent_max: r.rent_max || 0 });
const toOffer = (r) => ({ deal: r.deal, city: r.city, ptype: r.ptype, district: r.district || U.jparse(r.districts, [])[0] || '', area: r.area || 0, rooms: r.rooms || 0, price: r.price || 0, rent: r.rent || 0 });

/** امتیاز ۰ تا ۱۰۰ برای مناسب‌بودن یک «پیشنهاد/ملک» برای یک «خواهان»؛ اگر معامله یا شهر نخواند null. */
function score(s, o) {
  if (s.deal !== o.deal) return null;
  if (s.city && o.city && s.city !== o.city) return null;
  const city = META.findCity(o.city);
  let sc = 15; const why = [`در ${city?.name || 'شهر موردنظر'}`], warn = [];
  if (!s.ptype) sc += 10; else if (s.ptype === o.ptype) { sc += 20; why.push(`نوع ملک: ${META.PTYPES[o.ptype]}`); } else warn.push(`نوع ملک متفاوت است (${META.PTYPES[o.ptype] || '—'})`);
  const dn = (slug) => city?.districts.find((x) => x.slug === slug)?.name || '';
  if (!s.districts.length) sc += 7;
  else if (o.district && s.districts.includes(o.district)) { sc += 15; why.push(`در محله‌ی دلخواه: ${dn(o.district)}`); } else if (o.district) warn.push(`محله‌ی ${dn(o.district)} (خارج از محله‌های دلخواه)`);
  if (s.deal === 'rent') {
    const part = (val, max, label) => {
      if (!max) return 7.5; if (!val) return 7.5;
      if (val <= max) { why.push(`${label} ${fmtShort(val)} (در بودجه)`); return 15; }
      if (val <= max * 1.1) { warn.push(`${label} حدود ${fa(Math.round((val / max - 1) * 100))}٪ بالاتر از بودجه`); return 8; }
      return 0;
    };
    sc += part(o.price, s.price_max, 'ودیعه') + part(o.rent, s.rent_max, 'اجاره');
  } else if (!s.price_max) sc += 15;
  else if (!o.price) sc += 8;
  else if (o.price <= s.price_max) { sc += 30; why.push(`قیمت ${fmtShort(o.price)} در بودجه`); } else if (o.price <= s.price_max * 1.1) { sc += 18; warn.push(`قیمت حدود ${fa(Math.round((o.price / s.price_max - 1) * 100))}٪ بالاتر از بودجه`); } else if (o.price <= s.price_max * 1.25) { sc += 6; warn.push(`قیمت ${fa(Math.round((o.price / s.price_max - 1) * 100))}٪ بالاتر از بودجه`); }
  if (!s.area) sc += 5; else if (o.area >= s.area) { sc += 10; why.push(`${fa(o.area)} متر (حداقل ${fa(s.area)})`); } else if (o.area >= s.area * 0.9) { sc += 6; warn.push(`${fa(o.area)} متر؛ کمی کمتر از ${fa(s.area)}`); }
  if (!s.rooms) sc += 5; else if (o.rooms >= s.rooms) { sc += 10; why.push(`${fa(o.rooms)} خوابه`); } else if (o.rooms === s.rooms - 1) { sc += 3; warn.push(`یک اتاق کمتر از نیاز (${fa(o.rooms)} خوابه)`); }
  return { score: Math.min(100, Math.round(sc)), reasons: why, warns: warn };
}

const priceText = (o) => (o.deal === 'rent' ? `ودیعه ${o.price ? fmtShort(o.price) : 'توافقی'}${o.rent ? ' و اجاره ' + fmtShort(o.rent) : ''}` : (o.price ? fmtShort(o.price) + ' تومان' : 'قیمت توافقی'));
const BASE = () => (process.env.DAL_BASE_URL || '').replace(/\/$/, '');
function offerFromListing(l) {
  const city = META.findCity(l.city);
  return { type: 'listing', id: l.id, title: l.title, deal: l.deal, ptype: l.ptype, city: l.city, cityName: city?.name || '', district: l.district, districtName: city?.districts.find((x) => x.slug === l.district)?.name || '', area: l.area, rooms: l.rooms, price: l.price, rent: l.rent, link: `#/listing/${l.id}`, shareUrl: BASE() ? `${BASE()}/l/${l.id}` : '' };
}
function offerFromEntry(e, cabTitle) {
  const s = shapeEntry(e);
  return { type: 'entry', id: e.id, cabinet_id: e.cabinet_id, cabinet_title: cabTitle, kind: e.kind, name: e.name, phone: e.phone, title: `${META.PTYPES[e.ptype] || 'ملک'} ${e.area ? fa(e.area) + ' متری ' : ''}${s.districtNames[0] ? 'در ' + s.districtNames[0] : ''}`.trim(), deal: e.deal, ptype: e.ptype, city: e.city, cityName: s.cityName, district: U.jparse(e.districts, [])[0] || '', districtName: s.districtNames[0] || '', area: e.area, rooms: e.rooms, price: e.price, rent: e.rent, listing_id: e.listing_id, link: e.listing_id ? `#/listing/${e.listing_id}` : '' };
}
function messageFor(seeker, offer) {
  const where = [offer.districtName, offer.cityName].filter(Boolean).join('، ');
  const pt = META.PTYPES[offer.ptype] || 'ملک';
  return `سلام ${seeker.name} عزیز، از «دال» تماس می‌گیرم.\nمطابق نیاز شما یک ${pt}${offer.area ? ' ' + fa(offer.area) + ' متری' : ''}${offer.rooms ? ' ' + fa(offer.rooms) + ' خوابه' : ''} در ${where} داریم؛ ${priceText(offer)}.${offer.shareUrl ? '\nجزئیات: ' + offer.shareUrl : ''}\nاگر مایل بودید زمان بازدید را هماهنگ کنیم.`;
}
function messageToOwner(owner, seeker) {
  return `سلام ${owner.name} عزیز، از «دال» تماس می‌گیرم.\nیک خریدار/متقاضی جدی داریم که ملک شما را با نیازش متناسب می‌بیند. اگر ملک هنوز آزاد است، هماهنگ کنیم برای بازدید؟`;
}

const poolCache = new Map();
function poolFor(u, deal, city) {
  const key = `${u.id}|${deal}|${city}`; const hit = poolCache.get(key);
  if (hit && Date.now() - hit.t < 5000) return hit.v;
  const ids = accessibleIds(u);
  const listings = q.all(`SELECT id,title,deal,ptype,price,rent,area,rooms,city,district FROM listings WHERE status='active' AND deal=? AND city=? LIMIT 600`, deal, city).map(offerFromListing);
  const entries = ids.length ? q.all(`SELECT e.*, c.title AS ctitle FROM book_entries e JOIN book_cabinets c ON c.id=e.cabinet_id WHERE e.kind='owner' AND e.status='active' AND e.deal=? AND e.city=? AND e.cabinet_id IN (${ids.map(() => '?').join(',')}) LIMIT 600`, deal, city, ...ids).map((e) => offerFromEntry(e, e.ctitle)) : [];
  const v = { listings, entries }; poolCache.set(key, { t: Date.now(), v });
  if (poolCache.size > 200) poolCache.clear();
  return v;
}
function matchesForSeeker(u, e, limit = 12, min = 45) {
  const s = toSeek(e); const pool = poolFor(u, e.deal, e.city); const out = [];
  for (const o of [...pool.listings, ...pool.entries]) {
    const sc = score(s, o); if (!sc || sc.score < min) continue;
    out.push({ ...o, ...sc, message: messageFor(e, o) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
function matchesForOwner(u, e, limit = 12, min = 45) {
  const ids = accessibleIds(u); if (!ids.length) return [];
  const offer = toOffer(e); const out = [];
  const rows = q.all(`SELECT e.*, c.title AS ctitle FROM book_entries e JOIN book_cabinets c ON c.id=e.cabinet_id WHERE e.kind='seeker' AND e.status='active' AND e.deal=? AND e.city=? AND e.cabinet_id IN (${ids.map(() => '?').join(',')}) LIMIT 800`, e.deal, e.city, ...ids);
  const city = META.findCity(e.city);
  const asOffer = { ...offer, cityName: city?.name, districtName: city?.districts.find((x) => x.slug === offer.district)?.name || '' };
  for (const r of rows) {
    const sc = score(toSeek(r), offer); if (!sc || sc.score < min) continue;
    const sh = shapeEntry(r);
    out.push({ type: 'entry', id: r.id, cabinet_id: r.cabinet_id, cabinet_title: r.ctitle, kind: 'seeker', name: r.name, phone: r.phone, title: `خواهان ${META.PTYPES[r.ptype] || 'ملک'}${sh.districtNames.length ? ' در ' + sh.districtNames.join('، ') : ''}`, deal: r.deal, city: r.city, cityName: sh.cityName, price_max: r.price_max, rent_max: r.rent_max, area: r.area, rooms: r.rooms, ...sc, message: messageFor(r, asOffer) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

function insights(u, cab) {
  const rows = q.all(`SELECT * FROM book_entries WHERE cabinet_id=? AND status='active' ORDER BY updated_at DESC LIMIT 200`, cab.id);
  const pairs = [];
  for (const e of rows) {
    const m = e.kind === 'seeker' ? matchesForSeeker(u, e, 1, 60)[0] : matchesForOwner(u, e, 1, 60)[0];
    if (m) pairs.push({ entry: shapeEntry(e), match: m });
  }
  pairs.sort((a, b) => b.match.score - a.match.score);
  const due = rows.filter((e) => e.next_follow && e.next_follow <= today()).slice(0, 12).map(shapeEntry);
  return { pairs: pairs.slice(0, 12), due };
}

// ------------------------------------------------------------------ مسیرها
function install({ get, post, put, del, AUTH, ADMIN, ip }) {
  ensureMain();
  const listOf = (u) => {
    const ids = new Set(accessibleIds(u));
    const cabs = q.all('SELECT * FROM book_cabinets ORDER BY CASE kind WHEN \'main\' THEN 0 ELSE 1 END, id').filter((c) => ids.has(c.id));
    return cabs.map((c) => cabinetSummary(u, c));
  };

  get('/api/book', AUTH, (ctx) => ({ cabinets: listOf(ctx.user), holder: isHolder(ctx.user), admin: ctx.user.role === 'admin' }));

  post('/api/book/redeem', AUTH, (ctx) => {
    if (!U.rateLimit('bookredeem:' + ctx.user.id, 8, 600e3)) throw new HttpError(429, 'تعداد تلاش‌ها زیاد است؛ چند دقیقه بعد دوباره امتحان کنید.');
    const t = String(ctx.body.token || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cab = t.length >= 12 ? q.all('SELECT * FROM book_cabinets').find((c) => c.token.replace(/[^A-Z0-9]/g, '') === t) : null;
    if (!cab) throw new HttpError(404, 'توکن معتبر نیست.');
    if (cab.kind === 'main') throw new HttpError(400, 'کمد اصلی با توکن باز نمی‌شود؛ مدیر باید برای شما کمد بسازد.');
    if (cab.owner_id === ctx.user.id) return { ok: true, id: cab.id };
    q.run(`INSERT OR IGNORE INTO book_members (cabinet_id,user_id,role) VALUES (?,?, 'editor')`, cab.id, ctx.user.id);
    return { ok: true, id: cab.id, title: cab.title };
  });

  post('/api/book/parse', AUTH, (ctx) => {
    if (!isHolder(ctx.user) && ctx.user.role !== 'admin' && !q.get('SELECT 1 FROM book_members WHERE user_id=?', ctx.user.id)) throw new HttpError(403, 'دسترسی ندارید.');
    const text = str(ctx.body.text, 400); if (text.length < 4) throw new HttpError(400, 'جمله‌ای بنویسید.');
    const { filters: f, tags } = smartParse(text);
    const pm = U.normDigits(text).replace(/[\s-]/g, '').match(/0?9\d{9}/); const phone = pm ? (pm[0].startsWith('0') ? pm[0] : '0' + pm[0]) : '';
    const fields = { deal: f.deal || 'sale', ptype: f.ptype || '', city: f.city || '', districts: f.district ? [f.district] : [], area: f.minArea || 0, rooms: f.rooms || 0, price_min: f.minPrice || 0, price_max: f.maxPrice || 0, rent_max: f.maxRent || 0, phone };
    return { fields, tags };
  });

  get('/api/book/:id', AUTH, (ctx) => {
    const { cab, role } = getCab(ctx.user, ctx.params.id);
    const t = `%${str(ctx.query.q, 40)}%`; const where = ['cabinet_id=?']; const args = [cab.id];
    if (ctx.query.q) { where.push('(name LIKE ? OR phone LIKE ? OR note LIKE ?)'); args.push(t, t, t); }
    if (['seeker', 'owner'].includes(ctx.query.kind)) { where.push('kind=?'); args.push(ctx.query.kind); }
    if (STATUSES.includes(ctx.query.status)) { where.push('status=?'); args.push(ctx.query.status); }
    if (ctx.query.city && META.findCity(ctx.query.city)) { where.push('city=?'); args.push(META.findCity(ctx.query.city).slug); }
    const entries = q.all(`SELECT * FROM book_entries WHERE ${where.join(' AND ')} ORDER BY CASE WHEN status='active' AND next_follow<>'' AND next_follow<=? THEN 0 ELSE 1 END, updated_at DESC, id DESC LIMIT 500`, ...args, today()).map(shapeEntry);
    const members = canSeeToken(role) && cab.kind === 'personal' ? q.all(`SELECT u.id,u.name,u.phone,m.added_at FROM book_members m JOIN users u ON u.id=m.user_id WHERE m.cabinet_id=? AND m.role='editor'`, cab.id) : [];
    return { cabinet: cabinetSummary(ctx.user, cab), entries, members, insights: ctx.query.noinsights ? null : insights(ctx.user, cab) };
  });

  post('/api/book/:id/entries', AUTH, (ctx) => {
    const { cab } = getCab(ctx.user, ctx.params.id);
    if (!U.rateLimit('bookadd:' + ctx.user.id, 120, 3600e3)) throw new HttpError(429, 'تعداد ثبت‌ها زیاد است؛ کمی بعد تلاش کنید.');
    const row = cleanEntry(ctx.body);
    const dup = q.get('SELECT id,name FROM book_entries WHERE cabinet_id=? AND phone=? AND kind=?', cab.id, row.phone, row.kind);
    if (dup && !ctx.body.force) { const e = new HttpError(409, `این شماره قبلاً با نام «${dup.name}» در همین کمد ثبت شده است.`); e.extra = { existing: dup.id }; throw e; }
    const id = q.run(`INSERT INTO book_entries (cabinet_id,${COLS.join(',')},created_by) VALUES (?,${COLS.map(() => '?').join(',')},?)`, cab.id, ...COLS.map((c) => row[c]), ctx.user.id).lastInsertRowid;
    return { ok: true, id: Number(id), entry: shapeEntry(q.get('SELECT * FROM book_entries WHERE id=?', id)) };
  });

  const loadEntry = (u, id) => {
    const e = q.get('SELECT * FROM book_entries WHERE id=?', +id); if (!e) throw new HttpError(404, 'ثبت پیدا نشد.');
    const { cab, role } = getCab(u, e.cabinet_id); return { e, cab, role };
  };
  put('/api/book/entries/:id', AUTH, (ctx) => {
    const { e } = loadEntry(ctx.user, ctx.params.id);
    const row = cleanEntry(ctx.body, e);
    q.run(`UPDATE book_entries SET ${COLS.map((c) => c + '=?').join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, ...COLS.map((c) => row[c]), e.id);
    return { ok: true, entry: shapeEntry(q.get('SELECT * FROM book_entries WHERE id=?', e.id)) };
  });
  del('/api/book/entries/:id', AUTH, (ctx) => {
    const { e, role } = loadEntry(ctx.user, ctx.params.id);
    if (!(role === 'admin' || role === 'owner' || e.created_by === ctx.user.id)) throw new HttpError(403, 'فقط ثبت‌کننده، صاحب کمد یا مدیر می‌تواند حذف کند.');
    q.run('DELETE FROM book_entries WHERE id=?', e.id); return { ok: true };
  });
  post('/api/book/entries/:id/touch', AUTH, (ctx) => {
    const { e } = loadEntry(ctx.user, ctx.params.id);
    const nf = String(ctx.body.next_follow || ''); const note = str(ctx.body.note, 300);
    const nextNote = note ? `${e.note ? e.note + '\n' : ''}[${today()}] ${note}` : e.note;
    q.run(`UPDATE book_entries SET last_contact=?, next_follow=?, note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, today(), /^\d{4}-\d{2}-\d{2}$/.test(nf) ? nf : '', str(nextNote, 2000), e.id);
    return { ok: true, entry: shapeEntry(q.get('SELECT * FROM book_entries WHERE id=?', e.id)) };
  });
  get('/api/book/entries/:id/matches', AUTH, (ctx) => {
    const { e } = loadEntry(ctx.user, ctx.params.id);
    return { items: e.kind === 'seeker' ? matchesForSeeker(ctx.user, e, 15, 40) : matchesForOwner(ctx.user, e, 15, 40) };
  });

  post('/api/book/:id/token', AUTH, (ctx) => {
    const { cab, role } = getCab(ctx.user, ctx.params.id);
    if (cab.kind !== 'personal' || !canSeeToken(role)) throw new HttpError(403, 'فقط صاحب کمد یا مدیر می‌تواند توکن را عوض کند.');
    const t = makeToken(); q.run('UPDATE book_cabinets SET token=? WHERE id=?', t, cab.id);
    if (ctx.body.revoke) q.run(`DELETE FROM book_members WHERE cabinet_id=? AND role='editor'`, cab.id);
    return { ok: true, token: t };
  });
  del('/api/book/:id/members/:uid', AUTH, (ctx) => {
    const { cab, role } = getCab(ctx.user, ctx.params.id);
    if (!canSeeToken(role)) throw new HttpError(403, 'دسترسی ندارید.');
    q.run(`DELETE FROM book_members WHERE cabinet_id=? AND user_id=? AND role='editor'`, cab.id, +ctx.params.uid); return { ok: true };
  });
  del('/api/book/:id/leave', AUTH, (ctx) => {
    const { cab } = getCab(ctx.user, ctx.params.id);
    q.run(`DELETE FROM book_members WHERE cabinet_id=? AND user_id=? AND role='editor'`, cab.id, ctx.user.id); return { ok: true };
  });

  // ---- مدیر
  post('/api/admin/book', ADMIN, (ctx) => {
    const u = q.get('SELECT * FROM users WHERE id=?', +ctx.body.user_id); if (!u || u.banned) throw new HttpError(404, 'کاربر پیدا نشد.');
    if (q.get(`SELECT 1 FROM book_cabinets WHERE kind='personal' AND owner_id=?`, u.id)) throw new HttpError(409, 'این کاربر از قبل کمد دارد.');
    const title = str(ctx.body.title, 60) || `کمد ${u.name}`;
    const id = q.tx(() => {
      const cid = q.run(`INSERT INTO book_cabinets (kind,owner_id,title,token,created_by) VALUES ('personal',?,?,?,?)`, u.id, title, makeToken(), ctx.user.id).lastInsertRowid;
      q.run(`INSERT OR IGNORE INTO book_members (cabinet_id,user_id,role) VALUES (?,?, 'owner')`, cid, u.id); return Number(cid);
    });
    S.notify(u.id, 'کمد شما در دفترچه‌ی دال ساخته شد 🗄️', 'اکنون می‌توانید خواهان‌ها و مالک‌ها را ثبت کنید و پیشنهاد هوشمند بگیرید.', '#/book');
    return { ok: true, cabinet: cabinetSummary(ctx.user, q.get('SELECT * FROM book_cabinets WHERE id=?', id)) };
  });
  put('/api/admin/book/:id', ADMIN, (ctx) => {
    const cab = q.get('SELECT * FROM book_cabinets WHERE id=?', +ctx.params.id); if (!cab) throw new HttpError(404, 'کمد پیدا نشد.');
    const title = str(ctx.body.title, 60); if (title.length < 2) throw new HttpError(400, 'عنوان کمد را وارد کنید.');
    q.run('UPDATE book_cabinets SET title=? WHERE id=?', title, cab.id); return { ok: true };
  });
  del('/api/admin/book/:id', ADMIN, (ctx) => {
    const cab = q.get('SELECT * FROM book_cabinets WHERE id=?', +ctx.params.id); if (!cab) throw new HttpError(404, 'کمد پیدا نشد.');
    if (cab.kind === 'main') throw new HttpError(400, 'کمد اصلی حذف نمی‌شود.');
    q.run('DELETE FROM book_cabinets WHERE id=?', cab.id); return { ok: true };
  });
}

module.exports = { install, score, ensureMain, makeToken, DEALS };
