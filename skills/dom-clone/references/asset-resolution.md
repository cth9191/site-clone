# Asset resolution ladder

A clone needs the page's images, videos, textures, and icons. Some you can just
download; some are blocked (cross-origin, DRM, auth-walled); some you *shouldn't*
copy at all (a brand's logo in a learning clone). This ladder decides, per asset,
how to resolve it — and keeps the result honest about which tier was used.

The governing rule: **a faithful clone wants the REAL asset.** Generating a
lookalike is a fallback, never the default, and is gated by what the asset *is*.
A generated hero-background texture raises completeness; a generated logo lowers
fidelity AND copies brand identity. So gate by role, not by convenience.

## The four tiers (label every asset with the one used)

1. **REAL** — download the actual file to the project (`<img src>`, `<video>`,
   background-image, source-set). Default. Highest fidelity. Always try first.
2. **RECONSTRUCT** — rebuild it yourself when it's cheaply rebuildable: an inline
   SVG you can extract, a CSS gradient, a canvas/WebGL effect (hand to
   shader-extract). Faithful and license-clean.
3. **GENERATE** — synthesize a substitute via the Higgsfield MCP. Only when 1 and
   2 both fail or are disallowed. Label the asset `GENERATED` and log it in
   `known-gaps.md`. Never let a generated asset be reported as REAL.
4. **PLACEHOLDER** — a solid block, blurhash, or captured poster frame, when
   generation isn't wanted or the asset is identity/content (below).

## Gate by role — the decision that matters

**Decorative / demo assets → GENERATE is appropriate** when REAL/RECONSTRUCT fail:
- hero or section **background video/image** that's blocked or heavy
- ambient **textures**, noise maps, gradient meshes, particle sprites
- a **poster frame** for a shader/canvas that couldn't be reconstructed
- filler **product/UI mockups** in a demo where exact content doesn't matter

**Identity / content assets → NEVER generate. REAL-or-PLACEHOLDER only:**
- **logos**, wordmarks, brand icons
- real **UI screenshots** / product imagery that carries meaning
- **photos of real people**, testimonials, author avatars
- anything where a generated substitute would misrepresent the original

Generating identity assets makes the clone *less* faithful and copies brand
identity — both wrong. If you can't get the real one, use a neutral placeholder
and note it.

## Special case: composited live-UI mocks (the download trap)

The most common asset mistake on modern product sites: a hero or feature visual
that *looks* like one image is actually a **live UI composited in HTML over a
static background image** — a fake app window, code panel, or dashboard layered
on a painterly/gradient wallpaper. If you naively download the background image
(tier 1 REAL), you get an empty wallpaper with none of the UI, because the UI was
never in that file. Worse, sites often **reuse the same wallpaper** across several
feature blocks, so an nth-image match lands on the wrong block's background.

How to handle it:

- **Recognize it:** the region contains real DOM (text nodes, buttons, code) on
  top of an `<img>`/background whose natural size ≈ the whole region and whose
  content is just texture. If getComputedStyle sees real child elements over an
  image, it's composited — not a flat asset.
- **Capture, don't download:** screenshot the composited region as a whole
  (Playwright `clip` at the region's box) → tier is CAPTURED, not REAL. This is
  the faithful static representation of a live composition.
- **Reused-wallpaper guard:** don't trust "the nth `<img>`" to identify the
  block — capture by the region's own bounding box at the scroll offset where it's
  fully visible (see the scroll-pinned note in `interaction-fingerprints.md`).

Label these CAPTURED in the report so it's clear the pixels are a snapshot of a
live composition, not a downloaded source asset.

## Calling Higgsfield (tier 3)

Match the tool to the asset. Follow the creative-direction rule: for anything
non-trivial, propose 2–3 directions and get a pick before burning credits.

- **Image** (texture, background, mockup) → `generate_image` (GPT Image 2 for
  design/text-in-image; Nano Banana for reference-driven). Feed it the surface's
  role, palette (from design tokens), and aspect/size from the surface map.
- **Video** (hero background loop) → `generate_video` (Seedance for generic
  motion). Match duration/aspect/muted-loop to the original `<video>` element.
- **Import a specific asset you found but can't hotlink** → `media_import_url`.
- **Cutout / transparent** → `remove_background`.

Write generated assets into the project's asset dir with a filename tagged
`-generated` and record in `known-gaps.md`: original URL (if any), why REAL/
RECONSTRUCT failed, the prompt used, and the tier. This keeps the clone auditable
and the fidelity claim honest.

## Reporting

In the completion report, break assets down by tier: N REAL, N RECONSTRUCT, N
GENERATED, N PLACEHOLDER. A clone that's 90% REAL with 3 clearly-labeled
GENERATED decorative textures is honest and complete. A clone silently padded
with generated brand assets is neither.
