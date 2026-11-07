/* Monde 3D : lac à reflets, ciel physique, berges boisées, montagnes, bassin de régate
   (lignes de bouées, panneaux de distance, arche d'arrivée), bateaux de couple avec
   rameur animé, kraken. Les jeux décrivent l'état (bateaux, bouées…) ; le monde dessine. */
import * as THREE from './vendor/three/three.module.min.js';
import { Water } from './vendor/three/Water.js';
import { Sky } from './vendor/three/Sky.js';

const LANE = 13;          // écart entre couloirs (m)
const CHUNK = 400;        // longueur d'un tronçon de berge (m)
const SHORE = 58;         // demi-largeur du lac (m)

/* ---------- bruit déterministe ---------- */
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
function bankHeight(x, z) {
  const az = Math.abs(z), side = z > 0 ? 1 : -1;
  const d = az - SHORE;                         // distance à la rive
  if (d < -6) return -3;
  const base = Math.max(0, d) * 0.07 + Math.max(0, d - 60) * 0.25;
  const n = fbm(x * 0.008 + side * 31, az * 0.01) * (6 + Math.max(0, d) * 0.35);
  return -1.6 + Math.min(1, (d + 6) / 14) * 2.2 + base + n * Math.min(1, (d + 6) / 30);
}

/* Normales d'eau générées (texture répétable), pas besoin d'image externe. */
function waterNormals() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  const waves = [];
  for (let i = 0; i < 14; i++) waves.push({ kx: Math.round((Math.random() * 2 - 1) * 9), ky: Math.round((Math.random() * 2 - 1) * 9) || 1, a: 0.3 + Math.random(), p: Math.random() * 6.28 });
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let dx = 0, dy = 0;
    for (const w of waves) { const ph = (w.kx * x + w.ky * y) / N * 6.2832 + w.p, cs = Math.cos(ph) * w.a; dx += cs * w.kx; dy += cs * w.ky; }
    const nx = -dx * 0.03, ny = -dy * 0.03, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * N + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/* ---------- bateau + rameur ---------- */
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function limb(r, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 1, 8), mat);
  m.castShadow = true; return m;
}
function placeLimb(m, a, b) {
  tmpA.subVectors(b, a); const len = tmpA.length();
  m.position.copy(a).addScaledVector(tmpA, 0.5);
  m.scale.set(1, Math.max(0.001, len), 1);
  m.quaternion.setFromUnitVectors(UP, tmpA.normalize());
}
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const seg = (t, a, b) => smooth((t - a) / (b - a));

