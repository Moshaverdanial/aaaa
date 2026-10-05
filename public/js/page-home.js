/* دال — صفحه‌ی اصلی */
'use strict';
(function () {
  const { html, raw, icon, num, dec, fa, $, $$, on, mount, listingCard, priceShort } = Dal;

  const TYPE_SVG = {
    apartment: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7.5h1.5M13.5 7.5H15M9 11.5h1.5M13.5 11.5H15M9 15.5h1.5M13.5 15.5H15M10.5 21v-2.5h3V21"/></svg>',
    villa: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10.5h13V10"/><path d="M10 20.5v-5h4v5"/><path d="M16.5 6V4h2v3.5"/></svg>',
    land: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17.5 8 6l8 3 5 8.5z" /><path d="M8 6v12M16 9v11.5M3 17.5l13-3.5 5 3.5"/></svg>',
    office: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8.5 8V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v2M3 13.5h18M10.5 13.5v2h3v-2"/></svg>',
    shop: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5c0 1.4 1.1 2.5 2.5 2.5S9 10.9 9 9.5c0 1.4 1.1 2.5 3 2.5s3-1.100 3-2.500c0 1.400 1.100 2.500 2.500 2.500S20 10.900 20 9.500"/><path d="M5.5 12v8h13v-8M10 20v-4.5h4V20"/></svg>',
    garden: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21v-6.5"/><path d="M12 14.500c-3.800 0-6.500-2.600-6.500-6 0-3 2.500-5 6.500-5.500 4 .5 6.500 2.500 6.500 5.500 0 3.400-2.700 6-6.500 6z"/><path d="M12 11 9.500 8.500M12 13l3-3"/><path d="M8 21h8"/></svg>',
    penthouse: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 21V8l5-5 5 5v13"/><path d="M4 21h16M10 12h4M10 16h4M12 3V1.500"/><path d="M3 10.500h4M17 10.500h4"/></svg>',
  };
  const CITY_GRAD = { tehran: 'linear-gradient(135deg,#5b3df5,#c86bff)', karaj: 'linear-gradient(135deg,#0ea5e9,#6366f1)', mashhad: 'linear-gradient(135deg,#0d9488,#22c55e)', isfahan: 'linear-gradient(135deg,#f59e0b,#ef4444)', shiraz: 'linear-gradient(135deg,#ec4899,#8b5cf6)', tabriz: 'linear-gradient(135deg,#14b8a6,#3b82f6)', rasht: 'linear-gradient(135deg,#16a34a,#0ea5e9)', kish: 'linear-gradient(135deg,#06b6d4,#3b82f6)', kangan: 'linear-gradient(135deg,#0b7a5a,#12b886)' };
  const EXAMPLES = ['آپارتمان ۲ خوابه در شهرک یاس بندر کنگان زیر ۵ میلیارد', 'اجاره آپارتمان در کنگان با پارکینگ', 'زمین در سیراف', 'آپارتمان در قصردشت شیراز زیر ۱۰ میلیارد', 'رهن و اجاره خانه در شیراز', 'ویلا در صدرا شیراز با استخر'];
  Dal.EXAMPLES = EXAMPLES;

  // جستجوی هوشمند — مشترک بین صفحه‌ها
  Dal.smartGo = async (text, btn) => {
    text = (text || '').trim(); if (!text) return Dal.toast('جمله‌ی جستجو را بنویسید.', 'info');
    const r = await Dal.guard(() => Dal.api('/smart-search', { method: 'POST', body: { q: text } }), btn);
    if (r) Dal.go('/search', { ...r.filters, nl: text });
  };
  Dal.bindSmart = (root) => {
    const form = $('#smart-form', root); if (!form) return;
    const inp = $('input', form);
    form.addEventListener('submit', (e) => { e.preventDefault(); Dal.smartGo(inp.value, $('button[type=submit]', form)); });
    $$('.examples button[data-ex]', root).forEach((b) => b.addEventListener('click', () => { inp.value = b.dataset.ex; inp.focus(); }));
    const mic = $('.mic', form); const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { mic.classList.add('hide'); return; }
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'fa-IR'; rec.interimResults = true; mic.classList.add('rec');
      rec.onresult = (ev) => { inp.value = [...ev.results].map((r) => r[0].transcript).join(' '); };
      rec.onend = () => { mic.classList.remove('rec'); rec = null; if (inp.value.trim()) Dal.smartGo(inp.value); };
      rec.onerror = () => { mic.classList.remove('rec'); rec = null; Dal.toast('تشخیص گفتار در دسترس نیست.', 'error'); };
      rec.start();
    });
  };
  Dal.smartBox = (value = '') => html`<form class="smart-box" id="smart-form" role="search"><span class="ai">${icon('sparkle', 24)}</span><input name="q" value="${value}" placeholder="مثلاً: ۲ خوابه در شهرک یاس کنگان" aria-label="جستجوی هوشمند" autocomplete="off"><button type="button" class="mic" aria-label="جستجوی صوتی" title="جستجوی صوتی">${icon('mic', 20)}</button><button class="btn primary" type="submit">${icon('search', 18)} جستجو</button></form>`;

  function animateCount(el, to) {
    const t0 = performance.now(); const dur = 1200;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = num(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  Dal.pages.home = async (app, _p, _q, alive) => {
    Dal.setTitle('');
    mount(app, html`<section class="hero"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="hero-skyline"></div><div class="container">${Dal.skeletonCards(0)}</div></section>`);
    const [stats, featured, latest, agents, arts, market] = await Promise.all([
      Dal.api('/stats/home'), Dal.api('/listings', { query: { featured: 1, limit: 8 } }), Dal.api('/listings', { query: { limit: 8, sort: 'newest' } }),
      Dal.api('/agents', { query: { sort: 'rating' } }), Dal.api('/articles', { query: { limit: 3 } }), Dal.api('/analytics/market', { query: { city: Dal.defaultCity() } }),
    ]);
    if (!alive()) return;
    const meta = Dal.state.meta; const recent = Dal.recent.list(); const fc = Dal.focusCities();
    const tileCities = meta.cities.filter((c) => !fc.some((f) => f.slug === c.slug)).map((c) => ({ slug: c.slug, name: c.name, n: stats.byCity.find((x) => x.slug === c.slug)?.n || 0 })).filter((c) => c.n > 0);
    const topGrow = market.districts.filter((d) => d.growth12 != null).sort((a, b) => b.growth12 - a.growth12).slice(0, 6);
    mount(app, html`
    <section class="hero"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="hero-skyline"></div><div class="crystal" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="hero-float">
      <div class="hf-card"><span class="hf-ic">${icon('sparkle', 20)}</span><div><b>برآورد قیمت هوشمند</b><small>از روی آگهی‌های واقعی</small></div></div>
      <div class="hf-card"><span class="hf-ic">${icon('map', 20)}</span><div><b>جستجو روی نقشه</b><small>کنگان و شیراز</small></div></div>
      <a class="hf-card hf-call" href="tel:${Dal.site().phones[0] || ''}"><span class="hf-ic">${icon('phone', 20)}</span><div><b>مشاوره‌ی تلفنی</b><small class="ltr">${Dal.site().phones[0] ? Dal.fmtPhone(Dal.site().phones[0]) : ''}</small></div></a>
    </div>
      <div class="container">
        <span class="badge" style="background:rgba(255,255,255,.2);margin-bottom:14px">${icon('sparkle', 14)} جستجوی هوشمند فارسی · بندر کنگان و شیراز</span>
        <h1>خانه‌ی رؤیایی‌ات را <em>با یک جمله</em> پیدا کن</h1>
        <p class="lead">آگهی‌های ملک با برآورد قیمت هوشمند، نقشه‌ی زنده و مشاوران تأییدشده؛ از خرید و رهن و اجاره تا پیش‌فروش و سرمایه‌گذاری.</p>
        <div class="search-card">
          <div class="search-tabs" id="deal-tabs">${['sale', 'rent', 'presale'].map((d, i) => html`<button data-deal="${d}" class="${i === 0 ? 'on' : ''}">${{ sale: 'خرید', rent: 'رهن و اجاره', presale: 'پیش‌فروش' }[d]}</button>`)}</div>
          ${Dal.smartBox()}
          <div class="quick-form" id="quick-form">
            <select id="q-city" aria-label="شهر">${Dal.cityOptions(Dal.defaultCity(), 'همه‌ی شهرها')}</select>
            <select id="q-district" aria-label="محله">${Dal.districtOptions(Dal.defaultCity(), '', 'همه‌ی محله‌ها')}</select>
            <select id="q-type" aria-label="نوع ملک">${Dal.optionList(meta.ptypes, '', 'همه‌ی انواع')}</select>
            <button class="btn accent lg" id="q-go">${icon('search', 18)} نمایش آگهی‌ها</button>
          </div>
          <div class="examples"><span>${icon('zap', 14)} امتحان کنید:</span>${Dal.EXAMPLES.slice(0, 4).map((x) => html`<button type="button" data-ex="${x}">${x}</button>`)}</div>
        </div>
        <div class="hero-stats">${[[stats.listings, 'آگهی فعال'], [stats.agents, 'مشاور'], [stats.closed, 'معامله‌ی ثبت‌شده'], [stats.districts, 'محله‌ی تحت پوشش']].filter(([n]) => n > 0).map(([n, t]) => html`<div><b data-count="${n}">۰</b><span>${t}</span></div>`)}</div>
      </div></section>

    <section class="section tight"><div class="container"><div class="focus-band">
      ${fc.map((c, i) => { const n = stats.byCity.find((x) => x.slug === c.slug)?.n || 0; return html`<div class="focus-card ${i === 0 ? 'k' : 's'}">
        <span class="badge" style="background:rgba(255,255,255,.22);align-self:flex-start">${icon('pin', 14)} ${i === 0 ? 'تمرکز اصلی دال' : 'تمرکز ویژه'}</span>
        <h3>${c.name}</h3><p>${i === 0 ? 'خرید، فروش، رهن و اجاره و سرمایه‌گذاری در محله‌ها و شهرک‌های بندر کنگان؛ با مشاوره‌ی مستقیم.' : 'آگهی و مشاوره‌ی ملک در محله‌های شیراز؛ از قصردشت و معالی‌آباد تا صدرا و گلستان.'}</p>
        <div class="row gap wrap"><a class="btn" href="#/city/${c.slug}">${n ? num(n) + ' آگهی' : 'صفحه‌ی ' + c.name}</a><a class="btn ghost" href="#/sell?city=${c.slug}">${icon('home', 16)} می‌سپارم</a><button class="btn ghost" data-consult="${c.slug}">${icon('phone', 16)} مشاوره</button><a class="btn ghost" href="#/market?city=${c.slug}">${icon('chart', 16)} بازار</a></div></div>`; })}
    </div></div></section>

    ${recent.length ? html`<section class="section tight"><div class="container">${Dal.sectionHead('اخیراً دیده‌اید', 'ادامه‌ی جستجو از همان‌جایی که مانده بودید')}<div class="recent-strip">${recent.map((r) => html`<a class="recent" href="#/listing/${r.id}"><img src="${r.img}" alt="" loading="lazy"><div><b>${r.price.main} ${r.price.unit}</b>${r.title}</div></a>`)}</div></div></section>` : ''}

    <section class="section"><div class="container">
      ${Dal.sectionHead('دسته‌بندی ملک', 'هر نوع ملکی که دنبالش هستید', ['#/search', 'همه‌ی آگهی‌ها'])}
      <div class="cat-grid">${Object.entries(meta.ptypes).map(([k, v]) => html`<a class="cat" href="#/search?ptype=${k}"><div class="ci">${raw(TYPE_SVG[k] || '')}</div><b>${v.split(' / ')[0]}</b><span>${(stats.byType.find((t) => t.ptype === k)?.n || 0) ? num(stats.byType.find((t) => t.ptype === k).n) + ' آگهی' : 'مشاهده'}</span></a>`)}</div>
    </div></section>

    ${featured.items.length ? html`<section class="section tight"><div class="container">
      ${Dal.sectionHead('آگهی‌های ویژه', 'انتخاب‌های برتر دال با مدارک تأییدشده', ['#/search?featured=1', 'مشاهده‌ی همه'])}
      <div class="grid cards">${featured.items.slice(0, 4).map((l) => listingCard(l))}</div>
    </div></section>` : ''}

    ${tileCities.length ? html`<section class="section"><div class="container">
      ${Dal.sectionHead('سایر شهرها', 'آگهی‌ها را بر اساس شهر مرور کنید')}
      <div class="city-grid">${tileCities.map((c) => html`<a class="city-tile" href="#/search?city=${c.slug}" style="--g:${CITY_GRAD[c.slug] || CITY_GRAD.tehran}"><span class="big">${c.name[0]}</span><div><h3>${c.name}</h3><span>${c.n ? num(c.n) + ' آگهی فعال' : 'نخستین آگهی را ثبت کنید'}</span></div></a>`)}</div>
    </div></section>` : ''}

    <section class="section tight"><div class="container"><div class="tools-band">
      <div><span class="badge" style="background:rgba(255,255,255,.2)">${icon('zap', 14)} ابزارهای هوشمند</span><h2 style="font-size:30px;margin:12px 0">قبل از معامله، مطمئن شوید</h2><p style="opacity:.92;margin-bottom:20px">ارزش واقعی ملک را بسنجید، اقساط وام را حساب کنید، رهن را به اجاره تبدیل کنید و روند قیمت محله‌ها را ببینید.</p><a class="btn" style="background:#fff;color:var(--primary)" href="#/valuation">${icon('sparkle', 18)} برآورد قیمت رایگان</a></div>
      <div class="tool-tiles">
        <a class="tool-tile" href="#/valuation">${icon('sparkle', 24)}<b>برآورد قیمت</b><span>ارزش ملک با الگوریتم دال</span></a>
        <a class="tool-tile" href="#/tools?t=loan">${icon('dollar', 24)}<b>وام مسکن</b><span>قسط، سود و جدول بازپرداخت</span></a>
        <a class="tool-tile" href="#/tools?t=convert">${icon('refresh', 24)}<b>تبدیل رهن و اجاره</b><span>ودیعه ⇄ اجاره‌ی ماهانه</span></a>
        <a class="tool-tile" href="#/market">${icon('chart', 24)}<b>تحلیل بازار</b><span>قیمت هر متر و رشد محله‌ها</span></a>
      </div></div></div></section>

    <section class="section"><div class="container">
      ${Dal.sectionHead('تازه‌ترین آگهی‌ها', 'لحظه‌ای به‌روز می‌شود', latest.items.length ? ['#/search?sort=newest', 'مشاهده‌ی همه'] : undefined)}
      ${latest.items.length ? html`<div class="grid cards">${latest.items.map((l) => listingCard(l))}</div>` : Dal.empty('هنوز آگهی‌ای منتشر نشده است', 'اولین آگهی را شما ثبت کنید؛ ثبت آگهی رایگان است و کمتر از ۳ دقیقه طول می‌کشد.', html`<a class="btn primary" href="#/new">${icon('plus', 18)} ثبت اولین آگهی</a>`)}
    </div></section>

    <section class="section tight"><div class="container"><div class="grid g2" style="align-items:stretch">
      <div class="panel" style="margin:0"><h3>${icon('trend', 22)} داغ‌ترین محله‌های ${market.cityName}</h3>${!topGrow.length ? html`<p class="muted mb">روند قیمت محله‌ها از روی آگهی‌ها و معامله‌های ثبت‌شده در خود دال محاسبه می‌شود. به‌محض جمع‌شدن داده‌ی کافی، اینجا نمایش داده می‌شود.</p><a class="link-arrow mt" href="#/market?city=${market.city}">تحلیل بازار ${market.cityName} ${icon('chevl', 16)}</a>` : html`<p class="muted mb">رشد قیمت هر متر مربع در ۱۲ ماه گذشته</p>${Dal.charts.bars(topGrow.map((d) => ({ label: d.name, value: d.growth12, text: '٪' + dec(d.growth12, 1) + '+', color: 'linear-gradient(90deg,#12b886,#5b3df5)' })), { href: (i) => '#/market?city=' + market.city + '&d=' + topGrow.find((x) => x.name === i.label).slug })}<a class="link-arrow mt" href="#/market?city=${market.city}">تحلیل کامل بازار ${icon('chevl', 16)}</a>`}</div>
      <div class="panel" style="margin:0"><h3>${icon('shieldc', 22)} چرا دال؟</h3>
        <ul style="display:grid;gap:14px">${[['sparkle', 'جستجوی هوشمند فارسی', 'فقط بنویسید چه می‌خواهید؛ دال فیلترها را خودش می‌سازد.'], ['shieldc', 'آگهی‌های بررسی‌شده', 'آگهی ناشران تأییدنشده پیش از انتشار توسط مدیران دال بررسی می‌شود.'], ['chart', 'قیمت شفاف', 'مقایسه‌ی قیمت آگهی با ارزش برآوردی و روند محله.'], ['calendar', 'رزرو بازدید آنلاین', 'وقت بازدید را بدون تماس تلفنی رزرو کنید.']].map(([i, t, d]) => html`<li class="row gap" style="align-items:flex-start"><span class="kpi-ic" style="flex:none">${icon(i === 'calendar' ? 'cal' : i, 22)}</span><div><b>${t}</b><div class="muted" style="font-size:14px">${d}</div></div></li>`)}</ul></div>
    </div></div></section>

    ${agents.items.length ? html`<section class="section"><div class="container">
      ${Dal.sectionHead('مشاوران', 'مشاوران املاک ثبت‌شده در دال', ['#/agents', 'همه‌ی مشاوران'])}
      <div class="grid g3">${agents.items.slice(0, 3).map((a) => Dal.agentCard(a))}</div>
    </div></section>` : ''}

    <section class="section tight"><div class="container">
      ${Dal.sectionHead('سه قدم تا خانه‌ی جدید', '')}
      <div class="steps">
        <div class="step"><div class="si">${icon('search', 26)}</div><h3>جستجو کنید</h3><p class="muted">با جمله‌ی فارسی یا فیلترهای دقیق و نقشه، ملک مناسب را پیدا کنید.</p></div>
        <div class="step"><div class="si">${icon('cal', 26)}</div><h3>بازدید رزرو کنید</h3><p class="muted">از تقویم شمسی مشاور، زمان بازدید را انتخاب کنید یا چت کنید.</p></div>
        <div class="step"><div class="si">${icon('key', 26)}</div><h3>با خیال راحت معامله کنید</h3><p class="muted">قیمت را با برآورد دال بسنجید و قرارداد را با مشاور تأییدشده ببندید.</p></div>
      </div></div></section>

    ${arts.items.length ? html`<section class="section"><div class="container">
      ${Dal.sectionHead('مجله‌ی دال', 'راهنمای خرید، بازار و حقوق ملک', ['#/magazine', 'همه‌ی مطالب'])}
      <div class="grid g3">${arts.items.map((a) => Dal.articleCard(a))}</div>
    </div></section>` : ''}

    <section class="section tight"><div class="container"><div class="cta"><div><h2 style="font-size:30px">ملک دارید؟ رایگان آگهی کنید</h2><p style="opacity:.85;margin-top:6px">در کمتر از ۳ دقیقه آگهی بسازید و به خریداران و مستأجران برسید.</p></div><a class="btn accent lg" href="#/new">${icon('plus', 20)} ثبت آگهی رایگان</a></div></div></section>`);

    $$('[data-count]', app).forEach((el) => animateCount(el, +el.dataset.count));
    Dal.bindSmart(app);
    let deal = 'sale';
    on($('#deal-tabs', app), 'click', 'button', (e, b) => { deal = b.dataset.deal; $$('#deal-tabs button', app).forEach((x) => x.classList.toggle('on', x === b)); });
    const city = $('#q-city', app), dist = $('#q-district', app);
    city.addEventListener('change', () => mount(dist, Dal.districtOptions(city.value, '', 'همه‌ی محله‌ها')));
    $('#q-go', app).addEventListener('click', () => Dal.go('/search', { deal, city: city.value, district: dist.value, ptype: $('#q-type', app).value }));
  };

  Dal.articleCard = (a) => html`<a class="art-card" href="#/article/${a.slug}"><div class="art-cover" style="--h:${a.hue}" data-g="د"><span class="badge" style="background:rgba(255,255,255,.25)">${a.category}</span></div><div class="art-body"><h3>${a.title}</h3><p>${a.excerpt}</p><div class="muted mt" style="font-size:12.5px">${icon('clock', 14)} ${num(a.read_min)} دقیقه مطالعه · ${Dal.dateFa(a.created_at)}</div></div></a>`;
})();
