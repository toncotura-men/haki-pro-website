/* =========================================================
   HAKI pro — 3D の舞台（Three.js）
   <canvas data-scene="cosmos|ring|loop|pulse|network|orbit|ball"> を自動で起動する。
   ・cosmos  … トップ。宇宙をスクロールで進む：H が太陽のように集まる → 回る → 四方へ飛ぶ → ロゴ
   ・ring    … ロゴの6色の H が、バラバラから1つの輪に組み上がる（個性 → 組織）
   ・loop    … 企業（青）と子ども（緑）をつなぐ ∞ の循環
   ・pulse   … 6色の輪が心拍のように広がる（健康経営）
   ・network … 人と人が線でつながる（今はどのページでも未使用）
   ・ball    … 指で回せる硬式球（野球スクール）
   画面外・タブ非表示のときは止める。動きを減らす設定では止まった1枚だけ描く。
   ========================================================= */
import * as THREE from "three";
import { RoomEnvironment } from "../vendor/RoomEnvironment.js";
import { EffectComposer } from "../vendor/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../vendor/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../vendor/postprocessing/OutputPass.js";

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

/* 写し取った輪郭は画素の段差でギザギザになるので、角はそのまま残し、
   角と角の間だけをなめらかな曲線にする（形は変えない） */
function smoothOutline(raw) {
  // 1. 段差を間引く（線からのずれが小さい点を省く）
  const rdp = (pts, eps) => {
    if (pts.length < 3) return pts;
    const a = pts[0], b = pts[pts.length - 1];
    let idx = 0, dmax = 0;
    const ab = b.clone().sub(a), len = ab.length() || 1e-9;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs(ab.x * (a.y - pts[i].y) - ab.y * (a.x - pts[i].x)) / len;
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax <= eps) return [a, b];
    return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
  };
  // 閉じた形なので、最初の点から一番遠い点で2つに分けて間引く
  let far = 0;
  raw.forEach((p, i) => { if (p.distanceTo(raw[0]) > raw[far].distanceTo(raw[0])) far = i; });
  let pts = rdp(raw.slice(0, far + 1), 0.0045).slice(0, -1).concat(rdp(raw.slice(far).concat([raw[0]]), 0.0045).slice(0, -1));
  const n = pts.length;
  // 2. 角（向きが大きく変わる点）を探す
  const corner = pts.map((p, i) => {
    const a = p.clone().sub(pts[(i - 1 + n) % n]).normalize();
    const b = pts[(i + 1) % n].clone().sub(p).normalize();
    return Math.acos(clamp(a.dot(b), -1, 1)) > 0.62;
  });
  const start = corner.indexOf(true);
  if (start < 0) return pts;
  pts = pts.slice(start).concat(pts.slice(0, start));
  const isC = corner.slice(start).concat(corner.slice(0, start));
  // 3. 角から角までを1本の曲線に
  const out = [];
  let seg = [pts[0]];
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n];
    seg.push(p);
    if (isC[i % n]) {
      if (seg.length <= 2) out.push(seg[0]);
      else {
        const c = new THREE.SplineCurve(seg);
        const m = Math.max(4, Math.ceil(c.getLength() / 0.008));
        c.getSpacedPoints(m).slice(0, -1).forEach((v) => out.push(v));
      }
      seg = [p];
    }
  }
  return out;
}

