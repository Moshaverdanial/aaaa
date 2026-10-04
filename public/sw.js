// Service worker دال: برای اینترنت کند و ناپایدار
//  • پوسته‌ی برنامه: شبکه‌اول (۴ ثانیه) و در صورت قطع، از حافظه
//  • کاشی‌های نقشه: حافظه‌اول (دیده‌شده‌ها بدون اینترنت هم نمایش داده می‌شوند)
//  • داده‌های عمومی (آگهی‌ها، متا، آمار): شبکه‌اول و در صورت قطع، آخرین نسخه‌ی ذخیره‌شده
const VER = 'v11';
const SHELL_CACHE = 'dal-shell-' + VER, TILE_CACHE = 'dal-tiles-' + VER, API_CACHE = 'dal-api-' + VER;
const SHELL = ['/', '/css/app.css', '/js/core.js', '/js/components.js', '/js/shell.js', '/js/app.js', '/js/page-home.js', '/js/page-search.js', '/js/page-listing.js', '/js/page-tools.js', '/js/page-market.js', '/js/page-people.js', '/js/page-consult.js', '/js/page-book.js', '/js/page-biz.js', '/js/page-team.js', '/js/qr.js', '/js/page-auth.js', '/js/page-account.js', '/js/page-new.js', '/js/page-admin.js', '/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css', '/fonts/Vazirmatn.woff2', '/icon.svg', '/img/bg-blur-day.jpg', '/img/bg-blur-night.jpg', '/manifest.webmanifest'];
const PUBLIC_API = /^\/api\/(meta|listings|stats\/home|articles|agents|analytics\/market|analytics\/trend)(\/|$|\?)/;

self.addEventListener('install', (e) => { e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  const keep = [SHELL_CACHE, TILE_CACHE, API_CACHE];
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); }); });
async function networkFirst(req, cacheName, ms, store = true) {
  const cache = await caches.open(cacheName);
  try {
    const r = await withTimeout(fetch(req), ms);
    if (store && r.ok) cache.put(req, r.clone());
    return r;
  } catch (err) {
    const hit = await cache.match(req, { ignoreVary: true }) || (req.mode === 'navigate' ? await cache.match('/') : null);
    if (hit) return hit;
    throw err;
  }
}
async function tileFirst(req) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(req); if (hit) return hit;
  const r = await fetch(req);
  if (r.ok) { cache.put(req, r.clone()); trim(cache); }
  return r;
}
let trimming = false;
async function trim(cache) { if (trimming) return; trimming = true; try { const ks = await cache.keys(); if (ks.length > 900) await Promise.all(ks.slice(0, ks.length - 700).map((k) => cache.delete(k))); } finally { trimming = false; } }

self.addEventListener('fetch', (e) => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname === '/dal.apk' || u.pathname.startsWith('/api/cal/') || u.pathname.startsWith('/c/')) return;
  if (u.pathname.startsWith('/tiles/')) return e.respondWith(tileFirst(req));
  if (u.pathname.startsWith('/api/')) {
    if (!PUBLIC_API.test(u.pathname + (u.search ? '?' : ''))) return;
    return e.respondWith(networkFirst(req, API_CACHE, 8000, !req.headers.has('Authorization')));
  }
  if (u.pathname.startsWith('/uploads/') || u.pathname.startsWith('/art/')) return e.respondWith(caches.open(API_CACHE).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
  e.respondWith(networkFirst(req, SHELL_CACHE, 4000));
});
