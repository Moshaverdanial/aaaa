'use strict';
// جستجوی هوشمند: تبدیل جمله‌ی فارسی به فیلترهای جستجو
const { CITIES, PTYPES, FEATURES } = require('./meta');
const { normFa } = require('./util');

const WORDNUM = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10, بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, دویست: 200, سیصد: 300, پانصد: 500 };
function wordsToDigits(t) {
  return t.replace(/(^|\s)(یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|صد|دویست|سیصد|پانصد)(?=\s)/g, (m, a, w) => `${a}${WORDNUM[w]}`);
}
const PT_WORDS = [
  ['penthouse', /پنت\s?هاوس/], ['villa', /ویلا|خانه ویلایی|ویلایی|خانه باغ/], ['garden', /باغ|باغچه/], ['land', /زمین|کلنگی/],
  ['shop', /مغازه|تجاری|مغازه/], ['office', /دفتر|اداری|مطب/], ['apartment', /آپارتمان|اپارتمان|آپارتمانی|واحد/],
];
const FEAT_WORDS = {
  parking: /پارکینگ/, storage: /انباری/, elevator: /آسانسور/, balcony: /بالکن|تراس/, pool: /استخر/, sauna: /سونا|جکوزی/, gym: /ورزش|باشگاه/,
  smart: /هوشمند/, furnished: /مبله/, fireplace: /شومینه/, roofgarden: /روف\s?گاردن/, view: /ویو|منظره/, security: /نگهبان/, pets: /حیوان/,
  masterroom: /مستر/, heating: /گرمایش از کف/, cinema: /سینما/,
};

function parseMoney(numStr, unit) {
  const n = parseFloat(numStr.replace(/٫|,/g, '.'));
  if (!isFinite(n)) return null;
  if (/میلیارد/.test(unit)) return Math.round(n * 1e9);
  if (/میلیون/.test(unit)) return Math.round(n * 1e6);
  if (/هزار/.test(unit)) return Math.round(n * 1e3);
  return Math.round(n);
}

