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
     против нормали, тем больше, чем сильнее треугольник смотрит вбок;
   · лицо ребёнок рисует сам — на листе экран обведён контуром;
   · скелета у модели нет, движение (руки, ноги, антенна, голова) задаёт
     вершинный шейдер — см. RIG.

   Оси — как в glTF: +Y вверх, +Z к зрителю (лицо), +X вправо от зрителя.

   API (window.Robot):
     .load(cb)               → cb(ok); модель грузится один раз
     .ready / .failed        → загружена ли / не загрузилась насовсем
     .bake(fish, opts)       → BufferGeometry раскрашенного робота ростом
                               fish.size; opts.legacy — текстура старого
                               образца (только перёд, кадр по габариту модели).
     .materials(geo, mat)    → mat с движением (см. RIG)
     .uTime                  → { value } — время анимации, сцена обновляет его
                               каждый кадр
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
    // Обратный путь для анимации (RIG): исходные оси = подогнанные / k + центр.
    geo.userData.robotFit = [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2, k];
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

  // ── движение ────────────────────────────────────────────────────────────
  // Скелета у модели нет — она одна цельная оболочка, — поэтому шевелит её
  // вершинный шейдер. Часть тела вершина узнаёт по тому, где стоит (оси
  // модели, вид спереди: tools/robot-face.html), и поворачивается вокруг
  // своего сустава. Веса плавные — сустав гнётся, а не рвётся.
  //   ноги  — ниже таза (Y < −0.56) и ближе к середине, чем |X| 0.35;
  //           внизу кисти висят дальше |X| 0.40, так их и различаем;
  //   руки  — от плеча вниз, снаружи туловища (|X| > 0.28, у кистей > 0.37);
  //   антенна — выше Y 0.70;  голова — выше шеи (Y > −0.1).
  // Руки и ноги машут навстречу друг другу, как при ходьбе, антенна
  // пружинит, голова чуть покачивается. Фаза у каждого робота своя.
  var uTime = { value: 0 };
  var RIG = [
    'uniform float uRobotTime;',
    'uniform float uRobotPhase;',
    'uniform vec4 uRobotFit;',
    'mat3 robotRotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }',
    'mat3 robotRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }',
    'void robotBend(inout vec3 p, inout vec3 n, mat3 R, vec3 pivot, float w) {',
    '  p = mix(p, pivot + R * (p - pivot), w);',
    '  n = mix(n, R * n, w);',
    '}',
    'void robotRig(inout vec3 p, inout vec3 n) {',
    '  vec3 q = p / uRobotFit.w + uRobotFit.xyz;',
    '  vec3 r = q;',
    '  float t = uRobotTime * 4.0 + uRobotPhase;',
    '  float ax = abs(q.x);',
    '  float side = q.x < 0.0 ? -1.0 : 1.0;',
    '  float legW = (1.0 - smoothstep(-0.66, -0.56, q.y)) * (1.0 - smoothstep(0.345, 0.37, ax));',
    '  robotBend(r, n, robotRotX(0.32 * sin(t) * side), vec3(0.18 * side, -0.60, 0.03), legW);',
    '  float xa = mix(0.28, 0.37, 1.0 - smoothstep(-0.62, -0.50, q.y));',
    '  float armW = smoothstep(xa - 0.015, xa + 0.015, ax) * (1.0 - smoothstep(-0.17, -0.12, q.y));',
    '  mat3 arm = robotRotX(-0.38 * sin(t) * side) * robotRotZ(0.10 * side * (0.5 + 0.5 * sin(t * 2.0)));',
    '  robotBend(r, n, arm, vec3(0.30 * side, -0.22, 0.02), armW);',
    '  robotBend(r, n, robotRotZ(0.22 * sin(t * 1.7)), vec3(-0.10, 0.72, 0.0), smoothstep(0.70, 0.78, q.y));',
    '  mat3 head = robotRotZ(0.07 * sin(t * 0.5)) * robotRotX(0.05 * sin(t));',
    '  robotBend(r, n, head, vec3(0.0, -0.10, 0.0), smoothstep(-0.16, -0.08, q.y));',
    '  p = (r - uRobotFit.xyz) * uRobotFit.w;',
    '}'
  ].join('\n');

  // Материалу робота — движение.
  function patch(mat, geo) {
    var fit = geo.userData.robotFit;
    if (!fit) return mat;
    var phase = Math.random() * Math.PI * 2;
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uRobotTime = uTime;
      sh.uniforms.uRobotPhase = { value: phase };
      sh.uniforms.uRobotFit = { value: new THREE.Vector4(fit[0], fit[1], fit[2], fit[3]) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + RIG)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 robotP = position;\nrobotRig(robotP, objectNormal);')
        .replace('#include <begin_vertex>', 'vec3 transformed = robotP;');
    };
    mat.customProgramCacheKey = function () { return 'robot-rig'; };
    mat.needsUpdate = true;
    return mat;
  }

  // Материал для геометрии из bake(): раскраске — то же движение.
  function materials(geo, painted) {
    return patch(painted, geo);
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
    patch(mat, geo);
    var mesh = new THREE.Mesh(geo, mat);
    var group = new THREE.Group();
    group.add(mesh);
    return { group: group, mesh: mesh, mat: mat, mixer: null };
  }

  var Robot = {
    URL: URL,
    uTime: uTime,      // секунды анимации: сцена ставит каждый кадр
    ready: false,
    failed: false,
    load: load,
    bake: bake,
    materials: materials,
    spawn: spawn,
    isLegacyTexture: isLegacyTexture
  };
  window.Robot = Robot;
})();
