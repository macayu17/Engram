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
        className="grid w-full gap-3 py-5 text-left text-sm hover:bg-tag md:grid-cols-[160px_1fr_130px_220px]"
      >
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-muted">{formatDate(log.created_at)}</span>
        <span className="truncate font-serif text-lg text-ink">{log.query}</span>
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-muted">{log.retrieved_memories.length} memories</span>
        <span className="flex items-center justify-between gap-2 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">
          <span className="truncate">{log.conversation_id ?? "no conversation"}</span>
          {isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-line py-4">
          {log.retrieved_memories.length ? (
            <div className="space-y-0">
              {log.retrieved_memories.map((memory) => (
                <div key={memory.memory_id} className="grid gap-3 border-b border-line py-4 text-sm last:border-b-0 md:grid-cols-[1fr_80px]">
                  <div>
                    <p className="font-serif text-lg leading-8 text-ink">{memory.content ?? "Deleted memory"}</p>
                    <p className="mt-2 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">{memory.memory_id}</p>
                  </div>
                  <div className="md:text-right">
                    <ScoreBadge score={memory.score} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-serif text-base text-muted">No memories crossed the retrieval threshold.</p>
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
