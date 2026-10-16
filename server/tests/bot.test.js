'use strict';
// آزمون ربات: یک «بله‌ی ساختگی» محلی می‌سازیم و ربات واقعی دال با آن حرف می‌زند.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dal-bot-'));
process.env.DAL_DATA_DIR = dir; process.env.DAL_DB = path.join(dir, 'dal.db'); process.env.DAL_LOG_LANG = 'en';

const sent = []; const queue = []; let calls = 0;
const fake = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', async () => {
    const m = req.url.split('/').pop(); const body = b ? JSON.parse(b) : {}; calls++;
    const ok = (result) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ok: true, result })); };
    if (!req.url.includes('/bot111:TEST/')) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, description: 'Unauthorized' })); }
    if (m === 'getMe') return ok({ username: 'dal_test_bot' });
    if (m === 'getUpdates') { if (!queue.length) await new Promise((r) => setTimeout(r, 150)); return ok(queue.splice(0, 5)); }
    if (m === 'sendMessage') { sent.push(body); return ok({ message_id: sent.length }); }
    res.statusCode = 404; res.end('{}');
  });
});
const wait = async (cond, ms = 6000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 40)); } };
let uid = 0; const say = (text, id = 77) => queue.push({ update_id: ++uid, message: { chat: { id, type: 'private' }, from: { first_name: 'علی' }, text } });

test('ربات بله: شروع، منو، جستجو، مشاوره، ثبت درخواست', async () => {
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  process.env.DAL_BALE_TOKEN = '111:TEST'; process.env.DAL_BALE_API = `http://127.0.0.1:${fake.address().port}`; process.env.DAL_BOT_SYNC_MS = '200';
  const { q } = require('../db'); require('../bootstrap');
  const bot = require('../bot'); bot.start();
  await wait(() => bot.status()[0] && bot.status()[0].username === 'dal_test_bot');

  say('/start'); await wait(() => sent.length >= 1);
  assert.match(sent[0].text, /خوش آمدید/); assert.ok(sent[0].reply_markup.keyboard.length >= 3, 'منو دارد');

  say(bot.BTN.kangan); await wait(() => sent.length >= 2);
  assert.match(sent[1].text, /هنوز آگهی‌ای برای بندر کنگان/, 'پایگاه خالی است و ربات راست می‌گوید');

  say(bot.BTN.consult); await wait(() => sent.length >= 3);
  assert.match(sent[2].text, /09206696092/); assert.match(sent[2].text, /09202290930/);

  say('آپارتمان ۲ خوابه در شهرک یاس کنگان زیر ۵ میلیارد'); await wait(() => sent.length >= 4);
  assert.match(sent[3].text, /فهمیدم/); assert.match(sent[3].text, /پیدا نشد/);

  say('blah'); await wait(() => sent.length >= 5);
  assert.match(sent[4].text, /متوجه نشدم/);

  say(bot.BTN.lead); await wait(() => sent.length >= 6);
  say('123'); await wait(() => sent.length >= 7);
  assert.match(sent[6].text, /معتبر نیست/);
  say('۰۹۱۲۳۴۵۶۷۸۹'); await wait(() => sent.length >= 8);
  assert.match(sent[7].text, /ثبت شد/);
  const row = q.get('SELECT * FROM contacts ORDER BY id DESC LIMIT 1');
  assert.strictEqual(row.contact, '09123456789'); assert.match(row.message, /ربات/); assert.strictEqual(row.city, 'kangan');

  // گروه‌ها نادیده گرفته می‌شوند
  const n = sent.length; queue.push({ update_id: ++uid, message: { chat: { id: 5, type: 'group' }, text: '/start' } });
  await new Promise((r) => setTimeout(r, 600)); assert.strictEqual(sent.length, n, 'در گروه جواب نمی‌دهد');

  assert.ok(bot.status()[0].running); assert.ok(bot.status()[0].handled >= 7);
  bot.stop(); fake.closeAllConnections(); fake.close();
});

test('ربات: توکن اشتباه خطا می‌دهد و کرش نمی‌کند', async () => {
  const bot = require('../bot');
  const f2 = http.createServer((_q, r) => { r.statusCode = 401; r.end('{"ok":false,"description":"Unauthorized"}'); });
  await new Promise((r) => f2.listen(0, '127.0.0.1', r));
  process.env.DAL_BALE_API = `http://127.0.0.1:${f2.address().port}`; process.env.DAL_BALE_TOKEN = '999:BAD';
  bot.start(); await wait(() => bot.status()[0] && /نامعتبر/.test(bot.status()[0].error), 8000);
  assert.strictEqual(bot.status()[0].running, false);
  bot.stop(); f2.closeAllConnections(); f2.close();
});
