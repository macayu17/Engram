"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
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
      <div className="memory-hero-frame relative -mx-4 -mt-10 min-h-[35rem] overflow-hidden border-b border-line px-4 py-16 sm:-mx-6 sm:px-6 md:-mt-16 md:min-h-[38rem] md:py-20">
        <MemoryConstellation />
        <div className="memory-hero-orbit" aria-hidden="true">
          <div className="memory-hero-orbit__halo" />
          <div className="memory-hero-orbit__halo memory-hero-orbit__halo--inner" />
          <div className="memory-hero-orbit__cross memory-hero-orbit__cross--x" />
          <div className="memory-hero-orbit__cross memory-hero-orbit__cross--y" />
          <div className="memory-hero-orbit__beacon" />
          <div className="memory-hero-orbit__needle memory-hero-orbit__needle--one" />
          <div className="memory-hero-orbit__needle memory-hero-orbit__needle--two" />
          <div className="memory-hero-orbit__needle memory-hero-orbit__needle--three" />
          <div className="memory-hero-orbit__chip memory-hero-orbit__chip--one">
            <span>fact</span>
            <strong>0.84</strong>
          </div>
          <div className="memory-hero-orbit__chip memory-hero-orbit__chip--two">
            <span>rank</span>
            <strong>pgv</strong>
          </div>
          <div className="memory-hero-orbit__chip memory-hero-orbit__chip--three">
            <span>inject</span>
            <strong>ctx</strong>
          </div>
          <div className="memory-hero-orbit__rail">
            <span>embed</span>
            <span>search</span>
            <span>merge</span>
          </div>
        </div>
        <div className="relative z-10 mx-auto flex max-w-7xl items-center">
          <div className="w-full min-w-0 max-w-3xl">
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">The Engram memory ledger · Vol. 01</p>
            <h1 className="mt-6 max-w-full font-serif text-[2.8rem] font-bold leading-tight text-ink sm:text-5xl md:text-7xl">
              Every durable <span className="italic text-signal">memory.</span>
              <br />
              Inspectable.
            </h1>
            <p className="mt-6 max-w-[20rem] font-serif text-lg leading-8 text-muted sm:max-w-[min(36rem,100%)]">
              Watch user facts move from conversation to vector retrieval, then inspect exactly what Engram injected.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="group inline-flex items-center gap-3 rounded-full bg-signal px-4 py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-paper shadow-[0_18px_44px_rgb(var(--color-signal)_/_0.22)] transition hover:-translate-y-0.5 hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal active:translate-y-0"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/12 text-paper transition group-hover:bg-signal">
                  <Plus size={15} aria-hidden="true" />
                </span>
                Add Memory
              </button>
              <Link
                href="/chat"
                className="group inline-flex items-center gap-3 py-2.5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-tag/35 text-muted transition group-hover:border-signal group-hover:bg-signal/10 group-hover:text-signal">
                  <MessageSquare size={15} aria-hidden="true" />
                </span>
                <span className="border-b border-line pb-1 transition group-hover:border-signal">Test Chat</span>
              </Link>
            </div>
            <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-3 border-y border-line py-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted sm:grid-cols-3 sm:gap-0">
              <span>{total} memories</span>
              <span>pgvector</span>
              <span>async extract</span>
            </div>
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
