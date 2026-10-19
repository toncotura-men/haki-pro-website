/* =========================================================
   HAKI pro — 3D の舞台（Three.js）
   <canvas data-scene="ring|loop|pulse|network|ball"> を自動で起動する。
   ・ring    … ロゴの6色の H が、バラバラから1つの輪に組み上がる（個性 → 組織）
   ・loop    … 企業（青）と子ども（緑）をつなぐ ∞ の循環
   ・pulse   … 6色の輪が心拍のように広がる（健康経営）
   ・network … 人と人が線でつながる（組織コーチング）
   ・ball    … 指で回せる硬式球（野球スクール）
   画面外・タブ非表示のときは止める。動きを減らす設定では止まった1枚だけ描く。
   ========================================================= */
import * as THREE from "three";
import { RoomEnvironment } from "../vendor/RoomEnvironment.js";

const PALETTE = [0xe60312, 0xb30281, 0x1d2286, 0x0881cb, 0x42af38, 0xfee003];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

/* ---------- 共通：レンダラー・カメラ・光 ---------- */
function makeStage(canvas, { fov = 35, env = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, 8);
  if (env) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 6);
  const rim = new THREE.PointLight(0x6aa8ff, 30, 20);
  rim.position.set(-4, -2, 3);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.25));
  return { renderer, scene, camera };
}

/* 見えている範囲（カメラ位置での半分の幅・高さ） */
function viewHalf(camera) {
  const h = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  return { w: h * camera.aspect, h };
}

/* 丸い光の粒（粒子用のテクスチャ） */
let dotTex;
function dotTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,.6)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

/* 奥行きのある光の粒 */
function dust(count = 500, rMin = 2.5, rMax = 8, size = 0.05) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * (rMax - rMin);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph) - 2], i * 3);
    c.setHex(Math.random() < 0.55 ? 0xffffff : PALETTE[i % 6]);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
  return new THREE.Points(geo, mat);
}

/* ---------- ロゴの H のかたち（平行四辺形に傾けた H） ---------- */
function hGeometry() {
  const w = 0.7, h = 0.58, t = 0.22, c = 0.18, shear = 0.3;
  const pts = [[-w / 2, -h / 2], [-w / 2 + t, -h / 2], [-w / 2 + t, -c / 2], [w / 2 - t, -c / 2], [w / 2 - t, -h / 2], [w / 2, -h / 2],
    [w / 2, h / 2], [w / 2 - t, h / 2], [w / 2 - t, c / 2], [-w / 2 + t, c / 2], [-w / 2 + t, h / 2], [-w / 2, h / 2]];
  const s = new THREE.Shape();
  pts.forEach(([x, y], k) => (k ? s.lineTo(x + y * shear, y) : s.moveTo(x + y * shear, y)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.035, bevelSegments: 5, curveSegments: 2 });
  geo.center();
  return geo;
}

function hPieces(scale = 1) {
  const geo = hGeometry();
  const group = new THREE.Group();
  const pieces = PALETTE.map((hex, i) => {
    const mat = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4 });
    const m = new THREE.Mesh(geo, mat);
    const th = THREE.MathUtils.degToRad(60 - 60 * i);
    const R = 0.98;
    m.userData.home = new THREE.Vector3(Math.cos(th) * R, Math.sin(th) * R, 0);
    m.userData.homeQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, th - Math.PI / 2 + 0.38));
    const dir = new THREE.Vector3(Math.cos(th), Math.sin(th), (Math.random() - 0.5) * 1.6).normalize();
    m.userData.scatter = dir.multiplyScalar(3.4 + Math.random() * 1.6);
    m.userData.scatterQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    m.userData.phase = Math.random() * Math.PI * 2;
    m.position.copy(m.userData.scatter);
    m.quaternion.copy(m.userData.scatterQ);
    group.add(m);
    return m;
  });
  group.scale.setScalar(scale);
  return { group, pieces };
}

