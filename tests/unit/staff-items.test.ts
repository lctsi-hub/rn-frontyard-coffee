// Staff "+ Add Item": the server rebuilds every item from the menu; the
// browser's prices are never used.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { localMenu, quickExtras } from "@/data/menu-data";
import { applyAvailability } from "@/lib/menu-availability";
import { buildStaffAddition, canAddItems, resolveQuickExtras } from "@/lib/orders/staff-items";

const ids = () => ({ orderId: randomUUID(), requestId: randomUUID() });
const addon = (id: string) => localMenu.addons.find((a) => a.id === id)!;

test("Quick Extras take their price from the add-on they point to (one place to change it)", () => {
  const extras = resolveQuickExtras(localMenu);
  const rice = extras.find((e) => e.id === "extra-rice")!;
  const kimchi = extras.find((e) => e.id === "extra-kimchi")!;
  assert.equal(rice.name, "Extra Rice");
  assert.equal(rice.price, addon("addon-plain-rice").price);
  assert.equal(kimchi.price, addon("addon-kimchi").price);
  assert.ok(quickExtras.some((e) => e.quickButton === "Rice") && quickExtras.some((e) => e.quickButton === "Kimchi"));

  // Changing the add-on's price changes the extra's price.
  const pricier = { ...localMenu, addons: localMenu.addons.map((a) => (a.id === "addon-plain-rice" ? { ...a, price: 25 } : a)) };
  assert.equal(resolveQuickExtras(pricier).find((e) => e.id === "extra-rice")!.price, 25);
});

test("an extra is built as its own line priced by the server", () => {
  const built = buildStaffAddition({ ...ids(), item: { kind: "extra", extraId: "extra-rice", quantity: 2, notes: " less " } }, localMenu);
  assert.ok(built.ok);
  const price = addon("addon-plain-rice").price;
  assert.deepEqual(built.value.item, {
    product_key: "extra-rice",
    product_name: "Extra Rice",
    category_name: "Extras",
    size_name: null,
    base_price: price,
    options: [],
    addons: [],
    unit_price: price,
    quantity: 2,
    notes: "less",
  });
  assert.equal(built.value.lineTotal, price * 2);
});

test("prices sent by the browser are ignored", () => {
  const built = buildStaffAddition(
    { ...ids(), item: { kind: "product", productId: "americano", sizeId: null, quantity: 1, unit_price: 1, base_price: 1, price: 1 } },
    localMenu,
  );
  assert.ok(built.ok);
  const americano = localMenu.products.find((p) => p.id === "americano")!;
  assert.equal(built.value.item.unit_price, americano.basePrice);
});

test("sold-out items and extras are refused", () => {
  const soldOut = applyAvailability(localMenu, [
    { item_type: "addon", item_key: "addon-kimchi", is_available: false },
    { item_type: "product", item_key: "americano", is_available: false },
  ]);
  const kimchi = buildStaffAddition({ ...ids(), item: { kind: "extra", extraId: "extra-kimchi", quantity: 1 } }, soldOut);
  assert.equal(kimchi.ok, false);
  assert.equal(!kimchi.ok && kimchi.code, "item_unavailable");
  const americano = buildStaffAddition({ ...ids(), item: { kind: "product", productId: "americano", sizeId: null, quantity: 1 } }, soldOut);
  assert.equal(!americano.ok && americano.code, "item_unavailable");
});

test("unknown items, bad choices and bad requests are refused", () => {
  const bad = (input: unknown) => {
    const r = buildStaffAddition(input, localMenu);
    assert.equal(r.ok, false, JSON.stringify(input));
    return !r.ok ? r.code : null;
  };
  assert.equal(bad({ ...ids(), item: { kind: "extra", extraId: "free-rice", quantity: 1 } }), "invalid_item");
  assert.equal(bad({ ...ids(), item: { kind: "extra", extraId: "extra-rice", quantity: 0 } }), "invalid_item");
  assert.equal(bad({ ...ids(), item: { kind: "extra", extraId: "extra-rice", quantity: 21 } }), "invalid_item");
  assert.equal(bad({ ...ids(), item: { kind: "product", productId: "no-such-drink", quantity: 1 } }), "invalid_item");
  // French fries need a size; kimchi isn't offered on fries.
  assert.equal(bad({ ...ids(), item: { kind: "product", productId: "french-fries", sizeId: null, quantity: 1 } }), "invalid_item");
  const duo = localMenu.products.find((p) => p.id === "french-fries")!.sizes[1].id;
  assert.equal(bad({ ...ids(), item: { kind: "product", productId: "french-fries", sizeId: duo, addonIds: ["addon-kimchi"], quantity: 1 } }), "invalid_item");
  assert.equal(bad({ orderId: "RN-0012", requestId: randomUUID(), item: { kind: "extra", extraId: "extra-rice", quantity: 1 } }), "invalid_request");
  assert.equal(bad({ orderId: randomUUID(), item: { kind: "extra", extraId: "extra-rice", quantity: 1 } }), "invalid_request");
  assert.equal(bad(null), "invalid_request");
});

test("items can be added only while an order is open (never after dispatch, completion or cancellation)", () => {
  for (const s of ["received", "confirmed", "preparing", "ready"]) assert.equal(canAddItems(s), true, s);
  for (const s of ["out_for_delivery", "completed", "cancelled"]) assert.equal(canAddItems(s), false, s);
});
