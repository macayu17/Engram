import { cn } from "@/lib/cn";

export function ProductPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between", className)}>
      <div>
        {eyebrow && <p className="flex items-center gap-2 font-mono text-xs text-muted"><span className="h-1.5 w-1.5 bg-signal" aria-hidden="true" />{eyebrow}</p>}
        <h1 className="mt-3 font-mono text-[clamp(1.9rem,3vw,2.5rem)] font-normal leading-tight tracking-[-0.04em] text-ink">{title}</h1>
        <p className="mt-3 max-w-2xl text-[1.0625rem] leading-7 text-muted">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
