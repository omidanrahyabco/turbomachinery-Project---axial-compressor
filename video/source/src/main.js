import * as THREE from 'three';
import * as D from './design.js';
import { World, W, H } from './scene3d.js';
import { Overlay, Labels, tex, rich } from './overlay.js';
import { Cascade } from './cascade.js';
import { TSDiagram, CompressorMap, drawAnnulus, drawStaircase, drawColorbar, roundRect } from './plots.js';
import { clamp, lerp, smooth, easeInOut, easeOut, prog, win, pmap, rgb } from './util.js';

export const TOTAL = 118.0;

const world = new World(document.getElementById('glwrap'));
const gl = world.renderer.domElement;
const c2d = document.getElementById('c2d');
const ctx = c2d.getContext('2d');
const ui = document.getElementById('ui');
const fadeEl = document.getElementById('fade');
const titleBg = document.getElementById('titlebg');
const ov = new Overlay(ui);
const labels = new Labels(ui);
const cas = new Cascade();
const ts = new TSDiagram();
const cmap = new CompressorMap();

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rowsR = D.rows.filter(r => r.kind === 'rotor');
const rowsS = D.rows.filter(r => r.kind === 'stator');
const mid = r => (r.x0 + r.x1) / 2;
const polar = (x, r, deg) => V(x, r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180));

// ------------------------------------------------------------------ camera path
const xS1 = (rowsR[0].x0 + rowsS[0].x1) / 2;
function flyPos(t) {
  // fly-over just outside the blade tips (front, cut-away side)
  const x = lerp(-0.9, 1.25, easeInOut(prog(t, 0, 7.6)) * 0.85 + prog(t, 0, 7.6) * 0.15);
  const r = D.rTip(Math.max(x, 0)) + 0.30 - 0.06 * prog(t, 0, 7);
  return { pos: polar(x, r, 58), target: polar(x + 0.95, D.R_MEAN * 0.92, 42), fov: 46 };
}
const KEYS = [
  { t: 7.6, fly: true },
  { t: 12.5, pos: V(-2.7, 2.05, 6.0), target: V(1.85, 0.12, 0), fov: 32 },
  { t: 22.0, pos: V(-1.1, 2.6, 6.9), target: V(2.0, 0.12, 0), fov: 32 },
  { t: 25.5, pos: V(2.35, 1.25, 9.3), target: V(2.75, -0.30, 0), fov: 33 },
  { t: 37.6, pos: V(2.85, 1.55, 8.8), target: V(2.75, -0.28, 0), fov: 33 },
  { t: 41.2, pos: V(xS1 + 0.02, 0.0, D.R_MEAN + 3.2), target: V(xS1 + 0.02, 0.0, 0.0), fov: 12 },
  { t: 41.3, pos: V(xS1 + 0.02, 0.0, D.R_MEAN + 3.2), target: V(xS1 + 0.02, 0.0, 0.0), fov: 12 },
  { t: 103.0, pos: V(3.1, 3.1, 12.8), target: V(3.75, 0.55, 0), fov: 33 },
  { t: 113.0, pos: V(2.2, 2.4, 12.0), target: V(3.7, 0.55, 0), fov: 33 },
  { t: 118.0, pos: V(1.9, 2.2, 11.6), target: V(3.7, 0.55, 0), fov: 33 },
];
function camAt(t) {
  if (t < KEYS[0].t) return flyPos(t);
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (t <= b.t) {
      const A = a.fly ? flyPos(a.t) : a;
      const u = easeInOut((t - a.t) / (b.t - a.t));
      return { pos: A.pos.clone().lerp(b.pos, u), target: A.target.clone().lerp(b.target, u), fov: lerp(A.fov, b.fov, u) };
    }
  }
  const z = KEYS[KEYS.length - 1];
  return { pos: z.pos.clone(), target: z.target.clone(), fov: z.fov };
}

function project(v) {
  const p = v.clone().project(world.camera);
  if (p.z > 1) return null;
  return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H];
}

