import type { CSSProperties } from "react";
import { Sparkle } from "@/components/brand/Sparkle";

type Bean = { top: string; left: string; size: number; rotate: number; dx: number; dy: number; duration: number; delay: number };

const BEANS: Bean[] = [
  { top: "8%", left: "8%", size: 26, rotate: -20, dx: 14, dy: -22, duration: 15, delay: 0 },
  { top: "18%", left: "84%", size: 20, rotate: 35, dx: -12, dy: -18, duration: 18, delay: -4 },
  { top: "44%", left: "4%", size: 18, rotate: 70, dx: 10, dy: -26, duration: 17, delay: -8 },
  { top: "52%", left: "90%", size: 24, rotate: -50, dx: -16, dy: -20, duration: 14, delay: -2 },
  { top: "76%", left: "2%", size: 16, rotate: 10, dx: 8, dy: -16, duration: 19, delay: -6 },
  { top: "86%", left: "91%", size: 18, rotate: 120, dx: -8, dy: -20, duration: 16, delay: -10 },
];

// Kept in the upper half so they never sit behind the headline or button.
const SPARKLES = [
  { top: "14%", left: "22%", size: 14, delay: "0s" },
  { top: "28%", left: "72%", size: 18, delay: "1.1s" },
  { top: "40%", left: "14%", size: 12, delay: "2.2s" },
  { top: "46%", left: "84%", size: 14, delay: "0.6s" },
];

function CoffeeBean({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 32" width={size} height={size * 1.33}>
      <ellipse cx="12" cy="16" rx="10" ry="14" fill="var(--color-coffee)" />
      <path d="M12 3c-4 6 4 12 0 26" fill="none" stroke="var(--color-espresso)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** Slowly drifting beans and twinkling logo sparkles. Transform/opacity only, so it stays smooth on phones. */
export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {BEANS.map((bean, i) => (
        <span
          key={i}
          className="absolute animate-drift opacity-25"
          style={
            {
              top: bean.top,
              left: bean.left,
              "--rotate": `${bean.rotate}deg`,
              "--dx": `${bean.dx}px`,
              "--dy": `${bean.dy}px`,
              animationDuration: `${bean.duration}s`,
              animationDelay: `${bean.delay}s`,
            } as CSSProperties
          }
        >
          <CoffeeBean size={bean.size} />
        </span>
      ))}

      {SPARKLES.map((sparkle, i) => (
        <Sparkle
          key={i}
          className="absolute animate-twinkle text-honey"
          style={{
            top: sparkle.top,
            left: sparkle.left,
            width: sparkle.size,
            height: sparkle.size,
            animationDelay: sparkle.delay,
          }}
        />
      ))}
    </div>
  );
}
