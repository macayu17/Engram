"use client";

import gsap from "gsap";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { copy } from "./copy";
import { useSceneTimeline } from "./useSceneTimeline";

export function SceneCta() {
  const ref = useRef<HTMLElement>(null);

  const build = useCallback(({ root, isDesktop }: { root: HTMLElement; isDesktop: boolean }) => {
    const q = gsap.utils.selector(root);

    if (!isDesktop) {
      [q("[data-heading]"), q("[data-summary]"), q("[data-command]"), q("[data-actions]")].flat().forEach((element) => {
        gsap.from(element, {
          y: 44,
          autoAlpha: 0,
          duration: 0.7,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: { trigger: element, start: "top 88%", once: true },
        });
      });
      return;
    }

    gsap
      .timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "+=90%",
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      })
      .from(q("[data-heading]"), { clipPath: "inset(100% 0 0 0)", y: 40, duration: 0.25, ease: "power2.out" }, 0.08)
      .from(q("[data-summary]"), { autoAlpha: 0, y: 18, duration: 0.16, ease: "power2.out" }, 0.28)
      .from(q("[data-command]"), { autoAlpha: 0, y: 24, duration: 0.18, ease: "power2.out" }, 0.38)
      .from(q("[data-actions]"), { autoAlpha: 0, y: 24, duration: 0.18, ease: "power2.out" }, 0.46)
      .from(q("[data-technical]"), { autoAlpha: 0, duration: 0.14, ease: "power1.out" }, 0.56)
      .from(q("[data-giant]"), { yPercent: 42, duration: 0.4, ease: "power1.out" }, 0.5);
  }, []);

  useSceneTimeline(ref, build);

  return (
    <section ref={ref} id="start" data-scene="cta" data-theme-scene="dark" className="landing-scene relative flex min-h-screen flex-col overflow-hidden bg-lp text-li lg:h-screen">
      <div className="px-5 pt-[10vh] sm:px-6 lg:pt-[12vh]">
        <h2 data-heading className="max-w-[18ch] font-display text-[clamp(2.4rem,5.2vw,5.6rem)] font-black uppercase leading-[0.9] tracking-[-0.02em]">
          {copy.cta.heading}
        </h2>

        <p data-summary className="mt-6 max-w-[34rem] font-sans text-base leading-7 text-lm sm:text-lg">
          {copy.cta.summary}
        </p>

        <div data-command className="mt-8 max-w-[46rem] border border-ll bg-lp">
          <div className="flex items-center justify-between border-b border-ll px-5 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-lm">bash — engram</span>
            <CopyButton />
          </div>
          <pre className="overflow-x-auto px-5 py-4 font-mono text-[11px] leading-[1.75] text-li sm:text-xs">
            {copy.cta.quickstart.map((line, index) => (
              <span key={line} className={`block ${line.startsWith("#") ? "text-lm" : ""}`}>
                {line.startsWith("#") ? line : <><span className="mr-3 text-lsignal">{String(Math.ceil((index + 1) / 2)).padStart(2, "0")}</span>{line}</>}
              </span>
            ))}
          </pre>
        </div>

        <div data-actions className="mt-7 flex flex-wrap items-center gap-6">
          <Link
            href={copy.nav.dashboard}
            className="group relative inline-flex min-h-12 items-center gap-3 overflow-hidden border border-ll px-6 font-mono text-xs font-semibold uppercase tracking-[0.14em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lsignal"
          >
            <span aria-hidden="true" className="absolute inset-0 origin-left scale-x-0 bg-lsignal transition-transform duration-300 ease-out group-hover:scale-x-100" />
            <span className="relative transition-colors duration-300 group-hover:text-lp">{copy.cta.dashboard}</span>
            <span aria-hidden="true" className="relative transition-transform duration-300 group-hover:translate-x-[7px] group-hover:text-lp">→</span>
          </Link>
          <a
            href={copy.nav.github}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs uppercase tracking-[0.14em] text-lm underline decoration-ll underline-offset-8 transition-colors hover:text-li hover:decoration-lsignal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lsignal"
          >
            {copy.cta.source} ↗
          </a>
        </div>

        <p data-technical className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-lm">
          {copy.cta.technical}
        </p>
      </div>

      <p
        data-giant
        aria-hidden="true"
        className="pointer-events-none mt-16 select-none whitespace-nowrap font-display text-[26vw] font-black uppercase leading-[0.72] tracking-[-0.03em] lg:absolute lg:bottom-0 lg:left-0 lg:mt-0 lg:translate-y-[48%] lg:text-[24vw]"
      >
        {copy.cta.giant}
      </p>

      <footer className="relative z-10 mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-ll bg-lp px-5 py-5 sm:px-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-lm">{copy.cta.footer}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-lm">{copy.cta.site}</span>
      </footer>
    </section>
  );
}

function CopyButton() {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(copy.cta.quickstart.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copyCommand()}
      aria-live="polite"
      className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-lm transition-colors hover:text-li focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lsignal"
    >
      {copied ? copy.cta.copied : copy.cta.copy}
    </button>
  );
}
