import { config } from "./config.js";

export type SearchParams = {
  query: string;
  limit: number;
  threshold: number;
};

export type ListParams = {
  limit: number;
  offset: number;
};

export type RetrievalLogParams = {
  conversation_id?: string;
  limit: number;
};

class EngramClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.engramApiUrl.replace(/\/$/, "");
    this.apiKey = config.engramApiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Engram-Key": this.apiKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Engram API error: ${response.status} ${await response.text()}`);
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
    return this.request("POST", "/memories/search", params);
  }

  async addMemory(content: string): Promise<unknown> {
    return this.request("POST", "/memories", { content });
  }

  async deleteMemory(memoryId: string): Promise<{ success: boolean }> {
    await this.request<void>("DELETE", `/memories/${memoryId}`);
    return { success: true };
  }

  async listMemories(params: ListParams): Promise<unknown> {
    const query = new URLSearchParams({
      limit: String(params.limit),
      offset: String(params.offset),
    });
    return this.request("GET", `/memories?${query.toString()}`);
  }

  async updateMemory(memoryId: string, content: string): Promise<unknown> {
    return this.request("PATCH", `/memories/${memoryId}`, { content });
  }

  async getRetrievalLog(params: RetrievalLogParams): Promise<unknown> {
    const query = new URLSearchParams({ limit: String(params.limit) });
    if (params.conversation_id) {
      query.set("conversation_id", params.conversation_id);
    }
    return this.request("GET", `/logs?${query.toString()}`);
  }
}

export const engramClient = new EngramClient();
