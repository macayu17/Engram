import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  memory_id: z.string().uuid(),
  content: z.string().min(1).describe("New content for the memory"),
});

export const updateMemoryTool = {
  definition: {
    name: "update_memory",
    description: "Update the content of an existing memory",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: { type: "string", format: "uuid" },
        content: { type: "string", description: "New content for the memory" },
      },
      required: ["memory_id", "content"],
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const input = InputSchema.parse(args);
      return textResult(await engramClient.updateMemory(input.memory_id, input.content));
    } catch (error) {
      return errorResult(error);
    }
  },
};
