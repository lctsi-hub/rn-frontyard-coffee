import assert from "node:assert/strict";
import { test } from "node:test";
import { customerStageIndex, customerStages, statusLabel } from "@/lib/orders/status";
import { parseTracking } from "@/lib/orders/tracking";

test("tracking data keeps only whitelisted safe fields", () => {
  const parsed = parseTracking({
    order_number: "RN-0007",
    customer_first_name: "Maria",
    order_type: "delivery",
    status: "preparing",
    table_number: null,
    payment_method: "gcash",
    subtotal: 320,
    delivery_fee: 70,
    total: 390,
    created_at: "2026-10-06T02:00:00Z",
    items: [{ name: "Spanish Latte", size: null, options: [], addons: [{ name: "Extra Shot", key: "addon-extra-shot", price: 15 }], quantity: 2, notes: "", line_total: 228 }],
    timeline: [{ status: "received", at: "2026-10-06T02:00:00Z" }],
    // Even if the database ever returned private fields, they must not pass through.
    customer_name: "Maria Clara Santos",
    customer_phone: "09171234567",
    delivery_address: "123 Rizal St",
    delivery_landmark: "Chapel",
    id: "6c0a…",
  });
  assert.ok(parsed);
  const text = JSON.stringify(parsed);
  for (const secret of ["Clara", "09171234567", "Rizal", "Chapel", "6c0a"]) assert.ok(!text.includes(secret), secret);
  assert.deepEqual(parsed.items[0].addons, ["Extra Shot"]);
  assert.equal(parseTracking(null), null);
  assert.equal(parseTracking({ nope: true }), null);
});

test("customer timelines match each order type", () => {
  assert.deepEqual(customerStages("dine_in").map((s) => statusLabel("dine_in", s)), [
    "Received", "Confirmed", "Preparing", "Ready to Serve", "Completed",
  ]);
  assert.deepEqual(customerStages("take_out").map((s) => statusLabel("take_out", s)), [
    "Received", "Confirmed", "Preparing", "Ready for Pickup", "Completed",
  ]);
  assert.deepEqual(customerStages("delivery").map((s) => statusLabel("delivery", s)), [
    "Received", "Confirmed", "Preparing", "Out for Delivery", "Completed",
  ]);
  // A delivery order the kitchen marked "ready" still shows as Preparing for the customer.
  assert.equal(customerStageIndex("delivery", "ready"), customerStageIndex("delivery", "preparing"));
});
