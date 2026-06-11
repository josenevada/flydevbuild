/* ========================================================================
   flydevbuild — scene.js
   Hero 3D: a voxel structure that assembles at lightning speed, idles,
   and disassembles as you scroll. One InstancedMesh = one draw call.
   ===================================================================== */

import * as THREE from "../vendor/three.module.min.js";

const ACCENT = new THREE.Color("#c8ff3e");
const DARK = new THREE.Color("#26262b");
const MID = new THREE.Color("#3a3a42");

export function initScene(canvas) {
  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0a0b, 14, 34);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(0, 1.2, 17);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(6, 9, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(ACCENT, 1.1);
  rim.position.set(-7, -3, -5);
  scene.add(rim);

  // ---- build the voxel lattice: an irregular tower of cubes -------------
  const COLS = 6, ROWS = isMobile ? 11 : 14, DEPTH = 6;
  const CELL = 0.62;
  const targets = [];
  const seededRandom = mulberry32(1402); // stable layout across loads

  for (let y = 0; y < ROWS; y++) {
    // density thins toward the top so the silhouette tapers
    const keep = 0.92 - (y / ROWS) * 0.45;
    for (let x = 0; x < COLS; x++) {
      for (let z = 0; z < DEPTH; z++) {
        const onShell = x === 0 || x === COLS - 1 || z === 0 || z === DEPTH - 1;
        if (!onShell && seededRandom() > 0.25) continue; // mostly hollow core
        if (seededRandom() > keep) continue;
        targets.push(new THREE.Vector3(
          (x - (COLS - 1) / 2) * CELL,
          (y - (ROWS - 1) / 2) * CELL,
          (z - (DEPTH - 1) / 2) * CELL
        ));
      }
    }
  }

  // a loose orbit of satellite cubes around the tower
  const SATELLITES = isMobile ? 26 : 48;
  for (let i = 0; i < SATELLITES; i++) {
    const a = seededRandom() * Math.PI * 2;
    const r = 3.6 + seededRandom() * 3.4;
    targets.push(new THREE.Vector3(
      Math.cos(a) * r,
      (seededRandom() - 0.5) * ROWS * CELL * 1.1,
      Math.sin(a) * r
    ));
  }

  const COUNT = targets.length;
  const geo = new THREE.BoxGeometry(CELL * 0.86, CELL * 0.86, CELL * 0.86);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.55 });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // per-instance data: scatter origin, stagger delay, color
  const scatters = [];
  const delays = new Float32Array(COUNT);
  const spins = new Float32Array(COUNT);
  const color = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const dir = new THREE.Vector3(
      seededRandom() - 0.5,
      seededRandom() - 0.5,
      seededRandom() - 0.5
    ).normalize();
    scatters.push(dir.multiplyScalar(16 + seededRandom() * 14));
    delays[i] = (targets[i].y / (ROWS * CELL) + 0.5) * 0.5 + seededRandom() * 0.35;
    spins[i] = (seededRandom() - 0.5) * 4;
    const roll = seededRandom();
    color.copy(roll < 0.08 ? ACCENT : roll < 0.5 ? DARK : MID);
    mesh.setColorAt(i, color);
  }
  mesh.instanceColor.needsUpdate = true;

  const group = new THREE.Group();
  group.add(mesh);
  // sit the structure right of center on desktop, behind copy on mobile
  group.position.x = isMobile ? 0 : 4.6;
  group.position.y = 0.4;
  scene.add(group);

  // ---- animation state ---------------------------------------------------
  let assembly = 0;          // 0 scattered -> 1 assembled (intro)
  let scrollExplode = 0;     // 0 assembled -> 1 re-scattered (scroll scrub)
  let visible = true;
  let running = true;
  let pointerX = 0, pointerY = 0;
  const dummy = new THREE.Object3D();
  const clock = new THREE.Clock();

  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

  function updateInstances(time) {
    for (let i = 0; i < COUNT; i++) {
      // intro assembly, per-instance staggered
      const local = THREE.MathUtils.clamp((assembly - delays[i]) / 0.55, 0, 1);
      const inT = easeOutQuart(local);
      // scroll disassembly pushes back toward (amplified) scatter
      const out = scrollExplode * scrollExplode;
      const mix = inT * (1 - out);

      const t = targets[i];
      const s = scatters[i];
      const floatY = Math.sin(time * 0.8 + i * 0.7) * 0.05 * mix;
      dummy.position.set(
        s.x + (t.x - s.x) * mix,
        s.y + (t.y - s.y) * mix + floatY,
        s.z + (t.z - s.z) * mix
      );
      const tumble = (1 - mix) * spins[i] * 2 + time * 0.05 * (i % 5 === 0 ? 1 : 0);
      dummy.rotation.set(tumble, tumble * 0.8, 0);
      const sc = 0.25 + 0.75 * mix;
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible) return;

    const t = clock.getElapsedTime();
    if (assembly < 1) assembly = Math.min(1, assembly + 0.0105);

    updateInstances(t);

    group.rotation.y = t * 0.16 + pointerX * 0.25 + scrollExplode * 1.4;
    group.rotation.x = pointerY * 0.12 + scrollExplode * 0.35;
    camera.position.z = 17 + scrollExplode * 5;

    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  if (!isMobile) {
    window.addEventListener("pointermove", (e) => {
      pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  // don't burn GPU while the hero is offscreen
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  io.observe(canvas);

  requestAnimationFrame(frame);

  return {
    setScroll(p) { scrollExplode = p; },
    kickAssembly() { assembly = Math.max(assembly, 0.001); },
    destroy() {
      running = false;
      io.disconnect();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    },
  };
}

// small deterministic PRNG so the structure looks identical every visit
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
