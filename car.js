// Roadster-Modell und Ausstattung – übernommen aus F1Racing/index.html (RONE Racing Roadster)
import * as THREE from 'three';
let ROAD_DASH = null;
// RONE Racing: Roadster aus dem hochgeladenen 3D-Modell (vereinfacht auf ~87k Dreiecke), mit eigener Lackierung nach den Fotos.
// roadcar.bin: Kopf (JSON) + je Teil quantisierte Positionen, Normalen, UVs (nur Lack) und Indizes. Koordinaten wie bei den F1-Autos: z = vorne, y = oben.
function loadRoadCar(buf) {
  const hl = new DataView(buf).getUint32(0, true), hdr = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))), base = 4 + hl, parts = [];
  for (const c of hdr.parts) {
    const q = new Int16Array(buf, base + c.pos, c.nv * 3), n = new Int8Array(buf, base + c.nrm, c.nv * 4), p = new Float32Array(c.nv * 3), nn = new Float32Array(c.nv * 3);
    for (let i = 0; i < c.nv; i++) for (let k = 0; k < 3; k++) { p[i * 3 + k] = c.min[k] + (q[i * 3 + k] + 32768) / 65535 * c.rg[k]; nn[i * 3 + k] = n[i * 4 + k] / 127; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
    if (c.uv !== undefined) { const u = new Uint16Array(buf, base + c.uv, c.nv * 2), uv = new Float32Array(c.nv * 2); for (let i = 0; i < c.nv * 2; i++) uv[i] = u[i] / 65535; g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
    g.setIndex(new THREE.BufferAttribute(c.i32 ? new Uint32Array(buf.slice(base + c.idx, base + c.idx + c.ni * 4)) : new Uint16Array(buf.slice(base + c.idx, base + c.idx + c.ni * 2)), 1));
    g.computeBoundingSphere(); parts.push({ m: c.m, w: c.w, g });
  }
  return { parts, wc: hdr.wc, wr: hdr.wr, sw: hdr.sw };
}
// Lackierung: Atlas 2048×2048. Rechte Seite oben links, linke Seite unten links, Oberseite rechte Hälfte (siehe simplify.js)
function roadPaint() {
  const W = 2048, H = 2048, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const SX = z => (z + 2.4) / 4.8 * W / 2, SY = (y, side) => (side > 0 ? 0 : H / 2) + y / 1.5 * H / 2;      // Seiten: z -> x, Höhe y -> y
  const TX = z => W / 2 + (z + 2.4) / 4.8 * W / 2, TY = x => (x + 1.1) / 2.2 * H;                            // Oberseite: z -> x, x -> y
  g.fillStyle = '#8f0c16'; g.fillRect(0, 0, W, H);   // Grundlack: tiefes Metallic-Rot mit feinen Flakes
  for (let k = 0; k < 140000; k++) { const v = Math.random(); g.fillStyle = v < .5 ? `rgba(255,70,70,${Math.random() * .1})` : `rgba(40,0,0,${Math.random() * .12})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  for (const side of [1, -1]) {
    const P = (z, y) => [SX(z), SY(y, side)];
    g.fillStyle = '#0b0b0d'; g.beginPath();   // schwarzer Pfeil: breit am hinteren Kotflügel, spitz in der Türmitte
    for (const [z, y] of [[-1.72, 0.84], [-1.2, 0.86], [-0.45, 0.8], [0.32, 0.69], [-0.2, 0.66], [-0.8, 0.6], [-1.2, 0.56], [-1.62, 0.6]]) { const [x, yy] = P(z, y); g.lineTo(x, yy); }
    g.closePath(); g.fill();
    g.strokeStyle = '#d8212f'; g.lineWidth = 6; g.beginPath(); for (const [z, y] of [[-1.35, 0.78], [-0.55, 0.75], [-0.05, 0.69], [-0.65, 0.66], [-1.05, 0.63]]) { const [x, yy] = P(z, y); g.lineTo(x, yy); } g.stroke();
    g.strokeStyle = '#0b0b0d'; g.lineWidth = 8; g.beginPath(); for (const [z, y] of [[-1.7, 0.83], [-1.95, 0.8], [-2.15, 0.74]]) { const [x, yy] = P(z, y); g.lineTo(x, yy); } g.stroke();
    { const [x, y] = P(1.79, 0.45), kz = (W / 2) / 4.8, ky = (H / 2) / 1.5; g.save(); g.translate(x, y); g.scale((side > 0 ? -1 : 1) * kz / ky, -1); g.fillStyle = '#f6f6f6'; g.font = '900 78px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('666', 0, 0); g.restore(); }
    // Aufkleber-Säule an der Tür hinter dem Vorderrad (nur Schrift, keine Logos)
    { const kz = (W / 2) / 4.8, ky = (H / 2) / 1.5;
      const T = (z, y, h, txt, font, wscale = 1) => { const [x, yy] = P(z, y); g.save(); g.translate(x, yy); g.scale((side > 0 ? -1 : 1) * kz / ky * wscale, -1); g.fillStyle = '#f4f4f4'; g.font = font.replace('#', Math.round(h * ky * 1.25) + 'px'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 0); g.restore(); };
      const zc = 0.6;
      T(0.97, 0.8, 0.05, 'PIRELLI', '900 italic # Arial Black, system-ui, sans-serif');
      T(zc, 0.84, 0.055, 'O·Z', '900 # Arial Black, system-ui, sans-serif'); T(zc, 0.797, 0.022, 'RACING', '700 # system-ui, sans-serif');
      T(zc, 0.75, 0.04, 'KENWOOD', '700 # Arial, system-ui, sans-serif');
      T(zc, 0.71, 0.03, '/////ALPINE', '900 italic # Arial, system-ui, sans-serif');
      T(zc, 0.66, 0.055, 'NOS', '900 # Arial Black, system-ui, sans-serif');
      T(zc, 0.607, 0.045, 'momo', '900 # Arial Black, system-ui, sans-serif');
      T(zc, 0.56, 0.04, 'sparco', '700 # Arial, system-ui, sans-serif');
      T(zc, 0.518, 0.032, 'YOKOHAMA', '700 # Arial, system-ui, sans-serif');
      T(zc, 0.474, 0.036, 'GReddy', '900 italic # Arial, system-ui, sans-serif'); }
  }
  { const z0 = -1.62, y0 = 0.74, r = 0.085, M = (dz, dy) => [SX(z0 + dz), SY(y0 + dy, -1)]; g.strokeStyle = '#f2f2f2'; g.lineWidth = 4; g.beginPath(); for (let k = 0; k <= 48; k++) { const a = k / 48 * 6.283, [x, y] = M(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(x, y); } g.stroke();
    g.lineWidth = 2.5; g.beginPath(); for (let k = 0; k <= 5; k++) { const a = Math.PI / 2 + k * 4 * Math.PI / 5, [x, y] = M(Math.cos(a) * r * .86, Math.sin(a) * r * .86); g.lineTo(x, y); } g.stroke(); }
  { const M = (z, x) => [TX(z), TY(x)]; g.strokeStyle = '#0b0b0d'; g.lineCap = 'butt';
    for (const [x0, w] of [[0.5, 0.035], [0.565, 0.02]]) { g.lineWidth = w * H / 2.2; g.beginPath(); const a = M(0.55, x0), b = M(1.45, x0 + 0.12); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
  { // Haube (mittig): Hannya-Maske mit Hörnern, senkrechtem Schwert und Schriftzug 死神谷 – nach dem Foto nachgezeichnet.
    // Zeichnen in Metern: ex = quer, ey = Richtung Windschutzscheibe (oben im Sticker)
    const sc = 0.82, kz = (W / 2) / 4.8 * sc, ky = H / 2.2 * sc, z0 = 1.32;
    g.save(); g.setTransform(0, ky, -kz, 0, TX(z0), TY(0)); const C = 'rgba(238,238,238,.97)'; g.strokeStyle = C; g.fillStyle = C; g.lineCap = 'round'; g.lineJoin = 'round';
    const L = (pts, w, close) => { g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); if (close) g.closePath(); g.stroke(); };
    const sym = (pts, w, close) => { L(pts, w, close); L(pts.map(([x, y]) => [-x, y]), w, close); };
    const F = (pts) => { g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
    const lw = 0.011;
    // Schwertgriff mit Rautenwicklung, Stichblatt, Klinge bis unter die Maske
    L([[-0.022, 0.34], [0.022, 0.34], [0.022, 0.215], [-0.022, 0.215]], lw, true);
    for (let k = 0; k < 3; k++) { const y = 0.315 - k * 0.04; F([[0, y + 0.017], [0.014, y], [0, y - 0.017], [-0.014, y]]); }
    L([[-0.075, 0.205], [0.075, 0.205]], lw); L([[-0.075, 0.205], [-0.06, 0.19], [0.06, 0.19], [0.075, 0.205]], lw * .7);
    for (const x of [-0.02, 0, 0.02]) L([[x, 0.19], [x, 0.165]], lw * .7);
    L([[-0.024, -0.13], [-0.024, -0.38], [0.0, -0.43], [0.024, -0.38], [0.024, -0.13]], lw); L([[0, -0.15], [0, -0.4]], lw * .6);
    // Hörner: nach außen und oben geschwungen
    for (const sg of [-1, 1]) { g.lineWidth = lw; g.beginPath(); g.moveTo(sg * 0.1, 0.17); g.quadraticCurveTo(sg * 0.25, 0.14, sg * 0.31, 0.28); g.quadraticCurveTo(sg * 0.24, 0.2, sg * 0.15, 0.2); g.closePath(); g.stroke(); }
    // Schriftzug
    g.save(); g.translate(0, 0.12); g.scale(0.001, -0.001); g.font = '900 78px "Noto Sans CJK JP","Hiragino Sans","Yu Gothic",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('死神谷', 0, 0); g.restore();
    // Maske: Brauen, Augen, Nase, Mund mit Zähnen, Hauer, gezackte Wangen bis zur Klinge
    sym([[0.02, 0.065], [0.09, 0.08], [0.17, 0.055], [0.2, 0.0], [0.15, 0.02], [0.1, -0.005], [0.06, 0.02]], lw, true);
    sym([[0.035, 0.0], [0.07, 0.015], [0.1, -0.01]], lw * .8);
    sym([[0.0, 0.05], [0.03, 0.0], [0.04, -0.04], [0.02, -0.055]], lw);
    L(Array.from({ length: 21 }, (_, k) => { const a = Math.PI + k / 20 * Math.PI; return [Math.cos(a) * 0.04, -0.05 + Math.sin(a) * 0.012]; }), lw * .8);
    L([[-0.07, -0.08], [-0.04, -0.105], [0.04, -0.105], [0.07, -0.08]], lw); L([[-0.05, -0.11], [-0.03, -0.135], [0.03, -0.135], [0.05, -0.11]], lw);
    for (const x of [-0.03, -0.01, 0.01, 0.03]) L([[x, -0.105], [x, -0.12]], lw * .6);
    sym([[0.08, -0.07], [0.16, -0.11], [0.26, -0.19], [0.17, -0.15], [0.1, -0.12]], lw, true);     // Hauer nach außen
    sym([[0.2, 0.0], [0.19, -0.06], [0.14, -0.1]], lw);
    sym([[0.14, -0.13], [0.15, -0.2], [0.12, -0.22], [0.11, -0.27], [0.07, -0.29], [0.05, -0.33], [0.03, -0.36]], lw);
    sym([[0.09, -0.17], [0.08, -0.23], [0.06, -0.26]], lw * .7);
    g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8; return t;
}
function roadPlate(front) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112; const g = c.getContext('2d');
  if (front) { g.fillStyle = '#0d0d0f'; g.fillRect(0, 0, 512, 112); g.strokeStyle = '#d0d0d0'; g.lineWidth = 4; g.strokeRect(4, 4, 504, 104); g.fillStyle = '#fff'; g.font = '700 54px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ナツキ Natsuki', 256, 58); }
  else { g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 512, 112); g.fillStyle = '#1d3f9e'; g.fillRect(0, 0, 52, 112); g.strokeStyle = '#111'; g.lineWidth = 5; g.strokeRect(3, 3, 506, 106); g.fillStyle = '#111'; g.font = '700 64px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RONE 666', 280, 60); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// eigene Kennzeichen über die Schilder des Modells legen
function roadPlates(RC) {
  const p = RC.parts.find(q => q.m === 'Material__1'); if (!p) return []; const P = p.g.attributes.position, out = [];
  for (const front of [true, false]) { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < P.count; i++) { const z = P.getZ(i); if ((z > 0) !== front) continue; const v = [P.getX(i), P.getY(i), z]; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } }
    if (mn[0] > mx[0]) continue; const g = new THREE.PlaneGeometry(mx[0] - mn[0], mx[1] - mn[1]); if (!front) g.rotateY(Math.PI); g.translate((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, front ? mx[2] + 0.004 : mn[2] - 0.004);
    out.push([g, new THREE.MeshStandardMaterial({ map: roadPlate(front), roughness: .4 })]); }
  return out;
}
// Materialien je Teil des Modells
function roadMats(paint) {
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  return {
    carpaint: P({ map: paint, color: 0xffffff, metalness: .4, roughness: .4, clearcoat: .7, clearcoatRoughness: .16 }),
    carpaint_second: P({ color: 0x0c0c0e, metalness: .3, roughness: .25, clearcoat: 1 }),
    black: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: .7, metalness: .05 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: .18, metalness: 1 }),
    brakedisk: new THREE.MeshStandardMaterial({ color: 0x777a7f, roughness: .45, metalness: .8 }),
    windowglass: P({ color: 0xdfe8ec, roughness: .02, metalness: 0, transparent: true, opacity: .1, depthWrite: false }),   // klar durchsichtig (auch von innen)
    interior: new THREE.MeshStandardMaterial({ color: 0x2d2f35, emissive: 0x0c0d10, roughness: .9, metalness: 0 }),   // weiches Kunstleder: hell genug, dass Formen und Kanten im Schatten des Dachs erkennbar bleiben
    wheelLeather: new THREE.MeshStandardMaterial({ color: 0x0e0f11, roughness: .55, metalness: .05 }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xaab4bb, roughness: .05, metalness: 1 }),
    clearglass: P({ color: 0xdfe6ea, roughness: .05, metalness: .1, transparent: true, opacity: .35, depthWrite: false }),
    redglass: new THREE.MeshStandardMaterial({ color: 0x6e0808, emissive: 0xff1a10, emissiveIntensity: .15, roughness: .15, metalness: .1 }),
    orangeglass: new THREE.MeshStandardMaterial({ color: 0x9a4a06, roughness: .15, metalness: .1 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: .9 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x101113, roughness: .3, metalness: .7 }),
    Material__1: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5 }),
  };
}

// Lenkrad-Details (lokal: Ring in der x/y-Ebene, z zeigt zum Fahrer): silberne Speichen links/rechts/unten, Prallplatte mit Emblem-Ring
function roadWheelExtras() {
  const g = new THREE.Group(), silver = new THREE.MeshStandardMaterial({ color: 0xb9bec4, metalness: .9, roughness: .25 }), dark = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: .5 });
  for (const a of [0, Math.PI, Math.PI / 2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.012), silver); sp.position.set(Math.cos(a) * 0.115, Math.sin(a) * 0.115, 0.01); sp.rotation.z = a; g.add(sp); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.04, 28).rotateX(Math.PI / 2), dark); hub.position.z = 0.025; g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 24), silver); ring.position.z = 0.046; g.add(ring);
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.022, 0.006), dark); b.position.set(sx * 0.1, 0.012, 0.02); g.add(b); }
  return g;
}
// Cockpit nach den Fotos: beleuchtete Rundinstrumente, Mittel-Display, rot eingefasste Lüftungsdüsen, blaues Fußraumlicht
function roadCabin() {
  const g = new THREE.Group(), mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const dial = (x, y, r, g2, max, red, big, min = 0) => { g2.fillStyle = '#05060a'; g2.beginPath(); g2.arc(x, y, r, 0, 7); g2.fill(); g2.strokeStyle = '#c9ced6'; g2.lineWidth = r * 0.06; g2.beginPath(); g2.arc(x, y, r * 0.97, 0, 7); g2.stroke();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, n = big ? 8 : 12;
    for (let k = 0; k <= n * 2; k++) { const a = a0 + (a1 - a0) * k / (n * 2), maj = k % 2 === 0, r1 = r * (maj ? 0.72 : 0.8); g2.strokeStyle = red && k >= n * 2 * 0.78 ? '#ff2a20' : '#f2f4f8'; g2.lineWidth = maj ? r * 0.05 : r * 0.025;
      g2.beginPath(); g2.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); g2.lineTo(x + Math.cos(a) * r * 0.88, y + Math.sin(a) * r * 0.88); g2.stroke();
      if (maj && (big || k % 4 === 0)) { g2.fillStyle = '#f2f4f8'; g2.font = `700 ${Math.round(r * 0.17)}px system-ui,sans-serif`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(String(Math.round(min + (max - min) * k / (n * 2))), x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55); } } };
  // Instrumente: statischer Hintergrund + live gezeichnete Zeiger (Wassertemperatur, Drehzahl, Tempo)
  const gbg = document.createElement('canvas'); gbg.width = 1024; gbg.height = 360;
  { const c = gbg.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, 1024, 360); dial(200, 200, 130, c, 160, false, false, 40); dial(512, 180, 170, c, 8, true, true); dial(824, 200, 130, c, 360, false, false);
    c.fillStyle = '#9aa3ad'; c.font = '600 20px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText('°C', 200, 300); c.fillText('x1000 r/min', 512, 120); c.fillText('km/h', 824, 300); }
  const gcv = document.createElement('canvas'); gcv.width = 1024; gcv.height = 360; gcv.getContext('2d').drawImage(gbg, 0, 0);
  const gt = new THREE.CanvasTexture(gcv); gt.colorSpace = THREE.SRGBColorSpace;
  const gm = new THREE.MeshBasicMaterial({ map: gt, color: new THREE.Color(1.15, 1.15, 1.15) });
  const gp = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.127), gm); gp.position.set(0.425, 0.935, 0.07); gp.rotation.set(-0.18, Math.PI, 0); g.add(gp);
  // Mittel-Display: Live-Navigationskarte (wird im Spiel gezeichnet, siehe roadDashTick)
  const ncv = document.createElement('canvas'); ncv.width = 512; ncv.height = 288; { const c = ncv.getContext('2d'); c.fillStyle = '#05080d'; c.fillRect(0, 0, 512, 288); }
  const st = new THREE.CanvasTexture(ncv); st.colorSpace = THREE.SRGBColorSpace; st.anisotropy = 4;
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.235, 0.132), new THREE.MeshBasicMaterial({ map: st, color: new THREE.Color(1.1, 1.1, 1.1) })); sp.position.set(0.0, 1.11, 0.215); sp.rotation.set(0.22, Math.PI, 0); g.add(sp);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.255, 0.152, 0.018), new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: .35, metalness: .2 })); back.position.set(0.0, 1.11, 0.228); back.rotation.x = 0.22; g.add(back);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), back.material); foot.position.set(0, 1.03, 0.24); g.add(foot);
  ROAD_DASH = { gbg, gcv, gt, ncv, st, t: 0, temp: 50 };
  // runde Lüftungsdüsen: farbiger Ring, tiefe Düse, Lamellenkreuz und Drehknopf
  const redM = new THREE.MeshStandardMaterial({ color: 0xc8141c, emissive: 0x6a0408, roughness: .3, metalness: .4 }), ventM = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: .85 }),
    finM = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: .5, metalness: .3 }), chrM = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: .2, metalness: 1 });
  const ringG = new THREE.TorusGeometry(0.046, 0.009, 10, 36), cupG = new THREE.CylinderGeometry(0.044, 0.04, 0.03, 28, 1, true).rotateX(Math.PI / 2), bottomG = new THREE.CircleGeometry(0.041, 28),
    finG = new THREE.BoxGeometry(0.08, 0.005, 0.012), knobG = new THREE.CylinderGeometry(0.011, 0.011, 0.014, 16).rotateX(Math.PI / 2), chrRingG = new THREE.TorusGeometry(0.04, 0.0025, 6, 32);
  // Positionen per Raycast auf die Armaturenbrett-Fläche gesetzt (Seitendüsen sitzen bündig in der geneigten Front, nicht mehr in der Tür)
  for (const [x, y, z, tilt, sc] of [[0.68, 0.884, 0.067, 0.35, 0.9], [0.135, 0.955, 0.06, 0, 1], [-0.68, 0.884, 0.067, 0.35, 0.9]]) {
    const v = new THREE.Group(); v.position.set(x, y, z); v.rotation.set(tilt, Math.PI, 0); v.scale.setScalar(sc); g.add(v);
    v.add(new THREE.Mesh(ringG, redM)); const ch = new THREE.Mesh(chrRingG, chrM); ch.position.z = -0.004; v.add(ch);
    const cup = new THREE.Mesh(cupG, ventM); cup.position.z = -0.016; v.add(cup); const bt = new THREE.Mesh(bottomG, ventM); bt.position.z = -0.03; v.add(bt);
    for (const r of [0.35, 0.35 + Math.PI / 2]) { const f = new THREE.Mesh(finG, finM); f.rotation.z = r; f.position.z = -0.012; v.add(f); }
    const kn = new THREE.Mesh(knobG, chrM); kn.position.z = -0.006; v.add(kn);
  }
  const glow = mk(128, 128, (c, w, h) => { const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(40,70,255,1)'); gr.addColorStop(.6, 'rgba(30,50,255,.45)'); gr.addColorStop(1, 'rgba(20,30,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const glM = new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.4, 1.4, 1.4) });
  for (const x of [0.42, -0.42]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.6).rotateX(-Math.PI / 2), glM); f.position.set(x, 0.36, 0.15); g.add(f); const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), glM); w.position.set(x, 0.5, 0.42); w.rotation.y = Math.PI; g.add(w); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return g;
}

// Lenkrad nach Foto: Lederkranz mit roter Naht, drei silberne Speichen (links/rechts mit Tastenfeldern, unten als V mit Plakette), Prallplatte mit Chrom-Emblem
function roadSteeringWheel() {
  const g = new THREE.Group(), R = 0.188, mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const leather = mk(1024, 64, (x, w, h) => { x.fillStyle = '#16171a'; x.fillRect(0, 0, w, h); for (let k = 0; k < 6000; k++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .035})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    x.fillStyle = '#b3121c'; for (const v of [0.22, 0.78]) for (let u = 0; u < w; u += 9) x.fillRect(u, v * h - 1.5, 5, 3);
    x.fillStyle = 'rgba(0,0,0,.6)'; for (const u of [0.22, 0.46, 0.71, 0.96]) x.fillRect(u * w, 0, 3, h); });   // Nähte + Lederstöße
  leather.wrapS = leather.wrapT = THREE.RepeatWrapping;
  const rimM = new THREE.MeshStandardMaterial({ map: leather, roughness: .55, metalness: .05 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0205, 14, 72), rimM); rim.scale.set(1, 1, 1.15); g.add(rim);
  const silver = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: .92, roughness: .28 }), dark = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: .5, metalness: .1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecf0, metalness: 1, roughness: .12 });
  // Prallplatte (leicht oval) + Chrom-Emblem (eigene Form)
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.083, 0.055, 40).rotateX(Math.PI / 2), dark); hub.scale.set(1.08, 0.95, 1); hub.position.set(0, 0.008, 0.03); g.add(hub);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0035, 8, 36), chrome); ring.scale.set(1.15, 0.85, 1); ring.position.set(0, 0.012, 0.059); g.add(ring);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.004, 0.003), chrome); w.position.set(sx * 0.011, 0.01, 0.06); w.rotation.z = sx * 0.55; g.add(w); }
  // seitliche Speichen mit Tastenfeldern
  const btn = mk(256, 160, (x, w, h) => { x.fillStyle = '#0b0c0e'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3a3d42'; x.lineWidth = 4; x.strokeRect(4, 4, w - 8, h - 8);
    x.fillStyle = '#e9ecef'; x.font = '700 30px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; [['◄+', 64, 45], ['▶▶|', 192, 45], ['◄–', 64, 115], ['INFO', 192, 115]].forEach(([t, px, py]) => x.fillText(t, px, py));
    x.fillStyle = '#2a2c30'; x.fillRect(w / 2 - 2, 10, 4, h - 20); x.fillRect(10, h / 2 - 2, w - 20, 4); });
  for (const sx of [-1, 1]) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.05, 0.016), silver); sp.position.set(sx * 0.13, 0.0, 0.018); g.add(sp);
    const lo = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.016, 0.014), silver); lo.position.set(sx * 0.115, -0.04, 0.016); lo.rotation.z = sx * 0.45; g.add(lo);
    const pan = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.037), new THREE.MeshStandardMaterial({ map: btn, roughness: .5 })); pan.position.set(sx * 0.122, 0.003, 0.0265); g.add(pan);
  }
  // untere Speiche: V-Form zum Kranz mit Plakette
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.12, 0.016), silver); b.position.set(sx * 0.03, -0.12, 0.014); b.rotation.z = -sx * 0.2; g.add(b); }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.006), silver); plate.position.set(0, -0.155, 0.02); g.add(plate);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export { loadRoadCar, roadPaint, roadPlates, roadMats, roadCabin, roadSteeringWheel, ROAD_DASH };
