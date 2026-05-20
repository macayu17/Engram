import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const listMemoriesTool = {
  definition: {
    name: "list_memories",
    description: "List all memories for the current user",
    inputSchema: {
      type: "object",
      properties: {
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
