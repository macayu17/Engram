"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Download, GitMerge, MessageSquare, Plus, RefreshCw, ShieldCheck, Upload, UsersRound } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, FormEvent, ReactNode, useState } from "react";

import { api, type MemorySourceResponse, type MemoryUpdatePayload, type SearchResponse } from "@/lib/api";
import { MemoryCard } from "./MemoryCard";
import { MemoryTable } from "./MemoryTable";
import { ProductPageHeader } from "./ProductPageHeader";
import { SearchBar } from "./SearchBar";


const PAGE_SIZE = 20;

export function MemoryWorkspace() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResponse["results"] | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newMemory, setNewMemory] = useState("");
  const [sourceDetails, setSourceDetails] = useState<MemorySourceResponse | null>(null);
  const memoriesQuery = useQuery({
    queryKey: ["memories", page],
    queryFn: () => api.memories.list({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  });
  const reviewQuery = useQuery({
    queryKey: ["memories", "review"],
    queryFn: () => api.memories.review({ limit: 8, offset: 0 }),
  });
  const clientsQuery = useQuery({
    queryKey: ["logs", "clients"],
    queryFn: () => api.logs.clients(),
  });
  const timelineQuery = useQuery({
    queryKey: ["memories", "timeline"],
    queryFn: () => api.memories.timeline(10),
  });
  const mergeQuery = useQuery({
    queryKey: ["memories", "merge-suggestions"],
    queryFn: () => api.memories.mergeSuggestions(4),
  });
  const createMutation = useMutation({
    mutationFn: (content: string) => api.memories.create(content),
    onSuccess: () => {
      setNewMemory("");
      setIsAddOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MemoryUpdatePayload }) => api.memories.update(id, payload),
    onSuccess: () => void invalidateMemoryViews(),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.memories.delete(id),
    onSuccess: () => void invalidateMemoryViews(),
  });
  const sourceMutation = useMutation({
    mutationFn: (id: string) => api.memories.source(id),
    onSuccess: setSourceDetails,
  });
  const mergeMutation = useMutation({
    mutationFn: ({ primaryId, duplicateId }: { primaryId: string; duplicateId: string }) =>
      api.memories.merge({ primary_id: primaryId, duplicate_id: duplicateId }),
    onSuccess: () => void invalidateMemoryViews(),
  });
  const decayMutation = useMutation({
    mutationFn: () => api.memories.decay(),
    onSuccess: () => void invalidateMemoryViews(),
  });
  const importMutation = useMutation({
    mutationFn: (items: Array<{ content: string; category?: string; pinned?: boolean }>) => api.memories.importMany(items),
    onSuccess: () => void invalidateMemoryViews(),
  });

  function invalidateMemoryViews() {
    void queryClient.invalidateQueries({ queryKey: ["memories"] });
    void queryClient.invalidateQueries({ queryKey: ["logs", "clients"] });
  }

  function submitNewMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newMemory.trim();
    if (trimmed) {
      createMutation.mutate(trimmed);
    }
  }

  async function exportMemorySnapshot() {
    const snapshot = await api.memories.exportAll();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `engram-memories-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importMemorySnapshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const parsed = JSON.parse(await file.text()) as unknown;
    const rawItems = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.memories) ? parsed.memories : [];
    const items = rawItems
      .map((item) => {
        if (typeof item === "string") {
          return { content: item };
        }
        if (!isRecord(item) || typeof item.content !== "string") {
          return null;
        }
        return {
          content: item.content,
          category: typeof item.category === "string" ? item.category : undefined,
          pinned: typeof item.pinned === "boolean" ? item.pinned : undefined,
        };
      })
      .filter((item): item is { content: string; category?: string; pinned?: boolean } => item !== null);
    if (items.length) {
      importMutation.mutate(items);
    }
  }

  const memories = memoriesQuery.data?.memories ?? [];
  const total = memoriesQuery.data?.total ?? 0;
  const hasNextPage = (page + 1) * PAGE_SIZE < total;
  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || sourceMutation.isPending;

  return (
    <section className="space-y-16">
      <ProductPageHeader
        eyebrow="§ I — Memory ledger"
        title="Memories"
        description={<>{total.toLocaleString()} entries · browse, search, edit, merge, and approve everything Engram has captured.</>}
      />

      <div className="space-y-8">
        <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ I — The ledger</p>
            <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">Browse the memory store</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => memoriesQuery.refetch()}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted transition hover:border-signal hover:text-signal active:translate-y-px"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void exportMemorySnapshot()}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted transition hover:border-signal hover:text-signal active:translate-y-px"
            >
              <Download size={16} aria-hidden="true" />
              Export
            </button>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted transition hover:border-signal hover:text-signal active:translate-y-px">
              <Upload size={16} aria-hidden="true" />
              Import
              <input type="file" accept="application/json,.json" onChange={(event) => void importMemorySnapshot(event)} className="sr-only" />
            </label>
            <button
              type="button"
              onClick={() => decayMutation.mutate()}
              disabled={decayMutation.isPending}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted transition hover:border-signal hover:text-signal active:translate-y-px disabled:opacity-50"
            >
              <Clock size={16} aria-hidden="true" />
              Decay
            </button>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-signal px-4 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-paper transition hover:bg-ink active:translate-y-px"
            >
              <Plus size={16} aria-hidden="true" />
              Add Memory
            </button>
          </div>
        </div>

        <SearchBar onResults={setSearchResults} />
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        <LedgerPanel icon={<ShieldCheck size={16} aria-hidden="true" />} title="Review Queue" value={`${reviewQuery.data?.total ?? 0} pending`}>
          {(reviewQuery.data?.memories ?? []).slice(0, 3).map((memory) => (
            <PanelRow key={memory.id} text={memory.content} meta={memory.category} />
          ))}
        </LedgerPanel>
        <LedgerPanel icon={<UsersRound size={16} aria-hidden="true" />} title="Clients" value={`${clientsQuery.data?.clients.length ?? 0} sources`}>
          {(clientsQuery.data?.clients ?? []).slice(0, 3).map((client) => (
            <PanelRow key={client.source} text={client.source} meta={`${client.conversations} chats · ${client.memories_extracted} memories`} />
          ))}
        </LedgerPanel>
        <LedgerPanel icon={<GitMerge size={16} aria-hidden="true" />} title="Merge" value={`${mergeQuery.data?.suggestions.length ?? 0} pairs`}>
          {(mergeQuery.data?.suggestions ?? []).slice(0, 2).map((suggestion) => (
            <button
              key={`${suggestion.primary.id}-${suggestion.duplicate.id}`}
              type="button"
              onClick={() => mergeMutation.mutate({ primaryId: suggestion.primary.id, duplicateId: suggestion.duplicate.id })}
              className="block w-full text-left"
            >
              <PanelRow text={suggestion.primary.content} meta="merge duplicate" />
            </button>
          ))}
        </LedgerPanel>
        <LedgerPanel icon={<Clock size={16} aria-hidden="true" />} title="Timeline" value={`${timelineQuery.data?.items.length ?? 0} events`}>
          {(timelineQuery.data?.items ?? []).slice(0, 3).map((item) => (
            <PanelRow key={`${item.type}-${item.id}`} text={item.title} meta={formatOptionalDate(item.created_at)} />
          ))}
        </LedgerPanel>
      </div>

      {searchResults && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Search Results</h2>
            <button type="button" onClick={() => setSearchResults(null)} className="font-sans text-[11px] uppercase tracking-[0.12em] text-muted hover:text-signal">
              Clear
            </button>
          </div>
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {searchResults.map((result) => (
              <MemoryCard key={result.memory.id} memory={result.memory} score={result.score} />
            ))}
          </div>
        </div>
      )}

      {memoriesQuery.isError && (
        <div className="border-y border-fault/30 bg-fault/5 py-5 font-serif text-base text-fault">
          Set a valid Engram API key in Settings, then refresh this page.
        </div>
      )}

      {memoriesQuery.isLoading ? (
        <div className="border-y border-line py-12 font-serif text-lg text-muted">Loading memories...</div>
      ) : (
        <MemoryTable
          memories={memories}
          onUpdate={(id, payload) => updateMutation.mutate({ id, payload })}
          onDelete={(id) => deleteMutation.mutate(id)}
          onSource={(id) => sourceMutation.mutate(id)}
          isBusy={isBusy}
        />
      )}

      <div className="flex items-center justify-between font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        <span>
          Showing {memories.length} of {total}
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

      {sourceDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line bg-panel p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Source Traceback</p>
                <h2 className="mt-2 font-serif text-3xl font-semibold">{sourceDetails.memory.source}</h2>
              </div>
              <button type="button" onClick={() => setSourceDetails(null)} className="font-sans text-[11px] uppercase tracking-[0.12em] text-muted hover:text-ink">
                Close
              </button>
            </div>
            <dl className="mt-5 grid gap-4 border-y border-line py-4 font-sans text-[11px] uppercase tracking-[0.12em] text-muted sm:grid-cols-2">
              <div>
                <dt>Conversation</dt>
                <dd className="mt-1 break-words text-ink">{sourceDetails.memory.source_conversation_id ?? "manual"}</dd>
              </div>
              <div>
                <dt>Last confirmed</dt>
                <dd className="mt-1 text-ink">{formatOptionalDate(sourceDetails.memory.last_confirmed)}</dd>
              </div>
            </dl>
            <pre className="mt-5 max-h-80 overflow-auto border border-line bg-paper p-4 font-mono text-xs leading-6 text-ink">
              {JSON.stringify(sourceDetails.conversation ?? sourceDetails.memory, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form onSubmit={submitNewMemory} className="w-full max-w-lg rounded-lg border border-line bg-panel p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Manual entry</p>
                <h2 className="mt-2 font-serif text-3xl font-semibold">Add Memory</h2>
              </div>
              <button type="button" onClick={() => setIsAddOpen(false)} className="font-sans text-[11px] uppercase tracking-[0.12em] text-muted hover:text-ink">
                Close
              </button>
            </div>
            <textarea
              value={newMemory}
              onChange={(event) => setNewMemory(event.target.value)}
              className="mt-5 min-h-32 w-full border border-line bg-paper p-3 font-serif text-base leading-7 text-ink outline-none focus:border-signal"
              placeholder="User prefers FastAPI for backend services"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setIsAddOpen(false)} className="border border-line px-4 py-2 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="border border-ink px-4 py-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-ink hover:border-signal hover:text-signal disabled:opacity-50"
              >
                Save Memory
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function LedgerPanel({ icon, title, value, children }: { icon: ReactNode; title: string; value: string; children: ReactNode }) {
  return (
    <section className="border-y border-line py-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          <span className="text-signal">{icon}</span>
          {title}
        </div>
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-ink">{value}</span>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function PanelRow({ text, meta }: { text: string; meta: string }) {
  return (
    <div className="space-y-1">
      <p className="line-clamp-2 font-serif text-base leading-6 text-ink">{text}</p>
      <p className="font-sans text-[10px] uppercase tracking-[0.12em] text-muted">{meta}</p>
    </div>
  );
}

function formatOptionalDate(value: string | null): string {
  if (!value) {
    return "never";
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
