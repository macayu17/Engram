"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { type RetrievalLog } from "@/lib/api";
import { ScoreBadge } from "./ScoreBadge";


export function LogEntry({ log }: { log: RetrievalLog }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="grid w-full min-w-0 gap-3 px-3 py-5 text-left text-sm transition hover:bg-tag md:grid-cols-[150px_minmax(0,1fr)_120px_210px]"
      >
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-muted">{formatDate(log.created_at)}</span>
        <span className="min-w-0 break-words font-sans text-[15px] leading-6 text-ink md:line-clamp-2">{log.query || "Empty retrieval query"}</span>
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-muted">{log.retrieved_memories.length} memories</span>
        <span className="flex items-center justify-between gap-2 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">
          <span className="truncate">{log.conversation_id ?? "no conversation"}</span>
          {isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-line bg-tag/30 px-4 py-4">
          {log.retrieved_memories.length ? (
            <div className="space-y-0">
              {log.retrieved_memories.map((memory) => (
                <div key={memory.memory_id} className="grid gap-3 border-b border-line py-4 text-sm last:border-b-0 md:grid-cols-[1fr_80px]">
                  <div>
                    <p className="font-sans text-[15px] leading-7 text-ink">{memory.content ?? "Deleted memory"}</p>
                    <p className="mt-2 break-all font-mono text-[10px] text-muted">{memory.memory_id}</p>
                  </div>
                  <div className="md:text-right">
                    <ScoreBadge score={memory.score} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-sans text-sm text-muted">No memories crossed the retrieval threshold.</p>
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
