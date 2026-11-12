"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthControls } from "@/components/AuthControls";
import { ClerkEngramBridge } from "@/components/ClerkEngramBridge";
import { CommandPalette } from "@/components/CommandPalette";
import { EngramLogo } from "@/components/EngramLogo";
import { NamespaceSelector } from "@/components/NamespaceSelector";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/site-styles";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { useNamespace } from "@/lib/useNamespace";

const navItems = [
  { href: "/overview", label: "Overview" },
  { href: "/review", label: "Review" },
  { href: "/memories", label: "Memories" },
  { href: "/logs", label: "Logs" },
  { href: "/chat", label: "Playground" },
  { href: "/connections", label: "Connections" },
  { href: "/settings", label: "Settings" },
];

const publicPages = ["/docs", "/about"];

function useReviewCount() {
  const apiKey = useActiveApiKey();
  const namespace = useNamespace();
  const enabled = Boolean(apiKey);
  const pending = useQuery({
    queryKey: ["memories", "review", apiKey, namespace],
    queryFn: () => api.memories.review({ limit: 50 }),
    enabled,
  });
  const revisions = useQuery({
    queryKey: ["memories", "revisions", apiKey, namespace],
    queryFn: api.memories.revisions,
    enabled,
  });
  return (pending.data?.total ?? 0) + (revisions.data?.revisions.length ?? 0);
}

export function AppFrame({ authEnabled, children }: { authEnabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/") {
    return children;
  }

  if (publicPages.some((page) => pathname === page || pathname.startsWith(`${page}/`))) {
    return (
      <div className="min-h-screen bg-paper text-[15px] leading-[1.55] text-ink">
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </div>
    );
  }

  return <ProductFrame authEnabled={authEnabled}>{children}</ProductFrame>;
}

function ProductFrame({ authEnabled, children }: { authEnabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const apiKey = useActiveApiKey();
  const namespace = useNamespace();
  const reviewCount = useReviewCount();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const links = navItems.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-md px-2.5 py-2 text-sm text-ink-muted hover:bg-card hover:text-ink",
        "aria-[current=page]:bg-card aria-[current=page]:text-ink aria-[current=page]:shadow-[inset_0_0_0_1px_oklch(var(--color-line))]",
        focusRing,
      )}
    >
      {item.label}
      {item.href === "/review" && reviewCount > 0 && (
        <span className="min-w-5 rounded-full bg-hot-fill px-[7px] text-center font-mono text-[11px] font-medium text-on-hot">{reviewCount}</span>
      )}
    </Link>
  ));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <a href="#product-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-hot-fill px-4 py-2 text-sm font-medium text-on-hot focus:not-sr-only">
        Skip to product content
      </a>
      {authEnabled && <ClerkEngramBridge />}

      <aside className="hidden border-r border-line lg:block">
        <div className="sticky top-0 flex h-screen flex-col gap-0.5 px-4 py-6">
          <Link href="/" className={cn("mb-4 rounded-sm px-2.5", focusRing)}>
            <EngramLogo />
          </Link>
          <div className="mb-2 border-b border-line px-2.5 pb-3.5 font-mono text-xs text-ink-muted">
            <b className="mb-0.5 block font-sans text-sm font-semibold text-ink">{namespace}</b>
            current project
          </div>
          <nav aria-label="Product navigation" className="flex flex-col gap-0.5">
            {links}
            <Link href="/docs" className={cn("rounded-md px-2.5 py-2 text-sm text-ink-muted hover:bg-card hover:text-ink", focusRing)}>
              Docs
            </Link>
          </nav>
          <div className="mt-auto flex items-center justify-between gap-2 px-1">
            <AuthControls enabled={authEnabled} />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-paper lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className={cn("rounded-sm", focusRing)}>
              <EngramLogo />
            </Link>
            <div className="flex items-center gap-2">
              <AuthControls enabled={authEnabled} />
              <ThemeToggle />
            </div>
          </div>
          <nav aria-label="Product navigation" className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
            {links}
          </nav>
        </header>

        <main id="product-content" tabIndex={-1} className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 pt-7 outline-none lg:px-9">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
