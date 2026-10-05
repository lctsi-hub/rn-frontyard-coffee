// Display helpers kept separate from lib/menu so client components can import
// them without pulling menu data into the browser bundle.
import type { Product } from "@/types/menu";

export function categorySectionId(slug: string) {
  return `category-${slug}`;
}

/** Lowest price a customer can pay for the product, for "from ₱120" labels. */
export function startingPrice(product: Product) {
  return product.sizes.length > 0 ? Math.min(...product.sizes.map((s) => s.price)) : product.basePrice;
}
