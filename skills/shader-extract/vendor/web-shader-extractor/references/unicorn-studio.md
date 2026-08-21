# Unicorn Studio Adapter

Use this adapter only after the target surface group has been attributed to a Unicorn Studio embed, remix, or runtime renderer.
Public APIs and bundle details change.
Verify keys, shader variable names, and initialization routes against the current target.

Stability: volatile. Treat endpoint names, variable names, keys, shader templates, and build-specific mappings as hints until verified on the current target.

Unicorn Studio is a no-code WebGL design tool. Observed runtimes use curtains.js-style multi-pass WebGL rendering and may load scene definitions from Firestore, GCS, or CDN embed data.

## Adapter Interface

- `detect(context)`: target surface is created by Unicorn runtime, target embed/project ID matches the canvas, or public definition maps to the target visual.
- `preferredEvidence(context)`: published embed JSON or public remix/version definition, then target-bound runtime/source route.
- `capture(context)`: scene/history data, compiled shaders or shader templates, layer graph, FBO chain, assets/fonts/textures, timing rules, output composite.
- `replay(context)`: `SOURCE_REPLAY` from embed/version data when possible; `PIPELINE_REPLAY` if only compiled shaders and runtime graph are available.
- `validationHints(context)`: element/child effect FBO chains, transparent `showBg=0`, frame-based `uTime`, glyph atlas compatibility, WebGL environment issues.
- `fallback(context)`: dynamic bundle slice around target effects, then frame capture.

## Recognition Signals

- URL patterns such as `unicorn.studio/remix/{remixId}` or `unicorn.studio/edit/{designId}`
- meta tags or runtime clues referencing Unicorn Studio
- embed SDK paths such as `unicornStudio-*.js`
- application bundle paths such as `index-*.js` or the current dynamic chunk graph
- data attributes such as `data-us-project` or `data-us-project-src`

## Data Acquisition Routes

### Route 1: Firestore REST API

Use this route for remix URLs when public Firestore access is available. Extract Firebase/public API config dynamically from the current frontend bundle.

```bash
# Example discovery pattern; validate against the current site.
curl -s https://www.unicorn.studio/ | grep -oP 'apiKey:"[^"]+"' | head -1

API_KEY="<extract dynamically from current public source>"
PROJECT="unicorn-studio"

# Step 1: Fetch remix metadata, including versionId, designId, and creator metadata.
curl -s "https://firestore.googleapis.com/v1/projects/$PROJECT/databases/(default)/documents/remixes/{REMIX_ID}?key=$API_KEY"

# Step 2: Fetch version data with layers, parameters, and texture references.
curl -s "https://firestore.googleapis.com/v1/projects/$PROJECT/databases/(default)/documents/versions/{VERSION_ID}?key=$API_KEY"
```

### Route 2: GCS/CDN Embed Data

```bash
# Non-Pro projects observed in older samples.
curl -s "https://storage.googleapis.com/unicornstudio-production/embeds/{DESIGN_ID}"

# Pro projects observed in older samples.
curl -s "https://assets.unicorn.studio/embeds/{DESIGN_ID}"
```

Embed JSON may look like `{ options: {...}, layers/history: [...], modules: [...] }` and may include `compiledFragmentShaders[]` and `compiledVertexShaders[]`.

### Route 3: Inline Page JSON

Unicorn Studio embeds may use `data-us-project` or `data-us-project-src` HTML attributes. The SDK `init()` path scans these attributes and loads the corresponding project.

## Identify The Data Shape First

Unicorn Studio data commonly appears in at least two shapes.

### 1. Embed/export scene

- Usually the final scene JSON passed to `addScene()`.
- Often already includes `compiledFragmentShaders[]` and `compiledVertexShaders[]`.
- Can often be replayed through the embed runtime.

### 2. Editor/version history

- Commonly from Firestore `versions/{id}` `history`.
- Represents editor source layer data.
- Do not pass it directly to `addScene()`.

If `history` is misused as an embed scene, common symptoms include:

- `Plane: No fragment shader provided, will use a default one`
- `Plane: No vertex shader provided, will use a default one`
- `No composite shader data for element`
- the canvas exists but renders black or default layers only

## Firestore Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `designs` | design metadata | creatorId, name, versionId, hasEmbed |
| `versions` | core version data | history[], options |
| `remixes` | remixable design metadata | designId, versionId, creatorId, thumbnail |

Firestore REST wraps values as `{stringValue, integerValue, arrayValue, mapValue, ...}`. Parse recursively before implementation.

Each `history` entry is usually one layer:

```text
layerType: "effect" | "text" | "image" | "model" | "shape"
type:      effect type such as gradient, noiseFill, sdf_shape, glyphDither, bloomFast
```

Common layer parameters:

