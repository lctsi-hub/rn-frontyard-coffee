import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/menu";
import { OpenProductButton } from "./OpenProductButton";
import { Price } from "./Price";
import { ProductArt } from "./ProductArt";
import { ProductBadges } from "./ProductBadges";

export function ProductCard({ product, categorySlug }: { product: Product; categorySlug: string }) {
  const soldOut = !product.isAvailable;

  return (
    <article
      className={cn(
        "relative flex gap-3 rounded-[1.75rem] bg-foam p-3 shadow-card ring-1 ring-espresso/5 min-[360px]:gap-4",
        soldOut
          ? "bg-foam/60 shadow-none"
          : "transition-transform duration-150 ease-out has-[button:active]:scale-[0.98]",
      )}
    >
      <ProductArt
        imageUrl={product.imageUrl}
        name={product.name}
        categorySlug={categorySlug}
        sizes="112px"
        soldOut={soldOut}
        className="size-24 shrink-0 rounded-[1.25rem] min-[360px]:size-28"
      />

      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <ProductBadges product={product} className="mb-1.5" />
        <h3
          className={cn(
            "font-display text-[1.0625rem] leading-snug font-semibold break-words min-[360px]:text-lg",
            soldOut && "text-espresso/60",
          )}
        >
          {soldOut ? product.name : <OpenProductButton productId={product.id}>{product.name}</OpenProductButton>}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-snug text-mocha">{product.description}</p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0">
            <Price product={product} className={cn("text-base", soldOut && "text-espresso/50")} />
            {product.sizes.length > 1 && (
              <p className="truncate text-xs text-mocha">{product.sizes.map((s) => s.name).join(" · ")}</p>
            )}
          </div>
          {!soldOut && (
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-espresso text-foam shadow-card"
            >
              <Plus className="size-5" strokeWidth={2.5} />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