function smartParse(input) {
  const raw = normFa(input);
  let t = wordsToDigits(' ' + raw + ' ');
  const f = {}; const tags = [];
  const tag = (label) => tags.push(label);

  // معامله
  if (/پیش\s?فروش/.test(t)) { f.deal = 'presale'; tag('پیش‌فروش'); }
  else if (/رهن|اجاره|اجاره‌ای|رهنی|ودیعه/.test(t)) { f.deal = 'rent'; tag('رهن و اجاره'); }
  else if (/معاوضه|مشارکت/.test(t)) { f.deal = 'swap'; tag('معاوضه'); }
  else if (/خرید|فروش|بخرم|میخوام بخرم|می‌خواهم بخرم|بخریم/.test(t) || true) { f.deal = 'sale'; if (/خرید|فروش|بخر/.test(t)) tag('خرید'); }

  // نوع ملک
  for (const [k, re] of PT_WORDS) if (re.test(t)) { f.ptype = k; tag(PTYPES[k]); break; }

  // شهر / محله
  const variants = (name) => {
    const full = normFa(name); const out = new Set([full]);
    const noParen = full.replace(/\s*\(.*?\)\s*/g, ' ').trim(); out.add(noParen);
    const inParen = (full.match(/\(([^)]+)\)/) || [])[1]; if (inParen) out.add(inParen.trim());
    for (const v of [...out]) { const s = v.replace(/^(خیابان|بلوار|شهرک|محله ی|محله|بندر)\s+/, '').trim(); if (s.length >= 3) out.add(s); }
    return [...out].filter((v) => v.length >= 3);
  };
  const has = (txt, v, strict) => (strict ? new RegExp(`(^|[\\s،,.])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s،,.])`).test(txt) : txt.includes(v));
  for (const c of CITIES) {
    const vs = variants(c.name);
    if (vs.some((v) => has(t, v, v !== normFa(c.name)))) { f.city = c.slug; tag(c.name); }
    for (const d of c.districts) {
      const full = normFa(d.name);
      if (variants(d.name).some((v) => has(t, v, v !== full))) { f.city = c.slug; f.district = d.slug; const ci = tags.indexOf(c.name); if (ci >= 0) tags.splice(ci, 1); tag(d.name); }
    }
  }

  // اتاق خواب
  let m = t.match(/(\d)\s*(?:خوابه|خواب|اتاق)/);
  if (m) { f.rooms = +m[1]; tag(`${m[1]} خوابه`); }

  // متراژ
  m = t.match(/(?:بالای|حداقل|از)\s*(\d{2,4})\s*(?:متر|متری)/);
  if (m) { f.minArea = +m[1]; tag(`از ${m[1]} متر`); }
  m = t.match(/(?:زیر|حداکثر|تا)\s*(\d{2,4})\s*(?:متر|متری)/);
  if (m) { f.maxArea = +m[1]; tag(`تا ${m[1]} متر`); }
  if (!f.minArea && !f.maxArea) {
    m = t.match(/(\d{2,4})\s*(?:متر|متری)/);
    if (m) { const a = +m[1]; f.minArea = Math.round(a * 0.85); f.maxArea = Math.round(a * 1.15); tag(`حدود ${a} متر`); }
  }

  // قیمت
  const MON = '(\\d+(?:[.٫,]\\d+)?)\\s*(میلیارد|میلیون|هزار)?\\s*(?:تومان|تومن)?';
  const isRent = f.deal === 'rent';
  const rentM = t.match(new RegExp('اجاره\\s*(?:ماهی|ماهانه|ی ماهانه)?\\s*(?:زیر|تا|حداکثر)?\\s*' + MON));
  if (isRent && rentM && rentM[2]) { const v = parseMoney(rentM[1], rentM[2]); if (v) { f.maxRent = v; tag(`اجاره تا ${fmtShort(v)}`); t = t.replace(rentM[0], ' '); } }
  const between = t.match(new RegExp('بین\\s*' + MON + '\\s*(?:تا|و)\\s*' + MON));
  if (between) {
    const u1 = between[2] || between[4];
    const a = parseMoney(between[1], u1 || ''), b = parseMoney(between[3], between[4] || u1 || '');
    if (a && b && u1) { f.minPrice = Math.min(a, b); f.maxPrice = Math.max(a, b); tag(`بین ${fmtShort(f.minPrice)} و ${fmtShort(f.maxPrice)}`); t = t.replace(between[0], ' '); }
  }
  const under = t.match(new RegExp('(?:زیر|تا|حداکثر|کمتر از|نهایتا)\\s*' + MON));
  if (under && under[2] && !(under[0].includes('متر'))) {
    const v = parseMoney(under[1], under[2]);
    if (v) {
      if (isRent && !f.maxRent && /اجاره/.test(t) && !/رهن|ودیعه/.test(t)) { f.maxRent = v; tag(`اجاره تا ${fmtShort(v)}`); }
      else { f.maxPrice = v; tag(`${isRent ? 'ودیعه' : 'قیمت'} تا ${fmtShort(v)}`); }
    }
  }
  const over = t.match(new RegExp('(?:بالای|حداقل|بیشتر از)\\s*' + MON));
  if (over && over[2]) { const v = parseMoney(over[1], over[2]); if (v) { f.minPrice = v; tag(`از ${fmtShort(v)}`); } }
  if (!f.maxPrice && !f.minPrice && !f.maxRent) {
    const about = t.match(new RegExp('(?:حدود|در حدود|بودجه(?:‌?ام)?|بودجه)\\s*' + MON));
    if (about && about[2]) { const v = parseMoney(about[1], about[2]); if (v) { f.minPrice = Math.round(v * 0.75); f.maxPrice = Math.round(v * 1.1); tag(`بودجه ${fmtShort(v)}`); } }
  }

  // سن بنا
  if (/نوساز|نو ساز|تازه ساز/.test(t)) { f.minYear = 1402; tag('نوساز'); }
  m = t.match(/(?:ساخت|سال)\s*(\d{4})\s*(?:به بعد)?/);
  if (m && +m[1] > 1350 && +m[1] < 1500) { f.minYear = +m[1]; tag(`از سال ${m[1]}`); }

  // ویژگی‌ها
  const feats = [];
  for (const [k, re] of Object.entries(FEAT_WORDS)) if (re.test(t)) { feats.push(k); tag(FEATURES.find((x) => x.k === k).n); }
  if (feats.length) f.features = feats.join(',');

  if (/ارزان|اقتصادی/.test(t)) { f.sort = 'price_asc'; tag('ارزان‌ترین'); }
  else if (/لوکس|گران|اختصاصی/.test(t)) { f.sort = 'price_desc'; tag('لوکس'); }
  if (/تایید شده|معتبر|سند دار|سنددار/.test(t)) { f.verified = 1; tag('تأییدشده'); }
  if (/مبله/.test(t) && f.deal === 'rent') { /* already in features */ }

  return { filters: f, tags, understood: tags.length > 0 };
}

function fmtShort(v) {
  const fa = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  if (v >= 1e9) return fa(+(v / 1e9).toFixed(2)) + ' میلیارد';
  if (v >= 1e6) return fa(+(v / 1e6).toFixed(1)) + ' میلیون';
  return fa(v);
}

module.exports = { smartParse, fmtShort };
