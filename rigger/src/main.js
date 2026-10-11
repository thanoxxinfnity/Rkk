import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = id => document.getElementById(id);

// ---------- visible errors (the page must never fail silently) ----------
function showError(msg) {
  const el = $('errBanner');
  el.textContent = 'Something went wrong: ' + msg + ' (press F12 to see details)';
  el.hidden = false;
  clearTimeout(showError._t);
  showError._t = setTimeout(() => { el.hidden = true; }, 9000);
}
function showFatal(msg) {
  $('fatalMsg').textContent = msg;
  $('fatal').hidden = false;
}
window.addEventListener('error', e => showError(e.message || 'unknown error'));
window.addEventListener('unhandledrejection', e => showError((e.reason && e.reason.message) || String(e.reason)));
const MAX_VERTS = 200000; // soft limit: warn on low-RAM machines

// ---------- renderer: low memory, draws only when something changed ----------
const canvas = $('view');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
} catch (err) {
  showFatal('Your browser could not start 3D graphics (WebGL). Try Chrome or Firefox, turn on "hardware acceleration" in the browser settings, or update the graphics driver.');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12141b);
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
camera.position.set(2.6, 1.9, 3.8);
const orbit = new OrbitControls(camera, canvas);
orbit.target.set(0, 1, 0);
orbit.addEventListener('change', requestRender);
scene.add(new THREE.GridHelper(8, 16, 0x39405a, 0x242936));
scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2f40, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(2, 5, 3);
scene.add(sun);

// Export group: rig + skinned mesh only (grid, markers, grey preview are not exported)
const world = new THREE.Group();
world.name = 'Character';
const rig = new THREE.Group();
rig.name = 'Rig';
world.add(rig);
scene.add(world);
const restGroup = new THREE.Group();   // grey preview of the mesh in Rig mode
scene.add(restGroup);
const markerGroup = new THREE.Group(); // orange joint dots
scene.add(markerGroup);
let helper = null;                     // SkeletonHelper lines

const transform = new TransformControls(camera, canvas);
transform.setSize(0.8);
transform.addEventListener('dragging-changed', e => { orbit.enabled = !e.value; gizmoBusy = e.value; });
transform.addEventListener('objectChange', onGizmoChange);
scene.add(transform);

// ---------- state ----------
let bones = [];                 // THREE.Bone[] (order = skin index)
const keys = new Map();         // bone.uuid -> [{ t, p:[x,y,z], q:[x,y,z,w] }]
let baseGeometry = null;        // mesh geometry (shared by preview and skinned mesh)
let restMesh = null;            // grey preview (Rig mode)
let skinned = null;             // SkinnedMesh (Pose mode, exported)
let selected = null;
let mode = 'rig';
let rigDirty = true;            // bones changed since last bind
let playing = false, playhead = 0, duration = 2;
let clip = null, action = null;
let dirty = true;
let gizmoBusy = false;
let unit = 1;                   // model height / 1.8, scales markers and default bone length
let weightPower = 1;             // weight sharpness: higher = fewer bones per vertex

function requestRender() { dirty = true; }

const mixer = new THREE.AnimationMixer(rig);

// ---------- materials and markers (shared, cheap) ----------
const markerGeo = new THREE.SphereGeometry(0.035, 10, 8);
const mkMat = c => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.95 });
const matCenter = mkMat(0xffa726), matLeft = mkMat(0x4fc3f7), matRight = mkMat(0xff6b81), matSelected = mkMat(0x7cffb2);
const isFinger = n => /^(thumb|index|middle|ring|pinky)\d/.test(n);
const sideMat = n => /L$/.test(n) ? matLeft : /R$/.test(n) ? matRight : matCenter;
function makeMarker(bone) {
  const m = new THREE.Mesh(markerGeo, matCenter);
  m.userData.bone = bone;
  m.renderOrder = 10;
  markerGroup.add(m);
  return m;
}
function updateMarkers() {
  for (const m of markerGroup.children) {
    const b = m.userData.bone;
    m.position.setFromMatrixPosition(b.matrixWorld);
    m.material = b === selected ? matSelected : sideMat(b.name);
    const base = (isFinger(b.name) ? 0.45 : 1) * unit;
    m.scale.setScalar(b === selected ? base * 1.4 : base);
  }
}
function rebuildHelper() {
  if (helper) { scene.remove(helper); helper.geometry.dispose(); helper.material.dispose(); helper = null; }
  if (!bones.length) return;
  helper = new THREE.SkeletonHelper(rig);
  helper.material.depthTest = false;
  helper.renderOrder = 9;
  scene.add(helper);
}

