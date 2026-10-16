// Aerodynamic + geometric design of the demo compressor (MGT-70-class, 16 stages).
// All lengths in scene units (1 unit ~ 1.0 m at the inlet tip radius ~1.1 m).

export const N_STAGES = 16;
export const PI_C = 12.0;          // overall total pressure ratio (catalogue value)
export const ETA_P = 0.90;         // assumed polytropic efficiency
export const GAMMA = 1.4;
export const T01 = 288.15;

// Stage velocity-triangle design at mean radius (50 % reaction, repeating stage)
export const PHI = 0.55;           // flow coefficient  cx/U
export const PSI = 0.35;           // loading coefficient  dh0/U^2
export const REACTION = 0.5;
const tb1 = (REACTION + PSI / 2) / PHI;
const tb2 = (REACTION - PSI / 2) / PHI;
export const BETA1 = Math.atan(tb1);    // relative inlet (from axial, against rotation)
export const BETA2 = Math.atan(tb2);    // relative outlet
export const ALPHA1 = BETA2;            // absolute inlet  (symmetric triangles)
export const ALPHA2 = BETA1;            // absolute outlet

// Annulus
export const X0 = 0.0;             // IGV leading edge
export const R_MEAN = 0.83;
export const H_IN = 0.56;
export const H_OUT = 0.115;

// Row layout -----------------------------------------------------------
function chordOfStage(i) { // i = 0..N-1
  const f = i / (N_STAGES - 1);
  return 0.175 * Math.pow(0.36, f);
}

export const rows = [];
(function buildRows() {
  let x = X0;
  const igvC = 0.15;
  rows.push({ kind: 'igv', stage: 0, chord: igvC, x0: x, x1: x + igvC * 0.92 });
  x += igvC * 0.92 + 0.05;
  for (let i = 0; i < N_STAGES; i++) {
    const c = chordOfStage(i);
    const ax = c * 0.80;
    rows.push({ kind: 'rotor', stage: i + 1, chord: c, x0: x, x1: x + ax });
    x += ax + c * 0.28;
    rows.push({ kind: 'stator', stage: i + 1, chord: c * 0.95, x0: x, x1: x + ax * 0.95 });
    x += ax * 0.95 + c * 0.30;
  }
  // outlet guide vane
  const c = chordOfStage(N_STAGES - 1);
  rows.push({ kind: 'ogv', stage: N_STAGES + 1, chord: c, x0: x, x1: x + c * 0.9 });
  x += c * 0.9;
})();

export const X_END = rows[rows.length - 1].x1;
export const X_BLADE0 = rows[0].x0;

// Blade-height law: exponential decay from first rotor to last stator
export function bladeHeight(x) {
  const xa = rows[1].x0, xb = rows[rows.length - 1].x1;
  let f = (x - xa) / (xb - xa);
  if (f < 0) return H_IN;
  if (f > 1) return H_OUT;
  return H_IN * Math.pow(H_OUT / H_IN, Math.pow(f, 0.85));
}
export function rHub(x) { return R_MEAN - bladeHeight(x) / 2; }
export function rTip(x) { return R_MEAN + bladeHeight(x) / 2; }

// Thermodynamic distribution along the machine ------------------------
// stage index as continuous function of x (0 at first rotor LE, N at last stator TE)
export function stageCoord(x) {
  const rs = rows.filter(r => r.kind === 'rotor');
  const st = rows.filter(r => r.kind === 'stator');
  if (x <= rs[0].x0) return 0;
  for (let i = 0; i < N_STAGES; i++) {
    const a = rs[i].x0, b = st[i].x1;
    if (x <= b) {
      if (x < a) return i; // in gap before rotor
      return i + (x - a) / (b - a);
    }
  }
  return N_STAGES;
}
export const PI_STAGE = Math.pow(PI_C, 1 / N_STAGES);
export function p0Ratio(x) { return Math.pow(PI_STAGE, stageCoord(x)); }
export function T0(x) {
  return T01 * Math.pow(p0Ratio(x), (GAMMA - 1) / (GAMMA * ETA_P));
}
export const T0_OUT = T0(1e9);

