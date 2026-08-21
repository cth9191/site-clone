```
 ███████╗██╗████████╗███████╗     ██████╗██╗      ██████╗ ███╗   ██╗███████╗
 ██╔════╝██║╚══██╔══╝██╔════╝    ██╔════╝██║     ██╔═══██╗████╗  ██║██╔════╝
 ███████╗██║   ██║   █████╗      ██║     ██║     ██║   ██║██╔██╗ ██║█████╗
 ╚════██║██║   ██║   ██╔══╝      ██║     ██║     ██║   ██║██║╚██╗██║██╔══╝
 ███████║██║   ██║   ███████╗    ╚██████╗███████╗╚██████╔╝██║ ╚████║███████╗
 ╚══════╝╚═╝   ╚═╝   ╚══════╝     ╚═════╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝
```

**Point Claude Code at a URL. Get back a teardown doc and a verified, near pixel-identical rebuild.**

`/clone-site https://some.site/` → measures the live page in a real browser, explains every effect with its exact runtime parameters, rebuilds it, then proves the result with an automated pixel diff against the original.

```
@1440: orig 8791px clone 8791px | mean 0.00% worst 0.00%
@768:  orig 10326px clone 10326px | mean 0.01% worst 0.12%
@390:  orig 12312px clone 12312px | mean 0.01% worst 0.10%
```
<sub>Real output from the [plinthai.xyz](examples/plinthai-teardown.md) run — DOM track diffed against the live site with GPU canvases masked.</sub>

---

## What's in the box

One repo, one install, **one command**. `/clone-site <url>` runs the whole pipeline: it clones, verifies, then asks *"make it yours now?"* and hands into `/remix-site`. Under the hood that is four skills — two of them (`dom-clone`, `shader-extract`) are internal tracks clone-site calls for you and are hidden from the `/` menu; `remix-site` is visible so you can re-enter it on an existing clone later.

```
 /clone-site <url>  ──▶  verified clone  ──▶  /remix-site <dir>  ──▶  your site
      │                                            │
      ├─ dom-clone       (DOM/CSS track)           ├─ tokenize → re-skin → 3 directions → tweak panel
      └─ shader-extract  (WebGL/canvas track)      └─ reads the clone's TEARDOWN / tokens / motion / site
```

