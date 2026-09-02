/* Силуэт робота с ЛИЦА — для листов раскраски и экрана рисования.
 *
 *   node tools/robot-front-contour.js
 *
 * Рыбу ребёнок раскрашивает сбоку: она плоская, и боковая проекция ложится
 * на модель без потерь. У робота сбоку нет ни лица, ни рук, ни груди —
 * всё, что он хочет нарисовать, смотрит вперёд. Поэтому робот на листе и на
 * экране стоит лицом к зрителю, и той же плоскостью текстура ложится на
 * модель (см. FishGLB.bake({uv: 'front'}) и capture.html).
 *
 * Оси — как в glTF: +Y вверх, +Z к зрителю, +X вправо от зрителя.
 * Контур считаем в единицах модели: горизонталь = X, вертикаль = Y.
 *
 * На выходе правим на месте:
 *   · assets/coloring/manifest.json — contourModel, bboxModel, sheetTransform,
 *     view: 'front' у каждого вида, чья модель — этот робот;
 *   · assets/coloring/<вид>[.lang].svg — путь силуэта.
 * Метки, коды и подписи не трогаем: напечатанные листы остаются валидными.
 * После этого — node tools/make-pdf.js, иначе PDF отстанут от SVG.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'assets', 'coloring', 'manifest.json');
const MODEL = path.join(ROOT, 'assets', 'models', 'pack', 'robot', 'textured_mesh.glb');
const MODEL_URL = '/assets/models/pack/robot/textured_mesh.glb';

const SIZE = 1024;   // растр силуэта, px
const PAD = 24;
const FIT = 0.94;    // доля рабочего поля листа под габарит (как в make-coloring.js)
const SIMPLIFY_PX = 2.2;   // Дуглас–Пекер: допуск в пикселях растра

// ── GLB без Draco: позиции и индексы каждого примитива ──────────────────────
function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('не GLB: ' + file);
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  function accessor(i) {
    const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
    const T = CT[a.componentType], n = N[a.type];
    const start = bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0);
    const stride = bv.byteStride || n * T.BYTES_PER_ELEMENT;
    const out = new Float64Array(a.count * n);
    for (let k = 0; k < a.count; k++) {
      const view = new T(bin.buffer, start + k * stride, n);
      for (let c = 0; c < n; c++) out[k * n + c] = view[c];
    }
    return out;
  }
  // матрицы узлов: у робота они единичные, но считаем честно
  const world = new Map();
  function mat4mul(a, b) {
    const o = new Array(16).fill(0);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return o;
  }
  function nodeLocal(nd) {
    if (nd.matrix) return nd.matrix;
    const t = nd.translation || [0, 0, 0], q = nd.rotation || [0, 0, 0, 1], s = nd.scale || [1, 1, 1];
    const [x, y, z, w] = q;
    const m = [
      (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0], (2 * (x * z - y * w)) * s[0], 0,
      (2 * (x * y - z * w)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1], 0,
      (2 * (x * z + y * w)) * s[2], (2 * (y * z - x * w)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
      t[0], t[1], t[2], 1
    ];
    return m;
  }
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function walk(i, parent) {
    const nd = json.nodes[i];
    const m = mat4mul(parent, nodeLocal(nd));
    world.set(i, m);
    (nd.children || []).forEach((c) => walk(c, m));
  }
  const scene = json.scenes[json.scene || 0];
  scene.nodes.forEach((i) => walk(i, I));

  const tris = [];   // [x,y,z] × 3 подряд
  json.nodes.forEach((nd, i) => {
    if (nd.mesh === undefined) return;
    const m = world.get(i) || I;
    json.meshes[nd.mesh].primitives.forEach((pr) => {
      if (pr.mode !== undefined && pr.mode !== 4) return;
      const pos = accessor(pr.attributes.POSITION);
      const idx = pr.indices !== undefined ? accessor(pr.indices) : null;
      const count = idx ? idx.length : pos.length / 3;
      for (let k = 0; k < count; k++) {
        const v = idx ? idx[k] : k;
        const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
        tris.push(
          m[0] * x + m[4] * y + m[8] * z + m[12],
          m[1] * x + m[5] * y + m[9] * z + m[13],
          m[2] * x + m[6] * y + m[10] * z + m[14]
        );
      }
    });
  });
  return { tris, json };
}

// ── растр: проекция на XY (взгляд с +Z) ─────────────────────────────────────
function rasterize(tris) {
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (let i = 0; i < tris.length; i += 3) {
    const x = tris[i], y = tris[i + 1];
    if (x < box.minX) box.minX = x; if (x > box.maxX) box.maxX = x;
    if (y < box.minY) box.minY = y; if (y > box.maxY) box.maxY = y;
  }
  const spanX = box.maxX - box.minX, spanY = box.maxY - box.minY;
  const scale = (SIZE - PAD * 2) / Math.max(spanX, spanY);
  const px = (x) => PAD + (x - box.minX) * scale;
  const py = (y) => PAD + (box.maxY - y) * scale;

  const mask = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < tris.length; i += 9) {
    const ax = px(tris[i]), ay = py(tris[i + 1]);
    const bx = px(tris[i + 3]), by = py(tris[i + 4]);
    const cx = px(tris[i + 6]), cy = py(tris[i + 7]);
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(SIZE - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = minY; y <= maxY; y++) {
      const yc = y + 0.5;
      // пересечения строки с рёбрами
      let xs = [];
      const edges = [[ax, ay, bx, by], [bx, by, cx, cy], [cx, cy, ax, ay]];
      for (const [x0, y0, x1, y1] of edges) {
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) {
          xs.push(x0 + (yc - y0) / (y1 - y0) * (x1 - x0));
        }
      }
      if (xs.length < 2) continue;
      xs.sort((a, b) => a - b);
      const x0 = Math.max(0, Math.round(xs[0] - 0.5)), x1 = Math.min(SIZE - 1, Math.round(xs[xs.length - 1] + 0.5));
      for (let x = x0; x <= x1; x++) mask[y * SIZE + x] = 1;
    }
  }
  return { mask, box, scale, px, py };
}

function morph(mask, grow, shrink) {
  function pass(m, want) {
    const out = new Uint8Array(m);
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        const i = y * SIZE + x;
        if (m[i] === want) continue;
        if (m[i - SIZE] === want || m[i + SIZE] === want || m[i - 1] === want || m[i + 1] === want ||
            m[i - SIZE - 1] === want || m[i - SIZE + 1] === want || m[i + SIZE - 1] === want || m[i + SIZE + 1] === want) out[i] = want;
      }
    }
    return out;
  }
  for (let n = 0; n < grow; n++) mask = pass(mask, 1);
  for (let n = 0; n < shrink; n++) mask = pass(mask, 0);
  return mask;
}

function largestComponent(mask) {
  const labels = new Int32Array(SIZE * SIZE);
  let next = 1, best = 0, bestCount = 0;
  const stack = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (!mask[i] || labels[i]) continue;
    let count = 0;
    stack.length = 0; stack.push(i); labels[i] = next;
    while (stack.length) {
      const p = stack.pop(); count++;
      const x = p % SIZE, y = (p / SIZE) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        const q = ny * SIZE + nx;
        if (mask[q] && !labels[q]) { labels[q] = next; stack.push(q); }
      }
    }
    if (count > bestCount) { bestCount = count; best = next; }
    next++;
  }
  const out = new Uint8Array(SIZE * SIZE);
  for (let j = 0; j < SIZE * SIZE; j++) out[j] = labels[j] === best ? 1 : 0;
  return out;
}

function fillHoles(mask) {
  // всё, что не достижимо снаружи, — внутри силуэта (щели между рукой и телом
  // на листе не нужны: ребёнок красит робота одним пятном)
  const outside = new Uint8Array(SIZE * SIZE);
  const stack = [0];
  outside[0] = 1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % SIZE, y = (p / SIZE) | 0;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of nb) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      const q = ny * SIZE + nx;
      if (!mask[q] && !outside[q]) { outside[q] = 1; stack.push(q); }
    }
  }
  const out = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < out.length; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

function traceBoundary(mask) {
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  let sx = -1, sy = -1;
  outer:
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++)
    if (mask[y * SIZE + x]) { sx = x; sy = y; break outer; }
  if (sx < 0) return [];
  const pts = [];
  let cx = sx, cy = sy, dir = 7;
  do {
    pts.push([cx, cy]);
    let found = false;
    for (let i = 0; i < 8; i++) {
      const d = (dir + 6 + i) % 8;
      const nx = cx + dirs[d][0], ny = cy + dirs[d][1];
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && mask[ny * SIZE + nx]) {
        cx = nx; cy = ny; dir = d; found = true; break;
      }
    }
    if (!found) break;
  } while ((cx !== sx || cy !== sy) && pts.length < SIZE * SIZE);
  return pts;
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = pts[a][0], ay = pts[a][1];
    const dx = pts[b][0] - ax, dy = pts[b][1] - ay;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    let maxD = 0, maxI = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > eps) { keep[maxI] = 1; stack.push([a, maxI], [maxI, b]); }
  }
  return pts.filter((_, j) => keep[j]);
}

function sheetTransform(sheet, spanH, spanV) {
  const workW = sheet.work.x1 - sheet.work.x0;
  const workH = sheet.work.y1 - sheet.work.y0;
  return {
    scale: +(FIT * Math.min(workW / spanH, workH / spanV)).toFixed(4),
    ox: sheet.w / 2,
    oy: (sheet.work.y0 + sheet.work.y1) / 2
  };
}

function main() {
  const { tris } = readGlb(MODEL);
  const r = rasterize(tris);
  let mask = morph(r.mask, 2, 2);
  mask = largestComponent(mask);
  mask = fillHoles(mask);
  const boundary = traceBoundary(mask);
  const simple = rdp(boundary, SIMPLIFY_PX);
  // пиксели → единицы модели: горизонталь X (вправо), вертикаль Y (вверх)
  const contour = simple.map(([x, y]) => [
    +(r.box.minX + (x - PAD) / r.scale).toFixed(4),
    +(r.box.maxY - (y - PAD) / r.scale).toFixed(4)
  ]);
  const bbox = {
    // ключи как у рыб: z — горизонталь листа, y — вертикаль. У робота
    // (view: 'front') горизонталь — это X модели, см. шапку файла.
    z: [+r.box.minX.toFixed(4), +r.box.maxX.toFixed(4)],
    y: [+r.box.minY.toFixed(4), +r.box.maxY.toFixed(4)]
  };
  console.log(`контур: ${boundary.length} px → ${contour.length} точек; габарит ` +
    `${(bbox.z[1] - bbox.z[0]).toFixed(3)} × ${(bbox.y[1] - bbox.y[0]).toFixed(3)}`);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const st = sheetTransform(manifest.sheet, bbox.z[1] - bbox.z[0], bbox.y[1] - bbox.y[0]);
  const d = contour.map(([h, v], i) =>
    (i ? 'L' : 'M') + (st.ox + st.scale * h).toFixed(2) + ' ' + (st.oy - st.scale * v).toFixed(2)
  ).join(' ') + ' Z';

  let patched = 0, svgs = 0;
  manifest.fish.forEach((f) => {
    if (f.model !== MODEL_URL) return;
    f.view = 'front';
    f.contourModel = contour;
    f.bboxModel = bbox;
    f.sheetTransform = st;
    delete f.eye;   // глаз рыбы: у робота лицо уже на модели
    patched++;
    const files = new Set([f.svg].concat(Object.values(f.sheets || {})));
    files.forEach((rel) => {
      const file = path.join(ROOT, rel);
      if (!fs.existsSync(file)) return;
      const src = fs.readFileSync(file, 'utf8');
      const out = src.replace(/<path d="[^"]*"( fill="#fff" stroke=)/, '<path d="' + d + '"$1');
      if (out === src) { console.warn('в ' + rel + ' не нашёл контур'); return; }
      fs.writeFileSync(file, out);
      svgs++;
    });
  });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
  console.log(`manifest: ${patched} видов; svg: ${svgs} файлов`);
}

main();
