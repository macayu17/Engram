"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AsciiScene } from "@/components/site/AsciiScene";
import { api, type Memory, type MemoryRevision, type RevisionDecision } from "@/lib/api";
import { cn } from "@/lib/cn";
import { button, eyebrow } from "@/lib/site-styles";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { useNamespace } from "@/lib/useNamespace";

type Action = { label: string; style: "ink" | "line"; run: () => Promise<unknown>; done: string };

type QueueEntry = {
  key: string;
  kind: "new" | "update" | "conflict";
  id: string;
  createdAt: string;
  source: string | null;
  fact: string;
  previous?: string;
  actions: Action[];
};

const kindLabel = { new: "new fact", update: "proposed update", conflict: "conflict" };

function relativeAge(iso: string, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}

function shortId(id: string) {
  return `mem_${id.replace(/-/g, "").slice(0, 4)}`;
}

function pendingEntry(memory: Memory): QueueEntry {
  return {
    key: `memory:${memory.id}`,
    kind: "new",
    id: memory.id,
    createdAt: memory.created_at,
    source: memory.source || null,
    fact: memory.content,
    actions: [
      { label: "Forget", style: "line", run: () => api.memories.update(memory.id, { status: "rejected" }), done: "Forgotten" },
      { label: "Approve", style: "ink", run: () => api.memories.update(memory.id, { status: "approved" }), done: "Approved. It can be recalled now." },
    ],
  };
}

function revisionEntry(revision: MemoryRevision): QueueEntry {
  const decide = (decision: RevisionDecision) => () => api.memories.resolveRevision(revision.id, decision);
  const actions: Action[] =
    revision.kind === "conflict"
      ? [
          { label: "Keep both", style: "line", run: decide("keep_both"), done: "Kept both facts" },
          { label: "Use new", style: "ink", run: decide("accept"), done: "Revision accepted" },
          { label: "Keep existing", style: "line", run: decide("reject"), done: "Kept the existing fact" },
        ]
      : [
          { label: "Forget", style: "line", run: decide("reject"), done: "Forgotten" },
          { label: "Accept revision", style: "ink", run: decide("accept"), done: "Revision accepted" },
        ];
  return {
    key: `revision:${revision.id}`,
    kind: revision.kind,
    id: revision.memory_id,
    createdAt: revision.created_at,
    source: null,
    fact: revision.proposed_content,
    previous: revision.original_content,
    actions,
  };
}

