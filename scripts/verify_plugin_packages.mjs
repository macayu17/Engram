import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../plugins");
async function json(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}
function contained(parent, path) {
  assert.ok(path.startsWith("./"));
  const target = resolve(parent, path);
  assert.ok(!relative(parent, target).startsWith(".."));
  return target;
}
const claude = await json("claude/.claude-plugin/plugin.json");
const codex = await json("codex/plugin.json");
for (const manifest of [claude, codex]) {
  assert.equal(manifest.name, "engram");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok(manifest.description.length > 10);
}
assert.equal(codex.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
for (const [host, file] of [["claude", "claude/.mcp.json"], ["codex", "codex/mcp.json"]]) {
  const config = await json(file);
  const server = config.mcpServers.engram;
  assert.equal(server.command, "node");
  assert.deepEqual(server.args, ["${ENGRAM_MCP_ENTRY}"]);
  assert.equal(server.env.ENGRAM_API_KEY, "${ENGRAM_API_KEY}");
  assert.equal(server.env.ENGRAM_NAMESPACE, "${ENGRAM_NAMESPACE}");
  if (host === "codex") assert.equal(server.type, "stdio");
  const skillNames = await readdir(resolve(root, host, "skills"));
  assert.deepEqual(skillNames.sort(), ["capture", "project-handoff", "recall", "review"]);
  for (const name of skillNames) {
    const skill = (await readFile(resolve(root, host, "skills", name, "SKILL.md"), "utf8")).replaceAll("\r\n", "\n");
    assert.ok(skill.startsWith(`---\nname: ${name}\ndescription: `));
    assert.ok(skill.includes("\n---\n\n"));
    assert.ok(skill.length < 5000);
  }
}
const claudeCatalog = await json(".claude-plugin/marketplace.json");
assert.ok(claudeCatalog.owner.name);
for (const plugin of claudeCatalog.plugins) {
  const path = contained(root, plugin.source);
  const manifest = JSON.parse(await readFile(resolve(path, ".claude-plugin/plugin.json"), "utf8"));
  assert.equal(plugin.name, manifest.name);
}
assert.deepEqual(claudeCatalog.plugins.map((plugin) => plugin.name), ["engram", "engram-auto"]);
const autoHooks = (await json("claude-auto/hooks/hooks.json")).hooks;
assert.deepEqual(Object.keys(autoHooks).sort(), ["Stop", "UserPromptSubmit"]);
for (const [event, mode] of [["UserPromptSubmit", "recall"], ["Stop", "capture"]]) {
  assert.ok(autoHooks[event][0].hooks[0].command.endsWith(`engram-hook.mjs" ${mode}`));
}
const { lastExchange } = await import(pathToFileURL(resolve(root, "claude-auto/hooks/engram-hook.mjs")).href);
const transcript = [
  { type: "user", message: { content: "old prompt" } },
  { type: "assistant", message: { content: [{ type: "text", text: "old reply" }] } },
  { type: "user", message: { content: "Use pnpm in this repo" } },
  { type: "assistant", message: { content: [{ type: "thinking", thinking: "x" }, { type: "text", text: "Noted," }] } },
  { type: "user", message: { content: [{ type: "tool_result", content: "ok" }] } },
  { type: "user", isMeta: true, message: { content: "meta" } },
  { type: "user", message: { content: "<system-reminder>skip</system-reminder>" } },
  { type: "assistant", message: { content: [{ type: "text", text: "switched to pnpm." }] } },
].map((entry) => JSON.stringify(entry)).concat(["not json", ""]);
assert.deepEqual(lastExchange(transcript), { user_message: "Use pnpm in this repo", assistant_response: "Noted,\nswitched to pnpm." });
assert.equal(lastExchange(transcript.slice(0, 3)), null);
const codexCatalog = await json(".agents/plugins/marketplace.json");
for (const plugin of codexCatalog.plugins) {
  assert.equal(plugin.source.source, "local");
  await access(resolve(contained(root, plugin.source.path), "plugin.json"));
  assert.equal(plugin.name, codex.name);
  assert.equal(plugin.policy.installation, "AVAILABLE");
  assert.equal(plugin.policy.authentication, "ON_INSTALL");
}
for (const host of ["claude", "codex"]) {
  const template = await readFile(resolve(root, "templates", `${host}.remote.mcp.json`), "utf8");
  assert.ok(template.includes("${ENGRAM_MCP_URL}"));
  const server = JSON.parse(template.replaceAll("${ENGRAM_MCP_URL}", "https://example.invalid/mcp")).mcpServers.engram;
  assert.equal(new URL(server.url).protocol, "https:");
  assert.equal(server.type, host === "codex" ? "streamable-http" : "http");
  assert.equal(server.headers, undefined);
  if (host === "codex") {
    assert.equal(server.extensions["com.openai"].auth.type, "oauth");
    assert.equal(server.extensions["com.openai"].auth.client.mode, "dcr");
  }
}
assert.equal((await json("templates/submission.json")).status, "draft-not-submitted");
process.stdout.write("PASS Claude/Codex package structure, local catalogs, skills and remote template contracts\n");
