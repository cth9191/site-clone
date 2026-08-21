/*
 * motion-probe.js — runtime animation/interaction extractor for /clone-site.
 *
 * Purpose: recover the EXACT parameters of every animation on a loaded page by
 * asking the running libraries, instead of paraphrasing a minified bundle.
 * A minified GSAP config is unreadable as text; `ScrollTrigger.getAll()` on the
 * live page hands you start/end/scrub/pin/targets verbatim. Same for WAAPI
 * (`document.getAnimations()`), Lenis options, Swiper/Splide params, and the
 * stylesheet's @keyframes. This is the difference between "uses scroll
 * animations" and "ScrollTrigger pinned to .hero, scrub:true, scale 1→0.3".
 *
 * Two ways to run it, best first:
 *
 *   1. INSTRUMENTED. Inject instrumentMotion() as an init script BEFORE the
 *      page's scripts run (Playwright page.addInitScript / playwright-cli).
 *      It records IntersectionObserver registrations (otherwise un-enumerable),
 *      requestAnimationFrame usage, and the real event listeners added to
 *      window/document (scroll/mousemove/wheel). Then run motionProbe() after
 *      the page settles.
 *
 *   2. POST-HOC (any browser eval tool — no preload). Just run
 *      motionProbe(). You still get GSAP/ScrollTrigger/WAAPI/Lenis/keyframes/
 *      sliders — everything that lives on a global or in the CSSOM. You lose
 *      IO/rAF/listener inventory; the probe says so in `instrumented:false`.
 *
 * Output is JSON. Save it to output/<hostname>/motion.json — it can be large.
 * Nothing here mutates the page.
 */

/* ---- Mode 1 helper: inject BEFORE page scripts run ---- */
function instrumentMotion() {
  const W = window;
  W.__motion = { io: [], raf: 0, listeners: [], mutationObs: 0 };

  // IntersectionObserver: record options + observed targets (reveal-on-scroll,
  // sticky-sidebar active states, lazy sections all live here).
  try {
    const OIO = W.IntersectionObserver;
    if (OIO) {
      W.IntersectionObserver = function (cb, opts) {
        const rec = { options: opts || {}, targets: [] };
        W.__motion.io.push(rec);
        const inst = new OIO(cb, opts);
        const oobs = inst.observe.bind(inst);
        inst.observe = function (el) {
          try {
            rec.targets.push(
              (el.id ? '#' + el.id : '') +
                (el.className && typeof el.className === 'string'
                  ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
                  : '') || el.tagName.toLowerCase()
            );
          } catch (_) {}
          return oobs(el);
        };
        return inst;
      };
      W.IntersectionObserver.prototype = OIO.prototype;
    }
  } catch (_) {}

  // rAF: count loops (a steady count after settle = custom animation loop).
  try {
    const oraf = W.requestAnimationFrame.bind(W);
    W.requestAnimationFrame = function (cb) {
      W.__motion.raf++;
      return oraf(cb);
    };
  } catch (_) {}

  // Global listeners: which input drives the page? (scroll/wheel/mousemove/
  // pointermove/resize/touchmove). Only window + document; element-level
  // listeners are too noisy to be useful here.
  try {
    const patch = (target, name) => {
      const oadd = target.addEventListener.bind(target);
      target.addEventListener = function (type, fn, opts) {
        if (/^(scroll|wheel|mousemove|pointermove|touchmove|resize|mouseenter|mouseleave|keydown)$/.test(type)) {
          W.__motion.listeners.push({ on: name, type, passive: !!(opts && opts.passive) });
        }
        return oadd(type, fn, opts);
      };
    };
    patch(W, 'window');
    patch(document, 'document');
  } catch (_) {}

  try {
    const OMO = W.MutationObserver;
    if (OMO) {
      W.MutationObserver = function (cb) {
        W.__motion.mutationObs++;
        return new OMO(cb);
      };
      W.MutationObserver.prototype = OMO.prototype;
    }
  } catch (_) {}
}