// ------------------------------------------------------------------ cue sheet
const chapter = (num, name, t0, t1) => ov.add({ html: `<div class="chap"><span class="num">${num}</span><span class="nm">${name}</span><div class="bar"></div></div>`, x: 96, y: 74, t0, t1, anim: 'left', fin: 0.7 });
const eq = (o) => ov.add({ cls: 'eq ' + (o.c || ''), x: o.x ?? 1836, y: o.y, tex: o.tex, title: o.title, note: o.note, t0: o.t0, t1: o.t1, anim: 'right', fin: 0.6, align: 'rightbox' });
const cap = (html, t0, t1, y = 948, x = 96, w = 1150) => ov.add({ cls: 'cap', html, x, y, w, t0, t1, anim: 'up', fin: 0.6 });

// C0 intro ---------------------------------------------------------
ov.add({ cls: 'kicker', html: 'Turbomachinery &nbsp;·&nbsp; Amirkabir University of Technology', x: 960, y: 330, align: 'center', t0: 0.6, t1: 6.9, fin: 0.9 });
ov.add({ cls: 'title', html: 'AXIAL COMPRESSOR', x: 960, y: 380, align: 'center', t0: 1.1, t1: 6.9, anim: 'scale', fin: 1.2 });
ov.add({ cls: 'subtitle', html: 'How rows of spinning wings squeeze air to <span style="color:#ffb347">12×</span> atmospheric pressure', x: 960, y: 560, align: 'center', t0: 2.3, t1: 6.9, fin: 0.9 });
ov.add({ cls: 'small', html: 'physics-based animation · written as code with AI', x: 960, y: 640, align: 'center', t0: 3.2, t1: 6.9, fin: 0.9 });
ov.add({ cls: 'credit', html: 'Alireza Bayati &nbsp;·&nbsp; Melika Bali', x: 960, y: 712, align: 'center', t0: 3.7, t1: 6.9, fin: 0.8 });
ov.add({ cls: 'small', html: '<span style="color:#d8e6f5;text-shadow:0 0 12px #000,0 0 3px #000">supervised by Dr. Nader Montazerin</span>', x: 960, y: 768, align: 'center', t0: 4.0, t1: 6.9, fin: 0.8 });

// C1 anatomy -------------------------------------------------------
chapter('01', 'Anatomy', 7.6, 22.3);
ov.add({ cls: 'small', html: 'MGT-70-class heavy-duty compressor &nbsp;·&nbsp; 16 stages &nbsp;·&nbsp; 3000 rpm &nbsp;·&nbsp; motion slowed ≈ 600×', x: 96, y: 136, t0: 8.2, t1: 22.3 });
const igv = D.rows[0];
labels.add({ text: 'Inlet guide vanes', sub: 'set the inflow angle (variable)', anchor: () => polar(mid(igv), D.R_MEAN + 0.05, 112), dx: -200, dy: 90, t0: 9.0, t1: 21.8, color: '#9cffd0' });
labels.add({ text: 'Rotor blades', sub: 'spin with the shaft → add energy', anchor: () => polar(mid(rowsR[2]), D.rTip(mid(rowsR[2])) - 0.06, 62), dx: -60, dy: -230, t0: 10.4, t1: 21.8, color: '#46e3ff' });
labels.add({ text: 'Stator vanes', sub: 'fixed in the casing → speed becomes pressure', anchor: () => polar(mid(rowsS[5]), D.rTip(mid(rowsS[5])) - 0.04, 62), dx: 60, dy: -250, t0: 12.0, t1: 21.8, color: '#ffb347' });
labels.add({ text: 'Casing (cut away)', sub: 'holds the stators, seals the blade tips', anchor: () => polar(3.0, D.rTip(3.0) + 0.07, 225), dx: 120, dy: 170, t0: 13.6, t1: 21.8, color: '#8fb8ff' });
labels.add({ text: 'Rotor drum & shaft', sub: 'driven by the turbine', anchor: () => V(D.X_END + 1.0, 0.0, D.rHub(D.X_END) * 0.55), dx: 40, dy: 160, t0: 15.2, t1: 21.8, color: '#c8d4e0' });
labels.add({ text: 'Annulus narrows', sub: 'denser air needs less flow area', anchor: () => V(3.75, D.rTip(3.75) + 0.07, 0), dx: 110, dy: -170, t0: 16.8, t1: 21.8, color: '#ff8a3d' });
cap('<b>1 stage</b> = 1 rotor row + 1 stator row. &nbsp;This machine stacks <em>16 stages</em> on one drum.', 18.0, 22.3);

