// =============================================================================
// PRODUCT PHOTO MAPPING
// Which photo each menu item shows. Edit the right-hand side to change a photo.
//
// - The photo names are files in public/menu/ (made by scripts/prepare-menu-photos.mjs
//   from the originals in assets/photos/).
// - "exact" = a photo of that item. Everything else is the closest stand-in
//   (same type / colour) until a real photo of that item is available.
// - To add a new photo: add a crop in scripts/prepare-menu-photos.mjs, run
//   `npm run menu:photos`, add its name to MENU_PHOTOS, then use it below.
// - Remove an item's line to show the drawn placeholder instead.
// =============================================================================

export const MENU_PHOTOS = [
  // drinks
  "latte-iced", // single iced latte, brown over cream
  "latte-pair", // two iced lattes, dark top / white bottom
  "coffee-dark", // dark chocolatey coffee drinks
  "caramel-macchiato", // latte with caramel drizzle
  "biscoff", // creamy drink with caramel bits
  "strawberry-milk", // pink strawberry milk
  "strawberry-latte", // pink strawberry drink next to an iced coffee
  "strawberry-matcha", // green matcha over pink strawberry
  "matcha", // green matcha lattes
  "fizz-green", // green fruit fizz
  "fizz-clear", // clear / light fruit fizz with jellies
  "fizz-red", // red fruit fizz
  // food
  "shawarma", // beef shawarma wraps
  "cheese-sandwich", // cheese overload sandwiches
  "cheese-sticks", // homemade cheese sticks with dip
  "beef-nachos-overload", // beef nachos
  "french-fries", // fries
  "pork-enoki-stick", // pork enoki skewers
  "bento-pork-samgy", // pork samgy bento
  "pork-enoki-bento", // pork enoki rice bento
  "spam-egg", // spam, egg and rice plate
  "rice-plate", // rice meal with sauced meat and kimchi
] as const;

export type MenuPhoto = (typeof MENU_PHOTOS)[number];

export const PRODUCT_PHOTOS: Record<string, MenuPhoto> = {
  // Coffee
  americano: "coffee-dark",
  "spanish-latte": "latte-iced",
  "french-vanilla-latte": "latte-pair",
  "cafe-latte": "latte-pair",
  "caramel-macchiato": "caramel-macchiato", // exact
  "salted-caramel-macchiato": "caramel-macchiato",
  "strawberry-latte": "strawberry-latte",
  "white-chocolate-mocha": "latte-iced",
  "mocha-latte": "coffee-dark",
  "sea-salt-latte": "latte-iced",
  "biscoff-latte": "biscoff",
  "sea-salt-biscoff-latte": "biscoff",
  "nutella-latte": "coffee-dark",

  // Frappe
  "java-chip-frappe": "coffee-dark",
  "caramel-frappe": "caramel-macchiato",
  "biscoff-frappe": "biscoff",
  "chocolate-chip-frappe": "coffee-dark",
  "biscoff-cream-frappe": "biscoff",
  "strawberries-cream-frappe": "strawberry-milk",
  "matcha-cream-frappe": "matcha",

  // Non-Coffee
  "chocolate-milk": "coffee-dark",
  "strawberry-milk": "strawberry-milk", // exact
  "oreo-milk": "biscoff",
  "blueberry-milk": "biscoff",
  "nutella-milk": "coffee-dark",
  "biscoff-milk": "biscoff",

  // Matcha
  "matcha-latte": "matcha", // exact
  "matcha-oreo-latte": "matcha",
  "strawberry-matcha": "strawberry-matcha", // exact
  "sea-salt-matcha": "matcha",
  "dirty-matcha": "matcha",

  // Fruit Fizz
  "strawberry-fruit-fizz": "fizz-red",
  "lychee-fruit-fizz": "fizz-clear",
  "green-apple-fruit-fizz": "fizz-green",
  "blueberry-fruit-fizz": "fizz-clear",

  // Snacks
  "hotdog-sandwich-cheese-overload": "cheese-sandwich",
  "hungarian-sandwich-cheese-overload": "cheese-sandwich",
  "hungarian-sandwich-cheese-overload-bacon": "cheese-sandwich",
  "burger-cheese-overload": "cheese-sandwich",
  "beef-shawarma": "shawarma", // exact
  "beef-shawarma-burger": "shawarma",
  "beef-nachos-overload": "beef-nachos-overload", // exact
  "french-fries": "french-fries", // exact
  "chicken-poppers": "french-fries",
  "poppers-n-fries": "french-fries",
  "homemade-cheese-stick": "cheese-sticks", // exact
  "sausage-pork-bites": "pork-enoki-stick",
  "pork-enoki-stick": "pork-enoki-stick", // exact
  "cheesy-baked-samgy": "bento-pork-samgy",

  // Rice Meals
  "hungarian-sausage-egg": "spam-egg",
  "spam-egg": "spam-egg", // exact
  "beef-tapa-egg": "rice-plate",
  "beef-shawarma-rice": "rice-plate",
  "bento-pork-samgy": "bento-pork-samgy", // exact
  "pork-enoki-rice": "pork-enoki-bento", // exact
  "bacon-egg": "spam-egg",
  "chicken-poppers-cheese-sauce": "rice-plate",
};

export function photoForProduct(productId: string): string | null {
  const photo = PRODUCT_PHOTOS[productId];
  return photo ? `/menu/${photo}.jpg` : null;
}
