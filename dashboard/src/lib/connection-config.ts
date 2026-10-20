export function buildConnectionConfig(
  client: "claude" | "codex",
  scriptPath: string,
  apiUrl: string,
  namespace: string,
  apiKey?: string,
): string {
  const environment = {
    ENGRAM_API_URL: apiUrl,
    ENGRAM_API_KEY: apiKey || "<ENGRAM_API_KEY>",
    ENGRAM_NAMESPACE: namespace,
  };
  if (client === "claude") {
    return JSON.stringify(
      {
        mcpServers: {
          engram: { command: "node", args: [scriptPath], env: environment },
        },
      },
      null,
      2,
    );
  }
  return [
    "[mcp_servers.engram]",
    'command = "node"',
    `args = [${JSON.stringify(scriptPath)}]`,
    "",
    "[mcp_servers.engram.env]",
    ...Object.entries(environment).map(
      ([name, value]) => `${name} = ${JSON.stringify(value)}`,
    ),
  ].join("\n");
}

export function validateAuthorizationParams(
  params: URLSearchParams,
): string | null {
  if (!params.get("client_id") || !params.get("redirect_uri"))
    return "The connection request is missing its client or redirect address.";
  if (
    params.get("response_type") !== "code" ||
    params.get("code_challenge_method") !== "S256" ||
    !/^[A-Za-z0-9_-]{43}$/.test(params.get("code_challenge") || "")
  )
    return "This connection requires an authorization code with S256 PKCE.";
  const scopes = (params.get("scope") || "").split(" ").filter(Boolean);
  if (
    !scopes.length ||
    scopes.some((scope) => !["memory:read", "memory:write"].includes(scope))
  )
    return "The requested permissions are not supported.";
  return null;
}
