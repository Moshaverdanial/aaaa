'use strict';
/* آزمون سرتاسری روی یک پایگاه‌داده‌ی کاملاً خالی (بدون داده‌ی نمایشی) */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const os = require('node:os'); const fs = require('node:fs'); const path = require('node:path');

const PORT = 3900 + Math.floor(Math.random() * 90);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dal-'));
let proc; const base = `http://127.0.0.1:${PORT}/api`;
const call = async (p, o = {}) => {
  const r = await fetch(base + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(o.token ? { authorization: 'Bearer ' + o.token } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined });
  const ct = r.headers.get('content-type') || ''; return { status: r.status, data: ct.includes('json') ? await r.json() : await r.text() };
};
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const S = {}; // وضعیت مشترک بین آزمون‌ها

// سرورهای ساختگی: بالادست نقشه و API سازگار با تلگرام/بله (اینترنت بیرونی در آزمون نیست)
const http = require('node:http');
const PNG_BUF = Buffer.from(PNG.split(',')[1], 'base64');
let tileSrv, botSrv, tileHits = 0; const botCalls = []; let tilePort, botPort;
const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));

before(async () => {
  tileSrv = http.createServer((req, res) => { tileHits++; res.writeHead(200, { 'content-type': 'image/png' }); res.end(PNG_BUF); });
  botSrv = http.createServer((req, res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { botCalls.push({ url: req.url, body: b }); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, result: {} })); }); });
  tilePort = await listen(tileSrv); botPort = await listen(botSrv);
  proc = spawn(process.execPath, ['--no-warnings', path.join(__dirname, '..', 'index.js')], { env: { ...process.env, PORT, DAL_DATA_DIR: dir, DAL_DB: path.join(dir, 't.db'), DAL_TILE_LIGHT: `http://127.0.0.1:${tilePort}/{z}/{x}/{y}.png`, DAL_BALE_API: `http://127.0.0.1:${botPort}`, DAL_BALE_TOKEN: '111:TESTTOKEN', DAL_BALE_CHAT: '555' }, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { await fetch(base + '/health'); return; } catch { await new Promise((r) => setTimeout(r, 200)); } }
  throw new Error('server did not start');
});
after(() => { proc && proc.kill(); tileSrv && tileSrv.close(); botSrv && botSrv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const listingBody = (o = {}) => ({ title: 'آپارتمان ۱۰۰ متری نوساز در سعادت‌آباد', deal: 'sale', ptype: 'apartment', city: 'tehran', district: 'saadat-abad', area: 100, price: 9e9, rooms: 2, baths: 1, year_built: 1400, floor: 3, floors_total: 5, features: ['parking', 'elevator'], images: [S.img], description: 'توضیحات تست', ...o });

test('پایگاه‌داده خالی است و راه‌اندازی لازم است', async () => {
  assert.strictEqual((await call('/setup/status')).data.needsSetup, true);
  const l = await call('/listings'); assert.strictEqual(l.data.total, 0);
  const st = await call('/stats/home'); assert.strictEqual(st.data.listings, 0); assert.strictEqual(st.data.agents, 0);
  assert.strictEqual((await call('/articles')).data.items.length, 0);
  assert.strictEqual((await call('/requests')).data.items.length, 0);
});

test('ساخت مدیر فقط با کد راه‌اندازی', async () => {
  const bad = await call('/setup', { body: { token: 'nope', name: 'مدیر تست', phone: '09120000001', password: 'Admin12345' } }); assert.strictEqual(bad.status, 403);
  const tok = fs.readFileSync(path.join(dir, '.setup-token'), 'utf8').trim();
  const weak = await call('/setup', { body: { token: tok, name: 'مدیر تست', phone: '09120000001', password: 'abc' } }); assert.strictEqual(weak.status, 400);
  const ok = await call('/setup', { body: { token: tok, name: 'مدیر تست', phone: '09120000001', password: 'Admin12345' } });
  assert.strictEqual(ok.status, 200); assert.strictEqual(ok.data.user.role, 'admin'); assert.match(ok.data.recovery, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  S.admin = ok.data.token; S.adminRecovery = ok.data.recovery;
  assert.strictEqual((await call('/setup/status')).data.needsSetup, false);
  assert.strictEqual((await call('/setup', { body: { token: tok, name: 'x', phone: '09120000002', password: 'Admin12345' } })).status, 403);
});

test('ثبت‌نام، ورود و اعتبارسنجی', async () => {
  assert.strictEqual((await call('/auth/register', { body: { name: 'علی رضایی', phone: '123', password: 'User12345' } })).status, 400);
  assert.strictEqual((await call('/auth/register', { body: { name: 'علی رضایی', phone: '09121111111', password: '12345678' } })).status, 400, 'رمز بدون حرف');
  const u = await call('/auth/register', { body: { name: 'علی رضایی', phone: '۰۹۱۲۱۱۱۱۱۱۱', password: 'User12345' } });
  assert.strictEqual(u.status, 200); S.user = u.data.token; S.userId = u.data.user.id; S.userRecovery = u.data.recovery;
  assert.strictEqual((await call('/auth/register', { body: { name: 'علی رضایی', phone: '09121111111', password: 'User12345' } })).status, 409);
  assert.strictEqual((await call('/auth/register', { body: { name: 'مشاور تست', phone: '09122222222', password: 'Agent12345', role: 'agent' } })).status, 400, 'مشاور بدون پروانه');
  const a = await call('/auth/register', { body: { name: 'مشاور تست', phone: '09122222222', password: 'Agent12345', role: 'agent', license_no: '1402/555', agency: 'املاک تست', city: 'tehran' } });
  assert.strictEqual(a.status, 200); S.agent = a.data.token; S.agentId = a.data.user.id;
  const b = await call('/auth/register', { body: { name: 'خریدار دوم', phone: '09123333333', password: 'Buyer12345' } }); S.user2 = b.data.token;
  assert.strictEqual((await call('/auth/login', { body: { phone: '09121111111', password: 'bad' } })).status, 401);
  const l = await call('/auth/login', { body: { phone: '09121111111', password: 'User12345' } }); assert.ok(l.data.token);
  assert.strictEqual((await call('/me', { token: S.user })).data.user.name, 'علی رضایی');
  assert.strictEqual((await call('/me')).status, 401);
});

test('بازیابی رمز با کد بازیابی و ابطال توکن‌های قبلی', async () => {
  const bad = await call('/auth/reset', { body: { phone: '09121111111', code: 'AAAA-BBBB-CCCC', password: 'NewPass123' } }); assert.strictEqual(bad.status, 400);
  const r = await call('/auth/reset', { body: { phone: '09121111111', code: S.userRecovery.toLowerCase(), password: 'NewPass123' } });
  assert.strictEqual(r.status, 200); assert.notStrictEqual(r.data.recovery, S.userRecovery);
  assert.strictEqual((await call('/me', { token: S.user })).status, 401, 'توکن قدیمی باید باطل شود');
  assert.strictEqual((await call('/auth/reset', { body: { phone: '09121111111', code: S.userRecovery, password: 'Other12345' } })).status, 400, 'کد مصرف‌شده');
  assert.ok((await call('/auth/login', { body: { phone: '09121111111', password: 'NewPass123' } })).data.token);
  S.user = r.data.token; S.userRecovery = r.data.recovery;
});

test('تغییر رمز، پروفایل و کد بازیابی جدید', async () => {
  assert.strictEqual((await call('/me/password', { method: 'PUT', token: S.user, body: { old: 'wrong', password: 'Another123' } })).status, 400);
  const ch = await call('/me/password', { method: 'PUT', token: S.user, body: { old: 'NewPass123', password: 'Another123' } }); assert.strictEqual(ch.status, 200); S.user = ch.data.token;
  const p = await call('/me', { method: 'PUT', token: S.user, body: { name: 'علی رضایی‌نژاد', email: 'ali@example.com' } }); assert.strictEqual(p.data.user.email, 'ali@example.com');
  assert.strictEqual((await call('/me', { method: 'PUT', token: S.user, body: { email: 'bad' } })).status, 400);
  const rc = await call('/me/recovery', { token: S.user, body: { password: 'Another123' } }); assert.ok(rc.data.recovery); S.userRecovery = rc.data.recovery;
});

test('ثبت آگهی: تصویر الزامی و صف تأیید', async () => {
  const up = await call('/upload', { token: S.user, body: { data: PNG } }); assert.strictEqual(up.status, 200); S.img = up.data.url;
  assert.strictEqual((await call('/upload', { token: S.user, body: { data: 'data:image/png;base64,AAAA' } })).status, 400, 'امضای نادرست');
  assert.strictEqual((await call('/upload', { body: { data: PNG } })).status, 401);
  const img = await fetch(`http://127.0.0.1:${PORT}${S.img}`); assert.strictEqual(img.status, 200);
  assert.strictEqual((await call('/listings', { token: S.user, body: listingBody({ images: [] }) })).status, 400, 'بدون تصویر');
  assert.strictEqual((await call('/listings', { token: S.user, body: listingBody({ price: 0 }) })).status, 400);
  const c = await call('/listings', { token: S.user, body: listingBody() }); assert.strictEqual(c.status, 200); assert.strictEqual(c.data.status, 'pending'); S.l1 = c.data.id;
  assert.strictEqual((await call('/listings')).data.total, 0, 'آگهی در انتظار عمومی نیست');
  assert.strictEqual((await call('/listings/' + S.l1)).status, 404);
  assert.strictEqual((await call('/listings/' + S.l1, { token: S.user })).data.canEdit, true);
  assert.ok((await call('/notifications', { token: S.admin })).data.items.some((n) => n.title.includes('در انتظار')), 'مدیر باید خبردار شود');
});

test('مدیر: رد و تأیید آگهی، ویرایش دوباره‌ی آگهی ردشده', async () => {
  assert.strictEqual((await call('/admin/listings/' + S.l1, { method: 'PUT', token: S.user, body: { status: 'active' } })).status, 403);
  await call('/admin/listings/' + S.l1, { method: 'PUT', token: S.admin, body: { status: 'rejected', reject_reason: 'تصویر نامناسب' } });
  assert.strictEqual((await call('/my/listings', { token: S.user })).data.items[0].reject_reason, 'تصویر نامناسب');
  const e = await call('/listings/' + S.l1, { method: 'PUT', token: S.user, body: { description: 'ویرایش‌شده' } }); assert.strictEqual(e.data.status, 'pending');
  await call('/admin/listings/' + S.l1, { method: 'PUT', token: S.admin, body: { status: 'active', verified: true } });
  const l = await call('/listings'); assert.strictEqual(l.data.total, 1);
  assert.strictEqual(l.data.items[0].verified, true);
});

test('مشاور تأییدنشده و تأییدشده', async () => {
  const c = await call('/listings', { token: S.agent, body: listingBody({ title: 'ویلای ۳۰۰ متری در نیاوران', ptype: 'villa', district: 'niavaran', area: 300, price: 4e10 }) }); assert.strictEqual(c.data.status, 'pending'); S.l2 = c.data.id;
  await call('/admin/users/' + S.agentId, { method: 'PUT', token: S.admin, body: { verified: true } });
  const d = await call('/listings', { token: S.agent, body: listingBody({ title: 'آپارتمان اجاره‌ای در ونک', deal: 'rent', price: 5e8, rent: 2e7, area: 80, district: 'vanak' }) }); assert.strictEqual(d.data.status, 'active'); S.l3 = d.data.id;
  const e = await call('/listings/' + S.l3, { method: 'PUT', token: S.agent, body: { rent: 1.8e7 } }); assert.strictEqual(e.data.status, 'active');
  const det = await call('/listings/' + S.l3); assert.strictEqual(det.data.history.length, 2, 'تاریخچه‌ی قیمت');
  await call('/admin/listings/' + S.l2, { method: 'PUT', token: S.admin, body: { status: 'active' } });
});

test('جستجو، فیلتر، مرتب‌سازی و جستجوی هوشمند', async () => {
  assert.strictEqual((await call('/listings?deal=rent')).data.total, 1);
  assert.strictEqual((await call('/listings?ptype=villa')).data.total, 1);
  assert.strictEqual((await call('/listings?minPrice=10000000000&deal=sale')).data.total, 1);
  assert.strictEqual((await call('/listings?district=vanak')).data.total, 1);
  assert.strictEqual((await call('/listings?q=ونک')).data.total, 1);
  const s = await call('/listings?deal=sale&sort=price_asc'); const p = s.data.items.map((i) => i.price); assert.deepStrictEqual(p, [...p].sort((a, b) => a - b));
  const sm = await call('/smart-search', { body: { q: 'ویلا در نیاوران' } }); assert.strictEqual(sm.data.filters.ptype, 'villa'); assert.strictEqual(sm.data.count, 1);
  assert.strictEqual((await call('/listings/map?deal=sale')).data.items.length, 2);
  assert.strictEqual((await call('/listings/compare?ids=' + S.l1 + ',' + S.l3)).data.items.length, 2);
});

test('علاقه‌مندی، جستجوی ذخیره‌شده و اعلان آگهی تازه', async () => {
  assert.strictEqual((await call('/favorites/' + S.l3, { token: S.user2, body: {} })).data.fav, true);
  assert.strictEqual((await call('/favorites', { token: S.user2 })).data.items.length, 1);
  assert.strictEqual((await call('/favorites/' + S.l3, { token: S.user2, body: {} })).data.fav, false);
  assert.strictEqual((await call('/saved-searches', { token: S.user2, body: { name: 'ویلا', query: {} } })).status, 400);
  const ss = await call('/saved-searches', { token: S.user2, body: { name: 'آپارتمان نیاوران', query: { ptype: 'apartment', district: 'niavaran' } } }); assert.ok(ss.data.id);
  await call('/favorites/' + S.l1, { token: S.user2, body: {} });
  const n = await call('/listings', { token: S.agent, body: listingBody({ title: 'آپارتمان لوکس در نیاوران', district: 'niavaran', price: 2e10 }) }); assert.strictEqual(n.status, 200);
  assert.ok((await call('/notifications', { token: S.user2 })).data.items.some((x) => x.title.includes('آپارتمان نیاوران')), 'اعلان جستجوی ذخیره‌شده');
  const price = await call('/listings/' + S.l1, { method: 'PUT', token: S.user, body: { price: 8e9 } }); assert.strictEqual(price.status, 200);
  assert.ok((await call('/notifications', { token: S.user2 })).data.items.some((x) => x.title.includes('کاهش قیمت')), 'اعلان کاهش قیمت');
  const list = await call('/saved-searches', { token: S.user2 }); assert.strictEqual(list.data.items[0].count, 1);
  assert.strictEqual((await call('/saved-searches/' + ss.data.id, { method: 'DELETE', token: S.user2 })).status, 200);
});

test('درخواست مشاوره، چت و بازدید', async () => {
  assert.strictEqual((await call(`/listings/${S.l3}/inquiries`, { body: { name: 'م', phone: '1', message: 'x' } })).status, 400);
  assert.strictEqual((await call(`/listings/${S.l3}/inquiries`, { body: { name: 'مهمان', phone: '09124444444', message: 'آیا هنوز موجود است؟' } })).status, 200);
  const inb = await call('/inquiries', { token: S.agent }); assert.strictEqual(inb.data.items.length, 1);
  assert.strictEqual((await call('/inquiries/' + inb.data.items[0].id, { method: 'PUT', token: S.agent, body: { status: 'contacted' } })).status, 200);
  assert.strictEqual((await call('/threads', { token: S.agent, body: { listing_id: S.l3, body: 'سلام' } })).status, 400, 'پیام به آگهی خود');
  const t = await call('/threads', { token: S.user2, body: { listing_id: S.l3, body: 'سلام، وقت دارید؟' } }); assert.ok(t.data.id);
  assert.strictEqual((await call(`/threads/${t.data.id}/messages`, { token: S.agent, body: { body: 'بله، بفرمایید' } })).status, 200);
  assert.strictEqual((await call('/threads/' + t.data.id, { token: S.user })).status, 404, 'غریبه نباید ببیند');
  const th = await call('/threads/' + t.data.id, { token: S.user2 }); assert.strictEqual(th.data.messages.length, 2);
  assert.strictEqual((await call('/threads', { token: S.agent })).data.items[0].unread, 1);
  await call('/threads/' + t.data.id, { token: S.agent });
  assert.strictEqual((await call('/threads', { token: S.agent })).data.items[0].unread, 0, 'پس از خواندن');
  const d = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  assert.strictEqual((await call(`/listings/${S.l3}/slots?date=${d}`)).data.slots.length, 10);
  const ap = await call(`/listings/${S.l3}/appointments`, { token: S.user2, body: { date: d, time: '10:00', note: 'همراه همسرم' } }); assert.ok(ap.data.id);
  assert.strictEqual((await call(`/listings/${S.l3}/appointments`, { token: S.user, body: { date: d, time: '10:00' } })).status, 409, 'ساعت رزرو شده');
  assert.strictEqual((await call(`/listings/${S.l3}/slots?date=${d}`)).data.slots.find((x) => x.time === '10:00').free, false);
  assert.strictEqual((await call('/appointments/' + ap.data.id, { method: 'PUT', token: S.agent, body: { status: 'confirmed' } })).status, 200);
  assert.strictEqual((await call('/appointments/' + ap.data.id, { method: 'PUT', token: S.user2, body: { status: 'done' } })).status, 403);
  assert.strictEqual((await call('/appointments', { token: S.user2 })).data.mine[0].status, 'confirmed');
});

test('نظر درباره‌ی مشاور فقط پس از ارتباط واقعی', async () => {
  assert.strictEqual((await call(`/agents/${S.agentId}/reviews`, { token: S.user, body: { rating: 5, comment: 'عالی' } })).status, 403);
  assert.strictEqual((await call(`/agents/${S.agentId}/reviews`, { token: S.user2, body: { rating: 4, comment: 'خوب' } })).status, 200);
  const ag = await call('/agents/' + S.agentId); assert.strictEqual(ag.data.agent.rating, 4); assert.strictEqual(ag.data.reviews.length, 1); assert.ok(ag.data.total >= 2);
  assert.strictEqual((await call('/agents')).data.items.length, 1);
});

test('تابلوی درخواست و پاسخ مشاور', async () => {
  const r = await call('/requests', { token: S.user, body: { title: 'دنبال آپارتمان ۲ خوابه در ونک', deal: 'rent', city: 'tehran', district: 'vanak', rent_max: 3e7 } }); assert.ok(r.data.id);
  assert.strictEqual((await call('/requests')).data.items[0].mine, false);
  assert.strictEqual((await call(`/requests/${r.data.id}/respond`, { token: S.user2, body: { message: 'x' } })).status, 403);
  assert.strictEqual((await call(`/requests/${r.data.id}/respond`, { token: S.agent, body: { listing_id: S.l3, message: 'این گزینه مناسب است' } })).status, 200);
  assert.ok((await call('/notifications', { token: S.user })).data.items.some((n) => n.title.includes('پاسخ داد')));
  assert.strictEqual((await call('/requests/' + r.data.id, { method: 'DELETE', token: S.user2 })).status, 404);
  assert.strictEqual((await call('/requests/' + r.data.id, { method: 'DELETE', token: S.user })).status, 200);
});

test('گزارش تخلف و رسیدگی مدیر', async () => {
  assert.strictEqual((await call(`/listings/${S.l3}/report`, { body: { reason: '' } })).status, 400);
  assert.strictEqual((await call(`/listings/${S.l3}/report`, { token: S.user, body: { reason: 'کلاهبرداری', details: 'شماره‌ی تماس اشتباه است' } })).status, 200);
  const rp = await call('/admin/reports', { token: S.admin }); assert.strictEqual(rp.data.items.length, 1);
  assert.strictEqual((await call('/admin/reports', { token: S.user })).status, 403);
  assert.strictEqual((await call('/admin/reports/' + rp.data.items[0].id, { method: 'PUT', token: S.admin, body: { status: 'resolved' } })).status, 200);
});

test('وضعیت آگهی، تمدید و حذف', async () => {
  assert.strictEqual((await call(`/listings/${S.l3}/status`, { method: 'PUT', token: S.user, body: { status: 'rented' } })).status, 403);
  assert.strictEqual((await call(`/listings/${S.l3}/status`, { method: 'PUT', token: S.agent, body: { status: 'rented' } })).status, 200);
  assert.strictEqual((await call('/listings?deal=rent')).data.total, 0);
  assert.strictEqual((await call(`/listings/${S.l3}/status`, { method: 'PUT', token: S.agent, body: { status: 'active' } })).data.status, 'active');
  assert.strictEqual((await call(`/listings/${S.l3}/renew`, { token: S.agent, body: {} })).data.status, 'active');
  const dash = await call('/dashboard', { token: S.agent }); assert.ok(dash.data.listings.total >= 3);
  const csv = await call('/my/listings.csv', { token: S.agent }); assert.ok(String(csv.data).includes('آپارتمان'));
  assert.strictEqual((await call('/listings/' + S.l1, { method: 'DELETE', token: S.user2 })).status, 403);
  assert.strictEqual((await call('/listings/' + S.l1, { method: 'DELETE', token: S.user })).status, 200);
  assert.strictEqual((await call('/listings/' + S.l1)).status, 404);
});

test('تحلیل بازار و برآورد قیمت از داده‌ی واقعی', async () => {
  const m = await call('/analytics/market?city=tehran');
  const van = m.data.districts.find((d) => d.slug === 'vanak'); assert.strictEqual(van.growth12, null, 'بدون تاریخچه رشد نداریم');
  const nia = m.data.districts.find((d) => d.slug === 'niavaran'); assert.ok(nia.samples >= 1 && nia.source !== 'reference');
  assert.ok(m.data.cityTrend.length >= 1);
  const v = await call('/valuate', { body: { city: 'tehran', district: 'niavaran', ptype: 'apartment', area: 100, rooms: 2 } });
  assert.ok(v.data.low < v.data.price && v.data.price < v.data.high); assert.ok(['blended', 'market'].includes(v.data.basis));
  const v2 = await call('/valuate', { body: { city: 'tehran', district: 'zaferanieh', ptype: 'apartment', area: 100 } }); assert.strictEqual(v2.data.basis, 'reference');
});

test('تمرکز ویژه: کنگان و شیراز، شماره‌های مشاوره، درخواست مشاوره', async () => {
  const meta = (await call('/meta')).data;
  assert.deepStrictEqual(meta.cities.slice(0, 2).map((c) => c.slug), ['kangan', 'shiraz']);
  assert.deepStrictEqual(meta.site.phones, ['09206696092', '09202290930']);
  assert.ok(meta.cities[0].districts.length >= 30);
  // محله‌ی کنگان قیمت مرجع ندارد؛ بدون داده برآورد ساخته نمی‌شود (نه عدد ساختگی)
  assert.strictEqual((await call('/valuate', { body: { city: 'kangan', district: 'shahrak-yas', area: 100 } })).status, 422);
  const m = (await call('/analytics/market?city=kangan')).data; assert.ok(m.districts.every((d) => d.ppm === null && d.source === 'none'));
  assert.strictEqual((await call('/consult', { body: { name: 'الف', phone: '123', city: 'kangan' } })).status, 400);
  assert.strictEqual((await call('/consult', { body: { name: 'خریدار کنگان', phone: '09125550000', city: 'kangan', kind: 'buy', note: 'آپارتمان ۲ خوابه' } })).status, 200);
  const cs = (await call('/admin/contacts', { token: S.admin })).data.items; const c = cs.find((x) => x.contact === '09125550000');
  assert.ok(c && c.city === 'kangan' && c.kind === 'buy');
  assert.strictEqual((await call('/admin/site', { token: S.user2 })).status, 403);
  assert.strictEqual((await call('/admin/site', { method: 'PUT', token: S.admin, body: { phones: 'abc' } })).status, 400);
  const sv = await call('/admin/site', { method: 'PUT', token: S.admin, body: { phones: '09206696092\n09202290930', telegram: '@dal_support' } });
  assert.strictEqual(sv.data.site.telegram, 'dal_support');
  assert.strictEqual((await call('/geocode?q=ab')).data.items.length, 0);
  const id = (await call('/listings?limit=1')).data.items[0]?.id;
  const root = base.replace(/\/api$/, ''); const cid = c.id;
  assert.strictEqual((await call('/admin/contacts/' + cid, { method: 'PUT', token: S.admin, body: { status: 'contacted', admin_note: 'ساعت ۵ تماس گرفته شد' } })).status, 200);
  const fl = (await call('/admin/contacts?status=contacted', { token: S.admin })).data; assert.ok(fl.items.some((x) => x.id === cid && x.admin_note.includes('تماس')) && fl.counts.contacted >= 1);
  assert.strictEqual((await call('/admin/contacts?status=done', { token: S.admin })).data.items.some((x) => x.id === cid), false);
  const csv = await fetch(root + '/api/admin/contacts.csv', { headers: { authorization: 'Bearer ' + S.admin } }); assert.ok((await csv.text()).includes('09125550000'));
  if (id) { const pg = await (await fetch(root + '/l/' + id)).text(); assert.ok(pg.includes('og:title') && pg.includes('#/listing/' + id)); }
  const sm = await (await fetch(root + '/sitemap.xml')).text(); assert.ok(sm.includes('<urlset'));
  assert.ok((await (await fetch(root + '/robots.txt')).text()).includes('Sitemap:'));
  const nl = await call('/smart-search', { body: { q: 'آپارتمان در شهرک یاس کنگان' } });
  assert.strictEqual(nl.data.filters.city, 'kangan'); assert.strictEqual(nl.data.filters.district, 'shahrak-yas');
});

test('مدیر همکار می‌سازد و آگهی همکار مستقیم منتشر می‌شود؛ مجله به‌طور پیش‌فرض خالی است', async () => {
  assert.strictEqual((await call('/articles')).data.items.length, 0, 'مقاله‌ی ساختگی نداریم');
  assert.strictEqual((await call('/admin/users', { token: S.user2, body: { name: 'همکار', phone: '09127770000' } })).status, 403);
  assert.strictEqual((await call('/admin/users', { token: S.admin, body: { name: 'همکار', phone: '123' } })).status, 400);
  const mk = await call('/admin/users', { token: S.admin, body: { name: 'همکار کنگان', phone: '09127770000', role: 'agent', agency: 'دفتر کنگان' } });
  assert.strictEqual(mk.status, 200); assert.ok(mk.data.temp_password && mk.data.recovery);
  assert.strictEqual((await call('/admin/users', { token: S.admin, body: { name: 'همکار کنگان', phone: '09127770000' } })).status, 409);
  const lg = await call('/auth/login', { body: { phone: '09127770000', password: mk.data.temp_password } }); assert.ok(lg.data.token);
  const l = await call('/listings', { token: lg.data.token, body: listingBody({ city: 'kangan', district: 'shahrak-yas', title: 'آپارتمان همکار در شهرک یاس' }) });
  assert.strictEqual(l.status, 200); assert.strictEqual(l.data.status, 'active');
});

test('مدیریت: کاربران، بازنشانی رمز، مقاله و دسترسی‌ها', async () => {
  assert.strictEqual((await call('/admin/stats', { token: S.user2 })).status, 403);
  const st = await call('/admin/stats', { token: S.admin }); assert.ok(st.data.users >= 4);
  assert.strictEqual((await call('/admin/users?q=تست', { token: S.admin })).data.items.length >= 2, true);
  const rs = await call('/admin/users/' + S.agentId, { method: 'PUT', token: S.admin, body: { reset_password: true } }); assert.ok(rs.data.temp_password);
  assert.strictEqual((await call('/me', { token: S.agent })).status, 401);
  assert.ok((await call('/auth/login', { body: { phone: '09122222222', password: rs.data.temp_password } })).data.token);
  const art = await call('/admin/articles', { token: S.admin, body: { title: 'مقاله‌ی آزمایشی من', category: 'اخبار', body: '## تیتر\nمتن کافی برای آزمایش مقاله‌ی جدید در مجله‌ی دال که از سی نویسه بیشتر است.' } }); assert.ok(art.data.slug);
  assert.strictEqual((await call('/articles/' + art.data.slug)).data.article.title, 'مقاله‌ی آزمایشی من');
  assert.strictEqual((await call('/admin/articles/' + art.data.id, { method: 'DELETE', token: S.admin })).status, 200);
  assert.strictEqual((await call('/admin/users/' + S.userId, { method: 'PUT', token: S.admin, body: { banned: true } })).status, 200);
  assert.strictEqual((await call('/me', { token: S.user })).status, 401); assert.strictEqual((await call('/auth/login', { body: { phone: '09121111111', password: 'Another123' } })).status, 403);
  assert.strictEqual((await call('/me', { method: 'DELETE', token: S.admin, body: { password: 'Admin12345' } })).status, 400, 'آخرین مدیر');
});

test('حذف حساب', async () => {
  assert.strictEqual((await call('/me', { method: 'DELETE', token: S.user2, body: { password: 'bad' } })).status, 400);
  assert.strictEqual((await call('/me', { method: 'DELETE', token: S.user2, body: { password: 'Buyer12345' } })).status, 200);
  assert.strictEqual((await call('/auth/login', { body: { phone: '09123333333', password: 'Buyer12345' } })).status, 401);
});

test('پروکسی کاشی‌ها: کش دیسکی، سرو بدون بالادست و رد مختصات نامعتبر', async () => {
  const root = base.replace(/\/api$/, '');
  const r1 = await fetch(root + '/tiles/light/5/16/12.png'); assert.strictEqual(r1.status, 200); assert.strictEqual(r1.headers.get('content-type'), 'image/png');
  assert.strictEqual(Buffer.from(await r1.arrayBuffer()).length, PNG_BUF.length);
  const hits = tileHits; assert.ok(hits >= 1);
  const r2 = await fetch(root + '/tiles/light/5/16/12.png'); assert.strictEqual(r2.status, 200); assert.strictEqual(tileHits, hits, 'بار دوم باید از کش بیاید');
  tileSrv.close(); await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual((await fetch(root + '/tiles/light/5/16/12.png')).status, 200, 'بدون بالادست از کش');
  assert.strictEqual((await fetch(root + '/tiles/light/5/16/13.png')).status, 404, 'کاشی کش‌نشده و بالادست قطع');
  assert.strictEqual((await fetch(root + '/tiles/light/3/99/1.png')).status, 404, 'x خارج از محدوده');
  assert.strictEqual((await fetch(root + '/tiles/light/30/1/1.png')).status, 404, 'z نامعتبر');
  assert.strictEqual((await fetch(root + '/tiles/evil/1/1/1.png')).status, 404);
});

test('هشدار مدیر به بله (API سازگار با تلگرام)', async () => {
  const nu = await call('/auth/register', { body: { name: 'کاربر عادی', phone: '09124444444', password: 'Normal12345', role: 'user' } }); S.plain = nu.data.token; assert.ok(S.plain);
  assert.strictEqual((await call('/admin/notify/test', { token: S.plain, body: {} })).status, 403);
  const r = await call('/admin/notify/test', { token: S.admin, body: {} });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.data.ok, true); assert.strictEqual(r.data.results.bale.ok, true);
  const c = botCalls.find((x) => x.url.startsWith('/bot111:TESTTOKEN/sendMessage')); assert.ok(c, 'درخواست به بله رسید');
  assert.strictEqual(JSON.parse(c.body).chat_id, '555');
  const site = await call('/admin/site', { token: S.admin }); assert.strictEqual(site.data.bale.configured, true); assert.ok(!JSON.stringify(site.data).includes('TESTTOKEN'), 'توکن نباید فاش شود');
});

test('پشتیبان محلی و عیب‌یابی اتصال', async () => {
  assert.strictEqual((await call('/admin/backup', { method: 'POST', token: S.plain, body: {} })).status, 403);
  const b = await call('/admin/backup', { method: 'POST', token: S.admin, body: {} }); assert.strictEqual(b.status, 200);
  assert.ok(fs.readdirSync(path.join(dir, 'backups')).some((f) => /^dal-\d{4}-\d{2}-\d{2}\.db$/.test(f)), 'فایل پشتیبان ساخته شد');
  const d = await call('/admin/diagnostics', { token: S.admin }); assert.strictEqual(d.status, 200);
  assert.ok(Array.isArray(d.data.checks) && d.data.checks.length === 4);
});

test('فشرده‌سازی بروتلی فایل‌های ایستا', async () => {
  const r = await fetch(base.replace(/\/api$/, '') + '/js/core.js', { headers: { 'accept-encoding': 'br' } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.headers.get('content-encoding'), 'br');
});

test('دفترچه‌ی دال: کمدها، توکن، ثبت‌ها و پیشنهاد هوشمند', async () => {
  const reg = async (name, phone) => {
    const r = await call('/admin/users', { token: S.admin, body: { name, phone } }); assert.strictEqual(r.status, 200);
    const l = await call('/auth/login', { body: { phone, password: r.data.temp_password } }); return { token: l.data.token, user: l.data.user || { id: r.data.id } };
  };
  const a = await reg('عضو یک', '09125550001'), b = await reg('عضو دو', '09125550002'), c = await reg('بیرونی', '09125550003');
  // بدون کمد: دسترسی به کمد اصلی ندارد
  const l0 = await call('/book', { token: a.token }); assert.strictEqual(l0.data.cabinets.length, 0); assert.strictEqual(l0.data.holder, false);
  assert.strictEqual((await call('/admin/book', { token: a.token, body: { user_id: a.user.id } })).status, 403);
  const ca = await call('/admin/book', { token: S.admin, body: { user_id: a.user.id, title: 'کمد آزمایشی ۱' } }); assert.strictEqual(ca.status, 200);
  assert.strictEqual((await call('/admin/book', { token: S.admin, body: { user_id: a.user.id } })).status, 409, 'هر نفر یک کمد');
  const cb = await call('/admin/book', { token: S.admin, body: { user_id: b.user.id } }); assert.strictEqual(cb.status, 200);
  const la = await call('/book', { token: a.token }); assert.strictEqual(la.data.holder, true);
  assert.strictEqual(la.data.cabinets.length, 2, 'کمد اصلی + کمد شخصی'); assert.strictEqual(la.data.cabinets[0].kind, 'main');
  const mine = la.data.cabinets.find((x) => x.kind === 'personal'); const main = la.data.cabinets[0];
  assert.ok(/^DK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(mine.token), 'توکن'); assert.strictEqual(main.token, null, 'توکن کمد اصلی پنهان');
  // کمد دیگران بسته است
  assert.strictEqual((await call('/book/' + cb.data.cabinet.id, { token: a.token })).status, 404);
  assert.strictEqual((await call('/book/' + mine.id, { token: c.token })).status, 404);
  // ثبت خواهان و مالک
  const seekBody = { kind: 'seeker', name: 'آقای خریدار', phone: '۰۹۱۲۱۱۱۲۲۲۲', deal: 'sale', ptype: 'apartment', city: 'kangan', price_max: 5e9, rooms: 2, area: 80 };
  assert.strictEqual((await call(`/book/${mine.id}/entries`, { token: c.token, body: seekBody })).status, 404);
  assert.strictEqual((await call(`/book/${mine.id}/entries`, { token: a.token, body: { ...seekBody, phone: '123' } })).status, 400);
  const s1 = await call(`/book/${mine.id}/entries`, { token: a.token, body: seekBody }); assert.strictEqual(s1.status, 200); assert.strictEqual(s1.data.entry.phone, '09121112222');
  const dup = await call(`/book/${mine.id}/entries`, { token: a.token, body: seekBody }); assert.strictEqual(dup.status, 409); assert.strictEqual(dup.data.existing, s1.data.id);
  const o1 = await call(`/book/${main.id}/entries`, { token: b.token, body: { kind: 'owner', name: 'خانم مالک', phone: '09123334444', deal: 'sale', ptype: 'apartment', city: 'kangan', area: 90, rooms: 2, price: 4.5e9 } });
  assert.strictEqual(o1.status, 200);
  const o2 = await call(`/book/${main.id}/entries`, { token: b.token, body: { kind: 'owner', name: 'مالک گران', phone: '09123335555', deal: 'sale', ptype: 'apartment', city: 'kangan', area: 90, rooms: 2, price: 9e9 } });
  // پیشنهاد برای خواهان: مالک مناسب در کمد اصلی (کاربر الف عضو کمد اصلی است)
  const m = await call(`/book/entries/${s1.data.id}/matches`, { token: a.token }); assert.strictEqual(m.status, 200);
  const top = m.data.items.find((x) => x.type === 'entry' && x.id === o1.data.id); assert.ok(top, 'مالک مناسب پیشنهاد شود'); assert.ok(top.score >= 85, 'امتیاز بالا: ' + top.score); assert.ok(top.reasons.length >= 3); assert.ok(top.message.includes('آقای خریدار'));
  const far = m.data.items.find((x) => x.id === o2.data.id); assert.ok(!far || far.score < top.score, 'مالک گران امتیاز کمتر');
  // برعکس: برای مالک، خواهان مناسب
  const m2 = await call(`/book/entries/${o1.data.id}/matches`, { token: b.token });
  assert.strictEqual(m2.status, 200); assert.ok(!m2.data.items.some((x) => x.id === s1.data.id), 'کاربر ب به کمد الف دسترسی ندارد و خواهان او را نمی‌بیند');
  // توکن: ج با توکن کمد الف عضو می‌شود
  assert.strictEqual((await call('/book/redeem', { token: c.token, body: { token: 'DK-XXXX-XXXX-XXXX' } })).status, 404);
  assert.strictEqual((await call('/book/redeem', { token: c.token, body: { token: mine.token } })).status, 200);
  const lc = await call('/book', { token: c.token }); assert.strictEqual(lc.data.cabinets.length, 1); assert.strictEqual(lc.data.cabinets[0].token, null, 'عضو میهمان توکن را نمی‌بیند');
  assert.strictEqual((await call('/book/' + main.id, { token: c.token })).status, 404, 'میهمان به کمد اصلی دسترسی ندارد');
  const det = await call('/book/' + mine.id, { token: a.token }); assert.strictEqual(det.data.members.length, 1); assert.strictEqual(det.data.entries.length, 1);
  assert.strictEqual((await call(`/book/${mine.id}/members/${c.user.id}`, { method: 'DELETE', token: a.token })).status, 200);
  assert.strictEqual((await call('/book/' + mine.id, { token: c.token })).status, 404);
  // پیگیری و حذف
  const t = await call(`/book/entries/${s1.data.id}/touch`, { token: a.token, body: { note: 'تماس گرفتم', next_follow: '2020-01-01' } }); assert.strictEqual(t.data.entry.due, true);
  assert.ok((await call('/book/' + mine.id, { token: a.token })).data.insights.due.length >= 1);
  assert.strictEqual((await call('/book/entries/' + o1.data.id, { method: 'DELETE', token: a.token })).status, 403, 'حذف ثبت دیگری در کمد اصلی');
  assert.strictEqual((await call('/book/entries/' + o1.data.id, { method: 'DELETE', token: b.token })).status, 200);
  // تحلیل جمله
  const p = await call('/book/parse', { token: a.token, body: { text: 'خواهان آپارتمان ۲ خوابه در کنگان تا ۵ میلیارد ۰۹۱۲۳۴۵۶۷۸۹' } });
  assert.strictEqual(p.data.fields.city, 'kangan'); assert.strictEqual(p.data.fields.rooms, 2); assert.strictEqual(p.data.fields.price_max, 5e9); assert.strictEqual(p.data.fields.phone, '09123456789');
  // حذف کمد توسط مدیر؛ کمد اصلی حذف نمی‌شود
  assert.strictEqual((await call('/admin/book/' + main.id, { method: 'DELETE', token: S.admin })).status, 400);
  assert.strictEqual((await call('/admin/book/' + mine.id, { method: 'DELETE', token: S.admin })).status, 200);
});

test('معاملات و درآمد: کمیسیون، قیف، گزارش و بستن پرونده', async () => {
  const reg = async (name, phone, role) => {
    const r = await call('/admin/users', { token: S.admin, body: { name, phone, role } }); assert.strictEqual(r.status, 200);
    const l = await call('/auth/login', { body: { phone, password: r.data.temp_password } }); return { token: l.data.token, id: r.data.id };
  };
  const ag = await reg('مشاور معاملات', '09125550101', 'agent'), plain = await reg('کاربر ساده', '09125550102', 'user');
  assert.strictEqual((await call('/deals', { token: plain.token })).status, 403, 'کاربر عادی پرونده‌ی معامله ندارد');
  assert.strictEqual((await call('/deals')).status, 401);
  // پیشنهاد کمیسیون
  const sg = await call('/deals/suggest?kind=sale&price=5000000000', { token: ag.token }); assert.strictEqual(sg.data.per_side, 25000000); assert.strictEqual(sg.data.total, 50000000);
  const sr = await call('/deals/suggest?kind=rent&price=300000000&rent=5000000', { token: ag.token }); assert.strictEqual(sr.data.base, 14000000); assert.strictEqual(sr.data.per_side, 7000000);
  // خالی شروع می‌شود، اعداد ساختگی ندارد
  const e0 = await call('/deals', { token: ag.token }); assert.strictEqual(e0.data.items.length, 0); assert.strictEqual(e0.data.report.earned, 0); assert.strictEqual(e0.data.report.conversion, null);
  assert.strictEqual((await call('/deals', { token: ag.token, body: { title: 'x' } })).status, 400);
  const d1 = await call('/deals', { token: ag.token, body: { kind: 'sale', title: 'آپارتمان ۹۵ متری کنگان', city: 'kangan', price: 4e9, client_name: 'خریدار', client_phone: '09121234567' } });
  assert.strictEqual(d1.status, 200); assert.strictEqual(d1.data.deal.commission, 40000000, 'کمیسیون خودکار'); assert.strictEqual(d1.data.deal.stage, 'lead');
  const d2 = await call('/deals', { token: ag.token, body: { kind: 'rent', title: 'واحد اجاره‌ای شیراز', city: 'shiraz', price: 2e8, rent: 4e6, stage: 'visit' } }); assert.strictEqual(d2.status, 200);
  const st = await call(`/deals/${d1.data.id}/stage`, { token: ag.token, body: { stage: 'closed' } }); assert.strictEqual(st.status, 200); assert.ok(st.data.deal.closed_at);
  assert.strictEqual((await call(`/deals/${d1.data.id}/stage`, { token: ag.token, body: { stage: 'bogus' } })).status, 400);
  const pu = await call(`/deals/${d1.data.id}`, { method: 'PUT', token: ag.token, body: { received: 15000000 } }); assert.strictEqual(pu.status, 200); assert.strictEqual(pu.data.deal.owing, 25000000);
  const lost = await call('/deals', { token: ag.token, body: { title: 'پرونده‌ی ازدست‌رفته', stage: 'lost', city: 'kangan' } }); assert.strictEqual(lost.status, 200);
  const rp = (await call('/deals', { token: ag.token })).data.report;
  assert.strictEqual(rp.closed, 1); assert.strictEqual(rp.lost, 1); assert.strictEqual(rp.open, 1); assert.strictEqual(rp.earned, 40000000); assert.strictEqual(rp.received, 15000000); assert.strictEqual(rp.receivable, 25000000);
  assert.strictEqual(rp.conversion, 50); assert.strictEqual(rp.months.length, 6); assert.strictEqual(rp.thisMonth, 40000000); assert.strictEqual(rp.byCity[0].city, 'kangan');
  // پرونده‌ی دیگران
  const other = await reg('مشاور دوم', '09125550103', 'agent');
  assert.strictEqual((await call(`/deals/${d1.data.id}`, { method: 'PUT', token: other.token, body: { title: 'هک' } })).status, 403);
  assert.strictEqual((await call('/deals', { token: other.token })).data.items.length, 0);
  assert.strictEqual((await call('/deals?scope=all', { token: other.token })).data.items.length, 0, 'غیرمدیر scope=all نمی‌گیرد');
  assert.strictEqual((await call('/deals?scope=all', { token: S.admin })).data.items.length, 3, 'مدیر همه را می‌بیند');
  assert.strictEqual((await call('/deals/config', { method: 'PUT', token: ag.token, body: { sale_pct: 1 } })).status, 403);
  assert.strictEqual((await call('/deals/config', { method: 'PUT', token: S.admin, body: { sale_pct: 1 } })).data.commission.sale_pct, 1);
  assert.strictEqual((await call('/deals/suggest?kind=sale&price=1000000000', { token: ag.token })).data.per_side, 10000000);
  assert.strictEqual((await call(`/deals/${d2.data.id}`, { method: 'DELETE', token: ag.token })).status, 200);
});

test('ویژه‌سازی آگهی: پلن، درخواست، تأیید مدیر و انقضا', async () => {
  const pl0 = await call('/promo/plans'); assert.strictEqual(pl0.data.enabled, false); assert.strictEqual(pl0.data.plans.length, 0);
  const r = await call('/admin/users', { token: S.admin, body: { name: 'فروشنده‌ی ویژه', phone: '09125550201', role: 'agent' } });
  const lg = await call('/auth/login', { body: { phone: '09125550201', password: r.data.temp_password } }); const T = lg.token || lg.data.token;
  await call('/admin/users/' + r.data.id, { method: 'PUT', token: S.admin, body: { verified: true } });
  const li = await call('/listings', { token: T, body: listingBody({ city: 'kangan', district: 'kuzeh-gari' }) });
  assert.strictEqual(li.status, 200, JSON.stringify(li.data).slice(0, 200));
  const lid = li.data.id; assert.ok(lid);
  assert.strictEqual((await call('/promo/request', { token: T, body: { listing_id: lid, plan_id: 'p1', ref: '1234' } })).status, 400, 'پلنی تعریف نشده');
  assert.strictEqual((await call('/admin/promo', { method: 'PUT', token: T, body: {} })).status, 403);
  const cfg = await call('/admin/promo', { method: 'PUT', token: S.admin, body: { plans: [{ title: 'ویژه ۷ روزه', days: 7, price: 500000 }, { title: 'بدون قیمت', days: 3, price: 0 }], pay: { card: '6037-9900-0000-0000', holder: 'نام صاحب کارت' } } });
  assert.strictEqual(cfg.status, 200); assert.strictEqual(cfg.data.config.plans.length, 1, 'پلن بدون قیمت حذف می‌شود');
  const pl = await call('/promo/plans'); assert.strictEqual(pl.data.enabled, true); assert.strictEqual(pl.data.plans[0].id, 'p1'); assert.ok(pl.data.pay.card);
  assert.strictEqual((await call('/promo/request', { token: T, body: { listing_id: lid, plan_id: 'p1', ref: '' } })).status, 400, 'شماره‌ی پیگیری لازم است');
  const rq = await call('/promo/request', { token: T, body: { listing_id: lid, plan_id: 'p1', ref: 'پیگیری ۱۲۳۴۵' } }); assert.strictEqual(rq.status, 200);
  assert.strictEqual((await call('/promo/request', { token: T, body: { listing_id: lid, plan_id: 'p1', ref: '99999' } })).status, 409, 'درخواست تکراری');
  const adm = await call('/admin/promo', { token: S.admin }); assert.strictEqual(adm.data.items[0].status, 'pending'); assert.strictEqual(adm.data.revenue.total, 0);
  const before = await call('/listings/' + lid); assert.strictEqual(before.data.listing.featured, false);
  assert.strictEqual((await call('/admin/promo/requests/' + rq.data.id, { method: 'PUT', token: T, body: { status: 'approved' } })).status, 403);
  assert.strictEqual((await call('/admin/promo/requests/' + rq.data.id, { method: 'PUT', token: S.admin, body: { status: 'approved' } })).status, 200);
  assert.strictEqual((await call('/admin/promo/requests/' + rq.data.id, { method: 'PUT', token: S.admin, body: { status: 'approved' } })).status, 400, 'فقط یک‌بار');
  const after = await call('/listings/' + lid); assert.strictEqual(after.data.listing.featured, true);
  assert.strictEqual((await call('/admin/promo', { token: S.admin })).data.revenue.total, 500000);
  assert.strictEqual((await call('/listings?featured=1')).data.items.some((x) => x.id === lid), true);
  const mine = await call('/promo/mine', { token: T }); assert.strictEqual(mine.data.items[0].status, 'approved');
});

test('سرنخ عمومی: ثبت خودکار در کمد اصلی و شمارش مناسب‌ها', async () => {
  const bad = await call('/lead', { body: { kind: 'owner', name: 'الف', phone: '1' } }); assert.strictEqual(bad.status, 400);
  const own = await call('/lead', { body: { kind: 'owner', name: 'مالک سایت', phone: '09127770001', deal: 'sale', ptype: 'apartment', city: 'kangan', area: 100, rooms: 2, price: 3e9, note: 'فوری' } });
  assert.strictEqual(own.status, 200, JSON.stringify(own.data)); assert.ok(own.data.city, 'نام شهر در پاسخ');
  const seeker = await call('/lead', { body: { kind: 'seeker', name: 'خواهان سایت', phone: '09127770002', deal: 'sale', ptype: 'apartment', city: 'kangan', rooms: 2, price_max: 4e9 } });
  assert.strictEqual(seeker.status, 200); assert.ok(seeker.data.interested.entries >= 1, 'مالک ثبت‌شده‌ی قبلی باید پیدا شود');
  const own2 = await call('/lead', { body: { kind: 'owner', name: 'مالک دیگر', phone: '09127770003', deal: 'sale', ptype: 'apartment', city: 'kangan', area: 90, rooms: 2, price: 3.5e9 } });
  assert.ok(own2.data.interested >= 1, 'خواهان ثبت‌شده باید شمرده شود');
  const again = await call('/lead', { body: { kind: 'owner', name: 'مالک سایت', phone: '09127770001', deal: 'sale', ptype: 'apartment', city: 'kangan', price: 3e9, note: 'بار دوم' } }); assert.strictEqual(again.data.existing, true);
  const main = (await call('/book', { token: S.admin })).data.cabinets.find((c) => c.kind === 'main');
  const room = await call('/book/' + main.id, { token: S.admin });
  const e = room.data.entries.filter((x) => x.phone === '09127770001'); assert.strictEqual(e.length, 1, 'بدون تکرار'); assert.ok(e[0].tags.includes('از سایت')); assert.ok(e[0].note.includes('بار دوم'));
  assert.strictEqual(room.data.entries.filter((x) => x.phone.startsWith('0912777')).length, 3);
  const hub = await call('/city/kangan'); assert.strictEqual(hub.status, 200); assert.strictEqual(hub.data.city.focus, true); assert.ok(hub.data.districts.length > 20);
  assert.strictEqual((await call('/city/narnia')).status, 404);
});

test('کارت ویزیت دیجیتال: پیش‌فرض خاموش، vCard، حریم خصوصی شماره', async () => {
  const r = await call('/admin/users', { token: S.admin, body: { name: 'مشاور کارتی', phone: '09125550301', role: 'agent' } });
  const lg = await call('/auth/login', { body: { phone: '09125550301', password: r.data.temp_password } }); const T = lg.data.token; const id = r.data.id;
  assert.strictEqual((await call('/card/' + id)).status, 404, 'تا مشاور روشن نکند عمومی نیست');
  assert.strictEqual((await call('/me/card', { method: 'PUT', body: { on: true } })).status, 401);
  const on = await call('/me/card', { method: 'PUT', token: T, body: { on: true, phone: false, tagline: 'مشاور کنگان و شیراز' } }); assert.strictEqual(on.data.cfg.on, true);
  const c = await call('/card/' + id); assert.strictEqual(c.status, 200); assert.strictEqual(c.data.phone, null, 'شماره بدون رضایت نمایش داده نمی‌شود');
  assert.ok(!JSON.stringify(c.data).includes('09125550301'));
  const v1 = await call(`/card/${id}/vcard`); assert.strictEqual(v1.status, 200); assert.ok(v1.data.startsWith('BEGIN:VCARD')); assert.ok(!v1.data.includes('9125550301'), 'vCard هم شماره را فاش نمی‌کند');
  await call('/me/card', { method: 'PUT', token: T, body: { on: true, phone: true } });
  assert.strictEqual((await call('/card/' + id)).data.phone, '09125550301');
  assert.ok((await call(`/card/${id}/vcard`)).data.includes('+989125550301'));
  const html = await fetch(base.replace(/\/api$/, '') + '/c/' + id).then((x) => x.text()); assert.ok(html.includes('og:title') && html.includes('مشاور کارتی'));
  await call('/me/card', { method: 'PUT', token: T, body: { on: false } }); assert.strictEqual((await call('/card/' + id)).status, 404);
});

test('یادآور پیگیری، تقویم گوشی (ICS) و گزارش هفتگی', async () => {
  const mk = async (name, phone, role = 'user') => { const r = await call('/admin/users', { token: S.admin, body: { name, phone, role } }); const l = await call('/auth/login', { body: { phone, password: r.data.temp_password } }); return { id: r.data.id, token: l.data.token }; };
  const u = await mk('دارنده‌ی کمد یادآور', '09125550401');
  const cab = await call('/admin/book', { token: S.admin, body: { user_id: u.id, title: 'کمد یادآور' } }); assert.strictEqual(cab.status, 200);
  const e = await call(`/book/${cab.data.cabinet.id}/entries`, { token: u.token, body: { kind: 'seeker', name: 'مشتری پیگیری', phone: '09121239999', deal: 'sale', city: 'kangan', next_follow: '2020-01-01' } }); assert.strictEqual(e.status, 200);
  const rem = await call('/me/reminders', { token: u.token }); assert.ok(rem.data.today.some((x) => x.name === 'مشتری پیگیری'), 'پیگیری عقب‌افتاده در امروز');
  assert.strictEqual((await call('/admin/reminders/run', { method: 'POST', token: u.token, body: {} })).status, 403);
  const run = await call('/admin/reminders/run', { method: 'POST', token: S.admin, body: {} }); assert.strictEqual(run.status, 200); assert.ok(run.data.items >= 1);
  const ns = await call('/notifications', { token: u.token }); assert.ok(ns.data.items.some((n) => n.title.includes('پیگیری') && n.body.includes('مشتری پیگیری')), 'اعلان درون‌برنامه');
  // تقویم
  const cal = await call('/me/calendar', { token: u.token }); assert.ok(/^\/api\/cal\/\d+-[a-f0-9]{32}\.ics$/.test(cal.data.path));
  const ics = await fetch(base.replace(/\/api$/, '') + cal.data.path); assert.strictEqual(ics.status, 200); assert.ok((ics.headers.get('content-type') || '').includes('text/calendar'));
  const txt = await ics.text(); assert.ok(txt.startsWith('BEGIN:VCALENDAR') && txt.includes('END:VCALENDAR') && txt.includes('\r\n')); assert.ok(txt.includes('BEGIN:VALARM'));
  assert.strictEqual((await fetch(base.replace(/\/api$/, '') + cal.data.path.replace(/.{6}\.ics$/, '000000.ics'))).status, 404, 'کلید اشتباه');
  const nk = await call('/me/calendar/reset', { token: u.token, body: {} }); assert.notStrictEqual(nk.data.path, cal.data.path);
  assert.strictEqual((await fetch(base.replace(/\/api$/, '') + cal.data.path)).status, 404, 'کلید قدیمی باطل شد');
  // گزارش هفتگی
  assert.strictEqual((await call('/admin/report/weekly', { token: u.token })).status, 403);
  const wk = await call('/admin/report/weekly', { token: S.admin }); assert.strictEqual(wk.status, 200); assert.ok(wk.data.text.includes('گزارش هفتگی دال')); assert.ok(wk.data.text.includes('کنگان') && wk.data.text.includes('شیراز'));
  assert.ok(wk.data.data.due.entries >= 1);
  const sd = await call('/admin/report/weekly/send', { method: 'POST', token: S.admin, body: {} }); assert.strictEqual(sd.status, 200);
  const an = await call('/notifications', { token: S.admin }); assert.ok(an.data.items.some((n) => n.title.includes('گزارش هفتگی')));
});

test('QR: ماتریس معتبر با الگوی یابنده و خطای متن بلند', () => {
  const { qrMatrix, qrSvg } = require('../../public/js/qr.js');
  const m = qrMatrix('https://dal.example.ir/c/1');
  assert.ok(m.length >= 21 && (m.length - 17) % 4 === 0);
  for (const [r, c] of [[0, 0], [0, m.length - 7], [m.length - 7, 0]]) {
    assert.ok(m[r][c] && m[r + 6][c + 6] && m[r][c + 6] && m[r + 6][c]);
    assert.ok(!m[r + 1][c + 1] && m[r + 2][c + 2] && m[r + 3][c + 3]);
  }
  assert.match(qrSvg('x', { size: 200 }), /^<svg/);
  assert.throws(() => qrMatrix('x'.repeat(400)));
});
