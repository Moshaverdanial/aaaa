'use strict';
const { q } = require('./db');
const { hashPassword } = require('./util');
const { CITIES, FEATURES, DOC_TYPES, DIRECTIONS, FLOORINGS, RENT_RATE_MONTHLY } = require('./meta');
const { rng } = require('./art');
const { ageFactor, ptypeFactor, sizeFactor } = require('./valuation');
const ARTICLES = require('./articles');

const r = rng('dal-seed-1405');
const pick = (a) => a[Math.floor(r() * a.length)];
const between = (a, b) => a + r() * (b - a);
const wpick = (pairs) => { let t = r() * pairs.reduce((s, p) => s + p[1], 0); for (const [v, w] of pairs) { if ((t -= w) <= 0) return v; } return pairs[0][0]; };
const ts = (d) => new Date(d).toISOString().replace('T', ' ').slice(0, 19);
const daysAgo = (n) => ts(Date.now() - n * 864e5 - r() * 864e5);

const FIRST_M = ['علی', 'محمد', 'امیر', 'رضا', 'حسین', 'مهدی', 'سینا', 'پویا', 'کیان', 'بهنام', 'آرش', 'سعید', 'مجید', 'فرهاد', 'نیما'];
const FIRST_F = ['سارا', 'مریم', 'نرگس', 'الهام', 'مینا', 'زهرا', 'فاطمه', 'نیلوفر', 'هستی', 'پریسا', 'سحر', 'شیدا', 'مهسا', 'ترانه', 'یاسمن'];
const LAST = ['احمدی', 'رضایی', 'محمدی', 'کریمی', 'حسینی', 'موسوی', 'صالحی', 'نوری', 'جعفری', 'مرادی', 'کاظمی', 'قاسمی', 'طاهری', 'زارعی', 'فرهادی', 'اکبری', 'سلیمانی', 'باقری', 'رحیمی', 'نجفی'];
const AGENCIES = ['املاک آرمان', 'گروه املاک پارسیان', 'املاک سپهر', 'مشاورین املاک آوا', 'املاک ملک‌آرا', 'املاک نگین', 'مشاور املاک کیان', 'املاک ایرانیان', 'املاک شمال‌شهر', 'املاک آسمان'];

