"use client";

import { useEffect, useRef, useState } from "react";
import { categorySectionId } from "@/lib/menu-display";
import { cn } from "@/lib/utils";

type NavCategory = { slug: string; name: string };

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Sticky, swipeable category chips. Tapping a chip jumps to that section;
 * scrolling the menu highlights the section currently in view.
 */
export function CategoryNav({ categories }: { categories: NavCategory[] }) {
  const [active, setActive] = useState(categories[0]?.slug);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = categories
      .map((c) => document.getElementById(categorySectionId(c.slug)))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const topmost = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const slug = topmost?.target.getAttribute("data-category");
        if (slug) setActive(slug);
      },
      // Treat a section as "current" once it reaches the band just below the sticky bars.
      { rootMargin: "-130px 0px -60% 0px" },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!list || !chip) return;

    list.scrollTo({
      left: chip.offsetLeft - list.clientWidth / 2 + chip.clientWidth / 2,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [active]);

  return (
    <nav
      aria-label="Menu categories"
      className="sticky top-[calc(var(--header-h)+env(safe-area-inset-top))] z-20 h-(--category-nav-h) border-b border-espresso/5 bg-cream/95 backdrop-blur-md"
    >
      <div ref={listRef} className="no-scrollbar mx-auto flex h-full max-w-md items-center gap-2 overflow-x-auto px-4">
        {categories.map((category) => {
          const isActive = category.slug === active;
          return (
            <a
              key={category.slug}
              href={`#${categorySectionId(category.slug)}`}
              data-chip={category.slug}
              aria-current={isActive ? "true" : undefined}
              onClick={() => setActive(category.slug)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors duration-200",
                isActive ? "bg-espresso text-foam" : "bg-foam text-coffee ring-1 ring-espresso/10",
              )}
            >
              {category.name}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
