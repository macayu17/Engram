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
