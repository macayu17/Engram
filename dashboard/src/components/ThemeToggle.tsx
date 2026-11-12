"use client";

import { useSyncExternalStore } from "react";

const storageKey = "engram_theme";
const palettes = ["riso", "cobalt"] as const;
type Palette = (typeof palettes)[number];

function readPalette(): Palette {
  return document.documentElement.dataset.theme === "cobalt" ? "cobalt" : "riso";
}

function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function choose(palette: Palette) {
  if (palette === "cobalt") {
    document.documentElement.dataset.theme = "cobalt";
  } else {
    delete document.documentElement.dataset.theme;
  }
  try {
    localStorage.setItem(storageKey, palette);
  } catch {
    return;
  }
}

export function ThemeToggle() {
  const active = useSyncExternalStore(subscribe, readPalette, () => "riso" as Palette);
  return (
    <span role="group" aria-label="Theme" className="inline-flex shrink-0 rounded-full border border-line p-0.5">
      {palettes.map((palette) => (
        <button
          key={palette}
          type="button"
          aria-pressed={active === palette}
          onClick={() => choose(palette)}
          className="rounded-full px-2.5 py-1 font-mono text-[11px] font-medium text-ink-muted aria-pressed:bg-button aria-pressed:text-on-button focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot-ink"
        >
          {palette}
        </button>
      ))}
    </span>
  );
}
