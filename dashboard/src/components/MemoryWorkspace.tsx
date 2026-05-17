"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { FormEvent, useState } from "react";

import { api, type SearchResponse } from "@/lib/api";
import { MemoryConstellation } from "./MemoryConstellation";
import { MemoryCard } from "./MemoryCard";
import { MemoryTable } from "./MemoryTable";
import { SearchBar } from "./SearchBar";


const PAGE_SIZE = 20;

export function MemoryWorkspace() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResponse["results"] | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newMemory, setNewMemory] = useState("");
  const memoriesQuery = useQuery({
    queryKey: ["memories", page],
    queryFn: () => api.memories.list({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
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
    mutationFn: ({ id, content }: { id: string; content: string }) => api.memories.update(id, content),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["memories"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.memories.delete(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["memories"] }),
  });

  function submitNewMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newMemory.trim();
    if (trimmed) {
      createMutation.mutate(trimmed);
    }
  }

  const memories = memoriesQuery.data?.memories ?? [];
  const total = memoriesQuery.data?.total ?? 0;
  const hasNextPage = (page + 1) * PAGE_SIZE < total;
  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <section className="space-y-16">
      <div className="relative -mx-4 -mt-10 min-h-[30rem] overflow-hidden border-b border-line px-4 py-16 sm:-mx-6 sm:px-6 md:-mt-16 md:min-h-[34rem] md:py-20">
        <MemoryConstellation />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">The Engram memory ledger · Vol. 01</p>
          <h1 className="mt-6 font-serif text-5xl font-bold leading-tight text-ink md:text-7xl">
            Every durable <span className="italic text-signal">memory.</span>
            <br />
            Inspectable.
          </h1>
          <p className="mx-auto mt-6 max-w-xl font-serif text-lg leading-8 text-muted">
            A quiet archive of the facts Engram has learned, the searches that surfaced them, and the user key that owns them.
          </p>
          <div className="mt-8 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
            {total} memories · pgvector retrieval · async extraction
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ I — The ledger</p>
            <h2 className="mt-2 font-serif text-4xl font-semibold text-ink">Browse the memory store</h2>
          </div>
          <div className="flex gap-3">
          <button
            type="button"
            onClick={() => memoriesQuery.refetch()}
            className="inline-flex items-center gap-2 border border-line px-4 py-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:border-signal hover:text-signal"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 border border-ink px-4 py-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-ink hover:border-signal hover:text-signal"
          >
            <Plus size={16} aria-hidden="true" />
            Add Memory
          </button>
          </div>
        </div>

        <SearchBar onResults={setSearchResults} />
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
          onUpdate={(id, content) => updateMutation.mutate({ id, content })}
          onDelete={(id) => deleteMutation.mutate(id)}
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
