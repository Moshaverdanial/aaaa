/* =========================================================
   providers.js — کاتالوگ سرویس‌ها + گفتگو با آن‌ها
   همهٔ سرویس‌ها با قالب «سازگار با OpenAI» صدا زده می‌شوند،
   بنابراین یک کلاینت برای همه کافی است.
   ========================================================= */

export const PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    tag: 'رایگان با ایمیل',
    free: true,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    signup: 'https://aistudio.google.com/app/apikey',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-pro'],
    defaultModel: 'gemini-2.5-flash',
    vision: true,
    hint: 'با حساب گوگل وارد AI Studio شو و یک کلید رایگان بساز؛ لایهٔ رایگان روزانه دارد.',
  },
  {
    id: 'groq',
    name: 'Groq',
    tag: 'رایگان و خیلی سریع',
    free: true,
    baseUrl: 'https://api.groq.com/openai/v1',
    signup: 'https://console.groq.com/keys',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'deepseek-r1-distill-llama-70b',
    ],
    defaultModel: 'llama-3.3-70b-versatile',
    vision: false,
    hint: 'با ایمیل ثبت‌نام کن و رایگان کلید بگیر؛ سرعت پاسخ فوق‌العاده است.',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    tag: 'مدل‌های :free',
    free: true,
    baseUrl: 'https://openrouter.ai/api/v1',
    signup: 'https://openrouter.ai/settings/keys',
    models: [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'deepseek/deepseek-chat-v3-0324:free',
      'qwen/qwen3-235b-a22b:free',
    ],
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    vision: false,
    hint: 'یک کلید، دسترسی به ده‌ها مدل؛ مدل‌هایی که پسوند :free دارند رایگان‌اند.',
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    tag: 'نیاز به کلید API',
    free: false,
    baseUrl: 'https://api.openai.com/v1',
    signup: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-5-mini', 'o4-mini'],
    defaultModel: 'gpt-4o-mini',
    vision: true,
    hint: 'API پولی است (اعتبار لازم دارد). وب‌سایت chatgpt.com کلید API نمی‌دهد.',
  },
  {
    id: 'custom',
    name: 'سرویس دلخواه',
    tag: 'سازگار با OpenAI',
    free: false,
    baseUrl: '',
    signup: null,
    models: [],
    defaultModel: '',
    vision: true,
    hint: 'هر سرویسی کهendpoint سازگار با OpenAI دارد (مثل LM Studio روی localhost:1234/v1).',
  },
  {
    id: 'demo',
    name: 'حالت نمایشی',
    tag: 'بدون کلید، بدون اینترنت',
    free: true,
    baseUrl: '',
    signup: null,
    models: ['demo-fa-1'],
    defaultModel: 'demo-fa-1',
    vision: false,
    hint: 'برای آشنایی با محیط برنامه؛ پاسخ‌ها از پیش نوشته‌شده‌اند و واقعی نیستند.',
  },
];

export const getPersianRule = () =>
  'همیشه به زبان فارسی روان و طبیعی پاسخ بده (مگر اینکه کاربر صریحاً زبان دیگری خواست یا متن ورودی به زبان دیگری بود که ترجمه‌اش خواسته شده). کدها، نام توابع و مسیرها را به همان زبان اصلی نگه دار.';

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[PROVIDERS.length - 1];
}

