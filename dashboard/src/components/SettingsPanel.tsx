"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { api, clearActiveApiKey, readActiveApiKey, setActiveApiKey } from "@/lib/api";
import { useActiveApiKey } from "@/lib/useActiveApiKey";

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const apiKey = useActiveApiKey();
  const [draftApiKey, setDraftApiKey] = useState(readActiveApiKey);
  const [saved, setSaved] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [externalId, setExternalId] = useState(() => `dashboard_user_${Date.now()}`);
  const [generatedKey, setGeneratedKey] = useState("");
  const [generatedExternalId, setGeneratedExternalId] = useState("");
  const [generationMessage, setGenerationMessage] = useState("");
  const malformedApiKey = Boolean(apiKey) && !apiKey.startsWith("ek_");
  const userQuery = useQuery({
    queryKey: ["current-user", apiKey],
    queryFn: () => api.users.me(),
    enabled: Boolean(apiKey) && !malformedApiKey,
  });
  const deleteAccountMutation = useMutation({
    mutationFn: () => api.users.deleteMe(),
    onSuccess: () => {
      clearActiveApiKey();
      setDraftApiKey("");
      void queryClient.clear();
    },
  });
  const deleteMemoriesMutation = useMutation({
    mutationFn: () => api.memories.deleteAll(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["memories"] }),
  });
  const createUserMutation = useMutation({
    mutationFn: (nextExternalId: string) => api.users.create(nextExternalId),
    onSuccess: (response) => {
      setActiveApiKey(response.api_key);
      setDraftApiKey(response.api_key);
      setGeneratedKey(response.api_key);
      setGeneratedExternalId(response.external_id);
      setGenerationMessage("Generated and saved in this browser.");
      setSaved(true);
      setKeyError("");
      void queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
    onError: (error) => {
      setGenerationMessage(error instanceof Error ? error.message : "Unable to generate key.");
    },
  });

  useEffect(() => {
    setDraftApiKey(apiKey);
  }, [apiKey]);

  function saveApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedApiKey = draftApiKey.trim();
    if (trimmedApiKey && !trimmedApiKey.startsWith("ek_")) {
      setKeyError("Use an Engram key that starts with ek_. OpenAI keys belong in the server .env file.");
      setSaved(false);
      return;
    }
    if (trimmedApiKey) {
      setActiveApiKey(trimmedApiKey);
    } else {
      clearActiveApiKey();
    }
    setKeyError("");
    setSaved(true);
  }

  async function copyApiKey() {
    if (apiKey) {
      await navigator.clipboard.writeText(apiKey);
    }
  }

  async function copyGeneratedKey() {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey);
    }
  }

  function createEngramKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedExternalId = externalId.trim();
    if (!trimmedExternalId) {
      setGenerationMessage("Enter an external ID first.");
      return;
    }
    setGeneratedKey("");
    setGeneratedExternalId("");
    setGenerationMessage("");
    createUserMutation.mutate(trimmedExternalId);
  }

  function deleteMemories() {
    if (window.confirm("Delete all memories for this account?")) {
      deleteMemoriesMutation.mutate();
    }
  }

  function deleteAccount() {
    if (window.confirm("Delete this Engram user and all related data?")) {
      deleteAccountMutation.mutate();
    }
  }

  return (
    <section className="space-y-12">
      <div>
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">§ III — Local key</p>
        <h1 className="mt-2 font-serif text-5xl font-semibold leading-tight text-ink">Settings</h1>
        <p className="mt-4 max-w-2xl font-serif text-lg leading-8 text-muted">
          The dashboard stores one Engram key in this browser. Provider keys stay on the server.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={saveApiKey} className="border-y border-line py-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded bg-tag text-signal">
              <KeyRound size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-serif text-2xl font-semibold">API Key</h2>
              <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-muted">Stored as engram_api_key</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={draftApiKey}
              onChange={(event) => {
                setDraftApiKey(event.target.value);
                setSaved(false);
                setKeyError("");
              }}
              placeholder="ek_..."
              className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 font-serif text-base text-ink outline-none focus:border-signal"
              type="password"
            />
            <button
              type="button"
              onClick={copyApiKey}
              title="Copy saved key"
              className="inline-flex min-h-12 items-center justify-center gap-2 border border-line px-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:border-signal hover:text-signal"
            >
              <Copy size={16} aria-hidden="true" />
              Copy
            </button>
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 border border-ink px-5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-ink hover:border-signal hover:text-signal"
            >
              <Check size={16} aria-hidden="true" />
              Save
            </button>
          </div>
          {keyError && <p className="mt-3 font-serif text-base text-fault">{keyError}</p>}
          {saved && <p className="mt-3 font-serif text-base text-signal">Saved.</p>}
        </form>

        <div className="border-y border-line py-6">
          <h2 className="font-serif text-2xl font-semibold">Current User</h2>
          {apiKey ? (
            malformedApiKey ? (
              <p className="mt-4 font-serif text-base text-fault">Use an Engram key that starts with ek_.</p>
            ) : userQuery.isLoading ? (
              <p className="mt-4 font-serif text-base text-muted">Loading user...</p>
            ) : userQuery.isError ? (
              <p className="mt-4 font-serif text-base text-fault">Unable to authenticate this key.</p>
            ) : (
              <dl className="mt-4 space-y-5 text-sm">
                <div>
                  <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">External ID</dt>
                  <dd className="mt-1 font-serif text-lg text-ink">{userQuery.data?.external_id}</dd>
                </div>
                <div>
                  <dt className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Created</dt>
                  <dd className="mt-1 font-serif text-lg text-ink">{userQuery.data ? formatDate(userQuery.data.created_at) : ""}</dd>
                </div>
              </dl>
            )
          ) : (
            <p className="mt-4 font-serif text-base text-muted">No key saved.</p>
          )}
        </div>
      </div>

      <form onSubmit={createEngramKey} className="border-y border-line py-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded bg-tag text-signal">
            <Plus size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-serif text-2xl font-semibold">Generate Engram Key</h2>
            <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-muted">Creates a user and saves the new ek_ key</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            value={externalId}
            onChange={(event) => {
              setExternalId(event.target.value);
              setGenerationMessage("");
            }}
            placeholder="dashboard_user_1"
            className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 font-serif text-base text-ink outline-none focus:border-signal"
          />
          <button
            type="submit"
            disabled={createUserMutation.isPending}
            className="inline-flex min-h-12 items-center justify-center gap-2 border border-ink px-5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-ink hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} aria-hidden="true" />
            Generate
          </button>
        </div>
        {generatedKey && (
          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">One-time key for {generatedExternalId}</p>
              <input
                readOnly
                value={generatedKey}
                className="mt-2 min-h-12 w-full rounded-full border border-line bg-paper px-4 font-serif text-base text-ink outline-none"
              />
            </div>
            <button
              type="button"
              onClick={copyGeneratedKey}
              className="inline-flex min-h-12 items-center justify-center gap-2 self-end border border-line px-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:border-signal hover:text-signal"
            >
              <Copy size={16} aria-hidden="true" />
              Copy New Key
            </button>
          </div>
        )}
        {generationMessage && <p className="mt-3 font-serif text-base text-muted">{generationMessage}</p>}
      </form>

      <div className="border-y border-fault/30 bg-fault/5 py-6">
        <h2 className="px-0 font-serif text-2xl font-semibold text-fault">Danger Zone</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={deleteMemories}
            disabled={!apiKey || deleteMemoriesMutation.isPending}
            className="inline-flex items-center justify-center gap-2 border border-fault/40 px-4 py-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-fault hover:bg-fault/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete Memories
          </button>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={!apiKey || deleteAccountMutation.isPending}
            className="inline-flex items-center justify-center gap-2 border border-fault/40 bg-fault/10 px-4 py-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-fault hover:bg-fault/15 disabled:cursor-not-allowed disabled:opacity-50"
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
