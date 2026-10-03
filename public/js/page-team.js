/* دال — کارت ویزیت دیجیتال (QR)، نصب اپ روی همه‌ی دستگاه‌ها، تقویم گوشی و گزارش هفتگی مدیر */
'use strict';
(function () {
  const { html, raw, icon, fa, num, $, $$, on, mount } = Dal;
  const origin = () => location.origin;
  const isLocalHost = () => /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/.test(location.hostname) || !location.hostname.includes('.');
  const copyText = async (t, ok = 'کپی شد ✅') => { try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } Dal.toast(ok, 'success'); };
  const qr = (text, size = 220, label = 'QR') => raw(Dal.qrSvg(text, { size, label, dark: '#0b1230', light: '#ffffff' }));
  const download = (name, text, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
  const localWarn = () => isLocalHost() ? html`<p class="warn-note">${icon('alert', 16)} الان با آدرس شبکه‌ی داخلی (<b dir="ltr">${location.host}</b>) وارد شده‌اید؛ این لینک و QR فقط برای دستگاه‌های همین شبکه کار می‌کند. بعد از قراردادن سایت روی دامنه‌ی واقعی، برای همه کار می‌کند.</p>` : '';

  // ------------------------------------------------------------ QR برای هر لینک
  Dal.showQr = (url, title = 'QR') => {
    const m = Dal.modal(html`<div class="qr-modal">${qr(url, 260, title)}<div class="copy-row"><input readonly value="${url}" dir="ltr"><button class="btn primary" id="qc">${icon('copy', 16)} کپی</button></div>
      <div class="row gap wrap center"><button class="btn" id="qd">دانلود QR</button><button class="btn ghost" id="qp">${icon('print', 16)} چاپ</button></div>${localWarn()}</div>`, { title });
    on(m.body, 'click', '#qc', () => copyText(url));
    on(m.body, 'click', '#qd', () => download('dal-qr.svg', Dal.qrSvg(url, { size: 512 }), 'image/svg+xml'));
    on(m.body, 'click', '#qp', () => window.print());
  };

  // ------------------------------------------------------------ کارت ویزیت عمومی
  Dal.pages.card = async (app, { id }, query, alive) => {
    mount(app, html`<div class="container section"><div class="card-skel" style="height:420px;border-radius:26px"></div></div>`);
    let d; try { d = await Dal.api('/card/' + id); } catch (e) { if (alive()) mount(app, html`<div class="container section">${Dal.empty('این کارت ویزیت فعال نیست', 'مشاور آن را خاموش کرده یا وجود ندارد.', html`<a class="btn primary" href="#/agents">مشاوران دال</a>`)}</div>`); return; }
    if (!alive()) return;
    const a = d.agent; Dal.setTitle(a.name); const url = `${origin()}/c/${id}`; const site = Dal.site();
    const phones = d.phone ? [d.phone] : d.sitePhones; const wa = d.phone && /^09\d{9}$/.test(d.phone) ? `https://wa.me/98${d.phone.slice(1)}` : `https://wa.me/${String(site.whatsapp || '').replace(/^0/, '98')}`;
    const city = Dal.city(a.city)?.name;
    mount(app, html`<div class="container section card-page"><article class="biz-card">
      <div class="bc-star" aria-hidden="true"></div>
      <header class="bc-head">${Dal.avatar(a, 84)}<div><span class="book-kicker">${icon(a.verified ? 'shieldc' : 'user', 15)} ${a.role === 'admin' ? 'مدیر دال' : 'مشاور املاک'}${a.verified ? ' · تأییدشده' : ''}</span><h1>${a.name}</h1>
        <div class="bc-sub">${[a.agency, city, a.experience ? fa(a.experience) + ' سال تجربه' : ''].filter(Boolean).join(' · ')}</div></div></header>
      ${d.cfg.tagline ? html`<p class="bc-tag">«${d.cfg.tagline}»</p>` : ''}
      ${a.specialties?.length ? html`<div class="chips bc-chips">${a.specialties.slice(0, 6).map((s) => html`<span class="chip sm">${s}</span>`)}</div>` : ''}
      <div class="bc-body"><div class="bc-actions">
        ${phones.map((p) => html`<a class="btn gold" href="tel:+98${p.slice(1)}" dir="ltr">${icon('phone', 18)} ${Dal.fmtPhone(p)}</a>`)}
        <a class="btn" href="${wa}" target="_blank" rel="noopener">${icon('msg', 18)} واتساپ</a>
        <a class="btn" href="/api/card/${id}/vcard" download>${icon('user', 18)} ذخیره در مخاطبین</a>
        <button class="btn ghost" id="sh">${icon('share', 18)} اشتراک</button><button class="btn ghost" id="pr">${icon('print', 18)} چاپ</button>
        ${d.phone ? '' : html`<small class="bc-note">شماره‌ی تماس تیم دال نمایش داده شده است.</small>`}</div>
        <div class="bc-qr">${qr(url, 168, 'QR کارت ' + a.name)}<small>اسکن کنید و کارت را ذخیره کنید</small></div></div>
      <footer class="bc-foot"><span class="logo-mark">د</span> دال · املاک بندر کنگان و شیراز</footer></article>
      ${d.total ? html`<section class="section tight no-print">${Dal.sectionHead('آگهی‌های فعال ' + a.name, fa(d.total) + ' آگهی', ['#/agent/' + id, 'پروفایل کامل'])}<div class="grid cards">${d.listings.map((l) => Dal.listingCard(l))}</div></section>` : ''}</div>`);
    on(app, 'click', '#sh', () => Dal.share(a.name + ' — کارت ویزیت دال', url));
    on(app, 'click', '#pr', () => window.print());
  };

  // ------------------------------------------------------------ مدیریت کارت من
  Dal.pages.mycard = async (app, params, query, alive) => {
    if (!Dal.requireLogin()) return;
    if (!Dal.isAgent()) { mount(app, html`<div class="container section">${Dal.empty('مخصوص مشاوران', 'کارت ویزیت دیجیتال برای مشاوران و مدیر است.', html`<a class="btn primary" href="#/consult">درخواست مشاوره</a>`)}</div>`); return; }
    Dal.setTitle('کارت ویزیت من');
    let r; try { r = await Dal.api('/me/card'); } catch (e) { mount(app, html`<div class="container section">${Dal.empty('خطا', e.message)}</div>`); return; }
    if (!alive()) return;
    const url = `${origin()}/c/${r.id}`;
    const draw = () => mount(app, html`<div class="container section"><div class="sec-head"><div><span class="book-kicker">${icon('user', 16)} مخصوص مشاوران</span><h1 style="font-size:30px;margin:4px 0">کارت ویزیت دیجیتال من</h1><p>یک لینک و QR اختصاصی که می‌توانید روی کارت چاپی، بنر، استوری و پروفایل واتساپ بگذارید.</p></div></div>
      <div class="grid g2"><form class="panel" id="mc" style="margin:0"><h3>${icon('settings', 22)} تنظیمات</h3>
        <label class="switch-row"><input type="checkbox" name="on" ${r.cfg.on ? 'checked' : ''}><span><b>کارت عمومی روشن باشد</b><small class="muted">تا روشن نکنید، لینک شما برای کسی باز نمی‌شود.</small></span></label>
        <label class="switch-row"><input type="checkbox" name="phone" ${r.cfg.phone ? 'checked' : ''}><span><b>شماره‌ی موبایل من روی کارت دیده شود</b><small class="muted">خاموش باشد، به‌جایش شماره‌های مشاوره‌ی دال نشان داده می‌شود.</small></span></label>
        <label class="fld mt"><span>جمله‌ی معرفی (اختیاری)</span><input name="tagline" maxlength="90" value="${r.cfg.tagline}" placeholder="مثلاً: مشاور تخصصی املاک کنگان و شیراز"></label>
        <button class="btn primary mt">${icon('check', 16)} ذخیره</button>
        <p class="muted" style="font-size:12.5px;margin-top:10px">نام، آژانس، شهر و تخصص‌ها از پروفایل شما می‌آید. برای تغییرشان به «داشبورد ← پروفایل» بروید.</p></form>
        <div class="panel qr-panel" style="margin:0"><h3>${icon('share', 22)} لینک و QR کارت</h3>
          <div class="qr-big">${qr(url, 240, 'QR کارت من')}</div>
          <div class="copy-row"><input readonly value="${url}" dir="ltr"><button class="btn primary" id="cp">${icon('copy', 16)} کپی</button></div>
          <div class="row gap wrap mt"><a class="btn" href="#/card/${r.id}">${icon('eye', 16)} دیدن کارت</a><button class="btn" id="dq">دانلود QR</button><a class="btn ghost" href="/api/card/${r.id}/vcard" download>vCard</a></div>${localWarn()}
          ${r.cfg.on ? '' : html`<p class="warn-note">${icon('alert', 16)} کارت هنوز خاموش است؛ بدون روشن‌کردن، این لینک پیغام «فعال نیست» می‌دهد.</p>`}</div></div></div>`);
    draw();
    on(app, 'click', '#cp', () => copyText(url));
    on(app, 'click', '#dq', () => download('dal-card-qr.svg', Dal.qrSvg(url, { size: 512 }), 'image/svg+xml'));
    app.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = ev.target.elements;
      const res = await Dal.guard(() => Dal.api('/me/card', { method: 'PUT', body: { on: f.on.checked, phone: f.phone.checked, tagline: f.tagline.value } }), $('button.primary', ev.target));
      if (res) { r.cfg = res.cfg; Dal.toast('ذخیره شد ✅', 'success'); draw(); }
    });
  };

  // ------------------------------------------------------------ نصب اپ روی همه‌ی دستگاه‌ها
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); Dal.installEvt = e; if (Dal.onInstallReady) Dal.onInstallReady(); });
  window.addEventListener('appinstalled', () => { Dal.installEvt = null; Dal.toast('دال نصب شد', 'success'); });
  Dal.pages.install = async (app) => {
    Dal.setTitle('نصب اپلیکیشن دال');
    const ua = navigator.userAgent; const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const android = /Android/.test(ua); const inApp = /Telegram|Instagram|FBAN|FBAV|Line\/|Eitaa|Bale|Aparat|; wv\)/i.test(ua);
    const me = ios ? 'ios' : android ? 'android' : 'desktop'; const T = { ios: 'آیفون و آیپد', android: 'اندروید', desktop: 'کامپیوتر' };
    const steps = {
      android: ['مرورگر <b>Chrome</b> (یا Samsung Internet) را باز کنید و آدرس سایت را بزنید.', 'روی منوی <b>⋮</b> (سه‌نقطه‌ی بالا) بزنید.', '<b>«Install app»</b> یا <b>«نصب برنامه»</b> (در بعضی گوشی‌ها <b>«Add to Home screen»</b>) را انتخاب کنید.', 'روی <b>Install</b> بزنید؛ آیکن «دال» روی صفحه‌ی اصلی گوشی می‌آید.'],
      ios: ['حتماً با مرورگر <b>Safari</b> باز کنید (در کروم آیفون و تلگرام نصب نمی‌شود).', 'روی دکمه‌ی <b>اشتراک‌گذاری</b> (مربع با فلش رو به بالا، پایین صفحه) بزنید.', 'پایین بیایید و <b>«Add to Home Screen»</b> یا <b>«افزودن به صفحه‌ی اصلی»</b> را بزنید.', 'روی <b>Add</b> بزنید؛ دال مثل یک اپ کامل‌صفحه باز می‌شود.'],
      desktop: ['با <b>Chrome</b> یا <b>Edge</b> سایت را باز کنید.', 'در انتهای نوار آدرس، آیکن <b>نصب</b> (مانیتور با فلش) را بزنید؛ یا منوی ⋮ ← <b>Install Dal</b>.', 'روی <b>Install</b> بزنید؛ دال در پنجره‌ی مستقل و با آیکن روی دسکتاپ و منوی استارت نصب می‌شود.', 'در مک با Safari: منوی File ← <b>Add to Dock</b>.'],
    };
    const draw = () => mount(app, html`<div class="container section install-page">
      <header class="lead-hero"><div><span class="book-kicker">${icon('zap', 16)} بدون فروشگاه اپ، رایگان</span><h1>دال را روی گوشی و کامپیوتر نصب کنید</h1><p>دال یک وب‌اپ نصب‌شدنی (PWA) است: آیکن روی صفحه‌ی اصلی، باز شدن تمام‌صفحه و بدون نوار مرورگر، و سریع‌تر از سایت معمولی. روی اندروید، آیفون، ویندوز، مک و لینوکس کار می‌کند.</p></div>
        ${standalone ? html`<span class="pill ok" style="font-size:15px">${icon('checkc', 18)} همین الان به‌صورت اپ نصب‌شده باز است</span>` : (Dal.installEvt ? html`<button class="btn gold lg" id="do-install">${icon('plus', 20)} نصب همین حالا</button>` : '')}</header>
      ${inApp ? html`<div class="panel warn-panel">${icon('alert', 22)}<div><b>الان داخل مرورگر یک برنامه (تلگرام، اینستاگرام، ایتا…) هستید.</b><p class="muted">این مرورگرها اجازه‌ی نصب نمی‌دهند. روی منوی ⋮ بزنید و «Open in browser» / «باز کردن در مرورگر» را انتخاب کنید، یا لینک را در Chrome یا Safari بچسبانید.</p></div></div>` : ''}
      ${!isSecureContext && !isLocalHost() ? html`<div class="panel warn-panel">${icon('alert', 22)}<div><b>این آدرس https نیست.</b><p class="muted">مرورگرها نصب اپ را فقط روی https (یا localhost) اجازه می‌دهند. با Caddy و دامنه، https خودکار می‌شود (راهنما در README).</p></div></div>` : ''}
      <div class="lead-grid mt-lg"><div>
        <div class="tabs sm" id="plat">${Object.entries(T).map(([k, v]) => html`<a class="tab ${k === me ? 'on' : ''}" data-p="${k}">${v}${k === me ? ' (دستگاه شما)' : ''}</a>`)}</div>
        <div id="steps" class="panel mt" style="margin-bottom:0"></div></div>
        <aside class="lead-side"><div class="panel qr-panel"><h3>${icon('phone', 20)} با گوشی اسکن کنید</h3><div class="qr-big">${qr(origin() + '/', 200, 'QR سایت دال')}</div><p class="muted" style="font-size:13px;text-align:center">روی کامپیوتر هستید؟ دوربین گوشی را بگیرید تا سایت روی گوشی باز شود، بعد مراحل بالا را برای گوشی انجام دهید.</p>${localWarn()}</div>
          <div class="panel"><h3>${icon('check', 20)} بعد از نصب</h3><ul class="tick-list"><li>اعلان پیگیری‌ها و گزارش‌ها داخل برنامه می‌آید.</li><li>«تقویم گوشی» پیگیری‌های دفترچه را در تقویم خود گوشی یادآوری می‌کند.</li><li>آیکن‌های میان‌بر: دفترچه، ملکت را بسپار، میزکار معاملات (با نگه‌داشتن آیکن در اندروید).</li></ul></div></aside></div></div>`);
    draw();
    const showSteps = (p) => { mount($('#steps', app), html`<h3>${icon(p === 'desktop' ? 'layers' : 'phone', 20)} نصب روی ${T[p]}</h3><ol class="steps-list">${steps[p].map((s) => html`<li><span>${raw(s)}</span></li>`)}</ol>${p === 'android' && Dal.installEvt ? html`<button class="btn gold mt" id="do-install2">${icon('plus', 18)} نصب با یک لمس</button>` : ''}`); $$('#plat .tab', app).forEach((t) => t.classList.toggle('on', t.dataset.p === p)); };
    showSteps(me);
    on(app, 'click', '#plat [data-p]', (e, b) => showSteps(b.dataset.p));
    const doInstall = async () => { const ev = Dal.installEvt; if (!ev) return; ev.prompt(); try { await ev.userChoice; } catch { /* ignore */ } Dal.installEvt = null; draw(); showSteps(me); };
    on(app, 'click', '#do-install', doInstall); on(app, 'click', '#do-install2', doInstall);
    Dal.onInstallReady = () => { if (location.hash.startsWith('#/install')) { draw(); showSteps(me); } };
  };

  // ------------------------------------------------------------ تقویم گوشی (ICS)
  Dal.openCalendar = async () => {
    if (!Dal.requireLogin()) return;
    let r; try { r = await Dal.api('/me/calendar'); } catch (e) { return Dal.toast(e.message, 'error'); }
    let url = origin() + r.path; const web = () => 'webcal://' + url.replace(/^https?:\/\//, '');
    const m = Dal.modal(html`<div class="col gap" id="cal">
      <p class="muted">همه‌ی «پیگیری بعدی»‌های دفترچه و پرونده‌های شما، به‌صورت خودکار در تقویم گوشی می‌نشیند و ساعت ۹ صبح همان روز یادآوری می‌کند. حالا <b>${fa(r.count)}</b> پیگیری در ۴ ماه آینده دارید.</p>
      <div class="copy-row"><input readonly id="cal-url" value="${url}" dir="ltr"><button class="btn primary" id="cal-cp">${icon('copy', 16)} کپی</button></div>
      <div class="row gap wrap"><a class="btn gold" id="cal-web" href="${web()}">${icon('cal', 18)} افزودن به تقویم آیفون / مک</a><a class="btn" href="${url}" download="dal.ics">دانلود فایل ICS</a></div>
      <details class="steps-box" open><summary><b>آیفون</b></summary><ol><li>روی دکمه‌ی «افزودن به تقویم آیفون» بزنید و Subscribe را تأیید کنید.</li><li>یا: Settings ← Calendar ← Accounts ← Add Account ← Other ← <b>Add Subscribed Calendar</b> و لینک بالا را بچسبانید.</li></ol></details>
      <details class="steps-box"><summary><b>اندروید (Google Calendar)</b></summary><ol><li>لینک را کپی کنید.</li><li>در کامپیوتر یا مرورگر گوشی (حالت Desktop) به calendar.google.com بروید.</li><li>کنار «Other calendars» روی + بزنید ← <b>From URL</b> ← لینک را بچسبانید ← Add calendar.</li><li>چند دقیقه بعد در اپ Google Calendar گوشی می‌آید.</li></ol></details>
      ${isLocalHost() ? html`<p class="warn-note">${icon('alert', 16)} تقویم‌ها لینک را از اینترنت می‌خوانند؛ با آدرس شبکه‌ی داخلی کار نمی‌کند. بعد از قراردادن سایت روی دامنه‌ی https، همین لینک کار می‌کند. تا آن موقع «دانلود فایل ICS» را یک‌بار وارد تقویم کنید.</p>` : ''}
      <button class="btn sm ghost" id="cal-reset" style="align-self:flex-start">لینک جدید بساز (لینک قبلی باطل می‌شود)</button></div>`, { title: 'تقویم گوشی' });
    on(m.body, 'click', '#cal-cp', () => copyText(url));
    on(m.body, 'click', '#cal-reset', async (e, b) => { if (!(await Dal.confirm('لینک قبلی در همه‌ی تقویم‌ها از کار می‌افتد. ادامه می‌دهید؟', { ok: 'بله، لینک جدید', danger: true }))) return; const n = await Dal.guard(() => Dal.api('/me/calendar/reset', { method: 'POST', body: {} }), b); if (n) { url = origin() + n.path; $('#cal-url', m.body).value = url; $('#cal-web', m.body).href = web(); Dal.toast('لینک جدید ساخته شد', 'success'); } });
  };

  // ------------------------------------------------------------ تب «گزارش هفتگی» مدیر
  Dal.adminTabs = Dal.adminTabs || {};
  Dal.adminTabs.report = async (body) => {
    const r = await Dal.api('/admin/report/weekly'); const d = r.data;
    const tile = (l, v, s, ic, tone) => Dal.kpi(l, v, s, ic, tone);
    mount(body, html`<div class="kpis">${tile('لید سایت (۷ روز)', fa(d.leads.owners + d.leads.seekers), `${fa(d.leads.owners)} مالک · ${fa(d.leads.seekers)} خواهان`, 'target', 'ok')}${tile('آگهی جدید', fa(d.listings.total), '', 'building')}${tile('کمیسیون نهایی‌شده', Number(d.deals.earned) >= 1e6 ? fa(+(d.deals.earned / 1e6).toFixed(1)) + ' م' : fa(d.deals.earned), `${fa(d.deals.closed)} معامله`, 'dollar', 'ok')}${tile('پیگیری عقب‌افتاده', fa(d.due.entries + d.due.deals), '', 'clock', d.due.entries + d.due.deals ? 'warn' : '')}</div>
      <div class="grid g2 mt-lg"><div class="panel" style="margin:0"><h3>${icon('list', 22)} متن گزارش</h3><pre class="report-pre">${r.text}</pre>
        <div class="row gap wrap mt"><button class="btn primary" id="wk-send">${icon('send', 16)} ارسال همین حالا</button><button class="btn" id="wk-copy">${icon('copy', 16)} کپی متن</button></div>
        <p class="muted" style="font-size:12.5px;margin-top:10px">${r.channels ? 'کانال‌های فعال: ' + fa(r.channels) + ' (تلگرام/بله).' : 'هنوز تلگرام یا بله تنظیم نشده؛ گزارش فقط به‌صورت اعلان داخل سایت می‌آید. توکن را در «تنظیمات» وارد کنید.'}</p></div>
        <div class="panel" style="margin:0"><h3>${icon('clock', 22)} زمان‌بندی خودکار</h3><ul class="tick-list"><li><b>گزارش هفتگی:</b> هر شنبه ساعت ۹ صبح به وقت تهران، برای همه‌ی مدیران (اعلان) و تلگرام/بله.</li><li><b>یادآور پیگیری:</b> هر روز ساعت ۸ صبح؛ برای هر نفر اعلان شخصی، و یک خلاصه‌ی تیم برای مدیر در تلگرام/بله.</li><li>برای تغییر زمان: متغیرهای <code dir="ltr">DAL_REPORT_DAY</code> ، <code dir="ltr">DAL_REPORT_HOUR</code> و <code dir="ltr">DAL_REMIND_HOUR</code>.</li></ul>
          <button class="btn mt" id="rem-run">${icon('bell', 16)} اجرای یادآورها همین حالا (آزمایش)</button></div></div>`);
    on(body, 'click', '#wk-send', async (e, b) => { const x = await Dal.guard(() => Dal.api('/admin/report/weekly/send', { method: 'POST', body: {} }), b); if (x) Dal.toast(x.sent ? 'گزارش به تلگرام/بله و اعلان‌ها فرستاده شد ✅' : 'اعلان داخل سایت ساخته شد (کانال پیام‌رسان تنظیم نشده)', 'success', 5000); });
    on(body, 'click', '#wk-copy', () => copyText(r.text));
    on(body, 'click', '#rem-run', async (e, b) => { const x = await Dal.guard(() => Dal.api('/admin/reminders/run', { method: 'POST', body: {} }), b); if (x) Dal.toast(`${fa(x.items || 0)} پیگیری برای ${fa(x.users || 0)} نفر اعلان شد`, 'success', 5000); });
  };
})();
