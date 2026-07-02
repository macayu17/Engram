#!/usr/bin/env node
import http, { type IncomingMessage, type ServerResponse } from "node:http";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { config, type McpTransport } from "./config.js";
import { addMemoryTool } from "./tools/add.js";
import { captureConversationTool } from "./tools/capture.js";
import { deleteMemoryTool } from "./tools/delete.js";
import { listMemoriesTool } from "./tools/list.js";
import { getRetrievalLogTool } from "./tools/logs.js";
import { searchMemoriesTool } from "./tools/search.js";
import { updateMemoryTool } from "./tools/update.js";

function createEngramServer(): Server {
  const server = new Server(
    { name: "engram", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      searchMemoriesTool.definition,
      addMemoryTool.definition,
      captureConversationTool.definition,
      deleteMemoryTool.definition,
      listMemoriesTool.definition,
      updateMemoryTool.definition,
      getRetrievalLogTool.definition,
    ],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    switch (request.params.name) {
      case "search_memories":
        return searchMemoriesTool.handler(request.params.arguments);
      case "add_memory":
        return addMemoryTool.handler(request.params.arguments);
      case "capture_conversation":
        return captureConversationTool.handler(request.params.arguments);
      case "delete_memory":
        return deleteMemoryTool.handler(request.params.arguments);
      case "list_memories":
        return listMemoriesTool.handler(request.params.arguments);
      case "update_memory":
        return updateMemoryTool.handler(request.params.arguments);
      case "get_retrieval_log":
        return getRetrievalLogTool.handler(request.params.arguments);
      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  });
  return server;
}

async function startStdio(): Promise<void> {
  const server = createEngramServer();
  await server.connect(new StdioServerTransport());
}

async function startSse(): Promise<void> {
  const transports = new Map<string, SSEServerTransport>();
  const httpServer = http.createServer(async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/sse") {
        const transport = new SSEServerTransport("/messages", response);
        transports.set(transport.sessionId, transport);
        transport.onclose = () => {
          transports.delete(transport.sessionId);
        };
        await createEngramServer().connect(transport);
        return;
      }
      if (request.method === "POST" && url.pathname === "/messages") {
        const sessionId = url.searchParams.get("sessionId");
        const transport = sessionId ? transports.get(sessionId) : undefined;
        if (!transport) {
          response.statusCode = 404;
          response.end("Unknown or expired sessionId");
          return;
        }
        await transport.handlePostMessage(request, response);
        return;
      }
      if (request.method === "GET" && url.pathname === "/health") {
        response.statusCode = 200;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ status: "ok", version: "1.0.0" }));
        return;
      }
      response.statusCode = 404;
      response.end("Not found");
    } catch (error) {
      if (!response.headersSent) {
        response.statusCode = 500;
      }
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise<void>((resolve) => {
    httpServer.listen(config.mcpPort, "0.0.0.0", resolve);
  });
}

function getRequestedTransport(): McpTransport {
  const transportFlagIndex = process.argv.indexOf("--transport");
  const requested = transportFlagIndex >= 0 ? process.argv[transportFlagIndex + 1] : undefined;
  if (requested === "stdio" || requested === "sse") {
    return requested;
  }
  return config.mcpTransport;
}

async function main(): Promise<void> {
  if (!config.engramApiKey) {
    process.stderr.write("ENGRAM_API_KEY is not set — API calls will fail with 401\n");
  }
  const transport = getRequestedTransport();
  if (transport === "stdio") {
    await startStdio();
    return;
  }
  await startSse();
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
