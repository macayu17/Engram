"use client";

import { Moon, Sun } from "lucide-react";
import { MouseEvent, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { cn } from "@/lib/cn";

type ThemeMode = "dark" | "light";

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => { finished: Promise<void> };
};

const storageKey = "engram_theme";
const transitionClassName = "theme-transition-active";
const viewTransitionClassName = "theme-view-transition-active";

function readStoredTheme(): ThemeMode {
  const storedTheme = localStorage.getItem(storageKey);
  return storedTheme === "light" ? "light" : "dark";
}

function applyTheme(themeMode: ThemeMode) {
  document.documentElement.dataset.theme = themeMode;
  localStorage.setItem(storageKey, themeMode);
}

export function ThemeToggle() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [fallbackWave, setFallbackWave] = useState<{ id: number; themeMode: ThemeMode } | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const fallbackWaveId = useRef(0);
  const fallbackTimers = useRef<number[]>([]);
  const transitionInFlight = useRef(false);

  useEffect(() => {
    const storedTheme = readStoredTheme();
    setThemeMode(storedTheme);
    applyTheme(storedTheme);
  }, []);

  useEffect(() => {
    return () => {
      fallbackTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function switchTheme(nextThemeMode: ThemeMode) {
    setThemeMode(nextThemeMode);
    applyTheme(nextThemeMode);
  }

  function completeTransition() {
    const root = document.documentElement;
    root.classList.remove(transitionClassName, viewTransitionClassName);
    transitionInFlight.current = false;
    setIsTransitioning(false);
  }

  function handleToggle(event: MouseEvent<HTMLButtonElement>) {
    if (transitionInFlight.current) return;

    const nextThemeMode = themeMode === "dark" ? "light" : "dark";
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const farthestX = Math.max(x, window.innerWidth - x);
    const farthestY = Math.max(y, window.innerHeight - y);
    const radius = Math.ceil(Math.hypot(farthestX, farthestY));
    const root = document.documentElement;

    root.style.setProperty("--theme-wave-x", `${x}px`);
    root.style.setProperty("--theme-wave-y", `${y}px`);
    root.style.setProperty("--theme-wave-radius", `${radius}px`);
    root.style.setProperty("--theme-fallback-left", `${x - radius}px`);
    root.style.setProperty("--theme-fallback-top", `${y - radius}px`);
    root.style.setProperty("--theme-fallback-size", `${radius * 2}px`);
    root.classList.add(transitionClassName);
    transitionInFlight.current = true;
    setIsTransitioning(true);

    const transitionDocument = document as ViewTransitionDocument;
    if (transitionDocument.startViewTransition) {
      root.classList.add(viewTransitionClassName);
      const transition = transitionDocument.startViewTransition(() => {
        flushSync(() => switchTheme(nextThemeMode));
      });
      void transition.finished.finally(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(completeTransition);
        });
      });
      return;
    }

    const id = fallbackWaveId.current + 1;
    fallbackWaveId.current = id;
    setFallbackWave({ id, themeMode: nextThemeMode });
    const switchTimer = window.setTimeout(() => switchTheme(nextThemeMode), 620);
    const cleanupTimer = window.setTimeout(() => {
      setFallbackWave((wave) => (wave?.id === id ? null : wave));
      completeTransition();
    }, 820);
    fallbackTimers.current = [switchTimer, cleanupTimer];
  }

  const isDark = themeMode === "dark";
  const nextThemeMode = isDark ? "light" : "dark";

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isTransitioning}
        aria-label={`Switch to ${nextThemeMode} mode`}
        title={`Switch to ${nextThemeMode} mode`}
        className="relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border border-line bg-tag p-1 transition hover:border-signal disabled:cursor-default disabled:opacity-80"
      >
        <span
          className={cn(
            "absolute left-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-paper text-signal transition-transform duration-300",
            isDark && "translate-x-7",
          )}
        >
          {isDark ? <Moon size={14} aria-hidden="true" /> : <Sun size={14} aria-hidden="true" />}
        </span>
        <span className="flex w-full items-center justify-between px-1 text-muted">
          <Sun size={12} aria-hidden="true" />
          <Moon size={12} aria-hidden="true" />
        </span>
      </button>
      {fallbackWave && (
        <span
          aria-hidden="true"
          className={cn(
            "theme-fallback-wave pointer-events-none fixed z-[100] rounded-full",
            fallbackWave.themeMode === "light" ? "theme-fallback-wave-light" : "theme-fallback-wave-dark",
          )}
        />
      )}
    </>
  );
}
