# Three.js Shader Reconstruction

Use this reference when target-bound evidence shows Three.js shader customization.
Applies to `material.onBeforeCompile`, Three.js TSL, WebGPU node graphs, or material systems that must preserve recorded source behavior.

## onBeforeCompile Failure Cases

### Built-In Function Signatures Vary By Version

Three.js shader chunk signatures change across versions:

```glsl
// r166 and earlier
vec4 getIBLVolumeRefraction(n, v, roughness, diffuseColor, specularColor, specularF90,
  pos, modelMatrix, viewMatrix, projectionMatrix, ior, thickness,
  attenuationColor, attenuationDistance)

// r167+ adds dispersion
vec4 getIBLVolumeRefraction(n, v, roughness, diffuseColor, specularColor, specularF90,
  pos, modelMatrix, viewMatrix, projectionMatrix, dispersion, ior, thickness,
  attenuationColor, attenuationDistance)
```

Always check the target version's actual signature:

```bash
curl -s "https://cdn.jsdelivr.net/npm/three@0.167.0/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js" \
  | tr '\n' ' ' | grep -oE 'vec4 getIBLVolumeRefraction\([^)]+\)'
```

### GLSL Does Not Allow Nested Function Definitions

```glsl
// Wrong.
void main() {
  float myRand(vec2 co) { return fract(sin(...)); }
}

// Correct.
float myRand(vec2 co) { return fract(sin(...)); }
void main() {
  float r = myRand(uv);
}
```

### Preserve Conditional Compilation Guards

Some variables exist only under specific macros:

- `vWorldPosition` requires `USE_TRANSMISSION`
- `vTransmissionMapUv` requires `USE_TRANSMISSIONMAP`
- `roughnessFactor` is available after `lights_physical_fragment`

If replacing `#include <transmission_fragment>`, keep the source guard pattern.

### Avoid Name Collisions

Injected global functions and variables can collide with Three.js internals:

- avoid generic names such as `hash`, `random`, and `noise`
- prefix custom helper names when needed
- prefix uniforms consistently, for example `uDistortion` and `uNoiseTime`

## Preferred Injection Pattern

Modify normals before the existing chunk when the target evidence supports it:

```javascript
material.onBeforeCompile = (shader) => {
  shader.uniforms.uDistortion = { value: 0 };
  shader.uniforms.uNoiseTime = { value: 0 };

  shader.fragmentShader = `
    uniform float uDistortion;
    uniform float uNoiseTime;
    ${noiseGLSL}
  ` + shader.fragmentShader;

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <transmission_fragment>',
    `
    #ifdef USE_TRANSMISSION
    {
      if (uDistortion > 0.0) {
        normal = normalize(normal + uDistortion * vec3(
          snoiseFractal(vWorldPosition * 0.08 + vec3(uNoiseTime)),
          snoiseFractal(vWorldPosition.zxy * 0.08 - vec3(uNoiseTime)),
          snoiseFractal(vWorldPosition.yxz * 0.08)
        ));
      }
    }
    #endif
    #include <transmission_fragment>
    `
  );
};
```

When target evidence shows grain from low sample counts and chromatic aberration, a full `#include <transmission_fragment>` replacement may be required.
Keep the `#ifdef USE_TRANSMISSION` wrapper.
Preserve transmission and thickness map blocks.
Use the correct `getIBLVolumeRefraction` signature.
Pass evidence-derived dispersion/IOR values.

## Effect Source Mapping

| Effect | Source | Implementation |
|---|---|---|
| Glass refraction | `MeshPhysicalMaterial` `transmission` | Three.js built-in |
| Chromatic aberration | different IOR values for R/G/B | replace `transmission_fragment` |
| Film grain | low sample count plus per-pixel random direction | replace `transmission_fragment` |
| Organic distortion | simplex noise perturbing normal/refraction direction | `onBeforeCompile` injection |
| Color offset | `dispersion` property in r167+ | `MeshPhysicalMaterial` built-in |

## TSL Identification

Three.js r170+ TSL composes shader node graphs through JavaScript function chains and compiles them at runtime.

Identification signals:

1. Bundles contain many `uniform` or `shader` terms but very little `precision` or `gl_FragColor`.
2. The target canvas `data-engine` or runtime evidence indicates Three.js r170+.
3. The target-bound source contains chained calls such as `.mul()`, `.add()`, `.toVar()`, or `.assign()`.

## TSL To GLSL Mapping

| TSL | GLSL |
|---|---|
| `screenUV` | `gl_FragCoord.xy / resolution` |
| `viewportSize` | `uniform vec2 resolution` |
| `float()` / `vec2()` / `vec3()` / `vec4()` | same GLSL constructors, though TSL uses JavaScript functions |
| `.mul()` / `.add()` / `.sub()` / `.div()` | `*` / `+` / `-` / `/` |
| `sin()` / `cos()` / `mix()` / `smoothstep()` | same names |
| `clamp()` / `abs()` / `fract()` / `floor()` | same names |
| `pow()` / `exp()` / `sqrt()` / `dot()` / `length()` | same names |
| `Fn()` | shader function wrapper; inline it into GLSL |
| `uniform()` | `uniform <type> name` |
| `convertToTexture()` | RTT or FBO pass |
| `.sample(uv)` | `texture(sampler, uv)` |
| `.toVar()` / `.assign()` | mutable variable declaration/assignment |
| `.oneMinus()` | `1.0 - x` |

## TSL Reconstruction Steps

1. Locate `fragmentNode` near the target component name or target-bound module.
2. Build the mapping from minified imports to TSL function names using bundle import statements.
   ```javascript
   import { A as screenUV, W as sin, ... } from "three-module"
   ```
3. Translate chained calls into GLSL expressions.
   ```javascript
   // TSL: screenUV.x.sub(center.x).mul(aspect)
   // GLSL: (uv.x - center.x) * aspect
   ```
4. Convert `convertToTexture(childNode)` into an independent FBO pass and sample it with `texture()` in the consuming shader.
