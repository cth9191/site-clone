# TEARDOWN.md — the human-readable blueprint

`surface-map.json`, `motion.json`, and `tokens-*.json` are machine evidence.
`TEARDOWN.md` is the same evidence written for a person: what the site is made
of, how every effect actually works, and what it would take to rebuild it. It is
the deliverable of `--analyze-only` runs, the briefing the builders work from on
full runs, and — because the reveals are usually "that impressive thing is 54
images swapped on mousemove" — the raw material for a video.

Write it at the end of Phase 1, from the probe outputs + your scroll/hover sweep.
Every claim carries an evidence tag:

- **CONFIRMED** — read from a live runtime object or computed style
  (`ScrollTrigger.getAll()`, `getComputedStyle`, `document.getAnimations()`).
- **OBSERVED** — seen during the sweep (screenshots at scroll offsets, hover
  before/after) but the mechanism wasn't exposed by a probe.
- **INFERRED** — guessed from class names / markup / general patterns. The
  builder should verify before relying on it.

Never upgrade a tag. A clone built on INFERRED values needs a diff pass to prove
them; one built on CONFIRMED values mostly needs a diff pass to catch typos.

## Template

```markdown
# Teardown: {site name}

**URL:** {url}   **Analyzed:** {YYYY-MM-DD} @ {1440/768/390}
**Platform:** {Next.js / Webflow / Framer / WordPress / custom} — {evidence}
**Built by:** {agency/dev, if a footer/meta credit exists; else omit}
**Surfaces:** {N} DOM sections, {N} GPU surfaces ({drivers}), {N} video

## Stack (from runtime)

| Layer | What | Evidence |
|---|---|---|
| Framework | {…} | `__NEXT_DATA__` present / `data-framer-name` / … |
| Animation | GSAP {ver} + ScrollTrigger ({n} triggers, {n} pinned, scrub on {n}) | `motion.json › gsap, scrollTrigger` |
| Scroll | Lenis lerp {x} duration {y} | `motion.json › lenis.options` |
| 3D / GPU | {three.js r{ver} / Unicorn Studio / none} | `surface-map.json` |
| Sliders | {Swiper: loop, autoplay 4000, effect fade} | `motion.json › sliders` |
| Fonts | {Family A (display), Family B (text)} — self-hosted woff2 / Google | `tokens.fontFaces` |

## Design system (measured)

**Palette** — top values by usage, role-labeled:
| Role | Value | Uses |
|---|---|---|
| Page bg | {#…} | {n} |
| Text | {#…} | {n} |
| Accent | {#…} | {n} |

**Type scale @1440** (size / line-height / weight — family):
| Role | Value | Example |
|---|---|---|
| h1 | {…} | `.hero__title` |
| h2 | {…} | |
| body | {…} | |
| label/eyebrow | {…, letter-spacing, uppercase} | |
{Note what changes @768 and @390 — usually 2–4 lines.}

**Spacing rhythm** — {base unit + the 5–8 values that carry the layout}.
**Radii** {…} · **Shadows** {…} · **Max-width** {…} · **Breakpoints** {…}
**Custom props** — {if the site exposes its own tokens, list the important ones;
reuse their names in the clone}.

## Effects (one row per distinct effect, top-to-bottom)

| # | Section | Effect | Mechanism | Tag | Complexity |
|---|---|---|---|---|---|
| 1 | Hero | Title chars rise + fade in on load | SplitText → stagger 0.03, y 100%→0, power3.out, 1.2s | CONFIRMED | Low |
| 2 | Hero | Background liquid gradient | WebGL2 fragment shader, three.js, 2 uniforms (time, mouse) | CONFIRMED (surface) / PARTIAL (replay) | High |
| 3 | Features | Sticky mock swaps as copy scrolls | `position:sticky` + IntersectionObserver threshold 0.5 | CONFIRMED (IO instrumented) | Med |
| … | | | | | |

## Reveals — how the impressive ones actually work

### {Effect #} — {name}
**What it looks like:** {one sentence}
**What it is:** {the mechanism in plain words — the "oh, that's all it is"}
**Exact params (CONFIRMED):**
```
{paste the relevant motion.json entry: trigger, start/end, scrub, vars…}
```
**Rebuild note:** {the one thing that makes it feel right — easing, the lerp
value, the DPR handling, the fact that it's 3 layers not 1}

{Repeat for every effect rated Med/High, and any Low that's load-bearing.}

## Assets

| Asset | Role | Tier | Notes |
|---|---|---|---|
| hero-bg.mp4 | decorative bg | REAL | 1920×1080, 4.2 MB |
| logo.svg | identity | PLACEHOLDER | don't copy brand |
| noise.png | texture | RECONSTRUCT | generate with canvas |
{Tiers from `dom-clone/references/asset-resolution.md`.}

## Build plan

**Substrate:** {Vite+TS / Next+Tailwind} — {why, per Phase 2 rules}
**Packages:** `npm i {gsap lenis three …}`
**Order:** {section list top-to-bottom, each with: interaction model, which
effects from the table, expected difficulty}
**Known gaps:** {cross-origin stylesheets that hid @font-face, un-instrumented
IO, surfaces flagged CANVAS_UNKNOWN, premium plugins (SplitText/ScrollSmoother
need Club GSAP → use free alternatives or the now-free GSAP 3.13+)}
```

## Common reveals (look for these first)

Most "how did they do that" effects on award sites are one of these. When the
probe shows the signature, name it:

- **Image sequence on scroll/mouse** — N preloaded frames, one visible. Signature:
  many sibling `<img>`/canvas draws + a scrub ScrollTrigger or mousemove listener.
- **SplitText reveal** — `.char/.word/.line` wrappers + staggered tween.
- **Parallax layers** — several tweens on siblings with different `y`/`yPercent`
  and the same trigger, or mousemove → `transform` with different multipliers.
- **Scrub animation** — `ScrollTrigger.scrub: true|number`. Number = lerp delay.
- **Pinned section** — `pin: true` with a long `end` (`+=200%`); inside it,
  content swaps by progress.
- **CSS-var driven** — JS writes `--progress`; CSS `calc()`s off it. Look for
  custom props that change as you scroll.
- **Smooth scroll** — Lenis on `<html class="lenis">`. Feel comes from `lerp`.
- **Page transitions** — barba / Swup global + an overlay element with z-index
  9999.
- **Grain** — a fixed full-viewport div, noise PNG/SVG `feTurbulence`,
  `mix-blend-mode: overlay|soft-light`, low opacity, sometimes animated
  `background-position`.
- **Custom cursor** — fixed small element + mousemove + `gsap.quickTo` /
  `quickSetter`; often two elements (dot + ring) with different lerps.
- **Marquee** — `@keyframes` translateX −50% on a duplicated track, or GSAP
  `repeat:-1` with `xPercent`.
- **Magnetic button** — mousemove inside a hit area → `x/y` tween toward cursor,
  `elastic.out` on leave.
- **Reveal on scroll** — IO (threshold 0.1–0.3) toggles a class; CSS transition
  does the motion. Or ScrollTrigger `toggleActions: "play none none reverse"`.
- **Theme flip by section** — IO or ScrollTrigger toggling a class on `<body>`;
  CSS vars swap; 0.4–0.8s transition on background/color.
- **Text scramble / counter** — rAF loop writing `textContent`; not an animation
  the probe can see — OBSERVED, note the duration.
