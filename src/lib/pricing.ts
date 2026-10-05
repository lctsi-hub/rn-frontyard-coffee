// Pure pricing + validation shared by the product sheet, cart and (later) the
// server, which must recompute totals itself instead of trusting the browser.
import type { Addon, Menu, Product, ProductSize, VariantGroup, VariantOption } from "@/types/menu";

export const MAX_QUANTITY = 20;
export const MAX_NOTES_LENGTH = 140;

/** What the customer picked for one product. Only ids; names and prices come from the menu. */
export type ItemSelection = {
  productId: string;
  sizeId: string | null;
  /** One option id per variant group. */
  optionIds: string[];
  addonIds: string[];
  quantity: number;
  notes: string;
};

export type MenuIndex = {
  products: Map<string, Product>;
  addons: Map<string, Addon>;
  categorySlugs: Map<string, string>;
};

export function buildMenuIndex(menu: Menu): MenuIndex {
  return {
    products: new Map(menu.products.map((p) => [p.id, p])),
    addons: new Map(menu.addons.map((a) => [a.id, a])),
    categorySlugs: new Map(menu.categories.map((c) => [c.id, c.slug])),
  };
}

export type SelectionProblem = { key: "size" | string; message: string };

/** Missing required choices, keyed by "size" or the variant group id. */
export function findMissingChoices(product: Product, selection: Pick<ItemSelection, "sizeId" | "optionIds">) {
  const problems: SelectionProblem[] = [];
  if (product.sizes.length > 0 && !product.sizes.some((s) => s.id === selection.sizeId)) {
    problems.push({ key: "size", message: "Please choose a size." });
  }
  for (const group of product.variantGroups) {
    if (group.required && !group.options.some((o) => selection.optionIds.includes(o.id))) {
      problems.push({ key: group.id, message: `Please choose ${group.name.toLowerCase()}.` });
    }
  }
  return problems;
}

export type ChosenOption = { group: VariantGroup; option: VariantOption };

/** "Iced", but "Sweetness 75%" when the option alone wouldn't make sense. */
export function optionLabel({ group, option }: ChosenOption) {
  return /^\d/.test(option.name) ? `${group.name} ${option.name}` : option.name;
}

export type PricedItem = {
  product: Product;
  size: ProductSize | null;
  options: ChosenOption[];
  addons: Addon[];
  unitPrice: number;
  lineTotal: number;
  /** Reasons this item can't be ordered as-is (sold out, option removed, ...). */
  issues: string[];
};

export function priceItem(index: MenuIndex, selection: ItemSelection): PricedItem | null {
  const product = index.products.get(selection.productId);
  if (!product) return null;

  const issues: string[] = [];
  if (!product.isAvailable) issues.push("Sold out");

  const size = product.sizes.find((s) => s.id === selection.sizeId) ?? null;

  const options: ChosenOption[] = [];
  for (const group of product.variantGroups) {
    const option = group.options.find((o) => selection.optionIds.includes(o.id));
    if (option) options.push({ group, option });
  }

  const addons: Addon[] = [];
  for (const addonId of selection.addonIds) {
    const addon = index.addons.get(addonId);
    if (!addon || !product.addonIds.includes(addonId)) {
      issues.push("An add-on is no longer offered");
    } else {
      if (!addon.isAvailable) issues.push(`${addon.name} is unavailable`);
      addons.push(addon);
    }
  }

  if (findMissingChoices(product, selection).length > 0) issues.push("Options changed, please edit");

  const unitPrice =
    (size?.price ?? product.basePrice) +
    options.reduce((sum, { option }) => sum + option.priceDelta, 0) +
    addons.reduce((sum, addon) => sum + addon.price, 0);

  return { product, size, options, addons, unitPrice, lineTotal: unitPrice * selection.quantity, issues };
}

/** Totals for a list of cart lines. Lines that can't be ordered are listed but not counted. */
export function summarizeCart<T extends ItemSelection>(index: MenuIndex, lines: T[]) {
  const items = lines.map((line) => ({ line, priced: priceItem(index, line) }));
  const orderable = items.filter(({ priced }) => priced && priced.issues.length === 0);
  return {
    items,
    itemCount: orderable.reduce((sum, { line }) => sum + line.quantity, 0),
    subtotal: orderable.reduce((sum, { priced }) => sum + (priced?.lineTotal ?? 0), 0),
    hasProblems: orderable.length < items.length,
  };
}
