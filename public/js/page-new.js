/* دال — ثبت و ویرایش آگهی (مرحله‌به‌مرحله) */
'use strict';
(function () {
  const { html, raw, icon, num, dec, fa, en, $, $$, on, mount, priceShort, priceWords } = Dal;
  const STEPS = [['نوع و مکان', 'home'], ['مشخصات و قیمت', 'ruler'], ['نقشه', 'map'], ['تصاویر', 'image'], ['امکانات و توضیحات', 'sparkle']];

  function resizeImage(file, max = 1600) {
    return new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.82)); };
      img.onerror = () => reject(new Error('تصویر قابل خواندن نیست.')); img.src = url;
    });
  }

  Dal.pages.newListing = async (app, { id }, query, alive) => {
    if (!Dal.requireLogin('برای ثبت آگهی ابتدا وارد شوید یا ثبت‌نام کنید.')) return;
    const meta = Dal.state.meta; const editing = !!id;
    Dal.setTitle(editing ? 'ویرایش آگهی' : 'ثبت آگهی');
    const S = { deal: 'sale', ptype: query.ptype || 'apartment', city: query.city || Dal.defaultCity(), district: query.district || '', title: '', address: '', area: query.area || '', rooms: 2, baths: 1, year_built: '', floor: '', floors_total: '', units_per_floor: '', doc_type: meta.docTypes[0], direction: '', flooring: '', price: +query.price || 0, rent: 0, negotiable: false, exchange: false, features: [], images: [], description: '', video_url: '', lat: null, lng: null };
    if (editing) {
      try { const d = await Dal.api('/listings/' + id); if (!d.canEdit) throw new Error('اجازه‌ی ویرایش ندارید.'); Object.assign(S, d.listing, { year_built: d.listing.year_built || '', floor: d.listing.floor ?? '', floors_total: d.listing.floors_total ?? '', units_per_floor: d.listing.units_per_floor ?? '', direction: d.listing.direction || '', flooring: d.listing.flooring || '' }); }
      catch (e) { return mount(app, html`<div class="container section">${Dal.empty('خطا', e.message)}</div>`); }
    }
    if (!S.district) S.district = Dal.city(S.city).districts[0].slug;
    let step = 0; let map = null;

    const collect = () => {
      const f = $('#wf', app); if (!f) return;
      const g = (n) => f.elements[n];
      if (step === 0) { S.deal = f.deal.value; S.ptype = f.ptype.value; S.city = f.city.value; S.district = f.district.value; S.title = f.title.value.trim(); S.address = f.address.value.trim(); }
      if (step === 1) {
        for (const k of ['area', 'rooms', 'baths', 'year_built', 'floor', 'floors_total', 'units_per_floor']) if (g(k)) S[k] = en(g(k).value).replace(/[^\d-]/g, '');
        S.doc_type = f.doc_type.value; S.direction = f.direction.value; S.flooring = f.flooring.value; S.price = Dal.moneyVal(f.price); S.rent = f.rent ? Dal.moneyVal(f.rent) : 0; S.negotiable = f.negotiable.checked; S.exchange = f.exchange.checked;
      }
      if (step === 4) { S.features = $$('[name=features]:checked', f).map((i) => i.value); S.description = f.description.value; S.video_url = f.video_url.value.trim(); }
    };
    const validate = () => {
      if (step === 0) { if (S.title.length < 5) return 'عنوان آگهی را (حداقل ۵ نویسه) بنویسید.'; if (!S.district) return 'محله را انتخاب کنید.'; }
      if (step === 1) { if (!(+S.area >= 5)) return 'متراژ را وارد کنید.'; if (S.deal !== 'swap' && !S.price) return S.deal === 'rent' ? 'مبلغ ودیعه (رهن) را وارد کنید.' : 'قیمت را وارد کنید.'; }
      if (step === 3 && !S.images.length) return 'حداقل یک تصویر از ملک بارگذاری کنید.';
      return null;
    };

    const view = () => {
      const f = (inner) => html`<div class="container section" style="max-width:920px"><div class="sec-head"><div><h1 style="font-size:28px">${editing ? 'ویرایش آگهی' : 'ثبت آگهی رایگان'}</h1><p>${Dal.isAgent() ? 'آگهی مشاوران تأییدشده بلافاصله منتشر می‌شود.' : 'آگهی شما پس از بررسی تیم دال منتشر می‌شود.'}</p></div></div>
        <div class="wizard-steps">${STEPS.map(([t, i], k) => html`<div class="wstep ${k === step ? 'on' : k < step ? 'done' : ''}"><i>${k < step ? '✓' : fa(k + 1)}</i>${t}</div>`)}</div>
        <form class="panel" id="wf" onsubmit="return false">${inner}<div class="row between mt-lg"><button type="button" class="btn ghost" id="prev" ${step === 0 ? 'disabled' : ''}>${icon('chevr', 18)} قبلی</button>${step < 4 ? html`<button type="button" class="btn primary" id="next">بعدی ${icon('chevl', 18)}</button>` : html`<button type="button" class="btn accent lg" id="submit">${editing ? 'ذخیره‌ی تغییرات' : 'ثبت و ارسال آگهی'} ${icon('check', 18)}</button>`}</div></form></div>`;
      if (map) { map.remove(); map = null; }
      if (step === 0) mount(app, f(html`
        <h3>نوع معامله</h3><div class="deal-pick">${Object.entries(meta.deals).map(([k, v]) => html`<label><input type="radio" name="deal" value="${k}" ${S.deal === k ? 'checked' : ''}>${v}</label>`)}</div>
        <h3 class="mt-lg">نوع ملک</h3><div class="chips">${Object.entries(meta.ptypes).map(([k, v]) => html`<label class="chip"><input type="radio" name="ptype" value="${k}" ${S.ptype === k ? 'checked' : ''}>${v}</label>`)}</div>
        <div class="form-grid mt-lg"><label class="fld"><span>شهر</span><select name="city">${Dal.cityOptions(S.city)}</select></label><label class="fld"><span>محله</span><select name="district">${Dal.districtOptions(S.city, S.district)}</select></label></div>
        <label class="fld mt"><span>نشانی (اختیاری، برای کاربران نمایش داده می‌شود)</span><input name="address" value="${S.address}" maxlength="200" placeholder="خیابان، کوچه…"></label>
        <label class="fld mt"><span class="row between"><span>عنوان آگهی</span><button type="button" class="btn sm ghost" id="auto-title">${icon('sparkle', 14)} ساخت خودکار</button></span><input name="title" value="${S.title}" maxlength="120" placeholder="مثلاً: آپارتمان ۱۲۰ متری نوساز در سعادت‌آباد"></label>`));
      if (step === 1) {
        const isRent = S.deal === 'rent', land = ['land', 'garden'].includes(S.ptype), apt = ['apartment', 'penthouse', 'office'].includes(S.ptype);
        mount(app, f(html`<div class="form-grid"><label class="fld"><span>متراژ (متر مربع)</span><input name="area" inputmode="numeric" value="${S.area}" required></label>
          ${land ? '' : html`<label class="fld"><span>اتاق خواب</span><input name="rooms" inputmode="numeric" value="${S.rooms}"></label><label class="fld"><span>سرویس بهداشتی</span><input name="baths" inputmode="numeric" value="${S.baths}"></label><label class="fld"><span>سال ساخت (شمسی)</span><input name="year_built" inputmode="numeric" value="${S.year_built}" placeholder="۱۴۰۰"></label>`}
          ${apt ? html`<label class="fld"><span>طبقه</span><input name="floor" inputmode="numeric" value="${S.floor}"></label><label class="fld"><span>کل طبقات</span><input name="floors_total" inputmode="numeric" value="${S.floors_total}"></label><label class="fld"><span>واحد در هر طبقه</span><input name="units_per_floor" inputmode="numeric" value="${S.units_per_floor}"></label>` : ''}
          <label class="fld"><span>نوع سند</span><select name="doc_type">${Dal.optionList(Object.fromEntries(meta.docTypes.map((x) => [x, x])), S.doc_type, '—')}</select></label><label class="fld"><span>جهت ساختمان</span><select name="direction">${Dal.optionList(Object.fromEntries(meta.directions.map((x) => [x, x])), S.direction, '—')}</select></label><label class="fld"><span>کف‌پوش</span><select name="flooring">${Dal.optionList(Object.fromEntries(meta.floorings.map((x) => [x, x])), S.flooring, '—')}</select></label></div>
        <div class="divider"></div><h3>${icon('dollar', 22)} قیمت</h3>
        <div class="form-grid">${Dal.rangeInput('price', isRent ? 'مبلغ ودیعه / رهن (تومان)' : S.deal === 'swap' ? 'ارزش تقریبی (اختیاری)' : 'قیمت کل (تومان)', S.price || '')}${isRent ? Dal.rangeInput('rent', 'اجاره‌ی ماهانه (تومان) — صفر برای رهن کامل', S.rent || '') : ''}</div>
        <div class="row gap wrap mt"><label class="check"><input type="checkbox" name="negotiable" ${S.negotiable ? 'checked' : ''}> قابل مذاکره</label>${S.deal === 'sale' ? html`<label class="check"><input type="checkbox" name="exchange" ${S.exchange ? 'checked' : ''}> قابل معاوضه</label>` : ''}</div>
        <div id="hint-box" class="mt"></div>`));
        Dal.bindMoney($('#wf', app));
        if (S.deal === 'sale' || S.deal === 'presale') priceHint();
      }
      if (step === 2) {
        mount(app, f(html`<h3>${icon('map', 22)} موقعیت دقیق ملک</h3><p class="muted mb">روی نقشه کلیک کنید یا نشانگر را بکشید تا موقعیت دقیق مشخص شود.</p><div class="geo-row"><input id="geo-q" placeholder="جستجوی نشانی یا محل (مثلاً: بلوار ساحلی کنگان)" autocomplete="off"><button type="button" class="btn" id="geo-go">${icon('search', 16)} جستجو</button></div><div class="geo-results" id="geo-res"></div><div id="pick-map" class="map-box" style="height:400px"></div><p class="muted mt" id="coord"></p>`));
        (async () => {
          const d0 = Dal.district(S.city, S.district); const lat = S.lat ?? d0.lat, lng = S.lng ?? d0.lng; S.lat = lat; S.lng = lng;
          const L = await Dal.loadLeaflet(); if (!alive() || !$('#pick-map', app)) return;
          map = await Dal.makeMap($('#pick-map', app), { center: [lat, lng], zoom: d0.noGeo && S.lat === d0.lat ? 13 : 15, scroll: true });
          const mk = L.marker([lat, lng], { draggable: true }).addTo(map);
          const upd = (ll) => { S.lat = +ll.lat.toFixed(6); S.lng = +ll.lng.toFixed(6); $('#coord', app).textContent = `مختصات: ${fa(S.lat)} , ${fa(S.lng)}`; };
          upd(mk.getLatLng());
          const rev = Dal.debounce(async (ll) => { if (S.address && S.address.length > 3) return; const r = await Dal.api('/reverse', { query: { lat: ll.lat, lng: ll.lng } }).catch(() => null); if (r?.label) { S.address = r.label.split('،').slice(0, 3).join('،'); const c = $('#coord', app); if (c) c.textContent += ` · ${S.address}`; } }, 600);
          mk.on('dragend', () => { upd(mk.getLatLng()); rev(mk.getLatLng()); }); map.on('click', (e) => { mk.setLatLng(e.latlng); upd(e.latlng); rev(e.latlng); });
          on($('#geo-res', app), 'click', '[data-g]', (e2, b) => { const box = $('#geo-res', app); const it = box._r[+b.dataset.g]; mk.setLatLng([it.lat, it.lng]); map.setView([it.lat, it.lng], 16); upd({ lat: it.lat, lng: it.lng }); if (!S.address) S.address = it.label.split('،').slice(0, 3).join('،'); mount(box, ''); });
          const go = async () => {
            const t = $('#geo-q', app).value.trim(); if (t.length < 3) return Dal.toast('حداقل ۳ نویسه بنویسید.', 'error');
            const r = await Dal.guard(() => Dal.api('/geocode', { query: { q: t, city: S.city } }), $('#geo-go', app)); if (!r) return;
            const box = $('#geo-res', app); if (!r.items.length) return mount(box, html`<div class="muted">نتیجه‌ای پیدا نشد؛ روی نقشه کلیک کنید.</div>`);
            mount(box, r.items.map((x, i) => html`<button type="button" data-g="${i}">${icon('pin', 14)} ${x.label}</button>`));
            box._r = r.items;
          };
          $('#geo-go', app).onclick = go; $('#geo-q', app).addEventListener('keydown', (e2) => { if (e2.key === 'Enter') { e2.preventDefault(); go(); } });
        })();
      }
      if (step === 3) {
        mount(app, f(html`<h3>${icon('image', 22)} تصاویر ملک</h3><p class="muted mb">حداقل ۱ و حداکثر ۱۲ تصویر (JPG/PNG/WebP). تصویر اول به‌عنوان کاور نمایش داده می‌شود. آگهی‌های دارای تصویر بیشتر تا ۳ برابر بازدید بیشتری می‌گیرند.</p>
          <label class="uploader" id="drop">${icon('upload', 40)}<div><b>تصاویر را اینجا بکشید</b> یا برای انتخاب کلیک کنید</div><input type="file" id="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label><div class="thumbs" id="thumbs"></div>
          `));
        thumbs();
        const drop = $('#drop', app), file = $('#file', app);
        const handle = async (files) => {
          for (const fl of [...files].slice(0, 12 - S.images.length)) {
            if (!/^image\/(png|jpe?g|webp)$/.test(fl.type)) { Dal.toast('فقط تصویر مجاز است.', 'error'); continue; }
            try { const data = await resizeImage(fl); const r = await Dal.api('/upload', { method: 'POST', body: { data } }); S.images.push(r.url); thumbs(); } catch (e) { Dal.toast(e.message, 'error'); }
          }
        };
        file.onchange = () => handle(file.files);
        ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
        ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
        drop.addEventListener('drop', (e) => handle(e.dataTransfer.files));
      }
      if (step === 4) {
        mount(app, f(html`<h3>${icon('sparkle', 22)} امکانات</h3><div class="chips">${meta.features.map((x) => html`<label class="chip"><input type="checkbox" name="features" value="${x.k}" ${S.features.includes(x.k) ? 'checked' : ''}>${x.i} ${x.n}</label>`)}</div>
          <label class="fld mt-lg"><span class="row between"><span>توضیحات آگهی</span><button type="button" class="btn sm ghost" id="auto-desc">${icon('sparkle', 14)} پیشنهاد متن</button></span><textarea name="description" rows="7" maxlength="4000" placeholder="موقعیت، ویژگی‌های ساختمان، همسایه‌ها، دسترسی‌ها…">${S.description}</textarea></label>
          <label class="fld mt"><span>پیوند ویدیو (اختیاری)</span><input name="video_url" value="${S.video_url || ''}" dir="ltr" style="text-align:left" placeholder="https://"></label>
          <div class="divider"></div><div class="alert ok">${icon('checkc', 18)} <div><b>خلاصه:</b> ${Dal.dealName(S.deal)} · ${Dal.ptypeName(S.ptype).split(' / ')[0]} · ${Dal.district(S.city, S.district)?.name}، ${Dal.city(S.city).name} · ${num(S.area)} متر · ${S.deal === 'rent' ? `ودیعه ${priceShort(S.price)} / اجاره ${priceShort(S.rent)}` : priceShort(S.price) + ' تومان'} · ${num(S.images.length)} تصویر</div></div>`));
      }
      bind();
    };

    const thumbs = () => { const t = $('#thumbs', app); if (!t) return; mount(t, html`${S.images.map((u, i) => html`<div class="thumb ${i === 0 ? 'cover' : ''}"><img src="${u}" alt="">${i === 0 ? html`<em>کاور</em>` : html`<button type="button" data-cover="${i}" style="inset-inline-start:auto;inset-inline-end:4px;top:4px" title="کاور شود">★</button>`}<button type="button" data-rm="${i}" aria-label="حذف">${icon('x', 14)}</button></div>`)}`); };

    async function priceHint() {
      const box = $('#hint-box', app); if (!box) return; collectSafe();
      if (!(+S.area >= 10)) return;
      try {
        const r = await Dal.api('/valuate', { method: 'POST', body: { city: S.city, district: S.district, ptype: S.ptype, area: S.area, rooms: S.rooms, year_built: S.year_built, floor: S.floor, floors_total: S.floors_total, features: S.features } });
        mount(box, html`<div class="alert info">${icon('sparkle', 20)} <div><b>قیمت پیشنهادی دال:</b> ${priceShort(r.low)} تا ${priceShort(r.high)} تومان (برآورد: ${priceShort(r.price)})<br><button type="button" class="btn sm primary mt" id="use-price" data-p="${r.price}">استفاده از برآورد دال</button></div></div>`);
      } catch { mount(box, html`<div class="alert">${icon('info', 18)} برای این محله هنوز آگهی مشابه یا قیمت مرجعی در دال نیست؛ قیمت را بر اساس بازار محل خودتان تعیین کنید. برای مشورت با مشاوران دال تماس بگیرید.</div>`); }
    }
    const collectSafe = () => { try { collect(); } catch { /* ignore */ } };

    const bind = () => {
      const f = $('#wf', app);
      $('#prev', app).onclick = () => { collectSafe(); step--; view(); window.scrollTo(0, 0); };
      const nxt = $('#next', app);
      if (nxt) nxt.onclick = () => { collect(); const err = validate(); if (err) return Dal.toast(err, 'error'); step++; view(); window.scrollTo(0, 0); };
      const sub = $('#submit', app);
      if (sub) sub.onclick = async () => {
        collect(); step = 0; let err = validate(); step = 1; err = err || validate(); step = 3; err = err || validate(); step = 4; if (err) return Dal.toast(err, 'error');
        const body = { ...S, rooms: +S.rooms || 0, baths: +S.baths || 0 };
        const r = await Dal.guard(() => Dal.api(editing ? '/listings/' + id : '/listings', { method: editing ? 'PUT' : 'POST', body }), sub);
        if (r) { Dal.toast(editing ? 'تغییرات ذخیره شد ✅' : r.status === 'active' ? 'آگهی شما منتشر شد 🎉' : 'آگهی ثبت شد و پس از بررسی منتشر می‌شود ✅', 'success'); Dal.go(editing ? '/listing/' + id : r.status === 'active' ? '/listing/' + r.id : '/dashboard/listings'); }
      };
      if (step === 0) {
        f.city.onchange = () => { mount(f.district, Dal.districtOptions(f.city.value)); S.lat = S.lng = null; };
        f.district.onchange = () => { S.lat = S.lng = null; };
        $('#auto-title', app).onclick = () => { collect(); const d = Dal.district(S.city, S.district); f.title.value = `${Dal.ptypeName(S.ptype).split(' / ')[0]}${S.area ? ' ' + fa(S.area) + ' متری' : ''} ${S.deal === 'rent' ? 'برای رهن و اجاره' : S.deal === 'presale' ? 'پیش‌فروش' : ''} در ${d?.name}`.replace(/\s+/g, ' ').trim(); };
      }
      if (step === 1) {
        on(f, 'click', '#use-price', (e, b) => { const inp = f.price; inp.value = b.dataset.p; inp.dispatchEvent(new Event('input')); });
        f.addEventListener('change', Dal.debounce(() => { if (S.deal === 'sale' || S.deal === 'presale') priceHint(); }, 500));
      }
      if (step === 3) { on(f, 'click', '[data-rm]', (e, b) => { S.images.splice(+b.dataset.rm, 1); thumbs(); }); on(f, 'click', '[data-cover]', (e, b) => { const [x] = S.images.splice(+b.dataset.cover, 1); S.images.unshift(x); thumbs(); }); }
      if (step === 4) $('#auto-desc', app).onclick = () => {
        collect(); const d = Dal.district(S.city, S.district); const fl = S.features.map((k) => Dal.featName(k)?.n).filter(Boolean);
        f.description.value = `${Dal.ptypeName(S.ptype).split(' / ')[0]} ${fa(S.area)} متری${S.rooms ? ' با ' + fa(S.rooms) + ' اتاق خواب' : ''} در ${d?.name}، ${Dal.city(S.city).name}${S.year_built ? '، ساخت سال ' + fa(S.year_built) : ''}.\n${fl.length ? 'امکانات: ' + fl.join('، ') + '.\n' : ''}${S.doc_type ? 'نوع سند: ' + S.doc_type + '.\n' : ''}دسترسی عالی به حمل‌ونقل عمومی، مراکز خرید و مدارس. برای هماهنگی بازدید از طریق دال اقدام کنید.`;
      };
    };
    Dal.cleanup.push(() => { map && map.remove(); });
    view();
  };
})();