// C2 flow ----------------------------------------------------------
chapter('02', 'Follow the air', 22.9, 38.2);
eq({ title: 'Continuity', tex: String.raw`\dot m=\rho\,c_x\,A=\text{const.}`, note: 'density ↑ &nbsp;⇒&nbsp; annulus area ↓ &nbsp;(A<sub>out</sub> ≈ 0.2 A<sub>in</sub>)', y: 150, t0: 26.4, t1: 38.2, w: 560 });
eq({ title: 'Pressure ratio', tex: String.raw`\pi_c=\pi_{st}^{\,N}=1.168^{16}\approx 12`, note: 'each stage adds only ≈ 17 %', y: 348, t0: 29.4, t1: 38.2, w: 560 });
eq({ title: 'Temperature rise', c: 'amb', tex: String.raw`T_{0,\text{out}}=T_{01}\,\pi_c^{\frac{\gamma-1}{\gamma\,\eta_p}}\approx 634\ \text{K}`, note: 'compression heats the air: 15 °C → ≈ 360 °C', y: 546, t0: 32.4, t1: 38.2, w: 560 });
cap('Colour = total temperature. &nbsp;The air spirals because every rotor gives it <b>swirl</b> and every stator takes it back.', 33.8, 38.3, 948, 96, 1100);

// C3 one stage -----------------------------------------------------
cap('Zoom into one stage and <b>unroll</b> the blade rows at mid-height …', 38.8, 42.4, 948, 96, 1100);
chapter('03', 'One stage, unrolled', 42.2, 58.3);
const tagR = ov.add({ cls: 'tag', html: 'ROTOR · moving with U', x: 250, y: 168, t0: 42.8, t1: 58.3 });
tagR.el.style.color = '#46e3ff'; tagR.el.style.borderColor = 'rgba(70,227,255,0.6)';
const tagS = ov.add({ cls: 'tag', html: 'STATOR · fixed', x: 760, y: 168, t0: 43.2, t1: 58.3 });
tagS.el.style.color = '#ffb347'; tagS.el.style.borderColor = 'rgba(255,179,71,0.6)';
eq({ title: 'Velocity triangle', tex: String.raw`\vec c=\vec w+\vec U`, note: '<span style="color:#46e3ff">c</span> absolute · <span style="color:#ff5fa2">w</span> relative to blade · <span style="color:#ffd166">U = ωr</span> blade speed', y: 150, t0: 45.2, t1: 58.3, w: 600 });
eq({ title: 'Euler turbomachine equation', tex: String.raw`\Delta h_0=w_{shaft}=U\,(c_{\theta 2}-c_{\theta 1})`, note: 'work per kg = blade speed × swirl added', y: 362, t0: 50.4, t1: 58.3, w: 600 });
eq({ title: 'Design coefficients', c: 'grn', tex: String.raw`\phi=\frac{c_x}{U}\approx0.55,\qquad\psi=\frac{\Delta h_0}{U^2}\approx0.35`, y: 576, t0: 53.4, t1: 58.3, w: 600 });
cap('The rotor <b>turns the relative flow</b> (w₁ → w₂) and so adds swirl; the stator <em>removes it again</em>.', 51.2, 58.4, 960, 96, 1120);
// velocity-triangle labels (positions set per frame)
const vlab = {};
for (const k of ['c1', 'w1', 'U1', 'a1', 'b1', 'c2', 'w2', 'U2', 'a2', 'b2']) {
  const nm = { c1: 'c_1', w1: 'w_1', U1: 'U', a1: '\\alpha_1', b1: '\\beta_1', c2: 'c_2', w2: 'w_2', U2: 'U', a2: '\\alpha_2', b2: '\\beta_2' }[k];
  const col = { c: '#46e3ff', w: '#ff5fa2', U: '#ffd166', a: '#46e3ff', b: '#ff5fa2' }[k[0]];
  const el = document.createElement('div'); el.className = 'cue vlab';
  el.innerHTML = tex(nm, false); el.style.color = col; el.style.display = 'none';
  if (k[0] === 'a' || k[0] === 'b') el.style.fontSize = '30px';
  ui.appendChild(el); vlab[k] = el;
}

