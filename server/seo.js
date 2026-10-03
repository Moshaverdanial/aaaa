'use strict';
// پیش‌نمایش لینک (Open Graph) برای تلگرام/واتساپ/گوگل + نقشه‌ی سایت.
// آدرس اشتراک‌گذاری: /l/<شناسه>  → صفحه‌ای با متاتگ‌های درست که کاربر را به #/listing/<شناسه> می‌برد.
const fs = require('node:fs');
const path = require('node:path');
const { q } = require('./db');
const META = require('./meta');
const S = require('./services');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FA = '۰۱۲۳۴۵۶۷۸۹';
const fa = (n) => String(n).replace(/\d/g, (d) => FA[d]);
function money(t) {
  t = Math.round(+t || 0);
  if (t >= 1e9) { const v = Math.round((t / 1e9) * 10) / 10; return fa(v).replace('.', '٫') + ' میلیارد تومان'; }
  if (t >= 1e6) return fa(Math.round(t / 1e6)) + ' میلیون تومان';
  return fa(t.toLocaleString('en')) + ' تومان';
}

function baseUrl(req, trustProxy) {
  if (process.env.DAL_BASE_URL) return process.env.DAL_BASE_URL.replace(/\/+$/, '');
  const h = req.headers;
  const proto = (trustProxy && h['x-forwarded-proto']) || (req.socket.encrypted ? 'https' : 'http');
  const host = (trustProxy && h['x-forwarded-host']) || h.host || 'localhost';
  return `${String(proto).split(',')[0]}://${String(host).split(',')[0]}`;
}

function describe(l) {
  const city = META.findCity(l.city), d = META.findDistrict(l.city, l.district);
  const place = [d?.name, city?.name].filter(Boolean).join('، ');
  const price = l.deal === 'rent' ? `ودیعه ${money(l.price)}${l.rent ? ' · اجاره ' + money(l.rent) + ' در ماه' : ''}` : money(l.price);
  const bits = [META.DEALS[l.deal], META.PTYPES[l.ptype]?.name || META.PTYPES[l.ptype], place, l.area ? fa(l.area) + ' متر' : '', l.rooms ? fa(l.rooms) + ' خوابه' : '', price].filter(Boolean);
  return bits.join(' · ');
}

function listingPage(id, req, trustProxy) {
  const l = S.getListingRow(+id);
  const index = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const base = baseUrl(req, trustProxy);
  const target = `/#/listing/${+id}`;
  const redirect = `<script>location.replace(${JSON.stringify(target)})</script><noscript><meta http-equiv="refresh" content="0;url=${esc(target)}"></noscript>`;
  if (!l || l.status !== 'active') return index.replace('</head>', redirect + '</head>');
  const title = `${l.title} | دال`;
  const desc = describe(l);
  let img = ''; try { img = (JSON.parse(l.images || '[]') || []).find((u) => /^\/uploads\//.test(u)) || ''; } catch { /* no image */ }
  const tags = `<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(base + '/l/' + l.id)}">`
    + (img ? `<meta property="og:image" content="${esc(base + img)}"><meta name="twitter:card" content="summary_large_image">` : '')
    + `<meta name="description" content="${esc(desc)}">`;
  let out = index.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, '').replace(/<meta property="og:(title|description)"[^>]*>/g, '');
  return out.replace('</head>', tags + redirect + '</head>');
}

function sitemap(req, trustProxy) {
  const base = baseUrl(req, trustProxy);
  const rows = q.all(`SELECT id, updated_at, created_at FROM listings WHERE status='active' ORDER BY id DESC LIMIT 5000`);
  const urls = [['/', 1.0]].map(([p, pr]) => `<url><loc>${esc(base + p)}</loc><priority>${pr}</priority></url>`);
  for (const r of rows) urls.push(`<url><loc>${esc(base + '/l/' + r.id)}</loc><lastmod>${String(r.updated_at || r.created_at || '').slice(0, 10)}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
}

function robots(req, trustProxy) { return `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${baseUrl(req, trustProxy)}/sitemap.xml\n`; }

module.exports = { listingPage, sitemap, robots };
