export function EngramLogo() {
  return (
    <span className="inline-flex items-center gap-2.5 text-ink">
      <svg className="h-5 w-5" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="0.75" y="0.75" width="18.5" height="18.5" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
        <rect x="5" y="5" width="10" height="10" fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.5" />
        <rect x="8" y="8" width="4" height="4" className="fill-signal" />
      </svg>
      <span className="font-mono text-[0.95rem] tracking-[-0.03em]">engram</span>
    </span>
  );
}
