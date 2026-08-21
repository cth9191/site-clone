# shaders.com / TSL Adapter

Use this adapter only after the target surface group has been attributed to a shaders.com renderer or a shaders.com public definition.
Treat versions, keys, mappings, and backend choice as runtime facts to verify on the current target.

Stability: volatile. Treat endpoint names, variable names, keys, component IDs, short-code mappings, and backend choices as hints until verified on the current target.

shaders.com is a shader design tool. Observed builds use Nuxt.js, Three.js TSL, and Supabase. Verify the exact Three.js version and WebGPU/WebGL backend from target runtime or current bundle evidence.

## Adapter Interface

- `detect(context)`: target canvas has shaders.com renderer evidence, target route/API returns the matching preset/collection definition, or runtime owner binds the renderer to target.
- `preferredEvidence(context)`: public collection/preset definition, current runtime config, and target-bound Three.js/TSL module route.
- `capture(context)`: component tree, decoded definition, TSL node source, assets/SDFs, renderer backend, time/input rules, color/output model.
- `replay(context)`: `SOURCE_REPLAY` when definition and TSL source are sufficient; `PIPELINE_REPLAY` when runtime/capture facts are sufficient but source is incomplete.
- `validationHints(context)`: SDF Y flip, linear color pipeline, TSL timer rules, Glass parameter fidelity, WebGPU vs WebGL backend.
- `fallback(context)`: target-bound source-map or module slice, frame capture, then behavior rebuild with explicit downgrade.

## Recognition Signals

- URL pattern: `shaders.com/collection/{slug}/{presetId}` or `shaders.com/preset/{id}`
- Canvas hints such as `data-renderer="shaders"` plus `data-engine`; verify the version dynamically
- Nuxt.js paths such as `_nuxt/`
- Clerk authentication on the site
- Supabase storage URLs such as `data.shaders.com/storage/v1/`

## Architecture Differences

Compared with Unicorn Studio:

- It commonly uses Three.js TSL node graphs rather than raw GLSL source.
- It has multiple component types, each potentially backed by a TSL `fragmentNode`; verify the current count and names from the current bundle.
- Definition data may be XOR + base64 encoded.
- Components can be nested; for example a Glass component may contain child effects.

## Data Acquisition

### API Endpoints

```bash
# Collection variant with encoded definition; public when accessible without auth.
curl -s "https://shaders.com/api/collections/{slug}/{variantId}"

# Preview API with encoded definition and possible watermark injection.
curl -s "https://shaders.com/api/preview/preset/{presetId}"

# Nuxt payload, usually metadata only rather than shader definition.
curl -s "https://shaders.com/collection/{slug}/{id}/_payload.json"
```

### Definition Decoding

Definitions may use XOR + base64 encoding with route-specific keys.

1. Website API (`/api/collections/`):
   - Extract the obfuscation key from the current Nuxt runtime config. Do not reuse fixed keys from old samples.
   - Component/property names may use short codes such as `C52` for `Plasma` or `p06` for `angle`.
   - Decode with `JSON.parse(XOR(base64decode(encoded), keyBytes))`.
   - Restore readable names with the current code-to-name mapping table.

2. Preview API (`/api/preview/`):
   - Verify the key and response shape from the current public frontend code.
   - It may use readable property names directly.
   - It may inject a watermark `ImageTexture` component.

### Code Mapping Table

Extract component and property short-code mappings from the current JS bundle. Do not assume component counts, sorting, or numeric IDs are stable across releases.

## Known Failure Cases

### Y-Axis Flip

Observed shaders.com samples show a Y flip for SDF textures and UVs.

SDF binaries (`.bin`) often use image coordinates where Y=0 is at the top, while WebGL texture coordinates use Y=0 at the bottom. Loading them directly can flip shapes vertically.

```glsl
// Wrong: direct sampling.
float sdf = texture(tSDF, shapeUV).r;

// Correct for known flipped SDFs: flip Y.
vec2 sdfUV = vec2(shapeUV.x, 1.0 - shapeUV.y);
float sdf = texture(tSDF, sdfUV).r;

// The Y component of the gradient may also need sign inversion.
float dSdy = -(texture(tSDF, sdfUV - vec2(0, eps)).r - sdf) / eps;
```

Component definitions may also use DOM coordinates where Y=0 is at the top. For Glass-style shaders, verify whether `center.y` must be flipped as `center.y = 1.0 - center.y`.

### SDF Binary Format

Known samples use:

- 512 x 512 Float32 single-channel data
- 1,048,576 bytes: `512 * 512 * 4`
- signed distance values, negative inside and positive outside
- raw values without `* 2.0 - 1.0` remapping
- `OES_texture_float_linear` for linear filtering when needed

