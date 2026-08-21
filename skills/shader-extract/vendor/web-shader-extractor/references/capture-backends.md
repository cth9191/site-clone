# Capture Backends

Use after `TARGET_LOCKED`, or as a selected tactical probe while moving from `attributed` to `locked`. Capture only facts bound to the target surface group.

## Common Rules

- Prefer public source/config or runtime objects when they are target-bound.
- Use preload hooks or frame capture when source does not expose the render graph.
- Use bundle slices only when they resolve a named unknown.
- Keep backend facts separate from replay implementation choices.
- Record every hook result as evidence. Hook hits prove only that an API was used; they do not prove the target uses that API until tied to the target surface group, owner, frame, or call path.

## WebGL / WebGL2

Capture:

- surface CSS size, backing size, DPR, and context attributes
- vertex/fragment source or trusted source representation
- attributes, buffers, indices, instancing, or fullscreen primitive
- textures, samplers, formats, dimensions, and asset paths
- pass order, FBOs, attachments, inputs, and outputs
- viewport, scissor, clear, blend, depth, stencil, cull, alpha
- time origin/unit/delta, random, uniform updates, pointer, scroll, resize
- color space, tone mapping, premultiplied alpha, and DOM composite

Common failure cases:

- WebGL1 vs WebGL2 shader syntax
- framebuffer orientation and texture coordinate flips
- premultiplied alpha mismatch
- renderer output color space vs shader internal color space
- time measured in seconds, frames, or platform-specific increments
- hidden parent DOM transforms changing canvas coordinates

### WebGL Preload Hook Map

Use this map when source or runtime objects do not expose enough facts. Hook only the minimum API set needed for the current unknown.

Surface and owner:

- `HTMLCanvasElement.prototype.getContext`
- `OffscreenCanvas.prototype.getContext`
- `HTMLCanvasElement.prototype.transferControlToOffscreen`

Program and shader:

- `createShader`
- `shaderSource`
- `compileShader`
- `getShaderInfoLog`
- `createProgram`
- `attachShader`
- `linkProgram`
- `getProgramInfoLog`
- `useProgram`

Uniforms:

- `getUniformLocation`
- `uniform1f` / `uniform2f` / `uniform3f` / `uniform4f`
- `uniform1i` / `uniform2i` / `uniform3i` / `uniform4i`
- `uniformMatrix*`

Geometry:

- `createBuffer`
- `bindBuffer`
- `bufferData`
- `bufferSubData`
- `vertexAttribPointer`
- `enableVertexAttribArray`
- `bindVertexArray`

Textures:

- `createTexture`
- `bindTexture`
- `texImage2D`
- `texSubImage2D`
- `texParameteri`
- `activeTexture`
- `pixelStorei`

Framebuffers:

- `createFramebuffer`
- `bindFramebuffer`
- `framebufferTexture2D`
- `createRenderbuffer`
- `bindRenderbuffer`
- `framebufferRenderbuffer`

State:

- `viewport`
- `scissor`
- `clearColor`
- `clear`
- `enable` / `disable`
- `blendFunc` / `blendFuncSeparate`
- `blendEquation`
- `depthFunc`
- `cullFace`
- `colorMask`
- `depthMask`

Draw:

- `drawArrays`
- `drawElements`
- `drawArraysInstanced`
- `drawElementsInstanced`

## WebGPU

WebGPU targets do not pass through `gl.shaderSource()`. Treat them as a separate backend.

Capture:

- canvas configuration and preferred format
- shader modules or trusted node/source definitions
- render and compute pipeline descriptors
- bind group layouts and bind groups
- buffers, textures, samplers, and update cadence
- render pass and compute pass order
- command submission sequence
- time, pointer, scroll, resize, random
- output color, alpha, and canvas/DOM composite

Prefer platform/source definitions, readable WGSL, or WebGPU capture tools.
If the site uses Three.js TSL or another node system that targets WebGPU, capture the node definition and renderer route before translating to GLSL or WGSL.

Do not declare WebGPU replay ready because a WebGL shader capture succeeded elsewhere on the page. Evidence must bind to the WebGPU target surface.

### WebGPU Preload Hook Map

- `navigator.gpu.requestAdapter`
- `GPUAdapter.requestDevice`
- `GPUCanvasContext.configure`
- `GPUDevice.createShaderModule`
- `GPUDevice.createRenderPipeline`
- `GPUDevice.createComputePipeline`
- `GPUDevice.createBindGroupLayout`
- `GPUDevice.createBindGroup`
- `GPUDevice.createBuffer`
- `GPUDevice.createTexture`
- `GPUCommandEncoder.beginRenderPass`
- `GPUCommandEncoder.beginComputePass`
- `GPURenderPassEncoder.setPipeline`
- `GPURenderPassEncoder.setBindGroup`
- `GPURenderPassEncoder.draw`
- `GPURenderPassEncoder.drawIndexed`
- `GPUQueue.writeBuffer`
- `GPUQueue.writeTexture`
- `GPUQueue.submit`

## Canvas2D

Canvas2D targets need command, asset, font, and timing facts rather than shader facts.

Capture:

- command stream or readable source
- transforms and clipping
- paths, text, image draws
- gradients, patterns, filters
- `globalCompositeOperation`
- assets and fonts
- timing, random, pointer, scroll, resize
- canvas size, DPR, and DOM composite

Use Vanilla JS for simple Canvas2D baselines. Keep static offscreen buffers when the source uses them. Match font loading and text metrics before tuning positions.

Common failure cases:

- font fallback changes glyph metrics
- DPR scaling applied twice or not at all
- filter/composite order differs from source
- image smoothing settings change texture quality
- random state is re-created every frame in the replay

### Canvas2D Command Capture Map

- `drawImage`
- `fillRect` / `strokeRect` / `clearRect`
- `beginPath` / `moveTo` / `lineTo` / `bezierCurveTo` / `arc` / `fill` / `stroke` / `clip`
- `fillText` / `strokeText`
- `setTransform` / `transform` / `translate` / `rotate` / `scale`
- `save` / `restore`
- `globalAlpha`
- `globalCompositeOperation`
- `filter`
- `createLinearGradient` / `createRadialGradient` / `createPattern`
- `imageSmoothingEnabled`

## OffscreenCanvas And Worker Probes

- Hook `transferControlToOffscreen` before page scripts run when worker ownership is suspected.
- Record worker script URLs and message channels, but do not persist private message payloads unless they are public effect definitions needed for replay.
- Bind OffscreenCanvas evidence back to the visible placeholder canvas or DOM layer before promoting owner or backend facts.
- If worker source cannot be read, capture call timing, canvas dimensions, and message shapes as `PARTIAL` evidence and keep the missing source as a blocking or important unknown.
