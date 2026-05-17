import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  content: z.string().min(1).describe("The fact or preference to remember"),
});

export const addMemoryTool = {
  definition: {
    name: "add_memory",
    description: "Manually add a memory for the current user",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The fact or preference to remember" },
      },
      required: ["content"],
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const input = InputSchema.parse(args);
      return textResult(await engramClient.addMemory(input.content));
    } catch (error) {
      return errorResult(error);
    }
  },
};
