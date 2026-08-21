# Teardown: Fin — Global Money Movement

**URL:** https://www.fin.com/   **Analyzed:** 2026-08-21 @ 1440×900 (tokens also needed @768/390 — see gaps)
**Platform:** Nuxt 3 (Vue) — `/_nuxt/*` chunks, `_payload.json`, `data-v-*` scoped CSS, Sanity CMS images (`cdn.sanity.io/images/xemwqsar`)
**Surfaces:** 12 DOM sections (15,482 px tall), 1 WebGL2 surface (globe, fixed fullscreen), 2 Canvas2D surfaces (hash-pattern hero + products), 0 video

## Stack (from runtime)

| Layer | What | Evidence / tag |
|---|---|---|
| Framework | Nuxt 3 / Vue | `__NUXT__`-style payload, `data-v-` attrs — CONFIRMED |
| Smooth scroll | Lenis 1.3.18 (`html.lenis`), options not exposed on window → assume defaults (lerp .1) | `motion.json › libraries` — CONFIRMED lib / INFERRED opts |
| Scroll motion | **Native CSS scroll-driven animations** (`animation-timeline: view()/scroll(root)`) for text reveal, card rotate-in, hero-logo fade | `motion.json › scrollTimelines` — CONFIRMED |
| JS motion | GSAP 3.14.2 bundled + ScrollTrigger (drives globe state + narrative-stats only; 0 pin-spacers) | bundle `CdyC9JT-.js` — CONFIRMED |
| 3D | three.js (Line2/LineSegments2 present), custom `ShaderMaterial` globe | bundle `CdyC9JT-.js` — CONFIRMED |
| Marquee | CSS `@keyframes scroll-left` 18 s linear, distance via `--hero-logos-scroll-distance` | CONFIRMED |
| Fonts | PPCirka (Medium 500 / Bold 700), Neue Haas Grotesk Text (55 Roman / 65 Medium), self-hosted woff2 | `tokens.fontFaces` — CONFIRMED |
| Analytics | GA4 `G-4GS5ZRYYDX` — omit | — |

## Design system (measured, @1440)

