import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const apiSource = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const reviewSource = await readFile(new URL("../src/components/MemoryConflictReview.tsx", import.meta.url), "utf8");
const workspaceSource = await readFile(new URL("../src/components/MemoryWorkspace.tsx", import.meta.url), "utf8");

assert.match(apiSource, /export type MemoryConflictResolution/);
assert.match(apiSource, /conflicts:/);
assert.match(apiSource, /resolveConflict:/);
assert.match(reviewSource, /Use new/);
assert.match(reviewSource, /Keep current/);
assert.match(reviewSource, /Keep both/);
assert.match(workspaceSource, /\["memories", "conflicts"\]/);
assert.match(workspaceSource, /invalidateQueries\(\{ queryKey: \["memories"\] \}\)/);

process.stdout.write("PASS dashboard memory conflict workflow\n");
