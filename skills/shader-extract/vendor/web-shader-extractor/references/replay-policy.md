# Replay Policy

Replay policy covers the `REPLAY_READY` gate, first local baseline, and stack choice.
The goal is to match recorded source behavior with the fewest new assumptions.

## Replay Ready Contract

Record before entering `RAW_REPLAY`:

- replay route: `SOURCE_REPLAY`, `PIPELINE_REPLAY`, or `BEHAVIOR_REBUILD`
- fidelity tier and known limits
- blocking, important, deferred, and external unknowns
- fallback for any unresolved blocking unknown
- truth labels for implementation-critical leaf and wiring facts

Do not mark `REPLAY_READY` because the capture appears plausible.
`SOURCE` leaf facts do not imply `SOURCE` wiring.
If pass order, input coupling, time units, or output composite are still inferred, label those facts `PARTIAL` or `GUESS`.
Keep inferred gate facts blocking or record an explicit fidelity downgrade.

Proceed to `RAW_REPLAY` only when `blockingUnknowns` is empty, or every blocker has an explicit fallback with a recorded fidelity downgrade.
Move important unknowns into QA focus.

Do not enter `RAW_REPLAY` until `replay-manifest.json.gateDecision.replayReady` is true.
Its required evidence checklist must contain structured evidence items.
If the baseline depends on a fallback, record the fallback and downgrade in the manifest before implementation starts.

If a local baseline uses fitted values to run, those facts are not source replay.
Keep the values labeled `GUESS`.
Place them in `known-gaps.md`.
Route QA toward the missing source/runtime evidence.

## Replay Routes

Choose and record one replay route in `replay-manifest.json`:

- `SOURCE_REPLAY`: public structured definitions, original source, source maps, readable framework modules, platform exports, or configs. Prefer this when available.
- `PIPELINE_REPLAY`: shader/WGSL, runtime objects, GPU frame capture, draw/pass/resource/state, input, and timing trace. Use when source is incomplete but runtime facts are sufficient.
- `BEHAVIOR_REBUILD`: partial source plus observed behavior. This is the last fallback and must be labeled approximate.

Do not describe a behavior rebuild as source extraction. Projectization does not change the baseline fidelity tier.

## Stack Selection

Use native WebGL/WebGL2 when the target is:

- fullscreen shader
- small number of passes
- no complex scene graph
- no PBR/material lifecycle
- no GPGPU lifecycle tied to a framework
- conversion facts are complete

Use the source stack when:

- the framework/platform version is known or closely bounded
- source, source map, platform definition, or runtime objects are complete
- behavior depends on material systems, node graphs, post-processing, scene graph, resource lifecycle, or renderer quirks
- retaining the source stack reaches an evidence-matched baseline with fewer assumptions

Project-lite is a post-verification optimization. It is not a substitute for the verified baseline.

## Raw Replay Priorities

Raw replay creates the first local baseline with the least rewriting:

1. Preserve recorded source behavior and data shape.
2. Keep original constants, shader code, pass order, timing, resources, and color model.
3. Make it run locally with a minimal launch path.
4. Document known gaps rather than masking them with tuning.

Use the source stack when it adds fewer assumptions. Use native WebGL/WebGL2 only when conversion does not add uncertainty.

## Baseline Directory

Output artifacts should be layered:

```text
output/
|-- capture-baseline/
|-- editable-project/
|-- project-lite/
|-- scout-card.json
|-- replay-manifest.json
|-- qa-report.md
|-- extraction-report.md
|-- known-gaps.md
`-- .web-shader-extractor/run-state.json
```

```text
output/capture-baseline/
|-- index.html
|-- src/
|-- assets/
|-- README-run.md
`-- evidence-links.md
```

## No Compensation Tuning

Do not change brightness, speed, offsets, noise scale, fresnel multipliers, SDF epsilons, or color values without evidence.
If the result differs, classify the root cause: color, timing, coordinates, FBO graph, resource, state, input, or environment.

Once baseline verification starts, do not overwrite it for projectization.
Fix baseline in place only for baseline errors.
Create `editable-project/` separately for refactors.

Use the bundled templates as starting schemas, not free-form notes:
`templates/scout-card.json`, `templates/replay-manifest.json`, `templates/run-state.json`, `templates/qa-report.md`, `templates/known-gaps.md`, and `templates/extraction-report.md`.
Fill every placeholder with target-bound evidence or record the gap.

## Projectization

Projectization starts only after `BASELINE_VERIFIED`.

Default output:

```text
output/editable-project/
|-- package.json or importmap-based index.html
|-- src/
|-- assets/
|-- README.md
`-- qa/
```

Projectization may modularize source, add parameter interfaces, improve naming, or introduce a build pipeline.
It must not silently change the replay route or fidelity tier.

Run Baseline -> Editable validation after projectization:

- same viewport, DPR, browser/backend
- same fixed time/frame
- same pointer/scroll/resize state
- same crop and background/composite

Any P0/P1/P2 regression returns to `PROJECTIZE`, not to target scouting unless the regression reveals the baseline was wrong.

Create `project-lite/` only when simplification is supported by evidence and independently verified.
If it fails, remove or mark it experimental.
Do not downgrade the verified editable project.

Do not create `editable-project/` as the primary deliverable until `qa-report.md` records Source -> Baseline as passed or passed with documented gaps.
Do not mark `DONE_PROJECTIZED` until Baseline -> Editable regression is recorded in `qa-report.md`.