// C4 diffusion -----------------------------------------------------
chapter('04', 'Diffusion: speed → pressure', 58.8, 73.8);
eq({ title: 'Rotor (relative frame)', tex: String.raw`w_2<w_1\;\Rightarrow\;p_2>p_1`, y: 112, t0: 61.0, t1: 73.8, w: 600 });
eq({ title: 'Stator', c: 'amb', tex: String.raw`c_3<c_2\;\Rightarrow\;p_3>p_2`, y: 262, t0: 63.6, t1: 73.8, w: 600 });
eq({ title: 'Degree of reaction', c: 'grn', tex: String.raw`R=\frac{h_2-h_1}{h_3-h_1}\approx0.5`, note: 'half the static rise in the rotor, half in the stator', y: 412, t0: 66.0, t1: 73.8, w: 600 });
eq({ title: 'Diffusion limits', c: 'red', tex: String.raw`\begin{aligned}&\frac{w_2}{w_1}\ge0.72\quad(\text{de Haller})\\[4pt]&DF=1-\frac{w_2}{w_1}+\frac{\Delta w_\theta}{2\sigma w_1}\lesssim0.6\end{aligned}`, y: 628, t0: 68.4, t1: 73.8, w: 600 });
cap('Fluid slows → pressure rises. &nbsp;Slow it <em>too much</em> and the boundary layer separates: <em>stall</em>.', 69.2, 74.1, 960, 96, 1120);

// C5 thermodynamics -----------------------------------------------
chapter('05', 'Thermodynamics', 74.6, 88.6);
eq({ title: 'Isentropic efficiency', tex: String.raw`\eta_c=\frac{h_{03s}-h_{01}}{h_{03}-h_{01}}\approx0.86`, y: 150, t0: 77.2, t1: 88.6, w: 600 });
eq({ title: 'Polytropic relation', c: 'grn', tex: String.raw`\frac{T_{03}}{T_{01}}=\pi_c^{\frac{\gamma-1}{\gamma\,\eta_p}}\ ,\qquad \eta_p\approx0.90`, y: 352, t0: 80.0, t1: 88.6, w: 600 });
eq({ title: 'Shaft power absorbed', c: 'amb', tex: String.raw`\dot W=\dot m\,c_p\,(T_{03}-T_{01})`, note: '≈ 540 kg/s × 1.005 kJ/kg·K × 346 K &nbsp;≈&nbsp; <b style="color:#fff">190 MW</b>', y: 566, t0: 83.0, t1: 88.6, w: 600 });
cap('16 stages = 16 small steps up the T–s diagram. &nbsp;Every loss pushes the path to the right (entropy ↑).', 83.4, 88.9, 960, 96, 1120);

// C6 limits -------------------------------------------------------
chapter('06', 'Limits: stall & surge', 89.6, 103.6);
eq({ title: 'Similarity (map axes)', tex: String.raw`\frac{\dot m\sqrt{T_{01}}}{p_{01}}\,,\ \ \frac{N}{\sqrt{T_{01}}}\ \Rightarrow\ \pi_c,\ \eta_c`, x: 1836, y: 110, t0: 91.0, t1: 97.0, w: 680 });
eq({ title: 'Surge margin', c: 'red', tex: String.raw`SM=\frac{\pi_s/\dot m_s}{\pi_{op}/\dot m_{op}}-1\ \approx 15\text{–}25\,\%`, x: 1836, y: 110, t0: 97.4, t1: 103.6, w: 680 });
ov.add({ cls: 'small', html: 'FRONT VIEW · ROTOR ROW', x: 1460, y: 300, align: 'center', t0: 92.0, t1: 103.6 });
const stallTag = ov.add({ cls: 'tag', html: 'ROTATING STALL · cell turns at ≈ ½ rotor speed', x: 1460, y: 935, align: 'center', t0: 95.6, t1: 99.0 });
stallTag.el.style.color = '#ff6b84'; stallTag.el.style.borderColor = 'rgba(255,59,92,0.7)';
ov.add({ cls: 'big', html: '<span style="color:#ff3b5c">SURGE</span> — flow reverses', x: 1460, y: 930, align: 'center', t0: 98.6, t1: 100.7, anim: 'scale', fin: 0.15 });
cap('Cure: <b>variable guide vanes</b> and <b>bleed valves</b> keep the operating point away from the surge line.', 100.8, 103.8, 960, 96, 1120);

