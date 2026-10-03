'use strict';
/* راه‌اندازی اولیه: محتوای مجله، ساخت مدیر، توکن راه‌اندازی و کارهای دوره‌ای */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { q, DATA_DIR } = require('./db');
const U = require('./util');
const S = require('./services');
const ARTICLES = require('./articles');

const EXPIRE_DAYS = +process.env.DAL_EXPIRE_DAYS || 90;

function ensureArticles() {
  if (q.get(`SELECT 1 FROM settings WHERE k='articles_seeded'`) || q.get('SELECT COUNT(*) n FROM articles').n) { q.run(`INSERT OR IGNORE INTO settings (k,v) VALUES ('articles_seeded','1')`); return 0; }
  q.run(`INSERT OR IGNORE INTO settings (k,v) VALUES ('articles_seeded','1')`);
  ARTICLES.forEach((a, i) => q.run('INSERT INTO articles (slug,title,excerpt,body,category,hue,read_min,views,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    a.slug, a.title, a.excerpt, a.body, a.category, a.hue, a.read_min, 0, new Date(Date.now() - i * 5 * 864e5).toISOString().replace('T', ' ').slice(0, 19)));
  return ARTICLES.length;
}

const hasAdmin = () => !!q.get(`SELECT 1 FROM users WHERE role='admin' LIMIT 1`);

function createUser({ name, phone, password, role = 'user', verified = 0, agency = null, license_no = null, city = null, email = null }) {
  const recovery = U.makeRecoveryCode();
  const id = q.run(`INSERT INTO users (name,phone,email,password_hash,role,agency,license_no,city,hue,verified,recovery_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    name, phone, email, U.hashPassword(password), role, agency, license_no, city, Math.floor(Math.random() * 360), verified ? 1 : 0, U.hashPassword(U.normCode(recovery))).lastInsertRowid;
  return { id, recovery };
}

// مدیر از متغیرهای محیطی (برای داکر/استقرار خودکار)
function ensureAdminFromEnv() {
  const phone = U.normPhone(process.env.DAL_ADMIN_PHONE || ''), pw = process.env.DAL_ADMIN_PASSWORD || '';
  if (!phone || !pw || hasAdmin()) return null;
  if (!U.validPhone(phone) || !U.validPassword(pw)) { console.warn('⚠️  DAL_ADMIN_PHONE / DAL_ADMIN_PASSWORD نامعتبر است (رمز حداقل ۸ نویسه با حرف و عدد).'); return null; }
  const existing = q.get('SELECT id FROM users WHERE phone=?', phone);
  if (existing) { q.run(`UPDATE users SET role='admin', verified=1 WHERE id=?`, existing.id); return existing.id; }
  const r = createUser({ name: process.env.DAL_ADMIN_NAME || 'مدیر دال', phone, password: pw, role: 'admin', verified: 1 });
  console.log(`✅ حساب مدیر ساخته شد. کد بازیابی: ${r.recovery} (آن را در جای امن نگه دارید)`);
  return r.id;
}

// توکن یک‌بارمصرف راه‌اندازی تا وقتی مدیری وجود ندارد
const TOKEN_FILE = path.join(DATA_DIR, '.setup-token');
function setupToken() {
  if (hasAdmin()) { try { fs.unlinkSync(TOKEN_FILE); } catch { /* none */ } return null; }
  if (fs.existsSync(TOKEN_FILE)) return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  const t = crypto.randomBytes(9).toString('hex'); fs.writeFileSync(TOKEN_FILE, t, { mode: 0o600 }); return t;
}
function checkSetupToken(t) {
  const real = setupToken(); if (!real || !t) return false;
  const a = Buffer.from(String(t)), b = Buffer.from(real);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// بایگانی خودکار آگهی‌های منقضی + یادآوری ۱۰ روز مانده به انقضا
function expireJob() {
  const days = (n) => `datetime('now','-${n} day')`;
  const warn = q.all(`SELECT id, owner_id, title FROM listings WHERE status='active' AND expire_warned=0 AND renewed_at < ${days(EXPIRE_DAYS - 10)}`);
  for (const l of warn) { S.notify(l.owner_id, 'آگهی شما رو به انقضاست ⏳', `«${l.title}» تا ۱۰ روز دیگر بایگانی می‌شود. برای تمدید وارد «آگهی‌های من» شوید.`, '#/dashboard/listings'); q.run('UPDATE listings SET expire_warned=1 WHERE id=?', l.id); }
  const exp = q.all(`SELECT id, owner_id, title FROM listings WHERE status='active' AND renewed_at < ${days(EXPIRE_DAYS)}`);
  for (const l of exp) { q.run(`UPDATE listings SET status='archived' WHERE id=?`, l.id); S.notify(l.owner_id, 'آگهی بایگانی شد', `«${l.title}» منقضی شد. می‌توانید آن را تمدید کنید.`, '#/dashboard/listings'); }
  return { warned: warn.length, expired: exp.length };
}

function start() {
  // مقاله‌های آموزشی آماده فقط با DAL_SEED_ARTICLES=1 اضافه می‌شوند؛ پیش‌فرض: مجله خالی است تا خودتان محتوا بنویسید.
  const n = /^(1|true|yes)$/i.test(process.env.DAL_SEED_ARTICLES || '') ? ensureArticles() : 0; if (n) console.log(`📰 ${n} مقاله‌ی آموزشی مجله افزوده شد.`);
  ensureAdminFromEnv();
  const t = setupToken();
  if (t) {
    const port = +process.env.PORT || 3000;
    console.log('\n🔑 هنوز مدیری ساخته نشده است. برای ساخت حساب مدیر یکی از این دو راه را بروید:');
    console.log(`   ۱) مرورگر:  http://localhost:${port}/#/setup   (کد راه‌اندازی: ${t})`);
    console.log('   ۲) ترمینال: npm run admin -- 09123456789 "نام مدیر"\n');
  }
  expireJob(); setInterval(expireJob, 6 * 3600e3).unref();
  require('./tiles').startPrune();
  const X = require('./extern'); setTimeout(() => X.dailyBackup(), 30e3).unref(); setInterval(() => X.dailyBackup(), 6 * 3600e3).unref();
}

module.exports = { start, createUser, hasAdmin, checkSetupToken, setupToken, expireJob, EXPIRE_DAYS, ensureArticles };
