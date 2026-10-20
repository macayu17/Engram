import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  namespace: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/).optional(),
  memory_id: z.string().uuid(),
}).strict();

export const deleteMemoryTool = {
  definition: {
    name: "delete_memory",
    description: "Delete a specific memory by ID",
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["memory:write"] }] },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        namespace: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$", description: "Project namespace; defaults to the connection project" },
        memory_id: { type: "string", format: "uuid" },
      },
      required: ["memory_id"],
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const input = InputSchema.parse(args ?? {});
      return textResult(await engramClient.deleteMemory(input.memory_id, input.namespace));
    } catch (error) {
      return errorResult(error);
    }
  },
};
