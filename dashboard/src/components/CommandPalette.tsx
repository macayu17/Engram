"use client";

import { Search, X } from "lucide-react";
import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { api, type SearchResponse } from "@/lib/api";
import { cn } from "@/lib/cn";

type PaletteState = {
  results: SearchResponse["results"];
  error: string;
};

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [state, setState] = useState<PaletteState>({ results: [], error: "" });
  const inputRef = useRef<HTMLInputElement>(null);
  const resultCount = state.results.length;

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const previewRows = useMemo(
    () =>
      state.results.map((result) => ({
        id: result.memory.id,
        title: result.memory.content,
        meta: `${result.score.toFixed(2)} similarity`,
      })),
    [state.results],
  );

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setState({ results: [], error: "" });
      return;
    }
    setIsSearching(true);
    setState({ results: [], error: "" });
    try {
      const response = await api.memories.search(trimmedQuery, 6, 0);
      setState({ results: response.results, error: "" });
      setActiveIndex(0);
    } catch (error) {
      setState({ results: [], error: error instanceof Error ? error.message : "Search failed" });
    } finally {
      setIsSearching(false);
    }
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!resultCount) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((value) => (value + 1) % resultCount);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((value) => (value - 1 + resultCount) % resultCount);
    }
    if (event.key === "Enter" && state.results[activeIndex]) {
      setIsOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex min-h-10 w-full max-w-md items-center justify-between rounded-full border border-line bg-paper px-4 text-left text-sm text-muted transition hover:border-ink"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Search size={15} aria-hidden="true" />
          <span className="truncate">Search memories and retrieval context</span>
        </span>
        <span className="rounded border border-line px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em] text-muted">Ctrl K</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-20">
          <div className="w-full max-w-xl rounded-lg border border-line bg-white text-ink">
            <form onSubmit={submitSearch} className="flex min-h-16 items-center gap-3 border-b border-line px-4">
              <Search size={18} aria-hidden="true" className="text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleInputKeyDown}
                className="min-w-0 flex-1 bg-transparent font-serif text-lg outline-none placeholder:text-muted"
                placeholder="Search memories, users, projects..."
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
                className="rounded-full border border-line p-2 text-muted hover:text-ink"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </form>
            <div className="max-h-[22rem] overflow-y-auto p-3">
              <p className="px-2 py-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Memories</p>
              {isSearching && <p className="px-2 py-4 text-sm text-muted">Searching...</p>}
              {state.error && <p className="px-2 py-4 text-sm text-fault">{state.error}</p>}
              {!isSearching && !state.error && !previewRows.length && <p className="px-2 py-4 text-sm text-muted">No results yet.</p>}
              {previewRows.map((result, index) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "grid w-full grid-cols-[2.5rem_1fr] gap-3 border-t border-line px-2 py-3 text-left",
                    activeIndex === index && "bg-tag",
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded bg-tag font-serif text-sm font-semibold text-ink">ME</span>
                  <span className="min-w-0">
                    <span className="block truncate font-serif text-base">{result.title}</span>
                    <span className="mt-1 block font-sans text-[11px] uppercase tracking-[0.12em] text-muted">{result.meta}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
