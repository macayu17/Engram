"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

import { copy } from "./copy";

gsap.registerPlugin(ScrollTrigger);

type NavTheme = "dark" | "paper" | "signal";

export function LandingNav() {
  const [theme, setTheme] = useState<NavTheme>("dark");
  const [active, setActive] = useState<string>("forget");
  const barRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      const bar = barRef.current;
      if (bar) {
        ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
        });
      }

      const triggers: ScrollTrigger[] = [];
      const update = () => {
        const winner = triggers.filter((trigger) => trigger.isActive).at(-1);
        const section = winner?.trigger as HTMLElement | undefined;
        if (!section) return;
        const sceneTheme = section.dataset.themeScene as NavTheme | undefined;
        if (sceneTheme) setTheme(sceneTheme);
        if (section.dataset.scene) setActive(section.dataset.scene);
      };

      document.querySelectorAll<HTMLElement>("[data-scene]").forEach((section) => {
        triggers.push(
          ScrollTrigger.create({
            trigger: section,
            start: "top bottom",
            end: "bottom bottom",
            onToggle: update,
          }),
        );
      });
    });

    return () => context.revert();
  }, []);

  return (
    <header data-nav-theme={theme} className="landing-nav fixed inset-x-0 top-0 z-40 text-li transition-colors duration-300">
      <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
        <a
          href="#top"
          className="font-display text-sm font-black uppercase tracking-[0.08em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lsignal"
        >
          {copy.nav.brand}
        </a>
        <nav aria-label="Scenes" className="hidden items-center gap-7 lg:flex">
          {copy.nav.items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={active === item.scene ? "true" : undefined}
              className={`font-mono text-[11px] uppercase tracking-[0.18em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lsignal ${
                active === item.scene ? "text-lsignal" : "text-lm hover:text-li"
              }`}
            >
              {item.index} {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href={copy.nav.github}
            target="_blank"
            rel="noreferrer"
            className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-lm transition-colors hover:text-li focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lsignal sm:inline-block"
          >
            {copy.nav.githubLabel} ↗
          </a>
          <Link
            href={copy.nav.dashboard}
            className="inline-flex min-h-9 items-center border border-ll px-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors hover:bg-li hover:text-lp focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lsignal"
          >
            {copy.nav.cta}
          </Link>
        </div>
      </div>
      <div className="h-px w-full bg-ll/40">
        <div ref={barRef} className="h-px w-full origin-left scale-x-0 bg-lsignal" />
      </div>
    </header>
  );
}
