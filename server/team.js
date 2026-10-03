'use strict';
/* ابزار تیم دال:
 *  ۱) کارت ویزیت دیجیتال مشاور (لینک، QR، vCard) — فقط وقتی خود مشاور روشنش کند
 *  ۲) یادآور پیگیری‌ها: اعلان روزانه‌ی درون‌برنامه + خلاصه‌ی تیم برای مدیر (تلگرام/بله) + تقویم قابل‌اشتراک (ICS) برای گوشی
 *  ۳) گزارش هفتگی مدیر: لیدها، آگهی‌ها، معاملات، کمیسیون، ویژه‌سازی؛ خودکار هر هفته + دکمه‌ی «همین حالا»
 */
const crypto = require('node:crypto');
const { db, q } = require('./db');
const U = require('./util');
const { HttpError, str } = U;
const META = require('./meta');
const S = require('./services');
const X = require('./extern');
const Book = require('./book');

const FA = '۰۱۲۳۴۵۶۷۸۹';
const fa = (n) => String(n).replace(/\d/g, (d) => FA[d]);
const short = (v) => { v = +v || 0; if (v >= 1e9) return fa(+(v / 1e9).toFixed(2)) + ' میلیارد'; if (v >= 1e6) return fa(+(v / 1e6).toFixed(1)) + ' میلیون'; return fa(Math.round(v).toLocaleString('en')); };

