// Deterministic frame renderer: node render.js --times 1,2,3 --out dir   |   --from 0 --to 3540 --workers 2 --out frames
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
const FPS = +(args.fps || 30);
const out = args.out || 'frames';
fs.mkdirSync(out, { recursive: true });
const URL = 'http://127.0.0.1:8123/index.html';

async function worker(list, id) {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--disable-gpu-vsync'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log(`[w${id}] ERR`, e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[w${id}]`, m.text()); });
  await p.goto(URL);
  await p.waitForFunction('window.ready===true', { timeout: 180000 });
  const cdp = await p.context().newCDPSession(p);
  const t0 = Date.now();
  let n = 0;
  for (const job of list) {
    const file = path.join(out, job.name);
    if (!args.force && fs.existsSync(file) && fs.statSync(file).size > 1000) continue;
    await p.evaluate(t => window.seek(t), job.t);
    const s = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: +(args.q || 93), optimizeForSpeed: true });
    fs.writeFileSync(file + '.tmp', Buffer.from(s.data, 'base64'));
    fs.renameSync(file + '.tmp', file);
    n++;
    if (n % 25 === 0) console.log(`[w${id}] ${n}/${list.length} frames, ${((Date.now() - t0) / n / 1000).toFixed(2)} s/frame, last t=${job.t.toFixed(2)}`);
  }
  console.log(`[w${id}] done ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await b.close();
}

(async () => {
  let jobs = [];
  if (args.times) {
    jobs = args.times.split(',').map(Number).map(t => ({ t, name: `t_${t.toFixed(2).padStart(7, '0')}.jpg` }));
  } else {
    const from = +(args.from || 0), to = +(args.to || 3540);
    for (let f = from; f < to; f++) jobs.push({ t: f / FPS, name: `f_${String(f).padStart(5, '0')}.jpg` });
  }
  const nw = +(args.workers || 1);
  // interleave in contiguous chunks so each worker has coherent work
  const lists = Array.from({ length: nw }, () => []);
  const chunk = Math.ceil(jobs.length / nw);
  jobs.forEach((j, i) => lists[Math.floor(i / chunk)].push(j));
  await Promise.all(lists.map((l, i) => worker(l, i)));
})();