// ---------- render loop: sleeps when idle ----------
let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0;
  lastTs = ts;
  if (playing && clip) {
    playhead = (playhead + dt) % duration;
    applyPlayhead();
    updateTimelineUI();
  }
  if (dirty) {
    dirty = false;
    scene.updateMatrixWorld();
    updateMarkers();
    renderer.render(scene, camera);
  }
}
function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
  requestRender();
}
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);

// ---------- rest pose helpers ----------
function captureRest(b) { b.userData.rest = { p: b.position.toArray(), q: b.quaternion.toArray() }; }
function restoreRest(b) {
  const r = b.userData.rest;
  if (r) { b.position.fromArray(r.p); b.quaternion.fromArray(r.q); }
}

// ---------- bones ----------
function sanitize(s) { return String(s || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40) || 'bone'; }
function uniqueName(base, self = null) {
  const taken = new Set(bones.filter(b => b !== self).map(b => b.name));
  let name = base, n = 2;
  while (taken.has(name)) name = `${base}_${n++}`;
  return name;
}
function addBone({ parent = null, name = 'bone', pos = [0, 0, 0], length = 0.3 * unit, select = true } = {}) {
  const b = new THREE.Bone();
  b.name = uniqueName(sanitize(name));
  b.position.fromArray(pos);
  b.userData.length = length;
  (parent || rig).add(b);
  bones.push(b);
  makeMarker(b);
  captureRest(b);
  rebuildHelper();
  rigDirty = true;
  if (select) selectBone(b); else refreshUI();
  requestRender();
  return b;
}
function addChildBone() {
  if (mode !== 'rig') return toast('Switch to Rig mode (1) to add bones');
  if (selected) addBone({ parent: selected, pos: [0, selected.userData.length ?? 0.3, 0] });
  else {
    const roots = rig.children.filter(c => c.isBone).length;
    addBone({ pos: [roots * 0.4, 0, 0] });
  }
}
function deleteSelected() {
  if (mode !== 'rig') return toast('Switch to Rig mode (1) to delete bones');
  if (!selected) return toast('Select a bone first');
  const doomed = new Set();
  (function collect(b) { doomed.add(b); b.children.filter(c => c.isBone).forEach(collect); })(selected);
  bones = bones.filter(b => !doomed.has(b));
  doomed.forEach(b => keys.delete(b.uuid));
  for (const m of [...markerGroup.children]) if (doomed.has(m.userData.bone)) markerGroup.remove(m);
  selected.parent.remove(selected);
  selected = null;
  transform.detach();
  rigDirty = true;
  rebuildHelper();
  rebuildClip();
  refreshUI();
  requestRender();
}
const collapsed = new Set();      // bone uuids whose children are hidden in the list
let boneFilter = '';
function selectBone(b) {
  selected = b || null;
  for (let p = selected && selected.parent; p && p.isBone; p = p.parent) collapsed.delete(p.uuid);
  if (selected) transform.attach(selected); else transform.detach();
  refreshUI();
  requestRender();
}
function clearRig() {
  collapsed.clear();
  rig.clear();
  markerGroup.clear();
  bones = [];
  keys.clear();
  selected = null;
  transform.detach();
  rebuildHelper();
  rebuildClip();
  rigDirty = true;
}

// ---------- mesh ----------
function normalizeGeo(g) {
  // Keep only position, normal, uv. Drop skin data, colors, tangents to save RAM.
  const out = new THREE.BufferGeometry();
  const pos = g.getAttribute('position');
  out.setAttribute('position', pos.clone());
  const uv = g.getAttribute('uv');
  out.setAttribute('uv', uv ? uv.clone() : new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2));
  if (g.index) out.setIndex(g.index.clone());
  const n = g.getAttribute('normal');
  if (n) out.setAttribute('normal', n.clone()); else out.computeVertexNormals();
  return out;
}
function mergeAll(list) {
  const merged = mergeGeometries(list, false);
  list.forEach(g => g.dispose());
  return merged;
}
function capsule(a, b, r) {
  const A = new THREE.Vector3(a[0], a[1], a[2]), B = new THREE.Vector3(b[0], b[1], b[2]);
  const dir = B.clone().sub(A);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, Math.max(len, 1e-4), 8, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), len > 1e-6 ? dir.normalize() : new THREE.Vector3(0, 1, 0)));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}
