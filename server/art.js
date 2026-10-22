'use strict';
// تولید تصاویر SVG برای آگهی‌های نمونه (بدون وابستگی به منابع بیرونی)

function rng(seed) {
  let a = 0;
  for (const ch of String(seed)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 0x9e3779b9) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hsl = (h, s, l) => `hsl(${Math.round(h) % 360} ${s}% ${l}%)`;
const W = 800, H = 600;

function sky(r, hue, mood) {
  const moods = {
    day: [[205, 80, 78], [200, 85, 92]],
    sunset: [[(hue % 40) + 10, 90, 62], [(hue % 30) + 330, 70, 78]],
    night: [[230, 55, 14], [250, 45, 30]],
    dawn: [[330, 60, 72], [30, 85, 82]],
  };
  const [a, b] = moods[mood];
  let s = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(...a)}"/><stop offset="1" stop-color="${hsl(...b)}"/></linearGradient></defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  if (mood === 'night') {
    for (let i = 0; i < 60; i++) s += `<circle cx="${r() * W}" cy="${r() * 260}" r="${r() * 1.6 + 0.3}" fill="#fff" opacity="${0.4 + r() * 0.6}"/>`;
    s += `<circle cx="${620 + r() * 120}" cy="${70 + r() * 40}" r="30" fill="#fdf6d8"/><circle cx="${635 + r() * 120}" cy="${62 + r() * 40}" r="26" fill="${hsl(...a)}" opacity=".0"/>`;
  } else {
    const sx = 100 + r() * 600, sy = mood === 'day' ? 80 + r() * 40 : 190 + r() * 40;
    s += `<circle cx="${sx}" cy="${sy}" r="${mood === 'day' ? 34 : 54}" fill="#fff6c8" opacity=".95"/><circle cx="${sx}" cy="${sy}" r="${mood === 'day' ? 62 : 90}" fill="#fff6c8" opacity=".25"/>`;
    for (let i = 0; i < 4; i++) { const cx = r() * W, cy = 40 + r() * 140, sc = 0.6 + r() * 0.9; s += `<g opacity=".85" fill="#fff"><ellipse cx="${cx}" cy="${cy}" rx="${60 * sc}" ry="${16 * sc}"/><ellipse cx="${cx + 26 * sc}" cy="${cy - 10 * sc}" rx="${34 * sc}" ry="${15 * sc}"/></g>`; }
  }
  // کوه‌های البرز
  const night = mood === 'night';
  for (let layer = 0; layer < 2; layer++) {
    let d = `M0 ${H}`; let x = 0;
    const base = 330 + layer * 40;
    while (x <= W + 60) { d += ` L${x} ${base - r() * (120 - layer * 40) - 20}`; x += 40 + r() * 50; }
    d += ` L${W} ${H} Z`;
    s += `<path d="${d}" fill="${night ? hsl(235, 35, 18 - layer * 4) : hsl(215 + layer * 10, 22 - layer * 6, 62 - layer * 14)}" opacity="${0.9 - layer * 0.1}"/>`;
  }
  return s;
}

function tree(r, x, y, sc, night) {
  const g = night ? 22 : 38;
  return `<g transform="translate(${x} ${y}) scale(${sc})"><rect x="-4" y="-30" width="8" height="34" fill="${night ? '#2b2118' : '#6b4a2b'}"/><circle cx="0" cy="-50" r="26" fill="${hsl(120 + r() * 30, 45, g + 6)}"/><circle cx="-14" cy="-38" r="18" fill="${hsl(125 + r() * 25, 48, g)}"/><circle cx="15" cy="-40" r="19" fill="${hsl(115 + r() * 30, 46, g + 3)}"/></g>`;
}

function windows(r, x, y, w, h, cols, rows, night, lit = 0.5) {
  let s = ''; const gw = w / cols, gh = h / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const on = night && r() < lit;
    s += `<rect x="${x + i * gw + gw * 0.18}" y="${y + j * gh + gh * 0.18}" width="${gw * 0.64}" height="${gh * 0.62}" rx="2" fill="${on ? '#ffd76a' : night ? '#2a3550' : '#bfe0f5'}" ${on ? 'opacity=".95"' : 'opacity=".9"'}/>`;
  }
  return s;
}

