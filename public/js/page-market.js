/* دال — تحلیل بازار */
'use strict';
(function () {
  const { html, raw, icon, num, dec, fa, $, $$, on, mount, priceShort } = Dal;

  Dal.pages.market = async (app, _p, query, alive) => {
    Dal.setTitle('تحلیل بازار مسکن');
    let city = query.city || Dal.defaultCity(), metric = 'ppm', sort = 'ppm', selD = query.d || '';
    let map = null;

    async function draw() {
      const data = await Dal.api('/analytics/market', { query: { city } });
      if (!alive()) return;
      const ds = data.districts.filter((d) => d.ppm != null); const geoDs = ds.filter((d) => !d.noGeo); const avgPpm = ds.reduce((s, d) => s + d.ppm, 0) / ds.length; const gs = ds.filter((d) => d.growth12 != null); const avgG = gs.length ? gs.reduce((s, d) => s + d.growth12, 0) / gs.length : null; const gf = (v) => (v == null ? '—' : '٪' + dec(v, 1)); const cls = (v) => (v == null ? 'muted' : v >= 0 ? 'up' : 'down');
      const best = [...gs].sort((a, b) => b.growth12 - a.growth12)[0], priciest = [...ds].sort((a, b) => b.ppm - a.ppm)[0], cheapest = [...ds].sort((a, b) => a.ppm - b.ppm)[0];
      const act = ds.reduce((s, d) => s + d.listings, 0);
      if (!ds.length) {
        mount(app, html`<div class="container section"><div class="sec-head"><div><h1 style="font-size:32px">${icon('chart', 30)} تحلیل بازار مسکن ${data.cityName}</h1><p>قیمت هر متر، روند و رشد محله‌ها</p></div>
          <div class="chips">${Dal.state.meta.cities.map((c) => html`<button class="chip ${c.slug === city ? 'on' : ''}" data-city="${c.slug}">${c.name}</button>`)}</div></div>
          ${Dal.empty(`هنوز داده‌ی بازار ${data.cityName} ثبت نشده است`, 'برای این شهر قیمت مرجع ثابتی نداریم و تحلیل بازار فقط از آگهی‌ها و معامله‌های واقعی دال ساخته می‌شود. با ثبت نخستین آگهی‌ها، قیمت هر متر، روند و رشد محله‌ها اینجا ظاهر می‌شود. برای ارزیابی قیمت با مشاوران دال صحبت کنید.', html`<div class="row gap wrap" style="justify-content:center"><a class="btn primary" href="#/new?city=${city}">${icon('plus', 18)} ثبت آگهی</a><button class="btn accent" data-consult="${city}">${icon('phone', 18)} مشاوره‌ی قیمت</button></div>`)}</div>`);
        return;
      }
      if (selD && !ds.find((d) => d.slug === selD)) selD = '';
      mount(app, html`<div class="container section">
        <div class="sec-head"><div><h1 style="font-size:32px">${icon('chart', 30)} تحلیل بازار مسکن ${data.cityName}</h1><p>قیمت هر متر مربع، روند ۲۴ ماهه و داغ‌ترین محله‌ها</p></div>
          <div class="chips">${Dal.state.meta.cities.map((c) => html`<button class="chip ${c.slug === city ? 'on' : ''}" data-city="${c.slug}">${c.name}</button>`)}</div></div>
        <div class="kpis">${Dal.kpi('میانگین قیمت هر متر', priceShort(avgPpm) + ' تومان', `${num(ds.length)} محله`, 'ruler')}
          ${Dal.kpi('میانگین رشد ۱۲ ماهه', gf(avgG), avgG == null ? 'داده‌ی کافی نیست' : '', 'trend', avgG == null || avgG >= 0 ? 'ok' : 'bad')}${Dal.kpi('گران‌ترین محله', priciest.name, priceShort(priciest.ppm) + ' تومان', 'award', 'acc')}${Dal.kpi('بیشترین رشد', best ? best.name : '—', best ? gf(best.growth12) : 'داده‌ی کافی نیست', 'zap', 'ok')}${Dal.kpi('مقرون‌به‌صرفه‌ترین', cheapest.name, priceShort(cheapest.ppm) + ' تومان', 'home', 'warn')}${Dal.kpi('آگهی‌های فعال', num(act), 'در ' + data.cityName, 'building')}</div>
        <div class="alert info mt">${icon('info', 18)} <div>${data.samples ? html`قیمت‌ها از <b>${num(data.samples)}</b> آگهی و معامله‌ی ثبت‌شده در دال محاسبه شده‌اند؛ برای محله‌هایی که داده‌ی کافی ندارند، «قیمت مرجع» (برآورد کارشناسی عمومی) نمایش داده می‌شود، و اگر مرجعی هم نداشته باشیم فقط «داده‌ی کافی نیست» می‌بینید؛ با رشد داده‌ها دقیق‌تر خواهد شد.` : html`در حال حاضر در دال داده‌ی کافی برای این شهر ثبت نشده است؛ قیمت‌ها «قیمت مرجع» (برآورد کارشناسی عمومی) هستند. روند و رشد قیمت فقط از آگهی‌ها و معامله‌های واقعی دال محاسبه می‌شود و با ثبت داده نمایش داده خواهد شد.`}</div></div>

        <div class="grid g2 mt-lg" style="align-items:start">
          <div class="panel" style="margin:0"><div class="row between wrap gap"><h3 style="margin:0">${icon('trend', 22)} روند قیمت هر متر</h3><select id="d-sel" style="width:auto;min-height:38px;padding:4px 12px"><option value="">میانگین ${data.cityName}</option>${ds.map((d) => html`<option value="${d.slug}" ${selD === d.slug ? 'selected' : ''}>${d.name}</option>`)}</select></div><div id="m-trend" class="mt"></div></div>
          <div class="panel" style="margin:0"><div class="row between wrap gap"><h3 style="margin:0">${icon('layers', 22)} مقایسه‌ی محله‌ها</h3><div class="seg" id="sort-seg"><button data-sort="ppm" class="${sort === 'ppm' ? 'on' : ''}">قیمت</button><button data-sort="growth12" class="${sort === 'growth12' ? 'on' : ''}">رشد</button><button data-sort="listings" class="${sort === 'listings' ? 'on' : ''}">آگهی</button></div></div><div id="m-bars" class="mt"></div></div>
        </div>

        <div class="panel mt-lg"><div class="row between wrap gap mb"><h3 style="margin:0">${icon('map', 22)} نقشه‌ی حرارتی بازار</h3><div class="seg" id="metric-seg"><button data-metric="ppm" class="on">قیمت هر متر</button><button data-metric="growth12" class="">رشد ۱۲ ماه</button></div></div><div id="heat" class="map-box" style="height:430px"></div></div>

        <div class="grid g3 mt-lg"><div class="panel" style="margin:0"><h3>${icon('layers', 22)} ترکیب آگهی‌ها</h3>${data.deals.length ? Dal.charts.donut(data.deals.map((d) => ({ label: Dal.dealName(d.deal), value: d.n })), { label: 'آگهی' }) : raw('<p class="muted">هنوز آگهی‌ای ثبت نشده است.</p>')}</div>
          <div class="panel" style="margin:0"><h3>${icon('building', 22)} قیمت هر متر به تفکیک نوع</h3>${data.types.filter((t) => t.ppm).length ? Dal.charts.bars(data.types.filter((t) => t.ppm).map((t) => ({ label: Dal.ptypeName(t.ptype).split(' / ')[0], value: t.ppm })), {}) : raw('<p class="muted">داده‌ی کافی نیست</p>')}</div>
          <div class="panel" style="margin:0"><h3>${icon('eye', 22)} پربازدیدترین آگهی‌ها</h3>${data.top.length ? '' : raw('<p class="muted">هنوز آگهی‌ای ثبت نشده است.</p>')}${data.top.map((t, i) => html`<a class="row gap" style="padding:8px 0;border-bottom:1px dashed var(--line)" href="#/listing/${t.id}"><b class="kpi-ic" style="width:32px;height:32px;font-size:13px">${fa(i + 1)}</b><span class="grow" style="font-size:13.5px">${t.title}</span><span class="muted" style="font-size:12px">${num(t.views)}</span></a>`)}</div></div>

        <div class="mt-lg"><h3 class="mb">جدول تفصیلی محله‌ها</h3><div class="table-wrap"><table><thead><tr><th>محله</th><th>قیمت هر متر</th><th>مبنا</th><th>رشد ۳ ماه</th><th>رشد ۱۲ ماه</th><th>میانگین قیمت آگهی‌ها</th><th>آگهی فعال</th><th>امتیاز محله (مرجع)</th><th></th></tr></thead><tbody>
          ${[...ds].sort((a, b) => b.ppm - a.ppm).map((d) => { const avgScore = d.scores ? Math.round(Object.values(d.scores).reduce((s, x) => s + x, 0) / 6) : null; const prem = d.askingPpm ? ((d.askingPpm - d.ppm) / d.ppm) * 100 : null; return html`<tr><td><b>${d.name}</b></td><td>${priceShort(d.ppm)}</td><td><span class="pill ${d.source === 'reference' ? '' : 'ok'}">${d.source === 'reference' ? 'مرجع' : d.source === 'market' ? 'بازار' : 'ترکیبی'}</span></td><td class="${cls(d.growth3)}">${gf(d.growth3)}</td><td class="${cls(d.growth12)}">${gf(d.growth12)}</td><td>${d.askingPpm ? priceShort(d.askingPpm) + (prem != null ? html` <small class="${prem > 0 ? 'down' : 'up'}">(${prem > 0 ? '+' : ''}${dec(prem, 0)}٪)</small>` : '') : '—'}</td><td>${num(d.listings)}</td><td>${avgScore == null ? html`<span class="muted">—</span>` : html`<span class="pill ${avgScore >= 80 ? 'ok' : avgScore >= 65 ? 'warn' : 'bad'}">${fa(avgScore)}</span>`}</td><td><a class="btn sm ghost" href="#/search?deal=sale&city=${city}&district=${d.slug}">آگهی‌ها</a></td></tr>`; })}</tbody></table></div></div></div>`);

      const trendEl = $('#m-trend', app);
      const drawTrend = async () => {
        let series; if (selD) series = (await Dal.api('/analytics/trend', { query: { city, district: selD } })).items; else series = data.cityTrend;
        Dal.charts.line(trendEl, series.map((t) => ({ x: t.month, y: t.ppm })), { xfmt: (x, long) => Dal.monthLabel(x, long), unit: 'تومان / متر', height: 280 });
      };
      drawTrend();
      $('#d-sel', app).onchange = (e) => { selD = e.target.value; drawTrend(); };
      const bars = () => { const arr = [...ds].filter((d) => d[sort] != null).sort((a, b) => b[sort] - a[sort]); if (!arr.length) return mount($('#m-bars', app), html`<p class="muted">داده‌ی کافی نیست؛ رشد قیمت پس از ثبت آگهی و معامله محاسبه می‌شود.</p>`); const fmt = sort === 'ppm' ? priceShort : sort === 'growth12' ? (v) => '٪' + dec(v, 1) : num; mount($('#m-bars', app), Dal.charts.bars(arr.map((d) => ({ label: d.name, value: d[sort], text: fmt(d[sort]) })), { href: (i) => `#/search?deal=sale&city=${city}&district=${ds.find((x) => x.name === i.label).slug}`, color: sort === 'growth12' ? 'linear-gradient(90deg,#12b886,#5b3df5)' : undefined })); };
      bars();
      on($('#sort-seg', app), 'click', 'button', (e, b) => { sort = b.dataset.sort; $$('#sort-seg button', app).forEach((x) => x.classList.toggle('on', x === b)); bars(); });

      // نقشه‌ی حرارتی
      if (!geoDs.length) { $('#heat', app).closest('.panel').remove(); return; }
      const L = await Dal.loadLeaflet(); if (!alive()) return;
      map = await Dal.makeMap($('#heat', app), { center: [Dal.city(city).lat, Dal.city(city).lng], zoom: city === 'tehran' ? 11 : 12, scroll: false });
      const layer = L.layerGroup().addTo(map);
      const paint = () => {
        layer.clearLayers(); const vals = geoDs.map((d) => d[metric]).filter((v) => v != null); const mn = Math.min(...vals), mx = Math.max(...vals);
        geoDs.forEach((d) => {
          const has = d[metric] != null; const t = has ? (d[metric] - mn) / (mx - mn || 1) : 0; const hue = metric === 'ppm' ? 220 - t * 220 : 10 + t * 120; const col = has ? `hsl(${hue} 85% 52%)` : '#9aa3b2';
          L.circle([d.lat, d.lng], { radius: 700 + t * 900, color: col, fillColor: col, fillOpacity: .38, weight: 2 }).addTo(layer)
            .bindPopup(`<b>${Dal.esc(d.name)}</b><br>قیمت هر متر: ${priceShort(d.ppm)} تومان<br>رشد ۱۲ ماه: ${gf(d.growth12)}<br><a href="#/search?deal=sale&city=${city}&district=${d.slug}">مشاهده‌ی آگهی‌ها</a>`)
            .bindTooltip(`${d.name} · ${metric === 'ppm' ? priceShort(d.ppm) : gf(d.growth12)}`, { permanent: true, direction: 'center', className: 'heat-tip' });
        });
      };
      paint();
      on($('#metric-seg', app), 'click', 'button', (e, b) => { metric = b.dataset.metric; $$('#metric-seg button', app).forEach((x) => x.classList.toggle('on', x === b)); paint(); });
      Dal.cleanup.push(() => { map && map.remove(); map = null; });
    }
    on(app, 'click', '[data-city]', (e, b) => { city = b.dataset.city; selD = ''; history.replaceState(null, '', '#/market?city=' + city); map && map.remove(); draw(); });
    mount(app, html`<div class="container section">${Dal.skeletonCards(3)}</div>`);
    await draw();
  };
})();
