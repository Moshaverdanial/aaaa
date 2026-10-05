/* دال — صفحه‌ی جستجو: فیلترها، شبکه/لیست/نقشه */
'use strict';
(function () {
  const { html, raw, icon, num, dec, fa, $, $$, on, mount, listingCard, priceShort, priceWords } = Dal;
  const FILTER_KEYS = ['owner', 'deal', 'ptype', 'city', 'district', 'minPrice', 'maxPrice', 'minRent', 'maxRent', 'minArea', 'maxArea', 'rooms', 'baths', 'minYear', 'maxYear', 'features', 'verified', 'featured', 'exchange', 'q', 'sort'];

  Dal.pages.search = async (app, _p, query, alive) => {
    Dal.setTitle('جستجوی ملک');
    const meta = Dal.state.meta;
    const F = { deal: 'sale', sort: 'new', ...Object.fromEntries(Object.entries(query).filter(([k]) => FILTER_KEYS.includes(k))) };
    if (query.smart) { // از پالت فرمان
      const r = await Dal.api('/smart-search', { method: 'POST', body: { q: query.smart } }).catch(() => null);
      if (r) { location.replace('#/search?' + new URLSearchParams({ ...r.filters, nl: query.smart })); return; }
    }
    if (query.deal === '' || query.deal === 'all') delete F.deal;
    let view = query.view || Dal.store.get('view', 'grid'); let page = +query.page || 1; const nl = query.nl || '';
    let map = null, layer = null, L = null, lastTotal = 0;

    const sync = (push = false) => {
      const q = { ...Object.fromEntries(Object.entries(F).filter(([, v]) => v !== '' && v != null && v !== false)), view, page: page > 1 ? page : '', nl };
      if (q.sort === 'new') delete q.sort;
      if (!F.deal) q.deal = 'all';
      const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== '' && v != null)).toString();
      const url = '#/search' + (qs ? '?' + qs : '');
      if (push) location.hash = url; else history.replaceState(null, '', url);
    };
    const csv = (k) => (F[k] ? String(F[k]).split(',') : []);

    // ---------------------------------------------------------------- sidebar
    const sidebar = () => {
      const isRent = F.deal === 'rent';
      return html`<form id="filter-form" onsubmit="return false">
        <h4>نوع معامله</h4>
        <div class="seg" style="width:100%">${[['', 'همه'], ['sale', 'خرید'], ['rent', 'اجاره'], ['presale', 'پیش‌فروش']].map(([k, v]) => html`<button type="button" style="flex:1;padding:8px 4px" data-deal="${k}" class="${(F.deal || '') === k ? 'on' : ''}">${v}</button>`)}</div>
        <h4>نوع ملک</h4>
        <div class="chips">${Object.entries(meta.ptypes).map(([k, v]) => html`<label class="chip"><input type="checkbox" name="ptype" value="${k}" ${csv('ptype').includes(k) ? 'checked' : ''}>${v.split(' / ')[0]}</label>`)}</div>
        <h4>شهر و محله</h4>
        <select name="city">${Dal.cityOptions(F.city, 'همه‌ی شهرها')}</select>
        ${F.city ? html`<div class="chips" style="margin-top:10px;max-height:150px;overflow:auto">${Dal.city(F.city).districts.map((d) => html`<label class="chip"><input type="checkbox" name="district" value="${d.slug}" ${csv('district').includes(d.slug) ? 'checked' : ''}>${d.name}</label>`)}</div>` : ''}
        <h4>${isRent ? 'ودیعه (رهن)' : 'قیمت'} (تومان)</h4>
        <div class="two">${Dal.rangeInput('minPrice', 'از', F.minPrice)}${Dal.rangeInput('maxPrice', 'تا', F.maxPrice)}</div>
        ${isRent ? html`<h4>اجاره‌ی ماهانه</h4><div class="two">${Dal.rangeInput('minRent', 'از', F.minRent)}${Dal.rangeInput('maxRent', 'تا', F.maxRent)}</div>` : ''}
        <h4>متراژ</h4>
        <div class="two"><label class="fld"><span>از</span><input name="minArea" inputmode="numeric" value="${F.minArea || ''}" placeholder="مثلاً ۶۰"></label><label class="fld"><span>تا</span><input name="maxArea" inputmode="numeric" value="${F.maxArea || ''}" placeholder="مثلاً ۱۵۰"></label></div>
        <h4>تعداد خواب</h4>
        <div class="room-chips">${['', '1', '2', '3', '4', '5'].map((r) => html`<button type="button" data-rooms="${r}" class="${String(F.rooms || '') === r ? 'on' : ''}">${r === '' ? 'همه' : r === '5' ? '۵+' : fa(r)}</button>`)}</div>
        <h4>سال ساخت (شمسی)</h4>
        <div class="two"><label class="fld"><span>از</span><input name="minYear" inputmode="numeric" value="${F.minYear || ''}" placeholder="۱۳۹۰"></label><label class="fld"><span>تا</span><input name="maxYear" inputmode="numeric" value="${F.maxYear || ''}" placeholder="۱۴۰۵"></label></div>
        <h4>امکانات</h4>
        <div class="chips">${meta.features.slice(0, 16).map((f) => html`<label class="chip"><input type="checkbox" name="features" value="${f.k}" ${csv('features').includes(f.k) ? 'checked' : ''}>${f.i} ${f.n}</label>`)}</div>
        <h4>سایر</h4>
        <label class="check"><span class="switch"><input type="checkbox" name="verified" ${F.verified ? 'checked' : ''}><i></i></span> فقط آگهی‌های تأییدشده</label>
        <label class="check mt"><span class="switch"><input type="checkbox" name="exchange" ${F.exchange ? 'checked' : ''}><i></i></span> قابل معاوضه</label>
        <div class="row gap mt-lg"><button type="button" class="btn ghost grow" id="reset-f">پاک‌کردن فیلترها</button></div>
      </form>`;
    };

    mount(app, html`<div class="container">
      <div style="padding-top:24px"><div class="search-card" style="max-width:none;box-shadow:var(--shadow)">${Dal.smartBox(nl)}</div></div>
      <div class="search-layout">
        <aside class="filters" id="filters">${sidebar()}</aside>
        <section><div id="results"></div></section>
      </div></div>`);
    const fsec = $('#filters', app);
    Dal.bindSmart(app); Dal.bindMoney(fsec);

    const redrawSidebar = () => { mount(fsec, sidebar()); Dal.bindMoney(fsec); };
    const readForm = () => {
      const f = $('#filter-form', fsec);
      const get = (n) => $$(`[name="${n}"]:checked`, f).map((i) => i.value).join(',');
      F.ptype = get('ptype'); F.district = get('district'); F.features = get('features');
      F.city = $('[name=city]', f).value;
      F.minPrice = Dal.moneyVal($('[name=minPrice]', f)) || ''; F.maxPrice = Dal.moneyVal($('[name=maxPrice]', f)) || '';
      if ($('[name=minRent]', f)) { F.minRent = Dal.moneyVal($('[name=minRent]', f)) || ''; F.maxRent = Dal.moneyVal($('[name=maxRent]', f)) || ''; }
      for (const k of ['minArea', 'maxArea', 'minYear', 'maxYear']) F[k] = Dal.en($(`[name=${k}]`, f).value).replace(/\D/g, '');
      F.verified = $('[name=verified]', f).checked ? 1 : ''; F.exchange = $('[name=exchange]', f).checked ? 1 : '';
    };
    const onChange = Dal.debounce(() => { readForm(); page = 1; sync(); load(); }, 450);
    fsec.addEventListener('input', onChange); fsec.addEventListener('change', (e) => { if (e.target.name === 'city') { F.district = ''; readForm(); F.district = ''; redrawSidebar(); page = 1; sync(); load(); } });
    on(fsec, 'click', '[data-deal]', (e, b) => { readForm(); F.deal = b.dataset.deal; if (F.deal !== 'rent') { F.minRent = ''; F.maxRent = ''; } redrawSidebar(); page = 1; sync(); load(); });
    on(fsec, 'click', '[data-rooms]', (e, b) => { F.rooms = b.dataset.rooms; $$('[data-rooms]', fsec).forEach((x) => x.classList.toggle('on', x === b)); page = 1; sync(); load(); });
    on(fsec, 'click', '#reset-f', () => { for (const k of Object.keys(F)) if (k !== 'sort') delete F[k]; F.deal = 'sale'; page = 1; history.replaceState(null, '', '#/search'); redrawSidebar(); load(); });

    // ---------------------------------------------------------------- results
    const res = $('#results', app);
    const labelFor = {
      deal: (v) => Dal.dealName(v), ptype: (v) => v.split(',').map((x) => Dal.ptypeName(x).split(' / ')[0]).join('، '), city: (v) => Dal.city(v)?.name,
      district: (v) => v.split(',').map((d) => Dal.district(F.city, d)?.name || d).join('، '), minPrice: (v) => 'از ' + priceShort(v), maxPrice: (v) => 'تا ' + priceShort(v),
      minRent: (v) => 'اجاره از ' + priceShort(v), maxRent: (v) => 'اجاره تا ' + priceShort(v), minArea: (v) => 'از ' + num(v) + ' متر', maxArea: (v) => 'تا ' + num(v) + ' متر',
      rooms: (v) => (v === '5' ? '۵+ خواب' : num(v) + ' خواب'), baths: (v) => num(v) + '+ سرویس', minYear: (v) => 'از سال ' + fa(v), maxYear: (v) => 'تا سال ' + fa(v),
      features: (v) => v.split(',').map((k) => Dal.featName(k)?.n).join('، '), verified: () => 'تأییدشده', featured: () => 'ویژه', exchange: () => 'قابل معاوضه', q: (v) => `«${v}»`, owner: () => 'آگهی‌های یک مشاور',
    };
    const chips = () => Object.entries(F).filter(([k, v]) => labelFor[k] && v !== '' && v != null && !(k === 'deal' && false)).map(([k, v]) => html`<span class="chip on">${labelFor[k](v)} <span class="x" data-rm="${k}" role="button" aria-label="حذف فیلتر">${icon('x', 14)}</span></span>`);

    let loadSeq = 0;
    async function load() {
      const seq = ++loadSeq;
      const isMap = view === 'map';
      mount(res, html`<div class="toolbar"><div class="sk sk-line" style="width:200px"></div></div>${Dal.skeletonCards(6)}`);
      const q = { ...F, page, limit: isMap ? 20 : view === 'list' ? 8 : 12 };
      let data, pins = null;
      try {
        [data, pins] = await Promise.all([Dal.api('/listings', { query: q }), isMap ? Dal.api('/listings/map', { query: F }) : null]);
      } catch (e) { return mount(res, Dal.empty('خطا در دریافت اطلاعات', e.message)); }
      if (seq !== loadSeq || !alive()) return;
      lastTotal = data.total;
      const cards = data.items.length ? data.items.map((l) => listingCard(l, { layout: view === 'list' ? 'list' : 'grid' })) : '';
      mount(res, html`
        <div class="row between wrap gap mb"><div><h1 style="font-size:20px">${num(data.total)} آگهی ${F.deal ? Dal.dealName(F.deal) : ''} ${F.city ? 'در ' + Dal.city(F.city).name : ''}</h1>
          <div class="stat-strip">${data.stats.avgPpm ? html`<span>میانگین قیمت هر متر: <b>${priceShort(data.stats.avgPpm)} تومان</b></span>` : ''}</div></div>
          <div class="row gap wrap">
            <button class="btn ghost sm" id="filter-toggle">${icon('filter', 16)} فیلترها</button>
            <button class="btn ghost sm" id="save-search">${icon('bell', 16)} ذخیره‌ی جستجو و اعلان</button>
            <select id="sort" aria-label="مرتب‌سازی" style="min-height:38px;padding:4px 12px">${Dal.optionList({ new: 'پیشنهادی (ویژه‌ها اول)', newest: 'جدیدترین', price_asc: 'ارزان‌ترین', price_desc: 'گران‌ترین', ppm_asc: 'کمترین قیمت هر متر', area_desc: 'بیشترین متراژ', area_asc: 'کمترین متراژ', popular: 'پربازدیدترین' }, F.sort || 'new')}</select>
            <div class="seg">${[['grid', 'grid'], ['list', 'list'], ['map', 'map']].map(([v, i]) => html`<button data-view="${v}" class="${view === v ? 'on' : ''}" aria-label="${v}" style="padding:7px 12px">${icon(i, 18)}</button>`)}</div></div></div>
        <div class="active-filters">${chips()}</div>
        ${!data.items.length ? Dal.empty('آگهی‌ای مطابق فیلترها پیدا نشد', 'فیلترها را کمی بازتر کنید یا جستجو را ذخیره کنید تا با ثبت آگهی جدید به شما اطلاع بدهیم.', html`<div class="row gap"><button class="btn ghost" id="reset2">پاک‌کردن فیلترها</button><a class="btn primary" href="#/requests">ثبت درخواست ملک</a></div>`)
          : isMap ? html`<div class="map-split"><div class="list">${cards}</div><div id="map"></div></div>${Dal.pager(page, data.pages, (p) => '#')}`
          : html`<div class="${view === 'list' ? 'col gap' : 'grid cards'}" style="${view === 'list' ? 'gap:18px' : ''}">${cards}</div>${Dal.pager(page, data.pages, (p) => '#')}`}`);
      if (isMap && data.items.length) drawMap(pins.items, data.items);
    }

    async function drawMap(pins) {
      L = await Dal.loadLeaflet(); const el = $('#map', res); if (!el) return;
      const c = F.city ? Dal.city(F.city) : meta.cities[0];
      map = await Dal.makeMap(el, { center: [c.lat, c.lng], zoom: 12, scroll: true });
      layer = L.layerGroup().addTo(map);
      const markers = {};
      pins.forEach((p) => {
        const pr = Dal.listingPrice(p);
        const m = L.marker([p.lat, p.lng], { icon: Dal.pricePin(L, p.deal === 'rent' ? priceShort(p.rent || p.price) : priceShort(p.price), p.deal) }).addTo(layer).bindPopup(Dal.mapPopup(p));
        markers[p.id] = m;
      });
      if (pins.length) map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])).pad(0.2), { maxZoom: 15 });
      const list = $('.map-split .list', res);
      list.addEventListener('mouseover', (e) => { const c2 = e.target.closest('.lcard'); if (c2 && markers[c2.dataset.id]) { const pin = markers[c2.dataset.id].getElement()?.querySelector('.price-pin'); pin && pin.classList.add('hl'); } });
      list.addEventListener('mouseout', (e) => { const c2 = e.target.closest('.lcard'); if (c2 && markers[c2.dataset.id]) markers[c2.dataset.id].getElement()?.querySelector('.price-pin')?.classList.remove('hl'); });
      const lc = L.control({ position: 'topleft' });
      lc.onAdd = () => { const b = L.DomUtil.create('button', 'btn sm'); b.innerHTML = icon('crosshair', 16).s + ' اطراف من'; b.style.cssText = 'background:#fff;color:#222;box-shadow:0 2px 8px rgba(0,0,0,.3)'; b.onclick = (ev) => { L.DomEvent.stopPropagation(ev); navigator.geolocation?.getCurrentPosition((pos) => { map.setView([pos.coords.latitude, pos.coords.longitude], 14); L.circleMarker([pos.coords.latitude, pos.coords.longitude], { radius: 9, color: '#fff', fillColor: '#2f7cff', fillOpacity: 1, weight: 3 }).addTo(map); }, () => Dal.toast('دسترسی به موقعیت مکانی داده نشد.', 'error')); }; return b; };
      lc.addTo(map);
      Dal.cleanup.push(() => { map && map.remove(); map = null; });
    }
    document.addEventListener('dal:theme', () => { if (view === 'map') load(); }, { once: true });

    on(res, 'click', '[data-rm]', (e, b) => { const k = b.dataset.rm; delete F[k]; if (k === 'city') delete F.district; if (k === 'deal') F.deal = ''; page = 1; sync(); redrawSidebar(); load(); });
    on(res, 'click', '[data-view]', (e, b) => { view = b.dataset.view; Dal.store.set('view', view === 'map' ? 'grid' : view); page = 1; sync(); load(); });
    on(res, 'click', '[data-page]', (e, a) => { e.preventDefault(); page = +a.dataset.page; sync(); load().then(() => window.scrollTo({ top: 0, behavior: 'smooth' })); });
    on(res, 'click', '#reset2', () => $('#reset-f', fsec).click());
    on(res, 'click', '#filter-toggle', () => fsec.classList.toggle('open'));
    res.addEventListener('change', (e) => { if (e.target.id === 'sort') { F.sort = e.target.value; page = 1; sync(); load(); } });
    on(res, 'click', '#save-search', async () => {
      if (!Dal.requireLogin('برای ذخیره‌ی جستجو وارد شوید.')) return;
      const q = Object.fromEntries(Object.entries(F).filter(([k, v]) => v !== '' && k !== 'sort'));
      const name = [F.deal && Dal.dealName(F.deal), F.ptype && Dal.ptypeName(F.ptype.split(',')[0]).split(' / ')[0], F.city && Dal.city(F.city).name].filter(Boolean).join(' · ') || 'جستجوی من';
      const m = Dal.modal(html`<form class="col gap"><p class="muted">با ثبت آگهی جدید مطابق این فیلترها، برایتان اعلان می‌فرستیم.</p><label class="fld"><span>نام جستجو</span><input name="name" value="${name}" maxlength="80"></label><button class="btn primary">${icon('bell', 18)} ذخیره و فعال‌سازی اعلان</button></form>`, { title: 'ذخیره‌ی جستجو' });
      $('form', m.body).onsubmit = async (e) => { e.preventDefault(); const btn = $('button', m.body); const r = await Dal.guard(() => Dal.api('/saved-searches', { method: 'POST', body: { name: e.target.name.value, query: q } }), btn); if (r) { m.close(); Dal.toast('جستجو ذخیره شد ✅ در داشبورد قابل مدیریت است.', 'success'); } };
    });

    load();
  };
})();