/* ---------- 各モード ---------- */
const MODES = {
  ring(stage, el) {
    const { scene, camera } = stage;
    const { group, pieces } = hPieces();
    const holder = new THREE.Group();
    holder.add(group);
    scene.add(holder);
    const d = dust(560);
    scene.add(d);
    const isHome = el.dataset.layout === "home";
    let intro = reduced ? 1 : 0;
    const born = performance.now();
    return {
      layout() {
        const v = viewHalf(camera);
        const portrait = camera.aspect < 0.9;
        if (portrait) {
          holder.scale.setScalar(Math.min(v.w * 0.54, v.h * 0.32));
          holder.position.set(0, v.h * 0.36, 0);
        } else {
          holder.scale.setScalar(Math.min(v.h * 0.4, v.w * 0.24));
          holder.position.set(v.w * 0.52, v.h * 0.08, 0);
        }
      },
      update(t, dt, s, ptr) {
        intro = reduced ? 1 : Math.min(1, (performance.now() - born) / 2600);
        pieces.forEach((m, i) => {
          const local = expoOut(clamp((intro - i * 0.07) / 0.58));
          const out = s * 1.1; // スクロールで少し外へ開く
          const home = m.userData.home;
          const bob = reduced ? 0 : Math.sin(t * 1.2 + m.userData.phase) * 0.03;
          m.position.lerpVectors(m.userData.scatter, home, local);
          m.position.x += home.x * out;
          m.position.y += home.y * out;
          m.position.z += bob + s * (i % 2 ? 0.6 : -0.6);
          m.quaternion.slerpQuaternions(m.userData.scatterQ, m.userData.homeQ, local);
        });
        if (!reduced) group.rotation.z -= dt * (0.12 + s * 0.6);
        holder.rotation.x = damp(holder.rotation.x, -ptr.y * 0.35 + s * 0.5, 4, dt);
        holder.rotation.y = damp(holder.rotation.y, ptr.x * 0.45, 4, dt);
        d.rotation.y += dt * 0.02;
        d.rotation.x = damp(d.rotation.x, ptr.y * 0.08, 2, dt);
      },
    };
  },

  loop(stage) {
    const { scene, camera } = stage;
    const N = reduced ? 1400 : 2200;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const seed = Array.from({ length: N }, () => ({ t: Math.random() * Math.PI * 2, r: Math.random() * 0.16, a: Math.random() * Math.PI * 2, v: 0.18 + Math.random() * 0.1 }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.075, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const holder = new THREE.Group();
    holder.add(pts);
    const center = hPieces(0.26);
    center.pieces.forEach((m) => { m.position.copy(m.userData.home); m.quaternion.copy(m.userData.homeQ); });
    holder.add(center.group);
    scene.add(holder, dust(300));
    const blue = new THREE.Color(0x2aa3ff), green = new THREE.Color(0x5bd64a), white = new THREE.Color(0xffffff), c = new THREE.Color();
    const A = 2.1;
    const curve = (t, out) => {
      const s = Math.sin(t), co = Math.cos(t), k = 1 + s * s;
      out.set((A * co) / k, (A * s * co) / k * 1.15, Math.sin(t) * 0.5);
      return out;
    };
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    return {
      layout() {
        const v = viewHalf(camera);
        const portrait = camera.aspect < 0.9;
        holder.scale.setScalar(portrait ? v.w * 0.42 : Math.min(v.w * 0.3, v.h * 0.45));
        holder.position.set(portrait ? 0 : v.w * 0.32, portrait ? v.h * 0.38 : v.h * 0.05, 0);
      },
      update(t, dt, s, ptr) {
        for (let i = 0; i < N; i++) {
          const sd = seed[i];
          const tt = sd.t + (reduced ? 0 : t * sd.v);
          curve(tt, p);
          curve(tt + 0.01, q);
          const off = sd.r;
          pos[i * 3] = p.x + Math.cos(sd.a + t * 0.3) * off;
          pos[i * 3 + 1] = p.y + Math.sin(sd.a + t * 0.3) * off;
          pos[i * 3 + 2] = p.z + Math.sin(sd.a) * off;
          const k = clamp((p.x + 0.5) / 1);
          c.copy(blue).lerp(green, k);
          if (Math.abs(p.x) < 0.35) c.lerp(white, 1 - Math.abs(p.x) / 0.35);
          col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        if (!reduced) center.group.rotation.z -= dt * 0.5;
        holder.rotation.x = damp(holder.rotation.x, -0.35 - ptr.y * 0.3 + s * 0.4, 4, dt);
        holder.rotation.y = damp(holder.rotation.y, ptr.x * 0.5, 4, dt);
      },
    };
  },

  pulse(stage) {
    const { scene, camera } = stage;
    const holder = new THREE.Group();
    const rings = PALETTE.map((hex, i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.5 + i * 0.24, 0.028, 24, 160), new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.25, clearcoat: 1, emissive: hex, emissiveIntensity: 0.25 }));
      m.rotation.x = 1.15;
      m.rotation.y = (i - 2.5) * 0.06;
      holder.add(m);
      return m;
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 6), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1, transmission: 0.6, thickness: 0.6, ior: 1.4, emissive: 0xff2d55, emissiveIntensity: 0.25 }));
    holder.add(core);
    scene.add(holder, dust(420));
    const beat = (x) => { const f = x % 1.1; return Math.exp(-Math.pow((f - 0.12) / 0.05, 2)) + 0.6 * Math.exp(-Math.pow((f - 0.34) / 0.06, 2)); };
    return {
      layout() {
        const v = viewHalf(camera);
        const portrait = camera.aspect < 0.9;
        holder.scale.setScalar(portrait ? v.w * 0.46 : Math.min(v.w * 0.36, v.h * 0.55));
        holder.position.set(portrait ? 0 : v.w * 0.4, portrait ? v.h * 0.4 : 0, 0);
      },
      update(t, dt, s, ptr) {
        rings.forEach((m, i) => {
          const b = reduced ? 0 : beat(t - i * 0.07);
          m.scale.setScalar(1 + b * 0.09);
          m.position.y = Math.sin(t * 0.8 + i * 0.6) * 0.06 + s * (i - 2.5) * 0.3;
          m.rotation.z += dt * (i % 2 ? 0.08 : -0.08);
        });
        core.scale.setScalar(1 + (reduced ? 0 : beat(t)) * 0.18);
        holder.rotation.x = damp(holder.rotation.x, -ptr.y * 0.3 + s * 0.6, 4, dt);
        holder.rotation.y = damp(holder.rotation.y, ptr.x * 0.5, 4, dt);
      },
    };
  },

  network(stage) {
    const { scene, camera } = stage;
    const N = 72, R = 1.7;
    const holder = new THREE.Group();
    const nodes = [];
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i;
      nodes.push({ home: new THREE.Vector3(Math.cos(th) * r * R, y * R, Math.sin(th) * r * R), from: new THREE.Vector3().randomDirection().multiplyScalar(5 + Math.random() * 3), ph: Math.random() * 6.28, cur: new THREE.Vector3() });
    }
    const sphereGeo = new THREE.SphereGeometry(0.055, 16, 16);
    const inst = new THREE.InstancedMesh(sphereGeo, new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 1, emissiveIntensity: 0.4 }), N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) inst.setColorAt(i, c.setHex(i % 4 === 0 ? 0xffffff : PALETTE[i % 6]));
    holder.add(inst);
    const pairs = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (nodes[i].home.distanceTo(nodes[j].home) < 0.78) pairs.push([i, j]);
    const lp = new Float32Array(pairs.length * 6);
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute("position", new THREE.BufferAttribute(lp, 3));
    const lines = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    holder.add(lines);
    scene.add(holder, dust(380));
    const mtx = new THREE.Matrix4();
    let intro = reduced ? 1 : 0;
    const born = performance.now();
    return {
      layout() {
        const v = viewHalf(camera);
        const portrait = camera.aspect < 0.9;
        holder.scale.setScalar(portrait ? v.w * 0.4 : Math.min(v.w * 0.26, v.h * 0.4));
        holder.position.set(portrait ? 0 : v.w * 0.42, portrait ? v.h * 0.4 : 0, 0);
      },
      update(t, dt, s, ptr) {
        intro = reduced ? 1 : Math.min(1, (performance.now() - born) / 2800);
        nodes.forEach((n, i) => {
          const k = expoOut(clamp((intro - (i / N) * 0.35) / 0.65));
          const breathe = reduced ? 1 : 1 + Math.sin(t * 1.4 + n.ph) * 0.05 + s * 0.5;
          n.cur.copy(n.from).lerp(n.home.clone().multiplyScalar(breathe), k);
          mtx.makeTranslation(n.cur.x, n.cur.y, n.cur.z);
          inst.setMatrixAt(i, mtx);
        });
        inst.instanceMatrix.needsUpdate = true;
        pairs.forEach(([a, b], k) => {
          lp.set([nodes[a].cur.x, nodes[a].cur.y, nodes[a].cur.z, nodes[b].cur.x, nodes[b].cur.y, nodes[b].cur.z], k * 6);
        });
        lgeo.attributes.position.needsUpdate = true;
        lines.material.opacity = 0.28 * intro;
        if (!reduced) holder.rotation.y += dt * 0.15;
        holder.rotation.x = damp(holder.rotation.x, -ptr.y * 0.4, 4, dt);
        holder.rotation.z = damp(holder.rotation.z, ptr.x * 0.2, 4, dt);
      },
    };
  },

  /* 硬式球：縫い目は球面上の曲線、赤い糸は V 字に並べる */
  ball(stage, el) {
    const { scene, camera } = stage;
    camera.position.z = 6;
    const holder = new THREE.Group();
    const leather = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), new THREE.MeshPhysicalMaterial({ color: 0xf4efe4, roughness: 0.55, sheen: 1, sheenRoughness: 0.6, sheenColor: 0xffffff, clearcoat: 0.25 }));
    holder.add(leather);
    const k = 0.24;
    const seam = (t) => new THREE.Vector3((1 - k) * Math.cos(t) + k * Math.cos(3 * t), (1 - k) * Math.sin(t) - k * Math.sin(3 * t), 2 * Math.sqrt(k * (1 - k)) * Math.sin(2 * t));
    const S = 108;
    const stitchGeo = new THREE.CapsuleGeometry(0.012, 0.075, 4, 8);
    const stitches = new THREE.InstancedMesh(stitchGeo, new THREE.MeshStandardMaterial({ color: 0xd2232a, roughness: 0.6 }), S * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    for (let i = 0; i < S; i++) {
      const t = (i / S) * Math.PI * 2;
      const p = seam(t).normalize();
      const tan = seam(t + 0.001).normalize().sub(p).normalize();
      const side = new THREE.Vector3().crossVectors(p, tan).normalize();
      for (const sgn of [-1, 1]) {
        const dir = side.clone().multiplyScalar(sgn).add(tan.clone().multiplyScalar(0.55)).normalize();
        const pos = p.clone().multiplyScalar(1.006).add(side.clone().multiplyScalar(sgn * 0.035));
        q.setFromUnitVectors(up, dir);
        m4.compose(pos, q, new THREE.Vector3(1, 1, 1));
        stitches.setMatrixAt(n++, m4);
      }
    }
    holder.add(stitches);
    const curvePts = Array.from({ length: 400 }, (_, i) => seam((i / 400) * Math.PI * 2).normalize().multiplyScalar(1.001));
    const groove = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts, true), 400, 0.006, 6, true), new THREE.MeshStandardMaterial({ color: 0xbdb5a3, roughness: 0.8 }));
    holder.add(groove);
    holder.rotation.set(0.5, 0.4, 0.2);
    scene.add(holder);
    const spot = new THREE.PointLight(0xc8ff3d, 18, 10);
    spot.position.set(-2.5, 1.5, 2);
    scene.add(spot);

    /* 指で回す（横の動きだけ奪う。縦はページのスクロール） */
    const vel = { x: 0, y: reduced ? 0 : 0.6 };
    let drag = null;
    el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, t: performance.now() }; el.setPointerCapture(e.pointerId); el.style.cursor = "grabbing"; });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const now = performance.now(), dtm = Math.max(1, now - drag.t);
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      holder.rotation.y += dx * 0.01;
      holder.rotation.x += dy * 0.01;
      vel.y = (dx * 0.01) / (dtm / 1000);
      vel.x = (dy * 0.01) / (dtm / 1000);
      drag = { x: e.clientX, y: e.clientY, t: now };
      stage.wake();
    });
    const end = () => { drag = null; el.style.cursor = ""; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    return {
      layout() {
        const v = viewHalf(camera);
        holder.scale.setScalar(Math.min(v.w, v.h) * 0.68);
      },
      update(t, dt) {
        if (!drag) {
          holder.rotation.y += vel.y * dt;
          holder.rotation.x += vel.x * dt;
          vel.y = damp(vel.y, reduced ? 0 : 0.6, 1.4, dt);
          vel.x = damp(vel.x, 0, 1.4, dt);
        }
        holder.position.y = reduced ? 0 : Math.sin(t * 1.3) * 0.05;
      },
    };
  },
};

