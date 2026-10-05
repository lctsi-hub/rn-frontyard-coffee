// Staff "+ Add Item" on an existing order (migration 20261006120000), against a
// throwaway local PostgreSQL. Payloads are built by the real server code
// (buildStaffAddition) from the real menu, so pricing and database are tested
// together. Run with: npm run test:db
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type pg from "pg";
import { localMenu } from "@/data/menu-data";
import { ADDABLE_STATUSES, buildStaffAddition, canAddItems } from "@/lib/orders/staff-items";
import type { OrderStatus } from "@/lib/orders/status";
import { asRole, createUser, startTestDatabase } from "./harness";

let db: Awaited<ReturnType<typeof startTestDatabase>>;
let pool: pg.Pool;
let adminId: string;
let userId: string;

before(async () => {
  db = await startTestDatabase();
  pool = db.pool;
  adminId = await createUser(pool, { admin: true });
  userId = await createUser(pool);
});
after(async () => db?.stop());

// ---- helpers ---------------------------------------------------------------------

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

type Line = { name: string; price: number; qty?: number };

/** Create an order through create_order() (as our server does). Returns its id, number and token hash. */
async function createOrder({
  type = "dine_in",
  lines = [
    { name: "Spanish Latte", price: 120 },
    { name: "French Fries", price: 145 },
  ],
  fee = 0,
  payment = "cash",
}: { type?: "dine_in" | "take_out" | "delivery"; lines?: Line[]; fee?: number; payment?: string } = {}) {
  const tokenHash = sha256(randomBytes(32).toString("base64url"));
  const subtotal = lines.reduce((sum, l) => sum + l.price * (l.qty ?? 1), 0);
  const order = {
    client_request_id: randomUUID(),
    tracking_token_hash: tokenHash,
    expected_total: subtotal + fee,
    order_type: type,
    customer_name: "Maria Santos",
    customer_phone: "09171234567",
    table_number: type === "dine_in" ? 5 : null,
    delivery_area_id: type === "delivery" ? "lourdes" : null,
    delivery_address: type === "delivery" ? "123 Rizal St." : null,
    delivery_landmark: type === "delivery" ? "Chapel" : null,
    delivery_instructions: null,
    payment_method: payment,
    notes: "",
  };
  const items = lines.map((l, i) => ({
    product_key: `test-${i}`,
    product_name: l.name,
    category_name: "Test",
    size_name: null,
    base_price: l.price,
    options: [],
    addons: [],
    unit_price: l.price,
    quantity: l.qty ?? 1,
    notes: "",
  }));
  const row = await asRole(pool, "service_role", null, async (c) => {
    const { rows } = await c.query("select * from public.create_order($1::jsonb, $2::jsonb)", [JSON.stringify(order), JSON.stringify(items)]);
    return rows[0] as { order_id: string; order_number: string };
  });
  return { id: row.order_id, number: row.order_number, tokenHash };
}

/** Build the add request exactly as the Server Action does, from the real menu. */
function staffRequest(orderId: string, item: Record<string, unknown>, requestId = randomUUID()) {
  const built = buildStaffAddition({ orderId, requestId, item }, localMenu);
  assert.ok(built.ok, `server rejected the item: ${JSON.stringify(built)}`);
  return built.value;
}

type AddRow = {
  order_id: string;
  order_number: string;
  table_number: number | null;
  description: string;
  added_amount: string;
  previous_total: string;
  new_subtotal: string;
  new_delivery_fee: string;
  new_total: string;
  is_new: boolean;
};

/** Call add_order_item() the way our server does (service role + verified admin id). */
function addItem(
  req: { orderId: string; requestId: string; item: unknown },
  { role = "service_role", admin = adminId }: { role?: "service_role" | "authenticated" | "anon"; admin?: string } = {},
) {
  return asRole(pool, role, role === "authenticated" ? adminId : null, async (c) => {
    const { rows } = await c.query("select * from public.add_order_item($1, $2, $3, $4::jsonb)", [
      req.orderId,
      req.requestId,
      admin,
      JSON.stringify(req.item),
    ]);
    return rows[0] as AddRow;
  });
}

