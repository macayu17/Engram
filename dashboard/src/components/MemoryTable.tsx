"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import { type Memory } from "@/lib/api";


type MemoryTableProps = {
  memories: Memory[];
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  isBusy: boolean;
};

export function MemoryTable({ memories, onUpdate, onDelete, isBusy }: MemoryTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

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

  if (!memories.length) {
    return (
      <div className="rounded border border-line bg-panel p-8 text-center text-sm text-zinc-500">
        No memories found for this API key.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-line bg-panel shadow-grid">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-ink/70 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">Memory</th>
            <th className="px-4 py-3 font-medium">Confidence</th>
            <th className="px-4 py-3 font-medium">Access</th>
            <th className="px-4 py-3 font-medium">Last Accessed</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {memories.map((memory) => (
            <tr key={memory.id} className="align-top">
              <td className="max-w-xl px-4 py-3">
                {editingId === memory.id ? (
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="min-h-24 w-full rounded border border-line bg-ink p-3 text-sm text-zinc-100 outline-none focus:border-signal"
                  />
                ) : (
                  <p className="leading-6 text-zinc-100">{memory.content}</p>
                )}
                <p className="mt-2 font-mono text-xs text-zinc-600">{memory.id}</p>
              </td>
              <td className="px-4 py-3 font-mono text-zinc-300">{memory.confidence.toFixed(2)}</td>
              <td className="px-4 py-3 font-mono text-zinc-300">{memory.access_count}</td>
              <td className="px-4 py-3 text-zinc-400">{formatOptionalDate(memory.last_accessed)}</td>
              <td className="px-4 py-3 text-zinc-400">{formatOptionalDate(memory.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {editingId === memory.id ? (
                    <>
                      <button
                        type="button"
                        title="Save memory"
                        onClick={() => saveEditing(memory.id)}
                        disabled={isBusy}
                        className="rounded border border-signal/40 p-2 text-signal hover:bg-signal/10 disabled:opacity-50"
                      >
                        <Check size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title="Cancel edit"
                        onClick={() => setEditingId(null)}
                        className="rounded border border-line p-2 text-zinc-400 hover:text-white"
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
                        className="rounded border border-line p-2 text-zinc-400 hover:border-signal/40 hover:text-signal"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title="Delete memory"
                        onClick={() => confirmDelete(memory.id)}
                        disabled={isBusy}
                        className="rounded border border-line p-2 text-zinc-400 hover:border-fault/40 hover:text-fault disabled:opacity-50"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
