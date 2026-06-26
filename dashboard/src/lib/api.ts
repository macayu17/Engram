import { extractChatResponseContent } from "./chat-response";

export type Memory = {
  id: string;
  content: string;
  confidence: number;
  access_count: number;
  last_accessed: string | null;
  created_at: string;
  source_conversation_id: string | null;
  status: "pending" | "approved" | "rejected";
  category: string;
  pinned: boolean;
  source: string;
  last_confirmed: string | null;
};

export type MemoryUpdatePayload = {
  content?: string;
  category?: string;
  pinned?: boolean;
  status?: "pending" | "approved" | "rejected";
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

export type MemorySourceResponse = {
  memory: Memory;
  conversation: Record<string, unknown> | null;
};

export type MemoryMergeSuggestion = {
  primary: Memory;
  duplicate: Memory;
  reason: string;
};

export type MemoryTimelineItem = {
  id: string;
  type: string;
  title: string;
  category: string | null;
  created_at: string;
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

export type ClientRegistryItem = {
  source: string;
  conversations: number;
  memories_extracted: number;
  last_seen: string;
};

export type User = {
  id: string;
  external_id: string;
  created_at: string;
};

export type UserCreateResponse = User & {
  api_key: string;
};

export type UserConfig = {
  max_memories_injected: number;
  retrieval_threshold: number;
  dedup_threshold: number;
};

export type UserConfigUpdate = Partial<UserConfig>;

export type UserProviderConfig = {
  extraction_provider: "openai" | "gemini" | "ollama";
  extraction_model: string;
  has_user_api_key: boolean;
  user_api_key_preview: string | null;
};

export type UserProviderConfigUpdate = {
  extraction_provider?: "openai" | "gemini" | "ollama";
  extraction_model?: string;
  openai_api_key?: string;
  gemini_api_key?: string;
  clear_openai_key?: boolean;
  clear_gemini_key?: boolean;
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

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000").replace(/\/+$/, "");
const ACTIVE_API_KEY_STORAGE_KEY = "engram_api_key";
export type GraphEntity = {
  id: string;
  name: string;
  entity_type: string;
  memory_count: number;
};

export type GraphMemoryItem = {
  id: string;
  content: string;
  confidence: number;
  category: string;
  pinned: boolean;
  created_at: string;
};

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

const DEFAULT_TIMEOUT_MS = 30_000;
const LONG_TIMEOUT_MS = 300_000;
const LONG_PATHS = ["/graph/extract", "/memories/import"];

async function request<T>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = LONG_PATHS.some((p) => path.startsWith(p)) ? LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const timeoutId = typeof window === "undefined" ? null : window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Engram-Key": getApiKey(),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: controller.signal,
    });
  } catch (error) {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  }
  if (timeoutId !== null) window.clearTimeout(timeoutId);
  if (!response.ok) {
    throw new Error(await getResponseError(response, "API error"));
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
    throw new Error(await getResponseError(response, "Dashboard API error"));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function requestChat(params: {
  externalId: string;
  provider: string;
  model: string;
  messages: ChatMessage[];
  providerKey?: string;
}): Promise<ChatResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Engram-Key": getApiKey(),
    "X-Engram-User-ID": params.externalId,
    "X-Engram-Provider": params.provider,
  };
  if (params.providerKey) {
    headers["X-Engram-Provider-Key"] = params.providerKey;
  }
  const response = await fetch(`${API_BASE_URL}/v1/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
    }),
  });
  if (!response.ok) {
    throw new Error(await getResponseError(response, "API error"));
  }
  const payload = await response.json() as unknown;
  return {
    content: extractChatResponseContent(payload),
    conversationId: response.headers.get("X-Engram-Conversation-ID") ?? "",
    injectedCount: Number(response.headers.get("X-Engram-Memories-Injected") ?? 0),
  };
}

async function deleteAllMemories(): Promise<void> {
  await request<void>("DELETE", "/memories");
}

export const api = {
  chat: {
    send: requestChat,
  },
  memories: {
    list: (params?: { limit?: number; offset?: number; search?: string; order?: string; direction?: string; status?: string; category?: string }) =>
      request<MemoryListResponse>("GET", `/memories${toQuery(params)}`),
    create: (content: string) => request<Memory>("POST", "/memories", { content }),
    update: (id: string, payload: MemoryUpdatePayload) => request<Memory>("PATCH", `/memories/${id}`, payload),
    delete: (id: string) => request<void>("DELETE", `/memories/${id}`),
    deleteAll: deleteAllMemories,
    review: (params?: { limit?: number; offset?: number }) => request<MemoryListResponse>("GET", `/memories/review${toQuery(params)}`),
    exportAll: () => request<{ memories: Memory[] }>("GET", "/memories/export"),
    importMany: (memories: Array<{ content: string; category?: string; pinned?: boolean }>) =>
      request<{ imported: number }>("POST", "/memories/import", { memories }),
    source: (id: string) => request<MemorySourceResponse>("GET", `/memories/${id}/source`),
    mergeSuggestions: (limit = 5) => request<{ suggestions: MemoryMergeSuggestion[] }>("GET", `/memories/merge-suggestions${toQuery({ limit })}`),
    merge: (payload: { primary_id: string; duplicate_id: string; content?: string }) => request<Memory>("POST", "/memories/merge", payload),
    decay: () => request<{ updated: number }>("POST", "/memories/decay"),
    timeline: (limit = 12) => request<{ items: MemoryTimelineItem[] }>("GET", `/memories/timeline${toQuery({ limit })}`),
    search: (query: string, limit = 5, threshold = 0.5) =>
      request<SearchResponse>("POST", "/memories/search", { query, limit, threshold }),
  },
  logs: {
    list: (params?: { limit?: number; offset?: number; conversation_id?: string }) =>
      request<LogListResponse>("GET", `/logs${toQuery(params)}`),
    clients: () => request<{ clients: ClientRegistryItem[] }>("GET", "/logs/clients"),
  },
  graph: {
    listEntities: () => request<{ entities: GraphEntity[] }>("GET", "/graph/entities"),
    entityMemories: (entityType: string, entityName: string) =>
      request<{ entity_name: string; entity_type: string; memories: GraphMemoryItem[] }>(
        "GET",
        `/graph/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityName)}/memories`,
      ),
    neighbors: (memoryId: string) =>
      request<{ memory_id: string; neighbors: GraphMemoryItem[]; entities: GraphEntity[] }>(
        "GET",
        `/graph/memories/${memoryId}/neighbors`,
      ),
    extract: () => request<{ processed: number; entities_created: number }>("POST", "/graph/extract"),
  },
  users: {
    create: (externalId: string) => requestInternal<UserCreateResponse>("POST", "/api/engram/users", { external_id: externalId }),
    ensureClerkKey: () => requestInternal<ClerkEngramKeyResponse>("POST", "/api/engram/user-key"),
    me: () => request<User>("GET", "/users/me"),
    update: (externalId: string) => request<User>("PATCH", "/users/me", { external_id: externalId }),
    config: () => request<UserConfig>("GET", "/users/me/config"),
    updateConfig: (payload: UserConfigUpdate) => request<UserConfig>("PATCH", "/users/me/config", payload),
    provider: () => request<UserProviderConfig>("GET", "/users/me/provider"),
    updateProvider: (payload: UserProviderConfigUpdate) => request<UserProviderConfig>("PATCH", "/users/me/provider", payload),
    regenerateKey: () => request<UserCreateResponse>("POST", "/users/me/api-key"),
    deleteMe: () => request<void>("DELETE", "/users/me"),
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function getResponseError(response: Response, prefix: string): Promise<string> {
  const body = await response.text();
  if (!body) {
    return `${prefix}: ${response.status}`;
  }
  try {
    const parsed = JSON.parse(body) as unknown;
    if (isRecord(parsed)) {
      const detail = parsed.error ?? parsed.detail;
      if (typeof detail === "string") {
        return detail;
      }
    }
  } catch {
    return `${prefix}: ${response.status} ${body}`;
  }
  return `${prefix}: ${response.status} ${body}`;
}