/* ---------- 起動・ループ管理 ---------- */
function mount(canvas) {
  const mode = canvas.dataset.scene;
  if (!MODES[mode]) return;
  let stage;
  try {
    stage = makeStage(canvas, { env: true });
  } catch (e) {
    canvas.remove();
    return;
  }
  const { renderer, scene, camera } = stage;
  let visible = true, raf = 0, last = performance.now(), t = 0;
  const ptr = { x: 0, y: 0 }, ptrT = { x: 0, y: 0 };
  const host = canvas.closest("[data-stage-host]") || canvas.parentElement;
  stage.wake = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };
  const api = MODES[mode](stage, canvas);

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.6 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    api.layout();
    if (reduced) render(0);
  };
  const scrollProgress = () => {
    const r = host.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height));
  };
  const render = (dt) => {
    ptr.x = damp(ptr.x, ptrT.x, 3, dt || 0.016);
    ptr.y = damp(ptr.y, ptrT.y, 3, dt || 0.016);
    api.update(t, dt, scrollProgress(), ptr);
    renderer.render(scene, camera);
  };
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    render(dt);
    if (visible && !reduced && !document.hidden) raf = requestAnimationFrame(loop);
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) { last = performance.now(); stage.wake(); }
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { last = performance.now(); stage.wake(); } });
  if (matchMedia("(hover: hover)").matches) {
    host.addEventListener("pointermove", (e) => {
      const r = host.getBoundingClientRect();
      ptrT.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptrT.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (reduced) render(0.016);
    });
    host.addEventListener("pointerleave", () => { ptrT.x = ptrT.y = 0; });
  }
  if (reduced) {
    addEventListener("scroll", () => render(0.016), { passive: true });
    const r = canvas.getBoundingClientRect();
    if (r.width) resize();
    render(0);
  }
  resize();
  stage.wake();
  canvas.classList.add("ready");
}

document.querySelectorAll("canvas[data-scene]").forEach(mount);
