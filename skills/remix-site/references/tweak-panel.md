# Tweak panel — the knobs you'll actually turn

Built on the picked direction only. 10–15 knobs. The test for including one:
*would the user change this twice in the next hour?* Accent yes; the 7th
spacing step no.

## The --p-* pattern (how a patch becomes tweakable)

A knob can only drive what is already a variable. So when you write a
direction's `patch.css`, declare every decision as a `--p-*` custom property
with its default in the `:root[data-rx="<slug>"]` block, and reference it in
the rules (`filter: grayscale(var(--p-hero-gray)) contrast(var(--p-hero-contrast))`).
The panel then sets `--p-*` on `:root` live. Validated pattern: hero processing
(gray/contrast/brightness/invert/blur), overlay gradient (alpha/angle/reach),
scanlines, figure transform (scale/x/y/opacity), grain opacity, grid
size/alpha, hairline weight/style, radius, shadow, display tracking/leading/
weight, body leading, section rhythm multiplier, content max-width, CTA colors,
footer colors. Use `zoom` (not `transform: scale`) for display scale so the
layout reflows.

"Aggressive" is fine — 60–80 knobs is workable **if** they are grouped
(Color / Type / Space / Hero / Texture / Motion / GPU / Footer), searchable,
and every group can collapse. The panel ships with a filter box, presets,
collapse-all, shuffle-within-ranges, right-click-to-reset per knob,
double-click a value to type it, and a resize grip.

## panel.json schema

```json
{ "title": "Night Signal", "slug": "night-signal",
  "presets": { "as picked": {}, "inverted": { "--rx-color-bg": "#0a0a0a", "--p-hero-invert": 1 } },
  "knobs": [
    { "id": "--rx-color-1",            "label": "Accent",          "group": "Color",  "type": "color",  "default": "#1f3bff" },
    { "id": "--rx-color-bg",           "label": "Page",            "group": "Color",  "type": "color",  "default": "#ffffff" },
    { "id": "--rx-font-1",             "label": "Display font",    "group": "Type",   "type": "select", "options": ["Inter","Instrument Serif","Geist Mono"], "default": "Inter" },
    { "id": "--rx-size-1",             "label": "Display size",    "group": "Type",   "type": "length", "default": "80px", "min": 40, "max": 140, "step": 1, "unit": "px" },
    { "id": "--rx-space-2",            "label": "Section gap",     "group": "Space",  "type": "length", "default": "128px", "min": 48, "max": 240, "step": 4, "unit": "px" },
    { "id": "--rx-radius-1",           "label": "Radius",          "group": "Space",  "type": "length", "default": "4px", "min": 0, "max": 32, "step": 1, "unit": "px" },
    { "id": "motion.reveal.y",         "label": "Reveal travel",   "group": "Motion", "type": "number", "default": 22, "min": 0, "max": 80, "step": 1 },
    { "id": "motion.reveal.duration",  "label": "Reveal duration", "group": "Motion", "type": "number", "default": 0.7, "min": 0.1, "max": 2, "step": 0.05 },
    { "id": "motion.stagger",          "label": "Stagger",         "group": "Motion", "type": "number", "default": 0.08, "min": 0, "max": 0.3, "step": 0.01 },
    { "id": "shaders.hero.colorFront", "label": "Paper tint",      "group": "GPU",    "type": "color",  "default": "#9FADBC" },
    { "id": "shaders.hero.intensity",  "label": "Texture",         "group": "GPU",    "type": "number", "default": 0.5, "min": 0, "max": 1, "step": 0.02 }
  ] }
```

- `--*` ids set CSS custom properties live on `:root`.
- Dotted ids patch `window.__remix` via `__remix.apply({...})`, which dispatches
  `rx:change`. Behaviors must read their params at call time (not cache them
  at import), and shader mounts must listen for `rx:change` and re-render
  with the new props. Hoist both during Phase 0 if the clone didn't.
- Groups render as collapsible sections in the given order.
- `slug` (optional): the panel only mounts when that direction is active.
- `presets`: named partial states layered on the direction; keys are knob ids.
- `labels` on a select: display names parallel to `options` (use for font stacks).

## Wiring

```ts
import rx from './remix/remix-loader';            // first — applies the direction
import { mountTweakPanel } from './remix/tweak-panel.js';
import panel from '../remix/panel.json';
if (import.meta.env.DEV) mountTweakPanel(panel);   // dev-only
```

## Verify before reporting

1. Every knob visibly changes the page (screenshot two extremes for a couple).
2. Permalink round-trips: copy link → open in a fresh tab → same state.
3. Reset returns exactly to the direction's defaults (0 % diff vs `?rx=<slug>`).
4. Copy JSON → `apply-overrides.js` accepts it as a new direction.
5. Production build contains no panel (`grep rx-panel dist/` → nothing).
