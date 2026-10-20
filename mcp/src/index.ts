#!/usr/bin/env node
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  authenticate,
  enableStdioAuth,
  HttpError,
  requestContext,
  requireScope,
  type RequestContext,
} from "./auth.js";
import { errorResult } from "./tools/result.js";
import { engramClient } from "./client.js";
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

const RESOURCES = [
  {
    uri: "engram://memories/recent",
    name: "Recent memories",
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["memory:read"] }] },
    description: "The 20 most recent memories stored for this user",
    mimeType: "application/json",
  },
  {
    uri: "engram://logs/recent",
    name: "Recent retrieval logs",
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["memory:read"] }] },
    description: "The 10 most recent memory retrieval events",
    mimeType: "application/json",
  },
];

async function readResource(uri: string): Promise<unknown> {
  requireScope("memory:read");
  if (uri === "engram://memories/recent") {
    return engramClient.listMemories({ limit: 20, offset: 0 });
  }
  if (uri === "engram://logs/recent") {
    return engramClient.getRetrievalLog({ limit: 10 });
  }
  throw new Error(`Unknown resource: ${uri}`);
}

function createEngramServer(): Server {
  const server = new Server(
    { name: "engram", version: packageJson.version },
    { capabilities: { tools: {}, resources: {} } },
  );
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    requireScope("memory:read");
    return { resources: RESOURCES };
  });
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(await readResource(request.params.uri), null, 2),
      },
    ],
  }));
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
    try {
      requireScope(
        ["search_memories", "list_memories", "get_retrieval_log"].includes(
          request.params.name,
        )
          ? "memory:read"
          : "memory:write",
      );
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
    } catch (error) {
      return errorResult(error);
    }
  });
  return server;
}

async function startStdio(): Promise<void> {
  enableStdioAuth();
  const server = createEngramServer();
  await server.connect(new StdioServerTransport());
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  if (Number(request.headers["content-length"] ?? 0) > 262144)
    throw new HttpError(413, "Request body exceeds 256 KiB");
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as string);
    size += buffer.length;
    if (size > 262144) throw new HttpError(413, "Request body exceeds 256 KiB");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

function closeServer(server: Server): void {
  void server.close().catch((error: unknown) => {
    process.stderr.write(
      `MCP cleanup failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
  });
}

async function handleStreamableHttp(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== "POST") throw new HttpError(405, "Method not allowed");
  const body = await readJsonBody(request);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createEngramServer();
  const timer = setTimeout(() => {
    closeServer(server);
    response.end();
  }, 60000);
  timer.unref();
  response.on("close", () => {
    clearTimeout(timer);
    closeServer(server);
  });
  await server.connect(transport);
  await transport.handleRequest(request, response, body);
}

async function startHttp(): Promise<void> {
  const sessions = new Map<
    string,
    { transport: SSEServerTransport; context: RequestContext }
  >();
  const publicUrl = new URL(config.mcpPublicUrl);
  const metadataUrl = `${publicUrl.origin}/.well-known/oauth-protected-resource${publicUrl.pathname}`;
  const httpServer = http.createServer(
    async (request: IncomingMessage, response: ServerResponse) => {
      try {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (
          request.method === "GET" &&
          [
            "/.well-known/oauth-protected-resource",
            `/.well-known/oauth-protected-resource${publicUrl.pathname}`,
          ].includes(url.pathname)
        ) {
          response.setHeader("content-type", "application/json");
          response.end(
            JSON.stringify({
              resource: config.mcpPublicUrl,
              authorization_servers: [
                config.engramAuthUrl || config.engramApiUrl,
              ],
              scopes_supported: ["memory:read", "memory:write"],
              bearer_methods_supported: ["header"],
            }),
          );
          return;
        }
        if (request.method === "GET" && url.pathname === "/health") {
          response.setHeader("content-type", "application/json");
          response.end(
            JSON.stringify({ status: "ok", version: packageJson.version }),
          );
          return;
        }
        if (!["/mcp", "/sse", "/messages"].includes(url.pathname))
          throw new HttpError(404, "Not found");
        const context = await authenticate(request);
        await requestContext.run(context, async () => {
          if (url.pathname === "/mcp") {
            await handleStreamableHttp(request, response);
            return;
          }
          if (request.method === "GET" && url.pathname === "/sse") {
            if (sessions.size >= 256)
              throw new HttpError(503, "Session capacity reached");
            const transport = new SSEServerTransport("/messages", response);
            const server = createEngramServer();
            sessions.set(transport.sessionId, { transport, context });
            const timer = setTimeout(() => {
              closeServer(server);
              response.end();
            }, 900000);
            timer.unref();
            response.on("close", () => {
              clearTimeout(timer);
              sessions.delete(transport.sessionId);
              closeServer(server);
            });
            try {
              await server.connect(transport);
            } catch (error) {
              clearTimeout(timer);
              sessions.delete(transport.sessionId);
              closeServer(server);
              throw error;
            }
            return;
          }
          if (request.method === "POST" && url.pathname === "/messages") {
            const session = sessions.get(
              url.searchParams.get("sessionId") ?? "",
            );
            if (!session)
              throw new HttpError(404, "Unknown or expired session");
            if (session.context.identity !== context.identity)
              throw new HttpError(403, "Session credential mismatch");
            await session.transport.handlePostMessage(
              request,
              response,
              await readJsonBody(request),
            );
            return;
          }
          throw new HttpError(405, "Method not allowed");
        });
      } catch (error) {
        if (response.headersSent) {
          response.end();
          return;
        }
        const status = error instanceof HttpError ? error.status : 500;
        response.statusCode = status;
        if (status === 401)
          response.setHeader(
            "WWW-Authenticate",
            `Bearer resource_metadata="${metadataUrl}"`,
          );
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            error:
              error instanceof HttpError ? error.message : "MCP request failed",
          }),
        );
      }
    },
  );
  httpServer.requestTimeout = 30000;
  httpServer.headersTimeout = 15000;
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(config.mcpPort, "0.0.0.0", () => {
      httpServer.off("error", reject);
      resolve();
    });
  });
}

function getRequestedTransport(): McpTransport {
  const transportFlagIndex = process.argv.indexOf("--transport");
  const requested =
    transportFlagIndex >= 0 ? process.argv[transportFlagIndex + 1] : undefined;
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
  ENGRAM_API_KEY   Engram API key for stdio only
  ENGRAM_API_URL   Engram API base URL
  ENGRAM_AUTH_URL  OAuth authorization server (default: API URL)
  MCP_PUBLIC_URL   Public absolute MCP endpoint URL for OAuth discovery
  ENGRAM_NAMESPACE Default project for API-key connections
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
  if (getRequestedTransport() === "stdio" && !config.engramApiKey) {
    process.stderr.write(
      "ENGRAM_API_KEY is not set — API calls will fail with 401\n",
    );
  }
  const transport = getRequestedTransport();
  if (transport === "stdio") {
    await startStdio();
    return;
  }
  await startHttp();
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
