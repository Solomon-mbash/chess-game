/* =============================================================
   scene.js — three.js scene, camera, lights, renderer,
              OrbitControls, and raycasting helpers.

   The board sits at y=0 and spans x:[-3.5..3.5], z:[-3.5..3.5].
   The camera looks down from above by default.
   ============================================================= */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createScene(canvas) {
  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // ---- Scene ----
  const scene = new THREE.Scene();
  scene.background = null; // CSS gradient shows through (alpha:true)

  // Subtle fog for depth (very mild)
  scene.fog = new THREE.Fog(0x101824, 22, 45);

  // ---- Camera ----
  const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 100);
  // White side: looking from -z, slightly elevated.
  camera.position.set(0, 9, -9.5);
  camera.lookAt(0, 0, 0);

  // ---- Lights ----
  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3a4a, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(6, 12, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  // Subtle fill from the opposite side
  const fill = new THREE.DirectionalLight(0xbfd0ff, 0.35);
  fill.position.set(-8, 6, -6);
  scene.add(fill);

  // ---- OrbitControls ----
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.minDistance = 8;
  controls.maxDistance = 30;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = 1.35;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.6;

  // ---- Resize handling ----
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  // Initial size
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ---- Raycaster ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    return raycaster;
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    pick,
    resize,
  };
}
