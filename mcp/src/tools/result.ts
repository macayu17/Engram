export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function textResult(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

export function errorResult(error: unknown): ToolResult {
  return {
    content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
    isError: true,
  };
}
