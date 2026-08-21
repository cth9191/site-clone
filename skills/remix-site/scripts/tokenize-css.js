#!/usr/bin/env node
/*
 * tokenize-css.js — make a cloned stylesheet variable-driven.
 *
 *   node tokenize-css.js <input.css> <tokens.json> <out-dir>
 *
 * Reads the measured tokens (from clone-site's tokens-probe) and rewrites the
 * CSS so each token's literal value goes through `var(--rx-<role>, <literal>)`.
 * Writes:
 *   <out-dir>/<input-basename>.tokenized.css   the rewritten stylesheet
 *   <out-dir>/remix-tokens.css                 :root defaults (the direction "base")
 *   <out-dir>/../remix/knobs.json              the knob list for directions + panel
 *
 * Role naming: colors become --rx-color-<n> ranked by usage, with the body
 * text / page bg / accent detected and named; font families --rx-font-<n>;
 * the most common font sizes --rx-size-<n>; spacing values --rx-space-<n>;
 * radii --rx-radius-<n>; shadows --rx-shadow-<n>. If the site already defines
 * custom properties (tokens.customProps), those are NOT rewritten — they're
 * listed as knobs under their own names so the site's vocabulary is kept.
 *
 * Conservative on purpose: only exact literal matches are replaced, color
 * matches are case-insensitive and cover hex/rgb()/rgba() spellings of the
 * same value, and values inside url(...) or @font-face are left alone.
 */
const fs = require('fs'), path = require('path');
const [,, cssPath, tokensPath, outDir] = process.argv;
if (!cssPath || !tokensPath || !outDir) { console.error('usage: tokenize-css.js <input.css> <tokens.json> <out-dir>'); process.exit(1); }

const css = fs.readFileSync(cssPath, 'utf8');
const t = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const remixDir = path.join(outDir, '..', 'remix'); fs.mkdirSync(remixDir, { recursive: true });

