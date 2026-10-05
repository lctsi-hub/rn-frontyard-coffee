// Rebuilds a customer's order from the authoritative menu and store settings.
//
// The browser sends only ids and choices (product, size, options, add-ons,
// quantity, notes, customer details). Every name and price here comes from the
// menu on the server; anything unknown, unavailable or inconsistent rejects the
// whole order. The result is exactly what create_order() in the database expects.
import {
  findDeliveryArea,
  isDeliveryAvailable,
  MAX_FIELD_LENGTH,
  normalizePhMobile,
  paymentMethodsFor,
  quoteDelivery,
} from "@/lib/checkout";
import { buildMenuIndex, findMissingChoices, MAX_NOTES_LENGTH, MAX_QUANTITY, priceItem } from "@/lib/pricing";
import { MAX_TABLE_NUMBER } from "@/lib/table";
import type { Menu } from "@/types/menu";
import type { OrderType, PaymentMethodId, StoreSettings } from "@/types/order";
import { orderError, type OrderError } from "./errors";

export const MAX_ORDER_LINES = 50;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_TYPES: readonly OrderType[] = ["dine_in", "take_out", "delivery"];

/** Order header as create_order() expects it (minus tracking_token_hash, added by the server). */
export type OrderPayload = {
  client_request_id: string;
  expected_total: number;
  order_type: OrderType;
  customer_name: string;
  customer_phone: string | null;
  table_number: number | null;
  delivery_area_id: string | null;
  delivery_address: string | null;
  delivery_landmark: string | null;
  delivery_instructions: string | null;
  payment_method: PaymentMethodId;
  notes: string;
};

export type OrderItemPayload = {
  product_key: string;
  product_name: string;
  category_name: string | null;
  size_name: string | null;
  base_price: number;
  options: Array<{ group: string; name: string; price_delta: number }>;
  addons: Array<{ key: string; name: string; price: number }>;
  unit_price: number;
  quantity: number;
  notes: string;
};

export type BuiltOrder = {
  order: OrderPayload;
  items: OrderItemPayload[];
  subtotal: number;
  deliveryFee: number;
  total: number;
};

export type BuildOrderResult = { ok: true; value: BuiltOrder } | OrderError;

// ---- small readers for untrusted input -------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * Build the order. `input` is whatever the browser sent; it is treated as
 * untrusted and only ids/choices are read from it.
 */
