"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthControls } from "@/components/AuthControls";
import { ClerkEngramBridge } from "@/components/ClerkEngramBridge";
import { CommandPalette } from "@/components/CommandPalette";
import { EngramLogo } from "@/components/EngramLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { href: "/overview", label: "Overview" },
  { href: "/memories", label: "Memories" },
  { href: "/chat", label: "Chat" },
  { href: "/logs", label: "Logs" },
  { href: "/graph", label: "Graph" },
  { href: "/docs", label: "Docs" },
  { href: "/settings", label: "Settings" },
];

export function AppFrame({ authEnabled, children }: { authEnabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/") {
    return children;
  }

  return (
    <div className="min-h-screen">
      <a href="#product-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-signal px-4 py-2 font-sans text-sm font-semibold text-paper focus:not-sr-only">
        Skip to product content
      </a>
      {authEnabled && <ClerkEngramBridge />}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto grid min-h-16 max-w-[1400px] grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 lg:grid-cols-[180px_minmax(18rem,30rem)_1fr] lg:px-8">
          <Link href="/overview" className="group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
            <EngramLogo />
          </Link>
          <div className="col-span-2 row-start-2 flex w-full min-w-0 justify-center lg:col-span-1 lg:row-start-auto">
            <CommandPalette />
          </div>
          <nav className="flex items-center justify-end gap-3 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
            <div className="hidden items-center gap-4 xl:flex">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`border-b py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal ${active ? "border-signal text-ink" : "border-transparent hover:border-line hover:text-signal"}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="hidden items-center sm:flex">
              <AuthControls enabled={authEnabled} />
            </div>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="product-content" tabIndex={-1} className="mx-auto max-w-[1400px] scroll-mt-20 px-4 pb-16 pt-10 outline-none sm:px-8 sm:pb-10 md:py-16">{children}</main>
      <footer className="mx-auto max-w-[1400px] border-t border-line px-4 pb-28 pt-6 sm:px-8 sm:pb-10">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Copyright (c) 2026 Ayush</p>
      </footer>
      <nav className="fixed bottom-0 left-0 z-40 grid w-screen max-w-[100vw] grid-cols-6 overflow-hidden border-t border-line bg-paper/95 px-2 py-2 text-center font-sans text-[9px] font-semibold uppercase tracking-[0.08em] text-muted backdrop-blur-xl xl:hidden">
        {navItems.filter((item) => item.href !== "/docs").map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-1 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal ${active ? "bg-tag text-signal" : "hover:bg-tag/50 hover:text-ink"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
