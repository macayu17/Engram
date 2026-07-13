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
assert.match(page, /LandingPage/, "Root page must render the landing design");
assert.match(landing, /Every model[\s\S]*forgets\. Engram[\s\S]*remembers\./, "Landing hero must match the supplied design copy");
assert.match(landing, /Embed[\s\S]*Search[\s\S]*Rank[\s\S]*Inject/, "Landing hero must show the supplied memory flow");
assert.match(landing, /id="how"[\s\S]*id="interfaces"[\s\S]*id="start"[\s\S]*id="compare"/, "Landing page must include the supplied major sections");
assert.doesNotMatch(landing, /engram_accent|Accent color|onAccentChange/, "Temporary accent controls must not ship");
assert.match(globalStyles, /--color-signal: 90 168 158;/, "Dark mode must default to teal");
assert.match(globalStyles, /\[data-theme="light"\][\s\S]*--color-signal: 37 116 107;/, "Light mode must default to teal");
assert.match(globalStyles, /\[data-theme="light"\][\s\S]*--color-paper: 224 222 215;/, "Light mode must use a restrained paper tone");
assert.match(globalStyles, /\[data-theme="light"\][\s\S]*--color-panel: 233 231 224;/, "Light panels must remain distinct without becoming white");
assert.match(landingMotion, /gsap\.context/, "Landing motion must be scoped to its root");
assert.match(landingMotion, /gsap\.matchMedia/, "Landing pinning must be responsive");
assert.match(landingMotion, /prefers-reduced-motion/, "Landing motion must honor reduced motion");
assert.match(landingMotion, /context\.revert\(\)/, "Landing motion must clean up on unmount");
assert.match(landing, /LandingMotion/, "Landing page must use the motion controller");
assert.match(landing, /data-motion="interfaces-track"/, "Interfaces must expose a horizontal motion track");
assert.doesNotMatch(landingMotion, /\[data-motion='loop-card'\][\s\S]{0,240}autoAlpha/, "Loop cards must never depend on animation-owned visibility");
assert.match(landingMotion, /\[data-motion='loop-card'\][\s\S]{0,500}immediateRender: false/, "Loop cards must remain visible until their reveal starts");
assert.match(landing, /data-motion="section-heading"/, "Landing sections must expose heading motion hooks");
assert.doesNotMatch(landingMotion, /Lenis|cursor-ring|preloader/, "Balanced motion must exclude cinematic behavior");
assert.match(appFrame, /pathname === "\/"/, "Public root must bypass product dashboard chrome");
assert.match(appFrame, /aria-current/, "Product navigation must expose the active route");
assert.match(appFrame, /href: "\/overview"/, "Product navigation must include Overview");
assert.match(appFrame, /id="product-content"/, "Product shell must expose a stable content target");
assert.match(appFrame, /Skip to product content/, "Product shell must include a keyboard skip link");
assert.match(productPageHeader, /font-serif/, "Product headers must reuse landing typography");
assert.match(productPageHeader, /text-signal/, "Product headers must reuse the landing signal color");
assert.ok((productHeaderConsumers.match(/ProductPageHeader/g) ?? []).length >= 8, "Core product routes must use the shared page header");
assert.doesNotMatch(globalStyles, /memory-hero-orbit|memory-constellation/, "Global styles must not retain rejected visual layers");
assert.match(graph, /active \? "text-ink" : "text-muted opacity-60"/, "Graph filters must use theme-aware label colors");
assert.doesNotMatch(graph, /active \? "#cbd5e1"/, "Graph filters must not hardcode dark-mode text");
assert.match(graph, /canvasBg: "#e0ded7"/, "Graph light canvas must use the current paper palette");
assert.doesNotMatch(graph, /canvasBg: "#f4efe5"|labelColor: "#cbd5e1"|labelDimColor: "#94a3b8"/, "Graph chrome must not retain the previous palette");
assert.match(settings, /api\.billing\.(portal|checkout)/, "Original settings must expose hosted billing");
assert.match(settings, /createManagedKeyMutation/, "Original settings must expose named workspace keys");

console.log("Engram visual system verification passed");
