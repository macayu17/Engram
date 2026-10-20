import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";


const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const page = read("src/app/page.tsx");
const landingPath = path.join(root, "src/components/LandingPage.tsx");
const landingMotionPath = path.join(root, "src/components/LandingMotion.tsx");
const appFramePath = path.join(root, "src/components/AppFrame.tsx");
const productPageHeaderPath = path.join(root, "src/components/ProductPageHeader.tsx");
const globalStyles = read("src/app/globals.css");
const graph = read("src/components/MemoryGraph.tsx");
const settings = read("src/components/SettingsPanel.tsx");

assert.ok(fs.existsSync(landingPath), "Public root must include the supplied landing design");
assert.ok(fs.existsSync(landingMotionPath), "Landing motion controller must exist");
assert.ok(fs.existsSync(appFramePath), "Public and product routes must use separate shells");
assert.ok(fs.existsSync(productPageHeaderPath), "Product routes must share one page header");
const landing = read("src/components/LandingPage.tsx");
const landingMotion = read("src/components/LandingMotion.tsx");
const appFrame = read("src/components/AppFrame.tsx");
const productPageHeader = read("src/components/ProductPageHeader.tsx");
const productHeaderConsumers = ["MemoryWorkspace.tsx", "ChatWorkspace.tsx", "LogsWorkspace.tsx", "SettingsPanel.tsx"]
  .map((fileName) => read(`src/components/${fileName}`))
  .join("\n");

const sceneComponents = [
  "SceneForget",
  "SceneEngram",
  "SceneLoop",
  "SceneContext",
  "SceneInterfaces",
  "SceneIndex",
  "SceneClimax",
  "SceneCta",
];
const supportFiles = ["Loader", "LandingNav"];

assert.match(page, /LandingPage/, "Root page must render the landing design");
assert.match(
  landing,
  /SceneForget[\s\S]*SceneEngram[\s\S]*SceneLoop[\s\S]*SceneContext[\s\S]*SceneInterfaces[\s\S]*SceneIndex[\s\S]*SceneClimax[\s\S]*SceneCta/,
  "Landing must compose all eight scenes in story order",
);
assert.match(landing, /landing-scope/, "Landing must use its own scoped palette");
sceneComponents.forEach((name) => {
  assert.ok(fs.existsSync(path.join(root, `src/components/landing/${name}.tsx`)), `Missing scene component ${name}`);
});
supportFiles.forEach((name) => {
  assert.ok(fs.existsSync(path.join(root, `src/components/landing/${name}.tsx`)), `Missing landing support component ${name}`);
});
assert.ok(fs.existsSync(path.join(root, "src/components/landing/copy.ts")), "Landing copy module must exist");
assert.ok(fs.existsSync(path.join(root, "src/components/landing/useSceneTimeline.ts")), "Shared scene timeline hook must exist");

const landingCopy = read("src/components/landing/copy.ts");
const sceneHook = read("src/components/landing/useSceneTimeline.ts");
const sceneSources = sceneComponents.map((name) => read(`src/components/landing/${name}.tsx`)).join("\n");

