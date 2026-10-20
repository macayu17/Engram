import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { once } from "node:events";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";
import { credentialHeaders } from "../mcp/dist/auth.js";

assert.throws(() => credentialHeaders(), /No authenticated request context/);
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const calls = [];
const api = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  const credential = request.headers.authorization ?? request.headers["x-engram-key"];
  response.setHeader("content-type", "application/json");
  if (request.url === "/users/me") {
    response.statusCode = ["alice", "bob"].includes(credential) ? 200 : 401;
    response.end(JSON.stringify({ external_id: credential }));
  } else if (request.url === "/oauth/introspect") {
    response.statusCode = ["Bearer reader", "Bearer writer", "Bearer writeonly"].includes(credential) ? 200 : 401;
    response.end(JSON.stringify({ active: response.statusCode === 200, namespace: "project-alpha", scope: credential === "Bearer reader" ? "memory:read" : credential === "Bearer writeonly" ? "memory:write" : "memory:read memory:write" }));
  } else {
    calls.push({ credential, url: request.url, body });
    await new Promise((resolve) => setTimeout(resolve, credential === "alice" ? 45 : 5));
    response.end(JSON.stringify({ credential, url: request.url, body }));
  }
});
api.listen(0, "127.0.0.1");
await once(api, "listening");
const apiUrl = `http://127.0.0.1:${api.address().port}`;
const portReservation = http.createServer();
portReservation.listen(0, "127.0.0.1");
await once(portReservation, "listening");
const port = portReservation.address().port;
await new Promise((resolve) => portReservation.close(resolve));
const mcpUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["mcp/dist/index.js", "--transport", "http"], {
  cwd: workspace,
  env: { ...process.env, ENGRAM_API_URL: apiUrl, ENGRAM_AUTH_URL: apiUrl, ENGRAM_API_KEY: "must-never-be-used", MCP_PUBLIC_URL: `${mcpUrl}/mcp`, MCP_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });
