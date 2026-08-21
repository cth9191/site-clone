# Recon Kernel

The Recon Kernel is the core workflow. It prevents scope drift into website cloning or unrelated bundle analysis.

## Kernel Loop

```text
LIST        list candidate surfaces and rank them
ATTRIBUTE   prove which surfaces contribute to the requested target visual
LOCK        bind target surface group to context, owner, and source clues
TRACE       choose the lowest-cost authoritative evidence route
REPLAY      capture required facts and build a local baseline
```

## State Flow

```text
INTAKE
-> CAPABILITY_SNAPSHOT
-> QUICK_SCOUT
-> SURFACE_ATTRIBUTION
-> TARGET_LOCK_GATE
-> SCOPE_CHECK
-> TRACE_ROUTE_SELECT
-> SOURCE_TRACE
-> CAPTURE_MINIMUM_TRUTH
-> REPLAY_READY_GATE
-> RAW_REPLAY
-> BASELINE_RUN
-> BASELINE_VERIFY
-> BASELINE_VERIFIED
-> PROJECTIZE
-> PROJECT_VERIFY
-> OPTIONAL_LITE
-> PACKAGE
```

Use these branches:

```text
TARGET_LOCK_GATE
  - failed/provisional -> REFINE_SCOUT loop
  - attributed -> owner/backend/source probe, then return to TARGET_LOCK_GATE
  - locked -> SCOPE_CHECK

REPLAY_READY_GATE
  - blocking unknowns remain -> SOURCE_TRACE / CAPTURE_MINIMUM_TRUTH loop
  - ready -> RAW_REPLAY

BASELINE_VERIFY
  - target error -> SURFACE_ATTRIBUTION
  - evidence gap -> SOURCE_TRACE
  - replay model error -> CAPTURE_MINIMUM_TRUTH / RAW_REPLAY
  - implementation error -> RAW_REPLAY
  - environment error -> BASELINE_RUN
  - passed -> BASELINE_VERIFIED
```

Use `REFINE_SCOUT` when target lock fails or remains provisional. Use the failure routes in `references/qa-failure-policy.md` when verification fails.

## Initial Protocol

Perform these actions first and persist artifacts under the output directory:

1. Record canonical URL, route, viewport, DPR, browser/backend, and a source screenshot.
2. Enumerate visible canvases in the main page and iframes. Record OffscreenCanvas, Worker, WebGPU, video, and DOM mask/clip/sticky clues.
3. Sample two or three frames per plausible surface; estimate visual coverage, temporal activity, z-order, and interaction response.
4. For top candidates, run short reversible ablation tests: hide, opacity/freeze, transform, or output replacement. Record which target pixels or behaviors disappear.
5. Probe minimal pointer, scroll, and resize interactions to identify coupling.
6. Identify the target surface group context, owner thread/frame/worker, and creation source. If needed, reload once with a preload probe.
7. Accept platform, framework, runtime, and source evidence only when it is bound to the target surface group.
8. Select exactly one next evidence path and write `scout-card.json`.
9. Before `TARGET_LOCKED`, do not download or deobfuscate full bundles. Use source maps, public structured definitions, or narrow bundle slices only when they resolve the next unknown.

## Gate Semantics

`TARGET_ATTRIBUTED` means visual causality is proven for a surface group.
Context, owner, framework, or source may still be incomplete.
Only owner/backend/source probes tied to `nextProbe` are allowed.

`TARGET_LOCKED` means the target is a surface group.
Visual attribution exists.
Context and owner are known or reliably located.
Source/framework evidence is target-bound.
Effect boundary is known.
One trace route is selected.
Alternatives are recorded.

`REPLAY_READY` means no blocking unknowns remain, or every remaining blocker has an explicit fallback and fidelity tier.
Time/input rules, output color/alpha/composite, critical resources, and replay route are sufficient for the first local baseline.

`BASELINE_VERIFIED` means the baseline starts independently.
Main composition/layers are correct.
Animation and key interactions are checked.
Render graph/output composite has no P0/P1/P2 issue.
Known gaps are documented instead of masked by manual tuning.

