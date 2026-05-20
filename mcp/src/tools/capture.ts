import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  user_message: z.string().min(1).describe("The user's message from the exchange to capture"),
  assistant_response: z.string().min(1).describe("The assistant's response from the exchange to capture"),
  source: z.string().min(1).max(80).default("mcp"),
  session_id: z.string().min(1).max(255).optional(),
});

export const captureConversationTool = {
  definition: {
    name: "capture_conversation",
    description: "Capture a user and assistant exchange so Engram can extract and store durable memories automatically",
    inputSchema: {
      type: "object",
      properties: {
        user_message: { type: "string", description: "The user's message from the exchange to capture" },
        assistant_response: { type: "string", description: "The assistant's response from the exchange to capture" },
        source: { type: "string", default: "mcp", description: "Client or app name, such as claude_desktop or vscode" },
        session_id: { type: "string", description: "Optional client session identifier" },
      },
      required: ["user_message", "assistant_response"],
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const input = InputSchema.parse(args ?? {});
      return textResult(await engramClient.captureConversation(input));
    } catch (error) {
      return errorResult(error);
    }
  },
};