let sequence = 0;
async function rpc(method, params, headers = {}) {
  const response = await fetch(`${mcpUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++sequence, method, params }),
  });
  const text = await response.text();
  const payload = text.startsWith("event:") ? JSON.parse(text.split("data: ")[1].split("\n")[0]) : JSON.parse(text);
  return { response, payload };
}
function data(result) {
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.result.isError, undefined);
  return JSON.parse(result.payload.result.content[0].text);
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 1200; attempt++) {
    try { if ((await fetch(`${mcpUrl}/health`)).ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `MCP did not start: ${stderr}`);
  const anonymous = await rpc("tools/list", {});
  assert.equal(anonymous.response.status, 401);
  assert.match(anonymous.response.headers.get("www-authenticate"), /oauth-protected-resource\/mcp/);
  assert.equal((await rpc("tools/list", {}, { "X-Engram-Key": "bad" })).response.status, 401);
  const metadata = await (await fetch(`${mcpUrl}/.well-known/oauth-protected-resource/mcp`)).json();
  assert.equal(metadata.resource, `${mcpUrl}/mcp`);
  assert.deepEqual(metadata.authorization_servers, [apiUrl]);
  const concurrent = await Promise.all(["alice", "bob"].map((key) => rpc("tools/call", { name: "search_memories", arguments: { query: key, namespace: key, include_personal: true } }, { "X-Engram-Key": key })));
  for (const [index, key] of ["alice", "bob"].entries()) {
    const result = data(concurrent[index]);
    assert.equal(result.credential, key);
    assert.equal(result.body.namespace, key);
    assert.equal(result.body.include_personal, true);
  }
  const reader = { Authorization: "Bearer reader" };
  const writer = { Authorization: "Bearer writer" };
  assert.equal(data(await rpc("tools/call", { name: "search_memories", arguments: { query: "recall" } }, reader)).body.namespace, "project-alpha");
  for (const argumentsValue of [{ query: "x", namespace: "escape" }, { query: "x", include_personal: true }]) {
    const result = await rpc("tools/call", { name: "search_memories", arguments: argumentsValue }, reader);
    assert.equal(result.payload.result.isError, true);
  }
  assert.equal((await rpc("tools/call", { name: "add_memory", arguments: { content: "new" } }, reader)).payload.result.isError, true);
  assert.equal(data(await rpc("tools/call", { name: "add_memory", arguments: { content: "new" } }, writer)).body.namespace, "project-alpha");
  const memoryId = "00000000-0000-4000-8000-000000000001";
  for (const [name, argumentsValue] of [
    ["list_memories", {}], ["get_retrieval_log", {}],
    ["update_memory", { memory_id: memoryId, content: "updated" }],
    ["delete_memory", { memory_id: memoryId }],
  ]) {
    data(await rpc("tools/call", { name, arguments: argumentsValue }, writer));
    assert.match(calls.at(-1).url, /namespace=project-alpha/);
  }
  const captured = data(await rpc("tools/call", { name: "capture_conversation", arguments: { user_message: "remember", assistant_response: "capturing" } }, writer));
  assert.equal(captured.capture.body.namespace, "project-alpha");
  assert.match(captured.review, /pending/);
  const deniedResource = await rpc("resources/read", { uri: "engram://memories/recent" }, { Authorization: "Bearer writeonly" });
  assert.ok(deniedResource.payload.error);
  const resource = await rpc("resources/read", { uri: "engram://memories/recent" }, reader);
  assert.match(JSON.parse(resource.payload.result.contents[0].text).url, /namespace=project-alpha/);
  const tools = (await rpc("tools/list", {}, reader)).payload.result.tools;
  assert.ok(tools.every((tool) => tool.annotations && tool._meta.securitySchemes[0].scopes.length === 1));
  const resources = (await rpc("resources/list", {}, reader)).payload.result.resources;
  assert.ok(resources.every((resource) => resource._meta.securitySchemes[0].scopes[0] === "memory:read"));
  const oversized = await fetch(`${mcpUrl}/mcp`, { method: "POST", headers: { "X-Engram-Key": "alice" }, body: "x".repeat(262145) });
  assert.equal(oversized.status, 413);
  const controller = new AbortController();
  const sse = await fetch(`${mcpUrl}/sse`, { headers: { "X-Engram-Key": "alice" }, signal: controller.signal });
  const stream = sse.body.getReader();
  const endpoint = new TextDecoder().decode((await stream.read()).value).match(/data: (.+)/)[1];
  const switched = await fetch(`${mcpUrl}${endpoint}`, { method: "POST", headers: { "X-Engram-Key": "bob", "Content-Type": "application/json" }, body: "{}" });
  assert.equal(switched.status, 403);
  const legacyAnonymous = await fetch(`${mcpUrl}${endpoint}`, { method: "POST", body: "{}" });
  assert.equal(legacyAnonymous.status, 401);
  const accepted = await fetch(`${mcpUrl}${endpoint}`, {
    method: "POST", headers: { "X-Engram-Key": "alice", "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 9000, method: "tools/call", params: { name: "search_memories", arguments: { query: "legacy", namespace: "alice" } } }),
  });
  assert.equal(accepted.status, 202);
  const message = new TextDecoder().decode((await stream.read()).value);
  const legacyResult = JSON.parse(message.match(/data: (.+)/)[1]);
  assert.equal(JSON.parse(legacyResult.result.content[0].text).credential, "alice");
  controller.abort();
  assert.ok(calls.every((call) => call.credential !== "must-never-be-used"));
  const stdio = new Client({ name: "engram-auth-test", version: "1.0.0" });
  try {
    await stdio.connect(new StdioClientTransport({
      command: process.execPath, args: ["mcp/dist/index.js", "--transport", "stdio"],
      cwd: workspace,
      env: { ...process.env, ENGRAM_API_URL: apiUrl, ENGRAM_API_KEY: "alice", ENGRAM_NAMESPACE: "stdio-project" },
    }));
    const result = await stdio.callTool({ name: "search_memories", arguments: { query: "stdio" } });
    const returned = JSON.parse(result.content[0].text);
    assert.equal(returned.credential, "alice");
    assert.equal(returned.body.namespace, "stdio-project");
  } finally {
    await stdio.close();
  }
  process.stdout.write("PASS MCP HTTP auth, concurrent isolation, scopes, namespace, resources, discovery, limits, SSE binding and stdio credentials\n");
} finally {
  child.kill();
  api.closeAllConnections();
  await new Promise((resolve) => api.close(resolve));
}