- `pos`, `scale`, `speed`, `opacity`, `blendMode`
- `trackMouse`, `trackAxes`, `mouseMomentum`
- `parentLayer`: UUID or false
- `breakpoints[]` for responsive behavior
- `states` for appear, scroll, hover, and mousemove animation
- `customFragmentShaders[]`, `customVertexShaders[]`; often empty when built-in effects are used

## Initialization Strategy

If the source is Firestore `version/history`, prefer the site's own initialization chain instead of forcing public embed APIs.

Typical observed sequence:

1. `unpackageHistory()` or `unpackVersion()`
2. `createFontScript()`
3. `createCurtains()`
4. `handleItemPlanes()`
5. `fullRedraw()`

If the bundle contains a Remix/Preview component, trace that path before relying on UMD/SDK documentation.

## Resource Localization

- Download image, font, and texture resources locally when permitted.
- Rewrite `history` `src` and `fontCSS.src` to local paths for local replay.
- Normalize numeric-key maps into arrays when needed before writing local JSON.

## Effect-Type Parameters

| Effect | Key parameters |
|---|---|
| gradient | fill[], stops[], gradientType, gradientAngle, wrap |
| noiseFill | noiseType, turbulence, color1, color2, colorPhase, chroma, direction |
| sdf_shape | shape 0-22, refraction, extrude, smoothing, axis, animationDirection, lightPosition |
| glyphDither | characters, glyphSet, scale, gamma, monochrome, sprite atlas texture |
| bloomFast | amount, intensity, exposure, tint |

## Shader Extraction

Some embed SDKs do not contain GLSL shader code.
Shader templates may live in the main application bundle or a dynamic chunk.
They may be compiled into embed JSON through a processing pipeline.
Use the current target's network and source evidence.

### Shader Template Locations

Observed older bundles used string literals identified by minified variables:

```text
Effect name       observed variable
glyphDither       X$ fragment
noiseFill         WY fragment
sdf_shape         XY fragment
gradient          eX fragment
bloomFast         Hj fragment
generic vertex    ye
gradient vertex   ko
composite frag    Uz
composite vertex  Nz
```

Variable names change with builds. Search by semantic shader features rather than fixed names.

### Template Variables

Shader templates may include `${variable}` placeholders replaced at compile time:

| Placeholder | Observed meaning |
|---|---|
| `${fe}` | mask-related uniform declarations |
| `${Vt}` | layer blending helpers such as `applyLayerMix`, `applyLayerMixAlpha`, `applyLayerMixClip` |
| `${gt}` | PCG hash / random helpers such as `pcg2d`, `randFibo` |
| `${ht}` | blend mode helpers |
| `${pe("var")}` | mask application plus `fragColor` output |
| `${wf}` | BCC noise derivatives / OpenSimplex2S |
| `${Aa}` | Perlin noise helpers |
| `${yr}` | debanding dither |
| `${cm}` | gradient color/stop uniform declarations |
| `${xz}` | Gaussian weights for bloom blur |

### Observed Compile Pipeline

```text
1. Fz(): replace uniform values with constants
2. Dz(): handle gradient color counts and switch-case pruning
3. Mz(): evaluate constant switches / dead code elimination
4. Rz(): handle #ifelseopen / #ifelseclose blocks
5. Iz(): remove unused functions
6. Cz(): remove unused uniform declarations
7. Bp(): strip comments and normalize whitespace
```

## Render Pipeline

Replay must restore the pipeline, not only individual shaders.

```text
curtains.js-style WebGL2 renderer
|- each effect layer = one Plane + independent FBO
|- layers render linearly by renderOrder, each plane reading previous FBO as uTexture
|- Element layers (shape/text/image) plus child effects form a render group:
|  1. Element plane renders first -> FBO_elem
|  2. Child effects render in effects[] order -> FBO_child1, FBO_child2, ...
|  3. Composite plane alpha-blends child output back into the background scene
|- standalone post effects with parentLayer=false process the global scene
`- final plane outputs directly to canvas without an FBO
```

### Element + Child Effect FBO Chain

Shape group example:

```text
FBO_before ----------------------------------------------------.
                                                              |
Shape plane -> FBO_shape                                      |
    |                                                         |
Child noiseFill -> FBO_noise (uBgTexture = FBO_shape)         |
    |                                                         |
Child sdf_shape -> FBO_sdf (uTexture = FBO_noise)             |
    | showBg=0 means outside shape = vec4(0) transparent      |
    |                                                         |
Composite plane -> FBO_result                                |
    uTexture = FBO_sdf                                       |
    uBgTexture = FBO_before ---------------------------------'
    output = alpha_blend(fg, bg) = fg + bg * (1.0 - fg.a)
