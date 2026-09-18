/* =========================================================
   app.js — منطق اصلی «دستیار»
   ========================================================= */

import { PROVIDERS, getProvider, getPersianRule, sendChat, testConnection } from './providers.js';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  loadConversations,
  saveConversations,
  loadActiveId,
  saveActiveId,
  newConversation,
  hasOnboarded,
  setOnboarded,
  conversationToMarkdown,
  downloadFile,
  slugify,
  uid,
} from './storage.js';
import {
  $,
  $$,
  el,
  toast,
  openModal,
  closeModal,
  confirmDialog,
  renderMessage,
  updateStreaming,
  bindCodeCopy,
  faDateLabel,
  ICON,
} from './ui.js';

/* ---------------- وضعیت ---------------- */

const state = {
  settings: loadSettings(),
  conversations: loadConversations(),
  activeId: loadActiveId(),
  generating: false,
  abort: null,
  attachments: [], // [{ name, dataUrl }]
  search: '',
};

if (!state.conversations.length) {
  const conv = newConversation();
  state.conversations = [conv];
  state.activeId = conv.id;
}
if (!state.conversations.some((c) => c.id === state.activeId)) {
  state.activeId = state.conversations[0].id;
}

const PRESETS = [
  {
    name: 'دستیار عمومی',
    prompt:
      'تو «دستیار» هستی؛ دقیق، دوستانه و کارآمد. پاسخ‌ها را خلاصه و ساختارمند بده و در صورت نیاز از فهرست و جدول استفاده کن.',
  },
  {
    name: 'برنامه‌نویس',
    prompt:
      'تو یک مهندس نرم‌افزار ارشد هستی. کد تمیز، قابل‌اجرا و بهینه بنویس؛ قبل از کد یک توضیح کوتاه بده، بعد کد را در بلوک کد با زبان مناسب قرار بده و در پایان نکات مهم (امنیت/کارایی) را فهرست کن. اگر اطلاعات کافی نداری، سؤال بپرس.',
  },
  {
    name: 'مترجم',
    prompt:
      'تو مترجم حرفه‌ای هستی. متن ورودی را بین فارسی و انگلیسی ترجمه کن: اگر ورودی فارسی بود به انگلیسی روان و اگر انگلیسی بود به فارسی طبیعی برگردان. فقط ترجمه را بده، مگر اینکه کاربر توضیح خواسته باشد.',
  },
  {
    name: 'ویراستار فارسی',
    prompt:
      'تو ویراستار متن فارسی هستی. متن را از نظر دستور زبان، نیم‌فاصله، نشانه‌گذاری و روانی بازنویسی کن. ابتدا متن ویرایش‌شده و سپس فهرست تغییرات مهم را بده.',
  },
  {
    name: 'مشاور کسب‌وکار',
    prompt:
      'تو مشاور کسب‌وکار و مدیریت پروژه هستی. پاسخ‌های عملی، مرحله‌به‌مرحله و همراه با برآورد زمان/هزینه بده. ریسک‌ها را مشخص کن و در پایان یک چکیدهٔ اقدامات بعدی بنویس.',
  },
  {
    name: 'معلم',
    prompt:
      'تو معلم صبوری هستی. موضوع را ساده و با مثال توضیح بده، از آسان به سخت پیش برو، و در پایان ۳ سؤال تمرینی بپرس تا یادگیری را بسنجی.',
  },
];

const SUGGESTIONS = [
  { title: 'یک ایمیل رسمی به کارفرما بنویس', sub: 'درخواست تمدید مهلت پروژه' },
  { title: 'قرارداد پیمانکاری را ساده توضیح بده', sub: 'ماده‌های مهم و ریسک‌ها' },
  { title: 'برنامهٔ مطالعهٔ ۳۰ روزه بساز', sub: 'با جدول روزانه' },
  { title: 'این کد را بررسی و بهینه کن', sub: 'کد را بعداً می‌چسبانی' },
];

/* ---------------- دسترسی‌ها ---------------- */

const activeConv = () => state.conversations.find((c) => c.id === state.activeId) || state.conversations[0];

function persist() {
  saveConversations(state.conversations);
  saveActiveId(state.activeId);
}

function persistSettings() {
  saveSettings(state.settings);
}

