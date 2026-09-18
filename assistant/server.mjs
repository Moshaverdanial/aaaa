/**
 * دستیار — سرور ایستای بدون وابستگی (Node 18+)
 *
 * دو کار انجام می‌دهد:
 *  1) سرو کردن فایل‌های پوشهٔ public (رابط کاربری)
 *  2) یک پروکسی اختیاری برای صدا زدن سرویس‌های هوش مصنوعی از سمت سرور
 *     (فقط وقتی کلیدها در فایل .env روی سرور باشند — به‌صورت پیش‌فرض غیرفعال است
 *      و مرورگر مستقیماً با سرویس‌دهنده صحبت می‌کند)
 *
 * اجرا:  npm start   (یا:  node server.mjs)
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = resolve(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

loadEnv(join(__dirname, '.env'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** نگاشت شناسهٔ سرویس‌دهنده به آدرس پایه و متغیر محیطی کلید */
const UPSTREAMS = {
  openai: {
    base: 'https://api.openai.com/v1',
    keyVar: 'OPENAI_API_KEY',
  },
  gemini: {
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyVar: 'GEMINI_API_KEY',
  },
  groq: {
    base: 'https://api.groq.com/openai/v1',
    keyVar: 'GROQ_API_KEY',
  },
  openrouter: {
    base: 'https://openrouter.ai/api/v1',
    keyVar: 'OPENROUTER_API_KEY',
  },
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  // جلوگیری از خروج از پوشهٔ public
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(PUBLIC_DIR, safe);

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    // هر مسیر ناشناخته به صفحهٔ اصلی برمی‌گردد (SPA)
    filePath = join(PUBLIC_DIR, 'index.html');
  }

  const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
  const stream = createReadStream(filePath);
  stream.on('error', () => send(res, 500, 'خطای خواندن فایل'));
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
  stream.pipe(res);
}

async function readBody(req, limitBytes = 25 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw new Error('payload too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * پروکسی اختیاری: POST /api/chat
 * body: { provider, model, messages, temperature, max_tokens, stream }
 * کلید از محیط سرور خوانده می‌شود و هرگز به مرورگر برنمی‌گردد.
 */
async function handleProxy(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return send(res, 400, JSON.stringify({ error: 'بدنهٔ درخواست JSON معتبر نیست' }), {
      'Content-Type': 'application/json; charset=utf-8',
    });
  }

  const upstream = UPSTREAMS[payload.provider];
  if (!upstream) {
    return send(res, 400, JSON.stringify({ error: 'سرویس‌دهندهٔ نامعتبر' }), {
      'Content-Type': 'application/json; charset=utf-8',
    });
  }

  const apiKey = process.env[upstream.keyVar];
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    return send(
      res,
      412,
      JSON.stringify({
        error: `کلید ${upstream.keyVar} روی سرور تنظیم نشده است. یا آن را در فایل .env بگذارید یا از حالت «ارتباط مستقیم مرورگر» استفاده کنید.`,
      }),
      { 'Content-Type': 'application/json; charset=utf-8' },
    );
  }

  const body = JSON.stringify({
    model: payload.model,
    messages: payload.messages,
    temperature: payload.temperature,
    max_tokens: payload.max_tokens,
    stream: payload.stream !== false,
  });

  try {
    const upstreamRes = await fetch(`${upstream.base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });

    res.writeHead(upstreamRes.status, {
      'Content-Type': upstreamRes.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    });

    if (!upstreamRes.body) {
      res.end(await upstreamRes.text());
      return;
    }
    // عبور دادن جریان (stream) بدون بافر کردن
    const reader = upstreamRes.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };
    res.on('close', () => reader.cancel().catch(() => {}));
    await pump();
  } catch (err) {
    if (!res.headersSent) {
      send(res, 502, JSON.stringify({ error: `اتصال سرور به سرویس ناموفق بود: ${err.message}` }), {
        'Content-Type': 'application/json; charset=utf-8',
      });
    } else {
      res.end();
    }
  }
}

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') return void handleProxy(req, res);
  if (req.method === 'GET' && req.url === '/api/health') {
    return send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': 'application/json' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');
  return serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  const keys = Object.values(UPSTREAMS)
    .map((u) => u.keyVar)
    .filter((v) => process.env[v] && process.env[v] !== 'PLACEHOLDER_API_KEY');
  console.log(`🤖 دستیار آماده است → http://localhost:${PORT}`);
  console.log(
    keys.length
      ? `   کلیدهای فعال روی سرور (پروکسی): ${keys.join(', ')}`
      : '   کلیدی روی سرور نیست → حالت پیش‌فرض: مرورگر مستقیماً با سرویس‌دهنده صحبت می‌کند.',
  );
});
