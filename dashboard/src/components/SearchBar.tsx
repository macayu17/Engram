"use client";

import { Search } from "lucide-react";
import { FormEvent, useState } from "react";

import { api, readActiveNamespace, type SearchResponse } from "@/lib/api";

export function SearchBar({
  onResults,
}: {
  onResults: (results: SearchResponse["results"] | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [includePersonal, setIncludePersonal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      onResults(null);
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      const response = await api.memories.search(
        trimmed,
        8,
        0.5,
        readActiveNamespace(),
        includePersonal,
      );
      onResults(response.results);
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Search failed",
      );
      onResults(null);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <label className="flex min-h-12 flex-1 items-center gap-3 rounded-lg border border-line bg-panel px-4 text-sm text-ink transition focus-within:border-signal focus-within:ring-1 focus-within:ring-signal/30">
        <Search size={16} aria-hidden="true" className="text-muted" />
        <input
          aria-label="Search project memories"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search memories semantically"
          className="min-w-0 flex-1 bg-transparent font-sans text-sm outline-none placeholder:text-muted"
        />
      </label>
      <button
        type="submit"
        className="inline-flex min-h-12 items-center justify-center rounded-lg border border-ink px-5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-ink transition hover:border-signal hover:bg-signal hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSearching}
      >
        {isSearching ? "Searching" : "Search"}
      </button>
      <label className="flex min-h-10 items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={includePersonal}
          onChange={(event) => setIncludePersonal(event.target.checked)}
        />
        Include personal memories
      </label>
      {error && <p className="text-sm text-fault sm:self-center">{error}</p>}
    </form>
  );
}
