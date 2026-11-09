"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function DocsCodeBlock({ children, wrap = false }: { children: string; wrap?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);

    const didCopy = fallbackCopy(children);

    if (didCopy) {
      navigator.clipboard?.writeText(children).catch(() => undefined);
      return;
    }

    try {
      await navigator.clipboard.writeText(children);
    } catch {
      return;
    }
  }

  return (
    <div className="group relative min-w-0 max-w-full">
      <button
        type="button"
        onClick={copyCode}
        title={copied ? "Copied" : "Copy code"}
        aria-label={copied ? "Copied code" : "Copy code"}
        className="absolute right-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-sm bg-tag px-3 text-xs text-muted transition-colors hover:text-ink"
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <pre className={`min-w-0 max-w-full rounded-2xl border border-line bg-panel p-5 pt-14 font-mono text-[12.5px] leading-6 text-ink ${wrap ? "overflow-hidden whitespace-pre-wrap break-words" : "overflow-x-auto"}`}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

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

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        fallbackCopy(command);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      className="group inline-flex min-h-11 items-center gap-3 border border-line bg-panel/60 px-4 font-mono text-[13px] text-ink transition-colors hover:border-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
    >
      <span className="h-1.5 w-1.5 bg-signal" aria-hidden="true" />
      <span>{command}</span>
      <span className="ml-2 border-l border-line pl-3 text-muted transition-colors group-hover:text-ink">
        {copied ? <Check size={14} aria-label="Copied" /> : <Copy size={14} aria-label="Copy command" />}
      </span>
    </button>
  );
}
