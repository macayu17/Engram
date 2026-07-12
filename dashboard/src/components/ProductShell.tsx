"use client";

import { useQuery } from "@tanstack/react-query";
import { Brain, LayoutDashboard, Menu, MessageSquare, Network, ScrollText, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useActiveApiKey } from "@/lib/useActiveApiKey";
import { AuthControls } from "./AuthControls";
import { CommandPalette } from "./CommandPalette";
import { EngramLogo } from "./EngramLogo";
import { ThemeToggle } from "./ThemeToggle";


const destinations = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/memories", label: "Memories", icon: Brain },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function ProductShell({ authEnabled, children }: { authEnabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeApiKey = useActiveApiKey();
  const usageQuery = useQuery({
    queryKey: ["billing", "usage"],
    queryFn: () => api.billing.usage(),
    enabled: activeApiKey.startsWith("ek_"),
    retry: false,
  });
  const plan = usageQuery.data?.plan ?? "free";
  const memoryUsage = usageQuery.data ? `${usageQuery.data.memories.toLocaleString()} / ${usageQuery.data.limits.memories.toLocaleString()}` : "Unavailable";

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-panel lg:flex lg:min-h-[100dvh] lg:flex-col">
        <div className="border-b border-line px-5 py-4"><Link href="/overview"><EngramLogo /></Link></div>
        <ProductNavigation pathname={pathname} onNavigate={() => undefined} />
        <div className="mt-auto border-t border-line p-5">
          <p className="text-xs font-medium text-ink">{plan === "pro" ? "Pro plan" : "Free plan"}</p>
          <p className="mt-1 text-xs text-muted">{memoryUsage} memories</p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
            <button type="button" onClick={() => setMenuOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-panel text-ink lg:hidden" aria-label="Open navigation">
              <Menu size={18} aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1"><CommandPalette /></div>
            <AuthControls enabled={authEnabled} />
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink/30" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />
          <aside className="relative flex h-full w-[min(20rem,88vw)] flex-col bg-panel shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <EngramLogo />
              <button type="button" onClick={() => setMenuOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line" aria-label="Close navigation"><X size={18} /></button>
            </div>
            <ProductNavigation pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            <div className="mt-auto border-t border-line p-5 text-xs text-muted">{plan === "pro" ? "Pro" : "Free"} · {memoryUsage} memories</div>
          </aside>
        </div>
      )}
    </div>
  );
}

function ProductNavigation({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav aria-label="Product" className="grid gap-1 p-3">
      {destinations.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted hover:bg-tag hover:text-ink", active && "bg-tag text-ink")}>
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
