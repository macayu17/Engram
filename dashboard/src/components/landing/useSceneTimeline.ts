"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, type RefObject } from "react";

gsap.registerPlugin(ScrollTrigger);

export function useSceneTimeline(
  ref: RefObject<HTMLElement | null>,
  build: (tools: { root: HTMLElement; isDesktop: boolean }) => void,
) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add("(min-width: 1024px)", () => build({ root, isDesktop: true }));
      media.add("(max-width: 1023px)", () => build({ root, isDesktop: false }));
    }, root);

    return () => context.revert();
  }, [ref, build]);
}
