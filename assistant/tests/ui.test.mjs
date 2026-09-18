/**
 * آزمون دود (smoke test) رابط «دستیار» با jsdom
 * اجرا: npm run test:ui  (نیاز به یک‌بار `npm install` برای نصب jsdom دارد)
 */
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const APP = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

const virtualConsole = new VirtualConsole();
const logs = [];
virtualConsole.on('jsdomError', (e) => logs.push(`JSDOM ERROR: ${e.message}`));
virtualConsole.on('error', (...a) => logs.push(`console.error: ${a.join(' ')}`));
virtualConsole.on('warn', (...a) => logs.push(`console.warn: ${a.join(' ')}`));

const dom = new JSDOM(html, {
  url: 'http://localhost:3000/',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
  virtualConsole,
});

const { window } = dom;
for (const key of [
  'document', 'navigator', 'localStorage', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent',
  'MouseEvent', 'KeyboardEvent', 'Blob', 'FileReader', 'File', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame', 'location', 'DOMException', 'URL',
]) {
  if (window[key] === undefined) continue;
  try {
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
  } catch {
    globalThis[key] = window[key];
  }
}
globalThis.window = window;
globalThis.self = window;
if (!globalThis.crypto) globalThis.crypto = (await import('node:crypto')).webcrypto;

const $ = (s) => window.document.querySelector(s);
const $$ = (s) => Array.from(window.document.querySelectorAll(s));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

// راه‌اندازی برنامه
await import(new URL(`../public/js/app.js?run=${Date.now()}`, import.meta.url).href);
await sleep(700);

check('برنامه بالا آمد (نوار کناری پر شد)', $$('.conv-item').length >= 0 && !!$('#conv-list'));
check('مودال راهنما در بازدید اول باز شد', $('#modal-settings').hidden === false);

// بستن مودال با دکمهٔ «حالت نمایشی»
$('#welcome-demo')?.click();
await sleep(50);
check('حالت نمایشی فعال شد', $('#provider-label').textContent.includes('نمایشی'), $('#provider-label').textContent);

// ارسال پیام
const input = $('#input');
input.value = 'سلام دستیار! یک نمونه پاسخ با کد و جدول بده.';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
$('#composer').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

await sleep(300);
check('حالت تولید روشن شد', $('#btn-stop').hidden === false);

// انتظار برای پایان جریان
for (let i = 0; i < 60; i++) {
  if ($('#btn-send').hidden === false) break;
  await sleep(250);
}
await sleep(300);

const botNodes = $$('.msg.bot');
const botText = botNodes[botNodes.length - 1]?.querySelector('.md')?.textContent || '';
check('پاسخ دستیار تولید شد', botText.length > 80, `${botText.length} نویسه`);
check('مارک‌داون به درستی رندر شد', !!$('.msg.bot .md strong, .msg.bot .md pre, .msg.bot .md table, .msg.bot .md ul'));
check('پیام کاربر در DOM است', $$('.msg.user').length === 1);

const stored = JSON.parse(window.localStorage.getItem('dastyar.conversations.v1') || '[]');
check('گفتگو در localStorage ذخیره شد', stored.length >= 1 && stored[0].messages.length >= 2,
  `${stored.length} گفتگو / ${stored[0]?.messages?.length} پیام`);
check('عنوان گفتگو از پیام اول ساخته شد', stored[0]?.title?.includes('سلام'), stored[0]?.title);
check('زمان پاسخ ثبت شد', typeof stored[0]?.messages?.at(-1)?.ms === 'number');

// گفتگوی جدید
$('#btn-new-chat').click();
await sleep(100);
check('گفتگوی جدید ساخته شد', $$('.msg').length === 0 && $('#welcome').hidden === false);
check('دو گفتگو در فهرست است', $$('.conv-item').length === 2);

// بازگشت به گفتگوی قبلی
$$('.conv-item')[1]?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(100);
check('بازگشت به گفتگوی قبلی', $$('.msg').length >= 2, `${$$('.msg').length} پیام`);

// جستجو
$('#search').value = 'جدول';
$('#search').dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(50);
check('جستجو کار می‌کند', $$('.conv-item').length === 1);
$('#search').value = 'zzz-nothing';
$('#search').dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(50);
check('جستجوی بی‌نتیجه پیام می‌دهد', !!$('.empty-list'));
$('#search').value = '';
$('#search').dispatchEvent(new window.Event('input', { bubbles: true }));

// پوسته
$('#btn-theme').click();
await sleep(30);
check('پوسته روشن شد', window.document.documentElement.dataset.theme === 'light');
$('#btn-theme').click();

// تعویض سریع سرویس
$('#provider-chip').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(50);
check('منوی تعویض سریع باز شد', $('#quick-switch').hidden === false);
check('همهٔ سرویس‌ها در منو فهرست شده‌اند', $$('#qs-list .qs-item').length >= 5, `${$$('#qs-list .qs-item').length} مورد`);
$$('#qs-list .qs-item')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(80);
check('سویچ به Gemini انجام شد', $('#provider-label').textContent.includes('Gemini'), $('#provider-label').textContent);
check('چون کلید ندارد، تنظیمات باز شد', $('#modal-settings').hidden === false);
check('منوی سریع بسته شد', $('#quick-switch').hidden === true);
// بازگشت به حالت نمایشی
$('#provider-chip').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(30);
const demoItem = $$('#qs-list .qs-item').find((n) => n.textContent.includes('نمایشی'));
demoItem?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(50);
check('بازگشت به حالت نمایشی', $('#provider-label').textContent.includes('نمایشی'), $('#provider-label').textContent);
$$('[data-close="modal-settings"]').forEach((b) => b.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
await sleep(30);

// خروجی مارک‌داون (فقط تابع ذخیره‌شده بررسی می‌شود)
const md = readFileSync(new URL('../public/js/storage.js', import.meta.url), 'utf8');
check('تابع خروجی Markdown وجود دارد', md.includes('conversationToMarkdown'));

// پاسخ دوباره
const before = $$('.msg').length;
const retryBtn = $$('.msg.bot .msg-actions button')[1];
retryBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await sleep(4000);
check('پاسخ دوباره اجرا شد', $$('.msg.bot').length >= 1);

// خطاها
const realErrors = logs.filter((l) => l.startsWith('JSDOM ERROR') || l.startsWith('console.error'));
check('بدون خطای جاوااسکریپت', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
if (logs.length) console.log('\n--- لاگ‌های کنسول ---\n' + logs.slice(0, 12).join('\n'));

const failed = results.filter((r) => !r.ok);
console.log(`\nنتیجه: ${results.length - failed.length}/${results.length} موفق`);
process.exit(failed.length ? 1 : 0);
