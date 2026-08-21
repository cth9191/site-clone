// Visual QA: original vs clone at 3 breakpoints, GPU canvases masked, per-viewport-slice diffs.
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs';

const ORIGINAL = 'https://ORIGINAL.example/', CLONE = 'http://127.0.0.1:5173/';
const BREAKPOINTS = [1440, 768, 390];
const MASKS = ['[data-mount] canvas', '[data-paper-shader]', '.grain-overlay'];
const OUT = 'qa/out'; fs.mkdirSync(OUT, { recursive: true });

async function capture(browser, url, width, tag) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1});
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(2500);
  await page.addStyleTag({ content: `*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important} html{scroll-behavior:auto!important} ${MASKS.join(',')}{visibility:hidden!important}` });
  // settle lazy content: scroll through, then back
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(80); }
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800);
  const shots = [];
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 900) {
    await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(450);
    const p = `${OUT}/${tag}-${width}-${String(y).padStart(5, '0')}.png`;
    await page.screenshot({ path: p }); shots.push({ y, p });
  }
  await ctx.close();
  return { shots, total };
}

const browser = await chromium.launch();
const report = [];
for (const w of BREAKPOINTS) {
  const o = await capture(browser, ORIGINAL, w, 'orig'), c = await capture(browser, CLONE, w, 'clone');
  const n = Math.min(o.shots.length, c.shots.length);
  let worst = 0, sum = 0;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const a = PNG.sync.read(fs.readFileSync(o.shots[i].p)), b = PNG.sync.read(fs.readFileSync(c.shots[i].p));
    const d = new PNG({ width: a.width, height: a.height });
    const bad = pixelmatch(a.data, b.data, d.data, a.width, a.height, { threshold: 0.2, includeAA: false });
    const ratio = bad / (a.width * a.height);
    fs.writeFileSync(`${OUT}/diff-${w}-${String(o.shots[i].y).padStart(5, '0')}.png`, PNG.sync.write(d));
    rows.push({ y: o.shots[i].y, ratio: +ratio.toFixed(4) }); worst = Math.max(worst, ratio); sum += ratio;
  }
  report.push({ width: w, origHeight: o.total, cloneHeight: c.total, slices: n, meanDiff: +(sum / n).toFixed(4), worstDiff: +worst.toFixed(4), rows });
  console.log(`@${w}: orig ${o.total}px clone ${c.total}px | mean ${(100 * sum / n).toFixed(2)}% worst ${(100 * worst).toFixed(2)}%`);
  for (const r of rows) if (r.ratio > 0.02) console.log(`   y=${r.y} ${(100 * r.ratio).toFixed(2)}%`);
}
await browser.close();
fs.writeFileSync('qa/report.json', JSON.stringify(report, null, 1));
