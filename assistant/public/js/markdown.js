/* =========================================================
   markdown.js — رندر مارک‌داون کوچک و امن (بدون وابستگی)
   همهٔ ورودی ابتدا escape می‌شود، پس HTML خام هرگز اجرا نمی‌شود.
   ========================================================= */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

const KEYWORD_LIST =
  'const|let|var|function|return|if|else|elif|for|while|import|from|export|default|class|extends|new|await|async|try|catch|finally|throw|switch|case|break|continue|def|lambda|print|echo|in|is|not|and|or|None|True|False|true|false|null|undefined|this|self|typeof|instanceof|public|private|static|void|int|float|double|string|bool|struct|interface|type|package|func|select|do|done|fi|then|end|with|as|yield|del|pass|raise|except';

/**
 * رنگ‌آمیزی سادهٔ کد — در یک پاس انجام می‌شود و هر بخش را جداگانه escape می‌کند،
 * بنابراین هیچ‌وقت متن معمولی به تگ HTML تبدیل نمی‌شود.
 */
const CODE_TOKEN = new RegExp(
  [
    '(\\/\\*[\\s\\S]*?(?:\\*\\/|$))', // 1) توضیح چندخطی
    '(\\/\\/[^\\n]*)', //                2) توضیح //
    '((?:^|\\s)#[^\\n]*)', //            3) توضیح # (بش/پایتون/یامل)
    '("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)', // 4) رشته
    '\\b(0x[\\da-fA-F]+|\\d+(?:\\.\\d+)?)\\b', // 5) عدد
    `\\b(${KEYWORD_LIST})\\b`, //          6) کلیدواژه
    '([A-Za-z_$][\\w$]*)(?=\\()', //       7) نام تابع
  ].join('|'),
  'g',
);

function classOf(match) {
  if (match[1] || match[2] || match[3]) return 'tk-com';
  if (match[4]) return 'tk-str';
  if (match[5]) return 'tk-num';
  if (match[6]) return 'tk-kw';
  return 'tk-fn';
}

function highlight(code) {
  let out = '';
  let last = 0;
  let m;
  CODE_TOKEN.lastIndex = 0;
  while ((m = CODE_TOKEN.exec(code)) !== null) {
    if (m[0].length === 0) {
      CODE_TOKEN.lastIndex++;
      continue;
    }
    out += escapeHtml(code.slice(last, m.index));
    out += `<span class="${classOf(m)}">${escapeHtml(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

/** قالب‌دهی متن داخل یک خط (کد، بولد، ایتالیک، لینک) */
function inline(text) {
  const codes = [];
  // جای‌نگهدارها از ناحیهٔ Private-Use یونیکد انتخاب می‌شوند تا با اعداد/حروف تداخل نکنند
  const placeholder = (i) => String.fromCharCode(0xe000 + i);
  let s = escapeHtml(text);

  s = s.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code class="inline">${code}</code>`);
    return placeholder(codes.length - 1);
  });

  s = s
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // لینک [متن](آدرس)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const safe = /^(https?:|mailto:|\/|#)/i.test(href) ? href : '#';
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // آدرس برهنه
  s = s.replace(/(^|[\s>])((?:https?:\/\/)[^\s<]+[^\s<.,;:!?")\]])/g, (m, pre, url) => {
    if (m.includes('<a ')) return m;
    return `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  s = s.replace(/[\uE000-\uF8FF]/g, (ch) => codes[ch.charCodeAt(0) - 0xe000] ?? '');
  return s;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes('-');
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function renderList(lines, start, ordered) {
  const items = [];
  let i = start;
  const bullet = ordered ? /^(\s*)(\d+)[.)]\s+(.*)$/ : /^(\s*)[-*+]\s+(.*)$/;

  while (i < lines.length) {
    const line = lines[i];
    const m = ordered ? line.match(bullet) : line.match(bullet);
    if (!m) {
      // خط خالی بین آیتم‌ها → پایان فهرست
      if (!line.trim()) {
        const next = lines[i + 1];
        if (next && (ordered ? /^\s*\d+[.)]\s+/.test(next) : /^\s*[-*+]\s+/.test(next))) {
          i++;
          continue;
        }
      }
      break;
    }
    const text = ordered ? m[3] : m[2];
    i++;

    // زیرفهرست‌ها (خطوط تورفتهٔ بعدی)
    const children = [];
    while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
      children.push(lines[i].replace(/^\s{2,}/, ''));
      i++;
    }
    let html = `<li>${inline(text)}`;
    if (children.length) html += renderMarkdown(children.join('\n'), true);
    html += '</li>';
    items.push(html);
  }

  const tag = ordered ? 'ol' : 'ul';
  return { html: `<${tag}>${items.join('')}</${tag}>`, next: i };
}

/**
 * تبدیل مارک‌داون به HTML.
 * @param {string} src
 * @param {boolean} nested  (داخل <li> فراخوانی می‌شود)
 */
export function renderMarkdown(src = '', nested = false) {
  const text = String(src).replace(/\r\n?/g, '\n');

  // ۱) بیرون کشیدن بلوک‌های کد
  const codeBlocks = [];
  const withoutCode = text.replace(/```([\w+-]*)\n?([\s\S]*?)(?:```|$)/g, (_, lang, code) => {
    codeBlocks.push({ lang: (lang || '').trim(), code: code.replace(/\n$/, '') });
    return `\n\u0002CODE${codeBlocks.length - 1}\u0002\n`;
  });

  const lines = withoutCode.split('\n');
  const out = [];
  let i = 0;
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
    paragraph = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // جای‌نگهدار کد
    const codeMatch = trimmed.match(/^\u0002CODE(\d+)\u0002$/);
    if (codeMatch) {
      flushParagraph();
      const block = codeBlocks[Number(codeMatch[1])];
      const langLabel = block.lang || 'text';
      out.push(
        `<div class="codeblock"><div class="codeblock-head"><span class="lang">${escapeHtml(
          langLabel,
        )}</span><button type="button" data-copy-code>کپی</button></div><pre><code>${highlight(
          block.code,
        )}</code></pre></div>`,
      );
      i++;
      continue;
    }

    // خط خالی
    if (!trimmed) {
      flushParagraph();
      i++;
      continue;
    }

    // خط جداکننده
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      out.push('<hr>');
      i++;
      continue;
    }

    // عنوان
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // نقل‌قول
    if (trimmed.startsWith('>')) {
      flushParagraph();
      const quote = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(quote.join('\n'), true)}</blockquote>`);
      continue;
    }

    // جدول
    if (trimmed.includes('|') && lines[i + 1] && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      const header = splitRow(trimmed);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // فهرست بی‌ترتیب
    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      const res = renderList(lines, i, false);
      out.push(res.html);
      i = res.next;
      continue;
    }

    // فهرست ترتیبی
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushParagraph();
      const res = renderList(lines, i, true);
      out.push(res.html);
      i = res.next;
      continue;
    }

    paragraph.push(trimmed);
    i++;
  }

  flushParagraph();
  return out.join('\n');
}

/** تبدیل متن ساده به HTML (برای پیام خطا و مانند آن) */
export function renderPlain(text = '') {
  return escapeHtml(text).replace(/\n/g, '<br>');
}
