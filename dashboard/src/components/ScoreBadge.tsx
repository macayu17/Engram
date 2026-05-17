import { cn } from "@/lib/cn";


export function ScoreBadge({ score }: { score: number }) {
  const label = score.toFixed(2);
  return (
    <span
      className={cn(
        "inline-flex min-w-14 items-center justify-center rounded border px-2 py-1 font-mono text-xs",
        score > 0.8 && "border-signal/40 bg-signal/10 text-signal",
        score >= 0.6 && score <= 0.8 && "border-caution/40 bg-caution/10 text-caution",
        score < 0.6 && "border-fault/40 bg-fault/10 text-fault",
      )}
    >
      {label}
    </span>
  );
}
