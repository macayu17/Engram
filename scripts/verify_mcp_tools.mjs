import { randomUUID } from "node:crypto";

const { addMemoryTool } = await import("../mcp/dist/tools/add.js");
const { captureConversationTool } = await import("../mcp/dist/tools/capture.js");
const { listMemoriesTool } = await import("../mcp/dist/tools/list.js");
const { searchMemoriesTool } = await import("../mcp/dist/tools/search.js");
const { updateMemoryTool } = await import("../mcp/dist/tools/update.js");
const { getRetrievalLogTool } = await import("../mcp/dist/tools/logs.js");
const { deleteMemoryTool } = await import("../mcp/dist/tools/delete.js");

function parseToolResult(result) {
  if (result.isError) {
    throw new Error(result.content[0]?.text ?? "Tool returned an error");
  }
  return JSON.parse(result.content[0].text);
}

let createdMemoryId = "";

try {
  const marker = `MCP verification memory ${randomUUID()}`;
  const added = parseToolResult(await addMemoryTool.handler({ content: marker }));
  createdMemoryId = added.id;
  const captured = parseToolResult(await captureConversationTool.handler({
    user_message: "I connected Engram to VS Code Agent mode.",
    assistant_response: "I will capture durable memory from this exchange.",
    source: "verification",
    session_id: `verify-${randomUUID()}`,
  }));
  const listed = parseToolResult(await listMemoriesTool.handler({ limit: 100, offset: 0 }));
  const searched = parseToolResult(await searchMemoriesTool.handler({ query: marker, limit: 5, threshold: 0 }));
  const updated = parseToolResult(await updateMemoryTool.handler({
    memory_id: createdMemoryId,
    content: `${marker} updated`,
  }));
  const logs = parseToolResult(await getRetrievalLogTool.handler({ limit: 20 }));
  const deleted = parseToolResult(await deleteMemoryTool.handler({ memory_id: createdMemoryId }));
  createdMemoryId = "";
  process.stdout.write(`${JSON.stringify({
    addMemory: Boolean(added.id),
    captureConversation: captured.memories_extracted >= 1 && captured.extracted_memories.some((memory) => memory.includes("VS Code Agent mode")),
    listContainsMemory: listed.memories.some((memory) => memory.id === added.id),
    searchReturnedResults: searched.results.length > 0,
    updateRoundtrip: updated.content === `${marker} updated`,
    logsReadable: Array.isArray(logs.logs),
    deleteSuccess: deleted.success === true,
  })}\n`);
} finally {
  if (createdMemoryId) {
    await deleteMemoryTool.handler({ memory_id: createdMemoryId });
  }
}
