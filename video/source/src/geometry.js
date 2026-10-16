import * as THREE from 'three';
import * as D from './design.js';

// Surface of revolution about the X axis. profile: [[x, r], ...]
export function revolve(profile, segments = 128, phiStart = 0, phiLength = Math.PI * 2) {
  const pos = [], idx = [], uv = [];
  const closed = Math.abs(phiLength - Math.PI * 2) < 1e-6;
  const cols = closed ? segments : segments + 1;
  for (let i = 0; i < profile.length; i++) {
    for (let j = 0; j < cols; j++) {
      const phi = phiStart + phiLength * j / segments;
      const [x, r] = profile[i];
      pos.push(x, r * Math.cos(phi), r * Math.sin(phi));
      uv.push(j / segments, i / (profile.length - 1));
    }
  }
  for (let i = 0; i < profile.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const j2 = closed ? (j + 1) % cols : j + 1;
      const a = i * cols + j, b = i * cols + j2, c = (i + 1) * cols + j, d = (i + 1) * cols + j2;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Build one blade (lofted, twisted, wrapped on cylinders) for a row
export function bladeGeometry(row, opts = {}) {
  const nSpan = opts.nSpan ?? 7;
  const nChord = opts.nChord ?? 14;
  const xc = (row.x0 + row.x1) / 2;
  const rh = D.rHub(xc), rt = D.rTip(xc);
  const h = rt - rh;
  const clear = 0.012 * h + 0.002;
  let r0, r1;
  if (row.kind === 'rotor') { r0 = rh - 0.01; r1 = rt - clear; }
  else { r0 = rh + clear; r1 = rt + 0.01; }
  const tmax = row.kind === 'igv' ? 0.10 : row.kind === 'stator' ? 0.075 : 0.065;
  const sections = [];
  for (let k = 0; k < nSpan; k++) {
    const f = k / (nSpan - 1);
    const r = r0 + (r1 - r0) * f;
    const ang = D.rowAngles(row, r);
    // rotor chord grows slightly to the tip, thickness falls (realistic)
    const chord = row.chord * (row.kind === 'rotor' ? 0.92 + 0.16 * f : 1.0);
    const t = tmax * (row.kind === 'rotor' ? 1.25 - 0.5 * f : 1.0);
    const af = D.airfoil2D(ang.ain, ang.aout, chord, t, nChord);
    // centre the section: axial mid at xc, tangential centroid at 0
    let minx = 1e9, maxx = -1e9, cs = 0;
    for (const p of af.loop) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); cs += p[1]; }
    cs /= af.loop.length;
    const dx = xc - (minx + maxx) / 2;
    sections.push({ r, loop: af.loop.map(p => [p[0] + dx, p[1] - cs]) });
  }
  const M = sections[0].loop.length;
  const pos = [], idx = [];
  for (const sec of sections) {
    for (const [x, s] of sec.loop) {
      const th = s / sec.r;
      pos.push(x, sec.r * Math.cos(th), sec.r * Math.sin(th));
    }
  }
  for (let k = 0; k < nSpan - 1; k++) {
    for (let j = 0; j < M; j++) {
      const j2 = (j + 1) % M;
      const a = k * M + j, b = k * M + j2, c = (k + 1) * M + j, d = (k + 1) * M + j2;
      idx.push(a, b, c, b, d, c);
    }
  }
  // tip / hub caps (fan around centroid)
  const capAt = (k, flip) => {
    const sec = sections[k];
    let cx = 0, cs = 0;
    for (const [x, s] of sec.loop) { cx += x; cs += s; }
    cx /= M; cs /= M;
    const th = cs / sec.r;
    const ci = pos.length / 3;
    pos.push(cx, sec.r * Math.cos(th), sec.r * Math.sin(th));
    for (let j = 0; j < M; j++) {
      const a = k * M + j, b = k * M + (j + 1) % M;
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  };
  capAt(nSpan - 1, false);
  capAt(0, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function rowMesh(row, material, opts) {
  const geo = bladeGeometry(row, opts);
  const n = D.rowBladeCount(row);
  const mesh = new THREE.InstancedMesh(geo, material, n);
  const m = new THREE.Matrix4();
  for (let j = 0; j < n; j++) {
    m.makeRotationX(2 * Math.PI * j / n);
    mesh.setMatrixAt(j, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.count = n;
  return mesh;
}

// hub (drum) profile incl. spinner and rear shaft
export function hubProfile() {
  const pts = [];
  const xa = D.rows[0].x0;
  // spinner nose
  const noseL = 0.55;
  const rh0 = D.rHub(xa);
  for (let k = 0; k <= 24; k++) {
    const u = k / 24;
    const x = xa - noseL + noseL * u;
    const r = rh0 * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))) * 0.999 + 0.0001;
    pts.push([x - 0.05, Math.max(0.004, r)]);
  }
  for (let k = 0; k <= 200; k++) {
    const x = xa + (D.X_END - xa) * k / 200;
    pts.push([x, D.rHub(x)]);
  }
  // rear cone down to shaft
  const re = D.rHub(D.X_END);
  pts.push([D.X_END + 0.25, re]);
  pts.push([D.X_END + 0.6, re * 0.55]);
  pts.push([D.X_END + 2.2, re * 0.55]);
  return pts;
}

export function casingProfile(offset = 0) {
  const pts = [];
  const xa = D.rows[0].x0;
  // bellmouth
  for (let k = 0; k <= 20; k++) {
    const u = k / 20;
    const x = xa - 0.6 + 0.6 * u;
    const r = D.rTip(xa) + 0.35 * Math.pow(1 - u, 2.2);
    pts.push([x, r + offset]);
  }
  for (let k = 1; k <= 200; k++) {
    const x = xa + (D.X_END - xa) * k / 200;
    pts.push([x, D.rTip(x) + offset]);
  }
  // diffuser
  const rt = D.rTip(D.X_END);
  for (let k = 1; k <= 10; k++) {
    pts.push([D.X_END + 0.06 * k, rt + 0.012 * k * k * 0.3 + offset]);
  }
  return pts;
}
