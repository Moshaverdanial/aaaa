'use strict';
// داده‌های پایه‌ی پلتفرم دال: شهرها، محله‌ها، ویژگی‌ها و ...
// قیمت‌ها به «تومان برای هر متر مربع» هستند (تقریبی و صرفاً برای داده‌ی نمونه).

const CITIES = [
  {
    // تمرکز ویژه‌ی دال: نام محله‌ها از فهرست رسمی شهرداری کنگان است. قیمت مرجع و مختصات محله‌ها عمداً ثبت نشده؛
    // قیمت و روند فقط از آگهی‌ها و معامله‌های واقعی دال محاسبه می‌شود.
    slug: 'kangan', name: 'بندر کنگان', lat: 27.8376, lng: 52.0643, factor: 0.4, focus: true,
    districts: [
      { slug: 'kuzeh-gari', name: 'محله‌ی کوزه‌گری' },
      { slug: 'khomeini-abad', name: 'خمینی‌آباد' },
      { slug: 'hosein-abad', name: 'حسین‌آباد' },
      { slug: 'gardan', name: 'محله‌ی گردان' },
      { slug: 'mansur-abad', name: 'منصورآباد' },
      { slug: 'barq', name: 'محله‌ی برق' },
      { slug: '17-shahrivar', name: '۱۷ شهریور' },
      { slug: 'goodeh-jonubi', name: 'گوده‌ی جنوبی' },
      { slug: 'goodeh-shomali', name: 'گوده‌ی شمالی' },
      { slug: 'shahrak-beheshti', name: 'شهرک شهید بهشتی' },
      { slug: 'shahrak-ghaem', name: 'شهرک قائم' },
      { slug: 'shahrak-isar', name: 'شهرک ایثار' },
      { slug: 'shahrak-yas', name: 'شهرک یاس' },
      { slug: 'shahrak-dardar', name: 'شهرک دردار' },
      { slug: 'shahrak-rezvan', name: 'شهرک رضوان' },
      { slug: 'shahrak-modarres-sharghi', name: 'شهرک مدرس شرقی' },
      { slug: 'shahrak-modarres-gharbi', name: 'شهرک مدرس غربی' },
      { slug: 'shahrak-salamat', name: 'شهرک سلامت' },
      { slug: 'daraei', name: 'محله‌ی دارایی' },
      { slug: 'shahrak-moalem', name: 'شهرک معلم' },
      { slug: 'shahrak-salman', name: 'شهرک سلمان' },
      { slug: 'shahrak-farhangian', name: 'شهرک فرهنگیان' },
      { slug: 'shahrak-salemi', name: 'شهرک سالمی' },
      { slug: 'shahrak-safa', name: 'شهرک صفا' },
      { slug: 'shahrak-morvarid', name: 'شهرک مروارید' },
      { slug: 'shahrak-naft-gaz', name: 'شهرک نفت و گاز' },
      { slug: 'ghadir-sharghi', name: 'غدیر شرقی' },
      { slug: 'ghadir-gharbi', name: 'غدیر غربی' },
      { slug: 'shahrak-akhtar', name: 'شهرک اختر' },
      { slug: 'shahrak-neshat', name: 'شهرک نشاط' },
      { slug: 'shahrak-shaghayegh', name: 'شهرک شقایق' },
      { slug: 'abuzar', name: 'محله‌ی ابوذر' },
      { slug: 'parishani', name: 'محله‌ی پریشانی' },
      { slug: 'mohammad-rasulollah', name: 'محله‌ی محمد رسول‌الله (ص)' },
      { slug: 'siraf', name: 'بندر سیراف (طاهری)' },
      { slug: 'bonak', name: 'بنک' },
      { slug: 'shirino', name: 'شیرینو' },
      { slug: 'other', name: 'سایر نقاط کنگان' },
    ],
  },
  {
    slug: 'tehran', name: 'تهران', lat: 35.715, lng: 51.404, factor: 1,
    districts: [
      { slug: 'zaferanieh', name: 'زعفرانیه', lat: 35.8011, lng: 51.4166, ppm: 360, walk: 78, transit: 62, safety: 92, school: 88, shop: 80, green: 82 },
      { slug: 'elahieh', name: 'الهیه', lat: 35.7954, lng: 51.4146, ppm: 390, walk: 82, transit: 66, safety: 93, school: 90, shop: 84, green: 80 },
      { slug: 'niavaran', name: 'نیاوران', lat: 35.8185, lng: 51.4687, ppm: 300, walk: 70, transit: 55, safety: 91, school: 85, shop: 72, green: 90 },
      { slug: 'velenjak', name: 'ولنجک', lat: 35.8010, lng: 51.3937, ppm: 285, walk: 66, transit: 50, safety: 92, school: 84, shop: 70, green: 93 },
      { slug: 'saadat-abad', name: 'سعادت‌آباد', lat: 35.7777, lng: 51.3695, ppm: 175, walk: 85, transit: 72, safety: 86, school: 86, shop: 92, green: 70 },
      { slug: 'vanak', name: 'ونک', lat: 35.7570, lng: 51.4090, ppm: 205, walk: 90, transit: 90, safety: 85, school: 82, shop: 93, green: 60 },
      { slug: 'shahrak-gharb', name: 'شهرک غرب', lat: 35.7680, lng: 51.3640, ppm: 150, walk: 80, transit: 68, safety: 87, school: 90, shop: 88, green: 78 },
      { slug: 'jordan', name: 'جردن', lat: 35.7660, lng: 51.4150, ppm: 220, walk: 86, transit: 78, safety: 88, school: 84, shop: 90, green: 64 },
      { slug: 'sattarkhan', name: 'ستارخان', lat: 35.7160, lng: 51.3330, ppm: 100, walk: 84, transit: 82, safety: 76, school: 74, shop: 86, green: 40 },
      { slug: 'punak', name: 'پونک', lat: 35.7600, lng: 51.3300, ppm: 95, walk: 74, transit: 70, safety: 80, school: 78, shop: 82, green: 52 },
      { slug: 'sadeghieh', name: 'صادقیه', lat: 35.7160, lng: 51.3100, ppm: 105, walk: 78, transit: 88, safety: 76, school: 72, shop: 84, green: 38 },
      { slug: 'narmak', name: 'نارمک', lat: 35.7440, lng: 51.5040, ppm: 80, walk: 76, transit: 72, safety: 78, school: 76, shop: 80, green: 45 },
      { slug: 'tehranpars', name: 'تهرانپارس', lat: 35.7360, lng: 51.5330, ppm: 75, walk: 74, transit: 66, safety: 76, school: 74, shop: 82, green: 42 },
      { slug: 'shahran', name: 'شهران', lat: 35.7390, lng: 51.2870, ppm: 62, walk: 60, transit: 55, safety: 78, school: 70, shop: 70, green: 66 },
    ],
  },
  {
    slug: 'karaj', name: 'کرج', lat: 35.8327, lng: 50.9915, factor: 0.5,
    districts: [
      { slug: 'gohardasht', name: 'گوهردشت', lat: 35.8240, lng: 50.9330, ppm: 48, walk: 66, transit: 52, safety: 74, school: 70, shop: 74, green: 60 },
      { slug: 'mehrshahr', name: 'مهرشهر', lat: 35.8180, lng: 50.9780, ppm: 40, walk: 70, transit: 58, safety: 70, school: 68, shop: 76, green: 48 },
      { slug: 'azimieh', name: 'عظیمیه', lat: 35.8340, lng: 50.9770, ppm: 45, walk: 68, transit: 60, safety: 72, school: 70, shop: 74, green: 50 },
      { slug: 'fardis', name: 'فردیس', lat: 35.7260, lng: 50.9780, ppm: 36, walk: 58, transit: 50, safety: 70, school: 64, shop: 66, green: 58 },
    ],
  },
  {
    slug: 'mashhad', name: 'مشهد', lat: 36.2972, lng: 59.6067, factor: 0.5,
    districts: [
      { slug: 'vakilabad', name: 'وکیل‌آباد', lat: 36.3130, lng: 59.5360, ppm: 50, walk: 72, transit: 68, safety: 78, school: 74, shop: 82, green: 55 },
      { slug: 'ghasemabad', name: 'قاسم‌آباد', lat: 36.3250, lng: 59.5200, ppm: 56, walk: 70, transit: 62, safety: 80, school: 76, shop: 80, green: 58 },
      { slug: 'sajjad', name: 'سجاد', lat: 36.3420, lng: 59.5150, ppm: 62, walk: 68, transit: 60, safety: 82, school: 78, shop: 78, green: 66 },
      { slug: 'imam-reza', name: 'خیابان امام‌رضا', lat: 36.2880, lng: 59.6150, ppm: 66, walk: 92, transit: 90, safety: 80, school: 70, shop: 94, green: 40 },
    ],
  },
  {
    slug: 'isfahan', name: 'اصفهان', lat: 32.6546, lng: 51.668, factor: 0.5,
    districts: [
      { slug: 'chaharbagh', name: 'چهارباغ', lat: 32.6580, lng: 51.6700, ppm: 58, walk: 90, transit: 76, safety: 82, school: 76, shop: 90, green: 66 },
      { slug: 'jolfa', name: 'جلفا', lat: 32.6350, lng: 51.6600, ppm: 62, walk: 88, transit: 70, safety: 84, school: 78, shop: 88, green: 62 },
      { slug: 'kaveh', name: 'کاوه', lat: 32.6860, lng: 51.6800, ppm: 46, walk: 70, transit: 62, safety: 76, school: 72, shop: 76, green: 50 },
      { slug: 'dardasht', name: 'دردشت', lat: 32.6720, lng: 51.7000, ppm: 52, walk: 70, transit: 60, safety: 80, school: 76, shop: 78, green: 56 },
    ],
  },
  {
    slug: 'shiraz', name: 'شیراز', lat: 29.5918, lng: 52.5837, factor: 0.5,
    districts: [
      { slug: 'ghasrodasht', name: 'قصردشت', lat: 29.6330, lng: 52.5240, ppm: 54, walk: 70, transit: 60, safety: 80, school: 76, shop: 78, green: 68 },
      { slug: 'moalemabad', name: 'معالی‌آباد', lat: 29.6130, lng: 52.5010, ppm: 66, walk: 72, transit: 60, safety: 84, school: 82, shop: 80, green: 62 },
      { slug: 'zand', name: 'خیابان زند', lat: 29.6120, lng: 52.5450, ppm: 52, walk: 88, transit: 82, safety: 78, school: 72, shop: 90, green: 46 },
      { slug: 'molla-sadra', name: 'ملاصدرا' },
      { slug: 'chamran', name: 'چمران' },
      { slug: 'eram', name: 'ارم' },
      { slug: 'goldasht', name: 'گلدشت' },
      { slug: 'golestan', name: 'شهرک گلستان' },
      { slug: 'sadra', name: 'شهرک صدرا' },
      { slug: 'hafezieh', name: 'حافظیه' },
      { slug: 'saadieh', name: 'سعدیه' },
      { slug: 'shahcheragh', name: 'شاهچراغ' },
      { slug: 'kashani', name: 'بلوار کاشانی' },
      { slug: 'farhang-shahr', name: 'فرهنگ‌شهر' },
    ],
  },
  {
    slug: 'tabriz', name: 'تبریز', lat: 38.0962, lng: 46.2738, factor: 0.5,
    districts: [
      { slug: 'valiasr', name: 'ولیعصر', lat: 38.0880, lng: 46.2570, ppm: 46, walk: 76, transit: 70, safety: 80, school: 76, shop: 82, green: 56 },
      { slug: 'elgoli', name: 'ائل‌گلی', lat: 38.0480, lng: 46.3140, ppm: 58, walk: 62, transit: 54, safety: 84, school: 70, shop: 70, green: 92 },
      { slug: 'rahahan', name: 'راه‌آهن', lat: 38.0620, lng: 46.2400, ppm: 38, walk: 68, transit: 66, safety: 72, school: 66, shop: 72, green: 44 },
    ],
  },
  {
    slug: 'rasht', name: 'رشت', lat: 37.2808, lng: 49.5832, factor: 0.5,
    districts: [
      { slug: 'golsar', name: 'گلسار', lat: 37.2880, lng: 49.6150, ppm: 46, walk: 70, transit: 58, safety: 80, school: 76, shop: 76, green: 70 },
      { slug: 'manzarieh', name: 'منظریه', lat: 37.2780, lng: 49.5900, ppm: 40, walk: 76, transit: 66, safety: 76, school: 72, shop: 82, green: 56 },
    ],
  },
  {
    slug: 'kish', name: 'کیش', lat: 26.5579, lng: 53.9807, factor: 0.5,
    districts: [
      { slug: 'sahel', name: 'ساحل مرجان', lat: 26.5360, lng: 53.9800, ppm: 78, walk: 80, transit: 40, safety: 90, school: 66, shop: 86, green: 76 },
      { slug: 'mehr', name: 'شهرک مهر', lat: 26.5560, lng: 53.9650, ppm: 55, walk: 70, transit: 36, safety: 86, school: 64, shop: 74, green: 66 },
    ],
  },
];

