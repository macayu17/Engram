"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";

import { api } from "@/lib/api";


function readStoredApiKey(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem("engram_api_key") ?? "";
}

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState(readStoredApiKey);
  const [draftApiKey, setDraftApiKey] = useState(readStoredApiKey);
  const [saved, setSaved] = useState(false);
  const [keyError, setKeyError] = useState("");
  const malformedApiKey = Boolean(apiKey) && !apiKey.startsWith("ek_");
  const userQuery = useQuery({
    queryKey: ["current-user", apiKey],
    queryFn: () => api.users.me(),
    enabled: Boolean(apiKey) && !malformedApiKey,
  });
  const deleteAccountMutation = useMutation({
    mutationFn: () => api.users.deleteMe(),
    onSuccess: () => {
      localStorage.removeItem("engram_api_key");
      setApiKey("");
      setDraftApiKey("");
      void queryClient.clear();
    },
  });
  const deleteMemoriesMutation = useMutation({
    mutationFn: async () => {
      const response = await api.memories.list({ limit: 100, offset: 0 });
      await Promise.all(response.memories.map((memory) => api.memories.delete(memory.id)));
      return response.memories.length;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["memories"] }),
  });

  function saveApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedApiKey = draftApiKey.trim();
    if (trimmedApiKey && !trimmedApiKey.startsWith("ek_")) {
      setKeyError("Use an Engram key that starts with ek_. OpenAI keys belong in the server .env file.");
      setSaved(false);
      return;
    }
    localStorage.setItem("engram_api_key", trimmedApiKey);
    setApiKey(trimmedApiKey);
    setKeyError("");
    setSaved(true);
  }

  async function copyApiKey() {
    if (apiKey) {
      await navigator.clipboard.writeText(apiKey);
    }
  }

  function deleteMemories() {
    if (window.confirm("Delete the first 100 memories for this account? Repeat if more remain.")) {
      deleteMemoriesMutation.mutate();
    }
  }

  function deleteAccount() {
    if (window.confirm("Delete this Engram user and all related data?")) {
      deleteAccountMutation.mutate();
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase text-signal">local dashboard key</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Settings</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={saveApiKey} className="rounded border border-line bg-panel p-5 shadow-grid">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded border border-line bg-ink text-signal">
              <KeyRound size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold">API Key</h2>
              <p className="text-sm text-zinc-500">Stored in this browser as `engram_api_key`.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={draftApiKey}
              onChange={(event) => {
                setDraftApiKey(event.target.value);
                setSaved(false);
                setKeyError("");
              }}
              placeholder="ek_..."
              className="min-h-11 min-w-0 flex-1 rounded border border-line bg-ink px-3 font-mono text-sm text-zinc-100 outline-none focus:border-signal"
              type="password"
            />
            <button
              type="button"
              onClick={copyApiKey}
              title="Copy saved key"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-line px-3 text-sm text-zinc-300 hover:border-signal/40 hover:text-white"
            >
              <Copy size={16} aria-hidden="true" />
              Copy
            </button>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-signal/40 bg-signal/10 px-4 text-sm font-medium text-signal hover:bg-signal/15"
            >
              <Check size={16} aria-hidden="true" />
              Save
            </button>
          </div>
          {keyError && <p className="mt-3 text-sm text-fault">{keyError}</p>}
          {saved && <p className="mt-3 text-sm text-signal">Saved.</p>}
        </form>

        <div className="rounded border border-line bg-panel p-5 shadow-grid">
          <h2 className="font-semibold">Current User</h2>
          {apiKey ? (
            malformedApiKey ? (
              <p className="mt-4 text-sm text-fault">Use an Engram key that starts with ek_.</p>
            ) : userQuery.isLoading ? (
              <p className="mt-4 text-sm text-zinc-500">Loading user...</p>
            ) : userQuery.isError ? (
              <p className="mt-4 text-sm text-fault">Unable to authenticate this key.</p>
            ) : (
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="font-mono text-xs uppercase text-zinc-500">External ID</dt>
                  <dd className="mt-1 text-zinc-100">{userQuery.data?.external_id}</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs uppercase text-zinc-500">Created</dt>
                  <dd className="mt-1 text-zinc-100">{userQuery.data ? formatDate(userQuery.data.created_at) : ""}</dd>
                </div>
              </dl>
            )
          ) : (
            <p className="mt-4 text-sm text-zinc-500">No key saved.</p>
          )}
        </div>
      </div>

      <div className="rounded border border-fault/30 bg-fault/5 p-5">
        <h2 className="font-semibold text-fault">Danger Zone</h2>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={deleteMemories}
            disabled={!apiKey || deleteMemoriesMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded border border-fault/40 px-4 py-2 text-sm text-fault hover:bg-fault/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete Memories
          </button>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={!apiKey || deleteAccountMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded border border-fault/40 bg-fault/10 px-4 py-2 text-sm font-medium text-fault hover:bg-fault/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete Account
          </button>
        </div>
      </div>
    </section>
  );
}


function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}
