'use strict';
/* ربات گفتگوی دال (بله و تلگرام)
   فقط با «توکن» ربات روشن می‌شود (چت‌آیدی لازم نیست). از روش getUpdates استفاده می‌کند؛
   یعنی نه دامنه می‌خواهد نه وب‌هوک؛ روی لپ‌تاپ هم کار می‌کند.
   امکانات: جستجوی هوشمند فارسی، آگهی‌های کنگان، تازه‌ترین‌ها، شماره‌های مشاوره، ثبت درخواست مشاوره، آدرس سایت.
   خاموش کردن: DAL_BOT=0 */
const { q } = require('./db');
const U = require('./util');
const S = require('./services');
const X = require('./extern');
const { smartParse, fmtShort } = require('./nlp');

const BTN = {
  kangan: '🏖 آگهی‌های بندر کنگان', latest: '🆕 تازه‌ترین آگهی‌ها', search: '🔎 جستجوی ملک',
  consult: '☎️ شماره‌های مشاوره', lead: '📝 درخواست مشاوره', site: '🌐 آدرس سایت',
};
const KEYBOARD = { keyboard: [[{ text: BTN.kangan }, { text: BTN.latest }], [{ text: BTN.search }, { text: BTN.consult }], [{ text: BTN.lead }, { text: BTN.site }]], resize_keyboard: true };
const EXAMPLES = ['آپارتمان ۲ خوابه در شهرک یاس کنگان زیر ۵ میلیارد', 'اجاره آپارتمان در کنگان با پارکینگ', 'زمین در سیراف'];

