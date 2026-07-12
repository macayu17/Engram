import { cn } from "@/lib/cn";


export function ScoreBadge({ score }: { score: number }) {
  const label = score.toFixed(2);
  const strength = score > 0.8 ? "Strong" : score >= 0.6 ? "Moderate" : "Low";
  return (
    <span
      className={cn(
        "inline-flex min-w-14 items-center justify-center gap-1.5 rounded-md border border-current/20 bg-tag px-2 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.08em]",
        score > 0.8 && "text-signal",
        score >= 0.6 && score <= 0.8 && "text-caution",
        score < 0.6 && "text-fault",
      )}
    >
      <span>{strength}</span>
      <span className="font-mono">{label}</span>
    </span>
  );
}