const PTYPES = {
  apartment: 'آپارتمان',
  villa: 'ویلا / خانه ویلایی',
  land: 'زمین / کلنگی',
  office: 'دفتر کار / اداری',
  shop: 'مغازه / تجاری',
  garden: 'باغ / باغچه',
  penthouse: 'پنت‌هاوس',
};

const DEALS = { sale: 'فروش', rent: 'رهن و اجاره', presale: 'پیش‌فروش', swap: 'معاوضه / مشارکت' };

const FEATURES = [
  { k: 'parking', n: 'پارکینگ', i: '🚗' },
  { k: 'storage', n: 'انباری', i: '📦' },
  { k: 'elevator', n: 'آسانسور', i: '🛗' },
  { k: 'balcony', n: 'بالکن / تراس', i: '🌿' },
  { k: 'pool', n: 'استخر', i: '🏊' },
  { k: 'sauna', n: 'سونا و جکوزی', i: '🧖' },
  { k: 'gym', n: 'سالن ورزش', i: '🏋️' },
  { k: 'lobby', n: 'لابی', i: '🛎️' },
  { k: 'security', n: 'نگهبانی ۲۴ ساعته', i: '🛡️' },
  { k: 'cctv', n: 'دوربین مداربسته', i: '📹' },
  { k: 'remote', n: 'درب ریموت', i: '🚪' },
  { k: 'smart', n: 'خانه هوشمند', i: '📱' },
  { k: 'solar', n: 'پنل خورشیدی', i: '☀️' },
  { k: 'furnished', n: 'مبله', i: '🛋️' },
  { k: 'fireplace', n: 'شومینه', i: '🔥' },
  { k: 'roofgarden', n: 'روف‌گاردن', i: '🌳' },
  { k: 'partyhall', n: 'سالن اجتماعات', i: '🎉' },
  { k: 'cinema', n: 'سینمای خانگی', i: '🎬' },
  { k: 'heating', n: 'گرمایش از کف', i: '♨️' },
  { k: 'chiller', n: 'چیلر / داکت‌اسپلیت', i: '❄️' },
  { k: 'view', n: 'ویو ابدی', i: '🏔️' },
  { k: 'masterroom', n: 'مستر', i: '🛏️' },
  { k: 'generator', n: 'ژنراتور برق', i: '⚡' },
  { k: 'pets', n: 'مجاز بودن حیوان خانگی', i: '🐕' },
];

