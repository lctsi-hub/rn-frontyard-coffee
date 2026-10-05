// Database tests for the Phase 5A migration, run against a throwaway local
// PostgreSQL 17 (tests/db/harness.ts). Run with: npm run test:db
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type pg from "pg";
import { localMenu } from "@/data/menu-data";
import { localStoreSettings } from "@/data/store-settings";
import { buildOrder } from "@/lib/orders/build-order";
import { cartTotalling } from "../support/carts";
import { asRole, createUser, startTestDatabase } from "./harness";

process.env.TRACKING_TOKEN_SECRET ??= "db-test-secret-that-is-at-least-32-characters";

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

after(async () => {
  await db?.stop();
});

// ---- helpers ---------------------------------------------------------------------

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

type OrderSpec = {
  key?: string;
  type?: "dine_in" | "take_out" | "delivery";
  subtotal?: number;
  areaId?: string;
  fee?: number;
  token?: string;
  items?: unknown[];
  name?: string;
};

/** A create_order() payload with one test line priced at `subtotal`. */
function payload(spec: OrderSpec = {}) {
  const type = spec.type ?? "take_out";
  const subtotal = spec.subtotal ?? 99;
  const token = spec.token ?? randomBytes(32).toString("base64url");
  const order = {
    client_request_id: spec.key ?? randomUUID(),
    tracking_token_hash: sha256(token),
    expected_total: subtotal + (spec.fee ?? 0),
    order_type: type,
    customer_name: spec.name ?? "Maria Santos",
    customer_phone: "09171234567",
    table_number: type === "dine_in" ? 5 : null,
    delivery_area_id: type === "delivery" ? (spec.areaId ?? "lourdes") : null,
    delivery_address: type === "delivery" ? "123 Rizal St., Purok 2" : null,
    delivery_landmark: type === "delivery" ? "Beside the chapel" : null,
    delivery_instructions: type === "delivery" ? "Call when outside" : null,
    payment_method: "cash",
    notes: "",
  };
  const items = spec.items ?? [
    {
      product_key: "test-item",
      product_name: "Test Item",
      category_name: "Test",
      size_name: null,
      base_price: subtotal,
      options: [],
      addons: [],
      unit_price: subtotal,
      quantity: 1,
      notes: "",
    },
  ];
  return { order, items, token };
}

type Created = { order_id: string; order_number: string; total: string; is_new: boolean };

function createOrder(p: { order: unknown; items: unknown }, role: "service_role" | "anon" | "authenticated" = "service_role") {
  return asRole(pool, role, role === "authenticated" ? userId : null, async (c) => {
    const { rows } = await c.query<Created>("select * from public.create_order($1::jsonb, $2::jsonb)", [
      JSON.stringify(p.order),
      JSON.stringify(p.items),
    ]);
    return rows[0];
  });
}

async function countRowsFor(key: string) {
  const { rows } = await pool.query(
    `select
       (select count(*) from public.orders where client_request_id = $1)::int as orders,
       (select count(*) from public.order_items i join public.orders o on o.id = i.order_id where o.client_request_id = $1)::int as items,
       (select count(*) from public.order_status_history h join public.orders o on o.id = h.order_id where o.client_request_id = $1)::int as history`,
    [key],
  );
  return rows[0] as { orders: number; items: number; history: number };
}

async function totalCounts() {
  const { rows } = await pool.query(
    `select (select count(*) from public.orders)::int as orders,
            (select count(*) from public.order_items)::int as items,
            (select count(*) from public.order_status_history)::int as history`,
  );
  return rows[0] as { orders: number; items: number; history: number };
}

const failsWith = (code: string) => (error: unknown) => {
  assert.equal((error as Error).message, code);
  return true;
};
const permissionDenied = (error: unknown) => {
  assert.equal((error as { code?: string }).code, "42501", (error as Error).message);
  return true;
};

function setStatus(orderId: string, from: string, to: string, actor = adminId) {
  return asRole(pool, "authenticated", actor, async (c) => {
    const { rows } = await c.query("select * from public.update_order_status($1, $2, $3)", [orderId, from, to]);
    return rows[0] as { order_number: string; status: string };
  });
}

// ---- tests -------------------------------------------------------------------------

