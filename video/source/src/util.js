export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeIn = (t) => { t = clamp(t); return t * t * t; };
// progress of t inside [a,b]
export const prog = (t, a, b) => clamp((t - a) / (b - a));
// window envelope: fades in over [a, a+f], out over [b-f, b]
export const win = (t, a, b, f = 0.5, fo = f) => {
  if (t <= a || t >= b) return 0;
  return Math.min(smooth((t - a) / f), smooth((b - t) / fo));
};

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// temperature colour ramp (cold blue -> cyan -> white -> amber -> orange-red)
const RAMP = [
  [0.00, [0.10, 0.35, 1.00]],
  [0.22, [0.10, 0.80, 1.00]],
  [0.45, [0.75, 0.95, 1.00]],
  [0.65, [1.00, 0.85, 0.45]],
  [0.82, [1.00, 0.55, 0.15]],
  [1.00, [1.00, 0.25, 0.08]],
];
export function heat(f) {
  f = clamp(f);
  for (let i = 1; i < RAMP.length; i++) {
    if (f <= RAMP[i][0]) {
      const [f0, c0] = RAMP[i - 1], [f1, c1] = RAMP[i];
      const u = (f - f0) / (f1 - f0);
      return [lerp(c0[0], c1[0], u), lerp(c0[1], c1[1], u), lerp(c0[2], c1[2], u)];
    }
  }
  return RAMP[RAMP.length - 1][1];
}
export const rgb = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

// pressure colour map (deep blue -> teal -> yellow -> red), "turbo"-like
const PR = [
  [0.0, [0.12, 0.10, 0.45]],
  [0.2, [0.10, 0.35, 0.85]],
  [0.4, [0.10, 0.75, 0.85]],
  [0.6, [0.45, 0.92, 0.45]],
  [0.8, [0.98, 0.80, 0.20]],
  [1.0, [0.92, 0.22, 0.12]],
];
export function pmap(f) {
  f = clamp(f);
  for (let i = 1; i < PR.length; i++) {
    if (f <= PR[i][0]) {
      const [f0, c0] = PR[i - 1], [f1, c1] = PR[i];
      const u = (f - f0) / (f1 - f0);
      return [lerp(c0[0], c1[0], u), lerp(c0[1], c1[1], u), lerp(c0[2], c1[2], u)];
    }
  }
  return PR[PR.length - 1][1];
}
