import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  memory_id: z.string().uuid(),
});

export const deleteMemoryTool = {
  definition: {
    name: "delete_memory",
    description: "Delete a specific memory by ID",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: { type: "string", format: "uuid" },
      },
      required: ["memory_id"],
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const input = InputSchema.parse(args ?? {});
      return textResult(await engramClient.deleteMemory(input.memory_id));
    } catch (error) {
      return errorResult(error);
    }
  },
};
