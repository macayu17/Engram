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
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase text-signal">retrieval trace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Logs</h1>
        </div>
        <button
          type="button"
          onClick={() => logsQuery.refetch()}
          className="inline-flex items-center gap-2 rounded border border-line px-3 py-2 text-sm text-zinc-300 hover:border-signal/40 hover:text-white"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <form onSubmit={submitFilter} className="flex flex-col gap-2 rounded border border-line bg-panel p-4 sm:flex-row">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded border border-line bg-ink px-3 text-sm text-zinc-200 focus-within:border-signal">
          <Filter size={16} aria-hidden="true" className="text-zinc-500" />
          <input
            value={draftConversationId}
            onChange={(event) => setDraftConversationId(event.target.value)}
            placeholder="Conversation ID"
            className="min-w-0 flex-1 bg-transparent font-mono outline-none placeholder:text-zinc-600"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded border border-signal/40 bg-signal/10 px-4 text-sm font-medium text-signal hover:bg-signal/15"
        >
          Filter
        </button>
      </form>

      {logsQuery.isError && (
        <div className="rounded border border-fault/40 bg-fault/10 p-4 text-sm text-fault">
          Unable to load retrieval logs.
        </div>
      )}

      {logsQuery.isLoading ? (
        <div className="rounded border border-line bg-panel p-8 text-sm text-zinc-500">Loading logs...</div>
      ) : (
        <div className="space-y-3">
          {logs.length ? logs.map((log) => <LogEntry key={log.id} log={log} />) : <EmptyLogs />}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          Showing {logs.length} of {total}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            className="rounded border border-line px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!hasNextPage}
            onClick={() => setPage((value) => value + 1)}
            className="rounded border border-line px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}


function EmptyLogs() {
  return <div className="rounded border border-line bg-panel p-8 text-center text-sm text-zinc-500">No retrieval logs found.</div>;
}
