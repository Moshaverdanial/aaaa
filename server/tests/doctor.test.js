'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

test('doctor: نصب سالم را گزارش می‌کند و روی پورت اشغال هشدار می‌دهد', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dal-doc-'));
  const r = spawnSync(process.execPath, ['--no-warnings', path.join(__dirname, '..', 'doctor.js')], { env: { ...process.env, DAL_DATA_DIR: dir, PORT: '39871', DAL_LOG_LANG: 'en' }, encoding: 'utf8', timeout: 60000 });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Data folder writable/); assert.match(r.stdout, /SQLite engine available/); assert.match(r.stdout, /ALL GOOD/);
  // پورت اشغال با برنامه‌ی دیگر
  const net = require('node:net'); const s = net.createServer(); 
  return new Promise((done) => s.listen(39872, '0.0.0.0', () => {
    const r2 = spawnSync(process.execPath, ['--no-warnings', path.join(__dirname, '..', 'doctor.js')], { env: { ...process.env, DAL_DATA_DIR: dir, PORT: '39872', DAL_LOG_LANG: 'en' }, encoding: 'utf8', timeout: 60000 });
    s.close(); assert.strictEqual(r2.status, 1); assert.match(r2.stdout, /used by ANOTHER program/); done();
  }));
});
