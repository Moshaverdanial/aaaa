'use strict';
/* بخش درآمدزایی دال:
 *  ۱) معاملات و درآمد: پرونده‌ی معامله، کمیسیون پیشنهادی، قیف فروش، گزارش ماهانه (فقط داده‌های واقعی ثبت‌شده)
 *  ۲) ویژه‌سازی آگهی: پلن‌ها را مدیر تعریف می‌کند؛ پرداخت کارت‌به‌کارت و تأیید دستی (بدون درگاه و سرویس بیرونی)
 *  ۳) سرنخ‌های عمومی «ملکم را بسپارید / دنبال ملک می‌گردم» که خودکار وارد «کمد اصلی» دفترچه می‌شوند
 *  ۴) آمار زنده‌ی صفحه‌ی شهر (کنگان و شیراز)
 */
const { db, q } = require('./db');
const U = require('./util');
const { HttpError, str, clampInt } = U;
const META = require('./meta');
const S = require('./services');
const X = require('./extern');
const Book = require('./book');

db.exec(`
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'sale', title TEXT NOT NULL, city TEXT, district TEXT, listing_id INTEGER, entry_id INTEGER,
  client_name TEXT, client_phone TEXT, other_name TEXT, other_phone TEXT,
  price INTEGER DEFAULT 0, rent INTEGER DEFAULT 0, commission INTEGER DEFAULT 0, received INTEGER DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'lead', note TEXT, next_follow TEXT, closed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_deals_user ON deals(user_id, stage);
CREATE TABLE IF NOT EXISTS promo_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT, plan_title TEXT, days INTEGER, price INTEGER, ref TEXT, note TEXT,
  status TEXT NOT NULL DEFAULT 'pending', admin_note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_promo_status ON promo_requests(status, id);
`);

const STAGES = { lead: 'سرنخ', visit: 'بازدید', negotiation: 'مذاکره', contract: 'قرارداد', closed: 'نهایی‌شده', lost: 'از دست رفته' };
const KINDS = { sale: 'خرید و فروش', rent: 'رهن و اجاره', presale: 'پیش‌فروش', swap: 'معاوضه' };
const today = () => new Date().toISOString().slice(0, 10);
const E = 1e13;

// ------------------------------------------------------------------ کمیسیون
// مقادیر پیش‌فرض فقط نقطه‌ی شروع‌اند؛ تعرفه‌ی رسمی اتحادیه‌ی خودتان را در تنظیمات وارد کنید.
const COMM_DEFAULT = { sale_pct: 0.5, rent_pct: 50, conv: 3, sides: 2 };
function commConf() {
  let c = {}; try { c = JSON.parse(X.getSetting('commission') || '{}'); } catch { /* default */ }
  const n = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) && x >= lo && x <= hi ? x : d; };
  return { sale_pct: n(c.sale_pct, COMM_DEFAULT.sale_pct, 0, 10), rent_pct: n(c.rent_pct, COMM_DEFAULT.rent_pct, 0, 300), conv: n(c.conv, COMM_DEFAULT.conv, 0, 10), sides: [1, 2].includes(+c.sides) ? +c.sides : 2 };
}
function suggest(kind, price, rent, cf = commConf()) {
  price = Math.max(0, +price || 0); rent = Math.max(0, +rent || 0);
  let base, perSide, how;
  if (kind === 'rent') {
    base = rent + Math.round(price * cf.conv / 100); // اجاره‌ی ماهانه‌ی معادل (اجاره + تبدیل ودیعه)
    perSide = Math.round(base * cf.rent_pct / 100);
    how = `${cf.rent_pct}٪ از اجاره‌ی ماهانه‌ی معادل (اجاره + ${cf.conv}٪ ودیعه) برای هر طرف`;
  } else { base = price; perSide = Math.round(price * cf.sale_pct / 100); how = `${cf.sale_pct}٪ از مبلغ معامله برای هر طرف`; }
  return { base, per_side: perSide, total: perSide * cf.sides, sides: cf.sides, how };
}

