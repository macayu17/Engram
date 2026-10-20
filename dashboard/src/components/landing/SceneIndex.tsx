"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCallback, useRef } from "react";

import { copy } from "./copy";
import { useSceneTimeline } from "./useSceneTimeline";

gsap.registerPlugin(ScrollTrigger);

export function SceneIndex() {
  const ref = useRef<HTMLElement>(null);

  const build = useCallback(({ root, isDesktop }: { root: HTMLElement; isDesktop: boolean }) => {
    const q = gsap.utils.selector(root);
    const values = q("[data-row-value]") as HTMLElement[];
    const keys = q("[data-row-key]") as HTMLElement[];

    if (!isDesktop) {
      values.forEach((value) => {
        ScrollTrigger.create({
          trigger: value,
          start: "top 62%",
          end: "bottom 38%",
          onToggle: (self) => value.classList.toggle("text-lsignal", self.isActive),
        });
      });
      return;
    }

    const rowsWrap = q("[data-rows]")[0] as HTMLElement | undefined;
    if (!rowsWrap) return;
    const rowEls = q("[data-row]") as HTMLElement[];

    const armY = () => window.innerHeight * 0.52;
    const centers = () => rowEls.map((row) => row.offsetTop + row.offsetHeight / 2);
    let activeIndex = -1;

    const setActive = (next: number) => {
      if (next === activeIndex) return;
      activeIndex = next;
      values.forEach((value, index) => value.classList.toggle("text-lsignal", index === next));
      keys.forEach((key, index) => key.classList.toggle("text-lsignal", index === next));
    };

    gsap
      .timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "+=140%",
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
        onUpdate: () => {
          const y = Number(gsap.getProperty(rowsWrap, "y")) || 0;
          const tolerance = (rowEls[0]?.offsetHeight ?? 80) * 0.5;
          const next = centers().findIndex((center) => Math.abs(center + y - armY()) <= tolerance);
          setActive(next);
        },
      })
      .fromTo(
        rowsWrap,
        { y: () => armY() - centers()[0] },
        { y: () => armY() - centers()[centers().length - 1], duration: 0.78 },
        0,
      )
      .to(rowsWrap, { autoAlpha: 0.2, scale: 0.98, transformOrigin: "center center", duration: 0.12, ease: "power2.in" }, 0.8)
      .from(q("[data-final]"), { clipPath: "inset(100% 0 0 0)", autoAlpha: 0, duration: 0.12, ease: "power2.out" }, 0.84);
  }, []);

  useSceneTimeline(ref, build);

  return (
    <section ref={ref} data-scene="index" data-theme-scene="dark" className="landing-scene relative overflow-hidden bg-lp text-li lg:h-screen">
      <p className="px-5 pt-24 font-mono text-[11px] uppercase tracking-[0.22em] text-lm sm:px-6 lg:absolute lg:left-6 lg:top-20 lg:p-0">
        {copy.index.label}
      </p>

      <p aria-hidden="true" className="px-5 font-display text-[38vw] font-black uppercase leading-[0.75] sm:px-6 lg:absolute lg:left-[2vw] lg:top-1/2 lg:-translate-y-1/2 lg:p-0 lg:text-[24vw]">
        {copy.index.mark}
      </p>

      <div aria-hidden="true" className="absolute left-[24%] right-0 top-[52%] hidden h-px bg-ll lg:block" />

      <div data-rows className="px-5 pb-16 sm:px-6 lg:absolute lg:right-0 lg:top-0 lg:w-[52%] lg:px-0 lg:pr-[5vw]">
        {copy.index.rows.map(([key, value]) => (
          <div key={key} data-row className="flex items-baseline gap-6 border-b border-ll py-5 lg:py-6">
            <p data-row-key className="w-[9rem] shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-lm transition-colors duration-200">
              {key}
            </p>
            <p data-row-value className="whitespace-nowrap font-display text-[clamp(1.2rem,2vw,2.1rem)] font-black uppercase leading-none transition-colors duration-200">
              {value}
            </p>
          </div>
        ))}
      </div>

      <p data-final className="hidden font-display text-[clamp(1.6rem,2.8vw,2.8rem)] font-black uppercase leading-[1.05] lg:absolute lg:right-[5%] lg:top-[46%] lg:block lg:w-[34%]">
        {copy.index.final}
      </p>
      <p className="px-5 pb-16 font-display text-[clamp(1.6rem,6vw,2.8rem)] font-black uppercase leading-[1.05] sm:px-6 lg:hidden">
        {copy.index.final}
      </p>
    </section>
  );
}