// C7 big picture ----------------------------------------------------
chapter('07', 'The big picture', 104.4, 112.7);
labels.add({ text: 'Compressor', sub: '≈ ½ of the turbine work', anchor: () => V(1.6, -D.rTip(1.6) - 0.07, 0), dx: -60, dy: 190, t0: 105.4, t1: 112.6, color: '#46e3ff' });
labels.add({ text: 'Combustor', sub: 'fuel adds heat at ≈ constant p', anchor: () => V(world.XC0 + 0.6, -1.42, 0), dx: 40, dy: 170, t0: 106.4, t1: 112.6, color: '#ff8a3d' });
labels.add({ text: 'Turbine', sub: 'drives the compressor + generator', anchor: () => V(world.XT0 + 0.6, -1.3, 0), dx: 150, dy: 120, t0: 107.4, t1: 112.6, color: '#ff5f3d' });
ov.add({ cls: 'card', html: `<h3>Catalogue target · MAPNA MGT-70(3)</h3><div class="spec">
  <span class="k">Compressor</span><span class="v">16 stages + VIGV</span>
  <span class="k">Pressure ratio</span><span class="v">12 : 1</span>
  <span class="k">Shaft speed</span><span class="v">3000 rpm</span>
  <span class="k">Exhaust flow</span><span class="v">554 kg/s</span>
  <span class="k">GT output / η</span><span class="v">185 MW · 36.4 %</span></div>`, x: 1836, y: 120, align: 'rightbox', t0: 108.4, t1: 112.8, anim: 'right' });
cap('One shaft: the turbine drives the compressor that feeds it.', 108.4, 112.9, 150, 96, 900);

// C8 end ----------------------------------------------------------
ov.add({ cls: 'kicker', html: 'Turbomachinery course project · Phase 1', x: 960, y: 300, align: 'center', t0: 113.6, t1: 118.2, fin: 0.8 });
ov.add({ cls: 'big', html: 'AI-Assisted Reverse Engineering of an Axial Compressor', x: 960, y: 350, align: 'center', t0: 113.8, t1: 118.2, fin: 0.9 });
ov.add({ cls: 'credit', html: '<span class="r">Team</span>Alireza Bayati &nbsp;·&nbsp; Melika Bali', x: 640, y: 500, align: 'center', t0: 114.3, t1: 118.2, fin: 0.8 });
ov.add({ cls: 'credit', html: '<span class="r">Supervisor</span>Dr. Nader Montazerin', x: 1280, y: 500, align: 'center', t0: 114.5, t1: 118.2, fin: 0.8 });
ov.add({ cls: 'small', html: 'Amirkabir University of Technology (Tehran Polytechnic) · Mehr 1405 / October 2026', x: 960, y: 650, align: 'center', t0: 114.9, t1: 118.2, fin: 0.8 });
ov.add({ cls: 'small', html: 'Animation written as code by Claude (Anthropic AI) · three.js + KaTeX · values from first-pass calculations', x: 960, y: 690, align: 'center', t0: 115.2, t1: 118.2, fin: 0.8 });

// ------------------------------------------------------------------ frame
const OMEGA = 0.5; // visual rotor speed (rad/s)