const DEMO = { H: 1.8, minY: 0, cx: 0, cz: 0, halfSpan: 0.98 };   // T-pose proportions
function demoGeometry() {
  const { P, L } = humanoidJoints(DEMO);
  const parts = [];
  const cap = (a, b, r) => parts.push(capsule(a, b, r));
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  parts.push(new THREE.BoxGeometry(0.34, P.chest[1] - P.hips[1] + 0.1, 0.2).translate(...mid(P.hips, P.chest)));
  cap(P.neck, P.head, 0.05);
  parts.push(new THREE.SphereGeometry(0.12, 16, 12).translate(P.head[0], P.head[1] + 0.08, P.head[2]));
  for (const k of ['L', 'R']) {
    const sg = k === 'L' ? -1 : 1;
    cap(P['thigh' + k], P['shin' + k], 0.085);
    cap(P['shin' + k], P['foot' + k], 0.07);
    cap(P['foot' + k], P['toe' + k], 0.05);
    cap(P['upperArm' + k], P['foreArm' + k], 0.055);
    cap(P['foreArm' + k], P['hand' + k], 0.05);
    const h = P['hand' + k];
    cap(h, [h[0] + sg * 0.1, h[1], h[2]], 0.045);            // palm
    for (const f of FINGERS) {
      const a = P[`${f}1${k}`], b = P[`${f}2${k}`], c = P[`${f}3${k}`];
      cap(a, b, 0.014);
      cap(b, c, 0.013);
      cap(c, [c[0] + sg * L[`${f}3${k}`], c[1], c[2]], 0.012);
    }
  }
  return mergeAll(parts);
}
function setMesh(geo) {
  if (mode === 'pose') setMode('rig');
  if (restMesh) { restGroup.remove(restMesh); restMesh.material.dispose(); }
  if (skinned) { world.remove(skinned); skinned.material.dispose(); }
  if (baseGeometry && baseGeometry !== geo) baseGeometry.dispose();
  baseGeometry = geo;
  restMesh = new THREE.Mesh(baseGeometry, new THREE.MeshStandardMaterial({
    color: 0x7d88a8, roughness: 0.7, transparent: true, opacity: 0.5, depthWrite: false }));
  skinned = new THREE.SkinnedMesh(baseGeometry, new THREE.MeshStandardMaterial({ color: 0x9aa8d6, roughness: 0.55, metalness: 0.05 }));
  skinned.name = 'Mesh';
  skinned.frustumCulled = false;
  skinned.visible = false;
  world.add(skinned);
  restGroup.add(restMesh);
  rigDirty = true;
  fitCamera(baseGeometry);
  refreshUI();
  requestRender();
}
function fitCamera(geo) {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const sz = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const diag = Math.max(0.5, sz.length());
  unit = Math.max(0.01, sz.y / 1.8);
  // pick a distance so the whole model (height and arm span) fits with some margin
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max((sz.y / 2) / tanV * 1.35, (sz.x / 2) / (tanV * Math.max(0.5, camera.aspect)) * 1.2, diag * 0.5);
  orbit.target.copy(c);
  camera.position.copy(c).add(new THREE.Vector3(0.35, 0.18, 1).normalize().multiplyScalar(dist));
  camera.near = diag * 0.01;
  camera.far = diag * 40;
  camera.updateProjectionMatrix();
  orbit.update();                 // re-aim the camera at the new target
  requestRender();
}

// ---------- auto-weights: each vertex follows the 4 nearest bone segments ----------
function segmentsAtRest() {
  rig.updateMatrixWorld(true);
  const out = new Float64Array(bones.length * 6);
  const h = new THREE.Vector3(), t = new THREE.Vector3(), pp = new THREE.Vector3();
  bones.forEach((b, i) => {
    h.setFromMatrixPosition(b.matrixWorld);
    const child = b.children.find(c => c.isBone);
    if (child) t.setFromMatrixPosition(child.matrixWorld);
    else {
      if (b.parent && b.parent.isBone) { pp.setFromMatrixPosition(b.parent.matrixWorld); t.subVectors(h, pp); }
      else t.set(0, 1, 0);
      if (t.lengthSq() < 1e-8) t.set(0, 1, 0);
      t.normalize().multiplyScalar(b.userData.length ?? 0.3).add(h);
    }
    out.set([h.x, h.y, h.z, t.x, t.y, t.z], i * 6);
  });
  return out;
}
function distSqPointSegment(px, py, pz, s, i) {
  const ax = s[i], ay = s[i + 1], az = s[i + 2];
  const abx = s[i + 3] - ax, aby = s[i + 4] - ay, abz = s[i + 5] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const len2 = abx * abx + aby * aby + abz * abz;
  let t = len2 > 0 ? (apx * abx + apy * aby + apz * abz) / len2 : 0;
  t = Math.min(1, Math.max(0, t));
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}
function bindRig() {
  if (!baseGeometry || !bones.length) return false;
  const seg = segmentsAtRest();
  const pos = baseGeometry.getAttribute('position');
  const n = pos.count, S = bones.length;
  const idx = new Uint16Array(n * 4), wts = new Float32Array(n * 4);
  const bd = new Float64Array(4), bj = new Int32Array(4), w = new Float64Array(4);
  for (let v = 0; v < n; v++) {
    const px = pos.getX(v), py = pos.getY(v), pz = pos.getZ(v);
    bd.fill(Infinity); bj.fill(0);
    for (let s = 0; s < S; s++) {
      const d = distSqPointSegment(px, py, pz, seg, s * 6);
      if (d < bd[3]) {
        let k = 3;
        while (k > 0 && bd[k - 1] > d) { bd[k] = bd[k - 1]; bj[k] = bj[k - 1]; k--; }
        bd[k] = d; bj[k] = s;
      }
    }
    let sum = 0;
    for (let k = 0; k < 4; k++) { w[k] = bd[k] === Infinity ? 0 : 1 / Math.pow(bd[k] + 1e-4, weightPower); sum += w[k]; }
    for (let k = 0; k < 4; k++) {
      idx[v * 4 + k] = bj[k];
      wts[v * 4 + k] = sum > 0 ? w[k] / sum : (k === 0 ? 1 : 0);
    }
  }
  baseGeometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  baseGeometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
  const skeleton = new THREE.Skeleton(bones); // inverses taken from this rest pose
  skinned.bind(skeleton, new THREE.Matrix4());
  rigDirty = false;
  return true;
}

