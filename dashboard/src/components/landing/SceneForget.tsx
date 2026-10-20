"use client";

import gsap from "gsap";
import { useCallback, useLayoutEffect, useRef } from "react";

import { copy } from "./copy";
import { useSceneTimeline } from "./useSceneTimeline";

export function SceneForget() {
  const ref = useRef<HTMLElement>(null);

  const build = useCallback(({ root }: { root: HTMLElement; isDesktop: boolean }) => {
    const q = gsap.utils.selector(root);

    gsap
      .timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "+=120%",
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      })
      .to(q("[data-meta]"), { autoAlpha: 0, y: -26, stagger: 0.04, duration: 0.22, ease: "power1.in" }, 0)
      .to(q("[data-prop]"), { autoAlpha: 0, y: -20, duration: 0.2, ease: "power1.in" }, 0.04)
      .to(q("[data-side]"), { autoAlpha: 0, duration: 0.2, ease: "power1.in" }, 0.02)
      .to(q("[data-hint]"), { autoAlpha: 0, duration: 0.16, ease: "power1.in" }, 0)
      .to(
        q("[data-letter]"),
        {
          yPercent: 165,
          rotation: (index) => (index % 2 === 0 ? -7 : 9),
          autoAlpha: 0,
          stagger: 0.055,
          duration: 0.75,
          ease: "power2.in",
        },
        0.15,
      )
      .from(
        q("[data-remain]"),
        { autoAlpha: 0, yPercent: 40, stagger: 0.07, duration: 0.26, ease: "power2.out" },
        0.58,
      );
  }, []);

  useSceneTimeline(ref, build);

  const entranceRef = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const q = gsap.utils.selector(root);
    const context = gsap.context(() => {
      entranceRef.current = gsap
        .timeline({ paused: true })
        .from(q("[data-letter]"), { yPercent: 112, stagger: 0.06, duration: 0.9, ease: "power4.out" })
        .from(q("[data-meta]"), { clipPath: "inset(100% 0 0 0)", y: 12, autoAlpha: 0, stagger: 0.08, duration: 0.6, ease: "power3.out" }, "-=0.5")
        .from(q("[data-prop]"), { autoAlpha: 0, y: 14, duration: 0.55, ease: "power3.out" }, "-=0.4")
        .from(q("[data-side]"), { autoAlpha: 0, y: 8, duration: 0.5, ease: "power3.out" }, "-=0.45")
        .from(q("[data-hint]"), { autoAlpha: 0, duration: 0.45, ease: "power2.out" }, "-=0.3");
    }, root);

    const play = () => {
      const entrance = entranceRef.current;
      if (!entrance || entrance.isActive() || entrance.progress() === 1) return;
      entrance.play(0);
    };
    window.addEventListener("landing:enter", play, { once: true });
    const fallback = window.setTimeout(play, 2600);

    return () => {
      window.removeEventListener("landing:enter", play);
      window.clearTimeout(fallback);
      context.revert();
    };
  }, []);

  return (
    <section ref={ref} id="top" data-scene="forget" data-theme-scene="dark" className="landing-scene relative h-screen overflow-hidden bg-lp text-li">
      <h1 className="sr-only">{copy.forget.srTitle}</h1>

      <div className="absolute left-5 top-20 max-w-[24rem] sm:left-6 sm:top-24">
        {copy.forget.meta.map((line) => (
          <p key={line} data-meta className="font-mono text-[11px] uppercase leading-5 tracking-[0.18em] text-lm">
            {line}
          </p>
        ))}
        <p data-prop className="mt-5 max-w-[26rem] font-sans text-base leading-6 text-li sm:text-lg sm:leading-7">
          {copy.forget.valueProp}
        </p>
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        {copy.forget.remain.map((line) => (
          <p key={line} data-remain className="font-display text-[clamp(2rem,5.5vw,5.5rem)] font-black uppercase leading-[0.98] tracking-[-0.02em]">
            {line}
          </p>
        ))}
      </div>

      <p data-side className="absolute right-5 top-20 hidden font-mono text-[11px] uppercase tracking-[0.18em] text-lm sm:right-6 sm:top-24 md:block">
        {copy.forget.side}
      </p>

      <div aria-hidden="true" className="absolute bottom-[22vh] left-0 whitespace-nowrap pl-[2vw]">
        {copy.forget.word.split("").map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            data-letter
            className="inline-block font-display text-[clamp(6rem,23vw,24rem)] font-black uppercase leading-[0.8] tracking-[-0.03em]"
          >
            {letter}
          </span>
        ))}
      </div>

      <div aria-hidden="true" className="absolute left-0 top-[78vh] h-px w-full bg-ll" />

      <div data-hint className="absolute bottom-7 right-5 flex items-center gap-3 sm:right-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-lm">{copy.forget.hint}</span>
        <span aria-hidden="true" className="h-8 w-px bg-lsignal" />
      </div>
    </section>
  );
}
