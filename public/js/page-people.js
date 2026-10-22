/* دال — مشاوران، مجله، درخواست ملک، مقایسه، درباره‌ی ما */
'use strict';
(function () {
  const { html, raw, icon, num, dec, fa, $, $$, on, mount, listingCard, priceShort, priceWords, dateFa } = Dal;

  // ---------------------------------------------------------------- مشاوران
  Dal.pages.agents = async (app, _p, query, alive) => {
    Dal.setTitle('مشاوران املاک');
    const S = { q: query.q || '', city: query.city || '', sort: query.sort || 'rating' };
    mount(app, html`<div class="container section"><div class="sec-head"><div><h1 style="font-size:32px">مشاوران املاک دال</h1><p>مشاوران تأییدشده با نظرات واقعی مشتریان</p></div></div>
      <div class="panel row gap wrap" style="margin-bottom:24px"><label class="fld grow" style="min-width:220px"><span>جستجوی نام یا آژانس</span><input id="a-q" value="${S.q}" placeholder="مثلاً: املاک آرمان"></label>
        <label class="fld"><span>شهر</span><select id="a-city">${Dal.cityOptions(S.city, 'همه‌ی شهرها')}</select></label>
        <label class="fld"><span>مرتب‌سازی</span><select id="a-sort">${Dal.optionList({ rating: 'بیشترین امتیاز', listings: 'بیشترین آگهی', exp: 'بیشترین تجربه' }, S.sort)}</select></label></div>
      <div id="a-list"></div>
      <div class="cta mt-lg"><div><h2>مشاور املاک هستید؟</h2><p style="opacity:.85;margin-top:6px">با ثبت‌نام به‌عنوان مشاور، آگهی‌هایتان را مدیریت کنید و نشان «تأییدشده» بگیرید.</p></div><a class="btn accent lg" href="#/register?role=agent">پیوستن به دال</a></div></div>`);
    const load = async () => {
      const r = await Dal.api('/agents', { query: S }); if (!alive()) return;
      mount($('#a-list', app), r.items.length ? html`<div class="grid g3">${r.items.map((a) => Dal.agentCard(a))}</div>` : Dal.empty('مشاوری پیدا نشد', 'عبارت جستجو را تغییر دهید.'));
    };
    $('#a-q', app).addEventListener('input', Dal.debounce((e) => { S.q = e.target.value; load(); }, 350));
    $('#a-city', app).onchange = (e) => { S.city = e.target.value; load(); }; $('#a-sort', app).onchange = (e) => { S.sort = e.target.value; load(); };
    load();
  };

  Dal.pages.agent = async (app, { id }, _q, alive) => {
    let d; try { d = await Dal.api('/agents/' + id); } catch (e) { return mount(app, html`<div class="container section">${Dal.empty('مشاور پیدا نشد', e.message)}</div>`); }
    if (!alive()) return;
    const a = d.agent; Dal.setTitle(a.name);
    const total = d.dist.reduce((s, x) => s + x.n, 0) || 1;
    mount(app, html`<div class="container section">
      <div class="profile-hero">${Dal.avatar(a, 96)}<div class="grow"><h1>${a.name} ${a.verified ? html`<span title="تأییدشده">${icon('shieldc', 26)}</span>` : ''}</h1><div style="opacity:.9">${a.agency || 'مشاور مستقل'}${a.city ? ' · ' + (Dal.city(a.city)?.name || a.city) : ''}</div><div class="row gap-sm mt">${Dal.stars(a.rating, 18)}<b>${a.rating ? dec(a.rating, 1) : 'بدون امتیاز'}</b><span style="opacity:.8">(${num(a.reviews || 0)} نظر)</span></div><div class="chips mt">${(a.specialties || []).map((s) => html`<span class="chip sm" style="background:rgba(255,255,255,.2);color:#fff">${s}</span>`)}</div></div>
        <div class="row gap wrap"><div class="stat"><b>${num(a.active || 0)}</b>آگهی فعال</div><div class="stat"><b>${num(a.closed || 0)}</b>معامله‌ی موفق</div><div class="stat"><b>${num(a.experience || 0)}</b>سال تجربه</div></div></div>
      <div class="l-layout"><div>
        ${a.bio ? html`<div class="panel"><h3>${icon('user', 22)} درباره‌ی مشاور</h3><p style="line-height:2">${a.bio}</p>${a.license_no ? html`<div class="mt muted">شماره‌ی پروانه‌ی کسب: <b class="ltr" dir="ltr">${fa(a.license_no)}</b></div>` : ''}</div>` : ''}
        <div class="panel"><h3>${icon('building', 22)} آگهی‌های ${a.name.split(' ')[0]} (${num(d.total)})</h3>${d.listings.length ? html`<div class="grid cards" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">${d.listings.map((l) => listingCard(l))}</div>${d.total > d.listings.length ? html`<a class="btn ghost mt" href="#/search?owner=${a.id}">مشاهده‌ی همه</a>` : ''}` : raw('<p class="muted">آگهی فعالی وجود ندارد.</p>')}</div>
      </div><aside class="side">
        <div class="panel"><h3 style="font-size:17px">${icon('star', 20)} امتیاز مشتریان</h3>${d.dist.map((x) => html`<div class="bar-row" style="grid-template-columns:36px 1fr 30px;margin:6px 0"><span>${fa(x.stars)} ★</span><span class="bar-t"><span class="bar-f" style="width:${(x.n / total) * 100}%;background:#ffb400"></span></span><span class="bar-v">${num(x.n)}</span></div>`)}</div>
        <form class="panel" id="rv-form"><h3 style="font-size:17px">${icon('edit', 20)} ثبت نظر</h3><div class="rate-pick">${[5, 4, 3, 2, 1].map((i) => html`<input type="radio" name="rating" id="r${i}" value="${i}"><label for="r${i}" title="${i} ستاره">${icon('star', 30)}</label>`)}</div><textarea name="comment" rows="3" placeholder="تجربه‌ی خود را بنویسید…" class="mt" maxlength="500"></textarea><button class="btn primary block mt">ثبت نظر</button></form></aside></div>
      <div class="panel mt-lg"><h3>${icon('msg', 22)} نظرات مشتریان</h3>${d.reviews.length ? d.reviews.map((r) => html`<div class="review">${Dal.avatar({ name: r.user_name, hue: r.user_hue }, 42)}<div><b>${r.user_name}</b> <span class="muted" style="font-size:12px">· ${Dal.ago(r.created_at)}</span><div>${Dal.stars(r.rating, 14)}</div><p>${r.comment || ''}</p></div></div>`) : raw('<p class="muted">هنوز نظری ثبت نشده است.</p>')}</div></div>`);
    $('#rv-form', app).onsubmit = async (e) => {
      e.preventDefault(); if (!Dal.requireLogin('برای ثبت نظر وارد شوید.')) return;
      const rating = e.target.rating.value; if (!rating) return Dal.toast('امتیاز را انتخاب کنید.', 'info');
      const r = await Dal.guard(() => Dal.api(`/agents/${a.id}/reviews`, { method: 'POST', body: { rating: +rating, comment: e.target.comment.value } }), $('button', e.target));
      if (r) { Dal.toast('نظر شما ثبت شد. سپاس ⭐', 'success'); Dal.render(); }
    };
  };

  // ---------------------------------------------------------------- مجله
  Dal.pages.magazine = async (app, _p, query, alive) => {
    Dal.setTitle('مجله‌ی دال'); const cat = query.cat || '';
    const r = await Dal.api('/articles', { query: { category: cat } }); if (!alive()) return;
    mount(app, html`<div class="container section"><div class="sec-head"><div><h1 style="font-size:32px">${icon('book', 30)} مجله‌ی دال</h1><p>راهنمای خرید، رهن و اجاره، حقوق ملک و تحلیل بازار</p></div></div>
      <div class="chips mb"><a class="chip ${!cat ? 'on' : ''}" href="#/magazine">همه</a>${Dal.state.meta.categories.map((c) => html`<a class="chip ${cat === c ? 'on' : ''}" href="#/magazine?cat=${encodeURIComponent(c)}">${c}</a>`)}</div>
      ${r.items.length ? html`<div class="grid g3">${r.items.map((a) => Dal.articleCard(a))}</div>` : (cat ? Dal.empty('مقاله‌ای در این دسته نیست', 'دسته‌ی دیگری را امتحان کنید.') : Dal.empty('هنوز مقاله‌ای منتشر نشده است', 'به‌زودی راهنمای خرید، رهن و اجاره و اخبار بازار کنگان و شیراز اینجا منتشر می‌شود.'))}</div>`);
  };
  Dal.pages.article = async (app, { slug }, _q, alive) => {
    let d; try { d = await Dal.api('/articles/' + slug); } catch (e) { return mount(app, html`<div class="container section">${Dal.empty('مقاله پیدا نشد', e.message)}</div>`); }
    if (!alive()) return; const a = d.article; Dal.setTitle(a.title);
    const body = a.body.split('\n\n').map((blk) => blk.startsWith('## ') ? html`<h2>${blk.slice(3).split('\n')[0]}</h2>${blk.split('\n').slice(1).join('\n') ? html`<p>${blk.split('\n').slice(1).join('\n')}</p>` : ''}` : html`<p>${blk}</p>`);
    mount(app, html`<div class="container section"><article class="article"><div class="crumbs"><a href="#/magazine">مجله</a>${icon('chevl', 14)}<a href="#/magazine?cat=${encodeURIComponent(a.category)}">${a.category}</a></div><h1>${a.title}</h1><div class="muted row gap wrap"><span>${dateFa(a.created_at)}</span><span>·</span><span>${icon('clock', 14)} ${num(a.read_min)} دقیقه مطالعه</span><span>·</span><span>${icon('eye', 14)} ${num(a.views)} بازدید</span><button class="btn sm ghost" id="sh" style="margin-inline-start:auto">${icon('share', 15)} اشتراک</button></div>
      <div class="art-hero" style="--h:${a.hue}"><h2 style="position:relative;z-index:1;padding:0 30px;text-align:center;font-size:26px">${a.excerpt}</h2></div><div class="body">${body}</div>
      <div class="cta mt-lg" style="padding:28px"><div><h3>آماده‌ی قدم بعدی هستید؟</h3><p style="opacity:.85">آگهی‌های مناسب را ببینید یا ارزش ملک خود را برآورد کنید.</p></div><div class="row gap"><a class="btn accent" href="#/search">جستجوی ملک</a><a class="btn" style="background:#fff;color:#2a1b73" href="#/valuation">برآورد قیمت</a></div></div></article>
      <div class="mt-lg"><h2 class="mb">مطالب مرتبط</h2><div class="grid g3">${d.related.map((x) => Dal.articleCard(x))}</div></div></div>`);
    $('#sh', app).onclick = () => Dal.share(a.title);
  };

  // ---------------------------------------------------------------- تابلوی درخواست ملک
  Dal.pages.requests = async (app, _p, query, alive) => {
    Dal.setTitle('تابلوی درخواست ملک');
    const draw = async () => {
      const r = await Dal.api('/requests'); if (!alive()) return;
      mount(app, html`<div class="container section"><div class="sec-head"><div><h1 style="font-size:32px">${icon('target', 30)} تابلوی درخواست ملک</h1><p>ملکی که می‌خواهید را بنویسید؛ مشاوران گزینه‌ها را برایتان می‌فرستند.</p></div><button class="btn primary" id="new-req">${icon('plus', 18)} ثبت درخواست</button></div>
        ${r.items.length ? html`<div class="grid g3">${r.items.map((x) => html`<div class="req-card"><div class="row between"><span class="badge deal ${x.deal}">${Dal.dealName(x.deal)}</span><span class="muted" style="font-size:12px">${Dal.ago(x.created_at)}</span></div><h3>${x.title}</h3>
          <div class="chips">${x.ptype ? html`<span class="chip sm">${Dal.ptypeName(x.ptype).split(' / ')[0]}</span>` : ''}${x.cityName ? html`<span class="chip sm">${icon('pin', 12)} ${x.cityName}${x.districtName ? '، ' + x.districtName : ''}</span>` : ''}${x.area_min ? html`<span class="chip sm">از ${num(x.area_min)} متر</span>` : ''}${x.rooms ? html`<span class="chip sm">${num(x.rooms)} خواب</span>` : ''}${x.budget_max ? html`<span class="chip sm">بودجه تا ${priceShort(x.budget_max)}</span>` : ''}${x.rent_max ? html`<span class="chip sm">اجاره تا ${priceShort(x.rent_max)}</span>` : ''}</div>
          ${x.description ? html`<p class="muted" style="font-size:14px">${x.description}</p>` : ''}
          <div class="row between"><div class="row gap-sm">${Dal.avatar({ name: x.user_name, hue: x.user_hue }, 28)}<span style="font-size:13px">${x.user_name}</span></div>${x.mine ? html`<button class="btn sm danger" data-del="${x.id}">حذف</button>` : Dal.isAgent() ? html`<button class="btn sm primary" data-resp="${x.id}">ارسال پیشنهاد</button>` : ''}</div></div>`)}</div>` : Dal.empty('درخواستی ثبت نشده', 'اولین درخواست را شما ثبت کنید.')}</div>`);
      on(app, 'click', '#new-req', newReq);
      on(app, 'click', '[data-del]', async (e, b) => { if (await Dal.confirm('درخواست حذف شود؟', { danger: true, ok: 'حذف' })) { await Dal.guard(() => Dal.api('/requests/' + b.dataset.del, { method: 'DELETE' })); draw(); } });
      on(app, 'click', '[data-resp]', async (e, b) => {
        const my = await Dal.api('/my/listings');
        const m = Dal.modal(html`<form class="col gap"><label class="fld"><span>آگهی مرتبط (اختیاری)</span><select name="lid"><option value="">— بدون آگهی —</option>${my.items.filter((l) => l.status === 'active').map((l) => html`<option value="${l.id}">${l.title}</option>`)}</select></label><label class="fld"><span>پیام</span><textarea name="msg" rows="3" maxlength="200">سلام، گزینه‌ی مناسبی برای درخواست شما دارم.</textarea></label><button class="btn primary">ارسال</button></form>`, { title: 'ارسال پیشنهاد به درخواست‌دهنده' });
        $('form', m.body).onsubmit = async (ev) => { ev.preventDefault(); const r = await Dal.guard(() => Dal.api(`/requests/${b.dataset.resp}/respond`, { method: 'POST', body: { listing_id: ev.target.lid.value, message: ev.target.msg.value } }), $('button', m.body)); if (r) { m.close(); Dal.toast('پیشنهاد شما ارسال شد ✅', 'success'); } };
      });
    };
    const newReq = () => {
      if (!Dal.requireLogin('برای ثبت درخواست وارد شوید.')) return;
      const meta = Dal.state.meta;
      const m = Dal.modal(html`<form class="col gap" id="rq"><label class="fld"><span>عنوان</span><input name="title" required minlength="5" maxlength="120" placeholder="مثلاً: آپارتمان ۲ خوابه در ونک"></label>
        <div class="form-grid" style="grid-template-columns:1fr 1fr"><label class="fld"><span>نوع معامله</span><select name="deal">${Dal.optionList(meta.deals, 'sale')}</select></label><label class="fld"><span>نوع ملک</span><select name="ptype">${Dal.optionList(meta.ptypes, '', 'هر نوع')}</select></label>
        <label class="fld"><span>شهر</span><select name="city">${Dal.cityOptions('', 'هر شهر')}</select></label><label class="fld"><span>محله</span><select name="district"><option value="">هر محله</option></select></label>
        ${Dal.rangeInput('budget_max', 'سقف بودجه / ودیعه (تومان)', '')}${Dal.rangeInput('rent_max', 'سقف اجاره‌ی ماهانه', '')}
        <label class="fld"><span>حداقل متراژ</span><input name="area_min" inputmode="numeric"></label><label class="fld"><span>حداقل خواب</span><input name="rooms" inputmode="numeric"></label></div>
        <label class="fld"><span>توضیحات</span><textarea name="description" rows="3" maxlength="600"></textarea></label><button class="btn primary">ثبت درخواست</button></form>`, { title: 'ثبت درخواست ملک', wide: true });
      const f = $('#rq', m.body); Dal.bindMoney(f); f.city.onchange = () => mount(f.district, Dal.districtOptions(f.city.value, '', 'هر محله'));
      f.onsubmit = async (e) => { e.preventDefault(); const body = Object.fromEntries(new FormData(f)); body.budget_max = Dal.moneyVal(f.budget_max); body.rent_max = Dal.moneyVal(f.rent_max); const r = await Dal.guard(() => Dal.api('/requests', { method: 'POST', body }), $('button', f)); if (r) { m.close(); Dal.toast('درخواست شما ثبت شد ✅ با ثبت آگهی مرتبط به شما اعلان می‌دهیم.', 'success'); draw(); } };
    };
    await draw();
  };

  // ---------------------------------------------------------------- مقایسه
  Dal.pages.compare = async (app, _p, _q, alive) => {
    Dal.setTitle('مقایسه‌ی املاک');
    const draw = async () => {
      const ids = Dal.compare.list();
      if (!ids.length) return mount(app, html`<div class="container section">${Dal.empty('هنوز ملکی برای مقایسه انتخاب نکرده‌اید', 'روی آیکون مقایسه در کارت آگهی‌ها بزنید (تا ۴ ملک).', html`<a class="btn primary" href="#/search">جستجوی ملک</a>`)}</div>`);
      const { items } = await Dal.api('/listings/compare', { query: { ids: ids.join(',') } }); if (!alive()) return;
      const best = (fn, dir = 'max') => { const vals = items.map(fn).filter((v) => v != null && !isNaN(v)); if (vals.length < 2) return null; return dir === 'max' ? Math.max(...vals) : Math.min(...vals); };
      const rows = [
        ['قیمت / ودیعه', (l) => priceShort(l.price) + ' تومان', (l) => l.price, 'min'], l0(items, 'rent') ? ['اجاره‌ی ماهانه', (l) => (l.rent ? priceShort(l.rent) : '—'), (l) => l.rent || null, 'min'] : null,
        ['قیمت هر متر', (l) => (l.ppm ? priceShort(l.ppm) : '—'), (l) => l.ppm, 'min'], ['متراژ', (l) => num(l.area) + ' متر', (l) => l.area, 'max'], ['اتاق خواب', (l) => num(l.rooms), (l) => l.rooms, 'max'], ['سرویس بهداشتی', (l) => num(l.baths), (l) => l.baths, 'max'],
        ['سال ساخت', (l) => (l.year_built ? fa(l.year_built) : '—'), (l) => l.year_built, 'max'], ['طبقه', (l) => (l.floor != null ? num(l.floor) + (l.floors_total ? ' از ' + num(l.floors_total) : '') : '—')],
        ['پارکینگ', (l) => (l.parking ? '✓' : '✗')], ['انباری', (l) => (l.storage ? '✓' : '✗')], ['آسانسور', (l) => (l.elevator ? '✓' : '✗')], ['نوع سند', (l) => l.doc_type || '—'], ['جهت', (l) => l.direction || '—'], ['تعداد امکانات', (l) => num(l.features.length), (l) => l.features.length, 'max'],
        ['محله', (l) => `${l.districtName}، ${l.cityName}`], ['امنیت محله', (l) => fa(l.scores?.safety ?? '—'), (l) => l.scores?.safety, 'max'], ['حمل‌ونقل', (l) => fa(l.scores?.transit ?? '—'), (l) => l.scores?.transit, 'max'], ['فضای سبز', (l) => fa(l.scores?.green ?? '—'), (l) => l.scores?.green, 'max'], ['مدارس', (l) => fa(l.scores?.school ?? '—'), (l) => l.scores?.school, 'max'],
      ].filter(Boolean);
      mount(app, html`<div class="container section"><div class="sec-head"><div><h1 style="font-size:32px">${icon('compare', 30)} مقایسه‌ی املاک</h1><p>بهترین مقدار در هر ردیف با رنگ سبز مشخص شده است.</p></div><button class="btn ghost" id="clr">پاک‌کردن همه</button></div>
        <div class="table-wrap"><table class="cmp-table"><thead><tr><th></th>${items.map((l) => html`<th style="white-space:normal;min-width:220px;vertical-align:top"><a href="#/listing/${l.id}"><img src="${l.images[0]}" style="border-radius:12px;aspect-ratio:4/3;object-fit:cover;width:100%;margin-bottom:8px" alt=""><b style="color:var(--text);font-size:14px">${l.title}</b></a><button class="btn sm ghost mt" data-rm="${l.id}">${icon('x', 14)} حذف</button></th>`)}</tr></thead>
          <tbody>${rows.map(([label, fn, vf, dir]) => { const b = vf ? best(vf, dir) : null; return html`<tr><td>${label}</td>${items.map((l) => html`<td class="${vf && b != null && vf(l) === b ? 'best' : ''}">${fn(l)}</td>`)}</tr>`; })}</tbody></table></div></div>`);
      on(app, 'click', '[data-rm]', (e, b) => { Dal.compare.toggle(+b.dataset.rm); draw(); });
      $('#clr', app).onclick = () => { Dal.compare.clear(); draw(); };
    };
    const l0 = (items, k) => items.some((l) => l[k]);
    await draw();
  };

  // ---------------------------------------------------------------- درباره‌ی ما
  Dal.pages.about = async (app, _p, query) => {
    Dal.setTitle('درباره‌ی دال');
    const st = await Dal.api('/stats/home');
    mount(app, html`<div class="container section"><div class="profile-hero" style="padding:48px"><div><div class="logo-mark" style="width:72px;height:72px;font-size:46px;border-radius:22px;background:rgba(255,255,255,.2)">د</div></div><div class="grow"><h1 style="font-size:36px">دال؛ جایی که ملک، هوشمند می‌شود</h1><p style="opacity:.92;max-width:640px;margin-top:8px;line-height:2">«دال» اولین حرف «دانایی»، «دَر» و «دار» است؛ یعنی دری به‌سوی خانه‌ای که می‌خواهید. ما با داده، شفافیت و فناوری، خرید و اجاره‌ی ملک را ساده، امن و مطمئن می‌کنیم.</p></div></div>
      <div class="kpis mt-lg">${Dal.kpi('آگهی فعال', num(st.listings), '', 'building')}${Dal.kpi('مشاور', num(st.agents), '', 'users', 'ok')}${Dal.kpi('کاربر', num(st.users), '', 'user', 'acc')}${Dal.kpi('محله‌ی پوشش‌داده‌شده', num(st.districts), `در ${num(st.cities)} شهر`, 'map', 'warn')}</div>
      <div class="grid g3 mt-lg">${[['sparkle', 'جستجوی هوشمند فارسی', 'جمله‌ی خود را بنویسید یا بگویید؛ فیلترها خودکار ساخته می‌شود.'], ['chart', 'داده‌محور و شفاف', 'برآورد قیمت، روند ۲۴ ماهه و امتیاز محله برای هر تصمیم.'], ['shieldc', 'امن و بررسی‌شده', 'آگهی ناشران تأییدنشده پیش از انتشار بررسی می‌شود و هر آگهی قابل گزارش است.'], ['cal', 'رزرو بازدید آنلاین', 'تقویم شمسی، ساعت‌های آزاد و تأیید لحظه‌ای مشاور.'], ['msg', 'چت و اعلان زنده', 'گفتگوی مستقیم با مشاور و اعلان تغییر قیمت و آگهی‌های جدید.'], ['calc', 'ابزارهای کامل مسکن', 'وام، تبدیل رهن و اجاره، توان خرید، بازده و اجاره‌یا‌خرید.']].map(([i, t, d]) => html`<div class="panel" style="margin:0"><span class="kpi-ic" style="margin-bottom:12px">${icon(i, 24)}</span><h3 style="font-size:17px">${t}</h3><p class="muted">${d}</p></div>`)}</div>
      <h2 class="mt-lg mb" id="faq">سؤالات متداول</h2>${Dal.accordion([
        ['ثبت آگهی در دال رایگان است؟', 'بله. ثبت آگهی برای همه رایگان است. آگهی کاربران عادی پس از بررسی تیم دال منتشر می‌شود و آگهی مشاوران تأییدشده بلافاصله فعال می‌شود.'],
        ['«برآورد قیمت هوشمند» چطور کار می‌کند؟', 'ترکیبی از قیمت پایه‌ی محله، سن بنا، طبقه، متراژ، امکانات و آگهی‌های مشابه ثبت‌شده در همان محله. خروجی یک بازه‌ی منطقی همراه با میزان اطمینان است.'],
        ['چطور مشاور تأییدشده شوم؟', 'با ثبت‌نام به‌عنوان مشاور و وارد کردن شماره‌ی پروانه، تیم دال مدارک را بررسی و نشان «تأییدشده» را فعال می‌کند.'],
        ['اعلان آگهی جدید چگونه فعال می‌شود؟', 'در صفحه‌ی جستجو، فیلترها را تنظیم و روی «ذخیره‌ی جستجو و اعلان» بزنید. با ثبت آگهی مطابق، اعلان دریافت می‌کنید.'],
        ['اگر رمز عبورم را فراموش کنم چه کنم؟', 'هنگام ثبت‌نام یک «کد بازیابی» به شما نمایش داده می‌شود. از صفحه‌ی «فراموشی رمز» با موبایل و آن کد می‌توانید رمز جدید بگذارید. اگر کد را هم ندارید، از طریق فرم تماس به مدیر پیام دهید تا رمز موقت برایتان بسازد.'],
        ['اطلاعاتم چقدر امن است؟', 'رمزها با الگوریتم scrypt ذخیره می‌شوند، شماره‌ی تماس تنها با درخواست شما نمایش داده می‌شود و هر آگهی قابل گزارش است.'],
      ])}
      <div class="panel mt-lg" style="max-width:640px"><h3>${icon('phone', 22)} تماس مستقیم با مشاوره</h3><p class="muted mb">تمرکز ویژه‌ی ما بندر کنگان و شیراز است.</p>${Dal.contactButtons()}</div>
      <form class="panel mt-lg" id="contact" style="max-width:640px"><h3>${icon('msg', 22)} با ما تماس بگیرید</h3><div class="col gap"><input name="name" placeholder="نام شما" required minlength="2" value="${Dal.state.user?.name || ''}"><input name="contact" placeholder="ایمیل یا شماره‌ی تماس" required minlength="5"><textarea name="message" rows="4" placeholder="پیام شما" required minlength="10"></textarea><button class="btn primary">ارسال پیام</button></div></form></div>`);
    $('#contact', app).onsubmit = async (e) => { e.preventDefault(); const f = e.target; const r = await Dal.guard(() => Dal.api('/contact', { method: 'POST', body: Object.fromEntries(new FormData(f)) }), $('button', f)); if (r) { f.reset(); Dal.toast('پیام شما برای تیم دال ارسال شد. سپاس 🙏', 'success'); } };
    if (query.faq) $('#faq', app).scrollIntoView();
  };

  Dal.pages.notFound = async (app) => { Dal.setTitle('صفحه پیدا نشد'); mount(app, html`<div class="container section">${Dal.empty('۴۰۴ — صفحه پیدا نشد', 'نشانی را بررسی کنید یا به صفحه‌ی اصلی بازگردید.', html`<a class="btn primary" href="#/">صفحه‌ی اصلی</a>`)}</div>`); };
})();