// Absolute flow angle (tan alpha) along x at mean radius, for particle swirl
export function tanAlpha(x) {
  const ta1 = Math.tan(ALPHA1), ta2 = Math.tan(ALPHA2);
  const smooth = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  for (let k = 0; k < rows.length; k++) {
    const r = rows[k];
    if (x < r.x0) {
      // in gap before row k: angle equals exit of previous row
      if (k === 0) return 0;
      const p = rows[k - 1];
      return p.kind === 'rotor' ? ta2 : (p.kind === 'ogv' ? 0 : ta1);
    }
    if (x <= r.x1) {
      const u = smooth((x - r.x0) / (r.x1 - r.x0));
      if (r.kind === 'igv') return ta1 * u;
      if (r.kind === 'rotor') return ta1 + (ta2 - ta1) * u;
      if (r.kind === 'stator') return ta2 + (ta1 - ta2) * u;
      if (r.kind === 'ogv') return ta1 * (1 - u);
    }
  }
  return 0;
}

// Blade metal angles (deg-free, radians) at a radius r for a row, free-vortex twist
export function rowAngles(row, r) {
  const rm = R_MEAN;
  // free vortex: c_theta ~ 1/r, U ~ r, cx const.
  const Um = 1.0, cx = PHI * Um;
  const U = Um * r / rm;
  const ct1 = cx * Math.tan(ALPHA1) * rm / r;
  const ct2 = cx * Math.tan(ALPHA2) * rm / r;
  const dev = 7 * Math.PI / 180;
  if (row.kind === 'rotor') {
    // relative angles measured positive in +theta direction
    const b1 = Math.atan((ct1 - U) / cx);   // negative
    const b2 = Math.atan((ct2 - U) / cx);   // negative, smaller magnitude
    return { ain: b1, aout: b2 + dev };
  }
  if (row.kind === 'stator') {
    const a2 = Math.atan(ct2 / cx), a1 = Math.atan(ct1 / cx);
    return { ain: a2, aout: a1 - dev * 0.5 };
  }
  if (row.kind === 'igv') {
    const a1 = Math.atan(ct1 / cx);
    return { ain: 0, aout: a1 };
  }
  // ogv
  const a1 = Math.atan(ct1 / cx);
  return { ain: a1, aout: 0 };
}

export function rowBladeCount(row) {
  const s = row.chord / (row.kind === 'igv' ? 0.85 : row.kind === 'ogv' ? 1.0 : 1.05);
  return Math.max(12, Math.round(2 * Math.PI * R_MEAN / s));
}

// 2-D airfoil: circular-arc camber line (angle linearly varying) + NACA-65-like thickness
// returns arrays of [x, s] (axial, tangential arc-length) for the closed outline
export function airfoil2D(ain, aout, chord, tmax = 0.085, n = 16) {
  // camber line by integrating angle
  const cam = [];
  let x = 0, s = 0;
  const steps = 64;
  const pts = [[0, 0]];
  for (let k = 1; k <= steps; k++) {
    const u = (k - 0.5) / steps;
    const a = ain + (aout - ain) * u;
    x += Math.cos(a) / steps; s += Math.sin(a) / steps;
    pts.push([x, s]);
  }
  // normalise to unit chord along the chord line
  const L = Math.hypot(x, s);
  const sample = (u) => {
    const f = u * steps; const i = Math.min(steps - 1, Math.floor(f)); const w = f - i;
    const a = pts[i], b = pts[i + 1];
    return [(a[0] + (b[0] - a[0]) * w) / L * chord, (a[1] + (b[1] - a[1]) * w) / L * chord];
  };
  const upper = [], lower = [];
  for (let k = 0; k <= n; k++) {
    // cosine spacing
    const u = 0.5 * (1 - Math.cos(Math.PI * k / n));
    const c = sample(u);
    const u2 = Math.min(1, u + 1e-3), u1 = Math.max(0, u - 1e-3);
    const p2 = sample(u2), p1 = sample(u1);
    let tx = p2[0] - p1[0], ts = p2[1] - p1[1];
    const tl = Math.hypot(tx, ts); tx /= tl; ts /= tl;
    const nx = -ts, ns = tx;
    const xc = u;
    let yt = 5 * tmax * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    yt = Math.max(yt, 0.0012) * chord;
    upper.push([c[0] + nx * yt, c[1] + ns * yt]);
    lower.push([c[0] - nx * yt, c[1] - ns * yt]);
  }
  // closed loop: upper LE->TE, lower TE->LE
  const loop = upper.concat(lower.slice(0, -1).reverse().slice(0, -1));
  return { loop, upper, lower, camber: Array.from({ length: n + 1 }, (_, k) => sample(0.5 * (1 - Math.cos(Math.PI * k / n)))) };
}
