export const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot-ink";

const buttonBase = `inline-flex items-center gap-2 rounded-md border font-sans font-semibold no-underline transition-[transform,background-color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] motion-reduce:active:scale-100 ${focusRing}`;

export const button = {
  hot: `${buttonBase} border-transparent bg-hot-fill px-4 py-2.5 text-sm leading-5 text-on-hot`,
  ink: `${buttonBase} border-transparent bg-button px-4 py-2.5 text-sm leading-5 text-on-button`,
  line: `${buttonBase} border-line bg-transparent px-4 py-2.5 text-sm leading-5 text-ink hover:border-ink`,
  inkSmall: `${buttonBase} border-transparent bg-button px-3 py-1.5 text-[13px] leading-5 text-on-button`,
  lineSmall: `${buttonBase} border-line bg-transparent px-3 py-1.5 text-[13px] leading-5 text-ink hover:border-ink`,
};

export const eyebrow =
  "inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-ink-muted before:h-1.5 before:w-1.5 before:bg-hot before:content-['']";

export const displayXl = "mb-5 mt-[18px] font-display text-[clamp(46px,6.4vw,76px)] font-normal leading-none tracking-[-0.025em] [&_em]:text-hot-ink";

export const displayLg = "mb-4 mt-3.5 font-display text-[clamp(34px,4.4vw,52px)] font-normal leading-[1.04] tracking-[-0.02em] [&_em]:text-hot-ink";

export const lead = "mb-[26px] max-w-[34em] text-lg leading-[1.55] text-ink-muted [&_b]:font-medium [&_b]:text-ink";

export const highlight = "bg-tint px-[0.12em] shadow-[inset_0_-2px_0_oklch(var(--color-hot))] [box-decoration-break:clone]";

export const pageWrap = "mx-auto max-w-[1200px] px-4";

export const band = "border-t border-line py-16 md:py-[88px]";