/** خطاهای رایج HTTP را به متن فارسی قابل‌فهم تبدیل می‌کند */
function friendlyError(status, bodyText, providerName) {
  let detail = '';
  try {
    const json = JSON.parse(bodyText);
    detail = json?.error?.message || json?.error || json?.message || '';
  } catch {
    detail = (bodyText || '').slice(0, 240);
  }

  const map = {
    401: 'کلید API نامعتبر یا منقضی است. آن را در تنظیمات دوباره بررسی کن.',
    403: 'دسترسی با این کلید مجاز نیست (ممکن است سرویس در منطقهٔ شما محدود باشد).',
    404: 'مدل یا آدرس API پیدا نشد. نام مدل و آدرس پایه را در تنظیمات چک کن.',
    413: 'پیام یا تصویر ارسالی خیلی بزرگ است.',
    429: 'به سقف سهمیه/تعداد درخواست رسیدی. کمی صبر کن یا از یک سرویس رایگان دیگر استفاده کن.',
    500: 'خطای داخلی سرویس‌دهنده. دوباره امتحان کن.',
    502: 'سرویس‌دهنده پاسخ نامعتبر داد.',
    503: 'سرویس‌دهنده موقتاً در دسترس نیست.',
  };

  const base = map[status] || `درخواست ناموفق بود (کد ${status}).`;
  return `${base}\n\nسرویس: ${providerName}${detail ? `\nجزئیات: ${detail}` : ''}`;
}

function networkErrorMessage(err) {
  return [
    'اتصال به سرویس برقرار نشد.',
    '',
    'دلایل رایج:',
    '• شبکه/مرورگر دسترسی به این دامنه را بسته است (VPN یا پروکسی را امتحان کن).',
    '• آدرس پایهٔ API اشتباه است.',
    '• اگر برنامه را روی سرور اجرا می‌کنی، حالت «پروکسی سرور» را در تنظیمات روشن کن.',
    '',
    `خطای فنی: ${err?.message || err}`,
  ].join('\n');
}

/** ساخت پیکرهٔ درخواست سازگار با OpenAI */
function buildPayload({ model, messages, temperature, maxTokens, stream }) {
  const payload = { model, messages, stream: !!stream };
  if (typeof temperature === 'number') payload.temperature = temperature;
  if (maxTokens) payload.max_tokens = maxTokens;
  if (stream) {
    payload.stream_options = { include_usage: true };
  }
  return payload;
}

function buildHeaders(apiKey, providerId) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = location.origin;
    headers['X-Title'] = 'Dastyar';
  }
  return headers;
}

/* ---------------- حالت نمایشی ---------------- */

const DEMO_REPLIES = [
  `این یک **پاسخ نمایشی** است — یعنی هنوز کلید API وارد نکرده‌ای. 🙂

برای اینکه واقعاً با هوش مصنوعی حرف بزنی:

1. دکمهٔ **تنظیمات** (پایین سمت راست) را بزن.
2. یکی از سرویس‌های رایگان را انتخاب کن:
   - \`Gemini\` → با ایمیل گوگل، کلید رایگان از AI Studio
   - \`Groq\` → با ایمیل، کلید رایگان و سرعت بالا
   - \`OpenRouter\` → مدل‌های با پسوند \`:free\`
3. کلید را در کادر «کلید API» بچسبان و **آزمون اتصال** را بزن.

> کلید فقط در همین مرورگر ذخیره می‌شود و جای دیگری نمی‌رود.

\`\`\`bash
# نمونه: اجرای برنامه روی کامپیوتر خودت
cd assistant
npm start
# سپس باز کردن http://localhost:3000
\`\`\`
`,
  `حتی در حالت نمایشی هم می‌توانم قالب پاسخ‌ها را نشان بدهم:

| قابلیت | وضعیت |
| --- | --- |
| گفتگوی جریان‌دار | ✅ |
| چند گفتگو همزمان | ✅ |
| مارک‌داون و کد | ✅ |
| پیوست تصویر | ✅ |
| خروجی Markdown/JSON | ✅ |

- مورد اول
- مورد دوم
  - زیرمورد

**نکته:** برای پاسخ واقعی، فقط یک کلید رایگان لازم داری.`,
];

