/* دال — هسته‌ی برنامه: وضعیت، API، قالب‌ساز امن، فرمت‌کننده‌ها، آیکون‌ها، روتر */
'use strict';
(function () {
  const Dal = (window.Dal = { state: { user: null, meta: null }, pages: {}, routes: [], ui: {}, charts: {} });

  // ---------------------------------------------------------------- html template (auto-escape)
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const val = (v) => (v == null || v === false || v === true ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : esc(v));
  const html = (strs, ...vals) => { let o = ''; strs.forEach((s, i) => { o += s; if (i < vals.length) o += val(vals[i]); }); return new Raw(o); };
  const raw = (s) => new Raw(s);
  Dal.html = html; Dal.raw = raw; Dal.esc = esc;

  // ---------------------------------------------------------------- DOM helpers
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  Dal.$ = $; Dal.$$ = $$;
  const mount = (el, v) => { el.innerHTML = v instanceof Raw ? v.s : String(v); return el; };
  Dal.mount = mount;
  function on(root, ev, sel, fn) { root.addEventListener(ev, (e) => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); }); }
  Dal.on = on;
  const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  Dal.debounce = debounce;

  // ---------------------------------------------------------------- numbers / formatting
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const fa = (s) => String(s ?? '').replace(/\d/g, (d) => FA[d]);
  const en = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬,،\s]/g, '').replace(/٫/g, '.');
  const num = (n) => (n == null || n === '' || isNaN(n) ? '—' : fa(Math.round(Number(n)).toLocaleString('en-US').replace(/,/g, '٬')));
  const dec = (n, d = 1) => (n == null || isNaN(n) ? '—' : fa(Number(n).toFixed(d).replace(/\.0+$/, '').replace('.', '٫')));

  function priceWords(n) {
    n = Math.round(Number(n)); if (!n) return '—';
    const parts = []; let r = n;
    const units = [[1e12, 'هزار میلیارد'], [1e9, 'میلیارد'], [1e6, 'میلیون'], [1e3, 'هزار']];
    for (const [u, name] of units) { if (r >= u) { const k = Math.floor(r / u); parts.push(`${num(k)} ${name}`); r -= k * u; } }
    if (r > 0 && parts.length === 0) parts.push(num(r));
    return parts.slice(0, 3).join(' و ') + ' تومان';
  }
  function priceShort(n) {
    n = Number(n); if (!n) return '—';
    if (n >= 1e12) return dec(n / 1e12, 2) + ' هزار میلیارد';
    if (n >= 1e9) return dec(n / 1e9, n >= 1e10 ? 1 : 2) + ' میلیارد';
    if (n >= 1e6) return dec(n / 1e6, n >= 1e8 ? 0 : 1) + ' میلیون';
    return num(n);
  }
  function listingPrice(l, { short = true } = {}) {
    const f = short ? priceShort : (x) => priceWords(x).replace(' تومان', '');
    if (l.deal === 'rent') return { main: l.rent ? `${f(l.rent)} اجاره` : 'رهن کامل', sub: `ودیعه ${f(l.price)}`, unit: 'تومان' };
    if (l.deal === 'swap' && !l.price) return { main: 'توافقی', sub: 'معاوضه / مشارکت', unit: '' };
    return { main: f(l.price), sub: l.ppm ? `متری ${priceShort(l.ppm)}` : '', unit: 'تومان' };
  }
  const parseDate = (s) => { if (!s) return new Date(); return new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + (String(s).length > 10 ? 'Z' : 'T12:00:00')); };
  const jf = (opts) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts);
  const dateFa = (s, opts = { year: 'numeric', month: 'long', day: 'numeric' }) => jf(opts).format(parseDate(s));
  const timeFa = (s) => new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(parseDate(s));
  function ago(s) {
    const d = (Date.now() - parseDate(s).getTime()) / 1000;
    if (d < 60) return 'همین الان'; if (d < 3600) return `${fa(Math.floor(d / 60))} دقیقه پیش`; if (d < 86400) return `${fa(Math.floor(d / 3600))} ساعت پیش`;
    if (d < 86400 * 30) return `${fa(Math.floor(d / 86400))} روز پیش`; if (d < 86400 * 365) return `${fa(Math.floor(d / 86400 / 30))} ماه پیش`; return dateFa(s);
  }
  const monthLabel = (ym, long = false) => { const [y, m] = ym.split('-').map(Number); return jf(long ? { year: 'numeric', month: 'long' } : { month: 'short', year: '2-digit' }).format(new Date(y, m - 1, 15)); };
  const isoDate = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
  Object.assign(Dal, { fa, en, num, dec, priceWords, priceShort, listingPrice, dateFa, timeFa, ago, monthLabel, isoDate, parseDate });

  // ---------------------------------------------------------------- icons (stroke)
  const ICON = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>', user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
    bath: '<path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.7 3 4 3.7 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5H4"/><path d="M6 19v2M18 19v2"/>',
    ruler: '<path d="M21.3 15.3 8.7 2.7a1 1 0 0 0-1.4 0L2.7 7.3a1 1 0 0 0 0 1.4l12.6 12.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4z"/><path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>', compare: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>', menu: '<path d="M3 12h18M3 6h18M3 18h18"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>', checkc: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m22 4-10 10-3-3"/>', chevl: '<path d="m15 18-6-6 6-6"/>', chevr: '<path d="m9 18 6-6-6-6"/>', chevd: '<path d="m6 9 6 6 6-6"/>', chevu: '<path d="m18 15-6-6-6 6"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>', plus: '<path d="M12 5v14M5 12h14"/>', filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>', grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', map: '<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z"/><path d="M8 2v16M16 6v16"/>', trend: '<path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>', trenddown: '<path d="m23 18-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', shieldc: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>', calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>', building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>', trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', car: '<path d="M5 17h14M3 13l2-6a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 7l2 6v5a1 1 0 0 1-1 1h-2v-2H6v2H4a1 1 0 0 1-1-1z"/><circle cx="7.5" cy="14" r=".6"/><circle cx="16.5" cy="14" r=".6"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>', zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>', sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>', crosshair: '<circle cx="12" cy="12" r="10"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/>', print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>', upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>', image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>', send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>', chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>', dollar: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<path d="m10.3 3.9-8.5 14.7A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.4L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>', copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.9 17 23l-5-3-5 3 1.5-9.1"/>', globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>', target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    sofa: '<path d="M20 9V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2M2 11a2 2 0 0 1 4 0v3h12v-3a2 2 0 0 1 4 0v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM6 20v1M18 20v1"/>', dots: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>', refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    percent: '<path d="m19 5-14 14"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>', external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>', arrowl: '<path d="M19 12H5M12 19l-7-7 7-7"/>', video: '<path d="m23 7-7 5 7 5z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  };
  const icon = (n, size = 20, cls = '') => raw(`<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`);
  Dal.icon = icon;

  // ---------------------------------------------------------------- API
  const TOKEN_KEY = 'dal_token';
  Dal.token = () => localStorage.getItem(TOKEN_KEY);
  async function api(path, { method = 'GET', body, query } = {}) {
    let url = '/api' + path;
    if (query) { const p = new URLSearchParams(); for (const [k, v] of Object.entries(query)) if (v !== '' && v != null) p.set(k, v); const s = p.toString(); if (s) url += '?' + s; }
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const t = Dal.token(); if (t) headers.Authorization = 'Bearer ' + t;
    // اینترنت ناپایدار: درخواست‌های خواندنی تا ۳ بار با فاصله تکرار می‌شوند و همه‌ی درخواست‌ها مهلت دارند
    const isGet = method === 'GET', tries = isGet ? 3 : 1, limit = path.startsWith('/upload') ? 90000 : isGet ? 15000 : 30000;
    let res, lastErr;
    for (let i = 0; i < tries; i++) {
      try {
        res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(limit) });
        if (isGet && [502, 503, 504].includes(res.status) && i < tries - 1) { res = null; await new Promise((r) => setTimeout(r, 700 * (i + 1))); continue; }
        break;
      } catch (e) { lastErr = e; res = null; if (i < tries - 1) await new Promise((r) => setTimeout(r, 700 * (i + 1))); }
    }
    if (!res) throw new Error(lastErr?.name === 'TimeoutError' ? 'اتصال کند است و پاسخی نیامد. دوباره تلاش کنید.' : 'ارتباط با سرور برقرار نشد. اینترنت خود را بررسی کنید.');
    let data = {}; try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) {
      if (res.status === 401 && t) { Dal.logout(true); }
      const e = new Error(data.error || 'خطایی رخ داد.'); e.status = res.status; e.data = data; throw e;
    }
    return data;
  }
  Dal.api = api;

  // ---------------------------------------------------------------- toast / modal / confirm
  function toast(msg, type = 'info', ms = 3600) {
    const box = $('#toasts'); const el = document.createElement('div');
    el.className = 'toast ' + type; el.setAttribute('role', 'status');
    el.innerHTML = `<span class="toast-ic">${{ success: icon('checkc', 20), error: icon('alert', 20), info: icon('info', 20) }[type].s}</span><span>${esc(msg)}</span>`;
    box.appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
  }
  Dal.toast = toast;
  const guard = async (fn, btn) => {
    if (btn) { btn.disabled = true; btn.classList.add('loading'); }
    try { return await fn(); } catch (e) { toast(e.message, 'error'); return undefined; } finally { if (btn) { btn.disabled = false; btn.classList.remove('loading'); } }
  };
  Dal.guard = guard;

  let modalStack = [];
  function modal(content, { title = '', wide = false, onClose } = {}) {
    const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><button class="modal-x" aria-label="بستن">${icon('x', 20).s}</button>${title ? `<h3 class="modal-title">${esc(title)}</h3>` : ''}<div class="modal-body"></div></div>`;
    mount($('.modal-body', wrap), content);
    document.body.appendChild(wrap); document.body.classList.add('no-scroll');
    requestAnimationFrame(() => wrap.classList.add('show'));
    const close = () => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 200); modalStack = modalStack.filter((m) => m !== api2); if (!modalStack.length) document.body.classList.remove('no-scroll'); onClose && onClose(); };
    const api2 = { el: wrap, close, body: $('.modal-body', wrap) }; modalStack.push(api2);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    $('.modal-x', wrap).onclick = close;
    return api2;
  }
  Dal.modal = modal;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close(); });
  Dal.confirm = (msg, { ok = 'تأیید', danger = false } = {}) => new Promise((resolve) => {
    let done = false;
    const m = modal(html`<p class="confirm-msg">${msg}</p><div class="row end gap"><button class="btn ghost" data-c="0">انصراف</button><button class="btn ${danger ? 'danger' : 'primary'}" data-c="1">${ok}</button></div>`, { title: 'مطمئن هستید؟', onClose: () => { if (!done) resolve(false); } });
    m.body.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { done = true; resolve(b.dataset.c === '1'); m.close(); } });
  });

  // ---------------------------------------------------------------- auth
  // ---- اپ اندروید (پوسته‌ی WebView): پل window.DalAndroid
  Dal.isApp = !!window.DalAndroid;
  const bridge = (fn, ...a) => { try { return window.DalAndroid && window.DalAndroid[fn] ? window.DalAndroid[fn](...a) : undefined; } catch { return undefined; } };
  Dal.bridge = bridge;
  // دانلود فایل؛ در اپ اندروید لینک blob کار نمی‌کند، پس فایل مستقیم به اپ داده می‌شود.
  Dal.download = async (name, data, type = 'application/octet-stream') => {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    if (window.DalAndroid && window.DalAndroid.saveFile) {
      const b64 = await new Promise((res) => { const r = new FileReader(); r.onloadend = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob); });
      return bridge('saveFile', name, blob.type || type, b64);
    }
    const a = document.createElement('a'); const u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 1500);
  };
  Dal.setSession = (token, user) => { if (token) localStorage.setItem(TOKEN_KEY, token); if (Dal.isApp && Dal.token()) bridge('setToken', Dal.token()); Dal.state.user = user; Dal.ui.renderHeader && Dal.ui.renderHeader(); startPolling(); };
  Dal.logout = (silent) => { localStorage.removeItem(TOKEN_KEY); bridge('clearToken'); Dal.state.user = null; Dal.ui.renderHeader && Dal.ui.renderHeader(); stopPolling(); if (!silent) toast('از حساب خود خارج شدید.', 'info'); if (/^#\/(dashboard|messages|new|edit|admin|favorites)/.test(location.hash)) location.hash = '#/'; };
  Dal.requireLogin = (msg = 'برای ادامه وارد حساب کاربری شوید.') => {
    if (Dal.state.user) return true;
    toast(msg, 'info'); sessionStorage.setItem('dal_next', location.hash || '#/'); location.hash = '#/login'; return false;
  };
  Dal.isAgent = () => ['agent', 'admin'].includes(Dal.state.user?.role);

  let pollT = null;
  async function pollNotifs() { if (!Dal.state.user) return; try { const r = await api('/notifications'); Dal.state.notifs = r; Dal.ui.renderBell && Dal.ui.renderBell(); } catch { /* ignore */ } }
  function startPolling() { stopPolling(); pollNotifs(); pollT = setInterval(pollNotifs, 25000); }
  function stopPolling() { clearInterval(pollT); }
  Dal.pollNotifs = pollNotifs;

  // ---------------------------------------------------------------- local stores
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem('dal_' + k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem('dal_' + k, JSON.stringify(v)),
  };
  Dal.store = store;
  Dal.compare = {
    list: () => store.get('compare', []),
    has: (id) => store.get('compare', []).includes(id),
    toggle(id) {
      let l = store.get('compare', []);
      if (l.includes(id)) l = l.filter((x) => x !== id);
      else { if (l.length >= 4) { toast('حداکثر ۴ ملک را می‌توان مقایسه کرد.', 'info'); return false; } l.push(id); }
      store.set('compare', l); Dal.ui.renderHeader && Dal.ui.updateCompareBadge(); return l.includes(id);
    },
    clear() { store.set('compare', []); Dal.ui.updateCompareBadge(); },
  };
  Dal.recent = {
    add(l) { let r = store.get('recent', []).filter((x) => x.id !== l.id); r.unshift({ id: l.id, title: l.title, img: l.images[0], price: listingPrice(l), districtName: l.districtName }); store.set('recent', r.slice(0, 10)); },
    list: () => store.get('recent', []),
  };

  // ---------------------------------------------------------------- meta helpers
  Dal.city = (slug) => Dal.state.meta.cities.find((c) => c.slug === slug);
  Dal.district = (city, d) => Dal.city(city)?.districts.find((x) => x.slug === d);
  Dal.ptypeName = (k) => Dal.state.meta.ptypes[k] || k;
  Dal.dealName = (k) => Dal.state.meta.deals[k] || k;
  Dal.featName = (k) => Dal.state.meta.features.find((f) => f.k === k);
  Dal.optionList = (obj, sel, ph) => raw((ph !== undefined ? `<option value="">${esc(ph)}</option>` : '') + Object.entries(obj).map(([k, v]) => `<option value="${esc(k)}" ${String(sel) === String(k) ? 'selected' : ''}>${esc(v)}</option>`).join(''));
  Dal.cityOptions = (sel, ph) => raw((ph !== undefined ? `<option value="">${esc(ph)}</option>` : '') + Dal.state.meta.cities.map((c) => `<option value="${c.slug}" ${sel === c.slug ? 'selected' : ''}>${esc(c.name)}</option>`).join(''));
  Dal.districtOptions = (city, sel, ph) => raw((ph !== undefined ? `<option value="">${esc(ph)}</option>` : '') + (Dal.city(city)?.districts || []).map((d) => `<option value="${d.slug}" ${sel === d.slug ? 'selected' : ''}>${esc(d.name)}</option>`).join(''));

  // ---------------------------------------------------------------- router
  Dal.route = (pattern, page) => {
    const keys = []; const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    Dal.routes.push({ re, keys, page });
  };
  Dal.parseHash = () => {
    const h = location.hash.replace(/^#/, '') || '/'; const [p, qs] = h.split('?');
    return { path: p || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
  };
  Dal.go = (path, query) => { const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)).toString() : ''; location.hash = '#' + path + (qs ? '?' + qs : ''); };
  Dal.cleanup = [];
  let navSeq = 0;
  async function render() {
    const seq = ++navSeq; const { path, query } = Dal.parseHash();
    Dal.cleanup.forEach((f) => { try { f(); } catch { /* ignore */ } }); Dal.cleanup = [];
    let app = $('#app'); const fresh = app.cloneNode(false); app.replaceWith(fresh); app = fresh; // حذف شنوندگان صفحه‌ی قبل
    let found = null;
    for (const r of Dal.routes) { const m = r.re.exec(path); if (m) { found = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }; break; } }
    if (!found) found = { r: { page: Dal.pages.notFound }, params: {} };
    app.classList.remove('page-in'); app.setAttribute('aria-busy', 'true');
    document.title = 'دال | املاک آنلاین';
    try {
      const prevPath = Dal.lastPath; Dal.lastPath = path;
      await found.r.page(app, found.params, query, () => seq === navSeq);
      if (seq !== navSeq) return;
      if (prevPath !== path || !query._keep) window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (e) {
      if (seq !== navSeq) return;
      console.error(e);
      mount(app, html`<div class="container section"><div class="empty">${icon('alert', 48)}<h3>مشکلی پیش آمد</h3><p>${e.message}</p><a class="btn primary" href="#/">بازگشت به خانه</a></div></div>`);
    }
    app.removeAttribute('aria-busy'); void app.offsetWidth; app.classList.add('page-in');
    Dal.ui.highlightNav && Dal.ui.highlightNav(path);
    Dal.ui.reveal && Dal.ui.reveal(app);
  }
  Dal.setTitle = (t) => { document.title = t ? `${t} | دال` : 'دال | املاک آنلاین'; };
  window.addEventListener('hashchange', () => { if (Dal.ready) render(); });
  Dal.render = render;

  // skeleton
  Dal.skeletonCards = (n = 6) => html`<div class="grid cards">${Array.from({ length: n }, () => html`<div class="card-skel"><div class="sk sk-img"></div><div class="sk sk-line w60"></div><div class="sk sk-line"></div><div class="sk sk-line w40"></div></div>`)}</div>`;
})();
