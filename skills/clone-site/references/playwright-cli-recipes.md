# playwright-cli recipes for this skill

`playwright-cli` is a CLI over a persistent browser session. Each invocation is
a separate process, which shapes how you must use it here.

## Running the probe scripts

```bash
# inject the probe bundle into the LIVE page, then evaluate
playwright-cli -s=<name> run-code "async page => { await page.addScriptTag({ path: '<abs>/probes.bundle.js' }); return page.evaluate(() => motionSummary()); }"
```
Build `probes.bundle.js` with `node scripts/build-bundle.js [dest]` — it concatenates
the three probe files AND exports them onto `window`. That export is mandatory:
Playwright wraps `addInitScript`/`addScriptTag` code in a function scope, so
bare `function` declarations are invisible to later `page.evaluate` calls
(symptom: `motionSummary is not defined` even though the script ran). `run-code` has **no `fs`** — return data and redirect
stdout, or use `eval` and parse the `### Result` block:

```bash
playwright-cli -s=<name> eval "JSON.stringify(tokensProbe())" > raw.txt
# then unwrap: the JSON is the quoted string after the '### Result' line
```
`eval` treats an expression starting with `(` as a function — wrap IIFEs in
`run-code` + `page.evaluate` instead.

## Instrumented (preload) mode — do it in ONE run-code call

`page.addInitScript()` registered in one `run-code` invocation does NOT
survive into the next (the CLI's `page` binding is re-created). Do init +
navigate + settle + probe in a single call:

```bash
playwright-cli -s=<name> run-code "async page => {
  await page.addInitScript({ path: '<abs>/probes.bundle.js' });
  await page.addInitScript(() => { instrumentGetContext(); instrumentMotion(); });
  await page.goto('<url>', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) { await page.mouse.wheel(0, 700); await page.waitForTimeout(120); }
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800);
  return page.evaluate(() => ({ sm: surfaceMap(), mo: motionProbe() }));
}" > raw-instrumented.txt
```
Verify `mo.instrumented === true`; if false the preload didn't take.

## Capturing hidden SPA state

```bash
playwright-cli -s=<name> run-code "async page => { const tabs = page.locator('.tabs .tab'); const out = []; for (let i = 0; i < await tabs.count(); i++) { await tabs.nth(i).click(); await page.waitForTimeout(800); out.push(await page.evaluate(() => document.querySelector('.tabs-content').innerHTML)); } return out; }"
```

## Asset list

`playwright-cli network` only logs from the moment it's first called. For the
full list use the page's own record:
`page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name))`.

## Screenshots

`page.screenshot({ path })` inside `run-code` works and is the reliable way to
get section references regardless of which browser tool is fronted.

## Headless GPU note

Headless Chromium on a desktop with a real GPU often exposes a real GPU renderer string, so sites
that gate shaders on `WEBGL_debug_renderer_info` DO render them in QA — mask
`[data-paper-shader]`, `canvas`, and any wrapper the library injects. Don't
assume headless = software GL.
