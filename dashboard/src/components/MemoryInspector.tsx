"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { api } from "@/lib/api";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { useNamespace } from "@/lib/useNamespace";

export function MemoryInspector({
  memoryId,
  onClose,
}: {
  memoryId: string;
  onClose: () => void;
}) {
  const apiKey = useActiveApiKey();
  const namespace = useNamespace();
  const queryClient = useQueryClient();
  const [expiration, setExpiration] = useState<string | null>(null);
  const [destination, setDestination] = useState(namespace);
  const history = useQuery({
    queryKey: ["memories", "history", apiKey, namespace, memoryId],
    queryFn: () => api.memories.history(memoryId),
  });
  const source = useQuery({
    queryKey: ["memories", "source", apiKey, namespace, memoryId],
    queryFn: () => api.memories.source(memoryId),
  });
  const restore = useMutation({
    mutationFn: (versionId: string) =>
      api.memories.restore(memoryId, versionId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["memories"] }),
  });
  const update = useMutation({
    mutationFn: () =>
      api.memories.update(memoryId, {
        namespace: destination.trim(),
        expires_at:
          expiration === null
            ? (source.data?.memory.expires_at ?? null)
            : expiration
              ? new Date(expiration).toISOString()
              : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["memories"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (destination.trim() !== namespace) onClose();
    },
  });
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate();
  }
  return (
    <section
      aria-label="Memory history and expiration"
      className="space-y-5 rounded border border-line bg-panel p-5"
    >
      <div className="flex justify-between gap-4">
        <h2 className="font-serif text-2xl">Memory history and expiration</h2>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 px-3 text-sm text-muted"
        >
          Close
        </button>
      </div>
      {[history.error, source.error, restore.error, update.error]
        .filter(Boolean)
        .map((error, index) => (
          <p key={index} role="alert" className="text-sm text-fault">
            {error?.message}
          </p>
        ))}
      <p className="text-sm text-muted">
        Current expiry:{" "}
        {source.data?.memory.expires_at
          ? new Date(source.data.memory.expires_at).toLocaleString()
          : "Never"}
        . Restoring a version creates another history entry.
      </p>
      <form onSubmit={save} className="flex flex-wrap items-end gap-4">
        <label className="space-y-2 text-sm">
          <span className="block text-muted">Project</span>
          <input
            required
            pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}"
            maxLength={80}
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            className="min-h-10 rounded border border-line bg-paper px-3"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="block text-muted">
            New expiration (blank means never)
          </span>
          <input
            type="datetime-local"
            min={toLocalInput(new Date().toISOString())}
            value={expiration ?? toLocalInput(source.data?.memory.expires_at)}
            onChange={(event) => setExpiration(event.target.value)}
            className="min-h-10 rounded border border-line bg-paper px-3"
          />
        </label>
        <button
          disabled={update.isPending}
          className="min-h-10 rounded border border-line px-4 text-sm disabled:opacity-40"
        >
          Save project and expiration
        </button>
      </form>
      {update.isSuccess && (
        <p role="status" className="text-sm text-signal">
          Memory settings saved.
        </p>
      )}
      {history.isLoading && <p role="status">Loading history...</p>}
      {history.data?.versions.length === 0 && (
        <p className="text-sm text-muted">No earlier versions.</p>
      )}
      {history.data?.versions.map((version) => (
        <article
          key={version.id}
          className="space-y-2 border-t border-line pt-4"
        >
          <p className="text-xs text-muted">
            {new Date(version.created_at).toLocaleString()} · {version.reason} ·{" "}
            {version.namespace}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-7">
            {version.content}
          </p>
          <button
            type="button"
            disabled={restore.isPending}
            onClick={() => restore.mutate(version.id)}
            className="min-h-10 rounded border border-line px-4 text-sm disabled:opacity-40"
          >
            Restore this version
          </button>
        </article>
      ))}
    </section>
  );
}

function toLocalInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
