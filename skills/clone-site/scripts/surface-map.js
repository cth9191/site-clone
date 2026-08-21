/*
 * surface-map.js — the recon router for /clone-site.
 *
 * Purpose: decide, for one loaded page, WHICH regions are plain DOM/CSS and
 * which are GPU/canvas-rendered, so the coordinator can send each region to the
 * right extractor. A DOM extractor reading getComputedStyle() is blind to
 * anything a <canvas> paints — those pixels live on the GPU, not in the DOM.
 * Misrouting a WebGL hero to the DOM track produces an empty div where the
 * effect should be. This script is the seam that prevents that.
 *
 * Two ways to run it, best first:
 *
 *   1. INSTRUMENTED (most reliable). Inject instrumentGetContext() as a preload
 *      script BEFORE the page's own scripts run (browser MCP "evaluate on new
 *      document", Playwright page.addInitScript, or a Chrome MCP preload). It
 *      records the context type each canvas actually requested. Then, after the
 *      page settles, run surfaceMap() to read those tags. This is the ground
 *      truth because it sees the real getContext() call the site made.
 *
 *   2. POST-HOC (no preload available). Just run surfaceMap() on the loaded
 *      page. It probes getContext() live. This is reliable for the common case
 *      (see note in classifyCanvas) but can mutate an as-yet-uninitialized
 *      canvas, so prefer mode 1 when the tooling supports preload.
 *
 * Both return the same JSON shape. Keep the output in the run's output dir, not
 * in the conversation — it can be large on canvas-heavy pages.
 */

/* ---- Mode 1 helper: inject this BEFORE page scripts run ---- */
function instrumentGetContext() {
  const proto = HTMLCanvasElement.prototype;
  const orig = proto.getContext;
  proto.getContext = function (type, ...args) {
    try {
      // First requested type wins as the canvas's "real" type; record it once.
      if (!this.__requestedContextType) this.__requestedContextType = type;
    } catch (_) {}
    return orig.call(this, type, ...args);
  };
  // Also flag OffscreenCanvas transfers, which hide the real drawing surface.
  try {
    const to = proto.transferControlToOffscreen;
    if (to) {
      proto.transferControlToOffscreen = function (...a) {
        this.__offscreen = true;
        return to.apply(this, a);
      };
    }
  } catch (_) {}
}

