/* =============================================================
   board3d.js — 8x8 mesh grid, frame, highlight overlays

   Coordinate convention (chess.js -> scene):
     square 0..63 with 0 = a8, 7 = h8, 8 = a7, ..., 63 = h1.
     file f (0..7) -> x = f - 3.5
     rank r (0..7 from top) -> z = 3.5 - r
   ============================================================= */

import * as THREE from "three";

const BOARD_SIZE = 8;
const SQUARE = 1.0; // each square is 1x1 world unit

// Convert a chess.js square index (0..63) to scene (x, z) at the square CENTER.
export function squareToXZSq(idx) {
  const file = idx % BOARD_SIZE;
  const rank = (idx / BOARD_SIZE) | 0; // 0 = a8 row
  return { x: file - 3.5, z: 3.5 - rank };
}

// Convert (x, z) scene coords to a square index (0..63).
export function xzToSquare(x, z) {
  const file = Math.round(x + 3.5);
  const rank = Math.round(3.5 - z);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return -1;
  return rank * BOARD_SIZE + file;
}

export function buildBoard({
  lightColor = 0xe6d4ad,
  darkColor = 0x8b5a3c,
  frameColor = 0x3d2a1c,
  selectedColor = 0xffd86b,
  lastMoveColor = 0xc9a85a,
  checkColor = 0xff4d4d,
  captureColor = 0xff8080,
  moveColor = 0x4d6b50,
} = {}) {
  const root = new THREE.Group();
  root.name = "board";

  // ---- Frame (a slightly larger dark box under the grid) ----
  const frameG = new THREE.BoxGeometry(8.6, 0.25, 8.6);
  const frameM = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.6,
    metalness: 0.05,
  });
  const frame = new THREE.Mesh(frameG, frameM);
  frame.position.y = -0.18;
  frame.receiveShadow = true;
  frame.castShadow = false;
  root.add(frame);

  // ---- 8x8 squares ----
  const squareG = new THREE.BoxGeometry(SQUARE, 0.12, SQUARE);
  const lightM = new THREE.MeshStandardMaterial({
    color: lightColor,
    roughness: 0.65,
    metalness: 0.02,
  });
  const darkM = new THREE.MeshStandardMaterial({
    color: darkColor,
    roughness: 0.65,
    metalness: 0.02,
  });
  const squares = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let f = 0; f < BOARD_SIZE; f++) {
      const isLight = (r + f) % 2 === 0;
      const mat = isLight ? lightM : darkM;
      const mesh = new THREE.Mesh(squareG, mat.clone()); // clone so we can tint individually
      mesh.position.set(f - 3.5, -0.05, 3.5 - r);
      mesh.receiveShadow = true;
      mesh.userData = { square: r * BOARD_SIZE + f, kind: "square" };
      root.add(mesh);
      squares.push(mesh);
    }
  }

  // ---- Highlight overlays (reuse 64 thin slabs, hidden by default) ----
  const overlayG = new THREE.BoxGeometry(SQUARE * 0.95, 0.04, SQUARE * 0.95);
  const overlayMap = {}; // square -> mesh
  for (let i = 0; i < 64; i++) {
    const mesh = new THREE.Mesh(overlayG, new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.0,
      transparent: true,
      opacity: 0.0,
    }));
    const { x, z } = squareToXZSq(i);
    mesh.position.set(x, 0.03, z);
    mesh.userData = { square: i, kind: "highlight" };
    mesh.visible = false;
    root.add(mesh);
    overlayMap[i] = mesh;
  }

  // ---- Move dots (small flat cylinders) ----
  const dotG = new THREE.CylinderGeometry(0.13, 0.13, 0.02, 24);
  const dotMap = {};
  for (let i = 0; i < 64; i++) {
    const m = new THREE.Mesh(dotG, new THREE.MeshStandardMaterial({
      color: moveColor,
      roughness: 0.5,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85,
    }));
    const { x, z } = squareToXZSq(i);
    m.position.set(x, 0.05, z);
    m.userData = { square: i, kind: "dot" };
    m.visible = false;
    root.add(m);
    dotMap[i] = m;
  }

  // ---- Capture rings (thin torus) ----
  const ringG = new THREE.TorusGeometry(0.38, 0.05, 10, 32);
  const ringMap = {};
  for (let i = 0; i < 64; i++) {
    const m = new THREE.Mesh(ringG, new THREE.MeshStandardMaterial({
      color: captureColor,
      roughness: 0.5,
      metalness: 0.0,
      transparent: true,
      opacity: 0.95,
    }));
    const { x, z } = squareToXZSq(i);
    m.position.set(x, 0.05, z);
    m.rotation.x = Math.PI / 2;
    m.userData = { square: i, kind: "ring" };
    m.visible = false;
    root.add(m);
    ringMap[i] = m;
  }

  return {
    root,
    squares,
    overlayMap,
    dotMap,
    ringMap,
    colors: { lightColor, darkColor, selectedColor, lastMoveColor, checkColor, moveColor, captureColor, frameColor },
  };
}
