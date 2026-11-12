"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/site-styles";

export type DocsNavGroup = { title: string; items: { id: string; label: string }[] };

export function DocsNav({ groups }: { groups: DocsNavGroup[] }) {
  const [current, setCurrent] = useState(groups[0]?.items[0]?.id ?? "");

  useEffect(() => {
    const headings = groups.flatMap((group) => group.items.map((item) => document.getElementById(item.id))).filter((node): node is HTMLElement => Boolean(node));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setCurrent(entry.target.id);
        });
      },
      { rootMargin: "-90px 0px -70% 0px" },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [groups]);

  return (
    <nav aria-label="Docs" className="flex flex-row flex-wrap gap-0.5 self-start text-sm lg:sticky lg:top-[84px] lg:flex-col">
      {groups.map((group, index) => (
        <div key={group.title} className="contents">
          <h4
            className={cn(
              "mb-1.5 hidden font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted lg:block",
              index === 0 ? "mt-0" : "mt-[18px]",
            )}
          >
            {group.title}
          </h4>
          {group.items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={current === item.id ? "true" : undefined}
              className={cn(
                "border-l-2 border-transparent px-2.5 py-[5px] text-ink-muted no-underline hover:text-ink aria-[current=true]:border-hot aria-[current=true]:text-ink",
                focusRing,
              )}
            >
              {item.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}