/* ---- The map builder: run AFTER the page has settled ---- */
function surfaceMap() {
  const W = window, D = document;
  const vw = W.innerWidth, vh = W.innerHeight;

  // Framework + platform globals. Presence is a hypothesis about HOW a canvas
  // is driven — it does not by itself prove a given canvas is GPU-backed, so it
  // annotates surfaces rather than deciding them.
  const globals = {
    three: !!W.THREE,
    babylon: !!W.BABYLON,
    regl: !!W.regl,
    pixi: !!W.PIXI,
    ogl: !!W.OGL || !!W.ogl,
    p5: !!W.p5,
    gsap: !!W.gsap || !!W.TweenMax,
    // Platform effect tools that ship shader backgrounds:
    unicornStudio:
      !!W.UnicornStudio ||
      !!D.querySelector('[data-us-project],[data-us-project-src],script[src*="unicorn" i]'),
    spline: !!D.querySelector('spline-viewer,script[src*="spline" i]'),
    rive: !!W.rive || !!D.querySelector('canvas[data-rive],script[src*="rive" i]'),
    shadertoy: !!D.querySelector('script[src*="shadertoy" i]'),
  };

  // Scroll / interaction library fingerprints. These decide whether an
  // interaction is scroll-driven vs click/hover — the single most expensive
  // thing to get wrong when rebuilding, because it changes the component's
  // whole control model, not just its CSS. (Signatures per vendor docs; treat
  // as strong hints and confirm by scrolling during recon.)
  const html = D.documentElement;
  const scroll = {
    lenis:
      !!W.Lenis ||
      html.classList.contains('lenis') ||
      !!D.querySelector('[data-lenis],[data-lenis-prevent],[data-lenis-prevent-wheel]'),
    locomotive: !!D.querySelector('[data-scroll],[data-scroll-container],[data-scroll-section]'),
    scrollTimelineCSS: detectScrollTimelineCSS(),
    scrollSnap: detectScrollSnap(),
  };

  const surfaces = [];

  // 1) Canvas surfaces — the ones the DOM track cannot see.
  [...D.querySelectorAll('canvas')].forEach((c, i) => {
    const r = c.getBoundingClientRect();
    const kind = classifyCanvas(c);
    surfaces.push({
      id: `canvas-${i}`,
      surface: kind, // WEBGPU | WEBGL2 | WEBGL1 | CANVAS2D | CANVAS_UNKNOWN
      route: kind === 'CANVAS2D' || kind === 'CANVAS_UNKNOWN' ? 'shader-extract?' : 'shader-extract',
      selector: cssPath(c),
      rect: round(r),
      coveragePct: coverage(r, vw, vh),
      fullscreenHero: coverage(r, vw, vh) > 70 && r.top < vh * 0.5,
      zIndex: getComputedStyle(c).zIndex,
      position: getComputedStyle(c).position,
      pointerEvents: getComputedStyle(c).pointerEvents,
      offscreen: !!c.__offscreen,
      requestedType: c.__requestedContextType || null, // present only in instrumented mode
      driver: guessDriver(c, globals),
      animated: null, // fill via the rAF check below if you run it
    });
  });

  // 2) <video> surfaces — often mistaken for shader/canvas effects. A hero that
  // looks generative may just be a looping muted video; cloning it as a canvas
  // is wasted work. Flag them so the coordinator can just re-embed the source.
  [...D.querySelectorAll('video')].forEach((v, i) => {
    const r = v.getBoundingClientRect();
    surfaces.push({
      id: `video-${i}`,
      surface: 'VIDEO',
      route: 'dom-clone', // re-embed the <video>; no reconstruction needed
      selector: cssPath(v),
      rect: round(r),
      coveragePct: coverage(r, vw, vh),
      src: v.currentSrc || v.src || (v.querySelector('source') || {}).src || null,
      autoplay: v.autoplay, loop: v.loop, muted: v.muted, poster: v.poster || null,
    });
  });

  // 2b) Canvases inside <iframe>. A top-document canvas scan misses effects that
  // sites host in an iframe (common — e.g. an embedded demo used as a hero). For
  // SAME-ORIGIN iframes, recurse and offset the child rect into page coordinates.
  // For CROSS-ORIGIN iframes, the browser blocks DOM access, so we can't classify
  // the inner canvas — flag the frame as opaque so the coordinator handles it
  // deliberately (re-embed the iframe src, or treat as an external effect) rather
  // than silently producing an empty box.
  [...D.querySelectorAll('iframe')].forEach((f, i) => {
    const r = f.getBoundingClientRect();
    let doc = null;
    try { doc = f.contentDocument; } catch (_) { doc = null; } // cross-origin throws
    if (!doc) {
      surfaces.push({
        id: `iframe-${i}`,
        surface: 'IFRAME_OPAQUE',
        route: 'coordinator-decide',
        selector: cssPath(f),
        rect: round(r),
        coveragePct: coverage(r, vw, vh),
        fullscreenHero: coverage(r, vw, vh) > 70 && r.top < vh * 0.5,
        src: f.src || null,
        note: 'Cross-origin iframe — inner surfaces not inspectable. Re-embed src or route to shader-extract via a direct load of the frame URL.',
      });
      return;
    }
    [...doc.querySelectorAll('canvas')].forEach((c, j) => {
      const cr = c.getBoundingClientRect(); // relative to iframe viewport
      const kind = classifyCanvas(c);
      surfaces.push({
        id: `iframe-${i}-canvas-${j}`,
        surface: kind,
        route: kind === 'CANVAS2D' || kind === 'CANVAS_UNKNOWN' ? 'shader-extract?' : 'shader-extract',
        selector: `${cssPath(f)} >> ${cssPath(c)}`, // frame-piercing hint
        inIframe: f.src || true,
        rect: { x: Math.round(r.left + cr.left), y: Math.round(r.top + cr.top), w: Math.round(cr.width), h: Math.round(cr.height) },
        coveragePct: coverage(r, vw, vh),
        fullscreenHero: coverage(r, vw, vh) > 70 && r.top < vh * 0.5,
        requestedType: c.__requestedContextType || null,
        driver: 'unknown-iframe',
      });
    });
  });

  // 3) Inline SVG animation surfaces — vector, not raster; DOM track handles
  // them, but flag animated ones so they aren't frozen to a static snapshot.
  [...D.querySelectorAll('svg')].forEach((s, i) => {
    if (!s.querySelector('animate,animateTransform,animateMotion,set')) return;
    const r = s.getBoundingClientRect();
    surfaces.push({
      id: `svg-anim-${i}`,
      surface: 'SVG_ANIMATED',
      route: 'dom-clone',
      selector: cssPath(s),
      rect: round(r),
    });
  });

  return {
    url: location.href,
    title: D.title,
    viewport: { w: vw, h: vh, dpr: W.devicePixelRatio || 1 },
    globals,
    scroll,
    counts: {
      canvas: D.querySelectorAll('canvas').length,
      gpuCanvas: surfaces.filter((s) => /WEBG/.test(s.surface)).length,
      video: D.querySelectorAll('video').length,
      iframe: D.querySelectorAll('iframe').length,
      opaqueIframe: surfaces.filter((s) => s.surface === 'IFRAME_OPAQUE').length,
    },
    surfaces,
    routingSummary: routingSummary(surfaces),
  };

  /* ---------- helpers ---------- */

  // Classify a single canvas by probing getContext.
  //
  // Key fact that makes this reliable post-hoc: getContext(type) returns the
  // EXISTING context when `type` matches how the canvas was initialized, and
  // returns null when it does not match. So probing webgl2 -> webgl -> webgpu ->
  // 2d in order identifies an already-initialized canvas without clobbering it:
  // the matching type hands back the live context, the others fail fast.
  // WebGL2 must be probed before WebGL because a WebGL2RenderingContext is NOT
  // an instanceof WebGLRenderingContext, so a webgl-first probe would mislabel
  // WebGL2 canvases. Prefer instrumented mode (requestedType) when available.
  function classifyCanvas(c) {
    if (c.__requestedContextType) {
      const t = c.__requestedContextType;
      if (t === 'webgpu') return 'WEBGPU';
      if (t === 'webgl2') return 'WEBGL2';
      if (t === 'webgl' || t === 'experimental-webgl') return 'WEBGL1';
      if (t === '2d') return 'CANVAS2D';
    }
    // Use the canvas's OWN realm globals for instanceof. A canvas inside an
    // iframe yields a context that is an instance of the IFRAME's
    // WebGL*RenderingContext, not the parent frame's, so a parent-realm
    // instanceof silently fails cross-realm (misclassifying as UNKNOWN). Fall
    // back to constructor-name matching when the realm globals aren't reachable.
    const win = (c.ownerDocument && c.ownerDocument.defaultView) || window;
    const isType = (ctx, ctorName) => {
      if (!ctx) return false;
      const Ctor = win[ctorName];
      if (Ctor && ctx instanceof Ctor) return true;
      let proto = ctx && Object.getPrototypeOf(ctx);
      return !!(proto && proto.constructor && proto.constructor.name === ctorName);
    };
    try {
      const g2 = c.getContext('webgl2');
      if (isType(g2, 'WebGL2RenderingContext')) return 'WEBGL2';
    } catch (_) {}
    try {
      const g1 = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (isType(g1, 'WebGLRenderingContext')) return 'WEBGL1';
    } catch (_) {}
    try {
      const gpu = c.getContext('webgpu');
      if (gpu) return 'WEBGPU';
    } catch (_) {}
    try {
      const two = c.getContext('2d');
      if (two) return 'CANVAS2D';
    } catch (_) {}
    return 'CANVAS_UNKNOWN';
  }

  function guessDriver(c, g) {
    const cls = (c.className || '').toString().toLowerCase();
    const id = (c.id || '').toLowerCase();
    if (g.unicornStudio || /unicorn|us-/.test(cls + id)) return 'unicorn-studio';
    if (g.spline || c.closest('spline-viewer')) return 'spline';
    if (g.rive || c.hasAttribute('data-rive')) return 'rive';
    if (g.three) return 'three.js';
    if (g.babylon) return 'babylon';
    if (g.pixi) return 'pixi';
    if (g.regl) return 'regl';
    if (g.ogl) return 'ogl';
    // Production sites bundle their framework, so window.THREE etc. usually
    // aren't global. Fall back to weaker signals: devtools hooks the libraries
    // register, and script-src fingerprints. Lower confidence, still useful.
    if (W.__THREE__ || W.__THREE_DEVTOOLS__ || scriptSrcMatches(/three(\.module)?(\.min)?\.js|three@|\/three\//i)) return 'three.js?';
    if (scriptSrcMatches(/babylon/i)) return 'babylon?';
    if (scriptSrcMatches(/pixi/i)) return 'pixi?';
    if (scriptSrcMatches(/\bogl\b/i)) return 'ogl?';
    return 'unknown';
  }

  function scriptSrcMatches(re) {
    return [...D.querySelectorAll('script[src]')].some((s) => re.test(s.src));
  }

  function detectScrollTimelineCSS() {
    // Scroll-driven CSS animations run on a scroll/view timeline rather than the
    // default document timeline; their tell is animation-timeline plus
    // scroll-timeline-name / view-timeline-name. Sample a bounded set of nodes
    // (full-DOM getComputedStyle is expensive) and report if any use them.
    const nodes = [...D.querySelectorAll('*')].slice(0, 400);
    return nodes.some((el) => {
      const cs = getComputedStyle(el);
      return (
        (cs.animationTimeline && cs.animationTimeline !== 'auto') ||
        (cs.scrollTimelineName && cs.scrollTimelineName !== 'none') ||
        (cs.viewTimelineName && cs.viewTimelineName !== 'none')
      );
    });
  }

  function detectScrollSnap() {
    const nodes = [...D.querySelectorAll('*')].slice(0, 400);
    return nodes.some((el) => {
      const t = getComputedStyle(el).scrollSnapType;
      return t && t !== 'none';
    });
  }

  function coverage(r, vw, vh) {
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return Math.round(((w * h) / (vw * vh)) * 100);
  }

  function round(r) {
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
  }

  function cssPath(el) {
    if (el.id) return `#${el.id}`;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let sel = node.nodeName.toLowerCase();
      if (node.className && typeof node.className === 'string') {
        const cls = node.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (cls) sel += '.' + cls;
      }
      const parent = node.parentNode;
      if (parent) {
        const sameTag = [...parent.children].filter((c) => c.nodeName === node.nodeName);
        if (sameTag.length > 1) sel += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
      parts.unshift(sel);
      node = node.parentNode;
    }
    return parts.join(' > ');
  }

  function routingSummary(list) {
    const gpu = list.filter((s) => /WEBG/.test(s.surface));
    // A GPU platform can be loaded while its canvas hasn't initialized yet —
    // many effect libs lazy-init on scroll/interaction or ship video previews on
    // their own marketing pages. If we detect the platform global but found no
    // live GPU canvas, that's a signal to interact and re-scan, NOT to conclude
    // the page is pure DOM.
    const platformGlobals = ['unicornStudio', 'spline', 'rive', 'three', 'babylon', 'pixi', 'regl', 'ogl']
      .filter((k) => globals[k]);
    const opaque = list.filter((s) => s.surface === 'IFRAME_OPAQUE');
    const lazyGpuLikely = gpu.length === 0 && platformGlobals.length > 0;
    return {
      hasGpuSurfaces: gpu.length > 0,
      gpuHeroPresent: gpu.some((s) => s.fullscreenHero),
      sendToShaderExtract: gpu.map((s) => s.selector),
      opaqueIframes: opaque.map((s) => s.src || s.selector),
      platformGlobalsDetected: platformGlobals,
      lazyGpuLikely,
      note: gpu.length
        ? 'GPU surfaces present — route these to shader-extract; the DOM track will render them as empty boxes if cloned as HTML.'
        : lazyGpuLikely
          ? `A GPU effect platform (${platformGlobals.join(', ')}) is loaded but no live canvas was captured — likely lazy/interaction-gated or shown as video preview. Scroll/interact and re-run surfaceMap() before concluding this is a pure DOM page.`
          : 'No GPU surfaces detected — dom-clone alone is sufficient; still verify animated video/SVG are re-embedded, not snapshotted.',
    };
  }
}

/* Optional: sample whether a canvas is actively animating (a running rAF draw
 * loop). Run in the page over ~500ms; compares pixel hashes across frames.
 * Useful to separate a live shader from a one-shot canvas paint. */
async function isCanvasAnimating(selector, ms = 500) {
  const c = document.querySelector(selector);
  if (!c) return null;
  const snap = () => {
    try {
      const t = document.createElement('canvas');
      t.width = 32; t.height = 32;
      t.getContext('2d').drawImage(c, 0, 0, 32, 32);
      return t.getContext('2d').getImageData(0, 0, 32, 32).data.join(',');
    } catch (_) {
      return null; // cross-origin / context read blocked
    }
  };
  const a = snap();
  await new Promise((r) => setTimeout(r, ms));
  const b = snap();
  if (a == null || b == null) return 'unknown-readback-blocked';
  return a !== b;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { instrumentGetContext, surfaceMap, isCanvasAnimating };
}
