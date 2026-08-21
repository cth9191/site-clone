#!/usr/bin/env node
/**
 * Optional inventory helper that uses an explicitly installed Playwright runtime
 * to record DOM/canvas/network observations. It does not perform
 * Surface Attribution, Target Lock, Replay Ready, or QA gates, and it does not
 * install dependencies automatically.
 *
 * Usage:
 *   node fetch-rendered-dom.mjs <URL> [outDir]
 *
 * Dependencies:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Inventory outputs to outDir (default ./web-shader-extractor-scout):
 *   dom.html         - full rendered HTML
 *   canvas-info.json - all canvas element metadata
 *   webgl-info.json  - lightweight metadata for discovered canvases
 *   console.log      - page console output
 *   screenshot.png   - viewport screenshot
 *   network.json     - runtime-loaded JS/resource/asset URLs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const url = process.argv[2];
const outDir = resolve(process.argv[3] || 'web-shader-extractor-scout');

if (!url) {
  console.error('Usage: node fetch-rendered-dom.mjs <URL> [outDir]');
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (error) {
  console.error('Playwright is not available. Install it explicitly before using this optional scout script:');
  console.error('  npm install playwright');
  console.error('  npx playwright install chromium');
  console.error(`Original error: ${error.message}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const consoleLogs = [];
const networkRequests = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

// Capture console
page.on('console', msg => {
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
});

// Capture network (JS, WASM, shader, media, image, and likely data files)
page.on('response', async response => {
  const reqUrl = response.url();
  const type = response.headers()['content-type'] || '';
  if (/\.(js|mjs|wasm|bin|glsl|frag|vert|svg|png|jpe?g|webp|avif|gif|mp4|webm|ktx2?)(\?|$)/i.test(reqUrl) || type.includes('javascript') || type.startsWith('image/') || type.startsWith('video/')) {
    networkRequests.push({
      url: reqUrl,
      status: response.status(),
      type: type.split(';')[0],
      size: parseInt(response.headers()['content-length'] || '0'),
    });
  }
});

try {
  console.log(`Navigating to ${url} ...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for common renderer initialization.
  await page.waitForTimeout(3000);

  // 1. Full rendered DOM
  const html = await page.content();
  writeFileSync(join(outDir, 'dom.html'), html);
  console.log(`dom.html - ${html.length} bytes`);

  // 2. Surface info. This is inventory evidence, not target attribution.
  const canvasInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('canvas')).map((c, i) => {
      const style = getComputedStyle(c);
      const rect = c.getBoundingClientRect();
      const parentStyle = c.parentElement ? getComputedStyle(c.parentElement) : null;
      return {
        index: i,
        outerHTML: c.outerHTML.slice(0, 500),
        width: c.width,
        height: c.height,
        clientWidth: c.clientWidth,
        clientHeight: c.clientHeight,
        boundingRect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
        },
        dataEngine: c.dataset.engine || null,
        dataRenderer: c.dataset.renderer || null,
        id: c.id || null,
        className: c.className || null,
        parentTag: c.parentElement?.tagName || null,
        parentClass: c.parentElement?.className?.slice(0, 100) || null,
        style: {
          display: style.display,
          position: style.position,
          opacity: style.opacity,
          visibility: style.visibility,
          pointerEvents: style.pointerEvents,
          transform: style.transform,
          zIndex: style.zIndex,
          clipPath: style.clipPath,
          maskImage: style.maskImage,
          mixBlendMode: style.mixBlendMode,
        },
        parentStyle: parentStyle ? {
          position: parentStyle.position,
          overflow: parentStyle.overflow,
          clipPath: parentStyle.clipPath,
          maskImage: parentStyle.maskImage,
          zIndex: parentStyle.zIndex,
        } : null,
      };
    });
  });
  writeFileSync(join(outDir, 'canvas-info.json'), JSON.stringify(canvasInfo, null, 2));
  console.log(`canvas-info.json - ${canvasInfo.length} canvas(es) found`);

  // 3. Lightweight canvas metadata. Do not create new contexts here.
  const webglInfo = await page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'));
    if (!canvases.length) return { error: 'no canvas found', canvases: [] };
    return {
      found: true,
      canvases: canvases.map((canvas, index) => ({
        index,
        width: canvas.width,
        height: canvas.height,
        dataEngine: canvas.dataset.engine || null,
        dataRenderer: canvas.dataset.renderer || null,
        id: canvas.id || null,
        className: canvas.className || null,
      })),
    };
  });
  writeFileSync(join(outDir, 'webgl-info.json'), JSON.stringify(webglInfo, null, 2));
  console.log(`webgl-info.json - ${JSON.stringify(webglInfo).slice(0, 100)}`);

  // 4. Console logs
  writeFileSync(join(outDir, 'console.log'), consoleLogs.join('\n'));
  console.log(`console.log - ${consoleLogs.length} entries`);

  // 5. Screenshot
  await page.screenshot({ path: join(outDir, 'screenshot.png'), fullPage: false });
  console.log(`screenshot.png - saved`);

  // 6. Network requests
  writeFileSync(join(outDir, 'network.json'), JSON.stringify(networkRequests, null, 2));
  console.log(`network.json - ${networkRequests.length} JS/resource requests captured`);

  console.log(`\nDone. Files saved to ${outDir}`);
} finally {
  await browser.close();
}
