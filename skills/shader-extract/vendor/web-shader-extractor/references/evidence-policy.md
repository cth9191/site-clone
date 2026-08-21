# Evidence Policy

Choose evidence by authority and collection cost.

## Truth Labels

Every implementation-critical fact needs a nearby truth label. If a fact has no label, treat it as `GUESS`.

| Label | Meaning | Valid evidence |
|---|---|---|
| `SOURCE` | Direct target-bound evidence from implementation or runtime. | Public source, source map, runtime object dump, captured shader/WGSL, GPU frame capture, network body with hash, or authoritative API output. |
| `PARTIAL` | Target-bound handle whose value, wiring, or replay role is not proven. | Symbol name, bundle slice, framework object, shader without draw/resource state, owner hint, or resource URL without use evidence. |
| `GUESS` | No direct evidence for the fact. | Visual fit, naming inference, copied defaults, hand-tuned constants, approximate behavior rebuild, or unverified assumption. |

Do not describe `PARTIAL` or `GUESS` facts as extracted source. A behavior rebuild can be used, but it stays approximate until promoted by evidence.

## Leaf Facts vs Wiring Facts

False conclusions often come from proving a leaf fact and guessing the wiring fact. Audit them separately:

- Leaf facts: shader source, WGSL, constants, config values, asset URLs, resource dimensions, sampler settings, context attributes.
- Wiring facts: target ownership, draw/pass order, FBO dependencies, coordinate transforms, time unit, delta rule, random source, input coupling, resize behavior, color/alpha/DOM composite.

`SOURCE` leaf facts do not promote unproven wiring.
A source shader string does not prove active pass order.
A config field named `velocity` does not prove units.
A framework signature does not prove the target canvas uses that framework.

## Promotion Rules

Promote a fact only when evidence improves:

- `GUESS -> PARTIAL`: a target-bound handle exists, but the value or wiring is still missing.
- `PARTIAL -> SOURCE`: direct source/runtime/frame evidence proves the value and its use in the target path.
- `SOURCE` for gate-critical wiring should have corroboration when practical. Examples: source plus runtime object, runtime plus frame capture, or source plus local replay smoke.

When evidence conflicts with the model, do not tune parameters to mask the conflict.
Route the mismatch back to attribution, source trace, or replay readiness.
Record the unresolved unknown.

## Unknown Classes

- `blocking`: cannot build a baseline that matches required evidence without resolving it
- `important`: baseline can run, but QA must focus on it
- `deferred`: affects projectization or polish, not baseline
- `external`: blocked by access, authorization, or legal permission

## Choosing The Next Action

Prefer the action that resolves the most blocking unknowns while keeping authority high and cost low.

Invalid action: "download every bundle and inspect everything."

Valid action: "target context creation stack points into `hero-renderer.*.js`; fetch only that source-mapped module to resolve owner and shader source."

## Evidence Ledger

Use ledger entries for facts that influence implementation:

```json
{
  "id": "ev-0042",
  "fact": "target surface is created by THREE.WebGLRenderer",
  "value": true,
  "truth": "SOURCE",
  "targetIds": ["surface-1"],
  "source": {
    "type": "runtime|api|source-map|frame-capture|bundle|dom|screenshot|inference",
    "location": "evidence/runtime/renderer.json#0",
    "hash": "sha256:..."
  },
  "authority": "direct|corroborated|indirect|inferred",
  "confidence": 0.96,
  "verifiedBy": ["runtime-owner", "call-stack"]
}
```

Implementation-critical values should not rely only on `inferred` evidence unless the replay route is explicitly `BEHAVIOR_REBUILD`.

## Pre-Delivery Honesty Check

Before reporting completion, verify:

- Every implementation-critical value has `SOURCE`, `PARTIAL`, or `GUESS` evidence.
- No fitted value is labeled `SOURCE`.
- Wiring facts are proven separately from leaf facts.
- `REPLAY_READY` has no blocking unknowns without a documented fallback and fidelity downgrade.
- Known gaps describe the blocking unknown and the evidence needed to resolve it. Do not replace missing evidence with assumptions.

## Sensitive Data

Do not persist cookies, Authorization headers, access tokens, private API keys, or private account data.
When a browser session is already logged in, record only the minimum non-sensitive facts needed for target attribution and replay.