function currentCfg() {
  const pid = state.settings.providerId;
  const provider = getProvider(pid);
  const cfg = state.settings.configs[pid] || { apiKey: '', model: provider.defaultModel, baseUrl: provider.baseUrl };
  return {
    providerId: pid,
    apiKey: (cfg.apiKey || '').trim(),
    model: (cfg.model || provider.defaultModel || '').trim(),
    baseUrl: (cfg.baseUrl || provider.baseUrl || '').trim(),
    temperature: Number(state.settings.temperature),
    maxTokens: Number(state.settings.maxTokens) || undefined,
    stream: !!state.settings.stream,
    transport: state.settings.transport,
  };
}

function isReady() {
  const cfg = currentCfg();
  if (cfg.providerId === 'demo') return true;
  if (!cfg.apiKey) return false;
  if (cfg.providerId === 'custom' && !cfg.baseUrl) return false;
  return !!cfg.model;
}

/* ---------------- پوسته ---------------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  state.settings.theme = document.documentElement.dataset.theme;
  persistSettings();
}

/* ---------------- نوار کناری ---------------- */

function renderSidebar() {
  const list = $('#conv-list');
  list.innerHTML = '';

  const q = state.search.trim().toLowerCase();
  const items = state.conversations
    .filter((c) =>
      q
        ? (c.title || '').toLowerCase().includes(q) ||
          c.messages.some((m) => (m.content || '').toLowerCase().includes(q))
        : true,
    )
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (!items.length) {
    list.append(el('div', { class: 'empty-list', text: q ? 'نتیجه‌ای پیدا نشد.' : 'هنوز گفتگویی نداری.' }));
    return;
  }

  let lastLabel = null;
  for (const conv of items) {
    const label = faDateLabel(conv.updatedAt || conv.createdAt || Date.now());
    if (label !== lastLabel) {
      list.append(el('div', { class: 'conv-group-label', text: label }));
      lastLabel = label;
    }

    const node = el('div', {
      class: `conv-item ${conv.id === state.activeId ? 'is-active' : ''}`,
      tabindex: '0',
      role: 'button',
      title: conv.title,
    });

    node.append(el('span', { class: 'conv-title', text: conv.title || 'بدون عنوان' }));

    const actions = el('div', { class: 'conv-actions' });
    const renameBtn = el('button', { class: 'icon-btn', title: 'تغییر نام', html: ICON.pencil });
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renameConversation(conv.id);
    });
    const delBtn = el('button', { class: 'icon-btn', title: 'حذف', html: ICON.trash });
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeConversation(conv.id);
    });
    actions.append(renameBtn, delBtn);
    node.append(actions);

    const open = () => switchConversation(conv.id);
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    list.append(node);
  }
}

function renderProviderChip() {
  const cfg = currentCfg();
  const provider = getProvider(cfg.providerId);
  const dot = $('#provider-dot');
  const label = $('#provider-label');
  dot.className = 'dot';
  if (provider.id === 'demo') {
    dot.classList.add('demo');
    label.textContent = 'حالت نمایشی (کلید لازم نیست)';
  } else if (isReady()) {
    dot.classList.add('ok');
    label.textContent = `${provider.name} — آماده`;
  } else {
    label.textContent = `${provider.name} — کلید وارد نشده`;
  }
  $('#model-badge').textContent = cfg.model || '—';
  $('#brand-sub').textContent = provider.id === 'demo' ? 'حالت نمایشی' : cfg.model || provider.name;
  renderQuickSwitch();
}

/** منوی تعویض سریع سرویس (برای جابه‌جایی بین لایه‌های رایگان) */
function renderQuickSwitch() {
  const host = $('#qs-list');
  if (!host) return;
  host.innerHTML = '';
  for (const p of PROVIDERS) {
    const cfg = state.settings.configs[p.id] || {};
    const ready = p.id === 'demo' || (!!cfg.apiKey && !!cfg.model && (p.id !== 'custom' || !!cfg.baseUrl));
    const item = el('button', {
      type: 'button',
      class: `qs-item ${p.id === state.settings.providerId ? 'is-active' : ''}`,
    });
    item.append(el('span', { class: 'qs-name', text: p.name }));
    item.append(
      el('span', {
        class: `qs-state ${ready ? 'ready' : p.id === state.settings.providerId ? 'nokey' : ''}`,
        text: p.id === 'demo' ? 'نمایشی' : ready ? 'کلید دارد' : 'بدون کلید',
      }),
    );
    item.addEventListener('click', () => {
      selectProvider(p.id);
      closeQuickSwitch();
      if (!ready) {
        toast(`«${p.name}» انتخاب شد. حالا کلید API را وارد کن.`, 'warn', 4500);
        openSettings('connection');
      } else {
        toast(`سرویس به «${p.name}» تغییر کرد ✅`, 'info');
      }
    });
    host.append(item);
  }
}

