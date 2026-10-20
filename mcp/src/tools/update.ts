import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  namespace: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/).optional(),
  memory_id: z.string().uuid(),
  content: z.string().trim().min(1).max(50000).describe("New content for the memory"),
}).strict();

export const updateMemoryTool = {
  definition: {
    name: "update_memory",
    description: "Update the content of an existing memory",
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["memory:write"] }] },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        namespace: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$", description: "Project namespace; defaults to the connection project" },
        memory_id: { type: "string", format: "uuid" },
        content: { type: "string", description: "New content for the memory" },
      },
      required: ["memory_id", "content"],
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const input = InputSchema.parse(args ?? {});
      return textResult(await engramClient.updateMemory(input.memory_id, input.content, input.namespace));
    } catch (error) {
      return errorResult(error);
    }
  },
};