// ---------- modes ----------
function setMode(next) {
  if (next === mode) return;
  if (next === 'pose') {
    if (!bones.length) return toast('Add bones first (Demo character or + Bone)');
    if (!baseGeometry) return toast('Load a mesh first');
    bones.forEach(captureRest);
    if (!bindRig()) return toast('Could not bind the mesh');
    mode = 'pose';
    skinned.visible = true;
    restMesh.visible = false;
    transform.setMode('rotate');
    transform.setSpace('local');
  } else {
    playing = false;
    bones.forEach(restoreRest);
    mode = 'rig';
    if (skinned) skinned.visible = false;
    if (restMesh) restMesh.visible = true;
    transform.setMode('translate');
    transform.setSpace('world');
    applyPlayhead();
  }
  refreshUI();
  requestRender();
}

// ---------- keyframes and clip ----------
function keyAll() {
  if (mode !== 'pose') return toast('Switch to Pose mode (2) to keyframe');
  if (!bones.length) return;
  const t = Math.round(playhead * 1000) / 1000;
  for (const b of bones) {
    let arr = keys.get(b.uuid);
    if (!arr) { arr = []; keys.set(b.uuid, arr); }
    const data = { t, p: b.position.toArray(), q: b.quaternion.toArray() };
    const i = arr.findIndex(k => Math.abs(k.t - t) < 1e-3);
    if (i >= 0) arr[i] = data; else arr.push(data);
  }
  rebuildClip();
  toast(`Keyed ${bones.length} bones at ${t.toFixed(2)} s`);
}
function deleteKeysHere() {
  const t = playhead;
  let removed = 0;
  for (const [uuid, arr] of keys) {
    const kept = arr.filter(k => Math.abs(k.t - t) >= 1e-3);
    removed += arr.length - kept.length;
    keys.set(uuid, kept);
  }
  rebuildClip();
  toast(removed ? `Deleted ${removed} keys` : 'No key at this time');
}
function rebuildClip() {
  const tracks = [];
  for (const b of bones) {
    const arr = keys.get(b.uuid);
    if (!arr || !arr.length) continue;
    const sorted = [...arr].sort((x, y) => x.t - y.t);
    const times = sorted.map(k => k.t);
    tracks.push(new THREE.VectorKeyframeTrack(`${b.name}.position`, times, sorted.flatMap(k => k.p)));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, sorted.flatMap(k => k.q)));
  }
  if (action) { action.stop(); mixer.uncacheClip(clip); action = null; }
  clip = tracks.length ? new THREE.AnimationClip('Take', duration, tracks) : null;
  if (clip) {
    action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat);
    action.play();
    action.paused = true;
  }
  applyPlayhead();
  renderTicks();
  refreshUI();
}
function applyPlayhead() {
  if (action) { action.time = playhead; mixer.update(0); }
  requestRender();
}
function togglePlay() {
  if (mode !== 'pose') return toast('Switch to Pose mode (2) to play');
  if (!clip) return toast('Key a pose first (K)');
  playing = !playing;
  if (action) action.paused = !playing;
  refreshUI();
}
function stopPlay() {
  playing = false;
  playhead = 0;
  applyPlayhead();
  refreshUI();
}

