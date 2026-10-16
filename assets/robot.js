/* Робот — единственная фигура из настоящей 3D-модели
   (assets/models/pack/robot/textured_mesh.glb).

   Модель сгенерирована нейросетью: её собственная UV — лоскутное одеяло
   из сотен кусочков, и детский рисунок по ней не положить. Поэтому
   раскрашенному роботу UV считается заново — проекцией с листа:

   · на листе робот нарисован дважды: спереди и сзади (make-coloring.js);
   · каждый треугольник модели смотрит либо вперёд, либо назад — и берёт
     цвет с той половины листа, куда смотрит. Раньше перёд просвечивал
     насквозь, и на затылке оказывалось зеркальное лицо;
   · бока проецируются в линию — край силуэта, и тянулись полосами.
     Теперь точка на боку берёт цвет чуть внутри силуэта (INSET): сдвиг
     против нормали, тем больше, чем сильнее треугольник смотрит вбок.

   Оси — как в glTF: +Y вверх, +Z к зрителю (лицо), +X вправо от зрителя.

   API (window.Robot):
     .load(cb)               → cb(ok); модель грузится один раз
     .ready / .failed        → загружена ли / не загрузилась насовсем
     .bake(fish, opts)       → BufferGeometry раскрашенного робота ростом
                               fish.size; opts.legacy — текстура старого
                               образца (только перёд, кадр по габариту модели)
     .spawn(size, tex)       → { group, mesh, mat, mixer:null } — с родной
                               текстурой модели, если tex не передан
     .isLegacyTexture(image) → текстура старого образца? (портретная)

   Нужны THREE и THREE.GLTFLoader. */
(function () {
  'use strict';

  var URL = '/assets/models/pack/robot/textured_mesh.glb';
  // Насколько вглубь силуэта уходит точка, смотрящая точно вбок, — в
  // единицах модели (рост робота ≈ 2). Около трёх миллиметров на листе:
  // больше полосы печатной обводки, меньше руки.
  var INSET = 0.05;

  var st = {
    ready: false, failed: false, loading: false, waiting: [],
    geo: null,      // исходная геометрия в осях модели
    box: null,
    map: null,      // родная текстура модели
    baked: {},      // кэш раскрасочных геометрий
    plain: {}       // кэш геометрий с родной UV, по росту
  };

  function done(ok) {
    st.loading = false;
    st.ready = ok;
    st.failed = !ok;
    Robot.ready = ok;
    Robot.failed = !ok;
    var w = st.waiting;
    st.waiting = [];
    w.forEach(function (cb) { try { cb(ok); } catch (e) { console.error(e); } });
  }

  function load(cb) {
    if (st.ready || st.failed) { if (cb) cb(st.ready); return; }
    if (cb) st.waiting.push(cb);
    if (st.loading) return;
    st.loading = true;
    if (!window.THREE || !THREE.GLTFLoader) {
      console.error('robot.js: нужен THREE.GLTFLoader');
      return done(false);
    }
    new THREE.GLTFLoader().load(URL, function (gltf) {
      var mesh = null;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(function (o) { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) { console.error('robot.js: в модели нет меша'); return done(false); }
      var geo = mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.computeBoundingBox();
      st.geo = geo;
      st.box = geo.boundingBox.clone();
      st.map = (mesh.material && mesh.material.map) || null;
      if (st.map) st.map.encoding = THREE.sRGBEncoding;
      done(true);
    }, undefined, function (err) {
      console.error('robot.js: модель не загрузилась', err);
      done(false);
    });
  }

  // Центр — в ноль, рост — size. Применяется к копии уже с нужной UV.
  function fit(geo, size) {
    var b = st.box;
    var k = size / Math.max(b.max.y - b.min.y, 1e-6);
    geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
    geo.scale(k, k, k);
    geo.computeBoundingSphere();
    return geo;
  }

  // Текстура до роботов-с-двух-сторон резалась по габариту одного силуэта
  // и потому выходила портретной; нынешняя — два силуэта рядом, альбомная.
  function isLegacyTexture(image) {
    return !!(image && image.height > image.width);
  }

  function bake(fish, opts) {
    var legacy = !!(opts && opts.legacy) || !fish.projection;
    var size = fish.size || 1.8;
    var key = (legacy ? 'legacy:' : 'sheet:') + fish.name + ':' + size;
    if (st.baked[key]) return st.baked[key];

    // Треугольники — каждый сам по себе: вершина на шве между передом и
    // спиной иначе тянула бы UV через полтекстуры.
    var geo = st.geo.index ? st.geo.toNonIndexed() : st.geo.clone();
    var pos = geo.attributes.position, nor = geo.attributes.normal;
    var n = pos.count;
    var uv = new Float32Array(n * 2);
    var b = st.box;
    var spanX = Math.max(b.max.x - b.min.x, 1e-6), spanY = Math.max(b.max.y - b.min.y, 1e-6);
    var P = fish.projection, crop = fish.crop;

    for (var t = 0; t < n; t += 3) {
      // Куда смотрит треугольник: z его нормали (по порядку вершин).
      var ax = pos.getX(t), ay = pos.getY(t);
      var bx = pos.getX(t + 1) - ax, by = pos.getY(t + 1) - ay;
      var cx = pos.getX(t + 2) - ax, cy = pos.getY(t + 2) - ay;
      var front = bx * cy - by * cx >= 0;

      for (var k = 0; k < 3; k++) {
        var i = t + k;
        var nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
        var d = INSET * (1 - Math.min(1, Math.abs(nz)));
        var X = pos.getX(i) - nx * d;
        var Y = pos.getY(i) - ny * d;
        var u, v;
        if (legacy) {
          u = (X - b.min.x) / spanX;
          v = (Y - b.min.y) / spanY;
        } else {
          // Та же раскладка, что на листе (make-coloring.js, robotNet):
          // спина — зеркально, как её видно, если обойти робота.
          var sx = front ? P.front + P.scale * X : P.back - P.scale * X;
          var sy = P.oy - P.scale * Y;
          u = (sx - crop[0]) / crop[2];
          v = 1 - (sy - crop[1]) / crop[3];
        }
        uv[i * 2] = u;
        uv[i * 2 + 1] = v;
      }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    st.baked[key] = fit(geo, size);
    return st.baked[key];
  }

  function plainGeometry(size) {
    var key = String(size);
    if (!st.plain[key]) st.plain[key] = fit(st.geo.clone(), size);
    return st.plain[key];
  }

  function spawn(size, tex) {
    var mat, geo;
    if (tex) {
      tex.encoding = THREE.sRGBEncoding;
      geo = bake({ name: 'robot', size: size }, { legacy: true });
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.05 });
    } else {
      geo = plainGeometry(size);
      // Металл выключен: без карты окружения металлический робот выходит
      // почти чёрным. Родная текстура и так даёт белый пластик и экран.
      mat = new THREE.MeshStandardMaterial({ map: st.map, roughness: 0.55, metalness: 0 });
    }
    var mesh = new THREE.Mesh(geo, mat);
    var group = new THREE.Group();
    group.add(mesh);
    return { group: group, mesh: mesh, mat: mat, mixer: null };
  }

  var Robot = {
    URL: URL,
    ready: false,
    failed: false,
    load: load,
    bake: bake,
    spawn: spawn,
    isLegacyTexture: isLegacyTexture
  };
  window.Robot = Robot;
})();
