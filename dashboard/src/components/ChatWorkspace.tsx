"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";
import { FormEvent, KeyboardEvent, useMemo, useState } from "react";

import { api, type ChatMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useActiveApiKey } from "@/lib/useActiveApiKey";

type VisualMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  injectedCount?: number;
  conversationId?: string;
};

export function ChatWorkspace() {
  const [draft, setDraft] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [messages, setMessages] = useState<VisualMessage[]>([]);
  const apiKey = useActiveApiKey();
  const [error, setError] = useState("");
  const userQuery = useQuery({
    queryKey: ["current-user", apiKey],
    queryFn: () => api.users.me(),
    enabled: Boolean(apiKey) && apiKey.startsWith("ek_"),
  });
  const chatHistory = useMemo<ChatMessage[]>(
    () => messages.map((message) => ({ role: message.role, content: message.content })),
    [messages],
  );
  const chatMutation = useMutation({
    mutationFn: (content: string) => {
      if (!userQuery.data) {
        throw new Error("Save or generate an Engram key in Settings first.");
      }
      return api.chat.send({
        externalId: userQuery.data.external_id,
        provider,
        model,
        messages: [...chatHistory, { role: "user", content }],
      });
    },
    onSuccess: (response) => {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.content,
          injectedCount: response.injectedCount,
          conversationId: response.conversationId,
        },
      ]);
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Chat request failed.");
    },
  });

  function sendDraftMessage() {
    const content = draft.trim();
    if (!content || chatMutation.isPending) {
      return;
    }
    setError("");
    setDraft("");
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content,
      },
    ]);
    chatMutation.mutate(content);
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendDraftMessage();
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendDraftMessage();
    }
  }

  function clearChat() {
    setMessages([]);
    setError("");
  }

  const canChat = Boolean(apiKey) && apiKey.startsWith("ek_") && Boolean(userQuery.data);
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");

  return (
    <section className="space-y-10">
      <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ IV — Visual proxy</p>
          <h1 className="mt-2 font-serif text-5xl font-semibold leading-tight text-ink">Chat</h1>
          <p className="mt-4 max-w-2xl font-serif text-lg leading-8 text-muted">
            Send messages through Engram and watch memory injection happen without writing request JSON.
          </p>
        </div>
        <button
          type="button"
          onClick={clearChat}
          className="inline-flex items-center gap-2 border border-line px-4 py-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:border-signal hover:text-signal"
        >
          Clear View
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="min-h-[28rem] overflow-hidden rounded-lg border border-line bg-panel">
            {messages.length ? (
              messages.map((message) => <ChatRow key={message.id} message={message} />)
            ) : (
              <div className="flex min-h-[28rem] flex-col items-center justify-center px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded bg-tag text-signal">
                  <MessageSquare size={20} aria-hidden="true" />
                </span>
                <p className="mt-5 max-w-md font-serif text-xl leading-8 text-ink">Ask something that should use your saved memories.</p>
                <p className="mt-2 max-w-md font-sans text-sm leading-6 text-muted">
                  Try: What am I testing with Supabase Postgres?
                </p>
              </div>
            )}
            {chatMutation.isPending && (
              <div className="border-t border-line px-5 py-5 font-sans text-sm text-muted">Waiting for provider response...</div>
            )}
          </div>

          <form onSubmit={submitMessage} className="flex flex-col gap-3 sm:flex-row">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="Ask through Engram..."
              className="min-h-28 min-w-0 flex-1 rounded-lg border border-line bg-panel p-4 font-sans text-sm leading-6 text-ink outline-none focus:border-signal focus:ring-1 focus:ring-signal/30"
            />
            <button
              type="submit"
              disabled={!canChat || chatMutation.isPending || !draft.trim()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-ink px-5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-ink transition hover:border-signal hover:bg-signal hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} aria-hidden="true" />
              Send
            </button>
          </form>
          {error && <p className="font-sans text-sm text-fault">{error}</p>}
        </div>

        <aside className="border-y border-line py-5">
          <h2 className="font-serif text-2xl font-semibold">Run Context</h2>
          <dl className="mt-5 space-y-5">
            <div>
              <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Current User</dt>
              <dd className="mt-1 break-words font-serif text-base text-ink">
                {userQuery.data?.external_id ?? (apiKey ? "Checking key..." : "No key saved")}
              </dd>
            </div>
            <div>
              <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Provider</dt>
              <dd className="mt-2">
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="min-h-10 w-full rounded-md border border-line bg-panel px-3 font-sans text-sm text-ink outline-none focus:border-signal"
                >
                  <option value="openai">openai</option>
                  <option value="anthropic">anthropic</option>
                  <option value="gemini">gemini</option>
                  <option value="ollama">ollama</option>
                </select>
              </dd>
            </div>
            <div>
              <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Model</dt>
              <dd className="mt-2">
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="min-h-10 w-full rounded-md border border-line bg-panel px-3 font-mono text-xs text-ink outline-none focus:border-signal"
                />
              </dd>
            </div>
            <div>
              <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Last Exchange</dt>
              <dd className="mt-2 space-y-2 font-serif text-base leading-7 text-ink">
                <p>{lastAssistantMessage?.injectedCount ?? 0} memories injected</p>
                <p className="break-words font-sans text-[10px] uppercase tracking-[0.12em] text-muted">
                  {lastAssistantMessage?.conversationId ?? "No conversation yet"}
                </p>
              </dd>
            </div>
          </dl>
          {!apiKey && <p className="mt-5 font-serif text-base leading-7 text-fault">Generate or save an Engram key in Settings first.</p>}
          {apiKey && userQuery.isError && <p className="mt-5 font-serif text-base leading-7 text-fault">The saved key could not authenticate.</p>}
        </aside>
      </div>
    </section>
  );
}

function ChatRow({ message }: { message: VisualMessage }) {
  const isAssistant = message.role === "assistant";
  return (
    <article className="border-b border-line py-5 last:border-b-0">
      <div className="grid gap-3 md:grid-cols-[120px_1fr]">
        <div className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{isAssistant ? "Assistant" : "You"}</div>
        <div>
          <p className={cn("whitespace-pre-wrap font-sans text-[15px] leading-7", isAssistant ? "text-ink" : "text-muted")}>{message.content}</p>
          {isAssistant && (
            <p className="mt-3 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              {message.injectedCount ?? 0} memories injected {message.conversationId ? `· ${message.conversationId}` : ""}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