function openQuickSwitch() {
  renderQuickSwitch();
  $('#quick-switch').hidden = false;
  $('#provider-chip').setAttribute('aria-expanded', 'true');
}

function closeQuickSwitch() {
  $('#quick-switch').hidden = true;
  $('#provider-chip').setAttribute('aria-expanded', 'false');
}

/* ---------------- گفتگو ---------------- */

function renderChat() {
  const chat = $('#chat');
  chat.innerHTML = '';
  const conv = activeConv();
  $('#conv-title').textContent = conv?.title || 'گفتگوی جدید';

  const empty = !conv || conv.messages.length === 0;
  $('#welcome').hidden = !empty;
  if (empty) return;

  const inner = el('div', { class: 'chat-inner' });
  for (const msg of conv.messages) inner.append(messageNode(msg));
  chat.append(inner);
  scrollToEnd(false);
}

function messageNode(msg) {
  return renderMessage(msg, {
    onRegenerate: (m) => regenerateFrom(m),
    onEdit: (m) => editMessage(m),
  });
}

function scrollToEnd(smooth = true) {
  const chat = $('#chat');
  requestAnimationFrame(() => {
    if (typeof chat.scrollTo === 'function') chat.scrollTo({ top: chat.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    else chat.scrollTop = chat.scrollHeight;
  });
}

function switchConversation(id) {
  if (state.generating) {
    toast('اول پاسخ در حال تولید را متوقف کن.', 'warn');
    return;
  }
  state.activeId = id;
  persist();
  renderSidebar();
  renderChat();
  closeMobileSidebar();
  $('#input').focus();
}

function startNewChat() {
  if (state.generating) {
    toast('اول پاسخ در حال تولید را متوقف کن.', 'warn');
    return;
  }
  const conv = newConversation();
  state.conversations.unshift(conv);
  state.activeId = conv.id;
  persist();
  renderSidebar();
  renderChat();
  closeMobileSidebar();
  $('#input').focus();
}

async function renameConversation(id) {
  const conv = state.conversations.find((c) => c.id === id);
  if (!conv) return;
  const next = window.prompt('نام جدید گفتگو:', conv.title || '');
  if (next === null) return;
  conv.title = next.trim() || 'بدون عنوان';
  persist();
  renderSidebar();
  if (id === state.activeId) $('#conv-title').textContent = conv.title;
}

async function removeConversation(id) {
  const ok = await confirmDialog({
    title: 'حذف گفتگو',
    text: 'این گفتگو برای همیشه حذف می‌شود. ادامه می‌دهی؟',
    okLabel: 'حذف کن',
  });
  if (!ok) return;
  state.conversations = state.conversations.filter((c) => c.id !== id);
  if (!state.conversations.length) state.conversations = [newConversation()];
  if (state.activeId === id) state.activeId = state.conversations[0].id;
  persist();
  renderSidebar();
  renderChat();
  toast('گفتگو حذف شد.', 'info');
}

/* ---------------- ارسال پیام ---------------- */

function buildMessages(conv) {
  const s = state.settings;
  const system = [s.systemPrompt?.trim(), s.alwaysPersian ? getPersianRule() : ''].filter(Boolean).join('\n\n');

  let history = conv.messages.filter((m) => !m.error && (m.content || m.images?.length));
  const limit = Number(s.memory);
  if (Number.isFinite(limit) && limit > 0) history = history.slice(-limit);

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });

  for (const m of history) {
    if (m.role === 'user' && m.images?.length) {
      const content = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const img of m.images) content.push({ type: 'image_url', image_url: { url: img } });
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content || '' });
    }
  }
  return messages;
}

