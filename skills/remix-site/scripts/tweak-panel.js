/**
 * tweak-panel.js — live knobs for a remixed site. Dev-only; strip from prod.
 *
 * Usage (in main.ts, after remix-loader):
 *   import { mountTweakPanel } from './remix/tweak-panel.js';
 *   import panel from '../remix/panel.json';
 *   if (import.meta.env.DEV) mountTweakPanel(panel);
 *
 * panel.json:
 *   { "title": "...", "slug": "<direction>",            // slug: only mount when this direction is active (optional)
 *     "presets": { "name": { "<knob id>": value, ... } },  // one-click states layered on the direction
 *     "knobs": [
 *       { "id": "--rx-color-1", "label": "Accent", "group": "Color", "type": "color", "default": "#1f3bff" },
 *       { "id": "--p-h1-scale", "label": "Display scale", "group": "Type", "type": "number", "default": 1, "min": .7, "max": 1.6, "step": .02 },
 *       { "id": "--p-radius", "label": "Radius", "group": "Space", "type": "length", "default": "0px", "min": 0, "max": 24, "step": 1, "unit": "px" },
 *       { "id": "motion.reveal.duration", "label": "Reveal", "group": "Motion", "type": "number", "default": .7, "min": .1, "max": 2, "step": .05 },
 *       { "id": "shaders.hero.colorFront", "label": "Paper tint", "group": "GPU", "type": "color", "default": "#9FADBC" },
 *       { "id": "--font-sans", "label": "Body face", "group": "Type", "type": "select", "options": [...], "labels": [...], "default": "..." } ] }
 *
 * Knob ids starting with "--" are CSS custom properties (set live on :root).
 * Dotted ids are paths into window.__remix (motion.* / shaders.*); the panel
 * calls __remix.apply({motion:{...}}) and dispatches 'rx:change' so behaviors
 * and shader mounts re-read. State lives in location.hash as #rx=<b64 json>
 * → any URL is a permalink. ` toggles, / focuses search. Copy JSON exports an
 * overrides file you can feed back to apply-overrides.js as a new direction.
 */
