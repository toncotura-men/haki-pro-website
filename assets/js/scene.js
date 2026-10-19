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
  // ロゴの色をそのまま出すため、色を丸める処理（トーンマッピング）は使わない
  renderer.toneMapping = THREE.NoToneMapping;
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

/* ---------- ロゴの H のかたち ----------
   会社ロゴ（6色の H の輪）の輪郭を、元画像から1つずつ写し取った座標。
   輪の外周の半径を 1、中心を (0,0) にそろえてある。形は変えずに厚みだけ付ける */
const LOGO = {"red":[[-0.0942,0.5373],[-0.0912,0.5342],[0.077,0.5342],[0.1389,0.6265],[0.1449,0.6315],[0.1591,0.6315],[0.1743,0.6234],[0.1824,0.6234],[0.2078,0.6133],[0.2179,0.6032],[0.1581,0.5292],[0.1571,0.516],[0.1713,0.5069],[0.1794,0.5059],[0.2504,0.4724],[0.2889,0.4511],[0.3527,0.4045],[0.3669,0.4025],[0.4541,0.4532],[0.5676,0.5008],[0.6659,0.5302],[0.7024,0.5342],[0.7328,0.5424],[0.7622,0.5424],[0.7703,0.5474],[0.7896,0.5505],[0.8169,0.5505],[0.824,0.5545],[0.824,0.5586],[0.7683,0.6366],[0.7064,0.7055],[0.6284,0.7765],[0.5716,0.817],[0.5514,0.818],[0.5108,0.8049],[0.448,0.7765],[0.4216,0.7603],[0.4105,0.7603],[0.3416,0.7978],[0.3385,0.8069],[0.3446,0.814],[0.4632,0.8718],[0.4672,0.8799],[0.446,0.894],[0.4379,0.894],[0.4075,0.9082],[0.4014,0.9143],[0.3912,0.9153],[0.3811,0.9224],[0.375,0.9224],[0.3304,0.9427],[0.3213,0.9427],[0.2696,0.963],[0.2341,0.963],[0.1601,0.9143],[0.1105,0.8738],[0.0598,0.8231],[0.0203,0.7755],[-0.0213,0.7136],[-0.0527,0.6528],[-0.078,0.591]],"purple":[[0.4196,0.3498],[0.4166,0.3376],[0.4602,0.2738],[0.4987,0.1998],[0.6122,0.1937],[0.6233,0.1815],[0.6355,0.1207],[0.6304,0.1157],[0.5331,0.1288],[0.5281,0.1278],[0.523,0.1207],[0.5301,0.0721],[0.5301,-0.0688],[0.526,-0.0901],[0.5291,-0.1144],[0.6375,-0.1793],[0.7054,-0.231],[0.7896,-0.311],[0.8412,-0.3698],[0.8879,-0.4337],[0.8929,-0.4337],[0.901,-0.4246],[0.9223,-0.38],[0.9223,-0.3708],[0.9507,-0.3039],[0.9791,-0.1945],[0.9791,-0.1813],[0.9912,-0.1276],[0.9923,-0.0911],[0.9872,-0.0718],[0.97,-0.0546],[0.8666,0.0204],[0.8615,0.0498],[0.8595,0.1065],[0.8635,0.1116],[0.8777,0.1075],[0.9811,0.0366],[0.9933,0.0336],[0.9953,0.0802],[0.9912,0.0974],[0.9912,0.1319],[0.975,0.2221],[0.9608,0.2565],[0.9517,0.2707],[0.9244,0.294],[0.8828,0.3143],[0.8118,0.3427],[0.7906,0.3457],[0.7835,0.3508],[0.7743,0.3508],[0.7379,0.363],[0.6882,0.3711],[0.5777,0.3751],[0.5676,0.3711],[0.52,0.3711],[0.4662,0.363]],"navy":[[0.5098,-0.1874],[0.5027,-0.1864],[0.4683,-0.2583],[0.4227,-0.3273],[0.4247,-0.3384],[0.4733,-0.4296],[0.4713,-0.4438],[0.4237,-0.4914],[0.4176,-0.4925],[0.4125,-0.4874],[0.3791,-0.3992],[0.373,-0.3901],[0.3679,-0.3901],[0.3172,-0.4306],[0.2716,-0.46],[0.1895,-0.5016],[0.1723,-0.5046],[0.1652,-0.5107],[0.1652,-0.6313],[0.1612,-0.6455],[0.1612,-0.6769],[0.1571,-0.684],[0.1531,-0.7317],[0.149,-0.7377],[0.1449,-0.7671],[0.1287,-0.8219],[0.1287,-0.833],[0.0882,-0.9394],[0.0679,-0.9769],[0.0699,-0.9901],[0.1419,-0.9861],[0.152,-0.982],[0.1703,-0.982],[0.1784,-0.9779],[0.1946,-0.9779],[0.2027,-0.9739],[0.2341,-0.9698],[0.2919,-0.9536],[0.297,-0.9496],[0.3081,-0.9496],[0.373,-0.9252],[0.4267,-0.8999],[0.4318,-0.8948],[0.4358,-0.8756],[0.448,-0.7428],[0.4703,-0.7235],[0.521,-0.6911],[0.5301,-0.6972],[0.525,-0.831],[0.5291,-0.8381],[0.5453,-0.834],[0.6162,-0.7833],[0.6659,-0.7418],[0.7146,-0.6931],[0.7156,-0.6273],[0.7075,-0.5685],[0.7034,-0.5594],[0.7034,-0.5442],[0.6993,-0.5381],[0.6993,-0.5249],[0.6953,-0.5178],[0.6953,-0.5046],[0.671,-0.4296],[0.6456,-0.3719],[0.6,-0.2938],[0.5493,-0.2279]],"blue":[[-0.821,-0.5543],[-0.8199,-0.5665],[-0.8047,-0.5898],[-0.7601,-0.6465],[-0.7145,-0.6962],[-0.6476,-0.759],[-0.6395,-0.7621],[-0.6041,-0.7935],[-0.5625,-0.8198],[-0.5463,-0.8188],[-0.4247,-0.7621],[-0.4074,-0.7631],[-0.3446,-0.7904],[-0.3365,-0.7996],[-0.3395,-0.8077],[-0.4622,-0.8705],[-0.4622,-0.8786],[-0.4571,-0.8847],[-0.4196,-0.905],[-0.3557,-0.9333],[-0.3395,-0.9374],[-0.3314,-0.9435],[-0.2787,-0.9577],[-0.2402,-0.9587],[-0.2067,-0.9455],[-0.149,-0.905],[-0.1064,-0.8695],[-0.0355,-0.7945],[0.0061,-0.7367],[0.0507,-0.6546],[0.075,-0.5979],[0.0912,-0.536],[0.0831,-0.532],[-0.075,-0.533],[-0.0942,-0.5553],[-0.0993,-0.5675],[-0.1388,-0.6252],[-0.1449,-0.6303],[-0.1581,-0.6303],[-0.1703,-0.6232],[-0.2078,-0.6141],[-0.2169,-0.607],[-0.2169,-0.6019],[-0.1591,-0.53],[-0.153,-0.5158],[-0.1682,-0.5056],[-0.1885,-0.5016],[-0.2716,-0.46],[-0.3142,-0.4317],[-0.3568,-0.3962],[-0.3608,-0.3962],[-0.4176,-0.4327],[-0.5007,-0.4732],[-0.5361,-0.4844],[-0.5595,-0.4965],[-0.5959,-0.5046],[-0.6557,-0.5249],[-0.6709,-0.5249],[-0.6983,-0.533],[-0.7601,-0.5411],[-0.7682,-0.5452],[-0.8007,-0.5462]],"green":[[-0.8949,0.4359],[-0.9294,0.3609],[-0.9659,0.2505],[-0.9659,0.2373],[-0.9811,0.1785],[-0.9821,0.1582],[-0.9862,0.1511],[-0.9902,0.0741],[-0.8655,-0.0191],[-0.8605,-0.0333],[-0.8574,-0.1002],[-0.8625,-0.1114],[-0.8777,-0.1073],[-0.9841,-0.0354],[-0.9933,-0.0374],[-0.9943,-0.0789],[-0.9902,-0.0962],[-0.9902,-0.1235],[-0.9862,-0.1296],[-0.9862,-0.1509],[-0.9821,-0.157],[-0.9821,-0.1702],[-0.9659,-0.234],[-0.9659,-0.2472],[-0.9558,-0.2715],[-0.9405,-0.2837],[-0.898,-0.305],[-0.8919,-0.305],[-0.8311,-0.3333],[-0.7287,-0.3617],[-0.7105,-0.3617],[-0.6993,-0.3658],[-0.6395,-0.3729],[-0.5676,-0.3729],[-0.4986,-0.3658],[-0.4916,-0.3617],[-0.45,-0.3577],[-0.4216,-0.3496],[-0.4176,-0.3425],[-0.4216,-0.3303],[-0.4551,-0.2837],[-0.4926,-0.2107],[-0.5007,-0.2016],[-0.5372,-0.1965],[-0.6111,-0.1935],[-0.6223,-0.1823],[-0.6345,-0.1408],[-0.6355,-0.1195],[-0.6304,-0.1134],[-0.6081,-0.1144],[-0.5757,-0.1225],[-0.527,-0.1225],[-0.524,-0.1185],[-0.5372,-0.0252],[-0.5372,0.0305],[-0.5331,0.069],[-0.525,0.1045],[-0.526,0.1146],[-0.6061,0.1592],[-0.7054,0.2332],[-0.751,0.2748],[-0.8098,0.3356],[-0.8595,0.3954],[-0.8747,0.4187],[-0.8919,0.4369]],"yellow":[[-0.0689,0.9934],[-0.1257,0.9913],[-0.1439,0.9853],[-0.1763,0.9832],[-0.1855,0.9782],[-0.2199,0.9751],[-0.2443,0.966],[-0.2696,0.963],[-0.2797,0.9559],[-0.3334,0.9427],[-0.3405,0.9356],[-0.3537,0.9346],[-0.3659,0.9265],[-0.4064,0.9133],[-0.4277,0.9011],[-0.4348,0.893],[-0.447,0.742],[-0.5149,0.6984],[-0.528,0.6974],[-0.5341,0.7025],[-0.5331,0.7359],[-0.525,0.7937],[-0.524,0.8383],[-0.528,0.8413],[-0.5493,0.8282],[-0.5605,0.8251],[-0.5676,0.817],[-0.5757,0.815],[-0.6051,0.7897],[-0.6264,0.7765],[-0.6709,0.737],[-0.678,0.7349],[-0.7044,0.7035],[-0.7135,0.6701],[-0.7105,0.5859],[-0.7024,0.5586],[-0.7024,0.5444],[-0.6902,0.4907],[-0.6699,0.4359],[-0.6699,0.4268],[-0.6486,0.3782],[-0.6081,0.3072],[-0.5696,0.2494],[-0.5159,0.1896],[-0.5037,0.1886],[-0.4997,0.1917],[-0.4895,0.216],[-0.4642,0.2636],[-0.4571,0.2697],[-0.4277,0.3295],[-0.4277,0.3427],[-0.449,0.3974],[-0.4672,0.4228],[-0.4693,0.4339],[-0.4642,0.4511],[-0.4358,0.4805],[-0.4247,0.4846],[-0.4135,0.4836],[-0.4074,0.4775],[-0.3943,0.443],[-0.3932,0.4299],[-0.3861,0.4207],[-0.3831,0.4045],[-0.3699,0.3883],[-0.3527,0.3964],[-0.3253,0.4238],[-0.3182,0.4258],[-0.2878,0.4511],[-0.2595,0.4653],[-0.2534,0.4724],[-0.2128,0.4917],[-0.2017,0.4937],[-0.1946,0.5008],[-0.1703,0.5079],[-0.1642,0.5302],[-0.1642,0.594],[-0.1581,0.6761],[-0.1439,0.7674],[-0.1236,0.8434],[-0.1034,0.8951],[-0.1034,0.9052],[-0.0679,0.9853]]};
const LOGO_ORDER = ["red", "purple", "navy", "blue", "green", "yellow"]; // PALETTE と同じ順