/* ---------- color normalization ---------- */
function parseColor(s) {
  s = s.trim().toLowerCase();
  let m;
  if ((m = s.match(/^#([0-9a-f]{3})$/))) return [...m[1]].map((c) => parseInt(c + c, 16)).concat([1]);
  if ((m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/))) { const h = m[1]; return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat([m[2] ? parseInt(m[2], 16) / 255 : 1]); }
  if ((m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/))) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
  if ((m = s.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.%]+))?\s*\)$/))) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]];
  return null;
}
const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const spellings = (rgba) => {
  const [r, g, b, a] = rgba.map((v, i) => (i < 3 ? Math.round(v) : v));
  const out = [`rgb(${r}, ${g}, ${b})`, `rgb(${r},${g},${b})`, hex(rgba)];
  const h = hex(rgba); if (/^#(.)\1(.)\2(.)\3$/.test(h)) out.push('#' + h[1] + h[3] + h[5]);
  if (a !== 1) return [`rgba(${r}, ${g}, ${b}, ${a})`, `rgba(${r},${g},${b},${a})`];
  return out.concat([`rgba(${r}, ${g}, ${b}, 1)`]);
};

/* ---------- pick roles ---------- */
const knobs = [];
const vars = {}; // name -> default literal
const rewrite = []; // [regex, replacement]
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// colors
const colors = (t.colors || []).map((c) => ({ ...c, rgba: parseColor(c.value) })).filter((c) => c.rgba);
const bodyBg = parseColor(t.body?.background || '') , bodyFg = parseColor(t.body?.color || '');
const same = (a, b) => a && b && a.slice(0, 3).every((v, i) => Math.round(v) === Math.round(b[i]));
let ci = 0;
for (const c of colors.slice(0, 14)) {
  let role = `color-${++ci}`;
  if (same(c.rgba, bodyFg)) role = 'color-text';
  else if (same(c.rgba, bodyBg)) role = 'color-bg';
  const name = `--rx-${role}`;
  vars[name] = hex(c.rgba) + (c.rgba[3] !== 1 ? '' : '');
  const lit = c.rgba[3] === 1 ? hex(c.rgba) : spellings(c.rgba)[0];
  vars[name] = lit;
  knobs.push({ id: name, group: 'Color', type: 'color', default: lit, uses: c.count, where: c.where });
  for (const sp of spellings(c.rgba)) rewrite.push([new RegExp(`(?<![\\w-])${esc(sp)}(?![\\w-])`, 'gi'), `var(${name}, ${lit})`]);
}
// fonts (family stacks)
const fams = new Map();
for (const f of t.fonts || []) { const fam = f.value.split(' / ')[0]; fams.set(fam, (fams.get(fam) || 0) + f.count); }
let fi = 0;
for (const [fam, count] of [...fams.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
  const name = `--rx-font-${++fi}`; vars[name] = fam;
  knobs.push({ id: name, group: 'Type', type: 'font', default: fam, uses: count });
  rewrite.push([new RegExp(`font-family:\\s*${esc(fam)}`, 'g'), `font-family: var(${name}, ${fam})`]);
}
// sizes
let si = 0;
for (const s of (t.typeScale || []).slice(0, 8)) {
  const px = s.value.split(' / ')[0]; if (!/px$/.test(px)) continue;
  const name = `--rx-size-${++si}`; vars[name] = px;
  knobs.push({ id: name, group: 'Type', type: 'length', default: px, min: 8, max: 160, step: 0.5, uses: s.count, where: s.where });
  rewrite.push([new RegExp(`font-size:\\s*${esc(px)}(?![\\d.])`, 'g'), `font-size: var(${name}, ${px})`]);
}
// spacing
let pi = 0;
for (const s of (t.spacing || []).slice(0, 8)) {
  const name = `--rx-space-${++pi}`; vars[name] = s.value;
  knobs.push({ id: name, group: 'Space', type: 'length', default: s.value, min: 0, max: 256, step: 1, uses: s.count });
  rewrite.push([new RegExp(`(padding|margin|gap|row-gap|column-gap)(-[a-z]+)?:\\s*${esc(s.value)}(?![\\d.])`, 'g'), `$1$2: var(${name}, ${s.value})`]);
}
// radii + shadows
let ri = 0; for (const r of (t.radii || []).slice(0, 3)) { const name = `--rx-radius-${++ri}`; vars[name] = r.value; knobs.push({ id: name, group: 'Space', type: 'length', default: r.value, min: 0, max: 64, step: 1 }); rewrite.push([new RegExp(`border-radius:\\s*${esc(r.value)}(?![\\d.%])`, 'g'), `border-radius: var(${name}, ${r.value})`]); }
let shi = 0; for (const s of (t.shadows || []).slice(0, 2)) { const name = `--rx-shadow-${++shi}`; vars[name] = s.value; knobs.push({ id: name, group: 'Color', type: 'text', default: s.value }); rewrite.push([new RegExp(`box-shadow:\\s*${esc(s.value)}`, 'g'), `box-shadow: var(${name}, ${s.value})`]); }
// site's own custom props → knobs under their own names (not rewritten)
for (const [k, v] of Object.entries(t.customProps || {})) {
  const isColor = !!parseColor(v), isLen = /^-?[\d.]+(px|rem|em|vw|vh)$/.test(v);
  knobs.push({ id: k, group: isColor ? 'Color' : isLen ? 'Space' : 'Site', type: isColor ? 'color' : isLen ? 'length' : 'text', default: v, native: true });
}

/* ---------- rewrite, protecting url() and @font-face ---------- */
const protectedBlocks = [];
let work = css.replace(/@font-face\s*\{[^}]*\}|url\([^)]*\)/g, (m) => { protectedBlocks.push(m); return `__RXP__${protectedBlocks.length - 1}__RXP__`; });
let replaced = 0;
// Only rewrite inside declaration blocks — never in selectors. Tailwind's
// arbitrary-value classes (.text-\[\#e0a24a\]) carry the same literal in the
// selector, and rewriting there silently breaks the rule.
work = work.replace(/\{[^{}]*\}/g, (block) => {
  let b = block;
  for (const [re, rep] of rewrite) b = b.replace(re, (m) => { replaced++; return m.replace(re, rep); });
  return b;
});
work = work.replace(/__RXP__(\d+)__RXP__/g, (_, i) => protectedBlocks[+i]);

const base = path.basename(cssPath, '.css');
fs.writeFileSync(path.join(outDir, `${base}.tokenized.css`), work);
fs.writeFileSync(path.join(outDir, 'remix-tokens.css'), `/* remix base — generated by tokenize-css.js; directions override these */\n:root {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`);
fs.writeFileSync(path.join(remixDir, 'knobs.json'), JSON.stringify({ generatedFrom: path.basename(tokensPath), knobs }, null, 1));
console.log(`${replaced} replacements, ${Object.keys(vars).length} vars, ${knobs.length} knobs → ${outDir}/${base}.tokenized.css, remix-tokens.css, ${remixDir}/knobs.json`);
console.log('next: import remix-tokens.css BEFORE the tokenized stylesheet; verify 0% diff vs the untokenized build.');
