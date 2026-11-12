"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

type EdgeId = "root" | "add" | "llm" | "update" | "conflict" | "skip";
type LeafId = "add" | "update" | "conflict" | "skip";

const edges: Record<EdgeId, string> = {
  root: "M280 62 V112",
  add: "M280 136 C280 190 90 190 90 262",
  llm: "M280 136 C280 160 390 150 390 186",
  update: "M390 210 C390 240 270 236 270 262",
  conflict: "M390 210 V262",
  skip: "M390 210 C390 240 505 236 505 262",
};

const leaves: { id: LeafId; x: number; width: number; title: string; detail: string }[] = [
  { id: "add", x: 30, width: 120, title: "add", detail: "pending review" },
  { id: "update", x: 215, width: 110, title: "update", detail: "as a revision" },
  { id: "conflict", x: 335, width: 110, title: "conflict", detail: "you pick" },
  { id: "skip", x: 455, width: 100, title: "skip", detail: "redundant" },
];

const examples: { fact: string; near: string; path: EdgeId[]; leaf: LeafId; outcome: string; before: string; after: string }[] = [
  {
    fact: '"i always build python apis with fastapi"',
    near: "nearest memory · cosine 0.31",
    path: ["root", "add"],
    leaf: "add",
    before: "Nothing similar is stored yet, so it is ",
    outcome: "added",
    after: " and waits in the review queue.",
  },
  {
    fact: '"sentinel is a market simulator, not a bot"',
    near: "nearest memory · cosine 0.82",
    path: ["root", "llm", "update"],
    leaf: "update",
    before: 'Close to "building a trading bot called Sentinel". Proposed as an ',
    outcome: "update",
    after: "; the old version stays restorable.",
  },
  {
    fact: '"walk me through it in detail this time"',
    near: "nearest memory · cosine 0.74",
    path: ["root", "llm", "conflict"],
    leaf: "conflict",
    before: 'Contradicts "wants short answers". Flagged as a ',
    outcome: "conflict",
    after: ": use the new one, keep the old, or keep both.",
  },
  {
    fact: '"yeah I use FastAPI"',
    near: "nearest memory · cosine 0.93",
    path: ["root", "llm", "skip"],
    leaf: "skip",
    before: 'Already known as "prefers fastapi". ',
    outcome: "Skipped",
    after: " as redundant.",
  },
];

export function ReconcileFlow() {
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const pathRefs = useRef<Partial<Record<EdgeId, SVGPathElement | null>>>({});
  const [exampleIndex, setExampleIndex] = useState(0);
  const [litEdges, setLitEdges] = useState<EdgeId[]>([]);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let timer = 0;
    let visible = false;
    let next = 1;

    function run(index: number) {
      cancelAnimationFrame(frame);
      const example = examples[index];
      setExampleIndex(index);
      setLitEdges([]);
      setArrived(false);
      let segment = 0;
      let start: number | null = null;
      const step = (now: number) => {
        start ??= now;
        const edge = example.path[segment];
        const path = pathRefs.current[edge];
        if (!path) return;
        const progress = Math.min(1, (now - start) / (reduce ? 1 : 520));
        const point = path.getPointAtLength(path.getTotalLength() * progress);
        dotRef.current?.setAttribute("cx", String(point.x));
        dotRef.current?.setAttribute("cy", String(point.y));
        setLitEdges(example.path.slice(0, segment + 1));
        if (progress < 1) {
          frame = requestAnimationFrame(step);
          return;
        }
        segment++;
        start = null;
        if (segment < example.path.length) {
          frame = requestAnimationFrame(step);
          return;
        }
        setArrived(true);
      };
      frame = requestAnimationFrame(step);
    }

    function loop() {
      if (!visible) {
        timer = 0;
        return;
      }
      run(next);
      next = (next + 1) % examples.length;
      timer = window.setTimeout(loop, 3600);
    }

    if (reduce) {
      run(1);
      return () => cancelAnimationFrame(frame);
    }
    run(0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !timer) timer = window.setTimeout(loop, 1200);
      },
      { threshold: 0.3 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  const example = examples[exampleIndex];

  return (
    <div ref={rootRef} className="mt-1.5">
      <svg
        viewBox="0 0 560 330"
        role="img"
        aria-label="How a new fact is reconciled: compared with the nearest memory, then added, proposed as an update, flagged as a conflict, or skipped."
        className="block h-auto w-full overflow-visible"
      >
        {(Object.keys(edges) as EdgeId[]).map((id) => (
          <path
            key={id}
            ref={(node) => {
              pathRefs.current[id] = node;
            }}
            d={edges[id]}
            className={cn(
              "fill-none transition-[stroke] duration-300",
              litEdges.includes(id) ? "stroke-hot [stroke-width:2.5]" : "stroke-line [stroke-width:1.5]",
            )}
          />
        ))}
        <rect x="40" y="14" width="480" height="48" rx="6" className="fill-scene" />
        <text x="280" y="44" textAnchor="middle" className="fill-scene-ink font-mono text-[14px]">
          {example.fact}
        </text>
        <rect x="170" y="112" width="220" height="24" rx="12" className="fill-card stroke-line" />
        <text x="280" y="128" textAnchor="middle" className="fill-ink font-mono text-[11px]">
          {example.near}
        </text>
        <text x="150" y="182" textAnchor="middle" className="fill-ink-muted font-mono text-[10.5px]">
          below 0.6
        </text>
        <text x="430" y="160" className="fill-ink-muted font-mono text-[10.5px]">
          0.6 or above
        </text>
        <rect x="320" y="186" width="140" height="24" rx="12" className="fill-card stroke-line" />
        <text x="390" y="202" textAnchor="middle" className="fill-ink font-mono text-[11px]">
          one model call decides
        </text>
        {leaves.map((leaf) => {
          const on = arrived && example.leaf === leaf.id;
          return (
            <g key={leaf.id}>
              <rect
                x={leaf.x}
                y="262"
                width={leaf.width}
                height="54"
                rx="6"
                className={cn("transition-colors duration-300 [stroke-width:1.2]", on ? "fill-hot-fill stroke-hot-fill" : "fill-card stroke-line")}
              />
              <text x={leaf.x + leaf.width / 2} y="284" textAnchor="middle" className={cn("font-display text-[17px] font-medium", on ? "fill-on-hot" : "fill-ink")}>
                {leaf.title}
              </text>
              <text x={leaf.x + leaf.width / 2} y="303" textAnchor="middle" className={cn("font-mono text-[10.5px]", on ? "fill-on-hot" : "fill-ink-muted")}>
                {leaf.detail}
              </text>
            </g>
          );
        })}
        <circle ref={dotRef} r="5" cx="280" cy="62" className="fill-hot" />
      </svg>
      <p className="mt-3 min-h-[3em] font-mono text-xs text-ink-muted" aria-live="polite">
        {arrived && (
          <>
            {example.before}
            <b className="font-medium text-hot-ink">{example.outcome}</b>
            {example.after}
          </>
        )}
      </p>
    </div>
  );
}
