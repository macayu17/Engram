"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { FormEvent, useState } from "react";

import { api, type SearchResponse } from "@/lib/api";
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
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase text-signal">REST memory store</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Memories</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => memoriesQuery.refetch()}
            className="inline-flex items-center gap-2 rounded border border-line px-3 py-2 text-sm text-zinc-300 hover:border-signal/40 hover:text-white"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 rounded border border-signal/40 bg-signal/10 px-3 py-2 text-sm font-medium text-signal hover:bg-signal/15"
          >
            <Plus size={16} aria-hidden="true" />
            Add Memory
          </button>
        </div>
      </div>

      <div className="rounded border border-line bg-panel p-4 shadow-grid">
        <SearchBar onResults={setSearchResults} />
      </div>

      {searchResults && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase text-zinc-400">Search Results</h2>
            <button type="button" onClick={() => setSearchResults(null)} className="text-sm text-zinc-500 hover:text-white">
              Clear
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {searchResults.map((result) => (
              <MemoryCard key={result.memory.id} memory={result.memory} score={result.score} />
            ))}
          </div>
        </div>
      )}

      {memoriesQuery.isError && (
        <div className="rounded border border-fault/40 bg-fault/10 p-4 text-sm text-fault">
          Set a valid Engram API key in Settings, then refresh this page.
        </div>
      )}

      {memoriesQuery.isLoading ? (
        <div className="rounded border border-line bg-panel p-8 text-sm text-zinc-500">Loading memories...</div>
      ) : (
        <MemoryTable
          memories={memories}
          onUpdate={(id, content) => updateMutation.mutate({ id, content })}
          onDelete={(id) => deleteMutation.mutate(id)}
          isBusy={isBusy}
        />
      )}

      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          Showing {memories.length} of {total}
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

      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <form onSubmit={submitNewMemory} className="w-full max-w-lg rounded border border-line bg-panel p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Add Memory</h2>
              </div>
              <button type="button" onClick={() => setIsAddOpen(false)} className="text-zinc-500 hover:text-white">
                Close
              </button>
            </div>
            <textarea
              value={newMemory}
              onChange={(event) => setNewMemory(event.target.value)}
              className="mt-4 min-h-32 w-full rounded border border-line bg-ink p-3 text-sm text-zinc-100 outline-none focus:border-signal"
              placeholder="User prefers FastAPI for backend services"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setIsAddOpen(false)} className="rounded border border-line px-4 py-2 text-sm text-zinc-300">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded border border-signal/40 bg-signal/10 px-4 py-2 text-sm font-medium text-signal disabled:opacity-50"
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
