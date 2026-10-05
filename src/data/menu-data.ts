// =============================================================================
// RN FRONTYARD COFFEE MENU
// Items and prices copied from the shop's printed menu boards
// (assets/menu-boards/). Descriptions are short drafts for Bam to review.
// Lives here until the admin menu manager + database replace it.
//
// HOW TO EDIT
// - Prices are whole pesos: 99 means ₱99.
// - One price:              basePrice: 99
// - Sizes:                  sizes(["16oz", 59], ["22oz", 69])  → customer must pick one
// - Add-ons offered:        addonIds: COFFEE_ADDONS  (or a list of add-on ids)
// - Mark sold out:          isAvailable: false
// - Show in the top row:    isFeatured: true
// - Badge:                  badge: "best_seller" or badge: "new"
// - Photos: set in src/data/menu-photos.ts (one line per product).
// - Keep each product `id` unique and don't rename it once customers have used the
//   app; saved carts refer to products by id.
// =============================================================================
import { photoForProduct } from "@/data/menu-photos";
import type { Addon, Category, Menu, Product, ProductSize, QuickExtra } from "@/types/menu";

const categories: Category[] = [
  { id: "cat-coffee", slug: "coffee", name: "Coffee", sortOrder: 1 },
  { id: "cat-frappe", slug: "frappe", name: "Frappe", sortOrder: 2 },
  { id: "cat-non-coffee", slug: "non-coffee", name: "Non-Coffee", sortOrder: 3 },
  { id: "cat-matcha", slug: "matcha", name: "Matcha", sortOrder: 4 },
  { id: "cat-fruit-fizz", slug: "fruit-fizz", name: "Fruit Fizz", sortOrder: 5 },
  { id: "cat-snacks", slug: "snacks", name: "Snacks", sortOrder: 6 },
  { id: "cat-rice-meals", slug: "rice-meals", name: "Rice Meals", sortOrder: 7 },
];

const addons: Addon[] = [
  // Drink add-ons / upgrades
  { id: "addon-extra-shot", name: "Extra Shot", price: 15, isAvailable: true },
  { id: "addon-extra-drizzle", name: "Extra Drizzle", price: 15, isAvailable: true },
  { id: "addon-oat-milk", name: "Sub Oat Milk", price: 30, isAvailable: true },
  { id: "addon-yakult", name: "Yakult", price: 15, isAvailable: true },
  // Food add-ons
  { id: "addon-egg", name: "Egg", price: 15, isAvailable: true },
  { id: "addon-cheese-sauce", name: "Cheese Sauce", price: 20, isAvailable: true },
  { id: "addon-kimchi", name: "Kimchi", price: 20, isAvailable: true },
  { id: "addon-extra-meat", name: "Extra Meat", price: 20, isAvailable: true },
  { id: "addon-plain-rice", name: "Plain Rice", price: 15, isAvailable: true },
];

// Quick Extras: things staff add to an open order on their own (Admin → order →
// + Add Item, or the one-tap buttons on dine-in orders). The price and Sold out
// switch come from the add-on each one points to, so change the price above.
export const quickExtras: QuickExtra[] = [
  { id: "extra-rice", name: "Extra Rice", addonId: "addon-plain-rice", quickButton: "Rice" },
  { id: "extra-kimchi", name: "Kimchi", addonId: "addon-kimchi", quickButton: "Kimchi" },
  { id: "extra-egg", name: "Egg", addonId: "addon-egg" },
  { id: "extra-cheese-sauce", name: "Cheese Sauce", addonId: "addon-cheese-sauce" },
];

// Which add-ons each kind of item offers. Adjust to match how the shop works.
const COFFEE_ADDONS = ["addon-extra-shot", "addon-extra-drizzle", "addon-oat-milk"];
const MILK_ADDONS = ["addon-extra-drizzle", "addon-oat-milk"];
const COFFEE_FRAPPE_ADDONS = ["addon-extra-shot", "addon-extra-drizzle"];
const CREAM_FRAPPE_ADDONS = ["addon-extra-drizzle"];
const FRUIT_FIZZ_ADDONS = ["addon-yakult"];
const SNACK_ADDONS = ["addon-cheese-sauce"];
const RICE_MEAL_ADDONS = ["addon-egg", "addon-cheese-sauce", "addon-kimchi", "addon-extra-meat", "addon-plain-rice"];

// ---- helpers (no need to touch these when editing the menu) ----------------

function sizes(...entries: Array<[name: string, price: number]>): ProductSize[] {
  return entries.map(([name, price]) => ({ id: name, name, price }));
}

type Draft = Pick<Product, "id" | "categoryId" | "name" | "description"> & Partial<Product>;

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Size/option ids are derived from the product id and names, so they stay the
// same when products are added or reordered (saved carts keep working).
function withStableIds(p: Product): Product {
  return {
    ...p,
    sizes: p.sizes.map((s) => ({ ...s, id: `${p.id}--size-${slug(s.name)}` })),
    variantGroups: p.variantGroups.map((group) => {
      const groupId = `${p.id}--${slug(group.name)}`;
      const options = group.options.map((o) => ({ ...o, id: `${groupId}-${slug(o.name)}` }));
      const defaultIndex = group.options.findIndex((o) => o.id === group.defaultOptionId);
      return { ...group, id: groupId, options, defaultOptionId: options[defaultIndex]?.id };
    }),
  };
}

