---
name: clone-site
description: >-
  Reverse-engineer and rebuild any website — including its WebGL/WebGPU/canvas
  shader effects — into a clean local codebase. Use this whenever the user wants
  to clone, replicate, rebuild, reverse-engineer, or copy a website or landing
  page, especially designy sites with animated/shader/3D hero backgrounds. This
  is the top-level coordinator: it does recon, classifies every page surface as
  DOM vs GPU-rendered, routes plain layout to the dom-clone sub-skill and shader
  surfaces to the shader-extract sub-skill, scaffolds a build target on demand,
  composites the two tracks, and runs automated visual QA. It also produces a
  human-readable TEARDOWN.md (stack, measured design system, every effect with
  its exact runtime params and how it works) — pass --analyze-only to stop there.
  Trigger on "clone this site", "rebuild this page", "make a copy of this
  website", "reverse-engineer this landing page", "clone this but the background
  is some WebGL thing", any pixel-accurate site reproduction, AND on analysis
  asks: "how did they build this", "tear down this site", "site teardown",
  "break down this page", "what stack/animations does this site use", "how does
  this effect work", "website blueprint", "steal this website's design",
  "/site-teardown". Provide one or more target URLs.
argument-hint: "<url1> [<url2> ...] [--analyze-only]"
user-invocable: true
---

# Clone Site

You are cloning **$ARGUMENTS** into a clean local codebase. Your job is to be
the **general contractor**: survey the whole building, decide which trades do
which parts, hand each trade a precise scope, then assemble and inspect.

The reason this skill exists — and why it is not just "run the DOM cloner" — is
that a modern designy site is really **two different materials welded together**:

- **DOM/CSS material** — text, layout, images, buttons, normal animations. A
  DOM extractor reading `getComputedStyle()` reconstructs this faithfully.
- **GPU material** — WebGL / WebGPU / canvas shader effects (the hero that
  ripples, the 3D blob, the generative gradient). None of it exists in the DOM.
  `getComputedStyle()` sees an empty `<canvas>`. Clone it as HTML and you get a
  dead box where the best part of the site was.

Getting a clone right is mostly getting the **routing** right: sending each
surface to the tool that can actually see it. That routing is this skill's spine.

## Sub-skills you coordinate

You do not reimplement extraction. You dispatch to two sibling skills and stitch
their output together. Read each one's `SKILL.md` before you drive it:

- **`../dom-clone/SKILL.md`** — extracts DOM/CSS/assets/content section by
  section, writes a spec file per component, dispatches parallel builders.
- **`../shader-extract/SKILL.md`** — evidence-gated capture-and-replay of a
  single GPU surface (locks the surface, captures the frame with Spector.js /
  WebGPU Inspector, builds a verified local baseline). Do NOT hand it the whole
  page — hand it one locked canvas surface plus an output directory.

If either sibling is not installed, tell the user which one is missing and stop;
you cannot substitute the DOM track for a GPU surface or vice versa.

## Pre-flight

1. **Browser automation is required.** You need a browser you can drive from
   the session — any of: the `playwright-cli` skill (recommended: it is the
   only path with `addInitScript` preload, which makes surface routing and
   motion capture far more reliable; see `references/playwright-cli-recipes.md`
   for the one-call preload recipe, eval quirks, hidden-state capture, asset
   lists), Playwright MCP, Chrome/Claude-in-Chrome MCP, or a built-in browser
   pane with a JavaScript-eval tool (post-hoc probes + screenshots only, no
   preload). If none can load the target (bot wall, auth), stop and say so —
   this skill cannot clone from a fetch or a screenshot.
   Build the injectable probe bundle with `node scripts/build-bundle.js`, inject
   it, then evaluate `JSON.stringify(surfaceMap())` etc. For a first look use
   `motionSummary()` (small); the full `motionProbe()`/`tokensProbe()` output
   goes to a file — never dump it into the conversation.
2. Parse `$ARGUMENTS` into one or more URLs; validate each and confirm it loads.
   Multiple sites → keep each site's artifacts in its own `output/<hostname>/`.
