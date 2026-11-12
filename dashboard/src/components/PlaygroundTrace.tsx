"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/lib/api";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { useNamespace } from "@/lib/useNamespace";

export function PlaygroundTrace({
  conversationId,
  originalRequest,
  injectedCount,
}: {
  conversationId: string;
  originalRequest: string;
  injectedCount: number;
}) {
  const apiKey = useActiveApiKey();
  const namespace = useNamespace();
  const [startedAt] = useState(Date.now);
  const logs = useQuery({
    queryKey: ["logs", "playground", apiKey, namespace, conversationId],
    queryFn: () =>
      api.logs.list({ conversation_id: conversationId, limit: 10 }),
    refetchInterval: (query) =>
      !query.state.data?.logs.length && Date.now() - startedAt < 15000
        ? 2000
        : false,
  });
  const log =
    logs.data?.logs.find(
      (entry) =>
        entry.conversation_id === conversationId &&
        entry.retrieval_mode !== "search",
    ) ?? logs.data?.logs[0];
  return (
    <section
      aria-label="Actual retrieval trace"
      className="space-y-5 rounded-lg border border-line p-5"
    >
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-2xl">Actual retrieval trace</h2>
        <button
          type="button"
          onClick={() => void logs.refetch()}
          className="min-h-10 px-3 text-sm text-muted"
        >
          Refresh trace
        </button>
      </div>
      <p className="break-all font-mono text-xs text-muted">
        {conversationId} · project {log?.namespace ?? namespace} ·{" "}
        {injectedCount} injected
      </p>
      <div>
        <h3 className="text-xs text-muted">Original request</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
          {originalRequest}
        </p>
      </div>
      {logs.isLoading && (
        <p role="status">Loading the retrieval event for this response...</p>
      )}
      {logs.error && (
        <p role="alert" className="text-sm text-fault">
          {logs.error.message}
        </p>
      )}
      {!logs.isLoading && !log && (
        <p className="text-sm text-muted">
          No retrieval event recorded for this response yet. The request may
          have continued without memory after a retrieval error.
        </p>
      )}
      {log && (
        <>
          <p className="text-xs text-muted">
            Mode: {log.retrieval_mode ?? "proxy"} ·{" "}
            {log.injected_count ?? injectedCount} facts injected
          </p>
          <h3 className="text-xs text-muted">Retrieved facts</h3>
          {log.retrieved_memories.length === 0 && (
            <p className="text-sm text-muted">
              No approved memories matched this request.
            </p>
          )}
          <ol className="divide-y divide-line">
            {log.retrieved_memories.map((memory) => (
              <li key={memory.memory_id} className="space-y-2 py-4">
                <p className="text-sm leading-7">
                  {memory.content ?? "Saved snapshot unavailable"}
                </p>
                <p className="font-mono text-xs text-muted">
                  Rank score {memory.score.toFixed(3)}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
