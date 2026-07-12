"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { api } from "@/lib/api";
import { useActiveApiKey } from "@/lib/useActiveApiKey";


export function OverviewDashboard() {
  const activeApiKey = useActiveApiKey();
  const connected = activeApiKey.startsWith("ek_");
  const memories = useQuery({ queryKey: ["overview", "memories"], queryFn: () => api.memories.list({ limit: 1, status: "approved" }), enabled: connected, retry: false });
  const pending = useQuery({ queryKey: ["overview", "pending"], queryFn: () => api.memories.list({ limit: 1, status: "pending" }), enabled: connected, retry: false });
  const logs = useQuery({ queryKey: ["overview", "logs"], queryFn: () => api.logs.list({ limit: 5, offset: 0 }), enabled: connected, retry: false });
  const provider = useQuery({ queryKey: ["overview", "provider"], queryFn: () => api.users.provider(), enabled: connected, retry: false });
  const usage = useQuery({ queryKey: ["billing", "usage"], queryFn: () => api.billing.usage(), enabled: connected, retry: false });
  const failed = [memories, pending, logs, provider, usage].some((query) => query.isError);
  const loading = [memories, pending, logs, provider, usage].some((query) => query.isLoading);

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-medium text-signal">Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Overview</h1>
        <p className="mt-2 text-sm text-muted">Memory storage, retrieval activity, and provider status.</p>
      </header>
      {!connected && <section className="max-w-2xl border-y border-line py-8"><h2 className="text-lg font-semibold">Connect this dashboard</h2><p className="mt-2 text-sm leading-6 text-muted">Add a local Engram API key in Settings, or sign in when hosted authentication is configured.</p><Link href="/settings" className="mt-5 inline-flex rounded-md bg-signal px-4 py-2.5 text-sm font-semibold text-white">Open settings</Link></section>}
      {!connected ? null : <>
      {failed && <div className="border border-fault/40 bg-fault/5 px-4 py-3 text-sm text-fault">Some workspace data could not be loaded. Check the API key and provider connection.</div>}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2"><div className="h-28 animate-pulse bg-tag" /><div className="h-28 animate-pulse bg-tag" /></div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="border-t border-line pt-5">
            <h2 className="text-base font-semibold">Usage</h2>
            <UsageRow label="Memories" current={usage.data?.memories ?? memories.data?.total ?? 0} limit={usage.data?.limits.memories} />
            <UsageRow label="Retrievals this month" current={usage.data?.retrievals ?? logs.data?.total ?? 0} limit={usage.data?.limits.retrievals} />
            <p className="mt-4 text-sm text-muted">{pending.data?.total ?? 0} memories waiting for review</p>
          </section>
          <section className="border-t border-line pt-5">
            <h2 className="text-base font-semibold">Provider</h2>
            <p className="mt-4 text-sm text-ink">{provider.data?.extraction_provider ?? "Not configured"}</p>
            <p className="mt-1 text-sm text-muted">{provider.data?.has_user_api_key ? "Workspace credential saved" : "No workspace credential saved"}</p>
            <Link href="/settings" className="mt-4 inline-block text-sm font-medium text-signal hover:underline">Open provider settings</Link>
          </section>
          <section className="border-t border-line pt-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-4"><h2 className="text-base font-semibold">Recent retrievals</h2><Link href="/logs" className="text-sm text-signal hover:underline">View logs</Link></div>
            {(logs.data?.logs.length ?? 0) === 0 ? <p className="mt-4 text-sm text-muted">No retrievals recorded yet.</p> : (
              <ul className="mt-3 divide-y divide-line">{logs.data?.logs.map((log) => <li key={log.id} className="py-3 text-sm text-ink">{log.query || "Empty query"}</li>)}</ul>
            )}
          </section>
        </div>
      )}
      </>}
    </div>
  );
}

function UsageRow({ label, current, limit }: { label: string; current: number; limit?: number }) {
  const ratio = limit ? Math.min(100, (current / limit) * 100) : 0;
  return (
    <div className="mt-4">
      <div className="flex justify-between gap-4 text-sm"><span>{label}</span><span className="font-mono text-xs text-muted">{current.toLocaleString()}{limit ? ` / ${limit.toLocaleString()}` : ""}</span></div>
      <div className="mt-2 grid grid-cols-10 gap-1" aria-label={`${Math.round(ratio)}% used`}>
        {Array.from({ length: 10 }, (_, index) => <span key={index} className={index < Math.ceil(ratio / 10) ? "h-1.5 bg-signal" : "h-1.5 bg-tag"} />)}
      </div>
    </div>
  );
}