function frame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // 3-D visibility (cross-fades to the 2-D chapters)
  const a3 = t < 42.6 ? 1 - smooth(prog(t, 41.2, 42.6)) : smooth(prog(t, 103.2, 104.6));
  gl.style.opacity = a3.toFixed(3);
  gl.style.display = a3 > 0.001 ? 'block' : 'none';
  if (a3 > 0.001) {
    const cam = camAt(t);
    const hl = {
      igv: win(t, 9.0, 11.0, 0.4) * 0.9,
      rotor: win(t, 10.4, 12.6, 0.4) + win(t, 105.4, 107.0, 0.4) * 0.6,
      stator: win(t, 12.0, 14.2, 0.4),
      casing: win(t, 13.6, 15.6, 0.4),
      hub: win(t, 15.2, 17.2, 0.4),
    };
    // particles
    let pOp = 0, xFront = 1e9, engine = false;
    if (t < 8.5) pOp = 0.85 * (1 - smooth(prog(t, 6.5, 8.5)));
    else if (t < 23) pOp = 0;
    else if (t < 43) { pOp = smooth(prog(t, 23, 24)); xFront = lerp(-1.4, D.X_END + 1.0, smooth(prog(t, 23.2, 29.5))); }
    else { pOp = smooth(prog(t, 104.0, 105.2)); engine = true; xFront = lerp(-1.4, world.XT1 + 1.0, smooth(prog(t, 104.0, 107.8))); }
    if (t > 43 && t < 103) pOp = 0;
    const engineOn = t > 103;
    world.render({
      t, camPos: cam.pos, camTarget: cam.target, fov: cam.fov,
      rotorAngle: OMEGA * t,
      highlight: hl,
      bloom: t < 7 ? 0.75 : 0.55,
      engine: engineOn, engineOpacity: smooth(prog(t, 103.2, 105.0)),
      particles: { opacity: pOp, xFront, engine, speed: 1.0, sizeK: t < 8 ? 0.8 : 1.0 },
      ghost: t < 7 ? 0.4 : 1, grid: 1,
    });
    labels.update(t, ctx, project);
    // 3-D HUD
    if (t > 23 && t < 39.5) {
      const front = lerp(-1.4, D.X_END + 1.0, smooth(prog(t, 23.2, 29.5)));
      const pr = clamp((front - rowsR[0].x0) / (D.X_END - rowsR[0].x0));
      drawStaircase(ctx, pr, win(t, 24.4, 38.4, 0.6), { x: 96, y: 160, w: 600, h: 200 });
      drawColorbar(ctx, 96, 430, 300, 14, win(t, 24.8, 38.4, 0.6));
    }
  } else {
    labels.update(-1, ctx, project);
  }

  // 2-D chapters ------------------------------------------------
  const tc = t - 41.0;
  const aCas = smooth(prog(t, 40.9, 42.4)) * (1 - smooth(prog(t, 73.8, 75.0)));
  if (aCas > 0.001) {
    const triOn = win(t, 44.8, 58.6, 0.5);
    const diff = win(t, 59.2, 74.2, 0.8);
    cas.drawField(ctx, tc, diff * aCas);
    cas.drawParticles(ctx, tc, aCas * (1 - 0.55 * triOn) * (1 - 0.35 * diff));
    cas.drawBlades(ctx, tc, aCas * (1 - 0.25 * triOn));
    // U arrow on rotor
    const ua = win(t, 43.2, 58.6, 0.5) * aCas;
    if (ua > 0) {
      ctx.save(); ctx.globalAlpha = ua;
      cas.arrow(ctx, cas.XR + cas.rot.ax + 70, -300, 0, 120, '#ffd166', 1, 5);
      ctx.restore();
      placeLab('U1', cas.XR + cas.rot.ax + 88, cas.sy(-260) - 30, ua);
    } else hideLab('U1');
    // velocity triangles
    const p1 = prog(t, 45.0, 47.4), p2 = prog(t, 48.4, 50.8);
    const fadeTri = win(t, 44.9, 58.6, 0.3) * (1 - diff) * aCas;
    if (fadeTri > 0.001) {
      ctx.save(); ctx.globalAlpha = fadeTri;
      const T1 = cas.triangle(ctx, 90, 0, D.ALPHA1, D.BETA1, 150, p1, { c: '#46e3ff', w: '#ff5fa2', U: '#ffd166' });
      const xg = cas.XR + cas.rot.ax + 28;
      const T2 = p2 > 0 ? cas.triangle(ctx, xg, 0, D.ALPHA2, D.BETA2, 150, p2, { c: '#46e3ff', w: '#ff5fa2', U: '#ffd166' }) : null;
      ctx.restore();
      placeLab('w1', T1.w[0] - 64, T1.w[1] - 50, fadeTri * clamp(p1 * 3));
      placeLab('c1', T1.c[0] + 10, T1.c[1] - 8, fadeTri * clamp(p1 * 3 - 2));
      placeLab('a1', T1.a[0] + 26, T1.a[1] - 16, fadeTri * clamp(p1 * 3 - 2));
      placeLab('b1', T1.b[0] + 18, T1.b[1] - 34, fadeTri * clamp(p1 * 3));
      if (T2) {
        placeLab('w2', T2.w[0] - 66, T2.w[1] - 46, fadeTri * clamp(p2 * 3));
        placeLab('c2', T2.c[0] + 12, T2.c[1] + 0, fadeTri * clamp(p2 * 3 - 2));
        placeLab('U2', T2.U[0] + 12, T2.U[1] - 26, fadeTri * clamp(p2 * 3 - 1));
        placeLab('a2', T2.a[0] + 24, T2.a[1] - 6, fadeTri * clamp(p2 * 3 - 2));
        placeLab('b2', T2.b[0] + 18, T2.b[1] - 34, fadeTri * clamp(p2 * 3));
      } else ['w2', 'c2', 'U2', 'a2', 'b2'].forEach(hideLab);
    } else ['w1', 'c1', 'a1', 'b1', 'w2', 'c2', 'U2', 'a2', 'b2'].forEach(hideLab);
    // diffusion chapter: compare speeds
    if (diff > 0.001) {
      const A = diff * aCas;
      ctx.save(); ctx.globalAlpha = A;
      const s = 150;
      const pa = prog(t, 60.6, 62.0), pb = prog(t, 63.2, 64.6);
      // rotor: w1 (inlet) vs w2 (exit)
      const w1 = [s, s * Math.tan(D.ALPHA1) - s / D.PHI], w2 = [s, s * Math.tan(D.ALPHA2) - s / D.PHI];
      cas.arrow(ctx, cas.XR - 175, 300, w1[0], w1[1], '#ff5fa2', pa, 6);
      cas.arrow(ctx, cas.XR + cas.rot.ax + 25, 300, w2[0], w2[1], '#ff5fa2', pa, 6);
      // stator: c2 vs c3
      const c2 = [s, s * Math.tan(D.ALPHA2)], c3 = [s, s * Math.tan(D.ALPHA1)];
      cas.arrow(ctx, cas.XS - 170, -420, c2[0], c2[1], '#46e3ff', pb, 6);
      cas.arrow(ctx, cas.XS + cas.sta.ax + 25, -420, c3[0], c3[1], '#46e3ff', pb, 6);
      // pressure colour bar
      const gx = 96, gy = 1000;
      const g = ctx.createLinearGradient(gx, 0, gx + 360, 0);
      for (let k = 0; k <= 10; k++) g.addColorStop(k / 10, rgb(pmap(k / 10)));
      ctx.fillStyle = g; roundRect(ctx, gx + 900, 112, 300, 14, 7); ctx.fill();
      ctx.fillStyle = '#8aa0b8'; ctx.font = '500 18px "JetBrains Mono"'; ctx.fillText('low', gx + 900, 150); ctx.fillText('high', gx + 1158, 150);
      ctx.fillStyle = '#e8f1ff'; ctx.font = '600 19px "Space Grotesk"'; ctx.fillText('static pressure p', gx + 900, 100);
      ctx.restore();
      placeLab('w1', cas.XR - 175 + 30, cas.sy(300 + w1[1] * 0.5) - 6, A * pa, '#ff5fa2');
      placeLab('w2', cas.XR + cas.rot.ax + 25 + 70, cas.sy(300 + w2[1] * 0.5) - 6, A * pa, '#ff5fa2');
      placeLab('c2', cas.XS - 170 + 20, cas.sy(-420 + c2[1] * 0.5) + 6, A * pb);
      placeLab('c3x', cas.XS + cas.sta.ax + 25 + 60, cas.sy(-420 + c3[1] * 0.5) + 4, A * pb);
    } else hideLab('c3x');
  } else ['U1', 'w1', 'c1', 'a1', 'b1', 'w2', 'c2', 'U2', 'a2', 'b2', 'c3x'].forEach(hideLab);

  // T-s diagram
  const aTS = smooth(prog(t, 74.6, 75.8)) * (1 - smooth(prog(t, 88.8, 89.8)));
  if (aTS > 0.001) ts.draw(ctx, t - 74.8, aTS);

  // compressor map + stall annulus
  const aMap = smooth(prog(t, 89.6, 90.8)) * (1 - smooth(prog(t, 103.2, 104.4)));
  if (aMap > 0.001) {
    const tm = t - 89.8;
    const N = 1.0;
    let u = 0.62, col = '#ffffff', trail = null, flash = 0;
    if (t > 94.0 && t < 98.6) u = lerp(0.62, 0.0, easeInOut(prog(t, 94.0, 98.6)));
    if (t >= 98.6 && t < 100.6) {
      // surge cycle: drop to low flow / low pressure and back
      const k = prog(t, 98.6, 100.6);
      const [ms, ps] = cmap.pt(N, 0);
      const ang = k * Math.PI * 2;
      col = '#ff3b5c';
      flash = Math.max(0, 1 - k * 2.2) + 0.5 * Math.max(0, Math.sin(k * Math.PI * 4));
      const m = ms - 0.26 * Math.sin(ang / 2) ** 0.7, p = ps - 5.0 * Math.sin(ang / 2);
      state.op = [m, p];
    }
    if (t >= 100.6) u = lerp(0.0, 0.62, easeInOut(prog(t, 100.6, 102.6)));
    if (!(t >= 98.6 && t < 100.6)) state.op = cmap.pt(N, u);
    if (t > 96.5 && t < 98.6) col = '#ffb347';
    cmap.draw(ctx, tm, aMap, { op: t > 91.8 ? state.op : null, opColor: col, surgeFlash: flash });
    const stall = smooth(prog(t, 95.4, 97.4)) * (1 - smooth(prog(t, 100.4, 101.6)));
    const surge = win(t, 98.6, 100.6, 0.1, 0.6) * (0.6 + 0.4 * Math.sin(t * 30));
    drawAnnulus(ctx, t, aMap * smooth(prog(t, 91.2, 92.4)), { cx: 1460, cy: 620, rt: 270, rh: 140, omega: 1.3, stall, surge });
  }

  ov.update(t);
  // global fades
  let f = 0;
  if (t < 0.6) f = 1 - smooth(t / 0.6);
  if (t > 113.0) f = 0.78 * smooth(prog(t, 113.0, 114.0));
  if (t > 117.3) f = Math.max(f, smooth(prog(t, 117.3, 118.0)));
  fadeEl.style.opacity = f.toFixed(3);
  titleBg.style.opacity = win(t, 0.3, 7.2, 0.8, 0.8).toFixed(3);
  // keep end-card text above the fade
  ui.style.zIndex = 5; fadeEl.style.zIndex = t > 113 && t < 117.3 ? 4 : 6;
}
const state = { op: null };

