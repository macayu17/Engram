"use client";

import gsap from "gsap";
import { useCallback, useRef } from "react";

import { copy } from "./copy";
import { useSceneTimeline } from "./useSceneTimeline";

export function SceneClimax() {
  const ref = useRef<HTMLElement>(null);

  const build = useCallback(({ root, isDesktop }: { root: HTMLElement; isDesktop: boolean }) => {
    const q = gsap.utils.selector(root);

    if (!isDesktop) {
      [q("[data-line]"), q("[data-mark-mobile]")].flat().forEach((element) => {
        gsap.from(element, {
          y: 48,
          autoAlpha: 0,
          duration: 0.75,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: { trigger: element, start: "top 84%", once: true },
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
          end: "+=150%",
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      })
      .to(q("[data-giant]"), { scale: 0.06, autoAlpha: 0, duration: 0.26, ease: "power1.in" }, 0)
      .from(q("[data-line]"), { yPercent: 60, autoAlpha: 0, stagger: 0.07, duration: 0.2, ease: "power2.out" }, 0.3)
      .from(q("[data-rule]"), { scaleX: 0, duration: 0.14, ease: "power1.out" }, 0.44)
      .to(q("[data-statement]"), { scale: 0.18, autoAlpha: 0, duration: 0.22, ease: "power2.in" }, 0.62)
      .from(q("[data-mark]"), { scale: 1.7, autoAlpha: 0, duration: 0.18, ease: "power2.out" }, 0.8);
  }, []);

  useSceneTimeline(ref, build);

  return (
    <section ref={ref} data-scene="climax" data-theme-scene="signal" className="landing-scene relative flex flex-col items-center justify-center overflow-hidden bg-lp text-li lg:h-screen">
      <h2 className="sr-only">{copy.climax.lines.join(" ")}</h2>

      <p aria-hidden="true" data-giant className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 select-none font-display text-[110vw] font-black uppercase leading-[0.75] lg:block">
        F
      </p>

      <div data-statement className="relative px-5 py-28 text-center lg:py-0">
        <div data-rule aria-hidden="true" className="mb-8 h-px w-full origin-left bg-li/60" />
        {copy.climax.lines.map((line) => (
          <p key={line} data-line className="whitespace-nowrap font-display text-[clamp(2rem,6.6vw,7rem)] font-black uppercase leading-[0.92] tracking-[-0.02em]">
            {line}
          </p>
        ))}
        <div data-rule aria-hidden="true" className="mt-8 h-px w-full origin-right bg-li/60" />
      </div>

      <p data-mark className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 font-display text-[clamp(2rem,5vw,5rem)] font-black uppercase tracking-[-0.02em] lg:block">
        {copy.climax.mark}
      </p>
      <p data-mark-mobile className="pb-28 text-center font-display text-[clamp(2rem,8vw,4rem)] font-black uppercase tracking-[-0.02em] lg:hidden">
        {copy.climax.mark}
      </p>
    </section>
  );
}
