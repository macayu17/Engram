"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

const memories = [
  { name: "prefers fastapi", meaning: 0.71, keywords: 0.55, recency: 0.05 },
  { name: "uses postgres + pgvector", meaning: 0.69, keywords: 0.45, recency: 0.03 },
  { name: "typescript on the frontend", meaning: 0.52, keywords: 0.1, recency: 0.04 },
  { name: "building sentinel", meaning: 0.41, keywords: 0, recency: 0.06 },
  { name: "lives in berlin", meaning: 0.14, keywords: 0, recency: 0.01 },
];

const scaleMax = 1.3;
const rowHeight = 40;

function percent(value: number) {
  return `${(value / scaleMax) * 100}%`;
}

const sliders = [
  { id: "kw", label: "keyword weight", min: 0, max: 1, step: 0.05 },
  { id: "th", label: "threshold", min: 0, max: 0.9, step: 0.05 },
  { id: "win", label: "near-top window", min: 0.02, max: 0.5, step: 0.02 },
] as const;

type SliderId = (typeof sliders)[number]["id"];

const legend = [
  ["meaning", "h-2 w-2.5 bg-ink"],
  ["keywords", "h-2 w-2.5 bg-hot"],
  ["recency", "h-2 w-2.5 bg-ink-muted/55"],
  ["threshold", "h-2.5 w-0 border-l-[1.5px] border-dashed border-ink"],
  ["injected window", "h-2 w-2.5 bg-tint shadow-[inset_0_0_0_1px_oklch(var(--color-line))]"],
];

export function RankingTuner() {
  const [values, setValues] = useState<Record<SliderId, number>>({ kw: 0.3, th: 0.3, win: 0.08 });
  const scored = memories.map((memory) => ({ ...memory, score: memory.meaning + values.kw * memory.keywords + memory.recency }));
  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const top = ranked[0].score;
  const windowStart = Math.max(values.th, top - values.win);

  return (
    <div className="mt-2 rounded-lg border border-line bg-card p-[18px]">
      <div className="mb-4 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1.5">
        {sliders.map((slider) => (
          <div key={slider.id} className="contents">
            <label htmlFor={`tuner-${slider.id}`} className="whitespace-nowrap font-mono text-xs text-ink-muted">
              {slider.label}
              <output htmlFor={`tuner-${slider.id}`} className="ml-1.5 tabular-nums text-hot-ink">
                {values[slider.id].toFixed(2)}
              </output>
            </label>
            <input
              id={`tuner-${slider.id}`}
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={values[slider.id]}
              onChange={(event) => setValues((current) => ({ ...current, [slider.id]: Number(event.target.value) }))}
              className="w-full accent-hot-fill focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot-ink"
            />
          </div>
        ))}
      </div>
      <div className="relative" style={{ height: memories.length * rowHeight }}>
        {scored.map((memory) => {
          const rank = ranked.indexOf(memory);
          const injected = memory.score >= values.th && memory.score >= top - values.win;
          const reason = injected ? "injected" : memory.score < values.th ? "below threshold" : "outside the window";
          return (
            <div
              key={memory.name}
              className="absolute inset-x-0 grid h-10 grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_44px] items-center gap-3 text-[13.5px] transition-[top] duration-[450ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              style={{ top: rank * rowHeight }}
            >
              <div className="min-w-0 truncate">
                {memory.name}
                <small className={cn("block font-mono text-[10.5px]", injected ? "text-hot-ink" : "text-ink-muted")}>{reason}</small>
              </div>
              <div className={cn("relative h-3.5", !injected && "[&>.seg]:opacity-35")}>
                <span className="absolute -inset-y-1 bg-tint transition-all duration-300" style={{ left: percent(windowStart), width: percent(Math.max(0, top - windowStart)) }} />
                <span className="seg absolute top-0.5 h-2.5 rounded-l-sm bg-ink transition-all duration-300" style={{ left: 0, width: percent(memory.meaning) }} />
                <span className="seg absolute top-0.5 h-2.5 bg-hot transition-all duration-300" style={{ left: percent(memory.meaning), width: percent(values.kw * memory.keywords) }} />
                <span
                  className="seg absolute top-0.5 h-2.5 rounded-r-sm bg-ink-muted/55 transition-all duration-300"
                  style={{ left: percent(memory.meaning + values.kw * memory.keywords), width: percent(memory.recency) }}
                />
                <span className="absolute -inset-y-1 w-0 border-l-[1.5px] border-dashed border-ink transition-all duration-300" style={{ left: percent(values.th) }} />
              </div>
              <div className={cn("text-right font-mono text-xs tabular-nums", injected && "text-hot-ink")}>{memory.score.toFixed(2)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3.5 flex flex-wrap gap-x-3.5 gap-y-1.5 font-mono text-[11px] text-ink-muted">
        {legend.map(([label, swatch]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <i className={cn("inline-block", swatch)} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
      <p className="mt-2.5 font-mono text-[11px] text-ink-muted">golden set · recall@5 0.969 · precision 0.745 · 1.8 injected per query</p>
    </div>
  );
}
