"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, KeyRound, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { api, clearActiveApiKey, readActiveApiKey, setActiveApiKey, type UserProviderConfig, type UserProviderConfigUpdate } from "@/lib/api";
import { useActiveApiKey } from "@/lib/useActiveApiKey";

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const apiKey = useActiveApiKey();
  const [draftApiKey, setDraftApiKey] = useState(readActiveApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [externalIdDraft, setExternalIdDraft] = useState("");
  const [externalIdMessage, setExternalIdMessage] = useState("");
  const [externalId, setExternalId] = useState(() => `dashboard_user_${Date.now()}`);
  const [generatedKey, setGeneratedKey] = useState("");
  const [generatedExternalId, setGeneratedExternalId] = useState("");
  const [generationMessage, setGenerationMessage] = useState("");
  const [managedKeyName, setManagedKeyName] = useState("");
  const [revealedManagedKey, setRevealedManagedKey] = useState("");
  const hosted = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const malformedApiKey = Boolean(apiKey) && !apiKey.startsWith("ek_");
  const userQuery = useQuery({
    queryKey: ["current-user", apiKey],
    queryFn: () => api.users.me(),
    enabled: Boolean(apiKey) && !malformedApiKey,
  });
  const workspaceQuery = useQuery({
    queryKey: ["workspaces", apiKey],
    queryFn: () => api.orgs.list(),
    enabled: Boolean(apiKey) && !malformedApiKey,
  });
  const usageQuery = useQuery({
    queryKey: ["billing", "usage", apiKey],
    queryFn: () => api.billing.usage(),
    enabled: Boolean(apiKey) && !malformedApiKey,
  });
  const managedKeysQuery = useQuery({
    queryKey: ["workspace-keys", apiKey],
    queryFn: () => api.keys.list(),
    enabled: Boolean(apiKey) && !malformedApiKey,
  });
  const workspace = workspaceQuery.data?.[0];
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
  const updateUserMutation = useMutation({
    mutationFn: (nextExternalId: string) => api.users.update(nextExternalId),
    onSuccess: (response) => {
      setExternalIdDraft(response.external_id);
      setExternalIdMessage("Username updated.");
      void queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
    onError: (error) => {
      setExternalIdMessage(error instanceof Error ? error.message : "Unable to update username.");
    },
  });
  const createManagedKeyMutation = useMutation({
    mutationFn: (name: string) => api.keys.create(name),
    onSuccess: (response) => {
      setManagedKeyName("");
      setRevealedManagedKey(response.api_key);
      void queryClient.invalidateQueries({ queryKey: ["workspace-keys"] });
    },
  });
  const revokeManagedKeyMutation = useMutation({
    mutationFn: (id: string) => api.keys.revoke(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["workspace-keys"] }),
  });

  useEffect(() => {
    setDraftApiKey(apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (userQuery.data?.external_id) {
      setExternalIdDraft(userQuery.data.external_id);
    }
  }, [userQuery.data?.external_id]);

  useEffect(() => {
    setExternalIdMessage("");
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

  function updateExternalId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedExternalId = externalIdDraft.trim();
    if (!trimmedExternalId) {
      setExternalIdMessage("Enter a username first.");
      return;
    }
    if (trimmedExternalId === userQuery.data?.external_id) {
      setExternalIdMessage("Username already saved.");
      return;
    }
    setExternalIdMessage("");
    updateUserMutation.mutate(trimmedExternalId);
  }

  function createManagedKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = managedKeyName.trim();
    if (name) createManagedKeyMutation.mutate(name);
  }

  async function openBilling() {
    if (!workspace) return;
    try {
      const response = usageQuery.data?.plan === "pro"
        ? await api.billing.portal(workspace.id)
        : await api.billing.checkout(workspace.id);
      window.location.assign(response.url);
    } catch (error) {
      setKeyError(error instanceof Error ? error.message : "Unable to open billing.");
    }
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
          The dashboard stores one Engram key in this browser. Workspace provider keys are encrypted by the API.
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
              type={showApiKey ? "text" : "password"}
            />
            <button
              type="button"
              onClick={() => setShowApiKey((value) => !value)}
              title={showApiKey ? "Hide saved key" : "View saved key"}
              className="inline-flex min-h-12 items-center justify-center gap-2 border border-line px-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:border-signal hover:text-signal"
            >
              {showApiKey ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              {showApiKey ? "Hide" : "View"}
            </button>
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
              <div className="mt-4 space-y-5">
                <form onSubmit={updateExternalId} className="space-y-3">
                  <label className="block">
                    <span className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Username</span>
                    <span className="mt-1 block font-sans text-[11px] uppercase tracking-[0.12em] text-muted/70">Stored as external ID</span>
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={externalIdDraft}
                      onChange={(event) => {
                        setExternalIdDraft(event.target.value);
                        setExternalIdMessage("");
                      }}
                      className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 font-serif text-base text-ink outline-none focus:border-signal"
                    />
                    <button
                      type="submit"
                      disabled={updateUserMutation.isPending}
                      className="inline-flex min-h-12 items-center justify-center gap-2 border border-ink px-5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-ink hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check size={16} aria-hidden="true" />
                      Save
                    </button>
                  </div>
                  {externalIdMessage && <p className="font-serif text-base text-muted">{externalIdMessage}</p>}
                </form>
                <div>
                  <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Created</p>
                  <p className="mt-1 font-serif text-lg text-ink">{userQuery.data ? formatDate(userQuery.data.created_at) : ""}</p>
                </div>
              </div>
            )
          ) : (
            <p className="mt-4 font-serif text-base text-muted">No key saved.</p>
          )}
        </div>
      </div>

      {!hosted && <form onSubmit={createEngramKey} className="border-y border-line py-6">
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
      </form>}

      <section className="border-y border-line py-6">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Workspace access</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold">API Keys</h2>
            <p className="mt-2 max-w-md font-serif text-base leading-7 text-muted">Create named credentials and revoke one key without rotating every client.</p>
          </div>
          <div>
            <form onSubmit={createManagedKey} className="flex flex-col gap-3 sm:flex-row">
              <input value={managedKeyName} onChange={(event) => setManagedKeyName(event.target.value)} placeholder="Key name" className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-panel px-4 font-sans text-sm text-ink outline-none focus:border-signal" />
              <button type="submit" disabled={!apiKey || createManagedKeyMutation.isPending} className="min-h-11 rounded-md border border-ink px-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] hover:border-signal hover:text-signal disabled:opacity-40">Create key</button>
            </form>
            {revealedManagedKey && <div className="mt-4 border border-signal/40 bg-signal/5 p-4"><p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-signal">Shown once</p><div className="mt-2 flex gap-3"><code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs text-ink">{revealedManagedKey}</code><button type="button" onClick={() => navigator.clipboard.writeText(revealedManagedKey)} className="text-signal">Copy</button></div></div>}
            <div className="mt-5 divide-y divide-line border-y border-line">
              {managedKeysQuery.data?.map((key) => <div key={key.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-sans text-sm font-medium text-ink">{key.name}</p><p className="mt-1 font-sans text-[10px] uppercase tracking-[0.1em] text-muted">Created {formatDate(key.created_at)} · Last used {key.last_used_at ? formatDate(key.last_used_at) : "never"}</p></div><button type="button" onClick={() => window.confirm(`Revoke ${key.name}?`) && revokeManagedKeyMutation.mutate(key.id)} className="justify-self-start font-sans text-[10px] uppercase tracking-[0.1em] text-fault sm:justify-self-end">Revoke</button></div>)}
              {apiKey && !managedKeysQuery.isLoading && !managedKeysQuery.data?.length && <p className="py-4 font-sans text-sm text-muted">No named workspace keys yet.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line py-6">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div><p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Subscription</p><h2 className="mt-2 font-serif text-2xl font-semibold">Billing</h2><p className="mt-2 max-w-md font-serif text-base leading-7 text-muted">Hosted plans limit stored memories, monthly retrievals, and workspace seats. Model usage stays on your provider account.</p></div>
          <div>
            <dl className="grid gap-4 border-y border-line py-4 sm:grid-cols-3"><UsageValue label="Plan" value={usageQuery.data?.plan === "pro" ? "Pro" : "Free"} /><UsageValue label="Memories" value={formatUsage(usageQuery.data?.memories, usageQuery.data?.limits.memories)} /><UsageValue label="Retrievals" value={formatUsage(usageQuery.data?.retrievals, usageQuery.data?.limits.retrievals)} /></dl>
            {hosted && workspace?.role === "owner" && <button type="button" onClick={openBilling} className="mt-5 min-h-11 rounded-md border border-ink px-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] hover:border-signal hover:text-signal">{usageQuery.data?.plan === "pro" ? "Manage billing" : "Upgrade to Pro"}</button>}
          </div>
        </div>
      </section>

      <ProviderConfigSection apiKey={apiKey} onError={setKeyError} />

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

function formatUsage(current?: number, limit?: number): string {
  return `${(current ?? 0).toLocaleString()} / ${(limit ?? 0).toLocaleString()}`;
}

function UsageValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-sans text-[10px] uppercase tracking-[0.1em] text-muted">{label}</dt><dd className="mt-2 font-serif text-xl font-semibold text-ink">{value}</dd></div>;
}

function ProviderConfigSection({ apiKey, onError }: { apiKey: string; onError: (msg: string) => void }) {
  const queryClient = useQueryClient();
  const malformed = Boolean(apiKey) && !apiKey.startsWith("ek_");
  const providerQuery = useQuery({
    queryKey: ["user-provider", apiKey],
    queryFn: () => api.users.provider(),
    enabled: Boolean(apiKey) && !malformed,
  });
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (providerQuery.data) {
      setProvider(providerQuery.data.extraction_provider);
      setModel(providerQuery.data.extraction_model);
    }
  }, [providerQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: UserProviderConfigUpdate) => api.users.updateProvider(payload),
    onSuccess: (response: UserProviderConfig) => {
      setSaveMessage("Saved.");
      setApiKeyInput("");
      void queryClient.invalidateQueries({ queryKey: ["user-provider"] });
      void queryClient.invalidateQueries({ queryKey: ["current-user"] });
      onError("");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Unable to save provider config.";
      onError(msg);
      setSaveMessage("");
    },
  });

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedModel = model.trim();
    if (!trimmedModel) {
      setSaveMessage("");
      onError("Enter an extraction model first.");
      return;
    }
    const payload: UserProviderConfigUpdate = {
      extraction_provider: provider as UserProviderConfig["extraction_provider"],
      extraction_model: trimmedModel,
    };
    if (apiKeyInput.trim()) {
      if (provider === "openai") payload.openai_api_key = apiKeyInput.trim();
      if (provider === "gemini") payload.gemini_api_key = apiKeyInput.trim();
      if (provider === "anthropic") payload.anthropic_api_key = apiKeyInput.trim();
    }
    updateMutation.mutate(payload);
  }

  function clearKey() {
    const payload: UserProviderConfigUpdate = { extraction_provider: provider as UserProviderConfig["extraction_provider"] };
    if (provider === "openai") payload.clear_openai_key = true;
    if (provider === "gemini") payload.clear_gemini_key = true;
    if (provider === "anthropic") payload.clear_anthropic_key = true;
    updateMutation.mutate(payload);
  }

  if (!apiKey) return null;
  if (malformed) {
    return (
      <div className="border-y border-line py-6">
        <h2 className="font-serif text-2xl font-semibold">Extraction</h2>
        <p className="mt-2 font-serif text-base text-muted">Save a valid Engram key first.</p>
      </div>
    );
  }

  return (
    <div className="border-y border-line py-6">
      <h2 className="font-serif text-2xl font-semibold">Extraction</h2>
      <p className="mt-1 font-serif text-base text-muted">
        Choose which provider extracts durable memories. The key is encrypted with Fernet on the server before storage.
      </p>
      {providerQuery.isLoading ? (
        <p className="mt-4 font-serif text-base text-muted">Loading provider config...</p>
      ) : providerQuery.isError ? (
        <p className="mt-4 font-serif text-base text-fault">Unable to load provider config.</p>
      ) : (
        <form onSubmit={save} className="mt-5 space-y-4">
          <div>
            <label className="block">
              <span className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Provider</span>
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-full border border-line bg-paper px-4 font-serif text-base text-ink outline-none focus:border-signal"
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="anthropic">Anthropic</option>
                <option value="ollama">Ollama (local, no key)</option>
              </select>
            </label>
          </div>
          <div>
            <label className="block">
              <span className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Model</span>
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-4o-mini"
                className="mt-2 min-h-12 w-full rounded-full border border-line bg-paper px-4 font-serif text-base text-ink outline-none focus:border-signal"
              />
            </label>
          </div>
          {provider !== "ollama" && (
            <div>
              <label className="block">
                <span className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                  {provider === "openai" ? "OpenAI" : provider === "gemini" ? "Gemini" : "Anthropic"} API key
                </span>
                <span className="mt-1 block font-sans text-[11px] uppercase tracking-[0.12em] text-muted/70">
                  {providerQuery.data?.user_api_key_preview
                    ? `Stored as ${providerQuery.data.user_api_key_preview}`
                    : "No workspace key stored."}
                </span>
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(event) => setApiKeyInput(event.target.value)}
                  placeholder={providerQuery.data?.has_user_api_key ? "••• (leave blank to keep stored key)" : "Paste key"}
                  className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 font-serif text-base text-ink outline-none focus:border-signal"
                />
                <button
                  type="button"
                  onClick={clearKey}
                  disabled={!providerQuery.data?.has_user_api_key || updateMutation.isPending}
                  className="inline-flex min-h-12 items-center justify-center gap-2 border border-line px-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex min-h-12 items-center justify-center gap-2 border border-ink px-5 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-ink hover:border-signal hover:text-signal disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Provider
            </button>
            {saveMessage && <span className="font-serif text-base text-signal">{saveMessage}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
