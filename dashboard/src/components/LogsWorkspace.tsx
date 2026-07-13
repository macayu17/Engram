"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, RefreshCw } from "lucide-react";
import { FormEvent, useState } from "react";

import { api } from "@/lib/api";
import { LogEntry } from "./LogEntry";
import { ProductPageHeader } from "./ProductPageHeader";


const PAGE_SIZE = 20;

export function LogsWorkspace() {
  const [page, setPage] = useState(0);
  const [draftConversationId, setDraftConversationId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const logsQuery = useQuery({
    queryKey: ["logs", page, conversationId],
    queryFn: () =>
      api.logs.list({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        conversation_id: conversationId || undefined,
      }),
  });

  function submitFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(0);
    setConversationId(draftConversationId.trim());
  }

  const logs = logsQuery.data?.logs ?? [];
  const total = logsQuery.data?.total ?? 0;
  const hasNextPage = (page + 1) * PAGE_SIZE < total;

  return (
    <section className="space-y-12">
      <ProductPageHeader
        eyebrow="§ II — Retrieval trace"
        title="Logs"
        description="Every retrieval event is kept as an editorial trail: the query, the memories surfaced, and the conversation that caused it."
        actions={(
          <button type="button" onClick={() => logsQuery.refetch()} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted transition hover:border-signal hover:text-signal active:translate-y-px">
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
        )}
      />

      <form onSubmit={submitFilter} className="flex flex-col gap-3 sm:flex-row">
        <label className="flex min-h-12 flex-1 items-center gap-3 rounded-lg border border-line bg-panel px-4 text-sm text-ink transition focus-within:border-signal focus-within:ring-1 focus-within:ring-signal/30">
          <Filter size={16} aria-hidden="true" className="text-muted" />
          <input
            value={draftConversationId}
            onChange={(event) => setDraftConversationId(event.target.value)}
            placeholder="Conversation ID"
            className="min-w-0 flex-1 bg-transparent font-sans text-sm outline-none placeholder:text-muted"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-lg border border-ink px-5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-ink transition hover:border-signal hover:bg-signal hover:text-paper"
        >
          Filter
        </button>
      </form>

      {logsQuery.isError && (
        <div className="border-y border-fault/30 bg-fault/5 px-4 py-5 font-sans text-sm text-fault">
          Unable to load retrieval logs.
        </div>
      )}

      {logsQuery.isLoading ? (
        <div className="border-y border-line py-12 font-sans text-sm text-muted">Loading logs...</div>
      ) : (
        <div className="border-y border-line">
          {logs.length ? logs.map((log) => <LogEntry key={log.id} log={log} />) : <EmptyLogs />}
        </div>
      )}

      <div className="flex items-center justify-between font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        <span>
          Showing {logs.length} of {total}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            className="px-3 py-2 hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>
          <button
            type="button"
            disabled={!hasNextPage}
            onClick={() => setPage((value) => value + 1)}
            className="px-3 py-2 hover:text-signal disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </section>
  );
}


function EmptyLogs() {
  return <div className="py-12 text-center font-sans text-sm text-muted">No retrieval logs found. Retrieval traces appear after a memory-enabled request.</div>;
}
