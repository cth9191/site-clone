# Tool Capability Matrix

The skill depends on capabilities, not specific tool names. Probe available tools first, then choose the smallest sufficient profile.

## Capability Names

```text
navigate
runtime-eval
preload-script
network-metadata
network-body
source-map
canvas-screenshot
interaction
frame-capture-webgl
frame-capture-webgpu
local-run
multi-frame-compare
```

## Profiles

### Profile A: Light Scout

Use for navigation, runtime eval, canvas inventory, screenshots, pointer/scroll/resize, and network overview.
A browser CLI, browser MCP, or host browser automation can satisfy this profile.

If Playwright is already installed, `scripts/fetch-rendered-dom.mjs` can serve as an optional inventory helper for DOM/canvas/network observations.
It does not perform Surface Attribution, Target Lock, Replay Ready, or QA gates.
Treat its output as inventory and hypothesis evidence only.

### Profile B: Chrome Deep Diagnostics

Use for pre-navigation init scripts, source-mapped stacks, response bodies, performance traces, and existing Chrome sessions.
CLI fits batch work. MCP fits continued interaction.

### Profile C: GPU Capture

Use WebGL frame capture or WebGPU recorders only after target and backend are known. GPU tools are optional adapters, not first-strike requirements.

### Profile D: Static Fallback

Use HTML, public API, source maps, dynamic chunk graph, and narrow bundle slices. Do not default to full deobfuscation.

`scripts/scan-bundle.sh` may be used on a target-bound slice to count shader/framework keywords.
Treat every result as a hypothesis that still needs target-bound evidence.
Do not infer GPGPU from generic `RenderTarget`, generic `DataTexture`, or post-processing hits.
Require feedback-loop, ping-pong pair, data-texture simulation, or compute-like update evidence.

## Rules

- Do not require a single MCP before starting.
- Do not silently install large dependencies.
- If a tool is missing, downgrade to the closest capability and record the gap.
- If connecting to an existing logged-in browser, warn that credentials/page data may be visible to the agent and avoid persisting sensitive material.
- Store variable tool/version observations in run artifacts, not hard-coded skill instructions.
