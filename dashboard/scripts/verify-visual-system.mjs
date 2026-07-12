import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";


const root = process.cwd();
const css = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const tailwind = fs.readFileSync(path.join(root, "tailwind.config.ts"), "utf8");

assert.match(css, /--color-signal:\s*30 111 82/, "Light mode must use the evergreen signal color");
assert.match(css, /--color-muted:\s*94 102 98/, "Light mode muted text must remain readable");
assert.doesNotMatch(css, /theme-wave/, "Theme wave styles must be removed");
assert.doesNotMatch(css, /200 145 74/, "Old amber signal color must be removed");
assert.doesNotMatch(css, /122 85 40/, "Old brown light-mode signal color must be removed");
assert.match(tailwind, /signal: "rgb\(var\(--color-signal\)/, "Tailwind must expose the signal token");

console.log("Visual system verification passed");
