// 2-D blade-to-blade (cascade) view at mean radius, with velocity triangles and pressure field
import * as D from './design.js';
import { clamp, smooth, easeOut, mulberry32, pmap, rgb, lerp } from './util.js';

const DEG = Math.PI / 180;

export class Cascade {
  constructor() {
    this.cy = 540;
    this.chord = 215;
    this.pitch = 182;
    this.XR = 300;           // rotor leading-edge x (px)
    this.XS = 790;           // stator leading-edge x (px)
    this.U = 300;            // blade speed px/s
    this.cx = D.PHI * this.U;
    const dev = 7 * DEG;
    this.rot = this.makeRow(D.BETA1 * -1, -D.BETA2 + dev, this.chord, 0.105);
    this.sta = this.makeRow(D.ALPHA2, D.ALPHA1 - dev, this.chord * 0.95, 0.10);
    // particles
    const rnd = mulberry32(11);
    this.NP = 1100;
    this.py = new Float32Array(this.NP); this.pp = new Float32Array(this.NP); this.pw = new Float32Array(this.NP);
    for (let i = 0; i < this.NP; i++) { this.py[i] = rnd(); this.pp[i] = rnd(); this.pw[i] = 0.6 + 0.8 * rnd(); }
    // tangential displacement table Y(x) = int tan(alpha) dx (absolute frame)
    this.x0 = -60; this.x1 = 1260;
    this.Y = new Float32Array(this.x1 - this.x0 + 1);
    let acc = 0;
    for (let x = this.x0; x <= this.x1; x++) { this.Y[x - this.x0] = acc; acc += Math.tan(this.alphaAt(x)); }
    this.field = document.createElement('canvas');
    this.FW = 240; this.FH = 135;
    this.field.width = this.FW; this.field.height = this.FH;
    this.fctx = this.field.getContext('2d');
    this.fimg = this.fctx.createImageData(this.FW, this.FH);
  }

  makeRow(ain, aout, chord, t) {
    const af = D.airfoil2D(ain, aout, chord, t, 28);
    // shift so that LE at x=0, camber centroid at s=0
    let cs = 0; for (const p of af.camber) cs += p[1]; cs /= af.camber.length;
    const sh = p => [p[0], p[1] - cs];
    const loop = af.loop.map(sh), camber = af.camber.map(sh);
    let ax = 0; for (const p of loop) ax = Math.max(ax, p[0]);
    return { loop, camber, ax, upper: af.upper.map(sh), lower: af.lower.map(sh) };
  }
  camberAt(row, xl) {
    const c = row.camber;
    if (xl <= c[0][0]) return c[0][1];
    for (let i = 1; i < c.length; i++) if (xl <= c[i][0]) { const u = (xl - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return lerp(c[i - 1][1], c[i][1], u); }
    return c[c.length - 1][1];
  }
  alphaAt(x) {
    const a1 = D.ALPHA1, a2 = D.ALPHA2;
    const r0 = this.XR, r1 = this.XR + this.rot.ax, s0 = this.XS, s1 = this.XS + this.sta.ax;
    if (x < r0) return a1;
    if (x < r1) return lerp(a1, a2, smooth((x - r0) / (r1 - r0)));
    if (x < s0) return a2;
    if (x < s1) return lerp(a2, a1, smooth((x - s0) / (s1 - s0)));
    return a1;
  }
  rotorOffset(t) { return this.U * t; }

  // screen transform: +theta (direction of rotor motion) points DOWN on screen,
  // matching the radial view of the 3-D model seen from outside the casing
  sy(y) { return this.cy + y; }

  drawRow(ctx, row, X, yoff, style, alpha) {
    const s = this.pitch;
    const k0 = Math.floor((-600 - yoff) / s) - 1, k1 = Math.ceil((600 - yoff) / s) + 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let k = k0; k <= k1; k++) {
      const y0 = yoff + k * s;
      const path = new Path2D();
      row.loop.forEach((p, i) => { const X1 = X + p[0], Y1 = this.sy(y0 + p[1]); i ? path.lineTo(X1, Y1) : path.moveTo(X1, Y1); });
      path.closePath();
      const g = ctx.createLinearGradient(X, this.sy(y0 - 60), X + row.ax, this.sy(y0 + 60));
      g.addColorStop(0, style[0]); g.addColorStop(0.5, style[1]); g.addColorStop(1, style[2]);
      ctx.fillStyle = g;
      ctx.shadowColor = style[3]; ctx.shadowBlur = 18;
      ctx.fill(path);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = style[3]; ctx.lineWidth = 1.5; ctx.stroke(path);
    }
    ctx.restore();
  }

