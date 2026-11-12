"use client";

import { useEffect, useRef } from "react";

import { createGrid, paperPalette, scenePalette, scenes, type SceneKey, type SceneState } from "@/lib/ascii-scenes";
import { cn } from "@/lib/cn";

let charWidth: number | null = null;

function measureCharWidth(pre: HTMLPreElement) {
  const probe = document.createElement("span");
  probe.textContent = "M".repeat(50);
  probe.className = "invisible";
  pre.appendChild(probe);
  const width = probe.getBoundingClientRect().width / 50 / parseFloat(getComputedStyle(pre).fontSize);
  probe.remove();
  return width || 0.6;
}

export function useAsciiScene(sceneKey: SceneKey, options: { padding: number; onPaper?: boolean; maxFont?: number }) {
  const preRef = useRef<HTMLPreElement>(null);
  const captionRef = useRef<HTMLSpanElement>(null);
  const { padding, onPaper = false, maxFont = 15 } = options;

  useEffect(() => {
    const pre = preRef.current;
    const container = pre?.parentElement;
    if (!pre || !container) return;
    const scene = scenes[sceneKey];
    const palette = onPaper ? paperPalette : scenePalette;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const grid = createGrid(scene.width, scene.height);
    let state: SceneState = {};
    let start = performance.now();
    let visible = true;
    let frame = 0;
    let last = 0;

    function fit() {
      if (!pre || !container) return;
      const width = container.clientWidth - padding;
      if (width <= 0) return;
      if (!charWidth) charWidth = measureCharWidth(pre);
      pre.style.fontSize = `${Math.min(maxFont, width / (scene.width * charWidth))}px`;
    }

    function draw(time: number) {
      if (!pre) return;
      grid.clear();
      scene.frame(grid, time, state);
      pre.innerHTML = grid.html(palette);
      if (captionRef.current) captionRef.current.textContent = scene.caption(time, state);
    }

    function loop(now: number) {
      frame = requestAnimationFrame(loop);
      if (!visible || now - last < 45) return;
      last = now;
      draw((now - start) % scene.loop);
    }

    fit();
    draw(scene.loop * (reduce ? 0.72 : 0.7));
    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      const wasVisible = visible;
      visible = entry.isIntersecting;
      if (visible && !wasVisible) {
        start = performance.now();
        state = {};
      }
    });
    intersectionObserver.observe(container);
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (cancelled) return;
      charWidth = null;
      fit();
    });
    if (!reduce) frame = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [sceneKey, padding, onPaper, maxFont]);

  return { preRef, captionRef };
}

export function AsciiScene({ scene, label, className }: { scene: SceneKey; label: string; className?: string }) {
  const { preRef, captionRef } = useAsciiScene(scene, { padding: 36 });
  return (
    <figure className={cn("m-0 min-w-0", className)}>
      <div className="overflow-hidden rounded-lg border border-scene-line bg-scene p-[18px] transition-colors duration-300">
        <pre ref={preRef} role="img" aria-label={label} className="m-0 whitespace-pre font-mono leading-[1.38] text-scene-dim" />
      </div>
      <figcaption className="mt-2.5 font-mono text-[11px] text-ink-muted">
        <span ref={captionRef} />
      </figcaption>
    </figure>
  );
}
