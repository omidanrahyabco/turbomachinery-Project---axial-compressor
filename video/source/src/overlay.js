import katex from '/node_modules/katex/dist/katex.mjs';
import { win, clamp, easeOut, smooth } from './util.js';

export const tex = (s, display = true) => katex.renderToString(s, { displayMode: display, throwOnError: false, output: 'html' });

// Replace $...$ segments inside html with inline KaTeX
export function rich(html) {
  return html.replace(/\$([^$]+)\$/g, (_, m) => katex.renderToString(m, { displayMode: false, throwOnError: false, output: 'html' }));
}

export class Overlay {
  constructor(root) {
    this.root = root;
    this.cues = [];
  }
  // add a cue; returns element
  add(c) {
    const el = document.createElement('div');
    el.className = 'cue ' + (c.cls || '');
    el.innerHTML = c.tex ? tex(c.tex) : rich(c.html || '');
    if (c.title) el.innerHTML = `<div class="eqt">${rich(c.title)}</div>` + el.innerHTML;
    if (c.note) el.innerHTML += `<div class="eqn">${rich(c.note)}</div>`;
    Object.assign(el.style, { left: c.x + 'px', top: c.y + 'px', display: 'none' });
    if (c.w) el.style.width = c.w + 'px';
    if (c.align === 'right') { el.style.left = 'auto'; el.style.right = (1920 - c.x) + 'px'; el.style.textAlign = 'right'; }
    if (c.align === 'rightbox') { el.style.left = 'auto'; el.style.right = (1920 - c.x) + 'px'; }
    if (c.align === 'center') { el.style.transform = 'translateX(-50%)'; el.style.textAlign = 'center'; }
    this.root.appendChild(el);
    const cue = { fin: 0.5, fout: 0.45, anim: 'up', ...c, el };
    this.cues.push(cue);
    return cue;
  }
  update(t) {
    for (const c of this.cues) {
      const a = win(t, c.t0, c.t1, c.fin, c.fout);
      if (a <= 0.001) { if (c.el.style.display !== 'none') c.el.style.display = 'none'; continue; }
      c.el.style.display = 'block';
      c.el.style.opacity = a.toFixed(3);
      const base = c.align === 'center' ? 'translateX(-50%) ' : '';
      const k = 1 - easeOut(a);
      let tr = '';
      if (c.anim === 'up') tr = `translateY(${(k * 24).toFixed(1)}px)`;
      else if (c.anim === 'left') tr = `translateX(${(-k * 40).toFixed(1)}px)`;
      else if (c.anim === 'right') tr = `translateX(${(k * 40).toFixed(1)}px)`;
      else if (c.anim === 'scale') tr = `scale(${(0.92 + 0.08 * easeOut(a)).toFixed(3)})`;
      else if (c.anim === 'track') tr = `translateY(${(k * 10).toFixed(1)}px)`;
      c.el.style.transform = base + tr;
      if (c.anim === 'track') c.el.style.letterSpacing = (c.ls0 ?? 0.6) * (1 - 0.0) + (k * 0.25) + 'em';
      if (c.onFrame) c.onFrame(c.el, t, a);
    }
  }
}

// Leader-line labels for 3-D anchors (drawn into a 2-D canvas, text as HTML)
export class Labels {
  constructor(root) { this.root = root; this.items = []; }
  add(l) {
    const el = document.createElement('div');
    el.className = 'lab';
    el.innerHTML = `<div class="labt">${rich(l.text)}</div>` + (l.sub ? `<div class="labs">${rich(l.sub)}</div>` : '');
    el.style.display = 'none';
    this.root.appendChild(el);
    const item = { fin: 0.5, fout: 0.4, ...l, el };
    this.items.push(item);
    return item;
  }
  update(t, ctx, project) {
    for (const l of this.items) {
      const a = win(t, l.t0, l.t1, l.fin, l.fout);
      if (a <= 0.001) { l.el.style.display = 'none'; continue; }
      const p = project(l.anchor(t));
      if (!p) { l.el.style.display = 'none'; continue; }
      const [ax, ay] = p;
      const lx = ax + l.dx, ly = ay + l.dy;
      // line grows from anchor to label
      const g = easeOut(clamp(a * 1.4));
      const ex = ax + (lx - ax) * g, ey = ay + (ly - ay) * g;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = l.color || '#46e3ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = l.color || '#46e3ff'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey);
      const right = l.dx >= 0;
      const tail = (l.el.offsetWidth || 200) + 8;
      if (g > 0.98) ctx.lineTo(ex + (right ? 1 : -1) * tail * smooth(clamp((a - 0.5) / 0.5)), ey);
      ctx.stroke();
      ctx.fillStyle = l.color || '#46e3ff';
      ctx.beginPath(); ctx.arc(ax, ay, 5 + 3 * Math.sin(t * 6) ** 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      l.el.style.display = 'block';
      l.el.style.opacity = smooth(clamp((a - 0.3) / 0.7)).toFixed(3);
      l.el.style.borderColor = l.color || '#46e3ff';
      const w = l.el.offsetWidth || 300;
      const x = right ? ex + 8 : ex - 8 - w;
      l.el.style.left = (right ? ex + 4 : ex - 4 - w).toFixed(1) + 'px';
      l.el.style.top = (ey - (l.el.offsetHeight || 60) - 4).toFixed(1) + 'px';
      l.el.style.textAlign = right ? 'left' : 'right';
    }
  }
}
