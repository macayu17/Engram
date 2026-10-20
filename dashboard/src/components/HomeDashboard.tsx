"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { api } from "@/lib/api";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { useNamespace } from "@/lib/useNamespace";
import { LogEntry } from "./LogEntry";
import { ProductPageHeader } from "./ProductPageHeader";

export function HomeDashboard() {
  const apiKey = useActiveApiKey();
  const namespace = useNamespace();
  const connected = Boolean(apiKey);
  const approved = useQuery({
    queryKey: ["dashboard", "approved", apiKey, namespace],
    queryFn: () => api.memories.list({ limit: 1, status: "approved" }),
    enabled: connected,
  });
  const pending = useQuery({
    queryKey: ["dashboard", "pending", apiKey, namespace],
    queryFn: () => api.memories.list({ limit: 1, status: "pending" }),
    enabled: connected,
  });
  const logs = useQuery({
    queryKey: ["dashboard", "logs", apiKey, namespace],
    queryFn: () => api.logs.list({ limit: 5 }),
    enabled: connected,
  });
  const status = useQuery({
    queryKey: ["connections", apiKey, namespace],
    queryFn: api.connections.status,
    enabled: connected,
  });
  const timeline = useQuery({
    queryKey: ["dashboard", "timeline", apiKey, namespace],
    queryFn: () => api.memories.timeline(8),
    enabled: connected,
  });
  const failedJobs =
    status.data?.jobs.filter((job) => job.extraction_status === "failed")
      .length ?? 0;
  return (
    <section className="space-y-10">
      <ProductPageHeader
        eyebrow={`Workspace / ${namespace}`}
        title="Overview"
        description="Review captured facts, check connection health, and inspect recent retrievals."
        actions={
          <Link
            href="/connections"
            className="inline-flex min-h-10 items-center rounded border border-line px-4 text-sm"
          >
            Manage connections
          </Link>
        }
      />
      {!connected && (
        <div className="space-y-3 rounded border border-line bg-panel p-6">
          <h2 className="font-serif text-2xl">Connect your workspace</h2>
          <p className="text-sm leading-7 text-muted">
            Save an API key in Settings, then connect Claude or Codex to begin
            deliberate memory capture.
          </p>
          <Link
            href="/settings"
            className="inline-flex min-h-10 items-center text-sm underline"
          >
            Open Settings
          </Link>
        </div>
      )}
      {[approved.error, pending.error, logs.error, status.error, timeline.error]
        .filter(Boolean)
        .map((error, index) => (
          <p key={index} role="alert" className="text-sm text-fault">
            {error?.message}
          </p>
        ))}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Approved memories",
            value: approved.data?.total,
            loading: approved.isLoading,
            href: "/memories",
          },
          {
            label: "Pending review",
            value: pending.data?.total,
            loading: pending.isLoading,
            href: "/memories",
          },
          {
            label: "Retrieval events",
            value: logs.data?.total,
            loading: logs.isLoading,
            href: "/logs",
          },
          {
            label: "Failed extraction jobs",
            value: status.data ? failedJobs : undefined,
            loading: status.isLoading,
            href: "/connections",
          },
        ].map((metric) => (
          <Link
            key={metric.label}
            href={metric.href}
            className="rounded border border-line p-5 focus-visible:outline-signal"
          >
            <p className="text-xs text-muted">{metric.label}</p>
            <p className="mt-3 font-serif text-3xl">
              {connected && metric.loading
                ? "Loading..."
                : (metric.value ?? "—")}
            </p>
          </Link>
        ))}
      </div>
      {connected && status.data && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-5">
          <p className="text-sm">
            Extraction: {status.data.provider.name} ·{" "}
            {status.data.provider.configured
              ? "Ready"
              : "Needs provider configuration"}{" "}
            · {status.data.clients.length} clients
          </p>
          <Link
            href={status.data.provider.configured ? "/chat" : "/settings"}
            className="text-sm underline"
          >
            {status.data.provider.configured
              ? "Open Playground"
              : "Configure provider"}
          </Link>
        </div>
      )}
      {connected && approved.data?.total === 0 && pending.data?.total === 0 && (
        <div className="space-y-3 rounded border border-line p-6">
          <h2 className="font-serif text-2xl">
            No memories in this project yet
          </h2>
          <p className="text-sm leading-7 text-muted">
            Connect an assistant or use the Playground to send a conversation.
            Newly inferred facts will wait in Pending for your approval.
          </p>
          <Link
            href="/connections"
            className="inline-flex min-h-10 items-center text-sm underline"
          >
            Set up a connection
          </Link>
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-5">
          <h2 className="font-serif text-2xl">Recent retrievals</h2>
          {logs.isLoading && connected && (
            <p role="status">Loading retrievals...</p>
          )}
          {logs.data?.logs.length === 0 && (
            <p className="text-sm text-muted">
              No retrievals in this project. Try a memory search or a Playground
              request.
            </p>
          )}
          <div className="divide-y divide-line border-y border-line">
            {logs.data?.logs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))}
          </div>
        </section>
        <section className="space-y-5">
          <h2 className="font-serif text-2xl">Recent activity</h2>
          {timeline.isLoading && connected && (
            <p role="status">Loading activity...</p>
          )}
          {timeline.data?.items.length === 0 && (
            <p className="text-sm text-muted">
              No activity in this project yet.
            </p>
          )}
          <ul className="divide-y divide-line border-y border-line">
            {timeline.data?.items.map((item) => (
              <li key={`${item.type}:${item.id}`} className="space-y-2 py-4">
                <p className="text-xs text-muted">
                  {item.type} · {new Date(item.created_at).toLocaleString()}
                </p>
                <p className="text-sm leading-7">{item.title}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
