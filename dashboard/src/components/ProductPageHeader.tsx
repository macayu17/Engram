import { cn } from "@/lib/cn";

export function ProductPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between", className)}>
      <div>
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-signal">{eyebrow}</p>
        <h1 className="mt-3 text-balance font-serif text-[clamp(2.75rem,5vw,4rem)] font-semibold leading-[1.02] text-ink">{title}</h1>
        <p className="mt-4 max-w-2xl text-pretty font-serif text-lg leading-8 text-muted">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