  // Pressure field (static pressure), normalised 0..1
  pressure(x, y, t) {
    const r0 = this.XR, r1 = this.XR + this.rot.ax, s0 = this.XS, s1 = this.XS + this.sta.ax;
    let base;
    if (x < r0) base = 0.05 + 0.05 * smooth((x + 60) / (r0 + 60));
    else if (x < r1) base = 0.10 + 0.38 * smooth((x - r0) / (r1 - r0));
    else if (x < s0) base = 0.48 + 0.04 * smooth((x - r1) / (s0 - r1));
    else if (x < s1) base = 0.52 + 0.40 * smooth((x - s0) / (s1 - s0));
    else base = 0.92 + 0.03 * smooth((x - s1) / 200);
    // blade loading inside passages
    const load = (row, X, yoff, sign) => {
      const xl = x - X;
      const env = smooth((xl + 25) / 50) * smooth((row.ax + 10 - xl) / 60);
      if (env <= 0) return 0;
      const yc = this.camberAt(row, clamp(xl, 0, row.ax));
      let eta = ((y - yoff - yc) / this.pitch) % 1; if (eta < 0) eta += 1;
      const prof = Math.sin(Math.PI * clamp(xl / row.ax)) ** 0.6;
      return sign * 0.20 * env * (0.5 + 0.5 * prof) * (0.5 - eta) * 2;
    };
    base += load(this.rot, this.XR, this.rotorOffset(t), 1);
    base += load(this.sta, this.XS, 0, -1);
    return base;
  }

