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

export type ClerkEngramKeyResponse = {
  apiKey: string;
  externalId: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  content: string;
  conversationId: string;
  injectedCount: number;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ACTIVE_API_KEY_STORAGE_KEY = "engram_api_key";
export const CLERK_API_KEY_STORAGE_PREFIX = "engram_api_key:clerk:";
export const ACTIVE_API_KEY_CHANGED_EVENT = "engram-api-key-changed";

function storageAvailable(): boolean {
  return typeof window !== "undefined";
}

export function readActiveApiKey(): string {
  if (!storageAvailable()) {
    return "";
  }
  return localStorage.getItem(ACTIVE_API_KEY_STORAGE_KEY) ?? "";
}

export function setActiveApiKey(apiKey: string): void {
  if (!storageAvailable()) {
    return;
  }
  localStorage.setItem(ACTIVE_API_KEY_STORAGE_KEY, apiKey);
  window.dispatchEvent(new Event(ACTIVE_API_KEY_CHANGED_EVENT));
}

export function clearActiveApiKey(): void {
  if (!storageAvailable()) {
    return;
  }
  localStorage.removeItem(ACTIVE_API_KEY_STORAGE_KEY);
  window.dispatchEvent(new Event(ACTIVE_API_KEY_CHANGED_EVENT));
}

export function readClerkApiKey(clerkUserId: string): string {
  if (!storageAvailable()) {
    return "";
  }
  return localStorage.getItem(`${CLERK_API_KEY_STORAGE_PREFIX}${clerkUserId}`) ?? "";
}

export function setClerkApiKey(clerkUserId: string, apiKey: string): void {
  if (!storageAvailable()) {
    return;
  }
  localStorage.setItem(`${CLERK_API_KEY_STORAGE_PREFIX}${clerkUserId}`, apiKey);
}

export function clearClerkApiKey(clerkUserId: string): void {
  if (!storageAvailable()) {
    return;
  }
  localStorage.removeItem(`${CLERK_API_KEY_STORAGE_PREFIX}${clerkUserId}`);
}

export function subscribeActiveApiKey(listener: () => void): () => void {
  if (!storageAvailable()) {
    return () => undefined;
  }
  const storageListener = (event: StorageEvent) => {
    if (event.key === ACTIVE_API_KEY_STORAGE_KEY || event.key?.startsWith(CLERK_API_KEY_STORAGE_PREFIX)) {
      listener();
    }
  };
  window.addEventListener(ACTIVE_API_KEY_CHANGED_EVENT, listener);
  window.addEventListener("storage", storageListener);
  return () => {
    window.removeEventListener(ACTIVE_API_KEY_CHANGED_EVENT, listener);
    window.removeEventListener("storage", storageListener);
  };
}

function getApiKey(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return readActiveApiKey();
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

async function request<T>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Engram-Key": getApiKey(),
      ...extraHeaders,
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

async function requestInternal<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Dashboard API error: ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function requestChat(params: { externalId: string; provider: string; model: string; messages: ChatMessage[] }): Promise<ChatResponse> {
  const response = await fetch(`${BASE_URL}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Engram-Key": getApiKey(),
      "X-Engram-User-ID": params.externalId,
      "X-Engram-Provider": params.provider,
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
    }),
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return {
    content: payload.choices?.[0]?.message?.content ?? JSON.stringify(payload),
    conversationId: response.headers.get("X-Engram-Conversation-ID") ?? "",
    injectedCount: Number(response.headers.get("X-Engram-Memories-Injected") ?? 0),
  };
}

export const api = {
  chat: {
    send: requestChat,
  },
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
    ensureClerkKey: () => requestInternal<ClerkEngramKeyResponse>("POST", "/api/engram/user-key"),
    me: () => request<User>("GET", "/users/me"),
    deleteMe: () => request<void>("DELETE", "/users/me"),
  },
};