describe("order creation", () => {
  test("two simultaneous valid orders get different RN numbers", async () => {
    const [a, b] = await Promise.all([createOrder(payload()), createOrder(payload())]);
    assert.match(a.order_number, /^RN-\d{4}$/);
    assert.match(b.order_number, /^RN-\d{4}$/);
    assert.notEqual(a.order_number, b.order_number);
  });

  test("25 simultaneous orders: 25 unique numbers, each with items and a 'received' history row", async () => {
    const keys = Array.from({ length: 25 }, () => randomUUID());
    const results = await Promise.all(keys.map((key) => createOrder(payload({ key }))));
    assert.equal(new Set(results.map((r) => r.order_number)).size, 25);
    for (const key of keys) assert.deepEqual(await countRowsFor(key), { orders: 1, items: 1, history: 1 });
  });

  test("a real cart built on the server from the menu is accepted as-is", async () => {
    const { trackingTokenFor, hashTrackingToken } = await import("@/lib/orders/tracking-token");
    const key = randomUUID();
    const built = buildOrder(
      {
        clientRequestId: key,
        expectedTotal: 370,
        orderType: "delivery",
        customer: { name: "Maria Santos", phone: "0917 123 4567" },
        delivery: { areaId: "mandili", address: "123 Rizal St", landmark: "Chapel", instructions: "" },
        paymentMethod: "gcash",
        notes: "Extra tissue please",
        items: cartTotalling(300),
      },
      localMenu,
      localStoreSettings,
    );
    assert.ok(built.ok);
    if (!built.ok) return;
    const token = trackingTokenFor(key);
    const created = await createOrder({
      order: { ...built.value.order, tracking_token_hash: hashTrackingToken(token) },
      items: built.value.items,
    });
    assert.equal(Number(created.total), 370);
    assert.equal(created.is_new, true);
    const { rows } = await pool.query("select subtotal, delivery_fee, delivery_area_name from public.orders where id = $1", [created.order_id]);
    assert.deepEqual(rows[0], { subtotal: "300.00", delivery_fee: "70.00", delivery_area_name: "Mandili" });
  });
});

describe("transaction rollback", () => {
  test("if one item is invalid, no order, items or history rows remain", async () => {
    const before = await totalCounts();
    const key = randomUUID();
    const good = payload({ key }).items[0] as Record<string, unknown>;
    const p = payload({
      key,
      subtotal: 99 + 99 * 25,
      items: [good, { ...good, product_name: "Bad quantity", unit_price: 99, base_price: 99, quantity: 25 }],
    });
    await assert.rejects(createOrder(p));
    assert.deepEqual(await countRowsFor(key), { orders: 0, items: 0, history: 0 });
    assert.deepEqual(await totalCounts(), before);
  });

  test("an item whose price doesn't add up is rejected before anything is saved", async () => {
    const before = await totalCounts();
    const item = { ...(payload().items[0] as object), unit_price: 1 };
    await assert.rejects(createOrder(payload({ subtotal: 99, items: [item] })), failsWith("item_price_mismatch"));
    assert.deepEqual(await totalCounts(), before);
  });

  test("a total different from what the customer saw is rejected", async () => {
    const p = payload({ subtotal: 99 });
    await assert.rejects(createOrder({ ...p, order: { ...p.order, expected_total: 50 } }), failsWith("total_changed"));
  });
});

