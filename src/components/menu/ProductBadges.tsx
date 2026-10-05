import { Sparkle } from "@/components/brand/Sparkle";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/menu";

const pill = "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[0.6875rem] font-bold tracking-wide uppercase";

export function ProductBadges({ product, className }: { product: Product; className?: string }) {
  if (!product.isAvailable) {
    return (
      <div className={cn("flex gap-1.5", className)}>
        <span className={cn(pill, "bg-espresso/85 text-foam")}>Sold out</span>
      </div>
    );
  }

  if (!product.badge) return null;

  return (
    <div className={cn("flex gap-1.5", className)}>
      {product.badge === "best_seller" && (
        <span className={cn(pill, "bg-caramel text-foam")}>
          <Sparkle className="size-2.5" />
          Best seller
        </span>
      )}
      {product.badge === "new" && <span className={cn(pill, "bg-foam text-coffee ring-1 ring-coffee/25")}>New</span>}
    </div>
  );
}
