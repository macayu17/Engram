import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";


const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const home = read("src/components/HomeDashboard.tsx");
const retrievalTracePath = path.join(root, "src/components/RetrievalTrace.tsx");
const globalStyles = read("src/app/globals.css");
const graph = read("src/components/MemoryGraph.tsx");
const settings = read("src/components/SettingsPanel.tsx");

assert.ok(fs.existsSync(retrievalTracePath), "Product-first hero must include RetrievalTrace");
const retrievalTrace = read("src/components/RetrievalTrace.tsx");
assert.match(home, /RetrievalTrace/, "Home dashboard must render the retrieval trace");
assert.doesNotMatch(home, /memory-hero-orbit|MemoryConstellation/, "Home dashboard must not render the old orbit or constellation");
assert.doesNotMatch(globalStyles, /memory-hero-orbit|memory-constellation/, "Global styles must not retain the old visual layers");
assert.match(retrievalTrace, /Query/, "Retrieval trace must show the query stage");
assert.match(retrievalTrace, /Ranked memories/, "Retrieval trace must show ranked memories");
assert.match(retrievalTrace, /Injected context/, "Retrieval trace must show injected context");
assert.match(graph, /active \? "text-ink" : "text-muted opacity-60"/, "Graph filters must use theme-aware label colors");
assert.doesNotMatch(graph, /active \? "#cbd5e1"/, "Graph filters must not hardcode dark-mode text");
assert.match(settings, /api\.billing\.(portal|checkout)/, "Original settings must expose hosted billing");
assert.match(settings, /createManagedKeyMutation/, "Original settings must expose named workspace keys");

console.log("Engram visual system verification passed");
