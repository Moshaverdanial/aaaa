'use strict';
/* ابزار خط فرمان دال
   node server/cli.js admin <موبایل> "<نام>" [رمز]   ساخت/ارتقای مدیر
   node server/cli.js reset-password <موبایل> [رمز]   بازنشانی رمز
   node server/cli.js backup [فایل]                  پشتیبان‌گیری از پایگاه‌داده
   node server/cli.js stats                          خلاصه‌ی آمار */
const path = require('node:path');
const fs = require('node:fs');
const readline = require('node:readline');
const { db, q, DATA_DIR } = require('./db');
const U = require('./util');
const B = require('./bootstrap');

function ask(prompt, hidden = true) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) { rl._writeToOutput = (t) => { if (t.includes(prompt)) rl.output.write(t); else rl.output.write('*'); }; }
    rl.question(prompt, (a) => { rl.close(); if (hidden) console.log(); resolve(a); });
  });
}
const say = require('./say');
const die = (m) => { console.error('❌ ' + m); process.exit(1); };

(async () => {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'admin') {
    const phone = U.normPhone(a[0] || ''), name = a[1] || 'مدیر دال'; if (!U.validPhone(phone)) die(say('شماره‌ی موبایل معتبر نیست. مثال: npm run admin -- 09123456789 "نام مدیر"', 'Invalid mobile number. Example: node dal.js admin 09123456789 Admin YourPassword123'));
    const pw = a[2] || process.env.DAL_ADMIN_PASSWORD || await ask(say('رمز عبور (حداقل ۸ نویسه، شامل حرف و عدد): ', 'Password (8+ characters, letters and digits): '));
    if (!U.validPassword(pw)) die(say('رمز عبور باید حداقل ۸ نویسه و شامل حرف و عدد باشد.', 'The password must be at least 8 characters and contain letters and digits.'));
    const ex = q.get('SELECT id FROM users WHERE phone=?', phone); const recovery = U.makeRecoveryCode();
    if (ex) q.run(`UPDATE users SET role='admin', verified=1, banned=0, password_hash=?, recovery_hash=?, pwv=pwv+1 WHERE id=?`, U.hashPassword(pw), U.hashPassword(U.normCode(recovery)), ex.id);
    else B.createUser({ name, phone, password: pw, role: 'admin', verified: 1 }) && q.run('UPDATE users SET recovery_hash=? WHERE phone=?', U.hashPassword(U.normCode(recovery)), phone);
    B.setupToken();
    console.log(say(`✅ مدیر ${ex ? 'به‌روزرسانی' : 'ساخته'} شد: ${phone}\n🔐 کد بازیابی (فقط همین یک بار نمایش داده می‌شود): ${recovery}`, `OK: admin ${ex ? 'updated' : 'created'}: ${phone}\nRECOVERY CODE (shown only once, write it down): ${recovery}`));
  } else if (cmd === 'reset-password') {
    const phone = U.normPhone(a[0] || ''); const u = q.get('SELECT * FROM users WHERE phone=?', phone); if (!u) die(say('کاربری با این شماره پیدا نشد.', 'No user with this number was found. Create the admin first.'));
    const pw = a[1] || U.randomPassword(10); if (!U.validPassword(pw)) die(say('رمز باید حداقل ۸ نویسه و شامل حرف و عدد باشد.', 'The password must be at least 8 characters and contain letters and digits.'));
    q.run('UPDATE users SET password_hash=?, pwv=pwv+1 WHERE id=?', U.hashPassword(pw), u.id);
    console.log(say(`✅ رمز ${u.name} (${phone}) تغییر کرد: ${pw}`, `OK: password changed for ${phone}. New password: ${pw}`));
  } else if (cmd === 'backup') {
    const dest = path.resolve(a[0] || path.join(DATA_DIR, 'backups', `dal-${new Date().toISOString().slice(0, 10)}.db`));
    fs.mkdirSync(path.dirname(dest), { recursive: true }); if (fs.existsSync(dest)) fs.unlinkSync(dest);
    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
    console.log(say(`✅ پشتیبان ساخته شد: ${dest}\n(تصاویر آپلودی در ${path.join(DATA_DIR, 'uploads')} هستند؛ آن پوشه را هم کپی کنید.)`, `OK: backup created: ${dest}\n(Uploaded images are in ${path.join(DATA_DIR, 'uploads')} - copy that folder too.)`));
  } else if (cmd === 'stats') {
    const n = (s) => q.get(s).n;
    { const o = { users: n('SELECT COUNT(*) n FROM users'), agents: n(`SELECT COUNT(*) n FROM users WHERE role='agent'`), active_listings: n(`SELECT COUNT(*) n FROM listings WHERE status='active'`), pending_listings: n(`SELECT COUNT(*) n FROM listings WHERE status='pending'`) };
      console.log(say.en ? o : { کاربران: o.users, مشاوران: o.agents, آگهی_فعال: o.active_listings, در_انتظار: o.pending_listings }); }
  } else if (cmd === 'warm-tiles') {
    const T = require('./tiles'); const which = a[0] === 'light' || a[0] === 'dark' ? [a[0]] : ['light', 'dark'];
    const n = T.coreTiles().length * which.length;
    console.log(say(`پیش‌بارگذاری نقشه‌ی هسته‌ی کنگان: حدود ${n} کاشی (چند مگابایت). کمی صبر کنید…`, `Downloading the Kangan core map: about ${n} tiles (a few MB). Please wait...`));
    let last = 0;
    const r = await T.warm(which, { onProgress: (p) => { if (p.done - last >= 50 || p.done === p.total) { last = p.done; console.log(`${p.done}/${p.total}`); } } });
    console.log(say(`✅ تمام شد: ${r.fetched} کاشی گرفته شد، ${r.failed} ناموفق. ${r.failed ? 'اگر سرور نقشه در دسترس نیست با فیلترشکن دوباره اجرا کنید.' : ''}`, `OK: done. ${r.fetched} tiles downloaded, ${r.failed} failed. ${r.failed ? 'If the map server is blocked, run it again with a VPN on.' : ''}`));
  } else {
    console.log(say('دستورها: admin | reset-password | backup | stats | warm-tiles', 'Commands: admin | reset-password | backup | stats | warm-tiles')); process.exit(cmd ? 1 : 0);
  }
})();