/* ---- The probe: run AFTER the page has settled (and after one full scroll) ---- */
function motionProbe() {
  const W = window, D = document;
  const out = {
    url: location.href,
    viewport: { w: W.innerWidth, h: W.innerHeight, dpr: W.devicePixelRatio },
    instrumented: !!W.__motion,
    libraries: {},
    gsap: null,
    scrollTrigger: [],
    waapi: [],
    keyframes: [],
    scrollTimelines: [],
    transitions: [],
    lenis: null,
    sliders: [],
    splitText: [],
    intersectionObservers: W.__motion ? W.__motion.io : undefined,
    listeners: W.__motion ? W.__motion.listeners : undefined,
    rafCalls: W.__motion ? W.__motion.raf : undefined,
    customProps: {},
    notes: [],
  };

  const sel = (el) => {
    if (!el || !el.tagName) return String(el);
    if (el.id) return '#' + el.id;
    const cls =
      typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
        : '';
    return el.tagName.toLowerCase() + cls;
  };
  const safe = (v, depth = 0) => {
    // Serialize tween vars / options without choking on DOM nodes or functions.
    if (v == null) return v;
    if (typeof v === 'function') return '[fn]';
    // Host objects first — Lenis stores `wrapper: window`, which would otherwise
    // serialize the entire global scope.
    if (v === W) return '[window]';
    if (v === D) return '[document]';
    if (v instanceof Element) return sel(v);
    if (typeof Node !== 'undefined' && v instanceof Node) return '[' + v.nodeName + ']';
    if (typeof EventTarget !== 'undefined' && v instanceof EventTarget) return '[' + (v.constructor && v.constructor.name || 'EventTarget') + ']';
    if (Array.isArray(v)) return depth > 3 ? '[…]' : v.slice(0, 20).map((x) => safe(x, depth + 1));
    if (typeof v === 'object') {
      if (depth > 3) return '[obj]';
      const o = {};
      let n = 0;
      for (const k of Object.keys(v)) {
        if (k.startsWith('_') || k === 'parent' || k === 'vars' && depth > 0) continue;
        if (++n > 40) { o['…'] = 'truncated'; break; }
        try { o[k] = safe(v[k], depth + 1); } catch (_) {}
      }
      return o;
    }
    return v;
  };

  /* ---- Library globals (hypotheses about HOW things move) ---- */
  const libs = {
    gsap: 'gsap', ScrollTrigger: 'ScrollTrigger', SplitText: 'SplitText', Flip: 'Flip',
    Draggable: 'Draggable', Observer: 'Observer', ScrollSmoother: 'ScrollSmoother',
    Lenis: 'Lenis', lenis: 'lenis', LocomotiveScroll: 'LocomotiveScroll',
    Swiper: 'Swiper', Splide: 'Splide', Flickity: 'Flickity', Embla: 'EmblaCarousel',
    barba: 'barba', Swup: 'Swup', anime: 'anime', Motion: 'Motion', motion: 'motion',
    THREE: 'THREE', PIXI: 'PIXI', lottie: 'lottie', bodymovin: 'bodymovin', Rive: 'rive',
    AOS: 'AOS', ScrollReveal: 'ScrollReveal', Alpine: 'Alpine', jQuery: 'jQuery',
    __NEXT_DATA__: '__NEXT_DATA__', __NUXT__: '__NUXT__', Webflow: 'Webflow',
    Shopify: 'Shopify', wp: 'wp', ___gatsby: '___gatsby', __remixContext: '__remixContext',
    __sveltekit: '__sveltekit', __astro: '__astro',
  };
  for (const [k, g] of Object.entries(libs)) {
    try {
      const v = W[g];
      if (v !== undefined) {
        out.libraries[k] = (v && (v.version || v.VERSION || (v.core && v.core.version))) || true;
      }
    } catch (_) {}
  }
  // Framework fingerprints that don't expose globals
  try {
    if (D.querySelector('[data-reactroot], #__next, #root [data-reactid]') || Object.keys(D.body).some((k) => k.startsWith('__react')))
      out.libraries.react = true;
    if (D.querySelector('[data-v-app], #__nuxt, [data-server-rendered]')) out.libraries.vue = true;
    if (D.querySelector('.w-nav, .w-slider, [data-wf-page]')) out.libraries.webflow = true;
    if (D.querySelector('[data-framer-name], #__framer-badge-container, [data-framer-component-type]')) out.libraries.framer = true;
    if (D.querySelector('link[href*="wp-content"], script[src*="wp-includes"]')) out.libraries.wordpress = true;
    if (D.querySelector('script[src*="unicorn.studio"], [data-us-project]')) out.libraries.unicornStudio = true;
    if (D.querySelector('spline-viewer, canvas[data-spline]')) out.libraries.spline = true;
  } catch (_) {}

  /* ---- GSAP: every live tween/timeline + all ScrollTriggers ---- */
  try {
    const g = W.gsap;
    // Bundled GSAP (Next/Vite builds) registers no `window.gsap`, only
    // `window.gsapVersions`. Then getAll() is unreachable — but GSAP stamps every
    // tweened element with `_gsap`, so we can still list WHAT it animates and
    // tell the builder to read params via the instrumented/source path.
    if (!g && Array.isArray(W.gsapVersions)) {
      out.libraries.gsap = W.gsapVersions.join(',') + ' (bundled, no global)';
      const stamped = Array.from(D.querySelectorAll('*')).filter((el) => el._gsap).slice(0, 200);
      out.gsap = {
        version: W.gsapVersions[0], bundled: true, tweens: [],
        stampedTargets: stamped.map((el) => ({ target: sel(el), x: el._gsap.x, y: el._gsap.y, scaleX: el._gsap.scaleX, rotation: el._gsap.rotation })),
      };
      if (D.querySelector('.pin-spacer')) out.gsap.pinSpacers = Array.from(D.querySelectorAll('.pin-spacer')).slice(0, 20).map((p) => ({ spacer: sel(p), pinned: p.firstElementChild ? sel(p.firstElementChild) : null, height: Math.round(p.getBoundingClientRect().height) }));
      out.notes.push('gsap is bundled (no window.gsap): ScrollTrigger params not readable live. Use instrumentMotion() preload (listeners/IO) + grep the bundle for "scrollTrigger" near the target selectors; .pin-spacer count = pinned sections.');
    }
    if (g) {
      out.gsap = { version: g.version, tweens: [], defaults: safe(g.defaults && g.defaults()) };
      const root = g.globalTimeline;
      const children = root && root.getChildren ? root.getChildren(true, true, true) : [];
      for (const t of children.slice(0, 400)) {
        try {
          out.gsap.tweens.push({
            kind: t.getChildren ? 'timeline' : 'tween',
            targets: t.targets ? t.targets().slice(0, 5).map(sel) : undefined,
            duration: t.duration && t.duration(),
            delay: t.delay && t.delay(),
            repeat: t.repeat && t.repeat(),
            yoyo: t.yoyo && t.yoyo(),
            paused: t.paused && t.paused(),
            vars: safe(t.vars),
            hasScrollTrigger: !!(t.scrollTrigger || (t.vars && t.vars.scrollTrigger)),
          });
        } catch (_) {}
      }
      if (children.length > 400) out.notes.push(`gsap: ${children.length} tweens, truncated to 400`);
    }
    const ST = W.ScrollTrigger || (g && g.plugins && g.plugins.ScrollTrigger);
    if (ST && ST.getAll) {
      for (const s of ST.getAll()) {
        try {
          out.scrollTrigger.push({
            trigger: sel(s.trigger),
            pin: s.pin ? sel(s.pin) : false,
            start: s.start,
            end: s.end,
            scrub: s.vars.scrub,
            markers: !!s.vars.markers,
            snap: safe(s.vars.snap),
            toggleActions: s.vars.toggleActions,
            toggleClass: safe(s.vars.toggleClass),
            once: !!s.vars.once,
            pinSpacing: s.vars.pinSpacing,
            anticipatePin: s.vars.anticipatePin,
            animationTargets: s.animation && s.animation.targets ? s.animation.targets().slice(0, 5).map(sel) : undefined,
            animationVars: s.animation ? safe(s.animation.vars) : undefined,
            progress: s.progress,
          });
        } catch (_) {}
      }
    }
  } catch (e) { out.notes.push('gsap probe error: ' + e.message); }

  /* ---- WAAPI: CSS animations/transitions + JS element.animate() ---- */
  try {
    const anims = D.getAnimations ? D.getAnimations() : [];
    for (const a of anims.slice(0, 300)) {
      try {
        const eff = a.effect;
        const timing = eff && eff.getTiming ? eff.getTiming() : {};
        const kf = eff && eff.getKeyframes ? eff.getKeyframes().slice(0, 12) : undefined;
        out.waapi.push({
          type: a.constructor.name, // CSSAnimation | CSSTransition | Animation
          name: a.animationName || a.transitionProperty || a.id || undefined,
          target: eff && eff.target ? sel(eff.target) : undefined,
          pseudo: eff && eff.pseudoElement || undefined,
          playState: a.playState,
          timeline: a.timeline ? a.timeline.constructor.name : undefined, // ScrollTimeline/ViewTimeline = scroll-driven
          duration: timing.duration,
          delay: timing.delay,
          iterations: timing.iterations,
          direction: timing.direction,
          easing: timing.easing,
          fill: timing.fill,
          keyframes: kf,
        });
      } catch (_) {}
    }
    if (anims.length > 300) out.notes.push(`waapi: ${anims.length} animations, truncated to 300`);
  } catch (e) { out.notes.push('waapi probe error: ' + e.message); }

  /* ---- CSSOM: @keyframes, scroll-timelines, transitions on real elements ---- */
  try {
    const seenKf = new Set();
    for (const ss of Array.from(D.styleSheets)) {
      let rules;
      try { rules = ss.cssRules; } catch (_) { out.notes.push('cross-origin stylesheet (no CSSOM): ' + ss.href); continue; }
      const walk = (list) => {
        for (const r of Array.from(list)) {
          if (r.type === CSSRule.KEYFRAMES_RULE) {
            if (!seenKf.has(r.name)) { seenKf.add(r.name); out.keyframes.push({ name: r.name, css: r.cssText.slice(0, 2000) }); }
          } else if (r.type === CSSRule.MEDIA_RULE || r.type === CSSRule.SUPPORTS_RULE) {
            walk(r.cssRules);
          } else if (r.style) {
            const st = r.style;
            if (st.animationTimeline && st.animationTimeline !== 'auto' || st.scrollTimelineName || st.viewTimelineName) {
              out.scrollTimelines.push({ selector: r.selectorText, css: r.cssText.slice(0, 600) });
            }
          }
        }
      };
      walk(rules);
    }
  } catch (e) { out.notes.push('cssom probe error: ' + e.message); }

  // Transitions: which elements have non-trivial transitions (hover/state feel)
  try {
    const seenT = new Map();
    for (const el of Array.from(D.querySelectorAll('a,button,[class*=card],[class*=btn],[class*=link],[class*=item],[class*=nav],img,li,h1,h2,h3,p,span,div')).slice(0, 3000)) {
      const cs = getComputedStyle(el);
      const dur = cs.transitionDuration;
      if (dur && dur !== '0s' && cs.transitionProperty !== 'all' || (dur && dur !== '0s' && cs.transitionProperty === 'all' && parseFloat(dur) >= 0.15)) {
        const key = cs.transitionProperty + '|' + dur + '|' + cs.transitionTimingFunction;
        if (!seenT.has(key)) seenT.set(key, { property: cs.transitionProperty, duration: dur, easing: cs.transitionTimingFunction, delay: cs.transitionDelay, example: sel(el), count: 0 });
        seenT.get(key).count++;
      }
    }
    out.transitions = Array.from(seenT.values()).sort((a, b) => b.count - a.count).slice(0, 40);
  } catch (_) {}

  /* ---- Smooth scroll: Lenis / Locomotive with real options ---- */
  try {
    const l = W.lenis || (W.Lenis && W.Lenis.instance) || W.__lenis || (W.locomotive && W.locomotive.lenisInstance);
    if (l) {
      out.lenis = {
        options: safe(l.options),
        isSmooth: l.isSmooth, isStopped: l.isStopped,
        htmlClasses: Array.from(D.documentElement.classList).filter((c) => /lenis|locomotive|smooth/i.test(c)),
      };
    } else if (D.documentElement.classList.contains('lenis') || D.querySelector('[data-lenis-prevent],[data-scroll-container]')) {
      out.lenis = { detected: 'by-markup', options: 'not exposed on window — fall back to default lerp 0.1 / duration 1.2', htmlClasses: Array.from(D.documentElement.classList) };
    }
    if (W.ScrollSmoother && W.ScrollSmoother.get) { const s = W.ScrollSmoother.get(); if (s) out.lenis = Object.assign(out.lenis || {}, { scrollSmoother: safe(s.vars) }); }
  } catch (_) {}

  /* ---- Sliders / carousels with live params ---- */
  try {
    for (const el of Array.from(D.querySelectorAll('.swiper, .splide, .flickity-enabled, .embla, .slick-slider, [data-slider], [class*=carousel], [class*=marquee]')).slice(0, 30)) {
      const rec = { selector: sel(el), lib: null, params: null };
      if (el.swiper) { rec.lib = 'swiper'; rec.params = safe(el.swiper.params); }
      else if (el.splide) { rec.lib = 'splide'; rec.params = safe(el.splide.options); }
      else if (W.Flickity && W.Flickity.data && W.Flickity.data(el)) { rec.lib = 'flickity'; rec.params = safe(W.Flickity.data(el).options); }
      else {
        // CSS marquee? check child animation
        const a = (D.getAnimations ? D.getAnimations({ subtree: true }) : []).find((x) => el.contains(x.effect && x.effect.target));
        rec.lib = a ? 'css-animation:' + (a.animationName || 'waapi') : 'unknown';
      }
      out.sliders.push(rec);
    }
  } catch (_) {}

  /* ---- SplitText-style char/word/line wrappers (text reveal pattern) ---- */
  try {
    const hits = D.querySelectorAll('.char, .word, .line, [class*=split-char], [class*=split-word], [class*=split-line], [data-split]');
    if (hits.length) {
      const parents = new Set();
      hits.forEach((h) => { const p = h.closest('h1,h2,h3,h4,p,a,span,div'); if (p && p !== h) parents.add(sel(p.parentElement && p.parentElement.matches('h1,h2,h3,h4,p') ? p.parentElement : p)); });
      out.splitText = { wrapperCount: hits.length, containers: Array.from(parents).slice(0, 20) };
    }
  } catch (_) {}

  /* ---- Root custom properties that look animation-related ---- */
  try {
    const cs = getComputedStyle(D.documentElement);
    for (const ss of Array.from(D.styleSheets)) {
      let rules; try { rules = ss.cssRules; } catch (_) { continue; }
      for (const r of Array.from(rules)) {
        if (r.selectorText === ':root' || r.selectorText === 'html') {
          for (const p of Array.from(r.style)) if (p.startsWith('--')) out.customProps[p] = cs.getPropertyValue(p).trim();
        }
      }
    }
  } catch (_) {}

  /* ---- Summary: what drives this page? ---- */
  out.summary = {
    animationStack: [
      out.gsap && 'gsap@' + out.gsap.version + (out.gsap.bundled ? '(bundled)' : ''),
      out.gsap && out.gsap.pinSpacers && out.gsap.pinSpacers.length && `pin-spacers(${out.gsap.pinSpacers.length})`,
      out.scrollTrigger.length && `ScrollTrigger(${out.scrollTrigger.length})`,
      out.scrollTrigger.some((s) => s.pin) && 'pinned-sections',
      out.scrollTrigger.some((s) => s.scrub) && 'scrub',
      out.lenis && 'lenis',
      out.scrollTimelines.length && 'css-scroll-timeline',
      out.waapi.some((a) => a.type === 'CSSAnimation') && 'css-keyframes',
      out.splitText.wrapperCount && 'split-text-reveal',
      out.sliders.length && `sliders(${out.sliders.length})`,
      out.libraries.THREE && 'three.js',
      out.libraries.lottie && 'lottie',
    ].filter(Boolean),
    inputDrivers: out.listeners ? Array.from(new Set(out.listeners.map((l) => l.type))) : 'unknown (not instrumented)',
    ioCount: out.intersectionObservers ? out.intersectionObservers.length : 'unknown (not instrumented)',
    platform: Object.keys(out.libraries).filter((k) => /next|nuxt|webflow|framer|wordpress|gatsby|remix|svelte|astro|shopify|react|vue/i.test(k)),
  };

  return out;
}

/* Small, console-safe view for a first look (< ~4KB). Save the full
 * motionProbe() to disk; print this one. */
function motionSummary() {
  const m = motionProbe();
  return {
    summary: m.summary,
    libraries: m.libraries,
    lenis: m.lenis && { options: m.lenis.options, detected: m.lenis.detected },
    scrollTriggers: m.scrollTrigger.length,
    pinned: m.scrollTrigger.filter((s) => s.pin).map((s) => s.trigger).slice(0, 10),
    tweens: m.gsap ? (m.gsap.tweens.length || (m.gsap.stampedTargets || []).length) : 0,
    waapi: { total: m.waapi.length, css: m.waapi.filter((a) => a.type === 'CSSAnimation').length, scrollDriven: m.waapi.filter((a) => /Scroll|View/.test(a.timeline || '')).length },
    keyframes: m.keyframes.map((k) => k.name).slice(0, 20),
    sliders: m.sliders.map((s) => s.lib),
    splitText: m.splitText.wrapperCount || 0,
    topTransitions: m.transitions.slice(0, 5),
    notes: m.notes,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { instrumentMotion, motionProbe, motionSummary };
}
