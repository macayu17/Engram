"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { api } from "@/lib/api";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { RetrievalTrace } from "./RetrievalTrace";

const TYPE_COLORS: Record<string, string> = {
  person: "#fb7185",
  project: "#a78bfa",
  skill: "#34d399",
  technology: "#60a5fa",
  preference: "#fbbf24",
  topic: "#f472b6",
  organization: "#22d3ee",
};

const QUICK_LINKS = [
  { href: "/memories", title: "Ledger", description: "Browse, search, edit, and approve memories." },
  { href: "/chat", title: "Chat", description: "Talk to a model with your memories in context." },
  { href: "/graph", title: "Graph", description: "Entities woven across your memories." },
  { href: "/logs", title: "Logs", description: "Every retrieval, what it returned, and why." },
];

export function HomeDashboard() {
  const apiKey = useActiveApiKey();
  const connected = apiKey.startsWith("ek_");
  const approvedQuery = useQuery({
    queryKey: ["dashboard", "approved-count"],
    queryFn: () => api.memories.list({ limit: 1, offset: 0, status: "approved" }),
    enabled: connected,
  });
  const pendingQuery = useQuery({
    queryKey: ["dashboard", "pending-count"],
    queryFn: () => api.memories.list({ limit: 1, offset: 0, status: "pending" }),
    enabled: connected,
  });
  const timelineQuery = useQuery({
    queryKey: ["dashboard", "timeline"],
    queryFn: () => api.memories.timeline(8),
    enabled: connected,
  });
  const entitiesQuery = useQuery({
    queryKey: ["dashboard", "entities"],
    queryFn: () => api.graph.listEntities(),
    enabled: connected,
  });
  const logsQuery = useQuery({
    queryKey: ["dashboard", "logs"],
    queryFn: () => api.logs.list({ limit: 5, offset: 0 }),
    enabled: connected,
  });

  const totalApproved = approvedQuery.data?.total ?? 0;
  const totalPending = pendingQuery.data?.total ?? 0;
  const totalEntities = entitiesQuery.data?.entities.length ?? 0;
  const totalRetrievals = logsQuery.data?.total ?? 0;

  const topEntities = useMemo(() => {
    const all = entitiesQuery.data?.entities ?? [];
    return [...all].sort((a, b) => b.memory_count - a.memory_count).slice(0, 10);
  }, [entitiesQuery.data]);

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      <section className="memory-hero-frame -mx-4 -mt-10 border-b border-line px-4 pt-10 sm:-mx-6 sm:px-6 md:-mt-16 md:pt-14">
        <div className="mx-auto grid min-h-[26rem] min-w-0 max-w-7xl gap-10 pb-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)] lg:items-center lg:gap-16 lg:pb-12">
          <div className="min-w-0 max-w-xl">
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-signal">Memory infrastructure you can audit</p>
            <h1 className="mt-5 font-serif text-[2.7rem] font-bold leading-[1.02] text-ink sm:text-5xl lg:text-6xl">
              Memory that
              <br />
              <span className="italic text-signal">explains itself.</span>
            </h1>
            <p className="mt-5 max-w-[36rem] font-serif text-lg leading-8 text-muted">
              Retrieve durable user context, inspect every match, and control exactly what reaches the model.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href={connected ? "/memories" : "/settings"}
                className="group inline-flex min-h-11 items-center gap-2.5 rounded-md bg-signal px-4 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-paper transition hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal active:translate-y-px"
              >
                <Plus size={15} aria-hidden="true" />
                {connected ? "Add memory" : "Connect Engram"}
              </Link>
              <Link
                href="/chat"
                className="inline-flex min-h-11 items-center gap-2.5 border-b border-line px-1 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted transition hover:border-signal hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                <MessageSquare size={15} aria-hidden="true" />
                Test chat
              </Link>
            </div>
          </div>
          <RetrievalTrace />
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-2 border-t border-line sm:grid-cols-4">
          <StatTile label="Approved memories" value={totalApproved} loading={connected && approvedQuery.isLoading} href="/memories" />
          <StatTile label="Pending review" value={totalPending} loading={connected && pendingQuery.isLoading} accent={totalPending > 0} href="/memories" />
          <StatTile label="Entities" value={totalEntities} loading={connected && entitiesQuery.isLoading} href="/graph" />
          <StatTile label="Retrievals logged" value={totalRetrievals} loading={connected && logsQuery.isLoading} href="/logs" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ I — Recent activity</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-ink">Timeline</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {connected && timelineQuery.isLoading && (
              <li className="py-4 font-serif text-base text-muted">Loading…</li>
            )}
            {!timelineQuery.isLoading && (timelineQuery.data?.items.length ?? 0) === 0 && (
              <li className="py-5 font-serif text-base text-muted">{connected ? <>No activity yet. Have a conversation in <Link className="underline" href="/chat">Chat</Link> to start.</> : <>Connect an API key in <Link className="underline" href="/settings">Settings</Link> to load workspace activity.</>}</li>
            )}
            {timelineQuery.data?.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                    {item.type}
                    {item.category ? ` · ${item.category}` : ""}
                  </p>
                  <p className="mt-1 font-serif text-base leading-7 text-ink/85">{item.title}</p>
                </div>
                <time className="shrink-0 font-sans text-[10px] uppercase tracking-[0.12em] text-muted">
                  {formatRelative(item.created_at)}
                </time>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ II — Most connected</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-ink">Top entities</h2>
          <ul className="mt-4 space-y-2">
            {connected && entitiesQuery.isLoading && (
              <li className="font-serif text-base text-muted">Loading…</li>
            )}
            {!entitiesQuery.isLoading && topEntities.length === 0 && (
              <li className="font-serif text-base leading-7 text-muted">
                {connected ? <>No entities yet. Open the <Link className="underline" href="/graph">Graph</Link> and click <em>Backfill entities</em>.</> : "Entity counts appear after the dashboard is connected."}
              </li>
            )}
            {topEntities.map((entity) => (
              <li key={entity.id} className="flex items-center justify-between gap-3 border-b border-line/70 pb-2">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: TYPE_COLORS[entity.entity_type] ?? "#94a3b8" }}
                    aria-hidden
                  />
                  <Link href="/graph" className="font-serif text-base text-ink hover:text-signal">
                    {entity.name}
                  </Link>
                  <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-muted">{entity.entity_type}</span>
                </div>
                <span className="font-sans text-[11px] tabular-nums text-muted">{entity.memory_count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ III — Latest retrievals</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-ink">What your assistant just looked up</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {connected && logsQuery.isLoading && <li className="py-4 font-serif text-base text-muted">Loading…</li>}
          {!logsQuery.isLoading && (logsQuery.data?.logs.length ?? 0) === 0 && (
            <li className="py-4 font-serif text-base text-muted">
              {connected ? "No retrievals yet. They appear here as soon as your assistant queries memories." : "Retrieval traces appear after the dashboard is connected."}
            </li>
          )}
          {logsQuery.data?.logs.slice(0, 5).map((log) => (
            <li key={log.id} className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="font-serif text-base leading-7 text-ink/90 line-clamp-2">{log.query || "(empty query)"}</p>
                <p className="mt-1 font-sans text-[10px] uppercase tracking-[0.12em] text-muted">
                  Surfaced {log.retrieved_memories.length} memor{log.retrieved_memories.length === 1 ? "y" : "ies"}
                </p>
              </div>
              <Link
                href="/logs"
                className="shrink-0 font-sans text-[10px] uppercase tracking-[0.12em] text-muted hover:text-signal"
              >
                {formatRelative(log.created_at)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ IV — Go anywhere</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group block rounded-lg border border-line bg-paper p-5 transition hover:border-signal hover:bg-paper/80"
            >
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted group-hover:text-signal">
                {link.title}
              </p>
              <p className="mt-2 font-serif text-base leading-6 text-ink/85">{link.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  loading,
  accent,
  href,
}: {
  label: string;
  value: number;
  loading: boolean;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={`min-h-20 border-b border-line px-3 py-4 transition sm:border-b-0 sm:border-r sm:px-5 ${accent ? "bg-signal/5" : "hover:bg-tag/20"}`}
    >
      <p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`mt-1 font-serif text-2xl font-semibold tabular-nums ${accent ? "text-signal" : "text-ink"}`}>
        {loading ? "—" : value.toLocaleString()}
      </p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
