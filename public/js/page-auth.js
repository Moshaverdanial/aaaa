/* دال — ورود، ثبت‌نام، بازیابی رمز و راه‌اندازی اولیه */
'use strict';
(function () {
  const { html, icon, $, on, mount } = Dal;

  Dal.afterLogin = () => { const n = sessionStorage.getItem('dal_next'); sessionStorage.removeItem('dal_next'); location.hash = n && !/login|register|forgot|setup/.test(n) ? n : '#/dashboard'; };

  // نمایش کد بازیابی (فقط یک‌بار) و گرفتن تأیید ذخیره‌سازی
  Dal.showRecovery = (code, { title = 'کد بازیابی شما' } = {}) => new Promise((resolve) => {
    const m = Dal.modal(html`<div class="col gap">
      <p>این کد <b>تنها راه بازیابی رمز عبور</b> در صورت فراموشی است و دیگر نمایش داده نمی‌شود. آن را در جای امن (مثلاً مدیریت رمز یا یادداشت شخصی) نگه دارید.</p>
      <div class="recovery-code" id="rc" dir="ltr">${code}</div>
      <div class="row gap"><button class="btn" id="rc-copy">${icon('copy', 16)} کپی</button><button class="btn" id="rc-dl">${icon('book', 16)} ذخیره در فایل</button></div>
      <label class="check"><input type="checkbox" id="rc-ok"> کد را ذخیره کردم</label>
      <button class="btn primary block" id="rc-done" disabled>ادامه</button></div>`, { title, onClose: () => resolve() });
    const b = m.body; const done = $('#rc-done', b);
    $('#rc-ok', b).onchange = (e) => { done.disabled = !e.target.checked; };
    $('#rc-copy', b).onclick = async () => { try { await navigator.clipboard.writeText(code); Dal.toast('کپی شد', 'success'); } catch { Dal.toast('کپی نشد؛ کد را دستی یادداشت کنید.', 'error'); } };
    $('#rc-dl', b).onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`کد بازیابی حساب دال\n${code}\n`], { type: 'text/plain' })); a.download = 'dal-recovery-code.txt'; a.click(); };
    done.onclick = () => { m.close(); resolve(); };
  });

  const authShell = (title, sub, inner) => html`<div class="auth-wrap"><div class="auth-card"><a href="#/" class="logo" style="margin-bottom:18px"><span class="logo-mark">د</span><span>دال</span></a><h1>${title}</h1><p class="muted mb">${sub}</p>${inner}</div></div>`;
  const PW_HINT = 'حداقل ۸ نویسه، شامل حرف و عدد';

  Dal.pages.login = async (app) => {
    Dal.setTitle('ورود');
    if (Dal.state.user) return void (location.hash = '#/dashboard');
    mount(app, authShell('ورود به حساب', 'شماره‌ی موبایل و رمز عبور خود را وارد کنید.', html`
      <form id="lf" class="col gap"><label class="fld"><span>شماره‌ی موبایل</span><input name="phone" inputmode="tel" autocomplete="username" placeholder="۰۹۱۲۳۴۵۶۷۸۹" required dir="ltr" style="text-align:right"></label>
      <label class="fld"><span>رمز عبور</span><input name="password" type="password" autocomplete="current-password" required></label><button class="btn primary lg block">ورود</button></form>
      <p class="center mt"><a href="#/forgot" class="link-arrow">رمز عبور را فراموش کرده‌اید؟</a></p>
      <p class="center mt">حساب ندارید؟ <a href="#/register" class="link-arrow">ثبت‌نام</a></p>`));
    const f = $('#lf', app);
    f.onsubmit = async (e) => { e.preventDefault(); const r = await Dal.guard(() => Dal.api('/auth/login', { method: 'POST', body: { phone: f.phone.value, password: f.password.value } }), $('button.primary', f)); if (r) { Dal.setSession(r.token, r.user); Dal.toast(`خوش آمدید ${r.user.name} 👋`, 'success'); Dal.afterLogin(); } };
  };

  Dal.pages.register = async (app, _p, query) => {
    Dal.setTitle('ثبت‌نام');
    if (Dal.state.user) return void (location.hash = '#/dashboard');
    let role = query.role === 'agent' ? 'agent' : 'user';
    const draw = () => {
      mount(app, authShell('ساخت حساب کاربری', 'رایگان و در کمتر از یک دقیقه', html`
        <div class="seg mb" style="width:100%"><button type="button" style="flex:1" data-role="user" class="${role === 'user' ? 'on' : ''}">کاربر عادی</button><button type="button" style="flex:1" data-role="agent" class="${role === 'agent' ? 'on' : ''}">مشاور املاک</button></div>
        <form id="rf" class="col gap"><label class="fld"><span>نام و نام خانوادگی</span><input name="name" required minlength="3" autocomplete="name"></label><label class="fld"><span>شماره‌ی موبایل</span><input name="phone" inputmode="tel" required placeholder="۰۹۱۲۳۴۵۶۷۸۹" autocomplete="tel"></label>
          ${role === 'agent' ? html`<label class="fld"><span>نام آژانس / مشاور املاک</span><input name="agency"></label><label class="fld"><span>شماره‌ی پروانه‌ی کسب</span><input name="license_no" required minlength="3"></label><div class="alert info">${icon('info', 18)} پس از بررسی پروانه توسط مدیر، نشان «تأییدشده» می‌گیرید. تا آن زمان آگهی‌های شما پس از بررسی منتشر می‌شوند.</div>` : ''}
          <label class="fld"><span>رمز عبور (${PW_HINT})</span><input name="password" type="password" required minlength="8" autocomplete="new-password"></label><button class="btn primary lg block">ثبت‌نام</button></form>
        <p class="center mt">قبلاً ثبت‌نام کرده‌اید؟ <a href="#/login" class="link-arrow">ورود</a></p>`));
      const f = $('#rf', app);
      f.onsubmit = async (e) => {
        e.preventDefault(); const body = { ...Object.fromEntries(new FormData(f)), role };
        const r = await Dal.guard(() => Dal.api('/auth/register', { method: 'POST', body }), $('button.primary', f));
        if (r) { Dal.setSession(r.token, r.user); Dal.toast('حساب شما ساخته شد 🎉', 'success'); await Dal.showRecovery(r.recovery); Dal.afterLogin(); }
      };
    };
    on(app, 'click', '[data-role]', (e, b) => { const keep = { name: $('[name=name]', app)?.value, phone: $('[name=phone]', app)?.value }; role = b.dataset.role; draw(); if (keep.name) $('[name=name]', app).value = keep.name; if (keep.phone) $('[name=phone]', app).value = keep.phone; });
    draw();
  };

  Dal.pages.forgot = async (app) => {
    Dal.setTitle('بازیابی رمز عبور');
    if (Dal.state.user) return void (location.hash = '#/dashboard/profile');
    mount(app, authShell('بازیابی رمز عبور', 'شماره‌ی موبایل و «کد بازیابی» که هنگام ثبت‌نام دریافت کرده‌اید را وارد کنید.', html`
      <form id="ff" class="col gap"><label class="fld"><span>شماره‌ی موبایل</span><input name="phone" inputmode="tel" required dir="ltr" style="text-align:right" placeholder="۰۹۱۲۳۴۵۶۷۸۹"></label>
      <label class="fld"><span>کد بازیابی</span><input name="code" required dir="ltr" placeholder="XXXX-XXXX-XXXX" autocomplete="off" style="text-align:left;letter-spacing:2px"></label>
      <label class="fld"><span>رمز عبور جدید (${PW_HINT})</span><input name="password" type="password" required minlength="8" autocomplete="new-password"></label><button class="btn primary lg block">تغییر رمز عبور</button></form>
      <div class="alert info mt">${icon('info', 18)} کد بازیابی را گم کرده‌اید؟ از مدیر سایت بخواهید رمز شما را بازنشانی کند.</div>
      <p class="center mt"><a href="#/login" class="link-arrow">بازگشت به ورود</a></p>`));
    const f = $('#ff', app);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = await Dal.guard(() => Dal.api('/auth/reset', { method: 'POST', body: { phone: f.phone.value, code: f.code.value, password: f.password.value } }), $('button.primary', f));
      if (r) { Dal.setSession(r.token, r.user); Dal.toast('رمز عبور تغییر کرد ✅', 'success'); await Dal.showRecovery(r.recovery, { title: 'کد بازیابی جدید شما' }); Dal.afterLogin(); }
    };
  };

  Dal.pages.setup = async (app, _p, query) => {
    Dal.setTitle('راه‌اندازی دال');
    const st = await Dal.api('/setup/status');
    if (!st.needsSetup) return void (location.hash = '#/');
    mount(app, authShell('به دال خوش آمدید 🎉', 'برای شروع، حساب مدیر سایت را بسازید. کد راه‌اندازی در خروجی ترمینال سرور (یا فایل data/.setup-token) چاپ شده است.', html`
      <form id="sf" class="col gap"><label class="fld"><span>کد راه‌اندازی</span><input name="token" required dir="ltr" value="${query.token || ''}" autocomplete="off" style="text-align:left"></label>
      <label class="fld"><span>نام مدیر</span><input name="name" required minlength="3"></label><label class="fld"><span>شماره‌ی موبایل</span><input name="phone" inputmode="tel" required dir="ltr" style="text-align:right" placeholder="۰۹۱۲۳۴۵۶۷۸۹"></label>
      <label class="fld"><span>رمز عبور (${PW_HINT})</span><input name="password" type="password" required minlength="8" autocomplete="new-password"></label><button class="btn primary lg block">ساخت حساب مدیر</button></form>`));
    const f = $('#sf', app);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = await Dal.guard(() => Dal.api('/setup', { method: 'POST', body: Object.fromEntries(new FormData(f)) }), $('button.primary', f));
      if (r) { Dal.setSession(r.token, r.user); Dal.state.needsSetup = false; await Dal.showRecovery(r.recovery); Dal.toast('حساب مدیر ساخته شد. حالا می‌توانید سایت را مدیریت کنید.', 'success'); location.hash = '#/admin'; }
    };
  };
})();
