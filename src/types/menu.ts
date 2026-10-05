// Menu shapes used by the customer UI. They mirror the planned Supabase tables
// (categories, products, product_variants, addons, product_addons) so the sample
// data can be swapped for database rows without touching components.
//
// Prices are whole pesos for now; the money type is finalised with the schema.

export type Category = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
};

export type ProductSize = {
  id: string;
  name: string;
  price: number;
};

export type VariantOption = {
  id: string;
  name: string;
  priceDelta: number;
};

export type VariantGroup = {
  id: string;
  name: string;
  required: boolean;
  /** Pre-selected when the product opens (e.g. 100% sweetness). Leave unset to make the customer choose. */
  defaultOptionId?: string;
  options: VariantOption[];
};

export type Addon = {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
};

export type ProductBadge = "best_seller" | "new";

export type Product = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  /** Used when the product has no sizes. */
  basePrice: number;
  sizes: ProductSize[];
  variantGroups: VariantGroup[];
  addonIds: string[];
  isAvailable: boolean;
  isFeatured: boolean;
  badge: ProductBadge | null;
  sortOrder: number;
};

/**
 * A common extra staff can add to an open order on its own (e.g. "Extra Rice").
 * Its price and availability come from the add-on it points to, so there is
 * one place to change them.
 */
export type QuickExtra = {
  /** Stored as the order line's product key, e.g. "extra-rice". */
  id: string;
  name: string;
  /** Add-on that sets the price and the Sold out state. */
  addonId: string;
  /** Short label for the one-tap button on dine-in orders (e.g. "Rice"); omit for no button. */
  quickButton?: string;
};

export type Menu = {
  categories: Category[];
  products: Product[];
  addons: Addon[];
  source: "local" | "database";
};
