export function EngramLogo() {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded border border-line bg-tag text-ink transition-colors group-hover:border-signal">
        <svg className="h-7 w-7" viewBox="0 0 40 40" role="presentation">
          <path className="text-muted" d="M12 10v20" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <path className="text-ink" d="M12 10h12M12 20h9M12 30h13" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
          <path className="text-signal" d="M24 10c4.6 0 7 2.4 8.5 5M21 20h12M25 30c4.4 0 6.6-2.2 8-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
          <circle className="text-signal" cx="33" cy="15" r="2.2" fill="currentColor" />
          <circle className="text-signal" cx="33" cy="20" r="1.7" fill="currentColor" />
          <circle className="text-muted" cx="33" cy="25" r="1.8" fill="currentColor" />
        </svg>
      </span>
      <span className="font-serif text-lg leading-none">
        <span className="text-ink">En</span>
        <span className="italic text-signal">gram</span>
      </span>
    </span>
  );
}
