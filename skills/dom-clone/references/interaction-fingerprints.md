# Interaction fingerprints

The most expensive mistake when rebuilding a section is getting its **control
model** wrong — building click-switched tabs when the original auto-switches on
scroll, or static CSS when the original runs a smooth-scroll library. Fixing it
later is a rewrite, not a tweak, because it changes the component's whole
structure. So identify the mechanism during extraction, from concrete signatures,
not from how it looks.

## Determine the model by observing, in this order

1. **Scroll first, don't click.** Slowly scroll the section. If content changes,
   panels swap, or a sidebar's active item advances on its own as you scroll,
   it's **scroll-driven** (IntersectionObserver / scroll timeline / sticky). Note
   the trigger (scroll position or intersection ratio).
2. **Then click.** If nothing changes on scroll, test clicks — real tabs/pills
   that swap content on click.
3. **Then hover.** Record hover state changes (color/scale/shadow) with their
   transition duration + easing.

Record the verdict explicitly in the spec: `INTERACTION MODEL: scroll-driven
(IntersectionObserver)` etc.

## Smooth-scroll libraries

Native browser scrolling feels different from a lerp-smoothed library; users spot
it instantly, so a clone must reproduce the same scroll feel. Detect by
signature:

- **Lenis** (the dominant current library) — a `Lenis` runtime global, a `lenis`
  class on `<html>`, and/or `data-lenis*` attributes (e.g. `data-lenis-prevent`).
  It smooths the browser's own native scroll (so sticky/anchor/accessibility keep
  working) rather than transform-hijacking the page — reproduce it by adding Lenis
  with matching lerp/duration, not by faking scroll with transforms.
- **Locomotive Scroll** — `data-scroll`, `data-scroll-container`,
  `data-scroll-section`, `data-scroll-speed` attributes. Current versions are
  built on top of Lenis, so a Locomotive page often shows Lenis signatures too;
  reproduce with Locomotive (or Lenis + the same `data-scroll-speed` parallax).

The surface-map script already reports these under `scroll`. Trust that as the
first pass, then confirm the feel.

## Scroll-driven CSS animations

Modern sites increasingly drive animations off scroll/view progress instead of
time, with no JS. Their fingerprint is CSS: `animation-timeline` set to something
other than `auto`, plus `scroll-timeline-name` / `view-timeline-name` (and their
`-axis` / `-inset`). When present, rebuild with the same scroll/view timeline —
don't approximate it with a JS scroll listener, which will feel and perform
differently.

## Behaviors to catch (illustrative, not exhaustive)

- Navbar that shrinks / gains a shadow / changes background past a scroll
  threshold — capture styles at position 0 and past the trigger; diff them.
- Elements that animate into view on entering the viewport (fade-up, stagger).
- Sticky sidebars whose active item auto-changes as content scrolls (Intersection
  Observer, NOT click handlers) — the classic scroll-vs-click trap.
- Parallax layers moving at different rates than scroll.
- Auto-playing carousels / cycling content (time-driven).
- Section-to-section theme flips (dark↔light) tied to scroll.

For any stateful element, extract **every** state's content and styles plus the
transition between them — a clone that only captures the load-time state looks
broken the moment the user interacts with it.

## Capturing assets inside scroll-pinned / sticky sequences

A common modern pattern: a tall feature section where a sticky column stays fixed
while paired content scrolls, swapping the visible mock per feature (`position:
sticky` + IntersectionObserver). Two traps when capturing the paired visual:

- **Don't trust "the nth image."** These sequences frequently reuse one
  background/wallpaper image across every block, so an nth-`<img>` selector lands
  on the wrong block's asset. Identify the block by its own container's bounding
  box, not by image index.
- **Capture at the paired scroll offset.** The correct mock for feature N is only
  fully composited/visible when the section is scrolled to N's active range.
  Scroll to that offset first, then clip the region — capturing at scroll 0 gives
  you the first (or an empty) frame. Record the offset in the spec so the capture
  is reproducible.

If you only need a static clone, one clean full-row capture at the right offset is
enough; if you're rebuilding the pin behavior, also record the trigger ranges per
block (which one is active at which scroll position).
