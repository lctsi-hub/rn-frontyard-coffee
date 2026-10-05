import { formatPeso } from "@/lib/format";
import { startingPrice } from "@/lib/menu-display";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/menu";

/** "₱120", or "from ₱120" when sizes have different prices. */
export function Price({ product, className }: { product: Product; className?: string }) {
  const prices = new Set(product.sizes.map((s) => s.price));

  return (
    <p className={cn("font-semibold tabular-nums", className)}>
      {prices.size > 1 && <span className="mr-1 text-xs font-medium text-mocha">from</span>}
      {formatPeso(startingPrice(product))}
    </p>
  );
}
