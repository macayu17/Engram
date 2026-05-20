import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  query: z.string().describe("Natural language query to search memories"),
  limit: z.number().int().min(1).max(20).default(5),
  threshold: z.number().min(0).max(1).default(0.5),
});

export const searchMemoriesTool = {
  definition: {
    name: "search_memories",
    description: "Search for relevant memories given a natural language query",
    inputSchema: {
      type: "object",
      properties: {
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
