#!/usr/bin/env node
/*
 * gallery.js — write <site>/directions.html: the three directions LIVE, side
 * by side, in iframes of the dev server (real shaders, real motion), with
 * synced scrolling, a fullscreen click-through, and a "pick" button that
 * records the choice. Run after apply-overrides.js; served by Vite as a page.
 *
 *   node gallery.js <site-dir> [--title "Acme directions"]
 */
const fs = require('fs'), path = require('path');
const [,, siteDir, ...rest] = process.argv;
if (!siteDir) { console.error('usage: gallery.js <site-dir>'); process.exit(1); }
const title = (rest.indexOf('--title') >= 0 ? rest[rest.indexOf('--title') + 1] : null) || 'Directions';
const reg = JSON.parse(fs.readFileSync(path.join(siteDir, 'src', 'remix', 'directions.json'), 'utf8'));
const dirs = Object.entries(reg.directions);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box} html,body{margin:0;height:100%;background:#0c0c0e;color:#eee;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
  header{display:flex;align-items:center;gap:16px;padding:10px 16px;border-bottom:1px solid #222;position:sticky;top:0;background:#0c0c0e;z-index:5}
  header b{font-size:14px} header .sp{flex:1} header label{display:flex;gap:6px;align-items:center;opacity:.8;cursor:pointer}
  main{display:grid;grid-template-columns:repeat(${dirs.length},1fr);gap:10px;padding:10px;height:calc(100% - 45px)}
  .col{display:flex;flex-direction:column;min-width:0;border:1px solid #222;border-radius:8px;overflow:hidden;background:#000}
  .bar{display:flex;align-items:center;gap:10px;padding:8px 10px;background:#141416;border-bottom:1px solid #222}
  .bar .name{font-weight:600} .bar .thesis{opacity:.6;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
  .bar button,header button{background:#222;color:#eee;border:1px solid #333;border-radius:5px;padding:4px 9px;font:inherit;cursor:pointer} .bar button:hover{background:#2c2c30}
  .bar button.pick{background:#2f6df6;border-color:#2f6df6} .bar button.pick.on{background:#1db472;border-color:#1db472}
  .frame{flex:1;position:relative;background:#000} iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
  body.full main{grid-template-columns:1fr} body.full .col:not(.active){display:none}
  .hint{opacity:.5}
</style></head><body>
<header><b>${title}</b><span class="hint">${dirs.length} directions · click a name to go fullscreen · Esc back</span><span class="sp"></span>
  <label><input type="checkbox" id="sync" checked> sync scroll</label>
  <label><input type="checkbox" id="shaders" checked> shaders</label>
  <button id="reload">reload</button></header>
<main>
${dirs.map(([slug, d]) => `  <section class="col" data-slug="${slug}">
    <div class="bar"><button class="name" data-full="${slug}">${d.name || slug}</button><span class="thesis" title="${(d.thesis || '').replace(/"/g, '&quot;')}">${d.thesis || ''}</span><button class="pick" data-pick="${slug}">pick</button></div>
    <div class="frame"><iframe data-slug="${slug}" src="/?rx=${slug}&shaders=1" loading="eager"></iframe></div>
  </section>`).join('\n')}
</main>
<script>
  const frames = [...document.querySelectorAll('iframe')];
  const shaders = document.getElementById('shaders'), sync = document.getElementById('sync');
  const src = (s) => '/?rx=' + s + '&shaders=' + (shaders.checked ? 1 : 0);
  document.getElementById('reload').onclick = () => frames.forEach((f) => (f.src = src(f.dataset.slug)));
  shaders.onchange = () => document.getElementById('reload').onclick();
  // synced scroll (same-origin): mirror scrollTop ratio across frames
  let lock = false;
  frames.forEach((f) => f.addEventListener('load', () => {
    const w = f.contentWindow; if (!w) return;
    w.addEventListener('scroll', () => {
      if (!sync.checked || lock) return; lock = true;
      const d = w.document.documentElement, r = w.scrollY / Math.max(1, d.scrollHeight - w.innerHeight);
      for (const o of frames) if (o !== f && o.contentWindow) { const od = o.contentWindow.document.documentElement; o.contentWindow.scrollTo(0, r * (od.scrollHeight - o.contentWindow.innerHeight)); }
      requestAnimationFrame(() => (lock = false));
    }, { passive: true });
  }));
  // fullscreen click-through
  const full = (slug) => { document.body.classList.toggle('full', !!slug); document.querySelectorAll('.col').forEach((c) => c.classList.toggle('active', c.dataset.slug === slug)); };
  document.querySelectorAll('[data-full]').forEach((b) => (b.onclick = () => full(document.body.classList.contains('full') ? null : b.dataset.full)));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') full(null); });
  // pick → localStorage + POST-less marker the agent can read back
  const current = localStorage.getItem('rx-pick');
  document.querySelectorAll('[data-pick]').forEach((b) => { b.classList.toggle('on', b.dataset.pick === current); b.onclick = () => { localStorage.setItem('rx-pick', b.dataset.pick); document.querySelectorAll('[data-pick]').forEach((x) => x.classList.toggle('on', x === b)); b.textContent = 'picked'; setTimeout(() => (b.textContent = 'pick'), 900); }; });
</script></body></html>`;
fs.writeFileSync(path.join(siteDir, 'directions.html'), html);
console.log(`${path.join(siteDir, 'directions.html')} — open /directions.html on the dev server (${dirs.length} directions)`);
