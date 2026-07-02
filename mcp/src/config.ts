export type McpTransport = "sse" | "stdio";

function readString(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value : fallback;
}

function readPort(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readTransport(name: string, fallback: McpTransport): McpTransport {
  const value = process.env[name];
  return value === "stdio" || value === "sse" ? value : fallback;
}

export const config = {
  engramApiUrl: readString("ENGRAM_API_URL", "https://engram-api.whitedune-6b4bf4e3.centralindia.azurecontainerapps.io"),
  engramApiKey: readString("ENGRAM_API_KEY", ""),
  mcpPort: readPort("MCP_PORT", 3000),
  mcpTransport: readTransport("MCP_TRANSPORT", "stdio"),
};
