"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

const pill =
  "rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot-ink";

function fallbackCopy(value: string) {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.className = "fixed left-[-9999px] top-0";
  document.body.appendChild(textArea);
  textArea.select();
  const didCopy = document.execCommand("copy");
  textArea.remove();
  return didCopy;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return fallbackCopy(value);
  }
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy: async (value: string) => {
      if (await copyText(value)) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }
    },
  };
}

function renderLine(text: string, accent?: string) {
  if (text.trimStart().startsWith("#")) return <span className="text-scene-muted">{text}</span>;
  if (!accent || !text.includes(accent)) return text;
  const [before, ...rest] = text.split(accent);
  return (
    <>
      {before}
      <span className="text-scene-hot">{accent}</span>
      {rest.join(accent)}
    </>
  );
}

export function CodeBlock({
  title = "terminal",
  code,
  accent,
  copyable = true,
  className,
}: {
  title?: string;
  code: string;
  accent?: string;
  copyable?: boolean;
  className?: string;
}) {
  const { copied, copy } = useCopy();
  const lines = code.split("\n");
  const copyValue = lines.filter((text) => !text.trimStart().startsWith("#")).join("\n").trim();
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-md bg-scene text-scene-ink transition-colors duration-300", className)}>
      <div className="flex items-center justify-between border-b border-scene-ink/15 px-3 py-2 font-mono text-[11px] text-scene-muted">
        <span>{title}</span>
        {copyable && (
          <button type="button" onClick={() => void copy(copyValue)} className={cn(pill, "border-scene-ink/25 text-scene-muted hover:text-scene-ink")}>
            {copied ? "copied" : "copy"}
          </button>
        )}
      </div>
      <pre className="m-0 overflow-x-auto p-3.5 font-mono text-[12.5px] leading-[1.65]">
        {lines.map((text, index) => (
          <span key={index}>
            {renderLine(text, accent)}
            {index < lines.length - 1 && "\n"}
          </span>
        ))}
      </pre>
    </div>
  );
}

export function InstallChip({ command }: { command: string }) {
  const { copied, copy } = useCopy();
  return (
    <span className="inline-flex items-center gap-3 rounded-full border border-line bg-card py-1.5 pl-4 pr-1.5 font-mono text-[13px] leading-5">
      <span>
        <i className="not-italic text-hot-ink">$</i> {command}
      </span>
      <button type="button" onClick={() => void copy(command)} className={cn(pill, "border-line text-ink-muted hover:border-ink hover:text-ink")}>
        {copied ? "copied" : "copy"}
      </button>
    </span>
  );
}
