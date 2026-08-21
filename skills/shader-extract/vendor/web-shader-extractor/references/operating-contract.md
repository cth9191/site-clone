# Operating Contract

This contract defines the behavior of the Web Shader Extractor skill before any focused workflow begins.

## Objective

Start from the visual effect the user points to.
Lock the rendering surface, runtime, and source entry that produce it.
Use the lowest-cost target-bound evidence path.
Build a runnable and verifiable local baseline first.
Perform cleanup, modularization, and editability work only after that baseline passes verification.

This skill is not a general website cloner or a general JavaScript reverse-engineering workflow.
The core completion state is a local, runnable, verified replay of the target visual.

## Non-Negotiable Principles

1. Start from the visual target, not from bundles, framework names, or project structure.
2. Be canvas-first, not canvas-only: track iframes, OffscreenCanvas, workers, WebGPU, and DOM layers that participate in the effect.
3. Attribute before locking: the largest, fullscreen, or continuously animated canvas is not automatically the target.
4. Bind every conclusion to the target: a page-level Three.js, Babylon.js, or platform signature does not prove the target canvas uses it.
5. Lock the target before deep analysis: do not deobfuscate full bundles before `TARGET_LOCKED`.
6. Resolve one key unknown at a time: every action must state which unknown it resolves.
7. Prefer evidence over inference: public definitions, source, source maps, runtime objects, and frame captures outrank minified guesses.
8. Replay first: a runnable, verified local baseline is the core deliverable.
9. Restore before refactoring: projectization, modularization, lite versions, and native WebGL conversions happen after the baseline.
10. Choose the stack for evidence match: use native WebGL only when the scene is simple and conversion facts are complete.
11. Do not compensate by tuning: never change brightness, speed, position, or noise values to mask timing, color, FBO, resource, coordinate, or state-model errors.
12. Do not downgrade silently: if source replay falls back to pipeline replay or behavior rebuild, record it.
13. A matching single frame is not dynamic correctness: verify time, input, scroll, and multi-pass behavior separately.
14. Never overwrite the baseline: projectization and simplification happen in separate directories.
15. Do not ask by default: ask only for product-level scope changes or external authorization blockers.
16. Do not bypass access control: handle only public content or content the user is authorized to access and reproduce; do not save cookies, Authorization headers, tokens, or secrets.
17. Label implementation-critical facts as `SOURCE`, `PARTIAL`, or `GUESS`; an unlabeled value is treated as `GUESS`.
18. Separate leaf facts from wiring. Shader text, constants, asset URLs, and pass names can be source facts while render order, timing, input coupling, units, and ownership are still unproven.

## False Conclusion Rules

```text
1. The largest or fullscreen canvas is not necessarily the target canvas.
2. A framework existing on the page does not mean the target canvas uses it.
3. A visible first frame does not prove the render graph, time, and inputs are correct.
4. A similar screenshot does not prove the dynamic effect has been verified.
5. A source constant does not prove the pipeline wiring that consumes it.
6. A target-bound symbol name does not prove units, coordinate space, or timing semantics.
7. A local fix that improves appearance is not evidence; it is a GUESS until traced or independently verified.
```

## Fact Labels

Use truth labels close to facts that drive implementation:

- `SOURCE`: direct target-bound evidence. Examples: public original source, source-mapped module, runtime object dump, captured shader/WGSL, frame capture, or network body with hash.
- `PARTIAL`: a handle for the next probe. Examples: class/function/field name, target-bound bundle slice, framework object, or shader without state/pass/input facts.
- `GUESS`: visual fitting, naming inference, copied defaults, hand-tuned constants, or any behavior rebuild value without direct evidence.

Never upgrade a fact because output looks similar.
If a value is fitted so the baseline resembles the source, keep it labeled `GUESS`.
State which evidence would promote it.
If direct source conflicts with runtime behavior, treat wiring, units, or target attribution as unresolved before tuning.

Before declaring `TARGET_LOCKED`, `REPLAY_READY`, or `BASELINE_VERIFIED`, check both layers:

- Leaf facts: shader/WGSL text, constants, config, asset paths, resource dimensions, context attributes.
- Wiring facts: owner, pass order, FBO dependencies, coordinate transforms, time units, random rules, pointer/scroll/resize coupling, output composite.

Read `references/evidence-policy.md` for the full labeling and audit rules.

## External Blockers

Ask separately only for login, CAPTCHA, private pages, paid resources, or permission/license uncertainty.
Combine blockers into one note.

If connecting to an existing logged-in browser, tell the user credentials or page data may be visible to the agent.
Do not persist sensitive headers, cookies, tokens, or secrets.

## Completion States

- `DONE_BASELINE_VERIFIED`: baseline passed Source -> Baseline validation.
- `DONE_PROJECTIZED`: editable project passed Baseline -> Editable regression.
- `DONE_BASELINE_WITH_GAPS`: baseline runs, but differences or evidence gaps remain and are documented.
- `BLOCKED_EXTERNAL`: legal access, authorization, or permission prevents progress.
