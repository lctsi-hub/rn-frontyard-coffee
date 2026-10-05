import type { CSSProperties } from "react";

/** Four-point star from the Frontyard logo. */
export function Sparkle({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} style={style} fill="currentColor">
      <path d="M12 1.5c.6 5.3 4.2 8.9 9.5 10.5-5.3 1.6-8.9 5.2-9.5 10.5-.6-5.3-4.2-8.9-9.5-10.5C7.8 10.4 11.4 6.8 12 1.5z" />
    </svg>
  );
}
