// Order shapes for the staff screens (admin board, kitchen, history). Staff see
// the full order including private delivery details; these are only ever read
// with a signed-in admin's session, and RLS returns nothing to anyone else.
import type { Database } from "@/lib/supabase/database.types";
import type { OrderStatus } from "./status";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type ItemRow = Database["public"]["Tables"]["order_items"]["Row"];

export type AdminOrderItem = Omit<ItemRow, "order_id" | "created_at" | "source" | "added_by">;
export type AdminOrder = Omit<OrderRow, "order_seq" | "tracking_token_hash" | "client_request_id" | "request_fingerprint"> & {
  order_items: AdminOrderItem[];
};

/** Columns staff screens need (never the token hash, fingerprint or request id). */
export const ADMIN_ORDER_COLUMNS =
  "id, order_number, order_type, status, customer_name, customer_phone, table_number, delivery_area_id, delivery_area_name, delivery_address, delivery_landmark, delivery_instructions, payment_method, notes, subtotal, delivery_fee, total, created_at, updated_at, order_items(id, line_number, product_key, product_name, category_name, size_name, base_price, options, addons, unit_price, quantity, notes, line_total)";

export const PAYMENT_LABELS = { cash: "Cash", gcash: "GCash", counter: "Pay at Counter" } as const;

type Named = { name?: unknown; group?: unknown };
export function optionNames(value: unknown): string[] {
  return Array.isArray(value) ? (value as Named[]).map((o) => String(o.name ?? "")).filter(Boolean) : [];
}

/** Friendly message for update_order_status() errors. */
export function statusErrorMessage(message: string | undefined) {
  switch (message) {
    case "status_changed":
      return "This order was already updated (maybe by another staff member). The board has been refreshed.";
    case "invalid_status_transition":
      return "That status change isn't allowed for this order.";
    case "not_authorized":
      return "Your session has expired or lacks staff access. Please sign in again.";
    case "order_not_found":
      return "That order no longer exists.";
    default:
      return "Couldn't update the order. Please check your connection and try again.";
  }
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return ["received", "confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"].includes(value as string);
}