async function sendMessage() {
  const input = $('#input');
  const text = input.value.trim();
  if (state.generating) return;
  if (!text && !state.attachments.length) return;

  if (!isReady()) {
    toast('اول سرویس و کلید API را در تنظیمات مشخص کن.', 'warn', 4500);
    openSettings('connection');
    return;
  }

  const conv = activeConv();
  const provider = getProvider(state.settings.providerId);
  const images = state.attachments.map((a) => a.dataUrl);
  if (images.length && provider.vision === false) {
    toast('این سرویس/مدل تصویر را پشتیبانی نمی‌کند؛ فقط متن ارسال شد.', 'warn', 4200);
  }

  const userMsg = {
    id: uid(),
    role: 'user',
    content: text,
    images: provider.vision === false ? [] : images,
    ts: Date.now(),
  };
  conv.messages.push(userMsg);

  if (!conv.title || conv.title === 'گفتگوی جدید') {
    conv.title = (text || 'گفتگوی تصویری').slice(0, 46) || 'گفتگوی جدید';
  }
  conv.updatedAt = Date.now();
  conv.model = currentCfg().model;

  clearAttachments();
  input.value = '';
  autoGrow(input);
  persist();
  renderSidebar();
  renderChat();

  await generate(conv);
}

async function generate(conv) {
  const assistantMsg = { id: uid(), role: 'assistant', content: '', ts: Date.now() };
  conv.messages.push(assistantMsg);

  const inner = $('.chat-inner', $('#chat')) || (() => {
    const node = el('div', { class: 'chat-inner' });
    $('#chat').append(node);
    return node;
  })();
  const node = messageNode(assistantMsg);
  inner.append(node);
  scrollToEnd();

  setGenerating(true);
  const started = performance.now();
  state.abort = new AbortController();

  let lastPaint = 0;
  const cfg = currentCfg();

  try {
    const finalText = await sendChat(cfg, buildMessages(conv), {
      signal: state.abort.signal,
      onDelta: (_chunk, full) => {
        assistantMsg.content = full;
        const now = performance.now();
        if (now - lastPaint > 70) {
          lastPaint = now;
          updateStreaming(node, full, { done: false });
          maybeScroll();
        }
      },
      onUsage: (usage) => {
        assistantMsg.usage = usage;
      },
    });

    assistantMsg.content = finalText;
    assistantMsg.ms = Math.round(performance.now() - started);

    if (!finalText.trim()) {
      assistantMsg.error = true;
      assistantMsg.content = 'پاسخ خالی بود. مدل یا تنظیمات «حداکثر توکن» را تغییر بده و دوباره امتحان کن.';
    }
  } catch (err) {
    if (err?.name === 'AbortError' || state.abort?.signal.aborted) {
      assistantMsg.content =
        (assistantMsg.content || '') + (assistantMsg.content ? '\n\n' : '') + '_⏹ تولید پاسخ متوقف شد._';
    } else {
      assistantMsg.error = true;
      assistantMsg.content = err?.message || String(err);
      if (assistantMsg.content.includes('سقف سهمیه')) {
        toast(
          'سهمیهٔ این سرویس تمام شد. از منوی پایین نوار کناری به یک سرویس رایگان دیگر سوییچ کن.',
          'warn',
          7000,
        );
        openQuickSwitch();
      } else {
        toast('ارسال پیام ناموفق بود. جزئیات در گفتگو آمده است.', 'error', 5000);
      }
    }
  } finally {
    setGenerating(false);
    state.abort = null;
    conv.updatedAt = Date.now();
    persist();
    renderSidebar();

    if (node.isConnected) node.replaceWith(messageNode(assistantMsg));
    scrollToEnd();
    $('#input').focus();
  }
}

function maybeScroll() {
  const chat = $('#chat');
  const nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 220;
  if (nearBottom) chat.scrollTop = chat.scrollHeight;
}

function setGenerating(on) {
  state.generating = on;
  $('#btn-send').hidden = on;
  $('#btn-stop').hidden = !on;
  $('#input').disabled = on;
  if (!on) {
    $('#btn-send').disabled = false;
  }
  $('#hint').textContent = on
    ? 'در حال تولید پاسخ… برای توقف، دکمهٔ مربع یا Esc را بزن.'
    : 'پاسخ‌ها توسط هوش مصنوعی تولید می‌شوند و ممکن است نادرست باشند. کلید API شما فقط در مرورگر خودتان ذخیره می‌شود.';
}

