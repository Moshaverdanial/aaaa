/* دال — تولید QR کد بدون هیچ کتابخانه و سرویس بیرونی (حالت بایت، سطح تصحیح M، نسخه‌های ۱ تا ۱۰ ≈ تا ۲۱۰ بایت) */
'use strict';
(function (root) {
  const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]; // کدواژه‌ی تصحیح هر بلوک (سطح M)
  const BLK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]; // تعداد بلوک‌ها

  const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCw = (v) => Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v];

  // --- میدان گالوا و ریدسولومون
  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  function rsGen(d) { const r = new Array(d).fill(0); r[d - 1] = 1; let root = 1; for (let i = 0; i < d; i++) { for (let j = 0; j < d; j++) { r[j] = mul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; }
  function rsRem(data, gen) { const res = new Array(gen.length).fill(0); for (const b of data) { const f = b ^ res.shift(); res.push(0); gen.forEach((c, i) => { res[i] ^= mul(c, f); }); } return res; }

  function utf8(str) { return Array.from(new TextEncoder().encode(str)); }

  function makeCodewords(bytes, v) {
    const bits = []; const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach((b) => put(b, 8));
    const cap = dataCw(v) * 8; put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    const nb = BLK[v], ecl = ECC[v], total = Math.floor(rawModules(v) / 8), nShort = nb - (total % nb), shortLen = Math.floor(total / nb);
    const gen = rsGen(ecl); const blocks = []; let k = 0;
    for (let i = 0; i < nb; i++) { const len = shortLen - ecl + (i < nShort ? 0 : 1); const d = data.slice(k, k + len); k += len; blocks.push({ d, e: rsRem(d, gen) }); }
    const out = []; const maxD = Math.max(...blocks.map((b) => b.d.length));
    for (let i = 0; i < maxD; i++) blocks.forEach((b) => { if (i < b.d.length) out.push(b.d[i]); });
    for (let i = 0; i < ecl; i++) blocks.forEach((b) => out.push(b.e[i]));
    return out;
  }

  function alignPos(v) { if (v === 1) return []; const n = Math.floor(v / 7) + 2, size = v * 4 + 17, step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2; const r = [6]; for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p); return r; }

  function build(bytes) {
    let v = 1; while (v <= 10 && bytes.length > dataCw(v) - (v < 10 ? 2 : 3)) v++;
    if (v > 10) throw new Error('متن برای QR بیش از حد طولانی است.');
    const size = v * 4 + 17; const M = Array.from({ length: size }, () => new Array(size).fill(false)); const F = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = alignPos(v);
    ap.forEach((ax, i) => ap.forEach((ay, j) => { if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
    const drawFormat = (mask) => {
      const data = (0 << 3) | mask; let rem = data; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((data << 10) | rem) ^ 0x5412; const bit = (i) => ((bits >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i)); set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (v >= 7) { let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25); const bits = (v << 12) | rem; for (let i = 0; i < 18; i++) { const c = ((bits >>> i) & 1) !== 0, a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, c); set(b, a, c); } }
    // جای‌دادن داده‌ها
    const cw = makeCodewords(bytes, v); let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!F[y][x] && i < cw.length * 8) { M[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
      }
    }
    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
    const apply = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => {
      let p = 0;
      const line = (get) => { let run = 1; for (let a = 1; a <= size; a++) { if (a < size && get(a) === get(a - 1)) run++; else { if (run >= 5) p += run - 2; run = 1; } } };
      for (let y = 0; y < size; y++) line((x) => M[y][x]);
      for (let x = 0; x < size; x++) line((y) => M[y][x]);
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (M[y][x] === M[y][x + 1] && M[y][x] === M[y + 1][x] && M[y][x] === M[y + 1][x + 1]) p += 3;
      const pat = [true, false, true, true, true, false, true, false, false, false, false];
      const scan = (get) => { for (let a = 0; a + 11 <= size; a++) { let f1 = true, f2 = true; for (let k = 0; k < 11; k++) { if (get(a + k) !== pat[k]) f1 = false; if (get(a + k) !== pat[10 - k]) f2 = false; } if (f1) p += 40; if (f2) p += 40; } };
      for (let y = 0; y < size; y++) scan((x) => M[y][x]);
      for (let x = 0; x < size; x++) scan((y) => M[y][x]);
      let dark = 0; M.forEach((r) => r.forEach((c) => { if (c) dark++; })); p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) { apply(m); drawFormat(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } apply(m); }
    apply(best); drawFormat(best);
    return M;
  }

  /** ماتریس QR (آرایه‌ی دوبعدی از true/false) */
  function qrMatrix(text) { return build(utf8(String(text))); }
  /** رشته‌ی SVG؛ quiet=حاشیه‌ی سفید به ماژول */
  function qrSvg(text, { size = 220, dark = '#0b1230', light = '#ffffff', quiet = 3, label = 'QR' } = {}) {
    const m = qrMatrix(text), n = m.length + quiet * 2; let d = '';
    m.forEach((row, y) => { let x = 0; while (x < row.length) { if (row[x]) { let w = 1; while (x + w < row.length && row[x + w]) w++; d += `M${x + quiet} ${y + quiet}h${w}v1h-${w}z`; x += w; } else x++; } });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${label}"><rect width="${n}" height="${n}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
  }
  const api = { qrMatrix, qrSvg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root.Dal) { root.Dal.qrMatrix = qrMatrix; root.Dal.qrSvg = qrSvg; }
})(typeof window !== 'undefined' ? window : globalThis);