| Skill | Command | What it does | Needs |
|---|---|---|---|
| **clone-site** | `/clone-site <url> [--analyze-only]` | The coordinator. Probes the live page, writes `TEARDOWN.md`, routes DOM vs GPU, builds, runs the pixel diff. | `dom-clone`, `shader-extract`, a browser tool |
| **dom-clone** *(internal)* | — | The DOM/CSS track: exact computed values → specs → components. Called by clone-site; hidden from the menu. |\|dir>` | The DOM/CSS track: exact computed values → specs → components. Usually driven by clone-site; usable alone for pages with no GPU effects. | a browser tool |
| **shader-extract** *(internal)* | — | The GPU track\|surface>` | The GPU track: evidence-gated capture/replay of one WebGL/WebGPU/canvas surface. Wraps the MIT [web-shader-extractor](https://github.com/lixiaolin94/skills). | a browser tool |
| **remix-site** | `/remix-site <clone-dir> [--phase …]` | The step after a verified clone: tokenize → re-skin (your brand/copy/assets) → three directions (asks *subtle/medium/big* + anchors) → live gallery → tweak panel. | a clone-site output dir (or any Vite site + one probe run) |

**Install everything** (recommended — clone-site won't run without its two sub-skills):

```bash
git clone https://github.com/cth9191/site-clone.git
cp -r site-clone/skills/* ~/.claude/skills/
```

**Install selectively:** copy only the folders you want. Minimum viable sets:
- Teardowns only (`--analyze-only`): `clone-site` + `dom-clone` + `shader-extract`
- Remix a site you already have: `remix-site` + `clone-site` (remix borrows clone-site's probe scripts when there's no teardown)

Restart Claude Code (or start a new session) after copying; the skills show up under `/`.

**Typical session:**

```
/clone-site https://www.example.com/          # ~10–45 min → output/www.example.com/ + TEARDOWN.md + QA report
# …clone-site ends with "Make it yours now?" — say yes and remix-site takes over, or later:
/remix-site output/www.example.com/           # stops 3× for your input: brand brief → direction pick → panel
```

Each skill also triggers on plain language (*"how did they build this?"*, *"make this mine"*, *"give me three versions"*), so you rarely need the slash form.

## Why this exists

Most "clone this website" attempts fail the same two ways:

1. **They read source instead of measuring the page.** A minified bundle is the *compiled* form of a site. Class names are hashed, GSAP configs live in closures, CSS is atomic. Paraphrasing that through an LLM gives you "uses scroll animations" when you needed `scrub: 1, start: "top 82%", end: "center center"`. The running page has all of it — `ScrollTrigger.getAll()`, `document.getAnimations()`, `getComputedStyle()` — you just have to ask.
2. **Nobody checks the result.** A rebuild that "looks right" in a screenshot is usually 2–5% off in ways that read as *AI slop*: spacing drift, wrong weights, approximated colors. Without a measure → build → diff → fix loop, 1:1 is a vibe, not a fact.

This skill is built around fixing both. Its spine is a simple observation: a modern designy site is **two different materials welded together** — DOM/CSS that `getComputedStyle()` can reconstruct perfectly, and GPU canvases (WebGL, shaders, 3D) that it's completely blind to. Getting a clone right is mostly getting the **routing** right: sending each surface to the tool that can actually see it.

## What you get

```
output/<hostname>/
├── TEARDOWN.md          ← human-readable blueprint: stack, measured design system,
│                          every effect + how it works, assets, build plan
├── surface-map.json     ← every visual region tagged DOM / WEBGL / CANVAS2D / VIDEO
├── motion.json          ← exact animation params from the live runtime
├── tokens-1440.json     ← frequency-ranked palette, type scale, spacing, fonts…
├── ROUTING.md           ← which track owns which section
├── captures/            ← per-section reference screenshots
├── site/                ← the rebuilt project (Vite / Next, per target)
└── qa/                  ← pixel-diff report + diff images per breakpoint
```

Every claim in `TEARDOWN.md` carries an evidence tag — **CONFIRMED** (read from a runtime object or computed style), **OBSERVED** (seen during the scroll/hover sweep), or **INFERRED** (guessed from markup). Nothing gets upgraded. A clone built on CONFIRMED values mostly needs a diff pass to catch typos.

Pass `--analyze-only` and it stops after the teardown — a couple of minutes for "how did they build this?"

## How it works

```
 ┌─────────────┐   ┌──────────────┐   ┌───────────────┐   ┌───────────┐   ┌────────────┐
 │ 1. RECON    │ → │ 2. SCAFFOLD  │ → │ 3. TWO TRACKS │ → │ 4. COMPOSE│ → │ 5. PIXEL QA│
 │ probes +    │   │ lightest     │   │ DOM ‖ GPU     │   │ mount GPU │   │ diff vs    │
 │ sweep →     │   │ substrate    │   │ in parallel   │   │ into DOM  │   │ original,  │
 │ TEARDOWN.md │   │ that fits    │   │               │   │ shell     │   │ 3 widths   │
 └─────────────┘   └──────────────┘   └───────────────┘   └───────────┘   └────────────┘
```

**1. Recon** — three probe scripts run inside the live page:

| Script | What it recovers |
|---|---|
| `surface-map.js` | Every canvas classified by the context it *actually* requested (instrumented `getContext` preload), videos, animated SVGs, smooth-scroll fingerprints → a routing plan |
| `motion-probe.js` | Every GSAP tween + `ScrollTrigger.getAll()` (trigger / pin / start / end / scrub / vars), WAAPI animations with keyframes, CSS `@keyframes` + scroll-timelines, Lenis options, Swiper/Splide params, SplitText wrappers, transition signatures, IntersectionObservers + input listeners |
| `tokens-probe.js` | Frequency-ranked palette, type scale, fonts + `@font-face` sources, spacing rhythm, radii, shadows, z-layers, breakpoints, `:root` custom props, section map, fixed chrome |

Then a scroll/hover/click sweep with screenshots, and — only for effects still unexplained — a targeted grep of the downloaded bundle. Never a summarized fetch.

**2–3. Build** — two strategies for the DOM track:

- **Fidelity fast path** (default when the site ships scope-attributed CSS — Vue `data-v-*`, CSS Modules, Tailwind, styled-components): captured post-hydration HTML + the site's own stylesheets + rewritten asset paths = a byte-identical DOM layer. Only *behaviors* get rewritten, from `motion.json`. This is how the 0.00% above happened.
- **Component rebuild** (`dom-clone`): per-section specs with exact computed values → clean components, for when you want a codebase to keep developing.

GPU surfaces go to **`shader-extract`** (evidence-gated capture/replay via Spector.js / WebGPU Inspector) — *unless* the bundle fingerprints a known library (Paper Shaders, Unicorn Studio, Spline, Rive, Lottie, R3F), in which case the skill installs the same package and passes the same props. That's SOURCE fidelity for free.

**5. QA** — Playwright + pixelmatch, original vs clone at 1440 / 768 / 390, GPU canvases masked, diffed per viewport slice so the report says *where* it's wrong (`y=19800 16%`), not just that it is. Section heights are compared first; a zero delta down the list localizes any remaining diff to behavior, not layout.

## Install

See **What's in the box** above — one `cp -r`, all four skills. Requirements: a browser you can drive from the session (the [`playwright-cli`](https://github.com/microsoft/playwright-cli) skill is recommended; any Playwright / Chrome MCP works with fewer features), Node ≥ 18 for the QA harness, and the Higgsfield MCP only if you want remix-site to generate replacement assets.

## Use

```
/clone-site https://www.example.com/
/clone-site https://www.example.com/ --analyze-only
/site-teardown https://www.example.com/          # alias
```

Or just ask: *"how did they build this?"*, *"tear down this site"*, *"clone this but the hero is some WebGL thing"*.

## Then make it yours: `/remix-site`

A clone is a *measured design system plus a proven structure* — and copying someone's site is not the point. `remix-site` is the step after the clone is verified. It consumes the clone's `TEARDOWN.md`, `tokens-*.json`, `motion.json`, and `site/` (never re-probes) and runs three phases that each stop for your call:

```
 ┌────────────────┐   ┌────────────────┐   ┌──────────────────┐   ┌─────────────────┐
 │ 0. TOKENIZE    │ → │ 1. RE-SKIN     │ → │ 2. 3 DIRECTIONS  │ → │ 3. TWEAK PANEL  │
 │ literals →     │   │ copy · brand · │   │ overrides files, │   │ 10–15 live      │
 │ var(--rx-*)    │   │ assets · fonts │   │ side-by-side     │   │ knobs, permalink│
 │ 0.000% diff    │   │ → template     │   │ sheet → you pick │   │ on the pick     │
 └────────────────┘   └────────────────┘   └──────────────────┘   └─────────────────┘
```

- **Tokenize** — `tokenize-css.js` rewrites the clone's stylesheet so every measured value flows through `var(--rx-<role>, <original>)` (declarations only, never selectors — Tailwind arbitrary-value classes taught us that). Verified at **0.000 % round-trip diff**, so every knob is free.
- **Re-skin** — the mandatory phase. Copy keeps the original's *shape* (headline lengths ±20 %, card counts), brand goes into the slots, decorative assets are regenerated from the original's *composition* (never identity — logos, people, product shots get replaced), licensed fonts swap for metric-compatible open pairs, analytics and endpoints are scrubbed.
- **Directions** — asks *subtle / medium / big* and *any aesthetics in mind?* first, then three, not five. Each is a data-only overrides file (tokens + motion + shader props + assets) that differs from the others on ≥3 forks: palette mood, type pairing, hero treatment, density, motion personality, surface. Rendered **live side by side** on a `/directions.html` gallery page (iframes of the dev server — real shaders, real motion, synced scroll, click-through fullscreen, a *pick* button); you pick.
- **Tweak panel** — `tweak-panel.js` on the winner: grouped live controls for CSS vars, motion params, and shader props, state serialized into `#rx=` so every URL is a permalink, *Copy JSON* exports a new direction. Dev-only, toggled with the backtick key.

```
/remix-site output/www.example.com/
/remix-site output/www.example.com/ --phase panel
```

## Case studies

| Site | Stack found | GPU | DOM diff @1440 | Notes |
|---|---|---|---|---|
| [plinthai.xyz](examples/plinthai-teardown.md) | Next.js + Tailwind + framer-motion | Paper Shaders ×3 kinds | **0.00%** | Bundle was readable; shader props copied verbatim → SOURCE fidelity |
| [fin.com](examples/fin-teardown.md) | Nuxt + Lenis + GSAP + CSS scroll-timelines | TresJS globe + Canvas2D hash grid | **0.02%** | Globe rebuilt approximately from confirmed uniforms; hash grid ported 1:1 from source |

Both teardowns are in [`examples/`](examples/) as samples of the output, along with the [QA harness](examples/qa-diff.mjs).

## What it can and can't do

**Pixel-identical, verified:** layout, type, color, spacing, images, CSS animations, scroll-driven CSS, hover states. Strongest on framework sites with scoped/utility CSS — i.e. most modern marketing sites.

**Close, honestly labeled:** custom WebGL/shader effects. Textures, uniforms, camera, and scroll states come out of the runtime; the rebuild reads as the same effect but isn't the same shader unless `shader-extract` captures the frame. The report says SOURCE / PARTIAL / approximate and never upgrades.

**Rebuilt by observation:** JS state machines (theme flips, content swaps). Thresholds are sampled at fine grain around each transition before implementing — a flip is often binary where you'd assume scrubbed, and the trigger is often a *different* element than the one that changes.

**Breaks on:** bot walls / Cloudflare challenges, login-gated pages, per-user server content, and anything whose interesting part is a backend — this clones the *page*, not the app.

## Lessons baked in (so you don't relearn them)

- Init scripts are function-scoped in Playwright — probes must be exported onto `window` (`build-bundle.js` does this).
- `reducedMotion: 'reduce'` in the QA context changes the *original's* JS behavior → phantom diffs. Freeze motion with injected CSS instead.
- `waitUntil: 'networkidle'` hangs against a Vite dev server (HMR socket).
- Scroll triggers computed at load go stale when lazy images shift layout; refresh on document-height change.
- SPA frameworks only render the *active* state — inactive tab panels don't exist in the capture. Click through and snapshot each.
- Check for CSS-variable drivers (`color-mix(... var(--progress))`) before assuming a class toggle does anything.
- When the original renders an effect wrapper conditionally, your mount element must be visually inert, or the fallback shows a blank box.

Full detail in [`skills/clone-site/references/`](skills/clone-site/references/).

## Guardrails

Clone for migration, recovery of your own lost source, or learning how a build works. Don't pass off someone's brand or design as your own, and don't use this for phishing or impersonation — if a target looks like it exists to be impersonated (a bank login, a wallet, a checkout), the skill stops and asks. Logos, brand assets, copy, photos of people, and **licensed fonts** (the clone will happily download them for local study; that is not a license to redistribute) belong to their owners.

## Credits

`shader-extract` wraps the MIT-licensed [web-shader-extractor](https://github.com/lixiaolin94/skills) by lixiaolin94 — see [`ATTRIBUTION.md`](skills/shader-extract/ATTRIBUTION.md). The teardown template and common-reveals cheat sheet grew out of a community `site-teardown` skill whose analysis half was folded in here; its WebFetch-based extraction was replaced with runtime probes.

## License

MIT for everything in this repo except the vendored engine, which carries its own MIT license upstream.
