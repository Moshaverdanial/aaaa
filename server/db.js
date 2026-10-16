'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.DAL_DATA_DIR || path.join(__dirname, '..', 'data');
// تنظیمات محرمانه (مثل توکن تلگرام) از فایل data/.env خوانده می‌شوند؛ این فایل در git نیست. متغیرهای محیطی اولویت دارند.
for (const f of [path.join(DATA_DIR, '.env'), path.join(process.cwd(), '.env')]) { try { if (require('node:fs').existsSync(f)) process.loadEnvFile(f); } catch (e) { console.warn('خواندن ' + f + ' ناموفق بود: ' + e.message); } }
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const DB_FILE = process.env.DAL_DB || path.join(DATA_DIR, 'dal.db');
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',          -- user | agent | admin
  agency TEXT, bio TEXT, city TEXT, license_no TEXT,
  experience INTEGER DEFAULT 0,
  specialties TEXT DEFAULT '[]',
  hue INTEGER DEFAULT 200,
  verified INTEGER DEFAULT 0,
  banned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  deal TEXT NOT NULL,                          -- sale | rent | presale | swap
  ptype TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,            -- قیمت کل / ودیعه
  rent INTEGER NOT NULL DEFAULT 0,             -- اجاره‌ی ماهانه
  negotiable INTEGER DEFAULT 0,
  area INTEGER NOT NULL,
  rooms INTEGER DEFAULT 0,
  baths INTEGER DEFAULT 1,
  year_built INTEGER,
  floor INTEGER, floors_total INTEGER, units_per_floor INTEGER,
  parking INTEGER DEFAULT 0, storage INTEGER DEFAULT 0, elevator INTEGER DEFAULT 0,
  doc_type TEXT, direction TEXT, flooring TEXT,
  city TEXT NOT NULL, district TEXT NOT NULL, address TEXT,
  lat REAL, lng REAL,
  features TEXT DEFAULT '[]',
  images TEXT DEFAULT '[]',
  video_url TEXT,
  status TEXT DEFAULT 'pending',               -- pending | active | sold | rented | rejected | archived
  featured INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  exchange INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  reject_reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_listings_search ON listings(status, deal, city, district, ptype);
CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  price INTEGER, rent INTEGER, at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id)
);
CREATE TABLE IF NOT EXISTS saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, query TEXT NOT NULL, notify INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER, name TEXT, phone TEXT, message TEXT,
  status TEXT DEFAULT 'new',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(listing_id, buyer_id, agent_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL, read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, time TEXT NOT NULL, note TEXT,
  status TEXT DEFAULT 'pending',               -- pending | confirmed | cancelled | done
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL, comment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, user_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT, link TEXT, read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE, title TEXT NOT NULL, excerpt TEXT, body TEXT,
  category TEXT, hue INTEGER DEFAULT 210, read_min INTEGER DEFAULT 4,
  views INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, deal TEXT, ptype TEXT, city TEXT, district TEXT,
  budget_max INTEGER, rent_max INTEGER, area_min INTEGER, rooms INTEGER,
  description TEXT, status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id INTEGER, reason TEXT NOT NULL, details TEXT,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS market_trend (
  city TEXT NOT NULL, district TEXT NOT NULL, month TEXT NOT NULL, ppm REAL NOT NULL,
  PRIMARY KEY (city, district, month)
);
CREATE TABLE IF NOT EXISTS view_log (
  listing_id INTEGER NOT NULL, day TEXT NOT NULL, n INTEGER DEFAULT 0,
  PRIMARY KEY (listing_id, day)
);
`);

// ---- مهاجرت‌های سبک (افزودن ستون به پایگاه‌داده‌ی موجود) ----
function addCol(table, col, def) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addCol('users', 'recovery_hash', 'TEXT');
addCol('users', 'pwv', 'INTEGER DEFAULT 0');
addCol('listings', 'renewed_at', 'TEXT');
addCol('listings', 'featured_until', 'TEXT');
addCol('listings', 'expire_warned', 'INTEGER DEFAULT 0');
db.exec(`UPDATE listings SET renewed_at = COALESCE(updated_at, created_at) WHERE renewed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at);
CREATE INDEX IF NOT EXISTS idx_listings_district ON listings(city, district, deal, status);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT NOT NULL, contact TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);

addCol('contacts', 'city', 'TEXT');
addCol('contacts', 'kind', 'TEXT');
addCol('contacts', 'admin_note', 'TEXT');

const q = {
  all: (sql, ...p) => db.prepare(sql).all(...p),
  get: (sql, ...p) => db.prepare(sql).get(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
  tx(fn) {
    db.exec('BEGIN');
    try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
  },
};

module.exports = { db, q, DATA_DIR };