let logoGeos;
function logoGeometries() {
  if (logoGeos) return logoGeos;
  logoGeos = LOGO_ORDER.map((name) => {
    const pts = LOGO[name];
    let cx = 0, cy = 0;
    pts.forEach(([x, y]) => { cx += x; cy += y; });
    cx /= pts.length; cy /= pts.length;
    const s = new THREE.Shape();
    pts.forEach(([x, y], k) => (k ? s.lineTo(x - cx, y - cy) : s.moveTo(x - cx, y - cy)));
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.012, bevelSegments: 4, curveSegments: 1 });
    geo.translate(0, 0, -0.08);
    return { geo, center: new THREE.Vector2(cx, cy) };
  });
  return logoGeos;
}

function hPieces(scale = 1) {
  const geos = logoGeometries();
  const group = new THREE.Group();
  const pieces = PALETTE.map((hex, i) => {
    const mat = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.26, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.4 });
    const m = new THREE.Mesh(geos[i].geo, mat);
    const c = geos[i].center;
    m.userData.home = new THREE.Vector3(c.x, c.y, 0);
    m.userData.homeQ = new THREE.Quaternion();
    const dir = new THREE.Vector3(c.x, c.y, (Math.random() - 0.5) * 1.6).normalize();
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
          holder.scale.setScalar(Math.min(v.w * 0.7, v.h * 0.4));
          holder.position.set(0, v.h * 0.36, 0);
        } else {
          holder.scale.setScalar(Math.min(v.h * 0.52, v.w * 0.3));
          holder.position.set(v.w * 0.52, v.h * 0.08, 0);
        }
      },
      update(t, dt, s, ptr) {
        intro = reduced ? 1 : Math.min(1, (performance.now() - born) / 2600);
        pieces.forEach((m, i) => {
          const local = expoOut(clamp((intro - i * 0.07) / 0.58));
          const out = s * 0.9; // スクロールで少し外へ開く
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
    const center = hPieces(0.36);
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

  /* 締めの舞台：6色の H が、それぞれ傾いた軌道を光の尾を引いて回る（原子のような姿）。
     真ん中はガラスの核。スクロールで軌道がそろい、1つの輪にまとまっていく */
  orbit(stage) {
    const { scene, camera } = stage;
    camera.position.z = 9;
    const holder = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), new THREE.MeshPhysicalMaterial({ color: 0xbfd4ff, roughness: 0.08, metalness: 0.1, flatShading: true, transmission: 0.85, thickness: 1.2, ior: 1.5, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, envMapIntensity: 1.4 }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 32), new THREE.MeshBasicMaterial({ color: 0xcfe0ff }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0x9fb4ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(3.2);
    holder.add(glow, core, halo);
    const geos = logoGeometries();
    const TRAIL = 70;
    const orbits = PALETTE.map((hex, i) => {
      const tilt = new THREE.Euler((i - 2.5) * 0.3, 0, (((i * 2) % 6) - 2.5) * 0.28);
      const R = 1.75 + (i % 3) * 0.32;
      const m = new THREE.Mesh(geos[i].geo, new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, emissive: hex, emissiveIntensity: 0.18 }));
      m.scale.setScalar(1.15);
      const pos = new Float32Array(TRAIL * 3), col = new Float32Array(TRAIL * 3);
      const base = new THREE.Color(hex);
      for (let k = 0; k < TRAIL; k++) { const f = 1 - k / TRAIL; col.set([base.r * f, base.g * f, base.b * f], k * 3); }
      const tg = new THREE.BufferGeometry();
      tg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      tg.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const trail = new THREE.Points(tg, new THREE.PointsMaterial({ size: 0.11, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const ringPts = Array.from({ length: 129 }, (_, k) => { const a = (k / 128) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R); });
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
      const plane = new THREE.Group();
      plane.add(ring);
      holder.add(plane, m, trail);
      return { m, trail, pos, plane, tilt, R, speed: 0.5, phase: (i / 6) * Math.PI * 2, tgeo: tg };
    });
    scene.add(holder, dust(420, 3, 9, 0.045));
    const v3 = new THREE.Vector3(), q = new THREE.Quaternion(), flat = new THREE.Quaternion();
    const pointAt = (o, a, mix, out) => {
      out.set(Math.cos(a) * o.R, 0, Math.sin(a) * o.R);
      q.setFromEuler(o.tilt).slerp(flat, mix);
      return out.applyQuaternion(q);
    };
    return {
      layout() {
        const v = viewHalf(camera);
        holder.scale.setScalar(Math.min(v.w, v.h) * 0.36);
      },
      update(t, dt, s, ptr) {
        const mix = clamp(s * 1.6 - 0.2) * 0.85; // スクロールで軌道が水平にそろう
        orbits.forEach((o) => {
          const a = o.phase + (reduced ? 0 : t * o.speed);
          o.plane.quaternion.setFromEuler(o.tilt).slerp(flat, mix);
          pointAt(o, a, mix, v3);
          o.m.position.copy(v3);
          // 面をこちらに向けたまま、少しだけ揺らす（形がいつも読めるように）
          o.m.quaternion.copy(holder.quaternion).invert();
          o.m.rotateZ(-(o.phase + t * o.speed) * 0.5);
          o.m.rotateX(Math.sin(t * 0.8 + o.phase) * 0.25);
          o.m.rotateY(Math.cos(t * 0.6 + o.phase) * 0.25);
          for (let k = 0; k < TRAIL; k++) {
            pointAt(o, a - k * 0.035, mix, v3);
            o.pos[k * 3] = v3.x; o.pos[k * 3 + 1] = v3.y; o.pos[k * 3 + 2] = v3.z;
          }
          o.tgeo.attributes.position.needsUpdate = true;
        });
        const pulse = reduced ? 1 : 1 + Math.sin(t * 2.2) * 0.06;
        glow.scale.setScalar(pulse);
        halo.material.opacity = 0.45 + (pulse - 1) * 2;
        core.rotation.y += dt * 0.3;
        holder.rotation.x = damp(holder.rotation.x, 0.35 - ptr.y * 0.35, 3, dt);
        holder.rotation.y = damp(holder.rotation.y, ptr.x * 0.6, 3, dt);
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
    /* 動かしたら回すだけ、軽く押しただけならリンク（野球スクールへ）として働かせる */
    let moved = 0;
    el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; el.style.cursor = "grabbing"; });
    el.addEventListener("click", (e) => { if (moved > 8) { e.preventDefault(); e.stopPropagation(); } });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const now = performance.now(), dtm = Math.max(1, now - drag.t);
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      moved += Math.abs(dx) + Math.abs(dy);
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
    el.addEventListener("pointerleave", end);
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