let sortOrder = 0;
function product(draft: Draft): Product {
  return withStableIds({
    imageUrl: photoForProduct(draft.id),
    basePrice: 0,
    sizes: [],
    variantGroups: [],
    addonIds: [],
    isAvailable: true,
    isFeatured: false,
    badge: null,
    sortOrder: ++sortOrder,
    ...draft,
  });
}

const coffee = (id: string, name: string, basePrice: number, description: string, extra: Partial<Product> = {}) =>
  product({ id, categoryId: "cat-coffee", name, basePrice, description, addonIds: COFFEE_ADDONS, ...extra });

const frappe = (id: string, name: string, basePrice: number, description: string, coffeeBased: boolean) =>
  product({
    id,
    categoryId: "cat-frappe",
    name,
    basePrice,
    description,
    addonIds: coffeeBased ? COFFEE_FRAPPE_ADDONS : CREAM_FRAPPE_ADDONS,
  });

const milk = (id: string, name: string, basePrice: number, description: string) =>
  product({ id, categoryId: "cat-non-coffee", name, basePrice, description, addonIds: MILK_ADDONS });

const matcha = (id: string, name: string, basePrice: number, description: string, extra: Partial<Product> = {}) =>
  product({ id, categoryId: "cat-matcha", name, basePrice, description, addonIds: MILK_ADDONS, ...extra });

const fruitFizz = (id: string, flavor: string) =>
  product({
    id,
    categoryId: "cat-fruit-fizz",
    name: `${flavor} Fruit Fizz`,
    description: `Sparkling ${flavor.toLowerCase()} soda over ice.`,
    sizes: sizes(["16oz", 59], ["22oz", 69]),
    addonIds: FRUIT_FIZZ_ADDONS,
  });

const snack = (id: string, name: string, description: string, extra: Partial<Product>) =>
  product({ id, categoryId: "cat-snacks", name, description, addonIds: SNACK_ADDONS, ...extra });

const riceMeal = (id: string, name: string, basePrice: number, description: string, extra: Partial<Product> = {}) =>
  product({ id, categoryId: "cat-rice-meals", name, basePrice, description, addonIds: RICE_MEAL_ADDONS, ...extra });

// ---- products ----------------------------------------------------------------

