import { Memory } from "@/lib/api";
import { ScoreBadge } from "./ScoreBadge";


export function MemoryCard({ memory, score }: { memory: Memory; score: number }) {
  return (
    <article className="border-t border-line py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Semantic match</span>
        <ScoreBadge score={score} />
      </div>
      <p className="font-serif text-lg leading-8 text-ink">{memory.content}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 font-sans text-[11px] uppercase tracking-[0.12em] text-muted">
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