function seed({ force = false } = {}) {
  const has = q.get('SELECT COUNT(*) AS n FROM users').n;
  if (has && !force) return false;
  if (force) {
    for (const t of ['view_log', 'market_trend', 'reports', 'requests', 'articles', 'notifications', 'reviews', 'appointments', 'messages', 'threads', 'inquiries', 'saved_searches', 'favorites', 'price_history', 'listings', 'users'])
      q.run(`DELETE FROM ${t}`);
    q.run(`DELETE FROM sqlite_sequence`);
  }
  q.tx(() => {
    // ---- کاربران ----
    const addUser = (name, phone, pw, role, extra = {}) => q.run(
      `INSERT INTO users (name,phone,email,password_hash,role,agency,bio,city,license_no,experience,specialties,hue,verified) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      name, phone, extra.email || null, hashPassword(pw), role, extra.agency || null, extra.bio || null, extra.city || null, extra.license || null,
      extra.exp || 0, JSON.stringify(extra.spec || []), extra.hue ?? Math.floor(r() * 360), extra.verified ? 1 : 0).lastInsertRowid;

    const adminId = addUser('مدیر دال', '09120000000', 'admin1234', 'admin', { verified: 1, email: 'admin@dal.ir' });
    const agentIds = [];
    for (let i = 0; i < 10; i++) {
      const female = i % 3 === 1;
      const city = i < 6 ? 'tehran' : pick(['karaj', 'mashhad', 'isfahan', 'shiraz']);
      const id = addUser(`${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`, i === 0 ? '09121111111' : `0912${String(1000000 + i * 7919).slice(0, 7)}`, 'agent1234', 'agent', {
        agency: AGENCIES[i], city, license: `${1402 + (i % 3)}/${4000 + i * 37}`, exp: 3 + Math.floor(r() * 18), verified: i < 8,
        spec: [pick(['آپارتمان لوکس', 'مسکونی', 'پیش‌فروش', 'تجاری و اداری', 'زمین و باغ', 'ویلا', 'رهن و اجاره']), pick(['سرمایه‌گذاری', 'املاک نوساز', 'بازسازی', 'املاک شمال تهران'])],
        bio: `${i % 2 ? 'مشاور' : 'کارشناس'} املاک با تجربه در حوزه‌ی ${CITIES.find((c) => c.slug === city).name}. تعهد من شفافیت، سرعت و رضایت شماست.`,
        email: `agent${i + 1}@dal.ir`,
      });
      agentIds.push(id);
    }
    const userIds = [];
    for (let i = 0; i < 16; i++) {
      const female = i % 2;
      userIds.push(addUser(`${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`, i === 0 ? '09122222222' : `0935${String(2000000 + i * 15731).slice(0, 7)}`, 'user1234', 'user'));
    }

    // ---- روند بازار ----
    const now = new Date();
    for (const c of CITIES) for (const d of c.districts) {
      const drift = between(0.008, 0.026); let p = d.ppm * 1e6; const arr = [];
      for (let m = 0; m < 25; m++) { arr.unshift(p); p = p / (1 + drift + between(-0.012, 0.014)); }
      arr.forEach((v, idx) => {
        const dt = new Date(now.getFullYear(), now.getMonth() - (24 - idx), 1);
        q.run('INSERT INTO market_trend (city,district,month,ppm) VALUES (?,?,?,?)', c.slug, d.slug, `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`, v);
      });
    }

    // ---- آگهی‌ها ----
    const distList = [];
    for (const c of CITIES) for (const d of c.districts) distList.push([{ c, d }, c.slug === 'tehran' ? 3.4 : 1]);
    const TITLES = {
      apartment: ['آپارتمان {a} متری {adj} در {d}', 'واحد {r} خوابه {adj} در {d}', 'آپارتمان {adj} {a} متر، {d}'],
      penthouse: ['پنت‌هاوس دوبلکس {a} متری در {d}', 'پنت‌هاوس لوکس با تراس بزرگ در {d}'],
      villa: ['ویلا {a} متری {adj} در {d}', 'خانه‌ی ویلایی با حیاط‌ در {d}'],
      land: ['زمین {a} متری مسکونی در {d}', 'کلنگی {a} متر در {d}'],
      office: ['دفتر کار {a} متری در {d}', 'واحد اداری {adj} در {d}'],
      shop: ['مغازه‌ی {a} متری پاسازی در {d}', 'تجاری بر خیابان اصلی در {d}'],
      garden: ['باغ {a} متری با ویو عالی در {d}', 'باغچه‌ی ویلایی در {d}'],
    };
    const ADJ = ['نوساز', 'لوکس', 'مدرن', 'تمیز', 'آفتاب‌گیر', 'دوبلکس', 'بازسازی‌شده', 'ویوی ابدی', 'شیک', 'کم‌واحد', 'اشرافی'];
    const DESC = [
      'این ملک در موقعیتی عالی با دسترسی سریع به مترو، مراکز خرید و مدارس قرار دارد. نورگیر، کم‌واحد و با نمای مدرن؛ تمام ملزومات زندگی در چند قدمی شماست.',
      'ساختمان با مصالح درجه‌یک و سازنده‌ی معتبر ساخته شده است. کابینت‌ها و کمدها اروپایی، کف‌پوش مرغوب و سیستم گرمایش و سرمایش کاملاً مدرن.',
      'واحد به‌صورت مرتب و تمیز نگهداری شده و آماده‌ی سکونت است. همسایه‌های آرام و محیطی امن برای خانواده؛ مجوزهای لازم و استعلام‌های ثبتی موجود است.',
      'پلان بسیار کاربردی و بدون پرتی، پذیرایی بزرگ و اتاق‌خواب‌های جدا. دسترسی عالی به بزرگراه، پارک و فضای سبز. فرصت ویژه برای سرمایه‌گذاری و سکونت.',
    ];
    const FEAT_BY_TIER = (tier) => FEATURES.filter((f) => r() < ([0.35, 0.5, 0.65][tier] * ({ parking: 1.5, elevator: 1.5, storage: 1.4, balcony: 1.2, pool: 0.4, sauna: 0.35, gym: 0.4, smart: 0.3, solar: 0.12, cinema: 0.15, partyhall: 0.25, generator: 0.2, furnished: 0.15, pets: 0.25 }[f.k] ?? 0.6))).map((f) => f.k);

    const N = 420;
    const insL = (o) => q.run(`INSERT INTO listings (code,owner_id,title,description,deal,ptype,price,rent,negotiable,area,rooms,baths,year_built,floor,floors_total,units_per_floor,parking,storage,elevator,doc_type,direction,flooring,city,district,address,lat,lng,features,images,status,featured,verified,exchange,views,created_at,updated_at) VALUES (@code,@owner_id,@title,@description,@deal,@ptype,@price,@rent,@negotiable,@area,@rooms,@baths,@year_built,@floor,@floors_total,@units_per_floor,@parking,@storage,@elevator,@doc_type,@direction,@flooring,@city,@district,@address,@lat,@lng,@features,@images,@status,@featured,@verified,@exchange,@views,@created_at,@created_at)`, o).lastInsertRowid;

    for (let i = 0; i < N; i++) {
      const { c, d } = wpick(distList);
      const deal = wpick([['sale', 56], ['rent', 34], ['presale', 7], ['swap', 3]]);
      let ptype = wpick([['apartment', 64], ['penthouse', 4], ['villa', 10], ['land', 6], ['office', 7], ['shop', 7], ['garden', 2]]);
      if (deal === 'rent' && (ptype === 'land' || ptype === 'garden')) ptype = 'apartment';
      if (deal === 'presale' && !['apartment', 'penthouse', 'office', 'shop'].includes(ptype)) ptype = 'apartment';
      const area = Math.round({ apartment: between(48, 210), penthouse: between(160, 380), villa: between(220, 650), land: between(200, 1200), office: between(35, 240), shop: between(14, 120), garden: between(600, 3500) }[ptype] / (d.ppm > 200 && ptype === 'apartment' ? 0.85 : 1));
      const rooms = ['land', 'garden', 'shop'].includes(ptype) ? 0 : ptype === 'office' ? Math.max(1, Math.round(area / 55)) : Math.min(5, Math.max(1, Math.round(area / 55)));
      const year = ['land', 'garden'].includes(ptype) ? null : deal === 'presale' ? 1406 : Math.floor(between(1375, 1405));
      const floorsTotal = ptype === 'apartment' || ptype === 'office' || ptype === 'penthouse' ? Math.floor(between(3, 12)) : null;
      const floor = floorsTotal ? (ptype === 'penthouse' ? floorsTotal : Math.floor(between(0, floorsTotal + 1))) : null;
      const tier = d.ppm > 200 ? 2 : d.ppm > 90 ? 1 : 0;
      const features = ['land', 'garden'].includes(ptype) ? [] : FEAT_BY_TIER(tier);
      const fp = (k) => (features.includes(k) ? 1 : 0);
      const marketPpm = d.ppm * 1e6 * ptypeFactor(ptype) * ageFactor(year) * sizeFactor(area) * (1 + features.length * 0.006) * between(0.88, 1.18);
      let price = Math.round((marketPpm * area) / 5e6) * 5e6, rent = 0;
      if (deal === 'presale') price = Math.round(price * 0.92 / 5e6) * 5e6;
      if (deal === 'rent') {
        const v0 = price * 0.22; const dep = Math.round(v0 * between(0.35, 1) / 5e6) * 5e6;
        price = Math.max(dep, 50e6); rent = Math.max(0, Math.round((v0 - dep) * RENT_RATE_MONTHLY / 5e5) * 5e5);
      }
      const hue = Math.floor(between(0, 360)); const owner = r() < 0.82 ? pick(agentIds) : pick(userIds);
      const code = `D${100200 + i * 7}`;
      const title = pick(TITLES[ptype]).replace('{a}', area).replace('{r}', rooms || 1).replace('{adj}', pick(ADJ)).replace('{d}', d.name);
      const ex = (k) => `/art/${code}/${k}.svg?t=${ptype}&h=${hue}&r=${rooms}&a=${area}`;
      const imgs = [ex('ext')];
      if (!['land', 'garden'].includes(ptype)) imgs.push(ex('living'), ex('kitchen'));
      if (rooms > 0 && ptype !== 'office') imgs.push(ex('bedroom'));
      if (['apartment', 'villa', 'penthouse'].includes(ptype)) imgs.push(ex('bath'), ex('plan'));
      const status = i < 8 ? 'pending' : i < 30 ? pick(['sold', 'rented']) : 'active';
      const finalStatus = status === 'sold' && deal !== 'sale' ? 'rented' : status === 'rented' && deal === 'sale' ? 'sold' : status;
      const created = daysAgo(Math.floor(between(0, 95)));
      const id = insL({
        code, owner_id: owner, title, description: `${pick(DESC)}\n\n${pick(DESC)}`, deal, ptype, price, rent, negotiable: r() < 0.5 ? 1 : 0, area, rooms,
        baths: ['land', 'garden'].includes(ptype) ? 0 : Math.max(1, Math.min(4, Math.ceil(rooms * 0.8))), year_built: year, floor, floors_total: floorsTotal,
        units_per_floor: floorsTotal ? Math.floor(between(1, 5)) : null, parking: fp('parking'), storage: fp('storage'), elevator: fp('elevator'),
        doc_type: pick(DOC_TYPES.slice(0, 3)), direction: pick(DIRECTIONS), flooring: pick(FLOORINGS), city: c.slug, district: d.slug,
        address: `${c.name}، ${d.name}، خیابان ${pick(['اصلی', 'گلستان', 'شهید بهشتی', 'ولیعصر', 'نسترن', 'پاسداران', 'بوستان', 'آزادی', 'فجر', 'کوثر'])}، کوچه‌ی ${pick(['اول', 'دوم', 'سوم', 'شقایق', 'مهر', 'نیلوفر', 'سرو'])}`,
        lat: d.lat + between(-0.007, 0.007), lng: d.lng + between(-0.009, 0.009), features: JSON.stringify(features), images: JSON.stringify(imgs),
        status: finalStatus, featured: r() < 0.1 ? 1 : 0, verified: r() < 0.62 ? 1 : 0, exchange: deal === 'sale' && r() < 0.08 ? 1 : 0,
        views: Math.floor(between(20, 2400)), created_at: created,
      });
      if (r() < 0.35 && deal !== 'rent') {
        q.run('INSERT INTO price_history (listing_id,price,at) VALUES (?,?,?)', id, Math.round(price * between(1.06, 1.14) / 5e6) * 5e6, ts(new Date(created).getTime() - 20 * 864e5));
        q.run('INSERT INTO price_history (listing_id,price,at) VALUES (?,?,?)', id, price, created);
      } else q.run('INSERT INTO price_history (listing_id,price,rent,at) VALUES (?,?,?,?)', id, price, rent, created);
      // لاگ بازدید ۳۰ روز اخیر
      for (let k = 0; k < 14; k++) q.run('INSERT OR IGNORE INTO view_log (listing_id,day,n) VALUES (?,?,?)', id, ts(Date.now() - k * 864e5).slice(0, 10), Math.floor(between(0, 30)));
    }

    // ---- نظرات مشاوران ----
    const COMMENTS = ['بسیار حرفه‌ای و دقیق بود، ممنونم.', 'در پیدا کردن خانه‌ی مناسب خیلی کمک کرد.', 'پاسخگویی سریع و رفتار محترمانه.', 'قیمت‌گذاری واقع‌بینانه و صادقانه.', 'معامله‌ای بدون دغدغه‌ی حقوقی داشتیم.', 'کمی دیر جواب می‌داد اما در نهایت نتیجه گرفتیم.', 'پیشنهاد می‌کنم حتماً با ایشان کار کنید.'];
    for (const a of agentIds) {
      const shuffled = [...userIds].sort(() => r() - 0.5).slice(0, 3 + Math.floor(r() * 6));
      for (const u of shuffled) q.run('INSERT INTO reviews (agent_id,user_id,rating,comment,created_at) VALUES (?,?,?,?,?)', a, u, wpick([[5, 6], [4, 3], [3, 1]]), pick(COMMENTS), daysAgo(between(1, 200)));
    }

    // ---- مقالات ----
    ARTICLES.forEach((a, i) => q.run('INSERT INTO articles (slug,title,excerpt,body,category,hue,read_min,views,created_at) VALUES (?,?,?,?,?,?,?,?,?)', a.slug, a.title, a.excerpt, a.body, a.category, a.hue, a.read_min, Math.floor(between(300, 5000)), daysAgo(i * 6 + 1)));

    // ---- درخواست‌های ملک ----
    const REQ = [
      ['به‌دنبال آپارتمان ۲ خوابه در سعادت‌آباد', 'sale', 'apartment', 'tehran', 'saadat-abad', 15e9, 0, 90, 2],
      ['نیازمند رهن و اجاره‌ی آپارتمان در ونک', 'rent', 'apartment', 'tehran', 'vanak', 2e9, 40e6, 70, 2],
      ['خریدار ویلا در کرج', 'sale', 'villa', 'karaj', null, 20e9, 0, 250, 3],
      ['دفتر کار کوچک در جردن', 'rent', 'office', 'tehran', 'jordan', 1.5e9, 60e6, 40, 1],
      ['زمین مسکونی در مشهد برای سرمایه‌گذاری', 'sale', 'land', 'mashhad', null, 12e9, 0, 300, 0],
    ];
    REQ.forEach((x, i) => q.run('INSERT INTO requests (user_id,title,deal,ptype,city,district,budget_max,rent_max,area_min,rooms,description,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', userIds[i], ...x, 'لطفاً مشاوران محترم با ارائه‌ی گزینه‌های مناسب تماس بگیرند.', daysAgo(i * 3 + 1)));

    // ---- داده‌ی نمایشی برای کاربر دمو ----
    const demo = 2 + 10; // id کاربر دمو (۱ ادمین + ۱۰ مشاور + اولین کاربر = ۱۲)
    const firstUser = userIds[0];
    const lst = q.all(`SELECT id, owner_id FROM listings WHERE status='active' AND owner_id IN (${agentIds.join(',')}) LIMIT 6`);
    const mine = q.all(`SELECT id, owner_id FROM listings WHERE status='active' AND owner_id=? LIMIT 3`, agentIds[0]);
    lst.unshift(mine[0]);
    lst.slice(0, 3).forEach((l) => q.run('INSERT OR IGNORE INTO favorites (user_id,listing_id) VALUES (?,?)', firstUser, l.id));
    const tom = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    q.run('INSERT INTO appointments (listing_id,user_id,agent_id,date,time,note) VALUES (?,?,?,?,?,?)', mine[0].id, firstUser, agentIds[0], tom, '17:00', 'لطفاً قبل از بازدید تماس بگیرید.');
    q.run('INSERT INTO inquiries (listing_id,user_id,name,phone,message) VALUES (?,?,?,?,?)', mine[0].id, firstUser, 'کاربر دمو', '09122222222', 'قیمت قابل مذاکره است؟');
    q.run('INSERT INTO notifications (user_id,title,body,link) VALUES (?,?,?,?)', agentIds[0], 'درخواست بازدید جدید', 'یک درخواست بازدید برای آگهی شما ثبت شد.', '#/dashboard');
    q.run('INSERT INTO threads (listing_id,buyer_id,agent_id) VALUES (?,?,?)', mine[0].id, firstUser, agentIds[0]);
    const th = q.get('SELECT id FROM threads ORDER BY id DESC LIMIT 1').id;
    q.run('INSERT INTO messages (thread_id,sender_id,body) VALUES (?,?,?)', th, firstUser, 'سلام، آیا این ملک هنوز موجود است؟ امکان بازدید این هفته هست؟');
    q.run('INSERT INTO messages (thread_id,sender_id,body) VALUES (?,?,?)', th, agentIds[0], 'سلام و وقت بخیر، بله موجود است. می‌توانید از بخش «رزرو بازدید» زمان مناسب را انتخاب کنید.');
    q.run('INSERT INTO saved_searches (user_id,name,query) VALUES (?,?,?)', firstUser, 'آپارتمان ۲ خوابه سعادت‌آباد', JSON.stringify({ deal: 'sale', ptype: 'apartment', city: 'tehran', district: 'saadat-abad', rooms: 2 }));
    q.run('INSERT INTO notifications (user_id,title,body,link) VALUES (?,?,?,?)', firstUser, 'به دال خوش آمدید 🎉', 'جستجوی هوشمند، برآورد قیمت و ابزارهای محاسبه را امتحان کنید.', '#/tools');
    q.run('INSERT INTO notifications (user_id,title,body,link) VALUES (?,?,?,?)', adminId, 'آگهی‌های جدید در انتظار بررسی', 'چند آگهی منتظر تأیید شماست.', '#/admin');
    void demo;
  });
  return true;
}

module.exports = { seed };

if (require.main === module) {
  if (!process.argv.includes('--force')) { console.log('این دستور فقط برای ساخت داده‌ی «نمایشی» است و همه‌ی داده‌های فعلی را پاک می‌کند: npm run seed:demo'); process.exit(1); }
  const done = seed({ force: process.argv.includes('--force') });
  console.log(done ? '✅ داده‌ی نمونه ساخته شد.' : 'ℹ️ دیتابیس قبلاً داده دارد (برای بازسازی از --force استفاده کنید).');
  console.log('حساب‌های دمو: مدیر 09120000000 / admin1234 — مشاور 09121111111 / agent1234 — کاربر 09122222222 / user1234');
}