## Gate Artifact Contract

Gate artifacts are transition guards.
A gate is not passed until the required artifact exists, uses the bundled template shape, has no placeholders in gate-critical fields, and points to persisted evidence or a documented external blocker.

| Gate | Required artifact | Minimum pass condition |
|---|---|---|
| `TARGET_LOCK_GATE` | `scout-card.json` | `lockStatus=locked`; `targetSet` non-empty; attribution evidence referenced; context and owner known; alternatives recorded; primary trace route selected. |
| `REPLAY_READY_GATE` | `replay-manifest.json` | replay route and fidelity tier set; target surfaces and runtime owner/backend recorded; facts labeled; no blocking unknowns without fallback and downgrade. |
| `BASELINE_VERIFY` | `qa-report.md` plus `replay-manifest.json` | Source -> Baseline checks have evidence; P0/P1/P2 issues closed or routed back; fact audit complete; final status set. |
| `PROJECT_VERIFY` | `qa-report.md` | Baseline -> Editable regression checks have evidence; P0/P1/P2 regressions closed; projectization did not change replay route or fidelity tier silently. |

Evidence checklist entries must be structured objects, not prose strings:

```json
{
  "status": "unknown",
  "allowedStatus": ["passed", "blocked", "unknown"],
  "evidenceId": "ev-001",
  "path": "evidence/scout/ablation-surface-1.json",
  "truth": "GUESS",
  "allowedTruth": ["SOURCE", "PARTIAL", "GUESS"],
  "notes": ""
}
```

If a required artifact is missing or incomplete, keep the current state.
Set `run-state.json.nextAction` to create or repair that artifact.
Do not replace artifact fields with prose in the final answer.

`run-state.json.gateStatus` copies the artifact status. It is not a separate evidence source. Update it only after the corresponding gate artifact passes.

## Working Rule

At every step, write down the unknown being reduced. A valid next action has this shape:

```text
state: SURFACE_ATTRIBUTION
unknown: whether canvas#hero or iframe[0] owns the target distortion
action: hide/freeze both candidates for one frame window and compare target crop
expected evidence: ablation impact by surface
```

If the action has no target unknown, reject it.

## Evidence Chain

Prefer evidence in this order when it is target-bound:

1. Public structured definition or source for the target embed/effect.
2. Runtime object directly owning the target canvas/context.
3. Source map or readable module that creates the target surface.
4. GPU/frame capture tied to the target context.
5. Narrow bundle slice selected by stack, call stack, or target IDs.
6. Inference from minified code or visual behavior.

Do not promote global framework hints to conclusions. They become conclusions only after `references/target-lock.md` criteria pass.

## Artifact Discipline

Keep large facts out of the conversation:

- screenshots and crops under `evidence/screenshots/`
- DOM and style snapshots under `evidence/dom/`
- network index under `evidence/network/`
- frame captures under `evidence/gpu/`
- runtime probes under `evidence/runtime/`
- source slices under `evidence/source/`

Reference them from `scout-card.json`, `replay-manifest.json`, and `qa-report.md`.

## Autonomy And State

Default to autonomous execution. Ask only for product scope changes or external access/permission blockers.

```text
Observe
-> Compare against current Gate / Manifest
-> Classify failure or unknown
-> Choose the lowest-cost action that reduces an unknown
-> Execute
-> Persist evidence and state
-> Measure progress
```

"Try again" is not a valid action unless something changes.

A retry must change at least one:

- tool
- injection timing
- browser or GPU backend
- target surface
- interaction state
- viewport
- evidence source
- bundle slice
- root-cause hypothesis

Default budgets:

- same strategy: 2 attempts
- capture strategy categories: 3
- P0/P1/P2 repair rounds: 6
- plateau: 2 consecutive rounds with no reduction in blocking unknowns and no QA improvement

Persist `.web-shader-extractor/run-state.json`.
Include state, gate status, strategy, attempts, target set, unknowns, evidence index, artifacts, budgets, plateau, next action, replay tier, and QA.
Use `templates/run-state.json` as the starting schema.
