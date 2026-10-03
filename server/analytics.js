'use strict';
/* تحلیل بازار بر پایه‌ی آگهی‌های واقعیِ ثبت‌شده در دال.
   - قیمت مرجع هر محله (meta.js) فقط تا زمانی استفاده می‌شود که آگهی‌ی کافی نداریم؛
     با ثبت آگهی‌های واقعی، وزن داده‌ی واقعی به‌تدریج جای آن را می‌گیرد.
   - روند ماهانه = میانه‌ی قیمت هر متر آگهی‌های فروشِ ثبت‌شده در همان ماه. */
const { q } = require('./db');
const { findCity, findDistrict } = require('./meta');

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const monthKey = (d) => String(d).slice(0, 7);
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); const t = y * 12 + (mo - 1) + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };

let cache = new Map();
function cached(key, fn, ttl = 30e3) {
  const c = cache.get(key); const now = Date.now();
  if (c && now - c.t < ttl) return c.v;
  const v = fn(); cache.set(key, { t: now, v }); if (cache.size > 300) cache.clear(); return v;
}
const invalidate = () => cache.clear();

// ردیف‌های خام: قیمت هر متر آگهی‌های فروش (فعال، فروخته‌شده، بایگانی) به‌تفکیک ماه ثبت
function saleRows(city, district) {
  return q.all(`SELECT district, substr(created_at,1,7) AS month, status, 1.0*price/area AS ppm FROM listings
    WHERE deal='sale' AND area>0 AND price>0 AND status IN ('active','sold','archived') AND city=? ${district ? 'AND district=?' : ''}`, ...(district ? [city, district] : [city]));
}

function seriesFrom(rows) {
  const by = new Map();
  for (const r of rows) { if (!by.has(r.month)) by.set(r.month, []); by.get(r.month).push(r.ppm); }
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ppm: Math.round(median(v)), n: v.length }));
}
function growth(series, back) {
  if (series.length < 2) return null;
  const last = series[series.length - 1]; const target = shiftMonth(last.month, -back);
  const base = series.find((s) => s.month === target) || series.filter((s) => s.month <= target).pop();
  if (!base || base.month === last.month) return null;
  return +((last.ppm / base.ppm - 1) * 100).toFixed(1);
}

// آمار محله‌های یک شهر
function cityDistricts(citySlug) {
  return cached('cd:' + citySlug, () => {
    const city = findCity(citySlug); if (!city) return [];
    const rows = saleRows(city.slug);
    const act = q.all(`SELECT district, COUNT(*) n, SUM(CASE WHEN deal='sale' THEN 1 ELSE 0 END) ns FROM listings WHERE status='active' AND city=? GROUP BY district`, city.slug);
    const closed = q.all(`SELECT district, COUNT(*) n FROM listings WHERE status IN ('sold','rented') AND city=? GROUP BY district`, city.slug);
    return city.districts.map((d) => {
      const dr = rows.filter((r) => r.district === d.slug);
      const series = seriesFrom(dr);
      const activeSale = dr.filter((r) => r.status === 'active').map((r) => r.ppm);
      const n = activeSale.length; const ref = d.ppm != null ? d.ppm * 1e6 : null;
      const m = n ? median(activeSale) : series.length ? series[series.length - 1].ppm : null;
      const w = m ? Math.min(0.9, (n || 1) / ((n || 1) + 6)) : 0;
      const ppm = ref == null ? (m ? Math.round(m) : null) : Math.round(m ? ref * (1 - w) + m * w : ref);
      const a = act.find((x) => x.district === d.slug), c = closed.find((x) => x.district === d.slug);
      return { slug: d.slug, name: d.name, lat: d.lat, lng: d.lng, ppm, refPpm: ref, marketPpm: m ? Math.round(m) : null, samples: n, source: ref == null ? (m ? 'market' : 'none') : n >= 6 ? 'market' : n > 0 ? 'blended' : 'reference', noGeo: !!d.noGeo,
        growth3: growth(series, 3), growth12: growth(series, 12), listings: a?.n || 0, askingPpm: n ? Math.round(median(activeSale)) : null, closed: c?.n || 0,
        scores: d.walk == null ? null : { walk: d.walk, transit: d.transit, safety: d.safety, school: d.school, shop: d.shop, green: d.green }, series };
    });
  });
}

function districtBase(city, district) {
  const d = findDistrict(city, district); if (!d) return null;
  const s = cityDistricts(city).find((x) => x.slug === district);
  return s ? { ppm: s.ppm, source: s.source, samples: s.samples, growth12: s.growth12 } : { ppm: d.ppm != null ? d.ppm * 1e6 : null, source: d.ppm != null ? 'reference' : 'none', samples: 0, growth12: null };
}

function cityTrend(citySlug) { return cached('ct:' + citySlug, () => seriesFrom(saleRows(citySlug))); }
function districtTrend(city, district) { return cached(`dt:${city}:${district}`, () => seriesFrom(saleRows(city, district))); }

module.exports = { cityDistricts, districtBase, cityTrend, districtTrend, invalidate, median };
