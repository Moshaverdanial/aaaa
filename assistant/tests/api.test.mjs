/** آزمون لایهٔ ارتباط با سرویس‌ها (providers.js) با fetch جعلی */
import { sendChat, testConnection, getProvider, PROVIDERS } from '../public/js/providers.js';

globalThis.location = { origin: 'http://localhost:3000' };

let passed = 0;
let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`✅ ${name}`); }
  else { failed++; console.log(`❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

const sseResponse = (chunks, { status = 200 } = {}) =>
  new Response(
    new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        for (const c of chunks) controller.enqueue(enc.encode(c));
        controller.close();
      },
    }),
    { status, headers: { 'content-type': 'text/event-stream' } },
  );

const cfg = {
  providerId: 'gemini',
  apiKey: 'test-key',
  model: 'gemini-2.5-flash',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  temperature: 0.7,
  maxTokens: 512,
  stream: true,
  transport: 'direct',
};
const messages = [{ role: 'user', content: 'سلام' }];

// ۱) جریان SSE با تکه‌های شکسته بین مرزهای بافر
{
  const chunks = [
    'data: {"choices":[{"delta":{"content":"سلام"}}]}\n\n',
    'data: {"choices":[{"del',
    'ta":{"content":" دنیا"}}]}\n\ndata: {"choices":[{"delta":{"content":"!"}}],"usage":{"total_tokens":42}}\n\ndata: [DONE]\n\n',
  ];
  globalThis.fetch = async () => sseResponse(chunks);
  const deltas = [];
  const text = await sendChat(cfg, messages, { onDelta: (d) => deltas.push(d), onUsage: () => {} });
  check('جریان SSE به‌درستی خوانده شد', text === 'سلام دنیا!', text);
  check('تکه‌های شکسته بین بافرها درست به هم رسیدند', deltas.length >= 3, `${deltas.length} تکه`);
}

// ۲) استفاده از usage
{
  let usage = null;
  globalThis.fetch = async () =>
    sseResponse(['data: {"choices":[{"delta":{"content":"x"}}],"usage":{"total_tokens":99}}\n\ndata: [DONE]\n\n']);
  await sendChat(cfg, messages, { onUsage: (u) => (usage = u) });
  check('مصرف توکن گزارش شد', usage?.total_tokens === 99, JSON.stringify(usage));
}

// ۳) پاسخ غیرجریان‌دار
{
  globalThis.fetch = async () =>
    Response.json({ choices: [{ message: { content: 'پاسخ کامل' } }], usage: { total_tokens: 5 } });
  const text = await sendChat({ ...cfg, stream: false }, messages, {});
  check('حالت غیرجریان‌دار کار می‌کند', text === 'پاسخ کامل', text);
}

// ۴) خطاهای HTTP → پیام فارسی
for (const [status, expect] of [
  [401, 'کلید API نامعتبر'],
  [429, 'سقف سهمیه'],
  [404, 'پیدا نشد'],
  [500, 'خطای داخلی'],
]) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: 'provider detail' } }), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  let msg = '';
  try {
    await sendChat(cfg, messages, {});
  } catch (err) {
    msg = err.message;
  }
  check(`خطای ${status} به فارسی توضیح داده شد`, msg.includes(expect) && msg.includes('provider detail'), msg.slice(0, 60));
}

// ۵) خطای شبکه
{
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  let msg = '';
  try {
    await sendChat(cfg, messages, {});
  } catch (err) {
    msg = err.message;
  }
  check('خطای شبکه راهنمای فارسی می‌دهد', msg.includes('اتصال به سرویس برقرار نشد'), msg.slice(0, 40));
}

// ۶) لغو (Abort)
{
  const ac = new AbortController();
  globalThis.fetch = async (_url, opts) =>
    new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const e = new Error('Aborted');
        e.name = 'AbortError';
        reject(e);
      });
      setTimeout(() => ac.abort(), 20);
    });
  let name = '';
  try {
    await sendChat(cfg, messages, { signal: ac.signal });
  } catch (err) {
    name = err.name;
  }
  check('لغو درخواست به‌درستی منتشر می‌شود', name === 'AbortError', name);
}

// ۷) آزمون اتصال
{
  globalThis.fetch = async () => Response.json({ data: [{ id: 'model-a' }, { id: 'model-b' }] });
  const r = await testConnection(cfg);
  check('آزمون اتصال فهرست مدل‌ها را برمی‌گرداند', r.ok && r.models.length === 2, JSON.stringify(r).slice(0, 80));
}

// ۸) هدرها و آدرس‌ها
{
  let seen = null;
  globalThis.fetch = async (url, opts) => {
    seen = { url, opts };
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  };
  await sendChat({ ...cfg, stream: false }, messages, {});
  const body = JSON.parse(seen.opts.body);
  check('آدرس درخواست درست ساخته شد', seen.url === `${cfg.baseUrl}/chat/completions`, seen.url);
  check('هدر Authorization فرستاده شد', seen.opts.headers.Authorization === 'Bearer test-key');
  check('پارامترها در بدنه درست‌اند', body.model === cfg.model && body.temperature === 0.7 && body.max_tokens === 512);

  await sendChat({ ...cfg, providerId: 'openrouter', stream: false }, messages, {});
  check('هدرهای ویژهٔ OpenRouter اضافه شد', seen.opts.headers['X-Title'] === 'Dastyar');

  await sendChat({ ...cfg, providerId: 'openai', baseUrl: '', stream: false }, messages, {});
  check('آدرس OpenAI درست است', seen.url === 'https://api.openai.com/v1/chat/completions', seen.url);

  await sendChat(
    { ...cfg, providerId: 'custom', baseUrl: 'http://127.0.0.1:1234/v1/', model: 'local-model', stream: false },
    messages,
    {},
  );
  check('آدرس سرویس دلخواه (بدون / اضافه) درست است', seen.url === 'http://127.0.0.1:1234/v1/chat/completions', seen.url);

  await sendChat({ ...cfg, transport: 'proxy', stream: false }, messages, {});
  check('حالت پروکسی به /api/chat می‌رود', seen.url === '/api/chat', seen.url);
}

// ۹) تصویر در پیام
{
  let body = null;
  globalThis.fetch = async (_u, opts) => {
    body = JSON.parse(opts.body);
    return Response.json({ choices: [{ message: { content: 'ok' } }] });
  };
  await sendChat(
    { ...cfg, stream: false },
    [{ role: 'user', content: [{ type: 'text', text: 'چیه؟' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } }] }],
    {},
  );
  check('پیام چندبخشی (متن+تصویر) سالم منتقل شد', Array.isArray(body.messages[0].content) && body.messages[0].content.length === 2);
}

// ۱۰) حالت نمایشی
{
  const text = await sendChat({ ...cfg, providerId: 'demo', model: 'demo-fa-1' }, messages, {});
  check('حالت نمایشی بدون اینترنت پاسخ می‌دهد', text.length > 100);
}

// ۱۱) کاتالوگ سرویس‌ها
{
  const free = PROVIDERS.filter((p) => p.free).map((p) => p.name);
  check('دست‌کم سه سرویس رایگان معرفی شده', free.length >= 4, free.join(', '));
  check('همهٔ سرویس‌های آماده مدل پیش‌فرض دارند', PROVIDERS.filter((p) => p.id !== 'custom').every((p) => p.defaultModel));
  check('getProvider برای شناسهٔ ناشناخته fallback دارد', !!getProvider('nope').id);
}

console.log(`\nنتیجه: ${passed}/${passed + failed} موفق`);
process.exit(failed ? 1 : 0);