const DOC_TYPES = ['سند تک‌برگ', 'سند شش‌دانگ', 'سند قولنامه‌ای', 'سند وقفی', 'در حال تفکیک', 'سند اداری'];
const DIRECTIONS = ['شمالی', 'جنوبی', 'شرقی', 'غربی', 'دو نبش'];
const FLOORINGS = ['سرامیک', 'پارکت', 'سنگ', 'لمینت', 'موزاییک'];

const CATEGORIES = ['راهنمای خرید', 'بازار ملک', 'حقوقی و قانونی', 'طراحی و دکوراسیون', 'سرمایه‌گذاری', 'اخبار'];

// نرخ تبدیل ودیعه به اجاره: هر ۱۰۰ میلیون تومان ودیعه ≈ ۲٫۵ میلیون تومان اجاره‌ی ماهانه (۳۰٪ سالانه)
const RENT_RATE_MONTHLY = 0.025;

// شهرهای «تمرکز ویژه» همیشه اول فهرست‌اند: بندر کنگان، سپس شیراز
const FOCUS = ['kangan', 'shiraz'];
CITIES.sort((a, b) => { const ia = FOCUS.indexOf(a.slug), ib = FOCUS.indexOf(b.slug); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
for (const c of CITIES) for (const d of c.districts) {
  if (d.lat == null || d.lng == null) { d.lat = c.lat; d.lng = c.lng; d.noGeo = true; }   // محله‌ی بدون مختصات دقیق: مرکز شهر
  if (d.ppm === undefined) d.ppm = null;
  if (d.walk === undefined) { d.walk = d.transit = d.safety = d.school = d.shop = d.green = null; }
}

function findCity(slug) { return CITIES.find((c) => c.slug === slug || c.name === slug); }
function findDistrict(citySlug, dslug) {
  const c = findCity(citySlug); if (!c) return null;
  return c.districts.find((d) => d.slug === dslug || d.name === dslug) || null;
}
function allDistricts() {
  const out = [];
  for (const c of CITIES) for (const d of c.districts) out.push({ ...d, city: c.slug, cityName: c.name });
  return out;
}

module.exports = { FOCUS, CITIES, PTYPES, DEALS, FEATURES, DOC_TYPES, DIRECTIONS, FLOORINGS, CATEGORIES, RENT_RATE_MONTHLY, findCity, findDistrict, allDistricts };
