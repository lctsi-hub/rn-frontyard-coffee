"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useProductSheet } from "./ProductSheet";

/**
 * Wraps a product name. Its ::after stretches over the whole (relative) card,
 * so tapping anywhere on the card opens the product sheet.
 */
export function OpenProductButton({
  productId,
  className,
  children,
}: {
  productId: string;
  className?: string;
  children: ReactNode;
}) {
  const { openProduct } = useProductSheet();

  return (
    <button
      type="button"
      onClick={() => openProduct(productId)}
      className={cn(
        "text-left after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-caramel",
        className,
      )}
    >
      {children}
    </button>
  );
}
