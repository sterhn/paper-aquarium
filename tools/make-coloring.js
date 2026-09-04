/* Генератор листов раскраски.
 *
 *   node tools/make-coloring.js
 *   node tools/make-pdf.js
 *
 * На выходе: assets/coloring/<вид>.svg и assets/coloring/manifest.json.
 *
 * Лист А4 альбомный. По углам — четыре метки 6×6 клеток с чёрной рамкой;
 * 16 внутренних клеток кодируют «какой это вид» и «какой это угол», по ним
 * capture.js находит лист на фотографии и выправляет перспективу.
 *
 * Фигурки — не модели, а простые тела с развёрткой на листе:
 *   · кубик  — крестообразная развёртка с язычками для склейки, как у
 *              бумажных коробочек: шесть квадратов, каждый — грань кубика;
 *   · планета — одна полоска 2:1: она оборачивается вокруг шарика как
 *              карта мира вокруг глобуса (равнопромежуточная проекция).
 * Ребёнок красит развёртку, телефон снимает лист, и та же самая картинка
 * ложится на фигурку в сцене (assets/shape.js знает, какой прямоугольник
 * листа — какая грань). Лист заодно можно вырезать и склеить руками.
 *
 * Коды меток подбираются здесь, а не берутся из головы: capture.js сравнивает
 * биты ТОЧНО, без допуска, поэтому два вида, отличающиеся на одну клетку, —
 * это тихая подмена вида при одном неверно прочитанном пикселе. Ниже коды
 * разводятся так, чтобы между любыми двумя (с учётом всех поворотов)
 * расстояние Хэмминга было не меньше MIN_DIST.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'coloring');

// ── лист ────────────────────────────────────────────────────────────────────
const SHEET = {
  w: 297, h: 210,
  marker: { size: 18, margin: 8, cells: 6 },
  markerPositions: { tl: [8, 8], tr: [271, 8], bl: [8, 184], br: [271, 184] },
  // поле для развёртки: не залезаем на метки и оставляем поля под принтер.
  // capture.js меряет по нему баланс белого — по бумаге вокруг развёртки.
  work: { x0: 36, x1: 261, y0: 30, y1: 180 }
};

// Линии на листе. Сплошная — где резать, пунктир — где сгибать. Обе серые
// и тонкие: чёрная жирная обводка спорила бы с рисунком ребёнка, а после
// съёмки оставалась бы каймой. Внутрь грани попадает только пунктир по
// краю, и его capture/shape.js срезают: грань читается с отступом TRIM_MM.
const CUT = { color: '#8a8a8a', width: 0.6 };
const FOLD = { color: '#d6d6d6', width: 0.35, dash: '1.8 2.2' };
const HINT = { color: '#e0e0e0', width: 0.5 };
const TRIM_MM = 1.8;

// ── виды ────────────────────────────────────────────────────────────────────
// name — ключ вида (имя записи в pack.json и в аквариуме), title — что видит
// ребёнок, shape — что строит сцена, size — размер фигурки в аквариуме
// (единицы сцены; аквариум примерно 24 × 13 × 24).
const SPECIES = [
  { name: 'cube', title: 'Кубик', shape: 'cube', size: 1.0,
    face: 45, tab: 6, hint: 'Вырежи по сплошной линии, согни по пунктиру, склей за язычки — и кубик готов' },
  { name: 'planet', title: 'Планета', shape: 'sphere', size: 1.1,
    strip: [200, 100], hint: 'Раскрась полоску — она обернётся вокруг планеты. Левый и правый край сойдутся' },
  { name: 'star', title: 'Звезда', shape: 'star', size: 1.1,
    star: true, hint: 'Раскрась звезду — она оживёт в аквариуме' }
];

function sheetFile(name) { return name + '.svg'; }

// ── коды меток ──────────────────────────────────────────────────────────────
const MIN_DIST = 4;   // минимум различий между любыми двумя кодами и их поворотами

function rotate(bits) {
  const o = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[c * 4 + (3 - r)] = bits[r * 4 + c];
  return o;
}
function popcount(n) { let c = 0; while (n) { n &= n - 1; c++; } return c; }
function bitsOf(n) {
  const b = new Array(16);
  for (let i = 0; i < 16; i++) b[i] = (n >> (15 - i)) & 1;
  return b;
}
function numOf(bits) { return bits.reduce((a, b) => (a << 1) | b, 0); }

// Кандидаты: коды с умеренным числом белых клеток. Слишком светлая или
// слишком тёмная середина плохо бинаризуется — capture.js берёт порог как
// середину между min и max по клеткам самой метки.
function candidates() {
  const out = [];
  for (let n = 0; n < 65536; n++) {
    const ones = popcount(n);
    if (ones >= 6 && ones <= 10) out.push(n);
  }
  return out;
}

// Детерминированное перемешивание: без него жадный отбор идёт по возрастанию,
// выгребает соседей одного угла пространства и упирается заметно раньше.
function shuffled(arr, seed) {
  const a = arr.slice();
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function greedy(pool, count, dist) {
  const chosen = [], taken = [];
  for (const n of pool) {
    const rots = [];
    let b = bitsOf(n);
    for (let r = 0; r < 4; r++) { rots.push(numOf(b)); b = rotate(b); }

    let ok = true;
    for (const t of taken) {
      for (const r of rots) {
        if (popcount(t ^ r) < dist) { ok = false; break; }
      }
      if (!ok) break;
    }
    if (!ok) continue;

    chosen.push(n);
    for (const r of rots) taken.push(r);
    if (chosen.length === count) return chosen;
  }
  return null;
}

// Берём самый строгий разброс, при котором кодов ещё хватает. Порядок попыток
// фиксирован, так что повторный запуск даёт те же метки и уже напечатанные
// листы остаются рабочими.
function pickCodes(count) {
  const pool = candidates();
  for (let dist = 7; dist >= MIN_DIST; dist--) {
    for (let seed = 1; seed <= 24; seed++) {
      const got = greedy(seed === 1 ? pool : shuffled(pool, seed), count, dist);
      if (got) return { codes: got, dist: dist };
    }
  }
  throw new Error('не хватило кодов: нужно ' + count + ' при разбросе от ' + MIN_DIST);
}

// ── развёртки ───────────────────────────────────────────────────────────────
// Все прямоугольники — [x, y, w, h] в миллиметрах листа, y вниз.
const r2 = (v) => Math.round(v * 100) / 100;
const rect = (x, y, w, h) => [r2(x), r2(y), r2(w), r2(h)];

function bboxOf(rects) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]);
    x1 = Math.max(x1, r[0] + r[2]); y1 = Math.max(y1, r[1] + r[3]);
  }
  return rect(x0, y0, x1 - x0, y1 - y0);
}

// Кубик: крест из шести квадратов. В ряду — left, front, right, back; над
// front — top, под ним — bottom. Язычки на семи свободных рёбрах, которые
// при склейке встречаются с чужой гранью. Какая грань куда ложится в 3D,
// знает assets/shape.js — там же и расписано, почему именно так.
function cubeNet(s, tab) {
  const cx = SHEET.w / 2;
  const cy = (SHEET.work.y0 + SHEET.work.y1) / 2;
  const netW = 4 * s + tab, netH = 3 * s + 2 * tab;
  const x0 = cx - netW / 2, y0 = cy - netH / 2 + tab;   // y0 — верх грани top
  const yStrip = y0 + s;
  const faces = {
    left: rect(x0, yStrip, s, s),
    front: rect(x0 + s, yStrip, s, s),
    right: rect(x0 + 2 * s, yStrip, s, s),
    back: rect(x0 + 3 * s, yStrip, s, s),
    top: rect(x0 + s, y0, s, s),
    bottom: rect(x0 + s, yStrip + s, s, s)
  };
  // Язычок — трапеция на ребре: side говорит, с какой стороны грани он растёт.
  const tabs = [
    { face: 'top', side: 'top' }, { face: 'top', side: 'left' }, { face: 'top', side: 'right' },
    { face: 'bottom', side: 'bottom' }, { face: 'bottom', side: 'left' }, { face: 'bottom', side: 'right' },
    { face: 'back', side: 'right' }
  ].map((t) => tabPoly(faces[t.face], t.side, tab));
  // Сгибы — общие рёбра соседних граней и основания язычков.
  const folds = [
    [[x0 + s, yStrip], [x0 + s, yStrip + s]],
    [[x0 + 2 * s, yStrip], [x0 + 2 * s, yStrip + s]],
    [[x0 + 3 * s, yStrip], [x0 + 3 * s, yStrip + s]],
    [[x0 + s, yStrip], [x0 + 2 * s, yStrip]],
    [[x0 + s, yStrip + s], [x0 + 2 * s, yStrip + s]]
  ].concat(tabs.map((t) => [t[0], t[3]]));
  return { faces, tabs, folds };
}

// Трапеция язычка: основание — всё ребро, верх короче на скосы в 1.5 мм.
function tabPoly(f, side, tab) {
  const [x, y, w, h] = f, k = 1.5;
  switch (side) {
    case 'top': return [[x, y], [x + k, y - tab], [x + w - k, y - tab], [x + w, y]];
    case 'bottom': return [[x + w, y + h], [x + w - k, y + h + tab], [x + k, y + h + tab], [x, y + h]];
    case 'left': return [[x, y + h], [x - tab, y + h - k], [x - tab, y + k], [x, y]];
    case 'right': return [[x + w, y], [x + w + tab, y + k], [x + w + tab, y + h - k], [x + w, y + h]];
  }
  throw new Error('нет такой стороны: ' + side);
}

// Планета: одна полоска 2:1 по центру рабочего поля.
function stripNet(w, h) {
  const x = SHEET.w / 2 - w / 2;
  const y = (SHEET.work.y0 + SHEET.work.y1) / 2 - h / 2;
  return { faces: { map: rect(x, y, w, h) }, tabs: [], folds: [] };
}

// Звезда: flat outline — just the bounding box as the "map" face.
function starNet() {
  const pts = 5, outerR = 65, innerR = outerR * 0.42;
  const cx = SHEET.w / 2, cy = (SHEET.work.y0 + SHEET.work.y1) / 2;
  const outline = [];
  for (let i = 0; i < pts * 2; i++) {
    const ang = (i * Math.PI) / pts - Math.PI / 2;
    const rad = i % 2 === 0 ? outerR : innerR;
    outline.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
  }
  const x0 = Math.min(...outline.map(p => p[0]));
  const y0 = Math.min(...outline.map(p => p[1]));
  const x1 = Math.max(...outline.map(p => p[0]));
  const y1 = Math.max(...outline.map(p => p[1]));
  return { faces: { map: rect(x0, y0, x1 - x0, y1 - y0) }, tabs: [], folds: [], outline };
}

function netOf(s) {
  if (s.shape === 'cube') return cubeNet(s.face, s.tab);
  if (s.shape === 'sphere') return stripNet(s.strip[0], s.strip[1]);
  if (s.shape === 'star') return starNet();
  throw new Error('не знаю, как разворачивать ' + s.shape);
}

// ── SVG ─────────────────────────────────────────────────────────────────────
function markerSvg(bits, x, y) {
  const cell = SHEET.marker.size / SHEET.marker.cells;
  let out = `<rect x="${x}" y="${y}" width="${SHEET.marker.size}" height="${SHEET.marker.size}" fill="#000"/>`;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!bits[r * 4 + c]) continue;
      const cx = (x + (c + 1) * cell).toFixed(2);
      const cy = (y + (r + 1) * cell).toFixed(2);
      out += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" fill="#fff"/>`;
    }
  }
  return out;
}

const pt = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
const poly = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + pt(p)).join(' ') + ' Z';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');


function buildSvg(fish, net) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}mm" height="${SHEET.h}mm" viewBox="0 0 ${SHEET.w} ${SHEET.h}">`,
    `  <rect width="${SHEET.w}" height="${SHEET.h}" fill="#fff"/>`
  ];
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const pos = SHEET.markerPositions[corner];
    parts.push('  ' + markerSvg(fish.markers[corner], pos[0], pos[1]));
  }

  // Контур разреза: объединение граней и язычков. Рисуем каждый кусок
  // отдельно, а общие рёбра перекрываем пунктиром сгиба сверху — так линия
  // реза остаётся сплошной только там, где действительно режут.
  const pieces = Object.values(net.faces).map(([x, y, w, h]) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]])
    .concat(net.tabs);
  for (const p of pieces) {
    parts.push(`  <path d="${poly(p)}" fill="#fff" stroke="${CUT.color}" stroke-width="${CUT.width}" stroke-linejoin="round"/>`);
  }
  // Внутренние рёбра — сгибы: поверх сплошной кладём белую, потом пунктир.
  for (const [a, b] of net.folds) {
    parts.push(`  <path d="M${pt(a)} L${pt(b)}" stroke="#fff" stroke-width="${(CUT.width + 0.3).toFixed(2)}"/>`);
    parts.push(`  <path d="M${pt(a)} L${pt(b)}" stroke="${FOLD.color}" stroke-width="${FOLD.width}" stroke-dasharray="${FOLD.dash}" stroke-linecap="round"/>`);
  }
  for (const t of net.tabs) {
    const cx = (t[0][0] + t[1][0] + t[2][0] + t[3][0]) / 4;
    const cy = (t[0][1] + t[1][1] + t[2][1] + t[3][1]) / 4;
    const vertical = Math.abs(t[1][0] - t[0][0]) < Math.abs(t[1][1] - t[0][1]);
    parts.push(`  <text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" text-anchor="middle" dominant-baseline="central" ` +
      `font-family="Segoe UI, sans-serif" font-size="2.6" fill="${FOLD.color}"` +
      (vertical ? ` transform="rotate(-90 ${cx.toFixed(2)} ${cy.toFixed(2)})"` : '') + `>клей</text>`);
  }

  if (fish.shape === 'sphere') {
    const m = net.faces.map;
    parts.push(`  <path d="M${(m[0] + 2).toFixed(2)} ${(m[1] + m[3] / 2).toFixed(2)} L${(m[0] + m[2] - 2).toFixed(2)} ${(m[1] + m[3] / 2).toFixed(2)}" ` +
      `stroke="${HINT.color}" stroke-width="${FOLD.width}" stroke-dasharray="${FOLD.dash}"/>`);
  }
  if (net.outline) {
    parts.push(`  <path d="${poly(net.outline)}" fill="#fff" stroke="${CUT.color}" stroke-width="${CUT.width}" stroke-linejoin="round"/>`);
  }

  parts.push(
    `  <text x="${SHEET.w / 2}" y="21" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="4.2" fill="#666">${esc(fish.hint)}</text>`,
    `  <text x="${SHEET.w / 2}" y="197" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="7" font-weight="600" fill="#444">${esc(fish.title)}</text>`,
    '</svg>'
  );
  return parts.join('\n') + '\n';
}

// ── сборка ──────────────────────────────────────────────────────────────────
function main() {
  const picked = pickCodes(SPECIES.length * 4);
  const codes = picked.codes;
  const fish = SPECIES.map((s, i) => {
    const net = netOf(s);
    const faces = net.faces;
    const f = {
      id: i + 1,
      name: s.name,
      title: s.title,
      shape: s.shape,
      svg: 'assets/coloring/' + sheetFile(s.name),
      size: s.size,
      markers: {
        tl: bitsOf(codes[i * 4]),
        tr: bitsOf(codes[i * 4 + 1]),
        bl: bitsOf(codes[i * 4 + 2]),
        br: bitsOf(codes[i * 4 + 3])
      },
      // Что с листа уходит в текстуру: crop — общий габарит граней (мм),
      // faces — грани внутри него, trim — на сколько мм отступать от края
      // грани, чтобы в текстуру не попали печатные линии.
      crop: bboxOf(Object.values(faces)),
      faces: faces,
      trim: TRIM_MM,
      hint: s.hint
    };
    f._net = net;
    return f;
  });

  fs.mkdirSync(OUT, { recursive: true });
  // старые листы убираем: виды могли переименоваться или уйти
  for (const old of fs.readdirSync(OUT)) {
    if (old.endsWith('.svg')) fs.unlinkSync(path.join(OUT, old));
  }

  for (const f of fish) {
    fs.writeFileSync(path.join(OUT, sheetFile(f.name)), buildSvg(f, f._net), 'utf8');
    delete f._net;
  }
  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ version: 3, sheet: SHEET, fish: fish }, null, 1),
    'utf8'
  );

  // Контроль: если два кода вдруг сойдутся, вид подменится молча — лучше
  // увидеть цифру сейчас, чем ловить это на детском рисунке.
  let worst = 99;
  const all = [];
  fish.forEach((f) => ['tl', 'tr', 'bl', 'br'].forEach((c) => {
    let b = f.markers[c];
    for (let r = 0; r < 4; r++) { all.push({ n: numOf(b), key: f.name + '/' + c }); b = rotate(b); }
  }));
  for (let a = 0; a < all.length; a++) {
    for (let b = a + 1; b < all.length; b++) {
      if (all[a].key === all[b].key) continue;
      worst = Math.min(worst, popcount(all[a].n ^ all[b].n));
    }
  }

  console.log('листов: ' + fish.length);
  console.log('минимальное различие кодов: ' + worst + ' клеток из 16');
  fish.forEach((f) => console.log(
    '  ' + f.name.padEnd(12) + f.title.padEnd(12) + f.shape.padEnd(8) +
    'текстура ' + f.crop[2] + '×' + f.crop[3] + ' мм'
  ));
}

main();
