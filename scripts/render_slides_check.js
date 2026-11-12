const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = '/home/z/my-project/download/slides';
  const out = '/tmp/render/slides';
  require('fs').mkdirSync(out, { recursive: true });
  const slides = ['slide_08', 'slide_09', 'slide_10', 'slide_11', 'slide_12', 'slide_13', 'slide_14'];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  for (const s of slides) {
    await page.goto('file://' + path.join(dir, s + '.html'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    // overflow check: any element extending beyond the 1280x720 canvas
    const overflow = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('.slide *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        if (r.right > 1281 || r.bottom > 721 || r.left < -1 || r.top < -1) {
          bad.push(`${el.tagName}.${(el.className && el.className.toString ? el.className.toString() : '').slice(0,30)} r=${Math.round(r.right)} b=${Math.round(r.bottom)} t=${Math.round(r.top)}`);
        }
      });
      return bad.slice(0, 5);
    });
    const imgs = await page.evaluate(() =>
      [...document.querySelectorAll('img')].map(i => `${i.src.split('/').pop()} ok=${i.complete && i.naturalWidth > 0}`)
    );
    console.log(s, 'overflow:', overflow.length ? overflow : 'none', '| imgs:', imgs.join(', ') || 'none');
    await page.screenshot({ path: path.join(out, s + '.png') });
  }
  await browser.close();
})();
