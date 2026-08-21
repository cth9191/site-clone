# Source Analysis

Source analysis is a targeted fallback after target lock, or before lock only when it resolves a precise `nextProbe`. Keep output as evidence, not rewritten implementation.

## Bundle Slices

Allowed before `TARGET_LOCKED` only when the current `scout-card.json` is `attributed` or has a precise `nextProbe`:

- source map lookup for a target context creation stack
- public platform definition referenced by target embed ID
- dynamic chunk graph around a target script URL
- small grep for target IDs, canvas selectors, or known shader/program names

Do not download and deobfuscate every bundle before `TARGET_LOCKED`.

If a local slice already exists, `scripts/scan-bundle.sh` can summarize keyword hypotheses. Use it only to choose the next target-bound probe; do not promote its counts to implementation facts.

When delegating bundle analysis, provide:

```text
Target: surface-1 / targetSet [...]
Known owner evidence: ...
Unknown to resolve: ...
Files/slices: ...
Search anchors: target ID, stack function, shader keyword, platform component
Required output: exact source facts with file offsets and confidence
Forbidden: global framework conclusions not bound to target
```

Look for:

- shader/WGSL/TSL source or node definitions
- renderer/canvas creation path
- render graph and FBO setup
- resource URLs and loaders
- timing/input update rules
- config decoding and component tree reconstruction

## Config Extraction

Configuration values must be source-derived and target-bound. Do not guess colors, dimensions, speeds, or feature flags to compensate for visual mismatch.

Evidence priority:

1. Public structured API or platform definition whose instance ID matches the target surface/embed.
2. Payload data referenced by the target route or target component.
3. Inline JSON or `window` globals tied to the target instance.
4. Source map or readable module creating the target surface.
5. Narrow bundle slice selected from target-bound evidence.

Common searches:

```bash
rg -o 'api/(presets|shaders|collections|embeds)[^"'\'' )]+' evidence/source
rg '_payload\.json|public:\{' evidence/source evidence/dom
rg '__NEXT_DATA__|self\.__next_f|runtimeConfig' evidence/dom evidence/source
rg 'window\.__[A-Z0-9_]+__\s*=' evidence/dom evidence/source
```

For every implementation-critical value, record:

- evidence location
- target IDs it applies to
- value type and units
- whether ranges are 0-1, 0-255, CSS pixels, backing pixels, seconds, frames, or normalized coordinates
- any decode step used

If a config value cannot be proven and the baseline depends on it, keep it in `blockingUnknowns` or mark an explicit replay-route downgrade.

## Encoded Definitions

Use this when a target-bound public API or payload contains encoded scene/effect definitions.

Decode only definitions from public content or content the user is authorized to access.
Do not persist private cookies, Authorization headers, tokens, or account data.
Do not bypass paywalls, CAPTCHA, or access controls.

Recognition signals:

- `_encoded: true`
- `definition` is Base64 or compressed text instead of JSON
- source contains `atob`, `btoa`, `TextEncoder`, `TextDecoder`, XOR, inflate, or mapping tables
- runtime config exposes a public obfuscation/decode key

```bash
rg '(atob|btoa|obfuscation|_encoded|TextDecoder|TextEncoder|inflate)' evidence/source
rg '(codeToComponent|codeToProp|components.*sort|properties.*sort)' evidence/source
```

When decoding, record:

- input definition path
- key source path and whether it is public
- decode algorithm source
- decoded schema hash
- target IDs using the decoded definition

Base64 + XOR pattern:

```python
import base64, json

def decode(encoded, key):
    raw = base64.b64decode(encoded)
    key_bytes = key.encode("utf-8")
    decrypted = bytes([raw[i] ^ key_bytes[i % len(key_bytes)] for i in range(len(raw))])
    return json.loads(decrypted.decode("utf-8"))
```

Treat hard-coded keys in examples as stale. Extract keys dynamically from the current public source and bind them to the target route.

After decoding, validate the definition by checking that component tree, resources, and render route match target runtime evidence.
