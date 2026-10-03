/* دال — پنل مدیریت */
'use strict';
(function () {
  const { html, raw, icon, num, fa, $, $$, on, mount, dateFa } = Dal;
  const STATUS = { active: ['منتشرشده', 'ok'], pending: ['در انتظار', 'warn'], rejected: ['ردشده', 'bad'], sold: ['فروخته‌شده', 'info'], rented: ['اجاره‌رفته', 'info'], archived: ['بایگانی', ''] };

  Dal.pages.admin = async (app, { tab = 'overview' }, query, alive) => {
    if (!Dal.requireLogin()) return;
    if (Dal.state.user.role !== 'admin') { mount(app, html`<div class="container section">${Dal.empty('دسترسی مجاز نیست', 'این بخش مخصوص مدیران است.', html`<a class="btn primary" href="#/">خانه</a>`)}</div>`); return; }
    Dal.setTitle('پنل مدیریت');
    const st = await Dal.api('/admin/stats'); if (!alive()) return;
    const tabs = [['overview', 'نمای کلی', 'chart'], ['listings', 'مدیریت آگهی‌ها', 'building', st.pending], ['users', 'کاربران و مشاوران', 'users', st.pendingAgents], ['reports', 'گزارش‌ها', 'flag', st.reports], ['contacts', 'پیام‌های تماس', 'msg', st.contacts], ['articles', 'مجله', 'book'], ['promo', 'ویژه‌سازی و درآمد', 'sparkle'], ['settings', 'تنظیمات', 'settings']];
    mount(app, html`<div class="container section"><div class="sec-head"><div><h1 style="font-size:30px">${icon('shield', 28)} پنل مدیریت دال</h1><p>نظارت بر آگهی‌ها، کاربران و گزارش‌ها</p></div></div>
      <div class="tabs">${tabs.map(([k, l, i, c]) => html`<a class="tab ${k === tab ? 'on' : ''}" href="#/admin/${k}">${icon(i, 17)} ${l} ${c ? html`<em>${num(c)}</em>` : ''}</a>`)}</div><div id="adm"></div></div>`);
    const body = $('#adm', app);
    const T = {
      promo() { return Dal.adminTabs.promo(body); },
      overview() {
        mount(body, html`<div class="kpis">${Dal.kpi('کاربران', num(st.users), `${num(st.agents)} مشاور`, 'users')}${Dal.kpi('آگهی‌های فعال', num(st.active), `از ${num(st.listings)} آگهی`, 'building', 'ok')}${Dal.kpi('در انتظار تأیید', num(st.pending), '', 'clock', st.pending ? 'warn' : '')}${Dal.kpi('گزارش‌های باز', num(st.reports), '', 'flag', st.reports ? 'bad' : '')}${Dal.kpi('کل بازدید', num(st.views), '', 'eye', 'acc')}${Dal.kpi('درخواست مشاوره', num(st.inquiries), `${num(st.appointments)} رزرو بازدید`, 'msg')}</div>
          <div class="grid g2 mt-lg"><div class="panel" style="margin:0"><h3>${icon('chart', 22)} ترافیک ۱۴ روز اخیر</h3>${st.traffic.length ? Dal.charts.columns(st.traffic.map((x) => ({ x: dateFa(x.day, { day: 'numeric' }), y: x.n }))) : raw('<p class="muted">—</p>')}</div>
          <div class="panel" style="margin:0"><h3>${icon('layers', 22)} وضعیت آگهی‌ها</h3>${Dal.charts.donut(st.byStatus.map((s) => ({ label: STATUS[s.status]?.[0] || s.status, value: s.n })), { label: 'آگهی' })}</div></div>
          <div class="panel mt-lg"><h3>${icon('user', 22)} ثبت‌نام‌های ۳۰ روز اخیر</h3>${st.signups.length ? Dal.charts.columns(st.signups.map((x) => ({ x: dateFa(x.day, { day: 'numeric' }), y: x.n })), { color: 'var(--accent)' }) : raw('<p class="muted">ثبت‌نام جدیدی نبوده است.</p>')}</div>`);
      },
      async listings() {
        let status = query.status || 'pending', page = 1;
        const load = async () => {
          const r = await Dal.api('/admin/listings', { query: { status, page, limit: 10, sort: 'newest' } }); if (!alive()) return;
          mount(body, html`<div class="chips mb">${[['pending', 'در انتظار'], ['active', 'منتشرشده'], ['rejected', 'ردشده'], ['sold', 'فروخته'], ['rented', 'اجاره‌رفته'], ['archived', 'بایگانی']].map(([k, l]) => html`<button class="chip ${status === k ? 'on' : ''}" data-s="${k}">${l}</button>`)}</div>
            ${r.items.length ? r.items.map((l) => html`<div class="list-row"><img src="${l.images[0]}" alt=""><div class="main"><h4><a href="#/listing/${l.id}">${l.title}</a></h4><div class="muted" style="font-size:13px">${l.districtName}، ${l.cityName} · ${Dal.dealName(l.deal)} · ${l.owner.name} (${{ agent: 'مشاور', user: 'کاربر', admin: 'مدیر' }[l.owner.role]}) · کد ${fa(l.code)}</div><div class="row gap wrap mt"><span class="pill ${STATUS[l.status][1]}">${STATUS[l.status][0]}</span>${l.featured ? raw('<span class="pill warn">ویژه</span>') : ''}${l.verified ? raw('<span class="pill ok">تأییدشده</span>') : ''}</div></div>
              <div class="row gap-sm wrap">${l.status !== 'active' ? html`<button class="btn sm ok" data-a="${l.id}" data-v="active">تأیید و انتشار</button>` : ''}${l.status !== 'rejected' ? html`<button class="btn sm danger" data-rej="${l.id}">رد</button>` : ''}<button class="btn sm ghost" data-ldel="${l.id}" style="color:var(--bad)">${icon('trash', 14)} حذف</button><button class="btn sm ${l.featured ? 'primary' : 'ghost'}" data-feat="${l.id}" data-on="${l.featured ? 0 : 1}">${icon('sparkle', 14)} ${l.featured ? 'حذف ویژه' : 'ویژه'}</button><button class="btn sm ${l.verified ? 'primary' : 'ghost'}" data-ver="${l.id}" data-on="${l.verified ? 0 : 1}">${icon('shieldc', 14)} ${l.verified ? 'لغو تأیید مدارک' : 'تأیید مدارک'}</button></div></div>`) : Dal.empty('آگهی‌ای در این وضعیت نیست', '')}
            ${Dal.pager(page, r.pages, () => '#')}`);
        };
        on(body, 'click', '[data-s]', (e, b) => { status = b.dataset.s; page = 1; load(); });
        on(body, 'click', '[data-page]', (e, a) => { e.preventDefault(); page = +a.dataset.page; load(); });
        const put = async (id, b) => { const r = await Dal.guard(() => Dal.api('/admin/listings/' + id, { method: 'PUT', body: b })); if (r) { Dal.toast('انجام شد ✅', 'success'); load(); } };
        on(body, 'click', '[data-ldel]', async (e, b) => { if (await Dal.confirm('این آگهی برای همیشه حذف شود؟', { danger: true, ok: 'حذف' })) { const r = await Dal.guard(() => Dal.api('/admin/listings/' + b.dataset.ldel, { method: 'DELETE' })); if (r) { Dal.toast('حذف شد.', 'success'); load(); } } });
        on(body, 'click', '[data-a]', (e, b) => put(b.dataset.a, { status: b.dataset.v }));
        on(body, 'click', '[data-feat]', (e, b) => put(b.dataset.feat, { featured: !!+b.dataset.on }));
        on(body, 'click', '[data-ver]', (e, b) => put(b.dataset.ver, { verified: !!+b.dataset.on }));
        on(body, 'click', '[data-rej]', (e, b) => {
          const m = Dal.modal(html`<form class="col gap"><label class="fld"><span>دلیل رد (برای مالک آگهی ارسال می‌شود)</span><textarea name="r" rows="3" required>اطلاعات یا تصاویر آگهی با قوانین دال مطابقت ندارد.</textarea></label><button class="btn danger">رد آگهی</button></form>`, { title: 'رد آگهی' });
          $('form', m.body).onsubmit = async (ev) => { ev.preventDefault(); m.close(); put(b.dataset.rej, { status: 'rejected', reject_reason: ev.target.r.value }); };
        });
        await load();
      },
      async users() {
        let q = '', role = '';
        const load = async () => {
          const r = await Dal.api('/admin/users', { query: { q, role } }); if (!alive()) return; const box = $('#u-list', body);
          mount(box, html`<div class="table-wrap"><table><thead><tr><th>نام</th><th>موبایل</th><th>نقش</th><th>آژانس</th><th>آگهی</th><th>عضویت</th><th>وضعیت</th><th></th></tr></thead><tbody>${r.items.map((u) => html`<tr><td><b>${u.name}</b></td><td class="ltr">${fa(u.phone)}</td><td><select data-role="${u.id}" style="min-height:34px;padding:2px 8px;width:auto">${Dal.optionList({ user: 'کاربر', agent: 'مشاور', admin: 'مدیر' }, u.role)}</select></td><td>${u.agency || '—'}</td><td>${num(u.listings)}</td><td>${dateFa(u.created_at)}</td><td>${u.banned ? raw('<span class="pill bad">مسدود</span>') : u.verified ? raw('<span class="pill ok">تأییدشده</span>') : raw('<span class="pill">عادی</span>')}</td>
            <td class="row gap-sm">${u.role === 'agent' ? html`<button class="btn sm ${u.verified ? 'ghost' : 'ok'}" data-ver="${u.id}" data-on="${u.verified ? 0 : 1}">${u.verified ? 'لغو تأیید' : 'تأیید مشاور'}</button>` : ''}<button class="btn sm ${u.banned ? 'primary' : 'danger'}" data-ban="${u.id}" data-on="${u.banned ? 0 : 1}">${u.banned ? 'رفع مسدودی' : 'مسدود'}</button><button class="btn sm ghost" data-rp="${u.id}" title="ساخت رمز موقت">${icon('key', 14)}</button><button class="btn sm ghost" data-du="${u.id}" title="حذف کاربر" style="color:var(--bad)">${icon('trash', 14)}</button></td></tr>`)}</tbody></table></div>`);
        };
        mount(body, html`<div class="row gap wrap mb"><button class="btn primary" id="add-staff">${icon('plus', 16)} افزودن همکار / مشاور</button><input id="uq" placeholder="جستجوی نام یا موبایل…" style="max-width:300px"><select id="ur" style="width:auto">${Dal.optionList({ user: 'کاربران', agent: 'مشاوران', admin: 'مدیران' }, '', 'همه‌ی نقش‌ها')}</select></div><div id="u-list"></div>`);
        $('#uq', body).addEventListener('input', Dal.debounce((e) => { q = e.target.value; load(); }, 350)); $('#ur', body).onchange = (e) => { role = e.target.value; load(); };
        const put = async (id, b) => { const r = await Dal.guard(() => Dal.api('/admin/users/' + id, { method: 'PUT', body: b })); if (r) { Dal.toast('ذخیره شد ✅', 'success'); load(); } };
        on(body, 'change', '[data-role]', (e, s) => put(s.dataset.role, { role: s.value }));
        on(body, 'click', '[data-ver]', (e, b) => put(b.dataset.ver, { verified: !!+b.dataset.on }));
        on(body, 'click', '[data-ban]', async (e, b) => { if (!+b.dataset.on || await Dal.confirm('این کاربر مسدود شود؟', { danger: true, ok: 'مسدود کن' })) put(b.dataset.ban, { banned: !!+b.dataset.on }); });
        on(body, 'click', '[data-rp]', async (e, b) => { if (!await Dal.confirm('رمز این کاربر بازنشانی و یک رمز موقت ساخته شود؟ (نشست‌های فعال او بسته می‌شود)', { ok: 'ساخت رمز موقت' })) return; const r = await Dal.guard(() => Dal.api('/admin/users/' + b.dataset.rp, { method: 'PUT', body: { reset_password: true } })); if (r) Dal.modal(html`<div class="col gap"><p>این رمز را به‌صورت امن به کاربر بدهید و از او بخواهید پس از ورود آن را تغییر دهد. دوباره نمایش داده نمی‌شود.</p><div class="recovery-code" dir="ltr" style="font-size:24px;letter-spacing:2px">${r.temp_password}</div></div>`, { title: 'رمز موقت' }); });
        on(body, 'click', '[data-du]', async (e, b) => { if (await Dal.confirm('این کاربر و تمام آگهی‌ها و پیام‌هایش برای همیشه حذف شود؟', { danger: true, ok: 'حذف همیشگی' })) { const r = await Dal.guard(() => Dal.api('/admin/users/' + b.dataset.du, { method: 'DELETE' })); if (r) { Dal.toast('کاربر حذف شد.', 'success'); load(); } } });
        on(body, 'click', '#add-staff', () => {
          const m = Dal.modal(html`<form id="staff-f" class="form-grid"><p class="muted" style="grid-column:1/-1">برای همکارانی که قرار است آگهی ثبت کنند. رمز موقت ساخته می‌شود و فقط یک‌بار نشان داده می‌شود؛ مشاور تأییدشده آگهی‌هایش مستقیم منتشر می‌شود.</p>
            <label class="fld"><span>نام و نام خانوادگی</span><input name="name" required></label>
            <label class="fld"><span>موبایل</span><input name="phone" required inputmode="numeric" dir="ltr" style="text-align:right" placeholder="09…"></label>
            <label class="fld"><span>نقش</span><select name="role">${Dal.optionList({ agent: 'مشاور / همکار', admin: 'مدیر', user: 'کاربر عادی' }, 'agent')}</select></label>
            <label class="fld"><span>آژانس / دفتر (اختیاری)</span><input name="agency"></label>
            <button class="btn primary" style="grid-column:1/-1">ساخت حساب</button></form>`, { title: 'افزودن همکار' });
          $('#staff-f', m.body).onsubmit = async (e) => {
            e.preventDefault(); const f = e.target;
            const r = await Dal.guard(() => Dal.api('/admin/users', { method: 'POST', body: { name: f.querySelector('[name=name]').value, phone: f.querySelector('[name=phone]').value, role: f.querySelector('[name=role]').value, agency: f.querySelector('[name=agency]').value } }), f.querySelector('button'));
            if (!r) return;
            mount(m.body, html`<div class="panel" style="text-align:center"><h3>حساب ساخته شد ✅</h3><p class="muted">این اطلاعات را همین الان برای همکار بفرستید؛ دوباره نمایش داده نمی‌شود.</p>
              <div class="copy-row"><input readonly dir="ltr" value="${f.querySelector('[name=phone]').value} / ${r.temp_password}"><button class="btn primary" id="cp-cred">کپی</button></div>
              <p class="muted mt">کد بازیابی: <b dir="ltr">${r.recovery}</b></p></div>`);
            $('#cp-cred', m.body).onclick = async () => { try { await navigator.clipboard.writeText(`${f.querySelector('[name=phone]').value} / ${r.temp_password}`); Dal.toast('کپی شد.', 'success'); } catch { $('input', m.body).select(); } };
            load();
          };
        });
        await load();
      },
      async contacts() {
        const F = { status: '', city: '', q: '' };
        const ST = { new: ['جدید', 'warn'], contacted: ['پیگیری‌شده', 'info'], done: ['بسته‌شده', 'ok'] };
        const wa = (ph) => 'https://wa.me/98' + String(ph).replace(/^0/, '').replace(/\D/g, '');
        const load = async () => {
          const qs = new URLSearchParams(Object.entries(F).filter(([, v]) => v)).toString();
          const r = await Dal.api('/admin/contacts' + (qs ? '?' + qs : '')); if (!alive()) return;
          const chips = [['', 'همه', r.counts.new + r.counts.contacted + r.counts.done], ...Object.entries(ST).map(([k, [t]]) => [k, t, r.counts[k]])];
          mount(body, html`<div class="cf-bar"><div class="cf-chips">${chips.map(([k, t, n]) => html`<button class="chip ${F.status === k ? 'on' : ''}" data-st="${k}">${t} <b>${Dal.fa(n)}</b></button>`)}</div>
              <div class="cf-tools"><select id="cf-city" class="mini-select"><option value="">همه‌ی شهرها</option>${(Dal.state.meta.cities || []).map((c) => html`<option value="${c.slug}" ${F.city === c.slug ? 'selected' : ''}>${c.name}</option>`)}</select>
              <input id="cf-q" class="mini-select" placeholder="جستجوی نام یا شماره" value="${F.q}"><button class="btn sm" id="cf-csv">${icon('list', 14)} خروجی CSV</button></div></div>
            ${r.items.length ? r.items.map((x) => html`<div class="list-row" style="align-items:flex-start"><span class="kpi-ic ${x.status === 'new' ? 'acc' : ''}">${icon('msg', 22)}</span>
              <div class="main"><h4>${x.name} ${x.kind ? html`<span class="pill info">مشاوره</span>` : ''} ${x.city ? html`<span class="pill warn">${Dal.city(x.city)?.name || x.city}</span>` : ''}</h4>
                <div class="row gap-sm wrap mb-sm"><a class="btn sm" href="tel:${x.contact}">${icon('phone', 14)} <span class="ltr">${x.contact}</span></a><a class="btn sm" target="_blank" rel="noopener" href="${wa(x.contact)}">واتساپ</a></div>
                <div style="font-size:14px;white-space:pre-wrap">${x.message}</div><div class="muted" style="font-size:12.5px;margin:4px 0">${Dal.ago(x.created_at)}</div>
                <textarea class="note-in" rows="2" data-note="${x.id}" placeholder="یادداشت داخلی (مثلاً: ساعت ۵ تماس گرفته شد)…" style="width:100%">${x.admin_note || ''}</textarea></div>
              <div class="col-end"><span class="pill ${ST[x.status]?.[1] || ''}">${ST[x.status]?.[0] || x.status}</span>
                <div class="row gap-sm wrap">${x.status !== 'contacted' ? html`<button class="btn sm" data-set="${x.id}:contacted">پیگیری شد</button>` : ''}${x.status !== 'done' ? html`<button class="btn sm ok" data-set="${x.id}:done">بستن</button>` : ''}<button class="btn sm danger" data-cd="${x.id}">${icon('trash', 14)}</button></div></div></div>`) : Dal.empty('موردی نیست', 'درخواست‌های مشاوره و پیام‌های «تماس با ما» اینجا نمایش داده می‌شود.')}`);
        };
        on(body, 'click', '[data-st]', (e, b) => { F.status = b.dataset.st; load(); });
        on(body, 'change', '#cf-city', (e, b) => { F.city = b.value; load(); });
        on(body, 'keydown', '#cf-q', (e, b) => { if (e.key === 'Enter') { F.q = b.value.trim(); load(); } });
        on(body, 'click', '[data-set]', async (e, b) => { const [id, status] = b.dataset.set.split(':'); await Dal.guard(() => Dal.api('/admin/contacts/' + id, { method: 'PUT', body: { status } })); load(); });
        on(body, 'change', '[data-note]', async (e, b) => { const ok = await Dal.guard(() => Dal.api('/admin/contacts/' + b.dataset.note, { method: 'PUT', body: { admin_note: b.value } })); if (ok) Dal.toast('یادداشت ذخیره شد.', 'success'); });
        on(body, 'click', '[data-cd]', async (e, b) => { if (!(await Dal.confirm('این مورد حذف شود؟'))) return; await Dal.guard(() => Dal.api('/admin/contacts/' + b.dataset.cd, { method: 'DELETE' })); load(); });
        on(body, 'click', '#cf-csv', async () => {
          const res = await fetch('/api/admin/contacts.csv', { headers: { Authorization: 'Bearer ' + Dal.token() } }).catch(() => null);
          if (!res || !res.ok) return Dal.toast('دریافت فایل ناموفق بود.', 'error');
          const u = URL.createObjectURL(await res.blob()); const a = document.createElement('a'); a.href = u; a.download = 'dal-contacts.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 3000);
        });
        await load();
      },
      async settings() {
        const r = await Dal.api('/admin/site'); if (!alive()) return; const s = r.site, tg = r.telegram, bl = r.bale;
        const stat = (c) => html`<b class="${c.configured ? 'up' : 'down'}">${c.configured ? 'تنظیم شده' : 'تنظیم نشده'}</b>${c.fromEnv ? ' (از متغیر محیطی)' : ''}`;
        mount(body, html`<h2 style="font-size:20px;margin-bottom:14px">تنظیمات سایت</h2>
          <form class="panel" id="site-f"><h3>${icon('phone', 22)} اطلاعات تماس مشاوره</h3><p class="muted mb">در هدر، فوتر، دکمه‌ی شناور «مشاوره»، صفحه‌ی آگهی و صفحه‌ی مشاوره نمایش داده می‌شود. تلفن همه‌جا کار می‌کند؛ «بله» و «ایتا» داخل ایران بدون فیلترشکن در دسترس‌اند.</p>
            <div class="form-grid"><label class="fld"><span>شماره‌های مشاوره (هر خط یک شماره)</span><textarea name="phones" rows="3" dir="ltr" style="text-align:right">${s.phones.join('\n')}</textarea></label>
            <label class="fld"><span>شماره‌ی واتساپ</span><input name="whatsapp" dir="ltr" style="text-align:right" value="${s.whatsapp}"></label>
            <label class="fld"><span>شناسه‌ی بله (بدون @)</span><input name="bale" dir="ltr" value="${s.bale || ''}"></label>
            <label class="fld"><span>شناسه‌ی ایتا (بدون @)</span><input name="eitaa" dir="ltr" value="${s.eitaa || ''}"></label>
            <label class="fld"><span>نام کاربری تلگرام (بدون @)</span><input name="telegram" dir="ltr" value="${s.telegram}"></label>
            <label class="fld"><span>ایمیل</span><input name="email" dir="ltr" value="${s.email}"></label>
            <label class="fld" style="grid-column:1/-1"><span>نشانی دفتر</span><input name="address" value="${s.address}"></label></div>
            <button class="btn primary mt">ذخیره‌ی اطلاعات تماس</button></form>

          <form class="panel" id="bale-f"><h3>${icon('send', 22)} ربات بله — پیشنهادی برای سرور داخل ایران</h3>
            <p class="muted mb">وضعیت: ${stat(bl)}. «بله» همان API تلگرام را دارد و بدون فیلترشکن کار می‌کند. هشدار فوری و پشتیبان روزانه‌ی پایگاه‌داده به آن می‌رسد.</p>
            <ol class="muted mb" style="padding-inline-start:20px;line-height:2"><li>در بله به <b dir="ltr">@botfather</b> پیام بدهید، <b dir="ltr">/newbot</b> بزنید و توکن را بگیرید.</li><li>به ربات خودتان یک پیام بدهید.</li><li>شناسه‌ی عددی گفتگوی خود را بگیرید (مثلاً با ربات‌های «شناسه‌ی کاربر» در بله).</li></ol>
            <div class="form-grid"><label class="fld"><span>توکن ربات بله</span><input name="bale_token" type="password" dir="ltr" placeholder="${bl.configured ? '(ذخیره‌شده — برای تغییر وارد کنید)' : '123456:ABC…'}" autocomplete="off"></label>
            <label class="fld"><span>شناسه‌ی گفتگو (Chat ID)</span><input name="bale_chat" dir="ltr" value="${bl.chat}" autocomplete="off"></label></div>
            <div class="row gap mt"><button class="btn primary">ذخیره</button></div></form>

          <form class="panel" id="tg-f"><h3>${icon('send', 22)} ربات تلگرام — برای سرور خارج از ایران</h3>
            <p class="muted mb">وضعیت: ${stat(tg)}. تلگرام در ایران فیلتر است؛ اگر سرور شما داخل ایران است از بله استفاده کنید یا «نشانی رله» بگذارید.</p>
            <div class="form-grid"><label class="fld"><span>توکن ربات</span><input name="tg_token" type="password" dir="ltr" placeholder="${tg.configured ? '(ذخیره‌شده — برای تغییر وارد کنید)' : '123456:ABC…'}" autocomplete="off"></label>
            <label class="fld"><span>شناسه‌ی گفتگو (Chat ID)</span><input name="tg_chat" dir="ltr" value="${tg.chat}" autocomplete="off"></label>
            <label class="fld" style="grid-column:1/-1"><span>نشانی رله‌ی تلگرام (اختیاری، مثلاً یک Cloudflare Worker که به api.telegram.org پروکسی می‌کند)</span><input name="tg_api" dir="ltr" placeholder="https://tg-relay.example.workers.dev" value="${tg.api || ''}"></label></div>
            <div class="row gap mt"><button class="btn primary">ذخیره</button></div></form>

          <div class="panel"><h3>${icon('shieldc', 22)} آزمایش اتصال و پشتیبان</h3>
            <p class="muted mb">«ارسال پیام آزمایشی» به همه‌ی ربات‌های تنظیم‌شده پیام می‌فرستد. «بررسی اتصال سرویس‌ها» نشان می‌دهد این سرور به کدام سرویس‌ها دسترسی دارد (برای انتخاب بله یا تلگرام و محل میزبانی).</p>
            <div class="row gap wrap"><button class="btn primary" id="n-test">${icon('send', 16)} ارسال پیام آزمایشی</button><button class="btn" id="diag">${icon('refresh', 16)} بررسی اتصال سرویس‌ها</button><button class="btn" id="bk-now">${icon('shieldc', 16)} پشتیبان‌گیری همین حالا</button></div>
            <div id="diag-out" class="mt"></div></div>`);
        const refresh = (site) => { Dal.state.meta.site = site; Dal.ui.renderHeader(); Dal.ui.renderFooter(); Dal.ui.renderFab(); };
        const val = (f, n) => f.querySelector('[name=' + n + ']').value;
        $('#site-f', body).onsubmit = async (e) => { e.preventDefault(); const f = e.target; const res = await Dal.guard(() => Dal.api('/admin/site', { method: 'PUT', body: Object.fromEntries(['phones', 'whatsapp', 'bale', 'eitaa', 'telegram', 'email', 'address'].map((n) => [n, val(f, n)])) }), $('button', f)); if (res) { refresh(res.site); Dal.toast('ذخیره شد ✅', 'success'); } };
        const chan = (id, tokenKey, chatKey, extra = []) => { $(id, body).onsubmit = async (e) => { e.preventDefault(); const f = e.target; const b = { [chatKey]: val(f, chatKey) }; if (val(f, tokenKey)) b[tokenKey] = val(f, tokenKey); for (const k of extra) b[k] = val(f, k); const res = await Dal.guard(() => Dal.api('/admin/site', { method: 'PUT', body: b }), $('button', f)); if (res) { Dal.toast('ذخیره شد ✅', 'success'); T.settings(); } }; };
        chan('#bale-f', 'bale_token', 'bale_chat'); chan('#tg-f', 'tg_token', 'tg_chat', ['tg_api']);
        const NAMES = { telegram: 'تلگرام', bale: 'بله', tiles: 'نقشه (OpenStreetMap)', geocoder: 'جستجوی نشانی (Nominatim)' };
        const HINT = { telegram: 'اگر سرور داخل ایران است معمولاً بسته است؛ از بله یا رله استفاده کنید.', bale: 'برای سرورهای خارج از ایران ممکن است کند یا محدود باشد.', tiles: 'نقشه از کش دیسکی هم سرو می‌شود؛ مناطق دیده‌شده بدون اینترنت هم نمایش داده می‌شوند.', geocoder: 'جستجوی نشانی هنگام ثبت آگهی؛ در صورت قطع، موقعیت را روی نقشه انتخاب کنید.' };
        $('#n-test', body).onclick = async (e) => { const res = await Dal.guard(() => Dal.api('/admin/notify/test', { method: 'POST', body: {} }), e.currentTarget); if (!res) return; const rows = Object.entries(res.results).map(([k, v]) => `${k === 'bale' ? 'بله' : 'تلگرام'}: ${v.ok ? 'ارسال شد ✅' : 'ناموفق — ' + v.error}`); Dal.toast(rows.join(' | '), res.ok ? 'success' : 'error', 9000); };
        $('#bk-now', body).onclick = async (e) => { const res = await Dal.guard(() => Dal.api('/admin/backup', { method: 'POST', body: {} }), e.currentTarget); if (res) Dal.toast('نسخه‌ی پشتیبان ذخیره شد: ' + res.file, 'success', 6000); };
        $('#diag', body).onclick = async (e) => {
          const out = $('#diag-out', body); mount(out, html`<p class="muted">در حال بررسی…</p>`);
          const d = await Dal.guard(() => Dal.api('/admin/diagnostics'), e.currentTarget); if (!d) return;
          const mb = (b) => Dal.fa((b / 1048576).toFixed(1));
          mount(out, html`<div class="table-wrap"><table><thead><tr><th>سرویس</th><th>وضعیت</th><th>زمان پاسخ</th><th>توضیح</th></tr></thead><tbody>
            ${d.checks.map((c) => html`<tr><td>${NAMES[c.name]}</td><td><span class="pill ${c.ok ? 'ok' : 'bad'}">${c.ok ? 'در دسترس' : 'در دسترس نیست'}</span></td><td>${c.ms ? Dal.fa(c.ms) + ' ms' : '—'}</td><td class="muted" style="font-size:13px">${c.ok ? '' : (c.error ? c.error + ' — ' : '') + HINT[c.name]}</td></tr>`)}</tbody></table></div>
            <p class="muted mt" style="font-size:13px">Node ${d.node} · پایگاه‌داده ${mb(d.dbBytes)} مگابایت · کش نقشه ${Dal.fa(d.tiles.count)} کاشی (${mb(d.tiles.bytes)} مگابایت) · پشتیبان‌های محلی: ${d.backups.length ? d.backups.join('، ') : 'هنوز نیست'} · ${d.trustProxy ? 'پشت پروکسی' : 'بدون پروکسی'}</p>`);
        };
      },
      async articles() {
        const cats = Dal.state.meta.categories || [];
        const load = async () => {
          const r = await Dal.api('/admin/articles'); if (!alive()) return;
          mount(body, html`<div class="row between mb"><h2 style="font-size:20px">مقاله‌های مجله (${num(r.items.length)})</h2><button class="btn primary" data-an>${icon('plus', 16)} مقاله‌ی جدید</button></div>
            ${r.items.length ? r.items.map((a) => html`<div class="list-row"><div class="main"><h4><a href="#/article/${a.slug}">${a.title}</a></h4><div class="muted" style="font-size:13px">${a.category} · ${num(a.views)} بازدید · ${dateFa(a.created_at)}</div></div><div class="row gap-sm"><button class="btn sm" data-ae="${a.id}">${icon('edit', 14)} ویرایش</button><button class="btn sm danger" data-ad="${a.id}">${icon('trash', 14)}</button></div></div>`) : Dal.empty('مقاله‌ای نیست', 'اولین مقاله را بنویسید.')}`);
          body._items = r.items;
        };
        const editor = (a) => {
          const m = Dal.modal(html`<form class="col gap"><label class="fld"><span>عنوان</span><input name="title" required minlength="5" value="${a?.title || ''}"></label><label class="fld"><span>دسته</span><select name="category">${Dal.optionList(Object.fromEntries((cats.length ? cats : ['عمومی']).map((c) => [c, c])), a?.category || '')}</select></label><label class="fld"><span>خلاصه (اختیاری)</span><input name="excerpt" maxlength="300" value="${a?.excerpt || ''}"></label><label class="fld"><span>متن (برای تیتر، خط را با «## » شروع کنید؛ پاراگراف‌ها را با یک خط خالی جدا کنید)</span><textarea name="body" rows="12" required minlength="30">${a?.body || ''}</textarea></label><button class="btn primary">${a ? 'ذخیره' : 'انتشار'}</button></form>`, { title: a ? 'ویرایش مقاله' : 'مقاله‌ی جدید', wide: true });
          $('form', m.body).onsubmit = async (ev) => { ev.preventDefault(); const r = await Dal.guard(() => Dal.api(a ? '/admin/articles/' + a.id : '/admin/articles', { method: a ? 'PUT' : 'POST', body: Object.fromEntries(new FormData(ev.target)) }), $('button', m.body)); if (r) { m.close(); Dal.toast('ذخیره شد ✅', 'success'); load(); } };
        };
        on(body, 'click', '[data-an]', () => editor(null));
        on(body, 'click', '[data-ae]', (e, b) => editor(body._items.find((x) => x.id === +b.dataset.ae)));
        on(body, 'click', '[data-ad]', async (e, b) => { if (await Dal.confirm('این مقاله حذف شود؟', { danger: true, ok: 'حذف' })) { await Dal.guard(() => Dal.api('/admin/articles/' + b.dataset.ad, { method: 'DELETE' })); load(); } });
        await load();
      },
      async reports() {
        const load = async () => {
          const r = await Dal.api('/admin/reports'); if (!alive()) return;
          mount(body, r.items.length ? r.items.map((x) => html`<div class="list-row"><span class="kpi-ic ${x.status === 'open' ? 'bad' : ''}">${icon('flag', 22)}</span><div class="main"><h4>${x.reason}</h4><div style="font-size:14px">${x.details || ''}</div><div class="muted" style="font-size:12.5px">آگهی: <a href="#/listing/${x.listing_id}">${x.title}</a> (${fa(x.code)}) · گزارش‌دهنده: ${x.user_name || 'مهمان'} · ${Dal.ago(x.created_at)}</div></div><span class="pill ${x.status === 'open' ? 'warn' : 'ok'}">${{ open: 'باز', resolved: 'رسیدگی‌شده', dismissed: 'ردشده' }[x.status]}</span>${x.status === 'open' ? html`<button class="btn sm ok" data-rs="${x.id}" data-v="resolved">رسیدگی شد</button><button class="btn sm ghost" data-rs="${x.id}" data-v="dismissed">نادیده</button>` : ''}</div>`) : Dal.empty('گزارشی وجود ندارد', 'همه‌چیز مرتب است 🎉'));
        };
        on(body, 'click', '[data-rs]', async (e, b) => { await Dal.guard(() => Dal.api('/admin/reports/' + b.dataset.rs, { method: 'PUT', body: { status: b.dataset.v } })); load(); });
        await load();
      },
    };
    await (T[tab] || T.overview)();
  };
})();