```

### Child Effect Association

```js
// Element effects[] lists child-effect parentLayer UUIDs.
shape.effects = ["e270a7cd-...", "fb591190-..."];

// Each child effect references one parent element UUID.
noiseFill.parentLayer = "e270a7cd-...";   // effects[0]
sdf_shape.parentLayer = "fb591190-...";   // effects[1]

// Embed runtime lookup pattern:
getChildEffectItems() {
    return this.effects.map(uuid =>
        state.layers.find(l => l.parentLayer === uuid)
    ).filter(Boolean);
}
```

## Time Base

Observed embed SDKs may use frame accumulation for `uTime`, not seconds:

```js
// In setEffectPlaneUniforms():
t.uniforms.time.value += speed * 60 / this.fps;
```

At 60 fps, `uTime += speed` each frame. After one second, `uTime = speed * 60`.

| Effect layer | speed | uTime after one second |
|---|---:|---:|
| noiseFill | 0.25 | 15 |
| sdf_shape | 0.5 | 30 |
| gradient | 0.25 | 15 |

Replay must match the target time model:

```js
// Correct for frame-accumulation samples:
uni1f(prog, 'uTime', elapsedSeconds * speed * 60);

// Wrong for those samples:
uni1f(prog, 'uTime', elapsedSeconds);
```

## `showBg`

- `showBg=0`: ray miss outputs `vec4(0)`, fully transparent rather than opaque black.
- `showBg=1`: ray miss samples `uTexture` / `uBgTexture`, showing background content.

If `showBg=0` is incorrectly replayed as `vec4(0,0,0,1)`, composite alpha blending is blocked and the lower layer disappears. Ensure `alpha=0`.

## Replay Strategy

1. Simple 2D post effects such as `glyphDither` or `bloomFast`: native WebGL2 fullscreen quad can be suitable.
2. Generative effects such as `noiseFill` or `gradient`: native WebGL2 can be suitable when facts are complete.
3. 3D SDF such as `sdf_shape`: native WebGL2 raymarching can be suitable.
4. Complex scenes: preserve a multi-pass FBO graph.
5. Text layers: render text with Canvas2D and upload it as a WebGL texture.

## Playwright Verification

Headless Playwright may not have a usable WebGL environment. Treat these symptoms as environment issues before changing extraction logic:

- `Renderer: WebGL context could not be created`
- `0 canvas(es) found`
- `Error creating Curtains instance`
- black screenshot

Try SwiftShader-backed validation when needed:

```bash
--use-angle=swiftshader
--use-gl=angle
--enable-unsafe-swiftshader
--ignore-gpu-blocklist
```

Suggested validation order:

1. Determine whether console output shows shader/runtime errors or WebGL context creation failure.
2. Confirm that the DOM actually creates a `canvas`.
3. Capture a SwiftShader screenshot.
4. Compare composition against the source thumbnail or first viewport screenshot.

## Glyph Atlas Generation

Original glyph atlases may be base64 PNGs with cross-browser compatibility issues. Canvas2D generation can be more portable:

```js
function createGlyphAtlas(chars, size = 40) {
  const canvas = document.createElement('canvas');
  canvas.width = size * chars.length;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${size * 0.8}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], size * i + size / 2, size / 2);
  }
  return canvas;
}
```

Upload the generated atlas with:

```js
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
```

## Cloud Functions

Observed endpoint base:

```text
https://us-central1-unicorn-studio.cloudfunctions.net/
```

Examples:

- `publishEmbedTest`: publish/update embed; requires authentication
- `getUserIdByUsername`: username to userId
- `handleVideos`, `handleModels`, `handleImages`: asset handling
- `generateImprovedMSDF`: MSDF text rendering
- `generateDepthMap`: depth map generation
- `copyRemixAssets`: remix asset copy

Do not call authenticated endpoints unless the user has explicitly authorized the session and the action is within scope.

## Example Extraction Skeleton

```bash
# 1. Extract remix ID from URL.
REMIX_ID="QZxhNFb1X1OaUqaJLT9S"

# 2. Fetch remix metadata.
curl -s "https://firestore.googleapis.com/v1/projects/unicorn-studio/databases/(default)/documents/remixes/$REMIX_ID?key=$API_KEY" > remix.json

# 3. Extract versionId.
VERSION_ID=$(python3 -c "import json; print(json.load(open('remix.json'))['fields']['versionId']['stringValue'])")

# 4. Fetch version data.
curl -s "https://firestore.googleapis.com/v1/projects/unicorn-studio/databases/(default)/documents/versions/$VERSION_ID?key=$API_KEY" > version.json

# 5. Recursively parse Firestore REST wrappers into layer and parameter data.

# 6. Fetch the current target-bound app bundle or source slice and locate shader templates by effect type.

# 7. Combine parameters and shader templates into the chosen replay route.
```
