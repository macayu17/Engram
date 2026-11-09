"use client";

import { useEffect, useRef } from "react";

type Point = { x: number; y: number; z: number; size: number; recalled: boolean };

function makePoints(count: number): Point[] {
  const points: Point[] = [];
  for (let index = 0; index < count; index++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 0.55 + Math.random() * 0.45;
    points.push({
      x: radius * Math.sin(phi) * Math.cos(theta),
      y: radius * Math.sin(phi) * Math.sin(theta) * 0.9,
      z: radius * Math.cos(phi),
      size: 1.5 + Math.random() * 3.5,
      recalled: index % 23 === 0,
    });
  }
  return points;
}

export function MemoryField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const points = makePoints(220);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const styles = getComputedStyle(document.documentElement);
    let frame = 0;
    let angle = 0.6;
    let last = performance.now();

    function draw() {
      if (!canvas || !context) return;
      const ink = styles.getPropertyValue("--color-ink").trim();
      const signal = styles.getPropertyValue("--color-signal").trim();
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const scale = Math.min(width, height) * 0.46;
      const centerX = width / 2;
      const centerY = height / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const projected = points
        .map((point) => {
          const x = point.x * cos - point.z * sin;
          const z = point.x * sin + point.z * cos;
          const depth = (z + 1.4) / 2.4;
          return { point, screenX: centerX + x * scale, screenY: centerY + point.y * scale, depth };
        })
        .sort((first, second) => first.depth - second.depth);

      context.lineWidth = 1;
      for (const item of projected) {
        if (!item.point.recalled) continue;
        context.strokeStyle = `oklch(${signal} / ${0.12 + item.depth * 0.25})`;
        context.beginPath();
        context.moveTo(centerX, centerY);
        context.lineTo(item.screenX, item.screenY);
        context.stroke();
      }

      for (const item of projected) {
        const size = item.point.size * (0.5 + item.depth * 0.7);
        context.fillStyle = item.point.recalled
          ? `oklch(${signal} / ${0.55 + item.depth * 0.45})`
          : `oklch(${ink} / ${0.08 + item.depth * 0.42})`;
        context.fillRect(item.screenX - size / 2, item.screenY - size / 2, size, size);
      }

      context.fillStyle = `oklch(${signal})`;
      context.fillRect(centerX - 4, centerY - 4, 8, 8);
    }

    function tick(now: number) {
      angle += ((now - last) / 1000) * 0.06;
      last = now;
      draw();
      frame = requestAnimationFrame(tick);
    }

    if (reduced) {
      draw();
    } else {
      frame = requestAnimationFrame(tick);
    }

    const observer = new MutationObserver(draw);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("resize", draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
