"use client";

import gsap from "gsap";
import { useLayoutEffect, useRef, useState } from "react";

import { copy } from "./copy";

export function Loader() {
  const [mounted, setMounted] = useState(false);
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const line = lineRef.current;
    const counter = counterRef.current;
    if (!mounted || !root || !line || !counter) return;

    const context = gsap.context(() => {
      const progress = { value: 0 };
      gsap
        .timeline({
          defaults: { ease: "power2.inOut" },
          onComplete: () => {
            window.dispatchEvent(new CustomEvent("landing:enter"));
            setDone(true);
          },
        })
        .to(progress, {
          value: 100,
          duration: 0.85,
          onUpdate: () => {
            counter.textContent = String(Math.round(progress.value)).padStart(3, "0") + "%";
          },
        })
        .to(line, { scaleX: 1, duration: 0.5, ease: "power3.inOut" }, "-=0.55")
        .to(root, { clipPath: "inset(0 0 100% 0)", duration: 0.45, ease: "power3.inOut", delay: 0.1 });
    }, root);

    return () => context.revert();
  }, [mounted]);

  if (!mounted || done) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="fixed inset-0 z-[60] flex flex-col justify-between bg-lp text-li"
      style={{ clipPath: "inset(0 0 0% 0)" }}
    >
      <div className="flex items-start justify-between p-5 sm:p-6">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em]">{copy.loader.brand}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-lm">MEMORY LAYER</span>
      </div>
      <div ref={lineRef} className="absolute left-0 top-[78vh] h-px w-full origin-left scale-x-0 bg-li" />
      <div className="flex items-end justify-between p-5 sm:p-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-lm">
          {copy.loader.status} <span ref={counterRef} className="text-li tabular-nums">000%</span>
        </span>
      </div>
    </div>
  );
}
