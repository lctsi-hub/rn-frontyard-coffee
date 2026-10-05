// Staff adding an item to an existing, still-open order (e.g. "one more rice
// for Table 5"). The browser sends only ids and choices; names and prices are
// rebuilt here from the menu, exactly like checkout. Any price the browser
// might send is ignored.
import { quickExtras as localQuickExtras } from "@/data/menu-data";
import { buildMenuIndex, MAX_NOTES_LENGTH, MAX_QUANTITY } from "@/lib/pricing";
import type { Menu, QuickExtra } from "@/types/menu";
import { buildOrderItem, type OrderItemPayload } from "./build-order";
import type { OrderStatus } from "./status";

/** Statuses an order can still take new items in (never after dispatch, completion or cancellation). */
export const ADDABLE_STATUSES: readonly OrderStatus[] = ["received", "confirmed", "preparing", "ready"];

export function canAddItems(status: string) {
  return (ADDABLE_STATUSES as readonly string[]).includes(status);
}

export const EXTRAS_CATEGORY = "Extras";

/** A Quick Extra with its live price and availability (from its add-on). */
export type PricedExtra = QuickExtra & { price: number; isAvailable: boolean };

export function resolveQuickExtras(menu: Menu, extras: QuickExtra[] = localQuickExtras): PricedExtra[] {
  const addons = new Map(menu.addons.map((a) => [a.id, a]));
  return extras.flatMap((extra) => {
    const addon = addons.get(extra.addonId);
    return addon ? [{ ...extra, price: addon.price, isAvailable: addon.isAvailable }] : [];
  });
}

export const ADD_ITEM_MESSAGES = {
  not_connected: "Orders aren't connected on this server, so nothing was added.",
  needs_database_update:
    "Adding items needs the database update 20261006120000_add_items_to_orders.sql. Apply it in the Supabase SQL Editor, then try again.",
  not_authorized: "Your session has expired or lacks staff access. Please sign in again.",
  invalid_request: "Something in this request couldn't be read. Please try again.",
  invalid_item: "That item or choice isn't on the menu. Please pick it again.",
  item_unavailable: "That item is marked Sold out.",
  item_price_mismatch: "That item's price couldn't be confirmed. Please try again.",
  too_many_items: "This order already has the maximum number of items.",
  order_not_found: "That order no longer exists.",
  order_closed: "This order is already completed, cancelled or out for delivery, so items can't be added. Start a new order instead.",
  idempotency_key_reused: "Please try adding the item again.",
  server_error: "Couldn't add the item. Please check your connection and try again.",
} as const;

export type AddItemErrorCode = keyof typeof ADD_ITEM_MESSAGES;
export type AddItemError = { ok: false; code: AddItemErrorCode; message: string };

export function addItemError(code: AddItemErrorCode): AddItemError {
  return { ok: false, code, message: ADD_ITEM_MESSAGES[code] };
}

/** Database errors carry the code as the message; anything else is a server error. */
export function addItemErrorFromDatabase(message: string | undefined, code?: string): AddItemError {
  // PostgREST: function not in the schema cache → the migration isn't applied yet.
  if (code === "PGRST202") return addItemError("needs_database_update");
  const key = message?.trim();
  return key && key in ADD_ITEM_MESSAGES ? addItemError(key as AddItemErrorCode) : addItemError("server_error");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export type StaffAddition = { orderId: string; requestId: string; item: OrderItemPayload; lineTotal: number };

/**
 * Read an untrusted "add item" request and rebuild the item from the menu.
 * `input`: {orderId, requestId, item: {kind: "product", productId, sizeId,
 * optionIds, addonIds, quantity, notes} | {kind: "extra", extraId, quantity, notes}}
 */
export function buildStaffAddition(
  input: unknown,
  menu: Menu,
  extras: QuickExtra[] = localQuickExtras,
): { ok: true; value: StaffAddition } | AddItemError {
  if (!isObject(input) || !isObject(input.item)) return addItemError("invalid_request");
  const orderId = typeof input.orderId === "string" ? input.orderId : "";
  const requestId = typeof input.requestId === "string" ? input.requestId : "";
  if (!UUID_PATTERN.test(orderId) || !UUID_PATTERN.test(requestId)) return addItemError("invalid_request");

  const raw = input.item;
  if (raw.kind === "extra") {
    const quantity = raw.quantity;
    const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return addItemError("invalid_item");
    }
    if (notes.length > MAX_NOTES_LENGTH) return addItemError("invalid_item");
    const extra = resolveQuickExtras(menu, extras).find((e) => e.id === raw.extraId);
    if (!extra) return addItemError("invalid_item");
    if (!extra.isAvailable) return addItemError("item_unavailable");
    const item: OrderItemPayload = {
      product_key: extra.id,
      product_name: extra.name,
      category_name: EXTRAS_CATEGORY,
      size_name: null,
      base_price: extra.price,
      options: [],
      addons: [],
      unit_price: extra.price,
      quantity,
      notes,
    };
    return { ok: true, value: { orderId, requestId, item, lineTotal: extra.price * quantity } };
  }

  if (raw.kind !== "product") return addItemError("invalid_item");
  const built = buildOrderItem(
    { productId: raw.productId, sizeId: raw.sizeId, optionIds: raw.optionIds, addonIds: raw.addonIds, quantity: raw.quantity, notes: raw.notes },
    buildMenuIndex(menu),
    new Map(menu.categories.map((c) => [c.id, c.name])),
  );
  if (!built.ok) return addItemError(built.code === "item_unavailable" ? "item_unavailable" : "invalid_item");
  return { ok: true, value: { orderId, requestId, item: built.item, lineTotal: built.lineTotal } };
}
