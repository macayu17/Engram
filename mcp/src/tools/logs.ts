import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  namespace: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/).optional(),
  conversation_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(10),
}).strict();

export const getRetrievalLogTool = {
  definition: {
    name: "get_retrieval_log",
    description: "Get retrieval history showing what memories were surfaced and why",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["memory:read"] }] },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        namespace: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$", description: "Project namespace; defaults to the connection project" },
        conversation_id: { type: "string", format: "uuid" },
        limit: { type: "number", default: 10 },
      },
      required: [],
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const input = InputSchema.parse(args ?? {});
      return textResult(await engramClient.getRetrievalLog(input));
    } catch (error) {
      return errorResult(error);
    }
  },
};
