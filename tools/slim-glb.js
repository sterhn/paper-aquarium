/* Облегчает GLB: выкидывает карту metallicRoughness и всё, что после этого
 * ни на что не ссылается.
 *
 *   node tools/slim-glb.js <вход.glb> <выход.glb>
 *
 * Зачем. Робот (assets/models/pack/robot/textured_mesh.glb) пришёл из
 * генератора с картой металла 2048×2048 в PNG — это 2.3 МБ из 3.8. Сцена её
 * не использует: робот красится цветом без металла, иначе без карты
 * окружения он выходит тёмным. Без неё модель грузится в два с половиной
 * раза быстрее — заметно на телефоне, который открывает аквариум.
 *
 * Исходник лежит в истории git (коммит 02035d6), повторить можно в любой момент.
 */
'use strict';

const fs = require('fs');

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
  return { json, bin };
}

function writeGlb(file, json, bin) {
  const pad = (b, fill) => {
    const extra = (4 - (b.length % 4)) % 4;
    return extra ? Buffer.concat([b, Buffer.alloc(extra, fill)]) : b;
  };
  const jsonBuf = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const binBuf = pad(bin, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8);
  const chunk = (type, body) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(body.length, 0);
    h.writeUInt32LE(type, 4);
    return Buffer.concat([h, body]);
  };
  fs.writeFileSync(file, Buffer.concat([header, chunk(0x4e4f534a, jsonBuf), chunk(0x004e4942, binBuf)]));
}

function main() {
  const [src, dst] = process.argv.slice(2);
  if (!src || !dst) throw new Error('использование: node tools/slim-glb.js вход.glb выход.glb');
  const { json, bin } = readGlb(src);

  // Материалы: без карты металла и без металла вообще.
  for (const m of json.materials || []) {
    const pbr = m.pbrMetallicRoughness || {};
    delete pbr.metallicRoughnessTexture;
    pbr.metallicFactor = 0;
    pbr.roughnessFactor = 0.6;
    m.pbrMetallicRoughness = pbr;
  }

  // Какие текстуры ещё нужны — собираем по всем ссылкам вида {index: N}.
  const usedTex = new Set();
  (function scan(o) {
    if (!o || typeof o !== 'object') return;
    if (typeof o.index === 'number' && ('texCoord' in o || Object.keys(o).length <= 3)) usedTex.add(o.index);
    for (const k of Object.keys(o)) scan(o[k]);
  })(json.materials);

  const texMap = new Map(), newTex = [];
  (json.textures || []).forEach((t, i) => {
    if (!usedTex.has(i)) return;
    texMap.set(i, newTex.length);
    newTex.push(t);
  });
  (function remap(o) {
    if (!o || typeof o !== 'object') return;
    if (typeof o.index === 'number' && texMap.has(o.index)) o.index = texMap.get(o.index);
    for (const k of Object.keys(o)) remap(o[k]);
  })(json.materials);
  json.textures = newTex;

  const usedImg = new Set(newTex.map((t) => t.source));
  const imgMap = new Map(), newImg = [];
  (json.images || []).forEach((im, i) => {
    if (!usedImg.has(i)) return;
    imgMap.set(i, newImg.length);
    newImg.push(im);
  });
  newTex.forEach((t) => { t.source = imgMap.get(t.source); });
  json.images = newImg;

  // Буферные виды: оставляем те, на которые ссылаются аксессоры и картинки,
  // и складываем их в новый BIN подряд.
  const usedBv = new Set();
  (json.accessors || []).forEach((a) => { if (a.bufferView !== undefined) usedBv.add(a.bufferView); });
  newImg.forEach((im) => { if (im.bufferView !== undefined) usedBv.add(im.bufferView); });
  const bvMap = new Map(), newBv = [], parts = [];
  let offset = 0;
  json.bufferViews.forEach((bv, i) => {
    if (!usedBv.has(i)) return;
    const data = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const padLen = (4 - (offset % 4)) % 4;
    if (padLen) { parts.push(Buffer.alloc(padLen)); offset += padLen; }
    bvMap.set(i, newBv.length);
    newBv.push(Object.assign({}, bv, { byteOffset: offset }));
    parts.push(data);
    offset += data.length;
  });
  (json.accessors || []).forEach((a) => { if (a.bufferView !== undefined) a.bufferView = bvMap.get(a.bufferView); });
  newImg.forEach((im) => { if (im.bufferView !== undefined) im.bufferView = bvMap.get(im.bufferView); });
  json.bufferViews = newBv;
  const newBin = Buffer.concat(parts);
  json.buffers = [{ byteLength: newBin.length }];

  writeGlb(dst, json, newBin);
  console.log(`${src} → ${dst}: ${(fs.statSync(src).size / 1048576).toFixed(2)} → ` +
    `${(fs.statSync(dst).size / 1048576).toFixed(2)} МБ`);
}

main();
