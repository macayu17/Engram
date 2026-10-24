import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { Client } from "../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";

assert.ok(process.env.ENGRAM_API_URL, "ENGRAM_API_URL must point to the test API");
assert.ok(process.env.ENGRAM_API_KEY, "ENGRAM_API_KEY must belong to a dedicated test account");

const client = new Client({ name: "engram-tool-verification", version: "1.0.0" });

async function callTool(name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    throw new Error(result.content[0]?.text ?? "Tool returned an error");
  }
  return JSON.parse(result.content[0].text);
}

let createdMemoryId = "";

try {
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../mcp/dist/index.js", import.meta.url)), "--transport", "stdio"],
    env: Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined)),
  }));
  const marker = `MCP verification memory ${randomUUID()}`;
  const added = await callTool("add_memory", { content: marker });
  createdMemoryId = added.id;
  assert.ok(createdMemoryId);
  const captured = await callTool("capture_conversation", {
    user_message: "I connected Engram to VS Code Agent mode.",
    assistant_response: "I will capture durable memory from this exchange.",
    source: "verification",
    session_id: `verify-${randomUUID()}`,
  });
  assert.ok(captured.capture.conversation_id);
  assert.match(captured.review, /pending/);
  const deadline = Date.now() + 60000;
  let captureStored = false;
  while (Date.now() < deadline) {
    const pending = await callTool("list_memories", { status: "pending", limit: 100, offset: 0 });
    captureStored = pending.memories.some((memory) =>
      memory.source_conversation_id === captured.capture.conversation_id && memory.content.includes("VS Code Agent mode"));
    if (captureStored) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const listed = await callTool("list_memories", { limit: 100, offset: 0 });
  const searched = await callTool("search_memories", { query: marker, limit: 5, threshold: 0 });
  const updated = await callTool("update_memory", {
    memory_id: createdMemoryId,
    content: `${marker} updated`,
  });
  const logs = await callTool("get_retrieval_log", { limit: 20 });
  const deleted = await callTool("delete_memory", { memory_id: createdMemoryId });
  createdMemoryId = "";
  const checks = {
    addMemory: Boolean(added.id),
    captureConversation: captureStored,
    listContainsMemory: listed.memories.some((memory) => memory.id === added.id),
    searchReturnedResults: searched.results.some((result) => result.memory.id === added.id),
    updateRoundtrip: updated.content === `${marker} updated`,
    logsReadable: Array.isArray(logs.logs),
    deleteSuccess: deleted.success === true,
  };
  assert.ok(Object.values(checks).every(Boolean), JSON.stringify(checks));
  process.stdout.write(`${JSON.stringify(checks)}\n`);
} finally {
  try {
    if (createdMemoryId) {
      await callTool("delete_memory", { memory_id: createdMemoryId });
    }
  } finally {
    await client.close();
  }
}
