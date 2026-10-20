"use client";

import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

import { api, setActiveNamespace } from "@/lib/api";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { useNamespace } from "@/lib/useNamespace";

export function NamespaceSelector() {
  const apiKey = useActiveApiKey();
  const namespace = useNamespace();
  const [project, setProject] = useState("");
  const projects = useQuery({
    queryKey: ["namespaces", apiKey, namespace],
    queryFn: api.memories.namespaces,
    enabled: Boolean(apiKey),
  });
  const names = [
    ...new Set([
      "default",
      "personal",
      namespace,
      ...(projects.data?.namespaces.map((item) => item.name) ?? []),
    ]),
  ];
  function selectProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(project.trim())) {
      setActiveNamespace(project.trim());
      setProject("");
    }
  }
  return (
    <div className="mb-8 flex flex-wrap items-center gap-4 border-b border-line pb-4 font-sans text-sm">
      <label className="flex items-center gap-2 text-muted">
        Project
        <select
          aria-label="Active project"
          value={namespace}
          onChange={(event) => setActiveNamespace(event.target.value)}
          className="min-h-10 rounded border border-line bg-panel px-3 text-ink focus-visible:outline-signal"
        >
          {names.map((name) => (
            <option key={name} value={name}>
              {name === "personal" ? "Personal" : name}
            </option>
          ))}
        </select>
      </label>
      <form onSubmit={selectProject} className="flex gap-2">
        <input
          aria-label="New project name"
          value={project}
          onChange={(event) => setProject(event.target.value)}
          pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}"
          maxLength={80}
          placeholder="Project name"
          className="min-h-10 w-36 rounded border border-line bg-panel px-3 text-ink focus-visible:outline-signal"
        />
        <button
          disabled={!project.trim()}
          className="min-h-10 px-2 text-muted hover:text-ink disabled:opacity-40"
        >
          Switch
        </button>
      </form>
      <span className="text-xs text-muted">
        {namespace === "personal"
          ? "Personal memories are shared only when explicitly included in search."
          : "Memories and retrievals stay within this project."}
      </span>
    </div>
  );
}
