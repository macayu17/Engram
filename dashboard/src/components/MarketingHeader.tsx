import Link from "next/link";

import { EngramLogo } from "./EngramLogo";
import { ThemeToggle } from "./ThemeToggle";


export function MarketingHeader() {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
  return (
    <header className="border-b border-line bg-paper/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Engram home"><EngramLogo /></Link>
        <nav aria-label="Primary" className="flex items-center gap-2 sm:gap-5">
          <Link href="/docs" className="hidden text-sm text-muted hover:text-ink sm:inline">Docs</Link>
          <Link href="/pricing" className="hidden text-sm text-muted hover:text-ink sm:inline">Pricing</Link>
          <a href="https://github.com/macayu17/engram" className="hidden text-sm text-muted hover:text-ink md:inline">GitHub</a>
          {authEnabled && <Link href="/sign-in" className="text-sm font-medium text-ink hover:text-signal">Sign in</Link>}
          {authEnabled && <Link href="/sign-up" className="rounded-md bg-signal px-3 py-2 text-sm font-semibold text-white hover:bg-signal/90">Start free</Link>}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
