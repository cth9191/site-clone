# Directions — three forks, not five shades

A "direction" is an overrides file (tokens + motion + shaders + assets). Three
is the number: two is a coin flip, five converges into blends. Each direction
must differ from the others on **at least three** of the forks below, and the
set should span the axis the user cares about (ask one question if unclear:
"louder or quieter than the original?").

## The forks

| Fork | What changes | Knobs it touches |
|---|---|---|
| **Palette mood** | dark / light / tinted-neutral / saturated | `--rx-color-bg`, `--rx-color-text`, accent, surface tints |
| **Type pairing** | grotesk-only / serif display + grotesk text / mono-led / expressive display | `--rx-font-1..n`, display size + tracking |
| **Hero treatment** | photo / illustration / generated art / pure type / GPU-led | hero asset key, shader props, overlay gradient |
| **Density** | airy (×1.25 spacing) / original / compact (×0.8) | `--rx-space-*`, max-widths, radii |
| **Motion personality** | still (reveals only) / original / springy (shorter, overshoot ease) / cinematic (longer, bigger travel) | `motion.reveal.{y,duration,ease}`, stagger, shader speed |
| **Surface** | flat / bordered / elevated (shadows) / glass | radius, shadow, border color, backdrop |

## Deriving three from the original

Read the original's position on each fork from `TEARDOWN.md`. Then:

1. **Nearest-legit** — keeps the original's strongest fork (the thing that
   made the user pick this site) and flips three others. Safe pick.
2. **Opposite** — flips the original's defining fork (dark→light, serif→mono,
   photo→type). Shows the skeleton survives a different skin.
3. **Wildcard** — pulled from the user's taste library (`/taste-vault`,
   reference images, a named site) rather than from the original. The one
   that might be *better* than the source.

Name each with a two-word slug (`editorial-quiet`, `night-signal`,
`paper-brutal`) and a one-line thesis. The thesis is the test: if you can't
say why a viewer would *feel* different, it's a shade, not a direction.

## Rendering the contact sheet

Screenshot each direction's hero + one content section at 1440, compose
three columns with slug + thesis captions → `remix/directions.png`. Present
only that plus three lines. Don't pre-argue for one; the user's reaction to
the sheet is the data.

## Overrides file checklist

- tokens: only keys that change (the base supplies the rest)
- motion: full objects for what changes (`reveal`, `stagger`, `nav`) so the
  behaviors read one shape
- shaders: per-mount props; keep the library, change the props
- assets: per key; generated files under `remix/generated/<slug>-*.ext`
- `thesis` filled in
