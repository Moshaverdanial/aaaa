/* دال — ابزارها: ماشین‌حساب‌ها و برآورد قیمت */
'use strict';
(function () {
  const { html, raw, icon, num, dec, fa, en, $, $$, on, mount, priceShort, priceWords } = Dal;

  // ---------------------------------------------------------------- محاسبات
  const calc = (Dal.calc = {});
  calc.pmt = (P, ratePct, years) => { const r = ratePct / 1200, n = years * 12; if (P <= 0) return 0; return r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n)); };
  calc.schedule = (P, ratePct, years) => {
    const r = ratePct / 1200, n = years * 12, m = calc.pmt(P, ratePct, years); let bal = P; const rows = [];
    for (let i = 1; i <= n; i++) { const int = bal * r, pr = m - int; bal = Math.max(0, bal - pr); rows.push({ i, int, pr, bal, m }); }
    return rows;
  };
  const val = (root, name) => Number(en($(`[name=${name}]`, root).value).replace(/[^\d.]/g, '')) || 0;
  const mon = (root, name) => Dal.moneyVal($(`[name=${name}]`, root));
  const slider = (name, label, min, max, step, v, suffix = '') => html`<label class="fld"><span class="row between"><span>${label}</span><b style="color:var(--primary)" data-out="${name}">${fa(v)}${suffix}</b></span><input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${v}" data-suffix="${suffix}"></label>`;
  const bindSliders = (root, fn) => {
    const upd = () => { $$('input[type=range]', root).forEach((r) => { const o = $(`[data-out="${r.name}"]`, root); if (o) o.textContent = fa(r.value) + (r.dataset.suffix || ''); }); fn(); };
    root.addEventListener('input', upd); Dal.bindMoney(root); upd();
  };

  calc.miniLoan = (el, price) => {
    mount(el, html`<div class="form-grid">${slider('down', 'پیش‌پرداخت', 10, 90, 5, 30, '٪')}${slider('rate', 'نرخ سود سالانه', 5, 40, 0.5, 23, '٪')}${slider('years', 'مدت بازپرداخت (سال)', 3, 25, 1, 15)}</div><div class="calc-out" id="ml-out"></div><a class="link-arrow mt" href="#/tools?t=loan&price=${price}">جدول کامل بازپرداخت ${icon('chevl', 16)}</a>`);
    bindSliders(el, () => {
      const P = price * (1 - val(el, 'down') / 100), m = calc.pmt(P, val(el, 'rate'), val(el, 'years')), tot = m * val(el, 'years') * 12;
      mount($('#ml-out', el), html`<div><b>${priceShort(price * val(el, 'down') / 100)}</b><span>پیش‌پرداخت (تومان)</span></div><div><b>${priceShort(P)}</b><span>مبلغ وام</span></div><div><b>${priceShort(m)}</b><span>قسط ماهانه</span></div><div><b>${priceShort(tot - P)}</b><span>مجموع سود</span></div>`);
    });
  };
  calc.miniConvert = (el, deposit, rent) => {
    const rate = Dal.state.meta.rentRate;
    mount(el, html`<p class="muted mb">اگر ودیعه را کم یا زیاد کنید، اجاره چقدر می‌شود؟ (هر ۱۰۰ میلیون ≈ ${dec(rate * 100, 1)} میلیون اجاره)</p>${slider('pct', 'ودیعه‌ی جدید نسبت به ودیعه‌ی فعلی', 20, 150, 5, 100, '٪')}<div class="calc-out" id="mc-out"></div>`);
    bindSliders(el, () => {
      const nd = deposit * val(el, 'pct') / 100, nr = Math.max(0, rent + (deposit - nd) * rate);
      mount($('#mc-out', el), html`<div><b>${priceShort(nd)}</b><span>ودیعه‌ی جدید</span></div><div><b>${priceShort(nr)}</b><span>اجاره‌ی ماهانه‌ی جدید</span></div>`);
    });
  };

  // ---------------------------------------------------------------- صفحه‌ی ابزارها
  const TABS = [['loan', 'وام مسکن', 'dollar'], ['convert', 'تبدیل رهن و اجاره', 'refresh'], ['rentbuy', 'اجاره یا خرید؟', 'trend'], ['yield', 'بازده سرمایه‌گذاری', 'chart'], ['afford', 'توان خرید', 'target'], ['commission', 'کمیسیون مشاور', 'percent']];
  const moneyFld = (name, label, v) => Dal.rangeInput(name, label, v);

  Dal.pages.tools = async (app, _p, query) => {
    Dal.setTitle('ماشین‌حساب‌های مسکن');
    let tab = query.t || 'loan';
    const draw = () => {
      mount(app, html`<div class="container section"><div class="sec-head"><div><h1 style="font-size:32px">ماشین‌حساب‌های مسکن</h1><p>ابزارهای دقیق برای تصمیم‌گیری مطمئن‌تر</p></div></div>
        ${Dal.tabs(TABS.map(([k, l, i]) => [k, l, i]), tab)}<div id="tool"></div></div>`);
      TOOLS[tab]($('#tool', app), query);
    };
    on(app, 'click', '[data-tab]', (e, b) => { tab = b.dataset.tab; history.replaceState(null, '', '#/tools?t=' + tab + '&_keep=1'); draw(); });
    draw();
  };

  const TOOLS = {
    loan(el, q) {
      mount(el, html`<div class="tool-layout"><form class="panel col gap" onsubmit="return false"><h3>${icon('dollar', 22)} مشخصات وام</h3>
        ${moneyFld('price', 'قیمت ملک (تومان)', q.price || 15e9)}${slider('down', 'پیش‌پرداخت', 0, 90, 5, 30, '٪')}${slider('rate', 'نرخ سود سالانه', 1, 40, 0.5, 23, '٪')}${slider('years', 'مدت بازپرداخت (سال)', 1, 30, 1, 15)}
        <div class="alert info">${icon('info', 18)} نتایج تقریبی و بر پایه‌ی اقساط مساوی (روش آنوییته) است؛ شرایط واقعی را از بانک بپرسید.</div></form>
        <div id="loan-out"></div></div>`);
      bindSliders(el, () => {
        const price = mon(el, 'price'), P = price * (1 - val(el, 'down') / 100), yrs = val(el, 'years'), m = calc.pmt(P, val(el, 'rate'), yrs), total = m * yrs * 12;
        const sch = calc.schedule(P, val(el, 'rate'), yrs);
        const yearly = Array.from({ length: yrs }, (_, y) => { const r = sch.slice(y * 12, y * 12 + 12); return { y: y + 1, pr: r.reduce((s, x) => s + x.pr, 0), int: r.reduce((s, x) => s + x.int, 0), bal: r[r.length - 1]?.bal || 0 }; });
        mount($('#loan-out', el), html`<div class="result-big"><span>قسط ماهانه</span><b>${priceWords(m)}</b><span class="range">مجموع بازپرداخت ${priceShort(total)} · سود ${priceShort(total - P)} تومان</span></div>
          <div class="panel mt"><div class="grid g2" style="align-items:center">${Dal.charts.donut([{ label: 'اصل وام', value: Math.round(P / 1e6) }, { label: 'سود', value: Math.round((total - P) / 1e6), color: '#ff7a3d' }], { label: 'میلیون تومان' })}
          <div><div class="row between"><span class="muted">مبلغ وام</span><b>${priceShort(P)}</b></div><div class="row between"><span class="muted">پیش‌پرداخت</span><b>${priceShort(price - P)}</b></div><div class="row between"><span class="muted">نسبت سود به اصل</span><b>٪${dec(((total - P) / P) * 100 || 0, 0)}</b></div><div class="row between"><span class="muted">حداقل درآمد پیشنهادی (قسط ≤ ۳۵٪)</span><b>${priceShort(m / 0.35)}</b></div></div></div></div>
          <div class="panel mt"><h3>${icon('list', 22)} جدول سالانه‌ی بازپرداخت</h3><div class="table-wrap" style="max-height:340px;overflow:auto"><table><thead><tr><th>سال</th><th>اصل پرداختی</th><th>سود پرداختی</th><th>مانده‌ی بدهی</th></tr></thead><tbody>${yearly.map((r) => html`<tr><td>${num(r.y)}</td><td>${priceShort(r.pr)}</td><td>${priceShort(r.int)}</td><td>${priceShort(r.bal)}</td></tr>`)}</tbody></table></div></div>`);
      });
    },

    convert(el) {
      const rate0 = Dal.state.meta.rentRate;
      mount(el, html`<div class="tool-layout"><form class="panel col gap" onsubmit="return false"><h3>${icon('refresh', 22)} تبدیل رهن و اجاره</h3>
        ${moneyFld('dep', 'ودیعه‌ی فعلی (تومان)', 800e6)}${moneyFld('rent', 'اجاره‌ی ماهانه‌ی فعلی (تومان)', 10e6)}${moneyFld('newdep', 'ودیعه‌ی مورد نظر (تومان)', 500e6)}
        ${slider('rate', 'نرخ تبدیل: اجاره‌ی ماهانه به‌ازای هر ۱۰۰ میلیون ودیعه (میلیون تومان)', 1, 6, 0.1, +(rate0 * 100).toFixed(1))}</form><div id="conv-out"></div></div>`);
      bindSliders(el, () => {
        const dep = mon(el, 'dep'), rent = mon(el, 'rent'), nd = mon(el, 'newdep'), rate = val(el, 'rate') / 100;
        const nr = rent + (dep - nd) * rate;
        const full = dep + rent / rate, fullRent = rent + dep * rate;
        mount($('#conv-out', el), html`<div class="result-big"><span>${nr >= 0 ? 'اجاره‌ی ماهانه‌ی جدید' : 'ودیعه بیش از حد است!'}</span><b>${nr >= 0 ? priceWords(nr) : '—'}</b><span class="range">با ودیعه‌ی ${priceWords(nd)}</span></div>
          <div class="panel mt"><h3>معادل‌ها</h3><div class="calc-out"><div><b>${priceShort(full)}</b><span>معادل «رهن کامل» (بدون اجاره)</span></div><div><b>${priceShort(fullRent)}</b><span>معادل «اجاره‌ی کامل» (بدون ودیعه)</span></div></div>
          <p class="muted mt" style="font-size:13px">فرمول: اجاره‌ی جدید = اجاره‌ی فعلی + (ودیعه‌ی فعلی − ودیعه‌ی جدید) × نرخ. نرخ در هر منطقه و زمان متفاوت است و با توافق طرفین تعیین می‌شود.</p></div>`);
      });
    },

    commission(el) {
      mount(el, html`<div class="tool-layout"><form class="panel col gap" onsubmit="return false"><h3>${icon('percent', 22)} حق‌الزحمه‌ی مشاور املاک (تقریبی)</h3>
        <div class="seg"><button type="button" class="on" data-k="sale">خرید و فروش</button><button type="button" data-k="rent">رهن و اجاره</button></div>
        <div id="cm-fields" class="col gap"></div><div class="alert">${icon('alert', 18)} تعرفه‌ی رسمی هر استان متفاوت است و این عدد صرفاً برآوردی است؛ تعرفه‌ی اتحادیه‌ی محل را ملاک قرار دهید.</div></form><div id="cm-out"></div></div>`);
      let kind = 'sale';
      const fields = () => {
        mount($('#cm-fields', el), kind === 'sale' ? html`${moneyFld('price', 'قیمت ملک (تومان)', 10e9)}${slider('pct', 'درصد حق‌الزحمه‌ی هر طرف', 0.1, 1, 0.05, 0.5, '٪')}` : html`${moneyFld('dep', 'ودیعه (تومان)', 500e6)}${moneyFld('rent', 'اجاره‌ی ماهانه (تومان)', 15e6)}${slider('pct', 'درصد از اجاره‌ی معادل', 10, 50, 5, 25, '٪')}`);
        bindSliders(el, out);
      };
      const out = () => {
        const pct = val(el, 'pct'); let each;
        if (kind === 'sale') each = mon(el, 'price') * pct / 100; else each = (mon(el, 'rent') + mon(el, 'dep') * Dal.state.meta.rentRate) * pct / 100;
        const vat = each * 0.1;
        mount($('#cm-out', el), html`<div class="result-big"><span>حق‌الزحمه‌ی هر طرف معامله</span><b>${priceWords(each)}</b><span class="range">${kind === 'sale' ? 'مجموع دو طرف: ' + priceShort(each * 2) + ' تومان' : 'برای هر یک از موجر و مستأجر'}</span></div><div class="panel mt"><div class="row between"><span class="muted">مالیات بر ارزش افزوده (۱۰٪)</span><b>${priceShort(vat)}</b></div><div class="row between mt"><span class="muted">جمع با مالیات (هر طرف)</span><b>${priceShort(each + vat)} تومان</b></div></div>`);
      };
      on(el, 'click', '[data-k]', (e, b) => { kind = b.dataset.k; $$('[data-k]', el).forEach((x) => x.classList.toggle('on', x === b)); fields(); });
      fields();
    },

    yield(el) {
      mount(el, html`<div class="tool-layout"><form class="panel col gap" onsubmit="return false"><h3>${icon('chart', 22)} بازده سرمایه‌گذاری ملک</h3>
        ${moneyFld('price', 'قیمت خرید (تومان)', 12e9)}${moneyFld('dep', 'ودیعه‌ی دریافتی (تومان)', 1e9)}${moneyFld('rent', 'اجاره‌ی ماهانه (تومان)', 30e6)}${moneyFld('cost', 'هزینه‌های سالانه (شارژ، تعمیر، مالیات)', 60e6)}
        ${slider('grow', 'رشد سالانه‌ی قیمت ملک', 0, 60, 1, 22, '٪')}${slider('bank', 'سود جایگزین (سپرده‌ی بانکی)', 0, 40, 1, 23, '٪')}${slider('years', 'افق سرمایه‌گذاری (سال)', 1, 15, 1, 5)}</form><div id="y-out"></div></div>`);
      bindSliders(el, () => {
        const price = mon(el, 'price'), dep = mon(el, 'dep'), rent = mon(el, 'rent'), cost = mon(el, 'cost'), g = val(el, 'grow') / 100, bank = val(el, 'bank') / 100, yrs = val(el, 'years');
        const gross = ((rent * 12) / price) * 100, net = (((rent * 12 - cost) + dep * bank) / price) * 100, payback = rent * 12 - cost > 0 ? price / (rent * 12 - cost + dep * bank) : Infinity;
        const series = []; let cash = 0;
        for (let y = 0; y <= yrs; y++) { const value = price * Math.pow(1 + g, y); series.push({ x: String(y), y: value - price + cash + dep * (Math.pow(1 + bank, y) - 1) }); cash += rent * 12 - cost; }
        const bankGain = price * (Math.pow(1 + bank, yrs) - 1);
        const total = series[series.length - 1].y;
        mount($('#y-out', el), html`<div class="kpis"><div class="kpi ok"><span class="kpi-ic">${icon('percent', 22)}</span><div><div class="kpi-v">٪${dec(gross, 1)}</div><div class="kpi-l">بازده ناخالص اجاره</div></div></div><div class="kpi"><span class="kpi-ic">${icon('percent', 22)}</span><div><div class="kpi-v">٪${dec(net, 1)}</div><div class="kpi-l">بازده خالص (با منفعت ودیعه)</div></div></div><div class="kpi acc"><span class="kpi-ic">${icon('clock', 22)}</span><div><div class="kpi-v">${isFinite(payback) ? dec(payback, 1) + ' سال' : '—'}</div><div class="kpi-l">دوره‌ی بازگشت از اجاره</div></div></div></div>
          <div class="panel mt"><h3>${icon('trend', 22)} سود تجمیعی ${num(yrs)} ساله</h3><div id="y-chart"></div><div class="calc-out"><div><b>${priceShort(total)}</b><span>سود کل ملک (رشد + اجاره + ودیعه)</span></div><div><b>${priceShort(bankGain)}</b><span>سود سپرده‌ی بانکی با همان سرمایه</span></div><div><b class="${total > bankGain ? 'up' : 'down'}">${total > bankGain ? 'ملک برنده است' : 'سپرده برنده است'}</b><span>اختلاف: ${priceShort(Math.abs(total - bankGain))}</span></div></div></div>`);
        Dal.charts.line($('#y-chart', el), series, { xfmt: (x) => 'سال ' + fa(x), unit: 'تومان', color: 'var(--ok)' });
      });
    },

    afford(el) {
      mount(el, html`<div class="tool-layout"><form class="panel col gap" onsubmit="return false"><h3>${icon('target', 22)} چقدر می‌توانم بخرم؟</h3>
        ${moneyFld('income', 'درآمد ماهانه‌ی خانوار (تومان)', 120e6)}${moneyFld('debt', 'اقساط ماهانه‌ی فعلی (تومان)', 0)}${moneyFld('saving', 'پس‌انداز نقدی برای پیش‌پرداخت', 3e9)}
        ${slider('ratio', 'سقف نسبت قسط به درآمد', 20, 50, 5, 35, '٪')}${slider('rate', 'نرخ سود وام', 5, 40, 0.5, 23, '٪')}${slider('years', 'مدت وام (سال)', 5, 30, 1, 15)}</form><div id="a-out"></div></div>`);
      bindSliders(el, () => {
        const income = mon(el, 'income'), debt = mon(el, 'debt'), saving = mon(el, 'saving'), rt = val(el, 'ratio') / 100;
        const maxPay = Math.max(0, income * rt - debt), r = val(el, 'rate') / 1200, n = val(el, 'years') * 12;
        const loan = r === 0 ? maxPay * n : (maxPay * (1 - Math.pow(1 + r, -n))) / r, price = loan + saving;
        const picks = Dal.state.meta.cities.flatMap((c) => c.districts.map((d) => ({ ...d, city: c.name, citySlug: c.slug }))).filter((d) => d.ppm != null).map((d) => ({ ...d, area: Math.floor(price / (d.ppm * 1e6)) })).filter((d) => d.area >= 40).sort((a, b) => b.area - a.area).slice(0, 8);
        mount($('#a-out', el), html`<div class="result-big"><span>سقف قیمت ملک مناسب شما</span><b>${priceWords(price)}</b><span class="range">وام ${priceShort(loan)} + پس‌انداز ${priceShort(saving)} · قسط ماهانه تا ${priceShort(maxPay)}</span></div>
          <div class="panel mt"><h3>${icon('map', 22)} با این بودجه در این محله‌ها می‌توانید بخرید</h3>${picks.length ? Dal.charts.bars(picks.map((d) => ({ label: d.name, value: d.area, text: `حدود ${fa(d.area)} متر · ${d.city}` })), { max: Math.max(...picks.map((p) => p.area)), href: (i) => { const p = picks.find((x) => x.name === i.label); return `#/search?deal=sale&city=${p.citySlug}&district=${p.slug}&maxPrice=${Math.round(price)}`; } }) : html`<div class="muted">با این بودجه ملک در محله‌های پوشش‌داده‌شده یافت نشد؛ پیش‌پرداخت یا مدت وام را افزایش دهید.</div>`}</div>`);
      });
    },

    rentbuy(el) {
      mount(el, html`<div class="tool-layout"><form class="panel col gap" onsubmit="return false"><h3>${icon('trend', 22)} اجاره بمانم یا بخرم؟</h3>
        ${moneyFld('price', 'قیمت خانه‌ی مورد نظر', 10e9)}${slider('down', 'پیش‌پرداخت', 10, 100, 5, 40, '٪')}${slider('rate', 'نرخ سود وام', 5, 40, 0.5, 23, '٪')}${slider('years', 'مدت وام (سال)', 5, 25, 1, 15)}
        ${moneyFld('rent', 'اجاره‌ی ماهانه‌ی فعلی (معادل خانه‌ی مشابه)', 35e6)}${slider('rentg', 'رشد سالانه‌ی اجاره', 0, 50, 1, 25, '٪')}${slider('grow', 'رشد سالانه‌ی قیمت ملک', 0, 50, 1, 22, '٪')}${slider('inv', 'سود سرمایه‌گذاری پس‌انداز (اگر اجاره بمانم)', 0, 40, 1, 20, '٪')}${slider('horizon', 'افق مقایسه (سال)', 3, 20, 1, 10)}</form><div id="rb-out"></div></div>`);
      bindSliders(el, () => {
        const price = mon(el, 'price'), dp = price * val(el, 'down') / 100, loan = price - dp, yrs = val(el, 'years'), pay = calc.pmt(loan, val(el, 'rate'), yrs);
        const g = val(el, 'grow') / 100, rg = val(el, 'rentg') / 100, inv = val(el, 'inv') / 100, H = val(el, 'horizon');
        let rent = mon(el, 'rent'), portfolio = dp; const diff = []; let breakEven = null; const sch = calc.schedule(loan, val(el, 'rate'), yrs);
        for (let y = 1; y <= H; y++) {
          // اجاره‌نشین: پس‌انداز اولیه + مابه‌التفاوت قسط و اجاره را سرمایه‌گذاری می‌کند
          const buyPay = y <= yrs ? pay : 0;
          portfolio = portfolio * (1 + inv) + (buyPay - rent) * 12 * (1 + inv / 2);
          rent *= 1 + rg;
          const bal = y <= yrs ? sch[y * 12 - 1].bal : 0, equity = price * Math.pow(1 + g, y) - bal;
          diff.push({ x: String(y), y: equity - portfolio }); if (breakEven == null && equity - portfolio > 0) breakEven = y;
        }
        const last = diff[diff.length - 1].y;
        mount($('#rb-out', el), html`<div class="result-big"><span>پس از ${num(H)} سال</span><b>${last > 0 ? 'خرید برنده است 🏡' : 'اجاره و سرمایه‌گذاری برنده است 📈'}</b><span class="range">اختلاف ثروت خالص: ${priceShort(Math.abs(last))} تومان ${breakEven ? '· سربه‌سر شدن در سال ' + fa(breakEven) : ''}</span></div>
          <div class="panel mt"><h3>${icon('chart', 22)} مزیت خرید نسبت به اجاره (ثروت خالص)</h3><div id="rb-chart"></div><div class="calc-out"><div><b>${priceShort(pay)}</b><span>قسط ماهانه‌ی وام</span></div><div><b>${priceShort(dp)}</b><span>پیش‌پرداخت</span></div><div><b>${priceShort(price * Math.pow(1 + g, H))}</b><span>ارزش خانه در پایان</span></div></div><p class="muted mt" style="font-size:13px">مدل ساده‌شده است و هزینه‌های نگهداری، مالیات و تغییر نرخ‌ها را در نظر نمی‌گیرد.</p></div>`);
        Dal.charts.line($('#rb-chart', el), [{ x: '0', y: 0 }, ...diff], { xfmt: (x) => 'سال ' + fa(x), unit: 'تومان', color: last > 0 ? 'var(--ok)' : 'var(--accent)' });
      });
    },
  };

  // ---------------------------------------------------------------- برآورد قیمت
  Dal.pages.valuation = async (app, _p, query) => {
    Dal.setTitle('برآورد قیمت هوشمند ملک');
    const meta = Dal.state.meta; let city = query.city || Dal.defaultCity();
    const feats = ['parking', 'storage', 'elevator', 'balcony', 'pool', 'sauna', 'gym', 'smart', 'view', 'roofgarden', 'lobby', 'security'];
    mount(app, html`<div class="container section"><div class="sec-head"><div><h1 style="font-size:32px">${icon('sparkle', 30)} برآورد قیمت هوشمند</h1><p>ارزش بازار ملک شما را بر اساس آگهی‌های مشابه و روند محله حساب می‌کنیم.</p></div></div>
      <div class="tool-layout"><form class="panel col gap" id="val-form"><h3>مشخصات ملک</h3>
        <div class="form-grid" style="grid-template-columns:1fr 1fr"><label class="fld"><span>شهر</span><select name="city">${Dal.cityOptions(city)}</select></label><label class="fld"><span>محله</span><select name="district">${Dal.districtOptions(city, query.district)}</select></label></div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr"><label class="fld"><span>نوع ملک</span><select name="ptype">${Dal.optionList(meta.ptypes, query.ptype || 'apartment')}</select></label><label class="fld"><span>متراژ (متر مربع)</span><input name="area" inputmode="numeric" value="${query.area || 100}" required></label></div>
        <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr"><label class="fld"><span>اتاق خواب</span><input name="rooms" inputmode="numeric" value="2"></label><label class="fld"><span>سال ساخت</span><input name="year_built" inputmode="numeric" value="${query.year || 1400}"></label><label class="fld"><span>طبقه</span><input name="floor" inputmode="numeric" placeholder="۳"></label></div>
        <label class="fld"><span>تعداد کل طبقات</span><input name="floors_total" inputmode="numeric" placeholder="۶"></label>
        <div><span class="muted" style="font-weight:700;font-size:13px">امکانات</span><div class="chips mt">${feats.map((k) => html`<label class="chip"><input type="checkbox" name="features" value="${k}" ${['parking', 'elevator'].includes(k) ? 'checked' : ''}>${Dal.featName(k).i} ${Dal.featName(k).n}</label>`)}</div></div>
        <button class="btn primary lg block">${icon('sparkle', 20)} برآورد کن</button></form>
      <div id="val-out"><div class="panel center" style="padding:48px 24px">${icon('chart', 56)}<h3 style="justify-content:center;margin-top:12px">نتیجه اینجا نمایش داده می‌شود</h3><p class="muted">مشخصات را وارد کنید تا ارزش ملک، اجاره‌ی معادل و بازده را ببینید.</p></div></div></div></div>`);
    const form = $('#val-form', app), out = $('#val-out', app);
    form.city.addEventListener('change', () => mount(form.district, Dal.districtOptions(form.city.value)));
    const run = async () => {
      const b = { city: form.city.value, district: form.district.value, ptype: form.ptype.value, area: en(form.area.value), rooms: en(form.rooms.value), year_built: en(form.year_built.value), floor: en(form.floor.value), floors_total: en(form.floors_total.value), features: $$('[name=features]:checked', form).map((i) => i.value) };
      const r = await Dal.guard(() => Dal.api('/valuate', { method: 'POST', body: b }), $('button', form)); if (!r) return;
            const trend = await Dal.api('/analytics/trend', { query: { city: b.city, district: b.district } });
      mount(out, html`<div class="result-big"><span>ارزش برآوردی ${r.districtName}، ${r.cityName}</span><b>${priceWords(r.price)}</b><div class="range-bar"><i style="inset-inline:0"></i><em style="inset-inline-start:50%"></em></div><div class="row between range"><span>${priceShort(r.low)}</span><span>بازه‌ی منطقی بازار</span><span>${priceShort(r.high)}</span></div><div style="margin-top:12px;font-size:14px">اطمینان مدل: <b>٪${fa(r.confidence)}</b></div></div>
        <div class="kpis mt"><div class="kpi">${html`<span class="kpi-ic">${icon('ruler', 22)}</span>`}<div><div class="kpi-v">${priceShort(r.ppm)}</div><div class="kpi-l">قیمت هر متر (تومان)</div></div></div><div class="kpi ok"><span class="kpi-ic">${icon('key', 22)}</span><div><div class="kpi-v">${priceShort(r.monthlyRent)}</div><div class="kpi-l">اجاره‌ی ماهانه با ودیعه‌ی ${priceShort(r.rentDeposit)}</div></div></div><div class="kpi acc"><span class="kpi-ic">${icon('percent', 22)}</span><div><div class="kpi-v">٪${dec(r.grossYield, 1)}</div><div class="kpi-l">بازده ناخالص اجاره‌ی سالانه</div></div></div>${r.growth12 != null ? html`<div class="kpi ${r.growth12 > 0 ? 'ok' : 'bad'}"><span class="kpi-ic">${icon('trend', 22)}</span><div><div class="kpi-v">٪${dec(r.growth12, 1)}</div><div class="kpi-l">رشد قیمت محله در ۱۲ ماه</div></div></div>` : ''}</div>
        ${trend.items.length > 1 ? html`<div class="panel mt"><h3>${icon('trend', 22)} روند قیمت هر متر در ${r.districtName}</h3><div id="v-trend"></div></div>` : ''}
        ${r.comps.length ? html`<div class="panel mt"><h3>${icon('layers', 22)} آگهی‌های مشابه مبنای محاسبه</h3>${r.comps.map((c) => html`<a class="list-row" href="#/listing/${c.id}"><div class="main"><h4>${c.title}</h4><span class="muted">${num(c.area)} متر${c.year_built ? ' · ساخت ' + fa(c.year_built) : ''}</span></div><div><b>${priceShort(c.price)}</b><div class="muted" style="font-size:12px">متری ${priceShort(c.ppm)}</div></div></a>`)}</div>` : ''}
        <div class="row gap mt wrap"><a class="btn primary" href="#/new?price=${r.price}&city=${b.city}&district=${b.district}&area=${b.area}&ptype=${b.ptype}">${icon('plus', 18)} ثبت آگهی با این قیمت</a><a class="btn ghost" href="#/search?deal=sale&city=${b.city}&district=${b.district}">آگهی‌های ${r.districtName}</a></div>
        <div class="alert mt">${icon('info', 18)} <div>${r.basis === 'reference' ? 'مبنای این برآورد «قیمت مرجع» محله است، چون هنوز آگهی یا معامله‌ی مشابه کافی در دال ثبت نشده است؛ با رشد داده‌ها دقیق‌تر می‌شود.' : html`این برآورد بر پایه‌ی <b>${num(r.samples)}</b> آگهی/معامله‌ی مشابه در دال${r.basis === 'blended' ? ' و قیمت مرجع محله' : ''} محاسبه شده است.`} برآورد صرفاً راهنماست و جایگزین کارشناسی رسمی نیست.</div></div>`);
      if ($('#v-trend', out)) Dal.charts.line($('#v-trend', out), trend.items.map((t) => ({ x: t.month, y: t.ppm })), { xfmt: (x, long) => Dal.monthLabel(x, long), unit: 'تومان / متر' });
      if (innerWidth < 1100) out.scrollIntoView({ behavior: 'smooth' });
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); run(); });
    if (query.district && query.area) run();
  };
})();
