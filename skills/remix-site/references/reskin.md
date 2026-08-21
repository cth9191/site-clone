# Re-skin — making the template yours

The order matters: **copy → brand → assets → fonts → scrub**. Copy first because
headline length drives layout; everything after is fitting into that.

## Copy: keep the shape, change the words

Walk `TEARDOWN.md`'s section list top to bottom. For each section record its
*shape* before touching it: eyebrow? headline lines? sub length? CTA count?
card count and per-card fields? That shape is the template; the words are not.

- Headlines: match the original's character count ±20 % or the hero reflows.
  If the user's message genuinely needs more, reduce the display size knob
  (`--rx-size-1`) rather than letting it wrap to a third line.
- Cards/lists: same count as the original unless the grid obviously tolerates
  fewer (3→2 breaks most grids; 6→4 usually doesn't). Say so in the report.
- Microcopy (buttons, labels, footer) — replace every string; a leftover
  "Book a demo" or their product name is the #1 tell of a lazy remix.
- Sources, in order of preference: the user's doc/URL → the user's bullets
  expanded in the original's register → honest placeholders in the structure
  (`[Headline about X]`) — never their copy paraphrased.

## Brand

- Logo → header + footer slots + favicon + OG image. If none exists, generate a
  **simple wordmark** in the site's display font as a placeholder and label it
  PLACEHOLDER — never generate a logo and present it as final brand work.
- Colors: primary → whatever role the original's accent played (`--rx-color-n`
  with the highest `uses` among non-neutrals); neutrals usually stay. If the
  user gives only a logo, sample its two dominant colors and propose.

## Assets: flip the ladder

In `/clone-site` the REAL original asset was the goal. Here it's the thing to
remove. Per asset in the teardown's table:

| Original role | Action |
|---|---|
| Decorative (hero background, ambient texture, abstract art, section bg) | GENERATE — brief below |
| Product/UI screenshots | Replace with the user's, or a generated *abstract* stand-in clearly not a product |
| Photos of people, testimonials, avatars | Replace with the user's or remove the block |
| Their logo / brand marks / partner logos | Remove or replace with the user's partners |
| Icons (generic UI) | Keep |
| Textures/noise SVGs generated in code | Keep |

**Generation brief template** (Higgsfield; reuse the original's *composition*,
not its content):

```
Aspect <W:H from the original file>. Subject placement: <where the original
put its focal mass — e.g. "figure right third, empty sky left two-thirds">.
Mood: <from the direction, or the original's if pre-direction>. Style: <one
phrase — "painterly landscape", "studio product on seamless", "abstract
gradient mesh">. Must leave <region> clean for overlaid text. No text, no
logos, no recognizable brands.
```
Generate at ≥ the original's served resolution. Keep the original's filename
slot (`hero-bg.jpg` → the mount / `<img data-rx-asset="hero-bg">` stays the
same) so directions can swap it by key.

## Fonts

Keep open-license fonts. Swap commercially licensed ones for metric-compatible
open pairs — match x-height and width so the measured sizes still fit:

| Licensed | Open stand-in |
|---|---|
| Neue Haas Grotesk / Helvetica Neue | Inter (tracking −0.01em) or Instrument Sans |
| PP Cirka / editorial serif display | Instrument Serif, Fraunces, Newsreader |
| GT America / Söhne / ABC Diatype | Inter, Geist, Manrope |
| Founders Grotesk | Archivo, Work Sans |
| Monument Extended / PP Neue Machina | Unbounded, Syncopate |
| Tiempos / Canela | Fraunces, Source Serif 4, Cormorant |
| SF Mono / Berkeley Mono | Geist Mono, JetBrains Mono, IBM Plex Mono |

After a swap, re-measure the hero headline height and adjust `--rx-size-1`
until it matches the original's within a line.

## Scrub

Remove: analytics (GA/PostHog/Plausible), their API endpoints and forms'
`action`s, their social links, their legal pages, `<meta>` descriptions/OG,
sitemap/robots, any `data-*` that carries their ids. Grep the built output for
their domain and brand name — zero hits before Phase 1 is done.
