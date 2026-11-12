"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthControls } from "@/components/AuthControls";
import { ClerkEngramBridge } from "@/components/ClerkEngramBridge";
import { CommandPalette } from "@/components/CommandPalette";
import { EngramLogo } from "@/components/EngramLogo";
import { NamespaceSelector } from "@/components/NamespaceSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/cn";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { useNamespace } from "@/lib/useNamespace";

const navItems = [
  { href: "/overview", label: "Overview" },
  { href: "/memories", label: "Memories" },
  { href: "/chat", label: "Playground" },
  { href: "/connections", label: "Connections" },
  { href: "/logs", label: "Logs" },
  { href: "/docs", label: "Docs" },
  { href: "/settings", label: "Settings" },
];

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

export function AppFrame({ authEnabled, children }: { authEnabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const apiKey = useActiveApiKey();
  const namespace = useNamespace();

  if (pathname === "/") {
    return children;
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#product-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-paper focus:not-sr-only"
      >
        Skip to product content
      </a>
      {authEnabled && <ClerkEngramBridge />}

      <aside className="hidden border-r border-line lg:block">
        <div className="sticky top-0 flex h-screen flex-col px-5 py-7">
          <Link href="/" className={cn("rounded-lg px-2", focusRing)}>
            <EngramLogo />
          </Link>
          <nav aria-label="Product navigation" className="mt-10 flex flex-col gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-[0.94rem] transition-colors",
                  isActive(item.href) ? "bg-tag text-ink" : "text-muted hover:bg-tag/60 hover:text-ink",
                  focusRing,
                )}
              >
                <span className={cn("h-1.5 w-1.5 shrink-0", isActive(item.href) ? "bg-signal" : "bg-line")} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex items-center justify-between gap-2 px-1">
            <AuthControls enabled={authEnabled} />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className={cn("rounded-lg", focusRing)}>
              <EngramLogo />
            </Link>
            <div className="flex items-center gap-1">
              <AuthControls enabled={authEnabled} />
              <ThemeToggle />
            </div>
          </div>
          <nav aria-label="Product navigation" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-sm px-3 py-1.5 text-sm transition-colors",
                  isActive(item.href) ? "bg-tag text-ink" : "text-muted hover:text-ink",
                  focusRing,
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main id="product-content" tabIndex={-1} className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 pt-8 outline-none sm:px-8 lg:px-12 lg:pt-10">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <NamespaceSelector />
            <div className="md:w-80">
              <CommandPalette key={`${apiKey}:${namespace}`} />
            </div>
          </div>
          <div key={`${apiKey}:${namespace}`}>{children}</div>
        </main>
      </div>
    </div>
  );
}
