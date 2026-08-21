# Target Lock

`TARGET_LOCKED` is an evidence gate.
After it passes, source tracing and capture can focus on one target surface group.
Use `attributed` when visual causality is proven but owner or source is still unresolved.

## Required Fields

`TARGET_ATTRIBUTED` means:

- the target surface or surface group is visually attributed
- ablation, frame comparison, interaction response, or equivalent evidence proves causality
- context, owner, framework, or source may still be incomplete
- only owner probes, backend probes, or narrow source probes tied to `nextProbe` are allowed

`TARGET_LOCKED` requires:

- target is a surface or surface group
- visual attribution evidence exists
- context type is known
- owner thread/frame/worker is known or reliably located
- framework, platform, runtime, or source clues are bound to the target
- effect boundary is classified
- exactly one primary trace route is selected
- alternatives and exclusion reasons are recorded

Do not set `lockStatus` to `locked` until these fields are present in `scout-card.json` with evidence paths.
Conversation text is not enough.
If owner/source is still unresolved but the visual target is proven, set `lockStatus` to `attributed`.
Make the next action an owner or backend probe.

## Scout Card v3

Write a small card before the full Manifest:

```json
{
  "schemaVersion": 3,
  "source": {
    "url": "https://example.com/",
    "route": "/",
    "viewport": { "width": 1440, "height": 900, "dpr": 2 }
  },
  "candidates": [
    {
      "id": "surface-1",
      "selector": "canvas#hero",
      "frame": "main",
      "context": "webgl2",
      "owner": "unknown",
      "visualCoverage": "high",
      "temporalActivity": "high",
      "ablationImpact": "major",
      "evidence": ["evidence/scout/surface-1.json"]
    }
  ],
  "lockStatus": "provisional",
  "targetSet": [],
  "alternatives": [],
  "effectBoundary": "surface-only|surface-plus-dom|page-coupled|route-coupled",
  "frameworkHypotheses": [],
  "platformHypotheses": [],
  "interactions": [],
  "scopeRisk": "low|medium|high",
  "blockingUnknowns": [],
  "nextProbe": {
    "type": "surface-ablation|runtime-owner|platform-api|frame-capture|preload|source-map|bundle-slice",
    "target": "surface-1",
    "resolves": ["owner", "framework"]
  }
}
```

## Target-Bound Evidence

Weak evidence can form hypotheses only:

- `window.THREE` exists
- a bundle contains `three`, `babylon`, `pixi`, `regl`, or shader keywords
- the domain resembles a known platform
- a global variable contains a renderer
- another canvas on the page uses a framework

Promote a hypothesis only when at least one strong target binding exists:

- `renderer.domElement === targetCanvas`
- engine rendering canvas equals the target canvas
- target context creation stack comes from the framework/platform
- target draw calls, programs, or state are associated with framework objects
- public platform definition instance ID matches the target embed/canvas
- source map or module path initializes the target surface

## Route Selection

Pick the next route from the strongest current target-bound clue:

```text
strong platform feature
-> platform structured definition or public API

target renderer object accessible
-> runtime object and framework version

generic WebGL
-> frame capture or shader/runtime capture

WebGPU / TSL
-> platform source, TSL definition, WebGPU capture

owner or timeline unclear
-> preload hooks

source/config still missing
-> source map or targeted bundle slice
```

## Adapter Interface

Each platform/framework adapter should answer:

```text
detect(context)             target-bound evidence
preferredEvidence(context)  highest-authority entry with lowest collection cost
capture(context)            facts needed for replay
replay(context)             recommended baseline route
validationHints(context)    known failure cases and QA focus
fallback(context)           next route if primary fails
```

Initial adapters: Unicorn Studio, shaders.com / TSL, generic WebGL, generic WebGPU, Canvas2D, and Three.js target binding.

## Three.js Target Binding

Use this only after a target surface exists. Three.js on the page is not enough.

Accept Three.js as the target framework when one is true:

- `renderer.domElement === targetCanvas`
- target canvas `data-engine` or dataset is corroborated by runtime renderer object
- target context creation stack includes Three.js renderer initialization
- target draw calls/programs correspond to Three.js material/program records
- source map/module that creates the target surface imports Three.js renderer/material code

Capture runtime facts:

- `THREE.REVISION`
- renderer output color space/tone mapping
- renderer size and pixel ratio
- scene/camera relationship for the target pass
- material type, shader chunks, `onBeforeCompile` hooks
- render targets and composer passes
- clock/time update rule

Three.js r170+ may use TSL and WebGPU.
Do not expect GLSL strings from `shaderSource()`.
Route to `references/three-shader-reconstruction.md` or `references/capture-backends.md` when node graphs or WebGPU backend are target-bound.

## Scope Gate

Default scope is `effect`.

Scope values:

- `effect`: independent visual effect
- `page`: current page DOM/CSS/interaction plus renderer cooperation
- `site`: main public visual routes, unique visual templates, shared renderer, and transitions; not backend, accounts, private data, or bulk same-template content pages

Ask a scope question only when all are true:

- the user did not specify scope
- WebGL/WebGPU is the overall experience skeleton
- it is coupled with DOM, scroll, navigation, or route
- extracting one surface would lose the main target experience

A fullscreen background canvas alone is not a reason to ask.

Question template:

```text
I have locked the main rendering system.
The site's WebGL/WebGPU also participates in layout, scroll, interaction feedback, or route transitions.
Extracting one effect would omit part of the main experience.

Choose the reproduction scope:
A. Core effect (default, fastest) - first build it as an independently runnable local effect.
B. Current page - also reproduce the DOM/CSS, scroll, interaction, and renderer cooperation.
C. Main site visual experience - inspect public visual routes and templates.
Reproduce the shared renderer, key visual pages, and route transitions.
Do not reproduce backend, accounts, private data, or bulk same-template content pages.

Reply with A, B, or C. If you reply "continue" or provide no scope, proceed with A.
```

Ask separately only for login, CAPTCHA, private pages, paid resources, or permission/license uncertainty.
Combine blockers into one note.

## Gate Rules

- Before attribution completes, `lockStatus` can only be `unlocked` or `provisional`.
- `attributed` allows owner/backend/source probes bound to `nextProbe`; it does not allow deep source or bundle work.
- `locked` requires a non-empty `gateDecision.requiredEvidence` checklist in `scout-card.json`; every item must be an evidence item with `status`, `evidenceId`, `path`, `truth`, and `notes`.
- `frameworkHypotheses` and `platformHypotheses` are candidates, not conclusions.
- `nextProbe` has one main action.
- Raw DOM, screenshots, network logs, and frame captures go into files and are referenced by path.
- After lock, fill `targetSet`, excluded alternatives, lock evidence, and primary route.
