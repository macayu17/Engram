"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCallback, useRef } from "react";

import { copy } from "./copy";
import { useSceneTimeline } from "./useSceneTimeline";

gsap.registerPlugin(ScrollTrigger);

const axisPositions = ["left-[0%]", "left-[50%]", "left-[70%]", "left-[100%]"];

export function SceneLoop() {
  const ref = useRef<HTMLElement>(null);

  const build = useCallback(({ root, isDesktop }: { root: HTMLElement; isDesktop: boolean }) => {
    const q = gsap.utils.selector(root);
    const track = q("[data-track]")[0] as HTMLElement | undefined;
    const numbers = q("[data-stage-number]") as HTMLElement[];
    const names = q("[data-stage-name]") as HTMLElement[];
    const lines = q("[data-stage-line]") as HTMLElement[];

    if (!isDesktop) {
      numbers.forEach((number) => {
        const stage = number.closest("[data-stage]");
        if (!stage) return;
        gsap.from(stage, {
          y: 44,
          autoAlpha: 0,
          duration: 0.7,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: { trigger: stage, start: "top 86%", once: true },
        });
      });
      return;
    }

    if (!track) return;
    let activeIndex = -1;

    const setActive = (next: number) => {
      if (next === activeIndex) return;
      activeIndex = next;
      numbers.forEach((number, index) => {
        number.classList.toggle("text-lsignal", index === next);
        number.classList.toggle("text-ll", index !== next);
      });
      names.forEach((name, index) => name.classList.toggle("opacity-30", index !== next));
      lines.forEach((line, index) => line.classList.toggle("opacity-30", index !== next));
    };
    setActive(0);

    gsap
      .timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "+=190%",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
        onUpdate: () => {
          const x = Number(gsap.getProperty(track, "x")) || 0;
          const stageWidth = track.scrollWidth / copy.loop.stages.length;
          const next = Math.min(copy.loop.stages.length - 1, Math.max(0, Math.round(-x / stageWidth)));
          setActive(next);
        },
      })
      .to(track, {
        x: () => -(track.scrollWidth - track.scrollWidth / copy.loop.stages.length),
        duration: 0.86,
      })
      .from(q("[data-axis]"), { autoAlpha: 0, duration: 0.1, ease: "power1.out" }, 0.88);
  }, []);

  useSceneTimeline(ref, build);

  return (
    <section ref={ref} id="loop" data-scene="loop" data-theme-scene="paper" className="landing-scene relative overflow-hidden bg-lp text-li lg:h-screen">
      <header className="px-5 pt-24 sm:px-6 lg:absolute lg:left-6 lg:top-20 lg:p-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lm">{copy.loop.label}</p>
        <h2 className="mt-3 font-display text-[clamp(2.2rem,5.5vw,5.5rem)] font-black uppercase leading-[0.9] tracking-[-0.02em]">
          {copy.loop.heading}
        </h2>
      </header>

      <div aria-hidden="true" className="absolute bottom-0 left-[38%] top-[36%] hidden w-px bg-ll lg:block" />
      <div aria-hidden="true" className="absolute left-[38%] top-1/2 hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 border border-lsignal bg-lp lg:block" />

      <div data-track className="flex flex-col lg:absolute lg:left-[38%] lg:top-[54%] lg:w-max lg:-translate-y-1/2 lg:flex-row">
        {copy.loop.stages.map((stage) => (
          <article key={stage.n} data-stage className="border-l border-ll px-6 py-8 lg:w-[34vw] lg:shrink-0 lg:py-0 lg:pl-8">
            <p data-stage-number className="font-mono text-[clamp(3rem,10vw,10rem)] leading-none tabular-nums text-ll transition-colors duration-200">
              {stage.n}
            </p>
            <h3 data-stage-name className="mt-4 font-display text-[clamp(1.6rem,2.6vw,2.6rem)] font-black uppercase leading-none transition-opacity duration-200">
              {stage.name}
            </h3>
            <p data-stage-line className="mt-3 max-w-[26rem] font-sans text-base leading-6 text-lm transition-opacity duration-200">
              {stage.line}
            </p>
          </article>
        ))}
      </div>

      <div data-axis className="absolute bottom-[7vh] left-0 hidden w-full lg:block" aria-hidden="true">
        <div className="relative h-px w-full bg-ll">
          {copy.loop.axis.map((tick, tickIndex) => (
            <span key={tick} className={`absolute -top-1.5 h-3 w-px bg-lm ${axisPositions[tickIndex]}`} />
          ))}
          {copy.loop.axis.map((tick, tickIndex) => (
            <span key={`${tick}-label`} className={`absolute top-3 -translate-x-1/2 font-mono text-[10px] tabular-nums text-lm ${axisPositions[tickIndex]}`}>
              {tick}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
