/* دال — رنگ‌آمیزی عددها و شماره‌ها بدون تغییر در محتوای صفحه (CSS Highlight API) */
(function () {
  'use strict';
  if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
  const H = { n: new Highlight(), nd: new Highlight(), t: new Highlight(), td: new Highlight() };
  CSS.highlights.set('dal-num', H.n); CSS.highlights.set('dal-num-d', H.nd); CSS.highlights.set('dal-tel', H.t); CSS.highlights.set('dal-tel-d', H.td);
  const SKIP = 'script,style,svg,textarea,input,select,option,button,code,pre,.btn,.badge,.fab-consult,.nodig,.recovery-code,.tk-val,.pay-card,.kbd,.leaflet-container,.price-pin,.icon-btn,[contenteditable],b[data-count],.hero-stats';
  const DARK = '.footer,.hero,.tools-band,.city-tile,.consult-hero,.cta,.focus-card,.bc-foot,.header,.drawer,.bottom-nav,.compare-bar';
  const TEL = 'a[href^="tel:"],.tel,.phone';
  const D = '0-9۰-۹٠-٩'; const RE = new RegExp('[' + D + ']+(?:[٬٫,.][' + D + ']+)*', 'g'); const HAS = new RegExp('[' + D + ']');
  function scan() {
    for (const k in H) H[k].clear();
    if (!document.body) return;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (HAS.test(n.nodeValue) && n.parentElement && !n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    let n;
    while ((n = w.nextNode())) {
      const el = n.parentElement; const dark = !!el.closest(DARK); const tel = !!el.closest(TEL);
      const set = H[(tel ? 't' : 'n') + (dark ? 'd' : '')];
      RE.lastIndex = 0; let m; const txt = n.nodeValue;
      while ((m = RE.exec(txt))) { const r = new Range(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); set.add(r); }
    }
  }
  let pend = 0;
  const later = () => { if (pend) return; pend = setTimeout(() => { pend = 0; try { scan(); } catch (e) { /* بی‌صدا */ } }, 90); };
  const start = () => { scan(); new MutationObserver(later).observe(document.body, { childList: true, subtree: true, characterData: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