3. Decide the **output directory** now (default `output/<hostname>/`; never
   build inside a notes vault or another project's source tree). Every
   artifact — surface map, probes, specs, captures, the built project — goes
   under it, not into the conversation.
4. Parse `--analyze-only`. If present, the run ends after Phase 1 with
   `TEARDOWN.md` (+ the probe JSON) as the deliverable. If the user keeps a
   research folder, offer to copy it there with a `## Key Takeaways` section on
   top. Don't ask first — run and report.

## Phase 1 — Recon & Surface Routing (the part that makes this skill worth it)

This runs BEFORE any building. Its product is a **surface map**: a list of every
visual region tagged with what material it's made of and which track owns it.

1. **Instrument, then load.** If your browser tool supports preload scripts,
   inject `scripts/surface-map.js`'s `instrumentGetContext()` as an init script,
   THEN navigate. This records the real context type each canvas requests —
   ground truth for routing. If preload isn't available, navigate normally and
   rely on the post-hoc probe (still reliable for the common case).
2. **Let the page settle** (scroll top→bottom once so lazy canvases initialize),
   then run `surfaceMap()` from `scripts/surface-map.js` in the page context
   (browser MCP evaluate / Playwright `page.evaluate`). Save the JSON to
   `output/<hostname>/surface-map.json`.
3. **Read the routing summary.** For each surface:
   - `WEBGL1 / WEBGL2 / WEBGPU` → **shader-extract track**. This is a GPU effect
     the DOM track literally cannot capture.
   - `CANVAS2D` / `CANVAS_UNKNOWN` → inspect. Many 2D canvases are decorative
     particle fields (shader-extract) but some are charting libs better rebuilt
     from data. Use judgment; default animated fullscreen 2D → shader-extract.
   - `VIDEO` → **dom-clone track**, re-embed the source `<video>`. Do not rebuild
     a looping video as a canvas — that's wasted effort and looks worse.
   - `SVG_ANIMATED` → dom-clone, but preserve the SMIL/CSS animation.
   - everything else (all normal DOM) → **dom-clone track**.
4. **Record the interaction model.** The surface map also fingerprints smooth
   scroll (Lenis / Locomotive) and scroll-timeline CSS. Note these — they change
   how dom-clone must rebuild scroll-driven sections. Confirm by scrolling: does
   content change on its own as you scroll (scroll-driven) or only on click?
5. **Probe the motion runtime** — run `scripts/motion-probe.js` (`motionProbe()`;
   with `instrumentMotion()` preloaded when using playwright-cli) and save to
   `motion.json`. This asks the live libraries for their real params instead of
   reading a minified bundle: every GSAP tween + `ScrollTrigger.getAll()`
   (trigger/pin/start/end/scrub/vars), WAAPI animations with keyframes, CSSOM
   `@keyframes` + scroll-timelines, Lenis options, Swiper/Splide params,
   SplitText wrappers, transition signatures, IO registrations + input listeners
   (instrumented mode). `summary.animationStack` is the one-line answer to "what
   makes this site move".
6. **Probe the design system** — run `scripts/tokens-probe.js` (`tokensProbe()`)
   at 1440, 768, and 390 → `tokens-<w>.json`. Frequency-ranked palette, type
   scale, fonts + `@font-face` src, spacing rhythm, radii, shadows, z-layers,
   breakpoints, `:root` custom props, section list with offsets, fixed chrome.
   These values ARE the design tokens dom-clone writes in its foundation step.
7. **Sweep** — scroll in ~viewport steps taking screenshots; hover the obvious
   interactives; click tabs/accordions. Anything that moves but isn't explained
   by `motion.json` gets tagged OBSERVED. Only now, if a specific effect is
   still unexplained, read its source: take the bundle URL from
   `read_network_requests`, `curl` it to the output dir, and `grep` around the
   selector — never WebFetch a bundle (the summarizer drops exactly the numbers
   you need).
8. **Write the routing plan** to `output/<hostname>/ROUTING.md`: the section
   topology top-to-bottom, each section's track, and for GPU surfaces their
   selector + bounding box + guessed driver (three.js / unicorn-studio / etc.),
   so the composite step knows exactly where each effect sits and at what z-index.
9. **Write `TEARDOWN.md`** per `references/teardown.md` — stack, measured
   design system, effects table, reveals with exact params, assets, build plan.
   Every claim tagged CONFIRMED / OBSERVED / INFERRED. This is the briefing the
   builders get and the whole deliverable of `--analyze-only`. **Stop here if
   `--analyze-only`.**

If the routing summary shows **no GPU surfaces**, this is a pure DOM clone —
proceed with just the dom-clone track and skip the shader-extract phase. Say so.

## Phase 2 — Scaffold the build target (on demand)

Only scaffold once you know what you're building. Choose the lightest substrate
that fits what you found — don't force a heavy framework onto a static page:

- Static/marketing page, GPU effects present → **Vite + vanilla/TS** (the
  shader-extract baselines are framework-free; Vite composites them cleanly).
- App-like, component-heavy, needs routing/SSR → **Next.js + Tailwind** (matches
  the dom-clone builder conventions).
- User specified a stack → honor it.

Scaffold into `output/<hostname>/site/`. Verify it builds empty before adding
anything. Record the choice in `ROUTING.md`. (Rationale: the old template hard-
wired Next.js for every clone; that's overkill for a static shader showcase and
fights the framework-free shader baselines. Pick per target.)

## Phase 3 — Run the two tracks

**Choose the DOM strategy first.** If the target ships scope-attributed CSS
(`data-v-*`, CSS Modules, styled-components hashes, `_ngcontent`) and the user
wants fidelity over a maintainable codebase, take the **fidelity fast path**
(`references/fidelity-fast-path.md`): captured post-hydration HTML + the site's
own stylesheets + rewritten paths, rebuilding only behaviors. Validated at
0.02–0.06% pixel diff in one pass. Otherwise run dom-clone's rebuild. State the
choice in `ROUTING.md`.

**Choose the DOM strategy first.** If the target ships scope-attributed CSS
(, CSS Modules, styled-components hashes, ) and the user
wants fidelity over a maintainable codebase, take the **fidelity fast path**
(): captured post-hydration HTML + the site's
own stylesheets + rewritten paths, rebuilding only behaviors. Validated at
0.02–0.06% pixel diff in one pass. Otherwise run dom-clone's rebuild. State the
choice in .

Run them **concurrently** — they touch different files and don't depend on each
other until composite. But note (from the research): decomposing into many small
builders is a choice for **speed and edit-isolation**, not because a strong model
can't hold the context. With a capable model, prefer **fewer, larger** builder
agents scoped to a whole section over many tiny ones; split only when a section
is genuinely independent (distinct card variants, separate interactive widgets).
Over-splitting adds merge overhead and coordination cost for no fidelity gain.

**DOM track:** Follow `../dom-clone/SKILL.md`. Feed it the section topology from
`ROUTING.md`, `TEARDOWN.md`, and the probe JSON (`tokens-*.json` seeds the
design tokens verbatim; `motion.json` gives each section's interaction model and
exact animation params — builders reproduce those numbers, not approximations)
plus the output dir. It produces the page shell, styled sections,
downloaded assets, and leaves **placeholder mounts** where GPU surfaces belong
(a positioned empty container with the right id/size/z-index from the surface
map). It must not try to rebuild the effect itself.

**Assets you can't obtain or rebuild:** some assets are cross-origin/blocked, or
are brand identity you shouldn't copy into a learning clone. Resolve every asset
through the ladder in `../dom-clone/references/asset-resolution.md` — REAL first,
then reconstruct, then GENERATE a decorative substitute via the Higgsfield MCP
(never for logos/brand/identity), then placeholder — and carry the tier labels
into the report. This is optional: if Higgsfield isn't connected, tier 3 degrades
to placeholder. Never let a generated asset be reported as the real one.

**GPU track:** For each GPU surface, follow `../shader-extract/SKILL.md` once,
handing it: the locked surface selector, its bounding box, the guessed driver,
and an output dir `output/<hostname>/effects/<surface-id>/`. It returns a
self-contained, verified effect module (WebGL/WebGPU replay) that renders into a
canvas you can mount.

## Phase 4 — Composite

Wire the GPU effect modules into the DOM shell's placeholder mounts. See
`references/compositing.md` for the mount contract (sizing, DPR, z-index,
pointer-events, teardown, reduced-motion). The composite is where most "looks
wrong" bugs actually live — an effect that renders fine in isolation can sit at
the wrong z-index, block clicks, or ignore DPR once mounted. Verify each mount
in the live page, not just the isolated baseline.

## Phase 5 — Automated Visual QA (not eyeballing)

Do NOT declare done by looking at a screenshot. Run a real pixel diff — but
diff the two materials differently, because GPU effects are **nondeterministic**
(they animate; two screenshots never match pixel-for-pixel):

- **DOM regions** → Playwright `toHaveScreenshot()` (pixelmatch under the hood),
  original vs clone at 1440 / 768 / 390. Tune `maxDiffPixelRatio` / `threshold`
  rather than demanding zero diff (anti-aliasing alone causes false diffs).
- **GPU regions** → **mask them** in the DOM diff (Playwright `mask:` option) so
  their animation doesn't swamp the result, and verify them separately: does the
  effect render, animate, and respond to pointer/scroll like the original?

See `references/visual-qa.md` for the exact harness, thresholds, masking, and
the harness gotchas (no reducedMotion, no networkidle against Vite, compare
section heights before pixels, diff per viewport slice).
For every real discrepancy: trace it to the spec (was the value extracted wrong?)
or the build (spec right, builder wrong?) and fix at the source.

## Completion report

- `TEARDOWN.md` path + the one-line stack summary (`motion.json › summary`)
- Section topology and per-section routing (DOM vs which GPU track)
- GPU surfaces found, their drivers, and replay fidelity (SOURCE / PARTIAL /
  approximate — carry shader-extract's honesty labels through; don't upgrade them)
- Build substrate chosen and why
- Visual QA: DOM pixel-diff pass rates per breakpoint + GPU verification notes
- Known gaps (cross-origin canvases that blocked readback, effects only
  approximated, anything the surface map flagged CANVAS_UNKNOWN)

## Handoff

After the completion report, **ask one question and act on it**:

> "Clone verified (diff numbers above). Make it yours now? — re-skin with your
> brand/copy/assets, three design directions, tweak panel on the pick."

- **Yes** → invoke the `remix-site` skill with this run's output directory
  (`Skill: remix-site`, args `<output-dir>`). It consumes TEARDOWN.md,
  tokens-*.json, motion.json, and site/ directly and stops for the user's input
  at its own checkpoints. From the user's side the whole thing is one command.
- **No / later** → end with: `/remix-site <output-dir>` re-enters at any time.

Do not start re-skinning inside clone-site; clone-site ends at a verified copy
and remix-site owns everything after.

## Guardrails

Clone for migration, recovery of your own lost source, or learning how a build
works. Do not use it to pass off someone's brand/design as your own, for
phishing or impersonation, or against sites whose terms forbid reproduction.
Logos, brand assets, and copy belong to their owners. If the target looks like it
exists to be impersonated (a bank login, a wallet, a checkout), stop and ask.