async function orderRow(id: string) {
  const { rows } = await pool.query("select order_number, table_number, status, subtotal, delivery_fee, total from public.orders where id = $1", [id]);
  return rows[0];
}
async function itemRows(id: string) {
  const { rows } = await pool.query(
    "select line_number, product_key, product_name, unit_price, quantity, line_total, source, added_by, created_at from public.order_items where order_id = $1 order by line_number",
    [id],
  );
  return rows;
}
const count = async (sql: string, params: unknown[] = []) => Number((await pool.query(sql, params)).rows[0].n);

/** Move an order along valid transitions (as the database owner, like the trigger allows). */
async function moveTo(id: string, path: OrderStatus[]) {
  for (const status of path) await pool.query("update public.orders set status = $2 where id = $1", [id, status]);
}

const EXTRA_RICE = { kind: "extra", extraId: "extra-rice", quantity: 1, notes: "" };
const RICE_PRICE = localMenu.addons.find((a) => a.id === "addon-plain-rice")!.price;

// ---- the Table 5 scenario ------------------------------------------------------------

describe("adding Extra Rice to RN order at Table 5", () => {
  test("same RN number, same table, one more line, total goes up by the rice price", async () => {
    const order = await createOrder();
    const before = await orderRow(order.id);
    const oldItems = await itemRows(order.id);
    const ordersBefore = await count("select count(*) as n from public.orders");
    assert.equal(before.table_number, 5);
    assert.equal(Number(before.total), 265);

    const res = await addItem(staffRequest(order.id, EXTRA_RICE));
    assert.equal(res.is_new, true);
    assert.equal(res.order_number, order.number, "same RN number");
    assert.equal(res.table_number, 5, "same table");
    assert.equal(res.description, "Extra Rice ×1");
    assert.equal(Number(res.added_amount), RICE_PRICE);
    assert.equal(Number(res.previous_total), 265);
    assert.equal(Number(res.new_total), 265 + RICE_PRICE);

    const after = await orderRow(order.id);
    assert.equal(after.order_number, order.number);
    assert.equal(after.table_number, 5);
    assert.equal(Number(after.subtotal), 265 + RICE_PRICE);
    assert.equal(Number(after.total), 265 + RICE_PRICE);
    assert.equal(await count("select count(*) as n from public.orders"), ordersBefore, "no new order (no RN-0013)");

    const items = await itemRows(order.id);
    assert.equal(items.length, oldItems.length + 1, "order_items gains exactly one line");
    assert.deepEqual(items.slice(0, oldItems.length), oldItems, "earlier lines (and their prices) are untouched");
    const added = items.at(-1);
    assert.equal(added.line_number, 3);
    assert.equal(added.product_key, "extra-rice");
    assert.equal(added.product_name, "Extra Rice");
    assert.equal(Number(added.unit_price), RICE_PRICE, "price snapshot from the menu");
    assert.equal(added.source, "staff");
    assert.equal(added.added_by, adminId);
    assert.ok(oldItems.every((i) => i.source === "customer"));
  });

  test("audit trail: 'Extra Rice ×1 added by Bam' with amount, totals and time", async () => {
    const order = await createOrder();
    await addItem(staffRequest(order.id, EXTRA_RICE));
    const { rows } = await pool.query("select * from public.order_adjustments where order_id = $1", [order.id]);
    assert.equal(rows.length, 1);
    const a = rows[0];
    assert.equal(a.description, "Extra Rice ×1");
    assert.equal(a.added_by, adminId);
    assert.equal(a.added_by_name, "Bam (test)");
    assert.equal(Number(a.amount), RICE_PRICE);
    assert.equal(Number(a.previous_total), 265);
    assert.equal(Number(a.new_total), 265 + RICE_PRICE);
    assert.ok(a.created_at instanceof Date);
    assert.equal(a.acknowledged_at, null);
  });

  test("a menu product with size and add-on is priced by the server", async () => {
    const order = await createOrder();
    const fries = localMenu.products.find((p) => p.id === "french-fries")!;
    const duo = fries.sizes.find((s) => s.name === "Duo")!;
    const cheese = localMenu.addons.find((a) => a.id === "addon-cheese-sauce")!;
    const req = staffRequest(order.id, {
      kind: "product",
      productId: "french-fries",
      sizeId: duo.id,
      optionIds: [],
      addonIds: [cheese.id],
      quantity: 2,
      notes: "extra crispy",
    });
    const res = await addItem(req);
    assert.equal(res.description, "French Fries (Duo) ×2");
    assert.equal(Number(res.added_amount), (duo.price + cheese.price) * 2);
    const added = (await itemRows(order.id)).at(-1);
    assert.equal(Number(added.unit_price), duo.price + cheese.price);
    assert.equal(added.quantity, 2);
  });

  test("customer tracking shows the added item and new total, but not who added it", async () => {
    const order = await createOrder();
    await addItem(staffRequest(order.id, EXTRA_RICE));
    const tracking = await asRole(pool, "service_role", null, async (c) => {
      const { rows } = await c.query("select public.get_order_tracking($1) as t", [order.tokenHash]);
      return rows[0].t;
    });
    assert.deepEqual(
      tracking.items.map((i: { name: string }) => i.name),
      ["Spanish Latte", "French Fries", "Extra Rice"],
    );
    assert.equal(Number(tracking.total), 265 + RICE_PRICE);
    const json = JSON.stringify(tracking);
    assert.ok(!json.includes(adminId) && !json.includes("Bam"), "no staff identity in tracking");
  });
});

