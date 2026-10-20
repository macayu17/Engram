"use client";

import gsap from "gsap";
import { useCallback, useRef } from "react";

import { copy } from "./copy";
import { useSceneTimeline } from "./useSceneTimeline";

const columnPositions = ["left-[12%]", "left-[30%]", "left-[50%]", "left-[70%]", "left-[88%]"];
const strokePercents = [20, 33, 47, 63, 80];
const gridPercents = [12, 30, 50, 70, 88];

export function SceneInterfaces() {
  const ref = useRef<HTMLElement>(null);

  const build = useCallback(({ root, isDesktop }: { root: HTMLElement; isDesktop: boolean }) => {
    const q = gsap.utils.selector(root);
    const slides = q("[data-slide]") as HTMLElement[];

    if (!isDesktop) {
      slides.forEach((slide) => {
        gsap.from(slide.querySelector("[data-word]") ?? slide, {
          y: 60,
          autoAlpha: 0,
          duration: 0.75,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: { trigger: slide, start: "top 78%", once: true },
        });
      });
      return;
    }

    const proxySlide = slides[0];
    const apiSlide = slides[1];
    const mcpSlide = slides[2];
    const columns = q("[data-col]") as HTMLElement[];
    const midColumns = columns.filter((_, index) => index >= 1 && index <= 3);
    const outerColumns = columns.filter((_, index) => index === 0 || index === 4);

    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "+=260%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    timeline.set([apiSlide, mcpSlide], { autoAlpha: 0 }, 0);

    timeline.to(q("[data-word-proxy]"), { fontVariationSettings: '"wdth" 125', duration: 0.2 }, 0);

    timeline.to(proxySlide, { autoAlpha: 0, duration: 0.08, ease: "power1.in" }, 0.2);

    timeline.fromTo(
      columns,
      {
        autoAlpha: 0,
        scaleY: 0,
        transformOrigin: "top",
        x: (index) => ((strokePercents[index] - gridPercents[index]) / 100) * window.innerWidth,
      },
      { autoAlpha: 1, scaleY: 1, x: 0, duration: 0.1, ease: "power2.out" },
      0.24,
    );

    timeline
      .to(columns, { autoAlpha: 0.35, duration: 0.06 }, 0.36)
      .set(apiSlide, { autoAlpha: 1 }, 0.38)
      .from(q("[data-word-api]"), { clipPath: "inset(0 100% 0 0)", duration: 0.12, ease: "power2.out" }, 0.38)
      .from(q("[data-api-meta]"), { autoAlpha: 0, y: 16, duration: 0.08, ease: "power2.out" }, 0.44);

    timeline
      .to(q("[data-word-api]"), { yPercent: -30, autoAlpha: 0, duration: 0.1, ease: "power2.in" }, 0.54)
      .to(q("[data-api-meta]"), { autoAlpha: 0, duration: 0.06, ease: "power1.in" }, 0.54)
      .to(outerColumns, { autoAlpha: 0, duration: 0.06, ease: "power1.in" }, 0.56)
      .to(midColumns, { scaleX: 100, transformOrigin: "center center", autoAlpha: 0.5, duration: 0.1, ease: "power2.inOut" }, 0.58);

    timeline
      .to(midColumns, { autoAlpha: 0.16, duration: 0.08 }, 0.7)
      .set(mcpSlide, { autoAlpha: 1 }, 0.7)
      .from(q("[data-mcp-letter]"), { yPercent: 40, autoAlpha: 0, stagger: 0.02, duration: 0.1, ease: "power2.out" }, 0.7)
      .from(q("[data-mcp-meta]"), { autoAlpha: 0, y: 16, duration: 0.08, ease: "power2.out" }, 0.76);

    timeline.to([...slides, ...columns], { yPercent: -18, autoAlpha: 0, duration: 0.16, ease: "power2.in" }, 0.84);
  }, []);

  useSceneTimeline(ref, build);

  return (
    <section ref={ref} id="interfaces" data-scene="interfaces" data-theme-scene="dark" className="landing-scene relative overflow-hidden bg-lp text-li lg:h-screen">
      <h2 className="sr-only">Interfaces — proxy, REST API, and MCP server</h2>

      {columnPositions.map((position) => (
        <div key={position} data-col aria-hidden="true" className={`absolute bottom-0 top-0 hidden w-px bg-li/70 lg:block ${position}`} />
      ))}

      {copy.interfaces.slides.map((slide, slideIndex) => (
        <div
          key={slide.word}
          data-slide
          className="border-t border-ll px-5 py-20 first:border-t-0 sm:px-6 motion-safe:lg:absolute motion-safe:lg:inset-0 motion-safe:lg:flex motion-safe:lg:flex-col motion-safe:lg:items-center motion-safe:lg:justify-center motion-safe:lg:border-t-0 motion-safe:lg:py-0"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lm lg:absolute lg:left-6 lg:top-20">
            {slide.index} / {slide.word}
          </p>

          {slideIndex === 2 ? (
            <p aria-hidden="true" data-word data-word-mcp className="whitespace-nowrap font-display text-[clamp(6rem,20vw,22rem)] font-black uppercase leading-[0.82] tracking-[-0.02em]">
              {slide.word.split("").map((letter, letterIndex) => (
                <span key={`${letter}-${letterIndex}`} data-mcp-letter className="inline-block">
                  {letter}
                </span>
              ))}
            </p>
          ) : (
            <p
              data-word
              data-word-proxy={slideIndex === 0 ? true : undefined}
              data-word-api={slideIndex === 1 ? true : undefined}
              className={`whitespace-nowrap font-display text-[clamp(6rem,20vw,22rem)] font-black uppercase leading-[0.82] tracking-[-0.02em] ${
                slideIndex === 0 ? "[font-variation-settings:'wdth'_62]" : ""
              }`}
            >
              {slide.word}
            </p>
          )}

          <p
            data-api-meta={slideIndex === 1 ? true : undefined}
            data-mcp-meta={slideIndex === 2 ? true : undefined}
            className="mt-6 max-w-[36rem] font-display text-[clamp(1.2rem,1.8vw,1.8rem)] font-bold uppercase leading-[1.15] lg:absolute lg:bottom-24 lg:left-6 lg:mt-0"
          >
            {slide.line}
          </p>
          <p
            data-api-meta={slideIndex === 1 ? true : undefined}
            data-mcp-meta={slideIndex === 2 ? true : undefined}
            className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-lm lg:absolute lg:bottom-24 lg:right-6 lg:mt-0"
          >
            {slide.tech}
          </p>
        </div>
      ))}
    </section>
  );
}
