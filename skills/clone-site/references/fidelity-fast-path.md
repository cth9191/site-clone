# The fidelity fast path — reuse the original's CSS instead of rebuilding it

Validated on a real clone run (Nuxt marketing site): this path reached a
**0.02–0.06% pixel diff** on the DOM track in one pass, where rebuild-from-spec
typically lands at 1–3% after several fix rounds. Prefer it whenever it applies.

## When it applies

The target ships **scope-attributed CSS** — Vue scoped styles (`data-v-*`),
CSS Modules (hashed class names), styled-components (hashed classes), Angular
(`_ngcontent-*`). The attributes/classes are baked into the rendered DOM, so:

> post-hydration HTML + the site's own stylesheets + rewritten asset paths
> = pixel-identical DOM layer, byte for byte.

It does NOT apply when the goal is a *maintainable* codebase to keep developing
(then use dom-clone's component rebuild), or when the user asked for a specific
stack. Say which path you chose and why in the report.

## The recipe

1. **Capture post-hydration HTML** after a full settle scroll:
   `document.documentElement.outerHTML` via Playwright. Not view-source — the
   served HTML lacks client-rendered state.
2. **Download every stylesheet** in document order (`<link rel=stylesheet>`
   hrefs). Concatenate in that order — cascade order is load order.
3. **Rewrite paths** in both HTML and CSS: absolute site URLs → local, CDN image
   URLs (strip query params, keep a deterministic filename), `/fonts/`,
   `url(...)` in CSS. Grep the result for `https?://` afterward — remaining
   hits should only be outbound links, or you missed an asset.
4. **Strip the runtime**: remove `<script>` tags and preload/prefetch links.
   Keep everything else, including framework scope attributes and inline
   `style=""` — they're part of the captured state.
5. **Capture state you can't see at rest.** SPA frameworks render only the
   ACTIVE state into the DOM — inactive tab panels, closed dropdowns, unfired
   dialogs simply don't exist in the capture. For each stateful widget, drive
   the live site (click each tab/accordion/menu) and save each state's
   innerHTML; replay those snapshots from your own JS. The interaction sweep's
   click step is where you find these.
6. **Beware capture-time inline state**: elements the site's JS was mid-
   animating carry inline `opacity`/`transform` from the moment of capture
   (e.g. a bar captured at `opacity: 0`). Your rewritten behavior JS must own
   those elements' initial state explicitly, not trust the captured inline value.
7. **Rebuild only behaviors** (one small JS entry): smooth scroll, canvas/GPU
   mounts, state machines, toggles — from `motion.json` params. CSS-driven
   effects (scroll-timelines, keyframes, transitions) came along with the
   stylesheets for free — do not reimplement them.

## Trigger-position drift (bit us; will bite again)

Scroll-triggered behaviors computed at load go stale when lazy images/fonts
shift layout seconds later — symptom: effects fire at the wrong scroll position
only on some breakpoints. Standard fix, include it by default:

```js
let lastH = 0, t = 0;
new ResizeObserver(() => {
  const h = document.documentElement.scrollHeight;
  if (h === lastH) return; lastH = h;
  clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 120);
}).observe(document.body);
```

## Matching state machines: measure thresholds, don't guess them

For each observed state flip (header theme, content swap, element fade), sample
the original at a FINE grain around the transition (±50px steps) and record the
exact trigger geometry before implementing. Two traps proven real:
- a flip can be **binary** where you'd assume scrubbed (and vice versa) — the
  fine-grained samples tell you which;
- the trigger element is often NOT the section that changes (a header flips on
  the NEXT section's top edge, at an offset unrelated to the header's height).
Also check for CSS-variable drivers before assuming classes: if a computed style
uses `color-mix(... var(--x-progress) ...)`, the JS writes that var — toggling
the class alone changes nothing visible.

## When the GPU surface is a known library, reuse it (SOURCE fidelity)

Before routing a canvas to shader-extract, grep the bundles for library
fingerprints: `data-paper-shader` / `@paper-design` (Paper Shaders),
`unicorn.studio`, `spline-viewer`, `rive`, `lottie`, `r3f`/`@react-three`,
`ogl`. If the effect is an off-the-shelf component, the bundle usually carries
its **props verbatim** (Next.js app-router chunks are barely minified — read the
page chunk, it IS the source). Install the same package and pass the same props:
that's SOURCE fidelity for free, no capture/replay needed. Also copy the site's
**render gate** (reduced-motion / pointer / width / cores / GPU-renderer
checks) — it decides when the fallback shows, and the fallback is part of the
look. Add a `?shaders=1|0` override so QA can exercise both paths.

Mount-point rule: when the original renders the effect wrapper *conditionally*,
your mount element must be visually inert (no background, no filter) — put the
wrapper styling on the mounted component, or the fallback state shows a blank box.
