const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + __dirname + '/guide.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.querySelectorAll('.katex').length > 400);
  const bad = await p.evaluate(() => [...document.querySelectorAll('.katex-error')].map(e=>e.title||e.textContent).slice(0,10));
  console.log('katex errors', bad);
  await p.pdf({ path: 'guide.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;font-size:7.5pt;color:#888;text-align:center;font-family:DejaVu Sans">Axial compressors & turbomachinery basics — study guide · <span class="pageNumber"></span>/<span class="totalPages"></span></div>' });
  await b.close();
})();