function stopGenerating() {
  if (!state.generating) return;
  state.abort?.abort();
}

function regenerateFrom(msg) {
  if (state.generating) return;
  const conv = activeConv();
  const idx = conv.messages.findIndex((m) => m.id === msg.id);
  if (idx === -1) return;
  // همهٔ پیام‌های بعد از این پیام حذف می‌شوند و پاسخ تازه ساخته می‌شود
  // پیام‌های بعد از این نقطه حذف می‌شوند و پاسخ تازه‌ای ساخته می‌شود
  conv.messages = conv.messages.slice(0, idx + (msg.role === 'assistant' ? 0 : 1));
  persist();
  renderChat();
  generate(conv);
}

function editMessage(msg) {
  if (state.generating) return;
  const conv = activeConv();
  const idx = conv.messages.findIndex((m) => m.id === msg.id);
  if (idx === -1) return;
  const input = $('#input');
  input.value = msg.content || '';
  autoGrow(input);
  input.focus();
  conv.messages = conv.messages.slice(0, idx);
  persist();
  renderChat();
}

/* ---------------- پیوست تصویر ---------------- */

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('خواندن فایل ناموفق بود'));
    reader.readAsDataURL(file);
  });
}

async function addFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      toast(`«${file.name}» تصویر نیست و نادیده گرفته شد.`, 'warn');
      continue;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast(`«${file.name}» بزرگ‌تر از ۶ مگابایت است.`, 'warn');
      continue;
    }
    if (state.attachments.length >= 4) {
      toast('حداکثر ۴ تصویر در هر پیام.', 'warn');
      break;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      state.attachments.push({ name: file.name, dataUrl });
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  renderAttachments();
}

function renderAttachments() {
  const host = $('#attachments');
  host.innerHTML = '';
  host.hidden = state.attachments.length === 0;
  state.attachments.forEach((att, index) => {
    const chip = el('div', { class: 'attach-chip', title: att.name });
    chip.append(el('img', { src: att.dataUrl, alt: att.name }));
    const remove = el('button', { type: 'button', title: 'حذف', text: '×' });
    remove.addEventListener('click', () => {
      state.attachments.splice(index, 1);
      renderAttachments();
    });
    chip.append(remove);
    host.append(chip);
  });
}

function clearAttachments() {
  state.attachments = [];
  renderAttachments();
  $('#file-input').value = '';
}

/* ---------------- تنظیمات ---------------- */

function buildProviderGrid() {
  const grid = $('#provider-grid');
  grid.innerHTML = '';
  for (const p of PROVIDERS) {
    const card = el('button', {
      type: 'button',
      class: `provider-card ${p.id === state.settings.providerId ? 'is-selected' : ''}`,
      'data-provider': p.id,
    });
    card.append(
      el('span', {
        html: `<b>${p.name}${p.free ? '<span class="badge-free">رایگان</span>' : ''}</b><small>${p.tag}</small>`,
      }),
    );
    card.addEventListener('click', () => selectProvider(p.id));
    grid.append(card);
  }
}

function selectProvider(pid) {
  state.settings.providerId = pid;
  const provider = getProvider(pid);
  const cfg = state.settings.configs[pid];
  if (!cfg) {
    state.settings.configs[pid] = { apiKey: '', model: provider.defaultModel, baseUrl: provider.baseUrl };
  } else {
    if (!cfg.model) cfg.model = provider.defaultModel;
    if (cfg.baseUrl === undefined) cfg.baseUrl = provider.baseUrl;
  }
  persistSettings();
  buildProviderGrid();
  syncSettingsForm();
  renderProviderChip();
  $('#test-result').textContent = '';
}

function fillModelList(models) {
  const dl = $('#model-list');
  dl.innerHTML = '';
  for (const m of models || []) dl.append(el('option', { value: m }));
}