async function* demoStream(prompt, signal) {
  const hasImage = Array.isArray(prompt?.content);
  const text = hasImage
    ? `در حالت نمایشی نمی‌توانم تصویر را تحلیل کنم، ولی رابط کاربری آماده است. 🖼️\n\nکلید یک سرویس رایگان (Gemینی/Groq/OpenRouter) را در تنظیمات وارد کن تا پاسخ واقعی بگیری.`
    : DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)];

  const tokens = text.split(/(\s+)/);
  for (const token of tokens) {
    if (signal?.aborted) return;
    await new Promise((r) => setTimeout(r, 18));
    yield token;
  }
}

/* ---------------- هستهٔ ارسال پیام ---------------- */

/**
 * ارسال پیام‌ها به سرویس.
 * @param {object} cfg  { providerId, baseUrl, apiKey, model, temperature, maxTokens, stream, transport }
 * @param {Array}  messages
 * @param {object} opts { signal, onDelta(textChunk), onUsage(usage) }
 * @returns {Promise<string>} متن کامل پاسخ
 */
export async function sendChat(cfg, messages, opts = {}) {
  const { onDelta = () => {}, onUsage = () => {}, signal } = opts;
  const provider = getProvider(cfg.providerId);

  if (provider.id === 'demo') {
    let out = '';
    for await (const chunk of demoStream(messages[messages.length - 1], signal)) {
      out += chunk;
      onDelta(chunk, out);
    }
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return out;
  }

  const useProxy = cfg.transport === 'proxy';
  const url = useProxy ? '/api/chat' : `${(cfg.baseUrl || provider.baseUrl).replace(/\/$/, '')}/chat/completions`;

  const body = useProxy
    ? {
        provider: provider.id,
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        stream: cfg.stream !== false,
      }
    : buildPayload({
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        stream: cfg.stream !== false,
      });

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: useProxy ? { 'Content-Type': 'application/json' } : buildHeaders(cfg.apiKey, provider.id),
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new Error(networkErrorMessage(err));
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(friendlyError(res.status, text, provider.name));
  }

  // پاسخ غیرجریان‌دار
  if (cfg.stream === false || !res.body) {
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    if (data?.usage) onUsage(data.usage);
    onDelta(text, text);
    return text;
  }

  // پاسخ جریان‌دار (SSE)
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(':')) continue;
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;

      let json;
      try {
        json = JSON.parse(data);
      } catch {
        continue; // بعضی سرویس‌ها گاهی JSON ناقص می‌فرستند
      }
      if (json?.error) {
        throw new Error(friendlyError(400, JSON.stringify(json.error), provider.name));
      }
      const delta = json?.choices?.[0]?.delta?.content || json?.choices?.[0]?.message?.content || '';
      if (delta) {
        full += delta;
        onDelta(delta, full);
      }
      if (json?.usage) onUsage(json.usage);
    }
  }

  return full;
}

/** آزمون اتصال: گرفتن فهرست مدل‌ها */
export async function testConnection({ providerId, baseUrl, apiKey, transport }) {
  const provider = getProvider(providerId);
  if (provider.id === 'demo') return { ok: true, message: 'حالت نمایشی فعال است (بدون نیاز به اینترنت).' };

  if (transport === 'proxy') {
    return {
      ok: false,
      message:
        'آزمون اتصال فقط در حالت «مستقیم از مرورگر» انجام می‌شود. در حالت پروکسی، کافی است یک پیام بفرستی.',
    };
  }

  const url = `${(baseUrl || provider.baseUrl).replace(/\/$/, '')}/models`;
  try {
    const res = await fetch(url, { headers: buildHeaders(apiKey, providerId) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, message: friendlyError(res.status, text, provider.name) };
    }
    const data = await res.json().catch(() => ({}));
    const ids = (data?.data || []).map((m) => m.id).filter(Boolean);
    return {
      ok: true,
      message: ids.length
        ? `اتصال برقرار شد ✅ — ${ids.length} مدل در دسترس است.`
        : 'اتصال برقرار شد ✅',
      models: ids,
    };
  } catch (err) {
    return { ok: false, message: networkErrorMessage(err) };
  }
}
