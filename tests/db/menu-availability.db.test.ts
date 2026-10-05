// Tests for the additive migration 20261006090000_menu_availability_and_realtime.sql
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type pg from "pg";
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

const permissionDenied = (error: unknown) => {
  assert.equal((error as { code?: string }).code, "42501", (error as Error).message);
  return true;
};

const upsert = "insert into public.menu_availability (item_type, item_key, is_available) values ($1, $2, $3) on conflict (item_type, item_key) do update set is_available = excluded.is_available";

test("admin can mark a product sold out and available again; updated_by is the admin", async () => {
  await asRole(pool, "authenticated", adminId, (c) => c.query(upsert, ["product", "spanish-latte", false]));
  let { rows } = await pool.query("select is_available, updated_by from public.menu_availability where item_key = 'spanish-latte'");
  assert.deepEqual(rows[0], { is_available: false, updated_by: adminId });
  await asRole(pool, "authenticated", adminId, (c) => c.query(upsert, ["product", "spanish-latte", true]));
  ({ rows } = await pool.query("select is_available from public.menu_availability where item_key = 'spanish-latte'"));
  assert.equal(rows[0].is_available, true);
});

test("updated_by can't be faked by the client", async () => {
  await asRole(pool, "authenticated", adminId, (c) =>
    c.query("insert into public.menu_availability (item_type, item_key, is_available, updated_by) values ('addon', 'addon-oat-milk', false, $1)", [userId]),
  );
  const { rows } = await pool.query("select updated_by from public.menu_availability where item_key = 'addon-oat-milk'");
  assert.equal(rows[0].updated_by, adminId);
});

test("customers (anon) can read availability but not change it", async () => {
  const { rows } = await asRole(pool, "anon", null, (c) => c.query("select item_key, is_available from public.menu_availability"));
  assert.ok(rows.length >= 1);
  await assert.rejects(asRole(pool, "anon", null, (c) => c.query(upsert, ["product", "americano", false])), permissionDenied);
  await assert.rejects(asRole(pool, "anon", null, (c) => c.query("delete from public.menu_availability")), permissionDenied);
});

test("signed-in non-admins can't change availability", async () => {
  await assert.rejects(
    asRole(pool, "authenticated", userId, (c) => c.query(upsert, ["product", "americano", false])),
    (e: Error & { code?: string }) => e.code === "42501" && /row-level security/.test(e.message),
  );
  const updated = await asRole(pool, "authenticated", userId, (c) =>
    c.query("update public.menu_availability set is_available = true where item_key = 'addon-oat-milk'"),
  );
  assert.equal(updated.rowCount, 0, "RLS hides rows from non-admins for update");
});

test("bad item types and keys are rejected", async () => {
  await assert.rejects(asRole(pool, "authenticated", adminId, (c) => c.query(upsert, ["drink", "americano", false])));
  await assert.rejects(asRole(pool, "authenticated", adminId, (c) => c.query(upsert, ["product", "Americano!", false])));
});

test("orders are published to Realtime (admins only receive them, via RLS)", async () => {
  const { rows } = await pool.query(
    "select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'",
  );
  assert.deepEqual(rows.map((r) => r.tablename), ["orders"]);
});

test("the migration changed nothing in the order tables' security", async () => {
  await assert.rejects(asRole(pool, "anon", null, (c) => c.query("select * from public.orders")), permissionDenied);
  const { rows } = await pool.query(
    "select relname, relrowsecurity from pg_class where relname in ('orders','order_items','order_status_history','menu_availability') order by 1",
  );
  assert.ok(rows.every((r) => r.relrowsecurity === true));
});