const products: Product[] = [
  // Coffee
  coffee("americano", "Americano", 79, "Espresso and water. Bold and clean.", { addonIds: ["addon-extra-shot"] }),
  coffee("spanish-latte", "Spanish Latte", 99, "Espresso with fresh milk and sweet condensed milk."),
  coffee("french-vanilla-latte", "French Vanilla Latte", 99, "Espresso and milk with French vanilla."),
  coffee("cafe-latte", "Cafe Latte", 89, "Espresso with smooth, creamy milk."),
  coffee("caramel-macchiato", "Caramel Macchiato", 99, "Vanilla milk and espresso finished with caramel drizzle."),
  coffee("salted-caramel-macchiato", "Salted Caramel Macchiato", 109, "Caramel macchiato with a touch of sea salt."),
  coffee("strawberry-latte", "Strawberry Latte", 99, "Espresso layered over strawberry milk."),
  coffee("white-chocolate-mocha", "White Chocolate Mocha", 99, "Espresso, white chocolate and milk."),
  coffee("mocha-latte", "Mocha Latte", 99, "Espresso, chocolate and milk."),
  coffee("sea-salt-latte", "Sea Salt Latte", 119, "Latte topped with salty-sweet sea salt cream."),
  coffee("biscoff-latte", "Biscoff Latte", 129, "Espresso and milk with Biscoff cookie butter."),
  coffee("sea-salt-biscoff-latte", "Sea Salt Biscoff Latte", 149, "Biscoff latte crowned with sea salt cream."),
  coffee("nutella-latte", "Nutella Latte", 129, "Espresso and milk with Nutella."),

  // Frappe
  frappe("java-chip-frappe", "Java Chip Frappe", 149, "Coffee based. Blended with chocolate chips.", true),
  frappe("caramel-frappe", "Caramel Frappe", 139, "Coffee based. Blended with caramel.", true),
  frappe("biscoff-frappe", "Biscoff Frappe", 149, "Coffee based. Blended with Biscoff cookie butter.", true),
  frappe("chocolate-chip-frappe", "Chocolate Chip Frappe", 129, "No coffee. Chocolate blended with chocolate chips.", false),
  frappe("biscoff-cream-frappe", "Biscoff Cream Frappe", 139, "No coffee. Creamy blended Biscoff.", false),
  frappe("strawberries-cream-frappe", "Strawberries & Cream Frappe", 129, "No coffee. Strawberries blended with cream.", false),
  frappe("matcha-cream-frappe", "Matcha Cream Frappe", 129, "No coffee. Matcha blended with cream.", false),

  // Non-Coffee
  milk("chocolate-milk", "Chocolate Milk", 99, "Rich chocolate with cold milk."),
  milk("strawberry-milk", "Strawberry Milk", 99, "Sweet strawberry with cold milk."),
  milk("oreo-milk", "Oreo Milk", 89, "Crushed Oreo cookies with milk."),
  milk("blueberry-milk", "Blueberry Milk", 89, "Blueberry with cold milk."),
  milk("nutella-milk", "Nutella Milk", 109, "Nutella with cold milk."),
  milk("biscoff-milk", "Biscoff Milk", 109, "Biscoff cookie butter with cold milk."),

  // Matcha
  matcha("matcha-latte", "Matcha Latte", 99, "Matcha with fresh milk."),
  matcha("matcha-oreo-latte", "Matcha Oreo Latte", 109, "Matcha latte with crushed Oreo cookies."),
  matcha("strawberry-matcha", "Strawberry Matcha", 109, "Matcha layered over strawberry milk."),
  matcha("sea-salt-matcha", "Sea Salt Matcha", 119, "Matcha latte topped with sea salt cream."),
  matcha("dirty-matcha", "Dirty Matcha", 99, "Matcha latte with a shot of espresso.", {
    addonIds: ["addon-extra-shot", ...MILK_ADDONS],
  }),

  // Fruit Fizz
  fruitFizz("strawberry-fruit-fizz", "Strawberry"),
  fruitFizz("lychee-fruit-fizz", "Lychee"),
  fruitFizz("green-apple-fruit-fizz", "Green Apple"),
  fruitFizz("blueberry-fruit-fizz", "Blueberry"),

  // Snacks
  snack("hotdog-sandwich-cheese-overload", "Hotdog Sandwich Cheese Overload", "Hotdog sandwich loaded with cheese.", {
    basePrice: 69,
  }),
  snack("hungarian-sandwich-cheese-overload", "Hungarian Sandwich Cheese Overload", "Hungarian sausage sandwich loaded with cheese.", {
    basePrice: 79,
  }),
  snack(
    "hungarian-sandwich-cheese-overload-bacon",
    "Hungarian Sandwich Cheese Overload with Bacon",
    "Hungarian sausage sandwich with bacon, loaded with cheese.",
    { basePrice: 99 },
  ),
  snack("burger-cheese-overload", "Burger Cheese Overload", "Burger loaded with cheese.", { basePrice: 59 }),
  snack("beef-shawarma", "Beef Shawarma", "Seasoned beef wrapped with veggies and sauce.", { basePrice: 89 }),
  snack("beef-shawarma-burger", "Beef Shawarma Burger", "Shawarma-style beef in a burger bun.", { basePrice: 69 }),
  snack("beef-nachos-overload", "Beef Nachos Overload", "Tortilla chips with seasoned ground beef, veggies, cheese and sauces.", {
    basePrice: 119,
    isFeatured: true,
  }),
  snack("french-fries", "French Fries", "Crispy golden fries with dip.", {
    sizes: sizes(["Solo", 49], ["Duo", 69]),
    isFeatured: true,
  }),
  snack("chicken-poppers", "Chicken Poppers", "Bite-sized crispy fried chicken.", { sizes: sizes(["Solo", 69], ["Duo", 139]) }),
  snack("poppers-n-fries", "Poppers N' Fries", "Chicken poppers and fries together.", { basePrice: 109 }),
  snack("homemade-cheese-stick", "Homemade Cheese Stick", "Crispy rolls with melty cheese inside.", { basePrice: 59 }),
  snack("sausage-pork-bites", "Sausage with Pork Bites", "Sausage and crispy pork bites.", { basePrice: 69 }),
  snack("pork-enoki-stick", "Pork Enoki Stick", "Enoki mushroom wrapped in pork, grilled on a stick.", {
    basePrice: 49,
    isFeatured: true,
  }),
  snack("cheesy-baked-samgy", "Cheesy Baked Samgy", "Baked samgyeopsal pork topped with melted cheese.", { basePrice: 149 }),

  // Rice Meals
  riceMeal("hungarian-sausage-egg", "Hungarian Sausage with Egg", 149, "Hungarian sausage with egg and rice."),
  riceMeal("spam-egg", "Spam with Egg", 119, "Fried Spam with egg and rice."),
  riceMeal("beef-tapa-egg", "Beef Tapa with Egg", 129, "Sweet-savory beef tapa with egg and rice."),
  riceMeal("beef-shawarma-rice", "Beef Shawarma Rice", 149, "Shawarma-seasoned beef over rice."),
  riceMeal("bento-pork-samgy", "Bento Pork Samgy", 149, "Crispy pork samgyeopsal with kimchi, rice and cheese sauce.", {
    isFeatured: true,
  }),
  riceMeal("pork-enoki-rice", "Pork Enoki", 139, "Pork-wrapped enoki mushrooms with rice."),
  riceMeal("bacon-egg", "Bacon with Egg", 119, "Crispy bacon with egg and rice."),
  riceMeal("chicken-poppers-cheese-sauce", "Chicken Poppers with Cheese Sauce", 109, "Chicken poppers with cheese sauce and rice."),
];

export const localMenu: Menu = { categories, products, addons, source: "local" };
