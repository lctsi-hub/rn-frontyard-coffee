import { localMenu } from "@/data/menu-data";
import type { Category, Menu, Product } from "@/types/menu";

/**
 * Single entry point for menu data. Returns the local menu file for now; once
 * the database is connected only this function changes, not the pages.
 */
export async function getMenu(): Promise<Menu> {
  return localMenu;
}

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
