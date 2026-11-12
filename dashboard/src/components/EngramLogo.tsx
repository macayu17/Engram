const dots = [
  [4, 4],
  [20, 4],
  [12, 12],
  [4, 20],
  [12, 20],
  [20, 20],
];

export function EngramLogo() {
  return (
    <span className="inline-flex items-center gap-[9px] text-ink">
      <svg className="h-[22px] w-[22px] overflow-visible" viewBox="0 0 24 24" aria-hidden="true">
        {dots.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.2" className="fill-ink opacity-30" />
        ))}
        <polyline
          points="4,12 12,4 20,12"
          pathLength={24}
          strokeDasharray={24}
          className="fill-none stroke-ink motion-safe:animate-trace-draw [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]"
        />
        <circle cx="4" cy="12" r="2" className="fill-ink" />
        <circle cx="12" cy="4" r="2" className="fill-ink" />
        <circle cx="20" cy="12" r="2.7" className="origin-center fill-hot [transform-box:fill-box] motion-safe:animate-trace-hit" />
      </svg>
      <span className="font-mono text-base font-medium leading-none tracking-[-0.04em]">engram</span>
    </span>
  );
}
