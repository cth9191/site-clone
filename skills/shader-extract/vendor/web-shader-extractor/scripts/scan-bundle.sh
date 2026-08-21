#!/bin/bash
# Scan JS bundle slice(s) for WebGL/shader keywords and report hypotheses.
# Usage: scan-bundle.sh <file1.js> [file2.js ...]
# Output: keyword counts + tech stack hypotheses. These are not target-bound conclusions.

set -eu

if [ $# -eq 0 ]; then
    echo "Usage: scan-bundle.sh <file1.js> [file2.js ...]"
    echo "Scans JS files for WebGL/shader keywords and produces hypotheses."
    exit 1
fi

FILES=("$@")

echo "=== SHADER/WEBGL KEYWORD SCAN ==="
echo ""

# Core GLSL keywords
echo "--- GLSL Keywords ---"
for kw in "gl_FragColor" "gl_Position" "gl_PointSize" "gl_PointCoord" \
          "precision" "uniform" "varying" "attribute" \
          "FRAGMENT_SHADER" "VERTEX_SHADER" "createShader" \
          "sampler2D" "texture2D" "smoothstep" "discard"; do
    count=$(grep -o "$kw" "${FILES[@]}" 2>/dev/null | wc -l | tr -d ' ')
    [ "$count" -gt 0 ] && printf "  %-25s %s\n" "$kw" "$count" || true
done

echo ""
echo "--- WebGL/Canvas Keywords ---"
for kw in "canvas" "webgl" "webgl2" "getContext" "shader" "glsl" \
          "framebuffer" "renderbuffer" "drawArrays" "drawElements" \
          "bufferData" "texImage2D" "POINTS"; do
    count=$(grep -oi "$kw" "${FILES[@]}" 2>/dev/null | wc -l | tr -d ' ')
    [ "$count" -gt 0 ] && printf "  %-25s %s\n" "$kw" "$count" || true
done

echo ""
echo "--- Noise/Math Keywords ---"
for kw in "snoise" "simplex" "perlin" "noise" "PoissonDisk" "Poisson"; do
    count=$(grep -o "$kw" "${FILES[@]}" 2>/dev/null | wc -l | tr -d ' ')
    [ "$count" -gt 0 ] && printf "  %-25s %s\n" "$kw" "$count" || true
done

echo ""
echo "=== TECH STACK HYPOTHESES (NOT TARGET LOCK) ==="

detect() {
    local label="$1" pattern="$2"
    local count
    count=$(grep -oE "$pattern" "${FILES[@]}" 2>/dev/null | wc -l | tr -d ' ')
    [ "$count" -gt 0 ] && printf "  %-25s %s hits (hypothesis)\n" "$label" "$count" || true
}

# Frameworks (patterns specific enough to avoid false positives)
detect "Three.js"              "THREE\.|WebGLRenderer|ShaderMaterial|BufferGeometry|PerspectiveCamera|OrthographicCamera"
detect "Three.js (minified)"   "setRenderTarget|DataTexture|setPixelRatio|setClearColor"
detect "PixiJS"                "PIXI\.|pixi\.js|PixiJS"
detect "Babylon.js"            "BABYLON\.|babylonjs"
detect "Raw WebGL"             "gl\.bindBuffer|gl\.bindTexture|gl\.useProgram|gl\.attachShader|gl\.linkProgram"
detect "Regl"                  "regl\(|regl\.frame|regl\.texture"
detect "OGL"                   "ogl\.|ogl/"

# Patterns. Generic RenderTarget hits are common post-processing evidence, not GPGPU.
detect "GPGPU/simulation clues" "ping[-_.]?pong|GPUComputationRenderer|DataTexture|feedback|simulation|compute"
detect "Particles"             "gl_PointSize|gl_PointCoord|PointSize|particl"
detect "Post-processing"       "EffectComposer|RenderPass|ShaderPass|postprocess"
detect "Ray marching"          "rayMarch|sdSphere|sdBox|sdRoundBox"
detect "Instancing"            "InstancedMesh|InstancedBufferGeometry|instanceMatrix"

echo ""
echo "=== FILE SIZES ==="
for f in "${FILES[@]}"; do
    size=$(wc -c < "$f" | tr -d ' ')
    echo "  $(basename "$f"): ${size} bytes"
done

echo ""
echo "Reminder: bind any hypothesis to the target surface group before using it as implementation evidence."
echo "GPGPU requires combined evidence such as feedback loops, ping-pong pairs, data-texture simulation, or compute-like update passes."
