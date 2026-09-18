/* =========================================================
   storage.js — نگهداری گفتگوها و تنظیمات در localStorage
   ========================================================= */

const KEY_CONVOS = 'dastyar.conversations.v1';
const KEY_SETTINGS = 'dastyar.settings.v1';
const KEY_ACTIVE = 'dastyar.active.v1';
const KEY_SEEN = 'dastyar.onboarded.v1';

export const DEFAULT_SETTINGS = {
  providerId: 'demo',
  configs: {
    // providerId -> { apiKey, model, baseUrl }
    demo: { apiKey: '', model: 'demo-fa-1', baseUrl: '' },
  },
  transport: 'direct', // direct | proxy
  stream: true,
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt:
    'تو «دستیار» هستی؛ یک دستیار هوش مصنوعی دقیق، دوستانه و کارآمد. پاسخ‌ها را ساختارمند و کوتاه بده و در صورت نیاز از فهرست، جدول و کد استفاده کن.',
  alwaysPersian: true,
  memory: 'full', // full | 20 | 8 | 2
  theme: 'dark',
};

function safeParse(text, fallback) {
  try {
    const value = JSON.parse(text);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? safeParse(raw, fallback) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn('ذخیره‌سازی محلی ناموفق بود:', err);
    return false;
  }
}

/* ---------- تنظیمات ---------- */

export function loadSettings() {
  const stored = read(KEY_SETTINGS, {});
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  merged.configs = { ...DEFAULT_SETTINGS.configs, ...(stored.configs || {}) };
  return merged;
}

export function saveSettings(settings) {
  return write(KEY_SETTINGS, settings);
}

export function providerConfig(settings, providerId = settings.providerId) {
  return settings.configs[providerId] || { apiKey: '', model: '', baseUrl: '' };
}

export function setProviderConfig(settings, providerId, patch) {
  const current = settings.configs[providerId] || { apiKey: '', model: '', baseUrl: '' };
  settings.configs[providerId] = { ...current, ...patch };
  return settings;
}

/* ---------- گفتگوها ---------- */

export const uid = () =>
  (crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`).toString();

export function newConversation(title = 'گفتگوی جدید') {
  const now = Date.now();
  return { id: uid(), title, messages: [], createdAt: now, updatedAt: now, model: null };
}

export function loadConversations() {
  const list = read(KEY_CONVOS, []);
  return Array.isArray(list) ? list : [];
}

export function saveConversations(list) {
  return write(KEY_CONVOS, list);
}

export function loadActiveId() {
  try {
    return localStorage.getItem(KEY_ACTIVE);
  } catch {
    return null;
  }
}

export function saveActiveId(id) {
  try {
    localStorage.setItem(KEY_ACTIVE, id || '');
  } catch {
    /* ignore */
  }
}

export function hasOnboarded() {
  try {
    return localStorage.getItem(KEY_SEEN) === '1';
  } catch {
    return false;
  }
}

export function setOnboarded() {
  try {
    localStorage.setItem(KEY_SEEN, '1');
  } catch {
    /* ignore */
  }
}

/* ---------- خروجی ---------- */

export function conversationToMarkdown(conv) {
  const lines = [`# ${conv.title}`, '', `_${new Date(conv.updatedAt).toLocaleString('fa-IR')}_`, ''];
  for (const m of conv.messages) {
    if (m.error) {
      lines.push(`> ⚠️ خطا: ${m.content}`, '');
      continue;
    }
    lines.push(m.role === 'user' ? '## 🧑 شما' : '## 🤖 دستیار');
    lines.push('', m.content || '', '');
  }
  return lines.join('\n');
}

export function downloadFile(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function slugify(text, fallback = 'chat') {
  const base = (text || '')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .trim();
  return base || fallback;
}