export function ReviewQueue() {
  const apiKey = useActiveApiKey();
  const namespace = useNamespace();
  const connected = Boolean(apiKey);
  const queryClient = useQueryClient();
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");

  const pending = useQuery({
    queryKey: ["memories", "review", apiKey, namespace],
    queryFn: () => api.memories.review({ limit: 50 }),
    enabled: connected,
  });
  const revisions = useQuery({
    queryKey: ["memories", "revisions", apiKey, namespace],
    queryFn: api.memories.revisions,
    enabled: connected,
  });
  const approved = useQuery({
    queryKey: ["dashboard", "approved", apiKey, namespace],
    queryFn: () => api.memories.list({ limit: 1, status: "approved" }),
    enabled: connected,
  });
  const usage = useQuery({
    queryKey: ["dashboard", "usage", apiKey],
    queryFn: api.users.usage,
    enabled: connected,
  });
  const logs = useQuery({
    queryKey: ["dashboard", "logs", apiKey, namespace],
    queryFn: () => api.logs.list({ limit: 5 }),
    enabled: connected,
  });

  const act = useMutation({
    mutationFn: (action: Action) => action.run(),
    onSuccess: (_result, action) => setToast(action.done),
    onError: (error: Error) => setToast(error.message),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["memories"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const entries = [...(revisions.data?.revisions ?? []).map(revisionEntry), ...(pending.data?.memories ?? []).map(pendingEntry)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const waiting = (pending.data?.total ?? 0) + (revisions.data?.revisions.length ?? 0);
  const oldest = entries.reduce<string | null>((value, entry) => (!value || entry.createdAt < value ? entry.createdAt : value), null);
  const recentLogs = logs.data?.logs ?? [];
  const injectedAverage = recentLogs.length ? recentLogs.reduce((sum, log) => sum + log.injected_count, 0) / recentLogs.length : null;
  const loading = pending.isLoading || revisions.isLoading;
  const error = pending.error ?? revisions.error;

  function run(entry: QueueEntry, action: Action) {
    setLeaving((current) => new Set(current).add(entry.key));
    act.mutate(action, {
      onError: () =>
        setLeaving((current) => {
          const next = new Set(current);
          next.delete(entry.key);
          return next;
        }),
    });
  }

  const tiles = [
    { label: "approved memories", value: approved.data?.total, note: usage.data ? `of ${usage.data.limits.memories.toLocaleString("en")}` : "in this project" },
    { label: "waiting for review", value: connected && !loading ? waiting : undefined, note: oldest ? `oldest ${relativeAge(oldest)}` : "nothing queued" },
    { label: "recalls this month", value: usage.data?.retrievals, note: usage.data ? `of ${usage.data.limits.retrievals.toLocaleString("en")}` : "this workspace" },
    { label: "injected per query", value: injectedAverage == null ? undefined : injectedAverage.toFixed(1), note: `avg · last ${recentLogs.length} retrievals` },
  ];

  return (
    <section className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className={eyebrow}>dashboard · {namespace}</span>
          <h1 className="mt-1.5 font-display text-4xl font-normal leading-[1.1] tracking-[-0.015em]">Review queue</h1>
        </div>
      </header>

      {!connected && (
        <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          Save an API key in{" "}
          <Link href="/settings" className="text-ink underline">
            Settings
          </Link>{" "}
          to see what is waiting for review.
        </div>
      )}

      <dl className="m-0 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-card lg:grid-cols-4">
        {tiles.map((tile, index) => (
          <div
            key={tile.label}
            className={cn("min-w-0 border-line px-[18px] py-4", index % 2 === 0 && "border-r", index < 2 && "border-b lg:border-b-0", index === 1 && "lg:border-r", index === 3 && "border-r-0")}
          >
            <dt className="font-mono text-[11px] text-ink-muted">{tile.label}</dt>
            <dd className="m-0">
              <b className="my-1 block font-display text-[30px] font-normal leading-[1.2] tabular-nums">
                {tile.value == null ? "—" : typeof tile.value === "number" ? tile.value.toLocaleString("en") : tile.value}
              </b>
              <small className="font-mono text-[11px] text-ink-muted">{tile.note}</small>
            </dd>
          </div>
        ))}
      </dl>

      <AsciiScene scene="review" label="Memory cards riding a conveyor through an approve or forget gate." className="max-w-[860px]" />

      <div>
        <h2 className="mb-2.5 font-display text-[30px] font-normal leading-[1.12] tracking-[-0.015em]">Waiting for you</h2>
        {error && (
          <p role="alert" className="text-sm text-forgotten">
            {error.message}
          </p>
        )}
        {loading && connected && (
          <p role="status" className="text-sm text-ink-muted">
            Loading the queue…
          </p>
        )}
        <div className="grid gap-3.5">
          {connected && !loading && !error && entries.length === 0 && (
            <div className="rounded-lg border border-dashed border-line p-[26px] text-center text-sm text-ink-muted">
              Nothing waiting. New facts from conversations will appear here for review.
            </div>
          )}
          {entries.map((entry) => (
            <ReviewItem key={entry.key} entry={entry} gone={leaving.has(entry.key)} disabled={act.isPending} onAction={(action) => run(entry, action)} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2.5 font-display text-[30px] font-normal leading-[1.12] tracking-[-0.015em]">Recent retrievals</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["When", "Query", "Injected", "Top score"].map((heading) => (
                  <th
                    key={heading}
                    className={cn(
                      "border-b border-line px-3.5 py-2.5 text-left font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted",
                      heading === "Top score" && "text-right",
                    )}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3.5 py-4 text-ink-muted">
                    {logs.isLoading ? "Loading…" : "No retrievals yet."}
                  </td>
                </tr>
              )}
              {recentLogs.map((log) => {
                const injected = log.retrieved_memories.slice(0, log.injected_count);
                const top = log.retrieved_memories.reduce((max, memory) => Math.max(max, memory.score), 0);
                return (
                  <tr key={log.id} className="align-top [&>td]:border-b [&>td]:border-line [&>td]:px-3.5 [&>td]:py-2.5 last:[&>td]:border-b-0">
                    <td className="whitespace-nowrap font-mono text-xs text-ink-muted">{relativeAge(log.created_at)}</td>
                    <td>{log.query}</td>
                    <td className={cn(injected.length === 0 && "text-ink-muted")}>
                      {injected.length ? injected.map((memory) => memory.content ?? "forgotten memory").join(" · ") : "nothing above threshold"}
                    </td>
                    <td className="text-right font-mono tabular-nums">{log.retrieved_memories.length ? top.toFixed(2) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-paper transition-all duration-300 motion-reduce:transition-none",
          toast ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        )}
      >
        {toast}
      </div>
    </section>
  );
}

function ReviewItem({ entry, gone, disabled, onAction }: { entry: QueueEntry; gone: boolean; disabled: boolean; onAction: (action: Action) => void }) {
  return (
    <article
      className={cn(
        "grid gap-x-5 gap-y-2 rounded-lg border border-line bg-card px-[18px] py-4 transition-[opacity,transform] duration-300 motion-reduce:transition-none lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start",
        gone && "pointer-events-none translate-x-4 opacity-0",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 font-mono text-[11px] text-ink-muted lg:col-span-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase leading-4 tracking-[0.06em]",
            entry.kind === "update" ? "text-ink shadow-[inset_0_0_0_1px_oklch(var(--color-line))]" : "bg-tint text-hot-ink",
          )}
        >
          {kindLabel[entry.kind]}
        </span>
        <span>
          {shortId(entry.id)} · {relativeAge(entry.createdAt)}
          {entry.source ? ` · via ${entry.source}` : ""}
        </span>
      </div>
      <div className="text-base text-ink">
        {entry.previous && entry.kind === "update" && (
          <>
            <del className="text-ink-muted">{entry.previous}</del>
            <br />
          </>
        )}
        {entry.fact}
        {entry.previous && entry.kind === "conflict" && <span className="text-ink-muted"> vs. existing: {entry.previous}</span>}
      </div>
      <div className="flex flex-wrap gap-2 lg:row-span-2 lg:self-center lg:justify-end">
        {entry.actions.map((action) => (
          <button key={action.label} type="button" disabled={disabled} onClick={() => onAction(action)} className={cn(action.style === "ink" ? button.inkSmall : button.lineSmall, "disabled:cursor-wait disabled:opacity-60")}>
            {action.label}
          </button>
        ))}
      </div>
    </article>
  );
}