function makeBoat(opt) {
  const g = new THREE.Group();
  const ghost = !!opt.ghost;
  const mk = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.45, metalness: 0.05 }, ghost ? { transparent: true, opacity: 0.38, depthWrite: false } : {}, extra || {}));
  // coque effilée
  const hullGeo = new THREE.BoxGeometry(8.2, 0.22, 0.34, 40, 1, 2);
  const pos = hullGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / 4.1, taper = Math.max(0.04, 1 - Math.pow(Math.abs(x), 2.2));
    pos.setZ(i, pos.getZ(i) * taper);
    if (pos.getY(i) < 0) pos.setY(i, pos.getY(i) * (0.4 + 0.6 * taper));
  }
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, mk(opt.hull || 0x1b1f24, { roughness: 0.25, metalness: 0.2 }));
  hull.position.y = 0.06; hull.castShadow = true; g.add(hull);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.03, 0.12), mk(opt.accent || 0xffffff));
  stripe.position.set(0, 0.18, 0); g.add(stripe);
  // portants
  const metal = mk(0xb9c2c9, { metalness: 0.8, roughness: 0.3 });
  for (const s of [-1, 1]) {
    const r = limb(0.015, metal); placeLimb(r, new THREE.Vector3(-0.05, 0.2, s * 0.12), new THREE.Vector3(-0.15, 0.36, s * 0.8)); g.add(r);
    const r2 = limb(0.015, metal); placeLimb(r2, new THREE.Vector3(-0.45, 0.2, s * 0.12), new THREE.Vector3(-0.15, 0.36, s * 0.8)); g.add(r2);
  }
  // rameur
  const suit = mk(opt.suit || 0x14181d), skin = mk(opt.skin || 0xc68c62, { roughness: 0.7 }), trim = mk(opt.accent || 0x2fd47a);
  const parts = {
    torso: limb(0.13, suit), neck: limb(0.05, skin),
    thighL: limb(0.075, suit), thighR: limb(0.075, suit), shinL: limb(0.055, skin), shinR: limb(0.055, skin),
    uarmL: limb(0.045, suit), uarmR: limb(0.045, suit), farmL: limb(0.038, skin), farmR: limb(0.038, skin),
    oarL: limb(0.018, mk(0x111111, { roughness: 0.3 })), oarR: limb(0.018, mk(0x111111, { roughness: 0.3 })),
    gripL: limb(0.022, trim), gripR: limb(0.022, trim)
  };
  Object.values(parts).forEach(p => g.add(p));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin); head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12, 0, 6.3, 0, 1.4), mk(0x1a120c)); g.add(hair);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.26), mk(0x2a2f36)); g.add(seat);
  const bladeGeo = new THREE.BoxGeometry(0.5, 0.2, 0.02);
  const bladeMat = mk(opt.accent || 0x2fd47a, { roughness: 0.4 });
  const bladeL = new THREE.Mesh(bladeGeo, bladeMat), bladeR = new THREE.Mesh(bladeGeo, bladeMat);
  g.add(bladeL, bladeR);
  // étiquette (nom au-dessus du bateau)
  let tag = null;
  if (opt.label) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d'); x.font = '600 34px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(10,20,30,.55)'; const w = Math.min(250, x.measureText(opt.label).width + 34);
    x.beginPath(); x.roundRect((256 - w) / 2, 6, w, 52, 26); x.fill();
    x.fillStyle = '#fff'; x.fillText(opt.label, 128, 33);
    tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    tag.scale.set(2.4, 0.6, 1); tag.position.set(0, 2.1, 0); tag.renderOrder = 10; g.add(tag);
  }

  const J = {}; for (const k of ['hip', 'knee', 'foot', 'sh', 'hand', 'elbow', 'neckTop']) J[k] = new THREE.Vector3();
  const pivot = { L: new THREE.Vector3(-0.15, 0.38, -0.8), R: new THREE.Vector3(-0.15, 0.38, 0.8) };

  /* Pose selon la phase (0-0.5 poussée, 0.5-1 retour). Le rameur regarde vers l'arrière (-x). */
  function pose(p) {
    let legs, back, arms, inWater;
    if (p < 0.5) { const t = p / 0.5; legs = seg(t, 0, 0.6); back = seg(t, 0.25, 0.8); arms = seg(t, 0.55, 1); inWater = t < 0.97; }
    else { const t = (p - 0.5) / 0.5; arms = 1 - seg(t, 0, 0.3); back = 1 - seg(t, 0.15, 0.5); legs = 1 - seg(t, 0.35, 1); inWater = false; }
    const seatX = 0.05 + legs * 0.6;                       // chariot : 0.05 (attaque) → 0.65 (dégagé)
    J.foot.set(-0.62, 0.2, 0); J.hip.set(seatX, 0.36, 0);
    const dFH = J.hip.x - J.foot.x, thigh = 0.46, shin = 0.46;
    const half = Math.min(dFH / 2, thigh - 0.001), kneeUp = Math.sqrt(Math.max(0, thigh * thigh - half * half));
    J.knee.set(J.foot.x + dFH / 2, 0.3 + kneeUp, 0);
    const lean = -0.55 + back * 0.85;                      // penché vers l'avant (-x) puis en arrière
    J.sh.set(J.hip.x + Math.sin(lean) * 0.58, J.hip.y + Math.cos(lean) * 0.58, 0);
    J.neckTop.set(J.sh.x + Math.sin(lean) * 0.12, J.sh.y + Math.cos(lean) * 0.12, 0);
    // mains : bras tendus à l'attaque, ramenées au buste à la fin
    const reach = 0.62 - arms * 0.45;
    J.hand.set(J.sh.x - reach, J.sh.y - 0.22 + arms * 0.06 + (inWater ? 0.05 : -0.05), 0);
    J.elbow.set((J.sh.x + J.hand.x) / 2 + arms * 0.12, (J.sh.y + J.hand.y) / 2 - 0.12 - arms * 0.05, 0);
    return inWater;
  }
  const side = (v, z) => tmpB.set(v.x, v.y, z);
  function update(p) {
    const inWater = pose(p);
    placeLimb(parts.torso, J.hip, J.sh); placeLimb(parts.neck, J.sh, J.neckTop);
    head.position.set(J.neckTop.x + 0.02, J.neckTop.y + 0.08, 0); hair.position.copy(head.position); hair.position.x += 0.012;
    seat.position.set(J.hip.x, 0.29, 0);
    for (const [s, z] of [['L', -0.13], ['R', 0.13]]) {
      const hip = J.hip.clone(); hip.z = z * 0.8; const knee = J.knee.clone(); knee.z = z; const foot = J.foot.clone(); foot.z = z;
      placeLimb(parts['thigh' + s], hip, knee); placeLimb(parts['shin' + s], knee, foot);
      const sh = J.sh.clone(); sh.z = z * 1.25; const el = J.elbow.clone(); el.z = z * 1.7; const hd = J.hand.clone(); hd.z = z * 0.9;
      placeLimb(parts['uarm' + s], sh, el); placeLimb(parts['farm' + s], el, hd);
      // aviron : poignée → dame de nage → pelle
      const pv = pivot[s], dir = pv.clone().sub(hd).normalize();
      const handleIn = hd.clone().addScaledVector(dir, -0.08);
      const blade = pv.clone().addScaledVector(dir, 2.0);
      blade.y = inWater ? -0.08 : 0.28;
      const d2 = blade.clone().sub(pv).normalize(); const bladeEnd = pv.clone().addScaledVector(d2, 2.05);
      placeLimb(parts['oar' + s], handleIn, bladeEnd);
      placeLimb(parts['grip' + s], handleIn, hd.clone().addScaledVector(dir, 0.1));
      const bl = s === 'L' ? bladeL : bladeR;
      bl.position.copy(bladeEnd).addScaledVector(d2, -0.2);
      bl.lookAt(bl.position.clone().add(new THREE.Vector3(-d2.z, 0, d2.x)));
      bl.rotateY(Math.PI / 2);
      if (!inWater) bl.rotateX(Math.PI / 2 * 0.9);  // pelle « plumée » au retour
    }
    return inWater;
  }
  update(0.999);
  g.userData = { update, wasIn: false };
  return g;
}

