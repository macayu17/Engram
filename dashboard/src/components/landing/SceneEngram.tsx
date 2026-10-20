"use client";

import gsap from "gsap";
import { useCallback, useRef } from "react";

import { copy } from "./copy";
import { useSceneTimeline } from "./useSceneTimeline";

const riseOffsets = [120, 80, 140, 95, 130, 105];
const tiltAngles = [-18, 12, -24, 16, -10, 20];

export function SceneEngram() {
  const ref = useRef<HTMLElement>(null);

  const build = useCallback(({ root, isDesktop }: { root: HTMLElement; isDesktop: boolean }) => {
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
      .from(
        q("[data-eletter]"),
        {
          yPercent: (index) => riseOffsets[index % riseOffsets.length],
          rotation: (index) => tiltAngles[index % tiltAngles.length],
          autoAlpha: 0,
          stagger: 0.055,
          duration: 0.34,
          ease: "power2.out",
        },
        0,
      )
      .from(q("[data-support]"), { clipPath: "inset(100% 0 0 0)", autoAlpha: 0, duration: 0.12, ease: "power2.out" }, 0.24)
      .to(q("[data-word]"), { scale: isDesktop ? 9 : 5.5, duration: 0.42, ease: "power2.in" }, 0.44)
      .fromTo(
        q("[data-reveal]"),
        { clipPath: isDesktop ? "circle(0% at 44% 50%)" : "inset(100% 0% 0% 0%)" },
        { clipPath: isDesktop ? "circle(150% at 44% 50%)" : "inset(0% 0% 0% 0%)", duration: 0.42, ease: "power1.inOut" },
        0.46,
      )
      .to(q("[data-word]"), { autoAlpha: 0, duration: 0.12, ease: "power1.in" }, 0.68)
      .from(q("[data-detail]"), { autoAlpha: 0, y: 10, duration: 0.1, ease: "power1.out" }, 0.76);
  }, []);

  useSceneTimeline(ref, build);

  return (
    <section ref={ref} data-scene="engram" data-theme-scene="dark" className="landing-scene relative h-screen overflow-hidden bg-lp text-li">
      <h2 className="sr-only">{copy.engram.srTitle}</h2>

      <p data-support className="absolute bottom-[9vh] left-5 font-mono text-[11px] uppercase tracking-[0.22em] text-lm sm:left-6">
        {copy.engram.support}
      </p>

      <div data-reveal aria-hidden="true" className="absolute inset-0 bg-[rgb(224_222_215)]">
        <p className="absolute bottom-[9vh] left-5 max-w-[36rem] font-mono text-[11px] uppercase leading-5 tracking-[0.18em] text-[rgb(91_96_90)] sm:left-6" data-detail>
          {copy.engram.detail}
        </p>
      </div>

      <div data-word aria-hidden="true" className="absolute inset-0 flex items-center justify-center [transform-origin:44%_50%]">
        <div className="whitespace-nowrap">
          {copy.engram.word.split("").map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              data-eletter
              className="inline-block font-display text-[clamp(4.5rem,17vw,18rem)] font-black uppercase leading-[0.8] tracking-[-0.02em]"
            >
              {letter}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
