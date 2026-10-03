/* دال — کامپوننت‌های مشترک: کارت آگهی، نمودارها، گالری، صفحه‌بندی و ... */
'use strict';
(function () {
  const { html, raw, icon, num, dec, fa, priceShort, priceWords, listingPrice, ago, esc, $, $$ } = Dal;

  // ---------------------------------------------------------------- badges & cards
  const stars = (r, size = 16) => { const full = Math.round((r || 0) * 2) / 2; return raw(`<span class="stars" title="${r || 0} از ۵">${[1, 2, 3, 4, 5].map((i) => `<span class="star ${full >= i ? 'on' : full >= i - 0.5 ? 'half' : ''}">${icon('star', size).s}</span>`).join('')}</span>`); };
  Dal.stars = stars;
  const avatar = (u, size = 40) => raw(`<span class="avatar" style="--h:${u.hue ?? 200};width:${size}px;height:${size}px;font-size:${size * 0.42}px">${esc((u.name || '؟').trim()[0])}</span>`);
  Dal.avatar = avatar;
  const dealClass = { sale: 'sale', rent: 'rent', presale: 'presale', swap: 'swap' };

  function listingCard(l, { layout = 'grid', mine = false } = {}) {
    const p = listingPrice(l);
    const inCmp = Dal.compare.has(l.id);
    const img = l.images[0] || '';
    const meta = [
      l.area ? html`<span title="متراژ">${icon('ruler', 16)}${num(l.area)} متر</span>` : '',
      l.rooms ? html`<span title="اتاق خواب">${icon('bed', 16)}${num(l.rooms)} خواب</span>` : '',
      l.baths && l.rooms ? html`<span title="سرویس">${icon('bath', 16)}${num(l.baths)}</span>` : '',
      l.parking ? html`<span title="پارکینگ">${icon('car', 16)}</span>` : '',
    ];
    return html`<article class="lcard ${layout}" data-id="${l.id}">
      <a class="lcard-img" href="#/listing/${l.id}" aria-label="${l.title}">
        <img src="${img}" alt="${l.title}" loading="lazy" decoding="async">
        <div class="lcard-badges">
          <span class="badge deal ${dealClass[l.deal]}">${Dal.dealName(l.deal)}</span>
          ${l.featured ? html`<span class="badge gold">${icon('sparkle', 13)} ویژه</span>` : ''}
          ${l.verified ? html`<span class="badge green" title="مدارک تأیید شده">${icon('shieldc', 13)} تأییدشده</span>` : ''}
          ${l.status !== 'active' ? html`<span class="badge gray">${{ sold: 'فروخته شد', rented: 'اجاره رفت', pending: 'در انتظار تأیید', rejected: 'ردشده', archived: 'بایگانی' }[l.status]}</span>` : ''}
        </div>
        <span class="lcard-count">${icon('image', 14)} ${num(l.images.length)}</span>
      </a>
      <div class="lcard-actions">
        <button class="icon-btn fav ${l.fav ? 'on' : ''}" data-fav="${l.id}" aria-label="ذخیره" title="ذخیره در علاقه‌مندی‌ها">${icon('heart', 18)}</button>
        <button class="icon-btn cmp ${inCmp ? 'on' : ''}" data-cmp="${l.id}" aria-label="مقایسه" title="افزودن به مقایسه">${icon('compare', 18)}</button>
      </div>
      <div class="lcard-body">
        <div class="lcard-price"><b>${p.main}</b> <small>${p.unit}</small></div>
        ${p.sub ? html`<div class="lcard-sub">${p.sub}</div>` : ''}
        <h3 class="lcard-title"><a href="#/listing/${l.id}">${l.title}</a></h3>
        <div class="lcard-loc">${icon('pin', 15)} ${l.cityName}، ${l.districtName}</div>
        <div class="lcard-meta">${meta}</div>
        <div class="lcard-foot"><span class="muted">${Dal.ptypeName(l.ptype).split(' / ')[0]}${l.year_built ? ` · ${fa(l.year_built)}` : ''}</span><span class="muted">${ago(l.created_at)}</span></div>
      </div>
    </article>`;
  }
  Dal.listingCard = listingCard;

  Dal.mapPopup = (l) => `<a class="map-pop" href="#/listing/${l.id}"><img src="${esc(l.img || '')}" alt=""><div><b>${esc(Dal.listingPrice(l).main)} ${esc(Dal.listingPrice(l).unit)}</b><span>${esc(l.districtName)} · ${num(l.area)} متر${l.rooms ? ' · ' + num(l.rooms) + ' خواب' : ''}</span></div></a>`;

  const pager = (page, pages, hrefFn) => {
    if (pages <= 1) return '';
    const set = new Set([1, pages, page, page - 1, page + 1, page - 2, page + 2].filter((p) => p >= 1 && p <= pages));
    const arr = [...set].sort((a, b) => a - b); const out = []; let prev = 0;
    for (const p of arr) { if (p - prev > 1) out.push(html`<span class="pg gap">…</span>`); out.push(html`<a class="pg ${p === page ? 'on' : ''}" href="${hrefFn(p)}" data-page="${p}">${fa(p)}</a>`); prev = p; }
    return html`<nav class="pager" aria-label="صفحه‌بندی">${page > 1 ? html`<a class="pg" href="${hrefFn(page - 1)}" data-page="${page - 1}" aria-label="قبلی">${icon('chevr', 18)}</a>` : ''}${out}${page < pages ? html`<a class="pg" href="${hrefFn(page + 1)}" data-page="${page + 1}" aria-label="بعدی">${icon('chevl', 18)}</a>` : ''}</nav>`;
  };
  Dal.pager = pager;

  Dal.empty = (title, text, action = '') => html`<div class="empty">${icon('search', 44)}<h3>${title}</h3><p>${text}</p>${action}</div>`;
  Dal.sectionHead = (title, sub, link) => html`<div class="sec-head"><div><h2>${title}</h2>${sub ? html`<p>${sub}</p>` : ''}</div>${link ? html`<a class="link-arrow" href="${link[0]}">${link[1]} ${icon('chevl', 16)}</a>` : ''}</div>`;
  Dal.scoreColor = (v) => (v >= 80 ? 'var(--ok)' : v >= 60 ? 'var(--warn)' : 'var(--bad)');

  // ---------------------------------------------------------------- charts
  const NS = 'http://www.w3.org/2000/svg';
  Dal.charts.line = function (el, data, { height = 240, color = 'var(--primary)', fmt = priceShort, xfmt = (x) => x, ticks = 5, area = true, unit = '' } = {}) {
    if (!data.length) { el.innerHTML = '<div class="muted center pad">داده‌ای موجود نیست</div>'; return; }
    const W = 640, H = height, m = { l: 12, r: 12, t: 16, b: 28 };
    const ys = data.map((d) => d.y); let min = Math.min(...ys), max = Math.max(...ys); const pad = (max - min || max * 0.1 || 1) * 0.15; min -= pad; max += pad;
    const X = (i) => m.l + (data.length === 1 ? (W - m.l - m.r) / 2 : (i / (data.length - 1)) * (W - m.l - m.r));
    const Y = (v) => m.t + (1 - (v - min) / (max - min)) * (H - m.t - m.b);
    const pts = data.map((d, i) => [X(i), Y(d.y)]);
    // منحنی نرم
    let path = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const cx = (x0 + x1) / 2; path += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; }
    const gid = 'g' + Math.random().toString(36).slice(2, 7);
    const grid = Array.from({ length: ticks }, (_, i) => { const v = min + ((max - min) * i) / (ticks - 1); const y = Y(v); return `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" class="gl"/>`; }).join('');
    const lbl = [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => `<text x="${X(i)}" y="${H - 8}" class="ax" text-anchor="middle">${esc(xfmt(data[i].x))}</text>`).join('');
    el.classList.add('chart'); el.style.position = 'relative';
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="svg-line" role="img"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}${area ? `<path d="${path} L${pts[pts.length - 1][0]},${H - m.b} L${pts[0][0]},${H - m.b}Z" fill="url(#${gid})"/>` : ''}<path d="${path}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${lbl}<g class="hov" style="display:none"><line class="hv" y1="${m.t}" y2="${H - m.b}"/><circle r="5.5" fill="var(--surface)" stroke="${color}" stroke-width="3"/></g></svg><div class="tip" style="display:none"></div>`;
    const svg = $('svg', el), g = $('.hov', el), tip = $('.tip', el), dot = $('circle', g), vl = $('.hv', g);
    const move = (ev) => {
      const r = svg.getBoundingClientRect(); const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left; const rel = (cx / r.width) * W;
      let best = 0, bd = 1e9; pts.forEach((p, i) => { const d = Math.abs(p[0] - rel); if (d < bd) { bd = d; best = i; } });
      g.style.display = ''; dot.setAttribute('cx', pts[best][0]); dot.setAttribute('cy', pts[best][1]); vl.setAttribute('x1', pts[best][0]); vl.setAttribute('x2', pts[best][0]);
      tip.style.display = 'block'; tip.innerHTML = `<b>${esc(fmt(data[best].y))} ${unit}</b><span>${esc(xfmt(data[best].x, true))}</span>`;
      const left = Math.min(Math.max((pts[best][0] / W) * r.width, 60), r.width - 60); tip.style.left = left + 'px'; tip.style.top = Math.max(0, (pts[best][1] / H) * r.height - 54) + 'px';
    };
    svg.addEventListener('mousemove', move); svg.addEventListener('touchmove', move, { passive: true });
    svg.addEventListener('mouseleave', () => { g.style.display = 'none'; tip.style.display = 'none'; });
  };

  Dal.charts.bars = function (items, { fmt = priceShort, max, color = 'var(--primary)', href } = {}) {
    const mx = max || Math.max(...items.map((i) => Math.abs(i.value)), 1);
    return raw(`<div class="bars">${items.map((i) => `<${href ? 'a' : 'div'} class="bar-row" ${href ? `href="${href(i)}"` : ''}><span class="bar-l">${esc(i.label)}</span><span class="bar-t"><span class="bar-f" style="width:${Math.max(2, (Math.abs(i.value) / mx) * 100)}%;background:${i.color || color}"></span></span><span class="bar-v">${esc(i.text ?? fmt(i.value))}</span></${href ? 'a' : 'div'}>`).join('')}</div>`);
  };

  Dal.charts.radar = function (axes, { size = 280, color = 'var(--primary)' } = {}) {
    const c = size / 2, R = size / 2 - 44, n = axes.length;
    const P = (i, v) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v]; };
    const rings = [0.25, 0.5, 0.75, 1].map((k) => `<polygon points="${axes.map((_, i) => P(i, k).join(',')).join(' ')}" class="rg"/>`).join('');
    const spokes = axes.map((_, i) => { const p = P(i, 1); return `<line x1="${c}" y1="${c}" x2="${p[0]}" y2="${p[1]}" class="rg"/>`; }).join('');
    const poly = axes.map((a, i) => P(i, a.value / 100).join(',')).join(' ');
    const labels = axes.map((a, i) => { const p = P(i, 1.2); return `<text x="${p[0]}" y="${p[1]}" text-anchor="middle" dominant-baseline="middle" class="ax">${esc(a.label)} <tspan font-weight="700" fill="var(--text)">${fa(a.value)}</tspan></text>`; }).join('');
    return raw(`<svg viewBox="0 0 ${size} ${size}" class="radar" role="img">${rings}${spokes}<polygon points="${poly}" fill="${color}" fill-opacity=".22" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/>${axes.map((a, i) => { const p = P(i, a.value / 100); return `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${color}"/>`; }).join('')}${labels}</svg>`);
  };

  Dal.charts.donut = function (items, { size = 160, label = '' } = {}) {
    const total = items.reduce((s, i) => s + i.value, 0) || 1; const r = size / 2 - 14, c = size / 2, C = 2 * Math.PI * r; let off = 0;
    const colors = ['#5b3df5', '#ff7a3d', '#12b886', '#f59f00', '#e64980', '#339af0', '#868e96'];
    const segs = items.map((i, k) => { const len = (i.value / total) * C; const s = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${i.color || colors[k % colors.length]}" stroke-width="22" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${c} ${c})"/>`; off += len; return s; }).join('');
    return raw(`<div class="donut"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--line)" stroke-width="22"/>${segs}<text x="${c}" y="${c - 2}" text-anchor="middle" class="dn">${fa(total)}</text><text x="${c}" y="${c + 16}" text-anchor="middle" class="ax">${esc(label)}</text></svg><ul class="legend">${items.map((i, k) => `<li><i style="background:${i.color || colors[k % colors.length]}"></i>${esc(i.label)}<b>${fa(i.value)}</b></li>`).join('')}</ul></div>`);
  };

  Dal.charts.spark = (vals, color = 'var(--primary)', w = 120, h = 36) => {
    if (vals.length < 2) return raw('');
    const mn = Math.min(...vals), mx = Math.max(...vals), X = (i) => (i / (vals.length - 1)) * w, Y = (v) => h - 3 - ((v - mn) / (mx - mn || 1)) * (h - 6);
    return raw(`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="spark"><polyline points="${vals.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`);
  };

  Dal.charts.columns = (data, { height = 160, color = 'var(--primary)', fmt = num } = {}) => {
    const mx = Math.max(...data.map((d) => d.y), 1);
    return raw(`<div class="cols" style="height:${height}px">${data.map((d) => `<div class="ccol" title="${esc(d.x)}: ${esc(fmt(d.y))}"><span class="col-v">${esc(fmt(d.y))}</span><i style="height:${Math.max(3, (d.y / mx) * 100)}%;background:${color}"></i><em>${esc(d.x)}</em></div>`).join('')}</div>`);
  };

  // ---------------------------------------------------------------- gallery + lightbox
  Dal.lightbox = function (images, start = 0) {
    let i = start;
    const m = Dal.modal(html`<div class="lb"><button class="lb-nav prev" aria-label="قبلی">${icon('chevr', 28)}</button><img alt=""><button class="lb-nav next" aria-label="بعدی">${icon('chevl', 28)}</button><div class="lb-count"></div></div>`, { wide: true });
    m.el.classList.add('dark-modal');
    const img = $('img', m.body), cnt = $('.lb-count', m.body);
    const show = (k) => { i = (k + images.length) % images.length; img.src = images[i]; cnt.textContent = `${fa(i + 1)} / ${fa(images.length)}`; };
    $('.prev', m.body).onclick = () => show(i - 1); $('.next', m.body).onclick = () => show(i + 1); show(i);
    const key = (e) => { if (!document.body.contains(m.el)) return document.removeEventListener('keydown', key); if (e.key === 'ArrowRight') show(i - 1); if (e.key === 'ArrowLeft') show(i + 1); };
    document.addEventListener('keydown', key);
  };

  // ---------------------------------------------------------------- leaflet helpers
  Dal.loadLeaflet = (() => {
    let p;
    return () => p || (p = new Promise((res, rej) => {
      if (window.L) return res(window.L);
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/vendor/leaflet/leaflet.css';
      const cssReady = new Promise((r) => { l.onload = l.onerror = r; setTimeout(r, 4000); }); document.head.appendChild(l);
      const s = document.createElement('script'); s.src = '/vendor/leaflet/leaflet.js'; s.onload = () => { window.L.Icon.Default.imagePath = '/vendor/leaflet/images/'; cssReady.then(() => res(window.L)); }; s.onerror = rej; document.head.appendChild(s);
    }));
  })();
  Dal.makeMap = async (el, { center, zoom = 12, scroll = false } = {}) => {
    const L = await Dal.loadLeaflet();
    const map = L.map(el, { center, zoom, scrollWheelZoom: scroll, zoomControl: true, attributionControl: true });
    const dark = document.documentElement.dataset.theme === 'dark';
    // کاشی‌ها از خود سرور دال می‌آیند (کش دیسکی)؛ مرورگر به سرور نقشه‌ی خارجی وصل نمی‌شود
    const layer = L.tileLayer(`/tiles/${dark ? 'dark' : 'light'}/{z}/{x}/{y}.png`, { maxZoom: 18, attribution: '© OpenStreetMap', crossOrigin: false }).addTo(map);
    let ok = 0, bad = 0, notified = false;
    layer.on('tileload', () => { ok++; });
    layer.on('tileerror', () => {
      bad++;
      if (!notified && !ok && bad >= 4) {
        notified = true; el.classList.add('map-offline');
        const n = document.createElement('div'); n.className = 'map-note'; n.textContent = 'تصویر پس‌زمینه‌ی نقشه در دسترس نیست؛ موقعیت‌ها همچنان نمایش داده می‌شوند.';
        el.appendChild(n);
        layer.on('tileload', () => { el.classList.remove('map-offline'); n.remove(); });
      }
    });
    el.classList.add('leaflet-rtl-fix');
    setTimeout(() => map.invalidateSize(), 200);
    return map;
  };
  Dal.pricePin = (L, text, cls = '') => L.divIcon({ className: 'pin-wrap', html: `<span class="price-pin ${cls}">${esc(text)}</span>`, iconSize: [0, 0], iconAnchor: [0, 0] });

  // ---------------------------------------------------------------- misc UI parts
  Dal.rangeInput = (name, label, val, hintFn) => html`<label class="fld"><span>${label}</span><input inputmode="numeric" name="${name}" value="${val ?? ''}" placeholder="—" autocomplete="off" data-money><small class="hint" data-hint-for="${name}"></small></label>`;
  Dal.bindMoney = (root) => {
    $$('[data-money]', root).forEach((inp) => {
      const hint = $(`[data-hint-for="${inp.name}"]`, root);
      const upd = () => {
        const raw0 = Dal.en(inp.value).replace(/[^\d]/g, '');
        const pos = inp.selectionStart; inp.value = raw0 ? num(raw0) : '';
        if (hint) hint.textContent = raw0 ? priceWords(raw0) : '';
        try { inp.setSelectionRange(pos, pos); } catch { /* ignore */ }
      };
      inp.addEventListener('input', upd); upd();
    });
  };
  Dal.moneyVal = (inp) => { const v = Dal.en(inp.value).replace(/[^\d.]/g, ''); return v ? Math.round(Number(v)) : 0; };

  Dal.agentCard = (a, compact = false) => html`<a class="acard" href="#/agent/${a.id}">
    ${avatar(a, compact ? 52 : 72)}
    <div class="acard-main"><h4>${a.name} ${a.verified ? html`<span class="vb" title="مشاور تأییدشده">${icon('shieldc', 16)}</span>` : ''}</h4>
    <div class="muted">${a.agency || 'مشاور مستقل'}</div>
    <div class="acard-rate">${stars(a.rating, 14)} <b>${a.rating ? dec(a.rating, 1) : 'جدید'}</b> <span class="muted">(${num(a.reviews || 0)} نظر)</span></div>
    ${compact ? '' : html`<div class="chips">${(a.specialties || []).slice(0, 2).map((s) => html`<span class="chip sm">${s}</span>`)}</div>`}</div>
    <div class="acard-stats"><div><b>${num(a.active || 0)}</b><span>آگهی فعال</span></div><div><b>${num(a.experience || 0)}</b><span>سال تجربه</span></div></div>
  </a>`;

  // share
  Dal.share = async (title, url = location.href) => {
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch { /* cancelled */ } }
    const enc = encodeURIComponent;
    const m = Dal.modal(html`<div class="share-grid">
      <a class="share-item" target="_blank" rel="noopener" href="https://t.me/share/url?url=${enc(url)}&text=${enc(title)}">تلگرام</a>
      <a class="share-item" target="_blank" rel="noopener" href="https://wa.me/?text=${enc(title + ' ' + url)}">واتس‌اپ</a>
      <a class="share-item" href="sms:?body=${enc(title + ' ' + url)}">پیامک</a>
      <a class="share-item" href="mailto:?subject=${enc(title)}&body=${enc(url)}">ایمیل</a></div>
      <div class="copy-row"><input readonly value="${url}" dir="ltr"><button class="btn primary" id="cp">${icon('copy', 16)} کپی</button></div>`, { title: 'اشتراک‌گذاری' });
    $('#cp', m.body).onclick = async () => { try { await navigator.clipboard.writeText(url); Dal.toast('پیوند کپی شد.', 'success'); } catch { $('input', m.body).select(); } };
  };

  Dal.accordion = (items) => html`<div class="acc">${items.map(([q, a], i) => html`<details ${i === 0 ? 'open' : ''}><summary>${q}${icon('chevd', 18)}</summary><div>${a}</div></details>`)}</div>`;

  Dal.tabs = (items, cur, attr = 'data-tab') => html`<div class="tabs" role="tablist">${items.map(([k, label, ic, badge]) => html`<button role="tab" class="tab ${k === cur ? 'on' : ''}" ${raw(attr)}="${k}" aria-selected="${k === cur}">${ic ? icon(ic, 17) : ''}<span>${label}</span>${badge ? html`<em>${num(badge)}</em>` : ''}</button>`)}</div>`;

  Dal.kpi = (label, value, sub = '', ic = 'chart', tone = '') => html`<div class="kpi ${tone}"><span class="kpi-ic">${icon(ic, 22)}</span><div><div class="kpi-v">${value}</div><div class="kpi-l">${label}</div>${sub ? html`<div class="kpi-s">${sub}</div>` : ''}</div></div>`;
})();