/* ---------- kraken ---------- */
function makeKraken() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5b1f3d, roughness: 0.55, metalness: 0.1, emissive: 0x16030b });
  const body = new THREE.Mesh(new THREE.SphereGeometry(3.4, 32, 20, 0, 6.3, 0, 1.7), mat); body.scale.set(1.3, 0.9, 1.1); body.position.y = -0.6; g.add(body);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffa400, emissiveIntensity: 1.4 });
  for (const z of [-1.4, 1.4]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), eyeM); e.position.set(3.2, 1.6, z); g.add(e); }
  const tentacles = [];
  for (let i = 0; i < 8; i++) {
    const arm = []; const a = (i / 8) * Math.PI * 2;
    for (let k = 0; k < 14; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.62 - k * 0.04, 12, 10), mat); s.castShadow = true; g.add(s); arm.push(s); }
    tentacles.push({ arm, a });
  }
  g.userData.update = (t) => {
    tentacles.forEach((T, i) => {
      const bx = Math.cos(T.a) * 2.6 + 1.5, bz = Math.sin(T.a) * 2.6;
      T.arm.forEach((s, k) => {
        const f = k / 13, w = t * 2.2 + i * 0.8 - k * 0.35;
        s.position.set(bx + f * 4 + Math.sin(w) * f * 1.6, -0.3 + Math.sin(f * Math.PI) * (4 + Math.sin(w * 0.7) * 1.5), bz * (1 + f * 0.4) + Math.cos(w) * f * 1.2);
      });
    });
    body.position.y = -0.6 + Math.sin(t * 1.7) * 0.25;
  };
  return g;
}

