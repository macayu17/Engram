import Link from "next/link";

import { MarketingHeader } from "@/components/MarketingHeader";


export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <MarketingHeader />
      <main>{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Engram memory infrastructure</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/docs" className="hover:text-ink">Docs</Link>
            <Link href="/pricing" className="hover:text-ink">Pricing</Link>
            <a href="https://github.com/macayu17/engram" className="hover:text-ink">GitHub</a>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
