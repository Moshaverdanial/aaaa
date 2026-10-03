'use strict';
// سرویس‌های رایگان بیرونی + تنظیمات سایت
//  • تلگرام (Bot API، رایگان): هشدار فوری به مدیر + پشتیبان روزانه‌ی پایگاه‌داده
//  • نشانی‌یابی OpenStreetMap Nominatim (رایگان، با کش و رعایت محدودیت ۱ درخواست در ثانیه)
//  • لینک‌های مستقیم تماس، واتساپ و تلگرام (بدون هزینه)
const fs = require('node:fs');
const path = require('node:path');
const { db, q, DATA_DIR } = require('./db');
const { FOCUS, findCity } = require('./meta');

// ---------------------------------------------------------------- تنظیمات سایت
const DEFAULT_SITE = {
  name: 'دال',
  phones: ['09206696092', '09202290930'],   // شماره‌های مشاوره
  whatsapp: '09206696092',
  telegram: '',                              // نام کاربری تلگرام بدون @ (اختیاری)
  bale: '', eitaa: '',                       // شناسه‌ی بله و ایتا (داخل ایران بدون فیلترشکن کار می‌کنند)
  instagram: '',
  email: '',
  address: '',
};
function getSetting(k) { return q.get('SELECT v FROM settings WHERE k=?', k)?.v ?? null; }
function setSetting(k, v) { q.run('INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', k, String(v)); }
const normPhone = (p) => String(p || '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
const validMobile = (p) => /^09\d{9}$/.test(p);
function getSite() {
  let s = {}; try { s = JSON.parse(getSetting('site') || '{}'); } catch { /* default */ }
  const site = { ...DEFAULT_SITE, ...s };
  site.phones = (Array.isArray(site.phones) ? site.phones : DEFAULT_SITE.phones).map(normPhone).filter(validMobile);
  if (!site.phones.length) site.phones = DEFAULT_SITE.phones;
  site.whatsapp = validMobile(normPhone(site.whatsapp)) ? normPhone(site.whatsapp) : site.phones[0];
  for (const k of ['telegram', 'bale', 'eitaa']) site[k] = String(site[k] || '').replace(/^@/, '').replace(/[^\w]/g, '').slice(0, 40);
  site.focus = FOCUS.map((slug) => { const c = findCity(slug); return c && { slug, name: c.name }; }).filter(Boolean);
  return site;
}
function saveSite(b) {
  const cur = getSite(); const next = { ...cur };
  if (b.phones !== undefined) {
    const list = (Array.isArray(b.phones) ? b.phones : String(b.phones).split(/[\n,،]+/)).map(normPhone).filter(Boolean);
    if (!list.length || !list.every(validMobile)) throw Object.assign(new Error('شماره‌ها باید موبایل ۱۱ رقمی (۰۹…) باشند.'), { status: 400 });
    next.phones = list.slice(0, 5);
  }
  for (const k of ['telegram', 'bale', 'eitaa', 'instagram', 'email', 'address']) if (b[k] !== undefined) next[k] = String(b[k]).trim().slice(0, 200);
  if (b.whatsapp !== undefined) { const w = normPhone(b.whatsapp); if (w && !validMobile(w)) throw Object.assign(new Error('شماره‌ی واتساپ معتبر نیست.'), { status: 400 }); next.whatsapp = w || next.phones[0]; }
  delete next.focus;
  setSetting('site', JSON.stringify(next));
  return getSite();
}

// ---------------------------------------------------------------- پیام‌رسان‌ها (تلگرام + بله)
// تلگرام در ایران فیلتر است؛ «بله» همان Bot API تلگرام را دارد و داخل ایران بدون فیلترشکن کار می‌کند.
// اگر سرور در ایران است از بله استفاده کنید؛ اگر بیرون از ایران است هر دو کار می‌کنند. هر دو را هم می‌شود هم‌زمان تنظیم کرد.
const trimBase = (u) => String(u || '').replace(/\/+$/, '');
function tgConf() {
  const token = process.env.DAL_TG_TOKEN || getSetting('tg_token') || '';
  const chat = process.env.DAL_TG_CHAT || getSetting('tg_chat') || '';
  // DAL_TG_API: نشانی رله (مثلاً Cloudflare Worker) برای وقتی که سرور به api.telegram.org دسترسی ندارد
  return token && chat ? { name: 'telegram', label: 'تلگرام', token, chat, base: trimBase(process.env.DAL_TG_API || getSetting('tg_api') || 'https://api.telegram.org') } : null;
}
function baleConf() {
  const token = process.env.DAL_BALE_TOKEN || getSetting('bale_token') || '';
  const chat = process.env.DAL_BALE_CHAT || getSetting('bale_chat') || '';
  return token && chat ? { name: 'bale', label: 'بله', token, chat, base: trimBase(process.env.DAL_BALE_API || 'https://tapi.bale.ai') } : null;
}
const channels = () => [tgConf(), baleConf()].filter(Boolean);
const errText = (e) => (e?.name === 'TimeoutError' ? 'زمان اتصال تمام شد (احتمالاً مسدود است)' : e?.cause?.code || e?.message || 'خطا');

async function chanSend(c, text) {
  try {
    const r = await fetch(`${c.base}/bot${c.token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ chat_id: c.chat, text: String(text).slice(0, 3900), disable_web_page_preview: true }),
    });
    if (r.ok) return { ok: true };
    let d = ''; try { d = (await r.json()).description || ''; } catch { /* no body */ }
    return { ok: false, error: `پاسخ ${r.status}${d ? ' — ' + d : ''}` };
  } catch (e) { return { ok: false, error: errText(e) }; }
}
// ارسال به همه‌ی کانال‌های تنظیم‌شده؛ هر کانال مستقل است و یک بار دوباره تلاش می‌شود
async function sendAll(text) {
  const out = {};
  await Promise.all(channels().map(async (c) => {
    let r = await chanSend(c, text);
    if (!r.ok) { await new Promise((x) => setTimeout(x, 4000)); r = await chanSend(c, text); }
    out[c.name] = r;
  }));
  return out;
}
const tgSend = sendAll; // سازگاری با نام قبلی
const alertAdmin = (text) => { if (channels().length) sendAll('🏡 دال\n' + text).catch(() => {}); };

// ---------------------------------------------------------------- پشتیبان‌گیری
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
function snapshotTo(file) { db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); }
// پشتیبان محلی روزانه (بدون نیاز به اینترنت) — ۷ نسخه‌ی آخر نگه داشته می‌شود
function localBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const f = path.join(BACKUP_DIR, `dal-${new Date().toISOString().slice(0, 10)}.db`);
  if (!fs.existsSync(f)) snapshotTo(f);
  const all = fs.readdirSync(BACKUP_DIR).filter((n) => /^dal-\d{4}-\d{2}-\d{2}\.db$/.test(n)).sort();
  for (const old of all.slice(0, -7)) { try { fs.unlinkSync(path.join(BACKUP_DIR, old)); } catch { /* ignore */ } }
  return f;
}
async function chanBackup(c, buf, name) {
  try {
    const fd = new FormData(); fd.append('chat_id', c.chat); fd.append('caption', `پشتیبان روزانه‌ی دال — ${name}`);
    fd.append('document', new Blob([buf]), name);
    const r = await fetch(`${c.base}/bot${c.token}/sendDocument`, { method: 'POST', body: fd, signal: AbortSignal.timeout(90000) });
    return { ok: r.ok, error: r.ok ? '' : 'پاسخ ' + r.status };
  } catch (e) { return { ok: false, error: errText(e) }; }
}
async function remoteBackup() {
  const cs = channels(); if (!cs.length) return {};
  const tmp = path.join(DATA_DIR, `.bk-${Date.now()}.db`);
  try {
    snapshotTo(tmp); const buf = fs.readFileSync(tmp); const name = `dal-${new Date().toISOString().slice(0, 10)}.db`;
    const out = {};
    for (const c of cs) {
      if (buf.length > 49 * 1024 * 1024) { await chanSend(c, '⚠️ پایگاه‌داده از ۵۰ مگابایت بزرگ‌تر شده و با پیام‌رسان قابل ارسال نیست؛ از پوشه‌ی data/backups پشتیبان بردارید.'); out[c.name] = { ok: false, error: 'حجم زیاد' }; continue; }
      out[c.name] = await chanBackup(c, buf, name);
    }
    return out;
  } catch (e) { return { error: { ok: false, error: e.message } }; } finally { try { fs.unlinkSync(tmp); } catch { /* ignore */ } }
}
async function dailyBackup() {
  try { localBackup(); } catch (e) { console.warn('پشتیبان محلی ناموفق بود:', e.message); }
  if (!channels().length) return;
  const today = new Date().toISOString().slice(0, 10);
  if (getSetting('last_remote_backup') === today) return;
  const r = await remoteBackup();
  if (Object.values(r).some((x) => x.ok)) setSetting('last_remote_backup', today);
}
const tgBackup = remoteBackup;

// ---------------------------------------------------------------- بررسی اتصال سرویس‌ها (برای انتخاب محل میزبانی)
async function probe(name, url, opt = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { method: opt.method || 'GET', headers: { 'User-Agent': 'Dal-RealEstate/1.0' }, signal: AbortSignal.timeout(opt.timeout || 6000) });
    return { name, ok: opt.okIf ? opt.okIf(r.status) : r.status < 500, ms: Date.now() - t0, status: r.status };
  } catch (e) { return { name, ok: false, ms: Date.now() - t0, error: errText(e) }; }
}
async function diagnostics() {
  const tg = tgConf(), bale = baleConf();
  const upstream = require('./tiles').upstreamUrl('light', 0, 0, 0);
  const [a, b, c, d] = await Promise.all([
    probe('telegram', tg ? `${tg.base}/bot${tg.token}/getMe` : 'https://api.telegram.org', tg ? { okIf: (s) => s === 200 } : { okIf: (s) => s < 500 }),
    probe('bale', bale ? `${bale.base}/bot${bale.token}/getMe` : 'https://tapi.bale.ai', bale ? { okIf: (s) => s === 200 } : { okIf: (s) => s < 500 }),
    probe('tiles', upstream, { okIf: (s) => s === 200 }),
    probe('geocoder', 'https://nominatim.openstreetmap.org/status', { okIf: (s) => s === 200 }),
  ]);
  return { checks: [a, b, c, d], configured: { telegram: !!tg, bale: !!bale } };
}

// ---------------------------------------------------------------- نشانی‌یابی (Nominatim)
const cache = new Map(); let lastCall = 0;
async function nominatim(kind, params) {
  const key = kind + JSON.stringify(params); const hit = cache.get(key);
  if (hit && Date.now() - hit.t < 24 * 3600e3) return hit.v;
  const wait = lastCall + 1100 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const u = new URL(`https://nominatim.openstreetmap.org/${kind}`);
  for (const [k, v] of Object.entries({ format: 'jsonv2', 'accept-language': 'fa', ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { 'User-Agent': 'Dal-RealEstate/1.0 (self-hosted)' }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error('geocoder ' + r.status);
  const v = await r.json(); cache.set(key, { t: Date.now(), v });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return v;
}
async function geocode(qs, citySlug) {
  const c = findCity(citySlug);
  const params = { q: `${qs}${c ? '، ' + c.name : ''}`, countrycodes: 'ir', limit: 6 };
  if (c) { const d = 0.35; params.viewbox = [c.lng - d, c.lat + d, c.lng + d, c.lat - d].join(','); }
  const rows = await nominatim('search', params);
  return rows.map((r) => ({ label: r.display_name, lat: +r.lat, lng: +r.lon }));
}
async function reverse(lat, lng) {
  const r = await nominatim('reverse', { lat: (+lat).toFixed(5), lon: (+lng).toFixed(5), zoom: 18 });
  return { label: r.display_name || '' };
}

module.exports = { getSite, saveSite, getSetting, setSetting, tgConf, baleConf, channels, sendAll, tgSend, alertAdmin, tgBackup, remoteBackup, localBackup, dailyBackup, diagnostics, geocode, reverse, normPhone, validMobile };
