import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import * as D from './design.js';
import * as G from './geometry.js';
import { mulberry32, heat, clamp, smooth } from './util.js';

export const W = 1920, H = 1080;

export class World {
  constructor(canvasParent) {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setSize(W, H); r.setPixelRatio(1);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.domElement.id = 'gl';
    canvasParent.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03060c);
    this.scene.fog = new THREE.FogExp2(0x03060c, 0.045);
    const pm = new THREE.PMREMGenerator(r);
    this.env = pm.fromScene(studioEnv(), 0.03).texture;
    this.camera = new THREE.PerspectiveCamera(32, W / H, 0.02, 200);

    this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.32, 0.45, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    const fx = new ShaderPass(FXAAShader);
    fx.material.uniforms.resolution.value.set(1 / W, 1 / H);
    this.composer.addPass(fx);

    this.buildMaterials();
    this.buildCompressor();
    this.buildEngine();
    this.buildParticles();
    this.buildStage();
  }

  bakeMatcap(params) {
    const rt = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType });
    const sc = new THREE.Scene();
    sc.environment = this.env;
    sc.background = new THREE.Color(0x000000);
    const key = new THREE.DirectionalLight(0xfff1e0, params.key ?? 2.2); key.position.set(-1.3, 1.5, 1.2); sc.add(key);
    const rim = new THREE.DirectionalLight(params.rimColor ?? 0x5fd8ff, params.rim ?? 2.6); rim.position.set(1.6, 0.2, -0.7); sc.add(rim);
    const fill = new THREE.DirectionalLight(0x6080c0, 0.9); fill.position.set(0.6, -1.2, 1.0); sc.add(fill);
    const amb = new THREE.HemisphereLight(0x9ab0c8, 0x101820, 0.55); sc.add(amb);
    const mat = new THREE.MeshPhysicalMaterial({
      color: params.color, metalness: params.metalness ?? 0.72, roughness: params.roughness ?? 0.42,
      envMapIntensity: params.env ?? 1.0, clearcoat: params.clearcoat ?? 0.2, clearcoatRoughness: 0.2,
    });
    const sp = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), mat); sc.add(sp);
    const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); oc.position.z = 3;
    this.renderer.setRenderTarget(rt); this.renderer.render(sc, oc); this.renderer.setRenderTarget(null);
    return rt.texture;
  }

  buildMaterials() {
    const cap = (p, extra = {}) => new THREE.MeshMatcapMaterial({ matcap: this.bakeMatcap(p), ...extra });
    this.mat = {
      rotor: cap({ color: 0xb8c6d6, roughness: 0.36 }),
      stator: cap({ color: 0xc8954e, roughness: 0.40 }),
      igv: cap({ color: 0x8fa3b8, roughness: 0.4 }),
      hub: cap({ color: 0x5a6a80, roughness: 0.38, key: 1.6 }),
      casing: cap({ color: 0x1c2532, roughness: 0.45, env: 0.6, rim: 1.4, key: 0.9 }, { side: THREE.DoubleSide }),
      turbine: cap({ color: 0x9a5a30, roughness: 0.3, rimColor: 0xff8a3d, rim: 2.4 }),
      engineCasing: cap({ color: 0x1c2532, roughness: 0.45, env: 0.6, rim: 1.4, key: 0.9 }, { side: THREE.DoubleSide, transparent: true }),
    };
    this.baseColor = {};
    for (const k in this.mat) this.baseColor[k] = this.mat[k].color.clone();
  }

  buildCompressor() {
    this.rotorGroup = new THREE.Group();
    this.scene.add(this.rotorGroup);
    this.statorGroup = new THREE.Group();
    this.scene.add(this.statorGroup);
    this.rowMeshes = [];
    for (const row of D.rows) {
      const mat = row.kind === 'rotor' ? this.mat.rotor : row.kind === 'stator' ? this.mat.stator : this.mat.igv;
      const m = G.rowMesh(row, mat, { nSpan: row.stage < 6 ? 7 : 5, nChord: row.stage < 6 ? 14 : 11 });
      m.userData.row = row;
      (row.kind === 'rotor' ? this.rotorGroup : this.statorGroup).add(m);
      this.rowMeshes.push(m);
    }
    const hub = new THREE.Mesh(G.revolve(G.hubProfile(), 128), this.mat.hub);
    this.rotorGroup.add(hub);
    // cut-away casing (back half only)
    const inner = G.casingProfile(0.004), outer = G.casingProfile(0.07);
    const cas = new THREE.Mesh(G.revolve(inner, 96, Math.PI, Math.PI), this.mat.casing);
    this.scene.add(cas);
    const casO = new THREE.Mesh(G.revolve(outer, 96, Math.PI, Math.PI), this.mat.casing);
    this.scene.add(casO);
    this.casing = [cas, casO];
    // section faces at z = 0 (y>0 and y<0) with glowing edges
    const secMat = new THREE.MeshBasicMaterial({ color: 0x0b2f3d, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x46e3ff, transparent: true, opacity: 0.9 });
    this.edgeMat = edgeMat;
    for (const sgn of [1, -1]) {
      const pos = [], idx = [];
      for (let i = 0; i < inner.length; i++) {
        pos.push(inner[i][0], sgn * inner[i][1], 0.001, outer[i][0], sgn * outer[i][1], 0.001);
        if (i > 0) { const a = 2 * (i - 1); idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      this.scene.add(new THREE.Mesh(g, secMat));
      for (const prof of [inner, outer]) {
        const lg = new THREE.BufferGeometry().setFromPoints(prof.map(p => new THREE.Vector3(p[0], sgn * p[1], 0.003)));
        this.scene.add(new THREE.Line(lg, edgeMat));
      }
    }
    // holographic ghost of the removed front half
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0x2fbfff, transparent: true, opacity: 0.03, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ghostMat = ghostMat;
    this.scene.add(new THREE.Mesh(G.revolve(outer, 96, 0, Math.PI), ghostMat));
    const ringMat = new THREE.LineBasicMaterial({ color: 0x46e3ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
    this.ringMat = ringMat;
    for (const row of D.rows) {
      if (row.kind !== 'rotor' && row.kind !== 'igv') continue;
      const x = row.x0, rr = D.rTip(x) + 0.07;
      const pts = [];
      for (let k = 0; k <= 64; k++) { const ph = Math.PI * k / 64; pts.push(new THREE.Vector3(x, rr * Math.cos(ph), rr * Math.sin(ph))); }
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
    }
  }

  buildEngine() {
    // combustor + turbine shown in the final "big picture" shot
    const g = this.engineGroup = new THREE.Group();
    this.scene.add(g);
    const xe = D.X_END;
    this.XC0 = xe + 0.45; this.XC1 = xe + 1.65; this.XT0 = xe + 1.75; this.XT1 = xe + 2.85;
    const prof = [];
    const rt = D.rTip(xe);
    prof.push([xe + 0.62, rt + 0.07]);
    for (let k = 0; k <= 20; k++) { const u = k / 20; prof.push([this.XC0 - 0.1 + u * 0.3, rt + 0.07 + (1.42 - rt - 0.07) * Math.sin(u * Math.PI / 2)]); }
    prof.push([this.XC1, 1.42]);
    for (let k = 0; k <= 12; k++) { const u = k / 12; prof.push([this.XC1 + u * 0.2, 1.42 - (1.42 - 1.24) * smooth(u)]); }
    prof.push([this.XT1 + 0.05, 1.30]); prof.push([this.XT1 + 0.6, 1.36]);
    const ec = new THREE.Mesh(G.revolve(prof, 96, Math.PI, Math.PI), this.mat.engineCasing);
    g.add(ec);
    // combustion liner glow (annular flame)
    const flameMat = this.flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.45, 0.12).multiplyScalar(2.2), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const rr of [0.80, 1.12]) {
      const lp = [];
      for (let k = 0; k <= 30; k++) { const u = k / 30; lp.push([this.XC0 + 0.1 + u * (this.XC1 - this.XC0 - 0.1), rr + 0.03 * Math.sin(u * Math.PI)]); }
      g.add(new THREE.Mesh(G.revolve(lp, 96, 0, Math.PI * 2), flameMat));
    }
    // burner cans / nozzles
    const nozMat = this.mat.igv;
    for (let k = 0; k < 16; k++) {
      const ph = 2 * Math.PI * k / 16;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 16), nozMat);
      c.rotation.z = Math.PI / 2;
      c.position.set(this.XC0 + 0.05, 0.96 * Math.cos(ph), 0.96 * Math.sin(ph));
      g.add(c);
    }
    // turbine: 4 stages (nozzle + rotor)
    this.turbRows = [];
    const nT = 4;
    for (let i = 0; i < nT; i++) {
      const span = this.XT1 - this.XT0;
      const x0 = this.XT0 + span * i / nT;
      const c = 0.14;
      for (const kind of ['ngv', 'trot']) {
        const xx = kind === 'ngv' ? x0 : x0 + span / nT * 0.5;
        const rowT = { kind: kind === 'ngv' ? 'stator' : 'rotor', stage: 1, chord: c, x0: xx, x1: xx + c * 0.75 };
        const rh = 0.62, rtT = 1.0 + 0.18 * (i + (kind === 'trot' ? 0.5 : 0)) / nT;
        const geo = turbineBlade(rowT, rh, rtT, kind);
        const n = kind === 'ngv' ? 36 : 48;
        const mesh = new THREE.InstancedMesh(geo, this.mat.turbine, n);
        const m = new THREE.Matrix4();
        for (let j = 0; j < n; j++) { m.makeRotationX(2 * Math.PI * j / n); mesh.setMatrixAt(j, m); }
        (kind === 'trot' ? this.rotorGroup : g).add(mesh);
        mesh.userData.engine = true;
        this.turbRows.push(mesh);
      }
    }
    // turbine hub drum
    const th = new THREE.Mesh(G.revolve([[this.XT0 - 0.2, 0.40], [this.XT0 - 0.05, 0.62], [this.XT1 + 0.1, 0.62], [this.XT1 + 0.9, 0.12], [this.XT1 + 0.95, 0.0]], 96), this.mat.hub);
    th.userData.engine = true;
    this.rotorGroup.add(th);
    this.turbHub = th;
    this.setEngineVisible(false);
  }

  setEngineVisible(v) {
    this.engineGroup.visible = v;
    for (const m of this.turbRows) m.visible = v;
    this.turbHub.visible = v;
  }

  buildParticles() {
    const NP = this.NP = 3000, TR = this.TR = 12;
    const rnd = mulberry32(7);
    this.pf = new Float32Array(NP); this.pth = new Float32Array(NP); this.pph = new Float32Array(NP); this.psz = new Float32Array(NP);
    for (let i = 0; i < NP; i++) {
      this.pf[i] = 0.06 + 0.88 * rnd();
      this.pth[i] = rnd() * Math.PI * 2;
      this.pph[i] = rnd();
      this.psz[i] = 0.7 + 0.6 * rnd();
    }
    const n = NP * TR;
    const geo = new THREE.BufferGeometry();
    this.ppos = new Float32Array(n * 3); this.pcol = new Float32Array(n * 3); this.palpha = new Float32Array(n); this.psize = new Float32Array(n);
    geo.setAttribute('position', new THREE.BufferAttribute(this.ppos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.pcol, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.palpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.psize, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(3, 0, 0), 50);
    const mk = (xray) => new THREE.ShaderMaterial({
      uniforms: { uScale: { value: H * 0.5 }, uOpacity: { value: 0 } },
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale; uniform float uOpacity;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(aSize*uScale/(-mv.z), 1.5, 13.0); vC=color;
          float k = 1.0;
          ${xray ? 'k = 0.42 * smoothstep(-0.2, 0.6, position.z / max(0.05, length(position.yz)));' : ''}
          vA=aAlpha*uOpacity*k; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); float a=smoothstep(0.5,0.05,r); gl_FragColor=vec4(vC*a*vA,1.0); }`,
      transparent: true, depthWrite: false, depthTest: !xray, blending: THREE.AdditiveBlending,
    });
    this.pmat = mk(false); this.pmatX = mk(true);
    this.points = new THREE.Points(geo, this.pmat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.pointsX = new THREE.Points(geo, this.pmatX);
    this.pointsX.frustumCulled = false; this.pointsX.renderOrder = 2;
    this.scene.add(this.pointsX);
    // swirl integral table
    const xa = -1.6, xb = 8.0, NT = 4000;
    this.swX0 = xa; this.swDX = (xb - xa) / NT;
    this.swirl = new Float32Array(NT + 1);
    let acc = 0;
    for (let k = 0; k <= NT; k++) {
      const x = xa + k * this.swDX;
      this.swirl[k] = acc;
      let ta = D.tanAlpha(x);
      if (x > D.X_END + 0.3) ta = 0;
      // turbine: strong swirl back and forth
      if (this.XT0 && x > this.XT0 && x < this.XT1) {
        const u = (x - this.XT0) / (this.XT1 - this.XT0) * 4;
        ta = 1.6 * Math.sin(u * Math.PI * 2);
      }
      acc += ta * this.swDX;
    }
  }

  annulus(x) {
    // radii of the flow path incl. inlet, combustor & turbine
    const x0 = D.rows[0].x0, xe = D.X_END;
    if (x < x0) {
      const u = clamp((x0 - x) / 1.2);
      const rt = D.rTip(x0) + 0.35 * Math.pow(u, 1.6);
      const rh = Math.max(0.05, D.rHub(x0) * Math.sqrt(Math.max(0, 1 - Math.pow(u * 0.95, 2))));
      return [rh + 0.02, rt - 0.03];
    }
    if (x <= xe + 0.3) return [D.rHub(Math.min(x, xe)), D.rTip(Math.min(x, xe))];
    const rh0 = D.rHub(xe), rt0 = D.rTip(xe);
    const blend = (a, b, u) => a + (b - a) * smooth(u);
    if (x < this.XC0) { const u = (x - xe - 0.3) / (this.XC0 - xe - 0.3); return [blend(rh0, 0.80, u), blend(rt0, 1.12, u)]; }
    if (x < this.XT0) { const u = (x - this.XC1) / (this.XT0 - this.XC1); return [x < this.XC1 ? 0.82 : blend(0.82, 0.64, u), x < this.XC1 ? 1.10 : blend(1.10, 0.98, u)]; }
    const u = clamp((x - this.XT0) / (this.XT1 - this.XT0));
    return [0.64, 0.98 + 0.18 * u];
  }

  // engine: false -> particles fade after compressor exit
  updateParticles(t, opts) {
    const { speed = 1.0, opacity = 1, engine = false, xFront = 1e9, reverse = 0, sizeK = 1 } = opts;
    this.pmat.uniforms.uOpacity.value = opacity;
    this.pmatX.uniforms.uOpacity.value = opacity;
    this.points.visible = this.pointsX.visible = opacity > 0.001;
    if (!this.points.visible) return;
    const NP = this.NP, TR = this.TR;
    const xa = -1.4, xb = engine ? this.XT1 + 0.8 : D.X_END + 0.9;
    const L = xb - xa;
    const dxTrail = 0.018 * speed;
    const T0in = D.T01, T0out = D.T0_OUT;
    let o = 0;
    for (let i = 0; i < NP; i++) {
      const head = xa + ((this.pph[i] * L + t * speed) % L + L) % L;
      for (let k = 0; k < TR; k++) {
        const x = head - k * dxTrail * (1 + reverse * 0);
        const [rh, rt] = this.annulus(x);
        const r = rh + this.pf[i] * (rt - rh);
        const si = clamp(Math.round((x - this.swX0) / this.swDX), 0, this.swirl.length - 1);
        const th = this.pth[i] + this.swirl[si] / Math.max(0.4, r);
        this.ppos[o * 3] = x; this.ppos[o * 3 + 1] = r * Math.cos(th); this.ppos[o * 3 + 2] = r * Math.sin(th);
        // colour by total temperature
        let f;
        if (x < D.X_END + 0.3) f = 0.62 * (D.T0(x) - T0in) / (T0out - T0in);
        else if (!engine) f = 0.62;
        else if (x < this.XC0 + 0.2) f = 0.62 + 0.36 * smooth((x - D.X_END - 0.3) / (this.XC0 + 0.2 - D.X_END - 0.3));
        else if (x < this.XT0) f = 0.98;
        else f = 0.98 - 0.25 * clamp((x - this.XT0) / (this.XT1 - this.XT0 + 0.8));
        const c = heat(f);
        const fade = 1 - k / TR;
        let a = fade * fade;
        // fade in/out at ends
        a *= smooth((x - xa) / 0.5) * smooth((xb - x) / 0.5);
        if (x > xFront) a = 0;
        const boost = 1.25 + 0.9 * f;
        this.pcol[o * 3] = c[0] * boost; this.pcol[o * 3 + 1] = c[1] * boost; this.pcol[o * 3 + 2] = c[2] * boost;
        this.palpha[o] = a;
        this.psize[o] = this.psz[i] * (0.072 - 0.0045 * k) * sizeK;
        o++;
      }
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }

  buildStage() {
    const grid = new THREE.GridHelper(40, 80, 0x1d6f8a, 0x0d2f3d);
    grid.position.set(2.5, -2.3, 0);
    grid.material.transparent = true; grid.material.opacity = 0.22; grid.material.depthWrite = false;
    this.grid = grid;
    this.scene.add(grid);
    const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(-2, 4, 5); this.scene.add(key);
  }

  setHighlight(h) {
    // h: {rotor, stator, igv, hub, casing} in [0, 1+]
    const tint = (k, v, col) => {
      const m = this.mat[k];
      m.color.copy(this.baseColor[k]);
      if (v > 0) m.color.lerp(col, Math.min(1, v) * 0.55).multiplyScalar(1 + 0.9 * v);
    };
    tint('rotor', h.rotor || 0, new THREE.Color(0.35, 0.9, 1.0));
    tint('stator', h.stator || 0, new THREE.Color(1.0, 0.7, 0.3));
    tint('igv', h.igv || 0, new THREE.Color(0.6, 1.0, 0.8));
    tint('hub', h.hub || 0, new THREE.Color(0.5, 0.8, 1.0));
    tint('casing', h.casing || 0, new THREE.Color(0.3, 0.8, 1.0));
  }

  render(state) {
    const cam = this.camera;
    cam.position.copy(state.camPos); cam.fov = state.fov; cam.updateProjectionMatrix();
    cam.up.set(0, 1, 0);
    cam.lookAt(state.camTarget);
    if (state.roll) cam.rotateZ(state.roll);
    this.rotorGroup.rotation.x = state.rotorAngle;
    this.setHighlight(state.highlight || {});
    this.bloom.strength = state.bloom ?? 0.32;
    this.renderer.toneMappingExposure = state.exposure ?? 1.0;
    this.setEngineVisible(!!state.engine);
    if (state.engine) {
      const eo = state.engineOpacity ?? 1;
      this.mat.engineCasing.opacity = eo; this.mat.engineCasing.transparent = eo < 1;
      this.flameMat.opacity = (0.35 + 0.15 * Math.sin(state.t * 23.0) * Math.sin(state.t * 7.3)) * eo;
      this.mat.turbine.transparent = eo < 1; this.mat.turbine.opacity = eo;
    }
    this.ghostMat.opacity = 0.03 * (state.ghost ?? 1);
    this.ringMat.opacity = 0.18 * (state.ghost ?? 1);
    this.grid.material.opacity = 0.22 * (state.grid ?? 1);
    this.updateParticles(state.t, state.particles || { opacity: 0 });
    this.composer.render();
  }
}

function turbineBlade(row, rh, rt, kind) {
  const nSpan = 5, nChord = 12;
  const xc = (row.x0 + row.x1) / 2;
  const sections = [];
  for (let k = 0; k < nSpan; k++) {
    const f = k / (nSpan - 1);
    const r = (kind === 'trot' ? rh - 0.01 : rh) + ((kind === 'trot' ? rt - 0.01 : rt + 0.02) - rh) * f;
    const ain = kind === 'ngv' ? 0 : (40 - 10 * f) * Math.PI / 180;
    const aout = kind === 'ngv' ? (66 - 6 * f) * Math.PI / 180 : -(58 + 6 * f) * Math.PI / 180;
    const af = D.airfoil2D(ain, aout, row.chord, 0.2, nChord);
    let minx = 1e9, maxx = -1e9, cs = 0;
    for (const p of af.loop) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); cs += p[1]; }
    cs /= af.loop.length;
    const dx = xc - (minx + maxx) / 2;
    sections.push({ r, loop: af.loop.map(p => [p[0] + dx, p[1] - cs]) });
  }
  const M = sections[0].loop.length;
  const pos = [], idx = [];
  for (const sec of sections) for (const [x, s] of sec.loop) { const th = s / sec.r; pos.push(x, sec.r * Math.cos(th), sec.r * Math.sin(th)); }
  for (let k = 0; k < nSpan - 1; k++) for (let j = 0; j < M; j++) {
    const j2 = (j + 1) % M; const a = k * M + j, b = k * M + j2, c = (k + 1) * M + j, d = (k + 1) * M + j2;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// Controlled dark "studio" environment: gradient dome + soft key box + cyan rim strip
function studioEnv() {
  const sc = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vD; void main(){ float h = smoothstep(-0.4, 0.9, vD.y); vec3 c = mix(vec3(0.02,0.026,0.04), vec3(0.16,0.19,0.24), h); gl_FragColor = vec4(c,1.0); }',
  }));
  sc.add(dome);
  const box = (w, h, col, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    m.position.copy(pos); m.lookAt(0, 0, 0); sc.add(m);
  };
  box(44, 30, new THREE.Color(1.5, 1.45, 1.38), new THREE.Vector3(-24, 26, 18));   // key softbox (upper left, slightly front)
  box(7, 50, new THREE.Color(0.35, 1.25, 1.7), new THREE.Vector3(34, 4, -18));     // cyan rim strip (right, behind)
  box(60, 20, new THREE.Color(0.12, 0.16, 0.24), new THREE.Vector3(0, -30, 20));   // faint floor bounce
  box(12, 34, new THREE.Color(0.7, 0.5, 0.32), new THREE.Vector3(-36, 2, -16));  // warm kicker (left, behind)
  return sc;
}
