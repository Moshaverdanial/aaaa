'use strict';
// پروکسی کاشی‌های نقشه با کش دیسکی.
// چرا؟ مرورگر کاربر فقط با دامنه‌ی خود دال حرف می‌زند (نه با سرورهای نقشه‌ی خارجی که ممکن است در ایران کند یا مسدود باشند)،
// و کاشی‌های دیده‌شده روی دیسک می‌مانند؛ حتی اگر سرور نقشه قطع شود، مناطق دیده‌شده (کنگان و شیراز) نمایش داده می‌شوند.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { DATA_DIR } = require('./db');

const DIR = path.join(DATA_DIR, 'tiles');
const MAX_BYTES = (+process.env.DAL_TILE_CACHE_MB || 400) * 1024 * 1024;
const FRESH_MS = 30 * 24 * 3600e3;
const TEMPLATES = {
  light: () => process.env.DAL_TILE_LIGHT || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: () => process.env.DAL_TILE_DARK || 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
};
const upstreamUrl = (style, z, x, y) => (TEMPLATES[style] || TEMPLATES.light)().replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{s}', 'a').replace('{r}', '');

const inflight = new Map(); let active = 0; const waiters = [];
async function slot() { if (active < 6) { active++; return; } await new Promise((r) => waiters.push(r)); active++; }
function release() { active--; const n = waiters.shift(); if (n) n(); }

async function fetchTile(style, z, x, y, file) {
  await slot();
  try {
    const r = await fetch(upstreamUrl(style, z, x, y), { headers: { 'User-Agent': 'Dal-RealEstate/1.0 (self-hosted tile cache)' }, signal: AbortSignal.timeout(9000) });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 50 || buf.length > 400 * 1024) throw new Error('bad tile');
    await fsp.mkdir(path.dirname(file), { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp'; await fsp.writeFile(tmp, buf); await fsp.rename(tmp, file);
    return buf;
  } finally { release(); }
}

// بازگشت: { buf, stale } یا null
async function getTile(style, z, x, y) {
  if (!TEMPLATES[style]) style = 'light';
  const file = path.join(DIR, style, String(z), String(x), `${y}.png`);
  let st = null; try { st = await fsp.stat(file); } catch { /* miss */ }
  if (st && Date.now() - st.mtimeMs < FRESH_MS) return { buf: await fsp.readFile(file), stale: false };
  const key = `${style}/${z}/${x}/${y}`;
  let p = inflight.get(key);
  if (!p) { p = fetchTile(style, z, x, y, file).finally(() => inflight.delete(key)); inflight.set(key, p); }
  try { return { buf: await p, stale: false }; } catch {
    if (st) return { buf: await fsp.readFile(file), stale: true }; // سرور نقشه قطع است: نسخه‌ی قدیمی بهتر از هیچ
    return null;
  }
}

// پاکسازی ساعتی: اگر کش از سقف بیشتر شد قدیمی‌ترین‌ها حذف می‌شوند
async function walk(dir, out) { let es; try { es = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; } for (const e of es) { const f = path.join(dir, e.name); if (e.isDirectory()) await walk(f, out); else if (e.name.endsWith('.png')) { try { const s = await fsp.stat(f); out.push({ f, size: s.size, t: s.mtimeMs }); } catch { /* gone */ } } } }
async function stats() { const all = []; await walk(DIR, all); return { count: all.length, bytes: all.reduce((a, b) => a + b.size, 0) }; }
async function prune() {
  const all = []; await walk(DIR, all); let total = all.reduce((a, b) => a + b.size, 0);
  if (total <= MAX_BYTES) return;
  all.sort((a, b) => a.t - b.t);
  for (const e of all) { if (total <= MAX_BYTES * 0.85) break; try { await fsp.unlink(e.f); total -= e.size; } catch { /* ignore */ } }
}
function startPrune() { setInterval(() => prune().catch(() => {}), 3600e3).unref(); }

module.exports = { getTile, upstreamUrl, stats, prune, startPrune };
