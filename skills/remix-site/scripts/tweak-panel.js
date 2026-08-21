/**
 * tweak-panel.js — live knobs for a remixed site. Dev-only; strip from prod.
 *
 * Usage (in main.ts, after remix-loader):
 *   import { mountTweakPanel } from './remix/tweak-panel.js';
 *   import panel from '../../remix/panel.json';
 *   if (import.meta.env.DEV) mountTweakPanel(panel);
 *
 * panel.json:
 *   { "title": "Editorial Quiet", "knobs": [
 *       { "id": "--rx-color-1", "label": "Accent", "group": "Color", "type": "color", "default": "#1f3bff" },
 *       { "id": "--rx-size-1", "label": "Display size", "group": "Type", "type": "length", "default": "80px", "min": 40, "max": 140, "step": 1, "unit": "px" },
 *       { "id": "motion.reveal.duration", "label": "Reveal duration", "group": "Motion", "type": "number", "default": 0.7, "min": 0.1, "max": 2, "step": 0.05 },
 *       { "id": "shaders.hero.colorFront", "label": "Paper tint", "group": "GPU", "type": "color", "default": "#9FADBC" },
 *       { "id": "--rx-font-1", "label": "Display font", "group": "Type", "type": "select", "options": ["Inter", "Instrument Serif", "Geist Mono"], "default": "Inter" } ] }
 *
 * Knob ids starting with "--" are CSS custom properties (set live on :root).
 * Dotted ids are paths into window.__remix (motion.* / shaders.*); the panel
 * calls __remix.apply({motion:{...}}) and dispatches 'rx:change' so behaviors
 * and shader mounts can re-read. State lives in location.hash as #rx=<b64 json>
 * → any URL is a permalink. Toggle with the ` key. Copy JSON exports an
 * overrides file you can feed back to apply-overrides.js as a new direction.
 */
