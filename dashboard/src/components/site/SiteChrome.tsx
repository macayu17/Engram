"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { EngramLogo } from "@/components/EngramLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { button, focusRing, pageWrap } from "@/lib/site-styles";

const github = "https://github.com/macayu17/Engram";

const links = [
  { href: "/", label: "home" },
  { href: "/docs", label: "docs" },
  { href: "/overview", label: "dashboard" },
  { href: "/about", label: "about" },
];

const bracketLink = `text-ink-muted no-underline before:content-['['] after:content-[']'] hover:text-hot-ink aria-[current=page]:text-hot-ink ${focusRing}`;

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper transition-colors duration-300">
      <div className={`${pageWrap} flex flex-wrap items-center justify-between gap-4 py-3.5`}>
        <Link href="/" aria-label="Engram home" className={`rounded-sm ${focusRing}`}>
          <EngramLogo />
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px]">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} className={bracketLink}>
              {link.label}
            </Link>
          ))}
          <a href={github} target="_blank" rel="noopener noreferrer" className={bracketLink}>
            github
          </a>
          <ThemeToggle />
          <Link href="/overview" className={button.inkSmall}>
            Open dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line pb-14 pt-10">
      <div className={`${pageWrap} flex flex-wrap items-end justify-between gap-6`}>
        <pre aria-label="Engram, memory for every model" className="m-0 font-mono text-[13px] leading-[1.45] text-ink-muted">
          {" ·  "}
          <span className="text-ink">●</span>
          {"  ·\n "}
          <span className="text-ink">● ╱ ╲</span> <span className="text-hot-ink">◉</span>
          {"   "}
          <span className="text-ink">engram</span>
          {"\n ·  ·  ·   memory for every model"}
        </pre>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px]">
          <Link href="/docs" className={bracketLink}>
            docs
          </Link>
          <Link href="/about" className={bracketLink}>
            about
          </Link>
          <a href={github} target="_blank" rel="noopener noreferrer" className={bracketLink}>
            github
          </a>
          <a href="https://www.npmjs.com/package/engramd" target="_blank" rel="noopener noreferrer" className={bracketLink}>
            npm
          </a>
          <span className="text-ink-muted">MIT licensed</span>
        </div>
      </div>
    </footer>
  );
}