export function buildOrder(input: unknown, menu: Menu, settings: StoreSettings): BuildOrderResult {
  if (!settings.ordering.enabled) return orderError("ordering_closed");
  if (!isObject(input)) return orderError("invalid_order");

  const clientRequestId = str(input.clientRequestId);
  if (!UUID_PATTERN.test(clientRequestId)) return orderError("invalid_order");
  const expectedTotal = input.expectedTotal;
  if (typeof expectedTotal !== "number" || !Number.isFinite(expectedTotal)) return orderError("invalid_order");

  const orderType = input.orderType as OrderType;
  if (!ORDER_TYPES.includes(orderType)) return orderError("invalid_order");

  // ---- items: rebuilt from the menu ------------------------------------------------
  if (!Array.isArray(input.items) || input.items.length === 0) return orderError("empty_order");
  if (input.items.length > MAX_ORDER_LINES) return orderError("too_many_items");

  const index = buildMenuIndex(menu);
  const categoryNames = new Map(menu.categories.map((c) => [c.id, c.name]));
  const items: OrderItemPayload[] = [];
  let subtotal = 0;

  for (const raw of input.items) {
    if (!isObject(raw)) return orderError("invalid_item");
    const productId = str(raw.productId);
    const sizeId = raw.sizeId === null || raw.sizeId === undefined ? null : str(raw.sizeId);
    const optionIds = raw.optionIds ?? [];
    const addonIds = raw.addonIds ?? [];
    const quantity = raw.quantity;
    const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";

    if (!isStringArray(optionIds) || !isStringArray(addonIds)) return orderError("invalid_item");
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      return orderError("invalid_item");
    }
    if (notes.length > MAX_NOTES_LENGTH) return orderError("invalid_item");

    const product = index.products.get(productId);
    if (!product) return orderError("invalid_item");
    if (!product.isAvailable) return orderError("item_unavailable");

    // Size must be one of the product's sizes (or none when it has none).
    if (product.sizes.length > 0 ? !product.sizes.some((s) => s.id === sizeId) : sizeId !== null) {
      return orderError("invalid_item");
    }

    // Every option must belong to this product, at most one per group.
    if (new Set(optionIds).size !== optionIds.length) return orderError("invalid_item");
    const groupsUsed = new Set<string>();
    for (const optionId of optionIds) {
      const group = product.variantGroups.find((g) => g.options.some((o) => o.id === optionId));
      if (!group || groupsUsed.has(group.id)) return orderError("invalid_item");
      groupsUsed.add(group.id);
    }
    if (findMissingChoices(product, { sizeId, optionIds }).length > 0) return orderError("invalid_item");

    // Every add-on must be offered for this product and currently available.
    if (new Set(addonIds).size !== addonIds.length) return orderError("invalid_item");
    for (const addonId of addonIds) {
      const addon = index.addons.get(addonId);
      if (!addon || !product.addonIds.includes(addonId)) return orderError("invalid_item");
      if (!addon.isAvailable) return orderError("item_unavailable");
    }

    const priced = priceItem(index, { productId, sizeId, optionIds, addonIds, quantity, notes });
    if (!priced || priced.issues.length > 0) return orderError("invalid_item");

    items.push({
      product_key: product.id,
      product_name: product.name,
      category_name: categoryNames.get(product.categoryId) ?? null,
      size_name: priced.size?.name ?? null,
      base_price: priced.size?.price ?? product.basePrice,
      options: priced.options.map(({ group, option }) => ({
        group: group.name,
        name: option.name,
        price_delta: option.priceDelta,
      })),
      addons: priced.addons.map((a) => ({ key: a.id, name: a.name, price: a.price })),
      unit_price: priced.unitPrice,
      quantity,
      notes,
    });
    subtotal += priced.lineTotal;
  }

  // ---- customer + order type details -------------------------------------------------
  const customer = isObject(input.customer) ? input.customer : {};
  const name = str(customer.name);
  if (name.length < 1 || name.length > MAX_FIELD_LENGTH.name) return orderError("invalid_details");

  const rawPhone = str(customer.phone);
  const phone = rawPhone ? normalizePhMobile(rawPhone) : null;
  if (rawPhone && !phone) return orderError("invalid_details");
  if (orderType !== "dine_in" && !phone) return orderError("invalid_details");

  let tableNumber: number | null = null;
  if (orderType === "dine_in") {
    const table = input.tableNumber;
    if (typeof table !== "number" || !Number.isInteger(table) || table < 1 || table > MAX_TABLE_NUMBER) {
      return orderError("invalid_details");
    }
    tableNumber = table;
  }

  const orderNotes = str(input.notes);
  if (orderNotes.length > MAX_FIELD_LENGTH.orderNotes) return orderError("invalid_details");

  const paymentMethod = input.paymentMethod as PaymentMethodId;
  if (!paymentMethodsFor(settings, orderType).some((m) => m.id === paymentMethod)) {
    return orderError("invalid_payment_method");
  }

  // ---- delivery -------------------------------------------------------------------------
  let deliveryFee = 0;
  let delivery: Pick<OrderPayload, "delivery_area_id" | "delivery_address" | "delivery_landmark" | "delivery_instructions"> = {
    delivery_area_id: null,
    delivery_address: null,
    delivery_landmark: null,
    delivery_instructions: null,
  };

  if (orderType === "delivery") {
    if (!isDeliveryAvailable(settings)) return orderError("delivery_unavailable");
    if (subtotal < settings.delivery.minimumOrder) return orderError("delivery_below_minimum");

    const d = isObject(input.delivery) ? input.delivery : {};
    const areaId = str(d.areaId);
    if (!findDeliveryArea(settings, areaId)) return orderError("delivery_area_invalid");
    const address = str(d.address);
    const landmark = str(d.landmark);
    const instructions = str(d.instructions);
    if (!address || address.length > MAX_FIELD_LENGTH.address) return orderError("invalid_details");
    if (!landmark || landmark.length > MAX_FIELD_LENGTH.landmark) return orderError("invalid_details");
    if (instructions.length > MAX_FIELD_LENGTH.instructions) return orderError("invalid_details");

    deliveryFee = quoteDelivery(settings, areaId, subtotal)?.fee ?? 0;
    delivery = {
      delivery_area_id: areaId,
      delivery_address: address,
      delivery_landmark: landmark,
      delivery_instructions: instructions || null,
    };
  }

  const total = subtotal + deliveryFee;
  // The browser's total is only a check: never charge something the customer didn't see.
  if (expectedTotal !== total) return orderError("total_changed");

  return {
    ok: true,
    value: {
      order: {
        client_request_id: clientRequestId.toLowerCase(),
        expected_total: total,
        order_type: orderType,
        customer_name: name,
        customer_phone: phone,
        table_number: tableNumber,
        ...delivery,
        payment_method: paymentMethod,
        notes: orderNotes,
      },
      items,
      subtotal,
      deliveryFee,
      total,
    },
  };
}
