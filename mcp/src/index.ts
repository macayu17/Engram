#!/usr/bin/env node
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { config, type McpTransport } from "./config.js";
import { addMemoryTool } from "./tools/add.js";
import { captureConversationTool } from "./tools/capture.js";
import { deleteMemoryTool } from "./tools/delete.js";
import { listMemoriesTool } from "./tools/list.js";
import { getRetrievalLogTool } from "./tools/logs.js";
import { searchMemoriesTool } from "./tools/search.js";
import { updateMemoryTool } from "./tools/update.js";

const packageJson = createRequire(import.meta.url)("../package.json") as {
  name: string;
  version: string;
};

function createEngramServer(): Server {
  const server = new Server(
    { name: "engram", version: packageJson.version },
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

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

async function handleStreamableHttp(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    }));
    return;
  }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  response.on("close", () => {
    void transport.close();
  });
  await createEngramServer().connect(transport);
  await transport.handleRequest(request, response, await readJsonBody(request));
}

async function startHttp(): Promise<void> {
  const sseTransports = new Map<string, SSEServerTransport>();
  const httpServer = http.createServer(async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname === "/mcp") {
        await handleStreamableHttp(request, response);
        return;
      }
      if (request.method === "GET" && url.pathname === "/sse") {
        const transport = new SSEServerTransport("/messages", response);
        sseTransports.set(transport.sessionId, transport);
        transport.onclose = () => {
          sseTransports.delete(transport.sessionId);
        };
        await createEngramServer().connect(transport);
        return;
      }
      if (request.method === "POST" && url.pathname === "/messages") {
        const sessionId = url.searchParams.get("sessionId");
        const transport = sessionId ? sseTransports.get(sessionId) : undefined;
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
        response.end(JSON.stringify({ status: "ok", version: packageJson.version }));
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
  if (requested === "stdio" || requested === "sse" || requested === "http") {
    return requested;
  }
  return config.mcpTransport;
}

function printHelp(): void {
  process.stdout.write(`${packageJson.name} ${packageJson.version}
MCP server for Engram, a self-hostable AI memory layer.

Usage:
  engramd [--transport stdio|http|sse]

Options:
  --transport <mode>  Transport to use (default: stdio; http and sse share one server on MCP_PORT)
  --version, -v       Print the version and exit
  --help, -h          Print this help and exit

Environment:
  ENGRAM_API_KEY   Engram API key (required)
  ENGRAM_API_URL   Engram API base URL
  MCP_TRANSPORT    stdio | http | sse
  MCP_PORT         Port for http/sse transports (default: 3000)

Endpoints in http/sse mode:
  POST /mcp        Streamable HTTP transport
  GET  /sse        Legacy SSE transport
  GET  /health     Health check
`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }
  if (!config.engramApiKey) {
    process.stderr.write("ENGRAM_API_KEY is not set — API calls will fail with 401\n");
  }
  const transport = getRequestedTransport();
  if (transport === "stdio") {
    await startStdio();
    return;
  }
  await startHttp();
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
