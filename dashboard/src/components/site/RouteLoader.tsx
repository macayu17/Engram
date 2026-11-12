"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAsciiScene } from "@/components/site/AsciiScene";
import { cn } from "@/lib/cn";

type Phase = "shown" | "fading" | "hidden";

export function RouteLoader() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>("shown");
  const [caption, setCaption] = useState("consolidating memories…");
  const { preRef } = useAsciiScene("torus", { padding: 0, onPaper: true });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("hidden");
      return;
    }
    const first = lastPath.current === null || lastPath.current === pathname;
    lastPath.current = pathname;
    if (!first) {
      setCaption(`recalling ${pathname.split("/")[1] || "home"}…`);
      setPhase("shown");
    }
    const duration = first ? 1100 : 650;
    const fade = window.setTimeout(() => setPhase("fading"), duration);
    const hide = window.setTimeout(() => setPhase("hidden"), duration + 350);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(hide);
    };
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[60] grid place-items-center bg-paper transition-opacity duration-[350ms] motion-reduce:hidden",
        phase === "fading" && "opacity-0",
        phase === "hidden" && "hidden",
      )}
    >
      <div className="w-[min(440px,86vw)] text-center">
        <pre ref={preRef} className="m-0 whitespace-pre font-mono leading-[1.38] text-line" />
        <p className="mt-1.5 font-mono text-xs text-ink-muted">{caption}</p>
      </div>
    </div>
  );
}
