#!/usr/bin/env node
// Concatenate the probes into one injectable file and EXPORT them onto window.
// Playwright's addInitScript / addScriptTag wrap code in a function scope, so
// bare `function` declarations are NOT globals — the explicit export is required.
const fs = require('fs'), path = require('path');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*[\r\n]/gm, '');
const files = ['surface-map.js', 'motion-probe.js', 'tokens-probe.js'];
let out = files.map((f) => strip(fs.readFileSync(path.join(__dirname, f), 'utf8'))).join('\n');
out += '\n;(function(){ const g = typeof window !== "undefined" ? window : globalThis; Object.assign(g, { instrumentGetContext, surfaceMap, isCanvasAnimating, instrumentMotion, motionProbe, motionSummary, tokensProbe }); })();\n';
const dest = process.argv[2] || path.join(__dirname, 'probes.bundle.js');
fs.writeFileSync(dest, out);
console.log(dest, out.length, 'bytes');