function exterior(seed, ptype, hue) {
  const r = rng(seed);
  const mood = ['day', 'day', 'sunset', 'night', 'dawn'][Math.floor(r() * 5)];
  const night = mood === 'night';
  let s = sky(r, hue, mood);
  s += `<rect y="470" width="${W}" height="130" fill="${night ? '#17261b' : hsl(110, 30, 42)}"/>`;
  s += `<rect y="505" width="${W}" height="95" fill="${night ? '#2a2c33' : '#6f7480'}"/><g stroke="#e8e8e8" stroke-width="4" stroke-dasharray="30 24" opacity=".7"><line x1="0" y1="552" x2="${W}" y2="552"/></g>`;
  const wall = hsl(hue, 28, night ? 38 : 80), wall2 = hsl(hue, 30, night ? 30 : 68);
  if (ptype === 'villa' || ptype === 'garden') {
    s += tree(r, 90, 490, 1.3, night) + tree(r, 710, 495, 1.1, night);
    s += `<rect x="200" y="300" width="400" height="190" fill="${wall}"/><rect x="200" y="300" width="400" height="12" fill="${wall2}"/>`;
    s += `<polygon points="180,300 400,200 620,300" fill="${hsl(hue + 340, 40, night ? 26 : 38)}"/>`;
    s += `<rect x="370" y="390" width="60" height="100" rx="3" fill="${hsl(hue + 20, 40, 28)}"/><circle cx="420" cy="442" r="3" fill="#ffd76a"/>`;
    s += windows(r, 225, 335, 130, 90, 2, 1, night, 0.9) + windows(r, 445, 335, 130, 90, 2, 1, night, 0.9);
    s += `<rect x="215" y="440" width="150" height="40" fill="#8bd3ee" opacity=".0"/>`;
    s += tree(r, 640, 492, 0.8, night);
    if (r() > 0.4) s += `<rect x="40" y="520" width="170" height="40" rx="8" fill="#5bc0e8" opacity=".85"/><path d="M50 535 q20 -8 40 0 t40 0 t40 0" stroke="#fff" fill="none" opacity=".7"/>`;
  } else if (ptype === 'land') {
    s += `<rect y="400" width="${W}" height="110" fill="${night ? '#1d2c1d' : hsl(95, 35, 52)}"/>`;
    for (let i = 0; i < 20; i++) s += `<rect x="${40 + i * 36}" y="420" width="5" height="60" fill="${night ? '#3a2f22' : '#8a6a44'}"/>`;
    s += `<rect x="40" y="436" width="${19 * 36 + 5}" height="5" fill="${night ? '#4a3a2a' : '#a8855b'}"/><rect x="40" y="460" width="${19 * 36 + 5}" height="5" fill="${night ? '#4a3a2a' : '#a8855b'}"/>`;
    s += `<rect x="370" y="330" width="6" height="110" fill="#795"/><rect x="300" y="290" width="150" height="62" rx="6" fill="#fff"/><text x="375" y="318" text-anchor="middle" font-size="22" font-weight="700" fill="#d33" font-family="sans-serif">FOR SALE</text><text x="375" y="342" text-anchor="middle" font-size="14" fill="#555" font-family="sans-serif">DAL</text>`;
    s += tree(r, 120, 430, 0.8, night) + tree(r, 680, 430, 0.9, night);
  } else if (ptype === 'shop' || ptype === 'office') {
    const bw = ptype === 'shop' ? 420 : 300, bx = (W - bw) / 2, by = ptype === 'shop' ? 330 : 120, bh = 490 - by;
    s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${ptype === 'shop' ? wall : hsl(205, 30, night ? 26 : 56)}"/>`;
    if (ptype === 'office') {
      s += windows(r, bx + 12, by + 14, bw - 24, bh - 130, 8, 10, night, 0.55);
      s += `<rect x="${bx}" y="${by - 10}" width="${bw}" height="10" fill="#334"/>`;
      s += `<rect x="${W / 2 - 50}" y="410" width="100" height="80" fill="#9fd3ea" opacity=".85"/><line x1="${W / 2}" y1="410" x2="${W / 2}" y2="490" stroke="#345"/>`;
    } else {
      s += `<rect x="${bx + 20}" y="380" width="${bw - 40}" height="110" fill="${night ? '#ffe9a6' : '#cfeaf7'}" opacity=".9"/>`;
      for (let i = 0; i < 12; i++) s += `<polygon points="${bx + i * 35},350 ${bx + i * 35 + 35},350 ${bx + i * 35 + 35},380 ${bx + i * 35},380" fill="${i % 2 ? '#fff' : hsl(hue, 70, 50)}"/>`;
      s += `<rect x="${bx + 160}" y="395" width="70" height="95" fill="#79b" opacity=".6"/>`;
      s += `<rect x="${bx + 120}" y="300" width="180" height="32" rx="4" fill="#223"/><text x="${bx + 210}" y="323" text-anchor="middle" font-size="18" fill="#ffd76a" font-family="sans-serif">SHOP</text>`;
    }
    s += tree(r, 110, 492, 1, night) + tree(r, 700, 492, 1, night);
  } else { // apartment / penthouse
    const bw = 260 + r() * 80, bx = 400 - bw / 2, floors = 7 + Math.floor(r() * 6), bh = Math.min(330, 40 + floors * 30), by = 490 - bh;
    // ساختمان‌های پس‌زمینه
    for (let i = 0; i < 5; i++) { const w = 70 + r() * 60, h = 120 + r() * 160, x = i < 3 ? 10 + i * 90 : 560 + (i - 3) * 110; s += `<rect x="${x}" y="${490 - h}" width="${w}" height="${h}" fill="${hsl(hue + 20, 12, night ? 20 : 66)}" opacity=".8"/>${windows(r, x + 6, 490 - h + 8, w - 12, h - 16, 4, Math.floor(h / 28), night, 0.4)}`; }
    s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${wall}"/><rect x="${bx - 6}" y="${by - 10}" width="${bw + 12}" height="12" fill="${wall2}"/>`;
    s += windows(r, bx + 12, by + 14, bw - 24, bh - 70, 5, floors - 2, night, 0.5);
    for (let i = 0; i < floors - 2; i++) s += `<rect x="${bx + 8}" y="${by + 14 + (i + 1) * ((bh - 70) / (floors - 2)) - 4}" width="${bw - 16}" height="3" fill="${wall2}" opacity=".7"/>`;
    s += `<rect x="${bx + bw / 2 - 28}" y="440" width="56" height="50" rx="3" fill="${night ? '#ffe9a6' : '#8fc9e0'}"/><rect x="${bx + bw / 2 - 40}" y="432" width="80" height="8" fill="#334"/>`;
    if (ptype === 'penthouse') s += `<rect x="${bx + 30}" y="${by - 34}" width="${bw - 60}" height="26" fill="${wall2}"/>${tree(r, bx + 60, by - 8, 0.4, night)}${tree(r, bx + bw - 60, by - 8, 0.4, night)}<rect x="${bx + 30}" y="${by - 40}" width="${bw - 60}" height="6" fill="#9fd3ea" opacity=".8"/>`;
    s += tree(r, bx - 50, 494, 1, night) + tree(r, bx + bw + 50, 494, 1.1, night);
  }
  if (night) s += `<rect width="${W}" height="${H}" fill="#0a1030" opacity=".12"/>`;
  return s;
}