function cleanDeal(b, old = {}) {
  const pick = (k, d = '') => (b[k] !== undefined ? b[k] : (old[k] !== undefined ? old[k] : d));
  const kind = KINDS[pick('kind', 'sale')] ? pick('kind', 'sale') : 'sale';
  const title = str(pick('title'), 120); if (title.length < 3) throw new HttpError(400, 'عنوان پرونده را بنویسید (مثلاً «آپارتمان ۹۵ متری، کنگان»).');
  const city = META.findCity(pick('city'))?.slug || '';
  const district = city && META.findDistrict(city, pick('district')) ? META.findDistrict(city, pick('district')).slug : '';
  const ph = (v) => { const p = U.normPhone(String(v || '')); return p && /^0\d{9,10}$/.test(p) ? p : ''; };
  let listing_id = pick('listing_id') ? +pick('listing_id') : null;
  if (listing_id && !q.get('SELECT 1 FROM listings WHERE id=?', listing_id)) listing_id = null;
  const nf = String(pick('next_follow') || '');
  const stage = STAGES[pick('stage', 'lead')] ? pick('stage', 'lead') : 'lead';
  return {
    kind, title, city, district, listing_id, entry_id: pick('entry_id') ? +pick('entry_id') : null,
    client_name: str(pick('client_name'), 80), client_phone: ph(pick('client_phone')), other_name: str(pick('other_name'), 80), other_phone: ph(pick('other_phone')),
    price: clampInt(pick('price', 0), 0, E, 0), rent: clampInt(pick('rent', 0), 0, E, 0), commission: clampInt(pick('commission', 0), 0, E, 0), received: clampInt(pick('received', 0), 0, E, 0),
    note: str(pick('note'), 1500), next_follow: /^\d{4}-\d{2}-\d{2}$/.test(nf) ? nf : '', stage,
  };
}
const DCOLS = ['kind', 'title', 'city', 'district', 'listing_id', 'entry_id', 'client_name', 'client_phone', 'other_name', 'other_phone', 'price', 'rent', 'commission', 'received', 'stage', 'note', 'next_follow'];
function shapeDeal(r) {
  const city = META.findCity(r.city);
  return { ...r, cityName: city?.name || '', districtName: city ? (META.findDistrict(r.city, r.district)?.name || '') : '', stageName: STAGES[r.stage], kindName: KINDS[r.kind],
    due: !!(r.next_follow && !['closed', 'lost'].includes(r.stage) && r.next_follow <= today()), owing: r.stage === 'closed' ? Math.max(0, r.commission - r.received) : 0 };
}

function scopeSql(u, all) { return u.role === 'admin' && all ? { w: '1=1', p: [] } : { w: 'user_id=?', p: [u.id] }; }

function report(u, all) {
  const sc = scopeSql(u, all);
  const rows = q.all(`SELECT * FROM deals WHERE ${sc.w}`, ...sc.p);
  const closed = rows.filter((r) => r.stage === 'closed'), lost = rows.filter((r) => r.stage === 'lost'), open = rows.filter((r) => !['closed', 'lost'].includes(r.stage));
  const sum = (a, k) => a.reduce((s, r) => s + (r[k] || 0), 0);
  const ym = (d) => String(d || '').slice(0, 7);
  const now = new Date(); const months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15)); months.push({ ym: d.toISOString().slice(0, 7), date: d.toISOString().slice(0, 10), earned: 0, count: 0 }); }
  for (const r of closed) { const m = months.find((x) => x.ym === ym(r.closed_at)); if (m) { m.earned += r.commission; m.count++; } }
  const byCity = {};
  for (const r of closed) { const k = r.city || '—'; byCity[k] = byCity[k] || { city: k, name: META.findCity(k)?.name || 'نامشخص', count: 0, earned: 0 }; byCity[k].count++; byCity[k].earned += r.commission; }
  const days = closed.filter((r) => r.closed_at).map((r) => Math.max(0, Math.round((new Date(r.closed_at) - new Date(String(r.created_at).slice(0, 10))) / 864e5)));
  const stages = Object.keys(STAGES).map((k) => ({ stage: k, name: STAGES[k], count: rows.filter((r) => r.stage === k).length, value: sum(rows.filter((r) => r.stage === k), 'commission') }));
  const goalRaw = X.getSetting('deal_goal:' + u.id);
  const thisM = months[months.length - 1];
  return {
    total: rows.length, open: open.length, closed: closed.length, lost: lost.length,
    pipeline: sum(open, 'commission'), earned: sum(closed, 'commission'), received: sum(closed, 'received'),
    receivable: closed.reduce((s, r) => s + Math.max(0, r.commission - r.received), 0),
    conversion: closed.length + lost.length ? Math.round(closed.length / (closed.length + lost.length) * 100) : null,
    avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
    months, thisMonth: thisM.earned, goal: goalRaw ? +goalRaw : 0, stages,
    byCity: Object.values(byCity).sort((a, b) => b.earned - a.earned),
  };
}