// ---- double taps and retries -------------------------------------------------------------

describe("duplicate clicks", () => {
  test("the same request twice adds the rice once", async () => {
    const order = await createOrder();
    const req = staffRequest(order.id, EXTRA_RICE);
    const first = await addItem(req);
    const second = await addItem(req);
    assert.equal(first.is_new, true);
    assert.equal(second.is_new, false);
    assert.equal(Number(second.new_total), 265 + RICE_PRICE);
    assert.equal((await itemRows(order.id)).length, 3);
    assert.equal(Number((await orderRow(order.id)).total), 265 + RICE_PRICE);
  });

  test("two parallel calls with the same request add the rice once", async () => {
    const order = await createOrder();
    const req = staffRequest(order.id, EXTRA_RICE);
    const results = await Promise.all([addItem(req), addItem(req)]);
    assert.deepEqual(results.map((r) => r.is_new).sort(), [false, true]);
    assert.equal((await itemRows(order.id)).length, 3);
    assert.equal(await count("select count(*) as n from public.order_adjustments where order_id = $1", [order.id]), 1);
  });

  test("a request id reused for another order is refused", async () => {
    const a = await createOrder();
    const b = await createOrder();
    const req = staffRequest(a.id, EXTRA_RICE);
    await addItem(req);
    await assert.rejects(addItem({ ...req, orderId: b.id }), /idempotency_key_reused/);
    assert.equal((await itemRows(b.id)).length, 2);
  });

  test("two different requests add two lines", async () => {
    const order = await createOrder();
    await addItem(staffRequest(order.id, EXTRA_RICE));
    await addItem(staffRequest(order.id, { kind: "extra", extraId: "extra-kimchi", quantity: 1 }));
    assert.deepEqual(
      (await itemRows(order.id)).map((i) => i.product_name),
      ["Spanish Latte", "French Fries", "Extra Rice", "Kimchi"],
    );
  });
});

// ---- which orders can take items ---------------------------------------------------------

