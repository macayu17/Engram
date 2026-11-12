"use client";

import { useEffect, useRef, useState } from "react";

import { brainQueries, startNeuralBrain, type BrainHit, type BrainTip } from "@/lib/neural-brain";

export function NeuralBrain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const askRef = useRef<((index: number) => void) | null>(null);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("pick a question, or click any neuron");
  const [hits, setHits] = useState<BrainHit[]>([]);
  const [tip, setTip] = useState<BrainTip | null>(null);
  const [count, setCount] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const brain = startNeuralBrain(canvas, {
      onStatus: setStatus,
      onHit: (hit) => setHits((current) => [...current, hit]),
      onClear: () => setHits([]),
      onTip: setTip,
    });
    if (!brain) return;
    askRef.current = brain.ask;
    setCount(brain.count);
    return () => {
      askRef.current = null;
      brain.stop();
    };
  }, []);

  function ask(index: number) {
    setActive(index);
    askRef.current?.(index);
  }

  return (
    <div className="min-w-0">
      <div className="relative overflow-hidden">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          aria-label="Interactive 3D brain made of artificial neurons. Drag to rotate, click a neuron to fire it."
          className="block h-[380px] w-full cursor-grab touch-pan-y rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot-ink md:h-[470px]"
        />
        {tip && (
          <div
            className="pointer-events-none absolute whitespace-nowrap rounded-sm bg-scene px-2 py-1 font-mono text-[11px] text-scene-ink"
            style={{ left: Math.max(0, tip.x + 14), top: Math.max(0, tip.y - 30) }}
          >
            <b className="mr-1 font-medium text-scene-hot">{tip.title}</b>
            {tip.text}
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-ink-muted">
        <span className="font-mono">ask the brain →</span>
        <span className="flex flex-wrap gap-2">
          {brainQueries.map((query, index) => (
            <button
              key={query.question}
              type="button"
              aria-pressed={active === index}
              onClick={() => ask(index)}
              className="rounded-full border border-line px-3 py-[7px] text-left text-[13px] font-medium text-ink hover:border-ink aria-pressed:border-hot-fill aria-pressed:bg-hot-fill aria-pressed:text-on-hot focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot-ink"
            >
              {query.question}
            </button>
          ))}
        </span>
      </div>
      <div className="mt-3.5 min-h-[124px] border-t border-dashed border-line pt-3" aria-live="polite">
        <p className="mb-2 font-mono text-[11px] text-ink-muted">{status}</p>
        <ol className="m-0 grid list-none gap-1.5 p-0">
          {hits.map((hit) => (
            <li
              key={hit.text}
              className={`grid animate-rise grid-cols-[minmax(0,1fr)_90px_72px] items-center gap-3 text-sm motion-reduce:animate-none ${hit.above ? "text-ink" : "text-ink-muted"}`}
            >
              <span>{hit.text}</span>
              <svg viewBox="0 0 100 5" preserveAspectRatio="none" className="block h-[5px] w-full overflow-hidden rounded-sm" aria-hidden="true">
                <rect width="100" height="5" className="fill-line" />
                <rect width={Math.round(hit.score * 100)} height="5" className={hit.above ? "fill-hot" : "fill-ink-muted"} />
              </svg>
              <em className={`text-right font-mono text-xs not-italic ${hit.above ? "text-hot-ink" : "text-ink-muted"}`}>
                {hit.above ? hit.score.toFixed(2) : "below 0.50"}
              </em>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-2.5 flex flex-wrap justify-between gap-3 font-mono text-[11px] text-ink-muted">
        <span>{count}</span>
        <span>drag to rotate · hover to inspect · click to fire</span>
      </div>
    </div>
  );
}
