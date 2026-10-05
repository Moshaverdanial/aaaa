'use strict';
const faDigits = (t) => String(t ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
const { q } = require('./db');
const { jparse, clampInt, str, normFa, normDigits } = require('./util');
const { findCity, findDistrict, PTYPES, DEALS } = require('./meta');

const BASE_FIELDS = `l.*, u.name AS owner_name, u.role AS owner_role, u.agency AS owner_agency, u.verified AS owner_verified, u.hue AS owner_hue, u.phone AS owner_phone`;

function mapListing(r, { full = false, favSet = null } = {}) {
  if (!r) return null;
  const o = {
    id: r.id, code: r.code, title: faDigits(r.title), deal: r.deal, ptype: r.ptype, price: r.price, rent: r.rent,
    negotiable: !!r.negotiable, area: r.area, rooms: r.rooms, baths: r.baths, year_built: r.year_built,
    floor: r.floor, floors_total: r.floors_total, parking: !!r.parking, storage: !!r.storage, elevator: !!r.elevator,
    city: r.city, district: r.district, lat: r.lat, lng: r.lng,
    cityName: findCity(r.city)?.name || r.city, districtName: findDistrict(r.city, r.district)?.name || r.district,
    images: jparse(r.images, []), features: jparse(r.features, []),
    status: r.status, featured: !!r.featured, verified: !!r.verified, exchange: !!r.exchange, views: r.views,
    created_at: r.created_at, owner_id: r.owner_id,
    owner: { id: r.owner_id, name: r.owner_name, role: r.owner_role, agency: r.owner_agency, verified: !!r.owner_verified, hue: r.owner_hue },
    ppm: r.deal === 'sale' && r.area ? Math.round(r.price / r.area) : null,
    fav: favSet ? favSet.has(r.id) : undefined,
  };
  if (full) {
    Object.assign(o, {
      description: faDigits(r.description), address: r.address, doc_type: r.doc_type, direction: r.direction, flooring: r.flooring,
      units_per_floor: r.units_per_floor, video_url: r.video_url, updated_at: r.updated_at, renewed_at: r.renewed_at, reject_reason: r.reject_reason,
    });
  }
  return o;
}

function favSetFor(userId) {
  if (!userId) return null;
  return new Set(q.all('SELECT listing_id FROM favorites WHERE user_id=?', userId).map((r) => r.listing_id));
}

const SORTS = {
  new: 'l.featured DESC, l.created_at DESC, l.id DESC',
  newest: 'l.created_at DESC, l.id DESC',
  price_asc: 'CASE WHEN l.deal=\'rent\' THEN l.rent ELSE l.price END ASC',
  price_desc: 'CASE WHEN l.deal=\'rent\' THEN l.rent ELSE l.price END DESC',
  area_desc: 'l.area DESC',
  area_asc: 'l.area ASC',
  ppm_asc: 'CASE WHEN l.area>0 THEN 1.0*l.price/l.area END ASC',
  popular: 'l.views DESC',
};

function buildWhere(f, { publicOnly = true } = {}) {
  const w = []; const p = [];
  if (publicOnly) w.push(`l.status = 'active'`);
  else if (f.status) { w.push('l.status = ?'); p.push(f.status); }
  const list = (v) => String(v).split(',').map((x) => x.trim()).filter(Boolean);
  if (f.deal && DEALS[f.deal]) { w.push('l.deal = ?'); p.push(f.deal); }
  if (f.ptype) { const a = list(f.ptype).filter((x) => PTYPES[x]); if (a.length) { w.push(`l.ptype IN (${a.map(() => '?').join(',')})`); p.push(...a); } }
  if (f.city) { w.push('l.city = ?'); p.push(f.city); }
  if (f.district) { const a = list(f.district); w.push(`l.district IN (${a.map(() => '?').join(',')})`); p.push(...a); }
  const num = (k, col, op) => { if (f[k] !== undefined && f[k] !== '' && isFinite(+normDigits(f[k]))) { w.push(`${col} ${op} ?`); p.push(+normDigits(f[k])); } };
  num('minPrice', 'l.price', '>='); num('maxPrice', 'l.price', '<=');
  num('minRent', 'l.rent', '>='); num('maxRent', 'l.rent', '<=');
  num('minArea', 'l.area', '>='); num('maxArea', 'l.area', '<=');
  num('minYear', 'l.year_built', '>='); num('maxYear', 'l.year_built', '<=');
  num('baths', 'l.baths', '>=');
  if (f.rooms !== undefined && f.rooms !== '') {
    const r = clampInt(f.rooms, 0, 10);
    if (r >= 5) w.push('l.rooms >= 5'); else { w.push('l.rooms = ?'); p.push(r); }
  }
  if (f.minRooms) { w.push('l.rooms >= ?'); p.push(clampInt(f.minRooms, 0, 10)); }
  if (f.features) {
    for (const k of list(f.features).filter((x) => /^[a-z]+$/.test(x))) {
      if (['parking', 'storage', 'elevator'].includes(k)) w.push(`l.${k} = 1`);
      else { w.push('l.features LIKE ?'); p.push(`%"${k}"%`); }
    }
  }
  if (f.verified === '1' || f.verified === 1) w.push('l.verified = 1');
  if (f.featured === '1' || f.featured === 1) w.push('l.featured = 1');
  if (f.exchange === '1' || f.exchange === 1) w.push('l.exchange = 1');
  if (f.owner) { w.push('l.owner_id = ?'); p.push(+f.owner); }
  if (f.bbox) {
    const b = String(f.bbox).split(',').map(Number);
    if (b.length === 4 && b.every(isFinite)) { w.push('l.lat BETWEEN ? AND ? AND l.lng BETWEEN ? AND ?'); p.push(b[0], b[2], b[1], b[3]); }
  }
  if (f.q) {
    const t = normFa(f.q).slice(0, 80);
    if (t) {
      w.push(`(REPLACE(l.title,'ي','ی') LIKE ? OR l.description LIKE ? OR l.address LIKE ? OR l.code LIKE ?)`);
      const like = `%${t.replace(/[%_]/g, '')}%`; p.push(like, like, like, like);
    }
  }
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', params: p };
}

function searchListings(f, { userId = null, publicOnly = true, defaultLimit = 12 } = {}) {
  const { where, params } = buildWhere(f, { publicOnly });
  const limit = clampInt(f.limit, 1, 100, defaultLimit);
  const page = clampInt(f.page, 1, 10000, 1);
  const order = SORTS[f.sort] || SORTS.new;
  const total = q.get(`SELECT COUNT(*) AS n FROM listings l ${where}`, ...params).n;
  const rows = q.all(`SELECT ${BASE_FIELDS} FROM listings l JOIN users u ON u.id = l.owner_id ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, ...params, limit, (page - 1) * limit);
  const fav = favSetFor(userId);
  const stats = q.get(`SELECT AVG(CASE WHEN l.deal='sale' AND l.area>0 THEN 1.0*l.price/l.area END) AS avg_ppm, MIN(CASE WHEN l.deal='rent' THEN l.rent ELSE l.price END) AS min_p, MAX(CASE WHEN l.deal='rent' THEN l.rent ELSE l.price END) AS max_p FROM listings l ${where}`, ...params);
  return { items: rows.map((r) => mapListing(r, { favSet: fav })), total, page, pages: Math.ceil(total / limit), limit, stats: { avgPpm: stats.avg_ppm ? Math.round(stats.avg_ppm) : null, minPrice: stats.min_p, maxPrice: stats.max_p } };
}

function getListingRow(id) {
  return q.get(`SELECT ${BASE_FIELDS} FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.id = ?`, id);
}

function notify(userId, title, body = '', link = '') {
  q.run('INSERT INTO notifications (user_id,title,body,link) VALUES (?,?,?,?)', userId, title, body, link);
  // اعلان‌های مدیر به تلگرام هم می‌رود (اگر ربات تنظیم شده باشد)
  try { if (q.get('SELECT role FROM users WHERE id=?', userId)?.role === 'admin') require('./extern').alertAdmin(`${title}${body ? '\n' + body : ''}`); } catch { /* ignore */ }
}

function listingMatches(l, f) {
  const { where, params } = buildWhere(f, { publicOnly: true });
  const r = q.get(`SELECT COUNT(*) AS n FROM listings l ${where ? where + ' AND' : 'WHERE'} l.id = ?`, ...params, l.id);
  return r.n > 0;
}

// وقتی آگهی جدید فعال می‌شود، به کاربرانی که جستجوی ذخیره‌شده‌ی مرتبط دارند اعلان بده
function notifySavedSearches(listingId) {
  const l = getListingRow(listingId); if (!l) return 0;
  let n = 0;
  for (const s of q.all('SELECT * FROM saved_searches WHERE notify=1')) {
    if (s.user_id === l.owner_id) continue;
    const f = jparse(s.query, {});
    try { if (listingMatches(l, f)) { notify(s.user_id, `آگهی جدید مطابق «${s.name}»`, l.title, `#/listing/${l.id}`); n++; } } catch { /* ignore */ }
  }
  // درخواست‌های ملک (تابلوی نیازمندی)
  for (const r of q.all(`SELECT * FROM requests WHERE status='open'`)) {
    if (r.user_id === l.owner_id) continue;
    if (r.deal && r.deal !== l.deal) continue;
    if (r.city && r.city !== l.city) continue;
    if (r.district && r.district !== l.district) continue;
    if (r.ptype && r.ptype !== l.ptype) continue;
    if (r.area_min && l.area < r.area_min) continue;
    if (r.budget_max && l.price > r.budget_max) continue;
    if (r.rent_max && l.deal === 'rent' && l.rent > r.rent_max) continue;
    notify(r.user_id, 'ملکی مطابق درخواست شما ثبت شد', l.title, `#/listing/${l.id}`); n++;
  }
  return n;
}

function agentStats(id) {
  const r = q.get('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE agent_id=?', id);
  const active = q.get(`SELECT COUNT(*) AS n FROM listings WHERE owner_id=? AND status='active'`, id).n;
  const closed = q.get(`SELECT COUNT(*) AS n FROM listings WHERE owner_id=? AND status IN ('sold','rented')`, id).n;
  return { rating: r.avg ? +r.avg.toFixed(1) : null, reviews: r.n, active, closed };
}

function publicUser(u, withStats = true) {
  if (!u) return null;
  const o = {
    id: u.id, name: u.name, role: u.role, agency: u.agency, bio: u.bio, city: u.city, experience: u.experience,
    specialties: jparse(u.specialties, []), hue: u.hue, verified: !!u.verified, license_no: u.role === 'agent' ? u.license_no : undefined,
    created_at: u.created_at,
  };
  if (withStats && u.role === 'agent') Object.assign(o, agentStats(u.id));
  return o;
}

function genCode() {
  for (;;) {
    const c = 'D' + Math.floor(100000 + Math.random() * 900000);
    if (!q.get('SELECT 1 FROM listings WHERE code=?', c)) return c;
  }
}

module.exports = { mapListing, searchListings, getListingRow, notify, notifySavedSearches, favSetFor, publicUser, agentStats, genCode, BASE_FIELDS, buildWhere };
