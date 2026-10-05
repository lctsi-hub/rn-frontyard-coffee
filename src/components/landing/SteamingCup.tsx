import { cn } from "@/lib/utils";

const STEAM_WISPS = [
  { d: "M96 88c-10-12 8-20 0-34-6-10 4-18 0-28", delay: "0s" },
  { d: "M120 82c-10-14 10-22 0-38-6-10 4-18 0-30", delay: "1.2s" },
  { d: "M144 88c-10-12 8-20 0-34-6-10 4-18 0-28", delay: "2.4s" },
];

/** Illustrated cup with latte art and rising steam. Pure SVG + CSS, no JS. */
export function SteamingCup({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)} aria-hidden="true">
      <div className="absolute inset-x-6 top-1/4 bottom-4 rounded-full bg-honey/35 blur-3xl" />
      <svg viewBox="0 0 240 220" className="relative w-full animate-bob">
        <g fill="none" stroke="var(--color-latte)" strokeWidth="7" strokeLinecap="round">
          {STEAM_WISPS.map((wisp) => (
            <path
              key={wisp.d}
              d={wisp.d}
              data-steam
              className="animate-steam"
              style={{ animationDelay: wisp.delay, transformBox: "fill-box", transformOrigin: "50% 100%" }}
            />
          ))}
        </g>

        {/* saucer */}
        <ellipse cx="120" cy="196" rx="96" ry="17" fill="var(--color-oat)" />
        <ellipse cx="120" cy="193" rx="62" ry="9" fill="var(--color-latte)" opacity="0.45" />

        {/* handle */}
        <path
          d="M184 124c30-6 36 38-6 44"
          fill="none"
          stroke="var(--color-espresso)"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* cup body */}
        <path
          d="M50 110h140c0 44-18 76-48 82h-44c-30-6-48-38-48-82z"
          fill="var(--color-foam)"
          stroke="var(--color-espresso)"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <path d="M58 132c18 6 106 6 124 0" fill="none" stroke="var(--color-oat)" strokeWidth="5" strokeLinecap="round" />

        {/* coffee + latte-art heart */}
        <ellipse cx="120" cy="110" rx="70" ry="13" fill="var(--color-coffee)" stroke="var(--color-espresso)" strokeWidth="4.5" />
        <path
          d="M120 115c-14-4-20-10-15-14 4-3 10-1 15 3 5-4 11-6 15-3 5 4-1 10-15 14z"
          fill="var(--color-latte)"
          opacity="0.9"
        />

        {/* logo sparkle on the cup */}
        <path
          d="M120 146c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z"
          fill="var(--color-caramel)"
        />
      </svg>
    </div>
  );
}