// ------------------------------------------------------------------ زمان تهران (ایران ساعت تابستانی ندارد)
function tehran(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour % 24, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
const addDays = (iso, n) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
const inApp = (uid, title, body, link) => q.run('INSERT INTO notifications (user_id,title,body,link) VALUES (?,?,?,?)', uid, title, body, link || '');

// ------------------------------------------------------------------ ۱) کارت ویزیت
const cardCfg = (uid) => { let c = {}; try { c = JSON.parse(X.getSetting('card:' + uid) || '{}'); } catch { /* default */ } return { on: !!c.on, phone: !!c.phone, tagline: str(c.tagline, 90) }; };
function cardData(id) {
  const u = q.get(`SELECT * FROM users WHERE id=? AND role IN ('agent','admin') AND banned=0`, +id);
  const cfg = u && cardCfg(u.id); if (!u || !cfg.on) throw new HttpError(404, 'این کارت ویزیت فعال نیست.');
  const l = S.searchListings({ owner: u.id, limit: 6, sort: 'newest' }, {});
  return { agent: S.publicUser(u), cfg, phone: cfg.phone ? u.phone : null, sitePhones: X.getSite().phones, listings: l.items, total: l.total };
}
const vEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
function vcard(id) {
  const d = cardData(id); const a = d.agent; const tel = d.phone ? '+98' + d.phone.slice(1) : null;
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vEsc(a.name)}`, `N:${vEsc(a.name)};;;;`, `ORG:${vEsc(a.agency || 'دال')}`, `TITLE:${vEsc(a.role === 'admin' ? 'مدیر دال' : 'مشاور املاک')}`];
  if (tel) lines.push(`TEL;TYPE=CELL,VOICE:${tel}`);
  for (const p of d.sitePhones.slice(0, 2)) if ('+98' + p.slice(1) !== tel) lines.push(`TEL;TYPE=WORK,VOICE:+98${p.slice(1)}`);
  const base = (process.env.DAL_BASE_URL || '').replace(/\/$/, '');
  if (base) lines.push(`URL:${base}/c/${id}`);
  if (a.city) lines.push(`ADR;TYPE=WORK:;;;${vEsc(META.findCity(a.city)?.name || '')};;;ایران`);
  if (d.cfg.tagline) lines.push(`NOTE:${vEsc(d.cfg.tagline)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}

// ------------------------------------------------------------------ ۲) یادآورها و تقویم
function dueFor(u, from, to) {
  const ids = Book.accessibleIds(u); const out = [];
  if (ids.length) {
    const rows = q.all(`SELECT e.*, c.title AS ctitle FROM book_entries e JOIN book_cabinets c ON c.id=e.cabinet_id WHERE e.cabinet_id IN (${ids.map(() => '?').join(',')}) AND e.status='active' AND e.next_follow<>'' AND e.next_follow>=? AND e.next_follow<=? ORDER BY e.next_follow LIMIT 400`, ...ids, from, to);
    for (const r of rows) out.push({ type: 'book', id: r.id, date: r.next_follow, name: r.name, phone: r.phone, what: `${r.kind === 'seeker' ? 'خواهان' : 'مالک'} · ${META.PTYPES[r.ptype] || 'ملک'} · ${META.findCity(r.city)?.name || ''}`, where: r.ctitle, link: `#/book/${r.cabinet_id}` });
  }
  if (['agent', 'admin'].includes(u.role)) {
    const rows = q.all(`SELECT * FROM deals WHERE user_id=? AND stage NOT IN ('closed','lost') AND next_follow<>'' AND next_follow>=? AND next_follow<=? ORDER BY next_follow LIMIT 400`, u.id, from, to);
    for (const r of rows) out.push({ type: 'deal', id: r.id, date: r.next_follow, name: r.client_name || r.title, phone: r.client_phone, what: `پرونده: ${r.title}`, where: 'میزکار معاملات', link: '#/deals' });
  }
  return out;
}
const OLD = '2000-01-01';
function reminderJob({ force = false } = {}) {
  const t = tehran(); const hourAt = +(process.env.DAL_REMIND_HOUR || 8);
  if (!force && (t.hour < hourAt || X.getSetting('remind_day') === t.date)) return { skipped: true };
  X.setSetting('remind_day', t.date);
  let users = 0, items = 0; const team = []; const admins = q.all(`SELECT id FROM users WHERE role='admin'`).map((a) => a.id);
  for (const u of q.all(`SELECT * FROM users WHERE banned=0`)) {
    const due = dueFor(u, OLD, t.date); if (!due.length) continue;
    users++; items += due.length; if (u.role !== 'admin') team.push({ name: u.name, n: due.length });
    const late = due.filter((d) => d.date < t.date).length;
    const body = due.slice(0, 5).map((d) => `• ${d.name}${d.phone ? ' — ' + d.phone : ''} (${d.what})`).join('\n') + (due.length > 5 ? `\n… و ${fa(due.length - 5)} مورد دیگر` : '');
    const hasBook = due.some((d) => d.type === 'book');
    inApp(u.id, `☎️ ${fa(due.length)} پیگیری برای امروز${late ? ` (${fa(late)} عقب‌افتاده)` : ''}`, body, hasBook ? due.find((d) => d.type === 'book').link : '#/deals');
  }
  // خلاصه‌ی تیم برای مدیر در تلگرام/بله (یک پیام)
  if (items) {
    const lines = [`☎️ یادآور پیگیری‌های امروز — ${fa(items)} مورد`, ...team.sort((a, b) => b.n - a.n).slice(0, 12).map((x) => `• ${x.name}: ${fa(x.n)} مورد`)];
    try { X.alertAdmin(lines.join('\n')); } catch { /* بدون کانال */ }
  }
  return { users, items };
}

function calKey(uid, regen = false) {
  let k = X.getSetting('cal_key:' + uid);
  if (!k || regen) { k = crypto.randomBytes(16).toString('hex'); X.setSetting('cal_key:' + uid, k); }
  return k;
}
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
function fold(line) { const out = []; let cur = ''; let bytes = 0; for (const ch of line) { const b = Buffer.byteLength(ch); if (bytes + b > 73) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; } } out.push(cur); return out.join('\r\n'); }
function icsFor(u) {
  const t = tehran(); const items = dueFor(u, addDays(t.date, -14), addDays(t.date, 120));
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dal//Followups//FA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:پیگیری‌های دال', 'X-WR-TIMEZONE:Asia/Tehran', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'];
  for (const it of items) {
    const d = it.date.replace(/-/g, ''); const nd = addDays(it.date, 1).replace(/-/g, '');
    L.push('BEGIN:VEVENT', `UID:dal-${it.type}-${it.id}-${d}@dal`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${nd}`,
      `SUMMARY:${icsEsc('پیگیری: ' + it.name)}`, `DESCRIPTION:${icsEsc([it.phone && 'تلفن: ' + it.phone, it.what, it.where].filter(Boolean).join('\n'))}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc('پیگیری ' + it.name)}`, 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT');
  }
  L.push('END:VCALENDAR'); return L.map(fold).join('\r\n') + '\r\n';
}

// ------------------------------------------------------------------ ۳) گزارش هفتگی
function weeklyData() {
  const t = tehran(); const since = addDays(t.date, -7); const sinceTs = `datetime('now','-7 day')`;
  const city = (c) => META.findCity(c)?.name || c;
  const cnt = (sql, ...p) => q.get(sql, ...p).n;
  const siteTag = `(tags LIKE '%از سایت%' OR tags LIKE '%درخواست در سایت%')`;
  const leads = q.all(`SELECT kind, city, COUNT(*) n FROM book_entries WHERE ${siteTag} AND created_at >= ${sinceTs} GROUP BY kind, city`);
  const leadBy = (kind) => leads.filter((x) => x.kind === kind).reduce((s, x) => s + x.n, 0);
  const listings = q.all(`SELECT city, COUNT(*) n FROM listings WHERE created_at >= ${sinceTs} GROUP BY city`);
  const closed = q.all(`SELECT d.*, u.name AS agent FROM deals d JOIN users u ON u.id=d.user_id WHERE d.stage='closed' AND d.closed_at >= ?`, since);
  const byAgent = {}; for (const d of closed) { byAgent[d.agent] = (byAgent[d.agent] || 0) + d.commission; }
  const byCity = {}; for (const d of closed) { const k = d.city || '—'; byCity[k] = (byCity[k] || 0) + d.commission; }
  const receivable = q.all(`SELECT commission, received FROM deals WHERE stage='closed'`).reduce((s, r) => s + Math.max(0, r.commission - r.received), 0);
  const pipeline = q.get(`SELECT COALESCE(SUM(commission),0) v, COUNT(*) n FROM deals WHERE stage NOT IN ('closed','lost')`);
  const promo = q.get(`SELECT COALESCE(SUM(price),0) v, COUNT(*) n FROM promo_requests WHERE status='approved' AND decided_at >= ${sinceTs}`);
  const dueEntries = cnt(`SELECT COUNT(*) n FROM book_entries WHERE status='active' AND next_follow<>'' AND next_follow<=?`, t.date);
  const dueDeals = cnt(`SELECT COUNT(*) n FROM deals WHERE stage NOT IN ('closed','lost') AND next_follow<>'' AND next_follow<=?`, t.date);
  return {
    from: since, to: t.date,
    leads: { owners: leadBy('owner'), seekers: leadBy('seeker'), byCity: leads.reduce((o, x) => { o[x.city] = (o[x.city] || 0) + x.n; return o; }, {}) },
    listings: { total: listings.reduce((s, x) => s + x.n, 0), byCity: Object.fromEntries(listings.map((x) => [x.city, x.n])) },
    users: cnt(`SELECT COUNT(*) n FROM users WHERE created_at >= ${sinceTs}`), contacts: cnt(`SELECT COUNT(*) n FROM contacts WHERE created_at >= ${sinceTs}`),
    deals: { created: cnt(`SELECT COUNT(*) n FROM deals WHERE created_at >= ${sinceTs}`), closed: closed.length, earned: closed.reduce((s, d) => s + d.commission, 0), byAgent: Object.entries(byAgent).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, v]) => ({ name, v })), byCity: Object.entries(byCity).map(([c, v]) => ({ city: c, name: city(c), v })).sort((a, b) => b.v - a.v), receivable, pipeline: pipeline.v, open: pipeline.n },
    promo: { revenue: promo.v, count: promo.n }, due: { entries: dueEntries, deals: dueDeals },
  };
}
function weeklyText(d = weeklyData()) {
  const city = (c) => META.findCity(c)?.name || c; const focus = META.FOCUS;
  const L = [`📊 گزارش هفتگی دال (${d.from} تا ${d.to})`, ''];
  L.push(`🏠 لیدهای سایت: ${fa(d.leads.owners)} مالک و ${fa(d.leads.seekers)} خواهان`);
  const fl = focus.map((c) => `${city(c)}: ${fa(d.leads.byCity[c] || 0)}`).join(' · '); L.push(`   ${fl}`);
  L.push(`📝 آگهی جدید: ${fa(d.listings.total)} (${focus.map((c) => `${city(c)} ${fa(d.listings.byCity[c] || 0)}`).join('، ')})`);
  L.push(`👤 کاربر جدید: ${fa(d.users)} · پیام مشاوره: ${fa(d.contacts)}`, '');
  L.push(`💰 معاملات نهایی‌شده: ${fa(d.deals.closed)} — کمیسیون ${short(d.deals.earned)} تومان`);
  if (d.deals.byAgent.length) L.push(...d.deals.byAgent.map((a, i) => `   ${fa(i + 1)}. ${a.name}: ${short(a.v)}`));
  if (d.deals.byCity.length) L.push('   به تفکیک شهر: ' + d.deals.byCity.map((c) => `${c.name} ${short(c.v)}`).join('، '));
  L.push(`📂 پرونده‌ی تازه: ${fa(d.deals.created)} · در جریان: ${fa(d.deals.open)} (کمیسیون ${short(d.deals.pipeline)})`);
  L.push(`🧾 مطالبات وصول‌نشده: ${short(d.deals.receivable)} تومان`);
  if (d.promo.count) L.push(`✨ ویژه‌سازی: ${fa(d.promo.count)} مورد — ${short(d.promo.revenue)} تومان`);
  L.push('', `☎️ پیگیری عقب‌افتاده: ${fa(d.due.entries)} در دفترچه و ${fa(d.due.deals)} در پرونده‌ها`);
  return L.join('\n');
}
function sendWeekly() {
  const d = weeklyData(); const text = weeklyText(d);
  for (const a of q.all(`SELECT id FROM users WHERE role='admin'`)) inApp(a.id, '📊 گزارش هفتگی دال', text, '#/admin/report');
  let sent = false; try { if (X.channels().length) { X.alertAdmin(text); sent = true; } } catch { /* بدون کانال */ }
  return { text, sent };
}
function weeklyJob() {
  const t = tehran(); const day = +(process.env.DAL_REPORT_DAY ?? 6); const hourAt = +(process.env.DAL_REPORT_HOUR || 9);
  if (t.weekday !== day || t.hour < hourAt || X.getSetting('weekly_day') === t.date) return { skipped: true };
  X.setSetting('weekly_day', t.date); return sendWeekly();
}

function start() {
  const tick = () => { try { reminderJob(); weeklyJob(); } catch (e) { console.error('team job:', e.message); } };
  setTimeout(tick, 20e3).unref(); setInterval(tick, 3600e3).unref();
}

// ------------------------------------------------------------------ مسیرها
function install({ get, post, put, AUTH, AGENT, ADMIN, ip }) {
  get('/api/card/:id', (ctx) => cardData(ctx.params.id));
  get('/api/card/:id/vcard', (ctx) => ({ __raw: vcard(ctx.params.id), type: 'text/vcard; charset=utf-8', headers: { 'Content-Disposition': `attachment; filename="dal-${+ctx.params.id}.vcf"` } }));
  get('/api/me/card', AGENT, (ctx) => ({ cfg: cardCfg(ctx.user.id), agent: S.publicUser(ctx.user), id: ctx.user.id, phone: ctx.user.phone }));
  put('/api/me/card', AGENT, (ctx) => { const b = ctx.body || {}; X.setSetting('card:' + ctx.user.id, JSON.stringify({ on: !!b.on, phone: !!b.phone, tagline: str(b.tagline, 90) })); return { ok: true, cfg: cardCfg(ctx.user.id) }; });

  get('/api/me/calendar', AUTH, (ctx) => ({ path: `/api/cal/${ctx.user.id}-${calKey(ctx.user.id)}.ics`, count: dueFor(ctx.user, tehran().date, addDays(tehran().date, 120)).length }));
  post('/api/me/calendar/reset', AUTH, (ctx) => ({ path: `/api/cal/${ctx.user.id}-${calKey(ctx.user.id, true)}.ics` }));
  get('/api/me/reminders', AUTH, (ctx) => { const t = tehran().date; const items = dueFor(ctx.user, OLD, addDays(t, 7)); return { today: items.filter((i) => i.date <= t), soon: items.filter((i) => i.date > t) }; });
  get('/api/cal/:file', (ctx) => {
    if (!U.rateLimit('cal:' + ip(ctx.req), 120, 3600e3)) throw new HttpError(429, 'درخواست‌ها زیاد است.');
    const m = /^(\d+)-([a-f0-9]{32})\.ics$/.exec(ctx.params.file); if (!m) throw new HttpError(404, 'یافت نشد.');
    const u = q.get('SELECT * FROM users WHERE id=? AND banned=0', +m[1]); const k = X.getSetting('cal_key:' + m[1]);
    if (!u || !k || !crypto.timingSafeEqual(Buffer.from(k), Buffer.from(m[2]))) throw new HttpError(404, 'یافت نشد.');
    return { __raw: icsFor(u), type: 'text/calendar; charset=utf-8', headers: { 'Cache-Control': 'no-cache' } };
  });
  post('/api/admin/reminders/run', ADMIN, () => reminderJob({ force: true }));

  get('/api/admin/report/weekly', ADMIN, () => { const data = weeklyData(); return { data, text: weeklyText(data), channels: X.channels().length }; });
  post('/api/admin/report/weekly/send', ADMIN, (ctx) => { if (!U.rateLimit('wk:' + ctx.user.id, 6, 3600e3)) throw new HttpError(429, 'کمی بعد تلاش کنید.'); return sendWeekly(); });
}

module.exports = { install, start, cardData, vcard, icsFor, dueFor, reminderJob, weeklyData, weeklyText, sendWeekly, tehran, addDays };
