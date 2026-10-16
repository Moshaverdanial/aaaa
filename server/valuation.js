'use strict';
const { q } = require('./db');
const { findDistrict, findCity, RENT_RATE_MONTHLY } = require('./meta');
const { districtBase } = require('./analytics');

const FEATURE_WEIGHT = { parking: 0.025, storage: 0.008, elevator: 0.02, pool: 0.02, sauna: 0.012, gym: 0.008, smart: 0.015, balcony: 0.012, view: 0.03, roofgarden: 0.02, lobby: 0.01, security: 0.008, masterroom: 0.012, cinema: 0.008, heating: 0.008, solar: 0.006 };

function ageFactor(year) {
  if (!year) return 1;
  const age = Math.max(0, 1405 - year);
  return Math.max(0.68, 1.06 - age * 0.012);
}
function floorFactor(floor, total, ptype) {
  if (ptype !== 'apartment' && ptype !== 'penthouse') return 1;
  if (floor == null) return 1;
  if (floor === 0) return 0.93;
  if (floor === 1) return 0.97;
  if (total && floor === total) return 1.04;
  return 1 + Math.min(floor, 8) * 0.004;
}
function ptypeFactor(p) { return { apartment: 1, penthouse: 1.28, villa: 1.35, land: 0.85, office: 1.1, shop: 1.5, garden: 0.55 }[p] ?? 1; }
function sizeFactor(area) { return area < 60 ? 1.1 : area < 90 ? 1.04 : area < 140 ? 1 : area < 220 ? 0.96 : 0.9; }

// برآورد قیمت بر اساس آگهی‌های مشابه و قیمت پایه‌ی محله
function valuate(inp) {
  const { city, district, ptype = 'apartment', area, rooms, year_built, floor, floors_total, features = [], exclude = 0 } = inp;
  const d = findDistrict(city, district);
  if (!d) return null;
  const featBoost = 1 + features.reduce((s, k) => s + (FEATURE_WEIGHT[k] || 0), 0);
  const base = districtBase(city, district);
  const baseModel = base.ppm == null ? null : base.ppm * ptypeFactor(ptype) * ageFactor(year_built) * floorFactor(floor, floors_total, ptype) * sizeFactor(area) * featBoost;

  const comps = q.all(`SELECT * FROM listings WHERE status IN ('active','sold') AND deal='sale' AND city=? AND district=? AND ptype=? AND area>0 AND id<>? ORDER BY ABS(area-?) LIMIT 12`, city, district, ptype, exclude, area)
    .filter((l) => l.price > 0);
  let compPpm = null, weightSum = 0, acc = 0;
  for (const l of comps) {
    const w = 1 / (1 + Math.abs(l.area - area) / 30 + (year_built && l.year_built ? Math.abs(l.year_built - year_built) / 8 : 0));
    acc += (l.price / l.area) * w; weightSum += w;
  }
  if (weightSum) compPpm = acc / weightSum;
  // ترکیب مدل پایه و آگهی‌های مشابه
  const nW = Math.min(comps.length, 8) / 8;
  const modelPpm = baseModel;
  if (modelPpm == null && !compPpm) return null; // هیچ داده‌ای برای این محله نداریم
  const adj = compPpm ? compPpm * ageFactor(year_built) / ageFactor(comps[0]?.year_built || year_built) : null;
  const ppm = modelPpm == null ? adj : adj ? modelPpm * (1 - 0.55 * nW) + adj * (0.55 * nW) : modelPpm;
  const price = Math.round(ppm * area);
  const spread = modelPpm == null ? 0.14 : 0.1 - 0.04 * nW;
  let rentDeposit = Math.round(price * 0.22 / 1e6) * 1e6; // پیش‌فرض: ودیعه‌ی معادل ~۲۲٪ ارزش ملک
  let monthlyRent = Math.round(rentDeposit * RENT_RATE_MONTHLY / 1e5) * 1e5;
  // اگر آگهی‌ی اجاره‌ی مشابه داریم، از داده‌ی واقعی استفاده کن
  const rc = q.all(`SELECT price, rent, area FROM listings WHERE status IN ('active','rented') AND deal='rent' AND city=? AND district=? AND ptype=? AND area>0 AND rent>0`, city, district, ptype);
  let rentBasis = 'estimate';
  if (rc.length >= 3) {
    const med = (a) => { const s2 = [...a].sort((x, y) => x - y); const m = s2.length >> 1; return s2.length % 2 ? s2[m] : (s2[m - 1] + s2[m]) / 2; };
    rentDeposit = Math.round((med(rc.map((x) => x.price / x.area)) * area) / 1e6) * 1e6; monthlyRent = Math.round((med(rc.map((x) => x.rent / x.area)) * area) / 1e5) * 1e5; rentBasis = 'market';
  }
  const grossYield = price ? ((monthlyRent * 12) / price) * 100 : 0;
  const growth12 = base.growth12;
  return {
    price, low: Math.round(price * (1 - spread)), high: Math.round(price * (1 + spread)),
    ppm: Math.round(ppm), districtPpm: base.ppm, basis: modelPpm == null || comps.length >= 4 ? 'market' : comps.length ? 'blended' : 'reference', samples: comps.length,
    confidence: Math.round((modelPpm == null ? 30 : 45) + nW * 45 + (year_built ? 4 : 0) + (floor != null ? 3 : 0)),
    rentDeposit, monthlyRent, rentBasis, grossYield: +grossYield.toFixed(1), growth12,
    comps: comps.slice(0, 5).map((l) => ({ id: l.id, title: l.title, price: l.price, area: l.area, ppm: Math.round(l.price / l.area), year_built: l.year_built })),
    cityName: findCity(city).name, districtName: d.name,
  };
}

module.exports = { valuate, ageFactor, ptypeFactor, sizeFactor, floorFactor };
