"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";

const storageKey = "engram_theme";

function readStoredTheme(): ThemeMode {
  const storedTheme = localStorage.getItem(storageKey);
  return storedTheme === "dark" ? "dark" : "light";
}

function applyTheme(themeMode: ThemeMode) {
  document.documentElement.dataset.theme = themeMode;
  localStorage.setItem(storageKey, themeMode);
}

export function ThemeToggle() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const storedTheme = readStoredTheme();
    setThemeMode(storedTheme);
    applyTheme(storedTheme);
  }, []);

  function handleToggle() {
    const nextThemeMode = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextThemeMode);
    applyTheme(nextThemeMode);
  }

  const isDark = themeMode === "dark";
  const nextThemeMode = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={`Switch to ${nextThemeMode} mode`}
      title={`Switch to ${nextThemeMode} mode`}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-panel text-muted transition-colors hover:border-signal hover:text-signal active:translate-y-px"
    >
      {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}
