import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const root = process.cwd();
const ts = await import(pathToFileURL(join(root, "node_modules", "typescript", "lib", "typescript.js")));

function loadTsModule(relativePath, context = {}) {
  const source = readFileSync(join(root, relativePath), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      strict: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, ...context }, { filename: relativePath });
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

const { buildConnectionConfig, validateAuthorizationParams } = loadTsModule("src/lib/connection-config.ts");
const safeConfig = JSON.parse(buildConnectionConfig("claude", "C:\\Engram\\mcp\\dist\\index.js", "http://localhost:8000", "research"));
assert.equal(safeConfig.mcpServers.engram.env.ENGRAM_NAMESPACE, "research");
assert.equal(safeConfig.mcpServers.engram.env.ENGRAM_API_KEY, "<ENGRAM_API_KEY>");
assert.equal(safeConfig.mcpServers.engram.args[0], "C:\\Engram\\mcp\\dist\\index.js");
assert.equal(JSON.parse(buildConnectionConfig("claude", "/mcp/index.js", "https://api.example.test", "default", "ek_test")).mcpServers.engram.env.ENGRAM_API_KEY, "ek_test");
const codexConfig = buildConnectionConfig("codex", "C:\\Engram\\mcp\\dist\\index.js", "https://api.example.test", "default");
assert.ok(codexConfig.includes('[mcp_servers.engram.env]'));
assert.ok(codexConfig.includes('ENGRAM_API_KEY = "<ENGRAM_API_KEY>"'));
assert.ok(codexConfig.includes('ENGRAM_NAMESPACE = "default"'));
const authorizationParams = new URLSearchParams({ client_id: "client", redirect_uri: "http://127.0.0.1:8001/callback", response_type: "code", code_challenge: "a".repeat(43), code_challenge_method: "S256", scope: "memory:read memory:write" });
assert.equal(validateAuthorizationParams(authorizationParams), null);
authorizationParams.set("code_challenge_method", "plain");
assert.match(validateAuthorizationParams(authorizationParams), /S256/);
authorizationParams.set("code_challenge_method", "S256");
authorizationParams.set("scope", "memory:read admin");
assert.match(validateAuthorizationParams(authorizationParams), /permissions/);
assert.ok(validateAuthorizationParams(new URLSearchParams()));
process.stdout.write("PASS connection configuration and OAuth request validation\n");

const storage = new Map();
const requests = [];
const browser = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
const apiModule = loadTsModule("src/lib/api.ts", {
  require: () => ({ extractChatResponseContent }),
  process: { env: {} },
  window: browser,
  localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
  Event,
  AbortController,
  DOMException,
  URLSearchParams,
  fetch: async (url, options) => {
    requests.push({ url, ...options });
    return new Response(JSON.stringify({ results: [], memories: [], total: 0 }), { headers: { "Content-Type": "application/json" } });
  },
});
apiModule.setActiveApiKey("ek_first");
apiModule.setActiveNamespace("research");
await apiModule.api.memories.search("preferences");
assert.equal(requests.at(-1).headers["X-Engram-Key"], "ek_first");
assert.equal(JSON.parse(requests.at(-1).body).namespace, "research");
assert.equal(JSON.parse(requests.at(-1).body).include_personal, false);
await apiModule.api.memories.search("preferences", 5, 0.5, "research", true);
assert.equal(JSON.parse(requests.at(-1).body).include_personal, true);
await apiModule.api.memories.list({ status: "pending" });
assert.match(requests.at(-1).url, /namespace=research/);
apiModule.setActiveApiKey("ek_second");
assert.equal(apiModule.readActiveNamespace(), "default");
await apiModule.api.logs.list({ conversation_id: "conversation" });
assert.equal(requests.at(-1).headers["X-Engram-Key"], "ek_second");
assert.match(requests.at(-1).url, /namespace=default/);
apiModule.setActiveApiKey("ek_first");
assert.equal(apiModule.readActiveNamespace(), "research");
process.stdout.write("PASS account-specific projects and explicit personal retrieval\n");
