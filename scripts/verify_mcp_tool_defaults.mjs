import assert from "node:assert/strict";

import { engramClient } from "../mcp/dist/client.js";
import { addMemoryTool } from "../mcp/dist/tools/add.js";
import { getRetrievalLogTool } from "../mcp/dist/tools/logs.js";
import { listMemoriesTool } from "../mcp/dist/tools/list.js";
import { searchMemoriesTool } from "../mcp/dist/tools/search.js";

function parseResult(result) {
  assert.equal(result.isError, undefined);
  return JSON.parse(result.content[0].text);
}

function assertError(result) {
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /^Error:/);
}

engramClient.listMemories = async (params) => params;
engramClient.getRetrievalLog = async (params) => params;
engramClient.addMemory = async (content) => ({ content });
engramClient.searchMemories = async (params) => params;

assert.deepEqual(parseResult(await listMemoriesTool.handler(undefined)), { limit: 20, offset: 0 });
assert.deepEqual(parseResult(await getRetrievalLogTool.handler(undefined)), { limit: 10 });
assert.deepEqual(parseResult(await addMemoryTool.handler({ content: "User prefers FastAPI" })), { content: "User prefers FastAPI" });
assert.deepEqual(parseResult(await searchMemoriesTool.handler({ query: "backend" })), {
  query: "backend",
  limit: 5,
  threshold: 0.5,
});
assertError(await addMemoryTool.handler(undefined));
assertError(await searchMemoriesTool.handler(undefined));

process.stdout.write("PASS MCP tool argument defaults\n");
