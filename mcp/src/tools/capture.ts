import { z } from "zod";

import { engramClient } from "../client.js";
import { errorResult, textResult, type ToolResult } from "./result.js";

const InputSchema = z.object({
  namespace: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/).optional(),
  user_message: z.string().trim().min(1).max(50000).describe("The user's message from the exchange to capture"),
  assistant_response: z.string().trim().min(1).max(50000).describe("The assistant's response from the exchange to capture"),
  source: z.string().min(1).max(80).default("mcp"),
  session_id: z.string().min(1).max(255).optional(),
}).strict();

export const captureConversationTool = {
  definition: {
    name: "capture_conversation",
    description: "Deliberately capture a user and assistant exchange for asynchronous extraction into the pending review inbox",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    _meta: { securitySchemes: [{ type: "oauth2", scopes: ["memory:write"] }] },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        namespace: { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$", description: "Project namespace; defaults to the connection project" },
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
