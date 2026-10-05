// Test helpers: build carts from the real menu that add up to exact amounts.
import { localMenu } from "@/data/menu-data";
import type { ItemSelection } from "@/lib/pricing";

type Variant = { productId: string; addonIds: string[]; price: number };

// Every simple product (single price, no required choices), alone or with one or
// two of its add-ons. (Menu prices all end in 9, so add-ons are needed to reach
// round amounts like ₱300.)
const VARIANTS: Variant[] = localMenu.products
  .filter((p) => p.isAvailable && p.sizes.length === 0 && p.variantGroups.length === 0)
  .flatMap((p) => {
    const addons = localMenu.addons.filter((a) => a.isAvailable && p.addonIds.includes(a.id));
    const sets: string[][] = [[]];
    addons.forEach((a, i) => {
      sets.push([a.id]);
      addons.slice(i + 1).forEach((b) => sets.push([a.id, b.id]));
    });
    return sets.map((ids) => ({
      productId: p.id,
      addonIds: ids,
      price: p.basePrice + ids.reduce((sum, id) => sum + (addons.find((a) => a.id === id)?.price ?? 0), 0),
    }));
  })
  .sort((a, b) => a.price - b.price);

/** A cart of menu items whose subtotal is exactly `target` pesos. */
export function cartTotalling(target: number): ItemSelection[] {
  // best[amount] = one combination of variants (variant index → quantity) totalling `amount`.
  const best = new Map<number, Map<number, number>>([[0, new Map()]]);
  for (let amount = 1; amount <= target; amount++) {
    for (let i = 0; i < VARIANTS.length; i++) {
      const rest = best.get(amount - VARIANTS[i].price);
      if (!rest || (rest.get(i) ?? 0) >= 20) continue;
      const combo = new Map(rest);
      combo.set(i, (rest.get(i) ?? 0) + 1);
      best.set(amount, combo);
      break;
    }
  }
  const combo = best.get(target);
  if (!combo) throw new Error(`No cart totals ₱${target}`);
  return [...combo].map(([i, quantity]) => ({
    productId: VARIANTS[i].productId,
    sizeId: null,
    optionIds: [],
    addonIds: VARIANTS[i].addonIds,
    quantity,
    notes: "",
  }));
}

export function line(productId: string, extra: Partial<ItemSelection> = {}): ItemSelection {
  return { productId, sizeId: null, optionIds: [], addonIds: [], quantity: 1, notes: "", ...extra };
}