function placeLab(k, x, y, a, color) {
  let el = vlab[k];
  if (!el && k === 'c3x') {
    el = document.createElement('div'); el.className = 'cue vlab'; el.innerHTML = tex('c_3', false); el.style.color = '#46e3ff'; ui.appendChild(el); vlab[k] = el;
  }
  if (!el) return;
  if (a <= 0.001) { el.style.display = 'none'; return; }
  el.style.display = 'block'; el.style.opacity = a.toFixed(3);
  el.style.left = x.toFixed(1) + 'px'; el.style.top = y.toFixed(1) + 'px';
  if (color) el.style.color = color;
}
function hideLab(k) { if (vlab[k]) vlab[k].style.display = 'none'; }

window.TOTAL = TOTAL;
window.seek = async (t) => {
  frame(t);
  // force GPU completion before the screenshot
  const g = world.renderer.getContext(); const px = new Uint8Array(4); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
  return true;
};
const FONTS = ['700 132px "Space Grotesk"', '600 30px "Space Grotesk"', '500 34px "Space Grotesk"', '400 30px "Inter"', '500 30px "Inter"', '600 30px "Inter"',
  '400 20px "JetBrains Mono"', '500 20px "JetBrains Mono"', '700 30px "JetBrains Mono"', '400 30px KaTeX_Main', 'italic 400 30px KaTeX_Math', '400 30px KaTeX_Size1', '400 30px KaTeX_Size2'];
Promise.all(FONTS.map(f => document.fonts.load(f, 'AaΔπ0123→'))).then(() => document.fonts.ready).then(() => {
  // warm-up pass so every cue has been laid out once with its real font
  for (const c of ov.cues) { c.el.style.display = 'block'; c.el.style.opacity = '0'; }
  void ui.offsetHeight;
  frame(0); window.ready = true;
});
