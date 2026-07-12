import { ArrowRight, Check } from "lucide-react";


const memories = [
  { score: "0.91", content: "Prefers FastAPI for Python backends" },
  { score: "0.84", content: "Uses TypeScript for frontend work" },
];

export function RetrievalTrace() {
  return (
    <figure className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-line bg-panel/35 shadow-[0_20px_70px_rgb(var(--color-ink)_/_0.07)]">
      <figcaption className="flex items-center justify-between border-b border-line px-4 py-3 font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted sm:px-5">
        <span>Retrieval trace</span>
        <span className="flex items-center gap-1.5 text-signal">
          <Check size={12} aria-hidden="true" />
          Context ready
        </span>
      </figcaption>

      <div className="p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-[7.5rem_1fr] sm:gap-5">
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted">01 · Query</p>
          <p className="min-w-0 break-words font-serif text-base leading-6 text-ink">What stack should I use for the new API?</p>
        </div>

        <div className="my-4 flex items-center gap-3 text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <ArrowRight size={13} />
          <span className="h-px w-8 bg-signal/50" />
        </div>

        <div className="grid gap-3 sm:grid-cols-[7.5rem_1fr] sm:gap-5">
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted">02 · Ranked memories</p>
          <ol className="space-y-2">
            {memories.map((memory) => (
              <li key={memory.content} className="grid grid-cols-[2.75rem_1fr] gap-3 border-b border-line/70 pb-2 last:border-0 last:pb-0">
                <span className="font-mono text-[11px] font-semibold tabular-nums text-signal">{memory.score}</span>
                <span className="min-w-0 break-words font-serif text-sm leading-5 text-ink/85">{memory.content}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="my-4 flex items-center gap-3 text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <ArrowRight size={13} />
          <span className="h-px w-8 bg-signal/50" />
        </div>

        <div className="grid gap-2 sm:grid-cols-[7.5rem_1fr] sm:gap-5">
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.12em] text-muted">03 · Injected context</p>
          <div className="min-w-0 break-words border-l-2 border-signal/60 pl-3 font-mono text-[11px] leading-5 text-muted">
            <p>[MEMORY CONTEXT]</p>
            <p>FastAPI backend · TypeScript frontend</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-line bg-tag/20 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.1em] text-muted sm:px-5">
        <span>vector search</span>
        <span className="text-center">2 matches</span>
        <span className="text-right">12ms</span>
      </div>
    </figure>
  );
}
