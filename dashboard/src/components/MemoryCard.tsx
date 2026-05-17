import { Memory } from "@/lib/api";
import { ScoreBadge } from "./ScoreBadge";


export function MemoryCard({ memory, score }: { memory: Memory; score: number }) {
  return (
    <article className="rounded border border-line bg-panel p-4 shadow-grid">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-xs uppercase text-zinc-500">semantic match</span>
        <ScoreBadge score={score} />
      </div>
      <p className="text-sm leading-6 text-zinc-100">{memory.content}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs text-zinc-500">
        <span>access {memory.access_count}</span>
        <span className="text-right">{formatDate(memory.created_at)}</span>
      </div>
    </article>
  );
}


function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}
