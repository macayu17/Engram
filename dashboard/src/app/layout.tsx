import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

import { ClerkEngramBridge } from "@/components/ClerkEngramBridge";
import { CommandPalette } from "@/components/CommandPalette";
import { Providers } from "@/components/Providers";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engram Dashboard",
  description: "Developer dashboard for Engram memory inspection",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-paper text-ink antialiased">
        <Script
          id="engram-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "try{var theme=localStorage.getItem('engram_theme');document.documentElement.dataset.theme=theme==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}",
          }}
        />
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
          <div className="mx-auto grid min-h-14 max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 md:grid-cols-[220px_1fr_340px] md:px-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-tag font-serif text-sm font-bold text-signal">E</span>
              <span className="font-serif text-lg leading-none">
                <span className="text-ink">En</span>
                <span className="italic text-signal">gram</span>
              </span>
            </Link>
            <div className="col-span-2 row-start-2 flex justify-center md:col-span-1 md:row-start-auto">
              <CommandPalette />
            </div>
            <nav className="flex items-center justify-end gap-4 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              <div className="hidden items-center gap-4 sm:flex">
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
              <div className="hidden items-center gap-3 sm:flex">
                <AuthControls enabled={authEnabled} />
              </div>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 sm:pb-10 md:py-16">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-paper/95 px-4 py-3 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted backdrop-blur sm:hidden">
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

function AuthControls({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return <span className="text-caution">Auth Not Configured</span>;
  }
  return (
    <>
      <Show when="signed-out">
        <SignInButton>
          <button type="button" className="hover:text-signal">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton>
          <button type="button" className="border border-line px-3 py-2 text-ink hover:border-signal hover:text-signal">
            Create Account
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
