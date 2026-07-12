"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { api, clearActiveApiKey, readActiveApiKey, setActiveApiKey, type UserProviderConfig, type UserProviderConfigUpdate } from "@/lib/api";
import { useActiveApiKey } from "@/lib/useActiveApiKey";


const sections = ["workspace", "members", "api-keys", "providers", "billing", "account"];

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const activeApiKey = useActiveApiKey();
  const hosted = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const [localKey, setLocalKey] = useState(readActiveApiKey);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [memberExternalId, setMemberExternalId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const authenticated = Boolean(activeApiKey?.startsWith("ek_"));
  const userQuery = useQuery({ queryKey: ["settings", "user", activeApiKey], queryFn: () => api.users.me(), enabled: authenticated, retry: false });
  const workspaceQuery = useQuery({ queryKey: ["settings", "workspaces", activeApiKey], queryFn: () => api.orgs.list(), enabled: authenticated, retry: false });
  const usageQuery = useQuery({ queryKey: ["billing", "usage"], queryFn: () => api.billing.usage(), enabled: authenticated, retry: false });
  const keysQuery = useQuery({ queryKey: ["settings", "keys", activeApiKey], queryFn: () => api.keys.list(), enabled: authenticated, retry: false });
  const workspace = workspaceQuery.data?.[0];
  const canManageWorkspace = workspace?.role === "owner" || workspace?.role === "admin";

  useEffect(() => setLocalKey(activeApiKey), [activeApiKey]);

  const createKey = useMutation({
    mutationFn: (name: string) => api.keys.create(name),
    onSuccess: (result) => {
      setRevealedKey(result.api_key);
      setNewKeyName("");
      void queryClient.invalidateQueries({ queryKey: ["settings", "keys"] });
    },
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => api.keys.revoke(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["settings", "keys"] }),
  });
  const addMember = useMutation({
    mutationFn: (externalId: string) => api.orgs.addMember(workspace?.id ?? "", externalId, "member"),
    onSuccess: () => {
      setMemberExternalId("");
      setStatusMessage("Member added.");
      void queryClient.invalidateQueries({ queryKey: ["billing", "usage"] });
    },
    onError: (error) => setStatusMessage(error instanceof Error ? error.message : "Unable to add member."),
  });
  const deleteMemories = useMutation({ mutationFn: () => api.memories.deleteAll(), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["memories"] }) });
  const deleteAccount = useMutation({ mutationFn: () => api.users.deleteMe(), onSuccess: () => { clearActiveApiKey(); void queryClient.clear(); } });

  function saveLocalKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = localKey.trim();
    if (value && !value.startsWith("ek_")) {
      setStatusMessage("Engram API keys start with ek_.");
      return;
    }
    if (value) setActiveApiKey(value); else clearActiveApiKey();
    setStatusMessage("Local API key saved.");
  }

  function submitNewKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newKeyName.trim();
    if (name) createKey.mutate(name);
  }

  function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const externalId = memberExternalId.trim();
    if (externalId) addMember.mutate(externalId);
  }

  async function openBilling(mode: "checkout" | "portal") {
    if (!workspace) return;
    try {
      const result = mode === "checkout" ? await api.billing.checkout(workspace.id) : await api.billing.portal(workspace.id);
      window.location.assign(result.url);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to open billing.");
    }
  }

  return (
    <div className="space-y-10">
      <header><p className="text-sm font-semibold text-signal">Workspace administration</p><h1 className="mt-2 text-3xl font-semibold">Settings</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Manage access, provider credentials, plan limits, and account data.</p></header>
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-b border-line pb-3">{sections.map((section) => <a key={section} href={`#${section}`} className="shrink-0 rounded-md px-3 py-2 text-sm capitalize text-muted hover:bg-tag hover:text-ink">{section.replace("-", " ")}</a>)}</nav>
      {statusMessage && <p className="border border-line bg-panel px-4 py-3 text-sm text-muted">{statusMessage}</p>}
      {!authenticated && <p className="border border-caution/40 bg-caution/5 px-4 py-3 text-sm text-caution">Connect a valid Engram API key to load workspace settings.</p>}

      <SettingsSection id="workspace" title="Workspace" description="Identity and local dashboard connection.">
        <DefinitionList items={[["Name", workspace?.name ?? "Unavailable"], ["Role", workspace?.role ?? "Unavailable"], ["User", userQuery.data?.external_id ?? "Unavailable"]]} />
        {!hosted && <form onSubmit={saveLocalKey} className="mt-6 max-w-2xl"><FieldLabel label="Local Engram API key" detail="Stored in this browser as engram_api_key" /><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input type="password" value={localKey} onChange={(event) => setLocalKey(event.target.value)} placeholder="ek_..." className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-paper px-3 font-mono text-sm outline-none focus:border-signal" /><Button type="submit">Save key</Button></div></form>}
      </SettingsSection>

      <SettingsSection id="members" title="Members" description="Workspace seats share memories, logs, and provider configuration.">
        <p className="text-sm text-muted">{usageQuery.data?.members ?? 0} of {usageQuery.data?.limits.members ?? 1} seats used on the {usageQuery.data?.plan ?? "free"} plan.</p>
        {canManageWorkspace && <form onSubmit={submitMember} className="mt-5 flex max-w-2xl flex-col gap-2 sm:flex-row"><input value={memberExternalId} onChange={(event) => setMemberExternalId(event.target.value)} placeholder="Existing user external ID" className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-signal" /><Button type="submit" disabled={addMember.isPending}>Add member</Button></form>}
      </SettingsSection>

      <SettingsSection id="api-keys" title="API keys" description="Create scoped workspace credentials without rotating unrelated keys.">
        <form onSubmit={submitNewKey} className="flex max-w-2xl flex-col gap-2 sm:flex-row"><input value={newKeyName} onChange={(event) => setNewKeyName(event.target.value)} placeholder="Key name" className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-signal" /><Button type="submit" disabled={createKey.isPending}><KeyRound size={15} /> Create key</Button></form>
        {revealedKey && <div className="mt-4 border border-signal/30 bg-signal/5 p-4"><p className="text-xs font-semibold text-signal">Shown once</p><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs text-ink">{revealedKey}</code><button type="button" onClick={() => navigator.clipboard.writeText(revealedKey)} aria-label="Copy new API key" className="text-signal"><Copy size={16} /></button></div></div>}
        <div className="mt-5 divide-y divide-line border-y border-line">{keysQuery.data?.map((key) => <div key={key.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="text-sm font-medium">{key.name}</p><p className="mt-1 text-xs text-muted">Created {formatDate(key.created_at)} · Last used {key.last_used_at ? formatDate(key.last_used_at) : "never"}</p></div><span className="font-mono text-xs text-muted">{key.id.slice(0, 8)}</span><button type="button" onClick={() => window.confirm(`Revoke ${key.name}?`) && revokeKey.mutate(key.id)} className="justify-self-start text-xs font-medium text-fault sm:justify-self-end">Revoke</button></div>)}</div>
      </SettingsSection>

      <ProviderSection authenticated={authenticated} />

      <SettingsSection id="billing" title="Billing" description="Plan, calendar-month usage, and subscription management.">
        <DefinitionList items={[["Plan", usageQuery.data?.plan === "pro" ? "Pro" : "Free"], ["Memories", formatUsage(usageQuery.data?.memories, usageQuery.data?.limits.memories)], ["Retrievals", formatUsage(usageQuery.data?.retrievals, usageQuery.data?.limits.retrievals)], ["Period end", usageQuery.data?.current_period_end ? formatDate(usageQuery.data.current_period_end) : "Not applicable"]]} />
        <p className="mt-5 text-sm text-muted">Hosted Engram does not include model credits. Provider usage is billed through your saved provider credential.</p>
        {workspace?.role === "owner" && hosted && <Button type="button" className="mt-5" onClick={() => openBilling(usageQuery.data?.plan === "pro" ? "portal" : "checkout")}>{usageQuery.data?.plan === "pro" ? "Manage billing" : "Upgrade to Pro"}</Button>}
      </SettingsSection>

      <SettingsSection id="account" title="Account" description="Destructive actions remain separate from access and billing controls.">
        <div className="flex flex-col gap-3 sm:flex-row"><Button type="button" danger onClick={() => window.confirm("Delete all memories for this account?") && deleteMemories.mutate()} disabled={!authenticated || deleteMemories.isPending}><Trash2 size={15} /> Delete memories</Button><Button type="button" danger onClick={() => window.confirm("Delete this Engram user and all related data?") && deleteAccount.mutate()} disabled={!authenticated || deleteAccount.isPending}><Trash2 size={15} /> Delete account</Button></div>
      </SettingsSection>
    </div>
  );
}

function ProviderSection({ authenticated }: { authenticated: boolean }) {
  const queryClient = useQueryClient();
  const providerQuery = useQuery({ queryKey: ["settings", "provider"], queryFn: () => api.users.provider(), enabled: authenticated, retry: false });
  const [provider, setProvider] = useState<UserProviderConfig["extraction_provider"]>("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [providerKey, setProviderKey] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { if (providerQuery.data) { setProvider(providerQuery.data.extraction_provider); setModel(providerQuery.data.extraction_model); } }, [providerQuery.data]);
  const update = useMutation({ mutationFn: (payload: UserProviderConfigUpdate) => api.users.updateProvider(payload), onSuccess: () => { setProviderKey(""); setMessage("Provider settings saved."); void queryClient.invalidateQueries({ queryKey: ["settings", "provider"] }); }, onError: (error) => setMessage(error instanceof Error ? error.message : "Unable to save provider settings.") });

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: UserProviderConfigUpdate = { extraction_provider: provider, extraction_model: model.trim() };
    if (providerKey.trim() && provider === "openai") payload.openai_api_key = providerKey.trim();
    if (providerKey.trim() && provider === "gemini") payload.gemini_api_key = providerKey.trim();
    if (providerKey.trim() && provider === "anthropic") payload.anthropic_api_key = providerKey.trim();
    update.mutate(payload);
  }
  function clearProviderKey() {
    const payload: UserProviderConfigUpdate = { extraction_provider: provider };
    if (provider === "openai") payload.clear_openai_key = true;
    if (provider === "gemini") payload.clear_gemini_key = true;
    if (provider === "anthropic") payload.clear_anthropic_key = true;
    update.mutate(payload);
  }

  return <SettingsSection id="providers" title="Providers" description="Extraction uses the workspace credential; hosted Engram supplies no model credits."><form onSubmit={save} className="grid max-w-3xl gap-4 sm:grid-cols-2"><label><FieldLabel label="Provider" /><select value={provider} onChange={(event) => setProvider(event.target.value as UserProviderConfig["extraction_provider"])} className="mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm"><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option><option value="ollama">Ollama</option></select></label><label><FieldLabel label="Extraction model" /><input value={model} onChange={(event) => setModel(event.target.value)} className="mt-2 min-h-10 w-full rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-signal" /></label>{provider !== "ollama" && <label className="sm:col-span-2"><FieldLabel label={`${provider} API key`} detail={providerQuery.data?.user_api_key_preview ? `Stored as ${providerQuery.data.user_api_key_preview}` : "No workspace key stored"} /><div className="mt-2 flex gap-2"><input type="password" value={providerKey} onChange={(event) => setProviderKey(event.target.value)} placeholder="Leave blank to keep the saved key" className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-paper px-3 text-sm outline-none focus:border-signal" /><Button type="button" onClick={clearProviderKey} disabled={!providerQuery.data?.has_user_api_key}>Clear</Button></div></label>}<div className="flex items-center gap-3 sm:col-span-2"><Button type="submit" disabled={update.isPending}><Check size={15} /> Save provider</Button>{message && <span className="text-sm text-muted">{message}</span>}</div></form></SettingsSection>;
}

function SettingsSection({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) { return <section id={id} className="scroll-mt-24 border-t border-line pt-6"><div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]"><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted">{description}</p></div><div className="min-w-0">{children}</div></div></section>; }
function FieldLabel({ label, detail }: { label: string; detail?: string }) { return <span className="block"><span className="text-sm font-medium text-ink">{label}</span>{detail && <span className="mt-1 block text-xs text-muted">{detail}</span>}</span>; }
function DefinitionList({ items }: { items: string[][] }) { return <dl className="grid gap-4 sm:grid-cols-3">{items.map(([label, value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-ink">{value}</dd></div>)}</dl>; }
function Button({ children, className = "", danger = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) { return <button {...props} className={`${className} inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "border-fault/40 text-fault hover:bg-fault/5" : "border-line bg-panel text-ink hover:border-signal"}`}>{children}</button>; }
function formatUsage(current?: number, limit?: number) { return `${(current ?? 0).toLocaleString()} / ${(limit ?? 0).toLocaleString()}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); }