describe("eligibility", () => {
  const PATHS: Record<string, OrderStatus[]> = {
    received: [],
    confirmed: ["confirmed"],
    preparing: ["confirmed", "preparing"],
    ready: ["confirmed", "preparing", "ready"],
    out_for_delivery: ["confirmed", "preparing", "ready", "out_for_delivery"],
    completed: ["confirmed", "preparing", "ready", "completed"],
    cancelled: ["cancelled"],
  };

  for (const type of ["dine_in", "take_out", "delivery"] as const) {
    for (const [status, path] of Object.entries(PATHS)) {
      if (status === "out_for_delivery" && type !== "delivery") continue;
      const steps = type === "delivery" && status === "completed" ? ["confirmed", "preparing", "ready", "out_for_delivery", "completed"] : path;
      test(`${type} ${status}: ${canAddItems(status) ? "accepts" : "refuses"} new items (matches the app)`, async () => {
        const order = await createOrder({ type, lines: [{ name: "Big Order", price: 400 }], fee: type === "delivery" ? 50 : 0 });
        await moveTo(order.id, steps as OrderStatus[]);
        const req = staffRequest(order.id, EXTRA_RICE);
        if (canAddItems(status)) {
          const res = await addItem(req);
          assert.equal(res.is_new, true);
        } else {
          await assert.rejects(addItem(req), /order_closed/);
          assert.equal((await itemRows(order.id)).length, 1, "nothing added");
        }
      });
    }
  }

  test("the app's addable statuses are exactly received, confirmed, preparing, ready", () => {
    assert.deepEqual([...ADDABLE_STATUSES], ["received", "confirmed", "preparing", "ready"]);
  });

  test("unknown order is refused", async () => {
    await assert.rejects(addItem(staffRequest(randomUUID(), EXTRA_RICE)), /order_not_found/);
  });
});

// ---- prices and permissions ----------------------------------------------------------------

describe("prices can't be faked", () => {
  test("browser-sent prices are ignored by the server builder", async () => {
    const order = await createOrder();
    const built = buildStaffAddition(
      { orderId: order.id, requestId: randomUUID(), item: { ...EXTRA_RICE, unit_price: 1, price: 1, line_total: 1 } },
      localMenu,
    );
    assert.ok(built.ok);
    assert.equal(built.value.item.unit_price, RICE_PRICE);
  });

  test("an item whose arithmetic doesn't add up is refused by the database", async () => {
    const order = await createOrder();
    const req = staffRequest(order.id, EXTRA_RICE);
    await assert.rejects(addItem({ ...req, item: { ...req.item, unit_price: 1 } }), /item_price_mismatch/);
    await assert.rejects(addItem({ ...req, item: { ...req.item, quantity: 0 } }), /invalid_item/);
    assert.equal((await itemRows(order.id)).length, 2);
  });

  test("signed-in staff can't call add_order_item directly (only our server can)", async () => {
    const order = await createOrder();
    const req = staffRequest(order.id, EXTRA_RICE);
    await assert.rejects(addItem(req, { role: "authenticated" }), /permission denied/);
    await assert.rejects(addItem(req, { role: "anon" }), /permission denied/);
  });

  test("staff can't insert lines or audit rows directly", async () => {
    const order = await createOrder();
    await assert.rejects(
      asRole(pool, "authenticated", adminId, (c) =>
        c.query(
          "insert into public.order_items (order_id, line_number, product_key, product_name, base_price, unit_price, quantity, line_total) values ($1, 9, 'x', 'Free Rice', 0, 0, 1, 0)",
          [order.id],
        ),
      ),
      /permission denied/,
    );
    await assert.rejects(
      asRole(pool, "authenticated", adminId, (c) => c.query("update public.order_adjustments set amount = 0")),
      /permission denied/,
    );
  });

  test("a user who isn't an admin is refused even via the server path", async () => {
    const order = await createOrder();
    await assert.rejects(addItem(staffRequest(order.id, EXTRA_RICE), { admin: userId }), /not_authorized/);
  });
});

