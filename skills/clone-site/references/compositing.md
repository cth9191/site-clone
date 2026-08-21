# Compositing GPU effects into the DOM shell

The DOM track leaves a **placeholder mount** wherever a GPU surface belonged.
The GPU track produces a **self-contained effect module**. Compositing is the
contract that joins them. Most "the clone looks off" bugs are composite bugs, not
extraction bugs: the effect renders perfectly in its own baseline, then sits at
the wrong depth, swallows clicks, or renders blurry once it's in the page.

## The mount contract

Each effect module should expose a tiny, framework-agnostic lifecycle so any
shell (Vite, Next, plain HTML) can drive it the same way:

```js
// effect module (per GPU surface)
export function mount(canvasEl, opts) { /* start renderer + rAF loop */ return handle }
export function unmount(handle)        { /* cancel rAF, lose context, free GPU */ }
export function resize(handle, w, h, dpr) { /* update drawing buffer + viewport */ }
```

The DOM shell mounts it into the placeholder container from the surface map:

```js
const el = document.querySelector(MOUNT_SELECTOR);
const canvas = document.createElement('canvas');
el.appendChild(canvas);
const handle = mount(canvas, { /* uniforms captured by shader-extract */ });
```

## Get these five things right (they are the usual failure points)

1. **Sizing + DPR.** The drawing buffer must be `cssWidth * dpr` by
   `cssHeight * dpr`, with the canvas CSS-sized to the container. Skipping DPR is
   the #1 "why is the clone blurry / aliased" cause on retina displays. Re-run
   `resize()` on container resize (ResizeObserver), not just window resize.
2. **z-index + stacking.** Copy `zIndex` and `position` from `surface-map.json`.
   A hero shader usually sits at a low z-index BEHIND the text, not on top. If it
   covers the copy, the composite is wrong even though the effect is right.
3. **pointer-events.** Copy the original's `pointerEvents`. A full-bleed
   background canvas almost always needs `pointer-events: none` so buttons and
   links under/over it stay clickable. An *interactive* effect (cursor-reactive
   blob) needs pointer events ON — the surface map records which.
4. **Teardown.** On route change / unmount, call `unmount()` and let the WebGL
   context go (`loseContext()`). Leaking contexts hits the browser's ~16-context
   limit fast on multi-effect pages and the later canvases silently go black.
5. **Reduced motion + offscreen pause.** Respect
   `prefers-reduced-motion: reduce` (render a static first frame or the captured
   poster). Pause the rAF loop when the canvas is scrolled out of view
   (IntersectionObserver) — the original may not, but it's cheap fidelity-neutral
   insurance against jank, and matches how good sites ship these.

## Multiple effects on one page

Mount each into its own container from the surface map. Share a single renderer
only if all effects came from the same driver and baseline; otherwise keep them
independent so one failing effect can't black out the others. Watch the context
budget (point 4).

## When the effect can't be reconstructed

If shader-extract returned only an approximate or poster-only result (e.g.
cross-origin readback was blocked, or the surface was `CANVAS_UNKNOWN`), mount
its fallback (captured poster image or a low-fidelity approximation) and record
the gap in the completion report. Do not silently ship a dead container — a
poster still reads as intentional; an empty box reads as broken.
