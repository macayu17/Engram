import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthControls } from "@/components/AuthControls";
import { ClerkEngramBridge } from "@/components/ClerkEngramBridge";
import { CommandPalette } from "@/components/CommandPalette";
import { EngramLogo } from "@/components/EngramLogo";
import { Providers } from "@/components/Providers";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engram Dashboard",
  description: "Developer dashboard for Engram memory inspection",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-paper text-ink antialiased">
        {clerkPublishableKey ? (
          <ClerkProvider publishableKey={clerkPublishableKey}>
            <DashboardShell authEnabled>{children}</DashboardShell>
          </ClerkProvider>
        ) : (
          <DashboardShell authEnabled={false}>{children}</DashboardShell>
        )}
      </body>
    </html>
  );
}

function DashboardShell({ authEnabled, children }: { authEnabled: boolean; children: React.ReactNode }) {
  return (
    <Providers>
      {authEnabled && <ClerkEngramBridge />}
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto grid min-h-14 max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 lg:grid-cols-[200px_minmax(18rem,30rem)_auto] lg:px-6">
            <Link href="/" className="group">
              <EngramLogo />
            </Link>
            <div className="col-span-2 row-start-2 flex justify-center lg:col-span-1 lg:row-start-auto">
              <CommandPalette />
            </div>
            <nav className="flex items-center justify-end gap-3 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              <div className="hidden items-center gap-5 xl:flex">
                <Link className="hover:text-signal" href="/">
                  Memories
                </Link>
                <Link className="hover:text-signal" href="/chat">
                  Chat
                </Link>
                <Link className="hover:text-signal" href="/logs">
                  Logs
                </Link>
                <Link className="hover:text-signal" href="/settings">
                  Settings
                </Link>
              </div>
              <div className="hidden items-center sm:flex">
                <AuthControls enabled={authEnabled} />
              </div>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pb-10 md:py-16">{children}</main>
        <footer className="mx-auto max-w-7xl border-t border-line px-4 pb-28 pt-6 sm:px-6 sm:pb-10">
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
            Copyright (c) 2026 Ayush
          </p>
        </footer>
        <nav className="fixed bottom-0 left-0 z-40 grid w-screen max-w-[100vw] grid-cols-4 overflow-hidden border-t border-line bg-paper/95 px-2 py-3 text-center font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-muted backdrop-blur xl:hidden">
          <Link className="hover:text-signal" href="/">
            Memories
          </Link>
          <Link className="hover:text-signal" href="/chat">
            Chat
          </Link>
          <Link className="hover:text-signal" href="/logs">
            Logs
          </Link>
          <Link className="hover:text-signal" href="/settings">
            Settings
          </Link>
        </nav>
      </div>
    </Providers>
  );
}
