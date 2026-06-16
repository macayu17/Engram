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
                <option value="ollama">Ollama (local, no key)</option>
                <option value="anthropic">Anthropic (chat only, no extraction yet)</option>
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
                    : "Not stored. Server fallback will be used."}
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