let logoGeos;
function logoGeometries() {
  if (logoGeos) return logoGeos;
  logoGeos = LOGO_ORDER.map((name) => {
    const pts = LOGO[name];
    let cx = 0, cy = 0;
    pts.forEach(([x, y]) => { cx += x; cy += y; });
    cx /= pts.length; cy /= pts.length;
    const s = new THREE.Shape();
    smoothOutline(pts.map(([x, y]) => new THREE.Vector2(x - cx, y - cy))).forEach((v, k) => (k ? s.lineTo(v.x, v.y) : s.moveTo(v.x, v.y)));
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.012, bevelSegments: 6, curveSegments: 1 });
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
  /* トップ：宇宙をスクロールで進む。進み具合 p（0〜1）で場面が決まるので、戻せば巻き戻る。
     0    バラバラの H が宇宙に浮かぶ（見出し）
     .10  H が渦を巻いて真ん中へ集まり、太陽が灯る
     .38  集まった H が、それぞれの軌道で互いのまわりを回る
     .56  太陽が縮んで弾け、H が四方へ飛ぶ（衝撃波・光の粒・星が線になる）
     .74  H が戻ってロゴのマークになり、文字が光の筋とともに浮かぶ（Welcome to HAKI pro） */
  cosmos(stage, el) {
    const { renderer, scene, camera } = stage;
    const host = el.closest("[data-cine]");
    const small = innerWidth < 700;
    camera.fov = 38;
    camera.far = 400;
    camera.position.set(0, 0, 10);
    const CAMZ = 10;
    const seg = (p, a, b) => clamp((p - a) / (b - a));
    const ease = (x) => x * x * (3 - 2 * x);
    const easeIn = (x) => x * x * x;
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    const bell = (p, a, m, b) => (p < m ? ease(seg(p, a, m)) : 1 - ease(seg(p, m, b)));
    const rnd = (() => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();

    /* ---- 背景：星雲（画面いっぱいの板） ---- */
    const neb = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      depthWrite: false, depthTest: false,
      uniforms: { uTime: { value: 0 }, uAspect: { value: 1 }, uSun: { value: 0 }, uFlash: { value: 0 }, uWarp: { value: 0 }, uC: { value: new THREE.Vector2() } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }",
      fragmentShader: `
        varying vec2 vUv; uniform float uTime, uAspect, uSun, uFlash, uWarp; uniform vec2 uC;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<5;i++){ v += a*n(p); p = p*2.03 + 17.1; a *= .5; } return v; }
        void main(){
          vec2 p = (vUv - .5) * vec2(uAspect, 1.);
          float t = uTime * .012;
          vec2 q = vec2(fbm(p*1.6 + t), fbm(p*1.6 - t + 4.2));
          float f = fbm(p*2.2 + q*1.8 + vec2(t*2., -t));
          vec3 col = vec3(.004, .006, .018);
          col = mix(col, vec3(.022, .03, .10), smoothstep(.4, .9, f));
          col = mix(col, vec3(.10, .02, .12), smoothstep(.55, .95, q.x * f * 1.4) * .6);
          col = mix(col, vec3(.01, .08, .14), smoothstep(.6, .95, q.y * f * 1.3) * .5);
          vec2 c = p - uC;
          float d = length(c);
          col += vec3(1., .62, .30) * uSun * .16 * exp(-d * 3.);
          col += vec3(.3, .4, .9) * uWarp * .12 * smoothstep(.2, 1.2, d);
          col *= .75 + .25 * smoothstep(1.4, .2, length(p));
          col += vec3(1., .96, .9) * uFlash;
          gl_FragColor = vec4(col, 1.);
        }`,
    }));
    neb.frustumCulled = false;
    neb.renderOrder = -10;
    scene.add(neb);

    /* ---- 星：奥から手前へ流れる。速さはスクロールの速さと場面で変わる ---- */
    const NS = small ? 2200 : 4200, RANGE = 120;
    const sp = new Float32Array(NS * 3), ss = new Float32Array(NS), sc = new Float32Array(NS * 3), sph = new Float32Array(NS);
    const tint = [0xffffff, 0xcfe0ff, 0xffe6c4, 0xbfd0ff].map((h) => new THREE.Color(h));
    const pc = PALETTE.map((h) => new THREE.Color(h));
    for (let i = 0; i < NS; i++) {
      const r = 2.5 + Math.pow(rnd(), 0.6) * 60, a = rnd() * Math.PI * 2;
      sp.set([Math.cos(a) * r, Math.sin(a) * r * 0.75, rnd() * RANGE], i * 3);
      ss[i] = 0.5 + Math.pow(rnd(), 4) * 3.2;
      const c = rnd() < 0.08 ? pc[i % 6] : tint[i % 4];
      sc.set([c.r, c.g, c.b], i * 3);
      sph[i] = rnd() * 6.28;
    }
    const starUniforms = { uTravel: { value: 0 }, uTime: { value: 0 }, uPix: { value: 1 }, uStreak: { value: 0 }, uAlpha: { value: 1 } };
    const starVS = `
      attribute float aSize, aPh, aEnd; attribute vec3 aCol;
      uniform float uTravel, uTime, uPix, uStreak;
      varying vec3 vCol; varying float vA;
      void main(){
        vec3 p = position;
        p.z = mod(p.z + uTravel, ${RANGE.toFixed(1)}) - ${(RANGE - 12).toFixed(1)};
        p.z -= aEnd * uStreak;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float dz = -mv.z;
        gl_PointSize = clamp(aSize * uPix * 70. / dz, 1.2 * uPix, 10. * uPix);
        float tw = .65 + .35 * sin(uTime * (1.5 + aSize) + aPh);
        vA = tw * smoothstep(${RANGE.toFixed(1)}, ${(RANGE * 0.55).toFixed(1)}, dz) * smoothstep(.5, 4., dz);
        vCol = aCol;
      }`;
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    sgeo.setAttribute("aSize", new THREE.BufferAttribute(ss, 1));
    sgeo.setAttribute("aCol", new THREE.BufferAttribute(sc, 3));
    sgeo.setAttribute("aPh", new THREE.BufferAttribute(sph, 1));
    sgeo.setAttribute("aEnd", new THREE.BufferAttribute(new Float32Array(NS), 1));
    const stars = new THREE.Points(sgeo, new THREE.ShaderMaterial({
      uniforms: starUniforms, vertexShader: starVS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      fragmentShader: `varying vec3 vCol; varying float vA; uniform float uAlpha;
        void main(){ vec2 c = gl_PointCoord - .5; float d = length(c);
          float a = smoothstep(.5, .0, d); a = a*a + smoothstep(.12, .0, d);
          gl_FragColor = vec4(vCol * 1.6, a * vA * uAlpha); }`,
    }));
    stars.frustumCulled = false;
    scene.add(stars);
    /* 光の線（ワープのとき） */
    const NL = small ? 500 : 1100;
    const lp = new Float32Array(NL * 6), lc = new Float32Array(NL * 6), le = new Float32Array(NL * 2), lsz = new Float32Array(NL * 2), lph = new Float32Array(NL * 2);
    for (let i = 0; i < NL; i++) {
      for (let k = 0; k < 2; k++) {
        lp.set(sp.subarray(i * 3, i * 3 + 3), (i * 2 + k) * 3);
        lc.set(sc.subarray(i * 3, i * 3 + 3), (i * 2 + k) * 3);
        le[i * 2 + k] = k; lsz[i * 2 + k] = ss[i]; lph[i * 2 + k] = sph[i];
      }
    }
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute("position", new THREE.BufferAttribute(lp, 3));
    lgeo.setAttribute("aCol", new THREE.BufferAttribute(lc, 3));
    lgeo.setAttribute("aEnd", new THREE.BufferAttribute(le, 1));
    lgeo.setAttribute("aSize", new THREE.BufferAttribute(lsz, 1));
    lgeo.setAttribute("aPh", new THREE.BufferAttribute(lph, 1));
    const lineMat = new THREE.ShaderMaterial({
      uniforms: starUniforms, vertexShader: starVS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      fragmentShader: "varying vec3 vCol; varying float vA; uniform float uAlpha; void main(){ gl_FragColor = vec4(vCol * 1.4, vA * uAlpha); }",
    });
    const streaks = new THREE.LineSegments(lgeo, lineMat);
    streaks.frustumCulled = false;
    scene.add(streaks);

    /* ---- 太陽：表面がうごめく球＋6色の光の筋＋かさ ---- */
    const core = new THREE.Group();
    scene.add(core);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHeat: { value: 1 } },
      vertexShader: "varying vec3 vN, vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
      fragmentShader: `varying vec3 vN, vP; uniform float uTime, uHeat;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float n(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
          return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
                     mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          vec3 p = vP * 3.2 + vec3(0., 0., uTime * .25);
          float g = n(p) * .55 + n(p * 2.1 + uTime * .1) * .3 + n(p * 4.3) * .15;
          float rim = pow(1. - abs(vN.z), 2.);
          vec3 col = mix(vec3(1., .55, .18), vec3(1., .93, .7), smoothstep(.35, .8, g));
          col = mix(col, vec3(1., 1., .96), (1. - rim) * .55);
          gl_FragColor = vec4(col * (1.05 + rim * .7) * uHeat, 1.);
        }`,
    }));
    core.add(sun);
    const glowTex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 256;
      const g = c.getContext("2d"), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.18, "rgba(255,240,215,.75)");
      grd.addColorStop(0.45, "rgba(255,170,90,.22)"); grd.addColorStop(1, "rgba(255,120,60,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    core.add(halo);
    const rays = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uK: { value: 0 }, uCols: { value: pc } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
      fragmentShader: `varying vec2 vUv; uniform float uTime, uK; uniform vec3 uCols[6];
        void main(){
          vec2 p = vUv * 2. - 1.; float r = length(p); float a = atan(p.y, p.x);
          float s = (a + 3.14159265) / 6.2831853 * 6.;
          int i = int(floor(mod(s - uTime * .05, 6.)));
          vec3 col = uCols[0];
          for (int k = 1; k < 6; k++) if (k == i) col = uCols[k];
          float beams = pow(abs(sin(a * 9. + uTime * .3)), 18.) + .6 * pow(abs(sin(a * 23. - uTime * .2)), 40.);
          float fall = smoothstep(1., .12, r) * smoothstep(.0, .14, r);
          gl_FragColor = vec4(mix(col, vec3(1.), .35) * beams * fall * uK, 1.);
        }`,
    }));
    core.add(rays);

    /* 衝撃波の輪 */
    const shock = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uR: { value: 0 }, uA: { value: 0 }, uCols: { value: pc } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
      fragmentShader: `varying vec2 vUv; uniform float uR, uA; uniform vec3 uCols[6];
        void main(){
          vec2 p = vUv * 2. - 1.; float r = length(p); float a = (atan(p.y, p.x) + 3.14159265) / 6.2831853 * 6.;
          int i = int(floor(a)); float f = fract(a);
          vec3 c0 = uCols[0], c1 = uCols[1];
          for (int k = 0; k < 6; k++) { if (k == i) c0 = uCols[k]; if (k == int(mod(float(i + 1), 6.))) c1 = uCols[k]; }
          vec3 col = mix(c0, c1, smoothstep(.3, 1., f));
          float ring = exp(-pow((r - uR) / .035, 2.)) + .35 * exp(-pow((r - uR * .82) / .09, 2.));
          gl_FragColor = vec4(mix(col, vec3(1.), .2) * ring * uA * 1.3 * smoothstep(1., .9, r), 1.);
        }`,
    }));
    scene.add(shock);

    /* はじける光の粒（向き・速さは固定なので、スクロールを戻すと戻る） */
    const NB = small ? 900 : 1800;
    const bp = new Float32Array(NB * 3), bdir = [], bc = new Float32Array(NB * 3);
    for (let i = 0; i < NB; i++) {
      const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, (rnd() * 2 - 1) * 0.6 + 0.25).normalize();
      bdir.push(d.multiplyScalar(0.35 + Math.pow(rnd(), 0.5)));
      const c = rnd() < 0.35 ? new THREE.Color(0xfff4e0) : pc[i % 6];
      bc.set([c.r, c.g, c.b], i * 3);
    }
    const bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute("position", new THREE.BufferAttribute(bp, 3));
    bgeo.setAttribute("color", new THREE.BufferAttribute(bc, 3));
    const burstMat = new THREE.PointsMaterial({ size: 0.16, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const burst = new THREE.Points(bgeo, burstMat);
    burst.frustumCulled = false;
    scene.add(burst);

    /* ---- 6つの H ---- */
    const geos = logoGeometries();
    const H = PALETTE.map((hex, i) => {
      const mat = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.28, metalness: 0.05, clearcoat: 0.45, clearcoatRoughness: 0.18, emissive: hex, emissiveIntensity: 0.1, envMapIntensity: 0.5 });
      const m = new THREE.Mesh(geos[i].geo, mat);
      const c = geos[i].center;
      scene.add(m);
      // 光の尾
      const TR = 90;
      const tp = new Float32Array(TR * 3), tc = new Float32Array(TR * 3);
      const base = new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.25);
      for (let k = 0; k < TR; k++) { const f = Math.pow(1 - k / TR, 1.6); tc.set([base.r * f, base.g * f, base.b * f], k * 3); }
      const tg = new THREE.BufferGeometry();
      tg.setAttribute("position", new THREE.BufferAttribute(tp, 3));
      tg.setAttribute("color", new THREE.BufferAttribute(tc, 3));
      const trail = new THREE.Points(tg, new THREE.PointsMaterial({ size: 0.22, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      trail.frustumCulled = false;
      scene.add(trail);
      const ang = Math.atan2(c.y, c.x);
      return {
        m, mat, trail, tp, tg, TR, primed: false,
        home: new THREE.Vector3(c.x, c.y, 0), ang,
        spinQ: new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 1.1, (rnd() - 0.5) * 1.1, rnd() * 6)),
        tilt: new THREE.Euler((i - 2.5) * 0.32, 0, (((i * 2) % 6) - 2.5) * 0.3),
        orbitR: 1.5 + (i % 3) * 0.28,
        out: new THREE.Vector3(Math.cos(ang) * 1.4, Math.sin(ang) * 1.1, 0.9 + (i % 3) * 0.5).normalize(),
        back: new THREE.Vector3(-Math.sin(ang * 1.7) * 1.2, Math.cos(ang * 1.3), -0.6).normalize(),
        ph: rnd() * 6.28,
      };
    });
    /* 最初の画面での置き場所（画面の割合 x,y と奥行き z）。見出しの右側と上に散らす */
    const SCAT_W = [[0.58, 0.5, -3], [0.92, 0.12, -6], [0.68, -0.38, 1], [0.2, 0.74, -9], [0.97, -0.66, -2], [0.36, 0.1, -14]];
    const SCAT_P = [[-0.55, 0.78, -3], [0.6, 0.62, -6], [0.1, 0.34, 1], [-0.7, 0.22, -9], [0.75, 0.08, -2], [-0.15, 0.9, -14]];

    /* ---- ロゴ（Welcome to HAKI pro）：マークは H が戻ってきて作る。文字は光の筋で浮かぶ ---- */
    // ロゴ画像（logo-haki.png）の比率どおり：マークの直径 2、文字は幅 8.27・中心はマークから右へ 5.89
    const LOGO_W = 11.02, MARK_X = -4.51, WORD_X = 1.377, WORD_W = 8.27;
    const wordTex = new THREE.TextureLoader().load("assets/img/wordmark-white.png", (t) => { t.anisotropy = renderer.capabilities.getMaxAnisotropy(); });
    wordTex.colorSpace = THREE.SRGBColorSpace;
    const word = new THREE.Mesh(new THREE.PlaneGeometry(WORD_W, WORD_W * 290 / 2308), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTex: { value: wordTex }, uReveal: { value: 0 }, uTime: { value: 0 }, uCols: { value: pc } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
      fragmentShader: `varying vec2 vUv; uniform sampler2D uTex; uniform float uReveal, uTime; uniform vec3 uCols[6];
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          float a = texture2D(uTex, vUv).a;
          float edge = uReveal * 1.35 - .15;
          float k = vUv.x + (n(vUv * vec2(18., 5.)) - .5) * .16;
          float shown = smoothstep(edge, edge - .03, k);
          float band = exp(-pow((k - edge) / .035, 2.)) * step(.001, uReveal) * (1. - smoothstep(.9, 1., uReveal));
          float s = clamp(vUv.x * 6., 0., 5.999); int i = int(s);
          vec3 c = uCols[0]; for (int j = 1; j < 6; j++) if (j == i) c = uCols[j];
          vec3 col = vec3(.93) * shown + mix(c, vec3(1.), .35) * band * 1.8;
          float alpha = a * clamp(shown + band, 0., 1.);
          gl_FragColor = vec4(col * alpha, alpha);
        }`,
      premultipliedAlpha: true,
    }));
    word.material.blending = THREE.CustomBlending;
    word.material.blendSrc = THREE.OneFactor;
    word.material.blendDst = THREE.OneMinusSrcAlphaFactor;
    scene.add(word);
    const logoHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0x7f8cff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    scene.add(logoHalo);

    /* ---- 光のにじみ（ブルーム） ---- */
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.42, 0.84);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    /* ---- 毎フレームの計算 ---- */
    let travel = 0, lastP = 0, pS = 0, theta = 0;
    const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), q = new THREE.Quaternion(), qz = new THREE.Quaternion(), flat = new THREE.Quaternion();
    const Z = new THREE.Vector3(0, 0, 1), qa = new THREE.Quaternion(), ea = new THREE.Euler();
    const L = { v: null, portrait: false, C: new THREE.Vector3(), R: 1, S: 1, logo: new THREE.Vector3() };
    const proj = new THREE.Vector3();

    const rawP = () => {
      if (!host) return 0;
      const r = host.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - innerHeight));
    };

    return {
      layout() {
        camera.position.set(0, 0, CAMZ);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        const v = viewHalf(camera);
        L.v = v;
        L.portrait = camera.aspect < 0.9;
        L.R = L.portrait ? Math.min(v.w * 0.62, v.h * 0.3) : Math.min(v.h * 0.4, v.w * 0.3);
        L.C.set(0, L.portrait ? v.h * 0.1 : v.h * 0.06, 0);
        L.S = Math.min((2 * v.w * (L.portrait ? 0.8 : 0.5)) / LOGO_W, v.h * 0.16);
        L.logo.set(0, L.portrait ? v.h * 0.02 : 0, 0);
        neb.material.uniforms.uAspect.value = camera.aspect;
      },
      resize(w, h, dpr) {
        composer.setPixelRatio(dpr);
        composer.setSize(w, h);
        bloom.resolution.set(w * dpr * 0.5, h * dpr * 0.5);
        starUniforms.uPix.value = dpr;
      },
      render() { composer.render(); },
      update(t, dt, _s, ptr) {
        // site.js がなめらかにした進み具合をそのまま使う（文字と 3D をそろえる）。無いときだけ自分でなめらかに
        if (reduced) pS = 0;
        else if (typeof window.__cineP === "number") pS = window.__cineP;
        else pS = damp(pS, rawP(), 6, dt || 0.016);
        const p = pS;
        const vel = Math.abs(p - lastP) / Math.max(dt, 0.001);
        lastP = p;
        const { v, C, R, S } = L;

        // 場面ごとの量
        const g = ease(seg(p, 0.08, 0.34));          // 集まる
        const sunK = ease(seg(p, 0.14, 0.34)) * (1 - ease(seg(p, 0.52, 0.6)));
        const o = ease(seg(p, 0.38, 0.5));           // 互いのまわりを回る
        const spin = seg(p, 0.36, 0.58);
        const b = seg(p, 0.57, 0.7);                 // 四方へ飛ぶ
        const flash = bell(p, 0.55, 0.6, 0.67);
        const warp = bell(p, 0.56, 0.65, 0.8);
        const r = easeOut(seg(p, 0.72, 0.86));       // 戻ってロゴに
        const wordK = seg(p, 0.8, 0.94);
        const arrive = bell(p, 0.3, 0.345, 0.42);    // 集まりきった瞬間の光

        // 星と背景
        travel += dt * (1.1 + Math.min(vel, 3) * 18 + warp * 140);
        starUniforms.uTravel.value = travel;
        starUniforms.uTime.value = t;
        starUniforms.uStreak.value = warp * 22 + Math.min(vel, 2) * 3;
        lineMat.opacity = 1;
        streaks.visible = warp > 0.01 || vel > 0.25;
        starUniforms.uAlpha.value = 1;
        const nu = neb.material.uniforms;
        nu.uTime.value = t;
        nu.uSun.value = sunK * (1 + o * 0.6) + r * 0.25;
        nu.uFlash.value = flash * 0.1;
        nu.uWarp.value = warp;
        proj.copy(C).project(camera);
        nu.uC.value.set(proj.x * 0.5 * camera.aspect, proj.y * 0.5);

        // カメラ：回る場面で少し回り込み、ワープで画角が広がる
        const yaw = Math.sin(spin * Math.PI) * 0.42 * (1 - b);
        const pitch = Math.sin(spin * Math.PI) * 0.18;
        const dist = CAMZ - g * 0.8 + b * 1.2 - r * 1.2;
        camera.position.set(C.x + Math.sin(yaw) * dist + ptr.x * 0.35, C.y + Math.sin(pitch) * dist - ptr.y * 0.25, Math.cos(yaw) * dist);
        camera.lookAt(C.x * (1 - r) + L.logo.x * r, C.y * (1 - r) + L.logo.y * r, 0);
        camera.fov = 38 + warp * 26;
        camera.updateProjectionMatrix();

        // 太陽
        const pulse = reduced ? 0 : Math.sin(t * 2.4) * 0.04;
        const sunSize = R * (0.2 * sunK * (1 + o * 0.3 + pulse) + flash * 0.06);
        // H より少し奥に置き、光が H の色に重なって白く飛ばないように
        camera.getWorldDirection(tmp);
        core.position.copy(C).addScaledVector(tmp, R * 0.9);
        core.quaternion.copy(camera.quaternion);
        sun.scale.setScalar(Math.max(0.0001, sunSize));
        sun.visible = sunSize > 0.002;
        sun.material.uniforms.uTime.value = t;
        sun.material.uniforms.uHeat.value = 1 + o * 0.3 + flash;
        halo.scale.setScalar(R * (1.1 * sunK + 1.3 * flash + 0.6 * arrive) + 0.0001);
        halo.material.opacity = Math.min(1, sunK * 0.55 + flash * 0.5 + arrive * 0.4);
        rays.scale.setScalar(R * (2.1 + o * 0.6 + flash * 1.2));
        rays.material.uniforms.uK.value = sunK * (0.18 + o * 0.3) + flash * 0.45;
        rays.material.uniforms.uTime.value = t;

        // 衝撃波と光の粒
        shock.position.copy(C);
        shock.quaternion.copy(camera.quaternion);
        shock.scale.setScalar(R * 7);
        const sw = seg(p, 0.585, 0.72);
        shock.material.uniforms.uR.value = easeOut(sw) * 0.95;
        shock.material.uniforms.uA.value = sw > 0 && sw < 1 ? Math.pow(1 - sw, 1.4) : 0;
        shock.visible = sw > 0 && sw < 1;
        const bk = seg(p, 0.585, 0.78);
        burst.visible = bk > 0 && bk < 1;
        if (burst.visible) {
          const rr = easeOut(bk) * R * 6;
          for (let i = 0; i < NB; i++) {
            const d = bdir[i];
            bp[i * 3] = C.x + d.x * rr; bp[i * 3 + 1] = C.y + d.y * rr; bp[i * 3 + 2] = d.z * rr * 1.4;
          }
          bgeo.attributes.position.needsUpdate = true;
          burstMat.opacity = Math.pow(1 - bk, 1.2);
          burstMat.size = R * 0.07 * (1 + bk);
        }

        // 6つの H
        if (!reduced) theta -= dt * (0.12 + o * 0.5 + arrive * 0.6);
        qz.setFromAxisAngle(Z, theta);
        H.forEach((h, i) => {
          // ① 散らばった場所
          const sc = L.portrait ? SCAT_P[i] : SCAT_W[i];
          const depthK = (CAMZ - sc[2]) / CAMZ;
          const bob = reduced ? 0 : Math.sin(t * 0.7 + h.ph) * 0.12;
          const A = tmp.set(sc[0] * v.w * depthK, sc[1] * v.h * depthK + bob, sc[2]);
          let scale = R * 0.8;
          q.copy(h.spinQ);
          if (!reduced) q.multiply(qa.setFromEuler(ea.set(Math.sin(t * 0.3 + h.ph) * 0.35, Math.sin(t * 0.22 + h.ph * 2) * 0.5, t * 0.08)));
          // ② 渦を巻いて輪へ
          const homeW = tmp2.copy(h.home).applyQuaternion(qz).multiplyScalar(R).add(C);
          if (reduced) { A.copy(h.home).multiplyScalar(R * 0.8); A.x += L.portrait ? 0 : v.w * 0.52; A.y += L.portrait ? v.h * 0.36 : v.h * 0.06; scale = R * 0.8; q.identity(); }
          else if (g > 0) {
            const ax = A.x - C.x, ay = A.y - C.y;
            const r0 = Math.hypot(ax, ay), a0 = Math.atan2(ay, ax);
            const hx = homeW.x - C.x, hy = homeW.y - C.y;
            const r1 = Math.hypot(hx, hy);
            let a1 = Math.atan2(hy, hx);
            while (a1 < a0) a1 += Math.PI * 2;
            a1 += Math.PI * 2;
            const gr = easeOut(g);
            const aa = a0 + (a1 - a0) * g, rad = r0 + (r1 - r0) * gr;
            A.set(C.x + Math.cos(aa) * rad, C.y + Math.sin(aa) * rad, A.z * (1 - gr));
            scale = R * (0.8 + 0.2 * g);
            q.slerp(qz, ease(g));
          }
          // ③ 互いのまわりを回る（傾いた軌道）
          if (o > 0) {
            const a = h.ang + theta * 2.2 + spin * Math.PI * 3;
            const tq = new THREE.Quaternion().setFromEuler(h.tilt);
            const O = new THREE.Vector3(Math.cos(a) * h.orbitR, 0, Math.sin(a) * h.orbitR);
            O.applyQuaternion(tq.slerp(flat, 0.15)).multiplyScalar(R).add(C);
            A.lerp(O, o);
            const face = new THREE.Quaternion().copy(camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(Z, a * 0.5 + Math.sin(t + h.ph) * 0.2));
            q.slerp(face, o);
          }
          // ④ 四方へ飛ぶ
          if (b > 0) {
            const k = easeIn(b);
            A.addScaledVector(h.out, k * R * 16);
            q.multiply(new THREE.Quaternion().setFromAxisAngle(h.out, b * 4));
          }
          // ⑤ 戻ってロゴのマークに
          if (r > 0) {
            const M = new THREE.Vector3(MARK_X + h.home.x, h.home.y, 0).multiplyScalar(S).add(L.logo);
            const from = M.clone().addScaledVector(h.back, R * 9);
            const k = r;
            const Pp = from.lerp(M, k);
            A.lerp(Pp, Math.min(1, r * 4));
            scale = scale + (S - scale) * r;
            q.slerp(flat, r);
          }
          h.m.position.copy(A);
          h.m.quaternion.copy(q);
          h.m.scale.setScalar(scale);
          h.m.visible = b < 0.999 || r > 0;
          h.mat.emissiveIntensity = 0.1 + g * 0.08 + o * 0.16 + arrive * 0.25 + flash * 0.4 - r * 0.04;
          // 光の尾（位置の履歴）
          if (!h.primed || reduced) { for (let k = 0; k < h.TR; k++) h.tp.set([A.x, A.y, A.z], k * 3); h.primed = true; }
          else { h.tp.copyWithin(3, 0, (h.TR - 1) * 3); h.tp.set([A.x, A.y, A.z], 0); }
          h.tg.attributes.position.needsUpdate = true;
          h.trail.visible = h.m.visible && b < 0.6;
          h.trail.material.opacity = Math.min(1, vel * 3) * (1 - r) * (1 - seg(b, 0, 0.5));
          h.trail.material.size = scale * 0.4;
        });

        // ロゴの文字
        word.position.set(L.logo.x + WORD_X * S, L.logo.y - 0.05 * S, 0);
        word.scale.setScalar(S);
        word.visible = wordK > 0;
        word.material.uniforms.uReveal.value = wordK;
        word.material.uniforms.uTime.value = t;
        logoHalo.position.copy(L.logo);
        logoHalo.scale.set(LOGO_W * S * 1.6, LOGO_W * S * 0.7, 1);
        logoHalo.material.opacity = r * 0.22;

        // 光のにじみ
        bloom.strength = 0.45 + sunK * 0.25 + o * 0.15 + flash * 0.4 + arrive * 0.3;
        bloom.threshold = 0.96 - flash * 0.15;

        // 「WELCOME TO」を置く高さ（ロゴの上の端の画面位置）を HTML へ
        if (host && wordK > 0) {
          proj.set(L.logo.x, L.logo.y + S * 1.0, 0).project(camera);
          host.style.setProperty("--logo-top", ((1 - proj.y) * 50).toFixed(2) + "%");
        }
      },
    };
  },

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
    /* data-light="plain" なら白い光（野球スクールの入口は黄緑の光） */
    const plain = el.dataset.light === "plain";
    const spot = new THREE.PointLight(plain ? 0xffffff : 0xff8a3d, plain ? 8 : 14, 10);
    spot.position.set(-2.5, 1.5, 2);
    scene.add(spot);

    /* 指で回す（横の動きだけ奪う。縦はページのスクロール） */
    const spin = reduced ? 0 : parseFloat(el.dataset.spin || "0.6"); // 何もしないときの回る速さ（data-spin で変えられる）
    const vel = { x: 0, y: spin };
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
          vel.y = damp(vel.y, spin, 1.4, dt);
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
    const dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? (mode === "cosmos" ? 1.5 : 1.6) : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    if (api.resize) api.resize(r.width, r.height, dpr);
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
    if (api.render) api.render();
    else renderer.render(scene, camera);
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
