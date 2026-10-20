import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";

import { config } from "./config.js";

export type RequestContext = {
  headers: Record<string, string>;
  scopes: string[];
  namespace?: string;
  identity: string;
  oauth: boolean;
};

export const requestContext = new AsyncLocalStorage<RequestContext>();
let stdioEnabled = false;

export function enableStdioAuth(): void {
  stdioEnabled = true;
}

export function credentialHeaders(): Record<string, string> {
  const context = requestContext.getStore();
  if (context) return context.headers;
  if (stdioEnabled) return { "X-Engram-Key": config.engramApiKey };
  throw new HttpError(401, "No authenticated request context");
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function authenticate(
  request: IncomingMessage,
): Promise<RequestContext> {
  const authorization = request.headers.authorization;
  const apiKey = request.headers["x-engram-key"];
  if (authorization && apiKey)
    throw new HttpError(401, "Supply one credential type");
  const oauth = Boolean(authorization);
  if (oauth && !/^Bearer \S+$/i.test(authorization!))
    throw new HttpError(401, "Invalid bearer credential");
  if (!oauth && (typeof apiKey !== "string" || !apiKey))
    throw new HttpError(401, "Authentication required");
  const headers: Record<string, string> = oauth
    ? { Authorization: authorization! }
    : { "X-Engram-Key": apiKey as string };
  let response: Response;
  try {
    response = await fetch(
      `${config.engramApiUrl.replace(/\/$/, "")}${oauth ? "/oauth/introspect" : "/users/me"}`,
      {
        method: oauth ? "POST" : "GET",
        headers,
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch {
    throw new HttpError(503, "Authentication service unavailable");
  }
  if (!response.ok)
    throw new HttpError(
      response.status >= 500 ? 503 : 401,
      "Authentication failed",
    );
  const data: unknown = await response.json();
  if (!data || typeof data !== "object")
    throw new HttpError(401, "Invalid authentication response");
  const record = data as Record<string, unknown>;
  if (
    oauth &&
    (record.active !== true ||
      typeof record.scope !== "string" ||
      typeof record.namespace !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(record.namespace))
  )
    throw new HttpError(401, "Inactive or invalid token");
  return {
    headers,
    oauth,
    scopes: oauth
      ? (record.scope as string).split(" ")
      : ["memory:read", "memory:write"],
    namespace: oauth ? (record.namespace as string) : undefined,
    identity: createHash("sha256")
      .update(JSON.stringify(headers))
      .digest("hex"),
  };
}

export function requireScope(scope: string): void {
  const context = requestContext.getStore();
  if (context && !context.scopes.includes(scope))
    throw new HttpError(403, `Required scope: ${scope}`);
}

export function resolveNamespace(
  namespace?: string,
  includePersonal = false,
): string {
  const context = requestContext.getStore();
  if (
    context?.oauth &&
    (includePersonal ||
      (namespace !== undefined && namespace !== context.namespace))
  )
    throw new HttpError(403, "Token is bound to its granted project");
  return context?.namespace ?? namespace ?? config.namespace;
}
