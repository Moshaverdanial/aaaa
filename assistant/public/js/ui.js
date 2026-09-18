/* =========================================================
   ui.js — ابزارهای رابط کاربری (المان‌ها، مودال، تست، پیام‌ها)
   ========================================================= */

import { renderMarkdown, renderPlain } from './markdown.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const ICON = {
  bot: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="4"/><path d="M12 3v4M8.5 13h.01M15.5 13h.01M9 17h6"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`,
  retry: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg>`,
  pencil: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16v4Z"/><path d="m14 6 4 4"/></svg>`,
};

/* ---------- تست (اعلان کوتاه) ---------- */

export function toast(message, type = 'info', ms = 3600) {
  const host = $('#toast-host');
  if (!host) return;
  const node = el('div', { class: `toast ${type === 'error' ? 'err' : type === 'warn' ? 'warn' : ''}`, text: message });
  host.append(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    node.style.transition = 'all 200ms';
    setTimeout(() => node.remove(), 220);
  }, ms);
}

/* ---------- مودال ---------- */

export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  const focusable = modal.querySelector('input,textarea,button');
  focusable?.focus({ preventScroll: true });
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.hidden = true;
  if (!document.querySelector('.modal:not([hidden])')) document.body.style.overflow = '';
}

export function confirmDialog({ title = 'مطمئنی؟', text = '', okLabel = 'تأیید' } = {}) {
  return new Promise((resolve) => {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    const okBtn = $('#confirm-ok');
    okBtn.textContent = okLabel;
    openModal('modal-confirm');

    const cleanup = (result) => {
      okBtn.removeEventListener('click', onOk);
      document.removeEventListener('keydown', onKey);
      closeModal('modal-confirm');
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };
    okBtn.addEventListener('click', onOk);
    document.addEventListener('keydown', onKey);
    document.querySelector('#modal-confirm [data-close]')?.addEventListener(
      'click',
      () => cleanup(false),
      { once: true },
    );
  });
}

/* ---------- زمان به فارسی ---------- */

export function faTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}

export function faDateLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'امروز';
  if (same(d, yesterday)) return 'دیروز';
  if (Date.now() - ts < 7 * 86400000) return '۷ روز اخیر';
  try {
    return d.toLocaleDateString('fa-IR', { month: 'long', year: 'numeric' });
  } catch {
    return d.toLocaleDateString();
  }
}

/* ---------- کپی ---------- */

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = el('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand?.('copy');
    ta.remove();
    return !!ok;
  }
}

/* ---------- پیام‌ها ---------- */

/**
 * ساخت گرهٔ DOM یک پیام.
 * @param {{id:string, role:'user'|'assistant', content:string, images?:string[], error?:boolean, ts:number, ms?:number}} msg
 * @param {{onRegenerate?:Function, onEdit?:Function, streaming?:boolean}} handlers
 */
export function renderMessage(msg, handlers = {}) {
  const isUser = msg.role === 'user';
  const wrap = el('div', { class: `msg ${isUser ? 'user' : 'bot'}`, 'data-msg-id': msg.id });

  wrap.append(el('div', { class: 'avatar', html: isUser ? ICON.user : ICON.bot }));

  const bubble = el('div', { class: `bubble ${msg.error ? 'error' : ''}` });

  (msg.images || []).forEach((src) => {
    bubble.append(el('img', { class: 'msg-image', src, alt: 'تصویر پیوست' }));
  });

  const body = el('div', { class: 'md' });
  if (msg.error) body.innerHTML = `<strong>⚠️ خطا</strong><br>${renderPlain(msg.content)}`;
  else body.innerHTML = renderMarkdown(msg.content || '');
  bubble.append(body);

  if (msg.content === '' && !msg.error) {
    body.innerHTML = '<span class="thinking"><i></i><i></i><i></i></span>';
  }

  // نوار اطلاعات
  const meta = el('div', { class: 'msg-meta' });
  const bits = [];
  if (msg.ts) bits.push(faTime(msg.ts));
  if (msg.ms) bits.push(`${(msg.ms / 1000).toFixed(1)} ثانیه`);
  if (msg.usage?.total_tokens) bits.push(`${msg.usage.total_tokens} توکن`);
  if (bits.length) meta.append(el('span', { text: bits.join(' • ') }));

  const actions = el('div', { class: 'msg-actions' });
  const copyBtn = el('button', { type: 'button', title: 'کپی', html: `${ICON.copy}<span>کپی</span>` });
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(msg.content || '');
    toast(ok ? 'کپی شد ✅' : 'کپی ناموفق بود', ok ? 'info' : 'error');
  });
  actions.append(copyBtn);

  if (!msg.error && handlers.onRegenerate) {
    const label = isUser ? 'پرسیدن دوباره' : 'پاسخ دوباره';
    const retryBtn = el('button', { type: 'button', title: label, html: `${ICON.retry}<span>${label}</span>` });
    retryBtn.addEventListener('click', () => handlers.onRegenerate(msg));
    actions.append(retryBtn);
  }
  if (isUser && handlers.onEdit) {
    const editBtn = el('button', { type: 'button', title: 'ویرایش', html: `${ICON.pencil}<span>ویرایش</span>` });
    editBtn.addEventListener('click', () => handlers.onEdit(msg));
    actions.append(editBtn);
  }

  meta.append(actions);
  bubble.append(meta);
  wrap.append(bubble);

  wrap._body = body;
  wrap._msg = msg;
  return wrap;
}

/** به‌روزرسانی محتوای یک پیام در حال جریان */
export function updateStreaming(node, text, { done = false } = {}) {
  if (!node) return;
  const body = node._body;
  body.innerHTML = renderMarkdown(text || '');
  if (!done) body.append(el('span', { class: 'caret' }));
}

/* ---------- دکمه‌های کپی داخل کد ---------- */

export function bindCodeCopy(root = document) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest?.('[data-copy-code]');
    if (!btn) return;
    const code = btn.closest('.codeblock')?.querySelector('code')?.innerText || '';
    const ok = await copyText(code);
    btn.textContent = ok ? 'کپی شد ✅' : 'ناموفق';
    setTimeout(() => (btn.textContent = 'کپی'), 1600);
  });
}
