// =============================================================================
// PRODUCT PHOTO MAPPING
// Which photo each menu item shows. Edit the right-hand side to change a photo.
//
// - The photo names are files in public/menu/.
//   * Studio photos (white background) are cut from the product photo sheets in
//     assets/menu-sheets/ by scripts/prepare-menu-sheets.mjs (`npm run menu:sheets`).
//     Their names follow the label printed under each product on the sheet.
//   * A few real shop photos are cropped from assets/photos/ by
//     scripts/prepare-menu-photos.mjs (`npm run menu:photos`).
// - "exact" = a photo of that item. Everything else is the closest stand-in
//   (same kind of drink or dish) until a photo of that item is available.
// - To add a new photo: add it to one of the scripts, run it, add its name to
//   MENU_PHOTOS, then use it below.
// - Remove an item's line to show the drawn placeholder instead.
// =============================================================================

export const MENU_PHOTOS = [
  // studio photos: coffee sheet
  "iced-spanish-latte",
  "caramel-macchiato",
  "mocha-latte",
  "sea-salt-latte",
  "biscoff-latte",
  "sea-salt-biscoff-latte",
  "iced-latte",
  "americano",
  // studio photos: matcha / fizzy sheet
  "matcha-latte",
  "dirty-matcha",
  "strawberry-matcha",
  "strawberry-cream",
  "green-apple-fizzy",
  "lychee-fizzy",
  "strawberry-fizzy",
  "lemon-fizzy", // not on the menu yet
  // studio photos: snacks sheet
  "shawarma-wrap",
  "seasoned-fries",
  "truffle-fries",
  "nachos-overload",
  "chocolate-chip-cookie", // not on the menu yet
  "pork-enoki-stick",
  // studio photos: rice meals sheet
  "breakfast-rice-meal",
  "bento-meal",
  "shawarma-rice-meal",
  "chicken-rice-meal",
  "kimchi-rice-meal",
  "spam-egg-rice-meal",
  // real shop photos (no studio photo of these items)
  "strawberry-milk", // pink strawberry milk
  "cheese-sandwich", // cheese overload sandwiches
  "cheese-sticks", // homemade cheese sticks with dip
  "pork-enoki-bento", // pork enoki rice bento
] as const;

export type MenuPhoto = (typeof MENU_PHOTOS)[number];

export const PRODUCT_PHOTOS: Record<string, MenuPhoto> = {
  // Coffee
  americano: "americano", // exact
  "spanish-latte": "iced-spanish-latte", // exact
  "french-vanilla-latte": "iced-latte",
  "cafe-latte": "iced-latte", // exact (iced latte)
  "caramel-macchiato": "caramel-macchiato", // exact
  "salted-caramel-macchiato": "caramel-macchiato",
  "strawberry-latte": "strawberry-cream",
  "white-chocolate-mocha": "iced-latte",
  "mocha-latte": "mocha-latte", // exact
  "sea-salt-latte": "sea-salt-latte", // exact
  "biscoff-latte": "biscoff-latte", // exact
  "sea-salt-biscoff-latte": "sea-salt-biscoff-latte", // exact
  "nutella-latte": "mocha-latte",

  // Frappe
  "java-chip-frappe": "mocha-latte",
  "caramel-frappe": "sea-salt-biscoff-latte",
  "biscoff-frappe": "biscoff-latte",
  "chocolate-chip-frappe": "mocha-latte",
  "biscoff-cream-frappe": "biscoff-latte",
  "strawberries-cream-frappe": "strawberry-cream", // sheet label "Strawberry Cream"
  "matcha-cream-frappe": "matcha-latte",

  // Non-Coffee
  "chocolate-milk": "mocha-latte",
  "strawberry-milk": "strawberry-milk", // exact (shop photo)
  "oreo-milk": "iced-latte",
  "blueberry-milk": "strawberry-cream",
  "nutella-milk": "mocha-latte",
  "biscoff-milk": "biscoff-latte",

  // Matcha
  "matcha-latte": "matcha-latte", // exact
  "matcha-oreo-latte": "matcha-latte",
  "strawberry-matcha": "strawberry-matcha", // exact
  "sea-salt-matcha": "matcha-latte",
  "dirty-matcha": "dirty-matcha", // exact

  // Fruit Fizz
  "strawberry-fruit-fizz": "strawberry-fizzy", // exact
  "lychee-fruit-fizz": "lychee-fizzy", // exact
  "green-apple-fruit-fizz": "green-apple-fizzy", // exact
  "blueberry-fruit-fizz": "lychee-fizzy",

  // Snacks
  "hotdog-sandwich-cheese-overload": "cheese-sandwich",
  "hungarian-sandwich-cheese-overload": "cheese-sandwich",
  "hungarian-sandwich-cheese-overload-bacon": "cheese-sandwich",
  "burger-cheese-overload": "cheese-sandwich",
  "beef-shawarma": "shawarma-wrap", // exact
  "beef-shawarma-burger": "shawarma-wrap",
  "beef-nachos-overload": "nachos-overload", // exact
  "french-fries": "seasoned-fries", // exact (sheet label "Seasoned Fries")
  "chicken-poppers": "truffle-fries",
  "poppers-n-fries": "truffle-fries",
  "homemade-cheese-stick": "cheese-sticks", // exact (shop photo)
  "sausage-pork-bites": "pork-enoki-stick",
  "pork-enoki-stick": "pork-enoki-stick", // exact
  "cheesy-baked-samgy": "kimchi-rice-meal",

  // Rice Meals
  "hungarian-sausage-egg": "breakfast-rice-meal",
  "spam-egg": "spam-egg-rice-meal", // exact
  "beef-tapa-egg": "breakfast-rice-meal",
  "beef-shawarma-rice": "shawarma-rice-meal", // exact
  "bento-pork-samgy": "bento-meal", // exact (sheet label "Bento Meal")
  "pork-enoki-rice": "pork-enoki-bento", // exact (shop photo)
  "bacon-egg": "breakfast-rice-meal",
  "chicken-poppers-cheese-sauce": "chicken-rice-meal",
};

export function photoForProduct(productId: string): string | null {
  const photo = PRODUCT_PHOTOS[productId];
  return photo ? `/menu/${photo}.jpg` : null;
}