function interior(seed, kind, hue) {
  const r = rng(seed + kind);
  const wallC = hsl(hue, 22, 86), floorC = hsl(28 + r() * 10, 40, 56);
  let s = `<rect width="${W}" height="${H}" fill="${wallC}"/><rect y="440" width="${W}" height="160" fill="${floorC}"/>`;
  for (let i = 0; i < 12; i++) s += `<line x1="${i * 80}" y1="440" x2="${i * 80 - 140 + i * 24}" y2="600" stroke="#0002"/>`;
  s += `<rect y="430" width="${W}" height="14" fill="${hsl(hue, 20, 96)}"/>`;
  // پنجره
  const wx = 90 + r() * 400;
  s += `<rect x="${wx}" y="90" width="210" height="250" fill="#6e5a46"/><rect x="${wx + 10}" y="100" width="190" height="230" fill="url(#vw)"/><line x1="${wx + 105}" y1="100" x2="${wx + 105}" y2="330" stroke="#6e5a46" stroke-width="6"/><line x1="${wx + 10}" y1="215" x2="${wx + 200}" y2="215" stroke="#6e5a46" stroke-width="6"/>`;
  s += `<defs><linearGradient id="vw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd3f5"/><stop offset="1" stop-color="#e5f4fb"/></linearGradient></defs>`;
  s += `<path d="M${wx - 10} 85 q-20 130 -6 270 h50 q-10 -140 8 -270z" fill="${hsl(hue + 30, 35, 70)}" opacity=".9"/><path d="M${wx + 220} 85 q20 130 6 270 h-50 q10 -140 -8 -270z" fill="${hsl(hue + 30, 35, 70)}" opacity=".9"/>`;
  const main = hsl(hue + 180 + r() * 40, 35, 45);
  if (kind === 'living') {
    s += `<ellipse cx="400" cy="540" rx="260" ry="40" fill="${hsl(hue + 20, 40, 72)}"/>`;
    s += `<g><rect x="190" y="390" width="420" height="90" rx="22" fill="${main}"/><rect x="200" y="350" width="400" height="60" rx="22" fill="${main}" opacity=".9"/><rect x="170" y="380" width="46" height="100" rx="18" fill="${main}"/><rect x="584" y="380" width="46" height="100" rx="18" fill="${main}"/>`;
    for (let i = 0; i < 3; i++) s += `<rect x="${230 + i * 110}" y="372" width="86" height="40" rx="10" fill="${hsl(hue + i * 50, 50, 70)}" opacity=".55"/>`;
    s += `</g><rect x="330" y="500" width="140" height="40" rx="6" fill="#5b4332"/><circle cx="400" cy="495" r="8" fill="#3a7d44"/>`;
    s += `<rect x="650" y="110" width="90" height="120" fill="${hsl(hue + 60, 30, 40)}"/><rect x="658" y="118" width="74" height="104" fill="${hsl(hue + 100, 40, 70)}"/>`;
    s += `<rect x="40" y="180" width="8" height="260" fill="#555"/><path d="M10 180 h68 l-14 -40 h-40z" fill="#f4d58d"/>`;
  } else if (kind === 'bedroom') {
    s += `<rect x="190" y="360" width="400" height="130" rx="14" fill="${hsl(hue + 30, 30, 90)}"/><rect x="190" y="330" width="400" height="60" rx="12" fill="${hsl(hue + 10, 30, 40)}"/><rect x="200" y="400" width="380" height="80" rx="10" fill="${main}"/>`;
    s += `<rect x="215" y="365" width="120" height="50" rx="16" fill="#fff"/><rect x="445" y="365" width="120" height="50" rx="16" fill="#fff"/>`;
    s += `<rect x="130" y="410" width="48" height="70" fill="#7a5a3c"/><rect x="610" y="410" width="48" height="70" fill="#7a5a3c"/><path d="M144 405 h20 l-4 -24 h-12z" fill="#f4d58d"/><path d="M624 405 h20 l-4 -24 h-12z" fill="#f4d58d"/>`;
    s += `<rect x="330" y="150" width="130" height="90" fill="#fff"/><rect x="338" y="158" width="114" height="74" fill="${hsl(hue + 90, 40, 70)}"/>`;
  } else if (kind === 'kitchen') {
    s += `<rect x="0" y="330" width="${W}" height="110" fill="${hsl(hue, 15, 94)}"/>`;
    for (let i = 0; i < 10; i++) s += `<rect x="${i * 80}" y="330" width="80" height="110" fill="none" stroke="#0001"/>`;
    s += `<rect x="40" y="130" width="${W - 80}" height="100" rx="6" fill="${main}"/>`;
    for (let i = 0; i < 8; i++) s += `<rect x="${48 + i * 94}" y="138" width="86" height="84" rx="3" fill="${hsl(hue + 190, 30, 52)}" stroke="#0002"/><rect x="${88 + i * 94}" y="200" width="6" height="16" fill="#ddd"/>`;
    s += `<rect x="40" y="440" width="${W - 80}" height="130" rx="6" fill="${main}"/><rect x="30" y="425" width="${W - 60}" height="22" rx="4" fill="#e9e5df"/>`;
    for (let i = 0; i < 7; i++) s += `<rect x="${48 + i * 107}" y="458" width="98" height="104" rx="3" fill="${hsl(hue + 190, 30, 50)}" stroke="#0002"/>`;
    s += `<polygon points="330,230 470,230 430,170 370,170" fill="#c8ccd1"/><circle cx="560" cy="412" r="12" fill="#d33"/><rect x="620" y="395" width="70" height="28" rx="4" fill="#555"/>`;
  } else { // bath
    s += `<rect width="${W}" height="${H}" fill="${hsl(hue + 160, 25, 88)}"/>`;
    for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) s += `<rect x="${i * 70}" y="${j * 55}" width="68" height="53" fill="${hsl(hue + 160, 25, 92)}"/>`;
    s += `<rect y="470" width="${W}" height="130" fill="${hsl(hue + 160, 12, 70)}"/>`;
    s += `<rect x="440" y="320" width="300" height="160" rx="50" fill="#fff" stroke="#d7e2e8" stroke-width="4"/><rect x="460" y="338" width="260" height="110" rx="40" fill="#dff0f6"/><rect x="590" y="240" width="10" height="90" fill="#aab"/>`;
    s += `<rect x="90" y="360" width="240" height="30" rx="6" fill="#fff"/><rect x="100" y="390" width="220" height="90" fill="${hsl(hue, 25, 50)}"/><ellipse cx="210" cy="362" rx="70" ry="14" fill="#e7eff3"/><rect x="205" y="320" width="10" height="40" fill="#bbb"/>`;
    s += `<rect x="110" y="170" width="200" height="130" rx="8" fill="#eaf6fb" stroke="#bbb" stroke-width="6"/>`;
  }
  s += `<rect width="${W}" height="${H}" fill="url(#vig)"/><defs><radialGradient id="vig"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient></defs>`;
  return s;
}

