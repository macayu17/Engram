export type Memory = {
  id: string;
  content: string;
  confidence: number;
  access_count: number;
  last_accessed: string | null;
  created_at: string;
  source_conversation_id: string | null;
};

export type MemoryListResponse = {
  memories: Memory[];
  total: number;
  limit: number;
  offset: number;
};

export type SearchResponse = {
  results: Array<{ memory: Memory; score: number }>;
};

export type RetrievedMemory = {
  memory_id: string;
  content: string | null;
  score: number;
};

export type RetrievalLog = {
  id: string;
  query: string;
  retrieved_memories: RetrievedMemory[];
  conversation_id: string | null;
  created_at: string;
};

export type LogListResponse = {
  logs: RetrievalLog[];
  total: number;
  limit: number;
  offset: number;
};

export type User = {
  id: string;
  external_id: string;
  created_at: string;
};

export type UserCreateResponse = User & {
  api_key: string;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getApiKey(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem("engram_api_key") ?? "";
}

function toQuery(params?: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Engram-Key": getApiKey(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const api = {
  memories: {
    list: (params?: { limit?: number; offset?: number; search?: string; order?: string; direction?: string }) =>
      request<MemoryListResponse>("GET", `/memories${toQuery(params)}`),
    create: (content: string) => request<Memory>("POST", "/memories", { content }),
    update: (id: string, content: string) => request<Memory>("PATCH", `/memories/${id}`, { content }),
    delete: (id: string) => request<void>("DELETE", `/memories/${id}`),
    search: (query: string, limit = 5, threshold = 0.5) =>
      request<SearchResponse>("POST", "/memories/search", { query, limit, threshold }),
  },
  logs: {
    list: (params?: { limit?: number; offset?: number; conversation_id?: string }) =>
      request<LogListResponse>("GET", `/logs${toQuery(params)}`),
  },
  users: {
    create: (externalId: string) => request<UserCreateResponse>("POST", "/users", { external_id: externalId }),
    me: () => request<User>("GET", "/users/me"),
    deleteMe: () => request<void>("DELETE", "/users/me"),
  },
};