WebGL2 loading pattern:

```js
gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 512, 512, 0, gl.RED, gl.FLOAT, data);
```

## Component Table

| Category | Components | Complexity |
|---|---|---|
| Texture | Plasma, Godrays, SimplexNoise, LinearGradient, RadialGradient | medium |
| Shape | Glass, Blob, Circle, Ring, Star, RoundedRect, Polygon | high |
| Distortion | WaveDistortion, ChromaticAberration, Liquify, Twirl, Bulge | low to medium |
| Stylization | FilmGrain, Halftone, Ascii, Dither, Glow, Bloom | low to medium |
| Post-processing | Blur, ProgressiveBlur, BrightnessContrast, HueShift | low |

## Render Pipeline

Typical target-bound evidence may reveal:

```text
Three.js TSL renderer; verify version dynamically
|- prefers WebGPU, falls back to WebGL
|- orthographic camera plus one fullscreen quad
|- component tree composited bottom to top
|- components with children capture child content through RTT
|- blend mode implemented with custom blend functions
`- Glass path: SDF evaluation -> gradient normal -> refraction -> chromatic aberration -> blur -> tint -> highlight -> Fresnel -> composite
```

## Replay Strategy

1. TSL cannot be copied as raw GLSL; translate it or replay it through the source stack.
2. Extract the target-bound TSL `fragmentNode` from the current JS bundle when source replay requires it.
3. Convert the component tree into a multi-pass FBO graph.
4. Validate SDF Y orientation against the target.
5. Glass components have many parameters; keep source multipliers exact.

## Color Space

Known shaders.com / Three.js TSL samples commonly use a linear workflow, but the current target must still be verified from renderer, runtime, or source evidence.

- Hex colors such as `#2c2c42` are commonly sRGB values.
- TSL `color()` commonly converts sRGB to linear.
- Whether intermediate FBOs store linear values must be verified from the target render graph.
- The final output encoding stage must be verified from target renderer configuration.

Example for a common path:

```glsl
// Common path: sRGB hex -> linear at definition time.
vec3 colorA = pow(vec3(0.173, 0.173, 0.259), vec3(2.2));  // #2c2c42

// Intermediate passes and final output encoding must follow target evidence.
fragColor = vec4(pow(color.rgb, vec3(1.0 / 2.2)), color.a);
```

Error case: applying a fixed gamma correction in intermediate or final passes without verifying the target renderer's color configuration.

## Parameter Fidelity

Do not tune parameters manually. Match the formulas and multipliers from the TSL translation:

```text
Original TSL multiplier       GLSL must use
aberration * 0.06             not 0.12
fresnelSoftness * 0.06        not 0.12
fresnel = 0.17                not 0.4
SDF gradient eps = 0.01       not 0.005
```

If the visual result does not match, inspect:

1. color space, especially sRGB/linear confusion
2. noise implementation differences such as Perlin vs `mx_noise_float`
3. time base
4. FBO/component-tree order

Do not change multipliers to mask a mismatch. That may fit one preset while breaking other parameter combinations.

## TSL Time Convention

`timerLocal(speed)` increments by `speed` units per second. Replay as `uTime = seconds * speed`, then apply any component-specific multiplier inside the shader.

| Component | speed parameter | shader multiplier | effective rate per second |
|---|---:|---:|---:|
| Plasma | 2 | 0.125 | 0.25 |
| Godrays | 0.7 | 0.2 | 0.14 |
| WaveDistortion | 0.8 | 0.5 | 0.4 |
| FilmGrain | none | none | static |

## TSL To GLSL Identifier Mapping

These mappings are examples from one observed bundle and may change. Extract them dynamically from the current build.

| Local name | TSL function | GLSL |
|---|---|---|
| `C` / `z` | `vec4()` | `vec4` |
| `x` / `D` | `vec2()` | `vec2` |
| `q` / `N` | `vec3()` | `vec3` |
| `P` / `J` | `resolution` | `u_resolution` |
| `A` / `$` | `uv` | `vUv` |
| `se` / `Oe` | `sin()` | `sin` |
| `W` / `I` | `cos()` | `cos` |
| `ne` | `mix()` | `mix` |
| `D` | `smoothstep()` | `smoothstep` |
| `fe` | `clamp()` | `clamp` |
| `ar` | `mx_noise_float()` | `perlinNoise3D()` candidate |
| `dr` / `Gt` | `timerLocal()` | `u_time * speed` |
| `Me` / `wt` | `rtt()` | FBO pass |
| `Ce` | `renderOutput()` | `fragColor` |
