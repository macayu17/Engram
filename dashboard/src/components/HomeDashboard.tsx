"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { api } from "@/lib/api";
import { MemoryConstellation } from "./MemoryConstellation";

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
  const approvedQuery = useQuery({
    queryKey: ["dashboard", "approved-count"],
    queryFn: () => api.memories.list({ limit: 1, offset: 0, status: "approved" }),
  });
  const pendingQuery = useQuery({
    queryKey: ["dashboard", "pending-count"],
    queryFn: () => api.memories.list({ limit: 1, offset: 0, status: "pending" }),
  });
  const timelineQuery = useQuery({
    queryKey: ["dashboard", "timeline"],
    queryFn: () => api.memories.timeline(8),
  });
  const entitiesQuery = useQuery({
    queryKey: ["dashboard", "entities"],
    queryFn: () => api.graph.listEntities(),
  });
  const logsQuery = useQuery({
    queryKey: ["dashboard", "logs"],
    queryFn: () => api.logs.list({ limit: 5, offset: 0 }),
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
    <div className="flex flex-col gap-12">
      <div className="memory-hero-frame relative -mx-4 -mt-10 min-h-[35rem] overflow-hidden border-b border-line px-4 py-16 sm:-mx-6 sm:px-6 md:-mt-16 md:min-h-[38rem] md:py-20">
        <MemoryConstellation />
        <div className="memory-hero-orbit" aria-hidden="true">
          <div className="memory-hero-orbit__halo" />
          <div className="memory-hero-orbit__halo memory-hero-orbit__halo--inner" />
          <div className="memory-hero-orbit__cross memory-hero-orbit__cross--x" />
          <div className="memory-hero-orbit__cross memory-hero-orbit__cross--y" />
          <div className="memory-hero-orbit__beacon" />
          <div className="memory-hero-orbit__needle memory-hero-orbit__needle--one" />
          <div className="memory-hero-orbit__needle memory-hero-orbit__needle--two" />
          <div className="memory-hero-orbit__needle memory-hero-orbit__needle--three" />
          <div className="memory-hero-orbit__chip memory-hero-orbit__chip--one">
            <span>fact</span>
            <strong>0.84</strong>
          </div>
          <div className="memory-hero-orbit__chip memory-hero-orbit__chip--two">
            <span>rank</span>
            <strong>pgv</strong>
          </div>
          <div className="memory-hero-orbit__chip memory-hero-orbit__chip--three">
            <span>inject</span>
            <strong>ctx</strong>
          </div>
          <div className="memory-hero-orbit__rail">
            <span>embed</span>
            <span>search</span>
            <span>merge</span>
          </div>
        </div>
        <div className="relative z-10 mx-auto flex max-w-7xl items-center">
          <div className="w-full min-w-0 max-w-3xl">
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">The Engram memory ledger · Vol. 01</p>
            <h1 className="mt-6 max-w-full font-serif text-[2.8rem] font-bold leading-tight text-ink sm:text-5xl md:text-7xl">
              Every durable <span className="italic text-signal">memory.</span>
              <br />
              Inspectable.
            </h1>
            <p className="mt-6 max-w-[20rem] font-serif text-lg leading-8 text-muted sm:max-w-[min(36rem,100%)]">
              Watch user facts move from conversation to vector retrieval, then inspect exactly what Engram injected.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/memories"
                className="group inline-flex items-center gap-3 rounded-full bg-signal px-4 py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-paper shadow-[0_18px_44px_rgb(var(--color-signal)_/_0.22)] transition hover:-translate-y-0.5 hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal active:translate-y-0"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/12 text-paper transition group-hover:bg-signal">
                  <Plus size={15} aria-hidden="true" />
                </span>
                Add Memory
              </Link>
              <Link
                href="/chat"
                className="group inline-flex items-center gap-3 py-2.5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-tag/35 text-muted transition group-hover:border-signal group-hover:bg-signal/10 group-hover:text-signal">
                  <MessageSquare size={15} aria-hidden="true" />
                </span>
                <span className="border-b border-line pb-1 transition group-hover:border-signal">Test Chat</span>
              </Link>
            </div>
            <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-3 border-y border-line py-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted sm:grid-cols-3 sm:gap-0">
              <span>{totalApproved.toLocaleString()} memories</span>
              <span>pgvector</span>
              <span>async extract</span>
            </div>
          </div>
        </div>
      </div>

      <section>
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ I — The numbers</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Approved memories" value={totalApproved} loading={approvedQuery.isLoading} href="/memories" />
          <StatTile label="Pending review" value={totalPending} loading={pendingQuery.isLoading} accent={totalPending > 0} href="/memories" />
          <StatTile label="Entities" value={totalEntities} loading={entitiesQuery.isLoading} href="/graph" />
          <StatTile label="Retrievals logged" value={totalRetrievals} loading={logsQuery.isLoading} href="/logs" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div>
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ II — Recent activity</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-ink">Timeline</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {timelineQuery.isLoading && (
              <li className="py-4 font-serif text-base text-muted">Loading…</li>
            )}
            {!timelineQuery.isLoading && (timelineQuery.data?.items.length ?? 0) === 0 && (
              <li className="py-4 font-serif text-base text-muted">No activity yet. Have a conversation in <Link className="underline" href="/chat">Chat</Link> to start.</li>
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
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ III — Most connected</p>
          <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-ink">Top entities</h2>
          <ul className="mt-4 space-y-2">
            {entitiesQuery.isLoading && (
              <li className="font-serif text-base text-muted">Loading…</li>
            )}
            {!entitiesQuery.isLoading && topEntities.length === 0 && (
              <li className="font-serif text-base text-muted">
                No entities yet. Open the <Link className="underline" href="/graph">Graph</Link> and click <em>Backfill entities</em>.
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
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ IV — Latest retrievals</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight text-ink">What your assistant just looked up</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {logsQuery.isLoading && <li className="py-4 font-serif text-base text-muted">Loading…</li>}
          {!logsQuery.isLoading && (logsQuery.data?.logs.length ?? 0) === 0 && (
            <li className="py-4 font-serif text-base text-muted">
              No retrievals yet. They appear here as soon as your assistant queries memories.
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
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ V — Go anywhere</p>
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
      className={`rounded-lg border p-4 transition ${
        accent
          ? "border-signal/60 bg-paper hover:border-signal"
          : "border-line bg-paper hover:border-ink/40"
      }`}
    >
      <p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`mt-2 font-serif text-3xl font-semibold ${accent ? "text-signal" : "text-ink"}`}>
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