function syncSettingsForm() {
  const s = state.settings;
  const provider = getProvider(s.providerId);
  const cfg = s.configs[s.providerId] || {};

  $('#cfg-key').value = cfg.apiKey || '';
  $('#cfg-model').value = cfg.model || provider.defaultModel || '';
  $('#cfg-baseurl').value = cfg.baseUrl || provider.baseUrl || '';
  $('#field-baseurl').hidden = s.providerId !== 'custom';
  $('#field-key').hidden = s.providerId === 'demo';

  const link = $('#signup-link');
  if (provider.signup) {
    link.href = provider.signup;
    link.textContent = 'دریافت کلید از سایت سرویس';
    link.style.display = '';
  } else {
    link.style.display = 'none';
  }

  $('#model-help').textContent = provider.hint || '';
  fillModelList(provider.models);

  $('#cfg-temp').value = s.temperature;
  $('#lbl-temp').textContent = Number(s.temperature).toFixed(1);
  $('#cfg-maxtokens').value = s.maxTokens;
  $('#cfg-system').value = s.systemPrompt;
  $('#cfg-persian').checked = !!s.alwaysPersian;
  $('#cfg-stream').checked = s.stream !== false;

  $$('#seg-transport .seg-btn').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.transport === s.transport),
  );
  $$('#seg-memory .seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.memory === String(s.memory)));

  renderStats();
}

function renderStats() {
  const total = state.conversations.reduce((sum, c) => sum + c.messages.length, 0);
  const size = new Blob([JSON.stringify(state.conversations)]).size;
  $('#stats').innerHTML = '';
  [
    `تعداد گفتگوها: ${state.conversations.length}`,
    `تعداد پیام‌ها: ${total}`,
    `حجم ذخیره‌شده در مرورگر: ${(size / 1024).toFixed(1)} کیلوبایت`,
    `سرویس فعال: ${getProvider(state.settings.providerId).name}`,
  ].forEach((line) => $('#stats').append(el('span', { text: line })));
}

function openSettings(tab = 'connection') {
  buildProviderGrid();
  syncSettingsForm();
  switchTab(tab);
  openModal('modal-settings');
}

