"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, PenLine } from "lucide-react";

import { api, type MemoryRevision, type RevisionDecision } from "@/lib/api";
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
    mutationFn: ({ id, decision }: { id: string; decision: RevisionDecision }) =>
      api.memories.resolveRevision(id, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["memories"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const items = revisions.data?.revisions ?? [];
  if (!revisions.isLoading && !revisions.error && items.length === 0) {
    return null;
  }
  return (
    <section className="border-y border-line">
      <div className="flex flex-col gap-2 border-b border-line py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-sans text-xs font-medium text-muted">Review queue</p>
          <h2 className="mt-2 text-3xl font-normal text-ink">Proposed changes</h2>
        </div>
        <span className="font-sans text-xs text-muted">{items.length} open</span>
      </div>
      {revisions.isLoading && (
        <p role="status" className="py-6 text-base text-muted">
          Loading proposed changes...
        </p>
      )}
      {revisions.error && (
        <p role="alert" className="py-6 text-base text-fault">
          {revisions.error.message}
        </p>
      )}
      {resolve.error && (
        <p role="alert" className="py-4 text-base text-fault">
          {resolve.error.message}
        </p>
      )}
      {items.map((revision) => (
        <RevisionCard
          key={revision.id}
          revision={revision}
          disabled={resolve.isPending}
          onDecide={(decision) => resolve.mutate({ id: revision.id, decision })}
        />
      ))}
    </section>
  );
}

function RevisionCard({
  revision,
  disabled,
  onDecide,
}: {
  revision: MemoryRevision;
  disabled: boolean;
  onDecide: (decision: RevisionDecision) => void;
}) {
  const isConflict = revision.kind === "conflict";
  return (
    <article className="border-b border-line py-6 last:border-b-0">
      <div
        className={`flex items-center gap-2 font-sans text-xs font-medium ${isConflict ? "text-fault" : "text-signal"}`}
      >
        {isConflict ? (
          <AlertTriangle size={15} aria-hidden="true" />
        ) : (
          <PenLine size={15} aria-hidden="true" />
        )}
        {isConflict ? "Contradiction detected" : "Update proposed"}
      </div>
      <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
        <Claim label="Current memory" content={revision.original_content} />
        <Claim label="Proposed memory" content={revision.proposed_content} accent />
      </div>
      <p className="mt-3 font-sans text-xs text-muted">
        {new Date(revision.created_at).toLocaleString()}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <DecisionButton label="Use new" disabled={disabled} onClick={() => onDecide("accept")} primary />
        <DecisionButton label="Keep current" disabled={disabled} onClick={() => onDecide("reject")} />
        {isConflict && (
          <DecisionButton label="Keep both" disabled={disabled} onClick={() => onDecide("keep_both")} />
        )}
      </div>
    </article>
  );
}

function Claim({ label, content, accent = false }: { label: string; content: string; accent?: boolean }) {
  return (
    <div className="bg-panel p-4">
      <p className={`font-sans text-xs font-medium ${accent ? "text-signal" : "text-muted"}`}>{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-base leading-6 text-ink">{content}</p>
    </div>
  );
}

function DecisionButton({
  label,
  disabled,
  onClick,
  primary = false,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-9 rounded-sm border px-4 font-sans text-xs font-semibold transition active:translate-y-px disabled:cursor-wait disabled:opacity-50 ${
        primary
          ? "border-signal bg-signal text-paper hover:border-ink hover:bg-ink"
          : "border-line text-muted hover:border-signal hover:text-signal"
      }`}
    >
      {label}
    </button>
  );
}
