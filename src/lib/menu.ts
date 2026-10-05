import "server-only";

import { cache } from "react";
import { localMenu } from "@/data/menu-data";
import { applyAvailability, type AvailabilityRow } from "@/lib/menu-availability";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabasePublicServerClient } from "@/lib/supabase/public";
import type { Category, Menu, Product } from "@/types/menu";

/**
 * The menu for this request: products, prices and photos from
 * src/data/menu-data.ts, with Bam's Available / Sold out switches from the
 * database applied on top. If the switches can't be read (e.g. the
 * menu_availability migration isn't applied yet), the code menu is used as-is.
 */
let warned = false;

export const getMenu = cache(async (): Promise<Menu> => {
  if (!isSupabaseConfigured()) return localMenu;
  try {
    const { data, error } = await createSupabasePublicServerClient()
      .from("menu_availability")
      .select("item_type, item_key, is_available");
    if (error) throw error;
    return applyAvailability(localMenu, (data ?? []) as AvailabilityRow[]);
  } catch (error) {
    if (!warned) {
      warned = true;
      console.error("[menu] availability unavailable, using code menu", { code: (error as { code?: string })?.code });
    }
    return localMenu;
  }
});

export type CategoryWithProducts = Category & { products: Product[] };

export function groupByCategory(menu: Menu): CategoryWithProducts[] {
  return [...menu.categories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => ({
      ...category,
      products: menu.products
        .filter((p) => p.categoryId === category.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((category) => category.products.length > 0);
}
