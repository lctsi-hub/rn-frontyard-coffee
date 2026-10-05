import { cn } from "@/lib/utils";
import type { Product } from "@/types/menu";
import { OpenProductButton } from "./OpenProductButton";
import { Price } from "./Price";
import { ProductArt } from "./ProductArt";
import { ProductBadges } from "./ProductBadges";

/** Horizontally swipeable row of featured products. */
export function FeaturedRow({
  title,
  products,
  categorySlugById,
}: {
  title: string;
  products: Product[];
  categorySlugById: Record<string, string>;
}) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="featured-heading" className="mt-8">
      <div className="flex items-baseline justify-between px-4">
        <h2 id="featured-heading" className="font-display text-xl font-semibold">
          {title}
        </h2>
        <span aria-hidden="true" className="text-xs text-mocha">
          Swipe →
        </span>
      </div>

      <ul className="no-scrollbar mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-3">
        {products.map((product) => {
          const soldOut = !product.isAvailable;
          return (
            <li key={product.id} className="w-[62%] max-w-60 shrink-0 snap-start">
              <article
                className={cn(
                  "relative overflow-hidden rounded-[1.75rem] bg-foam shadow-card ring-1 ring-espresso/5",
                  !soldOut && "transition-transform duration-150 ease-out has-[button:active]:scale-[0.97]",
                )}
              >
                <div className="relative">
                  <ProductArt
                    imageUrl={product.imageUrl}
                    name={product.name}
                    categorySlug={categorySlugById[product.categoryId]}
                    sizes="(max-width: 448px) 62vw, 240px"
                    soldOut={soldOut}
                    className="aspect-[4/3] w-full"
                  />
                  <ProductBadges product={product} className="absolute top-3 left-3" />
                </div>
                <div className="p-3.5">
                  <h3 className="font-display truncate text-base leading-snug font-semibold">
                    {soldOut ? (
                      product.name
                    ) : (
                      <OpenProductButton productId={product.id}>{product.name}</OpenProductButton>
                    )}
                  </h3>
                  <Price product={product} className="mt-0.5 text-sm" />
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