export function mountTweakPanel(config) {
  const rx = window.__remix || (window.__remix = { apply() {} });
  const knobs = config.knobs || [];
  const state = {};

  /* ---- state ---- */
  const read = () => { try { const m = location.hash.match(/rx=([A-Za-z0-9+/=_-]+)/); return m ? JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))) : {}; } catch { return {}; } };
  const write = () => { const s = btoa(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); history.replaceState(null, '', location.pathname + location.search + (Object.keys(state).length ? '#rx=' + s : '')); };
  const setPath = (obj, dotted, v) => { const p = dotted.split('.'); let o = obj; for (let i = 0; i < p.length - 1; i++) o = o[p[i]] = o[p[i]] || {}; o[p[p.length - 1]] = v; return obj; };
  const applyOne = (k, v) => {
    if (k.id.startsWith('--')) document.documentElement.style.setProperty(k.id, k.unit && typeof v === 'number' ? v + k.unit : v);
    else rx.apply(setPath({}, k.id, v));
  };
  const set = (k, v, persist = true) => { if (v === k.default) delete state[k.id]; else state[k.id] = v; applyOne(k, v); if (persist) write(); };

  /* ---- UI ---- */
  const css = `
    #rx-panel{position:fixed;top:12px;right:12px;z-index:2147483000;width:300px;max-height:calc(100vh - 24px);overflow:auto;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8e8e8;background:rgba(14,14,16,.94);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.12);border-radius:10px;box-shadow:0 24px 60px -20px rgba(0,0,0,.6)}
    #rx-panel[hidden]{display:none}
    #rx-panel header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1);position:sticky;top:0;background:inherit}
    #rx-panel header b{font-weight:600;letter-spacing:.02em}
    #rx-panel header span{opacity:.5}
    #rx-panel details{border-bottom:1px solid rgba(255,255,255,.06)}
    #rx-panel summary{cursor:pointer;padding:8px 12px;opacity:.7;text-transform:uppercase;letter-spacing:.08em;font-size:10px;user-select:none}
    #rx-panel label{display:grid;grid-template-columns:1fr 92px;align-items:center;gap:8px;padding:5px 12px}
    #rx-panel label small{opacity:.55;display:block;font-size:10px}
    #rx-panel input[type=range]{width:100%}
    #rx-panel input[type=color]{width:100%;height:24px;border:0;background:none;padding:0}
    #rx-panel input[type=text],#rx-panel input[type=number],#rx-panel select{width:100%;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.12);border-radius:4px;padding:3px 6px;font:inherit}
    #rx-panel .val{opacity:.6;font-size:10px;text-align:right}
    #rx-panel footer{display:flex;gap:6px;padding:10px 12px}
    #rx-panel footer button{flex:1;background:rgba(255,255,255,.08);color:inherit;border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:6px;font:inherit;cursor:pointer}
    #rx-panel footer button:hover{background:rgba(255,255,255,.14)}
    #rx-panel .range-row{display:grid;grid-template-columns:1fr 44px;gap:6px;align-items:center}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const el = document.createElement('aside'); el.id = 'rx-panel';
  el.innerHTML = `<header><b>${config.title || 'Tweaks'}</b><span>${rx.slug || 'base'} · \` to toggle</span></header>`;

  const groups = [...new Set(knobs.map((k) => k.group || 'Knobs'))];
  const inputs = new Map();
  for (const g of groups) {
    const d = document.createElement('details'); d.open = true;
    d.innerHTML = `<summary>${g}</summary>`;
    for (const k of knobs.filter((x) => (x.group || 'Knobs') === g)) {
      const lab = document.createElement('label');
      lab.innerHTML = `<div>${k.label || k.id}<small>${k.id}</small></div>`;
      const cell = document.createElement('div');
      let input, val;
      const num = (v) => (typeof v === 'number' ? v : parseFloat(v));
      if (k.type === 'color') { input = document.createElement('input'); input.type = 'color'; input.value = toHex(k.default); input.oninput = () => set(k, input.value); }
      else if (k.type === 'length' || k.type === 'number') {
        cell.className = 'range-row';
        input = document.createElement('input'); input.type = 'range'; input.min = k.min ?? 0; input.max = k.max ?? 100; input.step = k.step ?? 1; input.value = num(k.default);
        val = document.createElement('div'); val.className = 'val'; val.textContent = k.default;
        const unit = k.unit ?? (k.type === 'length' ? String(k.default).replace(/[\d.-]/g, '') || 'px' : '');
        input.oninput = () => { const v = k.type === 'length' ? `${input.value}${unit}` : +input.value; val.textContent = v; set(k, v); };
        cell.append(input, val);
      }
      else if (k.type === 'select') { input = document.createElement('select'); for (const o of k.options || []) { const op = document.createElement('option'); op.value = o; op.textContent = o; input.appendChild(op); } input.value = k.default; input.onchange = () => set(k, input.value); }
      else { input = document.createElement('input'); input.type = 'text'; input.value = k.default; input.onchange = () => set(k, input.value); }
      if (!cell.className) cell.appendChild(input);
      lab.appendChild(cell); d.appendChild(lab); inputs.set(k.id, { k, input, val });
    }
    el.appendChild(d);
  }
  const foot = document.createElement('footer');
  const btn = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.onclick = fn; foot.appendChild(b); return b; };
  btn('Copy JSON', () => { const o = { name: (config.title || 'tweak') + '-' + Date.now().toString(36), thesis: 'exported from tweak panel', tokens: {}, motion: {}, shaders: {} };
    for (const [id, v] of Object.entries(state)) { if (id.startsWith('--')) o.tokens[id] = v; else setPath(o, id, v); }
    navigator.clipboard?.writeText(JSON.stringify(o, null, 2)); flash('copied'); });
  btn('Copy link', () => { navigator.clipboard?.writeText(location.href); flash('link copied'); });
  btn('Reset', () => { for (const id of Object.keys(state)) delete state[id]; for (const { k, input, val } of inputs.values()) { applyOne(k, k.default); if (input.type === 'color') input.value = toHex(k.default); else input.value = typeof k.default === 'number' ? k.default : String(k.default).replace(/[a-z%]+$/i, ''); if (val) val.textContent = k.default; } write(); });
  el.appendChild(foot); document.body.appendChild(el);
  const flash = (t) => { const h = el.querySelector('header span'); const old = h.textContent; h.textContent = t; setTimeout(() => (h.textContent = old), 900); };

  /* ---- restore from URL ---- */
  Object.assign(state, read());
  for (const [id, v] of Object.entries(state)) { const e = inputs.get(id); if (!e) continue; applyOne(e.k, v); if (e.input.type === 'color') e.input.value = toHex(v); else e.input.value = typeof v === 'number' ? v : String(v).replace(/[a-z%]+$/i, ''); if (e.val) e.val.textContent = v; }

  window.addEventListener('keydown', (e) => { if (e.key === '`' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) el.hidden = !el.hidden; });
  return { state, el, set: (id, v) => { const e = inputs.get(id); if (e) set(e.k, v); } };
}

function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  const m = String(c).match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/); if (!m) return '#000000';
  return '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('');
}
