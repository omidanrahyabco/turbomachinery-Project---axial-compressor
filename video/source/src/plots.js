// 2-D diagrams: T-s diagram, compressor map, rotating-stall annulus, pressure staircase HUD
import * as D from './design.js';
import { clamp, smooth, easeOut, lerp, rgb, heat } from './util.js';

const CY = '#46e3ff', AMB = '#ffb347', RED = '#ff3b5c', TXT = '#e8f1ff', DIM = '#7f93ab';
const R = 287, CP = 1005;

function glowLine(ctx, pts, color, width, prog = 1, blur = 14, dash = null) {
  if (prog <= 0 || pts.length < 2) return;
  const n = Math.max(2, Math.floor(pts.length * prog));
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.shadowColor = color; ctx.shadowBlur = blur;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke(); ctx.restore();
  return pts[n - 1];
}
function dot(ctx, x, y, r, color, blur = 20) {
  ctx.save(); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = blur;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function axes(ctx, x0, y0, x1, y1, alpha) {
  ctx.save(); ctx.globalAlpha = alpha;
  // grid
  ctx.strokeStyle = 'rgba(70,227,255,0.07)'; ctx.lineWidth = 1;
  for (let k = 0; k <= 10; k++) {
    const x = lerp(x0, x1, k / 10), y = lerp(y0, y1, k / 10);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200,230,255,0.75)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y1 - 10); ctx.lineTo(x0, y0); ctx.lineTo(x1 + 10, y0); ctx.stroke();
  // arrowheads
  ctx.fillStyle = 'rgba(200,230,255,0.75)';
  ctx.beginPath(); ctx.moveTo(x0, y1 - 22); ctx.lineTo(x0 - 7, y1 - 6); ctx.lineTo(x0 + 7, y1 - 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x1 + 22, y0); ctx.lineTo(x1 + 6, y0 - 7); ctx.lineTo(x1 + 6, y0 + 7); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- T-s diagram
export class TSDiagram {
  constructor() {
    this.x0 = 150; this.y0 = 870; this.x1 = 1040; this.y1 = 140;
    this.s0 = -110; this.s1 = 170; this.T0 = 240; this.T1 = 700;
  }
  X(s) { return lerp(this.x0, this.x1, (s - this.s0) / (this.s1 - this.s0)); }
  Y(T) { return lerp(this.y0, this.y1, (T - this.T0) / (this.T1 - this.T0)); }
  isobar(p) { // p in units of p01
    const pts = [];
    for (let k = 0; k <= 80; k++) {
      const s = lerp(this.s0, this.s1, k / 80);
      const T = D.T01 * Math.exp((s + R * Math.log(p)) / CP);
      if (T > this.T1 + 30 || T < this.T0 - 30) continue;
      pts.push([this.X(s), this.Y(T)]);
    }
    return pts;
  }
  draw(ctx, t, a) {
    // t: local time (s) since diagram start
    const A = clamp(a);
    axes(ctx, this.x0, this.y0, this.x1, this.y1, A);
    const pr = [1, 2, 4, 8, 12];
    ctx.save(); ctx.globalAlpha = A;
    pr.forEach((p, i) => {
      const pts = this.isobar(p);
      glowLine(ctx, pts, p === 1 || p === 12 ? 'rgba(70,227,255,0.85)' : 'rgba(70,227,255,0.30)', p === 1 || p === 12 ? 2.5 : 1.5, clamp((t - 0.3 - 0.15 * i) / 1.2), 6);
      const last = pts[pts.length - 1];
      if (t > 1.2 + 0.15 * i && last) {
        ctx.fillStyle = p === 1 || p === 12 ? CY : DIM; ctx.font = '500 24px "JetBrains Mono"';
        ctx.fillText(p === 1 ? 'p₀₁ = 1 bar' : p === 12 ? 'p₀₃ = 12 bar' : `${p} bar`, last[0] - (p === 12 ? 250 : 120), last[1] - 12);
      }
    });
    ctx.restore();
    const T03s = D.T01 * Math.pow(12, 0.4 / 1.4), T03 = D.T0_OUT;
    const s03 = CP * Math.log(T03 / D.T01) - R * Math.log(12);
    this.s03 = s03;
    // isentropic (ideal) path
    const pI = clamp((t - 2.2) / 1.6);
    ctx.save(); ctx.globalAlpha = A;
    glowLine(ctx, [[this.X(0), this.Y(D.T01)], [this.X(0), this.Y(T03s)]], '#9cff9c', 3, pI, 12, [10, 9]);
    // actual polytropic path
    const pts = [];
    for (let k = 0; k <= 100; k++) {
      const lp = Math.log(12) * k / 100;
      const s = R * (1 / D.ETA_P - 1) * lp;
      const T = D.T01 * Math.exp(lp * R / (CP * D.ETA_P));
      pts.push([this.X(s), this.Y(T)]);
    }
    const pA = clamp((t - 4.2) / 2.0);
    const end = glowLine(ctx, pts, AMB, 4.5, pA, 18);
    // staircase of 16 stages (appears later)
    const pS = clamp((t - 7.4) / 3.0);
    if (pS > 0) {
      const st = [];
      let s = 0, T = D.T01;
      for (let i = 0; i < D.N_STAGES; i++) {
        const pA_ = Math.pow(D.PI_STAGE, i), pB = pA_ * D.PI_STAGE;
        const Tis = T * Math.pow(D.PI_STAGE, 0.4 / 1.4);
        const Tn = D.T01 * Math.pow(pB, R / (CP * D.ETA_P));
        const sn = R * (1 / D.ETA_P - 1) * Math.log(pB);
        st.push([this.X(s), this.Y(T)], [this.X(s), this.Y(Tis)], [this.X(sn), this.Y(Tn)]);
        s = sn; T = Tn;
      }
      glowLine(ctx, st, 'rgba(255,255,255,0.85)', 2, pS, 8);
    }
    // state points
    const P = (s, T, lab, col, show, dx = 18, dy = -14) => {
      if (!show) return;
      dot(ctx, this.X(s), this.Y(T), 9, col);
      ctx.fillStyle = TXT; ctx.font = '600 30px "Space Grotesk"'; ctx.fillText(lab, this.X(s) + dx, this.Y(T) + dy);
    };
    P(0, D.T01, '01', CY, t > 1.8);
    P(0, T03s, '03s', '#9cff9c', pI >= 1, 16, 36);
    P(s03, T03, '03', AMB, pA >= 1);
    if (pA > 0 && pA < 1 && end) dot(ctx, end[0], end[1], 11, '#ffffff', 30);
    // loss annotation
    if (pA >= 1) {
      const la = clamp((t - 6.4) / 0.8);
      ctx.globalAlpha = A * la;
      const yL = this.Y(T03) + 0;
      ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.moveTo(this.X(0), this.Y(T03s)); ctx.lineTo(this.X(0), yL); ctx.lineTo(this.X(s03), yL); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = RED; ctx.font = '500 24px "Inter"';
      ctx.textAlign = 'right';
      ctx.fillText('extra work', this.X(0) - 16, (this.Y(T03s) + yL) / 2 + 2);
      ctx.fillText('spent on losses', this.X(0) - 16, (this.Y(T03s) + yL) / 2 + 30);
      ctx.textAlign = 'left';
    }
    // axis labels
    ctx.globalAlpha = A;
    ctx.fillStyle = DIM; ctx.font = '500 26px "Inter"';
    ctx.fillText('entropy  s  →', this.x1 - 170, this.y0 + 46);
    ctx.save(); ctx.translate(this.x0 - 60, this.y1 + 230); ctx.rotate(-Math.PI / 2); ctx.fillText('temperature  T  →', 0, 0); ctx.restore();
    // temperature ticks
    ctx.font = '400 20px "JetBrains Mono"';
    for (const T of [300, 400, 500, 600, 700]) { if (T > this.T1) continue; ctx.fillText(T + ' K', this.x0 - 92, this.Y(T) + 7); }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- compressor map
export class CompressorMap {
  constructor() {
    this.x0 = 140; this.y0 = 860; this.x1 = 1000; this.y1 = 150;
    this.m0 = 0.35; this.m1 = 1.15; this.p0 = 1; this.p1 = 16;
    this.speeds = [0.7, 0.8, 0.9, 1.0, 1.05];
  }
  X(m) { return lerp(this.x0, this.x1, (m - this.m0) / (this.m1 - this.m0)); }
  Y(p) { return lerp(this.y0, this.y1, (p - this.p0) / (this.p1 - this.p0)); }
  ms(N) { return 0.16 + 0.74 * Math.pow(N, 1.3); }
  mc(N) { return 0.26 + 0.79 * Math.pow(N, 1.15); }
  ptop(N) { return 1 + 13.2 * Math.pow(N, 2.5); }
  pt(N, u) { // u: 0 surge -> 1 choke
    const m = lerp(this.ms(N), this.mc(N), u);
    const p = 1 + (this.ptop(N) - 1) * (1 - 0.05 * u - 0.5 * Math.pow(u, 6));
    return [m, p];
  }
  draw(ctx, t, a, state) {
    const A = clamp(a);
    axes(ctx, this.x0, this.y0, this.x1, this.y1, A);
    ctx.save(); ctx.globalAlpha = A;
    // efficiency islands
    const [md, pd] = this.pt(1.0, 0.62);
    this.design = [md, pd];
    ctx.save(); ctx.beginPath(); ctx.rect(this.x0, this.y1, this.x1 - this.x0, this.y0 - this.y1); ctx.clip();
    const isl = [0.88, 0.86, 0.83, 0.79, 0.74];
    isl.forEach((e, i) => {
      const k = i + 1;
      const pi = clamp((t - 1.6 - 0.12 * i) / 0.8);
      if (pi <= 0) return;
      ctx.save(); ctx.globalAlpha = A * pi * 0.9;
      ctx.strokeStyle = `rgba(156,255,156,${0.55 - 0.08 * i})`; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(this.X(md - 0.035), this.Y(pd + 0.2), 40 + 62 * k, 26 + 50 * k, -0.62, 0, Math.PI * 2);
      ctx.stroke();
      if (i === 0) { ctx.fillStyle = '#9cff9c'; ctx.font = '500 20px "JetBrains Mono"'; ctx.fillText('η = 0.88', this.X(md - 0.035) - 42, this.Y(pd + 0.2) + 7); }
      ctx.restore();
    });
    ctx.restore();
    // speed lines
    this.speeds.forEach((N, i) => {
      const pts = [];
      for (let k = 0; k <= 60; k++) { const [m, p] = this.pt(N, k / 60); pts.push([this.X(m), this.Y(p)]); }
      const pr = clamp((t - 0.4 - 0.18 * i) / 1.0);
      glowLine(ctx, pts, 'rgba(70,227,255,0.85)', 2.4, pr, 8);
      if (pr >= 1) {
        const [m, p] = this.pt(N, 1);
        ctx.fillStyle = CY; ctx.font = '500 20px "JetBrains Mono"';
        ctx.fillText(`${Math.round(N * 100)}% N`, this.X(m) + 8, this.Y(p) + 20);
      }
    });
    // surge line
    const sl = [];
    for (let k = 0; k <= 40; k++) { const N = lerp(0.62, 1.1, k / 40); sl.push([this.X(this.ms(N)), this.Y(this.ptop(N))]); }
    const ps = clamp((t - 1.4) / 1.0);
    const flash = state.surgeFlash || 0;
    glowLine(ctx, sl, flash > 0 ? `rgba(255,${Math.round(59 + 120 * (1 - flash))},92,1)` : RED, 4 + 3 * flash, ps, 16 + 30 * flash);
    if (ps >= 1) {
      const e = sl[sl.length - 6];
      ctx.fillStyle = RED; ctx.font = '700 28px "Space Grotesk"'; ctx.fillText('SURGE LINE', e[0] - 230, e[1] - 6);
    }
    // choke label
    if (t > 2.4) { ctx.fillStyle = DIM; ctx.font = '600 24px "Space Grotesk"'; ctx.fillText('CHOKE', this.X(1.06), this.Y(2.6)); }
    // operating line
    const ol = [];
    for (let k = 0; k <= 40; k++) { const m = lerp(0.48, 1.06, k / 40); ol.push([this.X(m), this.Y(1 + (pd - 1) * Math.pow(m / md, 2.4))]); }
    glowLine(ctx, ol, 'rgba(255,255,255,0.6)', 2, clamp((t - 2.0) / 1.0), 6, [8, 8]);
    if (t > 3.0) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '500 20px "Inter"'; ctx.fillText('operating line', ol[34][0] + 12, ol[34][1] + 28); }
    // operating point
    if (state.op) {
      const [m, p] = state.op;
      const col = state.opColor || '#ffffff';
      dot(ctx, this.X(m), this.Y(p), 12, col, 34);
      if (state.opTrail) glowLine(ctx, state.opTrail.map(([mm, pp]) => [this.X(mm), this.Y(pp)]), col, 3, 1, 16);
    }
    // axis labels
    ctx.fillStyle = DIM; ctx.font = '500 25px "Inter"';
    ctx.fillText('corrected mass flow  ṁ√T₀₁ / p₀₁  →', this.x1 - 430, this.y0 + 48);
    ctx.save(); ctx.translate(this.x0 - 50, this.y1 + 360); ctx.rotate(-Math.PI / 2); ctx.fillText('pressure ratio  π  →', 0, 0); ctx.restore();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- rotating stall (front view)
export function drawAnnulus(ctx, t, a, opts) {
  const { cx = 1440, cy = 560, rt = 300, rh = 150, omega = 1.2, stall = 0, nb = 36, surge = 0 } = opts;
  const A = clamp(a);
  if (A <= 0) return;
  ctx.save(); ctx.globalAlpha = A;
  // flow glow in annulus
  const g = ctx.createRadialGradient(cx, cy, rh, cx, cy, rt);
  g.addColorStop(0, 'rgba(20,90,140,0.35)'); g.addColorStop(1, 'rgba(70,227,255,0.12)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, rt, 0, Math.PI * 2); ctx.arc(cx, cy, rh, 0, Math.PI * 2, true); ctx.fill();
  // stall cells
  const th = omega * t;
  const cellAng = th * 0.5;
  if (stall > 0) {
    for (let c = 0; c < 2; c++) {
      const a0 = cellAng + c * Math.PI;
      const wdt = 0.55 * stall * (c === 0 ? 1 : 0.7);
      const sg = ctx.createRadialGradient(cx, cy, rh, cx, cy, rt);
      sg.addColorStop(0, `rgba(255,59,92,${0.15 * stall})`); sg.addColorStop(1, `rgba(255,59,92,${0.6 * stall})`);
      ctx.fillStyle = sg; ctx.shadowColor = RED; ctx.shadowBlur = 40;
      ctx.beginPath(); ctx.arc(cx, cy, rt + 6, a0 - wdt, a0 + wdt); ctx.arc(cx, cy, rh + 30, a0 + wdt, a0 - wdt, true); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  // blades (radial, slightly curved)
  for (let k = 0; k < nb; k++) {
    const ang = th + 2 * Math.PI * k / nb;
    let col = 'rgba(210,225,240,0.95)';
    if (stall > 0) {
      for (let c = 0; c < 2; c++) {
        let d = Math.atan2(Math.sin(ang - cellAng - c * Math.PI), Math.cos(ang - cellAng - c * Math.PI));
        if (Math.abs(d) < 0.55 * stall * (c === 0 ? 1 : 0.7)) col = 'rgba(255,120,140,1)';
      }
    }
    ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let j = 0; j <= 8; j++) {
      const r = lerp(rh, rt - 8, j / 8);
      const aa = ang + 0.18 * (j / 8) * (j / 8);
      const x = cx + r * Math.cos(aa), y = cy + r * Math.sin(aa);
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // hub + casing rings
  ctx.strokeStyle = CY; ctx.lineWidth = 3; ctx.shadowColor = CY; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(cx, cy, rt + 8, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#0a1622'; ctx.beginPath(); ctx.arc(cx, cy, rh - 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, rh - 4, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  // rotation arrow
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, rt + 40, -2.2, -1.2); ctx.stroke();
  const ex = cx + (rt + 40) * Math.cos(-1.2), ey = cy + (rt + 40) * Math.sin(-1.2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(ex + 14, ey + 4); ctx.lineTo(ex - 8, ey - 12); ctx.lineTo(ex - 6, ey + 14); ctx.fill();
  if (surge > 0) {
    ctx.fillStyle = `rgba(255,59,92,${0.35 * surge})`;
    ctx.beginPath(); ctx.arc(cx, cy, rt + 10, 0, Math.PI * 2); ctx.arc(cx, cy, rh, 0, Math.PI * 2, true); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- p0 staircase HUD
export function drawStaircase(ctx, prog, a, box = { x: 110, y: 760, w: 760, h: 230 }) {
  const A = clamp(a); if (A <= 0) return;
  const { x, y, w, h } = box;
  ctx.save(); ctx.globalAlpha = A;
  ctx.fillStyle = 'rgba(4,12,22,0.78)'; ctx.strokeStyle = 'rgba(70,227,255,0.35)'; ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 14); ctx.fill(); ctx.stroke();
  const px0 = x + 70, px1 = x + w - 30, py0 = y + h - 42, py1 = y + 40;
  ctx.strokeStyle = 'rgba(200,230,255,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(px0, py1); ctx.lineTo(px0, py0); ctx.lineTo(px1, py0); ctx.stroke();
  ctx.fillStyle = DIM; ctx.font = '500 18px "JetBrains Mono"';
  for (const v of [1, 4, 8, 12]) { const yy = lerp(py0, py1, (v - 1) / 11); ctx.fillText(String(v), px0 - 34, yy + 6); ctx.fillStyle = 'rgba(70,227,255,0.08)'; ctx.fillRect(px0, yy, px1 - px0, 1); ctx.fillStyle = DIM; }
  ctx.fillText('stage →', px1 - 80, py0 + 30);
  ctx.fillStyle = TXT; ctx.font = '600 20px "Space Grotesk"'; ctx.fillText('total pressure  p₀ / p₀₁', x + 22, y + 26);
  // bars
  const N = D.N_STAGES; const bw = (px1 - px0) / N;
  const sc = prog * N;
  for (let i = 0; i < N; i++) {
    const f = clamp(sc - i);
    if (f <= 0) break;
    const v = Math.pow(D.PI_STAGE, i + 1);
    const hh = (py0 - py1) * (v - 1) / 11 * easeOut(f);
    const c = heat(0.62 * (i + 1) / N);
    ctx.fillStyle = rgb(c, 0.85); ctx.shadowColor = rgb(c, 1); ctx.shadowBlur = 12;
    ctx.fillRect(px0 + i * bw + 3, py0 - hh, bw - 6, hh);
  }
  ctx.shadowBlur = 0;
  const cur = Math.pow(D.PI_STAGE, clamp(sc, 0, N));
  ctx.fillStyle = '#ffffff'; ctx.font = '700 30px "JetBrains Mono"';
  ctx.fillText(`× ${cur.toFixed(2)}`, x + w - 160, y + 30);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// colour bar for temperature
export function drawColorbar(ctx, x, y, w, h, a, lo = '288 K', hi = '634 K', title = 'total temperature T₀') {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  for (let k = 0; k <= 10; k++) g.addColorStop(k / 10, rgb(heat(0.62 * k / 10)));
  ctx.fillStyle = g; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = DIM; ctx.font = '500 18px "JetBrains Mono"';
  ctx.fillText(lo, x, y + h + 24); ctx.fillText(hi, x + w - 58, y + h + 24);
  ctx.fillStyle = TXT; ctx.font = '600 19px "Space Grotesk"'; ctx.fillText(title, x, y - 12);
  ctx.restore();
}
