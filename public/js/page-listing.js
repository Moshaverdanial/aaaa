/* دال — صفحه‌ی جزئیات آگهی */
'use strict';
(function () {
  const { html, raw, icon, num, dec, fa, $, $$, on, mount, listingCard, priceShort, priceWords, listingPrice, dateFa } = Dal;

  const REPORT_REASONS = ['اطلاعات نادرست یا گمراه‌کننده', 'قیمت غیرواقعی', 'ملک فروخته/اجاره داده شده', 'آگهی تکراری', 'محتوای نامناسب', 'کلاهبرداری یا مشکوک'];
  const STATUS_LABEL = { active: 'منتشرشده', pending: 'در انتظار تأیید', rejected: 'ردشده', sold: 'فروخته‌شده', rented: 'اجاره‌رفته', archived: 'بایگانی' };

  Dal.pages.listing = async (app, { id }, _q, alive) => {
    mount(app, html`<div class="container section">${Dal.skeletonCards(3)}</div>`);
    let d;
    try { d = await Dal.api('/listings/' + id); } catch (e) { mount(app, html`<div class="container section">${Dal.empty('آگهی پیدا نشد', e.message, html`<a class="btn primary" href="#/search">جستجوی آگهی‌ها</a>`)}</div>`); return; }
    if (!alive()) return;
    const { listing: l, owner, similar, history, neighborhood: nb, market, canEdit } = d;
    Dal.setTitle(l.title); if (l.status === 'active') Dal.recent.add(l);
    const p = listingPrice(l, { short: false });
    const imgs = l.images.length ? l.images : [''];
    const featList = l.features.map((k) => Dal.featName(k)).filter(Boolean);
    const isOwner = Dal.state.user && Dal.state.user.id === l.owner_id;

    const facts = [
      ['ruler', num(l.area) + ' متر', 'متراژ'], l.rooms ? ['bed', num(l.rooms), 'اتاق خواب'] : null, l.baths ? ['bath', num(l.baths), 'سرویس'] : null,
      l.year_built ? ['cal', fa(l.year_built), 'سال ساخت'] : null, l.floor != null ? ['building', `${num(l.floor)}${l.floors_total ? ' از ' + num(l.floors_total) : ''}`, 'طبقه'] : null,
      ['car', l.parking ? 'دارد' : 'ندارد', 'پارکینگ'], ['layers', l.storage ? 'دارد' : 'ندارد', 'انباری'], ['trend', l.elevator ? 'دارد' : 'ندارد', 'آسانسور'],
    ].filter(Boolean);

    mount(app, html`<div class="container">
      <div class="crumbs"><a href="#/">خانه</a>${icon('chevl', 14)}<a href="#/search?deal=${l.deal}">${Dal.dealName(l.deal)}</a>${icon('chevl', 14)}<a href="#/search?deal=${l.deal}&city=${l.city}">${l.cityName}</a>${icon('chevl', 14)}<a href="#/search?deal=${l.deal}&city=${l.city}&district=${l.district}">${l.districtName}</a></div>
      ${canEdit ? html`<div class="owner-bar no-print"><b>${icon('info', 18)} ${isOwner ? 'این آگهی متعلق به شماست' : 'نمای مدیریتی'}</b><span class="pill ${l.status === 'active' ? 'ok' : l.status === 'pending' ? 'warn' : 'info'}">${STATUS_LABEL[l.status]}</span><span class="muted">${icon('eye', 15)} ${num(l.views)} بازدید</span><span class="grow"></span>
        <a class="btn sm" href="#/edit/${l.id}">${icon('edit', 16)} ویرایش</a>
        ${l.status === 'active' ? html`<button class="btn sm ok" data-st="${l.deal === 'sale' || l.deal === 'presale' ? 'sold' : 'rented'}">${l.deal === 'rent' ? 'اجاره رفت' : 'فروخته شد'}</button><button class="btn sm ghost" data-st="archived">بایگانی</button>` : ''}
        ${['sold', 'rented', 'archived'].includes(l.status) ? html`<button class="btn sm primary" data-st="active">انتشار مجدد</button>` : ''}
        <button class="btn sm danger" id="del-l">${icon('trash', 16)} حذف</button></div>` : ''}
      ${l.status !== 'active' && !canEdit ? html`<div class="alert mb">${icon('info', 20)} این آگهی ${STATUS_LABEL[l.status]} است و دیگر قابل معامله نیست.</div>` : ''}

      <div class="gallery n${Math.min(imgs.length, 5)}" id="gallery">${imgs.slice(0, 5).map((src, i) => html`<button class="g" data-i="${i}" aria-label="تصویر ${fa(i + 1)}"><img src="${src}" alt="${l.title} - تصویر ${fa(i + 1)}" ${i ? 'loading="lazy"' : ''}>${i === 4 && imgs.length > 5 ? html`<span class="more">+${num(imgs.length - 5)} تصویر</span>` : ''}</button>`)}</div>

      <div class="l-layout"><div>
        <div class="panel">
          <div class="row between wrap gap">
            <div class="chips"><span class="badge deal ${l.deal}">${Dal.dealName(l.deal)}</span><span class="chip sm">${Dal.ptypeName(l.ptype)}</span>${l.featured ? html`<span class="badge gold">${icon('sparkle', 13)} ویژه</span>` : ''}${l.verified ? html`<span class="badge green">${icon('shieldc', 13)} مدارک تأییدشده</span>` : ''}<span class="chip sm">کد: ${fa(l.code)}</span></div>
            <div class="row gap-sm no-print"><button class="icon-btn fav ${l.fav ? 'on' : ''}" data-fav="${l.id}" aria-label="ذخیره">${icon('heart', 18)}</button><button class="icon-btn cmp ${Dal.compare.has(l.id) ? 'on' : ''}" data-cmp="${l.id}" aria-label="مقایسه" style="opacity:1;transform:none">${icon('compare', 18)}</button><button class="icon-btn" id="share-btn" aria-label="اشتراک">${icon('share', 18)}</button><button class="icon-btn" onclick="print()" aria-label="چاپ">${icon('print', 18)}</button><button class="icon-btn" id="report-btn" aria-label="گزارش">${icon('flag', 18)}</button></div></div>
          <h1 class="l-title mt">${l.title}</h1>
          <div class="muted row gap-sm wrap">${icon('pin', 17)} ${l.address || `${l.cityName}، ${l.districtName}`} <span>·</span> ${icon('clock', 15)} ${Dal.ago(l.created_at)} <span>·</span> ${icon('eye', 15)} ${num(l.views)} بازدید</div>
          <div class="l-price"><b>${p.main}</b><small>${p.unit}</small>${p.sub ? html`<span class="pill info">${p.sub}</span>` : ''}${l.negotiable ? html`<span class="pill ok">قابل مذاکره</span>` : ''}${l.exchange ? html`<span class="pill warn">قابل معاوضه</span>` : ''}</div>
          ${l.deal !== 'rent' && l.price ? html`<div class="muted" style="font-size:13.5px">${priceWords(l.price)}</div>` : ''}
          ${history.length > 1 && l.deal !== 'rent' ? (() => { const f0 = history[0].price, c = history[history.length - 1].price, ch = ((c - f0) / f0) * 100; return html`<div class="mt"><span class="pill ${ch < 0 ? 'ok' : 'warn'}">${icon(ch < 0 ? 'trenddown' : 'trend', 14)} قیمت از ${dateFa(history[0].at, { month: 'long', day: 'numeric' })} تا الان ${dec(Math.abs(ch), 1)}٪ ${ch < 0 ? 'کاهش' : 'افزایش'} یافته</span></div>`; })() : ''}
        </div>

        <div class="panel"><h3>${icon('layers', 22)} مشخصات کلی</h3><div class="facts">${facts.map(([i, v, t]) => html`<div class="fact">${icon(i, 24)}<b>${v}</b><span>${t}</span></div>`)}</div></div>

        ${l.description ? html`<div class="panel"><h3>${icon('book', 22)} توضیحات</h3><p style="white-space:pre-line;line-height:2.1">${l.description}</p>${l.video_url ? html`<a class="btn mt" href="${l.video_url}" target="_blank" rel="noopener noreferrer">${icon('video', 18)} مشاهده‌ی ویدیوی ملک</a>` : ''}</div>` : ''}

        ${featList.length ? html`<div class="panel"><h3>${icon('sparkle', 22)} امکانات و ویژگی‌ها</h3><div class="feat-grid">${featList.map((f) => html`<div class="feat"><i>${f.i}</i>${f.n}</div>`)}</div></div>` : ''}

        <div class="panel"><h3>${icon('info', 22)} اطلاعات تکمیلی</h3><dl class="dl">
          ${[['نوع ملک', Dal.ptypeName(l.ptype)], ['نوع معامله', Dal.dealName(l.deal)], l.doc_type && ['نوع سند', l.doc_type], l.direction && ['جهت ساختمان', l.direction], l.flooring && ['کف‌پوش', l.flooring], l.units_per_floor && ['تعداد واحد در طبقه', num(l.units_per_floor)], ['شهر', l.cityName], ['محله', l.districtName], ['تاریخ ثبت', dateFa(l.created_at)], l.ppm && ['قیمت هر متر', priceShort(l.ppm) + ' تومان']].filter(Boolean).map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl></div>

        ${market ? html`<div class="panel"><h3>${icon('target', 22)} قیمت نسبت به بازار</h3>${market.basis === 'reference' ? html`<p class="muted" style="font-size:12.5px;margin:-6px 0 12px">مبنای محاسبه: قیمت مرجع محله (هنوز آگهی مشابه کافی در دال نیست) — دقت محدود است.</p>` : html`<p class="muted" style="font-size:12.5px;margin:-6px 0 12px">مبنای محاسبه: ${num(market.samples)} آگهی/معامله‌ی مشابه در دال${market.basis === 'blended' ? ' و قیمت مرجع محله' : ''}.</p>`}
          <div class="verdict ${market.verdict}"><span class="vi">${icon({ great: 'award', fair: 'checkc', high: 'alert', over: 'alert' }[market.verdict], 28)}</span><div><b style="font-size:17px">${{ great: 'زیر قیمت بازار — فرصت خوب 🎯', fair: 'قیمت منصفانه و نزدیک به بازار', high: 'کمی بالاتر از بازار', over: 'به‌طور محسوس بالاتر از بازار' }[market.verdict]}</b><div class="muted">قیمت این آگهی ${dec(Math.abs(market.diff), 1)}٪ ${market.diff < 0 ? 'کمتر' : 'بیشتر'} از ارزش برآوردی دال است.</div></div></div>
          <div class="meter"><i style="inset-inline-start:${Math.min(98, Math.max(2, ((market.diff + 20) / 45) * 100))}%"></i></div><div class="row between muted" style="font-size:12px"><span>ارزان‌تر از بازار</span><span>منصفانه</span><span>گران‌تر</span></div>
          <div class="calc-out"><div><b>${priceShort(market.low)}</b><span>کف بازه‌ی برآورد</span></div><div><b>${priceShort(market.estimate)}</b><span>ارزش برآوردی</span></div><div><b>${priceShort(market.high)}</b><span>سقف بازه‌ی برآورد</span></div>${market.growth12 != null ? html`<div><b class="${market.growth12 >= 0 ? 'up' : 'down'}">٪${dec(market.growth12, 1)}</b><span>رشد قیمت محله (۱۲ ماه)</span></div>` : ''}</div>
          <a class="link-arrow mt" href="#/valuation?city=${l.city}&district=${l.district}&ptype=${l.ptype}&area=${l.area}&year=${l.year_built || ''}">برآورد دقیق‌تر با مشخصات ملک شما ${icon('chevl', 16)}</a></div>` : ''}

        <div class="panel"><h3>${icon('map', 22)} موقعیت روی نقشه</h3><div id="loc-map" class="map-box" style="height:340px"></div><div class="row gap mt wrap no-print"><a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=16/${l.lat}/${l.lng}">${icon('external', 16)} باز کردن در OpenStreetMap</a><a class="btn sm ghost" target="_blank" rel="noopener" href="https://maps.google.com/?q=${l.lat},${l.lng}">${icon('external', 16)} مسیریابی</a></div></div>

        ${nb && nb.scores ? html`<div class="panel"><h3>${icon('target', 22)} امتیاز محله‌ی ${nb.name} <small class="muted" style="font-size:12px;font-weight:500">(برآورد مرجع)</small></h3><div class="grid g2" style="align-items:center"><div>${Dal.charts.radar([['walk', 'پیاده‌روی'], ['transit', 'حمل‌ونقل'], ['safety', 'امنیت'], ['school', 'مدارس'], ['shop', 'خرید'], ['green', 'فضای سبز']].map(([k, n]) => ({ label: n, value: nb.scores[k] })))}</div>
          <div class="score-list">${[['walk', 'قابلیت پیاده‌روی'], ['transit', 'حمل‌ونقل عمومی'], ['safety', 'امنیت'], ['school', 'مدارس'], ['shop', 'دسترسی به خرید'], ['green', 'فضای سبز']].map(([k, n]) => html`<div class="score"><span>${n}</span><span class="t"><i style="width:${nb.scores[k]}%;background:${Dal.scoreColor(nb.scores[k])}"></i></span><b>${fa(nb.scores[k])}</b></div>`)}
            <div class="divider"></div><div class="row between"><span class="muted">قیمت هر متر محله (${nb.ppmSource === 'reference' ? 'مرجع' : 'بازار'})</span><b>${priceShort(nb.ppm)} تومان</b></div><div class="row between"><span class="muted">آگهی‌های فعال محله</span><b>${num(nb.activeCount)}</b></div></div></div></div>
` : ''}
        ${nb && !nb.scores ? html`<div class="panel"><h3>${icon('pin', 22)} محله‌ی ${nb.name}</h3><div class="row between"><span class="muted">قیمت هر متر محله</span><b>${nb.ppm ? priceShort(nb.ppm) + ' تومان (' + (nb.ppmSource === 'reference' ? 'مرجع' : 'بازار') + ')' : 'هنوز داده‌ی کافی نیست'}</b></div><div class="row between mt"><span class="muted">آگهی‌های فعال محله</span><b>${num(nb.activeCount)}</b></div></div>` : ''}
        ${nb && nb.trend && nb.trend.length > 1 ? html`<div class="panel"><h3>${icon('trend', 22)} روند قیمت هر متر در ${nb.name}</h3><div id="trend-chart"></div></div>` : ''}

        ${history.length > 1 ? html`<div class="panel"><h3>${icon('clock', 22)} تاریخچه‌ی قیمت آگهی</h3><div id="price-chart"></div></div>` : ''}

        ${l.deal === 'sale' || l.deal === 'presale' ? html`<div class="panel no-print"><h3>${icon('calc', 22)} ماشین‌حساب وام و اقساط</h3><div id="mini-loan"></div></div>` : l.deal === 'rent' ? html`<div class="panel no-print"><h3>${icon('refresh', 22)} تبدیل رهن و اجاره</h3><div id="mini-conv"></div></div>` : ''}

        ${canEdit && d.viewsByDay?.length ? html`<div class="panel"><h3>${icon('chart', 22)} بازدید ۱۴ روز اخیر</h3>${Dal.charts.columns(d.viewsByDay.map((x) => ({ x: dateFa(x.day, { day: 'numeric' }), y: x.n })))}</div>` : ''}
      </div>

      <aside class="side no-print">
        <div class="panel">
          <a class="agent-mini" href="#/agent/${owner.id}">${Dal.avatar(owner, 56)}<div><h4>${owner.name} ${owner.verified ? html`<span class="vb">${icon('shieldc', 16)}</span>` : ''}</h4><div class="muted" style="font-size:13px">${owner.role === 'agent' ? owner.agency || 'مشاور املاک' : 'مالک / کاربر'}</div>${owner.rating ? html`<div class="row gap-sm">${Dal.stars(owner.rating, 13)}<b style="font-size:13px">${dec(owner.rating, 1)}</b><span class="muted" style="font-size:12px">(${num(owner.reviews)})</span></div>` : ''}</div></a>
          <button class="btn primary block lg" id="phone-btn">${icon('phone', 20)} نمایش شماره‌ی تماس</button>
          <div class="row gap mt"><button class="btn block" id="chat-btn">${icon('msg', 18)} چت با ${owner.role === 'agent' ? 'مشاور' : 'مالک'}</button></div>
        </div>
        ${isOwner ? '' : html`<div class="panel"><h3 style="font-size:17px">${icon('cal', 20)} رزرو بازدید</h3><div class="slot-days" id="slot-days"></div><div class="slots" id="slots"></div><label class="fld mt"><span>توضیحات (اختیاری)</span><input id="visit-note" maxlength="200" placeholder="مثلاً: همراه همسرم می‌آیم"></label><button class="btn accent block mt" id="visit-btn" disabled>ثبت درخواست بازدید</button></div>
        <form class="panel" id="inq-form"><h3 style="font-size:17px">${icon('msg', 20)} درخواست مشاوره</h3><div class="col gap">
          <input name="name" placeholder="نام و نام خانوادگی" value="${Dal.state.user?.name || ''}" required minlength="2"><input name="phone" inputmode="tel" placeholder="شماره‌ی موبایل (۰۹…)" value="${Dal.state.user?.phone || ''}" required>
          <textarea name="message" rows="3" required minlength="3">سلام، درباره‌ی «${l.title}» (کد ${l.code}) اطلاعات بیشتری می‌خواستم.</textarea><button class="btn primary block">ارسال درخواست</button></div></form>`}
        <div class="panel"><h3 style="font-size:17px">${icon('phone', 20)} مشاوره‌ی دال</h3><p class="muted mb" style="font-size:13.5px">برای راهنمایی خرید، ارزیابی قیمت یا هماهنگی بازدید با مشاوران دال صحبت کنید.</p>${Dal.contactButtons()}<button class="btn block mt" data-consult="${l.city}">${icon('msg', 16)} درخواست تماس</button></div>
        <div class="alert info">${icon('shieldc', 20)} <span>هرگز پیش از بازدید حضوری و بررسی سند، بیعانه یا مبلغی واریز نکنید.</span></div>
      </aside></div>

      ${similar.length ? html`<section class="section"><h2 style="margin-bottom:18px">آگهی‌های مشابه</h2><div class="grid cards">${similar.slice(0, 4).map((x) => listingCard(x))}</div></section>` : ''}
    </div>`);

    // ---------------------------------------------------------------- interactions
    on($('#gallery', app), 'click', '.g', (e, b) => Dal.lightbox(imgs, +b.dataset.i));
    $('#share-btn', app).onclick = () => Dal.share(l.title, location.origin + '/l/' + l.id);
    if (nb && $('#trend-chart', app)) Dal.charts.line($('#trend-chart', app), nb.trend.map((t) => ({ x: t.month, y: t.ppm })), { xfmt: (x) => Dal.monthLabel(x, true), unit: 'تومان / متر', height: 240 });
    if (history.length > 1) Dal.charts.line($('#price-chart', app), history.map((h) => ({ x: h.at, y: l.deal === 'rent' ? h.rent || h.price : h.price })), { xfmt: (x, long) => dateFa(x, long ? undefined : { month: 'short', day: 'numeric' }), unit: 'تومان', color: 'var(--accent)' });
    if ($('#mini-loan', app)) Dal.calc.miniLoan($('#mini-loan', app), l.price);
    if ($('#mini-conv', app)) Dal.calc.miniConvert($('#mini-conv', app), l.price, l.rent);

    (async () => {
      const mapEl = $('#loc-map', app); if (!mapEl) return;
      const L = await Dal.loadLeaflet(); const map = await Dal.makeMap(mapEl, { center: [l.lat, l.lng], zoom: 15, scroll: false });
      L.circle([l.lat, l.lng], { radius: 260, color: '#5b3df5', fillOpacity: .15, weight: 2 }).addTo(map);
      L.marker([l.lat, l.lng]).addTo(map).bindPopup(`<b>${Dal.esc(l.title)}</b>`);
      Dal.cleanup.push(() => map.remove());
      map.on('focus', () => map.scrollWheelZoom.enable()); map.on('blur', () => map.scrollWheelZoom.disable());
    })();

    $('#phone-btn', app).onclick = async (e) => { const r = await Dal.guard(() => Dal.api(`/listings/${l.id}/phone`, { method: 'POST' }), e.currentTarget); if (r) { const b = e.currentTarget; mount(b, html`${icon('phone', 20)} <span class="ltr" dir="ltr">${Dal.fa(r.phone)}</span>`); b.onclick = () => { location.href = 'tel:' + r.phone; }; } };
    $('#chat-btn', app).onclick = () => {
      if (isOwner) return Dal.toast('این آگهی متعلق به خود شماست.', 'info');
      if (!Dal.requireLogin('برای چت ابتدا وارد شوید.')) return;
      const m = Dal.modal(html`<form class="col gap"><textarea name="body" rows="4" required>سلام، آیا «${l.title}» هنوز موجود است؟</textarea><button class="btn primary">${icon('send', 18)} ارسال پیام</button></form>`, { title: 'شروع گفتگو' });
      $('form', m.body).onsubmit = async (e) => { e.preventDefault(); const r = await Dal.guard(() => Dal.api('/threads', { method: 'POST', body: { listing_id: l.id, body: e.target.body.value } }), $('button', m.body)); if (r) { m.close(); Dal.go('/messages/' + r.id); } };
    };
    const inq = $('#inq-form', app);
    if (inq) inq.onsubmit = async (e) => { e.preventDefault(); const f = e.target; const r = await Dal.guard(() => Dal.api(`/listings/${l.id}/inquiries`, { method: 'POST', body: { name: f.name.value, phone: f.phone.value, message: f.message.value } }), $('button', f)); if (r) { Dal.toast('درخواست شما ارسال شد. به‌زودی تماس می‌گیرند ✅', 'success'); f.message.value = ''; } };

    // رزرو بازدید
    const daysEl = $('#slot-days', app);
    if (daysEl) {
      let selDate = null, selTime = null;
      const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() + (i + (new Date().getHours() >= 19 ? 1 : 0)) * 864e5));
      const wd = new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }), dn = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' }), mn = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'short' });
      mount(daysEl, html`${days.map((dt) => html`<button type="button" class="slot-day" data-date="${Dal.isoDate(dt)}"><span>${wd.format(dt)}</span><b>${dn.format(dt)}</b><span>${mn.format(dt)}</span></button>`)}`);
      const slotsEl = $('#slots', app), vb = $('#visit-btn', app);
      on(daysEl, 'click', '.slot-day', async (e, b) => {
        $$('.slot-day', daysEl).forEach((x) => x.classList.toggle('on', x === b)); selDate = b.dataset.date; selTime = null; vb.disabled = true;
        const r = await Dal.api(`/listings/${l.id}/slots`, { query: { date: selDate } });
        mount(slotsEl, html`${r.slots.map((s) => html`<button type="button" class="slot ${s.free ? '' : 'off'}" data-time="${s.time}" ${s.free ? '' : 'disabled'}>${fa(s.time)}</button>`)}`);
      });
      on(slotsEl, 'click', '.slot:not(.off)', (e, b) => { $$('.slot', slotsEl).forEach((x) => x.classList.toggle('on', x === b)); selTime = b.dataset.time; vb.disabled = false; });
      vb.onclick = async () => {
        if (!Dal.requireLogin('برای رزرو بازدید وارد شوید.')) return;
        const r = await Dal.guard(() => Dal.api(`/listings/${l.id}/appointments`, { method: 'POST', body: { date: selDate, time: selTime, note: $('#visit-note', app).value } }), vb);
        if (r) { Dal.toast(`درخواست بازدید برای ${dateFa(selDate)} ساعت ${fa(selTime)} ثبت شد ✅`, 'success'); $$('.slot.on', slotsEl).forEach((x) => { x.classList.remove('on'); x.classList.add('off'); x.disabled = true; }); vb.disabled = true; }
      };
      daysEl.firstElementChild.click();
    }

    $('#report-btn', app).onclick = () => {
      const m = Dal.modal(html`<form class="col gap"><label class="fld"><span>دلیل گزارش</span><select name="reason">${REPORT_REASONS.map((r) => html`<option>${r}</option>`)}</select></label><label class="fld"><span>توضیحات</span><textarea name="details" rows="3" maxlength="400"></textarea></label><button class="btn danger">ارسال گزارش</button></form>`, { title: 'گزارش آگهی' });
      $('form', m.body).onsubmit = async (e) => { e.preventDefault(); const r = await Dal.guard(() => Dal.api(`/listings/${l.id}/report`, { method: 'POST', body: { reason: e.target.reason.value, details: e.target.details.value } }), $('button', m.body)); if (r) { m.close(); Dal.toast('گزارش شما ثبت شد. سپاس از همراهی‌تان.', 'success'); } };
    };

    on(app, 'click', '[data-st]', async (e, b) => {
      const r = await Dal.guard(() => Dal.api(`/listings/${l.id}/status`, { method: 'PUT', body: { status: b.dataset.st } }), b);
      if (r) { Dal.toast('وضعیت آگهی تغییر کرد.', 'success'); Dal.render(); }
    });
    const del = $('#del-l', app);
    if (del) del.onclick = async () => { if (await Dal.confirm('آگهی برای همیشه حذف می‌شود. ادامه می‌دهید؟', { ok: 'حذف آگهی', danger: true })) { const r = await Dal.guard(() => Dal.api('/listings/' + l.id, { method: 'DELETE' })); if (r) { Dal.toast('آگهی حذف شد.', 'success'); Dal.go('/dashboard/listings'); } } };
  };
})();