describe("duplicate submission (idempotency key)", () => {
  test("five simultaneous submissions with the same key create exactly one order", async () => {
    const p = payload();
    const results = await Promise.all(Array.from({ length: 5 }, () => createOrder(p)));
    assert.equal(new Set(results.map((r) => r.order_number)).size, 1, "everyone gets the same RN number");
    assert.equal(results.filter((r) => r.is_new).length, 1, "only one call created it");
    assert.deepEqual(await countRowsFor(p.order.client_request_id), { orders: 1, items: 1, history: 1 });
  });

  test("a later retry of the same request returns the same order", async () => {
    const p = payload();
    const first = await createOrder(p);
    const retry = await createOrder(p);
    assert.equal(retry.order_number, first.order_number);
    assert.equal(retry.is_new, false);
    assert.equal((await countRowsFor(p.order.client_request_id)).orders, 1);
  });

  test("same key with a different cart is rejected, original untouched", async () => {
    const p = payload({ subtotal: 99 });
    const first = await createOrder(p);
    const other = payload({ key: p.order.client_request_id, subtotal: 149, token: p.token });
    await assert.rejects(createOrder(other), failsWith("idempotency_key_reused"));
    const { rows } = await pool.query("select total from public.orders where id = $1", [first.order_id]);
    assert.equal(rows[0].total, "99.00");
  });

  test("same key with different customer details is rejected", async () => {
    const p = payload();
    await createOrder(p);
    await assert.rejects(createOrder({ ...p, order: { ...p.order, customer_name: "Someone Else" } }), failsWith("idempotency_key_reused"));
  });

  test("same key and cart, simultaneous, but different payloads: one wins, the other is rejected", async () => {
    const key = randomUUID();
    const a = payload({ key, subtotal: 99 });
    const b = payload({ key, subtotal: 149, token: a.token });
    const results = await Promise.allSettled([createOrder(a), createOrder(b)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    assert.equal((rejected.reason as Error).message, "idempotency_key_reused");
    assert.equal((await countRowsFor(key)).orders, 1);
  });
});

describe("delivery pricing in the database", () => {
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
  for (const [subtotal, areaId, fee] of cases) {
    test(`₱${subtotal} to ${areaId} → ${fee === "reject" ? "rejected" : fee === 0 ? "FREE" : `₱${fee}`}`, async () => {
      if (fee === "reject") {
        await assert.rejects(createOrder(payload({ type: "delivery", subtotal, areaId })), failsWith("delivery_below_minimum"));
        return;
      }
      const created = await createOrder(payload({ type: "delivery", subtotal, areaId, fee }));
      const { rows } = await pool.query("select subtotal, delivery_fee, total from public.orders where id = $1", [created.order_id]);
      assert.deepEqual(rows[0], {
        subtotal: subtotal.toFixed(2),
        delivery_fee: fee.toFixed(2),
        total: (subtotal + fee).toFixed(2),
      });
    });
  }

  test("a fee the database didn't calculate is rejected (browser/server can't pick the fee)", async () => {
    await assert.rejects(createOrder(payload({ type: "delivery", subtotal: 300, areaId: "mandili", fee: 50 })), failsWith("total_changed"));
  });

  test("switched-off or unknown area → delivery_area_invalid", async () => {
    await pool.query("update public.delivery_areas set is_active = false where id = 'batasan'");
    try {
      await assert.rejects(createOrder(payload({ type: "delivery", subtotal: 300, areaId: "batasan", fee: 70 })), failsWith("delivery_area_invalid"));
      await assert.rejects(createOrder(payload({ type: "delivery", subtotal: 300, areaId: "manila", fee: 70 })), failsWith("delivery_area_invalid"));
    } finally {
      await pool.query("update public.delivery_areas set is_active = true where id = 'batasan'");
    }
  });

  test("area name and charged fee are kept on old orders when the area is edited", async () => {
    const created = await createOrder(payload({ type: "delivery", subtotal: 300, areaId: "salapungan", fee: 50 }));
    await pool.query("update public.delivery_areas set name = 'Salapungan (renamed)', fee = 80 where id = 'salapungan'");
    try {
      const { rows } = await pool.query("select delivery_area_name, delivery_fee from public.orders where id = $1", [created.order_id]);
      assert.deepEqual(rows[0], { delivery_area_name: "Salapungan", delivery_fee: "50.00" });
    } finally {
      await pool.query("update public.delivery_areas set name = 'Salapungan', fee = 50 where id = 'salapungan'");
    }
  });
});

describe("security", () => {
  let orderId: string;
  before(async () => {
    orderId = (await createOrder(payload())).order_id;
  });

  test("anonymous customer cannot list orders, items or history", async () => {
    for (const table of ["orders", "order_items", "order_status_history", "admin_users"]) {
      await assert.rejects(asRole(pool, "anon", null, (c) => c.query(`select * from public.${table}`)), permissionDenied);
    }
  });

  test("anonymous customer cannot read an order directly by UUID", async () => {
    await assert.rejects(
      asRole(pool, "anon", null, (c) => c.query("select * from public.orders where id = $1", [orderId])),
      permissionDenied,
    );
  });

  test("anonymous customer cannot update status, create orders or read tracking directly", async () => {
    await assert.rejects(
      asRole(pool, "anon", null, (c) => c.query("update public.orders set status = 'cancelled' where id = $1", [orderId])),
      permissionDenied,
    );
    await assert.rejects(
      asRole(pool, "anon", null, (c) => c.query("select public.update_order_status($1, 'received', 'confirmed')", [orderId])),
      permissionDenied,
    );
    await assert.rejects(createOrder(payload(), "anon"), permissionDenied);
    await assert.rejects(asRole(pool, "anon", null, (c) => c.query("select public.get_order_tracking('x')")), permissionDenied);
  });

  test("anonymous customer can read active delivery areas and settings, but not change them", async () => {
    await pool.query("update public.delivery_areas set is_active = false where id = 'magumbali'");
    try {
      const { rows } = await asRole(pool, "anon", null, (c) => c.query("select id from public.delivery_areas order by sort_order"));
      assert.deepEqual(rows.map((r) => r.id), ["lourdes", "salapungan", "batasan", "mandili"]);
    } finally {
      await pool.query("update public.delivery_areas set is_active = true where id = 'magumbali'");
    }
    await assert.rejects(
      asRole(pool, "anon", null, (c) => c.query("update public.store_settings set delivery_min_order = 0")),
      permissionDenied,
    );
  });

  test("signed-in non-admin sees no orders and cannot manage them", async () => {
    const { rows } = await asRole(pool, "authenticated", userId, (c) => c.query("select * from public.orders"));
    assert.equal(rows.length, 0);
    await assert.rejects(setStatus(orderId, "received", "confirmed", userId), failsWith("not_authorized"));
    await assert.rejects(
      asRole(pool, "authenticated", userId, (c) => c.query("update public.orders set status = 'confirmed' where id = $1", [orderId])),
      permissionDenied,
    );
    await assert.rejects(createOrder(payload(), "authenticated"), permissionDenied);
    const settings = await asRole(pool, "authenticated", userId, (c) =>
      c.query("update public.store_settings set delivery_min_order = 0 returning id"),
    );
    assert.equal(settings.rowCount, 0, "RLS hides the row from non-admins");
  });

  test("admin can view all orders, but only through select (no direct update/delete)", async () => {
    const { rows } = await asRole(pool, "authenticated", adminId, (c) => c.query("select count(*)::int as n from public.orders"));
    const all = await pool.query("select count(*)::int as n from public.orders");
    assert.equal(rows[0].n, all.rows[0].n);
    await assert.rejects(
      asRole(pool, "authenticated", adminId, (c) => c.query("update public.orders set total = 0 where id = $1", [orderId])),
      permissionDenied,
    );
    await assert.rejects(
      asRole(pool, "authenticated", adminId, (c) => c.query("delete from public.orders where id = $1", [orderId])),
      permissionDenied,
    );
  });
});

describe("status transitions (admins, via update_order_status)", () => {
  async function newOrder(type: "dine_in" | "take_out" | "delivery") {
    const p = payload({ type, subtotal: 300, fee: type === "delivery" ? 50 : 0 });
    return (await createOrder(p)).order_id;
  }

  async function walk(orderId: string, path: string[]) {
    for (let i = 1; i < path.length; i++) {
      const r = await setStatus(orderId, path[i - 1], path[i]);
      assert.equal(r.status, path[i]);
    }
  }

  async function history(orderId: string) {
    const { rows } = await pool.query(
      "select from_status, to_status, changed_by from public.order_status_history where order_id = $1 order by changed_at, id",
      [orderId],
    );
    return rows;
  }

  test("dine in: received → confirmed → preparing → ready → completed, with history", async () => {
    const id = await newOrder("dine_in");
    await walk(id, ["received", "confirmed", "preparing", "ready", "completed"]);
    const h = await history(id);
    assert.deepEqual(
      h.map((r) => `${r.from_status ?? "∅"}→${r.to_status}`),
      ["∅→received", "received→confirmed", "confirmed→preparing", "preparing→ready", "ready→completed"],
    );
    assert.equal(h[0].changed_by, null, "the customer created it");
    assert.ok(h.slice(1).every((r) => r.changed_by === adminId), "each change records the admin");
  });

  test("take out: … preparing → ready → completed", async () => {
    await walk(await newOrder("take_out"), ["received", "confirmed", "preparing", "ready", "completed"]);
  });

  test("delivery: … preparing → out_for_delivery → completed", async () => {
    await walk(await newOrder("delivery"), ["received", "confirmed", "preparing", "out_for_delivery", "completed"]);
  });

  test("impossible transitions are rejected", async () => {
    const done = await newOrder("dine_in");
    await walk(done, ["received", "confirmed", "preparing", "ready", "completed"]);
    await assert.rejects(setStatus(done, "completed", "preparing"), failsWith("invalid_status_transition"));
    await assert.rejects(setStatus(done, "completed", "cancelled"), failsWith("invalid_status_transition"));

    const dineIn = await newOrder("dine_in");
    await walk(dineIn, ["received", "confirmed", "preparing"]);
    await assert.rejects(setStatus(dineIn, "preparing", "out_for_delivery"), failsWith("invalid_status_transition"));

    const skip = await newOrder("take_out");
    await assert.rejects(setStatus(skip, "received", "ready"), failsWith("invalid_status_transition"));

    const onTheRoad = await newOrder("delivery");
    await walk(onTheRoad, ["received", "confirmed", "preparing", "out_for_delivery"]);
    await assert.rejects(setStatus(onTheRoad, "out_for_delivery", "cancelled"), failsWith("invalid_status_transition"));
  });

  test("cancellation is allowed before the order leaves the shop, then final", async () => {
    for (const path of [["received"], ["received", "confirmed"], ["received", "confirmed", "preparing"]]) {
      const id = await newOrder("take_out");
      await walk(id, path);
      await setStatus(id, path.at(-1)!, "cancelled");
      await assert.rejects(setStatus(id, "cancelled", "received"), failsWith("invalid_status_transition"));
    }
  });

  test("a stale screen can't overwrite a newer status (status_changed)", async () => {
    const id = await newOrder("take_out");
    await setStatus(id, "received", "confirmed");
    await assert.rejects(setStatus(id, "received", "cancelled"), failsWith("status_changed"));
  });

  test("even a direct update as service_role (secret key) can't make an impossible jump", async () => {
    const id = await newOrder("dine_in");
    await assert.rejects(
      asRole(pool, "service_role", null, (c) => c.query("update public.orders set status = 'completed' where id = $1", [id])),
      failsWith("invalid_status_transition"),
    );
  });
});

describe("tracking", () => {
  let token: string;
  let orderNumber: string;
  before(async () => {
    const p = payload({ type: "delivery", subtotal: 320, areaId: "mandili", fee: 70, name: "Maria Clara Santos" });
    token = p.token;
    orderNumber = (await createOrder(p)).order_number;
  });

  function track(hash: string) {
    return asRole(pool, "service_role", null, async (c) => {
      const { rows } = await c.query("select public.get_order_tracking($1) as data", [hash]);
      return rows[0].data as Record<string, unknown> | null;
    });
  }

  test("a valid token returns only that order", async () => {
    const data = await track(sha256(token));
    assert.ok(data);
    assert.equal(data.order_number, orderNumber);
    assert.equal(data.customer_first_name, "Maria");
    assert.equal(data.status, "received");
    assert.equal((data.items as unknown[]).length, 1);
    assert.deepEqual((data.timeline as Array<{ status: string }>).map((t) => t.status), ["received"]);
  });

  test("an invalid token returns nothing", async () => {
    assert.equal(await track(sha256("not-a-real-token")), null);
    assert.equal(await track(sha256(token + "x")), null);
  });

  test("the database stores a hash, not the raw token", async () => {
    const { rows } = await pool.query("select to_jsonb(o) as row from public.orders o where order_number = $1", [orderNumber]);
    const row = rows[0].row as Record<string, unknown>;
    assert.equal(row.tracking_token_hash, sha256(token));
    assert.ok(!JSON.stringify(row).includes(token), "the raw token appears nowhere in the order row");
  });

  test("the tracking response has no phone, address, landmark, instructions or full name", async () => {
    const data = await track(sha256(token));
    const text = JSON.stringify(data);
    for (const secret of ["09171234567", "Rizal", "Purok", "chapel", "Call when outside", "Clara Santos"]) {
      assert.ok(!text.toLowerCase().includes(secret.toLowerCase()), `response must not contain "${secret}"`);
    }
    for (const key of ["customer_phone", "delivery_address", "delivery_landmark", "delivery_instructions", "customer_name", "id", "tracking_token_hash"]) {
      assert.ok(!(key in (data ?? {})), `response must not have "${key}"`);
    }
  });
});
