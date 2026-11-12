"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

type Row = [phase: string, name: string, detail: string, start: number, end: number, kind: "hot" | "ink" | "bg"];

const rows: Row[] = [
  ["recall", "embed the query", "bge-small-en-v1.5 · local", 0, 4, "hot"],
  ["", "score approved memories", "one SQL query", 4, 9, "hot"],
  ["answer", "inject 2 memories", "into the system prompt", 9, 10, "ink"],
  ["", "forward to your provider", "gpt-4o-mini", 10, 820, "ink"],
  ["learn", "extract durable facts", "background job", 900, 2300, "bg"],
  ["", "reconcile and queue", "2 pending · 1 skipped", 2300, 2800, "bg"],
];

const end = 3000;
const returned = 820;
const columns = "grid-cols-[56px_minmax(0,1fr)] lg:grid-cols-[74px_minmax(0,260px)_minmax(0,1fr)]";

function percent(ms: number) {
  return `${(ms / end) * 100}%`;
}

function playbackTime(elapsed: number) {
  if (elapsed < 900) return elapsed * (10 / 900);
  if (elapsed < 2600) return 10 + ((elapsed - 900) / 1700) * 810;
  return 820 + (elapsed - 2600) * 1.1;
}

const barStyles = {
  hot: "bg-hot",
  ink: "bg-ink",
  bg: "bg-[repeating-linear-gradient(135deg,transparent_0_4px,oklch(var(--color-line))_4px_6px)] shadow-[inset_0_0_0_1.5px_oklch(var(--color-ink))]",
};

export function RequestTrace() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ms, setMs] = useState(0);
  const frameRef = useRef(0);
  const doneRef = useRef(false);
  const visibleRef = useRef(false);

  const play = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMs(end);
      doneRef.current = true;
      return;
    }
    doneRef.current = false;
    let start: number | null = null;
    const tick = (now: number) => {
      if (!visibleRef.current) return;
      start ??= now;
      const time = Math.min(end, playbackTime(now - start));
      setMs(time);
      if (time < end) frameRef.current = requestAnimationFrame(tick);
      else doneRef.current = true;
    };
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMs(end);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = visibleRef.current;
        visibleRef.current = entry.isIntersecting;
        if (visibleRef.current && !wasVisible && !doneRef.current) play();
      },
      { threshold: 0.35 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [play]);

  return (
    <div ref={rootRef} className="mt-11 overflow-hidden rounded-lg border border-line bg-card">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line px-[18px] py-3 font-mono text-xs text-ink-muted">
        <span>
          example trace · <b className="font-medium text-ink">&quot;what backend should I use?&quot;</b>
        </span>
        <span className="ml-auto tabular-nums text-hot-ink">{Math.round(ms).toLocaleString("en")} ms</span>
        <button
          type="button"
          onClick={() => {
            visibleRef.current = true;
            play();
          }}
          className="rounded-full border border-line px-2.5 py-0.5 text-[11px] font-medium text-ink-muted hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot-ink"
        >
          replay
        </button>
      </div>
      <div className={cn("relative grid px-[18px] pb-1 pt-2", columns)}>
        {rows.map(([phase, name, detail, start, finish, kind]) => {
          const progress = Math.max(0, Math.min(1, (ms - start) / Math.max(1, finish - start)));
          const continued = !phase;
          const labelOnLeft = finish > end * 0.8;
          return (
            <div key={name} className="contents">
              <div
                className={cn(
                  "col-start-1 pt-[13px] font-mono text-[10px] font-medium uppercase leading-none tracking-[0.08em]",
                  continued ? "text-transparent" : "border-t border-line text-ink-muted",
                )}
              >
                {phase || "·"}
              </div>
              <div
                className={cn(
                  "col-start-2 py-[9px] pr-3 text-[13.5px] transition-colors duration-200",
                  continued ? "border-t border-transparent" : "border-t border-line",
                  ms >= start ? "text-ink" : "text-ink-muted",
                )}
              >
                {name}
                <small className="block font-mono text-[11px] text-ink-muted">{detail}</small>
              </div>
              <div
                className={cn(
                  "relative col-start-2 mb-1.5 h-[22px] lg:col-start-3 lg:mb-0 lg:h-auto",
                  continued ? "lg:border-t lg:border-transparent" : "lg:border-t lg:border-line",
                )}
              >
                <span
                  className={cn("absolute top-1/2 -mt-1.5 h-3 min-w-[3px] origin-left rounded-[3px]", barStyles[kind])}
                  style={{ left: percent(start), width: `max(3px, ${percent(finish - start)})`, transform: `scaleX(${progress})` }}
                />
                <span
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[11px] text-ink-muted transition-opacity",
                    labelOnLeft ? "pr-2" : "pl-2",
                  )}
                  style={{
                    left: labelOnLeft ? "auto" : `calc(${percent(finish)} + 2px)`,
                    right: labelOnLeft ? `${100 - (start / end) * 100}%` : "auto",
                    opacity: progress >= 1 ? 1 : 0,
                  }}
                >
                  {finish - start} ms
                </span>
              </div>
            </div>
          );
        })}
        <div className={cn("pointer-events-none absolute inset-0 hidden px-[18px] lg:grid", columns)} aria-hidden="true">
          <div className="relative col-start-3">
            <div className="absolute inset-y-0 w-px bg-hot-ink" style={{ left: percent(ms) }} />
            <div
              className="absolute inset-y-0 w-0 border-l-[1.5px] border-dashed border-ink transition-opacity"
              style={{ left: percent(returned), opacity: ms >= returned ? 1 : 0 }}
            />
          </div>
        </div>
      </div>
      <p className="m-0 flex flex-wrap gap-3.5 border-t border-dashed border-line px-[18px] pb-4 pt-3 text-[13.5px] text-ink-muted">
        <span className="font-mono text-[11px] text-ink">↑ response returned at 820 ms</span>
        Everything to the right of that line runs in the background. Your user is already reading the answer.
      </p>
    </div>
  );
}
