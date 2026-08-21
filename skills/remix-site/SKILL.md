---
name: remix-site
description: >-
  Turn a cloned (or any measured) website into YOUR site: re-skin it with your
  brand, copy, and assets; generate three deliberately different design
  directions as token/motion/shader overrides and render them side by side;
  then put a live tweak panel on the direction you pick. This is the step after
  /clone-site — it consumes the clone's TEARDOWN.md, tokens-*.json, motion.json,
  and site/ and never re-probes. Use when the user says "/remix", "remix this
  clone", "make this mine", "re-skin this", "give me three versions of this
  site", "variations of this design", "add a tweak panel", "let me tune the
  colors/spacing/motion", or has just approved a clone and wants to move from
  copying to owning. NOT for cloning (use /clone-site) and NOT for building a
  site from scratch.
argument-hint: "<clone-dir or site-dir> [--phase reskin|directions|panel]"
user-invocable: true
---

# Remix Site

A clone is a **measured design system plus a proven structure**. The teardown
already enumerated every knob — palette, type scale, spacing rhythm, motion
params, shader props, section order. Remixing means changing what flows
through those knobs, in three phases that each **stop for the user's call**
(unlike `/clone-site`, which runs autonomously):

1. **Re-skin** — swap the three things that make it *theirs*: copy, brand, hero
   assets. Output: a de-branded template. Non-negotiable and first.
2. **Directions** — three deliberately different combinations of the big forks
   (palette mood × type pairing × hero treatment × motion personality), rendered
   side by side. The user picks one.
3. **Tweak panel** — the chosen direction's 10–15 real knobs made live in the
   page, with permalink state. Not 80 sliders; the ones they'll keep turning.

`--phase` runs a single phase (e.g. a second re-skin for another client, or a
panel on a site that never came from the cloner).

## Inputs (the clone-site contract)

Resolve `$ARGUMENTS` to a directory and look for:

| File | Used for |
|---|---|
| `TEARDOWN.md` | stack, effects table, assets table, known gaps |
| `tokens-*.json` | the measured design system — the knob list |
| `motion.json` | exact animation params — the motion knobs |
| `surface-map.json` | which regions are GPU (shader knobs live here) |
| `site/` | the rebuilt project (Vite/Next) |
| `assets/` or `site/public/assets/` | original assets, tiered |

If only `site/` exists (not a clone), run `tokens-probe.js` and
`motion-probe.js` from `../clone-site/scripts/` against the dev server once to
produce the JSON — then proceed. Never re-probe when the JSON is present.

## Phase 0 — Tokenize (mechanical, do it before anything)

The clone's CSS is full of literal values (`#1f3bff`, `32.04px`). Nothing can be
varied until those literals become variables. Run:

```bash
node scripts/tokenize-css.js <site>/src/<site>.css <tokens-1440.json> <site>/src
```

It rewrites the stylesheet so every measured token value goes through
`var(--rx-<role>, <original>)` and writes `remix-tokens.css` (the defaults). If
the site already exposes its own `--vars` (Nuxt/Vue sites often do), the script
aliases those instead of inventing new names — keep the site's vocabulary.

Route motion through a config too: the clone's behavior JS should read from
`window.__remix.motion` (seeded from `motion.json` → `remix-motion.js`), and
shader mounts from `window.__remix.shaders`. If the builder hard-coded them,
hoist now. This is the one code change remix makes to the clone — everything
after is data.

Verify the site still renders identically (`qa/diff.mjs` against itself before
/after: must be 0%). **Show the user the knob list** (`remix/knobs.json`) and
stop: "These are the N things we can turn. Re-skin next?"

## Phase 1 — Re-skin

Ask for, in one batch: **brand** (name, logo file or "generate a placeholder
mark", primary + accent colors or "derive from logo"), **copy** (a doc/URL to
pull from, bullet points to expand, or "placeholder in their structure"), and
**hero/section assets** (files, or "generate").

Then:
- **Copy** — replace every text node section by section, keeping the
  original's *shape* (eyebrow / headline / sub / CTA / card counts). Headline
  lengths matter for layout: match ±20% characters or the hero reflows. Note
  any overflow in the report.
- **Brand** — logo into the header/footer slots; primary/accent into
  `remix-tokens.css`; favicon/OG.
- **Assets** — resolve through `../dom-clone/references/asset-resolution.md`
  with the roles flipped: the original's REAL assets are now the thing to
  *remove*. Decorative (hero background, textures, ambient imagery) →
  GENERATE via Higgsfield using the original's composition as the brief (aspect,
  subject placement, mood) — see `references/reskin.md` for the brief
  template. Identity (their logo, their people, their product shots) → must be
  replaced, never kept. Fonts: if the original's are commercially licensed,
  swap to an open pairing with matching metrics (`references/reskin.md` has
  the lookup); if open, keep.
- **Remove** analytics, their API endpoints, their links.