const base = () => (process.env.DAL_BASE_URL || '').replace(/\/+$/, '');
const fa = (s) => String(s ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
const phonesText = () => {
  const s = X.getSite();
  return `☎️ مشاوره‌ی تلفنی دال (بندر کنگان و شیراز)\n${s.phones.map((p) => '📞 ' + p).join('\n')}\n💬 واتساپ: https://wa.me/98${String(s.whatsapp).replace(/^0/, '')}`;
};

function listingText(l) {
  const price = l.deal === 'rent' ? `ودیعه ${fmtShort(l.price)} + اجاره ${fmtShort(l.rent || 0)} تومان` : `${fmtShort(l.price)} تومان`;
  const link = base() ? `\n🔗 ${base()}/#/listing/${l.id}` : '';
  return `🏠 ${l.title}\n📍 ${l.cityName}، ${l.districtName}\n💰 ${price}${l.area ? `\n📐 ${fa(l.area)} متر` : ''}${l.rooms ? ` · ${fa(l.rooms)} خواب` : ''}${link}`;
}
function listText(res, empty) {
  if (!res.items.length) return empty;
  const head = res.total > res.items.length ? `${fa(res.total)} آگهی پیدا شد؛ ${fa(res.items.length)} مورد اول:` : `${fa(res.total)} آگهی پیدا شد:`;
  return head + '\n\n' + res.items.map(listingText).join('\n\n') + (base() && res.total > res.items.length ? `\n\nهمه‌ی آگهی‌ها: ${base()}` : '');
}

// ---- حالت گفتگو برای هر چت (فقط در حافظه؛ بعد از ۱۰ دقیقه پاک می‌شود)
const state = new Map();
const setState = (id, mode) => { state.set(id, { mode, t: Date.now() }); if (state.size > 2000) state.delete(state.keys().next().value); };
const getState = (id) => { const s = state.get(id); if (s && Date.now() - s.t < 600e3) return s.mode; state.delete(id); return null; };

// پردازش یک پیام؛ خروجی: { text, keyboard? } یا null
function respond(chatId, text, from = {}) {
  const raw = String(text || '').trim(); if (!raw) return null;
  if (!U.rateLimit('bot:' + chatId, 25, 60e3)) return { text: 'کمی آرام‌تر 🙂 چند ثانیه‌ی دیگر دوباره بنویسید.' };
  const t = U.normFa ? U.normFa(raw) : raw;
  if (/^\/(start|help|menu)\b/i.test(raw) || t === 'شروع' || t === 'منو') {
    state.delete(chatId);
    return { text: `سلام ${from.first_name || ''} 👋\nبه ربات «دال» خوش آمدید؛ املاک بندر کنگان و شیراز.\n\nمی‌توانید ملک مورد نظرتان را با یک جمله بنویسید، مثلاً:\n«${EXAMPLES[0]}»\n\nیا از دکمه‌های پایین استفاده کنید.`, keyboard: true };
  }
  if (raw === BTN.consult) { state.delete(chatId); return { text: phonesText(), keyboard: true }; }
  if (raw === BTN.site) { state.delete(chatId); return { text: base() ? `🌐 ${base()}` : 'آدرس سایت هنوز توسط مدیر تنظیم نشده است. فعلاً با شماره‌های مشاوره تماس بگیرید.\n\n' + phonesText(), keyboard: true }; }
  if (raw === BTN.kangan) {
    state.delete(chatId);
    return { text: listText(S.searchListings({ city: 'kangan', limit: 5, sort: 'new' }), 'هنوز آگهی‌ای برای بندر کنگان ثبت نشده است.\nبرای مشاوره‌ی مستقیم تماس بگیرید:\n' + X.getSite().phones.join('\n')), keyboard: true };
  }
  if (raw === BTN.latest) {
    state.delete(chatId);
    return { text: listText(S.searchListings({ limit: 5, sort: 'new' }), 'هنوز آگهی‌ای ثبت نشده است.'), keyboard: true };
  }
  if (raw === BTN.search) { setState(chatId, 'search'); return { text: `🔎 ملک مورد نظرتان را با یک جمله بنویسید. مثلاً:\n${EXAMPLES.map((e) => '• ' + e).join('\n')}`, keyboard: true }; }
  if (raw === BTN.lead) { setState(chatId, 'lead'); return { text: '📝 شماره‌ی موبایل خود را بنویسید (مثلاً ۰۹۱۲…)؛ مشاور دال با شما تماس می‌گیرد.', keyboard: true }; }

  if (getState(chatId) === 'lead' || /^[\d۰-۹٠-٩\s+\-]{10,16}$/.test(raw)) {
    const phone = U.normPhone(raw);
    if (U.validPhone(phone)) {
      if (!U.rateLimit('botlead:' + chatId, 3, 3600e3)) return { text: 'درخواست شما قبلاً ثبت شده است؛ منتظر تماس مشاور باشید.', keyboard: true };
      const name = [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 60) || 'کاربر ربات';
      q.run('INSERT INTO contacts (user_id,name,contact,message,city,kind) VALUES (?,?,?,?,?,?)', null, name, phone, 'درخواست مشاوره — از طریق ربات\n—', 'kangan', 'other');
      for (const a of q.all(`SELECT id FROM users WHERE role='admin'`)) S.notify(a.id, 'درخواست مشاوره‌ی جدید (ربات)', `${name} — ${phone}`, '#/admin/contacts');
      state.delete(chatId);
      return { text: '✅ درخواست شما ثبت شد. مشاور دال به‌زودی با شما تماس می‌گیرد.', keyboard: true };
    }
    if (getState(chatId) === 'lead') return { text: 'شماره‌ی موبایل معتبر نیست. نمونه‌ی درست: ۰۹۱۲۳۴۵۶۷۸۹', keyboard: true };
  }

  // هر متن دیگر: جستجوی هوشمند
  const parsed = smartParse(raw);
  if (!parsed.understood) { return { text: `متوجه نشدم 🤔\nملک را با یک جمله بنویسید، مثلاً:\n${EXAMPLES.map((e) => '• ' + e).join('\n')}`, keyboard: true }; }
  state.delete(chatId);
  const res = S.searchListings({ ...parsed.filters, limit: 5 });
  return { text: `فهمیدم: ${parsed.tags.join('، ')}\n\n` + listText(res, 'آگهی مطابق این جمله پیدا نشد.\nمی‌توانید شرط‌ها را کمتر کنید یا برای مشاوره تماس بگیرید:\n' + X.getSite().phones.join('\n')), keyboard: true };
}

// ---------------------------------------------------------------- ارتباط با Bot API
const trimBase = (u) => String(u || '').replace(/\/+$/, '');
function confs() {
  if (/^(0|false|no|off)$/i.test(process.env.DAL_BOT || '')) return [];
  const out = [];
  const bale = process.env.DAL_BALE_TOKEN || X.getSetting('bale_token') || '';
  if (bale) out.push({ name: 'bale', label: 'بله', token: bale, base: trimBase(process.env.DAL_BALE_API || 'https://tapi.bale.ai') });
  const tg = process.env.DAL_TG_TOKEN || X.getSetting('tg_token') || '';
  if (tg) out.push({ name: 'telegram', label: 'تلگرام', token: tg, base: trimBase(process.env.DAL_TG_API || X.getSetting('tg_api') || 'https://api.telegram.org') });
  return out;
}
async function api(c, method, body, ms = 15000) {
  const r = await fetch(`${c.base}/bot${c.token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(ms) });
  let d = null; try { d = await r.json(); } catch { /* no body */ }
  if (!r.ok || !d || d.ok === false) throw Object.assign(new Error((d && d.description) || `HTTP ${r.status}`), { status: r.status });
  return d.result;
}
async function send(c, chatId, out) {
  const body = { chat_id: chatId, text: String(out.text).slice(0, 3900), disable_web_page_preview: true };
  if (out.keyboard) body.reply_markup = KEYBOARD;
  try { await api(c, 'sendMessage', body); } catch (e) { if (out.keyboard) { delete body.reply_markup; await api(c, 'sendMessage', body); } else throw e; }
}

const runners = new Map(); // name → { token, stop, status }
async function loop(c, st) {
  let wait = 3000, offset = 0;
  while (!st.stop) {
    try {
      if (!st.username) { const me = await api(c, 'getMe'); st.username = me.username || ''; st.error = ''; console.log(require('./say')(`🤖 ربات ${c.label} روشن شد: @${st.username}`, `Bot started (${c.name}): @${st.username}`)); }
      const ups = await api(c, 'getUpdates', { offset, timeout: 25, limit: 20 }, 40000);
      st.running = true; st.error = ''; wait = 3000;
      for (const u of ups) {
        offset = Math.max(offset, u.update_id + 1);
        const m = u.message; if (!m || !m.chat || m.chat.type !== 'private' || !m.text) continue;
        try { const out = respond('b' + c.name + m.chat.id, m.text, m.from || {}); if (out) { await send(c, m.chat.id, out); st.handled++; } } catch (e) { st.error = e.message; }
      }
    } catch (e) {
      st.running = false;
      if (e.status === 401 || e.status === 404) { st.error = 'توکن نامعتبر است'; wait = 60000; }
      else { st.error = e.name === 'TimeoutError' ? 'اتصال برقرار نشد (احتمالاً مسدود است)' : (e.cause && e.cause.code) || e.message; wait = Math.min(wait * 2, 60000); }
      await new Promise((r) => setTimeout(r, wait).unref());
    }
  }
}
function sync() {
  const want = confs();
  for (const [name, r] of runners) { const c = want.find((x) => x.name === name); if (!c || c.token !== r.token) { r.st.stop = true; runners.delete(name); } }
  for (const c of want) {
    if (runners.has(c.name)) continue;
    const st = { stop: false, running: false, username: '', error: '', handled: 0, label: c.label };
    runners.set(c.name, { token: c.token, st }); loop(c, st).catch(() => {});
  }
}
let timer = null;
function start() { if (timer) return; sync(); timer = setInterval(sync, +process.env.DAL_BOT_SYNC_MS || 30e3); timer.unref(); }
function stop() { if (timer) clearInterval(timer); timer = null; for (const r of runners.values()) r.st.stop = true; runners.clear(); }
function status() { return [...runners.entries()].map(([name, r]) => ({ name, label: r.st.label, running: r.st.running, username: r.st.username, error: r.st.error, handled: r.st.handled })); }

module.exports = { start, stop, status, respond, listingText, BTN };
