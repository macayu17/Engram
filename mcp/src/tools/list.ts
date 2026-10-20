import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  namespace: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/).optional(),
  status: z.enum(["approved", "pending", "rejected"]).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
}).strict();

export const listMemoriesTool = {
  definition: {
    name: "list_memories",
    description: "List all memories for the current user",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["memory:read"] }] },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        namespace: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$", description: "Project namespace; defaults to the connection project" },
        status: { type: "string", enum: ["approved", "pending", "rejected"] },
        limit: { type: "number", default: 20 },
        offset: { type: "number", default: 0 },
      },
      required: [],
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const input = InputSchema.parse(args ?? {});
      return textResult(await engramClient.listMemories(input));
    } catch (error) {
      return errorResult(error);
    }
  },
};
