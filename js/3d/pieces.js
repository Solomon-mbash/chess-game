/* =============================================================
   pieces.js — procedural 3D chess pieces

   Each piece is built from Three.js primitives (LatheGeometry,
   CylinderGeometry, Box, Torus, Sphere). Two shared materials
   (white/ivory + black/ebony) and a shared base.

   Board coordinates (chess.js convention):
     0 = a8, 7 = h8, 8 = a7, ..., 56 = a1, 63 = h1.
   We map that to scene coordinates:
     file a..h -> x = -3.5 .. 3.5
     rank 8..1 -> z =  3.5 .. -3.5  (rank 8 is at +z)
   ============================================================= */

import * as THREE from "three";

const PIECE_Y = 0; // pieces sit on top of the square (square top is at y=0)

/* ---- Materials ---- */
function makeMaterials() {
  return {
    light: new THREE.MeshStandardMaterial({
      color: 0xf3e9d2,
      roughness: 0.35,
      metalness: 0.05,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: 0x2a2520,
      roughness: 0.4,
      metalness: 0.05,
    }),
  };
}

/* ---- Shared foot/base ---- */
function buildBase(material) {
  const g = new THREE.CylinderGeometry(0.32, 0.38, 0.16, 32);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ---- Pawn: smooth lathe profile ---- */
function buildPawn(material) {
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.22, 0.0),
    new THREE.Vector2(0.26, 0.04),
    new THREE.Vector2(0.24, 0.1),
    new THREE.Vector2(0.18, 0.18),
    new THREE.Vector2(0.16, 0.32),
    new THREE.Vector2(0.2, 0.46),
    new THREE.Vector2(0.22, 0.6),
    new THREE.Vector2(0.18, 0.7),
    new THREE.Vector2(0.12, 0.78),
    new THREE.Vector2(0.0, 0.8),
  ];
  const g = new THREE.LatheGeometry(profile, 32);
  g.translate(0, 0.16, 0);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ---- Rook: cylinder body + 4 crenellations ---- */
function buildRook(material) {
  const group = new THREE.Group();
  const bodyG = new THREE.CylinderGeometry(0.26, 0.3, 0.7, 32);
  const body = new THREE.Mesh(bodyG, material);
  body.position.y = 0.16 + 0.35;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const neckG = new THREE.CylinderGeometry(0.3, 0.26, 0.08, 32);
  const neck = new THREE.Mesh(neckG, material);
  neck.position.y = 0.16 + 0.7 + 0.04;
  neck.castShadow = true;
  group.add(neck);

  // 4 crenellations around the rim
  const crenG = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const cren = new THREE.Mesh(crenG, material);
    cren.position.set(Math.cos(a) * 0.2, 0.16 + 0.7 + 0.08 + 0.07, Math.sin(a) * 0.2);
    cren.castShadow = true;
    group.add(cren);
  }
  return group;
}

/* ---- Bishop: lathe body with point + sphere collar ---- */
function buildBishop(material) {
  const group = new THREE.Group();
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.24, 0.0),
    new THREE.Vector2(0.28, 0.06),
    new THREE.Vector2(0.24, 0.14),
    new THREE.Vector2(0.18, 0.24),
    new THREE.Vector2(0.2, 0.44),
    new THREE.Vector2(0.24, 0.6),
    new THREE.Vector2(0.2, 0.74),
    new THREE.Vector2(0.12, 0.86),
    new THREE.Vector2(0.06, 0.96),
    new THREE.Vector2(0.0, 1.0),
  ];
  const bodyG = new THREE.LatheGeometry(profile, 32);
  bodyG.translate(0, 0.16, 0);
  const body = new THREE.Mesh(bodyG, material);
  body.castShadow = true;
  group.add(body);

  // Mitre (small ball on top)
  const ballG = new THREE.SphereGeometry(0.07, 16, 12);
  const ball = new THREE.Mesh(ballG, material);
  ball.position.y = 0.16 + 1.0 + 0.04;
  ball.castShadow = true;
  group.add(ball);

  // Slit (a thin dark box for the bishop's diagonal cut)
  const slitG = new THREE.BoxGeometry(0.02, 0.18, 0.05);
  const slit = new THREE.Mesh(slitG, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
  slit.position.set(0, 0.16 + 0.95, 0);
  group.add(slit);
  return group;
}

