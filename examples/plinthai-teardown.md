# Teardown: Plinth — Pay-per-call AI agent marketplace

**URL:** https://www.plinthai.xyz/   **Analyzed:** 2026-08-21 @ 1440/768/390
**Platform:** Next.js (app router, `__next_f`), Tailwind v4 (single compiled CSS), next/font, next/image, framer-motion, PostHog
**Surfaces:** 10 DOM sections (8,791 px @1440), 3 kinds of GPU surface — all **Paper Shaders** (`@paper-design/shaders-react`)

## Stack (from runtime + readable bundle — everything CONFIRMED)

| Layer | What | Evidence |
|---|---|---|
| Framework | Next.js app router | `__next_f`, `/_next/static/chunks/app/page-*.js` |
| Styling | Tailwind v4 utilities + tokens `--color-accent #1f3bff`, ink `#181815`, muted `#6e6e68`, border `#e6e6e1`, surface `#f4f4f1` | `tokens-1440.json`, `fa0715c581b9da0d.css` |
| Fonts | Inter (100–900 var), Geist Mono, Instrument Serif — next/font self-hosted, open licenses | `@font-face` in CSS |
| Motion | framer-motion (`Reveal`/`Stagger`/`StaggerItem`, FeatureRow slide-in, progress bars, nav entrance) | chunk 6572 + page chunk |
| GPU | Paper Shaders: `PaperTexture` (hero), `GrainGradient` ×3 (features), `Dithering` (footer reveal) | chunk 6572 |
| Gate | shaders only if: no reduced-motion, fine pointer, width ≥1024, no saveData, cores ≥4, memory ≥4, non-software GPU renderer | chunk 6572 `l()` |
| Background | 72 px CSS grid lines on `<main>`; `.grain-overlay` = inline SVG feTurbulence | HTML/CSS |

## Effects

| # | Where | Effect | Exact params | Tag |
|---|---|---|---|---|
| 1 | nav | Enters from above; goes solid when scrolled | `y:-64→0, .6s, [.16,1,.3,1]`; `scrollY>24` swaps `border-white/15 bg-[rgba(12,19,48,.30)]` ↔ `border-border bg-bg/75`, text white↔ink | CONFIRMED |
| 2 | hero | Paper-texture dither over the painting | `PaperTexture contrast .06 roughness .06 fiber 0 fiberSize .23 crumples 0 crumpleSize .09 folds 0 foldCount 9 fade 0 drops .2 seed 16 scale 1 fit cover image /hero-bg.jpg colorFront #9FADBC`, wrapper `bg #fff filter brightness(1.05) saturate(1.04)`; + overlay `linear-gradient(96deg, rgba(10,20,72,.62) 0%, rgba(12,24,90,.40) 30%, rgba(12,24,90,.14) 50%, transparent 64%)` | CONFIRMED |
| 3 | all sections | Reveal on scroll | `opacity 0→1, y 22→0, .7s [.16,1,.3,1]`, viewport once, margin −80px; Stagger gap .08 (FeatureRow copy .07), item y 18 .6s | CONFIRMED |
| 4 | features | Visual slides in | `x ±56→0 (reverse rows +56), .8s`, margin −90px | CONFIRMED |
| 5 | features | Animated gradients | Publish `corners [#7300FF,#EBA8FF,#00BFFF,#2A00FF] speed 1.8 softness .5 intensity .5 noise .25 bg #000`; Meter `wave [#6835E8,#3E31F5,#00C0FA] 1.48/.7/.15/.5 bg #000A0F`; Compose `truchet [#004275,#FF8170,#FE5545] 1.78/.32/.29/1 bg #0A0000`; each with CSS radial-gradient fallback + `.grain-overlay`; mounted only within 300px of viewport | CONFIRMED |
| 6 | meter card | Progress bar | `width 0%→N%, 1.1s, delay .25`, margin −40px | CONFIRMED |
| 7 | footer | Fixed "reveal" panel under the page (`--reveal-h: clamp(380px,56vh,600px)` spacer) with `Dithering shape dots type random size 9 colorFront #1664CC mix-blend screen`, mounted only when `scrollY+innerHeight ≥ scrollHeight−200` | CONFIRMED |
| 8 | hero composer | Model listbox | menu `opacity 0→1, y 6→0, .16s`; Escape / outside-click closes | CONFIRMED |
| 9 | nav CTA | "Start building" opens invite-code / waitlist modal (posts to `/api/waitlist`) | NOT cloned (backend) |

## Assets
| Asset | Tier | Notes |
|---|---|---|
| `/hero-bg.jpg` (672 KB), `/hero-figure.png` (2.4 MB), `/footer-exhibit.png`, `/plinth-mark.png`, `/icon.png` | REAL | served locally at source resolution (original uses next/image resizes) |
| 17 woff2 (Inter / Geist Mono / Instrument Serif) | REAL | open licenses (SIL OFL) |
| grain SVG | inline data URI | — |

## Build (fidelity fast path)
Vite + React (React only for the three shader mounts). Captured post-hydration HTML + the site's single Tailwind CSS + local asset paths; behaviors rebuilt in `behaviors.ts` using framer's final inline state (`opacity: 1; transform: none;`) as the reveal hook. GPU track = same library, same props → **SOURCE** fidelity. `?shaders=1|0` overrides the gate for testing.

## QA
Pixel diff vs original, GPU canvases masked: **@1440 mean 0.00% / worst 0.00%**, @768 0.01% / 0.12%, @390 0.01% / 0.10%. Section heights identical at all three widths.

## Known gaps
Waitlist modal + `/api/waitlist` not cloned; other routes (`/marketplace`, `/docs`, `/pricing`, `/newsletter`, `/publish`) not captured; PostHog omitted.
