import { Database } from "lucide-react";


export function EngramLogo() {
  return (
    <span className="inline-flex items-center gap-2.5 text-ink">
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-tag text-signal"><Database size={16} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className="text-base font-semibold">Engram</span>
    </span>
  );
}
