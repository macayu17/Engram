import { credentialHeaders, resolveNamespace, requireScope } from "./auth.js";
import { config } from "./config.js";

export type ScopedParams = { namespace?: string };

export type SearchParams = ScopedParams & {
  include_personal?: boolean;
  query: string;
  limit: number;
  threshold: number;
};

export type ListParams = ScopedParams & {
  status?: "approved" | "pending" | "rejected";
  limit: number;
  offset: number;
};

export type RetrievalLogParams = ScopedParams & {
  conversation_id?: string;
  limit: number;
};

export type CaptureConversationParams = ScopedParams & {
  user_message: string;
  assistant_response: string;
  source: string;
  session_id?: string;
};

class EngramClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.engramApiUrl.replace(/\/$/, "");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      signal: AbortSignal.timeout(30000),
      headers: {
        "Content-Type": "application/json",
        ...credentialHeaders(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(
        `Engram API error: ${response.status} ${await response.text()}`,
      );
    }
    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  async searchMemories(params: SearchParams): Promise<unknown> {
    requireScope("memory:read");
    return this.request("POST", "/memories/search", {
      ...params,
      namespace: resolveNamespace(params.namespace, params.include_personal),
    });
  }

  async addMemory(content: string, namespace?: string): Promise<unknown> {
    requireScope("memory:write");
    return this.request("POST", "/memories", {
      content,
      namespace: resolveNamespace(namespace),
    });
  }

  async captureConversation(
    params: CaptureConversationParams,
  ): Promise<unknown> {
    requireScope("memory:write");
    const result = await this.request("POST", "/memories/capture", {
      ...params,
      namespace: resolveNamespace(params.namespace),
    });
    return {
      capture: result,
      review:
        "Extracted facts remain pending until reviewed; scheduling does not mean extraction completed.",
    };
  }

  async deleteMemory(
    memoryId: string,
    namespace?: string,
  ): Promise<{ success: boolean }> {
    requireScope("memory:write");
    await this.request<void>(
      "DELETE",
      `/memories/${memoryId}?namespace=${encodeURIComponent(resolveNamespace(namespace))}`,
    );
    return { success: true };
  }

  async listMemories(params: ListParams): Promise<unknown> {
    requireScope("memory:read");
    const query = new URLSearchParams({
      namespace: resolveNamespace(params.namespace),
      ...(params.status ? { status: params.status } : {}),
      limit: String(params.limit),
      offset: String(params.offset),
    });
    return this.request("GET", `/memories?${query.toString()}`);
  }

  async updateMemory(
    memoryId: string,
    content: string,
    namespace?: string,
  ): Promise<unknown> {
    requireScope("memory:write");
    const project = resolveNamespace(namespace);
    return this.request(
      "PATCH",
      `/memories/${memoryId}?namespace=${encodeURIComponent(project)}`,
      { content },
    );
  }

  async getRetrievalLog(params: RetrievalLogParams): Promise<unknown> {
    requireScope("memory:read");
    const query = new URLSearchParams({
      limit: String(params.limit),
      namespace: resolveNamespace(params.namespace),
    });
    if (params.conversation_id) {
      query.set("conversation_id", params.conversation_id);
    }
    return this.request("GET", `/logs?${query.toString()}`);
  }
}

export const engramClient = new EngramClient();
