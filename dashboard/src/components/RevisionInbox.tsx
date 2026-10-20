"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { useNamespace } from "@/lib/useNamespace";

export function RevisionInbox() {
  const apiKey = useActiveApiKey();
  const namespace = useNamespace();
  const queryClient = useQueryClient();
  const revisions = useQuery({
    queryKey: ["memories", "revisions", apiKey, namespace],
    queryFn: api.memories.revisions,
    enabled: Boolean(apiKey),
  });
  const resolve = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "reject" }) =>
      api.memories.resolveRevision(id, action),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["memories"] }),
  });
  return (
    <section className="space-y-4 rounded border border-line p-5">
      <h2 className="font-serif text-2xl">Proposed revisions</h2>
      <p className="text-sm text-muted">
        Approved facts stay unchanged until you accept a revision. Concurrent
        edits must be reviewed again.
      </p>
      {revisions.isLoading && <p role="status">Loading revisions...</p>}
      {revisions.error && (
        <p role="alert" className="text-fault">
          {revisions.error.message}
        </p>
      )}
      {resolve.error && (
        <p role="alert" className="text-fault">
          {resolve.error.message}
        </p>
      )}
      {revisions.data?.revisions.length === 0 && (
        <p className="text-sm text-muted">
          No proposed revisions in this project.
        </p>
      )}
      {revisions.data?.revisions.map((revision) => (
        <article
          key={revision.id}
          className="space-y-4 border-t border-line pt-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs uppercase text-muted">Approved</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                {revision.original_content}
              </p>
            </div>
            <div>
              <h3 className="text-xs uppercase text-muted">Proposed</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                {revision.proposed_content}
              </p>
            </div>
          </div>
          <p className="break-all text-xs text-muted">
            Source conversation:{" "}
            {revision.source_conversation_id ?? "Not available"} ·{" "}
            {new Date(revision.created_at).toLocaleString()}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={resolve.isPending}
              onClick={() =>
                resolve.mutate({ id: revision.id, action: "accept" })
              }
              className="min-h-10 rounded border border-line px-4 text-sm disabled:opacity-40"
            >
              Accept revision
            </button>
            <button
              type="button"
              disabled={resolve.isPending}
              onClick={() =>
                resolve.mutate({ id: revision.id, action: "reject" })
              }
              className="min-h-10 px-4 text-sm text-muted disabled:opacity-40"
            >
              Reject revision
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
