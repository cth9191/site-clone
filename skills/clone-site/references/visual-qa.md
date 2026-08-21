# Automated visual QA

Replace "look at a screenshot and call it done" with a real pixel diff. The catch
is that a cloned page is two materials with opposite QA needs: DOM must match
closely and deterministically; GPU effects animate and will never match pixel-
for-pixel. So diff DOM, and **verify** GPU — don't diff GPU.

## Harness

Use Playwright's built-in visual comparison (`toHaveScreenshot()` / `expect(page)`
compares via the pixelmatch library — pixel-by-pixel, local, no external
service). Capture original and clone at the same viewport, DPR, and scroll state.

```js
// qa/clone.spec.ts — run per breakpoint
import { test, expect } from '@playwright/test';

const BREAKPOINTS = [1440, 768, 390];
// GPU surface selectors come straight from surface-map.json.routingSummary.sendToShaderExtract
const GPU_MASKS = ['#hero-canvas', '.bg-shader'];

for (const width of BREAKPOINTS) {
  test(`clone matches original @ ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(CLONE_URL);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(`clone-${width}.png`, {
      fullPage: true,
      mask: GPU_MASKS.map((s) => page.locator(s)), // exclude animated GPU regions
      maxDiffPixelRatio: 0.02,  // ~2% tolerance absorbs anti-aliasing noise
      threshold: 0.2,           // per-pixel color sensitivity (default; lower = stricter)
      animations: 'disabled',   // freeze CSS animations/transitions for a stable frame
    });
  });
}
```

Generate the baseline from the **original** site (first run writes the reference
screenshot), then run the **clone** against it. Or capture both to files and diff
with a standalone pixelmatch script if you want the diff image saved as an
artifact for the completion report.

## Why the knobs, not zero-diff

Pixel diffing is literal: it can't tell a real layout regression from a harmless
anti-aliasing or subpixel-font difference, which is the main source of flaky
"failures." So:

- **`threshold`** (0–1, default 0.2) — per-pixel color sensitivity. Leave near
  default; drop only when chasing a genuine color mismatch.
- **`maxDiffPixelRatio`** — fraction of pixels allowed to differ. This is your
  main dial. Start ~0.02 and tighten as the clone converges. A whole section
  shifted will blow way past it; font AA won't.
- **`mask`** — the GPU regions. Non-negotiable: without it, a single animating
  shader frame makes every run "fail" and hides the DOM regressions you care about.
- **`animations: 'disabled'`** — freezes CSS transitions so the DOM frame is
  deterministic. (It does not stop a canvas rAF loop — that's why GPU regions are
  masked, not just frozen.)

## Verifying the GPU regions (separately)

Masked out of the diff, so check them by behavior, not by pixel equality:

1. **Renders at all** — the canvas is non-blank after load (sample a few pixels;
   if cross-origin blocks readback, verify visually via screenshot).
2. **Animates** — frames change over ~500ms (`isCanvasAnimating()` in
   `scripts/surface-map.js`).
3. **Responds** — if the original reacts to pointer/scroll, the clone does too.
4. **Fidelity label** — carry shader-extract's SOURCE / PARTIAL / approximate
   verdict into the report. A masked region that "passes" the DOM diff has NOT
   been proven faithful — only excluded. Say so honestly.

## Reporting

For each breakpoint: diff pass/fail, `maxDiffPixelRatio` achieved, and a link to
the saved diff image. For each GPU surface: renders / animates / responds + the
fidelity label. This is the evidence the clone is done — not a vibe.

## Harness gotchas (learned the hard way)

- **Don't set `reducedMotion: 'reduce'`** in the QA context. It changes the
  ORIGINAL's JS behavior (sites branch on it), so heights and content diverge
  and you chase phantom diffs. Freeze motion with injected CSS instead
  (`animation-play-state: paused; transition: none`).
- **`waitUntil: 'networkidle'` hangs against a Vite dev server** (HMR socket).
  Use `domcontentloaded` + a fixed settle, then a full scroll-through so lazy
  content loads before you measure.
- **Measure both pages the same way.** Section heights differ between a fresh
  load and a session that already scrolled (lazy images, fonts). Always scroll
  top→bottom→top on both before comparing offsets, and compare fresh-load to
  fresh-load.
- **First check heights, then pixels.** Dump `[selector, top, height]` for every
  section on both pages; a 0 px delta down the whole list means the DOM track is
  right and any remaining diff is behavior/timing. A delta localizes the bug to
  one section instantly.
- **Per-viewport slices beat one fullPage shot.** Screenshot every 900 px of
  scroll and diff slice-by-slice; the report then says *where* it's wrong
  (`y=19800 16%`) instead of one useless global number. Fixed chrome (header)
  shows in every slice — a header bug looks like "every slice over section X
  fails", which is itself the diagnosis.
- Mask GPU canvases **and** anything time-driven (marquees, morphing counters)
  — they're verified separately, not diffed.
