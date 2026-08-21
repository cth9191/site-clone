/*
 * tokens-probe.js — design-system extractor for /clone-site.
 *
 * Purpose: pull the page's REAL design tokens from computed styles of visible
 * elements — palette, type scale, font stack + @font-face sources, spacing
 * rhythm, radii, shadows, z-index layers, breakpoints, container widths —
 * ranked by how often each value is used. This replaces "skim the CSS file and
 * guess the system": a CSS file has every value the site ever declared; the
 * computed DOM has the values that actually paint. Frequency separates the
 * system from the one-offs.
 *
 * Run post-hoc in the page (any browser eval tool or Playwright
 * page.evaluate) after the page has settled. Run it ONCE PER BREAKPOINT
 * (1440 / 768 / 390) — the type scale and spacing change; the palette usually
 * doesn't. Save to output/<hostname>/tokens-<width>.json.
 *
 * Nothing here mutates the page.
 */
function tokensProbe(opts) {
  const o = Object.assign({ maxElements: 6000, minCount: 2 }, opts || {});
  const W = window, D = document;
  const out = {
    url: location.href,
    viewport: { w: W.innerWidth, h: W.innerHeight, dpr: W.devicePixelRatio },
    colors: {}, fonts: {}, fontFaces: [], typeScale: {}, lineHeights: {}, letterSpacing: {},
    spacing: {}, radii: {}, shadows: {}, zIndex: {}, gradients: {}, filters: {}, blendModes: {},
    maxWidths: {}, breakpoints: [], customProps: {}, body: {}, headings: {}, buttons: [], links: {},
    notes: [],
  };

  const bump = (map, key, meta) => {
    if (!key || key === 'none' || key === 'normal' || key === 'auto' || key === 'rgba(0, 0, 0, 0)') return;
    if (!map[key]) map[key] = { count: 0, where: new Set() };
    map[key].count++;
    if (meta && map[key].where.size < 3) map[key].where.add(meta);
  };
  const sel = (el) => {
    if (el.id) return '#' + el.id;
    const c = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + c;
  };
  const finalize = (map) =>
    Object.entries(map)
      .map(([value, v]) => ({ value, count: v.count, where: Array.from(v.where) }))
      .filter((x) => x.count >= o.minCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 40);

  // Visible-ish elements only: skip zero-size, hidden, script/style
  const all = Array.from(D.body.querySelectorAll('*')).filter((el) => {
    if (/^(SCRIPT|STYLE|META|LINK|NOSCRIPT|TEMPLATE|svg|path|g|defs)$/i.test(el.tagName)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (all.length > o.maxElements) out.notes.push(`sampled ${o.maxElements} of ${all.length} visible elements`);
  const els = all.slice(0, o.maxElements);

  const textTags = /^(H1|H2|H3|H4|H5|H6|P|A|SPAN|LI|BUTTON|LABEL|SMALL|STRONG|EM|BLOCKQUOTE|FIGCAPTION|TD|TH|DT|DD)$/;

  for (const el of els) {
    let cs;
    try { cs = getComputedStyle(el); } catch (_) { continue; }
    const s = sel(el);
    const hasText = textTags.test(el.tagName) && el.textContent.trim().length > 0;

    // Colors — text only counted on elements that actually have text
    if (hasText) bump(out.colors, cs.color, 'text ' + s);
    bump(out.colors, cs.backgroundColor, 'bg ' + s);
    if (cs.borderTopWidth !== '0px') bump(out.colors, cs.borderTopColor, 'border ' + s);
    if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) bump(out.gradients, cs.backgroundImage, s);

    // Type
    if (hasText) {
      bump(out.fonts, cs.fontFamily + ' / ' + cs.fontWeight, s);
      bump(out.typeScale, cs.fontSize + ' / ' + cs.lineHeight + ' / ' + cs.fontWeight, s);
      bump(out.lineHeights, cs.lineHeight, s);
      bump(out.letterSpacing, cs.letterSpacing, s);
      if (cs.textTransform !== 'none') bump(out.letterSpacing, 'transform:' + cs.textTransform, s);
    }

    // Spacing rhythm — paddings + margins + gaps as individual values
    for (const p of ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
      const v = cs[p];
      if (v && v !== '0px' && v !== 'normal' && !v.includes('-')) bump(out.spacing, v, p.replace(/(Top|Bottom|Left|Right)$/, '') + ' ' + s);
    }

    // Surfaces
    if (cs.borderTopLeftRadius !== '0px') bump(out.radii, cs.borderTopLeftRadius, s);
    if (cs.boxShadow !== 'none') bump(out.shadows, cs.boxShadow, s);
    if (cs.filter !== 'none') bump(out.filters, cs.filter, s);
    if (cs.backdropFilter && cs.backdropFilter !== 'none') bump(out.filters, 'backdrop:' + cs.backdropFilter, s);
    if (cs.mixBlendMode !== 'normal') bump(out.blendModes, cs.mixBlendMode, s);
    if (cs.zIndex !== 'auto' && (cs.position === 'fixed' || cs.position === 'sticky' || cs.position === 'absolute' || cs.position === 'relative'))
      bump(out.zIndex, cs.zIndex + ' (' + cs.position + ')', s);
    if (cs.maxWidth !== 'none' && cs.maxWidth.endsWith('px')) bump(out.maxWidths, cs.maxWidth, s);
  }

  // Body / headings / buttons — the anchor values, verbatim
  try {
    const b = getComputedStyle(D.body);
    out.body = { fontFamily: b.fontFamily, fontSize: b.fontSize, lineHeight: b.lineHeight, color: b.color, background: b.backgroundColor, letterSpacing: b.letterSpacing };
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'p']) {
      const el = D.querySelector(tag);
      if (!el) continue;
      const c = getComputedStyle(el);
      out.headings[tag] = { fontFamily: c.fontFamily, fontSize: c.fontSize, fontWeight: c.fontWeight, lineHeight: c.lineHeight, letterSpacing: c.letterSpacing, textTransform: c.textTransform, color: c.color, marginBottom: c.marginBottom };
    }
    const seenBtn = new Set();
    for (const el of Array.from(D.querySelectorAll('button, a[class*=btn], a[class*=button], [role=button], input[type=submit]')).slice(0, 60)) {
      const c = getComputedStyle(el);
      const key = [c.backgroundColor, c.color, c.borderRadius, c.padding, c.fontSize, c.fontWeight, c.borderTopColor].join('|');
      if (seenBtn.has(key)) continue;
      seenBtn.add(key);
      out.buttons.push({ example: sel(el), text: el.textContent.trim().slice(0, 30), background: c.backgroundColor, color: c.color, border: c.borderTopWidth + ' ' + c.borderTopStyle + ' ' + c.borderTopColor, radius: c.borderRadius, padding: c.padding, fontSize: c.fontSize, fontWeight: c.fontWeight, letterSpacing: c.letterSpacing, textTransform: c.textTransform, shadow: c.boxShadow, transition: c.transitionProperty + ' ' + c.transitionDuration + ' ' + c.transitionTimingFunction });
      if (out.buttons.length >= 8) break;
    }
    const a = D.querySelector('p a, li a, nav a');
    if (a) { const c = getComputedStyle(a); out.links = { color: c.color, decoration: c.textDecorationLine, weight: c.fontWeight }; }
  } catch (_) {}

  // @font-face sources + what actually loaded
  try {
    for (const ss of Array.from(D.styleSheets)) {
      let rules; try { rules = ss.cssRules; } catch (_) { out.notes.push('cross-origin stylesheet (no @font-face read): ' + ss.href); continue; }
      const walk = (list) => {
        for (const r of Array.from(list)) {
          if (r.type === CSSRule.FONT_FACE_RULE) {
            const st = r.style;
            out.fontFaces.push({ family: st.getPropertyValue('font-family').replace(/["']/g, ''), weight: st.getPropertyValue('font-weight'), style: st.getPropertyValue('font-style'), display: st.getPropertyValue('font-display'), src: st.getPropertyValue('src').slice(0, 400), sheet: ss.href || 'inline' });
          } else if (r.cssRules && (r.type === CSSRule.MEDIA_RULE || r.type === CSSRule.SUPPORTS_RULE)) walk(r.cssRules);
          if (r.type === CSSRule.MEDIA_RULE && /width/.test(r.conditionText || r.media.mediaText)) {
            const m = (r.conditionText || r.media.mediaText).match(/(\d+(?:\.\d+)?)(px|em|rem)/g);
            if (m) out.breakpoints.push(...m);
          }
        }
      };
      walk(rules);
    }
    out.breakpoints = Array.from(new Set(out.breakpoints)).sort((a, b) => parseFloat(a) - parseFloat(b));
    if (D.fonts) {
      out.loadedFonts = [];
      D.fonts.forEach((f) => { if (f.status === 'loaded') out.loadedFonts.push(f.family.replace(/["']/g, '') + ' ' + f.weight + ' ' + f.style); });
      out.loadedFonts = Array.from(new Set(out.loadedFonts));
    }
    // Google Fonts / external font links
    out.fontLinks = Array.from(D.querySelectorAll('link[href*="fonts.googleapis"], link[href*="typekit"], link[href*="fonts.bunny"], link[as=font]')).map((l) => l.href);
  } catch (e) { out.notes.push('font probe error: ' + e.message); }

  // :root custom properties — the site's own token names, if it has them
  try {
    const cs = getComputedStyle(D.documentElement);
    for (const ss of Array.from(D.styleSheets)) {
      let rules; try { rules = ss.cssRules; } catch (_) { continue; }
      for (const r of Array.from(rules)) {
        if (r.selectorText === ':root' || r.selectorText === 'html' || r.selectorText === 'body') {
          for (const p of Array.from(r.style)) if (p.startsWith('--')) out.customProps[p] = cs.getPropertyValue(p).trim();
        }
      }
    }
  } catch (_) {}

  // Page-level: scroll height, sections, fixed chrome
  try {
    out.page = {
      scrollHeight: D.documentElement.scrollHeight,
      sections: Array.from(D.querySelectorAll('main > *, body > section, section, [class*=section]')).filter((s) => s.getBoundingClientRect().height > 120).slice(0, 40).map((s) => { const r = s.getBoundingClientRect(); return { selector: sel(s), top: Math.round(r.top + W.scrollY), height: Math.round(r.height), background: getComputedStyle(s).backgroundColor }; }),
      fixed: Array.from(D.querySelectorAll('*')).filter((e) => { const p = getComputedStyle(e).position; return p === 'fixed' || p === 'sticky'; }).slice(0, 20).map((e) => { const r = e.getBoundingClientRect(); return { selector: sel(e), position: getComputedStyle(e).position, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], z: getComputedStyle(e).zIndex }; }),
    };
  } catch (_) {}

  for (const k of ['colors', 'fonts', 'typeScale', 'lineHeights', 'letterSpacing', 'spacing', 'radii', 'shadows', 'zIndex', 'gradients', 'filters', 'blendModes', 'maxWidths']) out[k] = finalize(out[k]);

  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tokensProbe };
}
