"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { api, getApiBaseUrl } from "@/lib/api";
import { buildConnectionConfig } from "@/lib/connection-config";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { useNamespace } from "@/lib/useNamespace";
import { ProductPageHeader } from "./ProductPageHeader";

export function ConnectionsWorkspace() {
  const apiKey = useActiveApiKey();
  const namespace = useNamespace();
  const queryClient = useQueryClient();
  const [client, setClient] = useState<"claude" | "codex">("claude");
  const [scriptPath, setScriptPath] = useState(
    "/absolute/path/to/engram/mcp/dist/index.js",
  );
  const [revealKey, setRevealKey] = useState(false);
  const [message, setMessage] = useState("");
  const [days, setDays] = useState(30);
  const status = useQuery({
    queryKey: ["connections", apiKey, namespace],
    queryFn: api.connections.status,
    enabled: Boolean(apiKey),
    refetchInterval: 15000,
  });
  const health = useQuery({
    queryKey: ["health", apiKey, namespace],
    queryFn: api.health,
  });
  const grants = useQuery({
    queryKey: ["oauth-connections", apiKey, namespace],
    queryFn: api.oauth.list,
    enabled: Boolean(apiKey),
  });
  const retry = useMutation({
    mutationFn: api.connections.retry,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["connections"] }),
  });
  const revoke = useMutation({
    mutationFn: api.oauth.revoke,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["oauth-connections"] }),
  });
  const purge = useMutation({
    mutationFn: () => api.connections.clearCaptures(days),
    onSuccess: (result) => {
      setMessage(
        `Cleared ${result.deleted} raw captures. Saved memories are retained.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
  });
  const config = buildConnectionConfig(
    client,
    scriptPath,
    getApiBaseUrl(),
    namespace,
    revealKey ? apiKey : undefined,
  );
  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(config);
      setMessage(
        revealKey
          ? "Copied configuration including your secret key. Store it privately."
          : "Copied configuration with a key placeholder. Add your key locally.",
      );
    } catch {
      setMessage(
        "Clipboard unavailable. Select and copy the configuration below.",
      );
    }
  }
  return (
    <section className="space-y-10">
      <ProductPageHeader
        eyebrow="Workspace connections"
        title="Connections"
        description="Connect an assistant, check recent captures, and control its access to memory."
        actions={
          <button
            type="button"
            onClick={() => {
              void status.refetch();
              void health.refetch();
              void grants.refetch();
            }}
            className="min-h-10 rounded border border-line px-4 text-sm"
          >
            Test connection
          </button>
        }
      />
      {!apiKey && (
        <p className="text-sm text-muted">
          Save an API key in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          to connect your workspace.
        </p>
      )}
      {[
        status.error,
        health.error,
        grants.error,
        retry.error,
        revoke.error,
        purge.error,
      ]
        .filter(Boolean)
        .map((error, index) => (
          <p key={index} role="alert" className="text-sm text-fault">
            {error?.message}
          </p>
        ))}
      {status.isLoading && <p role="status">Checking connection...</p>}
      <dl className="grid gap-5 border-y border-line py-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase text-muted">API</dt>
          <dd className="mt-2">
            {health.isLoading
              ? "Checking..."
              : (health.data?.status ?? "Unavailable")}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted">Workspace identity</dt>
          <dd className="mt-2 break-words">
            {status.data?.user.external_id ?? "Not connected"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted">Extraction provider</dt>
          <dd className="mt-2">
            {status.data
              ? `${status.data.provider.name} · ${status.data.provider.configured ? "Configured" : "Needs configuration"}`
              : "Not checked"}
          </dd>
        </div>
      </dl>
      <section className="space-y-5">
        <h2 className="font-serif text-2xl">Install a local connection</h2>
        <p className="max-w-3xl text-sm leading-7 text-muted">
          Build the MCP server with npm ci and npm run build inside mcp/. This
          connection supports deliberate recall and capture through tools; it
          does not automatically intercept your assistant conversations.
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="space-y-2 text-sm">
            <span className="block text-muted">Client</span>
            <select
              value={client}
              onChange={(event) => {
                setClient(event.target.value as "claude" | "codex");
                setRevealKey(false);
              }}
              className="min-h-10 rounded border border-line bg-panel px-3"
            >
              <option value="claude">Claude Desktop</option>
              <option value="codex">Codex</option>
            </select>
          </label>
          <label className="min-w-0 flex-1 space-y-2 text-sm">
            <span className="block text-muted">
              Absolute path to built MCP entrypoint
            </span>
            <input
              value={scriptPath}
              onChange={(event) => setScriptPath(event.target.value)}
              className="min-h-10 w-full rounded border border-line bg-panel px-3 font-mono text-xs"
            />
          </label>
        </div>
        <p className="text-sm text-muted">
          {client === "claude"
            ? "Merge into your Claude Desktop configuration file, then restart Claude Desktop."
            : "Merge into ~/.codex/config.toml, then restart Codex."}{" "}
          Project: {namespace}.
        </p>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            checked={revealKey}
            disabled={!apiKey}
            onChange={(event) => setRevealKey(event.target.checked)}
            className="mt-1"
          />
          <span>
            Reveal and include my secret API key in the configuration and
            clipboard. Keep this file private.
          </span>
        </label>
        <pre
          tabIndex={0}
          aria-label="MCP connection configuration"
          className="max-h-96 overflow-auto rounded border border-line bg-panel p-4 font-mono text-xs leading-6"
        >
          {config}
        </pre>
        <button
          type="button"
          disabled={!scriptPath.trim()}
          onClick={() => void copyConfig()}
          className="min-h-10 rounded border border-line px-4 text-sm disabled:opacity-40"
        >
          {revealKey ? "Copy configuration with secret" : "Copy configuration"}
        </button>
        {status.data?.mcp_url && (
          <p className="break-all text-sm text-muted">
            Hosted MCP endpoint: <code>{status.data.mcp_url}</code>. Use your
            client’s OAuth connection flow to authorize one project.
          </p>
        )}
      </section>
      {message && (
        <p role="status" className="text-sm text-signal">
          {message}
        </p>
      )}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Recent clients</h2>
        {status.data?.clients.length === 0 && (
          <p className="text-sm text-muted">
            No captures yet. Ask your connected assistant to save a useful fact.
          </p>
        )}
        {status.data?.clients.map((connection) => (
          <article
            key={connection.source}
            className="flex flex-wrap justify-between gap-3 border-t border-line py-4 text-sm"
          >
            <span>{connection.source}</span>
            <span className="text-muted">
              {connection.conversations} conversations ·{" "}
              {connection.memories_extracted} extracted ·{" "}
              {new Date(connection.last_seen).toLocaleString()}
            </span>
          </article>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Extraction jobs</h2>
        {status.data?.jobs.length === 0 && (
          <p className="text-sm text-muted">
            No extraction jobs in this project.
          </p>
        )}
        {status.data?.jobs.map((job) => (
          <article
            key={job.id}
            className="space-y-2 border-t border-line py-4 text-sm"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <span>
                {job.extraction_status} · {job.attempts} attempts ·{" "}
                {job.memories_extracted} memories
              </span>
              <time className="text-muted">
                {new Date(job.created_at).toLocaleString()}
              </time>
            </div>
            <p className="break-all text-xs text-muted">{job.id}</p>
            {job.last_error && <p className="text-fault">{job.last_error}</p>}
            {job.extraction_status === "failed" && (
              <div>
                {job.recoverable ? (
                  <button
                    type="button"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(job.id)}
                    className="min-h-10 rounded border border-line px-4 disabled:opacity-40"
                  >
                    Retry extraction
                  </button>
                ) : (
                  <p className="text-muted">
                    This capture used a temporary provider key and cannot be
                    retried. Send it again with your configured provider.
                  </p>
                )}
              </div>
            )}
          </article>
        ))}
      </section>
      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Authorized assistants</h2>
        {grants.isLoading && <p role="status">Loading access grants...</p>}
        {grants.data?.connections.length === 0 && (
          <p className="text-sm text-muted">
            No assistants authorized through OAuth.
          </p>
        )}
        {grants.data?.connections.map((grant) => (
          <article
            key={grant.id}
            className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-4"
          >
            <div>
              <p className="text-sm">
                {grant.client_name} · {grant.namespace}
              </p>
              <p className="mt-1 text-xs text-muted">
                {grant.scope} · expires{" "}
                {new Date(grant.expires_at).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              disabled={revoke.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Revoke ${grant.client_name}'s access to ${grant.namespace}?`,
                  )
                )
                  revoke.mutate(grant.id);
              }}
              className="min-h-10 rounded border border-line px-4 text-sm disabled:opacity-40"
            >
              Revoke access
            </button>
          </article>
        ))}
      </section>
      <section className="space-y-4 border-t border-line pt-6">
        <h2 className="font-serif text-2xl">Raw capture retention</h2>
        <p className="max-w-3xl text-sm leading-7 text-muted">
          Clear old raw conversation payloads in this project. Memories and
          extraction status remain. This cannot be undone, and source inspection
          will no longer show those conversations.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm">
            Older than{" "}
            <input
              aria-label="Capture retention days"
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="mx-2 min-h-10 w-24 rounded border border-line bg-panel px-3"
            />{" "}
            days
          </label>
          <button
            type="button"
            disabled={
              !apiKey ||
              purge.isPending ||
              !Number.isInteger(days) ||
              days < 1 ||
              days > 3650
            }
            onClick={() => {
              if (
                window.confirm(
                  `Permanently clear raw conversation payloads older than ${days} days in this project? Saved memories remain. This cannot be undone.`,
                )
              )
                purge.mutate();
            }}
            className="min-h-10 rounded border border-fault/30 px-4 text-sm text-fault disabled:opacity-40"
          >
            Clear raw captures
          </button>
        </div>
      </section>
    </section>
  );
}
