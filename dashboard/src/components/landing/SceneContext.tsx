"use client";

import gsap from "gsap";
import { useCallback, useRef } from "react";

import { copy } from "./copy";
import { useSceneTimeline } from "./useSceneTimeline";

const axisPositions = ["left-[0%]", "left-[50%]", "left-[70%]", "left-[100%]"];

export function SceneContext() {
  const ref = useRef<HTMLElement>(null);

  const build = useCallback(({ root, isDesktop }: { root: HTMLElement; isDesktop: boolean }) => {
    const q = gsap.utils.selector(root);
    const track = q("[data-track]")[0] as HTMLElement | undefined;

    if (!isDesktop) {
      (q("[data-fragment]") as HTMLElement[]).forEach((fragment) => {
        gsap.from(fragment, {
          y: 44,
          autoAlpha: 0,
          duration: 0.7,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: { trigger: fragment, start: "top 88%", once: true },
        });
      });
      return;
    }

    if (!track) return;

    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "+=210%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    timeline.to(track, { x: () => -(track.scrollWidth - window.innerWidth * 0.94), duration: 0.78 }, 0);

    timeline
      .from(q("[data-labels]"), { autoAlpha: 0, y: 12, duration: 0.08, ease: "power1.out" }, 0.05)
      .to(q("[data-final]"), { scale: 1.3, transformOrigin: "center center", duration: 0.14, ease: "power1.inOut" }, 0.8)
      .to(q("[data-overlay]"), { clipPath: "circle(150% at 82% 55%)", duration: 0.2, ease: "power1.inOut" }, 0.8);
  }, []);

  useSceneTimeline(ref, build);

  return (
    <section ref={ref} id="context" data-scene="context" data-theme-scene="paper" className="landing-scene relative overflow-hidden bg-lp text-li lg:h-screen">
      <header className="px-5 pt-24 sm:px-6 lg:absolute lg:left-6 lg:top-20 lg:p-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-lm">{copy.context.label}</p>
        <h2 className="mt-3 max-w-[64rem] font-display text-[clamp(2rem,4.4vw,4.6rem)] font-black lowercase leading-[0.95] tracking-[-0.02em]">
          {copy.context.query}
        </h2>
      </header>

      <div aria-hidden="true" className="absolute left-0 right-0 top-[40%] hidden lg:block">
        <div className="relative h-px w-full bg-ll">
          {axisPositions.map((position, index) => (
            <span key={position} className={`absolute -top-1.5 h-3 w-px bg-lm ${position}`}>
              <span className="absolute left-1/2 top-4 -translate-x-1/2 font-mono text-[10px] tabular-nums text-lm">
                {copy.loop.axis[index]}
              </span>
            </span>
          ))}
          <span className="absolute -top-2 left-[70%] h-4 w-px bg-lsignal" />
          <span className="absolute -top-8 left-[70%] -translate-x-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-lsignal">
            {copy.context.threshold}
          </span>
        </div>
      </div>

      <div data-track className="flex flex-col gap-14 px-5 py-16 sm:px-6 lg:absolute lg:left-0 lg:top-[46%] lg:w-max lg:flex-row lg:items-end lg:gap-[7vw] lg:py-0 lg:pl-[6vw]">
        {copy.context.memories.map((memory) => (
          <figure key={memory.score} data-fragment className={`lg:w-[26vw] lg:shrink-0 ${memory.rejected ? "opacity-70" : ""}`}>
            <p
              className={`font-mono text-[clamp(3.4rem,8vw,8rem)] leading-none tabular-nums ${
                memory.rejected ? "text-lm line-through decoration-lsignal" : "text-li"
              }`}
            >
              {memory.score}
            </p>
            <figcaption className={`mt-4 max-w-[22rem] font-sans text-lg leading-6 ${memory.rejected ? "text-lm line-through decoration-lsignal/70" : "text-li"}`}>
              {memory.text}
            </figcaption>
            {memory.rejected ? (
              <p className="mt-3 w-max border border-lsignal/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-lsignal">
                {copy.context.rejectedTag}
              </p>
            ) : null}
          </figure>
        ))}
        <p data-final aria-hidden="true" className="hidden font-mono text-[18vw] leading-none tabular-nums text-lsignal lg:block lg:shrink-0 lg:pr-[8vw]">
          0.91
        </p>
      </div>

      <div data-labels className="absolute bottom-[6vh] left-6 hidden gap-10 lg:flex">
        {copy.context.labels.map((label) => (
          <span key={label} className="font-mono text-[11px] uppercase tracking-[0.18em] text-lm">
            {label}
          </span>
        ))}
      </div>

      <div
        data-overlay
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden bg-[rgb(11_10_9)] motion-safe:[clip-path:circle(0%_at_82%_55%)] lg:block"
      />
    </section>
  );
}
