import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  namespace: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/).optional(),
  include_personal: z.boolean().optional(),
  query: z.string().trim().min(1).max(10000).describe("Natural language query to search memories"),
  limit: z.number().int().min(1).max(20).default(5),
  threshold: z.number().min(0).max(1).default(0.5),
}).strict();

export const searchMemoriesTool = {
  definition: {
    name: "search_memories",
    description: "Search for relevant memories given a natural language query",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["memory:read"] }] },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        namespace: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$", description: "Project namespace; defaults to the connection project" },
        include_personal: { type: "boolean", default: false, description: "Explicit API-key opt-in to personal memories; unavailable for OAuth" },
        query: { type: "string", description: "Natural language query" },
        limit: { type: "number", default: 5 },
        threshold: { type: "number", default: 0.5 },
      },
      required: ["query"],
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const input = InputSchema.parse(args ?? {});
      return textResult(await engramClient.searchMemories(input));
    } catch (error) {
      return errorResult(error);
    }
  },
};
