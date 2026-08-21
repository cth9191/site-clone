---
name: web-shader-extractor
description: >
  Use when a user gives or references a webpage URL and wants to extract,
  reproduce, port, or locally replay a WebGL, WebGPU, Canvas, shader-like,
  animated background, interactive 3D, or web visual effect. Locks the target
  rendering surface group, records shader/resource/render graph/timing/input
  evidence, builds an evidence-matched local baseline, then projectizes it.
  Do not use for ordinary DOM/CSS page cloning.
---

# Web Shader Extractor

Index for WebGL / WebGPU / Canvas rendering investigation and local replay.
Start from the target visual. Lock the surface group. Trace source or runtime facts. Build a runnable baseline. Then projectize.

## Router Contract

This file is the index. Do not treat it as the full operating manual. Before task action, read:

- `references/operating-contract.md`
- `references/recon-kernel.md`

Then load only the focused references needed by the current state.
Keep large evidence, captures, and generated outputs out of the conversation.
Store them in the user's output directory.

## Use This For

- Extracting a webpage WebGL, WebGPU, Canvas2D, OffscreenCanvas, shader, or animated canvas effect.
- Replaying an animated background, product shader, interactive WebGL scene, or Canvas visual locally.
- Building an evidence-matched baseline first, then an editable project.
- Investigating target-bound shader/render graph/timing/resource/input facts.

Do not use this for ordinary DOM/CSS cloning, static screenshots, generic website copying, unrelated JavaScript deobfuscation, or product UI redesign.
Use it only when the task has a shader/canvas target.

## Core Rules

- Target-bound before framework-bound: a global Three.js, platform, or shader signature is only a hypothesis until tied to the target surface group.
- Evidence before implementation: source, runtime objects, frame captures, source maps, and public structured definitions outrank visual fitting.
- Baseline before projectization: never overwrite a verified baseline for cleanup, simplification, or native conversion.
- Honest labels: implementation-critical facts are `SOURCE`, `PARTIAL`, or `GUESS`; unlabeled values are treated as `GUESS`.
- No compensation tuning: do not adjust brightness, time, color, offsets, or noise to mask missing pipeline evidence.
- Gate artifacts are transition guards: if the required artifact is missing, incomplete, or has placeholders in gate-critical fields, the state has not advanced.
- Ask only for product scope changes or external access/permission blockers.
- Use plain records: state the fact, evidence path, current unknown, and next action. Avoid metaphor, broad claims, and unsupported conclusions.

## State Router

Use the Recon Kernel state flow:

```text
INTAKE -> CAPABILITY_SNAPSHOT -> QUICK_SCOUT -> SURFACE_ATTRIBUTION
-> TARGET_LOCK_GATE
   - provisional/failed -> REFINE_SCOUT
   - attributed -> targeted owner/backend/source probe -> TARGET_LOCK_GATE
   - locked -> SCOPE_CHECK
-> TRACE_ROUTE_SELECT -> SOURCE_TRACE -> CAPTURE_MINIMUM_TRUTH
-> REPLAY_READY_GATE
   - not ready -> SOURCE_TRACE / CAPTURE_MINIMUM_TRUTH
   - ready -> RAW_REPLAY
-> BASELINE_RUN -> BASELINE_VERIFY
-> BASELINE_VERIFIED -> PROJECTIZE -> PROJECT_VERIFY -> PACKAGE
```

`TARGET_LOCKED` must precede deep source/bundle work.
Before lock, only narrow source probes tied to `nextProbe` are allowed.
`REPLAY_READY` must precede implementation.
`BASELINE_VERIFIED` must precede projectization.

## Reference Router

Load only what the current state needs:

| Need | Read |
|---|---|
| Global contract, fact labels, completion states | `references/operating-contract.md` |
| Kernel, initial protocol, state flow, autonomy, budgets | `references/recon-kernel.md` |
| Surface discovery and visual attribution | `references/surface-discovery.md` |
| Lock criteria, target-bound evidence, scope, Three.js binding | `references/target-lock.md` |
| Evidence labels, ledgers, unknown classes, sensitive data | `references/evidence-policy.md` |
| Tool capability selection | `references/tool-capability-matrix.md` |
| WebGL, WebGPU, and Canvas2D capture facts | `references/capture-backends.md` |
| Source maps, bundle slices, config, encoded definitions | `references/source-analysis.md` |
| Replay readiness, routes, baseline, stack choice, projectization | `references/replay-policy.md` |
| QA, failure routing, severity, mismatch signatures | `references/qa-failure-policy.md` |
| Three.js shader injection or TSL reconstruction | `references/three-shader-reconstruction.md` |
| Unicorn Studio target | `references/unicorn-studio.md` |
| shaders.com / TSL target | `references/shaders-com.md` |

## Tool And Artifact Policy

Tools are replaceable capabilities, not prerequisites. First record the available capability profile:

```text
navigate, runtime-eval, preload-script, network-metadata, network-body,
source-map, canvas-screenshot, interaction, frame-capture-webgl,
frame-capture-webgpu, local-run, multi-frame-compare
```

Use `scripts/fetch-rendered-dom.mjs` only as an optional inventory helper when Playwright is already available.
Use `scripts/scan-bundle.sh` only on target-bound bundle slices or a precise `nextProbe`.
Script output is hypothesis evidence. It never satisfies Surface Attribution, Target Lock, Replay Ready, or QA gates by itself.

Use bundled templates as schemas, not free-form notes:

- `templates/scout-card.json`
- `templates/replay-manifest.json`
- `templates/run-state.json`
- `templates/qa-report.md`
- `templates/known-gaps.md`
- `templates/extraction-report.md`

## Platform Adapters

Load platform references only after target-bound evidence points there:

- Unicorn Studio: `references/unicorn-studio.md`
- shaders.com / TSL: `references/shaders-com.md`
- Three.js shader injection or TSL: `references/three-shader-reconstruction.md`

If no adapter fits, follow generic WebGL, WebGPU, or Canvas2D capture in `references/capture-backends.md`.