// ---------- export ----------
function exportGLB() {
  if (!skinned || !bones.length) return toast('Need a mesh and at least one bone');
  if (mode !== 'rig') setMode('rig');  // export the rest pose
  if (rigDirty) bindRig();             // weights match current bone positions
  const exporter = new GLTFExporter();
  toast('Exporting…');
  exporter.parse(world, result => {
    const blob = new Blob([result], { type: 'model/gltf-binary' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rigged-character.glb';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast(`Exported ${(blob.size / 1024).toFixed(0)} KB`);
  }, err => toast('Export failed: ' + (err?.message || err)),
  { binary: true, onlyVisible: false, animations: clip ? [clip] : [] });
}

// ---------- import ----------
function importFile(file) {
  const url = URL.createObjectURL(file);
  toast('Loading model…');
  new GLTFLoader().load(url, gltf => {
    URL.revokeObjectURL(url);
    gltf.scene.updateMatrixWorld(true);
    let parts = [];
    gltf.scene.traverse(o => {
      if (o.isMesh && o.geometry) {
        const g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        parts.push(normalizeGeo(g));
      }
    });
    if (!parts.length) return toast('No mesh found in this file');
    if (parts.length > 1 && parts.some(g => g.index) && !parts.every(g => g.index)) {
      parts = parts.map(g => g.index ? g.toNonIndexed() : g);
    }
    const total = parts.reduce((s, g) => s + g.getAttribute('position').count, 0);
    const geo = parts.length === 1 ? parts[0] : mergeAll(parts);
    if (!geo) return toast('Could not merge the meshes in this file');
    setMesh(geo);
    toast(total > MAX_VERTS
      ? `Loaded, but it is heavy (${total.toLocaleString()} vertices). Low-RAM PCs may lag.`
      : `Loaded ${parts.length} mesh(es). Now add bones or click Demo.`);
  }, undefined, err => { URL.revokeObjectURL(url); toast('Could not load: ' + (err?.message || err)); });
}

// ---------- humanoid skeleton from body proportions (used by auto-fit and the demo) ----------
const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const FINGER_Z = [0.45, 0.22, 0, -0.22, -0.4];   // spread across the hand (x hand length)
const FINGER_SEG = [0.45, 0.3, 0.25];            // share of each finger's length per bone
function humanoidJoints({ minY, H, cx, cz, halfSpan }) {
  const P = {}, L = {};                          // P: joint (bone head) positions, L: leaf lengths
  const y = f => minY + f * H;
  const sh = 0.12 * H;                            // shoulder offset from the midline
  const armLen = Math.max(0.3 * H, halfSpan - sh); // shoulder to hand tip (T-pose)
  const upper = armLen * 0.43, fore = armLen * 0.34, hand = armLen * 0.23;
  const hipX = 0.09 * H;
  P.hips = [cx, y(0.52), cz];
  P.spine = [cx, y(0.62), cz];
  P.chest = [cx, y(0.72), cz];
  P.neck = [cx, y(0.82), cz];
  P.head = [cx, y(0.84), cz]; L.head = 0.14 * H;
  for (const s of [-1, 1]) {                      // -1 = L (character's left, at -X), +1 = R
    const k = s < 0 ? 'L' : 'R';
    P['thigh' + k] = [cx + s * hipX, y(0.50), cz];
    P['shin' + k] = [cx + s * hipX, y(0.28), cz];
    P['foot' + k] = [cx + s * hipX, y(0.05), cz];
    P['toe' + k] = [cx + s * hipX, y(0.03), cz + 0.12 * H]; L['toe' + k] = 0.04 * H;
    P['upperArm' + k] = [cx + s * sh, y(0.76), cz];
    P['foreArm' + k] = [cx + s * (sh + upper), y(0.76), cz];
    P['hand' + k] = [cx + s * (sh + upper + fore), y(0.76), cz];
    const wr = P['hand' + k];
    FINGERS.forEach((f, fi) => {
      const len = hand * (fi === 0 ? 0.6 : 0.8);
      const z = cz + FINGER_Z[fi] * hand;
      const j0 = [wr[0] + s * hand * 0.25, wr[1], z];
      const j1 = [j0[0] + s * FINGER_SEG[0] * len, wr[1], z];
      const j2 = [j1[0] + s * FINGER_SEG[1] * len, wr[1], z];
      P[`${f}1${k}`] = j0; P[`${f}2${k}`] = j1; P[`${f}3${k}`] = j2;
      L[`${f}3${k}`] = FINGER_SEG[2] * len;
    });
  }
  return { P, L };
}
// bone order: parents before children. Name suffix L/R marks the side (used by Mirror).
function humanoidSpec() {
  const spec = [['hips', null], ['spine', 'hips'], ['chest', 'spine'], ['neck', 'chest'], ['head', 'neck']];
  for (const k of ['L', 'R']) {
    spec.push(['thigh' + k, 'hips'], ['shin' + k, 'thigh' + k], ['foot' + k, 'shin' + k], ['toe' + k, 'foot' + k]);
    spec.push(['upperArm' + k, 'chest'], ['foreArm' + k, 'upperArm' + k], ['hand' + k, 'foreArm' + k]);
    for (const f of FINGERS) {
      for (let i = 1; i <= 3; i++) spec.push([`${f}${i}${k}`, i === 1 ? 'hand' + k : `${f}${i - 1}${k}`]);
    }
  }
  return spec;
}
function buildRig({ P, L }) {
  clearRig();
  for (const [name, parent] of humanoidSpec()) {
    const p = P[name], pp = parent ? P[parent] : [0, 0, 0];
    const parentBone = parent ? bones.find(b => b.name === parent) : null;
    addBone({
      parent: parentBone, name,
      pos: [p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]],
      length: L[name] ?? 0.3, select: false,
    });
  }
  bones.filter(b => /^hand[LR]$/.test(b.name)).forEach(b => collapsed.add(b.uuid)); // fingers folded in the list
  selectBone(bones[0]);
}
function autoFitHumanoid({ confirmReplace = true } = {}) {
  if (!baseGeometry) return toast('Load a mesh first');
  if (confirmReplace && bones.length && !confirm('Replace the rig with an auto-fit humanoid? Current bones and keyframes will be removed.')) return;
  if (mode === 'pose') setMode('rig');
  baseGeometry.computeBoundingBox();
  const bb = baseGeometry.boundingBox;
  const size = bb.getSize(new THREE.Vector3());
  const c = bb.getCenter(new THREE.Vector3());
  buildRig(humanoidJoints({ minY: bb.min.y, H: size.y, cx: c.x, cz: c.z, halfSpan: size.x / 2 }));
  toast(`Auto-fit: ${bones.length} bones (body and 30 fingers). Check the joints in Rig mode.`);
}
function loadDemo() {
  setMesh(demoGeometry());
  autoFitHumanoid({ confirmReplace: false });
  toast('Demo loaded with a finger rig. Press 2 for Pose, then rotate a finger and press K.');
}
// mirror L bones onto their R partners (names ending in L and R)
function mirrorLtoR() {
  let n = 0;
  for (const b of bones) {
    if (!/L$/.test(b.name)) continue;
    const other = bones.find(x => x.name === b.name.slice(0, -1) + 'R');
    if (!other) continue;
    other.position.set(-b.position.x, b.position.y, b.position.z);
    // mirror across the YZ plane: X rotation is kept, Y and Z flip sign
    other.quaternion.set(b.quaternion.x, -b.quaternion.y, -b.quaternion.z, b.quaternion.w);
    if (mode === 'rig') captureRest(other);
    n++;
  }
  if (!n) return toast('No L/R pairs found (bone names must end in L and R)');
  if (mode === 'rig') rigDirty = true;
  requestRender();
  refreshUI();
  toast(`Mirrored ${n} bones from L to R`);
}

// ---------- UI ----------
const sideClass = n => /L$/.test(n) ? 'l' : /R$/.test(n) ? 'r' : 'c';
function renderBoneList() {
  const ul = $('boneList');
  ul.innerHTML = '';
  $('boneCount').textContent = bones.length;
  if (!bones.length) { ul.innerHTML = '<li class="empty">No bones yet.<br/>Use <b>Auto-fit humanoid</b> or <b>+ Bone</b>.</li>'; return; }
  const addRow = (b, depth, hasKids) => {
    const li = document.createElement('li');
    li.className = 'row' + (b === selected ? ' sel' : '');
    li.style.paddingLeft = (6 + depth * 12) + 'px';
    li.dataset.idx = bones.indexOf(b);
    const caret = hasKids ? `<span class="caret" data-toggle="${b.uuid}">${collapsed.has(b.uuid) ? '▸' : '▾'}</span>` : '<span class="caret"></span>';
    li.innerHTML = `${caret}<span class="dotc ${sideClass(b.name)}"></span><span class="nm"></span>`;
    li.querySelector('.nm').textContent = b.name;
    ul.appendChild(li);
  };
  if (boneFilter) {
    const hits = bones.filter(b => b.name.toLowerCase().includes(boneFilter));
    if (!hits.length) ul.innerHTML = '<li class="empty">No bone matches.</li>';
    hits.forEach(b => addRow(b, 0, false));
    return;
  }
  const walk = (obj, depth) => {
    obj.children.filter(c => c.isBone).forEach(b => {
      const kids = b.children.some(c => c.isBone);
      addRow(b, depth, kids);
      if (kids && !collapsed.has(b.uuid)) walk(b, depth + 1);
    });
  };
  walk(rig, 0);
}
function renderInspector() {
  const b = selected;
  $('insEmpty').hidden = !!b;
  $('ins').hidden = !b;
  if (!b) return;
  const deg = THREE.MathUtils.radToDeg;
  $('nm').value = b.name;
  $('ln').value = (b.userData.length ?? 0.3).toFixed(2);
  $('px').value = b.position.x.toFixed(3);
  $('py').value = b.position.y.toFixed(3);
  $('pz').value = b.position.z.toFixed(3);
  $('rx').value = deg(b.rotation.x).toFixed(1);
  $('ry').value = deg(b.rotation.y).toFixed(1);
  $('rz').value = deg(b.rotation.z).toFixed(1);
  $('insMode').textContent = mode === 'rig'
    ? 'Editing the rest pose (Rig mode).'
    : `Editing the pose at ${playhead.toFixed(2)} s (Pose mode).`;
}
function renderTicks() {
  const times = new Set();
  for (const arr of keys.values()) for (const k of arr) times.add(k.t);
  $('ticks').innerHTML = [...times].sort((a, b) => a - b)
    .map(t => `<i style="left:${Math.min(100, (t / duration) * 100)}%" data-t="${t}" title="${t.toFixed(2)} s"></i>`).join('');
}
function updateTimelineUI() {
  $('scrub').max = duration;
  $('scrub').value = playhead;
  $('timeLbl').textContent = `${playhead.toFixed(2)} / ${duration.toFixed(2)} s`;
}
function refreshUI() {
  $('bRig').classList.toggle('on', mode === 'rig');
  $('bPose').classList.toggle('on', mode === 'pose');
  $('modeBadge').textContent = mode === 'rig'
    ? 'RIG MODE · place bones: drag the arrows'
    : 'POSE MODE · rotate a bone, then press K' + (playing ? ' · playing' : '');
  $('modeBadge').className = 'badge ' + mode;
  $('welcome').hidden = !!baseGeometry || bones.length > 0;
  $('hints').hidden = !bones.length;
  $('bPlay').textContent = playing ? '❚❚ Pause' : '▶ Play';
  $('bPlay').disabled = !clip;
  $('bKey').disabled = mode !== 'pose' || !bones.length;
  $('bExport').disabled = !skinned || !bones.length;
  const keyCount = [...keys.values()].reduce((s, a) => s + a.length, 0);
  const verts = baseGeometry ? baseGeometry.getAttribute('position').count : 0;
  $('stat').textContent = `${bones.length} bones · ${verts.toLocaleString()} verts · ${keyCount} keys`;
  renderBoneList();
  renderInspector();
  updateTimelineUI();
}
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.remove(), 3000);
}

