'use strict';
/* node dal.js doctor — بررسی کامل سلامت نصب (همه‌چیز را چک می‌کند و راه‌حل می‌گوید) */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const say = require('./say');
const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DAL_DATA_DIR || path.join(__dirname, '..', 'data');
const rows = []; let bad = 0;
const add = (ok, title, detail = '', fix = '') => { rows.push({ ok, title, detail, fix }); if (ok === false) bad++; };
const get = async (url, ms = 5000) => { const r = await fetch(url, { signal: AbortSignal.timeout(ms) }); return { status: r.status, text: await r.text() }; };

(async () => {
  // ۱) نسخه‌ی نود
  const [maj, min] = process.versions.node.split('.').map(Number);
  add(maj > 22 || (maj === 22 && min >= 13), 'Node.js ' + process.version, 'needs 22.13 or newer', 'Install the LTS version from https://nodejs.org, then open a NEW cmd window.');
  // ۲) sqlite
  let DatabaseSync = null;
  try { ({ DatabaseSync } = require('node:sqlite')); add(true, 'SQLite engine available'); } catch (e) { add(false, 'SQLite engine missing', e.message, 'Update Node.js to the latest LTS.'); }
  // ۳) پوشه‌ی داده
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true }); const t = path.join(DATA_DIR, '.doctor'); fs.writeFileSync(t, 'ok'); fs.unlinkSync(t);
    add(true, 'Data folder writable', DATA_DIR);
  } catch (e) { add(false, 'Data folder NOT writable', DATA_DIR + ' (' + e.message + ')', 'Run from a normal folder such as C:\\Dal (not Program Files, not a read-only folder).'); }
  // ۴) پایگاه‌داده
  const dbf = path.join(DATA_DIR, 'dal.db');
  if (DatabaseSync && fs.existsSync(dbf)) {
    try {
      const d = new DatabaseSync(dbf, { readOnly: true });
      const users = d.prepare('SELECT COUNT(*) n FROM users').get().n; const admins = d.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").get().n;
      const ls = d.prepare('SELECT COUNT(*) n FROM listings').get().n; d.close();
      add(true, `Database OK: ${users} users, ${admins} admin(s), ${ls} listings`);
      if (!admins) add(null, 'No admin account yet', '', 'Run:  node dal.js admin 09123456789 Admin Dal12345678   (or just start the server: the browser opens the setup form)');
    } catch (e) { add(false, 'Database unreadable', e.message, 'Restore from data\\backups or delete data\\dal.db* (this erases all data).'); }
  } else if (DatabaseSync) add(null, 'Database not created yet', '', 'It is created automatically on first start.');
  // ۵) پورت / سرور
  const free = await new Promise((res) => { const s = net.createServer(); s.once('error', (e) => res(e.code)); s.once('listening', () => s.close(() => res('free'))); s.listen(PORT, '0.0.0.0'); });
  if (free === 'free') add(null, `Port ${PORT} is free`, 'server is NOT running right now', 'Start it with:  node dal.js');
  else if (free === 'EADDRINUSE') {
    try {
      const r = await get(`http://127.0.0.1:${PORT}/api/setup/status`); const j = JSON.parse(r.text);
      add(true, `Dal is running on port ${PORT}`, j.needsSetup ? 'needs setup: open http://localhost:' + PORT + '/#/setup' : 'open http://localhost:' + PORT);
      const h = await get(`http://127.0.0.1:${PORT}/`); add(h.status === 200 && /<html/i.test(h.text), 'Home page loads', 'HTTP ' + h.status);
    } catch { add(false, `Port ${PORT} is used by ANOTHER program`, '', `Close it, or run Dal on another port:  set PORT=3001  then  node dal.js  (open http://localhost:3001)`); }
  } else add(false, 'Cannot use port ' + PORT, String(free), 'Try another port: set PORT=3001');
  // ۶) اینترنت (فقط اطلاع‌رسانی)
  for (const [name, url] of [['GitHub (updates)', 'https://github.com'], ['Bale bot API', 'https://tapi.bale.ai'], ['Telegram bot API', 'https://api.telegram.org']]) {
    try { await get(url, 6000); add(true, name + ' reachable'); } catch { add(null, name + ' NOT reachable', '', name.startsWith('Telegram') ? 'Telegram is filtered in Iran: turn the VPN on (system-wide) or use Bale.' : ''); }
  }
  // خروجی
  console.log('\nDal doctor\n' + '='.repeat(40));
  for (const r of rows) {
    console.log(`${r.ok === true ? '[ OK ]' : r.ok === false ? '[FAIL]' : '[INFO]'} ${r.title}${r.detail ? ' - ' + r.detail : ''}`);
    if (r.ok !== true && r.fix) console.log(`       -> ${r.fix}`);
  }
  console.log('='.repeat(40));
  console.log(bad ? `RESULT: ${bad} problem(s) found. Fix the [FAIL] lines above, run doctor again, or send this text to support.` : 'RESULT: ALL GOOD. No problems found.');
  void say; process.exit(bad ? 1 : 0);
})();
