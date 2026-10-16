/* دال — مشاوره‌ی تلفنی/آنلاین (تمرکز ویژه: بندر کنگان و شیراز) */
'use strict';
(function () {
  const { html, icon, fa, num, $, on, mount } = Dal;

  // ------------------------------------------------------------ کمک‌ها
  Dal.site = () => Dal.state.meta?.site || { phones: [], focus: [] };
  Dal.fmtPhone = (p) => fa(String(p).replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3'));
  const intl = (p) => '98' + String(p).slice(1);
  Dal.focusCities = () => Dal.site().focus.map((f) => Dal.city(f.slug)).filter(Boolean);
  Dal.defaultCity = () => Dal.site().focus[0]?.slug || Dal.state.meta.cities[0].slug;

  // دکمه‌های تماس (تماس مستقیم، واتساپ، تلگرام) — همگی رایگان و بدون واسطه
  Dal.contactButtons = ({ big = false } = {}) => {
    const s = Dal.site(); const sz = big ? 'btn lg' : 'btn';
    return html`<div class="row gap wrap">
      ${s.phones.map((p) => html`<a class="${sz} primary" href="tel:+${intl(p)}" dir="ltr">${icon('phone', 18)} ${Dal.fmtPhone(p)}</a>`)}
      <a class="${sz} ok" href="https://wa.me/${intl(s.whatsapp)}" target="_blank" rel="noopener">${icon('msg', 18)} واتساپ</a>
      ${s.bale ? html`<a class="${sz}" href="https://ble.ir/${s.bale}" target="_blank" rel="noopener">${icon('send', 18)} بله</a>` : ''}
      ${s.eitaa ? html`<a class="${sz}" href="https://eitaa.com/${s.eitaa}" target="_blank" rel="noopener">${icon('send', 18)} ایتا</a>` : ''}
      ${s.telegram ? html`<a class="${sz}" href="https://t.me/${s.telegram}" target="_blank" rel="noopener">${icon('send', 18)} تلگرام</a>` : ''}</div>`;
  };

  const KINDS = { buy: 'خرید ملک', rent: 'رهن و اجاره', sell: 'فروش ملک', invest: 'سرمایه‌گذاری', other: 'سایر' };

  const consultForm = (opts = {}) => {
    const u = Dal.state.user;
    return html`<form class="col gap" id="consult-form">
      <div class="form-grid"><label class="fld"><span>نام</span><input name="name" required minlength="2" value="${u?.name || ''}" autocomplete="name"></label>
      <label class="fld"><span>شماره‌ی موبایل</span><input name="phone" inputmode="tel" required dir="ltr" style="text-align:right" placeholder="۰۹۱۲۳۴۵۶۷۸۹" value="${u?.phone ? fa(u.phone) : ''}" autocomplete="tel"></label>
      <label class="fld"><span>شهر</span><select name="city">${Dal.cityOptions(opts.city || Dal.defaultCity())}</select></label>
      <label class="fld"><span>موضوع مشاوره</span><select name="kind">${Dal.optionList(KINDS, opts.kind || 'buy')}</select></label></div>
      <label class="fld"><span>توضیح (اختیاری)</span><textarea name="note" rows="3" maxlength="1000" placeholder="مثلاً: آپارتمان ۲ خوابه، بودجه‌ی تقریبی، محله‌ی دلخواه…">${opts.note || ''}</textarea></label>
      <button class="btn primary lg block">${icon('send', 18)} ثبت درخواست مشاوره</button>
      <p class="muted center" style="font-size:12.5px">شماره‌ی شما فقط برای تماس مشاوران دال استفاده می‌شود.</p></form>`;
  };
  const bindConsult = (root, done) => {
    const f = $('#consult-form', root); if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault(); const body = Object.fromEntries(new FormData(f));
      const r = await Dal.guard(() => Dal.api('/consult', { method: 'POST', body }), $('button', f));
      if (r) { Dal.toast('درخواست شما ثبت شد ✅', 'success'); done && done(); }
    };
  };

  Dal.consultModal = (opts = {}) => {
    const m = Dal.modal(html`<div class="col gap"><p class="muted">برای پاسخ سریع مستقیم تماس بگیرید، یا شماره‌تان را بگذارید تا مشاوران دال با شما تماس بگیرند.</p>${Dal.contactButtons()}<div class="divider"></div>${consultForm(opts)}</div>`, { title: 'مشاوره‌ی املاک', wide: true });
    bindConsult(m.body, () => m.close());
    return m;
  };
  on(document, 'click', '[data-consult]', (e, b) => { e.preventDefault(); Dal.consultModal({ city: b.dataset.consult || undefined }); });

  // دکمه‌ی شناور مشاوره
  Dal.ui.renderFab = () => {
    let b = $('#fab-consult');
    if (!b) { b = document.createElement('button'); b.id = 'fab-consult'; b.className = 'fab-consult'; document.body.appendChild(b); b.onclick = () => Dal.consultModal(); }
    mount(b, html`${icon('phone', 20)}<span>مشاوره</span>`); b.setAttribute('aria-label', 'مشاوره‌ی املاک');
  };

  // ------------------------------------------------------------ صفحه‌ی مشاوره
  const CITY_COPY = {
    kangan: { lead: 'تمرکز اصلی دال', text: 'خرید، فروش، رهن و اجاره، سرمایه‌گذاری و ارزیابی قیمت ملک در محله‌ها و شهرک‌های بندر کنگان و اطراف آن (سیراف، بنک، شیرینو).' },
    shiraz: { lead: 'تمرکز ویژه', text: 'مشاوره‌ی خرید، فروش و اجاره‌ی ملک در محله‌های شیراز؛ از قصردشت و معالی‌آباد تا صدرا و گلستان.' },
  };
  Dal.pages.consult = async (app, _p, query) => {
    Dal.setTitle('مشاوره‌ی املاک بندر کنگان و شیراز');
    const st = await Dal.api('/stats/home').catch(() => ({ byCity: [] }));
    const focus = Dal.focusCities();
    mount(app, html`<div class="container section">
      <div class="consult-hero"><div>
        <span class="badge" style="background:rgba(255,255,255,.2)">${icon('phone', 14)} مشاوره‌ی املاک</span>
        <h1>مشاوره‌ی تخصصی ملک در <em>بندر کنگان</em> و <em>شیراز</em></h1>
        <p>با مشاوران دال مستقیم صحبت کنید؛ از ارزیابی قیمت و بررسی مدارک تا هماهنگی بازدید و معامله.</p>
        <div class="mt">${Dal.contactButtons({ big: true })}</div></div></div>

      <div class="grid g2 mt-lg">${focus.map((c, i) => {
        const copy = CITY_COPY[c.slug] || {}; const n = st.byCity.find((x) => x.slug === c.slug)?.n || 0;
        return html`<div class="panel city-focus ${i === 0 ? 'primary' : ''}" style="margin:0"><div class="row between"><h2 style="font-size:26px;margin:0">${icon('pin', 24)} ${c.name}</h2><span class="pill ${i === 0 ? 'warn' : 'info'}">${copy.lead || ''}</span></div>
          <p class="muted mt">${copy.text || ''}</p>
          <div class="row gap wrap mt"><a class="btn primary" href="#/search?city=${c.slug}">${n ? `${num(n)} آگهی` : 'آگهی‌ها'}</a><a class="btn" href="#/market?city=${c.slug}">${icon('chart', 16)} بازار</a><a class="btn" href="#/valuation?city=${c.slug}">${icon('sparkle', 16)} برآورد قیمت</a><button class="btn accent" data-consult="${c.slug}">${icon('phone', 16)} درخواست تماس</button></div>
          <div class="muted mt" style="font-size:13px">محله‌ها و شهرک‌ها:</div>
          <div class="chips mt" style="max-height:130px;overflow:auto">${c.districts.slice(0, 40).map((d) => html`<a class="chip" href="#/search?city=${c.slug}&district=${d.slug}">${d.name}</a>`)}</div></div>`;
      })}</div>

      <div class="panel mt-lg" id="consult-req"><h3>${icon('msg', 22)} درخواست مشاوره (ثبت شماره برای تماس)</h3>${consultForm({ city: query.city })}</div>

      <div class="grid g3 mt-lg">${[['sparkle', 'ارزیابی قیمت', 'بر پایه‌ی آگهی‌ها و معامله‌های ثبت‌شده در دال و تجربه‌ی مشاور.'], ['shieldc', 'بررسی مدارک', 'راهنمایی برای بررسی سند، کاربری و وضعیت ملک پیش از معامله.'], ['cal', 'هماهنگی بازدید', 'هماهنگی زمان بازدید با مالک یا مشاور آگهی.']].map(([i, t, d]) => html`<div class="panel" style="margin:0"><span class="kpi-ic">${icon(i, 22)}</span><h3 style="margin-top:10px">${t}</h3><p class="muted">${d}</p></div>`)}</div>
    </div>`);
    bindConsult(app, () => { const f = $('#consult-form', app); f.reset(); });
    if (query.city) $('#consult-req', app).scrollIntoView();
  };
})();
