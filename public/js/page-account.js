/* دال — ورود/ثبت‌نام، داشبورد کاربر، پیام‌ها */
'use strict';
(function () {
  const { html, raw, icon, num, dec, fa, $, $$, on, mount, listingCard, priceShort, dateFa } = Dal;

  // ---------------------------------------------------------------- dashboard
  const STATUS = { active: ['منتشرشده', 'ok'], pending: ['در انتظار تأیید', 'warn'], rejected: ['ردشده', 'bad'], sold: ['فروخته‌شده', 'info'], rented: ['اجاره‌رفته', 'info'], archived: ['بایگانی', ''] };
  const APPT = { pending: ['در انتظار تأیید', 'warn'], confirmed: ['تأییدشده', 'ok'], cancelled: ['لغوشده', 'bad'], done: ['انجام‌شده', 'info'] };

  const expLeft = (l) => Math.max(0, Dal.state.meta.expireDays - Math.floor((Date.now() - new Date(String(l.renewed_at).replace(' ', 'T') + 'Z')) / 864e5));
  Dal.pages.dashboard = async (app, { tab = 'overview' }, query, alive) => {
    if (!Dal.requireLogin()) return;
    const u = Dal.state.user; Dal.setTitle('داشبورد');
    const dash = await Dal.api('/dashboard'); if (!alive()) return;
    const isAgent = Dal.isAgent();
    const links = [['overview', 'نمای کلی', 'layers'], ['listings', 'آگهی‌های من', 'building', dash.listings.total], ['favorites', 'علاقه‌مندی‌ها', 'heart', dash.favorites], ['searches', 'جستجوهای ذخیره‌شده', 'bell', dash.saved], ['appointments', 'بازدیدها', 'cal', dash.appointmentsPending], ['inquiries', 'درخواست‌ها', 'msg', dash.inquiriesNew], ['profile', 'پروفایل و تنظیمات', 'settings']];
    mount(app, html`<div class="container"><div class="dash-layout"><aside class="dash-side"><div class="me">${Dal.avatar(u, 64)}<h4 style="margin-top:8px">${u.name}</h4><span class="pill info">${{ admin: 'مدیر', agent: 'مشاور', user: 'کاربر' }[u.role]}</span></div>
      ${links.map(([k, l, i, c]) => html`<a href="#/dashboard/${k}" class="${k === tab ? 'on' : ''}">${icon(i, 20)} ${l} ${c ? html`<em>${num(c)}</em>` : ''}</a>`)}<a href="#/messages">${icon('send', 20)} پیام‌ها</a>${u.role === 'admin' ? html`<a href="#/admin">${icon('shield', 20)} پنل مدیریت</a>` : ''}</aside><section id="dash-body"></section></div></div>`);
    const body = $('#dash-body', app);
    const T = {
      overview() {
        mount(body, html`<h1 style="font-size:26px;margin-bottom:6px">سلام ${u.name.split(' ')[0]} 👋</h1><p class="muted mb">خلاصه‌ی فعالیت شما در دال</p>
          <div class="kpis">${Dal.kpi('آگهی‌های فعال', num(dash.listings.active), `${num(dash.listings.total)} آگهی در کل`, 'building')}${Dal.kpi('کل بازدیدها', num(dash.listings.views), '', 'eye', 'ok')}${Dal.kpi('ذخیره‌شده توسط دیگران', num(dash.favoritesOnMine), '', 'heart', 'acc')}${Dal.kpi('درخواست جدید', num(dash.inquiriesNew), '', 'msg', dash.inquiriesNew ? 'bad' : '')}${Dal.kpi('بازدید در انتظار تأیید', num(dash.appointmentsPending), '', 'cal', 'warn')}</div>
          <div class="grid g2 mt-lg" style="align-items:start"><div class="panel" style="margin:0"><h3>${icon('chart', 22)} بازدید آگهی‌ها (۱۴ روز اخیر)</h3>${dash.series.length ? Dal.charts.columns(dash.series.map((x) => ({ x: dateFa(x.day, { day: 'numeric' }), y: x.n }))) : raw('<p class="muted">هنوز بازدیدی ثبت نشده است.</p>')}</div>
          <div class="panel" style="margin:0"><h3>${icon('zap', 22)} اقدام سریع</h3><div class="col gap"><a class="btn primary" href="#/new">${icon('plus', 18)} ثبت آگهی جدید</a><a class="btn" href="#/valuation">${icon('sparkle', 18)} برآورد قیمت ملک</a><a class="btn" href="#/requests">${icon('target', 18)} ثبت درخواست ملک</a><a class="btn" href="#/dashboard/profile">${icon('settings', 18)} تکمیل پروفایل</a></div></div></div>`);
      },
      async listings() {
        const r = await Dal.api('/my/listings'); if (!alive()) return;
        mount(body, html`<div class="row between wrap gap mb"><h1 style="font-size:24px">آگهی‌های من (${num(r.items.length)})</h1><div class="row gap"><button class="btn ghost" id="csv">${icon('upload', 16)} خروجی CSV</button><a class="btn primary" href="#/new">${icon('plus', 18)} آگهی جدید</a></div></div>
          ${r.items.length ? r.items.map((l) => html`<div class="list-row"><img src="${l.images[0]}" alt=""><div class="main"><h4><a href="#/listing/${l.id}">${l.title}</a></h4><div class="muted" style="font-size:13px">${l.districtName}، ${l.cityName} · ${num(l.area)} متر · کد ${fa(l.code)}</div>${l.reject_reason ? html`<div class="down" style="font-size:12.5px">دلیل رد: ${l.reject_reason}</div>` : ''}<div class="row gap wrap mt" style="font-size:13px"><span class="pill ${STATUS[l.status][1]}">${STATUS[l.status][0]}</span><span class="muted">${icon('eye', 14)} ${num(l.views)}</span><span class="muted">${icon('heart', 14)} ${num(l.fav_count)}</span><span class="muted">${icon('msg', 14)} ${num(l.inq_count)}</span></div></div><div><b style="color:var(--primary)">${Dal.listingPrice(l).main}</b><div class="muted" style="font-size:12px">${Dal.dealName(l.deal)}</div></div><div class="col gap-sm" style="align-items:flex-end"><div class="row gap-sm wrap"><a class="btn sm" href="#/edit/${l.id}">${icon('edit', 15)} ویرایش</a>${l.status === 'active' ? html`<button class="btn sm" data-renew="${l.id}" title="تمدید ${num(Dal.state.meta.expireDays)} روزه">${icon('refresh', 15)} تمدید</button>` : ''}<button class="btn sm danger" data-del="${l.id}">${icon('trash', 15)}</button></div>
            <div class="row gap-sm wrap">${l.status === 'active' ? html`<button class="btn sm ghost" data-st="${l.deal === 'rent' ? 'rented' : 'sold'}" data-id="${l.id}">${l.deal === 'rent' ? 'اجاره رفت' : 'فروخته شد'}</button><button class="btn sm ghost" data-st="archived" data-id="${l.id}">بایگانی</button>` : ['sold', 'rented', 'archived'].includes(l.status) ? html`<button class="btn sm ghost" data-st="active" data-id="${l.id}">فعال‌سازی دوباره</button>` : ''}</div>
            ${l.status === 'active' && l.renewed_at ? html`${l.status === 'active' && !l.featured ? html`<button class="btn sm gold" data-boost="${l.id}">${icon('sparkle', 14)} ویژه کن</button>` : ''}<span class="muted" style="font-size:12px">${expLeft(l) <= 10 ? '⏳ ' : ''}${num(expLeft(l))} روز تا انقضا</span>` : ''}</div></div>`) : Dal.empty('هنوز آگهی ثبت نکرده‌اید', 'اولین آگهی‌تان را رایگان ثبت کنید.', html`<a class="btn primary" href="#/new">ثبت آگهی</a>`)}`);
        on(body, 'click', '[data-boost]', (e, b) => Dal.openBoost(r.items.find((x) => x.id === +b.dataset.boost)));
        on(body, 'click', '[data-renew]', async (e, b) => { const r2 = await Dal.guard(() => Dal.api(`/listings/${b.dataset.renew}/renew`, { method: 'POST', body: {} }), b); if (r2) { Dal.toast('آگهی تمدید شد ✅', 'success'); T.listings(); } });
        on(body, 'click', '[data-st]', async (e, b) => { const r2 = await Dal.guard(() => Dal.api(`/listings/${b.dataset.id}/status`, { method: 'PUT', body: { status: b.dataset.st } }), b); if (r2) { Dal.toast(r2.status === 'pending' ? 'آگهی برای بررسی ارسال شد.' : 'وضعیت آگهی به‌روز شد ✅', 'success'); T.listings(); } });
        on(body, 'click', '[data-del]', async (e, b) => { if (await Dal.confirm('این آگهی حذف شود؟', { danger: true, ok: 'حذف' })) { await Dal.guard(() => Dal.api('/listings/' + b.dataset.del, { method: 'DELETE' })); T.listings(); } });
        $('#csv', body)?.addEventListener('click', async () => { const res = await fetch('/api/my/listings.csv', { headers: { Authorization: 'Bearer ' + Dal.token() } }); const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dal-listings.csv'; a.click(); });
      },
      async favorites() {
        const r = await Dal.api('/favorites'); if (!alive()) return;
        mount(body, html`<h1 style="font-size:24px;margin-bottom:16px">علاقه‌مندی‌ها (${num(r.items.length)})</h1>${r.items.length ? html`<div class="grid cards" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">${r.items.map((l) => listingCard(l))}</div><a class="btn mt" href="#/compare">${icon('compare', 16)} مقایسه‌ی انتخاب‌ها</a>` : Dal.empty('هنوز آگهی‌ای ذخیره نکرده‌اید', 'روی قلب کارت هر آگهی بزنید.', html`<a class="btn primary" href="#/search">جستجو</a>`)}`);
      },
      async searches() {
        const r = await Dal.api('/saved-searches'); if (!alive()) return;
        mount(body, html`<h1 style="font-size:24px;margin-bottom:16px">جستجوهای ذخیره‌شده</h1>${r.items.length ? r.items.map((s) => html`<div class="list-row"><span class="kpi-ic">${icon('search', 22)}</span><div class="main"><h4>${s.name}</h4><span class="muted" style="font-size:13px">${num(s.count)} آگهی مطابق این جستجو</span></div><label class="check"><span class="switch"><input type="checkbox" data-notify="${s.id}" ${s.notify ? 'checked' : ''}><i></i></span> اعلان</label><a class="btn sm primary" href="#/search?${new URLSearchParams(s.query)}">مشاهده</a><button class="btn sm danger" data-del="${s.id}">${icon('trash', 15)}</button></div>`) : Dal.empty('جستجویی ذخیره نشده', 'در صفحه‌ی جستجو فیلترها را تنظیم و «ذخیره‌ی جستجو» را بزنید.', html`<a class="btn primary" href="#/search">رفتن به جستجو</a>`)}`);
        on(body, 'change', '[data-notify]', (e, i) => Dal.guard(() => Dal.api('/saved-searches/' + i.dataset.notify, { method: 'PUT', body: { notify: i.checked } })));
        on(body, 'click', '[data-del]', async (e, b) => { await Dal.guard(() => Dal.api('/saved-searches/' + b.dataset.del, { method: 'DELETE' })); T.searches(); });
      },
      async appointments() {
        const r = await Dal.api('/appointments'); if (!alive()) return;
        const row = (a, recv) => html`<div class="list-row"><img src="${a.image}" alt=""><div class="main"><h4><a href="#/listing/${a.listing_id}">${a.title}</a></h4><div class="muted" style="font-size:13px">${icon('cal', 14)} ${dateFa(a.date)} · ساعت ${fa(a.time)}</div><div style="font-size:13px">${recv ? html`درخواست‌دهنده: <b>${a.buyer_name}</b> <span class="ltr" dir="ltr">${fa(a.buyer_phone)}</span>` : html`مشاور: <b>${a.agent_name}</b>`}</div>${a.note ? html`<div class="muted" style="font-size:12.5px">«${a.note}»</div>` : ''}</div><span class="pill ${APPT[a.status][1]}">${APPT[a.status][0]}</span><div class="row gap-sm">${recv && a.status === 'pending' ? html`<button class="btn sm ok" data-ap="${a.id}" data-s="confirmed">تأیید</button>` : ''}${recv && a.status === 'confirmed' ? html`<button class="btn sm primary" data-ap="${a.id}" data-s="done">انجام شد</button>` : ''}${['pending', 'confirmed'].includes(a.status) ? html`<button class="btn sm ghost" data-ap="${a.id}" data-s="cancelled">لغو</button>` : ''}</div></div>`;
        mount(body, html`${r.received.length ? html`<h2 style="font-size:20px;margin-bottom:12px">درخواست‌های بازدید دریافتی (${num(r.received.length)})</h2>${r.received.map((a) => row(a, true))}<div class="divider"></div>` : ''}<h2 style="font-size:20px;margin-bottom:12px">بازدیدهای من (${num(r.mine.length)})</h2>${r.mine.length ? r.mine.map((a) => row(a, false)) : Dal.empty('بازدیدی رزرو نکرده‌اید', 'از صفحه‌ی هر آگهی می‌توانید وقت بازدید بگیرید.')}`);
        on(body, 'click', '[data-ap]', async (e, b) => { const ok = await Dal.guard(() => Dal.api('/appointments/' + b.dataset.ap, { method: 'PUT', body: { status: b.dataset.s } }), b); if (ok) { Dal.toast('وضعیت بازدید به‌روز شد.', 'success'); T.appointments(); Dal.pollNotifs(); } });
      },
      async inquiries() {
        const [rec, sent] = await Promise.all([Dal.api('/inquiries', { query: { box: 'received' } }), Dal.api('/inquiries', { query: { box: 'sent' } })]); if (!alive()) return;
        const ST = { new: ['جدید', 'warn'], contacted: ['پیگیری‌شده', 'ok'], closed: ['بسته‌شده', ''] };
        mount(body, html`<h2 style="font-size:20px;margin-bottom:12px">دریافتی (${num(rec.items.length)})</h2>${rec.items.length ? rec.items.map((i) => html`<div class="list-row"><div class="main"><h4>${i.name} <span class="ltr muted" dir="ltr">${fa(i.phone)}</span></h4><div style="font-size:14px">${i.message}</div><div class="muted" style="font-size:12.5px">درباره‌ی: <a href="#/listing/${i.listing_id}">${i.title}</a> · ${Dal.ago(i.created_at)}</div></div><span class="pill ${ST[i.status][1]}">${ST[i.status][0]}</span>${i.status === 'new' ? html`<button class="btn sm ok" data-in="${i.id}">پیگیری شد</button>` : ''}<a class="btn sm" href="tel:${i.phone}">${icon('phone', 15)} تماس</a></div>`) : raw('<p class="muted mb">درخواستی دریافت نشده است.</p>')}
          <div class="divider"></div><h2 style="font-size:20px;margin-bottom:12px">ارسال‌شده (${num(sent.items.length)})</h2>${sent.items.length ? sent.items.map((i) => html`<div class="list-row"><div class="main"><h4><a href="#/listing/${i.listing_id}">${i.title}</a></h4><div style="font-size:14px">${i.message}</div><div class="muted" style="font-size:12.5px">${Dal.ago(i.created_at)}</div></div></div>`) : raw('<p class="muted">درخواستی ارسال نکرده‌اید.</p>')}`);
        on(body, 'click', '[data-in]', async (e, b) => { await Dal.guard(() => Dal.api('/inquiries/' + b.dataset.in, { method: 'PUT', body: { status: 'contacted' } })); T.inquiries(); });
      },
      profile() {
        const me = Dal.state.user;
        mount(body, html`<h1 style="font-size:24px;margin-bottom:16px">پروفایل و تنظیمات</h1><form class="panel" id="pf"><div class="form-grid"><label class="fld"><span>نام و نام خانوادگی</span><input name="name" value="${me.name}" required></label><label class="fld"><span>موبایل</span><input value="${fa(me.phone)}" disabled></label><label class="fld"><span>ایمیل</span><input name="email" type="email" value="${me.email || ''}" dir="ltr" style="text-align:right"></label>
          <label class="fld"><span>شهر</span><select name="city">${Dal.cityOptions(me.city, '—')}</select></label>
          ${me.role !== 'user' ? html`<label class="fld"><span>آژانس</span><input name="agency" value="${me.agency || ''}"></label><label class="fld"><span>شماره‌ی پروانه</span><input name="license_no" value="${me.license_no || ''}"></label><label class="fld"><span>سال‌های تجربه</span><input name="experience" inputmode="numeric" value="${me.experience || 0}"></label><label class="fld"><span>تخصص‌ها (با ویرگول جدا کنید)</span><input name="specialties" value="${(me.specialties || []).join('، ')}"></label>` : ''}</div>
          <label class="fld mt"><span>درباره‌ی من</span><textarea name="bio" rows="3" maxlength="500">${me.bio || ''}</textarea></label><button class="btn primary mt">ذخیره‌ی تغییرات</button></form>
          <form class="panel" id="pw"><h3>${icon('lock', 22)} تغییر رمز عبور</h3><div class="form-grid"><label class="fld"><span>رمز فعلی</span><input type="password" name="old" required autocomplete="current-password"></label><label class="fld"><span>رمز جدید</span><input type="password" name="password" minlength="8" required autocomplete="new-password" placeholder="حداقل ۸ نویسه با حرف و عدد"></label></div><button class="btn mt">تغییر رمز</button></form>
          <div class="panel"><h3>${icon('key', 22)} کد بازیابی رمز</h3><p class="muted mb">اگر رمزتان را فراموش کنید، با این کد می‌توانید دوباره وارد شوید. با ساخت کد جدید، کد قبلی باطل می‌شود.</p><button class="btn" id="rec">ساخت کد بازیابی جدید</button></div>
          <div class="panel"><h3>${icon('settings', 22)} ترجیحات</h3><div class="row between"><span>پوسته‌ی تیره</span><label class="switch"><input type="checkbox" id="dark-sw" ${document.documentElement.dataset.theme === 'dark' ? 'checked' : ''}><i></i></label></div><div class="divider"></div><div class="row gap wrap"><button class="btn danger" id="lo">${icon('logout', 18)} خروج از حساب</button><button class="btn ghost" id="del-acc" style="color:var(--bad)">${icon('trash', 18)} حذف حساب</button></div></div>`);
        $('#pf', body).onsubmit = async (e) => { e.preventDefault(); const f = e.target; const b = { name: f.name.value, email: f.email.value, city: f.city.value, bio: f.bio.value }; if (f.agency) { b.agency = f.agency.value; b.license_no = f.license_no.value; b.experience = f.experience.value; b.specialties = f.specialties.value.split(/[,،]/).map((x) => x.trim()).filter(Boolean); }
          const r = await Dal.guard(() => Dal.api('/me', { method: 'PUT', body: b }), $('button', f)); if (r) { Dal.setSession(null, r.user); Dal.toast('پروفایل ذخیره شد ✅', 'success'); } };
        $('#pw', body).onsubmit = async (e) => { e.preventDefault(); const f = e.target; const r = await Dal.guard(() => Dal.api('/me/password', { method: 'PUT', body: { old: f.old.value, password: f.password.value } }), $('button', f)); if (r) { f.reset(); if (r.token) Dal.setSession(r.token, Dal.state.user); Dal.toast('رمز عبور تغییر کرد.', 'success'); } };
        $('#rec', body).onclick = () => { const m = Dal.modal(html`<form class="col gap"><label class="fld"><span>رمز عبور فعلی</span><input type="password" name="p" required autocomplete="current-password"></label><button class="btn primary">ساخت کد جدید</button></form>`, { title: 'کد بازیابی جدید' }); $('form', m.body).onsubmit = async (ev) => { ev.preventDefault(); const r = await Dal.guard(() => Dal.api('/me/recovery', { method: 'POST', body: { password: ev.target.p.value } }), $('button', m.body)); if (r) { m.close(); await Dal.showRecovery(r.recovery, { title: 'کد بازیابی جدید شما' }); } }; };
        $('#del-acc', body).onclick = () => { const m = Dal.modal(html`<form class="col gap"><p>با حذف حساب، تمام آگهی‌ها، پیام‌ها و اطلاعات شما برای همیشه پاک می‌شود و قابل بازگشت نیست.</p><label class="fld"><span>برای تأیید، رمز عبور را وارد کنید</span><input type="password" name="p" required autocomplete="current-password"></label><button class="btn danger">حذف همیشگی حساب</button></form>`, { title: 'حذف حساب' }); $('form', m.body).onsubmit = async (ev) => { ev.preventDefault(); const r = await Dal.guard(() => Dal.api('/me', { method: 'DELETE', body: { password: ev.target.p.value } }), $('button', m.body)); if (r) { m.close(); Dal.logout(true); Dal.toast('حساب شما حذف شد.', 'success'); location.hash = '#/'; } }; };
        $('#dark-sw', body).onchange = () => $('#theme-btn').click(); $('#lo', body).onclick = () => Dal.logout();
      },
    };
    await (T[tab] || T.overview)();
  };

  // ---------------------------------------------------------------- messages
  Dal.pages.messages = async (app, { id }, _q, alive) => {
    if (!Dal.requireLogin()) return;
    Dal.setTitle('پیام‌ها');
    const threads = (await Dal.api('/threads')).items; if (!alive()) return;
    mount(app, html`<div class="container"><div class="chat ${id ? 'has-thread' : ''}"><div class="chat-list">${threads.length ? threads.map((t) => html`<a class="chat-item ${String(t.id) === String(id) ? 'on' : ''}" href="#/messages/${t.id}">${Dal.avatar(t.other, 44)}<div class="t"><b>${t.other.name}</b><span>${t.listing_title || ''}</span><span>${t.last || ''}</span></div>${t.unread ? html`<span class="dot-badge" style="position:static">${num(t.unread)}</span>` : ''}</a>`) : html`<div class="empty">${icon('msg', 40)}<p>هنوز گفتگویی ندارید.</p><a class="btn primary sm" href="#/search">جستجوی ملک</a></div>`}</div>
      <div class="chat-main" id="chat-main">${id ? '' : html`<div class="empty" style="margin:auto">${icon('msg', 56)}<h3>یک گفتگو را انتخاب کنید</h3></div>`}</div></div></div>`);
    if (!id) return;
    const main = $('#chat-main', app); let lastCount = -1;
    const load = async (first) => {
      let d; try { d = await Dal.api('/threads/' + id); } catch (e) { mount(main, Dal.empty('گفتگو پیدا نشد', e.message)); return clearInterval(timer); }
      if (!alive()) return clearInterval(timer);
      if (first) {
        const l = d.thread.listing;
        mount(main, html`<div class="chat-head"><a href="#/messages" class="hbtn" style="display:none" id="back-chat">${icon('chevr', 18)}</a>${Dal.avatar(d.thread.other, 44)}<div class="grow"><b>${d.thread.other.name}</b>${l ? html`<div><a class="muted" style="font-size:13px" href="#/listing/${l.id}">${l.title}</a></div>` : ''}</div>${l ? html`<a href="#/listing/${l.id}"><img src="${l.images[0]}" alt="" style="width:64px;height:48px;object-fit:cover;border-radius:10px"></a>` : ''}</div><div class="chat-msgs" id="msgs"></div><form class="chat-form" id="cf"><input name="body" placeholder="پیام خود را بنویسید…" autocomplete="off" required maxlength="2000"><button class="btn primary" aria-label="ارسال">${icon('send', 18)}</button></form>`);
        $('#cf', main).onsubmit = async (e) => { e.preventDefault(); const inp = e.target.body; const body = inp.value.trim(); if (!body) return; inp.value = ''; const r = await Dal.guard(() => Dal.api(`/threads/${id}/messages`, { method: 'POST', body: { body } })); if (r) load(); else inp.value = body; };
        if (innerWidth < 760) { const bb = $('#back-chat', main); bb.style.display = 'grid'; }
      }
      if (d.messages.length !== lastCount) {
        lastCount = d.messages.length; const box = $('#msgs', main); const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80 || first;
        mount(box, html`${d.messages.map((m) => html`<div class="msg ${m.sender_id === d.me ? 'me' : 'them'}">${m.body}<small>${Dal.timeFa(m.created_at)}</small></div>`)}`);
        if (atBottom) box.scrollTop = box.scrollHeight; Dal.pollNotifs();
      }
    };
    const timer = setInterval(() => load(false), 5000); Dal.cleanup.push(() => clearInterval(timer));
    await load(true);
  };
})();
