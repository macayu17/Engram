"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { type RetrievalLog } from "@/lib/api";
import { ScoreBadge } from "./ScoreBadge";


export function LogEntry({ log }: { log: RetrievalLog }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="rounded border border-line bg-panel shadow-grid">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="grid w-full gap-3 px-4 py-3 text-left text-sm hover:bg-ink/60 md:grid-cols-[160px_1fr_130px_220px]"
      >
        <span className="font-mono text-xs text-zinc-500">{formatDate(log.created_at)}</span>
        <span className="truncate text-zinc-100">{log.query}</span>
        <span className="font-mono text-xs text-zinc-400">{log.retrieved_memories.length} memories</span>
        <span className="flex items-center justify-between gap-2 font-mono text-xs text-zinc-600">
          <span className="truncate">{log.conversation_id ?? "no conversation"}</span>
          {isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-line p-4">
          {log.retrieved_memories.length ? (
            <div className="space-y-3">
              {log.retrieved_memories.map((memory) => (
                <div key={memory.memory_id} className="grid gap-3 rounded border border-line bg-ink p-3 text-sm md:grid-cols-[1fr_80px]">
                  <div>
                    <p className="text-zinc-100">{memory.content ?? "Deleted memory"}</p>
                    <p className="mt-2 font-mono text-xs text-zinc-600">{memory.memory_id}</p>
                  </div>
                  <div className="md:text-right">
                    <ScoreBadge score={memory.score} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No memories crossed the retrieval threshold.</p>
          )}
        </div>
      )}
    </div>
  );
}


function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}