// inspector edits
function afterFieldEdit() {
  if (mode === 'rig') { captureRest(selected); rigDirty = true; }
  requestRender();
  refreshUI();
}
function onGizmoChange() {
  if (!selected) return;
  if (mode === 'rig') { captureRest(selected); rigDirty = true; }
  requestRender();
  refreshUI();
}
$('nm').addEventListener('change', e => {
  if (!selected) return;
  selected.name = uniqueName(sanitize(e.target.value), selected);
  rebuildClip();
  refreshUI();
});
$('ln').addEventListener('change', e => {
  if (!selected) return;
  selected.userData.length = THREE.MathUtils.clamp(parseFloat(e.target.value) || 0.3, 0.05, 3);
  if (mode === 'rig') captureRest(selected);
  rigDirty = true;
  requestRender();
  refreshUI();
});
['px', 'py', 'pz'].forEach((id, i) => $(id).addEventListener('change', e => {
  if (!selected) return;
  selected.position.setComponent(i, parseFloat(e.target.value) || 0);
  afterFieldEdit();
}));
['rx', 'ry', 'rz'].forEach((id, i) => $(id).addEventListener('change', e => {
  if (!selected) return;
  const axis = ['x', 'y', 'z'][i];
  selected.rotation[axis] = THREE.MathUtils.degToRad(parseFloat(e.target.value) || 0);
  afterFieldEdit();
}));