export function mountTweakPanel(config) {
  const rx = window.__remix || (window.__remix = { apply() {} });
  if (config.slug && rx.slug && rx.slug !== config.slug) return null;
  const knobs = config.knobs || [];
  const presets = config.presets || {};
  const state = {};

  /* ---- state ---- */
  const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  const read = () => { try { const m = location.hash.match(/rx=([A-Za-z0-9_-]+)/); return m ? JSON.parse(unb64(m[1])) : {}; } catch { return {}; } };
  const write = () => { history.replaceState(null, '', location.pathname + location.search + (Object.keys(state).length ? '#rx=' + b64(JSON.stringify(state)) : '')); };
  const setPath = (obj, dotted, v) => { const p = dotted.split('.'); let o = obj; for (let i = 0; i < p.length - 1; i++) o = o[p[i]] = o[p[i]] || {}; o[p[p.length - 1]] = v; return obj; };
  const applyOne = (k, v) => {
    if (k.id.startsWith('--')) document.documentElement.style.setProperty(k.id, typeof v === 'number' && k.unit ? v + k.unit : String(v));
    else rx.apply(setPath({}, k.id, v));
  };
  const set = (k, v, persist = true) => { if (v === k.default) delete state[k.id]; else state[k.id] = v; applyOne(k, v); if (persist) write(); };

  /* ---- UI ---- */
  const css = `
    #rx-panel{--w:320px;position:fixed;top:12px;right:12px;z-index:2147483000;width:var(--w);max-height:calc(100vh - 24px);display:flex;flex-direction:column;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8e8e8;background:rgba(14,14,16,.95);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.12);border-radius:10px;box-shadow:0 24px 60px -20px rgba(0,0,0,.6)}
    #rx-panel[hidden]{display:none}
    #rx-panel header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1)}
    #rx-panel header b{font-weight:600;letter-spacing:.02em} #rx-panel header span{opacity:.5;font-size:10px;margin-left:auto;white-space:nowrap}
    #rx-panel .tools{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.08);flex-wrap:wrap}
    #rx-panel .tools input[type=search]{flex:1;min-width:90px;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.12);border-radius:5px;padding:4px 7px;font:inherit}
    #rx-panel .tools select{background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.12);border-radius:5px;padding:4px 6px;font:inherit;max-width:120px}
    #rx-panel .body{overflow:auto;flex:1}
    #rx-panel details{border-bottom:1px solid rgba(255,255,255,.06)}
    #rx-panel summary{cursor:pointer;padding:8px 12px;opacity:.7;text-transform:uppercase;letter-spacing:.08em;font-size:10px;user-select:none;display:flex;justify-content:space-between}
    #rx-panel summary i{font-style:normal;opacity:.6}
    #rx-panel label{display:grid;grid-template-columns:1fr 112px;align-items:center;gap:8px;padding:5px 12px} #rx-panel label.hide{display:none}
    #rx-panel label small{opacity:.5;display:block;font-size:9.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #rx-panel label.dirty > div:first-child{color:#9fe1ff}
    #rx-panel input[type=range]{width:100%;accent-color:#9fe1ff}
    #rx-panel input[type=color]{width:100%;height:24px;border:0;background:none;padding:0;cursor:pointer}
    #rx-panel input[type=text],#rx-panel input[type=number],#rx-panel label select{width:100%;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.12);border-radius:4px;padding:3px 6px;font:inherit}
    #rx-panel .val{opacity:.6;font-size:10px;text-align:right;font-variant-numeric:tabular-nums}
    #rx-panel .range-row{display:grid;grid-template-columns:1fr 48px;gap:6px;align-items:center}
    #rx-panel footer{display:flex;gap:6px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.1);flex-wrap:wrap}
    #rx-panel footer button,#rx-panel .tools button{flex:1;background:rgba(255,255,255,.08);color:inherit;border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:6px 8px;font:inherit;cursor:pointer;white-space:nowrap}
    #rx-panel footer button:hover,#rx-panel .tools button:hover{background:rgba(255,255,255,.14)}
    #rx-panel .grip{position:absolute;left:-6px;top:0;bottom:0;width:12px;cursor:ew-resize}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const el = document.createElement('aside'); el.id = 'rx-panel';
  el.innerHTML = `<div class="grip"></div><header><b>${config.title || 'Tweaks'}</b><span>${rx.slug || 'base'} · ${knobs.length} knobs · \` toggle</span></header>`;

  // tools: search, presets, collapse, randomize
  const tools = document.createElement('div'); tools.className = 'tools';
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'filter knobs  ( / )';
  const presetSel = document.createElement('select'); presetSel.innerHTML = '<option value="">presets…</option>' + Object.keys(presets).map((p) => `<option>${p}</option>`).join('');
  const collapse = document.createElement('button'); collapse.textContent = 'collapse';
  const rnd = document.createElement('button'); rnd.textContent = 'shuffle'; rnd.title = 'randomize every knob within its range (colors stay)';
  tools.append(search, presetSel, collapse, rnd); el.appendChild(tools);

  const body = document.createElement('div'); body.className = 'body'; el.appendChild(body);
  const groups = [...new Set(knobs.map((k) => k.group || 'Knobs'))];
  const inputs = new Map();
  const num = (v) => (typeof v === 'number' ? v : parseFloat(v));
  const unitOf = (k) => k.unit ?? (k.type === 'length' ? String(k.default).replace(/[\d.\-]/g, '') || 'px' : '');
  const show = (e, v) => { const { k, input, val, lab } = e; if (input.type === 'color') input.value = toHex(v); else if (input.type === 'range') input.value = num(v); else input.value = String(v); if (val) val.textContent = v; lab.classList.toggle('dirty', v !== k.default); };
  for (const g of groups) {
    const d = document.createElement('details'); d.open = true;
    const items = knobs.filter((x) => (x.group || 'Knobs') === g);
    d.innerHTML = `<summary>${g}<i>${items.length}</i></summary>`;
    for (const k of items) {
      const lab = document.createElement('label'); lab.dataset.q = (k.label + ' ' + k.id + ' ' + g).toLowerCase();
      lab.innerHTML = `<div>${k.label || k.id}<small title="${k.id}">${k.id}</small></div>`;
      const cell = document.createElement('div'); let input, val;
      if (k.type === 'color') { input = document.createElement('input'); input.type = 'color'; input.oninput = () => set(k, input.value); }
      else if (k.type === 'length' || k.type === 'number') {
        cell.className = 'range-row';
        input = document.createElement('input'); input.type = 'range'; input.min = k.min ?? 0; input.max = k.max ?? 100; input.step = k.step ?? 1;
        val = document.createElement('div'); val.className = 'val';
        const unit = unitOf(k);
        input.oninput = () => { const v = k.type === 'length' ? `${input.value}${unit}` : +input.value; val.textContent = v; set(k, v); lab.classList.toggle('dirty', v !== k.default); };
        val.ondblclick = () => { const n = prompt(k.label, String(state[k.id] ?? k.default)); if (n != null) { const v = k.type === 'length' ? (/[a-z%]$/i.test(n) ? n : n + unit) : +n; set(k, v); show(inputs.get(k.id), v); } };
        cell.append(input, val);
      }
      else if (k.type === 'select') { input = document.createElement('select'); (k.options || []).forEach((o, i) => { const op = document.createElement('option'); op.value = o; op.textContent = (k.labels || [])[i] || o; input.appendChild(op); }); input.onchange = () => set(k, input.value); }
      else { input = document.createElement('input'); input.type = 'text'; input.onchange = () => set(k, input.value); }
      if (!cell.className) cell.appendChild(input);
      lab.appendChild(cell); d.appendChild(lab);
      const e = { k, input, val, lab }; inputs.set(k.id, e); show(e, k.default);
      lab.oncontextmenu = (ev) => { ev.preventDefault(); set(k, k.default); show(e, k.default); };
    }
    body.appendChild(d);
  }

  const foot = document.createElement('footer');
  const btn = (t, fn, title) => { const b = document.createElement('button'); b.textContent = t; b.title = title || ''; b.onclick = fn; foot.appendChild(b); return b; };
  const exportJson = () => { const o = { name: (config.slug || config.title || 'tweak') + '-' + Date.now().toString(36), thesis: 'exported from tweak panel', tokens: {}, motion: {}, shaders: {} };
    for (const [id, v] of Object.entries(state)) { if (id.startsWith('--')) o.tokens[id] = v; else setPath(o, id, v); } return JSON.stringify(o, null, 2); };
  btn('Copy JSON', () => { navigator.clipboard?.writeText(exportJson()); flash('copied JSON'); }, 'overrides file for apply-overrides.js');
  btn('Copy link', () => { navigator.clipboard?.writeText(location.href); flash('link copied'); }, 'permalink with this state');
  btn('Reset', () => { for (const id of Object.keys(state)) delete state[id]; for (const e of inputs.values()) { applyOne(e.k, e.k.default); show(e, e.k.default); } write(); flash('reset'); });
  el.appendChild(foot); document.body.appendChild(el);
  const flash = (t) => { const h = el.querySelector('header span'); const old = h.textContent; h.textContent = t; setTimeout(() => (h.textContent = old), 900); };

  // tools behavior
  search.oninput = () => { const q = search.value.trim().toLowerCase(); el.querySelectorAll('label').forEach((l) => l.classList.toggle('hide', !!q && !l.dataset.q.includes(q))); };
  collapse.onclick = () => { const open = [...el.querySelectorAll('details')].some((d) => d.open); el.querySelectorAll('details').forEach((d) => (d.open = !open)); collapse.textContent = open ? 'expand' : 'collapse'; };
  presetSel.onchange = () => { const p = presets[presetSel.value]; if (!p) return; for (const e of inputs.values()) { const v = p[e.k.id] ?? e.k.default; set(e.k, v, false); show(e, v); } write(); flash('preset: ' + presetSel.value); presetSel.value = ''; };
  rnd.onclick = () => { for (const e of inputs.values()) { const k = e.k; let v; if (k.type === 'number' || k.type === 'length') { const lo = k.min ?? 0, hi = k.max ?? 100, st = k.step ?? 1; const r = lo + Math.round(Math.random() * ((hi - lo) / st)) * st; v = k.type === 'length' ? `${+r.toFixed(3)}${unitOf(k)}` : +r.toFixed(3); } else if (k.type === 'select') v = k.options[Math.floor(Math.random() * k.options.length)]; else continue; set(e.k, v, false); show(e, v); } write(); flash('shuffled'); };
  // resize grip
  const grip = el.querySelector('.grip'); let drag = null;
  grip.onmousedown = (e) => { drag = { x: e.clientX, w: el.offsetWidth }; e.preventDefault(); };
  window.addEventListener('mousemove', (e) => { if (drag) el.style.setProperty('--w', Math.max(260, Math.min(640, drag.w + (drag.x - e.clientX))) + 'px'); });
  window.addEventListener('mouseup', () => (drag = null));

  /* ---- restore from URL ---- */
  Object.assign(state, read());
  for (const [id, v] of Object.entries(state)) { const e = inputs.get(id); if (!e) continue; applyOne(e.k, v); show(e, v); }

  window.addEventListener('keydown', (e) => {
    const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '');
    if (e.key === '`' && !typing) el.hidden = !el.hidden;
    if (e.key === '/' && !typing) { e.preventDefault(); el.hidden = false; search.focus(); }
  });
  return { state, el, set: (id, v) => { const e = inputs.get(id); if (e) { set(e.k, v); show(e, v); } } };
}

function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + [...c.slice(1)].map((x) => x + x).join('');
  const m = String(c).match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/); if (!m) return '#000000';
  return '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('');
}
