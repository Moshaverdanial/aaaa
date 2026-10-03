/* دال — پوسته: هدر، فوتر، ناوبری موبایل، اعلان‌ها، پالت فرمان، رفتارهای سراسری */
'use strict';
(function () {
  const { html, raw, icon, num, fa, $, $$, on, esc } = Dal;
  const ui = Dal.ui;

  // نوار وضعیت اتصال (اینترنت قطع/وصل)
  (() => {
    let bar = null;
    const show = () => { if (bar) return; bar = document.createElement('div'); bar.className = 'net-bar'; bar.setAttribute('role', 'status'); bar.textContent = 'اینترنت شما قطع است؛ اطلاعات ذخیره‌شده نمایش داده می‌شود.'; document.body.appendChild(bar); };
    const hide = () => { if (!bar) return; bar.remove(); bar = null; Dal.toast('اتصال برقرار شد.', 'success'); };
    window.addEventListener('offline', show); window.addEventListener('online', hide);
    if (navigator.onLine === false) show();
  })();

  // نمایش نرم بخش‌ها هنگام اسکرول (با راه‌ی بازگشت امن: اگر چیزی نمایش داده نشد، بعد از ۲ ثانیه همه دیده می‌شوند)
  ui.reveal = (root) => {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sel = '.sec-head, .cat, .lcard, .city-tile, .focus-card, .step, .tool-tile, .art-card, .cta, .tools-band';
    const els = [...root.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().top > innerHeight * 0.9);
    if (!els.length) return;
    const done = (e) => { e.classList.add('in'); setTimeout(() => e.classList.remove('rv', 'in'), 900); };
    const io = new IntersectionObserver((list) => list.forEach((en) => { if (en.isIntersecting) { done(en.target); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach((e, i) => { e.style.setProperty('--d', (i % 4) * 70 + 'ms'); e.classList.add('rv'); io.observe(e); });
    setTimeout(() => { io.disconnect(); els.forEach((e) => { if (e.classList.contains('rv') && !e.classList.contains('in')) done(e); }); }, 6000);
  };

  const TOOL_LINKS = [
    ['/valuation', 'sparkle', 'برآورد قیمت هوشمند'], ['/market', 'chart', 'تحلیل بازار و قیمت محله‌ها'], ['/tools', 'calc', 'ماشین‌حساب‌های مسکن'],
    ['/compare', 'compare', 'مقایسه‌ی املاک'], ['/requests', 'target', 'تابلوی درخواست ملک'],
    ['/sell', 'home', 'ملکت را به دال بسپار'], ['/want', 'search', 'دنبال ملک می‌گردم'], ['/install', 'zap', 'نصب اپلیکیشن'],
  ];

  ui.renderHeader = function () {
    const u = Dal.state.user; const n = Dal.state.notifs;
    const cmp = Dal.compare.list().length;
    mount($('#header'), html`<div class="container">
      <button class="hbtn burger" id="burger" aria-label="منو">${icon('menu', 22)}</button>
      <a href="#/" class="logo" aria-label="دال"><span class="logo-mark">د</span><span>دال<small>املاک هوشمند</small></span></a>
      <nav class="nav" aria-label="منوی اصلی">
        <a href="#/search?deal=sale" data-nav="sale">خرید</a>
        <a href="#/search?deal=rent" data-nav="rent">رهن و اجاره</a>
        <a href="#/search?deal=presale" data-nav="presale">پیش‌فروش</a>
        <a href="#/agents" data-nav="agents">مشاوران</a>
        <div class="dd"><button class="nav-btn" aria-haspopup="true">ابزارها ${icon('chevd', 16)}</button><div class="dd-menu">${TOOL_LINKS.map(([h, i, t]) => html`<a href="#${h}">${icon(i, 18)} ${t}</a>`)}</div></div>
        <a href="#/book" data-nav="book">دفترچه</a>
        <a href="#/consult" data-nav="consult">مشاوره</a>
        <a href="#/magazine" data-nav="magazine">مجله</a>
      </nav>
      <div class="header-end">
        ${Dal.site().phones[0] ? html`<a class="phone-chip hide-md" href="tel:+98${Dal.site().phones[0].slice(1)}" dir="ltr" title="تماس با مشاوره">${icon('phone', 16)} ${Dal.fmtPhone(Dal.site().phones[0])}</a>` : ''}
        <button class="hbtn hide-sm" id="open-pal" title="جستجوی سریع (Ctrl+K)" aria-label="جستجوی سریع">${icon('search', 20)}</button>
        <button class="hbtn" id="theme-btn" aria-label="تغییر پوسته">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 20)}</button>
        <a class="hbtn hide-sm" href="#/compare" aria-label="مقایسه" title="مقایسه">${icon('compare', 20)}<span class="dot-badge cmp-badge ${cmp ? '' : 'hide'}">${num(cmp)}</span></a>
        ${u ? html`
          <a class="hbtn hide-sm" href="#/dashboard/favorites" aria-label="علاقه‌مندی‌ها">${icon('heart', 20)}</a>
          <div class="dd" id="bell-dd"><button class="hbtn" aria-label="اعلان‌ها" aria-haspopup="true">${icon('bell', 20)}<span class="dot-badge bell-badge ${n?.unread ? '' : 'hide'}">${num(n?.unread || 0)}</span></button><div class="dd-menu notif" id="bell-menu"></div></div>
          <div class="dd"><button class="user-pill" aria-haspopup="true">${Dal.avatar(u, 34)}<span>${u.name.split(' ')[0]}</span></button>
            <div class="dd-menu"><div style="padding:8px 12px"><b>${u.name}</b><div class="muted" style="font-size:12.5px">${{ admin: 'مدیر سیستم', agent: 'مشاور املاک', user: 'کاربر' }[u.role]}</div></div><hr>
              <a href="#/dashboard">${icon('layers', 18)} داشبورد من</a><a href="#/book">${icon('lock', 18)} دفترچه‌ی دال</a>${Dal.isAgent() ? html`<a href="#/deals">${icon('chart', 18)} میزکار معاملات</a><a href="#/my-card">${icon('user', 18)} کارت ویزیت من</a>` : ''}<a href="#/dashboard/listings">${icon('building', 18)} آگهی‌های من</a><a href="#/messages">${icon('msg', 18)} پیام‌ها ${n?.messages ? html`<span class="pill info">${num(n.messages)}</span>` : ''}</a><a href="#/dashboard/profile">${icon('settings', 18)} تنظیمات حساب</a>
              ${u.role === 'admin' ? html`<a href="#/admin">${icon('shield', 18)} پنل مدیریت</a>` : ''}<hr><a href="#" id="logout-btn">${icon('logout', 18)} خروج</a></div></div>`
        : html`<a class="btn ghost hide-sm" href="#/login">ورود</a>`}
        <a class="btn primary hide-sm" href="#/new">${icon('plus', 18)} ثبت آگهی</a>
      </div></div>`);
    ui.renderBell(); ui.highlightNav(Dal.parseHash().path); ui.renderBottomNav();
  };
  const { mount } = Dal;

  ui.renderBell = function () {
    const n = Dal.state.notifs; const b = $('.bell-badge'); const menu = $('#bell-menu');
    if (b) { b.textContent = num(n?.unread || 0); b.classList.toggle('hide', !n?.unread); }
    $$('.dd-menu a[href="#/messages"] .pill').forEach(() => {});
    if (menu) mount(menu, html`<div class="row between" style="padding:8px 12px"><b>اعلان‌ها</b>${n?.unread ? html`<button class="btn sm ghost" id="read-all">خواندن همه</button>` : ''}</div>
      ${n?.items?.length ? n.items.slice(0, 12).map((x) => html`<a class="nitem ${x.read ? '' : 'unread'}" href="${x.link || '#/dashboard'}"><b>${x.title}</b><span>${x.body || ''}</span><span>${Dal.ago(x.created_at)}</span></a>`) : html`<div class="muted center pad">اعلانی وجود ندارد</div>`}`);
  };
  on(document, 'click', '#read-all', async (e) => { e.preventDefault(); await Dal.api('/notifications/read', { method: 'POST' }); Dal.pollNotifs(); });

  ui.updateCompareBadge = function () {
    const c = Dal.compare.list().length; const b = $('.cmp-badge');
    if (b) { b.textContent = num(c); b.classList.toggle('hide', !c); }
    const bar = $('#compare-bar');
    if (c >= 1 && Dal.parseHash().path !== '/compare') { mount(bar, html`<span>${icon('compare', 18)} ${num(c)} ملک برای مقایسه</span><a class="btn primary sm" href="#/compare">مقایسه کن</a><button class="btn sm ghost" id="cmp-clear" style="color:inherit;border-color:#fff4">پاک‌کردن</button>`); bar.classList.add('show'); } else bar.classList.remove('show');
    $$('[data-cmp]').forEach((b2) => b2.classList.toggle('on', Dal.compare.has(+b2.dataset.cmp)));
  };
  on(document, 'click', '#cmp-clear', () => { Dal.compare.clear(); });

  ui.highlightNav = function (path) {
    const { query } = Dal.parseHash();
    $$('.nav a').forEach((a) => {
      const k = a.dataset.nav; a.classList.toggle('on', (path === '/search' && k === (query.deal || 'sale') && ['sale', 'rent', 'presale'].includes(k)) || (k === 'agents' && path.startsWith('/agent')) || (k === 'magazine' && /^\/(magazine|article)/.test(path)) || (k === 'consult' && path === '/consult') || (k === 'book' && path.startsWith('/book')));
    });
    $$('.bottom-nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href').replace('#', '').split('?')[0] === path));
    ui.updateCompareBadge();
  };

  ui.renderBottomNav = function () {
    const u = Dal.state.user;
    mount($('#bottom-nav'), html`<a href="#/">${icon('home', 22)}<span>خانه</span></a><a href="#/search">${icon('search', 22)}<span>جستجو</span></a>
      <a href="#/new" class="add"><span class="c">${icon('plus', 26)}</span></a><a href="#/market">${icon('chart', 22)}<span>بازار</span></a>
      <a href="${u ? '#/dashboard' : '#/login'}">${icon('user', 22)}<span>${u ? 'حساب من' : 'ورود'}</span></a>`);
  };

  ui.renderFooter = function () {
    mount($('#footer'), html`<div class="container"><div class="footer-grid">
      <div><a href="#/" class="logo" style="color:#fff"><span class="logo-mark">د</span><span>دال</span></a><p style="margin-top:14px;line-height:2">پلتفرم فارسی آگهی ملک؛ با جستجوی هوشمند، برآورد قیمت، نقشه‌ی تعاملی، مشاوران تأییدشده و ابزارهای محاسبه‌ی مسکن.</p></div>
      <div><h5>خرید و اجاره</h5><a href="#/search?deal=sale">خرید ملک</a><a href="#/search?deal=rent">رهن و اجاره</a><a href="#/search?deal=presale">پیش‌فروش</a><a href="#/search?view=map">جستجو روی نقشه</a><a href="#/requests">درخواست ملک</a><a href="#/sell">ملکت را بسپار</a><a href="#/city/kangan">املاک بندر کنگان</a><a href="#/city/shiraz">املاک شیراز</a></div>
      <div><h5>ابزارها</h5><a href="#/valuation">برآورد قیمت</a><a href="#/market">تحلیل بازار</a><a href="#/tools">ماشین‌حساب وام و اجاره</a><a href="#/compare">مقایسه‌ی املاک</a></div>
      <div><h5>دال</h5><a href="#/about">درباره‌ی ما</a><a href="#/agents">مشاوران</a><a href="#/magazine">مجله‌ی دال</a><a href="#/new">ثبت آگهی رایگان</a><a href="#/about?faq=1">سؤالات متداول</a><a href="#/install">نصب اپلیکیشن</a></div>
      <div><h5>تماس با مشاوره</h5>${Dal.site().phones.map((p) => html`<a href="tel:+98${p.slice(1)}" dir="ltr" style="text-align:right">${icon('phone', 14)} ${Dal.fmtPhone(p)}</a>`)}<a href="https://wa.me/98${Dal.site().whatsapp.slice(1)}" target="_blank" rel="noopener">واتساپ</a>${Dal.site().bale ? html`<a href="https://ble.ir/${Dal.site().bale}" target="_blank" rel="noopener">بله</a>` : ''}${Dal.site().eitaa ? html`<a href="https://eitaa.com/${Dal.site().eitaa}" target="_blank" rel="noopener">ایتا</a>` : ''}${Dal.site().telegram ? html`<a href="https://t.me/${Dal.site().telegram}" target="_blank" rel="noopener">تلگرام</a>` : ''}<a href="#/consult">${Dal.focusCities().map((c) => c.name).join(' و ')}</a></div></div>
      <div class="copy"><span>© ${new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(new Date())} دال — همه‌ی حقوق محفوظ است.</span><span>ساخته‌شده برای بازار ملک ایران</span></div></div>`);
  };

  // ---- drawer
  function drawer(open) {
    const d = $('#drawer');
    if (open) {
      const u = Dal.state.user;
      mount(d, html`<div class="bg" data-close></div><aside><div class="row between mb"><a href="#/" class="logo"><span class="logo-mark">د</span><span>دال</span></a><button class="hbtn" data-close aria-label="بستن">${icon('x', 20)}</button></div>
        <a href="#/search?deal=sale">${icon('home', 20)} خرید</a><a href="#/search?deal=rent">${icon('key', 20)} رهن و اجاره</a><a href="#/search?deal=presale">${icon('building', 20)} پیش‌فروش</a><a href="#/search?view=map">${icon('map', 20)} نقشه</a><a href="#/agents">${icon('users', 20)} مشاوران</a>
        <div class="divider"></div>${TOOL_LINKS.map(([h, i, t]) => html`<a href="#${h}">${icon(i, 20)} ${t}</a>`)}<div class="divider"></div>
        <a href="#/magazine">${icon('book', 20)} مجله</a><a href="#/about">${icon('info', 20)} درباره‌ی دال</a>
        ${u ? html`<a href="#/dashboard">${icon('user', 20)} داشبورد</a><a href="#/messages">${icon('msg', 20)} پیام‌ها</a><a href="#/book">${icon('lock', 20)} دفترچه‌ی دال</a>${Dal.isAgent() ? html`<a href="#/deals">${icon('chart', 20)} میزکار معاملات</a><a href="#/my-card">${icon('user', 20)} کارت ویزیت من</a>` : ''}` : html`<a href="#/login">${icon('user', 20)} ورود / ثبت‌نام</a>`}
        <a class="btn primary block" href="#/new" style="margin-top:12px;color:#fff">${icon('plus', 18)} ثبت آگهی رایگان</a></aside>`);
      requestAnimationFrame(() => d.classList.add('open'));
    } else { d.classList.remove('open'); }
  }
  on(document, 'click', '#burger', () => drawer(true));
  on(document, 'click', '#drawer [data-close], #drawer a', () => drawer(false));

  // ---- theme / logout
  on(document, 'click', '#theme-btn', () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t; localStorage.setItem('dal_theme', t); ui.renderHeader();
    document.dispatchEvent(new CustomEvent('dal:theme'));
  });
  on(document, 'click', '#logout-btn', (e) => { e.preventDefault(); Dal.logout(); });

  // ---- global fav / compare buttons
  on(document, 'click', '[data-fav]', async (e, btn) => {
    e.preventDefault(); e.stopPropagation();
    if (!Dal.requireLogin('برای ذخیره‌ی آگهی ابتدا وارد شوید.')) return;
    const r = await Dal.guard(() => Dal.api('/favorites/' + btn.dataset.fav, { method: 'POST' }), btn);
    if (r) { $$(`[data-fav="${btn.dataset.fav}"]`).forEach((b) => b.classList.toggle('on', r.fav)); Dal.toast(r.fav ? 'به علاقه‌مندی‌ها اضافه شد ❤️' : 'از علاقه‌مندی‌ها حذف شد.', 'success'); }
  });
  on(document, 'click', '[data-cmp]', (e, btn) => {
    e.preventDefault(); e.stopPropagation();
    const added = Dal.compare.toggle(+btn.dataset.cmp);
    $$(`[data-cmp="${btn.dataset.cmp}"]`).forEach((b) => b.classList.toggle('on', Dal.compare.has(+btn.dataset.cmp)));
    if (added) Dal.toast('به لیست مقایسه افزوده شد.', 'success');
  });

  // ---- back to top
  const fab = $('#fab-top'); fab.innerHTML = icon('chevu', 22).s; fab.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  window.addEventListener('scroll', () => fab.classList.toggle('show', scrollY > 700), { passive: true });

  // ---- command palette (Ctrl/⌘ + K  یا /)
  function palette() {
    const items = [
      ['/', 'home', 'صفحه‌ی اصلی'], ['/search?deal=sale', 'home', 'خرید ملک'], ['/search?deal=rent', 'key', 'رهن و اجاره'], ['/search?deal=presale', 'building', 'پیش‌فروش'], ['/search?view=map', 'map', 'جستجو روی نقشه'],
      ['/valuation', 'sparkle', 'برآورد قیمت ملک'], ['/market', 'chart', 'تحلیل بازار'], ['/tools', 'calc', 'ماشین‌حساب‌ها'], ['/tools?t=convert', 'refresh', 'تبدیل رهن به اجاره'], ['/tools?t=loan', 'dollar', 'ماشین‌حساب وام مسکن'], ['/tools?t=rentbuy', 'trend', 'اجاره یا خرید؟'],
      ['/agents', 'users', 'مشاوران املاک'], ['/magazine', 'book', 'مجله'], ['/requests', 'target', 'درخواست ملک'], ['/compare', 'compare', 'مقایسه‌ی املاک'], ['/new', 'plus', 'ثبت آگهی جدید'], ['/book', 'lock', 'دفترچه‌ی دال'], ['/sell', 'home', 'ملکت را به دال بسپار'], ['/want', 'search', 'دنبال ملک می‌گردم'], ['/install', 'zap', 'نصب اپلیکیشن دال'], ['/city/kangan', 'pin', 'املاک بندر کنگان'], ['/city/shiraz', 'pin', 'املاک شیراز'], ...(Dal.isAgent() ? [['/deals', 'chart', 'میزکار معاملات و درآمد']] : []), ['/dashboard', 'layers', 'داشبورد'], ['/messages', 'msg', 'پیام‌ها'], ['/about', 'info', 'درباره‌ی دال'],
    ];
    const m = Dal.modal(html`<div class="palette"><input id="pal-in" placeholder="کجا بروم؟ یا جمله‌ای بنویسید: «آپارتمان ۲ خوابه در ونک»" autocomplete="off"><div class="pal-list" id="pal-list"></div><p class="muted" style="font-size:12px;margin-top:8px"><span class="kbd">Enter</span> برای باز کردن · <span class="kbd">Esc</span> برای بستن</p></div>`);
    const inp = $('#pal-in', m.body), list = $('#pal-list', m.body); let sel = 0, cur = [];
    const draw = () => {
      const t = Dal.en(inp.value).trim();
      cur = items.filter((i) => !t || i[2].includes(t)).map((i) => ({ href: '#' + i[0], ic: i[1], text: i[2] }));
      if (t.length > 2) cur.unshift({ href: '#/search?smart=' + encodeURIComponent(inp.value), ic: 'sparkle', text: `جستجوی هوشمند: «${inp.value}»` });
      sel = Math.min(sel, Math.max(0, cur.length - 1));
      mount(list, html`${cur.map((c, i) => html`<a href="${c.href}" class="${i === sel ? 'sel' : ''}">${icon(c.ic, 18)} ${c.text}</a>`)}`);
    };
    inp.addEventListener('input', () => { sel = 0; draw(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { sel = (sel + 1) % cur.length; draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = (sel - 1 + cur.length) % cur.length; draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && cur[sel]) { location.hash = cur[sel].href; m.close(); }
    });
    list.addEventListener('click', () => m.close());
    draw(); inp.focus();
  }
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !['input', 'textarea', 'select'].includes(tag))) { e.preventDefault(); palette(); }
  });
  on(document, 'click', '#open-pal', palette);
})();