$('boneList').addEventListener('click', e => {
  const t = e.target.closest('[data-toggle]');
  if (t) {
    const id = t.dataset.toggle;
    if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
    renderBoneList();
    return;
  }
  const row = e.target.closest('li.row');
  if (row) selectBone(bones[Number(row.dataset.idx)]);
});
$('boneFilter').addEventListener('input', e => { boneFilter = e.target.value.trim().toLowerCase(); renderBoneList(); });
$('ticks').addEventListener('click', e => {
  const t = Number(e.target.dataset.t);
  if (Number.isNaN(t) || e.target.tagName !== 'I') return;
  playing = false;
  playhead = t;
  applyPlayhead();
  refreshUI();
});
$('scrub').addEventListener('input', e => {
  playing = false;
  playhead = Number(e.target.value);
  applyPlayhead();
  refreshUI();
});
$('dur').addEventListener('change', e => {
  duration = THREE.MathUtils.clamp(parseFloat(e.target.value) || 2, 0.2, 60);
  e.target.value = duration;
  playhead = Math.min(playhead, duration);
  rebuildClip();
});

// toolbar
$('bRig').onclick = () => setMode('rig');
$('bPose').onclick = () => setMode('pose');
$('bDemo').onclick = loadDemo;
$('bFit').onclick = () => autoFitHumanoid();
$('bMirror').onclick = mirrorLtoR;
$('wp').addEventListener('change', e => {
  weightPower = THREE.MathUtils.clamp(parseFloat(e.target.value) || 1, 0.5, 4);
  e.target.value = weightPower;
  if (mode === 'pose') bindRig(); else rigDirty = true;
  requestRender();
});
$('bImport').onclick = () => $('fileIn').click();
$('fileIn').addEventListener('change', e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });
$('bBone').onclick = addChildBone;
$('bDel').onclick = deleteSelected;
$('bExport').onclick = exportGLB;
$('bNew').onclick = () => {
  if (!confirm('Clear the mesh, bones and keyframes?')) return;
  setMode('rig');
  clearRig();
  if (restMesh) { restGroup.remove(restMesh); restMesh.material.dispose(); restMesh = null; }
  if (skinned) { world.remove(skinned); skinned.material.dispose(); skinned = null; }
  if (baseGeometry) { baseGeometry.dispose(); baseGeometry = null; }
  playhead = 0; duration = 2; $('dur').value = 2;
  refreshUI(); requestRender();
};
$('bPlay').onclick = togglePlay;
$('bStop').onclick = stopPlay;
$('bKey').onclick = keyAll;
$('bDelKey').onclick = deleteKeysHere;

