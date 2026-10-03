/* دال — درآمدزایی: میزکار معاملات، «ملکت را بسپار / دنبال ملک می‌گردم»، صفحه‌ی شهر و ویژه‌سازی آگهی */
'use strict';
(function () {
  const { html, raw, icon, fa, num, $, $$, on, mount } = Dal;
  const short = (v) => {
    v = +v || 0; if (!v) return '۰';
    if (v >= 1e9) return fa(+(v / 1e9).toFixed(2)) + ' میلیارد';
    if (v >= 1e6) return fa(+(v / 1e6).toFixed(1)) + ' میلیون';
    return fa(v.toLocaleString('en'));
  };
  const tmn = (v) => short(v) + ' تومان';
  const dateFa = (d) => (d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('fa-IR') : '');
  const monthFa = (d) => new Date(d + 'T12:00:00').toLocaleDateString('fa-IR', { month: 'long' });
  const iso = (add) => new Date(Date.now() + add * 864e5).toISOString().slice(0, 10);
  const tel = (p) => 'tel:+98' + String(p).slice(1);
  const wa = (p) => `https://wa.me/98${String(p).slice(1)}`;
  const isMobile = (p) => /^09\d{9}$/.test(p || '');
  const STAGE_FLOW = ['lead', 'visit', 'negotiation', 'contract'];

  // ------------------------------------------------------------ جشن ثبت معامله (طلا بارانی)
  Dal.celebrate = (text, sub) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { Dal.toast(text, 'success', 5000); return; }
    const el = document.createElement('div'); el.className = 'celebrate'; el.setAttribute('role', 'status');
    const bits = Array.from({ length: 46 }, (_, i) => `<i style="--x:${Math.round(Math.random() * 100)}vw;--d:${(Math.random() * .8).toFixed(2)}s;--s:${(6 + Math.random() * 9).toFixed(0)}px;--r:${Math.round(Math.random() * 360)}deg;--t:${(1.8 + Math.random() * 1.4).toFixed(2)}s;--h:${i % 3}"></i>`).join('');
    el.innerHTML = `<div class="cel-rain">${bits}</div><div class="cel-card"><div class="cel-ic">${Dal.icon('award', 40).s || Dal.icon('award', 40)}</div><b>${Dal.esc ? Dal.esc(text) : text}</b>${sub ? `<span>${Dal.esc ? Dal.esc(sub) : sub}</span>` : ''}</div>`;
    document.body.appendChild(el); setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3800);
  };

  // ============================================================ میزکار معاملات
  let cfgCache = null;
  const getCfg = async () => cfgCache || (cfgCache = (await Dal.api('/deals/config')));
  const suggestLocal = (cf, kind, price, rent) => {
    price = +price || 0; rent = +rent || 0;
    if (kind === 'rent') { const base = rent + Math.round(price * cf.conv / 100); const per = Math.round(base * cf.rent_pct / 100); return { per, total: per * cf.sides, how: `${fa(cf.rent_pct)}٪ از اجاره‌ی ماهانه‌ی معادل (اجاره + ${fa(cf.conv)}٪ ودیعه) برای هر طرف` }; }
    const per = Math.round(price * cf.sale_pct / 100); return { per, total: per * cf.sides, how: `${fa(cf.sale_pct)}٪ از مبلغ معامله برای هر طرف` };
  };

  Dal.openDealForm = async function (init = {}, after = () => {}) {
    const cfg = await getCfg().catch(() => null); const cf = cfg?.commission || { sale_pct: .5, rent_pct: 50, conv: 3, sides: 2 };
    const d = { kind: 'sale', title: '', city: Dal.defaultCity(), district: '', client_name: '', client_phone: '', other_name: '', other_phone: '', price: 0, rent: 0, commission: 0, received: 0, stage: 'lead', next_follow: '', note: '', listing_id: '', entry_id: null, ...init };
    const edit = !!d.id;
    const m = Dal.modal(html`<form class="col gap" id="df"></form>`, { title: edit ? 'ویرایش پرونده‌ی معامله' : 'پرونده‌ی معامله‌ی جدید', wide: true });
    const form = $('#df', m.body);
    const read = () => {
      const f = form.elements; const v = (k) => f[k]?.value ?? d[k];
      Object.assign(d, { title: v('title'), kind: v('kind'), city: v('city'), district: v('district'), client_name: v('client_name'), client_phone: Dal.en(v('client_phone') || ''), other_name: v('other_name'), other_phone: Dal.en(v('other_phone') || ''),
        price: f.price ? Dal.moneyVal(f.price) : 0, rent: f.rent ? Dal.moneyVal(f.rent) : 0, commission: f.commission ? Dal.moneyVal(f.commission) : 0, received: f.received ? Dal.moneyVal(f.received) : 0,
        stage: v('stage'), next_follow: v('next_follow'), note: v('note'), listing_id: Dal.en(v('listing_id') || '') });
    };
    const hint = () => {
      const h = $('#cm-hint', form); if (!h) return; read();
      if (!d.price && !d.rent) { h.textContent = 'با وارد کردن مبلغ، کمیسیون پیشنهادی محاسبه می‌شود.'; return; }
      const s = suggestLocal(cf, d.kind, d.price, d.rent); h.innerHTML = `پیشنهاد: <b>${tmn(s.total)}</b> (${fa(cf.sides)} طرف × ${short(s.per)}) — ${s.how}`;
    };
    const draw = () => {
      mount(form, html`
        <label class="fld"><span>عنوان پرونده *</span><input name="title" value="${d.title}" maxlength="120" placeholder="مثلاً: آپارتمان ۹۵ متری، شهرک قائم" required></label>
        <div class="form-grid">
          <label class="fld"><span>نوع معامله</span><select name="kind">${Object.entries(cfg?.kinds || { sale: 'خرید و فروش', rent: 'رهن و اجاره', presale: 'پیش‌فروش', swap: 'معاوضه' }).map(([k, v]) => html`<option value="${k}" ${d.kind === k ? 'selected' : ''}>${v}</option>`)}</select></label>
          <label class="fld"><span>شهر</span><select name="city">${Dal.cityOptions(d.city)}</select></label>
          <label class="fld"><span>محله</span><select name="district">${Dal.districtOptions(d.city, d.district, '—')}</select></label>
          <label class="fld"><span>مرحله</span><select name="stage">${Object.entries(cfg?.stages || {}).map(([k, v]) => html`<option value="${k}" ${d.stage === k ? 'selected' : ''}>${v}</option>`)}</select></label>
        </div>
        <div class="form-grid">
          ${Dal.rangeInput('price', d.kind === 'rent' ? 'مبلغ ودیعه (تومان)' : 'مبلغ معامله (تومان)', d.price || '')}
          ${d.kind === 'rent' ? Dal.rangeInput('rent', 'اجاره‌ی ماهانه (تومان)', d.rent || '') : ''}
          <label class="fld"><span>طرف مقابل / مشتری</span><input name="client_name" value="${d.client_name}" maxlength="80"></label>
          <label class="fld"><span>شماره‌ی او</span><input name="client_phone" dir="ltr" style="text-align:right" value="${d.client_phone}" placeholder="09…"></label>
          <label class="fld"><span>مالک / طرف دوم</span><input name="other_name" value="${d.other_name}" maxlength="80"></label>
          <label class="fld"><span>شماره‌ی او</span><input name="other_phone" dir="ltr" style="text-align:right" value="${d.other_phone}" placeholder="09…"></label>
        </div>
        <div class="comm-box"><div class="form-grid">
          ${Dal.rangeInput('commission', 'کمیسیون کل (تومان)', d.commission || '')}
          ${Dal.rangeInput('received', 'دریافت‌شده تاکنون', d.received || '')}</div>
          <div class="row gap wrap between"><span class="muted" id="cm-hint" style="font-size:12.5px"></span><button type="button" class="btn sm" id="cm-fill">${icon('calc', 14)} پر کردن با مبلغ پیشنهادی</button></div>
          <small class="muted">درصدها قابل‌تنظیم‌اند و فقط نقطه‌ی شروع‌اند؛ تعرفه‌ی رسمی اتحادیه‌ی خودتان ملاک است. اگر خالی بگذارید، هنگام ثبت محاسبه می‌شود.</small></div>
        <div class="form-grid">
          <label class="fld"><span>پیگیری بعدی</span><input name="next_follow" type="date" value="${d.next_follow || ''}"><span class="quick-dates"><button type="button" class="chip sm" data-qd="1">فردا</button><button type="button" class="chip sm" data-qd="3">۳ روز بعد</button><button type="button" class="chip sm" data-qd="7">هفته‌ی بعد</button></span></label>
          <label class="fld"><span>شماره‌ی آگهی دال (اختیاری)</span><input name="listing_id" dir="ltr" style="text-align:right" inputmode="numeric" value="${d.listing_id || ''}"></label>
        </div>
        <label class="fld"><span>یادداشت</span><textarea name="note" rows="3" maxlength="1500">${d.note}</textarea></label>
        <button class="btn primary lg">${edit ? 'ذخیره‌ی تغییرات' : 'ایجاد پرونده'}</button>`);
      Dal.bindMoney(form); hint();
    };
    draw();
    form.addEventListener('change', (e) => { if (['kind', 'city'].includes(e.target.name)) { read(); if (e.target.name === 'city') d.district = ''; draw(); } });
    form.addEventListener('input', (e) => { if (['price', 'rent'].includes(e.target.name)) hint(); });
    on(form, 'click', '[data-qd]', (e, b) => { form.elements.next_follow.value = iso(+b.dataset.qd); });
    on(form, 'click', '#cm-fill', () => { read(); const s = suggestLocal(cf, d.kind, d.price, d.rent); if (!s.total) return Dal.toast('اول مبلغ معامله را وارد کنید.', 'info'); d.commission = s.total; const inp = form.elements.commission; inp.value = String(s.total); inp.dispatchEvent(new Event('input', { bubbles: true })); });
    form.onsubmit = async (ev) => {
      ev.preventDefault(); read();
      const body = { ...d, listing_id: d.listing_id || null }; if (!d.commission) body.commission = 0;
      const r = await Dal.guard(() => Dal.api(edit ? `/deals/${d.id}` : '/deals', { method: edit ? 'PUT' : 'POST', body }), $('button.primary', form));
      if (r) { m.close(); Dal.toast(edit ? 'ذخیره شد ✅' : 'پرونده ساخته شد ✅', 'success'); after(r.deal); }
    };
  };

  function closeDealModal(deal, after) {
    const m = Dal.modal(html`<form class="col gap">
      <p class="muted">با نهایی شدن معامله، کمیسیون در گزارش درآمد شما ثبت می‌شود.</p>
      ${Dal.rangeInput('commission', 'کمیسیون نهایی (تومان)', deal.commission || '')}
      ${Dal.rangeInput('received', 'چقدر تا الان دریافت شده؟', deal.received || '')}
      ${deal.listing_id ? html`<label class="chip chk"><input type="checkbox" name="ml" checked> آگهی مرتبط «${deal.kind === 'rent' ? 'اجاره‌رفته' : 'فروخته‌شده'}» علامت بخورد</label>` : ''}
      ${deal.entry_id ? html`<p class="muted" style="font-size:12.5px">ثبت مرتبط در دفترچه هم «نتیجه‌دار» می‌شود.</p>` : ''}
      <button class="btn primary lg">${icon('award', 18)} معامله نهایی شد</button></form>`, { title: 'نهایی‌کردن «' + deal.title + '»' });
    const f = $('form', m.body); Dal.bindMoney(f);
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const commission = Dal.moneyVal(f.elements.commission), received = Dal.moneyVal(f.elements.received);
      const r = await Dal.guard(async () => { await Dal.api(`/deals/${deal.id}`, { method: 'PUT', body: { commission, received } }); return Dal.api(`/deals/${deal.id}/stage`, { method: 'POST', body: { stage: 'closed', mark_listing: !!f.elements.ml?.checked } }); }, $('button.primary', f));
      if (r) { m.close(); Dal.celebrate('تبریک! معامله نهایی شد', commission ? tmn(commission) + ' کمیسیون به درآمد شما اضافه شد' : ''); after(); }
    };
  }

  const dealCard = (d, showAgent) => {
    const i = STAGE_FLOW.indexOf(d.stage);
    return html`<article class="deal-card ${d.due ? 'due' : ''}" data-id="${d.id}">
      <div class="dl-top"><b>${d.title}</b>${d.due ? html`<span class="pill bad">پیگیری</span>` : ''}</div>
      <div class="chips"><span class="chip sm">${d.kindName}</span>${d.cityName ? html`<span class="chip sm">${icon('pin', 12)} ${[d.districtName, d.cityName].filter(Boolean).join('، ')}</span>` : ''}${showAgent ? html`<span class="chip sm">${icon('user', 12)} ${d.agent_name}</span>` : ''}</div>
      ${d.client_name || d.client_phone ? html`<div class="dl-who">${icon('user', 14)} ${d.client_name || ''} ${d.client_phone ? html`<a href="${tel(d.client_phone)}" dir="ltr">${Dal.fmtPhone(d.client_phone)}</a>` : ''}</div>` : ''}
      <div class="dl-money"><span>${d.price ? (d.kind === 'rent' ? 'ودیعه ' : '') + short(d.price) : ''}${d.rent ? ' · اجاره ' + short(d.rent) : ''}</span><b class="gold-t">${d.commission ? tmn(d.commission) : 'کمیسیون ثبت نشده'}</b></div>
      ${d.next_follow ? html`<div class="muted" style="font-size:12px">${icon('cal', 13)} پیگیری: ${dateFa(d.next_follow)}</div>` : ''}
      <div class="dl-act">
        ${i > 0 ? html`<button class="btn sm ghost" data-mv="${STAGE_FLOW[i - 1]}" title="مرحله‌ی قبل" aria-label="مرحله‌ی قبل">${icon('chevr', 15)}</button>` : ''}
        ${i >= 0 && i < STAGE_FLOW.length - 1 ? html`<button class="btn sm primary" data-mv="${STAGE_FLOW[i + 1]}">${{ lead: 'بازدید شد', visit: 'وارد مذاکره', negotiation: 'قرارداد بسته شد' }[d.stage]} ${icon('chevl', 15)}</button>` : ''}
        ${d.stage === 'contract' ? html`<button class="btn sm gold" data-close="1">${icon('award', 15)} نهایی شد</button>` : ''}
        ${d.client_phone && isMobile(d.client_phone) ? html`<a class="btn sm ghost" href="${wa(d.client_phone)}" target="_blank" rel="noopener" aria-label="واتساپ">${icon('msg', 15)}</a>` : ''}
        <button class="btn sm ghost" data-edit="1" aria-label="ویرایش">${icon('edit', 15)}</button>
        ${!['closed', 'lost'].includes(d.stage) ? html`<button class="btn sm ghost" data-lost="1" title="از دست رفت" aria-label="از دست رفت">${icon('x', 15)}</button>` : html`<button class="btn sm ghost" data-reopen="1">بازگشایی</button>`}
      </div></article>`;
  };

  Dal.pages.deals = async (app, params, query, alive) => {
    if (!Dal.requireLogin()) return;
    if (!Dal.isAgent()) { mount(app, html`<div class="container section">${Dal.empty('مخصوص مشاوران دال', 'میزکار معاملات برای مشاوران و مدیر است. مدیر دال می‌تواند حساب مشاور برای شما بسازد.', html`<a class="btn primary" href="#/consult">درخواست مشاوره</a>`)}</div>`); return; }
    Dal.setTitle('میزکار معاملات');
    let scope = query.scope === 'all' ? 'all' : 'me'; let data; let tab = 'closed';
    const load = async () => { data = await Dal.api('/deals', { query: scope === 'all' ? { scope: 'all' } : {} }); };
    mount(app, html`<div class="container section"><div class="card-skel" style="height:300px;border-radius:20px"></div></div>`);
    try { await load(); } catch (e) { if (alive()) mount(app, html`<div class="container section">${Dal.empty('خطا', e.message)}</div>`); return; }
    if (!alive()) return;

    const draw = () => {
      const r = data.report; const items = data.items;
      const goalPct = r.goal ? Math.min(100, Math.round(r.thisMonth / r.goal * 100)) : 0;
      const focus = ['kangan', 'shiraz'].map((s) => r.byCity.find((c) => c.city === s) || { city: s, name: Dal.city(s)?.name || s, count: 0, earned: 0 });
      const rest = r.byCity.filter((c) => !['kangan', 'shiraz'].includes(c.city)); const cityRows = [...focus, ...rest]; const maxE = Math.max(...cityRows.map((c) => c.earned), 1);
      const col = (st) => { const list = items.filter((d) => d.stage === st); return html`<section class="kb-col st-${st}"><header><b>${data.stages[st]}</b><span class="chip sm">${fa(list.length)}</span>${list.length ? html`<small class="muted">${short(list.reduce((s, d) => s + d.commission, 0))}</small>` : ''}</header>
        <div class="kb-list">${list.length ? list.map((d) => dealCard(d, scope === 'all')) : html`<p class="kb-empty muted">خالی</p>`}</div></section>`; };
      const done = items.filter((d) => d.stage === (tab === 'closed' ? 'closed' : 'lost'));
      mount(app, html`<div class="container section deals-page">
        <div class="sec-head"><div><span class="book-kicker">${icon('chart', 16)} مخصوص مشاوران</span><h1 style="font-size:30px;margin:4px 0">میزکار معاملات و درآمد</h1><p>هر مشتری یک پرونده؛ از اولین تماس تا کمیسیون دریافت‌شده. همه‌ی اعداد فقط از پرونده‌هایی است که خودتان ثبت کرده‌اید.</p></div>
          <div class="row gap wrap">${data.admin ? html`<div class="seg" id="sc"><button class="${scope === 'me' ? 'on' : ''}" data-s="me">پرونده‌های من</button><button class="${scope === 'all' ? 'on' : ''}" data-s="all">همه‌ی مشاوران</button></div><button class="btn ghost" id="cfg">${icon('settings', 16)} تعرفه‌ی کمیسیون</button>` : ''}<button class="btn primary" id="new-d">${icon('plus', 18)} پرونده‌ی جدید</button></div></div>

        <div class="kpis deal-kpis">
          <div class="kpi goal-kpi"><span class="goal-ring" style="--p:${goalPct}"><b>${r.goal ? fa(goalPct) + '٪' : icon('target', 22)}</b></span><div><small>درآمد این ماه</small><strong>${tmn(r.thisMonth)}</strong><button class="link-btn" id="goal">${r.goal ? 'هدف: ' + short(r.goal) + ' · تغییر' : 'تعیین هدف ماهانه'}</button></div></div>
          ${Dal.kpi('کمیسیون در جریان', short(r.pipeline), `${fa(r.open)} پرونده‌ی باز`, 'trend')}
          ${Dal.kpi('مطالبات وصول‌نشده', short(r.receivable), r.receivable ? 'از معاملات نهایی‌شده' : 'همه وصول شده', 'dollar', r.receivable ? 'warn' : 'ok')}
          ${Dal.kpi('نرخ موفقیت', r.conversion == null ? '—' : fa(r.conversion) + '٪', `${fa(r.closed)} نهایی · ${fa(r.lost)} ازدست‌رفته`, 'target')}
          ${Dal.kpi('میانگین زمان بستن', r.avgDays == null ? '—' : fa(r.avgDays) + ' روز', 'از ساخت تا نهایی', 'clock')}
        </div>

        <div class="grid g2 mt-lg">
          <div class="panel" style="margin:0"><h3>${icon('chart', 22)} درآمد ۶ ماه اخیر (تومان)</h3>${r.earned ? Dal.charts.columns(r.months.map((m) => ({ x: monthFa(m.date), y: m.earned })), { fmt: short, color: 'var(--gold)' }) : html`<p class="muted">هنوز معامله‌ی نهایی‌شده‌ای ثبت نشده. با «نهایی شد» روی پرونده‌ی قرارداد، نمودار پر می‌شود.</p>`}</div>
          <div class="panel" style="margin:0"><h3>${icon('pin', 22)} درآمد به تفکیک شهر</h3><div class="col gap">${cityRows.map((c) => html`<div class="cb-row"><span><b>${c.name}</b> ${['kangan', 'shiraz'].includes(c.city) ? html`<em class="focus-dot">تمرکز</em>` : ''}</span><div class="cb-bar"><i style="width:${Math.round(c.earned / maxE * 100)}%"></i></div><small>${c.count ? fa(c.count) + ' معامله · ' + short(c.earned) : '—'}</small></div>`)}</div></div>
        </div>

        <div class="kanban mt-lg">${STAGE_FLOW.map(col)}</div>

        <div class="panel mt-lg" style="margin-bottom:0"><div class="row between wrap gap"><div class="tabs sm"><a class="tab ${tab === 'closed' ? 'on' : ''}" data-t="closed">نهایی‌شده‌ها (${fa(r.closed)})</a><a class="tab ${tab === 'lost' ? 'on' : ''}" data-t="lost">ازدست‌رفته‌ها (${fa(r.lost)})</a></div>${r.earned ? html`<span class="muted">مجموع درآمد: <b class="gold-t">${tmn(r.earned)}</b> · دریافت‌شده ${short(r.received)}</span>` : ''}</div>
          <div class="done-list mt">${done.length ? done.map((d) => html`<div class="done-row" data-id="${d.id}"><div><b>${d.title}</b><div class="muted" style="font-size:12.5px">${[d.cityName, d.client_name, d.closed_at ? dateFa(d.closed_at) : ''].filter(Boolean).join(' · ')}</div></div><div class="dl-money"><b class="gold-t">${tmn(d.commission)}</b>${d.owing ? html`<span class="pill bad">${short(d.owing)} مانده</span>` : (d.stage === 'closed' ? html`<span class="pill ok">وصول‌شده</span>` : '')}</div><div class="dl-act"><button class="btn sm ghost" data-edit="1" aria-label="ویرایش">${icon('edit', 15)}</button><button class="btn sm ghost" data-reopen="1">بازگشایی</button><button class="btn sm ghost" data-del="1" aria-label="حذف">${icon('trash', 15)}</button></div></div>`) : html`<p class="muted">موردی نیست.</p>`}</div></div>
        ${!items.length ? html`<div class="panel mt-lg book-empty">${icon('layers', 34)}<h3>اولین پرونده را بسازید</h3><p class="muted">از «دفترچه‌ی دال» هم می‌توانید روی هر خواهان یا مالک «تبدیل به پرونده‌ی معامله» را بزنید.</p></div>` : ''}
      </div>`);
    };
    const refresh = async () => { await load(); if (alive()) draw(); };
    draw();
    const idOf = (b) => +b.closest('[data-id]').dataset.id; const dealOf = (b) => data.items.find((x) => x.id === idOf(b));
    on(app, 'click', '#new-d', () => Dal.openDealForm({}, refresh));
    on(app, 'click', '#sc [data-s]', async (e, b) => { scope = b.dataset.s; await refresh(); });
    on(app, 'click', '[data-t]', (e, b) => { tab = b.dataset.t; draw(); });
    on(app, 'click', '[data-edit]', (e, b) => Dal.openDealForm(dealOf(b), refresh));
    on(app, 'click', '[data-mv]', async (e, b) => { const d = dealOf(b); const r = await Dal.guard(() => Dal.api(`/deals/${d.id}/stage`, { method: 'POST', body: { stage: b.dataset.mv } }), b); if (r) refresh(); });
    on(app, 'click', '[data-close]', (e, b) => closeDealModal(dealOf(b), refresh));
    on(app, 'click', '[data-lost]', async (e, b) => { const d = dealOf(b); if (!(await Dal.confirm(`«${d.title}» از دست رفته علامت بخورد؟`, { ok: 'بله' }))) return; const r = await Dal.guard(() => Dal.api(`/deals/${d.id}/stage`, { method: 'POST', body: { stage: 'lost' } }), b); if (r) { tab = 'lost'; refresh(); } });
    on(app, 'click', '[data-reopen]', async (e, b) => { const d = dealOf(b); const r = await Dal.guard(() => Dal.api(`/deals/${d.id}/stage`, { method: 'POST', body: { stage: 'lead' } }), b); if (r) refresh(); });
    on(app, 'click', '[data-del]', async (e, b) => { const d = dealOf(b); if (!(await Dal.confirm(`پرونده‌ی «${d.title}» برای همیشه حذف شود؟`, { ok: 'حذف', danger: true }))) return; const r = await Dal.guard(() => Dal.api(`/deals/${d.id}`, { method: 'DELETE' }), b); if (r) refresh(); });
    on(app, 'click', '#goal', () => {
      const m = Dal.modal(html`<form class="col gap">${Dal.rangeInput('g', 'هدف درآمد ماهانه (تومان)', data.report.goal || '')}<button class="btn primary">ذخیره</button></form>`, { title: 'هدف ماهانه' });
      const f = $('form', m.body); Dal.bindMoney(f);
      f.onsubmit = async (ev) => { ev.preventDefault(); const r = await Dal.guard(() => Dal.api('/deals-goal', { method: 'PUT', body: { amount: Dal.moneyVal(f.elements.g) } }), $('button', f)); if (r) { m.close(); refresh(); } };
    });
    on(app, 'click', '#cfg', async () => {
      const cf = (await getCfg()).commission; cfgCache = null;
      const m = Dal.modal(html`<form class="col gap"><p class="muted">این مقادیر فقط پیشنهاد اولیه‌ی کمیسیون را تعیین می‌کنند. تعرفه‌ی رسمی اتحادیه‌ی املاک خودتان را وارد کنید؛ روی هر پرونده هم می‌شود دستی تغییرش داد.</p>
        <div class="form-grid"><label class="fld"><span>خرید و فروش: درصد از هر طرف</span><input name="sale_pct" value="${cf.sale_pct}" inputmode="decimal"></label>
        <label class="fld"><span>اجاره: درصد از اجاره‌ی معادل هر طرف</span><input name="rent_pct" value="${cf.rent_pct}" inputmode="decimal"></label>
        <label class="fld"><span>ضریب تبدیل ودیعه به اجاره (٪ ماهانه)</span><input name="conv" value="${cf.conv}" inputmode="decimal"></label>
        <label class="fld"><span>از چند طرف کمیسیون می‌گیرید؟</span><select name="sides"><option value="2" ${cf.sides === 2 ? 'selected' : ''}>هر دو طرف</option><option value="1" ${cf.sides === 1 ? 'selected' : ''}>یک طرف</option></select></label></div>
        <button class="btn primary">ذخیره</button></form>`, { title: 'تعرفه‌ی کمیسیون' });
      const f = $('form', m.body);
      f.onsubmit = async (ev) => { ev.preventDefault(); const g = (k) => +Dal.en(f.elements[k].value).replace(',', '.'); const r = await Dal.guard(() => Dal.api('/deals/config', { method: 'PUT', body: { sale_pct: g('sale_pct'), rent_pct: g('rent_pct'), conv: g('conv'), sides: +f.elements.sides.value } }), $('button', f)); if (r) { m.close(); Dal.toast('ذخیره شد ✅', 'success'); } };
    });
  };

  // ============================================================ «ملکت را بسپار» / «دنبال ملک می‌گردم»
  Dal.pages.lead = async (app, params, query, alive) => {
    const kind = Dal.parseHash().path === '/want' ? 'seeker' : 'owner'; const seek = kind === 'seeker';
    Dal.setTitle(seek ? 'دنبال ملک می‌گردم' : 'ملکت را به دال بسپار');
    const u = Dal.state.user;
    const F = { deal: query.deal || 'sale', ptype: '', city: query.city || Dal.defaultCity(), district: '', name: u?.name || '', phone: u?.phone || '' };
    const draw = () => mount(app, html`<div class="container section lead-page">
      <header class="lead-hero"><div><span class="book-kicker">${icon(seek ? 'search' : 'home', 16)} ${seek ? 'ما ملک را پیدا می‌کنیم' : 'رایگان و در ۶۰ ثانیه'}</span>
        <h1>${seek ? 'دنبال ملک می‌گردید؟ نیازتان را بنویسید' : 'ملکتان را به دال بسپارید'}</h1>
        <p>${seek ? 'نیازتان در دفترچه‌ی تیم دال ثبت می‌شود و هر ملک مناسب که وارد شود، به‌صورت هوشمند با شما تطبیق داده و با شما تماس گرفته می‌شود.' : 'مشخصات ملک در دفترچه‌ی تیم دال ثبت می‌شود و بلافاصله با خواهان‌های فعال تطبیق داده می‌شود. همین حالا می‌گوییم چند خواهان مناسب دارد.'}</p></div>
        <div class="seg lead-seg"><a class="${!seek ? 'on' : ''}" href="#/sell">${icon('home', 16)} مالک هستم</a><a class="${seek ? 'on' : ''}" href="#/want">${icon('search', 16)} خواهان هستم</a></div></header>
      <div class="lead-grid"><form class="panel lead-form" id="lf" novalidate>
        <input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;opacity:0">
        <div class="form-grid">
          <label class="fld"><span>نام *</span><input name="name" value="${F.name}" required maxlength="80" autocomplete="name"></label>
          <label class="fld"><span>شماره‌ی موبایل *</span><input name="phone" dir="ltr" style="text-align:right" value="${F.phone}" inputmode="tel" placeholder="09…" required autocomplete="tel"></label>
          <label class="fld"><span>نوع معامله</span><select name="deal">${Object.entries(Dal.state.meta.deals).filter(([k]) => k !== 'swap').map(([k, v]) => html`<option value="${k}" ${F.deal === k ? 'selected' : ''}>${v}</option>`)}</select></label>
          <label class="fld"><span>نوع ملک ${seek ? '(اختیاری)' : '*'}</span><select name="ptype"><option value="">${seek ? 'هر نوع' : 'انتخاب کنید'}</option>${Object.entries(Dal.state.meta.ptypes).map(([k, v]) => html`<option value="${k}" ${F.ptype === k ? 'selected' : ''}>${v}</option>`)}</select></label>
          <label class="fld"><span>شهر *</span><select name="city">${Dal.cityOptions(F.city)}</select></label>
          <label class="fld"><span>محله ${seek ? '(اختیاری)' : ''}</span><select name="district">${Dal.districtOptions(F.city, F.district, 'مهم نیست / نمی‌دانم')}</select></label>
        </div>
        <div class="form-grid mt">
          ${seek ? html`${Dal.rangeInput(F.deal === 'rent' ? 'price_max' : 'price_max', F.deal === 'rent' ? 'سقف ودیعه (تومان)' : 'سقف بودجه (تومان)', '')}${F.deal === 'rent' ? Dal.rangeInput('rent_max', 'سقف اجاره‌ی ماهانه', '') : ''}
            <label class="fld"><span>حداقل متراژ</span><input name="area" inputmode="numeric" placeholder="—"></label><label class="fld"><span>حداقل اتاق خواب</span><input name="rooms" inputmode="numeric" placeholder="—"></label>`
          : html`${Dal.rangeInput('price', F.deal === 'rent' ? 'ودیعه‌ی موردنظر (تومان)' : 'قیمت موردنظر (تومان)', '')}${F.deal === 'rent' ? Dal.rangeInput('rent', 'اجاره‌ی ماهانه', '') : ''}
            <label class="fld"><span>متراژ</span><input name="area" inputmode="numeric" placeholder="—"></label><label class="fld"><span>اتاق خواب</span><input name="rooms" inputmode="numeric" placeholder="—"></label>`}
        </div>
        <label class="fld mt"><span>توضیح کوتاه (اختیاری)</span><textarea name="note" rows="3" maxlength="600" placeholder="${seek ? 'مثلاً: نقدی، فوری، نزدیک مدرسه…' : 'مثلاً: نوساز، طبقه‌ی اول، سند تک‌برگ، آماده‌ی تحویل…'}"></textarea></label>
        <button class="btn primary lg mt" style="width:100%">${icon('send', 18)} ${seek ? 'ثبت نیاز من' : 'ثبت ملک من'}</button>
        <p class="muted" style="font-size:12.5px;margin-top:10px">${icon('shield', 14)} ثبت رایگان است. شماره‌ی شما فقط در دفترچه‌ی داخلی تیم دال می‌ماند و جایی نمایش داده نمی‌شود.</p></form>
        <aside class="lead-side"><div class="panel"><h3>${icon('zap', 20)} چطور کار می‌کند؟</h3>
          <ol class="steps-list"><li><b>ثبت</b><span>مشخصات را وارد می‌کنید.</span></li><li><b>تطبیق هوشمند</b><span>${seek ? 'نیاز شما با آگهی‌ها و مالک‌های ثبت‌شده سنجیده می‌شود.' : 'ملک شما با خواهان‌های فعال سنجیده می‌شود.'}</span></li><li><b>تماس کارشناس</b><span>تیم دال برای هماهنگی با شما تماس می‌گیرد.</span></li></ol></div>
          <div class="panel"><h3>${icon('phone', 20)} مستقیم صحبت کنید</h3>${Dal.contactButtons()}</div></aside></div></div>`);
    draw(); Dal.bindMoney(app);
    const read = () => { const f = $('#lf', app).elements; for (const k of ['deal', 'ptype', 'city', 'district', 'name', 'phone']) if (f[k]) F[k] = f[k].value; };
    app.addEventListener('change', (e) => { if (['deal', 'city'].includes(e.target.name)) { read(); if (e.target.name === 'city') F.district = ''; draw(); Dal.bindMoney(app); } });
    app.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const f = ev.target.elements; read();
      const body = { kind, deal: F.deal, ptype: F.ptype, city: F.city, district: F.district, name: F.name, phone: Dal.en(F.phone), note: f.note.value, website: f.website.value,
        area: +Dal.en(f.area.value) || 0, rooms: +Dal.en(f.rooms.value) || 0 };
      for (const k of ['price', 'rent', 'price_max', 'rent_max']) if (f[k]) body[k] = Dal.moneyVal(f[k]);
      const r = await Dal.guard(() => Dal.api('/lead', { method: 'POST', body }), $('button.primary', ev.target)); if (!r) return;
      const cityName = r.city; const n = seek ? (r.interested.listings + r.interested.entries) : r.interested;
      const q2 = new URLSearchParams({ city: F.city, deal: F.deal }); if (F.ptype) q2.set('ptype', F.ptype);
      Dal.celebrate('ثبت شد');
      mount(app, html`<div class="container section lead-page"><div class="panel lead-done">
        <div class="ld-ic">${icon('checkc', 44)}</div><h1>${r.existing ? 'اطلاعات شما به‌روز شد' : 'ثبت شد، ممنون!'}</h1>
        ${seek ? (n ? html`<p class="ld-big"><b>${fa(n)}</b> مورد مناسب در ${cityName} پیدا کردیم</p><p class="muted">${r.interested.listings ? fa(r.interested.listings) + ' آگهی فعال و ' : ''}${fa(r.interested.entries)} ملک ثبت‌شده در دفترچه‌ی دال با نیاز شما هم‌خوانی بالا دارد. کارشناس دال به‌زودی با شما تماس می‌گیرد.</p>` : html`<p class="ld-big">فعلاً موردی با تطابق بالا نداریم</p><p class="muted">نیاز شما ثبت شد و هر ملک مناسب که وارد شود، کارشناس دال با شما تماس می‌گیرد.</p>`)
          : (n ? html`<p class="ld-big"><b>${fa(n)}</b> خواهان فعال با ملک شما هم‌خوانی بالا دارد</p><p class="muted">کارشناس دال همین امروز برای هماهنگی با شما تماس می‌گیرد.</p>` : html`<p class="ld-big">ملک شما در دفترچه ثبت شد</p><p class="muted">هنوز خواهانی با تطابق بالا نداریم؛ به‌محض ورود خواهان مناسب با شما تماس می‌گیریم.</p>`)}
        <div class="row gap wrap center mt-lg">${seek && r.interested.listings ? html`<a class="btn primary" href="#/search?${q2.toString()}">${icon('search', 16)} دیدن آگهی‌های مناسب</a>` : ''}<a class="btn" href="#/city/${F.city}">${icon('pin', 16)} صفحه‌ی ${cityName}</a><a class="btn ghost" href="#/">خانه</a></div>
        <div class="mt-lg">${Dal.contactButtons()}</div></div></div>`);
    }, { once: false });
  };

  // ============================================================ صفحه‌ی شهر (کنگان، شیراز، …)
  Dal.pages.city = async (app, { slug }, query, alive) => {
    const c0 = Dal.city(slug); if (!c0) { mount(app, html`<div class="container section">${Dal.empty('شهر پیدا نشد', 'این شهر در دال تعریف نشده است.', html`<a class="btn primary" href="#/">خانه</a>`)}</div>`); return; }
    Dal.setTitle('املاک ' + c0.name);
    mount(app, html`<div class="container section"><div class="card-skel" style="height:320px;border-radius:24px"></div></div>`);
    let hub, ls; try { [hub, ls] = await Promise.all([Dal.api('/city/' + slug), Dal.api('/listings', { query: { city: slug, limit: 4, sort: 'newest' } })]); } catch (e) { if (alive()) mount(app, html`<div class="container section">${Dal.empty('خطا', e.message)}</div>`); return; }
    if (!alive()) return;
    const c = hub.city, k = hub.counts; const isK = c.slug === 'kangan';
    const tile = (n, label, ic, href) => html`<a class="hub-stat" href="${href}"><span class="hs-ic">${icon(ic, 22)}</span><b>${fa(n)}</b><small>${label}</small></a>`;
    mount(app, html`<div class="container section city-hub">
      <header class="hub-hero ${isK ? 'k' : 's'}"><div><span class="book-kicker">${icon('pin', 16)} ${c.focus ? (isK ? 'تمرکز اصلی دال' : 'تمرکز ویژه‌ی دال') : 'شهر'}</span><h1>املاک ${c.name}</h1>
        <p>${isK ? 'خرید، فروش، رهن و اجاره و سرمایه‌گذاری در محله‌ها و شهرک‌های بندر کنگان، با مشاوره‌ی مستقیم تیم دال.' : (c.slug === 'shiraz' ? 'آگهی و مشاوره‌ی ملک در محله‌های شیراز؛ از قصردشت و معالی‌آباد تا صدرا و گلستان.' : 'آگهی‌ها و آمار ملک این شهر.')}</p>
        <div class="row gap wrap mt"><a class="btn gold" href="#/search?city=${c.slug}">${icon('search', 18)} جستجوی ملک</a><a class="btn" href="#/sell?city=${c.slug}">${icon('home', 18)} ملکم را می‌سپارم</a><a class="btn" href="#/want?city=${c.slug}">${icon('target', 18)} دنبال ملک هستم</a><button class="btn ghost" data-consult="${c.slug}">${icon('phone', 18)} مشاوره</button></div></div></header>
      <div class="hub-stats">${tile(k.total, 'آگهی فعال', 'building', `#/search?city=${c.slug}`)}${tile(k.sale, 'برای خرید', 'home', `#/search?city=${c.slug}&deal=sale`)}${tile(k.rent, 'رهن و اجاره', 'key', `#/search?city=${c.slug}&deal=rent`)}${tile(hub.agents, 'مشاور فعال', 'users', '#/agents')}</div>
      <section class="section tight"><div class="sec-head"><div><h2 style="font-size:24px">محله‌های ${c.name}</h2><p>روی هر محله بزنید تا آگهی‌هایش را ببینید. محله‌هایی که آگهی دارند، پررنگ‌ترند.</p></div><a class="link-arrow" href="#/market?city=${c.slug}">تحلیل بازار ${icon('chevl', 16)}</a></div>
        <div class="dist-cloud">${hub.districts.map((d) => html`<a class="dchip ${d.count ? 'has' : ''}" href="#/search?city=${c.slug}&district=${d.slug}">${d.name}${d.count ? html`<em>${fa(d.count)}</em>` : ''}</a>`)}</div></section>
      <section class="section tight">${Dal.sectionHead('تازه‌ترین آگهی‌های ' + c.name, k.total ? '' : '', k.total ? [`#/search?city=${c.slug}&sort=newest`, 'همه'] : null)}
        ${ls.items.length ? html`<div class="grid cards">${ls.items.map((l) => Dal.listingCard(l))}</div>` : html`<div class="panel book-empty">${icon('building', 34)}<h3>هنوز آگهی‌ای در ${c.name} ثبت نشده</h3><p class="muted">اولین آگهی را شما بگذارید؛ یا ملکتان را به تیم دال بسپارید تا خودمان پیگیری کنیم.</p><div class="row gap wrap center"><a class="btn primary" href="#/new">${icon('plus', 16)} ثبت آگهی</a><a class="btn" href="#/sell?city=${c.slug}">ملکم را می‌سپارم</a></div></div>`}</section></div>`);
  };

  // ============================================================ ویژه‌سازی آگهی
  Dal.openBoost = async function (l) {
    let info; try { info = await Dal.api('/promo/plans'); } catch (e) { return Dal.toast(e.message, 'error'); }
    if (!info.enabled) { Dal.modal(html`<p class="muted">ویژه‌سازی آگهی هنوز توسط مدیر دال فعال نشده است. برای ویژه‌شدن می‌توانید با پشتیبانی تماس بگیرید.</p>${Dal.contactButtons()}`, { title: 'ویژه‌سازی آگهی' }); return; }
    let plan = info.plans[0].id;
    const m = Dal.modal(html`<form class="col gap">
      <p class="muted">آگهی «${l.title}» در بخش «آگهی‌های ویژه» صفحه‌ی اول و بالای نتایج جستجو نمایش داده می‌شود.</p>
      <div class="plans">${info.plans.map((p, i) => html`<label class="plan ${i === 0 ? 'on' : ''}"><input type="radio" name="plan" value="${p.id}" ${i === 0 ? 'checked' : ''}><b>${p.title}</b><span>${fa(p.days)} روز</span><strong>${tmn(p.price)}</strong>${p.note ? html`<small class="muted">${p.note}</small>` : ''}</label>`)}</div>
      <div class="pay-box"><b>${icon('dollar', 18)} پرداخت کارت‌به‌کارت</b><div class="pay-card" dir="ltr" id="pc">${info.pay.card}</div>
        <div class="muted" style="font-size:13px">${[info.pay.holder, info.pay.bank].filter(Boolean).join(' · ')}</div>${info.pay.note ? html`<p class="muted" style="font-size:12.5px;margin:6px 0 0">${info.pay.note}</p>` : ''}
        <button type="button" class="btn sm" id="pc-copy">${icon('copy', 14)} کپی شماره‌ی کارت</button></div>
      <label class="fld"><span>شماره‌ی پیگیری یا ۴ رقم آخر کارت پرداخت‌کننده *</span><input name="ref" required maxlength="40" dir="ltr" style="text-align:right"></label>
      <label class="fld"><span>توضیح (اختیاری)</span><input name="note" maxlength="300"></label>
      <button class="btn primary lg">${icon('sparkle', 18)} ثبت درخواست ویژه‌سازی</button><small class="muted">پس از بررسی پرداخت توسط مدیر، آگهی شما ویژه می‌شود و اعلان می‌گیرید.</small></form>`, { title: 'ویژه‌کردن آگهی' });
    const f = $('form', m.body);
    f.addEventListener('change', (e) => { if (e.target.name === 'plan') { plan = e.target.value; $$('.plan', f).forEach((x) => x.classList.toggle('on', $('input', x).checked)); } });
    on(f, 'click', '#pc-copy', async () => { try { await navigator.clipboard.writeText(info.pay.card.replace(/[^\d]/g, '')); Dal.toast('شماره‌ی کارت کپی شد', 'success'); } catch { Dal.toast('کپی نشد؛ دستی بنویسید.', 'info'); } });
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const r = await Dal.guard(() => Dal.api('/promo/request', { method: 'POST', body: { listing_id: l.id, plan_id: plan, ref: f.elements.ref.value, note: f.elements.note.value } }), $('button.primary', f));
      if (r) { m.close(); Dal.toast('درخواست ثبت شد؛ پس از تأیید پرداخت، آگهی ویژه می‌شود ✨', 'success', 6000); }
    };
  };

  // تب «ویژه‌سازی و درآمد» پنل مدیر
  Dal.adminTabs = Dal.adminTabs || {};
  Dal.adminTabs.promo = async (body) => {
    const r = await Dal.api('/admin/promo'); const cf = r.config; const rows = cf.plans.length ? cf.plans : [{ title: '', days: 7, price: '', note: '' }];
    const st = { pending: ['در انتظار', 'warn'], approved: ['تأییدشده', 'ok'], rejected: ['ردشده', 'bad'] };
    mount(body, html`<div class="kpis">${Dal.kpi('درآمد ویژه‌سازی (کل)', short(r.revenue.total), `${fa(r.revenue.count)} درخواست تأییدشده`, 'dollar', 'ok')}${Dal.kpi('درآمد این ماه', short(r.revenue.month), '', 'trend')}${Dal.kpi('آگهی ویژه‌ی فعال', fa(r.activeFeatured), '', 'sparkle')}${Dal.kpi('در انتظار بررسی', fa(r.items.filter((x) => x.status === 'pending').length), '', 'clock', 'warn')}</div>
      <div class="grid g2 mt-lg"><form class="panel" id="pp" style="margin:0"><h3>${icon('settings', 22)} پلن‌ها و حساب دریافت</h3>
        <p class="muted" style="font-size:13px">تا پلن (با قیمت) و شماره‌ی کارت تعریف نشود، ویژه‌سازی برای کاربران نمایش داده نمی‌شود. پرداخت کارت‌به‌کارت است و شما دستی تأیید می‌کنید؛ هیچ درگاه یا سرویس بیرونی لازم نیست.</p>
        <div id="plan-rows" class="col gap">${rows.map((p) => planRow(p))}</div><button type="button" class="btn sm ghost mt" id="add-plan">${icon('plus', 14)} پلن دیگر</button>
        <div class="form-grid mt"><label class="fld"><span>شماره‌ی کارت</span><input name="card" dir="ltr" style="text-align:right" value="${cf.pay.card}" placeholder="6037-…"></label><label class="fld"><span>به نام</span><input name="holder" value="${cf.pay.holder}"></label><label class="fld"><span>بانک</span><input name="bank" value="${cf.pay.bank}"></label></div>
        <label class="fld mt"><span>توضیح برای پرداخت‌کننده</span><input name="pnote" value="${cf.pay.note}"></label><button class="btn primary mt">ذخیره</button></form>
        <div class="panel" style="margin:0"><h3>${icon('list', 22)} درخواست‌ها</h3><div class="col gap">${r.items.length ? r.items.map((x) => html`<div class="promo-row" data-id="${x.id}"><div><b>${x.listing_title}</b><div class="muted" style="font-size:12.5px">${x.user_name} · <span dir="ltr">${x.user_phone}</span> · ${x.plan_title} (${fa(x.days)} روز) · ${tmn(x.price)}</div><div style="font-size:12.5px">پیگیری: <b dir="ltr">${x.ref}</b>${x.note ? ' · ' + x.note : ''}</div></div>
          <div class="row gap-sm wrap"><span class="pill ${st[x.status][1]}">${st[x.status][0]}</span>${x.status === 'pending' ? html`<button class="btn sm ok" data-ok="1">تأیید</button><button class="btn sm ghost" data-no="1">رد</button>` : ''}<a class="btn sm ghost" href="#/listing/${x.listing_id}">${icon('external', 14)}</a></div></div>`) : html`<p class="muted">هنوز درخواستی نیامده.</p>`}</div></div></div>`);
    const form = $('#pp', body);
    on(form, 'click', '#add-plan', () => { if ($$('.plan-row', form).length >= 6) return; $('#plan-rows', form).insertAdjacentHTML('beforeend', planRow({ title: '', days: 7, price: '', note: '' }).s); Dal.bindMoney(form); });
    Dal.bindMoney(form);
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const plans = $$('.plan-row', form).map((row) => ({ title: $('[name=t]', row).value, days: +Dal.en($('[name=d]', row).value) || 7, price: Dal.moneyVal($('[name=p]', row)), note: $('[name=n]', row).value })).filter((p) => p.title && p.price);
      const x = await Dal.guard(() => Dal.api('/admin/promo', { method: 'PUT', body: { plans, pay: { card: form.elements.card.value, holder: form.elements.holder.value, bank: form.elements.bank.value, note: form.elements.pnote.value } } }), $('button.primary', form));
      if (x) { Dal.toast('ذخیره شد ✅', 'success'); Dal.adminTabs.promo(body); }
    };
    const decide = async (b, status) => {
      const id = +b.closest('[data-id]').dataset.id; let note = '';
      if (status === 'rejected') { note = prompt('دلیل رد (اختیاری):') ?? null; if (note === null) return; } else if (!(await Dal.confirm('پرداخت را دیده‌اید و آگهی ویژه شود؟', { ok: 'تأیید و ویژه‌کردن' }))) return;
      const x = await Dal.guard(() => Dal.api('/admin/promo/requests/' + id, { method: 'PUT', body: { status, note } }), b); if (x) { Dal.toast(status === 'approved' ? 'آگهی ویژه شد ✨' : 'رد شد', 'success'); Dal.adminTabs.promo(body); }
    };
    on(body, 'click', '[data-ok]', (e, b) => decide(b, 'approved')); on(body, 'click', '[data-no]', (e, b) => decide(b, 'rejected'));
  };
  const planRow = (p) => html`<div class="plan-row form-grid"><label class="fld"><span>عنوان</span><input name="t" value="${p.title}" maxlength="40" placeholder="ویژه ۷ روزه"></label><label class="fld"><span>روز</span><input name="d" value="${p.days}" inputmode="numeric"></label>${Dal.rangeInput('p', 'قیمت (تومان)', p.price || '')}<label class="fld"><span>توضیح</span><input name="n" value="${p.note || ''}" maxlength="120"></label></div>`;
})();
