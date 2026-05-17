import { cn } from "@/lib/cn";


export function ScoreBadge({ score }: { score: number }) {
  const label = score.toFixed(2);
  return (
    <span
      className={cn(
        "inline-flex min-w-14 items-center justify-center rounded bg-tag px-2 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.12em]",
        score > 0.8 && "text-signal",
        score >= 0.6 && score <= 0.8 && "text-caution",
        score < 0.6 && "text-fault",
      )}
    >
      {label}
    </span>
  );
}
