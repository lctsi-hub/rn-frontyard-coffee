// READ-ONLY verification of the cloud schema. Makes no changes:
// only SELECTs / counts, the API's schema listing, and calls to functions that
// cannot write (is_valid_status_transition, is_admin, get_order_tracking with a
// random hash). Functions that can write are only checked for existence and
// that the publishable key is refused permission to run them.
// Never prints keys or the full project URL.
// Run with: npm run cloud:verify
import { randomBytes, createHash } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secretKey) {
  console.error("✗ Missing Supabase settings in .env.local (run npm run env:check).");
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const server = createClient(url, secretKey, options); // secret key → service_role
const publicClient = createClient(url, publishableKey, options); // publishable key → anon

const results = [];
const record = (ok, label, detail = "") => results.push({ ok, label, detail });
const describe = (error) => (error ? `${error.code ?? ""} ${error.message ?? ""}`.trim() : "");

console.log(`Project: ${ref.slice(0, 4)}…${ref.slice(-2)} (read-only checks)\n`);

// 1 + 7. Tables exist and the secret-key (server) client can read them.
const TABLES = ["orders", "order_items", "order_status_history", "store_settings", "delivery_areas", "admin_users"];
for (const table of TABLES) {
  const { error, count } = await server.from(table).select("*", { count: "exact", head: true });
  record(!error, `table ${table} exists and is readable by the server (secret key)`, error ? describe(error) : `${count} row(s)`);
}

// 3. store_settings: exactly one row with the expected delivery configuration.
{
  const { data, error } = await server.from("store_settings").select("*");
  const row = data?.[0];
  const ok =
    !error &&
    data.length === 1 &&
    row.ordering_enabled === true &&
    row.delivery_enabled === true &&
    Number(row.delivery_min_order) === 300 &&
    Number(row.free_delivery_from) === 500;
  record(
    ok,
    "store_settings: 1 row, ordering on, delivery on, minimum ₱300, free from ₱500",
    error ? describe(error) : `${data.length} row(s): min ₱${Number(row?.delivery_min_order)}, free from ₱${Number(row?.free_delivery_from)}`,
  );
}

// 4. delivery_areas: exactly the five expected areas and fees.
{
  const expected = [
    ["lourdes", "Lourdes", 50],
    ["salapungan", "Salapungan", 50],
    ["batasan", "Batasan", 70],
    ["magumbali", "Magumbali", 70],
    ["mandili", "Mandili", 70],
  ];
  const { data, error } = await server.from("delivery_areas").select("id, name, fee, is_active").order("sort_order");
  const actual = (data ?? []).map((a) => [a.id, a.name, Number(a.fee)]);
  const ok = !error && JSON.stringify(actual) === JSON.stringify(expected) && data.every((a) => a.is_active);
  record(ok, "delivery_areas: Lourdes ₱50, Salapungan ₱50, Batasan ₱70, Magumbali ₱70, Mandili ₱70 (all active)",
    error ? describe(error) : actual.map(([, n, f]) => `${n} ₱${f}`).join(", "));
}

// 5. orders: zero rows.
{
  const { count, error } = await server.from("orders").select("*", { count: "exact", head: true });
  record(!error && count === 0, "orders: 0 rows", error ? describe(error) : `${count} row(s)`);
}

// 6. Functions exist (from the API's schema listing; nothing is executed).
{
  const response = await fetch(`${url}/rest/v1/`, { headers: { apikey: secretKey, Accept: "application/openapi+json" } });
  const spec = response.ok ? await response.json() : null;
  const paths = Object.keys(spec?.paths ?? {});
  for (const fn of ["create_order", "get_order_tracking", "update_order_status", "is_admin", "is_valid_status_transition"]) {
    record(paths.includes(`/rpc/${fn}`), `function ${fn} exists (API schema listing)`, response.ok ? "" : `listing HTTP ${response.status}`);
  }
}

// 6b. Read-only function behaviour.
{
  const ok1 = await server.rpc("is_valid_status_transition", { p_type: "dine_in", p_from: "received", p_to: "confirmed" });
  const ok2 = await server.rpc("is_valid_status_transition", { p_type: "dine_in", p_from: "completed", p_to: "preparing" });
  record(!ok1.error && ok1.data === true && !ok2.error && ok2.data === false,
    "is_valid_status_transition: received→confirmed allowed, completed→preparing refused",
    describe(ok1.error ?? ok2.error));

  const admin = await server.rpc("is_admin");
  record(!admin.error && admin.data === false, "is_admin(): false for the server key (no signed-in admin)", describe(admin.error));

  const randomHash = createHash("sha256").update(randomBytes(32)).digest("hex");
  const track = await server.rpc("get_order_tracking", { p_token_hash: randomHash });
  record(!track.error && track.data === null, "get_order_tracking: unknown token returns nothing", describe(track.error));
}

// 8. Publishable (public) key cannot read orders or run order functions.
{
  for (const table of ["orders", "order_items", "order_status_history", "admin_users"]) {
    const { data, error } = await publicClient.from(table).select("*").limit(1);
    const denied = Boolean(error) || (Array.isArray(data) && data.length === 0);
    record(denied, `publishable key cannot read ${table}`, error ? describe(error) : `${data?.length ?? 0} row(s) visible`);
  }
  // These are refused before the function body runs, so nothing can be written.
  const create = await publicClient.rpc("create_order", { p_order: {}, p_items: [] });
  record(create.error?.code === "42501", "publishable key is refused permission to run create_order", describe(create.error));
  const status = await publicClient.rpc("update_order_status", {
    p_order_id: "00000000-0000-0000-0000-000000000000",
    p_from_status: "received",
    p_to_status: "confirmed",
  });
  record(status.error?.code === "42501", "publishable key is refused permission to run update_order_status", describe(status.error));
  const tracking = await publicClient.rpc("get_order_tracking", { p_token_hash: "0".repeat(64) });
  record(tracking.error?.code === "42501", "publishable key is refused permission to run get_order_tracking", describe(tracking.error));

  const areas = await publicClient.from("delivery_areas").select("id");
  record(!areas.error && areas.data.length === 5, "publishable key can read the 5 active delivery areas (needed by checkout later)", describe(areas.error));
}

// Re-confirm nothing changed.
{
  const { count } = await server.from("orders").select("*", { count: "exact", head: true });
  record(count === 0, "orders still 0 rows after verification", `${count} row(s)`);
}

for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.label}${r.detail ? `  [${r.detail}]` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} checks passed. No data was changed.`);
process.exit(failed ? 1 : 0);