/* ---- Knight: stylized L-shape from boxes + lathe neck ---- */
function buildKnight(material) {
  const group = new THREE.Group();
  // Base
  const baseG = new THREE.CylinderGeometry(0.28, 0.32, 0.18, 24);
  const base = new THREE.Mesh(baseG, material);
  base.position.y = 0.16 + 0.09;
  base.castShadow = true;
  group.add(base);

  // Lower body block
  const lowerG = new THREE.BoxGeometry(0.42, 0.4, 0.32);
  const lower = new THREE.Mesh(lowerG, material);
  lower.position.y = 0.16 + 0.18 + 0.2;
  lower.castShadow = true;
  group.add(lower);

  // Upper neck (tilted)
  const neckG = new THREE.BoxGeometry(0.34, 0.36, 0.28);
  const neck = new THREE.Mesh(neckG, material);
  neck.position.set(0, 0.16 + 0.18 + 0.4 + 0.12, 0.05);
  neck.rotation.x = -0.18;
  neck.castShadow = true;
  group.add(neck);

  // Head (rounded box, leaning forward)
  const headG = new THREE.BoxGeometry(0.26, 0.32, 0.42);
  const head = new THREE.Mesh(headG, material);
  head.position.set(0, 0.16 + 0.18 + 0.4 + 0.32, 0.16);
  head.rotation.x = 0.4;
  head.castShadow = true;
  group.add(head);

  // Mane/ear (a small wedge on top)
  const earG = new THREE.ConeGeometry(0.08, 0.18, 8);
  const ear = new THREE.Mesh(earG, material);
  ear.position.set(0, 0.16 + 0.18 + 0.4 + 0.32 + 0.22, -0.04);
  ear.rotation.x = 0.3;
  ear.castShadow = true;
  group.add(ear);
  return group;
}

/* ---- Queen: lathe body + crown ring + sphere ---- */
function buildQueen(material) {
  const group = new THREE.Group();
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.26, 0.0),
    new THREE.Vector2(0.3, 0.08),
    new THREE.Vector2(0.26, 0.18),
    new THREE.Vector2(0.2, 0.3),
    new THREE.Vector2(0.22, 0.52),
    new THREE.Vector2(0.26, 0.7),
    new THREE.Vector2(0.24, 0.86),
    new THREE.Vector2(0.18, 0.98),
    new THREE.Vector2(0.1, 1.08),
    new THREE.Vector2(0.0, 1.12),
  ];
  const bodyG = new THREE.LatheGeometry(profile, 32);
  bodyG.translate(0, 0.16, 0);
  const body = new THREE.Mesh(bodyG, material);
  body.castShadow = true;
  group.add(body);

  // Crown ring
  const ringG = new THREE.TorusGeometry(0.2, 0.03, 8, 24);
  const ring = new THREE.Mesh(ringG, material);
  ring.position.y = 0.16 + 1.0;
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  group.add(ring);

  // Small spikes (5 around the ring)
  const spikeG = new THREE.ConeGeometry(0.05, 0.16, 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(spikeG, material);
    spike.position.set(Math.cos(a) * 0.2, 0.16 + 1.0 + 0.08, Math.sin(a) * 0.2);
    spike.castShadow = true;
    group.add(spike);
  }
  return group;
}

/* ---- King: taller lathe body + cross on top ---- */
function buildKing(material) {
  const group = new THREE.Group();
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.26, 0.0),
    new THREE.Vector2(0.3, 0.08),
    new THREE.Vector2(0.26, 0.18),
    new THREE.Vector2(0.2, 0.3),
    new THREE.Vector2(0.22, 0.6),
    new THREE.Vector2(0.26, 0.82),
    new THREE.Vector2(0.24, 1.0),
    new THREE.Vector2(0.18, 1.14),
    new THREE.Vector2(0.1, 1.22),
    new THREE.Vector2(0.0, 1.26),
  ];
  const bodyG = new THREE.LatheGeometry(profile, 32);
  bodyG.translate(0, 0.16, 0);
  const body = new THREE.Mesh(bodyG, material);
  body.castShadow = true;
  group.add(body);

  // Collar
  const collarG = new THREE.TorusGeometry(0.16, 0.03, 8, 24);
  const collar = new THREE.Mesh(collarG, material);
  collar.position.y = 0.16 + 1.16;
  collar.rotation.x = Math.PI / 2;
  collar.castShadow = true;
  group.add(collar);

  // Cross: vertical + horizontal bar
  const vG = new THREE.BoxGeometry(0.06, 0.22, 0.06);
  const v = new THREE.Mesh(vG, material);
  v.position.y = 0.16 + 1.26 + 0.11;
  v.castShadow = true;
  group.add(v);

  const hG = new THREE.BoxGeometry(0.18, 0.06, 0.06);
  const h = new THREE.Mesh(hG, material);
  h.position.y = 0.16 + 1.26 + 0.16;
  h.castShadow = true;
  group.add(h);
  return group;
}

/* ---- Public API ----
   kind: 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
   color: 'w' | 'b'
   returns a THREE.Group with userData = { kind, color, square }
*/
export function buildPiece(kind, color, square, materials) {
  const mat = color === "w" ? materials.light : materials.dark;
  const base = buildBase(mat);

  let head;
  switch (kind) {
    case "p": head = buildPawn(mat); break;
    case "n": head = buildKnight(mat); break;
    case "b": head = buildBishop(mat); break;
    case "r": head = buildRook(mat); break;
    case "q": head = buildQueen(mat); break;
    case "k": head = buildKing(mat); break;
    default:  head = new THREE.Group();
  }

  const group = new THREE.Group();
  group.add(base);
  group.add(head);
  group.position.y = PIECE_Y;
  group.userData = { kind, color, square };
  // Mark all descendant meshes so the raycaster can climb up to find the group.
  group.traverse((o) => {
    if (o.isMesh) {
      o.userData.pieceGroup = group;
    }
  });
  return group;
}

export { makeMaterials };
