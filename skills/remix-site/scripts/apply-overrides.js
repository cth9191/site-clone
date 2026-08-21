#!/usr/bin/env node
/*
 * apply-overrides.js — materialize a direction (or panel export) into the site.
 *
 *   node apply-overrides.js <site-dir> <overrides.json> [--activate]
 *
 * overrides.json:
 *   { "name": "editorial-quiet", "thesis": "...",
 *     "tokens":  { "--rx-color-1": "#…", "--rx-font-1": "…" },
 *     "motion":  { "reveal": { "y": 22, "duration": .7, "ease": [.16,1,.3,1] }, "stagger": .08 },
 *     "shaders": { "hero": { "colorFront": "#…" } },
 *     "assets":  { "hero-bg": "remix/generated/editorial-hero.jpg" } }
 *
 * Writes into <site>/src/remix/:
 *   tokens.<slug>.css      :root overrides (only the keys given)
 *   motion.<slug>.js       `window.__remix.motion` / `.shaders` patch
 *   directions.json        registry of all slugs (for ?rx=<slug> switching)
 * and, for "assets", copies files into <site>/public/assets/remix/<slug>/ and
 * records the mapping so the loader can swap <img src> / shader image props.
 *
 * The site loads the active direction with the tiny runtime in remix-loader.js
 * (written here too, once): reads ?rx=<slug> or #rx=<state>, injects the CSS,
 * applies motion/shader patches, swaps assets. Default = base.
 */
const fs = require('fs'), path = require('path');
const [,, siteDir, ovPath, ...flags] = process.argv;
if (!siteDir || !ovPath) { console.error('usage: apply-overrides.js <site-dir> <overrides.json> [--activate]'); process.exit(1); }
const ov = JSON.parse(fs.readFileSync(ovPath, 'utf8'));
const slug = (ov.name || path.basename(ovPath, '.json')).toLowerCase().replace(/[^a-z0-9]+/g, '-');
const out = path.join(siteDir, 'src', 'remix'); fs.mkdirSync(out, { recursive: true });

// tokens
const tokens = ov.tokens || {};
fs.writeFileSync(path.join(out, `tokens.${slug}.css`), `/* direction: ${slug} — ${ov.thesis || ''} */\n:root[data-rx="${slug}"] {\n${Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`);

// assets
const assetMap = {};
for (const [key, src] of Object.entries(ov.assets || {})) {
  const dest = path.join(siteDir, 'public', 'assets', 'remix', slug, path.basename(src));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(src)) fs.copyFileSync(src, dest); else console.warn('asset missing:', src);
  assetMap[key] = `/assets/remix/${slug}/${path.basename(src)}`;
}

// optional patch layers (medium: css, big: js) — picked up if they sit next to the JSON
const patchCss = ovPath.replace(/\.json$/, '.patch.css'), patchJs = ovPath.replace(/\.json$/, '.patch.js');
const hasCss = fs.existsSync(patchCss), hasJs = fs.existsSync(patchJs);
if (hasCss) fs.writeFileSync(path.join(out, `patch.${slug}.css`), fs.readFileSync(patchCss, 'utf8'));
if (hasJs) fs.writeFileSync(path.join(out, `patch.${slug}.js`), fs.readFileSync(patchJs, 'utf8'));

// motion / shaders patch
fs.writeFileSync(path.join(out, `motion.${slug}.js`), `// direction: ${slug}\nexport default ${JSON.stringify({ motion: ov.motion || {}, shaders: ov.shaders || {}, assets: assetMap }, null, 1)};\n`);

// registry
const regPath = path.join(out, 'directions.json');
const reg = fs.existsSync(regPath) ? JSON.parse(fs.readFileSync(regPath, 'utf8')) : { active: 'base', directions: {} };
reg.directions[slug] = { name: ov.name || slug, thesis: ov.thesis || '', amplitude: ov.amplitude || (hasJs ? 'big' : hasCss ? 'medium' : 'subtle'), tokens: `./tokens.${slug}.css`, motion: `./motion.${slug}.js`, patchCss: hasCss ? `./patch.${slug}.css` : null, patchJs: hasJs ? `./patch.${slug}.js` : null, assets: assetMap };
if (flags.includes('--activate')) reg.active = slug;
fs.writeFileSync(regPath, JSON.stringify(reg, null, 1));

// loader (idempotent)
const loader = path.join(out, 'remix-loader.ts');
if (!fs.existsSync(loader)) fs.writeFileSync(loader, `/**
 * remix-loader — picks the active direction and applies it before the page paints.
 * Order: ?rx=<slug> → localStorage rx → directions.json active → 'base'.
 * Exposes window.__remix = { slug, motion, shaders, assets, apply(patch) }.
 * Import this FIRST in main.ts. Behaviors read window.__remix.motion; shader
 * mounts read window.__remix.shaders; <img data-rx-asset="hero-bg"> gets swapped.
 */
import registry from './directions.json';
const tokenSheets = import.meta.glob('./tokens.*.css', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;
const motionMods = import.meta.glob('./motion.*.js', { import: 'default', eager: true }) as Record<string, any>;
const patchSheets = import.meta.glob('./patch.*.css', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;
const patchMods = import.meta.glob('./patch.*.js', { import: 'default', eager: true }) as Record<string, any>;

const params = new URLSearchParams(location.search);
const slug = params.get('rx') || localStorage.getItem('rx') || (registry as any).active || 'base';
const rx: any = { slug, motion: {}, shaders: {}, assets: {}, patches: [] as any[] };
(window as any).__remix = rx;
document.documentElement.dataset.rx = slug;

if (slug !== 'base') {
  const css = tokenSheets[\`./tokens.\${slug}.css\`];
  if (css) { const st = document.createElement('style'); st.id = 'rx-tokens'; st.textContent = css; document.head.appendChild(st); }
  const m = motionMods[\`./motion.\${slug}.js\`];
  if (m) { rx.motion = m.motion || {}; rx.shaders = m.shaders || {}; rx.assets = m.assets || {}; }
  for (const [key, url] of Object.entries(rx.assets)) document.querySelectorAll<HTMLImageElement>(\`[data-rx-asset="\${key}"]\`).forEach((img) => { img.src = url as string; img.removeAttribute('srcset'); });
  // medium: scoped CSS patch (surface / density / type scale)
  const pc = patchSheets[\`./patch.\${slug}.css\`];
  if (pc) { const st = document.createElement('style'); st.id = 'rx-patch'; st.textContent = pc; document.head.appendChild(st); }
  // big: structural DOM patch — export default function (rx) { ... }
  const pj = patchMods[\`./patch.\${slug}.js\`];
  if (typeof pj === 'function') { const run = () => pj(rx); document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', run) : run(); }
}
// live patch API used by the tweak panel: { tokens?, motion?, shaders? }
rx.apply = (patch: any) => {
  for (const [k, v] of Object.entries(patch.tokens || {})) document.documentElement.style.setProperty(k, v as string);
  Object.assign(rx.motion, patch.motion || {}); Object.assign(rx.shaders, patch.shaders || {});
  rx.patches.push(patch); window.dispatchEvent(new CustomEvent('rx:change', { detail: patch }));
};
export default rx;
`);

console.log(`direction "${slug}" → ${out}/tokens.${slug}.css, motion.${slug}.js; registry active=${reg.active}; assets: ${Object.keys(assetMap).length}`);
console.log(`view: ?rx=${slug}`);
