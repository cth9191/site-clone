# Capture backends

The vendored engine tells you the *discipline* (lock the surface, capture the
truth, verify before projectizing). This file names the *tools* that actually
recover a GPU frame, and what each gives you vs. what remains guesswork. Pick by
surface type from the surface map.

## WebGL1 / WebGL2 → Spector.js

Spector.js (BabylonJS, first-party, actively maintained; works with any
WebGL1/WebGL2 engine — Three.js, Babylon, regl, raw GL) captures a **complete
frame as a full ordered command list**, each command annotated with its visual
state and GL context info. That gives you, per frame:

- the executed GL commands in **draw/pass order** (reconstruct the render graph),
- **shader programs** (GLSL source), attributes, VAOs,
- **uniforms** and uniform buffers bound at each draw,
- textures, framebuffers, and render state.

How to drive it:

- Inject the Spector.js script (CDN or bundled) into the page via the browser
  tool. Programmatic capture: `new SPECTOR.Spector()` then `captureCanvas(canvas)`
  or `captureNextFrame(canvas)`; the result is the command tree you serialize to
  evidence. `startCapture` / `stopCapture` bracket a specific interaction.
- Capture a representative frame — for a time-driven effect, one steady-state
  frame; for an interactive one, capture at a known pointer/scroll state and
  record that state alongside.

**Reliable:** shader source, per-draw uniforms, command/pass order, textures,
state. This is real evidence, label `SOURCE`.
**Still guesswork:** how uniforms are *driven over time* (the JS that animates
them frame to frame) — Spector shows one frame's values, not the update function.
Recover the drive loop from source/source-maps when possible; otherwise the
timing/coupling is `PARTIAL` or `GUESS`. Spector captures and inspects; it does
**not** auto-replay — you reconstruct the runnable module from its evidence.

## WebGPU → WebGPU Inspector

WebGPU Inspector (brendan-duncan; browser extension, RenderDoc-style, engine-
independent within WebGPU) captures a frame's **full command stream** — render-
pass output images, textures, buffer data, render state, and the uniform/storage
buffers bound to each draw/dispatch. It also gives a **live view of every GPU
object** with live shader (WGSL) editing and texture inspection, and — the part
that matters most for porting — it can **serialize a capture into a self-contained
HTML or binary file that replays offline** without a local server.

How to drive it:

- Install the extension (Chrome Web Store / Firefox Add-ons). Open its panel on
  the target, Capture a frame, inspect passes/buffers/shaders, then Record →
  export the self-contained replay file into your output dir as the baseline
  evidence.
- Use the WGSL shaders + bound buffer layouts as the source of truth for the
  reconstructed module.

**Reliable:** WGSL shaders, pass structure, bound buffers, and a replayable
capture file. Label `SOURCE`.
**Still guesswork:** same as WebGL — the per-frame update logic driving the
buffers is not in a single capture; recover it from source or mark `PARTIAL`.

## Canvas2D → source + operation trace

No GPU pipeline. Recover the 2D drawing from the JS source (the vendored engine's
source-analysis path). If the source is minified/unavailable, trace the sequence
of Canvas2D operations and rebuild from observed behavior — explicitly a
`BEHAVIOR_REBUILD` (approximate), never claimed as source.

## Platform drivers (short-circuits)

If the surface map's `driver` says a known platform, prefer its structured
definition over raw frame capture — it's higher fidelity and less work:

- **Unicorn Studio** — has a project export/definition; use the vendored
  `references/unicorn-studio.md` adapter.
- **Spline** — scene has an exportable URL/definition; embed or re-export rather
  than pixel-capture.
- **shaders.com / TSL** — structured shader definitions; vendored
  `references/shaders-com.md` + `references/three-shader-reconstruction.md`.

Fall back to Spector.js / WebGPU Inspector only when no structured definition is
reachable.

## Hard blocker: cross-origin / tainted canvas

If the canvas is cross-origin without CORS, pixel readback and some capture paths
are blocked by the browser. Don't fabricate a shader you couldn't read — capture
a **poster frame** (screenshot) as the fallback deliverable and record the
limitation in `known-gaps.md`. Honest poster > invented lookalike.