/* ---------- le monde ---------- */
const World = {
  ready: false, camMode: 0,
  init(container) {
    if (this.ready) { container.appendChild(this.renderer.domElement); return; }
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.5;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xa9c9db, 700, 3600);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 6000);

    // ciel physique + soleil
    const sky = new Sky(); sky.scale.setScalar(10000); scene.add(sky);
    const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(72), THREE.MathUtils.degToRad(200));
    Object.assign(sky.material.uniforms, {});
    sky.material.uniforms.turbidity.value = 2.5; sky.material.uniforms.rayleigh.value = 1.8;
    sky.material.uniforms.mieCoefficient.value = 0.004; sky.material.uniforms.mieDirectionalG.value = 0.8;
    sky.material.uniforms.sunPosition.value.copy(sun);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const skyScene = new THREE.Scene(); const skyClone = new Sky(); skyClone.scale.setScalar(10000); skyClone.material.uniforms = sky.material.uniforms; skyScene.add(skyClone);
    scene.environment = pmrem.fromScene(skyScene).texture;

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3d5a3a, 1.1); scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff1dc, 2.6); dir.position.copy(sun).multiplyScalar(80);
    dir.castShadow = true; dir.shadow.mapSize.set(1024, 1024);
    Object.assign(dir.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 220 });
    scene.add(dir, dir.target);

    // lac
    const water = new Water(new THREE.PlaneGeometry(5000, 1400), {
      textureWidth: 512, textureHeight: 512, waterNormals: waterNormals(),
      sunDirection: sun.clone().normalize(), sunColor: 0xffffff, waterColor: 0x0b3a4a, distortionScale: 0.9, fog: true, alpha: 1
    });
    water.material.uniforms.size.value = 1.1;
    water.rotation.x = -Math.PI / 2; scene.add(water);
    // eau économique (sans rendu de reflet supplémentaire) pour les appareils lents
    const cheapWater = new THREE.Mesh(new THREE.PlaneGeometry(5000, 1400), new THREE.MeshStandardMaterial({ color: 0x14495a, roughness: 0.12, metalness: 0.85, envMapIntensity: 1.1 }));
    cheapWater.rotation.x = -Math.PI / 2; cheapWater.visible = false; scene.add(cheapWater);

    // montagnes lointaines (suivent la caméra en x)
    const far = new THREE.Group(); scene.add(far);
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    for (const s of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(6000, 900, 120, 18); geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position, col = [];
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), zz = p.getZ(i) + 450;            // 0 (près) → 900 (loin)
        const h = Math.pow(fbm(x * 0.0016 + s * 9, zz * 0.002), 1.8) * 520 * Math.min(1, zz / 250) + zz * 0.12;
        p.setY(i, h - 20);
        const snow = h > 300, rock = h > 150;
        const c = snow ? [0.93, 0.95, 0.98] : rock ? [0.47, 0.47, 0.5] : [0.24, 0.36, 0.25];
        col.push(...c);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, rockMat); m.position.z = s * (SHORE + 520 + 450); if (s < 0) m.rotation.y = Math.PI;
      far.add(m);
    }

    // berges (tronçons recyclés)
    const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6); trunkGeo.translate(0, 1.1, 0);
    const pineGeo = new THREE.ConeGeometry(1.7, 6.5, 8); pineGeo.translate(0, 5, 0);
    const pine2Geo = new THREE.ConeGeometry(1.25, 4.2, 8); pine2Geo.translate(0, 7.6, 0);
    const leafGeo = new THREE.IcosahedronGeometry(2.4, 1); leafGeo.translate(0, 4.2, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 1 });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x24472c, roughness: 0.9, flatShading: true });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4d7a35, roughness: 0.9, flatShading: true });
    const chunks = new Map();
    const makeChunk = (k) => {
      const grp = new THREE.Group(); const x0 = k * CHUNK;
      for (const s of [-1, 1]) {
        const geo = new THREE.PlaneGeometry(CHUNK, 420, 50, 52); geo.rotateX(-Math.PI / 2);
        const p = geo.attributes.position, col = [];
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i) + x0 + CHUNK / 2, z = s * (SHORE - 10 + (p.getZ(i) + 210));
          const h = bankHeight(x, z); p.setY(i, h); p.setX(i, x); p.setZ(i, z);
          const c = h < 0.4 ? [0.62, 0.56, 0.42] : h < 18 ? [0.25 + hash(x, z) * 0.05, 0.42, 0.2] : h < 40 ? [0.33, 0.38, 0.27] : [0.5, 0.5, 0.5];
          col.push(...c);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        if (s < 0) { const ix = geo.index.array; for (let j = 0; j < ix.length; j += 3) { const t = ix[j]; ix[j] = ix[j + 2]; ix[j + 2] = t; } }
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, groundMat); m.receiveShadow = true; grp.add(m);
      }
      // forêt
      const spots = [];
      for (let i = 0; i < 520; i++) {
        const s = hash(k * 7.1 + i, 3.3) > 0.5 ? 1 : -1;
        const x = x0 + hash(k, i * 1.7) * CHUNK, z = s * (SHORE + 4 + Math.pow(hash(i, k * 2.3), 1.6) * 240);
        const h = bankHeight(x, z);
        if (h < 0.8 || h > 45) continue;
        spots.push({ x, z, h, kind: hash(x, z) > 0.72 ? 1 : 0, sc: 0.7 + hash(z, x) * 0.8 });
      }
      const pines = spots.filter(s => !s.kind), leafy = spots.filter(s => s.kind);
      const mk = (geo, mat, list) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); im.count = list.length; im.castShadow = false; return im; };
      const iT = mk(trunkGeo, trunkMat, spots), iP = mk(pineGeo, pineMat, pines), iP2 = mk(pine2Geo, pineMat, pines), iL = mk(leafGeo, leafMat, leafy);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
      spots.forEach((s, i) => { M.compose(P.set(s.x, s.h - 0.2, s.z), Q, S.setScalar(s.sc)); iT.setMatrixAt(i, M); });
      pines.forEach((s, i) => { M.compose(P.set(s.x, s.h - 0.2, s.z), Q, S.setScalar(s.sc)); iP.setMatrixAt(i, M); iP2.setMatrixAt(i, M); });
      leafy.forEach((s, i) => { M.compose(P.set(s.x, s.h - 0.2, s.z), Q, S.setScalar(s.sc)); iL.setMatrixAt(i, M); });
      grp.add(iT, iP, iP2, iL);
      // ponton + hangar à bateaux au départ
      if (k === 0) {
        const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.9 });
        const dock = new THREE.Mesh(new THREE.BoxGeometry(30, 0.4, 5), wood); dock.position.set(-12, 0.25, -SHORE + 3); grp.add(dock);
        const shed = new THREE.Mesh(new THREE.BoxGeometry(22, 7, 12), new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.8 })); shed.position.set(-12, 3.5, -SHORE - 9); grp.add(shed);
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 9, 4, 4, 1), new THREE.MeshStandardMaterial({ color: 0x8b2e2a, roughness: 0.7 })); roof.rotation.y = Math.PI / 4; roof.scale.set(1.7, 1, 1); roof.position.set(-12, 9, -SHORE - 9); grp.add(roof);
      }
      scene.add(grp); return grp;
    };
    this._syncChunks = (cx) => {
      const k0 = Math.floor(cx / CHUNK);
      const want = new Set([k0 - 1, k0, k0 + 1, k0 + 2, k0 + 3]);
      for (const [k, grp] of chunks) if (!want.has(k)) { scene.remove(grp); grp.traverse(o => { if (o.geometry && o.isMesh && !o.isInstancedMesh) o.geometry.dispose(); }); chunks.delete(k); }
      for (const k of want) if (!chunks.has(k)) chunks.set(k, makeChunk(k));
    };

    // bassin : lignes de bouées, panneaux, arrivée
    const buoyGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const buoys = new THREE.InstancedMesh(buoyGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), 600);
    buoys.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600 * 3), 3); scene.add(buoys);
    const signMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const signs = [];
    for (let i = 0; i < 4; i++) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const tex = new THREE.CanvasTexture(c);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3), signMat); post.position.y = -2.2; m.add(post);
      m.userData = { c, tex, val: null }; scene.add(m); signs.push(m);
    }
    const finish = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xd8312b, roughness: 0.5 });
    for (const z of [-1, 1]) { const tw = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), red); tw.position.set(0, 4.5, z * 40); finish.add(tw); }
    const fc = document.createElement('canvas'); fc.width = 1024; fc.height = 128; const fx = fc.getContext('2d');
    for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { fx.fillStyle = (i + j) % 2 ? '#111' : '#fff'; fx.fillRect(i * 32, j * 32, 32, 32); }
    fx.fillStyle = '#d8312b'; fx.fillRect(320, 16, 384, 96); fx.fillStyle = '#fff'; fx.font = '800 64px system-ui'; fx.textAlign = 'center'; fx.textBaseline = 'middle'; fx.fillText('ARRIVÉE', 512, 66);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(80, 3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), side: THREE.DoubleSide }));
    banner.rotation.y = Math.PI / 2; banner.position.y = 8; finish.add(banner);
    finish.visible = false; scene.add(finish);

    // bouées-cibles du mini-jeu
    const targetMat = new THREE.MeshStandardMaterial({ color: 0xffb300, emissive: 0xff8a00, emissiveIntensity: 0.35, roughness: 0.35 });
    const targets = []; for (let i = 0; i < 8; i++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), targetMat.clone()); t.visible = false; scene.add(t); targets.push(t); }

    // ronds dans l'eau à chaque attaque
    const rings = []; const ringGeo = new THREE.RingGeometry(0.5, 0.62, 32); ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) { const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); r.position.y = 0.03; scene.add(r); rings.push({ m: r, t: 9 }); }
    let ringIdx = 0;
    this._ripple = (x, z) => { const r = rings[ringIdx++ % rings.length]; r.m.position.x = x; r.m.position.z = z; r.t = 0; };

    const kraken = makeKraken(); kraken.visible = false; scene.add(kraken);
    // tentacule qui agrippe le bateau
    const grabArm = [];
    const armMat = new THREE.MeshStandardMaterial({ color: 0x6a2347, roughness: 0.5, emissive: 0x16030b });
    for (let i = 0; i < 26; i++) { const sph = new THREE.Mesh(new THREE.SphereGeometry(0.42 - i * 0.012, 10, 8), armMat); sph.visible = false; scene.add(sph); grabArm.push(sph); }
    this.grabArm = grabArm;

    Object.assign(this, { cheapWater, renderer, scene, camera, water, far, buoys, signs, finish, targets, rings, kraken, dir, boats: new Map(), camPos: new THREE.Vector3(-8, 2.5, 9), camLook: new THREE.Vector3() });
    this.ready = true;
    // qualité : 2 = haute, 1 = moyenne, 0 = économique. Départ moyen sur mobile, puis ajustement auto.
    const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    this._ft = 1 / 60; this._qT = 0;
    this.setQuality(+(localStorage.getItem('rj-quality') ?? (mobile ? 1 : 2)));
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  setQuality(q) {
    q = Math.max(0, Math.min(2, q | 0)); this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio([Math.min(0.85, dpr), Math.min(1.25, dpr), Math.min(1.75, dpr)][q]);
    this.renderer.shadowMap.enabled = q === 2;
    this.dir.castShadow = q === 2;
    this.water.visible = q > 0; this.cheapWater.visible = q === 0;
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    try { localStorage.setItem('rj-quality', q); } catch (e) {}
    this.resize();
    if (this.onQuality) this.onQuality(q);
  },

  resize() {
    if (!this.renderer) return;
    const el = this.renderer.domElement.parentElement; if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  },

  reset() {
    for (const b of this.boats.values()) this.scene.remove(b);
    this.boats.clear();
    this.kraken.visible = false; this.finish.visible = false; this.targets.forEach(t => t.visible = false);
  },

  cycleCamera() { this.camMode = (this.camMode + 1) % 3; return ['Caméra : côté', 'Caméra : arrière', 'Caméra : drone'][this.camMode]; },

  /* state = { boats:[{id,d,lane,phase,me,ghost,label,hull,suit,accent}], finish, targets:[{x,hit}], kraken } */
  render(state, dt) {
    if (!this.ready) return;
    const t = performance.now() / 1000;
    const me = state.boats.find(b => b.me) || state.boats[0];
    const mx = me ? me.d : 0, mz = me ? me.lane * LANE : 0;
    // bateaux
    const seen = new Set();
    for (const b of state.boats) {
      seen.add(b.id);
      let obj = this.boats.get(b.id);
      if (!obj) { obj = makeBoat(b); this.boats.set(b.id, obj); this.scene.add(obj); }
      obj.position.set(b.d, 0, b.lane * LANE);
      const inWater = obj.userData.update(b.phase);
      // tangage léger synchronisé sur le geste
      obj.rotation.z = Math.sin(b.phase * Math.PI * 2) * 0.012;
      obj.position.y = Math.sin(t * 1.3 + b.lane) * 0.02;
      if (inWater && !obj.userData.wasIn && !b.ghost) { this._ripple(b.d - 0.1 + 0.0, b.lane * LANE - 2.6); this._ripple(b.d - 0.1, b.lane * LANE + 2.6); }
      obj.userData.wasIn = inWater;
    }
    for (const [id, obj] of this.boats) if (!seen.has(id)) { this.scene.remove(obj); this.boats.delete(id); }
    this.rings.forEach(r => { r.t += dt; const k = r.t / 1.6; r.m.scale.setScalar(1 + k * 4); r.m.material.opacity = Math.max(0, 0.45 * (1 - k)); });

    // bouées de couloirs autour de la caméra
    const lanes = state.laneCount || 1, lo = state.laneMin != null ? state.laneMin : 0;
    let n = 0; const M = new THREE.Matrix4(), C = new THREE.Color();
    const start = Math.floor((mx - 40) / 12.5) * 12.5;
    for (let L = lo; L <= lo + lanes; L++) {
      const z = (L - 0.5) * LANE;
      if (Math.abs(z - mz) < 7 && this.camMode === 0) continue; // pas de bouées entre la caméra et toi
      for (let x = start; x < mx + 260 && n < 600; x += 12.5) {
        M.makeTranslation(x, 0.05 + Math.sin(t * 2 + x) * 0.03, z);
        this.buoys.setMatrixAt(n, M);
        C.set(x % 250 === 0 ? 0xff3b30 : (x % 100 === 0 ? 0xffd60a : 0xffffff)); this.buoys.setColorAt(n, C); n++;
      }
    }
    this.buoys.count = n; this.buoys.instanceMatrix.needsUpdate = true; if (this.buoys.instanceColor) this.buoys.instanceColor.needsUpdate = true;

    // panneaux tous les 100 m
    const base = Math.ceil((mx - 30) / 100) * 100;
    this.signs.forEach((s, i) => {
      const v = base + i * 100; s.position.set(v, 3.2, (lo - 0.5) * LANE - 6); s.rotation.y = 0.35;
      if (s.userData.val !== v) {
        s.userData.val = v; const x = s.userData.c.getContext('2d');
        x.clearRect(0, 0, 256, 128); x.fillStyle = 'rgba(12,24,34,.85)'; x.beginPath(); x.roundRect(4, 4, 248, 120, 18); x.fill();
        x.fillStyle = '#fff'; x.font = '800 64px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(state.finish ? Math.max(0, state.finish - v) + ' m' : v + ' m', 128, 66);
        s.userData.tex.needsUpdate = true;
      }
      s.visible = v >= 0 && (!state.finish || v <= state.finish);
    });
    if (state.finish) { this.finish.visible = true; this.finish.position.set(state.finish, 0, ((lo + lanes - 1) / 2) * LANE); } else this.finish.visible = false;

    // cibles
    this.targets.forEach((tg, i) => {
      const it = state.targets && state.targets[i];
      if (!it) { tg.visible = false; return; }
      tg.visible = true;
      tg.position.set(it.x, 0.45 + Math.sin(t * 3 + i) * 0.12, mz + 3.2);
      if (it.hit) { const k = Math.min(1, (t - it.hitAt) / 0.5); tg.scale.setScalar(1 + k * 2); tg.material.opacity = 1 - k; tg.material.transparent = true; }
      else if (it.missed) { tg.material.color.set(0x55606a); tg.material.emissiveIntensity = 0; tg.scale.setScalar(1); }
      else { tg.scale.setScalar(1); tg.material.opacity = 1; tg.material.transparent = false; tg.material.color.set(0xffb300); tg.material.emissiveIntensity = 0.35 + Math.sin(t * 6) * 0.2; }
    });

    // kraken
    if (state.kraken != null) { this.kraken.visible = true; this.kraken.position.set(state.kraken, 0, mz); this.kraken.userData.update(t); }
    else this.kraken.visible = false;
    const grab = state.grab && state.kraken != null;
    this.grabArm.forEach((s, i) => {
      s.visible = grab; if (!grab) return;
      const f = i / (this.grabArm.length - 1), x0 = state.kraken + 3.5, x1 = mx - 3.9;
      const w = Math.sin(t * 6 + f * 5) * 0.25 * (1 - f);
      s.position.set(x0 + (x1 - x0) * f, 0.3 + Math.sin(f * Math.PI) * 4.2 + w, mz + Math.sin(f * 7 + t * 3) * 0.5 * (1 - f));
    });
    // vent de face : eau agitée
    const dist = state.wind > 0 ? 3.2 : state.wind < 0 ? 0.5 : 0.9;
    this.water.material.uniforms.distortionScale.value += (dist - this.water.material.uniforms.distortionScale.value) * Math.min(1, dt);

    // caméra
    const speed = me ? me.speed || 0 : 0;
    const modes = [
      [new THREE.Vector3(mx - 3.8, 1.55, mz + 5.6), new THREE.Vector3(mx + 0.9, 0.75, mz)],
      [new THREE.Vector3(mx - 11 - speed * 0.6, 2.8, mz + 1.2), new THREE.Vector3(mx + 12, 0.6, mz)],
      [new THREE.Vector3(mx - 14, 16, mz + 16), new THREE.Vector3(mx + 6, 0, mz)]
    ];
    if (state.kraken != null && this.camMode === 0) {
      // caméra devant le bateau, tournée vers l'arrière : on voit le kraken arriver
      const gap = Math.min(45, Math.max(4, mx - state.kraken));
      modes[0][0].set(mx + 10, 2.8 + gap * 0.05, mz + 9 + gap * 0.2); modes[0][1].set(mx - gap * 0.42, 1.2, mz);
    }
    const [cp, cl] = modes[this.camMode];
    const k = 1 - Math.exp(-dt * 6);
    this.camPos.lerp(cp, k); this.camLook.lerp(cl, k);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);

    this.water.position.x = mx; this.water.material.uniforms.time.value = t * 0.6; this.cheapWater.position.x = mx;
    // Ajustement automatique : si l'image tombe sous ~45 i/s pendant 2 s, on baisse la qualité.
    this._ft += (dt - this._ft) * 0.05; this._qT += dt;
    if (this._qT > 2 && this._ft > 1 / 45 && this.quality > 0) { this._qT = 0; this.setQuality(this.quality - 1); }
    this.far.position.x = mx;
    this.dir.position.set(mx + 30, 70, 40); this.dir.target.position.set(mx, 0, mz);
    this._syncChunks(mx);
    this.renderer.render(this.scene, this.camera);
  }
};

World.LANE = LANE;
window.World = World;
window.dispatchEvent(new Event('world-ready'));