// ------------------------------------------------------------------ ویژه‌سازی
function promoConf() {
  let c = {}; try { c = JSON.parse(X.getSetting('promo') || '{}'); } catch { /* default */ }
  const plans = (Array.isArray(c.plans) ? c.plans : []).map((p, i) => ({ id: String(p.id || 'p' + (i + 1)).slice(0, 20), title: str(p.title, 40), days: clampInt(p.days, 1, 365, 7), price: clampInt(p.price, 0, 1e11, 0), note: str(p.note, 120) })).filter((p) => p.title && p.price > 0).slice(0, 6);
  const pay = { card: str(c.pay?.card, 30), holder: str(c.pay?.holder, 60), bank: str(c.pay?.bank, 40), note: str(c.pay?.note, 300) };
  return { plans, pay, enabled: plans.length > 0 && !!pay.card };
}

// ------------------------------------------------------------------ مسیرها
function install({ get, post, put, del, AUTH, AGENT, ADMIN, ip }) {
  const myDeal = (u, id) => {
    const r = q.get('SELECT * FROM deals WHERE id=?', +id); if (!r) throw new HttpError(404, 'پرونده پیدا نشد.');
    if (r.user_id !== u.id && u.role !== 'admin') throw new HttpError(403, 'این پرونده‌ی شما نیست.');
    return r;
  };
  const entryOk = (u, entryId) => {
    if (!entryId) return null; const e = q.get('SELECT id,cabinet_id FROM book_entries WHERE id=?', entryId); if (!e) return null;
    return u.role === 'admin' || Book.accessibleIds(u).includes(e.cabinet_id) ? e.id : null;
  };

  get('/api/deals/config', AGENT, () => ({ commission: commConf(), stages: STAGES, kinds: KINDS }));
  put('/api/deals/config', ADMIN, (ctx) => {
    const b = ctx.body || {}; const cur = commConf();
    const next = { sale_pct: b.sale_pct ?? cur.sale_pct, rent_pct: b.rent_pct ?? cur.rent_pct, conv: b.conv ?? cur.conv, sides: b.sides ?? cur.sides };
    X.setSetting('commission', JSON.stringify(next)); return { commission: commConf() };
  });
  get('/api/deals/suggest', AGENT, (ctx) => suggest(ctx.query.kind, ctx.query.price, ctx.query.rent));
  get('/api/deals', AGENT, (ctx) => {
    const all = ctx.query.scope === 'all'; const sc = scopeSql(ctx.user, all);
    const rows = q.all(`SELECT d.*, u.name AS agent_name FROM deals d JOIN users u ON u.id=d.user_id WHERE ${sc.w.replace('user_id', 'd.user_id')} ORDER BY d.updated_at DESC, d.id DESC LIMIT 500`, ...sc.p);
    return { items: rows.map(shapeDeal), report: report(ctx.user, all), commission: commConf(), stages: STAGES, kinds: KINDS, admin: ctx.user.role === 'admin' };
  });
  post('/api/deals', AGENT, (ctx) => {
    if (!U.rateLimit('deal:' + ctx.user.id, 200, 3600e3)) throw new HttpError(429, 'تعداد پرونده‌ها زیاد است؛ کمی بعد تلاش کنید.');
    const d = cleanDeal(ctx.body); d.entry_id = entryOk(ctx.user, d.entry_id);
    if (!d.commission && (d.price || d.rent) && ctx.body.auto_commission !== false) d.commission = suggest(d.kind, d.price, d.rent).total;
    if (d.stage === 'closed') d.closed_at = today();
    const id = q.run(`INSERT INTO deals (user_id,${DCOLS.join(',')},closed_at) VALUES (?,${DCOLS.map(() => '?').join(',')},?)`, ctx.user.id, ...DCOLS.map((c) => d[c]), d.closed_at || null).lastInsertRowid;
    return { ok: true, id: Number(id), deal: shapeDeal(q.get('SELECT * FROM deals WHERE id=?', id)) };
  });
  put('/api/deals/:id', AGENT, (ctx) => {
    const old = myDeal(ctx.user, ctx.params.id); const d = cleanDeal(ctx.body, old);
    d.entry_id = old.entry_id;
    const closedAt = d.stage === 'closed' ? (old.closed_at || today()) : null;
    q.run(`UPDATE deals SET ${DCOLS.map((c) => c + '=?').join(',')}, closed_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, ...DCOLS.map((c) => d[c]), closedAt, old.id);
    return { ok: true, deal: shapeDeal(q.get('SELECT * FROM deals WHERE id=?', old.id)) };
  });
  post('/api/deals/:id/stage', AGENT, (ctx) => {
    const d = myDeal(ctx.user, ctx.params.id); const stage = ctx.body.stage;
    if (!STAGES[stage]) throw new HttpError(400, 'مرحله نامعتبر است.');
    const closedAt = stage === 'closed' ? (d.closed_at || today()) : null;
    q.run('UPDATE deals SET stage=?, closed_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', stage, closedAt, d.id);
    const done = {};
    if (stage === 'closed') {
      if (d.listing_id && ctx.body.mark_listing) {
        const l = q.get('SELECT id,owner_id FROM listings WHERE id=?', d.listing_id);
        if (l && (l.owner_id === ctx.user.id || ctx.user.role === 'admin')) { q.run('UPDATE listings SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', d.kind === 'rent' ? 'rented' : 'sold', l.id); done.listing = true; }
      }
      if (d.entry_id && entryOk(ctx.user, d.entry_id)) { q.run(`UPDATE book_entries SET status='done', updated_at=CURRENT_TIMESTAMP WHERE id=?`, d.entry_id); done.entry = true; }
    }
    return { ok: true, done, deal: shapeDeal(q.get('SELECT * FROM deals WHERE id=?', d.id)) };
  });
  put('/api/deals-goal', AGENT, (ctx) => { X.setSetting('deal_goal:' + ctx.user.id, clampInt(ctx.body.amount, 0, E, 0)); return { ok: true }; });
  del('/api/deals/:id', AGENT, (ctx) => { const d = myDeal(ctx.user, ctx.params.id); q.run('DELETE FROM deals WHERE id=?', d.id); return { ok: true }; });

  // ---------------- ویژه‌سازی
  get('/api/promo/plans', () => { const c = promoConf(); return { enabled: c.enabled, plans: c.enabled ? c.plans : [], pay: c.enabled ? c.pay : null }; });
  get('/api/promo/mine', AUTH, (ctx) => ({ items: q.all(`SELECT p.*, l.title AS listing_title FROM promo_requests p JOIN listings l ON l.id=p.listing_id WHERE p.user_id=? ORDER BY p.id DESC LIMIT 50`, ctx.user.id) }));
  post('/api/promo/request', AUTH, (ctx) => {
    const c = promoConf(); if (!c.enabled) throw new HttpError(400, 'ویژه‌سازی فعلاً فعال نیست.');
    if (!U.rateLimit('promo:' + ctx.user.id, 10, 3600e3)) throw new HttpError(429, 'درخواست‌ها زیاد است؛ کمی بعد تلاش کنید.');
    const l = q.get('SELECT id,title,owner_id,status FROM listings WHERE id=?', +ctx.body.listing_id);
    if (!l || (l.owner_id !== ctx.user.id && ctx.user.role !== 'admin')) throw new HttpError(404, 'آگهی پیدا نشد.');
    if (l.status !== 'active') throw new HttpError(400, 'فقط آگهی‌ی فعال را می‌توان ویژه کرد.');
    const plan = c.plans.find((p) => p.id === ctx.body.plan_id); if (!plan) throw new HttpError(400, 'پلن را انتخاب کنید.');
    if (q.get(`SELECT 1 FROM promo_requests WHERE listing_id=? AND status='pending'`, l.id)) throw new HttpError(409, 'برای این آگهی یک درخواست در انتظار بررسی دارید.');
    const ref = str(ctx.body.ref, 40); if (ref.length < 3) throw new HttpError(400, 'شماره‌ی پیگیری یا ۴ رقم آخر کارت پرداخت‌کننده را بنویسید.');
    const id = q.run('INSERT INTO promo_requests (listing_id,user_id,plan_id,plan_title,days,price,ref,note) VALUES (?,?,?,?,?,?,?,?)', l.id, ctx.user.id, plan.id, plan.title, plan.days, plan.price, ref, str(ctx.body.note, 300)).lastInsertRowid;
    for (const a of q.all(`SELECT id FROM users WHERE role='admin'`)) S.notify(a.id, 'درخواست ویژه‌سازی آگهی', `«${l.title}» — ${plan.title} (${plan.price.toLocaleString('en')} تومان) — پیگیری: ${ref}`, '#/admin/promo');
    return { ok: true, id: Number(id) };
  });
  get('/api/admin/promo', ADMIN, () => {
    const items = q.all(`SELECT p.*, l.title AS listing_title, l.featured_until, u.name AS user_name, u.phone AS user_phone FROM promo_requests p JOIN listings l ON l.id=p.listing_id JOIN users u ON u.id=p.user_id ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END, p.id DESC LIMIT 200`);
    const rev = q.get(`SELECT COALESCE(SUM(price),0) AS total, COUNT(*) AS n FROM promo_requests WHERE status='approved'`);
    const m = q.get(`SELECT COALESCE(SUM(price),0) AS total FROM promo_requests WHERE status='approved' AND strftime('%Y-%m', decided_at)=strftime('%Y-%m','now')`);
    const raw = promoConf(); let stored = {}; try { stored = JSON.parse(X.getSetting('promo') || '{}'); } catch { /* */ }
    return { items, revenue: { total: rev.total, count: rev.n, month: m.total }, config: { plans: raw.plans, pay: raw.pay, enabled: raw.enabled, raw: stored.plans ? stored : { plans: [], pay: {} } }, activeFeatured: q.get(`SELECT COUNT(*) n FROM listings WHERE featured=1`).n };
  });
  put('/api/admin/promo', ADMIN, (ctx) => {
    const b = ctx.body || {};
    const plans = (Array.isArray(b.plans) ? b.plans : []).slice(0, 6).map((p, i) => ({ id: 'p' + (i + 1), title: str(p.title, 40), days: clampInt(p.days, 1, 365, 7), price: clampInt(p.price, 0, 1e11, 0), note: str(p.note, 120) })).filter((p) => p.title && p.price > 0);
    const pay = { card: str(b.pay?.card, 30), holder: str(b.pay?.holder, 60), bank: str(b.pay?.bank, 40), note: str(b.pay?.note, 300) };
    X.setSetting('promo', JSON.stringify({ plans, pay })); return { ok: true, config: promoConf() };
  });
  put('/api/admin/promo/requests/:id', ADMIN, (ctx) => {
    const r = q.get('SELECT * FROM promo_requests WHERE id=?', +ctx.params.id); if (!r) throw new HttpError(404, 'یافت نشد.');
    if (r.status !== 'pending') throw new HttpError(400, 'این درخواست قبلاً بررسی شده است.');
    const st = ctx.body.status; if (!['approved', 'rejected'].includes(st)) throw new HttpError(400, 'وضعیت نامعتبر است.');
    const note = str(ctx.body.note, 300);
    if (st === 'approved') {
      const l = q.get('SELECT featured, featured_until FROM listings WHERE id=?', r.listing_id);
      const base = l?.featured && l.featured_until && new Date(l.featured_until.replace(' ', 'T') + 'Z') > new Date() ? `'${l.featured_until}'` : `datetime('now')`;
      q.run(`UPDATE listings SET featured=1, featured_until=datetime(${base}, '+${r.days} day') WHERE id=?`, r.listing_id);
    }
    q.run(`UPDATE promo_requests SET status=?, admin_note=?, decided_at=CURRENT_TIMESTAMP WHERE id=?`, st, note, r.id);
    S.notify(r.user_id, st === 'approved' ? 'آگهی شما ویژه شد ✨' : 'درخواست ویژه‌سازی رد شد',
      st === 'approved' ? `«${q.get('SELECT title FROM listings WHERE id=?', r.listing_id)?.title}» تا ${r.days} روز در بخش آگهی‌های ویژه نمایش داده می‌شود.` : (note || 'پرداخت تأیید نشد؛ برای پیگیری با پشتیبانی تماس بگیرید.'), `#/listing/${r.listing_id}`);
    return { ok: true };
  });

  // ---------------- سرنخ عمومی → کمد اصلی دفترچه
  post('/api/lead', (ctx) => {
    if (!U.rateLimit('lead:' + ip(ctx.req), 8, 3600e3)) throw new HttpError(429, 'تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید یا مستقیم تماس بگیرید.');
    const b = ctx.body || {}; const kind = b.kind === 'seeker' ? 'seeker' : 'owner';
    if (b.website) return { ok: true, interested: 0 }; // honeypot
    const body = { ...b, districts: b.district ? [b.district] : (b.districts || []), note: str(b.note, 600) };
    const r = Book.addLead(kind, body, 'از سایت');
    const label = kind === 'owner' ? 'مالک / سپرده‌گذار' : 'خواهان ملک';
    const cityName = META.findCity(r.row.city)?.name;
    const main = Book.ensureMain();
    for (const a of q.all(`SELECT id FROM users WHERE role='admin'`)) S.notify(a.id, `سرنخ تازه از سایت: ${label} (${cityName})`, `${r.row.name} — ${r.row.phone}${r.row.note ? '\n' + r.row.note : ''}`, `#/book/${main.id}`);
    return { ok: true, existing: r.existing, interested: Book.interestedCount(kind, r.row), city: cityName };
  });

  // ---------------- صفحه‌ی شهر
  get('/api/city/:slug', (ctx) => {
    const c = META.findCity(ctx.params.slug); if (!c) throw new HttpError(404, 'شهر پیدا نشد.');
    const by = q.all(`SELECT deal, COUNT(*) n FROM listings WHERE city=? AND status='active' GROUP BY deal`, c.slug);
    const dist = q.all(`SELECT district, COUNT(*) n FROM listings WHERE city=? AND status='active' GROUP BY district`, c.slug);
    const nOf = (d) => by.find((x) => x.deal === d)?.n || 0;
    const agents = q.get(`SELECT COUNT(DISTINCT l.owner_id) n FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.city=? AND l.status='active' AND u.role IN ('agent','admin')`, c.slug).n;
    return {
      city: { slug: c.slug, name: c.name, lat: c.lat, lng: c.lng, focus: META.FOCUS.includes(c.slug) },
      counts: { total: by.reduce((s, x) => s + x.n, 0), sale: nOf('sale'), rent: nOf('rent'), presale: nOf('presale') }, agents,
      districts: c.districts.map((d) => ({ slug: d.slug, name: d.name, count: dist.find((x) => x.district === d.slug)?.n || 0 })).sort((a, b) => b.count - a.count),
    };
  });
}

function featuredSweep() { return q.run(`UPDATE listings SET featured=0, featured_until=NULL WHERE featured=1 AND featured_until IS NOT NULL AND featured_until < datetime('now')`).changes; }

module.exports = { install, suggest, featuredSweep, promoConf, commConf };
