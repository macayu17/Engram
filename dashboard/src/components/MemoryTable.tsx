"use client";

import { Check, ChevronDown, ChevronUp, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import { type Memory } from "@/lib/api";
import { cn } from "@/lib/cn";


type MemoryTableProps = {
  memories: Memory[];
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  isBusy: boolean;
};

export function MemoryTable({ memories, onUpdate, onDelete, isBusy }: MemoryTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function startEditing(memory: Memory) {
    setEditingId(memory.id);
    setDraft(memory.content);
  }

  function saveEditing(id: string) {
    const trimmed = draft.trim();
    if (trimmed) {
      onUpdate(id, trimmed);
      setEditingId(null);
      setDraft("");
    }
  }

  function confirmDelete(id: string) {
    if (window.confirm("Delete this memory permanently?")) {
      onDelete(id);
    }
  }

  function toggleExpanded(id: string) {
    setExpandedIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(id)) {
        nextIds.delete(id);
      } else {
        nextIds.add(id);
      }
      return nextIds;
    });
  }

  if (!memories.length) {
    return (
      <div className="border-y border-line py-12 text-center font-serif text-lg text-muted">
        No memories found for this API key.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-y border-line">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="text-left font-sans text-[11px] uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="py-4 pr-4 font-medium">Memory</th>
            <th className="px-4 py-4 font-medium">Confidence</th>
            <th className="px-4 py-4 font-medium">Access</th>
            <th className="px-4 py-4 font-medium">Last Accessed</th>
            <th className="px-4 py-4 font-medium">Created</th>
            <th className="py-4 pl-4 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {memories.map((memory) => {
            const isExpanded = expandedIds.has(memory.id);
            const canExpand = isLongMemory(memory.content);
            return (
              <tr key={memory.id} className="align-top">
                <td className="max-w-xl py-5 pr-4">
                  {editingId === memory.id ? (
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      className="min-h-24 w-full border border-line bg-paper p-3 font-serif text-base text-ink outline-none focus:border-signal"
                    />
                  ) : (
                    <div className="space-y-3">
                      <p
                        className={cn(
                          "break-words whitespace-pre-wrap font-serif text-lg leading-8 text-ink",
                          canExpand && !isExpanded && "max-h-32 overflow-hidden",
                        )}
                      >
                        {memory.content}
                      </p>
                      {canExpand && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(memory.id)}
                          className="inline-flex items-center gap-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:text-signal"
                        >
                          {isExpanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                          {isExpanded ? "Show less" : "Show full memory"}
                        </button>
                      )}
                    </div>
                  )}
                  <p className="mt-2 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">{memory.id}</p>
                </td>
                <td className="px-4 py-5 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">{memory.confidence.toFixed(2)}</td>
                <td className="px-4 py-5 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">{memory.access_count}</td>
                <td className="px-4 py-5 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">{formatOptionalDate(memory.last_accessed)}</td>
                <td className="px-4 py-5 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">{formatOptionalDate(memory.created_at)}</td>
                <td className="py-5 pl-4">
                  <div className="flex justify-end gap-2">
                    {editingId === memory.id ? (
                      <>
                        <button
                          type="button"
                          title="Save memory"
                          onClick={() => saveEditing(memory.id)}
                          disabled={isBusy}
                          className="rounded bg-tag p-2 text-signal hover:text-ink disabled:opacity-50"
                        >
                          <Check size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title="Cancel edit"
                          onClick={() => setEditingId(null)}
                          className="rounded bg-tag p-2 text-muted hover:text-ink"
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          title="Edit memory"
                          onClick={() => startEditing(memory)}
                          className="rounded bg-tag p-2 text-muted hover:text-signal"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title="Delete memory"
                          onClick={() => confirmDelete(memory.id)}
                          disabled={isBusy}
                          className="rounded bg-tag p-2 text-muted hover:text-fault disabled:opacity-50"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function isLongMemory(content: string): boolean {
  return content.length > 280 || content.includes("\n");
}


function formatOptionalDate(value: string | null): string {
  if (!value) {
    return "never";
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}