function plan(seed, rooms, area) {
  const r = rng(seed + 'plan');
  const n = Math.max(1, rooms) + 2; // اتاق‌ها + پذیرایی + آشپزخانه
  let s = `<rect width="${W}" height="${H}" fill="#f4f7fb"/>`;
  for (let i = 0; i < W; i += 40) s += `<line x1="${i}" y1="0" x2="${i}" y2="${H}" stroke="#dde5f0"/>`;
  for (let j = 0; j < H; j += 40) s += `<line x1="0" y1="${j}" x2="${W}" y2="${j}" stroke="#dde5f0"/>`;
  const x0 = 100, y0 = 90, w = 600, h = 400;
  s += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#fff" stroke="#2b3a55" stroke-width="8"/>`;
  const names = ['پذیرایی', 'آشپزخانه', 'اتاق خواب ۱', 'اتاق خواب ۲', 'اتاق خواب ۳', 'اتاق خواب ۴', 'اتاق خواب ۵'];
  const cols = n > 4 ? 3 : 2, rowsN = Math.ceil(n / cols);
  const cw = w / cols, ch = h / rowsN;
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i % cols) * cw, cy = y0 + Math.floor(i / cols) * ch;
    s += `<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="${hsl(200 + i * 22, 50, 94)}" stroke="#2b3a55" stroke-width="4"/>`;
    s += `<text x="${cx + cw / 2}" y="${cy + ch / 2}" text-anchor="middle" font-size="20" fill="#2b3a55" font-family="Vazirmatn, Tahoma, sans-serif">${names[i] || 'اتاق'}</text>`;
    s += `<rect x="${cx + cw / 2 - 18}" y="${cy + (r() > 0.5 ? -3 : ch - 3)}" width="36" height="6" fill="#fff"/>`;
  }
  s += `<text x="400" y="545" text-anchor="middle" font-size="22" fill="#2b3a55" font-family="Vazirmatn, Tahoma, sans-serif">نقشه‌ی شماتیک — ${area} متر مربع</text>`;
  return s;
}

function render(seed, kind = 'ext', opts = {}) {
  const hue = Number.isFinite(+opts.hue) ? +opts.hue : 200;
  let body;
  if (kind === 'plan') body = plan(seed, +opts.rooms || 2, opts.area || 100);
  else if (['living', 'bedroom', 'kitchen', 'bath'].includes(kind)) body = interior(seed, kind, hue);
  else body = exterior(seed, opts.ptype || 'apartment', hue);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
}

module.exports = { render, rng };
