// Every status button the app shows (admin board, kitchen, cancel) must be a
// transition the database allows; and nothing the database refuses is offered.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type pg from "pg";
import { canCancel, kitchenAction, nextAction, type OrderStatus } from "@/lib/orders/status";
import { startTestDatabase } from "./harness";

let db: Awaited<ReturnType<typeof startTestDatabase>>;
let pool: pg.Pool;
before(async () => {
  db = await startTestDatabase();
  pool = db.pool;
});
after(async () => db?.stop());

const TYPES = ["dine_in", "take_out", "delivery"] as const;
const STATUSES: OrderStatus[] = ["received", "confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"];

async function allowed(type: string, from: string, to: string) {
  const { rows } = await pool.query("select public.is_valid_status_transition($1, $2, $3) as ok", [type, from, to]);
  return rows[0].ok as boolean;
}

test("admin 'next step', kitchen and cancel buttons only offer transitions the database allows", async () => {
  for (const type of TYPES) {
    for (const status of STATUSES) {
      const next = nextAction(type, status);
      if (next) assert.ok(await allowed(type, status, next.to), `${type}: ${status} → ${next.to}`);
      const kitchen = kitchenAction(status);
      if (kitchen) assert.ok(await allowed(type, status, kitchen.to), `kitchen ${type}: ${status} → ${kitchen.to}`);
      assert.equal(canCancel(status), await allowed(type, status, "cancelled"), `cancel ${type} from ${status}`);
    }
  }
});

test("every active status has a next step; final statuses have none", () => {
  for (const type of TYPES) {
    for (const status of STATUSES) {
      const final = status === "completed" || status === "cancelled";
      const reachable = !(status === "out_for_delivery" && type !== "delivery");
      if (reachable) assert.equal(nextAction(type, status) === null, final, `${type} ${status}`);
    }
  }
});
