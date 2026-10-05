// Applies Bam's Available / Sold out switches (table menu_availability) on top
// of the menu defined in code. A missing row means "use the code default".
import type { Menu } from "@/types/menu";

export type AvailabilityRow = { item_type: "product" | "addon"; item_key: string; is_available: boolean };

export function applyAvailability(menu: Menu, rows: AvailabilityRow[]): Menu {
  if (rows.length === 0) return menu;
  const products = new Map(rows.filter((r) => r.item_type === "product").map((r) => [r.item_key, r.is_available]));
  const addons = new Map(rows.filter((r) => r.item_type === "addon").map((r) => [r.item_key, r.is_available]));
  return {
    ...menu,
    products: menu.products.map((p) => (products.has(p.id) ? { ...p, isAvailable: products.get(p.id)! } : p)),
    addons: menu.addons.map((a) => (addons.has(a.id) ? { ...a, isAvailable: addons.get(a.id)! } : a)),
  };
}
