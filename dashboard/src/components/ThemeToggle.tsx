"use client";

import { SunMoon } from "lucide-react";

const storageKey = "engram_theme";

function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      return;
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle colour theme"
      title="Toggle colour theme"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-tag hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
    >
      <SunMoon size={17} strokeWidth={1.6} aria-hidden="true" />
    </button>
  );
}
