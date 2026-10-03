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
const die = (m) => { console.error('❌ ' + m); process.exit(1); };

(async () => {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'admin') {
    const phone = U.normPhone(a[0] || ''), name = a[1] || 'مدیر دال'; if (!U.validPhone(phone)) die('شماره‌ی موبایل معتبر نیست. مثال: npm run admin -- 09123456789 "نام مدیر"');
    const pw = a[2] || process.env.DAL_ADMIN_PASSWORD || await ask('رمز عبور (حداقل ۸ نویسه، شامل حرف و عدد): ');
    if (!U.validPassword(pw)) die('رمز عبور باید حداقل ۸ نویسه و شامل حرف و عدد باشد.');
    const ex = q.get('SELECT id FROM users WHERE phone=?', phone); const recovery = U.makeRecoveryCode();
    if (ex) q.run(`UPDATE users SET role='admin', verified=1, banned=0, password_hash=?, recovery_hash=?, pwv=pwv+1 WHERE id=?`, U.hashPassword(pw), U.hashPassword(U.normCode(recovery)), ex.id);
    else B.createUser({ name, phone, password: pw, role: 'admin', verified: 1 }) && q.run('UPDATE users SET recovery_hash=? WHERE phone=?', U.hashPassword(U.normCode(recovery)), phone);
    B.setupToken();
    console.log(`✅ مدیر ${ex ? 'به‌روزرسانی' : 'ساخته'} شد: ${phone}\n🔐 کد بازیابی (فقط همین یک بار نمایش داده می‌شود): ${recovery}`);
  } else if (cmd === 'reset-password') {
    const phone = U.normPhone(a[0] || ''); const u = q.get('SELECT * FROM users WHERE phone=?', phone); if (!u) die('کاربری با این شماره پیدا نشد.');
    const pw = a[1] || U.randomPassword(10); if (!U.validPassword(pw)) die('رمز باید حداقل ۸ نویسه و شامل حرف و عدد باشد.');
    q.run('UPDATE users SET password_hash=?, pwv=pwv+1 WHERE id=?', U.hashPassword(pw), u.id);
    console.log(`✅ رمز ${u.name} (${phone}) تغییر کرد: ${pw}`);
  } else if (cmd === 'backup') {
    const dest = path.resolve(a[0] || path.join(DATA_DIR, 'backups', `dal-${new Date().toISOString().slice(0, 10)}.db`));
    fs.mkdirSync(path.dirname(dest), { recursive: true }); if (fs.existsSync(dest)) fs.unlinkSync(dest);
    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
    console.log(`✅ پشتیبان ساخته شد: ${dest}\n(تصاویر آپلودی در ${path.join(DATA_DIR, 'uploads')} هستند؛ آن پوشه را هم کپی کنید.)`);
  } else if (cmd === 'stats') {
    const n = (s) => q.get(s).n;
    console.log({ کاربران: n('SELECT COUNT(*) n FROM users'), مشاوران: n(`SELECT COUNT(*) n FROM users WHERE role='agent'`), آگهی_فعال: n(`SELECT COUNT(*) n FROM listings WHERE status='active'`), در_انتظار: n(`SELECT COUNT(*) n FROM listings WHERE status='pending'`) });
  } else {
    console.log('دستورها: admin | reset-password | backup | stats'); process.exit(cmd ? 1 : 0);
  }
})();
