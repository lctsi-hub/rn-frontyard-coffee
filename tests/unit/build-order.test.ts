// Server-side order building: prices come only from the menu, and every
// unknown or invalid choice rejects the order.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { localMenu } from "@/data/menu-data";
import { localStoreSettings } from "@/data/store-settings";
import { buildOrder } from "@/lib/orders/build-order";
import type { Menu } from "@/types/menu";
import { cartTotalling, line } from "../support/carts";

const KEY = "3f6c2a1e-8b7d-4c5e-9f0a-1b2c3d4e5f60";

function request(overrides: Record<string, unknown> = {}) {
  return {
    clientRequestId: KEY,
    expectedTotal: 0,
    orderType: "take_out",
    tableNumber: null,
    customer: { name: "Maria Santos", phone: "0917 123 4567" },
    delivery: null,
    paymentMethod: "cash",
    notes: "",
    items: [line("spanish-latte")],
    ...overrides,
  };
}

function expectError(result: ReturnType<typeof buildOrder>, code: string) {
  assert.equal(result.ok, false, `expected ${code}, got ok`);
  if (!result.ok) assert.equal(result.code, code);
}

describe("prices come from the menu, never the browser", () => {
  test("Spanish Latte + Extra Shot + Sub Oat Milk is priced from the menu (₱99 + ₱15 + ₱30)", () => {
    const r = buildOrder(
      request({
        expectedTotal: 144,
        items: [
          {
            ...line("spanish-latte", { addonIds: ["addon-extra-shot", "addon-oat-milk"] }),
            // Fields a malicious browser might add; all ignored.
            unitPrice: 1,
            price: 1,
            lineTotal: 1,
          },
        ],
      }),
      localMenu,
      localStoreSettings,
    );
    assert.ok(r.ok);
    if (!r.ok) return;
    const [item] = r.value.items;
    assert.equal(item.product_name, "Spanish Latte");
    assert.equal(item.category_name, "Coffee");
    assert.equal(item.base_price, 99);
    assert.deepEqual(item.addons, [
      { key: "addon-extra-shot", name: "Extra Shot", price: 15 },
      { key: "addon-oat-milk", name: "Sub Oat Milk", price: 30 },
    ]);
    assert.equal(item.unit_price, 144);
    assert.equal(r.value.total, 144);
    assert.equal(r.value.order.expected_total, 144);
  });

  test("sizes use the size price: Strawberry Fruit Fizz 22oz + Yakult ×2 = ₱168", () => {
    const r = buildOrder(
      request({
        expectedTotal: 168,
        items: [
          line("strawberry-fruit-fizz", {
            sizeId: "strawberry-fruit-fizz--size-22oz",
            addonIds: ["addon-yakult"],
            quantity: 2,
          }),
        ],
      }),
      localMenu,
      localStoreSettings,
    );
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.value.items[0].size_name, "22oz");
      assert.equal(r.value.items[0].base_price, 69);
      assert.equal(r.value.subtotal, 168);
    }
  });

  test("a total the customer didn't see is rejected (total_changed)", () => {
    expectError(buildOrder(request({ expectedTotal: 1 }), localMenu, localStoreSettings), "total_changed");
  });
});

describe("unknown or invalid choices reject the whole order", () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["unknown product", { items: [line("free-coffee")] }, "invalid_item"],
    ["size on a product without sizes", { items: [line("spanish-latte", { sizeId: "x" })] }, "invalid_item"],
    ["missing required size", { items: [line("french-fries")] }, "invalid_item"],
    ["size from another product", { items: [line("french-fries", { sizeId: "chicken-poppers--size-duo" })] }, "invalid_item"],
    ["add-on not offered for the product", { items: [line("americano", { addonIds: ["addon-oat-milk"] })] }, "invalid_item"],
    ["unknown add-on", { items: [line("spanish-latte", { addonIds: ["addon-gold-flakes"] })] }, "invalid_item"],
    ["duplicate add-on", { items: [line("spanish-latte", { addonIds: ["addon-extra-shot", "addon-extra-shot"] })] }, "invalid_item"],
    ["unknown option", { items: [line("spanish-latte", { optionIds: ["spanish-latte--sweetness-0"] })] }, "invalid_item"],
    ["quantity 0", { items: [line("spanish-latte", { quantity: 0 })] }, "invalid_item"],
    ["quantity 21", { items: [line("spanish-latte", { quantity: 21 })] }, "invalid_item"],
    ["fractional quantity", { items: [line("spanish-latte", { quantity: 1.5 })] }, "invalid_item"],
    ["notes too long", { items: [line("spanish-latte", { notes: "x".repeat(141) })] }, "invalid_item"],
    ["item is not an object", { items: ["spanish-latte"] }, "invalid_item"],
    ["empty cart", { items: [] }, "empty_order"],
    ["too many lines", { items: Array.from({ length: 51 }, () => line("americano")) }, "too_many_items"],
    ["bad idempotency key", { clientRequestId: "not-a-uuid" }, "invalid_order"],
    ["unknown order type", { orderType: "drive_thru" }, "invalid_order"],
  ];
  for (const [name, overrides, code] of cases) {
    test(name, () => expectError(buildOrder(request(overrides), localMenu, localStoreSettings), code));
  }

  test("sold-out product → item_unavailable", () => {
    const menu: Menu = {
      ...localMenu,
      products: localMenu.products.map((p) => (p.id === "spanish-latte" ? { ...p, isAvailable: false } : p)),
    };
    expectError(buildOrder(request({ expectedTotal: 99 }), menu, localStoreSettings), "item_unavailable");
  });

  test("unavailable add-on → item_unavailable", () => {
    const menu: Menu = {
      ...localMenu,
      addons: localMenu.addons.map((a) => (a.id === "addon-extra-shot" ? { ...a, isAvailable: false } : a)),
    };
    const r = buildOrder(
      request({ expectedTotal: 114, items: [line("spanish-latte", { addonIds: ["addon-extra-shot"] })] }),
      menu,
      localStoreSettings,
    );
    expectError(r, "item_unavailable");
  });
});

