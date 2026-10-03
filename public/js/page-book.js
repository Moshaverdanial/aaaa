/* دال — دفترچه‌ی تلفن هوشمند به شکل «کمد»: هر نفر کمد خودش + یک کمد عمومی اصلی */
'use strict';
(function () {
  const { html, icon, fa, num, $, $$, on, mount } = Dal;

  // ------------------------------------------------------------ کمک‌ها
  const short = (v) => {
    v = +v || 0; if (!v) return '—';
    if (v >= 1e9) return fa(+(v / 1e9).toFixed(2)) + ' میلیارد';
    if (v >= 1e6) return fa(+(v / 1e6).toFixed(1)) + ' میلیون';
    return fa(v.toLocaleString('en'));
  };
  const dateFa = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('fa-IR') : '');
  const iso = (add) => { const d = new Date(Date.now() + add * 864e5); return d.toISOString().slice(0, 10); };
  const isMobile = (p) => /^09\d{9}$/.test(p);
  const tel = (p) => 'tel:+98' + String(p).slice(1);
  const waLink = (p, text) => `https://wa.me/98${String(p).slice(1)}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  const KIND = { seeker: 'خواهان ملک', owner: 'مالک / سپرده‌گذار' };
  const ST = { active: 'فعال', paused: 'متوقف', done: 'نتیجه‌دار' };
  const copy = async (t, msg = 'کپی شد ✅') => { try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } Dal.toast(msg, 'success'); };

  const gate = (app) => mount(app, html`<div class="container section">${Dal.empty('دفترچه‌ی دال', 'برای ورود به کمدها ابتدا وارد حساب کاربری خود شوید.', html`<a class="btn primary" href="#/login">ورود / ثبت‌نام</a>`)}</div>`);

  // ------------------------------------------------------------ دیوار کمدها
  const locker = (c, i) => html`<a class="locker ${c.kind === 'main' ? 'main' : ''}" href="#/book/${c.id}" style="--i:${i}" aria-label="${c.title}">
    <span class="lk-vents"></span>
    <span class="lk-no">${c.kind === 'main' ? icon('award', 34) : fa(i)}</span>
    <span class="lk-plate">${c.title}</span>
    <span class="lk-meta">${c.kind === 'main' ? 'عمومی؛ مشترک بین همه‌ی دارندگان کمد' : (c.role === 'editor' ? html`مهمان · ${c.owner?.name || ''}` : (c.owner?.name || ''))}</span>
    <span class="lk-stats"><b>${fa(c.counts.seekers)}</b> خواهان · <b>${fa(c.counts.owners)}</b> مالک</span>
    ${c.counts.due ? html`<span class="lk-due">${fa(c.counts.due)} پیگیری</span>` : ''}
    <span class="lk-key">${icon('key', 18)}</span></a>`;

  async function wall(app, alive) {
    const r = await Dal.api('/book'); if (!alive()) return;
    const main = r.cabinets.find((c) => c.kind === 'main'); const mine = r.cabinets.filter((c) => c.kind === 'personal');
    mount(app, html`<div class="container section book-page">
      <header class="book-hero"><div><span class="book-kicker">${icon('lock', 16)} فقط برای اعضا</span><h1>دفترچه‌ی دال</h1>
        <p>هر نفر یک کمد دارد؛ خواهان‌ها و مالک‌ها را داخلش ثبت کنید تا دال به‌طور هوشمند بگوید کدام ملک به درد کدام آدم می‌خورد. یک کمد عمومی اصلی هم برای همه‌ی دارندگان کمد هست.</p></div>
        <div class="book-hero-art" aria-hidden="true">${icon('lock', 56)}</div></header>
      ${r.cabinets.length || r.admin ? html`<div class="locker-wall">${main ? locker(main, 0) : ''}${mine.map((c, i) => locker(c, i + 1))}${r.admin ? html`<button class="locker add" id="new-locker" type="button"><span class="lk-no">${icon('plus', 34)}</span><span class="lk-plate">کمد جدید</span><span class="lk-meta">کمد را به یک نفر بدهید</span></button>` : ''}</div>`
        : html`<div class="panel book-empty">${icon('lock', 36)}<h3>هنوز کمدی برای شما نیست</h3><p class="muted">مدیر دال تعیین می‌کند چه کسانی کمد داشته باشند. اگر توکن یک کمد را دارید، پایین وارد کنید.</p></div>`}
      <form class="panel redeem" id="redeem"><h3>${icon('key', 22)} باز کردن کمد با توکن</h3>
        <p class="muted">اگر صاحب کمد توکن را به شما داده، اینجا وارد کنید تا کمد او به‌عنوان «مهمان» برایتان باز شود.</p>
        <div class="row gap wrap"><input name="token" dir="ltr" style="max-width:320px;text-align:left" placeholder="DK-XXXX-XXXX-XXXX" autocomplete="off" required><button class="btn primary">باز کردن</button></div></form></div>`);
    $('#redeem', app).onsubmit = async (e) => {
      e.preventDefault(); const res = await Dal.guard(() => Dal.api('/book/redeem', { method: 'POST', body: { token: e.target.token.value } }), $('button', e.target));
      if (res) { Dal.toast('کمد باز شد ✅', 'success'); Dal.go('/book/' + res.id); }
    };
    const nl = $('#new-locker', app); if (nl) nl.onclick = newLocker;
  }

  function newLocker() {
    const m = Dal.modal(html`<div class="col gap"><input id="u-q" placeholder="نام یا شماره‌ی کاربر را جستجو کنید…" autocomplete="off"><label class="fld"><span>عنوان کمد (اختیاری)</span><input id="u-title" placeholder="مثلاً: کمد مشاور کنگان"></label><div id="u-list" class="pick-list"></div></div>`, { title: 'ساخت کمد برای یک نفر' });
    let t; const load = async () => {
      const r = await Dal.api('/admin/users', { query: { q: $('#u-q', m.body).value } });
      mount($('#u-list', m.body), r.items.length ? r.items.slice(0, 30).map((u) => html`<button type="button" class="pick-row" data-u="${u.id}"><b>${u.name}</b><span class="muted" dir="ltr">${u.phone}</span><span class="chip sm">${{ admin: 'مدیر', agent: 'مشاور', user: 'کاربر' }[u.role]}</span></button>`) : html`<p class="muted">کاربری پیدا نشد.</p>`);
    };
    $('#u-q', m.body).oninput = () => { clearTimeout(t); t = setTimeout(load, 250); }; load();
    on(m.body, 'click', '[data-u]', async (e, b) => {
      const res = await Dal.guard(() => Dal.api('/admin/book', { method: 'POST', body: { user_id: +b.dataset.u, title: $('#u-title', m.body).value } }), b);
      if (res) { m.close(); Dal.toast('کمد ساخته شد ✅', 'success'); Dal.go('/book/' + res.cabinet.id); }
    });
  }

  // ------------------------------------------------------------ داخل کمد
  const scoreRing = (s) => html`<span class="score-ring ${s >= 80 ? 'hi' : s >= 60 ? 'mid' : 'lo'}" style="--p:${s}"><b>${fa(s)}</b></span>`;
  const entrySummary = (e) => {
    const bits = [];
    bits.push(html`<span class="chip sm">${Dal.dealName(e.deal)}</span>`);
    if (e.ptype) bits.push(html`<span class="chip sm">${Dal.ptypeName(e.ptype).split(' / ')[0]}</span>`);
    bits.push(html`<span class="chip sm">${icon('pin', 12)} ${[...e.districtNames, e.cityName].filter(Boolean).slice(0, 3).join('، ')}${e.districtNames.length > 2 ? '…' : ''}</span>`);
    if (e.kind === 'seeker') {
      if (e.deal === 'rent') { if (e.price_max) bits.push(html`<span class="chip sm">ودیعه تا ${short(e.price_max)}</span>`); if (e.rent_max) bits.push(html`<span class="chip sm">اجاره تا ${short(e.rent_max)}</span>`); }
      else if (e.price_max || e.price_min) bits.push(html`<span class="chip sm">${e.price_min ? 'از ' + short(e.price_min) + ' ' : ''}${e.price_max ? 'تا ' + short(e.price_max) : ''}</span>`);
      if (e.area) bits.push(html`<span class="chip sm">از ${fa(e.area)} متر</span>`);
      if (e.rooms) bits.push(html`<span class="chip sm">${fa(e.rooms)}+ خواب</span>`);
    } else {
      if (e.deal === 'rent') bits.push(html`<span class="chip sm">ودیعه ${short(e.price)} · اجاره ${short(e.rent)}</span>`); else bits.push(html`<span class="chip sm">${short(e.price)}</span>`);
      if (e.area) bits.push(html`<span class="chip sm">${fa(e.area)} متر</span>`);
      if (e.rooms) bits.push(html`<span class="chip sm">${fa(e.rooms)} خواب</span>`);
    }
    return bits;
  };
  const entryCard = (e, canDel) => html`<article class="drawer-card ${e.kind} ${e.due ? 'due' : ''} ${e.status !== 'active' ? 'off' : ''}" data-id="${e.id}">
    <div class="dc-handle" aria-hidden="true"></div>
    <div class="dc-head"><span class="dc-kind ${e.kind}">${icon(e.kind === 'seeker' ? 'search' : 'home', 14)} ${KIND[e.kind]}</span>${e.status !== 'active' ? html`<span class="chip sm">${ST[e.status]}</span>` : ''}${e.due ? html`<span class="pill bad">پیگیری امروز</span>` : ''}</div>
    <h4>${e.name}</h4>
    <a class="dc-phone" href="${tel(e.phone)}" dir="ltr">${icon('phone', 15)} ${Dal.fmtPhone(e.phone)}</a>
    <div class="chips dc-chips">${entrySummary(e)}</div>
    ${e.note ? html`<p class="dc-note">${e.note.length > 140 ? e.note.slice(0, 140) + '…' : e.note}</p>` : ''}
    <div class="dc-meta muted">${e.next_follow ? html`<span>${icon('cal', 13)} پیگیری: ${dateFa(e.next_follow)}</span>` : ''}${e.last_contact ? html`<span>آخرین تماس: ${dateFa(e.last_contact)}</span>` : ''}${e.by ? html`<span>ثبت: ${e.by}</span>` : ''}</div>
    <div class="dc-actions">
      <button class="btn sm primary" data-act="match">${icon('sparkle', 15)} پیشنهاد هوشمند</button>
      <button class="btn sm" data-act="touch">${icon('phone', 15)} ثبت تماس</button>
      ${isMobile(e.phone) ? html`<a class="btn sm" target="_blank" rel="noopener" href="${waLink(e.phone)}">${icon('msg', 15)}</a>` : ''}
      <button class="btn sm ghost" data-act="edit" aria-label="ویرایش">${icon('edit', 15)}</button>
      ${canDel(e) ? html`<button class="btn sm ghost" data-act="del" aria-label="حذف">${icon('trash', 15)}</button>` : ''}
    </div></article>`;

  const matchCard = (m, targetPhone) => html`<div class="match-card">
    ${scoreRing(m.score)}
    <div class="mc-main"><div class="mc-top"><b>${m.title}</b><span class="chip sm">${m.type === 'listing' ? 'آگهی دال' : html`${KIND[m.kind]} · ${m.cabinet_title}`}</span></div>
      <div class="muted" style="font-size:13px">${[m.districtName, m.cityName].filter(Boolean).join('، ')}${m.area ? ' · ' + fa(m.area) + ' متر' : ''}${m.rooms ? ' · ' + fa(m.rooms) + ' خواب' : ''}${m.price ? ' · ' + short(m.price) : ''}${m.rent ? ' · اجاره ' + short(m.rent) : ''}${m.type === 'entry' ? ' · ' + m.name : ''}</div>
      <div class="chips mc-why">${(m.reasons || []).map((r) => html`<span class="chip sm ok">${icon('check', 12)} ${r}</span>`)}${(m.warns || []).map((r) => html`<span class="chip sm warn">${icon('alert', 12)} ${r}</span>`)}</div>
      <div class="row gap-sm wrap mc-act">
        ${m.link ? html`<a class="btn sm" href="${m.link}" target="_blank">${icon('external', 14)} مشاهده</a>` : ''}
        ${m.phone && m.type === 'entry' && m.kind === 'owner' ? html`<a class="btn sm" href="${tel(m.phone)}">${icon('phone', 14)} تماس با مالک</a>` : ''}
        ${targetPhone && isMobile(targetPhone) ? html`<a class="btn sm ok" href="${waLink(targetPhone, m.message)}" target="_blank" rel="noopener">${icon('msg', 14)} واتساپ به خواهان</a>` : ''}
        <button class="btn sm ghost" data-copy="${m.message}">${icon('copy', 14)} کپی پیام آماده</button></div></div></div>`;

  async function showMatches(e) {
    const m = Dal.modal(html`<p class="muted">در حال یافتن بهترین گزینه‌ها…</p>`, { title: `پیشنهاد هوشمند برای ${e.name}`, wide: true });
    try {
      const r = await Dal.api(`/book/entries/${e.id}/matches`);
      mount(m.body, html`<p class="muted mb">${e.kind === 'seeker' ? 'آگهی‌های فعال دال و مالک‌های ثبت‌شده‌ی کمدهای شما، به ترتیب تناسب با نیاز این خواهان:' : 'خواهان‌های کمدهای شما که این ملک برایشان مناسب است:'}</p>
        ${r.items.length ? r.items.map((x) => matchCard(x, e.kind === 'seeker' ? e.phone : x.phone)) : Dal.empty('گزینه‌ی مناسبی پیدا نشد', e.kind === 'seeker' ? 'فعلاً آگهی یا مالکی با این مشخصات نداریم. با ثبت آگهی‌ها و مالک‌های بیشتر، پیشنهادها بهتر می‌شوند.' : 'فعلاً خواهان مناسبی ثبت نشده است.')}`);
      on(m.body, 'click', '[data-copy]', (ev, b) => copy(b.dataset.copy, 'پیام کپی شد ✅'));
    } catch (err) { mount(m.body, html`<p class="muted">${err.message}</p>`); }
  }

  // ------------------------------------------------------------ فرم ثبت/ویرایش
  function openForm(cab, entry, after) {
    const old = entry || {};
    const F = {
      kind: old.kind || 'seeker', name: old.name || '', phone: old.phone || '', deal: old.deal || 'sale', ptype: old.ptype || '', city: old.city || Dal.defaultCity(),
      districts: old.districts || [], area: old.area || 0, rooms: old.rooms || 0, price_min: old.price_min || 0, price_max: old.price_max || 0, rent_max: old.rent_max || 0,
      price: old.price || 0, rent: old.rent || 0, listing_id: old.listing_id || '', status: old.status || 'active', note: old.note || '', tags: (old.tags || []).join('، '), next_follow: old.next_follow || '',
    };
    const m = Dal.modal(html`<form class="col gap" id="bf"></form>`, { title: entry ? 'ویرایش ثبت' : 'ثبت در ' + cab.title, wide: true });
    const form = $('#bf', m.body);
    const read = () => {
      const g = (n) => form.elements[n];
      F.name = g('name').value; F.phone = g('phone').value; F.deal = g('deal').value; F.city = g('city').value; F.ptype = g('ptype').value;
      F.area = +Dal.en(g('area').value) || 0; F.rooms = +Dal.en(g('rooms').value) || 0; F.note = g('note').value; F.tags = g('tags').value; F.next_follow = g('next_follow').value;
      if (g('status')) F.status = g('status').value; if (g('listing_id')) F.listing_id = g('listing_id').value;
      for (const k of ['price_min', 'price_max', 'rent_max', 'price', 'rent']) if (g(k)) F[k] = Dal.moneyVal(g(k));
      F.districts = F.kind === 'owner' ? (g('district')?.value ? [g('district').value] : []) : $$('input[name=d]:checked', form).map((x) => x.value);
    };
    const money = (name, label) => Dal.rangeInput(name, label, F[name] || '');
    const draw = () => {
      const c = Dal.city(F.city) || Dal.state.meta.cities[0]; const seek = F.kind === 'seeker'; const rent = F.deal === 'rent';
      mount(form, html`
        <div class="seg kind-seg" role="tablist">${['seeker', 'owner'].map((k) => html`<button type="button" class="${F.kind === k ? 'on' : ''}" data-kind="${k}" ${entry ? 'disabled' : ''}>${icon(k === 'seeker' ? 'search' : 'home', 16)} ${KIND[k]}</button>`)}</div>
        ${entry ? '' : html`<div class="smart-fill"><div class="row gap"><input id="sf" placeholder="ثبت سریع با جمله: «خواهان آپارتمان ۲ خوابه در کنگان تا ۵ میلیارد، ۰۹۱۲…»" autocomplete="off"><button type="button" class="btn" id="sf-go">${icon('sparkle', 16)} تحلیل</button></div></div>`}
        <div class="form-grid">
          <label class="fld"><span>نام و نام خانوادگی *</span><input name="name" value="${F.name}" required maxlength="80"></label>
          <label class="fld"><span>شماره‌ی تماس *</span><input name="phone" dir="ltr" style="text-align:right" inputmode="tel" value="${F.phone}" placeholder="09…" required></label>
          <label class="fld"><span>نوع معامله</span><select name="deal">${Object.entries(Dal.state.meta.deals).filter(([k]) => k !== 'swap').map(([k, v]) => html`<option value="${k}" ${F.deal === k ? 'selected' : ''}>${v}</option>`)}</select></label>
          <label class="fld"><span>نوع ملک ${seek ? '(اختیاری)' : '*'}</span><select name="ptype"><option value="">${seek ? 'هر نوع' : 'انتخاب کنید'}</option>${Object.entries(Dal.state.meta.ptypes).map(([k, v]) => html`<option value="${k}" ${F.ptype === k ? 'selected' : ''}>${v}</option>`)}</select></label>
          <label class="fld"><span>شهر *</span><select name="city">${Dal.state.meta.cities.map((x) => html`<option value="${x.slug}" ${F.city === x.slug ? 'selected' : ''}>${x.name}</option>`)}</select></label>
          ${seek ? '' : html`<label class="fld"><span>محله</span><select name="district"><option value="">—</option>${c.districts.map((d) => html`<option value="${d.slug}" ${F.districts[0] === d.slug ? 'selected' : ''}>${d.name}</option>`)}</select></label>`}
        </div>
        ${seek ? html`<div class="fld"><span>محله‌های دلخواه (تا ۶ مورد)</span><div class="chips dist-pick">${c.districts.map((d) => html`<label class="chip"><input type="checkbox" name="d" value="${d.slug}" ${F.districts.includes(d.slug) ? 'checked' : ''}><span>${d.name}</span></label>`)}</div></div>` : ''}
        <div class="form-grid">
          ${seek ? (rent ? html`${money('price_max', 'حداکثر ودیعه / رهن (تومان)')}${money('rent_max', 'حداکثر اجاره‌ی ماهانه (تومان)')}` : html`${money('price_min', 'حداقل بودجه (تومان)')}${money('price_max', 'حداکثر بودجه (تومان)')}`)
        : (rent ? html`${money('price', 'ودیعه / رهن (تومان)')}${money('rent', 'اجاره‌ی ماهانه (تومان)')}` : money('price', 'قیمت درخواستی (تومان)'))}
          <label class="fld"><span>${seek ? 'حداقل متراژ' : 'متراژ'}</span><input name="area" inputmode="numeric" value="${F.area || ''}" placeholder="—"></label>
          <label class="fld"><span>${seek ? 'حداقل اتاق خواب' : 'اتاق خواب'}</span><input name="rooms" inputmode="numeric" value="${F.rooms || ''}" placeholder="—"></label>
          ${seek ? '' : html`<label class="fld"><span>شماره‌ی آگهی در دال (اختیاری)</span><input name="listing_id" inputmode="numeric" value="${F.listing_id}" dir="ltr" style="text-align:right"></label>`}
        </div>
        <div class="form-grid">
          <label class="fld"><span>تاریخ پیگیری بعدی</span><input name="next_follow" type="date" value="${F.next_follow}"><span class="quick-dates"><button type="button" class="chip sm" data-qd="1">فردا</button><button type="button" class="chip sm" data-qd="3">۳ روز بعد</button><button type="button" class="chip sm" data-qd="7">هفته‌ی بعد</button></span></label>
          <label class="fld"><span>برچسب‌ها (با ویرگول جدا کنید)</span><input name="tags" value="${F.tags}" placeholder="مثلاً: نقدی، فوری، سرمایه‌گذار"></label>
          ${entry ? html`<label class="fld"><span>وضعیت</span><select name="status">${Object.entries(ST).map(([k, v]) => html`<option value="${k}" ${F.status === k ? 'selected' : ''}>${v}</option>`)}</select></label>` : ''}
        </div>
        <label class="fld"><span>یادداشت</span><textarea name="note" rows="3" maxlength="1000">${F.note}</textarea></label>
        <button class="btn primary lg">${entry ? 'ذخیره‌ی تغییرات' : 'ثبت در کمد'}</button>`);
      Dal.bindMoney(form);
    };
    draw();
    on(form, 'click', '[data-kind]', (e, b) => { read(); F.kind = b.dataset.kind; F.districts = []; draw(); });
    on(form, 'click', '[data-qd]', (e, b) => { form.elements.next_follow.value = iso(+b.dataset.qd); });
    form.addEventListener('change', (e) => { if (['deal', 'city'].includes(e.target.name)) { read(); if (e.target.name === 'city') F.districts = []; draw(); } });
    form.addEventListener('change', (e) => { if (e.target.name === 'd' && $$('input[name=d]:checked', form).length > 6) { e.target.checked = false; Dal.toast('حداکثر ۶ محله', 'info'); } });
    on(form, 'click', '#sf-go', async (e, b) => {
      const text = $('#sf', form).value; if (text.trim().length < 4) return;
      const r = await Dal.guard(() => Dal.api('/book/parse', { method: 'POST', body: { text } }), b); if (!r) return;
      read(); const f = r.fields;
      F.deal = f.deal; if (f.ptype) F.ptype = f.ptype; if (f.city) { F.city = f.city; F.districts = f.districts; } else if (f.districts.length) F.districts = f.districts;
      for (const k of ['area', 'rooms', 'price_min', 'price_max', 'rent_max']) if (f[k]) F[k] = f[k];
      if (f.phone && !F.phone) F.phone = f.phone;
      if (F.kind === 'owner' && F.districts.length > 1) F.districts = F.districts.slice(0, 1);
      draw(); Dal.toast(r.tags.length ? 'فهمیدم: ' + r.tags.join('، ') : 'چیزی تشخیص داده نشد؛ دستی پر کنید.', r.tags.length ? 'success' : 'info', 5000);
    });
    form.onsubmit = async (ev) => {
      ev.preventDefault(); read();
      const body = { ...F, tags: F.tags.split(/[,،]/).map((t) => t.trim()).filter(Boolean), listing_id: F.listing_id || null };
      const send = (force) => Dal.api(entry ? `/book/entries/${entry.id}` : `/book/${cab.id}/entries`, { method: entry ? 'PUT' : 'POST', body: { ...body, force } });
      const res = await Dal.guard(async () => {
        try { return await send(false); } catch (err) {
          if (err.status === 409 && err.data?.existing && await Dal.confirm(err.message + ' باز هم ثبت شود؟', { ok: 'بله، ثبت شود' })) return send(true);
          throw err;
        }
      }, $('button.primary', form));
      if (res) { m.close(); Dal.toast(entry ? 'ذخیره شد ✅' : 'در کمد ثبت شد ✅', 'success'); after(); }
    };
  }

  function touchModal(e, after) {
    const m = Dal.modal(html`<form class="col gap"><label class="fld"><span>نتیجه‌ی تماس / یادداشت</span><textarea name="note" rows="3" placeholder="مثلاً: فردا برای بازدید هماهنگ شد"></textarea></label>
      <label class="fld"><span>پیگیری بعدی</span><input name="next_follow" type="date" value="${e.next_follow && !e.due ? e.next_follow : ''}"><span class="quick-dates"><button type="button" class="chip sm" data-qd="1">فردا</button><button type="button" class="chip sm" data-qd="3">۳ روز بعد</button><button type="button" class="chip sm" data-qd="7">هفته‌ی بعد</button><button type="button" class="chip sm" data-qd="0">بدون پیگیری</button></span></label>
      <button class="btn primary">ثبت تماس</button></form>`, { title: 'ثبت تماس با ' + e.name });
    const f = $('form', m.body);
    on(f, 'click', '[data-qd]', (ev, b) => { f.next_follow.value = +b.dataset.qd ? iso(+b.dataset.qd) : ''; });
    f.onsubmit = async (ev) => { ev.preventDefault(); const r = await Dal.guard(() => Dal.api(`/book/entries/${e.id}/touch`, { method: 'POST', body: { note: f.note.value, next_follow: f.next_follow.value } }), $('button.primary', f)); if (r) { m.close(); Dal.toast('ثبت شد ✅', 'success'); after(); } };
  }

  // ------------------------------------------------------------ اتاقِ داخل کمد
  async function room(app, id, alive) {
    let state = { q: '', kind: '', status: '', city: '' }; let data; let cachedIns = null;
    const load = async (first = false) => {
      data = await Dal.api('/book/' + id, { query: { q: state.q, kind: state.kind, status: state.status, city: state.city, noinsights: first ? '' : '1' } });
      if (first) cachedIns = data.insights; else data.insights = cachedIns;
    };
    try { await load(true); } catch (err) { if (!alive()) return; mount(app, html`<div class="container section">${Dal.empty('کمد پیدا نشد', err.message, html`<a class="btn primary" href="#/book">بازگشت به کمدها</a>`)}</div>`); return; }
    if (!alive()) return;
    const me = Dal.state.user;
    const canDel = (e) => data.cabinet.role === 'admin' || data.cabinet.role === 'owner' || e.created_by === me.id;

    const header = () => { const c = data.cabinet; return html`<header class="room-head">
      <a class="link-arrow back" href="#/book">${icon('arrowl', 16)} همه‌ی کمدها</a>
      <div class="row between wrap gap"><div><span class="book-kicker">${icon(c.kind === 'main' ? 'award' : 'lock', 16)} ${c.kind === 'main' ? 'کمد عمومی اصلی' : (c.role === 'editor' ? 'کمد مهمان' : 'کمد شخصی')}</span><h1>${c.title}</h1>
        <p class="muted">${c.owner ? 'صاحب کمد: ' + c.owner.name + ' · ' : ''}${fa(c.counts.seekers)} خواهان · ${fa(c.counts.owners)} مالک${c.kind === 'main' ? ' · همه‌ی دارندگان کمد می‌توانند ببینند و ثبت کنند' : ''}</p></div>
        <div class="row gap wrap"><button class="btn primary" id="add-e">${icon('plus', 18)} ثبت جدید</button>${c.role === 'admin' ? html`<button class="btn ghost" id="rn">${icon('edit', 16)} نام کمد</button>${c.kind === 'personal' ? html`<button class="btn ghost danger" id="rm">${icon('trash', 16)} حذف کمد</button>` : ''}` : ''}${c.role === 'editor' ? html`<button class="btn ghost" id="leave">خروج از کمد</button>` : ''}</div></div>
      ${c.token ? html`<div class="token-box"><span class="tk-ic">${icon('key', 20)}</span><div><b>توکن این کمد</b><div class="tk-val" id="tk" dir="ltr" data-v="${c.token}" data-hidden="1">${c.token.slice(0, 3)}••••-••••-${c.token.slice(-4)}</div></div>
        <div class="row gap-sm"><button class="btn sm" id="tk-show">نمایش</button><button class="btn sm" id="tk-copy">${icon('copy', 14)} کپی</button><button class="btn sm ghost" id="tk-new">توکن تازه</button></div>
        <p class="muted tk-note">هر کسی با این توکن می‌تواند کمد را به‌عنوان مهمان ببیند و در آن ثبت کند. «توکن تازه» توکن قبلی را بی‌اعتبار می‌کند و مهمان‌های فعلی را بیرون می‌اندازد.</p>
        ${data.members.length ? html`<div class="members"><b>مهمان‌ها:</b> ${data.members.map((u) => html`<span class="chip sm">${u.name} <button class="x" data-rm="${u.id}" aria-label="حذف">${icon('x', 12)}</button></span>`)}</div>` : ''}</div>` : ''}</header>`; };

    const insightsBlock = () => { const ins = data.insights; if (!ins || (!ins.pairs.length && !ins.due.length)) return ''; return html`<section class="insights panel">
      <h3>${icon('sparkle', 22)} پیشنهاد هوشمند دال</h3>
      ${ins.due.length ? html`<div class="due-strip"><b>${icon('cal', 16)} پیگیری‌های امروز و عقب‌افتاده:</b> ${ins.due.map((e) => html`<button class="chip sm due" data-focus="${e.id}">${e.name} · ${dateFa(e.next_follow)}</button>`)}</div>` : ''}
      ${ins.pairs.length ? html`<p class="muted">بهترین جفت‌های «نیاز ↔ ملک» از ثبت‌های همین کمد:</p><div class="pairs">${ins.pairs.map((p) => html`<div class="pair"><div class="pair-who"><span class="dc-kind ${p.entry.kind}">${KIND[p.entry.kind]}</span><b>${p.entry.name}</b><span class="muted" dir="ltr">${Dal.fmtPhone(p.entry.phone)}</span></div><div class="pair-arrow">${icon('arrowl', 20)}</div>${matchCard(p.match, p.entry.kind === 'seeker' ? p.entry.phone : p.match.phone)}</div>`)}</div>` : ''}</section>`; };

    const list = () => html`${data.entries.length ? html`<div class="drawer-grid">${data.entries.map((e) => entryCard(e, canDel))}</div>` : Dal.empty(state.q || state.kind || state.status ? 'موردی پیدا نشد' : 'این کمد هنوز خالی است', state.q || state.kind || state.status ? 'فیلترها را تغییر دهید.' : 'اولین خواهان یا مالک را ثبت کنید؛ دال خودش پیشنهاد می‌دهد.', html`<button class="btn primary" data-add>${icon('plus', 18)} ثبت جدید</button>`)}`;

    mount(app, html`<div class="container section book-page room"><div class="room-stage"><div class="cab-door" aria-hidden="true"><span class="lk-vents"></span><span class="lk-no">${icon(data.cabinet.kind === 'main' ? 'award' : 'lock', 44)}</span><span class="lk-plate">${data.cabinet.title}</span></div>
      <div class="room-inner"><div id="r-head"></div><div id="r-ins"></div>
      <div class="room-bar panel"><div class="search-in">${icon('search', 18)}<input id="r-q" placeholder="جستجوی نام، شماره یا یادداشت…" autocomplete="off"></div>
        <div class="seg" id="r-kind"><button class="on" data-k="">همه</button><button data-k="seeker">خواهان‌ها</button><button data-k="owner">مالک‌ها</button></div>
        <select id="r-st" class="mini-select"><option value="">همه‌ی وضعیت‌ها</option>${Object.entries(ST).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></div>
      <div id="r-list"></div></div></div></div>`);
    const door = $('.cab-door', app); if (door) { door.addEventListener('animationend', () => door.remove()); setTimeout(() => door.remove(), 1800); }

    const drawHead = () => { mount($('#r-head', app), header()); mount($('#r-ins', app), insightsBlock()); };
    const drawList = () => mount($('#r-list', app), list());
    const reload = async (full = true) => { await load(full); if (!alive()) return; if (full) drawHead(); drawList(); };
    drawHead(); drawList();
    const add = () => openForm(data.cabinet, null, () => reload(true));
    const entryOf = (b) => data.entries.find((x) => x.id === +b.closest('[data-id]').dataset.id);

    on(app, 'click', '#add-e, [data-add]', add);
    on(app, 'click', '[data-act]', async (ev, b) => {
      const e = entryOf(b); if (!e) return;
      const a = b.dataset.act;
      if (a === 'match') showMatches(e);
      else if (a === 'edit') openForm(data.cabinet, e, () => reload(true));
      else if (a === 'touch') touchModal(e, () => reload(true));
      else if (a === 'del' && await Dal.confirm(`«${e.name}» از کمد حذف شود؟`, { ok: 'حذف', danger: true })) { const r = await Dal.guard(() => Dal.api('/book/entries/' + e.id, { method: 'DELETE' })); if (r) { Dal.toast('حذف شد', 'success'); reload(true); } }
    });
    on(app, 'click', '[data-copy]', (ev, b) => copy(b.dataset.copy, 'پیام کپی شد ✅'));
    on(app, 'click', '[data-focus]', (ev, b) => { const el = $(`[data-id="${b.dataset.focus}"]`, app); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); } });
    let t; $('#r-q', app).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; reload(false); }, 250); };
    on(app, 'click', '#r-kind button', (ev, b) => { $$('#r-kind button', app).forEach((x) => x.classList.toggle('on', x === b)); state.kind = b.dataset.k; reload(false); });
    $('#r-st', app).onchange = (e) => { state.status = e.target.value; reload(false); };

    // توکن و مدیریت کمد
    on(app, 'click', '#tk-show', (ev, b) => { const el = $('#tk', app); const hid = el.dataset.hidden === '1'; el.textContent = hid ? el.dataset.v : `${el.dataset.v.slice(0, 3)}••••-••••-${el.dataset.v.slice(-4)}`; el.dataset.hidden = hid ? '0' : '1'; b.textContent = hid ? 'پنهان' : 'نمایش'; });
    on(app, 'click', '#tk-copy', () => copy($('#tk', app).dataset.v, 'توکن کپی شد ✅'));
    on(app, 'click', '#tk-new', async () => { if (!await Dal.confirm('توکن تازه ساخته شود؟ توکن قبلی کار نمی‌کند و مهمان‌های فعلی از کمد بیرون می‌روند.', { ok: 'ساخت توکن تازه', danger: true })) return; const r = await Dal.guard(() => Dal.api(`/book/${id}/token`, { method: 'POST', body: { revoke: true } })); if (r) { Dal.toast('توکن تازه ساخته شد ✅', 'success'); reload(true); } });
    on(app, 'click', '[data-rm]', async (ev, b) => { if (!await Dal.confirm('دسترسی این مهمان قطع شود؟', { ok: 'قطع دسترسی', danger: true })) return; const r = await Dal.guard(() => Dal.api(`/book/${id}/members/${b.dataset.rm}`, { method: 'DELETE' })); if (r) reload(true); });
    on(app, 'click', '#leave', async () => { if (await Dal.confirm('از این کمد خارج می‌شوید؟', { ok: 'خروج' })) { const r = await Dal.guard(() => Dal.api(`/book/${id}/leave`, { method: 'DELETE' })); if (r) Dal.go('/book'); } });
    on(app, 'click', '#rn', () => { const m = Dal.modal(html`<form class="col gap"><label class="fld"><span>عنوان کمد</span><input name="t" value="${data.cabinet.title}" maxlength="60" required></label><button class="btn primary">ذخیره</button></form>`, { title: 'نام کمد' }); const f = $('form', m.body); f.onsubmit = async (e) => { e.preventDefault(); const r = await Dal.guard(() => Dal.api('/admin/book/' + id, { method: 'PUT', body: { title: f.t.value } }), $('button', f)); if (r) { m.close(); reload(true); } }; });
    on(app, 'click', '#rm', async () => { if (await Dal.confirm('کمد و همه‌ی ثبت‌های داخلش برای همیشه حذف شود؟', { ok: 'حذف کمد', danger: true })) { const r = await Dal.guard(() => Dal.api('/admin/book/' + id, { method: 'DELETE' })); if (r) { Dal.toast('کمد حذف شد', 'success'); Dal.go('/book'); } } });
  }

  Dal.pages.book = async (app, params, query, alive) => {
    if (!Dal.state.user) return gate(app);
    mount(app, html`<div class="container section"><div class="card-skel" style="height:320px;border-radius:20px"></div></div>`);
    try { return params.id ? await room(app, +params.id, alive) : await wall(app, alive); } catch (e) { if (alive()) mount(app, html`<div class="container section">${Dal.empty('خطا', e.message)}</div>`); }
  };
})();