function switchTab(name) {
  $$('#settings-tabs .tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === name));
  $$('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
}

/* ---------------- رویدادها ---------------- */

function autoGrow(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
}

function closeMobileSidebar() {
  $('#sidebar').classList.remove('is-open');
  $('#sidebar-scrim').hidden = true;
}

function bindEvents() {
  // ارسال
  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });
  $('#btn-stop').addEventListener('click', stopGenerating);

  const input = $('#input');
  input.addEventListener('input', () => autoGrow(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === 'Escape') stopGenerating();
  });

  // گفتگوها
  $('#btn-new-chat').addEventListener('click', startNewChat);
  $('#search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderSidebar();
  });
  $('#btn-delete-conv').addEventListener('click', () => removeConversation(state.activeId));
  $('#conv-title').addEventListener('dblclick', () => renameConversation(state.activeId));

  $('#btn-export').addEventListener('click', () => {
    const conv = activeConv();
    if (!conv?.messages.length) return toast('چیزی برای خروجی گرفتن نیست.', 'warn');
    downloadFile(`${slugify(conv.title, 'chat')}.md`, conversationToMarkdown(conv), 'text/markdown;charset=utf-8');
    toast('خروجی Markdown دانلود شد.', 'info');
  });

  // پوسته و منو
  $('#btn-theme').addEventListener('click', () =>
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
  );

  // تعویض سریع سرویس
  $('#provider-chip').addEventListener('click', () =>
    $('#quick-switch').hidden ? openQuickSwitch() : closeQuickSwitch(),
  );
  $('#qs-settings').addEventListener('click', () => {
    closeQuickSwitch();
    openSettings('connection');
  });
  document.addEventListener('click', (e) => {
    if (!$('#quick-switch').hidden && !e.target.closest('#quick-switch') && !e.target.closest('#provider-chip')) {
      closeQuickSwitch();
    }
  });
  $('#btn-menu').addEventListener('click', () => {
    $('#sidebar').classList.add('is-open');
    $('#sidebar-scrim').hidden = false;
  });
  $('#sidebar-scrim').addEventListener('click', closeMobileSidebar);

  // تنظیمات
  $('#btn-settings').addEventListener('click', () => openSettings('connection'));
  $('#welcome-settings').addEventListener('click', () => openSettings('connection'));
  $('#welcome-demo').addEventListener('click', () => {
    selectProvider('demo');
    closeModal('modal-settings');
    toast('حالت نمایشی فعال شد. حالا یک پیام بفرست تا محیط را ببینی.', 'info');
  });

  $$('#settings-tabs .tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  $('#cfg-key').addEventListener('input', (e) => {
    const cfg = state.settings.configs[state.settings.providerId] || {};
    cfg.apiKey = e.target.value;
    state.settings.configs[state.settings.providerId] = cfg;
    persistSettings();
    renderProviderChip();
  });

  $('#cfg-model').addEventListener('input', (e) => {
    const cfg = state.settings.configs[state.settings.providerId] || {};
    cfg.model = e.target.value;
    state.settings.configs[state.settings.providerId] = cfg;
    persistSettings();
    renderProviderChip();
  });

  $('#cfg-baseurl').addEventListener('input', (e) => {
    const cfg = state.settings.configs[state.settings.providerId] || {};
    cfg.baseUrl = e.target.value;
    state.settings.configs[state.settings.providerId] = cfg;
    persistSettings();
  });

  $('#btn-reveal-key').addEventListener('click', () => {
    const field = $('#cfg-key');
    field.type = field.type === 'password' ? 'text' : 'password';
  });

  $('#btn-fetch-models').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'در حال دریافت…';
    const cfg = currentCfg();
    const result = await testConnection(cfg);
    if (result.models?.length) {
      fillModelList(result.models);
      $('#cfg-model').focus();
      toast(`${result.models.length} مدل دریافت شد. حالا از فهرست انتخاب کن.`, 'info');
    } else {
      toast(result.message || 'فهرست مدل‌ها گرفته نشد.', result.ok ? 'warn' : 'error', 6000);
    }
    btn.disabled = false;
    btn.textContent = 'بروزرسانی فهرست';
  });

  $('#btn-test').addEventListener('click', async () => {
    const out = $('#test-result');
    out.className = 'test-result';
    out.textContent = 'در حال آزمون…';
    const result = await testConnection(currentCfg());
    out.textContent = result.message;
    out.classList.add(result.ok ? 'ok' : 'err');
    if (result.ok) toast('اتصال موفق بود ✅', 'info');
  });

  $$('#seg-transport .seg-btn').forEach((b) =>
    b.addEventListener('click', () => {
      state.settings.transport = b.dataset.transport;
      persistSettings();
      syncSettingsForm();
    }),
  );

  $$('#seg-memory .seg-btn').forEach((b) =>
    b.addEventListener('click', () => {
      const value = b.dataset.memory;
      state.settings.memory = value === 'full' ? 'full' : Number(value);
      persistSettings();
      syncSettingsForm();
    }),
  );

  $('#cfg-stream').addEventListener('change', (e) => {
    state.settings.stream = e.target.checked;
    persistSettings();
  });

  $('#cfg-persian').addEventListener('change', (e) => {
    state.settings.alwaysPersian = e.target.checked;
    persistSettings();
  });

  $('#cfg-temp').addEventListener('input', (e) => {
    state.settings.temperature = Number(e.target.value);
    $('#lbl-temp').textContent = state.settings.temperature.toFixed(1);
    persistSettings();
  });

  $('#cfg-maxtokens').addEventListener('input', (e) => {
    state.settings.maxTokens = Number(e.target.value) || DEFAULT_SETTINGS.maxTokens;
    persistSettings();
  });

  $('#cfg-system').addEventListener('input', (e) => {
    state.settings.systemPrompt = e.target.value;
    persistSettings();
  });

  const presetGrid = $('#preset-grid');
  presetGrid.innerHTML = '';
  for (const preset of PRESETS) {
    const chip = el('button', { type: 'button', class: 'preset-chip', text: preset.name });
    chip.addEventListener('click', () => {
      state.settings.systemPrompt = preset.prompt;
      $('#cfg-system').value = preset.prompt;
      persistSettings();
      toast(`شخصیت «${preset.name}» انتخاب شد.`, 'info');
    });
    presetGrid.append(chip);
  }

  // داده‌ها
  $('#btn-export-all').addEventListener('click', () => {
    downloadFile(
      `dastyar-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ version: 1, exportedAt: Date.now(), conversations: state.conversations }, null, 2),
      'application/json;charset=utf-8',
    );
    toast('پشتیبان کامل دانلود شد.', 'info');
  });

  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const incoming = Array.isArray(data) ? data : data.conversations;
      if (!Array.isArray(incoming)) throw new Error('ساختار فایل معتبر نیست');
      const existing = new Set(state.conversations.map((c) => c.id));
      let added = 0;
      for (const conv of incoming) {
        if (!conv || !Array.isArray(conv.messages)) continue;
        if (existing.has(conv.id)) conv.id = uid();
        state.conversations.unshift({ ...newConversation(conv.title || 'واردشده'), ...conv });
        added++;
      }
      persist();
      renderSidebar();
      renderChat();
      renderStats();
      toast(`${added} گفتگو وارد شد ✅`, 'info');
    } catch (err) {
      toast(`بازگردانی ناموفق: ${err.message}`, 'error', 5000);
    } finally {
      e.target.value = '';
    }
  });

  $('#btn-clear-chats').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'حذف همهٔ گفتگوها',
      text: 'همهٔ گفتگوها از حافظهٔ مرورگر پاک می‌شوند. مطمئنی؟',
      okLabel: 'همه را پاک کن',
    });
    if (!ok) return;
    state.conversations = [newConversation()];
    state.activeId = state.conversations[0].id;
    persist();
    renderSidebar();
    renderChat();
    renderStats();
    toast('همهٔ گفتگوها پاک شدند.', 'info');
  });

  $('#btn-clear-key').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'حذف کلید API',
      text: 'کلیدهای ذخیره‌شدهٔ همهٔ سرویس‌ها از این مرورگر حذف می‌شوند.',
      okLabel: 'حذف کن',
    });
    if (!ok) return;
    for (const pid of Object.keys(state.settings.configs)) {
      state.settings.configs[pid].apiKey = '';
    }
    persistSettings();
    syncSettingsForm();
    renderProviderChip();
    toast('کلیدها حذف شدند.', 'info');
  });

  // پیشنهادها
  const sug = $('#suggestions');
  sug.innerHTML = '';
  for (const item of SUGGESTIONS) {
    const btn = el('button', {
      type: 'button',
      class: 'suggestion',
      html: `${item.title}<small>${item.sub}</small>`,
    });
    btn.addEventListener('click', () => {
      $('#input').value = item.title;
      autoGrow($('#input'));
      $('#input').focus();
    });
    sug.append(btn);
  }

  // بستن مودال‌ها
  $$('[data-close]').forEach((btn) =>
    btn.addEventListener('click', () => {
      closeModal(btn.dataset.close);
      if (btn.dataset.close === 'modal-settings') setOnboarded();
    }),
  );
  $$('.modal').forEach((modal) =>
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.hidden = true;
        if (modal.id === 'modal-settings') setOnboarded();
        if (!document.querySelector('.modal:not([hidden])')) document.body.style.overflow = '';
      }
    }),
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal:not([hidden])');
      if (open) {
        open.hidden = true;
        document.body.style.overflow = '';
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#search').focus();
    }
  });

  // پیوست تصویر
  $('#btn-attach').addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', (e) => addFiles(e.target.files));

  const chatEl = $('#chat');
  chatEl.addEventListener('dragover', (e) => e.preventDefault());
  chatEl.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });
  document.addEventListener('paste', (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files = items.filter((it) => it.kind === 'file').map((it) => it.getAsFile()).filter(Boolean);
    if (files.length) addFiles(files);
  });

  bindCodeCopy(document);
}

/* ---------------- راه‌اندازی ---------------- */

function init() {
  applyTheme(state.settings.theme || 'dark');
  bindEvents();
  renderSidebar();
  renderChat();
  renderProviderChip();
  autoGrow($('#input'));
  $('#input').focus();

  if (!hasOnboarded()) {
    setTimeout(() => {
      openSettings('connection');
      toast('برای شروع، یک سرویس رایگان را انتخاب کن و کلیدش را بچسبان — یا «حالت نمایشی» را بزن.', 'info', 8000);
    }, 400);
  } else if (!isReady()) {
    toast('سرویس/کلید API تنظیم نشده؛ روی «تنظیمات» بزن.', 'warn', 5000);
  }
}

// اگر کاربر ناگهان صفحه را بست، داده‌ها از قبل ذخیره شده‌اند؛ این فقط محکم‌کاری است
window.addEventListener('beforeunload', persist);

init();
