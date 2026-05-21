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
        className="absolute right-3 top-3 z-10 inline-flex h-8 items-center gap-2 border border-line bg-paper/90 px-3 font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted shadow-sm backdrop-blur transition hover:border-signal hover:text-signal"
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <pre className={`min-w-0 max-w-full border border-line bg-panel p-4 pt-14 font-mono text-[12px] leading-6 text-ink ${wrap ? "overflow-hidden whitespace-pre-wrap break-words" : "overflow-x-auto"}`}>
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
