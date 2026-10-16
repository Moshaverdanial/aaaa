'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DATA_DIR } = require('./db');

// ---------- secret ----------
let SECRET = process.env.DAL_SECRET;
if (!SECRET) {
  const f = path.join(DATA_DIR, '.secret');
  if (fs.existsSync(f)) SECRET = fs.readFileSync(f, 'utf8');
  else { SECRET = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(f, SECRET, { mode: 0o600 }); }
}

// ---------- passwords ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return `s1$${salt.toString('hex')}$${h.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [v, s, h] = String(stored).split('$');
  if (v !== 's1') return false;
  const calc = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64);
  const real = Buffer.from(h, 'hex');
  return calc.length === real.length && crypto.timingSafeEqual(calc, real);
}

// ---------- tokens (HMAC signed, stateless) ----------
const b64 = (b) => Buffer.from(b).toString('base64url');
function signToken(payload, days = 30) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + days * 864e5 }));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const exp = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

// ---------- text helpers ----------
const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
function normDigits(s) {
  return String(s ?? '').replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/[٠-٩]/g, (d) => AR.indexOf(d));
}
function normFa(s) { // یکسان‌سازی ی/ک عربی و نیم‌فاصله
  return normDigits(s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
}
function normPhone(p) {
  let s = normDigits(p).replace(/[^\d+]/g, '');
  if (s.startsWith('+98')) s = '0' + s.slice(3);
  else if (s.startsWith('0098')) s = '0' + s.slice(4);
  else if (s.startsWith('98') && s.length === 12) s = '0' + s.slice(2);
  return s;
}
const validPhone = (p) => /^09\d{9}$/.test(p);
function clampInt(v, min, max, d = 0) {
  if (v === undefined || v === null || v === '') return d;
  const n = Math.round(Number(normDigits(v)));
  if (!Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, n));
}
function str(v, max = 500) { return String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max); }
function jparse(s, d) { try { return JSON.parse(s); } catch { return d; } }

// ---------- tiny rate limiter ----------
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, t: now };
  if (now - b.t > windowMs) { b.n = 0; b.t = now; }
  b.n++; buckets.set(key, b);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.t > windowMs) buckets.delete(k);
  return b.n <= max;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---------- recovery codes ----------
function makeRecoveryCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = crypto.randomBytes(12);
  const c = [...b].map((x) => A[x % A.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}
const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function randomPassword(n = 10) { const A = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [...crypto.randomBytes(n)].map((x) => A[x % A.length]).join(''); }
const validPassword = (p) => typeof p === 'string' && p.length >= 8 && /[A-Za-z\u0600-\u06FF]/.test(p) && /\d/.test(normDigits(p));

module.exports = { makeRecoveryCode, normCode, randomPassword, validPassword, hashPassword, verifyPassword, signToken, verifyToken, normDigits, normFa, normPhone, validPhone, clampInt, str, jparse, rateLimit, HttpError };
