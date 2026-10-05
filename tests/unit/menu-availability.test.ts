import assert from "node:assert/strict";
import { test } from "node:test";
import { localMenu } from "@/data/menu-data";
import { localStoreSettings } from "@/data/store-settings";
import { buildOrder } from "@/lib/orders/build-order";
import { applyAvailability } from "@/lib/menu-availability";

test("sold-out switches override the code menu; no rows = code defaults", () => {
  assert.equal(applyAvailability(localMenu, []), localMenu);

  const menu = applyAvailability(localMenu, [
    { item_type: "product", item_key: "spanish-latte", is_available: false },
    { item_type: "addon", item_key: "addon-extra-shot", is_available: false },
    { item_type: "product", item_key: "not-on-the-menu", is_available: false },
  ]);
  assert.equal(menu.products.find((p) => p.id === "spanish-latte")?.isAvailable, false);
  assert.equal(menu.products.find((p) => p.id === "americano")?.isAvailable, true);
  assert.equal(menu.addons.find((a) => a.id === "addon-extra-shot")?.isAvailable, false);
  assert.equal(localMenu.products.find((p) => p.id === "spanish-latte")?.isAvailable, true, "code menu untouched");
});

test("the server refuses to sell a product Bam marked sold out", () => {
  const menu = applyAvailability(localMenu, [{ item_type: "product", item_key: "spanish-latte", is_available: false }]);
  const r = buildOrder(
    {
      clientRequestId: "3f6c2a1e-8b7d-4c5e-9f0a-1b2c3d4e5f60",
      expectedTotal: 99,
      orderType: "take_out",
      customer: { name: "Juan", phone: "09171234567" },
      paymentMethod: "cash",
      items: [{ productId: "spanish-latte", sizeId: null, optionIds: [], addonIds: [], quantity: 1, notes: "" }],
    },
    menu,
    localStoreSettings,
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "item_unavailable");
});