describe("customer details", () => {
  test("dine in needs a table number", () => {
    expectError(buildOrder(request({ orderType: "dine_in", expectedTotal: 99 }), localMenu, localStoreSettings), "invalid_details");
  });
  test("dine in with table 5 and no phone is fine", () => {
    const r = buildOrder(
      request({ orderType: "dine_in", tableNumber: 5, customer: { name: "Juan", phone: "" }, expectedTotal: 99 }),
      localMenu,
      localStoreSettings,
    );
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.value.order.table_number, 5);
  });
  test("take out needs a mobile number", () => {
    expectError(buildOrder(request({ customer: { name: "Juan", phone: "" }, expectedTotal: 99 }), localMenu, localStoreSettings), "invalid_details");
  });
  test("phone formats are normalised to 09XXXXXXXXX", () => {
    const r = buildOrder(request({ customer: { name: "Juan", phone: "+63 917-123-4567" }, expectedTotal: 99 }), localMenu, localStoreSettings);
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.value.order.customer_phone, "09171234567");
  });
  test("Pay at Counter is not allowed for delivery", () => {
    const r = buildOrder(
      request({
        orderType: "delivery",
        paymentMethod: "counter",
        items: cartTotalling(300),
        delivery: { areaId: "lourdes", address: "123 Rizal St", landmark: "Chapel", instructions: "" },
        expectedTotal: 350,
      }),
      localMenu,
      localStoreSettings,
    );
    expectError(r, "invalid_payment_method");
  });
});

describe("delivery pricing (₱300 minimum, ₱50 / ₱70 areas, free from ₱500)", () => {
  const cases: Array<[number, string, number | "reject"]> = [
    [299, "lourdes", "reject"],
    [300, "lourdes", 50],
    [300, "salapungan", 50],
    [300, "batasan", 70],
    [300, "magumbali", 70],
    [300, "mandili", 70],
    [499, "mandili", 70],
    [500, "lourdes", 0],
    [500, "mandili", 0],
  ];
  // Real menu prices all end in 9 (or 4 with add-ons), so exact amounts like
  // ₱299 can't be built from them; a one-line test item priced at exactly the
  // subtotal isolates the delivery rules from menu prices.
  const menuWithItemAt = (price: number): Menu => ({
    ...localMenu,
    products: [
      ...localMenu.products,
      { ...localMenu.products.find((p) => p.id === "americano")!, id: "test-item", name: "Test Item", basePrice: price, addonIds: [] },
    ],
  });

  for (const [subtotal, areaId, fee] of cases) {
    test(`₱${subtotal} to ${areaId} → ${fee === "reject" ? "rejected" : fee === 0 ? "FREE" : `₱${fee}`}`, () => {
      const menu = menuWithItemAt(subtotal);
      const items = [line("test-item")];
      const delivery = { areaId, address: "123 Rizal St", landmark: "Chapel", instructions: "" };
      if (fee === "reject") {
        const r = buildOrder(request({ orderType: "delivery", items, delivery, expectedTotal: subtotal }), menu, localStoreSettings);
        expectError(r, "delivery_below_minimum");
        return;
      }
      const r = buildOrder(
        request({ orderType: "delivery", items, delivery, expectedTotal: subtotal + fee }),
        menu,
        localStoreSettings,
      );
      assert.ok(r.ok, r.ok ? "" : r.code);
      if (r.ok) {
        assert.equal(r.value.subtotal, subtotal);
        assert.equal(r.value.deliveryFee, fee);
        assert.equal(r.value.total, subtotal + fee);
      }
    });
  }

  test("a real-menu cart of exactly ₱300 to Mandili → ₱70", () => {
    const items = cartTotalling(300);
    const r = buildOrder(
      request({
        orderType: "delivery",
        items,
        delivery: { areaId: "mandili", address: "123 Rizal St", landmark: "Chapel", instructions: "" },
        expectedTotal: 370,
      }),
      localMenu,
      localStoreSettings,
    );
    assert.ok(r.ok, r.ok ? "" : r.code);
    if (r.ok) assert.deepEqual([r.value.subtotal, r.value.deliveryFee, r.value.total], [300, 70, 370]);
  });

  test("unknown or switched-off area → delivery_area_invalid", () => {
    const r = buildOrder(
      request({
        orderType: "delivery",
        items: cartTotalling(300),
        delivery: { areaId: "manila", address: "x", landmark: "y", instructions: "" },
        expectedTotal: 350,
      }),
      localMenu,
      localStoreSettings,
    );
    expectError(r, "delivery_area_invalid");
  });
});
