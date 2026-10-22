/* دال — راه‌اندازی برنامه */
'use strict';
(async function () {
  const { html, mount, $ } = Dal;
  const R = Dal.route; const P = Dal.pages;
  R('/', P.home); R('/search', P.search); R('/listing/:id', P.listing);
  R('/valuation', P.valuation); R('/tools', P.tools); R('/market', P.market);
  R('/agents', P.agents); R('/agent/:id', P.agent); R('/magazine', P.magazine); R('/article/:slug', P.article);
  R('/requests', P.requests); R('/compare', P.compare); R('/about', P.about);
  R('/login', P.login); R('/register', P.register); R('/forgot', P.forgot); R('/consult', P.consult); R('/setup', P.setup);
  R('/dashboard', P.dashboard); R('/dashboard/:tab', P.dashboard);
  R('/messages', P.messages); R('/messages/:id', P.messages);
  R('/new', P.newListing); R('/edit/:id', P.newListing);
  R('/card/:id', P.card); R('/my-card', P.mycard); R('/install', P.install);
  R('/deals', P.deals); R('/sell', P.lead); R('/want', P.lead); R('/city/:slug', P.city);
  R('/book', P.book); R('/book/:id', P.book);
  R('/admin', P.admin); R('/admin/:tab', P.admin);

  try {
    Dal.state.meta = await Dal.api('/meta');
    if (Dal.token()) { try { const r = await Dal.api('/me'); Dal.state.user = r.user; } catch { /* invalid token */ } }
  } catch (e) {
    mount($('#app'), html`<div class="container section"><div class="empty"><h3>اتصال به سرور برقرار نشد</h3><p>${e.message}</p><button class="btn primary" onclick="location.reload()">تلاش دوباره</button></div></div>`);
    return;
  }
  try { Dal.state.needsSetup = (await Dal.api('/setup/status')).needsSetup; } catch { /* ignore */ }
  // سایت قبل از راه‌اندازی هم دیده می‌شود؛ فقط یک نوار بالا مدیر را به ساخت حساب هدایت می‌کند
  if (Dal.state.needsSetup) {
    const bar = document.createElement('a'); bar.className = 'setup-bar'; bar.href = '#/setup';
    bar.textContent = 'این سایت هنوز راه‌اندازی نشده است — برای ساخت حساب مدیر اینجا را بزنید ←';
    document.body.prepend(bar);
    window.addEventListener('hashchange', () => { bar.style.display = /^#\/setup/.test(location.hash) ? 'none' : ''; });
    bar.style.display = /^#\/setup/.test(location.hash) ? 'none' : '';
  }
  Dal.ui.renderHeader(); Dal.ui.renderFooter(); Dal.ui.renderFab();
  if (Dal.state.user) Dal.setSession(null, Dal.state.user);
  Dal.ready = true; await Dal.render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
