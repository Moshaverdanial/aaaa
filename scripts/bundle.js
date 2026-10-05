#!/usr/bin/env node
'use strict';
// ساخت «یک فایل» از کل پروژه:  node scripts/bundle.js  →  release/dal.js
// اجرا:  node dal.js            (سرور)      |  node dal.js admin 09123456789 "نام"   (دستورهای CLI)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const files = {};
function add(rel) { files[rel.split(path.sep).join('/')] = fs.readFileSync(path.join(ROOT, rel)); }
function walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel); else add(rel);
  }
}
walk('public');
for (const f of fs.readdirSync(path.join(ROOT, 'server'))) if (f.endsWith('.js') && f !== 'seed.js') add(path.join('server', f));
add('package.json');

const hash = crypto.createHash('sha1');
for (const k of Object.keys(files).sort()) { hash.update(k); hash.update(files[k]); }
const version = hash.digest('hex').slice(0, 12);
const pack = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.toString('base64')]));

const out = `#!/usr/bin/env node
'use strict';
/*
 * دال — پلتفرم هوشمند املاک (نسخه‌ی تک‌فایل)  ·  نسخه‌ی ساخت: ${version}
 * نیازمند Node.js ۲۲٫۱۳ یا بالاتر. بدون npm install.
 *
 *   node dal.js                       اجرای سایت (پورت ۳۰۰۰؛ متغیر PORT)
 *   node dal.js admin 09123456789     ساخت مدیر      |  stats | backup | reset-password
 *
 * داده‌ها در پوشه‌ی data کنار همین فایل ذخیره می‌شوند (متغیر DAL_DATA_DIR برای تغییر).
 * این فایل خودش را در پوشه‌ی .dal-app کنار فایل باز می‌کند (فقط وقتی نسخه عوض شده باشد).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 13)) { console.error('دال به Node.js 22.13 یا بالاتر نیاز دارد. نسخه‌ی فعلی: ' + process.version); process.exit(1); }

const VERSION = ${JSON.stringify(version)};
const FILES = ${JSON.stringify(pack)};

const HOME = __dirname;
const APP = path.join(HOME, '.dal-app');
const stamp = path.join(APP, '.version');
if (!fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== VERSION) {
  fs.rmSync(APP, { recursive: true, force: true });
  for (const [rel, b64] of Object.entries(FILES)) {
    const dest = path.join(APP, rel); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
  }
  fs.writeFileSync(stamp, VERSION);
}
const cli = ['admin', 'reset-password', 'backup', 'stats'].includes(process.argv[2]);
const args = cli ? ['--no-warnings', path.join(APP, 'server', 'cli.js'), ...process.argv.slice(2)] : ['--no-warnings', path.join(APP, 'server', 'index.js')];
const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, DAL_DATA_DIR: process.env.DAL_DATA_DIR || path.join(HOME, 'data') } });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s));
child.on('exit', (code) => process.exit(code ?? 0));
`;
fs.mkdirSync(path.join(ROOT, 'release'), { recursive: true });
const dest = path.join(ROOT, 'release', 'dal.js');
fs.writeFileSync(dest, out); fs.chmodSync(dest, 0o755);
console.log(`✅ ${dest}  (${(out.length / 1024).toFixed(0)} KB، ${Object.keys(files).length} فایل، نسخه ${version})`);
