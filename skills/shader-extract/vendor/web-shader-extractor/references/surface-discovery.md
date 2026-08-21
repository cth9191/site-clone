# Surface Discovery

Surface discovery has two jobs: inventory candidates, then prove causality between the requested visual and one or more rendering surfaces. Inventory alone never decides the target.

## Surfaces To Enumerate

- visible and hidden `canvas`
- canvases inside same-origin iframes; for cross-origin iframes, record frame bounds, screenshots, network/frame metadata, or tool-accessible observations without bypassing origin restrictions
- `OffscreenCanvas` transferred to workers
- WebGPU canvas contexts
- DOM masks, clip paths, sticky containers, SVG filters, videos, and images composited with canvas
- shared renderer canvases that persist across routes

## Candidate Record

Record each candidate as:

```json
{
  "id": "surface-1",
  "selector": "canvas#hero",
  "frame": "main",
  "bounds": { "x": 0, "y": 0, "width": 1440, "height": 900 },
  "cssSize": { "width": 1440, "height": 900 },
  "backingSize": { "width": 2880, "height": 1800 },
  "dpr": 2,
  "visibility": "visible",
  "zIndex": "auto",
  "context": "webgl2|webgl|webgpu|2d|bitmaprenderer|unknown",
  "owner": "main-thread|iframe|worker|unknown",
  "routePersistence": "single-route|persistent|unknown",
  "notes": []
}
```

## Context Probes

Use non-destructive runtime evaluation first:

- inspect size, bounding rect, computed style, opacity, transform, pointer-events, z-index
- check known dataset hints such as `data-engine`, `data-renderer`, embed IDs
- detect existing contexts without creating unrelated new contexts when possible
- observe worker script URLs, `transferControlToOffscreen`, and WebGPU adapter/device calls if available

If context creation must be probed, label that as probe-induced evidence so it is not confused with the page's real context.

## Target Model

The target may be a surface group:

```text
canvas#background
+ canvas#particles
+ DOM mask
+ scroll progress
```

Use `targetSet` in Scout Card and Manifest. Do not force the result into a single `targetCanvas`.

## Ranking And Attribution

Rank candidates for attribution by:

- overlap with the requested visual area
- frame-to-frame pixel change
- z-order and clipping relationship
- pointer/scroll/resize coupling
- route persistence
- owner traceability

Attribution scoring dimensions:

- `visualCoverage`: how much the surface overlaps the target visual region
- `temporalActivity`: how much the surface changes across sampled frames
- `interactionCoupling`: pointer, scroll, resize, or route changes affect the target
- `sectionCoupling`: relationship to page sections, sticky positioning, masks, and clips
- `routePersistence`: whether the surface persists across route changes
- `ablationImpact`: what target pixels/behaviors disappear when the surface is hidden or frozen
- `ownershipEvidence`: how well context and renderer owner can be traced

## Attribution Actions

Use the lowest-cost action that resolves the current unknown:

1. style, bounds, and visibility observation
2. multi-frame diff on a target crop
3. temporary `visibility:hidden`, opacity, transform, or clip ablation
4. freeze `requestAnimationFrame` or replace a candidate surface output
5. pointer sweep
6. small scroll
7. resize
8. route switch
9. owner stack or preload probe

All modifications are brief, reversible, and observational. Do not persist source-site changes.

## Evidence Examples

Strong attribution examples:

- target crop loses the distortion only when `surface-2` is hidden
- scroll progress changes uniforms on `surface-1` and the visual phase changes accordingly
- DOM mask plus canvas output together create the visible target; either alone is incomplete
- `OffscreenCanvas` worker owns the only context whose frame changes match the target crop

Weak attribution examples:

- candidate is the largest canvas
- candidate animates continuously
- candidate has a framework-looking dataset attribute
- bundle contains shader strings but no target binding exists

Area alone is weak evidence. A small overlay, mask, or DOM layer may be essential to the target effect.
