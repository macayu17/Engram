import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  namespace: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/).optional(),
  content: z.string().trim().min(1).max(50000).describe("The fact or preference to remember"),
}).strict();

export const addMemoryTool = {
  definition: {
    name: "add_memory",
    description: "Manually add a memory for the current user",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["memory:write"] }] },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        namespace: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$", description: "Project namespace; defaults to the connection project" },
        content: { type: "string", description: "The fact or preference to remember" },
      },
      required: ["content"],
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const input = InputSchema.parse(args ?? {});
      return textResult(await engramClient.addMemory(input.content, input.namespace));
    } catch (error) {
      return errorResult(error);
    }
  },
};
