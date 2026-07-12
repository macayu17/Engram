import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";


const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const home = read("src/components/HomeDashboard.tsx");
const constellation = read("src/components/MemoryConstellation.tsx");
const graph = read("src/components/MemoryGraph.tsx");
const settings = read("src/components/SettingsPanel.tsx");

assert.match(home, /MemoryConstellation/, "Original constellation hero must remain active");
assert.match(constellation, /PROFILE FACTS|PROJECT CONTEXT|PREFERENCES/, "Constellation must use meaningful memory clusters");
assert.match(constellation, /memory-constellation__gateway/, "Constellation must show the ranking gateway");
assert.match(graph, /active \? "text-ink" : "text-muted opacity-60"/, "Graph filters must use theme-aware label colors");
assert.doesNotMatch(graph, /active \? "#cbd5e1"/, "Graph filters must not hardcode dark-mode text");
assert.match(settings, /api\.billing\.(portal|checkout)/, "Original settings must expose hosted billing");
assert.match(settings, /createManagedKeyMutation/, "Original settings must expose named workspace keys");

console.log("Original Engram visual system verification passed");
