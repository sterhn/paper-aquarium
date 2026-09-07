/* Split a multi-fish GLB into individual GLB files and extract 2D side-view
   silhouette outlines for use in coloring pages.

   Usage: node tools/split-fish.js <input.glb>

   Outputs:
     assets/models/<name>.glb        — individual GLB per fish
     tools/contours.json             — 2D outlines for make-coloring.js
*/
'use strict';

const fs = require('fs');
const path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { prune } = require('@gltf-transform/functions');

const ROOT = path.join(__dirname, '..');
const MODEL_DIR = path.join(ROOT, 'assets', 'models');
const INPUT = process.argv[2];
if (!INPUT) { console.error('usage: node tools/split-fish.js <input.glb>'); process.exit(1); }

const FISH = [
  { armature: 'BrownFishArmature_13', name: 'brownfish', title: 'Рыба-шоколадка' },
  { armature: 'ClownFishArmature_23', name: 'clownfish', title: 'Рыба-клоун' },
  { armature: 'TunaArmature_33',      name: 'tuna',      title: 'Тунец' },
  { armature: 'DoryArmature_47',       name: 'dory',      title: 'Дори' },
];

async function main() {
  const io = new NodeIO();
  const doc = await io.read(INPUT);
  const root = doc.getRoot();
  const scene = root.listScenes()[0];

  // Find the GLTF_SceneRootNode that contains the 4 fish armatures
  let sceneRoot = null;
  for (const n of scene.listChildren()) {
    // Walk down Sketchfab_model -> root -> GLTF_SceneRootNode
    const walk = (node, depth) => {
      if (depth > 3) return null;
      if (node.listChildren().length >= 4) return node;
      for (const c of node.listChildren()) {
        const r = walk(c, depth + 1);
        if (r) return r;
      }
      return null;
    };
    sceneRoot = walk(n, 0);
    if (sceneRoot) break;
  }
  if (!sceneRoot) throw new Error('Cannot find scene root with 4 fish');

  const armatures = sceneRoot.listChildren();
  console.log('Found', armatures.length, 'fish armatures');

  const contours = {};

  for (const fishDef of FISH) {
    const armNode = armatures.find(a => a.getName() === fishDef.armature);
    if (!armNode) { console.error('  armature not found:', fishDef.armature); continue; }

    // Extract this fish's outline from its mesh vertices
    const verts = [];
    const collectVerts = (node) => {
      const mesh = node.getMesh();
      if (mesh) {
        for (const prim of mesh.listPrimitives()) {
          const pos = prim.getAttribute('POSITION');
          if (pos) {
            for (let i = 0; i < pos.getCount(); i++) {
              const v = pos.getElement(i, [0, 0, 0]);
              verts.push(v);
            }
          }
        }
      }
      for (const c of node.listChildren()) collectVerts(c);
    };
    collectVerts(armNode);

    // Compute bounding box for normalization
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const v of verts) {
      if (v[0] < minX) minX = v[0]; if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1]; if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2]; if (v[2] > maxZ) maxZ = v[2];
    }

    // Project to side view: largest extent is the body axis,
    // second is dorsal, third is lateral
    const spans = [
      { axis: 0, span: maxX - minX, name: 'x' },
      { axis: 1, span: maxY - minY, name: 'y' },
      { axis: 2, span: maxZ - minZ, name: 'z' },
    ].sort((a, b) => b.span - a.span);

    const bodyAxis = spans[0].axis;
    const upAxis = spans[1].axis;

    // Project all vertices to the (bodyAxis, upAxis) plane
    const pts2d = verts.map(v => [v[bodyAxis], v[upAxis]]);

    // Compute convex hull
    const hull = convexHull(pts2d);

    // Normalize to 0..1 range
    let hMinX = Infinity, hMaxX = -Infinity, hMinY = Infinity, hMaxY = -Infinity;
    for (const p of hull) {
      if (p[0] < hMinX) hMinX = p[0]; if (p[0] > hMaxX) hMaxX = p[0];
      if (p[1] < hMinY) hMinY = p[1]; if (p[1] > hMaxY) hMaxY = p[1];
    }
    const hSpanX = hMaxX - hMinX || 1;
    const hSpanY = hMaxY - hMinY || 1;
    const normalized = hull.map(p => [
      Math.round(((p[0] - hMinX) / hSpanX) * 10000) / 10000,
      Math.round(((p[1] - hMinY) / hSpanY) * 10000) / 10000,
    ]);

    contours[fishDef.name] = {
      title: fishDef.title,
      outline: normalized,
      aspect: hSpanX / hSpanY,
    };

    console.log('  ' + fishDef.name + ': ' + verts.length + ' verts, hull ' + hull.length + ' pts, aspect ' + (hSpanX / hSpanY).toFixed(2));
  }

  // Now split each fish into its own GLB
  for (const fishDef of FISH) {
    const splitDoc = await io.read(INPUT);
    const splitRoot = splitDoc.getRoot();
    const splitScene = splitRoot.listScenes()[0];

    // Find sceneRoot again
    let sr = null;
    const walkFind = (node, depth) => {
      if (depth > 3) return null;
      if (node.listChildren().length >= 4) return node;
      for (const c of node.listChildren()) {
        const r = walkFind(c, depth + 1);
        if (r) return r;
      }
      return null;
    };
    for (const n of splitScene.listChildren()) {
      sr = walkFind(n, 0);
      if (sr) break;
    }

    // Remove all other fish armatures
    for (const child of sr.listChildren()) {
      if (child.getName() !== fishDef.armature) {
        child.detach();
      }
    }

    // Filter animations to only reference this fish's nodes
    const keepNodes = new Set();
    const collectNodes = (node) => {
      keepNodes.add(node);
      for (const c of node.listChildren()) collectNodes(c);
    };
    const kept = sr.listChildren().find(c => c.getName() === fishDef.armature);
    if (kept) collectNodes(kept);

    // Prune unused resources
    await splitDoc.transform(prune());

    const outPath = path.join(MODEL_DIR, fishDef.name + '.glb');
    await io.write(outPath, splitDoc);
    const stat = fs.statSync(outPath);
    console.log('  wrote ' + outPath + ' (' + Math.round(stat.size / 1024) + ' KB)');
  }

  // Save contours
  const contoursPath = path.join(__dirname, 'contours.json');
  fs.writeFileSync(contoursPath, JSON.stringify(contours, null, 2), 'utf8');
  console.log('wrote ' + contoursPath);
}

function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 2) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

main().catch(e => { console.error(e); process.exit(1); });
