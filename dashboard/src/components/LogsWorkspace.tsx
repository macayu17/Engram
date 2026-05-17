"use client";

import { useQuery } from "@tanstack/react-query";
import { Filter, RefreshCw } from "lucide-react";
import { FormEvent, useState } from "react";

import { api } from "@/lib/api";
import { LogEntry } from "./LogEntry";


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
      <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ II — Retrieval trace</p>
          <h1 className="mt-2 font-serif text-5xl font-semibold leading-tight text-ink">Logs</h1>
          <p className="mt-4 max-w-2xl font-serif text-lg leading-8 text-muted">
            Every retrieval event is kept as an editorial trail: the query, the memories surfaced, and the conversation that caused it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => logsQuery.refetch()}
          className="inline-flex items-center gap-2 border border-line px-4 py-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:border-signal hover:text-signal"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <form onSubmit={submitFilter} className="flex flex-col gap-3 sm:flex-row">
        <label className="flex min-h-12 flex-1 items-center gap-3 rounded-full border border-line bg-paper px-4 text-sm text-ink focus-within:border-signal">
          <Filter size={16} aria-hidden="true" className="text-muted" />
          <input
            value={draftConversationId}
            onChange={(event) => setDraftConversationId(event.target.value)}
            placeholder="Conversation ID"
            className="min-w-0 flex-1 bg-transparent font-serif text-base outline-none placeholder:text-muted"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center border border-ink px-5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-ink hover:border-signal hover:text-signal"
        >
          Filter
        </button>
      </form>

      {logsQuery.isError && (
        <div className="border-y border-fault/30 bg-fault/5 py-5 font-serif text-base text-fault">
          Unable to load retrieval logs.
        </div>
      )}

      {logsQuery.isLoading ? (
        <div className="border-y border-line py-12 font-serif text-lg text-muted">Loading logs...</div>
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
  return <div className="py-12 text-center font-serif text-lg text-muted">No retrieval logs found.</div>;
}