**Palette** (site's own tokens, `:root`):
| Token | Value | Role |
|---|---|---|
| `--base-1000` / `--black` | `#040402` | page bg (dark half) |
| `--base-0` / `--stone` | `#d1c8b6` | primary light text (202 uses) |
| `--base-100` | `#e6e7dd` | light-section bg (compliance/coverage/testimonials) |
| `--base-400` | `#78736a` | secondary text on dark |
| `--base-500` | `#73746e` | tertiary / disabled |
| `--base-600` | `#5d5d58` | secondary text on light |
| `--base-900` | `#1a1a18` | footer-banner bg |
| `--gold` | `#c6b07d` | accent, text-reveal leading edge |
| `--gold-light` | `#d5c9ac` | CTA fill |
| `--gold-shade` | `#9a8354` | |
| hash glyphs | `#886E5E` | hash-pattern canvas ink |
| `--ease-default` | `cubic-bezier(.2,0,0,1)` | every transition |
| `--ease-enter` / `--ease-exit` | `cubic-bezier(.1,.9,.2,1)` / `cubic-bezier(.4,0,1,1)` | |
| `--radius` | `.25rem` | (cards use 30 px on one corner only) |
| `--header-height` | `2.25rem` | |

**Root font-size is fluid**: body computes to 32.04 px at 1440 → `html { font-size: 2.225vw }` (32.04/1440). All sizes below are rem-multiples of that.

**Type scale** (size / lh / weight — family):
| Role | @1440 | rem | Example |
|---|---|---|---|
| `--size-XXL` h1 | 80.1 / 72.09 / 400, ls −1.6 px — PPCirka | 2.5rem / .9 | `.hero h1` |
| `--size-XL` | 64.08 / 59.59 — PPCirka | 2rem / .93 | section h2 |
| `--size-L` | 48.06 / 48.06, ls −.96 — PPCirka | 1.5rem / 1 | `.problem__headline` |
| `--size-M` | 32.04 / 35.24 — PPCirka | 1rem / 1.1 | stats value |
| `--size-label-M` | 20.03 / 26.43 — Haas Medium | .625rem | dt |
| `--size-button` | 16.82 / 16.82 — PPCirka Bold | .525rem | `.cta` |
| `--size-label-S` | 16.02 / 16.02 — Haas Medium | .5rem | |
| `--size-label-XS` | 14.02 / 14.02 — Haas Medium | .4375rem | nav links |
| `--size-body` | 13.62 / 19.06 — Haas Roman | .425rem / 1.4 | paragraphs |
| `--size-body-XS` | 12.82 / 17.94 — Haas Roman | .4rem | stats description |

**Spacing rhythm**: 8.01 (176×), 32.04 (148×), 40.05 (91×), 16.02, 24.03, 48.06, 56.07, 64.08, 96.12, 128.16 → a .25rem base grid on the fluid root. **Max-widths**: 640.8 px (20rem) hero copy / product header; 768.96 px (24rem) solution headline. **Breakpoints** in CSS: 580, 768, 780, 800, 1024, 1199, 1280, 1440, 1680.

**Buttons** (`.cta`): PPCirka Bold 16.8 px, no radius, primary = `#d5c9ac` fill + `#040402` text, ghost = transparent + `#d1c8b6` text + 1 px dotted border (header "Book a demo"); transition `opacity,background,border-color,color .2s var(--ease-default)`.

**Fixed chrome**: `header` 72 px z-100 (dark→light variant flips with section theme); `.hash-pattern--fixed` z-0; `.globe-layer` z-1 (fixed, pointer-events auto); `.narrative-stats` fixed bottom strip z-10 (187 px tall, shows during hero/problem/solution); `.industries__heading` sticky; `.code-section__content` sticky (1545 px).

## Effects (top-to-bottom)

| # | Section | Effect | Mechanism | Tag | Cx |
|---|---|---|---|---|---|
| 1 | global | Smooth scroll | Lenis 1.3.18, defaults | CONFIRMED lib | Low |
| 2 | hero bg | Hex "hash" grid, characters flicker, mouse reveals | Canvas2D, see Reveal A | CONFIRMED (source) | Med |
| 3 | hero | Stone planet with earth relief, payment arcs | WebGL2 three.js custom shader, see Reveal B | CONFIRMED (uniforms) / PARTIAL (shader body) | High |
| 4 | hero | Logo strip fades out in first 125 px | `animation-timeline: scroll(root); animation-range: 0 125px` opacity 1→0 | CONFIRMED | Low |
| 5 | hero | Logo marquee | `@keyframes scroll-left` 18 s linear infinite, `translate3d(calc(var(--hero-logos-scroll-distance)*-1))` — JS sets the var to track width | CONFIRMED | Low |
| 6 | problem / solution | Paragraph "ink fill" reveal as you scroll | `background-clip:text`, bg `linear-gradient(to right, var(--base-0) 90%, var(--gold) 95%, transparent)`, `background-size` 0→110% on `view()`, range `cover 25vh → contain 54vh`, base color `color-mix(base-0 25%, transparent)` | CONFIRMED | Low |
| 7 | hero→solution | Globe rotates/moves between 3 states | GSAP ScrollTrigger `start:"top 82%" end:"center center" scrub:1` lerping rotation `{x:-58°, y: 0 → -60° → -51.5°}`; desktop cam `y0 z400`, mobile `y0 z400 globeY20 scale .85` | CONFIRMED | Med |
| 8 | hero→solution | Narrative stats strip (fixed bottom) swaps copy per section | fixed `.narrative-stats` z-10, content driven by same ScrollTrigger progress | OBSERVED | Low |
| 9 | products | Two cards rotate in from ±15° | `rotateFirst`: `rotate 15deg, translate 0 10vh → none, -43%` range `normal → contain 30vh`; `rotateSecond`: `-15deg, 0 5vh` range `→ contain 10vh`; `view()` timeline, `transform-origin` left-bottom / right-top, one 30 px corner radius each | CONFIRMED | Low |
| 10 | products | Product tabs (API / Dashboard …) | click tabs `.tab--active`, `panel-item-in` keyframe | OBSERVED | Low |
| 11 | industries | Sticky heading + 6 cards scroll past | `position: sticky` heading, 3364 px section | CONFIRMED (fixed list) | Low |
| 12 | code | Sticky code panel 1545 px, SVG code mock swaps | sticky `.code-section__content`, `/images/code-api-{1,2}.svg` + f-shape SVGs | OBSERVED | Med |
| 13 | compliance → testimonials | Theme flips dark→light (`#e6e7dd`), header goes `header--light` | bg on sections + class toggle on header (IO or ScrollTrigger) | OBSERVED | Low |
| 14 | faq | Accordion | `grid-template-rows .3s ease` on `.faq__answer` (0fr↔1fr) | CONFIRMED | Low |
| 15 | header | Dropdown panels | `header-dropdown-in` / `panel-item-in` keyframes (opacity+translateY) | CONFIRMED | Low |
| 16 | all | Hover feel | opacity .2–.3 s, transform .4 s, all `cubic-bezier(.2,0,0,1)` | CONFIRMED | Low |

## Reveals

### A — The "hash" background (Canvas2D) — CONFIRMED from `tL3GLLD1.js › HashPattern`
**Looks like:** a wall of hex addresses that quietly mutate; your cursor burns a soft spotlight through it.
**Is:** a grid of `0x` + 34 random hex chars, wrapped to fit 54×85 px cells, redrawn cell-by-cell on a timer. No shader.
```
chars      = "0123456789abcdef" (drawn uppercase), length 36 incl. "0x"
cell       = 54 × 85 px, gap 4, font "14px monospace", color #886E5E, ink wraps p chars/line (p = floor(54 / measureText("0")))
opacity    = random from [.2,.25,.3,.35,.4,.45,.5] per cell
cell reset = every 800–6000 ms (new value + opacity)
shuffle    = every 18–56 ms, 2–4 chars swapped; ≤112 cells/frame (24 mobile); +14 ambient flips (4 mobile)
scheduler  = setTimeout(min(nextDue, 22 ms)) → rAF; sleeps when hidden / opacity ≤ .001
mouse      = cell under cursor resets immediately; a `.mask` div paints
             radial-gradient(circle 200px at cursor, transparent 10%, rgba(0,0,0,.5) 100%)
grid align = centered (floor((W - cols*58 + 4)/2)); optional maskUrl (mask-image, contain)
```
**Rebuild note:** the feel is the slow random cadence, not the speed. Keep the per-cell timers; don't redraw the whole canvas per frame.

### B — The planet (WebGL2) — uniforms CONFIRMED, shader body PARTIAL
**Looks like:** a sandstone Earth lit from upper-left, continents standing proud, gold payment arcs.
**Is:** one sphere, `ShaderMaterial` with PBR-ish stone maps + landmask displacement, 3 analytic lights, `Line2` arcs.
```
textures   = /textures/omma/stone-{diffuse,normal,roughness}-1k.jpg (tiled stoneRepeat 6×?), 
             /textures/omma/earth-daymap-2k.jpg (desktop mask), /textures/earth-landmask-mobile.jpg
uniforms   = reliefScale, displacementHeight = reliefHeight .03, normalStrength = cliffShading .06,
             saturation .8, stoneRepeat (6, ?), key/fill/rim light pos+color, ambientColor,
             lightAttenuation = k/(d²), arcReflectionStrength 0, hasEnvMap
emissive   = goldColor * goldMask * 0.08 (+ contactAO) — land edges glow faintly gold
camera     = desktop {y:0, z:400}, ≥768 → {y:125, z:120, globeY:7.5} alt preset; globe rotation.x = -58°
states     = rotation.y: hero 0 → problem -60° → solution -51.5°, scrubbed (ScrollTrigger scrub:1)
arcs       = Line2 / LineSegments2 with dashSize 1, gapSize 1, dashOffset animated; linewidth 1 (px)
post       = tonemapping_fragment + colorspace_fragment includes (standard three pipeline)
```
**Rebuild note:** a `MeshStandardMaterial` with `map=stone-diffuse`, `normalMap`, `roughnessMap`, `displacementMap=landmask`, `displacementScale≈.03·R`, plus 3 `DirectionalLight`s (warm key upper-left, cool fill, rim) and `emissiveMap=landmask` × gold at .08 gets ~90 % of the look without porting the shader. Fidelity label: **approximate**, not SOURCE.

### C — Scroll-driven text reveal — CONFIRMED
Pure CSS; every paragraph `span` carries it. Copy the rule verbatim (effect #6). Note `text-wrap: balance`.

## Assets

| Asset | Role | Tier | Notes |
|---|---|---|---|
| 4 × woff2 fonts | identity-adjacent (licensed: Pangram Pangram PPCirka, Monotype NHG) | REAL (local learning clone only) | `assets/fonts/` — do not redistribute |
| 5 × globe textures | decorative | REAL | `assets/textures/` |
| `code-api-1/2.svg`, `code-f-shape-*.svg` | content | REAL | `assets/images/` |
| 101 flag SVGs | content | REAL | `assets/images/*.svg` (coverage section) |
| 28 Sanity images (product mocks, industry photos, team, testimonial logos) | content / photos of people | REAL | `assets/images/<hash>-WxH.*` — swap for PLACEHOLDER if publishing |
| Fin logo (inline SVG in header) | identity | inline in HTML | keep for learning clone only |

## Build plan

**Substrate:** Vite + vanilla TS (static marketing page, GPU hero) — `site/`.
**Packages:** `three lenis gsap` (ScrollTrigger is in gsap core since 3.13).
**Approach (fidelity-first):** reuse the **post-hydration HTML** (`captures/page.html`) and the **original scoped CSS** (`assets/css/*.css`) — Nuxt's `data-v-*` attributes are already in the markup, so original CSS + static HTML is pixel-identical for the DOM track. Rewrite only the JS behaviors:
1. Foundation — `index.html` shell, fonts, CSS concat with `/_nuxt/` + `/fonts/` + Sanity paths rewritten to `/assets/…`.
2. Lenis init.
3. `hash-pattern.ts` from Reveal A (two instances: fixed hero, absolute products).
4. `globe.ts` from Reveal B (three.js approximate) + ScrollTrigger state lerp.
5. Header: scroll-past-threshold + light/dark flip on section theme; dropdowns.
6. Hero-logos: set `--hero-logos-scroll-distance` = track width; tabs; FAQ toggles.
7. QA: Playwright pixel diff at 1440/768/390 masking `.globe-layer canvas` + `.hash-canvas`.

**Known gaps:** tokens only measured @1440 (rem-based so scales, but verify 768/390 media rules); IO/listeners not instrumented (CLI run-code couldn't persist `addInitScript` across invocations — fixed in skill notes); globe shader body not ported (approximate); narrative-stats copy swap timing OBSERVED; Lenis options assumed default.
