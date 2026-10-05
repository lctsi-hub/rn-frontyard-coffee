"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const button =
  "grid shrink-0 place-items-center rounded-full transition-[transform,background-color] duration-150 active:scale-90 disabled:opacity-35 disabled:active:scale-100";

/** − 2 + control; the number pops when it changes. */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  size = "md",
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const dims = size === "sm" ? "size-9" : "size-11";

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex items-center rounded-full bg-oat/70 p-1", size === "sm" ? "gap-1" : "gap-1.5")}
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className={cn(button, dims, "bg-foam text-espresso shadow-card")}
      >
        <Minus className="size-4" strokeWidth={2.5} />
      </button>

      <span
        key={value}
        aria-live="polite"
        className={cn(
          "animate-pop text-center font-semibold tabular-nums",
          size === "sm" ? "w-6 text-sm" : "w-7 text-base",
        )}
      >
        {value}
      </span>

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
        className={cn(button, dims, "bg-espresso text-foam shadow-card")}
      >
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