// ---- delivery fee ------------------------------------------------------------------------------

describe("delivery fee", () => {
  test("becomes free when the new subtotal reaches the free-delivery amount; otherwise unchanged", async () => {
    const { rows } = await pool.query("select free_delivery_from from public.store_settings where id");
    const freeFrom = Number(rows[0].free_delivery_from);
    const fee = Number((await pool.query("select fee from public.delivery_areas where id = 'lourdes'")).rows[0].fee);

    const below = await createOrder({ type: "delivery", lines: [{ name: "Meal", price: 300 }], fee });
    const r1 = await addItem(staffRequest(below.id, EXTRA_RICE));
    assert.equal(Number(r1.new_delivery_fee), fee, "fee kept below the free amount");
    assert.equal(Number(r1.new_total), 300 + RICE_PRICE + fee);

    const near = await createOrder({ type: "delivery", lines: [{ name: "Meal", price: freeFrom - RICE_PRICE }], fee });
    const r2 = await addItem(staffRequest(near.id, EXTRA_RICE));
    assert.equal(Number(r2.new_delivery_fee), 0, "free once the subtotal reaches the free amount");
    assert.equal(Number(r2.new_total), freeFrom);
  });
});

// ---- kitchen acknowledgement and staff reads ---------------------------------------------------

describe("kitchen 'NEW / ADDED' acknowledgement", () => {
  test("'Got it' marks additions seen; only admins can do it", async () => {
    const order = await createOrder();
    await addItem(staffRequest(order.id, EXTRA_RICE));
    await assert.rejects(
      asRole(pool, "authenticated", userId, (c) => c.query("select public.acknowledge_order_additions($1)", [order.id])),
      /not_authorized/,
    );
    await assert.rejects(
      asRole(pool, "anon", null, (c) => c.query("select public.acknowledge_order_additions($1)", [order.id])),
      /permission denied/,
    );
    const n = await asRole(pool, "authenticated", adminId, async (c) => {
      const { rows } = await c.query("select public.acknowledge_order_additions($1) as n", [order.id]);
      return rows[0].n;
    });
    assert.equal(n, 1);
    assert.equal(await count("select count(*) as n from public.order_adjustments where order_id = $1 and acknowledged_at is null", [order.id]), 0);
  });

  test("moving the order to its next status also clears the NEW mark", async () => {
    const order = await createOrder();
    await addItem(staffRequest(order.id, EXTRA_RICE));
    await asRole(pool, "authenticated", adminId, (c) =>
      c.query("select * from public.update_order_status($1, 'received', 'confirmed')", [order.id]),
    );
    assert.equal(await count("select count(*) as n from public.order_adjustments where order_id = $1 and acknowledged_at is null", [order.id]), 0);
  });

  test("admins can read the audit trail and new columns; other users and anon can't", async () => {
    const order = await createOrder();
    await addItem(staffRequest(order.id, EXTRA_RICE));
    const asAdmin = await asRole(pool, "authenticated", adminId, async (c) => {
      const a = await c.query("select description, added_by_name from public.order_adjustments where order_id = $1", [order.id]);
      const i = await c.query("select source from public.order_items where order_id = $1 order by line_number", [order.id]);
      return { a: a.rows, i: i.rows.map((r) => r.source) };
    });
    assert.deepEqual(asAdmin.a, [{ description: "Extra Rice ×1", added_by_name: "Bam (test)" }]);
    assert.deepEqual(asAdmin.i, ["customer", "customer", "staff"]);
    const asUser = await asRole(pool, "authenticated", userId, async (c) =>
      (await c.query("select * from public.order_adjustments")).rows.length,
    );
    assert.equal(asUser, 0);
    await assert.rejects(
      asRole(pool, "anon", null, (c) => c.query("select * from public.order_adjustments")),
      /permission denied/,
    );
  });
});