Render, screenshot the hero + two sections, **stop**: "This is the template
with your brand. Directions next?"

## Phase 2 — Three directions

**Ask first, one batch, before touching anything** (this is the question that
decides whether the directions are coats of paint or actually different sites):

1. **Amplitude** — *subtle* / *medium* / *big*?
   | | moves | layer |
   |---|---|---|
   | subtle | palette, accent, motion timing, shader colors | `overrides.json` only |
   | medium | + surface (radius/border/shadow), density (spacing ×), type scale + weights, grain | + `patch.css` |
   | big | + hero treatment (photo → type-only / GPU-led / engraving), layout (grid ↔ editorial ↔ bento), section order, nav style, own hero asset per direction | + `patch.js` + generated assets |
   If unsure, recommend **medium** — subtle reads as "same site, different coat"
   side by side; big costs generations.
2. **Anchors** — "any aesthetics in mind?" *none* / *describe it* / *reference
   sites or images* / *pull from my taste library* (`/taste-vault`). With none:
   nearest-legit / opposite / wildcard from `references/directions.md`. With
   anchors: one direction per anchor, built *toward* it, and say which fork each
   anchor maps to so the user sees the translation.

Not five. Five converge; three deliberately different forks give a real choice.
Each direction is **data + an optional patch layer**, scoped to
`:root[data-rx="<slug>"]` so directions never collide:

```
remix/directions/<slug>.json
{ "name": "...", "thesis": "one line",
  "tokens": { "--rx-accent": "#…", "--rx-font-display": "…", "--rx-space-unit": "…" },
  "motion": { "reveal": { "y": 22, "duration": 0.7, "ease": [.16,1,.3,1] }, "stagger": 0.08 },
  "shaders": { "hero": { "colorFront": "#…", "intensity": 0.5 } },
  "assets": { "hero-bg": "generated/<slug>-hero.jpg" } }
remix/directions/<slug>.patch.css   (medium+)  surface / density / type scale under :root[data-rx="<slug>"]
remix/directions/<slug>.patch.js    (big)      structural: hero variant, section order, layout classes
```

`apply-overrides.js` picks up `<slug>.patch.css` / `.patch.js` next to the
JSON automatically. Patches must be **additive and scoped** — never edit the
base HTML/CSS for a direction, or the other two break.

Derive the three from the original's *axes*, not from taste alone — see
`references/directions.md` for the fork table (palette mood, type pairing, hero
treatment, density, motion personality) and the rule that each direction must
differ on **at least three** forks. If the user has a taste library
(`/taste-vault` or reference images), pull the directions from there. Generate
per-direction hero assets only for the decorative layer.

Apply each with `node scripts/apply-overrides.js <site> remix/directions/<slug>.json`
(writes `remix-tokens.<slug>.css` + `remix-motion.<slug>.js`; the site loads
the active set via `?rx=<slug>`). Then `node scripts/gallery.js <site>` writes
`<site>/directions.html`: all directions **live side by side in iframes** (real
shaders + motion), synced scroll, click-a-name fullscreen, and a *pick* button
that stores the choice in `localStorage.rx-pick`. Open it in the user's browser
(this is the deliverable — not a static contact sheet), and also render
`remix/directions.jpg` for the report. **Stop** with the URL and one line per
direction: thesis + what changed. The user picks (read `rx-pick` or ask).

## Phase 3 — Tweak panel

On the pick only. Choose **10–15 knobs** from `knobs.json` — the ones that
matter for *this* direction (accent, display font size base, section spacing
unit, radius, reveal distance/duration/ease, stagger, shader intensity/colors,
hero gradient angle, grain opacity). Write `remix/panel.json`
(`references/tweak-panel.md` has the schema: type, range, step, default, CSS
var or motion/shader path) and inject `scripts/tweak-panel.js` into the site.

The panel: fixed, collapsible, grouped (Color / Type / Space / Motion / GPU),
writes CSS vars live, pokes `window.__remix` for motion/shader knobs and
re-renders the affected mount, serializes state into `#rx=` so a URL is a
permalink, and has Copy JSON / Reset / Export-as-direction. Keyboard: `` ` ``
toggles it. It is **dev-only** — stripped from the production build.

Verify: every knob visibly changes the page, permalink round-trips, reset
returns to the direction's defaults. Screenshot with the panel open.

## Completion report

- Template: what was replaced (copy sections, brand slots, assets by tier —
  GENERATED assets listed), fonts kept/swapped and why
- Directions: the contact sheet + the three theses + which was picked
- Panel: knob list, permalink example
- Still theirs: anything structural you kept verbatim that the user should
  know about (section order, interaction patterns) — a remix is legitimate
  because the *expression* is new; say plainly what the skeleton still owes
  to the original

## Guardrails

Phase 1 is mandatory before anything ships: no remix leaves with the
original's logo, copy, people, product imagery, or licensed fonts. If the user
asks to skip re-skinning and just "change the colors", say why that's still
their site and do Phase 1 first.