// viewport picking: click a joint dot to select; click empty space to deselect
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downAt = null;
canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => {
  if (!downAt || gizmoBusy) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  downAt = null;
  if (moved > 5) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(markerGroup.children, false);
  selectBone(hits.length ? hits[0].object.userData.bone : null);
});

// keyboard shortcuts (ignored while typing in a field)
window.addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea')) return;
  if (e.key === '1') setMode('rig');
  else if (e.key === '2') setMode('pose');
  else if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'k' || e.key === 'K') keyAll();
  else if (e.key === 'w' || e.key === 'W') transform.setMode('translate');
  else if (e.key === 'e' || e.key === 'E') transform.setMode('rotate');
  else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  else if (e.key === 'Escape') selectBone(null);
});

// drop a .glb file onto the viewport
const stageEl = $('stage');
['dragenter', 'dragover'].forEach(ev => stageEl.addEventListener(ev, e => { e.preventDefault(); stageEl.classList.add('drop'); }));
['dragleave', 'drop'].forEach(ev => stageEl.addEventListener(ev, e => { e.preventDefault(); stageEl.classList.remove('drop'); }));
stageEl.addEventListener('drop', e => {
  const f = [...e.dataTransfer.files].find(x => /\.(glb|gltf)$/i.test(x.name));
  if (f) importFile(f); else toast('Drop a .glb file here');
});
// small screens: side panels open as drawers
$('bPanelL').onclick = () => { $('panelL').classList.toggle('open'); $('panelR').classList.remove('open'); };
$('bPanelR').onclick = () => { $('panelR').classList.toggle('open'); $('panelL').classList.remove('open'); };
$('bWelcomeDemo').onclick = loadDemo;
$('bWelcomeImport').onclick = () => $('fileIn').click();

// debugging hook for automated tests (read-only snapshot)
window.__rigger = {
  get state() { return { mode, bones: bones.map(b => b.name), keys: [...keys.values()].reduce((s, a) => s + a.length, 0), playhead, duration, hasClip: !!clip }; },
  boneScreen(name) {
    const b = bones.find(x => x.name === name); if (!b) return null;
    const v = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  },
  boneLocal(name) { const b = bones.find(x => x.name === name); return b ? b.position.toArray() : null; },
  camPos() { return camera.position.toArray(); },
  selectedName() { return selected ? selected.name : null; },
  boneQuat(name) { const b = bones.find(x => x.name === name); return b ? b.quaternion.toArray() : null; },
  setPlayhead(t) { playing = false; playhead = t; applyPlayhead(); },
};

refreshUI();
