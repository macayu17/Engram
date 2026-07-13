"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef } from "react";

export function LandingMotion({ children, className }: { children: React.ReactNode; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const listenerCleanups: Array<() => void> = [];
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "power4.out" } })
        .from("[data-motion='hero-line']", { yPercent: 110, duration: 0.85, stagger: 0.09 })
        .from("[data-motion='hero-support']", { autoAlpha: 0, y: 18, duration: 0.55, stagger: 0.07 }, "-=0.45")
        .from("[data-motion='hero-demo']", { autoAlpha: 0, x: 28, duration: 0.7 }, "-=0.5");

      gsap.fromTo(
        "[data-motion='problem-word']",
        { opacity: 0.14 },
        {
          opacity: 1,
          stagger: 0.025,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-motion='problem-copy']",
            start: "top 78%",
            end: "bottom 55%",
            scrub: true,
          },
        },
      );

      gsap.utils.toArray<HTMLElement>("[data-motion='loop-card']").forEach((element, index) => {
        gsap.from(element, {
          y: 30,
          scale: 0.985,
          duration: 0.65,
          delay: (index % 3) * 0.06,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: {
            trigger: element,
            start: "top 88%",
            once: true,
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-motion='reveal']").forEach((element) => {
        gsap.from(element, {
          y: 28,
          scale: 0.99,
          duration: 0.7,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: {
            trigger: element,
            start: "top 84%",
            once: true,
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-motion='section-heading']").forEach((element) => {
        gsap.from(element, {
          y: 22,
          rotateX: 4,
          transformPerspective: 800,
          transformOrigin: "50% 100%",
          duration: 0.75,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: {
            trigger: element,
            start: "top 86%",
            once: true,
          },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-score]").forEach((element, index) => {
        const finalScore = Number(element.dataset.score);
        const scoreGroup = element.closest<HTMLElement>("[data-motion='score-group']");
        if (!scoreGroup || !Number.isFinite(finalScore)) return;

        const counter = { value: 0 };
        gsap.to(counter, {
          value: finalScore,
          duration: 0.8,
          delay: index * 0.12,
          ease: "power2.out",
          onStart: () => { element.textContent = "0.00"; },
          onUpdate: () => { element.textContent = counter.value.toFixed(2); },
          onComplete: () => { element.textContent = finalScore.toFixed(2); },
          scrollTrigger: {
            trigger: scoreGroup,
            start: "top 82%",
            once: true,
          },
        });
      });

      if (window.matchMedia("(pointer: fine)").matches) {
        gsap.utils.toArray<HTMLElement>("[data-magnetic]").forEach((element) => {
          const moveX = gsap.quickTo(element, "x", { duration: 0.35, ease: "power3.out" });
          const moveY = gsap.quickTo(element, "y", { duration: 0.35, ease: "power3.out" });
          const handleMove = (event: PointerEvent) => {
            const bounds = element.getBoundingClientRect();
            moveX((event.clientX - bounds.left - bounds.width / 2) * 0.12);
            moveY((event.clientY - bounds.top - bounds.height / 2) * 0.12);
          };
          const handleLeave = () => {
            moveX(0);
            moveY(0);
          };
          element.addEventListener("pointermove", handleMove);
          element.addEventListener("pointerleave", handleLeave);
          listenerCleanups.push(() => {
            element.removeEventListener("pointermove", handleMove);
            element.removeEventListener("pointerleave", handleLeave);
          });
        });
      }

      media.add("(min-width: 1024px)", () => {
        const section = root.querySelector<HTMLElement>("[data-motion='interfaces-section']");
        const track = root.querySelector<HTMLElement>("[data-motion='interfaces-track']");
        if (!section || !track) return;

        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + track.offsetLeft + 80);
        gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top 64px",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
      });
    }, root);

    return () => {
      listenerCleanups.forEach((cleanup) => cleanup());
      media.revert();
      context.revert();
    };
  }, []);

  return <div ref={rootRef} className={className}>{children}</div>;
}
