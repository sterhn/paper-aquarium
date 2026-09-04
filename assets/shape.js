/* Процедурные фигуры: кубик и планета (сфера).
   Заменяет fish-glb.js + fish-frame.js + fish-thumbs.js — GLB больше нет,
   геометрия строится прямо в THREE.js с UV, привязанными к развёртке на листе.

   API (window.Shape):
     .cube(size, faceUVs)       → BufferGeometry с 6 гранями и UV по развёртке
     .planet(size, stripUV)     → BufferGeometry сферы с equirect UV
     .defaultTexture(shape)     → CanvasTexture с кавайной мордочкой
     .spawn(shape, size, tex)   → { group, mixer:null }
     .thumbnail(shape, cb)      → cb(dataURL)

   faceUVs: {left,front,right,back,top,bottom} — каждая [u0,v0,u1,v1] в 0..1
   stripUV: {map: [u0,v0,u1,v1]}

   Нужен THREE (r128+). */
(function () {
  'use strict';

  // ── кубик ──────────────────────────────────────────────────────────────────
  // 6 граней, каждая — свой участок текстуры из развёртки-креста.
  // Порядок вершин: CCW снаружи.
  var CUBE_FACES = {
    right:  { normal: [ 1, 0, 0], corners: [[ 1,-1, 1],[ 1, 1, 1],[ 1, 1,-1],[ 1,-1,-1]] },
    left:   { normal: [-1, 0, 0], corners: [[-1,-1,-1],[-1, 1,-1],[-1, 1, 1],[-1,-1, 1]] },
    top:    { normal: [ 0, 1, 0], corners: [[-1, 1,-1],[ 1, 1,-1],[ 1, 1, 1],[-1, 1, 1]] },
    bottom: { normal: [ 0,-1, 0], corners: [[-1,-1, 1],[ 1,-1, 1],[ 1,-1,-1],[-1,-1,-1]] },
    front:  { normal: [ 0, 0, 1], corners: [[-1,-1, 1],[-1, 1, 1],[ 1, 1, 1],[ 1,-1, 1]] },
    back:   { normal: [ 0, 0,-1], corners: [[ 1,-1,-1],[ 1, 1,-1],[-1, 1,-1],[-1,-1,-1]] }
  };

  function cubeGeo(size, faceUVs) {
    var half = size / 2;
    var positions = [], normals = [], uvs = [], indices = [];
    var vi = 0;
    var names = ['left', 'front', 'right', 'back', 'top', 'bottom'];
    for (var fi = 0; fi < names.length; fi++) {
      var name = names[fi];
      var face = CUBE_FACES[name];
      var uv = faceUVs[name] || [0, 0, 1, 1];
      var u0 = uv[0], v0 = uv[1], u1 = uv[2], v1 = uv[3];
      var uvCorners = [[u0, v0], [u0, v1], [u1, v1], [u1, v0]];

      for (var ci = 0; ci < 4; ci++) {
        var c = face.corners[ci];
        positions.push(c[0] * half, c[1] * half, c[2] * half);
        normals.push(face.normal[0], face.normal[1], face.normal[2]);
        uvs.push(uvCorners[ci][0], uvCorners[ci][1]);
      }
      indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  // ── планета (сфера) ────────────────────────────────────────────────────────
  // Equirectangular UV: полоска с листа оборачивается вокруг сферы.
  function planetGeo(size, stripUV) {
    var seg = 32;
    var radius = size / 2;
    var uv = (stripUV && stripUV.map) || [0, 0, 1, 1];
    var u0 = uv[0], v0 = uv[1], u1 = uv[2], v1 = uv[3];

    var positions = [], normals = [], uvs = [], indices = [];
    for (var y = 0; y <= seg; y++) {
      var v = y / seg;
      var phi = v * Math.PI;
      for (var x = 0; x <= seg; x++) {
        var u = x / seg;
        var theta = u * Math.PI * 2;
        var nx = -Math.sin(phi) * Math.sin(theta);
        var ny = Math.cos(phi);
        var nz = Math.sin(phi) * Math.cos(theta);
        positions.push(nx * radius, ny * radius, nz * radius);
        normals.push(nx, ny, nz);
        uvs.push(u0 + u * (u1 - u0), v1 - v * (v1 - v0));
      }
    }
    for (var iy = 0; iy < seg; iy++) {
      for (var ix = 0; ix < seg; ix++) {
        var a = iy * (seg + 1) + ix;
        var b = a + seg + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  // ── звезда ─────────────────────────────────────────────────────────────────
  // Толстая 5-конечная звезда. UV: equirectangular strip, как у планеты.
  function starGeo(size, stripUV) {
    var pts = 5, outerR = size / 2, innerR = outerR * 0.42, depth = outerR * 0.38;
    var uv = (stripUV && stripUV.map) || [0, 0, 1, 1];
    var u0 = uv[0], v0 = uv[1], u1 = uv[2], v1 = uv[3];
    var positions = [], normals = [], uvs = [], indices = [];
    var outline = [];
    for (var i = 0; i < pts * 2; i++) {
      var ang = (i * Math.PI) / pts - Math.PI / 2;
      var rad = i % 2 === 0 ? outerR : innerR;
      outline.push([Math.cos(ang) * rad, Math.sin(ang) * rad]);
    }
    var n = outline.length;
    var vi = 0;
    for (var face = 0; face < 2; face++) {
      var nz = face === 0 ? 1 : -1;
      var z = face === 0 ? depth / 2 : -depth / 2;
      var center = vi;
      positions.push(0, 0, z); normals.push(0, 0, nz);
      uvs.push(u0 + (u1 - u0) * 0.5, v0 + (v1 - v0) * 0.5);
      vi++;
      for (var j = 0; j < n; j++) {
        var p = outline[j];
        positions.push(p[0], p[1], z); normals.push(0, 0, nz);
        var uu = 0.5 + p[0] / (outerR * 2);
        var vv = 0.5 + p[1] / (outerR * 2);
        uvs.push(u0 + uu * (u1 - u0), v0 + vv * (v1 - v0));
        vi++;
      }
      for (var j = 0; j < n; j++) {
        var a = center, b = center + 1 + j, c = center + 1 + (j + 1) % n;
        if (face === 0) indices.push(a, b, c);
        else indices.push(a, c, b);
      }
    }
    for (var j = 0; j < n; j++) {
      var j2 = (j + 1) % n;
      var p0 = outline[j], p1 = outline[j2];
      var dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      var len = Math.sqrt(dx * dx + dy * dy);
      var nx = dy / len, ny = -dx / len;
      var base = vi;
      positions.push(p0[0], p0[1], depth / 2); normals.push(nx, ny, 0);
      positions.push(p1[0], p1[1], depth / 2); normals.push(nx, ny, 0);
      positions.push(p1[0], p1[1], -depth / 2); normals.push(nx, ny, 0);
      positions.push(p0[0], p0[1], -depth / 2); normals.push(nx, ny, 0);
      var eu = j / n, eu2 = (j + 1) / n;
      uvs.push(u0 + eu * (u1 - u0), v1);
      uvs.push(u0 + eu2 * (u1 - u0), v1);
      uvs.push(u0 + eu2 * (u1 - u0), v0);
      uvs.push(u0 + eu * (u1 - u0), v0);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      vi += 4;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  // ── текстура по умолчанию (кавайная мордочка) ─────────────────────────────
  function defaultTexture(shape) {
    var w = 512, h = (shape === 'sphere' || shape === 'star') ? 256 : 512;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');

    if (shape === 'cube') {
      // Развёртка-крест: 4×3 клетки, face=w/4
      var f = w / 4;
      var colors = ['#f9a8d4','#c4b5fd','#93c5fd','#86efac','#fde68a','#fca5a5'];
      var names = ['left','front','right','back','top','bottom'];
      var pos = { left:[0,1], front:[1,1], right:[2,1], back:[3,1], top:[1,0], bottom:[1,2] };
      for (var i = 0; i < names.length; i++) {
        var p = pos[names[i]];
        ctx.fillStyle = colors[i];
        ctx.fillRect(p[0] * f, p[1] * f, f, f);
      }
      // Кавайная мордочка на front
      var fx = 1 * f, fy = 1 * f;
      drawKawaiiface(ctx, fx, fy, f, f);
    } else if (shape === 'star') {
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(0, 0, w, h);
      drawKawaiiface(ctx, w * 0.25, 0, w * 0.5, h);
    } else {
      ctx.fillStyle = '#c4b5fd';
      ctx.fillRect(0, 0, w, h);
      drawKawaiiface(ctx, w * 0.25, 0, w * 0.5, h);
    }

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function drawKawaiiface(ctx, x, y, w, h) {
    var cx = x + w / 2, cy = y + h * 0.45;
    var eyeR = Math.min(w, h) * 0.06;
    var gap = w * 0.15;
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(cx - gap, cy, eyeR, 0, Math.PI * 2);
    ctx.arc(cx + gap, cy, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // Блики
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - gap + eyeR * 0.35, cy - eyeR * 0.35, eyeR * 0.4, 0, Math.PI * 2);
    ctx.arc(cx + gap + eyeR * 0.35, cy - eyeR * 0.35, eyeR * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Румянец
    ctx.fillStyle = 'rgba(255,150,150,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - gap - w * 0.06, cy + h * 0.08, eyeR * 1.5, eyeR * 0.8, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + gap + w * 0.06, cy + h * 0.08, eyeR * 1.5, eyeR * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Улыбка
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = Math.max(1.5, eyeR * 0.4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.06, gap * 0.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // ── UV из манифеста ────────────────────────────────────────────────────────
  // Манифест хранит faces в мм на листе; нам нужны UV в 0..1 относительно
  // crop-прямоугольника текстуры.
  function faceUVsFromManifest(fish) {
    var crop = fish.crop;
    var cx = crop[0], cy = crop[1], cw = crop[2], ch = crop[3];
    var uvs = {};
    var names = Object.keys(fish.faces);
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      var r = fish.faces[n];
      uvs[n] = [
        (r[0] - cx) / cw,
        1 - (r[1] - cy + r[3]) / ch,
        (r[0] - cx + r[2]) / cw,
        1 - (r[1] - cy) / ch
      ];
    }
    return uvs;
  }

  // ── spawn: фигура для сцены ────────────────────────────────────────────────
  function spawn(shape, size, tex) {
    var mat = new THREE.MeshStandardMaterial({
      map: tex || defaultTexture(shape),
      roughness: 0.45,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    var geo;
    if (shape === 'cube') {
      var faceUVs = tex
        ? { left:[0,0,1,1], front:[0,0,1,1], right:[0,0,1,1],
            back:[0,0,1,1], top:[0,0,1,1], bottom:[0,0,1,1] }
        : { left:[0,0.5,0.25,0.75], front:[0.25,0.5,0.5,0.75],
            right:[0.5,0.5,0.75,0.75], back:[0.75,0.5,1,0.75],
            top:[0.25,0.75,0.5,1], bottom:[0.25,0.25,0.5,0.5] };
      geo = cubeGeo(size, faceUVs);
    } else if (shape === 'star') {
      geo = starGeo(size, null);
    } else {
      geo = planetGeo(size, null);
    }
    var mesh = new THREE.Mesh(geo, mat);
    var group = new THREE.Group();
    group.add(mesh);
    return { group: group, mixer: null, mesh: mesh, mat: mat };
  }

  // ── bake: геометрия для painted фигур с UV из манифеста ────────────────────
  function bake(fish) {
    var size = fish.size || 1.7;
    if (fish.shape === 'cube') {
      var uvs = faceUVsFromManifest(fish);
      return cubeGeo(size, uvs);
    } else if (fish.shape === 'star') {
      var stripUV = faceUVsFromManifest(fish);
      return starGeo(size, stripUV);
    } else {
      var stripUV = faceUVsFromManifest(fish);
      return planetGeo(size, stripUV);
    }
  }

  // ── thumbnail ──────────────────────────────────────────────────────────────
  var thumbCache = {};
  var thumbRenderer = null;

  function thumbnail(shape, cb) {
    if (thumbCache[shape]) return cb(thumbCache[shape]);
    if (!thumbRenderer) {
      try { thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
      catch (e) { return cb(null); }
      thumbRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      thumbRenderer.setSize(232, 148);
      thumbRenderer.outputEncoding = THREE.sRGBEncoding;
    }

    var scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    var key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 4);
    scene.add(key);

    var s = spawn(shape, 1.4, null);
    scene.add(s.group);
    if (shape === 'cube') {
      s.group.rotation.set(0.4, 0.6, 0.1);
    } else if (shape === 'star') {
      s.group.rotation.set(0.15, 0.3, 0.1);
    }

    var camera = new THREE.PerspectiveCamera(35, 232 / 148, 0.1, 100);
    camera.position.set(0, 0, shape === 'cube' ? 3.2 : shape === 'star' ? 3.0 : 3.6);
    camera.lookAt(0, 0, 0);

    thumbRenderer.render(scene, camera);
    var url = thumbRenderer.domElement.toDataURL('image/png');
    thumbCache[shape] = url;

    s.mat.dispose();
    s.mesh.geometry.dispose();
    if (s.mat.map) s.mat.map.dispose();

    cb(url);
  }

  window.Shape = {
    cube: cubeGeo,
    planet: planetGeo,
    star: starGeo,
    defaultTexture: defaultTexture,
    faceUVsFromManifest: faceUVsFromManifest,
    spawn: spawn,
    bake: bake,
    thumbnail: thumbnail
  };
})();
