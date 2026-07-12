import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const root = process.cwd();
const ts = await import(pathToFileURL(join(root, "node_modules", "typescript", "lib", "typescript.js")));

function loadTsModule(relativePath) {
  const source = readFileSync(join(root, relativePath), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      strict: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports }, { filename: relativePath });
  return module.exports;
}

const { extractChatResponseContent } = loadTsModule("src/lib/chat-response.ts");
const settingsSource = readFileSync(join(root, "src/components/SettingsPanel.tsx"), "utf8");

assert.equal(
  extractChatResponseContent({
    choices: [{ message: { content: "OpenAI style response" } }],
  }),
  "OpenAI style response",
);

assert.equal(
  extractChatResponseContent({
    content: [{ type: "text", text: "Anthropic text block" }],
  }),
  "Anthropic text block",
);

assert.equal(
  extractChatResponseContent({
    content: "Plain content response",
  }),
  "Plain content response",
);

assert.equal(
  extractChatResponseContent({
    output_text: "Responses API text",
  }),
  "Responses API text",
);

assert.equal(
  extractChatResponseContent({ custom: true }),
  JSON.stringify({ custom: true }),
);

process.stdout.write("PASS dashboard chat response parser\n");

for (const heading of ["Workspace", "Members", "API keys", "Providers", "Billing", "Account"]) {
  assert.match(settingsSource, new RegExp(`title=\\"${heading}\\"`), `Settings must include ${heading}`);
}
assert.match(settingsSource, /api\.billing\.(checkout|portal)/, "Settings must route subscription actions through api.billing");
assert.match(settingsSource, /anthropic_api_key/, "Settings must save Anthropic keys");
assert.match(settingsSource, /clear_anthropic_key/, "Settings must clear Anthropic keys");
assert.match(settingsSource, /!hosted/, "Hosted settings must hide the local API-key form");

process.stdout.write("PASS dashboard SaaS settings source\n");