assert.match(landingCopy, /MODELS FORGET\./, "Climax copy must state the thesis");
assert.match(landingCopy, /ENGRAM REMEMBERS\./, "Climax copy must state the thesis");
assert.match(landingCopy, /\/v1\/chat/, "Interface copy must reference the real proxy endpoint");
assert.match(landingCopy, /#loop[\s\S]*#context[\s\S]*#interfaces[\s\S]*#start/, "Nav anchors must map to scene sections");
assert.doesNotMatch(landing, /MemoryFlowDemo|loop-card|landing-beam|landing-pulse|landing-cursor|landing-grid|landing-delay/, "Old card-based landing must be gone");
assert.doesNotMatch(landing, /engram_accent|Accent color|onAccentChange/, "Temporary accent controls must not ship");

assert.match(sceneSources, /data-scene="forget"/, "Scenes must expose nav tracking hooks");
assert.match(sceneSources, /data-theme-scene="paper"/, "Scenes must declare their theme band");
assert.match(sceneSources, /data-theme-scene="signal"/, "Climax must declare the signal band");
assert.match(sceneSources, /sr-only/, "Display typography must keep accessible headings");
assert.match(sceneSources, /motion-safe:/, "Overlapping layers must degrade for reduced motion");

assert.match(landingMotion, /Lenis/, "Landing motion must use Lenis smooth scrolling");
assert.match(landingMotion, /ScrollTrigger\.update/, "Lenis must drive ScrollTrigger");
assert.match(landingMotion, /prefers-reduced-motion/, "Landing motion must honor reduced motion");
assert.match(landingMotion, /document\.fonts\.ready/, "Timelines must wait for fonts");
assert.match(sceneHook, /gsap\.context/, "Scene motion must be scoped to its root");
assert.match(sceneHook, /gsap\.matchMedia/, "Scene choreography must be responsive");
assert.match(sceneHook, /prefers-reduced-motion/, "Scenes must honor reduced motion");
assert.match(sceneHook, /context\.revert\(\)/, "Scenes must clean up on unmount");

assert.match(globalStyles, /--color-signal: 90 168 158;/, "Dark mode must default to teal");
assert.match(globalStyles, /\[data-theme="light"\][\s\S]*--color-signal: 37 116 107;/, "Light mode must default to teal");
assert.match(globalStyles, /\[data-theme="light"\][\s\S]*--color-paper: 224 222 215;/, "Light mode must use a restrained paper tone");
assert.match(globalStyles, /\[data-theme="light"\][\s\S]*--color-panel: 233 231 224;/, "Light panels must remain distinct without becoming white");
assert.match(globalStyles, /\.landing-scope[\s\S]*--lsignal: 214 255 63;/, "Landing palette must pin its own signal color");
assert.match(globalStyles, /data-theme-scene="paper"/, "Landing scene palettes must exist");
assert.doesNotMatch(globalStyles, /landing-beam|landing-pulse|landing-cursor|landing-memory-row/, "Old landing animations must be removed");
assert.doesNotMatch(globalStyles, /memory-hero-orbit|memory-constellation/, "Global styles must not retain rejected visual layers");

assert.match(appFrame, /pathname === "\/"/, "Public root must bypass product dashboard chrome");
assert.match(appFrame, /aria-current/, "Product navigation must expose the active route");
assert.match(appFrame, /href: "\/overview"/, "Product navigation must include Overview");
assert.match(appFrame, /id="product-content"/, "Product shell must expose a stable content target");
assert.match(appFrame, /Skip to product content/, "Product shell must include a keyboard skip link");
assert.match(productPageHeader, /font-serif/, "Product headers must reuse landing typography");
assert.match(productPageHeader, /text-signal/, "Product headers must reuse the landing signal color");
assert.ok((productHeaderConsumers.match(/ProductPageHeader/g) ?? []).length >= 8, "Core product routes must use the shared page header");
assert.match(graph, /active \? "text-ink" : "text-muted opacity-60"/, "Graph filters must use theme-aware label colors");
assert.doesNotMatch(graph, /active \? "#cbd5e1"/, "Graph filters must not hardcode dark-mode text");
assert.match(graph, /canvasBg: "#e0ded7"/, "Graph light canvas must use the current paper palette");
assert.doesNotMatch(graph, /canvasBg: "#f4efe5"|labelColor: "#cbd5e1"|labelDimColor: "#94a3b8"/, "Graph chrome must not retain the previous palette");
assert.match(settings, /api\.billing\.(portal|checkout)/, "Original settings must expose hosted billing");
assert.match(settings, /createManagedKeyMutation/, "Original settings must expose named workspace keys");

console.log("Engram visual system verification passed");
