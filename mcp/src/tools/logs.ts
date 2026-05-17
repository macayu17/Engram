import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  conversation_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export const getRetrievalLogTool = {
  definition: {
    name: "get_retrieval_log",
    description: "Get retrieval history showing what memories were surfaced and why",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string", format: "uuid" },
        limit: { type: "number", default: 10 },
      },
      required: [],
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const input = InputSchema.parse(args);
      return textResult(await engramClient.getRetrievalLog(input));
    } catch (error) {
      return errorResult(error);
    }
  },
};