  drawField(ctx, t, alpha) {
    if (alpha <= 0) return;
    const { FW, FH } = this; const d = this.fimg.data;
    for (let j = 0; j < FH; j++) {
      const ys = (j + 0.5) / FH * 1080; const y = ys - this.cy;
      for (let i = 0; i < FW; i++) {
        const x = (i + 0.5) / FW * 1180;
        const c = pmap(this.pressure(x, y, t));
        const o = (j * FW + i) * 4;
        const e = smooth((1150 - x) / 140);
        d[o] = c[0] * 200; d[o + 1] = c[1] * 200; d[o + 2] = c[2] * 200; d[o + 3] = 255 * e;
      }
    }
    this.fctx.putImageData(this.fimg, 0, 0);
    ctx.save(); ctx.globalAlpha = alpha * 0.62; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.field, 0, 0, 1180, 1080);
    ctx.restore();
  }

  drawParticles(ctx, t, alpha, opts = {}) {
    if (alpha <= 0) return;
    const L = this.x1 - this.x0 - 80;
    const span = 1400;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < this.NP; i++) {
      const xh = this.x0 + 40 + ((this.pp[i] * L + this.cx * t * this.pw[i] * 0 + this.cx * t) % L);
      if (xh > 1180) continue;
      const tail = 26;
      const xt = Math.max(this.x0, xh - tail);
      const yb = (this.py[i] - 0.5) * span;
      const Yh = this.Y[Math.round(xh) - this.x0], Yt = this.Y[Math.round(xt) - this.x0];
      const yh = yb + Yh, yt = yb + Yt;
      // wrap y into view
      const wrap = v => ((v + 700) % 1400 + 1400) % 1400 - 700;
      const wy = wrap(yh), off = wy - yh;
      // speed colour: |c| = cx / cos(alpha)
      const al = this.alphaAt(xh);
      const sp = 1 / Math.cos(al);
      const f = clamp((sp - 1.12) / (1.62 - 1.12));
      const col = [lerp(0.25, 1.0, f), lerp(0.85, 0.62, f), lerp(1.0, 0.25, f)];
      const fade = smooth((xh - this.x0 - 40) / 80) * smooth((1180 - xh) / 120);
      ctx.strokeStyle = rgb(col, 0.75 * alpha * fade);
      ctx.lineWidth = 2.2 * this.pw[i];
      ctx.beginPath(); ctx.moveTo(xt, this.sy(yt + off)); ctx.lineTo(xh, this.sy(yh + off)); ctx.stroke();
    }
    ctx.restore();
  }

  drawBlades(ctx, t, alpha) {
    this.drawRow(ctx, this.rot, this.XR, this.rotorOffset(t), ['#f1f6fb', '#aebccb', '#56657a', 'rgba(120,220,255,0.9)'], alpha);
    this.drawRow(ctx, this.sta, this.XS, 0, ['#f4d9a4', '#c99a55', '#6b4c22', 'rgba(255,190,90,0.9)'], alpha);
  }

  // Vector helper (math coords, origin in px)
  arrow(ctx, x0, y0, vx, vy, color, prog = 1, width = 5, dash = null) {
    if (prog <= 0) return;
    const x1 = x0 + vx * prog, y1 = y0 + vy * prog;
    const X0 = x0, Y0 = this.sy(y0), X1 = x1, Y1 = this.sy(y1);
    const ang = Math.atan2(Y1 - Y0, X1 - X0);
    const len = Math.hypot(X1 - X0, Y1 - Y0);
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    if (dash) ctx.setLineDash(dash);
    const hl = Math.min(22, len * 0.4);
    ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1 - Math.cos(ang) * hl * 0.8, Y1 - Math.sin(ang) * hl * 0.8); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(X1, Y1);
    ctx.lineTo(X1 - Math.cos(ang - 0.38) * hl, Y1 - Math.sin(ang - 0.38) * hl);
    ctx.lineTo(X1 - Math.cos(ang + 0.38) * hl, Y1 - Math.sin(ang + 0.38) * hl);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  arc(ctx, x0, y0, r, a0, a1, color, prog = 1) {
    if (prog <= 0) return;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.beginPath();
    // math angles -> screen (y flipped)
    ctx.arc(x0, this.sy(y0), r, a0, a0 + (a1 - a0) * prog, a1 < a0);
    ctx.stroke(); ctx.restore();
  }

  // velocity triangle in math coords at origin (x0, y0); returns label anchor points (screen)
  triangle(ctx, x0, y0, alpha, beta, scale, prog, cols) {
    const cxv = scale, U = scale / D.PHI;
    const ct = cxv * Math.tan(alpha); const wt = ct - U;
    const pW = clamp(prog * 3), pU = clamp(prog * 3 - 1), pC = clamp(prog * 3 - 2);
    // axial reference line
    ctx.save(); ctx.globalAlpha = 0.5 * clamp(prog * 4); ctx.strokeStyle = '#8aa0b8'; ctx.setLineDash([6, 8]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0 - 10, this.sy(y0)); ctx.lineTo(x0 + cxv + 40, this.sy(y0)); ctx.stroke(); ctx.restore();
    this.arrow(ctx, x0, y0, cxv, wt, cols.w, pW);
    this.arrow(ctx, x0 + cxv, y0 + wt, 0, U, cols.U, pU);
    this.arrow(ctx, x0, y0, cxv, ct, cols.c, pC);
    this.arc(ctx, x0, y0, 70, 0, Math.atan2(ct, cxv), cols.c, pC);
    this.arc(ctx, x0, y0, 95, 0, Math.atan2(wt, cxv), cols.w, pW);
    return {
      w: [x0 + cxv * 0.5, this.sy(y0 + wt * 0.5)],
      U: [x0 + cxv, this.sy(y0 + wt + U * 0.5)],
      c: [x0 + cxv * 0.5, this.sy(y0 + ct * 0.5)],
      a: [x0 + 70 * Math.cos(Math.atan2(ct, cxv) / 2), this.sy(y0 + 70 * Math.sin(Math.atan2(ct, cxv) / 2))],
      b: [x0 + 95 * Math.cos(Math.atan2(wt, cxv) / 2), this.sy(y0 + 95 * Math.sin(Math.atan2(wt, cxv) / 2))],
      ct, wt, Uval: U,
    };
  }
}
