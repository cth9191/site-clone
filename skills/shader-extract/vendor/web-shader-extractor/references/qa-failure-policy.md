# QA and Failure Policy

Validation happens twice:

1. Source -> Baseline: does the local baseline match the target evidence?
2. Baseline -> Editable: did projectization avoid regression?

## Fixed Conditions

Keep these identical across comparisons:

- viewport
- DPR
- browser/backend
- fixed time or selected frame
- pointer, scroll, resize, route state
- random seed when controllable
- background, alpha, and DOM composite
- crop and time point

## Validation Levels

1. Build: dependencies and assets resolve
2. GPU: shaders/pipelines compile and link
3. Structural: pass, FBO, program, resource, and state match Manifest
4. Visual: color, composition, alpha, edges
5. Temporal: multi-frame rhythm, phase, randomness
6. Interaction: pointer, scroll, resize, route
7. Regression: editable project vs baseline

## Minimum Source -> Baseline Protocol

Minimum verification requires more than one static screenshot:

1. Compare at the initial frame or a fixed time.
2. Compare at a later frame.
3. Compare after one relevant interaction if the target is interactive.
4. For scroll-coupled effects, compare at top, middle, and target section.
5. For route-coupled effects, compare at the route transition or persistent renderer state.
6. Always record viewport, DPR, browser/backend, crop, time, pointer, scroll, and route state.

Every comparison must save or reference:

- source image or frame evidence
- baseline image or frame evidence
- diff image, numeric comparison, or written visual difference record

If the environment cannot produce image diffs, write a structured visual difference record and keep that limitation in `known-gaps.md`. A single matching first frame is not enough for `BASELINE_VERIFIED`.

## Truth Audit

Run this audit before marking the final state:

- Every implementation-critical fact in `replay-manifest.json` has direct evidence or a `PARTIAL` / `GUESS` label.
- Leaf facts and wiring facts were checked separately. A verified shader or config value does not prove the active render graph, timing, coordinate space, or input route.
- Any parameter changed to improve appearance is recorded as `GUESS` unless source/runtime/frame evidence proves it.
- Any mismatch is routed to the upstream unknown that explains it. Do not cover mismatches with tuning.
- Known gaps state the blocking unknown and the evidence needed to resolve it.

The QA report is the gate artifact for `BASELINE_VERIFY` and `PROJECT_VERIFY`. Do not mark either gate passed while any required row is `pending`, any P0/P1/P2 issue is open, or the final status is absent.

## Severity

- `P0`: cannot run, cannot render, or route impossible
- `P1`: wrong target, render graph, composition, or main interaction
- `P2`: visible timing, color, alpha, responsive, or input drift
- `P3`: polish or performance issue that does not block delivery

Automatically loop only P0/P1/P2.

## Failure Routing

| Symptom | Category | Return |
|---|---|---|
| wrong canvas or missing shared surface | target | `SURFACE_ATTRIBUTION` |
| missing shader/resource/input | evidence | `SOURCE_TRACE` |
| wrong FBO, time, coordinates, color model | replay model | `CAPTURE_MINIMUM_TRUTH` |
| dependency, path, or code error | implementation | `RAW_REPLAY` |
| browser, GPU, CORS, or context issue | environment | `BASELINE_RUN` |
| evidence complete but implementation visually wrong | fidelity implementation | `RAW_REPLAY` |

Do not route all mismatches into parameter tuning.

## Failure Signatures

Use these signatures to classify mismatches before editing values.

| Symptom | Likely Root Cause |
|---|---|
| overall too bright or color-shifted | color space, tone mapping, premultiplied alpha |
| animation slowly drifts | seconds vs frames, delta, time origin |
| vertical flip | UVs, render target orientation, SDF/image coordinate system |
| black blocks or missing layers | FBO, clear, blend, depth, missing resources |
| noise differs | RNG, precision, filtering, noise implementation |
| edge softness differs | DPR, AA, derivatives, SDF smoothing |
| scroll position drifts | DOM-canvas binding or scroll normalization |
| route flicker | renderer lifecycle, resource cache, route persistence |
| pointer response offset | canvas CSS transform, DPR, page scroll, coordinate normalization |

Confirm the category with evidence before changing implementation constants.
