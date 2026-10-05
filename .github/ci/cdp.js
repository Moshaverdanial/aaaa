#!/usr/bin/env node
// node cdp.js "<عبارت جاوااسکریپت>"  ← در WebView اپ روی شبیه‌ساز اجرا می‌شود (adb forward tcp:9222 ...) و نتیجه چاپ می‌شود
const http = require('http');
const WebSocket = require('ws');
const expr = process.argv[2];
http.get('http://127.0.0.1:9222/json', (res) => {
  let b = ''; res.on('data', (d) => (b += d));
  res.on('end', () => {
    const pages = JSON.parse(b).filter((p) => p.type === 'page');
    const pg = pages.find((p) => /10\.0\.2\.2/.test(p.url)) || pages[0];
    if (!pg) { console.log('NO_PAGE ' + b.slice(0, 200)); process.exit(0); }
    const ws = new WebSocket(pg.webSocketDebuggerUrl);
    ws.on('open', () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })));
    ws.on('message', (m) => {
      const j = JSON.parse(m);
      if (j.id === 1) { console.log(j.result && j.result.result ? (j.result.result.value !== undefined ? j.result.result.value : j.result.result.description) : JSON.stringify(j)); ws.close(); process.exit(0); }
    });
    ws.on('error', (e) => { console.log('WS_ERR ' + e.message); process.exit(0); });
    setTimeout(() => { console.log('TIMEOUT'); process.exit(0); }, 20000);
  });
}).on('error', (e) => { console.log('HTTP_ERR ' + e.message); process.exit(0); });
