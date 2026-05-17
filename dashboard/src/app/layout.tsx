import type { Metadata } from "next";
import Link from "next/link";
import { Database, History, Settings } from "lucide-react";

import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engram Dashboard",
  description: "Developer dashboard for Engram memory inspection",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-zinc-100 antialiased">
        <Providers>
          <div className="min-h-screen">
            <header className="border-b border-line bg-panel/80">
              <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <Link href="/" className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded border border-signal/40 bg-signal/10 text-signal">
                    <Database size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-base font-semibold tracking-wide">Engram</span>
                    <span className="block text-xs uppercase text-zinc-500">Memory Control Plane</span>
                  </span>
                </Link>
                <nav className="flex gap-2 text-sm">
                  <Link className="flex items-center gap-2 rounded border border-line px-3 py-2 text-zinc-300 hover:border-signal/50 hover:text-white" href="/">
                    <Database size={16} aria-hidden="true" />
                    Memories
                  </Link>
                  <Link className="flex items-center gap-2 rounded border border-line px-3 py-2 text-zinc-300 hover:border-signal/50 hover:text-white" href="/logs">
                    <History size={16} aria-hidden="true" />
                    Logs
                  </Link>
                  <Link className="flex items-center gap-2 rounded border border-line px-3 py-2 text-zinc-300 hover:border-signal/50 hover:text-white" href="/settings">
                    <Settings size={16} aria-hidden="true" />
                    Settings
                  </Link>
                </nav>
              </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
