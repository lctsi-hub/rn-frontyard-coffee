import "server-only";

// Server side of Place Order and order tracking. Phase 5B wires this into the
// checkout as a Server Action; until the environment is configured it answers
// "not_connected" and the app stays in test mode.
import { getMenu } from "@/lib/menu";
import { getStoreSettings } from "@/lib/settings";
import { createSupabaseServiceClient, isServiceRoleConfigured } from "@/lib/supabase/service";
import { buildOrder } from "./build-order";
import { orderError, orderErrorFromDatabase, type OrderError } from "./errors";
import {
  hashTrackingToken,
  isTrackingSecretConfigured,
  isWellFormedTrackingToken,
  trackingTokenFor,
} from "./tracking-token";

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; total: number; trackingToken: string; isNew: boolean }
  | OrderError;

export function isOrderBackendConfigured() {
  return isServiceRoleConfigured() && isTrackingSecretConfigured();
}

/** `input` comes straight from the browser and is treated as untrusted. */
export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  if (!isOrderBackendConfigured()) return orderError("not_connected");

  const [menu, settings] = await Promise.all([getMenu(), getStoreSettings()]);
  const built = buildOrder(input, menu, settings);
  if (!built.ok) return built;

  const trackingToken = trackingTokenFor(built.value.order.client_request_id);
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_order: { ...built.value.order, tracking_token_hash: hashTrackingToken(trackingToken) },
    p_items: built.value.items,
  });

  if (error) {
    const mapped = orderErrorFromDatabase(error.message);
    if (mapped.code === "server_error") {
      // Log the database error code only: no keys, no customer details.
      console.error("[placeOrder] create_order failed", { code: error.code });
    }
    return mapped;
  }

  const row = data?.[0];
  if (!row) return orderError("server_error");
  return { ok: true, orderNumber: row.order_number, total: Number(row.total), trackingToken, isNew: row.is_new };
}

/** Safe tracking data for one order, or null for an unknown/malformed token. */
export async function getOrderTracking(token: unknown) {
  if (!isOrderBackendConfigured() || !isWellFormedTrackingToken(token)) return null;
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("get_order_tracking", { p_token_hash: hashTrackingToken(token) });
  if (error) {
    console.error("[getOrderTracking] failed", { code: error.code });
    return null;
  }
  return data;
}
